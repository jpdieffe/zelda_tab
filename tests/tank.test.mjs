import {romOffset} from '../dist/collision.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {LearningRound} from '../dist/learning.js';
import {TeamTank} from '../dist/tank.js';
import {TankTerrain,doorAttribute,crushAttribute} from '../dist/tank-terrain.js';
import {ADDR as A,readWorld,applyPowerHit} from '../dist/zelda.js';
const put=(r,a,v)=>{r[a]=v&255;r[a+1]=v>>8;};
const addr=(x,y)=>0x12000+((y&0x1f8)<<3)+((x&0x1f8)>>3);
function fixture(){
 const r=new Uint8Array(0x20000);r[A.module]=7;r[A.indoors]=1;r[A.health]=r[A.capacity]=24;put(r,A.linkX,72);put(r,A.linkY,92);
 const bridge={ram:r,rom:null,read:()=>readWorld(r),powerHit:(...args)=>applyPowerHit(r,...args),fireSound:()=>true,bombSound:()=>true};
 return {r,bridge,tank:new TeamTank(bridge)};
}
test('tank unlocks after all four questions, including retries on any or every question',()=>{
 for(const mistake of [-2,-1,0,1,2,3]){
  const q=new LearningRound();q.start({playing:true,tablet:true,tank:true});assert.equal(q.snapshot().total,4);q.advance(q.token());
  assert.deepEqual(q.round.questions.map(q=>q.role),['jj','jj','michelle','michelle']);assert.deepEqual(q.round.questions.map(q=>q.kind),['letter','letter','math','word']);
  for(let n=0;n<4;n++){
   const item=q.round.questions[n];if(n===mistake||mistake===-2){
    for(let retry=0;retry<2;retry++){q.answer(q.token(),item.choices.findIndex(a=>a!==item.answer));assert.equal(q.reward().giant,false);assert.match(q.snapshot().feedback,/still earn the tank/);q.advance(q.token());}
   }
   q.answer(q.token(),item.choices.indexOf(item.answer));assert.doesNotMatch(q.snapshot().feedback,/No superpower|first try/);if(n<3){assert.equal(q.reward().giant,false);q.advance(q.token());}
  }
  const reward=q.advance(q.token());assert.equal(reward.type,'tank');assert.equal(reward.giant,true);assert.deepEqual(reward.roles,['jj','michelle']);
 }
});
test('tank crosses and crushes walls, crosses water, but stops its entire body before doors',()=>{
 const {r,bridge,tank}=fixture();for(let y=48;y<208;y+=8){r[addr(112,y)]=1;r[addr(144,y)]=8;r[addr(184,y)]=0x90;}
 assert.equal(tank.start(bridge.read()),true);
 for(let i=0;i<50;i++)tank.update(.05,bridge.read(),{x:1,y:0});
 assert.ok(tank.x>150&&tank.x<164);assert.equal(r[addr(112,96)],0,'Wall collision becomes floor');assert.equal(r[addr(144,96)],8,'Water stays water');assert.equal(r[addr(184,96)],0x90,'Door collision remains intact');
 assert.equal(r[0x37b],1);assert.equal(r[0x2e4],1);assert.equal(r[0x4b],12);assert.equal(r[A.health],24);
 for(const a of [0x80,0x8e,0x90,0xa0,0xf0,0xff]){assert.equal(doorAttribute(a),true);assert.equal(crushAttribute(a),false);}
});
test('release and save restore Link safely from water without saving tank invulnerability or modified terrain',()=>{
 const {r,bridge,tank}=fixture();r[addr(112,96)]=1;for(let y=64;y<144;y+=8)for(let x=136;x<184;x+=8)r[addr(x,y)]=8;
 tank.start(bridge.read());for(let i=0;i<16;i++)tank.update(.05,bridge.read(),{x:1,y:0});assert.ok(tank.x>150);
 const saved=tank.cleanState(()=>r.slice(),bridge.read());assert.equal(saved[0x2e4],0);assert.equal(saved[0x37b],0);assert.equal(saved[0x4b],0);assert.equal(saved[addr(112,96)],1);
 assert.equal(r[0x2e4],1,'Saving preserves the live tank');assert.equal(r[addr(112,96)],0);
 tank.release(bridge.read());assert.equal(tank.active,false);assert.equal(r[0x37b],0);assert.equal(r[0x4b],0);assert.equal(tank.terrain.safe((r[A.linkX]|r[A.linkX+1]<<8)+8,(r[A.linkY]|r[A.linkY+1]<<8)+8),true);
});
test('tank missiles curve toward the tapped destination, hearts use a separate cooldown and all freeze while paused',()=>{
 const {bridge,tank}=fixture();tank.start(bridge.read());assert.equal(tank.launch(220,170,bridge.read()),true);assert.equal(tank.launch(220,170,bridge.read()),false);
 assert.equal(tank.hearts(bridge.read()),true);assert.equal(tank.missiles.length,6);
 tank.update(.2,bridge.read(),{x:0,y:0});const p=tank.missiles[0];assert.ok(Math.abs((p.y-100)/(p.x-80)-70/140)>.1,'Trajectory is curved');
 const before=JSON.stringify(tank.missiles);tank.update(30,bridge.read(),{x:1,y:0},true);assert.equal(JSON.stringify(tank.missiles),before);
 for(let i=0;i<40;i++)tank.update(.05,bridge.read(),{x:0,y:0});assert.equal(tank.missiles.length,0);tank.update(600,bridge.read(),{x:0,y:0});assert.equal(tank.active,true,'Only Dad releases tank power');
});
test('rainbow beam follows joystick direction, damages native enemies, and stops on release or stale input',()=>{
 const {r,bridge,tank}=fixture();r[A.state]=9;r[A.type]=0x41;r[A.hp]=64;put(r,A.xLo,180-8);put(r,A.yLo,100-8);tank.start(bridge.read());
 tank.setAim(1,0);tank.update(.05,bridge.read(),{x:0,y:0});assert.ok(tank.beam);assert.equal(r[A.damage],8);
 tank.setAim(0,0);tank.update(.05,bridge.read(),{x:0,y:0});assert.equal(tank.beam,null);
 tank.setAim(0,1);tank.update(.05,bridge.read(),{x:0,y:0});assert.ok(tank.beam.end.y>tank.beam.source.y);tank.update(.4,bridge.read(),{x:0,y:0});assert.equal(tank.beam,null);
});

test('outdoor crushing changes map16 collision, preserves water and entrances, and restores terrain for clean saves',()=>{
 const {r,bridge}=fixture();r[A.indoors]=0;r[A.module]=9;put(r,0x70a,0x3f0);put(r,0x70e,0x7e);bridge.rom=new Uint8Array(0x100000);
 const rom=bridge.rom;for(let tile=0;tile<4;tile++){rom[romOffset(0x8e9459)+tile]=[0,1,8,0x8f][tile];for(let q=0;q<4;q++)put(rom,romOffset(0x8f8000)+(tile*4+q)*2,tile);}
 put(rom,romOffset(0x9bba71),(12<<1)|(6<<7));
 const terrain=new TankTerrain(bridge);terrain.enter(bridge.read());assert.equal(terrain.floorMap,0);assert.equal(terrain.door(200,104),true,'Known entrance is blocked even when its tile is ordinary floor');
 const wall=terrain.mapAddress(112,96),water=terrain.mapAddress(144,96),door=terrain.mapAddress(176,96);put(r,wall,1);put(r,water,2);put(r,door,3);
 terrain.smash(120,104);terrain.smash(152,104);terrain.smash(184,104);
 assert.equal(r[wall],0);assert.equal(r[water],2);assert.equal(r[door],3);assert.equal(terrain.attr(120,104),0);
 terrain.clean(()=>assert.equal(r[wall],1));assert.equal(r[wall],0);terrain.reset();assert.equal(r[wall],1);
});
test('scripted scene changes re-anchor the tank and discard old missiles without ending Dad-controlled tank power',()=>{
 const {bridge,tank}=fixture();tank.start(bridge.read());tank.launch(200,144,bridge.read());
 tank.update(.05,{...bridge.read(),scene:'new',cameraX:512,link:{x:80,y:100}},{x:0,y:0});
 assert.equal(tank.active,true);assert.equal(tank.x,592);assert.equal(tank.missiles.length,0);
});

test('tank leaves the viewport and accumulates movement once per native frame for camera scrolling',()=>{
 const {r,bridge,tank}=fixture();tank.start(bridge.read());
 tank.update(.01,bridge.read(),{x:1,y:0});tank.update(.01,bridge.read(),{x:1,y:0});assert.equal(r[0x31],2);
 r[0x1a]++;tank.update(.01,bridge.read(),{x:1,y:0});assert.equal(r[0x31],1);assert.equal(r[0x67],1);
 const velocity=r[0x31];tank.cleanState(()=>r.slice(),bridge.read());assert.equal(r[0x31],velocity,'Saving preserves pending camera movement');
 for(let i=0;i<50;i++){r[0x1a]++;tank.update(.05,bridge.read(),{x:1,y:0});}
 assert.ok(tank.x>256);assert.equal(r[0xa9],1,'Crossing a room quadrant adjusts native camera bounds');
 tank.update(.01,bridge.read(),{x:0,y:0},true);assert.equal(r[0x31],0);
});

test('native transitions own Link until fully finished, then the tank resumes at the final destination',()=>{
 const {r,bridge,tank}=fixture();tank.start(bridge.read());tank.launch(200,100,bridge.read());
 r[A.submodule]=2;put(r,A.room,1);put(r,A.linkX,490);
 tank.update(.05,bridge.read(),{x:1,y:0});assert.equal(r[A.linkX]|r[A.linkX+1]<<8,490);assert.equal(tank.missiles.length,0);
 assert.throws(()=>tank.cleanState(()=>r.slice(),bridge.read()),/crossing/);
 put(r,A.linkX,540);tank.update(.05,bridge.read(),{x:1,y:0});assert.equal(r[A.linkX]|r[A.linkX+1]<<8,540);
 r[A.submodule]=0;tank.update(.05,bridge.read(),{x:0,y:0});assert.equal(tank.x,548);assert.equal(tank.active,true);
 r[A.submodule]=2;tank.release(bridge.read());assert.equal(tank.active,true,'Release waits for native transition completion');
 tank.update(.05,bridge.read(),{x:0,y:0});r[A.submodule]=0;tank.update(.05,bridge.read(),{x:0,y:0});assert.equal(tank.active,false);assert.equal(r[0x2e4],0);
});
