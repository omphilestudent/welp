export const REVIEW_TYPES = {
    COMPANY: 'company_review',
    ONBOARDING: 'onboarding_review',
    DAILY: 'daily_work_review'
};

export const REVIEW_TYPE_LABELS = {
    [REVIEW_TYPES.COMPANY]: 'Company Reviews',
    [REVIEW_TYPES.ONBOARDING]: 'Onboarding / Application Reviews',
    [REVIEW_TYPES.DAILY]: 'Daily Work Reviews'
};

export const REVIEW_STAGES = [
    { value: 'application', label: 'Application' },
    { value: 'assessment', label: 'Assessment' },
    { value: 'interview', label: 'Interview' },
    { value: 'onboarding', label: 'Onboarding' }
];
