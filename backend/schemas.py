from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class VitalsInput(BaseModel):
    systolic_bp: Optional[float] = None
    diastolic_bp: Optional[float] = None
    spo2: Optional[float] = None
    pulse_rate: Optional[float] = None
    temperature: Optional[float] = None  # °F
    symptom_duration_days: Optional[int] = 1
    symptoms: Optional[str] = None
    high_risk_maternal: Optional[bool] = False
    maternal_note: Optional[str] = None

class PatientCreate(BaseModel):
    name: str
    age: int
    gender: str
    phone: str
    village: Optional[str] = None
    taluka: Optional[str] = None
    district: Optional[str] = None
    wadi: Optional[str] = None
    preferred_language: Optional[str] = "mr"
    abha_id: Optional[str] = None

class PatientResponse(PatientCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class TriageEvaluationRequest(BaseModel):
    patient_id: Optional[int] = None
    patient_name: str
    age: int
    gender: str
    phone: Optional[str] = None
    village: Optional[str] = None
    taluka: Optional[str] = None
    district: Optional[str] = None
    vitals: VitalsInput
    source: Optional[str] = "Patient"

class TriageEvaluationResponse(BaseModel):
    id: Optional[int] = None
    priority: str  # P1, P2, P3
    triage_label: str  # "P1 Critical", "P2 Urgent", "P3 Routine"
    triage_reason: str
    confidence_score: float
    doctor_verification_required: bool
    is_diagnosis: bool = False
    disclaimer: str = "This is an AI triage priority score, NOT a medical diagnosis. Doctor verification required."
    triggers: List[str] = []
    recommended_action: str

class DoctorVerificationRequest(BaseModel):
    triage_id: int
    doctor_name: str
    verified_priority: str
    doctor_notes: Optional[str] = None
    prescription: Optional[str] = None
    action: str = "Verify"  # Verify, Refer, Complete

class ReferralCreate(BaseModel):
    triage_id: Optional[int] = None
    patient_name: str
    age: int
    priority: str
    source_facility: Optional[str] = None
    target_facility: str
    urgency: str = "Immediate"
    reason: str
    transport_mode: str = "108 Emergency Ambulance"
    status: Optional[str] = "Pending"

class AppointmentCreate(BaseModel):
    patient_name: str
    phone: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    facility_name: str
    doctor_name: Optional[str] = None
    appointment_date: str
    time_slot: str
    reason: Optional[str] = "OPD Consultation"
    priority: Optional[str] = "P3"
    status: Optional[str] = "Scheduled"

class AppointmentResponse(AppointmentCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class AppointmentStatusUpdate(BaseModel):
    status: str

class BatchSyncItem(BaseModel):
    local_id: str
    patient_name: str
    age: int
    gender: str
    phone: Optional[str] = None
    village: Optional[str] = None
    vitals: VitalsInput
    priority: str
    triage_reason: str
    recorded_at: datetime
    source: str = "ASHA_Offline"

class BatchSyncRequest(BaseModel):
    asha_id: str
    asha_name: str
    records: List[BatchSyncItem]

class InventoryUpdate(BaseModel):
    id: int
    current_stock: int
