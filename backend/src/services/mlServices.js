const DEFAULT_TIMEOUT_MS = Number(process.env.ML_REQUEST_TIMEOUT_MS || 3000);

const serviceUrls = {
    moderation: process.env.ML_MODERATION_URL || 'http://ml-moderation-service:8000/moderate-review',
    sentiment: process.env.ML_SENTIMENT_URL || 'http://ml-sentiment-service:8001/analyze-sentiment'
};

const postJson = async (url, payload, timeoutMs = DEFAULT_TIMEOUT_MS) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(`ML service ${url} returned status ${response.status}`);
        }

        return await response.json();
    } finally {
        clearTimeout(timeout);
    }
};

const moderateReview = async (reviewText) => postJson(serviceUrls.moderation, { review_text: reviewText });
const analyzeSentiment = async (reviewText) => postJson(serviceUrls.sentiment, { review_text: reviewText });

module.exports = {
    moderateReview,
    analyzeSentiment
};
