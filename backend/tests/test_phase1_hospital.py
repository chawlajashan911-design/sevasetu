"""
Phase 1 Test Suite: Hospital Dashboard
Tests cover:
- Hospital-scoped CRUD for Doctors, Tests, Pharmacy Items
- Role & Ownership enforcement (positive & negative access tests)
- Pharmacy LOW_STOCK / IN_STOCK status auto-derivation and boundary edge cases (quantity <= reorder_threshold)
- Doctor multi-slot availability schedules and active status toggling
- Patient / Public read access
- End-to-end hospital management user flow
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base, get_db
from backend.main import app
from backend.models import HospitalDoctor, HospitalTest, HospitalPharmacyItem
from backend.seed_data import seed_demo_data

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
# 1. DOCTORS TESTS: Hospital CRUD, Availability Slots, Active Flag
# =====================================================================

def test_hospital_create_and_list_doctors(client):
    """Hospital can create a doctor with multiple slots and list them."""
    payload = {
        "hospital_id": "hospital_aundh",
        "hospital_name": "Aundh District Hospital",
        "name": "Dr. Rohit Verma",
        "speciality": "Neurology",
        "qualification": "MBBS, DM (Neurology)",
        "experience_years": 10,
        "phone": "9822998877",
        "availability_slots": [
            {"day": "Monday", "start_time": "10:00", "end_time": "13:00", "label": "Morning Neuro OPD"},
            {"day": "Thursday", "start_time": "14:00", "end_time": "17:00", "label": "Afternoon Clinic"}
        ],
        "is_active": True
    }
    res = client.post("/api/hospitals/hospital_aundh/doctors", json=payload, headers={"X-Hospital-Id": "hospital_aundh"})
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Dr. Rohit Verma"
    assert data["speciality"] == "Neurology"
    assert len(data["availability_slots"]) == 2
    assert data["is_active"] is True
    doc_id = data["id"]

    # Public / Patient read
    list_res = client.get("/api/hospitals/hospital_aundh/doctors?speciality=Neurology")
    assert list_res.status_code == 200
    doctors = list_res.json()
    assert len(doctors) == 1
    assert doctors[0]["id"] == doc_id


def test_doctor_update_and_active_toggle(client):
    """Hospital can update doctor slots and toggle active flag."""
    # List existing doctors
    res = client.get("/api/hospitals/hospital_aundh/doctors")
    assert res.status_code == 200
    doctors = res.json()
    assert len(doctors) > 0
    doc = doctors[0]
    doc_id = doc["id"]

    # Update active flag to False
    up_res = client.patch(
        f"/api/doctors/{doc_id}",
        json={"is_active": False, "experience_years": 20},
        headers={"X-Hospital-Id": "hospital_aundh"}
    )
    assert up_res.status_code == 200
    assert up_res.json()["is_active"] is False
    assert up_res.json()["experience_years"] == 20

    # Verify active_only filter excludes this doctor
    active_res = client.get("/api/hospitals/hospital_aundh/doctors?active_only=true")
    active_ids = [d["id"] for d in active_res.json()]
    assert doc_id not in active_ids


def test_doctor_role_access_negative_rejection(client):
    """Modifying another hospital's doctor is rejected with 403 Forbidden."""
    # Doctor belongs to hospital_aundh
    res = client.get("/api/hospitals/hospital_aundh/doctors")
    doc_id = res.json()[0]["id"]

    # Attempt modification with another hospital identity
    up_res = client.patch(
        f"/api/doctors/{doc_id}",
        json={"name": "Hacked Doctor Name"},
        headers={"X-Hospital-Id": "hospital_other_city"}
    )
    assert up_res.status_code == 403
    assert "Not authorized" in up_res.json()["detail"]


# =====================================================================
# 2. DIAGNOSTIC TESTS: Hospital CRUD, Categories, Prep Notes
# =====================================================================

def test_hospital_test_crud_and_patient_public_view(client):
    """Hospital creates and updates diagnostic test, and patient reads catalog."""
    payload = {
        "hospital_id": "hospital_aundh",
        "hospital_name": "Aundh District Hospital",
        "test_name": "Thyroid Stimulating Hormone (TSH)",
        "category": "Biochemistry",
        "price": 320.0,
        "prep_notes": "Morning fasting sample preferred.",
        "turnaround_time": "6 hours",
        "is_available": True
    }
    res = client.post("/api/hospitals/hospital_aundh/tests", json=payload, headers={"X-Hospital-Id": "hospital_aundh"})
    assert res.status_code == 201
    test_data = res.json()
    test_id = test_data["id"]
    assert test_data["price"] == 320.0

    # Update test price and prep notes
    up_res = client.patch(
        f"/api/tests/{test_id}",
        json={"price": 280.0, "turnaround_time": "4 hours"},
        headers={"X-Hospital-Id": "hospital_aundh"}
    )
    assert up_res.status_code == 200
    assert up_res.json()["price"] == 280.0
    assert up_res.json()["turnaround_time"] == "4 hours"

    # Public patient view filters by category
    list_res = client.get("/api/hospitals/hospital_aundh/tests?category=Biochemistry")
    assert list_res.status_code == 200
    tests = list_res.json()
    assert any(t["id"] == test_id for t in tests)


def test_test_role_access_negative_rejection(client):
    """Deleting another hospital's diagnostic test is forbidden."""
    res = client.get("/api/hospitals/hospital_aundh/tests")
    test_id = res.json()[0]["id"]

    del_res = client.delete(f"/api/tests/{test_id}", headers={"X-Hospital-Id": "hospital_unauthorized"})
    assert del_res.status_code == 403


# =====================================================================
# 3. PHARMACY INVENTORY: Auto-Derived LOW_STOCK & Threshold Edge Cases
# =====================================================================

def test_pharmacy_status_derivation_edge_cases(client):
    """
    Test stock status rule:
    LOW_STOCK when quantity <= reorder_threshold else IN_STOCK.
    Tests exact equality, below, and above threshold.
    """
    # 1. Exact boundary equality (quantity == threshold => LOW_STOCK)
    item1 = client.post(
        "/api/hospitals/hospital_aundh/pharmacy",
        json={
            "hospital_id": "hospital_aundh",
            "medicine_name": "Inj Atropine 0.6mg",
            "generic_name": "Atropine Sulfate",
            "quantity": 50,
            "unit": "ampoules",
            "reorder_threshold": 50,
            "batch_number": "ATR-50"
        },
        headers={"X-Hospital-Id": "hospital_aundh"}
    ).json()
    assert item1["status"] == "LOW_STOCK", "Exact quantity == reorder_threshold must be LOW_STOCK"

    # 2. Strict inequality below threshold (quantity < threshold => LOW_STOCK)
    item2 = client.post(
        "/api/hospitals/hospital_aundh/pharmacy",
        json={
            "hospital_id": "hospital_aundh",
            "medicine_name": "Tab Diazepam 5mg",
            "generic_name": "Diazepam",
            "quantity": 10,
            "unit": "strips",
            "reorder_threshold": 30,
            "batch_number": "DZP-10"
        },
        headers={"X-Hospital-Id": "hospital_aundh"}
    ).json()
    assert item2["status"] == "LOW_STOCK"

    # 3. Above threshold (quantity > threshold => IN_STOCK)
    item3 = client.post(
        "/api/hospitals/hospital_aundh/pharmacy",
        json={
            "hospital_id": "hospital_aundh",
            "medicine_name": "Tab Ibuprofen 400mg",
            "generic_name": "Ibuprofen",
            "quantity": 500,
            "unit": "strips",
            "reorder_threshold": 100,
            "batch_number": "IBU-500"
        },
        headers={"X-Hospital-Id": "hospital_aundh"}
    ).json()
    assert item3["status"] == "IN_STOCK"

    # 4. Quantity update transition: In-Stock drops to Low-Stock
    drop_res = client.patch(
        f"/api/pharmacy/{item3['id']}",
        json={"quantity": 99},  # 99 <= 100
        headers={"X-Hospital-Id": "hospital_aundh"}
    )
    assert drop_res.status_code == 200
    assert drop_res.json()["status"] == "LOW_STOCK"

    # 5. Quantity update transition: Low-Stock replenished to In-Stock
    replenish_res = client.patch(
        f"/api/pharmacy/{item2['id']}",
        json={"quantity": 150},  # 150 > 30
        headers={"X-Hospital-Id": "hospital_aundh"}
    )
    assert replenish_res.status_code == 200
    assert replenish_res.json()["status"] == "IN_STOCK"


def test_pharmacy_filter_and_sorting(client):
    """Pharmacy inventory filtering by status and sorting by quantity / status."""
    # Fetch LOW_STOCK only
    low_res = client.get("/api/hospitals/hospital_aundh/pharmacy?status=LOW_STOCK")
    assert low_res.status_code == 200
    low_data = low_res.json()
    assert all(it["status"] == "LOW_STOCK" for it in low_data["items"])
    assert low_data["low_stock_count"] > 0

    # Fetch IN_STOCK only
    in_res = client.get("/api/hospitals/hospital_aundh/pharmacy?status=IN_STOCK")
    assert in_res.status_code == 200
    in_data = in_res.json()
    assert all(it["status"] == "IN_STOCK" for it in in_data["items"])

    # Sort by quantity descending
    sort_res = client.get("/api/hospitals/hospital_aundh/pharmacy?sort_by=quantity&sort_order=desc")
    assert sort_res.status_code == 200
    quantities = [it["quantity"] for it in sort_res.json()["items"]]
    assert quantities == sorted(quantities, reverse=True)


def test_pharmacy_role_access_negative_rejection(client):
    """Mutating pharmacy stock of another hospital is forbidden."""
    pharm_res = client.get("/api/hospitals/hospital_aundh/pharmacy")
    item_id = pharm_res.json()["items"][0]["id"]

    res = client.patch(
        f"/api/pharmacy/{item_id}",
        json={"quantity": 0},
        headers={"X-Hospital-Id": "hospital_unauthorized"}
    )
    assert res.status_code == 403


# =====================================================================
# 4. FULL END-TO-END FLOW PER MODULE
# =====================================================================

def test_full_hospital_management_flow(client):
    """
    Full user flow:
    1. Hospital logs in and adds specialist doctor with weekly timetable.
    2. Hospital adds diagnostic package test with preparation instructions.
    3. Hospital adds critical emergency medicine with stock and reorder threshold.
    4. Hospital consumes stock triggering auto-derivation to LOW_STOCK.
    5. Patient visits hospital public directory and views doctor schedule, test prices, and medicine availability.
    """
    hosp_id = "hospital_aundh"
    headers = {"X-Hospital-Id": hosp_id}

    # Step 1: Add Specialist Doctor
    doc_res = client.post(
        f"/api/hospitals/{hosp_id}/doctors",
        json={
            "hospital_id": hosp_id,
            "hospital_name": "Aundh District Hospital",
            "name": "Dr. Suniti Sharma",
            "speciality": "Endocrinology",
            "qualification": "MBBS, MD, DM (Endocrinology)",
            "experience_years": 8,
            "phone": "9822334411",
            "availability_slots": [
                {"day": "Tuesday", "start_time": "09:00", "end_time": "12:00", "label": "Diabetes Clinic"},
                {"day": "Friday", "start_time": "09:00", "end_time": "12:00", "label": "Thyroid Clinic"}
            ],
            "is_active": True
        },
        headers=headers
    )
    assert doc_res.status_code == 201
    doc_id = doc_res.json()["id"]

    # Step 2: Add Diagnostic Test
    test_res = client.post(
        f"/api/hospitals/{hosp_id}/tests",
        json={
            "hospital_id": hosp_id,
            "hospital_name": "Aundh District Hospital",
            "test_name": "HbA1c Glycated Hemoglobin Test",
            "category": "Biochemistry",
            "price": 450.0,
            "prep_notes": "Random blood sample. Fasting not strictly required.",
            "turnaround_time": "3 hours",
            "is_available": True
        },
        headers=headers
    )
    assert test_res.status_code == 201
    test_id = test_res.json()["id"]

    # Step 3: Add Emergency Medicine
    pharm_res = client.post(
        f"/api/hospitals/{hosp_id}/pharmacy",
        json={
            "hospital_id": hosp_id,
            "hospital_name": "Aundh District Hospital",
            "medicine_name": "Inj Human Regular Insulin 40 IU/ml",
            "generic_name": "Recombinant Human Insulin",
            "quantity": 100,
            "unit": "vials",
            "reorder_threshold": 30,
            "batch_number": "INS-2026-X1",
            "expiry_date": "2027-10"
        },
        headers=headers
    )
    assert pharm_res.status_code == 201
    pharm_id = pharm_res.json()["id"]
    assert pharm_res.json()["status"] == "IN_STOCK"

    # Step 4: Dispense stock (100 -> 25) which is <= threshold 30
    dispense_res = client.patch(
        f"/api/pharmacy/{pharm_id}",
        json={"quantity": 25},
        headers=headers
    )
    assert dispense_res.status_code == 200
    assert dispense_res.json()["status"] == "LOW_STOCK"

    # Step 5: Patient Public Read Verification
    patient_doctors = client.get(f"/api/hospitals/{hosp_id}/doctors?search=Suniti").json()
    assert len(patient_doctors) == 1
    assert patient_doctors[0]["speciality"] == "Endocrinology"
    assert len(patient_doctors[0]["availability_slots"]) == 2

    patient_tests = client.get(f"/api/hospitals/{hosp_id}/tests?search=HbA1c").json()
    assert len(patient_tests) == 1
    assert patient_tests[0]["price"] == 450.0

    patient_pharmacy = client.get(f"/api/hospitals/{hosp_id}/pharmacy?search=Insulin").json()
    assert patient_pharmacy["total_items"] == 1
    assert patient_pharmacy["items"][0]["status"] == "LOW_STOCK"
    assert patient_pharmacy["items"][0]["quantity"] == 25
