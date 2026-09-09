import os
from datetime import datetime
from typing import List, Optional

from dotenv import load_dotenv
load_dotenv()  # Load .env for local development

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc, case, or_, func

from .database import engine, Base, get_db
from .models import (
    Patient, TriageRecord, Referral, Appointment,
    Inventory, OutbreakCluster, AshaIncentive, Village
)
from .schemas import (
    PatientCreate, PatientResponse,
    TriageEvaluationRequest, TriageEvaluationResponse,
    DoctorVerificationRequest, ReferralCreate,
    AppointmentCreate, AppointmentResponse, AppointmentStatusUpdate,
    BatchSyncRequest, InventoryUpdate, VitalsInput
)
from .triage_engine import triage_engine
from .mock_services import BhashiniService, AbdmFhirService, ESanjeevaniService
from .seed_data import seed_database, FACILITIES
from .hospital_loader import hospital_directory

# Initialize DB tables (creates any missing tables — idempotent on Supabase)
Base.metadata.create_all(bind=engine)

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


# ----------------- Root & Health -----------------
@app.get("/")
def read_root(db: Session = Depends(get_db)):
    villages_count = db.query(func.count(Village.id)).scalar() or 0
    hospitals_count = len(hospital_directory.hospitals)
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
    villages_count = db.query(func.count(Village.id)).scalar() or 0
    hospitals_count = len(hospital_directory.hospitals)
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
    Fast search across authentic 44,810 Maharashtra villages stored in Supabase.
    Returns matching village records with district/taluka info.
    """
    query_str = q.strip()
    if not query_str:
        return []

    db_query = db.query(Village)

    if district:
        db_query = db_query.filter(func.lower(Village.district) == district.lower())
    if taluka:
        db_query = db_query.filter(func.lower(Village.taluka) == taluka.lower())

    # Prefix matches first, then substring — union via Python for ordering
    prefix_results = (
        db_query.filter(Village.name.ilike(f'{query_str}%'))
        .limit(limit)
        .all()
    )
    prefix_ids = {v.id for v in prefix_results}

    substr_results = (
        db_query.filter(
            or_(
                Village.name.ilike(f'%{query_str}%'),
                Village.taluka.ilike(f'%{query_str}%'),
                Village.district.ilike(f'%{query_str}%'),
            ),
            Village.id.notin_(prefix_ids),
        )
        .limit(limit)
        .all()
    )

    combined = prefix_results + substr_results
    return [
        {
            "id": v.id,
            "name": v.name,
            "district": v.district,
            "taluka": v.taluka,
            "districtCode": v.district_code,
            "talukaCode": v.taluka_code,
            "status": v.status,
        }
        for v in combined[:limit]
    ]


@app.get("/api/districts")
def list_districts(db: Session = Depends(get_db)):
    """Returns unique list of Maharashtra districts from Supabase villages table."""
    rows = db.query(Village.district).distinct().order_by(Village.district).all()
    return [r[0] for r in rows if r[0]]


@app.get("/api/talukas")
def list_talukas(district: Optional[str] = None, db: Session = Depends(get_db)):
    """Returns talukas for a given district (or all talukas) from Supabase."""
    q = db.query(Village.taluka).distinct()
    if district:
        q = q.filter(func.lower(Village.district) == district.lower())
    rows = q.order_by(Village.taluka).all()
    return [r[0] for r in rows if r[0]]


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
    Evaluates vitals and symptoms using deterministic rule-based triage.
    Saves record to Doctor queue automatically.
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
        "recommended_action": triage_result["recommended_action"],
    }


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
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in records
    ]


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


# ----------------- Mock Services Endpoints -----------------
@app.post("/api/mock/bhashini/translate")
def translate_bhashini(payload: dict):
    text = payload.get("text", "")
    source_lang = payload.get("source_lang", "mr")
    target_lang = payload.get("target_lang", "en")
    return BhashiniService.translate_text(text, source_lang, target_lang)


@app.post("/api/mock/bhashini/asr")
def asr_bhashini(payload: dict):
    duration = payload.get("duration", 2.5)
    lang = payload.get("language", "mr")
    return BhashiniService.process_voice_asr(duration, lang)


@app.post("/api/mock/abdm/generate-abha")
def generate_abha(payload: dict):
    name = payload.get("name", "Patient")
    phone = payload.get("phone", "9800000000")
    return AbdmFhirService.generate_abha_id(name, phone)


@app.post("/api/mock/esanjeevani/create-session")
def create_esanjeevani_session(payload: dict):
    patient_name = payload.get("patient_name", "Patient")
    priority = payload.get("priority", "P1")
    facility_name = payload.get("facility_name", "Healthcare Centre")
    return ESanjeevaniService.create_teleconsult_session(patient_name, priority, facility_name)
