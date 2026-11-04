# Backend request for Brian: protect the real trading journal

**Priority: high. This is a security fix needed now, whether or not Redline ever shows real trading.**

## The problem

Three read routes in `frye-market-backend/services/core/routes/tradeJournal.js` return real
Schwab trading data, and none of them asks for a login:

| Route | What it returns today, to anyone |
| --- | --- |
| `GET /api/v1/trade-journal` | All trades, including REAL, when `accountMode` is left out or set to `REAL` |
| `GET /api/v1/trade-journal/real-performance` | P&L, fees, win rate and drawdown for all seven accounts plus SWING/INTRADAY |
| `GET /api/v1/trade-journal/:tradeId` | Any single trade, including broker transaction and contract IDs |

Only `POST /trade-journal/real-fill` is protected (`requireEngine8Admin`). Backend 1 allows
requests from any website, so anyone who knows the backend URL can read real positions and
P&L from a browser today.

## What we're asking for

1. **Require sign-in on every route that can return REAL data.** That includes the three
   routes above, any older or export routes, and cached copies of the same data. The check
   has to happen on the server. Hiding a tab in a website, masking digits, or limiting which
   websites may call the backend does not stop anyone.
2. **Give each signed-in user a short-lived, read-only permission**, for example
   `journal:real:read`. It should be limited to the accounts that user is allowed to see.
   Please don't reuse the Engine 8 admin secret, and don't put any shared secret in website
   code, Vercel settings or GitHub.
3. **Keep paper data open as it is now.** Requests with `accountMode=PAPER` should keep
   returning only PAPER trades without a login, because the Redline Journal relies on that.
   Unfiltered requests should return PAPER only unless the caller is signed in.
4. **Agree the header with us.** We suggest `Authorization: Bearer <token>`. Please also
   confirm which login system issues the token.
5. **Once that's in place**, add the Redline production domain to the allowed list on
   Backend 1, for signed-in requests only.

## Decisions only Brian can make

- **Who may see real trading:** Brian only, named staff, or subscribers. This decision shapes
  the whole login design.
- **What may be shown:** whether account masks (••••1234), contract IDs and broker
  transaction IDs may appear.
- **Compliance:** whether P&L may be shown to anyone other than the account owner, and
  whether Schwab or data-licence terms apply.

## What Redline does meanwhile

- Redline reads only `GET /api/v1/trade-journal?accountMode=PAPER`, and drops any row not
  marked PAPER.
- It has no code path that requests REAL data.
- The Real Trading tab is locked. It shows a preview built on Engine 10's data format, using
  made-up sample data that is clearly labelled as such.
- When the backend requires sign-in and Brian approves the viewers, the preview switches to
  live data. No layout work will be left.
