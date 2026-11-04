'use strict';
/* Professional motion layer on top of motion.js. Presentation only: never changes prices,
   signals, engine state or orders.
   - Entering a page: staggered reveal of tiles, cards, ladders, gauges and table rows, and gauge
     needles sweep up to their reading. Runs once per page visit, not on live refreshes.
   - Live refresh: any signal or stat value that changed since the last render flashes briefly,
     so updates are visible without the page jumping.
   Disabled by prefers-reduced-motion and by the app's own "reduced motion" setting. */
(() => {
  if (typeof bindPage !== 'function') return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const enabled = () => !reduce.matches && !(typeof state !== 'undefined' && state.settings?.reduced);
  const REVEAL = ['.db-signal', '.db-step', '.db-tabs', '.sl-rung', '.sl-card', '.race-meter', '.jr-account', '.ce-card', '.stat', '.panel', '.live-snapshot-panel', '.sl-status', '.jl-filters', '.race-section-label', '.jl-locked'];
  let shown = new Set();   // element types already revealed on this page visit
  const WATCH = '.db-signal strong, .db-step strong, .stat-value, .sl-rung strong, .sl-head, .sl-kv b, .ce-kv b, .race-dial-value, .live-snapshot-values b';
  let lastPage = null, lastValues = new Map(), timer = 0;

  const keyOf = (el, i) => `${el.closest('[data-db-pane],[data-sl-degree],.db-signal,.stat,.sl-card,.panel')?.textContent?.slice(0, 40) || ''}#${i}`;

  const base = bindPage;
  bindPage = function () {
    base.apply(this, arguments);
    const main = document.querySelector('main') || document.querySelector('#main');
    const pg = typeof page !== 'undefined' ? page : location.hash;
    const entering = pg !== lastPage;
    lastPage = pg;
    if (!main || !enabled()) { lastValues = new Map(); return; }

    const hero = main.querySelector('.race-hero');
    if (hero && !hero.querySelector('.mp-sheen')) hero.insertAdjacentHTML('afterbegin', '<i class="mp-sheen" aria-hidden="true"></i>');
    const values = [...main.querySelectorAll(WATCH)];
    if (entering) shown = new Set();
    // Reveal each element type the first time it appears on this page (live content arrives after
    // the first render), so the reveal plays once per visit, not on every refresh.
    const fresh = REVEAL.filter(sel => !shown.has(sel) && main.querySelector(sel));
    if (fresh.length) {
      document.body.classList.add('mp-entering');
      clearTimeout(timer);
      timer = setTimeout(() => document.body.classList.remove('mp-entering'), 1600);
      [...main.querySelectorAll(fresh.join(','))].forEach((el, i) => {
        el.style.setProperty('--mp-delay', `${Math.min(i * 28, 520)}ms`);
        el.classList.add('mp-reveal');
      });
      if (!shown.has('tbody')) main.querySelectorAll('tbody').forEach(tb => [...tb.rows].slice(0, 18).forEach((tr, i) => {
        tr.style.setProperty('--mp-delay', `${120 + i * 22}ms`);
        tr.classList.add('mp-row');
      }));
      if (main.querySelector('tbody tr')) shown.add('tbody');
      fresh.forEach(sel => shown.add(sel));
    }
    if (!entering) {
      // Same page re-rendered by live data: flash only what changed.
      values.forEach((el, i) => {
        const k = keyOf(el, i), prev = lastValues.get(k);
        if (prev != null && prev !== el.textContent) {
          el.classList.add('mp-flash');
          setTimeout(() => el.classList.remove('mp-flash'), 1300);
        }
      });
    }
    lastValues = new Map(values.map((el, i) => [keyOf(el, i), el.textContent]));
  };
})();
