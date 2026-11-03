# Frye / Redline master handoff

The single source of truth for project knowledge that isn't in the code.
It replaces the ChatGPT project's memory.

- **Source:** ChatGPT Frye project export of 2026-11-03, cross-checked by Claude Code
  against the cloned repos on the same day. Items marked ✔ were verified in code.
  Notes added by Claude are marked **[Claude]**.
- **Labels:** CURRENT = verified or confirmed in use · SUPERSEDED = replaced ·
  UNCERTAIN = not verified or possibly outdated · UNKNOWN = no evidence. A file existing in
  GitHub proves it was implemented, not that it works in production.
- **Excluded:** API keys, Schwab and broker credentials, private history keys, account
  numbers, subscriber data, and engine source code. Keep it that way.
- **Approval:** sharing Frye material with this workspace requires Brian's approval.
  ☐ pending ☐ approved (date: ____)

Last reviewed: 2026-11-03

---

## 1. Repositories and deployments

| System | Repo | Branch / HEAD on 2026-11-03 | Hosting |
| --- | --- | --- | --- |
| Frye React dashboard | `bfrye1973/Frye-Dashboard` → `frye/Frye-Dashboard` | main @ `6971557d` ✔ | Render: https://frye-dashboard.onrender.com |
| Frye backend + engines | `bfrye1973/frye-market-backend` → `frye/frye-market-backend` | main @ `67bfea40` ✔ | Render. **Backend 1** (REST): https://frye-market-backend-1.onrender.com · **Backend 2** (SSE streams): https://frye-market-backend-2.onrender.com |
| Redline frontend | `MSarosh-Paklogics/redline-trading` (this repo) | main @ `61d4993` | Vercel (`dist/`) per `vercel.json`; public URL UNKNOWN |

**[Claude]** ChatGPT named the Redline repo `redline-trading-performace` @ `b055c270`. This
checkout's remote is `redline-trading` @ `61d4993`. Confirm which repo is canonical.

- **Frye dashboard:** React app using TradingView Lightweight Charts.
- **Frye backend:** Node/Express with route modules, jobs, engine logic, JSON snapshots and
  historical datasets.
- **Route registry:** `services/core/server.js` is the source of truth for which routes are
  live. A route file that isn't mounted there is not served.
- **Redline:** buildless vanilla JS. Its market and engine outputs are still mostly fixtures.

**Environment variable names (values never go in docs):**

| Area | Variables |
| --- | --- |
| Frye frontend | `REACT_APP_API_BASE`, `REACT_APP_API_URL`, `VITE_TRADING_API_BASE`, `REACT_APP_STREAM_BASE`, `REACT_APP_BUILD_STAMP`, `REACT_APP_COMMIT_SHA` |
| Frye backend | `POLYGON_API`, `POLYGON_API_KEY`, `POLY_API_KEY`, `POLYGON_REST_BASE`, `POLYGON_BASE_URL`, `ES_CONTRACT_OVERRIDE`, `FUTURES_ES_CONTRACT_OVERRIDE`, `FUTURES_NQ_CONTRACT_OVERRIDE`, `FUTURES_RESOLVE_CACHE_MS` |
| Redline | `PORT` |

This is a partial list. No staging URLs are verified; GitHub Actions runs are not staging.

**Chart rollback points (Frye-Dashboard):**

| PR | Commit | Meaning |
| --- | --- | --- |
| #168 | `48f0390b` | First fast-loading history. This was the old rollback baseline (SUPERSEDED). |
| #169 | `42571e85` | Recent-candle reconciliation, verified LIVE on Nov 3. Now the named rollback point. |
| #170 | `6971557d` | LIVE latency fix. Merged, but deployment and Brian's visual acceptance are UNCERTAIN. |

## 2. The four Redline pages to connect

**Scope (decided Nov 3, 2026):** bring four functional areas of the Frye dashboard into Redline:
Dashboard, Charts, Strategies and General.
- Keep Redline's look.
- Never duplicate engine calculations in Redline.

| Page | Data it reads | Done when |
| --- | --- | --- |
| **Dashboard** | `/api/v1/dashboard-snapshot`, `/api/v1/futures/market-meter`, `/api/sectorcards-10m`, `/api/v1/engine25/market-health/summary`, `/api/v1/engine29/cross-market-stress/summary` | It shows the same ES state and timestamp as Frye. Cards match the API. Stale or unavailable data is visibly marked. Nothing simulated is labelled LIVE. |
| **Charts** | `/api/v1/futures/ohlc` (ES), `/api/v1/ohlc` (equities), SSE `/stream/futures/agg` and `/stream/agg` on Backend 2, private Engine 11 history, Engine 22 overlays and Fib levels | OHLCV and the physical contract are correct. LIVE bars aren't blocked by history loading. Older candles load on scroll. Overlays match Engine 22. Switching timeframe never shows stale data. |
| **Strategies** | `/api/v1/dashboard-snapshot` → `strategies[id]`: `engine23Interpretation` (structure), `engine15` (readiness), `engine26ProposedGeometry` (geometry), `permission` (Engine 6 final, `engine6.finalFromEngine15.v1`) | Direction and warnings are exactly what the engines supply. Structure, readiness and permission are shown separately. There are no invented percentages and no trade actions. |
| **General** | UNKNOWN. A likely source is Frye `src/pages/redline/ControlsPage.jsx`. | Brian approves a field-by-field mapping first. Don't invent features. |

**Frye source map:**

| File | Role |
| --- | --- |
| `src/App.js` | Routes and page composition |
| `src/pages/NewDashboard.jsx` | Main dashboard |
| `src/pages/rows/RowChart/index.jsx`, `src/pages/FullChart.jsx` | Chart and overlays |
| `src/pages/rows/RowChart/engine11HistoricalAdapter.js` | Engine 11 history adapter |
| `src/pages/rows/RowStrategies/index.jsx`, `src/pages/StrategiesFull.jsx` | Strategies |
| `src/hooks/useDashboardSnapshot.js` | Snapshot polling and retry |
| `src/lib/ohlcClient.js` | OHLC and SSE client |
| `src/pages/redline/ControlsPage.jsx` | Possible source for General (not yet mapped by the owner) |

**Recommended architecture (UNCERTAIN, not yet approved):**
- Build a separate Redline backend-for-frontend that owns users, subscriptions, SQL, auth and
  proxying.
- Frye stays the market and engine backend.
- The database, schema and hosting are UNKNOWN.

## 3. Engines

**Authority chain:**
- **Engine 22:** structure.
- **Engine 27:** interpretation.
- **Engines 3, 4, 25, 29:** independent market evidence.
- **Engine 26 / 26B:** location and proposed geometry.
- **Engine 6:** final permission.
- **Engine 7:** sizing.
- **Engine 8:** execution and fills.
- **Engine 10:** journal and positions.

This is an ownership model, not a verified runtime call order. Many engines publish only
inside `dashboard-snapshot`.

| Engine | Role | May NOT | API / version |
| --- | --- | --- | --- |
| 2 / 2C / 2E / 2F | Chart integration, history consumption | Rewrite Engine 11 candles or override Engine 22 | RowChart, `futures/ohlc`, SSE, private history |
| 3 | Level reaction context | Authorize execution | `/reaction-score`, `/es-reaction-score`; `/reaction-quality` is **not mounted** ✔ |
| 4 | Volume and participation | Grant permission | `/volume-behavior`, `/es-volume-behavior` |
| 5 / 5B | Scalp status | Stand in for Engine 6 | `/scalp-status` |
| 6 | **Final trade permission** | Be bypassed by a UI readiness badge | `/trade-permission` (v1, legacy) and `/trade-permission-v2` (`engine6.marketMind.v2`) ✔. Which is final for each strategy is UNCERTAIN. |
| 7 | Position sizing | Let the UI size positions | UNKNOWN |
| 8 | Execution and broker fills | Treat paper as real | Exists; LIVE order API UNKNOWN |
| 9 | Trade management and profit protection | Alter wave counts | UNKNOWN |
| 10 | Journal and open positions | Rewrite historical fills | `/trade-journal`, `/real-performance`, protected `/real-fill` |
| 11 | Immutable ES 2020+ candle archive | Become execution price, mutate OHLCV, mix contracts | Private `/engine2c-private-history/page` |
| 12 | Storage maintenance | Be treated as a public reader | `engine12StorageMaintenance.js` |
| 13 | Notifications only | Open, size or approve trades | Related to `/alerts/*` POST routes |
| 15 | Strategy readiness and alerts | Equate readiness with approval | Modules exist; contract UNKNOWN |
| 16 | Morning Fib | Replace Engine 22 structure | `/morning-fib` (`NO_IMPULSE` is a valid state) |
| 17 | Chart overlay and presentation | Change upstream decisions | `/chart-overlay` |
| 21 | Alignment | Grant orders | Module only |
| **22** | **Sole Elliott Wave authority**: seven-degree counts, Fib levels, invalidations | Be revised by Engine 27, the UI or other engines | `/waves/active?symbol=ES` (ES only); `engine22WaveStrategy` in the snapshot. The canonical model version is UNCERTAIN. |
| 23 | Wave behavior interpretation card | Take wave or permission authority | `Engine23BehaviorCard` |
| 24 | News risk | Change counts or permission | `newsRisk` in the snapshot |
| 25 | Market confirmation: ES Master, 4H, EOD, breadth, macro, 65/20/15 | Modify waves or invent evidence | `/engine25/*` (`fullDashboard.v0.5`). EOD formulas are still being revised. |
| 26 | Trade location and geometry | Become permission or execute | Inside the snapshot. The only route is **POST** `/engine26/manual-hard-signal` (protected) ✔ |
| 26B | Strategy 1 resolution and timing (`WAITING` state) | Override Engine 22 or 6 | `engine26/strategy1` |
| 27 | Trader Intelligence: alignment, conflict warnings, learning | Rewrite waves, fake forecasts, grant permission | `/engine27/micro-alignment/history`. V6/V7 production state is UNCERTAIN. |
| 28A | Replay and training diagnostics | Use future data or touch live decisions | `engine28APipelineDoctor` |
| 29 | Cross-market stress | Change counts or authorize | `/engine29/cross-market-stress[/summary]` (`route.v1`) |
| 32 | Canonical composite (provenance label) | Imply execution authority | UNKNOWN |
| 33 | Programmer and commercial migration workstream | Alter authority boundaries | No endpoint |

**Safety principle (Oct 31):**
- A bullish wave can coexist with bearish participation and a blocked permission.
- Show the disagreement. Never merge "wave developing", "strategy ready" and "trade
  permitted" into one green signal.

## 4. Elliott Wave rules

- **Degrees, low to high:** Submicro, Micro, Subminute, Minute, Minor, Intermediate, Primary.
- **Timeframe mapping:** mostly UNKNOWN. Micro has 5m evidence. Minor is associated with 1H
  and Intermediate with 4H.
- **Terminology:** Redline's demo says "Subminuette", but Frye uses **Subminute**. Confirm
  before relabelling, and never rename canonical keys.
- **Engine 22 owns:** pivots, impulses, ABC and triangle corrections, lifecycle, invalidations,
  owner marks and higher-degree protection. Owner-approved working models are separate from
  alternatives and shadow studies.
- **Fibonacci:** Engine 22 publishes the levels. Frontends render them and never recompute
  anchors.
  - Exact ratio sets and rounding are UNKNOWN, so don't substitute generic 0.382/0.618 levels.
  - Fib extensions can be toggled independently of the wave display.
- **Classical rules:** the precise implemented exceptions (W2 retrace, W3 not shortest, W4
  overlap) are UNKNOWN. Never hard-code them in Redline.
- **Nov 1 request:** scenario selection for Submicro and Subminute, plus label and line fixes.
  Status UNCERTAIN.
- **Engine 27 learning (Oct 28):** log wave-completion and Fib-touch events separately.
  - Keep event, publication and ingestion times.
  - Measure +10/+30/+60 min outcomes.
  - Never reconstruct a prediction from a count approved afterward.

## 5. Historical candle architecture

| Data | Source |
| --- | --- |
| ES, NQ, YM, RTY recent OHLC | Backend 1 `/api/v1/futures/ohlc` (Massive/Polygon plus contract resolver) |
| Equities (SPY, QQQ) | Backend 1 `/api/v1/ohlc` |
| LIVE ES | Backend 2 SSE `/stream/futures/agg` |
| LIVE stocks | Backend 2 SSE `/stream/agg` |
| ES 2020+ archive | Engine 11, private, paginated |
| Replay | Separate snapshot store (not the Engine 11 archive) |

**Engine 11 archive:**
- **Identity:** UNADJUSTED view, dataset version `research-dataset:2e555ba8…aaae2`, price basis
  `price-basis:04ec3639…22b15`.
- **Usage:** research-only. It is not structurally eligible and not an execution price.
- **Expected candle counts:** 5m 471,044 · 10m 235,733 · 1H 39,364 · 4H 9,319 · 1D 1,645 ·
  1W 321 · 1MO 53.
- **No 1m:** the archive has no 1m data; 1m history comes from `futures/ohlc`.
- **Pagination:** `frame`, `view`, `limit=1000`, `direction=DESC`, version IDs and `cursor`.
  Auth is required. Sort rows chronologically before use.
- **Time:** archive provenance is in nanoseconds; the chart uses Unix **seconds**. Never pass
  nanoseconds to Lightweight Charts.
- **Contracts:** `ES` is logical. Merge recent and LIVE data only on a matching *physical*
  contract, and preserve rollover provenance.
- **Load order:** recent page first, then a bounded bridge from `futures/ohlc`, then older pages
  on scroll. Pagination and backfill must never block LIVE bars (PR #170).
- **Display time zone:** `America/Phoenix` in Frye's UI. Raw timestamps stay UTC.
- **UNKNOWN:** archive storage location, backup policy, CME session and holiday calendar,
  exact roll timestamps, and gap policy. Never fabricate candles to fill gaps.

## 6. API contracts

**General rules:**
- REST is JSON. Candle `time` is Unix seconds and ISO strings are UTC.
- Response wrappers differ by route: a bare array, `{ok, data}`, or a raw document. Parse each
  route by its own contract, not with one generic parser.
- `ok:false`, 404/502/503 and empty arrays are **never** valid signals. Some routes return HTTP
  200 with `ok:false`.
- Keep `generatedAt`, `updatedAtUtc`, `servedAt` and event times separate.

### Read endpoints Redline needs

| Endpoint | Key params → fields | Failure |
| --- | --- | --- |
| `GET /api/health` | → `ok`, `service`, `ts` | Network error ≠ `ok:false` |
| `GET /api/v1/dashboard-snapshot` | `symbol`, `includeContext` → `strategies`, `newsRisk`, `snapshotSource` | 503 missing, 500 error |
| `GET /api/v1/futures/market-meter` | `symbol` → `version`, `updated_at_utc`, `lights{tf}`, `master{score,state,tone,weights}`, `errors` | 500. **The 4H and EOD lights are placeholders** (`futures-market-meter-v2-spy-style-10m-30m-1h`). |
| `GET /api/v1/futures/ohlc` | `symbol`, `timeframe` (1m–1d), `limit` 1–50000, `debug=1` → `[{time,open,high,low,close,volume}]` | 502 `upstream_error`; may be `[]` |
| `GET /api/v1/ohlc` | Same shape, for equities (default SPY) | 502 |
| `GET /api/sectorcards-10m` | → `ok`, `version`, `sectorCards[{sector,tilt,outlook,grade,nl,up,down}]` | 200 with `ok:false, fallback:true` |
| `GET /api/v1/waves/active` | `symbol=ES` → persisted active-wave doc | 400 `UNSUPPORTED_SYMBOL`, 404 `ACTIVE_WAVE_STATE_NOT_FOUND` |
| `GET /api/v1/volume-behavior` | `symbol`, `tf`, … → `volumeRegime`, `pressureBias`, `flowSummary`, `nextConfirm`, `raw` | 500 |
| `GET /api/v1/es-volume-behavior` | `symbol`, `tf`, `limit` | 200 with `ok:false` |
| `GET /api/v1/fib-levels` | `symbol`, `tf`, `degree`, `wave` | Fallback or error; never invent values |
| `GET /api/v1/morning-fib` | `symbol`, `tf` (default 30m) | `ok:false`, `state:"NO_IMPULSE"` |
| `GET /api/v1/chart-overlay` | `symbol`, `tf` | 500 `ENGINE17_ERROR` |
| `GET /api/v1/engine25/market-health[/summary]` | Summary → `score`, `regime`, `bias`, `riskLevel`, `tradePermission`, `componentScores`, `warnings` | 503 |
| `GET /api/v1/engine25/full-dashboard` | → `engine:"engine25.fullDashboard.v0.5"`, `headline`, `componentBreakdown`, `sectorBreadth`, … | Nested schema needs validation |
| `GET /api/v1/engine25/{context,intraday-macro,es-overlay,composite-overlay-6mo,cap-universe}` | Persisted docs | 404/503 |
| `GET /api/v1/engine29/cross-market-stress[/summary]` | → `engine`, `servedAt`, `fileModifiedAt`, `data` | 503 |
| `GET /api/v1/replay/{dates,times,snapshot,events}`, `/replay/es/{times,snapshot,decision-summary}` | `date`, `time`, `strategyId` | 400/404 |
| `GET /api/v1/trade-journal[/:id \| /real-performance]` | `symbol`, `strategyId`, `status`, `accountMode` | 500/503/404 |
| Backend 2 `GET /stream/futures/agg`, `/stream/agg` | SSE. Event schema UNKNOWN; read `ohlcClient.js`. | A quiet stream ≠ a price of zero |

### Not available or not for Redline

| Endpoint | Status |
| --- | --- |
| `/api/v1/strategy-state` | Module exists but is **not mounted** ✔. Expect 404. |
| `/api/v1/reaction-quality` | **Not mounted** ✔. Use `/spy-reaction-quality` or `/reaction-score`. |
| `/api/v1/gauges` | **Doesn't exist** ✔. It's not an alias of the market meter. |
| `GET /api/v1/alerts` | No list endpoint. Only POST `/alerts/check-go`, `/check-squeeze` and `/check-micro-position` (actions). |
| `POST /api/v1/engine26/manual-hard-signal` | Protected manual signal injection ✔. Never call it from the UI. |
| `/engine25/refresh`, `/engine25/update`, `/engine29/dashboard-refresh`, `/engine29/update`, `/replay/record-go`, `/trade-journal/real-fill` | Admin and write actions. Never call from the subscriber UI. |
| `/api/trading/*` | Mounted in Core ✔ (trading router). Redline is read-only and must not use it. |

**Integration requirements:**
1. Use one server-side API client that normalizes failures without faking success.
2. Separate read routes from admin, trading and broker routes.
3. Capture sanitized real responses as fixtures before wiring each page.
4. Validate at runtime: a malformed or stale response must render as unavailable.
5. Put auth, rate limits, caching and an SSE proxy in the Redline backend.

No OpenAPI spec exists.

## 7. Rules that must never be violated

Changing any of these requires Brian's explicit approval.

1. The frontend never calculates authoritative engine decisions.
2. Only Engine 22 controls Elliott Wave structure.
3. Engine 6's final permission cannot be bypassed.
4. Redline is read-only for trading: no orders, and no turning a setup into an order.
5. Execution goes only through backend services: Engine 7 sizes, Engine 8 executes.
6. Engine 11 history is immutable.
7. Never blend different physical futures contracts.
8. History loading must never block LIVE prices.
9. Never fabricate market values. Missing stays missing: no zero prices, fake candles, fake
   confidence, or simulated alerts labelled LIVE.
10. Keep observation time separate from publication time to prevent look-ahead.
11. Warnings must show contradictions between engines.
12. SQL access is server-side only.
13. Subscribers are isolated from each other's data.
14. No credentials in source, bundles or docs.
15. Respect market-data redistribution rights; a data subscription is not a licence to resell.
16. Never silently change engine formulas or authority.
17. Keep explicit deploy and rollback points.
18. Replay and training are observation only.
19. "Ready" never means "Authorized".
20. Show freshness honestly: stale, failed and market-closed are different states.

## 8. Status and open tasks

**Done / verified:**
- Both Frye repos are accessible.
- PR #168 and #169 shipped (faster chart load, recent-candle bridge).
- PR #170 is merged.
- The Engine 11 archive and adapter are verified.
- Engine 25 full-dashboard and Engine 29 readers are registered.
- The seven-role account architecture is documented.

| Pri | Task | Status |
| --- | --- | --- |
| P0 | Confirm Render serves PR #170, and Brian accepts 1m/5m/10m LIVE behavior | UNCERTAIN |
| P0 | Confirm data redistribution rights for subscribers | UNKNOWN |
| P0 | Decide who owns the Redline backend, SQL and auth | UNCERTAIN |
| P1 | **[Claude]** Fix the Redline adapter bugs below | Open |
| P1 | Dashboard: replace fixtures with canonical data and freshness states | Live panel added; demo cards below it still fixtures |
| P1 | Charts: real candles, history, SSE, overlays | Not done |
| P1 | Strategies: real Engine 22/26/27 output and conflict warnings | Live panel added (E23/E15/E26/E6); Engine 27 not shown yet |
| P1 | General: get the scope approved | UNKNOWN |
| P1 | Capture sanitized schema fixtures for every route the four pages use | Partial |
| P1 | Decide what to do about the unmounted `strategy-state`, `reaction-quality` and `gauges` | Pending |
| P2 | Engine 25 EOD formula acceptance; Engine 27 warnings; Engine 22 scenario, label and Fib UI | UNCERTAIN |
| P2 | SQL-backed accounts, preferences, entitlements and audit logs | Not done |
| P3 | Paper trading, then live trading | Future; out of scope now |

**[Claude] Redline adapter issues found on 2026-11-03** (`backend-api.js`, `app.js`,
`live-surfaces.js`):
- **Broken ES chart call:** `app.js:89` calls `redlineApi.futuresOhlc()`, which isn't defined
  in `backend-api.js`, so the ES/MES chart path throws.
- **Wrong endpoint for equities:** `redlineApi.ohlc()` hits `/api/v1/futures/ohlc`, so they hit
  the futures endpoint. Equities need `/api/v1/ohlc`. Commit aa96c57's intent was lost.
- **Calls to routes that don't exist:**
  - `engine3` and `reactionQuality` call the unmounted `/reaction-quality`.
  - `strategyState` calls the unmounted `/strategy-state`.
  - `gauges` and `alerts` (GET) call routes that don't exist.
- **Calls the UI must not make:**
  - `engine26` sends a GET to the POST-only protected manual-hard-signal route.
  - `positions`, `orders` and `executions` call `/api/trading/*` from a signal-only frontend.
- **Legacy permission route:** `engine6` and `tradePermission` use legacy v1, but Strategies
  should use `trade-permission-v2`.
- **Misleading LIVE badge:** the engine panel in `live-surfaces.js` sets "LIVE BACKEND" (green)
  even when every request failed. This breaks rules 9 and 20.
- **Placeholder meter values shown as real:** the meter panel shows 4H and 1D scores that the
  backend marks as placeholders.
- **Unloaded script:** `live-surfaces.js` is copied by `build.mjs` but never loaded by
  `index.html`.


**[Claude] Verified against live responses on 2026-11-04:**
- **Engine 6 permission:** the authoritative value is `dashboard-snapshot` →
  `strategies[id].permission` (`engine6.finalFromEngine15.v1`). The snapshot's own
  `engine6v2` block says `authority:false`, `ignoredForES:true`, reason
  `ENGINE6_V2_STALE_USES_ENGINE5_SCORE_NOT_ENGINE15`. The `/trade-permission[-v2]` GET
  routes compute a result from caller-supplied inputs (defaults when none are sent), so
  Redline must never call them.
- **Stale route:** `/api/v1/waves/active` returned `updatedAt: 2026-09-28 08:55`, which is
  stale. Current wave context comes from the snapshot (`engine23Interpretation`,
  `engine22WaveStrategy`, `engine27Strategies`).
- **Snapshot size:** `dashboard-snapshot` is about 18 MB with or without `includeContext`.
  Redline fetches it at most once a minute and shares it across pages.
- **Fib levels:** `/api/v1/fib-levels?symbol=ES&tf=1h` returned `ok:false`, `NO_ANCHORS`.
- **Strategy IDs in the snapshot:** `intraday_scalp@10m`, `minor_swing@1h`,
  `intermediate_long@4h`, `subminute_scalp@10m`.
- **Now live in Redline:** the Dashboard panel (Market Mind, Engine 25, Engine 29, news
  risk and sector cards), the Strategies panel (structure, readiness, geometry and
  permission per strategy), the Chart engine panel, and real ES candles.

**Recommended order:**
1. Use a Redline feature branch. Demo mode stays only as a labelled fallback.
2. Build the Redline backend-for-frontend.
3. Define typed contracts and fixtures.
4. Connect pages in order: Dashboard, Charts, Strategies, then General.
5. Do security and production acceptance.

Never change Frye engines as part of this migration.

## 9. Superseded decisions (do not implement)

| Old | Replaced by | When |
| --- | --- | --- |
| Load all 2020+ history before showing the chart | Recent-first plus older-on-scroll (PR #168) | Nov 2–3, 2026 |
| Archive-only candles, waiting for LIVE to fill the gap | Bounded recent OHLC bridge (PR #169) | Nov 3, 2026 |
| History or backfill blocking LIVE | Immediate LIVE apply (PR #170) | Nov 3, 2026 (production acceptance UNCERTAIN) |
| PR #168 as rollback baseline | PR #169 | Nov 3, 2026 |
| Engine 6 v1 as the only permission API | v1 plus MarketMind v2 (both exist) | UNKNOWN |
| Raw morning Fib as the chart's main state | Engine 17 / `dashboard-snapshot` | UNKNOWN |
| Demo-generated signals in the commercial frontend | Authoritative Frye engine results | Direction set Nov 3, 2026; not built |
| Strategy role names tied to legacy journal accounts | Separate role registry; journal identity is immutable | 2026 |
| "Strategy Ready" = "Trade Allowed" | Separate structure, readiness, confirmation and permission fields | Oct 29–31, 2026 |

**Not superseded, still open:**
- **Engine 22:** which of the many V2/V3 working models is canonical.
- **Engine 25:** EOD formula versions.
- **Engine 27:** V6/V7 deployment.
- **Gauges:** `/gauges` was not renamed to market-meter; it simply doesn't exist.

## 10. Deployment and approvals

| Decision | Approver |
| --- | --- |
| Engine calculations, authority, Elliott Wave working structure | Brian Frye |
| Production chart changes | Engine 11 Manager technical GO plus Brian's approval (precedent: PR #169, #170) |
| Redline UI releases | UNKNOWN |
| SQL, auth, billing, launch | UNKNOWN; must be assigned |
| Execution and broker access | Backend controls only; sign-off matrix UNKNOWN |
| Data redistribution | UNKNOWN; legal check needed |

**Release process:**
1. Work on an isolated branch.
2. Record the base SHA, files changed and rollback target.
3. Run tests and contract checks.
4. Compare the output with Frye.
5. Get Brian's approval if engine, safety, history or LIVE behavior is touched.
6. Get the manager's GO where required.
7. Merge.
8. Confirm the deployed SHA and health, not just the merge.
9. Get the owner's acceptance.
10. Roll back fast and document what happened.

**Separation:** Claude Code changes Redline only. If Redline needs something from the Frye
backend, that becomes a separate backend request for Brian. Never edit or deploy the Frye repos
from here.

## 11. Glossary

| Term | Meaning |
| --- | --- |
| Backend 1 / Backend 2 | REST API / LIVE SSE service |
| ES / MES | E-mini / Micro E-mini S&P futures. Logical symbol → physical contract. |
| Physical contract, rollover | The actual expiring contract, and the switch between contracts |
| Engine 11 archive | Immutable ES history with provenance |
| Continuous unadjusted | Futures price view; not a vendor back-adjusted series |
| Snapshot | Persisted backend analytical state (`dashboard-snapshot`) |
| ES Master, 65/20/15 | Engine 25 composite context and permission weighting (formula UNKNOWN) |
| Working model / shadow study | Owner-approved wave scenario / non-authoritative research |
| Engine 27 warning | Cross-engine conflict display |
| LIVE / Replay / Paper | Active stream / recorded history / simulated trades |
| Account roles | INTRADAY (Micro), SUBMINUTE, MINUTE, MINOR, INTERMEDIATE, PRIMARY, RESERVE. Six trading roles plus reserve. Not automatically bound to Schwab accounts. |

## 12. Top unknowns (do not guess)

1. Is PR #170 live on Render, and has Brian accepted it?
2. What exactly is on the General page?
3. Who owns the Redline SQL, auth and hosting, and what technology?
4. Do data licences cover paid subscribers?
5. Which Engine 22 working model, Fib levels and invalidations are canonical?
6. Which Engine 25 EOD formula is accepted?
7. Which Engine 27 V6/V7 parts are deployed?
8. What are the full nested schemas, and what should happen to the unmounted routes?
9. What are the archive storage, session calendar, roll schedule and replay retention?
10. Who signs off on launch, trading activation and emergency rollback?

## Daily client sync

`frye/Frye-Dashboard` and `frye/frye-market-backend` are git-ignored clones. They are pulled
daily, and each day's changes are summarized in `docs/frye-changes/YYYY-MM-DD.md`. Use those
notes to update §2, §3, §6 and §8.
