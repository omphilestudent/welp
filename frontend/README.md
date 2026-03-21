# Welp Frontend

React + Vite client for the Welp platform. This app powers the employee experience, business hub, and psychologist dashboard.

## Audience Notes

- **Operators/Product**: The UI is role-driven (employee, business, psychologist). Most workflows live in `src/pages/`.
- **Developers**: This is a Vite app with React Router and vanilla CSS.

## Tech Stack

- React 18
- Vite 5
- React Router v6
- Axios for API calls
- Socket.io client for real-time messaging

## Folder Structure

- `src/pages/` — route-level pages (`PascalCase.jsx`)
- `src/components/` — reusable UI + feature components (`PascalCase.jsx`)
- `src/hooks/` — custom hooks (`useX.js`)
- `src/services/` — API/socket clients (`lowercase.js`)
- `src/context/` — React context providers
- `src/styles/` — global + feature styles

## Local Development

```bash
npm install
npm run dev
```

Default dev server: `http://localhost:5173`

## Build + Preview

```bash
npm run build
npm run preview
```

## Environment Variables

Create `frontend/.env`:

```bash
VITE_API_URL=http://localhost:5000/api
```

`VITE_API_URL` is baked into the bundle at build time, so set it in your deployment environment too.

## Deployment (Render Example)

1. Create a **Static Site** (or Web Service) in Render.
2. Set **Root Directory** to `frontend`.
3. Build command: `npm install && npm run build`.
4. Publish directory: `dist`.
5. Set environment variable: `VITE_API_URL=https://your-backend.example.com/api`.

For a Web Service instead of Static Site, use:

```bash
npm run preview -- --host 0.0.0.0 --port $PORT
```

