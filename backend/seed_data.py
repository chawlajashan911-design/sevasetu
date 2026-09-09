"""
Database initialization and clean seed data module for SevaSetu.
Maintains ONE authentic reference patient (Kharpudi PHC test profile)
for instant reviewer verification, while enabling full dynamic registration
for any user/phone entered.
"""

from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from .models import Patient, TriageRecord, Inventory, Referral, Appointment, OutbreakCluster, AshaIncentive, OtpSession

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
    for model in (OtpSession, AshaIncentive, OutbreakCluster, Appointment, Referral, TriageRecord, Patient, Inventory):
        db.query(model).delete()
    db.commit()
    seed_database(db)


def seed_demo_data(db: Session):
    """Create a coherent reviewer dataset shared by every portal."""
    reset_dynamic_data(db)
    now = datetime.utcnow()
    patients = [
        Patient(name="Sunita Patil", age=28, gender="Female", phone="9822104512", abha_id="14-8832-9012-4412", village="Kharpudi", taluka="Khed", district="Pune"),
        Patient(name="Ananda Shinde", age=54, gender="Male", phone="9822334455", abha_id="14-2391-8842-1055", village="Shirasgaon", taluka="Khed", district="Pune"),
        Patient(name="Meena Jadhav", age=42, gender="Female", phone="9822445566", village="Ambegaon", taluka="Ambegaon", district="Pune"),
    ]
    db.add_all(patients)
    db.flush()
    triage = [
        TriageRecord(patient_id=patients[0].id, patient_name="Sunita Patil", age=28, gender="Female", phone=patients[0].phone, village="Kharpudi", taluka="Khed", district="Pune", systolic_bp=165, diastolic_bp=105, spo2=88, pulse_rate=112, temperature=101.4, symptom_duration_days=2, symptoms="Breathlessness and severe chest heaviness", high_risk_maternal=True, priority="P1", triage_reason="Critical hypoxemia and severe hypertension", confidence_score=.98, status="Pending", source="Patient"),
        TriageRecord(patient_id=patients[1].id, patient_name="Ananda Shinde", age=54, gender="Male", phone=patients[1].phone, village="Shirasgaon", taluka="Khed", district="Pune", systolic_bp=148, diastolic_bp=92, spo2=95, pulse_rate=88, temperature=102.2, symptom_duration_days=4, symptoms="Fever and body ache", priority="P2", triage_reason="High fever with prolonged symptoms", confidence_score=.93, status="Verified", doctor_verified=True, doctor_name="Dr. Deshmukh", doctor_notes="Hydration and review", source="ASHA_Online"),
        TriageRecord(patient_id=patients[2].id, patient_name="Meena Jadhav", age=42, gender="Female", phone=patients[2].phone, village="Ambegaon", taluka="Ambegaon", district="Pune", systolic_bp=126, diastolic_bp=80, spo2=98, pulse_rate=76, temperature=98.6, symptom_duration_days=1, symptoms="Routine blood pressure check", priority="P3", triage_reason="Vitals within stable baseline limits", confidence_score=.91, status="Completed", doctor_verified=True, source="Clinic"),
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
    db.commit()
