'use strict';
/* Live backend panels for #/meters and #/chart. Read-only; a failed or ok:false
   response renders as UNAVAILABLE and the status pill reflects how many reads succeeded. */
(() => {
  const setStatus = (pill, okCount, total) => {
    const [text, tone] = okCount === total ? ['LIVE BACKEND', 'green'] : okCount ? [`PARTIAL ${okCount}/${total}`, 'gold'] : ['UNAVAILABLE', 'red'];
    pill.textContent = text; pill.className = `pill ${tone}`;
  };
  // Backend marks the 4H and EOD meter formulas as placeholders (futures-market-meter-v2-spy-style-10m-30m-1h).
  const PLACEHOLDER_TFS = new Set(['4h', '1d']);

  const render = () => {
    if (!location.hash.startsWith('#/meters') || !window.redlineApi) return;
    const el = document.createElement('section'); el.className = 'live-meter-board'; el.dataset.liveMeterSurface = '1';
    el.innerHTML = '<div class="live-meter-board-head"><div><span class="eyebrow">LIVE CLIENT MARKET METER</span><strong>ES multi-timeframe condition</strong><small data-meter-updated>Loading canonical backend…</small></div><span class="pill gold" data-meter-status>CONNECTING</span></div><div class="live-meter-grid">' + ['10m', '30m', '1h', '4h', '1d'].map(tf => `<div class="live-meter-cell"><span>${tf.toUpperCase()}${PLACEHOLDER_TFS.has(tf) ? ' · PLACEHOLDER' : ''}</span><strong data-meter-score="${tf}">—</strong><small data-meter-state="${tf}">—</small></div>`).join('') + '</div>';
    attach(el);
    const pill = el.querySelector('[data-meter-status]');
    window.redlineApi.marketMeter('ES').then(({ data }) => {
      const lights = data?.lights || {};
      ['10m', '30m', '1h', '4h', '1d'].forEach(tf => {
        const d = lights[tf] || {};
        el.querySelector(`[data-meter-score="${tf}"]`).textContent = d.score == null ? '—' : Number(d.score).toFixed(1);
        el.querySelector(`[data-meter-state="${tf}"]`).textContent = PLACEHOLDER_TFS.has(tf) ? 'Formula not final on backend' : (d.state || 'UNAVAILABLE');
      });
      el.querySelector('[data-meter-updated]').textContent = `Updated ${data?.updated_at_utc || '—'}`;
      setStatus(pill, 1, 1);
    }).catch(() => setStatus(pill, 0, 1));
  };

  // Engine 6 permission and Engine 26 geometry are published inside the strategy
  // snapshot; they are wired with the Strategies page, not read from standalone routes.
  const ENGINES = [
    ['engine3', 'E3 REACTION', api => api.engine3('ES')],
    ['engine4', 'E4 VOLUME', api => api.engine4('ES')],
    ['engine22', 'E22 WAVES', api => api.activeWaves('ES')],
    ['engine25', 'E25 MARKET HEALTH', api => api.engine25Summary()],
    ['engine29', 'E29 STRESS', api => api.engine29Summary()]
  ];
  const pick = (obj, keys) => { for (const k of keys) { const v = obj?.[k] ?? obj?.data?.[k]; if (v != null && typeof v !== 'object') return v; } return null; };

  const renderChartEngines = () => {
    if (!location.hash.startsWith('#/chart') || !window.redlineApi) return;
    const el = document.createElement('section'); el.className = 'live-engine-board'; el.dataset.liveEngineSurface = '1';
    el.innerHTML = '<div class="live-meter-board-head"><div><span class="eyebrow">LIVE ENGINE CONTEXT</span><strong>Canonical ES engine evidence</strong><small data-engine-updated>Reading backend routes…</small></div><span class="pill gold" data-engine-status>CONNECTING</span></div><div class="live-engine-grid">' + ENGINES.map(([id, label]) => `<div class="live-engine-cell"><span>${label}</span><strong data-engine-value="${id}">—</strong><small data-engine-detail="${id}">Loading</small></div>`).join('') + '</div>';
    attach(el);
    Promise.allSettled(ENGINES.map(([, , read]) => read(window.redlineApi))).then(results => {
      let okCount = 0;
      results.forEach((r, i) => {
        const id = ENGINES[i][0];
        let value = 'UNAVAILABLE', detail = r.status === 'rejected' ? String(r.reason?.message || 'Request failed') : '';
        if (r.status === 'fulfilled') {
          okCount++;
          const v = r.value.data;
          value = String(pick(v, ['state', 'status', 'regime', 'bias', 'direction', 'mode']) ?? 'NO STATE FIELD');
          detail = String(pick(v, ['reason', 'message', 'summary', 'updatedAtUtc', 'updated_at_utc', 'servedAt']) ?? 'Backend response');
        }
        el.querySelector(`[data-engine-value="${id}"]`).textContent = value.toUpperCase();
        el.querySelector(`[data-engine-detail="${id}"]`).textContent = detail.slice(0, 80);
      });
      el.querySelector('[data-engine-updated]').textContent = `Read ${new Date().toISOString()}`;
      setStatus(el.querySelector('[data-engine-status]'), okCount, ENGINES.length);
    });
  };

  // app.js rebuilds #app on every render, so panels live in `surfaces` and are
  // re-attached to the top of <main> after each render instead of being refetched.
  const surfaces = {};
  function attach(el) { const key = el.dataset.liveMeterSurface ? 'meters' : 'chart'; surfaces[key]?.remove(); surfaces[key] = el; place(); }
  function place() {
    const main = document.querySelector('#main'); if (!main) return;
    for (const [key, el] of Object.entries(surfaces)) {
      const wanted = location.hash.startsWith(`#/${key}`);
      if (wanted && !main.contains(el)) main.prepend(el);
      if (!wanted) el.remove();
    }
  }
  const load = () => { if (location.hash.startsWith('#/meters') && !surfaces.meters) render(); if (location.hash.startsWith('#/chart') && !surfaces.chart) renderChartEngines(); place(); };
  const app = document.querySelector('#app');
  if (app) new MutationObserver(place).observe(app, { childList: true });
  window.addEventListener('hashchange', () => setTimeout(load, 60));
  setTimeout(load, 150);
  setInterval(() => {
    if (location.hash.startsWith('#/meters')) render();
    if (location.hash.startsWith('#/chart')) renderChartEngines();
  }, 60000);
})();
