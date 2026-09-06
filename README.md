# sevasetu
 
 
=======
# SevaSetu (सेवासेतू / सेवासेतु) - Rural Healthcare AI System

> **Smart Village Health Grid & Tele-care System**  
> Operational Node: **Kharpudi Primary Health Centre**, Ambegaon Taluka, Pune District, Maharashtra.

---

## 🌟 Key Highlights

1. **Accessibility for Elderly & Rural Communities**:
   - High-contrast visual design, large touch targets, minimal typing, one-touch symptom chips.
   - Clean multilingual switcher:
     - **English**: Pure English interface.
     - **Marathi (`मराठी`)**: Pure Marathi interface.
     - **Hindi (`हिंदी`)**: Pure Hindi interface.
   - **Web Speech API Voice Input** in Indic languages.

2. **Deterministic AI Smart Triage (IPHS Aligned)**:
   - **P1 Critical**: Systolic BP $\ge 160$ mmHg, $\text{SpO}_2 \le 90\%$, High-risk Maternal indicators.
   - **P2 Urgent**: Temperature $\ge 102^\circ\text{F}$, Symptom duration $> 3$ days.
   - **P3 Routine**: Stable baseline vitals.
   - Explicit disclaimer: *"Clinical AI triage priority score, NOT a medical diagnosis. Doctor verification required."* Structured for future XGBoost / ML classifier drop-in.

3. **Offline-First Dexie.js Architecture**:
   - Field screening works 100% without internet using IndexedDB (`Dexie.js`).
   - "Offline Mode" toggle with real-time pending sync badge.
   - One-click batch sync (`/api/sync/batch`) when internet is restored.

4. **Emergency SOS & Geolocation**:
   - Real-time GPS capture with distance calculations to Kharpudi Sub-Centre, Kharpudi PHC, Manchar Rural Hospital, and Pune District Hospital.
   - Direct 108 Ambulance dialer + automated GPS SMS dispatcher (`sms:108?body=...`).

5. **Integrated Digital Health Mock Adapters**:
   - **ABDM / FHIR**: 14-digit ABHA Card generator + QR code placeholder.
   - **BHASHINI**: Indic translation & speech engine adapter.
   - **eSanjeevani**: Teleconsultation room suite (Video, Audio, Live Chat, Async Voice+Photo).

---

## 🚀 Quickstart Commands

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 2. Backend Setup (FastAPI + SQLite / MySQL)

```bash
# From project root
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt

# Run FastAPI server (runs on http://127.0.0.1:8000)
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

*Note: Database automatically connects to MySQL if `DATABASE_URL` is set (e.g. `DATABASE_URL=mysql+pymysql://root:pass@localhost:3306/rural_health`), and seamlessly defaults to `sqlite:///./rural_healthcare.db` with auto-seeded records for Kharpudi.*

### 3. Frontend Setup (React + Tailwind + Vite + Dexie)

```bash
# Open a new terminal
cd frontend
npm install
npm run dev
```

*Frontend runs at: **http://localhost:5173***

---

## 🧭 Four Integrated Portals

1. **Patient Portal**: Self-registration (no prefilled fields), interactive health check, symptom chips, voice input, AI triage results, nearby PHC locator with GPS distance, 1-touch Emergency SOS (108), and ABHA card generator.
2. **ASHA Worker Portal**: Field patient screening, Dexie.js offline storage, one-click central sync, facility referral creator, and NHM incentive earnings tracker.
3. **Doctor Portal**: Priority-ordered queue (P1 Critical top-pinned), case dossier, clinical rules explanation, doctor verification & e-Prescription, and eSanjeevani teleconsultation room.
4. **District Admin Portal**: Taluka KPIs, PHC medicine inventory monitor with low-stock warnings (<20%), outbreak heatmap & cluster surveillance, and referral chain analytics.
