const DEFAULT_TIMEOUT_MS = Number(process.env.ML_REQUEST_TIMEOUT_MS || 3000);
const MAX_ML_TEXT_LENGTH = Number(process.env.ML_MAX_TEXT_LENGTH || 2000);
const MAX_ML_BODY_BYTES = Number(process.env.ML_MAX_BODY_BYTES || 64 * 1024);

const serviceUrls = {
    moderation: process.env.ML_MODERATION_URL || 'http://ml-moderation-service:8000/moderate-review',
    sentiment: process.env.ML_SENTIMENT_URL || 'http://ml-sentiment-service:8001/analyze-sentiment'
};

const getMlAuthHeaders = () => {
    const key = process.env.ML_API_KEY || process.env.AI_API_KEY;
    if (!key) return {};

    return {
        Authorization: `Bearer ${key}`,
        'x-api-key': key
    };
};

const ensureSafeText = (input) => {
    const value = String(input || '').trim();
    if (!value) {
        throw new Error('ML input is empty');
    }
    if (value.length > MAX_ML_TEXT_LENGTH) {
        throw new Error(`ML input exceeds ${MAX_ML_TEXT_LENGTH} characters`);
    }
    return value;
};

const postJson = async (url, payload, timeoutMs = DEFAULT_TIMEOUT_MS) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const body = JSON.stringify(payload);
    if (Buffer.byteLength(body, 'utf8') > MAX_ML_BODY_BYTES) {
        clearTimeout(timeout);
        throw new Error('ML payload too large');
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...getMlAuthHeaders()
            },
            body,
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

const moderateReview = async (reviewText) => {
    const safeText = ensureSafeText(reviewText);
    return postJson(serviceUrls.moderation, { review_text: safeText });
};
const analyzeSentiment = async (reviewText) => {
    const safeText = ensureSafeText(reviewText);
    return postJson(serviceUrls.sentiment, { review_text: safeText });
};

module.exports = {
    moderateReview,
    analyzeSentiment
};
