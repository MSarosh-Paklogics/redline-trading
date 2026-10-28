'use strict';
(() => {
  const render = () => {
    if (!location.hash.startsWith('#/meters') || !window.redlineApi || document.querySelector('[data-live-meter-surface]')) return;
    const host = document.querySelector('#app'); if (!host) return;
    const el = document.createElement('section'); el.className='live-meter-board'; el.dataset.liveMeterSurface='1';
    el.innerHTML='<div class="live-meter-board-head"><div><span class="eyebrow">LIVE CLIENT MARKET METER</span><strong>ES multi-timeframe condition</strong><small data-meter-updated>Loading canonical backend…</small></div><span class="pill gold" data-meter-status>CONNECTING</span></div><div class="live-meter-grid">'+['10m','30m','1h','4h','1d'].map(tf=>`<div class="live-meter-cell"><span>${tf.toUpperCase()}</span><strong data-meter-score="${tf}">—</strong><small data-meter-state="${tf}">—</small></div>`).join('')+'</div>';
    host.prepend(el);
    window.redlineApi.marketMeter('ES').then(({data})=>{const lights=data?.lights||{};['10m','30m','1h','4h','1d'].forEach(tf=>{const d=lights[tf]||{};el.querySelector(`[data-meter-score="${tf}"]`).textContent=d.score==null?'—':Number(d.score).toFixed(1);el.querySelector(`[data-meter-state="${tf}"]`).textContent=d.state||'UNAVAILABLE'});el.querySelector('[data-meter-updated]').textContent=`Updated ${data?.updated_at_utc||'—'}`;const s=el.querySelector('[data-meter-status]');s.textContent='LIVE BACKEND';s.className='pill green'}).catch(()=>{el.querySelector('[data-meter-status]').textContent='UNAVAILABLE'});
  };
  window.addEventListener('hashchange',()=>setTimeout(render,60)); setTimeout(render,150); setInterval(()=>{if(location.hash.startsWith('#/meters')){const old=document.querySelector('[data-live-meter-surface]');if(old)old.remove();render()}},60000);
})();
