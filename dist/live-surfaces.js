'use strict';
/* Live Frye backend panels, rendered above the demo content of each route.
   Read-only: every value shown comes from a backend response; a failed or ok:false
   read renders as UNAVAILABLE, and each status pill says how many reads succeeded.
   app.js rebuilds #app on every render, so panels are kept here and re-attached. */
(() => {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const label = v => v == null || v === '' ? '—' : String(v).replace(/_/g, ' ');
  const num = (v, d = 1) => v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(d);
  const TONES = { good: ['bull', 'bullish', 'up', 'long', 'success', 'go', 'allow', 'allowed', 'permitted', 'ok', 'current'], bad: ['bear', 'bearish', 'down', 'danger', 'high', 'stand_down', 'block', 'blocked', 'broad_deterioration', 'negative', 'stale'], warn: ['neutral', 'warn', 'watch', 'caution', 'mixed', 'medium', 'wait'] };
  const tone = v => { const s = String(v || '').toLowerCase(); for (const [t, words] of Object.entries(TONES)) if (words.some(w => s === w || s.startsWith(w + '_') || s.endsWith('_' + w))) return t; return ''; };
  const cell = (title, value, detail, t = tone(value)) => `<div class="live-engine-cell"><span>${esc(title)}</span><strong class="${t ? 'live-' + t : ''}" title="${esc(label(value))}">${esc(label(value))}</strong><small title="${esc(detail)}">${esc(detail ?? '')}</small></div>`;
  const head = (eyebrow, title) => `<div class="live-meter-board-head"><div><span class="eyebrow">${esc(eyebrow)}</span><strong>${esc(title)}</strong><small data-live-updated>Reading canonical backend…</small></div><span class="pill gold" data-live-status>CONNECTING</span></div>`;
  const setStatus = (el, okCount, total) => {
    const pill = el.querySelector('[data-live-status]');
    const [text, t] = okCount === total ? ['LIVE BACKEND', 'green'] : okCount ? [`PARTIAL ${okCount}/${total}`, 'gold'] : ['UNAVAILABLE', 'red'];
    pill.textContent = text; pill.className = `pill ${t}`;
  };
  const settle = reads => Promise.allSettled(reads).then(rs => rs.map(r => r.status === 'fulfilled' ? r.value.data : null));
  const stamp = (el, text) => { el.querySelector('[data-live-updated]').textContent = text; };
  const ageDays = ts => { const t = Date.parse(String(ts).replace(' ', 'T')); return Number.isNaN(t) ? null : (Date.now() - t) / 864e5; };
  // Backend marks the 4H and EOD meter formulas as placeholders (futures-market-meter-v2-spy-style-10m-30m-1h).
  const PLACEHOLDER_TFS = new Set(['4h', '1d', 'EOD']);

  /* ---------- #/overview — Dashboard ---------- */
  async function dashboard(el) {
    const api = window.redlineApi;
    const [snap, e25, e29, sectors] = await settle([api.snapshotShared('ES'), api.engine25Summary(), api.engine29Summary(), api.sectors()]);
    const mm = snap?.marketMind || {};
    const meters = [['10m', 'score10m', 'state10m'], ['30m', 'score30m', 'state30m'], ['1h', 'score1h', 'state1h'], ['4h', 'score4h', 'state4h'], ['EOD', 'scoreEOD', 'stateEOD']];
    const d29 = e29?.data || {};
    const cards = sectors?.sectorCards || [];
    el.querySelector('[data-live-body]').innerHTML = `
      <div class="live-section-title">MARKET MIND · ES ${snap ? '' : '· UNAVAILABLE'}</div>
      <div class="live-meter-grid">${meters.map(([tf, sk, stk]) => `<div class="live-meter-cell"><span>${tf}${PLACEHOLDER_TFS.has(tf) ? ' · FORMULA PENDING' : ''}</span><strong>${num(mm[sk])}</strong><small class="live-${tone(mm[stk])}">${esc(label(mm[stk] ?? 'UNAVAILABLE'))}</small></div>`).join('')}</div>
      <div class="live-section-title">MARKET CONFIRMATION</div>
      <div class="live-engine-grid">
        ${cell('E25 MARKET HEALTH', e25 ? e25.regime : 'UNAVAILABLE', e25 ? `Score ${num(e25.score, 0)} · ${label(e25.bias)}` : '')}
        ${cell('E25 RISK', e25?.riskLevel ?? 'UNAVAILABLE', e25?.esPermission ? `Size ×${e25.esPermission.sizeMultiplier}` : '')}
        ${cell('E25 ES MODE', e25?.esPermission?.mode ?? 'UNAVAILABLE', e25?.esPermission?.technicalState ? label(e25.esPermission.technicalState) : '')}
        ${cell('E29 CROSS-MARKET', e29 ? d29.overallState : 'UNAVAILABLE', e29 ? `Tactical ${label(d29.tacticalState)}${d29.dataDegraded ? ' · DATA DEGRADED' : ''}` : '')}
        ${cell('E29 ES/NQ BACKDROP', e29 ? d29.esNqBackdrop : 'UNAVAILABLE', e29 ? `${label(d29.moveCharacter)} · ${label(d29.moveConfidence)}` : '')}
        ${cell('NEWS RISK', snap?.newsRisk ? (snap.newsRisk.stale ? 'STALE' : snap.newsRisk.riskLevel) : 'UNAVAILABLE', snap?.newsRisk ? `${label(snap.newsRisk.category)} · ${snap.newsRisk.headline || ''}` : '')}
      </div>
      ${e25?.summary?.plainEnglish ? `<p class="live-note">${esc(e25.summary.plainEnglish)}</p>` : ''}
      <div class="live-section-title">SECTORS · 10M ${sectors ? `· ${esc(sectors.version || '')}` : '· UNAVAILABLE'}</div>
      ${cards.length ? `<div class="table-wrap"><table class="live-table"><thead><tr><th>Sector</th><th>Breadth %</th><th>Momentum %</th><th>NH / NL</th><th>Up / Down</th><th>Outlook</th></tr></thead><tbody>${cards.map(c => `<tr><td>${esc(c.sector)}</td><td class="number">${num(c.breadth_pct)}</td><td class="number">${num(c.momentum_pct)}</td><td class="number">${esc(c.nh ?? '—')} / ${esc(c.nl ?? '—')}</td><td class="number">${esc(c.up ?? '—')} / ${esc(c.down ?? '—')}</td><td class="live-${tone(c.outlook)}">${esc(label(c.outlook))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="live-note">Sector cards unavailable.</p>'}`;
    stamp(el, `Snapshot ${snap?.now || '—'} · E25 ${e25?.servedAt || '—'} · E29 ${d29.timestamp || '—'}`);
    setStatus(el, [snap, e25, e29, sectors].filter(Boolean).length, 4);
  }

  /* ---------- #/strategies — Strategies ---------- */
  async function strategies(el) {
    const [snap] = await settle([window.redlineApi.snapshotShared('ES')]);
    const list = Object.entries(snap?.strategies || {});
    el.querySelector('[data-live-body]').innerHTML = list.length ? `
      <p class="live-note">Structure, readiness, geometry and permission are separate decisions. Only Engine 6 permission allows a trade; "ready" is not "permitted".</p>
      ${list.map(([id, st]) => {
        const e23 = st.engine23Interpretation || {}, e15 = st.engine15 || {}, e26 = st.engine26ProposedGeometry || {}, e6 = st.permission || {};
        return `<div class="live-strategy">
          <div class="live-strategy-head"><strong>${esc(id)}</strong><small>${esc(label(st.degree))} · ${esc(st.wave || '—')} · ${esc(st.tf || '')}</small></div>
          <div class="live-engine-grid live-strategy-grid">
            ${cell('STRUCTURE · E23', e23.state ?? 'UNAVAILABLE', [e23.health && `Health ${label(e23.health)}`, e23.activeDegree && `${label(e23.activeDegree)} degree`, e23.preferredEntry && label(e23.preferredEntry)].filter(Boolean).join(' · '))}
            ${cell('READINESS · E15', e15.readiness ?? 'UNAVAILABLE', [e15.direction && `Dir ${e15.direction}`, e15.action && label(e15.action)].filter(Boolean).join(' · '))}
            ${cell('GEOMETRY · E26', e26.status ?? 'UNAVAILABLE', e26.direction ? `Direction ${label(e26.direction)}` : '')}
            ${cell('PERMISSION · E6', e6.permission ?? 'UNAVAILABLE', e6.permission ? `Size ×${e6.sizeMultiplier ?? '—'} · ${e6.asOf || ''}` : '')}
          </div>
          ${e15.summary ? `<p class="live-note">${esc(e15.summary)}</p>` : ''}
        </div>`;
      }).join('')}` : '<p class="live-note">Strategy snapshot unavailable.</p>';
    stamp(el, `Snapshot ${snap?.now || '—'} · ${list.length} strategies`);
    setStatus(el, snap ? 1 : 0, 1);
  }

  /* ---------- #/chart — engine evidence ---------- */
  async function chartEngines(el) {
    const api = window.redlineApi;
    const [e3, e4, waves, e25, e29] = await settle([api.engine3('ES'), api.engine4('ES'), api.activeWaves('ES'), api.engine25Summary(), api.engine29Summary()]);
    const v4 = e4?.engine4EsVolume || {};
    const waveAge = waves ? ageDays(waves.updatedAt) : null;
    el.querySelector('[data-live-body]').innerHTML = `<div class="live-engine-grid">
      ${cell('E3 REACTION', e3 ? e3.reaction?.state : 'UNAVAILABLE', e3 ? `${label(e3.reaction?.quality)} · ${label(e3.reaction?.bias)} · zone ${e3.zone?.lo ?? '—'}–${e3.zone?.hi ?? '—'}` : '')}
      ${cell('E4 VOLUME', e4 ? v4.participationState : 'UNAVAILABLE', e4 ? `${label(v4.volumeTrend)} · RVOL ${num(v4.relativeVolume, 2)}` : '')}
      ${cell('E22 ACTIVE WAVES', waves ? (waveAge != null && waveAge > 2 ? 'STALE' : 'CURRENT') : 'UNAVAILABLE', waves ? `As of ${waves.updatedAt} · ${(waves.activeDegreeKeys || []).join(', ')}` : '')}
      ${cell('E25 MARKET HEALTH', e25 ? e25.regime : 'UNAVAILABLE', e25 ? `${label(e25.bias)} · risk ${label(e25.riskLevel)}` : '')}
      ${cell('E29 STRESS', e29 ? e29.data?.overallState : 'UNAVAILABLE', e29 ? `Tactical ${label(e29.data?.tacticalState)}` : '')}
      ${cell('ES PRICE · E3', e3 ? num(e3.price, 2) : 'UNAVAILABLE', e3?.meta?.resolvedSymbol ? `Contract ${e3.meta.resolvedSymbol}` : '', '')}
    </div>`;
    stamp(el, `Read ${new Date().toISOString()}`);
    setStatus(el, [e3, e4, waves, e25, e29].filter(Boolean).length, 5);
  }

  /* ---------- #/meters — market meter ---------- */
  async function meters(el) {
    const [m] = await settle([window.redlineApi.marketMeter('ES')]);
    const lights = m?.lights || {};
    el.querySelector('[data-live-body]').innerHTML = `<div class="live-meter-grid">${['10m', '30m', '1h', '4h', '1d'].map(tf => { const d = lights[tf] || {}; return `<div class="live-meter-cell"><span>${tf.toUpperCase()}${PLACEHOLDER_TFS.has(tf) ? ' · FORMULA PENDING' : ''}</span><strong>${num(d.score)}</strong><small class="live-${tone(d.state)}">${esc(label(d.state ?? 'UNAVAILABLE'))}</small></div>`; }).join('')}</div>${m?.master ? `<p class="live-note">Master ${num(m.master.score)} · ${esc(label(m.master.state))} (weighted; includes the pending 4H/EOD formulas)</p>` : ''}`;
    stamp(el, `Updated ${m?.updated_at_utc || '—'}`);
    setStatus(el, m ? 1 : 0, 1);
  }

  const SURFACES = {
    overview: ['LIVE DASHBOARD', 'ES market state from the Frye engines', dashboard],
    strategies: ['LIVE STRATEGIES', 'Canonical ES strategy decisions', strategies],
    chart: ['LIVE ENGINE CONTEXT', 'Canonical ES engine evidence', chartEngines],
    meters: ['LIVE CLIENT MARKET METER', 'ES multi-timeframe condition', meters]
  };
  const surfaces = {};
  const routeKey = () => (location.hash.slice(2).split(/[?/]/)[0]) || 'overview';
  function place() {
    const main = document.querySelector('#main'); if (!main) return;
    const key = routeKey();
    for (const [k, el] of Object.entries(surfaces)) {
      if (k === key && !main.contains(el)) main.prepend(el);
      if (k !== key) el.remove();
    }
  }
  function load(key, force) {
    const def = SURFACES[key]; if (!def || !window.redlineApi) return;
    let el = surfaces[key];
    if (!el) {
      el = document.createElement('section'); el.className = 'live-meter-board live-surface'; el.dataset.liveSurface = key;
      el.innerHTML = head(def[0], def[1]) + '<div data-live-body><p class="live-note">Loading…</p></div>';
      surfaces[key] = el; force = true;
    }
    place();
    if (force) def[2](el).catch(() => setStatus(el, 0, 1));
  }
  const app = document.querySelector('#app');
  if (app) new MutationObserver(place).observe(app, { childList: true });
  window.addEventListener('hashchange', () => setTimeout(() => load(routeKey()), 60));
  setTimeout(() => load(routeKey()), 150);
  setInterval(() => load(routeKey(), true), 60000);
})();
