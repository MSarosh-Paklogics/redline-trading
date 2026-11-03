'use strict';
/* Live Engine 25 Market X-Ray + Engine 29 model for Redline's own first-page UI
   (the corsa.js hero, speedometer gauges and stat cards read window.redlineXray.model).
   Sources and display math mirror the client's Frye home page
   (Frye-Dashboard src/pages/engine25/Engine25MarketXrayPreview.jsx). Values are read
   from the backend; the only arithmetic is what that Frye page itself does for display
   (hourly sector totals, strong/weak sector counts, broader-market blend and the
   65/20/15 permission read), copied as-is and marked MIRRORED. */
(() => {
  const n = v => { const x = Number(v); return v == null || v === '' || !Number.isFinite(x) ? null : x; };

  function dataStatus(freshness) {
    const intraday = freshness?.intraday || {};
    const state = String(intraday.state || freshness?.state || (intraday.fresh === true ? 'FRESH' : '')).toUpperCase();
    if (state === 'FRESH') return 'LIVE';
    if (state === 'LAST_VALID_EQUITY_READ') return 'LAST VALID EQUITY READ';
    if (state.includes('STALE')) return 'STALE';
    if (!state || state === 'UNAVAILABLE' || state.includes('MISSING') || state.includes('INVALID')) return 'UNAVAILABLE';
    if (state === 'INSUFFICIENT_VOLUME_COVERAGE') return 'DEGRADED';
    return state.replace(/_/g, ' ');
  }

  // MIRRORED from Engine25MarketXrayPreview tradePermissionRead (65/20/15 thresholds).
  function permissionRead(x) {
    if (x == null) return ['WAITING FOR EOD SHADOW', 'NO DECISION SCORE YET'];
    if (x >= 65) return ['LONG BIAS', 'NORMAL LONG PERMISSION'];
    if (x >= 55) return ['LONG ALLOWED — REDUCED SIZE', 'NO AGGRESSIVE SIZE-UP'];
    if (x >= 50) return ['NEUTRAL / WAIT', 'DO NOT SIZE UP'];
    if (x >= 45) return ['AVOID NEW LONGS / SHORT WATCH', 'NO SIZE-UP LONG'];
    if (x >= 35) return ['BEARISH / SHORTS FAVORED', 'DEFENSIVE'];
    return ['STRONG DEFENSIVE / BEARISH', 'NO NORMAL LONGS'];
  }

  function buildModel(e25, meter, hourly, eod, e29) {
    const headline = e25?.headline || {};
    const artifact = e25?.participationArtifact || {};
    const part = artifact.participation || {};
    const dist = part.distributionPressure || {};

    // Hourly sector totals (MIRRORED): only used when all 11 cards are under 90 minutes old.
    const cards = Array.isArray(hourly?.sectorCards) ? hourly.sectorCards : [];
    const hourlyTs = Date.parse(hourly?.updated_at_utc || hourly?.meta?.ts_utc || '');
    const hourlyFresh = cards.length === 11 && Number.isFinite(hourlyTs) && Date.now() - hourlyTs <= 90 * 60 * 1000;
    const sum = k => cards.reduce((a, c) => a + (n(c[k]) ?? 0), 0);
    const up = hourlyFresh ? sum('up') : null, down = hourlyFresh ? sum('down') : null;
    const advVol = hourlyFresh ? sum('advancingVolume') : null, decVol = hourlyFresh ? sum('decliningVolume') : null;
    const scanned = hourlyFresh ? sum('stocksScanned') : null, withVol = hourlyFresh ? sum('stocksWithVolume') : null;
    const buyBreadth = up != null && up + down > 0 ? up / (up + down) * 100 : null;
    const buyVolume = advVol != null && advVol + decVol > 0 ? advVol / (advVol + decVol) * 100 : null;
    const states = hourlyFresh ? cards.map(c => { const b = n(c.breadth_pct), m = n(c.momentum_pct); return b == null || m == null ? 'UNAVAILABLE' : b >= 55 && m >= 55 ? 'STRONG' : b <= 45 && m <= 45 ? 'WEAK' : 'NEUTRAL'; }) : [];
    const count = s => hourlyFresh ? states.filter(x => x === s).length : null;
    const sectors = { strong: count('STRONG'), weak: count('WEAK'), neutral: count('NEUTRAL') };
    const sectorScore = hourlyFresh ? ((sectors.strong - sectors.weak) / 11 + 1) * 50 : null;
    const broader = buyBreadth == null || sectorScore == null || buyVolume == null ? null : buyBreadth * 0.60 + sectorScore * 0.25 + buyVolume * 0.15;

    // 65/20/15 permission read (MIRRORED): ES master, 4H light, reconstructed EOD shadow.
    const master = n(meter?.master?.score), m4h = n(meter?.lights?.['4h']?.score), recon = n(eod?.score);
    const permScore = master != null && m4h != null && recon != null ? 0.65 * master + 0.20 * m4h + 0.15 * recon : null;
    const [permLabel, permSizing] = permissionRead(permScore);

    return {
      at: Date.now(),
      sources: { e25: Boolean(e25), meter: Boolean(meter), hourly: Boolean(hourly), eod: Boolean(eod), e29: Boolean(e29) },
      generatedAt: artifact.generatedAt || e25?.generatedAtUtc || null,
      dataStatus: e25 ? dataStatus(artifact.freshness) : 'UNAVAILABLE',
      headline, deskNote: e25?.deskNote || null, brief: e25?.redlineCurrentMarketBrief || null,
      breadthLabel: part.breadth?.label || null,
      distribution: { raw: n(dist.rawPressure), label: dist.pressureLabel || dist.label || null, integrated: dist.integratedState || null },
      macro: { score: n(e25?.macroPressure?.score), label: e25?.macroPressure?.label || null },
      credit: { label: e25?.creditStressDetail?.displayLabel || null, scores: e25?.creditStressDetail?.scores || {} },
      nhnl: part.newHighsNewLows || {},
      hourly: { fresh: hourlyFresh, updatedAt: hourly?.updated_at_utc || null, up, down, advVol, decVol, scanned, withVol, buyBreadth, buyVolume, coverage: scanned > 0 ? withVol / scanned * 100 : null },
      sectors, broader,
      meter: meter ? { master, masterState: meter.master?.state || null, lights: meter.lights || {}, updatedAt: meter.updated_at_utc || null } : null,
      eod: eod ? { score: recon, state: eod.state || null } : null,
      permission: { score: permScore, label: permLabel, sizing: permSizing, master, m4h, recon },
      e29: e29?.data ? { ...e29.data, servedAt: e29.servedAt } : null
    };
  }

  const xray = window.redlineXray = { model: null, loading: null };
  xray.load = () => {
    if (!window.redlineApi) return Promise.resolve(null);
    if (xray.loading) return xray.loading;
    const api = window.redlineApi;
    xray.loading = Promise.allSettled([api.engine25(), api.marketMeter('ES'), api.hourlySectors(), api.eodShadow(), api.engine29Summary()])
      .then(rs => {
        const [e25, meter, hourly, eod, e29] = rs.map(r => r.status === 'fulfilled' ? r.value.data : null);
        xray.model = e25 || meter || e29 ? buildModel(e25, meter, hourly, eod, e29) : null;
        // Re-render the first page / meters so the existing UI picks up the new values.
        if (typeof render === 'function' && /^#\/(overview|meters)?($|\?)/.test(location.hash || '#/')) render();
        return xray.model;
      })
      .finally(() => { xray.loading = null; });
    return xray.loading;
  };
  setTimeout(xray.load, 100);
  setInterval(xray.load, 60000);
})();
