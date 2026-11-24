'use strict';
/* Engine 11 ES history on the Redline chart (client P1, 2026-11-24/25): brings ES candles back to 2020
   from the owner-only Engine 11 / 2C research archive, GET /engine2c-private-history/page, the same
   archive Frye-Dashboard's RowChart reads (src/pages/rows/RowChart/engine11HistoricalAdapter.js).

   - Owner-only: the archive needs Brian's owner key in the X-Engine2C-Access header. He pastes it into
     the "History" dialog on the chart; it is kept only in his browser (sessionStorage, or localStorage
     with an expiry if he ticks "remember"), under the same names the Frye chart uses
     (engine2cResearchOwnerKey / engine2cResearchOwnerAccessV1). Never in code, never logged.
     Without a key the chart keeps the recent live history, exactly as before.
   - Contract-checked like Frye: dataset + price-basis version, frame, DESC, researchOnly, not
     structural / execution authority, ≤1000 rows per page, no duplicate ids or timestamps. The 2020+
     dataset first; the legacy dataset if the 2020+ contract does not match.
   - Merge: archive candles are kept exactly as served (no price, time or rollover change); live
     /api/v1/futures/ohlc + SSE candles are only added after the archive's last candle. The live feed
     can no longer trim them (live-stream.js keeps archive-backed charts whole).
   - Daily, 4H and 1H load the full archive; 10m and 5m load about the last 200 days (≈6.5 months).
   Needs the backend to allow Redline's origin on that route (Brian's branch
   engine2c/redline-owner-history-cors-20261124); until it is deployed the dialog says so.
   The pure helpers are unit-tested in tests/engine11-history.test.cjs. */
(function (root) {
  // ---------------------------------------------------------------- pure helpers
  const DATASET_2020 = Object.freeze({ name: '2020+', datasetVersion: 'research-dataset:2e555ba83cbf25466d3e8d157371cc423401f30a25ed35b33a95fca5f81aaae2', priceBasisVersion: 'price-basis:04ec3639248269336f8df3626c6c9a3eb119ac18cbc39429addbbb2f24d22b15', expectedRows: { '5m': 471044, '10m': 235733, '1h': 39364, '4h': 9319, '1d': 1645 } });
  const DATASET_LEGACY = Object.freeze({ name: 'legacy', datasetVersion: 'research-dataset:a0c81ce398869440b1b9cd42b94ced0101923356c4c860a9c13232a1f98f3c91', priceBasisVersion: 'price-basis:fcbfa10815555415c8afdfddbbc28a96a4f42207db162a0db853b549546b3908', expectedRows: {} });
  const FRAMES = { '5m': '5m', '10m': '10m', '1h': '1h', '4h': '4h', '1D': '1d' };   // Redline tf → archive frame
  const FRAME_SEC = { '5m': 300, '10m': 600, '1h': 3600, '4h': 14400, '1d': 86400 };
  const RECENT_DAYS = { '5m': 200, '10m': 200 };                                       // partial frames; others load fully

  function exactSecond(row) {
    const raw = String(row?.timestampNs || '');
    if (/^\d{15,}$/.test(raw)) return Number(raw.slice(0, -9));
    const ms = Date.parse(row?.timestampUtc);
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : NaN;
  }
  function rowToBar(row) {
    const p = row?.prices || {}, t = exactSecond(row);
    const b = { t, o: p.open, h: p.high, l: p.low, c: p.close, v: Number.isFinite(row?.volume) ? row.volume : 0 };
    if (!Number.isFinite(b.t) || ![b.o, b.h, b.l, b.c].every(Number.isFinite)) throw new Error('ENGINE11_INVALID_CANDLE');
    return b;
  }
  function validatePage(page, frame, ds) {
    if (page?.datasetVersion !== ds.datasetVersion || page?.priceBasisVersion !== ds.priceBasisVersion || page?.frame !== frame ||
      page?.direction !== 'DESC' || page?.researchOnly !== true || page?.structuralEligible !== false ||
      page?.executionPriceAuthority !== false || !Array.isArray(page?.rows) || page.rows.length > 1000) throw new Error('ENGINE11_PAGE_CONTRACT_MISMATCH');
    return page;
  }
  // Adds one DESC page to the running set; refuses duplicate candle ids or timestamps (Frye rule).
  function addPage(acc, page) {
    for (const row of page.rows) {
      const id = String(row?.researchCandleId || ''), t = exactSecond(row);
      if (!id || !Number.isFinite(t)) throw new Error('ENGINE11_INVALID_ROW_IDENTITY');
      if (acc.ids.has(id)) throw new Error('ENGINE11_DUPLICATE_CANDLE_ID');
      if (acc.times.has(t)) throw new Error('ENGINE11_DUPLICATE_TIMESTAMP');
      acc.ids.add(id); acc.times.add(t); acc.bars.push(rowToBar(row));
    }
    acc.bars.sort((a, b) => a.t - b.t);
    return acc;
  }
  // Archive candles stay exactly as served; live candles are added only after the archive's last candle
  // (at least half a bar later, so a different session clock at the seam cannot duplicate a candle).
  function merge(archive, live, frameSec) {
    const a = Array.isArray(archive) ? archive : [], l = Array.isArray(live) ? live : [];
    if (!a.length) return { bars: l.slice(), archiveLast: null, liveAdded: l.length, gapSec: 0 };
    const last = a[a.length - 1].t, after = l.filter(b => Number.isFinite(b.t) && b.t >= last + frameSec / 2);
    const gapSec = after.length ? after[0].t - last : 0;
    return { bars: a.concat(after), archiveLast: last, liveAdded: after.length, gapSec };
  }
  const shouldStop = (oldestT, frame, nowSec) => RECENT_DAYS[frame] ? oldestT <= nowSec - RECENT_DAYS[frame] * 86400 : false;

  const core = { DATASET_2020, DATASET_LEGACY, FRAMES, FRAME_SEC, RECENT_DAYS, exactSecond, rowToBar, validatePage, addPage, merge, shouldStop };
  if (typeof module === 'object' && module.exports) module.exports = core;
  if (!root || !root.document) return;

  // ---------------------------------------------------------------- owner key (browser only)
  const doc = root.document, KEY_S = 'engine2cResearchOwnerKey', KEY_L = 'engine2cResearchOwnerAccessV1';
  function getKey() {
    try { const s = root.sessionStorage.getItem(KEY_S); if (s) return s; } catch { /* blocked storage */ }
    try {
      const saved = JSON.parse(root.localStorage.getItem(KEY_L) || 'null');
      if (saved?.expiresAt > Date.now() && typeof saved.key === 'string' && saved.key) { try { root.sessionStorage.setItem(KEY_S, saved.key); } catch { /* ignore */ } return saved.key; }
    } catch { /* ignore */ }
    return '';
  }
  function setKey(key, hours) {
    try { root.sessionStorage.setItem(KEY_S, key); } catch { /* ignore */ }
    try { if (hours > 0) root.localStorage.setItem(KEY_L, JSON.stringify({ key, expiresAt: Date.now() + hours * 3600000 })); else root.localStorage.removeItem(KEY_L); } catch { /* ignore */ }
  }
  function clearKey() { try { root.sessionStorage.removeItem(KEY_S); } catch { /* ignore */ } try { root.localStorage.removeItem(KEY_L); } catch { /* ignore */ } }

  // ---------------------------------------------------------------- archive-backed chart caches
  const H = { arch: {}, live: {}, merged: {}, status: {}, jobs: {}, installed: new Set() };
  const cache = () => (typeof liveBarsCache !== 'undefined' ? liveBarsCache : root.redlineLiveBars);
  const frameOf = tfv => FRAMES[tfv] || null;
  function remerge(k) {
    const st = H.status[k], fs = FRAME_SEC[st?.frame] || 600;
    if (!H.arch[k]?.length) { H.merged[k] = H.live[k]; return; }
    const m = merge(H.arch[k], H.live[k], fs);
    const arr = m.bars; arr.engine11 = true;   // live-stream.js never trims these
    H.merged[k] = arr;
    Object.assign(st, { archiveLast: m.archiveLast, liveAdded: m.liveAdded, gapSec: m.gapSec, total: arr.length, first: arr[0]?.t ?? null, last: arr.at(-1)?.t ?? null });
  }
  // The app re-seeds liveBarsCache[key] with recent bars every minute; this property keeps the
  // archive underneath whatever live set arrives, so history is never overwritten or truncated.
  function install(k) {
    const c = cache(); if (!c || H.installed.has(k)) return;
    H.live[k] = c[k];
    Object.defineProperty(c, k, { configurable: true, enumerable: true, get: () => H.merged[k] ?? H.live[k], set: v => { H.live[k] = v; remerge(k); } });
    H.installed.add(k);
  }
  function redraw(full) {
    if (typeof page === 'undefined' || page !== 'chart') return;
    if (full && typeof render === 'function') { render(); return; }
    const svg = doc.querySelector('.chart-frame > svg');
    if (svg && typeof chartSVG === 'function') svg.outerHTML = chartSVG();
  }
  function friendly(e) {
    const m = String(e?.message || e || '');
    if (/^401/.test(m)) return ['rejected', 'The archive rejected this key. Check it and unlock again.'];
    if (/^403/.test(m)) return ['rejected', 'The archive refused access for this key (403).'];
    if (/Failed to fetch|NetworkError|Load failed|TypeError/i.test(m)) return ['blocked', 'The archive is not reachable from this site yet. Brian\'s backend must allow Redline\'s address on the history route (branch engine2c/redline-owner-history-cors-20261124, not deployed yet), or the backend is waking up.'];
    if (/abort/i.test(m)) return ['error', 'The archive took too long to answer. Try again.'];
    if (/CONTRACT|DUPLICATE|INVALID/.test(m)) return ['error', `Archive data failed Redline's contract check (${m}). Nothing was shown from it.`];
    return ['error', `Archive unavailable (${m || 'unknown error'}).`];
  }
  async function load(sym, tfv) {
    const frame = frameOf(tfv), k = `${sym}:${tfv}`, key = getKey(), api = root.redlineApi;
    if (!frame || !api?.engine11Page) return;
    if (!key) { H.status[k] = { state: 'locked', frame }; paintButton(); return; }
    if (H.jobs[k]) return;
    install(k);
    const st = H.status[k] = { state: 'loading', frame, pages: 0, dataset: DATASET_2020.name, startedAt: Date.now() };
    paintButton();
    const job = H.jobs[k] = { cancelled: false };
    let ds = DATASET_2020, cursor = null, acc = { ids: new Set(), times: new Set(), bars: [] };
    const seen = new Set(), nowSec = Math.floor(Date.now() / 1000);
    try {
      for (;;) {
        if (job.cancelled) return;
        const ck = cursor == null ? '__FIRST__' : cursor;
        if (seen.has(ck)) throw new Error('ENGINE11_CURSOR_CYCLE');
        seen.add(ck);
        let page;
        try {
          page = validatePage((await api.engine11Page({ frame, cursor, datasetVersion: ds.datasetVersion, priceBasisVersion: ds.priceBasisVersion }, key)).data, frame, ds);
        } catch (e) {
          // like Frye: the legacy dataset if the 2020+ contract does not match on the first page
          if (ds === DATASET_2020 && cursor == null && /CONTRACT/.test(String(e?.message))) { ds = DATASET_LEGACY; st.dataset = ds.name; seen.clear(); continue; }
          throw e;
        }
        addPage(acc, page);
        st.pages++;
        H.arch[k] = acc.bars; remerge(k);
        const cur = typeof symbol !== 'undefined' && `${symbol}:${tf}` === k;
        if (cur) redraw(false);
        paintButton();
        cursor = page.nextCursor ?? null;
        if (cursor == null) { st.complete = true; break; }
        if (shouldStop(acc.bars[0].t, frame, nowSec)) { st.complete = false; st.partial = true; break; }
        if (st.pages >= 600) throw new Error('ENGINE11_PAGE_LIMIT_EXCEEDED');
      }
      st.state = 'ready'; st.expected = ds.expectedRows?.[frame] ?? null;
    } catch (e) {
      const [state, text] = friendly(e);
      Object.assign(st, { state, text });
      if (state === 'rejected') { H.arch[k] = []; remerge(k); }
    } finally {
      delete H.jobs[k];
      if (typeof symbol !== 'undefined' && `${symbol}:${tf}` === k) redraw(true);
      paintButton();
    }
  }
  function cancelAll() { for (const j of Object.values(H.jobs)) j.cancelled = true; }
  function reset(k) { if (H.jobs[k]) H.jobs[k].cancelled = true; delete H.jobs[k]; H.arch[k] = []; delete H.status[k]; remerge(k); }

  // Start loading whenever the chart shows an ES timeframe the archive has.
  function tick() {
    if (typeof page === 'undefined' || page !== 'chart' || typeof symbol === 'undefined') return;
    const sym = String(symbol).toUpperCase();
    if (!/^(ES|MES)$/.test(sym) || !frameOf(tf)) { paintButton(); return; }
    const k = `${symbol}:${tf}`, st = H.status[k];
    // retry a blocked / failed archive once a minute (e.g. Brian's CORS change going live), not a rejected key
    if (!st || st.state === 'locked' || ((st.state === 'blocked' || st.state === 'error') && Date.now() - st.startedAt > 60000)) load(symbol, tf); else paintButton();
  }

  // ---------------------------------------------------------------- the History button + dialog
  const fmtDay = t => (t ? new Date(t * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : '—');
  const E = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function currentStatus() {
    if (typeof symbol === 'undefined') return { label: '', cls: '' };
    const sym = String(symbol).toUpperCase(), k = `${symbol}:${tf}`, st = H.status[k];
    if (!/^(ES|MES)$/.test(sym)) return { label: 'History: recent', cls: 'muted', title: 'The Engine 11 archive covers ES futures only.' };
    if (!frameOf(tf)) return { label: 'History: recent', cls: 'muted', title: `The archive has no ${tf} candles (5m, 10m, 1H, 4H and Daily only).` };
    if (!st || st.state === 'locked') return { label: 'History: recent · unlock 2020+', cls: 'locked' };
    if (st.state === 'loading') return { label: `History: loading ${st.pages} page${st.pages === 1 ? '' : 's'}…`, cls: 'loading' };
    if (st.state === 'ready') return { label: `History: from ${fmtDay(st.first)}`, cls: 'ready' };
    return { label: st.state === 'blocked' ? 'History: archive not reachable' : st.state === 'rejected' ? 'History: key rejected' : 'History: unavailable', cls: 'warn', title: st.text };
  }
  function paintButton() {
    const bar = doc.querySelector('.pro-chart-toolbar-left'); if (!bar) return;
    let b = bar.querySelector('[data-e11]');
    if (!b) { b = doc.createElement('button'); b.type = 'button'; b.className = 'terminal-toolbar-action e11-btn'; b.dataset.e11 = '1'; const anchor = bar.querySelector('[data-action="terminal-history"]'); anchor ? anchor.after(b) : bar.appendChild(b); }
    const s = currentStatus(), html = `<i class="e11-dot ${s.cls}"></i><span>${E(s.label)}</span>`;
    if (b.innerHTML !== html) b.innerHTML = html;
    b.title = s.title || 'ES history from the Engine 11 archive (owner key required)';
  }
  function dialog() {
    if (typeof openModal !== 'function') return;
    const k = typeof symbol !== 'undefined' ? `${symbol}:${tf}` : '', st = H.status[k] || {}, hasKey = !!getKey();
    const rows = st.state === 'ready' || st.pages ? `
      <div class="e11-grid">
        <div><small>Archive dataset</small><b>Engine 11 ${E(st.dataset || '2020+')} · unadjusted</b></div>
        <div><small>Pages loaded</small><b>${st.pages || 0}${st.partial ? ' (last ~200 days)' : st.complete ? ' (complete)' : ''}</b></div>
        <div><small>First candle</small><b>${fmtDay(st.first)}</b></div>
        <div><small>Archive ends</small><b>${fmtDay(st.archiveLast)}</b></div>
        <div><small>Candles on chart</small><b>${(st.total || 0).toLocaleString('en-US')}${st.expected && st.complete ? ` of ${st.expected.toLocaleString('en-US')} expected` : ''}</b></div>
        <div><small>Live candles after archive</small><b>${(st.liveAdded || 0).toLocaleString('en-US')}</b></div>
      </div>${st.gapSec > 4 * 86400 ? `<p class="e11-warn">Gap of about ${Math.round(st.gapSec / 86400)} days between the archive's last candle and the live data.</p>` : ''}` : '';
    const body = `<div class="e11">
      <p>Redline normally shows the recent ES history the live feed keeps (about 3 months on 1H, 2 weeks on 10m). The <b>Engine 11 archive</b> goes back to 2020. It is licensed research data and opens only with the <b>owner key</b>.</p>
      ${st.text ? `<p class="e11-warn">${E(st.text)}</p>` : ''}${rows}
      ${hasKey ? `<p class="e11-ok">An owner key is unlocked in this browser.</p>
        <div class="head-actions"><button type="button" class="btn" data-e11-lock>Lock (forget key)</button><button type="button" class="btn primary" data-e11-reload>Reload history</button></div>`
      : `<form id="e11Form"><div class="form-grid"><div class="form-group full"><label for="e11Key">Owner key</label><input id="e11Key" name="key" type="password" autocomplete="off" spellcheck="false" required minlength="8" placeholder="Paste the Engine 11 owner key"></div>
        <div class="form-group full"><label for="e11Keep">Keep unlocked</label><select id="e11Keep" name="keep"><option value="0">This tab only (until it closes)</option><option value="12">12 hours on this computer</option><option value="168">7 days on this computer</option></select></div></div>
        <p class="news-label">The key stays in this browser only. It is sent only to the Frye backend's history route and never stored in Redline's code.</p>
        <div class="head-actions"><button type="submit" class="btn primary">Unlock 2020+ history</button></div></form>`}
      <p class="news-label">Archive candles are shown exactly as served (no price, time or rollover changes). Daily, 4H and 1H load the full archive; 10m and 5m the last ~200 days. Signal-only: nothing here trades.</p>
    </div>`;
    const d = openModal('ES history · Engine 11 archive', body);
    d.querySelector('#e11Form')?.addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target), key = String(f.get('key') || '').trim();
      if (!key) return;
      setKey(key, Number(f.get('keep')) || 0);
      e.target.reset();
      for (const kk of Object.keys(H.status)) reset(kk);
      if (typeof closeModal === 'function') closeModal();
      tick();
    });
    d.querySelector('[data-e11-lock]')?.addEventListener('click', () => { clearKey(); cancelAll(); for (const kk of Object.keys(H.status)) reset(kk); if (typeof closeModal === 'function') closeModal(); redraw(true); });
    d.querySelector('[data-e11-reload]')?.addEventListener('click', () => { reset(k); if (typeof closeModal === 'function') closeModal(); tick(); });
  }
  doc.addEventListener('click', e => { if (e.target.closest?.('[data-e11]')) { e.preventDefault(); dialog(); } });

  const app = doc.getElementById('app');
  if (app) new MutationObserver(() => paintButton()).observe(app, { childList: true });
  root.addEventListener('hashchange', () => setTimeout(tick, 300));
  root.setInterval(tick, 2000);
  setTimeout(tick, 800);
  root.redlineHistory = { status: H.status, reload: () => { const k = `${symbol}:${tf}`; reset(k); tick(); }, hasKey: () => !!getKey(), core };
})(typeof window !== 'undefined' ? window : null);
