"""
Database initialization and clean seed data module for SevaSetu.
Maintains ONE authentic reference patient (Kharpudi PHC test profile)
for instant reviewer verification, while enabling full dynamic registration
for any user/phone entered.
"""

import json
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from .models import (
    Patient, TriageRecord, Inventory, Referral, Appointment,
    OutbreakCluster, AshaIncentive, OtpSession,
    Hospital, HospitalDoctor, HospitalTest, HospitalPharmacyItem
)

FACILITIES = []

def seed_database(db: Session):
    """
    Seeds baseline essential PHC inventory if tables are newly initialized.
    Does NOT seed localhost patients or triage records to maintain a clean production state.
    """
    try:
        # Seed essential PHC emergency medicine stock if inventory empty
        if db.query(Inventory).count() == 0:
            medicines = [
                ("Tab Paracetamol 500mg", "Analgesic / Antipyretic", 850, 200, "strips"),
                ("Tab Amlodipine 5mg", "Antihypertensive", 320, 100, "strips"),
                ("ORS Packets 20.5g", "Electrolytes", 450, 150, "packets"),
                ("Inj Oxytocin 10 IU", "Maternal Emergency", 80, 50, "ampoules"),
                ("Tab Metformin 500mg", "Antidiabetic", 290, 100, "strips"),
                ("Amoxicillin 500mg", "Antibiotic", 180, 100, "strips")
            ]
            for name, cat, stock, thresh, unit in medicines:
                inv = Inventory(
                    facility_name="Kharpudi Primary Health Centre",
                    medicine_name=name,
                    category=cat,
                    current_stock=stock,
                    min_threshold=thresh,
                    unit=unit,
                    is_low_stock=stock < thresh
                )
                db.add(inv)
            db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")


def reset_dynamic_data(db: Session):
    """Clear user-generated records while retaining reference datasets."""
    for model in (
        OtpSession, AshaIncentive, OutbreakCluster, Appointment,
        Referral, TriageRecord, Patient, Inventory,
        HospitalDoctor, HospitalTest, HospitalPharmacyItem
    ):
        db.query(model).delete()
    db.commit()
    seed_database(db)


def seed_demo_data(db: Session):
    """Create a coherent reviewer dataset shared by every portal."""
    reset_dynamic_data(db)
    now = datetime.utcnow()

    # Seed demo hospitals if hospitals table is empty (e.g. test SQLite in-memory)
    if db.query(Hospital).count() == 0:
        db.add_all([
            Hospital(
                id="hospital_aundh",
                name="Aundh District Hospital",
                category="District Hospital",
                care_type="Tertiary Care",
                district="Pune",
                subdistrict="Haveli",
                village="Aundh",
                lat=18.5601,
                lng=73.8031,
                emergency_services="24x7 Emergency & Trauma Unit",
                ambulance="108 Service Available",
                doctors=45,
                beds=300,
                status="Open",
                phone="020-25881234",
                address="Aundh Camp, Pune, Maharashtra 411027"
            ),
            Hospital(
                id="hosp-1",
                name="Pune Civil & District Hospital",
                category="Civil Hospital",
                care_type="Secondary Care",
                district="Pune",
                subdistrict="Pune City",
                lat=18.5204,
                lng=73.8567,
                emergency_services="24x7 Casualty & Emergency",
                ambulance="108 Available",
                doctors=60,
                beds=500,
                status="Open",
                phone="020-26123456",
                address="Station Road, Pune, Maharashtra 411001"
            ),
            Hospital(
                id="hosp-khed",
                name="Khed Sub-District Hospital",
                category="Sub-District Hospital",
                care_type="Secondary Care",
                district="Pune",
                subdistrict="Khed",
                lat=18.8465,
                lng=73.9056,
                emergency_services="Emergency OPD",
                ambulance="108 Available",
                doctors=15,
                beds=100,
                status="Open",
                phone="02135-222333",
                address="Rajgurunagar, Khed, Pune 410505"
            )
        ])
        db.flush()

    patients = [
        Patient(name="Sunita Patil", age=28, gender="Female", phone="9822104512", abha_id="14-8832-9012-4412", village="Kharpudi", taluka="Khed", district="Pune"),
        Patient(name="Ananda Shinde", age=54, gender="Male", phone="9822334455", abha_id="14-2391-8842-1055", village="Shirasgaon", taluka="Khed", district="Pune"),
        Patient(name="Meena Jadhav", age=42, gender="Female", phone="9822445566", village="Ambegaon", taluka="Ambegaon", district="Pune"),
    ]
    db.add_all(patients)
    db.flush()
    triage = [
        TriageRecord(
            patient_id=patients[0].id,
            patient_name="Sunita Patil",
            age=28,
            gender="Female",
            phone=patients[0].phone,
            village="Kharpudi",
            taluka="Khed",
            district="Pune",
            systolic_bp=165,
            diastolic_bp=105,
            spo2=88,
            pulse_rate=112,
            temperature=101.4,
            symptom_duration_days=2,
            symptoms="Breathlessness and severe chest heaviness",
            high_risk_maternal=True,
            priority="P1",
            triage_reason="Critical hypoxemia and severe hypertension",
            confidence_score=.98,
            differential_diagnosis=json.dumps(["Severe Preeclampsia / Impending Eclampsia", "Acute Pulmonary Edema", "Severe Acute Lower Respiratory Infection"]),
            clinical_reasoning="Third-trimester pregnancy with acute severe hypertension (165/105 mmHg) coupled with critical hypoxemia (SpO2 88%) and tachypnea. Demands immediate tertiary obstetric and critical care escalation.",
            ai_model="Gemini 3.6 Flash + Clinical Rule Guardrail v2.0",
            status="Pending",
            source="Patient"
        ),
        TriageRecord(
            patient_id=patients[1].id,
            patient_name="Ananda Shinde",
            age=54,
            gender="Male",
            phone=patients[1].phone,
            village="Shirasgaon",
            taluka="Khed",
            district="Pune",
            systolic_bp=148,
            diastolic_bp=92,
            spo2=95,
            pulse_rate=88,
            temperature=102.2,
            symptom_duration_days=4,
            symptoms="Fever and body ache",
            priority="P2",
            triage_reason="High fever with prolonged symptoms",
            confidence_score=.93,
            differential_diagnosis=json.dumps(["Dengue Fever / Vector-Borne Viral Illness", "Acute Malaria Protocol", "Bacterial Respiratory Infection"]),
            clinical_reasoning="Prolonged pyrexia (>3 days) reaching 102.2°F with stage 1 hypertension and systemic myalgia. Warrant urgent diagnostic serology and platelet monitoring.",
            ai_model="Gemini 3.6 Flash + Clinical Rule Guardrail v2.0",
            status="Verified",
            doctor_verified=True,
            doctor_name="Dr. Deshmukh",
            doctor_notes="Hydration and review",
            source="ASHA_Online"
        ),
        TriageRecord(
            patient_id=patients[2].id,
            patient_name="Meena Jadhav",
            age=42,
            gender="Female",
            phone=patients[2].phone,
            village="Ambegaon",
            taluka="Ambegaon",
            district="Pune",
            systolic_bp=126,
            diastolic_bp=80,
            spo2=98,
            pulse_rate=76,
            temperature=98.6,
            symptom_duration_days=1,
            symptoms="Routine blood pressure check",
            priority="P3",
            triage_reason="Vitals within stable baseline limits",
            confidence_score=.91,
            differential_diagnosis=json.dumps(["Normotensive Baseline / Essential Screening", "Routine Preventive Health Check"]),
            clinical_reasoning="All physiological parameters including oxygen saturation, pulse, and arterial tension are well within safe ambulatory thresholds.",
            ai_model="Gemini 3.6 Flash + Clinical Rule Guardrail v2.0",
            status="Completed",
            doctor_verified=True,
            source="Clinic"
        ),
    ]
    db.add_all(triage)
    db.flush()
    db.add_all([
        Referral(triage_id=triage[0].id, patient_name="Sunita Patil", age=28, priority="P1", source_facility="Kharpudi PHC", target_facility="Aundh District Hospital", urgency="Immediate", reason="Critical vitals requiring specialist care", status="Pending"),
        Referral(triage_id=triage[1].id, patient_name="Ananda Shinde", age=54, priority="P2", source_facility="Khed PHC", target_facility="Pune District Hospital", urgency="Within 24 Hours", reason="Persistent fever", status="Accepted"),
    ])
    db.add_all([
        Appointment(patient_name="Meena Jadhav", phone=patients[2].phone, age=42, gender="Female", facility_name="Ambegaon Rural Hospital", doctor_name="Dr. Deshmukh", appointment_date=(now + timedelta(days=1)).strftime("%Y-%m-%d"), time_slot="10:00 AM - 10:30 AM", reason="Routine OPD Checkup", priority="P3", status="Scheduled"),
        Appointment(patient_name="Ananda Shinde", phone=patients[1].phone, age=54, gender="Male", facility_name="Khed PHC", doctor_name="Medical Officer", appointment_date=now.strftime("%Y-%m-%d"), time_slot="11:00 AM - 11:30 AM", reason="Fever review", priority="P2", status="Waiting"),
    ])
    db.add_all([
        OutbreakCluster(village_name="Kharpudi", wadi_location="Main Wadi", disease_type="Seasonal Fever", active_cases=7, risk_level="Medium"),
        OutbreakCluster(village_name="Shirasgaon", wadi_location="East Wadi", disease_type="Respiratory Infection", active_cases=3, risk_level="Low"),
    ])
    db.add_all([
        AshaIncentive(asha_id="ASHA_01", asha_name="Surekha Tai", activity_type="Monthly Screening", patient_name="Sunita Patil", amount=250, status="Approved"),
        AshaIncentive(asha_id="ASHA_01", asha_name="Surekha Tai", activity_type="Referral Escort", patient_name="Ananda Shinde", amount=350, status="Pending"),
    ])

    # Phase 1: Hospital Doctors (multi-slot availability)
    hospital_ids = ["hospital_aundh", "hosp-1"]
    for hid in hospital_ids:
        hname = "Aundh District Hospital" if hid == "hospital_aundh" else "District Hospital"
        db.add_all([
            HospitalDoctor(
                hospital_id=hid,
                hospital_name=hname,
                name="Dr. Arvind Kulkarni",
                speciality="Cardiology",
                qualification="MBBS, MD, DM (Cardiology)",
                experience_years=14,
                phone="9822101001",
                availability_slots=json.dumps([
                    {"day": "Monday", "start_time": "09:00", "end_time": "13:00", "label": "Morning OPD"},
                    {"day": "Wednesday", "start_time": "09:00", "end_time": "13:00", "label": "Morning OPD"},
                    {"day": "Friday", "start_time": "14:00", "end_time": "18:00", "label": "Evening Clinic"}
                ]),
                is_active=True
            ),
            HospitalDoctor(
                hospital_id=hid,
                hospital_name=hname,
                name="Dr. Shalini Deshmukh",
                speciality="Obstetrics & Gynecology",
                qualification="MBBS, MS (OBGY), DGO",
                experience_years=11,
                phone="9822101002",
                availability_slots=json.dumps([
                    {"day": "Tuesday", "start_time": "10:00", "end_time": "14:00", "label": "High-Risk Maternal OPD"},
                    {"day": "Thursday", "start_time": "10:00", "end_time": "14:00", "label": "Antenatal Clinic"},
                    {"day": "Saturday", "start_time": "09:00", "end_time": "12:00", "label": "General Consultation"}
                ]),
                is_active=True
            ),
            HospitalDoctor(
                hospital_id=hid,
                hospital_name=hname,
                name="Dr. Rajesh Shinde",
                speciality="General Medicine",
                qualification="MBBS, MD (Internal Medicine)",
                experience_years=16,
                phone="9822101003",
                availability_slots=json.dumps([
                    {"day": "Monday", "start_time": "08:30", "end_time": "13:30", "label": "Morning OPD"},
                    {"day": "Tuesday", "start_time": "08:30", "end_time": "13:30", "label": "Morning OPD"},
                    {"day": "Wednesday", "start_time": "08:30", "end_time": "13:30", "label": "Morning OPD"},
                    {"day": "Thursday", "start_time": "08:30", "end_time": "13:30", "label": "Morning OPD"},
                    {"day": "Friday", "start_time": "08:30", "end_time": "13:30", "label": "Morning OPD"}
                ]),
                is_active=True
            ),
            HospitalDoctor(
                hospital_id=hid,
                hospital_name=hname,
                name="Dr. Priya Nair",
                speciality="Pediatrics",
                qualification="MBBS, DCH, MD (Pediatrics)",
                experience_years=9,
                phone="9822101004",
                availability_slots=json.dumps([
                    {"day": "Monday", "start_time": "10:00", "end_time": "14:00", "label": "Child Wellness Clinic"},
                    {"day": "Wednesday", "start_time": "10:00", "end_time": "14:00", "label": "Immunization & Pediatric OPD"},
                    {"day": "Friday", "start_time": "10:00", "end_time": "14:00", "label": "Pediatric OPD"}
                ]),
                is_active=True
            ),
            HospitalDoctor(
                hospital_id=hid,
                hospital_name=hname,
                name="Dr. Vikrant Patil",
                speciality="Orthopedics",
                qualification="MBBS, MS (Orthopedics)",
                experience_years=12,
                phone="9822101005",
                availability_slots=json.dumps([
                    {"day": "Tuesday", "start_time": "14:00", "end_time": "17:00", "label": "Fracture & Joint Clinic"},
                    {"day": "Friday", "start_time": "14:00", "end_time": "17:00", "label": "Ortho OPD"}
                ]),
                is_active=False  # On administrative leave / inactive
            )
        ])

        # Phase 1: Hospital Diagnostic Tests
        db.add_all([
            HospitalTest(
                hospital_id=hid,
                hospital_name=hname,
                test_name="Complete Blood Count (CBC) with Platelets",
                category="Pathology",
                price=250.0,
                prep_notes="No fasting required. Venous blood sample drawn.",
                turnaround_time="2 hours",
                is_available=True
            ),
            HospitalTest(
                hospital_id=hid,
                hospital_name=hname,
                test_name="Fasting Blood Sugar (FBS)",
                category="Pathology",
                price=120.0,
                prep_notes="Requires 10-12 hours strict overnight fasting. Water permitted.",
                turnaround_time="3 hours",
                is_available=True
            ),
            HospitalTest(
                hospital_id=hid,
                hospital_name=hname,
                test_name="Digital Chest X-Ray (PA View)",
                category="Radiology",
                price=400.0,
                prep_notes="Remove metallic ornaments, necklaces, and metal-buttoned garments before scan.",
                turnaround_time="1 hour",
                is_available=True
            ),
            HospitalTest(
                hospital_id=hid,
                hospital_name=hname,
                test_name="12-Lead Standard Electrocardiogram (ECG)",
                category="Cardiology",
                price=350.0,
                prep_notes="Rest in supine position for 10 minutes prior to electrode placement.",
                turnaround_time="30 mins",
                is_available=True
            ),
            HospitalTest(
                hospital_id=hid,
                hospital_name=hname,
                test_name="Ultrasound Abdomen & Pelvis (USG)",
                category="Radiology",
                price=1200.0,
                prep_notes="Drink 1 litre of water 1 hour before test. Do not void urine — full bladder required.",
                turnaround_time="4 hours",
                is_available=True
            ),
            HospitalTest(
                hospital_id=hid,
                hospital_name=hname,
                test_name="Lipid Profile (Cholesterol, HDL, LDL, Triglycerides)",
                category="Biochemistry",
                price=650.0,
                prep_notes="12-14 hours strict overnight fasting required. Avoid fatty meal on previous evening.",
                turnaround_time="4 hours",
                is_available=True
            ),
            HospitalTest(
                hospital_id=hid,
                hospital_name=hname,
                test_name="Serum Creatinine & Blood Urea Nitrogen",
                category="Biochemistry",
                price=300.0,
                prep_notes="Routine blood sample. Stay adequately hydrated.",
                turnaround_time="2 hours",
                is_available=False  # Machine undergoing calibration
            )
        ])

        # Phase 1: Hospital Pharmacy Inventory (Auto-derived LOW_STOCK when quantity <= reorder_threshold)
        db.add_all([
            HospitalPharmacyItem(
                hospital_id=hid,
                hospital_name=hname,
                medicine_name="Tab Paracetamol 650mg",
                generic_name="Acetaminophen 650mg",
                quantity=1500,
                unit="strips",
                reorder_threshold=300,
                status="IN_STOCK",
                batch_number="PCM-2026-A1",
                expiry_date="2027-12"
            ),
            HospitalPharmacyItem(
                hospital_id=hid,
                hospital_name=hname,
                medicine_name="Tab Amlodipine 5mg",
                generic_name="Amlodipine Besylate",
                quantity=45,
                unit="strips",
                reorder_threshold=100,
                status="LOW_STOCK",  # 45 <= 100
                batch_number="AML-2025-C3",
                expiry_date="2027-06"
            ),
            HospitalPharmacyItem(
                hospital_id=hid,
                hospital_name=hname,
                medicine_name="Cap Amoxicillin 500mg",
                generic_name="Amoxicillin Trihydrate",
                quantity=600,
                unit="strips",
                reorder_threshold=150,
                status="IN_STOCK",
                batch_number="AMX-2026-F9",
                expiry_date="2028-01"
            ),
            HospitalPharmacyItem(
                hospital_id=hid,
                hospital_name=hname,
                medicine_name="Inj Ceftriaxone 1g",
                generic_name="Ceftriaxone Sodium Sterile Powder",
                quantity=20,
                unit="vials",
                reorder_threshold=20,
                status="LOW_STOCK",  # 20 <= 20 (exact edge case)
                batch_number="CFT-2025-E2",
                expiry_date="2026-11"
            ),
            HospitalPharmacyItem(
                hospital_id=hid,
                hospital_name=hname,
                medicine_name="Tab Metformin 500mg",
                generic_name="Metformin Hydrochloride IP",
                quantity=850,
                unit="strips",
                reorder_threshold=200,
                status="IN_STOCK",
                batch_number="MET-2026-K4",
                expiry_date="2027-09"
            ),
            HospitalPharmacyItem(
                hospital_id=hid,
                hospital_name=hname,
                medicine_name="Tab Azithromycin 500mg",
                generic_name="Azithromycin Dihydrate",
                quantity=12,
                unit="strips",
                reorder_threshold=50,
                status="LOW_STOCK",  # 12 <= 50
                batch_number="AZM-2025-M7",
                expiry_date="2027-03"
            ),
            HospitalPharmacyItem(
                hospital_id=hid,
                hospital_name=hname,
                medicine_name="ORS Electrolyte Sachet 21.8g",
                generic_name="WHO Formula Oral Rehydration Salts",
                quantity=1200,
                unit="packets",
                reorder_threshold=250,
                status="IN_STOCK",
                batch_number="ORS-2026-R1",
                expiry_date="2028-06"
            ),
            HospitalPharmacyItem(
                hospital_id=hid,
                hospital_name=hname,
                medicine_name="Tab Salbutamol 4mg",
                generic_name="Salbutamol Sulfate",
                quantity=8,
                unit="strips",
                reorder_threshold=40,
                status="LOW_STOCK",  # 8 <= 40
                batch_number="SLB-2025-B4",
                expiry_date="2027-04"
            )
        ])

    db.commit()
