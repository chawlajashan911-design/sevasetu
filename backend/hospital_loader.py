import csv
import os
import math
from typing import List, Dict, Optional, Any

# Maharashtra geographical bounding box
MH_LAT_MIN = 15.60
MH_LAT_MAX = 22.05
MH_LNG_MIN = 72.60
MH_LNG_MAX = 80.95

# Standard reference center coordinates for Maharashtra districts
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
    'buldhana': (20.5292, 76.1843)
}

def is_within_maharashtra(lat: float, lng: float) -> bool:
    """Checks if GPS coordinate pair falls within Maharashtra geographic boundaries"""
    return (MH_LAT_MIN <= lat <= MH_LAT_MAX) and (MH_LNG_MIN <= lng <= MH_LNG_MAX)

def clean_val(val: Any) -> Optional[str]:
    """Cleans 0, null, None, and empty placeholder values cleanly"""
    if val is None:
        return None
    s = str(val).strip()
    if s in ['0', '0.0', 'NULL', 'null', 'None', 'NA', 'N/A', '', '-', '0, 0', '0,0']:
        return None
    return s

def parse_coords(coord_str: Optional[str]) -> Optional[Dict[str, float]]:
    """Parses Location_Coordinates string into valid {lat, lng} dict"""
    if not coord_str:
        return None
    s = str(coord_str).strip()
    if s in ['0', '0,0', '0.0, 0.0', '']:
        return None
    parts = s.split(',')
    if len(parts) == 2:
        try:
            lat = float(parts[0].strip())
            lng = float(parts[1].strip())
            if -90 <= lat <= 90 and -180 <= lng <= 180 and (lat != 0 or lng != 0):
                return {'lat': round(lat, 6), 'lng': round(lng, 6)}
        except (ValueError, TypeError):
            pass
    return None

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance in kilometers between two GPS points"""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 1)


class HospitalDirectory:
    def __init__(self):
        self.hospitals: List[Dict[str, Any]] = []
        self.load_csv()

    def load_csv(self):
        csv_path = os.path.join(os.path.dirname(__file__), "hospital_directory.csv")
        if not os.path.exists(csv_path):
            csv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "hospital_directory.csv")

        if not os.path.exists(csv_path):
            print(f"Warning: hospital_directory.csv not found at {csv_path}")
            return

        loaded: List[Dict[str, Any]] = []
        try:
            with open(csv_path, mode='r', encoding='utf-8', errors='ignore') as f:
                reader = csv.DictReader(f)
                for idx, r in enumerate(reader):
                    state = (r.get('State') or '').strip()
                    # Filter hospitals to Maharashtra
                    if state.lower() != 'maharashtra':
                        continue

                    name = clean_val(r.get('Hospital_Name'))
                    if not name:
                        continue

                    coords = parse_coords(r.get('Location_Coordinates'))
                    # Reject corrupted coordinates from dataset (e.g. New Delhi/Patna coordinates mistakenly entered in MH records)
                    if coords and not is_within_maharashtra(coords['lat'], coords['lng']):
                        coords = None
                    
                    # Phones & emergency contacts
                    phone = (
                        clean_val(r.get('Telephone')) or 
                        clean_val(r.get('Mobile_Number')) or 
                        clean_val(r.get('Emergency_Num')) or 
                        clean_val(r.get('Helpline')) or 
                        clean_val(r.get('Tollfree')) or
                        clean_val(r.get('Nodal_Person_Tele'))
                    )
                    ambulance = clean_val(r.get('Ambulance_Phone_No'))
                    
                    # Beds & Doctors
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

                    # If facility coordinates missing from CSV, interpolate from district center
                    inferred_coords = coords
                    if not inferred_coords and district:
                        dist_key = district.lower()
                        for d_name, d_coords in DISTRICT_CENTERS.items():
                            if d_name in dist_key or dist_key in d_name:
                                inferred_coords = {'lat': d_coords[0], 'lng': d_coords[1]}
                                break

                    loaded.append({
                        'id': f'hosp-{idx+1}',
                        'name': name,
                        'category': category or 'Healthcare Facility',
                        'care_type': care_type or 'Primary Health Centre / Hospital',
                        'address': address or (f'{subdistrict}, {district}' if subdistrict else district or 'Maharashtra'),
                        'district': district or 'Maharashtra',
                        'subdistrict': subdistrict,
                        'village': village,
                        'pincode': pincode,
                        'coordinates': inferred_coords,
                        'has_exact_gps': bool(coords),
                        'specialties': specialties,
                        'facilities': facilities,
                        'emergency_services': emergency,
                        'ambulance': ambulance or "108 Emergency Ambulance",
                        'phone': phone or "104 / 108",
                        'doctors': doctors,
                        'beds': beds,
                        'status': 'Operational (24x7)' if (emergency or 'Hospital' in (care_type or '')) else 'Open'
                    })

            self.hospitals = loaded
            print(f"Loaded {len(self.hospitals)} authentic Maharashtra healthcare facilities.")
        except Exception as e:
            print(f"Error loading hospital directory CSV: {e}")

    def search(
        self,
        district: Optional[str] = None,
        taluka: Optional[str] = None,
        village: Optional[str] = None,
        query: Optional[str] = None,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        category: Optional[str] = None,
        limit: int = 40
    ) -> Dict[str, Any]:
        """
        Searches, filters, and computes real spatial Haversine proximity.
        Includes boundary calculation if live GPS is outside Maharashtra.
        """
        district_clean = district.strip().lower() if district else None
        taluka_clean = taluka.strip().lower() if taluka else None
        query_clean = query.strip().lower() if query else None

        has_user_gps = (lat is not None and lng is not None)
        user_lat = float(lat) if has_user_gps else None
        user_lng = float(lng) if has_user_gps else None

        is_outside = False
        boundary_badge = "Maharashtra State Health Grid"
        nearest_node_dist = 0.0

        if has_user_gps:
            is_outside = not is_within_maharashtra(user_lat, user_lng)

        # Base reference coordinates if no live GPS supplied
        ref_lat = user_lat
        ref_lng = user_lng

        if ref_lat is None or ref_lng is None:
            if district_clean:
                for d_name, d_coords in DISTRICT_CENTERS.items():
                    if d_name in district_clean or district_clean in d_name:
                        ref_lat, ref_lng = d_coords
                        break
            if ref_lat is None or ref_lng is None:
                # Default to Pune center (18.5204, 73.8567)
                ref_lat, ref_lng = (18.5204, 73.8567)

        # Precompute nearest gateway facility if user is outside Maharashtra
        if is_outside and has_user_gps:
            min_dist = float('inf')
            nearest_name = "Maharashtra Border Gateway PHC"
            for h in self.hospitals:
                c = h.get('coordinates')
                if c and 'lat' in c and 'lng' in c:
                    d = haversine(user_lat, user_lng, c['lat'], c['lng'])
                    if d < min_dist:
                        min_dist = d
                        nearest_name = h['name']
            nearest_node_dist = round(min_dist, 1)
            boundary_badge = f"Nearest MH Grid Node: {nearest_node_dist:,.1f} km away ({nearest_name})"

        results = []
        for h in self.hospitals:
            h_district = (h.get('district') or '').lower()
            h_subdistrict = (h.get('subdistrict') or '').lower()
            h_village = (h.get('village') or '').lower()
            h_name = (h.get('name') or '').lower()
            h_spec = (h.get('specialties') or '').lower()
            h_fac = (h.get('facilities') or '').lower()
            h_addr = (h.get('address') or '').lower()

            # District filtering if explicitly requested and user didn't request global GPS proximity
            if district_clean and not (is_outside and has_user_gps):
                is_district_match = (
                    district_clean in h_district or 
                    h_district in district_clean or
                    district_clean in h_addr
                )
                if not is_district_match:
                    continue

            # Text query filtering
            if query_clean:
                if not (
                    query_clean in h_name or
                    query_clean in h_spec or
                    query_clean in h_fac or
                    query_clean in h_addr or
                    query_clean in h_district or
                    query_clean in h_subdistrict
                ):
                    continue

            # Category filter
            if category and category != 'All':
                cat_lower = category.lower()
                h_care = (h.get('care_type') or '').lower()
                h_cat = (h.get('category') or '').lower()
                if not (cat_lower in h_care or cat_lower in h_cat or cat_lower in h_spec):
                    continue

            item = dict(h)
            coords = h.get('coordinates')
            if coords and 'lat' in coords and 'lng' in coords:
                dist = haversine(ref_lat, ref_lng, coords['lat'], coords['lng'])
                item['distance_km'] = dist
            else:
                # Default to distance from Maharashtra state grid center
                item['distance_km'] = haversine(ref_lat, ref_lng, 18.5204, 73.8567)

            results.append(item)

        # Sort strictly by real Haversine distance
        results.sort(key=lambda x: x.get('distance_km', 9999))

        return {
            "district": district or ("Outside Maharashtra" if is_outside else "All Maharashtra"),
            "taluka": taluka,
            "village": village,
            "user_coordinates": {"lat": user_lat, "lng": user_lng} if has_user_gps else None,
            "is_outside_maharashtra": is_outside,
            "boundary_badge": boundary_badge,
            "nearest_border_distance_km": nearest_node_dist if is_outside else 0.0,
            "total_count": len(results),
            "facilities": results[:limit]
        }

    def search_by_name(self, query: str, district: Optional[str] = None, limit: int = 30) -> List[Dict[str, Any]]:
        """Fast autocomplete for login or selector"""
        q = (query or '').strip().lower()
        d = (district or '').strip().lower() if district else None
        
        matches = []
        prefix_matches = []
        substr_matches = []

        for h in self.hospitals:
            name = (h.get('name') or '').lower()
            h_dist = (h.get('district') or '').lower()
            h_addr = (h.get('address') or '').lower()

            if d and d not in h_dist:
                continue

            if not q:
                matches.append(h)
                if len(matches) >= limit:
                    break
                continue

            if name.startswith(q):
                prefix_matches.append(h)
            elif q in name or q in h_addr or q in h_dist:
                substr_matches.append(h)

            if len(prefix_matches) + len(substr_matches) >= limit * 2:
                break

        return (prefix_matches + substr_matches)[:limit]

    def get_by_name_or_id(self, identifier: str) -> Optional[Dict[str, Any]]:
        ident = (identifier or '').strip().lower()
        for h in self.hospitals:
            if h.get('id', '').lower() == ident or h.get('name', '').lower() == ident:
                return h
        return None

# Global singleton instance
hospital_directory = HospitalDirectory()
