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
  const ui = { degree: 'minute', snap: null, at: null, loading: false, failed: false };

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

  function levelsFor(m, deg) {
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
      const d = m.work?.degrees?.[deg] || {}, da = d.directionAssessment || {};
      const wave = d.available === false ? 'UNAVAILABLE' : `${d.activeWave || '—'} ${d.waveDirection || ''}`.trim();
      return `<button type="button" role="tab" data-sl-degree="${deg}" aria-selected="${deg === ui.degree}" class="sl-rung ${deg === ui.degree ? 'selected' : ''} ${tone(d.waveDirection)}">
        <small>${esc(L(deg))}</small><strong>${esc(wave)}</strong><span>${esc(L(d.currentCondition))}</span>${da.status ? `<em class="${tone(da.status)}">${esc(da.status)}</em>` : ''}</button>`;
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
    const structure = card(`${L(deg)} · working structure`, `
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
    const alts = altFibs(m, deg);
    const levelCards = alts.length ? alts.map((a, i) => card(a.title, fibTable(m, deg, a.levels), i ? 'gold' : 'green', chip(i ? 'ALTERNATIVE' : 'LEVELS', i ? 'gold' : 'green'))).join('') : card(`${L(deg)} levels`, fibTable(m, deg), 'green', chip('LEVELS', 'green'));
    return `<div class="sl-detail">${structure}<div class="sl-stack">${levelCards}</div><div class="sl-stack">${riskCard(m, deg)}${direction}</div></div>`;
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
    const ev = i => { const e = (i?.events || []).at(-1); return e ? L(e.event) : L(i?.state || 'UNAVAILABLE'); };
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
    const same = loc.candidateId && geo.candidateId && loc.candidateId === geo.candidateId;
    const zone = loc.activeZone || loc.zone || loc.promotedZone || null;
    const targets = Array.isArray(geo.targets) ? geo.targets : Array.isArray(geo.targetMap) ? geo.targetMap : [];
    return `<div class="sl-planner">
      ${card('Identity', `${kv('Location candidate', loc.candidateId || '—', '')}${kv('Geometry candidate', geo.candidateId || '—', '')}<div class="sl-head ${same ? 'up' : 'yellow'}">${same ? 'IDENTITY VERIFIED' : 'IDENTITY UNVERIFIED'}</div><p class="sl-muted">${same ? 'Location and geometry refer to the same candidate.' : 'One or both candidate IDs are unavailable or differ, so identity cannot be confirmed.'}</p>`)}
      ${card('Location · Engine 26A', `${kv('Status', L(loc.status || 'WAITING'))}${kv('Active', yn(loc.active))}${kv('Zone', loc.zoneId || '—', '')}${zone && n(zone.low) != null ? kv('Zone range', `${px(zone.low)} – ${px(zone.high)}`, '') : ''}${kv('Direction', L(loc.preferredDirection || loc.directionBias || 'NEUTRAL'))}${kv('Contact', L(loc.contactState))}${kv('Prior rotation', loc.priorRotationDirection ? `${L(loc.priorRotationDirection)} · ${L(loc.priorRotationCompletionState)}` : '—', '')}${kv('Completion boundary', px(loc.completionBoundary), '')}`, 'gold', chip('PROPOSES LOCATION ONLY', 'gold'))}
      ${card('Proposed geometry · Engine 26B', `${kv('Status', L(geo.status || 'WAITING'))}${kv('Direction', L(geo.direction || 'NEUTRAL'))}${kv('Entry', px(geo.entry ?? geo.entryPrice), '')}${kv('Stop', px(geo.stop ?? geo.stopPrice), '')}${kv('Risk distance', px(geo.riskDistance ?? geo.risk), '')}${kv('Geometry ready', yn(geo.geometryReady))}${kv('Proposal only', 'YES', '')}<div class="sl-sub">Target map</div>${targets.length ? targets.slice(0, 6).map((t, i) => kv(t.label || `T${i + 1}`, px(t.price ?? t.level ?? t.midline), '')).join('') : '<p class="sl-muted">No proposed targets attached yet.</p>'}`, '', chip('PROPOSAL ONLY'))}
      ${card('Final permission · Engine 6', `<div class="sl-head ${tone(e6.permission)}">${esc(L(e6.permission))}</div>${kv('Executable', yn(e6.executable))}${kv('Watch only', yn(e6.watchOnly))}${kv('Size multiplier', e6.sizeMultiplier == null ? '—' : `×${e6.sizeMultiplier}`, '')}${kv('As of', e6.asOf || '—', '')}<p class="sl-muted">Engine 6 is the only trade permission. A ready location or geometry is not authorization. Redline creates no orders.</p>`, 'red', chip('FINAL AUTHORITY', 'red'))}
    </div>`;
  }

  function page() {
    if (!ui.snap && !ui.loading) setTimeout(load, 0);
    const m = model();
    const status = `<div class="sl-status">${m ? '<span class="pill green">LIVE BACKEND</span>' : ui.failed ? '<span class="pill red">UNAVAILABLE</span>' : '<span class="pill gold">CONNECTING</span>'}<span>Symbol <b>ES</b></span><span>Refresh <b>60s</b></span><span>Fetched <b>${esc(ui.at ? az(ui.at) : '—')}</b></span><span>Backend snapshot <b>${esc(m?.s?.now ? az(m.s.now) : '—')}</b></span><span>Engine 27 built <b>${esc(m?.e27?.builtAt ? az(m.e27.builtAt) : '—')}</b></span></div>`;
    const top = head('STRATEGIES', 'Engine 22 wave degrees and Engine 27 trader intelligence in one synchronized strategy view. Structure, readiness, location and permission stay separate.', '', 'REDLINE / DECISION INTERFACE') + status;
    if (!m) return top + `<div class="ce-empty">${ui.failed ? 'The strategy snapshot is unavailable. Nothing is shown rather than demo data.' : 'Loading the live ES strategy snapshot…'}</div>`;
    if (!m.work) return top + '<div class="ce-empty">Engine 27 working seven degrees is not published in this snapshot.</div>';
    return top
      + `<div class="race-section-label"><span>ENGINE 22 · SEVEN WAVE DEGREES</span><small>OWNER WORKING COUNT · STRUCTURAL DISPLAY ONLY · NO EXECUTION PERMISSION</small></div>${ladder(m)}${degreeDetail(m)}`
      + `<div class="race-section-label"><span>ENGINE 27 · TRADER INTELLIGENCE</span><small>SEVEN CURRENT OWNER WORKING INTERPRETATIONS · ENGINE 22 AUTHORITY PRESERVED</small>${chip('READ ONLY')}${chip('7 DEGREES', 'gold')}${chip('NO EXECUTION', 'red')}</div>${intelligence(m)}`
      + `<div class="race-section-label"><span>SHARED MARKET CONFIRMATION</span><small>ES · QQQ · VIX · ENGINE 25 · ENGINE 29 · CONTEXT, NOT AUTHORIZATION</small></div>${shared(m)}`
      + `<div class="race-section-label"><span>ENGINE 26 · LOCATION / PLANNER</span><small>SETUP LOCATION AND PROPOSED GEOMETRY · ENGINE 6 REMAINS FINAL PERMISSION</small></div>${planner(m)}`;
  }

  document.addEventListener('click', ev => {
    const b = ev.target.closest?.('[data-sl-degree]'); if (!b) return;
    ui.degree = b.dataset.slDegree;
    if (typeof render === 'function') render();
  });
  setInterval(() => { if (location.hash.startsWith('#/strategies') && !document.hidden) load(); }, REFRESH_MS);
  window.fryePages = { ...(window.fryePages || {}), strategies: page };
  window.redlineStrategies = ui;
})();
