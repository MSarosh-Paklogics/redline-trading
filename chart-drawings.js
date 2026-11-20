'use strict';
/* Chart drawing tools for the chart terminal (#/chart), TradingView-style. Two rail groups:
   - Lines: Trendline, Ray, Info line, Extended line, Trend angle, Horizontal line, Horizontal ray,
     Vertical line, Crossline · Channels: Parallel channel, Regression trend, Flat top/bottom,
     Disjoint channel · Pitchforks: Pitchfork, Schiff, Modified Schiff, Inside pitchfork.
   - Brushes (Brush, Highlighter) · Arrows (Arrow marker, Arrow, Arrow mark up/down) · Shapes
     (Rectangle, Rotated rectangle, Path, Circle, Ellipse, Polyline, Triangle, Arc, Curve, Double curve).

   - Every point is anchored to bar time + price, so drawings stay on the same candles and prices
     when the chart is panned, zoomed, rescaled, redrawn by the live feed or switched to another
     timeframe. Live bars carry a timestamp; demo bars (no timestamp) fall back to bar index and
     their drawings are kept per symbol + timeframe.
   - Drawn on an overlay layer inside .chart-frame (never a direct child <svg>, so live-stream.js /
     chart-interact.js keep redrawing only the price svg).
   - Selecting a drawing opens a floating toolbar (draggable by its grip): line colour, text, fill,
     width, line style, settings, alert, lock, delete and a ⋯ menu with visual order, visibility on
     intervals, clone, copy and hide. Keys: Esc, Delete, Enter (finish path/polyline), Ctrl+Z,
     Ctrl+C / Ctrl+V, Ctrl+drag to clone, Alt+T/H/J/V/C/R for trendline / horizontal line /
     horizontal ray / vertical line / crossline / rectangle.
   - Saved in this browser only (localStorage), like the price levels. Purely visual: nothing is
     sent to the backend and no engine value is read or changed. The alert button opens the
     existing local demo alert dialog. Regression trend is a least-squares fit on the visible bars'
     closes, like the other client-side studies.
   The geometry helpers at the top are pure and unit-tested in tests/chart-drawings.test.cjs. */
(function (root) {
  // ------------------------------------------------------------------ pure helpers
  const L = '#4da3ff';
  const TOOLS = [
    // Lines group
    { id: 'trendline', group: 'lines', section: 'Lines', name: 'Trendline', kind: 'n', n: 2, line: true, color: L, width: 2, key: 'Alt + T', help: 'Drag, or click the start and the end. Extend it left or right in Settings.' },
    { id: 'ray', group: 'lines', section: 'Lines', name: 'Ray', kind: 'n', n: 2, line: true, ext: { r: true }, color: L, width: 2, help: 'Click the start, then a point the ray passes through. It runs on to the edge of the chart.' },
    { id: 'infoLine', group: 'lines', section: 'Lines', name: 'Info line', kind: 'n', n: 2, line: true, color: L, width: 2, help: 'Drag, or click two points. Shows price change, %, bars, time and angle between them.' },
    { id: 'extendedLine', group: 'lines', section: 'Lines', name: 'Extended line', kind: 'n', n: 2, line: true, ext: { l: true, r: true }, color: L, width: 2, help: 'Click two points. The line extends across the whole chart in both directions.' },
    { id: 'trendAngle', group: 'lines', section: 'Lines', name: 'Trend angle', kind: 'n', n: 2, line: true, color: L, width: 2, help: 'Drag, or click two points. Shows the on-screen angle of the move.' },
    { id: 'hline', group: 'lines', section: 'Lines', name: 'Horizontal line', kind: 'mark', n: 1, color: L, width: 2, key: 'Alt + H', help: 'Click a price. The line spans the whole chart and its price shows on the axis.' },
    { id: 'hray', group: 'lines', section: 'Lines', name: 'Horizontal ray', kind: 'mark', n: 1, color: L, width: 2, key: 'Alt + J', help: 'Click a bar and price. The ray runs right from there to the edge of the chart.' },
    { id: 'vline', group: 'lines', section: 'Lines', name: 'Vertical line', kind: 'mark', n: 1, color: L, width: 2, key: 'Alt + V', help: 'Click a bar. The line spans the full height and its time shows on the axis.' },
    { id: 'crossline', group: 'lines', section: 'Lines', name: 'Crossline', kind: 'mark', n: 1, color: L, width: 1, key: 'Alt + C', help: 'Click a bar and price. Draws a horizontal and a vertical line through it.' },
    { id: 'parallelChannel', group: 'lines', section: 'Channels', name: 'Parallel channel', kind: 'n', n: 3, fill: true, color: L, width: 2, help: 'Click two points for the first line, then a third point for the parallel line.' },
    { id: 'regression', group: 'lines', section: 'Channels', name: 'Regression trend', kind: 'n', n: 2, fill: true, color: L, width: 2, help: 'Drag, or click the first and last bar. Fits a least-squares line to the closes, with ±2 standard-deviation bands.' },
    { id: 'flatTopBottom', group: 'lines', section: 'Channels', name: 'Flat top/bottom', kind: 'n', n: 3, fill: true, color: L, width: 2, help: 'Click two points for the sloping line, then a third point for the flat level.' },
    { id: 'disjointChannel', group: 'lines', section: 'Channels', name: 'Disjoint channel', kind: 'n', n: 3, fill: true, color: L, width: 2, help: 'Click two points for the first line, then a third point; the second line mirrors the first slope (widening / narrowing channel).' },
    { id: 'pitchfork', group: 'lines', section: 'Pitchforks', name: 'Pitchfork', kind: 'n', n: 3, fill: true, color: '#ff4d4d', width: 2, help: 'Click the pivot, then the two reaction points. The median runs from the pivot through the middle of the other two.' },
    { id: 'schiff', group: 'lines', section: 'Pitchforks', name: 'Schiff pitchfork', kind: 'n', n: 3, fill: true, color: '#ff4d4d', width: 2, help: 'Like the pitchfork, but the median starts halfway in price between the pivot and the first reaction point.' },
    { id: 'modSchiff', group: 'lines', section: 'Pitchforks', name: 'Modified Schiff pitchfork', kind: 'n', n: 3, fill: true, color: '#ff4d4d', width: 2, help: 'Like the pitchfork, but the median starts at the midpoint (time and price) of the pivot and the first reaction point.' },
    { id: 'insidePitchfork', group: 'lines', section: 'Pitchforks', name: 'Inside pitchfork', kind: 'n', n: 3, fill: true, color: '#ff4d4d', width: 2, help: 'Pitchfork with the two tines drawn halfway between the median and the reaction points (a tighter fork).' },
    // Fibonacci and Gann group
    { id: 'fibRetracement', group: 'fib', section: 'Fibonacci', name: 'Fib retracement', kind: 'n', n: 2, levels: true, fill: true, line: true, color: '#787b86', width: 1, key: 'Alt + F', help: 'Drag from the start of the move to its end (or click both). Levels 0–2.618 with prices; extend right in Settings.' },
    { id: 'trendFibExtension', group: 'fib', section: 'Fibonacci', name: 'Trend-based fib extension', kind: 'n', n: 3, levels: true, fill: true, line: true, color: '#787b86', width: 1, help: 'Click the start and end of the move, then the pullback point. Projects the move from the pullback.' },
    { id: 'fibChannel', group: 'fib', section: 'Fibonacci', name: 'Fib channel', kind: 'n', n: 3, levels: true, fill: true, line: true, color: '#787b86', width: 1, help: 'Click two points for the base line, then a third point for the channel width; fib levels run parallel.' },
    { id: 'fibTimeZone', group: 'fib', section: 'Fibonacci', name: 'Fib time zone', kind: 'n', n: 2, levels: true, color: '#787b86', width: 1, help: 'Click the start bar, then the bar that sets one unit. Vertical lines at 0, 1, 2, 3, 5, 8, 13, 21… units.' },
    { id: 'fibSpeedFan', group: 'fib', section: 'Fibonacci', name: 'Fib speed resistance fan', kind: 'n', n: 2, levels: true, color: '#787b86', width: 1, help: 'Drag from the start of the move to its end. Fan lines through the fib price and time levels.' },
    { id: 'trendFibTime', group: 'fib', section: 'Fibonacci', name: 'Trend-based fib time', kind: 'n', n: 3, levels: true, color: '#787b86', width: 1, help: 'Click the start and end of the move, then the pullback. Vertical lines at fib multiples of the move’s length in time.' },
    { id: 'fibCircles', group: 'fib', section: 'Fibonacci', name: 'Fib circles', kind: 'n', n: 2, levels: true, color: '#787b86', width: 1, help: 'Drag across the move. Circles around its midpoint; level 1 passes through both points.' },
    { id: 'fibSpiral', group: 'fib', section: 'Fibonacci', name: 'Fib spiral', kind: 'n', n: 2, color: '#ff9800', width: 2, help: 'Click the centre, then the start point. A golden spiral growing by 1.618 every quarter turn.' },
    { id: 'fibSpeedArcs', group: 'fib', section: 'Fibonacci', name: 'Fib speed resistance arcs', kind: 'n', n: 2, levels: true, color: '#787b86', width: 1, help: 'Drag from the start of the move to its end. Half circles around the start at fib fractions of the move.' },
    { id: 'fibWedge', group: 'fib', section: 'Fibonacci', name: 'Fib wedge', kind: 'n', n: 3, levels: true, fill: true, color: '#787b86', width: 1, help: 'Click the apex, then one edge, then the other edge. Fib arcs between the two edges.' },
    { id: 'pitchfan', group: 'fib', section: 'Fibonacci', name: 'Pitchfan', kind: 'n', n: 3, levels: true, color: '#787b86', width: 1, help: 'Click the pivot, then the two reaction points. Fan lines from the pivot through fib points between them.' },
    { id: 'gannBox', group: 'fib', section: 'Gann', name: 'Gann box', kind: 'n', n: 2, levels: true, fill: true, color: '#787b86', width: 1, help: 'Drag across the range. Price and time grid at 0, .25, .382, .5, .618, .75 and 1.' },
    { id: 'gannSquareFixed', group: 'fib', section: 'Gann', name: 'Gann square fixed', kind: 'n', n: 2, levels: true, color: '#787b86', width: 1, help: 'Drag from a corner. The box stays square on screen, with grid, diagonals and fan lines.' },
    { id: 'gannSquare', group: 'fib', section: 'Gann', name: 'Gann square', kind: 'n', n: 2, levels: true, color: '#787b86', width: 1, help: 'Drag from one corner to the opposite corner. Grid, diagonals and fan lines inside the box.' },
    { id: 'gannFan', group: 'fib', section: 'Gann', name: 'Gann fan', kind: 'n', n: 2, levels: true, color: '#787b86', width: 1, help: 'Drag from the pivot; the second point sets the 1x1 line. Fan lines 1x8 … 8x1.' },
    // Brushes, arrows and shapes group
    { id: 'brush', group: 'draw', section: 'Brushes', name: 'Brush', kind: 'free', color: L, width: 2, help: 'Press and drag to draw freehand. Release to finish.' },
    { id: 'highlighter', group: 'draw', section: 'Brushes', name: 'Highlighter', kind: 'free', color: '#ffeb3b', width: 14, alpha: 0.38, help: 'Press and drag to highlight an area. Release to finish.' },
    { id: 'arrowMarker', group: 'draw', section: 'Arrows', name: 'Arrow marker', kind: 'n', n: 2, color: L, width: 2, help: 'Drag from the tail to the tip, or click the tail then the tip.' },
    { id: 'arrow', group: 'draw', section: 'Arrows', name: 'Arrow', kind: 'n', n: 2, color: L, width: 2, help: 'Drag from the start to the tip, or click the start then the tip.' },
    { id: 'arrowUp', group: 'draw', section: 'Arrows', name: 'Arrow mark up', kind: 'mark', n: 1, color: '#2fe07f', width: 2, help: 'Click the price the up arrow should point to.' },
    { id: 'arrowDown', group: 'draw', section: 'Arrows', name: 'Arrow mark down', kind: 'mark', n: 1, color: '#ff4d4d', width: 2, help: 'Click the price the down arrow should point to.' },
    { id: 'rect', group: 'draw', section: 'Shapes', name: 'Rectangle', kind: 'n', n: 2, fill: true, color: '#ff9800', width: 2, key: 'Alt + Shift + R', help: 'Drag, or click two opposite corners. Shortcut Alt + Shift + R.' },
    { id: 'rotRect', group: 'draw', section: 'Shapes', name: 'Rotated rectangle', kind: 'n', n: 3, fill: true, color: '#ff9800', width: 2, help: 'Click two points for one side, then a third point to set the width.' },
    { id: 'path', group: 'draw', section: 'Shapes', name: 'Path', kind: 'multi', min: 2, color: L, width: 2, help: 'Click each point. Double-click or press Enter to finish, Esc to cancel.' },
    { id: 'circle', group: 'draw', section: 'Shapes', name: 'Circle', kind: 'n', n: 2, fill: true, color: '#b388ff', width: 2, help: 'Click the centre, then a point on the edge (or drag from the centre).' },
    { id: 'ellipse', group: 'draw', section: 'Shapes', name: 'Ellipse', kind: 'n', n: 2, fill: true, color: '#b388ff', width: 2, help: 'Drag, or click two opposite corners of the box the ellipse fits in.' },
    { id: 'polyline', group: 'draw', section: 'Shapes', name: 'Polyline', kind: 'multi', min: 2, fill: true, color: '#2fe07f', width: 2, help: 'Click each corner. Click the first point again to close the shape, or double-click / Enter to finish open.' },
    { id: 'triangle', group: 'draw', section: 'Shapes', name: 'Triangle', kind: 'n', n: 3, fill: true, color: '#2fe07f', width: 2, help: 'Click the three corners.' },
    { id: 'arc', group: 'draw', section: 'Shapes', name: 'Arc', kind: 'n', n: 3, fill: true, color: '#ff9800', width: 2, help: 'Click the start, the end, then the point the arc bends through.' },
    { id: 'curve', group: 'draw', section: 'Shapes', name: 'Curve', kind: 'n', n: 3, color: L, width: 2, help: 'Click the start, the end, then the point the curve bends through.' },
    { id: 'doubleCurve', group: 'draw', section: 'Shapes', name: 'Double curve', kind: 'n', n: 3, color: L, width: 2, help: 'Click the start, the end, then where the first bend peaks; the second bend mirrors it.' }
  ];
  const TOOL = Object.fromEntries(TOOLS.map(t => [t.id, t]));
  const GROUPS = [{ id: 'lines', name: 'Lines, channels and pitchforks', first: 'trendline' }, { id: 'fib', name: 'Fibonacci and Gann', first: 'fibRetracement' }, { id: 'draw', name: 'Brushes, arrows and shapes', first: 'brush' }];
  const HOTKEYS = { KeyT: 'trendline', KeyH: 'hline', KeyJ: 'hray', KeyV: 'vline', KeyC: 'crossline', KeyF: 'fibRetracement' };
  // Fibonacci / Gann levels and their default colours (TradingView palette, cycled for longer lists).
  const FIB = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618];
  const FIB_TIME = [0, 0.382, 0.5, 0.618, 1, 1.382, 1.618, 2, 2.382, 2.618, 3];
  const FIB_NUMBERS = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];
  const FAN = [0.25, 0.382, 0.5, 0.618, 0.75];
  const ARC = [0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const CIRCLE = [0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618];
  const PITCHFAN = [0, 0.25, 0.382, 0.5, 0.618, 0.75, 1];
  const GANN = [0, 0.25, 0.382, 0.5, 0.618, 0.75, 1];
  const GANN_FAN = [[1, 8], [1, 4], [1, 3], [1, 2], [1, 1], [2, 1], [3, 1], [4, 1], [8, 1]];
  const PALETTE = ['#787b86', '#f23645', '#ff9800', '#4caf50', '#089981', '#00bcd4', '#787b86', '#2962ff', '#f23645', '#9c27b0', '#e91e63', '#ff9800'];
  const lc = i => PALETTE[i % PALETTE.length];
  const PHI = (1 + Math.sqrt(5)) / 2;
  const SWATCHES = ['#ed1c24', '#ff9800', '#ffeb3b', '#2fe07f', '#4da3ff', '#b388ff', '#ffffff', '#9aa7bc'];
  const WIDTHS = [1, 2, 3, 4];
  const DASHES = { solid: '', dashed: 'dashed', dotted: 'dotted' };
  const TFS = ['1m', '5m', '10m', '15m', '1h', '4h', '1D'];

  const r1 = v => Math.round(v * 10) / 10;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const add = (a, v) => ({ x: a.x + v.x, y: a.y + v.y });
  const pts = list => list.map(p => `${r1(p.x)},${r1(p.y)}`).join(' ');
  const seg = (a, b) => ({ x1: r1(a.x), y1: r1(a.y), x2: r1(b.x), y2: r1(b.y) });

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
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m] <= t) lo = m; else hi = m; }
      return lo + (t - T[lo]) / step(lo, hi);
    }
    return { kToT, tToK };
  }

  // Where the ray from a through b leaves the box (never short of b).
  function extend(a, b, box) {
    const ux = b.x - a.x, uy = b.y - a.y;
    if (Math.abs(ux) < 1e-9 && Math.abs(uy) < 1e-9) return { x: b.x, y: b.y };
    const tx = ux > 0 ? (box.x1 - a.x) / ux : ux < 0 ? (box.x0 - a.x) / ux : Infinity;
    const ty = uy > 0 ? (box.y1 - a.y) / uy : uy < 0 ? (box.y0 - a.y) / uy : Infinity;
    const t = Math.max(1, Math.min(tx, ty));
    return Number.isFinite(t) ? { x: a.x + ux * t, y: a.y + uy * t } : { x: b.x, y: b.y };
  }
  const lineEnds = (a, b, box, ext = {}) => [ext.l ? extend(b, a, box) : a, ext.r ? extend(a, b, box) : b];

  // Least-squares fit over y[0..n-1]; sd is the standard deviation of the residuals.
  function regression(ys) {
    const n = ys.length; if (n < 2) return null;
    const mx = (n - 1) / 2, my = ys.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0;
    ys.forEach((y, x) => { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; });
    const slope = sxx ? sxy / sxx : 0, intercept = my - slope * mx;
    const sd = Math.sqrt(ys.reduce((a, y, x) => a + (y - (intercept + slope * x)) ** 2, 0) / n);
    return { slope, intercept, sd };
  }
  // Second line of a parallel channel through c (same slope as a→b, shifted vertically).
  function parallel(a, b, c) {
    if (Math.abs(b.x - a.x) < 1e-9) { const dx = c.x - a.x; return [{ x: a.x + dx, y: a.y }, { x: b.x + dx, y: b.y }]; }
    const dy = c.y - (a.y + (c.x - a.x) * (b.y - a.y) / (b.x - a.x));
    return [{ x: a.x, y: a.y + dy }, { x: b.x, y: b.y + dy }];
  }
  // Pitchfork lines for pivot a and reaction points b, c.
  function pitchfork(kind, a, b, c, box) {
    const o = kind === 'schiff' ? { x: a.x, y: (a.y + b.y) / 2 } : kind === 'modSchiff' ? mid(a, b) : a;
    const m = mid(b, c);
    let dir = { x: m.x - o.x, y: m.y - o.y };
    if (Math.hypot(dir.x, dir.y) < 1e-9) dir = { x: 1, y: 0 };
    const tb = kind === 'insidePitchfork' ? mid(b, m) : b, tc = kind === 'insidePitchfork' ? mid(c, m) : c;
    const tine = q => [q, extend(q, add(q, dir), box)];
    const median = [o, extend(o, add(o, dir), box)], t1 = tine(tb), t2 = tine(tc);
    return { origin: o, median, t1, t2, base: [b, c], fill: [t1[0], t1[1], t2[1], t2[0]] };
  }
  // On-screen angle of a→b in degrees, counter-clockwise from the right (screen y points down).
  const angleDeg = (a, b) => Math.atan2(-(b.y - a.y), b.x - a.x) * 180 / Math.PI;

  // Price of a retracement level: 0 at the end point b, 1 at the start a.
  const fibPrice = (a, b, lvl) => b + (a - b) * lvl;
  // Price of a trend-based extension level, projected from the pullback c.
  const fibExtPrice = (a, b, c, lvl) => c + (b - a) * lvl;
  // Fib time zone x positions (unit = one step), only those inside [x0, x1].
  const timeZones = (x, unit, x0, x1) => Math.abs(unit) < 1e-9 ? [] : FIB_NUMBERS.map(n => ({ n, x: x + unit * n })).filter(z => z.x >= x0 - 0.5 && z.x <= x1 + 0.5);
  // Golden spiral around c through b: radius grows by φ every quarter turn.
  function spiral(c, b, maxR) {
    const r0 = dist(c, b); if (r0 < 1e-6) return [];
    const th0 = Math.atan2(b.y - c.y, b.x - c.x), k = Math.log(PHI) / (Math.PI / 2), out = [];
    for (let i = -96; i <= 240; i++) {
      const th = th0 + i * Math.PI / 24, r = r0 * Math.exp(k * (th - th0));
      if (r < 0.5) continue;
      out.push({ x: c.x + r * Math.cos(th), y: c.y + r * Math.sin(th) });
      if (r > maxR) break;
    }
    return out;
  }
  // Opposite corner of a square from a toward b (side = the longer of |dx|, |dy|).
  function gannSquareCorner(a, b) { const s = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)); return { x: a.x + (b.x >= a.x ? s : -s), y: a.y + (b.y >= a.y ? s : -s) }; }
  // Gann fan direction for price:time = p:t, scaled from the 1x1 vector (dx, dy).
  const gannDir = (dx, dy, p, t) => ({ x: dx, y: dy * p / t });

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
  const box2 = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
  // Drop freehand points closer than minDist to the previous kept point (keeps the last one).
  function simplify(list, minDist) {
    if (list.length < 3) return list.slice();
    const out = [list[0]];
    for (let i = 1; i < list.length - 1; i++) if (dist(list[i], out[out.length - 1]) >= minDist) out.push(list[i]);
    out.push(list[list.length - 1]);
    return out;
  }
  // Visibility on intervals: 'all' | 'above' | 'below' | 'only', relative to the timeframe it was set on.
  function visibleOn(vis, tfNow) {
    if (!vis || vis.mode === 'all' || !vis.tf) return true;
    const a = TFS.indexOf(tfNow), b = TFS.indexOf(vis.tf);
    if (a < 0 || b < 0) return true;
    return vis.mode === 'above' ? a >= b : vis.mode === 'below' ? a <= b : a === b;
  }
  // Visual order: the list order is the paint order (last = front).
  function reorder(list, id, how) {
    const out = list.slice(), i = out.findIndex(d => d.id === id);
    if (i < 0) return out;
    const [d] = out.splice(i, 1);
    const j = how === 'front' ? out.length : how === 'back' ? 0 : how === 'forward' ? Math.min(out.length, i + 1) : Math.max(0, i - 1);
    out.splice(j, 0, d);
    return out;
  }

  // Geometry of one drawing in pixels: a list of [tag, attrs, paint, text?]. Paint is
  // 'stroke' (outline), 'fill' (solid), 'both' (translucent fill + outline), 'area' (fill only),
  // 'guide' (thin dashed), 'label' (text in the line colour), 'axis' / 'axistext' (price/time tag on
  // the axis, drawn outside the plot clip), 'info' / 'infotext' (info box).
  function geometry(tool, P, opt = {}) {
    const t = TOOL[tool]; if (!t || !P.length) return [];
    const box = opt.box || { x0: -1e4, y0: -1e4, x1: 1e4, y1: 1e4 };
    const line = list => ['polyline', { points: pts(list) }, 'stroke'];
    const w = opt.width || t.width || 2;
    if (P.length === 1 && t.kind !== 'mark' && t.kind !== 'free') return [['circle', { cx: r1(P[0].x), cy: r1(P[0].y), r: 2.5 }, 'fill']];
    const ext = opt.ext || t.ext || {};
    switch (tool) {
      case 'brush': case 'highlighter': return [line(P)];
      case 'trendline': case 'ray': case 'extendedLine': { const [a, b] = lineEnds(P[0], P[1], box, ext); return [['line', seg(a, b), 'stroke']]; }
      case 'infoLine': {
        const [a, b] = lineEnds(P[0], P[1], box, ext), out = [['line', seg(a, b), 'stroke']], rows = opt.info || [];
        if (rows.length) {
          const bw = 8 + 6.4 * Math.max(...rows.map(s => s.length)), bh = 8 + rows.length * 15;
          const x = Math.min(Math.max(P[1].x + 10, box.x0 + 2), box.x1 - bw - 2), y = Math.min(Math.max(P[1].y - bh / 2, box.y0 + 2), box.y1 - bh - 2);
          out.push(['rect', { x: r1(x), y: r1(y), width: r1(bw), height: bh, rx: 4 }, 'info']);
          rows.forEach((s, i) => out.push(['text', { x: r1(x + 6), y: r1(y + 16 + i * 15) }, 'infotext', s]));
        }
        return out;
      }
      case 'trendAngle': {
        const [a, b] = lineEnds(P[0], P[1], box, ext), deg = angleDeg(P[0], P[1]), r = 34, rad = -deg * Math.PI / 180;
        const end = { x: P[0].x + r * Math.cos(rad), y: P[0].y + r * Math.sin(rad) };
        return [['line', seg(a, b), 'stroke'], ['line', seg(P[0], { x: P[0].x + Math.max(60, dist(P[0], P[1]) * 0.6), y: P[0].y }), 'guide'],
          ['path', { d: `M${r1(P[0].x + r)} ${r1(P[0].y)} A${r} ${r} 0 0 ${deg > 0 ? 0 : 1} ${r1(end.x)} ${r1(end.y)}` }, 'guide'],
          ['text', { x: r1(P[0].x + r + 8), y: r1(P[0].y + (deg > 0 ? -6 : 14)) }, 'label', `${deg.toFixed(1)}°`]];
      }
      case 'hline': case 'hray': case 'crossline': case 'vline': {
        const { x, y } = P[0], out = [];
        if (tool !== 'vline') out.push(['line', seg({ x: tool === 'hray' ? x : box.x0, y }, { x: box.x1, y }), 'stroke']);
        if (tool === 'vline' || tool === 'crossline') out.push(['line', seg({ x, y: box.y0 }, { x, y: box.y1 }), 'stroke']);
        if (tool === 'hray') out.push(['circle', { cx: r1(x), cy: r1(y), r: 2.5 }, 'fill']);
        if (opt.priceText && tool !== 'vline') out.push(['rect', { x: r1(box.x1 + 2), y: r1(y - 8), width: 62, height: 16, rx: 3 }, 'axis'], ['text', { x: r1(box.x1 + 7), y: r1(y + 4) }, 'axistext', opt.priceText]);
        if (opt.timeText && tool !== 'hline' && tool !== 'hray') out.push(['rect', { x: r1(x - 46), y: r1(box.y1 + 2), width: 92, height: 16, rx: 3 }, 'axis'], ['text', { x: r1(x), y: r1(box.y1 + 14), 'text-anchor': 'middle' }, 'axistext', opt.timeText]);
        return out;
      }
      case 'parallelChannel': {
        if (P.length < 3) return [line(P)];
        const [a2, b2] = parallel(P[0], P[1], P[2]), m1 = mid(P[0], a2), m2 = mid(P[1], b2);
        return [['polygon', { points: pts([P[0], P[1], b2, a2]) }, 'area'], ['line', seg(P[0], P[1]), 'stroke'], ['line', seg(a2, b2), 'stroke'], ['line', seg(m1, m2), 'guide']];
      }
      case 'regression': {
        const g = opt.reg;
        if (!g) return [['line', seg(P[0], P[1]), 'guide']];
        return [['polygon', { points: pts([g.u[0], g.u[1], g.l[1], g.l[0]]) }, 'area'], ['line', seg(g.c[0], g.c[1]), 'stroke'], ['line', seg(g.u[0], g.u[1]), 'stroke'], ['line', seg(g.l[0], g.l[1]), 'stroke']];
      }
      case 'flatTopBottom': {
        if (P.length < 3) return [line(P)];
        const f1 = { x: P[0].x, y: P[2].y }, f2 = { x: P[1].x, y: P[2].y };
        return [['polygon', { points: pts([P[0], P[1], f2, f1]) }, 'area'], ['line', seg(P[0], P[1]), 'stroke'], ['line', seg(f1, f2), 'stroke']];
      }
      case 'disjointChannel': {
        if (P.length < 3) return [line(P)];
        const d1 = { x: P[0].x, y: P[2].y }, d2 = { x: P[1].x, y: P[2].y - (P[1].y - P[0].y) };
        return [['polygon', { points: pts([P[0], P[1], d2, d1]) }, 'area'], ['line', seg(P[0], P[1]), 'stroke'], ['line', seg(d1, d2), 'stroke']];
      }
      case 'pitchfork': case 'schiff': case 'modSchiff': case 'insidePitchfork': {
        if (P.length < 3) return [line(P)];
        const f = pitchfork(tool, P[0], P[1], P[2], box), out = [['polygon', { points: pts(f.fill) }, 'area'], ['line', seg(...f.median), 'stroke'], ['line', seg(...f.t1), 'stroke'], ['line', seg(...f.t2), 'stroke'], ['line', seg(...f.base), 'stroke']];
        if (tool !== 'pitchfork') out.push(['line', seg(P[0], f.origin), 'guide']);
        if (tool === 'insidePitchfork') out.push(['line', seg(P[1], f.t1[0]), 'guide'], ['line', seg(P[2], f.t2[0]), 'guide']);
        return out;
      }
      case 'fibRetracement': case 'trendFibExtension': {
        const ext3 = tool === 'trendFibExtension';
        if (P.length < (ext3 ? 3 : 2)) return [line(P)];
        const [A, B, C] = P, pr = opt.prices || [];
        let x0 = ext3 ? C.x : Math.min(A.x, B.x), x1 = ext3 ? C.x + Math.max(60, Math.abs(B.x - A.x)) : Math.max(A.x, B.x);
        if (ext.l) x0 = box.x0; if (ext.r) x1 = box.x1;
        const yAt = l => ext3 ? C.y + (B.y - A.y) * l : B.y + (A.y - B.y) * l;
        const price = l => ext3 ? (pr.length >= 3 ? fibExtPrice(pr[0], pr[1], pr[2], l) : null) : (pr.length >= 2 ? fibPrice(pr[0], pr[1], l) : null);
        const out = [ext3 ? ['polyline', { points: pts([A, B, C]) }, 'guide'] : ['line', seg(A, B), 'guide']];
        FIB.forEach((l, i) => { if (i) out.push(['polygon', { points: pts([{ x: x0, y: yAt(FIB[i - 1]) }, { x: x1, y: yAt(FIB[i - 1]) }, { x: x1, y: yAt(l) }, { x: x0, y: yAt(l) }]) }, 'lvlfill', null, lc(i)]); });
        FIB.forEach((l, i) => {
          const y = yAt(l), pv = price(l);
          out.push(['line', seg({ x: x0, y }, { x: x1, y }), 'lvl', null, lc(i)], ['text', { x: r1(x0 + 4), y: r1(y - 3) }, 'lvltext', `${l}${pv == null ? '' : ` (${pv.toFixed(2)})`}`, lc(i)]);
        });
        return out;
      }
      case 'fibChannel': {
        if (P.length < 3) return [line(P)];
        const [a2] = parallel(P[0], P[1], P[2]), off = { x: a2.x - P[0].x, y: a2.y - P[0].y };
        const lineAt = l => lineEnds(add(P[0], { x: off.x * l, y: off.y * l }), add(P[1], { x: off.x * l, y: off.y * l }), box, ext);
        const out = [];
        FIB.forEach((l, i) => { if (i) { const [p0, p1] = lineAt(FIB[i - 1]), [q0, q1] = lineAt(l); out.push(['polygon', { points: pts([p0, p1, q1, q0]) }, 'lvlfill', null, lc(i)]); } });
        FIB.forEach((l, i) => { const [a, b] = lineAt(l); out.push(['line', seg(a, b), 'lvl', null, lc(i)], ['text', { x: r1(a.x + 4), y: r1(a.y - 3) }, 'lvltext', String(l), lc(i)]); });
        return out;
      }
      case 'fibTimeZone': {
        const out = [['line', seg(P[0], P[1]), 'guide']];
        timeZones(P[0].x, P[1].x - P[0].x, box.x0, box.x1).forEach(({ n, x }, i) => out.push(['line', seg({ x, y: box.y0 }, { x, y: box.y1 }), 'lvl', null, lc(i)], ['text', { x: r1(x + 3), y: r1(box.y0 + 14) }, 'lvltext', String(n), lc(i)]));
        return out;
      }
      case 'trendFibTime': {
        if (P.length < 3) return [line(P)];
        const unit = P[1].x - P[0].x, out = [['polyline', { points: pts(P) }, 'guide']];
        FIB_TIME.forEach((l, i) => { const x = P[2].x + unit * l; if (x >= box.x0 - 0.5 && x <= box.x1 + 0.5) out.push(['line', seg({ x, y: box.y0 }, { x, y: box.y1 }), 'lvl', null, lc(i)], ['text', { x: r1(x + 3), y: r1(box.y0 + 14) }, 'lvltext', String(l), lc(i)]); });
        return out;
      }
      case 'fibSpeedFan': {
        const [A, B] = P, dx = B.x - A.x, dy = B.y - A.y, out = [['rect', { x: r1(Math.min(A.x, B.x)), y: r1(Math.min(A.y, B.y)), width: r1(Math.abs(dx)), height: r1(Math.abs(dy)) }, 'guide'], ['line', seg(A, extend(A, B, box)), 'lvl', null, lc(0)]];
        FAN.forEach((l, i) => {
          const pq = { x: B.x, y: A.y + dy * l }, tq = { x: A.x + dx * l, y: B.y };
          out.push(['line', seg(A, extend(A, pq, box)), 'lvl', null, lc(i + 1)], ['line', seg(A, extend(A, tq, box)), 'lvl', null, lc(i + 1)], ['text', { x: r1(B.x + 4), y: r1(pq.y + 4) }, 'lvltext', String(l), lc(i + 1)]);
        });
        return out;
      }
      case 'fibCircles': {
        const m = mid(P[0], P[1]), R = dist(P[0], P[1]) / 2, out = [['line', seg(P[0], P[1]), 'guide']];
        CIRCLE.forEach((l, i) => out.push(['circle', { cx: r1(m.x), cy: r1(m.y), r: r1(R * l) }, 'lvl', null, lc(i + 1)]));
        return out;
      }
      case 'fibSpiral': {
        const sp = spiral(P[0], P[1], Math.hypot(box.x1 - box.x0, box.y1 - box.y0) * 1.5);
        return [['line', seg(P[0], P[1]), 'guide'], ['polyline', { points: pts(sp) }, 'stroke']];
      }
      case 'fibSpeedArcs': {
        const [A, B] = P, R = dist(A, B), up = B.y <= A.y, out = [['line', seg(A, B), 'guide']];
        ARC.forEach((l, i) => { const r = R * l; out.push(['path', { d: `M${r1(A.x - r)} ${r1(A.y)} A${r1(r)} ${r1(r)} 0 0 ${up ? 1 : 0} ${r1(A.x + r)} ${r1(A.y)}` }, 'lvl', null, lc(i + 1)], ['text', { x: r1(A.x + 3), y: r1(A.y + (up ? -r - 3 : r + 11)) }, 'lvltext', String(l), lc(i + 1)]); });
        return out;
      }
      case 'fibWedge': {
        if (P.length < 3) return [line(P)];
        const [A, B, C] = P, R = dist(A, B), a1 = Math.atan2(B.y - A.y, B.x - A.x), a2 = Math.atan2(C.y - A.y, C.x - A.x);
        let dl = a2 - a1; while (dl > Math.PI) dl -= 2 * Math.PI; while (dl <= -Math.PI) dl += 2 * Math.PI;
        const sw = dl > 0 ? 1 : 0, at = (r, a) => ({ x: A.x + r * Math.cos(a), y: A.y + r * Math.sin(a) }), e2 = at(R, a2);
        const out = [['path', { d: `M${r1(A.x)} ${r1(A.y)} L${r1(B.x)} ${r1(B.y)} A${r1(R)} ${r1(R)} 0 0 ${sw} ${r1(e2.x)} ${r1(e2.y)} Z` }, 'lvlfill', null, lc(5)], ['line', seg(A, B), 'stroke'], ['line', seg(A, e2), 'stroke']];
        ARC.forEach((l, i) => { const r = R * l, s0 = at(r, a1), s1 = at(r, a2); out.push(['path', { d: `M${r1(s0.x)} ${r1(s0.y)} A${r1(r)} ${r1(r)} 0 0 ${sw} ${r1(s1.x)} ${r1(s1.y)}` }, 'lvl', null, lc(i + 1)], ['text', { x: r1(s0.x + 3), y: r1(s0.y - 3) }, 'lvltext', String(l), lc(i + 1)]); });
        return out;
      }
      case 'pitchfan': {
        if (P.length < 3) return [line(P)];
        const [A, B, C] = P, out = [['line', seg(B, C), 'stroke']];
        PITCHFAN.forEach((l, i) => { const q = { x: B.x + (C.x - B.x) * l, y: B.y + (C.y - B.y) * l }; out.push(['line', seg(A, extend(A, q, box)), 'lvl', null, l === 0.5 ? '#f23645' : lc(i)]); });
        return out;
      }
      case 'gannBox': {
        const [A, B] = P, out = [['rect', { x: r1(Math.min(A.x, B.x)), y: r1(Math.min(A.y, B.y)), width: r1(Math.abs(B.x - A.x)), height: r1(Math.abs(B.y - A.y)) }, 'lvlfill', null, lc(3)]];
        GANN.forEach((l, i) => {
          const x = A.x + (B.x - A.x) * l, y = A.y + (B.y - A.y) * l;
          out.push(['line', seg({ x, y: A.y }, { x, y: B.y }), 'lvl', null, lc(i)], ['line', seg({ x: A.x, y }, { x: B.x, y }), 'lvl', null, lc(i)],
            ['text', { x: r1(x), y: r1(Math.min(A.y, B.y) - 4), 'text-anchor': 'middle' }, 'lvltext', String(l), lc(i)], ['text', { x: r1(Math.min(A.x, B.x) - 4), y: r1(y + 3), 'text-anchor': 'end' }, 'lvltext', String(l), lc(i)]);
        });
        return out;
      }
      case 'gannSquare': case 'gannSquareFixed': {
        const A = P[0], B = tool === 'gannSquareFixed' ? gannSquareCorner(A, P[1]) : P[1], dx = B.x - A.x, dy = B.y - A.y;
        const out = [['rect', { x: r1(Math.min(A.x, B.x)), y: r1(Math.min(A.y, B.y)), width: r1(Math.abs(dx)), height: r1(Math.abs(dy)) }, 'lvl', null, lc(0)], ['line', seg(A, B), 'lvl', null, lc(1)], ['line', seg({ x: A.x, y: B.y }, { x: B.x, y: A.y }), 'lvl', null, lc(1)]];
        [0.25, 0.5, 0.75].forEach((l, i) => {
          out.push(['line', seg({ x: A.x + dx * l, y: A.y }, { x: A.x + dx * l, y: B.y }), 'guide'], ['line', seg({ x: A.x, y: A.y + dy * l }, { x: B.x, y: A.y + dy * l }), 'guide'],
            ['line', seg(A, { x: B.x, y: A.y + dy * l }), 'lvl', null, lc(i + 2)], ['line', seg(A, { x: A.x + dx * l, y: B.y }), 'lvl', null, lc(i + 2)]);
        });
        return out;
      }
      case 'gannFan': {
        const [A, B] = P, dx = B.x - A.x, dy = B.y - A.y, out = [];
        GANN_FAN.forEach(([pp, tt], i) => { const d = gannDir(dx, dy, pp, tt), q = add(A, d), e = extend(A, q, box); out.push(['line', seg(A, e), 'lvl', null, pp === tt ? '#f23645' : lc(i)], ['text', { x: r1(q.x + 4), y: r1(q.y + 4) }, 'lvltext', `${pp}x${tt}`, pp === tt ? '#f23645' : lc(i)]); });
        return out;
      }
      case 'arrowMarker': return [['polygon', { points: pts(fatArrow(P[0], P[1], w)) }, 'fill']];
      case 'arrow': return [['line', seg(P[0], P[1]), 'stroke'], ['polygon', { points: pts(arrowHead(P[0], P[1], 8 + w * 3)) }, 'fill']];
      case 'arrowUp': case 'arrowDown': {
        const s = tool === 'arrowUp' ? 1 : -1, { x, y } = P[0], k = 0.8 + w * 0.2;
        const rel = [[0, 0], [9, 10], [3.5, 10], [3.5, 24], [-3.5, 24], [-3.5, 10], [-9, 10]];
        return [['polygon', { points: pts(rel.map(([dx, dy]) => ({ x: x + dx * k, y: y + s * dy * k }))) }, 'fill']];
      }
      case 'rect': { const b = box2(P[0], P[1]); return [['rect', { x: r1(b.x), y: r1(b.y), width: r1(b.w), height: r1(b.h) }, 'both']]; }
      case 'rotRect': return P.length < 3 ? [line(P)] : [['polygon', { points: pts(rotRect(P[0], P[1], P[2])) }, 'both']];
      case 'path': return P.length < 2 ? [line(P)] : [line(P), ['polygon', { points: pts(arrowHead(P[P.length - 2], P[P.length - 1], 8 + w * 3)) }, 'fill']];
      case 'circle': return [['circle', { cx: r1(P[0].x), cy: r1(P[0].y), r: r1(dist(P[0], P[1])) }, 'both']];
      case 'ellipse': { const b = box2(P[0], P[1]); return [['ellipse', { cx: r1(b.x + b.w / 2), cy: r1(b.y + b.h / 2), rx: r1(b.w / 2), ry: r1(b.h / 2) }, 'both']]; }
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

  const core = { TOOLS, TOOL, GROUPS, SWATCHES, TFS, FIB, FIB_TIME, FIB_NUMBERS, GANN_FAN, PHI, fibPrice, fibExtPrice, timeZones, spiral, gannDir, gannSquareCorner, timeMap, extend, lineEnds, regression, parallel, pitchfork, angleDeg, arrowHead, fatArrow, rotRect, quadControl, sCurve, simplify, visibleOn, reorder, geometry, dist };
  if (typeof module === 'object' && module.exports) module.exports = core;
  if (!root || !root.document) return;

  // ------------------------------------------------------------------ browser part
  const doc = root.document;
  const STORE_KEY = 'redline-drawings-v1', PREF_KEY = 'redline-drawing-prefs-v1', MAX_UNDO = 60;
  const read = (k, d) => { try { const v = JSON.parse(root.localStorage.getItem(k)); return v && typeof v === 'object' ? v : d; } catch { return d; } };
  const write = (k, v) => { try { root.localStorage.setItem(k, JSON.stringify(v)); } catch { /* private window: keep in memory */ } };
  const uid = () => (root.crypto?.randomUUID ? root.crypto.randomUUID() : `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const say = m => { if (typeof toast === 'function') toast(m); };

  const store = read(STORE_KEY, {});
  const prefs = Object.assign({ last: 'brush', lastBy: {}, favs: [], styles: {}, barPos: null }, read(PREF_KEY, {}));
  for (const g of GROUPS) if (!TOOL[prefs.lastBy[g.id]] || TOOL[prefs.lastBy[g.id]].group !== g.id) prefs.lastBy[g.id] = TOOL[prefs.last]?.group === g.id ? prefs.last : g.first;
  prefs.favs = (Array.isArray(prefs.favs) ? prefs.favs : []).filter(id => TOOL[id]);
  const S = { tool: null, draft: null, sel: null, drag: null, open: null, help: null, pop: null, clip: null, undo: [], raf: 0, barDrag: null };

  const ICON = {
    trendline: 'M6.2 17.8 17.8 6.2M4.4 19.6a1.6 1.6 0 1 1 2.3-2.3 1.6 1.6 0 0 1-2.3 2.3zM17.3 6.7a1.6 1.6 0 1 1 2.3-2.3 1.6 1.6 0 0 1-2.3 2.3z',
    ray: 'M6.2 17.8 21 3M4.4 19.6a1.6 1.6 0 1 1 2.3-2.3 1.6 1.6 0 0 1-2.3 2.3zM10.9 13.1a1.6 1.6 0 1 1 2.3-2.3 1.6 1.6 0 0 1-2.3 2.3z',
    infoLine: 'M5.8 14.2 12 8M4.2 15.8a1.5 1.5 0 1 1 2.1-2.1 1.5 1.5 0 0 1-2.1 2.1zM13 13h8v7h-8zM15 15.5h4M15 17.8h3',
    extendedLine: 'M2 22 22 2M7 18.2a1.6 1.6 0 1 1 2.3-2.3 1.6 1.6 0 0 1-2.3 2.3zM14.7 10.4a1.6 1.6 0 1 1 2.3-2.3 1.6 1.6 0 0 1-2.3 2.3z',
    trendAngle: 'M4 19 18 6M4 19h16M11 19a7 7 0 0 0-2-4.9',
    hline: 'M2 12h8M14 12h8M12 10a2 2 0 1 0 0 4 2 2 0 1 0 0-4z',
    hray: 'M7 12h15M5 10a2 2 0 1 0 0 4 2 2 0 1 0 0-4z',
    vline: 'M12 2v8M12 14v8M12 10a2 2 0 1 0 0 4 2 2 0 1 0 0-4z',
    crossline: 'M2 12h8M14 12h8M12 2v8M12 14v8M12 10a2 2 0 1 0 0 4 2 2 0 1 0 0-4z',
    parallelChannel: 'M3 14 14 3M10 21 21 10M5 16.5a1.5 1.5 0 1 1 0 .01M19 8a1.5 1.5 0 1 1 0 .01',
    regression: 'M3 17 21 9M3 12.5 21 4.5M3 21.5 21 13.5',
    flatTopBottom: 'M3 19 21 9M3 5h18',
    disjointChannel: 'M3 10 21 4M3 14 21 20',
    pitchfork: 'M3 21l7-7M10 14l11-3M10 14l3 7M10 14l10 3M8.5 7.5 21 11',
    schiff: 'M3 21v-5M3 18l7-4M10 14l11-3M10 14l3 7M10 14l10 3',
    modSchiff: 'M3 21l3-5M6 16l4-2M10 14l11-3M10 14l3 7M10 14l10 3',
    insidePitchfork: 'M3 21l7-7M10 14l11-1.5M10 14l8 6M10 14l11 3',
    fibRetracement: 'M3 5h18M3 9.5h18M3 13h18M3 17.5h18M4.5 20.5a1.5 1.5 0 1 1 0 .01M19.5 3.5a1.5 1.5 0 1 1 0 .01',
    trendFibExtension: 'M3 20l5-12 4 6M9 6h12M9 10h12M9 14h12M9 18h12',
    fibChannel: 'M3 13l9-9M6 16l9-9M9 19l9-9M12 22l9-9',
    fibTimeZone: 'M4 3v18M7 3v18M10 3v18M14 3v18M20 3v18',
    fibSpeedFan: 'M3 21 21 3M3 21l18-7M3 21l18-12M3 21l7-18M3 21l12-18M3 3v18h18',
    trendFibTime: 'M3 20l4-10 3 6M10 3v18M14 3v18M18 3v18M21 3v18',
    fibCircles: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18M12 7a5 5 0 1 0 0 10 5 5 0 1 0 0-10M12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 1 0 0-3',
    fibSpiral: 'M12 12a1.5 1.5 0 0 1 1.5 1.5A3 3 0 0 1 10.5 16.5 4.5 4.5 0 0 1 6 12a6 6 0 0 1 6-6 7.5 7.5 0 0 1 7.5 7.5',
    fibSpeedArcs: 'M3 20h18M5 20a7 7 0 0 1 14 0M8 20a4 4 0 0 1 8 0M12 20 20 6',
    fibWedge: 'M4 20 20 20M4 20 15 6M11 20a7 7 0 0 0-2.4-5.3M16 20a12 12 0 0 0-4-9',
    pitchfan: 'M4 20 20 4M4 20 21 9M4 20 9 3M4 20l17-2M4 20 14 4',
    gannBox: 'M3 4h18v16H3zM3 9h18M3 14h18M9 4v16M15 4v16',
    gannSquareFixed: 'M4 4h16v16H4zM4 4l16 16M20 4 4 20M4 12h16M12 4v16',
    gannSquare: 'M3 5h18v14H3zM3 5l18 14M21 5 3 19M3 12h18M12 5v14',
    gannFan: 'M3 21 21 3M3 21l18-8M3 21l18-14M3 21 8 3M3 21l11-18',
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
    doubleCurve: 'M3 17c2.8-9.5 6-9.5 9-5s6.2 4.5 9-5',
    // toolbar
    grip: 'M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01',
    pencil: 'M4 20l1-4L16 5l3 3L8 19zM14 7l3 3',
    text: 'M5 5h14M12 5v12',
    bucket: 'M5 11l6-6 7 7-6 6zM5 11h13M19 15s2 2.3 2 3.5a2 2 0 0 1-4 0c0-1.2 2-3.5 2-3.5z',
    settings: 'M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4zM12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6z',
    alert: 'M12 8v5l3 2M12 21a8 8 0 1 0 0-16 8 8 0 1 0 0 16zM4 4 2 6M20 4l2 2M19 17v4M17 19h4',
    lock: 'M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z',
    unlock: 'M7 11V7a5 5 0 0 1 9.6-2M5 11h14v10H5z',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    layers: 'M12 3 2 8l10 5 10-5zM2 13l10 5 10-5',
    eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6z',
    eyeOff: 'M3 3l18 18M10.6 5.1C11 5 11.5 5 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.1 3.9M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7c1.7 0 3.2-.5 4.5-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2',
    clone: 'M8 8h12v12H8zM4 16V4h12',
    copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
    chevron: 'M9 6l6 6-6 6'
  };
  const ico = (id, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON[id]}"/></svg>`;
  const STAR = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';

  const onChart = () => typeof page !== 'undefined' && page === 'chart';
  const curTf = () => (typeof tf !== 'undefined' ? tf : '');
  const frameEl = () => doc.querySelector('.chart-frame');
  const styleOf = id => Object.assign({ color: TOOL[id].color, width: TOOL[id].width }, prefs.styles[id] || {});
  const savePrefs = () => write(PREF_KEY, prefs);
  const fillable = d => !!TOOL[d.tool]?.fill;
  const hasLine = d => TOOL[d.tool]?.kind !== 'free' && !['arrowMarker', 'arrowUp', 'arrowDown'].includes(d.tool);

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
    return { g, all, timed, map: timeMap(T), W, H, key: timed ? `${symbol}` : `${symbol}:${tf}:demo`, frame,
      box: { x0: 8 / 900 * W, x1: 830 / 900 * W, y0: 0, y1: 375 / 400 * H } };
  }
  const kToX = (c, k) => (10 + (k - c.g.start) * c.g.dx + c.g.dx / 2) / 900 * c.W;
  const pToY = (c, p) => c.g.y(p) / 400 * c.H;
  const toPx = (c, a) => ({ x: kToX(c, c.map.tToK(a.t)), y: pToY(c, a.p) });
  function toAnchor(c, x, y) {
    const k = c.g.start + ((x / c.W) * 900 - 10) / c.g.dx - 0.5;
    const p = c.g.max - ((y / c.H) * 400 - 20) / 290 * (c.g.max - c.g.min);
    return { t: c.map.kToT(k), p };
  }
  const local = (c, e) => { const r = c.frame.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const inPlot = (c, q) => q.x >= c.box.x0 && q.x <= c.box.x1 && q.y >= 0 && q.y <= c.box.y1;
  const list = key => (store[key] ||= []);
  const persist = key => { if (!store[key]?.length) delete store[key]; write(STORE_KEY, store); };
  function snapshot(key) { S.undo.push({ key, json: JSON.stringify(store[key] || []) }); if (S.undo.length > MAX_UNDO) S.undo.shift(); }
  const shown = d => !d.hidden && visibleOn(d.vis, curTf());
  const sec = t => (t > 1e12 ? t / 1000 : t);
  const fmtTime = t => new Date(sec(t) * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Phoenix' });
  function fmtSpan(s) { s = Math.abs(Math.round(s)); const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`; }
  // Price of a drawing at the newest bar (for the alert button).
  function priceNow(c, d) {
    const k = c.all.length - 1, a = d.pts[0], b = d.pts[1];
    if (!b || ['hline', 'hray', 'crossline', 'vline', 'arrowUp', 'arrowDown'].includes(d.tool) || !TOOL[d.tool].line) return a.p;
    const ka = c.map.tToK(a.t), kb = c.map.tToK(b.t);
    return Math.abs(kb - ka) < 1e-9 ? b.p : a.p + (b.p - a.p) * (k - ka) / (kb - ka);
  }

  // ---------------------------------------------------------------- rendering
  const attrs = o => Object.entries(o).map(([k, v]) => `${k}="${v}"`).join(' ');
  const dashArr = (dash, w) => dash === 'dashed' ? `stroke-dasharray="${w * 3 + 3} ${w * 2 + 3}"` : dash === 'dotted' ? `stroke-dasharray="0.1 ${w * 2 + 2.5}"` : '';
  function extras(c, d, P) {
    const t = TOOL[d.tool], o = { width: d.width || t.width, closed: d.closed, box: c.box, ext: d.ext || t.ext };
    if (t.levels) o.prices = P.map(q => toAnchor(c, q.x, q.y).p);
    if (['hline', 'hray', 'crossline'].includes(d.tool)) o.priceText = d.pts[0].p.toFixed(2);
    if (['vline', 'crossline'].includes(d.tool) && c.timed) o.timeText = fmtTime(d.pts[0].t);
    if (d.tool === 'infoLine' && d.pts.length >= 2) {
      const [a, b] = d.pts, dp = b.p - a.p, bars = Math.round(c.map.tToK(b.t) - c.map.tToK(a.t));
      o.info = [`${dp >= 0 ? '+' : ''}${dp.toFixed(2)} (${a.p ? (dp / a.p * 100).toFixed(2) : '0.00'}%)`, `${bars} bar${Math.abs(bars) === 1 ? '' : 's'}${c.timed ? `, ${fmtSpan(sec(b.t) - sec(a.t))}` : ''}`, `${angleDeg(P[0], P[1]).toFixed(1)}°`];
    }
    if (d.tool === 'regression' && d.pts.length >= 2) {
      let k0 = Math.round(c.map.tToK(d.pts[0].t)), k1 = Math.round(c.map.tToK(d.pts[1].t));
      if (k0 > k1) [k0, k1] = [k1, k0];
      k0 = Math.max(0, k0); k1 = Math.min(c.all.length - 1, k1);
      const fit = k1 - k0 >= 1 ? regression(c.all.slice(k0, k1 + 1).map(b => b.c)) : null;
      if (fit) {
        const at = (k, off) => ({ x: kToX(c, k), y: pToY(c, fit.intercept + fit.slope * (k - k0) + off) });
        o.reg = { c: [at(k0, 0), at(k1, 0)], u: [at(k0, 2 * fit.sd), at(k1, 2 * fit.sd)], l: [at(k0, -2 * fit.sd), at(k1, -2 * fit.sd)] };
      }
    }
    return o;
  }
  function textPos(d, P) {
    if (['hline', 'hray'].includes(d.tool) || d.tool === 'crossline') return { x: (d.tool === 'hray' ? P[0].x : 0) + 10, y: P[0].y - 7, anchor: 'start' };
    if (d.tool === 'vline') return { x: P[0].x + 6, y: 16, anchor: 'start' };
    if (P.length >= 2 && hasLine(d) && TOOL[d.tool].line) { const m = mid(P[0], P[1]); return { x: m.x, y: m.y - 8, anchor: 'middle' }; }
    const xs = P.map(q => q.x), ys = P.map(q => q.y);
    return { x: Math.min(...xs), y: Math.min(...ys) - 8, anchor: 'start' };
  }
  function drawingSvg(c, d, opts = {}) {
    const t = TOOL[d.tool]; if (!t) return { clip: '', axis: '' };
    const P = d.pts.map(a => toPx(c, a)).concat(opts.cursor ? [opts.cursor] : []);
    const w = d.width || t.width, col = d.color || t.color, alpha = t.alpha ?? 1, dash = dashArr(d.dash, w);
    const fillCol = d.fillColor || col, fillOn = d.fillOn !== false;
    const o = extras(c, d, P);
    if (d.tool === 'regression' && o.reg) { P[0] = o.reg.c[0]; P[1] = o.reg.c[1]; }
    const els = geometry(d.tool, P, o);
    const levelOn = d.levelColors !== false;
    const paint = (p, lcol) => { const k = levelOn && lcol ? lcol : col; return ({
      lvl: `fill="none" stroke="${k}" stroke-width="${w}" stroke-linecap="round" ${dash}`,
      lvlfill: `fill="${fillOn ? (levelOn && lcol ? lcol : fillCol) : 'none'}" fill-opacity=".09" stroke="none"`,
      lvltext: `fill="${k}" font-size="10.5" font-family="monospace"`,
      stroke: `fill="none" stroke="${col}" stroke-width="${w}" stroke-opacity="${alpha}" stroke-linecap="round" stroke-linejoin="round" ${dash}`,
      fill: `fill="${col}" fill-opacity="${alpha === 1 ? 0.92 : alpha}" stroke="none"`,
      both: `fill="${fillOn ? fillCol : 'none'}" fill-opacity=".14" stroke="${col}" stroke-width="${w}" stroke-linejoin="round" ${dash}`,
      area: `fill="${fillOn ? fillCol : 'none'}" fill-opacity=".12" stroke="none"`,
      guide: `fill="none" stroke="${col}" stroke-width="1" stroke-opacity=".7" stroke-dasharray="4 4"`,
      label: `fill="${col}" font-size="11" font-weight="700"`,
      axis: `fill="${col}"`,
      axistext: 'fill="#ffffff" font-size="10.5" font-weight="700" font-family="monospace"',
      info: `fill="#141516" fill-opacity=".92" stroke="${col}" stroke-opacity=".7"`,
      infotext: 'fill="#e8edf4" font-size="11" font-family="monospace"'
    }[p]); };
    const el = ([tag, a, p, txt, lcol]) => txt == null ? `<${tag} ${attrs(a)} ${paint(p, lcol)}/>` : `<${tag} ${attrs(a)} ${paint(p, lcol)}>${E(txt)}</${tag}>`;
    const axis = els.filter(x => x[2] === 'axis' || x[2] === 'axistext').map(el).join('');
    const body = els.filter(x => x[2] !== 'axis' && x[2] !== 'axistext');
    let vis = body.map(el).join('');
    if (d.text && P.length) { const tp = textPos(d, P); vis += `<text x="${r1(tp.x)}" y="${r1(tp.y)}" text-anchor="${tp.anchor}" fill="${d.textColor || col}" font-size="12" font-weight="600" class="rd-text">${E(d.text)}</text>`; }
    if (opts.preview) return { clip: `<g class="rd-draft">${vis}${P.map(q => `<circle class="rd-handle" cx="${r1(q.x)}" cy="${r1(q.y)}" r="3.5"/>`).join('')}</g>`, axis };
    const hitW = Math.max(12, w + 8);
    const hit = body.filter(x => !['label', 'infotext', 'guide', 'lvltext'].includes(x[2])).map(([tag, a, p]) => `<${tag} ${attrs(a)} class="rd-hit" data-dw="${d.id}" fill="${p === 'stroke' || p === 'lvl' || ((p === 'both' || p === 'area' || p === 'lvlfill') && !fillOn) ? 'none' : 'transparent'}" stroke="transparent" stroke-width="${hitW}"/>`).join('');
    const sel = S.sel === d.id;
    let handles = '';
    if (sel) {
      if (t.kind === 'free') {
        const xs = P.map(q => q.x), ys = P.map(q => q.y), x0 = Math.min(...xs) - 6, y0 = Math.min(...ys) - 6;
        handles = `<rect class="rd-bbox" x="${r1(x0)}" y="${r1(y0)}" width="${r1(Math.max(...xs) - x0 + 6)}" height="${r1(Math.max(...ys) - y0 + 6)}"/>`;
      } else handles = P.map((q, i) => `<circle class="rd-handle${d.locked ? ' rd-locked' : ' rd-grab'}" data-dw="${d.id}" data-dw-pt="${i}" cx="${r1(q.x)}" cy="${r1(q.y)}" r="5"/>`).join('');
    }
    return { clip: `<g class="rd-shape${sel ? ' rd-selected' : ''}${d.locked ? ' rd-is-locked' : ''}" data-tool="${d.tool}" data-id="${d.id}">${vis}${hit}${handles}</g>`, axis: `<g data-axis-for="${d.id}">${axis}</g>` };
  }

  function ensureLayer(frame) {
    let layer = frame.querySelector(':scope > .rd-layer');
    if (!layer) { layer = doc.createElement('div'); layer.className = 'rd-layer'; layer.innerHTML = '<svg class="rd-svg" aria-label="Chart drawings"></svg><div class="rd-favs" role="toolbar" aria-label="Favourite drawing tools"></div><div class="rd-bar" role="toolbar" aria-label="Selected drawing"></div>'; frame.appendChild(layer); }
    return layer;
  }

  function draw() {
    S.raf = 0;
    if (!onChart()) { closeMenu(); closePop(); return; }
    const c = ctx(); if (!c) return;
    const layer = ensureLayer(c.frame);
    layer.classList.toggle('rd-active', !!S.tool);
    c.frame.classList.toggle('rd-drawing', !!S.tool);
    if (S.draft && S.draft.key !== c.key) S.draft = null;
    const items = store[c.key] || [];
    if (S.sel && !items.some(d => d.id === S.sel && shown(d))) { S.sel = null; closePop(); }
    let clip = '', axis = '';
    for (const d of items) { if (!shown(d)) continue; const s = drawingSvg(c, d); clip += s.clip; axis += s.axis; }
    if (S.draft) { const s = drawingSvg(c, S.draft, { preview: true, cursor: TOOL[S.draft.tool].kind === 'free' ? null : S.draft.cursor }); clip += s.clip; axis += s.axis; }
    const svg = layer.querySelector('.rd-svg');
    svg.setAttribute('width', c.W); svg.setAttribute('height', c.H);
    svg.innerHTML = `<defs><clipPath id="rdClip"><rect x="${r1(c.box.x0)}" y="0" width="${r1(c.box.x1 - c.box.x0)}" height="${r1(c.box.y1)}"/></clipPath></defs><g clip-path="url(#rdClip)">${clip}</g><g class="rd-axis">${axis}</g>`;
    favBar(layer); selBar(c, layer, items.find(d => d.id === S.sel));
    syncRail();
    if (S.pop) paintPop();
  }
  // Next animation frame, with a timer backup for background / throttled tabs that get no frames.
  const schedule = () => {
    if (S.raf) return;
    const run = () => { if (!S.raf) return; root.cancelAnimationFrame(S.raf); root.clearTimeout(S.to); draw(); };
    S.raf = root.requestAnimationFrame(run); S.to = root.setTimeout(run, 120);
  };

  function favBar(layer) {
    const el = layer.querySelector('.rd-favs');
    const html = prefs.favs.map(id => `<button type="button" class="rd-fav-btn${S.tool === id ? ' on' : ''}" data-rd-tool="${id}" title="${TOOL[id].name}" aria-label="${TOOL[id].name}" aria-pressed="${S.tool === id}">${ico(id, 18)}</button>`).join('');
    if (el.innerHTML !== html) el.innerHTML = html;
    el.hidden = !prefs.favs.length;
  }

  // Floating toolbar for the selected drawing (TradingView layout).
  function selBar(c, layer, d) {
    const el = layer.querySelector('.rd-bar');
    if (!d) { el.hidden = true; el.innerHTML = ''; delete el.dataset.sig; return; }
    const t = TOOL[d.tool], col = d.color || t.color, w = d.width || t.width, dash = d.dash || 'solid';
    const b = (attr, icon, label, extra = '', cls = '') => `<button type="button" class="rd-tb ${cls}" ${attr} title="${label}" aria-label="${label}" ${extra}>${icon}</button>`;
    const html = [
      `<span class="rd-grip" data-rd-grip title="Drag to move the toolbar" aria-hidden="true">${ico('grip', 16)}</span>`,
      hasLine(d) || t.kind === 'free' || d.tool.startsWith('arrow') ? b('data-rd-pop="color"', `${ico('pencil', 18)}<i class="rd-uline" style="background:${col}"></i>`, 'Line colour', 'aria-haspopup="true"') : '',
      b('data-rd-pop="text"', `${ico('text', 18)}<i class="rd-uline" style="background:${d.textColor || col}"></i>`, d.text ? `Text: ${E(d.text)}` : 'Add text', 'aria-haspopup="true"'),
      fillable(d) ? b('data-rd-pop="fill"', `${ico('bucket', 18)}<i class="rd-uline" style="background:${d.fillOn === false ? 'transparent' : (d.fillColor || col)}"></i>`, 'Fill colour', 'aria-haspopup="true"') : '',
      hasLine(d) || t.kind === 'free' ? b('data-rd-pop="width"', `<span class="rd-wlabel"><i style="height:${Math.min(w, 4)}px"></i>${w}px</span>`, 'Line width', 'aria-haspopup="true"', 'rd-wide') : '',
      hasLine(d) ? b('data-rd-pop="style"', `<svg width="22" height="18" viewBox="0 0 22 18" aria-hidden="true"><line x1="2" y1="9" x2="20" y2="9" stroke="currentColor" stroke-width="2" ${dashArr(dash, 1.4)} stroke-linecap="round"/></svg>`, `Line style: ${dash}`, 'aria-haspopup="true"') : '',
      b('data-rd-settings', ico('settings', 18), 'Settings'),
      b('data-rd-alert', ico('alert', 18), 'Create a local demo alert at this price'),
      b('data-rd-lock', ico(d.locked ? 'lock' : 'unlock', 18), d.locked ? 'Unlock drawing' : 'Lock drawing', `aria-pressed="${!!d.locked}"`, d.locked ? 'on' : ''),
      b('data-rd-delete', ico('trash', 18), 'Delete drawing (Del)', '', 'rd-del'),
      b('data-rd-pop="more"', ico('more', 18), 'More', 'aria-haspopup="true"')
    ].join('');
    const sig = `${d.id}|${html}`;
    if (el.dataset.sig !== sig) { el.innerHTML = html; el.dataset.sig = sig; }
    el.hidden = false;
    // Position: remembered spot (dragged by the grip) or top centre; kept inside the chart.
    if (prefs.barPos) {
      const bw = el.offsetWidth || 360, bh = el.offsetHeight || 36;
      el.style.left = `${Math.max(4, Math.min(c.W - bw - 4, prefs.barPos.x))}px`;
      el.style.top = `${Math.max(4, Math.min(c.H - bh - 4, prefs.barPos.y))}px`;
      el.style.transform = 'none';
    } else { el.style.left = ''; el.style.top = ''; el.style.transform = ''; }
  }

  // Popovers for the toolbar (fixed, on <body>, so the chart frame never clips them).
  function closePop() { doc.querySelector('.rd-pop')?.remove(); doc.querySelector('.rd-pop-sub')?.remove(); S.pop = null; }
  function paintPop() {
    const c = ctx(), d = c && list(c.key).find(x => x.id === S.sel);
    if (!S.pop || !d) { closePop(); return; }
    const anchor = doc.querySelector(`.rd-bar [data-rd-pop="${S.pop.kind}"]`);
    if (!anchor) { closePop(); return; }
    const t = TOOL[d.tool], col = d.color || t.color;
    const sw = (attr, cur, extra = '') => `<div class="rd-swatches">${SWATCHES.map(s => `<button type="button" ${attr}="${s}" class="${s === cur ? 'on' : ''}" style="--sw:${s}" title="${s}" aria-label="Colour ${s}"></button>`).join('')}${extra}</div>`;
    let html = '';
    if (S.pop.kind === 'color') html = `<div class="rd-pop-title">Line colour</div>${sw('data-rd-set-color', t.levels && d.levelColors !== false ? '' : col)}<label class="rd-custom">Custom <input type="color" data-rd-custom="color" value="${col}"></label>${t.levels ? `<button type="button" class="rd-row${d.levelColors !== false ? ' on' : ''}" data-rd-levelcolors>Colour each level</button>` : ''}`;
    else if (S.pop.kind === 'fill') html = `<div class="rd-pop-title">Fill colour</div>${sw('data-rd-set-fill', d.fillOn === false ? '' : (d.fillColor || col))}<button type="button" class="rd-row${d.fillOn === false ? ' on' : ''}" data-rd-fill-none>No fill</button>`;
    else if (S.pop.kind === 'text') html = `<div class="rd-pop-title">Text</div><input class="rd-textin" data-rd-textin maxlength="80" placeholder="Add a label" aria-label="Drawing text"><div class="rd-pop-title">Text colour</div>${sw('data-rd-set-textcolor', d.textColor || col)}`;
    else if (S.pop.kind === 'width') html = WIDTHS.map(n => `<button type="button" class="rd-row${(d.width || t.width) === n ? ' on' : ''}" data-rd-set-width="${n}"><i class="rd-wsample" style="height:${n}px"></i>${n}px</button>`).join('');
    else if (S.pop.kind === 'style') html = Object.keys(DASHES).map(k => `<button type="button" class="rd-row${(d.dash || 'solid') === k ? ' on' : ''}" data-rd-set-dash="${k}"><svg width="44" height="10" aria-hidden="true"><line x1="2" y1="5" x2="42" y2="5" stroke="currentColor" stroke-width="2" ${dashArr(k, 1.4)} stroke-linecap="round"/></svg>${k[0].toUpperCase() + k.slice(1)}</button>`).join('');
    else if (S.pop.kind === 'more') html = `
      <button type="button" class="rd-row rd-has-sub${S.pop.sub === 'order' ? ' open' : ''}" data-rd-sub="order">${ico('layers', 18)}<span>Visual order</span>${ico('chevron', 14)}</button>
      <button type="button" class="rd-row rd-has-sub${S.pop.sub === 'vis' ? ' open' : ''}" data-rd-sub="vis"><span class="rd-noicon"></span><span>Visibility on intervals</span>${ico('chevron', 14)}</button>
      <div class="rd-sep"></div>
      <button type="button" class="rd-row" data-rd-clone>${ico('clone', 18)}<span>Clone</span><kbd>Ctrl + Drag</kbd></button>
      <button type="button" class="rd-row" data-rd-copy><span class="rd-noicon"></span><span>Copy</span><kbd>Ctrl + C</kbd></button>
      <div class="rd-sep"></div>
      <button type="button" class="rd-row" data-rd-hide>${ico('eyeOff', 18)}<span>Hide</span></button>`;
    let pop = doc.querySelector('.rd-pop');
    if (!pop) { pop = doc.createElement('div'); pop.className = 'rd-pop'; pop.setAttribute('role', 'menu'); doc.body.appendChild(pop); }
    pop.dataset.kind = S.pop.kind;
    // never rebuild under an open native colour picker
    if (pop.dataset.sig !== html && !doc.activeElement?.matches?.('[data-rd-custom]')) {
      const focused = doc.activeElement?.matches?.('[data-rd-textin]');
      // the typed text is not part of the markup, so typing never rebuilds the box under the caret
      pop.innerHTML = html; pop.dataset.sig = html;
      const i = pop.querySelector('[data-rd-textin]');
      if (i) { i.value = d.text || ''; if (!focused || S.pop.kind === 'text') { i.focus(); if (!focused) i.select(); } }
    }
    const r = anchor.getBoundingClientRect(), vw = root.innerWidth, vh = root.innerHeight;
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    pop.style.left = `${Math.round(Math.max(6, Math.min(vw - pw - 6, r.left)))}px`;
    pop.style.top = `${Math.round(r.bottom + 6 + ph > vh ? Math.max(6, r.top - ph - 6) : r.bottom + 6)}px`;
    // submenu
    let sub = doc.querySelector('.rd-pop-sub');
    if (S.pop.kind === 'more' && S.pop.sub) {
      const v = d.vis?.mode || 'all';
      const shtml = S.pop.sub === 'order'
        ? [['front', 'Bring to front'], ['back', 'Send to back'], ['forward', 'Bring forward'], ['backward', 'Send backward']].map(([k, n]) => `<button type="button" class="rd-row" data-rd-order="${k}">${n}</button>`).join('')
        : [['above', 'Current interval and above'], ['below', 'Current interval and below'], ['only', 'Current interval only'], ['all', 'All intervals']].map(([k, n]) => `<button type="button" class="rd-row${v === k && (k === 'all' || d.vis?.tf === curTf()) ? ' on' : ''}" data-rd-vis="${k}">${n}</button>`).join('');
      if (!sub) { sub = doc.createElement('div'); sub.className = 'rd-pop rd-pop-sub'; sub.setAttribute('role', 'menu'); doc.body.appendChild(sub); }
      if (sub.dataset.sig !== shtml) { sub.innerHTML = shtml; sub.dataset.sig = shtml; }
      const row = pop.querySelector(`[data-rd-sub="${S.pop.sub}"]`).getBoundingClientRect(), sw2 = sub.offsetWidth;
      sub.style.left = `${Math.round(row.right + 4 + sw2 > vw ? Math.max(6, row.left - sw2 - 4) : row.right + 4)}px`;
      sub.style.top = `${Math.round(Math.min(vh - sub.offsetHeight - 6, row.top - 6))}px`;
    } else sub?.remove();
  }
  function openPop(kind) { S.pop = S.pop?.kind === kind ? null : { kind, sub: null }; if (S.pop) { closeMenu(); paintPop(); } else closePop(); }

  // ---------------------------------------------------------------- rail buttons + tool menu
  function syncRail() {
    const rail = doc.querySelector('.terminal-drawing-rail'); if (!rail) return;
    let prev = rail.querySelector('[data-action="draw"]');
    for (const g of GROUPS) {
      let grp = rail.querySelector(`.rd-railgrp[data-group="${g.id}"]`);
      if (!grp) {
        grp = doc.createElement('div'); grp.className = 'rd-railgrp'; grp.dataset.group = g.id;
        grp.innerHTML = `<button type="button" class="terminal-tool rd-rail-main" data-rd-main="${g.id}"></button><button type="button" class="rd-rail-more" data-rd-more="${g.id}" aria-haspopup="menu" aria-label="${g.name}" title="${g.name}"><svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M2 1l4 3-4 3" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></button>`;
        if (prev) prev.after(grp); else rail.prepend(grp);
      }
      prev = grp;
      const active = S.tool && TOOL[S.tool].group === g.id, id = active ? S.tool : prefs.lastBy[g.id], main = grp.querySelector('[data-rd-main]');
      if (main.dataset.tool !== id) { main.dataset.tool = id; main.innerHTML = ico(id); }
      const label = `${TOOL[id].name} — ${active ? 'drawing, click to stop' : 'click to draw'}`;
      main.title = label; main.setAttribute('aria-label', label); main.setAttribute('aria-pressed', String(!!active));
      main.classList.toggle('selected', !!active);
      grp.querySelector('[data-rd-more]').setAttribute('aria-expanded', String(S.open === g.id));
    }
    const cursor = rail.querySelector('[data-action="terminal-cursor"]');
    if (cursor && S.tool) cursor.classList.remove('selected');
    if (S.open) paintMenu();
  }
  function paintMenu() {
    const gid = S.open; if (!gid) return;
    let m = doc.querySelector('.rd-fly');
    if (!m) { m = doc.createElement('div'); m.className = 'rd-fly'; m.setAttribute('role', 'menu'); doc.body.appendChild(m); }
    m.setAttribute('aria-label', GROUPS.find(g => g.id === gid).name); m.dataset.group = gid;
    const tools = TOOLS.filter(t => t.group === gid), sections = [...new Set(tools.map(t => t.section))], cur = S.tool || prefs.lastBy[gid];
    const html = sections.map(s => `<div class="rd-sec">${s.toUpperCase()}</div>${tools.filter(t => t.section === s).map(t => `
      <div class="rd-item${cur === t.id ? ' active' : ''}">
        <button type="button" class="rd-pick" role="menuitem" data-rd-tool="${t.id}">${ico(t.id)}<span>${t.name}</span>${t.key ? `<kbd>${t.key}</kbd>` : ''}</button>
        <button type="button" class="rd-q${S.help === t.id ? ' on' : ''}" data-rd-help="${t.id}" aria-label="How to draw: ${t.name}" aria-expanded="${S.help === t.id}">?</button>
        <button type="button" class="rd-star${prefs.favs.includes(t.id) ? ' on' : ''}" data-rd-fav="${t.id}" aria-pressed="${prefs.favs.includes(t.id)}" aria-label="${prefs.favs.includes(t.id) ? 'Remove from' : 'Add to'} favourites: ${t.name}">${STAR}</button>
      </div>${S.help === t.id ? `<p class="rd-help">${t.help}</p>` : ''}`).join('')}`).join('<div class="rd-div"></div>');
    if (m.dataset.sig !== html) { const top = m.scrollTop; m.innerHTML = html; m.dataset.sig = html; m.scrollTop = top; }
    const btn = doc.querySelector(`.rd-railgrp[data-group="${gid}"]`);
    if (btn) {
      const r = btn.getBoundingClientRect(), vh = root.innerHeight;
      const top = Math.max(8, Math.min(r.top - 8, vh - Math.min(m.scrollHeight + 2, vh - 16)));   // move up so the list fits
      m.style.left = `${Math.round(r.right + 6)}px`; m.style.top = `${Math.round(top)}px`; m.style.maxHeight = `${Math.round(vh - top - 10)}px`;
    }
  }
  function openMenu(gid) { S.open = gid; if (gid) { closePop(); paintMenu(); } else { S.help = null; closeMenu(); } schedule(); }
  function closeMenu() { doc.querySelector('.rd-fly')?.remove(); S.open = null; }

  function setTool(id) {
    if (id && !TOOL[id]) return;
    S.draft = null; S.drag = null; closePop();
    S.tool = id || null;
    if (id) { prefs.last = id; prefs.lastBy[TOOL[id].group] = id; savePrefs(); S.sel = null; }
    if (id && typeof drawMode !== 'undefined' && drawMode) { drawMode = false; if (typeof render === 'function') render(); }
    schedule();
  }

  // ---------------------------------------------------------------- editing
  function mutate(key, fn) { snapshot(key); fn(list(key)); persist(key); schedule(); }
  const selected = () => { const c = ctx(); return c && S.sel ? { c, d: list(c.key).find(x => x.id === S.sel) } : null; };
  function finishDraft(c) {
    const d = S.draft; if (!d) return;
    S.draft = null;
    const t = TOOL[d.tool];
    const ok = t.kind === 'free' ? d.pts.length >= 2 : t.kind === 'multi' ? d.pts.length >= (t.min || 2) : d.pts.length === t.n;
    if (ok) {
      const st = styleOf(d.tool), item = { id: uid(), tool: d.tool, pts: d.pts, color: st.color, width: st.width };
      for (const k of ['dash', 'fillColor', 'fillOn', 'textColor']) if (st[k] != null) item[k] = st[k];
      if (d.closed) item.closed = true;
      mutate(c.key, l => l.push(item));
      S.sel = item.id;
    }
    S.tool = null; schedule();
  }
  function startDraft(c, q, a) { S.draft = { tool: S.tool, key: c.key, pts: [a], px: [q], cursor: q, down: q }; }
  // A copy shifted by `bars` bars (clone / paste), or in place.
  function duplicate(c, d, bars) {
    const n = JSON.parse(JSON.stringify(d));
    n.id = uid(); delete n.hidden;
    if (bars) n.pts = n.pts.map(a => ({ t: c.map.kToT(c.map.tToK(a.t) + bars), p: a.p }));
    return n;
  }

  function onDown(e) {
    if (e.button !== 0 || !onChart()) return;
    const frame = e.target.closest?.('.chart-frame');
    if (!frame) return;
    if (e.target.closest('[data-rd-grip]')) {
      e.stopPropagation(); e.preventDefault();
      const bar = e.target.closest('.rd-bar'), r = bar.getBoundingClientRect(), fr = frame.getBoundingClientRect();
      S.barDrag = { dx: e.clientX - r.left, dy: e.clientY - r.top, fx: fr.left, fy: fr.top };
      closePop(); return;
    }
    if (e.target.closest('.rd-bar,.rd-favs')) { e.stopPropagation(); return; }   // their buttons get a normal click
    const c = ctx(); if (!c) return;
    const q = local(c, e);
    const hitId = e.target.closest('[data-dw]')?.dataset.dw;
    if (S.tool) {
      if (!inPlot(c, q)) return;                       // price axis keeps its scale drag
      e.stopPropagation(); e.preventDefault();
      const a = toAnchor(c, q.x, q.y), t = TOOL[S.tool];
      if (t.kind === 'mark') {
        // single-click tools sit on a bar (vertical line / crossline time tag reads the bar's time)
        if (!c.timed || c.map.tToK(a.t) <= c.all.length - 1) a.t = c.map.kToT(Math.round(c.map.tToK(a.t)));
        S.draft = { tool: S.tool, key: c.key, pts: [a] }; finishDraft(c); return;
      }
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
      closePop();
      let d = list(c.key).find(x => x.id === hitId);
      if (!d) return;
      let before = JSON.stringify(list(c.key));
      if ((e.ctrlKey || e.metaKey) && !d.locked) {        // Ctrl + drag clones, then drags the clone
        const n = duplicate(c, d, 0), l = list(c.key);
        l.splice(l.indexOf(d) + 1, 0, n); d = n;
      }
      S.sel = d.id;
      if (d.locked) { schedule(); return; }
      const ptAttr = e.target.dataset.dwPt;
      S.drag = { id: d.id, key: c.key, pt: ptAttr == null ? null : Number(ptAttr), from: toAnchor(c, q.x, q.y), q, orig: JSON.parse(JSON.stringify(d.pts)), before, moved: false, cloned: d.id !== hitId };
      schedule();
      return;
    }
    if (S.sel) { S.sel = null; closePop(); schedule(); }           // empty chart: deselect and let the chart pan
  }
  function onMove(e) {
    if (S.barDrag) {
      const b = S.barDrag; prefs.barPos = { x: e.clientX - b.fx - b.dx, y: e.clientY - b.fy - b.dy }; schedule(); return;
    }
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
    if (S.barDrag) { S.barDrag = null; savePrefs(); e.stopPropagation(); return; }
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
    if (g.moved || g.cloned) { S.undo.push({ key: g.key, json: g.before }); if (S.undo.length > MAX_UNDO) S.undo.shift(); persist(g.key); }
    schedule();
  }
  function onDbl(e) {
    if (!onChart() || !e.target.closest?.('.chart-frame')) return;
    if (!S.tool && !e.target.closest('[data-dw],.rd-bar,.rd-favs')) return;
    e.stopPropagation(); e.preventDefault();          // no "add price level" while drawing
    const c = ctx();
    if (c && S.draft && TOOL[S.draft.tool].kind === 'multi') finishDraft(c);
    else if (!S.tool && e.target.closest('[data-dw]')) settingsModal();   // double-click a drawing: settings
  }
  function removeSelected() {
    const s = selected(); if (!s?.d) return false;
    const id = S.sel; S.sel = null; closePop();
    mutate(s.c.key, l => { const i = l.findIndex(d => d.id === id); if (i >= 0) l.splice(i, 1); });
    return true;
  }
  function undo() {
    const u = S.undo.pop(); if (!u) return false;
    const arr = JSON.parse(u.json);
    if (arr.length) store[u.key] = arr; else delete store[u.key];
    write(STORE_KEY, store); S.sel = null; closePop(); schedule(); return true;
  }
  function edit(v) { const s = selected(); if (!s?.d) return; mutate(s.c.key, () => Object.assign(s.d, v)); return s.d; }
  function rememberStyle(d, v) { prefs.styles[d.tool] = Object.assign({}, prefs.styles[d.tool], v); savePrefs(); }
  function copySel() { const s = selected(); if (!s?.d) return false; S.clip = JSON.parse(JSON.stringify(s.d)); say('Drawing copied · Ctrl+V to paste'); return true; }
  function paste() {
    const c = ctx(); if (!c || !S.clip) return false;
    const n = duplicate(c, S.clip, 3);
    mutate(c.key, l => l.push(n)); S.sel = n.id; return true;
  }

  function settingsModal() {
    const s = selected(); if (!s?.d || typeof openModal !== 'function') return;
    const { c, d } = s, t = TOOL[d.tool], col = d.color || t.color;
    closePop();
    const pt = (a, i) => `<div class="form-group"><label for="rdP${i}">Point ${i + 1} price${c.timed ? ` · ${E(fmtTime(a.t))}` : ''}</label><input id="rdP${i}" name="p${i}" type="number" step="0.01" value="${a.p.toFixed(2)}" ${d.locked ? 'disabled' : ''}></div>`;
    const body = `<form id="rdSettings"><div class="form-grid">
      <div class="form-group"><label for="rdColor">Line colour</label><input id="rdColor" name="color" type="color" value="${col}"></div>
      ${hasLine(d) || t.kind === 'free' ? `<div class="form-group"><label for="rdWidth">Line width</label><select id="rdWidth" name="width">${WIDTHS.concat(t.id === 'highlighter' ? [8, 14, 20] : []).map(n => `<option value="${n}" ${(d.width || t.width) === n ? 'selected' : ''}>${n}px</option>`).join('')}</select></div>` : ''}
      ${hasLine(d) ? `<div class="form-group"><label for="rdDash">Line style</label><select id="rdDash" name="dash">${Object.keys(DASHES).map(k => `<option value="${k}" ${(d.dash || 'solid') === k ? 'selected' : ''}>${k}</option>`).join('')}</select></div>` : ''}
      ${fillable(d) ? `<div class="form-group"><label for="rdFill">Fill colour</label><input id="rdFill" name="fillColor" type="color" value="${d.fillColor || col}"></div><div class="form-group"><label><input name="fillOn" type="checkbox" ${d.fillOn === false ? '' : 'checked'}> Fill background</label></div>` : ''}
      ${t.levels ? `<div class="form-group"><label><input name="levelColors" type="checkbox" ${d.levelColors === false ? '' : 'checked'}> Colour each level</label></div>` : ''}
      ${t.line ? `<div class="form-group"><label><input name="extL" type="checkbox" ${(d.ext || t.ext || {}).l ? 'checked' : ''}> Extend left</label></div><div class="form-group"><label><input name="extR" type="checkbox" ${(d.ext || t.ext || {}).r ? 'checked' : ''}> Extend right</label></div>` : ''}
      <div class="form-group full"><label for="rdText">Text</label><input id="rdText" name="text" maxlength="80" value="${E(d.text || '')}" placeholder="Optional label"></div>
      <div class="form-group"><label for="rdTextColor">Text colour</label><input id="rdTextColor" name="textColor" type="color" value="${d.textColor || col}"></div>
      ${t.kind !== 'free' && t.id !== 'regression' ? d.pts.map(pt).join('') : ''}
      </div><p class="news-label">Drawings are saved in this browser only. ${d.locked ? 'Unlock the drawing to change its points.' : ''}</p>
      <div class="head-actions"><button type="button" class="btn" data-action="modal-close">Cancel</button><button type="submit" class="btn primary">Apply</button></div></form>`;
    const dlg = openModal(`${t.name} settings`, body);
    if (typeof bindActions === 'function') bindActions(dlg);
    dlg.querySelector('#rdSettings').onsubmit = ev => {
      ev.preventDefault();
      const f = new FormData(ev.target), v = { color: f.get('color'), text: String(f.get('text') || '').trim(), textColor: f.get('textColor') };
      if (f.has('width')) v.width = Number(f.get('width'));
      if (f.has('dash')) v.dash = f.get('dash');
      if (fillable(d)) { v.fillColor = f.get('fillColor'); v.fillOn = f.has('fillOn'); }
      if (t.line) v.ext = { l: f.has('extL'), r: f.has('extR') };
      if (t.levels) v.levelColors = f.has('levelColors');
      if (!v.text) { delete v.text; delete d.text; }
      mutate(c.key, () => {
        Object.assign(d, v);
        if (!d.locked && t.kind !== 'free' && t.id !== 'regression') d.pts = d.pts.map((a, i) => { const p = Number(f.get(`p${i}`)); return Number.isFinite(p) && p > 0 ? { t: a.t, p } : a; });
      });
      if (typeof closeModal === 'function') closeModal();
      say(`${t.name} updated.`);
    };
  }
  function alertForSel() {
    const s = selected(); if (!s?.d || typeof alertModal !== 'function') return;
    const price = priceNow(s.c, s.d);
    closePop(); alertModal(symbol);
    const inp = doc.querySelector('#alertLevel'); if (inp && Number.isFinite(price)) inp.value = price.toFixed(2);
  }

  function onKey(e) {
    if (!onChart()) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable || doc.querySelector('#modal[open]')) {
      if (e.key === 'Escape' && S.pop && e.target.matches?.('[data-rd-textin]')) { closePop(); e.preventDefault(); e.stopPropagation(); }
      return;
    }
    let done = false;
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.altKey && e.shiftKey && !ctrl && e.code === 'KeyR') { setTool('rect'); done = true; }
    else if (e.altKey && !e.shiftKey && !ctrl && HOTKEYS[e.code]) { setTool(HOTKEYS[e.code]); done = true; }
    else if (e.key === 'Escape') {
      if (S.pop) { closePop(); done = true; }
      else if (S.open) { openMenu(null); done = true; }
      else if (S.draft) { S.draft = null; S.drag = null; schedule(); done = true; }
      else if (S.tool) { setTool(null); done = true; }
      else if (S.sel) { S.sel = null; schedule(); done = true; }
    } else if (e.key === 'Enter' && S.draft && TOOL[S.draft.tool].kind === 'multi') { const c = ctx(); if (c) finishDraft(c); done = true; }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) done = removeSelected();
    else if (ctrl && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z') done = undo();
    else if (ctrl && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'c' && S.sel && !String(root.getSelection?.() || '')) done = copySel();
    else if (ctrl && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'v' && S.clip) done = paste();
    if (done) { e.preventDefault(); e.stopPropagation(); }
  }

  const ACTIONS = '[data-rd-levelcolors],[data-rd-main],[data-rd-more],[data-rd-tool],[data-rd-help],[data-rd-fav],[data-rd-pop],[data-rd-set-color],[data-rd-set-fill],[data-rd-fill-none],[data-rd-set-textcolor],[data-rd-set-width],[data-rd-set-dash],[data-rd-sub],[data-rd-order],[data-rd-vis],[data-rd-clone],[data-rd-copy],[data-rd-hide],[data-rd-lock],[data-rd-settings],[data-rd-alert],[data-rd-delete]';
  function onClick(e) {
    const el = e.target.closest?.(ACTIONS);
    if (!el) {
      if (S.open && !e.target.closest?.('.rd-fly')) openMenu(null);
      if (S.pop && !e.target.closest?.('.rd-pop')) closePop();
      return;
    }
    e.preventDefault(); e.stopPropagation();
    const ds = el.dataset;
    if (ds.rdMain) { const g = ds.rdMain, active = S.tool && TOOL[S.tool].group === g; setTool(active ? null : prefs.lastBy[g]); return; }
    if (ds.rdMore) { openMenu(S.open === ds.rdMore ? null : ds.rdMore); return; }
    if (ds.rdTool) { const fromMenu = !!el.closest('.rd-fly'); setTool(S.tool === ds.rdTool && !fromMenu ? null : ds.rdTool); if (fromMenu) openMenu(null); return; }
    if (ds.rdHelp) { S.help = S.help === ds.rdHelp ? null : ds.rdHelp; paintMenu(); return; }
    if (ds.rdFav) { const i = prefs.favs.indexOf(ds.rdFav); if (i >= 0) prefs.favs.splice(i, 1); else prefs.favs.push(ds.rdFav); savePrefs(); paintMenu(); schedule(); return; }
    if (ds.rdPop) { openPop(ds.rdPop); return; }
    if (ds.rdSub) { S.pop.sub = S.pop.sub === ds.rdSub ? null : ds.rdSub; paintPop(); return; }
    const s = selected(); if (!s?.d) return;
    const { c, d } = s;
    if (ds.rdSetColor) { const v = { color: ds.rdSetColor }; if (TOOL[d.tool].levels) v.levelColors = false; edit(v); rememberStyle(d, v); return; }
    if ('rdLevelcolors' in ds) { const v = { levelColors: true }; edit(v); rememberStyle(d, v); return; }
    if (ds.rdSetFill) { edit({ fillColor: ds.rdSetFill, fillOn: true }); rememberStyle(d, { fillColor: ds.rdSetFill, fillOn: true }); return; }
    if ('rdFillNone' in ds) { edit({ fillOn: false }); rememberStyle(d, { fillOn: false }); return; }
    if (ds.rdSetTextcolor) { edit({ textColor: ds.rdSetTextcolor }); return; }
    if (ds.rdSetWidth) { edit({ width: Number(ds.rdSetWidth) }); rememberStyle(d, { width: Number(ds.rdSetWidth) }); closePop(); return; }
    if (ds.rdSetDash) { edit({ dash: ds.rdSetDash }); rememberStyle(d, { dash: ds.rdSetDash }); closePop(); return; }
    if (ds.rdOrder) { mutate(c.key, l => { const out = reorder(l, d.id, ds.rdOrder); l.splice(0, l.length, ...out); }); closePop(); return; }
    if (ds.rdVis) { edit({ vis: ds.rdVis === 'all' ? { mode: 'all' } : { mode: ds.rdVis, tf: curTf() } }); closePop(); return; }
    if ('rdClone' in ds) { const n = duplicate(c, d, 3); mutate(c.key, l => l.splice(l.indexOf(d) + 1, 0, n)); S.sel = n.id; closePop(); return; }
    if ('rdCopy' in ds) { copySel(); closePop(); return; }
    if ('rdHide' in ds) { edit({ hidden: true }); S.sel = null; closePop(); say('Drawing hidden · show it again from the Drawing manager.'); return; }
    if ('rdLock' in ds) { edit({ locked: !d.locked }); return; }
    if ('rdSettings' in ds) { settingsModal(); return; }
    if ('rdAlert' in ds) { alertForSel(); return; }
    if ('rdDelete' in ds) removeSelected();
  }
  // Text popover: live label while typing, one undo step per edit session.
  doc.addEventListener('focusin', e => { if (e.target.matches?.('[data-rd-textin]')) { const s = selected(); if (s?.d) snapshot(s.c.key); } });
  doc.addEventListener('input', e => {
    if (!e.target.matches?.('[data-rd-textin]')) return;
    const s = selected(); if (!s?.d) return;
    const v = e.target.value.trim();
    if (v) s.d.text = v; else delete s.d.text;
    persist(s.c.key); schedule();
  });
  doc.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches?.('[data-rd-textin]')) { e.preventDefault(); closePop(); } });
  doc.addEventListener('input', e => {
    if (!e.target.matches?.('[data-rd-custom="color"]')) return;
    const s = selected(); if (!s?.d) return;
    s.d.color = e.target.value; if (TOOL[s.d.tool].levels) s.d.levelColors = false;
    persist(s.c.key); schedule();
  });
  doc.addEventListener('focusin', e => { if (e.target.matches?.('[data-rd-custom="color"]')) { const s = selected(); if (s?.d) snapshot(s.c.key); } });
  doc.addEventListener('change', e => { if (e.target.matches?.('[data-rd-custom="color"]')) { const s = selected(); if (s?.d) rememberStyle(s.d, { color: e.target.value }); } });
  doc.addEventListener('pointerover', e => { const r = e.target.closest?.('.rd-pop [data-rd-sub]'); if (r && S.pop && S.pop.sub !== r.dataset.rdSub) { S.pop.sub = r.dataset.rdSub; paintPop(); } });

  // Window capture runs before chart-interact.js's document capture handlers, so a press that
  // draws or edits a drawing never also pans the chart or opens the "add price level" dialog.
  root.addEventListener('pointerdown', onDown, true);
  root.addEventListener('pointermove', onMove, true);
  root.addEventListener('pointerup', onUp, true);
  root.addEventListener('pointercancel', () => { S.drag = null; S.barDrag = null; if (S.draft && TOOL[S.draft.tool].kind === 'free') S.draft = null; schedule(); }, true);
  root.addEventListener('dblclick', onDbl, true);
  root.addEventListener('keydown', onKey, true);
  root.addEventListener('click', onClick, true);
  root.addEventListener('resize', () => { closePop(); schedule(); });
  root.addEventListener('scroll', () => { if (S.pop) paintPop(); if (S.open) paintMenu(); }, true);
  root.addEventListener('hashchange', () => { if (!onChart()) { S.tool = null; S.draft = null; S.sel = null; closeMenu(); closePop(); } schedule(); });

  // Redraw whenever the page or the price svg is rebuilt (render(), pan/zoom, live ticks).
  const watch = new MutationObserver(recs => {
    for (const r of recs) {
      const t = r.target;
      if (t.closest?.('.rd-layer,.rd-fly,.rd-pop')) continue;
      if (t.id === 'app' || t.classList?.contains('chart-frame') || [...r.addedNodes].some(n => n.nodeType === 1 && (n.matches?.('.chart-frame,.shell,main,svg') || n.querySelector?.('.chart-frame')))) { schedule(); return; }
    }
  });
  const app = doc.getElementById('app');
  if (app) watch.observe(app, { childList: true, subtree: true });
  if (root.ResizeObserver) { const ro = new ResizeObserver(schedule); root.setInterval(() => { const f = frameEl(); if (f && !f.dataset.rdRo) { f.dataset.rdRo = '1'; ro.observe(f); } }, 1000); }

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
            say('Drawings cleared.');
          });
          return;
        }
      }
      return before.apply(this, arguments);
    };
  }
  // Drawing manager lists the drawings next to the price levels, with show / hide and delete.
  if (typeof levelsModal === 'function') {
    const baseLevels = levelsModal;
    levelsModal = function () {
      const out = baseLevels.apply(this, arguments);
      const c = ctx(), items = c ? store[c.key] || [] : [], body = doc.querySelector('#modal .modal-body') || doc.querySelector('#modal');
      if (body && items.length) {
        const row = d => `<div class="drawing-row${d.hidden ? ' rd-hidden-row' : ''}"><span style="color:${d.color || TOOL[d.tool].color}">${ico(d.tool, 18)}</span><div><strong>${TOOL[d.tool]?.name || E(d.tool)}${d.text ? ` · ${E(d.text)}` : ''}</strong><small>${d.pts.length} point${d.pts.length === 1 ? '' : 's'}${d.hidden ? ' · hidden' : !visibleOn(d.vis, curTf()) ? ' · not shown on this interval' : ''}${d.locked ? ' · locked' : ''}</small></div><button class="btn small" type="button" data-rd-mvis="${d.id}">${d.hidden ? 'Show' : 'Hide'}</button><button class="btn small" type="button" data-rd-mdel="${d.id}">Delete</button></div>`;
        body.insertAdjacentHTML('beforeend', `<div class="rd-manager"><div class="rd-sec">DRAWINGS · ${items.length}</div>${items.map(row).join('')}</div>`);
        body.querySelectorAll('[data-rd-mdel]').forEach(b => b.onclick = () => { const id = b.dataset.rdMdel; mutate(c.key, l => { const i = l.findIndex(x => x.id === id); if (i >= 0) l.splice(i, 1); }); b.closest('.drawing-row').remove(); });
        body.querySelectorAll('[data-rd-mvis]').forEach(b => b.onclick = () => { const d = list(c.key).find(x => x.id === b.dataset.rdMvis); if (!d) return; mutate(c.key, () => { if (d.hidden) delete d.hidden; else d.hidden = true; }); b.textContent = d.hidden ? 'Show' : 'Hide'; b.closest('.drawing-row').classList.toggle('rd-hidden-row', !!d.hidden); });
      }
      return out;
    };
  }

  root.redlineDrawings = { tools: TOOLS, setTool, get state() { return { tool: S.tool, selected: S.sel, drafting: !!S.draft, pop: S.pop?.kind || null, menu: S.open }; }, list: () => { const c = ctx(); return c ? JSON.parse(JSON.stringify(store[c.key] || [])) : []; }, undo, redraw: schedule };
  schedule();
})(typeof window !== 'undefined' ? window : null);
