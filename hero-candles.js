'use strict';
/* Live ES candlestick backdrop for the dashboard hero (presentation layer).
   Draws the last 10-minute ES bars behind the "PRECISION" panel and keeps them moving with the
   market: the newest candle, its wick and the price line update in place as ES ticks
   (Backend 2 SSE /stream/futures/agg, same-origin proxy as live-stream.js; 5 s Backend 1 poll
   when the stream is quiet), and when a new 10m bar opens the set slides left by one candle.
   Real bars only: if none are available nothing is drawn. Display only; no signal or order logic. */
(() => {
  if (typeof raceHero !== 'function') return;
  const COUNT = 64, POLL_MS = 5000, QUIET_MS = 15000, RELOAD_MS = 60000;
  const W = 600, H = 200, PAD_T = 14, PAD_B = 20;
  const s = { bars: null, loading: false, grown: false, page: null, es: null, contract: null, lastTick: 0, polling: false, geo: null };

  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches || (typeof state !== 'undefined' && state.settings?.reduced);
  const toSec = t => { const x = Number(t); return !Number.isFinite(x) ? null : x > 1e12 ? Math.floor(x / 1000) : x; };
  const norm = b => { const o = Number(b.o ?? b.open), h = Number(b.h ?? b.high), l = Number(b.l ?? b.low), c = Number(b.c ?? b.close); return [o, h, l, c].every(Number.isFinite) ? { t: toSec(b.t ?? b.time ?? b.ts ?? b.timestamp), o, h, l, c } : null; };
  const heroVisible = () => !!document.querySelector('.race-hero') && !document.hidden;

  /* ---------- drawing ---------- */
  function geometry(bars) {
    const hi = Math.max(...bars.map(b => b.h)), lo = Math.min(...bars.map(b => b.l)), span = hi - lo || 1;
    const step = W / bars.length;
    return { hi, lo, step, bw: Math.max(2, step * 0.56), y: v => PAD_T + (hi - v) / span * (H - PAD_T - PAD_B) };
  }

  function candle(b, i, g, last) {
    const x = i * g.step + g.step / 2, top = g.y(Math.max(b.o, b.c)), h = Math.max(1.2, Math.abs(g.y(b.o) - g.y(b.c)));
    return `<g class="hc-c ${b.c >= b.o ? 'up' : 'dn'}${last ? ' last' : ''}" style="--i:${i}"><line x1="${x}" x2="${x}" y1="${g.y(b.h)}" y2="${g.y(b.l)}"/><rect x="${x - g.bw / 2}" y="${top}" width="${g.bw}" height="${h}" rx="0.6" style="y:${top}px;height:${h}px"/></g>`;
  }

  function svg(bars, mode) {
    if (bars.length < 10) return '';
    const g = s.geo = geometry(bars), py = g.y(bars.at(-1).c);
    return `<svg class="hc-svg${mode ? ' hc-' + mode : ''}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" style="--hc-step-px:${g.step.toFixed(3)}px">
      <defs><linearGradient id="hc-fade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ed1c24" stop-opacity=".18"/><stop offset="1" stop-color="#ed1c24" stop-opacity="0"/></linearGradient></defs>
      ${[0.25, 0.5, 0.75].map(f => `<line class="hc-grid" x1="0" x2="${W}" y1="${PAD_T + f * (H - PAD_T - PAD_B)}" y2="${PAD_T + f * (H - PAD_T - PAD_B)}"/>`).join('')}
      <g class="hc-track"><polygon class="hc-area" fill="url(#hc-fade)" points="${bars.map((b, i) => `${i * g.step + g.step / 2},${g.y(b.c)}`).join(' ')} ${W - g.step / 2},${H} ${g.step / 2},${H}"/>
      ${bars.map((b, i) => candle(b, i, g, i === bars.length - 1)).join('')}</g>
      <line class="hc-price" x1="0" x2="${W}" y1="${py}" y2="${py}" style="transform:translateY(0)"/>
    </svg>`;
  }

  const layer = mode => { const body = svg(view(), mode); return body ? `<div class="hero-candles" aria-hidden="true">${body}<span class="hc-tag"><i></i>ES 10m · LIVE</span></div>` : ''; };
  const view = () => (s.bars || []).slice(-COUNT);

  function swap(mode) {
    const hero = document.querySelector('.race-hero'); if (!hero) return;
    const fresh = layer(reduce() ? '' : mode); if (!fresh) return;
    const old = hero.querySelector('.hero-candles');
    if (old) old.outerHTML = fresh; else hero.insertAdjacentHTML('afterbegin', fresh);
    s.grown = true;
  }

  // Same bar ticked: move only the newest candle, its wick and the price line (CSS transitions do the motion).
  function patchLast() {
    const bars = view(), b = bars.at(-1), g = s.geo;
    const node = document.querySelector('.hero-candles .hc-c.last');
    if (!b || !g || !node) return swap('');
    if (b.h > g.hi || b.l < g.lo) return swap('');           // price left the drawn range: rescale
    const top = g.y(Math.max(b.o, b.c)), h = Math.max(1.2, Math.abs(g.y(b.o) - g.y(b.c)));
    const rect = node.querySelector('rect'), wick = node.querySelector('line');
    rect.style.y = `${top}px`; rect.style.height = `${h}px`;
    wick.setAttribute('y1', g.y(b.h)); wick.setAttribute('y2', g.y(b.l));
    node.classList.toggle('up', b.c >= b.o); node.classList.toggle('dn', b.c < b.o);
    const price = document.querySelector('.hero-candles .hc-price');
    if (price) { const base = Number(price.getAttribute('y1')); price.style.transform = `translateY(${g.y(b.c) - base}px)`; }
    node.classList.remove('hc-tick'); void node.getBBox?.(); node.classList.add('hc-tick');
  }

  /* ---------- data ---------- */
  function merge(raw) {
    const b = norm(raw); if (!b || !s.bars?.length) return null;
    const last = s.bars.at(-1);
    if (last.t == null || b.t === last.t) {
      s.bars[s.bars.length - 1] = { ...last, t: last.t ?? b.t, h: Math.max(last.h, b.h), l: Math.min(last.l, b.l), c: b.c };
      return 'tick';
    }
    if (b.t > last.t) { s.bars.push(b); if (s.bars.length > COUNT * 2) s.bars.shift(); return 'new'; }
    return null;
  }
  function apply(raw) {
    const kind = merge(raw); if (!kind || !heroVisible()) return;
    if (kind === 'new') swap('shift'); else patchLast();
  }

  async function load() {
    if (s.loading || !window.redlineApi?.futuresOhlc) return;
    s.loading = true;
    try {
      const r = await window.redlineApi.futuresOhlc('ES', '10m', COUNT);
      const bars = Array.isArray(r?.data) ? r.data.map(norm).filter(Boolean) : [];
      if (bars.length) { const first = !s.bars; s.bars = bars; if (heroVisible()) swap(first && !s.grown ? 'grow' : ''); }
    } catch { /* keep the last bars */ }
    s.loading = false;
  }

  async function poll() {
    if (!heroVisible() || s.polling || !s.bars || Date.now() - s.lastTick < QUIET_MS) return;
    s.polling = true;
    try { const r = await window.redlineApi.futuresOhlc('ES', '10m', 3); (Array.isArray(r?.data) ? r.data : []).forEach(apply); } catch { /* next poll */ }
    s.polling = false;
  }

  function stream(on) {
    if (!on) { if (s.es) { s.es.close(); s.es = null; s.contract = null; } return; }
    if (s.es || typeof EventSource === 'undefined') return;
    const base = String(window.REDLINE_STREAM_BASE ?? '').replace(/\/+$/, '');
    const es = s.es = new EventSource(`${base}/stream/futures/agg?symbol=ES&tf=10m&mode=eth`);
    es.onmessage = ev => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg?.type !== 'bar' || !msg.bar || s.es !== es) return;
      const contract = msg.resolvedSymbol || msg.bar.sourceContract || null;
      if (contract && s.contract && contract !== s.contract) return;   // ignore a different physical contract
      if (contract) s.contract = contract;
      s.lastTick = Date.now();
      apply(msg.bar);
    };
  }

  /* ---------- hook into the hero ---------- */
  const base = raceHero;
  raceHero = function () {
    const html = base.apply(this, arguments);
    const pg = typeof page !== 'undefined' ? page : location.hash;
    if (pg !== s.page) { s.page = pg; s.grown = false; }
    const bg = s.bars ? layer(!s.grown && !reduce() ? 'grow' : '') : '';
    if (bg) s.grown = true; else if (!s.loading) setTimeout(load, 0);
    return html.replace(/(<section class="race-hero[^"]*">)/, `$1${bg}`);
  };

  setInterval(() => stream(heroVisible()), 1000);
  setInterval(poll, POLL_MS);
  setInterval(() => { if (heroVisible()) load(); }, RELOAD_MS);
  if (document.querySelector('.race-hero')) load();
  window.redlineHeroCandles = s;
})();
