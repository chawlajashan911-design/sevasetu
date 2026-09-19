# AI Symptom → Best Hospital Match

## Overview
Intelligent symptom-to-hospital matching engine that combines AI-powered clinical reasoning with live database ranking to recommend the best healthcare facility for a patient's symptoms.

**Architecture Split (Critical Design Decision):**
1. **Gemini Reasoning Layer** — Analyzes symptoms, age, sex, and duration to produce structured clinical JSON. Never names a hospital or doctor. Output is cached by symptom SHA-256 hash.
2. **Live Backend Ranking Layer** — Always queries fresh DB records (never cached) to score hospitals across 4 dimensions: doctor availability, diagnostic test coverage, medicine stock status, and proximity.

---

## Endpoint

### `POST /api/symptom-match`

**Request:**
```json
{
  "symptoms": "Severe chest pain with breathlessness and sweating",
  "age": 55,
  "sex": "Male",
  "duration": "2 hours",
  "lat": 18.5204,
  "lng": 73.8567,
  "district": "Pune",
  "manual_speciality": null
}
```

**Response:**
```json
{
  "assessment": {
    "urgency": "EMERGENCY",
    "specialities": [{ "name": "Cardiology", "confidence": 0.95 }],
    "suggested_tests": ["ECG (12-Lead)", "Complete Blood Count (CBC)"],
    "medicine_categories": ["Cardiac & Antianginal", "Analgesics & Antipyretics"],
    "summary": "Acute chest pain with diaphoresis strongly suggests ...",
    "cached": false,
    "fallback_used": false
  },
  "emergency_override": {
    "is_emergency": true,
    "alert_message": "CRITICAL EMERGENCY / RED FLAG DETECTED: ...",
    "nearest_facility": {
      "hospital_id": "hospital_aundh",
      "hospital_name": "Aundh District Hospital",
      "distance_km": 5.2,
      "emergency_services": "24x7 Emergency & Trauma Unit",
      "ambulance": "108 Service Available",
      "phone": "020-25881234"
    }
  },
  "ranked_hospitals": [
    {
      "hospital_id": "hospital_aundh",
      "hospital_name": "Aundh District Hospital",
      "distance_km": 5.2,
      "score": 87.5,
      "score_breakdown": {
        "doctor_score": 40.0,
        "test_score": 22.5,
        "medicine_score": 15.0,
        "distance_score": 10.0
      },
      "doctor": {
        "name": "Dr. Arvind Kulkarni",
        "speciality": "Cardiology",
        "next_slot": "Monday 09:00 - 13:00",
        "qualification": "MBBS, MD, DM (Cardiology)"
      },
      "tests_available": ["ECG (12-Lead)"],
      "tests_missing": ["CT Brain"],
      "medicine_stock_status": [
        { "category": "Cardiac & Antianginal", "status": "IN_STOCK", "medicine_name": "Tab Amlodipine 5mg" }
      ],
      "is_emergency_capable": true
    }
  ],
  "disclaimer": "AI symptom assessment and hospital matching is for navigational and informational guidance only ..."
}
```

### `GET /api/symptom-match/enums`

Returns available master specialities, test names, and medicine categories for frontend dropdowns and manual specialty override.

---

## Scoring Formula (100 points max)

| Factor | Max Points | Methodology |
|---|---|---|
| **Doctor Match** | 40 | Active doctor in matched specialty × confidence + slot bonus (10 pts if availability exists) |
| **Diagnostic Tests** | 25 | `(available_tests / suggested_tests) × 25` — match ratio of available tests |
| **Medicine Stock** | 20 | Per-category average: `IN_STOCK = 1.0`, `LOW_STOCK = 0.5`, `OUT_OF_STOCK = 0.0` × 20 |
| **Proximity** | 15 | `15 × (1 - distance_km / 50)` — linear decay over 50 km radius |

---

## Gemini Prompt Design

The prompt template:
1. Constrains speciality, test, and medicine category choices to **dynamic DB-derived enums** (via `get_constrained_enums()`), merged with master clinical lists.
2. Prohibits Gemini from naming any hospital, doctor, or specific drug brand/dosage.
3. Expects strict JSON-only output with `urgency`, `specialities`, `suggested_tests`, `medicine_categories`, and `summary`.
4. Handles markdown code-fence wrapping (`\`\`\`json ... \`\`\``) and malformed output gracefully.

**Caching:** Gemini JSON output is cached in-memory by SHA-256 hash of `(symptoms|age|sex|duration)`. Hospital ranking is **never cached** — always live from DB.

---

## Safety Guardrails

1. **Emergency Override:** When `urgency == "EMERGENCY"`, the nearest emergency-capable facility (with `emergency_services` or `ambulance` or tertiary care type) is pinned at rank #1 with a red-alert banner.
2. **Persistent Disclaimer:** Every response includes a non-removable clinician disclaimer.
3. **No Diagnosis or Dosage:** The system never displays diagnoses or drug dosages to the patient.
4. **Fallback Handler:** When Gemini API key is missing or call fails, a deterministic rule-based keyword matcher provides safe conservative routing.
5. **Manual Override:** Patient can manually select a specialty to bypass AI reasoning entirely.

---

## Files

| File | Purpose |
|---|---|
| `backend/services/symptom_matching_service.py` | Core service: Gemini reasoning, fallback handler, live DB ranking engine |
| `backend/schemas.py` | Pydantic schemas: `SymptomMatchRequest`, `SymptomAssessment`, `HospitalMatchResult`, `SymptomMatchResponse` |
| `backend/main.py` | `POST /api/symptom-match` and `GET /api/symptom-match/enums` endpoints |
| `backend/tests/test_symptom_match.py` | 8 tests: schema validation, live ranking recomputation, emergency path, fallback, enums, input validation |
| `frontend/src/services/api.ts` | `api.matchSymptomToHospitals()` and `api.getSymptomMatchEnums()` |
| `frontend/src/portals/PatientPortal.tsx` | AI Hospital Matcher tab with input form, score breakdown cards, emergency banner, and disclaimer |

---

## Test Coverage (8/8 passing)

| Test | What it validates |
|---|---|
| `test_gemini_bad_json_recovers_to_valid_schema` | Malformed Gemini output → graceful fallback recovery |
| `test_gemini_markdown_fence_stripping` | JSON wrapped in markdown code fences → properly parsed |
| `test_ranking_recomputes_live_when_doctor_or_stock_changes` | DB mutations (doctor deactivated, pharmacy depleted) → live score recalculation |
| `test_emergency_path_pins_nearest_emergency_facility` | Emergency symptoms → override banner + nearest emergency facility pinned first |
| `test_manual_speciality_override_path` | Manual specialty → bypasses Gemini, uses fallback with confidence 1.0 |
| `test_rule_based_keyword_fallback` | Keyword matching across diverse specialties (OBGY, Orthopedics, Dermatology) |
| `test_get_symptom_match_enums` | `GET /api/symptom-match/enums` returns valid master lists |
| `test_empty_symptoms_validation` | Empty symptoms string → HTTP 400 |
