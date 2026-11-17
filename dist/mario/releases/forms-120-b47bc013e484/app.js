import {NES} from './vendor/jsnes/index.js';
import {CoopEngine,inLevel} from './engine.js';
import {Companions,dragon,unicorn} from './companions.js';
import {GameAudio} from './audio.js';
import {Connection,roomCode,normalizeCode,validCode} from './network.js';
import {FamilyLearning} from './jet-learning.js';
import {QuestionView,stopQuestionAudio} from './question-view.js';
import {Joystick} from './joystick.js';
import {KidLock} from './kid-lock.js';
import * as storage from './storage.js';
import {drawGame} from './copy-forms/art.js';
import {FORMS} from './copy-forms/forms.js';

const $=id=>document.getElementById(id);
$('forms-release').textContent=`${FORMS.length} transformations from Michelle`;
let role=null,engine=null,kids=null,connection=null,audio=null,media=null,wakeLock=null,busy=false,raf=0,last=0,accumulator=0,noticeTimer;
let selected='jj',target=null,remoteQuiz=null,localSound=false,jetMode=false,aimVector=null,lastVideoFrame=0;
const sources=new Map(),learning=new FamilyLearning(),canvas=$('game'),ctx=canvas.getContext('2d',{alpha:false});
const native=document.createElement('canvas');native.width=256;native.height=240;
const nativeCtx=native.getContext('2d',{alpha:false}),pixels=nativeCtx.createImageData(256,240),words=new Uint32Array(pixels.data.buffer);
new ResizeObserver(()=>{const area=$('screen-wrap');const width=Math.min(area.clientWidth,area.clientHeight*256/240);for(const surface of [canvas,$('remote-video')]){surface.style.width=width+'px';surface.style.height=width*240/256+'px';}}).observe($('screen-wrap'));
const quiz=new QuestionView((token,index)=>questionAction({type:'answer',token,index}),token=>questionAction({type:'next',token}));
const kidLock=new KidLock(locked=>connection?.send({type:'kid-lock-state',locked}));
function notice(text){$('status').textContent=text;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('status').textContent='',6500);}
function mask(){let value=0;for(const bit of sources.values())value|=1<<bit;return value;}
function blocked(){return !!(role==='dad'?learning.round:remoteQuiz);}
function sendInput(){
  if(!role)return;const value=blocked()?0:mask();
  if(role==='dad')engine?.input(0,value);else connection?.send({type:'input',mask:value,target:blocked()||jetMode?null:target,aim:blocked()?null:aimVector});
}
function clearInput(){sources.clear();target=null;joystick.reset();sendInput();}
function press(bit,source){if(blocked())return;sources.set(source,Number(bit));sendInput();}
function release(bit,source){sources.delete(source);sendInput();}
const joystick=new Joystick($('joystick'),(bit)=>press(bit,'joy'+bit),(bit)=>release(bit,'joy'+bit),vector=>{aimVector=vector;sendInput();});
for(const button of document.querySelectorAll('[data-button]')){
  button.addEventListener('pointerdown',e=>{if(e.button!==0||!role)return;e.preventDefault();button.setPointerCapture(e.pointerId);press(button.dataset.button,'touch'+e.pointerId);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,e=>release(button.dataset.button,'touch'+e.pointerId));
}
const keyMap={ArrowUp:4,ArrowDown:5,ArrowLeft:6,ArrowRight:7,KeyZ:0,Space:0,KeyX:1,Enter:3,ShiftLeft:2,ShiftRight:2};
addEventListener('keydown',e=>{if(!role||/INPUT|TEXTAREA/.test(e.target.tagName)||!(e.code in keyMap))return;e.preventDefault();if(!e.repeat)press(keyMap[e.code],'key'+e.code);});
addEventListener('keyup',e=>{if(e.code in keyMap)release(keyMap[e.code],'key'+e.code);});
addEventListener('blur',clearInput);
document.addEventListener('visibilitychange',()=>{clearInput();if(document.hidden&&role==='dad')save(false);if(!document.hidden)requestWake();});
for(const surface of [canvas,$('remote-video')]){
  let pointer=null;
  const aim=e=>{const rect=surface.getBoundingClientRect();target={x:(e.clientX-rect.left)/rect.width*256,y:(e.clientY-rect.top)/rect.height*240};sendInput();};
  surface.addEventListener('pointerdown',e=>{if(role!=='jj'||jetMode||blocked()||pointer!==null)return;e.preventDefault();pointer=e.pointerId;surface.setPointerCapture(pointer);aim(e);});
  surface.addEventListener('pointermove',e=>{if(e.pointerId===pointer)aim(e);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])surface.addEventListener(type,e=>{if(e.pointerId===pointer){pointer=null;target=null;sendInput();}});
}
document.addEventListener('contextmenu',e=>{if(role)e.preventDefault();});
async function requestWake(){if(role&&!document.hidden)try{wakeLock=await navigator.wakeLock?.request('screen');}catch{}}
function draw(){
  if(!engine)return;for(let i=0;i<words.length;i++)words[i]=engine.frames[0][i]|0xff000000;
  if(kids.jet.active)nativeCtx.putImageData(pixels,0,0);else drawGame(nativeCtx,engine.forms);
  ctx.imageSmoothingEnabled=false;ctx.drawImage(native,0,0,768,720);
  ctx.save();ctx.scale(3,3);kids.draw(ctx);ctx.restore();
  // Submit only the completed composite, including an idle transformed Dad.
  const now=performance.now(),track=media?.getVideoTracks()[0];
  if(track?.requestFrame&&now-lastVideoFrame>=1000/30){track.requestFrame();lastVideoFrame=now;}
}
function tick(now){
  raf=requestAnimationFrame(tick);if(!engine||document.hidden){last=now;accumulator=0;return;}
  accumulator+=Math.min(now-(last||now),70);last=now;let frames=0;
  try{while(accumulator>=1000/60&&frames<4){engine.step();kids.step(now);accumulator-=1000/60;frames++;}if(frames)draw();}
  catch(error){engine.paused=true;notice('Game paused: '+error.message);console.error(error);}
}
function state(){return {type:'state',jet:!!kids?.jet.active,form:engine?{name:engine.forms.form.name,hint:engine.forms.hint}:null,quiz:learning.snapshot(),paused:engine?.paused,heart:{ready:!!kids?.heartReady(),seconds:Math.ceil((kids?.heartCooldown||0)/60)},powers:Object.values(kids?.kids||{}).filter(k=>k.power).map(k=>`${k.role==='jj'?'JJ':'Michelle'}: ${k.power.giant?'SUPER ':''}${({laser:'lasers',missiles:'homing missiles',dinosaur:'dinosaur',meteor:'meteor'})[k.power.type]} · ${Math.ceil(k.power.left/60)}s`).join('  ✦  ')};}
function showState(data){
  if(jetMode!==!!data.jet){jetMode=!!data.jet;clearInput();updateControls();}
  if(role!=='dad'){const changed=!!remoteQuiz!==!!data.quiz;remoteQuiz=data.quiz;if(changed)clearInput();}
  if(role==='jj'||role==='dad'&&!connection?.has('jj'))quiz.render(data.quiz);else quiz.render(null);
  $('power-status').textContent=data.quiz?'Question time — game paused':data.paused?'Paused':data.jet?'INVINCIBLE JET · Dad flies · Aim lasers with joystick · Hold Missiles':data.powers||'No time limit';
  $('quiz-skip').hidden=role!=='dad';
  $('heart').disabled=role!=='michelle'||!data.heart?.ready||!!data.quiz;
  $('heart-caption').textContent=data.heart?.seconds?`${data.heart.seconds}s recharge`:'Random form for Dad';
  if(!data.quiz&&!data.paused&&!data.jet&&data.form)$('power-status').textContent=[data.form.name,data.powers].filter(Boolean).join(' · ');
  if(!data.quiz&&!data.paused&&!data.jet&&data.form)$('power-status').textContent+=` · ${FORMS.length} forms`;
  if(role!=='dad'&&!data.form)$('power-status').textContent='Dad is running the old game. Reopen the updated Mario link on Dad’s phone, then join his new room.';
  $('form-help').hidden=role!=='dad'||!!data.jet;
  $('form-name').textContent=data.form?`${data.form.name} controls`:'Form controls';
  $('form-tip').textContent=data.form?.hint||'';
  if(role==='dad'){$('skip').hidden=!data.quiz;$('questions').disabled=!!data.quiz||!kids?.playable()||engine.paused;$('jet').disabled=$('questions').disabled||!!data.jet;$('regroup').disabled=!!data.jet;}
}
function broadcast(){if(!engine)return;const s=state();connection?.send(s);showState(s);}
function questionAction(data,from=role){
  if(role!=='dad'){connection?.send(data);return;}
  if(!['dad','jj'].includes(from))return;
  if(data.type==='answer')learning.answer(data.token,data.index);
  if(data.type==='next'){const result=learning.advance(data.token);if(result?.finished){kids.grant(result);engine.paused=false;clearInput();}}
  broadcast();
}
function startQuestions(kind){
  if(!engine||engine.paused||!kids.playable())return;
  if(kind==='jet'&&kids.jet.active)return;
  if(learning.start({playing:true,tablet:true,jet:kind==='jet'})){clearInput();kids.release('jj');kids.release('michelle');engine.paused=true;broadcast();}
}
function skip(){if(!learning.round)return;learning.skip();engine.paused=false;clearInput();broadcast();}
function makeConnection(code){
  return new Connection({role,code,onCode:code=>{$('room-code').textContent=code;},
    onStatus:text=>{$('connection').textContent=text;},
    onConnected:guest=>{quiz.setConnected(true);if(role==='dad'){kids.release(guest);broadcast();}else{sendInput();connection?.send({type:'kid-lock-state',locked:kidLock.locked});}},
    onDisconnected:guest=>{
      if(role==='dad'){kids.release(guest);kids.kids[guest].active=false;if(guest==='michelle')kids.hearts=[];broadcast();}
      else{clearInput();$('heart').disabled=true;quiz.setConnected(false);$('screen-message').hidden=role!=='jj';$('screen-message').textContent='Reconnecting to Dad…';}
    },
    onStream:stream=>{const v=$('remote-video');if(v.srcObject===stream)return;v.srcObject=stream;v.muted=true;v.onloadeddata=()=>{$('screen-message').hidden=true;};v.play().catch(error=>{if(error.name!=='AbortError')notice('Tap Sound on to start the game video.');});},
    onData:(data,from)=>{
      if(role==='dad'){
        if(data.type==='heart'&&from==='michelle'){if(!learning.round)kids.sendHeart(from);broadcast();}
        else if(data.type==='input'&&!learning.round)kids.input(from,data);
        else if(data.type==='answer'||data.type==='next')questionAction(data,from);
      }else if(data.type==='unlock-tablet'&&role==='jj')kidLock.unlock();
      else if(data.type==='state')showState(data);
    }});
}
function enter(nextRole){
  role=nextRole;document.body.dataset.role=role;$('lobby').hidden=true;$('play').hidden=false;
  $('player-label').textContent={dad:'DAD · MARIO',jj:'JJ · DRAGON',michelle:'MICHELLE · UNICORN'}[role];
  $('dad-controls').hidden=role!=='dad';canvas.hidden=role!=='dad';$('remote-video').hidden=role!=='jj';$('michelle-card').hidden=role!=='michelle';
  $('sound').hidden=role==='michelle';
  $('kid-lock').hidden=role!=='jj';$('unlock-tablet').hidden=role!=='dad';
  updateControls();$('screen-message').hidden=role!=='jj';$('screen-message').textContent='Connecting to Dad’s game…';requestWake();
}
function updateControls(){
  document.body.dataset.jet=String(jetMode);
  $('jump').innerHTML=role==='michelle'?'FLY <small>TAP A</small>':'JUMP <small>A</small>';
  $('fire').innerHTML=jetMode&&role!=='dad'?'MISSILES <small>HOLD B</small>':{dad:'RUN / POWER <small>HOLD B</small>',jj:'FIRE <small>HOLD B</small>',michelle:'MAGIC <small>HOLD B</small>'}[role];
  $('control-hint').textContent=jetMode?(role==='dad'?'Fly with the joystick. Use arrows at pipes and doors.':'Aim the laser with your joystick. Hold Missiles!'):{dad:'You lead. The magic crew follows.',jj:'Drag on the game to fly. Hold Fire!',michelle:'Every jump tap lifts you higher.'}[role];
  $('move-label').textContent=jetMode?(role==='dad'?'FLY':'AIM LASER'):role==='jj'?'FLY':'MOVE';
  $('joystick').setAttribute('aria-label',jetMode&&role!=='dad'?'Aim laser joystick':'Movement joystick');
}
async function host(){
  if(busy||role)return;busy=true;
  try{
    enter('dad');notice('Loading Super Mario Bros. 3…');audio=new GameAudio({audible:false});
    const response=await fetch('roms/mario3.nes');if(!response.ok)throw new Error('Could not load the bundled game.');const rom=new Uint8Array(await response.arrayBuffer());
    if(crypto.subtle){const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',rom)),b=>b.toString(16).padStart(2,'0')).join('');if(hash!=='4377a7f5e6eb50bdd2ac6f249bf1a7085500aca8eb41f38545c3a2731c51a579')throw new Error('The bundled ROM failed its integrity check.');}
    engine=new CoopEngine(rom,{NES,onAudio:(l,r,p)=>{if(p===0)audio?.push(l,r);}});kids=new Companions(engine);
    let saved;try{saved=await storage.get('save');}catch{notice('Browser storage is unavailable. This session will not autosave.');}
    if(saved){try{engine.restore(saved);}catch{saved=null;}}
    if(!saved){const response=await fetch('start.json');if(!response.ok)throw new Error('Could not load the starting map.');engine.nes[0].fromJSON(await response.json());}
    engine.weapons.equipped=[0,0];engine.resetWorld();engine.step();kids.step();draw();
    connection=makeConnection(roomCode());connection.start();
    media=canvas.captureStream(0);
    if(!media.getVideoTracks()[0]?.requestFrame){media.getTracks().forEach(track=>track.stop());media=canvas.captureStream(30);}
    lastVideoFrame=0;draw();audio.destination?.stream.getAudioTracks().forEach(track=>media.addTrack(track));connection.setStream(media);
    last=0;raf=requestAnimationFrame(tick);broadcast();notice(saved?'Saved adventure restored.':'Ready! Move right, then up to World 1–1 and press Jump.');
  }catch(error){leave();notice(error.message);}finally{busy=false;}
}
async function join(event){
  event.preventDefault();if(role||busy)return;const code=normalizeCode($('code-input').value);if(!validCode(code)){notice('Enter Dad’s two-letter code, like AB.');return;}
  try{enter(selected);$('room-code').textContent=code;connection=makeConnection(code);connection.start();}catch(error){leave();notice(error.message);}
}
async function save(announce=true){if(!engine)return;try{await storage.put('save',engine.snapshot());if(announce)notice('Adventure saved on Dad’s device.');}catch{notice('Save failed. Browser storage may be full or unavailable.');}}
async function load(){if(!engine)return;try{const saved=await storage.get('save');if(!saved){notice('No saved adventure on this device yet.');return;}engine.restore(saved);engine.weapons.equipped=[0,0];engine.resetWorld();learning.skip();kids.reset({keepJet:true});clearInput();broadcast();notice('Saved adventure loaded.');}catch(error){notice('Could not load save: '+error.message);}}
function leave(){
  kidLock.unlock();
  if(engine)save(false);clearInput();cancelAnimationFrame(raf);connection?.close();media?.getTracks().forEach(t=>t.stop());audio?.close();wakeLock?.release().catch(()=>{});stopQuestionAudio();quiz.render(null);quiz.setConnected(true);
  $('remote-video').srcObject=null;role=null;engine=null;kids=null;connection=null;audio=null;media=null;remoteQuiz=null;learning.skip();accumulator=0;localSound=false;jetMode=false;delete document.body.dataset.jet;
  delete document.body.dataset.role;$('lobby').hidden=false;$('play').hidden=true;$('sound').textContent='Sound on';
}
for(const button of document.querySelectorAll('[data-role]'))button.onclick=()=>{
  if(button.dataset.role==='dad'){host();return;}selected=button.dataset.role;
  document.querySelectorAll('[data-role]').forEach(b=>b.classList.toggle('selected',b===button));$('join-form').hidden=false;$('code-input').focus();
};
$('join-form').onsubmit=join;$('questions').onclick=()=>startQuestions();$('jet').onclick=()=>startQuestions('jet');$('skip').onclick=skip;$('quiz-skip').onclick=skip;$('save').onclick=()=>save();$('load').onclick=load;$('leave').onclick=leave;
$('regroup').onclick=()=>{if(kids){for(const k of Object.values(kids.kids)){kids.release(k.role);kids.regroup(k);}notice('The crew is back beside Mario.');}};
$('update-game').onclick=async()=>{
  if(engine){engine.paused=true;clearInput();try{await storage.put('save',engine.snapshot());}catch{notice('Could not save. Update cancelled so your adventure stays open.');engine.paused=false;return;}}
  const url=new URL(location.href);url.searchParams.set('update',Date.now());location.replace(url.href);
};
$('new-game').onclick=async()=>{if(!engine||!confirm('Start again at World 1? Your next save will replace the current saved adventure.'))return;try{const response=await fetch('start.json');engine.nes[0].fromJSON(await response.json());engine.forms.reset();engine.resetWorld();kids.reset();learning.skip();engine.paused=false;clearInput();broadcast();}catch{notice('Could not load the starting map.');}};
$('sound').onclick=()=>{localSound=!localSound;if(role==='dad'){audio?.resume();if(audio?.gain)audio.gain.gain.value=localSound?1:0;}else{$('remote-video').muted=!localSound;$('remote-video').play().catch(()=>{});}$('sound').textContent=localSound?'Sound off':'Sound on';};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{notice('Use your browser’s full-screen option.');}};
$('unlock-tablet').onclick=()=>{if(connection?.has('jj')){connection.send({type:'unlock-tablet'},'jj');notice('JJ’s tablet unlocked.');}else notice('Pair JJ’s tablet first.');};
$('heart').onclick=()=>{if(role!=='michelle'||blocked()||$('heart').disabled)return;connection?.send({type:'heart'});$('heart').disabled=true;};
setInterval(()=>{if(role&&role!=='dad')sendInput();},90);
setInterval(()=>{if(role==='dad')broadcast();},500);
setInterval(()=>{if(role==='dad'&&engine&&!learning.round)save(false);},30000);
// Reuse the exact in-game drawings for the character selection and controller.
function portraits(){
  for(const id of ['portrait-jj','portrait-michelle','controller-unicorn']){const c=$(id),g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);g.save();g.translate(91,72);g.scale(3.5,3.5);if(id==='portrait-jj'){for(let i=6;i>=0;i--){g.fillStyle=i%2?'#3ab778':'#6be49f';g.beginPath();g.arc(-12-i*3,Math.sin(i*.6)*5,4-i*.3,0,Math.PI*2);g.fill();}dragon(g,8);}else unicorn(g,0);g.restore();}
  const g=$('portrait-dad').getContext('2d');g.save();g.translate(57,22);g.scale(4,4);
  const sprite=['    RRRRR    ','   RRRRRRRRR ','   BBBSSBS   ','  BS BSSSBSS ','  BSBBSSSBSSS','   BSSSSBBBB ','    SSSSSSS  ','   RRURRRU   ','  RRRURRRURRR',' RRRRUUUUURRR',' SSRUYUUYURSS',' SSSUUUUUUSSS',' SSUUUUUUUUSS','   UUU  UUU  ','  BBB    BBB ',' BBBB    BBBB'];
  const colors={R:'#ed7054',B:'#654638',S:'#ffcf98',U:'#5b8cbd',Y:'#ffe397'};sprite.forEach((row,y)=>[...row].forEach((v,x)=>{if(colors[v]){g.fillStyle=colors[v];g.fillRect(x,y,1,1);}}));g.restore();
}
portraits();
const shared=new URLSearchParams(location.search).get('room');if(shared){$('code-input').value=normalizeCode(shared);$('join-form').hidden=false;}
const tabletMode=new URLSearchParams(location.search).has('tablet')||Boolean(window.FairyAndroid);
if(tabletMode)document.querySelector('[data-role="jj"]').click();
if(new URLSearchParams(location.search).get('role')==='michelle')document.querySelector('[data-role="michelle"]').click();
for(const link of document.querySelectorAll('[data-zelda]')){
  const url=location.pathname.includes('/mario/')?new URL('../',location.href):new URL('https://jpdieffe.github.io/zelda_tab/');
  if(tabletMode)url.searchParams.set('tablet','1');link.href=url.href;
}
if(new URLSearchParams(location.search).has('test'))window.__family={get engine(){return engine;},get kids(){return kids;},get connection(){return connection;},learning,draw,startQuestions,skip,broadcast};
