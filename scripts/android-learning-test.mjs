// Explicit device opt-in. Temporarily installs the signed debug APK, exercises
// the actual question UI/native speech bridge, then restores the release APK.
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const serial=process.env.FAIRY_ANDROID_SERIAL;
if(!serial)throw Error('Set FAIRY_ANDROID_SERIAL to the test device.');
const adb=(...args)=>execFileSync('adb',['-s',serial,...args],{encoding:'utf8'}).trim();
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const until=async(fn,message)=>{for(let i=0;i<100;i++){try{if(await fn())return;}catch{}await delay(200);}throw Error(message);};
let ws,cdp,js;const pending=new Map();let id=0;
try{
  adb('shell','input','keyevent','KEYCODE_WAKEUP');
  console.log(adb('install','--no-incremental','-r','android/build/fairy-link-test.apk'));
  adb('shell','am','start','-n','com.jpdieffe.fairylink/.MainActivity');
  let pid;await until(()=>{pid=adb('shell','pidof','com.jpdieffe.fairylink');return Boolean(pid);},'Tablet app did not start');
  adb('forward','tcp:9224',`localabstract:webview_devtools_remote_${pid}`);
  let target;await until(async()=>{target=(await (await fetch('http://127.0.0.1:9224/json')).json()).find(t=>t.type==='page');return target;},'No debug WebView');
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
  cdp=(method,params={})=>new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error('CDP timeout: '+method));},15000);pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));});
  ws.onmessage=async event=>{
    const message=JSON.parse(event.data),p=pending.get(message.id);
    if(p){clearTimeout(p.timer);pending.delete(message.id);message.error?p.reject(Error(JSON.stringify(message.error))):p.resolve(message.result);}
    if(message.method==='Fetch.requestPaused'){
      const {requestId,request}=message.params;
      try{
        const name=new URL(request.url).pathname.slice('/zelda_tab/'.length)||'index.html',body=await readFile(new URL('../dist/'+name,import.meta.url));
        const mime=name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.svg')?'image/svg+xml':name.endsWith('.png')?'image/png':'text/html';
        await cdp('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:mime}],body:body.toString('base64')});
      }catch{await cdp('Fetch.continueRequest',{requestId});}
    }
  };
  js=async expression=>{const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  await cdp('Fetch.enable',{patterns:[{urlPattern:'https://jpdieffe.github.io/zelda_tab/*',requestStage:'Request'}]});
  await cdp('Page.reload',{ignoreCache:true});
  await until(()=>js("document.getElementById('quiz-next')&&typeof FairyAndroid.speak==='function'"),'Learning UI/voice bridge missing');
  await until(()=>js('!document.hidden'),'Unlock the tablet to test spoken questions');
  await js(`(async()=>{
    const {LearningRound}=await import('./learning.js'),{QuestionView}=await import('./question-view.js');
    document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!=='tablet');
    document.getElementById('tablet').classList.add('learning-active');
    document.getElementById('quiz-choices').replaceChildren();
    window.nativeQuiz=new LearningRound();
    window.nativeView=new QuestionView((token,index)=>{nativeQuiz.answer(token,index);nativeView.render(nativeQuiz.snapshot());},token=>{nativeQuiz.advance(token);nativeView.render(nativeQuiz.snapshot());});
    nativeQuiz.start({playing:true,tablet:true});nativeView.render(nativeQuiz.snapshot());
  })()`);
  await until(()=>js('FairyAndroid.isSpeaking()'),'Native voice did not start for ready screen');
  assert.equal(await js("document.getElementById('quiz-title').textContent"),'Get ready for questions');
  await until(()=>js('!FairyAndroid.isSpeaking()'),'Ready speech did not finish');
  await js("document.getElementById('quiz-next').click()");
  await until(()=>js('FairyAndroid.isSpeaking()'),'Native voice did not start for JJ');
  assert.equal(await js("document.querySelectorAll('.quiz-choice').length"),3);
  await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
  const shot=async name=>{const r=await cdp('Page.captureScreenshot');await writeFile(new URL('../test-results/'+name,import.meta.url),Buffer.from(r.data,'base64'));};
  await shot('android-letter-question.png');
  await until(()=>js('!FairyAndroid.isSpeaking()'),'JJ speech did not finish');
  await js(`(()=>{const q=nativeQuiz.round.questions[0];document.querySelectorAll('.quiz-choice')[q.choices.indexOf(q.answer)].click();document.getElementById('quiz-next').click();})()`);
  await until(()=>js('FairyAndroid.isSpeaking()'),'Native voice did not start for Michelle math');
  assert.equal(await js('nativeQuiz.round.questions[1].kind'),'math');
  await shot('android-math-question.png');
  await until(()=>js('!FairyAndroid.isSpeaking()'),'Math speech did not finish');
  await js(`(()=>{nativeQuiz.skip();nativeQuiz.start({playing:true,tablet:true});nativeQuiz.advance(nativeQuiz.token());const q=nativeQuiz.round.questions[0];nativeQuiz.answer(nativeQuiz.token(),q.choices.indexOf(q.answer));nativeQuiz.advance(nativeQuiz.token());nativeView.render(nativeQuiz.snapshot());})()`);
  await until(()=>js('FairyAndroid.isSpeaking()'),'Native voice did not start for sight word');
  assert.equal(await js('nativeQuiz.round.questions[1].kind'),'word');
  assert.equal(await js("[...document.querySelectorAll('.quiz-choice')].every(b=>b.scrollWidth<=b.clientWidth)"),true,'Sight words fit on one line');
  await shot('android-sight-word-question.png');
  await until(()=>js('!FairyAndroid.isSpeaking()'),'Sight-word speech did not finish');
  console.log('Actual Android tablet: letter, math and sight-word prompts synthesized; three-choice UI and answer handoff verified.');
}finally{
  try{if(js)await js('FairyAndroid.stopSpeech()');if(cdp)await cdp('Fetch.disable');}catch{}
  ws?.close();for(const p of pending.values())clearTimeout(p.timer);
  try{adb('forward','--remove','tcp:9224');}catch{}
  console.log(adb('install','--no-incremental','-r','dist/downloads/fairy-link-tablet.apk'));
  adb('shell','am','start','-n','com.jpdieffe.fairylink/.MainActivity');
}
