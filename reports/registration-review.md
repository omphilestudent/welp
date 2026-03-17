# Registration Process Review (Frontend → Backend)

Date: 2026-03-17  
Repo: `welp`

## 1) Frontend Entry Points

### Role chooser & employee signup
- **Route:** `/register`
- **File:** `frontend/src/pages/Register.jsx`
- **Employee submit:** uses `registerEmployee()` → `POST /api/auth/register`
  - Payload: `{ email, password, displayName, role: 'employee', isAnonymous }`
  - Success: stores token, redirects to `/dashboard`

### Psychologist application
- **Route:** `/register/psychologist`
- **File:** `frontend/src/pages/PsychologistRegister.jsx`
- **Submit:** `registerPsychologist()` → `POST /api/auth/register/psychologist`
  - Payload: `email, password, displayName, role, licenseNumber, licenseBody, licenseExpiry, yearsExperience, qualifications, specialisations, therapyTypes, languages, sessionFormats, practiceLocation, bio, website, documents[]`
  - Documents: values from upload endpoint `/api/applications/upload`

### Business application
- **Route:** `/register/business`
- **File:** `frontend/src/pages/BusinessRegister.jsx`
- **Submit:** `registerBusiness()` → `POST /api/auth/register/business`
  - Payload: `email, password, displayName, role, jobTitle, contactPhone, companyName, companyWebsite, industry, companySize, country, companyDescription, linkedinUrl, registrationNumber, claimExistingProfile, claimCompanyId, howDidYouHear, documents[]`

## 2) Frontend API Helpers
- **Service:** `frontend/src/services/registrationService.js`
  - `registerEmployee`, `registerPsychologist`, `registerBusiness`
  - All throw errors with a consistent message string
- **Axios base URL:** `frontend/src/services/api.js` uses `VITE_API_URL || http://localhost:5000/api`

## 3) Backend Routes
- **Auth routes:** `backend/src/routes/authRoutes.js`
  - `POST /api/auth/register` → `registerEmployee`
  - `POST /api/auth/register/psychologist` → `registerPsychologist`
  - `POST /api/auth/register/business` → `registerBusiness`

## 4) Backend Registration Handlers
- **File:** `backend/src/controllers/authController.js`
  - Shared helpers:
    - `validateRegistrationCredentials(email, password)`
    - `createUserAccount({ email, password, role, displayName, isActive, isVerified, status, isAnonymous, jobTitle })`
  - **registerEmployee**
    - Creates user (active + verified)
    - Assigns starter subscription + emits `user.signup`
  - **registerPsychologist**
    - Validates license fields
    - Validates documents (license, government ID, qualification)
    - Creates user (inactive + pending_review)
    - Inserts into `psychologist_applications` if table exists
  - **registerBusiness**
    - Validates company + registration number + contact phone
    - Validates documents (registration certificate + ownership proof)
    - Creates user (inactive + pending_review)
    - Inserts into `business_applications` if table exists
    - Creates claim request if `claimExistingProfile = true`

## 5) Database Tables & Columns Referenced

### Core
- `users`: `email, password_hash, role, display_name`
  - Optional: `is_active, is_verified, status, is_anonymous, job_title`

### Psychologist applications
- `psychologist_applications`
  - Modern schema: `user_id, status, license_number, license_body, license_expiry, years_experience, qualifications, specialisations(jsonb), therapy_types(jsonb), session_formats(jsonb), languages, practice_location, bio, website, documents(jsonb)`
  - Legacy schema supported (email/full_name/alternate column names)

### Business applications
- `business_applications`
  - `user_id, status, company_name, job_title, company_website, industry, company_size, country, company_description, linkedin_url, registration_number, documents(jsonb), contact_information(jsonb), claim_existing_profile, claim_company_id, how_did_you_hear`

### Claim requests
- `claim_requests` (created if missing)

## 6) Known Failure Points (as-is)

1. **Missing table or missing columns**
   - `psychologist_applications` or `business_applications` missing or missing required columns can trigger 500s.
2. **Documents not provided / wrong payload**
   - Required document types are enforced before user creation.
3. **Schema drift in front-end payload**
   - Frontend must send fields using backend names (e.g., `licenseNumber`, `licenseBody`, `registrationNumber`, `contactPhone`).
4. **Claim flow**
   - `claimCompanyId` must be a valid UUID and an unclaimed company.

## 7) Recommended Debug Checklist
- Verify required tables exist in DB.
- Confirm document upload returns URLs stored as `documents[]`.
- Check server logs for column detection output (enable `EXPOSE_REGISTRATION_ERRORS=true` in dev).

