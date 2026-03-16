# Welp Frontend

React + Vite client for the Welp platform.

## Production URL

The Render-hosted production build is available at https://welphub.onrender.com.

## Folder Structure

- `src/pages/` — route-level pages (`PascalCase.jsx`)
- `src/components/` — reusable UI and feature components (`PascalCase.jsx`)
- `src/hooks/` — custom hooks (`useX.js`)
- `src/services/` — API/socket clients (`lowercase.js`)
- `src/context/` — React context providers
- `src/styles/` — global and feature styles

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Environment Variables

Copy `.env.example` to `.env` and update the values for your environment:

```bash
cp .env.example .env
# edit VITE_API_URL to point at your backend, e.g. https://welp-4ipy.onrender.com/api
```

`VITE_API_URL` is baked into the bundle at build time, so remember to set it wherever the app is deployed (Render, Vercel, etc.).

## Deploying to Render

1. Create a new **Static Site** (or Web Service) in Render that uses this repository.
2. Set **Root Directory** to `frontend`.
3. Set the build command to `npm install && npm run build`.
4. Set the publish directory to `dist`.
5. Add an environment variable `VITE_API_URL=https://welp-4ipy.onrender.com/api` (or the appropriate backend URL).
6. For a Web Service instead of Static Site, use the start command `npm run preview -- --host 0.0.0.0 --port $PORT`.

The build script already runs `node ./node_modules/vite/bin/vite.js build`, which works reliably in Render's sandbox.
