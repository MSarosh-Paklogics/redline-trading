'use strict';
/* Moves the chart in real time, like the Frye chart: subscribes to Backend 2 SSE bars
   (/stream/futures/agg for ES/MES with mode=eth, /stream/agg for equities with mode=rth,
   per Frye ohlcClient.js) and merges them into the live bar cache app.js draws from.
   Backend 2 only allows Frye's own origins, so the stream is requested same-origin
   (/stream/...) and proxied by server.mjs locally and by the Vercel rewrite in production.
   If no stream bar arrives, the latest bars are polled from Backend 1 every 5 seconds.
   Only `type:"bar"` events touch candles; bars from a different physical contract are ignored. */
(() => {
  const FUTURES = new Set(['ES', 'MES']);
  const STREAM_TF = new Set(['1m', '5m', '10m', '15m', '1h', '4h']);
  const POLL_MS = 5000, QUIET_MS = 15000;
  const base = (() => { try { return String(window.REDLINE_STREAM_BASE ?? '').replace(/\/+$/, ''); } catch { return ''; } })();
  const s = { key: null, es: null, contract: null, lastBarAt: 0, dirty: false, polling: false };

  const onChart = () => location.hash.startsWith('#/chart');
  const current = () => (typeof symbol !== 'undefined' && typeof tf !== 'undefined') ? { sym: symbol, frame: tf, key: `${symbol}:${tf}` } : null;
  const toSec = t => { const x = Number(t); return !Number.isFinite(x) ? null : x > 1e12 ? Math.floor(x / 1000) : x; };

  function applyBar(key, raw) {
    const arr = window.redlineLiveBars?.[key];
    if (!arr?.length) return;
    const t = toSec(raw.time ?? raw.t ?? raw.ts ?? raw.timestamp);
    const o = Number(raw.open ?? raw.o), h = Number(raw.high ?? raw.h), l = Number(raw.low ?? raw.l), c = Number(raw.close ?? raw.c), v = Number(raw.volume ?? raw.v ?? 0);
    if (t == null || ![o, h, l, c].every(Number.isFinite)) return;
    const last = arr.at(-1);
    if (last.t == null || t === last.t) {
      // Same candle: the stream may have joined mid-bar, so keep the REST open and widen the range.
      arr[arr.length - 1] = { ...last, t: last.t ?? t, h: Math.max(last.h, h), l: Math.min(last.l, l), c, v: Math.max(last.v || 0, v) };
    } else if (t > last.t) {
      arr.push({ t, o, h, l, c, v });
      if (typeof chartOffset !== 'undefined' && chartOffset > 0 && key === `${symbol}:${tf}`) chartOffset++;
      if (arr.length > 1000) arr.shift();
    } else return;
    s.dirty = true;
  }

  function stop() {
    if (s.es) { s.es.close(); s.es = null; }
    s.key = null; s.contract = null;
  }

  function connect(cur) {
    stop();
    s.key = cur.key; s.lastBarAt = 0;
    if (!STREAM_TF.has(cur.frame) || typeof EventSource === 'undefined') return;
    const fut = FUTURES.has(cur.sym);
    const url = `${base}${fut ? '/stream/futures/agg' : '/stream/agg'}?symbol=${encodeURIComponent(cur.sym)}&tf=${encodeURIComponent(cur.frame)}&mode=${fut ? 'eth' : 'rth'}`;
    const es = new EventSource(url);
    es.onmessage = ev => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg?.type !== 'bar' || !msg.bar || s.es !== es) return;
      const contract = msg.resolvedSymbol || msg.bar.sourceContract || null;
      if (contract && s.contract && contract !== s.contract) return;
      if (contract) s.contract = contract;
      s.lastBarAt = Date.now();
      applyBar(cur.key, msg.bar);
    };
    s.es = es;
  }

  async function poll() {
    const cur = current();
    if (!onChart() || !cur || s.polling || !window.redlineApi || Date.now() - s.lastBarAt < QUIET_MS) return;
    s.polling = true;
    try {
      const api = window.redlineApi;
      const r = await (FUTURES.has(cur.sym) ? api.futuresOhlc(cur.sym, cur.frame, 3) : api.ohlc(cur.sym, cur.frame, 3));
      if (current()?.key === cur.key && Array.isArray(r.data)) r.data.forEach(b => applyBar(cur.key, b));
    } catch { /* keep the last drawn candles */ } finally { s.polling = false; }
  }

  // Redraw only the chart SVG and the OHLC readout, at most once a second.
  function redraw() {
    if (!s.dirty || !onChart() || typeof chartSVG !== 'function') return;
    s.dirty = false;
    const svg = document.querySelector('.chart-frame > svg');
    if (!svg) return;
    svg.outerHTML = chartSVG();
    const cur = current(), last = cur && window.redlineLiveBars?.[cur.key]?.at(-1);
    const info = document.querySelector('.terminal-ohlc');
    if (info && last) info.textContent = `O ${last.o.toFixed(2)}   H ${last.h.toFixed(2)}   L ${last.l.toFixed(2)}   C ${last.c.toFixed(2)}`;
  }

  setInterval(() => {
    const cur = current();
    if (!onChart() || !cur) { if (s.key) stop(); return; }
    if (cur.key !== s.key) connect(cur);
  }, 500);
  setInterval(poll, POLL_MS);
  setInterval(redraw, 1000);
  window.redlineStream = s;
})();
