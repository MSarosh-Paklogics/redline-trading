'use strict';
/* TradingView-style chart controls for the Redline chart terminal:
   - drag the chart: pan through time (left/right) and price (up/down), redrawn live
   - drag the price axis (right edge): stretch or squeeze the price scale
   - double-click the price axis or press Home / the reset button: back to auto scale
   - mouse wheel: zoom in/out on time; Shift+wheel or trackpad sideways: scroll through time
   - keyboard on the focused chart: ←/→ pan, ↑/↓ move price, +/- zoom, Home reset
   Listens in the capture phase so a drag isn't also applied by the terminal's
   release-to-jump handler. Drawing mode and editable levels keep their own handlers.
   Vertical state lives in window.redlineChartView and is read by chartGeometry(). */
(() => {
  const view = window.redlineChartView = { yZoom: 1, yShift: 0 };
  const AXIS_FRACTION = 830 / 900;           // price labels sit right of x=830 in the 900-wide viewBox
  const PLOT_W = 822 / 900, PLOT_H = 290 / 400;
  const MIN_BARS = 20, MAX_BARS = 600;
  let drag = null, frameKey = null, raf = 0;

  const frameOf = t => t?.closest?.('.chart-frame');
  const total = () => (typeof barTotal === 'function' ? barTotal() : 180);
  const clampOffset = v => Math.max(0, Math.min(Math.max(0, total() - barCount), v));
  const resetView = () => { view.yZoom = 1; view.yShift = 0; };
  const redraw = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const svg = document.querySelector('.chart-frame > svg');
      if (svg && typeof chartSVG === 'function') svg.outerHTML = chartSVG();
    });
  };
  const onAxis = (frame, clientX) => { const r = frame.getBoundingClientRect(); return clientX - r.left > r.width * AXIS_FRACTION; };

  // New symbol or timeframe starts from the auto price scale.
  setInterval(() => {
    const key = typeof symbol !== 'undefined' ? `${symbol}:${tf}` : null;
    if (key !== frameKey) { frameKey = key; resetView(); }
  }, 400);

  document.addEventListener('pointerdown', e => {
    const frame = frameOf(e.target);
    if (!frame || e.button !== 0 || (typeof drawMode !== 'undefined' && drawMode) || e.target.closest('[data-edit-level]')) return;
    const g = typeof chartGeometry === 'function' ? chartGeometry() : null;
    const r = frame.getBoundingClientRect();
    drag = { frame, x: e.clientX, y: e.clientY, moved: false, axis: onAxis(frame, e.clientX), offset: chartOffset, yShift: view.yShift, yZoom: view.yZoom,
      barsPerPx: barCount / (r.width * PLOT_W), pricePerPx: g ? (g.max - g.min) / (r.height * PLOT_H) : 0 };
  }, true);

  document.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    drag.frame.classList.add('is-dragging');
    if (drag.axis) {
      view.yZoom = Math.max(0.05, Math.min(20, drag.yZoom * Math.exp(dy * 0.006)));
    } else {
      chartOffset = clampOffset(drag.offset + Math.round(dx * drag.barsPerPx));
      view.yShift = drag.yShift + dy * drag.pricePerPx;
    }
    redraw();
  }, true);

  const endDrag = e => {
    if (!drag) return;
    const wasDrag = drag.moved;
    drag.frame.classList.remove('is-dragging');
    drag = null;
    if (wasDrag) { e.stopPropagation(); e.preventDefault?.(); }
  };
  document.addEventListener('pointerup', endDrag, true);
  document.addEventListener('pointercancel', endDrag, true);

  document.addEventListener('wheel', e => {
    const frame = frameOf(e.target);
    if (!frame) return;
    e.preventDefault(); e.stopPropagation();
    const sideways = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
    if (sideways) {
      const d = e.shiftKey ? e.deltaY : e.deltaX;
      chartOffset = clampOffset(chartOffset + Math.sign(d) * -Math.max(1, Math.round(barCount * 0.05)));
    } else {
      barCount = Math.max(MIN_BARS, Math.min(Math.min(MAX_BARS, total()), Math.round(barCount * (e.deltaY > 0 ? 1.12 : 0.89))));
      chartOffset = clampOffset(chartOffset);
    }
    redraw();
  }, { capture: true, passive: false });

  document.addEventListener('dblclick', e => {
    const frame = frameOf(e.target);
    if (!frame || !onAxis(frame, e.clientX)) return;
    e.stopPropagation(); resetView(); redraw();
  }, true);

  document.addEventListener('keydown', e => {
    if (!frameOf(document.activeElement) || e.ctrlKey || e.metaKey || e.altKey) return;
    const step = e.shiftKey ? 20 : 5, g = typeof chartGeometry === 'function' ? chartGeometry() : null, pStep = g ? (g.max - g.min) * 0.05 : 0;
    const keys = {
      ArrowLeft: () => { chartOffset = clampOffset(chartOffset + step); },
      ArrowRight: () => { chartOffset = clampOffset(chartOffset - step); },
      ArrowUp: () => { view.yShift += pStep; },
      ArrowDown: () => { view.yShift -= pStep; },
      '+': () => { barCount = Math.max(MIN_BARS, Math.round(barCount * 0.85)); },
      '=': () => { barCount = Math.max(MIN_BARS, Math.round(barCount * 0.85)); },
      '-': () => { barCount = Math.min(Math.min(MAX_BARS, total()), Math.round(barCount * 1.15)); chartOffset = clampOffset(chartOffset); },
      Home: () => { chartOffset = 0; resetView(); }
    };
    if (!keys[e.key]) return;
    e.preventDefault(); e.stopPropagation(); keys[e.key](); redraw();
  }, true);

  // Live data refreshes call render(), which rebuilds the page; keep the scroll position of the
  // scrollable panels and the page so a refresh doesn't jump the user back to the top.
  const SCROLLERS = ['.terminal-inspector-content', '.terminal-drawer-content', '.terminal-drawer', '.workspace'];
  if (typeof render === 'function') {
    const baseRender = render;
    render = function () {
      const hash = location.hash, pageY = window.scrollY;
      const saved = SCROLLERS.map(sel => [sel, document.querySelector(sel)?.scrollTop || 0]);
      const out = baseRender.apply(this, arguments);
      if (location.hash === hash) {
        saved.forEach(([sel, top]) => { const el = document.querySelector(sel); if (el && top) el.scrollTop = top; });
        if (pageY) window.scrollTo(0, pageY);
      }
      return out;
    };
  }

  // The terminal's reset button also restores the auto price scale.
  document.addEventListener('click', e => { if (e.target.closest?.('[data-action="reset-chart"]')) resetView(); }, true);
})();
