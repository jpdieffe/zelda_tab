// Run only on an isolated emulator. Never installs or tests on a physical tablet.
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {serve} from './serve.mjs';
const serial=process.env.MARIO_ANDROID_SERIAL||'emulator-5582';
if(!/^emulator-\d+$/.test(serial))throw Error('This test requires an isolated emulator.');
const adb=(...args)=>execFileSync('adb',['-s',serial,...args],{encoding:'utf8'}).trim();
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const until=async(fn,message)=>{for(let i=0;i<120;i++){if(await fn())return;await delay(250);}throw Error(message);};
adb('shell','am','start','-n','com.jpdieffe.fairylink/.MainActivity');
let pid;await until(()=>{try{pid=adb('shell','pidof','com.jpdieffe.fairylink');return !!pid;}catch{return false;}},'App did not start');
adb('forward','tcp:9225',`localabstract:webview_devtools_remote_${pid}`);
let target;await until(async()=>{try{target=(await (await fetch('http://localhost:9225/json')).json()).find(t=>t.type==='page');return target;}catch{return false;}},'No WebView');
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
let id=0;const pending=new Map();
const cdp=(method,params={})=>new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error('CDP timeout: '+method));},20000);pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));});
ws.onmessage=async event=>{const m=JSON.parse(event.data),p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}
  if(m.method==='Fetch.requestPaused'){const {requestId,request}=m.params;try{const name=new URL(request.url).pathname.slice('/zelda_tab/'.length)||'index.html';const file=name.endsWith('/')?name+'index.html':name;const body=await readFile(new URL('../dist/'+file,import.meta.url));const mime=file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.json')?'application/json':file.endsWith('.png')?'image/png':'text/html';await cdp('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:mime}],body:body.toString('base64')});}catch{await cdp('Fetch.continueRequest',{requestId});}}
};
const js=async expression=>{const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const results=new URL('../test-results/',import.meta.url);await mkdir(results,{recursive:true});
const shot=async name=>{const result=await cdp('Page.captureScreenshot');await writeFile(new URL(name,results),Buffer.from(result.data,'base64'));};
let browser,server;
try{
  await cdp('Fetch.enable',{patterns:[{urlPattern:'https://jpdieffe.github.io/zelda_tab/*',requestStage:'Request'}]});await cdp('Page.navigate',{url:'https://jpdieffe.github.io/zelda_tab/?tablet=1'});
  await until(()=>js(`!!document.querySelector('#jj-setup .game-switch')&&!document.getElementById('jj-setup').hidden`),'Zelda setup did not load');
  await js(`document.querySelector('#jj-setup .game-switch').click()`);
  await until(()=>js(`location.pathname.endsWith('/mario/')&&!!document.getElementById('kid-lock')?.onclick`),'Native app did not allow switching to Mario');
  assert.equal(await js('typeof FairyAndroid.setLocked'),'function');
  assert.equal(await js('document.getElementById("join-form").hidden'),false);
  console.log('PASS existing APK opens Mario from Zelda and retains the native lock bridge');
  server=serve(4188,'/zelda_tab/');browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required','--disable-features=WebRtcHideLocalIpsWithMdns']});
  const phone=await browser.newPage({viewport:{width:900,height:440}});await phone.goto('http://localhost:4188/zelda_tab/mario/?test=1');await phone.locator('[data-role=dad]').click();
  await phone.waitForFunction(()=>window.__family?.connection?.peer?.open,null,{timeout:30000});
  await phone.evaluate(()=>{const e=window.__family.engine,run=n=>{for(let i=0;i<n;i++)e.step();},press=(m,n)=>{e.input(0,m);run(n);e.input(0,0);run(20);};press(128,20);press(16,20);press(1,2);run(180);window.__family.kids.step();window.__family.draw();e.paused=true;});
  assert.equal(await phone.evaluate(()=>window.__family.engine.nes[0].cpu.mem[0x70a]),1,'Keep Mario safely paused in World 1-1 while testing Android dialogs');
  const code=await phone.locator('#room-code').textContent();await js(`document.getElementById('code-input').value=${JSON.stringify(code)};document.getElementById('join-form').requestSubmit()`);
  await until(()=>js(`document.getElementById('remote-video').videoWidth>0`),'Android did not receive Mario video');
  assert.equal(await js(`document.getElementById('remote-video').srcObject.getAudioTracks().length`),1);
  await js(`document.getElementById('sound').click();document.getElementById('kid-lock').click()`);await delay(1200);
  adb('shell','uiautomator','dump','/sdcard/mario-pin.xml');const xml=adb('shell','cat','/sdcard/mario-pin.xml');await writeFile(new URL('mario-pin-dialog.xml',results),xml);
  const node=(xml.match(/<node\b[^>]*>/g)||[]).find(n=>/text="(?:Start|Pin|Got it|OK)"/i.test(n));assert.ok(node,'Android pin confirmation must appear');
  const [,x1,y1,x2,y2]=node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/).map(Number);adb('shell','input','tap',String((x1+x2)>>1),String((y1+y2)>>1));
  await until(()=>js('FairyAndroid.isPinned()'),'Android did not pin');await until(()=>js(`document.getElementById('kid-system-status').textContent==='Android buttons locked'`),'Pin status missing');
  for(const [name,key] of [['Back','4'],['Home','3'],['Recents','187']]){adb('shell','input','keyevent',key);await delay(400);assert.equal(await js('FairyAndroid.isPinned()'),true);assert.match(adb('shell','dumpsys','activity','activities'),/topResumedActivity=.*com\.jpdieffe\.fairylink/,name+' must keep the app in front');assert.equal(await js(`location.pathname.endsWith('/mario/')`),true);}
  await shot('android-mario-pinned.png');console.log('PASS Mario video/audio in the existing APK; real Android pin confirmation; Back/Home/Recents blocked');
  const fire=await js(`(()=>{const r=document.getElementById('fire').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[fire]});await phone.waitForFunction(()=>window.__family.kids.kids.jj.mask===2);await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await phone.waitForFunction(()=>window.__family.kids.kids.jj.mask===0);
  await phone.evaluate(()=>{window.__family.engine.paused=false;window.__family.broadcast();});
  await phone.locator('#questions').click();await until(()=>js(`!document.getElementById('quiz-panel').hidden`),'Question screen did not arrive');assert.equal(await js('FairyAndroid.isPinned()'),true);await phone.locator('#skip').click();
  await phone.evaluate(()=>{window.__family.engine.paused=true;});
  console.log('PASS locked tablet still fires, releases input, and receives question rounds');
  await js(`document.getElementById('kid-unlock').click()`);assert.equal(await js('FairyAndroid.isPinned()'),true);
  await js(`document.getElementById('kid-unlock').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);await delay(500);await js(`document.getElementById('kid-unlock').dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',bubbles:true}))`);await delay(2800);assert.equal(await js('FairyAndroid.isPinned()'),true);
  await js(`document.getElementById('kid-unlock').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);await until(async()=>!await js('FairyAndroid.isPinned()'),'Parent hold did not unpin');
  assert.equal(await js(`document.body.classList.contains('kid-locked')`),false);
  console.log('PASS short/cancelled holds stay locked; three-second parent hold unpins Android');
  // Standard Android pinning may remember the confirmation; accept it again if shown.
  await js(`document.getElementById('kid-lock').click()`);await delay(800);
  if(!await js('FairyAndroid.isPinned()')){adb('shell','uiautomator','dump','/sdcard/mario-pin.xml');const xml2=adb('shell','cat','/sdcard/mario-pin.xml');const n=(xml2.match(/<node\b[^>]*>/g)||[]).find(n=>/text="(?:Start|Pin|Got it|OK)"/i.test(n));assert.ok(n);const [,a,b,c,d]=n.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/).map(Number);adb('shell','input','tap',String((a+c)>>1),String((b+d)>>1));}
  await until(()=>js('FairyAndroid.isPinned()'),'Second pin failed');await phone.locator('#unlock-tablet').click();await until(async()=>!await js('FairyAndroid.isPinned()'),'Dad remote unlock failed');
  await js(`document.getElementById('leave').click();document.querySelector('[data-zelda]').click()`);await until(()=>js(`location.pathname==='/zelda_tab/'&&!!document.getElementById('jj-setup')&&!document.getElementById('jj-setup').hidden`),'Return to Zelda failed');
  console.log('PASS Dad remote unlock releases Android pinning; app switches back to Zelda');
}finally{
  try{await js('FairyAndroid.setLocked(false);FairyAndroid.stopSpeech()');}catch{}
  await browser?.close();server?.close();ws.close();for(const p of pending.values())clearTimeout(p.timer);adb('forward','--remove','tcp:9225');
}
