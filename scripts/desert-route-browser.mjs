import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {serve} from './serve.mjs';
const server=serve(4187);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling']});
try{
  const page=await browser.newPage({viewport:{width:900,height:500}});
  page.on('pageerror',e=>console.log('PAGE ERROR',e.message));
  page.on('requestfailed',r=>console.log('REQUEST FAILED',r.url(),r.failure()?.errorText));
  await page.goto('http://localhost:4187');console.log('Page loaded');
  await page.evaluate(async()=>{window.g=(await import(document.querySelector('script[type="module"]').src)).game;});
  await page.locator('#choose-dad').click();
  await page.waitForFunction(()=>g.ready&&g.bridge?.ram,null,{timeout:90000});console.log('Emulator ready');
  await page.evaluate(bytes=>g.emulator.gameManager.loadState(new Uint8Array(bytes)),Array.from(await readFile(new URL('../test-results/phone-original.state',import.meta.url))));
  await page.waitForFunction(()=>g.bridge.ram[0xa0]===0xbb);
  await page.locator('#unstuck').click();
  await page.waitForFunction(()=>!g.recovering&&g.bridge.ram[0xa0]===0x85&&g.bridge.read()?.active,null,{timeout:15000});
  await page.waitForTimeout(300);
  if(process.argv.includes('--maps')){
    const snapshots=[];
    for(const entrance of [10,9,11,12]){
      await page.evaluate(entrance=>{g.bridge.ram[0x10e]=entrance;},entrance);
      await page.locator('#unstuck').click();
      await page.waitForFunction(()=>!g.recovering&&g.bridge.read()?.active,null,{timeout:15000});await page.waitForTimeout(300);
      snapshots.push(await page.evaluate(()=>Array.from(g.bridge.ram)));
      console.log('MAP',entrance,await page.evaluate(()=>({room:g.bridge.ram[0xa0],guide:g.bridge.read().guidance})));
    }
    await writeFile(new URL('../test-results/desert-entrance-maps.json',import.meta.url),JSON.stringify(snapshots));
  }else{
  const rooms=new Set(),snapshots=[];
  for(let tick=0;tick<600;tick++){
    const s=await page.evaluate(()=>{
      g.bridge.guide.lastAt=0;
      const r=g.bridge.ram,w=g.bridge.read(),guide=w.guidance,x=(r[0x22]|r[0x23]<<8)+8,y=(r[0x20]|r[0x21]<<8)+8;
      // Keep this disposable test run alive while the route is exercised.
      r[0xf36d]=r[0xf36c];
      const gm=g.emulator.gameManager;for(let i=4;i<=7;i++)gm.simulateInput(0,i,0);
      let direction;
      if(w.active&&r[0x1b]&&guide?.path?.length){
        const path=guide.path,point=path.find(p=>Math.hypot(p.x-x,p.y-y)>7);
        if(point){const dx=point.x-x,dy=point.y-y;direction=Math.abs(dx)>Math.abs(dy)?dx>0?7:6:dy>0?5:4;}
        else {const text=guide.steps.find(t=>t.startsWith('As Link,'))||'';direction=text.includes('left')?6:text.includes('right')?7:text.includes('up')?4:text.includes('down')?5:undefined;}
        if(direction!==undefined)gm.simulateInput(0,direction,1);
      }
      return {room:r[0xa0]|r[0xa1]<<8,indoors:r[0x1b],x:x&511,y:y&511,active:w.active,direction,target:guide?.target?.label,destination:guide?.destination,steps:guide?.steps};
    });
    if(s.active&&!rooms.has(s.room)){rooms.add(s.room);console.log('ROOM',s);snapshots.push(await page.evaluate(()=>Array.from(g.bridge.ram)));await writeFile(new URL('../test-results/desert-route-rooms.json',import.meta.url),JSON.stringify(snapshots));}
    if(tick%25===0)console.log('WALK',tick,s);
    if(!s.indoors){for(const room of [0x84,0x74,0x73,0x83])assert.ok(rooms.has(room));console.log('PASS actual native walk east wing → central hall → north hall → northwest wing → west wing → outside');break;}
    if(tick===599)throw new Error('Route did not reach outside');
    await page.waitForTimeout(100);
  }
  await writeFile(new URL('../test-results/desert-route-rooms.json',import.meta.url),JSON.stringify(snapshots));
  }
}finally{await browser.close();server.close();}
