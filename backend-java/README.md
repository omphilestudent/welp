# backend-java

This is a new Spring Boot backend directory added **alongside** the existing Node.js backend.
No existing backend code was removed or modified.

## Current scope

This initial Java backend scaffold includes HR-focused endpoints analogous to the current Node controller work:

- `POST /api/hr/job-postings`
- `PATCH /api/hr/job-postings/{id}`
- `GET /api/hr/departments`

It includes:
- Postgres JDBC integration
- JSONB handling for `requirements`, `responsibilities`, `benefits`, `skills_required`
- `posted_by` FK resolution support (`admin_users.id` vs `admin_users.user_id`)
- Department fallback defaults and schema-aware employee counts

## Run

```bash
cd backend-java
mvn spring-boot:run
```

Auth wiring is currently header-based for scaffolding:
- `X-User-Id: <uuid>` for create job posting

You can iteratively migrate more endpoints/modules from `backend/` into this Spring Boot service.
