const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true});
 const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:4173/?v=tp-sl#/chart');await p.waitForSelector('#quickTP');
 await p.locator('#quickTP').click();await p.locator('#protectionTarget').fill('590');await p.locator('#protectionStop').fill('580');
 await p.locator('#protectionForm button[type="submit"]').click();
 assert.match(await p.locator('#quickTP').textContent(),/590.00/);
 assert.equal(await p.locator('[data-draft-protection]').count(),2);
 await p.locator('[data-action="chart-buy"]').click();
 assert.equal(await p.locator('#orderStop').inputValue(),'580');assert.equal(await p.locator('#orderTarget').inputValue(),'590');
 await p.locator('#orderForm button[type="submit"]').click();await p.locator('#placeOrder').click();
 assert.equal(await p.evaluate(()=>state.positions[0].stop),580);assert.equal(await p.evaluate(()=>state.positions[0].target),590);
 assert.equal(await p.locator('[data-position-protection]').count(),3);
 assert.equal(await p.locator('[data-draft-protection]').count(),0,'no duplicated draft lines over identical filled levels');
 await p.locator('[data-position-protection] text').filter({hasText:'TP ·'}).click();
 await p.locator('#protectionTarget').fill('588');await p.locator('#protectionForm button[type="submit"]').click();
 assert.equal(await p.evaluate(()=>state.positions[0].target),588);
 // Direction-specific draft validation and prefill.
 await p.locator('#quickSL').click();await p.locator('#protectionDirection').selectOption('Short');
 await p.locator('#protectionStop').fill('580');await p.locator('#protectionTarget').fill('590');
 await p.locator('#protectionForm button[type="submit"]').click();assert.match(await p.locator('#protectionError').textContent(),/above/);
 await p.locator('#protectionStop').fill('590');await p.locator('#protectionTarget').fill('580');await p.locator('#protectionForm button[type="submit"]').click();
 await p.locator('[data-action="chart-sell"]').click();assert.equal(await p.locator('#orderStop').inputValue(),'590');assert.equal(await p.locator('#orderTarget').inputValue(),'580');
 await p.reload();await p.waitForSelector('#quickTP');assert.equal(await p.evaluate(()=>protectionDraft('SPY','Short').target),580);
 // Existing scenario mechanism still closes a paper position at its TP.
 await p.evaluate(()=>{state.positions=[{id:'exit-test',symbol:'SPY',side:'Long',qty:2,entry:quote('SPY'),stop:570,target:quote('SPY')+.01,strategy:'Manual paper trade'}];state.step=0;save();render()});
 await p.evaluate(()=>advanceMarket());
 const stepped=await p.evaluate(()=>({q:quote('SPY'),entry:584.32,open:state.positions.length,closed:state.closed.some(p=>p.id==='exit-test')}));
 if(stepped.q>=584.33){assert.equal(stepped.open,0);assert.equal(stepped.closed,true)}
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(300);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);
 console.log('PASS: TP/SL controls, draft overlays, long/short validation, order prefill, filled-position overlays, editable protection, local persistence, scenario exits and mobile layout.');
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
