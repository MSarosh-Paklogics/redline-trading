'use strict';
/* Market pulse (dashboard section, client request 2026-11-11): live % change per stock market with
   its direction read. Display only, never an order:
   - % change: live quote from the backend (redlineQuoteRead, 10m last vs prior daily close). A market
     whose read fails shows "—"; demo values are never used.
   - Index rows: the Engine 29 tactical (intraday) state for that market, grouped as BULLISH /
     BEARISH / NEUTRAL, with the raw Engine 29 state shown next to it. Engine 29 is market evidence;
     it never grants trade permission.
   - ES row: the Engine 17 bias (LONG / SHORT) and the Engine 6 permission, both straight from the
     backend. Engine 6 alone decides whether a trade is permitted. */
(() => {
  if (typeof overview !== 'function') return;
  // [shown symbol, name, Engine 29 key, backend quote symbol, raw]. Fixed list (client request
  // 2026-11-16): always shown, in this order. Indexes are read as I:SPX etc. CL1! has no backend
  // feed of its own, so its price comes from MCL (micro crude, same price as CL) and is labelled so.
  // raw = VIX, TLT, crude: a "breaking" state there is not a stock-market bull/bear call, so the
  // Engine 29 state is shown as published instead of being grouped.
  const MARKETS = [
    ['ES', 'S&P 500 futures', null, 'ES'],
    ['QQQ', 'Nasdaq 100 ETF', 'QQQ', 'QQQ'],
    ['SPX', 'S&P 500 index', 'SPX', 'I:SPX'],
    ['NDX', 'Nasdaq 100 index', 'NDX', 'I:NDX'],
    ['DOW', 'Dow Jones index', 'DJI', 'I:DJI'],
    ['IWM', 'Russell 2000 ETF', 'IWM', 'IWM'],
    ['MDY', 'S&P MidCap 400 ETF', 'MDY', 'MDY'],
    ['VIX', 'Volatility index', 'VIX', 'I:VIX', true],
    ['TLT', '20+ yr Treasury ETF', 'TLT', 'TLT', true],
    ['CL1!', 'Crude oil · MCL feed', 'WTI', 'MCL', true]
  ];
  const quotes = {};
  window.redlineMarketQuotes = quotes; // read by the hero callouts (corsa.js)
  let busy = false, loadedAt = null;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const L = v => v == null || v === '' ? 'UNAVAILABLE' : String(v).replace(/_/g, ' ').toUpperCase();

  // Groups Engine 29 state words into a direction; the raw state is always shown beside it.
  const dir = state => {
    const s = String(state || '');
    if (!s) return null;
    if (/WARNING|WEAK|SELL|BEAR|DOWN|BREAK|DETERIOR|STRESS|RISK.?OFF|DEFENSIVE|FAIL/i.test(s)) return 'BEARISH';
    if (/HEALTHY|RECOVER|BUY|STRONG|BULL|UP|IMPROV|RISK.?ON|CONFIRM/i.test(s)) return 'BULLISH';
    return 'NEUTRAL';
  };

  function row([sym, name, e29key, , raw]) {
    const q = quotes[sym], ch = q?.change;
    const pct = ch == null ? '—' : `${ch > 0 ? '+' : ''}${ch.toFixed(2)}%`;
    const pctTone = ch == null ? 'na' : ch > 0 ? 'up' : ch < 0 ? 'down' : 'flat';
    let signal, sub, tone;
    if (!e29key) {
      const cm = window.redlineChart?.model, bias = Object.fromEntries(cm?.pills || []).BIAS, e6 = cm?.e6?.permission;
      const b = /LONG/i.test(bias || '') ? 'LONG' : /SHORT/i.test(bias || '') ? 'SHORT' : bias ? 'NEUTRAL' : null;
      signal = b ? `${b} BIAS` : 'UNAVAILABLE';
      tone = b === 'LONG' ? 'up' : b === 'SHORT' ? 'down' : b ? 'yellow' : 'na';
      sub = `E17 bias · E6 ${L(e6)}`;
    } else {
      const st = window.redlineXray?.model?.e29?.symbols?.[e29key]?.tactical?.state;
      const d = raw ? (st ? L(st) : null) : dir(st);
      signal = d || 'UNAVAILABLE';
      tone = raw ? (d ? 'yellow' : 'na') : d === 'BULLISH' ? 'up' : d === 'BEARISH' ? 'down' : d ? 'yellow' : 'na';
      sub = raw ? 'E29 intraday state · as published' : `E29 intraday · ${L(st)}`;
    }
    return `<div class="mp-row"><div class="mp-name"><b>${esc(sym)}</b><small>${esc(name)}</small></div>
      <div class="mp-pct mp-${pctTone}">${pct}</div>
      <div class="mp-sig mp-${tone}"><b>${esc(signal)}</b><small>${esc(sub)}</small></div></div>`;
  }

  function inner() {
    const live = Object.keys(quotes).length;
    return `<div class="mp-grid">${MARKETS.map(row).join('')}</div>
      <p class="mp-note">${live ? `LIVE BACKEND · % vs prior close · updated ${new Date(loadedAt).toLocaleTimeString('en-US', { timeZone: 'America/Phoenix', hour: '2-digit', minute: '2-digit', hour12: false })} AZ` : 'Loading live quotes…'} · Direction reads are market evidence, not trade calls. Engine 6 alone permits a trade.</p>`;
  }
  const section = () => `<div class="race-section-label"><span>MARKET PULSE · STOCK MARKETS</span><small>% CHANGE · DIRECTION READ · LIVE BACKEND</small></div><section class="mp-panel" data-mp>${inner()}</section>`;

  async function refresh() {
    if (busy || typeof window.redlineQuoteRead !== 'function') return;
    busy = true;
    try {
      for (let i = 0; i < MARKETS.length; i += 3) {
        const batch = MARKETS.slice(i, i + 3);
        const res = await Promise.all(batch.map(m => window.redlineQuoteRead(m[3])));
        res.forEach((q, j) => { if (q) quotes[batch[j][0]] = q; else delete quotes[batch[j][0]]; });
      }
      loadedAt = Date.now();
      const el = document.querySelector('[data-mp]');
      if (el) el.innerHTML = inner();
    } finally { busy = false; }
  }

  const base = overview;
  overview = function () {
    const html = base.apply(this, arguments);
    const at = html.indexOf('<nav class="db-tabs"');
    return at < 0 ? html : html.slice(0, at) + section() + html.slice(at);
  };
  setTimeout(refresh, 800);
  setInterval(refresh, 60000);
  if (typeof page !== 'undefined' && page === 'overview' && typeof render === 'function') render();
})();
