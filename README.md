# SevaSetu (सेवासेतू / सेवासेतु) - Rural Healthcare AI & Tele-Care System

> **"Bridging the Healthcare Divide with Compassion, Dignity, and Intelligence."**  
> Operational Node: **Maharashtra Public Health Grid & Primary Care Network**

---

## 🕊️ The Sentiment & Purpose Behind SevaSetu

In hundreds of remote villages across rural India, the difference between life and death is often measured in kilometers and hours:
- An elderly grandmother struggling with chest tightness who cannot read English or type on a smartphone.
- A pregnant mother in a remote taluka whose dangerous blood pressure spike goes unnoticed because the nearest primary health centre (PHC) is three buses away.
- Dedicated ASHA (Accredited Social Health Activist) workers walking miles on unpaved roads, recording critical patient vitals in paper notebooks because there is no mobile network in the field.
- District medical officers who learn of infectious disease clusters days after the outbreak has already spread.

**SevaSetu (सेवासेतू — *Bridge of Service*)** was born out of a simple, uncompromising belief:  
**High-quality, timely, and dignified healthcare is a fundamental human right, not an urban privilege.**

SevaSetu is not just a software platform; it is a digital lifeline designed specifically for rural reality:
- **Speaks Their Language**: Pure Marathi (`मराठी`), Hindi (`हिंदी`), and English interfaces with native voice input for elderly and non-literate patients.
- **Never Stops Working**: True offline-first architecture. ASHA workers can screen patients deep in connectivity-dark zones; everything syncs seamlessly when a signal is re-established.
- **Safeguards Every Life**: Deterministic clinical AI triage aligned with Indian Public Health Standards (IPHS), flagging P1 critical emergencies within seconds, calculating hospital proximity, and preparing 1-touch 108 ambulance dispatch.
- **Empowers the Grassroots**: Recognizes and tracks NHM incentives for frontline health workers while bridging them directly with doctors via telemedicine.

---

## 🌟 Key Architecture Highlights

```
                    ┌──────────────────────────────────────────────┐
                    │               SEVASETU SYSTEM                │
                    │   Single-Instance Unified Architecture       │
                    └──────────────────────┬───────────────────────┘
                                           │
         ┌─────────────────────────────────┴─────────────────────────────────┐
         │                                                                   │
         ▼                                                                   ▼
┌─────────────────────────────────┐                         ┌─────────────────────────────────┐
│        Frontend (React SPA)     │                         │       Backend (FastAPI Engine)  │
│  • Vite + TailwindCSS           │                         │  • High-performance ASGI Async  │
│  • High-Contrast Elderly UI     │   Same-Origin (/api)    │  • IPHS Rule-Based Triage Engine│
│  • Multilingual (EN / MR / HI)  │ ◄─────────────────────► │  • Supabase PostgreSQL Database │
│  • Web Speech API Voice Input   │                         │  • Static & SPA Asset Serving   │
│  • Offline Dexie.js (IndexedDB) │                         │  • ABDM / FHIR / eSanjeevani    │
└─────────────────────────────────┘                         └─────────────────────────────────┘
         │                                                                   │
         └─────────────────────────────────┬─────────────────────────────────┘
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │     Unified Docker Container (Render Web)    │
                    │   0.0.0.0:$PORT  │  Zero-CORS  │  512MB RAM  │
                    └──────────────────────────────────────────────┘
```

1. **Accessibility-First Design**:
   - High-contrast visual palette, oversized touch targets, one-tap symptom chips, and zero typing required.
   - Seamless multilingual switcher between **Marathi**, **Hindi**, and **English**.
   - Built-in Indic speech recognition adapter (Web Speech API + BHASHINI mock pipeline).

2. **Deterministic AI Smart Triage (IPHS Aligned)**:
   - **P1 Critical**: Systolic BP $\ge 160$ mmHg, $\text{SpO}_2 \le 90\%$, high-risk maternal indicators. Immediate hospital routing.
   - **P2 Urgent**: Temperature $\ge 102^\circ\text{F}$, symptoms lasting $> 3$ days. Next-available doctor consultation.
   - **P3 Routine**: Stable vitals, routine care, self-care guidance.
   - *Clinical Safeguard*: Operates as an assistive priority calculator with mandatory doctor verification, never an unsupervised medical diagnostic.

3. **Offline-First Resilience (Dexie.js / IndexedDB)**:
   - Complete local offline data persistence. Field workers can register patients, conduct vitals screening, and evaluate triage without an internet connection.
   - Real-time pending sync indicator with one-click cryptographic batch sync (`/api/sync/batch`) when online.

4. **Authentic Geospatial Directory**:
   - Indexed database of **4,807 authentic Maharashtra hospitals** and **44,810 authentic Maharashtra villages**.
   - Live GPS distance calculation from the patient's coordinates to the nearest sub-centre, PHC, rural hospital, or district medical college.
   - Direct 108 Emergency Ambulance dialer with automated SMS dispatch containing exact GPS coordinates and clinical urgency level.

5. **Integrated Digital Health Mock Adapters**:
   - **ABDM / FHIR**: Instant 14-digit ABHA Card generator with scannable QR code.
   - **BHASHINI**: Real-time Indic voice transcription and translation engine.
   - **eSanjeevani**: Teleconsultation suite with video, audio, and live clinical messaging.

---

## 🧭 The Six Integrated Portals

| Portal | Intended Users | Key Capabilities |
|:-------|:---------------|:-----------------|
| **1. Patient Portal** (`/patient`) | Rural citizens, elderly patients, families | Symptom check via voice/chips, triage result, nearest hospital routing, 1-touch 108 SOS, ABHA card generator. |
| **2. ASHA Worker Portal** (`/health-worker`) | Grassroots frontline community health activists | 100% offline field screening, offline triage evaluation, batch sync to central cloud, NHM incentive tracker. |
| **3. Doctor Portal** (`/doctor`) | Medical officers, tele-consulting physicians | Priority queue with P1 Critical pinned at top, full vitals dossier, clinical rule breakdown, e-Prescriptions, and eSanjeevani teleconsultation. |
| **4. PHC / Clinic Portal** (`/clinic`) | Primary Health Centre nurses & operators | Daily outpatient check-in, vital screening, local queue management, and doctor teleconsult scheduling. |
| **5. Hospital Referral Portal** (`/hospital`) | Sub-district & District Hospital staff | Incoming emergency ambulance notifications, referral intake, bed availability triage, and admission tracking. |
| **6. District Admin Portal** (`/admin`) | Taluka Health Officers, District Collectors | Taluka-level KPI analytics, PHC essential medicine inventory with low-stock warnings (<20%), outbreak cluster surveillance heatmap, and referral flow charts. |

---

## 🚀 Running the Project

### Method 1: Single-Instance Unified Docker Deployment (Recommended)

Both the React SPA and FastAPI backend run in a single container. The React frontend is compiled during the multi-stage build, and FastAPI serves both the static UI and API on port `8000`.

#### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) installed.

```bash
# 1. Clone repository
git clone https://github.com/chawlajashan911-design/sevasetu.git
cd sevasetu

# 2. Build and run using Docker Compose
docker compose up --build
```

Or build and run manually with the Docker CLI:

```bash
# Build the multi-stage image
docker build -t sevasetu .

# Run container (pass DATABASE_URL if connecting to Supabase/PostgreSQL)
docker run -p 8000:8000 \
  -e DATABASE_URL="postgresql://postgres:password@db.supabase.co:5432/postgres" \
  sevasetu
```

Visit the application at: **`http://localhost:8000`**  
- **React Web App**: `http://localhost:8000/`
- **FastAPI Documentation**: `http://localhost:8000/docs`
- **Health Check**: `http://localhost:8000/api/health`

---

### Method 2: Local Dual-Process Development

For active frontend or backend development with Hot Module Replacement (HMR) and live reload.

#### Prerequisites
- **Python 3.10+**
- **Node.js 18+** and **npm**

#### Step 1: Backend Setup
```bash
# In project root
python3 -m venv backend/venv
source backend/venv/bin/activate
pip install -r backend/requirements.txt

# Create .env file with your database connection
echo 'DATABASE_URL="postgresql://postgres:password@db.supabase.co:5432/postgres"' > .env

# Start FastAPI server with live reload
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
*Backend runs at: **http://127.0.0.1:8000***  
*Swagger API Docs: **http://127.0.0.1:8000/docs***

#### Step 2: Frontend Setup
```bash
# In a new terminal tab
cd frontend
npm install
npm run dev
```
*Frontend runs at: **http://localhost:5173***  
*Vite automatically proxies `/api` calls to `http://127.0.0.1:8000` via `vite.config.ts`.*

---

## ☁️ Deployment Guide: Render Single-Instance

Previously, deploying the frontend and backend required two separate services on Render (one Web Service and one Static Site), which consumed double the free tier instance hours and required cross-origin CORS configuration.

With the unified Docker architecture, **both frontend and backend run on a single Render Web Service instance**.

### Step-by-Step Render Deployment:

1. **Push your repository to GitHub**:
   Ensure all changes are pushed to your GitHub repository `main` branch.

2. **Log into Render**:
   Go to [Render Dashboard](https://dashboard.render.com/).

3. **Deploy with Blueprint (`render.yaml`)**:
   - Click **New +** → **Blueprint**.
   - Connect your `sevasetu` repository.
   - Render will detect `render.yaml` and configure a single Web Service:
     - **Service Name**: `sevasetu`
     - **Environment**: `Docker`
     - **Plan**: `Free`
     - **Dockerfile**: `./Dockerfile`

4. **Configure Environment Variables**:
   - In the Render Dashboard, open your service settings → **Environment**.
   - Add the following variable:
     - **`DATABASE_URL`**: Your Supabase PostgreSQL connection string (format: `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres`).
   - *(Note: Render automatically injects `PORT=10000`, which our Docker entrypoint handles dynamically).*

5. **Deploy & Verify**:
   - Click **Manual Deploy** → **Deploy latest commit** (or let the auto-deploy trigger).
   - Once build finishes, open your Render URL (e.g., `https://sevasetu.onrender.com`):
     - `https://your-service.onrender.com/` → Renders the React UI.
     - `https://your-service.onrender.com/doctor` → Direct link to Doctor portal (SPA fallback).
     - `https://your-service.onrender.com/api/health` → Returns `{"status": "healthy"}`.
     - `https://your-service.onrender.com/docs` → Interactive OpenAPI / Swagger documentation.

---

## ⚙️ Environment Variables Reference

| Variable | Required | Default | Description |
|:---------|:--------:|:--------|:------------|
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string (Supabase). Automatically normalizes `postgres://` to `postgresql://`. Supports SQLite for local tests (`sqlite:///./local.db`). |
| `PORT` | No | `8000` | Port for the Uvicorn ASGI server. Injected automatically by Render. |
| `FRONTEND_DIST` | No | `frontend/dist` | Absolute or relative path to compiled React build directory. |
| `VITE_API_URL` | No | `""` (relative `/api`) | In unified production mode, leave unset to use same-origin `/api`. Set only if running frontend on a separate standalone CDN. |

---

## 📁 Repository Structure

```
sevasetu/
├── .dockerignore              # Excludes virtualenvs, node_modules, and cache files
├── Dockerfile                 # Multi-stage build (Node 20 Alpine + Python 3.11 Slim)
├── docker-compose.yml         # Local container orchestration
├── render.yaml                # Single-instance Render deployment blueprint
├── README.md                  # Project overview, sentiment, and setup guide
│
├── backend/                   # FastAPI Backend
│   ├── database.py            # SQLAlchemy engine, Supabase connection & URL normalizer
│   ├── hospital_loader.py     # High-speed query engine for 4,807 Maharashtra hospitals
│   ├── main.py                # FastAPI routes, SPA fallback, & static asset mounting
│   ├── models.py              # SQLAlchemy database tables & relational models
│   ├── mock_services.py       # ABDM, BHASHINI Indic NLP, & eSanjeevani adapters
│   ├── requirements.txt       # Python dependencies (FastAPI, SQLAlchemy, Uvicorn, psycopg2)
│   ├── schemas.py             # Pydantic data validation schemas
│   └── triage_engine.py       # Deterministic clinical rule-based triage logic (IPHS)
│
└── frontend/                  # React + TypeScript + Vite Frontend
    ├── package.json           # Frontend dependencies (React 18, Tailwind, Dexie, Lucide)
    ├── vite.config.ts         # Vite build configuration & dev proxy
    ├── tsconfig.json          # TypeScript compiler configuration
    └── src/
        ├── vite-env.d.ts      # Vite client type definitions
        ├── App.tsx            # Main application router and state manager
        ├── types/             # Unified TypeScript domain definitions
        ├── db/dexie.ts        # IndexedDB offline-first persistence engine
        ├── services/api.ts    # Centralized HTTP API client (relative same-origin /api)
        ├── hooks/             # Custom React hooks (useGeolocation, useSpeech)
        ├── components/        # Modals (SOS, ABHA Card, Teleconsult, Search selects)
        └── portals/           # Dedicated portals:
            ├── PatientPortal.tsx
            ├── AshaPortal.tsx
            ├── DoctorPortal.tsx
            ├── ClinicPortal.tsx
            ├── HospitalPortal.tsx
            └── AdminPortal.tsx
```

---

## 📜 Clinical & Legal Disclaimer

> **SevaSetu AI Smart Triage is an assistive clinical workflow and priority calculator designed to prioritize emergency interventions in resource-constrained rural settings. It is NOT a diagnostic medical device and does NOT replace the clinical judgment, diagnosis, or treatment plan of a registered medical practitioner (RMP). Every emergency case requires physical or telemedicine verification by a qualified physician.**

---

## 🤝 Contributing & License

Contributions are welcome! Please submit a Pull Request or open an Issue on GitHub.  
Built with care for rural public healthcare communities across Maharashtra and India.
