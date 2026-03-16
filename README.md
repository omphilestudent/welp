# Welp - Employee Wellbeing Review Platform

Welp is a company review platform focused on employee experience and wellbeing, where employees can safely review companies, businesses can respond and improve, and psychologists can step in when reviews signal distress.

## Features

- **Three User Roles**: Employee, Psychologist, Business with distinct permissions
- **Anonymous Reviews**: Employees can post anonymously while maintaining internal accountability
- **24-Hour Edit/Delete**: Time-limited window for review modifications
- **Company Claim System**: Businesses can claim and manage their profiles
- **Private Messaging**: Secure communication between psychologists and employees
- **Real-time Chat**: WebSocket-based messaging system
- **Review Replies**: Both employees and businesses can reply to reviews
- **Search Functionality**: Full-text search for companies
- **Dark/Light Theme**: Toggle between dark and light modes

## Tech Stack

### Backend
- Node.js with Express
- PostgreSQL (Neon)
- JWT Authentication
- Socket.io for real-time messaging
- Rate limiting for security

### Frontend
- React with Vite
- Vanilla CSS with CSS variables
- React Router v6
- Context API for state management
- Axios for API calls
- Socket.io-client for real-time updates

## Environments

- **Production**: https://welphub.onrender.com

## Repository Structure

Use this as the source of truth for naming and navigation.

- [`frontend/`](frontend/README.md) — React app (UI, pages, components, routing)
- [`backend/`](backend/README.md) — Node.js API (controllers, routes, DB integration)
- [`backend-java/`](backend-java/README.md) — Spring Boot migration scaffold
- [`ml-services/`](ml-services/README.md) — standalone Python ML microservices
- [`docker-compose.yml`](docker-compose.yml) — local service orchestration

## Naming + Organization Guidelines

These conventions keep files easy to find and link correctly:

- **React components/pages:** `PascalCase.jsx`
  - Example: `CompanyProfile.jsx`, `ReviewCard.jsx`
- **Hooks:** `camelCase` with `use` prefix
  - Example: `useAuth.js`, `useTheme.js`
- **Service modules:** lowercase in `frontend/src/services/`
  - Example: `api.js`, `socket.js`
- **Backend routes/controllers:** `camelCase` + role/feature suffix
  - Example: `userRoutes.js`, `adminController.js`
- **Shared docs:** always use `README.md` at folder root and link from parent README.

## ML Microservices

Welp includes independently deployable Python ML services under `ml-services/`:

- `content-moderation` (`POST /moderate-review`)
- `sentiment-analysis` (`POST /analyze-sentiment`)
- `recommendation-engine` (`GET /recommendations?user_id=<id>`)
- `image-analysis` (`POST /analyze-image`)
- `fraud-detection` (`POST /detect-fraud`)

The backend review creation flow calls moderation and sentiment services before inserting a review. Moderation can block submission, and sentiment label/score are persisted with each review.
