import test from 'node:test';
import assert from 'node:assert/strict';
import {PowerRewards} from '../dist/powers.js';
import {LaserReward} from '../dist/lasers.js';
import {LearningRound} from '../dist/learning.js';
import {Unicorn} from '../dist/unicorn.js';
import {ADDR as A,readWorld,applyPowerHit} from '../dist/zelda.js';
import {ENEMIES} from '../dist/enemies.js';
const world=()=>({active:true,scene:'one',cameraX:0,cameraY:0,link:{x:70,y:100},enemies:[{slot:1,type:0x41,x:140,y:100,radius:7,vulnerable:true}],wallAt:()=>true});
const characters=()=>({jj:{active:true,x:80,y:100,aimX:1,aimY:0},michelle:{active:true,enabled:true,x:90,y:100,aimX:1,aimY:0}});
const powers=()=>new PowerRewards(new LaserReward());
test('question rewards shuffle all four powers without immediate repeats and announce the selected bonus',()=>{
 const q=new LearningRound(()=>.7),seen=[];
 for(let i=0;i<12;i++){
  q.start({playing:true,tablet:true});const type=q.round.rewardType;seen.push(type);
  q.advance(q.token());
  for(let n=0;n<2;n++){const r=q.round,item=r.questions[r.index];q.answer(q.token(),item.choices.indexOf(item.answer));if(!n)q.advance(q.token());}
  assert.equal(q.snapshot().giant,true);assert.ok(!q.snapshot().feedback.includes('undefined'));
  const result=q.advance(q.token());assert.equal(result.type,type);assert.deepEqual(result.roles,['jj','michelle']);
 }
 for(let i=0;i<12;i+=4)assert.equal(new Set(seen.slice(i,i+4)).size,4);
 for(let i=1;i<seen.length;i++)assert.notEqual(seen[i],seen[i-1]);
});
test('missiles automatically lock on through walls for five active seconds and pause with the game',()=>{
 const p=powers(),w=world(),c=characters(),hits=[];let sounds=0;
 p.start({type:'missiles',roles:['jj'],giant:false});
 for(let i=0;i<10;i++)p.update(.05,w,c,(...args)=>hits.push(args),false,()=>sounds++);
 assert.ok(hits.length>0&&sounds>0);assert.ok(hits.every(h=>h[2]==='missiles'));
 const left=p.timers.jj.remaining;p.update(30,w,c,()=>assert.fail(),true);assert.equal(p.timers.jj.remaining,left);
 p.update(30,{...w,active:false},c,()=>assert.fail());assert.equal(p.timers.jj.remaining,left);
 for(let i=0;i<100;i++)p.update(.05,w,c,()=>{});
 assert.equal(p.snapshot(),null);assert.equal(p.missiles.length,0);
});
test('meteor lands once at the original location, follows camera scrolling, damages nearby bodies, and cancels across rooms',()=>{
 const p=powers(),w=world(),c=characters(),hits=[];let sounds=0;
 p.start({type:'meteor',roles:['jj'],giant:false});p.update(.1,w,c,()=>{});
 c.jj.x=230;p.update(.1,{...w,cameraX:10},c,()=>{});assert.equal(p.meteors[0].x,70);
 const shifted={...w,cameraX:10,enemies:[{...w.enemies[0],x:100},{slot:2,x:220,y:100,vulnerable:true},{slot:3,x:80,y:100,vulnerable:false}]};
 p.update(.6,shifted,c,t=>hits.push(t.slot),false,()=>sounds++);p.update(.2,shifted,c,()=>assert.fail('One strike only'));
 assert.deepEqual(hits,[1]);assert.equal(sounds,1);
 p.start({type:'meteor',roles:['jj'],giant:true});p.update(.1,w,c,()=>{});p.update(.8,{...w,scene:'two'},c,()=>assert.fail());assert.equal(p.meteors.length,0);
});
test('dinosaur walks through walls, ignores knockback, crushes enemies, and restores clear-floor placement on expiry',()=>{
 const u=new Unicorn(),w={...world(),wallAt:x=>x>=100};u.enabled=true;u.update(0,w);u.follow=false;u.x=90;u.y=100;
 const p=powers(),c={michelle:u};p.start({type:'dinosaur',roles:['michelle'],giant:true});p.syncCharacters(c);
 for(let i=0;i<12;i++){u.setInput(1,0);u.update(.05,w);}
 assert.ok(u.x>140);assert.equal(u.knockX,0);assert.equal(u.bounces,0);
 let hits=0;p.update(.1,w,c,()=>hits++);assert.ok(hits>0);
 p.update(20,w,c,()=>{});assert.equal(u.dinosaur,false);assert.equal(u.needsPlacement,true);
 u.stop();u.update(0,w);assert.equal(u.active,true);assert.equal(u.clearAt(u.x,u.y,w),true);assert.ok(u.x<100);
});
test('new powers replace only the winning child, skipped or wrong answers preserve other earned time',()=>{
 const p=powers();p.start({type:'laser',roles:['jj','michelle'],giant:true});
 p.start({type:'dinosaur',roles:['jj'],giant:false});assert.equal(p.lasers.steering('jj'),false);assert.equal(p.lasers.steering('michelle'),true);
 p.start({type:'meteor',roles:[],giant:false});assert.equal(p.snapshot().jj.type,'dinosaur');assert.equal(p.snapshot().michelle.type,'laser');
 p.start({type:'laser',roles:['jj'],giant:false});assert.equal(p.timers.jj,undefined);assert.equal(p.snapshot().jj.type,'laser');
});
test('superpower damage uses native enemy handling, boosts damage, preserves boss reactions, and rejects NPCs or out-of-range hits',()=>{
 for(const type of ENEMIES){
  const r=new Uint8Array(0x20000);r[A.module]=9;r[A.state]=9;r[A.type]=type;r[A.hp]=48;r[A.xLo]=132;r[A.yLo]=92;
  if(type===0x7a)r[A.ai]=3;if(type===0xcb)r[A.trinexxFinal]=1;
  const target=readWorld(r).enemies[0];assert.ok(target);
  assert.equal(applyPowerHit(r,target,{x:140,y:100},'meteor',true),true,`Native power hit ${type.toString(16)}`);assert.equal(r[A.hp],48);
 }
 const r=new Uint8Array(0x20000);r[A.module]=9;r[A.state]=9;r[A.type]=0x41;r[A.hp]=48;r[A.xLo]=132;r[A.yLo]=92;const t=readWorld(r).enemies[0];
 assert.equal(applyPowerHit(r,t,{x:20,y:100},'dinosaur'),false);assert.equal(applyPowerHit(r,t,{x:140,y:100},'oops'),false);
 assert.equal(applyPowerHit(r,t,{x:140,y:100},'meteor'),true);assert.equal(r[A.damage],32);
 r[A.hit]=r[A.damage]=0;r[A.type]=0xce;assert.equal(applyPowerHit(r,{...t,type:0xce},{x:140,y:100},'dinosaur'),true);assert.equal(r[A.damage],0,'Blind uses native recoil hits');
 r[A.hit]=r[A.damage]=0;r[A.type]=0x73;assert.equal(applyPowerHit(r,{...t,type:0x73},{x:140,y:100},'meteor'),false);
});
