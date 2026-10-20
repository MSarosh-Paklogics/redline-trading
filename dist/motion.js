/* Presentation motion only. Never changes prices, orders, signals or engine state. */
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let previousPage = null;
  const baseBind = bindPage;
  let running = [];
  const enabled = () => !reduce.matches && !state.settings.reduced;
  bindPage = function () {
    baseBind();
    running.forEach(cancelAnimationFrame);
    running = [];
    const main = document.querySelector('main');
    if (!main) return;
    const entering = previousPage !== page;
    previousPage = page;
    if (!enabled()) return;
    if (entering) {
      main.classList.add('motion-enter');
      const cards = [...main.querySelectorAll('.stat, .panel, .engine-ribbon-item')];
      cards.forEach((el, i) => {
        el.style.setProperty('--enter-delay', `${Math.min(i * 35, 250)}ms`);
        el.classList.add('motion-card');
      });
      main.querySelectorAll('.equity-chart polyline[stroke="#f4495d"]').forEach(line => {
        line.setAttribute('pathLength', '1');
        line.classList.add('motion-line');
      });
      main.querySelectorAll('.stat-value').forEach(el => {
        const final = el.textContent;
        const match = final.match(/^([+−\-$]*)([\d,]+(?:\.\d+)?)(%|R)?$/);
        if (!match) return;
        const value = Number(match[2].replace(/,/g, ''));
        const decimals = (match[2].split('.')[1] || '').length;
        if (!Number.isFinite(value) || value < 10) return;
        el.setAttribute('aria-label', final);
        const start = performance.now();
        const tick = now => {
          if (!el.isConnected || !enabled()) { el.textContent = final; return; }
          const t = Math.min((now - start) / 780, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          const n = value * (.92 + .08 * eased);
          el.textContent = match[1] + n.toLocaleString('en-US', {
            minimumFractionDigits: decimals, maximumFractionDigits: decimals,
            useGrouping: match[2].includes(',')
          }) + (match[3] || '');
          if (t < 1) running.push(requestAnimationFrame(tick));
          else el.textContent = final;
        };
        running.push(requestAnimationFrame(tick));
      });
    }
  };
  document.addEventListener('pointerdown', event => {
    if (!enabled() || event.button !== 0) return;
    const button = event.target.closest('.btn, .icon-btn, .segmented button');
    if (!button || button.disabled) return;
    const rect = button.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'motion-ripple';
    ripple.setAttribute('aria-hidden', 'true');
    ripple.style.left = `${event.clientX - rect.left}px`;
    ripple.style.top = `${event.clientY - rect.top}px`;
    button.appendChild(ripple);
    setTimeout(() => ripple.remove(), 550);
  });
  // Apply the first entrance after all reference-aware page extensions load.
  bindPage();
})();
