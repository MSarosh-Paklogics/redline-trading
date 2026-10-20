const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true});
 const p=await b.newPage({viewport:{width:1600,height:1050}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:4173/?v=corsa#/overview');
 await p.waitForSelector('.race-hero');
 assert.equal(await p.locator('.race-meter-grid .race-meter').count(),4);
 assert.equal(await p.evaluate(()=>raceMetrics().find(m=>m.id==='capital').value),0);
 await p.locator('.race-meter-grid [data-action="race-meter:capital"]').click();
 assert.match(await p.locator('#modal').textContent(),/not maximum loss/);
 await p.locator('#modal [data-action="modal-close"]').click();
 await p.goto('http://127.0.0.1:4173/#/meters');
 assert.equal(await p.locator('.race-full-cluster .race-meter').count(),6);
 await p.locator('#raceSymbol').selectOption('NVDA');
 assert.match(await p.locator('.race-full-cluster').textContent(),/NVDA/);
 await p.evaluate(()=>{state.positions.push({id:'gauge-test',symbol:'SPY',side:'Long',qty:10,entry:quote('SPY')});save();render()});
 const actual=await p.evaluate(()=>raceMetrics().find(m=>m.id==='capital').value);
 assert.ok(Math.abs(actual-5.8432)<.001,'capital load reads paper ledger');
 await p.goto('http://127.0.0.1:4173/#/chart');
 assert.equal(await p.locator('.race-chart-telemetry .race-meter').count(),2);
 assert.ok(await p.locator('.race-chart-telemetry').textContent());
 for(const width of [1600,390]){
  await p.setViewportSize({width,height:900});
  for(const route of ['overview','meters','chart','engines','paper','settings']){
   await p.goto(`http://127.0.0.1:4173/#/${route}`);await p.waitForSelector('h1');
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${route} overflow at ${width}`);
  }
 }
 await p.emulateMedia({reducedMotion:'reduce'});await p.goto('http://127.0.0.1:4173/#/meters');
 assert.equal(await p.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0,'reduced motion');
 assert.deepEqual(errors,[]);
 console.log('PASS: CORSA theme, four/six-dial clusters, meter details, symbol selection, real local-ledger capital load, chart telemetry, mobile layouts and reduced motion.');
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
