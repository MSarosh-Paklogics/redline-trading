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
| `hero-video.js` | Optional muted looping hero background video from `assets/hero-bg.mp4` (or `window.REDLINE_HERO_VIDEO`); one element re-attached after renders so playback never restarts; removes itself if the file is missing. Use only footage with usage rights |
| `hero-candles.js` | Live ES 10m candlestick backdrop in the dashboard hero (wraps `raceHero`): `futuresOhlc` history + Backend 2 SSE ticks (5 s poll fallback); newest candle and price line move in place, new bars slide in; draws nothing without real bars |
| `xray-sections.js` | Rest of the Frye X-Ray + Engine 29 page (meters, participation, distribution, briefing, sectors, macro, trend, internals map) drawn with `panel()`/`stat()`; called from corsa.js |
| `corsa.js` | Redline's own car-style first page and meters (hero, speedometer gauges, stat cards); reads `window.redlineXray.model`, falls back to labelled fixtures |
| `chart-engines.js` | Chart terminal engine read (`window.redlineChart`): Engine 17 pills, Engine 22 degree tabs, trade context, 26A/27/6, stage timeline, market context, E3/E4, SPY acc/dist levels; mirrors Frye `RowChart` (Engine17Badges / Engine17DecisionTimeline) |
| `live-quotes.js` | Live last price + daily change for every symbol (search, watchlist, ticker) from 10m/1d OHLC, batched 3 at a time with one retry (the backend 502s on bursts) |
| `dashboard-board.js` | Dashboard layout (`#/overview`): engine tabs (signal-board tiles removed at the client's request 2026-11-11; the decision chain now lives in the cockpit command screen) (E29 / strategy stack / evidence & zones; the E25 Market X-Ray tab was removed 2026-11-18 and only its 6-month market health trend stays, below the tabs) built from `redlineXraySections.e25/e29` and `redlineChart.parts()` |
| `strategies-live.js` | Live Strategies page (`window.fryePages.strategies`), two tabs — Decision interface and Strategies Full (Scalp 10m / Intermediate Swing 1h / Longer-Term 4h, mirrored from Frye `StrategiesFull.jsx`): E22 seven-degree ladder + per-degree structure, fib levels with touch evidence, invalidation/protection; E27 alignment, story and direction checks; QQQ/VIX/E25/E29 confirmation; E26 location/geometry + E6. Decision interface lists all seven degrees like Brian's page; his frontend-built research card wording, level-touch labels and risk-strip rules are mirrored (version-gated, values from the backend; newest research per degree picked automatically). Broker accounts and positions are deliberately not shown (open questions in `docs/CLIENT_CHATGPT_STRATEGIES_QUESTIONS.md`) |
| `journal-live.js` | Journal page (`window.fryePages.journal`): Engine 8 PAPER trades only (`redlineApi.paperJournal`, rows not marked PAPER are dropped) — summary, open positions, history, selected-trade timeline; paper `realizedPnL` is in points, never shown as $. Real (Schwab) trading tab is locked until the client approves access; the old local journal is the labelled "Practice" tab |
| `journal-real.js` | REAL journal adapter + view for the Engine 10 contract (`window.redlineRealJournal`), rendered only with synthetic `sample()` data inside the locked Real tab. Never wire it to a live fetch until the release gates in handoff §14 are closed |
| `cockpit-cluster.js` | Supercar instrument cluster under the dashboard hero (wraps `overview`): red-face tach = ES Master meter, speedo = 65/20/15 permission score, twin H-gate shifter (bear 1–4 left, N centre, bull 1–4 right; client mockup 2026-11-18) = ES Master meter gear (bull 1–4 in 7-point steps from 63 · TURBO 90+ · N 50–62 · bear 1–4 underneath mirrored below 50: 43/36/29/<29; client spec 2026-11-11, bear side 2026-11-18). Status words containing RECOVER/IMPROV/BUYING render green; gearbox and command-screen accents follow the gear tone (client 2026-11-18), TFT screen (clock, breadth/buy-vol/health/distribution bars, ES, net NH/NL), a digital readout strip underneath (Brian's X-Ray stat names: health, breadth, stock volume, distribution, sectors, data), and a command screen that pages through the full X-Ray records (Brian's card layouts: participation, selling/distribution pressure, market leadership, trade permission strip, index vs market, stress, macro) one at a time; Engine 29 lives in the dashboard Engine 29 tab and on Market X-Ray (client layout, live moves at the bottom) with ‹ › arrows and named dots, above the decision chain incl. E6. Live data only; map streets are decoration; no brand marks |
| `car3d.js` | NOT LOADED since 2026-11-12 (the client removed the car from the command screen; kept for reuse). Optional 3D car: if `assets/local/enzo.glb` exists, swaps the command-screen car photo for a rotatable model via `<model-viewer>` (CDN, loaded only then); download starts at script load, cached in Cache Storage. The model is committed and deployed (owner confirmed the licence 2026-11-11); `build.mjs` copies it to `dist/` but skips `*.orig.glb` backups |
| `market-pulse.js` | Dashboard "Market pulse" section (wraps `overview`): live % change (`redlineQuoteRead` from live-quotes.js) for a fixed list always shown (client 2026-11-16): ES, QQQ, SPX, NDX, DOW, IWM, MDY, VIX, TLT, CL1! (indexes read as `I:SPX`/`I:NDX`/`I:DJI`/`I:VIX`; CL1! price from MCL because the backend cannot resolve CL); index rows show the Engine 29 tactical state grouped bullish/bearish/neutral with the raw state, VIX/TLT/CL1! show the raw E29 state ungrouped, ES shows the E17 bias + E6 permission. Evidence, not trade calls; failed reads show `—` |
| `sectors-live.js` | Live Sectors page (`window.fryePages.sectors`): 10m/1H/4H/EOD sector cards in Frye's fixed order + `/live/pills` deltas; loads after engines.js (which resets `fryePages`) |
| `live-stream.js` | Real-time candles: Backend 2 SSE bars merged into the live bar cache, chart SVG redrawn ≤1/s; requested same-origin `/stream/...` (proxied by `server.mjs` and the `vercel.json` rewrite, because Backend 2 only allows Frye's origins); 5 s Backend 1 polling fallback |
| `chart-interact.js` | TradingView-style controls: drag pan (time + price), price-axis drag to scale, wheel zoom, Shift+wheel scroll, keys, double-click axis reset; `window.redlineChartView` feeds `chartGeometry()`; keeps panel scroll across re-renders |
| `chart-drawings.js` | Chart drawing tools, TradingView-style (client 2026-11-19/20). Three rail buttons with flyouts (? help + favourites star per tool): Lines (Trendline Alt+T, Ray, Info line, Extended line, Trend angle, Horizontal line Alt+H, Horizontal ray Alt+J, Vertical line Alt+V, Crossline Alt+C) · Channels (Parallel, Regression trend = least-squares on closes ±2σ, Flat top/bottom, Disjoint) · Pitchforks (Andrews, Schiff, Modified Schiff, Inside); Fibonacci (Fib retracement Alt+F with level prices, Trend-based fib extension, Fib channel, Fib time zone, Fib speed resistance fan, Trend-based fib time, Fib circles, Fib spiral, Fib speed resistance arcs, Fib wedge, Pitchfan) · Gann (Gann box, Gann square fixed, Gann square, Gann fan) — per-level colours (TradingView palette; one colour or back to level colours from the toolbar / settings); Brushes (Brush, Highlighter) · Arrows (marker, arrow, mark up/down) · Shapes (Rectangle Alt+Shift+R, Rotated rectangle, Path, Circle, Ellipse, Polyline, Triangle, Arc, Curve, Double curve). Points anchored to bar time + price (live bars; demo bars fall back to index per symbol+tf) on an overlay `.rd-layer` inside `.chart-frame` (never a direct child svg); single-click line tools snap to a bar. Selected drawing gets the TradingView floating toolbar (grip-draggable): line colour, text + text colour, fill, width, line style, settings modal (extend left/right, point prices), alert (opens the existing LOCAL demo alert prefilled with the line's price now — never the backend), lock, delete, ⋯ menu: visual order, visibility on intervals, clone (also Ctrl+drag), copy (Ctrl+C / Ctrl+V), hide (show again from the Drawing manager). Esc, Delete, Enter, Ctrl+Z. Window-capture listeners so drawing never pans the chart or opens the price-level dialog; redraws on rAF with a timer backup. Saved in localStorage only; visual only, no backend calls. Pure geometry unit-tested by `npm test`; browser QA in `qa-drawings.cjs` |
| `chart-indicators.js` | Chart Indicators pull-down (client 2026-11-24, laid out like Brian's Full Chart menu: E22 wave nodes per degree · E18 liquidity · EMA · Volume · SMZ overlays · E17 · E26 · E25 · E29). Live: Institutional + NEG negotiated zones from `/api/v1/es-smz-levels` (the backend serves Brian's `data/es-smz-manual-zones.txt`; ES charts only), Acc/Dist shelves `/api/v1/es-smz-shelves`, EMA 10/20/50/200, volume (chartPrefs.volume), E17 top-right pills (the E17 live strip above the chart is hidden so the chart fills the screen; side panel starts closed once per session). Trader View panel (Indicators toggle, off by default; Brian 2026-11-24): `redlineApi.traderView` → `GET /api/v1/trader-view?symbol=ES` (display-only `traderView.v1`), mirrors Frye `src/pages/traderView/TraderViewPage.jsx` — verdict, market direction (the route's own gear wording), zone, right-now text, checklist, 26→3→4→6 pipeline, six engine cards with Show details, timeframe tables, legend; polled every 15 s, last good reading kept on failure; fixed panel centred over the chart but outside `.chart-frame` so it never pans/zooms the chart. Items without a feed yet are marked NEXT. Overlay `.ci-layer` (under the drawings), prefs in localStorage `redline-indicators-v1` |
| `engine11-history.js` | ES history back to 2020 from the owner-only Engine 11 / 2C archive `GET /engine2c-private-history/page` (`redlineApi.engine11Page`), mirroring Frye `RowChart/engine11HistoricalAdapter.js` (same 2020+ / legacy dataset + price-basis versions, page contract checks, duplicate id/time refusal). Owner pastes the key in the chart's **History** button dialog; kept only in the browser under Frye's names `engine2cResearchOwnerKey` (session) / `engine2cResearchOwnerAccessV1` ({key, expiresAt}); never in code or logs. Daily/4H/1H load fully, 10m/5m ~200 days. Archive candles stay exactly as served; live candles only after the archive's last bar (≥ half a bar later). The archive set is held under a property on `liveBarsCache`, so the app's minute re-seed and live-stream.js (no trim for `arr.engine11`) never truncate it. Needs Brian's CORS change (branch `engine2c/redline-owner-history-cors-20261124`) deployed; until then the button reads "archive not reachable" and retries each minute. Unit tests: `tests/engine11-history.test.cjs` |
| `live-surfaces.js` | Live panels for strategies, chart and meters; re-attaches them after app.js re-renders |
| `page-nav.js` | SaaS-style sticky "On this page" section navigator built after each render from visible `.race-section-label` / tab bars (or top-level panel titles), scroll-spy highlight, smooth jump, back-to-top button. Presentation only |
| `motion-pro.js` | Presentation-only motion on top of `motion.js`: staggered reveal of each element type the first time it appears on a page visit (never on live refreshes), gauge needle sweep, yellow flash on values that change between renders. Off with prefers-reduced-motion / `state.settings.reduced` |
| `navigation.js`, `chart-tools.js`, `terminal.js`, `corsa.js`, `motion.js`, `protection.js` | UI layers added on top of app.js |

Backend base URL resolution in `backend-api.js`: `window.REDLINE_API_BASE` →
`?api=` query param → `localStorage['redline-api-base']` → default
`https://frye-market-backend-1.onrender.com`. All calls are GET with an 8s timeout.

History length is dynamic (`barTotal()`): ES/MES ask `/api/v1/futures/ohlc?limit=5000` (the route returns what it keeps: ~14 months daily, ~8 months 4H, ~3 months 1H, ~2 weeks 10m), other symbols `/ohlc?limit=1000`; with the Engine 11 archive unlocked ES goes back to 2020. Never hard-code 180. The time axis shows real bar times (`chartAxisLabel` in chart-tools.js).

Asset cache-busting uses `?v=` query strings in index.html — bump them when
changing a script that's deployed.

## Commands

```bash
npm run dev      # static server on http://127.0.0.1:4173 (PORT env to change)
npm run check    # node --check on all scripts — run after every JS edit
npm test         # node:test unit tests (tests/*.test.cjs, no dependencies)
npm run build    # copies app into dist/ (Vercel serves dist/)
```

`qa*.cjs` are Playwright checks against a running dev server; Playwright is not
a project dependency.

## Repo hygiene

The repo root also contains client deliverables (`*.docx`, `build_*.py`,
`make_*.py`, `docx_tmp/`, `sow_render/`, the release zip). They are not part of
the app — don't modify or commit them unless asked.
