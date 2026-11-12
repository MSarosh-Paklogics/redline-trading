'use strict';
/* Supercar-style instrument cluster on the dashboard (presentation layer, live data only).
   - Tachometer (red face): ES Master meter 0–100, drawn as 0–10 ×10.
   - Speedometer: 65/20/15 trade-permission score 0–100 with the MIRRORED thresholds as arcs.
   - Gear window: Engine 15 bias → N / L / S.  Warning lamps: Engine 6, Engine 25 risk-off,
     data degraded, live.
   - Left TFT: clock, breadth / buy volume / market health / distribution bars, ES "odometer",
     net new highs/lows.  Right NAV: ES position against the Engine 26 zone and acc/dist shelves.
   Everything is read from window.redlineXray.model and window.redlineChart.model; missing values
   render as "—" and their needles rest at zero with an "UNAVAILABLE" label. No engine result is
   recomputed; distances to zones are display arithmetic only. Generic styling, no brand marks. */
(() => {
  if (typeof overview !== 'function') return;
  const n = v => { const x = Number(v); return v == null || v === '' || !Number.isFinite(x) ? null : x; };
  const f = (v, d = 1) => n(v) == null ? '—' : n(v).toFixed(d);
  const U = v => String(v ?? '').toUpperCase();
  const pt = (cx, cy, r, deg) => [cx + r * Math.cos(deg * Math.PI / 180), cy + r * Math.sin(deg * Math.PI / 180)];
  const arc = (cx, cy, r, a, b) => { const s = pt(cx, cy, r, a), e = pt(cx, cy, r, b); return `M${s[0].toFixed(2)},${s[1].toFixed(2)} A${r},${r} 0 ${b - a > 180 ? 1 : 0} 1 ${e[0].toFixed(2)},${e[1].toFixed(2)}`; };
  const A0 = 135, SWEEP = 270, ang = p => A0 + Math.max(0, Math.min(1, p)) * SWEEP;

  function dial({ id, value, max = 100, face, labels, step, minor, zones = [], unit, title, readout }) {
    const C = 110, has = n(value) != null, p = has ? n(value) / max : 0;
    const ticks = [];
    for (let v = 0; v <= max + 1e-9; v += minor) {
      const major = Math.abs(v / step - Math.round(v / step)) < 1e-6, a = ang(v / max);
      const [x1, y1] = pt(C, C, major ? 80 : 85, a), [x2, y2] = pt(C, C, 93, a);
      ticks.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${major ? 'cc-maj' : 'cc-min'}"/>`);
    }
    const nums = labels.map(([v, t]) => { const [x, y] = pt(C, C, 66, ang(v / max)); return `<text x="${x}" y="${y + 5}" class="cc-num">${t}</text>`; }).join('');
    const bands = zones.map(([a, b, cls]) => `<path d="${arc(C, C, 96, ang(a / max), ang(b / max))}" class="cc-band ${cls}"/>`).join('');
    return `<svg class="cc-dial ${face}" viewBox="0 0 220 220" role="img" aria-label="${title}: ${has ? f(value) : 'unavailable'}">
      <defs><radialGradient id="${id}-face" cx="50%" cy="45%" r="60%"><stop offset="0" class="cc-face-a"/><stop offset="1" class="cc-face-b"/></radialGradient></defs>
      <circle cx="${C}" cy="${C}" r="106" class="cc-bezel"/><circle cx="${C}" cy="${C}" r="99" fill="url(#${id}-face)" class="cc-face"/>
      ${bands}${ticks.join('')}${nums}
      <text x="${C}" y="${C - 30}" class="cc-unit">${unit}</text>
      <g class="cc-needle" style="--cc-angle:${ang(p)}deg"><path d="M${C - 16},${C - 2.2} L${C + 86},${C - .6} L${C + 86},${C + .6} L${C - 16},${C + 2.2} Z" class="cc-needle-blade"/></g>
      <circle cx="${C}" cy="${C}" r="13" class="cc-cap"/><circle cx="${C}" cy="${C}" r="4" class="cc-cap-dot"/>
      <text x="${C}" y="${C + 46}" class="cc-read ${has ? '' : 'na'}">${has ? readout : '—'}</text>
      <text x="${C}" y="${C + 62}" class="cc-title">${title}</text>
    </svg>`;
  }

  function bar(label, value, unit = '%', max = 100) {
    const v = n(value), w = v == null ? 0 : Math.max(0, Math.min(100, v / max * 100));
    return `<div class="cc-bar"><span>${label}</span><i><b style="width:${w}%"></b>${[25, 50, 75].map(t => `<em style="left:${t}%"></em>`).join('')}</i><strong>${v == null ? '—' : `${Math.round(v)}${unit}`}</strong></div>`;
  }

  function tft(x, cm) {
    const hb = x?.hourly || {}, h = x?.headline || {}, price = n(cm?.currentPrice) ?? n(h.esClose), net = n(x?.nhnl?.intradayNetHighsLows);
    const time = new Date().toLocaleTimeString('en-US', { timeZone: 'America/Phoenix', hour: '2-digit', minute: '2-digit', hour12: false });
    return `<div class="cc-screen cc-tft"><div class="cc-scr-head"><b>${time}</b><span>AZ</span><em class="${x ? 'on' : ''}">${x ? 'LIVE' : '—'}</em></div>
      ${bar('BREADTH', hb.buyBreadth)}${bar('BUY VOL', hb.buyVolume)}${bar('HEALTH', h.score, '')}${bar('DIST', x?.distribution?.raw, '')}
      <div class="cc-odo"><div><small>ES</small><b>${price == null ? '—' : price.toFixed(2)}</b></div><div><small>NET NH/NL</small><b class="${net == null ? '' : net < 0 ? 'down' : 'up'}">${net == null ? '—' : (net > 0 ? '+' : '') + net}</b></div></div></div>`;
  }

  function routePage(x, cm) {
    const price = n(cm?.currentPrice) ?? n(x?.headline?.esClose);
    const zones = [];
    const ez = cm?.e26?.entryZone; if (n(ez?.low) != null && n(ez?.high) != null) zones.push({ lo: n(ez.low), hi: n(ez.high), kind: 'e26', label: 'E26 ZONE' });
    (cm?.shelves || []).forEach(s => { const lo = n(s.lo), hi = n(s.hi); if (lo != null && hi != null) zones.push({ lo, hi, kind: /dist/i.test(s.type) ? 'dist' : 'acc', label: /dist/i.test(s.type) ? 'DIST' : 'ACC' }); });
    if (price == null || !zones.length) return { head: 'ES LOCATION', tag: '', body: '<p class="cc-na">Zone map unavailable.</p>' };
    const lo = Math.min(price, ...zones.map(z => z.lo)) - 6, hi = Math.max(price, ...zones.map(z => z.hi)) + 6, H = 150, y = v => (hi - v) / (hi - lo) * H;
    const above = zones.filter(z => z.lo > price).sort((a, b) => a.lo - b.lo)[0], below = zones.filter(z => z.hi < price).sort((a, b) => b.hi - a.hi)[0];
    const inside = zones.find(z => price >= z.lo && price <= z.hi);
    const road = `<svg class="cc-road" viewBox="0 0 120 ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="M40 0 L80 0 L100 ${H} L20 ${H} Z" class="cc-road-bg"/><line x1="60" x2="60" y1="0" y2="${H}" class="cc-road-mid"/>
      ${zones.map(z => `<rect x="18" width="84" y="${y(z.hi)}" height="${Math.max(3, y(z.lo) - y(z.hi))}" class="cc-zone ${z.kind}"/>`).join('')}
      <g transform="translate(60 ${y(price)})" class="cc-car"><path d="M0 -9 L6 7 L0 4 L-6 7 Z"/></g></svg>`;
    const row = (k, z, d) => `<div class="cc-nav-row"><small>${k}</small><b>${z ? `${z.label} ${z.lo.toFixed(2)}–${z.hi.toFixed(2)}` : '—'}</b><em>${z ? `${d > 0 ? '+' : ''}${d.toFixed(2)} pts` : ''}</em></div>`;
    return { head: `ES ${price.toFixed(2)}`, tag: `<em class="${inside ? 'on' : ''}">${inside ? 'IN ' + inside.label : 'IN TRANSIT'}</em>`, body: `<div class="cc-nav-body">${road}<div>${row('NEXT ABOVE', above, above ? above.lo - price : 0)}${row('NEXT BELOW', below, below ? below.hi - price : 0)}<p class="cc-na">Engine 26 zone + acc/dist shelves. Location only, not permission.</p></div></div>` };
  }
  /* NAV pages: the Engine 25 Market X-Ray top section (same fields as Frye Engine25MarketXrayPreview),
     one page per block, cycling like a sat-nav display. Display only. */
  const L = v => v == null || v === '' ? 'UNAVAILABLE' : String(v).replace(/_/g, ' ').toUpperCase();
  const tTone = v => /BEAR|RISK.?OFF|WEAK|DANGER|EXTREME|HIGH|SEVERE|STALE|UNAVAILABLE|SELLING|DEFENSIVE|STRONGER THAN ES/i.test(v || '') ? 'down' : /BULL|RISK.?ON|STRONG|HEALTHY|LIVE|FRESH|EASING|BUYING|LONG BIAS/i.test(v || '') ? 'up' : 'yellow';
  const sTone = v => n(v) == null ? '' : n(v) >= 65 ? 'up' : n(v) >= 50 ? 'yellow' : 'down';
  const kv = (k, v, t = '') => `<div class="cc-kv"><span>${k}</span><b class="${t}">${v}</b></div>`;
  const pct = (v, d = 0) => n(v) == null ? '—' : `${n(v).toFixed(d)}%`;
  const big = (v, label, t) => `<div class="cc-big-read"><b class="${t}">${v}</b><span class="${tTone(label)}">${label}</span></div>`;
  const azTime = t => { const d = Date.parse(t || ''); return Number.isFinite(d) ? new Date(d).toLocaleString('en-US', { timeZone: 'America/Phoenix', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' AZ' : '—'; };
  const DIST_STATE = { BUYING_RECOVERY_CONFIRMED: 'BUYING RECOVERY', BUYING_RECOVERY_PENDING: 'BUYING RECOVERY — PENDING', SELLING_PRESSURE_CONFIRMED: 'SELLING PRESSURE', SELLING_PRESSURE_PENDING: 'SELLING PRESSURE — PENDING', FAST_BUYING_RECOVERY_CONFIRMED: 'FAST IMPROVEMENT', FAST_SELLING_ACCELERATION_CONFIRMED: 'FAST SELLING', NO_MATERIAL_CHANGE: 'NO MATERIAL CHANGE', NONE: 'NO MATERIAL CHANGE' };
  const distRead = fr => !fr || !fr.available ? 'UNAVAILABLE' : fr.state ? DIST_STATE[U(fr.state)] || L(fr.state) : L(fr.label);
  const pw = v => n(v) == null ? null : n(v) * 100;

  function xrayPages(x) {
    if (!x) return [];
    const p = x.permission || {}, h = x.headline || {}, hb = x.hourly || {}, sec = x.sectors || {}, b = x.blended || {}, sd = x.sourceDiagnostics || {};
    const dd = x.distributionDetail || {}, comp = dd.components || {}, fr = k => (dd.frames || []).find(z => z.key === k);
    const master = n(x.meter?.master), broader = n(x.broader), diff = master == null || broader == null ? null : master - broader;
    const imb = hb.buyVolume == null ? null : Math.abs(100 - 2 * hb.buyVolume);
    const dRaw = n(x.distribution?.raw), press = v => v == null ? '—' : `${f(v, 0)} / 100`;
    return [
      { title: 'TRADE PERMISSION', head: '65 / 20 / 15', body: big(f(p.score, 0), L(p.label), sTone(p.score)) + `<p class="cc-na">${p.text || ''}</p>` + kv('ES MASTER · 65%', `${f(p.master)} ${L(p.masterState)}`, sTone(p.master)) + kv('4H · 20%', `${f(p.m4h)} ${L(p.m4hState)}`, sTone(p.m4h)) + kv('EOD STRUCTURE · 15%', `${f(p.recon)} ${L(p.reconState)}`, sTone(p.recon)) + kv('SIZING', L(p.sizing), tTone(p.sizing)) },
      { title: 'MARKET HEALTH', head: 'ENGINE 25', body: big(f(h.score, 0), L(h.label), sTone(h.score)) + kv('OVERALL CONDITION', L(h.label), tTone(h.label)) + kv('BROADER PARTICIPATION', L(x.breadthLabel), tTone(x.breadthLabel)) + kv('DATA STATUS', L(x.dataStatus), tTone(x.dataStatus)) + kv('LAST UPDATE', azTime(h.lastUpdatedAt)) },
      { title: 'PARTICIPATION', head: `${f(hb.scanned, 0)} STOCKS`, body: big(L(b.state), `SURVIVING ${pct(pw(b.usableEffectiveWeight), 1)}`, tTone(b.state)) + ['10m', '1h', '4h', 'eod'].map(k => { const d = sd[k] || {}; return kv(`${k.toUpperCase()} · ${L(d.freshnessState)}`, `${L(d.timeframeState)} · ${pct(pw(d.effectiveWeight))}`, tTone(d.timeframeState)); }).join('') + kv('FAST / 10M', L(x.fastParticipation?.state || sd['10m']?.timeframeState), tTone(x.fastParticipation?.state || sd['10m']?.timeframeState)) },
      { title: '1H MARKET EVIDENCE', head: `${pct(hb.coverage, 1)} COVERAGE`, body: kv('SCANNED / WITH VOL', `${f(hb.scanned, 0)} / ${f(hb.withVol, 0)}`) + kv('ADVANCING', hb.up == null ? '—' : `${f(hb.up, 0)} (${pct(hb.buyBreadth)})`, 'up') + kv('DECLINING', hb.down == null ? '—' : `${f(hb.down, 0)} (${pct(hb.buyBreadth == null ? null : 100 - hb.buyBreadth)})`, 'down') + kv('NEW HIGHS / LOWS', `${f(x.hourlyNhNl?.nh, 0)} / ${f(x.hourlyNhNl?.nl, 0)}`) + kv('SECTORS', sec.strong == null ? '—' : `${sec.neutral} MIXED · ${sec.strong} BULL · ${sec.weak} BEAR`) + kv('ADVANCING VOLUME', pct(hb.buyVolume, 1), 'up') + kv('IMBALANCE', imb == null ? '—' : `${pct(imb, 1)} TOWARD ${hb.buyVolume < 50 ? 'SELLING' : 'BUYING'}`, hb.buyVolume < 50 ? 'down' : 'up') },
      { title: 'DISTRIBUTION', head: '4H STRUCTURE', body: big(dRaw == null ? '—' : f(dRaw, 0), L(x.distribution?.label), dRaw == null ? '' : dRaw >= 60 ? 'down' : dRaw >= 40 ? 'yellow' : 'up') + kv('BREADTH PRESSURE', press(comp.breadthPressure)) + kv('VOLUME PRESSURE', press(comp.volumePressure)) + kv('NH/NL PRESSURE', press(comp.highLowPressure)) + kv('SECTOR PRESSURE', press(comp.sectorPressure)) + kv('1H TREND', distRead(fr('tactical1h')), tTone(distRead(fr('tactical1h')))) + kv('30M CONFIRMATION', distRead(fr('confirmation30m')), tTone(distRead(fr('confirmation30m')))) + kv('10M ACCELERATION', distRead(fr('acceleration10m')), tTone(distRead(fr('acceleration10m')))) },
      { title: 'INDEX VS BROADER MARKET', head: 'ES VS STOCKS', body: big(diff == null ? '—' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}`, diff == null ? 'UNAVAILABLE' : diff > 0 ? 'ES HOLDING UP BETTER' : 'BROADER MARKET STRONGER THAN ES', diff == null ? '' : diff > 0 ? 'yellow' : 'down') + kv('ES STRENGTH', f(master), sTone(master)) + kv('BROADER MARKET STRENGTH', f(broader, 0), sTone(broader)) + kv('ES PRICE', f(x.headline?.esClose, 2)) + kv('PARTICIPATION', L(x.breadthLabel), tTone(x.breadthLabel)) }
    ];
  }

  let navIdx = 0, navHold = 0;
  function nav(x, cm) {
    const r = routePage(x, cm);
    const pages = [{ title: 'NAV · ROUTE', head: r.head, tag: r.tag, body: r.body }, ...xrayPages(x)];
    navIdx = ((navIdx % pages.length) + pages.length) % pages.length;
    const titles = pages.map((pg, i) => `<span class="cc-nav-title ${i === navIdx ? 'on' : ''}" data-cc-title="${i}"><b>${pg.title}</b><i>${pg.head}</i></span>`).join('');
    const bodies = pages.map((pg, i) => `<div class="cc-nav-page ${i === navIdx ? 'on' : ''}" data-cc-page="${i}">${pg.tag ? `<div class="cc-nav-tag">${pg.tag}</div>` : ''}${pg.body}</div>`).join('');
    const dots = pages.map((pg, i) => `<button type="button" class="${i === navIdx ? 'on' : ''}" data-cc-go="${i}" aria-label="${pg.title}"></button>`).join('');
    return `<div class="cc-screen cc-nav" data-cc-pages="${pages.length}"><div class="cc-scr-head cc-nav-head"><button type="button" class="cc-nav-btn" data-cc-nav="-1" aria-label="Previous screen">‹</button><div class="cc-nav-titles">${titles}</div><button type="button" class="cc-nav-btn" data-cc-nav="1" aria-label="Next screen">›</button></div>${bodies}<div class="cc-nav-dots">${dots}</div></div>`;
  }
  function showNav(i) {
    const scr = document.querySelector('.cc-nav'); if (!scr) return;
    const count = Number(scr.dataset.ccPages) || 1;
    navIdx = ((i % count) + count) % count;
    scr.querySelectorAll('[data-cc-page]').forEach(el => el.classList.toggle('on', Number(el.dataset.ccPage) === navIdx));
    scr.querySelectorAll('[data-cc-title]').forEach(el => el.classList.toggle('on', Number(el.dataset.ccTitle) === navIdx));
    scr.querySelectorAll('[data-cc-go]').forEach(el => el.classList.toggle('on', Number(el.dataset.ccGo) === navIdx));
  }
  document.addEventListener('click', ev => {
    const step = ev.target.closest?.('[data-cc-nav]'), go = ev.target.closest?.('[data-cc-go]');
    if (!step && !go) return;
    navHold = Date.now() + 30000;          // the user is reading: pause the auto-cycle for 30 s
    showNav(go ? Number(go.dataset.ccGo) : navIdx + Number(step.dataset.ccNav));
  });
  setInterval(() => {
    const scr = document.querySelector('.cc-nav');
    if (!scr || document.hidden || Date.now() < navHold || scr.matches(':hover')) return;
    showNav(navIdx + 1);
  }, 8000);


  function lamps(x, cm) {
    const e6 = U(cm?.e6?.permission), riskOff = /RISK.OFF/.test(U(x?.headline?.state)) || U(x?.headline?.color) === 'RED';
    const degraded = x?.e29?.dataDegraded === true || (x && U(x.dataStatus) !== 'LIVE');
    const lamp = (on, cls, label, title) => `<span class="cc-lamp ${on ? 'on ' + cls : ''}" title="${title}">${label}</span>`;
    return `<div class="cc-lamps">${lamp(e6 && e6 !== 'ALLOW', 'red', 'E6', `Engine 6: ${e6 || 'UNAVAILABLE'}`)}${lamp(riskOff, 'red', 'RISK', 'Engine 25 risk-off')}${lamp(degraded, 'amber', 'DATA', 'Data degraded or not live')}${lamp(!!(x && cm), 'green', 'LIVE', 'Live backend')}</div>`;
  }


  /* Gated shifter driven by the ES Master meter (client spec 2026-11-11): R below 50 (defensive),
     N 50-62 (neutral, yellow), gears 1-4 in 7-point steps from 63, TURBO at 90+ (full acceleration).
     It reads the Engine 25 ES Master meter only: a market-pace gauge, not a trade or a permission. */
  const GEARS = [
    { g: 'R', min: -Infinity, tone: 'down', short: 'DEFENSIVE' },
    { g: 'N', min: 50, tone: 'yellow', short: 'NEUTRAL' },
    { g: '1', min: 63, tone: 'up', short: 'PULLING AWAY' },
    { g: '2', min: 70, tone: 'up', short: 'BUILDING' },
    { g: '3', min: 77, tone: 'up', short: 'STRONG' },
    { g: '4', min: 84, tone: 'up', short: 'FULL POWER' },
    { g: 'T', min: 90, tone: 'turbo', short: 'TURBO · FULL ACCELERATION' }
  ];
  const gearFor = x => { const v = n(x?.meter?.master); return v == null ? null : { ...[...GEARS].reverse().find(r => v >= r.min), value: v }; };
  function gate(x) {
    const cur = gearFor(x);
    // H-pattern: R 1 3 T on top, 2 4 below, neutral on the centre rail.
    const POS = { R: [26, 34], 1: [62, 34], 2: [62, 114], 3: [98, 34], 4: [98, 114], T: [134, 34], N: [80, 74] };
    const slots = ['R', '1', '3', 'T'].map(g => `<path d="M${POS[g][0]} 34 V74" class="cc-slot"/>`).join('') + ['2', '4'].map(g => `<path d="M${POS[g][0]} 74 V114" class="cc-slot"/>`).join('');
    const nums = GEARS.filter(r => r.g !== 'N').map(r => `<text x="${POS[r.g][0]}" y="${POS[r.g][1] < 74 ? 18 : 140}" class="cc-gnum ${r.g === 'T' ? 'cc-gturbo ' : ''}${cur?.g === r.g ? 'on ' + r.tone : ''}">${r.g === 'T' ? 'TURBO' : r.g}</text>`).join('');
    const [kx, ky] = cur ? POS[cur.g] : POS.N;
    const label = !cur ? 'GEAR —' : cur.g === 'T' ? 'TURBO' : cur.g === 'R' ? 'REVERSE' : cur.g === 'N' ? 'NEUTRAL' : `GEAR ${cur.g}`;
    return `<div class="cc-gate ${cur ? cur.tone : ''}" title="Gear from the ES Master meter: R <50 · N 50-62 · 1 63-69 · 2 70-76 · 3 77-83 · 4 84-89 · TURBO 90+. Not a trade permission — Engine 6 decides.">
      <svg viewBox="0 0 160 150" class="cc-gate-svg" role="img" aria-label="ES meter gear ${label}">
        <defs><linearGradient id="cc-metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5a5c60"/><stop offset=".45" stop-color="#2a2b2e"/><stop offset="1" stop-color="#46484c"/></linearGradient>
        <radialGradient id="cc-knob" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#c9cbcf"/><stop offset="1" stop-color="#55575c"/></radialGradient></defs>
        <rect x="6" y="24" width="148" height="102" rx="12" fill="url(#cc-metal)" class="cc-plate"/>
        <rect x="6" y="24" width="148" height="102" rx="12" class="cc-plate-edge"/>
        <path d="M26 74 H134" class="cc-slot"/>${slots}${nums}<text x="80" y="66" class="cc-gnum cc-gn ${cur?.g === 'N' ? 'on yellow' : ''}">N</text>
        <g class="cc-knob" style="--kx:${kx}px;--ky:${ky}px"><circle r="13" fill="#000" opacity=".45" cx="1.5" cy="2.5"/><circle r="12" fill="url(#cc-knob)" class="cc-knob-ball"/><circle r="5.2" class="cc-knob-top ${cur ? cur.tone : ''}"/></g>
      </svg>
      <div class="cc-gear-read"><b class="${cur ? cur.tone : ''}">${label}</b><span>${cur ? `${cur.short} · ${f(cur.value, 1)}` : 'UNAVAILABLE'}</span><small>ES MASTER METER GEAR</small></div>
    </div>`;
  }

  /* ---------- Command screen: an in-car centre display showing everything at once ----------
     Left: car status (ES price, risk gear, decision chain incl. Engine 6). Centre: NAV route as a
     sat-nav map (ES against the Engine 26 zone and acc/dist shelves). Right: the six X-Ray readouts.
     Street pattern on the map is decoration; every number is live backend data. Display only. */
  /* ---------- Command-screen sat-nav map (interactive, live) ----------
     Layers: Engine 26 zone, institutional smart-money zones (ES SMZ), accumulation / distribution
     shelves. Controls: layer toggles, zoom (fit / near / close), 2D-3D tilt, recentre, tap a zone for
     its details. The ES marker follows live ticks from the hero-candles stream and leaves a short
     breadcrumb trail of recent 10m closes. Street pattern is decoration; zones and prices are live. */
  const csMap = { zoom: 'near', tilt: true, sel: null, layers: { e26: true, smz: true, acc: true, dist: true } };
  const ZOOM = { fit: null, near: 60, close: 25 };
  const LAYER_LABEL = { e26: 'E26 ZONE', smz: 'INSTITUTIONAL', acc: 'ACCUMULATION', dist: 'DISTRIBUTION' };

  function livePrice(cm, x) {
    const hb = window.redlineHeroCandles?.bars;
    return n(hb?.at?.(-1)?.c) ?? n(cm?.currentPrice) ?? n(x?.headline?.esClose);
  }

  function routeData(x, cm) {
    const price = livePrice(cm, x);
    const all = [];
    const ez = cm?.e26?.entryZone; if (n(ez?.low) != null && n(ez?.high) != null) all.push({ lo: n(ez.low), hi: n(ez.high), kind: 'e26', label: 'E26 ZONE', meta: `${L(cm?.e26?.status)} · ${L(cm?.e26?.setupClass || ez.type)}` });
    (cm?.shelves || []).forEach(s => { const lo = n(s.lo), hi = n(s.hi); if (lo != null && hi != null) { const k = /dist/i.test(s.type) ? 'dist' : 'acc'; all.push({ lo, hi, kind: k, label: k === 'dist' ? 'DIST' : 'ACC', meta: `STRENGTH ${s.strength ?? '—'} · ${String(s.timeframe || '').toUpperCase()}` }); } });
    (cm?.smz || []).forEach(z => { const r = z.displayPriceRange || z.priceRange; const a = n(r?.[0]), b = n(r?.[1]); if (a != null && b != null) all.push({ lo: Math.min(a, b), hi: Math.max(a, b), kind: 'smz', label: 'INST', meta: `${L(z.type)} · STRENGTH ${z.strength ?? '—'}` }); });
    all.forEach((z, i) => { z.id = `z${i}`; });
    const zones = all.filter(z => csMap.layers[z.kind]);
    const above = price == null ? null : zones.filter(z => z.lo > price).sort((a, b) => a.lo - b.lo)[0] || null;
    const below = price == null ? null : zones.filter(z => z.hi < price).sort((a, b) => b.hi - a.hi)[0] || null;
    const inside = price == null ? null : zones.find(z => price >= z.lo && price <= z.hi) || null;
    return { price, zones, all, above, below, inside };
  }

  const MAP_W = 420, MAP_H = 360, rx = yy => 210 + 46 * Math.sin(yy / 52);
  function mapWindow(r) {
    const span = ZOOM[csMap.zoom];
    if (span && r.price != null) return { lo: r.price - span, hi: r.price + span };
    const near = r.zones.filter(z => r.price == null || Math.abs((z.lo + z.hi) / 2 - r.price) < 400);
    const vals = [r.price, ...near.flatMap(z => [z.lo, z.hi])].filter(v => v != null);
    return { lo: Math.min(...vals) - 8, hi: Math.max(...vals) + 8 };
  }

  function mapSvg(r) {
    const streets = [
      'M-10 40 L430 70', 'M-10 120 L430 105', 'M-10 210 L430 230', 'M-10 300 L430 285', 'M-10 350 L430 340',
      'M40 -10 L70 370', 'M120 -10 L100 370', 'M300 -10 L330 370', 'M380 -10 L360 370', 'M-10 170 L180 -10', 'M240 370 L430 160'
    ].map((d, i) => `<path d="${d}" class="cs-street ${i % 3 ? '' : 'major'}"/>`).join('');
    const blocks = [[55, 75, 40, 30], [130, 125, 50, 60], [250, 90, 36, 50], [320, 240, 50, 30], [60, 230, 44, 50], [150, 300, 60, 32], [270, 300, 40, 28]].map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" class="cs-block"/>`).join('');
    const water = '<path d="M-10 255 C 80 240, 140 270, 210 262 S 340 250, 430 268 L430 290 C 340 272, 260 290, 210 284 S 80 262, -10 278 Z" class="cs-water"/>';
    if (r.price == null) return `<svg viewBox="0 0 ${MAP_W} ${MAP_H}" class="cs-map-svg" aria-hidden="true">${water}${streets}${blocks}</svg>`;
    const win = mapWindow(r), y = v => 28 + (win.hi - v) / (win.hi - win.lo) * (MAP_H - 56);
    const pts = []; for (let yy = MAP_H + 10; yy >= -10; yy -= 6) pts.push(`${rx(yy).toFixed(1)},${yy}`);
    const cy = y(r.price), cx = rx(cy);
    const ahead = pts.filter(p => Number(p.split(',')[1]) <= cy).join(' '), behind = pts.filter(p => Number(p.split(',')[1]) >= cy).join(' ');
    const visible = r.zones.filter(z => z.hi >= win.lo && z.lo <= win.hi);
    const zoneEls = visible.map(z => {
      const y1 = Math.max(4, y(Math.min(z.hi, win.hi))), y2 = Math.min(MAP_H - 4, y(Math.max(z.lo, win.lo))), mid = (y1 + y2) / 2, zx = rx(mid), w = z.kind === 'smz' ? 132 : 108;
      const on = r.inside && r.inside.id === z.id, sel = csMap.sel === z.id;
      return `<g class="cs-zone ${z.kind}${on ? ' inside' : ''}${sel ? ' sel' : ''}" data-cs-zone="${z.id}" tabindex="0" role="button" aria-label="${z.label} ${z.lo.toFixed(2)} to ${z.hi.toFixed(2)}"><rect x="${zx - w / 2}" y="${y1}" width="${w}" height="${Math.max(6, y2 - y1)}" rx="8"/><text x="${zx + w / 2 + 8}" y="${mid + 3}">${z.label} ${z.lo.toFixed(0)}–${z.hi.toFixed(0)}</text></g>`;
    }).join('');
    const ticks = [0.12, 0.5, 0.88].map(f => { const v = win.hi - f * (win.hi - win.lo); return `<text x="8" y="${y(v) + 3}" class="cs-tick">${v.toFixed(0)}</text>`; }).join('');
    const trail = (window.redlineHeroCandles?.bars || []).slice(-24, -1).map((b, i, a) => { const v = n(b.c); if (v == null || v < win.lo || v > win.hi) return ''; const yy = y(v); return `<circle cx="${rx(yy).toFixed(1)}" cy="${yy.toFixed(1)}" r="${1.4 + i / a.length * 2.2}" class="cs-trail" style="opacity:${(0.12 + i / a.length * 0.6).toFixed(2)}"/>`; }).join('');
    return `<svg viewBox="0 0 ${MAP_W} ${MAP_H}" class="cs-map-svg" role="img" aria-label="ES ${r.price.toFixed(2)} relative to zones" data-lo="${win.lo}" data-hi="${win.hi}">
      ${water}${streets}${blocks}${zoneEls}
      <polyline points="${behind}" class="cs-route-done"/><polyline points="${ahead}" class="cs-route-glow"/><polyline points="${ahead}" class="cs-route"/><polyline points="${ahead}" class="cs-route-flow"/>
      ${trail}${ticks}
      <g class="cs-me" style="transform:translate(${cx.toFixed(1)}px,${cy.toFixed(1)}px)"><circle r="20" class="cs-me-halo"/><circle r="12" class="cs-me-ring"/><path d="M0 -8 L6 6 L0 3 L-6 6 Z" class="cs-me-arrow"/><text y="-18" class="cs-me-price">${r.price.toFixed(2)}</text></g>
    </svg>`;
  }

  function navInstr(dir, z, price) {
    if (!z || price == null) return `<div class="cs-instr ${dir} none"><span class="cs-arrow">${dir === 'up' ? '↑' : '↓'}</span><div><b>—</b><small>NO ZONE ${dir === 'up' ? 'ABOVE' : 'BELOW'} ON ACTIVE LAYERS</small></div></div>`;
    const d = dir === 'up' ? z.lo - price : z.hi - price;
    return `<div class="cs-instr ${dir}" data-cs-zone="${z.id}" role="button" tabindex="0"><span class="cs-arrow">${dir === 'up' ? '↑' : '↓'}</span><div><b>${d > 0 ? '+' : ''}${d.toFixed(2)} pts</b><small>NEXT ${dir === 'up' ? 'ABOVE' : 'BELOW'} · ${z.label} ${z.lo.toFixed(2)}–${z.hi.toFixed(2)}</small></div></div>`;
  }

  function zoneCard(r) {
    const z = r.all.find(q => q.id === csMap.sel); if (!z) return '';
    const d = r.price == null ? null : r.price > z.hi ? z.hi - r.price : r.price < z.lo ? z.lo - r.price : 0;
    return `<div class="cs-zone-card ${z.kind}"><button type="button" class="cs-x" data-cs-close aria-label="Close">×</button><small>${LAYER_LABEL[z.kind]}</small><b>${z.lo.toFixed(2)} – ${z.hi.toFixed(2)}</b><span>${z.meta || ''}</span><span>Width ${(z.hi - z.lo).toFixed(2)} pts · ${d == null ? '—' : d === 0 ? 'ES IS INSIDE' : `${d > 0 ? '+' : ''}${d.toFixed(2)} pts from ES`}</span><em>Location only — not a trade.</em></div>`;
  }

  function mapInner(x, cm) {
    const r = routeData(x, cm);
    const layers = Object.keys(LAYER_LABEL).map(k => `<button type="button" class="cs-layer ${k}${csMap.layers[k] ? ' on' : ''}" data-cs-layer="${k}" aria-pressed="${csMap.layers[k]}"><i></i>${LAYER_LABEL[k]}<em>${r.all.filter(z => z.kind === k).length}</em></button>`).join('');
    return `<div class="cs-map-stage ${csMap.tilt ? 'tilt' : ''}">${mapSvg(r)}</div>
      ${navInstr('up', r.above, r.price)}
      <div class="cs-map-tools"><button type="button" data-cs-zoom="in" aria-label="Zoom in">+</button><button type="button" data-cs-zoom="out" aria-label="Zoom out">−</button><button type="button" data-cs-zoom="fit" class="${csMap.zoom === 'fit' ? 'on' : ''}">FIT</button><button type="button" data-cs-tilt class="${csMap.tilt ? 'on' : ''}">${csMap.tilt ? '3D' : '2D'}</button><button type="button" data-cs-recenter aria-label="Recentre on ES">◎</button></div>
      <div class="cs-layers">${layers}</div>
      ${zoneCard(r)}
      <div class="cs-map-foot">${navInstr('down', r.below, r.price)}<span class="cs-loc ${r.inside ? 'on' : ''}">${r.inside ? 'IN ' + r.inside.label : 'IN TRANSIT'} · ${csMap.zoom.toUpperCase()}</span></div>`;
  }

  function redrawMap() {
    const el = document.querySelector('[data-cs-map]'); if (!el) return;
    el.innerHTML = mapInner(window.redlineXray?.model, window.redlineChart?.model);
    lastMarkPrice = null; moveMarker();
  }
  document.addEventListener('click', ev => {
    const t = ev.target;
    const z = t.closest?.('[data-cs-zoom]'), l = t.closest?.('[data-cs-layer]'), zone = t.closest?.('[data-cs-zone]');
    if (z) { const order = ['fit', 'near', 'close'], i = order.indexOf(csMap.zoom); csMap.zoom = z.dataset.csZoom === 'fit' ? 'fit' : order[Math.max(0, Math.min(2, i + (z.dataset.csZoom === 'in' ? 1 : -1)))]; return redrawMap(); }
    if (l) { const k = l.dataset.csLayer; csMap.layers[k] = !csMap.layers[k]; return redrawMap(); }
    if (t.closest?.('[data-cs-tilt]')) { csMap.tilt = !csMap.tilt; return redrawMap(); }
    if (t.closest?.('[data-cs-recenter]')) { csMap.zoom = 'near'; csMap.sel = null; return redrawMap(); }
    if (t.closest?.('[data-cs-close]')) { csMap.sel = null; return redrawMap(); }
    if (zone) { csMap.sel = csMap.sel === zone.dataset.csZone ? null : zone.dataset.csZone; return redrawMap(); }
  });
  document.addEventListener('keydown', ev => { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.closest?.('[data-cs-zone]')) { ev.preventDefault(); ev.target.click(); } });

  // Live marker: glide the ES marker with every tick; arrow points the way price last moved.
  let lastMarkPrice = null;
  function moveMarker() {
    const svg = document.querySelector('.cs-map-svg[data-lo]'), me = svg?.querySelector('.cs-me'); if (!me) return;
    const p = livePrice(window.redlineChart?.model, window.redlineXray?.model); if (p == null) return;
    const lo = Number(svg.dataset.lo), hi = Number(svg.dataset.hi);
    if (p < lo || p > hi) { if (lastMarkPrice !== null) redrawMap(); return; }
    const yy = 28 + (hi - p) / (hi - lo) * (MAP_H - 56);
    me.style.transform = `translate(${rx(yy).toFixed(1)}px,${yy.toFixed(1)}px)`;
    if (lastMarkPrice != null && p !== lastMarkPrice) me.classList.toggle('down', p < lastMarkPrice);
    const label = me.querySelector('.cs-me-price'); if (label) label.textContent = p.toFixed(2);
    lastMarkPrice = p;
  }
  setInterval(() => { if (!document.hidden) moveMarker(); }, 1000);

  function chain(cm) {
    if (!cm) return '<p class="cc-na">Decision chain loading…</p>';
    const pills = Object.fromEntries(cm.pills || []), d22 = cm.display?.degrees?.minute || {}, e27 = cm.e27 || {}, e6 = cm.e6 || {};
    const steps = [['WAVE DEVELOPING', 'E22 / E27', d22.badge || d22.direction || e27.decisionState], ['STRATEGY READY', 'E15', pills.READINESS], ['TRADE PERMITTED', 'E6 FINAL', e6.permission]];
    const dirs = [['E15', pills.BIAS], ['E22', d22.direction], ['E27', e27.direction]].map(([k, v]) => [k, /LONG|BULL|UP/i.test(v || '') ? 'LONG' : /SHORT|BEAR|DOWN/i.test(v || '') ? 'SHORT' : null]).filter(([, v]) => v);
    const conflict = new Set(dirs.map(d => d[1])).size > 1 ? `Direction differs: ${dirs.map(([k, v]) => `${k} ${v}`).join(' · ')}` : '';
    return `<div class="cs-chain">${steps.map(([t, o, v], i) => `<div class="cs-step ${tTone(v)}"><i>${i + 1}</i><div><small>${t} · ${o}</small><b>${L(v)}</b></div></div>`).join('')}</div>${conflict ? `<p class="cs-conflict">${conflict}</p>` : ''}`;
  }

  /* ---------- Redline OS: simple car screen ----------
     Home = the car (Enzo 3D model in local demo, F80 photo otherwise) with ES price, ES gear and the
     three-step decision chain, plus ten info apps (named after Brian's X-Ray cards) that show their reading on the tile. Tapping a tile
     opens it full screen; the system bar has back and home only. Only the screen re-renders. Display only. */
  const csOS = { app: 'home', prev: [], idx: 0 };
  const IC = {
    nav: '<path d="M12 2 L20 21 L12 17 L4 21 Z"/>',
    car: '<path d="M5 15 L6.5 9.5 C7 8 8 7 9.5 7 H14.5 C16 7 17 8 17.5 9.5 L19 15 V19 H17 V17.5 H7 V19 H5 Z M7.5 14.5 a1.4 1.4 0 1 0 0.01 0 M16.5 14.5 a1.4 1.4 0 1 0 0.01 0 M8.2 11 H15.8 L15 8.8 H9 Z"/>',
    permit: '<path d="M12 2 L20 5 V11 C20 16 16.5 20 12 22 C7.5 20 4 16 4 11 V5 Z M8.5 12 L11 14.5 L15.8 9.5" fill="none" stroke="currentColor" stroke-width="2"/>',
    health: '<path d="M2 12 H7 L9 6 L13 18 L15.5 10 L17 12 H22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>',
    partic: '<path d="M4 20 V12 M9 20 V6 M14 20 V10 M19 20 V4" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
    evidence: '<path d="M3 20 H21 M6 16 L10 11 L13 14 L19 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="19" cy="6" r="2"/>',
    dist: '<path d="M7 4 V16 M3.5 12.5 L7 16 L10.5 12.5 M17 4 V20 M13.5 16.5 L17 20 L20.5 16.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    index: '<path d="M12 3 V21 M5 21 H19 M4 8 H20 M4 8 L1.5 14 H6.5 Z M20 8 L17.5 14 H22.5 Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>',
    chart: '<path d="M6 3 V21 M12 6 V18 M18 4 V20" stroke="currentColor" stroke-width="1.6"/><rect x="4" y="7" width="4" height="8" rx="1"/><rect x="10" y="9" width="4" height="5" rx="1"/><rect x="16" y="6" width="4" height="9" rx="1"/>',
    xray: '<path d="M4 8 V4 H8 M16 4 H20 V8 M20 16 V20 H16 M8 20 H4 V16 M7 12 H17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    strategies: '<path d="M2 16 L6 8 L10 14 L14 5 L18 12 L22 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>',
    sectors: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>',
    journal: '<path d="M5 3 H17 C18.5 3 19 4 19 5 V21 H7 C5.9 21 5 20.1 5 19 Z M8 7 H16 M8 11 H16 M8 15 H13" fill="none" stroke="currentColor" stroke-width="1.9"/>',
    meters: '<path d="M3 15 A9 9 0 0 1 21 15" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 15 L16.5 8.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="15" r="2"/>',
    engines: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2 V6 M15 2 V6 M9 18 V22 M15 18 V22 M2 9 H6 M2 15 H6 M18 9 H22 M18 15 H22" stroke="currentColor" stroke-width="1.8"/>',
    stress: '<path d="M12 2 L22 20 H2 Z M12 9 V14 M12 16.5 V17" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round"/>',
    macro: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12 H21 M12 3 C15 6 15 18 12 21 C9 18 9 6 12 3" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    leaders: '<path d="M7 20 V11 M12 20 V5 M17 20 V14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M9 6 L12 3 L15 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    intraday: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7 V12 L15.5 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    settings: '<path d="M12 8.5 A3.5 3.5 0 1 0 12.01 8.5 Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2 V5 M12 19 V22 M2 12 H5 M19 12 H22 M4.9 4.9 L7 7 M17 17 L19.1 19.1 M4.9 19.1 L7 17 M17 7 L19.1 4.9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
  };
  const svgIcon = k => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${IC[k] || ''}</svg>`;

  /* Screen apps, named after Brian's Engine 25 X-Ray cards. Each tile shows its live reading; the
     full-screen app shows the card detail. Display only, backend values only. */
  function apps(x, cm, r) {
    const p = x?.permission || {}, h = x?.headline || {}, b = x?.blended || {}, hb = x?.hourly || {}, score = n(p.score);
    const master = n(x?.meter?.master), broader = n(x?.broader), diff = master == null || broader == null ? null : master - broader;
    const dRaw = n(x?.distribution?.raw), cr = x?.credit?.scores || {}, mac = x?.macro || {};
    const nh = n(x?.hourlyNhNl?.nh), nl = n(x?.hourlyNhNl?.nl), net = nh == null || nl == null ? n(x?.nhnl?.intradayNetHighsLows) : nh - nl;
    const e29 = x?.e29 || {}, brief = x?.briefs?.intraday || [];
    const pg = Object.fromEntries(xrayPages(x).map(q => [q.title, q]));
    const comp = x?.distributionDetail?.components || {}, mt = x?.macroTrends || {};
    const stressTone = v => n(v) == null ? '' : n(v) >= 65 ? 'down' : n(v) >= 50 ? 'yellow' : 'up';
    const signedN = v => v == null ? '—' : `${v > 0 ? '+' : ''}${f(v, 0)}`;
    const paras = list => list.length ? list.map(t => `<p class="cc-na os-para">${esc(t)}</p>`).join('') : '<p class="cc-na">Brief unavailable.</p>';
    return [
      { id: 'permit', details: [['ES master 65%', f(p.master, 1)], ['4H 20% · Recon 15%', `${f(p.m4h, 1)} · ${f(p.recon, 1)}`]], bar: score, name: 'Trade Permission', tile: 't-yellow', value: f(score, 0), sub: L(p.label), tone: sTone(score), page: pg['TRADE PERMISSION'] },
      { id: 'health', details: [['Breadth', L(x?.breadthLabel)], ['Data', L(x?.dataStatus)]], bar: n(h.score), name: 'Market Health', tile: 't-green', value: f(h.score, 0), sub: L(h.label), tone: sTone(h.score), page: pg['MARKET HEALTH'] },
      { id: 'partic', details: [['Scanned', f(hb.scanned, 0)], ['With volume', f(hb.withVol, 0)]], name: 'Market Participation', tile: 't-purple', value: L(b.state), sub: `Surviving ${pct(n(b.usableEffectiveWeight) == null ? null : n(b.usableEffectiveWeight) * 100, 0)}`, tone: tTone(b.state), wide: true, page: { head: `${f(hb.scanned, 0)} STOCKS · BLENDED · 1H EVIDENCE · DISTRIBUTION · SECTORS`, body: window.redlineXraySections?.e25 ? window.redlineXraySections.e25(x, { only: 'participation' }) : pg['PARTICIPATION'].body } },
      { id: 'index', details: [['ES strength', f(master, 1)], ['Broader market', f(broader, 1)]], name: 'Index vs Market', tile: 't-graphite', value: diff == null ? '—' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}`, sub: diff == null ? 'Unavailable' : diff > 0 ? 'ES holding up better' : 'Broader market stronger', tone: diff == null ? '' : diff > 0 ? 'yellow' : 'down', page: pg['INDEX VS BROADER MARKET'] },
      { id: 'stress', details: [['Bond market', f(cr.bondMarket, 0)], ['Liquidity', f(cr.liquidity, 0)]], bar: n(cr.creditFragility), name: 'Financial Stress', tile: 't-red', value: f(cr.creditFragility, 0), sub: L(x?.credit?.label), tone: stressTone(cr.creditFragility),
        page: { head: 'CREDIT · BANKS · BONDS · LIQUIDITY', body: big(f(cr.creditFragility, 0), L(x?.credit?.label), stressTone(cr.creditFragility)) + kv('CREDIT FRAGILITY', f(cr.creditFragility), stressTone(cr.creditFragility)) + kv('MACRO CREDIT', f(cr.creditStress), stressTone(cr.creditStress)) + kv('BOND MARKET', f(cr.bondMarket), stressTone(cr.bondMarket)) + kv('LIQUIDITY', f(cr.liquidity), stressTone(cr.liquidity)) + '<p class="cc-na">Engine 25 credit stress detail. Higher = more stress on equities.</p>' } },
      { id: 'macro', details: [['10Y yield', n(mt.tenYearYield?.current) == null ? '—' : `${f(mt.tenYearYield.current, 2)}%`], ['WTI oil', n(mt.wti?.current) == null ? '—' : f(mt.wti.current, 2)]], bar: n(mac.score), name: 'Macro Pressure', tile: 't-yellow', value: f(mac.score, 0), sub: L(mac.label), tone: stressTone(mac.score),
        page: { head: 'RATES · DOLLAR · OIL', body: big(f(mac.score, 0), L(mac.label), stressTone(mac.score)) + Object.entries(x?.macroTrends || {}).slice(0, 8).map(([k, t]) => kv(L(k), n(t?.current) == null ? '—' : f(t.current, 2))).join('') + `<p class="cc-na">Engine 25 macro pressure${x?.macroFresh ? '' : ' · intraday macro feed not fresh'}.</p>` } },
      { id: 'intraday', details: [['Structural', L(e29.structuralState)], ['Fast tactical', L(e29.fastTacticalState)]], name: 'Intraday', tile: 't-purple', value: L(e29.overallState), sub: 'Engine 29 live market character', tone: tTone(e29.overallState),
        page: { head: 'ENGINE 29 · INTRADAY BRIEF', body: big(L(e29.overallState), `TACTICAL ${L(e29.tacticalState)}`, tTone(e29.overallState)) + kv('STRUCTURAL', L(e29.structuralState), tTone(e29.structuralState)) + kv('TACTICAL', L(e29.tacticalState), tTone(e29.tacticalState)) + kv('FAST TACTICAL', L(e29.fastTacticalState), tTone(e29.fastTacticalState)) + '<p class="cc-kv"><span>INTRADAY BRIEF</span></p>' + paras(brief) } }
    ];
  }


  /* Home = one full record at a time (client request 2026-11-12): each record is the complete
     detail of one of Brian's X-Ray cards, paged with ‹ › arrows and dots. No car backdrop. */
  function homeView(x, cm, r, cur) {
    const list = apps(x, cm, r).filter(a => a.page);
    if (!list.length) return '<div class="os-home os-view"><p class="cc-na">Loading live X-Ray records…</p></div>';
    csOS.idx = ((csOS.idx % list.length) + list.length) % list.length;
    const a = list[csOS.idx];
    const pills = Object.fromEntries(cm?.pills || []), d22 = cm?.display?.degrees?.minute || {}, e6 = cm?.e6 || {}, e27 = cm?.e27 || {};
    const steps = [['WAVE', d22.badge || d22.direction || e27.decisionState], ['READY', pills.READINESS], ['PERMITTED', e6.permission]];
    return `<div class="os-home os-rec os-view">
      <header class="os-rec-head">
        <button type="button" class="os-rec-arrow" data-os-step="-1" aria-label="Previous record">‹</button>
        <div class="os-rec-title"><span class="os-ic ${a.tile} sm">${svgIcon(a.id)}</span><div><b>${esc(a.name)}</b><small>${esc(a.page.head || '')} · ${csOS.idx + 1} / ${list.length}</small></div></div>
        <div class="os-rec-val"><b class="g-${a.tone || 'na'}">${esc(a.value)}</b><small>${esc(a.sub)}</small></div>
        <button type="button" class="os-rec-arrow" data-os-step="1" aria-label="Next record">›</button>
      </header>
      <div class="os-detail os-rec-body${a.wide ? ' os-rec-wide' : ''}">${a.page.body}</div>
      <nav class="os-rec-dots" aria-label="Records">${list.map((q, i) => `<button type="button" data-os-go="${i}" class="${i === csOS.idx ? 'on' : ''}" title="${esc(q.name)}"><span>${esc(q.name)}</span></button>`).join('')}</nav>
      <div class="os-hero-chain">${steps.map(([k, v], i) => `<span class="g-${tTone(v)}"><i>${i + 1}</i><small>${k}</small><b>${L(v)}</b></span>`).join('<em>›</em>')}<span class="os-rec-es"><small>ES · GEAR</small><b>${r.price == null ? '—' : r.price.toFixed(2)} · ${cur ? (cur.g === 'T' ? 'TURBO' : cur.g) : '—'}</b></span></div>
    </div>`;
  }




  function appView(x, cm, r, cur, list) {
    const a = list.find(q => q.id === csOS.app);
    if (!a) return homeView(x, cm, r, cur);
    const bar = (sub) => `<div class="os-appbar"><button type="button" class="os-back" data-os-back aria-label="Back">←</button><span class="os-ic ${a.tile} sm">${svgIcon(a.id)}</span><b>${a.name}</b><small>${sub}</small></div>`;
    if (a.id === 'nav') return `<div class="os-view os-app-view">${bar('ES route · zones · live')}<div class="cs-map os-full-map" data-cs-map>${mapInner(x, cm)}</div></div>`;
    if (a.page) return `<div class="os-view os-app-view">${bar(a.page.head)}<div class="os-detail">${a.page.body}</div></div>`;
    return homeView(x, cm, r, cur);
  }


  function screenInner(x, cm) {
    const r = routeData(x, cm);
    const cur = gearFor(x);
    const list = apps(x, cm, r);
    const time = new Date().toLocaleTimeString('en-US', { timeZone: 'America/Phoenix', hour: '2-digit', minute: '2-digit', hour12: false });
    const title = csOS.app === 'home' ? 'HOME' : (list.find(q => q.id === csOS.app)?.name || '').toUpperCase();
    const view = csOS.app === 'home' ? homeView(x, cm, r, cur) : appView(x, cm, r, cur, list);
    return `<header class="cs-status"><b>${time}</b><span>AZ</span><span class="cs-live ${x ? 'on' : ''}">${x ? 'LIVE' : '—'}</span><em>REDLINE OS · ${title}</em><span class="os-sig" aria-hidden="true"><i></i><i></i><i></i><i></i></span></header>
      ${view}
      <footer class="os-sysbar">
        <div class="os-navkeys"><button type="button" data-os-back aria-label="Back">◁</button><button type="button" data-os-home aria-label="Home" class="${csOS.app === 'home' ? 'on' : ''}">○</button></div>
        <span class="cs-dock-note">Readings only — not a trade. Engine 6 decides.</span></footer>`;
  }

  function commandScreen(x, cm) {
    if (!x && !cm) return '';
    return `<section class="cs-device" aria-label="Command screen"><div class="cs-bezel"><div class="cs-screen" data-os-screen>${screenInner(x, cm)}</div><div class="cs-glare"></div></div></section>`;
  }

  function redrawScreen() {
    const s = document.querySelector('[data-os-screen]'); if (!s) return;
    s.innerHTML = screenInner(window.redlineXray?.model, window.redlineChart?.model);
    lastMarkPrice = null; moveMarker();
    window.dispatchEvent(new Event('redline:screen'));
  }
  document.addEventListener('click', ev => {
    const t = ev.target, open = t.closest?.('[data-os-open]');
    if (open) { if (csOS.app !== open.dataset.osOpen) { csOS.prev.push(csOS.app); csOS.app = open.dataset.osOpen; } return redrawScreen(); }
    if (t.closest?.('[data-os-back]')) { csOS.app = csOS.prev.pop() || 'home'; return redrawScreen(); }
    const stepBtn = t.closest?.('[data-os-step]'), goBtn = t.closest?.('[data-os-go]');
    if (stepBtn) { csOS.app = 'home'; csOS.idx += Number(stepBtn.dataset.osStep); return redrawScreen(); }
    if (goBtn) { csOS.app = 'home'; csOS.idx = Number(goBtn.dataset.osGo); return redrawScreen(); }
    if (t.closest?.('[data-os-home]')) { csOS.app = 'home'; csOS.prev = []; return redrawScreen(); }
  });


  /* Digital readouts under the dials (client request 2026-11-11, replaces the four analog meters).
     Same names, values and notes as Brian's Engine 25 X-Ray stat strip (Engine25MarketXrayPreview
     BigStat row): health, 1H breadth, 1H stock volume, 4H distribution, 1H sectors, data status. */
  function digitalStrip(x) {
    if (!x) return '';
    const h = x.headline || {}, hb = x.hourly || {}, sec = x.sectors || {}, d = x.distribution || {};
    const up = n(hb.up), down = n(hb.down), bd = up != null && down != null ? up + down : null;
    const buyB = bd ? up / bd * 100 : null, sellB = bd ? down / bd * 100 : null;
    const av = n(hb.advVol), dv = n(hb.decVol), vd = av != null && dv != null ? av + dv : null;
    const buyV = vd ? av / vd * 100 : null, sellV = vd ? dv / vd * 100 : null;
    const dRaw = n(d.raw), cov = n(hb.coverage);
    const lvl = (v, t) => t === 'na' ? 'na' : t;
    // [label, big digits, unit, tone, sub line, level 0-100 for the segment bar]
    const cells = [
      ['MARKET HEALTH', f(h.score, 0), '/100', sTone(h.score) || 'na', L(h.label), n(h.score)],
      ['BREADTH', buyB, sellB, 'ADV', 'DEC', '1H stocks advancing vs declining'],
      ['STOCK VOLUME', buyV, sellV, 'BUY', 'SELL', '1H directional volume'],
      ['DISTRIBUTION', dRaw == null ? '—' : String(Math.round(dRaw)), '%', dRaw == null ? 'na' : dRaw >= 70 ? 'down' : dRaw >= 50 ? 'yellow' : 'up', `4H STRUCTURAL · ${L(d.label)}`, dRaw],
      ['SECTORS', sec.neutral == null ? '—' : String(sec.neutral), 'MIXED', 'yellow', sec.strong == null ? 'sector participation unavailable' : `${sec.strong} STRONG · ${sec.weak} WEAK`, sec.neutral == null ? null : sec.neutral / 11 * 100],
      ['DATA', L(x.dataStatus), '', tTone(x.dataStatus) || 'na', cov == null ? 'coverage unavailable' : `${cov.toFixed(1)}% VOLUME COVERAGE`, cov]
    ];
    const SEG = 20;
    const bar = v => v == null ? '' : `<span class="cc-dseg">${Array.from({ length: SEG }, (_, i) => `<i class="${i < Math.round(Math.max(0, Math.min(100, v)) / 100 * SEG) ? 'on' : ''}"></i>`).join('')}</span>`;
    // Two-sided cells (breadth, volume): both sides as digits, and one bar split green | red.
    const split = ([k, a, b, la, lb, note]) => {
      if (a == null || b == null) return `<div class="cc-dig d-na"><small>${k}</small><div class="cc-dnum"><b>—</b></div><span class="cc-dsub">${esc(note)} unavailable</span></div>`;
      const ga = Math.round(a / 100 * SEG), lead = a > b ? 'up' : a < b ? 'down' : 'yellow';
      return `<div class="cc-dig cc-dsplit d-${lead}"><small>${k}</small><div class="cc-dpair"><div class="cc-dnum s-up"><b data-ghost="88">${Math.round(a)}</b><em>% ${la}</em></div><div class="cc-dnum s-down"><b data-ghost="88">${Math.round(b)}</b><em>% ${lb}</em></div></div><span class="cc-dseg">${Array.from({ length: SEG }, (_, i) => `<i class="${i < ga ? 'on s-up' : 'on s-down'}"></i>`).join('')}</span><span class="cc-dsub">${esc(note)}</span></div>`;
    };
    return `<div class="cc-digital">${cells.map(c => c.length === 6 && typeof c[3] === 'string' && (c[3] === 'ADV' || c[3] === 'BUY') ? split(c) : c).map(c => typeof c === 'string' ? c : (([k, v, unit, t, note, level]) => `<div class="cc-dig d-${lvl(level, t)}"><small>${k}</small><div class="cc-dnum"><b data-ghost="${/^\d+$/.test(v) ? '8'.repeat(v.length) : ''}">${esc(v)}</b>${unit ? `<em>${esc(unit)}</em>` : ''}</div>${bar(level)}<span class="cc-dsub">${esc(note)}</span></div>`)(c)).join('')}</div>`;
  }

  function cluster() {
    const x = window.redlineXray?.model, cm = window.redlineChart?.model;
    if (!x && !cm) return '';
    const bias = U(Object.fromEntries(cm?.pills || []).BIAS), gear = bias === 'LONG' ? 'L' : bias === 'SHORT' ? 'S' : cm ? 'N' : '—';
    const master = n(x?.meter?.master), perm = n(x?.permission?.score);
    const tach = dial({ id: 'cc-tach', value: master, face: 'red', step: 10, minor: 5, labels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => [i * 10, String(i)]), zones: [[0, 50, 'bear'], [50, 65, 'mid'], [65, 100, 'bull']], unit: 'ES MASTER ×10', title: 'ES MASTER METER', readout: f(master) });
    const speedo = dial({ id: 'cc-speed', value: perm, face: 'dark', step: 10, minor: 5, labels: [0, 20, 40, 60, 80, 100].map(v => [v, String(v)]), zones: [[0, 35, 'bear'], [35, 55, 'mid'], [65, 100, 'bull']], unit: 'MPH', title: 'PERMISSION · 65/20/15', readout: f(perm, 0) });
    return `<section class="cc-dash" aria-label="Cockpit instrument cluster">
      <div class="cc-hood"></div>
      ${tft(x, cm)}
      <div class="cc-gauge cc-big">${tach}</div>
      <div class="cc-center">${gate(x)}</div>
      <div class="cc-gauge">${speedo}</div>
      ${digitalStrip(x)}
      <p class="cc-note">LIVE BACKEND · display only · ES Master and permission score are Engine 25 / market-meter readings; the gear follows the ES Master meter (R &lt;50 · N 50–62 · 1–4 in 7-point steps · TURBO 90+), not a trade. Engine 6 decides.</p>
    </section>`;
  }

  // Shared with the Market X-Ray page: ES Master gearbox and digital readouts.
  window.redlineCockpit = { gate, digitalStrip };

  const base = overview;
  overview = function () {
    const html = base.apply(this, arguments);
    const at = html.indexOf('<nav class="db-tabs"');
    const c = cluster();
    if (at < 0 || !c) return html;
    const x = window.redlineXray?.model, cm = window.redlineChart?.model;
    return html.slice(0, at)
      + `<div class="race-section-label"><span>COCKPIT CLUSTER · ES</span><small>LIVE INSTRUMENTS · SIGNALS ONLY</small></div>` + c
      + `<div class="race-section-label"><span>COMMAND SCREEN · NAV</span><small>ROUTE · PERMISSION · HEALTH · PARTICIPATION · EVIDENCE · DISTRIBUTION · INDEX</small></div>` + commandScreen(x, cm)
      + html.slice(at);
  };
  if (typeof page !== 'undefined' && page === 'overview' && typeof render === 'function') render();
})();
