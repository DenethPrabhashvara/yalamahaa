# Yala Maha

Water resource management, reservoir forecasting, and agricultural early warning platform built for farmers and irrigation officers across Sri Lanka.

The system connects live river gauge readings from the Irrigation Department, satellite terrain elevation models, Open-Meteo meteorological data, and a 14-day machine learning tank forecast model to provide early warnings and irrigation scheduling to farmers even on budget phones with low connectivity.

---

## Architecture Overview

The platform is organized into modular services coordinated via Docker Compose:

### 1. Farmer Portal (`farmerportal/`)
- Mobile-first web application built with React 18 and Vite. Also packaged as a native Android APK via Capacitor.
- Full trilingual support in English, Sinhala, and Tamil with Sri Lankan agricultural terminology.
- Interactive Leaflet maps showing 117 primary reservoirs with real-time fill percentages, storage volumes, and spill statuses.
- 14-day predictive reservoir storage outlook with historical trend comparison.
- Canal maintenance incident reporting with photo upload and location tagging.
- SMS reminder subscriptions for canal water issue schedules.
- Live disaster assessment and relief surveys targeted by district, reservoir, or individual farm.
- AI Assistant chat bubble with text and spoken Sinhala, Tamil, and English audio.

### 2. Admin Command Center (`adminportal/`)
- Dashboard for irrigation officers, disaster management personnel, and system operators.
- Reservoir network monitoring and 30-day daily storage trend visualization.
- River gauge telemetry with operational warning thresholds (Alert, Minor, Major).
- SMS Gateway management integrated with Text.lk API v3 supporting Unicode and multi-recipient broadcasts.
- Automated warning call control center with weather simulation, dry-run testing, and Twilio voice calls.
- Disaster survey builder with question branching, demographic targeting, and CSV export.

### 3. Backend API (`api/`)
- Node.js and Express REST API running on port 8005.
- PostgreSQL database integration for farmers, farms, crops, water schedules, reports, and survey responses.
- Redis cache for OTP verification, rate limiting, and session invalidation.
- Automated background jobs:
  - River gauge flood alert dispatch (`services/floodAlertJob.js`).
  - Water release SMS reminders (`services/reminderJob.js`).
  - Irrigation scheme geospatial matching (`services/schemeJob.js`).
  - Severe weather and tank spill phone call alerts (`services/stormCallJob.js`).

### 4. Machine Learning Tank Forecaster (`ml-model/`)
- Node.js service running on port 5000 serving a gradient-boosted decision tree model trained on historical Mahaweli and Irrigation Department records.
- Predicts 14-day forward storage volumes and fill percentages based on catchment precipitation and upstream reservoir inflows.
- In-memory caching layer with automatic retry and fallback for Open-Meteo rainfall queries.

### 5. AI Assistant & Voice Services (`ai-assistant/` and `ivr/`)
- Conversational chat service providing farming guidance and irrigation queries in English, Sinhala, and Tamil.
- Asterisk PBX paired with a Node.js FastAGI server for automated phone calls and voice interaction over SIP.

### 6. Web Reverse Proxy (`deploy/web/`)
- Caddy 2 reverse proxy with automatic HTTPS, zstd/gzip compression, client-side SPA routing (`try_files`), and route delegation.

---

## Directory Structure

```
.
├── adminportal/         # Admin command center (React + Vite)
├── ai-assistant/        # AI conversational assistant service
├── api/                 # REST API, background jobs and database migrations
├── deploy/              # Web container Dockerfile and Caddyfile configuration
├── farmerportal/        # Farmer portal web and Android codebase
├── flood-model/         # River flood risk scoring from ALOS DEM tiles
├── ivr/                 # Asterisk PBX config and FastAGI voice server
├── landing_page/        # Next.js public information landing page
├── ml-model/            # 14-day tank storage forecast service
└── docker-compose.yml   # Multi-service composition
```

---

## Getting Started

### Prerequisites
- Node.js 20 or higher
- Docker and Docker Compose v2
- PostgreSQL 16+ (if running locally without Docker)
- Redis 7+ (if running locally without Docker)

### Running with Docker Compose

1. Clone the repository:
   ```bash
   git clone https://github.com/DenethPrabhashvara/yalamahaa.git
   cd yalamahaa
   ```

2. Configure environment variables:
   Copy and populate the example configuration:
   ```bash
   cp api/config.env.example api/config.env
   ```

3. Build and launch all services:
   ```bash
   docker compose up -d --build
   ```

4. Verify running containers:
   ```bash
   docker compose ps
   ```

### Running Locally for Development

#### API Server
```bash
cd api
npm install
npm run dev
```

#### Farmer Portal
```bash
cd farmerportal
npm install
npm run dev
```
The farmer portal will be available at `http://localhost:5173`.

#### Admin Portal
```bash
cd adminportal
npm install
npm run dev
```
The admin portal will be available at `http://localhost:5174`.

---

## Testing

### API Test Suite
Run the Node.js native test runner:
```bash
cd api
npm test
```
Executes unit and integration tests covering survey validation, river gauge exposure scoring, alert messaging, phone number parsing, and warning call routing.

### Farmer Portal Test Suite
Run Vitest unit tests:
```bash
cd farmerportal
npm test
```
Tests cover app state management, map filtering, multilingual string completeness, chat bubble voice playback, and survey interactions.

---

## License

This project is developed for agricultural resilience and water management in Sri Lanka.
