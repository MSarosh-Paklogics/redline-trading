'use strict';
/* Redline backend adapter. Read-only: keeps canonical engine decisions on the server.
   Only mounted GET read routes belong here. Never add admin/refresh/write routes,
   /api/trading/*, engine26 manual-hard-signal, or the compute-on-request
   trade-permission routes (they fabricate a decision from default inputs). */
(() => {
  const stored = (() => { try { return localStorage.getItem('redline-api-base') || ''; } catch { return ''; } })();
  const clean = value => String(value || '').trim().replace(/\/+$/, '');
  const queryBase = (() => { try { return new URLSearchParams(location.search).get('api') || ''; } catch { return ''; } })();
  const base = clean(window.REDLINE_API_BASE || queryBase || stored || 'https://frye-market-backend-1.onrender.com');
  const url = path => `${base}${String(path).startsWith('/') ? path : `/${path}`}`;
  const q = encodeURIComponent;
  async function request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout || 8000);
    try {
      const response = await fetch(url(path), { ...options, signal: controller.signal, headers: { Accept: 'application/json', ...(options.headers || {}) } });
      const text = await response.text();
      let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      // Some routes answer HTTP 200 with ok:false; that is unavailable data, not a result.
      if (data && typeof data === 'object' && !Array.isArray(data) && data.ok === false) throw new Error(data.error || 'Backend returned ok:false');
      return { ok: true, data, status: response.status };
    } finally { clearTimeout(timer); }
  }
  // dashboard-snapshot is ~18 MB, so every page shares one request per symbol per minute.
  const snapshotCache = {};
  const snapshotShared = (symbol = 'ES', maxAgeMs = 60000) => {
    const hit = snapshotCache[symbol];
    if (hit && Date.now() - hit.at < maxAgeMs) return hit.promise;
    const promise = request(`/api/v1/dashboard-snapshot?symbol=${q(symbol)}`, { timeout: 45000 });
    snapshotCache[symbol] = { at: Date.now(), promise };
    promise.catch(() => { if (snapshotCache[symbol]?.promise === promise) delete snapshotCache[symbol]; });
    return promise;
  };
  const api = {
    base,
    snapshotShared,
    enabled: Boolean(base),
    request,
    health: () => request('/api/health'),
    snapshot: (symbol = 'ES') => request(`/api/v1/dashboard-snapshot?symbol=${q(symbol)}&includeContext=1`),
    marketMeter: (symbol = 'ES') => request(`/api/v1/futures/market-meter?symbol=${q(symbol)}`),
    futuresOhlc: (symbol = 'ES', timeframe = '10m', limit = 500) => request(`/api/v1/futures/ohlc?symbol=${q(symbol)}&timeframe=${q(timeframe)}&limit=${limit}`),
    ohlc: (symbol = 'SPY', timeframe = '10m', limit = 500) => request(`/api/v1/ohlc?symbol=${q(symbol)}&timeframe=${q(timeframe)}&limit=${limit}`),
    sectors: () => request('/api/sectorcards-10m'),
    // Paper trades only. Real-account journal data (Schwab positions, P&L, account masks) is not
    // read by Redline until the client approves who may see it; there is deliberately no route for it.
    paperJournal: () => request('/api/v1/trade-journal?accountMode=PAPER', { timeout: 20000 }),
    fibLevels: (symbol = 'ES', tf = '1h') => request(`/api/v1/fib-levels?symbol=${q(symbol)}&tf=${q(tf)}`),
    activeWaves: (symbol = 'ES') => request(`/api/v1/waves/active?symbol=${q(symbol)}`),
    engine3: (symbol = 'ES', tf = '10m') => request(`/api/v1/es-reaction-score?symbol=${q(symbol)}&tf=${q(tf)}`),
    engine4: (symbol = 'ES', tf = '10m') => request(`/api/v1/es-volume-behavior?symbol=${q(symbol)}&tf=${q(tf)}`),
    engine25: () => request('/api/v1/engine25/full-dashboard', { timeout: 30000 }),
    hourlySectors: () => request('/live/hourly'),
    spyIntraday: () => request('/live/intraday'),
    spy30m: () => request('/live/30m'),
    spy4h: () => request('/live/4h'),
    spyEod: () => request('/live/eod'),
    eodShadow: () => request('/live/eod-shadow'),
    engine25Summary: () => request('/api/v1/engine25/market-health/summary'),
    engine25Composite: () => request('/api/v1/engine25/composite-overlay-6mo'),
    engine29: () => request('/api/v1/engine29/cross-market-stress', { timeout: 30000 }),
    engine29Summary: () => request('/api/v1/engine29/cross-market-stress/summary'),
    esSmzLevels: () => request('/api/v1/es-smz-levels?symbol=ES'),
    esSmzShelves: () => request('/api/v1/es-smz-shelves?symbol=ES'),
    chartOverlay:(symbol = 'ES', tf = '10m') => request(`/api/v1/chart-overlay?symbol=${q(symbol)}&tf=${q(tf)}`),
    morningFib: (symbol = 'ES', tf = '30m') => request(`/api/v1/morning-fib?symbol=${q(symbol)}&tf=${q(tf)}`),
    replayDates: () => request('/api/v1/replay/dates'),
    status: async () => { if (!base) return { configured: false, reachable: false, reason: 'No backend URL configured' }; try { const result = await api.health(); return { configured: true, reachable: true, result }; } catch (error) { return { configured: true, reachable: false, reason: error.message }; } }
  };
  window.redlineApi = api;
})();
