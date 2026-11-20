// Unit tests for the pure geometry in chart-drawings.js. Run: npm test (node:test, no dependencies).
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../chart-drawings.js');

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);
const P = (x, y) => ({ x, y });

test('tool catalogue matches the client menus (two rail groups, sections and order)', () => {
  const names = g => D.TOOLS.filter(t => t.group === g).map(t => t.name);
  assert.deepEqual(names('lines'), ['Trendline', 'Ray', 'Info line', 'Extended line', 'Trend angle', 'Horizontal line', 'Horizontal ray', 'Vertical line', 'Crossline', 'Parallel channel', 'Regression trend', 'Flat top/bottom', 'Disjoint channel', 'Pitchfork', 'Schiff pitchfork', 'Modified Schiff pitchfork', 'Inside pitchfork']);
  assert.deepEqual(names('fib'), ['Fib retracement', 'Trend-based fib extension', 'Fib channel', 'Fib time zone', 'Fib speed resistance fan', 'Trend-based fib time', 'Fib circles', 'Fib spiral', 'Fib speed resistance arcs', 'Fib wedge', 'Pitchfan', 'Gann box', 'Gann square fixed', 'Gann square', 'Gann fan']);
  assert.deepEqual([...new Set(D.TOOLS.filter(t => t.group === 'fib').map(t => t.section))], ['Fibonacci', 'Gann']);
  assert.deepEqual(D.GROUPS.map(g => g.id), ['lines', 'fib', 'draw']);
  assert.deepEqual(names('draw'), ['Brush', 'Highlighter', 'Arrow marker', 'Arrow', 'Arrow mark up', 'Arrow mark down', 'Rectangle', 'Rotated rectangle', 'Path', 'Circle', 'Ellipse', 'Polyline', 'Triangle', 'Arc', 'Curve', 'Double curve']);
  assert.deepEqual([...new Set(D.TOOLS.filter(t => t.group === 'lines').map(t => t.section))], ['Lines', 'Channels', 'Pitchforks']);
  assert.deepEqual([...new Set(D.TOOLS.filter(t => t.group === 'draw').map(t => t.section))], ['Brushes', 'Arrows', 'Shapes']);
  assert.deepEqual(Object.fromEntries(D.TOOLS.filter(t => t.key).map(t => [t.id, t.key])), { trendline: 'Alt + T', hline: 'Alt + H', hray: 'Alt + J', vline: 'Alt + V', crossline: 'Alt + C', fibRetracement: 'Alt + F', rect: 'Alt + Shift + R' });
  assert.equal(new Set(D.TOOLS.map(t => t.id)).size, D.TOOLS.length, 'ids are unique');
  for (const t of D.TOOLS) {
    assert.ok(['free', 'mark', 'n', 'multi'].includes(t.kind), t.id);
    assert.ok(D.GROUPS.some(g => g.id === t.group), t.id);
    assert.match(t.color, /^#[0-9a-f]{6}$/i, t.id);
    assert.ok(t.help && t.help.length > 10, `${t.id} has help text`);
    if (t.kind === 'n') assert.ok(t.n >= 2, t.id);
  }
});

const BOX = { x0: 0, y0: 0, x1: 400, y1: 300 };

test('extend reaches the box edge along the ray and never stops short of b', () => {
  near(D.extend(P(100, 100), P(200, 100), BOX).x, 400);
  const e = D.extend(P(100, 100), P(150, 50), BOX); near(e.x, 200); near(e.y, 0);
  assert.deepEqual(D.extend(P(10, 10), P(10, 10), BOX), P(10, 10));
  assert.deepEqual(D.extend(P(0, 0), P(500, 0), BOX), P(500, 0), 'b outside the box is kept');
  const [l, r] = D.lineEnds(P(100, 150), P(200, 150), BOX, { l: true, r: true }); near(l.x, 0); near(r.x, 400);
  assert.deepEqual(D.lineEnds(P(1, 2), P(3, 4), BOX), [P(1, 2), P(3, 4)]);
});

test('regression fits a straight series exactly and measures scatter', () => {
  const f = D.regression([10, 12, 14, 16, 18]); near(f.slope, 2); near(f.intercept, 10); near(f.sd, 0);
  const g = D.regression([1, 3, 1, 3]); near(g.slope, 0.4); near(g.sd, Math.sqrt(0.8));
  assert.equal(D.regression([5]), null);
  near(D.regression([7, 7, 7]).slope, 0);
});

test('parallel channel line keeps the slope and passes through the third point', () => {
  const [a2, b2] = D.parallel(P(0, 100), P(100, 50), P(50, 120));
  near((b2.y - a2.y) / (b2.x - a2.x), -0.5);
  near(a2.y + (50 - a2.x) * -0.5, 120);
  const [v1, v2] = D.parallel(P(10, 0), P(10, 100), P(30, 40)); near(v1.x, 30); near(v2.x, 30);
});

test('pitchfork variants: median through the middle of the reaction points, origin per style', () => {
  const A = P(0, 200), B = P(100, 100), C = P(120, 220), M = P(110, 160);
  const pf = D.pitchfork('pitchfork', A, B, C, BOX);
  assert.deepEqual(pf.origin, A);
  const cross = (o, e, q) => (e.x - o.x) * (q.y - o.y) - (e.y - o.y) * (q.x - o.x);
  near(cross(pf.median[0], pf.median[1], M), 0, 1e-6);
  near(pf.median[1].x, 400, 1e-6);
  const slope = sg => (sg[1].y - sg[0].y) / (sg[1].x - sg[0].x);
  near(slope(pf.t1), slope(pf.median)); near(slope(pf.t2), slope(pf.median));
  assert.deepEqual(pf.t1[0], B); assert.deepEqual(pf.t2[0], C);
  assert.deepEqual(D.pitchfork('schiff', A, B, C, BOX).origin, P(0, 150));
  assert.deepEqual(D.pitchfork('modSchiff', A, B, C, BOX).origin, P(50, 150));
  const ins = D.pitchfork('insidePitchfork', A, B, C, BOX);
  assert.deepEqual(ins.t1[0], P(105, 130)); assert.deepEqual(ins.t2[0], P(115, 190));
});

test('angleDeg is screen-up positive', () => {
  near(D.angleDeg(P(0, 0), P(10, -10)), 45); near(D.angleDeg(P(0, 0), P(10, 10)), -45); near(D.angleDeg(P(0, 0), P(10, 0)), 0);
});

test('visibility on intervals', () => {
  assert.equal(D.visibleOn(undefined, '1h'), true);
  assert.equal(D.visibleOn({ mode: 'all' }, '1m'), true);
  const v = m => ({ mode: m, tf: '1h' });
  assert.deepEqual(D.TFS.map(t => D.visibleOn(v('above'), t)), [false, false, false, false, true, true, true]);
  assert.deepEqual(D.TFS.map(t => D.visibleOn(v('below'), t)), [true, true, true, true, true, false, false]);
  assert.deepEqual(D.TFS.map(t => D.visibleOn(v('only'), t)), [false, false, false, false, true, false, false]);
  assert.equal(D.visibleOn({ mode: 'only', tf: '2h' }, '1h'), true, 'unknown interval never hides');
});

test('visual order moves one drawing and keeps the rest', () => {
  const L = ['a', 'b', 'c', 'd'].map(id => ({ id })), ids = l => l.map(x => x.id).join('');
  assert.equal(ids(D.reorder(L, 'b', 'front')), 'acdb');
  assert.equal(ids(D.reorder(L, 'c', 'back')), 'cabd');
  assert.equal(ids(D.reorder(L, 'b', 'forward')), 'acbd');
  assert.equal(ids(D.reorder(L, 'c', 'backward')), 'acbd');
  assert.equal(ids(D.reorder(L, 'd', 'forward')), 'abcd');
  assert.equal(ids(D.reorder(L, 'a', 'backward')), 'abcd');
  assert.equal(ids(D.reorder(L, 'zz', 'front')), 'abcd');
  assert.equal(ids(L), 'abcd', 'input is not mutated');
});

test('timeMap: exact bars, interpolation, gaps and extrapolation round-trip', () => {
  const T = [1000, 1600, 2200, 5000, 5600];          // a gap between bar 2 and 3 (e.g. overnight)
  const m = D.timeMap(T);
  T.forEach((t, i) => { near(m.kToT(i), t); near(m.tToK(t), i); });
  near(m.kToT(2.5), 3600); near(m.tToK(3600), 2.5);   // halfway inside the gap
  near(m.kToT(6), 6800); near(m.tToK(6200), 5);        // right of the last bar uses the last interval
  near(m.kToT(-1), 400); near(m.tToK(100), -1.5);      // left of the first bar uses the first interval
  for (const k of [-3.2, 0, 0.4, 1.99, 3.3, 4, 9.75]) near(m.tToK(m.kToT(k)), k, 1e-9);
});

test('timeMap: degenerate series do not throw', () => {
  near(D.timeMap([]).kToT(3), 3);
  near(D.timeMap([50]).tToK(53), 3);
  const flat = D.timeMap([10, 10, 10]);               // equal timestamps: step falls back to 1
  assert.ok(Number.isFinite(flat.tToK(12)) && Number.isFinite(flat.kToT(5)));
});

test('arrowHead tip sits on the end point and the head is symmetric', () => {
  const [tip, l, r] = D.arrowHead(P(0, 0), P(100, 0), 10);
  assert.deepEqual(tip, P(100, 0));
  near(l.x, 90); near(r.x, 90); near(l.y, -r.y); near(Math.abs(l.y), 5.5);
});

test('fatArrow is a closed 7-point outline with its tip at the end point', () => {
  const poly = D.fatArrow(P(0, 0), P(0, 100), 2);
  assert.equal(poly.length, 7);
  assert.deepEqual(poly[3], P(0, 100));
  near(poly[2].y, poly[4].y); near(poly[2].x, -poly[4].x);
});

test('rotRect keeps a-b as one side and is a true rectangle', () => {
  const [a, b, c, d] = D.rotRect(P(0, 0), P(10, 10), P(0, 20));
  assert.deepEqual([a, b], [P(0, 0), P(10, 10)]);
  const dot = (u, v) => u.x * v.x + u.y * v.y, vec = (p, q) => P(q.x - p.x, q.y - p.y);
  near(dot(vec(a, b), vec(b, c)), 0); near(dot(vec(b, c), vec(c, d)), 0);
  near(D.dist(a, d), D.dist(b, c));
  near(D.dist(a, d), Math.SQRT2 * 10);                // distance of (0,20) from the line y = x
});

test('quadControl makes the curve pass through the bend point at t = 0.5', () => {
  const a = P(0, 0), b = P(100, 0), m = P(50, -40), c = D.quadControl(a, b, m);
  const at = t => P((1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y);
  near(at(0.5).x, 50); near(at(0.5).y, -40);
});

test('sCurve first bend peaks at the chosen height and the second mirrors it', () => {
  const a = P(0, 0), b = P(300, 0), m = P(60, -30), { c1, c2 } = D.sCurve(a, b, m);
  const at = t => (1 - t) ** 3 * a.y + 3 * (1 - t) ** 2 * t * c1.y + 3 * (1 - t) * t * t * c2.y + t ** 3 * b.y;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i <= 1000; i++) { const y = at(i / 1000); lo = Math.min(lo, y); hi = Math.max(hi, y); }
  near(lo, -30, 0.05); near(hi, 30, 0.05);
});

test('simplify drops near-duplicate freehand points but keeps both ends', () => {
  const pts = [P(0, 0), P(0.5, 0), P(1, 0), P(5, 0), P(5.2, 0), P(9, 0), P(9.1, 0)];
  const out = D.simplify(pts, 2);
  assert.deepEqual(out[0], P(0, 0)); assert.deepEqual(out.at(-1), P(9.1, 0));
  assert.deepEqual(out.map(p => p.x), [0, 5, 9, 9.1]);
  assert.deepEqual(D.simplify([P(1, 1), P(1, 1)], 5), [P(1, 1), P(1, 1)]);
});

test('geometry renders every tool with complete points and degrades gracefully with fewer', () => {
  const full = { fibRetracement: 2, trendFibExtension: 3, fibChannel: 3, fibTimeZone: 2, fibSpeedFan: 2, trendFibTime: 3, fibCircles: 2, fibSpiral: 2, fibSpeedArcs: 2, fibWedge: 3, pitchfan: 3, gannBox: 2, gannSquareFixed: 2, gannSquare: 2, gannFan: 2, trendline: 2, ray: 2, infoLine: 2, extendedLine: 2, trendAngle: 2, hline: 1, hray: 1, vline: 1, crossline: 1, parallelChannel: 3, regression: 2, flatTopBottom: 3, disjointChannel: 3, pitchfork: 3, schiff: 3, modSchiff: 3, insidePitchfork: 3, brush: 4, highlighter: 4, arrowMarker: 2, arrow: 2, arrowUp: 1, arrowDown: 1, rect: 2, rotRect: 3, path: 4, circle: 2, ellipse: 2, polyline: 4, triangle: 3, arc: 3, curve: 3, doubleCurve: 3 };
  const pts = [P(10, 10), P(80, 40), P(40, 90), P(120, 60)];
  for (const [id, n] of Object.entries(full)) {
    const els = D.geometry(id, pts.slice(0, n), { width: 2, box: BOX, info: ['+1.00 (0.10%)', '3 bars', '12.0°'], priceText: '7400.00', timeText: 'Nov 19, 06:30' });
    assert.ok(els.length >= 1, `${id} draws`);
    for (const [tag, attrs, paint] of els) {
      assert.match(tag, /^(polyline|polygon|line|rect|circle|ellipse|path|text)$/, id);
      assert.ok(['stroke', 'fill', 'both', 'area', 'guide', 'label', 'axis', 'axistext', 'info', 'infotext', 'lvl', 'lvlfill', 'lvltext'].includes(paint), id);
      for (const v of Object.values(attrs)) assert.doesNotMatch(String(v), /NaN|undefined|Infinity/, `${id} attrs are finite`);
    }
    if (n > 1) assert.ok(D.geometry(id, pts.slice(0, n - 1), { width: 2, box: BOX }).length >= 1, `${id} preview with ${n - 1} point(s)`);
  }
  assert.equal(D.geometry('rect', pts.slice(0, 2))[0][1].width, 70);
  assert.equal(D.geometry('circle', [P(0, 0), P(3, 4)])[0][1].r, 5);
  assert.equal(D.geometry('polyline', pts, { closed: true })[0][0], 'polygon');
  assert.equal(D.geometry('polyline', pts)[0][0], 'polyline');
  assert.equal(D.geometry('path', pts).length, 2, 'path has an arrow head');
  assert.match(D.geometry('arc', pts.slice(0, 3))[0][1].d, / Z$/, 'arc is closed by its chord');
  assert.doesNotMatch(D.geometry('curve', pts.slice(0, 3))[0][1].d, / Z$/, 'curve is open');
  const up = D.geometry('arrowUp', [P(50, 50)])[0][1].points.split(' ').map(s => s.split(',').map(Number));
  assert.deepEqual(up[0], [50, 50]); assert.ok(up.slice(1).every(([, y]) => y >= 50), 'up arrow body sits below its tip');
  const down = D.geometry('arrowDown', [P(50, 50)])[0][1].points.split(' ').map(s => s.split(',').map(Number));
  assert.ok(down.slice(1).every(([, y]) => y <= 50), 'down arrow body sits above its tip');
  assert.deepEqual(D.geometry('nope', pts), []);
  const hl = D.geometry('hline', [P(50, 80)], { box: BOX, priceText: '7400.00' });
  assert.deepEqual([hl[0][1].x1, hl[0][1].x2, hl[0][1].y1], [0, 400, 80], 'horizontal line spans the plot');
  assert.equal(hl.find(e => e[2] === 'axistext')[3], '7400.00', 'price tag on the axis');
  assert.equal(D.geometry('hray', [P(50, 80)], { box: BOX })[0][1].x1, 50, 'horizontal ray starts at its point');
  const vl = D.geometry('vline', [P(50, 80)], { box: BOX, timeText: 'Nov 19' });
  assert.deepEqual([vl[0][1].y1, vl[0][1].y2], [0, 300]); assert.ok(vl.some(e => e[3] === 'Nov 19'));
  assert.equal(D.geometry('crossline', [P(50, 80)], { box: BOX }).filter(e => e[0] === 'line').length, 2);
  assert.equal(D.geometry('extendedLine', [P(100, 150), P(200, 150)], { box: BOX })[0][1].x1, 0);
  assert.equal(D.geometry('ray', [P(100, 150), P(200, 150)], { box: BOX })[0][1].x2, 400);
  assert.equal(D.geometry('trendline', [P(100, 150), P(200, 150)], { box: BOX })[0][1].x2, 200);
  assert.equal(D.geometry('trendline', [P(100, 150), P(200, 150)], { box: BOX, ext: { r: true } })[0][1].x2, 400, 'extend right from settings');
  assert.match(D.geometry('trendAngle', [P(0, 100), P(100, 0)], { box: BOX }).find(e => e[2] === 'label')[3], /^45\.0°$/);
  assert.equal(D.geometry('infoLine', [P(10, 10), P(80, 40)], { box: BOX, info: ['a', 'b', 'c'] }).filter(e => e[2] === 'infotext').length, 3);
  assert.equal(D.geometry('regression', [P(0, 0), P(10, 10)], { box: BOX })[0][2], 'guide', 'no bars in range: dashed placeholder');
  assert.deepEqual(D.geometry('rect', []), []);
});

test('fib retracement and extension prices', () => {
  // move from 100 (start) up to 200 (end): 0 = 200, 0.618 = 138.2, 1 = 100
  near(D.fibPrice(100, 200, 0), 200); near(D.fibPrice(100, 200, 0.618), 138.2); near(D.fibPrice(100, 200, 1), 100); near(D.fibPrice(100, 200, 1.618), 38.2);
  // extension of the 100→200 move from a pullback at 150: 1 = 250, 1.618 = 311.8
  near(D.fibExtPrice(100, 200, 150, 1), 250); near(D.fibExtPrice(100, 200, 150, 1.618), 311.8); near(D.fibExtPrice(100, 200, 150, 0), 150);
  assert.deepEqual(D.FIB, [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618]);
});

test('fib retracement geometry: one line per level, labels carry the level price', () => {
  const els = D.geometry('fibRetracement', [P(10, 200), P(110, 100)], { box: BOX, prices: [100, 200] });
  const lines = els.filter(e => e[2] === 'lvl'), labels = els.filter(e => e[2] === 'lvltext').map(e => e[3]);
  assert.equal(lines.length, D.FIB.length);
  near(lines[0][1].y1, 100); near(lines[6][1].y1, 200);            // level 0 at the end point, 1 at the start
  near(lines[4][1].y1, 100 + 100 * 0.618, 0.05);
  assert.equal(labels[4], '0.618 (138.20)');
  assert.equal(els.filter(e => e[2] === 'lvlfill').length, D.FIB.length - 1, 'a band between each pair of levels');
  const ext = D.geometry('fibRetracement', [P(10, 200), P(110, 100)], { box: BOX, prices: [100, 200], ext: { r: true } }).filter(e => e[2] === 'lvl');
  assert.equal(ext[0][1].x2, 400, 'extend right reaches the chart edge');
});

test('fib time zones fall on Fibonacci numbers of the unit', () => {
  assert.deepEqual(D.timeZones(0, 10, 0, 400).map(z => z.n), [0, 1, 2, 3, 5, 8, 13, 21, 34]);
  assert.deepEqual(D.timeZones(0, 10, 0, 400).map(z => z.x), [0, 10, 20, 30, 50, 80, 130, 210, 340]);
  assert.deepEqual(D.timeZones(5, 0, 0, 400), [], 'zero unit draws nothing');
  const els = D.geometry('fibTimeZone', [P(0, 50), P(10, 50)], { box: BOX });
  assert.equal(els.filter(e => e[2] === 'lvl').length, 9);
});

test('golden spiral passes through the start point and grows by φ per quarter turn', () => {
  const sp = D.spiral(P(0, 0), P(10, 0), 1000);
  assert.ok(sp.some(q => Math.abs(q.x - 10) < 1e-9 && Math.abs(q.y) < 1e-9), 'passes through b');
  const r = q => Math.hypot(q.x, q.y), i = sp.findIndex(q => Math.abs(q.x - 10) < 1e-9 && Math.abs(q.y) < 1e-9);
  near(r(sp[i + 12]) / r(sp[i]), D.PHI, 1e-9);                     // 12 steps of π/24 = a quarter turn
  assert.ok(r(sp.at(-1)) > 1000, 'runs until it leaves the chart');
  assert.deepEqual(D.spiral(P(1, 1), P(1, 1), 100), []);
});

test('gann fan slopes and fixed square', () => {
  const one = D.gannDir(10, -10, 1, 1), two = D.gannDir(10, -10, 2, 1), half = D.gannDir(10, -10, 1, 2);
  near(one.y / one.x, -1); near(two.y / two.x, -2); near(half.y / half.x, -0.5);
  const els = D.geometry('gannFan', [P(0, 300), P(50, 250)], { box: BOX });
  assert.deepEqual(els.filter(e => e[2] === 'lvltext').map(e => e[3]), ['1x8', '1x4', '1x3', '1x2', '1x1', '2x1', '3x1', '4x1', '8x1']);
  const c = D.gannSquareCorner(P(10, 10), P(60, 30)); assert.deepEqual(c, P(60, 60));
  const c2 = D.gannSquareCorner(P(10, 10), P(-20, 90)); assert.deepEqual(c2, P(-70, 90));
  const sq = D.geometry('gannSquareFixed', [P(10, 10), P(60, 30)], { box: BOX })[0][1];
  assert.equal(sq.width, sq.height, 'fixed square stays square');
  const box = D.geometry('gannBox', [P(0, 0), P(100, 50)], { box: BOX });
  assert.equal(box.filter(e => e[2] === 'lvl').length, 14, '7 price + 7 time levels');
});

test('pitchfan median goes through the middle of the reaction points', () => {
  const els = D.geometry('pitchfan', [P(0, 150), P(100, 100), P(100, 200)], { box: BOX }).filter(e => e[2] === 'lvl');
  assert.equal(els.length, 7);
  const med = els[3][1]; near((med.y2 - 150) / (med.x2 - 0), 0, 1e-9);
});
