'use strict';
/* Optional interactive 3D car in the command screen (presentation only, LOCAL DEMO).
   If assets/local/enzo.glb exists (or window.REDLINE_CAR_MODEL points at a model), the car photo
   in the command screen is replaced by a rotatable 3D model rendered with Google's <model-viewer>
   web component, loaded from a CDN only in that case. assets/local/ is git-ignored and excluded
   from builds: the bundled Enzo model is CC-BY-NC-SA 4.0 (non-commercial), so it must never be
   deployed. Without the file, nothing changes and the licensed F80 photo stays.
   One viewer element is created once and re-attached after each render, so the model loads once. */
(() => {
  if (typeof bindPage !== 'function') return;
  const SRC = window.REDLINE_CAR_MODEL || 'assets/local/enzo.glb';
  const VIEWER = 'https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js';
  const CREDIT = '“2002 Ferrari Enzo” by Ddiaz Design (Sketchfab) · CC BY-NC-SA 4.0 · local demo only';
  let state = 'unknown', el = null, wrap = null;

  async function probe() {
    try { const r = await fetch(SRC, { method: 'HEAD', cache: 'no-store' }); state = r.ok ? 'yes' : 'no'; } catch { state = 'no'; }
    if (state !== 'yes') return;
    if (!customElements.get('model-viewer')) { const s = document.createElement('script'); s.type = 'module'; s.src = VIEWER; document.head.appendChild(s); }
    attach();
  }

  function make() {
    wrap = document.createElement('div');
    wrap.className = 'cs-model';
    el = document.createElement('model-viewer');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const attrs = {
      src: SRC, alt: '3D Ferrari Enzo (local demo model)', 'camera-controls': '', 'touch-action': 'pan-y',
      'interaction-prompt': 'none', 'shadow-intensity': '1.1', 'shadow-softness': '0.9', exposure: '1.05',
      'environment-image': 'neutral', 'camera-orbit': '32deg 66deg 78%', 'field-of-view': '28deg',
      'min-camera-orbit': 'auto 20deg auto', 'max-camera-orbit': 'auto 88deg auto', poster: 'assets/car-3d.jpg', loading: 'eager'
    };
    if (!reduce) { attrs['auto-rotate'] = ''; attrs['rotation-per-second'] = '14deg'; attrs['auto-rotate-delay'] = '1500'; }
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    el.addEventListener('load', () => wrap.classList.add('ready'));
    el.addEventListener('progress', e => { const p = Math.round((e.detail?.totalProgress || 0) * 100); wrap.style.setProperty('--load', `${p}%`); wrap.dataset.load = p < 100 ? `${p}%` : ''; });
    el.addEventListener('error', () => { state = 'no'; wrap.remove(); document.querySelectorAll('.cs-car3d.has-model').forEach(h => h.classList.remove('has-model')); });
    const credit = document.createElement('small');
    credit.className = 'cs-model-credit';
    credit.textContent = CREDIT;
    wrap.append(el, credit);
  }

  function attach() {
    if (state !== 'yes') return;
    const host = document.querySelector('.cs-car3d'); if (!host) return;
    if (!wrap) make();
    if (wrap.parentNode !== host) host.appendChild(wrap);
    host.classList.add('has-model');
  }

  const base = bindPage;
  bindPage = function () { base.apply(this, arguments); attach(); };
  probe();
})();
