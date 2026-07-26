# KSP Crime Intelligence Platform

A crime intelligence and case management platform for the Karnataka State Police, built on **Zoho Catalyst**. The platform gives officers a live dashboard, analytics, a hotspot map, a case/accused network graph, case search, a natural-language crime assistant, generated reports, and rule-based alerts — all backed by serverless functions and a ZCQL data store.

## Features

| Page | Description |
|---|---|
| `dashboard.html` | Live summary stats, FIR trend chart, crime category breakdown, top districts/stations |
| `crime_analytics.html` | Deeper analytics — monthly trend, crime-by-head, crime-by-district, status distribution, time-of-day heatmap |
| `hotspot_map.html` | Leaflet map plotting case locations, district intensity legend, per-station table |
| `network_analysis.html` | vis-network graph linking accused, cases, and police stations; flags repeat offenders |
| `case_explorer.html` | Searchable/filterable case list with a detail panel (accused, brief facts, status) |
| `ai_assistant.html` | Natural-language chat interface over case data, with inline charts/tables |
| `reports.html` | Generates Monthly Summary / By District / By Crime Head / By Station / Pending Investigations reports, with CSV export |
| `alerts.html` | Rule-based alerts: long-pending investigations, district crime spikes, repeat offenders |

## Tech Stack

**Frontend**
- HTML5, CSS3, vanilla JavaScript (no framework)
- [Chart.js 4.4.0](https://www.chartjs.org/) — bar/line/doughnut charts
- [Leaflet.js 1.9.4](https://leafletjs.com/) + OpenStreetMap tiles — hotspot map
- [vis-network.js 9.1.9](https://visjs.github.io/vis-network/) — network graph
- Fetch API for all client-server calls

**Backend**
- Node.js + Express.js (each Catalyst Function is an Express app)
- `zcatalyst-sdk-node` — official Catalyst Node SDK

**Architecture**
- Serverless (Zoho Catalyst Functions — Advanced I/O)

**Database**
- ZCQL (Zoho Catalyst Query Language) over the Catalyst Data Store

## Architecture Overview

```
Browser (client/, 9 static pages)
        │  fetch("/server/<function>/<function>")
        ▼
Zoho Catalyst Platform
        │
        ├── Catalyst Functions (serverless, Advanced I/O)
        │     dashboardStats · crimeAnalytics · hotspotMap · networkAnalysis
        │     caseExplorer · reports · alerts · aiCrimeAssistant
        │
        │  ZCQL queries (≤300 rows per query)
        ▼
Catalyst Data Store
        CaseMaster table · Accused table
```

Relative API paths (`/server/<function>/<function>`) are used instead of hardcoded hosts, so the same code works unchanged in both the local `catalyst serve` environment and the deployed Catalyst domain.

## Zoho Catalyst Services Used

| Service | Purpose |
|---|---|
| **Catalyst Functions** (Advanced I/O, serverless) | 8 functions implementing all backend logic |
| **Catalyst Data Store — ZCQL** | Querying `CaseMaster` and `Accused` from every function |
| **Catalyst Data Store — Datastore API** | One-time bulk seed of 200+ synthetic case records |
| **Catalyst Client Hosting** | Serves the static frontend (`client/` folder) |
| **Catalyst CLI** | Local development (`catalyst serve`) and deployment (`catalyst deploy`) |

**Not yet used (future scope):** Catalyst Authentication (role-based access per officer), Cache, Cron, File Store, Zia (AI/ML), API Gateway, Push Notifications.

## Project Structure

```
kpd-crime-intel-platform/
├── catalyst.json                # Registers function targets and client source
├── client/                      # Static frontend, served by Catalyst Client Hosting
│   ├── client-package.json      # homepage: dashboard.html
│   ├── dashboard.html
│   ├── crime_analytics.html
│   ├── hotspot_map.html
│   ├── network_analysis.html
│   ├── case_explorer.html
│   ├── ai_assistant.html
│   ├── reports.html
│   ├── alerts.html
│   └── Seal_of_Karnataka.svg
└── functions/                   # One folder per Catalyst Function
    ├── dashboardStats/
    ├── crimeAnalytics/
    ├── hotspotMap/
    ├── networkAnalysis/
    ├── caseExplorer/
    ├── reports/
    ├── alerts/
    ├── aiCrimeAssistant/
    └── kpd_crime_intel_platform_function/   # seed-data utility
```

Each function folder contains its own `index.js` (Express app) and `package.json`, listing **both** `zcatalyst-sdk-node` and `express` as dependencies — Catalyst reinstalls dependencies fresh on deploy, so both must be declared explicitly even though `catalyst serve` may work locally without it.

## Local Development

```powershell
# start the Catalyst emulator (backend functions)
catalyst serve
```

The client is served automatically by `catalyst serve` under its local URL. Each function is invoked at:

```
http://localhost:3000/server/<function-name>/<function-name>
```

Test any function directly:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/server/dashboardstats/dashboardStats"
```

## Deployment

```powershell
catalyst deploy
```

This pushes both the `client/` folder (per `catalyst.json`'s `client.source`) and all 8 function targets together. After deployment, pages are available under:

```
https://<project-domain>.development.catalystserverless.in/app/<page>.html
```

(swap `.development.` out once promoted to the production environment).

## Known Limits

- **ZCQL row cap**: a single query can return at most 300 rows. All functions cap `LIMIT 300`; if case volume grows past this, functions need pagination (looping with increasing offsets).
- **Dev environment storage cap**: 5,000 rows/table, 25,000 rows/project. Production has separate, higher limits.
- **Dev environment user cap** (once Authentication is added): 25 users; unlimited in production.
- No caching layer — analytics/report endpoints recompute aggregates from scratch on every request.

## Roadmap

- **Catalyst Authentication + Roles** — per-officer login, with roles (e.g. App Administrator, Inspector) scoping access by district/station
- **Catalyst Cache** — cache dashboard/report aggregates to reduce repeated ZCQL load
- **Catalyst Cron** — scheduled daily alert generation and report snapshots
- **Catalyst File Store** — attach evidence photos/scanned FIRs to case records
- **Catalyst Zia** — real NLP for the AI Crime Assistant, OCR for scanned documents
- **Catalyst API Gateway** — rate limiting and API keys ahead of a wider rollout
