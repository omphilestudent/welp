# Welp Platform – Subscription & Communication Architecture

_Last updated: 2026-03-13_

## 1. High-Level Topology
- **Clients**: React web app, (future) React Native mobile app; both share authentication/session flows and consume REST + WebSocket APIs.
- **Edge & API Layer**: Node.js + Express server (`backend/src/server.js`) with Socket.IO for chat/call signaling, JWT auth, and rate limiting.
- **Real-Time Media**: WebRTC peer connections coordinated through Socket.IO; optional SFU (LiveKit/Janus) for group routing.
- **Data Layer**:
  - PostgreSQL (see `backend/src/db/platform_schema.sql`) for relational entities (users, psychologists, businesses, subscriptions, analytics, ads, comms logs).
  - Redis for sessions, chat quotas, API rate limiting, price cache, and call-offer coordination.
  - Object storage (S3-compatible) for media uploads, ad assets, call recordings.

## 2. Service Modules (Backend)
| Module | Responsibilities | Key Routes / Services |
| --- | --- | --- |
| Auth & Accounts | Signup/login, JWT issuance, password reset, session revocation | `/api/auth/*` |
| Subscriptions | Plan catalogs, entitlements, billing hooks, quota resets | `/api/subscriptions`, background cron to reset chat minutes |
| Psychologist Marketplace | Profile CRUD, verification, lead routing, reviews, schedule sync | `/api/psychologists`, `/api/psychologists/dashboard/*` |
| Business Analytics | Review ingestion, sentiment pipeline, API usage counters, dashboards | `/api/businesses`, `/api/businesses/analytics` |
| Reviews & Moderation | CRUD for reviews/replies, flagging, admin moderation | `/api/reviews`, `/api/admin/reviews` |
| Messaging & Calls | Socket namespaces, chat persistence, call session logging, E2E key mgmt | `/api/messages`, Socket events `send-message`, `call:*` |
| Advertising | Campaign CRUD, placement eligibility, reporting, billing hooks | `/api/marketing`, `/api/ads` (to add) |
| Notifications | Email + in-app alerts (review responses, chat, subscription changes) | `/api/notifications` |

## 3. Frontend Feature Map (React)
- **Dashboards**: user home (subscription status, chat quota, review stats), psychologist dashboard (leads, schedule, analytics), business analytics (sentiment, API usage, ad performance).
- **Profiles & Listings**: company profiles, psychologist cards, advertising slots.
- **Communication**: `ChatPanel` (Socket.IO hooks, typing indicators), `CallSurface` (WebRTC wrapper with scheduling + timer), notifications tray.
- **Subscriptions & Billing**: `PricingToggle`, `PlanCheckout`, `QuotaMeter`, currency selector.
- **Reviews**: `ReviewComposer`, `ReviewFeed`, moderation banners.
- **Advertising**: `SponsoredCard`, `AdCarousel`, placement context provider.

## 4. Data & Caching Flows
1. **Subscription Pricing**: Catalog stored in `pricing_catalog`, fetched via `/api/pricing`; currency toggle triggers backend conversion (USD anchor × FX rate × purchasing power). Result cached in Redis key `price:lookup:{currency}` for 1 hour.
2. **Chat Minutes Tracking**: On message send, Redis key `chat:quota:{userId}:{YYYYMMDD}` increments, with fallback persisted nightly into `conversations` + `call_sessions`.
3. **API Call Limits**: Middleware increments `rate:api:{businessId}`; when count > `api_call_limit`, respond `429`. Resets via cron.
4. **Advertising Targeting**: Query `advertising_campaigns` + `ad_placements` filtered by location/industry, sorted by weight/budget; deliver to frontend as part of page payload.

## 5. Security & Compliance
- JWT + refresh tokens, token versioning, Redis session blacklist.
- End-to-end encryption for chat/calls (DTLS-SRTP for media, libsodium for message payloads).
- Data residency awareness via partitions or row-level tags when scaling internationally.
- Audit logs recorded in `audit_logs` for admin/mod operations.

## 6. Delivery Roadmap (Server-Side)
1. Migrate database to schema defined in `backend/src/db/platform_schema.sql`.
2. Implement subscription service (entitlements, quotas, currency conversion) including background workers.
3. Extend Socket.IO handlers for quota enforcement and encryption handshake.
4. Build advertising service with campaign CRUD + placement resolver.
5. Harden moderation + analytics pipelines; expose APIs for React dashboards.

## 7. API Documentation Stub
- Maintain OpenAPI spec under `docs/api/openapi.yaml` (to create) describing endpoints for auth, subscriptions, reviews, conversations, campaigns, analytics.
- Include request/response samples for each plan-specific action (upgrade/downgrade, purchase add-ons, create ad campaign, fetch analytics snapshots).

Use this document as the reference when implementing new modules so backend/ frontend stay aligned with the business draft. 
