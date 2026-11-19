import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {DungeonGuide} from '../dist/dungeon-guide.js';
import {serve} from './serve.mjs';
const fixture=JSON.parse(await readFile(new URL('../tests/fixtures/desert-east.json',import.meta.url),'utf8')),r=new Uint8Array(0x20000);
for(const [a,...bytes]of fixture.ranges)r.set(bytes,a);
let at=0x12000;for(const [value,count]of fixture.tiles){r.fill(value,at,at+count);at+=count;}
const guide=new DungeonGuide().read(r,null,{id:'desert'},1000),server=serve(4188),browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage();await page.goto('http://localhost:4188');
  await page.evaluate(async guide=>{
    const {game}=await import(document.querySelector('script[type="module"]').src);game.guidance=guide;
    document.getElementById('home').hidden=true;document.getElementById('controller').hidden=false;
  },guide);
  for(const [width,height]of [[900,500],[851,393],[390,844]]){
    await page.setViewportSize({width,height});
    const line=await page.locator('#toggle-route-line').boundingBox();assert.ok(line.x>=0&&line.y>=0&&line.x+line.width<=width&&line.y+line.height<=height);
    await page.locator('#toggle-route-line').click();assert.equal(await page.locator('#toggle-route-line').getAttribute('aria-pressed'),'false');assert.equal(await page.evaluate(()=>localStorage.getItem('route-line')),'off');
    await page.locator('#toggle-route-line').click();assert.equal(await page.locator('#toggle-route-line').getAttribute('aria-pressed'),'true');
    await page.locator('#route-guide').click();
    await page.locator('#route-panel').evaluate(e=>e.scrollTop=0);
    assert.match(await page.locator('#route-panel').textContent(),/Desert guide v2/);
    assert.equal(await page.locator('#route-next').isVisible(),false);
    const title=await page.locator('#route-title').boundingBox();assert.ok(title.y>=0&&title.y+title.height<height);
    assert.match(await page.locator('#route-destination').textContent(),/central hall/);
    await page.locator('#close-route').scrollIntoViewIfNeeded();const close=await page.locator('#close-route').boundingBox();assert.ok(close.y>=0&&close.y+close.height<=height);
    await page.locator('#close-route').click();
  }
  console.log('PASS route title, current destination, scrollable directions and close button on desktop and phone');
}finally{await browser.close();server.close();}
