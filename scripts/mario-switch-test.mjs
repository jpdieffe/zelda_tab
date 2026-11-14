import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {serve} from './serve.mjs';
const server=serve(4187,'/zelda_tab/'),browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1180,height:760}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4187/zelda_tab/?tablet=1');
  await page.locator('#jj-setup .game-switch').click();await page.waitForURL('**/mario/?tablet=1');
  await page.locator('#join-form').waitFor({state:'visible'});
  assert.ok(await page.locator('#join-form').isVisible());assert.ok(await page.locator('[data-role=jj]').evaluate(e=>e.classList.contains('selected')));
  await page.locator('[data-zelda]').click();await page.waitForURL('**/zelda_tab/?tablet=1');assert.ok(await page.locator('#jj-setup').isVisible());
  await page.goto('http://localhost:4187/zelda_tab/');await page.locator('#home .game-switch').click();await page.waitForURL('**/mario/');assert.ok(await page.locator('[data-role=dad]').isVisible());
  await page.locator('[data-zelda]').click();await page.waitForURL('**/zelda_tab/');
  await page.locator('#choose-michelle').click();await page.locator('#michelle-setup .game-switch').click();await page.waitForURL('**/mario/?role=michelle');await page.locator('#join-form').waitFor({state:'visible'});assert.ok(await page.locator('[data-role=michelle]').evaluate(e=>e.classList.contains('selected')));
  assert.deepEqual(errors,[]);console.log('PASS Zelda/Mario switching, return link, JJ auto-selection and Michelle role handoff');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
