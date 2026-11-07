import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';
import { learningChecks } from './learning-browser-checks.mjs';
const server=serve();
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const tabletBrowser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const michelleBrowser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const results=new URL('../test-results/',import.meta.url);await mkdir(results,{recursive:true});
const errors=[];
const shot=async(page,name)=>page.screenshot({path:fileURLToPath(new URL(name,results))});
try{
  const dadContext=await browser.newContext({viewport:{width:900,height:430},hasTouch:true});
  const dad=await dadContext.newPage();
  dad.on('pageerror',e=>{errors.push(e.message);console.log('DAD ERROR',e.message);});
  await dad.goto('http://localhost:4173');
  await dad.evaluate(async()=>{window.testGame=(await import('/app.js')).game;testGame.learning.elapsed=-3600;});
  await shot(dad,'home.png');
  await dad.locator('#choose-dad').click();
  assert.equal(await dad.locator('#rom').count(),0,'No game file picker is needed');
  await dad.waitForFunction(()=>window.testGame.ready,{},{timeout:90000});
  console.log('Emulator ready',await dad.locator('#bridge-status').textContent());
  assert.match(await dad.locator('#bridge-status').textContent(),/Fairy ready/);
  await dad.waitForFunction(()=>document.getElementById('dad-status').textContent.includes('Waiting for JJ'),{},{timeout:30000});
  const code=(await dad.locator('#room-code').textContent()).replaceAll(' ','');
  assert.match(code,/^[A-HJ-NP-Z]{2}$/,'Dad displays only two letters');
  console.log('Pairing code obtained');
  const jjContext=await tabletBrowser.newContext({viewport:{width:1280,height:800},hasTouch:true});
  const jj=await jjContext.newPage();
  jj.on('pageerror',e=>{errors.push(e.message);console.log('JJ ERROR',e.message);});
  await jj.goto('http://localhost:4173/#join='+code);
  assert.equal(await jj.locator('#join-code').inputValue(),code,'Pairing link uses the two-letter code');
  await jj.locator('#join').click();
  await jj.waitForFunction(()=>document.getElementById('video').readyState>=2,{},{timeout:35000});
  console.log('WebRTC video received');
  console.log('Visibility',await dad.evaluate(()=>({hidden:document.hidden,paused:testGame.paused,canvas:[testGame.emulator.canvas.width,testGame.emulator.canvas.height]})));
  await dad.waitForTimeout(3000);
  await shot(dad,'controller.png');await shot(jj,'tablet-title.png');
  const videoData=await jj.evaluate(()=>{const v=document.getElementById('video');const c=document.createElement('canvas');c.width=256;c.height=224;const x=c.getContext('2d');x.drawImage(v,0,0,256,224);return {width:v.videoWidth,height:v.videoHeight,colors:new Set(x.getImageData(0,0,256,224).data).size};});
  console.log('Stream pixels',videoData);assert.ok(videoData.colors>3);
  // A real tap travels through WebRTC and reaches the phone's fairy target.
  await jj.locator('#tap-surface').click({position:{x:200,y:200}});
  await dad.waitForFunction(()=>!window.testGame.fairy.follow);
  console.log('Fairy touch relayed');
  if(process.env.TEST_SAVE){
    const state=await readFile(process.env.TEST_SAVE);
    await dad.evaluate(bytes=>{testGame.emulator.gameManager.loadState(new Uint8Array(bytes));testGame.fairy.scene=null;},Array.from(state));
    await dad.waitForFunction(()=>testGame.bridge.read().active);
  }else{
  await dad.waitForTimeout(10000);
  // Input on the custom controller, then release; title advances to file select.
  await dad.locator('[data-key="3"]').click({delay:150});await dad.waitForTimeout(900);
  await dad.locator('#peek').click();await shot(dad,'game-file-select.png');await dad.locator('#close-peek').click();
  console.log('GAME',await dad.evaluate(async()=>{const {game}=await import('/app.js');return {module:game.bridge.ram[0x10],sub:game.bridge.ram[0x11]};}));
  await dad.locator('#save').click();
  await dad.waitForTimeout(300);
  assert.ok(await dad.evaluate(async()=>Boolean(await (await import('/storage.js')).get('save'))));
  const before=await dad.evaluate(async()=>{const {game}=await import('/app.js');return game.bridge.ram[0x1a];});
  await dad.locator('#pause').click();await dad.waitForTimeout(100);
  const paused1=await dad.evaluate(async()=>{const {game}=await import('/app.js');return game.bridge.ram[0x1a];});
  await dad.waitForTimeout(150);
  const paused2=await dad.evaluate(async()=>{const {game}=await import('/app.js');return game.bridge.ram[0x1a];});
  assert.equal(paused1,paused2);console.log('Save and pause verified');
  await dad.locator('#pause').click();
  // Drive a new game through its menu using the actual emulator inputs.
  async function tap(key,ms=100){await dad.evaluate(async({key,ms})=>{const {game}=await import('/app.js');game.emulator.gameManager.simulateInput(0,key,1);await new Promise(r=>setTimeout(r,ms));game.emulator.gameManager.simulateInput(0,key,0);},{key,ms});await dad.waitForTimeout(250);}
  await tap(3);await dad.waitForTimeout(500);await shot(jj,'name-entry.png');
  await tap(0);await tap(3);await dad.waitForTimeout(600);await tap(3);await dad.waitForTimeout(1600);
  console.log('After menus',await dad.evaluate(async()=>{const {game}=await import('/app.js');return {module:game.bridge.ram[0x10],sub:game.bridge.ram[0x11],world:game.bridge.read()};}));
  await shot(jj,'game-start.png');
  await tap(3);await dad.waitForTimeout(1500);await shot(jj,'name-entry-final.png');
  console.log('Menu state',await dad.evaluate(()=>({module:testGame.bridge.ram[0x10],sub:testGame.bridge.ram[0x11]})));
  await tap(0);await tap(3);await dad.waitForTimeout(1000);await tap(3);await dad.waitForTimeout(6000);
  await shot(jj,'game-house.png');
  console.log('House state',await dad.evaluate(()=>({module:testGame.bridge.ram[0x10],sub:testGame.bridge.ram[0x11],world:testGame.bridge.read()})));
  for(let i=0;i<70;i++){
    if(await dad.evaluate(()=>testGame.bridge.read().active))break;
    await tap(8,100);await dad.waitForTimeout(150);
  }
  await shot(jj,'after-dialogue.png');
  console.log('After dialogue',await dad.evaluate(()=>({module:testGame.bridge.ram[0x10],sub:testGame.bridge.ram[0x11],input:[...testGame.bridge.ram.slice(0xf0,0xfc)]})));
  assert.ok(await dad.evaluate(()=>testGame.bridge.read().active),'Opening dialogue completed and gameplay is active');
  // The opening briefly returns to gameplay between Zelda's message and the
  // uncle's speech. Wait for a stable playable scene, not that transient frame.
  let stable=0;
  for(let i=0;i<140&&stable<6;i++){
    if(await dad.evaluate(()=>testGame.bridge.read().active)){stable++;await dad.waitForTimeout(500);}
    else{stable=0;await tap(8,100);await dad.waitForTimeout(250);}
  }
  assert.equal(stable,6,'Opening scripted dialogue is fully complete');
  await writeFile(new URL('active-game.state',results),Buffer.from(await dad.evaluate(()=>Array.from(testGame.emulator.gameManager.getState()))));
  }
  await jj.waitForFunction(()=>document.getElementById('tablet-objective').textContent.includes('Leave the house'));
  assert.ok(await dad.evaluate(()=>Number.isFinite(testGame.guidance.angle)),'House exit compass is active');
  const surface=await jj.locator('#tap-surface').boundingBox();
  const fly=async(x,y)=>{await jj.locator('#tap-surface').click({position:{x:x/256*surface.width,y:y/224*surface.height}});await dad.waitForTimeout(600);};
  await fly(130,120);await fly(130,100);
  await dad.evaluate(()=>{const f=testGame.fairy,burst=f.burst.bind(f);f.burst=(x,y)=>{window.lastBurst={x,y,wall:testGame.bridge.read().wallAt(x,y)};burst(x,y);};});
  assert.equal(await dad.evaluate(()=>testGame.bridge.read().enemies.length),0);
  await jj.locator('#fire').click({delay:50});
  await dad.waitForFunction(()=>window.lastBurst?.wall,{},{timeout:3000});
  console.log('Empty-room shot hit a real dungeon wall',await dad.evaluate(()=>window.lastBurst));
  await shot(jj,'compass-and-free-shot.png');
  await dad.locator('#options').click();await dad.locator('#toggle-guidance').click();
  await jj.waitForFunction(()=>document.getElementById('tablet-objective').hidden);
  await dad.locator('#toggle-guidance').click();await dad.locator('#close-options').click();
  console.log('Compass objective and toggle relayed to tablet');
  const michelle=await michelleBrowser.newPage({viewport:{width:900,height:430},hasTouch:true});
  michelle.on('pageerror',e=>errors.push(e.message));
  await michelle.goto('http://localhost:4173');await michelle.locator('#choose-michelle').click();
  await michelle.locator('#michelle-code').fill(code.toLowerCase());await michelle.locator('#michelle-join').click();
  await michelle.waitForFunction(()=>!document.getElementById('unicorn-controller').hidden);
  await dad.waitForFunction(()=>testGame.network.has('jj')&&testGame.network.has('michelle')&&testGame.unicorn.active);
  await michelle.waitForFunction(()=>!document.getElementById('unicorn-fire').disabled);
  await shot(michelle,'michelle-controller.png');
  const pad=await michelle.locator('#unicorn-pad').boundingBox(),px=pad.x+pad.width/2,py=pad.y+pad.height/2;
  const ux=await dad.evaluate(()=>testGame.unicorn.x);
  await michelle.mouse.move(px,py);await michelle.mouse.down();await michelle.mouse.move(px+45,py);await dad.waitForTimeout(300);await michelle.mouse.up();
  await dad.waitForFunction(()=>testGame.unicorn.inputX===0);
  assert.ok(await dad.evaluate(x=>testGame.unicorn.x>x+10,ux),'Michelle joystick moves the unicorn');
  const stopped=await dad.evaluate(()=>testGame.unicorn.x);await dad.waitForTimeout(450);
  assert.ok(Math.abs(await dad.evaluate(()=>testGame.unicorn.x)-stopped)<1,'Release stops unicorn');
  await dad.evaluate(()=>{testGame.bridge.ram[0xf36d]=testGame.bridge.ram[0xf36c]-8;});
  await michelle.locator('#unicorn-heal').click();
  await dad.waitForFunction(()=>testGame.bridge.ram[0xf36d]===testGame.bridge.ram[0xf36c],{},{timeout:5000});
  assert.equal(await michelle.locator('#unicorn-heal').isDisabled(),true);
  console.log('Three players paired; Michelle joystick and native Link healing verified');
  await dad.evaluate(async()=>{
    const {ADDR:A}=await import('/zelda.js');const ram=testGame.bridge.ram,k=14;
    const x=(ram[A.linkX]|ram[A.linkX+1]<<8)+30,y=(ram[A.linkY]|ram[A.linkY+1]<<8)+30;
    ram[A.type+k]=0x41;ram[A.xLo+k]=x&255;ram[A.xHi+k]=x>>8;ram[A.yLo+k]=y&255;ram[A.yHi+k]=y>>8;ram[A.spriteFloor+k]=ram[A.floor];ram[A.state+k]=8;
  });
  await dad.waitForTimeout(200);
  console.log('Spawned guard',await dad.evaluate(()=>testGame.bridge.read()));
  const enemy=await dad.evaluate(()=>testGame.bridge.read().enemies.find(e=>e.slot===14));assert.ok(enemy,'Test guard appears in live targeting');
  const tapBox=await jj.locator('#tap-surface').boundingBox();
  await jj.locator('#tap-surface').click({position:{x:(enemy.x-18)/256*tapBox.width,y:enemy.y/224*tapBox.height}});
  await dad.waitForTimeout(500);
  const hp=await dad.evaluate(()=>testGame.bridge.ram[0xe50+14]);
  await jj.locator('#fire').click({delay:80});
  await dad.waitForFunction(old=>testGame.bridge.ram[0xe50+14]<old,hp,{timeout:5000});
  console.log('LIVE FAIRY DAMAGE VERIFIED',hp,'→',await dad.evaluate(()=>testGame.bridge.ram[0xe50+14]));
  await dad.waitForFunction(()=>testGame.unicorn.target,{},{timeout:5000});
  const unicornHp=await dad.evaluate(()=>testGame.bridge.ram[0xe50+14]);
  await michelle.locator('#unicorn-fire').click();
  await dad.waitForFunction(old=>testGame.bridge.ram[0xe50+14]<old,unicornHp,{timeout:5000});
  console.log('Unicorn homing attack dealt native enemy damage');
  const bounces=await dad.evaluate(()=>{
    const u=testGame.unicorn,r=testGame.bridge.ram;u.x=120;u.y=145;u.follow=false;u.stop();
    const x=u.x+testGame.bridge.read().cameraX-3,y=u.y+testGame.bridge.read().cameraY-8,k=14;
    r[0xd10+k]=x&255;r[0xd30+k]=x>>8;r[0xd00+k]=y&255;r[0xd20+k]=y>>8;return u.bounces;
  });
  await dad.waitForFunction(old=>testGame.unicorn.bounces>old,bounces);
  assert.ok(await dad.evaluate(()=>testGame.unicorn.active),'Unicorn survives contact');
  console.log('Live enemy bounced the unicorn without killing it');
  await dad.locator('#pause').click();await michelle.waitForFunction(()=>document.getElementById('unicorn-fire').disabled&&document.getElementById('unicorn-heal').disabled);await dad.locator('#pause').click();
  await shot(jj,'fairy-gameplay.png');
  await jj.locator('#tablet-sound').click();
  assert.equal(await jj.locator('#video').evaluate(v=>v.muted),false);
  assert.ok(await jj.locator('#video').evaluate(v=>v.srcObject.getAudioTracks().length));
  await jj.locator('#kid-lock').click();
  assert.equal(await jj.locator('#tablet-leave').isVisible(),false);
  await dad.locator('#options').click();await dad.locator('#unlock-tablet').click();
  await jj.waitForFunction(()=>!document.getElementById('tablet').classList.contains('kid-locked'));
  await dad.locator('#close-options').click();
  console.log('Dad remotely unlocked the tablet through WebRTC');
  await jj.locator('#tablet-leave').click();await dad.waitForTimeout(300);
  await jj.locator('#join').click();await jj.waitForFunction(()=>document.getElementById('video').readyState>=2,{},{timeout:20000});
  console.log('Tablet sound and reconnection verified');
  assert.ok(await dad.evaluate(()=>testGame.network.has('michelle')),'JJ reconnect does not remove Michelle');
  await michelle.locator('#michelle-leave').click();await dad.waitForFunction(()=>!testGame.unicorn.enabled);
  assert.ok(await dad.evaluate(()=>testGame.network.has('jj')),'Michelle leaving preserves JJ');
  await michelle.locator('#michelle-join').click();await dad.waitForFunction(()=>testGame.network.has('michelle')&&testGame.unicorn.active);
  await dad.waitForTimeout(600); // Allow the composite frame to reach the tablet after rejoining.
  await writeFile(new URL('three-player-broadcast.png',results),Buffer.from(await dad.evaluate(()=>document.getElementById('broadcast').toDataURL().split(',')[1]),'base64'));
  await shot(jj,'three-player-gameplay.png');
  console.log('Independent third-player leave/rejoin verified');
  // The permanent phone view includes the complete broadcast while leaving
  // the joystick, sword and menu controls reachable at common phone sizes.
  await dad.waitForFunction(()=>new Set(document.getElementById('dad-canvas').getContext('2d').getImageData(0,0,512,384).data).size>3);
  assert.equal(await dad.evaluate(()=>{
    const canvas=document.getElementById('dad-canvas'),expected=document.createElement('canvas');
    expected.width=canvas.width;expected.height=canvas.height;
    const ctx=expected.getContext('2d');ctx.imageSmoothingEnabled=false;
    ctx.drawImage(document.getElementById('broadcast'),0,0,expected.width,expected.height);
    return expected.toDataURL()===canvas.toDataURL();
  }),true,'Dad sees the complete game and companion composite');
  for(const [width,height] of [[900,430],[844,390],[667,375],[568,320],[390,844],[360,640]]){
    await dad.setViewportSize({width,height});
    const boxes=await dad.evaluate(()=>Object.fromEntries(['dad-canvas','dpad'].map(id=>[id,document.getElementById(id).getBoundingClientRect().toJSON()]).concat([...document.querySelectorAll('#controller [data-key]')].map(el=>['key-'+el.dataset.key,el.getBoundingClientRect().toJSON()]))));
    const screen=boxes['dad-canvas'];assert.ok(screen.width>=150&&screen.height>=120,`Readable game at ${width}x${height}`);
    for(const [id,box] of Object.entries(boxes)){
      assert.ok(box.x>=0&&box.y>=0&&box.right<=width+.5&&box.bottom<=height+.5,`${id} fits ${width}x${height}`);
      if(id!=='dad-canvas')assert.ok(box.right<=screen.x+.5||box.x>=screen.right-.5||box.bottom<=screen.y+.5||box.y>=screen.bottom-.5,`${id} does not cover the game`);
    }
    await shot(dad,`dad-live-${width}x${height}.png`);
  }
  console.log('Live Dad view verified at six phone sizes, with controls clear of the game');
  await learningChecks({dad,jj,michelle,shot});
  await writeFile(new URL('source-canvas.png',results),Buffer.from(await dad.evaluate(()=>testGame.emulator.canvas.toDataURL().split(',')[1]),'base64'));
  assert.deepEqual(errors,[]);
  console.log('Browser checks passed');
}finally{await browser.close();await tabletBrowser.close();await michelleBrowser.close();server.close();}
