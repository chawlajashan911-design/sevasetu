import os
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import desc, case

from .database import engine, Base, get_db
from .models import Patient, TriageRecord, Referral, Inventory, OutbreakCluster, AshaIncentive
from .schemas import (
    PatientCreate, PatientResponse,
    TriageEvaluationRequest, TriageEvaluationResponse,
    DoctorVerificationRequest, ReferralCreate,
    BatchSyncRequest, InventoryUpdate, VitalsInput
)
from .triage_engine import triage_engine
from .mock_services import BhashiniService, AbdmFhirService, ESanjeevaniService
from .seed_data import seed_database, FACILITIES

# Initialize DB tables
Base.metadata.create_all(bind=engine)

# Seed demo data
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
def read_root():
    return {
        "system": "SevaSetu Rural Healthcare AI System",
        "facility": "Kharpudi PHC, Ambegaon, Pune",
        "status": "Operational",
        "engine": "Clinical Rule-Based Triage Engine v1.2",
        "mode": "Live Grid"
    }

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "database": "connected"
    }

# ----------------- Facilities -----------------
@app.get("/api/facilities")
def get_facilities(lat: Optional[float] = None, lng: Optional[float] = None):
    """Returns local healthcare facilities around Kharpudi village with distance estimates"""
    return {
        "village": "Kharpudi, Ambegaon, Pune",
        "facilities": FACILITIES
    }

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
        village=patient_in.village or "Kharpudi",
        wadi=patient_in.wadi or "Gaothan",
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

    # Save to database
    record = TriageRecord(
        patient_id=req.patient_id,
        patient_name=req.patient_name,
        age=req.age,
        gender=req.gender,
        village=req.village or "Kharpudi",
        phone=req.phone,
        systolic_bp=req.vitals.systolic_bp,
        diastolic_bp=req.vitals.diastolic_bp,
        spo2=req.vitals.spo2,
        pulse_rate=req.vitals.pulse_rate,
        temperature=req.vitals.temperature,
        symptom_duration_days=req.vitals.symptom_duration_days or 1,
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

    return TriageEvaluationResponse(
        id=record.id,
        priority=triage_result["priority"],
        triage_label=triage_result["triage_label"],
        triage_reason=triage_result["triage_reason"],
        confidence_score=triage_result["confidence_score"],
        doctor_verification_required=triage_result["doctor_verification_required"],
        triggers=triage_result["triggers"],
        recommended_action=triage_result["recommended_action"]
    )

@app.get("/api/triage/queue")
def get_doctor_queue(status: Optional[str] = None, priority: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Returns triage queue sorted strictly by priority (P1 first, then P2, then P3), then created_at desc.
    """
    # Priority ordering expression: P1 -> 1, P2 -> 2, P3 -> 3
    priority_order = case(
        (TriageRecord.priority == "P1", 1),
        (TriageRecord.priority == "P2", 2),
        (TriageRecord.priority == "P3", 3),
        else_=4
    )

    query = db.query(TriageRecord)
    if status and status != "All":
        query = query.filter(TriageRecord.status == status)
    if priority and priority != "All":
        query = query.filter(TriageRecord.priority == priority)

    records = query.order_by(priority_order, desc(TriageRecord.created_at)).all()

    # Formatted response
    return [
        {
            "id": r.id,
            "patient_name": r.patient_name,
            "age": r.age,
            "gender": r.gender,
            "village": r.village,
            "phone": r.phone,
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
            "vitals": {
                "systolic_bp": r.systolic_bp,
                "diastolic_bp": r.diastolic_bp,
                "spo2": r.spo2,
                "pulse_rate": r.pulse_rate,
                "temperature": r.temperature,
                "symptom_duration_days": r.symptom_duration_days,
                "symptoms": r.symptoms,
                "high_risk_maternal": r.high_risk_maternal,
                "maternal_note": r.maternal_note
            }
        }
        for r in records
    ]

@app.get("/api/triage/{triage_id}")
def get_triage_detail(triage_id: int, db: Session = Depends(get_db)):
    record = db.query(TriageRecord).filter(TriageRecord.id == triage_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Triage record not found")
    
    # Generate FHIR bundle on the fly
    fhir_bundle = AbdmFhirService.export_fhir_r4_bundle(
        patient={"id": record.patient_id, "name": record.patient_name, "phone": record.phone, "village": record.village},
        vitals={"systolic_bp": record.systolic_bp, "spo2": record.spo2, "temperature": record.temperature},
        triage_result={"priority": record.priority, "triage_label": f"{record.priority} Priority", "triage_reason": record.triage_reason}
    )

    return {
        "record": {
            "id": record.id,
            "patient_name": record.patient_name,
            "age": record.age,
            "gender": record.gender,
            "village": record.village,
            "phone": record.phone,
            "priority": record.priority,
            "triage_reason": record.triage_reason,
            "confidence_score": record.confidence_score,
            "doctor_verified": record.doctor_verified,
            "doctor_name": record.doctor_name,
            "doctor_notes": record.doctor_notes,
            "prescription": record.prescription,
            "status": record.status,
            "source": record.source,
            "created_at": record.created_at.isoformat() if record.created_at else None,
            "vitals": {
                "systolic_bp": record.systolic_bp,
                "diastolic_bp": record.diastolic_bp,
                "spo2": record.spo2,
                "pulse_rate": record.pulse_rate,
                "temperature": record.temperature,
                "symptom_duration_days": record.symptom_duration_days,
                "symptoms": record.symptoms,
                "high_risk_maternal": record.high_risk_maternal,
                "maternal_note": record.maternal_note
            }
        },
        "fhir_r4_bundle": fhir_bundle
    }

@app.post("/api/triage/verify")
def verify_doctor_triage(req: DoctorVerificationRequest, db: Session = Depends(get_db)):
    record = db.query(TriageRecord).filter(TriageRecord.id == req.triage_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Triage record not found")

    record.doctor_verified = True
    record.doctor_name = req.doctor_name
    record.priority = req.verified_priority
    record.doctor_notes = req.doctor_notes
    record.prescription = req.prescription
    record.status = "Verified" if req.action != "Refer" else "Referred"

    # If action is refer, auto-create a referral record
    if req.action == "Refer":
        referral = Referral(
            triage_id=record.id,
            patient_name=record.patient_name,
            age=record.age,
            priority=record.priority,
            source_facility="Kharpudi PHC",
            target_facility="Manchar Rural Hospital (FRU)",
            urgency="Immediate" if record.priority == "P1" else "Priority Routine",
            reason=req.doctor_notes or "Doctor referred for specialist evaluation",
            transport_mode="108 Emergency Ambulance" if record.priority == "P1" else "PHC Van/Self",
            status="Referred"
        )
        db.add(referral)

    db.commit()
    db.refresh(record)

    return {
        "success": True,
        "message": f"Case #{record.id} verified by {req.doctor_name}",
        "status": record.status,
        "verified_priority": record.priority
    }

# ----------------- ASHA Batch Sync -----------------
@app.post("/api/sync/batch")
def sync_offline_records(batch: BatchSyncRequest, db: Session = Depends(get_db)):
    """
    Receives batch of offline patient triage records captured by ASHA worker on Dexie.js
    Persists them into central database and logs ASHA incentives.
    """
    synced_ids = []
    earned_total = 0.0

    for item in batch.records:
        # 1. Run AI triage to confirm priority and consistency
        triage_result = triage_engine.evaluate(item.vitals)

        record = TriageRecord(
            patient_name=item.patient_name,
            age=item.age,
            gender=item.gender,
            village=item.village or "Kharpudi",
            phone=item.phone,
            systolic_bp=item.vitals.systolic_bp,
            diastolic_bp=item.vitals.diastolic_bp,
            spo2=item.vitals.spo2,
            pulse_rate=item.vitals.pulse_rate,
            temperature=item.vitals.temperature,
            symptom_duration_days=item.vitals.symptom_duration_days or 1,
            symptoms=item.vitals.symptoms,
            high_risk_maternal=item.vitals.high_risk_maternal or False,
            maternal_note=item.vitals.maternal_note,
            priority=triage_result["priority"],
            triage_reason=triage_result["triage_reason"],
            confidence_score=triage_result["confidence_score"],
            doctor_verification_required=True,
            doctor_verified=False,
            status="Pending",
            source="ASHA_Offline",
            created_at=item.recorded_at
        )
        db.add(record)
        
        # 2. Add ASHA Incentive claim
        inc_amount = 300.0 if item.vitals.high_risk_maternal else (150.0 if triage_result["priority"] == "P1" else 100.0)
        earned_total += inc_amount
        
        incentive = AshaIncentive(
            asha_id=batch.asha_id,
            asha_name=batch.asha_name,
            activity_type=f"Offline Screening & Triage ({triage_result['priority']})",
            patient_name=item.patient_name,
            amount=inc_amount,
            status="Approved"
        )
        db.add(incentive)
        synced_ids.append(item.local_id)

    db.commit()

    return {
        "success": True,
        "synced_count": len(synced_ids),
        "synced_local_ids": synced_ids,
        "incentives_credited_inr": earned_total,
        "message": f"Successfully synchronized {len(synced_ids)} records to Kharpudi PHC Server."
    }

@app.get("/api/asha/incentives")
def get_asha_incentives(asha_id: str = "ASHA_KHARPUDI_01", db: Session = Depends(get_db)):
    incentives = db.query(AshaIncentive).filter(AshaIncentive.asha_id == asha_id).order_by(desc(AshaIncentive.recorded_at)).all()
    total_approved = sum(i.amount for i in incentives if i.status == "Approved")
    total_disbursed = sum(i.amount for i in incentives if i.status == "Disbursed")
    
    return {
        "asha_id": asha_id,
        "asha_name": "Sunita Tai Shinde",
        "total_earned_month": total_approved + total_disbursed,
        "pending_disbursal": total_approved,
        "disbursed_total": total_disbursed,
        "recent_activities": [
            {
                "id": inc.id,
                "activity_type": inc.activity_type,
                "patient_name": inc.patient_name,
                "amount": inc.amount,
                "status": inc.status,
                "recorded_at": inc.recorded_at.isoformat() if inc.recorded_at else None
            }
            for inc in incentives
        ]
    }

# ----------------- Referrals -----------------
@app.get("/api/referrals")
def get_referrals(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Referral)
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
def create_referral(req: ReferralCreate, db: Session = Depends(get_db)):
    ref = Referral(
        triage_id=req.triage_id,
        patient_name=req.patient_name,
        age=req.age,
        priority=req.priority,
        source_facility=req.source_facility,
        target_facility=req.target_facility,
        urgency=req.urgency,
        reason=req.reason,
        transport_mode=req.transport_mode,
        status="Referred"
    )
    db.add(ref)
    db.commit()
    db.refresh(ref)
    return {
        "success": True,
        "referral_id": ref.id,
        "message": f"Referral created to {ref.target_facility} for {ref.patient_name}"
    }

@app.patch("/api/referrals/{referral_id}/status")
def update_referral_status(referral_id: int, new_status: str, db: Session = Depends(get_db)):
    ref = db.query(Referral).filter(Referral.id == referral_id).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Referral not found")
    ref.status = new_status
    db.commit()
    return {"success": True, "id": ref.id, "new_status": ref.status}

# ----------------- Inventory & Stock -----------------
@app.get("/api/inventory")
def get_inventory(facility: str = "Kharpudi PHC", db: Session = Depends(get_db)):
    items = db.query(Inventory).filter(Inventory.facility_name == facility).all()
    # Recalculate is_low_stock dynamically
    for item in items:
        item.is_low_stock = item.current_stock < item.min_threshold
    db.commit()
    
    low_stock_count = sum(1 for item in items if item.is_low_stock)

    return {
        "facility": facility,
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
    active_referrals = db.query(Referral).filter(Referral.status.in_(["Referred", "En Route"])).count()
    completed_referrals = db.query(Referral).filter(Referral.status == "Completed").count()
    low_stock_medicines = db.query(Inventory).filter(Inventory.is_low_stock == True).count()

    return {
        "district": "Pune (Ambegaon Taluka)",
        "primary_village": "Kharpudi",
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
def get_outbreak_heatmap(db: Session = Depends(get_db)):
    clusters = db.query(OutbreakCluster).all()
    return {
        "taluka": "Ambegaon, Pune",
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
    return ESanjeevaniService.create_teleconsult_session(patient_name, priority)
