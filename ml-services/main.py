import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import pipeline

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

APP_NAME = "Welp Content Moderation Service"
DEFAULT_ALLOWED_ORIGINS = "https://welphub.onrender.com,http://localhost:5173,http://localhost:3000"
DEFAULT_PORT = 8000

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


class ModerationRequest(BaseModel):
    review_text: str


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


@app.post("/moderate-review", response_model=ModerationResponse)
def moderate_review(payload: ModerationRequest) -> ModerationResponse:
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
