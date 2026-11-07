import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
export async function powerChecks({dad,jj,michelle,shot}){
 await dad.evaluate(async()=>{
  window.powerA=(await import('/zelda.js')).ADDR;window.powerHits=[];
  const original=testGame.bridge.powerHit.bind(testGame.bridge);
  testGame.bridge.powerHit=(...args)=>{const accepted=original(...args);if(accepted)powerHits.push({type:args[2],source:{x:args[1].x,y:args[1].y}});return accepted;};
 });
 for(const type of ['missiles','dinosaur','meteor']){
  await dad.evaluate(type=>{
   testGame.learning.rewardBag=[type];testGame.powers.timers={};testGame.powers.missiles=[];testGame.powers.meteors=[];
   testGame.powers.syncCharacters({jj:testGame.fairy,michelle:testGame.unicorn});
   const r=testGame.bridge.ram,A=powerA,w=testGame.bridge.read(),k=14,x=w.cameraX+120,y=w.cameraY+136;
   r[A.state+k]=8;r[A.type+k]=0x41;r[A.xLo+k]=x&255;r[A.xHi+k]=x>>8;r[A.yLo+k]=y&255;r[A.yHi+k]=y>>8;r[A.spriteFloor+k]=r[A.floor];
  },type);
  await dad.waitForFunction(()=>testGame.bridge.ram[powerA.state+14]===9);
  await dad.locator('#start-questions').click();await jj.locator('#quiz-next').click();
  for(let n=0;n<2;n++){
   await jj.waitForFunction(()=>!document.getElementById('quiz-panel').hidden&&document.getElementById('quiz-next').hidden);
   const choice=await dad.evaluate(()=>{const r=testGame.learning.round,q=r.questions[r.index];return q.choices.indexOf(q.answer);});
   await jj.locator('.quiz-choice').nth(choice).click();await jj.locator('#quiz-next').waitFor({state:'visible'});
   if(!n)await jj.locator('#quiz-next').click();
  }
  assert.match(await jj.locator('#quiz-feedback').textContent(),new RegExp(type==='missiles'?'missiles':type==='dinosaur'?'dinosaurs':'meteors','i'));
  await dad.evaluate(()=>{
   const r=testGame.bridge.ram,A=powerA,k=14,w=testGame.bridge.read(),x=w.cameraX+120,y=w.cameraY+136;
   r[A.xLo+k]=x&255;r[A.xHi+k]=x>>8;r[A.yLo+k]=y&255;r[A.yHi+k]=y>>8;r[A.z+k]=r[A.hit+k]=r[A.damage+k]=r[A.recoil+k]=r[A.pause+k]=0;r[A.hp+k]=64;r[0xdf0+k]=180;r[0xd40+k]=r[0xd50+k]=0;
   for(const [c,x] of [[testGame.fairy,96],[testGame.unicorn,112]]){c.x=c.tx=x;c.y=c.ty=144;c.follow=false;c.cooldown=0;c.knockX=c.knockY=0;c.invulnerable=0;if(c.stop)c.stop();}
   window.powerHits=[];
  });
  await jj.locator('#quiz-next').click();await jj.locator('#quiz-panel').waitFor({state:'hidden'});
  await dad.waitForFunction(type=>testGame.powers.snapshot()?.jj?.type===type&&testGame.powers.snapshot()?.michelle?.type===type,type);
  if(type==='dinosaur'){
   // Make a wall in the host collision model, then steer through it using the phone.
   await dad.evaluate(()=>{window.originalPowerRead=testGame.bridge.read.bind(testGame.bridge);testGame.bridge.read=()=>({...originalPowerRead(),wallAt:x=>x>=120});});
   const pad=await michelle.locator('#unicorn-pad').boundingBox(),x=pad.x+pad.width/2,y=pad.y+pad.height/2;
   await michelle.mouse.move(x,y);await michelle.mouse.down();await michelle.mouse.move(x+50,y);
   await dad.waitForFunction(()=>testGame.unicorn.x>145);await michelle.mouse.up();
   assert.equal(await dad.evaluate(()=>testGame.unicorn.dinosaur),true);
  }
  await dad.waitForFunction(type=>powerHits.some(h=>h.type===type)&&testGame.bridge.ram[powerA.hp+14]<64,type,{timeout:5000});
  await writeFile(new URL(`../test-results/power-${type}.png`,import.meta.url),Buffer.from(await dad.evaluate(()=>document.getElementById('broadcast').toDataURL().split(',')[1]),'base64'));
  await shot(jj,`power-${type}-tablet.png`);
  await dad.locator('#pause').click();const frozen=await dad.evaluate(()=>testGame.powers.timers.jj.remaining);
  await dad.waitForTimeout(180);assert.equal(await dad.evaluate(()=>testGame.powers.timers.jj.remaining),frozen);
  await dad.locator('#pause').click();
  await dad.evaluate(()=>{for(const t of Object.values(testGame.powers.timers))t.remaining=.01;});
  await dad.waitForFunction(()=>!testGame.powers.snapshot());
  if(type==='dinosaur'){
   await dad.waitForFunction(()=>!testGame.unicorn.dinosaur&&testGame.unicorn.active&&testGame.unicorn.clearAt(testGame.unicorn.x,testGame.unicorn.y,testGame.bridge.read()));
   assert.ok(await dad.evaluate(()=>testGame.unicorn.x<120),'Dinosaur expiry returns unicorn to clear floor');
   await dad.evaluate(()=>{testGame.bridge.read=originalPowerRead;});
  }
  console.log(`Question-earned ${type}: both children, native damage, visible effect, pause and expiry passed`);
 }
}
