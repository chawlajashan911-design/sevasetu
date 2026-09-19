"""
Hospital Dashboard & Clinical Services Domain Service
Encapsulates hospital-scoped CRUD operations, multi-slot availability schedules,
test catalogs, and pharmacy inventory management with automated stock derivation.
"""

import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, func, or_
from fastapi import HTTPException

from ..models import HospitalDoctor, HospitalTest, HospitalPharmacyItem
from ..schemas import (
    HospitalDoctorCreate, HospitalDoctorUpdate,
    HospitalTestCreate, HospitalTestUpdate,
    HospitalPharmacyItemCreate, HospitalPharmacyItemUpdate
)

class HospitalService:

    # ─────────────────────────────────────────────
    # Doctor Management
    # ─────────────────────────────────────────────

    @classmethod
    def list_doctors(
        cls,
        db: Session,
        hospital_id: Optional[str] = None,
        speciality: Optional[str] = None,
        active_only: bool = False,
        search_query: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        query = db.query(HospitalDoctor)
        if hospital_id:
            query = query.filter(func.lower(HospitalDoctor.hospital_id) == hospital_id.lower())
        if speciality and speciality != "All":
            query = query.filter(func.lower(HospitalDoctor.speciality) == speciality.lower())
        if active_only:
            query = query.filter(HospitalDoctor.is_active == True)
        if search_query:
            sq = f"%{search_query.strip()}%"
            query = query.filter(
                or_(
                    HospitalDoctor.name.ilike(sq),
                    HospitalDoctor.speciality.ilike(sq),
                    HospitalDoctor.qualification.ilike(sq)
                )
            )

        doctors = query.order_by(HospitalDoctor.name.asc()).all()
        return [cls._serialize_doctor(d) for d in doctors]

    @classmethod
    def get_doctor(cls, db: Session, doctor_id: int) -> Optional[Dict[str, Any]]:
        doc = db.query(HospitalDoctor).filter(HospitalDoctor.id == doctor_id).first()
        return cls._serialize_doctor(doc) if doc else None

    @classmethod
    def create_doctor(cls, db: Session, doc_in: HospitalDoctorCreate) -> Dict[str, Any]:
        slots_json = json.dumps([slot.model_dump() for slot in (doc_in.availability_slots or [])])
        doctor = HospitalDoctor(
            hospital_id=doc_in.hospital_id.strip(),
            hospital_name=doc_in.hospital_name,
            name=doc_in.name.strip(),
            speciality=doc_in.speciality.strip(),
            qualification=doc_in.qualification.strip() if doc_in.qualification else None,
            experience_years=doc_in.experience_years or 0,
            phone=doc_in.phone.strip() if doc_in.phone else None,
            availability_slots=slots_json,
            is_active=doc_in.is_active if doc_in.is_active is not None else True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(doctor)
        db.commit()
        db.refresh(doctor)
        return cls._serialize_doctor(doctor)

    @classmethod
    def update_doctor(
        cls,
        db: Session,
        doctor_id: int,
        doc_in: HospitalDoctorUpdate,
        requesting_hospital_id: Optional[str] = None
    ) -> Dict[str, Any]:
        doctor = db.query(HospitalDoctor).filter(HospitalDoctor.id == doctor_id).first()
        if not doctor:
            raise HTTPException(status_code=404, detail="Doctor record not found")

        if requesting_hospital_id and doctor.hospital_id.lower() != requesting_hospital_id.lower():
            raise HTTPException(status_code=403, detail="Not authorized to modify doctors for another hospital")

        if doc_in.name is not None:
            doctor.name = doc_in.name.strip()
        if doc_in.speciality is not None:
            doctor.speciality = doc_in.speciality.strip()
        if doc_in.qualification is not None:
            doctor.qualification = doc_in.qualification.strip()
        if doc_in.experience_years is not None:
            doctor.experience_years = doc_in.experience_years
        if doc_in.phone is not None:
            doctor.phone = doc_in.phone.strip()
        if doc_in.availability_slots is not None:
            doctor.availability_slots = json.dumps([slot.model_dump() for slot in doc_in.availability_slots])
        if doc_in.is_active is not None:
            doctor.is_active = doc_in.is_active

        doctor.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(doctor)
        return cls._serialize_doctor(doctor)

    @classmethod
    def delete_doctor(
        cls,
        db: Session,
        doctor_id: int,
        requesting_hospital_id: Optional[str] = None
    ) -> Dict[str, Any]:
        doctor = db.query(HospitalDoctor).filter(HospitalDoctor.id == doctor_id).first()
        if not doctor:
            raise HTTPException(status_code=404, detail="Doctor record not found")

        if requesting_hospital_id and doctor.hospital_id.lower() != requesting_hospital_id.lower():
            raise HTTPException(status_code=403, detail="Not authorized to delete doctors for another hospital")

        db.delete(doctor)
        db.commit()
        return {"success": True, "id": doctor_id, "message": "Doctor record deleted successfully"}

    @classmethod
    def _serialize_doctor(cls, doc: HospitalDoctor) -> Dict[str, Any]:
        slots = []
        if doc.availability_slots:
            try:
                parsed = json.loads(doc.availability_slots)
                if isinstance(parsed, list):
                    slots = parsed
            except Exception:
                slots = []
        return {
            "id": doc.id,
            "hospital_id": doc.hospital_id,
            "hospital_name": doc.hospital_name,
            "name": doc.name,
            "speciality": doc.speciality,
            "qualification": doc.qualification,
            "experience_years": doc.experience_years,
            "phone": doc.phone,
            "availability_slots": slots,
            "is_active": doc.is_active,
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
            "updated_at": doc.updated_at.isoformat() if doc.updated_at else None
        }

    # ─────────────────────────────────────────────
    # Diagnostic / Lab Test Management
    # ─────────────────────────────────────────────

    @classmethod
    def list_tests(
        cls,
        db: Session,
        hospital_id: Optional[str] = None,
        category: Optional[str] = None,
        available_only: bool = False,
        search_query: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        query = db.query(HospitalTest)
        if hospital_id:
            query = query.filter(func.lower(HospitalTest.hospital_id) == hospital_id.lower())
        if category and category != "All":
            query = query.filter(func.lower(HospitalTest.category) == category.lower())
        if available_only:
            query = query.filter(HospitalTest.is_available == True)
        if search_query:
            sq = f"%{search_query.strip()}%"
            query = query.filter(
                or_(
                    HospitalTest.test_name.ilike(sq),
                    HospitalTest.category.ilike(sq),
                    HospitalTest.prep_notes.ilike(sq)
                )
            )

        tests = query.order_by(HospitalTest.category.asc(), HospitalTest.test_name.asc()).all()
        return [cls._serialize_test(t) for t in tests]

    @classmethod
    def get_test(cls, db: Session, test_id: int) -> Optional[Dict[str, Any]]:
        test = db.query(HospitalTest).filter(HospitalTest.id == test_id).first()
        return cls._serialize_test(test) if test else None

    @classmethod
    def create_test(cls, db: Session, test_in: HospitalTestCreate) -> Dict[str, Any]:
        test = HospitalTest(
            hospital_id=test_in.hospital_id.strip(),
            hospital_name=test_in.hospital_name,
            test_name=test_in.test_name.strip(),
            category=test_in.category.strip(),
            price=float(test_in.price),
            prep_notes=test_in.prep_notes.strip() if test_in.prep_notes else None,
            turnaround_time=test_in.turnaround_time.strip() if test_in.turnaround_time else None,
            is_available=test_in.is_available if test_in.is_available is not None else True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(test)
        db.commit()
        db.refresh(test)
        return cls._serialize_test(test)

    @classmethod
    def update_test(
        cls,
        db: Session,
        test_id: int,
        test_in: HospitalTestUpdate,
        requesting_hospital_id: Optional[str] = None
    ) -> Dict[str, Any]:
        test = db.query(HospitalTest).filter(HospitalTest.id == test_id).first()
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")

        if requesting_hospital_id and test.hospital_id.lower() != requesting_hospital_id.lower():
            raise HTTPException(status_code=403, detail="Not authorized to modify tests for another hospital")

        if test_in.test_name is not None:
            test.test_name = test_in.test_name.strip()
        if test_in.category is not None:
            test.category = test_in.category.strip()
        if test_in.price is not None:
            test.price = float(test_in.price)
        if test_in.prep_notes is not None:
            test.prep_notes = test_in.prep_notes.strip()
        if test_in.turnaround_time is not None:
            test.turnaround_time = test_in.turnaround_time.strip()
        if test_in.is_available is not None:
            test.is_available = test_in.is_available

        test.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(test)
        return cls._serialize_test(test)

    @classmethod
    def delete_test(
        cls,
        db: Session,
        test_id: int,
        requesting_hospital_id: Optional[str] = None
    ) -> Dict[str, Any]:
        test = db.query(HospitalTest).filter(HospitalTest.id == test_id).first()
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")

        if requesting_hospital_id and test.hospital_id.lower() != requesting_hospital_id.lower():
            raise HTTPException(status_code=403, detail="Not authorized to delete tests for another hospital")

        db.delete(test)
        db.commit()
        return {"success": True, "id": test_id, "message": "Test deleted successfully"}

    @classmethod
    def _serialize_test(cls, test: HospitalTest) -> Dict[str, Any]:
        return {
            "id": test.id,
            "hospital_id": test.hospital_id,
            "hospital_name": test.hospital_name,
            "test_name": test.test_name,
            "category": test.category,
            "price": test.price,
            "prep_notes": test.prep_notes,
            "turnaround_time": test.turnaround_time,
            "is_available": test.is_available,
            "created_at": test.created_at.isoformat() if test.created_at else None,
            "updated_at": test.updated_at.isoformat() if test.updated_at else None
        }

    # ─────────────────────────────────────────────
    # Pharmacy Inventory Management
    # ─────────────────────────────────────────────

    @classmethod
    def derive_stock_status(cls, quantity: int, reorder_threshold: int) -> str:
        """
        Rule: status auto-derived as LOW_STOCK when quantity <= reorder_threshold else IN_STOCK.
        """
        return "LOW_STOCK" if quantity <= reorder_threshold else "IN_STOCK"

    @classmethod
    def list_pharmacy_items(
        cls,
        db: Session,
        hospital_id: Optional[str] = None,
        status_filter: Optional[str] = None,  # "ALL", "LOW_STOCK", "IN_STOCK"
        sort_by: Optional[str] = "name",      # "name", "quantity", "status", "last_updated"
        sort_order: Optional[str] = "asc",    # "asc", "desc"
        search_query: Optional[str] = None,
    ) -> Dict[str, Any]:
        query = db.query(HospitalPharmacyItem)
        if hospital_id:
            query = query.filter(func.lower(HospitalPharmacyItem.hospital_id) == hospital_id.lower())

        # Ensure all statuses in DB are in sync with current quantities
        items = query.all()
        needs_commit = False
        for it in items:
            expected = cls.derive_stock_status(it.quantity, it.reorder_threshold)
            if it.status != expected:
                it.status = expected
                needs_commit = True
        if needs_commit:
            db.commit()

        # Re-query with filters
        filtered_query = db.query(HospitalPharmacyItem)
        if hospital_id:
            filtered_query = filtered_query.filter(func.lower(HospitalPharmacyItem.hospital_id) == hospital_id.lower())

        if status_filter and status_filter.upper() != "ALL":
            filtered_query = filtered_query.filter(HospitalPharmacyItem.status == status_filter.upper())

        if search_query:
            sq = f"%{search_query.strip()}%"
            filtered_query = filtered_query.filter(
                or_(
                    HospitalPharmacyItem.medicine_name.ilike(sq),
                    HospitalPharmacyItem.generic_name.ilike(sq),
                    HospitalPharmacyItem.batch_number.ilike(sq)
                )
            )

        # Sorting logic
        direction = desc if sort_order.lower() == "desc" else asc
        if sort_by == "quantity":
            filtered_query = filtered_query.order_by(direction(HospitalPharmacyItem.quantity))
        elif sort_by == "status":
            filtered_query = filtered_query.order_by(direction(HospitalPharmacyItem.status), HospitalPharmacyItem.medicine_name.asc())
        elif sort_by == "last_updated":
            filtered_query = filtered_query.order_by(direction(HospitalPharmacyItem.last_updated))
        else:
            filtered_query = filtered_query.order_by(direction(HospitalPharmacyItem.medicine_name))

        all_items = filtered_query.all()
        low_stock_count = sum(1 for it in all_items if it.status == "LOW_STOCK")
        in_stock_count = sum(1 for it in all_items if it.status == "IN_STOCK")

        return {
            "hospital_id": hospital_id or "ALL",
            "total_items": len(all_items),
            "low_stock_count": low_stock_count,
            "in_stock_count": in_stock_count,
            "items": [cls._serialize_pharmacy_item(it) for it in all_items]
        }

    @classmethod
    def get_pharmacy_item(cls, db: Session, item_id: int) -> Optional[Dict[str, Any]]:
        item = db.query(HospitalPharmacyItem).filter(HospitalPharmacyItem.id == item_id).first()
        return cls._serialize_pharmacy_item(item) if item else None

    @classmethod
    def create_pharmacy_item(cls, db: Session, item_in: HospitalPharmacyItemCreate) -> Dict[str, Any]:
        derived_status = cls.derive_stock_status(item_in.quantity, item_in.reorder_threshold)
        item = HospitalPharmacyItem(
            hospital_id=item_in.hospital_id.strip(),
            hospital_name=item_in.hospital_name,
            medicine_name=item_in.medicine_name.strip(),
            generic_name=item_in.generic_name.strip(),
            quantity=item_in.quantity,
            unit=item_in.unit.strip() if item_in.unit else "strips",
            reorder_threshold=item_in.reorder_threshold,
            status=derived_status,
            batch_number=item_in.batch_number.strip() if item_in.batch_number else None,
            expiry_date=item_in.expiry_date.strip() if item_in.expiry_date else None,
            last_updated=datetime.utcnow()
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return cls._serialize_pharmacy_item(item)

    @classmethod
    def update_pharmacy_item(
        cls,
        db: Session,
        item_id: int,
        item_in: HospitalPharmacyItemUpdate,
        requesting_hospital_id: Optional[str] = None
    ) -> Dict[str, Any]:
        item = db.query(HospitalPharmacyItem).filter(HospitalPharmacyItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Pharmacy item not found")

        if requesting_hospital_id and item.hospital_id.lower() != requesting_hospital_id.lower():
            raise HTTPException(status_code=403, detail="Not authorized to modify pharmacy items for another hospital")

        if item_in.medicine_name is not None:
            item.medicine_name = item_in.medicine_name.strip()
        if item_in.generic_name is not None:
            item.generic_name = item_in.generic_name.strip()
        if item_in.quantity is not None:
            item.quantity = item_in.quantity
        if item_in.unit is not None:
            item.unit = item_in.unit.strip()
        if item_in.reorder_threshold is not None:
            item.reorder_threshold = item_in.reorder_threshold
        if item_in.batch_number is not None:
            item.batch_number = item_in.batch_number.strip()
        if item_in.expiry_date is not None:
            item.expiry_date = item_in.expiry_date.strip()

        # Re-derive status automatically based on updated quantity & threshold
        item.status = cls.derive_stock_status(item.quantity, item.reorder_threshold)
        item.last_updated = datetime.utcnow()

        db.commit()
        db.refresh(item)
        return cls._serialize_pharmacy_item(item)

    @classmethod
    def delete_pharmacy_item(
        cls,
        db: Session,
        item_id: int,
        requesting_hospital_id: Optional[str] = None
    ) -> Dict[str, Any]:
        item = db.query(HospitalPharmacyItem).filter(HospitalPharmacyItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Pharmacy item not found")

        if requesting_hospital_id and item.hospital_id.lower() != requesting_hospital_id.lower():
            raise HTTPException(status_code=403, detail="Not authorized to delete pharmacy items for another hospital")

        db.delete(item)
        db.commit()
        return {"success": True, "id": item_id, "message": "Pharmacy item deleted successfully"}

    @classmethod
    def _serialize_pharmacy_item(cls, item: HospitalPharmacyItem) -> Dict[str, Any]:
        return {
            "id": item.id,
            "hospital_id": item.hospital_id,
            "hospital_name": item.hospital_name,
            "medicine_name": item.medicine_name,
            "generic_name": item.generic_name,
            "quantity": item.quantity,
            "unit": item.unit,
            "reorder_threshold": item.reorder_threshold,
            "status": item.status,
            "batch_number": item.batch_number,
            "expiry_date": item.expiry_date,
            "last_updated": item.last_updated.isoformat() if item.last_updated else None
        }
