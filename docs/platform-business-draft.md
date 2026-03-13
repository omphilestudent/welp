# Platform Business Draft – Subscription Model & Architecture

## 1. Platform Overview
- Unified ecosystem connecting users, psychologists, and businesses around reviews, mental wellness support, and business intelligence.
- Value propositions:
  - Users: review companies, access vetted mental-health help, stay informed about workplace wellbeing.
  - Psychologists: gain qualified leads, manage sessions, and grow practices with trust-building tools.
  - Businesses: understand sentiment, monitor reputation, and act on wellbeing trends.
- Core pillars: discovery/reviews, mental health access, analytics & insights, professional marketplace, and advertising/promotion.

## 2. Client (User) Subscription Model
### Free Tier
- 30 minutes/day of text chat with matched psychologist (random assignment).
- Unlimited access to business reviews, ratings, and profiles; ability to submit reviews.
- Limited voice/video access, primarily teaser sessions or promotional minutes.
- Purpose: reduce friction, showcase value, and funnel into paid conversions.

### Paid Tier (≈150 ZAR/month)
- Up to 2 hours/day chat plus voice/video scheduling.
- Choose preferred psychologist with monthly reset; access detailed psychologist profiles and historical ratings.
- Discounted video bundles, priority message routing, priority customer support, and early feature access.
- Add-on catalog: extra video bundles, personal wellness tracker, AI-assisted mental health check-ins.

## 3. Psychologist Subscription Plan (≈500 ZAR/month)
- Client acquisition: specialization-based matching (clinical, trauma, anxiety, relationships, etc.), priority access to paying clients.
- Communication toolkit: integrated chat, voice/video scheduling, calendar sync, secure messaging, verified reviews.
- Business growth: analytics dashboard (local demand trends), platform marketing exposure, featured listings, satisfaction ratings.
- Professional tools: session management dashboard, secure client history, automated invoices, CRM API keys.
- Verification pipeline: license verification, identity validation, professional background checks to build trust.

## 4. Business Subscription Model
- Required subscription to claim/manage business profiles with review response rights and insights.
### Base Plan
- Profile ownership/customization, respond to reviews, basic analytics, 1 000 API calls/day, baseline reputation monitoring.
### Enhanced Plan
- 3 000 API calls/day, expanded analytics, sentiment/trend tracking, marketing insights, competitor comparison.
### Premium Plan
- 10 000 API calls/day, advanced analytics, behavioral email insights, advertising tools, sponsored listing priority, ability to place ads on related/competitor pages.

## 5. Advertising Model
- Formats: image, video, GIF banners, sponsored listings.
- Placements: business profiles, search results, category pages, recommended section; premium businesses can target competitor pages and redirect to external sites.
- Targeting knobs: location, industry, behavioral segments; campaign tracking integrated with analytics dashboards.

## 6. Pricing Strategy
- Currency toggle on frontend, backend conversion logic, regional purchasing-power adjustments, and A/B testing for optimization.
- Anchor price catalog in USD, auto-convert per locale, programmatically tune multipliers for affordability while protecting margins.

## 7. Platform Architecture (High-Level)
### Frontend (React)
- Delivers user dashboards, subscription management, reviews, chat, call UI, business/psychologist profiles, and ad placements.
### Backend (Node.js + Express)
- Manages auth, subscription billing, messaging, voice/video orchestration hooks, review moderation, analytics, advertising, and API key governance.
### Data Layer
- PostgreSQL for relational entities (accounts, profiles, reviews, transactions).
- Redis for sessions, caching, and rate limit counters.
- Object storage (e.g., S3) for media uploads.

## 8. Built-In Communication System
- Real-time text chat, voice, and video sessions powered by Socket.IO + WebRTC + media servers.
- Features: E2E encrypted sessions, scheduling, call history, in-app notifications, timed usage tracking for subscription enforcement.

## 9. System Flow (Happy Path)
1. User signs up and selects Free or Paid plan.
2. User browses/creates reviews and initiates chat with assigned psychologist.
3. Paid users schedule voice/video sessions; usage tracked and billed.
4. Psychologists receive leads, manage sessions, and access analytics dashboards.
5. Businesses subscribe, claim profiles, review analytics, and launch ad campaigns.
6. Platform marketing promotes psychologists/businesses; feedback loops drive retention.

## 10. Future Expansion Opportunities
- Corporate employee wellbeing programs, AI mental health assistant, workplace sentiment analytics, HRIS integrations, insurance partnerships, therapy course marketplace, dedicated mobile apps.

---
**Action Items**
- Socialize this draft with product, data, and compliance stakeholders for validation.
- Prioritize roadmap items (subscriptions, analytics, comms) for implementation sequencing.
- Align pricing experiments with finance to ensure regional targets. 
