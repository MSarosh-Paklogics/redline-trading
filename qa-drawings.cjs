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
  const pick = async (id, g = 'draw') => { await p.locator(`[data-rd-more="${g}"]`).click(); await p.locator(`.rd-fly [data-rd-tool="${id}"]`).click(); };
  const list = () => p.evaluate(() => redlineDrawings.list());

  // menus match the client: two rail groups, ? and star on each tool
  await p.locator('[data-rd-more="lines"]').click();
  assert.deepEqual(await p.locator('.rd-fly .rd-sec').allTextContents(), ['LINES', 'CHANNELS', 'PITCHFORKS']);
  assert.equal(await p.locator('.rd-fly .rd-pick').count(), 17);
  await p.keyboard.press('Escape');
  await p.locator('[data-rd-more="draw"]').click();
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
  const linePlan = [
    ['trendline', 2, async () => drag([100, 150], [220, 100])], ['ray', 2, async () => { await click(250, 200); await click(320, 170); }],
    ['infoLine', 2, async () => drag([350, 250], [450, 200])], ['extendedLine', 2, async () => { await click(100, 300); await click(200, 320); }],
    ['trendAngle', 2, async () => drag([500, 300], [600, 250])], ['hline', 1, async () => click(300, 120)], ['hray', 1, async () => click(400, 420)],
    ['vline', 1, async () => click(700, 200)], ['crossline', 1, async () => click(750, 350)],
    ['parallelChannel', 3, async () => { await click(100, 400); await click(250, 350); await click(180, 440); }],
    ['regression', 2, async () => drag([300, 300], [600, 300])],
    ['flatTopBottom', 3, async () => { await click(620, 420); await click(760, 380); await click(700, 460); }],
    ['disjointChannel', 3, async () => { await click(100, 480); await click(240, 450); await click(160, 520); }],
    ['pitchfork', 3, async () => { await click(300, 500); await click(380, 430); await click(420, 520); }],
    ['schiff', 3, async () => { await click(450, 500); await click(520, 430); await click(560, 520); }],
    ['modSchiff', 3, async () => { await click(600, 520); await click(660, 450); await click(700, 530); }],
    ['insidePitchfork', 3, async () => { await click(720, 540); await click(780, 470); await click(820, 560); }]
  ];
  for (const [id, n, run] of linePlan) {
    const before = (await list()).length;
    await pick(id, 'lines'); await run(); await p.waitForTimeout(80);
    const l = await list(), d = l.at(-1);
    assert.equal(l.length, before + 1, `${id} adds one drawing`);
    assert.equal(d.tool, id); assert.equal(d.pts.length, n, `${id} points`);
    assert.equal(await p.locator(`.rd-svg g.rd-shape[data-tool="${id}"]`).count(), 1, `${id} rendered`);
  }
  assert.ok((await p.locator('.rd-axis text').allTextContents()).length >= 3, 'price / time tags on the axes');
  for (const [k, id] of [['T', 'trendline'], ['H', 'hline'], ['J', 'hray'], ['V', 'vline'], ['C', 'crossline']]) {
    await p.keyboard.press(`Alt+${k}`); assert.equal(await p.evaluate(() => redlineDrawings.state.tool), id, `Alt+${k}`); await p.keyboard.press('Escape');
  }
  // Fibonacci + Gann group
  await p.locator('[data-rd-more="fib"]').click();
  assert.deepEqual(await p.locator('.rd-fly .rd-sec').allTextContents(), ['FIBONACCI', 'GANN']);
  assert.equal(await p.locator('.rd-fly .rd-pick').count(), 15);
  await p.keyboard.press('Escape');
  const fibPlan = [
    ['fibRetracement', 2, async () => drag([100, 400], [260, 150])], ['trendFibExtension', 3, async () => { await click(300, 450); await click(380, 300); await click(430, 380); }],
    ['fibChannel', 3, async () => { await click(480, 450); await click(620, 380); await click(560, 500); }], ['fibTimeZone', 2, async () => { await click(100, 560); await click(120, 560); }],
    ['fibSpeedFan', 2, async () => drag([650, 450], [760, 330])], ['trendFibTime', 3, async () => { await click(150, 520); await click(190, 500); await click(210, 540); }],
    ['fibCircles', 2, async () => drag([700, 150], [760, 200])], ['fibSpiral', 2, async () => { await click(450, 200); await click(470, 200); }],
    ['fibSpeedArcs', 2, async () => drag([300, 250], [360, 190])], ['fibWedge', 3, async () => { await click(550, 250); await click(650, 200); await click(650, 290); }],
    ['pitchfan', 3, async () => { await click(100, 250); await click(200, 200); await click(200, 300); }], ['gannBox', 2, async () => drag([400, 480], [480, 540])],
    ['gannSquareFixed', 2, async () => drag([520, 480], [600, 520])], ['gannSquare', 2, async () => drag([640, 480], [740, 540])], ['gannFan', 2, async () => drag([760, 540], [800, 500])]
  ];
  for (const [id, n, run] of fibPlan) {
    const before = (await list()).length;
    await pick(id, 'fib'); await run(); await p.waitForTimeout(80);
    const l = await list(), d = l.at(-1);
    assert.equal(l.length, before + 1, `${id} adds one drawing`); assert.equal(d.tool, id); assert.equal(d.pts.length, n, `${id} points`);
    assert.doesNotMatch(await p.locator(`.rd-svg g.rd-shape[data-id="${d.id}"]`).innerHTML(), /NaN|undefined|Infinity/, `${id} geometry is finite`);
  }
  const fr = (await list()).find(d => d.tool === 'fibRetracement'), p618 = fr.pts[1].p + (fr.pts[0].p - fr.pts[1].p) * 0.618;
  assert.ok((await p.locator(`g[data-id="${fr.id}"] text`).allTextContents()).includes(`0.618 (${p618.toFixed(2)})`), 'retracement level price');
  await p.keyboard.press('Alt+F'); assert.equal(await p.evaluate(() => redlineDrawings.state.tool), 'fibRetracement'); await p.keyboard.press('Escape');
  await p.evaluate(() => { localStorage.removeItem('redline-drawings-v1'); }); await p.reload(); await p.waitForSelector('.chart-frame .rd-layer');
  await p.locator('.chart-frame').scrollIntoViewIfNeeded();

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

  // select → TradingView toolbar: colour, width, style, text, lock, more menu (order, visibility, clone, copy, hide)
  await p.keyboard.press('Escape');
  const rb = await p.locator('g[data-tool="rect"] rect').first().boundingBox();
  await p.mouse.click(rb.x + rb.width / 2, rb.y + rb.height / 2);
  await p.locator('.rd-bar [data-rd-pop="color"]').click();
  await p.locator('.rd-pop [data-rd-set-color="#2fe07f"]').click();
  assert.equal(await p.locator('g[data-tool="rect"] rect').first().getAttribute('stroke'), '#2fe07f');
  await p.keyboard.press('Escape');
  await p.locator('.rd-bar [data-rd-pop="width"]').click(); await p.locator('.rd-pop [data-rd-set-width="3"]').click();
  await p.locator('.rd-bar [data-rd-pop="style"]').click(); await p.locator('.rd-pop [data-rd-set-dash="dashed"]').click();
  await p.locator('.rd-bar [data-rd-pop="text"]').click(); await p.keyboard.type('Supply zone'); await p.keyboard.press('Enter');
  const rect = (await list()).find(d => d.tool === 'rect');
  assert.deepEqual([rect.width, rect.dash, rect.text], [3, 'dashed', 'Supply zone']);
  await p.locator('.rd-bar [data-rd-pop="more"]').click(); await p.locator('.rd-pop [data-rd-sub="order"]').hover();
  assert.deepEqual(await p.locator('.rd-pop-sub .rd-row').allTextContents(), ['Bring to front', 'Send to back', 'Bring forward', 'Send backward']);
  await p.locator('.rd-pop [data-rd-sub="vis"]').hover();
  assert.deepEqual(await p.locator('.rd-pop-sub .rd-row').allTextContents(), ['Current interval and above', 'Current interval and below', 'Current interval only', 'All intervals']);
  await p.locator('.rd-pop-sub [data-rd-vis="only"]').click();
  await p.locator('[data-tf="1h"]').click(); await p.waitForTimeout(2500);
  assert.equal(await p.locator(`g[data-id="${rect.id}"]`).count(), 0, 'current interval only: hidden on 1h');
  await p.locator('[data-tf="10m"]').click(); await p.waitForTimeout(2500);
  assert.equal(await p.locator(`g[data-id="${rect.id}"]`).count(), 1);
  const rb2 = await p.locator(`g[data-id="${rect.id}"] rect`).first().boundingBox();
  await p.mouse.click(rb2.x + rb2.width / 2, rb2.y + rb2.height / 2);
  const n = (await list()).length;
  await p.locator('.rd-bar [data-rd-pop="more"]').click(); await p.locator('.rd-pop [data-rd-clone]').click();
  assert.equal((await list()).length, n + 1, 'clone');
  await p.keyboard.press('Control+c'); await p.keyboard.press('Control+v');
  assert.equal((await list()).length, n + 2, 'copy / paste');
  await p.locator('.rd-bar [data-rd-lock]').click();
  assert.equal((await list()).at(-1).locked, true, 'lock');
  await p.keyboard.press('Delete'); assert.equal((await list()).length, n + 1);
  await p.keyboard.press('Control+z'); assert.equal((await list()).length, n + 2);
  await p.keyboard.press('Alt+Shift+R'); assert.equal(await p.evaluate(() => redlineDrawings.state.tool), 'rect');
  await p.keyboard.press('Escape');
  const nn = (await list()).length;

  // persists across reload; other symbols have their own drawings
  await p.reload(); await p.waitForSelector('.rd-svg g.rd-shape');
  assert.equal((await list()).length, nn);
  await p.goto('http://127.0.0.1:4173/?qa=drawings#/chart?symbol=QQQ&tf=10m'); await p.waitForTimeout(3000);
  assert.equal((await list()).length, 0);

  await p.setViewportSize({ width: 390, height: 844 });
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  console.log('PASS: 48 drawing tools (lines, channels, pitchforks, fibonacci, gann, brushes, arrows, shapes), Alt shortcuts, TradingView toolbar (colour, width, style, text, lock, order, visibility on intervals, clone, copy/paste), delete/undo, anchored on pan, per-symbol persistence, no chart pan or level dialog while drawing, mobile layout.');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
