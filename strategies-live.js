'use strict';
/* Live Strategies page (#/strategies), mirroring the client's Frye Strategies decision interface
   (Frye-Dashboard src/pages/rows/RowStrategies) in Redline's own UI:
   - Engine 22 seven-degree working structure: engine27Strategies.engine27WorkingSevenDegrees
     (built by the backend from engine22WaveStrategy.authorizedWorkingStructure), with fib levels
     and touch evidence from engine27TraderIntelligenceV2, invalidation readiness from
     engine22WaveStrategy.sevenDegreeInvalidations and higher-degree protection from
     engine22WaveStrategy.higherDegreeBearishProtection.
   - Engine 27 trader intelligence: working alignment, market story, per-degree direction check.
   - Shared market confirmation: QQQ / VIX zone reactions, Engine 25 participation, Engine 29 tactical.
   - Engine 26 location / proposed geometry. Engine 6 stays the final permission.
   Brian's research cards are built in his frontend from backend anchors; Redline mirrors those labels
   (version-gated, values from the backend). Broker accounts and real positions are deliberately not shown.
   Display only: no permission, sizing, geometry, ticket or execution is created here. */
(() => {
  const ORDER = ['submicro', 'micro', 'subminute', 'minute', 'minor', 'intermediate', 'primary'];
  const STRATEGY = 'intraday_scalp@10m';
  const REFRESH_MS = 20000; // Brian's Strategies page polls every 20 s (the snapshot is shared, one request per symbol)
  const ui = { view: 'interface', degree: 'minute', snap: null, at: null, loading: false, failed: false };

  const n = v => { const x = Number(v); return v == null || v === '' || !Number.isFinite(x) ? null : x; };
  const L = v => v == null || v === '' ? '—' : String(v).replace(/_/g, ' ').toUpperCase();
  const px = v => n(v) == null ? '—' : n(v).toFixed(2);
  const yn = v => v == null ? '—' : v ? 'YES' : 'NO';
  const az = t => { const d = typeof t === 'number' ? t : Date.parse(t || ''); return Number.isFinite(d) ? new Date(d).toLocaleString('en-US', { timeZone: 'America/Phoenix', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' AZ' : '—'; };
  const tone = v => /NOT.CONFIRMED|UNCONFIRMED|NOT.PUBLISHED|NOT.SET|NOT.STARTED|NOT.CALIBRATED/i.test(v || '') ? 'yellow' : /CONFLICT|DOWN|SHORT|BEAR|INVALID|BREACH|FAIL|STAND.DOWN|BLOCK|WARNING|STALE|DEGRADED/i.test(v || '') ? 'down'
    : /ALIGNED|\bUP\b|LONG|BULL|CONFIRMED|ACTIVE|SUPPORTIVE|VERIFIED|ABOVE/i.test(v || '') ? 'up'
    : /WATCH|DEVELOPING|CANDIDATE|MIXED|NEUTRAL|PENDING|WAIT|OBSERV|NOT.CALIBRATED|REACHED/i.test(v || '') ? 'yellow' : '';
  const kv = (k, v, t) => `<div class="sl-kv"><span>${esc(k)}</span><b class="${t ?? tone(v)}">${esc(v == null || v === '' ? '—' : String(v))}</b></div>`;
  const card = (title, body, accent = '', tag = '') => `<section class="sl-card ${accent}"><header><h3>${esc(title)}</h3>${tag}</header>${body}</section>`;
  const chip = (text, cls = '') => `<span class="sl-chip ${cls}">${esc(text)}</span>`;

  async function load() {
    if (ui.loading || !window.redlineApi) return;
    ui.loading = true;
    try {
      const r = await window.redlineApi.snapshotShared('ES');
      ui.snap = r?.data || null; ui.failed = !ui.snap; ui.at = Date.now();
    } catch { ui.failed = true; }
    ui.loading = false;
    if (location.hash.startsWith('#/strategies') && typeof render === 'function') render();
  }

  function model() {
    const s = ui.snap; if (!s) return null;
    const e27 = s.engine27Strategies || {}, st = s.strategies?.[STRATEGY] || {}, ws = st.engine22WaveStrategy || {};
    return {
      s, e27, st, ws,
      work: e27.engine27WorkingSevenDegrees || null,
      v2: e27.engine27TraderIntelligenceV2 || null,
      inv: ws.sevenDegreeInvalidations || null,
      prot: ws.higherDegreeBearishProtection || null,
      price: n(ws.currentPrice)
    };
  }

  /* Engine 22 owner research counts (currentWavelength.degrees[deg].owner*Research, selectionStatus
     RESEARCH_ONLY). Brian's Strategies page shows the newest of these per degree ahead of the
     canonical working count. Priority MIRRORED from Frye Engine22MarketStructureCard.jsx (Nov 16).
     Research objects the backend adds later are picked up automatically: the newest date in the
     key (e.g. "Nov16") wins, then this list's order, so Redline does not go stale between updates.
     Engine 27's canonical working count stays visible next to it. */
  const RESEARCH = {
    submicro: ['ownerSubmicroW3Nov9InternalResearch', 'ownerSubmicroW3Nov9Research', 'ownerSubmicroNov6AbcResearch'],
    micro: ['ownerMicroAbcDownNov16Research', 'ownerMicroW3Nov9ReclassifiedResearch', 'ownerMicroW2Nov6Research'],
    subminute: ['ownerSubminuteAbcDownNov16Research', 'ownerSubminuteW1FormingNov9Research', 'ownerSubminuteNov5AbcResearch'],
    minute: ['ownerMinuteW1FormingNov9Research', 'ownerMinuteAbcResearch'],
    minor: ['ownerMinorW3Nov9Research', 'ownerMinorW2Research']
  };
  /* Which published level set is CURRENT for a research card, and its title. MIRRORED from Frye
     Engine22MarketStructureCard.jsx (Nov 16). Other arrays on the same object are history and are
     never shown as current. history:true = Brian shows the set only as past observations (Submicro
     W2 ladder retired Nov 16: price went through it; new UP fibs wait for an owner-confirmed W2 low). */
  const CURRENT_FIBS = {
    ownerMicroAbcDownNov16Research: { field: 'levels', title: 'Micro C down — B high minus A length extensions (watch)' },
    ownerSubminuteAbcDownNov16Research: { field: 'levels', title: 'Subminute C down — B high minus A length Fib extensions (watch)' },
    ownerMinuteW1FormingNov9Research: { field: 'levels', title: 'Minute W2 down — W1 retracements (provisional start)' },
    ownerMinorW3Nov9Research: { field: 'levels', title: 'Minor W3 up — W2 low + W1 length Fib extensions' },
    ownerMicroW3Nov9ReclassifiedResearch: { field: 'w5UpExtensionLevels', title: 'Micro W5 up — W4 low + W1 length extensions (watch)' },
    ownerSubmicroW3Nov9InternalResearch: { field: 'w2DownRetracementLevels', title: 'Previous Submicro W2 fibs — historical observations', history: true, pending: 'New UP Fibs pending the owner-confirmed W2 low — no targets invented.' },
    ownerMicroW2Nov6Research: { field: 'levels', title: 'Micro W2 retracement Fib levels' },
    ownerSubmicroW3Nov9Research: { field: 'levels', title: 'Submicro W3 up — W2 low + W1 length Fib extensions' }
  };
  const researchLevels = rs => {
    const c = rs && CURRENT_FIBS[rs.key];
    const arr = c ? rs[c.field] : rs?.levels;
    return Array.isArray(arr) ? arr : [];
  };
  const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
  const keyDate = k => { const m = String(k).match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{1,2})/); return m ? MONTHS[m[1]] * 100 + Number(m[2]) : 0; };
  function research(m, deg) {
    const cw = m.ws.currentWavelength?.degrees?.[deg] || {}, known = RESEARCH[deg] || [];
    const found = Object.keys(cw).filter(k => /^owner.*Research$/.test(k) && cw[k] && typeof cw[k] === 'object' && cw[k].selectionStatus === 'RESEARCH_ONLY');
    if (!found.length) return null;
    const rank = k => { const i = known.indexOf(k); return i < 0 ? known.length : i; };
    found.sort((x, y) => (keyDate(y) || keyDate(cw[y].version)) - (keyDate(x) || keyDate(cw[x].version)) || rank(x) - rank(y));
    return { key: found[0], ...cw[found[0]] };
  }
  const words = k => String(k).replace(/^w(\d)/, 'W$1 ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([0-9])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase()).replace(/\s+/g, ' ').trim();
  /* ---------- Engine 22: seven-degree ladder ---------- */
  function ladder(m) {
    return `<div class="sl-ladder" role="tablist" aria-label="Wave degrees">${ORDER.map(deg => {
      const d = m.work?.degrees?.[deg] || {}, da = d.directionAssessment || {}, rs = research(m, deg);
      const canon = d.available === false ? 'UNAVAILABLE' : `${d.activeWave || '—'} ${d.waveDirection || ''}`.trim();
      const wave = rs ? `${rs.activeWave || '—'} ${rs.direction || ''}`.trim() : canon;
      return `<button type="button" role="tab" data-sl-degree="${deg}" aria-selected="${deg === ui.degree}" class="sl-rung ${deg === ui.degree ? 'selected' : ''} ${tone(rs ? rs.direction : d.waveDirection)}">
        <small>${esc(L(deg))}${rs ? ' <i class="sl-research">RESEARCH</i>' : ''}</small><strong>${esc(wave)}</strong><span>${esc(rs ? L(rs.stage) : L(d.currentCondition))}</span>${rs ? `<span class="sl-canon">E27 count: ${esc(canon)}</span>` : ''}${da.status ? `<em class="${tone(da.status)}">${esc(da.status)}</em>` : ''}</button>`;
    }).join('')}</div>`;
  }

  /* ---------- Engine 22 degree board: all seven degrees stacked, as on Brian's Strategies page ----------
     MIRRORED from Frye Engine22MarketStructureCard.jsx (pulled 2026-11-18). Brian builds the research
     cards in his frontend from backend anchors; each mirror below applies only while the backend object
     carries the same version string, otherwise Redline falls back to the raw backend fields.
     Values always come from the backend; only the labels and fixed wording are mirrored. */
  const wp = v => n(v) == null ? '—' : n(v).toFixed(2);
  const at = (p, t) => `${wp(p)}${t ? ' — ' + t : ''}`;
  const AUTH = 'RESEARCH ONLY — CANONICAL COUNT / ENGINE 27 UNCHANGED';
  const CARDS = {
    'engine22.ownerSubmicroW3Nov9InternalResearch.v1': o => { const a = o.anchors || {}, prev = Array.isArray(o.w2DownRetracementLevels) ? o.w2DownRetracementLevels : []; return {
      subtitle: 'Downside correction — waiting for owner-confirmed W2 low before a new UP wave', badge: 'DOWN WATCH', dir: 'DOWN',
      headline: 'SUBMICRO W2 DOWN — LOW NOT CONFIRMED / NEXT UP PENDING',
      rows: [['Parent', 'MICRO / SUBMINUTE C DOWN — RESEARCH'], ['W1 start low', at(a.w1StartLow, a.w1StartLocalTime)], ['W1 ending high', `${at(a.newW1High, a.newW1HighLocalTime)} — OWNER COMPLETE`], ['W1 length', `${wp(a.newW1Length)} ES POINTS`],
        ['Current', 'W2 DOWN / DEEP CORRECTION — ENDING LOW NOT CONFIRMED'], ['Previous Fibonacci', `${prev.filter(l => l.status === 'TOUCHED').length} OF ${prev.length} RETRACEMENT LEVELS OBSERVED — HISTORICAL`],
        ['Next', 'W3 UP ONLY AFTER OWNER CONFIRMS W2 LOW'], ['New UP Fibs', 'PENDING W2 LOW — NO TARGETS INVENTED'], ['History', 'OLDER W2 FIB TOUCHES, ABC COUNTS AND CORRECTIONS PRESERVED'], ['Authority', AUTH]],
      levels: [], rules: ['No owner-confirmed Submicro W2 ending low or UP reversal. Previously reached W2 supports remain in research history; new W3 Fib extensions require the confirmed W2 low. No trading permission.'] }; },
    'engine22.ownerMicroAbcDownNov16Research.v1': o => { const a = o.anchors || {}; return {
      subtitle: 'Owner-marked Micro ABC, November 15–16 — research only', badge: 'C DOWN', dir: 'DOWN',
      headline: 'MICRO A DOWN → B UP COMPLETE → C DOWN DEVELOPING / RESEARCH', fibTitle: 'MICRO C DOWN — B HIGH MINUS A LENGTH EXTENSIONS (WATCH)',
      rows: [['Parent', 'SUBMINUTE C DOWN — RESEARCH'], ['A high', at(a.aHigh, a.aHighLocalTime)], ['A low', at(a.aLow, a.aLowLocalTime)], ['B high', at(a.bHigh, a.bHighLocalTime)], ['Wave A length', `${wp(o.aLength)} ES POINTS`],
        ['Current', 'C DOWN DEVELOPING — ENDING LOW NOT CONFIRMED'], ['History', 'OLDER MICRO W5 UP AND ABC MODELS PRESERVED'], ['Fib touches', 'AMBER WATCH → GREEN WHEN ES REACHES C LEVEL AFTER B HIGH'], ['Authority', AUTH]],
      levels: o.levels || [], rules: ['C-down levels are research-only projections; touch turns green on observed post-B ES price, not completion or trading permission.'] }; },
    'engine22.ownerSubminuteAbcDownNov16Research.v1': o => { const a = o.anchors || {}; return {
      subtitle: 'Owner-marked Nov 12–15 ABC correction — research only', badge: 'C DOWN', dir: 'DOWN',
      headline: 'SUBMINUTE A DOWN → B UP COMPLETE → C DOWN DEVELOPING / RESEARCH', fibTitle: 'SUBMINUTE C DOWN — B HIGH MINUS A LENGTH FIB EXTENSIONS (WATCH)',
      rows: [['Parent', 'MINUTE W2 DOWN — RESEARCH'], ['A high', at(a.aHigh, a.aHighLocalTime)], ['A low', at(a.aLow, a.aLowLocalTime)], ['B high', at(a.bHigh, a.bHighLocalTime)], ['Wave A length', `${wp(o.aLength)} ES POINTS`],
        ['Current', 'C DOWN DEVELOPING — ENDING LOW NOT CONFIRMED'], ['History', 'OLDER SUBMINUTE W1 FORMING AND ABC RESEARCH PRESERVED'], ['Authority', AUTH]],
      levels: o.levels || [], rules: ['C-down targets are research-only WATCH levels from owner A/B anchors; no C completion, stop or trading permission.'] }; },
    'engine22.minuteW1FormingNov9Research.v1': o => { const a = o.anchors || {}; return {
      subtitle: 'Owner working interpretation — research only; not the trading count', badge: 'W2 DOWN', dir: 'DOWN',
      headline: 'MINUTE W1 OWNER-MARKED COMPLETE → W2 DOWN DEVELOPING / RESEARCH', fibTitle: 'MINUTE W2 DOWN — W1 RETRACEMENTS (PROVISIONAL START)',
      rows: [['Parent', 'MINOR W3 UP — OWNER WORKING COUNT'], ['W1 start reference', `${at(a.w1StartReference, a.w1StartReferenceLocalTime)} — PROPOSED SHARED PARENT`], ['W1 ending high', `${at(a.w1EndingHigh, a.w1EndingHighLocalTime)} — OWNER MARK`],
        ['Current', 'W2 DOWN DEVELOPING — ENDING LOW NOT CONFIRMED'], ['Internals', 'SUBMINUTE W1–W5 SEQUENCE DEVELOPING'], ['W1 completion', 'OWNER-MARKED COMPLETE — INTERNAL CHILD SEQUENCE NOT INDEPENDENTLY VALIDATED'], ['Next', 'W2 DOWN UNDER OBSERVATION'],
        ['Fibonacci', 'W2 RETRACEMENTS FROM OWNER W1 HIGH / PROPOSED START — RESEARCH'], ['Review', 'MICRO BLUE W1 LOW 15:20 AZ PRECEDES PARENT 16:00 AZ — RECONCILE'], ['History', 'OLDER MINUTE W2 / ABC C DOWN COUNTS AND TOUCHES PRESERVED'],
        ['Fib touches', 'AMBER WATCH → GREEN WHEN ES REACHES W2 LEVEL AFTER W1 HIGH'], ['Authority', 'RESEARCH CARD ONLY — ENGINE 27 / CANONICAL COUNT UNCHANGED']],
      levels: o.levels || [], rules: [] }; },
    'engine22.minorW3Nov9Research.v1': o => { const a = o.anchors || {}; return {
      subtitle: 'Owner-marked Minor W2 completion — W3 UP developing research count', badge: 'W3 UP', dir: 'UP',
      headline: 'MINOR W2 COMPLETE — W3 UP DEVELOPING / OWNER WORKING COUNT', fibTitle: 'MINOR W3 UP — W2 LOW + W1 LENGTH FIB EXTENSIONS',
      rows: [['Parent', 'INTERMEDIATE W3 UP — UNCHANGED'], ['W1 low', at(a.w1Low, a.w1LowLocalTime)], ['W1 high', at(a.w1High, a.w1HighLocalTime)], ['W1 length', `${wp(a.w1Length)} ES POINTS`],
        ['W2 complete', `${at(a.w2EndingLow, a.w2EndingLocalTime)} — OWNER MARKED`], ['Current', 'W3 UP — DEVELOPING / OWNER WORKING COUNT'], ['History', 'OLDER MINOR W5 AND W2 RETRACEMENT HISTORY PRESERVED'], ['Authority', 'OWNER-MARKED RESEARCH CARD; LIVE MINOR SELECTION UNCHANGED']],
      levels: o.levels || [], rules: [] }; }
  };

  // One degree's card state: mirrored research card, generic research card, or the backend display card.
  function degreeState(m, deg) {
    const rs = research(m, deg);
    if (rs && CARDS[rs.version]) return { research: true, ...CARDS[rs.version](rs) };
    if (rs) return { research: true, subtitle: 'Owner research count — research only', badge: `${rs.activeWave || ''} ${rs.direction || ''}`.trim(), dir: rs.direction,
      headline: `${L(deg)} ${rs.activeWave || ''} ${rs.direction || ''} — ${L(rs.stage)}`, fibTitle: CURRENT_FIBS[rs.key]?.title,
      rows: [['Parent', `${L(rs.parentDegree)} ${L(rs.parentWave)}`], ...Object.entries(rs.anchors || {}).filter(([k, v]) => !/LocalTime$|AtUtc$|^provenance$|Revision$|Reference$/.test(k) && n(v) != null).map(([k, v]) => [words(k), at(v, rs.anchors[`${k}LocalTime`])]), ['Authority', AUTH]],
      levels: researchLevels(rs), rules: [] };
    const d = m.ws.engine22Display?.degrees?.[deg];
    if (!d) return null;
    return { research: false, subtitle: d.subtitle, badge: d.badge, dir: d.direction, headline: d.headline, rows: (d.rows || []).map(r => [r.label, r.value]), levels: d.levels || [], rules: d.rules || [], v3: m.ws.engine22V3Projection?.v3LiveShadow?.shadowOnly === true ? m.ws.engine22V3Projection.v3LiveShadow.degrees?.[deg] : null };
  }

  // Level touch wording MIRRORED from Frye's level grid.
  function touch(l) {
    const st = String(l.status || ''), ty = l.touchEvidenceType;
    if ((st === 'OWNER_OBSERVED_TOUCH' || st === 'TOUCHED') && ty === 'OWNER_CHART_OBSERVATION') return ['TOUCHED · OWNER CHART', 'hit'];
    if (st === 'TOUCHED' && l.touchEvidenceAvailable === true && typeof ty === 'string') return [ty === 'ES_CURRENT_SNAPSHOT_AT_OR_ABOVE_LEVEL' || ty === 'ES_CURRENT_PRICE' ? 'REACHED · ES SNAPSHOT' : 'TOUCHED · ES PRICE', 'hit'];
    if (st === 'TOUCHED' && l.touchEvidence?.verified === true) return ['TOUCHED · VERIFIED', 'hit'];
    return ['WATCH', 'watch'];
  }
  const levelGrid = (title, levels) => `<section class="sl-lv"><header><b>${esc(title)}</b>${chip('LEVELS', 'green')}</header><div class="sl-lv-grid">${levels.filter(l => n(l.price) != null).map(l => { const [t, c] = touch(l); return `<div class="sl-lv-cell ${c}"><small>${esc(l.label || l.key || '')}</small><b>${wp(l.price)}</b><em>${t}</em></div>`; }).join('')}</div></section>`;

  // Risk strip MIRRORED from Frye Engine22WaveRiskStrip (same branches and wording).
  function riskStrip(m, deg) {
    const cw = m.ws.currentWavelength?.degrees || {}, inv = m.inv?.degrees?.[deg] || {}, readiness = inv.invalidationReadiness || null, review = readiness?.candidateZone;
    const box = (warnV, warnD, refTitle, refV, refD, evidence, status) => `<section class="sl-risk"><header><b>INVALIDATION ZONES — WAVE RISK / PROTECTION</b>${status ? `<span class="${/BULLISH/.test(status) ? 'up' : /RISK|WARNING/.test(status) ? 'down' : ''}">${esc(L(status))}</span>` : ''}</header>
      <div class="sl-risk-grid"><div class="warn"><small>EARLY WARNING</small><b>${esc(warnV)}</b><span>${esc(warnD)}</span></div><div class="ref"><small>${esc(refTitle)}</small><b>${esc(refV)}</b><span>${esc(refD)}</span></div></div>
      ${evidence ? `<p>${esc(evidence)}</p>` : ''}<p class="sl-fine">Read only • Not a trade stop or permission</p></section>`;
    if ((deg === 'micro' && cw.micro?.ownerMicroW4Down) || (deg === 'submicro' && cw.submicro?.ownerSubmicroADownInsideMicroW4)) {
      const ref = review?.reviewOnly === true && n(review.low) != null ? wp(review.low) : 'NOT SET';
      return box('NOT SET', 'No warning rule approved', 'WORKING WAVE REVIEW', ref, 'Start-high recount review only', `Above owner ${ref} start high requires wave review; not an approved invalidation`, '');
    }
    const V = (o, ver) => o && o.version === ver ? o : null;
    const minuteW1 = V(cw.minute?.ownerMinuteW1FormingNov9Research, 'engine22.minuteW1FormingNov9Research.v1'), subW1 = V(cw.subminute?.ownerSubminuteW1FormingNov9Research, 'engine22.subminuteW1FormingNov9Research.v1');
    const microNov9 = V(cw.micro?.ownerMicroW3Nov9ReclassifiedResearch, 'engine22.ownerMicroW3Nov9ReclassifiedResearch.v1'), subInt = V(cw.submicro?.ownerSubmicroW3Nov9InternalResearch, 'engine22.ownerSubmicroW3Nov9InternalResearch.v1');
    const microNov6 = V(cw.micro?.ownerMicroW2Nov6Research, 'engine22.microW2Nov6Research.v1'), subW3 = V(cw.submicro?.ownerSubmicroW3Nov9Research, 'engine22.submicroW3Nov9Research.v1'), subNov6 = V(cw.submicro?.ownerSubmicroNov6AbcResearch, 'engine22.submicroNov6AbcResearch.v1');
    const subNov5 = V(cw.subminute?.ownerSubminuteNov5AbcResearch, 'engine22.subminuteNov5AbcResearch.v1'), minuteABC = V(cw.minute?.ownerMinuteAbcResearch, 'engine22.minuteAbcDownNov5Research.v1'), ownerMinute = V(cw.minute?.ownerMinuteW2Retracement, 'engine22.minuteW2RetracementOwner.v1');
    const minorW3 = V(cw.minor?.ownerMinorW3Nov9Research, 'engine22.minorW3Nov9Research.v1'), minorRes = V(cw.minor?.ownerMinorW2Research, 'engine22.minorW2ResearchCardNov5.v1'), ownerMinor = V(cw.minor?.ownerW5StructuralReference, 'engine22.minorW5StructuralReference.v1');
    const higher = deg === 'intermediate' || deg === 'primary', minute = deg === 'minute', minor = deg === 'minor', primary = deg === 'primary', hr = m.prot?.degrees?.[deg] || null;
    const ownerBoundary = deg === 'minute' && minuteW1 ? minuteW1.reviewReference : deg === 'subminute' && subW1 ? subW1.reviewReference : deg === 'micro' && microNov9 ? microNov9.structuralReference
      : deg === 'submicro' && subInt ? subInt.structuralReference : deg === 'micro' && microNov6 ? microNov6.structuralReference : deg === 'submicro' && subW3 ? subW3.structuralReference
      : deg === 'submicro' && subNov6 ? subNov6.reviewReference : deg === 'subminute' && subNov5 ? subNov5.reviewReference : minute && minuteABC ? minuteABC.reviewReference
      : minute && ownerMinute ? ownerMinute.structuralReference : minor && minorW3 ? minorW3.structuralReference : minor && minorRes ? minorRes.reviewReference : minor && ownerMinor ? ownerMinor.price : null;
    const structural = n(ownerBoundary) > 0 ? n(ownerBoundary) : higher && n(hr?.structuralReference) > 0 ? n(hr.structuralReference) : null;
    const reviewPrice = review && n(review.low) != null && n(review.high) != null ? (review.low === review.high ? wp(review.low) : `${wp(review.low)}–${wp(review.high)}`) : null;
    const subD = deg === 'subminute' && V(cw.subminute?.ownerCurrentDUp, 'engine22.subminuteDUpOwnerWorking.v1'), microW3 = deg === 'micro' && V(cw.micro?.ownerMicroW3Up, 'engine22.microW3UpOct27Owner.v1'), subFive = deg === 'submicro' && V(cw.submicro?.ownerSubmicroFiveUp, 'engine22.submicroFiveUpOct27OwnerWatch.v1');
    const workingUp = !!(subFive || microW3 || subD), workingReview = workingUp && review?.reviewOnly === true && n(review.low) > 0 && review.low === review.high;
    const lowerC = (deg === 'submicro' && !subFive) || (deg === 'micro' && !microW3) || (deg === 'subminute' && !subD);
    const lowerB = lowerC && review && n(review.low) > 0 && review.low === review.high ? review.low : null;
    const research = (minute && minuteW1) || (deg === 'subminute' && subW1) || (deg === 'micro' && microNov9) || (deg === 'submicro' && subInt) || (deg === 'micro' && microNov6) || (deg === 'submicro' && subW3) || (deg === 'submicro' && subNov6) || (deg === 'subminute' && subNov5) || (minute && minuteABC) || (minor && minorRes);
    const status = research ? 'RESEARCH_ONLY' : higher ? (hr?.status || 'UNCONFIRMED') : structural ? 'OWNER REFERENCE' : workingReview ? 'OWNER REVIEW ONLY' : lowerB != null ? 'C DOWN RECOUNT' : 'UNCONFIRMED';
    const refText = structural != null ? wp(structural) : lowerB != null ? wp(lowerB) : workingReview ? wp(review.low) : 'NOT PUBLISHED';
    const basis = deg === 'micro' && microNov6 ? 'W1 origin • W2 research review' : deg === 'submicro' && subW3 ? 'W1 origin • W3-up research review' : deg === 'submicro' && subNov6 ? 'B high • C-down research review'
      : deg === 'subminute' && subNov5 ? 'B high • Subminute C research review' : minute && minuteABC ? 'B high • C-down recount review' : minute ? 'W1 origin • W2 count' : minor && minorW3 ? 'W2 low • W3 UP owner-count review'
      : minor && minorRes ? 'W1 origin • W2 research review' : minor ? 'W4 origin • W5 review' : higher ? (primary ? 'Primary W4 low' : 'Intermediate W2 low')
      : subFive ? 'W5 UP • W4 low review' : microW3 ? 'W3 UP • W2 low review' : subD ? 'D UP • C low review' : lowerB != null ? 'C down • B-high recount' : 'No approved hard invalidation';
    const last = hr?.latestCompletedClose;
    const evidence = higher ? (hr?.sourceFresh && n(last) != null ? `${primary ? 'Daily' : '4H'} close ${wp(last)} • 2 closes confirm • deep risk 6800` : 'Completed-candle evidence unavailable • deep risk 6800')
      : deg === 'micro' && microNov6 ? 'Below W1 origin invalidates conventional Micro W2 count; review-only, not a trade stop'
      : deg === 'submicro' && subW3 ? 'Below W1 origin requires a Submicro recount review; W3 not confirmed started; not a trade stop'
      : deg === 'submicro' && subNov6 ? 'Above B high requires Submicro C-down recount review; not an approved hard invalidation'
      : deg === 'subminute' && subNov5 ? 'Above B high requires Subminute C recount review; not confirmed invalidation or broker stop'
      : minute && minuteABC ? 'Above B high requires Minute C-down recount review • not a broker stop' : minute ? 'Below W1 origin breaches current Minute W2 count'
      : minor && minorW3 ? 'Below owner W2 ending low requires Minor W3 recount review; not a broker stop' : minor && minorRes ? 'Below W1 origin requires W2 recount review • not a broker stop' : minor ? 'Below W4 origin requires W5 recount review'
      : subFive ? 'Below owner W4 low requires Submicro W5 review • no approved invalidation' : microW3 ? 'Below owner W2 low requires W3 UP review • no approved invalidation' : subD ? 'Below owner C low requires D UP review • no approved invalidation'
      : lowerB != null ? 'Above B high requires current C-down recount • not parent invalidation' : reviewPrice ? `Recount review ${reviewPrice} • not a hard invalidation` : 'No current structural rule approved';
    return box(higher ? '7200.00' : 'NOT SET', higher ? (primary ? 'Daily close below' : '4H close below') : 'No early-warning rule approved',
      workingReview ? 'WORKING WAVE REVIEW' : lowerB != null ? 'C-DOWN INVALIDATION REVIEW' : 'STRUCTURAL REFERENCE', refText, basis, evidence, status);
  }

  function v3Box(v) {
    if (!v) return '';
    const fib = v.fibonacci?.available === true;
    return `<section class="sl-v3"><b>V3 SHADOW — ${esc(L(v.dataStatus || 'EVIDENCE_PENDING'))}</b>${kv('Wave', v.activeWave || 'UNCONFIRMED', 'yellow')}${kv('Lifecycle', L(v.lifecycle || 'EVIDENCE_PENDING'), 'yellow')}${kv('Candle', v.sourceTimeframe || '—', '')}${kv('Swing nodes', `${v.swingHighCount ?? 0} HIGH / ${v.swingLowCount ?? 0} LOW`, '')}
      ${fib ? (v.levels || []).map(fl => kv(fl.key, `${wp(fl.price)} — ${fl.ownerReportedTouch ? 'OWNER TOUCH (UNVERIFIED)' : L(fl.status)}`, fl.status === 'TOUCHED' ? 'up' : 'yellow')).join('') : `<p class="sl-warnline">${esc(v.dataStatus === 'PROVISIONAL_NODE_EVIDENCE' ? 'PIVOT EVIDENCE ONLY — VERIFIED FIB HISTORY PENDING' : v.dataStatus === 'INSUFFICIENT_HISTORY' ? 'INSUFFICIENT VALIDATED HISTORY' : L((v.fibonacci?.reasonCodes || v.reasonCodes || ['EVIDENCE_PENDING'])[0]))}</p>`}
      <p class="sl-fine">Independent V3 observation only. No approved anchor, official Fib, or trading permission changed.</p></section>`;
  }

  function board(m) {
    return `<div class="sl-board">${ORDER.map(deg => {
      const st = degreeState(m, deg);
      if (!st) return `<article class="sl-deg" id="sl-deg-${deg}"><header class="sl-deg-head"><b>${esc(L(deg))}</b></header><p class="sl-muted">Not published in this snapshot.</p></article>`;
      const dt = /DOWN|SHORT/i.test(st.dir || st.badge || '') ? 'down' : /UP|LONG/i.test(st.dir || st.badge || '') ? 'up' : 'watch';
      return `<article class="sl-deg ${dt}" id="sl-deg-${deg}">
        <div class="sl-deg-main"><header class="sl-deg-head"><div><b>${esc(L(deg))}</b><small>${esc(st.subtitle || '')}</small></div>${st.badge ? `<span class="sl-badge ${dt}">${esc(st.badge)}</span>` : ''}</header>
          <div class="sl-deg-title ${dt}">${esc(st.headline || '')}</div>
          ${st.rows.map(([k, v]) => `<div class="sl-row"><span>${esc(k)}</span><b>${esc(v == null || v === '' ? '—' : v)}</b></div>`).join('')}
          ${v3Box(st.v3)}</div>
        <div class="sl-deg-side">${st.levels.length ? levelGrid(st.fibTitle || `${L(deg)} levels`, st.levels) : ''}${riskStrip(m, deg)}
          ${st.rules.length ? `<section class="sl-rules"><b>Structural rules</b>${st.rules.map(r => `<p><span>Rule</span>${esc(typeof r === 'string' ? r : r.text || '')}</p>`).join('')}</section>` : ''}</div>
      </article>`;
    }).join('')}</div>`;
  }

  /* ---------- Engine 27: trader intelligence ---------- */
  function intelligence(m) {
    const wa = m.work?.workingAlignment || {};
    const stats = `<div class="stats sl-stats">${stat('Current wave alignment', esc(L(wa.alignmentState)), `${(wa.upDegrees || []).length} up · ${(wa.downDegrees || []).length} down`, 'across 7 degrees', 'wave', tone(wa.alignmentState) === 'down' ? 'down' : 'yellow')}${stat('Confidence', esc(L(wa.confidence)), wa.confidence === 'NOT_CALIBRATED' ? 'calibration not published' : 'published', 'Engine 27', 'shield', 'yellow')}${stat('Up degrees', esc((wa.upDegrees || []).map(L).join(' · ') || '—'), 'wave direction UP', 'Engine 22 working count', 'arrow', 'up')}${stat('Down degrees', esc((wa.downDegrees || []).map(L).join(' · ') || '—'), 'wave direction DOWN', 'Engine 22 working count', 'arrow', 'down')}</div>`;
    const story = card('Market story', `<p class="sl-story">${esc(wa.marketStory || 'No market story published.')}</p>${(wa.warnings || []).length ? `<div class="sl-warns">${wa.warnings.map(w => chip(L(w), 'red')).join('')}</div>` : ''}<p class="sl-muted">Working counts are not confirmed completions. Engine 27 interprets Engine 22 and never overrides it.</p>`);
    const rows = ORDER.map(deg => {
      const d = m.work?.degrees?.[deg] || {}, da = d.directionAssessment || {};
      return `<tr data-sl-degree="${deg}" class="${deg === ui.degree ? 'selected' : ''}"><td><b>${esc(L(deg))}</b></td><td class="${tone(da.status)}">${esc(da.status || '—')}</td><td class="${tone(d.waveDirection)}">${esc(d.activeWave ? `${d.activeWave} · ${d.waveDirection || ''}` : '—')}</td><td class="${tone(da.observedPriceDirection)}">${esc(L(da.observedPriceDirection))}</td><td>${esc(da.timeframe ? `${String(da.timeframe).toUpperCase()} · ${da.lookback ?? '—'}` : '—')}</td><td class="number">${da.reviewZone ? px(da.reviewZone.low) : '—'}</td><td>${esc(L(d.currentCondition))}</td></tr>`;
    }).join('');
    const table = card('Seven structural alignments · read only', `<div class="table-wrap"><table class="sl-table"><thead><tr><th>Degree</th><th>Alignment</th><th>Elliott wave</th><th>Price direction</th><th>Window · closes</th><th>E22 review ref</th><th>Condition</th></tr></thead><tbody>${rows}</tbody></table></div><p class="sl-muted">Review references are not approved stops or invalidations. A conflict is a directional observation, not a structural invalidation.</p>`);
    return stats + `<div class="sl-two">${story}${table}</div>`;
  }

  /* ---------- Shared market confirmation ---------- */
  function shared(m) {
    const lcr = m.e27.engine27LiveCrossMarketReactions || {}, u = m.e27.engine27UnifiedMarketContext || {}, inst = lcr.instruments || {};
    // Same wording as Frye Engine27TraderIntelligenceV2: no qualified event reads "NO NEW REACTION".
    const ev = i => { const e = (i?.events || []).at(-1); return e ? L(e.event) : i?.state === 'NO_QUALIFIED_EVENT' ? 'NO NEW REACTION' : L(i?.state || 'UNAVAILABLE'); };
    const p = u.participation || {}, t = u.tactical || {};
    return `<div class="stats sl-five">
      ${stat('QQQ · latest zone event', esc(ev(inst.QQQ)), inst.QQQ ? `${String(inst.QQQ.timeframe || '').toUpperCase()} · ${az(inst.QQQ.lastCompletedAt)}` : 'unavailable', 'completed hourly evidence', 'chart', 'yellow')}
      ${stat('VIX · latest zone event', esc(ev(inst.VIX)), inst.VIX ? `${String(inst.VIX.timeframe || '').toUpperCase()} · ${az(inst.VIX.lastCompletedAt)}` : 'unavailable', 'direct I:VIX', 'spark', 'yellow')}
      ${stat('QQQ + VIX read', esc(L(lcr.interpretation?.state)), `QQQ ${L(lcr.interpretation?.qqq)} · VIX ${L(lcr.interpretation?.vix)}`, 'context only', 'scan', 'yellow')}
      ${stat('Engine 25 · breadth', esc(L(p.state)), p.fresh ? 'fresh' : 'stale', L(p.riskLevel), 'sectors', p.fresh ? 'up' : 'down')}
      ${stat('Engine 29 · tactical', esc(L(t.overallState)), t.fresh === false || t.dataDegraded ? 'stale or degraded source' : 'fresh', `1H ${L(t.oneHour)}`, 'shield', t.fresh === false || t.dataDegraded ? 'down' : 'up')}
    </div><p class="sl-muted">${esc(lcr.interpretation?.note || 'Cross-market reactions are context, not trade authorization.')}</p>`;
  }

  /* ---------- Engine 26: location / planner ---------- */
  function planner(m) {
    const loc = m.st.engine26LocationCandidate || {}, geo = m.st.engine26ProposedGeometry || {}, e6 = m.st.permission || {};
    // Identity and fields follow Frye WaveDegreesPage.jsx (MATCH / MISMATCH / UNVERIFIED).
    const lid = String(loc.candidateId || '').trim(), gid = String(geo.candidateId || '').trim();
    const identity = lid && gid ? (lid === gid ? 'MATCH' : 'MISMATCH') : 'UNVERIFIED';
    const zone = loc.entryZone || loc.zone || loc.location || null;
    const zLo = n(zone?.low ?? zone?.lo), zHi = n(zone?.high ?? zone?.hi);
    const targets = Array.isArray(geo.proposedTargets) ? geo.proposedTargets : [];
    // The backend publishes 0 for entry/stop/risk while geometry is waiting; that is "no price", not a price.
    const geoPx = v => n(v) == null || (n(v) === 0 && geo.geometryReady !== true) ? '—' : px(v);
    return `<div class="sl-planner">
      ${card('Identity', `${kv('Location candidate', lid || '—', '')}${kv('Geometry candidate', gid || '—', '')}<div class="sl-head ${identity === 'MATCH' ? 'up' : identity === 'MISMATCH' ? 'down' : 'yellow'}">ENGINE 26 IDENTITY — ${identity}</div><p class="sl-muted">${identity === 'MATCH' ? 'Location candidate and proposed geometry share the same candidate ID.' : identity === 'MISMATCH' ? 'Location and geometry refer to different candidates.' : 'One or both candidate IDs are unavailable, so identity cannot be confirmed.'}</p>`)}
      ${card('Location · Engine 26A', `${kv('Status', L(loc.status || 'WAITING'))}${kv('Setup class', L(loc.setupClass))}${kv('Direction', L(loc.currentObservationDirection || loc.direction || 'NEUTRAL'))}${kv('Entry / alarm zone', zLo != null && zHi != null ? `${px(zLo)}–${px(zHi)}` : '—', '')}${kv('Setup grade', loc.setupGrade || '—', '')}${kv('Zone', loc.zoneId || '—', '')}${kv('Contact', L(loc.contactState))}${kv('Prior rotation', loc.priorRotationDirection ? `${L(loc.priorRotationDirection)} · ${L(loc.priorRotationCompletionState)}` : '—', '')}`, 'gold', chip('PROPOSES LOCATION ONLY', 'gold'))}
      ${card('Proposed geometry · Engine 26B', `${kv('Lifecycle', L(geo.lifecycleStatus || geo.status || 'WAITING'))}${kv('Direction', L(geo.direction || 'NEUTRAL'))}${kv('Entry', geoPx(geo.proposedEntryPrice), '')}${kv('Stop', geoPx(geo.proposedStopPrice), 'down')}${kv('Risk distance', geoPx(geo.proposedStopDistancePoints) === '—' ? '—' : `${geoPx(geo.proposedStopDistancePoints)} pts`, '')}${kv('Geometry ready', yn(geo.geometryReady))}${kv('Proposal only', 'YES', '')}<div class="sl-sub">${identity === 'MISMATCH' ? 'Target map — geometry only' : 'Target map'}</div>${targets.length ? targets.slice(0, 4).map((t, i) => kv(t.label || `Target ${i + 1}`, px(t.price ?? t.level ?? t), 'up')).join('') : '<p class="sl-muted">No proposed targets attached yet.</p>'}`, '', chip('PROPOSAL ONLY'))}
      ${card('Final permission · Engine 6', `<div class="sl-head ${tone(e6.permission)}">${esc(L(e6.permission))}</div>${kv('Executable', yn(e6.executable))}${kv('Watch only', yn(e6.watchOnly))}${kv('Size multiplier', e6.sizeMultiplier == null ? '—' : `×${e6.sizeMultiplier}`, '')}${kv('As of', e6.asOf || '—', '')}<p class="sl-muted">Engine 6 is the only trade permission. A ready location or geometry is not authorization. Redline creates no orders.</p>`, 'red', chip('FINAL AUTHORITY', 'red'))}
    </div>`;
  }

  /* ---------- Strategies Full: Scalp 10m / Intermediate Swing 1h / Longer-Term 4h ----------
     MIRRORED from Frye src/pages/StrategiesFull.jsx (same field priority, trigger-condition and
     summary wording). Two Frye display bugs are not copied: an object "Context" printed as
     [object Object] shows its state instead, and missing signal/current prices show "—", not 0.00. */
  const FULL = [
    { id: 'intraday_scalp@10m', title: 'Scalp', tf: '10m', kind: 'scalp' },
    { id: 'minor_swing@1h', title: 'Intermediate Swing', tf: '1h', kind: 'intermediate' },
    { id: 'intermediate_long@4h', title: 'Longer-Term', tf: '4h', kind: 'longer' }
  ];
  const U = v => String(v ?? '').trim().toUpperCase();
  const P = v => { if (v && typeof v === 'object') v = v.state || v.label || v.context || v.direction || v.phase1Uses || null; const s = U(v); return s ? s.replace(/_/g, ' ') : '—'; };
  const fx = {
    readiness: nd => nd?.engine15?.readiness || nd?.engine15Decision?.readinessLabel || nd?.engine16?.readinessLabel || 'WAIT',
    action: nd => nd?.engine15Decision?.action || 'NO_ACTION',
    bias: nd => {
      const e15 = nd?.engine15Decision || {}, e16 = nd?.engine16 || {};
      for (const s of [U(e15.direction), U(e15.executionBias), U(e16.waveContext?.macroBias || e16.macroBias)]) { if (s.includes('SHORT')) return 'SHORT BIAS'; if (s.includes('LONG')) return 'LONG BIAS'; }
      return e16.waveShortPrep === true ? 'SHORT BIAS' : e16.waveLongPrep === true ? 'LONG BIAS' : 'NEUTRAL';
    },
    execBias: nd => nd?.engine15Decision?.executionBias || nd?.engine15Decision?.direction || nd?.engine16?.macroBias || 'NONE',
    lifecycle: nd => { const lc = nd?.engine15Decision?.lifecycle || {}; return { tp1: lc.tp1Open === true, tp2: lc.tp2Open === true, runner: lc.runnerOn === true, signal: n(lc.signalPrice), current: n(lc.currentPrice), progress: n(lc.progressPct), remain: n(lc.remainingPct), move: n(lc.movePts), state: lc.state || nd?.engine15Decision?.lifecycleState || nd?.engine15?.readiness || 'WATCH', next: lc.nextFocus || 'WAIT_FOR_TRIGGER' }; },
    reasons: nd => [...new Set([...(nd?.engine15Decision?.blockers || []), ...(nd?.engine15Decision?.reasonCodes || []), ...(nd?.permission?.reasonCodes || [])].map(x => String(x || '').trim()).filter(Boolean))].slice(0, 10),
    chain: nd => { const v = nd?.engine15Decision?.setupChain; return Array.isArray(v) ? v.filter(Boolean) : typeof v === 'string' && v.trim() ? [v.trim()] : []; },
    waveCodes: nd => Array.isArray(nd?.engine16?.waveReasonCodes) ? nd.engine16.waveReasonCodes.filter(Boolean) : []
  };
  const marketLine = s => `${U(s?.marketRegime?.regime) || '—'} / ${U(s?.marketRegime?.directionBias) || '—'} / ${U(s?.marketRegime?.strictness) || '—'}`;
  const scalpTrigger = e => e.waveShortPrep === true && e.continuationTriggerShort !== true && e.exhaustionTriggerShort !== true ? 'rejection + break'
    : e.waveLongPrep === true && e.continuationTriggerLong !== true && e.exhaustionTriggerLong !== true ? 'support hold + break'
    : e.exhaustionEarlyShort === true || e.exhaustionEarlyLong === true ? 'exhaustion confirm'
    : e.continuationWatchShort === true || e.continuationWatchLong === true ? 'continuation trigger' : 'await trigger';
  const interTrigger = (e, r) => e.wavePrep === true && U(e.intermediatePhase) === 'IN_C' ? 'C exhaustion + W3 trigger' : U(r) === 'WAIT' ? 'wait for structure' : 'await confirmation';
  const waveMode = e => { const w = U(e.intermediateWaveMode || e.waveState || e.waveContext?.waveState); return w.includes('CORRECTION') || w.includes('C') ? 'CORRECTIVE' : w.includes('IMPULSE') || w.includes('W3') ? 'IMPULSE' : 'STRUCTURE'; };
  const summaryText = (kind, nd, s) => { const r = P(fx.readiness(nd)).toLowerCase(), nx = P(fx.lifecycle(nd).next).toLowerCase(), mk = marketLine(s).toLowerCase(); return kind === 'scalp' ? `Scalp is ${r} with ${fx.bias(nd).toLowerCase()}. Focus is ${nx}. Market: ${mk}.` : kind === 'intermediate' ? `Intermediate is ${r}. Waiting for ${nx}. Market: ${mk}.` : `Longer-term is ${r}. Next focus is ${nx}. Market: ${mk}.`; };
  const fTone = v => { const s = U(v); return /READY|TRIGGERED|CONFIRMED|ENTER_OK|^GO$|ALLOW|LONG/.test(s) ? 'up' : /BLOCK|STAND.DOWN|SHORT/.test(s) ? 'down' : /ARMING|PREP|REDUCE|WATCH|WAIT|NEUTRAL/.test(s) ? 'yellow' : ''; };
  const badge = (t, tone = fTone(t)) => `<span class="sf-badge ${tone}">${esc(t)}</span>`;
  const yesNo = v => badge(v ? 'YES' : 'NO', v ? 'up' : '');
  const list = arr => arr.length ? `<ul class="sl-list">${arr.map(x => `<li>${esc(P(x))}</li>`).join('')}</ul>` : '<p class="sl-muted">—</p>';
  const sec = (title, body) => `<div class="sf-sec"><div class="sl-sub">${esc(title)}</div>${body}</div>`;

  function fullCard(def, s) {
    const nd = s?.strategies?.[def.id];
    if (!nd) return card(`${def.title} · ${def.tf}`, '<p class="sl-muted">This strategy is not published in the snapshot.</p>');
    const e16 = nd.engine16 || {}, e15 = nd.engine15Decision || {}, lc = fx.lifecycle(nd), readiness = fx.readiness(nd), bias = fx.bias(nd);
    const head = `<div class="sf-head"><div><h3>${esc(def.title)}</h3><small>${esc(def.tf)}</small></div><div class="sf-badges">${badge(U(readiness))}${badge(U(fx.action(nd)))}${badge(bias)}</div></div>
      ${sec('Decision truth', kv('Next focus', P(lc.next), ''))}`;
    const summary = sec('Summary', `${kv('Market', marketLine(s), '')}<p class="sl-story">${esc(summaryText(def.kind, nd, s))}</p>`);
    if (def.kind === 'longer') return `<section class="sl-card sf-card ${fTone(readiness)}">${head}${sec('Passive view', `${kv('Next focus', P(lc.next), '')}${kv('Market', marketLine(s), '')}<p class="sl-story">${esc(summaryText(def.kind, nd, s))}</p>`)}</section>`;
    const position = sec('Position status', `<div class="sf-grid4">${kv('TP1', lc.tp1 ? 'OPEN' : 'OFF')}${kv('TP2', lc.tp2 ? 'OPEN' : 'OFF')}${kv('Runner', lc.runner ? 'ON' : 'OFF')}${kv('State', P(lc.state))}${kv('Signal', px(lc.signal), '')}${kv('Current', px(lc.current), '')}${kv('Remain', lc.remain == null ? '—' : `${Math.round(lc.remain)}%`, '')}${kv('Progress', lc.progress == null ? '—' : `${Math.round(lc.progress)}%`, '')}${kv('Move', px(lc.move), '')}</div>`);
    const core = def.kind === 'scalp'
      ? sec('Structure core', `<div class="sf-grid2">${kv('Context', P(e16.context))}${kv('State', P(e16.state))}${kv('Wave state', P(e16.waveContext?.waveState || e16.waveState))}${kv('Macro bias', P(e16.waveContext?.macroBias || e16.macroBias || 'NONE'))}</div>`)
      : sec('Structure core', `<div class="sf-grid2">${kv('Primary phase', P(e16.primaryPhase))}${kv('Intermed. phase', P(e16.intermediatePhase))}${kv('Wave state', P(e16.waveState))}${kv('Macro bias', P(e16.macroBias || 'NONE'))}</div>`);
    const decision = sec('Decision', `${kv('Next focus', P(lc.next), '')}<div class="sl-kv"><span>Fresh entry</span>${yesNo(e15.freshEntryNow === true)}</div>${kv('Exec bias', P(fx.execBias(nd)))}<div class="sl-kv"><span>Permission</span>${badge(U(nd.permission?.permission) || 'UNKNOWN')}</div>`);
    const quality = sec('Quality', `${kv('Band', P(e15.qualityBand))}${kv('Score', n(e15.qualityScore) == null ? '—' : String(e15.qualityScore), '')}<div class="sl-kv"><span>Grade</span>${badge(U(e15.qualityGrade) || '—', '')}</div>`);
    const side = def.kind === 'scalp'
      ? sec('Trigger path', `${kv('Trigger cond.', P(scalpTrigger(e16)))}<div class="sf-sides"><div><b class="down">SHORT</b>${[['Wave prep', e16.waveShortPrep], ['Cont. watch', e16.continuationWatchShort], ['Cont. trigger', e16.continuationTriggerShort], ['Exhaust. early', e16.exhaustionEarlyShort], ['Exhaust. trigger', e16.exhaustionTriggerShort]].map(([k, v]) => `<div class="sl-kv"><span>${k}</span>${yesNo(v === true)}</div>`).join('')}</div><div><b class="up">LONG</b>${[['Wave prep', e16.waveLongPrep], ['Cont. watch', e16.continuationWatchLong], ['Cont. trigger', e16.continuationTriggerLong], ['Exhaust. early', e16.exhaustionEarlyLong], ['Exhaust. trigger', e16.exhaustionTriggerLong]].map(([k, v]) => `<div class="sl-kv"><span>${k}</span>${yesNo(v === true)}</div>`).join('')}</div></div>${e16.waveCountertrendCaution != null ? `<div class="sl-kv"><span>Countertrend</span>${badge(e16.waveCountertrendCaution ? 'CAUTION' : 'CLEAR', e16.waveCountertrendCaution ? 'yellow' : 'up')}</div>` : ''}`)
      : sec('Structure status', `<div class="sl-kv"><span>Wave prep</span>${yesNo(e16.wavePrep === true)}</div>${kv('Corr. dir.', P(e16.correctionDirection))}${kv('Wave mode', P(e16.intermediateWaveMode || waveMode(e16)))}${kv('Exec engine', e16.skipped === true ? 'STRUCTURE MODE' : 'ACTIVE')}${kv('Trigger cond.', P(interTrigger(e16, readiness)))}`);
    const why = sec('Why / trust', `<div class="sl-sub">Not ready because</div>${list(fx.reasons(nd))}<div class="sl-sub">Setup chain</div>${list(fx.chain(nd))}${def.kind === 'scalp' ? `<div class="sl-sub">Wave reason codes</div>${list(fx.waveCodes(nd))}` : ''}`);
    return `<section class="sl-card sf-card ${fTone(readiness)}">${head}${position}${core}<div class="sf-two">${`<div>${decision}${quality}</div>`}<div>${side}</div></div><div class="sf-two"><div>${why}</div><div>${summary}</div></div></section>`;
  }

  function fullView(m) {
    const s = m.s;
    return `<div class="sl-status sf-status"><span>Market <b>${esc(marketLine(s))}</b></span><span>Backend snapshot <b>${esc(s?.now ? az(s.now) : '—')}</b></span><span class="sl-muted">Deeper strategy analysis: structure, trigger path and why/trust. Read only — readiness is not permission; Engine 6 decides.</span></div>
      <div class="sf-cards">${FULL.map(d => fullCard(d, s)).join('')}</div>`;
  }

  function page() {
    if (!ui.snap && !ui.loading) setTimeout(load, 0);
    const m = model();
    const status = `<div class="sl-status">${m ? '<span class="pill green">LIVE BACKEND</span>' : ui.failed ? '<span class="pill red">UNAVAILABLE</span>' : '<span class="pill gold">CONNECTING</span>'}<span>Symbol <b>ES</b></span><span>Refresh <b>20s</b></span><span>Fetched <b>${esc(ui.at ? az(ui.at) : '—')}</b></span><span>Backend snapshot <b>${esc(m?.s?.now ? az(m.s.now) : '—')}</b></span><span>Engine 27 built <b>${esc(m?.e27?.builtAt ? az(m.e27.builtAt) : '—')}</b></span></div>`;
    const top = head('STRATEGIES', 'Engine 22 wave degrees and Engine 27 trader intelligence in one synchronized strategy view. Structure, readiness, location and permission stay separate.', '', 'REDLINE / DECISION INTERFACE') + status;
    if (!m) return top + `<div class="ce-empty">${ui.failed ? 'The strategy snapshot is unavailable. Nothing is shown rather than demo data.' : 'Loading the live ES strategy snapshot…'}</div>`;
    const views = `<nav class="db-tabs sf-views" role="tablist" aria-label="Strategies view">${[['interface', 'Decision interface', 'E22 · E27 · E26 · E6'], ['full', 'Strategies full', 'Scalp · Swing · Longer-term']].map(([id, name, sub]) => `<button type="button" role="tab" data-sl-view="${id}" aria-selected="${ui.view === id}" class="${ui.view === id ? 'selected' : ''}"><small>${sub}</small>${name}</button>`).join('')}</nav>`;
    if (ui.view === 'full') return top + views + fullView(m);
    if (!m.work) return top + views + '<div class="ce-empty">Engine 27 working seven degrees is not published in this snapshot.</div>';
    return top + views
      + `<div class="race-section-label"><span>ENGINE 22 · SEVEN WAVE DEGREES</span><small>OWNER WORKING COUNT · STRUCTURAL DISPLAY ONLY · NO EXECUTION PERMISSION</small></div>${ladder(m)}${board(m)}`
      + `<div class="race-section-label"><span>ENGINE 27 · TRADER INTELLIGENCE</span><small>SEVEN CURRENT OWNER WORKING INTERPRETATIONS · ENGINE 22 AUTHORITY PRESERVED</small>${chip('READ ONLY')}${chip('7 DEGREES', 'gold')}${chip('NO EXECUTION', 'red')}</div>${intelligence(m)}`
      + `<div class="race-section-label"><span>SHARED MARKET CONFIRMATION</span><small>ES · QQQ · VIX · ENGINE 25 · ENGINE 29 · CONTEXT, NOT AUTHORIZATION</small></div>${shared(m)}`
      + `<div class="race-section-label"><span>ENGINE 26 · LOCATION / PLANNER</span><small>SETUP LOCATION AND PROPOSED GEOMETRY · ENGINE 6 REMAINS FINAL PERMISSION</small></div>${planner(m)}`;
  }

  document.addEventListener('click', ev => {
    const v = ev.target.closest?.('[data-sl-view]');
    if (v) { ui.view = v.dataset.slView; if (typeof render === 'function') render(); return; }
    const b = ev.target.closest?.('[data-sl-degree]'); if (!b) return;
    ui.degree = b.dataset.slDegree;
    // All seven degrees are on the page (as on Brian's); the ladder jumps to the chosen one.
    const el = document.getElementById(`sl-deg-${ui.degree}`);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); document.querySelectorAll('[data-sl-degree].selected').forEach(x => x.classList.remove('selected')); b.classList.add('selected'); }
    else if (typeof render === 'function') render();
  });
  setInterval(() => { if (location.hash.startsWith('#/strategies') && !document.hidden) load(); }, REFRESH_MS);
  window.fryePages = { ...(window.fryePages || {}), strategies: page };
  window.redlineStrategies = ui;
})();
