'use strict';
/* Journal page (#/journal): Frye Engine 8 PAPER trades from /api/v1/trade-journal?accountMode=PAPER,
   in Redline's own UI, following the client's Frye JournalFull layout (summary, open positions,
   trade history, selected trade).
   PAPER ONLY. Real-account trading (Schwab accounts, positions, P&L) is locked until the client
   approves who may see it; Redline has no route that reads it, and any row not marked PAPER is dropped.
   Read-only: nothing is written to the journal or the broker. The local practice journal
   (app.js journalPage) stays available as a clearly labelled demo tab. */
(() => {
  if (typeof journalPage !== 'function') return;
  const practicePage = journalPage;
  const REFRESH_MS = 30000;
  const ui = { mode: 'paper', status: 'ALL', range: 'ALL', sel: null, trades: null, at: null, loading: false, failed: false };

  const n = v => { const x = Number(v); return v == null || v === '' || !Number.isFinite(x) ? null : x; };
  const L = v => v == null || v === '' ? '—' : String(v).replace(/_/g, ' ').toUpperCase();
  const px = v => n(v) == null ? '—' : n(v).toFixed(2);
  const sgn = (v, d = 2) => n(v) == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}`;
  // Paper realizedPnL is published in index points (it equals realizedPoints), so it is never shown as dollars.
  const money = v => n(v) == null ? '—' : `${sgn(v)} pts`;
  const cls = v => n(v) == null || v === 0 ? '' : v > 0 ? 'up' : 'down';
  const az = t => { const d = Date.parse(t || ''); return Number.isFinite(d) ? new Date(d).toLocaleString('en-US', { timeZone: 'America/Phoenix', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'; };
  const azDay = t => { const d = Date.parse(t || ''); return Number.isFinite(d) ? new Date(d).toLocaleDateString('en-US', { timeZone: 'America/Phoenix' }) : null; };
  const dur = m => n(m) == null ? '—' : m >= 1440 ? `${(m / 1440).toFixed(1)} d` : m >= 60 ? `${(m / 60).toFixed(1)} h` : `${Math.round(m)} min`;
  const esMark = () => { if (!window.redlineQuotesLive || typeof symbols === 'undefined') return null; const s = symbols.find(x => x[0] === 'ES'); return n(s?.[2]); };

  async function load() {
    if (ui.loading || !window.redlineApi?.paperJournal) return;
    ui.loading = true;
    try {
      const r = await window.redlineApi.paperJournal();
      const rows = Array.isArray(r?.data?.trades) ? r.data.trades : [];
      // Defence in depth: never show anything that is not explicitly a PAPER trade.
      ui.trades = rows.filter(t => String(t?.accountMode || '').toUpperCase() === 'PAPER');
      ui.failed = false; ui.at = Date.now();
    } catch { ui.failed = true; }
    ui.loading = false;
    if (location.hash.startsWith('#/journal') && typeof render === 'function' && !document.querySelector('#modal[open]')) render();
  }

  const exitOf = t => { const ev = (t.events || []).filter(e => /EXIT/.test(e.eventType || '') && n(e.price) != null); return ev.at(-1) || null; };
  const exitReason = t => (t.events || []).map(e => e.exitReason).filter(Boolean).at(-1) || null;
  const isOpen = t => String(t.status || '').toUpperCase() !== 'CLOSED';
  const today = azDay(new Date().toISOString());

  function filtered() {
    return (ui.trades || [])
      .filter(t => ui.status === 'ALL' || (ui.status === 'OPEN' ? isOpen(t) : !isOpen(t)))
      .filter(t => ui.range === 'ALL' || azDay(t.summary?.openTime || t.entry?.time || t.createdAt) === today)
      .sort((a, b) => Date.parse(b.summary?.openTime || b.createdAt || 0) - Date.parse(a.summary?.openTime || a.createdAt || 0));
  }

  // Summary of the journal's own recorded outcomes (counts and sums only; no engine output is changed).
  function summary(list) {
    const closed = list.filter(t => !isOpen(t)), open = list.filter(isOpen);
    const pnl = closed.map(t => n(t.summary?.realizedPnL)).filter(v => v != null);
    const pts = closed.map(t => n(t.summary?.realizedPoints)).filter(v => v != null);
    const wins = closed.filter(t => String(t.result).toUpperCase() === 'WIN').length, losses = closed.filter(t => String(t.result).toUpperCase() === 'LOSS').length;
    const gw = pts.filter(v => v > 0).reduce((a, v) => a + v, 0), gl = -pts.filter(v => v < 0).reduce((a, v) => a + v, 0);
    const holds = closed.map(t => n(t.summary?.durationMinutes)).filter(v => v != null);
    return {
      closed: closed.length, open: open.length, openQty: open.reduce((a, t) => a + (n(t.qty?.remainingQty) ?? 0), 0),
      pnl: pnl.length ? pnl.reduce((a, v) => a + v, 0) : null, pts: pts.length ? pts.reduce((a, v) => a + v, 0) : null,
      wins, losses, winRate: wins + losses ? wins / (wins + losses) * 100 : null,
      pf: gl ? gw / gl : null, avgHold: holds.length ? holds.reduce((a, v) => a + v, 0) / holds.length : null,
      best: pts.length ? Math.max(...pts) : null, worst: pts.length ? Math.min(...pts) : null
    };
  }

  function modeTabs() {
    const tabs = [['paper', 'PAPER TRADING', 'Engine 8 · live backend'], ['real', 'REAL TRADING', 'Locked · awaiting approval'], ['practice', 'PRACTICE JOURNAL', 'Local demo · your notes']];
    return `<nav class="db-tabs jl-modes" role="tablist" aria-label="Journal mode">${tabs.map(([id, name, sub]) => `<button type="button" role="tab" data-jl-mode="${id}" aria-selected="${id === ui.mode}" class="${id === ui.mode ? 'selected' : ''}"><small>${esc(sub)}</small>${esc(name)}</button>`).join('')}</nav>`;
  }

  function filters() {
    const b = (key, val, label) => `<button type="button" data-jl-${key}="${val}" class="${ui[key] === val ? 'selected' : ''}">${esc(label)}</button>`;
    return `<div class="jl-filters"><div>${b('status', 'ALL', 'All trades')}${b('status', 'OPEN', 'Open')}${b('status', 'CLOSED', 'Closed')}</div><div>${b('range', 'ALL', 'All time')}${b('range', 'TODAY', 'Today')}</div></div>`;
  }

  function openTable(list) {
    const open = list.filter(isOpen), mark = esMark();
    if (!open.length) return '';
    const rows = open.map(t => {
      const dir = String(t.direction || '').toUpperCase() === 'SHORT' ? -1 : 1, entry = n(t.entry?.price), qty = n(t.qty?.remainingQty);
      const live = mark != null && entry != null ? (mark - entry) * dir : null;
      return `<tr data-jl-trade="${esc(t.tradeId)}"><td>${esc(az(t.summary?.openTime || t.entry?.time))}</td><td>${esc(t.symbol || '—')}</td><td class="${dir < 0 ? 'down' : 'up'}">${esc(L(t.direction))}</td><td class="number">${qty ?? '—'}</td><td class="number">${px(entry)}</td><td class="number">${px(mark)}</td><td class="number ${cls(live)}">${live == null ? '—' : `${sgn(live)} pts`}</td><td>${esc(L(t.setupType))}</td></tr>`;
    }).join('');
    return panel('Current open paper positions', `<div class="table-wrap"><table class="sl-table"><thead><tr><th>Opened (AZ)</th><th>Symbol</th><th>Side</th><th>Open qty</th><th>Entry</th><th>ES mark</th><th>Live move / contract</th><th>Setup</th></tr></thead><tbody>${rows}</tbody></table></div><p class="sl-muted jl-pad">Live move is the ES mark minus entry, per contract, for display only. No journal value or order is changed.</p>`);
  }

  function historyTable(list) {
    if (!list.length) return panel('Paper trade history', '<p class="sl-muted jl-pad">No paper trades match these filters.</p>');
    const rows = list.map(t => {
      const ex = exitOf(t), s = t.summary || {}, open = isOpen(t), res = String(t.result || '').toUpperCase();
      return `<tr data-jl-trade="${esc(t.tradeId)}" class="${ui.sel === t.tradeId ? 'selected' : ''}"><td>${esc(az(s.openTime || t.entry?.time))}</td><td>${esc(t.symbol || '—')}</td><td class="${String(t.direction).toUpperCase() === 'SHORT' ? 'down' : 'up'}">${esc(L(t.direction))}</td><td>${esc(L(t.setupType))}${t.setupGrade ? ` · ${esc(t.setupGrade)}` : ''}</td><td><span class="pill ${open ? 'gold' : res === 'WIN' ? 'green' : res === 'LOSS' ? 'red' : 'neutral'}">${esc(open ? 'OPEN' : res || 'CLOSED')}</span></td><td class="number">${px(t.entry?.price)}</td><td class="number">${open ? '—' : px(ex?.price)}</td><td class="number">${n(t.qty?.originalQty) ?? '—'}</td><td class="number ${cls(s.realizedPoints)}">${open ? '—' : sgn(s.realizedPoints)}</td><td class="number ${cls(s.realizedPnL)}">${open ? '—' : money(s.realizedPnL)}</td><td>${esc(L(exitReason(t)))}</td><td>${esc(dur(s.durationMinutes))}</td></tr>`;
    }).join('');
    return panel(`Paper trade history · ${list.length} trades`, `<div class="table-wrap"><table class="sl-table jl-table"><thead><tr><th>Opened (AZ)</th><th>Symbol</th><th>Side</th><th>Setup · grade</th><th>Status</th><th>Entry</th><th>Exit</th><th>Qty</th><th>Points</th><th>Net recorded</th><th>Exit reason</th><th>Hold</th></tr></thead><tbody>${rows}</tbody></table></div><p class="sl-muted jl-pad">Select a trade for its full event timeline. "Net recorded" is the journal's realizedPnL as published; for paper trades it is in index points, so no dollar value is shown.</p>`);
  }

  function selected(list) {
    const t = (ui.trades || []).find(x => x.tradeId === ui.sel) || null;
    if (!t) return '';
    const s = t.summary || {}, id = t.identity || {}, rv = t.review || {}, q = t.qty || {};
    const events = (t.events || []).map(e => `<div class="jl-event"><b>${esc(L(e.eventType))}</b><span>${esc(az(e.ts))}</span><span class="number">${px(e.price)}</span><span>${e.qtyClosed ? `${e.qtyClosed} closed` : e.fillQuantity ? `${e.fillQuantity} filled` : ''}</span><span class="number ${cls(e.eventRealizedPnL)}">${e.eventRealizedPnL == null ? '' : money(e.eventRealizedPnL)}</span><em>${esc(L(e.exitReason || e.reason || e.managementAction || ''))}</em></div>`).join('');
    const kv = (k, v, c = '') => `<div class="sl-kv"><span>${esc(k)}</span><b class="${c}">${esc(v == null || v === '' ? '—' : String(v))}</b></div>`;
    return `<div class="race-section-label"><span>SELECTED TRADE · ${esc(L(t.direction))} ${esc(t.symbol || '')}</span><small>${esc(t.tradeId)}</small><button type="button" class="sl-chip" data-jl-close>CLOSE</button></div>
      <div class="stats sl-stats">${stat('Entry', px(t.entry?.price), esc(az(t.entry?.time)), esc(L(t.entry?.orderType)), 'chart', 'up')}${stat('Remaining', String(q.remainingQty ?? '—'), `of ${q.originalQty ?? '—'} contracts`, esc(L(t.status)), 'wallet', 'yellow')}${stat('Points', sgn(s.realizedPoints), s.realizedR == null ? 'R not published' : `${sgn(s.realizedR)} R`, 'realized', 'spark', cls(s.realizedPoints) || 'yellow')}${stat('Net recorded', money(s.realizedPnL), esc(dur(s.durationMinutes)), 'journal realizedPnL', 'target', cls(s.realizedPnL) || 'yellow')}</div>
      <div class="sl-detail jl-detail">
        <section class="sl-card gold"><header><h3>Event timeline</h3></header><div class="jl-events">${events || '<p class="sl-muted">No events recorded.</p>'}</div></section>
        <section class="sl-card"><header><h3>Setup identity</h3></header>${kv('Strategy', t.strategyId)}${kv('Lane', L(t.laneId))}${kv('Setup', L(t.setupType))}${kv('Grade', t.setupGrade)}${kv('Candidate', id.candidateId)}${kv('Zone', id.zoneId)}${kv('Plan', id.planId)}${kv('Fill source', L(t.entry?.source))}${kv('Stop distance', t.riskBasis?.officialStopDistancePoints == null ? '—' : `${t.riskBasis.officialStopDistancePoints} pts`)}</section>
        <section class="sl-card"><header><h3>Review</h3></header>${kv('Grade', rv.grade)}${kv('Followed plan', rv.followedPlan == null ? '—' : rv.followedPlan ? 'YES' : 'NO')}${kv('Mistake flags', (rv.mistakeFlags || []).map(L).join(', '))}${kv('Tags', (rv.tags || []).join(', '))}<p class="sl-muted">${esc(rv.notes || 'No review notes recorded.')}</p><p class="sl-muted">Reviews are read-only in Redline.</p></section>
      </div>`;
  }

  function paperView() {
    if (!ui.trades) return `<div class="ce-empty">${ui.failed ? 'The paper journal is unavailable right now. Nothing is shown rather than demo data.' : 'Loading Engine 8 paper trades…'}</div>`;
    const list = filtered(), m = summary(list);
    return filters()
      + `<div class="stats sl-stats jl-stats">${stat('Paper net recorded', money(m.pnl), `${m.closed} closed trades`, 'journal realizedPnL', 'wallet', cls(m.pnl) || 'yellow')}${stat('Best / worst', `${sgn(m.best)} / ${sgn(m.worst)}`, 'points per trade', 'closed trades', 'spark', 'yellow')}${stat('Win rate', m.winRate == null ? '—' : `${m.winRate.toFixed(1)}%`, `${m.wins} wins · ${m.losses} losses`, 'closed trades', 'target', m.winRate != null && m.winRate >= 50 ? 'up' : 'down')}${stat('Profit factor', m.pf == null ? '—' : m.pf.toFixed(2), 'gross win ÷ gross loss', 'points basis', 'chart', m.pf != null && m.pf >= 1 ? 'up' : 'down')}${stat('Open', String(m.open), `${m.openQty} contracts`, 'paper positions', 'grid', 'yellow')}${stat('Avg hold', dur(m.avgHold), 'closed trades', 'entry → exit', 'clock', 'yellow')}</div>`
      + `<p class="sl-muted jl-note">Statistics are counts and sums of the journal's own recorded paper outcomes. Capital-based figures (return, drawdown, annualized) are not shown because no paper capital baseline is published.</p>`
      + openTable(list) + historyTable(list) + selected(list);
  }

  function realView() {
    return `<section class="jl-locked"><div class="jl-lock-icon">${typeof icon === 'function' ? icon('shield', 22) : ''}</div><div><h2>Real trading is locked</h2><p>The Frye journal also records real Schwab trading: account numbers, open positions, contract IDs and realized and unrealized P&L. Redline is not showing it yet, because the site has no sign-in and the client has not approved who may see real-account results.</p><p>When the client confirms access rules, this tab will show the seven strategy accounts, open positions, performance and complete trade history, read-only.</p><span class="pill gold">AWAITING CLIENT APPROVAL</span></div></section>`;
  }

  function page() {
    if (!ui.trades && !ui.loading) setTimeout(load, 0);
    const status = `<div class="sl-status">${ui.mode === 'practice' ? '<span class="pill gold">LOCAL DEMO</span>' : ui.trades ? '<span class="pill green">LIVE BACKEND</span>' : ui.failed ? '<span class="pill red">UNAVAILABLE</span>' : '<span class="pill gold">CONNECTING</span>'}<span>Mode <b>${ui.mode === 'paper' ? 'PAPER ONLY' : ui.mode === 'real' ? 'REAL · LOCKED' : 'PRACTICE'}</b></span><span>Source <b>Engine 8 paper fills</b></span><span>Refresh <b>30s</b></span><span>Fetched <b>${esc(ui.at ? az(new Date(ui.at).toISOString()) + ' AZ' : '—')}</b></span><span>ES mark <b>${px(esMark())}</b></span></div>`;
    const top = head('JOURNAL', 'Trade history, outcomes and performance review. Paper trades from the Frye engine, read-only.', '', 'REDLINE / TRADE JOURNAL') + status + modeTabs();
    if (ui.mode === 'practice') return top + `<div class="notice">Practice journal: illustrative entries saved only in this browser. Not engine or broker data.</div>` + practicePage();
    return top + (ui.mode === 'real' ? realView() : paperView());
  }

  document.addEventListener('click', ev => {
    const t = ev.target;
    const set = (k, v) => { ui[k] = v; if (typeof render === 'function') render(); };
    const mode = t.closest?.('[data-jl-mode]'); if (mode) return set('mode', mode.dataset.jlMode);
    const st = t.closest?.('[data-jl-status]'); if (st) return set('status', st.dataset.jlStatus);
    const rg = t.closest?.('[data-jl-range]'); if (rg) return set('range', rg.dataset.jlRange);
    if (t.closest?.('[data-jl-close]')) return set('sel', null);
    const row = t.closest?.('[data-jl-trade]');
    if (row) { set('sel', row.dataset.jlTrade); requestAnimationFrame(() => document.querySelector('.jl-detail')?.scrollIntoView({ behavior: 'smooth', block: 'center' })); }
  });
  setInterval(() => { if (location.hash.startsWith('#/journal') && ui.mode === 'paper' && !document.hidden) load(); }, REFRESH_MS);
  window.fryePages = { ...(window.fryePages || {}), journal: page };
  window.redlineJournal = ui;
})();
