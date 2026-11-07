import test from 'node:test';
import assert from 'node:assert/strict';
import {QuestionDeck,LearningRound,SIGHT_WORDS,mathFacts} from '../dist/learning.js';
import {LaserReward,beamEnd,touchesBeam} from '../dist/lasers.js';
import {ADDR as A,applyHit,applyLaserHit} from '../dist/zelda.js';

test('curriculum has the 23 current agenda words and every math fact stays within 0 through 10',()=>{
  assert.equal(SIGHT_WORDS.length,23);assert.equal(SIGHT_WORDS.at(-1),'mother');assert.ok(!SIGHT_WORDS.includes('good'));
  const facts=mathFacts();assert.equal(facts.length,132);
  for(const f of facts){assert.ok(f.a>=0&&f.a<=10&&f.b>=0&&f.b<=10);assert.equal(Number(f.answer),f.operator==='+'?f.a+f.b:f.a-f.b);assert.ok(Number(f.answer)>=0&&Number(f.answer)<=10);}
});
test('letters and words have three choices; math shows the complete ordered 0–10 keypad',()=>{
  const deck=new QuestionDeck(),letters=new Set(),words=new Set();
  for(let i=0;i<46;i++){
    const jj=deck.next('jj'),m=deck.next('michelle');
    if(i<26)letters.add(jj.answer);
    assert.equal(m.kind,i%2===0?'math':'word');if(m.kind==='word')words.add(m.answer);
    for(const q of [jj,m]){assert.equal(q.choices.length,q.kind==='math'?11:3);assert.equal(new Set(q.choices).size,q.choices.length);assert.ok(q.choices.includes(q.answer));assert.ok(q.speech.includes(q.role==='jj'?'JJ':'Michelle'));}
    if(m.kind==='math')assert.deepEqual(m.choices,Array.from({length:11},(_,n)=>String(n)));
  }
  assert.equal(letters.size,26);assert.equal(words.size,23);
});
const eligible={playing:true,tablet:true};
test('Dad starts both questions on a ready screen only when play and the tablet are available',()=>{
  const quiz=new LearningRound();
  assert.equal(quiz.start({...eligible,playing:false}),false);
  assert.equal(quiz.start({...eligible,tablet:false}),false);assert.equal(quiz.round,null);
  assert.equal(quiz.start(eligible),true);assert.deepEqual(quiz.round.questions.map(q=>q.role),['jj','michelle']);
  assert.equal(quiz.snapshot().phase,'ready');assert.match(quiz.snapshot().speech,/Get ready for questions/);assert.equal(quiz.snapshot().answer,null);
  const token=quiz.token();assert.equal(quiz.start(eligible),false);assert.equal(quiz.token(),token,'Repeated starts preserve the pending round');
  quiz.advance(quiz.token());assert.equal(quiz.snapshot().name,'JJ');
  quiz.skip();assert.equal(quiz.start(eligible),true,'Dad can start another round after skipping');assert.notEqual(quiz.token(),token);
});
function begin(quiz){quiz.start(eligible);quiz.advance(quiz.token());}
function answer(quiz,correct){const r=quiz.round,q=r.questions[r.index],index=q.choices.findIndex(v=>correct?v===q.answer:v!==q.answer);assert.equal(quiz.answer(quiz.token(),index),true);}
test('the host accepts every math keypad index including 9 and 10, but rejects out-of-range input',()=>{
  for(let n=0;n<=10;n++){
    const quiz=new LearningRound();begin(quiz);answer(quiz,true);quiz.advance(quiz.token());
    quiz.round.questions[1].answer=String(n);
    assert.equal(quiz.answer(quiz.token(),11),false);assert.equal(quiz.answer(quiz.token(),n),true);assert.equal(quiz.snapshot().correct,true);
  }
});
test('wrong answers require retries without a bonus; stale and repeated messages are rejected',()=>{
  const quiz=new LearningRound();begin(quiz);const token=quiz.token();
  for(const i of [-1,3,NaN,1.5,'0'])assert.equal(quiz.answer(token,i),false);
  assert.equal(quiz.answer('old',0),false);assert.equal(quiz.advance(token),null);
  answer(quiz,false);assert.equal(quiz.answer(token,0),false);
  assert.equal(quiz.snapshot().correct,false);assert.equal(quiz.snapshot().phase,'retry');assert.equal(quiz.snapshot().answer,null);
  assert.equal(quiz.advance(token),null);const retryToken=quiz.token();quiz.advance(retryToken);
  assert.equal(quiz.snapshot().name,'JJ');assert.equal(quiz.advance(retryToken),null);assert.equal(quiz.answer(token,0),false);
  answer(quiz,false);quiz.advance(quiz.token());answer(quiz,true);
  assert.equal(quiz.snapshot().correct,false,'A later correct answer cannot restore the bonus');quiz.advance(quiz.token());
  assert.equal(quiz.snapshot().name,'Michelle');assert.equal(quiz.advance(token),null);assert.equal(quiz.answer(token,0),false);
  answer(quiz,true);const result=quiz.advance(quiz.token());
  assert.deepEqual(result,{finished:true,roles:['michelle'],giant:false});assert.equal(quiz.snapshot(),null);
});
test('both correct answers earn giant lasers; no correct answers and skipped rounds earn none',()=>{
  for(const correct of [true,false]){
    const quiz=new LearningRound();begin(quiz);
    for(let i=0;i<2;i++){answer(quiz,correct);if(!correct){quiz.advance(quiz.token());answer(quiz,true);}if(i===0)quiz.advance(quiz.token());}
    assert.equal(quiz.snapshot().giant,correct);const result=quiz.advance(quiz.token());assert.equal(result.giant,correct);assert.equal(result.roles.length,correct?2:0);
  }
  const quiz=new LearningRound();begin(quiz);answer(quiz,true);quiz.skip();assert.equal(quiz.round,null);assert.equal(quiz.advance('1:0'),null);
});
const world=()=>({active:true,enemies:[{slot:1,type:0x41,x:150,y:100,vulnerable:true}],wallAt:()=>false});
const characters=()=>({jj:{active:true,x:50,y:100,aimX:1,aimY:0},michelle:{active:true,enabled:true,x:100,y:150,aimX:0,aimY:-1}});
test('laser rewards last 20 active seconds and pause during questions/dialogue',()=>{
  const laser=new LaserReward(),w=world(),c=characters();let hits=0;laser.start({roles:['jj'],giant:false});
  laser.update(1,w,c,()=>hits++);assert.equal(laser.remaining,19);assert.equal(laser.beams.length,1);assert.equal(laser.beams[0].role,'jj');assert.equal(hits,1);
  laser.update(10,w,c,()=>hits++,true);laser.update(10,{...w,active:false},c,()=>hits++);assert.equal(laser.remaining,19);assert.equal(hits,1);
  laser.update(18,w,c,()=>hits++);assert.equal(laser.active,true);
  laser.update(1,w,c,()=>hits++);assert.equal(laser.active,false);assert.equal(laser.beams.length,0);
});
test('regular and giant lasers steer independently with tablet and phone vectors',()=>{
 for(const giant of [false,true]){
  const laser=new LaserReward(),w=world(),c=characters();laser.start({roles:['jj','michelle'],giant});
  laser.setAim('jj',1,0);laser.setAim('michelle',0,-1);laser.update(.01,w,c,()=>{});
  assert.ok(laser.beams[0].end.x>c.jj.x);assert.equal(laser.beams[0].end.y,c.jj.y);
  assert.equal(laser.beams[1].end.x,c.michelle.x);assert.ok(laser.beams[1].end.y<c.michelle.y);
  laser.setAim('jj',0,1);laser.setAim('michelle',NaN,Infinity);laser.update(.01,w,c,()=>{});
  assert.equal(laser.beams[0].end.x,c.jj.x);assert.ok(laser.beams[0].end.y>c.jj.y);assert.equal(laser.aim.michelle.y,-1);
 }
});
test('later questions preserve remaining rewards and track each child’s reward separately',()=>{
  const laser=new LaserReward(),w=world(),c=characters();laser.start({roles:['jj','michelle'],giant:true});
  laser.update(10,w,c,()=>{});laser.start({roles:[],giant:false});assert.equal(laser.remaining,10);
  laser.start({roles:['michelle'],giant:false});assert.equal(laser.timers.jj.remaining,10);assert.equal(laser.timers.michelle.remaining,20);
  laser.update(10,w,c,()=>{});assert.deepEqual(laser.roles,['michelle']);assert.equal(laser.giant,false);
  laser.setAim('michelle',.5,.25);laser.update(.01,w,c,()=>{});assert.equal(laser.beams[0].radius,2);
  laser.update(10,w,c,()=>{});assert.equal(laser.active,false);
});
test('regular and giant lasers pierce walls but cannot hit enemies behind or beside the beam',()=>{
  const w=world(),source={x:50,y:100};w.wallAt=x=>x>=110;
  const end=beamEnd(source,{x:1,y:0});assert.ok(end.x>250&&end.x<=255);
  assert.equal(touchesBeam({x:150,y:100},source,end,2),true);
  assert.equal(touchesBeam({x:30,y:100},source,end,2),false);
  assert.equal(touchesBeam({x:80,y:130},source,end,2),false);
  for(const giant of [false,true]){const laser=new LaserReward();laser.start({roles:['jj'],giant});let hits=0;laser.update(.1,w,characters(),()=>hits++);assert.equal(hits,1);}
});
test('long-range lasers damage bosses through walls and protect NPCs',()=>{
  const ram=new Uint8Array(0x20000),source={x:50,y:100},end={x:240,y:100};
  ram[A.module]=9;ram[A.state]=9;ram[A.hp]=6;ram[A.type]=0x41;ram[A.xLo]=142;ram[A.yLo]=92;
  const target={slot:0,type:0x41};assert.equal(applyHit(ram,target,source),false,'normal shots keep their short range');
  assert.equal(applyLaserHit(ram,target,source,end,2),true);assert.equal(ram[A.damage],1);assert.equal(ram[A.hp],6);
  assert.equal(applyLaserHit(ram,target,source,end,2,()=>false),false,'invulnerability prevents repeated damage');
  for(const type of [0x51,0x53,0x73]){ram[A.type]=type;ram[A.damage]=0;ram[A.hit]=0;assert.equal(applyLaserHit(ram,{slot:0,type},source,end,10,()=>false),type!==0x73);}
  ram[A.type]=0x41;ram[A.module]=14;assert.equal(applyLaserHit(ram,target,source,end,2,()=>false),false);
});
