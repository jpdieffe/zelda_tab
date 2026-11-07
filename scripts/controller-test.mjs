import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {serve} from './serve.mjs';
const server=serve(4177,'/zelda_tab/'),browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
  const page=await browser.newPage({viewport:{width:900,height:430},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4177/zelda_tab/');
  await page.evaluate(async()=>{
    window.testGame=(await import('./app.js')).game;window.inputs=[];
    testGame.role='dad';testGame.ready=true;testGame.emulator={gameManager:{simulateInput:(_,key,value)=>inputs.push({key,value})}};
    document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!=='controller');
  });
  for(const [width,height] of [[900,430],[740,360],[390,844]]){
    await page.setViewportSize({width,height});
    const b=await page.locator('.face.b').boundingBox(),stick=await page.locator('#dpad').boundingBox();
    assert.ok(b.width>=92&&b.height>=92,'Large B target');assert.ok(stick.width>=150,'Joystick remains large beside Dad’s game view');
    for(const selector of ['.face.b','.face.a','.face.x','.face.y','#dpad']){
      const r=await page.locator(selector).boundingBox();assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=width&&r.y+r.height<=height,selector+' within screen');
    }
    await page.screenshot({path:`test-results/controller-joystick-${width}.png`});
  }
  await page.setViewportSize({width:900,height:430});
  const r=await page.locator('#dpad').boundingBox(),x=r.x+45,y=r.y+65;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+4,y+3);
  assert.equal(await page.evaluate(()=>inputs.length),0,'Deadzone ignores thumb jitter');
  await page.mouse.move(x+50,y);assert.deepEqual(await page.evaluate(()=>inputs.at(-1)),{key:7,value:1});
  await page.mouse.move(x+50,y-50);assert.deepEqual(await page.evaluate(()=>inputs.at(-1)),{key:4,value:1});
  await page.mouse.up();assert.deepEqual(await page.evaluate(()=>inputs.slice(-2)),[{key:7,value:0},{key:4,value:0}]);
  // Real multi-touch: steering remains held while a second finger hits B.
  const cdp=await page.context().newCDPSession(page),b=await page.locator('.face.b').boundingBox();
  const touch=(id,x,y)=>({id,x,y,radiusX:5,radiusY:5});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(1,x,y)]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(1,x-45,y)]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(1,x-45,y),touch(2,b.x+b.width/2,b.y+b.height/2)]});
  assert.deepEqual(await page.evaluate(()=>inputs.slice(-2)),[{key:6,value:1},{key:0,value:1}]);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  assert.ok(await page.evaluate(()=>inputs.slice(-2).every(i=>i.value===0)),'Cancellation releases both fingers');
  await page.evaluate(()=>document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!=='unicorn-controller'));
  for(const [width,height] of [[900,430],[740,360],[390,844]]){
    await page.setViewportSize({width,height});
    for(const selector of ['#unicorn-pad','#unicorn-fire','#unicorn-heal','#unicorn-bomb']){
      const r=await page.locator(selector).boundingBox();assert.ok(r.width>=44&&r.height>=44);assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=width&&r.y+r.height<=height,selector+' within screen');
    }
    await page.screenshot({path:`test-results/michelle-layout-${width}.png`});
  }
  assert.deepEqual(errors,[]);console.log('Joystick deadzone, diagonals, release, simultaneous B and both phone layouts passed');
}finally{await browser.close();server.close();}
