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
   Frye's page also hard-codes owner anchor text in the frontend; Redline shows only what the
   backend publishes. Broker accounts and real positions are deliberately not shown.
   Display only: no permission, sizing, geometry, ticket or execution is created here. */
(() => {
  const ORDER = ['submicro', 'micro', 'subminute', 'minute', 'minor', 'intermediate', 'primary'];
  const STRATEGY = 'intraday_scalp@10m';
  const REFRESH_MS = 60000;
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

  // Touch evidence wording from the backend's evidence fields (Frye: REACHED · ES SNAPSHOT / TOUCHED · VERIFIED).
  function evidence(l) {
    const st = String(l.status || '').toUpperCase();
    if (st !== 'TOUCHED') return { text: L(st || 'WATCH'), cls: 'watch' };
    if (/OWNER_CHART/.test(l.touchEvidenceType || l.touchEvidence?.evidenceClass || '')) return { text: 'TOUCHED · OWNER CHART', cls: 'reached' };
    const verified = l.touchEvidence?.verified ?? /COMPLETED/.test(l.touchEvidenceType || '');
    return verified ? { text: 'TOUCHED · VERIFIED', cls: 'verified' } : { text: 'REACHED · ES SNAPSHOT', cls: 'reached' };
  }

  /* Engine 22 owner research counts (currentWavelength.degrees[deg].owner*Research, selectionStatus
     RESEARCH_ONLY). Brian's Strategies page shows the newest of these per degree ahead of the
     canonical working count; priority order MIRRORED from Frye Engine22MarketStructureCard.jsx.
     Engine 27's canonical working count stays visible next to it. */
  const RESEARCH = {
    submicro: ['ownerSubmicroW3Nov9InternalResearch', 'ownerSubmicroW3Nov9Research', 'ownerSubmicroNov6AbcResearch'],
    micro: ['ownerMicroW3Nov9ReclassifiedResearch', 'ownerMicroW2Nov6Research'],
    subminute: ['ownerSubminuteW1FormingNov9Research', 'ownerSubminuteNov5AbcResearch'],
    minute: ['ownerMinuteW1FormingNov9Research', 'ownerMinuteAbcResearch'],
    minor: ['ownerMinorW3Nov9Research', 'ownerMinorW2Research']
  };
  function research(m, deg) {
    const cw = m.ws.currentWavelength?.degrees?.[deg] || {};
    for (const k of RESEARCH[deg] || []) { const o = cw[k]; if (o && typeof o === 'object' && o.selectionStatus === 'RESEARCH_ONLY') return { key: k, ...o }; }
    return null;
  }
  const words = k => String(k).replace(/^w(\d)/, 'W$1 ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([0-9])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase()).replace(/\s+/g, ' ').trim();
  function anchorRows(a) {
    if (!a) return '';
    return Object.entries(a).filter(([k, v]) => !/LocalTime$|AtUtc$|^provenance$|^priorAnchorRevision$|^ownerApprovalReference$/.test(k) && v != null && typeof v !== 'object').map(([k, v]) => {
      const t = a[`${k}LocalTime`] || a[`${k.replace(/(Low|High|Reference)$/, '')}LocalTime`];
      const val = typeof v === 'boolean' ? (v ? 'YES' : 'NO') : n(v) != null ? `${px(v)}${t ? ' · ' + t : ''}` : L(v);
      return kv(words(k), val, typeof v === 'boolean' ? (v ? 'up' : 'yellow') : '');
    }).join('');
  }

  function levelsFor(m, deg) {
    const rs = research(m, deg);
    if (rs) return Array.isArray(rs.levels) ? rs.levels : [];
    const v2l = m.v2?.degrees?.[deg]?.potentialCompletion?.levels;
    const wl = m.work?.degrees?.[deg]?.potentialCompletion?.levels;
    // Same fallbacks as Frye: the Engine 22 wavelength levels (e.g. Minor W5), then the display levels.
    const cl = m.ws.currentWavelength?.degrees?.[deg]?.levels;
    const dl = m.ws.engine22Display?.degrees?.[deg]?.levels;
    return [v2l, wl, cl, dl].find(a => Array.isArray(a) && a.length) || [];
  }

  // Alternative fib sets (e.g. Subminute wick vs body) published on the current working model only,
  // matched by the model version Engine 27 names as the working source.
  function altFibs(m, deg) {
    const ver = m.work?.degrees?.[deg]?.provenance?.workingModelVersion, cw = m.ws.currentWavelength?.degrees?.[deg];
    if (!ver || !cw) return [];
    const model = Object.values(cw).find(o => o && typeof o === 'object' && o.version === ver);
    const refs = model?.fibReferences;
    if (!refs || Object.keys(refs).length < 2) return [];
    return Object.entries(refs).filter(([, r]) => Array.isArray(r?.levels) && r.levels.length).map(([k, r]) => ({ key: k, title: r.title || `${L(deg)} · ${L(k)} fibs${k === 'body' ? ' (alternative)' : ''}`, levels: r.levels }));
  }

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

  function fibTable(m, deg, given) {
    const levels = (given || levelsFor(m, deg)).filter(l => n(l.price) != null);
    if (!levels.length) return '<p class="sl-muted">No working levels published for this degree.</p>';
    const rows = [...levels].sort((a, b) => b.price - a.price).map(l => ({ kind: 'level', l }));
    if (m.price != null) {
      const i = rows.findIndex(r => r.l.price < m.price);
      rows.splice(i < 0 ? rows.length : i, 0, { kind: 'price' });
    }
    return `<div class="sl-fibs">${rows.map(r => {
      if (r.kind === 'price') return `<div class="sl-fib sl-now"><span>ES NOW</span><b>${px(m.price)}</b><em>CURRENT PRICE</em></div>`;
      const ev = evidence(r.l), next = m.work?.degrees?.[deg]?.potentialCompletion?.nextLevel;
      return `<div class="sl-fib ${ev.cls}${next && (next.key === r.l.key) ? ' next' : ''}"><span>${esc(r.l.label || r.l.key || '')}</span><b>${px(r.l.price)}</b><em>${esc(ev.text)}</em></div>`;
    }).join('')}</div><p class="sl-muted">${esc(m.work?.degrees?.[deg]?.potentialCompletion?.summary || 'Working levels; a touch is not a completion.')}</p>`;
  }

  function riskCard(m, deg) {
    const d = m.work?.degrees?.[deg] || {}, rv = d.invalidation?.review || null, inv = m.inv?.degrees?.[deg] || {}, hp = m.prot?.degrees?.[deg];
    const rules = (inv.rules || []).map(r => `<li><b>${esc(L(r.scope))}</b> ${esc(L(r.status))}${r.price != null ? ` · ${px(r.price)}` : ''}</li>`).join('');
    const prot = hp ? `<div class="sl-zones"><div class="sl-zone warn"><small>EARLY WARNING</small><b>${px(hp.warningLevel)}</b><span>${esc(String(hp.timeframe || '').toUpperCase())} close below · deep risk ${px(hp.deepRiskLevel)}</span></div><div class="sl-zone ref"><small>STRUCTURAL REFERENCE</small><b>${px(hp.structuralReference)}</b><span>${esc(L(hp.structuralReferenceStatus))}</span></div></div>
      ${kv('Status', L(hp.status))}${kv('Latest completed close', `${px(hp.latestCompletedClose)} · ${az(hp.latestCompletedBarTime)}`, '')}${kv('Rule', L(hp.rule), '')}${kv('Structurally invalidated', yn(hp.structuralInvalidated))}` : '';
    const review = rv ? `<div class="sl-zones"><div class="sl-zone warn"><small>EARLY WARNING</small><b>${esc(L(d.invalidation?.status || 'NOT SET'))}</b><span>No early-warning rule approved</span></div><div class="sl-zone ref"><small>STRUCTURAL REFERENCE</small><b>${px(rv.low)}${n(rv.high) != null && rv.high !== rv.low ? ` – ${px(rv.high)}` : ''}</b><span>${esc(L(rv.kind))}</span></div></div>` : '';
    return card('Invalidation zones · wave risk / protection', `${prot || review || '<p class="sl-muted">No structural reference published for this degree.</p>'}
      ${kv('Official invalidation', d.invalidation?.price != null ? px(d.invalidation.price) : L(d.invalidation?.status || 'NOT PUBLISHED'))}
      ${kv('Readiness', L(inv.invalidationReadiness?.status))}
      ${rules ? `<ul class="sl-list">${rules}</ul>` : ''}
      <p class="sl-muted">Read only · not a trade stop or permission.</p>`, 'red');
  }

  function degreeDetail(m) {
    const deg = ui.degree, d = m.work?.degrees?.[deg] || {}, v = m.v2?.degrees?.[deg] || {}, da = d.directionAssessment || {}, pv = d.provenance || {};
    const tr = d.traderRead || v.traderRead || {};
    const rs = research(m, deg);
    const researchCard = rs ? card(`${L(deg)} · owner research count`, `
      <div class="sl-head ${tone(rs.direction)}">${esc(`${L(deg)} ${rs.activeWave || ''} ${rs.direction || ''} — ${L(rs.stage)}`)}</div>
      ${kv('Parent', `${L(rs.parentDegree)} ${L(rs.parentWave)}`, '')}
      ${rs.completedWave ? kv('Completed wave', `${rs.completedWave} · ${L(rs.completedWaveStatus)}`, '') : ''}
      ${rs.w2CompletionStatus ? kv('W2 completion', L(rs.w2CompletionStatus)) : ''}
      ${rs.w3StartStatus ? kv('W3 start', L(rs.w3StartStatus)) : ''}
      ${rs.nextWave ? kv('Next wave', `${rs.nextWave} · ${rs.nextWaveStarted ? 'STARTED' : 'NOT STARTED'}`, '') : ''}
      <div class="sl-sub">Owner anchors</div>${anchorRows(rs.anchors)}
      ${kv('Fibonacci method', L(rs.fibMethod), '')}
      ${n(rs.reviewReference) != null ? kv('Review reference', px(rs.reviewReference), 'down') : ''}
      ${rs.timestampConflictNote ? `<p class="sl-muted">Review: ${esc(L(rs.timestampConflictNote))}</p>` : ''}
      <p class="sl-muted">Research only — Engine 22 owner working interpretation. The canonical count (Engine 27 source) is shown below and is unchanged. Not a trade or permission.</p>
      ${kv('Model', rs.version || rs.key, '')}`, 'gold', chip('ENGINE 22 · RESEARCH', 'gold')) : '';
    const structure = card(`${L(deg)} · ${rs ? 'canonical working count' : 'working structure'}`, `
      <div class="sl-head ${tone(d.waveDirection)}">${esc(tr.headline || `${L(deg)} structure not published.`)}</div>
      ${kv('Active wave', d.activeWave ? `${d.activeWave} · ${L(d.waveDirection)}` : '—')}
      ${kv('Condition', L(d.currentCondition))}
      ${kv('Parent', d.parentContext ? `${L(d.parentContext.parentDegree)} ${d.parentContext.parentWave || ''}`.trim() : '—', '')}
      ${d.largerCorrection ? kv('Larger correction', L(d.largerCorrection), '') : ''}
      ${d.internalLeg ? kv('Internal leg', typeof d.internalLeg === 'string' ? L(d.internalLeg) : L(d.internalLeg.wave || d.internalLeg.label || d.internalLeg.state), '') : ''}
      ${kv('Confirmation', L(d.confirmationNeeded?.status))}
      ${d.confirmationNeeded?.note ? `<p class="sl-muted">${esc(d.confirmationNeeded.note)}</p>` : ''}
      ${(tr.rules || []).length ? `<ul class="sl-list">${tr.rules.map(r => `<li>${esc(typeof r === 'string' ? r : r.text || '')}</li>`).join('')}</ul>` : ''}
      <div class="sl-sub">Provenance</div>
      ${kv('Model', pv.workingModelVersion || '—', '')}
      ${kv('Working count', pv.workingCount ? 'OWNER WORKING COUNT' : '—', '')}
      ${kv('Confirmed', yn(pv.confirmed))}`, 'gold', chip('ENGINE 22 AUTHORITY', 'gold'));
    const direction = card('Direction check · Engine 27', `
      <div class="sl-head ${tone(da.status)}">${esc(da.status || 'UNAVAILABLE')}</div>
      ${kv('Elliott wave expects', L(da.expectedWaveDirection))}
      ${kv('Price direction', L(da.observedPriceDirection))}
      ${kv('Window', da.timeframe ? `${String(da.timeframe).toUpperCase()} · ${da.lookback ?? '—'} completed closes` : '—', '')}
      ${kv('Closes', da.previousClose != null ? `${px(da.previousClose)} → ${px(da.latestClose)}` : '—', '')}
      ${kv('Review reference', da.reviewZone ? px(da.reviewZone.low) : '—', '')}
      <p class="sl-muted">${esc(da.note || 'Directional observation only.')}</p>`, '', chip('READ ONLY'));
    const alts = rs ? [] : altFibs(m, deg);
    const rsEmpty = rs && !(rs.levels || []).length ? `<p class="sl-muted">Fibonacci pending: ${esc(L(rs.fibMethod || 'W1 and W2 anchors not published'))}. No targets are invented.</p>` : '';
    const levelCards = alts.length ? alts.map((a, i) => card(a.title, fibTable(m, deg, a.levels), i ? 'gold' : 'green', chip(i ? 'ALTERNATIVE' : 'LEVELS', i ? 'gold' : 'green'))).join('')
      : card(`${L(deg)} ${rs ? 'research ' : ''}levels`, rsEmpty || fibTable(m, deg), 'green', chip(rs ? 'RESEARCH LEVELS' : 'LEVELS', 'green'));
    return `<div class="sl-detail"><div class="sl-stack">${researchCard}${structure}</div><div class="sl-stack">${levelCards}</div><div class="sl-stack">${riskCard(m, deg)}${direction}</div></div>`;
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
    const status = `<div class="sl-status">${m ? '<span class="pill green">LIVE BACKEND</span>' : ui.failed ? '<span class="pill red">UNAVAILABLE</span>' : '<span class="pill gold">CONNECTING</span>'}<span>Symbol <b>ES</b></span><span>Refresh <b>60s</b></span><span>Fetched <b>${esc(ui.at ? az(ui.at) : '—')}</b></span><span>Backend snapshot <b>${esc(m?.s?.now ? az(m.s.now) : '—')}</b></span><span>Engine 27 built <b>${esc(m?.e27?.builtAt ? az(m.e27.builtAt) : '—')}</b></span></div>`;
    const top = head('STRATEGIES', 'Engine 22 wave degrees and Engine 27 trader intelligence in one synchronized strategy view. Structure, readiness, location and permission stay separate.', '', 'REDLINE / DECISION INTERFACE') + status;
    if (!m) return top + `<div class="ce-empty">${ui.failed ? 'The strategy snapshot is unavailable. Nothing is shown rather than demo data.' : 'Loading the live ES strategy snapshot…'}</div>`;
    const views = `<nav class="db-tabs sf-views" role="tablist" aria-label="Strategies view">${[['interface', 'Decision interface', 'E22 · E27 · E26 · E6'], ['full', 'Strategies full', 'Scalp · Swing · Longer-term']].map(([id, name, sub]) => `<button type="button" role="tab" data-sl-view="${id}" aria-selected="${ui.view === id}" class="${ui.view === id ? 'selected' : ''}"><small>${sub}</small>${name}</button>`).join('')}</nav>`;
    if (ui.view === 'full') return top + views + fullView(m);
    if (!m.work) return top + views + '<div class="ce-empty">Engine 27 working seven degrees is not published in this snapshot.</div>';
    return top + views
      + `<div class="race-section-label"><span>ENGINE 22 · SEVEN WAVE DEGREES</span><small>OWNER WORKING COUNT · STRUCTURAL DISPLAY ONLY · NO EXECUTION PERMISSION</small></div>${ladder(m)}${degreeDetail(m)}`
      + `<div class="race-section-label"><span>ENGINE 27 · TRADER INTELLIGENCE</span><small>SEVEN CURRENT OWNER WORKING INTERPRETATIONS · ENGINE 22 AUTHORITY PRESERVED</small>${chip('READ ONLY')}${chip('7 DEGREES', 'gold')}${chip('NO EXECUTION', 'red')}</div>${intelligence(m)}`
      + `<div class="race-section-label"><span>SHARED MARKET CONFIRMATION</span><small>ES · QQQ · VIX · ENGINE 25 · ENGINE 29 · CONTEXT, NOT AUTHORIZATION</small></div>${shared(m)}`
      + `<div class="race-section-label"><span>ENGINE 26 · LOCATION / PLANNER</span><small>SETUP LOCATION AND PROPOSED GEOMETRY · ENGINE 6 REMAINS FINAL PERMISSION</small></div>${planner(m)}`;
  }

  document.addEventListener('click', ev => {
    const v = ev.target.closest?.('[data-sl-view]');
    if (v) { ui.view = v.dataset.slView; if (typeof render === 'function') render(); return; }
    const b = ev.target.closest?.('[data-sl-degree]'); if (!b) return;
    ui.degree = b.dataset.slDegree;
    if (typeof render === 'function') render();
  });
  setInterval(() => { if (location.hash.startsWith('#/strategies') && !document.hidden) load(); }, REFRESH_MS);
  window.fryePages = { ...(window.fryePages || {}), strategies: page };
  window.redlineStrategies = ui;
})();
