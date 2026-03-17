# Welp Ads (Business) – How It Works

This guide explains what business users input when creating ads, why each field matters, and how the admin approval + rotation system works.

## 1) What an “Ad” is in Welp

An ad is an **Advertising Campaign** created by a business account. Ads can appear in different placements (home, search, category feeds, business profiles, etc.). Ads are always reviewed by admins before they become active.

## 2) Business User: Create Ad Flow

1. Business user opens **Ads / Campaigns**
2. Clicks **Create Campaign**
3. Uploads media + fills in required fields
4. Submits for review
5. Admin reviews and either **Approves** (goes active) or **Rejects**

## 3) Fields Business Users Must Provide (and why)

### A) Campaign Name
- **What to enter:** A clear campaign label (e.g., “March Promo – 10% Off”).
- **Why it matters:** Admins need to understand what is being advertised; also used in reporting and audit logs.

### B) Media Type (`image`, `gif`, `video`)
- **What to enter:** Choose the correct type for the uploaded file.
- **Why it matters:** The frontend renders media differently (images vs videos), and it affects load/performance.

### C) Media Asset (Upload)
- **What to enter:** The actual image/gif/video file.
- **Why it matters:** This is the ad creative users see. Admins review it for:
  - Misleading claims
  - Adult/violent content
  - Copyright violations
  - Spam/scams

### D) Click Redirect URL
- **What to enter:** Where users should go when they click the ad (website, booking page, product page).
- **Why it matters:** Prevents malicious redirects. Admins can reject ads that route to unsafe content.

### E) Placements (Where the ad can show)
- **What to enter:** One or more placements (example: `recommended`, `search_results`, `category`, `business_profile`).
- **Why it matters:** Controls context. A “search” ad behaves differently from a “profile” ad.

### F) Targeting

#### Target Locations (Optional)
- **What to enter:** Locations that match the audience (e.g., “Johannesburg”).
- **Why it matters:** Relevance and compliance (regional limitations).

#### Target Industries (Optional)
- **What to enter:** Industries the ad is relevant to (e.g., “Tourism”, “Health”).
- **Why it matters:** Keeps ads relevant and reduces user complaints.

#### Target Behaviors (Optional)
- **What to enter:** Tags/behavior segments (e.g., “psychologist”, “employee”, “business”).
- **Why it matters:** Improves match quality.

### G) Budget / Bid (Optional depending on plan)
- **What to enter:** Daily budget + bid configuration.
- **Why it matters:** Ranking/weighting, pacing, and fair distribution.

## 4) Why Admin Approval Exists

Admin approval is required to:
- prevent scams and unsafe links
- stop spam/misleading creatives
- ensure targeting is appropriate
- enforce business plan limits
- protect user experience

## 5) Status + Review Status (What they mean)

Common states:
- **Pending review:** Created/submitted, waiting for admin review.
- **Active:** Approved and eligible to show.
- **Rejected:** Admin rejected; not eligible to show.
- **Paused / Completed:** Optional states depending on workflow.

## 6) Rotation / Shuffling (How ads cycle)

The ad placement endpoint can return **multiple approved ads** for a placement.

Frontend rotation behavior:
- The UI shows **one ad at a time**.
- If multiple approved ads are available, the UI rotates them every ~60 seconds (configurable).
- After 60 seconds, the next ad is shown, and so on.

This keeps exposure fair and reduces banner blindness.

## 7) “More than one ad” (Business plan capability)

Businesses can create multiple campaigns. The system enforces a **max active campaigns** limit by plan tier.

If you want more ads running at the same time:
- upgrade plan, or
- an admin can override restrictions (if enabled), or
- adjust plan limits in the pricing catalog / plan configuration.

## 8) Troubleshooting

### I submitted an ad but it’s not showing
- It may still be **pending review**
- It may be **rejected**
- It may not match the placement/targeting filters

### Admin can see ads in approvals but cannot view details/approve
- Usually indicates missing DB columns (e.g. `review_status`, `reviewed_at`) in the environment
- Apply the ad workflow migration or use a backend that gracefully handles missing columns

## 9) Export this guide to PDF

Fastest path:
1. Open this file in your IDE: `docs/ads/business-ads-guide.md`
2. Preview it (Markdown preview)
3. Print → “Save as PDF”

