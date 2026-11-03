Hi Brian,

Here's where the Redline integration stands, what we need from you, and how we plan to finish it.

**What's now connected to your live Frye backend**

Redline now reads directly from your backend. Every value shown is your engines' output; Redline calculates nothing itself. These views are live:

- **Dashboard:**
  - Market Mind 10m/30m/1H/4H/EOD scores
  - Engine 25 market health, risk and ES mode
  - Engine 29 cross-market stress
  - news risk
  - the 11 sector cards
- **Strategies:** for each of the four ES strategies, we show the structure (Engine 23), readiness (Engine 15), proposed geometry (Engine 26) and final permission (Engine 6). They are shown separately, so "ready" is never mistaken for "permitted".
- **Charts:**
  - live ES futures candles (contract ESZ6)
  - Engine 3 reaction
  - Engine 4 volume
  - Engine 25 and 29 context
- **Status labels:** missing or failed data shows as UNAVAILABLE, never as a made-up value. The 4H/EOD meter formulas are labelled "formula pending", as your backend describes them.

Redline is strictly read-only. It has no order buttons and never calls any trading, refresh or admin endpoint.

**What we need from you**

1. **The "General" page:** which Frye page or fields should it show? We won't build it until you confirm the list.
2. **Engine 11 history access:** server-to-server access to the 2020+ history archive for our Redline backend. The key would be stored only on our server, never in the browser.
3. **Live stream access:** confirmation that Redline may use Backend 2's live candle streams (`/stream/futures/agg`, `/stream/agg`).
4. **Data licensing:** confirmation that your Massive/Polygon (and any other) data licence allows showing real-time and historical prices to paying Redline subscribers.
5. **Field confirmations:**
   - **Active waves:** `/api/v1/waves/active` was last updated on 28 Sep. Is it retired, or should it still be updated? We currently use the wave data inside the dashboard snapshot.
   - **Engine 6:** please confirm that `strategies[id].permission` (Engine 6 from Engine 15) is the official permission. The v2 route marks itself as non-authoritative for ES.
   - **Fib levels:** `/api/v1/fib-levels` returns "NO_ANCHORS" for ES 1H. Which degree and wave should Redline request?
6. **Snapshot size (optional):** the dashboard snapshot is about 18 MB. A smaller summary endpoint would make Redline much faster for subscribers. We can send a field list if you'd like to add one.

**Do you want a SQL database for Redline? Please confirm before we build anything**

Today Redline needs no database. It only reads your backend, and any personal settings stay in each visitor's browser.

A SQL database (for example PostgreSQL) would only be needed if Redline should have any of these:
- subscriber logins and accounts
- paid subscriptions, or controlling who can see which pages
- saved preferences, watchlists or alert settings that follow a user across devices
- an audit log of who viewed or changed what

It would never store or recalculate engine decisions or market data; your Frye backend stays the single source of truth.

There's one related point. Engine 11 history and the live streams need a small Redline server even without a database, so their access keys never reach the browser.

Please tell us:
1. Does Redline need logins and subscriptions, or will it be open, or protected some other way?
2. If you want accounts: should we build the database, and where should it be hosted (Render next to your services, or elsewhere), under whose account?
3. If not: should Redline stay database-free, with only a small server for history and stream access?

**Third-party APIs**

- **Redline frontend:** needs no third-party API keys. Market data, Schwab and the other providers stay inside your backend.
- **Redline backend:** if you choose accounts and subscriptions, it would also need:
  - the database
  - an email provider for logins and notifications
  - a payment provider (for example Stripe)

If not, none of these are needed.

**Next steps**

1. Finish the Dashboard and Charts: live candle stream, older history on scroll, and wave and Fib overlays once access is confirmed.
2. Add Engine 27 intelligence and the cross-engine warnings to Strategies.
3. Build the General page once you've approved the field list.
4. Build the small Redline server for history and stream access. Add SQL, logins and entitlements only if you confirm you want them.
5. Run security and data checks, have you approve the four pages side by side with Frye, then launch.

We won't change anything in your Frye repositories. If we find something the backend needs, we'll send it to you as a separate request.

Thanks,
Muhammad
