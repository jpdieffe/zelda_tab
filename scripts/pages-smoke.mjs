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
  await page.locator('#choose-dad').click();
  assert.equal(await page.locator('#dad-setup').isVisible(), true);
  assert.equal(await page.evaluate(() => typeof window.Peer), 'function');
  for (const asset of ['app.js','style.css','zelda.js','fairy.js','network.js','storage.js','vendor/peerjs.min.js','vendor/fflate.js']) {
    const response = await page.request.get(new URL(asset, url).href);
    assert.equal(response.status(), 200, asset);
  }
  await page.goto(new URL('#join=ABCDEFGH', url).href);
  await page.reload();
  assert.equal(await page.locator('#jj-setup').isVisible(), true);
  assert.equal(await page.locator('#join-code').inputValue(), 'ABCDEFGH');
  assert.deepEqual(errors, []);
  console.log('GitHub Pages path, assets, phone setup and tablet pairing link passed:', url);
} finally {
  await browser.close();
  server?.close();
}
