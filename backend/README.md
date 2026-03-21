# Welp Backend API

Express API for the Welp platform. Handles auth, reviews, business hub features, messaging, subscriptions, and advertising. Integrates with Postgres and ML microservices.

## Architecture Notes (Developer)

- REST API built on Express.
- JWT authentication for session access.
- Socket.io for real-time chat.
- Postgres as primary datastore.
- External ML services for moderation and sentiment.

## Folder Structure

- `src/routes/` — Express route definitions (`*Routes.js`)
- `src/controllers/` — endpoint handlers (`*Controller.js`)
- `src/middleware/` — auth, validation, and request middleware
- `src/services/` — business logic + integrations
- `src/utils/` — shared helpers (DB, email, logging)
- `src/seeders/` — data bootstrap utilities

## Local Development

```bash
npm install
npm run dev
```

Default port: `http://localhost:5000`

## Environment Variables

Create `backend/.env` with at least:

```dotenv
PORT=5000
DATABASE_URL=postgresql://user:password@localhost:5432/welp
JWT_SECRET=replace-me
FRONTEND_URL=https://welphub.onrender.com,http://localhost:5173
```

Optional integrations:

```dotenv
# ML service endpoints
ML_MODERATION_URL=http://localhost:8000/moderate-review
ML_SENTIMENT_URL=http://localhost:8001/analyze-sentiment

# Cloudinary (durable media storage)
# Use the full CLOUDINARY_URL from your Cloudinary dashboard.
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>

# Email delivery (either SendGrid or SMTP)
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=...
SENDGRID_DATA_RESIDENCY=eu

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=...
EMAIL_PASSWORD=...
EMAIL_FROM="Welp <no-reply@welp.com>"
```

Upload size overrides (bytes):

```dotenv
# Ads/media uploads
AD_MEDIA_MAX_BYTES=52428800

# Business logos and avatars
COMPANY_LOGO_MAX_BYTES=10485760
AVATAR_MAX_BYTES=10485760

# Email marketing assets
EMAIL_ASSET_MAX_BYTES=10485760

# Voice notes and application documents
VOICE_NOTE_MAX_BYTES=26214400
APPLICATION_UPLOAD_MAX_BYTES=26214400
```

## Cloudinary Backfill (Ads)

If you have old ad assets stored on disk, run:

```bash
node scripts/backfill-cloudinary-ads.js --dry-run
node scripts/backfill-cloudinary-ads.js
```

Optional flags:
- `--campaign <uuid>` to backfill a single campaign
- `--limit <n>` to cap the number of campaigns scanned

## Cloudinary Backfill (Avatars)

```bash
node scripts/backfill-cloudinary-avatars.js --dry-run
node scripts/backfill-cloudinary-avatars.js
```

Optional flags:
- `--user <uuid>` to backfill a single user
- `--limit <n>` to cap the number of users scanned

## Docker (Recommended)

From repo root:

```bash
docker-compose up --build
```

This will bring up Postgres, backend, frontend, and core ML services.

## Review Notification Emails

- `POST /reviews` enqueues an email to the business.
- Admin audit tools exist under the admin routes.
- QA copies can be enabled using `REVIEW_NOTIFICATION_TEST_EMAIL` and `REVIEW_NOTIFICATION_CC_TEST`.
