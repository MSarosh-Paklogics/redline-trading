'use strict';
/* Redline landing page motion + live data (landing.html).
   GSAP + ScrollTrigger drive every scroll scene; Lenis gives the weighted smooth scroll.
   Real data, read-only, from the same Backend 1 routes the app uses (backend-api.js + market-xray.js):
   - Engine 25 market meter / X-Ray model: cockpit needles, gear, health, breadth, buy volume, sectors,
     every scanned stock as a dot, the 11 sector tiles, the Engine 25 / 29 engine cards.
   - Dashboard snapshot: Engine 22 degree reads. ES SMZ levels: institutional zones. ES 1h + 10m OHLC.
   Nothing is invented: a value the backend does not give shows "—", and each live block says when
   the reading is from. The ENZO chat, the Strategy AI bot and the gear walkthrough copy are labelled
   as planned / illustrative, as in the client's V9 copy.
   prefers-reduced-motion (or GSAP failing to load) shows every scene in its finished state. */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STATIC = reduce || !(window.gsap && window.ScrollTrigger);
  const n = v => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const L = v => String(v ?? '').replace(/^ENGINE\d+_/, '').replace(/_/g, ' ').trim().toUpperCase() || '—';
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = t => 1 - Math.pow(1 - clamp(t), 3);
  const hhmm = t => { const d = t ? new Date(t) : null; return d && !isNaN(d) ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' }) + ' ET' : '—'; };

  // ---------------------------------------------------------------- content
  const CHALLENGES = [
    ['Your edge', 'Stop guessing. Start trading a plan.', 'Do you have a strategy with a measurable edge — or are you hoping the next trade works?', 'Engine 22 + your strategy', 'Track Elliott Wave structure, Fibonacci scenarios and strategy-defined setups.', 'Existing analysis; strategy workflows require validation.'],
    ['The risk', 'Protect your capital. Always.', 'One oversized loss can erase weeks of progress. Do you know your risk before every trade?', 'Risk + invalidation context', 'Structure-based invalidation and market warnings help inform a risk plan.', 'Position-sizing and account-risk tooling require verification.'],
    ['Emotions', 'Don’t let emotion trade for you.', 'Fear exits winners too early. Greed holds losers too long. Who is making your decisions?', 'Redline cockpit + market states', 'Use consistent market evidence and trade-readiness states instead of impulse.', 'Objective guidance supports — but does not replace — discipline.'],
    ['Structure', 'Understand the structure before you trade.', 'Are you trading with the larger wave and trend — or fighting a move you don’t understand?', 'Engine 22 + chart', 'See Elliott Wave degrees, Fibonacci levels and market structure in chart context.', 'Wave interpretations remain probabilistic.'],
    ['The market', 'See what price alone cannot tell you.', 'Is the index strong — or are thousands of stocks quietly flashing warnings?', 'Engine 25 + Engine 29', 'Examine breadth, distribution, sector strength and changing market character.', 'Target 5,740 stocks; actual coverage and data freshness vary.'],
    ['The journal', 'Every trade has a story. Capture it.', 'If you aren’t recording decisions and results, how can you know what actually works?', 'Transaction journal', 'Connect broker-confirmed trades, fees, decisions and strategy context.', 'Complete per-customer reconciliation requires launch verification.'],
    ['Learning', 'Stop repeating the same mistakes.', 'Your trading history contains valuable lessons. Are you actually using them?', 'Your personal strategy AI bot', 'A dedicated AI system designed to study your methods and suggest testable improvements.', 'Planned capability; not yet confirmed launch-ready.'],
    ['The entry', 'Know when to strike. And when to wait.', 'Is your setup confirmed — or are you entering because you are afraid to miss out?', 'Strategy + zones + market intelligence', 'Align your entry rules with waves, negotiated zones and broad-market confirmation.', 'Advisory setup guidance; no automated trading at launch.'],
    ['The exit', 'Don’t give back a winning trade.', 'Do you have a clear exit plan — or do fear and hope decide when you are done?', 'Targets + gear-based context', 'Monitor targets, invalidation, opposing zones and potential shifts in market pressure.', 'Proposed gear-based exit guidance requires testing.'],
    ['The size', 'Trade the right size. Survive the wrong trade.', 'Could one oversized position seriously damage your account?', 'Account risk + position plan', 'Relate potential stops and contract exposure to a defined risk budget.', 'Sizing calculator and account-level limits require verification.']
  ];
  $('[data-track]').innerHTML = CHALLENGES.map(([tag, h, q, how, text, note], i) => `
    <article class="card"><div class="card-in">
      <p class="num">${String(i + 1).padStart(2, '0')} / ${esc(tag)}</p><h3>${esc(h)}</h3><p class="q">${esc(q)}</p>
      <div class="help"><p class="tag"><span>HOW REDLINE HELPS</span><span aria-hidden="true">↘</span></p><b>${esc(how.toUpperCase())}</b><p>${esc(text)}</p><p class="fine">${esc(note)}</p></div>
    </div></article>`).join('');

  const ENGINES = [
    { id: 'e22', tag: 'ENGINE 22', h: 'Understand market structure.', p: 'Multi-degree Elliott Wave analysis, Fibonacci context and strategy-focused market structure frame the bigger picture before you consider a setup.', f: 'Know where you are in the structure — not just where price is.' },
    { id: 'e25', tag: 'ENGINE 25', h: 'Measure market health.', p: 'Breadth, buying and selling volume, distribution pressure, sector participation and historical market health show what stands behind a price move.', f: 'See whether the broader market supports — or challenges — the move.' },
    { id: 'e29', tag: 'ENGINE 29', h: 'Interpret market character.', p: 'The 1-hour bigger picture, current pressure, the 30-minute fast shift and the ES parent move side by side — with plain-language reasons for each reading.', f: 'Diagnostic context, not a trade signal.' },
    { id: 'chart', tag: 'PROFESSIONAL CHART', h: 'Bring the analysis to price.', p: 'Professional drawing tools, Elliott Wave structure, Fibonacci levels and institutional-zone overlays in one chart workspace.', f: 'Visualize the analysis where decisions are made.' },
    { id: 'journal', tag: 'TRADE JOURNAL', h: 'Account for every transaction.', p: 'A transaction-level journal designed to connect fills, exits, fees, P&L and trade context to the strategies that produced them.', f: 'Transaction capture, reconciliation and coverage must be verified for launch.' },
    { id: 'ai', tag: 'CUSTOMER STRATEGY INTELLIGENCE', h: 'A personal AI for each trader.', p: 'A private strategy-learning workspace that studies your strategies, links journal results to market conditions and proposes refinements for your review — never changing live rules on its own.', f: 'Personal AI strategy learning is planned; release readiness must be verified.' }
  ];
  $('[data-engines]').innerHTML = ENGINES.map((e, i) => `<article class="en-card" style="--i:${i}" data-en="${e.id}"><div><p class="tag">${e.tag}</p><h3>${e.h}</h3><p>${e.p}</p><p class="fine">${e.f}</p></div><div class="en-live" data-en-live="${e.id}"><small>CONNECTING…</small><div class="big">—</div></div></article>`).join('');

  // ---------------------------------------------------------------- gauges
  const ang = (v, max) => 135 + 270 * (v / max);
  const pol = (a, r) => [Math.cos(a * Math.PI / 180) * r, Math.sin(a * Math.PI / 180) * r];
  function gauge(el, { max, minor, red, label, id, face }) {
    let ticks = '', nums = '';
    for (let v = 0; v <= max + 1e-9; v += minor) {
      const r = Math.round(v * 1000) / 1000, major = max <= 10 ? Number.isInteger(r) : r % 20 === 0;
      const a = ang(r, max), [x1, y1] = pol(a, major ? 76 : 80), [x2, y2] = pol(a, 88);
      ticks += `<line class="tick${major ? '' : ' minor'}${red != null && r >= red ? ' redz' : ''}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
      if (major) { const [tx, ty] = pol(a, 62); nums += `<text class="num" x="${tx.toFixed(1)}" y="${ty.toFixed(1)}">${r}</text>`; }
    }
    let arc = '';
    if (red != null) { const [sx, sy] = pol(ang(red, max), 92), [ex, ey] = pol(ang(max, max), 92); arc = `<path class="redarc" d="M${sx.toFixed(1)} ${sy.toFixed(1)} A92 92 0 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)}"/>`; }
    const [c0, c1] = face === 'red' ? ['#5a0d12', '#1e0507'] : face === 'black' ? ['#1a1b1e', '#070708'] : ['#202329', '#0d0e11'];
    el.innerHTML = `<svg class="gauge" viewBox="-110 -110 220 220"><defs><radialGradient id="${id}F" cx="50%" cy="40%" r="65%"><stop offset="0" stop-color="${c0}"/><stop offset=".7" stop-color="${c1}"/><stop offset="1" stop-color="#050506"/></radialGradient></defs>
      <circle r="104" fill="#0a0b0d" stroke="#3a3d43" stroke-width="3"/><circle r="98" fill="url(#${id}F)"/>${arc}${ticks}${nums}
      ${label ? `<text class="lbl" y="40">${label}</text>` : ''}<text class="lbl val" y="62" data-gval></text>
      <g class="needle-g"><polygon class="needle" points="-14,-3.5 84,0 -14,3.5"/></g><circle class="hub" r="11"/></svg>`;
    const needle = el.querySelector('.needle-g'), val = el.querySelector('[data-gval]');
    const set = (v, text) => { needle.setAttribute('transform', `rotate(${ang(clamp(v, 0, max), max).toFixed(2)})`); if (text != null) val.textContent = text; };
    set(0);
    return { set, max };
  }
  const tach = gauge($('[data-gauge="tach"]'), { max: 10, minor: 0.5, red: 8, label: '', id: 'tach', face: 'black' });
  const ckTach = gauge($('[data-gauge="ckTach"]'), { max: 10, minor: 0.5, red: null, label: 'ES MASTER ×10', id: 'ckTach', face: 'red' });
  const ckSpeedo = gauge($('[data-gauge="ckSpeedo"]'), { max: 100, minor: 10, red: null, label: 'PERMISSION', id: 'ckSpeedo', face: 'dark' });
  const rpmEl = $('[data-rpm]');
  const setRpm = v => { tach.set(v); rpmEl.textContent = Math.round(v * 1000).toLocaleString('en-US'); };

  // ---------------------------------------------------------------- live data
  const LIVE = { x: null, e22: null, snapAt: null, zones: [], h1: [], at: null };
  const bar = b => ({ t: b.t ?? b.time, o: +(b.o ?? b.open), h: +(b.h ?? b.high), l: +(b.l ?? b.low), c: +(b.c ?? b.close) });
  const okBar = b => [b.o, b.h, b.l, b.c].every(Number.isFinite);
  const candleSvg = $('.hero-candles');
  async function loadHeroCandles() {
    if (!window.redlineApi?.futuresOhlc || document.hidden) return;
    try {
      const r = await window.redlineApi.futuresOhlc('ES', '10m', 140);
      const bars = (Array.isArray(r?.data) ? r.data : []).map(bar).filter(okBar);
      if (bars.length < 10) return;
      const hi = Math.max(...bars.map(b => b.h)), lo = Math.min(...bars.map(b => b.l)), span = hi - lo || 1, W = bars.length * 10, H = 400, y = p => (hi - p) / span * H;
      candleSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      candleSvg.innerHTML = bars.map((b, i) => { const x = i * 10 + 5, col = b.c >= b.o ? '#2fe07f' : '#ff3b45'; return `<line x1="${x}" x2="${x}" y1="${y(b.h).toFixed(1)}" y2="${y(b.l).toFixed(1)}" stroke="${col}" stroke-width="1"/><rect x="${x - 3}" y="${Math.min(y(b.o), y(b.c)).toFixed(1)}" width="6" height="${Math.max(1, Math.abs(y(b.o) - y(b.c))).toFixed(1)}" fill="${col}"/>`; }).join('');
      $('[data-live]').hidden = false; $('[data-live-price]').textContent = bars.at(-1).c.toFixed(2);
    } catch { /* backend asleep: keep the last candles, or none */ }
  }
  async function loadLive() {
    const api = window.redlineApi; if (!api) return;
    const [x, snap, smz, h1] = await Promise.allSettled([window.redlineXray?.load ? window.redlineXray.load() : null, api.snapshot('ES'), api.esSmzLevels(), api.futuresOhlc('ES', '1h', 150)]);
    LIVE.x = (x.status === 'fulfilled' && x.value) || window.redlineXray?.model || LIVE.x;
    if (snap.status === 'fulfilled') { const s = snap.value?.data; LIVE.e22 = s?.strategies?.['intraday_scalp@10m']?.engine22WaveStrategy?.engine22Display?.degrees || LIVE.e22; LIVE.snapAt = s?.now || LIVE.snapAt; }
    if (smz.status === 'fulfilled') {
      const d = smz.value?.data || {}, rows = (Array.isArray(d.levels) && d.levels.length ? d.levels : Array.isArray(d.levels_debug) ? d.levels_debug : []);
      LIVE.zones = rows.filter(z => String(z.status || 'active').toLowerCase() === 'active').map(z => { const r = z.displayPriceRange || z.priceRange || []; const a = n(r[0]), b = n(r[1]); return a == null || b == null ? null : { hi: Math.max(a, b), lo: Math.min(a, b), strength: n(z.strength), negotiated: !!z.isNegotiated }; }).filter(Boolean);
    }
    if (h1.status === 'fulfilled') { const bars = (Array.isArray(h1.value?.data) ? h1.value.data : []).map(bar).filter(okBar); if (bars.length) LIVE.h1 = bars.slice(-120); }
    LIVE.at = new Date();
    applyLive();
  }

  // ---------------------------------------------------------------- live chips
  function chip(key, state, text) { const c = $(`[data-live-chip="${key}"]`); if (!c) return; c.className = `live-chip ${state}`; c.querySelector('span').textContent = text; }
  function xChip() {
    const x = LIVE.x; if (!x) return ['off', 'Live Engine 25 data unavailable right now'];
    const fr = x.freshness || {}, intr = fr.intraday || {};
    if (intr.fresh === true) return ['on', `LIVE BACKEND · Engine 25 · read ${hhmm(intr.sourceTimestamp)}`];
    return ['stale', `LIVE BACKEND · last Engine 25 read ${hhmm(intr.sourceTimestamp || fr.eod?.sourceTimestamp)}${fr.equityScannerSession?.active === false ? ' · stock session closed' : ''}`];
  }

  // ---------------------------------------------------------------- cockpit (live)
  const GEARS = [[-Infinity, 'B4', 'BEAR 4', 'bear'], [29, 'B3', 'BEAR 3', 'bear'], [36, 'B2', 'BEAR 2', 'bear'], [43, 'B1', 'BEAR 1', 'bear'], [50, 'N', 'NEUTRAL', 'neutral'], [63, '1', 'BULL 1', 'bull'], [70, '2', 'BULL 2', 'bull'], [77, '3', 'BULL 3', 'bull'], [84, '4', 'BULL 4', 'bull'], [90, 'T', 'TURBO', 'bull']];
  const KNOB = { B1: [70, 30], B2: [70, 110], B3: [30, 30], B4: [30, 110], N: [120, 70], 1: [170, 30], 2: [170, 110], 3: [210, 30], 4: [210, 110], T: [210, 110] };
  const gearFor = v => v == null ? null : [...GEARS].reverse().find(g => v >= g[0]);
  const knob = $('[data-knob]'), dash = $('.ck-dash');
  const route = g => { const [x, y] = KNOB[g] || KNOB.N; return g === 'N' ? [KNOB.N] : [KNOB.N, [x, 70], [x, y]]; };
  function along(pts, t) {
    if (pts.length === 1) return pts[0];
    const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])), total = seg.reduce((a, b) => a + b, 0);
    let d = clamp(t) * total;
    for (let i = 0; i < seg.length; i++) { if (d <= seg[i] || i === seg.length - 1) { const k = seg[i] ? clamp(d / seg[i]) : 1; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k]; } d -= seg[i]; }
    return pts.at(-1);
  }
  let ckP = 0;
  function renderCockpit(p = ckP) {
    ckP = p;
    const x = LIVE.x, master = n(x?.meter?.master), perm = n(x?.permission?.score), g = gearFor(master);
    const a = ease(p / 0.6);
    ckTach.set(master == null ? 0 : master / 10 * a, master == null ? '—' : (master * a).toFixed(1));
    ckSpeedo.set(perm == null ? 0 : perm * a, perm == null ? '—' : String(Math.round(perm * a)));
    const q = clamp((p - 0.35) / 0.45), pos = along(route(g ? g[1] : 'N'), ease(q));
    knob.setAttribute('transform', `translate(${pos[0].toFixed(1)} ${pos[1].toFixed(1)})`);
    const arrived = g && q >= 0.999;
    $('[data-gear-word]').textContent = !g ? '—' : arrived ? g[2] : 'N';
    dash.classList.remove('bull', 'bear', 'neutral'); if (arrived) dash.classList.add(g[3]);
    $('[data-gear-sub]').textContent = master == null ? 'ES master meter unavailable' : `ES master meter ${master.toFixed(1)}`;
    const h = x?.headline || {}, hb = x?.hourly || {}, sec = x?.sectors || {}, r = ease(p / 0.8);
    const read = (k, v, max, text, sub) => { $(`[data-read="${k}"]`).textContent = v == null ? '—' : text(v * r); $(`[data-bar="${k}"]`).style.transform = `scaleX(${v == null ? 0 : (v * r / max).toFixed(3)})`; $(`[data-read-sub="${k}"]`).textContent = v == null ? '' : sub; };
    read('health', n(h.score), 100, v => `${Math.round(v)}`, L(h.state));
    read('breadth', n(hb.buyBreadth), 100, v => `${Math.round(v)}%`, hb.up == null ? '' : `${Number(hb.up).toLocaleString('en-US')} up · ${Number(hb.down).toLocaleString('en-US')} down`);
    read('volume', n(hb.buyVolume), 100, v => `${Math.round(v)}%`, n(hb.buyVolume) == null ? '' : hb.buyVolume < 50 ? 'selling volume heavier' : 'buying volume heavier');
    read('sectors', n(sec.strong), 11, v => `${Math.round(v)} / 11`, sec.weak == null ? '' : `${sec.weak} weak · ${sec.neutral} mixed`);
    $$('.ck-steps li').forEach((li, j) => li.classList.toggle('on', j === (p < 0.34 ? 0 : p < 0.67 ? 1 : 2)));
  }

  // ---------------------------------------------------------------- under the hood: every scanned stock as a dot
  const canvas = $('[data-dots]'), field = $('.hd-field');
  let dots = [], dotsP = 0;
  function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function buildDots() {
    const hb = LIVE.x?.hourly || {}, total = n(hb.scanned), up = n(hb.up), down = n(hb.down);
    if (total == null || up == null || down == null) { dots = []; return; }
    const rand = seeded(5740), W = field.clientWidth, H = field.clientHeight, cnt = Math.min(total, 6000);
    dots = Array.from({ length: cnt }, (_, i) => {
      const kind = i < up ? 1 : i < up + down ? -1 : 0, band = kind === 1 ? [0.1, 0.42] : kind === -1 ? [0.6, 0.92] : [0.45, 0.55];
      return { kind, lx: rand() * W, ly: H * 0.5 + (rand() - 0.5) * 6, tx: 14 + rand() * (W - 28), ty: H * (band[0] + rand() * (band[1] - band[0])) };
    });
  }
  function drawDots(p = dotsP) {
    dotsP = p;
    const dpr = Math.min(2, devicePixelRatio || 1), W = field.clientWidth, H = field.clientHeight;
    if (!W || !H) return;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); buildDots(); }
    const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    // the index headline: a flat line that fades as the stocks underneath separate
    g.globalAlpha = 1 - ease(p / 0.5); g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.beginPath();
    for (let x = 0; x <= W; x += 12) g.lineTo(x, H * 0.5 + Math.sin(x / 70) * 4); g.stroke(); g.globalAlpha = 1;
    if (!dots.length) { g.fillStyle = '#7d8694'; g.font = '13px Inter, sans-serif'; g.fillText(LIVE.x ? 'Breadth counts unavailable in this read' : 'Waiting for live breadth…', 18, H - 18); return; }
    const k = ease(p), c = clamp((p - 0.15) / 0.5);
    const col = kind => kind === 1 ? `rgba(47,224,127,${0.35 + 0.6 * c})` : kind === -1 ? `rgba(255,59,69,${0.35 + 0.6 * c})` : 'rgba(154,163,176,.55)';
    for (const kind of [0, 1, -1]) {
      g.fillStyle = c < 0.05 ? 'rgba(220,224,230,.55)' : col(kind);
      for (const d of dots) if (d.kind === kind) g.fillRect(d.lx + (d.tx - d.lx) * k, d.ly + (d.ty - d.ly) * k, 2.2, 2.2);
    }
    g.font = '700 11px "JetBrains Mono", monospace'; g.globalAlpha = c;
    g.fillStyle = '#2fe07f'; g.fillText('ADVANCING', 18, H * 0.1 - 8);
    g.fillStyle = '#ff3b45'; g.fillText('DECLINING', 18, H * 0.6 - 8);
    g.fillStyle = '#c9ced6'; g.fillText('SCANNED, NOT COUNTED UP OR DOWN IN THIS READ', 18, H * 0.45 - 6); g.globalAlpha = 1;
  }
  function renderSectors() {
    const cards = LIVE.x?.sectorCards?.['1H'] || [], el = $('[data-sectors]');
    if (!cards.length) { el.innerHTML = '<p class="fine">Sector participation unavailable in this read.</p>'; return; }
    const first = !el.children.length || el.querySelector('p');
    el.innerHTML = cards.map(c => { const b = n(c.breadth), tone = b == null ? 'mixed' : b >= 55 ? 'strong' : b <= 45 ? 'weak' : 'mixed'; return `<div class="sec ${tone}"><b>${esc(c.sector)}</b><strong>${b == null ? '—' : `${Math.round(b)}%`}</strong><small>${tone === 'strong' ? 'STRONG' : tone === 'weak' ? 'WEAK' : 'MIXED'} · ADVANCING</small><i style="transform:scaleX(${b == null ? 0 : (b / 100).toFixed(3)})"></i></div>`; }).join('');
    if (!STATIC && first) gsap.from($$('.sec', el), { y: 26, opacity: 0, stagger: 0.05, duration: 0.6, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
  }

  // ---------------------------------------------------------------- engines (live cards)
  function renderEngines() {
    const x = LIVE.x, e22 = LIVE.e22, h = x?.headline || {}, hb = x?.hourly || {}, sec = x?.sectors || {}, e29 = x?.e29 || {}, d29 = e29.display || {};
    const box = (id, html) => { const el = $(`[data-en-live="${id}"]`); if (el) el.innerHTML = html; };
    const src = t => `<p class="src">${esc(t)}</p>`;
    const minute = e22?.minute || e22?.minor;
    box('e22', minute ? `<small>ENGINE 22 · MINUTE DEGREE NOW</small><div class="big ${minute.direction === 'UP' ? 'up' : minute.direction === 'DOWN' ? 'down' : ''}">${esc(minute.badge || '—')}</div><p class="txt">${esc(minute.headline || '')}</p><ul>${[['PRIMARY', e22.primary], ['MINOR', e22.minor]].filter(r => r[1]).map(([k, v]) => `<li><span>${k}</span>${esc(v.headline)}</li>`).join('')}</ul>${src(`LIVE BACKEND · dashboard snapshot ${hhmm(LIVE.snapAt)}`)}` : '<small>ENGINE 22</small><div class="big">—</div><p class="txt">Wave read unavailable right now.</p>');
    box('e25', x ? `<small>ENGINE 25 · MARKET HEALTH</small><div class="big ${n(h.score) != null && h.score < 40 ? 'down' : n(h.score) != null && h.score >= 60 ? 'up' : ''}">${n(h.score) == null ? '—' : `${Math.round(h.score)} / 100`}</div><p class="txt">${esc(L(h.state))}</p><ul><li><span>BREADTH</span>${n(hb.buyBreadth) == null ? '—' : `${Math.round(hb.buyBreadth)}% of stocks advancing`}</li><li><span>VOLUME</span>${n(hb.buyVolume) == null ? '—' : `${Math.round(hb.buyVolume)}% buying`}</li><li><span>SECTORS</span>${sec.weak == null ? '—' : `${sec.strong} strong · ${sec.weak} weak · ${sec.neutral} mixed`}</li></ul>${src(xChip()[1])}` : '<small>ENGINE 25</small><div class="big">—</div><p class="txt">Unavailable right now.</p>');
    const s29 = String(e29.overallState || '');
    box('e29', s29 || d29.oneHour ? `<small>ENGINE 29 · MARKET CHARACTER</small><div class="big ${/DETERIOR|BEAR|DOWN|SELL|STRESS/.test(s29) ? 'down' : /IMPROV|BULL|BUY|HEALTH/.test(s29) ? 'up' : ''}" style="font-size:clamp(22px,2.2vw,32px)">${esc(L(s29))}</div><ul><li><span>1H PRESSURE</span>${esc(L(d29.oneHour?.state))}</li><li><span>30M SHIFT</span>${esc(L(d29.thirtyMinute?.state))}</li><li><span>1W PICTURE</span>${esc(L(d29.oneWeek?.character?.state || d29.oneWeek?.state))}</li></ul>${src(`LIVE BACKEND · Engine 29 ${hhmm(e29.timestamp)}`)}` : '<small>ENGINE 29</small><div class="big">—</div><p class="txt">Unavailable right now.</p>');
    const last = LIVE.h1.at(-1);
    box('chart', `<small>IN REDLINE TODAY</small><div class="big">48</div><p class="txt">drawing tools on a live ES chart</p><ul><li><span>LINES</span>trendlines · rays · channels · pitchforks</li><li><span>FIB</span>retracement · extension · time · spiral · Gann</li><li><span>MARKUP</span>brushes · arrows · shapes · text</li>${last ? `<li><span>ES 1H</span>${last.c.toFixed(2)}</li>` : ''}</ul>${src('Signal-only · no orders are placed')}`);
    box('journal', `<small>ENGINE 8 · PAPER JOURNAL</small><div class="big" style="font-size:clamp(22px,2.2vw,30px)">PAPER TRADES</div><p class="txt">Paper trades with a per-trade timeline and results in points are in Redline today.</p><ul><li><span>REAL ACCOUNTS</span>locked until access rules are approved</li></ul>${src('Real-account journal is a planned launch item')}`);
    box('ai', '<small>STATUS</small><div class="big"><span class="planned">PLANNED</span></div><p class="txt">One private strategy-learning workspace per customer. Suggestions only — every change needs your approval.</p>');
  }

  // ---------------------------------------------------------------- structure (live ES 1h + zones + Engine 22 ladder)
  const stSvg = $('.st-chart'); stSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  function renderStructure() {
    const bars = LIVE.h1, e22 = LIVE.e22;
    const DEG = [['primary', 'PRIMARY'], ['intermediate', 'INTERMEDIATE'], ['minor', 'MINOR'], ['minute', 'MINUTE'], ['subminute', 'SUBMINUTE'], ['micro', 'MICRO']];
    $('[data-ladder]').innerHTML = e22 ? DEG.filter(([k]) => e22[k]).map(([k, lab]) => `<li><b>${lab}</b><span><em class="${esc(e22[k].direction)}">${esc(e22[k].badge || '')}</em>${esc(e22[k].headline || '')}</span></li>`).join('') : '<li><b>ENGINE 22</b><span>Degree reads unavailable right now.</span></li>';
    if (!bars.length) { chip('st', 'off', 'ES 1h candles unavailable right now'); return; }
    const W = 800, top = 24, bottom = 416, hi0 = Math.max(...bars.map(b => b.h)), lo0 = Math.min(...bars.map(b => b.l)), pad = (hi0 - lo0) * 0.08;
    const hi = hi0 + pad, lo = lo0 - pad, y = p => top + (hi - p) / (hi - lo) * (bottom - top), dx = (W - 70) / bars.length;
    let grid = ''; for (let i = 0; i <= 6; i++) { const p = lo + (hi - lo) * i / 6, yy = y(p); grid += `<line x1="0" x2="${W - 70}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" stroke="#ffffff0d"/><text x="${W - 64}" y="${(yy + 4).toFixed(1)}" fill="#8b95a5" font-size="14" font-family="JetBrains Mono, monospace">${p.toFixed(0)}</text>`; }
    $('.st-grid', stSvg).innerHTML = grid;
    const zones = LIVE.zones.filter(z => z.hi >= lo && z.lo <= hi).sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0)).slice(0, 4);
    $('.st-zones', stSvg).innerHTML = zones.map(z => { const y1 = y(Math.min(hi, z.hi)), y2 = y(Math.max(lo, z.lo)), c = z.negotiated ? '#4da3ff' : '#ffb02e'; return `<g class="st-zone"><rect x="0" y="${y1.toFixed(1)}" width="${W - 70}" height="${Math.max(2, y2 - y1).toFixed(1)}" fill="${c}" fill-opacity=".13" stroke="${c}" stroke-opacity=".45"/><text x="10" y="${(y1 + 18).toFixed(1)}" fill="${c}">${z.negotiated ? 'NEGOTIATED' : 'INSTITUTIONAL'} ZONE ${z.lo.toFixed(2)}–${z.hi.toFixed(2)}${z.strength != null ? ` · STRENGTH ${Math.round(z.strength)}` : ''}</text></g>`; }).join('');
    $('.st-candles', stSvg).innerHTML = bars.map((b, i) => { const x = i * dx + dx / 2, col = b.c >= b.o ? '#2fe07f' : '#ff3b45', w = Math.max(1.5, dx * 0.6); return `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${y(b.h).toFixed(1)}" y2="${y(b.l).toFixed(1)}" stroke="${col}"/><rect x="${(x - w / 2).toFixed(1)}" y="${Math.min(y(b.o), y(b.c)).toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(1, Math.abs(y(b.o) - y(b.c))).toFixed(1)}" fill="${col}"/>`; }).join('');
    const last = bars.at(-1), ly = y(last.c);
    $('.st-price', stSvg).innerHTML = `<line x1="0" x2="${W - 70}" y1="${ly.toFixed(1)}" y2="${ly.toFixed(1)}"/><rect x="${W - 70}" y="${(ly - 12).toFixed(1)}" width="70" height="24" rx="4"/><text x="${W - 65}" y="${(ly + 5).toFixed(1)}">${last.c.toFixed(2)}</text>`;
    chip('st', 'on', `LIVE BACKEND · ES 1h · ${bars.length} bars · ${zones.length} institutional zone${zones.length === 1 ? '' : 's'} in range`);
    if (STATIC) $('[data-reveal-rect]').setAttribute('width', W);
  }

  // ---------------------------------------------------------------- apply all live data
  function applyLive() {
    const [st, tx] = xChip();
    chip('x', st, tx); chip('hood', st, tx);
    const hb = LIVE.x?.hourly || {}, fmt = v => n(v) == null ? '—' : Number(v).toLocaleString('en-US');
    $('[data-hd="up"]').textContent = fmt(hb.up); $('[data-hd="down"]').textContent = fmt(hb.down); $('[data-hd="scanned"]').textContent = fmt(hb.scanned);
    buildDots(); drawDots(STATIC ? 1 : dotsP);
    renderCockpit(STATIC ? 1 : ckP);
    renderSectors(); renderEngines(); renderStructure();
    if (!STATIC) ScrollTrigger.refresh();
  }

  // ---------------------------------------------------------------- loop nodes
  const LOOP = [['Analyze', 'Market structure'], ['Plan', 'Rules and risk'], ['Trade', 'Your decisions'], ['Journal', 'Record the facts'], ['Evaluate', 'Review outcomes'], ['Learn', 'Find patterns'], ['Improve', 'Test refinements']];
  $('[data-lp-nodes]').innerHTML = LOOP.map(([name], i) => { const a = (-90 + i * 360 / LOOP.length) * Math.PI / 180; return `<g class="lp-node" data-lp="${i}" transform="translate(${(Math.cos(a) * 170).toFixed(1)} ${(Math.sin(a) * 170).toFixed(1)})"><circle r="38"/><text y="5">${name}</text></g>`; }).join('');
  const lpProg = $('[data-lp-prog]'), lpLen = 2 * Math.PI * 170;
  lpProg.setAttribute('stroke-dasharray', lpLen.toFixed(1)); lpProg.setAttribute('stroke-dashoffset', lpLen.toFixed(1));
  function renderLoop(p) {
    lpProg.setAttribute('stroke-dashoffset', (lpLen * (1 - clamp(p))).toFixed(1));
    const i = Math.min(LOOP.length - 1, Math.floor(clamp(p) * LOOP.length));
    $$('.lp-node').forEach((g, j) => g.classList.toggle('on', j <= i));
    $('[data-lp-name]').textContent = LOOP[i][0]; $('[data-lp-desc]').textContent = LOOP[i][1];
  }

  // ---------------------------------------------------------------- turnkey layout
  const WINS = $$('.tk-win');
  const SCATTER = [[-4, 4, -11], [58, -4, 8], [22, 30, -4], [66, 50, 13], [-2, 60, 7], [36, 70, -9]];
  const GRID = WINS.map((_, i) => [3 + (i % 3) * 32.3, 11 + Math.floor(i / 3) * 44.5]);

  // ---------------------------------------------------------------- start loading
  loadHeroCandles(); setInterval(loadHeroCandles, 30000);
  loadLive(); setInterval(loadLive, 60000);
  addEventListener('resize', () => { buildDots(); drawDots(); });

  // ---------------------------------------------------------------- static (reduced motion / no GSAP)
  if (STATIC) {
    setRpm(1);
    $$('[data-count]').forEach(e => { const v = +e.dataset.count; e.textContent = e.dataset.format === 'comma' ? v.toLocaleString('en-US') : v; });
    $$('.tf-cycle i').forEach((e, i) => { e.style.position = 'static'; e.style.marginRight = '8px'; if (i) e.style.color = 'var(--muted)'; });
    const tc = $('.tf-cycle'); tc.style.height = 'auto'; tc.style.display = 'flex';
    $('.cta-line').style.transform = 'scaleX(1)';
    $$('.ai-steps li').forEach(li => li.classList.add('on'));
    $('[data-ez="typing"]').hidden = true;
    if (innerWidth > 900) WINS.forEach((w, i) => { w.style.left = `${GRID[i][0]}%`; w.style.top = `${GRID[i][1]}%`; });
    $$('.tk-win em').forEach(e => { e.style.opacity = 1; });
    $('.tk-frame').style.opacity = 1;
    renderLoop(1); renderCockpit(1); drawDots(1);
    return;
  }

  // ---------------------------------------------------------------- motion
  gsap.registerPlugin(ScrollTrigger);
  let lenis = null;
  if (window.Lenis) {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    const t = a.getAttribute('href'); if (t.length < 2) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(t, { offset: 0, duration: 1.4 }); else document.querySelector(t)?.scrollIntoView({ behavior: 'smooth' });
  });
  gsap.to('.nav-progress i', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

  // hero intro: letters drive in, tach does a start-up sweep
  $$('[data-split]').forEach(line => { line.innerHTML = line.textContent.split(/(\s+)/).map(w => /\s+/.test(w) ? w : `<span class="word" style="display:inline-block;white-space:nowrap">${[...w].map(ch => `<span class="ch">${esc(ch)}</span>`).join('')}</span>`).join(''); });
  const rpm = { v: 0 };
  gsap.timeline({ defaults: { ease: 'power4.out' } })
    .from('.kicker', { y: 20, opacity: 0, duration: 0.7 })
    .from('.hero-title .ch', { yPercent: 115, rotate: 6, duration: 1, stagger: 0.016 }, 0.1)
    .from('.hero-sub,.hero-cta,.hero-inner .fine', { y: 24, opacity: 0, duration: 0.8, stagger: 0.1 }, 0.7)
    .from('.hero-tach > *', { opacity: 0, scale: 0.85, duration: 1.1 }, 0.2)
    .to(rpm, { v: 10, duration: 0.7, ease: 'power2.in', onUpdate: () => setRpm(rpm.v) }, 0.5)
    .to(rpm, { v: 1, duration: 0.9, ease: 'power2.out', onUpdate: () => setRpm(rpm.v) }, 1.2)
    .from('.scroll-cue,.hero-live', { opacity: 0, duration: 0.6 }, 1.5);

  // hero scroll (created in page order so later pins measure after the hero's pin space)
  const rev = { v: 1 };
  gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: '+=120%', pin: true, scrub: 0.6, anticipatePin: 1 } })
    .to(rev, { v: 9.7, ease: 'power1.in', duration: 1, onUpdate: () => setRpm(rev.v) }, 0)
    .to('.hero-inner', { yPercent: -18, opacity: 0.08, scale: 0.96, ease: 'power1.in', duration: 1 }, 0)
    .to('.hero-video', { scale: 1.18, duration: 1, ease: 'none' }, 0)
    .to('.hero-candles', { yPercent: -10, opacity: 0.9, duration: 1, ease: 'none' }, 0)
    .to('.hero-tach', { scale: 1.12, xPercent: -8, duration: 1, ease: 'power1.inOut' }, 0)
    .to('.scroll-cue', { opacity: 0, duration: 0.2 }, 0)
    .to('.hero-flash', { opacity: 1, duration: 0.15, ease: 'power2.in' }, 0.85)
    .to('.hero-flash', { opacity: 0.4, duration: 0.15 }, 1);

  // stats
  ScrollTrigger.create({ trigger: '.stats', start: 'top 88%', once: true, onEnter: () => {
    $$('[data-count]').forEach(e => { const o = { v: 0 }, v = +e.dataset.count; gsap.to(o, { v, duration: 1.8, ease: 'power3.out', onUpdate: () => { e.textContent = e.dataset.format === 'comma' ? Math.round(o.v).toLocaleString('en-US') : Math.round(o.v); } }); });
    gsap.from('.stat', { y: 30, opacity: 0, stagger: 0.12, duration: 0.8, ease: 'power3.out' });
  } });
  const tfs = $$('.tf-cycle i'); gsap.set(tfs, { yPercent: 110 }); gsap.set(tfs[0], { yPercent: 0 });
  const cyc = gsap.timeline({ repeat: -1 });
  tfs.forEach((e, i) => { const nx = tfs[(i + 1) % tfs.length]; cyc.to(e, { yPercent: -110, duration: 0.45, ease: 'power2.in' }, '+=1.1').fromTo(nx, { yPercent: 110 }, { yPercent: 0, duration: 0.45, ease: 'power2.out' }, '<0.15'); });

  $$('.ch-head h2,.ck-copy h2,.hd-copy h2,.sec-head h3,.en-head h2,.st-copy h2,.ai-head h2,.ez-copy h2,.tk-copy h2,.lp-copy h2,.cta h2').forEach(h => gsap.from(h, { y: 60, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: h, start: 'top 86%' } }));

  const mm = gsap.matchMedia();
  mm.add({ desk: '(min-width: 901px)', mob: '(max-width: 900px)' }, ctx => {
    const { desk } = ctx.conditions;
    const pinOr = (trigger, end, mobTrigger) => desk ? { trigger, start: 'top top', end, pin: true, scrub: 0.6 } : { trigger: mobTrigger, start: 'top 80%', end: 'bottom 30%', scrub: 0.6 };

    // 3 · challenges: pinned horizontal ride; each card turns to "how Redline helps" mid-screen
    const track = $('[data-track]'), cards = $$('.card', track), meterB = $('[data-ch-index]'), meterE = $('.ch-meter em');
    if (desk) {
      const dist = () => track.scrollWidth - innerWidth;
      const ride = gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: '.ch-pin', start: 'top top', end: () => `+=${dist()}`, pin: true, scrub: 0.8, invalidateOnRefresh: true,
        onUpdate: s => { const i = Math.min(10, Math.floor(s.progress * 9.99) + 1); meterB.textContent = String(i).padStart(2, '0'); meterE.style.transform = `scaleX(${i / 10})`; } } });
      cards.forEach(card => {
        const help = $('.help', card);
        gsap.fromTo(help, { y: () => help.offsetHeight - 52 }, { y: 0, ease: 'power2.out', immediateRender: true, scrollTrigger: { trigger: card, containerAnimation: ride, start: 'left 75%', end: 'left 35%', scrub: true, invalidateOnRefresh: true } });
        gsap.fromTo($('.card-in', card), { rotateY: -18, scale: 0.92, opacity: 0.5 }, { rotateY: 0, scale: 1, opacity: 1, ease: 'none', scrollTrigger: { trigger: card, containerAnimation: ride, start: 'left 100%', end: 'left 60%', scrub: true } });
      });
    } else cards.forEach(card => gsap.from(card, { y: 50, opacity: 0, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: card, start: 'top 88%' } }));

    // 4 · cockpit: needles sweep to the LIVE values, the lever travels to the live gear
    ScrollTrigger.create({ ...pinOr('.ck-pin', '+=170%', '.ck-dash'), onUpdate: s => renderCockpit(s.progress) });
    renderCockpit(0);

    // 5 · under the hood: the index line splits into every scanned stock
    ScrollTrigger.create({ ...pinOr('.hd-pin', '+=130%', '.hd-field'), onUpdate: s => drawDots(s.progress) });
    drawDots(0);

    // 6 · engines: each card settles behind the next one
    if (desk) $$('.en-card').forEach((card, i, all) => { const next = all[i + 1]; if (next) gsap.to(card, { scale: 0.94, filter: 'brightness(0.45)', ease: 'none', scrollTrigger: { trigger: next, start: () => `top ${96 + i * 16 + card.offsetHeight}px`, end: () => `top ${96 + (i + 1) * 16}px`, scrub: true, invalidateOnRefresh: true } }); });   // dims only while the next card slides over it
    else $$('.en-card').forEach(card => gsap.from(card, { y: 40, opacity: 0, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: card, start: 'top 88%' } }));

    // 7 · structure: the real candles draw left to right, then zones, then the Engine 22 ladder
    const reveal = $('[data-reveal-rect]');
    gsap.set(reveal, { attr: { width: 0 } });
    gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: pinOr('.st-pin', '+=140%', '.st-chart-wrap') })
      .to(reveal, { attr: { width: 800 }, duration: 2 })
      .fromTo('.st-zones', { opacity: 0 }, { opacity: 1, duration: 0.6 }, 1.2)
      .fromTo('.st-price', { opacity: 0 }, { opacity: 1, duration: 0.3 }, 1.9)
      .fromTo('[data-ladder]', { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.6 }, 0.2);

    // 8 · AI bot steps light up one by one
    $$('.ai-steps li').forEach(li => ScrollTrigger.create({ trigger: li, start: 'top 78%', onEnter: () => li.classList.add('on'), onLeaveBack: () => li.classList.remove('on') }));
    gsap.to('.ai-orb i', { scale: 1.08, opacity: 0.4, duration: 1.6, stagger: 0.3, repeat: -1, yoyo: true, ease: 'sine.inOut' });

    // 10 · turnkey: scattered tool windows snap into one Redline workflow
    if (desk) {
      WINS.forEach((w, i) => gsap.set(w, { left: `${SCATTER[i][0]}%`, top: `${SCATTER[i][1]}%`, rotate: SCATTER[i][2] }));
      const tk = gsap.timeline({ defaults: { ease: 'power2.inOut' }, scrollTrigger: pinOr('.tk-pin', '+=130%', '.tk-stage') });
      WINS.forEach((w, i) => tk.to(w, { left: `${GRID[i][0]}%`, top: `${GRID[i][1]}%`, rotate: 0, duration: 1 }, i * 0.08));
      tk.to('.tk-frame', { opacity: 1, duration: 0.5 }, 0.7).to('.tk-win i', { opacity: 0.35, duration: 0.3 }, 0.9).to('.tk-win em', { opacity: 1, duration: 0.3 }, 0.95).fromTo('[data-tk-a]', { opacity: 1 }, { opacity: 0.35, duration: 0.4 }, 0.8);
    }

    // 11 · loop
    ScrollTrigger.create({ ...pinOr('.lp-pin', '+=140%', '.lp-ring'), onUpdate: s => renderLoop(s.progress) });
    renderLoop(0);

    return () => { WINS.forEach(w => gsap.set(w, { clearProps: 'left,top,rotate' })); };
  });

  // 9 · ENZO: the question appears, ENZO "types", then the answer types out
  const ans = $('[data-ez-text]'), full = ans.textContent;
  gsap.set(['[data-ez="q"]', '[data-ez="typing"]', '[data-ez="a"]'], { opacity: 0, y: 14 }); ans.textContent = '';
  ScrollTrigger.create({ trigger: '.ez-chat', start: 'top 70%', once: true, onEnter: () => {
    const o = { i: 0 };
    gsap.timeline()
      .to('[data-ez="q"]', { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' })
      .to('[data-ez="typing"]', { opacity: 1, y: 0, duration: 0.3 }, '+=0.3')
      .to('[data-ez="typing"]', { opacity: 0, height: 0, padding: 0, duration: 0.25 }, '+=1.1')
      .to('[data-ez="a"]', { opacity: 1, y: 0, duration: 0.4 })
      .to(o, { i: full.length, duration: full.length * 0.014, ease: 'none', onUpdate: () => { ans.textContent = full.slice(0, Math.round(o.i)); } });
  } });

  // cta
  gsap.to('.cta-line', { scaleX: 1, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top 85%', end: 'top 30%', scrub: 0.5 } });
  gsap.from('.cta .btn', { scale: 0.8, opacity: 0, duration: 0.8, ease: 'back.out(2)', scrollTrigger: { trigger: '.cta .btn', start: 'top 92%' } });
  addEventListener('load', () => ScrollTrigger.refresh());
})();
