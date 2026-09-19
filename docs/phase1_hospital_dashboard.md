# Phase 1: Hospital Dashboard & Clinical Operations

## Overview
Phase 1 implements hospital-scoped clinical resource management and patient public visibility across three core sub-modules:
1. **Doctors & OPD Timetable Management**: Multi-slot availability schedule configuration, specialty indexing, active/inactive duty flags.
2. **Diagnostic & Laboratory Tests Catalog**: Test management with pricing in INR, turnaround times, and mandatory preparation guidelines.
3. **Pharmacy Stock & Inventory Control**: Real-time stock tracking with automated `LOW_STOCK` status derivation (`quantity <= reorder_threshold`), reorder threshold safeguards, and visual alerts.

---

## 1. Schema Changes

### `hospital_doctors` Table
```sql
CREATE TABLE hospital_doctors (
    id SERIAL PRIMARY KEY,
    hospital_id VARCHAR(100) NOT NULL,
    hospital_name VARCHAR(255),
    name VARCHAR(150) NOT NULL,
    speciality VARCHAR(100) NOT NULL,
    qualification VARCHAR(100),
    experience_years INTEGER DEFAULT 0,
    phone VARCHAR(50),
    availability_slots TEXT DEFAULT '[]', -- JSON-encoded DoctorSlot array
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_hospital_doctors_hospital_id ON hospital_doctors(hospital_id);
```

### `hospital_tests` Table
```sql
CREATE TABLE hospital_tests (
    id SERIAL PRIMARY KEY,
    hospital_id VARCHAR(100) NOT NULL,
    hospital_name VARCHAR(255),
    test_name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL, -- Pathology, Radiology, Cardiology, Biochemistry, Microbiology
    price FLOAT NOT NULL DEFAULT 0.0,
    prep_notes TEXT,
    turnaround_time VARCHAR(100),
    is_available BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_hospital_tests_hospital_id ON hospital_tests(hospital_id);
```

### `hospital_pharmacy_items` Table
```sql
CREATE TABLE hospital_pharmacy_items (
    id SERIAL PRIMARY KEY,
    hospital_id VARCHAR(100) NOT NULL,
    hospital_name VARCHAR(255),
    medicine_name VARCHAR(150) NOT NULL,
    generic_name VARCHAR(150) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    unit VARCHAR(50) NOT NULL DEFAULT 'strips',
    reorder_threshold INTEGER NOT NULL DEFAULT 10,
    status VARCHAR(20) NOT NULL DEFAULT 'IN_STOCK', -- "LOW_STOCK" | "IN_STOCK"
    batch_number VARCHAR(100),
    expiry_date VARCHAR(50),
    last_updated TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_hospital_pharmacy_hospital_id ON hospital_pharmacy_items(hospital_id);
```

---

## 2. API Endpoints

### Doctor Endpoints
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/hospitals/{hospital_id}/doctors` | Public / Patient | List doctors with optional `speciality`, `active_only`, and `search` filters. |
| `GET` | `/api/doctors/{doctor_id}` | Public / Patient | Fetch specific doctor details and availability slots. |
| `POST` | `/api/hospitals/{hospital_id}/doctors` | Hospital Scoped | Create new doctor under hospital account (`X-Hospital-Id`). |
| `PATCH` | `/api/doctors/{doctor_id}` | Hospital Scoped | Update doctor details, slots, or toggle active status. |
| `DELETE` | `/api/doctors/{doctor_id}` | Hospital Scoped | Delete doctor record with hospital ownership check. |

### Diagnostic Test Endpoints
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/hospitals/{hospital_id}/tests` | Public / Patient | List diagnostic tests with `category`, `available_only`, and `search` filters. |
| `GET` | `/api/tests/{test_id}` | Public / Patient | Fetch test details and preparation notes. |
| `POST` | `/api/hospitals/{hospital_id}/tests` | Hospital Scoped | Add test to hospital catalog. |
| `PATCH` | `/api/tests/{test_id}` | Hospital Scoped | Update test pricing, prep notes, turnaround, or availability. |
| `DELETE` | `/api/tests/{test_id}` | Hospital Scoped | Remove diagnostic test. |

### Pharmacy Inventory Endpoints
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/hospitals/{hospital_id}/pharmacy` | Public / Patient | List pharmacy items with `status` (`ALL`, `LOW_STOCK`, `IN_STOCK`), `sort_by`, `sort_order`, and `search`. |
| `GET` | `/api/pharmacy/{item_id}` | Public / Patient | Fetch medicine stock detail. |
| `POST` | `/api/hospitals/{hospital_id}/pharmacy` | Hospital Scoped | Register new medicine with auto-derived `LOW_STOCK` when `quantity <= reorder_threshold`. |
| `PATCH` | `/api/pharmacy/{item_id}` | Hospital Scoped | Update stock quantity or threshold; status automatically recalibrates. |
| `DELETE` | `/api/pharmacy/{item_id}` | Hospital Scoped | Delete medicine item. |

---

## 3. Key Design Decisions & Business Rules

1. **Auto-Derived Stock Status**:
   - Condition: `status = 'LOW_STOCK' if quantity <= reorder_threshold else 'IN_STOCK'`.
   - Verified across exact boundary (`quantity == reorder_threshold`), below threshold, and replenishment transitions.
2. **Server-Side Ownership Enforcement**:
   - Validates `X-Hospital-Id` header against the target hospital resource. Rejects cross-hospital unauthorized mutation with HTTP `403 Forbidden`.
3. **Public Patient Transparency**:
   - Endpoints permit public read access for rural patients searching hospital specialties, diagnostic pricing, and in-stock medications while strictly reserving mutations for authenticated hospital operators.
4. **Multi-Slot Schedule Serialization**:
   - Availability schedules are structured JSON arrays containing Day of Week, Start Time, End Time, and descriptive duty labels.

---

## 4. Phase 1 Log & Verification
- **Branch**: `feat/hospital-dashboard`
- **Test Suite**: `backend/tests/test_phase1_hospital.py` (9 tests passed: role access positive/negative, low stock boundary edge cases, multi-slot scheduler, and full end-to-end management flow).
- **Frontend Build**: Vite build validated (`npm run build`) with zero TypeScript errors.
