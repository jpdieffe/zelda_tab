import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {serve} from './serve.mjs';
const remote=process.argv[2],server=remote?null:serve(4176,'/zelda_tab/');
const url=remote||'http://localhost:4176/zelda_tab/';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'?tablet=1');assert.ok(await page.locator('#jj-setup').isVisible());
  const manifest=await (await page.request.get(new URL('manifest.webmanifest',url).href)).json();
  assert.equal(manifest.display,'fullscreen');assert.equal(new URL(manifest.scope,url).pathname,'/zelda_tab/');
  for(const icon of manifest.icons){const response=await page.request.get(new URL(icon.src,url).href);assert.equal(response.status(),200);assert.equal(response.headers()['content-type'],'image/png');}
  const cdp=await page.context().newCDPSession(page);await cdp.send('Page.enable');
  const parsed=await cdp.send('Page.getAppManifest');assert.deepEqual(parsed.errors,[],'Browser parses app manifest');
  // Exercise actual app UI without starting the emulator or signalling server.
  await page.evaluate(async base=>{
    window.testGame=(await import(new URL('app.js',base).href)).game;
    window.sent=[];testGame.network={send:m=>sent.push(m),close:()=>{},connection:{open:true}};
    document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!=='tablet');
    document.getElementById('screen-message').hidden=true;document.getElementById('fire').disabled=false;
  },url);
  assert.equal(await page.locator('#tap-surface').evaluate(el=>el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))),false);
  await page.locator('#tap-surface').click({button:'right'});assert.equal(await page.evaluate(()=>sent.length),0,'Right click does not move or shoot');
  await page.locator('#kid-lock').click();await page.waitForFunction(()=>history.state?.fairyKidGuard);
  assert.equal(await page.locator('#tablet-leave').isVisible(),false);
  await page.locator('#tap-surface').click();await page.locator('#fire').click();
  assert.ok(await page.evaluate(()=>sent.some(m=>m.type==='move')&&sent.some(m=>m.type==='fire')),'Play remains interactive while locked');
  await page.evaluate(()=>new Promise(resolve=>{window.addEventListener('popstate',()=>setTimeout(resolve,0),{once:true});history.back();}));
  assert.ok(await page.evaluate(()=>history.state?.fairyKidGuard));
  assert.ok(await page.locator('#tablet').isVisible(),'Ordinary Back stays in game');
  await page.locator('#kid-unlock').click();assert.ok(await page.locator('#tablet').evaluate(e=>e.classList.contains('kid-locked')),'A short tap cannot unlock');
  const b=await page.locator('#kid-unlock').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();
  await page.waitForTimeout(500);await page.dispatchEvent('#kid-unlock','pointercancel');await page.mouse.up();await page.waitForTimeout(2700);
  assert.ok(await page.locator('#tablet').evaluate(e=>e.classList.contains('kid-locked')),'Cancelled hold cannot unlock');
  if(await page.evaluate(()=>!!document.fullscreenElement)){
    await page.evaluate(()=>document.exitFullscreen());await page.waitForFunction(()=>!document.getElementById('kid-fullscreen').hidden);
    await page.locator('#kid-fullscreen').click();await page.waitForFunction(()=>!!document.fullscreenElement);
  }
  await page.locator('#kid-unlock').click({delay:3200});
  await page.waitForFunction(()=>!history.state?.fairyKidGuard);
  assert.ok(await page.locator('#tablet-leave').isVisible(),'Holding unlock restores parent controls');
  await page.locator('#kid-lock').click();await page.locator('#kid-unlock').click({delay:3200});
  await page.waitForFunction(()=>!history.state?.fairyKidGuard);
  assert.deepEqual(errors,[]);console.log('Kid lock, right-click suppression, gameplay, Back guard, cancelled/short holds, parent hold, fullscreen recovery and app manifest passed:',url);
}finally{await browser.close();server?.close();}
