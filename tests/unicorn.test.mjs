import test from 'node:test';
import assert from 'node:assert/strict';
import {Unicorn,HEAL_COOLDOWN} from '../dist/unicorn.js';
import {ADDR as A,applyHeal,readWorld} from '../dist/zelda.js';
import {Connection} from '../dist/network.js';
import {EventEmitter} from 'node:events';
const world=()=>({active:true,scene:'room',cameraX:0,cameraY:0,link:{x:120,y:100},enemies:[],wallAt:()=>false});
function setup(){const u=new Unicorn(),w=world();u.enabled=true;u.update(0,w);return {u,w};}
test('unicorn joystick stops after lost input, slides along walls, and normalizes diagonals',()=>{
  const {u,w}=setup();u.setInput(1,1);const x=u.x,y=u.y;u.update(.1,w);
  assert.ok(Math.abs(Math.hypot(u.x-x,u.y-y)-10.5)<.01);
  u.stop();const stopped=u.x;u.update(.1,w);assert.equal(u.x,stopped);
  u.setInput(1,0);u.update(.4,w);assert.equal(u.x,stopped,'lost heartbeat stops movement');
  w.wallAt=(x)=>x>u.x+6;u.setInput(1,1);const before={x:u.x,y:u.y};u.update(.1,w);
  assert.ok(u.y>before.y);assert.ok(u.x-before.x<3);
  u.setInput(NaN,Infinity);assert.ok(Number.isFinite(u.inputX));
});
test('enemy contacts repeatedly bounce an immortal unicorn with a recovery window',()=>{
  const {u,w}=setup();u.follow=false;
  w.enemies=[{x:u.x+6,y:u.y,slot:1,type:0x41,vulnerable:false}];
  const x=u.x;u.update(.05,w);assert.equal(u.bounces,1);assert.ok(u.x<x);
  u.update(.05,w);assert.equal(u.bounces,1,'recovery prevents pinball jitter every frame');
  for(let i=0;i<20;i++){u.invulnerable=0;w.enemies[0].x=u.x+4;w.enemies[0].y=u.y;u.update(.05,w);}
  assert.equal(u.bounces,21);assert.equal(u.active,true);
});
test('unicorn attacks home within range, free-fire otherwise, and heal only on heart arrival',()=>{
  const {u,w}=setup();u.follow=false;
  w.enemies=[{x:u.x+35,y:u.y,slot:1,type:0x41,vulnerable:true}];
  let hits=0;assert.equal(u.fire(()=>hits++),'fired');u.update(.15,w);assert.equal(hits,1);
  u.cooldown=0;w.enemies=[];assert.equal(u.fire(),'fired');assert.equal(u.shots[0].target,null);
  let healed=0;u.x=30;assert.equal(u.heal(()=>healed++),'sent');assert.equal(u.heal(()=>healed++),'wait');assert.equal(healed,0);
  u.update(.1,w);assert.equal(healed,0);for(let i=0;i<8;i++)u.update(.1,w);assert.equal(healed,1);
  assert.ok(u.healCooldown>0&&u.healCooldown<HEAL_COOLDOWN);
});
test('room changes, dialogue and disconnect discard hearts and stop old input',()=>{
  for(const change of ['scene','dialogue','disconnect']){
    const {u,w}=setup();let healed=0;u.x=20;u.heal(()=>healed++);u.setInput(1,0);
    if(change==='scene')w.scene='next';if(change==='dialogue')w.active=false;if(change==='disconnect')u.enabled=false;
    u.update(.016,w);assert.equal(u.hearts.length,0);assert.equal(healed,0);assert.equal(u.inputX,0);
  }
});
test('healing queues one native heart and never revives, overheals, or writes during menus',()=>{
  const r=new Uint8Array(0x20000);r[A.module]=9;r[A.health]=8;r[A.capacity]=24;
  assert.equal(applyHeal(r),true);assert.equal(r[A.heartFill],8);assert.equal(r[A.health],8);
  assert.equal(applyHeal(r),true);assert.equal(r[A.heartFill],16);assert.equal(applyHeal(r),false);
  r[A.heartFill]=0;r[A.health]=0;assert.equal(applyHeal(r),false);
  r[A.health]=24;assert.equal(applyHeal(r),false);
  r[A.health]=8;r[A.module]=14;assert.equal(applyHeal(r),false);assert.equal(r[A.heartFill],0);
});
test('boss contact can bounce the unicorn without enabling boss damage or NPC contact',()=>{
  const r=new Uint8Array(0x20000);r[A.module]=9;r[A.state]=9;r[A.hp]=5;r[A.xLo]=80;r[A.yLo]=80;r[A.type]=0x53;
  assert.equal(readWorld(r).contacts.length,1);assert.equal(readWorld(r).enemies.length,0);
  r[A.type]=0x73;assert.equal(readWorld(r).contacts.length,0);
});
class Channel extends EventEmitter{
  constructor(role,peer){super();this.metadata={version:1,role};this.peer=peer;this.open=false;this.sent=[];}
  send(m){this.sent.push(m);}close(){this.open=false;this.emit('close');}connect(){this.open=true;this.emit('open');}
}
test('three-player host isolates roles, targeted messages, reconnects and disconnects',()=>{
  const events=[],host=new Connection({role:'dad',onStatus:()=>{},onData:(data,role)=>events.push({data,role}),onDisconnected:role=>events.push(role)});
  const jj=new Channel('jj','tablet'),michelle=new Channel('michelle','phone');
  host.bindHost(jj);host.bindHost(michelle);jj.connect();michelle.connect();
  host.send({type:'state'});assert.equal(jj.sent.length,1);assert.equal(michelle.sent.length,1);
  host.send({type:'unlock-tablet'},'jj');assert.equal(michelle.sent.length,1);
  michelle.emit('data',{type:'move',role:'jj'});assert.equal(events.at(-1).role,'michelle','message cannot spoof transport role');
  michelle.close();assert.equal(host.has('jj'),true);assert.equal(host.has('michelle'),false);
  const again=new Channel('michelle','phone2');host.bindHost(again);again.connect();jj.close();assert.equal(host.has('michelle'),true);
  host.close();
});
test('a duplicate player cannot replace an active role',()=>{
  const host=new Connection({role:'dad',onStatus:()=>{}}),first=new Channel('michelle','first'),second=new Channel('michelle','second');
  host.bindHost(first);first.connect();host.bindHost(second);second.connect();
  assert.equal(host.guests.get('michelle').connection,first);assert.equal(second.sent[0].type,'role-busy');host.close();
});
