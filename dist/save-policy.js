import {snapshotRam,ROM_SHA256} from './zelda.js?v=20261124-1';
import {inLoadedRoom} from './dungeon-safety.js?v=20261124-1';
import {dungeonName} from './dungeon-guide.js?v=20261124-1';
export function validateSave(saved){
  if(saved?.rom!==ROM_SHA256)throw Error('This save belongs to a different game.');
  const state=saved.state instanceof Uint8Array?saved.state:new Uint8Array(saved.state);
  if(state.length>2*1024*1024||new TextDecoder().decode(state.slice(0,7))!=='RASTATE')throw Error('This save file is not supported.');
  snapshotRam(state);return state;
}
export function canSaveAdventure(r){return !!r&&[7,9].includes(r[0x10])&&r[0x11]===0&&r[0xf36d]>0&&inLoadedRoom(r);}
export function describeSave(saved){
  try{
    const r=snapshotRam(validateSave(saved)),hearts=r[0xf36c]/8,pendants=[1,2,4].filter(n=>r[0xf374]&n).length;
    const place=r[0x1b]?(r[0x40c]<=26?dungeonName(r):'Indoors'):'Overworld';
    return `${new Date(saved.date).toLocaleString()} — ${place} · ${hearts} hearts · ${pendants} pendant${pendants===1?'':'s'}`;
  }catch{return `${new Date(saved.date).toLocaleString()} — unreadable backup (kept)`;}
}

export async function loadVerifiedSave(manager,saved){
  const state=validateSave(saved),expected=snapshotRam(state);
  manager.loadState(state);manager.toggleMainLoop(1);
  const signature=[0xa0,0xa1,0xf340,0xf354,0xf359,0xf36c,0xf374,0xf37a,0xf3c5];
  const until=performance.now()+5000;let matchedAt=null;
  while(performance.now()<until){
    await new Promise(resolve=>setTimeout(resolve,100));
    const actual=snapshotRam(manager.getState());
    if(actual[0x10]===expected[0x10]&&signature.every(a=>actual[a]===expected[a])){matchedAt??=performance.now();if(performance.now()-matchedAt>=700)return;}else matchedAt=null;
  }
  throw Error('The emulator did not load this backup. Your stored saves are still kept.');
}
