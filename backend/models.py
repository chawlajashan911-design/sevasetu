from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from .database import Base


# ─────────────────────────────────────────────
# Reference Data Tables (seeded from CSV/JSON)
# ─────────────────────────────────────────────

class Hospital(Base):
    """
    Stores all 4,807 authentic Maharashtra hospitals from hospital_directory.csv.
    Seeded once via backend/migrate_data.py — never written to by the API.
    """
    __tablename__ = "hospitals"

    id = Column(String(50), primary_key=True, index=True)        # e.g. "hosp-1"
    name = Column(String(255), nullable=False, index=True)
    category = Column(String(100), nullable=True)
    care_type = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    district = Column(String(100), nullable=True, index=True)
    subdistrict = Column(String(100), nullable=True, index=True)
    village = Column(String(100), nullable=True)
    pincode = Column(String(20), nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    specialties = Column(Text, nullable=True)
    facilities = Column(Text, nullable=True)
    emergency_services = Column(String(100), nullable=True)
    ambulance = Column(String(50), nullable=True)
    phone = Column(String(100), nullable=True)
    doctors = Column(Integer, nullable=True)
    beds = Column(Integer, nullable=True)
    status = Column(String(50), nullable=True)


class Village(Base):
    """
    Stores all 44,810 authentic Maharashtra villages from maharashtra_villages_website.json.
    Seeded once via backend/migrate_data.py — never written to by the API.
    """
    __tablename__ = "villages"

    id = Column(String(50), primary_key=True, index=True)        # e.g. "v-1"
    name = Column(String(150), nullable=False, index=True)
    district = Column(String(100), nullable=True, index=True)
    taluka = Column(String(100), nullable=True, index=True)
    district_code = Column(String(20), nullable=True)
    taluka_code = Column(String(20), nullable=True)
    status = Column(String(50), nullable=True)


# ─────────────────────────────────────────────
# Dynamic Application Data Tables
# ─────────────────────────────────────────────

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
    differential_diagnosis = Column(Text, nullable=True)
    clinical_reasoning = Column(Text, nullable=True)
    ai_model = Column(String(80), nullable=True, default="Gemini 3.6 Flash + Clinical Rule Guardrail v2.0")

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


class OtpSession(Base):
    __tablename__ = "otp_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(80), unique=True, nullable=False, index=True)
    identifier = Column(String(100), nullable=False, index=True)
    otp_code = Column(String(6), nullable=False)
    role = Column(String(30), default="patient")
    is_verified = Column(Boolean, default=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class TeleconsultRoom(Base):
    __tablename__ = "teleconsult_rooms"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(80), unique=True, index=True, nullable=False)
    room_token = Column(String(100), nullable=True)
    triage_id = Column(Integer, index=True, nullable=True)
    patient_name = Column(String(100), nullable=False)
    doctor_name = Column(String(100), nullable=True)
    priority = Column(String(10), default="P1")
    facility_name = Column(String(100), nullable=True)
    jitsi_url = Column(String(255), nullable=True)
    webrtc_channel = Column(String(100), nullable=True)
    status = Column(String(50), default="WAITING_FOR_DOCTOR")
    created_at = Column(DateTime, default=datetime.utcnow)


class AbhaFieldTask(Base):
    __tablename__ = "abha_field_tasks"

    id = Column(Integer, primary_key=True, index=True)
    patient_name = Column(String(100), nullable=True, default="Citizen Patient")
    phone = Column(String(20), nullable=False, index=True)
    village = Column(String(100), nullable=True, index=True)
    taluka = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)
    reason = Column(String(255), nullable=True, default="Patient Needs ABHA Registration Field Assistance")
    status = Column(String(50), default="Pending Assistance")
    created_at = Column(DateTime, default=datetime.utcnow)


# ─────────────────────────────────────────────
# Phase 1: Hospital Dashboard Models
# ─────────────────────────────────────────────

class HospitalDoctor(Base):
    """
    Hospital-scoped doctor profile with multi-slot availability schedules and active flag.
    Editable only by the hospital; readable by patients.
    """
    __tablename__ = "hospital_doctors"

    id = Column(Integer, primary_key=True, index=True)
    hospital_id = Column(String(100), nullable=False, index=True)
    hospital_name = Column(String(255), nullable=True)
    name = Column(String(150), nullable=False)
    speciality = Column(String(100), nullable=False)
    qualification = Column(String(100), nullable=True)
    experience_years = Column(Integer, nullable=True, default=0)
    phone = Column(String(50), nullable=True)
    # JSON-encoded array of slot dicts: [{"day": "Monday", "start_time": "09:00", "end_time": "13:00"}]
    availability_slots = Column(Text, nullable=True, default="[]")
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class HospitalTest(Base):
    """
    Hospital-scoped diagnostic / laboratory test catalog with prep notes and availability.
    Editable only by the hospital; readable by patients.
    """
    __tablename__ = "hospital_tests"

    id = Column(Integer, primary_key=True, index=True)
    hospital_id = Column(String(100), nullable=False, index=True)
    hospital_name = Column(String(255), nullable=True)
    test_name = Column(String(150), nullable=False)
    category = Column(String(100), nullable=False)  # Pathology, Radiology, Cardiology, etc.
    price = Column(Float, nullable=False, default=0.0)
    prep_notes = Column(Text, nullable=True)
    turnaround_time = Column(String(100), nullable=True)  # e.g., "2 hours", "Same day"
    is_available = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class HospitalPharmacyItem(Base):
    """
    Hospital pharmacy inventory item with auto-derived LOW_STOCK status.
    Status rule: LOW_STOCK when quantity <= reorder_threshold else IN_STOCK.
    Editable only by the hospital; readable by patients.
    """
    __tablename__ = "hospital_pharmacy_items"

    id = Column(Integer, primary_key=True, index=True)
    hospital_id = Column(String(100), nullable=False, index=True)
    hospital_name = Column(String(255), nullable=True)
    medicine_name = Column(String(150), nullable=False)
    generic_name = Column(String(150), nullable=False)
    quantity = Column(Integer, nullable=False, default=0)
    unit = Column(String(50), nullable=False, default="strips")
    reorder_threshold = Column(Integer, nullable=False, default=10)
    status = Column(String(20), nullable=False, default="IN_STOCK")  # "LOW_STOCK" or "IN_STOCK"
    batch_number = Column(String(100), nullable=True)
    expiry_date = Column(String(50), nullable=True)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

