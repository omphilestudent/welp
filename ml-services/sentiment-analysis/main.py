import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import pipeline

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

APP_NAME = "Welp Sentiment Analysis Service"
DEFAULT_ALLOWED_ORIGINS = "https://welphub.onrender.com,http://localhost:5173,http://localhost:3000"
DEFAULT_PORT = 8001

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


class SentimentRequest(BaseModel):
    review_text: str


class SentimentResponse(BaseModel):
    sentiment: str
    score: float


classifier = pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english")


@app.post("/analyze-sentiment", response_model=SentimentResponse)
def analyze_sentiment(payload: SentimentRequest) -> SentimentResponse:
    result = classifier(payload.review_text)[0]
    label = result["label"].lower()

    if label == "positive":
        sentiment = "positive"
        score = float(result["score"])
    else:
        sentiment = "negative"
        score = float(1 - result["score"])

    return SentimentResponse(sentiment=sentiment, score=round(score, 4))


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", **_server_config(DEFAULT_PORT))
