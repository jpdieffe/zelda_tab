// Run against an isolated emulator with the --debug APK installed.
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {serve} from './serve.mjs';
const serial=process.env.FAIRY_ANDROID_SERIAL||'emulator-5580';
const adb=(...args)=>execFileSync('adb',['-s',serial,...args],{encoding:'utf8'}).trim();
const delay=ms=>new Promise(r=>setTimeout(r,ms));
adb('shell','am','start','-n','com.jpdieffe.fairylink/.MainActivity');
const pid=adb('shell','pidof','com.jpdieffe.fairylink');
adb('forward','tcp:9223',`localabstract:webview_devtools_remote_${pid}`);
const targets=await (await fetch('http://127.0.0.1:9223/json')).json();
const target=targets.find(t=>t.type==='page');assert.ok(target,'App WebView exists');
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map();
const cdp=(method,params={})=>new Promise((resolve,reject)=>{
  const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error('CDP timeout: '+method));},30000);
  pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));
});
ws.onmessage=async event=>{
  const message=JSON.parse(event.data),p=pending.get(message.id);
  if(p){clearTimeout(p.timer);pending.delete(message.id);message.error?p.reject(Error(JSON.stringify(message.error))):p.resolve(message.result);}
  if(message.method==='Fetch.requestPaused'){
    const {requestId,request}=message.params;
    try{
      const url=new URL(request.url),name=url.pathname.slice('/zelda_tab/'.length)||'index.html';
      const body=await readFile(new URL('../dist/'+name,import.meta.url));
      const mime=name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.svg')?'image/svg+xml':name.endsWith('.png')?'image/png':'text/html';
      await cdp('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:mime}],body:body.toString('base64')});
    }catch{await cdp('Fetch.continueRequest',{requestId});}
  }
};
const js=async expression=>{const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const until=async(fn,message)=>{for(let i=0;i<100;i++){if(await fn())return;await delay(250);}throw Error(message);};
const results=new URL('../test-results/',import.meta.url);await mkdir(results,{recursive:true});
let browser,server;
try{
  // Serve current workspace assets at the real trusted HTTPS origin to test
  // the exact release JS together with the native bridge before publication.
  await cdp('Fetch.enable',{patterns:[{urlPattern:'https://jpdieffe.github.io/zelda_tab/*',requestStage:'Request'}]});
  await cdp('Page.reload',{ignoreCache:true});
  await until(()=>js(`!!document.getElementById('kid-system-status') && !!document.getElementById('kid-lock').onclick`),'Current game did not load');
  assert.equal(await js('typeof FairyAndroid.setLocked'),'function');
  if(!process.argv.includes('--media-only')){
  await js(`document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!=='tablet');document.getElementById('kid-lock').click()`);
  await delay(1500);
  adb('shell','uiautomator','dump','/sdcard/fairy-window.xml');
  const xml=adb('shell','cat','/sdcard/fairy-window.xml');await writeFile(new URL('android-pin-dialog.xml',results),xml);
  const node=(xml.match(/<node\b[^>]*>/g)||[]).find(n=>/text="(?:Start|Pin|Got it|OK)"/i.test(n));
  assert.ok(node,'Android pin confirmation found; see android-pin-dialog.xml');
  const [,x1,y1,x2,y2]=node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/).map(Number);
  adb('shell','input','tap',String(Math.round((x1+x2)/2)),String(Math.round((y1+y2)/2)));
  await until(()=>js('FairyAndroid.isPinned()'),'Android did not enter pinned mode');
  await until(()=>js(`document.getElementById('kid-system-status').textContent==='Android buttons locked'`),'Pin state not reflected in UI');
  for(const [name,key] of [['Back','4'],['Home','3'],['Recents','187']]){
    adb('shell','input','keyevent',key);await delay(500);
    assert.equal(await js('FairyAndroid.isPinned()'),true,name+' preserves pinning');
    assert.match(adb('shell','dumpsys','activity','activities'),/topResumedActivity=.*com\.jpdieffe\.fairylink/,name+' leaves game in foreground');
    assert.equal(await js(`document.getElementById('tablet').classList.contains('kid-locked')`),true);
  }
  const screenshot=await cdp('Page.captureScreenshot');await writeFile(new URL('android-pinned.png',results),Buffer.from(screenshot.data,'base64'));
  await js(`document.getElementById('kid-unlock').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);
  await until(async()=>!(await js('FairyAndroid.isPinned()')),'Parent hold did not release native pinning');
  assert.equal(await js(`document.getElementById('tablet').classList.contains('kid-locked')`),false);
  console.log('Android APK verified: real pin confirmation, Back/Home/Recents blocked, live pin status and parent unlock passed.');
  }
  server=serve(4178);
  // The emulator NAT cannot discover the host's multicast .local names.
  // Expose direct host candidates only in this isolated test browser.
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required','--disable-features=WebRtcHideLocalIpsWithMdns']});
  const phone=await browser.newPage();await phone.goto('http://localhost:4178');
  const code=await phone.evaluate(async()=>{
    const {Connection,roomCode}=await import('./network.js');const code=roomCode();
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=448;document.body.append(canvas);
    const ctx=canvas.getContext('2d');window.paint=setInterval(()=>{ctx.fillStyle='#55aa66';ctx.fillRect(0,0,512,448);},30);
    const stream=canvas.captureStream(30),audio=new AudioContext(),out=audio.createMediaStreamDestination(),osc=audio.createOscillator();osc.connect(out);osc.start();
    stream.addTrack(out.stream.getAudioTracks()[0]);window.received=[];
    window.host=new Connection({role:'dad',code,onStatus:m=>window.hostStatus=m,onData:m=>received.push(m)});host.start();host.setStream(stream);return code;
  });
  await phone.waitForFunction(()=>host.peer?.open);
  await js(`document.getElementById('tablet-leave').click();document.getElementById('join-code').value=${JSON.stringify(code)};document.getElementById('join-form').requestSubmit()`);
  try{await until(()=>js(`document.getElementById('video').readyState>=2`),'Android did not receive WebRTC video');}
  catch(e){
    console.log('Android diagnostics',await js(`import('./app.js').then(({game})=>({status:document.getElementById('join-status').textContent,peer:game.network?.peer?.open,data:game.network?.connection?.open,ice:game.network?.connection?.peerConnection?.iceConnectionState,media:game.network?.call?.peerConnection?.iceConnectionState,video:document.getElementById('video').readyState}))`));
    console.log('Phone diagnostics',await phone.evaluate(()=>({status:hostStatus,peer:host.peer?.open,data:host.connection?.open,ice:host.connection?.peerConnection?.iceConnectionState,media:host.call?.peerConnection?.iceConnectionState})));
    throw e;
  }
  assert.deepEqual(await js(`(()=>{const v=document.getElementById('video'),c=document.createElement('canvas');c.width=1;c.height=1;const ctx=c.getContext('2d');ctx.drawImage(v,0,0,1,1);return {width:v.videoWidth,audio:v.srcObject.getAudioTracks().length};})()`),{width:512,audio:1});
  await js(`import('./app.js').then(({game})=>game.network.send({type:'fire'}))`);
  await phone.waitForFunction(()=>received.some(m=>m.type==='fire'));
  console.log('Android WebView received live WebRTC video/audio and returned fairy input to the phone.');
}finally{await browser?.close();server?.close();ws.close();adb('forward','--remove','tcp:9223');}
