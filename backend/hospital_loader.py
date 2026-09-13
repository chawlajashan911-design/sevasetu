"""
Hospital directory queries — backed by Supabase PostgreSQL (hospitals table).
All 4,807 Maharashtra hospitals are pre-loaded via migrate_data.py.
This module provides the same API surface as the old CSV-based HospitalDirectory class
so main.py needs zero changes in how it calls search/search_by_name/get_by_name_or_id.
"""
import math
from typing import List, Dict, Optional, Any

from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from .models import Hospital


# Standard reference center coordinates for Maharashtra districts
# Used for distance sorting when no explicit lat/lng is provided
DISTRICT_CENTERS: Dict[str, tuple] = {
    'thane': (19.2183, 72.9781),
    'pune': (18.5204, 73.8567),
    'mumbai': (18.9220, 72.8347),
    'mumbai suburban': (19.1136, 72.8697),
    'ahmednagar': (19.0952, 74.7496),
    'ahilyanagar': (19.0952, 74.7496),
    'nashik': (19.9975, 73.7898),
    'jalna': (19.8347, 75.8816),
    'aurangabad': (19.8762, 75.3433),
    'chhatrapati sambhajinagar': (19.8762, 75.3433),
    'solapur': (17.6599, 75.9064),
    'kolhapur': (16.7050, 74.2433),
    'satara': (17.6805, 73.9997),
    'sangli': (16.8524, 74.5815),
    'raigad': (18.5158, 73.1812),
    'palghar': (19.6967, 72.7699),
    'ratnagiri': (16.9902, 73.3120),
    'sindhudurg': (16.1178, 73.7029),
    'nagpur': (21.1458, 79.0882),
    'amravati': (20.9320, 77.7523),
    'akola': (20.7002, 77.0082),
    'yavatmal': (20.3888, 78.1204),
    'wardha': (20.7453, 78.6022),
    'chandrapur': (19.9615, 79.2961),
    'gadchiroli': (20.1809, 80.0033),
    'bhandara': (21.1458, 79.6548),
    'gondia': (21.4598, 80.1961),
    'nanded': (19.1383, 77.3210),
    'parbhani': (19.2644, 76.7767),
    'hingoli': (19.7196, 77.1485),
    'latur': (18.4088, 76.5604),
    'osmanabad': (18.1856, 76.0419),
    'dharashiv': (18.1856, 76.0419),
    'beed': (18.9891, 75.7601),
    'jalgaon': (21.0077, 75.5626),
    'dhule': (20.9042, 74.7749),
    'nandurbar': (21.3712, 74.2404),
    'washim': (20.1114, 77.1332),
    'buldhana': (20.5292, 76.1843),
}


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance in km between two coordinates."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    return round(R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 1)


def _hospital_to_dict(h: Hospital, ref_lat: float, ref_lng: float) -> Dict[str, Any]:
    """Converts a Hospital ORM row to the dict shape the frontend expects."""
    coords = None
    distance_km = 12.0  # default fallback

    if h.lat and h.lng:
        coords = {'lat': h.lat, 'lng': h.lng}
        distance_km = haversine(ref_lat, ref_lng, h.lat, h.lng)

    return {
        'id': h.id,
        'name': h.name,
        'category': h.category or 'Healthcare Facility',
        'care_type': h.care_type or 'Hospital',
        'address': h.address or f'{h.subdistrict}, {h.district}' if h.subdistrict else (h.district or 'Maharashtra'),
        'district': h.district or 'Maharashtra',
        'subdistrict': h.subdistrict,
        'village': h.village,
        'pincode': h.pincode,
        'coordinates': coords,
        'specialties': h.specialties,
        'facilities': h.facilities,
        'emergency_services': h.emergency_services,
        'ambulance': h.ambulance,
        'phone': h.phone,
        'doctors': h.doctors,
        'beds': h.beds,
        'status': h.status or 'Open',
        'distance_km': distance_km,
    }


def _resolve_ref_coords(district: Optional[str], lat: Optional[float], lng: Optional[float]):
    """Returns best available reference coordinates for distance sorting."""
    if lat is not None and lng is not None:
        return lat, lng
    if district:
        d_lower = district.strip().lower()
        for d_name, d_coords in DISTRICT_CENTERS.items():
            if d_name in d_lower or d_lower in d_name:
                return d_coords
    return 19.2183, 72.9781  # Default: Thane centre


class HospitalDirectory:
    """
    Drop-in replacement for the old CSV-based HospitalDirectory.
    All methods accept the same arguments and return the same dict shapes
    so main.py and the frontend require zero changes.
    """

    _cached_count: Optional[int] = None
    _cached_count_time: float = 0.0

    def get_count(self) -> int:
        """Returns cached total hospital count from PostgreSQL."""
        import time
        now = time.time()
        if HospitalDirectory._cached_count is not None and (now - HospitalDirectory._cached_count_time) < 300:
            return HospitalDirectory._cached_count
        from .database import SessionLocal
        db: Session = SessionLocal()
        try:
            cnt = db.query(func.count(Hospital.id)).scalar() or 0
            HospitalDirectory._cached_count = cnt
            HospitalDirectory._cached_count_time = now
            return cnt
        finally:
            db.close()

    @property
    def hospitals(self) -> List[Any]:
        """
        Lightweight list for len(hospital_directory.hospitals).
        Uses cached scalar count instead of querying all rows.
        """
        return [None] * self.get_count()

    def search(
        self,
        district: Optional[str] = None,
        taluka: Optional[str] = None,
        village: Optional[str] = None,
        query: Optional[str] = None,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        category: Optional[str] = None,
        limit: int = 40,
    ) -> List[Dict[str, Any]]:
        """
        Returns authentic government & registered hospitals from Supabase hospitals table
        filtered by district/taluka/village, sorted by proximity.
        """
        from .database import SessionLocal
        db: Session = SessionLocal()
        try:
            q = db.query(Hospital)

            if district:
                q = q.filter(Hospital.district.ilike(f'%{district}%'))
            elif lat is not None and lng is not None:
                # Spatial bounding box (~1.5 deg ≈ 165 km) for fast index retrieval
                q = q.filter(
                    Hospital.lat.between(lat - 1.5, lat + 1.5),
                    Hospital.lng.between(lng - 1.5, lng + 1.5)
                )

            if query:
                q = q.filter(
                    or_(
                        Hospital.name.ilike(f'%{query}%'),
                        Hospital.specialties.ilike(f'%{query}%'),
                        Hospital.facilities.ilike(f'%{query}%'),
                        Hospital.address.ilike(f'%{query}%'),
                        Hospital.district.ilike(f'%{query}%'),
                        Hospital.subdistrict.ilike(f'%{query}%'),
                    )
                )

            if category and category != 'All':
                q = q.filter(
                    or_(
                        Hospital.care_type.ilike(f'%{category}%'),
                        Hospital.category.ilike(f'%{category}%'),
                        Hospital.specialties.ilike(f'%{category}%'),
                    )
                )

            rows = q.limit(limit * 3).all()  # Fetch extra for distance re-sorting

            ref_lat, ref_lng = _resolve_ref_coords(district, lat, lng)
            results = [_hospital_to_dict(h, ref_lat, ref_lng) for h in rows]

            # Sort by distance
            results.sort(key=lambda x: x.get('distance_km', 999))

            # If < 5 results with district filter, widen to all districts sorted by proximity
            if len(results) < 5 and district:
                wider = db.query(Hospital).filter(
                    Hospital.id.notin_([r['id'] for r in results])
                ).limit(20).all()
                wider_dicts = [_hospital_to_dict(h, ref_lat, ref_lng) for h in wider]
                wider_dicts.sort(key=lambda x: x.get('distance_km', 999))
                results.extend(wider_dicts[:10])

            return results[:limit]
        finally:
            db.close()

    def search_by_name(
        self,
        query: str,
        district: Optional[str] = None,
        limit: int = 30,
    ) -> List[Dict[str, Any]]:
        """
        Fast autocomplete search by hospital name.
        Used by HospitalSearchSelect and hospital login selector.
        Returns list of facility dicts (same shape as search()).
        """
        from .database import SessionLocal
        db: Session = SessionLocal()
        try:
            q_str = (query or '').strip()
            q = db.query(Hospital)

            if district:
                q = q.filter(Hospital.district.ilike(f'%{district}%'))

            if q_str:
                # Prefix matches first via ILIKE, then general substring
                prefix_q = q.filter(Hospital.name.ilike(f'{q_str}%')).limit(limit)
                prefix_results = prefix_q.all()
                prefix_ids = {h.id for h in prefix_results}

                substr_q = q.filter(
                    Hospital.name.ilike(f'%{q_str}%'),
                    Hospital.id.notin_(prefix_ids)
                ).limit(limit)
                substr_results = substr_q.all()

                rows = prefix_results + substr_results
            else:
                rows = q.limit(limit).all()

            ref_lat, ref_lng = _resolve_ref_coords(district, None, None)
            return [_hospital_to_dict(h, ref_lat, ref_lng) for h in rows[:limit]]
        finally:
            db.close()

    def get_by_name_or_id(self, identifier: str) -> Optional[Dict[str, Any]]:
        """Fetches a single hospital by its id string or exact name."""
        from .database import SessionLocal
        db: Session = SessionLocal()
        try:
            ident = (identifier or '').strip()
            h = (
                db.query(Hospital)
                .filter(or_(
                    func.lower(Hospital.id) == ident.lower(),
                    func.lower(Hospital.name) == ident.lower(),
                ))
                .first()
            )
            if not h:
                return None
            ref_lat, ref_lng = _resolve_ref_coords(h.district, None, None)
            return _hospital_to_dict(h, ref_lat, ref_lng)
        finally:
            db.close()


# Global singleton — same as before, main.py imports this
hospital_directory = HospitalDirectory()
