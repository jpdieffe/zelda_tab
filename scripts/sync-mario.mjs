// Publish the family game below the existing APK's trusted /zelda_tab/ path.
import {cpSync,existsSync,copyFileSync} from 'node:fs';
const source=new URL('../../mario3-family/site/',import.meta.url);
if(!existsSync(source))throw Error('Expected the sibling mario3-family project.');
cpSync(source,new URL('../dist/mario/',import.meta.url),{recursive:true});
copyFileSync(new URL('../../mario3-family/THIRD_PARTY.md',import.meta.url),new URL('../dist/mario/CREDITS.md',import.meta.url));
console.log('Mario copied to dist/mario. The existing tablet APK permits this path.');
