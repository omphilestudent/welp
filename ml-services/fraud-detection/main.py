import os
from typing import Optional

from fastapi import FastAPI, Header, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, validator

APP_NAME = "Welp Fraud Detection Service"
DEFAULT_ALLOWED_ORIGINS = "https://welphub.onrender.com,http://localhost:5173,http://localhost:3000"
DEFAULT_PORT = 8004
MAX_TEXT_LENGTH = int(os.getenv("MAX_TEXT_LENGTH", "2000"))
MAX_BODY_BYTES = int(os.getenv("MAX_BODY_BYTES", "65536"))
API_KEY = os.getenv("ML_API_KEY") or os.getenv("AI_API_KEY")

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
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization", "x-api-key"],
)

SUSPICIOUS_TERMS = {"click here", "best deal", "guaranteed", "promo code"}

def require_api_key(
    x_api_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
) -> None:
    if not API_KEY:
        return
    token = x_api_key
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
    if token != API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.middleware("http")
async def enforce_body_limit(request: Request, call_next):
    body = await request.body()
    if len(body) > MAX_BODY_BYTES:
        return JSONResponse(status_code=413, content={"error": "Payload too large"})
    request._body = body
    return await call_next(request)


class FraudRequest(BaseModel):
    user_id: str
    review_text: str
    business_id: str

    @validator("review_text")
    def validate_text(cls, value: str) -> str:
        text = (value or "").strip()
        if not text:
            raise ValueError("review_text is required")
        if len(text) > MAX_TEXT_LENGTH:
            raise ValueError(f"review_text exceeds {MAX_TEXT_LENGTH} characters")
        return text

    @validator("user_id", "business_id")
    def validate_ids(cls, value: str) -> str:
        text = (value or "").strip()
        if not text:
            raise ValueError("id is required")
        if len(text) > 128:
            raise ValueError("id is too long")
        return text


@app.post("/detect-fraud")
def detect_fraud(payload: FraudRequest, _: None = Depends(require_api_key)) -> dict[str, float | bool]:
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
