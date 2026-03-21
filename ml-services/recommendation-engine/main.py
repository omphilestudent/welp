import os
from typing import Optional

from fastapi import FastAPI, Header, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

APP_NAME = "Welp Recommendation Engine"
DEFAULT_ALLOWED_ORIGINS = "https://welphub.onrender.com,http://localhost:5173,http://localhost:3000"
DEFAULT_PORT = 8002
MAX_USER_ID_LENGTH = int(os.getenv("MAX_USER_ID_LENGTH", "128"))
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
    allow_methods=["GET"],
    allow_headers=["Content-Type", "Authorization", "x-api-key"],
)

# TODO: Replace with collaborative filtering model once enough data is available.
DEFAULT_RECOMMENDATIONS = {
    "ml-services-user": ["featured-business-1", "featured-business-2", "featured-business-3"],
}

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


@app.get("/recommendations")
def recommendations(user_id: str, _: None = Depends(require_api_key)) -> dict[str, list[str]]:
    normalized = (user_id or "").strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="user_id is required")
    if len(normalized) > MAX_USER_ID_LENGTH:
        raise HTTPException(status_code=400, detail="user_id is too long")
    return {"business_ids": DEFAULT_RECOMMENDATIONS.get(normalized, DEFAULT_RECOMMENDATIONS["ml-services-user"])}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", **_server_config(DEFAULT_PORT))
