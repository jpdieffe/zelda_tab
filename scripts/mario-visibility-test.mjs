import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {serve} from './serve.mjs';

const base=process.env.MARIO_TEST_URL||'http://127.0.0.1:4188/mario/';
const form=process.env.MARIO_TEST_FORM||'enemy-72';
const server=process.env.MARIO_TEST_URL?null:serve(4188);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const errors=[];
try{
  const host=await browser.newPage(),tablet=await browser.newPage();
  for(const page of [host,tablet])page.on('pageerror',error=>errors.push(error.message));
  const url=new URL(base);url.searchParams.set('test','1');
  await host.goto(url.href);await host.locator('[data-role=dad]').click();
  await host.waitForFunction(()=>window.__family?.engine&&window.__family?.connection);
  assert.equal(await host.locator('#game-version').textContent(),'Nov 19 - Squid v3');
  assert.equal(await host.evaluate(()=>document.querySelector('#game').getContext('2d').getContextAttributes().willReadFrequently),true);
  await host.evaluate(form=>{
    const {engine:e,kids}=window.__family;
    for(const [mask,count]of [[128,20],[0,20],[16,20],[0,20],[1,2],[0,180]]){e.input(0,mask);for(let i=0;i<count;i++)e.step();}
    kids.step();kids.heartFormBag=[form];if(!kids.deliverHeartPower())throw Error('Gift not delivered');
    for(let i=0;i<65;i++)e.step();e.paused=true;
  },form);
  const animation=await host.evaluate(()=>{
    const {engine:e,draw}=window.__family,saved=structuredClone(e.snapshot()),canvas=document.querySelector('#game'),ctx=canvas.getContext('2d');
    const failures=[];let checked=0;
    for(const key of ['enemy-61','enemy-62','enemy-6a','blooper-baby'])for(const mask of [0,128]){
      e.restore(structuredClone(saved));e.forms.receive(key);for(let i=0;i<30;i++)e.step();e.input(0,mask);
      for(let frame=0;frame<90;frame++){
        // Keep enemies from removing the test costume while its actual ROM
        // movement, animation, collision and drawing continue running.
        e.forms.m[0x552]=120;e.step();const p=e.forms.position;
        const x=Math.max(0,Math.min(672,Math.round((p.x-p.cameraX-8)*3))),y=Math.max(0,Math.min(576,Math.round((p.y-p.cameraY-8)*3)));
        const hidden=e.nes[0].hideMario;e.nes[0].hideMario=false;draw();const bg=ctx.getImageData(x,y,96,144).data;
        e.nes[0].hideMario=hidden;draw();const out=ctx.getImageData(x,y,96,144).data;
        let count=0;for(let i=0;i<out.length;i+=4)if(Math.abs(out[i]-bg[i])+Math.abs(out[i+1]-bg[i+1])+Math.abs(out[i+2]-bg[i+2])>70)count++;
        if(count<100)failures.push({key,mask,frame,count,hidden,dead:e.forms.m[241]});checked++;
      }
    }
    e.restore(saved);e.paused=false;e.step();e.paused=true;draw();return {checked,failures};
  });
  assert.deepEqual(animation.failures,[]);
  console.log(`PASS all four squid variants remain visible in ${animation.checked} running idle/walking frames`);
  // Compare the rendered sprite against the same frame with only its overlay
  // hidden. This fails on the old blink branch, even with a frozen standing pose.
  const samples=await host.evaluate(()=>{
    const {engine:e,draw}=window.__family,g=e.forms,c=document.querySelector('#game'),ctx=c.getContext('2d');
    const p=g.position,x=Math.round((p.x-p.cameraX-4)*3),y=Math.round((p.y-p.cameraY+12)*3),w=72,h=66;
    e.nes[0].hideMario=false;draw();const background=ctx.getImageData(x,y,w,h).data;
    e.nes[0].hideMario=true;g.m[0x552]=120;
    const counts=[];let points;
    for(let frame=0;frame<16;frame++){
      g.frame=frame;draw();const pixels=ctx.getImageData(x,y,w,h).data;points=[];
      for(let i=0;i<pixels.length;i+=4){
        if(Math.abs(pixels[i]-background[i])+Math.abs(pixels[i+1]-background[i+1])+Math.abs(pixels[i+2]-background[i+2])>110)
          points.push({x:x+(i/4)%w,y:y+Math.floor(i/4/w),background:Array.from(background.slice(i,i+3))});
      }
      counts.push(points.length);
    }
    g.frame=0;draw();return {counts,points,width:c.width,height:c.height};
  });
  assert.ok(samples.counts.every(n=>n>100),`Standing enemy must remain visible through every immunity frame: ${samples.counts}`);
  assert.equal(new Set(samples.counts).size,1,'Standing enemy does not blink during damage immunity');
  console.log('PASS standing enemy remains visible across all 16 flash phases');
  await host.waitForFunction(()=>window.__family.connection.peer.open,null,{timeout:30000});
  const code=await host.locator('#room-code').textContent();
  await tablet.goto(url.href);await tablet.locator('[data-role=jj]').click();
  await tablet.locator('#code-input').fill(code);await tablet.locator('#join-form button').click();
  await tablet.waitForFunction(()=>document.querySelector('#remote-video').videoWidth>0,null,{timeout:30000});
  const visible=await tablet.evaluate(async({points,width,height})=>{
    const video=document.querySelector('#remote-video'),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true}),counts=[];
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(Error('Stationary video stopped delivering frames')),10000);
      function frame(){
        ctx.drawImage(video,0,0,width,height);const pixels=ctx.getImageData(0,0,width,height).data;
        counts.push(points.filter(p=>{const i=(p.y*width+p.x)*4;return Math.abs(pixels[i]-p.background[0])+Math.abs(pixels[i+1]-p.background[1])+Math.abs(pixels[i+2]-p.background[2])>65;}).length);
        if(counts.length>=45){clearTimeout(timeout);resolve();}else video.requestVideoFrameCallback(frame);
      }
      video.requestVideoFrameCallback(frame);
    });return counts;
  },samples);
  assert.ok(visible.every(n=>n>samples.points.length*.65),`Tablet lost stationary enemy pixels: ${visible}`);
  console.log('PASS all 45 received tablet frames contain the stationary enemy, including flash phase zero');
  // Rendering must not reset or extend the ROM's actual immunity timer.
  const remaining=await host.evaluate(()=>{
    const {engine:e}=window.__family;e.forms.m[0x552]=20;e.paused=false;
    for(let i=0;i<25;i++)e.step();e.paused=true;return e.forms.m[0x552];
  });
  assert.equal(remaining,0);
  assert.deepEqual(errors,[]);
  console.log('PASS native damage immunity still expires and browsers report no errors');
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
