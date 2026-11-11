'use strict';
/* SaaS-style in-page navigation (presentation only).
   On every long page, builds a sticky "jump to" bar from the page's visible section headings
   (.race-section-label, the dashboard engine tabs, page panels' section labels), highlights the
   section in view as you scroll, glides to a section on click, and shows a back-to-top button.
   Rebuilt after each render; no data or engine logic. */
(() => {
  if (typeof bindPage !== 'function') return;
  const MIN_SECTIONS = 3, BAR_GAP = 14;
  let items = [], raf = 0;

  const label = el => {
    const raw = (el.dataset.navLabel || el.querySelector('span')?.textContent || el.textContent || '').trim();
    const head = raw.split('·')[0].trim() || raw;
    return head.toLowerCase().replace(/\b(e\d+|es|spy|qqq|vix|1h|4h|10m|30m|eod|ai)\b/g, s => s.toUpperCase()).replace(/^./, c => c.toUpperCase());
  };
  const visible = el => el.offsetParent !== null && el.getClientRects().length > 0;

  function build() {
    document.querySelector('.page-nav')?.remove();
    const main = document.querySelector('#main');
    if (!main || (typeof page !== 'undefined' && page === 'chart')) { items = []; return; }
    let heads = [...main.querySelectorAll('.race-section-label, .db-tabs, .sf-views')].filter(visible);
    // Pages built from panels (X-Ray, Journal, Meters…): use the top-level panel titles instead.
    if (heads.length < MIN_SECTIONS) {
      heads = [...main.querySelectorAll(':scope > .panel, :scope > .grid > .panel, :scope > .race-full-cluster, :scope > .jl-modes')].filter(visible).slice(0, 14);
      heads.forEach(h => { const t = h.querySelector('.panel-title'); h.dataset.navLabel = t ? t.textContent : h.matches('.race-full-cluster') ? 'Instrument cluster' : h.matches('.jl-modes') ? 'Journal mode' : ''; });
    }
    heads.forEach(h => { if (h.matches('.db-tabs')) h.dataset.navLabel = h.matches('.jl-modes') ? 'Journal mode' : h.matches('.sf-views') ? 'Views' : 'Engine detail'; });
    const seen = new Set();
    items = heads.map((el, i) => ({ el, id: el.id || (el.id = `sec-${i}`), text: label(el) })).filter(it => it.text && !seen.has(it.text) && seen.add(it.text));
    if (items.length < MIN_SECTIONS) { items = []; return; }
    const bar = document.createElement('nav');
    bar.className = 'page-nav';
    bar.setAttribute('aria-label', 'Sections on this page');
    bar.innerHTML = `<span class="page-nav-label">ON THIS PAGE</span><div class="page-nav-track">${items.map((it, i) => `<button type="button" data-nav-to="${it.id}" class="${i ? '' : 'on'}">${it.text}</button>`).join('')}</div>` + signalBadge();
    const first = main.querySelector('.page-head') || main.querySelector('.race-hero');
    (first ? first.nextSibling ? main.insertBefore(bar, first.nextSibling) : main.appendChild(bar) : main.prepend(bar));
    spy();
  }

  /* Live trade signal at the right end of the bar (client request 2026-11-12). Mirrors the backend
     only: Engine 6 is the final permission (ALLOW / REDUCE / STAND_DOWN) and the direction is the
     Engine 17 bias. BUY / SELL shows only when Engine 6 allows the trade; otherwise NO TRADE.
     A signal, never an order (Redline places no trades). */
  function signalBadge() {
    const cm = window.redlineChart?.model;
    if (!cm) return '';
    const e6 = cm.e6 || {}, perm = String(e6.permission || '').toUpperCase();
    const bias = String(Object.fromEntries(cm.pills || []).BIAS || '').toUpperCase();
    const dir = /LONG/.test(bias) ? 'LONG' : /SHORT/.test(bias) ? 'SHORT' : null;
    const allowed = perm === 'ALLOW' || perm === 'REDUCE';
    const sym = String(e6.symbol || cm.symbol || 'ES').toUpperCase(), tf = e6.tf || cm.tf || '';
    let text, tone, sub;
    if (!perm) { text = 'SIGNAL UNAVAILABLE'; tone = 'na'; sub = 'Engine 6 not published'; }
    else if (allowed && dir) { text = dir === 'LONG' ? 'BUY SIGNAL' : 'SELL SIGNAL'; tone = dir === 'LONG' ? 'buy' : 'sell'; sub = `E6 ${perm}${perm === 'REDUCE' ? ' size' : ''} ×${e6.sizeMultiplier ?? '—'} · E17 ${dir}`; }
    else if (allowed) { text = 'NO DIRECTION'; tone = 'wait'; sub = `E6 ${perm} · E17 bias ${bias || 'unavailable'}`; }
    else { text = 'NO TRADE'; tone = 'wait'; sub = `E6 ${perm.replace(/_/g, ' ')} · E17 ${bias || '—'}`; }
    return `<div class="pn-signal pn-${tone}" title="Engine 6 final permission + Engine 17 bias for ${sym}. A signal only — Redline places no orders."><span class="pn-sym">${sym}${tf ? ' · ' + tf : ''}</span><b>${text}</b><small>${sub}</small></div>`;
  }

  function offset() { return (document.querySelector('.page-nav')?.offsetHeight || 0) + BAR_GAP + 8; }

  function spy() {
    raf = 0;
    const bar = document.querySelector('.page-nav'); if (!bar || !items.length) return;
    const y = offset() + 30;
    let cur = items[0];
    for (const it of items) if (it.el.getBoundingClientRect().top <= y) cur = it;
    bar.querySelectorAll('[data-nav-to]').forEach(b => {
      const on = b.dataset.navTo === cur.id;
      // Centre the active button inside the bar only (scrollIntoView would also scroll the page).
      if (on && !b.classList.contains('on')) { const tr = b.parentElement; tr.scrollLeft = b.offsetLeft - tr.clientWidth / 2 + b.offsetWidth / 2; }
      b.classList.toggle('on', on);
    });
    bar.classList.toggle('stuck', bar.getBoundingClientRect().top <= 1);
    document.querySelector('.to-top')?.classList.toggle('show', window.scrollY > 700);
  }

  document.addEventListener('click', ev => {
    const b = ev.target.closest?.('[data-nav-to]');
    if (b) {
      const el = document.getElementById(b.dataset.navTo); if (!el) return;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset(), behavior: reduce ? 'auto' : 'smooth' });
      return;
    }
    if (ev.target.closest?.('.to-top')) window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
  window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(spy); }, { passive: true });
  window.addEventListener('resize', () => { if (!raf) raf = requestAnimationFrame(spy); });

  const top = document.createElement('button');
  top.type = 'button'; top.className = 'to-top'; top.setAttribute('aria-label', 'Back to top'); top.textContent = '↑';
  document.body.appendChild(top);

  const base = bindPage;
  bindPage = function () { base.apply(this, arguments); build(); };
  // Tabs inside a page (dashboard engine tabs, strategies views) change which sections are visible.
  document.addEventListener('click', ev => { if (ev.target.closest?.('[data-db-tab],[data-sl-view],[data-jl-mode]')) setTimeout(build, 30); }, true);
  build();
})();
