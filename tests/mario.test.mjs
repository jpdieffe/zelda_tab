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
import {FORMS} from '../dist/mario/copy-forms/forms.js';
import {FamilyLearning} from '../dist/mario/jet-learning.js';
const rom=readFileSync(new URL('../dist/mario/roms/mario3.nes',import.meta.url));
let level;
function boot(){const e=new CoopEngine(rom,{NES});if(level)e.nes[0].fromJSON(structuredClone(level));else{
  e.nes[0].fromJSON(JSON.parse(readFileSync(new URL('../dist/mario/start.json',import.meta.url))));
  const run=n=>{for(let i=0;i<n;i++)e.step();},press=(mask,n)=>{e.input(0,mask);run(n);e.input(0,0);run(20);};
  press(128,20);press(16,20);press(1,2);run(180);level=structuredClone(e.nes[0].toJSON());
}e.resetWorld();const kids=new Companions(e);kids.step(0);return {e,kids};}
test('bundled original ROM hash matches the supplied Mario 3 revision',()=>{assert.equal(createHash('sha256').update(rom).digest('hex'),'4377a7f5e6eb50bdd2ac6f249bf1a7085500aca8eb41f38545c3a2731c51a579');});
test('Mario enters the real first level; companions never create a second playable Mario',()=>{const {e,kids}=boot();assert.equal(e.nes[0].cpu.mem[M.Level_Tileset],1);assert.equal(kids.playable(),true);assert.equal(e.joined,false);assert.equal(kids.kids.jj.segments.length,8);});

test('companion aiming and kills recover after death and re-entering the same level',()=>{
  const {e,kids}=boot(),m=e.nes[0].cpu.mem,originalScene=e.key;
  const run=n=>{for(let i=0;i<n;i++){e.step();kids.step(i);}};
  const press=(mask,n=2)=>{e.input(0,mask);run(n);e.input(0,0);run(20);};
  for(const role of ['jj','michelle']){
    const target=e.weapons.targets().find(t=>t.key==='level:0');
    assert.ok(target,'respawned enemy is targetable at the start of each attempt');
    const k=kids.kids[role];k.x=target.left-40;k.y=(target.top+target.bottom)/2-20;k.active=true;k.hurt=60;
    kids.attack(k);assert.ok(kids.shots.at(-1).dy>0,'shot aims toward the enemy instead of flying straight');
    for(let i=0;i<30&&!e.entities.get(target.key)?.dead;i++)kids.step(i);
    assert.equal(m[0x661+target.slot],0,'companion projectile kills the original ROM enemy');
    assert.equal(e.entities.get(target.key)?.dead,true);
    // Enter the original pit-death dispatcher and let the ROM return to its map.
    m[M.Player_IsDying]=2;
    for(let i=0;i<600&&m[M.Level_Tileset];i++)run(1);
    assert.equal(m[M.Level_Tileset],0,'native death returns Mario to the overworld');
    run(150);press(128,20);press(16,20);press(1);run(200);
    assert.equal(e.key,originalScene,'retry loads the exact same level');
    assert.ok(e.readActors(0).some(a=>a.key===target.key),'ROM respawned the previously defeated enemy');
    assert.ok(e.weapons.targets().some(a=>a.key===target.key),'old kill records must not hide the respawned enemy');
  }
});

test('jet challenge requires three answers each, allows retries, and cannot be earned by skipping',()=>{
  const q=new FamilyLearning();assert.equal(q.start({jet:true,playing:true,tablet:true}),true);
  assert.deepEqual(q.round.questions.map(x=>x.role),['jj','jj','jj','michelle','michelle','michelle']);assert.equal(q.snapshot().total,6);
  q.advance(q.token());
  for(let i=0;i<6;i++){
    const item=q.round.questions[i],old=q.token();q.answer(old,item.choices.findIndex(x=>x!==item.answer));assert.equal(q.snapshot().phase,'retry');assert.equal(q.answer(old,0),false);q.advance(q.token());
    q.answer(q.token(),item.choices.indexOf(item.answer));assert.equal(q.snapshot().correct,true);
    if(i<5)assert.deepEqual(q.reward().roles,[]);const result=q.advance(q.token());
    if(i===5)assert.deepEqual(result,{finished:true,roles:['jj','michelle'],giant:true,type:'jet'});
  }
  q.start({jet:true,playing:true,tablet:true});q.skip();assert.equal(q.round,null);assert.equal(q.advance('old'),null);
});
test('jet flies in the real ROM, hovers, scrolls, survives enemies, and leaves ROM bytes clean',()=>{
  const {e,kids}=boot(),n=e.nes[0],m=n.cpu.mem,original=structuredClone(n.rom.rom);
  assert.equal(kids.jet.start(),true);assert.equal(kids.sendHeart('michelle'),false);
  const step=(count,mask)=>{e.input(0,mask);for(let i=0;i<count;i++){e.step();kids.step(i);}};
  const before=player(n);step(25,16);assert.ok(player(n).y<before.y-40);const high=player(n);step(30,0);assert.equal(player(n).y,high.y,'jet hovers without gravity');
  step(180,128);assert.ok(player(n).x>before.x+300);assert.ok(player(n).cameraX>0);assert.equal(m[M.Player_IsDying],0);assert.equal(kids.jet.active,true);
  const target=e.weapons.targets()[0];if(target){m[M.Player_X]=target.x&255;m[M.Player_XHi]=target.x>>8;m[M.Player_Y]=(target.y-10)&255;m[M.Player_YHi]=(target.y-10)>>8;step(20,0);assert.equal(m[M.Player_IsDying],0);assert.equal(m[M.Player_Suit],0);}
  step(180,32);assert.equal(m[M.Player_IsDying],0,'bottom camera bound prevents pit death');assert.ok(player(n).y-player(n).cameraY<=175);
  assert.deepEqual(n.rom.rom,original);assert.equal(kids.jet.patched,false);assert.equal(m[M.Player_FlashInv],0);
  kids.jet.stop();assert.equal(kids.jet.active,false);
});
test('jet persists across a room and a save, ends at a goal or map, and normal Mario can still die afterward',()=>{
  const {e,kids}=boot(),m=e.nes[0].cpu.mem;kids.jet.start();e.step();kids.step(0);
  e.paused=true;const p=player(e.nes[0]);e.input(0,128);e.step();kids.step(0);assert.deepEqual(player(e.nes[0]),p);e.paused=false;
  m[M.Level_LayPtrOrig_AddrL]^=1;e.step();kids.step(0);assert.equal(kids.jet.active,true);
  const saved=structuredClone(e.snapshot());kids.reset();assert.equal(kids.jet.active,false);e.restore(saved);kids.reset({keepJet:true});assert.equal(kids.jet.active,true);
  const restored=e.nes[0].cpu.mem;restored[M.Player_EndLevel]=20;e.step();assert.equal(kids.jet.active,false);assert.equal(kids.jet.patched,false);
  restored[M.Player_EndLevel]=0;restored[M.Player_IsDying]=1;e.step();assert.notEqual(restored[M.Player_IsDying],0);
  const fresh=boot();fresh.kids.jet.start();fresh.e.nes[0].cpu.mem[M.Level_Tileset]=0;fresh.e.step();assert.equal(fresh.kids.jet.active,false);
});
test('jet weapons use separate aim and colored missiles; stale inputs and pauses stop firing',()=>{
  const {e,kids}=boot();kids.jet.start();e.step();
  kids.input('jj',{mask:2,aim:{x:0,y:-1}},0);kids.input('michelle',{mask:2,aim:{x:0,y:1}},0);kids.step(1);
  assert.deepEqual(kids.jet.beams.map(b=>[b.role,b.dx,b.dy]),[['jj',0,-1],['michelle',0,1]]);
  assert.deepEqual(kids.jet.shots.map(s=>s.role),['jj','michelle']);const shots=structuredClone(kids.jet.shots);e.paused=true;kids.step(100);assert.deepEqual(kids.jet.shots,shots);e.paused=false;
  kids.step(351);assert.equal(kids.jet.beams.length,0);assert.equal(kids.kids.jj.mask,0);assert.equal(kids.kids.michelle.mask,0);
  kids.release('jj');assert.equal(kids.kids.jj.aim,null);
});
test('jet can fly through World 1-1 and collect the native goal card',()=>{
  const {e,kids}=boot(),n=e.nes[0],m=n.cpu.mem;kids.jet.start();let sawCard=false;
  for(let i=0;i<1800&&kids.jet.active;i++){
    const p=player(n),card=e.readActors(0).find(a=>m[0x671+a.slot]===0x41);
    let dx=1,dy=p.y>p.cameraY+25?-1:0;
    if(card){sawCard=true;dx=Math.sign(card.x-p.x);dy=Math.sign(card.y-18-p.y);}
    e.input(0,(dx>0?128:dx<0?64:0)|(dy>0?32:dy<0?16:0));e.step();kids.step(i);
  }
  assert.equal(sawCard,true);assert.equal(kids.jet.active,false,'native goal ends jet reward');assert.equal(m[M.Player_IsDying],0);
});
test('both jet lasers and missiles defeat actual enemies through terrain with explosions and sound',()=>{
  for(const role of ['jj','michelle'])for(const weapon of ['laser','missile']){
    const {e,kids}=boot(),m=e.nes[0].cpu.mem;kids.jet.start();e.step();
    const target=e.weapons.targets()[0];assert.ok(target);
    const origin=kids.jet.turret(role),point={x:(target.left+target.right)/2,y:(target.top+target.bottom)/2};
    const wall=tileAt(e.nes[0],(origin.x+point.x)/2,(origin.y+point.y)/2);m[0x6000+wall.index]=0x67;
    const terrain=Array.from(m.slice(0x6000,0x7950));
    kids.input(role,{mask:weapon==='missile'?2:0,aim:{x:point.x-origin.x,y:point.y-origin.y}},0);
    if(weapon==='missile'){kids.kids[role].jetAim=kids.kids[role].aim;kids.kids[role].aim=null;}
    for(let i=0;i<70&&!kids.stats.hits;i++)kids.step(i);
    assert.equal(m[0x661+target.slot],0,`${role} ${weapon}`);assert.equal(kids.stats.hits,1);assert.equal(kids.explosions.length,1);assert.ok(m[M.Sound_QLevel1]&8);
    assert.deepEqual(Array.from(m.slice(0x6000,0x7950)),terrain);
  }
});
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
test('legacy timed rewards still expire on simulation time',()=>{const {kids}=boot();for(const type of ['laser','missiles','dinosaur']){kids.grant({roles:['jj','michelle'],type,giant:true});assert.equal(kids.kids.jj.power.type,type);assert.equal(kids.kids.michelle.power.giant,true);kids.kids.jj.power.left=1;kids.step(0);assert.equal(kids.kids.jj.power,null);}});
test('level powers launch repeated meteors and chomps, pause, survive saves and pipes, and end on death',()=>{
  for(const type of ['meteor','chomp']){
    const {e,kids}=boot(),m=e.nes[0].cpu.mem,power=kids.levelPowers,target=e.weapons.targets()[0];
    kids.grant({roles:['jj','michelle'],type,giant:true});
    assert.equal(kids.meteors.length,0,'earning a meteor gives a button, not an automatic strike');
    assert.equal(power.launch('dad'),false);
    const k=kids.kids.jj;k.x=target.left-45;k.y=(target.top+target.bottom)/2;k.active=true;k.hurt=255;
    const wall=tileAt(e.nes[0],target.left-20,k.y);m[0x6000+wall.index]=0x67;
    assert.equal(power.launch('jj'),true);assert.equal(power.launch('jj'),false,'cooldown prevents duplicate taps');
    e.paused=true;const cooldown=k.power.cooldown;for(let i=0;i<120;i++)kids.step(i);assert.equal(k.power.cooldown,cooldown);assert.equal(power.launch('michelle'),false);e.paused=false;
    for(let i=0;i<130;i++)kids.step(i);
    assert.equal(m[0x661+target.slot],0,'power defeats the enemy across the wall');
    assert.equal(k.power.type,type);assert.equal(power.launch('jj'),true,'power can launch again');
    for(let i=0;i<1300;i++)kids.step(i);assert.equal(k.power.type,type,'power lasts beyond old timed rewards');
    m[M.Player_InPipe]=1;kids.step(0);assert.equal(power.launch('jj'),false);m[M.Player_InPipe]=0;
    m[M.Level_LayPtrOrig_AddrL]^=1;kids.step(0);assert.equal(k.power.type,type,'new room in the same level keeps the power');
    const saved=structuredClone(e.snapshot());kids.reset();e.restore(saved);assert.equal(k.power.type,type);assert.equal(kids.kids.michelle.power.type,type);
    e.nes[0].cpu.mem[M.Player_IsDying]=2;kids.step(0);assert.equal(k.power,null);assert.equal(power.chomps.length,0);assert.equal(kids.meteors.length,0);
  }
});

test('giant family Bullet Bill crosses solid walls, crushes enemies and bricks, and restores from a save',()=>{
  const {e,kids}=boot(),m=e.nes[0].cpu.mem,original=structuredClone(e.nes[0].rom.rom);
  kids.grant({roles:['jj','michelle'],type:'bullet',giant:true});assert.equal(kids.jet.kind,'bullet');assert.equal(kids.jet.active,true);
  const start=player(e.nes[0]),wall=tileAt(e.nes[0],start.x+45,start.y+16);m[0x6000+wall.index]=255;
  const brick=tileAt(e.nes[0],start.x+24,start.y+16);m[0x6000+brick.index]=0x67;
  const target=e.weapons.targets()[0];
  e.input(0,128);for(let i=0;i<22;i++){e.step();kids.step(i);}
  assert.ok(player(e.nes[0]).x>wall.x+16,'bullet passes completely through solid terrain');assert.equal(m[0x6000+brick.index],0x80,'bullet blasts bricks');
  assert.equal(m[M.Player_IsDying],0);assert.deepEqual(e.nes[0].rom.rom,original,'temporary protection leaves ROM clean');
  if(target)assert.equal(m[0x661+target.slot],0,'body contact defeats a real enemy');
  const save=structuredClone(e.snapshot());kids.jet.stop();e.restore(save);assert.equal(kids.jet.active,true);assert.equal(kids.jet.kind,'bullet');
  e.nes[0].cpu.mem[M.EndCard_Flag]=1;e.step();assert.equal(kids.jet.active,false,'goal ends giant bullet');
});

test('giant Bullet Bill can finish a real level through its original goal card',()=>{
  const {e,kids}=boot(),m=e.nes[0].cpu.mem;kids.grant({roles:['jj'],type:'bullet',giant:false});let sawCard=false;
  for(let i=0;i<1800&&kids.jet.active;i++){
    const p=player(e.nes[0]),card=e.readActors(0).find(a=>m[0x671+a.slot]===0x41);let dx=1,dy=p.y>p.cameraY+25?-1:0;
    if(card){sawCard=true;dx=Math.sign(card.x-p.x);dy=Math.sign(card.y-18-p.y);}
    e.input(0,(dx>0?128:dx<0?64:0)|(dy>0?32:dy<0?16:0));e.step();kids.step(i);
  }
  assert.equal(sawCard,true);assert.equal(kids.jet.active,false);assert.equal(m[M.Player_IsDying],0);
});

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
  const {kids,e}=boot(),m=e.nes[0].cpu.mem,p=player(e.nes[0]);kids.heartFormBag=['mario-1'];kids.kids.michelle.x=p.x+150;kids.kids.michelle.y=p.y-30;
  assert.equal(kids.sendHeart('jj'),false);assert.equal(kids.sendHeart('michelle'),true);assert.equal(kids.sendHeart('michelle'),false);assert.equal(m[M.Player_QueueSuit],0);
  for(let i=0;i<8;i++)kids.step(i);assert.equal(m[M.Player_Suit],0);assert.equal(m[M.Player_QueueSuit],0,'power arrives with the heart, not button press');
  m[M.Player_X]+=20;for(let i=0;i<100&&kids.hearts.length;i++)kids.step(i+8);
  assert.equal(kids.hearts.length,0);assert.equal(m[M.Player_QueueSuit],2);assert.equal(m[M.Player_Grow],0x2f);assert.ok(m[M.Sound_QLevel1]&0x20);
  for(let i=0;i<90;i++)e.step();assert.equal(m[M.Player_Suit],1,'actual ROM completes growth into Super Mario');assert.equal(m[M.Player_IsDying],0);
  assert.equal(kids.sendHeart('michelle'),false);assert.ok(kids.heartCooldown>0);
});
test('heart bonuses shuffle all 120 forms without repeating the current form, including after normal pickups',()=>{
  for(const random of [()=>0,()=>.999999,Math.random]){
    const {e}=boot(),kids=new Companions(e,random);let current='mario-1';
    for(let cycle=0;cycle<4;cycle++){
      const seen=new Set();
      for(let i=0;i<FORMS.length;i++){const suit=kids.nextHeartForm(current);assert.notEqual(suit,current);assert.ok(FORMS.some(f=>f.key===suit));seen.add(suit);current=suit;}
      assert.equal(seen.size,120);
    }
    kids.heartFormBag=[current];assert.notEqual(kids.nextHeartForm(current),current,'normal pickups cannot leave a duplicate-only bonus');
    kids.reset();assert.deepEqual(kids.heartFormBag,[]);
  }
});
test('native ROM transforms big and powered Mario into every heart suit with the matching effect and sound',()=>{
  for(const current of [1,2,3,4,5,6])for(const suit of [2,3,4,5,6]){
    if(current===suit)continue;
    const {kids,e}=boot(),m=e.nes[0].cpu.mem;m[M.Player_Suit]=current;kids.heartFormBag=[`mario-${suit}`];m[M.Sound_QLevel1]=0;
    if(current===5)m[M.Player_Statue]=0x40;
    assert.equal(kids.deliverHeartPower(),true);assert.equal(m[M.Player_Suit],current,'ROM applies the queued change');
    assert.equal(m[M.Player_QueueSuit],suit+1);assert.equal(m[M.Player_Statue],0);
    assert.equal(m[suit===2?M.Player_StarOff:M.Player_SuitLost],suit===2?0x1f:0x17);assert.ok(m[M.Sound_QLevel1]&(suit===2?0x20:0x80));
    for(let i=0;i<60;i++)e.step();
    assert.equal(m[M.Player_Suit],suit,`native transformation ${current} -> ${suit}`);assert.equal(m[M.Player_IsDying],0);
    assert.equal(m[M.Player_QueueSuit],0);assert.equal(m[M.Player_SuitLost],0);assert.equal(m[M.Player_StarOff],0);assert.equal(kids.playable(),true);
  }
});
test('a traveling heart picks its bonus using Dad\'s suit on arrival',()=>{
  const {kids,e}=boot(),m=e.nes[0].cpu.mem,p=player(e.nes[0]);kids.kids.michelle.x=p.x+150;kids.kids.michelle.y=p.y;
  assert.equal(kids.sendHeart('michelle'),true);assert.equal(m[M.Player_QueueSuit],0);
  m[M.Player_Suit]=1;kids.heartFormBag=['mario-6'];
  for(let i=0;i<100&&kids.hearts.length;i++)kids.step(i);
  assert.equal(kids.hearts.length,0);assert.equal(m[M.Player_QueueSuit],7);assert.equal(m[M.Player_SuitLost],0x17);assert.ok(kids.heartCooldown>0);
});
test('hearts preserve pending transformations and never revive Dad',()=>{
  const {kids,e}=boot(),m=e.nes[0].cpu.mem;
  for(const flag of [M.Player_QueueSuit,M.Player_Grow,M.Player_SuitLost,M.Player_StarOff]){
    m[flag]=4;const before=Array.from(m);assert.equal(kids.deliverHeartPower(),false);assert.deepEqual(Array.from(m),before);assert.deepEqual(kids.heartFormBag,[]);m[flag]=0;
  }
  assert.equal(kids.sendHeart('michelle'),true);m[M.Player_IsDying]=1;kids.step(0);assert.equal(kids.hearts.length,0);assert.equal(kids.deliverHeartPower(),false);assert.equal(m[M.Player_QueueSuit],0);assert.equal(m[M.Player_IsDying],1);
});
test('Michelle can grant every imported form to small Mario on the existing family simulation',()=>{
  const {e,kids}=boot(),saved=structuredClone(e.snapshot());
  for(const form of FORMS){
    e.restore(saved);kids.reset();kids.heartFormBag=[form.key];
    // Small Mario itself is also in the collection, but never replaces itself.
    if(form.key==='mario-0')e.nes[0].cpu.mem[M.Player_Suit]=1;
    assert.equal(kids.deliverHeartPower(),true,form.name);
    for(let i=0;i<65;i++)e.step();
    assert.equal(e.forms.form.key,form.key,form.name);
    assert.equal(e.nes[0].cpu.mem[M.Player_Suit],form.suit??1,form.name);
    assert.equal(e.nes[0].cpu.mem[M.Player_IsDying],0,form.name);
    assert.equal(e.forms.nes,e.nes[0]);assert.equal(e.forms.pixels,e.frames[0]);
    if(form.suit===undefined){assert.equal(e.nes[0].hideMario,true);assert.ok(e.forms.sprites.image(form,e.forms.frame,e.forms.spritePose),form.name+' has sprite art');}
  }
});
test('family forms use Dad input, freeze during questions, survive saves and suspend during jet flight',()=>{
  const {e,kids}=boot();kids.heartFormBag=['enemy-78'];assert.ok(kids.deliverHeartPower());
  for(let i=0;i<65;i++)e.step();
  const p=player(e.nes[0]);e.input(0,17);for(let i=0;i<20;i++)e.step();assert.ok(player(e.nes[0]).y<p.y,'Bullet Bill flies with Dad input');
  e.input(0,2);e.step();assert.ok(e.forms.dashTime>0,'Run uses the form ability');
  e.paused=true;const frame=e.forms.frame,dash=e.forms.dashTime;e.step();assert.equal(e.forms.frame,frame);assert.equal(e.forms.dashTime,dash);e.paused=false;
  const saved=structuredClone(e.snapshot());e.forms.select('mario-3');e.restore(saved);assert.equal(e.forms.form.key,'enemy-78');assert.equal(e.masks[0],0);
  assert.ok(kids.jet.start());assert.equal(kids.deliverHeartPower(),false);e.input(0,0);e.step();const y=player(e.nes[0]).y;
  for(let i=0;i<30;i++)e.step();assert.equal(player(e.nes[0]).y,y,'custom flight does not override jet hover');assert.equal(e.forms.dashTime,0);assert.equal(e.nes[0].hideMario,false);
  const jetSave=structuredClone(e.snapshot());e.restore(jetSave);assert.ok(kids.jet.active);assert.equal(e.forms.form.key,'enemy-78');
  kids.jet.stop();e.step();assert.equal(e.forms.form.key,'enemy-78');assert.equal(e.nes[0].hideMario,true);
  const oldSave=structuredClone(saved);delete oldSave.form;e.restore(oldSave);assert.equal(e.forms.form.key,'mario-1','legacy saves use their native suit');
  e.nes[0].fromJSON(JSON.parse(readFileSync(new URL('../dist/mario/start.json',import.meta.url))));e.forms.reset();assert.equal(e.forms.form.key,'mario-0','new game clears the form');
});
test('heart travel and recharge freeze on pause; scene changes and reset discard in-flight hearts',()=>{
  const {kids,e}=boot();kids.sendHeart('michelle');e.paused=true;const hearts=structuredClone(kids.hearts),cooldown=kids.heartCooldown;kids.step(500);assert.deepEqual(kids.hearts,hearts);assert.equal(kids.heartCooldown,cooldown);assert.equal(kids.sendHeart('michelle'),false);
  e.paused=false;e.nes[0].cpu.mem[M.Level_LayPtrOrig_AddrL]^=1;kids.step(501);assert.equal(kids.hearts.length,0);assert.equal(e.nes[0].cpu.mem[M.Player_QueueSuit],0);kids.reset();assert.equal(kids.heartCooldown,0);assert.equal(kids.hearts.length,0);
});
test('question retries, stale messages, turn order, and first-answer team reward',()=>{
  for(const missed of [true,false]){const q=new LearningRound();assert.ok(q.start({playing:true,tablet:true}));q.advance(q.token());const old=q.token();if(missed){const question=q.round.questions[0];q.answer(q.token(),question.choices.findIndex(x=>x!==question.answer));assert.equal(q.answer(old,0),false);q.advance(q.token());}
  for(let i=0;i<2;i++){const question=q.round.questions[i];assert.equal(question.role,i?'michelle':'jj');q.answer(q.token(),question.choices.indexOf(question.answer));const result=q.advance(q.token());if(i===1){assert.deepEqual(result.roles,missed?['michelle']:['jj','michelle']);assert.equal(result.giant,!missed);}}assert.equal(q.round,null);}
});
