'use strict';
/* Optional interactive 3D car in the command screen (presentation only, LOCAL DEMO).
   If assets/local/enzo.glb exists (or window.REDLINE_CAR_MODEL points at a model), the car photo
   in the command screen is replaced by a rotatable 3D model rendered with Google's <model-viewer>
   web component, loaded from a CDN only in that case. The model is committed (the owner confirmed
   the licence on 2026-11-11) but build.mjs still leaves assets/local out of dist/ until it is cleared
   for the public site. Without the file, nothing changes and the F80 photo stays.
   Speed: the model download starts as soon as this script runs (not when the screen renders), is
   kept in the browser's Cache Storage so later visits load it instantly, and the car photo stays
   on screen until the 3D model is ready, then cross-fades. One viewer element is created once and
   re-attached after each render, so the model loads once per visit. */
(() => {
  if (typeof bindPage !== 'function') return;
  const SRC = window.REDLINE_CAR_MODEL || 'assets/local/enzo.glb';
  const VIEWER = 'https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js';
  const CREDIT = '“2002 Ferrari Enzo” by Ddiaz Design (Sketchfab) · CC BY-NC-SA 4.0 · local demo only';
  const CACHE = 'redline-car-v1';
  let state = 'unknown', el = null, wrap = null, url = null, ready = false;

  async function cachedModel() {
    const head = await fetch(SRC, { method: 'HEAD', cache: 'no-store' });
    if (!head.ok) return null;
    // Start the viewer script while the model downloads.
    if (!customElements.get('model-viewer') && !document.querySelector(`script[src="${VIEWER}"]`)) {
      const s = document.createElement('script'); s.type = 'module'; s.src = VIEWER; document.head.appendChild(s);
    }
    const size = head.headers.get('content-length');
    let store = null;
    try { store = await caches.open(CACHE); } catch { /* Cache Storage unavailable: plain fetch */ }
    if (store) {
      const hit = await store.match(SRC);
      if (hit && (!size || hit.headers.get('x-size') === size)) return hit.blob();
    }
    const res = await fetch(SRC, { cache: 'no-store' });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (store) {
      try { await store.put(SRC, new Response(blob, { headers: { 'Content-Type': 'model/gltf-binary', 'x-size': String(size || blob.size) } })); } catch { /* quota: ignore */ }
    }
    return blob;
  }

  async function probe() {
    try {
      const blob = await cachedModel();
      if (!blob) { state = 'no'; return; }
      url = URL.createObjectURL(blob);
      state = 'yes';
    } catch { state = 'no'; return; }
    attach();
  }

  function make() {
    wrap = document.createElement('div');
    wrap.className = 'cs-model';
    el = document.createElement('model-viewer');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const attrs = {
      src: url, alt: '3D Ferrari Enzo (local demo model)', 'camera-controls': '', 'touch-action': 'pan-y',
      'interaction-prompt': 'none', 'shadow-intensity': '1.1', 'shadow-softness': '0.9', exposure: '1.05',
      'environment-image': 'neutral', 'camera-orbit': '32deg 66deg 78%', 'field-of-view': '28deg',
      'min-camera-orbit': 'auto 20deg auto', 'max-camera-orbit': 'auto 88deg auto', loading: 'eager', reveal: 'auto'
    };
    if (!reduce) { attrs['auto-rotate'] = ''; attrs['rotation-per-second'] = '14deg'; attrs['auto-rotate-delay'] = '1500'; }
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    // 'load' can be missed while the screen re-renders, so also watch the viewer's loaded flag.
    const done = () => { if (ready) return; ready = true; wrap.classList.add('ready'); wrap.parentNode?.classList.add('model-ready'); };
    el.addEventListener('load', done);
    const watch = setInterval(() => { if (el.loaded) { done(); clearInterval(watch); } else if (state === 'no') clearInterval(watch); }, 250);
    el.addEventListener('error', () => { state = 'no'; wrap.remove(); document.querySelectorAll('.cs-car3d.has-model').forEach(h => h.classList.remove('has-model', 'model-ready')); });
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
    host.classList.toggle('model-ready', ready);
  }

  const base = bindPage;
  bindPage = function () { base.apply(this, arguments); attach(); };
  // Switching apps inside the command screen re-renders only the screen.
  window.addEventListener('redline:screen', attach);
  probe();
})();
