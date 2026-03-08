from fastapi import FastAPI
from pydantic import BaseModel, HttpUrl

app = FastAPI(title="Welp Image Analysis Service")


class ImageRequest(BaseModel):
    image_url: HttpUrl


@app.post("/analyze-image")
def analyze_image(payload: ImageRequest) -> dict[str, str | bool]:
    url = str(payload.image_url).lower()
    category = "restaurant" if any(token in url for token in ["food", "restaurant", "cafe"]) else "general"
    nsfw = any(token in url for token in ["nsfw", "adult", "explicit"])
    return {"nsfw": nsfw, "category": category}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
