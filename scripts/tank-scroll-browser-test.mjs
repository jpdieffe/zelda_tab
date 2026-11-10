import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {serve} from './serve.mjs';
const server=serve(4184),browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling']});
try{
 const page=await browser.newPage({viewport:{width:900,height:430}});
 page.on('pageerror',e=>{throw e;});await page.goto('http://localhost:4184');
 await page.evaluate(async()=>{window.g=(await import('/app.js')).game;});
 await page.locator('#choose-dad').click();await page.waitForFunction(()=>g.ready&&g.bridge?.ram,{},{timeout:90000});
 await page.evaluate(bytes=>g.emulator.gameManager.loadState(new Uint8Array(bytes)),Array.from(await readFile('test-results/active-game.state')));
 await page.waitForTimeout(200);
 const info=()=>page.evaluate(()=>{const r=g.bridge.ram,w=g.bridge.read();return {active:w.active,scene:w.scene,indoors:r[0x1b],module:r[0x10],sub:r[0x11],camera:[w.cameraX,w.cameraY],link:w.link,tank:[g.tank.x,g.tank.y],vel:[r[0x30],r[0x31]],direction:r[0x67],quad:[r[0xa6],r[0xa7],r[0xa9],r[0xaa]]};});
 await page.evaluate(()=>{const r=g.bridge.ram,w=g.bridge.read(),x=w.cameraX+120,y=w.cameraY+192;r.fill(0,0xdd0,0xde0);r[0x2e4]=r[0x5d]=r[0x4b]=r[0x37b]=0;r[0x22]=x&255;r[0x23]=x>>8;r[0x20]=y&255;r[0x21]=y>>8;});
 console.log('House',await info());
 await page.keyboard.down('ArrowDown');await page.waitForTimeout(2500);await page.keyboard.up('ArrowDown');await page.waitForTimeout(1500);
 console.log('Outside',await info());
 await writeFile('test-results/tank-scroll-start.png',await page.screenshot());
 assert.equal(await page.evaluate(()=>g.bridge.ram[0x1b]),0,'Native house exit reaches outdoors');
 assert.equal(await page.evaluate(()=>g.tank.start(g.bridge.read())),true);
 const start=await info();await page.keyboard.down('ArrowRight');
 await page.waitForFunction(scene=>g.bridge.read().active&&g.bridge.read().scene!==scene,start.scene,{timeout:10000});
 await page.keyboard.up('ArrowRight');
 const end=await info();await writeFile('test-results/tank-scroll-end.png',await page.screenshot());
 assert.notDeepEqual(end.camera,start.camera,'Native camera follows tank');assert.notEqual(end.scene,start.scene,'Tank reaches neighboring area');assert.equal(await page.evaluate(()=>g.tank.active),true);
 console.log('East crossing',end);
 await page.keyboard.down('ArrowLeft');await page.waitForFunction(scene=>g.bridge.read().active&&g.bridge.read().scene===scene,start.scene,{timeout:10000});await page.keyboard.up('ArrowLeft');console.log('West return',await info());
 await page.keyboard.down('ArrowLeft');await page.waitForTimeout(900);await page.keyboard.up('ArrowLeft');
 await page.keyboard.down('ArrowUp');await page.waitForFunction(scene=>g.bridge.read().active&&g.bridge.read().scene!==scene,start.scene,{timeout:10000});await page.keyboard.up('ArrowUp');
 const north=await info();console.log('North crossing',north);assert.ok(north.link.y>=32&&north.link.y<=224);
 await page.keyboard.down('ArrowDown');await page.waitForFunction(scene=>g.bridge.read().active&&g.bridge.read().scene===scene,start.scene,{timeout:10000});await page.keyboard.up('ArrowDown');
 const south=await info();console.log('South return',south);assert.ok(south.link.y>=0&&south.link.y<=224);
 await page.evaluate(()=>g.tank.reset(g.bridge.read()));
 await page.evaluate(bytes=>g.emulator.gameManager.loadState(new Uint8Array(bytes)),Array.from(await readFile('test-results/active-game.state')));await page.waitForTimeout(200);
 await page.evaluate(()=>{const r=g.bridge.ram,w=g.bridge.read(),x=w.cameraX+120,y=w.cameraY+136;r.fill(0,0xdd0,0xde0);r[0x2e4]=r[0x5d]=r[0x4b]=r[0x37b]=0;r[0x22]=x&255;r[0x23]=x>>8;r[0x20]=y&255;r[0x21]=y>>8;g.tank.start(g.bridge.read());});
 const inside=await info();await page.keyboard.down('ArrowRight');
 try{await page.waitForFunction(scene=>g.bridge.read().active&&g.bridge.read().scene!==scene,inside.scene,{timeout:10000});}catch(e){console.log('Indoor failure',await info());throw e;}finally{await page.keyboard.up('ArrowRight');}
 const next=await info();console.log('Indoor crossing',next);assert.equal(await page.evaluate(()=>g.tank.active),true);assert.ok(next.link.x>=0&&next.link.x<=256,'Tank stays onscreen after indoor crossing');
 // The destination has a doorway at the entry height; drive through the wall beside it.
 await page.keyboard.down('ArrowUp');await page.waitForTimeout(700);await page.keyboard.up('ArrowUp');
 await page.keyboard.down('ArrowLeft');
 for(let i=0;i<100;i++){
  const w=await info();if(w.active&&w.scene===inside.scene)break;
  if(w.module===14&&w.sub===2){await page.keyboard.up('ArrowLeft');await page.locator('[data-key="8"]').click({delay:100});}
  await page.waitForTimeout(150);
 }
 await page.keyboard.up('ArrowLeft');
 const back=await info();console.log('Indoor return',back);assert.ok(back.link.x>=0&&back.link.x<=256);
 assert.equal(back.scene,inside.scene);assert.equal(back.active,true,'Dad can dismiss a room-entry dialogue while in the tank');
 console.log('Native tank camera scrolling and area crossings passed in all four directions, plus indoor round trip');
}finally{await browser.close();server.close();}
