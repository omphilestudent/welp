# Welp ML Services

Standalone Python microservices used by the Welp backend.

## Services

- `content-moderation/` — `POST /moderate-review`
- `sentiment-analysis/` — `POST /analyze-sentiment`
- `recommendation-engine/` — `GET /recommendations?user_id=<id>`
- `image-analysis/` — `POST /analyze-image`
- `fraud-detection/` — `POST /detect-fraud`

Each service contains:

- `main.py` — FastAPI app entrypoint
- `requirements.txt` — Python dependencies
- `Dockerfile` — container build

## Configuration

Every service reads an `ALLOWED_ORIGINS` environment variable (comma separated)
to determine which frontends can call the API. The default covers
`https://welphub.onrender.com` along with the usual localhost ports used during
development. Override this value in production to restrict access further or to
add extra origins.

## Production Deployment

Each microservice can now be launched directly via `python main.py` (inside the
service folder) or by building its Docker image. Runtime behaviour is controlled
via environment variables (see `.env.example`):

- `HOST` / `PORT` – bind address and port. When running on Render/Heroku-style
  platforms set `PORT` to `$PORT` from the platform.
- `WEB_CONCURRENCY` – number of Uvicorn workers to spawn; increase for CPU bound
  tasks or leave at `1` for lighter workloads.
- `LOG_LEVEL` – Uvicorn log verbosity.
- `ALLOWED_ORIGINS` – comma separated CORS whitelist.

Docker images default to production-friendly settings (`PYTHONDONTWRITEBYTECODE`,
`PYTHONUNBUFFERED`, host `0.0.0.0`, command `python main.py`) so no additional
entrypoint overrides are required when deploying.

