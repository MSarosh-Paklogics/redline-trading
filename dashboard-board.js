'use strict';
/* Redline dashboard layout (#/overview): a live ES signal board, the decision chain kept as
   separate fields (wave developing / strategy ready / trade permitted), and one tab per
   engine group instead of one long scroll.
   Display only. Every value is read from canonical engine output already loaded by
   market-xray.js (window.redlineXray.model) and chart-engines.js (window.redlineChart.model).
   Nothing is recomputed; contradictions between engines stay visible. */
(() => {
  if (typeof overview !== 'function') return;
  const TABS = [
    ['e25', 'Engine 25', 'Market X-Ray'],
    ['e29', 'Engine 29', 'Market character'],
    ['strategy', 'E15 · E22 · E26 · E27 · E6', 'Strategy stack'],
    ['evidence', 'E3 · E4 · SMZ', 'Evidence & zones']
  ];
  const KEY = 'redline-dashboard-tab';
  let tab = (() => { try { return localStorage.getItem(KEY) || 'e25'; } catch { return 'e25'; } })();
  if (!TABS.some(t => t[0] === tab)) tab = 'e25';

  const L = v => v == null || v === '' ? '—' : String(v).replace(/_/g, ' ').toUpperCase();
  const yn = v => v == null ? '—' : v ? 'YES' : 'NO';
  const tone = v => /BEAR|SHORT|DOWN|BLOCK|STAND.DOWN|NO.TRADE|NOT.ALLOWED|INVALID|RISK.OFF|DANGER|WEAK|FAIL|STALE|PRESSURE|STRESS|BREAKING/i.test(v || '') ? 'down'
    : /BULL|LONG|\bUP\b|\bGO\b|ALLOW|READY|TRIGGERED|FULL|CONFIRMED|STRONG|ACTIVE|HEALTHY|RISK.ON/i.test(v || '') ? 'up'
    : /WATCH|WAIT|REDUCE|PARTIAL|CAUTION|NEUTRAL|SETTING|MIXED|WEAKNESS/i.test(v || '') ? 'yellow' : '';
  const clock = t => { const d = Date.parse(t || ''); return Number.isFinite(d) ? new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'; };

  function tile(code, name, role, value, sub, extra = '') {
    const v = value == null || value === '' ? 'UNAVAILABLE' : value;
    return `<article class="db-signal ${tone(v)}"><header><b>${esc(code)}</b><span>${esc(name)}</span></header><strong>${esc(L(v))}</strong><p>${esc(sub || '')}</p><footer>${esc(role)}${extra}</footer></article>`;
  }

  function signalBoard(x, cm) {
    const pills = Object.fromEntries(cm?.pills || []);
    const e6 = cm?.e6 || {}, e27 = cm?.e27 || {}, e26 = cm?.e26 || {}, d22 = cm?.display?.degrees?.minute || {};
    const r3 = cm?.e3?.reaction || {}, v4 = cm?.e4?.engine4EsVolume || {}, p = x?.permission || {};
    const s29 = window.redlineXraySections?.signal29?.(x);
    const wait = cm ? null : 'LOADING';
    const chain = [
      tile('E22', 'Wave structure · minute', 'STRUCTURE AUTHORITY', wait || d22.badge || d22.direction, d22.headline || (cm ? 'Not published for this degree' : '')),
      tile('E27', 'Trader read', 'READ-ONLY INTERPRETATION', wait || e27.decisionState || 'IDLE', cm ? `${L(e27.direction || 'NEUTRAL')} · wave ${L(e27.currentWave)} → ${L(e27.nextExpectedWave)}` : ''),
      tile('E26A', 'Trade location', 'PROPOSES LOCATION ONLY', wait || e26.status || 'WAITING FOR LOCATION', cm ? `Active ${yn(e26.active)} · Zone ${e26.zoneId || 'not attached'}` : ''),
      tile('E15', 'Setup decision', 'READINESS · NOT PERMISSION', wait || pills.STATUS, cm ? `Bias ${pills.BIAS || '—'} · Quality ${pills.QUALITY || '—'}` : 'Reading the ES strategy…'),
      tile('E6', 'Final permission', 'FINAL TRADE AUTHORITY', wait || e6.permission, cm ? `Executable ${yn(e6.executable)} · Watch only ${yn(e6.watchOnly)} · Size ${e6.sizeMultiplier == null ? '—' : '×' + e6.sizeMultiplier}` : '')
    ].join('');
    const evidence = [
      tile('E25', 'Market permission', 'EVIDENCE · MIRRORED 65/20/15', p.label, p.score == null ? 'Score unavailable' : `Score ${p.score.toFixed(1)} · ${p.sizing || ''}`),
      tile('E29', 'Market character', 'EVIDENCE · NO PERMISSION', s29?.value, s29?.sub || 'Engine 29 unavailable'),
      tile('E3', 'Level reaction', 'EVIDENCE · NO PERMISSION', wait || (cm?.e3 ? r3.state : null), cm?.e3 ? `Quality ${L(r3.quality)} · Bias ${L(r3.bias)}` : ''),
      tile('E4', 'Volume behaviour', 'EVIDENCE · NO PERMISSION', wait || (cm?.e4 ? v4.participationState : null), cm?.e4 ? `${L(v4.participationQuality)} · trend ${L(v4.volumeTrend)} · confirmed ${yn(v4.volumeConfirmed)}` : '')
    ].join('');
    const at = cm?.snapshotTime ? `SNAPSHOT ${esc(clock(cm.snapshotTime))}` : 'LOADING SNAPSHOT';
    return `<div class="race-section-label"><span>LIVE SIGNAL BOARD · ES</span><small>${at} · SIGNALS ONLY · REDLINE PLACES NO ORDERS</small><span class="pill ${cm || x ? 'green' : 'gold'}">${cm || x ? 'LIVE BACKEND' : 'CONNECTING'}</span></div><div class="db-group"><span>STRATEGY CHAIN · STRUCTURE → INTERPRETATION → LOCATION → READINESS → PERMISSION</span></div><div class="db-signals db-chain-row">${chain}</div><div class="db-group"><span>MARKET EVIDENCE · CONTEXT ONLY, NEVER GRANTS PERMISSION</span></div><div class="db-signals db-evidence-row">${evidence}</div>`;
  }

  // Three separate fields: a developing wave, a ready strategy and a permitted trade are not the same thing.
  function decisionChain(cm) {
    if (!cm) return '';
    const pills = Object.fromEntries(cm.pills || []);
    const d22 = cm.display?.degrees?.minute || {}, e27 = cm.e27 || {}, e6 = cm.e6 || {};
    const wave = d22.badge || d22.direction || e27.decisionState;
    const ready = pills.READINESS, permitted = e6.permission;
    const dirs = [['E15', pills.BIAS], ['E22', d22.direction], ['E27', e27.direction]]
      .map(([k, v]) => [k, /LONG|BULL|UP/i.test(v || '') ? 'LONG' : /SHORT|BEAR|DOWN/i.test(v || '') ? 'SHORT' : null]).filter(([, v]) => v);
    const notes = [];
    if (new Set(dirs.map(d => d[1])).size > 1) notes.push(`Direction differs between engines: ${dirs.map(([k, v]) => `${k} ${v}`).join(' · ')}`);
    if (/READY|TRIGGERED/i.test(ready || '') && e6.executable !== true) notes.push('Strategy reads ready, but Engine 6 has not made it executable. Ready ≠ authorized.');
    const step = (n, title, owner, v) => `<div class="db-step ${tone(v)}"><i>${n}</i><div><small>${esc(title)} · ${esc(owner)}</small><strong>${esc(L(v || 'UNAVAILABLE'))}</strong></div></div>`;
    return `<section class="db-chain"><div class="db-chain-steps">${step(1, 'Wave developing', 'E22 / E27', wave)}${step(2, 'Strategy ready', 'E15', ready)}${step(3, 'Trade permitted', 'E6 final', permitted)}</div>${notes.length ? `<ul class="db-conflicts">${notes.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : '<p class="db-agree">No direction conflict reported between E15, E22 and E27.</p>'}</section>`;
  }

  function tabBar() {
    return `<nav class="db-tabs" role="tablist" aria-label="Engines">${TABS.map(([id, code, name]) => `<button type="button" role="tab" data-db-tab="${id}" aria-selected="${id === tab}" class="${id === tab ? 'selected' : ''}"><small>${esc(code)}</small>${esc(name)}</button>`).join('')}</nav>`;
  }

  function panes(x) {
    const parts = window.redlineChart?.parts?.();
    const loading = '<div class="ce-empty">Loading the live ES engine read…</div>';
    const xs = window.redlineXraySections || {};
    const body = {
      e25: x ? raceLiveOverview(x, { meters: false }) + (xs.e25 ? xs.e25(x) : '') : '<div class="ce-empty">Engine 25 unavailable.</div>',
      e29: x && xs.e29 ? xs.e29(x) || '<div class="ce-empty">Engine 29 unavailable.</div>' : '<div class="ce-empty">Engine 29 unavailable.</div>',
      strategy: parts ? `<div class="db-grid">${parts.strategy}<div class="ce-section">MARKET CONTEXT · ENGINE 22 TIMELINE READ</div>${parts.context}${parts.side}</div>` : loading,
      evidence: parts ? `<div class="db-grid">${parts.evidence}${parts.zones}</div>` : loading
    };
    return TABS.map(([id]) => `<div class="db-pane" role="tabpanel" data-db-pane="${id}" ${id === tab ? '' : 'hidden'}>${body[id]}</div>`).join('');
  }

  const baseOverview = overview;
  overview = function () {
    const x = window.redlineXray?.model, cm = window.redlineChart?.model;
    if (!x && !cm) return baseOverview.apply(this, arguments);
    return raceHero() + tabBar() + panes(x);
  };

  // Switching tabs only toggles the panes, so the page doesn't rebuild or jump.
  document.addEventListener('click', ev => {
    const b = ev.target.closest?.('[data-db-tab]'); if (!b) return;
    tab = b.dataset.dbTab;
    try { localStorage.setItem(KEY, tab); } catch { /* per-viewer convenience only */ }
    document.querySelectorAll('[data-db-tab]').forEach(t => { const on = t.dataset.dbTab === tab; t.classList.toggle('selected', on); t.setAttribute('aria-selected', on); });
    document.querySelectorAll('[data-db-pane]').forEach(p => { p.hidden = p.dataset.dbPane !== tab; });
  });

  if (typeof page !== 'undefined' && page === 'overview' && typeof render === 'function') render();
  window.redlineChart?.load?.();
})();
