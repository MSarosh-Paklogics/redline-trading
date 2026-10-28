'use strict';
/* Redline backend adapter. Keeps canonical engine decisions on the server. */
(() => {
  const stored = (() => { try { return localStorage.getItem('redline-api-base') || ''; } catch { return ''; } })();
  const clean = value => String(value || '').trim().replace(/\/+$/, '');
  const queryBase = (() => { try { return new URLSearchParams(location.search).get('api') || ''; } catch { return ''; } })();
  const base = clean(window.REDLINE_API_BASE || queryBase || stored || 'https://frye-market-backend-1.onrender.com');
  const url = path => `${base}${String(path).startsWith('/') ? path : `/${path}`}`;
  async function request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout || 8000);
    try {
      const response = await fetch(url(path), { ...options, signal: controller.signal, headers: { Accept: 'application/json', ...(options.headers || {}) } });
      const text = await response.text();
      let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return { ok: true, data, status: response.status };
    } finally { clearTimeout(timer); }
  }
  const api = {
    base,
    enabled: Boolean(base),
    request,
    health: () => request('/api/health'),
    snapshot: (symbol = 'ES') => request(`/api/v1/dashboard-snapshot?symbol=${encodeURIComponent(symbol)}&includeContext=1`),
    marketMeter: (symbol = 'ES') => request(`/api/v1/futures/market-meter?symbol=${encodeURIComponent(symbol)}`),
    ohlc: (symbol = 'ES', timeframe = '10m', limit = 500) => request(`/api/v1/futures/ohlc?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&limit=${limit}`),
    sectors: () => request('/api/sectorcards-10m'),
    journal: () => request('/api/v1/trade-journal'),
    positions: () => request('/api/trading/positions'),
    orders: () => request('/api/trading/orders'),
    executions: () => request('/api/trading/executions'),
    fibLevels: (symbol='ES', tf='1h') => request(`/api/v1/fib-levels?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}`),
    activeWaves: (symbol='ES') => request(`/api/v1/waves/active?symbol=${encodeURIComponent(symbol)}`),
    reactionQuality: (symbol='ES') => request(`/api/v1/reaction-quality?symbol=${encodeURIComponent(symbol)}`),
    strategyState: (symbol='ES') => request(`/api/v1/strategy-state?symbol=${encodeURIComponent(symbol)}`),
    tradePermission: (symbol='ES') => request(`/api/v1/trade-permission?symbol=${encodeURIComponent(symbol)}`),
    engine25: (symbol='ES') => request(`/api/v1/engine25/full-dashboard?symbol=${encodeURIComponent(symbol)}`),
    engine25Composite: (symbol='ES') => request(`/api/v1/engine25/composite-overlay-6mo?symbol=${encodeURIComponent(symbol)}`),
    engine29: (symbol='ES') => request(`/api/v1/engine29/cross-market-stress?symbol=${encodeURIComponent(symbol)}`),
    engine29Summary: (symbol='ES') => request(`/api/v1/engine29/cross-market-stress/summary?symbol=${encodeURIComponent(symbol)}`),
    alerts: () => request('/api/v1/alerts'),
    chartOverlay: (symbol='ES') => request(`/api/v1/chart-overlay?symbol=${encodeURIComponent(symbol)}`),
    morningFib: (symbol='ES') => request(`/api/v1/morning-fib?symbol=${encodeURIComponent(symbol)}`),
    replayDates: () => request('/api/v1/replay/dates'),
    gauges: (index='ES') => request(`/api/v1/gauges?index=${encodeURIComponent(index)}`),
    status: async () => { if (!base) return { configured: false, reachable: false, reason: 'No backend URL configured' }; try { const result = await api.health(); return { configured: true, reachable: true, result }; } catch (error) { return { configured: true, reachable: false, reason: error.message }; } }
  };
  window.redlineApi = api;
})();





