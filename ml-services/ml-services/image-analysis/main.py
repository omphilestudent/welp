import os
from typing import Optional

from fastapi import FastAPI, Header, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, HttpUrl

DEFAULT_ALLOWED_ORIGINS = "https://welphub.onrender.com,http://localhost:5173,http://localhost:3000"
MAX_BODY_BYTES = int(os.getenv("MAX_BODY_BYTES", "65536"))
API_KEY = os.getenv("ML_API_KEY") or os.getenv("AI_API_KEY")

app = FastAPI(title="Welp Image Analysis Service")

def _parse_allowed_origins() -> list[str]:
    raw = os.getenv("ALLOWED_ORIGINS", DEFAULT_ALLOWED_ORIGINS)
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_allowed_origins(),
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization", "x-api-key"],
)


class ImageRequest(BaseModel):
    image_url: HttpUrl

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


@app.post("/analyze-image")
def analyze_image(payload: ImageRequest, _: None = Depends(require_api_key)) -> dict[str, str | bool]:
    url = str(payload.image_url).lower()
    category = "restaurant" if any(token in url for token in ["food", "restaurant", "cafe"]) else "general"
    nsfw = any(token in url for token in ["nsfw", "adult", "explicit"])
    return {"nsfw": nsfw, "category": category}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
