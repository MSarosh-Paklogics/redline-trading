'use strict';
/* Redline backend adapter. Keeps canonical engine decisions on the server. */
(() => {
  const stored = (() => { try { return localStorage.getItem('redline-api-base') || ''; } catch { return ''; } })();
  const clean = value => String(value || '').trim().replace(/\/+$/, '');
  const base = clean(window.REDLINE_API_BASE || stored || '');
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
    status: async () => { if (!base) return { configured: false, reachable: false, reason: 'No backend URL configured' }; try { const result = await api.health(); return { configured: true, reachable: true, result }; } catch (error) { return { configured: true, reachable: false, reason: error.message }; } }
  };
  window.redlineApi = api;
})();
