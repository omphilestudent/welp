# Mobile App Blueprint – Welp Platform

## 1. Purpose & Guiding Principles
- Deliver the combined business-review and mental wellness marketplace experience on iOS and Android with feature parity to the web app plus mobile-native capabilities (push, offline caching, sensors for wellness check-ins).
- Keep the unified ecosystem across users, psychologists, and businesses; the mobile app is another first-party surface for the same backend services.
- Maintain the slogan and tone of voice (“Because we care.”) across onboarding, paywalls, and marketplace flows.

## 2. Product Pillars (Mobile Lens)
1. **Business Discovery & Reviews** – swipeable lists, map view, quick reactions, offline drafts for reviews.
2. **Mental Health Support Access** – in-app chat/call scheduling, reminders, wellness tracker widgets.
3. **Business Analytics & Insights** – role-based dashboards for business subscribers (read-only snapshots + drilldowns that link to full desktop dashboards).
4. **Psychologist Marketplace** – speciality filters, profile cards, instant booking, license badges.
5. **Advertising & Promotion** – sponsored tiles inside feed/search, fully native ad cards, contextual notifications.

## 3. Personas & Core Flows
### Users (Clients)
- Onboarding with subscription selection (Free vs Premium) and regionalized pricing.
- Review discovery, search, bookmarks, and shareable review links.
- Chat session management: daily timers enforce 30 min free tier vs 2 hr premium limit, with add-on purchase entry points.
- Voice/video scheduling via calendar UI; integrates with device reminders.

### Psychologists
- Subscription paywall (~500 ZAR/mo equivalent) handled via in-app purchases or Stripe billing link, depending on store policy per region.
- Lead inbox with specialization-based matches; accept/decline, auto-insert availability.
- Session management: notes, secure history, invoice exports (share sheet).

### Businesses
- Claim profile workflow gated by plan selection (Base/Enhanced/Premium).
- Mobile dashboards show KPIs, sentiment sparkline, review alerts, ad campaign controls.
- Ad creation wizard with creative upload (image/video/GIF) leveraging device camera roll.

## 4. Subscription & Billing Mechanics
- **Free Tier** – track chat quota locally, sync resets via backend cron; random psychologist assignment enforced by match API flag.
- **Paid Tier (~150 ZAR/mo)** – enable preferred psychologist selection, prioritized sockets, advanced profiles, add-on storefront (extra video bundles, AI check-ins, wellness tooling).
- **Psychologist Plan (~500 ZAR/mo)** – gating to marketing exposure, analytics, CRM API keys, verification checklist UI (license upload, ID scan).
- **Business Plans** – Base/Enhanced/Premium tiers mapped to API rate limits (1k/3k/10k calls/day) and feature toggles inside dashboards.
- **Pricing Strategy** – mobile paywalls show USD anchor, toggle for local currency, backend supplies FX rates + purchasing power adjustments; experiment flags for A/B pricing.

## 5. Advertising Surfaces
- Native cards in business lists/search, sponsored placements in review feeds, interstitials between psychologist profile views, and persistent banner on competitor pages for Premium businesses.
- Targeting parameters pulled from backend campaign service (location, industry, behavior scores); mobile client sends context to fetch eligible creatives.

## 6. High-Level Architecture
- **Client:** React Native (Expo) app with modular navigation (React Navigation), feature modules per pillar (Reviews, Psych Support, Business, Ads). App integrates device push (Expo Notifications / FCM / APNs), secure storage for tokens, and background tasks for quota resets.
- **Backend:** Reuse existing Node.js + Express services. Add mobile-specific endpoints for device registration, push campaigns, wellness tracker data, and real-time session timers. Subscription billing flows remain centralized; mobile app hits same REST/GraphQL endpoints.
- **Real-Time Layer:** Socket.IO for chat, WebRTC for calls via hosted media server (e.g., LiveKit or Twilio). Mobile handles permissions, uses call kit integrations (CallKit / ConnectionService) for native incoming call UI.
- **Data Layer:** PostgreSQL for relational data, Redis for sessions/counters, object storage (S3-compatible) for media uploads. Mobile caches select datasets via SQLite/AsyncStorage.

## 7. Communication Stack
- **Text Chat:** Socket channel per session, encrypted payloads, typing indicators, daily usage meter displayed client-side.
- **Voice/Video:** WebRTC SDK bridged into React Native; scheduling metadata stored in backend, push notifications trigger join screen. Session duration logged for subscription enforcement.
- **Notifications:** Push for reminders, review alerts, ad campaigns; in-app notification center replicates on web.

## 8. System Flow (Mobile Entry Points)
1. User installs app → verifies phone/email → selects subscription tier.
2. For Free users, home tab emphasizes discovery + quick chat; upgrade prompts appear when quotas hit.
3. Premium users unlock scheduling + AI wellness features; add-ons sold through storefront modal.
4. Psychologists access pro area after verification; calendar sync + analytics dashboards delivered via dedicated tab.
5. Businesses authenticate via existing admin credentials; after plan selection they unlock analytics + ad tools.
6. Advertising placements load dynamically on browse/search screens; tap-through logs feed backend attribution.

## 9. Implementation Roadmap
1. **Foundation (Sprint 1-2):** Create Expo monorepo package, set up authentication scaffolding, navigation, theme, shared UI kit.
2. **Reviews & Discovery (Sprint 3-4):** Company search, review feeds, submissions, offline drafts, analytics instrumentation.
3. **Psych Support MVP (Sprint 5-6):** Chat module with quota tracking, psychologist directory, matching logic integration.
4. **Subscriptions & Billing (Sprint 7):** Paywalls, plan toggles, add-on purchase flow, backend plan entitlements.
5. **Voice/Video & Scheduler (Sprint 8-9):** WebRTC integration, scheduling UI, push reminders, call duration tracking.
6. **Business Dashboards & Ads (Sprint 10-11):** KPI views, sentiment charts, ad campaign management, sponsored placements.
7. **Polish & Compliance (Sprint 12):** Accessibility pass, localization, store policies (medical disclaimers), penetration testing.

## 10. KPIs & Success Metrics
- Mobile MAU, subscription conversion rate (Free → Paid), average daily chat minutes, call completion rate, psychologist retention, business plan upgrades, ad CTR, wellness add-on attach rate.

---
**Next Steps**
- Spin up `mobile/` Expo project linked to shared component library.
- Define API contract for quota tracking and add-on purchases.
- Align with legal/compliance on in-app mental health guidelines per region.
