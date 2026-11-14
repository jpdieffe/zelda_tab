import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {NES} from '../dist/mario/vendor/jsnes/index.js';
import {CoopEngine,player} from '../dist/mario/engine.js';
import {M} from '../dist/mario/memory.js';
import {Companions} from '../dist/mario/companions.js';
import {tileAt} from '../dist/mario/weapons.js';
import {LearningRound,QuestionDeck,mathFacts} from '../dist/mario/learning.js';
const rom=readFileSync(new URL('../dist/mario/roms/mario3.nes',import.meta.url));
let level;
function boot(){const e=new CoopEngine(rom,{NES});if(level)e.nes[0].fromJSON(structuredClone(level));else{
  e.nes[0].fromJSON(JSON.parse(readFileSync(new URL('../dist/mario/start.json',import.meta.url))));
  const run=n=>{for(let i=0;i<n;i++)e.step();},press=(mask,n)=>{e.input(0,mask);run(n);e.input(0,0);run(20);};
  press(128,20);press(16,20);press(1,2);run(180);level=structuredClone(e.nes[0].toJSON());
}e.resetWorld();const kids=new Companions(e);kids.step(0);return {e,kids};}
test('bundled original ROM hash matches the supplied Mario 3 revision',()=>{assert.equal(createHash('sha256').update(rom).digest('hex'),'4377a7f5e6eb50bdd2ac6f249bf1a7085500aca8eb41f38545c3a2731c51a579');});
test('Mario enters the real first level; companions never create a second playable Mario',()=>{const {e,kids}=boot();assert.equal(e.nes[0].cpu.mem[M.Level_Tileset],1);assert.equal(kids.playable(),true);assert.equal(e.joined,false);assert.equal(kids.kids.jj.segments.length,8);});
test('level clock stays frozen at one second while Mario and the world keep moving',()=>{
  const {e}=boot(),m=e.nes[0].cpu.mem;m[M.Level_TimerMSD]=0;m[M.Level_TimerMid]=0;m[M.Level_TimerLSD]=1;m[M.Level_TimerTick]=0;m[M.Level_TimerEn]=0;
  const start=player(e.nes[0]);e.input(0,1);for(let i=0;i<10;i++)e.step();assert.ok(player(e.nes[0]).y<start.y,'ordinary jump physics still run');e.input(0,0);
  for(let i=0;i<180;i++){m[M.Player_FlashInv]=255;e.step();}
  assert.equal(m[M.Level_TimerLSD],1);assert.equal(m[M.Level_TimerTick],0);assert.equal(m[M.Player_IsDying],0);assert.equal(m[M.Level_TimerEn]&1,1);assert.equal(m[M.Level_TimerEn]&0x80,0,'normal scenery animation remains enabled');
});
test('zero-time saves resume without time-up death; native animation flags and other deaths are preserved',()=>{
  const {e}=boot();let m=e.nes[0].cpu.mem;for(const address of [M.Level_TimerMSD,M.Level_TimerMid,M.Level_TimerLSD,M.Level_TimerTick,M.Level_TimerEn])m[address]=0;
  const saved=structuredClone(e.snapshot());e.restore(saved);m=e.nes[0].cpu.mem;
  for(let i=0;i<60;i++)e.step();assert.equal(m[M.Player_IsDying],0);assert.deepEqual([m[M.Level_TimerMSD],m[M.Level_TimerMid],m[M.Level_TimerLSD]],[0,0,0],'do not refill timer digits and interfere with level-end scoring');
  m[M.Level_TimerEn]=0x80;e.step();assert.equal(m[M.Level_TimerEn],0x81);
  m[M.Player_IsDying]=1;e.step();assert.notEqual(m[M.Player_IsDying],0,'ordinary Mario death must not be cancelled');
});
test('dragon flies independently and its segments stay linked while turning',()=>{const {e,kids}=boot(),k=kids.kids.jj,p=player(e.nes[0]);k.hurt=0;const before={x:k.x,y:k.y};kids.input('jj',{mask:144},0);for(let i=0;i<20;i++)kids.step(i*10);assert.ok(k.x>before.x+25);assert.ok(k.y<before.y-25);let head=k;for(const s of k.segments){assert.ok(Math.hypot(head.x-s.x,head.y-s.y)<5.01);head=s;}assert.deepEqual(player(e.nes[0]),p);});
test('unicorn jump taps flap repeatedly; holding jump does not auto-fly; descent is gentle',()=>{const {kids,e}=boot(),k=kids.kids.michelle,p=player(e.nes[0]);k.x=p.cameraX+80;k.y=p.cameraY+90;
  kids.input('michelle',{mask:1},0);kids.step(0);const y=k.y;assert.ok(k.vy<0);for(let i=1;i<8;i++)kids.step(i*10);assert.ok(k.y<y);const v=k.vy;kids.input('michelle',{mask:1},85);kids.step(85);assert.ok(k.vy>v,'holding must not retrigger flap');kids.input('michelle',{mask:0},90);kids.input('michelle',{mask:1},91);kids.step(92);assert.ok(k.vy<-3.4);k.y=p.cameraY+60;k.vy=0;kids.release('michelle');for(let i=0;i<50;i++)kids.step(100+i*10);assert.ok(k.vy<=.65);assert.ok(k.y<p.cameraY+93);});
test('children recover from pits without writing Mario health, lives, position or death state',()=>{const {kids,e}=boot(),m=e.nes[0].cpu.mem;const before=Array.from(m);for(const k of Object.values(kids.kids)){k.y=player(e.nes[0]).cameraY+300;}kids.step(0);assert.equal(kids.stats.returns,2);assert.deepEqual(Array.from(m),before);m[M.Player_IsDying]=1;kids.step(20);assert.equal(m[M.Player_IsDying],1,'Dad death must never be cleared by companions');assert.equal(e.joined,false);});
test('release, stale input and pause stop movement and freeze reward timers',()=>{const {kids,e}=boot(),k=kids.kids.jj;kids.input('jj',{mask:128},0);kids.step(10);const x=k.x;kids.step(351);assert.equal(k.x,x);kids.input('jj',{mask:128},400);kids.release('jj');kids.step(410);assert.equal(k.x,x);kids.grant({roles:['jj'],type:'laser',giant:true});const left=k.power.left;e.paused=true;kids.step(500);assert.equal(k.power.left,left);assert.equal(k.x,x);assert.equal(kids.input('jj',{mask:NaN},0),false);assert.equal(kids.input('dad',{mask:1},0),false);});
test('real enemy receives a dragon fireball hit; child and Mario remain unharmed',()=>{const {kids,e}=boot();let targets=e.weapons.targets();assert.ok(targets.length);const t=targets[0],x=(t.left+t.right)/2,y=(t.top+t.bottom)/2;const k=kids.kids.jj;k.x=x-22;k.y=y;k.face=1;k.hurt=60;k.active=true;const p=player(e.nes[0]);kids.attack(k);for(let i=0;i<12;i++)kids.step(i);assert.ok(kids.stats.hits>=1);assert.equal(e.nes[0].cpu.mem[0x661+t.slot],0);assert.deepEqual(player(e.nes[0]),p);});
test('JJ and Michelle shoot through solid bricks, defeat the enemy once, and produce a harmless explosion with sound',()=>{
  for(const role of ['jj','michelle']){
    const {kids,e}=boot(),m=e.nes[0].cpu.mem,t=e.weapons.targets()[0],x=(t.left+t.right)/2,y=(t.top+t.bottom)/2,k=kids.kids[role];
    k.x=t.left-70;k.y=y;k.active=true;k.hurt=60;
    const wall=tileAt(e.nes[0],t.left-35,y);m[0x6000+wall.index]=0x67;assert.ok(kids.solid(t.left-35,y));
    const mario=player(e.nes[0]),terrain=Array.from(m.slice(0x6000,0x7950));m[M.Sound_QLevel1]=0;
    kids.attack(k);kids.attack(k);
    for(let i=0;i<30&&!kids.explosions.length;i++)kids.step(i);
    assert.equal(m[0x661+t.slot],0,role+' shot defeats the enemy beyond the brick');assert.equal(kids.stats.hits,1);assert.equal(kids.explosions.length,1);
    assert.equal(kids.explosions[0].x,x);assert.equal(kids.explosions[0].y,y);assert.ok(m[M.Sound_QLevel1]&8,'native explosion sound queued');
    assert.deepEqual(Array.from(m.slice(0x6000,0x7950)),terrain,'explosions do not destroy terrain');assert.deepEqual(player(e.nes[0]),mario,'explosions do not hurt Mario');
    m[M.Sound_QLevel1]=0;assert.equal(kids.hit(t),false);assert.equal(m[M.Sound_QLevel1],0,'a defeated enemy cannot explode or play sound twice');
    e.paused=true;const life=kids.explosions[0].life;kids.step(100);assert.equal(kids.explosions[0].life,life);e.paused=false;
    for(let i=0;i<32;i++)kids.step(110+i);assert.equal(kids.explosions.length,0,'explosion finishes');
  }
});
test('defeat explosion produces native audio samples and clears on room changes or reset',()=>{
  const {kids,e}=boot();kids.hit(e.weapons.targets()[0]);assert.equal(kids.explosions.length,1);
  const silent=new CoopEngine(rom,{NES});silent.nes[0].fromJSON(structuredClone(e.nes[0].toJSON()));silent.nes[0].cpu.mem[M.Sound_QLevel1]&=~8;
  const heard=[],baseline=[];e.nes[0].opts.onAudioSample=(l,r)=>heard.push(l+r);silent.nes[0].opts.onAudioSample=(l,r)=>baseline.push(l+r);
  for(let i=0;i<24;i++){e.step();silent.step();}
  assert.ok(heard.length>1000);assert.ok(heard.some((sample,i)=>Math.abs(sample-baseline[i])>.001),'native boom changes the game audio output');
  e.nes[0].cpu.mem[M.Level_LayPtrOrig_AddrL]^=1;kids.step(0);assert.equal(kids.explosions.length,0);
  const target=e.weapons.targets()[0];if(target)kids.hit(target);kids.reset();assert.equal(kids.explosions.length,0);
});
test('scene transitions clear shots and regroup both children',()=>{const {kids,e}=boot();kids.attack(kids.kids.jj);assert.equal(kids.shots.length,1);e.nes[0].cpu.mem[M.Level_LayPtrOrig_AddrL]^=1;kids.step(0);assert.equal(kids.shots.length,0);assert.equal(kids.kids.jj.mask,0);assert.ok(Math.abs(kids.kids.jj.x-player(e.nes[0]).x)<50);});
test('all four learning rewards apply and expire on simulation time',()=>{const {kids}=boot();for(const type of ['laser','missiles','dinosaur','meteor']){kids.grant({roles:['jj','michelle'],type,giant:true});assert.equal(kids.kids.jj.power.type,type);assert.equal(kids.kids.michelle.power.giant,true);kids.kids.jj.power.left=1;kids.step(0);assert.equal(kids.kids.jj.power,null);}});
test('save/load restores original Mario progress and companion effects reset separately',()=>{const {e,kids}=boot();const saved=structuredClone(e.snapshot()),p=player(e.nes[0]);e.nes[0].cpu.mem[M.Player_X]+=30;e.restore(saved);e.resetWorld();kids.reset();assert.deepEqual(player(e.nes[0]),p);assert.equal(e.joined,false);assert.equal(kids.shots.length,0);});
test('curriculum has nonrepeating letters, alternating math/words, ordered 0–10 math answers',()=>{const deck=new QuestionDeck(),letters=new Set();for(let i=0;i<26;i++){letters.add(deck.next('jj').answer);const q=deck.next('michelle');assert.equal(q.kind,i%2?'word':'math');assert.equal(q.choices.length,i%2?3:11);}assert.equal(letters.size,26);assert.equal(mathFacts().length,132);assert.ok(mathFacts().every(f=>Number(f.answer)>=0&&Number(f.answer)<=10));});
test('both children aim across the whole screen, ignoring closer enemies outside every edge and the HUD',()=>{
  const {kids,e}=boot(),p=player(e.nes[0]);
  const target=(x,y)=>({left:p.cameraX+x-5,right:p.cameraX+x+5,top:p.cameraY+y-5,bottom:p.cameraY+y+5});
  for(const role of ['jj','michelle']){const k=kids.kids[role];k.x=p.cameraX+5;k.y=p.cameraY+100;k.face=-1;
    e.weapons.targets=()=>[target(-8,100),target(240,100)];kids.attack(k);assert.equal(kids.shots.at(-1).dx,1);assert.equal(kids.shots.at(-1).dy,0,'visible enemy beyond old 150px limit wins');
    for(const [x,y] of [[262,100],[5,-8],[5,215]]){k.x=p.cameraX+(x>256?250:5);k.y=p.cameraY+(y<0?5:y>208?200:100);e.weapons.targets=()=>[target(x,y),target(150,100)];const aim=kids.nearestEnemy(k);assert.deepEqual(aim,{x:p.cameraX+150,y:p.cameraY+100});}
    k.x=p.cameraX+100;k.y=p.cameraY+100;e.weapons.targets=()=>[target(130,100),target(80,100)];kids.attack(k);assert.equal(kids.shots.at(-1).dx,-1,'nearest visible target wins');
    e.weapons.targets=()=>[target(262,100)];k.face=1;k.mask=0;kids.attack(k);assert.equal(kids.shots.at(-1).dx,1,'no visible enemies retains free firing');
  }
});
test('Michelle heart travels to moving Dad then triggers native mushroom growth, sound and five-second cooldown',()=>{
  const {kids,e}=boot(),m=e.nes[0].cpu.mem,p=player(e.nes[0]);kids.kids.michelle.x=p.x+150;kids.kids.michelle.y=p.y-30;
  assert.equal(kids.sendHeart('jj'),false);assert.equal(kids.sendHeart('michelle'),true);assert.equal(kids.sendHeart('michelle'),false);assert.equal(m[M.Player_QueueSuit],0);
  for(let i=0;i<8;i++)kids.step(i);assert.equal(m[M.Player_Suit],0);assert.equal(m[M.Player_QueueSuit],0,'power arrives with the heart, not button press');
  m[M.Player_X]+=20;for(let i=0;i<100&&kids.hearts.length;i++)kids.step(i+8);
  assert.equal(kids.hearts.length,0);assert.equal(m[M.Player_QueueSuit],2);assert.equal(m[M.Player_Grow],0x2f);assert.ok(m[M.Sound_QLevel1]&0x20);
  for(let i=0;i<90;i++)e.step();assert.equal(m[M.Player_Suit],1,'actual ROM completes growth into Super Mario');assert.equal(m[M.Player_IsDying],0);
  assert.equal(kids.sendHeart('michelle'),false);assert.ok(kids.heartCooldown>0);
});
test('hearts preserve stronger forms and pending transformations and never revive Dad',()=>{
  const {kids,e}=boot(),m=e.nes[0].cpu.mem;
  for(const suit of [1,2,3,4,5,6]){m[M.Player_Suit]=suit;assert.equal(kids.deliverMushroom(),true);assert.equal(m[M.Player_Suit],suit);assert.equal(m[M.Player_QueueSuit],0);}
  m[M.Player_Suit]=0;m[M.Player_QueueSuit]=4;kids.deliverMushroom();assert.equal(m[M.Player_QueueSuit],4);m[M.Player_QueueSuit]=0;
  assert.equal(kids.sendHeart('michelle'),true);m[M.Player_IsDying]=1;kids.step(0);assert.equal(kids.hearts.length,0);assert.equal(kids.deliverMushroom(),false);assert.equal(m[M.Player_QueueSuit],0);assert.equal(m[M.Player_IsDying],1);
});
test('heart travel and recharge freeze on pause; scene changes and reset discard in-flight hearts',()=>{
  const {kids,e}=boot();kids.sendHeart('michelle');e.paused=true;const hearts=structuredClone(kids.hearts),cooldown=kids.heartCooldown;kids.step(500);assert.deepEqual(kids.hearts,hearts);assert.equal(kids.heartCooldown,cooldown);assert.equal(kids.sendHeart('michelle'),false);
  e.paused=false;e.nes[0].cpu.mem[M.Level_LayPtrOrig_AddrL]^=1;kids.step(501);assert.equal(kids.hearts.length,0);assert.equal(e.nes[0].cpu.mem[M.Player_QueueSuit],0);kids.reset();assert.equal(kids.heartCooldown,0);assert.equal(kids.hearts.length,0);
});
test('question retries, stale messages, turn order, and first-answer team reward',()=>{
  for(const missed of [true,false]){const q=new LearningRound();assert.ok(q.start({playing:true,tablet:true}));q.advance(q.token());const old=q.token();if(missed){const question=q.round.questions[0];q.answer(q.token(),question.choices.findIndex(x=>x!==question.answer));assert.equal(q.answer(old,0),false);q.advance(q.token());}
  for(let i=0;i<2;i++){const question=q.round.questions[i];assert.equal(question.role,i?'michelle':'jj');q.answer(q.token(),question.choices.indexOf(question.answer));const result=q.advance(q.token());if(i===1){assert.deepEqual(result.roles,missed?['michelle']:['jj','michelle']);assert.equal(result.giant,!missed);}}assert.equal(q.round,null);}
});
