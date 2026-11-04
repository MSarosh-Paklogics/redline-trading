# Call with Brian: 5 Nov 2026

Goals for the call:
- agree exactly what the SQL database is for
- collect the other decisions we're blocked on

## 1. Opening: where we are (about 2 minutes)

> "The first page is now live in the Redline design. It has everything from your Engine 25 Market X-Ray and Engine 29 pages:
> - the ES and SPY meters
> - participation and distribution
> - the 65/20/15 trade permission
> - the briefing, sectors, macro and the 6-month trend
> - the full Engine 29 market character and internals map
>
> It reads directly from your backend and the numbers match your page. Redline is read-only: no order buttons, no trading or admin calls. Every day we also check your two GitHub repos for changes, so anything you change on your side gets picked up in Redline."

## 2. SQL: what we need to agree

> "You mentioned you want this in a SQL database. We want to build exactly what you have in mind, so let's confirm what it's for."

### What we think you mean (confirm or correct)

> "Right now your backend keeps Engine 25 and 29 output as JSON files on Render. Only the latest reading exists, and files can be lost on a restart or redeploy. We think the database is for **storing every reading over time**, so that:
> - the history and trend views (what changed, the 6-month trend, distribution prior/current) come from saved data
> - Redline loads fast from small database queries instead of big files
> - subscriber traffic doesn't hit your engine backend directly
> - we can see exactly what the page showed at any moment
>
> Is that right, or did you have something else in mind?"

### Questions (write down the answers)

**What to store**
1. Only Engine 25 and Engine 29, or also other engines (22, 26, 27, 6, the market meter, strategies)? → ______
2. Every field, or only the fields shown on the page? (Our suggestion: key fields as columns, plus the full raw response kept alongside.) → ______
3. Should we store the hourly sector cards, the EOD shadow and the SPY meter too? → ______

**How often and how long**

4. How often should a reading be saved: every minute, every 10 minutes, or only when the value changes? → ______
5. How long should history be kept: 6 months, 1 year, forever? → ______
6. Should we backfill past data? The Engine 25 overlay already has about 126 days of daily history. → ______

**Who writes the data**

7. Option A: your backend writes straight into the database after each engine run.
   Option B: a small service of ours reads your API every minute and saves the readings.
   Which do you prefer? (B needs no changes on your side.) → ______
8. If A, which engine runs or jobs should write, and who builds that part? → ______

**Who reads it**

9. Should Redline read only from the database, or the database for history plus your live API for the latest values? → ______
10. Should your Frye dashboard also read from it later, or only Redline? → ______

**Database and hosting**

11. Database: PostgreSQL? Or do you already have a database we should use? → ______
12. Where to host it: Render next to your services, or elsewhere? → ______
13. Whose account, and who pays for it? → ______
14. Who holds the database credentials? (They never go in the frontend; they stay server-side only.) → ______

**Users and subscriptions**

15. Do we need subscriber logins, accounts or subscriptions **now**, or only stored market data for now? → ______
16. If later, roughly when, and should the same database hold users too? → ______

**Priority**

17. Should we build the database before or after the next pages (Charts, Strategies, General)? → ______
18. What's the deadline for the database? → ______

### Our proposal (if he asks what we recommend)

> - "PostgreSQL on Render, next to your services."
> - "A small Redline service saves Engine 25 and Engine 29 readings every minute: the key fields plus the full raw response. It doesn't touch your code."
> - "Redline reads history from the database and the latest values from your API."
> - "We add users and subscriptions later, only when you want them."

## 3. Other decisions we need

19. **Live site:** is Vercel connected to `redline-trading` or `redline-trading-performace`? Which repo is the official one? → ______
20. **General page:** which Frye page or fields should it show? → ______
21. **Engine 11 history:** can our server have read access to the 2020+ archive? → ______
22. **Live streams:** may Redline use Backend 2 `/stream/futures/agg` and `/stream/agg`? → ______
23. **Data licence:** does your Massive/Polygon licence allow showing real-time and historical prices to paying subscribers? → ______
24. **Engine 6:** is `strategies[id].permission` (Engine 6 from Engine 15) the official permission? The v2 route says it's not authoritative for ES. → ______
25. **Waves:** `/api/v1/waves/active` was last updated on 28 Sep. Is it retired? → ______
26. **Fib levels:** they return `NO_ANCHORS` for ES 1H. Which degree and wave should we request? → ______
27. **News feed:** Finlight is returning HTTP 429 (token limit used up), so event risk is unavailable. Will you fix the plan or limit? → ______
28. **Page calculations:** your X-Ray page calculates the 65/20/15 score, the SPY master, the broader-market blend and the sector counts in the browser. Could your backend publish these values, so both apps show exactly the same numbers? → ______
29. **Snapshot size:** the dashboard snapshot is about 18 MB. Could you add a smaller summary endpoint? → ______
30. **Internals map:** please send the labels you use for Engine 29 states, e.g. FORMING → "WEAKENING". → ______

## 4. Close (about 1 minute)

> "Let me read back what we agreed: …
> Next we'll … by … and send you a written summary today."

After the call:
- send Brian a written summary
- update `docs/FRYE_MASTER_HANDOFF.md`
