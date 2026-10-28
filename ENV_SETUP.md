# Environment setup

## Local backend

1. Copy `frye-market-backend-main/.env.example` to `frye-market-backend-main/.env`.
2. Fill provider keys only in the local `.env` or the server secret manager.
3. Never commit `.env`, `.env.local`, tokens, passwords or broker account numbers.
4. Start the backend from `frye-market-backend-main` with `npm install` and `npm start`.

## Local React dashboard

1. Copy `Frye-Dashboard-main/.env.example` to `Frye-Dashboard-main/.env.local`.
2. Set `REACT_APP_API_BASE` to the backend URL.
3. Keep mock mode on until the API payloads are verified.
4. Use `npm start` for the React development server.

## Vercel frontend

Add the frontend variables in Vercel Project Settings → Environment Variables. Use `REACT_APP_API_BASE` for the deployed backend URL and redeploy after changing it. Do not put provider keys, Schwab secrets, OpenAI keys or Pushover tokens in Vercel frontend variables; those belong only in the backend/Render secret store.

## Backend hosting

Add the backend variables in the backend Render service Environment settings. The frontend only needs the public backend base URL. The backend will run as an independently deployed service under your control. The backend owns all third-party credentials and calls Polygon/Massive, FMP, Finnhub, Finlight, FRED, OpenAI, Schwab, Pushover and GitHub.

The new Redline frontend can remain on demo data until the backend URL, CORS origin and field-level API contract are confirmed.

