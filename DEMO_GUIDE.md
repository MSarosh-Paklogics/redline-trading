# FRYE / CEO presentation

## Before the meeting

1. Open START-DEMO.cmd or run `npm run dev` and open http://127.0.0.1:4173.
2. Use Chrome or Edge at 100% zoom. A 1440px screen shows the full terminal layout well.
3. Visit Settings → Reset entire demo if you want a clean starting state. This deletes prior local demo edits.
4. Return to Overview. Click Presentation tour for a guided seven-step walkthrough.
5. Begin with: “This is an interactive product prototype. Data, analysis and trades are simulated.”

## A 6–8 minute presentation

### 1. The overview — 45 seconds

“The desk starts with the information needed to decide where to focus: market context, leadership, watchlists and qualified setups.”

Show the performance period selector, market pulse and sector rotation. Explain that the model portfolio curve is an illustrative example separate from the interactive paper account.

### 2. The chart workspace — 60 seconds

Click Open workspace. Change from 10m to 1h. Toggle Elliott and Levels. Use the +/− controls, drag horizontally to inspect earlier bars, and hover for OHLC values. Click the horizontal-line tool, then the chart, to add a user level.

“Price presentation and analysis overlays are separate. The user can inspect the proposed structure and its invalidation.”

### 3. X-Ray and sectors — 45 seconds

Open Market X-Ray. Review alignment, breadth, leaders and correlation. Open Sectors and click a tile; change the period.

“Context helps prioritize a setup. It does not place a trade.”

### 4. The strategy library — 45 seconds

Open Strategies, then Elliott continuation. Review the structural illustration, entry and invalidation. Toggle demo monitoring if useful.

“Each playbook explains its conditions and risk structure before it becomes a signal.”

### 5. A signal becomes a decision — 60 seconds

Open Signals & Notifications. Click SPY, which is Qualified. Review the checklist and reference levels. Click Create demo alert if you want to demonstrate alert creation. Simulate event generates a clearly marked local test notification.

Return to the SPY signal and click Prepare paper order.

“A qualified signal can populate a ticket, but it never executes automatically.”

### 6. Paper execution — 60 seconds

The SPY ticket is prefilled with a reference stop and target. Use 10 shares and Market. Click Review paper order, explain the separate confirmation step, then Place paper order.

Click Advance market to move the scenario. Close the position and confirm. The paper account and closed history update.

Optional limit-order demonstration: choose Long / Limit and set SPY's limit slightly above its displayed quote. Place it, then advance the market. A qualifying quote fills it. This is a deliberately simplified scenario simulator.

### 7. The journal closes the loop — 60 seconds

Open Trade Journal. Click the new SPY entry. Edit the review, add a note and a tag, and save. Export CSV if useful.

“The product connects market discovery to a reviewable decision history.”

## Likely questions

**Is the market data live?** No. It is deterministic mock data for a repeatable presentation.

**Are these Elliott counts calculated?** No. The annotations explain the proposed analysis workflow through illustrative fixtures.

**Does the demo place real orders?** No. The execution layer only changes local browser state.

**What persists?** Local watchlists, settings, rules, notifications, journal reviews and paper account activity. Browser/profile/URL changes may use a separate storage area.

**Can we connect real services later?** The presentation separates the intended service boundaries. Production integration requires a proper data model, broker/data integrations, authentication, audit trail, testing and reconciliation with FRYE's actual handoff.

## Backup

Use screenshots/overview.png and screenshots/chart-workspace.png if you need static visuals. Keep the application local; it needs no external service during the presentation.

## Show the client engine architecture

Open Engine Room before the main tour. Start with the conflict scenario: Ready and Confirmed short can coexist with Long only, while permission remains blocked. Open Engine 22 to inspect seven degrees, Engine 27 for separate thesis/account alignment, and Engine 26 to inspect candidate identity and unavailable geometry. Switch to the aligned demonstration scenario to show how the planner changes without creating a real order. Client References opens each original capture at full resolution. Controls demonstrates the seven-account reference model, distinct from the $100,000 interactive practice ledger. Ten source screenshots are available; six reported attachments and the written handoff remain unavailable.
