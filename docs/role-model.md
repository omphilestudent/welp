# Welp/Kodi Role Model

## Overview
Welp now distinguishes **client/app roles** from **Welp internal staff roles**.

### Client/App Roles (existing)
- `employee` (client user)
- `psychologist`
- `business`
- Kodi app roles: `employee`, `business_user`, `psychologist` (app-scoped)

These are **not** internal staff roles.

### Welp Internal Staff Roles (new)
Internal staff are stored in the `welp_staff` table and are the source of truth for admin/staff authority.

Supported `welp_staff.staff_role_key` values:
- `welp_employee` (default internal staff)
- `admin`
- `hr_admin`
- `developer`
- `call_center_agent`
- `kodi_admin`
- `support_agent`
- `operations`

## Rules
- `employee` is **not** treated as internal staff.
- Internal authorization checks should use `welp_staff` (or helpers), not client roles.
- Kodi app roles remain app-scoped and separate from Welp internal staff.

## Source of Truth
- **Internal staff**: `welp_staff` table
- **Client/app roles**: `users.role` and Kodi app membership role_key

## Admin Assignment
Use `/admin/welp-staff` to assign or update staff roles.

## Kodi/Portal/Times
- Times/builder access uses Welp staff authority.
- Portal management is restricted to Welp staff.
- Runtime app roles still use app-scoped role_key.

## Backfill
Use `backend/scripts/tmp-backfill-welp-staff.js` to backfill admin users into `welp_staff`.
