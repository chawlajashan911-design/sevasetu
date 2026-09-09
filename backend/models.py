from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from .database import Base

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    abha_id = Column(String(50), unique=True, index=True, nullable=True)
    name = Column(String(100), nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String(20), nullable=False)
    phone = Column(String(20), nullable=False)
    village = Column(String(100), nullable=True)
    taluka = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)
    wadi = Column(String(100), nullable=True)
    preferred_language = Column(String(20), default="mr")  # mr, hi, en
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class TriageRecord(Base):
    __tablename__ = "triage_records"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, index=True, nullable=True)
    patient_name = Column(String(100), nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String(20), nullable=False)
    village = Column(String(100), nullable=True)
    taluka = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    
    # Vitals
    systolic_bp = Column(Float, nullable=True)
    diastolic_bp = Column(Float, nullable=True)
    spo2 = Column(Float, nullable=True)
    pulse_rate = Column(Float, nullable=True)
    temperature = Column(Float, nullable=True)  # in Fahrenheit
    symptom_duration_days = Column(Integer, default=1)
    symptoms = Column(Text, nullable=True)
    high_risk_maternal = Column(Boolean, default=False)
    maternal_note = Column(String(255), nullable=True)
    
    # AI Triage outputs
    priority = Column(String(10), nullable=False)  # P1, P2, P3
    triage_reason = Column(Text, nullable=False)
    confidence_score = Column(Float, default=0.95)
    doctor_verification_required = Column(Boolean, default=True)
    
    # Doctor review
    doctor_verified = Column(Boolean, default=False)
    doctor_name = Column(String(100), nullable=True)
    doctor_notes = Column(Text, nullable=True)
    prescription = Column(Text, nullable=True)
    status = Column(String(30), default="Pending")  # Pending, Verified, Referred, Completed
    
    source = Column(String(30), default="Patient")  # Patient, ASHA_Offline, ASHA_Online
    created_at = Column(DateTime, default=datetime.utcnow)

class Referral(Base):
    __tablename__ = "referrals"

    id = Column(Integer, primary_key=True, index=True)
    triage_id = Column(Integer, index=True, nullable=True)
    patient_name = Column(String(100), nullable=False)
    age = Column(Integer, nullable=False)
    priority = Column(String(10), nullable=False)  # P1, P2, P3
    source_facility = Column(String(100), nullable=True)
    target_facility = Column(String(100), nullable=False)
    urgency = Column(String(30), default="Immediate")
    reason = Column(Text, nullable=False)
    transport_mode = Column(String(50), default="108 Emergency Ambulance")
    status = Column(String(30), default="Pending")  # Pending, Accepted, Patient Arrived, Completed, Follow-up
    created_at = Column(DateTime, default=datetime.utcnow)

class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    patient_name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    age = Column(Integer, nullable=True)
    gender = Column(String(20), nullable=True)
    facility_name = Column(String(100), nullable=False)
    doctor_name = Column(String(100), nullable=True)
    appointment_date = Column(String(50), nullable=False)
    time_slot = Column(String(50), nullable=False)
    reason = Column(Text, nullable=True)
    priority = Column(String(10), default="P3")
    status = Column(String(30), default="Scheduled")  # Scheduled, Waiting, In-Consultation, Completed, Cancelled
    created_at = Column(DateTime, default=datetime.utcnow)

class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    facility_name = Column(String(100), nullable=False)
    medicine_name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False)
    current_stock = Column(Integer, nullable=False)
    min_threshold = Column(Integer, nullable=False)
    unit = Column(String(30), default="strips")
    is_low_stock = Column(Boolean, default=False)
    last_updated = Column(DateTime, default=datetime.utcnow)

class OutbreakCluster(Base):
    __tablename__ = "outbreak_clusters"

    id = Column(Integer, primary_key=True, index=True)
    village_name = Column(String(100), nullable=False)
    wadi_location = Column(String(100), nullable=False)
    disease_type = Column(String(100), nullable=False)
    active_cases = Column(Integer, default=1)
    risk_level = Column(String(20), default="Medium")  # Low, Medium, High
    reported_date = Column(DateTime, default=datetime.utcnow)

class AshaIncentive(Base):
    __tablename__ = "asha_incentives"

    id = Column(Integer, primary_key=True, index=True)
    asha_id = Column(String(50), nullable=False)
    asha_name = Column(String(100), nullable=False)
    activity_type = Column(String(100), nullable=False)
    patient_name = Column(String(100), nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(String(30), default="Approved")  # Pending, Approved, Disbursed
    recorded_at = Column(DateTime, default=datetime.utcnow)

class TeleconsultRoom(Base):
    __tablename__ = "teleconsult_rooms"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), unique=True, index=True, nullable=False)
    room_token = Column(String(100), nullable=False)
    triage_id = Column(Integer, nullable=True)
    patient_name = Column(String(100), nullable=False)
    doctor_name = Column(String(100), default="Duty Medical Officer")
    priority = Column(String(10), default="P1")
    facility_name = Column(String(100), default="Healthcare Centre")
    jitsi_url = Column(String(255), nullable=True)
    webrtc_channel = Column(String(100), nullable=True)
    status = Column(String(30), default="WAITING_FOR_DOCTOR")
    created_at = Column(DateTime, default=datetime.utcnow)

class OtpSession(Base):
    __tablename__ = "otp_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), unique=True, index=True, nullable=False)
    identifier = Column(String(100), nullable=False)  # Phone number or ABHA address
    otp_code = Column(String(10), nullable=False)
    role = Column(String(30), default="patient")
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class AbhaFieldTask(Base):
    __tablename__ = "abha_field_tasks"

    id = Column(Integer, primary_key=True, index=True)
    patient_name = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=False)
    village = Column(String(100), default="Kharpudi")
    taluka = Column(String(100), default="Khed")
    district = Column(String(100), default="Pune")
    reason = Column(String(255), default="Patient Needs ABHA Registration Field Assistance")
    status = Column(String(30), default="Pending Assistance")  # Pending Assistance, Completed
    created_at = Column(DateTime, default=datetime.utcnow)

