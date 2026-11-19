import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {serve} from './serve.mjs';
const base=process.env.MARIO_TEST_URL||'http://127.0.0.1:4191/mario/';
const server=process.env.MARIO_TEST_URL?null:serve(4191),browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const errors=[];
await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
try{
  const host=await browser.newPage({viewport:{width:900,height:440},hasTouch:true,isMobile:true});
  const jj=await browser.newPage({viewport:{width:1180,height:760},hasTouch:true,isMobile:true});
  const michelle=await browser.newPage({viewport:{width:851,height:393},hasTouch:true,isMobile:true});
  for(const page of [host,jj,michelle])page.on('pageerror',e=>errors.push(e.message));
  const url=new URL(base);url.searchParams.set('test','1');
  await host.goto(url.href);await host.locator('[data-role=dad]').click();await host.waitForFunction(()=>window.__family?.connection);
  await host.evaluate(()=>{
    const {engine:e,kids}=window.__family;
    for(const [mask,count]of [[128,20],[0,20],[16,20],[0,20],[1,2],[0,180]]){e.input(0,mask);for(let i=0;i<count;i++)e.step();}kids.step();
    // Keep idle test Mario safe while all three touch clients answer questions.
    setInterval(()=>{window.__family.engine.nes[0].cpu.mem[0x552]=120;},40);
  });
  await host.waitForFunction(()=>window.__family.connection.peer.open,null,{timeout:30000});const code=await host.locator('#room-code').textContent();
  for(const [page,role] of [[jj,'jj'],[michelle,'michelle']]){await page.goto(url.href);await page.locator(`[data-role=${role}]`).click();await page.locator('#code-input').fill(code);await page.locator('#join-form button').click();}
  await host.waitForFunction(()=>window.__family.connection.has('jj')&&window.__family.connection.has('michelle'),null,{timeout:30000});
  await jj.waitForFunction(()=>document.querySelector('#remote-video').videoWidth>0);
  const screenshot=async(page,name)=>page.screenshot({path:new URL('../test-results/power-'+name+'.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')});
  const layouts=async()=>{for(const page of [host,jj,michelle])assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),'power controls fit screen');};
  for(const type of ['meteor','chomp','ambush','bullet']){
    await host.evaluate(type=>{window.__family.engine.paused=false;window.__family.learning.rewardBag=[type];window.__family.broadcast();},type);
    await host.locator('#questions').tap();await jj.locator('#quiz-next').waitFor({state:'visible'});await jj.locator('#quiz-next').tap();
    for(let i=0;i<2;i++){
      const answer=await host.evaluate(()=>{const r=window.__family.learning.round;return r.questions[r.index].answer;});
      await jj.locator('#quiz-choices button').filter({hasText:new RegExp('^'+answer+'$')}).tap();
      await jj.locator('#quiz-next').waitFor({state:'visible'});
      if(i===0)assert.equal(await jj.locator('#quiz-title').textContent(),'You did it!');
      if(i===1)assert.match(await jj.locator('#quiz-feedback').textContent(),type==='bullet'?/Bullet Bill/:type==='meteor'?/Meteor/:type==='ambush'?/Koopas/:/Chain Chomp/);
      await jj.locator('#quiz-next').tap();
    }
    await host.waitForFunction(()=>!window.__family.learning.round);
    if(type==='bullet'){
      await host.waitForFunction(()=>window.__family.kids.jet.active&&window.__family.kids.jet.kind==='bullet');
      await jj.waitForFunction(()=>document.querySelector('#power-status').textContent.includes('GIANT BULLET BILL'));
      assert.equal(await jj.locator('#super-power').isVisible(),false);assert.equal(await michelle.locator('#super-power').isVisible(),false);
      const before=await host.evaluate(()=>window.__family.kids.jet.x);await host.keyboard.down('ArrowRight');await host.waitForFunction(x=>window.__family.kids.jet.x>x+30,before);await host.keyboard.up('ArrowRight');
      await host.evaluate(()=>{window.__family.engine.paused=true;window.__family.draw();});
      await screenshot(host,'bullet-dad');await screenshot(jj,'bullet-tablet');
    }else if(type==='ambush'){
      await host.waitForFunction(()=>window.__family.kids.ambush.koopas.length===20);
      await host.evaluate(()=>{const {engine:e,kids}=window.__family;e.paused=false;for(let i=0;i<170;i++)kids.ambush.step();e.paused=true;window.__family.draw();});
      await screenshot(host,'ambush-dad');await screenshot(jj,'ambush-tablet');
    }else{
      for(const page of [jj,michelle]){await page.locator('#super-power').waitFor({state:'visible'});assert.match(await page.locator('#super-power').textContent(),type==='meteor'?/METEOR/:/CHAIN CHOMP/);}
      for(const page of [jj,michelle])await page.locator('#super-power').tap();
      await host.waitForFunction(type=>{
        const k=window.__family.kids,shots=type==='meteor'?k.meteors:k.levelPowers.chomps;return new Set(shots.map(s=>s.role)).size===2;
      },type);
      await host.evaluate(type=>{const {engine:e,kids}=window.__family;if(type==='meteor')for(const m of kids.meteors)m.left=22;e.paused=true;window.__family.draw();window.__family.broadcast();},type);
      await screenshot(host,type+'-dad');await screenshot(michelle,type+'-michelle');await screenshot(jj,type+'-tablet');await layouts();
      // Portrait controls must remain usable with the additional ability button.
      await michelle.setViewportSize({width:393,height:851});await screenshot(michelle,type+'-portrait');await layouts();await michelle.setViewportSize({width:851,height:393});
      await host.evaluate(()=>{const {engine:e,kids}=window.__family;e.paused=false;for(let i=0;i<125;i++)kids.step();window.__family.broadcast();});
      for(const page of [jj,michelle]){await page.waitForFunction(()=>!document.querySelector('#super-power').disabled);await page.locator('#super-power').tap();}
      await host.waitForFunction(()=>Object.values(window.__family.kids.kids).every(k=>k.power.cooldown>0));
    }
    await layouts();
    await host.locator('#save').tap();await host.waitForFunction(()=>document.querySelector('#status').textContent.includes('saved'));
    await host.locator('#load').tap();await host.waitForFunction(()=>document.querySelector('#status').textContent.includes('loaded'));
    assert.equal(await host.evaluate(type=>type==='bullet'?window.__family.kids.jet.kind==='bullet'&&window.__family.kids.jet.active:type==='ambush'?window.__family.kids.ambush.koopas.length===20:Object.values(window.__family.kids.kids).every(k=>k.power?.type===type),type),true);
    if(type==='bullet'){
      await host.locator('#exit-bullet').waitFor({state:'visible'});await host.locator('#exit-bullet').tap();await host.waitForFunction(()=>!window.__family.kids.jet.active);
      await host.locator('#exit-bullet').waitFor({state:'hidden'});await jj.waitForFunction(()=>!document.body.dataset.jet||document.body.dataset.jet==='false');
    }
    console.log('PASS earned '+type+' through actual questions, touch activation, three-player display, layouts and save/load');
  }
  await host.evaluate(()=>{const {engine:e}=window.__family;e.paused=true;const m=e.nes[0].cpu.mem;m[0x671]=0xaf;m[0x661]=2;m[0x91]=180;m[0x76]=m[0x12];m[0xa3]=32;m[0x88]=0;e.sun.prepare();e.sun.record(0).hp=35;window.__family.draw();});
  await screenshot(host,'sun-health');
  assert.deepEqual(errors,[]);console.log('PASS no uncaught browser errors');
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
