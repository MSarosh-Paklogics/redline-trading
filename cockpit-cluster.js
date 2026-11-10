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
      { title: '1H MARKET EVIDENCE', head: `${pct(hb.coverage, 1)} COVERAGE`, body: kv('SCANNED / WITH VOL', `${f(hb.scanned, 0)} / ${f(hb.withVol, 0)}`) + kv('ADVANCING', hb.up == null ? '—' : `${f(hb.up, 0)} (${pct(hb.buyBreadth)})`, 'up') + kv('DECLINING', hb.down == null ? '—' : `${f(hb.down, 0)} (${pct(hb.buyBreadth == null ? null : 100 - hb.buyBreadth)})`, 'down') + kv('NEW HIGHS / LOWS', `${f(x.hourlyNhNl?.nh, 0)} / ${f(x.hourlyNhNl?.nl, 0)}`) + kv('SECTORS', sec.strong == null ? '—' : `${sec.strong} BULL · ${sec.neutral} NEUT · ${sec.weak} BEAR`) + kv('ADVANCING VOLUME', pct(hb.buyVolume, 1), 'up') + kv('IMBALANCE', imb == null ? '—' : `${pct(imb, 1)} TOWARD ${hb.buyVolume < 50 ? 'SELLING' : 'BUYING'}`, hb.buyVolume < 50 ? 'down' : 'up') },
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


  /* 6-speed gated shifter = risk-management level. The six gears are the six bands of the
     MIRRORED 65/20/15 trade-permission read (market-xray.js permissionRead): 6 = long bias ...
     1 = strong defensive. A risk level for sizing context, not a trade or a permission. */
  const GEARS = [
    { g: 1, min: -Infinity, tone: 'down', short: 'STRONG DEFENSIVE' },
    { g: 2, min: 35, tone: 'down', short: 'DEFENSIVE' },
    { g: 3, min: 45, tone: 'yellow', short: 'SHORT WATCH' },
    { g: 4, min: 50, tone: 'yellow', short: 'NEUTRAL / WAIT' },
    { g: 5, min: 55, tone: 'up', short: 'REDUCED SIZE' },
    { g: 6, min: 65, tone: 'up', short: 'NORMAL LONG' }
  ];
  function gate(x) {
    const p = x?.permission || {}, score = n(p.score);
    const cur = score == null ? null : [...GEARS].reverse().find(r => score >= r.min);
    // H-pattern: 1-3-5 on top, 2-4-6 below, one neutral rail across the middle.
    const col = g => 34 + Math.floor((g - 1) / 2) * 46, row = g => (g % 2 ? 34 : 114);
    const slots = [1, 3, 5].map(g => `<path d="M${col(g)} ${row(g)} V74" class="cc-slot"/>`).join('') + [2, 4, 6].map(g => `<path d="M${col(g)} 74 V${row(g)}" class="cc-slot"/>`).join('');
    const nums = GEARS.map(r => `<text x="${col(r.g)}" y="${r.g % 2 ? 18 : 140}" class="cc-gnum ${cur?.g === r.g ? 'on ' + r.tone : ''}">${r.g}</text>`).join('');
    const kx = cur ? col(cur.g) : 80, ky = cur ? row(cur.g) : 74;
    return `<div class="cc-gate ${cur ? cur.tone : ''}" title="Risk gear from the 65/20/15 permission score. Not a trade permission — Engine 6 decides.">
      <svg viewBox="0 0 160 150" class="cc-gate-svg" role="img" aria-label="Risk gear ${cur ? cur.g : 'unavailable'} of 6">
        <defs><linearGradient id="cc-metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5a5c60"/><stop offset=".45" stop-color="#2a2b2e"/><stop offset="1" stop-color="#46484c"/></linearGradient>
        <radialGradient id="cc-knob" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#c9cbcf"/><stop offset="1" stop-color="#55575c"/></radialGradient></defs>
        <rect x="6" y="24" width="148" height="102" rx="12" fill="url(#cc-metal)" class="cc-plate"/>
        <rect x="6" y="24" width="148" height="102" rx="12" class="cc-plate-edge"/>
        <path d="M34 74 H126" class="cc-slot"/>${slots}${nums}
        <g class="cc-knob" style="--kx:${kx}px;--ky:${ky}px"><circle r="13" fill="#000" opacity=".45" cx="1.5" cy="2.5"/><circle r="12" fill="url(#cc-knob)" class="cc-knob-ball"/><circle r="5.2" class="cc-knob-top ${cur ? cur.tone : ''}"/></g>
      </svg>
      <div class="cc-gear-read"><b class="${cur ? cur.tone : ''}">${cur ? `GEAR ${cur.g}` : 'GEAR —'}</b><span>${cur ? `${cur.short} · ${f(score, 0)}` : 'UNAVAILABLE'}</span><small>RISK LEVEL · 65/20/15</small></div>
    </div>`;
  }
  function cluster() {
    const x = window.redlineXray?.model, cm = window.redlineChart?.model;
    if (!x && !cm) return '';
    const bias = U(Object.fromEntries(cm?.pills || []).BIAS), gear = bias === 'LONG' ? 'L' : bias === 'SHORT' ? 'S' : cm ? 'N' : '—';
    const master = n(x?.meter?.master), perm = n(x?.permission?.score);
    const tach = dial({ id: 'cc-tach', value: master, face: 'red', step: 10, minor: 5, labels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => [i * 10, String(i)]), zones: [[0, 50, 'bear'], [50, 65, 'mid'], [65, 100, 'bull']], unit: 'ES MASTER ×10', title: 'ES MASTER METER', readout: f(master) });
    const speedo = dial({ id: 'cc-speed', value: perm, face: 'dark', step: 10, minor: 5, labels: [0, 20, 40, 60, 80, 100].map(v => [v, String(v)]), zones: [[0, 35, 'bear'], [35, 55, 'mid'], [65, 100, 'bull']], unit: '65/20/15 SCORE', title: 'TRADE PERMISSION', readout: f(perm) });
    return `<section class="cc-dash" aria-label="Cockpit instrument cluster">
      <div class="cc-hood"></div>
      ${tft(x, cm)}
      <div class="cc-gauge cc-big">${tach}</div>
      <div class="cc-center">${gate(x)}</div>
      <div class="cc-gauge">${speedo}</div>
      ${nav(x, cm)}
      <p class="cc-note">LIVE BACKEND · display only · ES Master and permission score are Engine 25 / market-meter readings; the 6-speed gear is the risk level from the 65/20/15 permission score, not a trade. Engine 6 decides.</p>
    </section>`;
  }

  const base = overview;
  overview = function () {
    const html = base.apply(this, arguments);
    const at = html.indexOf('<div class="race-section-label"><span>LIVE SIGNAL BOARD');
    const c = cluster();
    return at < 0 || !c ? html : html.slice(0, at) + `<div class="race-section-label"><span>COCKPIT CLUSTER · ES</span><small>LIVE INSTRUMENTS · SIGNALS ONLY</small></div>` + c + html.slice(at);
  };
  if (typeof page !== 'undefined' && page === 'overview' && typeof render === 'function') render();
})();
