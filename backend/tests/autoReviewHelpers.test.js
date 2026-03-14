const assert = require('assert');
const {
    deriveRatingFromScore,
    formatReviewContent
} = require('../src/services/autoReviewService');

(async () => {
    try {
        // Test deriveRatingFromScore
        assert.strictEqual(deriveRatingFromScore(1), 5, 'Score 1 => rating 5');
        assert.strictEqual(deriveRatingFromScore(0), 1, 'Score 0 => rating 1');
        assert.strictEqual(deriveRatingFromScore(0.5), 3, 'Score 0.5 => rating 3');
        assert.strictEqual(deriveRatingFromScore(0.25), 2, 'Score 0.25 => rating 2');

        // Test formatReviewContent
        const short = formatReviewContent('Great product', 'fallback');
        assert.strictEqual(short, 'Great product', 'Short content should remain unchanged');

        const empty = formatReviewContent('', 'fallback');
        assert.strictEqual(empty, 'fallback', 'Empty content should use fallback');

        const long = 'x'.repeat(600);
        const truncated = formatReviewContent(long, 'fallback');
        assert.ok(truncated.length <= 401, 'Truncated content should be <= 401 chars');

        console.log('✅ Auto-review helper tests passed');
    } catch (error) {
        console.error('❌ Auto-review helper tests failed:', error);
        process.exit(1);
    }
})();