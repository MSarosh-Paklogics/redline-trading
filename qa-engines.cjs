const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true});
 const p=await b.newPage({viewport:{width:1440,height:1050}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:4173/#/engines');
 await p.waitForSelector('#engineScenario');
 await p.locator('[data-engine-view="structure"]').click();
 assert.equal(await p.locator('.degree-card').count(),7);
 await p.locator('[data-client-degree="Minute"]').click();
 await p.locator('[data-engine-view="intelligence"]').click();
 assert.equal(await p.locator('.intelligence-card').count(),6);
 await p.locator('[data-engine-view="planner"]').click();
 assert.match(await p.locator('main').textContent(),/Not proposed/);
 await p.locator('#engineScenario').selectOption('aligned');
 assert.match(await p.locator('main').textContent(),/7780.00/);
 assert.equal(await p.evaluate(()=>state.orders.length),0,'scenario never creates an order');
 await p.locator('[data-engine-view="pipeline"]').click();
 await p.locator('[data-action="engine:22"]').first().click();
 await p.locator('#modal [data-action="engine-tab:structure"]').click();
 assert.equal(await p.locator('#modal').evaluate(el=>el.open),false);
 await p.waitForTimeout(1100);await p.screenshot({path:'screenshots/engine-room.png',fullPage:true});
 await p.goto('http://127.0.0.1:4173/#/references');
 assert.equal(await p.locator('.reference-card').count(),10);
 await p.locator('[data-action="reference:8"]').click();
 assert.equal(await p.locator('.reference-full').evaluate(el=>el.complete&&el.naturalWidth>0),true);
 await p.locator('#modal [data-action="modal-close"]').click();
 await p.locator('#clientFilter').selectOption('Engine');
 assert.equal(await p.locator('.reference-card').count(),3);
 await p.goto('http://127.0.0.1:4173/#/controls');
 await p.locator('[data-action="demo-pair"]').click();
 assert.equal(await p.evaluate(()=>demoPaired),true);
 await p.locator('#controlMode').selectOption('Chart focus');
 await p.locator('[data-action="workspace"]').click();
 await p.waitForSelector('.fullscreen-chart');
 await p.keyboard.press('Escape');
 for(const width of [1440,390]){
  await p.setViewportSize({width,height:900});
  for(const route of ['engines','references','controls','strategies','paper','journal']){
   await p.goto(`http://127.0.0.1:4173/#/${route}`);await p.waitForSelector('h1');
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${route} overflow at ${width}`);
   if(route==='engines')for(const view of ['pipeline','structure','intelligence','planner','inventory']){
    await p.locator(`[data-engine-view="${view}"]`).click();
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${view} overflow at ${width}`);
   }
  }
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: engine authority views, scenarios, seven/six degrees, modal handoff, original references, local access preview, chart focus, desktop/mobile layouts.');
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
