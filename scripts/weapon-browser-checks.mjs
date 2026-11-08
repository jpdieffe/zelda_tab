import assert from 'node:assert/strict';
export async function weaponChecks({dad,jj,michelle,shot}){
  await dad.evaluate(()=>{
    const fire=testGame.fairy.fireArrows.bind(testGame.fairy);
    testGame.fairy.fireArrows=(...args)=>{const result=fire(...args);window.lastVolley={result,angles:testGame.fairy.shots.filter(s=>s.kind==='arrow').map(s=>Math.atan2(s.vy,s.vx))};return result;};
    const bomb=testGame.unicorn.fireBomb.bind(testGame.unicorn);
    testGame.unicorn.fireBomb=(...args)=>{const result=bomb(...args);window.lastBomb={result,count:testGame.unicorn.bombs.projectiles.length};return result;};
  });
  const prepare=async role=>dad.evaluate(async role=>{
    const {ADDR:A}=await import('/zelda.js'),r=testGame.bridge.ram,w=testGame.bridge.read(),k=14;
    for(let i=0;i<16;i++)if(i!==k)r[A.state+i]=0; // Isolate the intended auto-target from roaming guards.
    const x=w.cameraX+120,y=w.cameraY+136;r[A.xLo+k]=x&255;r[A.xHi+k]=x>>8;r[A.yLo+k]=y&255;r[A.yHi+k]=y>>8;
    r[A.hit+k]=r[A.damage+k]=r[A.recoil+k]=r[A.z+k]=0;
    const c=role==='jj'?testGame.fairy:testGame.unicorn;c.x=c.tx=96;c.y=c.ty=144;c.follow=false;c.aimX=1;c.aimY=0;c.cooldown=0;
    if(c.stop)c.stop();c.knockX=c.knockY=0;c.invulnerable=2;
    return r[A.hp+k];
  },role);
  const arrowHp=await prepare('jj');
  await jj.locator('#arrows').click();await dad.waitForFunction(()=>window.lastVolley?.result==='fired');
  assert.equal(await dad.evaluate(()=>lastVolley.angles.length),5);
  assert.equal(await dad.evaluate(()=>new Set(lastVolley.angles).size),5);
  assert.equal(await jj.locator('#arrows').isDisabled(),true);
  await dad.waitForFunction(hp=>testGame.bridge.ram[0xe50+14]<hp,arrowHp,{timeout:5000});
  const bombHp=await prepare('michelle');
  await michelle.locator('#unicorn-bomb').click();await dad.waitForFunction(()=>window.lastBomb?.result==='fired');
  assert.equal(await dad.evaluate(()=>lastBomb.count),1);assert.equal(await michelle.locator('#unicorn-bomb').isDisabled(),true);
  await dad.waitForFunction(hp=>testGame.bridge.ram[0xe50+14]<hp,bombHp,{timeout:5000});
  await dad.locator('#pause').click();
  await jj.waitForFunction(()=>document.getElementById('arrows').disabled);
  await michelle.waitForFunction(()=>document.getElementById('unicorn-bomb').disabled);
  const remaining=await dad.evaluate(()=>testGame.unicorn.bombs.cooldown);await dad.waitForTimeout(200);
  assert.equal(await dad.evaluate(()=>testGame.unicorn.bombs.cooldown),remaining,'Pause freezes bomb cooldown');
  await dad.locator('#pause').click();
  await jj.locator('#arrows').waitFor({state:'visible'});
  for(const [width,height] of [[1280,800],[960,540],[390,844]]){
    await jj.setViewportSize({width,height});
    for(const id of ['fire','arrows']){
      const r=await jj.locator('#'+id).boundingBox();assert.ok(r.width>=44&&r.height>=44&&r.x>=0&&r.y>=0&&r.x+r.width<=width+.5&&r.y+r.height<=height+.5,id+' stays reachable');
    }
    await shot(jj,`jj-weapons-${width}.png`);
  }
  await jj.setViewportSize({width:1280,height:800});
  await shot(michelle,'michelle-bomb-button.png');
  console.log('Actual tablet arrow fan and phone bombs deal native damage; cooldowns, pause and touch layouts passed');
}
