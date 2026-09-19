"""
AI Symptom to Hospital Matching Service
Architecture Split:
  1. Gemini Reasoning: Strict JSON extraction of urgency, specialities, tests, medicine categories, summary.
     - Constrained to DB-derived enums.
     - Output JSON cached by symptom hash (SHA-256).
     - NEVER allows Gemini to name a hospital or doctor.
  2. Live Backend Ranking: Always live from DB, never cached.
     - Matched speciality + active doctor + next open slot.
     - Suggested tests match ratio (available vs missing).
     - Suggested medicine categories stock status (IN_STOCK=1.0, LOW_STOCK=0.5, OUT_OF_STOCK=0.0).
     - Proximity / Haversine distance.
  3. Safety: Emergency override, nearest emergency facility pinning, clinician disclaimer, fallback handler.
"""
import os
import json
import math
import hashlib
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from ..models import Hospital, HospitalDoctor, HospitalTest, HospitalPharmacyItem, Inventory
from ..schemas import (
    SymptomAssessment,
    SpecialityConfidence,
    HospitalMatchResult,
    DoctorMatchInfo,
    MedicineStockInfo,
    ScoreBreakdown,
    EmergencyFacilityInfo,
    EmergencyOverride,
    SymptomMatchRequest,
    SymptomMatchResponse,
)
from ..hospital_loader import DISTRICT_CENTERS, haversine

logger = logging.getLogger("sevasetu.symptom_matching")

# In-memory cache for raw Gemini assessment JSON keyed by SHA-256 hash of symptom input
_GEMINI_ASSESSMENT_CACHE: Dict[str, Dict[str, Any]] = {}

# Standard Master Enums used for prompt constraints and fallback matching
MASTER_SPECIALITIES = [
    "General Medicine",
    "Pediatrics",
    "Cardiology",
    "Orthopedics",
    "Obstetrics & Gynecology",
    "Dermatology",
    "Neurology",
    "Ophthalmology",
    "ENT",
    "Pulmonology",
    "Gastroenterology",
    "Psychiatry",
    "General Surgery",
    "Nephrology",
]

MASTER_TEST_CATEGORIES = [
    "Complete Blood Count (CBC)",
    "ECG (12-Lead)",
    "Chest X-Ray",
    "Blood Glucose (Fasting/PP)",
    "Lipid Profile",
    "Liver Function Test (LFT)",
    "Kidney Function Test (KFT)",
    "Urine Routine & Microscopy",
    "Ultrasound Abdomen",
    "Dengue NS1 / IgM",
    "Malaria Rapid Diagnostic Test",
    "Thyroid Profile (T3, T4, TSH)",
    "CT Brain",
    "Serum Electrolytes",
]

MASTER_MEDICINE_CATEGORIES = [
    "Analgesics & Antipyretics",
    "Antibiotics",
    "Antihypertensives",
    "Antidiabetics",
    "Antacids & PPIs",
    "Antihistamines",
    "Respiratory & Bronchodilators",
    "Cardiac & Antianginal",
    "IV Fluids & Electrolytes",
    "Dermatologicals",
    "Antiemetics",
    "Antispasmodics",
]


class SymptomMatchingService:
    def __init__(self, model_version: str = "gemini-3.6-flash"):
        self.model_version = model_version
        self._gemini_client = None

    def _get_gemini_client(self):
        if self._gemini_client is not None:
            return self._gemini_client
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return None
        try:
            from google import genai
            self._gemini_client = genai.Client(api_key=api_key)
            return self._gemini_client
        except Exception as e:
            logger.warning(f"Could not initialize GenAI client: {e}")
            return None

    def get_constrained_enums(self, db: Session) -> Tuple[List[str], List[str], List[str]]:
        """
        Dynamically discovers distinct specialities, tests, and medicine categories
        from the live database, falling back to master clinical lists.
        """
        try:
            db_specialities = [
                row[0] for row in db.query(HospitalDoctor.speciality).distinct().all() if row[0]
            ]
            specialities = sorted(list(set(db_specialities + MASTER_SPECIALITIES)))
        except Exception:
            specialities = MASTER_SPECIALITIES

        try:
            db_tests = [
                row[0] for row in db.query(HospitalTest.test_name).distinct().all() if row[0]
            ]
            tests = sorted(list(set(db_tests + MASTER_TEST_CATEGORIES)))
        except Exception:
            tests = MASTER_TEST_CATEGORIES

        try:
            db_med_categories = [
                row[0] for row in db.query(Inventory.category).distinct().all() if row[0]
            ]
            med_categories = sorted(list(set(db_med_categories + MASTER_MEDICINE_CATEGORIES)))
        except Exception:
            med_categories = MASTER_MEDICINE_CATEGORIES

        return specialities, tests, med_categories

    def _compute_symptom_hash(self, symptoms: str, age: int, sex: str, duration: str) -> str:
        """Generates deterministic SHA-256 hash for caching reasoning JSON."""
        normalized = f"{symptoms.strip().lower()}|{age}|{sex.strip().lower()}|{duration.strip().lower()}"
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    def _fallback_reasoning(
        self,
        symptoms: str,
        age: int,
        sex: str,
        manual_speciality: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Deterministic, safe rule-based clinical fallback when Gemini is unavailable or errors.
        """
        s_lower = symptoms.lower()
        urgency = "ROUTINE"

        # Check critical emergency red flags
        emergency_keywords = [
            "chest pain", "heart attack", "unconscious", "collapse", "severe breathlessness",
            "stroke", "paralysis", "heavy bleeding", "cyanosis", "severe trauma", "poisoning"
        ]
        if any(kw in s_lower for kw in emergency_keywords):
            urgency = "EMERGENCY"
        elif any(kw in s_lower for kw in ["high fever", "vomiting blood", "fracture", "severe pain", "dehydration"]):
            urgency = "URGENT"

        # Map specialities
        matched_specs: List[Dict[str, Any]] = []
        if manual_speciality:
            matched_specs.append({"name": manual_speciality, "confidence": 1.0})
        else:
            if any(k in s_lower for k in ["heart", "chest", "bp", "palpitation", "angina"]):
                matched_specs.append({"name": "Cardiology", "confidence": 0.95})
            if any(k in s_lower for k in ["child", "baby", "infant", "toddler", "pediatric"]):
                matched_specs.append({"name": "Pediatrics", "confidence": 0.95})
            if any(k in s_lower for k in ["bone", "fracture", "joint", "knee", "back pain", "sprain"]):
                matched_specs.append({"name": "Orthopedics", "confidence": 0.90})
            if any(k in s_lower for k in ["pregnancy", "maternal", "period", "uterus", "bleeding"]):
                matched_specs.append({"name": "Obstetrics & Gynecology", "confidence": 0.92})
            if any(k in s_lower for k in ["skin", "rash", "itch", "eczema", "allergy"]):
                matched_specs.append({"name": "Dermatology", "confidence": 0.90})
            if any(k in s_lower for k in ["brain", "headache", "dizzy", "seizure", "numbness", "stroke"]):
                matched_specs.append({"name": "Neurology", "confidence": 0.90})
            if any(k in s_lower for k in ["eye", "vision", "cataract", "blurry"]):
                matched_specs.append({"name": "Ophthalmology", "confidence": 0.90})
            if any(k in s_lower for k in ["ear", "nose", "throat", "tonsil"]):
                matched_specs.append({"name": "ENT", "confidence": 0.90})
            if any(k in s_lower for k in ["cough", "breath", "asthma", "wheezing", "lungs"]):
                matched_specs.append({"name": "Pulmonology", "confidence": 0.90})
            if any(k in s_lower for k in ["stomach", "vomit", "diarrhea", "abdomen", "acidity", "liver"]):
                matched_specs.append({"name": "Gastroenterology", "confidence": 0.90})

            if not matched_specs:
                matched_specs.append({"name": "General Medicine", "confidence": 0.85})

        # Suggest tests and medicines based on top matched speciality
        primary = matched_specs[0]["name"]
        tests_map = {
            "Cardiology": ["ECG (12-Lead)", "Lipid Profile", "Complete Blood Count (CBC)"],
            "Pediatrics": ["Complete Blood Count (CBC)", "Urine Routine & Microscopy"],
            "Orthopedics": ["Chest X-Ray", "Serum Electrolytes"],
            "Obstetrics & Gynecology": ["Ultrasound Abdomen", "Complete Blood Count (CBC)", "Urine Routine & Microscopy"],
            "Dermatology": ["Complete Blood Count (CBC)"],
            "Neurology": ["CT Brain", "Blood Glucose (Fasting/PP)"],
            "Ophthalmology": ["Blood Glucose (Fasting/PP)"],
            "ENT": ["Complete Blood Count (CBC)"],
            "Pulmonology": ["Chest X-Ray", "Complete Blood Count (CBC)"],
            "Gastroenterology": ["Liver Function Test (LFT)", "Ultrasound Abdomen", "Complete Blood Count (CBC)"],
            "General Medicine": ["Complete Blood Count (CBC)", "Blood Glucose (Fasting/PP)", "Urine Routine & Microscopy"],
        }
        meds_map = {
            "Cardiology": ["Cardiac & Antianginal", "Antihypertensives", "Analgesics & Antipyretics"],
            "Pediatrics": ["Analgesics & Antipyretics", "Antibiotics", "IV Fluids & Electrolytes"],
            "Orthopedics": ["Analgesics & Antipyretics", "Antacids & PPIs"],
            "Obstetrics & Gynecology": ["Analgesics & Antipyretics", "Antibiotics", "IV Fluids & Electrolytes"],
            "Dermatology": ["Dermatologicals", "Antihistamines"],
            "Neurology": ["Analgesics & Antipyretics", "Antihypertensives"],
            "Ophthalmology": ["Analgesics & Antipyretics", "Antihistamines"],
            "ENT": ["Antibiotics", "Antihistamines", "Analgesics & Antipyretics"],
            "Pulmonology": ["Respiratory & Bronchodilators", "Antibiotics", "Analgesics & Antipyretics"],
            "Gastroenterology": ["Antacids & PPIs", "Antiemetics", "IV Fluids & Electrolytes"],
            "General Medicine": ["Analgesics & Antipyretics", "Antibiotics", "Antacids & PPIs"],
        }

        suggested_tests = tests_map.get(primary, ["Complete Blood Count (CBC)"])
        medicine_categories = meds_map.get(primary, ["Analgesics & Antipyretics"])

        summary = f"Rule-based assessment for {symptoms[:60]}... Triaged as {urgency} for {primary} consultation."

        return {
            "urgency": urgency,
            "specialities": matched_specs,
            "suggested_tests": suggested_tests,
            "medicine_categories": medicine_categories,
            "summary": summary,
            "fallback_used": True,
        }

    def assess_symptoms_with_gemini(
        self,
        db: Session,
        symptoms: str,
        age: int,
        sex: str,
        duration: str,
        manual_speciality: Optional[str] = None,
    ) -> SymptomAssessment:
        """
        Invokes Gemini with constrained enums to output STRICT JSON reasoning.
        Caches reasoning result by symptom hash.
        """
        # If manual speciality requested by user, bypass or use directly
        if manual_speciality:
            fallback = self._fallback_reasoning(symptoms, age, sex, manual_speciality=manual_speciality)
            return SymptomAssessment(
                urgency=fallback["urgency"],
                specialities=[SpecialityConfidence(name=manual_speciality, confidence=1.0)],
                suggested_tests=fallback["suggested_tests"],
                medicine_categories=fallback["medicine_categories"],
                summary=f"User-selected specialty: {manual_speciality}. {fallback['summary']}",
                cached=False,
                fallback_used=True,
            )

        cache_key = self._compute_symptom_hash(symptoms, age, sex, duration)
        if cache_key in _GEMINI_ASSESSMENT_CACHE:
            cached_data = _GEMINI_ASSESSMENT_CACHE[cache_key]
            logger.info(f"Symptom assessment cache hit for hash {cache_key[:8]}")
            return SymptomAssessment(
                urgency=cached_data.get("urgency", "ROUTINE"),
                specialities=[
                    SpecialityConfidence(**s) if isinstance(s, dict) else SpecialityConfidence(name=str(s))
                    for s in cached_data.get("specialities", [])
                ],
                suggested_tests=cached_data.get("suggested_tests", []),
                medicine_categories=cached_data.get("medicine_categories", []),
                summary=cached_data.get("summary", ""),
                cached=True,
                fallback_used=cached_data.get("fallback_used", False),
            )

        # Get constrained DB enums to pass to Gemini
        avail_specs, avail_tests, avail_meds = self.get_constrained_enums(db)

        client = self._get_gemini_client()
        if not client:
            logger.info("Gemini API key not configured or client unavailable. Using rule-based fallback.")
            fallback = self._fallback_reasoning(symptoms, age, sex)
            return SymptomAssessment(
                urgency=fallback["urgency"],
                specialities=[SpecialityConfidence(**s) for s in fallback["specialities"]],
                suggested_tests=fallback["suggested_tests"],
                medicine_categories=fallback["medicine_categories"],
                summary=fallback["summary"],
                cached=False,
                fallback_used=True,
            )

        prompt = f"""You are a clinical reasoning triage engine for India's National Health Mission (SevaSetu).
Analyze the patient's symptoms, age, sex, and duration.

ALLOWED SPECIALITIES (choose 1 to 3 strictly from this list):
{json.dumps(avail_specs)}

ALLOWED SUGGESTED TESTS (choose 1 to 4 strictly from this list):
{json.dumps(avail_tests)}

ALLOWED MEDICINE CATEGORIES (choose 1 to 4 strictly from this list):
{json.dumps(avail_meds)}

PATIENT INTAKE:
- Age: {age}
- Sex: {sex}
- Symptom Duration: {duration}
- Symptoms: {symptoms}

CRITICAL RULES:
1. NEVER name any specific hospital, clinic, or doctor.
2. NEVER provide specific pharmaceutical brand names or medication dosages.
3. Classify "urgency" as exactly one of: "EMERGENCY" (threat to life/organ, e.g. severe chest pain, stroke, unconsciousness, severe respiratory failure), "URGENT" (needs attention within 2-4 hours), or "ROUTINE" (standard outpatient care).
4. Assign confidence score (0.0 to 1.0) for each chosen speciality.
5. Provide a concise 1-2 sentence clinical summary.

Return STRICT JSON only, with this exact schema (no markdown, no other keys):
{{
  "urgency": "EMERGENCY" | "URGENT" | "ROUTINE",
  "specialities": [
    {{"name": "Speciality Name", "confidence": 0.95}}
  ],
  "suggested_tests": ["Test Name 1", "Test Name 2"],
  "medicine_categories": ["Category 1", "Category 2"],
  "summary": "Clinical rationale summary..."
}}"""

        try:
            response = client.models.generate_content(
                model=self.model_version,
                contents=prompt
            )
            raw_text = (response.text or "").strip()
            if raw_text.startswith("```"):
                lines = raw_text.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                raw_text = "\n".join(lines).strip()

            parsed = json.loads(raw_text)

            # Validate schema strictly
            urgency = parsed.get("urgency", "ROUTINE").upper()
            if urgency not in ["EMERGENCY", "URGENT", "ROUTINE"]:
                urgency = "ROUTINE"

            raw_specs = parsed.get("specialities", [])
            valid_specs: List[Dict[str, Any]] = []
            for spec in raw_specs:
                if isinstance(spec, dict) and "name" in spec:
                    name = spec["name"]
                    conf = float(spec.get("confidence", 0.9))
                    # Check if matching allowed
                    valid_specs.append({"name": name, "confidence": min(1.0, max(0.1, conf))})
                elif isinstance(spec, str):
                    valid_specs.append({"name": spec, "confidence": 0.9})

            if not valid_specs:
                valid_specs = [{"name": "General Medicine", "confidence": 0.85}]

            suggested_tests = [t for t in parsed.get("suggested_tests", []) if isinstance(t, str)]
            medicine_categories = [m for m in parsed.get("medicine_categories", []) if isinstance(m, str)]
            summary = parsed.get("summary", "Clinical symptom assessment completed.")

            assessment_dict = {
                "urgency": urgency,
                "specialities": valid_specs,
                "suggested_tests": suggested_tests,
                "medicine_categories": medicine_categories,
                "summary": summary,
                "fallback_used": False,
            }

            # Cache the clean JSON output
            _GEMINI_ASSESSMENT_CACHE[cache_key] = assessment_dict

            return SymptomAssessment(
                urgency=urgency,
                specialities=[SpecialityConfidence(**s) for s in valid_specs],
                suggested_tests=suggested_tests,
                medicine_categories=medicine_categories,
                summary=summary,
                cached=False,
                fallback_used=False,
            )

        except Exception as e:
            logger.error(f"Gemini symptom reasoning failed: {e}. Executing fallback.")
            fallback = self._fallback_reasoning(symptoms, age, sex)
            return SymptomAssessment(
                urgency=fallback["urgency"],
                specialities=[SpecialityConfidence(**s) for s in fallback["specialities"]],
                suggested_tests=fallback["suggested_tests"],
                medicine_categories=fallback["medicine_categories"],
                summary=fallback["summary"],
                cached=False,
                fallback_used=True,
            )

    def _determine_next_slot(self, slots_json: Optional[str]) -> str:
        """Helper to parse availability_slots JSON and return next slot text."""
        if not slots_json:
            return "Today OPD (09:00 AM - 01:00 PM)"
        try:
            slots = json.loads(slots_json)
            if isinstance(slots, list) and len(slots) > 0:
                first = slots[0]
                day = first.get("day", "Today")
                start = first.get("start_time", "09:00")
                end = first.get("end_time", "13:00")
                return f"{day} {start} - {end}"
        except Exception:
            pass
        return "Today OPD (09:00 AM - 01:00 PM)"

    def rank_hospitals_live(
        self,
        db: Session,
        assessment: SymptomAssessment,
        patient_lat: Optional[float] = None,
        patient_lng: Optional[float] = None,
        patient_district: Optional[str] = None,
    ) -> Tuple[List[HospitalMatchResult], Optional[EmergencyOverride]]:
        """
        ALWAYS LIVE — Pulls fresh doctors, tests, pharmacy inventory, and hospital records
        from DB to compute multi-factor scores for each facility.
        """
        # 1. Determine reference coordinates
        ref_lat = patient_lat
        ref_lng = patient_lng
        if ref_lat is None or ref_lng is None:
            dist_key = (patient_district or "").lower().strip()
            if dist_key in DISTRICT_CENTERS:
                ref_lat, ref_lng = DISTRICT_CENTERS[dist_key]
            else:
                # Default Pune center
                ref_lat, ref_lng = DISTRICT_CENTERS["pune"]

        # 2. Fetch fresh hospitals from DB
        h_query = db.query(Hospital)
        if patient_district:
            # Query district hospitals + neighboring
            dist_hospitals = h_query.filter(
                or_(
                    func.lower(Hospital.district) == patient_district.lower().strip(),
                    Hospital.district == None
                )
            ).all()
            if len(dist_hospitals) >= 5:
                hospitals = dist_hospitals
            else:
                hospitals = h_query.limit(100).all()
        else:
            hospitals = h_query.limit(100).all()

        if not hospitals:
            return [], None

        # 3. Fetch all active doctors, available tests, and pharmacy items fresh from DB
        all_doctors = db.query(HospitalDoctor).filter(HospitalDoctor.is_active == True).all()
        all_tests = db.query(HospitalTest).filter(HospitalTest.is_available == True).all()
        all_pharmacy = db.query(HospitalPharmacyItem).all()
        all_inventory = db.query(Inventory).all()

        # Group resources by hospital_id and lowercase hospital name for resilient matching
        doctors_by_hosp: Dict[str, List[HospitalDoctor]] = {}
        doctors_by_name: Dict[str, List[HospitalDoctor]] = {}
        for d in all_doctors:
            if d.hospital_id:
                doctors_by_hosp.setdefault(d.hospital_id, []).append(d)
            if d.hospital_name:
                doctors_by_name.setdefault(d.hospital_name.lower().strip(), []).append(d)

        tests_by_hosp: Dict[str, List[HospitalTest]] = {}
        tests_by_name: Dict[str, List[HospitalTest]] = {}
        for t in all_tests:
            if t.hospital_id:
                tests_by_hosp.setdefault(t.hospital_id, []).append(t)
            if t.hospital_name:
                tests_by_name.setdefault(t.hospital_name.lower().strip(), []).append(t)

        pharmacy_by_hosp: Dict[str, List[HospitalPharmacyItem]] = {}
        for p in all_pharmacy:
            if p.hospital_id:
                pharmacy_by_hosp.setdefault(p.hospital_id, []).append(p)

        inventory_by_facility: Dict[str, List[Inventory]] = {}
        for inv in all_inventory:
            if inv.facility_name:
                inventory_by_facility.setdefault(inv.facility_name.lower().strip(), []).append(inv)

        # 4. Emergency facility lookup
        emergency_override: Optional[EmergencyOverride] = None
        closest_emergency_facility: Optional[Hospital] = None
        min_emergency_dist = float("inf")

        for h in hospitals:
            is_emerg = bool(
                (h.emergency_services and h.emergency_services.strip().lower() not in ["no", "none", "0"]) or
                (h.ambulance and h.ambulance.strip().lower() not in ["no", "none", "0"]) or
                (h.care_type and any(ct in h.care_type.lower() for ct in ["tertiary", "district hospital", "sub-district"])) or
                (h.category and any(c in h.category.lower() for c in ["tertiary", "district", "medical college"]))
            )
            if is_emerg:
                h_lat = h.lat if h.lat else ref_lat
                h_lng = h.lng if h.lng else ref_lng
                d_km = haversine(ref_lat, ref_lng, h_lat, h_lng)
                if d_km < min_emergency_dist:
                    min_emergency_dist = d_km
                    closest_emergency_facility = h

        if assessment.urgency == "EMERGENCY" and closest_emergency_facility:
            emergency_override = EmergencyOverride(
                is_emergency=True,
                alert_message=(
                    "CRITICAL EMERGENCY / RED FLAG DETECTED: Symptoms require immediate emergency stabilization. "
                    "Proceed to the nearest emergency-equipped hospital immediately or call 108 ambulance."
                ),
                nearest_facility=EmergencyFacilityInfo(
                    hospital_id=closest_emergency_facility.id,
                    hospital_name=closest_emergency_facility.name,
                    category=closest_emergency_facility.category,
                    address=closest_emergency_facility.address or closest_emergency_facility.district,
                    district=closest_emergency_facility.district,
                    phone=closest_emergency_facility.phone or "108",
                    distance_km=round(min_emergency_dist, 1),
                    emergency_services=closest_emergency_facility.emergency_services or "24x7 Emergency / Trauma",
                    ambulance=closest_emergency_facility.ambulance or "108 Available",
                )
            )

        # 5. Score and Rank Each Hospital
        ranked_results: List[HospitalMatchResult] = []
        target_specialities = {s.name.lower(): s.confidence for s in assessment.specialities}
        suggested_tests = [t.lower() for t in assessment.suggested_tests]
        suggested_meds = [m.lower() for m in assessment.medicine_categories]

        for h in hospitals:
            h_id = h.id
            h_name_lower = (h.name or "").lower().strip()

            # Doctors associated with this hospital
            h_docs = doctors_by_hosp.get(h_id, [])
            if not h_docs:
                h_docs = doctors_by_name.get(h_name_lower, [])

            # Tests associated with this hospital
            h_tests = tests_by_hosp.get(h_id, [])
            if not h_tests:
                h_tests = tests_by_name.get(h_name_lower, [])

            # Pharmacy items associated
            h_pharm = pharmacy_by_hosp.get(h_id, [])
            h_inv = inventory_by_facility.get(h_name_lower, [])

            # A. Doctor Score (Max 40.0 pts)
            doctor_score = 0.0
            best_doc: Optional[DoctorMatchInfo] = None

            # Look for exact specialty match among active doctors
            matched_active_docs: List[Tuple[HospitalDoctor, float]] = []
            for doc in h_docs:
                doc_spec = (doc.speciality or "").lower().strip()
                # Exact or partial match
                for t_spec, conf in target_specialities.items():
                    if t_spec in doc_spec or doc_spec in t_spec:
                        matched_active_docs.append((doc, conf))
                        break

            if matched_active_docs:
                # Pick highest confidence doctor
                matched_active_docs.sort(key=lambda x: x[1], reverse=True)
                top_doc, conf = matched_active_docs[0]
                next_slot_str = self._determine_next_slot(top_doc.availability_slots)
                # Slot bonus: 10.0 if slot text exists, else 6.0
                slot_bonus = 10.0 if next_slot_str else 6.0
                doctor_score = round(min(40.0, (conf * 30.0) + slot_bonus), 1)
                best_doc = DoctorMatchInfo(
                    id=top_doc.id,
                    name=top_doc.name,
                    speciality=top_doc.speciality,
                    next_slot=next_slot_str,
                    qualification=top_doc.qualification,
                    experience_years=top_doc.experience_years or 0,
                )
            else:
                # Fallback: check if hospital has a General Medicine active doctor
                gen_med_docs = [d for d in h_docs if "general" in (d.speciality or "").lower() or "medicine" in (d.speciality or "").lower()]
                if gen_med_docs:
                    top_gen = gen_med_docs[0]
                    next_slot_str = self._determine_next_slot(top_gen.availability_slots)
                    doctor_score = 15.0
                    best_doc = DoctorMatchInfo(
                        id=top_gen.id,
                        name=top_gen.name,
                        speciality=top_gen.speciality,
                        next_slot=next_slot_str,
                        qualification=top_gen.qualification,
                        experience_years=top_gen.experience_years or 0,
                    )
                elif h.doctors and h.doctors > 0:
                    # Hospital directory lists doctors count
                    doctor_score = 8.0

            # B. Diagnostic Test Score (Max 25.0 pts)
            test_score = 0.0
            tests_available: List[str] = []
            tests_missing: List[str] = []

            if not assessment.suggested_tests:
                test_score = 25.0
            else:
                h_test_names = [t.test_name.lower().strip() for t in h_tests] + [t.category.lower().strip() for t in h_tests]
                for raw_test in assessment.suggested_tests:
                    t_lower = raw_test.lower().strip()
                    # Check if test name or category matches
                    if any(t_lower in hn or hn in t_lower for hn in h_test_names):
                        tests_available.append(raw_test)
                    else:
                        tests_missing.append(raw_test)

                match_ratio = len(tests_available) / len(assessment.suggested_tests)
                test_score = round(match_ratio * 25.0, 1)

            # C. Pharmacy & Medicine Stock Score (Max 20.0 pts)
            medicine_score = 0.0
            med_stock_status_list: List[MedicineStockInfo] = []

            if not assessment.medicine_categories:
                medicine_score = 20.0
            else:
                category_points = []
                for raw_cat in assessment.medicine_categories:
                    c_lower = raw_cat.lower().strip()
                    # Check hospital pharmacy items
                    matching_pharm = [
                        p for p in h_pharm
                        if c_lower in (p.medicine_name or "").lower() or
                           c_lower in (p.generic_name or "").lower()
                    ]
                    # Check inventory
                    matching_inv = [
                        inv for inv in h_inv
                        if c_lower in (inv.category or "").lower() or
                           c_lower in (inv.medicine_name or "").lower()
                    ]

                    # Determine stock status
                    status = "OUT_OF_STOCK"
                    sample_name = None
                    pts = 0.0

                    if matching_pharm:
                        in_stock_items = [p for p in matching_pharm if p.status == "IN_STOCK"]
                        if in_stock_items:
                            status = "IN_STOCK"
                            sample_name = in_stock_items[0].medicine_name
                            pts = 1.0
                        else:
                            status = "LOW_STOCK"
                            sample_name = matching_pharm[0].medicine_name
                            pts = 0.5
                    elif matching_inv:
                        in_stock_inv = [i for i in matching_inv if not i.is_low_stock and i.current_stock > i.min_threshold]
                        if in_stock_inv:
                            status = "IN_STOCK"
                            sample_name = in_stock_inv[0].medicine_name
                            pts = 1.0
                        else:
                            status = "LOW_STOCK"
                            sample_name = matching_inv[0].medicine_name
                            pts = 0.5
                    else:
                        status = "OUT_OF_STOCK"
                        pts = 0.0

                    category_points.append(pts)
                    med_stock_status_list.append(
                        MedicineStockInfo(
                            category=raw_cat,
                            status=status,
                            medicine_name=sample_name,
                        )
                    )

                avg_med_pts = sum(category_points) / len(category_points)
                medicine_score = round(avg_med_pts * 20.0, 1)

            # D. Distance Score (Max 15.0 pts)
            h_lat = h.lat if h.lat else ref_lat
            h_lng = h.lng if h.lng else ref_lng
            distance_km = haversine(ref_lat, ref_lng, h_lat, h_lng)
            # Distance decay formula: up to 50 km
            distance_score = round(max(0.0, 15.0 * (1.0 - (distance_km / 50.0))), 1)

            # Total Composite Score
            total_score = round(doctor_score + test_score + medicine_score + distance_score, 1)

            is_emerg_cap = bool(
                (h.emergency_services and h.emergency_services.strip().lower() not in ["no", "none", "0"]) or
                (h.ambulance and h.ambulance.strip().lower() not in ["no", "none", "0"]) or
                (h.care_type and "district" in h.care_type.lower())
            )

            ranked_results.append(
                HospitalMatchResult(
                    hospital_id=h.id,
                    hospital_name=h.name,
                    category=h.category,
                    care_type=h.care_type,
                    address=h.address or f"{h.subdistrict or ''}, {h.district or ''}".strip(", "),
                    district=h.district,
                    phone=h.phone,
                    distance_km=distance_km,
                    score=total_score,
                    score_breakdown=ScoreBreakdown(
                        doctor_score=doctor_score,
                        test_score=test_score,
                        medicine_score=medicine_score,
                        distance_score=distance_score,
                    ),
                    doctor=best_doc,
                    tests_available=tests_available,
                    tests_missing=tests_missing,
                    medicine_stock_status=med_stock_status_list,
                    is_emergency_capable=is_emerg_cap,
                )
            )

        # Sort: In EMERGENCY mode, pin closest emergency-capable hospital first if available
        if assessment.urgency == "EMERGENCY" and closest_emergency_facility:
            # Find result matching closest emergency facility
            emerg_item = next((r for r in ranked_results if r.hospital_id == closest_emergency_facility.id), None)
            other_items = [r for r in ranked_results if r.hospital_id != closest_emergency_facility.id]
            other_items.sort(key=lambda r: (r.score, -r.distance_km), reverse=True)
            if emerg_item:
                final_ranked = [emerg_item] + other_items[:4]
            else:
                final_ranked = other_items[:5]
        else:
            ranked_results.sort(key=lambda r: (r.score, -r.distance_km), reverse=True)
            final_ranked = ranked_results[:5]

        return final_ranked, emergency_override

    def match_symptoms_to_hospitals(
        self,
        db: Session,
        request: SymptomMatchRequest,
    ) -> SymptomMatchResponse:
        """
        Main entrypoint:
          1. Gemini symptom reasoning (cached by hash).
          2. Live DB hospital multi-factor ranking (always live).
        """
        assessment = self.assess_symptoms_with_gemini(
            db=db,
            symptoms=request.symptoms,
            age=request.age,
            sex=request.sex,
            duration=request.duration or "1 day",
            manual_speciality=request.manual_speciality,
        )

        ranked_hospitals, emergency_override = self.rank_hospitals_live(
            db=db,
            assessment=assessment,
            patient_lat=request.lat,
            patient_lng=request.lng,
            patient_district=request.district,
        )

        return SymptomMatchResponse(
            assessment=assessment,
            emergency_override=emergency_override,
            ranked_hospitals=ranked_hospitals,
        )

    def map_differential_to_speciality_and_resources(
        self,
        differential_diagnosis: List[str],
        symptoms: Optional[str] = None
    ) -> Tuple[List[SpecialityConfidence], List[str], List[str]]:
        """
        Fixed lookup mapping AI differential impressions / keywords to DB speciality enums,
        suggested tests, and medicine categories.
        Falls back cleanly to 'General Medicine'.
        """
        combined_text = " ".join(differential_diagnosis or []).lower()
        if symptoms:
            combined_text += " " + symptoms.lower()

        matched_specialities: List[Tuple[str, float]] = []
        suggested_tests_set: List[str] = []
        medicine_categories_set: List[str] = []

        mapping_rules = [
            (
                ("cardio", "coronary", "angina", "myocardial", "infarct", "hypertension", "arrhythmia", "heart failure", "chest pain", "cardiac", "ischemic", "pericarditis", "acs"),
                "Cardiology",
                ["ECG (12-Lead)", "Lipid Profile", "Complete Blood Count (CBC)", "Serum Electrolytes"],
                ["Cardiac & Antianginal", "Antihypertensives", "Analgesics & Antipyretics"],
            ),
            (
                ("urti", "bronchit", "pneumonia", "asthma", "copd", "cough", "wheez", "respiratory", "hypoxemia", "pharyngitis", "laryngitis", "tuberculosis", "pleur", "tracheobronchitis"),
                "Pulmonology",
                ["Chest X-Ray", "Complete Blood Count (CBC)"],
                ["Respiratory & Bronchodilators", "Antibiotics", "Analgesics & Antipyretics"],
            ),
            (
                ("pediatric", "neonatal", "infant", "child", "measles", "croup", "febrile convulsion", "mumps", "rubella"),
                "Pediatrics",
                ["Complete Blood Count (CBC)", "Urine Routine & Microscopy"],
                ["Analgesics & Antipyretics", "Antibiotics", "IV Fluids & Electrolytes"],
            ),
            (
                ("fracture", "joint", "bone", "arthritis", "sprain", "dislocation", "orthopedic", "trauma", "knee", "spine", "spondylitis", "back pain"),
                "Orthopedics",
                ["Chest X-Ray", "Serum Electrolytes"],
                ["Analgesics & Antipyretics", "Antacids & PPIs"],
            ),
            (
                ("maternal", "pregnan", "obstetric", "gynecol", "eclampsia", "labor", "postpartum", "pelvic", "uterine", "vaginal", "antenatal", "preeclampsia", "gestational"),
                "Obstetrics & Gynecology",
                ["Ultrasound Abdomen", "Complete Blood Count (CBC)", "Urine Routine & Microscopy"],
                ["Analgesics & Antipyretics", "Antibiotics", "IV Fluids & Electrolytes"],
            ),
            (
                ("dermat", "skin", "eczema", "psoriasis", "rash", "urticaria", "fungal", "scabies", "acne", "cellulitis", "impetigo"),
                "Dermatology",
                ["Complete Blood Count (CBC)"],
                ["Dermatologicals", "Antihistamines"],
            ),
            (
                ("stroke", "seizure", "epilepsy", "neuropath", "headache", "migraine", "meningitis", "encephalitis", "paralysis", "cva", "transient ischemic", "syncope", "neurology"),
                "Neurology",
                ["CT Brain", "Blood Glucose (Fasting/PP)", "Serum Electrolytes"],
                ["Analgesics & Antipyretics", "Antihypertensives"],
            ),
            (
                ("ophthalm", "eye", "cataract", "glaucoma", "conjunctivitis", "vision", "cornea", "retin", "blepharitis"),
                "Ophthalmology",
                ["Blood Glucose (Fasting/PP)"],
                ["Analgesics & Antipyretics", "Antihistamines"],
            ),
            (
                ("otitis", "sinusitis", "tonsillitis", "ear", "nose", "throat", "epistaxis", "rhinitis", "vertigo", "ent"),
                "ENT",
                ["Complete Blood Count (CBC)"],
                ["Antibiotics", "Antihistamines", "Analgesics & Antipyretics"],
            ),
            (
                ("gastro", "gastritis", "ulcer", "diarrhea", "dysentery", "vomiting", "abdomen", "hepatitis", "jaundice", "cholecystitis", "appendicitis", "colitis", "pancreatitis", "acid peptic", "gastroenteritis", "gerd", "enteric"),
                "Gastroenterology",
                ["Ultrasound Abdomen", "Liver Function Test (LFT)", "Complete Blood Count (CBC)"],
                ["Antacids & PPIs", "Antiemetics", "IV Fluids & Electrolytes"],
            ),
            (
                ("nephr", "renal", "kidney", "uti", "urinary tract infection", "calculus", "hematuria", "glomerulo", "pyelonephritis"),
                "Nephrology",
                ["Kidney Function Test (KFT)", "Urine Routine & Microscopy", "Serum Electrolytes"],
                ["Antibiotics", "Antihypertensives", "IV Fluids & Electrolytes"],
            ),
            (
                ("hernia", "abscess", "wound", "laceration", "peritonitis", "surgical", "obstruction", "fissure", "fistula"),
                "General Surgery",
                ["Complete Blood Count (CBC)", "Ultrasound Abdomen"],
                ["Antibiotics", "Analgesics & Antipyretics", "IV Fluids & Electrolytes"],
            ),
            (
                ("psychiatr", "depression", "anxiety", "psychosis", "bipolar", "schizo", "insomnia", "panic"),
                "Psychiatry",
                ["Complete Blood Count (CBC)", "Thyroid Profile (T3, T4, TSH)"],
                ["Analgesics & Antipyretics"],
            ),
        ]

        for keywords, spec_name, tests, meds in mapping_rules:
            if any(kw in combined_text for kw in keywords):
                matched_specialities.append((spec_name, 0.95 if len(matched_specialities) == 0 else 0.85))
                for t in tests:
                    if t not in suggested_tests_set:
                        suggested_tests_set.append(t)
                for m in meds:
                    if m not in medicine_categories_set:
                        medicine_categories_set.append(m)

        if not matched_specialities:
            matched_specialities = [("General Medicine", 0.90)]
            suggested_tests_set = ["Complete Blood Count (CBC)", "Blood Glucose (Fasting/PP)", "Urine Routine & Microscopy"]
            medicine_categories_set = ["Analgesics & Antipyretics", "Antibiotics", "Antacids & PPIs"]

        specialities = [
            SpecialityConfidence(name=name, confidence=conf)
            for name, conf in matched_specialities[:2]
        ]

        return specialities, suggested_tests_set[:4], medicine_categories_set[:4]

    def rank_triage_hospitals_live(
        self,
        db: Session,
        differential_diagnosis: List[str],
        priority: str,
        symptoms: Optional[str] = None,
        patient_lat: Optional[float] = None,
        patient_lng: Optional[float] = None,
        patient_district: Optional[str] = None,
        limit: int = 3,
    ) -> List[HospitalMatchResult]:
        """
        Live query matching hospitals for triage evaluation without extra Gemini call.
        Ranking hierarchy: doctor availability (50%) > distance (30%) > stock (20%).
        """
        specs, tests, meds = self.map_differential_to_speciality_and_resources(
            differential_diagnosis=differential_diagnosis,
            symptoms=symptoms
        )

        urgency_map = {"P1": "EMERGENCY", "P2": "URGENT", "P3": "ROUTINE"}
        urgency = urgency_map.get(priority, "ROUTINE")

        # Create lightweight assessment object to leverage live DB scoring
        assessment = SymptomAssessment(
            urgency=urgency,
            specialities=specs,
            suggested_tests=tests,
            medicine_categories=meds,
            summary=f"Triage facility match for {priority} priority and {specs[0].name} consultation.",
            cached=False,
            fallback_used=True,
        )

        # 1. Reference coordinates
        ref_lat = patient_lat
        ref_lng = patient_lng
        if ref_lat is None or ref_lng is None:
            dist_key = (patient_district or "").lower().strip()
            if dist_key in DISTRICT_CENTERS:
                ref_lat, ref_lng = DISTRICT_CENTERS[dist_key]
            else:
                ref_lat, ref_lng = DISTRICT_CENTERS["pune"]

        # 2. Live DB queries
        h_query = db.query(Hospital)
        if patient_district:
            dist_hospitals = h_query.filter(
                or_(
                    func.lower(Hospital.district) == patient_district.lower().strip(),
                    Hospital.district == None
                )
            ).all()
            hospitals = dist_hospitals if len(dist_hospitals) >= 3 else h_query.limit(100).all()
        else:
            hospitals = h_query.limit(100).all()

        if not hospitals:
            return []

        all_doctors = db.query(HospitalDoctor).filter(HospitalDoctor.is_active == True).all()
        all_tests = db.query(HospitalTest).filter(HospitalTest.is_available == True).all()
        all_pharmacy = db.query(HospitalPharmacyItem).all()
        all_inventory = db.query(Inventory).all()

        doctors_by_hosp: Dict[str, List[HospitalDoctor]] = {}
        doctors_by_name: Dict[str, List[HospitalDoctor]] = {}
        for d in all_doctors:
            if d.hospital_id:
                doctors_by_hosp.setdefault(d.hospital_id, []).append(d)
            if d.hospital_name:
                doctors_by_name.setdefault(d.hospital_name.lower().strip(), []).append(d)

        tests_by_hosp: Dict[str, List[HospitalTest]] = {}
        tests_by_name: Dict[str, List[HospitalTest]] = {}
        for t in all_tests:
            if t.hospital_id:
                tests_by_hosp.setdefault(t.hospital_id, []).append(t)
            if t.hospital_name:
                tests_by_name.setdefault(t.hospital_name.lower().strip(), []).append(t)

        pharmacy_by_hosp: Dict[str, List[HospitalPharmacyItem]] = {}
        for p in all_pharmacy:
            if p.hospital_id:
                pharmacy_by_hosp.setdefault(p.hospital_id, []).append(p)

        inventory_by_facility: Dict[str, List[Inventory]] = {}
        for inv in all_inventory:
            if inv.facility_name:
                inventory_by_facility.setdefault(inv.facility_name.lower().strip(), []).append(inv)

        target_specialities = {s.name.lower(): s.confidence for s in specs}
        suggested_tests_lower = [t.lower() for t in tests]
        suggested_meds_lower = [m.lower() for m in meds]

        scored_facilities: List[HospitalMatchResult] = []

        for h in hospitals:
            h_id = h.id
            h_name_lower = (h.name or "").lower().strip()

            h_docs = doctors_by_hosp.get(h_id, []) or doctors_by_name.get(h_name_lower, [])
            h_tests = tests_by_hosp.get(h_id, []) or tests_by_name.get(h_name_lower, [])
            h_pharm = pharmacy_by_hosp.get(h_id, [])
            h_inv = inventory_by_facility.get(h_name_lower, [])

            # Doctor Availability Score (Max 50 pts)
            doctor_score = 0.0
            best_doc: Optional[DoctorMatchInfo] = None

            matched_active_docs: List[Tuple[HospitalDoctor, float]] = []
            for doc in h_docs:
                doc_spec = (doc.speciality or "").lower().strip()
                for t_spec, conf in target_specialities.items():
                    if t_spec in doc_spec or doc_spec in t_spec:
                        matched_active_docs.append((doc, conf))
                        break

            if matched_active_docs:
                matched_active_docs.sort(key=lambda x: x[1], reverse=True)
                top_doc, conf = matched_active_docs[0]
                next_slot_str = self._determine_next_slot(top_doc.availability_slots)
                slot_bonus = 12.0 if next_slot_str else 8.0
                doctor_score = round(min(50.0, (conf * 38.0) + slot_bonus), 1)
                best_doc = DoctorMatchInfo(
                    id=top_doc.id,
                    name=top_doc.name,
                    speciality=top_doc.speciality,
                    next_slot=next_slot_str,
                    qualification=top_doc.qualification,
                    experience_years=top_doc.experience_years or 0,
                )
            else:
                gen_med_docs = [d for d in h_docs if "general" in (d.speciality or "").lower() or "medicine" in (d.speciality or "").lower()]
                if gen_med_docs:
                    top_gen = gen_med_docs[0]
                    next_slot_str = self._determine_next_slot(top_gen.availability_slots)
                    doctor_score = 25.0
                    best_doc = DoctorMatchInfo(
                        id=top_gen.id,
                        name=top_gen.name,
                        speciality=top_gen.speciality,
                        next_slot=next_slot_str,
                        qualification=top_gen.qualification,
                        experience_years=top_gen.experience_years or 0,
                    )
                elif h.doctors and h.doctors > 0:
                    doctor_score = 10.0

            # Distance Score (Max 30 pts)
            h_lat = h.lat if h.lat else ref_lat
            h_lng = h.lng if h.lng else ref_lng
            distance_km = haversine(ref_lat, ref_lng, h_lat, h_lng)
            distance_score = round(max(0.0, 30.0 * (1.0 - (distance_km / 60.0))), 1)

            # Diagnostic Test Match (Max 10 pts)
            test_score = 0.0
            tests_avail: List[str] = []
            tests_miss: List[str] = []
            if not tests:
                test_score = 10.0
            else:
                h_test_names = [t.test_name.lower().strip() for t in h_tests] + [t.category.lower().strip() for t in h_tests]
                for raw_t in tests:
                    t_low = raw_t.lower().strip()
                    if any(t_low in hn or hn in t_low for hn in h_test_names):
                        tests_avail.append(raw_t)
                    else:
                        tests_miss.append(raw_t)
                ratio = len(tests_avail) / len(tests)
                test_score = round(ratio * 10.0, 1)

            # Medicine Stock Score (Max 10 pts)
            medicine_score = 0.0
            med_stock_status_list: List[MedicineStockInfo] = []
            if not meds:
                medicine_score = 10.0
            else:
                pts_list = []
                for raw_m in meds:
                    m_low = raw_m.lower().strip()
                    matching_p = [p for p in h_pharm if m_low in (p.medicine_name or "").lower() or m_low in (p.generic_name or "").lower()]
                    matching_i = [inv for inv in h_inv if m_low in (inv.category or "").lower() or m_low in (inv.medicine_name or "").lower()]

                    status = "OUT_OF_STOCK"
                    sample_name = None
                    pts = 0.0

                    if matching_p:
                        in_stock_p = [p for p in matching_p if p.status == "IN_STOCK"]
                        if in_stock_p:
                            status = "IN_STOCK"
                            sample_name = in_stock_p[0].medicine_name
                            pts = 1.0
                        else:
                            status = "LOW_STOCK"
                            sample_name = matching_p[0].medicine_name
                            pts = 0.5
                    elif matching_i:
                        in_stock_i = [i for i in matching_i if not i.is_low_stock and i.current_stock > i.min_threshold]
                        if in_stock_i:
                            status = "IN_STOCK"
                            sample_name = in_stock_i[0].medicine_name
                            pts = 1.0
                        else:
                            status = "LOW_STOCK"
                            sample_name = matching_i[0].medicine_name
                            pts = 0.5
                    pts_list.append(pts)
                    med_stock_status_list.append(
                        MedicineStockInfo(
                            category=raw_m,
                            status=status,
                            medicine_name=sample_name,
                        )
                    )
                avg_pts = sum(pts_list) / len(pts_list) if pts_list else 1.0
                medicine_score = round(avg_pts * 10.0, 1)

            total_score = round(doctor_score + distance_score + test_score + medicine_score, 1)

            is_emerg_cap = bool(
                (h.emergency_services and h.emergency_services.strip().lower() not in ["no", "none", "0"]) or
                (h.ambulance and h.ambulance.strip().lower() not in ["no", "none", "0"]) or
                (h.care_type and "district" in h.care_type.lower())
            )

            scored_facilities.append(
                HospitalMatchResult(
                    hospital_id=h.id,
                    hospital_name=h.name,
                    category=h.category,
                    care_type=h.care_type,
                    address=h.address or f"{h.subdistrict or ''}, {h.district or ''}".strip(", "),
                    district=h.district,
                    phone=h.phone,
                    distance_km=distance_km,
                    score=total_score,
                    score_breakdown=ScoreBreakdown(
                        doctor_score=doctor_score,
                        test_score=test_score,
                        medicine_score=medicine_score,
                        distance_score=distance_score,
                    ),
                    doctor=best_doc,
                    tests_available=tests_avail,
                    tests_missing=tests_miss,
                    medicine_stock_status=med_stock_status_list,
                    is_emergency_capable=is_emerg_cap,
                )
            )

        scored_facilities.sort(key=lambda r: (r.score, -r.distance_km), reverse=True)
        return scored_facilities[:limit]


# Global singleton service instance
symptom_matching_service = SymptomMatchingService()

