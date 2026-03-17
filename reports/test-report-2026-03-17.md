# Test Report (2026-03-17)

## Command
- `npm test` (in `backend/`)

## Result Summary
- **Status:** Partial completion (timed out after 120s)
- **Blocking issue:** Database connection failure (check `DATABASE_URL`, Neon pooled URL, permissions)

## Results
- ? `tests/autoReviewHelpers.test.js`
- ? `tests/adWorkflow.test.js`
- ? `tests/emailMarketingService.test.js`
- ? `tests/emailMarketingApi.test.js` (DB connection error)
- ? `tests/adminPricing.test.js` (DB connection error)
- ? `tests/pricingServiceCountry.test.js` (DB connection error)
- ? `tests/flowService.test.js` (DB connection error)
- ? `tests/flowRuntimeEngine.test.js` (DB connection error)

## Notes
- The test run produced repeated migration warnings and then failed to connect to the database.
- Fix by setting `DATABASE_URL` to a valid pooled connection string and ensuring DB is reachable.
