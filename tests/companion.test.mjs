import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Fairy} from '../dist/fairy.js';
import {tileAttribute,wallAt,romOffset} from '../dist/collision.js';
import {nextObjective,readGuidance,entrancePoint} from '../dist/guidance.js';
const rom=new Uint8Array(readFileSync(new URL('../dist/assets/alttp-usa.sfc',import.meta.url)));
const world=()=>({active:true,scene:'room',cameraX:0,cameraY:0,link:{x:100,y:120},enemies:[]});
const setWord=(r,a,v)=>{r[a]=v&255;r[a+1]=v>>8;};
test('empty-room shots follow the last flight direction and burst on a thin wall',()=>{
  const w=world(),f=new Fairy();f.update(0,w);f.move(140,f.y);f.update(.2,w);
  w.wallAt=(x)=>x>=150&&x<=152;
  assert.equal(f.fire(()=>assert.fail('empty room cannot damage an enemy')),'fired');
  assert.equal(f.fire(),'wait');f.update(.1,w);
  assert.equal(f.shots.length,0);assert.equal(f.sparks.length,12);
  assert.ok(f.sparks.every(s=>s.x<160),'sweep stops before tunnelling through the wall');
});
test('a wall blocks a homing hit and a vanished target leaves a flying spark',()=>{
  const w=world(),f=new Fairy();f.update(0,w);
  w.enemies=[{slot:1,type:0x41,x:f.x+30,y:f.y,vulnerable:true}];w.wallAt=x=>x>f.x+12;
  let hits=0;f.fire(()=>hits++);f.update(.1,w);assert.equal(hits,0);assert.ok(f.sparks.length);
  f.cooldown=0;w.wallAt=()=>false;f.fire(()=>hits++);w.enemies=[];f.update(.05,w);
  assert.equal(f.shots.length,1);assert.equal(hits,0);
});
test('projectiles scroll with the world and clear across scenes or dialogue',()=>{
  const w=world(),f=new Fairy();f.update(0,w);f.fire();const x=f.shots[0].x;
  f.update(0,{...w,cameraX:20});assert.equal(f.shots[0].x,x-20);
  f.update(0,{...w,scene:'next'});assert.equal(f.shots.length,0);
  f.cooldown=0;f.fire();f.burst(100,100);f.update(0,{...w,active:false});assert.equal(f.shots.length+f.sparks.length,0);
});
test('dungeon collision respects the active floor and sloped tiles',()=>{
  const r=new Uint8Array(0x20000);r[0x1b]=1;
  r[0x12000+8*64+10]=1;assert.equal(wallAt(r,rom,80,64),true);assert.equal(wallAt(r,rom,88,64),false);
  r[0xee]=1;assert.equal(wallAt(r,rom,80,64),false);r[0x13000+8*64+10]=0x10;
  assert.equal(wallAt(r,rom,80,64),true);assert.equal(wallAt(r,rom,87,71),false);
});
test('overworld collision decodes ROM map16 quadrants and live offsets',()=>{
  const r=new Uint8Array(0x20000);setWord(r,0x70a,0x3f0);setWord(r,0x70e,0x7e);
  const tile16=21;setWord(r,0x2000,tile16);
  for(const [x,y,q] of [[0,0,0],[8,0,1],[0,8,2],[8,8,3]]){
    const offset=romOffset(0x8f8000)+(tile16*4+q)*2,tile=rom[offset]|rom[offset+1]<<8;
    let expected=rom[romOffset(0x8e9459)+(tile&0x1ff)];if(expected>=0x10&&expected<0x1c)expected|=tile>>14&1;
    assert.equal(tileAttribute(r,rom,x,y),expected);
  }
});
test('story progression includes prerequisites and skips completed dungeons',()=>{
  const r=new Uint8Array(0x20000);assert.equal(nextObjective(r).id,'uncle');r[0xf359]=1;assert.equal(nextObjective(r).id,'rescue');
  r[0xf3c5]=2;assert.equal(nextObjective(r).id,'eastern');r[0xf374]=4;assert.equal(nextObjective(r).id,'boots');
  r[0xf355]=1;assert.equal(nextObjective(r).id,'book');r[0xf34e]=1;assert.equal(nextObjective(r).id,'desert');
  r[0xf374]=6;r[0xf353]=1;assert.equal(nextObjective(r).id,'hera');r[0xf374]=7;r[0xf357]=1;
  assert.equal(nextObjective(r).id,'sword');r[0xf359]=2;assert.equal(nextObjective(r).id,'agahnim');r[0xf3c5]=3;
  assert.equal(nextObjective(r).id,'darkness');r[0xf37a]=0x7f;assert.equal(nextObjective(r).id,'tower');r[0xf2db]=0x20;assert.equal(nextObjective(r).id,'ganon');
  r[0xf37a]=0x76;assert.equal(nextObjective(r).id,'shovel');r[0xf34c]=1;assert.equal(nextObjective(r).id,'flute');r[0xf34c]=2;assert.equal(nextObjective(r).id,'bird');r[0xf34c]=3;assert.equal(nextObjective(r).id,'ether');
});
test('compass uses real entrance coordinates, world changes and current save data',()=>{
  assert.deepEqual(entrancePoint(rom,8),{x:3928,y:1576,dark:false});
  const r=new Uint8Array(0x20000);r[0xf3c5]=2;setWord(r,0x22,3920);setWord(r,0x20,2000);
  assert.equal(readGuidance(r,rom).angle,-Math.PI/2);
  r[0x8a]=0x40;assert.equal(readGuidance(r,rom).angle,null);assert.match(readGuidance(r,rom).label,/Mirror/);
  r[0x1b]=1;setWord(r,0xa0,0xc9);setWord(r,0x40c,4);assert.equal(readGuidance(r,rom).angle,null);assert.match(readGuidance(r,rom).label,/dungeon map/);
  setWord(r,0xa0,0x104);assert.ok(Number.isFinite(readGuidance(r,rom).angle));
});
