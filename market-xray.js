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

  // SPY market meter (MIRRORED from Frye RowMarketOverview): live 10m/30m/1H/4H/EOD scores,
  // master = 20% 1H + 35% 4H + 45% EOD, re-weighted over the scores that are available.
  function spyMeter(i10, m30, h1, h4, eodLive) {
    const tf = {
      '10m': [n(i10?.intraday?.overall10m?.score ?? i10?.engineLights?.['10m']?.score), i10?.intraday?.overall10m?.state || i10?.engineLights?.['10m']?.state],
      '30m': [n(m30?.thirtyMin?.overall30m?.score ?? m30?.metrics?.overall_30m_score), m30?.thirtyMin?.overall30m?.state || m30?.metrics?.overall_30m_state],
      '1h': [n(h1?.hourly?.overall1h?.score), h1?.hourly?.overall1h?.state],
      '4h': [n(h4?.fourHour?.overall4h?.score ?? h4?.metrics?.trend_strength_4h_pct), h4?.fourHour?.overall4h?.state],
      eod: [n(eodLive?.daily?.overallEOD?.score ?? eodLive?.metrics?.overall_eod_score), eodLive?.daily?.overallEOD?.state || eodLive?.metrics?.overall_eod_state]
    };
    const parts = [[tf['1h'][0], 0.20], [tf['4h'][0], 0.35], [tf.eod[0], 0.45]].filter(([v]) => v != null);
    const w = parts.reduce((a, [, x]) => a + x, 0);
    const master = w > 0 ? parts.reduce((a, [v, x]) => a + v * x / w, 0) : null;
    const ts = { '10m': i10?.updated_at_utc || i10?.updated_at, '30m': m30?.updated_at_utc || m30?.updated_at, '1h': h1?.updated_at_utc || h1?.updated_at, '4h': h4?.updated_at_utc || h4?.updated_at, eod: eodLive?.updated_at_utc || eodLive?.updated_at };
    const align = d => d?.engine21Alignment?.alignmentScore != null || d?.engine21Alignment?.alignmentState ? { score: n(d.engine21Alignment.alignmentScore), state: d.engine21Alignment.alignmentState || null, updatedAt: d.engine21Alignment.updatedAt || null } : null;
    return Object.values(tf).some(([v]) => v != null) ? { lights: Object.fromEntries(Object.entries(tf).map(([k, [score, state]]) => [k, { score, state: state || null, updatedAt: ts[k] || null }])), master, masterParts: parts.length, alignment10: align(i10), alignment30: align(m30) } : null;
  }

  function buildModel(e25, meter, hourly, eod, e29, spy) {
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
      e29: e29?.data ? { ...e29.data, servedAt: e29.servedAt, esResolvedSymbol: e29.data.esResolvedSymbol || e29.data.display?.oneWeek?.esPriceAction?.resolvedSymbol || e29.data.esPriceAction?.resolvedSymbol || null } : null,
      // Detail sections of the Frye X-Ray page (rendered by xray-sections.js).
      spy,
      blended: e25?.blendedParticipation || artifact.blendedParticipation || null,
      fastParticipation: e25?.fastParticipation || artifact.fastParticipation || null,
      sourceDiagnostics: e25?.sourceDiagnostics || artifact.sourceDiagnostics || {},
      hourlyNhNl: hourlyFresh ? { nh: sum('nh'), nl: sum('nl') } : null,
      distributionDetail: {
        components: dist.structural4h?.components || {},
        frames: ['structural4h', 'tactical1h', 'confirmation30m', 'acceleration10m'].map(k => ({ key: k, available: dist[k]?.available === true, pressure: dist[k]?.available === true ? n(dist[k]?.pressure) : null, label: dist[k]?.label || null, display: dist[k]?.display || null })),
        history: dist.history || {}
      },
      briefs: { current: e25?.redlineCurrentMarketBrief?.paragraphs || [], intraday: e25?.redlineIntradayBrief?.paragraphs || [] },
      sectorGroups: {
        '1H': e25?.sectorBreadth?.tactical1h?.groups || null,
        '4H': e25?.sectorBreadth?.regime4h?.groups || null,
        EOD: (part.sectorParticipation?.eod?.cards || []).reduce((g, c) => { const b = String(c.bias || '').toLowerCase(); (b === 'bullish' ? g.strong : b === 'bearish' ? g.weak : g.neutral).push(c.sector); return g; }, { strong: [], neutral: [], weak: [], available: true, complete: true })
      },
      macroTrends: e25?.intradayMacro?.trendComparisons || {},
      macroFresh: String(e25?.intradayMacro?.freshness?.status || '').toUpperCase() === 'FRESH',
      changes: e25?.underTheHood?.rows || [],
      trend: (e25?.overlay?.rows || []).map(r => ({ date: r.date, score: n(r.engine25CompositeScore) })).filter(r => r.score != null),
      zonePriority: e25?.zoneDecisionRead?.priorityRead || null,
      nearestZone: e25?.zoneRead?.nearestZone?.id || null,
      newsEvents: Array.isArray(e25?.newsEvents?.activeMaterialEvents) ? e25.newsEvents.activeMaterialEvents : [],
      newsOk: e25?.newsEvents?.ok !== false,
      freshness: artifact.freshness || {}
    };
  }

  const xray = window.redlineXray = { model: null, loading: null };
  xray.load = () => {
    if (!window.redlineApi) return Promise.resolve(null);
    if (xray.loading) return xray.loading;
    const api = window.redlineApi;
    xray.loading = Promise.allSettled([api.engine25(), api.marketMeter('ES'), api.hourlySectors(), api.eodShadow(), api.engine29(), api.spyIntraday(), api.spy30m(), api.spy4h(), api.spyEod()])
      .then(rs => {
        const [e25, meter, hourly, eod, e29, i10, m30, h4, eodLive] = rs.map(r => r.status === 'fulfilled' ? r.value.data : null);
        xray.model = e25 || meter || e29 ? buildModel(e25, meter, hourly, eod, e29, spyMeter(i10, m30, hourly, h4, eodLive)) : null;
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
