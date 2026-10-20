# Frontend boundaries and assumptions

The app is deliberately buildless: plain HTML, CSS and JavaScript with no external runtime assets. This reduces presentation-day setup risk and allows offline use. There is no server-side business logic. The optional Node server only serves static files.

## Logical layers

| Layer | Demo implementation | Future boundary |
| --- | --- | --- |
| Market adapter | `symbols`, `quote`, `bars`, seeded fixtures | Licensed historical and streaming data adapter |
| Chart presentation | `chartSVG`, `bindChart`, indicator overlays and drawings | Chart renderer consuming normalized bars and analysis overlays |
| Market X-Ray | `xray`, sector fixtures | Context analytics with timestamps and provenance |
| Strategy/Elliott | `strategies`, `waveSVG`, `setupHTML` | Versioned structure/strategy output, not order routing |
| Signal qualification | `signalFixtures`, status and detail UI | Lifecycle service with condition evidence and deduplication |
| Notifications | `alerts`, `notify`, `simulateEvent` | Delivery and event service separate from signal generation |
| Paper execution | `validateOrder`, `reviewOrder`, `advanceMarket`, `closePosition` | Explicit user-confirmed execution service and account ledger |
| Journal | `journalModal`, `journalForm`, `exportCSV` | Durable activity/review service with execution IDs |

These are logical sections within app.js rather than separate production modules. No production analytical engine exists here. The historical FRYE handoff was unavailable; reconcile these assumptions with the actual handoff before implementation planning.

## State

Persisted under the versioned key `frye-demo-v2` in browser local storage. Stored values include the profile/preferences, watchlist, alert rules, notifications, monitoring choices, dismissed signals, paper orders, positions, closed trades, journal and scenario step. UI filters and drawings are session state. Storage failures fall back to memory.

Input text is escaped before HTML insertion. Notes render as plain text. CSV fields are quoted and potentially executable text prefixes are neutralized for spreadsheet safety. All execution remains in the browser.

## Mock market

Mock bars use a seeded pseudo-random generator per symbol/timeframe, with valid OHLC bounds and positive volume. The latest close is normalized to the shared current quote. Quotes change only on Advance market. Historical bars are illustrative and regenerated around that quote, rather than a production historical tape. Chart timestamps are illustrative labels. Confidence, wave counts, breadth, correlations and catalyst text are fixtures.

## Paper account calculation

- Starting equity: $100,000.
- Realized P&L: sum of closed paper trades.
- Open P&L: `(quote - entry) × shares` for long positions, reversed for shorts.
- Equity: starting balance + realized P&L + open P&L.
- Available buying power: starting balance + realized P&L − entry notional of open positions − limit notional of pending orders.
- Both long and short positions reserve full entry notional. No short-sale proceeds are treated as spendable cash. No leverage is provided.
- Market orders fill at the current demo quote after confirmation.
- Limit orders stay pending until Advance market evaluates a qualifying quote: buy ≤ limit; short sell ≥ limit.
- Stops and targets are checked at the new scenario quote; they fill at that quote, so a gap can pass the reference level.
- Zero fees, no partial fills, no borrow costs, no slippage, no intrabar matching.
- Separate entries remain separate positions rather than being averaged.
- Closing a position creates one journal entry using the position ID. Duplicate IDs are not inserted.
- Paper reset preserves journal reviews; full reset restores all fixtures.

Seed journal trades and the overview's illustrative model performance do not change the paper account balance. Journal metrics include all visible saved closed-trade entries, including seeds and manual entries.

## Order sequencing

On Advance market: save previous quotes → increase scenario step → evaluate pending limits → evaluate stop/target exits → evaluate price-crossing rules → save state. Setup rule tests are explicit manual simulations, not claims of actual analytical qualification.

## Important production gaps

No authentication, licensed feed, backend storage, exchange connectivity, order reconciliation, risk server, streaming event transport, notification providers or true backtesting. The mock execution assumptions are intentionally simplified. This artifact demonstrates the proposed UX, not a deployable financial service.

## Recovered client references

Ten screenshots were later recovered. The added engines.js layer provides reference-aware views, documented in CLIENT_REFERENCE_MAP.md. Engine 22 structural authority, Engine 27 read-only interpretation, Engine 26 proposal-only planning and Engine 6 final permission remain distinct. Engine 26B/8/9/10/32 are represented only to the extent visible in screenshots. No engine algorithms were recovered. references/ contains the original historical captures.
