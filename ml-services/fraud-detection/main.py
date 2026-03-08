from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Welp Fraud Detection Service")

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
