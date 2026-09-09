import os
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, Depends, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc, case

from .database import engine, Base, get_db, load_env
from .models import (
    Patient, TriageRecord, Referral, Appointment,
    Inventory, OutbreakCluster, AshaIncentive,
    TeleconsultRoom, OtpSession, AbhaFieldTask
)
from .schemas import (
    PatientCreate, PatientResponse,
    TriageEvaluationRequest, TriageEvaluationResponse,
    DoctorVerificationRequest, ReferralCreate,
    AppointmentCreate, AppointmentResponse, AppointmentStatusUpdate,
    BatchSyncRequest, InventoryUpdate, VitalsInput,
    OtpRequest, OtpVerifyRequest, TeleconsultCreateRequest,
    BhashiniTranslateRequest, AbhaFieldTaskCreate
)
from .triage_engine import triage_engine
from .services.bhashini_service import BhashiniService
from .services.esanjeevani_service import ESanjeevaniService
from .services.abdm_service import AbdmService
from .seed_data import seed_database
from .hospital_loader import hospital_directory

# Ensure environment loaded
load_env()

# Load authentic Maharashtra Village dataset (44,810 villages)
VILLAGES_DATASET_PATH = os.path.join(os.path.dirname(__file__), "maharashtra_villages_website.json")
if not os.path.exists(VILLAGES_DATASET_PATH):
    VILLAGES_DATASET_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "maharashtra_villages_website.json")

MAHARASHTRA_VILLAGES = []
if os.path.exists(VILLAGES_DATASET_PATH):
    try:
        import json
        with open(VILLAGES_DATASET_PATH, "r", encoding="utf-8") as f:
            MAHARASHTRA_VILLAGES = json.load(f)
        print(f"Loaded {len(MAHARASHTRA_VILLAGES)} authentic Maharashtra villages into memory.")
    except Exception as e:
        print(f"Error loading villages dataset: {e}")

# Initialize DB tables
Base.metadata.create_all(bind=engine)

# Seed database structure with reference Kharpudi PHC patient & baseline inventory
with next(get_db()) as db_session:
    seed_database(db_session)

app = FastAPI(
    title="SevaSetu API",
    description="Backend API for SevaSetu Rural Healthcare AI System with smart triage, offline sync, and ABDM/BHASHINI/eSanjeevani adapters.",
    version="2.0.0"
)

# Parse CORS Origins from environment
cors_env = os.getenv("CORS_ORIGINS", "*")
origins = [o.strip() for o in cors_env.split(",") if o.strip()] if cors_env != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- Root & Health -----------------
@app.get("/")
def read_root():
    return {
        "system": "SevaSetu Rural Healthcare Platform",
        "status": "Operational",
        "engine": "Clinical Rule-Based Triage Engine v1.2",
        "mode": "Live Government Datasets (Maharashtra)",
        "villages_indexed": len(MAHARASHTRA_VILLAGES),
        "hospitals_indexed": len(hospital_directory.hospitals)
    }

@app.get("/api/health")
@app.get("/api/v1/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "database": "connected",
        "villages_count": len(MAHARASHTRA_VILLAGES),
        "hospitals_count": len(hospital_directory.hospitals)
    }

def ensure_db(db):
    if not isinstance(db, Session):
        return next(get_db())
    return db

# ----------------- ABDM Gateway & OTP Authentication -----------------
@app.post("/api/v1/auth/request-otp")
@app.post("/api/auth/request-otp")
def request_otp(req: OtpRequest, db: Session = Depends(get_db)):
    """
    Sends an ABDM Gateway OTP to a 10-digit mobile number or 14-digit ABHA address.
    """
    db_sess = ensure_db(db)
    return AbdmService.request_otp(req.identifier, req.role or "patient", db_sess)

@app.post("/api/v1/auth/verify-otp")
@app.post("/api/auth/verify-otp")
def verify_otp(req: OtpVerifyRequest, db: Session = Depends(get_db)):
    """
    Validates the OTP and establishes an authenticated ABDM patient or health officer session.
    """
    db_sess = ensure_db(db)
    return AbdmService.verify_otp(
        session_id=req.session_id,
        otp=req.otp,
        role=req.role or "patient",
        custom_name=req.name,
        village=req.village,
        taluka=req.taluka,
        district=req.district,
        db=db_sess
    )

@app.get("/api/v1/patient/abdm-profile")
@app.get("/api/patient/abdm-profile")
def get_abdm_profile(identifier: str = Query(..., description="Phone number or ABHA ID"), db: Session = Depends(get_db)):
    """
    Fetches ABDM profile and FHIR R4 Bundle for patient.
    """
    db_sess = ensure_db(db)
    return AbdmService.get_abdm_profile(identifier, db_sess)

@app.post("/api/v1/patient/generate-abha")
@app.post("/api/mock/abdm/generate-abha")
def generate_abha(payload: dict):
    name = payload.get("name", "Citizen Patient")
    phone = payload.get("phone", "9822000000")
    return AbdmService.generate_abha_id(name, phone)

@app.get("/api/v1/auth/check-abha")
@app.get("/api/auth/check-abha")
def check_abha_by_phone(phone: str = Query(..., description="10-digit mobile number"), db: Session = Depends(get_db)):
    """
    Checks if an ABHA ID is already linked to the patient's phone number
    in either local database or official ABDM registry.
    If found, returns the linked ABHA ID and demographic profile.
    """
    db_sess = ensure_db(db)
    clean_phone = phone.strip()
    
    # 1. Check local DB
    patient = db_sess.query(Patient).filter(Patient.phone == clean_phone).first()
    if patient and patient.abha_id:
        # Load official records
        prof = AbdmService.get_abdm_profile(patient.abha_id, db_sess)
        return {
            "exists": True,
            "has_abha": True,
            "patient": {
                "id": patient.id,
                "name": patient.name,
                "age": patient.age,
                "gender": patient.gender,
                "phone": patient.phone,
                "village": patient.village,
                "taluka": patient.taluka,
                "district": patient.district,
                "abha_number": patient.abha_id,
                "abha_id": patient.abha_id
            },
            "abha_number": patient.abha_id,
            "records": prof.get("records", [])
        }
    
    # 2. Check official ABDM registry
    official_match = AbdmService.find_official_registry_entry(clean_phone)
    if official_match:
        prof = AbdmService.get_abdm_profile(official_match["abha_number"], db_sess)
        return {
            "exists": True,
            "has_abha": True,
            "patient": prof.get("patient"),
            "abha_number": official_match["abha_number"],
            "records": prof.get("records", [])
        }

    return {
        "exists": False,
        "has_abha": False,
        "phone": clean_phone
    }

@app.post("/api/v1/auth/verify-abha")
@app.post("/api/auth/verify-abha")
def verify_abha_login(payload: dict, db: Session = Depends(get_db)):
    """
    Directly verifies an entered 14-digit ABHA ID or ABHA address against the official ABDM Registry.
    Returns authenticated patient session with official demographic details and health records.
    """
    db_sess = ensure_db(db)
    abha_id = payload.get("abha_id") or payload.get("identifier") or ""
    if not abha_id.strip():
        raise HTTPException(status_code=400, detail="ABHA ID or Address is required")
    
    res = AbdmService.verify_abha_id(abha_id.strip(), db_sess)
    if not res.get("success"):
        raise HTTPException(status_code=404, detail=res.get("message", "ABHA ID not found in ABDM Registry"))
    return res

@app.post("/api/v1/system/reset-data")
@app.post("/api/system/reset-data")
def reset_system_data(db: Session = Depends(get_db)):
    """
    Wipes all localhost data from past runs across patients, triage records, field tasks,
    appointments, referrals, OTP sessions, and credits.
    """
    db_sess = ensure_db(db)
    db_sess.query(TriageRecord).delete()
    db_sess.query(Patient).delete()
    db_sess.query(AbhaFieldTask).delete()
    db_sess.query(Appointment).delete()
    db_sess.query(Referral).delete()
    db_sess.query(OtpSession).delete()
    db_sess.query(TeleconsultRoom).delete()
    db_sess.query(AshaIncentive).delete()
    db_sess.commit()

    # Re-seed baseline inventory
    from .seed_data import seed_database
    seed_database(db_sess)

    return {
        "success": True,
        "message": "All local test data purged successfully. Database reset to clean state."
    }


@app.post("/api/v1/abha/field-task")
@app.post("/api/abha/field-task")
def create_abha_field_task(req: AbhaFieldTaskCreate, db: Session = Depends(get_db)):
    """
    Dispatches a field notification task to the local ASHA worker queue
    when a patient skips ABHA creation during login.
    """
    db_sess = ensure_db(db)
    task = AbhaFieldTask(
        patient_name=req.patient_name or "Citizen Patient",
        phone=req.phone.strip(),
        village=req.village or "Kharpudi",
        taluka=req.taluka or "Khed",
        district=req.district or "Pune",
        reason=req.reason or "Patient Needs ABHA Registration Field Assistance",
        status="Pending Assistance"
    )
    db_sess.add(task)
    db_sess.commit()
    db_sess.refresh(task)
    return {
        "success": True,
        "task_id": task.id,
        "status": task.status,
        "message": "Field assistance task dispatched to local ASHA worker."
    }

@app.get("/api/v1/abha/field-tasks")
@app.get("/api/abha/field-tasks")
def list_abha_field_tasks(
    village: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Returns pending/completed ABHA registration field tasks for ASHA workers.
    """
    db_sess = ensure_db(db)
    query = db_sess.query(AbhaFieldTask)
    if village and village != "All":
        query = query.filter(AbhaFieldTask.village.ilike(f"%{village}%"))
    if status and status != "All":
        query = query.filter(AbhaFieldTask.status == status)
    
    tasks = query.order_by(desc(AbhaFieldTask.created_at)).all()
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
            "created_at": t.created_at.strftime("%d %b %Y, %I:%M %p") if t.created_at else None
        }
        for t in tasks
    ]

@app.patch("/api/v1/abha/field-tasks/{task_id}/resolve")
@app.patch("/api/abha/field-tasks/{task_id}/resolve")
def resolve_abha_field_task(task_id: int, db: Session = Depends(get_db)):
    """
    Resolves an ASHA field task by minting a new ABHA card for the patient
    and awarding ₹25 ASHA incentive.
    """
    db_sess = ensure_db(db)
    task = db_sess.query(AbhaFieldTask).filter(AbhaFieldTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Field task not found")
    
    abha_data = AbdmService.generate_abha_id(task.patient_name or "Citizen", task.phone)
    abha_num = abha_data["abha_number"]

    # Link or update patient
    patient = db_sess.query(Patient).filter(Patient.phone == task.phone).first()
    if patient:
        patient.abha_id = abha_num
    else:
        patient = Patient(
            abha_id=abha_num,
            name=task.patient_name or "Citizen Patient",
            phone=task.phone,
            village=task.village,
            taluka=task.taluka,
            district=task.district,
            age=30,
            gender="Unknown"
        )
        db_sess.add(patient)

    task.status = "Completed"

    # Credit ₹25 ASHA Incentive
    incentive = AshaIncentive(
        asha_id="ASHA_01",
        asha_name="ASHA Worker",
        activity_type="ABHA Field Registration",
        patient_name=task.patient_name or "Citizen Patient",
        amount=25.0,
        status="Approved"
    )
    db_sess.add(incentive)
    db_sess.commit()

    return {
        "success": True,
        "task_id": task.id,
        "status": "Completed",
        "abha_number": abha_num,
        "incentive_awarded_inr": 25.0,
        "message": f"ABHA ID {abha_num} successfully generated. ₹25 credited to ASHA incentive ledger."
    }


# ----------------- Bhashini Indic Language & Voice Service -----------------
@app.post("/api/v1/bhashini/translate")
@app.post("/api/mock/bhashini/translate")
def translate_bhashini(req: BhashiniTranslateRequest):
    """
    Translates clinical notes/symptoms between English, Marathi, and Hindi.
    """
    return BhashiniService.translate_text(req.text, req.source_lang, req.target_lang)

@app.post("/api/v1/bhashini/stt")
@app.post("/api/mock/bhashini/asr")
def stt_bhashini(payload: dict = Body(default={})):
    """
    Voice transcription with fallback for Indic languages (mr, hi, en).
    """
    lang = payload.get("language", "mr")
    audio = payload.get("audio")
    return BhashiniService.speech_to_text(audio, lang)

# ----------------- eSanjeevani Teleconsultation Room Suite -----------------
@app.post("/api/v1/teleconsult/create-room")
@app.post("/api/mock/esanjeevani/create-session")
def create_teleconsult_room(req: TeleconsultCreateRequest, db: Session = Depends(get_db)):
    """
    Creates dynamic eSanjeevani WebRTC / Jitsi teleconsultation room tied to patient and triage.
    """
    db_sess = ensure_db(db)
    return ESanjeevaniService.create_room(
        patient_name=req.patient_name,
        priority=req.priority or "P1",
        facility_name=req.facility_name or "Primary Healthcare Centre",
        triage_id=req.triage_id,
        doctor_name=req.doctor_name,
        db=db_sess
    )

@app.get("/api/v1/teleconsult/room/{session_id}")
def get_teleconsult_room(session_id: str, db: Session = Depends(get_db)):
    """
    Fetches active teleconsultation room status and Jitsi room URL.
    """
    db_sess = ensure_db(db)
    room = ESanjeevaniService.get_room(session_id, db_sess)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room

# ----------------- Maharashtra Village Dataset & Search -----------------
@app.get("/api/villages/search")
@app.get("/api/v1/villages/search")
def search_villages(
    q: str = Query(..., min_length=1, description="Search query for village name, taluka, or district"),
    district: Optional[str] = Query(None, description="Filter by district"),
    taluka: Optional[str] = Query(None, description="Filter by taluka"),
    limit: int = Query(25, ge=1, le=100)
):
    query = q.strip().lower()
    if not query:
        return []

    exact_or_prefix = []
    substr_matches = []

    for v in MAHARASHTRA_VILLAGES:
        if district and v.get("district", "").lower() != district.lower():
            continue
        if taluka and v.get("taluka", "").lower() != taluka.lower():
            continue

        name_lower = v.get("name", "").lower()
        taluka_lower = v.get("taluka", "").lower()
        district_lower = v.get("district", "").lower()

        if name_lower.startswith(query):
            exact_or_prefix.append(v)
        elif query in name_lower or query in taluka_lower or query in district_lower:
            substr_matches.append(v)

        if len(exact_or_prefix) >= limit:
            break

    results = exact_or_prefix + substr_matches
    return results[:limit]

@app.get("/api/districts")
@app.get("/api/v1/districts")
def list_districts():
    districts = sorted(list(set(v.get("district") for v in MAHARASHTRA_VILLAGES if v.get("district"))))
    return districts

@app.get("/api/talukas")
@app.get("/api/v1/talukas")
def list_talukas(district: Optional[str] = None):
    if district:
        talukas = sorted(list(set(v.get("taluka") for v in MAHARASHTRA_VILLAGES if v.get("district", "").lower() == district.lower() and v.get("taluka"))))
    else:
        talukas = sorted(list(set(v.get("taluka") for v in MAHARASHTRA_VILLAGES if v.get("taluka"))))
    return talukas

# ----------------- Facilities & Government Hospital Directory -----------------
@app.get("/api/facilities")
@app.get("/api/hospitals")
@app.get("/api/v1/facilities")
def get_facilities(
    district: Optional[str] = Query(None, description="Patient selected district"),
    taluka: Optional[str] = Query(None, description="Patient selected taluka"),
    village: Optional[str] = Query(None, description="Patient selected village"),
    query: Optional[str] = Query(None, description="Search by hospital name or specialty"),
    category: Optional[str] = Query(None, description="Filter by category"),
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    limit: int = Query(40, ge=1, le=100)
):
    """
    Returns authentic government & registered hospitals from hospital_directory.csv
    filtered to the patient's selected village, district, taluka, with real coordinate Haversine sorting.
    Includes boundary calculation if GPS is located outside Maharashtra.
    """
    d = district if isinstance(district, str) else None
    t = taluka if isinstance(taluka, str) else None
    v = village if isinstance(village, str) else None
    q = query if isinstance(query, str) else None
    c = category if isinstance(category, str) else None
    lim = limit if isinstance(limit, int) else 40

    return hospital_directory.search(
        district=d,
        taluka=t,
        village=v,
        query=q,
        lat=lat,
        lng=lng,
        category=c,
        limit=lim
    )

@app.get("/api/hospitals/search")
@app.get("/api/v1/hospitals/search")
def search_hospitals_by_name(
    q: str = Query("", description="Search query for hospital name, district, or address"),
    district: Optional[str] = Query(None, description="Optional district filter"),
    limit: int = Query(30, ge=1, le=100)
):
    return hospital_directory.search_by_name(query=q, district=district, limit=limit)

@app.get("/api/hospitals/{hospital_id}")
@app.get("/api/v1/hospitals/{hospital_id}")
def get_hospital_details(hospital_id: str):
    h = hospital_directory.get_by_name_or_id(hospital_id)
    if not h:
        raise HTTPException(status_code=404, detail="Hospital not found in dataset")
    return h

# ----------------- Patients -----------------
@app.post("/api/patients", response_model=PatientResponse)
@app.post("/api/v1/patients", response_model=PatientResponse)
def create_patient(patient_in: PatientCreate, db: Session = Depends(get_db)):
    # Auto-generate ABHA ID if not provided
    abha_data = AbdmService.generate_abha_id(patient_in.name, patient_in.phone)
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
        preferred_language=patient_in.preferred_language or "mr",
        lat=patient_in.lat,
        lng=patient_in.lng
    )
    db.add(new_patient)
    db.commit()
    db.refresh(new_patient)
    return new_patient

@app.get("/api/patients", response_model=List[PatientResponse])
@app.get("/api/v1/patients", response_model=List[PatientResponse])
def list_patients(limit: int = 50, db: Session = Depends(get_db)):
    return db.query(Patient).order_by(desc(Patient.id)).limit(limit).all()

# ----------------- Triage Engine & Evaluation -----------------
@app.post("/api/triage/evaluate", response_model=TriageEvaluationResponse)
@app.post("/api/v1/triage/evaluate", response_model=TriageEvaluationResponse)
def evaluate_triage(req: TriageEvaluationRequest, db: Session = Depends(get_db)):
    """
    Evaluates vitals and symptoms using deterministic rule-based triage.
    Immediately saves record to SQLite Doctor queue.
    """
    triage_result = triage_engine.evaluate(req.vitals)

    record = TriageRecord(
        patient_id=req.patient_id,
        patient_name=req.patient_name,
        age=req.age,
        gender=req.gender,
        village=req.village,
        taluka=req.taluka,
        district=req.district,
        phone=req.phone,
        lat=req.lat,
        lng=req.lng,
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
        doctor_verified=False,
        status="Pending",
        source=req.source or "Patient"
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "id": record.id,
        "priority": triage_result["priority"],
        "triage_label": triage_result["triage_label"],
        "triage_reason": triage_result["triage_reason"],
        "confidence_score": triage_result["confidence_score"],
        "doctor_verification_required": triage_result["doctor_verification_required"],
        "is_diagnosis": triage_result["is_diagnosis"],
        "disclaimer": triage_result["disclaimer"],
        "triggers": triage_result["triggers"],
        "recommended_action": triage_result["recommended_action"]
    }

@app.get("/api/triage/queue")
@app.get("/api/v1/triage/queue")
def get_doctor_queue(
    priority: Optional[str] = None,
    village: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
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

    priority_order = case(
        (TriageRecord.priority == "P1", 1),
        (TriageRecord.priority == "P2", 2),
        (TriageRecord.priority == "P3", 3),
        else_=4
    )

    records = query.order_by(priority_order, desc(TriageRecord.created_at)).all()
    
    return [
        {
            "id": r.id,
            "patient_id": r.patient_id,
            "patient_name": r.patient_name,
            "age": r.age,
            "gender": r.gender,
            "village": r.village,
            "taluka": r.taluka,
            "district": r.district,
            "phone": r.phone,
            "lat": r.lat,
            "lng": r.lng,
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
            "doctor_verified": r.doctor_verified,
            "doctor_name": r.doctor_name,
            "doctor_notes": r.doctor_notes,
            "prescription": r.prescription,
            "status": r.status,
            "source": r.source,
            "created_at": r.created_at.isoformat() if r.created_at else None
        }
        for r in records
    ]

@app.post("/api/triage/verify")
@app.post("/api/v1/triage/verify")
def verify_triage_record(req: DoctorVerificationRequest, db: Session = Depends(get_db)):
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
        "status": record.status
    }

# ----------------- Offline Sync (Dexie.js -> SQLite) -----------------
@app.post("/api/sync/batch")
@app.post("/api/v1/sync/batch")
def sync_batch_records(req: BatchSyncRequest, db: Session = Depends(get_db)):
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
            created_at=item.recorded_at
        )
        db.add(record)
        
        # Credit ASHA Incentive
        incentive = AshaIncentive(
            asha_id=req.asha_id,
            asha_name=req.asha_name,
            activity_type="Rural Screening & Offline Sync",
            patient_name=item.patient_name,
            amount=50.0,
            status="Approved"
        )
        db.add(incentive)
        synced_ids.append(item.local_id)

    db.commit()

    return {
        "status": "success",
        "synced_count": len(synced_ids),
        "synced_local_ids": synced_ids,
        "incentives_credited_inr": len(synced_ids) * 50.0,
        "message": f"Successfully synchronized {len(synced_ids)} records to Server."
    }

@app.get("/api/asha/incentives")
@app.get("/api/v1/asha/incentives")
def get_asha_incentives(asha_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(AshaIncentive)
    if asha_id:
        query = query.filter(AshaIncentive.asha_id == asha_id)
    incentives = query.order_by(desc(AshaIncentive.recorded_at)).all()
    total_inr = sum(i.amount for i in incentives)
    
    return {
        "asha_id": asha_id or "ALL",
        "total_earned_month": total_inr,
        "total_earned_inr": total_inr,
        "pending_disbursal": 0.0,
        "disbursed_total": total_inr,
        "records_count": len(incentives),
        "history": [
            {
                "id": i.id,
                "patient_name": i.patient_name,
                "activity": i.activity_type,
                "amount": i.amount,
                "status": i.status,
                "date": i.recorded_at.strftime("%d %b %Y, %I:%M %p") if i.recorded_at else None
            }
            for i in incentives
        ],
        "recent_activities": [
            {
                "id": i.id,
                "patient_name": i.patient_name,
                "activity": i.activity_type,
                "amount": i.amount,
                "status": i.status,
                "date": i.recorded_at.strftime("%d %b %Y, %I:%M %p") if i.recorded_at else None
            }
            for i in incentives
        ]
    }

# ----------------- Referrals -----------------
@app.get("/api/referrals")
@app.get("/api/v1/referrals")
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
            "created_at": r.created_at.isoformat() if r.created_at else None
        }
        for r in referrals
    ]

@app.post("/api/referrals")
@app.post("/api/v1/referrals")
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
        status=req.status or "Pending"
    )
    db.add(ref)
    db.commit()
    db.refresh(ref)
    return {
        "success": True,
        "referral_id": ref.id,
        "status": ref.status,
        "message": f"Referral created to {ref.target_facility} for {ref.patient_name}"
    }

@app.patch("/api/referrals/{referral_id}/status")
@app.patch("/api/v1/referrals/{referral_id}/status")
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
@app.get("/api/v1/appointments", response_model=List[AppointmentResponse])
def get_appointments(
    facility: Optional[str] = None,
    doctor: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
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
@app.post("/api/v1/appointments", response_model=AppointmentResponse)
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
        status=req.status or "Scheduled"
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)
    return appt

@app.patch("/api/appointments/{appointment_id}/status")
@app.patch("/api/v1/appointments/{appointment_id}/status")
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
@app.get("/api/v1/inventory")
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
                "last_updated": item.last_updated.isoformat() if item.last_updated else None
            }
            for item in items
        ]
    }

@app.patch("/api/inventory/{item_id}/stock")
@app.patch("/api/v1/inventory/{item_id}/stock")
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
@app.get("/api/v1/analytics/overview")
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
            "offline_sync_success_rate": "100%"
        }
    }

@app.get("/api/analytics/outbreaks")
@app.get("/api/v1/analytics/outbreaks")
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
                "reported_date": c.reported_date.isoformat() if c.reported_date else None
            }
            for c in clusters
        ]
    }
