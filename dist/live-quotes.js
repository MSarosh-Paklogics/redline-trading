'use strict';
/* Live last price and daily change for every symbol in Redline's market list
   (search, watchlist, ticker). Last price = close of the latest 10m bar; change is
   measured against the close of the last daily bar from an earlier session. Reads
   /api/v1/ohlc (equities) or /api/v1/futures/ohlc (ES/MES) a few symbols at a time,
   because the backend returns 502s under a burst of parallel requests. Results are
   written into the app.js `symbols` entries [name, label, price, changePct]; symbols
   whose read fails keep their demo values. */
(() => {
  const FUTURES = new Set(['ES', 'MES']);
  const BATCH = 3;
  const etDate = sec => new Date(sec * 1000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  let busy = false;

  async function read(s) {
    const api = window.redlineApi, get = FUTURES.has(s) ? api.futuresOhlc : api.ohlc;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const [intraday, daily] = await Promise.all([get(s, '10m', 1), get(s, '1d', 3)]);
        const bar = Array.isArray(intraday.data) ? intraday.data.at(-1) : null;
        const last = Number(bar?.close);
        if (!Number.isFinite(last)) return null;
        const today = etDate(bar.time);
        const days = Array.isArray(daily.data) ? daily.data : [];
        // Futures daily bars are stamped with the Globex open (previous evening ET), so the
        // current session is always the last bar; equities may not have today's bar yet.
        const prior = FUTURES.has(s) ? days.at(-2) : days.filter(d => etDate(d.time) < today).at(-1);
        const prev = Number(prior?.close);
        return { last, change: Number.isFinite(prev) && prev ? (last - prev) / prev * 100 : null };
      } catch { /* retry once */ }
    }
    return null;
  }

  async function refresh() {
    if (busy || !window.redlineApi || typeof symbols === 'undefined') return;
    busy = true;
    try {
      let updated = 0;
      for (let i = 0; i < symbols.length; i += BATCH) {
        const batch = symbols.slice(i, i + BATCH);
        const quotes = await Promise.all(batch.map(([s]) => read(s)));
        quotes.forEach((q, j) => {
          if (!q) return;
          batch[j][2] = q.last;
          if (q.change != null) batch[j][3] = Number(q.change.toFixed(2));
          updated++;
        });
      }
      if (updated) {
        window.redlineQuotesLive = true;
        // Re-render so the ticker, watchlist and overview pick up the live quotes.
        if (typeof render === 'function' && !document.querySelector('#modal[open]')) render();
      }
    } finally { busy = false; }
  }

  setTimeout(refresh, 300);
  setInterval(refresh, 60000);
})();
