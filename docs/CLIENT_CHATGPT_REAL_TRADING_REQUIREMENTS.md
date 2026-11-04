# Prompt for the client's ChatGPT project: real trading in the Redline Journal

Paste everything below the line into Brian's ChatGPT project, then bring the answers back.
Redline builds nothing for real trading until these are answered.

---

You are the engineering memory for the Frye trading platform. Redline is a new read-only,
signal-only frontend for Frye. It is a public website (Vercel) with no sign-in yet.

**What Redline's Journal does today:** it shows Engine 8 paper trades from
`GET /api/v1/trade-journal?accountMode=PAPER`. The "Real trading" tab is locked.

**What Brian wants:** the Frye Journal's real-trading view in Redline. That view includes:
- the seven strategy accounts (masked numbers like ••••0747)
- open positions with contract IDs
- daily account P&L, gross and net realized, actual fees and live unrealized P&L
- 61 campaigns of history, and recent executions with broker trade IDs

Frye reads this from:
- `GET /api/v1/trade-journal` (`accountMode=REAL`)
- `GET /api/v1/trade-journal/real-performance`
- `/api/v1/futures/ohlc` for live marks

Answer each question with the decision, the field or endpoint involved, and who approved it.
If something is not decided yet, say "not decided". Do not guess.

## A. Access and security (must be answered first)

1. **Who may see real-account data?**
   - Brian only, named staff, or every Redline subscriber?
   - Is it the same for positions, P&L and account masks?
2. **Sign-in.** Redline has no login. Which identity provider should it use: the one Frye
   already uses, Auth0/Clerk/Supabase, or something else? Who creates and manages the
   accounts?
3. **The backend routes are public today.** `GET /api/v1/trade-journal` (without
   `accountMode`) and `GET /api/v1/trade-journal/real-performance` are mounted with no auth.
   Only `POST /trade-journal/real-fill` is protected (`requireEngine8Admin`).
   - Anyone with the backend URL can read real trades now, whether or not Redline shows them.
   - Will the backend protect these GET routes, for example with a signed session token or
     JWT checked on the server?
   - Which header should Redline send?
   - A password or flag in the frontend is not real protection, because the browser code is
     public.
4. **Tokens.** How does a signed-in Redline user get a short-lived, read-only token for the
   journal? Who issues it, and how long does it last? It must never be stored in the repo or
   bundled into the site.
5. **CORS.** Once the routes are protected, which origins may call them? Should Redline's
   production domain be added?
6. **Masking.** Is `••••` plus the last 4 digits approved for account numbers? Must broker
   trade IDs (e.g. `TRD-MES-schwab_real_broker-…`) and contract IDs (`…|CTR|134906824327|1`)
   also be masked or hidden?
7. **Legal and compliance.** Can real P&L be shown to anyone other than the account owner?
   Are there disclaimer, data-licence or broker (Schwab) terms that apply?

## B. Data contract

8. **Canonical source.**
   - Is `/trade-journal/real-performance` the source of truth for the nine reporting groups?
   - What is its exact response schema: section names, fields, units?
   - Is it stable to build on?
9. **Strategy accounts.** Which field maps each real account to a degree (Submicro …
   Primary)? Is there an approved account-to-strategy table, and where is it published?
10. **Units.**
    - For REAL trades, are `realizedPnL`, fees and unrealized P&L in dollars?
    - For PAPER trades they appear to be points. Please confirm both.
    - What multiplier applies (MES $5/pt, ES $50/pt), and is it published per trade?
11. **Daily account P&L.** Where does "Daily account P&L" come from: the broker account
    balance, or the sum of journal trades? Which field is it, and in which timezone does the
    day roll (Arizona)?
12. **Fees.** Are "actual fees" broker-reported per fill? Frye says closed-contract net fee
    attribution is "not yet fully verified". When will it be?
13. **Live unrealized P&L.** Frye computes it in the browser from `/futures/ohlc` marks.
    - Will the backend publish an approved mark and unrealized value instead?
    - If not, which mark is canonical (last trade, 1m close), and which contract (MESZ26)?
14. **Campaigns and contracts.** What defines a campaign and a contract ID? Is "View N
    contracts" detail in the same response?
15. **Recent executions.** Which event types should Redline show (`REAL_ENTRY_FILL`,
    `REAL_PARTIAL_EXIT`, `REAL_FINAL_EXIT`, `TRADE_CLOSED`)? Is
    `SWING`/`INTRADAY` the account label to use?
16. **Performance metrics.** Starting capital, return, drawdown, annualized return and
    profit factor show "—" in Frye.
    - Will per-strategy capital baselines and a daily equity series be published?
    - Who approves the starting capital per account?
17. **History.** Are the "legacy intraday / swing performance analytics" still needed?
    What is their source?

## C. Scope

18. **Read-only confirmation.** Redline will show real trading strictly read-only: no
    buttons, no orders, no journal edits. Confirm that is the requirement.
19. **Manual paper trading.** Frye's "Manual paper trades" page (`/manual-paper-accounts`)
    has a BUY/SELL/REDUCE/CLOSE ticket and uses an access token. Redline is signal-only, so
    it will not include a trade ticket.
    - Should Redline show manual paper accounts read-only?
    - If yes, from which endpoint?
20. **Refresh rates.** Frye polls the journal every 15 s and futures marks every 5 s. What
    rate is acceptable for Redline against the Render backend?
21. **Priority.** Which matters most for the first release: the account cards, open
    positions, P&L summary, or trade history?

## What Redline needs from the backend, at minimum

- Authenticated read-only GET routes for real journal data, with an agreed token or header.
- A documented `real-performance` schema with units.
- An approved account-to-strategy mapping and masking rule.
- Written approval of who may see real data.
