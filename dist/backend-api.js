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
  const api = {
    base,
    enabled: Boolean(base),
    request,
    health: () => request('/api/health'),
    snapshot: (symbol = 'ES') => request(`/api/v1/dashboard-snapshot?symbol=${q(symbol)}&includeContext=1`),
    marketMeter: (symbol = 'ES') => request(`/api/v1/futures/market-meter?symbol=${q(symbol)}`),
    futuresOhlc: (symbol = 'ES', timeframe = '10m', limit = 500) => request(`/api/v1/futures/ohlc?symbol=${q(symbol)}&timeframe=${q(timeframe)}&limit=${limit}`),
    ohlc: (symbol = 'SPY', timeframe = '10m', limit = 500) => request(`/api/v1/ohlc?symbol=${q(symbol)}&timeframe=${q(timeframe)}&limit=${limit}`),
    sectors: () => request('/api/sectorcards-10m'),
    journal: () => request('/api/v1/trade-journal'),
    fibLevels: (symbol = 'ES', tf = '1h') => request(`/api/v1/fib-levels?symbol=${q(symbol)}&tf=${q(tf)}`),
    activeWaves: (symbol = 'ES') => request(`/api/v1/waves/active?symbol=${q(symbol)}`),
    engine3: (symbol = 'ES', tf = '10m') => request(`/api/v1/es-reaction-score?symbol=${q(symbol)}&tf=${q(tf)}`),
    engine4: (symbol = 'ES', tf = '10m') => request(`/api/v1/es-volume-behavior?symbol=${q(symbol)}&tf=${q(tf)}`),
    engine25: () => request('/api/v1/engine25/full-dashboard'),
    engine25Summary: () => request('/api/v1/engine25/market-health/summary'),
    engine25Composite: () => request('/api/v1/engine25/composite-overlay-6mo'),
    engine29: () => request('/api/v1/engine29/cross-market-stress'),
    engine29Summary: () => request('/api/v1/engine29/cross-market-stress/summary'),
    chartOverlay: (symbol = 'ES', tf = '10m') => request(`/api/v1/chart-overlay?symbol=${q(symbol)}&tf=${q(tf)}`),
    morningFib: (symbol = 'ES', tf = '30m') => request(`/api/v1/morning-fib?symbol=${q(symbol)}&tf=${q(tf)}`),
    replayDates: () => request('/api/v1/replay/dates'),
    status: async () => { if (!base) return { configured: false, reachable: false, reason: 'No backend URL configured' }; try { const result = await api.health(); return { configured: true, reachable: true, result }; } catch (error) { return { configured: true, reachable: false, reason: error.message }; } }
  };
  window.redlineApi = api;
})();
