// Developer verification. Requires Playwright through NODE_PATH or a local installation.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1050}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173');
 await page.evaluate(()=>{localStorage.clear();location.reload()});await page.waitForSelector('h1');
 fs.mkdirSync('screenshots',{recursive:true});
 await page.waitForTimeout(1100);await page.screenshot({path:'screenshots/overview.png',fullPage:true});
 for(const route of ['chart','xray','sectors','strategies','signals','journal','paper','settings','overview']){
  await page.goto(`http://127.0.0.1:4173/#/${route}`);await page.waitForSelector('h1');
  assert.ok((await page.locator('h1').textContent()).length>0,route);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${route}: desktop overflow`);
 }
 await page.goto('http://127.0.0.1:4173/#/chart');
 await page.locator('[data-tf="1h"]').click();await page.locator('.terminal-overlay-controls [data-indicator="levels"]').click();
 await page.locator('[data-action="zoom-in"]').click();await page.waitForTimeout(1100);await page.screenshot({path:'screenshots/chart-workspace.png',fullPage:true});
 await page.goto('http://127.0.0.1:4173/#/signals');
 await page.locator('[data-signal="1"]').click();await page.locator('#modal [data-action="prepare:SPY:Long"]').click();
 await page.waitForSelector('#orderForm');await page.waitForTimeout(100);
 await page.locator('#orderQty').fill('10');await page.locator('#orderForm button[type=submit]').click();
 await page.locator('#placeOrder').click();
 assert.equal(await page.evaluate(()=>state.positions.length),1,'market filled');
 assert.equal(await page.evaluate(()=>state.positions[0].qty),10);
 assert.ok(await page.evaluate(()=>available()<100000),'notional reserved');
 await page.locator('[data-action="advance"]').click();
 const expected=await page.evaluate(()=>pnl(state.positions[0]));
 await page.locator('[data-close-position]').click();await page.locator('#confirmAction').click();
 assert.equal(await page.evaluate(()=>state.positions.length),0);
 assert.equal(await page.evaluate(()=>state.closed.length),1);
 assert.ok(Math.abs(await page.evaluate(()=>realized())-expected)<1e-8,'long pnl');
 const id=await page.evaluate(()=>state.closed[0].id);
 assert.equal(await page.evaluate(id=>state.journal.filter(t=>t.id===id).length,id),1,'journal deduplicated');
 await page.locator(`[data-journal="${id}"]`).click();await page.locator('[data-action^="edit-journal:"]').click();
 await page.locator('#jNotes').fill('CEO presentation test: followed the plan.');await page.locator('#journalForm button[type=submit]').click();
 await page.reload();await page.waitForSelector('#orderForm');
 assert.equal(await page.evaluate(id=>state.journal.find(t=>t.id===id).notes,id),'CEO presentation test: followed the plan.');
 // Short order / P&L.
 await page.locator('#orderSide').selectOption('Short');await page.locator('#orderQty').fill('5');
 await page.locator('#orderForm button[type=submit]').click();await page.locator('#placeOrder').click();
 await page.locator('[data-action="advance"]').click();
 assert.equal(await page.evaluate(()=>pnl(state.positions[0])===(state.positions[0].entry-quote(state.positions[0].symbol))*state.positions[0].qty),true,'short pnl');
 // Validation catches a stop on the wrong side.
 await page.locator('#orderStop').fill('1');await page.locator('#orderSide').selectOption('Short');
 await page.locator('#orderForm button[type=submit]').click();assert.match(await page.locator('#orderError').textContent(),/above/);
 await page.locator('#orderStop').fill('');
 // Marketable limit remains pending until explicit scenario advance.
 await page.locator('#orderSide').selectOption('Long');await page.locator('#orderType').selectOption('Limit');
 await page.locator('#orderLimit').fill('590');await page.locator('#orderQty').fill('2');
 await page.locator('#orderForm button[type=submit]').click();await page.locator('#placeOrder').click();
 assert.equal(await page.evaluate(()=>state.orders.length),1,'limit pending');
 await page.locator('[data-action="advance"]').click();assert.equal(await page.evaluate(()=>state.orders.length),0,'limit filled on advance');
 assert.equal(await page.evaluate(()=>state.positions.length),2);
 // Alert creation + test notification.
 await page.goto('http://127.0.0.1:4173/#/signals');await page.locator('[data-action="alert"]').click();
 await page.locator('#alertType').selectOption('Setup qualified');await page.locator('#alertForm button[type=submit]').click();
 const count=await page.evaluate(()=>state.notifications.length);await page.locator('[data-action="simulate-event"]').click();
 assert.ok(await page.evaluate(()=>state.notifications.length)>count,'local event');
 // Safe note rendering and CSV export.
 await page.goto('http://127.0.0.1:4173/#/journal');
 const download=page.waitForEvent('download');await page.locator('[data-action="export"]').click();assert.equal((await download).suggestedFilename(),'FRYE-demo-journal.csv');
 // Settings persist.
 await page.goto('http://127.0.0.1:4173/#/settings');await page.locator('#displayName').fill('CEO Demo');await page.locator('#displayName').press('Tab');
 await page.reload();assert.equal(await page.locator('#displayName').inputValue(),'CEO Demo');
 // Mobile route layouts.
 await page.setViewportSize({width:390,height:844});
 for(const route of ['overview','chart','xray','sectors','strategies','signals','journal','paper','settings']){
  await page.goto(`http://127.0.0.1:4173/#/${route}`);await page.waitForSelector('h1');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${route}: mobile overflow`);
 }
 await page.goto('http://127.0.0.1:4173/#/overview');await page.waitForTimeout(1100);await page.screenshot({path:'screenshots/mobile-overview.png',fullPage:true});
 // Restore pristine presentation state.
 await page.evaluate(()=>{localStorage.clear();location.reload()});await page.waitForSelector('h1');
 assert.deepEqual(errors,[],'browser errors');
 console.log('PASS: all 9 routes, desktop/mobile layout, chart controls, market/limit orders, long/short P&L, validation, journal persistence/deduplication, notifications, CSV, settings.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
