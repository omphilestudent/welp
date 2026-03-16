# Welp Backend API

Express API for the Welp platform.

## Folder Structure

- `src/routes/` — Express route definitions (`*Routes.js`)
- `src/controllers/` — endpoint handlers (`*Controller.js`)
- `src/middleware/` — auth, validation, and request middleware
- `src/config/` — app and DB configuration
- `src/services/` — integrations and business logic
- `src/seeders/` and `src/seed.js` — data bootstrap utilities

## Setup

```bash
npm install
npm run dev
```

## Environment

Create `backend/.env` with required DB/auth variables before running the server.
At minimum set:

```dotenv
PORT=5000
DATABASE_URL=...
JWT_SECRET=...
# Comma-separated list of allowed frontend origins (production + local)
FRONTEND_URL=https://welphub.onrender.com,http://localhost:5173,http://localhost:3000
```

## Review Notification Emails

- `POST /reviews` automatically enqueues an email to the company once the review is stored.
- Notifications are sent to the claimed owner, company email, or a fallback complaints/compliance address per domain.
- In non-production environments a copy is also delivered to `omphulestudent@gmail.com` to verify the trigger.
- Admins can audit activity via `GET /admin/review-notifications/logs` and force a resend with `POST /admin/review-notifications/logs/:logId/resend`.
- Every notification attempt is persisted in `review_notification_logs` with status, error text, and metadata for the dashboard.
