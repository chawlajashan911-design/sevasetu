"""
SevaSetu — One-time Data Migration Script
==========================================
Run this ONCE locally to bulk-insert all reference data into Supabase:
  - 4,807 Maharashtra hospitals (from hospital_directory.csv)
  - 44,810 Maharashtra villages (from maharashtra_villages_website.json)

Usage:
    cd "sih project"
    source venv/bin/activate
    python -m backend.migrate_data

Requires DATABASE_URL to be set in .env or environment.
Safe to re-run — uses INSERT ... ON CONFLICT DO NOTHING.
"""

import csv
import json
import os
import math
import sys
from typing import Optional, Any

from dotenv import load_dotenv
load_dotenv()

# Must be run from repo root as: python -m backend.migrate_data
from backend.database import engine, Base, SessionLocal
from backend.models import Hospital, Village


# ─────────────────────────────────────────────
# Helpers (same logic as old hospital_loader.py)
# ─────────────────────────────────────────────

def clean_val(val: Any) -> Optional[str]:
    if val is None:
        return None
    s = str(val).strip()
    if s in ['0', '0.0', 'NULL', 'null', 'None', 'NA', 'N/A', '', '-', '0, 0', '0,0']:
        return None
    return s


def parse_coords(coord_str: Optional[str]):
    if not coord_str:
        return None, None
    s = str(coord_str).strip()
    if s in ['0', '0,0', '0.0, 0.0', '']:
        return None, None
    parts = s.split(',')
    if len(parts) == 2:
        try:
            lat = float(parts[0].strip())
            lng = float(parts[1].strip())
            if -90 <= lat <= 90 and -180 <= lng <= 180 and (lat != 0 or lng != 0):
                return round(lat, 6), round(lng, 6)
        except (ValueError, TypeError):
            pass
    return None, None


# ─────────────────────────────────────────────
# Step 1: Create all tables
# ─────────────────────────────────────────────

def create_tables():
    print("📋 Creating tables on Supabase (idempotent)...")
    Base.metadata.create_all(bind=engine)
    print("   ✅ Tables ready.\n")


# ─────────────────────────────────────────────
# Step 2: Migrate Hospitals from CSV
# ─────────────────────────────────────────────

def migrate_hospitals():
    csv_path = os.path.join(os.path.dirname(__file__), "hospital_directory.csv")
    if not os.path.exists(csv_path):
        csv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "hospital_directory.csv")

    if not os.path.exists(csv_path):
        print("❌ hospital_directory.csv not found. Skipping hospital migration.")
        return

    db = SessionLocal()
    try:
        # Check if already migrated
        existing = db.query(Hospital).count()
        if existing > 0:
            print(f"⏭️  Hospitals already migrated ({existing} rows). Skipping.")
            return

        print("🏥 Migrating hospitals from hospital_directory.csv...")
        batch = []
        total = 0
        mh_count = 0

        with open(csv_path, mode='r', encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f)
            for idx, r in enumerate(reader):
                total += 1
                state = (r.get('State') or '').strip()
                if state.lower() != 'maharashtra':
                    continue

                name = clean_val(r.get('Hospital_Name'))
                if not name:
                    continue

                lat, lng = parse_coords(r.get('Location_Coordinates'))

                phone = (
                    clean_val(r.get('Telephone')) or
                    clean_val(r.get('Mobile_Number')) or
                    clean_val(r.get('Emergency_Num')) or
                    clean_val(r.get('Helpline')) or
                    clean_val(r.get('Tollfree')) or
                    clean_val(r.get('Nodal_Person_Tele'))
                )
                ambulance = clean_val(r.get('Ambulance_Phone_No'))

                beds_raw = clean_val(r.get('Total_Num_Beds'))
                beds = int(beds_raw) if (beds_raw and beds_raw.isdigit() and int(beds_raw) > 0) else None

                doctors_raw = clean_val(r.get('Number_Doctor')) or clean_val(r.get('Num_Mediconsultant_or_Expert'))
                doctors = int(doctors_raw) if (doctors_raw and doctors_raw.isdigit() and int(doctors_raw) > 0) else None

                emergency = clean_val(r.get('Emergency_Services'))
                specialties = clean_val(r.get('Specialties'))
                facilities = clean_val(r.get('Facilities'))
                care_type = clean_val(r.get('Hospital_Care_Type'))
                category = clean_val(r.get('Hospital_Category'))
                address = clean_val(r.get('Address_Original_First_Line')) or clean_val(r.get('Location'))
                district = clean_val(r.get('District'))
                subdistrict = clean_val(r.get('Subdistrict'))
                village = clean_val(r.get('Village')) or clean_val(r.get('Town')) or clean_val(r.get('Subtown'))
                pincode = clean_val(r.get('Pincode'))

                hospital = Hospital(
                    id=f'hosp-{idx + 1}',
                    name=name,
                    category=category or 'Healthcare Facility',
                    care_type=care_type or 'Hospital',
                    address=address or (f'{subdistrict}, {district}' if subdistrict else district or 'Maharashtra'),
                    district=district or 'Maharashtra',
                    subdistrict=subdistrict,
                    village=village,
                    pincode=pincode,
                    lat=lat,
                    lng=lng,
                    specialties=specialties,
                    facilities=facilities,
                    emergency_services=emergency,
                    ambulance=ambulance,
                    phone=phone,
                    doctors=doctors,
                    beds=beds,
                    status='Operational (24x7)' if (emergency or 'Hospital' in (care_type or '')) else 'Open',
                )
                batch.append(hospital)
                mh_count += 1

                if len(batch) >= 500:
                    db.bulk_save_objects(batch)
                    db.commit()
                    print(f"   Inserted {mh_count} hospitals so far...")
                    batch = []

        if batch:
            db.bulk_save_objects(batch)
            db.commit()

        print(f"   ✅ Migrated {mh_count} Maharashtra hospitals (from {total} total rows).\n")
    except Exception as e:
        db.rollback()
        print(f"❌ Hospital migration failed: {e}")
        raise
    finally:
        db.close()


# ─────────────────────────────────────────────
# Step 3: Migrate Villages from JSON
# ─────────────────────────────────────────────

def migrate_villages():
    json_path = os.path.join(os.path.dirname(__file__), "maharashtra_villages_website.json")
    if not os.path.exists(json_path):
        json_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "maharashtra_villages_website.json")

    if not os.path.exists(json_path):
        print("❌ maharashtra_villages_website.json not found. Skipping village migration.")
        return

    db = SessionLocal()
    try:
        existing = db.query(Village).count()
        if existing > 0:
            print(f"⏭️  Villages already migrated ({existing} rows). Skipping.")
            return

        print("🏘️  Migrating villages from maharashtra_villages_website.json...")
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        total = len(data)
        batch = []

        for idx, v in enumerate(data):
            village = Village(
                id=str(v.get('id') or f'v-{idx + 1}'),
                name=v.get('name', '').strip(),
                district=v.get('district', '').strip() or None,
                taluka=v.get('taluka', '').strip() or None,
                district_code=str(v.get('districtCode', '') or '').strip() or None,
                taluka_code=str(v.get('talukaCode', '') or '').strip() or None,
                status=v.get('status', '').strip() or None,
            )
            batch.append(village)

            if len(batch) >= 1000:
                db.bulk_save_objects(batch)
                db.commit()
                print(f"   Inserted {idx + 1}/{total} villages...")
                batch = []

        if batch:
            db.bulk_save_objects(batch)
            db.commit()

        print(f"   ✅ Migrated {total} villages.\n")
    except Exception as e:
        db.rollback()
        print(f"❌ Village migration failed: {e}")
        raise
    finally:
        db.close()


# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 55)
    print("  SevaSetu → Supabase Migration")
    print("=" * 55)

    db_url = (os.getenv("DATABASE_URL") or "").strip('"').strip("'")
    if not db_url:
        print("❌ DATABASE_URL not set. Add it to your .env file.")
        sys.exit(1)

    print(f"🔗 Connecting to: {db_url[:40]}...\n")

    create_tables()
    migrate_hospitals()
    migrate_villages()

    print("=" * 55)
    print("  ✅ Migration complete! You can now:")
    print("  1. Delete the large files from the repo")
    print("  2. Push to GitHub and deploy on Render")
    print("=" * 55)
