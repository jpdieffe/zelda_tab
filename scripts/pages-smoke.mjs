import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const remote = process.argv[2];
const server = remote ? null : serve(4175, '/zelda_tab/');
const url = remote || 'http://localhost:4175/zelda_tab/';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 430 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const response = await page.goto(url);
  assert.equal(response.status(), 200);
  assert.equal(await page.locator('#rom').count(), 0);
  await page.evaluate(async base => { window.testGame = (await import(new URL('app.js',base).href)).game; }, url);
  await page.locator('#choose-dad').click();
  await page.waitForFunction(() => window.testGame.ready, {}, { timeout: 90000 });
  assert.equal(await page.locator('#controller').isVisible(), true);
  assert.match(await page.locator('#bridge-status').textContent(), /Fairy ready/);
  assert.equal(await page.evaluate(() => typeof window.Peer), 'function');
  for (const asset of ['app.js','style.css','zelda.js','fairy.js','unicorn.js','unicorn.svg','joystick.js','guidance.js','collision.js','network.js','storage.js','vendor/peerjs.min.js','assets/alttp-usa.sfc']) {
    const response = await page.request.get(new URL(asset, url).href);
    assert.equal(response.status(), 200, asset);
  }
  await page.goto(new URL('#join=ABCDEFGH', url).href);
  await page.reload();
  assert.equal(await page.locator('#jj-setup').isVisible(), true);
  assert.equal(await page.locator('#join-code').inputValue(), 'ABCDEFGH');
  assert.deepEqual(errors, []);
  console.log('Bundled Zelda booted without a file picker; live memory, assets and tablet pairing link passed:', url);
} finally {
  await browser.close();
  server?.close();
}
