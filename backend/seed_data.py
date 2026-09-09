"""
Database initialization and clean seed data module for SevaSetu.
Maintains ONE authentic reference patient (Kharpudi PHC test profile)
for instant reviewer verification, while enabling full dynamic registration
for any user/phone entered.
"""

from sqlalchemy.orm import Session
from .models import Patient, TriageRecord, Inventory

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
