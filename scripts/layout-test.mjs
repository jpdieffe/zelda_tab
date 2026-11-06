import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { serve } from './serve.mjs';
const server=serve(4174);
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
try{
  for(const [name,width,height] of [['phone',390,844],['desktop',1280,900]]){
    const page=await browser.newPage({viewport:{width,height}});await page.goto('http://localhost:4174');await page.evaluate(()=>document.fonts.ready);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' horizontal overflow');
    await page.screenshot({path:fileURLToPath(new URL(`../test-results/home-${name}.png`,import.meta.url)),fullPage:true});
    await page.locator('#choose-jj').click();await page.locator('#join-code').fill('A');await page.locator('#join').click();
    assert.match(await page.locator('#join-status').textContent(),/two letters/);await page.close();
  }
  console.log('Responsive layouts and invalid-code feedback passed');
}finally{await browser.close();server.close();}
