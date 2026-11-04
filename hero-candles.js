'use strict';
/* Live ES candlestick backdrop for the dashboard hero (presentation layer).
   Draws the last 10-minute ES bars from the live bar cache or /api/v1/futures/ohlc behind the
   "PRECISION" panel, faded so the copy stays readable. Real bars only: if none are available
   nothing is drawn (no decorative fake candles). Display only; no signal or order logic. */
(() => {
  if (typeof raceHero !== 'function') return;
  const KEY = 'ES:10m', COUNT = 64, REFRESH_MS = 60000;
  const s = { bars: null, at: 0, loading: false, grown: false, page: null };

  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches || (typeof state !== 'undefined' && state.settings?.reduced);
  const norm = b => { const o = Number(b.o ?? b.open), h = Number(b.h ?? b.high), l = Number(b.l ?? b.low), c = Number(b.c ?? b.close); return [o, h, l, c].every(Number.isFinite) ? { o, h, l, c } : null; };

  function current() {
    const live = window.redlineLiveBars?.[KEY];
    const src = Array.isArray(live) && live.length >= 20 ? live : s.bars;
    return Array.isArray(src) ? src.map(norm).filter(Boolean).slice(-COUNT) : [];
  }

  function svg(bars, grow) {
    if (bars.length < 10) return '';
    const W = 600, H = 200, padT = 14, padB = 20;
    const hi = Math.max(...bars.map(b => b.h)), lo = Math.min(...bars.map(b => b.l)), span = hi - lo || 1;
    const y = v => padT + (hi - v) / span * (H - padT - padB);
    const step = W / bars.length, bw = Math.max(2, step * 0.56);
    const last = bars.at(-1);
    const candles = bars.map((b, i) => {
      const x = i * step + step / 2, up = b.c >= b.o, top = y(Math.max(b.o, b.c)), h = Math.max(1.2, Math.abs(y(b.o) - y(b.c)));
      const cls = `hc-c ${up ? 'up' : 'dn'}${i === bars.length - 1 ? ' last' : ''}`;
      return `<g class="${cls}" style="--i:${i}"><line x1="${x}" x2="${x}" y1="${y(b.h)}" y2="${y(b.l)}"/><rect x="${x - bw / 2}" y="${top}" width="${bw}" height="${h}" rx="0.6"/></g>`;
    }).join('');
    const py = y(last.c);
    return `<svg class="hc-svg${grow ? ' hc-grow' : ''}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="hc-fade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ed1c24" stop-opacity=".18"/><stop offset="1" stop-color="#ed1c24" stop-opacity="0"/></linearGradient></defs>
      ${[0.25, 0.5, 0.75].map(f => `<line class="hc-grid" x1="0" x2="${W}" y1="${padT + f * (H - padT - padB)}" y2="${padT + f * (H - padT - padB)}"/>`).join('')}
      <polygon class="hc-area" fill="url(#hc-fade)" points="${bars.map((b, i) => `${i * step + step / 2},${y(b.c)}`).join(' ')} ${W - step / 2},${H} ${step / 2},${H}"/>
      ${candles}
      <line class="hc-price" x1="0" x2="${W}" y1="${py}" y2="${py}"/>
    </svg>`;
  }

  function layer(grow) {
    const bars = current();
    const body = svg(bars, grow);
    if (!body) return '';
    return `<div class="hero-candles" aria-hidden="true">${body}<span class="hc-tag"><i></i>ES 10m · LIVE</span></div>`;
  }

  async function load() {
    if (s.loading || !window.redlineApi?.futuresOhlc) return;
    s.loading = true;
    try {
      const r = await window.redlineApi.futuresOhlc('ES', '10m', COUNT);
      if (Array.isArray(r?.data) && r.data.length) { s.bars = r.data; s.at = Date.now(); }
    } catch { /* keep the last bars */ }
    s.loading = false;
    // Swap only the backdrop so the page doesn't re-render or replay animations.
    const hero = document.querySelector('.race-hero');
    if (!hero) return;
    const old = hero.querySelector('.hero-candles');
    const fresh = layer(!s.grown && !reduce());
    if (fresh) { if (old) old.outerHTML = fresh; else hero.insertAdjacentHTML('afterbegin', fresh); s.grown = true; }
  }

  const base = raceHero;
  raceHero = function () {
    const html = base.apply(this, arguments);
    const pg = typeof page !== 'undefined' ? page : location.hash;
    if (pg !== s.page) { s.page = pg; s.grown = false; }
    const bg = layer(!s.grown && !reduce());
    if (bg) s.grown = true;
    else if (!s.bars && !s.loading) setTimeout(load, 0);
    return html.replace(/(<section class="race-hero[^"]*">)/, `$1${bg}`);
  };

  setInterval(() => { if (document.querySelector('.race-hero') && !document.hidden) load(); }, REFRESH_MS);
  if (document.querySelector('.race-hero')) load();
})();
