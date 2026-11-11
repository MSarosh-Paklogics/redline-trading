'use strict';
/* Live Frye backend panels, rendered above the demo content of each route.
   Read-only: every value shown comes from a backend response; a failed or ok:false
   read renders as UNAVAILABLE, and each status pill says how many reads succeeded.
   app.js rebuilds #app on every render, so panels are kept here and re-attached. */
(() => {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const label = v => v == null || v === '' ? '—' : String(v).replace(/_/g, ' ');
  const num = (v, d = 1) => v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(d);
  const TONES = { good: ['bull', 'bullish', 'up', 'long', 'success', 'go', 'allow', 'allowed', 'permitted', 'ok', 'current'], bad: ['bear', 'bearish', 'down', 'danger', 'high', 'stand_down', 'block', 'blocked', 'broad_deterioration', 'negative', 'stale'], warn: ['neutral', 'warn', 'watch', 'caution', 'mixed', 'medium', 'wait'] };
  const tone = v => { const s = String(v || '').toLowerCase(); for (const [t, words] of Object.entries(TONES)) if (words.some(w => s === w || s.startsWith(w + '_') || s.endsWith('_' + w))) return t; return ''; };
  const cell = (title, value, detail, t = tone(value)) => `<div class="live-engine-cell"><span>${esc(title)}</span><strong class="${t ? 'live-' + t : ''}" title="${esc(label(value))}">${esc(label(value))}</strong><small title="${esc(detail)}">${esc(detail ?? '')}</small></div>`;
  const head = (eyebrow, title) => `<div class="live-meter-board-head"><div><span class="eyebrow">${esc(eyebrow)}</span><strong>${esc(title)}</strong><small data-live-updated>Reading canonical backend…</small></div><span class="pill gold" data-live-status>CONNECTING</span></div>`;
  const setStatus = (el, okCount, total) => {
    const pill = el.querySelector('[data-live-status]');
    const [text, t] = okCount === total ? ['LIVE BACKEND', 'green'] : okCount ? [`PARTIAL ${okCount}/${total}`, 'gold'] : ['UNAVAILABLE', 'red'];
    pill.textContent = text; pill.className = `pill ${t}`;
  };
  const settle = reads => Promise.allSettled(reads).then(rs => rs.map(r => r.status === 'fulfilled' ? r.value.data : null));
  const stamp = (el, text) => { el.querySelector('[data-live-updated]').textContent = text; };
  const ageDays = ts => { const t = Date.parse(String(ts).replace(' ', 'T')); return Number.isNaN(t) ? null : (Date.now() - t) / 864e5; };
  // Backend marks the 4H and EOD meter formulas as placeholders (futures-market-meter-v2-spy-style-10m-30m-1h).
  const PLACEHOLDER_TFS = new Set(['4h', '1d', 'EOD']);

  /* #/strategies is its own live page now (strategies-live.js). */

  /* ---------- #/chart — Engine 17 status pills (chart-engines.js) ---------- */
  async function chartEngines(el) {
    const ce = window.redlineChart;
    const m = ce?.model && Date.now() - ce.model.at < 55000 ? ce.model : await ce?.load();
    el.querySelector('[data-live-body]').innerHTML = m ? ce.pills() : '<p class="live-note">Live ES strategy snapshot unavailable.</p>';
    stamp(el, `ES ${'intraday_scalp@10m'} · snapshot ${m?.snapshotTime || '—'}`);
    setStatus(el, m ? 1 : 0, 1);
  }

  /* ---------- #/meters — ES futures meter + SPY market meter (Frye MarketMeterPage) ---------- */
  // Staleness limits per frame; SPY tones follow Frye RowMarketOverview (master ≥70 / ≥45, alignment ≥75 / ≥50).
  const STALE_MIN = { '10m': 30, '30m': 90, '1h': 180, '4h': 720, eod: 2160, '1d': 2160 };
  const ageMin = t => { const d = Date.parse(t || ''); return Number.isFinite(d) ? (Date.now() - d) / 60000 : null; };
  const meterCell = (title, d, frame, toneOverride) => {
    const age = ageMin(d?.updatedAt), stale = age != null && age > (STALE_MIN[frame] || 90);
    return cell(title, d?.score == null ? 'UNAVAILABLE' : num(d.score), `${label(d?.state) || '—'}${d?.updatedAt ? ` · ${String(d.updatedAt).replace('T', ' ').slice(5, 16)}` : ''}${stale ? ' · STALE' : ''}`, stale ? 'warn' : toneOverride ?? tone(d?.state));
  };
  const band = (v, hi, lo) => v == null ? '' : v >= hi ? 'good' : v >= lo ? 'warn' : 'bad';
  async function meters(el) {
    const x = window.redlineXray?.model || await window.redlineXray?.load();
    const es = x?.meter, spy = x?.spy;
    const esLight = k => es?.lights?.[k] ? { score: es.lights[k].score, state: es.lights[k].state, updatedAt: es.lights[k].updated_at_utc || es.updatedAt } : null;
    el.querySelector('[data-live-body]').innerHTML = `
      <div class="live-section-title">ES FUTURES METER · /api/v1/futures/market-meter</div>
      ${es ? `<div class="live-engine-grid">${[['10m', '10m'], ['30m', '30m'], ['1h', '1H'], ['4h', '4H · FORMULA PENDING'], ['1d', 'EOD · FORMULA PENDING']].map(([k, t]) => meterCell(t, esLight(k), k)).join('')}${cell('ES MASTER', num(es.master), `${label(es.masterState)} · weights 10/15/25/30/20`)}</div>` : '<p class="live-note">ES market meter unavailable.</p>'}
      <div class="live-section-title">SPY MARKET METER · /live/intraday · 30m · hourly · 4h · eod</div>
      ${spy ? `<div class="live-engine-grid">${[['10m', '10m'], ['30m', '30m'], ['1h', '1H'], ['4h', '4H'], ['eod', 'EOD']].map(([k, t]) => meterCell(t, spy.lights[k], k)).join('')}${cell('SPY MASTER', num(spy.master), `${spy.masterParts}/3 components (1H 20% · 4H 35% · EOD 45%)${spy.masterParts < 3 ? ' · PARTIAL' : ''}`, band(spy.master, 70, 45))}</div>
      <div class="live-engine-grid">${meterCell('ALIGNMENT 10 · ENGINE 21', spy.alignment10 && { ...spy.alignment10 }, '10m', band(spy.alignment10?.score, 75, 50))}${meterCell('ALIGNMENT 30 · ENGINE 21', spy.alignment30 && { ...spy.alignment30 }, '30m', band(spy.alignment30?.score, 75, 50))}</div>` : '<p class="live-note">SPY market meter unavailable.</p>'}
      <p class="live-note">The SPY master is re-weighted over the frames that are available (Frye weightedBlend); fewer than 3 components means a partial read. ES 4H and EOD lights use the backend's placeholder formulas.</p>`;
    stamp(el, `ES ${es?.updatedAt || '—'} · SPY 10m ${spy?.lights?.['10m']?.updatedAt || '—'}`);
    setStatus(el, [es, spy].filter(Boolean).length, 2);
  }

  const SURFACES = {
    chart: ['ES CHART VIEW · LIVE', 'Engine 17 snapshot truth · full engine read in the Engine read panel', chartEngines],
    meters: ['LIVE CLIENT MARKET METER', 'ES multi-timeframe condition', meters]
  };
  const surfaces = {};
  const routeKey = () => (location.hash.slice(2).split(/[?/]/)[0]) || 'overview';
  function place() {
    const main = document.querySelector('#main'); if (!main) return;
    const key = routeKey();
    for (const [k, el] of Object.entries(surfaces)) {
      // Live panel goes right under the page title (and its section bar), not above the title.
      if (k === key && !main.contains(el)) { const after = main.querySelector(':scope > .page-nav') || main.querySelector(':scope > .page-head'); after ? after.after(el) : main.prepend(el); }
      if (k !== key) el.remove();
    }
  }
  function load(key, force) {
    const def = SURFACES[key]; if (!def || !window.redlineApi) return;
    let el = surfaces[key];
    if (!el) {
      el = document.createElement('section'); el.className = 'live-meter-board live-surface'; el.dataset.liveSurface = key;
      el.innerHTML = head(def[0], def[1]) + '<div data-live-body><p class="live-note">Loading…</p></div>';
      surfaces[key] = el; force = true;
    }
    place();
    if (force) def[2](el).catch(() => setStatus(el, 0, 1));
  }
  const app = document.querySelector('#app');
  if (app) new MutationObserver(place).observe(app, { childList: true });
  window.addEventListener('hashchange', () => setTimeout(() => load(routeKey()), 60));
  setTimeout(() => load(routeKey()), 150);
  setInterval(() => load(routeKey(), true), 60000);
})();
