'use strict';
/* Redline first page: Engine 25 Market X-Ray + Engine 29 live market character.
   Mirrors the client's Frye page (Frye-Dashboard src/pages/engine25/Engine25MarketXrayPreview.jsx):
   same sources, same section order. Values are read from the backend; the only
   arithmetic is what the Frye page itself does for display (hourly sector totals,
   strong/weak sector counts, broader-market blend and the 65/20/15 permission read),
   copied as-is and marked MIRRORED so it can move to the backend later.
   Exposes window.redlineMarketXray(el) for live-surfaces.js. */
(() => {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const clean = v => v == null || v === '' ? '—' : String(v).replace(/_/g, ' ').toUpperCase();
  const n = v => { const x = Number(v); return v == null || v === '' || !Number.isFinite(x) ? null : x; };
  const fmt = (v, d = 0) => n(v) == null ? '—' : n(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = (v, d = 0) => n(v) == null ? '—' : `${n(v).toFixed(d)}%`;
  const toneOf = v => {
    const s = String(v || '').toLowerCase();
    if (/(risk_off|risk-off|bear|weak|danger|red|sell|distribution_active|deterioration|negative|stale|unavailable|high)/.test(s)) return 'bad';
    if (/(risk_on|risk-on|bull|strong|green|healthy|live|fresh|positive|allowed)/.test(s)) return 'good';
    if (/(neutral|mixed|watch|warn|caution|yellow|elevated|wait|medium|reduced)/.test(s)) return 'warn';
    return '';
  };
  const stat = (label, value, note, tone = '') => `<div class="xr-stat"><span>${esc(label)}</span><strong class="${tone ? 'xr-' + tone : ''}">${esc(value)}</strong><small>${esc(note ?? '')}</small></div>`;
  const kv = (label, value, tone = '') => `<div class="xr-kv"><span>${esc(label)}</span><b class="${tone ? 'xr-' + tone : ''}">${esc(value)}</b></div>`;
  const card = (title, body, tone = '') => `<section class="xr-card ${tone ? 'xr-accent-' + tone : ''}"><h3>${esc(title)}</h3>${body}</section>`;
  const list = items => (Array.isArray(items) && items.length) ? `<ul class="xr-list">${items.slice(0, 6).map(i => `<li>${esc(typeof i === 'string' ? i.replace(/_/g, ' ') : (i?.text || i?.label || i?.message || i?.code || JSON.stringify(i)))}</li>`).join('')}</ul>` : '<p class="xr-muted">None reported.</p>';

  function dataStatus(freshness) {
    const intraday = freshness?.intraday || {};
    const state = String(intraday.state || freshness?.state || (intraday.fresh === true ? 'FRESH' : '')).toUpperCase();
    if (state === 'FRESH') return 'LIVE';
    if (state === 'LAST_VALID_EQUITY_READ') return 'LAST VALID EQUITY READ';
    if (state.includes('STALE')) return 'STALE';
    if (!state || state === 'UNAVAILABLE' || state.includes('MISSING') || state.includes('INVALID')) return 'UNAVAILABLE';
    if (state === 'INSUFFICIENT_VOLUME_COVERAGE') return 'DEGRADED';
    return clean(state);
  }

  // MIRRORED from Engine25MarketXrayPreview tradePermissionRead (65/20/15 thresholds).
  function permissionRead(x) {
    if (x == null) return ['WAITING FOR EOD SHADOW', 'NO DECISION SCORE YET', ''];
    if (x >= 65) return ['LONG BIAS', 'NORMAL LONG PERMISSION', 'good'];
    if (x >= 55) return ['LONG ALLOWED — REDUCED SIZE', 'NO AGGRESSIVE SIZE-UP', 'good'];
    if (x >= 50) return ['NEUTRAL / WAIT', 'DO NOT SIZE UP', 'warn'];
    if (x >= 45) return ['AVOID NEW LONGS / SHORT WATCH', 'NO SIZE-UP LONG', 'warn'];
    if (x >= 35) return ['BEARISH / SHORTS FAVORED', 'DEFENSIVE', 'bad'];
    return ['STRONG DEFENSIVE / BEARISH', 'NO NORMAL LONGS', 'bad'];
  }

  async function render(el) {
    const api = window.redlineApi;
    const settled = await Promise.allSettled([api.engine25(), api.marketMeter('ES'), api.hourlySectors(), api.eodShadow(), api.engine29Summary()]);
    const [e25, meter, hourly, eod, e29] = settled.map(r => r.status === 'fulfilled' ? r.value.data : null);
    const okCount = [e25, meter, hourly, eod, e29].filter(Boolean).length;
    const body = el.querySelector('[data-live-body]');
    if (!e25) {
      body.innerHTML = '<p class="live-note">Engine 25 full dashboard is unavailable. No market values are shown.</p>';
      return { okCount, total: 5, stamp: `Engine 25 unavailable · ${new Date().toISOString()}` };
    }

    const headline = e25.headline || {};
    const artifact = e25.participationArtifact || {};
    const part = artifact.participation || {};
    const breadth = part.breadth || {};
    const nhnl = part.newHighsNewLows || {};
    const dist = part.distributionPressure || {};
    const credit = e25.creditStressDetail || {};
    const macro = e25.macroPressure || {};
    const news = e25.newsEvents || {};
    const zone = e25.zoneDecisionRead || {};
    const zoneClass = e25.zoneClassification || {};
    const brief = e25.redlineCurrentMarketBrief || {};
    const status = dataStatus(artifact.freshness);

    // Hourly sector totals (MIRRORED): only used when all 11 cards are under 90 minutes old.
    const cards = Array.isArray(hourly?.sectorCards) ? hourly.sectorCards : [];
    const hourlyTs = Date.parse(hourly?.updated_at_utc || hourly?.meta?.ts_utc || '');
    const hourlyFresh = cards.length === 11 && Number.isFinite(hourlyTs) && Date.now() - hourlyTs <= 90 * 60 * 1000;
    const sum = k => cards.reduce((a, c) => a + (n(c[k]) ?? 0), 0);
    const T = hourlyFresh ? { up: sum('up'), down: sum('down'), scanned: sum('stocksScanned'), withVol: sum('stocksWithVolume'), advVol: sum('advancingVolume'), decVol: sum('decliningVolume') } : null;
    const buyBreadth = T && T.up + T.down > 0 ? T.up / (T.up + T.down) * 100 : null;
    const buyVol = T && T.advVol + T.decVol > 0 ? T.advVol / (T.advVol + T.decVol) * 100 : null;
    const coverage = T && T.scanned > 0 ? T.withVol / T.scanned * 100 : null;
    const states = hourlyFresh ? cards.map(c => { const b = n(c.breadth_pct), m = n(c.momentum_pct); return b == null || m == null ? 'UNAVAILABLE' : b >= 55 && m >= 55 ? 'STRONG' : b <= 45 && m <= 45 ? 'WEAK' : 'NEUTRAL'; }) : [];
    const count = s => hourlyFresh ? states.filter(x => x === s).length : null;
    const [strong, weak, neutral] = [count('STRONG'), count('WEAK'), count('NEUTRAL')];
    const sectorScore = hourlyFresh ? ((strong - weak) / 11 + 1) * 50 : null;
    const broader = buyBreadth == null || sectorScore == null || buyVol == null ? null : buyBreadth * 0.60 + sectorScore * 0.25 + buyVol * 0.15;

    // 65/20/15 permission read (MIRRORED): ES master, 4H light, reconstructed EOD shadow.
    const master = n(meter?.master?.score), m4h = n(meter?.lights?.['4h']?.score), recon = n(eod?.score);
    const permScore = master != null && m4h != null && recon != null ? 0.65 * master + 0.20 * m4h + 0.15 * recon : null;
    const [permLabel, permSizing, permTone] = permissionRead(permScore);
    const diff = master == null || broader == null ? null : master - broader;
    const d29 = e29?.data || {};

    body.innerHTML = `
      <div class="xr-head">
        <div><div class="xr-title"><span>REDLINE</span> TRADING <i>//</i> ENGINE 25 — MARKET X-RAY</div>
        <div class="xr-muted">See what is happening underneath the market — participation, pressure, stress and risk in one view.</div></div>
        <div class="xr-right"><b class="xr-${toneOf(status)}">DATA: ${esc(status)}</b><small>${esc(artifact.generatedAt || e25.generatedAtUtc || '—')}</small></div>
      </div>

      <div class="xr-meters">${meter ? [['MASTER', meter.master], ...['10m', '30m', '1h', '4h', '1d'].map(tf => [tf === '1d' ? 'EOD' : tf.toUpperCase(), meter.lights?.[tf]])].map(([lab, d]) => `<div class="xr-meter"><i class="xr-light xr-${toneOf(d?.tone || d?.state)}"></i><span>${esc(lab)}${lab === '4H' || lab === 'EOD' ? ' · FORMULA PENDING' : ''}</span><strong>${fmt(d?.score, 1)}</strong><small>${esc(clean(d?.state))}</small></div>`).join('') : '<p class="xr-muted">ES market meter unavailable.</p>'}</div>

      <div class="xr-stats">
        ${stat('Market Health', fmt(headline.score), clean(headline.label || headline.state), toneOf(headline.color || headline.state))}
        ${stat('Breadth', buyBreadth == null ? '—' : `${pct(buyBreadth)} ADV / ${pct(100 - buyBreadth)} DEC`, '1H stocks advancing vs declining', buyBreadth == null ? '' : buyBreadth >= 55 ? 'good' : buyBreadth <= 45 ? 'bad' : 'warn')}
        ${stat('Stock Volume', buyVol == null ? '—' : `${pct(buyVol)} BUY / ${pct(100 - buyVol)} SELL`, '1H directional volume')}
        ${stat('Distribution', pct(dist.rawPressure), `4H structural · ${clean(dist.pressureLabel || dist.label)}`, toneOf(dist.label))}
        ${stat('Sectors', weak == null ? '—' : `${weak} WEAK`, strong == null ? 'sector participation unavailable' : `${strong} strong · ${neutral} mixed`, 'warn')}
        ${stat('Data', status, coverage == null ? 'coverage unavailable' : `${pct(coverage, 1)} volume coverage`, toneOf(status))}
      </div>

      <div class="xr-permission xr-accent-${permTone || 'none'}">
        <div><span>TRADE PERMISSION · 65/20/15 (MIRRORED FROM FRYE PAGE)</span><strong class="xr-${permTone}">${esc(permLabel)}</strong><small>${esc(permSizing)}</small></div>
        ${kv('Score', fmt(permScore, 1), permTone)}
        ${kv('ES Master (65%)', fmt(master, 1))}
        ${kv('ES 4H (20%)', fmt(m4h, 1))}
        ${kv('Recon. EOD (15%)', recon == null ? '—' : `${fmt(recon, 1)} ${clean(eod?.state)}`)}
        ${kv('Live ES permission', clean(headline.livePermission), toneOf(headline.livePermission))}
        ${kv('Live size', headline.liveSize == null ? '—' : `×${headline.liveSize}`)}
      </div>

      <div class="xr-grid">
        ${card('Market Health', `${kv('State', clean(headline.label || headline.state), toneOf(headline.state))}${kv('Daily permission', clean(headline.permission))}${kv('Size', headline.size == null ? '—' : `×${headline.size}`)}${kv('Sector breadth', clean(headline.sectorBreadthLabel))}${headline.interpretation ? `<p>${esc(headline.interpretation)}</p>` : ''}`, toneOf(headline.color))}
        ${card(`Market Participation — ${T ? fmt(T.scanned) : 'UNAVAILABLE'} stocks`, `${kv('Breadth', clean(breadth.label), toneOf(breadth.label))}${kv('Stocks with volume', T ? fmt(T.withVol) : '—')}${kv('Volume coverage', pct(coverage, 1))}${kv('Advancing / declining', T ? `${fmt(T.up)} / ${fmt(T.down)}` : '—')}${kv('Advancing volume', T ? fmt(T.advVol) : '—', 'good')}${kv('Declining volume', T ? fmt(T.decVol) : '—', 'bad')}${kv('Sector participation', strong == null ? '—' : `${strong} strong · ${neutral} mixed · ${weak} weak`)}`)}
        ${card('Index vs Broader Market', `${kv('ES strength (master)', fmt(master, 1))}${kv('Broader market strength', fmt(broader, 1))}${kv('ES price', fmt(headline.esClose, 2))}${kv('Index / market difference', diff == null ? '—' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}`)}<p class="xr-muted">${diff == null ? 'Index / market comparison unavailable.' : diff > 0 ? 'ES is holding up better than the broader market.' : 'The broader market is stronger than ES.'}</p>`)}
        ${card('Financial Stress', `${kv('Read', clean(credit.displayLabel), toneOf(credit.displayLabel))}${kv('Credit fragility', fmt(credit.scores?.creditFragility))}${kv('Macro credit', fmt(credit.scores?.creditStress))}${kv('Bond market', fmt(credit.scores?.bondMarket))}${kv('Liquidity', fmt(credit.scores?.liquidity))}`)}
        ${card('Macro Pressure — Rates, Dollar, Oil', `${kv('Score', fmt(macro.score))}${kv('Read', clean(macro.label), toneOf(macro.label))}${kv('U.S. 2Y yield', fmt(macro.inputs?.twoYear, 2))}${kv('10Y − 2Y', fmt(macro.inputs?.tenMinusTwo, 2))}${kv('U.S. Dollar (UUP)', fmt(macro.inputs?.UUP?.close, 2))}${kv('Energy', clean(macro.inputs?.energyAuthority?.label), toneOf(macro.inputs?.energyAuthority?.label))}`, 'bad')}
        ${card('Selling / Distribution Pressure', `${kv('Raw pressure', pct(dist.rawPressure, 1))}${kv('Score', fmt(dist.score, 1))}${kv('Label', clean(dist.label), toneOf(dist.label))}${kv('Integrated state', clean(dist.integratedState))}${kv('Combined volume pressure', fmt(part.stockVolume?.combinedVolumePressure, 1))}`, toneOf(dist.label))}
        ${card('Market Leadership — New Highs vs New Lows', `${kv('Intraday NH / NL', `${fmt(nhnl.intradayTotalNh)} / ${fmt(nhnl.intradayTotalNl)}`)}${kv('Intraday net', fmt(nhnl.intradayNetHighsLows), n(nhnl.intradayNetHighsLows) < 0 ? 'bad' : 'good')}${kv('EOD NH / NL', `${fmt(nhnl.eodTotalNh)} / ${fmt(nhnl.eodTotalNl)}`)}${kv('EOD net', fmt(nhnl.eodNetHighsLows), n(nhnl.eodNetHighsLows) < 0 ? 'bad' : 'good')}`)}
        ${card('Active Event Risk', news.ok === false ? `<p class="xr-bad">News feed unavailable${news.httpStatus ? ` (HTTP ${esc(news.httpStatus)})` : ''}.</p>` : list(news.events), 'warn')}
        ${card('Price Support / Selling Pressure', `${kv('Zone state', clean(zone.label), toneOf(zone.tone))}${kv('Zone permission', clean(zone.permission))}${kv('Nearest zone', e25.zoneRead?.nearestZone?.id || '—')}${kv('Buying support', clean(zoneClass.accumulationRead?.state))}${kv('Distribution in zone', clean(zoneClass.distributionRead?.state))}`)}
      </div>

      ${Array.isArray(brief.sections) && brief.sections.length ? `<section class="xr-card xr-brief"><h3>Current Market Brief</h3>${brief.sections.map(s => `<p><b>${esc(s.title)}.</b> ${esc(s.text)}</p>`).join('')}${brief.conclusion ? `<p class="xr-conclusion">${esc(typeof brief.conclusion === 'string' ? brief.conclusion : brief.conclusion.text || '')}</p>` : ''}</section>` : ''}
      ${e25.deskNote ? `<p class="live-note">${esc(e25.deskNote)}</p>` : ''}

      <div class="xr-section">ENGINE 29 — LIVE MARKET CHARACTER ${e29 ? '' : '· UNAVAILABLE'}</div>
      ${e29 ? `<div class="xr-stats">
        ${stat('Overall', clean(d29.overallState), d29.dataDegraded ? 'DATA DEGRADED' : 'data ok', toneOf(d29.overallState))}
        ${stat('Structural', clean(d29.structuralState), '', toneOf(d29.structuralState))}
        ${stat('Tactical', clean(d29.tacticalState), `Fast: ${clean(d29.fastTacticalState)}`, toneOf(d29.tacticalState))}
        ${stat('ES / NQ backdrop', clean(d29.esNqBackdrop), `Contract ${d29.esResolvedSymbol || '—'}`, toneOf(d29.esNqBackdrop))}
        ${stat('Move', clean(d29.moveCharacter), `${clean(d29.moveDirection)} · ${clean(d29.moveConfidence)} confidence`)}
        ${stat('Underlying pressure', clean(d29.underlyingPressure), '', toneOf(d29.underlyingPressure))}
      </div>
      <div class="xr-grid xr-grid-3">
        ${card('Confirmations', list(d29.confirmations), 'good')}
        ${card('Warnings', list(d29.warnings), 'bad')}
        ${card('Missing confirmations', list(d29.missingConfirmations), 'warn')}
      </div>` : '<p class="live-note">Engine 29 cross-market stress is unavailable.</p>'}`;

    return { okCount, total: 5, stamp: `Engine 25 ${e25.generatedAtUtc || '—'} · Engine 29 ${d29.timestamp || '—'} · Hourly sectors ${hourly?.updated_at_utc || '—'}${hourly && !hourlyFresh ? ' (stale)' : ''}` };
  }

  window.redlineMarketXray = render;
})();
