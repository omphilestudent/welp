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

## Local Development

```bash
cd ml-services/content-moderation
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
python main.py
```

## Environment Variables

Copy `ml-services/.env.example` to `.env` in each service directory or export variables in your environment:

```dotenv
ALLOWED_ORIGINS=https://welphub.onrender.com,http://localhost:5173
HOST=0.0.0.0
PORT=8000
WEB_CONCURRENCY=2
LOG_LEVEL=info
TOKENIZERS_PARALLELISM=false
```

## Deployment

Each service can be deployed as a standalone container:

```bash
docker build -t welp-content-moderation ./ml-services/content-moderation
docker run -p 8000:8000 welp-content-moderation
```

Point the backend to the deployed services using:

```dotenv
ML_MODERATION_URL=https://your-moderation-service/moderate-review
ML_SENTIMENT_URL=https://your-sentiment-service/analyze-sentiment
```

