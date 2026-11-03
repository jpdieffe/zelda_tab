import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const svg=await readFile(new URL('../dist/icon.svg',import.meta.url),'utf8');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
  for(const size of [192,512]){
    const page=await browser.newPage({viewport:{width:size,height:size},deviceScaleFactor:1});
    await page.setContent(`<style>body{margin:0;background:#102c29;display:grid;place-items:center;height:100vh}svg{width:70%;height:70%}</style>${svg}`);
    await page.screenshot({path:fileURLToPath(new URL(`../dist/assets/icon-${size}.png`,import.meta.url))});await page.close();
  }
}finally{await browser.close();}
