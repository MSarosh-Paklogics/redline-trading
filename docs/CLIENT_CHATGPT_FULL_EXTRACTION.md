# Redline integration: complete specification request

*Paste everything below the line into the client's Frye ChatGPT project. If the answer is cut off, reply "continue from section X".*

---

I'm the engineer building **Redline**, the new commercial frontend for the Frye platform. Redline reads your existing backend (`frye-market-backend`, Backend 1 REST and Backend 2 SSE), mirrors the Frye dashboard pages in the Redline design, and never calculates or changes engine decisions.

**Already built and live:**
- **First page:** the Engine 25 Market X-Ray and Engine 29 page.
- **Chart page:** live candles for ES and equities, the Engine 17 status pills, and an engine read panel (Engine 22 degree display, trade context, 26A, 27, 6, stage timeline, market context, Engine 3/4, SPY acc/dist levels).
- **Strategies panel:** the four ES strategies from `dashboard-snapshot`.

I need the **complete, exact specification** for everything that's left, written so a developer can build it without guessing.

## Rules for your answer

- Label every item **CURRENT** (verified, in use), **SUPERSEDED** (replaced; say by what and when) or **UNCERTAIN** (not confirmed). Write **UNKNOWN** rather than guessing.
- Give exact **endpoint paths, query parameters and JSON field paths** (for example `strategies["intraday_scalp@10m"].engine22WaveStrategy.timelineRead.mainSections`), plus the frontend file and function that renders each item.
- **No secrets:** no API keys, tokens, Schwab or broker credentials, account numbers or subscriber data. Use placeholders like `<KEY>`.
- **No proprietary engine source code.** Describe inputs, outputs, labels and rules.
- Where the Frye frontend computes or formats something in the browser, give the exact formula, thresholds and label mapping, and say whether the backend publishes it or should.

## 1. SQL database (top priority)

Brian wants "this in a SQL database". Please specify exactly:

1. **Purpose:** history of engine readings, replay or audit, speed, protecting the backend from subscriber traffic, user accounts, or something else?
2. **What to store:** which engines and endpoints (Engine 25 full dashboard, Engine 29, market meter, hourly sectors, EOD shadow, SPY meter, strategies, Engine 22/26/27/6, others). All fields, or a list of key fields plus the raw JSON?
3. **Proposed schema:** tables, columns, types, primary keys, indexes, and the timestamp fields to keep (event time, publication time, ingestion time).
4. **Frequency:** every minute, every 10 minutes, on change, or on each engine run? Per engine, if different.
5. **Retention:** how long, and whether to backfill (for example, the ~126 days of Engine 25 overlay history).
6. **Who writes:** does the Frye backend write directly after each job, or does a separate Redline service read the API and insert? Which jobs or routes?
7. **Who reads:** Redline only, or the Frye dashboard too? Which pages read history from SQL and which read live from the API?
8. **Database and hosting:** PostgreSQL or something else, an existing database or a new one, Render or another host, whose account, who pays, who manages credentials.
9. **Users and subscriptions:** needed now or later? If later, the planned tables (users, subscriptions, entitlements, preferences, alerts, audit log).
10. **Deadline and priority** compared with the remaining pages.

## 2. Navigation and page list

The Frye/Redline shell shows: **X-Ray, Meter, Sector, Strat, Chart, Journal, Paper, Tools** (plus a "General" page that was mentioned). For each:
- the route and the Frye component file
- its purpose
- whether it's in scope for Redline now
- its build order

## 3. Chart page (complete)

1. **Chart modes:** SPY SCALP, SPY SWING, ES SCALP, ES SWING. Which `strategyId`, symbol and timeframe each mode uses, and what changes on screen.
2. **ES CHART VIEW toggle:** what "LIVE — original chart" and "RESEARCH — seven-degree ES" each show, and their data sources.
3. **Engine 17 pills** (STATE, STRUCTURE, EXECUTION, STATUS, READINESS, BIAS, WAVE, QUALITY, ALIGNMENT 10, ALIGNMENT 30): the source field for each. Also: why is `strategies["intraday_scalp@10m"].engine16` mostly null for **ES**, while GOOGL/SPY have values? Should ES be published?
4. **Degree tabs** (Submicro, Micro, Subminute, Minute, Minor, Intermediate, Primary): which data each tab shows. Is `engine22WaveStrategy.engine22Display.degrees[degree]` the canonical source?
5. **Market Context column:** the exact source of each card ("Market Meter / Tactical Context", "Engine 3 Current Level Action", "Engine 4 Current Scalp Volume"), with every field and label.
6. **Engine 22 "Current Wave Read" card:** source paths for parent structure, active parent leg, current tactical wave, internal wave, invalidation/control, next parent target, extension tables (C-a/C-b/C-c, 1.000–2.618) and Engine 22 status.
7. **Engine 26A location, Engine 27 trader intelligence, Engine 6 final permission, next action levels and the canonical stage timeline:** confirm the source paths and the meaning of each status.
8. **Indicator menu overlays:** for each, the endpoint, fields, how it's drawn (lines, zones, markers), colours and default on/off:
   - EMA 10/20/50/200 and volume
   - SMZ institutional zones and acc/dist shelves
   - Engine 17 state overlay, decision timeline, Engine 23 wave behavior read, signal markers, trigger line
   - Engine 26 trade geometry tool
   - Engine 25 composite overlay and market health timeline
   - Engine 29 cross-market stress window
   - premarket Fibs (E16)
   - Engine 2 Fib per degree (Primary → Submicro), with the scenario selectors ("Wick reference", "Option 1 — ABC Down")
9. **Smart Money Zones panel:** Frye reads a static `/data/zones.json` from the frontend. What's the backend source for live zones, and for **ES** rather than SPY? Same question for **Acc/Dist levels**: `/api/v1/smz-levels` returns SPY prices. Is there an ES version?
10. **Live candles:** the Backend 2 SSE event schema for `/stream/futures/agg` and `/stream/agg` (query parameters, event fields, time units, how the physical contract is identified, reconnect rules).
11. **History:** how the chart loads the Engine 11 2020+ archive (access method for a server, page size, versions), and what a Redline server needs to be allowed to use it.

## 4. Strategies page (complete)

- Every section, card and field on the Frye Strategies page (`RowStrategies`, `StrategiesFull`, Engine 27 Trader Intelligence V2), with source paths.
- The strategy IDs to show, and what "Setup", "Readiness" and "Permission" mean for each.
- Which Engine 6 output is authoritative. The snapshot's `strategies[id].permission` reads `engine6.finalFromEngine15.v1`, while `engine6v2` says `authority:false`, `ignoredForES:true`. Please confirm.
- Engine 27 seven-degree view, invalidations, VIX/QQQ key levels: source paths and the layout.

## 5. Meter and Sector pages

- **Market Meter page:** every tile and light, its source (ES `futures/market-meter`, SPY `/live/intraday`, `/live/30m`, `/live/hourly`, `/live/4h`, `/live/eod`, and any others), the SPY master formula (20% 1H + 35% 4H + 45% EOD?), and the status of the 4H/EOD "basic placeholder" formulas.
- **Index-Sectors page:** every column, which timeframe each comes from (10m, 1H, 4H, EOD), the classification rules (strong/neutral/weak), and the sorting.

## 6. General page

Exactly what the "General" page should contain: the Frye source (possibly `src/pages/redline/ControlsPage.jsx`), every field, every control, and which actions (if any) are allowed. Redline is read-only, with no trading actions.

## 7. Label and colour dictionaries

Give the full mapping tables used in the Frye UI:
- **Engine 29:** group states (FORMING, CONFIRMED, SEVERE, …) → internals-map labels ("WEAKENING", "STRESS BUILDING", "SEVERE STRESS", …) per group, plus the 1W/1H/30m/Now column sources.
- **Engine 29 headline labels:** for example "STRONG DOWNWARD PRESSURE", "VERY HIGH", "BROAD WEAKNESS" → the source fields and rules.
- **Engine 25 states:** state → colour/tone rules.
- **Readiness, status and permission labels:** to their display text.

## 8. Calculations done in the Frye frontend

Confirm the exact formula and thresholds for each, and whether the backend publishes it now or will:
- **65/20/15 trade permission:** 65% ES master + 20% 4H + 15% reconstructed EOD, with thresholds 65/55/50/45/35.
- **Broader market strength:** 60% breadth + 25% sector participation + 15% buy volume.
- **Sector strong/weak rule:** breadth and momentum ≥55 = strong, ≤45 = weak, from the hourly cards (fresh only if all 11 are under 90 minutes old).
- **SPY master meter:** the blend of 1H, 4H and EOD.
- Any others.

## 9. Open issues

Status and expected fix for each:
- `/api/v1/waves/active` was last updated 2026-09-28. Is it retired?
- `/api/v1/fib-levels` returns `NO_ANCHORS` for ES 1H. Which degree and wave should be requested?
- The Finlight news feed returns HTTP 429 (token limit), so Engine 25 event risk is unavailable.
- `dashboard-snapshot` is about 18 MB. Is a smaller summary endpoint planned?
- Is PR #170 confirmed on Render and accepted by Brian?
- Data redistribution licence for paying subscribers (Massive/Polygon).
- Unmounted routes (`strategy-state`, `reaction-quality`) and the missing `gauges`: restore, replace or retire?

## 10. Output format

1. One section per heading above, in order.
2. Tables wherever possible (field → source path → meaning → status).
3. At the end:
   - a **build checklist** for Redline in priority order
   - the **10 things you're least sure about**
