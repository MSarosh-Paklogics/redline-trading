'use strict';
/* Live Sectors page (route #/sectors), mirroring Frye RowIndexSectors.jsx: 11 sectors in
   Frye's fixed order for 10m / 1H / 4H / EOD from /live/intraday, /live/hourly, /live/4h and
   /live/eod, with 5m/10m deltas from /live/pills. Outlook uses the backend's `outlook` when
   published, otherwise Frye's labelOutlook rule (breadth & momentum ≥55 bullish, ≤45
   bearish). Falls back to the demo sector page until the first live read succeeds. */
(() => {
  const ORDER = ['Information Technology', 'Materials', 'Health Care', 'Communication Services', 'Real Estate', 'Energy', 'Consumer Staples', 'Consumer Discretionary', 'Financials', 'Utilities', 'Industrials'];
  const ALIASES = { technology: 'Information Technology', tech: 'Information Technology', 'information technology': 'Information Technology', healthcare: 'Health Care', 'health care': 'Health Care', communications: 'Communication Services', 'communication services': 'Communication Services', 'real estate': 'Real Estate', 'consumer staples': 'Consumer Staples', 'consumer discretionary': 'Consumer Discretionary' };
  const FRAMES = [['10m', 'spyIntraday'], ['1H', 'hourlySectors'], ['4H', 'spy4h'], ['EOD', 'spyEod']];
  const canon = name => { const k = String(name || '').trim().toLowerCase(); return ALIASES[k] || ORDER.find(o => o.toLowerCase() === k) || String(name || ''); };
  const n = v => { const x = Number(v); return v == null || v === '' || !Number.isFinite(x) ? null : x; };
  const fx = (v, d = 1) => n(v) == null ? '—' : n(v).toFixed(d);
  const outlookOf = c => { if (c.outlook) return String(c.outlook).toLowerCase(); const b = n(c.breadth_pct), m = n(c.momentum_pct); return b == null || m == null ? 'unavailable' : b >= 55 && m >= 55 ? 'bullish' : b <= 45 && m <= 45 ? 'bearish' : 'neutral'; };
  const toneOf = o => o === 'bullish' ? 'up' : o === 'bearish' ? 'down' : o === 'neutral' ? 'yellow' : '';
  const state = { frame: '1H', data: null, pills: null, at: 0, loading: null };

  async function load() {
    if (state.loading || !window.redlineApi) return state.loading;
    const api = window.redlineApi;
    state.loading = Promise.allSettled([...FRAMES.map(([, fn]) => api[fn]()), api.request('/live/pills')]).then(rs => {
      const vals = rs.map(r => r.status === 'fulfilled' ? r.value.data : null);
      const data = {};
      FRAMES.forEach(([k], i) => { const d = vals[i]; const cards = d?.sectorCards || d?.sectors; if (Array.isArray(cards) && cards.length) data[k] = { cards, updatedAt: d.updated_at_utc || d.updated_at || null }; });
      if (Object.keys(data).length) { state.data = data; state.pills = vals[FRAMES.length]; state.at = Date.now(); }
      if (typeof render === 'function' && location.hash.startsWith('#/sectors')) render();
    }).finally(() => { state.loading = null; });
    return state.loading;
  }

  function page() {
    if (!state.data) { load(); return typeof sectorPage === 'function' ? sectorPage() : '<div class="notice">Loading live sectors…</div>'; }
    const frame = state.data[state.frame] ? state.frame : Object.keys(state.data)[0];
    const { cards, updatedAt } = state.data[frame];
    const byName = Object.fromEntries(cards.map(c => [canon(c.sector), c]));
    const pills = state.pills?.sectors || {};
    const rows = ORDER.map(name => ({ name, c: byName[name] || null, d: pills[name.toLowerCase()] || null }));
    const outlooks = rows.map(r => r.c ? outlookOf(r.c) : 'unavailable');
    const count = o => outlooks.filter(x => x === o).length;
    return head('SECTOR ROTATION', `Participation across all 11 sectors · ${frame} · updated ${updatedAt ? String(updatedAt).replace('T', ' ').slice(0, 16) + ' UTC' : '—'}`, `<span class="pill green">LIVE BACKEND</span>`, 'REDLINE / INDEX SECTORS')
      + `<div class="segmented xr-tabs">${FRAMES.map(([k]) => `<button type="button" class="${k === frame ? 'active' : ''}" data-sector-frame="${k}" ${state.data[k] ? '' : 'disabled'}>${k}</button>`).join('')}</div>`
      + `<div class="stats">${stat('Bullish', String(count('bullish')), 'of 11', 'breadth & momentum ≥55', 'sectors', 'up')}${stat('Neutral', String(count('neutral')), 'of 11', 'mixed', 'sectors', 'yellow')}${stat('Bearish', String(count('bearish')), 'of 11', 'breadth & momentum ≤45', 'sectors', 'down')}${stat('Net new highs', String(rows.reduce((a, r) => a + ((n(r.c?.nh) ?? 0) - (n(r.c?.nl) ?? 0)), 0)), `${frame} total`, 'NH − NL', 'spark', rows.reduce((a, r) => a + ((n(r.c?.nh) ?? 0) - (n(r.c?.nl) ?? 0)), 0) < 0 ? 'down' : 'up')}</div>`
      + panel(`11 sectors · ${frame}`, `<div class="table-wrap"><table><thead><tr><th>Sector</th><th>Outlook</th><th>Breadth %</th><th>Momentum %</th><th>Net NH</th><th>Up / Down</th><th>Δ 5m</th><th>Δ 10m</th></tr></thead><tbody>${rows.map((r, i) => r.c ? `<tr><td>${esc(r.name)}</td><td class="${toneOf(outlooks[i])}">${esc(outlooks[i].toUpperCase())}</td><td class="number">${fx(r.c.breadth_pct)}</td><td class="number">${fx(r.c.momentum_pct)}</td><td class="number ${(n(r.c.nh) ?? 0) - (n(r.c.nl) ?? 0) < 0 ? 'down' : 'up'}">${n(r.c.nh) == null || n(r.c.nl) == null ? '—' : n(r.c.nh) - n(r.c.nl)}</td><td class="number">${r.c.up ?? '—'} / ${r.c.down ?? '—'}</td><td class="number">${r.d?.d5m ?? '—'}</td><td class="number">${r.d?.d10m ?? '—'}</td></tr>` : `<tr><td>${esc(r.name)}</td><td colspan="7" class="muted">UNAVAILABLE</td></tr>`).join('')}</tbody></table></div>`, '', `Fixed Frye sector order · deltas from /live/pills (5m ${esc(state.pills?.stamp5 || '—')} · 10m ${esc(state.pills?.stamp10 || '—')})`)
      + `<div class="notice">Outlook uses the backend's published value when present; otherwise breadth and momentum both ≥55 = bullish, both ≤45 = bearish, else neutral.</div>`;
  }

  document.addEventListener('click', ev => {
    const b = ev.target.closest?.('[data-sector-frame]'); if (!b) return;
    state.frame = b.dataset.sectorFrame;
    if (typeof render === 'function') render();
  });
  window.addEventListener('hashchange', () => { if (location.hash.startsWith('#/sectors') && Date.now() - state.at > 60000) load(); });
  setInterval(() => { if (location.hash.startsWith('#/sectors')) load(); }, 60000);
  window.fryePages = { ...(window.fryePages || {}), sectors: page };
})();
