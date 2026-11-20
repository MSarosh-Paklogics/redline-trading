// Playwright QA for chart drawing tools (chart-drawings.js). Needs a running dev server (npm run dev)
// and Playwright installed outside the project:  node qa-drawings.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } }), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto('http://127.0.0.1:4173/?qa=drawings#/chart?symbol=ES&tf=10m');
  await p.waitForSelector('.chart-frame .rd-layer');
  await p.evaluate(() => { localStorage.removeItem('redline-drawings-v1'); localStorage.removeItem('redline-drawing-prefs-v1'); });
  await p.reload(); await p.waitForSelector('.chart-frame .rd-layer');
  await p.locator('.chart-frame').scrollIntoViewIfNeeded();
  const box = await p.locator('.chart-frame').boundingBox();
  const at = (x, y) => [box.x + x, box.y + y];
  const click = async (x, y) => { await p.mouse.click(...at(x, y)); };
  const drag = async (a, z) => { await p.mouse.move(...at(...a)); await p.mouse.down(); await p.mouse.move(...at((a[0] + z[0]) / 2, (a[1] + z[1]) / 2)); await p.mouse.move(...at(...z)); await p.mouse.up(); };
  const pick = async id => { await p.locator('[data-rd-more]').click(); await p.locator(`.rd-fly [data-rd-tool="${id}"]`).click(); };
  const list = () => p.evaluate(() => redlineDrawings.list());

  // menu matches the client: 3 sections, 16 tools, ? and star on each
  await p.locator('[data-rd-more]').click();
  assert.deepEqual(await p.locator('.rd-fly .rd-sec').allTextContents(), ['BRUSHES', 'ARROWS', 'SHAPES']);
  assert.equal(await p.locator('.rd-fly .rd-pick').count(), 16);
  assert.equal(await p.locator('.rd-fly .rd-q').count(), 16);
  assert.equal(await p.locator('.rd-fly .rd-star').count(), 16);
  await p.keyboard.press('Escape');

  const start = await p.evaluate(() => ({ off: chartOffset, ys: redlineChartView.yShift }));
  const plan = [
    ['brush', 1, async () => drag([100, 150], [220, 170])],
    ['highlighter', 1, async () => drag([100, 250], [300, 252])],
    ['arrowMarker', 2, async () => drag([300, 150], [380, 120])],
    ['arrow', 2, async () => { await click(400, 150); await click(460, 100); }],
    ['arrowUp', 1, async () => click(500, 300)],
    ['arrowDown', 1, async () => click(540, 120)],
    ['rect', 2, async () => drag([100, 350], [200, 420])],
    ['rotRect', 3, async () => { await click(250, 350); await click(330, 330); await click(320, 400); }],
    ['path', 4, async () => { await click(380, 350); await click(420, 320); await click(460, 370); await p.mouse.dblclick(...at(500, 330)); }],
    ['circle', 2, async () => { await click(600, 200); await click(640, 230); }],
    ['ellipse', 2, async () => drag([680, 150], [780, 210])],
    ['polyline', 4, async () => { await click(600, 350); await click(650, 330); await click(690, 390); await click(620, 420); await click(601, 351); }],
    ['triangle', 3, async () => { await click(720, 350); await click(780, 330); await click(760, 420); }],
    ['arc', 3, async () => { await click(100, 480); await click(220, 480); await click(160, 440); }],
    ['curve', 3, async () => { await click(260, 480); await click(380, 470); await click(320, 430); }],
    ['doubleCurve', 3, async () => { await click(420, 480); await click(600, 480); await click(460, 450); }]
  ];
  for (const [id, n, run] of plan) {
    const before = (await list()).length;
    await pick(id); await run(); await p.waitForTimeout(60);
    const l = await list(), d = l.at(-1);
    assert.equal(l.length, before + 1, `${id} adds one drawing`);
    assert.equal(d.tool, id);
    if (id === 'brush' || id === 'highlighter') assert.ok(d.pts.length >= 2, id); else assert.equal(d.pts.length, n, `${id} points`);
    assert.equal(await p.evaluate(() => redlineDrawings.state.tool), null, `${id} returns to cursor`);
    assert.equal(await p.locator(`.rd-svg g.rd-shape[data-tool="${id}"]`).count(), 1, `${id} rendered`);
  }
  assert.equal((await list()).find(d => d.tool === 'polyline').closed, true, 'clicking the first point closes a polyline');
  assert.deepEqual(await p.evaluate(() => ({ off: chartOffset, ys: redlineChartView.yShift })), start, 'drawing never pans the chart');
  assert.equal(await p.locator('#modal[open]').count(), 0, 'double-click while drawing does not open the price-level dialog');

  // pan keeps drawings on their candles
  const tip = () => p.evaluate(() => document.querySelector('g[data-tool="arrowUp"] polygon').getAttribute('points').split(' ')[0].split(',').map(Number));
  const [x0] = await tip();
  await p.evaluate(() => { chartOffset += 10; document.querySelector('.chart-frame>svg').outerHTML = chartSVG(); });
  await p.waitForTimeout(60);
  const [x1] = await tip(), barPx = await p.evaluate(() => chartGeometry().dx / 900 * document.querySelector('.chart-frame').clientWidth);
  assert.ok(Math.abs(x1 - x0 - 10 * barPx) < 0.6, 'pan moves the drawing with its bars');
  await p.evaluate(() => { chartOffset = 0; render(); });

  // select, recolour, delete, undo
  await p.keyboard.press('Escape');
  const rb = await p.locator('g[data-tool="rect"] rect').first().boundingBox();
  await p.mouse.click(rb.x + rb.width / 2, rb.y + rb.height / 2);
  await p.locator('.rd-bar [data-rd-color="#2fe07f"]').click();
  assert.equal(await p.locator('g[data-tool="rect"] rect').first().getAttribute('stroke'), '#2fe07f');
  const n = (await list()).length;
  await p.keyboard.press('Delete'); assert.equal((await list()).length, n - 1);
  await p.keyboard.press('Control+z'); assert.equal((await list()).length, n);
  await p.keyboard.press('Alt+Shift+R'); assert.equal(await p.evaluate(() => redlineDrawings.state.tool), 'rect');
  await p.keyboard.press('Escape');

  // persists across reload; other symbols have their own drawings
  await p.reload(); await p.waitForSelector('.rd-svg g.rd-shape');
  assert.equal((await list()).length, n);
  await p.goto('http://127.0.0.1:4173/?qa=drawings#/chart?symbol=QQQ&tf=10m'); await p.waitForTimeout(3000);
  assert.equal((await list()).length, 0);

  await p.setViewportSize({ width: 390, height: 844 });
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  console.log('PASS: 16 drawing tools draw, select, recolour, delete/undo, stay anchored on pan, persist per symbol, no chart pan or level dialog while drawing, mobile layout.');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
