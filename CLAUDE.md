# Redline / Frye Platform — Claude Code guide

Redline is a new frontend for the existing **Frye** trading platform. This repo
(`MSarosh-Paklogics/redline-trading`) holds only the Redline frontend. The client's
repos are cloned read-only under `frye/` (git-ignored, pulled daily):

- `frye/Frye-Dashboard` — `bfrye1973/Frye-Dashboard`, React reference UI.
- `frye/frye-market-backend` — `bfrye1973/frye-market-backend`, engines + APIs.
  `services/core/server.js` is the source of truth for which routes are mounted.

**Never edit, commit, push or deploy anything in `frye/`.** If Redline needs a
backend change, write it up as a request for Brian. Daily change notes are in
`docs/frye-changes/`.

Project knowledge that is not in code (engine decisions, superseded designs,
approvals, open tasks) lives in [docs/FRYE_MASTER_HANDOFF.md](docs/FRYE_MASTER_HANDOFF.md).
Read it before touching engine-related UI. If the handoff and the code disagree,
ask — do not guess which is current.

## Rules that must never be violated

1. **Signal-only frontend.** Redline displays signals and engine state. It never
   places, routes, or simulates broker orders against the live backend
   (see commit 61d4993, "Remove buy sell controls"). Don't reintroduce order controls.
2. **Engine decisions stay on the server.** The frontend reads canonical engine
   output; it never recomputes, overrides, or "fills in" an engine result.
   Missing data renders as `UNAVAILABLE` / `—`, never as zero or a fabricated value.
3. **Engine authority boundaries** (full table in the handoff, §3):
   - Engine 22 = sole Elliott Wave structural authority.
   - Engine 27 = read-only interpretation; never overrides E22, never creates execution.
   - Engines 3, 4, 25, 29 = independent market evidence; never grant permission.
   - Engine 26/26B = proposes location/geometry only. Engine 6 = final trade permission.
   - "Wave developing", "strategy ready" and "trade permitted" are separate fields;
     contradictions between engines must stay visible. Ready ≠ authorized.
4. **Paper journal only.** Never read or show real-account journal data (`/api/v1/trade-journal`
   without `accountMode=PAPER`, `/trade-journal/real-performance`, broker accounts, positions,
   account masks) until Brian approves access rules and Redline has sign-in. Decided 2026-11-04.
5. **Only call read endpoints that are mounted.** Never call admin/refresh/write
   routes, `/api/trading/*`, or `POST /api/v1/engine26/manual-hard-signal` from
   Redline. `strategy-state`, `reaction-quality` and `gauges` are not served.
   Treat `ok:false`, 4xx/5xx and empty arrays as unavailable, never as a signal.
   REST is Backend 1; LIVE SSE (`/stream/futures/agg`, `/stream/agg`) is Backend 2.
6. **No secrets in this repo or the frontend.** Schwab, Polygon/Massive, FMP,
   Finnhub, OpenAI, Pushover etc. keys belong only in the backend's Render
   secret store. The frontend knows only the public backend base URL.
   Never commit `.env*`, tokens, broker account numbers or subscriber data.
7. **Keep Redline's own UI.** Feed live data into the existing components (corsa gauges, `stat()` cards); don't replace pages with new generic box layouts.
8. Don't present demo/fixture data as live. Live surfaces are labelled
   `LIVE BACKEND`; anything else is illustrative.

## Stack and layout

Buildless vanilla JS/HTML/CSS, Node ≥18, no runtime dependencies.
Scripts load in order from [index.html](index.html), each an IIFE attaching to `window`:

| File | Role |
| --- | --- |
| `backend-api.js` | `window.redlineApi` — the only place backend routes are defined |
| `app.js` | Core app, hash router (`#/overview`, `#/chart`, `#/signals`, `#/sectors`, `#/xray`, `#/strategies`, `#/journal`, `#/settings`, …), demo fixtures |
| `engines.js` | Engine Room / reference-aware engine views |
| `market-xray.js` | Loads the live Engine 25 Market X-Ray + Engine 29 model (`window.redlineXray.model`), mirroring Frye `src/pages/engine25/Engine25MarketXrayPreview.jsx`. Display only, no markup. |
| `xray-sections.js` | Rest of the Frye X-Ray + Engine 29 page (meters, participation, distribution, briefing, sectors, macro, trend, internals map) drawn with `panel()`/`stat()`; called from corsa.js |
| `corsa.js` | Redline's own car-style first page and meters (hero, speedometer gauges, stat cards); reads `window.redlineXray.model`, falls back to labelled fixtures |
| `chart-engines.js` | Chart terminal engine read (`window.redlineChart`): Engine 17 pills, Engine 22 degree tabs, trade context, 26A/27/6, stage timeline, market context, E3/E4, SPY acc/dist levels; mirrors Frye `RowChart` (Engine17Badges / Engine17DecisionTimeline) |
| `live-quotes.js` | Live last price + daily change for every symbol (search, watchlist, ticker) from 10m/1d OHLC, batched 3 at a time with one retry (the backend 502s on bursts) |
| `dashboard-board.js` | Dashboard layout (`#/overview`): live ES signal board (strategy chain E22→E27→E26A→E15→E6, evidence E25/E29/E3/E4), decision chain kept as three separate fields with contradictions shown, and engine tabs (E25 / E29 / strategy stack / evidence & zones) built from `redlineXraySections.e25/e29` and `redlineChart.parts()` |
| `strategies-live.js` | Live Strategies page (`window.fryePages.strategies`): E22 seven-degree ladder + per-degree structure, fib levels with touch evidence, invalidation/protection; E27 alignment, story and direction checks; QQQ/VIX/E25/E29 confirmation; E26 location/geometry + E6. Backend fields only — Frye's frontend-hard-coded owner text and broker positions are deliberately not shown (open questions in `docs/CLIENT_CHATGPT_STRATEGIES_QUESTIONS.md`) |
| `journal-live.js` | Journal page (`window.fryePages.journal`): Engine 8 PAPER trades only (`redlineApi.paperJournal`, rows not marked PAPER are dropped) — summary, open positions, history, selected-trade timeline; paper `realizedPnL` is in points, never shown as $. Real (Schwab) trading tab is locked until the client approves access; the old local journal is the labelled "Practice" tab |
| `journal-real.js` | REAL journal adapter + view for the Engine 10 contract (`window.redlineRealJournal`), rendered only with synthetic `sample()` data inside the locked Real tab. Never wire it to a live fetch until the release gates in handoff §14 are closed |
| `sectors-live.js` | Live Sectors page (`window.fryePages.sectors`): 10m/1H/4H/EOD sector cards in Frye's fixed order + `/live/pills` deltas; loads after engines.js (which resets `fryePages`) |
| `live-stream.js` | Real-time candles: Backend 2 SSE bars merged into the live bar cache, chart SVG redrawn ≤1/s; requested same-origin `/stream/...` (proxied by `server.mjs` and the `vercel.json` rewrite, because Backend 2 only allows Frye's origins); 5 s Backend 1 polling fallback |
| `chart-interact.js` | TradingView-style controls: drag pan (time + price), price-axis drag to scale, wheel zoom, Shift+wheel scroll, keys, double-click axis reset; `window.redlineChartView` feeds `chartGeometry()`; keeps panel scroll across re-renders |
| `live-surfaces.js` | Live panels for strategies, chart and meters; re-attaches them after app.js re-renders |
| `navigation.js`, `chart-tools.js`, `terminal.js`, `corsa.js`, `motion.js`, `protection.js` | UI layers added on top of app.js |

Backend base URL resolution in `backend-api.js`: `window.REDLINE_API_BASE` →
`?api=` query param → `localStorage['redline-api-base']` → default
`https://frye-market-backend-1.onrender.com`. All calls are GET with an 8s timeout.

History length is dynamic (`barTotal()`, up to 1,000 bars from `/ohlc?limit=1000`); never hard-code 180.

Asset cache-busting uses `?v=` query strings in index.html — bump them when
changing a script that's deployed.

## Commands

```bash
npm run dev      # static server on http://127.0.0.1:4173 (PORT env to change)
npm run check    # node --check on all scripts — run after every JS edit
npm run build    # copies app into dist/ (Vercel serves dist/)
```

`qa*.cjs` are Playwright checks against a running dev server; Playwright is not
a project dependency.

## Repo hygiene

The repo root also contains client deliverables (`*.docx`, `build_*.py`,
`make_*.py`, `docx_tmp/`, `sow_render/`, the release zip). They are not part of
the app — don't modify or commit them unless asked.
