import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl

APP_NAME = "Welp Image Analysis Service"
DEFAULT_ALLOWED_ORIGINS = "https://welphub.onrender.com,http://localhost:5173,http://localhost:3000"
DEFAULT_PORT = 8003

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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", **_server_config(DEFAULT_PORT))
