'use strict';
/* Live engine read for Redline's chart terminal, mirroring the client's Frye chart page
   (Frye-Dashboard src/pages/rows/RowChart: Engine17Badges, Engine17DecisionTimeline,
   SMZ panels). Everything comes from the ES `intraday_scalp@10m` strategy in
   /api/v1/dashboard-snapshot plus Engine 3/4 and /api/v1/smz-levels. Read-only:
   no permission or execution is created here.
   Exposes window.redlineChart { model, load(), pills(), panel() }. */
(() => {
  const STRATEGY = 'intraday_scalp@10m';
  const DEGREES = [['micro', 'Micro'], ['subminute', 'Subminute'], ['minute', 'Minute'], ['minor', 'Minor'], ['intermediate', 'Intermediate'], ['primary', 'Primary']];
  const n = v => { const x = Number(v); return v == null || v === '' || !Number.isFinite(x) ? null : x; };
  const L = v => v == null || v === '' ? '—' : String(v).replace(/_/g, ' ').toUpperCase();
  const E = v => esc(L(v));
  const tone = v => /BEAR|SHORT|DOWN|BLOCK|STAND.DOWN|NO.TRADE|INVALID|RISK|DANGER|WEAK|FAIL|STALE/i.test(v || '') ? 'down' : /BULL|LONG|UP\b|GO|ALLOW|READY|FULL|CONFIRMED|STRONG|ACTIVE/i.test(v || '') ? 'up' : /WATCH|WAIT|REDUCE|PARTIAL|CAUTION|NEUTRAL|SETTING/i.test(v || '') ? 'yellow' : '';
  const kv = (k, v, t) => `<div class="ce-kv"><span>${esc(k)}</span><b class="${t ?? tone(v)}">${E(v)}</b></div>`;
  const card = (num, title, body, accent = '') => `<section class="ce-card ${accent}"><h4>${num ? `<i>${num}</i>` : ''}${esc(title)}</h4>${body}</section>`;
  const ui = { degree: 'minute' };
  // The chart terminal and the dashboard (overview, also the default route) both show this read.
  const onEnginePage = () => /^#\/(chart|overview)/.test(location.hash) || location.hash === '' || location.hash === '#' || location.hash === '#/';

  // Pill formatting MIRRORED from Frye Engine17Badges.jsx (display only).
  const simplifyAlignment = v => { const s = String(v || '').toUpperCase(); if (!s) return '—'; if (s.includes('FULL')) return 'FULL'; if (s.includes('PARTIAL')) return 'PARTIAL'; if (s.includes('NO ALIGNMENT') || s.includes('NONE')) return 'NO ALIGNMENT'; if (s.includes('BULL')) return 'BULL'; if (s.includes('BEAR')) return 'BEAR'; return L(v); };
  function pillValues(f, d15, a10, a30) {
    const prep = String(f.prepBias || '').toUpperCase(), exec = String(f.executionBias || '').toUpperCase(), w3 = String(f.wave3Status || '').toUpperCase();
    const state = w3 === 'ACTIVE_EXTENSION' ? 'W3 ACTIVE' : w3 === 'FIRST_WARNING' ? 'W3 WARNING' : f.continuationTriggerShort ? 'CONFIRMED SHORT' : f.continuationTriggerLong ? 'CONFIRMED LONG' : prep === 'SHORT_PREP' && f.continuationWatchShort ? 'BREAKDOWN WATCH' : prep === 'LONG_PREP' && f.continuationWatchLong ? 'BREAKOUT WATCH' : L(f.state);
    const structure = { SHORT_PREP: 'SHORT PREP', LONG_PREP: 'LONG PREP', SHORT_PREFERENCE: 'SHORT PREFERENCE', LONG_PREFERENCE: 'LONG PREFERENCE' }[prep] || (prep && prep !== 'NONE' ? L(prep) : 'NONE');
    const execution = exec === 'LONG_ONLY' ? 'LONG ONLY' : exec === 'SHORT_ONLY' ? 'SHORT ONLY' : !exec || exec === 'NONE' ? 'NEUTRAL' : L(exec);
    const r = String(f.readinessLabel || '').toUpperCase();
    const readiness = { WAIT_FOR_MAGNET_RESOLUTION: 'WAIT FOR BREAK', WATCH_FOR_BREAKDOWN: 'WAIT FOR BREAK', WATCH_FOR_BREAKOUT: 'WAIT FOR BREAK', WATCH: 'WATCH', WAIT: 'NOT READY', READY: 'READY', ENTER: 'TRIGGERED' }[r] || L(r || 'WAIT');
    const action = String(d15.action || f.decisionAction || 'NO_ACTION').toUpperCase();
    const decDir = d15.direction || f.decisionDirection;
    const dir = decDir && decDir !== 'NONE' ? String(decDir).toUpperCase() : exec.includes('SHORT') ? 'SHORT' : exec.includes('LONG') ? 'LONG' : 'NONE';
    const status = action === 'BLOCKED' ? 'BLOCKED — NO TRADE' : action === 'WATCH' || action === 'NO_ACTION' ? (dir === 'SHORT' ? 'WATCH — CAUTION SHORT' : dir === 'LONG' ? 'WATCH — CAUTION LONG' : 'WAIT') : action === 'REDUCE_OK' ? (dir === 'NONE' ? 'PROBE' : `PROBE — ${dir}`) : action === 'ENTER_OK' ? (dir === 'NONE' ? 'ENTRY GO' : `ENTRY — ${dir} GO`) : 'WAIT';
    const d2 = String(d15.direction || f.decisionDirection || f.direction || '').toUpperCase(), ctx = typeof f.context === 'string' ? f.context.toUpperCase() : '';
    const bias = d2 === 'LONG' || d2 === 'SHORT' ? d2 : ctx.includes('LONG') ? 'LONG' : ctx.includes('SHORT') ? 'SHORT' : 'NEUTRAL';
    const w = f.waveContext || {}, sw = v => { const s = String(v || '').toUpperCase(); return !s ? '—' : s.startsWith('IN_') ? s.slice(3) : s.replace(/_/g, ' '); };
    const q = n(d15.qualityScore ?? f.qualityScore), grade = String(d15.qualityBand || d15.qualityGrade || f.qualityGrade || '').toUpperCase();
    return [['STATE', state], ['STRUCTURE', structure], ['EXECUTION', execution], ['STATUS', status], ['READINESS', readiness], ['BIAS', bias], ['WAVE', `${sw(w.primaryPhase)} / ${sw(w.intermediatePhase)} / ${sw(w.minorPhase)}`], ['QUALITY', q == null ? '—' : grade ? `${Math.round(q)} (${grade})` : String(Math.round(q))], ['ALIGNMENT 10', simplifyAlignment(a10)], ['ALIGNMENT 30', simplifyAlignment(a30)]];
  }

  function build(snap, e3, e4, smz, shelves) {
    const st = snap?.strategies?.[STRATEGY];
    if (!st) return null;
    const ws = st.engine22WaveStrategy || {};
    return {
      at: Date.now(), snapshotTime: snap.now || null,
      pills: pillValues(st.engine16 || {}, st.engine15Decision || {}, snap.engine21Alignment?.tenMin?.alignmentState, snap.engine21Alignment?.thirtyMin?.alignmentState),
      display: ws.engine22Display || null,
      timelineRead: ws.timelineRead || null,
      tcs: ws.tradeContextSummary || null,
      currentPrice: n(ws.currentPrice),
      e15: st.engine15 || null,
      e26: st.engine26LocationCandidate || null,
      e27: snap.engine27Strategies?.engine27TraderDecision?.decisions?.minute || null,
      e6: st.permission || null,
      timeline: st.strategyTimeline || null,
      e3, e4,
      smz: smz ? (smz.levels?.length ? smz.levels : smz.structures_sticky || []) : null, smzMeta: smz?.meta || null,
      shelves: Array.isArray(shelves?.levels) ? shelves.levels : null, shelvesPrice: n(shelves?.current_price)
    };
  }

  const chart = window.redlineChart = { model: null, loading: null };
  chart.load = () => {
    if (!window.redlineApi) return Promise.resolve(null);
    if (chart.loading) return chart.loading;
    const api = window.redlineApi;
    chart.loading = Promise.allSettled([api.snapshotShared('ES'), api.engine3('ES'), api.engine4('ES'), api.esSmzLevels(), api.esSmzShelves()])
      .then(rs => {
        const [snap, e3, e4, smz, shelves] = rs.map(r => r.status === 'fulfilled' ? r.value.data : null);
        chart.model = build(snap, e3, e4, smz, shelves);
        if (typeof render === 'function' && onEnginePage()) render();
        return chart.model;
      })
      .finally(() => { chart.loading = null; });
    return chart.loading;
  };

  chart.pills = () => {
    const m = chart.model; if (!m) return '';
    return `<div class="ce-pills">${m.pills.map(([k, v]) => `<span class="ce-pill ${tone(v)}"><small>${esc(k)}</small>${esc(v)}</span>`).join('')}</div>`;
  };

  function degreeCard(m) {
    const d = m.display?.degrees?.[ui.degree];
    const tabs = `<div class="ce-degrees">${DEGREES.map(([k, lab]) => `<button type="button" data-ce-degree="${k}" class="${k === ui.degree ? 'selected' : ''}">${lab}</button>`).join('')}</div>`;
    if (!d) return tabs + card('', `Engine 22 — ${L(ui.degree)}`, '<p class="ce-muted">Not published for this degree.</p>');
    const rows = (d.rows || []).map(r => kv(r.label, r.value, tone(r.status || r.tone || r.value))).join('');
    const levels = Array.isArray(d.levels) && d.levels.length ? `<div class="ce-sub">Levels</div>${d.levels.slice(0, 10).map(l => kv(l.label || l.name || l.kind, l.price ?? l.value ?? '—', '')).join('')}` : '';
    const rules = Array.isArray(d.rules) && d.rules.length ? `<ul class="ce-list">${d.rules.slice(0, 5).map(r => `<li>${esc(typeof r === 'string' ? r : r.text || r.label || '')}</li>`).join('')}</ul>` : '';
    return tabs + card('', `Engine 22 — ${d.label || L(ui.degree)} market structure`, `<div class="ce-tags"><span>ES</span><span>ENGINE 22 DEGREE STACK</span><span>NO EXECUTION</span><span>NO PERMISSION CREATED</span></div><div class="ce-head ${tone(d.direction)}">${esc(d.headline || '')}</div><p class="ce-muted">${esc(d.subtitle || '')} · Badge ${E(d.badge)} · Direction ${E(d.direction)}</p>${rows}${levels}${rules}`);
  }

  // The engine read in separate parts, so the dashboard can show each engine group on its own tab.
  chart.parts = () => {
    const m = chart.model;
    if (!m) return null;
    const tr = m.timelineRead || {}, tcs = m.tcs || {}, e6 = m.e6 || {}, e27 = m.e27 || {}, e26 = m.e26 || {}, tl = m.timeline || {}, e15 = m.e15 || {};
    const lines = arr => (arr || []).map(x => String(x).split('\n').filter(Boolean).map(s => `<p>${esc(s)}</p>`).join('')).join('');
    const listOf = arr => Array.isArray(arr) && arr.length ? `<ul class="ce-list">${arr.map(x => `<li>${esc(typeof x === 'string' ? x.replace(/_/g, ' ') : x?.label || x?.headline || x?.code || JSON.stringify(x))}</li>`).join('')}</ul>` : '';
    const r3 = m.e3?.reaction || {}, v4 = m.e4?.engine4EsVolume || {};
    const smz = (m.smz || []).slice(0, 8);
    return {
      strategy: `<div class="ce-live"><span class="pill green">LIVE BACKEND</span><small>ES · ${esc(STRATEGY)} · snapshot ${esc(m.snapshotTime || '—')}</small></div>
      <div class="ce-strip">${kv('Market bias', tcs.direction && tcs.direction !== 'NONE' ? tcs.direction : e27.direction || 'NEUTRAL')}${kv('Setup', e15.readiness || tl.state || '—')}${kv('Trade permission', e6.permission || '—')}</div>
      ${card('', 'Trade context', `<div class="ce-head ${tone(tcs.bias)}">${esc(tcs.headline || tr.headline || '—')}</div><p class="ce-muted">${esc(tcs.subheadline || tr.subheadline || '')}</p><p class="ce-stack">${esc(tr.waveStackText || '')}</p>${kv('Action', tcs.action || tr.action)}${kv('Chase allowed', tcs.chaseAllowed == null ? '—' : tcs.chaseAllowed ? 'YES' : 'NO')}${kv('Top candidate', tcs.topCandidate ?? '—', '')}${kv('Hard invalidation', tcs.hardInvalidation ?? '—', 'down')}${kv('Next allowed setup', tcs.nextAllowedSetup)}${kv('Current price', m.currentPrice ?? '—', '')}`)}
      ${degreeCard(m)}
      ${card('2', 'Engine 26A — Meaningful trade location', `${kv('Location status', e26.status || 'WAITING FOR LOCATION')}${kv('Active', e26.active == null ? '—' : e26.active ? 'YES' : 'NO')}${kv('Zone', e26.zoneId || 'NOT ATTACHED', '')}`, 'gold')}
      ${card('3', 'Trader intelligence — Engine 27', `${kv('State', e27.decisionState || 'IDLE')}${kv('Direction', e27.direction || 'NEUTRAL')}${kv('Current wave', e27.currentWave)}${kv('Next wave', e27.nextExpectedWave)}${kv('Internal wave', e27.internalWave)}${kv('Next internal', e27.nextExpectedInternalWave)}${kv('Setup', `${L(e27.setupType)} · ${e27.setupGrade || '—'}`, '')}${kv('Executable', tl.executable == null ? 'NO' : tl.executable ? 'YES' : 'NO')}${e27.waitingFor?.length ? `<div class="ce-sub">Waiting for</div>${listOf(e27.waitingFor)}` : ''}${e27.blockers?.length ? `<div class="ce-sub">Blockers</div>${listOf(e27.blockers)}` : '<p class="ce-muted">No active Engine 27 blockers reported.</p>'}${e27.warnings?.length ? `<div class="ce-sub">Warnings</div>${listOf(e27.warnings)}` : ''}`)}
      ${card('4', 'Final permission — Engine 6', `${kv('Real permission', e6.permission)}${kv('Executable', e6.executable == null ? '—' : e6.executable ? 'YES' : 'NO')}${kv('Watch only', e6.watchOnly == null ? '—' : e6.watchOnly ? 'YES' : 'NO')}${kv('Paper state', e6.paper?.decision)}${kv('Paper direction', e6.paper?.direction)}${kv('Paper allowed', e6.paper?.allowed == null ? '—' : e6.paper.allowed ? 'YES' : 'NO')}${kv('Size multiplier', e6.sizeMultiplier == null ? '—' : `×${e6.sizeMultiplier}`, '')}${kv('Authority', e6.authority, '')}${kv('Authority source', e6.authoritySource, '')}${kv('Provenance', e6.engine, '')}${kv('As of', e6.asOf || '—', '')}${e6.reasonCodes?.length ? `<div class="ce-sub">Reason codes</div>${listOf(e6.reasonCodes)}` : ''}<p class="ce-muted">Engine 6 is the final permission authority. Redline creates no orders.</p>`, 'red')}
      ${card('5', 'Next action levels', `${kv('Next action', tl.nextAction || tr.action)}${kv('Needs', tr.needs)}${Array.isArray(tl.levels) && tl.levels.length ? tl.levels.slice(0, 8).map(l => kv(l.label || l.kind || 'Level', l.price ?? l.value ?? '—', '')).join('') : ''}`)}
      ${card('6', 'Canonical minute stage timeline', Array.isArray(tl.stages) && tl.stages.length ? tl.stages.map(s => `<div class="ce-stage"><b class="${tone(s.status)}">${E(s.status)}</b><div><strong>${esc(s.label || '')}</strong><p>${esc(s.headline || '')}</p><small>${esc(s.detail || '')}</small></div></div>`).join('') : '<p class="ce-muted">Timeline not attached yet.</p>')}`,
      context: `${(tr.mainSections || []).map((s, i) => card(String(i + 1), s.title, lines(s.lines), s.severity === 'warning' ? 'gold' : s.severity === 'danger' ? 'red' : '')).join('')}`,
      evidence: `${card('', 'Engine 3 — current level action', m.e3 ? `${kv('State', r3.state)}${kv('Quality', r3.quality)}${kv('Bias', r3.bias)}${kv('Zone', `${m.e3.zone?.lo ?? '—'} – ${m.e3.zone?.hi ?? '—'}`, '')}${kv('Price', m.e3.price ?? '—', '')}<p class="ce-muted">${esc(r3.reason || '')} No permission or execution created.</p>` : '<p class="ce-muted">UNAVAILABLE</p>', 'green')}
      ${card('', 'Engine 4 — current scalp volume', m.e4 ? `${kv('Participation', v4.participationState)}${kv('Quality', v4.participationQuality)}${kv('Volume trend', v4.volumeTrend)}${kv('Relative volume', v4.relativeVolume ?? '—', '')}${kv('Confirmed', v4.volumeConfirmed ? 'YES' : 'NO')}${listOf(v4.reasonCodes)}` : '<p class="ce-muted">UNAVAILABLE</p>', 'red')}`,
      side: `${(tr.sideSections || []).map(s => card('', s.title, lines(s.lines))).join('')}`,
      zones: `<div class="ce-section">SMART MONEY ZONES · ES</div>
      ${m.smz?.length ? smz.map(l => card('', `${L(l.type)}${l.tier ? ' · ' + L(l.tier) : ''}`, `${kv('Range', Array.isArray(l.displayPriceRange || l.priceRange) ? (l.displayPriceRange || l.priceRange).join(' – ') : l.price ?? '—', '')}${kv('Strength', l.strength ?? '—', '')}${kv('Source', l.rangeSource || '—', '')}`)).join('') : '<p class="ce-muted">ES smart-money structures unavailable.</p>'}
      <div class="ce-section">ACC / DIST LEVELS · ES</div>
      ${m.shelves?.length ? m.shelves.map(l => { const lo = n(l.lo), hi = n(l.hi), p = m.shelvesPrice; const side = p != null && lo != null && hi != null ? (lo > p ? 'DISTRIBUTION' : hi < p ? 'ACCUMULATION' : L(l.type)) : L(l.type); return card('', side, `${kv('Range', `${l.lo ?? '—'} – ${l.hi ?? '—'}`, '')}${kv('Strength', l.strength ?? '—', '')}${kv('Timeframe', `${l.timeframe || '—'} · confirm ${l.confirmTimeframe || '—'}`, '')}`, side === 'DISTRIBUTION' ? 'red' : side === 'ACCUMULATION' ? 'green' : ''); }).join('') : '<p class="ce-muted">No active ES shelves.</p>'}
      ${m.smzMeta ? `<p class="ce-muted">Zones ${esc(m.smzMeta.source || '')} · ${esc(m.smzMeta.generated_at_utc || '—')}. Shelves entirely above price read as distribution, below as accumulation.</p>` : ''}`
    };
  };

  chart.panel = () => {
    const p = chart.parts();
    if (!p) return `<div class="ce-empty">Loading the live ES engine read…</div>`;
    return `<div class="ce-panel">${p.strategy}<div class="ce-section">MARKET CONTEXT</div>${p.context}${p.evidence}${p.side}${p.zones}</div>`;
  };

  document.addEventListener('click', ev => {
    const b = ev.target.closest?.('[data-ce-degree]'); if (!b) return;
    ui.degree = b.dataset.ceDegree;
    if (typeof render === 'function') render();
  });
  const kick = () => { if (onEnginePage()) chart.load(); };
  window.addEventListener('hashchange', () => setTimeout(kick, 50));
  setTimeout(kick, 200);
  setInterval(kick, 60000);
})();
