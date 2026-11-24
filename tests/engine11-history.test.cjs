// Unit tests for the pure helpers in engine11-history.js. Run: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../engine11-history.js');

const DS = H.DATASET_2020;
const row = (sec, id, p = 100) => ({ researchCandleId: id, timestampNs: `${sec}000000000`, prices: { open: p, high: p + 2, low: p - 2, close: p + 1 }, volume: 10 });
const page = (rows, extra = {}) => ({ datasetVersion: DS.datasetVersion, priceBasisVersion: DS.priceBasisVersion, frame: '1d', direction: 'DESC', researchOnly: true, structuralEligible: false, executionPriceAuthority: false, rows, nextCursor: null, ...extra });

test('timestamps: nanosecond string first, ISO fallback, invalid is NaN', () => {
  assert.equal(H.exactSecond({ timestampNs: '1577923200000000000' }), 1577923200);
  assert.equal(H.exactSecond({ timestampUtc: '2020-01-02T00:00:00Z' }), 1577923200);
  assert.ok(Number.isNaN(H.exactSecond({})));
});

test('rows become Redline bars without changing prices', () => {
  assert.deepEqual(H.rowToBar(row(1577923200, 'a', 3250.25)), { t: 1577923200, o: 3250.25, h: 3252.25, l: 3248.25, c: 3251.25, v: 10 });
  assert.throws(() => H.rowToBar({ timestampNs: '1577923200000000000', prices: { open: 1, high: 2, low: null, close: 1 } }), /INVALID_CANDLE/);
});

test('page contract: every Frye check is enforced', () => {
  assert.ok(H.validatePage(page([]), '1d', DS));
  const bad = { datasetVersion: 'x', priceBasisVersion: 'x', frame: '4h', direction: 'ASC', researchOnly: false, structuralEligible: true, executionPriceAuthority: true, rows: 'no' };
  for (const [k, v] of Object.entries(bad)) assert.throws(() => H.validatePage(page([], { [k]: v }), '1d', DS), /CONTRACT/, k);
  assert.throws(() => H.validatePage(page(Array(1001).fill(row(1577923200, 'z'))), '1d', DS), /CONTRACT/, 'more than 1000 rows');
});

test('pages accumulate ascending and refuse duplicates', () => {
  const T = 1577923200, acc = { ids: new Set(), times: new Set(), bars: [] };   // 2020-01-02
  H.addPage(acc, page([row(T + 300, 'c'), row(T + 200, 'b')]));
  H.addPage(acc, page([row(T + 100, 'a')]));
  assert.deepEqual(acc.bars.map(b => b.t), [T + 100, T + 200, T + 300]);
  assert.throws(() => H.addPage(acc, page([row(T + 400, 'a')])), /DUPLICATE_CANDLE_ID/);
  assert.throws(() => H.addPage({ ids: new Set(), times: new Set([T + 500]), bars: [] }, page([row(T + 500, 'q')])), /DUPLICATE_TIMESTAMP/);
  assert.throws(() => H.addPage({ ids: new Set(), times: new Set(), bars: [] }, page([{ ...row(T + 600, ''), researchCandleId: '' }])), /ROW_IDENTITY/);
});

test('merge keeps archive candles as served and only adds live candles after them', () => {
  const day = 86400, archive = [0, 1, 2].map(i => ({ t: i * day, o: 1, h: 1, l: 1, c: 1, v: 1 }));
  const live = [{ t: day * 2, o: 9, h: 9, l: 9, c: 9, v: 9 }, { t: day * 2 + 3600, o: 8, h: 8, l: 8, c: 8, v: 8 }, { t: day * 3, o: 7, h: 7, l: 7, c: 7, v: 7 }];
  const m = H.merge(archive, live, day);
  assert.deepEqual(m.bars.map(b => b.t), [0, day, 2 * day, 3 * day], 'overlap and a different-session duplicate at the seam are dropped');
  assert.equal(m.bars[2].c, 1, 'archive wins at the seam');
  assert.equal(m.liveAdded, 1); assert.equal(m.archiveLast, 2 * day); assert.equal(m.gapSec, day);
  assert.deepEqual(H.merge([], live, day).bars.map(b => b.t), live.map(b => b.t), 'no archive: live as before');
  assert.equal(archive.length, 3, 'inputs not mutated');
});

test('timeframe mapping and partial loading window', () => {
  assert.deepEqual(H.FRAMES, { '5m': '5m', '10m': '10m', '1h': '1h', '4h': '4h', '1D': '1d' });
  const now = 1800000000;
  assert.equal(H.shouldStop(now - 201 * 86400, '10m', now), true);
  assert.equal(H.shouldStop(now - 100 * 86400, '10m', now), false);
  assert.equal(H.shouldStop(0, '1d', now), false, 'daily / 4h / 1h always load fully');
  assert.equal(H.DATASET_2020.expectedRows['1d'], 1645);
});
