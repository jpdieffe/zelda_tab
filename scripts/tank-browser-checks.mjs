import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
export async function tankChecks({dad,jj,michelle,shot}){
 await dad.setViewportSize({width:900,height:430});
 // The shared fixture is the opening bed scene; earlier combat tests remove
 // its scripted uncle. Place an awake Link on the room floor for driving.
 await dad.evaluate(()=>{const r=testGame.bridge.ram,w=testGame.bridge.read(),x=w.cameraX+88,y=w.cameraY+136;r[0x2e4]=r[0x5d]=r[0x4b]=r[0x37b]=0;r[0x22]=x&255;r[0x23]=x>>8;r[0x20]=y&255;r[0x21]=y>>8;});
 const challenge=async mistake=>{
  await dad.locator('#tank-questions').click();await jj.locator('#quiz-next').click();
  for(let n=0;n<4;n++){
   await jj.waitForFunction(()=>document.getElementById('quiz-next').hidden);
   const info=await dad.evaluate(()=>{const r=testGame.learning.round,q=r.questions[r.index];return {role:q.role,correct:q.choices.indexOf(q.answer),wrong:q.choices.findIndex(a=>a!==q.answer)};});
   assert.equal(info.role,n<2?'jj':'michelle');
   if(n===mistake){await jj.locator('.quiz-choice').nth(info.wrong).click();await jj.locator('#quiz-next').click();await jj.waitForFunction(()=>document.getElementById('quiz-next').hidden);}
   await jj.locator('.quiz-choice').nth(info.correct).click();await jj.locator('#quiz-next').waitFor({state:'visible'});
   if(n===3)assert.equal(await dad.evaluate(()=>testGame.learning.reward().giant),mistake<0);
   await jj.locator('#quiz-next').click();
  }
  await jj.locator('#quiz-panel').waitFor({state:'hidden'});
 };
 await challenge(1);assert.equal(await dad.evaluate(()=>testGame.tank.active),false,'One wrong first try prevents tank reward');
 await challenge(-1);await dad.waitForFunction(()=>testGame.tank.active);
 assert.equal(await dad.locator('#release-tank').isVisible(),true);await michelle.locator('#tank-hearts').waitFor({state:'visible'});
 assert.equal(await michelle.locator('#unicorn-fire').isVisible(),false);assert.equal(await jj.locator('#arrows').isVisible(),false);
 await dad.evaluate(async()=>{
  window.tankA=(await import('/zelda.js')).ADDR;const w=testGame.bridge.read(),r=testGame.bridge.ram,A=tankA;
  testGame.tank.x=w.cameraX+96;testGame.tank.y=w.cameraY+144;testGame.tank.link.hold(testGame.tank.x,testGame.tank.y);
  r.fill(0,A.state,A.state+16);const k=14,x=w.cameraX+190,y=w.cameraY+136;
  r[A.type+k]=0x41;r[A.xLo+k]=x&255;r[A.xHi+k]=x>>8;r[A.yLo+k]=y&255;r[A.yHi+k]=y>>8;r[A.spriteFloor+k]=r[A.floor];r[A.state+k]=8;
 });
 await dad.waitForFunction(()=>testGame.bridge.ram[tankA.state+14]===9);
 const prepare=()=>dad.evaluate(()=>{
  const r=testGame.bridge.ram,A=tankA,k=14,w=testGame.bridge.read(),x=w.cameraX+190,y=w.cameraY+136;
  r[A.xLo+k]=x&255;r[A.xHi+k]=x>>8;r[A.yLo+k]=y&255;r[A.yHi+k]=y>>8;r[A.z+k]=r[A.hit+k]=r[A.damage+k]=r[A.recoil+k]=r[A.pause+k]=0;r[A.hp+k]=128;r[0xdf0+k]=180;r[0xd40+k]=r[0xd50+k]=0;
 });
 await prepare();
 const mp=await michelle.locator('#unicorn-pad').boundingBox(),mx=mp.x+mp.width/2,my=mp.y+mp.height/2;
 await michelle.mouse.move(mx,my);await michelle.mouse.down();await michelle.mouse.move(mx+50,my);
 await dad.waitForFunction(()=>testGame.tank.beam&&testGame.bridge.ram[tankA.hp+14]<128);
 await writeFile(new URL('../test-results/team-tank-rainbow.png',import.meta.url),Buffer.from(await dad.evaluate(()=>document.getElementById('broadcast').toDataURL().split(',')[1]),'base64'));
 await michelle.mouse.up();await dad.waitForFunction(()=>!testGame.tank.beam);
 await prepare();const surface=await jj.locator('#tap-surface').boundingBox();
 await jj.locator('#tap-surface').click({position:{x:190/256*surface.width,y:144/224*surface.height}});
 await dad.waitForFunction(()=>testGame.tank.missiles.some(m=>!m.heart));await dad.waitForFunction(()=>testGame.bridge.ram[tankA.hp+14]<128);
 await dad.waitForFunction(()=>testGame.tank.missiles.length===0);await prepare();
 await michelle.locator('#tank-hearts').click();await dad.waitForFunction(()=>testGame.tank.missiles.some(m=>m.heart));await dad.waitForFunction(()=>testGame.bridge.ram[tankA.hp+14]<128);
 const health=await dad.evaluate(()=>testGame.bridge.ram[tankA.health]);
 await dad.evaluate(()=>{
  const r=testGame.bridge.ram,w=testGame.bridge.read();window.tankTile=(x,y)=>0x12000+(r[0xee]?0x1000:0)+(((y+w.cameraY)&0x1f8)<<3)+(((x+w.cameraX)&0x1f8)>>3);
  window.tankOriginalTiles=new Map();for(let y=120;y<=168;y+=8)for(const [x,a] of [[128,1],[152,8],[208,0x90]]){const offset=tankTile(x,y);tankOriginalTiles.set(offset,r[offset]);r[offset]=a;}
  r[0x373]=8;
 });
 const pad=await dad.locator('#dpad').boundingBox(),x=pad.x+pad.width/2,y=pad.y+pad.height/2;
 await dad.mouse.move(x,y);await dad.mouse.down();await dad.mouse.move(x+55,y);await dad.waitForTimeout(1250);await dad.mouse.up();
 const moved=await dad.evaluate(()=>({x:testGame.tank.x-testGame.bridge.read().cameraX,health:testGame.bridge.ram[tankA.health],wall:testGame.bridge.ram[tankTile(128,144)],water:testGame.bridge.ram[tankTile(152,144)],door:testGame.bridge.ram[tankTile(208,144)],state:testGame.bridge.ram[0x5d],room:testGame.bridge.read().scene}));
 assert.ok(moved.x>165&&moved.x<190,JSON.stringify(moved));assert.equal(moved.health,health);assert.equal(moved.wall,0);assert.equal(moved.water,8);assert.equal(moved.door,0x90);assert.equal(moved.state,0);
 await dad.locator('#pause').click();const held=await dad.evaluate(()=>testGame.tank.x);await dad.waitForTimeout(150);assert.equal(await dad.evaluate(()=>testGame.tank.x),held);await dad.locator('#pause').click();
 await dad.locator('#save').click();await dad.waitForFunction(()=>!testGame.saving);
 const saved=await dad.evaluate(async()=>{const storage=await import('/storage.js'),{snapshotRam}=await import('/zelda.js'),r=snapshotRam((await storage.get('save')).state);return [r[0x2e4],r[0x37b],r[0x4b]];});assert.deepEqual(saved,[0,0,0]);assert.equal(await dad.evaluate(()=>testGame.tank.active),true);
 for(const [width,height] of [[900,430],[568,320],[390,844]]){await dad.setViewportSize({width,height});const b=await dad.locator('#release-tank').boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=width&&b.y+b.height<=height);await shot(dad,`tank-controls-${width}.png`);}
 await dad.setViewportSize({width:900,height:430});await shot(jj,'team-tank-tablet.png');await shot(michelle,'team-tank-michelle.png');
 await dad.locator('#release-tank').click();await dad.waitForFunction(()=>!testGame.tank.active&&testGame.bridge.ram[0x2e4]===0&&testGame.bridge.ram[0x37b]===0&&testGame.bridge.ram[0x4b]===0);
 await michelle.locator('#unicorn-fire').waitFor({state:'visible'});await jj.locator('#arrows').waitFor({state:'visible'});
 await dad.evaluate(()=>{for(const [a,v] of tankOriginalTiles)testGame.bridge.ram[a]=v;});
 console.log('Tank challenge first-try gate, all three controls, native damage, invulnerability, wall/water crossing, door protection, safe saving and Dad release passed');
}
