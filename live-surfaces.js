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

  /* ---------- #/strategies — Strategies ---------- */
  async function strategies(el) {
    const [snap] = await settle([window.redlineApi.snapshotShared('ES')]);
    const list = Object.entries(snap?.strategies || {});
    el.querySelector('[data-live-body]').innerHTML = list.length ? `
      <p class="live-note">Structure, readiness, geometry and permission are separate decisions. Only Engine 6 permission allows a trade; "ready" is not "permitted".</p>
      ${list.map(([id, st]) => {
        const e23 = st.engine23Interpretation || {}, e15 = st.engine15 || {}, e26 = st.engine26ProposedGeometry || {}, e6 = st.permission || {};
        return `<div class="live-strategy">
          <div class="live-strategy-head"><strong>${esc(id)}</strong><small>${esc(label(st.degree))} · ${esc(st.wave || '—')} · ${esc(st.tf || '')}</small></div>
          <div class="live-engine-grid live-strategy-grid">
            ${cell('STRUCTURE · E23', e23.state ?? 'UNAVAILABLE', [e23.health && `Health ${label(e23.health)}`, e23.activeDegree && `${label(e23.activeDegree)} degree`, e23.preferredEntry && label(e23.preferredEntry)].filter(Boolean).join(' · '))}
            ${cell('READINESS · E15', e15.readiness ?? 'UNAVAILABLE', [e15.direction && `Dir ${e15.direction}`, e15.action && label(e15.action)].filter(Boolean).join(' · '))}
            ${cell('GEOMETRY · E26', e26.status ?? 'UNAVAILABLE', e26.direction ? `Direction ${label(e26.direction)}` : '')}
            ${cell('PERMISSION · E6', e6.permission ?? 'UNAVAILABLE', e6.permission ? `Size ×${e6.sizeMultiplier ?? '—'} · ${e6.asOf || ''}` : '')}
          </div>
          ${e15.summary ? `<p class="live-note">${esc(e15.summary)}</p>` : ''}
        </div>`;
      }).join('')}` : '<p class="live-note">Strategy snapshot unavailable.</p>';
    stamp(el, `Snapshot ${snap?.now || '—'} · ${list.length} strategies`);
    setStatus(el, snap ? 1 : 0, 1);
  }

  /* ---------- #/chart — Engine 17 status pills (chart-engines.js) ---------- */
  async function chartEngines(el) {
    const ce = window.redlineChart;
    const m = ce?.model && Date.now() - ce.model.at < 55000 ? ce.model : await ce?.load();
    el.querySelector('[data-live-body]').innerHTML = m ? ce.pills() : '<p class="live-note">Live ES strategy snapshot unavailable.</p>';
    stamp(el, `ES ${'intraday_scalp@10m'} · snapshot ${m?.snapshotTime || '—'}`);
    setStatus(el, m ? 1 : 0, 1);
  }

  /* ---------- #/meters — market meter ---------- */
  async function meters(el) {
    const [m] = await settle([window.redlineApi.marketMeter('ES')]);
    const lights = m?.lights || {};
    el.querySelector('[data-live-body]').innerHTML = `<div class="live-meter-grid">${['10m', '30m', '1h', '4h', '1d'].map(tf => { const d = lights[tf] || {}; return `<div class="live-meter-cell"><span>${tf.toUpperCase()}${PLACEHOLDER_TFS.has(tf) ? ' · FORMULA PENDING' : ''}</span><strong>${num(d.score)}</strong><small class="live-${tone(d.state)}">${esc(label(d.state ?? 'UNAVAILABLE'))}</small></div>`; }).join('')}</div>${m?.master ? `<p class="live-note">Master ${num(m.master.score)} · ${esc(label(m.master.state))} (weighted; includes the pending 4H/EOD formulas)</p>` : ''}`;
    stamp(el, `Updated ${m?.updated_at_utc || '—'}`);
    setStatus(el, m ? 1 : 0, 1);
  }

  const SURFACES = {
    strategies: ['LIVE STRATEGIES', 'Canonical ES strategy decisions', strategies],
    chart: ['ES CHART VIEW · LIVE', 'Engine 17 snapshot truth · full engine read in the Engine read panel', chartEngines],
    meters: ['LIVE CLIENT MARKET METER', 'ES multi-timeframe condition', meters]
  };
  const surfaces = {};
  const routeKey = () => (location.hash.slice(2).split(/[?/]/)[0]) || 'overview';
  function place() {
    const main = document.querySelector('#main'); if (!main) return;
    const key = routeKey();
    for (const [k, el] of Object.entries(surfaces)) {
      if (k === key && !main.contains(el)) main.prepend(el);
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
