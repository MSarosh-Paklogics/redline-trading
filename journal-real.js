'use strict';
/* REAL trading journal — adapter + view for the Engine 10 contract, rendered today ONLY with
   synthetic sample data (see docs/FRYE_MASTER_HANDOFF.md §14 and
   docs/BACKEND_REQUEST_REAL_JOURNAL_AUTH.md).
   Redline has no route that reads real-account data. When the backend enforces authorization
   and Brian approves the viewers, adapt() is fed the authenticated responses of
   GET /api/v1/trade-journal?accountMode=REAL and GET /api/v1/trade-journal/real-performance
   plus per-contract marks, and the same view renders live data.
   Contract rules followed: strategy ownership = stored performanceGroup (never account digits);
   money fields are USD; multiplier realBroker → brokerImport → riskBasis → root map;
   broker executions are the four REAL_* fill types with a brokerTransactionId (TRADE_CLOSED is
   not a fill); unrealized uses the position's own contract mark; missing values stay "—". */
(() => {
  const GROUPS = ['SUBMICRO', 'MICRO', 'SUBMINUTE', 'MINUTE', 'MINOR', 'INTERMEDIATE', 'PRIMARY'];
  const LEGACY = ['SWING', 'INTRADAY'];
  const FILLS = new Set(['REAL_ENTRY_FILL', 'REAL_SCALE_IN_FILL', 'REAL_PARTIAL_EXIT', 'REAL_FINAL_EXIT']);
  const ROOT_DPP = { MES: 5, ES: 50, MNQ: 2, NQ: 20 };
  const ui = { group: 'ALL', open: null };

  const n = v => { const x = Number(v); return v == null || v === '' || !Number.isFinite(x) ? null : x; };
  const sum = arr => { const v = arr.map(n).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) : null; };
  const U = v => String(v || '').toUpperCase();

  const contractOf = t => t.futuresContractCode || t.realBroker?.futuresContractCode || t.realBroker?.contracts?.[0]?.futuresContractCode || t.symbol || null;
  const dppOf = t => n(t.realBroker?.dollarsPerPoint) ?? n(t.brokerImport?.dollarsPerPoint) ?? n(t.riskBasis?.dollarsPerPoint) ?? ROOT_DPP[(String(contractOf(t) || '').match(/^(MES|MNQ|ES|NQ)/) || [])[1]] ?? null;
  const labelOf = t => t.brokerAccountLabel || t.realBroker?.brokerAccountLabel || null;
  const maskOf = label => { const d = String(label || '').match(/(\d{4})$/); return d ? `••••${d[1]}` : '••••'; };
  const isOpen = t => U(t.status) !== 'CLOSED' && (n(t.qty?.remainingQty) ?? 0) > 0;

  function unrealized(t, marks) {
    if (!isOpen(t)) return 0;
    const mark = n(marks?.[contractOf(t)]), dpp = dppOf(t), dir = U(t.direction) === 'SHORT' ? -1 : 1;
    if (mark == null || dpp == null) return null;
    const lots = Array.isArray(t.realBroker?.remainingLots) && t.realBroker.remainingLots.length
      ? t.realBroker.remainingLots.map(l => ({ qty: n(l.qty ?? l.quantity), price: n(l.price ?? l.entryPrice) }))
      : [{ qty: n(t.qty?.remainingQty), price: n(t.entry?.price) }];
    if (lots.some(l => l.qty == null || l.price == null)) return null;
    return lots.reduce((a, l) => a + (mark - l.price) * l.qty * dpp * dir, 0);
  }

  // Engine 10 responses → one view model. Nothing is reclassified or invented.
  function adapt(tradesResp, perfResp, marks = {}) {
    const trades = (tradesResp?.trades || []).filter(t => U(t.accountMode) === 'REAL');
    const sections = perfResp?.sections || {};
    const groupOf = t => U(t.performanceGroup) || null;
    const accounts = GROUPS.map(g => {
      const ts = trades.filter(t => groupOf(t) === g), open = ts.filter(isOpen);
      const label = ts.map(labelOf).find(Boolean) || null;
      const dirs = new Set(open.map(t => U(t.direction)));
      return {
        group: g, mask: maskOf(label), openCampaigns: open.length,
        openContracts: sum(open.map(t => t.qty?.remainingQty)) ?? 0,
        side: !open.length ? 'FLAT' : dirs.size > 1 ? 'MIXED' : [...dirs][0] || '—',
        net: n(sections[g]?.netRealized) ?? sum(ts.map(t => t.summary?.netRealizedPnL)),
        live: open.length ? sum(open.map(t => unrealized(t, marks))) : 0
      };
    });
    return { trades, sections, allReal: perfResp?.allReal || null, unknown: perfResp?.unknownRealCampaigns || [], marks, accounts, schema: perfResp?.schema || null };
  }

  /* ---------- view ---------- */
  const usd = v => n(v) == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const plain = v => n(v) == null ? '—' : `$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const px = v => n(v) == null ? '—' : n(v).toFixed(2);
  const cls = v => n(v) == null || v === 0 ? '' : v > 0 ? 'up' : 'down';
  const az = t => { const d = Date.parse(t || ''); return Number.isFinite(d) ? new Date(d).toLocaleString('en-US', { timeZone: 'America/Phoenix', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'; };
  const L = v => v == null || v === '' ? '—' : String(v).replace(/_/g, ' ').toUpperCase();

  function view(m, { sample }) {
    const tag = sample ? '<span class="pill gold">SAMPLE DATA</span>' : '<span class="pill green">LIVE · AUTHORIZED</span>';
    const inGroup = t => ui.group === 'ALL' || U(t.performanceGroup) === ui.group;
    const trades = m.trades.filter(inGroup);
    const perf = ui.group === 'ALL' ? m.allReal : m.sections[ui.group];
    const open = trades.filter(isOpen);
    const live = sum(open.map(t => unrealized(t, m.marks)));
    const net = n(perf?.netRealized);

    const cards = `<div class="jr-accounts"><button type="button" data-jr-group="ALL" class="jr-account ${ui.group === 'ALL' ? 'selected' : ''}"><small>ALL REAL</small><strong>${m.accounts.reduce((a, x) => a + x.openContracts, 0)} OPEN</strong><span>Seven strategy accounts</span></button>${m.accounts.map(a => `<button type="button" data-jr-group="${a.group}" class="jr-account ${ui.group === a.group ? 'selected' : ''}"><small>${esc(a.group)} <b>${esc(a.mask)}</b></small><strong>${a.openContracts} OPEN <em class="${a.side === 'LONG' ? 'up' : a.side === 'SHORT' ? 'down' : ''}">${esc(a.side)}</em></strong><span>Net recorded <b class="${cls(a.net)}">${usd(a.net)}</b></span><span>Live open P&amp;L <b class="${cls(a.live)}">${usd(a.live)}</b></span></button>`).join('')}</div>`;

    const stats = `<div class="stats sl-stats jl-stats">${stat('Gross realized', usd(perf?.grossRealized), `${perf?.closedContracts ?? '—'} closed contracts`, 'USD', 'chart', cls(perf?.grossRealized) || 'yellow')}${stat('Actual fees', perf?.fees == null ? '—' : `−${plain(perf.fees)}`, 'broker-reported', 'USD', 'wallet', 'down')}${stat('Net realized', usd(net), `${perf?.campaigns ?? '—'} campaigns`, 'after fees', 'target', cls(net) || 'yellow')}${stat('Live unrealized', usd(live), `${open.length} open campaigns`, 'contract mark', 'spark', cls(live) || 'yellow')}${stat('Win rate', perf?.winRate == null ? '—' : `${(perf.winRate * 100).toFixed(1)}%`, `${perf?.winningContracts ?? '—'} W · ${perf?.losingContracts ?? '—'} L`, 'closed contracts', 'target', 'yellow')}${stat('Profit factor', perf?.profitFactor == null ? '—' : n(perf.profitFactor).toFixed(2), `max DD ${perf?.maxDrawdown == null ? '—' : plain(perf.maxDrawdown)}`, 'available net sample', 'shield', 'yellow')}</div>
      <p class="sl-muted jl-note">Starting capital, return, drawdown on equity and annualized figures stay “—” until per-strategy capital and a daily equity series are approved. Daily account P&amp;L is not shown until the trading-day (18:00 ET) policy is agreed for Redline.</p>`;

    const posRows = open.flatMap(t => {
      const cs = (t.realBroker?.contracts || []).filter(c => U(c.status) !== 'CLOSED');
      const mark = n(m.marks[contractOf(t)]), dpp = dppOf(t), dir = U(t.direction) === 'SHORT' ? -1 : 1;
      const rows = cs.length ? cs : [{ contractId: null, entryPrice: t.entry?.price, qty: t.qty?.remainingQty }];
      return rows.map(c => { const q = n(c.qty ?? 1), e = n(c.entryPrice); const pl = mark != null && dpp != null && e != null && q != null ? (mark - e) * q * dpp * dir : null; return `<tr><td>${esc(contractOf(t) || '—')}</td><td>${esc(L(t.performanceGroup))}</td><td class="${dir < 0 ? 'down' : 'up'}">${esc(L(t.direction))}</td><td class="number">${q ?? '—'}</td><td class="number">${px(e)}</td><td class="number">${px(mark)}</td><td class="number ${cls(pl)}">${usd(pl)}</td><td class="jr-id">${esc(c.contractId || '—')}</td></tr>`; });
    }).join('');
    const positions = panel(`Current open positions ${tag}`, posRows ? `<div class="table-wrap"><table class="sl-table"><thead><tr><th>Contract</th><th>Account</th><th>Side</th><th>Open qty</th><th>Entry</th><th>Mark</th><th>Live P&amp;L</th><th>Contract ID</th></tr></thead><tbody>${posRows}</tbody></table></div>` : '<p class="sl-muted jl-pad">No open positions.</p>');

    const camp = [...trades].sort((a, b) => Date.parse(b.entry?.time || 0) - Date.parse(a.entry?.time || 0)).map(t => {
      const s = t.summary || {}, cs = t.realBroker?.contracts || [], expanded = ui.open === t.tradeId;
      const detail = expanded ? `<tr class="jr-contracts"><td colspan="9">${cs.length ? `<table><thead><tr><th>Contract ID</th><th>Status</th><th>Entry</th><th>Exit</th><th>Fees</th><th>Closing broker txn</th></tr></thead><tbody>${cs.map(c => `<tr><td class="jr-id">${esc(c.contractId || '—')}</td><td>${esc(L(c.status))}</td><td class="number">${px(c.entryPrice)}</td><td class="number">${px(c.exitPrice)}</td><td class="number">${plain(c.totalFees ?? c.attributedFees ?? c.allocatedFees)}</td><td class="jr-id">${esc(c.closingBrokerTransactionId || '—')}</td></tr>`).join('')}</tbody></table>` : '<p class="sl-muted">No contract records.</p>'}</td></tr>` : '';
      return `<tr><td>${esc(az(t.entry?.time))}</td><td>${esc(contractOf(t) || '—')}</td><td>${esc(L(t.performanceGroup))}</td><td class="${U(t.direction) === 'SHORT' ? 'down' : 'up'}">${esc(L(t.direction))}</td><td><span class="pill ${isOpen(t) ? 'gold' : 'neutral'}">${esc(isOpen(t) ? 'OPEN' : 'CLOSED')}</span></td><td class="number">${n(t.qty?.remainingQty) ?? 0}</td><td class="number ${cls(s.grossRealizedPnL)}">${usd(s.grossRealizedPnL)}</td><td class="number">${plain(s.actualFees)}</td><td class="number ${cls(s.netRealizedPnL)}">${usd(s.netRealizedPnL)}</td><td><button type="button" class="sl-chip" data-jr-open="${esc(t.tradeId)}">${expanded ? '▾' : '▸'} ${cs.length} contracts</button></td></tr>${detail}`;
    }).join('');
    const history = panel(`Campaign history · ${trades.length} campaigns ${tag}`, `<div class="table-wrap"><table class="sl-table jr-table"><thead><tr><th>Opened (AZ)</th><th>Futures</th><th>Account</th><th>Direction</th><th>Status</th><th>Open qty</th><th>Gross P&amp;L</th><th>Fees</th><th>Net recorded</th><th>Contracts</th></tr></thead><tbody>${camp}</tbody></table></div>`);

    const fills = trades.flatMap(t => (t.events || []).filter(e => FILLS.has(U(e.eventType)) && e.brokerTransactionId).map(e => ({ t, e })))
      .sort((a, b) => Date.parse(b.e.fillTime || b.e.ts || 0) - Date.parse(a.e.fillTime || a.e.ts || 0)).slice(0, 12);
    const execs = panel(`Recent broker executions ${tag}`, fills.length ? `<div class="table-wrap"><table class="sl-table"><thead><tr><th>Time (AZ)</th><th>Account</th><th>Contract</th><th>Direction</th><th>Event</th><th>Price</th><th>Qty</th><th>Fees</th><th>Broker txn</th></tr></thead><tbody>${fills.map(({ t, e }) => `<tr><td>${esc(az(e.fillTime || e.ts))}</td><td>${esc(L(t.performanceGroup))}</td><td>${esc(contractOf(t) || '—')}</td><td class="${U(t.direction) === 'SHORT' ? 'down' : 'up'}">${esc(L(t.direction))}</td><td>${esc(L(e.eventType))}</td><td class="number">${px(e.price)}</td><td class="number">${n(e.qty ?? e.fillQuantity ?? e.qtyClosed) ?? '—'}</td><td class="number">${plain(e.totalFees)}</td><td class="jr-id">${esc(e.brokerTransactionId)}</td></tr>`).join('')}</tbody></table></div><p class="sl-muted jl-pad">Only REAL_ENTRY_FILL, REAL_SCALE_IN_FILL, REAL_PARTIAL_EXIT and REAL_FINAL_EXIT with a broker transaction ID count as executions.</p>` : '<p class="sl-muted jl-pad">No broker executions.</p>');

    const legacy = ui.group === 'ALL' ? `<div class="race-section-label"><span>LEGACY · SWING / INTRADAY (PRE-CUTOVER)</span><small>PRESERVED HISTORY · NOT RECLASSIFIED</small></div><div class="stats sl-stats">${LEGACY.map(g => { const s = m.sections[g] || {}; return stat(`${g} · net realized`, usd(s.netRealized), `${s.campaigns ?? '—'} campaigns · ${s.closedContracts ?? '—'} contracts`, s.winRate == null ? 'win rate —' : `win rate ${(s.winRate * 100).toFixed(1)}%`, 'clock', cls(s.netRealized) || 'yellow'); }).join('')}${stat('Unclassified campaigns', String(m.unknown.length), 'not assigned to a strategy', 'shown separately', 'shield', m.unknown.length ? 'down' : 'up')}</div>` : '';

    return `<div class="race-section-label"><span>SEVEN STRATEGY ACCOUNTS</span><small>SELECT AN ACCOUNT FOR ITS POSITIONS, PERFORMANCE AND HISTORY · READ ONLY</small>${tag}</div>${cards}
      <div class="race-section-label"><span>${esc(ui.group === 'ALL' ? 'ALL REAL' : ui.group)} · PERFORMANCE</span><small>ENGINE 10 · ${esc(m.schema || 'engine10.realPerformanceSections.v1')} · READ ONLY</small></div>${stats}${positions}${history}${execs}${legacy}`;
  }

  /* ---------- synthetic sample (not real accounts, prices or IDs) ---------- */
  function sample() {
    const base = Date.parse('2026-11-03T15:00:00Z');
    const iso = h => new Date(base - h * 3600e3).toISOString();
    const mk = (i, group, dir, status, entry, qty, open, gross, fees) => {
      const id = `SAMPLE-CAMPAIGN-${String(i).padStart(3, '0')}`;
      const contracts = Array.from({ length: qty }, (_, k) => ({ contractId: `SAMPLE-CTR-${i}-${k + 1}`, status: k < open ? 'OPEN' : 'CLOSED', entryPrice: entry, exitPrice: k < open ? null : entry + (dir === 'LONG' ? 1 : -1) * (gross / qty / 5), totalFees: fees / qty, closingBrokerTransactionId: k < open ? null : `SAMPLE-TXN-${i}-${k + 1}` }));
      const events = [{ eventType: 'REAL_ENTRY_FILL', brokerTransactionId: `SAMPLE-TXN-${i}-E`, ts: iso(i * 7), price: entry, qty, totalFees: fees / 2 }];
      if (open < qty) events.push({ eventType: open ? 'REAL_PARTIAL_EXIT' : 'REAL_FINAL_EXIT', brokerTransactionId: `SAMPLE-TXN-${i}-X`, ts: iso(i * 7 - 2), price: contracts.at(-1).exitPrice, qty: qty - open, totalFees: fees / 2 }, { eventType: 'TRADE_CLOSED', ts: iso(i * 7 - 2) });
      return { tradeId: id, accountMode: 'REAL', performanceGroup: group, brokerAccountLabel: `SAMPLE_000${GROUPS.indexOf(group) + 1}`, direction: dir, status, symbol: 'MES', futuresContractCode: 'MESZ26', entry: { time: iso(i * 7), price: entry }, qty: { remainingQty: open }, summary: { grossRealizedPnL: open === qty ? 0 : gross, actualFees: fees, netRealizedPnL: (open === qty ? 0 : gross) - fees }, realBroker: { dollarsPerPoint: 5, contracts }, events };
    };
    const trades = [
      mk(1, 'SUBMINUTE', 'LONG', 'OPEN', 7735.0, 1, 1, 0, 2.6), mk(2, 'MINUTE', 'LONG', 'OPEN', 7728.5, 1, 1, 0, 2.6),
      mk(3, 'MINOR', 'LONG', 'OPEN', 7726.25, 2, 1, 62.5, 5.2), mk(4, 'INTERMEDIATE', 'LONG', 'OPEN', 7739.75, 1, 1, 0, 2.6),
      mk(5, 'SUBMICRO', 'SHORT', 'CLOSED', 7690.0, 2, 0, -42.5, 5.2), mk(6, 'MICRO', 'LONG', 'CLOSED', 7655.25, 3, 0, 118.75, 7.8),
      mk(7, 'SUBMINUTE', 'SHORT', 'CLOSED', 7712.0, 2, 0, 87.5, 5.2), mk(8, 'MINUTE', 'LONG', 'CLOSED', 7601.5, 1, 0, -31.25, 2.6),
      mk(9, 'MICRO', 'SHORT', 'CLOSED', 7698.75, 2, 0, 56.25, 5.2), mk(10, 'SUBMICRO', 'LONG', 'CLOSED', 7640.0, 1, 0, 23.75, 2.6)
    ];
    const agg = ts => { const closed = ts.flatMap(t => t.realBroker.contracts.filter(c => c.status === 'CLOSED')); const g = ts.reduce((a, t) => a + t.summary.grossRealizedPnL, 0), f = ts.reduce((a, t) => a + t.summary.actualFees, 0); const w = ts.filter(t => t.summary.grossRealizedPnL > 0).length, l = ts.filter(t => t.summary.grossRealizedPnL < 0).length; return { campaigns: ts.length, openContracts: ts.reduce((a, t) => a + t.qty.remainingQty, 0), closedContracts: closed.length, grossRealized: g, fees: f, netRealized: g - f, winningContracts: w, losingContracts: l, breakevenContracts: 0, winRate: w + l ? w / (w + l) : null, profitFactor: null, maxDrawdown: null }; };
    const sections = Object.fromEntries([...LEGACY, ...GROUPS].map(g => [g, { group: g, ...agg(trades.filter(t => t.performanceGroup === g)) }]));
    return adapt({ trades }, { ok: true, schema: 'engine10.realPerformanceSections.v1', sections, allReal: agg(trades), unknownRealCampaigns: [] }, { MESZ26: 7743.0 });
  }

  document.addEventListener('click', ev => {
    const g = ev.target.closest?.('[data-jr-group]'), o = ev.target.closest?.('[data-jr-open]');
    if (g) ui.group = g.dataset.jrGroup; else if (o) ui.open = ui.open === o.dataset.jrOpen ? null : o.dataset.jrOpen; else return;
    if (typeof render === 'function') render();
  });

  window.redlineRealJournal = { adapt, view, sample, ui };
})();
