import assert from 'node:assert/strict';import {chromium} from 'playwright';import {serve} from './serve.mjs';
const server=serve(4298),browser=await chromium.launch({channel:'chrome',headless:true});
try{
const page=await browser.newPage();await page.goto('http://localhost:4298');
const bytes=Array.from(new Uint8Array(0x21000));
await page.evaluate(async bytes=>{const s=await import('/storage.js'),{ROM_SHA256}=await import('/zelda.js');window.sample={rom:ROM_SHA256,state:new Uint8Array(bytes),date:1000000000000};await s.put('save',sample);for(let i=1;i<=30;i++)await s.saveAdventure({...sample,date:sample.date+i*86400000});},bytes);
await page.reload();
assert.equal(await page.evaluate(async()=>{const s=await import('/storage.js');const all=await s.adventureBackups();return all.length;}),21);
assert.ok(await page.evaluate(async()=>{const s=await import('/storage.js');const old=await s.get('save');try{await s.saveAdventure({...old,bad:()=>{}});}catch{}return (await s.get('save')).date===old.date;}),'failed save transaction retains previous adventure');
await page.evaluate(async()=>{const {ArrowPad}=await import('/arrow-pad.js');window.directions=[];new ArrowPad(document.getElementById('unicorn-pad'),v=>directions.push(v));document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!=='unicorn-controller');});
const right=page.locator('[data-direction=right]'),up=page.locator('[data-direction=up]');await right.focus();await page.keyboard.down('Space');assert.deepEqual(await page.evaluate(()=>directions.at(-1)),{x:1,y:0});await page.keyboard.up('Space');assert.deepEqual(await page.evaluate(()=>directions.at(-1)),{x:0,y:0});
const cdp=await page.context().newCDPSession(page),r=await right.boundingBox(),u=await up.boundingBox();const touch=(id,b)=>({id,x:b.x+b.width/2,y:b.y+b.height/2});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(1,r),touch(2,u)]});const diagonal=await page.evaluate(()=>directions.at(-1));assert.ok(diagonal.x>.7&&diagonal.y<-.7);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.deepEqual(await page.evaluate(()=>directions.at(-1)),{x:0,y:0});
console.log('PASS: saved history survives reload; failed writes preserve prior save; arrow buttons support keyboard, two-finger diagonals and cancellation.');
}finally{await browser.close();server.close();}
