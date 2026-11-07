import test from 'node:test';
import assert from 'node:assert/strict';
import {ADDR as A,readWorld,applyHit,applyLaserHit,playFireSound} from '../dist/zelda.js';
import {ENEMIES} from '../dist/enemies.js';
import {LaserReward,beamEnd} from '../dist/lasers.js';
import {Fairy} from '../dist/fairy.js';

function enemy(type){
  const r=new Uint8Array(0x20000);r[A.module]=9;r[A.state]=9;r[A.type]=type;r[A.hp]=48;r[A.xLo]=142;r[A.yLo]=92;
  if(type===0x7a)r[A.ai]=3;
  if(type===0xcb)r[A.trinexxFinal]=1;
  return r;
}
test('all classified enemies, including every boss and armor type, accept companion shots and beams',()=>{
  for(const type of ENEMIES){
    for(const laser of [false,true]){
      const r=enemy(type);r[A.flags3]=0x40;
      const target=readWorld(r).enemies[0];assert.ok(target,`Target type ${type.toString(16)}`);
      assert.equal(laser?applyLaserHit(r,target,{x:40,y:100},{x:240,y:100},10,()=>false):applyHit(r,target,{x:130,y:100}),true,`Hit type ${type.toString(16)}`);
      assert.equal(r[A.hp],48,'Original game owns damage and defeat');
    }
  }
  const r=enemy(0xd6);r[A.hp]=255;assert.equal(readWorld(r).enemies.length,1,'255 HP is valid for Ganon and armored enemies');
  r[A.state]=11;assert.equal(readWorld(r).enemies.length,1,'Stunned enemies remain hittable');
  for(const type of [0x10,0x79,0x86,0xc4,0xd4]){const zero=enemy(type);zero[A.hp]=0;assert.ok(applyHit(zero,readWorld(zero).enemies[0],{x:130,y:100}),'Live zero-HP enemy can be hit');}
});
test('boss transitions, duplicates and effects are not mistaken for living bosses',()=>{
  for(const [type,address,value] of [[0xce,A.a,2],[0xce,A.a,128],[0xcc,A.e,1],[0xcd,A.e,1],[0xc9,A.anim,1],[0xc9,A.anim,2],[0x55,A.e,20],[0x92,A.c,128],[0x09,A.ai,3],[0x54,A.ai,5],[0xa3,A.ai,1],[0xa2,A.ai,2],[0xcb,A.ai,128],[0xd6,A.ai,128],[0x7a,A.ai,8]]){
    const r=enemy(type);r[address]=value;assert.equal(readWorld(r).enemies.length,0,`No hit for transition/effect ${type.toString(16)}`);
  }
  const r=enemy(0xcb);r[A.trinexxFinal]=0;assert.equal(readWorld(r).enemies.length,0,'Trinexx side heads must finish before the body');
});
test('boss reaction hits cannot strand damage behind timers cleared by native AI',()=>{
  for(const [type,ai] of [[0xce,0],[0xcc,2],[0xcd,2],[0x85,2],[0xd6,17]]){
    const r=enemy(type);r[A.ai]=ai;assert.equal(applyHit(r,readWorld(r).enemies[0],{x:130,y:100}),true);assert.equal(r[A.damage],0);assert.equal(r[A.hit],32);
  }
  for(const [type,ai] of [[0xcc,4],[0xcd,4],[0x85,5],[0xd6,18],[0xd7,19]]){
    const r=enemy(type);r[A.ai]=ai;applyHit(r,readWorld(r).enemies[0],{x:130,y:100});assert.equal(r[A.damage],1);
  }
});
test('both laser sizes damage a boss across solid scenery, including when the source overlaps a wall',()=>{
  for(const giant of [false,true]){
    const r=enemy(0x53),source={active:true,x:40,y:100,aimX:1,aimY:0};
    const w={...readWorld(r),wallAt:()=>true},laser=new LaserReward();laser.start({roles:['jj'],giant});
    laser.update(.01,w,{jj:source},(target,origin,end,radius)=>applyLaserHit(r,target,origin,end,radius));
    assert.ok(laser.beams[0].end.x>250);assert.equal(r[A.damage],1);
    r[A.hit]=r[A.damage]=0;assert.equal(applyLaserHit(r,readWorld(r).enemies[0],source,source,10),false);
  }
});
test('a freely aimed shot hits an enemy that enters its path, even after the fairy moves away',()=>{
  const f=new Fairy(),w={active:true,scene:'a',cameraX:0,cameraY:0,link:{x:40,y:116},enemies:[],wallAt:()=>false};
  f.update(0,w);f.follow=false;f.aimX=1;f.aimY=0;let hits=0;
  f.fire((target,impact)=>{hits++;assert.ok(Math.hypot(target.x-impact.x,target.y-impact.y)<=14);});
  f.x=f.tx=230;w.enemies=[{slot:0,type:0x53,x:90,y:100,radius:14,vulnerable:true}];
  f.update(.2,w);assert.equal(hits,1);
});
test('laser firing queues audible fire-rod pulses, stopping during questions and at expiry',()=>{
  const r=enemy(0x53);assert.equal(playFireSound(r),true);assert.equal(r[A.sound],0x0e);
  r[A.sound]=0;assert.equal(playFireSound(r,true),true);assert.equal(r[A.sound],0x0c,'Bombs queue the native explosion sound');
  r[A.sound]=0x22;assert.equal(playFireSound(r),false);assert.equal(r[A.sound],0x22,'Do not overwrite another queued game sound');
  r[A.sound]=0;r[A.module]=14;assert.equal(playFireSound(r),false);
  const l=new LaserReward(),w={active:true,enemies:[],wallAt:()=>false},c={jj:{active:true,x:50,y:100,aimX:1,aimY:0}};let sounds=0;
  l.start({roles:['jj'],giant:true});l.update(.01,w,c,()=>{},false,()=>sounds++);l.update(.01,w,c,()=>{},false,()=>sounds++);assert.equal(sounds,1);
  l.update(10,w,c,()=>{},true,()=>sounds++);assert.equal(sounds,1);
  l.update(.2,w,c,()=>{},false,()=>sounds++);assert.equal(sounds,2);
  l.update(60,w,c,()=>{},false,()=>sounds++);const end=sounds;l.update(1,w,c,()=>{},false,()=>sounds++);assert.equal(sounds,end);
});
