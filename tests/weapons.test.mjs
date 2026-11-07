import test from 'node:test';
import assert from 'node:assert/strict';
import {Fairy,ARROW_COOLDOWN} from '../dist/fairy.js';
import {Unicorn} from '../dist/unicorn.js';
import {BombLauncher,BOMB_COOLDOWN} from '../dist/bombs.js';
const world=()=>({active:true,scene:'one',cameraX:0,cameraY:0,link:{x:90,y:116},enemies:[],wallAt:()=>false});
test('JJ launches five distinct straight arrows, with a separate enforced cooldown',()=>{
  const f=new Fairy(),w=world();f.update(0,w);f.follow=false;f.aimX=1;f.aimY=0;
  assert.equal(f.fireArrows(()=>{}),'fired');assert.equal(f.shots.length,5);
  const angles=f.shots.map(s=>Math.atan2(s.vy,s.vx));assert.equal(new Set(angles).size,5);
  assert.ok(Math.abs(angles[0]+Math.PI/4)<.001&&Math.abs(angles[4]-Math.PI/4)<.001);
  assert.equal(f.fireArrows(()=>{}),'wait');assert.equal(f.arrowCooldown,ARROW_COOLDOWN);
  assert.equal(f.fire(()=>{}),'fired','Existing spark has its own cooldown');
  f.update(.05,{...w,enemies:[{x:140,y:170,vulnerable:true}]});
  assert.deepEqual(f.shots.filter(s=>s.kind==='arrow').map(s=>Math.atan2(s.vy,s.vx)),angles,'Fan does not collapse into homing arrows');
});
test('arrows hit multiple enemies, respect walls, and clear when the room changes',()=>{
  const w=world(),f=new Fairy();f.update(0,w);f.follow=false;f.aimX=1;f.aimY=0;
  w.enemies=[{slot:1,x:f.x+35,y:f.y,radius:5,vulnerable:true},{slot:2,x:f.x+25,y:f.y+25,radius:5,vulnerable:true}];
  const hits=[];f.fireArrows(t=>hits.push(t.slot),{x:1,y:0});f.update(.2,w);
  assert.ok(hits.includes(1)&&hits.includes(2));f.update(0,{...w,scene:'two'});assert.equal(f.shots.length,0);
  f.arrowCooldown=0;f.fireArrows(()=>assert.fail('Wall must block arrows'),{x:1,y:0});
  const barrier=f.x+3;f.update(.2,{...w,scene:'two',wallAt:x=>x>=barrier});assert.equal(f.shots.length,0);
});
test('Michelle bombs fly, explode once, damage nearby enemies and enforce cooldown',()=>{
  const w=world(),launcher=new BombLauncher(),owner={enabled:true,active:true,x:50,y:100,aimX:1,aimY:0};
  launcher.update(0,w);let sounds=0;const hits=[];
  assert.equal(launcher.fire(owner,t=>hits.push(t.slot),()=>sounds++),'fired');
  assert.equal(launcher.fire(owner,()=>{},()=>{}),'wait');assert.equal(launcher.cooldown,BOMB_COOLDOWN);
  launcher.update(.1,w);assert.ok(launcher.projectiles[0].x>50);
  w.enemies=[{slot:1,x:90,y:100,vulnerable:true},{slot:2,x:100,y:120,vulnerable:true},{slot:3,x:200,y:180,vulnerable:true},{slot:4,x:90,y:100,vulnerable:false}];
  launcher.update(.2,w);assert.deepEqual(hits,[1,2]);assert.equal(sounds,1);assert.equal(launcher.projectiles.length,0);assert.equal(launcher.blasts.length,1);
  launcher.update(.5,w);assert.equal(sounds,1);assert.equal(launcher.blasts.length,0);
});
test('bombs stop at walls, scroll with the room and discard fuses on transitions/disconnect',()=>{
  const w=world(),owner={enabled:true,active:true,x:50,y:100,aimX:1,aimY:0},l=new BombLauncher();l.update(0,w);
  l.fire(owner,()=>{},()=>{});l.update(.2,{...w,wallAt:x=>x>=60});assert.ok(l.projectiles[0].x<60);assert.equal(l.projectiles[0].stopped,true);
  const x=l.projectiles[0].x;l.update(0,{...w,cameraX:5});assert.equal(l.projectiles[0].x,x-5);
  l.update(0,{...w,scene:'two'});assert.equal(l.projectiles.length,0);
  l.cooldown=0;l.fire(owner,()=>{},()=>assert.fail('Disconnected bomb must not explode'));l.update(.9,null);assert.equal(l.projectiles.length,0);
  assert.equal(l.fire(owner,()=>{},()=>{}),'wait');
});
test('unicorn integration clears bombs while disabled and cannot fire while inactive',()=>{
  const u=new Unicorn(),w=world();assert.equal(u.fireBomb(()=>{},()=>{}),'wait');
  u.enabled=true;u.update(0,w);assert.equal(u.fireBomb(()=>{},()=>{}),'fired');
  u.enabled=false;u.update(.1,w);assert.equal(u.bombs.projectiles.length,0);assert.equal(u.fireBomb(()=>{},()=>{}),'wait');
});
