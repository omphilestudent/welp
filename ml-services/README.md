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
