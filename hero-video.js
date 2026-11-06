'use strict';
/* Optional background video for the dashboard hero (presentation layer).
   Plays assets/hero-bg.mp4 (or window.REDLINE_HERO_VIDEO) muted and looping, darkened behind the
   copy and the live candles. Only use footage you have the rights to: no file means no video, and
   nothing else on the page changes.
   One <video> element is created once and re-attached after each render, so live data refreshes
   don't restart playback. Paused for prefers-reduced-motion / reduced setting and off-screen. */
(() => {
  if (typeof bindPage !== 'function') return;
  const SRC = window.REDLINE_HERO_VIDEO || 'assets/hero-bg.mp4';
  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches || (typeof state !== 'undefined' && state.settings?.reduced);
  let wrap = null, failed = false;

  function make() {
    wrap = document.createElement('div');
    wrap.className = 'hero-video';
    wrap.setAttribute('aria-hidden', 'true');
    const v = document.createElement('video');
    Object.assign(v, { muted: true, loop: true, playsInline: true, autoplay: !reduce(), preload: 'metadata' });
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('disablepictureinpicture', '');
    v.addEventListener('error', () => { failed = true; wrap.remove(); }, { once: true });
    v.addEventListener('loadeddata', () => wrap.classList.add('ready'), { once: true });
    v.src = SRC;   // set directly so a missing file fires 'error' on the video itself
    wrap.appendChild(v);
  }

  // Hero circuit cars (SMIL): keep their lap position continuous across re-renders, pause for reduced motion.
  function syncCircuit() {
    const svg = document.querySelector('.hero-circuit');
    if (!svg?.setCurrentTime) return;
    if (reduce()) { svg.pauseAnimations(); svg.setCurrentTime(1.5); return; }
    svg.setCurrentTime((performance.now() / 1000) % 1000);
  }

  function attach() {
    syncCircuit();
    if (failed) return;
    const hero = document.querySelector('.race-hero');
    if (!hero) { wrap?.querySelector('video')?.pause(); return; }
    if (!wrap) make();
    if (wrap.parentNode !== hero) hero.insertBefore(wrap, hero.firstChild);
    const v = wrap.querySelector('video');
    if (reduce() || document.hidden) v.pause(); else v.play?.().catch(() => {});
  }

  const base = bindPage;
  bindPage = function () { base.apply(this, arguments); attach(); };
  document.addEventListener('visibilitychange', attach);
  attach();
})();
