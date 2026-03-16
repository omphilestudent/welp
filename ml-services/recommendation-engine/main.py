import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

APP_NAME = "Welp Recommendation Engine"
DEFAULT_ALLOWED_ORIGINS = "https://welphub.onrender.com,http://localhost:5173,http://localhost:3000"
DEFAULT_PORT = 8002

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

# TODO: Replace with collaborative filtering model once enough data is available.
DEFAULT_RECOMMENDATIONS = {
    "ml-services-user": ["featured-business-1", "featured-business-2", "featured-business-3"],
}


@app.get("/recommendations")
def recommendations(user_id: str) -> dict[str, list[str]]:
    return {"business_ids": DEFAULT_RECOMMENDATIONS.get(user_id, DEFAULT_RECOMMENDATIONS["ml-services-user"])}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", **_server_config(DEFAULT_PORT))
