# Prompt for the client's ChatGPT project: Strategies page

Paste everything below the line into Brian's ChatGPT project, then bring the answers back.

---

You are the engineering memory for the Frye trading platform. Redline is a new read-only,
signal-only frontend that shows Frye engine output. It never places orders and never
recomputes or overrides an engine decision. Redline now has a live Strategies page built
from these `/api/v1/dashboard-snapshot` fields:

- `engine27Strategies.engine27WorkingSevenDegrees`: the seven degrees, working alignment, market story and direction check
- `engine27Strategies.engine27TraderIntelligenceV2.degrees[*].potentialCompletion.levels`: fib levels and touch evidence
- `strategies["intraday_scalp@10m"].engine22WaveStrategy`:
  - `sevenDegreeInvalidations`
  - `higherDegreeBearishProtection`
  - `currentWavelength`
  - `engine22Display`
- `engine27Strategies.engine27LiveCrossMarketReactions` and `engine27UnifiedMarketContext`: the QQQ/VIX, Engine 25 and Engine 29 confirmation
- `strategies["intraday_scalp@10m"].engine26LocationCandidate`, `engine26ProposedGeometry` and `permission` (Engine 6)

Answer each question with the decision, the field or endpoint involved, and who approved it.
If something is not decided yet, say "not decided". Do not guess.

1. **Owner text written into the frontend.** The Frye page
   `Engine22MarketStructureCard.jsx` types owner anchor text directly into the page.
   - Examples: "A high 7810.00 — OCT 21, 11 AM AZ", "B high 7692.00 — NOV 2, 8 AM AZ",
     "W1 COMPLETE — JUL 30 12:00 → AUG 13 09:00 AZ", and the per-degree headlines.
   - Redline shows only what the backend publishes, so these rows are missing in Redline.
   - Will Engine 22 publish them (for example as display rows on
     `authorizedWorkingStructure` or `engine27WorkingSevenDegrees`)?
   - If yes, which field, and is it the canonical owner wording?
2. **Real positions and broker accounts.** The Frye Engine 27 alignment cards show
   "Real position · N open contracts · Account ••••0747".
   - Should Redline show broker positions or masked account numbers at all?
   - Who may see them (owner only, or every subscriber)?
   - Which field or endpoint is the approved source?
   - Redline leaves them out until this is answered.
3. **V3 shadow panels.** These are the "V3 SHADOW — PROVISIONAL NODE EVIDENCE /
   INSUFFICIENT HISTORY" panels (`engine22V3Shadow`, `engine22V3NodeEvidence`).
   - Should Redline show them, or are they internal research only?
4. **Invalidation for lower degrees.** Submicro through Minor show the early warning as
   "NOT SET" / `OWNER_RULE_APPROVAL_REQUIRED`.
   - When an owner rule is approved, which field carries the approved price and trigger?
   - Will it stay in `sevenDegreeInvalidations.degrees[degree].rules[]`?
5. **Engine 27 confidence.** It shows `NOT_CALIBRATED`. Is calibration planned, and where
   will it be published?
6. **Engine 29 freshness.** In `engine27UnifiedMarketContext.tactical`, Engine 29 often reads
   `fresh:false, dataDegraded:true`, while the Engine 29 page itself is current.
   - Which freshness should Redline trust on the Strategies page?
7. **Engine 26 identity.** Redline marks identity VERIFIED only when
   `engine26LocationCandidate.candidateId === engine26ProposedGeometry.candidateId`.
   - Is that the correct rule, or is there an explicit identity field?
8. **Strategy 1 and the Minor parent card.** Frye has a dedicated Minute "Strategy 1
   tactical" card and a Minor "parent correction" card (`strategy1Readiness` on the V2
   Minute degree).
   - Should Redline show Strategy 1 readiness?
   - Which fields are canonical: structural leg, Strategy 1 direction, or expected reversal?
9. **Engine 27 wave learning and performance history.** What is the source endpoint or
   field, and is it ready to show?
10. **Journal privacy.** Frye's Journal shows real Schwab trading: account masks, positions,
    contract IDs and realized/unrealized P&L. It comes from `/api/v1/trade-journal` and
    `/api/v1/trade-journal/real-performance`, which need no login.
    - May Redline show that real-account journal, given it is a public site with no login yet?
    - Or should Redline's Journal show only paper trades until login and access rules exist?
    - Who is allowed to see the real accounts?
11. **Refresh rate.** Frye polls the ~18 MB snapshot every 20 s, and Redline refreshes every
    60 s. Is there, or will there be, a lighter read-only endpoint for the Strategies page
    alone?
