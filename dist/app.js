import { ROM_SHA256, ZeldaBridge, snapshotRam } from './zelda.js';
import { Fairy, COOLDOWN } from './fairy.js';
import { Connection, roomCode, normalizeCode, validCode } from './network.js';
import * as storage from './storage.js';

const $=id=>document.getElementById(id);
export const game={role:null,network:null,emulator:null,bridge:null,fairy:null,paused:false,ready:false,saving:false,loading:false};
let gameLoader;
let wakeLock,toastTimer,autoSaveTimer,frameId,lastFrame=0,lastState=0,romUrl,stream,audioDestination,audioGains=[],phoneAudio=true,tabSound=false,wasHidden=false;
const buttons=new Map();
function show(id){document.querySelectorAll('.view').forEach(e=>e.hidden=e.id!==id);}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
function status(id,message,error=false){$(id).textContent=message;$(id).classList.toggle('error',error);}
async function awake(){try{if('wakeLock' in navigator)wakeLock=await navigator.wakeLock.request('screen');}catch{}}
async function fullScreen(){try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();await screen.orientation?.lock?.('landscape');}catch{toast('Turn your device sideways for the best view.');}await awake();}

$('choose-dad').onclick=launchBundledGame;
$('choose-jj').onclick=()=>{game.role='jj';show('jj-setup');$('join-code').focus();};
document.querySelectorAll('[data-home]').forEach(b=>b.onclick=()=>{gameLoader?.abort();gameLoader=null;game.loading=false;game.network?.close();game.network=null;show('home');});
$('about-toggle').onclick=()=>{$('about').hidden=!$('about').hidden;$('about-toggle').textContent=$('about').hidden?'How it works +':'How it works −';};
$('phone-fullscreen').onclick=fullScreen;$('tablet-fullscreen').onclick=fullScreen;
$('retry-game').onclick=launchBundledGame;

export async function validateRom(bytes){
  if(bytes.length%0x8000===512)bytes=bytes.slice(512);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!==ROM_SHA256)throw new Error('The game did not download correctly. Reload this page and try again.');
  return bytes;
}
async function launchBundledGame(){
  if(game.loading)return;
  game.role='dad';game.loading=true;show('dad-setup');$('retry-game').hidden=true;
  status('rom-status','Opening Zelda…');
  const request=new AbortController();gameLoader=request;
  try{
    const response=await fetch(new URL('./assets/alttp-usa.sfc',import.meta.url),{signal:request.signal});
    if(!response.ok)throw new Error('Could not load Zelda. Check your connection and try again.');
    const bytes=await validateRom(new Uint8Array(await response.arrayBuffer()));
    if(request.signal.aborted)return;
    await startGame(bytes);
  }catch(e){if(!request.signal.aborted){status('rom-status',e.message,true);$('retry-game').hidden=false;}}
  finally{if(gameLoader===request){gameLoader=null;game.loading=false;}}
}

function hostNetwork(){
  game.network?.close();setPhoneAudio(true);
  const code=roomCode();$('room-code').textContent=code.slice(0,4)+' '+code.slice(4);
  game.network=new Connection({role:'dad',code,
    onStatus:(message,error)=>{status('dad-status',message,error);$('dad-led').classList.toggle('on',Boolean(game.network?.connection?.open));},
    onData:data=>{
      if(data.type==='move'&&Number.isFinite(data.x)&&Number.isFinite(data.y))game.fairy?.move(data.x,data.y);
      if(data.type==='fire'&&game.ready&&!game.paused){const result=game.fairy.fire((target,fairy)=>game.bridge.hit(target,fairy));game.network.send({type:'shot',result});}
      if(data.type==='sound'){setPhoneAudio(!Boolean(data.enabled));}
      if(data.type==='video-retry')game.network.sendVideo();
    },
    onConnected:()=>{game.network.send({type:'hello',ready:game.ready});sendState();},
    onDisconnected:()=>{releaseButtons();setPhoneAudio(true);},
  });
  game.network.start();if(stream)game.network.setStream(stream);
}

async function startGame(rom){
  if(game.emulator||window.EJS_emulator){show('controller');return;}
  if(!window.isSecureContext)throw new Error('Open the HTTPS website to use phone-to-tablet play.');
  await validateRom(rom);
  game.role='dad';show('controller');await awake();
  try{hostNetwork();}catch(e){status('dad-status',e.message,true);}
  romUrl=URL.createObjectURL(new Blob([rom]));
  // The phone composites the game and fairy between emulator frames. Keep
  // the WebGL backbuffer available for drawImage/captureStream at that point.
  const originalGetContext=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,options){
    if((type==='webgl'||type==='webgl2'||type==='experimental-webgl')&&this.classList.contains('ejs_canvas')){
      return originalGetContext.call(this,type,{...options,preserveDrawingBuffer:true});
    }
    return originalGetContext.call(this,type,options);
  };
  game.restoreCanvasContext=()=>{HTMLCanvasElement.prototype.getContext=originalGetContext;};
  Object.assign(window,{
    EJS_player:'#emulator',EJS_core:'snes9x',EJS_gameUrl:romUrl,
    EJS_gameName:'Fairy-Link-ALttP-USA',EJS_pathtodata:'https://cdn.emulatorjs.org/4.2.3/data/',
    EJS_startOnLoaded:true,EJS_threads:false,EJS_disableDatabases:true,EJS_disableAutoLang:false,
    EJS_noAutoFocus:true,EJS_VirtualGamepadSettings:[],EJS_volume:.7,
    EJS_defaultOptions:{'shader':'disabled','vsync':'enabled'},EJS_Buttons:{fullscreen:false,gamepad:false,settings:false},
    EJS_onGameStart:()=>onGameStarted().catch(e=>{status('bridge-status',e.message,true);toast(e.message);}),
  });
  const script=document.createElement('script');script.src=window.EJS_pathtodata+'loader.js';
  script.onerror=()=>status('bridge-status','Could not download the emulator. Check internet and reload.',true);
  document.head.append(script);
  setTimeout(()=>{if(!game.ready)status('bridge-status','Still loading? Check internet. Reload if the game does not start.',true);},45000);
}

async function onGameStarted(){
  game.emulator=window.EJS_emulator;
  game.restoreCanvasContext?.();
  const gm=game.emulator.gameManager;
  // Let the runtime run a few frames before loading/locating RAM.
  await new Promise(resolve=>setTimeout(resolve,500));
  try{const saved=await storage.get('save');if(saved?.rom===ROM_SHA256){snapshotRam(saved.state);gm.loadState(saved.state);toast('Welcome back! Your last save is loaded.');}}catch{toast('Could not load the last save. Starting from the title screen.');}
  game.bridge=new ZeldaBridge(gm);game.fairy=new Fairy();
  let bridgeError;
  try{await game.bridge.connect();}catch(e){bridgeError=e;}
  game.ready=true;
  status('bridge-status',bridgeError?bridgeError.message:'Fairy ready · Pair JJ’s tablet to play',Boolean(bridgeError));
  const canvas=$('broadcast');stream=canvas.captureStream(60);
  const al=gm.Module.AL?.currentCtx;
  if(al?.audioCtx){
    await al.audioCtx.resume();
    audioDestination=al.audioCtx.createMediaStreamDestination();
    audioGains=Object.values(al.sources).map(source=>source.gain).filter(Boolean);
    for(const gain of audioGains)gain.connect(audioDestination);
    for(const track of audioDestination.stream.getAudioTracks())stream.addTrack(track);
  }
  game.network?.setStream(stream);
  game.network?.send({type:'hello',ready:true});
  lastFrame=performance.now();frameId=requestAnimationFrame(frame);
  autoSaveTimer=setInterval(()=>{if(game.ready&&!game.paused)saveGame(false);},30000);
}

function frame(now){
  const dt=Math.min((now-lastFrame)/1000,.05);lastFrame=now;
  if(game.ready){
    const ctx=$('broadcast').getContext('2d',{alpha:false});
    const source=game.emulator.canvas;
    const aspect=game.emulator.gameManager.getVideoDimensions('aspect')||4/3;
    const width=Math.min(source.width,source.height*aspect),height=Math.min(source.height,source.width/aspect);
    // Remove RetroArch's viewport bars so RAM positions and touch coordinates
    // share the exact 256×224 game rectangle, regardless of device pixel ratio.
    ctx.imageSmoothingEnabled=false;ctx.drawImage(source,(source.width-width)/2,(source.height-height)/2,width,height,0,0,512,448);
    const world=game.bridge?.read();
    if(!game.paused)game.fairy.update(dt,world);
    ctx.save();ctx.scale(2,2);game.fairy.draw(ctx,now);ctx.restore();
    if(!$('peek-panel').hidden){const pc=$('peek-canvas').getContext('2d');pc.imageSmoothingEnabled=false;pc.drawImage($('broadcast'),0,0);}
    if(now-lastState>100){sendState();lastState=now;}
  }
  frameId=requestAnimationFrame(frame);
}
function sendState(){game.network?.send({type:'state',ready:game.ready,paused:game.paused,active:game.fairy?.active||false,bridge:Boolean(game.bridge?.ram),target:Boolean(game.fairy?.target),cooldown:game.fairy?.cooldown||0});}
function setPhoneAudio(enabled){
  if(enabled===phoneAudio)return;phoneAudio=enabled;
  const al=game.emulator?.gameManager.Module.AL?.currentCtx;
  if(!al)return;
  // Sources feed OpenAL's master gain. The capture destination is connected
  // separately above; disconnect only the master speaker output to avoid echo.
  try{if(enabled)al.gain.connect(al.audioCtx.destination);else al.gain.disconnect(al.audioCtx.destination);}catch{}
}

function input(key,pressed){
  if(!game.ready||game.paused)return;
  game.emulator.gameManager.simulateInput(0,Number(key),pressed?1:0);
}
function press(key,source){
  if(!buttons.has(key))buttons.set(key,new Set());const set=buttons.get(key);
  if(!set.size)input(key,true);set.add(source);
  document.querySelector(`[data-key="${key}"]`)?.classList.add('pressed');
}
function release(key,source){const set=buttons.get(key);if(!set)return;set.delete(source);if(!set.size){input(key,false);buttons.delete(key);document.querySelector(`[data-key="${key}"]`)?.classList.remove('pressed');}}
function releaseButtons(){for(const key of buttons.keys()){if(game.emulator)game.emulator.gameManager.simulateInput(0,Number(key),0);}buttons.clear();padPointers.clear();document.querySelectorAll('.pressed').forEach(e=>e.classList.remove('pressed'));$('dpad').classList.remove('active');}
document.querySelectorAll('[data-key]').forEach(button=>{
  button.onpointerdown=e=>{e.preventDefault();button.setPointerCapture(e.pointerId);press(button.dataset.key,e.pointerId);};
  const up=e=>release(button.dataset.key,e.pointerId);
  button.onpointerup=up;button.onpointercancel=up;button.onlostpointercapture=up;
});
const padPointers=new Map();
function padMove(e){
  if(!padPointers.has(e.pointerId))return;
  const rect=$('dpad').getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width*2-1,y=(e.clientY-rect.top)/rect.height*2-1;
  const next=new Set();
  if(Math.hypot(x,y)>.2){if(y<-.25)next.add('4');if(y>.25)next.add('5');if(x<-.25)next.add('6');if(x>.25)next.add('7');}
  const old=padPointers.get(e.pointerId);
  for(const key of old)if(!next.has(key))release(key,e.pointerId);
  for(const key of next)if(!old.has(key))press(key,e.pointerId);
  padPointers.set(e.pointerId,next);$('dpad').classList.toggle('active',next.size>0);
}
$('dpad').onpointerdown=e=>{e.preventDefault();$('dpad').setPointerCapture(e.pointerId);padPointers.set(e.pointerId,new Set());padMove(e);};
$('dpad').onpointermove=padMove;
const padUp=e=>{for(const key of padPointers.get(e.pointerId)||[])release(key,e.pointerId);padPointers.delete(e.pointerId);$('dpad').classList.remove('active');};
$('dpad').onpointerup=padUp;$('dpad').onpointercancel=padUp;$('dpad').onlostpointercapture=padUp;
const keys={ArrowUp:'4',ArrowDown:'5',ArrowLeft:'6',ArrowRight:'7',Enter:'3',Shift:'2',z:'0',x:'8',a:'1',s:'9',q:'10',w:'11'};
window.addEventListener('keydown',e=>{if(game.role==='dad'&&game.ready&&!e.repeat&&keys[e.key]&&!['INPUT','TEXTAREA'].includes(e.target.tagName)){e.preventDefault();press(keys[e.key],'keyboard');}});
window.addEventListener('keyup',e=>{if(keys[e.key])release(keys[e.key],'keyboard');});
window.addEventListener('blur',releaseButtons);

function setPaused(paused){
  if(!game.ready)return;releaseButtons();game.paused=paused;game.emulator.gameManager.toggleMainLoop(paused?0:1);
  $('pause').textContent=paused?'Resume':'Pause';sendState();
}
$('pause').onclick=()=>setPaused(!game.paused);
$('peek').onclick=()=>{$('peek-panel').hidden=false;};$('close-peek').onclick=()=>{$('peek-panel').hidden=true;};
$('options').onclick=()=>{releaseButtons();$('phone-options').hidden=false;};$('close-options').onclick=()=>{$('phone-options').hidden=true;};
$('new-pair').onclick=()=>{hostNetwork();$('phone-options').hidden=true;toast('New pairing code is ready. Enter it on JJ’s tablet.');};
$('pair-info').onclick=async()=>{
  const url=new URL(location.href);url.hash='join='+game.network.code;
  try{await navigator.clipboard.writeText(url.href);toast('Tablet link copied. Or enter the code on JJ’s tablet.');}catch{toast('On JJ’s tablet, open this page and enter '+game.network.code);}
};
async function saveGame(notify=true){
  if(!game.ready||game.saving)return false;game.saving=true;
  try{const state=game.emulator.gameManager.getState();snapshotRam(state);await storage.put('save',{rom:ROM_SHA256,state,date:Date.now()});if(notify)toast('Adventure saved on this phone.');return true;}
  catch{toast('Could not save in this browser. Use More → Download save backup.');return false;}
  finally{game.saving=false;}
}
$('save').onclick=()=>saveGame();
$('resume-save').onclick=async()=>{
  try{const saved=await storage.get('save');if(!saved)throw new Error('No saved adventure yet.');snapshotRam(saved.state);game.emulator.gameManager.loadState(saved.state);game.fairy.scene=null;$('phone-options').hidden=true;toast('Last save loaded.');}catch(e){toast(e.message);}
};
$('export-save').onclick=()=>{
  if(!game.ready)return;const state=game.emulator.gameManager.getState();const blob=new Blob([state]);const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='jj-fairy-link-'+new Date().toISOString().slice(0,10)+'.state';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
};
$('import-save').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{if(file.size>2*1024*1024)throw new Error('This is not a Fairy Link save backup.');const state=new Uint8Array(await file.arrayBuffer());snapshotRam(state);if(!new TextDecoder().decode(state.slice(0,7)).startsWith('RASTATE'))throw new Error('Unsupported save format.');game.emulator.gameManager.loadState(state);game.fairy.scene=null;await saveGame(false);toast('Backup restored.');$('phone-options').hidden=true;}catch(e){toast(e.message);}
};
$('exit-game').onclick=async()=>{if(await saveGame(false))location.href=location.pathname;};

$('join-form').onsubmit=async e=>{
  e.preventDefault();const code=normalizeCode($('join-code').value);
  if(!validCode(code)){status('join-status','Enter the 8 letters and numbers shown on Dad’s phone.',true);return;}
  game.role='jj';game.network?.close();await awake();$('join').disabled=true;status('join-status','Finding Dad’s phone…');
  game.network=new Connection({role:'jj',code,
    onStatus:(message,error)=>{status('join-status',message,error);status('tablet-status',message,error);if(error)$('join').disabled=false;},
    onConnected:()=>{show('tablet');$('join').disabled=false;$('screen-message').hidden=false;game.network.send({type:'sound',enabled:tabSound});},
    onDisconnected:()=>{$('screen-message').hidden=false;$('screen-message').querySelector('p').textContent='Reconnecting to Dad… Keep both tabs open.';$('fire').disabled=true;},
    onStream:async media=>{$('video').srcObject=media;try{await $('video').play();$('screen-message').hidden=true;}catch{$('screen-message').querySelector('p').textContent='Tap Sound on to start the video.';}},
    onData:onTabletData,
  });
  try{game.network.start();}catch(error){status('join-status',error.message,true);$('join').disabled=false;}
};
let tabletState=null,shotHintUntil=0,moveStamp=0,videoStamp=0,lastVideoTime=-1;
function onTabletData(data){
  if(data.type==='state'){
    tabletState=data;
    $('fire').disabled=!data.ready||data.paused||!data.active||!data.bridge||data.cooldown>0;
    $('fire').classList.toggle('ready',data.target&&data.cooldown===0);
    if(data.paused){$('screen-message').hidden=false;$('screen-message').querySelector('p').textContent='A little rest. Dad will resume the adventure.';}
    else if($('video').readyState>=2)$('screen-message').hidden=true;
    if(Date.now()>shotHintUntil)$('fairy-hint').textContent=!data.bridge?'Fairy magic is unavailable — check Dad’s phone.':!data.active?'Waiting for Link’s adventure…':data.target?'A baddie is close! Send a spark!':'Tap anywhere to fly!';
  }
  if(data.type==='shot'){
    $('fairy-hint').textContent=data.result==='closer'?'Fly a little closer to a baddie!':data.result==='fired'?'Nice one, JJ! ✦':'Your magic is recharging…';shotHintUntil=Date.now()+1500;
  }
}
function moveFairy(e){
  const now=performance.now();if(e.type==='pointermove'&&now-moveStamp<25)return;moveStamp=now;
  const r=$('tap-surface').getBoundingClientRect(),x=Math.max(0,Math.min(256,(e.clientX-r.left)/r.width*256)),y=Math.max(32,Math.min(224,(e.clientY-r.top)/r.height*224));
  game.network?.send({type:'move',x,y});
  const marker=$('tap-marker');marker.hidden=false;marker.style.left=x/256*100+'%';marker.style.top=y/224*100+'%';
  clearTimeout(marker.timer);marker.timer=setTimeout(()=>marker.hidden=true,350);
}
const touches=new Set();
$('tap-surface').onpointerdown=e=>{e.preventDefault();touches.add(e.pointerId);$('tap-surface').setPointerCapture(e.pointerId);moveFairy(e);};
$('tap-surface').onpointermove=e=>{if(touches.has(e.pointerId))moveFairy(e);};
for(const name of ['onpointerup','onpointercancel','onlostpointercapture'])$('tap-surface')[name]=e=>touches.delete(e.pointerId);
$('fire').onpointerdown=e=>{e.preventDefault();if($('fire').disabled)return;game.network?.send({type:'fire'});$('fire').disabled=true;navigator.vibrate?.(20);setTimeout(()=>{if(tabletState?.active&&!tabletState.paused&&tabletState.bridge)$('fire').disabled=false;},COOLDOWN);};
$('fire').onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&!$('fire').disabled){e.preventDefault();game.network?.send({type:'fire'});}};
$('tablet-sound').onclick=async()=>{
  tabSound=!tabSound;$('video').muted=!tabSound;
  try{await $('video').play();$('tablet-sound').textContent=tabSound?'Sound off':'Sound on';game.network?.send({type:'sound',enabled:tabSound});}
  catch{tabSound=false;$('video').muted=true;toast('Tap again when the game picture arrives.');}
};
$('tablet-leave').onclick=()=>{game.network?.close();game.network=null;$('video').srcObject=null;show('jj-setup');};
setInterval(()=>{
  if(game.role!=='jj'||$('tablet').hidden||!game.network?.connection?.open)return;
  if($('video').currentTime!==lastVideoTime){lastVideoTime=$('video').currentTime;videoStamp=Date.now();}
  else if(Date.now()-videoStamp>8000){game.network.send({type:'video-retry'});videoStamp=Date.now();}
},2000);
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){releaseButtons();if(game.role==='dad'&&game.ready){wasHidden=!game.paused;saveGame(false);setPaused(true);}if(game.role==='jj')game.network?.send({type:'sound',enabled:false});}
  else{awake();if(game.role==='dad'&&wasHidden){wasHidden=false;setPaused(false);}if(game.role==='jj')game.network?.send({type:'sound',enabled:tabSound});}
});
window.addEventListener('pagehide',()=>{releaseButtons();game.network?.close();clearInterval(autoSaveTimer);cancelAnimationFrame(frameId);wakeLock?.release();});
const joinHash=new URLSearchParams(location.hash.slice(1)).get('join');
if(joinHash){game.role='jj';show('jj-setup');$('join-code').value=normalizeCode(joinHash);}
