from fastapi import FastAPI
from pydantic import BaseModel
from transformers import pipeline

app = FastAPI(title="Welp Sentiment Analysis Service")


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
