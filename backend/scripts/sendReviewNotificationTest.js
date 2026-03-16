#!/usr/bin/env node

/**
 * Utility script to send a sample review notification email to the configured
 * REVIEW_NOTIFICATION_TEST_EMAIL address (or an override passed as an argument).
 *
 * Usage:
 *   node scripts/sendReviewNotificationTest.js
 *   node scripts/sendReviewNotificationTest.js test@example.com
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { sendReviewNotificationEmail } = require('../src/utils/emailService');

const fallbackEmail = process.argv[2] || process.env.REVIEW_NOTIFICATION_TEST_EMAIL;

if (!fallbackEmail) {
    console.error('❌ Please provide a destination email or set REVIEW_NOTIFICATION_TEST_EMAIL');
    process.exit(1);
}

(async () => {
    console.log(`📧 Sending sample review notification to: ${fallbackEmail}`);

    const response = await sendReviewNotificationEmail({
        to: [fallbackEmail],
        type: 'unclaimed',
        companyName: 'Welp Demo Company',
        rating: 5,
        reviewContent: 'This is a sample review notification to verify email delivery.',
        reviewDate: new Date().toLocaleDateString(),
        reviewerName: 'QA Tester',
        reviewLocation: 'Johannesburg, South Africa',
        dashboardUrl: process.env.APP_BASE_URL || 'https://app.welp.co.za/dashboard',
        respondUrl: process.env.APP_BASE_URL || 'https://app.welp.co.za/dashboard',
        claimUrl: `${process.env.APP_BASE_URL || 'https://app.welp.co.za'}/claim-business`,
        companyCountry: 'ZA'
    });

    if (response.success) {
        console.log('✅ Sample review notification sent successfully.');
        process.exit(0);
    }

    console.error('❌ Failed to send sample email:', response.error || 'Unknown error');
    process.exit(1);
})();
