import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

APP_NAME = "Welp Fraud Detection Service"
DEFAULT_ALLOWED_ORIGINS = "https://welphub.onrender.com,http://localhost:5173,http://localhost:3000"
DEFAULT_PORT = 8004

app = FastAPI(title=APP_NAME)


def _parse_allowed_origins() -> list[str]:
    raw = os.getenv("ALLOWED_ORIGINS", DEFAULT_ALLOWED_ORIGINS)
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def _server_config(default_port: int) -> dict:
    return {
        "host": os.getenv("HOST", "0.0.0.0"),
        "port": int(os.getenv("PORT", default_port)),
        "workers": int(os.getenv("WEB_CONCURRENCY", "1")),
        "log_level": os.getenv("LOG_LEVEL", "info"),
    }


app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_allowed_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
)

SUSPICIOUS_TERMS = {"click here", "best deal", "guaranteed", "promo code"}


class FraudRequest(BaseModel):
    user_id: str
    review_text: str
    business_id: str


@app.post("/detect-fraud")
def detect_fraud(payload: FraudRequest) -> dict[str, float | bool]:
    lowered = payload.review_text.lower()
    hit_count = sum(1 for term in SUSPICIOUS_TERMS if term in lowered)
    score = min(0.99, 0.2 + hit_count * 0.2)
    return {"is_suspicious": score >= 0.6, "score": round(score, 4)}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", **_server_config(DEFAULT_PORT))
