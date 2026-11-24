'use strict';
/* Chart Indicators pull-down (client 2026-11-24, laid out like Brian's Full Chart "Indicators" menu).
   Sections in his order: Engine 22 wave nodes per degree · Engine 18 liquidity · EMA · Volume ·
   SMZ overlays · Engine 17 · Engine 26 · Engine 25 · Engine 29. Live now:
   - Institutional Zones (auto): /api/v1/es-smz-levels — the backend serves Brian's manual file
     services/core/data/es-smz-manual-zones.txt (institutional parents + NEG negotiated zones), so the
     chart follows that file whenever he edits it. ES charts only (the zones are ES prices).
   - Acc/Dist Shelves (auto): /api/v1/es-smz-shelves.
   - EMA 10 / 20 / 50 / 200 on the chart's own bars, Volume histogram (existing chart setting).
   - Engine 17 top-right pills (moved off the strip above the chart, so the chart fills the screen).
   Items whose data feed is not wired yet are listed and marked NEXT (the client is sending them).
   Overlay only: drawn on .ci-layer inside .chart-frame, never touches the price svg; read-only GETs. */
(() => {
  const doc = document, $ = (s, r = doc) => r.querySelector(s), $$ = (s, r = doc) => [...r.querySelectorAll(s)];
  const KEY = 'redline-indicators-v1';
  const DEF = { traderView: false, zones: true, zoneLabels: true, shelves: true, ema: true, ema10: false, ema20: true, ema50: true, ema200: false, e17: true, pills: true };
  const read = () => { try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY)) || {}); } catch { return { ...DEF }; } };
  const P = read();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch { /* private window */ } };
  const E = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const n = v => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
  const onChart = () => typeof page !== 'undefined' && page === 'chart';
  const EMA_COL = { 10: '#f59e0b', 20: '#c084fc', 50: '#38bdf8', 200: '#f43f5e' };
  const DEGREES = ['Primary', 'Intermediate', 'Minor', 'Minute', 'Subminute', 'Micro', 'Submicro'];

  // ---------------------------------------------------------------- data (read-only)
  const D = { zones: [], shelves: [], zonesAt: null, err: null, loading: false };
  async function load() {
    const api = window.redlineApi; if (!api || D.loading) return;
    D.loading = true;
    try {
      const [lv, sh] = await Promise.allSettled([api.esSmzLevels(), api.esSmzShelves()]);
      if (lv.status === 'fulfilled' && lv.value?.data?.ok !== false) {
        const d = lv.value.data || {}, rows = Array.isArray(d.levels) && d.levels.length ? d.levels : Array.isArray(d.levels_debug) ? d.levels_debug : (d.structures_sticky || []);
        D.zones = rows.filter(z => String(z.status || 'active').toLowerCase() === 'active').map(z => {
          const r = z.displayPriceRange || z.priceRange || [], a = n(r[0]), b = n(r[1]);
          return a == null || b == null ? null : { hi: Math.max(a, b), lo: Math.min(a, b), neg: !!z.isNegotiated, strength: n(z.strength), note: /^manual es/i.test(z.details?.facts?.sticky?.notes || '') ? '' : (z.details?.facts?.sticky?.notes || '') };   // only notes Brian wrote in the file
        }).filter(Boolean);
        D.zonesAt = d.meta?.generated_at_utc || null; D.err = null;
      } else D.err = 'zones unavailable';
      if (sh.status === 'fulfilled' && sh.value?.data?.ok !== false) {
        D.shelves = (sh.value.data?.levels || []).map(z => { const r = z.priceRange || [], a = n(r[0]), b = n(r[1]); return a == null || b == null ? null : { hi: Math.max(a, b), lo: Math.min(a, b), type: String(z.type || '').toLowerCase(), strength: n(z.strength) }; }).filter(Boolean);
      }
    } finally { D.loading = false; schedule(); }
  }

  // ---------------------------------------------------------------- drawing
  const emaSeries = (vals, len) => { const k = 2 / (len + 1); let prev = null; return vals.map((v, i) => (prev = i === 0 ? v : v * k + prev * (1 - k))); };
  function layer(frame) {
    let el = frame.querySelector(':scope > .ci-layer');
    if (!el) { el = doc.createElement('div'); el.className = 'ci-layer'; el.innerHTML = '<svg class="ci-svg"></svg><div class="ci-pills" aria-label="Engine 17 snapshot pills"></div><div class="ci-zone-note"></div>'; frame.appendChild(el); }
    return el;
  }
  let raf = 0, to = 0;
  function schedule() { if (raf) return; const run = () => { if (!raf) return; cancelAnimationFrame(raf); clearTimeout(to); raf = 0; draw(); }; raf = requestAnimationFrame(run); to = setTimeout(run, 120); }
  function draw() {
    if (!onChart() || typeof chartGeometry !== 'function') return;
    const frame = $('.chart-frame'); if (!frame) return;
    let g; try { g = chartGeometry(); } catch { return; }
    if (!g?.data?.length || !(g.max > g.min)) return;
    const el = layer(frame), W = frame.clientWidth, H = frame.clientHeight, svg = $('.ci-svg', el);
    const X = vx => vx / 900 * W, Y = p => g.y(p) / 400 * H, x0 = X(8), x1 = X(830), yTop = 0, yBot = 375 / 400 * H;
    const inView = (hi, lo) => hi >= g.min && lo <= g.max;
    const band = (hi, lo, cls, label) => { const a = Math.max(yTop, Y(hi)), b = Math.min(yBot, Y(lo)); if (b <= a) return ''; const mid = (a + b) / 2; return `<g class="${cls}"><rect x="${x0.toFixed(1)}" y="${a.toFixed(1)}" width="${(x1 - x0).toFixed(1)}" height="${Math.max(1.5, b - a).toFixed(1)}"/><line x1="${x0.toFixed(1)}" x2="${x1.toFixed(1)}" y1="${a.toFixed(1)}" y2="${a.toFixed(1)}"/><line x1="${x0.toFixed(1)}" x2="${x1.toFixed(1)}" y1="${b.toFixed(1)}" y2="${b.toFixed(1)}"/>${P.zoneLabels && label ? `<text x="${((x0 + x1) / 2).toFixed(1)}" y="${(mid + 4).toFixed(1)}">${E(label)}</text>` : ''}</g>`; };
    const isES = typeof symbol !== 'undefined' && /^(ES|MES)/.test(String(symbol).toUpperCase());
    let out = '';
    if (P.shelves && isES) out += D.shelves.filter(z => inView(z.hi, z.lo)).map(z => band(z.hi, z.lo, `ci-shelf ${z.type === 'distribution' ? 'dist' : 'acc'}`, `ES ${z.type === 'distribution' ? 'Distribution' : 'Accumulation'}${z.strength != null ? ` ${Math.round(z.strength)}` : ''}`)).join('');
    if (P.zones && isES) {
      // parents first so the negotiated (NEG) zones sit on top of them
      const zs = D.zones.filter(z => inView(z.hi, z.lo)).sort((a, b) => a.neg - b.neg);
      out += zs.map(z => band(z.hi, z.lo, z.neg ? 'ci-zone neg' : 'ci-zone inst', z.neg ? `Negotiated ${z.lo.toFixed(2)}–${z.hi.toFixed(2)}` : `Institutional${z.strength != null ? ` ${Math.round(z.strength)}` : ''}${z.note ? ` · ${z.note}` : ''}`)).join('');
    }
    if (P.ema) {
      const closes = g.s.all.map(b => b.c);
      for (const len of [10, 20, 50, 200]) {
        if (!P[`ema${len}`]) continue;
        const e = emaSeries(closes, len).slice(g.start, g.end), pts = [];
        e.forEach((v, i) => { if (g.start + i >= len - 1 && Number.isFinite(v)) pts.push(`${X(g.x(i)).toFixed(1)},${Y(v).toFixed(1)}`); });
        if (pts.length > 1) out += `<polyline class="ci-ema" points="${pts.join(' ')}" stroke="${EMA_COL[len]}"/>`;
      }
    }
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    svg.innerHTML = `<defs><clipPath id="ciClip"><rect x="${x0.toFixed(1)}" y="0" width="${(x1 - x0).toFixed(1)}" height="${yBot.toFixed(1)}"/></clipPath></defs><g clip-path="url(#ciClip)">${out}</g>`;
    // Engine 17 top-right pills
    const pillsEl = $('.ci-pills', el), pills = window.redlineChart?.model?.pills || [];
    pillsEl.hidden = !(P.e17 && P.pills && pills.length);
    if (!pillsEl.hidden) { const html = pills.map(([k, v]) => `<span><small>${E(k)}</small><b class="${/LONG|BULL|ALIGN|READY|PERMIT|UP/.test(String(v)) ? 'up' : /SHORT|BEAR|BLOCK|STAND|DOWN/.test(String(v)) ? 'down' : /WAIT|WATCH|NEUTRAL|—/.test(String(v)) ? 'warn' : ''}">${E(v)}</b></span>`).join(''); if (pillsEl.innerHTML !== html) pillsEl.innerHTML = html; }
    tvPlace(); paintRange();
    const note = $('.ci-zone-note', el);
    note.textContent = P.zones && !isES ? 'Institutional zones are ES prices — open ES to see them' : '';
    note.hidden = !note.textContent;
  }


  // ---------------------------------------------------------------- Trader View (Brian 2026-11-24)
  // Mirrors Frye-Dashboard src/pages/traderView/TraderViewPage.jsx: one display-only route,
  // GET /api/v1/trader-view?symbol=ES (traderView.v1), polled every 15 s while open; the last good
  // reading stays on screen if a refresh fails. Card titles/questions are his design text; every value
  // comes from the response. Sits over the chart but outside .chart-frame, so scrolling the panel never
  // pans or zooms the chart.
  const TV_CARDS = [
    ['location', 'Engine 26 · Location', 'Where is the trade?'],
    ['reaction', 'Engine 3 · Price reaction', 'Are buyers or sellers in control at the zone?'],
    ['participation', 'Engine 4 · Volume', 'Is real money behind the move?'],
    ['permission', 'Engine 6 · Permission', 'Can the paper trade go?'],
    ['structure', 'Engine 22 · Micro wave count', 'Where are we on the Micro chart?'],
    ['marketContext', 'Market context · Engines 25 / 29 + ES Master', 'Is the bigger picture helping?']
  ];
  const PIPE_NAMES = { location: 'Location', reaction: 'Reaction', participation: 'Volume', permission: 'Permission' };
  const TF_ORDER = [['10m', '10m'], ['30m', '30m'], ['1h', '1H'], ['4h', '4H'], ['1d', 'Daily'], ['eod', 'EOD']];
  const STATUS = ['READY', 'WAITING', 'BLOCKED', 'INFO', 'UNAVAILABLE'];
  const TV = { data: null, err: null, loading: false, timer: 0, open: {}, all: false };
  const hum = v => {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v !== 'string') return String(v);
    const words = t => { const x = t.replace(/_/g, ' ').toLowerCase(); return x.charAt(0).toUpperCase() + x.slice(1); };
    if (/^[A-Z0-9_]+$/.test(v)) return v.includes('_') ? words(v) : v;
    return v.replace(/\b[A-Z0-9]+(?:_[A-Z0-9]+)+\b/g, words);
  };
  const price = v => typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
  const azTime = t => { const d = t ? new Date(t) : null; return d && !isNaN(d) ? d.toLocaleTimeString('en-US', { timeZone: 'America/Phoenix' }) + ' AZ' : '—'; };
  const chipOf = (st, text) => { const up = String(st || '').toUpperCase(), cls = STATUS.includes(up) ? up : ['LIVE', 'STALE', 'SAMPLE'].includes(up) ? up : 'UNAVAILABLE'; return `<span class="tvp-chip tvp-${cls}">${E(text || cls)}</span>`; };
  const kvHtml = (label, value) => {
    const raw = String(label ?? ''), tag = /\(shadow\)/i.test(raw) ? '<span class="tvp-tag shadow">Shadow</span>' : /\(research\)/i.test(raw) ? '<span class="tvp-tag research">Research</span>' : /\(diagnostic\)/i.test(raw) ? '<span class="tvp-tag diag">Diagnostic</span>' : '';
    return `<div class="tvp-kv${/\(research\)/i.test(raw) ? ' research' : ''}"><small>${E(raw.replace(/\s*\((shadow|research|diagnostic)\)\s*/i, ' ').trim())}${tag}</small><b>${E(hum(value))}</b></div>`;
  };
  function rows(obj, skip = [], prefix = '', out = []) {
    if (!obj || typeof obj !== 'object' || out.length > 80) return out;
    for (const [k, v] of Object.entries(obj)) {
      if (skip.includes(k)) continue;
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) rows(v, [], key, out);
      else out.push(`<div class="tvp-drow"><span>${E(key)}</span><b>${E(Array.isArray(v) ? (v.length ? v.map(x => typeof x === 'object' ? JSON.stringify(x) : hum(String(x))).join(', ') : '—') : hum(v == null ? null : String(v)))}</b></div>`);
    }
    return out;
  }
  const tfTable = (title, src, data) => {
    if (!data || typeof data !== 'object') return '';
    const cols = TF_ORDER.filter(([k]) => data[k]);
    if (!cols.length) return '';
    return `<p class="tvp-sub" title="${E(src || '')}">${E(title)}</p><table class="tvp-table"><thead><tr>${cols.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead><tbody><tr>${cols.map(([k]) => `<td>${typeof data[k].score === 'number' ? Math.round(data[k].score) : '—'} <span>${E(data[k].state || '')}</span></td>`).join('')}</tr></tbody></table>`;
  };
  function cardExtras(key, sec) {
    const d = sec?.details || {};
    if (key === 'reaction') {
      const tf = d.timeframes; if (!tf) return '';
      return `<p class="tvp-sub">Timeframe evidence only · Engine 3's official direction above decides</p><div class="tvp-facts">${[['1-min (forming)', tf.oneMinute?.state], ['5-min (last completed)', tf.fiveMinute?.completedState ?? tf.fiveMinute?.state], ['10-min (last completed)', tf.tenMinute?.completedState ?? tf.tenMinute?.state]].map(([l, v]) => kvHtml(l, v)).join('')}</div>`;
    }
    if (key === 'marketContext') return tfTable('ES price trend (ES Master lights)', d.esTrendSource, d.esTrendByTimeframe) + tfTable('Market breadth (whole-market internals)', d.marketBreadthSource, d.marketBreadthByTimeframe);
    const w = d.displayWarnings;
    return Array.isArray(w) && w.length ? w.map(x => `<p class="tvp-warn">⚠ ${E(x.meaning || x.code)}${Array.isArray(x.levels) && x.levels.length ? ` (${x.levels.map(price).join(', ')})` : ''}</p>`).join('') : '';
  }
  function cardDetails(key, sec) {
    const d = sec?.details || {};
    if (key === 'reaction') { const tf = d.timeframes || {}; return ['oneMinute', 'fiveMinute', 'tenMinute'].filter(k => tf[k]).map(k => `<div class="tvp-drow"><span>${k}</span><b>now ${E(hum(tf[k].state))} / ${E(hum(tf[k].direction))} / ${E(hum(tf[k].quality))} · last completed ${E(hum(tf[k].completedState))} / ${E(hum(tf[k].completedDirection))}</b></div>`).join('') + (sec.explain ? `<p class="tvp-sub">Why Engine 3 is waiting</p>${rows(sec.explain).join('')}` : ''); }
    if (key === 'participation') return `${d.shadow ? `<p class="tvp-sub">Engine 4 v2 <span class="tvp-tag shadow">Shadow</span></p>${rows(d.shadow).join('')}` : ''}${d.canonicalLegacyRatio ? `<p class="tvp-sub">Legacy bar-to-bar ratio (details only)</p>${rows(d.canonicalLegacyRatio).join('')}` : ''}${rows(d, ['shadow', 'canonicalLegacyRatio']).join('')}`;
    if (key === 'marketContext') return `${d.engine25 ? `<p class="tvp-sub">Engine 25 · market health</p>${rows(d.engine25).join('')}` : ''}${d.engine29 ? `<p class="tvp-sub">Engine 29</p>${rows(d.engine29).join('')}` : ''}${d.ema10m ? `<p class="tvp-sub">10-minute EMA (display heuristic)</p>${rows(d.ema10m).join('')}` : ''}`;
    return rows(d, ['displayWarnings']).join('');
  }
  function tvHtml() {
    const data = TV.data;
    const head = `<div class="tvp-bar"><b>Trader View</b><span>ES · Strategy 1 · display only</span><button type="button" class="tvp-x" data-tvp-close aria-label="Close Trader View">×</button></div>`;
    if (!data) return head + `<div class="tvp-body"><p class="tvp-banner ${TV.loading ? 'info' : ''}">${TV.loading ? 'Loading Trader View…' : `Trader View unavailable${TV.err ? `: ${E(TV.err)}` : '.'}`}</p></div>`;
    const sec = data.sections || {}, v = data.verdict || {}, md = data.marketDirection || {}, fr = data.freshness || {};
    const zone = (sec.location?.facts || []).find(f => String(f.label).toLowerCase() === 'zone')?.value;
    const mdText = md.state && md.state !== 'UNAVAILABLE' ? `${md.gear ? `${md.gear} · ` : ''}${md.gearLabel || hum(md.state)}${typeof md.masterScore === 'number' ? ` · ${md.masterScore}` : ''}` : 'Unavailable';
    const fresh = String(fr.status || 'UNKNOWN').toUpperCase();
    const freshTitle = [fr.snapshotAsOf ? `Snapshot ${azTime(fr.snapshotAsOf)}` : '', fr.meterAvailable === false ? 'ES Master meter unavailable' : '', ...(Array.isArray(fr.notes) ? fr.notes : []), TV.err ? `Last refresh failed: ${TV.err} (showing last good data)` : ''].filter(Boolean).join(' · ');
    const card = ([key, title, q]) => {
      const s2 = sec[key]; const open = TV.all || TV.open[key];
      if (!s2) return `<article class="tvp-card"><header><div><small>${title}</small><p>${q}</p></div>${chipOf('UNAVAILABLE')}</header><p class="tvp-muted">Not in this reading.</p></article>`;
      return `<article class="tvp-card"><header><div><small>${title}</small><p>${q}</p></div>${chipOf(s2.status)}</header>
        <h5>${E(s2.label || '—')}</h5><p class="tvp-text">${E(s2.plainEnglish || '')}</p>
        ${(s2.facts || []).length ? `<div class="tvp-facts">${s2.facts.map(f => kvHtml(f.label, f.value)).join('')}</div>` : ''}
        ${cardExtras(key, s2)}
        ${s2.waitingFor ? `<p class="tvp-wait"><b>Waiting for:</b> ${E(s2.waitingFor)}</p>` : ''}
        <button type="button" class="tvp-btn" data-tvp-card="${key}">${open ? 'Hide details' : 'Show details'}</button>
        ${open ? `<div class="tvp-details">${cardDetails(key, s2)}<p class="tvp-src">${E(s2.sourceEngine || '')} · ${E(s2.sourcePath || '')}${s2.sourceTimestamp ? ` · ${azTime(s2.sourceTimestamp)}` : ''}</p></div>` : ''}
      </article>`;
    };
    return head + `<div class="tvp-body">
      ${fresh === 'STALE' ? `<p class="tvp-banner" role="alert">STALE — the engine snapshot is old${fr.snapshotAsOf ? ` (as of ${azTime(fr.snapshotAsOf)})` : ''}. Don't act on this screen until it shows LIVE.</p>` : ''}
      ${TV.err ? `<p class="tvp-banner info">Last refresh failed (${E(TV.err)}). Showing the last good reading.</p>` : ''}
      <section class="tvp-top">
        <div><small>${E(data.symbol || 'ES')} futures · Strategy 1 · 10m</small><b class="tvp-price">${price(data.price)}</b></div>
        <div class="tvp-verdict ${v.state === 'PAPER_ALLOWED' ? 'ok' : v.state === 'NO_TRADE' ? 'no' : ''}"><span aria-hidden="true">${v.state === 'PAPER_ALLOWED' ? '✓' : '⊗'}</span><div><b>${E(v.label || 'VERDICT UNAVAILABLE')}</b><small>${E(v.plainEnglish || `Source: ${v.source || 'Engine 6'}`)}</small></div></div>
        <div><small>Market direction</small><b class="tvp-dir ${E(String(md.state || '').toLowerCase())}">${E(mdText)}</b></div>
        <div><small>Active zone</small><b class="tvp-mono">${E(zone ? hum(zone) : '—')}</b></div>
        <div class="tvp-upd"><span>Updated ${azTime(data.generatedAt)}</span><span title="${E(freshTitle)}">${chipOf(fresh)}</span>${TV.loading ? '<span class="tvp-muted">refreshing…</span>' : ''}<button type="button" class="tvp-btn" data-tvp-all>${TV.all ? 'Hide all details' : 'Show all details'}</button></div>
      </section>
      <div class="tvp-row2">
        <section class="tvp-box"><small>RIGHT NOW</small><p class="tvp-text big">${E(data.rightNow?.plainEnglish || 'No summary available.')}</p></section>
        <section class="tvp-box"><small>WHAT TURNS THIS INTO A TRADE</small><ol class="tvp-check">${(data.checklist || []).map(c => `<li class="${c.done ? 'done' : ''}"><i>${c.done ? '✓' : E(c.step)}</i><span>${E(c.label)}</span>${c.source ? `<em>${E(c.source)}</em>` : ''}</li>`).join('')}</ol></section>
      </div>
      <ol class="tvp-pipe">${(data.pipeline || []).map((pp, i) => `<li><i>${i + 1}</i><div><small>${E(pp.sourceEngine)}</small><b>${E(PIPE_NAMES[pp.key] || hum(pp.key))}</b></div>${chipOf(pp.status)}</li>`).join('')}</ol>
      <div class="tvp-cards">${TV_CARDS.map(card).join('')}</div>
      <footer class="tvp-foot"><div class="tvp-legend"><span>${chipOf('READY')} condition met</span><span>${chipOf('WAITING')} not yet, nothing wrong</span><span>${chipOf('BLOCKED')} a rule says no</span><span>${chipOf('INFO')} context only</span><span><span class="tvp-tag shadow">Shadow</span> experimental value, evidence only</span><span><span class="tvp-tag research">Research</span> owner research, not confirmed</span></div>
        <p>Paper trading only · no orders sent from this screen · final permission: ${E(data.authority?.finalPermission || 'Engine 6')}</p></footer>
    </div>`;
  }
  function tvEl() { let el = $('.tvp'); if (!el) { el = doc.createElement('div'); el.className = 'tvp'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Trader View'); doc.body.appendChild(el); } return el; }
  function tvPlace() {
    const el = $('.tvp'); if (!el || el.hidden) return;
    const frame = $('.chart-frame'), r = frame ? frame.getBoundingClientRect() : { left: 0, top: 60, width: innerWidth, height: innerHeight - 60 };
    const w = Math.min(1000, Math.max(320, r.width - 32));
    el.style.width = `${w}px`; el.style.left = `${Math.round(r.left + (r.width - w) / 2)}px`;
    el.style.top = `${Math.round(r.top + 10)}px`; el.style.maxHeight = `${Math.round(Math.max(240, r.height - 20))}px`;
  }
  function tvPaint() {
    const show = P.traderView && onChart();
    let el = $('.tvp');
    if (!show) { if (el) el.hidden = true; return; }
    el = tvEl(); el.hidden = false;
    const body = el.querySelector('.tvp-body'), top = body ? body.scrollTop : 0;
    el.innerHTML = tvHtml();
    const nb = el.querySelector('.tvp-body'); if (nb) nb.scrollTop = top;
    tvPlace();
  }
  async function tvPull() {
    if (!P.traderView || !onChart() || doc.hidden || TV.loading || !window.redlineApi?.traderView) return;
    TV.loading = true; tvPaint();
    try {
      const r = await window.redlineApi.traderView('ES');
      if (r?.data?.schema !== 'traderView.v1') throw new Error('unexpected response');
      TV.data = r.data; TV.err = null;
    } catch (e) { TV.err = String(e?.message || e); }
    finally { TV.loading = false; tvPaint(); }
  }
  function tvSync() {
    clearInterval(TV.timer); TV.timer = 0;
    if (P.traderView && onChart()) { tvPull(); TV.timer = setInterval(tvPull, 15000); }
    tvPaint();
  }
  doc.addEventListener('click', e => {
    const t = e.target;
    if (t.closest?.('[data-tvp-close]')) { P.traderView = false; save(); tvSync(); paintMenu(); return; }
    if (t.closest?.('[data-tvp-all]')) { TV.all = !TV.all; if (!TV.all) TV.open = {}; tvPaint(); return; }
    const c = t.closest?.('[data-tvp-card]'); if (c) { const k = c.dataset.tvpCard; TV.open[k] = !(TV.all || TV.open[k]); if (TV.all && !TV.open[k]) { TV.all = false; TV_CARDS.forEach(([x]) => { TV.open[x] = x !== k; }); } tvPaint(); }
  });


  // ---------------------------------------------------------------- ES range buttons (client 2026-11-25, like Brian's chart)
  // All / 50 / 100 / 200 candles; Daily, 4H and 1H open on "All" (capped at 1,500 candles so the chart stays fast).
  const RANGE_CAP = 1500, RANGE = {};   // per symbol:tf → 'all' | number
  const esChart = () => typeof chartIsES === 'function' && chartIsES() && !!window.redlineLiveBars?.[`${symbol}:${tf}`]?.length;
  function rangeKey() { return `${symbol}:${tf}`; }
  function applyRange(sel, redrawNow) {
    if (typeof barTotal !== 'function') return;
    const total = barTotal(), want = sel === 'all' ? Math.min(total, RANGE_CAP) : Math.min(total, sel);
    if (want < 2) return;
    const changed = barCount !== want || chartOffset !== 0;
    barCount = want; chartOffset = 0; RANGE.applied = want;
    if (changed && redrawNow) { const svg = $('.chart-frame > svg'); if (svg && typeof chartSVG === 'function') svg.outerHTML = chartSVG(); }
  }
  function paintRange() {
    const bar = $('.pro-chart-toolbar-right'); if (!bar) return;
    let el = bar.querySelector('.es-range');
    if (!esChart()) {
      el?.remove();
      // leaving an ES "All" view: other symbols get the normal 100-candle view back
      if (RANGE.applied && barCount === RANGE.applied && typeof barTotal === 'function') { barCount = Math.min(100, barTotal()); chartOffset = 0; RANGE.applied = 0; const svg = $('.chart-frame > svg'); if (svg && typeof chartSVG === 'function') svg.outerHTML = chartSVG(); }
      return;
    }
    const k = rangeKey();
    if (RANGE[k] === undefined) { RANGE[k] = ['1D', '4h', '1h'].includes(tf) ? 'all' : 100; applyRange(RANGE[k], true); }
    else if (RANGE[k] === 'all' && barCount !== Math.min(barTotal(), RANGE_CAP)) applyRange('all', true);   // more history arrived (Engine 11)
    if (!el) { el = doc.createElement('div'); el.className = 'es-range'; el.setAttribute('role', 'group'); el.setAttribute('aria-label', 'Visible range'); bar.prepend(el); }
    const sel = RANGE[k], html = `<span>Range</span>${['all', 50, 100, 200].map(v => `<button type="button" data-es-range="${v}" class="${String(sel) === String(v) ? 'on' : ''}" aria-pressed="${String(sel) === String(v)}">${v === 'all' ? 'All' : v}</button>`).join('')}`;
    if (el.innerHTML !== html) el.innerHTML = html;
  }
  doc.addEventListener('click', e => {
    const b = e.target.closest?.('[data-es-range]'); if (!b) return;
    e.preventDefault();
    const v = b.dataset.esRange === 'all' ? 'all' : Number(b.dataset.esRange);
    RANGE[rangeKey()] = v; applyRange(v, false);
    if (typeof render === 'function') render();
  });
  // zooming or panning by hand clears the highlighted range button
  addEventListener('wheel', e => { if (e.target.closest?.('.chart-frame') && esChart()) { RANGE[rangeKey()] = 'custom'; setTimeout(paintRange, 50); } }, true);

  // ---------------------------------------------------------------- the pull-down
  const row = (key, label, opts = {}) => {
    const on = !!P[key], dis = opts.next || (opts.parent && !P[opts.parent]);
    return `<label class="ci-row${opts.sub ? ' sub' : ''}${dis ? ' off' : ''}"><input type="checkbox" data-ci="${key}" ${on && !opts.next ? 'checked' : ''} ${opts.next ? 'disabled' : ''}>${opts.dot ? `<i style="background:${opts.dot}"></i>` : ''}<span>${label}</span>${opts.next ? '<em>NEXT</em>' : ''}</label>`;
  };
  function menuHtml() {
    const vol = typeof chartPrefs !== 'undefined' && !!chartPrefs.volume;
    return `<div class="ci-head"><b>Indicators</b><button type="button" class="ci-x" data-ci-close aria-label="Close indicators">×</button></div>
    <div class="ci-body">
      <section><h4>Trader View</h4>${row('traderView', 'Trader View panel (ES · Strategy 1)')}<p class="ci-note">Brian's plain-English read of Engine 26 → 3 → 4 → 6 plus Engine 22 and market context. Display only · refreshes every 15 s.</p></section>
      <section><h4>Engine 22 — Elliott Wave Nodes</h4><p class="ci-note">Wave nodes and Engine 22 Fibonacci extensions, on/off per degree. Waiting for the node feed — coming next.</p>
        ${DEGREES.map(d => `<div class="ci-deg off"><span>${d}</span><em>NEXT</em><small>Fib extensions (Engine 22)</small></div>`).join('')}</section>
      <section><h4>Engine 18 — Liquidity Intelligence (Demo)</h4>${row('liq', 'Liquidity Zones (Level 2 · test)', { next: true })}<p class="ci-note">Experimental ES visible depth, price levels only when the feed is fresh and approved for display. Read-only.</p></section>
      <section><h4>EMA</h4>${row('ema', 'Enable EMA')}${[10, 20, 50, 200].map(l => row(`ema${l}`, `EMA ${l}`, { sub: true, parent: 'ema', dot: EMA_COL[l] })).join('')}</section>
      <section><h4>Volume</h4><label class="ci-row"><input type="checkbox" data-ci-volume ${vol ? 'checked' : ''}><span>Show Volume Histogram</span></label></section>
      <section><h4>SMZ Overlays</h4>${row('zones', 'Institutional Zones (auto)', { dot: '#1fd1b0' })}${row('zoneLabels', 'Zone labels', { sub: true, parent: 'zones' })}${row('shelves', 'Acc/Dist Shelves (auto)', { dot: '#3b82f6' })}
        <p class="ci-note">${D.zones.length ? `${D.zones.filter(z => !z.neg).length} institutional + ${D.zones.filter(z => z.neg).length} negotiated zones from the ES manual zone file${D.zonesAt ? ` · ${new Date(D.zonesAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Phoenix' })} AZ` : ''}` : D.err ? 'Zones unavailable right now.' : 'Loading zones…'} · ES charts only.</p></section>
      <section><h4>Engine 17 — Snapshot Truth</h4>${row('e17', 'Enable Engine 17')}${row('pills', 'Top-Right Pills', { sub: true, parent: 'e17' })}${['State Overlay', 'Decision Timeline', 'Engine 23 — Wave Behavior Read', 'Signal Markers', 'Trigger Line', 'Debug Panel (Raw vs Composed)'].map(t => row('x', t, { sub: true, next: true })).join('')}</section>
      <section><h4>Engine 26 — Trade Geometry</h4>${row('x', 'Trade Geometry Tool', { next: true })}</section>
      <section><h4>Engine 25 — Market Health</h4>${row('x', 'Composite Overlay', { next: true })}${row('x', 'Market Health Timeline', { next: true })}</section>
      <section><h4>Engine 29 — Cross-Market Stress</h4>${row('x', 'Cross-Market Stress Window', { next: true })}</section>
      <div class="ci-foot"><button type="button" class="btn small" data-ci-studies>Classic studies (SMA, BB, RSI, MACD…)</button><button type="button" class="btn small" data-ci-reset>Reset to defaults</button></div>
    </div>`;
  }
  let open = false;
  function paintMenu() {
    let m = $('.ci-menu');
    if (!open) { m?.remove(); return; }
    if (!m) { m = doc.createElement('div'); m.className = 'ci-menu'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', 'Chart indicators'); doc.body.appendChild(m); }
    const top = m.querySelector('.ci-body')?.scrollTop || 0;
    m.innerHTML = menuHtml();
    m.querySelector('.ci-body').scrollTop = top;
    const btn = $('.pro-chart-toolbar [data-action="chart-indicators"]');
    const r = btn ? btn.getBoundingClientRect() : { left: 80, bottom: 60 };
    m.style.left = `${Math.max(8, Math.min(innerWidth - 348, r.left))}px`;
    m.style.top = `${Math.round(r.bottom + 6)}px`;
    m.style.maxHeight = `${Math.round(innerHeight - r.bottom - 16)}px`;
  }
  function setOpen(v) { open = v; paintMenu(); $('.pro-chart-toolbar [data-action="chart-indicators"]')?.classList.toggle('active', v); }

  doc.addEventListener('change', e => {
    const t = e.target;
    if (t.matches?.('[data-ci]')) { P[t.dataset.ci] = t.checked; save(); paintMenu(); schedule(); if (t.dataset.ci === 'traderView') tvSync(); }
    else if (t.matches?.('[data-ci-volume]') && typeof chartPrefs !== 'undefined') { chartPrefs.volume = t.checked; if (typeof saveChart === 'function') saveChart(); if (typeof render === 'function') render(); }
  });
  doc.addEventListener('click', e => {
    const t = e.target;
    if (t.closest?.('[data-ci-close]')) { setOpen(false); return; }
    if (t.closest?.('[data-ci-reset]')) { Object.assign(P, DEF); save(); paintMenu(); schedule(); tvSync(); return; }
    if (t.closest?.('[data-ci-studies]')) { setOpen(false); if (typeof indicatorModal === 'function') indicatorModal(); return; }
    if (open && !t.closest?.('.ci-menu,[data-action="chart-indicators"]')) setOpen(false);
  }, true);
  doc.addEventListener('keydown', e => { if (e.key === 'Escape' && open) { setOpen(false); e.stopPropagation(); } }, true);
  addEventListener('resize', () => { if (open) paintMenu(); schedule(); tvPlace(); });

  // The toolbar's Indicators button opens the pull-down; the old studies dialog stays one click away.
  if (typeof action === 'function') {
    const before = action;
    action = function (value) {
      if (value === 'chart-indicators') { setOpen(!open); return; }
      return before.apply(this, arguments);
    };
  }

  // Full-screen chart: the side panel starts closed (Watchlist button opens it again).
  if (typeof terminalInspector !== 'undefined' && !sessionStorage.getItem('redline-chart-inspector-seen')) { terminalInspector = false; try { sessionStorage.setItem('redline-chart-inspector-seen', '1'); } catch { /* ignore */ } }

  // Redraw whenever the page or the price svg is rebuilt (render(), pan/zoom, live ticks) and when E17 loads.
  const app = doc.getElementById('app');
  if (app) new MutationObserver(recs => { for (const r of recs) { const t = r.target; if (t.closest?.('.ci-layer,.rd-layer,.ci-menu')) continue; if (t.id === 'app' || t.classList?.contains('chart-frame')) { schedule(); return; } } }).observe(app, { childList: true, subtree: true });
  addEventListener('hashchange', () => { if (!onChart()) setOpen(false); schedule(); tvSync(); });
  doc.addEventListener('visibilitychange', () => { if (!doc.hidden) tvPull(); });
  setInterval(() => { if (onChart() && !doc.hidden) schedule(); }, 5000);   // E17 pills arrive with the chart engine read
  load(); setInterval(load, 120000);
  setTimeout(tvSync, 300);
  window.redlineIndicators = { prefs: P, data: D, redraw: schedule, open: () => setOpen(true), traderView: TV, tvSync };
})();
