# Welp - Employee Wellbeing Review Platform

Welp is a review and wellbeing platform where employees share workplace experiences, businesses respond and improve, and psychologists can intervene when reviews signal distress. This repository contains the full product stack: web client, API, and ML microservices.

## Product Overview (Non-Technical)

**Core outcomes**
- **Employees** submit anonymous or named reviews and engage safely through messaging.
- **Businesses** claim profiles, manage reputation, access analytics, and run advertising campaigns.
- **Psychologists** receive leads, communicate with employees, and manage their schedules.

**Key flows**
- Review submission → moderation + sentiment → saved to the company profile.
- Business hub → reviews, analytics, profile editing, and ads management.
- Messaging → real-time chat between employees and psychologists.

## Architecture (Technical)

```
React (Vite) Frontend
  ↕ HTTPS + WebSockets
Node.js/Express API
  ↕ PostgreSQL
  ↕ ML Services (FastAPI)
```

**Major components**
- **Frontend**: React + Vite app that handles all user roles and dashboards.
- **Backend**: Express API with JWT auth, Socket.io for chat, and a PostgreSQL database.
- **ML services**: Python FastAPI microservices for moderation, sentiment, recommendations, image analysis, and fraud detection.

## Repository Structure

- `frontend/` — React app (UI, pages, components, routing)
- `backend/` — Node.js API (controllers, routes, DB integration)
- `backend-java/` — Spring Boot migration scaffold
- `ml-services/` — Python ML microservices
- `docker-compose.yml` — local orchestration

## Local Development

### Prerequisites
- Node.js 20+
- Python 3.10+ (for ML services)
- Docker (recommended for full stack)

### Quick Start (Docker)

```bash
docker-compose up --build
```

This brings up:
- Postgres
- Backend API on `http://localhost:5000`
- Frontend on `http://localhost:5173`
- ML services on `http://localhost:8000+`

### Manual (Without Docker)

1) Backend
```bash
cd backend
npm install
npm run dev
```

2) Frontend
```bash
cd frontend
npm install
npm run dev
```

3) ML services (run each needed service)
```bash
cd ml-services/content-moderation
pip install -r requirements.txt
python main.py
```

## Configuration

Each service has its own environment variables:

- **Frontend**: `VITE_API_URL` (see `frontend/README.md`)
- **Backend**: `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, optional ML + email config, and `CLOUDINARY_URL` for durable media storage (see `backend/README.md`)
- **ML services**: `ALLOWED_ORIGINS`, `PORT`, `LOG_LEVEL` (see `ml-services/README.md`)

## Deployment Overview

**Frontend**
- Build and host as a static site (Render, Vercel, Netlify, S3).
- Set `VITE_API_URL` to your backend URL.

**Backend**
- Deploy as a Node.js web service (Render, Railway, Fly.io).
- Connect to Postgres and set required environment variables.

**ML Services**
- Deploy each as a separate service/container.
- Point backend `ML_*_URL` variables at the deployed endpoints.

Detailed deployment steps live in:
- `frontend/README.md`
- `backend/README.md`
- `ml-services/README.md`
