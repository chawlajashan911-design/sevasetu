"""
AI Symptom to Hospital Matching Test Suite
Tests:
1. Schema validation on bad/malformed Gemini output & graceful recovery
2. Ranking recomputes dynamically when doctor availability or pharmacy stock changes (live DB proof, no stale cache)
3. Emergency path: Red flags / EMERGENCY urgency trigger emergency override banner and pin nearest emergency facility
4. Fallback path: Rule-based keyword matching & manual speciality override when LLM is unavailable
5. Endpoint integration: POST /api/symptom-match and GET /api/symptom-match/enums
"""

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base, get_db
from backend.main import app
from backend.models import Hospital, HospitalDoctor, HospitalTest, HospitalPharmacyItem
from backend.seed_data import seed_demo_data
from backend.services.symptom_matching_service import (
    SymptomMatchingService,
    _GEMINI_ASSESSMENT_CACHE,
    symptom_matching_service
)
from backend.schemas import SymptomMatchRequest

# In-memory SQLite DB for clean, fast, isolated automated testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        seed_demo_data(db)
        _GEMINI_ASSESSMENT_CACHE.clear()
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# =====================================================================
# 1. SCHEMA VALIDATION ON BAD/MALFORMED GEMINI OUTPUT
# =====================================================================

def test_gemini_bad_json_recovers_to_valid_schema(db_session):
    """When Gemini returns invalid non-JSON or garbled text, the service recovers with fallback."""
    service = SymptomMatchingService()
    
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = "NOT_A_VALID_JSON: The patient seems to have a cardiac issue."
    mock_client.models.generate_content.return_value = mock_response

    with patch.object(service, "_get_gemini_client", return_value=mock_client):
        assessment = service.assess_symptoms_with_gemini(
            db=db_session,
            symptoms="Severe chest pain and dizziness",
            age=55,
            sex="Male",
            duration="2 hours"
        )
        assert assessment is not None
        assert assessment.urgency in ["EMERGENCY", "URGENT", "ROUTINE"]
        assert len(assessment.specialities) > 0
        assert assessment.fallback_used is True
        assert len(assessment.suggested_tests) > 0
        assert len(assessment.medicine_categories) > 0


def test_gemini_markdown_fence_stripping(db_session):
    """When Gemini returns JSON wrapped in markdown codeblocks, it is properly stripped and parsed."""
    service = SymptomMatchingService()

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = """```json
{
  "urgency": "URGENT",
  "specialities": [{"name": "Cardiology", "confidence": 0.95}],
  "suggested_tests": ["ECG (12-Lead)", "Complete Blood Count (CBC)"],
  "medicine_categories": ["Cardiac & Antianginal"],
  "summary": "Suspected acute angina episode."
}
```"""
    mock_client.models.generate_content.return_value = mock_response

    with patch.object(service, "_get_gemini_client", return_value=mock_client):
        assessment = service.assess_symptoms_with_gemini(
            db=db_session,
            symptoms="Angina pectoris with high blood pressure",
            age=60,
            sex="Male",
            duration="1 day"
        )
        assert assessment.urgency == "URGENT"
        assert assessment.specialities[0].name == "Cardiology"
        assert assessment.specialities[0].confidence == 0.95
        assert "ECG (12-Lead)" in assessment.suggested_tests
        assert assessment.fallback_used is False


# =====================================================================
# 2. LIVE RANKING RECOMPUTES DYNAMICALLY ON DB CHANGES (NO STALE CACHE)
# =====================================================================

def test_ranking_recomputes_live_when_doctor_or_stock_changes(client, db_session):
    """
    1. Send symptom request → get initial ranking & score.
    2. Deactivate the hospital's doctor and deplete pharmacy stock.
    3. Send identical symptom request → Gemini reasoning is served from hash cache,
       BUT hospital score drops immediately because DB ranking is strictly live.
    """
    payload = {
        "symptoms": "Chest pain and palpitations with fatigue",
        "age": 52,
        "sex": "Male",
        "duration": "2 days",
        "lat": 18.5601,
        "lng": 73.8031,
        "district": "Pune"
    }

    # First Request
    res1 = client.post("/api/symptom-match", json=payload)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["assessment"]["cached"] is False
    assert len(data1["ranked_hospitals"]) > 0

    hosp1_initial = next(h for h in data1["ranked_hospitals"] if h["hospital_id"] == "hospital_aundh")
    initial_score = hosp1_initial["score"]
    initial_doc_score = hosp1_initial["score_breakdown"]["doctor_score"]
    initial_med_score = hosp1_initial["score_breakdown"]["medicine_score"]
    assert initial_doc_score > 0

    # Modify DB state: Deactivate Cardiologist in hospital_aundh & zero out pharmacy items
    cardio_doc = db_session.query(HospitalDoctor).filter(
        HospitalDoctor.hospital_id == "hospital_aundh",
        HospitalDoctor.speciality == "Cardiology"
    ).first()
    if cardio_doc:
        cardio_doc.is_active = False

    # Deplete pharmacy items for hospital_aundh
    pharm_items = db_session.query(HospitalPharmacyItem).filter(
        HospitalPharmacyItem.hospital_id == "hospital_aundh"
    ).all()
    for item in pharm_items:
        item.quantity = 0
        item.status = "LOW_STOCK"
    db_session.commit()

    # Second Request with identical symptoms
    res2 = client.post("/api/symptom-match", json=payload)
    assert res2.status_code == 200
    data2 = res2.json()

    # Reasoning JSON WAS cached
    assert data2["assessment"]["cached"] is True

    # BUT Live DB Ranking recalculated scores
    hosp1_updated = next(h for h in data2["ranked_hospitals"] if h["hospital_id"] == "hospital_aundh")
    updated_score = hosp1_updated["score"]
    updated_doc_score = hosp1_updated["score_breakdown"]["doctor_score"]
    updated_med_score = hosp1_updated["score_breakdown"]["medicine_score"]

    # Score strictly dropped due to deactivated doctor and depleted pharmacy
    assert updated_score < initial_score
    assert updated_doc_score < initial_doc_score


# =====================================================================
# 3. EMERGENCY PATH: PIN NEAREST EMERGENCY FACILITY & ALERT BANNER
# =====================================================================

def test_emergency_path_pins_nearest_emergency_facility(client):
    """Emergency symptoms trigger emergency override banner and rank nearest emergency facility first."""
    payload = {
        "symptoms": "Severe acute crushing chest pain, unconsciousness and cold collapse",
        "age": 62,
        "sex": "Female",
        "duration": "15 minutes",
        "lat": 18.5204,
        "lng": 73.8567,
        "district": "Pune"
    }

    res = client.post("/api/symptom-match", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["assessment"]["urgency"] == "EMERGENCY"
    assert data["emergency_override"] is not None
    assert data["emergency_override"]["is_emergency"] is True
    assert "EMERGENCY" in data["emergency_override"]["alert_message"]
    assert data["emergency_override"]["nearest_facility"] is not None
    assert data["emergency_override"]["nearest_facility"]["emergency_services"] is not None

    # Top ranked hospital is emergency capable
    top_hospital = data["ranked_hospitals"][0]
    assert top_hospital["is_emergency_capable"] is True


# =====================================================================
# 4. FALLBACK PATH: MANUAL SPECIALTY OVERRIDE & KEYWORD MATCHER
# =====================================================================

def test_manual_speciality_override_path(client):
    """When user manually selects a speciality, the engine overrides and ranks based on that speciality."""
    payload = {
        "symptoms": "Persistent high fever and headache",
        "age": 30,
        "sex": "Male",
        "duration": "3 days",
        "manual_speciality": "Pediatrics",
        "district": "Pune"
    }

    res = client.post("/api/symptom-match", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["assessment"]["specialities"][0]["name"] == "Pediatrics"
    assert data["assessment"]["specialities"][0]["confidence"] == 1.0
    assert data["assessment"]["fallback_used"] is True


def test_rule_based_keyword_fallback(db_session):
    """Testing fallback keyword matching across diverse specialties."""
    service = SymptomMatchingService()

    # Pregnancy / OBGY
    ob_res = service._fallback_reasoning("High risk pregnancy with bleeding and contractions", 24, "Female")
    assert ob_res["specialities"][0]["name"] == "Obstetrics & Gynecology"

    # Orthopedics
    ortho_res = service._fallback_reasoning("Severe knee joint fracture and swelling after fall", 45, "Male")
    assert ortho_res["specialities"][0]["name"] == "Orthopedics"

    # Dermatology
    derm_res = service._fallback_reasoning("Skin rash with intense itching and redness", 20, "Female")
    assert derm_res["specialities"][0]["name"] == "Dermatology"


# =====================================================================
# 5. ENUMS ENDPOINT AND INPUT VALIDATION
# =====================================================================

def test_get_symptom_match_enums(client):
    """GET /api/symptom-match/enums returns master specialities, tests, and medicine categories."""
    res = client.get("/api/symptom-match/enums")
    assert res.status_code == 200
    data = res.json()
    assert "specialities" in data
    assert "suggested_tests" in data
    assert "medicine_categories" in data
    assert "Cardiology" in data["specialities"]
    assert "Complete Blood Count (CBC)" in data["suggested_tests"]


def test_empty_symptoms_validation(client):
    """POST /api/symptom-match rejects empty symptoms."""
    res = client.post("/api/symptom-match", json={"symptoms": "  ", "age": 30, "sex": "Male"})
    assert res.status_code == 400
