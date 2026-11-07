import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import {serve} from './serve.mjs';
const server=serve(4183),browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling']});
try{
  const page=await browser.newPage({viewport:{width:900,height:430}});
  page.on('pageerror',e=>{throw e;});
  await page.goto('http://localhost:4183');
  await page.evaluate(async()=>{window.g=(await import('/app.js')).game;});
  await page.locator('#choose-dad').click();await page.waitForFunction(()=>g.ready&&g.bridge?.ram,{},{timeout:90000});
  const state=await readFile(process.env.TEST_SAVE||'test-results/active-game.state');
  await page.evaluate(async bytes=>{
    window.base=new Uint8Array(bytes);window.A=(await import('/zelda.js')).ADDR;
    window.prepare=async type=>{
      g.emulator.gameManager.loadState(base);g.lasers.timers={};g.fairy.shots=[];g.unicorn.shots=[];
      await new Promise(resolve=>setTimeout(resolve,180));
      const r=g.bridge.ram;r.fill(0,A.state,A.state+16);r[A.type]=type;
      if(type===0xce){r[0xf3cc]=0;r[0x403]|=0x20;} // Blind has been exposed to light.
      const w=g.bridge.read(),x=w.cameraX+120,y=w.cameraY+136;
      r[A.xLo]=x&255;r[A.xHi]=x>>8;r[A.yLo]=y&255;r[A.yHi]=y>>8;r[A.spriteFloor]=r[A.floor];r[A.state]=8;
    };
    window.readyEnemy=(type,phase=0)=>{
      const r=g.bridge.ram,w=g.bridge.read(),x=w.cameraX+120,y=w.cameraY+136;
      r[A.xLo]=x&255;r[A.xHi]=x>>8;r[A.yLo]=y&255;r[A.yHi]=y>>8;r[A.z]=0;r[A.hit]=r[A.damage]=r[A.recoil]=0;
      r[A.ai]=phase;r[A.a]=0;r[A.e]=0;r[A.aux4]=0;r[0xdf0]=180;r[0xd40]=r[0xd50]=0;r[A.pause]=0;
      if(type===0x51)r[A.ai]=1;
      if(type===0x53){r[A.a]=1;r[0xff8]=6;}
      if(type===0xcb)r[A.trinexxFinal]=1;
      if(type===0x7a)r[A.ai]=3;
      r[A.flags3]&=~0x40;
      r[A.spriteFloor]=r[A.floor];
      return {hp:r[A.hp],state:r[A.state],target:g.bridge.read().enemies.find(e=>e.slot===0),debug:{module:r[A.module],sub:r[A.submodule],type:r[A.type],floor:r[A.floor],world:g.bridge.read()}};
    };
  },Array.from(state));
  const setup=async(type,phase=0)=>{
    await page.evaluate(type=>prepare(type),type);
    await page.waitForFunction(()=>g.bridge.ram[A.state]!==8);
    const info=await page.evaluate(({type,phase})=>readyEnemy(type,phase),{type,phase});
    assert.equal(info.state,9,`Native spawn ${type.toString(16)}`);if(!info.target)console.log(info);assert.ok(info.target,`Target ${type.toString(16)}`);return info;
  };
  for(const type of (process.env.COMBAT_REACTIONS_ONLY?[]:[0x51,0x53,0x09,0x54,0x88,0x8c,0x92,0xa2,0xa3,0xbd,0xbe,0xd0,0x83,0x84,0xca,0x26,0x15,0x27,0x61,0x7a,0xcb])){
    const before=await setup(type);
    const accepted=await page.evaluate(()=>{const t=g.bridge.read().enemies.find(e=>e.slot===0);return g.bridge.hit(t,{x:t.x-20,y:t.y});});
    assert.equal(accepted,true);
    await page.waitForTimeout(220);
    const after=await page.evaluate(()=>({hp:g.bridge.ram[A.hp],damage:g.bridge.ram[A.damage],hit:g.bridge.ram[A.hit],state:g.bridge.ram[A.state],ai:g.bridge.ram[A.ai]}));
    console.log('Native shot',type.toString(16),before.hp,'->',after);
    assert.ok(after.hp<before.hp,`Real health loss for ${type.toString(16)}`);
  }
  // These bosses intentionally consume hits for a phase reaction before HP.
  for(const [type,phase] of [[0xce,0],[0xcc,2],[0xcd,2],[0x85,2],[0xd6,17]]){
    await setup(type,phase);
    assert.equal(await page.evaluate(()=>{const t=g.bridge.read().enemies.find(e=>e.slot===0);return g.bridge.hit(t,{x:t.x-20,y:t.y});}),true);
    await page.waitForTimeout(220);
    const after=await page.evaluate(()=>({type:g.bridge.ram[A.type],ai:g.bridge.ram[A.ai],damage:g.bridge.ram[A.damage],hits:g.bridge.ram[0xf90],aux:g.bridge.ram[A.aux4]}));
    console.log('Native reaction',type.toString(16),after);assert.equal(after.damage,0,'Native reaction leaves no stranded damage');
    if(type===0xce)assert.ok(after.hits>0||after.aux>0,'Blind counts a hit');
    if(type===0xcc||type===0xcd||type===0x85){assert.equal(after.ai,type===0x85?5:4);}
    if(type===0xd6)assert.equal(after.type,0xd7,'Ganon enters silver-arrow vulnerability');
  }
  for(const [type,phase] of [[0xcc,4],[0xcd,4],[0x85,5],[0xd7,19]]){
    const before=await setup(type,phase);
    assert.equal(await page.evaluate(()=>{const t=g.bridge.read().enemies[0];return g.bridge.hit(t,{x:t.x-20,y:t.y});}),true);
    await page.waitForTimeout(220);
    assert.ok(await page.evaluate(hp=>g.bridge.ram[A.hp]<hp,before.hp),`Native damage after stun for ${type.toString(16)}`);
  }
  for(const role of ['jj','michelle'])for(const giant of [false,true]){
    const before=await setup(0x53);
    await page.evaluate(({role,giant})=>{
      const c=role==='jj'?g.fairy:g.unicorn,w=g.bridge.read();c.enabled=true;c.scene=w.scene;c.cameraX=w.cameraX;c.cameraY=w.cameraY;
      c.x=c.tx=96;c.y=c.ty=144;c.follow=false;c.active=true;c.aimX=1;c.aimY=0;if(c.stop)c.stop();
      g.lasers.start({roles:[role],giant});g.lasers.setAim(role,1,0);
      window.soundCount=0;const original=g.bridge.fireSound.bind(g.bridge);g.bridge.fireSound=()=>{const queued=original();if(queued)soundCount++;return queued;};
    },{role,giant});
    await page.waitForFunction(hp=>g.bridge.ram[A.hp]<hp,before.hp,{timeout:4000});
    assert.ok(await page.evaluate(()=>soundCount>0),'Firing sound reaches the native audio queue');
    console.log('Live laser damages Armos Knight:',role,giant?'giant':'regular');
  }
  // Verify a lethal hit takes the statue's own defeat path and drops its reward.
  await setup(0x53);
  await page.evaluate(()=>{const r=g.bridge.ram;r[A.hp]=24;r[0xff8]=1;const t=g.bridge.read().enemies[0];g.bridge.powerHit(t,{x:t.x-20,y:t.y},'meteor',true);});
  await page.waitForFunction(()=>[...g.bridge.ram.slice(A.type,A.type+16)].some((type,i)=>type===0xea&&g.bridge.ram[A.state+i]),{},{timeout:5000});
  console.log('Meteor smash triggers Armos native defeat and heart-container drop');
}finally{await browser.close();server.close();}
