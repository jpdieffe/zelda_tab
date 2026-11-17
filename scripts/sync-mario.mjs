// Publish the family game below the existing APK's trusted /zelda_tab/ path.
import {cpSync,existsSync,copyFileSync,readFileSync,writeFileSync,readdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
const source=new URL('../../mario3-family/site/',import.meta.url);
if(!existsSync(source))throw Error('Expected the sibling mario3-family project.');
const destination=new URL('../dist/mario/',import.meta.url);
cpSync(source,destination,{recursive:true});
// Version the entire module graph, including emulator imports and the audio worklet.
// A query on app.js alone would still reuse cached, unversioned dependencies.
const hash=createHash('sha256');
function fingerprint(directory,prefix=''){
  for(const entry of readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    const name=prefix+entry.name,url=new URL(entry.name+(entry.isDirectory()?'/':''),directory);
    if(entry.isDirectory())fingerprint(url,name+'/');
    else if(/\.(js|css|html)$/.test(name))hash.update(name).update(readFileSync(url,'utf8').replace(/\r\n/g,'\n'));
  }
}
fingerprint(source);
const release='forms-120-'+hash.digest('hex').slice(0,12);
cpSync(source,new URL('releases/'+release+'/',destination),{recursive:true,filter:path=>statSync(path).isDirectory()||path.endsWith('.js')});
const html=readFileSync(new URL('index.html',source),'utf8')
  .replace('src="app.js"',`src="releases/${release}/app.js"`)
  .replace(/href="([^"]+\.css)"/g,`href="$1?v=${release}"`);
writeFileSync(new URL('index.html',destination),html);
copyFileSync(new URL('../../mario3-family/THIRD_PARTY.md',import.meta.url),new URL('../dist/mario/CREDITS.md',import.meta.url));
console.log(`Mario published files prepared: ${release}. The existing tablet APK permits this path.`);
