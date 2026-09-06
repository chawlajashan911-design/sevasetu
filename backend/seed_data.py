"""
Seed data module for Kharpudi Village, Ambegaon Taluka, Pune District.
Labels all records clearly as Prototype/Demo Data.
"""

from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from .models import Patient, TriageRecord, Referral, Inventory, OutbreakCluster, AshaIncentive

FACILITIES = [
    {
        "id": "fac-01",
        "name": "Kharpudi Sub-Centre (आरोग्य उपकेंद्र, खरपुडी)",
        "type": "Sub-Centre / Health & Wellness Centre",
        "distance_km": 0.8,
        "village": "Kharpudi",
        "phone": "+91 2133 222101",
        "doctor": "Sister Rekha Kamble (ANM)",
        "status": "Open",
        "coordinates": {"lat": 18.9950, "lng": 73.9520}
    },
    {
        "id": "fac-02",
        "name": "Kharpudi Primary Health Centre (प्राथमिक आरोग्य केंद्र, खरपुडी)",
        "type": "PHC (24x7 Delivery & OPD)",
        "distance_km": 2.5,
        "village": "Kharpudi",
        "phone": "+91 2133 222102",
        "doctor": "Dr. Anand Kulkarni (Medical Officer)",
        "status": "Open (24x7 Emergency)",
        "coordinates": {"lat": 19.0012, "lng": 73.9605}
    },
    {
        "id": "fac-03",
        "name": "Manchar Rural Hospital (ग्रामीण रुग्णालय, मंचर)",
        "type": "Rural Hospital (FRU - First Referral Unit)",
        "distance_km": 12.0,
        "village": "Manchar",
        "phone": "+91 2133 223344",
        "doctor": "Dr. Vaishali Ghadge (Civil Surgeon)",
        "status": "Open (Specialist Care)",
        "coordinates": {"lat": 19.0118, "lng": 73.9388}
    },
    {
        "id": "fac-04",
        "name": "Pune District Hospital (जिल्हा रुग्णालय, औंध, पुणे)",
        "type": "District Multi-Specialty Hospital",
        "distance_km": 65.0,
        "village": "Aundh, Pune",
        "phone": "+91 20 2728 0100",
        "doctor": "Dr. Milind More (District Medical Superintendent)",
        "status": "Open (Tertiary Care)",
        "coordinates": {"lat": 18.5590, "lng": 73.8073}
    }
]

def seed_database(db: Session):
    """Populates initial demo database if empty"""
    if db.query(Inventory).first() is not None:
        return  # Already seeded

    # 1. Seed Patients
    patients = [
        Patient(
            abha_id="14-8832-9012-4412",
            name="Savita Tai Jadhav",
            age=28,
            gender="Female",
            phone="9822104512",
            village="Kharpudi",
            wadi="Gavthan Wadi",
            preferred_language="mr"
        ),
        Patient(
            abha_id="91-2391-7782-9901",
            name="Maruti Baban Shinde",
            age=62,
            gender="Male",
            phone="9422019934",
            village="Kharpudi",
            wadi="Wadarwadi",
            preferred_language="mr"
        ),
        Patient(
            abha_id="45-1029-4451-2281",
            name="Ramesh Dattatray Thorat",
            age=45,
            gender="Male",
            phone="9850123849",
            village="Kharpudi",
            wadi="Mali Mala",
            preferred_language="mr"
        ),
        Patient(
            abha_id="33-9912-4019-1120",
            name="Shantabai Pandurang Gaikwad",
            age=70,
            gender="Female",
            phone="9763190822",
            village="Kharpudi",
            wadi="Gavthan",
            preferred_language="mr"
        )
    ]
    for p in patients:
        db.add(p)
    db.commit()

    # 2. Seed Triage Records
    triage_records = [
        TriageRecord(
            patient_name="Savita Tai Jadhav",
            age=28,
            gender="Female",
            village="Kharpudi",
            phone="9822104512",
            systolic_bp=164.0,
            diastolic_bp=102.0,
            spo2=96.0,
            pulse_rate=98.0,
            temperature=98.6,
            symptom_duration_days=2,
            symptoms="Severe headache, blurred vision, 34 weeks pregnancy (तीव्र डोकेदुखी, चक्कर येणे)",
            high_risk_maternal=True,
            maternal_note="Pre-eclampsia risk: Gestational Hypertension + Visual Disturbances",
            priority="P1",
            triage_reason="Severe Hypertension (BP 164/102 mmHg) | High-Risk Maternal Pre-eclampsia Indicator",
            confidence_score=0.96,
            doctor_verification_required=True,
            doctor_verified=False,
            status="Pending",
            source="ASHA_Offline",
            created_at=datetime.utcnow() - timedelta(minutes=25)
        ),
        TriageRecord(
            patient_name="Maruti Baban Shinde",
            age=62,
            gender="Male",
            village="Kharpudi",
            phone="9422019934",
            systolic_bp=135.0,
            diastolic_bp=86.0,
            spo2=88.0,
            pulse_rate=108.0,
            temperature=99.1,
            symptom_duration_days=2,
            symptoms="Severe breathlessness, chest heaviness, chronic cough (श्वास घेण्यास तीव्र त्रास)",
            high_risk_maternal=False,
            priority="P1",
            triage_reason="Critical Hypoxemia (SpO2 88% <= 90%) | Tachycardia (Pulse 108 bpm)",
            confidence_score=0.98,
            doctor_verification_required=True,
            doctor_verified=False,
            status="Pending",
            source="Patient",
            created_at=datetime.utcnow() - timedelta(minutes=40)
        ),
        TriageRecord(
            patient_name="Ramesh Dattatray Thorat",
            age=45,
            gender="Male",
            village="Kharpudi",
            phone="9850123849",
            systolic_bp=122.0,
            diastolic_bp=78.0,
            spo2=97.0,
            pulse_rate=88.0,
            temperature=102.6,
            symptom_duration_days=4,
            symptoms="High fever with chills for 4 days, body ache (4 दिवसांपासून तीव्र ताप व हुडहुडी)",
            high_risk_maternal=False,
            priority="P2",
            triage_reason="High Grade Pyrexia (102.6°F >= 102.0°F) | Prolonged Illness (4 days > 3 days)",
            confidence_score=0.93,
            doctor_verification_required=True,
            doctor_verified=False,
            status="Pending",
            source="ASHA_Offline",
            created_at=datetime.utcnow() - timedelta(hours=2)
        ),
        TriageRecord(
            patient_name="Shantabai Pandurang Gaikwad",
            age=70,
            gender="Female",
            village="Kharpudi",
            phone="9763190822",
            systolic_bp=128.0,
            diastolic_bp=80.0,
            spo2=98.0,
            pulse_rate=74.0,
            temperature=98.4,
            symptom_duration_days=10,
            symptoms="Mild knee joint stiffness, routine calcium refill (गुडघेदुखी, नियमित तपासणी)",
            high_risk_maternal=False,
            priority="P3",
            triage_reason="Vitals within stable baseline limits. Mild osteoarthritis symptoms.",
            confidence_score=0.91,
            doctor_verification_required=True,
            doctor_verified=True,
            doctor_name="Dr. Anand Kulkarni",
            doctor_notes="Stable osteoarthritis. Prescribed Tab Calcium + Vitamin D3. Follow up in 1 month.",
            status="Verified",
            source="Patient",
            created_at=datetime.utcnow() - timedelta(hours=4)
        )
    ]
    for tr in triage_records:
        db.add(tr)
    db.commit()

    # 3. Seed Inventory with Realistic PHC Medicines
    inventory_items = [
        Inventory(facility_name="Kharpudi PHC", medicine_name="Paracetamol 500mg Tablets", category="Analgesic/Antipyretic", current_stock=1450, min_threshold=300, unit="strips", is_low_stock=False),
        Inventory(facility_name="Kharpudi PHC", medicine_name="Oral Rehydration Salts (ORS)", category="Electrolyte Solution", current_stock=420, min_threshold=100, unit="packets", is_low_stock=False),
        Inventory(facility_name="Kharpudi PHC", medicine_name="Amoxicillin 500mg Capsules", category="Antibiotics", current_stock=65, min_threshold=150, unit="strips", is_low_stock=True),
        Inventory(facility_name="Kharpudi PHC", medicine_name="Iron & Folic Acid (IFA)", category="Maternal Health", current_stock=850, min_threshold=200, unit="strips", is_low_stock=False),
        Inventory(facility_name="Kharpudi PHC", medicine_name="Oxytocin 10 IU Injection", category="Obstetric Critical", current_stock=8, min_threshold=25, unit="ampoules", is_low_stock=True),
        Inventory(facility_name="Kharpudi PHC", medicine_name="Rapid Malaria (Pf/Pv) Antigen Kits", category="Diagnostics", current_stock=18, min_threshold=50, unit="kits", is_low_stock=True),
        Inventory(facility_name="Kharpudi PHC", medicine_name="Metformin 500mg Tablets", category="NCD / Diabetes", current_stock=600, min_threshold=150, unit="strips", is_low_stock=False),
        Inventory(facility_name="Kharpudi PHC", medicine_name="Amlodipine 5mg Tablets", category="NCD / Hypertension", current_stock=520, min_threshold=150, unit="strips", is_low_stock=False),
        Inventory(facility_name="Kharpudi PHC", medicine_name="Zinc Sulfate 20mg Tablets", category="Child Nutrition", current_stock=380, min_threshold=100, unit="strips", is_low_stock=False),
        Inventory(facility_name="Kharpudi PHC", medicine_name="Tetanus Toxoid (TT) Vaccine", category="Immunization", current_stock=45, min_threshold=20, unit="vials", is_low_stock=False)
    ]
    for item in inventory_items:
        db.add(item)
    db.commit()

    # 4. Seed Referrals
    referrals = [
        Referral(
            triage_id=1,
            patient_name="Savita Tai Jadhav",
            age=28,
            priority="P1",
            source_facility="Kharpudi PHC",
            target_facility="Manchar Rural Hospital (SNCU/FRU)",
            urgency="Immediate (< 1 Hour)",
            reason="High-risk pregnancy with pre-eclampsia, BP 164/102 mmHg requiring specialist obstetric care.",
            transport_mode="108 Emergency Ambulance",
            status="En Route",
            created_at=datetime.utcnow() - timedelta(minutes=15)
        ),
        Referral(
            triage_id=2,
            patient_name="Maruti Baban Shinde",
            age=62,
            priority="P1",
            source_facility="Kharpudi Sub-Centre",
            target_facility="Kharpudi Primary Health Centre",
            urgency="Immediate Oxygen Support",
            reason="Acute SpO2 desaturation (88%) requiring nebulization and high-flow oxygen.",
            transport_mode="108 Ambulance",
            status="Referred",
            created_at=datetime.utcnow() - timedelta(minutes=30)
        )
    ]
    for ref in referrals:
        db.add(ref)
    db.commit()

    # 5. Seed Outbreak Clusters
    outbreaks = [
        OutbreakCluster(
            village_name="Kharpudi",
            wadi_location="Wadarwadi Cluster",
            disease_type="Acute Gastroenteritis / Diarrhea",
            active_cases=8,
            risk_level="Medium",
            reported_date=datetime.utcnow() - timedelta(days=1)
        ),
        OutbreakCluster(
            village_name="Landewadi (Adjacent)",
            wadi_location="Mala Vasti",
            disease_type="Suspected Dengue / Viral Pyrexia",
            active_cases=14,
            risk_level="High",
            reported_date=datetime.utcnow() - timedelta(days=2)
        ),
        OutbreakCluster(
            village_name="Manchar Phata",
            wadi_location="Bajar Tal",
            disease_type="Suspected Typhoid (Water Contamination)",
            active_cases=4,
            risk_level="Low",
            reported_date=datetime.utcnow() - timedelta(days=3)
        )
    ]
    for ob in outbreaks:
        db.add(ob)
    db.commit()

    # 6. Seed ASHA Incentives
    incentives = [
        AshaIncentive(
            asha_id="ASHA_KHARPUDI_01",
            asha_name="Sunita Tai Shinde",
            activity_type="Antenatal High-Risk Screening (P1 Alert)",
            patient_name="Savita Tai Jadhav",
            amount=300.0,
            status="Approved"
        ),
        AshaIncentive(
            asha_id="ASHA_KHARPUDI_01",
            asha_name="Sunita Tai Shinde",
            activity_type="Emergency Vitals Screening & Referral Tracking",
            patient_name="Maruti Baban Shinde",
            amount=150.0,
            status="Approved"
        ),
        AshaIncentive(
            asha_id="ASHA_KHARPUDI_01",
            asha_name="Sunita Tai Shinde",
            activity_type="Routine Child Immunization Follow-up",
            patient_name="Baby of Anita Kale",
            amount=200.0,
            status="Disbursed"
        ),
        AshaIncentive(
            asha_id="ASHA_KHARPUDI_01",
            asha_name="Sunita Tai Shinde",
            activity_type="Elderly NCD Screening Check",
            patient_name="Shantabai Gaikwad",
            amount=100.0,
            status="Approved"
        )
    ]
    for inc in incentives:
        db.add(inc)
    db.commit()
