// Unit tests for the pure geometry in chart-drawings.js. Run: npm test (node:test, no dependencies).
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../chart-drawings.js');

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);
const P = (x, y) => ({ x, y });

test('tool catalogue matches the client menu (16 tools, three sections, in order)', () => {
  assert.deepEqual(D.TOOLS.map(t => t.name), ['Brush', 'Highlighter', 'Arrow marker', 'Arrow', 'Arrow mark up', 'Arrow mark down', 'Rectangle', 'Rotated rectangle', 'Path', 'Circle', 'Ellipse', 'Polyline', 'Triangle', 'Arc', 'Curve', 'Double curve']);
  assert.deepEqual([...new Set(D.TOOLS.map(t => t.section))], ['Brushes', 'Arrows', 'Shapes']);
  assert.equal(D.TOOL.rect.key, 'Alt + Shift + R');
  for (const t of D.TOOLS) {
    assert.ok(['free', 'mark', 'n', 'multi'].includes(t.kind), t.id);
    assert.match(t.color, /^#[0-9a-f]{6}$/i, t.id);
    assert.ok(t.help && t.help.length > 10, `${t.id} has help text`);
    if (t.kind === 'n') assert.ok(t.n >= 2, t.id);
  }
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
  const full = { brush: 4, highlighter: 4, arrowMarker: 2, arrow: 2, arrowUp: 1, arrowDown: 1, rect: 2, rotRect: 3, path: 4, circle: 2, ellipse: 2, polyline: 4, triangle: 3, arc: 3, curve: 3, doubleCurve: 3 };
  const pts = [P(10, 10), P(80, 40), P(40, 90), P(120, 60)];
  for (const [id, n] of Object.entries(full)) {
    const els = D.geometry(id, pts.slice(0, n), { width: 2 });
    assert.ok(els.length >= 1, `${id} draws`);
    for (const [tag, attrs, paint] of els) {
      assert.match(tag, /^(polyline|polygon|line|rect|circle|ellipse|path)$/, id);
      assert.ok(['stroke', 'fill', 'both'].includes(paint), id);
      for (const v of Object.values(attrs)) assert.doesNotMatch(String(v), /NaN|undefined|Infinity/, `${id} attrs are finite`);
    }
    if (n > 1) assert.ok(D.geometry(id, pts.slice(0, n - 1), { width: 2 }).length >= 1, `${id} preview with ${n - 1} point(s)`);
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
  assert.deepEqual(D.geometry('rect', []), []);
});
