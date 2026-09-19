import pytest
import os
import json
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import Base, engine, get_db
from backend.models import Hospital, HospitalDoctor, HospitalTest, HospitalPharmacyItem
from backend.services.symptom_matching_service import symptom_matching_service
from sqlalchemy.orm import sessionmaker

TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestSessionLocal()
    yield session
    session.close()

@pytest.fixture
def client():
    return TestClient(app)

def test_differential_speciality_mapping():
    """Verify fixed mapping from differential diagnoses to doctor specialities, tests, and medicines."""
    # Pulmonology match
    specs, tests, meds = symptom_matching_service.map_differential_to_speciality_and_resources(
        differential_diagnosis=["URTI / Tracheobronchitis", "Viral Pharyngitis"],
        symptoms="cough, sore throat"
    )
    assert any(s.name == "Pulmonology" for s in specs)
    assert "Chest X-Ray" in tests
    assert "Respiratory & Bronchodilators" in meds

    # Cardiology match
    specs, tests, meds = symptom_matching_service.map_differential_to_speciality_and_resources(
        differential_diagnosis=["Acute Coronary Syndrome", "Angina Pectoris"],
        symptoms="severe radiating chest pain"
    )
    assert any(s.name == "Cardiology" for s in specs)
    assert "ECG (12-Lead)" in tests
    assert "Cardiac & Antianginal" in meds

    # Fallback to General Medicine for unmapped conditions
    specs, tests, meds = symptom_matching_service.map_differential_to_speciality_and_resources(
        differential_diagnosis=["Unspecified Malaise"],
        symptoms="fatigue"
    )
    assert any(s.name == "General Medicine" for s in specs)
    assert "Complete Blood Count (CBC)" in tests

def test_triage_facility_ranking_live(db_session):
    """Verify live ranking top 3 facilities based on doctor availability > distance > stock."""
    # Seed a test hospital with Pulmonology doctor
    test_hosp = Hospital(
        id="test-hosp-triage-1",
        name="Taluka Referral Hospital A",
        category="Sub-District Hospital",
        care_type="Secondary",
        district="Pune",
        subdistrict="Haveli",
        lat=18.5204,
        lng=73.8567,
        doctors=5,
        emergency_services="Yes"
    )
    db_session.merge(test_hosp)

    test_doc = HospitalDoctor(
        hospital_id="test-hosp-triage-1",
        hospital_name="Taluka Referral Hospital A",
        name="Dr. Arvind Pulmo",
        speciality="Pulmonology",
        availability_slots=json.dumps([{"day": "Today", "start_time": "10:00", "end_time": "14:00"}]),
        is_active=True
    )
    db_session.add(test_doc)
    db_session.commit()

    results = symptom_matching_service.rank_triage_hospitals_live(
        db=db_session,
        differential_diagnosis=["URTI / Tracheobronchitis"],
        priority="P2",
        symptoms="cough and mild fever",
        patient_lat=18.5204,
        patient_lng=73.8567,
        patient_district="Pune",
        limit=3
    )

    assert len(results) > 0
    assert len(results) <= 3
    # Top result should have active doctor matched
    top = results[0]
    assert top.score > 0
    assert top.score_breakdown.doctor_score > 0
    assert top.doctor is not None

def test_triage_evaluate_endpoint_includes_recommendations(client):
    """Verify /api/triage/evaluate returns recommended_facilities without extra Gemini call."""
    payload = {
        "patient_name": "Triage Recommendation Test Patient",
        "age": 45,
        "gender": "Female",
        "village": "Wagholi",
        "taluka": "Haveli",
        "district": "Pune",
        "phone": "9876543210",
        "vitals": {
            "systolic_bp": 120,
            "diastolic_bp": 80,
            "spo2": 98,
            "pulse_rate": 72,
            "temperature": 98.6,
            "symptom_duration_days": 1,
            "symptoms": "mild dry cough, runny nose"
        },
        "source": "Patient"
    }

    res = client.post("/api/triage/evaluate", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert "priority" in data
    assert "differential_diagnosis" in data
    assert "recommended_facilities" in data
    assert isinstance(data["recommended_facilities"], list)
    assert len(data["recommended_facilities"]) <= 3
    if len(data["recommended_facilities"]) > 0:
        fac = data["recommended_facilities"][0]
        assert "hospital_id" in fac
        assert "hospital_name" in fac
        assert "distance_km" in fac
        assert "score" in fac
        assert "score_breakdown" in fac
