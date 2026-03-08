from fastapi import FastAPI

app = FastAPI(title="Welp Recommendation Engine")

# TODO: Replace with collaborative filtering model once enough data is available.
DEFAULT_RECOMMENDATIONS = {
    "new-user": ["featured-business-1", "featured-business-2", "featured-business-3"],
}


@app.get("/recommendations")
def recommendations(user_id: str) -> dict[str, list[str]]:
    return {"business_ids": DEFAULT_RECOMMENDATIONS.get(user_id, DEFAULT_RECOMMENDATIONS["new-user"])}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
