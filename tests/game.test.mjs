import test from 'node:test';
import assert from 'node:assert/strict';
import { ADDR as A, RAM_SIZE, readWorld, applyHit, snapshotRam, findRamCandidates, ENEMIES } from '../dist/zelda.js';
import { Fairy, nearestEnemy, RANGE } from '../dist/fairy.js';
import { validCode, normalizeCode, roomCode } from '../dist/network.js';
function fixture(){
  const ram=new Uint8Array(RAM_SIZE);ram[A.module]=9;
  ram[A.state]=9;ram[A.type]=0x41;ram[A.hp]=4;ram[A.xLo]=100;ram[A.yLo]=100;
  return ram;
}
test('only live ordinary enemies on Link’s floor are targetable',()=>{
  const ram=fixture();assert.equal(readWorld(ram).enemies.length,1);
  for(const type of [0x73,0x76,0x52,0x1e,0x3f,0x40,0x09,0x53,0x7a,0x92]){ram[A.type]=type;assert.equal(readWorld(ram).enemies.length,0,`excluded ${type}`);}
  ram[A.type]=0x41;ram[A.spriteFloor]=1;assert.equal(readWorld(ram).enemies.length,0);
  ram[A.spriteFloor]=0;ram[A.state]=6;assert.equal(readWorld(ram).enemies.length,0);
  ram[A.state]=9;ram[A.flags3]=0x40;assert.equal(readWorld(ram).enemies.length,0);
});
test('dialogue, menus and transitions disable targeting and writes',()=>{
  const ram=fixture(),target=readWorld(ram).enemies[0];
  for(const module of [0,1,2,6,14,15]){ram[A.module]=module;assert.equal(applyHit(ram,target,{x:100,y:100}),false);assert.equal(ram[A.damage],0);}
  ram[A.module]=9;ram[A.submodule]=1;assert.equal(applyHit(ram,target,{x:100,y:100}),false);
});
test('nearest vulnerable enemy must be inside the short range',()=>{
  const fairy={x:100,y:100};const far={x:100+RANGE+1,y:100,vulnerable:true},near={x:110,y:100,vulnerable:true},invincible={x:101,y:100,vulnerable:false};
  assert.equal(nearestEnemy([far],fairy),null);assert.equal(nearestEnemy([far,near,invincible],fairy),near);
});
test('hits queue native damage, never decrement HP or force sprite death',()=>{
  const ram=fixture(),target=readWorld(ram).enemies[0];
  assert.equal(applyHit(ram,target,{x:100,y:100}),true);
  assert.equal(ram[A.hp],4);assert.equal(ram[A.state],9);assert.equal(ram[A.damage],1);assert.equal(ram[A.hit],32);
  assert.equal(applyHit(ram,target,{x:100,y:100}),false,'invulnerability prevents double hit');
});
test('impact revalidates type, scene, and distance',()=>{
  const ram=fixture(),target=readWorld(ram).enemies[0];
  ram[A.type]=0x42;assert.equal(applyHit(ram,target,{x:100,y:100}),false);
  ram[A.type]=0x41;assert.equal(applyHit(ram,target,{x:0,y:0}),false);
  assert.equal(ram[A.damage],0);
});
test('camera transform supports full 16-bit coordinates and height',()=>{
  const ram=fixture();ram[A.cameraX]=240;ram[A.cameraX+1]=1;ram[A.xLo]=10;ram[A.xHi]=2;ram[A.z]=5;
  const enemy=readWorld(ram).enemies[0];assert.equal(enemy.x,34);assert.equal(enemy.y,103);
});
test('fairy flies, follows scene changes, shoots, and enforces cooldown',()=>{
  const fairy=new Fairy(),world={active:true,scene:'a',cameraX:0,cameraY:0,link:{x:100,y:100},enemies:[{slot:1,type:0x41,x:125,y:95,vulnerable:true}]};
  fairy.update(.016,world);fairy.move(120,95);fairy.update(.1,world);
  let hits=0;assert.equal(fairy.fire(()=>{hits++;return true;}),'fired');assert.equal(fairy.fire(()=>true),'wait');
  fairy.update(.1,world);assert.equal(hits,1);
  fairy.update(.7,world);assert.equal(fairy.cooldown,0);
  fairy.update(.016,{...world,scene:'b',link:{x:40,y:80}});assert.equal(fairy.follow,true);assert.equal(fairy.x,58);
  fairy.move(NaN,100);assert.ok(Number.isFinite(fairy.tx));
});
test('RAM search excludes serialized state and verifies the entire region',()=>{
  const ram=new Uint8Array(RAM_SIZE);for(let i=0;i<ram.length;i++)ram[i]=(i*37+(i>>8))&255;
  const heap=new Uint8Array(RAM_SIZE*4);heap.set(ram,8);heap.set(ram,RAM_SIZE*2);
  assert.deepEqual(findRamCandidates(heap,ram,RAM_SIZE*2,RAM_SIZE),[8]);
  heap[8+RAM_SIZE-1]^=1;assert.deepEqual(findRamCandidates(heap,ram,RAM_SIZE*2,RAM_SIZE),[]);
});
test('snapshot parser rejects missing or truncated RAM',()=>{
  assert.throws(()=>snapshotRam(new Uint8Array(100)));
  const marker=new TextEncoder().encode('RAM:131072:');const state=new Uint8Array(marker.length+RAM_SIZE);state.set(marker);state[marker.length+123]=42;
  assert.equal(snapshotRam(state)[123],42);assert.throws(()=>snapshotRam(state.slice(0,-1)));
});
test('pairing uses unambiguous random codes and validates malformed input',()=>{
  assert.equal(normalizeCode(' abcd efgh '),'ABCDEFGH');assert.equal(validCode('ABCDEFGH'),true);assert.equal(validCode('<script>'),false);
  for(let i=0;i<50;i++)assert.equal(validCode(roomCode()),true);
});
