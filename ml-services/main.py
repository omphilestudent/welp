import os
from typing import Optional

from fastapi import FastAPI, Header, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, validator
from transformers import pipeline

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

APP_NAME = "Welp Content Moderation Service"
DEFAULT_ALLOWED_ORIGINS = "https://welphub.onrender.com,http://localhost:5173,http://localhost:3000"
DEFAULT_PORT = 8000
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


class ModerationRequest(BaseModel):
    review_text: str

    @validator("review_text")
    def validate_text(cls, value: str) -> str:
        text = (value or "").strip()
        if not text:
            raise ValueError("review_text is required")
        if len(text) > MAX_TEXT_LENGTH:
            raise ValueError(f"review_text exceeds {MAX_TEXT_LENGTH} characters")
        return text


class ModerationResponse(BaseModel):
    is_flagged: bool
    reason: str


classifier = pipeline(
    "text-classification",
    model="unitary/toxic-bert",
    return_all_scores=True,
)

FLAGGED_LABELS = {"toxic", "insult", "obscene", "threat", "identity_hate", "severe_toxic"}
FLAGGED_THRESHOLD = 0.7


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


@app.post("/moderate-review", response_model=ModerationResponse)
def moderate_review(payload: ModerationRequest, _: None = Depends(require_api_key)) -> ModerationResponse:
    scores = classifier(payload.review_text)[0]
    top_score = max(scores, key=lambda item: item["score"])

    is_flagged = top_score["label"] in FLAGGED_LABELS and top_score["score"] >= FLAGGED_THRESHOLD
    reason = top_score["label"] if is_flagged else "clean"

    return ModerationResponse(is_flagged=is_flagged, reason=reason)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", **_server_config(DEFAULT_PORT))
