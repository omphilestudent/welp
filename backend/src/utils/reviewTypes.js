const REVIEW_TYPES = {
    COMPANY: 'company_review',
    ONBOARDING: 'onboarding_review',
    DAILY: 'daily_work_review'
};

const REVIEW_TYPE_LABELS = {
    [REVIEW_TYPES.COMPANY]: 'Company Review',
    [REVIEW_TYPES.ONBOARDING]: 'Onboarding / Application Review',
    [REVIEW_TYPES.DAILY]: 'Daily Work Review'
};

const ONBOARDING_STAGES = ['application', 'assessment', 'interview', 'onboarding'];

const normalizeReviewType = (value) => {
    if (!value) return REVIEW_TYPES.COMPANY;
    const normalized = String(value).toLowerCase().trim();
    if (Object.values(REVIEW_TYPES).includes(normalized)) return normalized;
    return REVIEW_TYPES.COMPANY;
};

const isValidReviewType = (value) => Object.values(REVIEW_TYPES).includes(value);

const normalizeReviewStage = (value) => {
    if (!value) return null;
    const normalized = String(value).toLowerCase().trim();
    return ONBOARDING_STAGES.includes(normalized) ? normalized : null;
};

const resolveReviewTypeLabel = (type) => REVIEW_TYPE_LABELS[type] || 'Review';

module.exports = {
    REVIEW_TYPES,
    REVIEW_TYPE_LABELS,
    ONBOARDING_STAGES,
    normalizeReviewType,
    normalizeReviewStage,
    isValidReviewType,
    resolveReviewTypeLabel
};
