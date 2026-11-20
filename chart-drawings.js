'use strict';
/* Chart drawing tools for the chart terminal (#/chart), TradingView-style:
   Brushes (Brush, Highlighter), Arrows (Arrow marker, Arrow, Arrow mark up/down) and
   Shapes (Rectangle, Rotated rectangle, Path, Circle, Ellipse, Polyline, Triangle, Arc,
   Curve, Double curve).

   - Every point is anchored to bar time + price, so drawings stay on the same candles and
     prices when the chart is panned, zoomed, rescaled, redrawn by the live feed or switched
     to another timeframe. Live bars carry a timestamp; demo bars (no timestamp) fall back to
     bar index and their drawings are kept per symbol + timeframe.
   - Drawn on an overlay layer inside .chart-frame (never a direct child <svg>, so
     live-stream.js / chart-interact.js keep redrawing only the price svg).
   - Select a drawing to move it, drag its points, recolour it, change line width or delete it.
     Esc cancels / deselects, Delete removes, Enter finishes a path or polyline, Ctrl+Z undoes,
     Alt+Shift+R starts a rectangle.
   - Saved in this browser only (localStorage), like the price levels. Purely visual: nothing
     is sent to the backend and no engine value is read or changed.
   The geometry helpers at the top are pure and unit-tested in tests/chart-drawings.test.cjs. */
(function (root) {
  // ------------------------------------------------------------------ pure helpers
  const TOOLS = [
    { id: 'brush', section: 'Brushes', name: 'Brush', kind: 'free', color: '#4da3ff', width: 2, help: 'Press and drag to draw freehand. Release to finish.' },
    { id: 'highlighter', section: 'Brushes', name: 'Highlighter', kind: 'free', color: '#ffeb3b', width: 14, alpha: 0.38, help: 'Press and drag to highlight an area. Release to finish.' },
    { id: 'arrowMarker', section: 'Arrows', name: 'Arrow marker', kind: 'n', n: 2, color: '#4da3ff', width: 2, help: 'Drag from the tail to the tip, or click the tail then the tip.' },
    { id: 'arrow', section: 'Arrows', name: 'Arrow', kind: 'n', n: 2, color: '#4da3ff', width: 2, help: 'Drag from the start to the tip, or click the start then the tip.' },
    { id: 'arrowUp', section: 'Arrows', name: 'Arrow mark up', kind: 'mark', n: 1, color: '#2fe07f', width: 2, help: 'Click the price the up arrow should point to.' },
    { id: 'arrowDown', section: 'Arrows', name: 'Arrow mark down', kind: 'mark', n: 1, color: '#ff4d4d', width: 2, help: 'Click the price the down arrow should point to.' },
    { id: 'rect', section: 'Shapes', name: 'Rectangle', kind: 'n', n: 2, fill: true, color: '#ff9800', width: 2, key: 'Alt + Shift + R', help: 'Drag, or click two opposite corners. Shortcut Alt + Shift + R.' },
    { id: 'rotRect', section: 'Shapes', name: 'Rotated rectangle', kind: 'n', n: 3, fill: true, color: '#ff9800', width: 2, help: 'Click two points for one side, then a third point to set the width.' },
    { id: 'path', section: 'Shapes', name: 'Path', kind: 'multi', min: 2, color: '#4da3ff', width: 2, help: 'Click each point. Double-click or press Enter to finish, Esc to cancel.' },
    { id: 'circle', section: 'Shapes', name: 'Circle', kind: 'n', n: 2, fill: true, color: '#b388ff', width: 2, help: 'Click the centre, then a point on the edge (or drag from the centre).' },
    { id: 'ellipse', section: 'Shapes', name: 'Ellipse', kind: 'n', n: 2, fill: true, color: '#b388ff', width: 2, help: 'Drag, or click two opposite corners of the box the ellipse fits in.' },
    { id: 'polyline', section: 'Shapes', name: 'Polyline', kind: 'multi', min: 2, fill: true, color: '#2fe07f', width: 2, help: 'Click each corner. Click the first point again to close the shape, or double-click / Enter to finish open.' },
    { id: 'triangle', section: 'Shapes', name: 'Triangle', kind: 'n', n: 3, fill: true, color: '#2fe07f', width: 2, help: 'Click the three corners.' },
    { id: 'arc', section: 'Shapes', name: 'Arc', kind: 'n', n: 3, fill: true, color: '#ff9800', width: 2, help: 'Click the start, the end, then the point the arc bends through.' },
    { id: 'curve', section: 'Shapes', name: 'Curve', kind: 'n', n: 3, color: '#4da3ff', width: 2, help: 'Click the start, the end, then the point the curve bends through.' },
    { id: 'doubleCurve', section: 'Shapes', name: 'Double curve', kind: 'n', n: 3, color: '#4da3ff', width: 2, help: 'Click the start, the end, then where the first bend peaks; the second bend mirrors it.' }
  ];
  const TOOL = Object.fromEntries(TOOLS.map(t => [t.id, t]));
  const SWATCHES = ['#ed1c24', '#ff9800', '#ffeb3b', '#2fe07f', '#4da3ff', '#b388ff', '#ffffff', '#9aa7bc'];
  const WIDTHS = [1, 2, 3, 4];

  const r1 = v => Math.round(v * 10) / 10;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const pts = list => list.map(p => `${r1(p.x)},${r1(p.y)}`).join(' ');

  // Bar index <-> time. Between bars the time is interpolated; beyond either end it is
  // extrapolated with the edge bar interval, so points to the right of the last bar work.
  function timeMap(T) {
    const n = T.length;
    const step = (i, j) => (T[j] - T[i]) || 1;
    function kToT(k) {
      if (n === 0) return k;
      if (n === 1) return T[0] + k;
      if (k <= 0) return T[0] + k * step(0, 1);
      if (k >= n - 1) return T[n - 1] + (k - (n - 1)) * step(n - 2, n - 1);
      const lo = Math.floor(k);
      return T[lo] + (k - lo) * step(lo, lo + 1);
    }
    function tToK(t) {
      if (n === 0) return t;
      if (n === 1) return t - T[0];
      if (t <= T[0]) return (t - T[0]) / step(0, 1);
      if (t >= T[n - 1]) return (n - 1) + (t - T[n - 1]) / step(n - 2, n - 1);
      let lo = 0, hi = n - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (T[mid] <= t) lo = mid; else hi = mid; }
      return lo + (t - T[lo]) / step(lo, hi);
    }
    return { kToT, tToK };
  }

  // Arrow head at b pointing away from a.
  function arrowHead(a, b, size) {
    const ang = Math.atan2(b.y - a.y, b.x - a.x), s = size, w = size * 0.55;
    const bx = b.x - Math.cos(ang) * s, by = b.y - Math.sin(ang) * s;
    return [b, { x: bx + Math.sin(ang) * w, y: by - Math.cos(ang) * w }, { x: bx - Math.sin(ang) * w, y: by + Math.cos(ang) * w }];
  }
  // Solid "arrow marker": tapered shaft from a to a wide head at b.
  function fatArrow(a, b, width) {
    const len = dist(a, b) || 1, ang = Math.atan2(b.y - a.y, b.x - a.x);
    const head = Math.min(len * 0.45, 10 + width * 6), hw = 5 + width * 3.5, sw = 1.5 + width * 1.2;
    const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
    const hx = b.x - ux * head, hy = b.y - uy * head;
    return [
      { x: a.x + nx * sw * 0.35, y: a.y + ny * sw * 0.35 }, { x: hx + nx * sw, y: hy + ny * sw }, { x: hx + nx * hw, y: hy + ny * hw },
      b,
      { x: hx - nx * hw, y: hy - ny * hw }, { x: hx - nx * sw, y: hy - ny * sw }, { x: a.x - nx * sw * 0.35, y: a.y - ny * sw * 0.35 }
    ];
  }
  // Rectangle with one side a→b, width set by the signed distance of c from that side.
  function rotRect(a, b, c) {
    const len = dist(a, b) || 1, nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
    const d = (c.x - a.x) * nx + (c.y - a.y) * ny;
    return [a, b, { x: b.x + nx * d, y: b.y + ny * d }, { x: a.x + nx * d, y: a.y + ny * d }];
  }
  // Quadratic control point so the curve a→b passes through m at its midpoint.
  const quadControl = (a, b, m) => ({ x: 2 * m.x - (a.x + b.x) / 2, y: 2 * m.y - (a.y + b.y) / 2 });
  // S-curve a→b whose first bend peaks near m; the second bend mirrors it.
  function sCurve(a, b, m) {
    const lerp = t => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    // Control points at 1/3 and 2/3 of the chord, pushed ±h along its normal. The cubic's offset
    // from the chord is 3t(1-t)(1-2t)·h, which peaks at ≈0.289·h, so h = distance(m, chord) / 0.289.
    const len = dist(a, b) || 1, nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
    const h = ((m.x - a.x) * nx + (m.y - a.y) * ny) / 0.289;
    const c1 = lerp(1 / 3), c2 = lerp(2 / 3);
    return { c1: { x: c1.x + nx * h, y: c1.y + ny * h }, c2: { x: c2.x - nx * h, y: c2.y - ny * h } };
  }
  const box = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
  // Drop freehand points closer than minDist to the previous kept point (keeps the last one).
  function simplify(list, minDist) {
    if (list.length < 3) return list.slice();
    const out = [list[0]];
    for (let i = 1; i < list.length - 1; i++) if (dist(list[i], out[out.length - 1]) >= minDist) out.push(list[i]);
    out.push(list[list.length - 1]);
    return out;
  }

  // Geometry of one drawing in pixels: a list of [tag, attrs, paint] where paint is
  // 'stroke' (outline), 'fill' (solid) or 'both' (translucent fill + outline).
  function geometry(tool, P, opt = {}) {
    const t = TOOL[tool]; if (!t || !P.length) return [];
    const line = list => ['polyline', { points: pts(list) }, 'stroke'];
    const w = opt.width || t.width || 2;
    if (P.length === 1 && t.kind !== 'mark' && t.kind !== 'free') return [['circle', { cx: r1(P[0].x), cy: r1(P[0].y), r: 2.5 }, 'fill']];
    switch (tool) {
      case 'brush': case 'highlighter': return [line(P)];
      case 'arrowMarker': return [['polygon', { points: pts(fatArrow(P[0], P[1], w)) }, 'fill']];
      case 'arrow': return [['line', { x1: r1(P[0].x), y1: r1(P[0].y), x2: r1(P[1].x), y2: r1(P[1].y) }, 'stroke'], ['polygon', { points: pts(arrowHead(P[0], P[1], 8 + w * 3)) }, 'fill']];
      case 'arrowUp': case 'arrowDown': {
        const s = tool === 'arrowUp' ? 1 : -1, { x, y } = P[0], k = 0.8 + w * 0.2;
        const rel = [[0, 0], [9, 10], [3.5, 10], [3.5, 24], [-3.5, 24], [-3.5, 10], [-9, 10]];
        return [['polygon', { points: pts(rel.map(([dx, dy]) => ({ x: x + dx * k, y: y + s * dy * k }))) }, 'fill']];
      }
      case 'rect': { const b = box(P[0], P[1]); return [['rect', { x: r1(b.x), y: r1(b.y), width: r1(b.w), height: r1(b.h) }, 'both']]; }
      case 'rotRect': return P.length < 3 ? [line(P)] : [['polygon', { points: pts(rotRect(P[0], P[1], P[2])) }, 'both']];
      case 'path': return P.length < 2 ? [line(P)] : [line(P), ['polygon', { points: pts(arrowHead(P[P.length - 2], P[P.length - 1], 8 + w * 3)) }, 'fill']];
      case 'circle': return [['circle', { cx: r1(P[0].x), cy: r1(P[0].y), r: r1(dist(P[0], P[1])) }, 'both']];
      case 'ellipse': { const b = box(P[0], P[1]); return [['ellipse', { cx: r1(b.x + b.w / 2), cy: r1(b.y + b.h / 2), rx: r1(b.w / 2), ry: r1(b.h / 2) }, 'both']]; }
      case 'polyline': return opt.closed && P.length >= 3 ? [['polygon', { points: pts(P) }, 'both']] : [line(P)];
      case 'triangle': return P.length < 3 ? [line(P)] : [['polygon', { points: pts(P) }, 'both']];
      case 'arc': case 'curve': {
        if (P.length < 3) return [line(P)];
        const c = quadControl(P[0], P[1], P[2]);
        const d = `M${r1(P[0].x)} ${r1(P[0].y)} Q${r1(c.x)} ${r1(c.y)} ${r1(P[1].x)} ${r1(P[1].y)}${tool === 'arc' ? ' Z' : ''}`;
        return [['path', { d }, tool === 'arc' ? 'both' : 'stroke']];
      }
      case 'doubleCurve': {
        if (P.length < 3) return [line(P)];
        const { c1, c2 } = sCurve(P[0], P[1], P[2]);
        return [['path', { d: `M${r1(P[0].x)} ${r1(P[0].y)} C${r1(c1.x)} ${r1(c1.y)} ${r1(c2.x)} ${r1(c2.y)} ${r1(P[1].x)} ${r1(P[1].y)}` }, 'stroke']];
      }
      default: return [];
    }
  }

  const core = { TOOLS, TOOL, SWATCHES, timeMap, arrowHead, fatArrow, rotRect, quadControl, sCurve, simplify, geometry, dist };
  if (typeof module === 'object' && module.exports) module.exports = core;
  if (!root || !root.document) return;

  // ------------------------------------------------------------------ browser part
  const doc = root.document;
  const STORE_KEY = 'redline-drawings-v1', PREF_KEY = 'redline-drawing-prefs-v1', MAX_UNDO = 60;
  const read = (k, d) => { try { const v = JSON.parse(root.localStorage.getItem(k)); return v && typeof v === 'object' ? v : d; } catch { return d; } };
  const write = (k, v) => { try { root.localStorage.setItem(k, JSON.stringify(v)); } catch { /* private window: keep in memory */ } };
  const uid = () => (root.crypto?.randomUUID ? root.crypto.randomUUID() : `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

  const store = read(STORE_KEY, {});
  const prefs = Object.assign({ last: 'brush', favs: [], styles: {} }, read(PREF_KEY, {}));
  if (!TOOL[prefs.last]) prefs.last = 'brush';
  prefs.favs = (Array.isArray(prefs.favs) ? prefs.favs : []).filter(id => TOOL[id]);
  const S = { tool: null, draft: null, sel: null, drag: null, open: false, help: null, undo: [], raf: 0, hover: null };

  const ICON = {
    brush: 'M4 20c2.2 0 3.4-1.1 3.4-3 0-1.4 1.1-2.5 2.5-2.5s2.4 1.1 2.4 2.5M10.6 13.6 19.4 4.8a1.6 1.6 0 0 1 2.2 2.2l-8.8 8.8',
    highlighter: 'M3 21h8M5.5 17.5l2.8 2.8M7 16.2 17.4 5.8l2.8 2.8L9.8 19l-3.9.7zM15.6 7.6l2.8 2.8',
    arrowMarker: 'M4.5 19.5 13 11l-2.6-2.6h7.4v7.4L15.2 13.2l-8.5 8.5z',
    arrow: 'M5 19 19 5M11 5h8v8',
    arrowUp: 'M12 3.5 5 11.5h4.5v8.5h5v-8.5H19z',
    arrowDown: 'M12 20.5l7-8h-4.5V4h-5v8.5H5z',
    rect: 'M5 6.5h14v11H5zM3.5 5h3M3.5 5v3M20.5 19h-3M20.5 19v-3',
    rotRect: 'M8.5 3 21 9.8l-4.6 8.7L3.9 11.7z',
    path: 'M3 18l5-6.5 4.5 3.5 6-7.5M15.5 7.5h3.5v3.5',
    circle: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 1 0 0-17M12 11.6v.8',
    ellipse: 'M12 6c5 0 9 2.7 9 6s-4 6-9 6-9-2.7-9-6 4-6 9-6z',
    polyline: 'M4 18 7.5 6.5l6 4.5 6.5-6-1.5 13z',
    triangle: 'M5 4v16h14z',
    arc: 'M3.5 18A8.5 8.5 0 0 1 20.5 18z',
    curve: 'M4 19.5C5.5 9 11 5 20 4.5',
    doubleCurve: 'M3 17c2.8-9.5 6-9.5 9-5s6.2 4.5 9-5'
  };
  const ico = (id, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON[id]}"/></svg>`;
  const STAR = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';

  const onChart = () => typeof page !== 'undefined' && page === 'chart';
  const frameEl = () => doc.querySelector('.chart-frame');
  const styleOf = id => Object.assign({ color: TOOL[id].color, width: TOOL[id].width }, prefs.styles[id] || {});
  const savePrefs = () => write(PREF_KEY, prefs);

  // Current chart mapping: geometry + time map + storage key.
  function ctx() {
    if (typeof chartGeometry !== 'function') return null;
    const frame = frameEl(); if (!frame) return null;
    let g; try { g = chartGeometry(); } catch { return null; }
    if (!g || !g.data?.length || !(g.max > g.min)) return null;
    const all = g.s?.all || [];
    const timed = all.length > 1 && all.every(b => Number.isFinite(b.t));
    const T = timed ? all.map(b => b.t) : all.map((_, i) => i);
    const W = frame.clientWidth, H = frame.clientHeight;
    return { g, map: timeMap(T), W, H, key: timed ? `${symbol}` : `${symbol}:${tf}:demo`, frame };
  }
  const toPx = (c, a) => ({ x: (10 + (c.map.tToK(a.t) - c.g.start) * c.g.dx + c.g.dx / 2) / 900 * c.W, y: c.g.y(a.p) / 400 * c.H });
  function toAnchor(c, x, y) {
    const k = c.g.start + ((x / c.W) * 900 - 10) / c.g.dx - 0.5;
    const p = c.g.max - ((y / c.H) * 400 - 20) / 290 * (c.g.max - c.g.min);
    return { t: c.map.kToT(k), p };
  }
  const local = (c, e) => { const r = c.frame.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const inPlot = (c, q) => q.x >= 8 / 900 * c.W && q.x <= 830 / 900 * c.W && q.y >= 0 && q.y <= 375 / 400 * c.H;
  const list = key => (store[key] ||= []);
  const persist = key => { if (!store[key]?.length) delete store[key]; write(STORE_KEY, store); };
  function snapshot(key) { S.undo.push({ key, json: JSON.stringify(store[key] || []) }); if (S.undo.length > MAX_UNDO) S.undo.shift(); }

  // ---------------------------------------------------------------- rendering
  function attrs(o) { return Object.entries(o).map(([k, v]) => `${k}="${v}"`).join(' '); }
  function drawingSvg(c, d, opts = {}) {
    const t = TOOL[d.tool]; if (!t) return '';
    const P = d.pts.map(a => toPx(c, a)).concat(opts.cursor ? [opts.cursor] : []);
    const w = d.width || t.width, col = d.color || t.color, alpha = t.alpha ?? 1;
    const els = geometry(d.tool, P, { width: w, closed: d.closed });
    const paint = p => p === 'stroke' ? `fill="none" stroke="${col}" stroke-width="${w}" stroke-opacity="${alpha}" stroke-linecap="round" stroke-linejoin="round"`
      : p === 'fill' ? `fill="${col}" fill-opacity="${alpha === 1 ? 0.92 : alpha}" stroke="none"`
      : `fill="${col}" fill-opacity=".14" stroke="${col}" stroke-width="${w}" stroke-linejoin="round"`;
    const vis = els.map(([tag, a, p]) => `<${tag} ${attrs(a)} ${paint(p)}/>`).join('');
    if (opts.preview) return `<g class="rd-draft">${vis}${P.map(q => `<circle class="rd-handle" cx="${r1(q.x)}" cy="${r1(q.y)}" r="3.5"/>`).join('')}</g>`;
    const hitW = Math.max(12, w + 8);
    const hit = els.map(([tag, a, p]) => `<${tag} ${attrs(a)} class="rd-hit" data-dw="${d.id}" fill="${p === 'stroke' ? 'none' : 'transparent'}" stroke="transparent" stroke-width="${hitW}"/>`).join('');
    const sel = S.sel === d.id;
    let handles = '';
    if (sel) {
      if (t.kind === 'free') {
        const xs = P.map(q => q.x), ys = P.map(q => q.y), x0 = Math.min(...xs) - 6, y0 = Math.min(...ys) - 6;
        handles = `<rect class="rd-bbox" x="${r1(x0)}" y="${r1(y0)}" width="${r1(Math.max(...xs) - x0 + 6)}" height="${r1(Math.max(...ys) - y0 + 6)}"/>`;
      } else handles = P.map((q, i) => `<circle class="rd-handle rd-grab" data-dw="${d.id}" data-dw-pt="${i}" cx="${r1(q.x)}" cy="${r1(q.y)}" r="5"/>`).join('');
    }
    return `<g class="rd-shape${sel ? ' rd-selected' : ''}" data-tool="${d.tool}">${vis}${hit}${handles}</g>`;
  }

  function ensureLayer(frame) {
    let layer = frame.querySelector(':scope > .rd-layer');
    if (!layer) { layer = doc.createElement('div'); layer.className = 'rd-layer'; layer.innerHTML = '<svg class="rd-svg" aria-label="Chart drawings"></svg><div class="rd-favs" role="toolbar" aria-label="Favourite drawing tools"></div><div class="rd-bar" role="toolbar" aria-label="Selected drawing"></div>'; frame.appendChild(layer); }
    return layer;
  }

  function draw() {
    S.raf = 0;
    if (!onChart()) { closeMenu(); return; }
    const c = ctx(); if (!c) return;
    const layer = ensureLayer(c.frame);
    layer.classList.toggle('rd-active', !!S.tool);
    c.frame.classList.toggle('rd-drawing', !!S.tool);
    if (S.draft && S.draft.key !== c.key) S.draft = null;
    const items = store[c.key] || [];
    if (S.sel && !items.some(d => d.id === S.sel)) S.sel = null;
    const clipW = 822 / 900 * c.W, clipH = 375 / 400 * c.H;
    let out = `<defs><clipPath id="rdClip"><rect x="${r1(8 / 900 * c.W)}" y="0" width="${r1(clipW)}" height="${r1(clipH)}"/></clipPath></defs><g clip-path="url(#rdClip)">`;
    out += items.map(d => drawingSvg(c, d)).join('');
    if (S.draft) out += drawingSvg(c, S.draft, { preview: true, cursor: TOOL[S.draft.tool].kind === 'free' ? null : S.draft.cursor });
    out += '</g>';
    const svg = layer.querySelector('.rd-svg');
    svg.setAttribute('width', c.W); svg.setAttribute('height', c.H);
    svg.innerHTML = out;
    favBar(layer); selBar(layer, items.find(d => d.id === S.sel));
    syncRail();
  }
  const schedule = () => { if (!S.raf) S.raf = root.requestAnimationFrame(draw); };

  function favBar(layer) {
    const el = layer.querySelector('.rd-favs');
    const html = prefs.favs.map(id => `<button type="button" class="rd-fav-btn${S.tool === id ? ' on' : ''}" data-rd-tool="${id}" title="${TOOL[id].name}" aria-label="${TOOL[id].name}" aria-pressed="${S.tool === id}">${ico(id, 18)}</button>`).join('');
    if (el.innerHTML !== html) el.innerHTML = html;
    el.hidden = !prefs.favs.length;
  }
  function selBar(layer, d) {
    const el = layer.querySelector('.rd-bar');
    if (!d) { el.hidden = true; el.innerHTML = ''; delete el.dataset.sig; return; }
    const t = TOOL[d.tool], col = d.color || t.color, w = d.width || t.width;
    const html = `<span class="rd-bar-name">${ico(d.tool, 16)}${t.name}</span>
      <span class="rd-bar-sw">${SWATCHES.map(s => `<button type="button" data-rd-color="${s}" class="${s === col ? 'on' : ''}" style="--sw:${s}" title="Colour ${s}" aria-label="Colour ${s}"></button>`).join('')}</span>
      ${t.id === 'highlighter' ? '' : `<span class="rd-bar-w">${WIDTHS.map(n => `<button type="button" data-rd-width="${n}" class="${n === w ? 'on' : ''}" title="Line width ${n}px" aria-label="Line width ${n} pixels"><i style="height:${n}px"></i></button>`).join('')}</span>`}
      <button type="button" class="rd-bar-del" data-rd-delete title="Delete drawing (Del)" aria-label="Delete drawing"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg></button>`;
    if (el.dataset.sig !== `${d.id}|${col}|${w}`) { el.innerHTML = html; el.dataset.sig = `${d.id}|${col}|${w}`; }
    el.hidden = false;
  }

  // ---------------------------------------------------------------- rail button + menu
  function syncRail() {
    const rail = doc.querySelector('.terminal-drawing-rail'); if (!rail) return;
    let grp = rail.querySelector('.rd-railgrp');
    if (!grp) {
      grp = doc.createElement('div'); grp.className = 'rd-railgrp';
      grp.innerHTML = `<button type="button" class="terminal-tool rd-rail-main" data-rd-main></button><button type="button" class="rd-rail-more" data-rd-more aria-haspopup="menu" aria-label="All drawing tools" title="All drawing tools"><svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M2 1l4 3-4 3" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></button>`;
      const anchor = rail.querySelector('[data-action="draw"]');
      if (anchor) anchor.after(grp); else rail.prepend(grp);
    }
    const id = S.tool || prefs.last, main = grp.querySelector('[data-rd-main]');
    if (main.dataset.tool !== id) { main.dataset.tool = id; main.innerHTML = ico(id); }
    const label = `${TOOL[id].name} — ${S.tool ? 'drawing, click to stop' : 'click to draw'}`;
    main.title = label; main.setAttribute('aria-label', label); main.setAttribute('aria-pressed', String(!!S.tool));
    main.classList.toggle('selected', !!S.tool);
    grp.querySelector('[data-rd-more]').setAttribute('aria-expanded', String(S.open));
    const cursor = rail.querySelector('[data-action="terminal-cursor"]');
    if (cursor && S.tool) cursor.classList.remove('selected');
    if (S.open) paintMenu();
  }
  function paintMenu() {
    let m = doc.querySelector('.rd-fly');
    if (!m) { m = doc.createElement('div'); m.className = 'rd-fly'; m.setAttribute('role', 'menu'); m.setAttribute('aria-label', 'Drawing tools'); doc.body.appendChild(m); }
    const sections = [...new Set(TOOLS.map(t => t.section))];
    const html = sections.map(sec => `<div class="rd-sec">${sec.toUpperCase()}</div>${TOOLS.filter(t => t.section === sec).map(t => `
      <div class="rd-item${(S.tool || prefs.last) === t.id ? ' active' : ''}">
        <button type="button" class="rd-pick" role="menuitem" data-rd-tool="${t.id}">${ico(t.id)}<span>${t.name}</span>${t.key ? `<kbd>${t.key}</kbd>` : ''}</button>
        <button type="button" class="rd-q${S.help === t.id ? ' on' : ''}" data-rd-help="${t.id}" aria-label="How to draw: ${t.name}" aria-expanded="${S.help === t.id}">?</button>
        <button type="button" class="rd-star${prefs.favs.includes(t.id) ? ' on' : ''}" data-rd-fav="${t.id}" aria-pressed="${prefs.favs.includes(t.id)}" aria-label="${prefs.favs.includes(t.id) ? 'Remove from' : 'Add to'} favourites: ${t.name}">${STAR}</button>
      </div>${S.help === t.id ? `<p class="rd-help">${t.help}</p>` : ''}`).join('')}`).join('<div class="rd-div"></div>');
    if (m.dataset.sig !== html) { const top = m.scrollTop; m.innerHTML = html; m.dataset.sig = html; m.scrollTop = top; }
    const btn = doc.querySelector('.rd-railgrp');
    if (btn) {
      const r = btn.getBoundingClientRect(), vh = root.innerHeight;
      const top = Math.max(8, Math.min(r.top - 8, vh - Math.min(580, vh - 16)));   // move up so the list fits
      m.style.left = `${Math.round(r.right + 6)}px`; m.style.top = `${Math.round(top)}px`; m.style.maxHeight = `${Math.round(vh - top - 10)}px`;
    }
  }
  function openMenu(v) { S.open = v; if (v) paintMenu(); else { S.help = null; closeMenu(); } schedule(); }
  function closeMenu() { doc.querySelector('.rd-fly')?.remove(); S.open = false; }

  function setTool(id) {
    if (id && !TOOL[id]) return;
    S.draft = null; S.drag = null;
    S.tool = id || null;
    if (id) { prefs.last = id; savePrefs(); S.sel = null; }
    if (id && typeof drawMode !== 'undefined' && drawMode) { drawMode = false; if (typeof render === 'function') render(); }
    schedule();
  }

  // ---------------------------------------------------------------- editing
  function mutate(key, fn) { snapshot(key); fn(list(key)); persist(key); schedule(); }
  function finishDraft(c) {
    const d = S.draft; if (!d) return;
    S.draft = null;
    const t = TOOL[d.tool];
    let ok = t.kind === 'free' ? d.pts.length >= 2 : t.kind === 'multi' ? d.pts.length >= (t.min || 2) : d.pts.length === t.n;
    if (ok) {
      const st = styleOf(d.tool), item = { id: uid(), tool: d.tool, pts: d.pts, color: st.color, width: st.width };
      if (d.closed) item.closed = true;
      mutate(c.key, l => l.push(item));
      S.sel = item.id;
    }
    S.tool = null; schedule();
  }
  function startDraft(c, q, a) { S.draft = { tool: S.tool, key: c.key, pts: [a], px: [q], cursor: q, down: q }; }

  function onDown(e) {
    if (e.button !== 0 || !onChart()) return;
    const frame = e.target.closest?.('.chart-frame');
    if (!frame) return;
    if (e.target.closest('.rd-bar,.rd-favs')) { e.stopPropagation(); return; }   // their buttons get a normal click
    const c = ctx(); if (!c) return;
    const q = local(c, e);
    const hitId = e.target.closest('[data-dw]')?.dataset.dw;
    if (S.tool) {
      if (!inPlot(c, q)) return;                       // price axis keeps its scale drag
      e.stopPropagation(); e.preventDefault();
      const a = toAnchor(c, q.x, q.y), t = TOOL[S.tool];
      if (t.kind === 'mark') { S.draft = { tool: S.tool, key: c.key, pts: [a] }; finishDraft(c); return; }
      if (t.kind === 'free') { startDraft(c, q, a); S.drag = { free: true }; return; }
      if (!S.draft) { startDraft(c, q, a); S.drag = { pending: true }; schedule(); return; }
      const d = S.draft, lastPx = d.px[d.px.length - 1];
      if (t.kind === 'multi') {
        if (S.tool === 'polyline' && d.px.length >= 3 && dist(q, d.px[0]) <= 8) { d.closed = true; finishDraft(c); return; }
        if (dist(q, lastPx) < 3) return;               // second press of a double-click
        d.pts.push(a); d.px.push(q); schedule(); return;
      }
      if (dist(q, lastPx) < 3) return;
      d.pts.push(a); d.px.push(q);
      if (d.pts.length >= t.n) finishDraft(c); else schedule();
      return;
    }
    if (hitId) {
      e.stopPropagation(); e.preventDefault();
      S.sel = hitId;
      const d = list(c.key).find(x => x.id === hitId);
      const ptAttr = e.target.dataset.dwPt;
      S.drag = { id: hitId, key: c.key, pt: ptAttr == null ? null : Number(ptAttr), from: toAnchor(c, q.x, q.y), q, orig: JSON.parse(JSON.stringify(d.pts)), before: JSON.stringify(list(c.key)), moved: false };
      schedule();
      return;
    }
    if (S.sel) { S.sel = null; schedule(); }           // empty chart: deselect and let the chart pan
  }
  function onMove(e) {
    if (!onChart() || (!S.draft && !S.drag)) return;
    const c = ctx(); if (!c) return;
    const q = local(c, e);
    if (S.draft) {
      const t = TOOL[S.draft.tool];
      if (t.kind === 'free') {
        if (dist(q, S.draft.px[S.draft.px.length - 1]) >= 2) { S.draft.pts.push(toAnchor(c, q.x, q.y)); S.draft.px.push(q); }
      } else S.draft.cursor = { x: Math.max(0, Math.min(c.W, q.x)), y: Math.max(0, Math.min(c.H, q.y)) };
      schedule(); return;
    }
    const g = S.drag; if (!g || g.free || g.pending) return;
    if (!g.moved && dist(q, g.q) < 3) return;
    g.moved = true;
    const d = list(g.key).find(x => x.id === g.id); if (!d) return;
    const now = toAnchor(c, q.x, q.y), dk = c.map.tToK(now.t) - c.map.tToK(g.from.t), dp = now.p - g.from.p;
    const shift = a => ({ t: c.map.kToT(c.map.tToK(a.t) + dk), p: a.p + dp });
    d.pts = g.pt == null ? g.orig.map(shift) : g.orig.map((a, i) => i === g.pt ? now : a);
    schedule();
  }
  function onUp(e) {
    if (!onChart()) return;
    const g = S.drag; if (!g) return;
    S.drag = null;
    const c = ctx(); if (!c) return;
    e.stopPropagation();
    if (g.free) { if (S.draft) { const d = S.draft; d.pts = simplify(d.px, 1.5).map(q => toAnchor(c, q.x, q.y)); finishDraft(c); } return; }
    if (g.pending) {
      // press-drag-release on a two-point tool draws it in one gesture
      const d = S.draft, t = d && TOOL[d.tool], q = local(c, e);
      if (d && t.kind === 'n' && t.n === 2 && dist(q, d.px[0]) > 6) { d.pts.push(toAnchor(c, q.x, q.y)); d.px.push(q); finishDraft(c); }
      return;
    }
    if (g.moved) { S.undo.push({ key: g.key, json: g.before }); if (S.undo.length > MAX_UNDO) S.undo.shift(); persist(g.key); }
    schedule();
  }
  function onDbl(e) {
    if (!onChart() || !e.target.closest?.('.chart-frame')) return;
    if (!S.tool && !e.target.closest('[data-dw],.rd-bar,.rd-favs')) return;
    e.stopPropagation(); e.preventDefault();          // no "add price level" while drawing
    const c = ctx();
    if (c && S.draft && TOOL[S.draft.tool].kind === 'multi') finishDraft(c);
  }
  function removeSelected() {
    const c = ctx(); if (!c || !S.sel) return false;
    const id = S.sel; S.sel = null;
    mutate(c.key, l => { const i = l.findIndex(d => d.id === id); if (i >= 0) l.splice(i, 1); });
    return true;
  }
  function undo() {
    const u = S.undo.pop(); if (!u) return false;
    const arr = JSON.parse(u.json);
    if (arr.length) store[u.key] = arr; else delete store[u.key];
    write(STORE_KEY, store); S.sel = null; schedule(); return true;
  }

  function onKey(e) {
    if (!onChart()) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable || doc.querySelector('#modal[open]')) return;
    let done = false;
    if (e.altKey && e.shiftKey && !e.ctrlKey && e.code === 'KeyR') { setTool('rect'); done = true; }
    else if (e.key === 'Escape') {
      if (S.open) { openMenu(false); done = true; }
      else if (S.draft) { S.draft = null; S.drag = null; schedule(); done = true; }
      else if (S.tool) { setTool(null); done = true; }
      else if (S.sel) { S.sel = null; schedule(); done = true; }
    } else if (e.key === 'Enter' && S.draft && TOOL[S.draft.tool].kind === 'multi') { const c = ctx(); if (c) finishDraft(c); done = true; }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) done = removeSelected();
    else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') done = undo();
    if (done) { e.preventDefault(); e.stopPropagation(); }
  }

  function onClick(e) {
    const el = e.target.closest?.('[data-rd-main],[data-rd-more],[data-rd-tool],[data-rd-help],[data-rd-fav],[data-rd-color],[data-rd-width],[data-rd-delete]');
    if (!el) {
      if (S.open && !e.target.closest?.('.rd-fly')) openMenu(false);
      return;
    }
    e.preventDefault(); e.stopPropagation();
    const ds = el.dataset;
    if ('rdMain' in ds) { setTool(S.tool ? null : prefs.last); return; }
    if ('rdMore' in ds) { openMenu(!S.open); return; }
    if (ds.rdTool) { const fromMenu = !!el.closest('.rd-fly'); setTool(S.tool === ds.rdTool && !fromMenu ? null : ds.rdTool); if (fromMenu) openMenu(false); return; }
    if (ds.rdHelp) { S.help = S.help === ds.rdHelp ? null : ds.rdHelp; schedule(); return; }
    if (ds.rdFav) { const i = prefs.favs.indexOf(ds.rdFav); if (i >= 0) prefs.favs.splice(i, 1); else prefs.favs.push(ds.rdFav); savePrefs(); schedule(); return; }
    const c = ctx(); if (!c || !S.sel) return;
    const d = list(c.key).find(x => x.id === S.sel); if (!d) return;
    if (ds.rdColor || ds.rdWidth) {
      const v = ds.rdColor ? { color: ds.rdColor } : { width: Number(ds.rdWidth) };
      mutate(c.key, () => Object.assign(d, v));
      prefs.styles[d.tool] = Object.assign({}, prefs.styles[d.tool], v); savePrefs();   // next drawing of this tool uses it too
      return;
    }
    if ('rdDelete' in ds) removeSelected();
  }

  // Window capture runs before chart-interact.js's document capture handlers, so a press that
  // draws or edits a drawing never also pans the chart or opens the "add price level" dialog.
  root.addEventListener('pointerdown', onDown, true);
  root.addEventListener('pointermove', onMove, true);
  root.addEventListener('pointerup', onUp, true);
  root.addEventListener('pointercancel', () => { S.drag = null; if (S.draft && TOOL[S.draft.tool].kind === 'free') S.draft = null; schedule(); }, true);
  root.addEventListener('dblclick', onDbl, true);
  root.addEventListener('keydown', onKey, true);
  root.addEventListener('click', onClick, true);
  root.addEventListener('resize', schedule);
  root.addEventListener('hashchange', () => { if (!onChart()) { S.tool = null; S.draft = null; S.sel = null; closeMenu(); } schedule(); });

  // Redraw whenever the page or the price svg is rebuilt (render(), pan/zoom, live ticks).
  const watch = new MutationObserver(recs => {
    for (const r of recs) {
      const t = r.target;
      if (t.closest?.('.rd-layer,.rd-fly')) continue;
      if (t.id === 'app' || t.classList?.contains('chart-frame') || [...r.addedNodes].some(n => n.nodeType === 1 && (n.matches?.('.chart-frame,.shell,main,svg') || n.querySelector?.('.chart-frame')))) { schedule(); return; }
    }
  });
  const app = doc.getElementById('app');
  if (app) watch.observe(app, { childList: true, subtree: true });
  if (root.ResizeObserver) { const ro = new ResizeObserver(schedule); const hook = () => { const f = frameEl(); if (f && !f.dataset.rdRo) { f.dataset.rdRo = '1'; ro.observe(f); } }; root.setInterval(hook, 1000); }

  // Existing chart actions: the level tool / cursor stop drawing; the trash also clears drawings.
  if (typeof action === 'function') {
    const before = action;
    action = function (value) {
      if (value === 'draw' || value === 'terminal-cursor') { S.tool = null; S.draft = null; }
      if (value === 'clear-draw') {
        const c = ctx(), n = c ? (store[c.key] || []).length : 0;
        if (n && typeof confirmDialog === 'function') {
          const levels = (typeof chartPrefs !== 'undefined' ? chartPrefs.levels : []).filter(l => l.symbol === symbol);
          confirmDialog(`Clear ${symbol} drawings?`, `This removes ${n} drawing${n === 1 ? '' : 's'}${levels.length ? ` and ${levels.length} price level${levels.length === 1 ? '' : 's'}` : ''} for this symbol. Ctrl+Z brings the drawings back.`, () => {
            snapshot(c.key); delete store[c.key]; write(STORE_KEY, store); S.sel = null;
            if (levels.length) { chartPrefs.levels = chartPrefs.levels.filter(l => l.symbol !== symbol); saveChart(); }
            if (typeof render === 'function') render();
            if (typeof toast === 'function') toast('Drawings cleared.');
          });
          return;
        }
      }
      return before.apply(this, arguments);
    };
  }
  // Drawing manager lists the drawings next to the price levels.
  if (typeof levelsModal === 'function') {
    const baseLevels = levelsModal;
    levelsModal = function () {
      const out = baseLevels.apply(this, arguments);
      const c = ctx(), items = c ? store[c.key] || [] : [], body = doc.querySelector('#modal .modal-body') || doc.querySelector('#modal');
      if (body && items.length) {
        body.insertAdjacentHTML('beforeend', `<div class="rd-manager"><div class="rd-sec">DRAWINGS · ${items.length}</div>${items.map(d => `<div class="drawing-row"><span style="color:${d.color || TOOL[d.tool].color}">${ico(d.tool, 18)}</span><div><strong>${TOOL[d.tool]?.name || d.tool}</strong><small>${d.pts.length} point${d.pts.length === 1 ? '' : 's'}</small></div><button class="btn small" type="button" data-rd-mdel="${d.id}">Delete</button></div>`).join('')}</div>`);
        body.querySelectorAll('[data-rd-mdel]').forEach(b => b.onclick = () => { const id = b.dataset.rdMdel; mutate(c.key, l => { const i = l.findIndex(x => x.id === id); if (i >= 0) l.splice(i, 1); }); b.closest('.drawing-row').remove(); });
      }
      return out;
    };
  }

  root.redlineDrawings = { tools: TOOLS, setTool, get state() { return { tool: S.tool, selected: S.sel, drafting: !!S.draft }; }, list: () => { const c = ctx(); return c ? JSON.parse(JSON.stringify(store[c.key] || [])) : []; }, undo, redraw: schedule };
  schedule();
})(typeof window !== 'undefined' ? window : null);
