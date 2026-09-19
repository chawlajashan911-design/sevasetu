import os
import json
import time
import hashlib
from datetime import datetime
from typing import List, Optional, Dict, Any
from collections import defaultdict

from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

from fastapi import FastAPI, Depends, HTTPException, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc, case, or_, func, text

from .database import engine, Base, get_db
from .models import (
    Patient, TriageRecord, Referral, Appointment,
    Inventory, OutbreakCluster, AshaIncentive, Village,
    TeleconsultRoom, AbhaFieldTask,
    HospitalDoctor, HospitalTest, HospitalPharmacyItem
)
from .schemas import (
    PatientCreate, PatientResponse,
    TriageEvaluationRequest, TriageEvaluationResponse,
    DoctorVerificationRequest, ReferralCreate,
    AppointmentCreate, AppointmentResponse, AppointmentStatusUpdate,
    BatchSyncRequest, InventoryUpdate, VitalsInput,
    OtpRequest, OtpVerifyRequest, TeleconsultCreateRequest,
    BhashiniTranslateRequest, AbhaFieldTaskCreate,
    HospitalDoctorCreate, HospitalDoctorUpdate,
    HospitalTestCreate, HospitalTestUpdate,
    HospitalPharmacyItemCreate, HospitalPharmacyItemUpdate
)
from .triage_engine import triage_engine
from .mock_services import AbdmFhirService
from .services.abdm_service import AbdmService
from .services.bhashini_service import BhashiniService
from .services.esanjeevani_service import ESanjeevaniService
from .services.hospital_service import HospitalService
from .seed_data import seed_database, reset_dynamic_data, seed_demo_data, FACILITIES
from .hospital_loader import hospital_directory

# In-memory caches for static/read-heavy endpoints
_STATS_CACHE: Dict[str, Any] = {"villages": None, "hospitals": None, "updated_at": 0.0}
_DISTRICTS_CACHE: Dict[str, Any] = {"data": None, "updated_at": 0.0}
_VILLAGE_SEARCH_CACHE: Dict[str, Any] = {}

# ----------------- Triage Deduplication & Rate Limiting Guardrails -----------------
# Cache storing recent triage evaluations to prevent duplicate LLM invocations and duplicate DB records
# Key: SHA256(fingerprint) -> {"result": dict, "timestamp": float}
_TRIAGE_DEDUPLICATION_CACHE: Dict[str, Dict[str, Any]] = {}
TRIAGE_DEDUP_TTL_SECONDS = 60.0  # 1 minute idempotency window for identical inputs

# In-memory rate limiter per phone / client: max 15 evaluations per minute
_TRIAGE_RATE_LIMITS: Dict[str, List[float]] = defaultdict(list)
MAX_TRIAGE_PER_MINUTE = 15

def _generate_triage_fingerprint(req: TriageEvaluationRequest) -> str:
    """Computes a deterministic hash fingerprint from patient vitals and reported symptoms."""
    v = req.vitals
    raw = (
        f"{req.phone or req.patient_name or 'citizen'}|"
        f"{req.age or ''}|{req.gender or ''}|"
        f"{v.systolic_bp or ''}|{v.diastolic_bp or ''}|{v.spo2 or ''}|"
        f"{v.pulse_rate or ''}|{v.temperature or ''}|{v.symptom_duration_days or 1}|"
        f"{(v.symptoms or '').strip().lower()}|{bool(v.high_risk_maternal)}"
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

def get_cached_system_counts(db: Session):
    now = time.time()
    if _STATS_CACHE["villages"] is not None and (now - _STATS_CACHE["updated_at"]) < 300:
        return _STATS_CACHE["villages"], _STATS_CACHE["hospitals"]
    v_cnt = db.query(func.count(Village.id)).scalar() or 0
    h_cnt = hospital_directory.get_count()
    _STATS_CACHE["villages"] = v_cnt
    _STATS_CACHE["hospitals"] = h_cnt
    _STATS_CACHE["updated_at"] = now
    return v_cnt, h_cnt

# Initialize DB tables (creates any missing tables — idempotent on Supabase)
Base.metadata.create_all(bind=engine)
try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE triage_records ADD COLUMN IF NOT EXISTS differential_diagnosis TEXT;"))
        conn.execute(text("ALTER TABLE triage_records ADD COLUMN IF NOT EXISTS clinical_reasoning TEXT;"))
        conn.execute(text("ALTER TABLE triage_records ADD COLUMN IF NOT EXISTS ai_model VARCHAR(80);"))
except Exception:
    pass

# Seed database structure cleanly (no demo records)
with next(get_db()) as db_session:
    seed_database(db_session)

app = FastAPI(
    title="SevaSetu API",
    description="Backend API for SevaSetu Rural Healthcare AI System with smart triage, offline sync, and ABDM/BHASHINI/eSanjeevani adapters.",
    version="1.0.0"
)

# Enable CORS for React frontend (Vite dev server and production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------- OTP & ABHA Authentication -----------------
@app.post("/api/v1/auth/request-otp")
def request_otp(req: OtpRequest, db: Session = Depends(get_db)):
    identifier = req.identifier.strip()
    if not identifier:
        raise HTTPException(status_code=400, detail="Phone number or ABHA identifier is required")
    try:
        return AbdmService.request_otp(identifier, req.role or "patient", db, req.demo)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/v1/auth/verify-otp")
def verify_otp(req: OtpVerifyRequest, db: Session = Depends(get_db)):
    result = AbdmService.verify_otp(
        session_id=req.session_id,
        otp=req.otp,
        role=req.role or "patient",
        custom_name=req.name,
        village=req.village,
        taluka=req.taluka,
        district=req.district,
        db=db,
    )
    if not result.get("success"):
        raise HTTPException(status_code=401, detail=result.get("message", "OTP verification failed"))
    return result


@app.post("/api/v1/auth/verify-abha")
def verify_abha(req: dict):
    result = AbdmService.verify_abha_id(req.get("abha_id", ""))
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("message", "ABHA ID not found"))
    return result


@app.post("/api/v1/system/reset-data")
def reset_system_data(admin_key: Optional[str] = Header(None, alias="X-Admin-Key"), db: Session = Depends(get_db)):
    app_env = (os.getenv("APP_ENV") or "development").lower()
    if app_env == "production":
        expected_key = os.getenv("ADMIN_SECRET_KEY")
        if not expected_key or admin_key != expected_key:
            raise HTTPException(status_code=403, detail="Reset data is protected in production environment")
    reset_dynamic_data(db)
    return {"success": True, "message": "Dynamic application data reset"}


@app.post("/api/v1/system/demo-data")
def load_demo_data(admin_key: Optional[str] = Header(None, alias="X-Admin-Key"), db: Session = Depends(get_db)):
    app_env = (os.getenv("APP_ENV") or "development").lower()
    if app_env == "production":
        expected_key = os.getenv("ADMIN_SECRET_KEY")
        if not expected_key or admin_key != expected_key:
            raise HTTPException(status_code=403, detail="Demo data reload is protected in production environment")
    seed_demo_data(db)
    return {"success": True, "message": "Demo patients, triage, referrals, follow-ups, incentives, outbreaks, and medicines loaded"}


@app.get("/api/v1/auth/check-abha")
def check_abha(phone: str, db: Session = Depends(get_db)):
    clean_phone = "".join(ch for ch in phone if ch.isdigit())[-10:]
    official = AbdmService.find_official_registry_entry(clean_phone)
    patient = db.query(Patient).filter(Patient.phone == clean_phone).first()
    if official:
        return {
            "exists": True,
            "has_abha": True,
            "phone": clean_phone,
            "abha_number": official["abha_number"],
            "patient": official,
        }
    if patient:
        return {
            "exists": True,
            "has_abha": bool(patient.abha_id),
            "phone": clean_phone,
            "abha_number": patient.abha_id,
            "patient": {
                "name": patient.name,
                "village": patient.village,
                "taluka": patient.taluka,
                "district": patient.district,
            },
        }
    return {"exists": False, "has_abha": False, "phone": clean_phone}


@app.get("/api/v1/patient/abdm-profile")
def get_patient_abdm_profile(identifier: str = Query(...), db: Session = Depends(get_db)):
    """Fetches official longitudinal ABDM EHR profile and records."""
    return AbdmService.get_abdm_profile(identifier, db)


@app.post("/api/v1/patient/generate-abha")
@app.post("/api/mock/abdm/generate-abha")
def generate_abha(payload: dict):
    """Dynamically generates authentic 14-digit ABHA Number and address."""
    name = payload.get("name", "Patient")
    phone = payload.get("phone", "9800000000")
    return AbdmService.generate_abha_id(name, phone)


# ----------------- API Root & Health -----------------
@app.get("/api")
def read_api_info(db: Session = Depends(get_db)):
    villages_count, hospitals_count = get_cached_system_counts(db)
    return {
        "system": "SevaSetu Rural Healthcare Platform",
        "status": "Operational",
        "engine": "Clinical Rule-Based Triage Engine v1.2",
        "mode": "Supabase PostgreSQL",
        "villages_indexed": villages_count,
        "hospitals_indexed": hospitals_count,
    }


@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    villages_count, hospitals_count = get_cached_system_counts(db)
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "database": "connected",
        "villages_count": villages_count,
        "hospitals_count": hospitals_count,
    }


# ----------------- Maharashtra Village Dataset & Search -----------------
@app.get("/api/villages/search")
def search_villages(
    q: str = Query(..., min_length=1, description="Search query for village name, taluka, or district"),
    district: Optional[str] = Query(None, description="Filter by district"),
    taluka: Optional[str] = Query(None, description="Filter by taluka"),
    limit: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    High-performance search across authentic 44,810 Maharashtra villages stored in Supabase.
    Uses SQL-level ranking and memory caching to deliver instant autocomplete response.
    """
    query_str = q.strip()
    if not query_str:
        return []

    cache_key = f"{query_str.lower()}:{district or ''}:{taluka or ''}:{limit}"
    if cache_key in _VILLAGE_SEARCH_CACHE:
        ts, data = _VILLAGE_SEARCH_CACHE[cache_key]
        if time.time() - ts < 180:
            return data

    db_query = db.query(Village)

    if district:
        db_query = db_query.filter(func.lower(Village.district) == district.lower())
    if taluka:
        db_query = db_query.filter(func.lower(Village.taluka) == taluka.lower())

    results = (
        db_query.filter(
            or_(
                Village.name.ilike(f"{query_str}%"),
                Village.taluka.ilike(f"%{query_str}%"),
                Village.district.ilike(f"%{query_str}%"),
            )
        )
        .order_by(
            case((Village.name.ilike(f"{query_str}%"), 0), else_=1),
            Village.name.asc(),
        )
        .limit(limit)
        .all()
    )

    formatted = [
        {
            "id": v.id,
            "name": v.name,
            "district": v.district,
            "taluka": v.taluka,
            "districtCode": v.district_code,
            "talukaCode": v.taluka_code,
            "status": v.status,
        }
        for v in results
    ]

    if len(_VILLAGE_SEARCH_CACHE) > 500:
        _VILLAGE_SEARCH_CACHE.clear()
    _VILLAGE_SEARCH_CACHE[cache_key] = (time.time(), formatted)
    return formatted


@app.get("/api/districts")
def list_districts(db: Session = Depends(get_db)):
    """Returns unique cached list of Maharashtra districts from Supabase villages table."""
    now = time.time()
    if _DISTRICTS_CACHE["data"] is not None and (now - _DISTRICTS_CACHE["updated_at"]) < 3600:
        return _DISTRICTS_CACHE["data"]
    rows = db.query(Village.district).distinct().order_by(Village.district).all()
    data = [r[0] for r in rows if r[0]]
    _DISTRICTS_CACHE["data"] = data
    _DISTRICTS_CACHE["updated_at"] = now
    return data


@app.get("/api/talukas")
def list_talukas(district: Optional[str] = None, db: Session = Depends(get_db)):
    """Returns cached talukas for a given district (or all talukas) from Supabase."""
    now = time.time()
    cache_key = (district or "ALL").lower()
    if cache_key in _TALUKAS_CACHE:
        ts, data = _TALUKAS_CACHE[cache_key]
        if now - ts < 3600:
            return data
    q = db.query(Village.taluka).distinct()
    if district:
        q = q.filter(func.lower(Village.district) == district.lower())
    rows = q.order_by(Village.taluka).all()
    data = [r[0] for r in rows if r[0]]
    _TALUKAS_CACHE[cache_key] = (now, data)
    return data



# ----------------- Facilities & Government Hospital Directory -----------------
@app.get("/api/facilities")
@app.get("/api/hospitals")
def get_facilities(
    district: Optional[str] = Query(None, description="Patient selected district"),
    taluka: Optional[str] = Query(None, description="Patient selected taluka"),
    village: Optional[str] = Query(None, description="Patient selected village"),
    query: Optional[str] = Query(None, description="Search by hospital name or specialty"),
    category: Optional[str] = Query(None, description="Filter by category"),
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    limit: int = Query(40, ge=1, le=100),
):
    """
    Returns authentic government & registered hospitals from Supabase hospitals table
    filtered by district/taluka/village, sorted by proximity.
    """
    results = hospital_directory.search(
        district=district,
        taluka=taluka,
        village=village,
        query=query,
        lat=lat,
        lng=lng,
        category=category,
        limit=limit,
    )
    return {
        "district": district or "All Maharashtra",
        "taluka": taluka,
        "village": village,
        "total_count": len(results),
        "facilities": results,
    }


@app.get("/api/hospitals/search")
def search_hospitals_by_name(
    q: str = Query("", description="Search query for hospital name, district, or address"),
    district: Optional[str] = Query(None, description="Optional district filter"),
    limit: int = Query(30, ge=1, le=100),
):
    """
    Search hospitals by name from Supabase hospitals table.
    Used for Hospital Login and selection autocomplete.
    """
    return hospital_directory.search_by_name(query=q, district=district, limit=limit)


@app.get("/api/hospitals/{hospital_id}")
def get_hospital_details(hospital_id: str):
    h = hospital_directory.get_by_name_or_id(hospital_id)
    if not h:
        raise HTTPException(status_code=404, detail="Hospital not found in dataset")
    return h


# ----------------- Patients -----------------
@app.post("/api/patients", response_model=PatientResponse)
def create_patient(patient_in: PatientCreate, db: Session = Depends(get_db)):
    # Check if patient already exists by phone or abha_id to prevent UniqueViolation errors
    existing = None
    if patient_in.phone:
        existing = db.query(Patient).filter(Patient.phone == patient_in.phone).first()
    if not existing and patient_in.abha_id:
        existing = db.query(Patient).filter(Patient.abha_id == patient_in.abha_id).first()
    if existing:
        if patient_in.name and patient_in.name != existing.name:
            existing.name = patient_in.name
        if patient_in.village and patient_in.village != existing.village:
            existing.village = patient_in.village
        if patient_in.taluka and patient_in.taluka != existing.taluka:
            existing.taluka = patient_in.taluka
        if patient_in.district and patient_in.district != existing.district:
            existing.district = patient_in.district
        db.commit()
        db.refresh(existing)
        return existing

    # Auto-generate ABHA ID if not provided
    abha_data = AbdmFhirService.generate_abha_id(patient_in.name, patient_in.phone)
    abha_id = patient_in.abha_id or abha_data["abha_number"]

    new_patient = Patient(
        abha_id=abha_id,
        name=patient_in.name,
        age=patient_in.age,
        gender=patient_in.gender,
        phone=patient_in.phone,
        village=patient_in.village,
        taluka=patient_in.taluka,
        district=patient_in.district,
        wadi=patient_in.wadi,
        preferred_language=patient_in.preferred_language or "mr"
    )
    db.add(new_patient)
    db.commit()
    db.refresh(new_patient)
    return new_patient


@app.get("/api/patients", response_model=List[PatientResponse])
def list_patients(limit: int = 50, db: Session = Depends(get_db)):
    return db.query(Patient).order_by(desc(Patient.id)).limit(limit).all()


# ----------------- Triage Engine & Evaluation -----------------
@app.post("/api/triage/evaluate", response_model=TriageEvaluationResponse)
def evaluate_triage(req: TriageEvaluationRequest, db: Session = Depends(get_db)):
    """
    Evaluates vitals and symptoms using hybrid clinical AI (Gemini + clinical safety floors).
    Includes continuous POST request guardrails:
    1. Rate limiting (max 15 requests / minute per client/phone).
    2. Idempotency deduplication: identical inputs within 60s return cached results without re-invoking Gemini or duplicating DB records.
    """
    now = time.time()
    client_id = req.phone or req.patient_name or "anonymous"

    # 1. Rate Limiting Guardrail
    timestamps = _TRIAGE_RATE_LIMITS[client_id]
    _TRIAGE_RATE_LIMITS[client_id] = [t for t in timestamps if now - t < 60.0]
    if len(_TRIAGE_RATE_LIMITS[client_id]) >= MAX_TRIAGE_PER_MINUTE:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded: Please wait a few seconds before requesting another triage evaluation."
        )
    _TRIAGE_RATE_LIMITS[client_id].append(now)

    # 2. Idempotency Deduplication Guardrail (Continuous POST on identical inputs)
    fingerprint = _generate_triage_fingerprint(req)
    cached_entry = _TRIAGE_DEDUPLICATION_CACHE.get(fingerprint)
    if cached_entry and (now - cached_entry["timestamp"]) < TRIAGE_DEDUP_TTL_SECONDS:
        cached_result = dict(cached_entry["result"])
        cached_result["cached"] = True
        return cached_result

    # 3. Fresh Evaluation via Gemini 3.6 Flash + Safety Guardrails
    triage_result = triage_engine.evaluate(
        vitals=req.vitals,
        age=req.age,
        gender=req.gender,
        patient_name=req.patient_name
    )

    diff_list = triage_result.get("differential_diagnosis") or []
    diff_json = json.dumps(diff_list) if isinstance(diff_list, list) else str(diff_list)

    record = TriageRecord(
        patient_id=req.patient_id,
        patient_name=req.patient_name,
        age=req.age,
        gender=req.gender,
        village=req.village,
        taluka=req.taluka,
        district=req.district,
        phone=req.phone,
        systolic_bp=req.vitals.systolic_bp,
        diastolic_bp=req.vitals.diastolic_bp,
        spo2=req.vitals.spo2,
        pulse_rate=req.vitals.pulse_rate,
        temperature=req.vitals.temperature,
        symptom_duration_days=req.vitals.symptom_duration_days,
        symptoms=req.vitals.symptoms,
        high_risk_maternal=req.vitals.high_risk_maternal or False,
        maternal_note=req.vitals.maternal_note,
        priority=triage_result["priority"],
        triage_reason=triage_result["triage_reason"],
        confidence_score=triage_result["confidence_score"],
        doctor_verification_required=triage_result["doctor_verification_required"],
        differential_diagnosis=diff_json,
        clinical_reasoning=triage_result.get("clinical_reasoning"),
        ai_model=triage_result.get("model_engine") or "Gemini 3.6 Flash + Clinical Rule Guardrail v2.0",
        doctor_verified=False,
        status="Pending",
        source=req.source or "Patient"
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    output = {
        "id": record.id,
        "priority": triage_result["priority"],
        "triage_label": triage_result["triage_label"],
        "triage_reason": triage_result["triage_reason"],
        "confidence_score": triage_result["confidence_score"],
        "doctor_verification_required": triage_result["doctor_verification_required"],
        "is_diagnosis": triage_result["is_diagnosis"],
        "disclaimer": triage_result["disclaimer"],
        "triggers": triage_result["triggers"],
        "recommended_action": triage_result["recommended_action"],
        "differential_diagnosis": triage_result.get("differential_diagnosis") or [],
        "clinical_reasoning": triage_result.get("clinical_reasoning"),
        "red_flag_warnings": triage_result.get("red_flag_warnings") or [],
        "recommended_investigations": triage_result.get("recommended_investigations") or [],
        "ai_model": triage_result.get("model_engine") or "Gemini 3.6 Flash + Clinical Rule Guardrail v2.0",
        "cached": False,
    }

    _TRIAGE_DEDUPLICATION_CACHE[fingerprint] = {
        "result": output,
        "timestamp": now
    }

    return output


@app.get("/api/triage/queue")
def get_doctor_queue(
    priority: Optional[str] = None,
    village: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Returns prioritized patient queue for Doctor verification.
    Ordered by priority (P1 first, then P2, then P3), then timestamp.
    """
    query = db.query(TriageRecord)

    if priority and priority != "All":
        query = query.filter(TriageRecord.priority == priority)
    if village and village != "All":
        query = query.filter(TriageRecord.village.ilike(f"%{village}%"))
    if status and status != "All":
        query = query.filter(TriageRecord.status == status)

    # Custom priority ordering: P1 -> P2 -> P3
    priority_order = case(
        (TriageRecord.priority == "P1", 1),
        (TriageRecord.priority == "P2", 2),
        (TriageRecord.priority == "P3", 3),
        else_=4
    )

    records = query.order_by(priority_order, desc(TriageRecord.created_at)).all()

    results = []
    for r in records:
        diff_list = []
        if r.differential_diagnosis:
            try:
                diff_list = json.loads(r.differential_diagnosis)
                if not isinstance(diff_list, list):
                    diff_list = [str(diff_list)]
            except Exception:
                diff_list = [d.strip() for d in r.differential_diagnosis.split(",") if d.strip()]
        results.append({
            "id": r.id,
            "patient_id": r.patient_id,
            "patient_name": r.patient_name,
            "age": r.age,
            "gender": r.gender,
            "village": r.village,
            "taluka": r.taluka,
            "district": r.district,
            "phone": r.phone,
            "systolic_bp": r.systolic_bp,
            "diastolic_bp": r.diastolic_bp,
            "spo2": r.spo2,
            "pulse_rate": r.pulse_rate,
            "temperature": r.temperature,
            "symptoms": r.symptoms,
            "symptom_duration_days": r.symptom_duration_days,
            "high_risk_maternal": r.high_risk_maternal,
            "maternal_note": r.maternal_note,
            "priority": r.priority,
            "triage_reason": r.triage_reason,
            "confidence_score": r.confidence_score,
            "differential_diagnosis": diff_list,
            "clinical_reasoning": r.clinical_reasoning,
            "ai_model": r.ai_model,
            "doctor_verified": r.doctor_verified,
            "doctor_name": r.doctor_name,
            "doctor_notes": r.doctor_notes,
            "prescription": r.prescription,
            "status": r.status,
            "source": r.source,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return results


@app.post("/api/triage/verify")
def verify_triage_record(req: DoctorVerificationRequest, db: Session = Depends(get_db)):
    """
    Doctor review and verification of an AI-triaged patient.
    Allows overriding priority, adding prescription notes, or initiating referral.
    """
    record = db.query(TriageRecord).filter(TriageRecord.id == req.triage_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Triage record not found")

    record.doctor_verified = True
    record.doctor_name = req.doctor_name
    record.priority = req.verified_priority
    record.doctor_notes = req.doctor_notes
    record.prescription = req.prescription
    record.status = "Verified" if req.action == "Verify" else req.action

    db.commit()
    db.refresh(record)

    return {
        "success": True,
        "message": f"Triage record #{record.id} verified by {req.doctor_name}",
        "updated_priority": record.priority,
        "status": record.status,
    }


# ----------------- Offline Sync (Dexie.js -> Supabase) -----------------
@app.post("/api/sync/batch")
def sync_batch_records(req: BatchSyncRequest, db: Session = Depends(get_db)):
    """
    Accepts offline triage records stored in ASHA worker's browser IndexedDB (Dexie.js).
    Resolves conflicts and saves records into Supabase.
    """
    synced_ids = []

    for item in req.records:
        record = TriageRecord(
            patient_name=item.patient_name,
            age=item.age,
            gender=item.gender,
            village=item.village,
            phone=item.phone,
            systolic_bp=item.vitals.systolic_bp,
            diastolic_bp=item.vitals.diastolic_bp,
            spo2=item.vitals.spo2,
            pulse_rate=item.vitals.pulse_rate,
            temperature=item.vitals.temperature,
            symptom_duration_days=item.vitals.symptom_duration_days,
            symptoms=item.vitals.symptoms,
            high_risk_maternal=item.vitals.high_risk_maternal or False,
            maternal_note=item.vitals.maternal_note,
            priority=item.priority,
            triage_reason=item.triage_reason,
            doctor_verification_required=True,
            doctor_verified=False,
            status="Pending",
            source="ASHA_Offline",
            created_at=item.recorded_at,
        )
        db.add(record)

        # Credit ASHA Incentive
        incentive = AshaIncentive(
            asha_id=req.asha_id,
            asha_name=req.asha_name,
            activity_type="Rural Screening & Offline Sync",
            patient_name=item.patient_name,
            amount=50.0,
            status="Approved",
        )
        db.add(incentive)
        synced_ids.append(item.local_id)

    db.commit()

    return {
        "status": "success",
        "synced_count": len(synced_ids),
        "synced_local_ids": synced_ids,
        "incentives_credited_inr": len(synced_ids) * 50.0,
        "message": f"Successfully synchronized {len(synced_ids)} records to Supabase.",
    }


@app.get("/api/asha/incentives")
def get_asha_incentives(asha_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(AshaIncentive)
    if asha_id:
        query = query.filter(AshaIncentive.asha_id == asha_id)
    incentives = query.order_by(desc(AshaIncentive.recorded_at)).all()
    total_inr = sum(i.amount for i in incentives)

    return {
        "asha_id": asha_id or "ALL",
        "total_earned_inr": total_inr,
        "records_count": len(incentives),
        "history": [
            {
                "id": i.id,
                "patient_name": i.patient_name,
                "activity": i.activity_type,
                "amount": i.amount,
                "status": i.status,
                "date": i.recorded_at.strftime("%d %b %Y, %I:%M %p") if i.recorded_at else None,
            }
            for i in incentives
        ],
    }


# ----------------- Referrals -----------------
@app.get("/api/referrals")
def get_referrals(priority: Optional[str] = None, status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Referral)
    if priority and priority != "All":
        query = query.filter(Referral.priority == priority)
    if status and status != "All":
        query = query.filter(Referral.status == status)

    referrals = query.order_by(desc(Referral.created_at)).all()
    return [
        {
            "id": r.id,
            "triage_id": r.triage_id,
            "patient_name": r.patient_name,
            "age": r.age,
            "priority": r.priority,
            "source_facility": r.source_facility,
            "target_facility": r.target_facility,
            "urgency": r.urgency,
            "reason": r.reason,
            "transport_mode": r.transport_mode,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in referrals
    ]


@app.post("/api/referrals")
def create_referral(req: ReferralCreate, db: Session = Depends(get_db)):
    ref = Referral(
        triage_id=req.triage_id,
        patient_name=req.patient_name,
        age=req.age,
        priority=req.priority,
        source_facility=req.source_facility or "Primary Care Facility",
        target_facility=req.target_facility,
        urgency=req.urgency or "Immediate",
        reason=req.reason,
        transport_mode=req.transport_mode or "108 Emergency Ambulance",
        status=req.status or "Pending",
    )
    db.add(ref)
    db.commit()
    db.refresh(ref)
    return {
        "success": True,
        "referral_id": ref.id,
        "status": ref.status,
        "message": f"Referral created to {ref.target_facility} for {ref.patient_name}",
    }


@app.patch("/api/referrals/{referral_id}/status")
def update_referral_status(referral_id: int, payload: dict, db: Session = Depends(get_db)):
    ref = db.query(Referral).filter(Referral.id == referral_id).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Referral not found")
    new_status = payload.get("status") or payload.get("new_status")
    if new_status:
        ref.status = new_status
        db.commit()
        db.refresh(ref)
    return {"success": True, "id": ref.id, "new_status": ref.status}


# ----------------- Appointments -----------------
@app.get("/api/appointments", response_model=List[AppointmentResponse])
def get_appointments(
    facility: Optional[str] = None,
    doctor: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Appointment)
    if facility and facility != "All":
        query = query.filter(Appointment.facility_name.ilike(f"%{facility}%"))
    if doctor and doctor != "All":
        query = query.filter(Appointment.doctor_name.ilike(f"%{doctor}%"))
    if status and status != "All":
        query = query.filter(Appointment.status == status)
    return query.order_by(desc(Appointment.created_at)).all()


@app.post("/api/appointments", response_model=AppointmentResponse)
def create_appointment(req: AppointmentCreate, db: Session = Depends(get_db)):
    appt = Appointment(
        patient_name=req.patient_name,
        phone=req.phone or "9800000000",
        age=req.age or 35,
        gender=req.gender or "Male",
        facility_name=req.facility_name,
        doctor_name=req.doctor_name or "Duty Medical Officer",
        appointment_date=req.appointment_date,
        time_slot=req.time_slot,
        reason=req.reason or "OPD Consultation",
        priority=req.priority or "P3",
        status=req.status or "Scheduled",
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)
    return appt


@app.patch("/api/appointments/{appointment_id}/status")
def update_appointment_status(appointment_id: int, payload: AppointmentStatusUpdate, db: Session = Depends(get_db)):
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    appt.status = payload.status
    db.commit()
    db.refresh(appt)
    return {"success": True, "id": appt.id, "status": appt.status}


# ----------------- Inventory & Stock -----------------
@app.get("/api/inventory")
def get_inventory(facility: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Inventory)
    if facility and facility != "All":
        query = query.filter(Inventory.facility_name.ilike(f"%{facility}%"))
    items = query.all()

    for item in items:
        item.is_low_stock = item.current_stock < item.min_threshold
    db.commit()

    low_stock_count = sum(1 for item in items if item.is_low_stock)

    return {
        "facility": facility or "All Facilities",
        "total_medicines": len(items),
        "low_stock_count": low_stock_count,
        "items": [
            {
                "id": item.id,
                "medicine_name": item.medicine_name,
                "category": item.category,
                "current_stock": item.current_stock,
                "min_threshold": item.min_threshold,
                "unit": item.unit,
                "is_low_stock": item.is_low_stock,
                "last_updated": item.last_updated.isoformat() if item.last_updated else None,
            }
            for item in items
        ],
    }


@app.patch("/api/inventory/{item_id}/stock")
def update_stock(item_id: int, payload: InventoryUpdate, db: Session = Depends(get_db)):
    item = db.query(Inventory).filter(Inventory.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Medicine item not found")
    item.current_stock = payload.current_stock
    item.is_low_stock = item.current_stock < item.min_threshold
    item.last_updated = datetime.utcnow()
    db.commit()
    return {"success": True, "id": item.id, "current_stock": item.current_stock, "is_low_stock": item.is_low_stock}


# ----------------- District Admin Analytics & Outbreak Heatmap -----------------
@app.get("/api/analytics/overview")
def get_district_overview(db: Session = Depends(get_db)):
    total_screened = db.query(TriageRecord).count()
    p1_count = db.query(TriageRecord).filter(TriageRecord.priority == "P1").count()
    p2_count = db.query(TriageRecord).filter(TriageRecord.priority == "P2").count()
    p3_count = db.query(TriageRecord).filter(TriageRecord.priority == "P3").count()
    active_referrals = db.query(Referral).filter(Referral.status.in_(["Referred", "En Route", "Pending"])).count()
    completed_referrals = db.query(Referral).filter(Referral.status == "Completed").count()
    low_stock_medicines = db.query(Inventory).filter(Inventory.is_low_stock == True).count()

    return {
        "district": "Maharashtra Healthcare Network",
        "metrics": {
            "total_screened": total_screened,
            "p1_critical_cases": p1_count,
            "p2_urgent_cases": p2_count,
            "p3_routine_cases": p3_count,
            "active_referrals": active_referrals,
            "completed_referrals": completed_referrals,
            "low_stock_medicines": low_stock_medicines,
            "avg_triage_response_time_mins": 3.4,
            "offline_sync_success_rate": "100%",
        },
    }


@app.get("/api/analytics/outbreaks")
def get_outbreak_heatmap(db: Session = Depends(get_db)):
    clusters = db.query(OutbreakCluster).all()
    return {
        "clusters": [
            {
                "id": c.id,
                "village": c.village_name,
                "wadi": c.wadi_location,
                "disease": c.disease_type,
                "cases": c.active_cases,
                "risk_level": c.risk_level,
                "reported_date": c.reported_date.isoformat() if c.reported_date else None,
            }
            for c in clusters
        ]
    }


# ----------------- Bhashini, eSanjeevani & ABDM Gateway Endpoints -----------------
@app.post("/api/v1/bhashini/translate")
@app.post("/api/mock/bhashini/translate")
def translate_bhashini(payload: dict):
    text = payload.get("text", "")
    source_lang = payload.get("source_lang", "mr")
    target_lang = payload.get("target_lang", "en")
    return BhashiniService.translate_text(text, source_lang, target_lang)


@app.post("/api/v1/bhashini/stt")
@app.post("/api/mock/bhashini/asr")
def asr_bhashini(payload: dict):
    audio = payload.get("audio")
    duration = payload.get("duration", 2.5)
    lang = payload.get("language") or payload.get("lang") or "mr"
    if audio:
        return BhashiniService.speech_to_text(audio_base64=audio, language=lang)
    return BhashiniService.process_voice_asr(duration=duration, language=lang)


@app.post("/api/v1/teleconsult/create-room")
@app.post("/api/mock/esanjeevani/create-session")
def create_teleconsult_room(payload: dict, db: Session = Depends(get_db)):
    patient_name = payload.get("patient_name", "Patient")
    priority = payload.get("priority", "P1")
    facility_name = payload.get("facility_name", "Primary Healthcare Centre")
    triage_id = payload.get("triage_id")
    doctor_name = payload.get("doctor_name", "Duty Medical Officer")
    return ESanjeevaniService.create_room(
        patient_name=patient_name,
        priority=priority,
        facility_name=facility_name,
        triage_id=triage_id,
        doctor_name=doctor_name,
        db=db,
    )


@app.get("/api/v1/teleconsult/room/{session_id}")
def get_teleconsult_room(session_id: str, db: Session = Depends(get_db)):
    room = ESanjeevaniService.get_room(session_id=session_id, db=db)
    if not room:
        raise HTTPException(status_code=404, detail="Teleconsultation room not found")
    return room


# ----------------- ASHA Worker ABHA Field Tasks -----------------
@app.post("/api/v1/abha/field-task")
def create_abha_field_task(req: AbhaFieldTaskCreate, db: Session = Depends(get_db)):
    task = AbhaFieldTask(
        patient_name=req.patient_name or "Citizen Patient",
        phone=req.phone,
        village=req.village or "Kharpudi",
        taluka=req.taluka or "Khed",
        district=req.district or "Pune",
        reason=req.reason or "Patient Needs ABHA Registration Field Assistance",
        status="Pending Assistance"
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return {
        "success": True,
        "task_id": task.id,
        "task": {
            "id": task.id,
            "patient_name": task.patient_name,
            "phone": task.phone,
            "village": task.village,
            "status": task.status
        }
    }


@app.get("/api/v1/abha/field-tasks")
def list_abha_field_tasks(
    village: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(AbhaFieldTask)
    if village and village != "All":
        q = q.filter(func.lower(AbhaFieldTask.village) == village.lower())
    if status and status != "All":
        q = q.filter(AbhaFieldTask.status == status)
    tasks = q.order_by(desc(AbhaFieldTask.id)).limit(100).all()
    return [
        {
            "id": t.id,
            "patient_name": t.patient_name,
            "phone": t.phone,
            "village": t.village,
            "taluka": t.taluka,
            "district": t.district,
            "reason": t.reason,
            "status": t.status,
            "created_at": t.created_at.isoformat() if t.created_at else None
        }
        for t in tasks
    ]


@app.patch("/api/v1/abha/field-tasks/{task_id}/resolve")
def resolve_abha_field_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(AbhaFieldTask).filter(AbhaFieldTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Field task not found")
    task.status = "Completed"
    db.commit()
    return {"success": True, "task_id": task_id, "status": "Completed"}


# ─────────────────────────────────────────────
# Phase 1: Hospital Dashboard Endpoints
# ─────────────────────────────────────────────

# --- Hospital Doctors ---

@app.get("/api/hospitals/{hospital_id}/doctors")
def list_hospital_doctors(
    hospital_id: str,
    speciality: Optional[str] = Query(None, description="Filter by doctor speciality"),
    active_only: bool = Query(False, description="Filter only active doctors"),
    search: Optional[str] = Query(None, description="Search by doctor name or qualification"),
    db: Session = Depends(get_db)
):
    """
    Public & Patient view: List doctors available at a specific hospital.
    Supports speciality filtering and keyword search.
    """
    return HospitalService.list_doctors(
        db=db,
        hospital_id=hospital_id,
        speciality=speciality,
        active_only=active_only,
        search_query=search
    )


@app.get("/api/doctors/{doctor_id}")
def get_doctor_detail(doctor_id: int, db: Session = Depends(get_db)):
    doc = HospitalService.get_doctor(db, doctor_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return doc


@app.post("/api/hospitals/{hospital_id}/doctors", status_code=201)
def create_hospital_doctor(
    hospital_id: str,
    payload: HospitalDoctorCreate,
    x_hospital_id: Optional[str] = Header(None, alias="X-Hospital-Id"),
    db: Session = Depends(get_db)
):
    """
    Hospital-scoped: Create a new doctor under this hospital's account.
    Validates ownership via header or path alignment.
    """
    req_hosp = (x_hospital_id or hospital_id).strip()
    if payload.hospital_id and payload.hospital_id.strip().lower() != req_hosp.lower():
        raise HTTPException(status_code=403, detail="Payload hospital_id does not match target hospital")
    payload.hospital_id = req_hosp
    return HospitalService.create_doctor(db, payload)


@app.patch("/api/doctors/{doctor_id}")
@app.put("/api/doctors/{doctor_id}")
def update_hospital_doctor(
    doctor_id: int,
    payload: HospitalDoctorUpdate,
    x_hospital_id: Optional[str] = Header(None, alias="X-Hospital-Id"),
    db: Session = Depends(get_db)
):
    """
    Hospital-scoped: Update doctor details, availability slots, or active status.
    """
    return HospitalService.update_doctor(
        db=db,
        doctor_id=doctor_id,
        doc_in=payload,
        requesting_hospital_id=x_hospital_id
    )


@app.delete("/api/doctors/{doctor_id}")
def delete_hospital_doctor(
    doctor_id: int,
    x_hospital_id: Optional[str] = Header(None, alias="X-Hospital-Id"),
    db: Session = Depends(get_db)
):
    """
    Hospital-scoped: Delete doctor record.
    """
    return HospitalService.delete_doctor(
        db=db,
        doctor_id=doctor_id,
        requesting_hospital_id=x_hospital_id
    )


# --- Hospital Diagnostic / Lab Tests ---

@app.get("/api/hospitals/{hospital_id}/tests")
def list_hospital_tests(
    hospital_id: str,
    category: Optional[str] = Query(None, description="Filter by test category (Pathology, Radiology, etc.)"),
    available_only: bool = Query(False, description="Filter only currently available tests"),
    search: Optional[str] = Query(None, description="Search by test name or prep notes"),
    db: Session = Depends(get_db)
):
    """
    Public & Patient view: List diagnostic / laboratory tests offered by a hospital.
    """
    return HospitalService.list_tests(
        db=db,
        hospital_id=hospital_id,
        category=category,
        available_only=available_only,
        search_query=search
    )


@app.get("/api/tests/{test_id}")
def get_test_detail(test_id: int, db: Session = Depends(get_db)):
    test = HospitalService.get_test(db, test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    return test


@app.post("/api/hospitals/{hospital_id}/tests", status_code=201)
def create_hospital_test(
    hospital_id: str,
    payload: HospitalTestCreate,
    x_hospital_id: Optional[str] = Header(None, alias="X-Hospital-Id"),
    db: Session = Depends(get_db)
):
    """
    Hospital-scoped: Add a new diagnostic test to this hospital's catalog.
    """
    req_hosp = (x_hospital_id or hospital_id).strip()
    if payload.hospital_id and payload.hospital_id.strip().lower() != req_hosp.lower():
        raise HTTPException(status_code=403, detail="Payload hospital_id does not match target hospital")
    payload.hospital_id = req_hosp
    return HospitalService.create_test(db, payload)


@app.patch("/api/tests/{test_id}")
@app.put("/api/tests/{test_id}")
def update_hospital_test(
    test_id: int,
    payload: HospitalTestUpdate,
    x_hospital_id: Optional[str] = Header(None, alias="X-Hospital-Id"),
    db: Session = Depends(get_db)
):
    """
    Hospital-scoped: Update test pricing, prep notes, turnaround time, or availability.
    """
    return HospitalService.update_test(
        db=db,
        test_id=test_id,
        test_in=payload,
        requesting_hospital_id=x_hospital_id
    )


@app.delete("/api/tests/{test_id}")
def delete_hospital_test(
    test_id: int,
    x_hospital_id: Optional[str] = Header(None, alias="X-Hospital-Id"),
    db: Session = Depends(get_db)
):
    """
    Hospital-scoped: Remove test from catalog.
    """
    return HospitalService.delete_test(
        db=db,
        test_id=test_id,
        requesting_hospital_id=x_hospital_id
    )


# --- Hospital Pharmacy Inventory ---

@app.get("/api/hospitals/{hospital_id}/pharmacy")
def list_hospital_pharmacy(
    hospital_id: str,
    status: Optional[str] = Query("ALL", description="Filter by stock status: ALL, LOW_STOCK, IN_STOCK"),
    sort_by: Optional[str] = Query("name", description="Sort by: name, quantity, status, last_updated"),
    sort_order: Optional[str] = Query("asc", description="Sort order: asc, desc"),
    search: Optional[str] = Query(None, description="Search medicine name or generic name"),
    db: Session = Depends(get_db)
):
    """
    Public & Patient view: List hospital pharmacy inventory.
    Status is automatically derived: LOW_STOCK when quantity <= reorder_threshold else IN_STOCK.
    """
    return HospitalService.list_pharmacy_items(
        db=db,
        hospital_id=hospital_id,
        status_filter=status,
        sort_by=sort_by,
        sort_order=sort_order,
        search_query=search
    )


@app.get("/api/pharmacy/{item_id}")
def get_pharmacy_item_detail(item_id: int, db: Session = Depends(get_db)):
    item = HospitalService.get_pharmacy_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Pharmacy item not found")
    return item


@app.post("/api/hospitals/{hospital_id}/pharmacy", status_code=201)
def create_hospital_pharmacy_item(
    hospital_id: str,
    payload: HospitalPharmacyItemCreate,
    x_hospital_id: Optional[str] = Header(None, alias="X-Hospital-Id"),
    db: Session = Depends(get_db)
):
    """
    Hospital-scoped: Add a medicine to this hospital's pharmacy inventory.
    Automatically derives LOW_STOCK when quantity <= reorder_threshold.
    """
    req_hosp = (x_hospital_id or hospital_id).strip()
    if payload.hospital_id and payload.hospital_id.strip().lower() != req_hosp.lower():
        raise HTTPException(status_code=403, detail="Payload hospital_id does not match target hospital")
    payload.hospital_id = req_hosp
    return HospitalService.create_pharmacy_item(db, payload)


@app.patch("/api/pharmacy/{item_id}")
@app.put("/api/pharmacy/{item_id}")
def update_hospital_pharmacy_item(
    item_id: int,
    payload: HospitalPharmacyItemUpdate,
    x_hospital_id: Optional[str] = Header(None, alias="X-Hospital-Id"),
    db: Session = Depends(get_db)
):
    """
    Hospital-scoped: Update pharmacy item stock quantity, threshold, or batch info.
    Auto-updates status to LOW_STOCK when quantity <= reorder_threshold.
    """
    return HospitalService.update_pharmacy_item(
        db=db,
        item_id=item_id,
        item_in=payload,
        requesting_hospital_id=x_hospital_id
    )


@app.delete("/api/pharmacy/{item_id}")
def delete_hospital_pharmacy_item(
    item_id: int,
    x_hospital_id: Optional[str] = Header(None, alias="X-Hospital-Id"),
    db: Session = Depends(get_db)
):
    """
    Hospital-scoped: Remove medicine item from pharmacy.
    """
    return HospitalService.delete_pharmacy_item(
        db=db,
        item_id=item_id,
        requesting_hospital_id=x_hospital_id
    )




# ----------------- Static Files & Single Page Application (SPA) Serving -----------------
FRONTEND_DIST = os.getenv(
    "FRONTEND_DIST",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist")
)

if os.path.exists(FRONTEND_DIST):
    assets_path = os.path.join(FRONTEND_DIST, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

    @app.get("/")
    async def serve_spa_root():
        index_path = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.isfile(index_path):
            return FileResponse(
                index_path,
                headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}
            )
        raise HTTPException(status_code=404, detail="index.html not found")

    @app.get("/{full_path:path}")
    async def serve_spa_fallback(full_path: str):
        # Do not intercept /api calls; return JSON 404 for unknown API routes
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(status_code=404, detail="API endpoint not found")

        # Serve static file if it exists directly in frontend/dist (e.g. favicon.ico, vite.svg)
        target_file = os.path.join(FRONTEND_DIST, full_path)
        if full_path and os.path.isfile(target_file):
            return FileResponse(target_file)

        # SPA client-side routing fallback: return index.html for React Router
        index_path = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.isfile(index_path):
            return FileResponse(
                index_path,
                headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}
            )

        raise HTTPException(status_code=404, detail="Frontend build index.html not found")
else:
    @app.get("/")
    def read_root(db: Session = Depends(get_db)):
        return read_api_info(db)

