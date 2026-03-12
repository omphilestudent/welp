from fastapi import FastAPI
from pydantic import BaseModel
from transformers import pipeline

app = FastAPI(title="Welp Content Moderation Service")


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
