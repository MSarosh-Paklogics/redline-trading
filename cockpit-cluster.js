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

  function nav(x, cm) {
    const price = n(cm?.currentPrice) ?? n(x?.headline?.esClose);
    const zones = [];
    const ez = cm?.e26?.entryZone; if (n(ez?.low) != null && n(ez?.high) != null) zones.push({ lo: n(ez.low), hi: n(ez.high), kind: 'e26', label: 'E26 ZONE' });
    (cm?.shelves || []).forEach(s => { const lo = n(s.lo), hi = n(s.hi); if (lo != null && hi != null) zones.push({ lo, hi, kind: /dist/i.test(s.type) ? 'dist' : 'acc', label: /dist/i.test(s.type) ? 'DIST' : 'ACC' }); });
    if (price == null || !zones.length) return `<div class="cc-screen cc-nav"><div class="cc-scr-head"><b>NAV</b><span>ES LOCATION</span></div><p class="cc-na">Zone map unavailable.</p></div>`;
    const lo = Math.min(price, ...zones.map(z => z.lo)) - 6, hi = Math.max(price, ...zones.map(z => z.hi)) + 6, H = 150, y = v => (hi - v) / (hi - lo) * H;
    const above = zones.filter(z => z.lo > price).sort((a, b) => a.lo - b.lo)[0], below = zones.filter(z => z.hi < price).sort((a, b) => b.hi - a.hi)[0];
    const inside = zones.find(z => price >= z.lo && price <= z.hi);
    const road = `<svg class="cc-road" viewBox="0 0 120 ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="M40 0 L80 0 L100 ${H} L20 ${H} Z" class="cc-road-bg"/><line x1="60" x2="60" y1="0" y2="${H}" class="cc-road-mid"/>
      ${zones.map(z => `<rect x="18" width="84" y="${y(z.hi)}" height="${Math.max(3, y(z.lo) - y(z.hi))}" class="cc-zone ${z.kind}"/>`).join('')}
      <g transform="translate(60 ${y(price)})" class="cc-car"><path d="M0 -9 L6 7 L0 4 L-6 7 Z"/></g></svg>`;
    const row = (k, z, d) => `<div class="cc-nav-row"><small>${k}</small><b>${z ? `${z.label} ${z.lo.toFixed(2)}–${z.hi.toFixed(2)}` : '—'}</b><em>${z ? `${d > 0 ? '+' : ''}${d.toFixed(2)} pts` : ''}</em></div>`;
    return `<div class="cc-screen cc-nav"><div class="cc-scr-head"><b>NAV</b><span>ES ${price.toFixed(2)}</span><em class="${inside ? 'on' : ''}">${inside ? 'IN ' + inside.label : 'IN TRANSIT'}</em></div>
      <div class="cc-nav-body">${road}<div>${row('NEXT ABOVE', above, above ? above.lo - price : 0)}${row('NEXT BELOW', below, below ? below.hi - price : 0)}<p class="cc-na">Engine 26 zone + acc/dist shelves. Location only, not permission.</p></div></div></div>`;
  }

  function lamps(x, cm) {
    const e6 = U(cm?.e6?.permission), riskOff = /RISK.OFF/.test(U(x?.headline?.state)) || U(x?.headline?.color) === 'RED';
    const degraded = x?.e29?.dataDegraded === true || (x && U(x.dataStatus) !== 'LIVE');
    const lamp = (on, cls, label, title) => `<span class="cc-lamp ${on ? 'on ' + cls : ''}" title="${title}">${label}</span>`;
    return `<div class="cc-lamps">${lamp(e6 && e6 !== 'ALLOW', 'red', 'E6', `Engine 6: ${e6 || 'UNAVAILABLE'}`)}${lamp(riskOff, 'red', 'RISK', 'Engine 25 risk-off')}${lamp(degraded, 'amber', 'DATA', 'Data degraded or not live')}${lamp(!!(x && cm), 'green', 'LIVE', 'Live backend')}</div>`;
  }

  function cluster() {
    const x = window.redlineXray?.model, cm = window.redlineChart?.model;
    if (!x && !cm) return '';
    const bias = U(Object.fromEntries(cm?.pills || []).BIAS), gear = bias === 'LONG' ? 'L' : bias === 'SHORT' ? 'S' : cm ? 'N' : '—';
    const master = n(x?.meter?.master), perm = n(x?.permission?.score);
    const tach = dial({ id: 'cc-tach', value: master, face: 'red', step: 10, minor: 5, labels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => [i * 10, String(i)]), zones: [[85, 100, 'hot']], unit: 'ES MASTER ×10', title: 'ES MASTER METER', readout: f(master) });
    const speedo = dial({ id: 'cc-speed', value: perm, face: 'dark', step: 10, minor: 5, labels: [0, 20, 40, 60, 80, 100].map(v => [v, String(v)]), zones: [[0, 35, 'bear'], [35, 55, 'mid'], [65, 100, 'bull']], unit: '65/20/15 SCORE', title: 'TRADE PERMISSION', readout: f(perm) });
    return `<section class="cc-dash" aria-label="Cockpit instrument cluster">
      <div class="cc-hood"></div>
      ${tft(x, cm)}
      <div class="cc-gauge cc-big">${tach}</div>
      <div class="cc-center"><div class="cc-gear ${gear === 'L' ? 'up' : gear === 'S' ? 'down' : ''}"><b>${gear}</b><small>BIAS · E15</small></div>${lamps(x, cm)}<div class="cc-perm"><small>E6 PERMISSION</small><b>${U(cm?.e6?.permission).replace(/_/g, ' ') || '—'}</b></div></div>
      <div class="cc-gauge">${speedo}</div>
      ${nav(x, cm)}
      <p class="cc-note">LIVE BACKEND · display only · ES Master and permission score are Engine 25 / market-meter readings; the gear is Engine 15 bias, not a trade. Engine 6 decides.</p>
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
