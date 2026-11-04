'use strict';
/* Detail sections of the first page, in the same order as the client's Frye Market X-Ray
   (Engine25MarketXrayPreview + Engine29FullDashboard), drawn with Redline's own components
   (panel(), stat(), .kv rows, tables). Reads window.redlineXray.model only; called from
   corsa.js raceLiveOverview(). Missing values render as — / UNAVAILABLE. */
(() => {
  const n = v => { const x = Number(v); return v == null || v === '' || !Number.isFinite(x) ? null : x; };
  const L = v => v == null || v === '' ? 'UNAVAILABLE' : String(v).replace(/_/g, ' ').toUpperCase();
  const f = (v, d = 0) => n(v) == null ? '—' : n(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = (v, d = 0) => n(v) == null ? '—' : `${n(v).toFixed(d)}%`;
  const signed = (v, d = 1, unit = '') => n(v) == null ? '—' : `${n(v) > 0 ? '+' : ''}${n(v).toFixed(d)}${unit}`;
  const tone = v => /BEAR|RISK.?OFF|WEAK|DETERIORATION|NEGATIVE|DEFENSIVE|EXTREME|SEVERE|STRESS|DANGER|HIGH|SELLING|DOWN|STALE|UNAVAILABLE/i.test(v || '') ? 'down' : /BULL|RISK.?ON|STRONG|POSITIVE|LIVE|FRESH|EASING|UP\b/i.test(v || '') ? 'up' : 'yellow';
  const toneNum = v => n(v) == null ? '' : n(v) >= 55 ? 'up' : n(v) <= 45 ? 'down' : 'yellow';
  const E = v => esc(L(v));
  const kv = (k, v, t = '') => `<div class="kv"><span>${esc(k)}</span><strong class="${t}">${esc(v)}</strong></div>`;
  const body = html => `<div class="panel-body">${html}</div>`;
  const note = text => text ? `<p class="metric-description">${esc(text)}</p>` : '';
  const when = t => { const d = Date.parse(t || ''); return Number.isFinite(d) ? new Date(d).toLocaleString('en-US', { timeZone: 'America/Phoenix', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' AZ' : '—'; };
  const ui = { brief: 'current', sector: '1H' };
  const tabs = (group, current, items) => `<div class="segmented xr-tabs">${items.map(([k, label]) => `<button type="button" class="${k === current ? 'active' : ''}" data-xr-tab="${group}:${k}">${esc(label)}</button>`).join('')}</div>`;

  function meterStrip(title, lights, master, keys) {
    if (!lights) return `<div class="xr-strip"><span class="xr-strip-title">${esc(title)}</span><span class="xr-muted">UNAVAILABLE</span></div>`;
    return `<div class="xr-strip"><span class="xr-strip-title">${esc(title)}</span>${keys.map(([k, lab]) => { const d = lights[k] || {}; return `<span class="xr-light-cell"><i class="xr-dot ${toneNum(d.score)}"></i><b>${pct(d.score, 1)}</b><small>${lab}</small></span>`; }).join('')}<span class="xr-light-cell xr-master"><i class="xr-dot ${toneNum(master)}"></i><b>${pct(master, 1)}</b><small>MASTER</small></span></div>`;
  }

  function changeSentence(row) {
    const v = n(row?.oneDayChange); if (v == null) return null;
    const dir = v > 0 ? 'higher' : v < 0 ? 'lower' : 'unchanged';
    if (row.label === 'Breadth') return v > 0 ? 'Broader participation improved from yesterday.' : v < 0 ? 'Broader participation weakened from yesterday.' : 'Broader participation was unchanged from yesterday.';
    if (row.label === 'Distribution') return v > 0 ? 'Selling / distribution pressure increased from yesterday.' : v < 0 ? 'Selling / distribution pressure eased from yesterday.' : 'Selling / distribution pressure was unchanged from yesterday.';
    if (row.label === 'Credit Fragility') return `Credit fragility score moved ${dir} from yesterday (${v > 0 ? '+' : ''}${v}).`;
    if (row.label === 'Macro Aware') return `Macro condition score moved ${dir} from yesterday (${v > 0 ? '+' : ''}${v}).`;
    return `${L(row.label)} changed ${v > 0 ? '+' : ''}${v} from yesterday.`;
  }

  function trendChart(rows) {
    if (rows.length < 2) return '<p class="xr-muted">Historical trend unavailable.</p>';
    const W = 600, H = 150, xs = i => i / (rows.length - 1) * W, ys = v => H - v / 100 * H;
    const line = rows.map((r, i) => `${xs(i).toFixed(1)},${ys(r.score).toFixed(1)}`).join(' ');
    const guide = v => `<line x1="0" x2="${W}" y1="${ys(v)}" y2="${ys(v)}" class="xr-guide"/><text x="4" y="${ys(v) - 3}" class="xr-guide-label">${v}</text>`;
    return `<svg class="xr-trend" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Engine 25 composite score, last ${rows.length} sessions">${[40, 55, 75].map(guide).join('')}<polyline points="${line}" class="xr-trend-line"/></svg><div class="xr-trend-axis"><span>${esc(rows[0].date)}</span><span>Latest ${f(rows.at(-1).score)} · ${esc(rows.at(-1).date)}</span></div>`;
  }

  function engine25(x) {
    const h = x.headline || {}, hb = x.hourly || {}, sec = x.sectors || {}, dd = x.distributionDetail || {}, comp = dd.components || {}, sd = x.sourceDiagnostics || {}, blend = x.blended || {};
    const master = x.meter?.master, broader = x.broader, diff = master == null || broader == null ? null : master - broader;
    const prior = key => { const rows = (dd.history?.[{ structural4h: '4h', tactical1h: '1h', confirmation30m: '30m', acceleration10m: '10m' }[key]] || []).filter(r => n(r?.pressure) != null); return rows.length >= 2 ? n(rows.at(-2).pressure) : null; };
    const frameName = { structural4h: ['4H', 'Structure', 'Structural selling pressure'], tactical1h: ['1H', 'Trend', 'Direction of selling pressure'], confirmation30m: ['30m', 'Confirmation', 'Confirms whether the transition is holding'], acceleration10m: ['10m', 'Acceleration', 'Fast acceleration or recovery signal'] };
    const imbalance = hb.buyVolume == null ? null : Math.abs(100 - 2 * hb.buyVolume);
    const groups = x.sectorGroups?.[ui.sector];
    const sectorList = names => names?.length ? names.map(s => `<span class="xr-chip">${esc(s)}</span>`).join('') : '<span class="xr-muted">None</span>';
    const mt = x.macroTrends || {};
    const macroRow = (label, t, unit) => { const c = unit === 'bp' ? t?.changesBps || {} : t?.changesPct || {}; const cur = n(t?.current); return `<tr><td>${esc(label)}</td><td class="number">${cur == null ? '—' : unit === 'bp' ? cur.toFixed(2) + '%' : cur.toFixed(2)}</td>${['2h', 'session', '1d', '2d', '5d'].map(k => `<td class="number ${n(c[k]) == null ? '' : n(c[k]) > 0 ? 'down' : 'up'}">${unit === 'bp' ? signed(c[k], 1, ' bp') : signed(c[k], 2, '%')}</td>`).join('')}</tr>`; };
    const briefParas = x.briefs?.[ui.brief] || [];

    return `
    <div class="race-section-label"><span>MARKET METERS</span><small>ES FUTURES · SPY · LIVE BACKEND</small></div>
    <div class="xr-strips">${meterStrip('ES FUTURES METER', x.meter?.lights && { '10m': x.meter.lights['10m'], '30m': x.meter.lights['30m'], '1h': x.meter.lights['1h'], '4h': x.meter.lights['4h'], eod: x.meter.lights['1d'] }, master, [['10m', '10m'], ['30m', '30m'], ['1h', '1h'], ['4h', '4h'], ['eod', 'EOD']])}${meterStrip('SPY MARKET METER', x.spy?.lights, x.spy?.master, [['10m', '10m'], ['30m', '30m'], ['1h', '1h'], ['4h', '4h'], ['eod', 'EOD']])}</div>

    <div class="grid cols-2">
      ${panel(`Market participation — ${hb.scanned == null ? 'UNAVAILABLE' : f(hb.scanned)} stocks`, body(`
        ${note('Blended participation combines the latest valid 10m, 1H, 4H and EOD participation readings. Fast participation remains the raw 10-minute evidence.')}
        ${kv('Blended participation', L(blend.state), tone(blend.state))}
        ${kv('Surviving evidence', pct(n(blend.usableEffectiveWeight) == null ? null : n(blend.usableEffectiveWeight) * 100, 1))}
        <div class="table-wrap"><table><thead><tr><th>Frame</th><th>Freshness</th><th>State</th><th>Sectors · weight</th><th>Last run</th></tr></thead><tbody>${['10m', '1h', '4h', 'eod'].map(k => { const s = sd[k] || {}; return `<tr><td>${k.toUpperCase()}</td><td class="${tone(s.freshnessState)}">${esc(L(s.freshnessState))}</td><td class="${tone(s.timeframeState)}">${esc(L(s.timeframeState))}</td><td>${s.sectorCount ?? '—'} · ${pct(n(s.effectiveWeight) == null ? null : n(s.effectiveWeight) * 100, 1)}</td><td>${esc(when(s.sourceTimestamp))}</td></tr>`; }).join('')}</tbody></table></div>
        ${kv('Fast participation / 10m', L(x.fastParticipation?.state || sd['10m']?.timeframeState), tone(x.fastParticipation?.state))}
      `))}
      ${panel('Main 1H market evidence', body(`
        ${kv('Stocks scanned', f(hb.scanned))}${kv('Stocks with volume', f(hb.withVol))}${kv('Volume coverage', pct(hb.coverage, 1))}
        ${kv('Advancing', hb.up == null ? '—' : `${f(hb.up)} (${pct(hb.buyBreadth)})`, 'up')}${kv('Declining', hb.down == null ? '—' : `${f(hb.down)} (${pct(100 - hb.buyBreadth)})`, 'down')}
        ${kv('New highs', f(x.hourlyNhNl?.nh), 'up')}${kv('New lows', f(x.hourlyNhNl?.nl), 'down')}
        ${kv('Sector participation', sec.strong == null ? '—' : `${sec.strong} bullish · ${sec.neutral} neutral · ${sec.weak} bearish`)}
        ${kv('Advancing volume', hb.advVol == null ? '—' : `${f(hb.advVol)} (${pct(hb.buyVolume, 1)})`, 'up')}${kv('Declining volume', hb.decVol == null ? '—' : `${f(hb.decVol)} (${pct(100 - hb.buyVolume, 1)})`, 'down')}
        ${kv('Directional imbalance', imbalance == null ? '—' : `${pct(imbalance, 1)} toward ${hb.buyVolume < 50 ? 'selling' : 'buying'}`, hb.buyVolume < 50 ? 'down' : 'up')}
      `))}
    </div>

    <div class="grid cols-2">
      ${panel('Selling / distribution pressure', body(`
        ${note('4H owns the structural pressure score. 1H shows direction, 30m confirms transitions and 10m flags acceleration.')}
        ${kv('Breadth pressure — 4H', comp.breadthPressure == null ? '—' : `${f(comp.breadthPressure)} / 100`)}${kv('Volume pressure — 4H', comp.volumePressure == null ? '—' : `${f(comp.volumePressure)} / 100`)}${kv('NH/NL pressure — 4H', comp.highLowPressure == null ? '—' : `${f(comp.highLowPressure)} / 100`)}${kv('Sector pressure — 4H', comp.sectorPressure == null ? '—' : `${f(comp.sectorPressure)} / 100`)}
        <div class="table-wrap"><table><thead><tr><th>Frame</th><th>Role</th><th>Pressure</th><th>Read</th><th>Prior → current</th></tr></thead><tbody>${(dd.frames || []).map(fr => { const [tf, role, desc] = frameName[fr.key]; const p = prior(fr.key); const lastValid = fr.display?.lastValidEquityRead?.pressure ?? fr.display?.pressure; return `<tr><td>${tf}</td><td title="${esc(desc)}">${role}</td><td class="number">${fr.pressure == null ? '—' : f(fr.pressure, 1)}</td><td class="${tone(fr.label)}">${esc(L(fr.available ? fr.label : 'UNAVAILABLE'))}</td><td>${fr.pressure != null && p != null ? `${f(p, 1)} → ${f(fr.pressure, 1)} · ${signed(fr.pressure - p)} ${fr.pressure >= p ? 'more' : 'less'} selling` : !fr.available && n(lastValid) != null ? `Last valid ${f(lastValid, 1)}` : '—'}</td></tr>`; }).join('')}</tbody></table></div>
        ${kv('Distribution pressure', x.distribution?.raw == null ? '—' : `${f(x.distribution.raw)} / 100 · ${L(x.distribution.label)}`, tone(x.distribution?.label))}
      `))}
      ${panel('Index vs broader market', body(`
        ${note('Is ES stronger or weaker than the stocks underneath it?')}
        ${kv('ES strength', f(master, 1))}${kv('Broader market strength', f(broader))}${kv('ES price', f(h.esClose, 2))}${kv('Participation', L(x.breadthLabel), tone(x.breadthLabel))}
        ${kv('Index / market difference', diff == null ? '—' : `${signed(diff)} pts`, diff == null ? '' : diff > 0 ? 'yellow' : 'up')}
        <div class="notice">${diff == null ? 'Index / market comparison unavailable.' : diff > 0 ? 'ES is holding up better than the broader market. The ES strength score is above the broader-market participation score.' : 'The broader market is stronger than ES.'}</div>
      `), btn('Open market meter', 'meters', false, 'arrow'))}
    </div>

    ${panel('Redline market briefing', body(`${tabs('brief', ui.brief, [['current', 'Current market'], ['intraday', 'Intraday']])}${briefParas.length ? briefParas.map(p => `<p class="xr-para">${esc(p)}</p>`).join('') : '<p class="xr-muted">Briefing unavailable.</p>'}`), '', 'Full plain-English read of current market conditions from canonical Redline evidence')}

    <div class="grid cols-2">
      ${panel('11-sector participation', body(`${tabs('sector', ui.sector, [['1H', '1H'], ['4H', '4H'], ['EOD', 'EOD']])}${groups ? `<div class="xr-groups"><div><b class="up">STRONG (${groups.strong?.length || 0})</b>${sectorList(groups.strong)}</div><div><b class="yellow">NEUTRAL (${groups.neutral?.length || 0})</b>${sectorList(groups.neutral)}</div><div><b class="down">WEAK (${groups.weak?.length || 0})</b>${sectorList(groups.weak)}</div></div>` : '<p class="xr-muted">Sector participation unavailable.</p>'}`), btn('Open all 11 sectors', 'sectors', false, 'arrow'))}
      ${panel('Financial stress', body(`${note('Credit, banks, bonds and liquidity')}${kv('Credit fragility', f(x.credit?.scores?.creditFragility))}${kv('Macro credit', f(x.credit?.scores?.creditStress))}${kv('Bond market', f(x.credit?.scores?.bondMarket))}${kv('Liquidity', f(x.credit?.scores?.liquidity))}<div class="notice">${esc(L(x.credit?.label))}</div>`))}
    </div>

    ${panel('Macro pressure — rates, dollar, oil', body(`${note('Red = increasing pressure on equities. Green = easing pressure.')}<div class="table-wrap"><table><thead><tr><th>Instrument</th><th>Current</th><th>2H</th><th>Session</th><th>1D</th><th>2D</th><th>5D</th></tr></thead><tbody>${macroRow('U.S. 10Y yield', mt.tenYearYield, 'bp')}${macroRow('U.S. 30Y yield', mt.thirtyYearYield, 'bp')}${macroRow('U.S. Dollar (UUP)', mt.dollarUup, 'pct')}${macroRow('WTI oil', mt.wti, 'pct')}${macroRow('Brent oil', mt.brent, 'pct')}</tbody></table></div>${kv('Macro pressure', `${f(x.macro?.score)} · ${L(x.macro?.label)}`, tone(x.macro?.label))}${x.macroFresh ? '' : '<div class="notice">Intraday macro data is not fresh.</div>'}`))}

    <div class="grid cols-3">
      ${panel('Market leadership — new highs vs new lows', body(`${kv('New highs', f(x.hourlyNhNl?.nh), 'up')}${kv('New lows', f(x.hourlyNhNl?.nl), 'down')}${kv('Net new highs / lows', signed(x.nhnl?.intradayNetHighsLows, 0), n(x.nhnl?.intradayNetHighsLows) < 0 ? 'down' : 'up')}`))}
      ${panel('Active event risk', body(x.newsEvents.length ? x.newsEvents.slice(0, 3).map(e => `<div class="notice">${esc(e.headline || e.title || e.summary || L(e.category))}</div>`).join('') : `<p class="xr-muted">${x.newsOk ? 'No active material Engine 25 event found.' : 'News feed unavailable.'}</p>`))}
      ${panel('Price support / selling pressure', body(`${note(x.zonePriority)}${kv('Nearest zone', x.nearestZone || '—')}`), btn('Open price context on chart', 'workspace', false, 'arrow'))}
    </div>

    <div class="grid cols-main">
      ${panel('Market health trend — 6 months', body(trendChart(x.trend || [])))}
      ${panel('What changed since yesterday?', body(`${(x.changes || []).filter(r => ['Breadth', 'Distribution', 'Credit Fragility', 'Macro Aware'].includes(r.label)).map(changeSentence).filter(Boolean).map(s => `<div class="kv"><span>${esc(s)}</span></div>`).join('') || '<p class="xr-muted">Comparison unavailable.</p>'}`))}
    </div>

    ${panel('Data confidence & Engine 25 detail', body(`${kv('Scanner status', x.dataStatus, tone(x.dataStatus))}${kv('Volume coverage', pct(hb.coverage, 1))}${kv('Source time', x.freshness?.intraday?.sourceTimestamp || '—')}${note(x.deskNote)}`))}`;
  }

  /* Engine 29 presentation dictionary, MIRRORED from Frye Engine29FullDashboard.jsx
     (plainGroupState, plainBiggerPictureCharacter, plainOverallMarketHealth, plainDistribution,
     stateColor). Raw backend states are unchanged; only the display text and tone are mapped. */
  const GROUP_LABEL = (group, state) => {
    const s = String(state || '').toUpperCase();
    if (!s) return null;
    if (s === 'HEALTHY' || s === 'RECOVERING') return s;
    if (s === 'SEVERE') return 'SEVERE STRESS';
    if (s === 'FORMING') return { ratesDuration: 'PRESSURE BUILDING', energyInflation: 'STRESS BUILDING', volatility: 'VOLATILITY RISING' }[group] || 'WEAKENING';
    if (s === 'CONFIRMED') return ['breadth', 'leadership', 'headlineIndex'].includes(group) ? 'BREAKING' : group === 'volatility' ? 'VOLATILITY CONFIRMED' : 'STRESS CONFIRMED';
    return L(s);
  };
  const BIGGER_PICTURE = { SUPPORTIVE: 'HEALTHY', NARROWING: 'WAIT — MIXED MARKET', DISTRIBUTION_PRESSURE: 'DOWNWARD PRESSURE', BROAD_DETERIORATION: 'STRONG DOWNWARD PRESSURE', STRUCTURE_ONLY: 'WAIT — MIXED MARKET', MIXED: 'WAIT — MIXED MARKET' };
  const OVERALL_HEALTH = { NORMAL: 'HEALTHY', EARLY_WARNING: 'SOME WEAKNESS SHOWING', BROAD_DETERIORATION: 'BROAD WEAKNESS', RISK_OFF_CONFIRMED: 'DOWNWARD PRESSURE', SYSTEMIC_STRESS: 'STRONG DOWNWARD PRESSURE' };
  const PRICE_BREADTH = { HEALTHY: 'BROAD PARTICIPATION', RECOVERING: 'IMPROVING PARTICIPATION', FORMING: 'MIXED PARTICIPATION', CONFIRMED: 'WEAK PARTICIPATION', SEVERE: 'WEAK PARTICIPATION' };
  // EXTREME is checked before HIGH (Frye's full page checks HIGH first, so EXTREME_HIGH would read HIGH there).
  const DISTRIBUTION = v => { const s = String(v || '').toUpperCase(); return !s ? 'UNAVAILABLE' : s.includes('EXTREME') ? 'VERY HIGH' : s.includes('HIGH') ? 'HIGH' : /WATCH|ELEVATED/.test(s) ? 'BUILDING' : s.includes('LOW') ? 'LOW' : L(s); };
  const TREND = v => { const s = String(v || '').toUpperCase(); return s.startsWith('WAIT_') ? `WAIT — ${s.slice(5).replace(/_/g, ' ')}` : L(s); };
  const tone29 = v => { const s = String(v || '').toUpperCase().replace(/_/g, ' '); return /FAILED|SYSTEMIC|RISK OFF|BREAKING|CONFIRMED BREAK|SELLOFF|NEGATIVE|OPPOSES/.test(s) ? 'down' : /BROAD DETERIORATION|STRESS CONFIRMED|STRESS BUILDING|WEAKENING|FADING|COUNTERTREND|TRAP WATCH|SEVERE|STRONG DOWNWARD|VERY HIGH/.test(s) ? 'orange' : /CAUTION|FORMING|WARNING|STABILIZING|MIXED|WAIT|MISSING|PARTIAL|NARROW|BUILDING|RISING/.test(s) ? 'yellow' : /HEALTHY|RECOVERING|POSITIVE|ACCELERATING|HOLDING|SUPPORTS|CONFIRMED/.test(s) ? 'up' : /SWEEP|RECLAIM/.test(s) ? 'cyan' : ''; };

  function engine29(x) {
    const e = x.e29; if (!e) return '';
    const d = e.display || {}, w = d.oneWeek || {}, ep = w.esPriceAction || {}, sp = w.structuralParticipation || {}, lm = d.liveMonitor || {}, lmFull = e.liveMonitor || {}, mc = d.marketCharacter || {}, mv = mc.move || {}, liq = mc.liquidity || {}, trap = mc.trap || {}, uth = d.underTheHood || {};
    const moves = Object.entries(lmFull.symbolMoves || {}).filter(([, v]) => v?.available);
    const groupRows = [['headlineIndex', 'Indexes', 'largeIndexes'], ['breadth', 'Breadth', 'breadth'], ['leadership', 'Leadership', 'techLeadership'], ['credit', 'Credit', 'credit'], ['ratesDuration', 'Rates', 'ratesBonds'], ['energyInflation', 'Energy', 'oil'], ['volatility', 'Volatility', 'volatility'], ['financialConditions', 'Financials', 'financialConditions']];
    return `
    <div class="race-section-label"><span>ENGINE 29 · MARKET CHARACTER</span><small>WHAT KIND OF MOVE IS HAPPENING RIGHT NOW? · ${esc(when(e.timestamp))}${e.dataDegraded ? ' · DATA DEGRADED' : ''} · ES ${esc(e.esResolvedSymbol || '')}</small></div>
    <div class="stats">${(() => { const bp = BIGGER_PICTURE[String(w.character?.state || w.state || '').toUpperCase()] || L(w.character?.state || w.state); const oh = OVERALL_HEALTH[String(e.overallState || d.overall || '').toUpperCase()] || L(e.overallState || d.overall); return stat('1W bigger picture', esc(bp), esc(w.summary || ''), 'structural', 'scan', tone29(bp)) + stat('ES daily trend', esc(TREND(ep.daily?.state)), E(ep.daily?.color), 'current contract', 'chart', tone29(ep.daily?.state)) + stat('ES weekly trend', esc(TREND(ep.weekly?.state)), E(ep.weekly?.color), 'recent candles only', 'chart', tone29(ep.weekly?.state)) + stat('Overall market health', esc(oh), esc(d.overallSummary || ''), 'Engine 29', 'shield', tone29(oh)); })()}</div>
    <div class="stats">${(() => { const pb = PRICE_BREADTH[String(w.priceBreadth?.state || '').toUpperCase()] || L(w.priceBreadth?.state); const sell = DISTRIBUTION(sp.distributionLabel); const part = String(sp.breadth?.label || '').toUpperCase().replace(/^BREADTH_PARTICIPATION_/, ''); return stat('How much of the market is participating', esc(pb), E(w.character?.participationDiagnostic?.state), 'participation diagnostic', 'sectors', tone29(pb)) + stat('Selling pressure', esc(sell), sp.distributionPressure == null ? '—' : `${f(sp.distributionPressure, 1)} / 100`, 'structural participation', 'target', tone29(sell)) + stat('Stocks participating', E(part || null), sp.breadth?.score == null ? '—' : `score ${sp.breadth.score}`, 'Engine 25 read-only', 'spark', tone29(part)) + stat('1H current pressure', E(d.oneHour?.state), esc(d.oneHour?.summary || ''), 'tactical', 'spark', tone29(d.oneHour?.state)); })()}</div>
    <div class="notice">Weekly ES read uses recent current-contract candles only; it is not long-term continuous-contract authority.</div>
    <div class="grid cols-2">
      ${panel('30m fast shift · ES parent move', body(`${kv('30m fast shift', L(d.thirtyMinute?.state), tone(d.thirtyMinute?.state))}${kv('ES parent move', L(d.thirtyMinute?.status))}${note(d.thirtyMinute?.summary)}`))}
      ${panel('10m live condition — 20m diagnostic', body(`${kv('State', L(lm.state), tone(lm.direction))}${kv('Direction', L(lm.direction), tone(lm.direction))}${kv('Participation', L(lm.participation))}${kv('10m/20m vs parent', L(lm.contextVsParent))}${kv('30m parent', `${L(lm.parent30mState)} · ${L(lm.parent30mDirection)}`)}${kv('Authority', L(lm.authority))}${note(lm.headline)}`))}
    </div>
    <div class="grid cols-2">
      ${panel('Live moves — 10m / 20m', body(moves.length ? `<div class="table-wrap"><table><thead><tr><th>Symbol</th><th>10m</th><th>20m</th><th>Last</th></tr></thead><tbody>${moves.map(([s, v]) => `<tr><td>${esc(s)}</td><td class="number ${n(v.move10) < 0 ? 'down' : 'up'}">${signed(v.move10, 2, '%')}</td><td class="number ${n(v.move20) < 0 ? 'down' : 'up'}">${signed(v.move20, 2, '%')}</td><td class="number">${f(v.latestClose, 2)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="xr-muted">Live moves unavailable.</p>'))}
      ${panel('Why this state?', body((lm.why || []).length ? `<ul class="xr-why">${lm.why.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : '<p class="xr-muted">No explanation published.</p>'))}
    </div>
    <div class="grid cols-3">
      ${panel('Liquidity', body(`${kv('State', L(liq.state))}${kv('Level', liq.level ?? '—')}${kv('Side', L(liq.side))}${kv('Auction', L(liq.auctionResult))}${kv('Reclaim', liq.reclaimObserved ? 'YES' : 'NO')}`))}
      ${panel('Move authority', body(`${kv('Parent', mv.parent?.active ? 'ACTIVE' : 'NO ACTIVE MOVE')}${kv('Parent direction', L(mv.parent?.direction))}${kv('Move character', L(mv.character || mv.moveCharacter))}${kv('Live condition', L(mv.liveCondition))}${kv('Fast state', L(mv.fastState))}${kv('Underlying pressure', L(uth.pressure?.state), tone(uth.pressure?.state))}`))}
      ${panel('Trap detection', body(`${kv('State', L(trap.state))}${kv('Side', L(trap.side))}${kv('Location quality', L(trap.locationQuality))}${kv('Confirmation', L(trap.confirmationQuality))}${kv('Blocked by', (trap.confirmationBlockedBy || []).length ? trap.confirmationBlockedBy.join(', ') : '—')}`))}
    </div>
    ${panel('Market internals map', body(`<div class="table-wrap"><table><thead><tr><th>Internal</th><th>State</th><th>1W</th><th>1H</th><th>30m</th><th>Now</th></tr></thead><tbody>${groupRows.map(([g, label, now]) => { const gr = e.groups?.[g] || {}; const cell = v => `<td class="${tone29(v)}">${esc(v || '—')}</td>`; const w1 = GROUP_LABEL(g, gr.structural?.state); return `<tr><td>${label}</td>${cell(w1 || uth[now])}${cell(w1)}${cell(GROUP_LABEL(g, gr.tactical?.state))}${cell(GROUP_LABEL(g, gr.fastTactical?.state))}${cell(uth[now])}</tr>`; }).join('')}</tbody></table></div>`), btn('Open strategies / Engine 26 planner', 'strategies', false, 'arrow'))}`;
  }

  window.redlineXraySections = x => engine25(x) + engine29(x);

  document.addEventListener('click', ev => {
    const b = ev.target.closest?.('[data-xr-tab]'); if (!b) return;
    const [group, key] = b.dataset.xrTab.split(':');
    ui[group] = key;
    if (typeof render === 'function') render();
  });
})();
