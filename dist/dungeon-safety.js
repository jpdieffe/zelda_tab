const word=(r,a)=>r[a]|r[a+1]<<8;
const put=(r,a,v)=>{r[a]=v&255;r[a+1]=v>>8;};
export function roomBounds(r){const room=word(r,0xa0);return {left:(room&15)*512,top:(room>>4)*512,right:(room&15)*512+512,bottom:(room>>4)*512+512};}
export function inLoadedRoom(r,x=word(r,0x22)+8,y=word(r,0x20)+8,margin=0){
  if(!r[0x1b])return true;
  const b=roomBounds(r);return x>=b.left+margin&&x<b.right-margin&&y>=b.top+margin&&y<b.bottom-margin;
}
export function canRecoverDungeon(r){return !!r&&!!r[0x1b]&&r[0xf36d]>0&&r[0x10]===7&&r[0x10e]<133&&word(r,0xa0)<0x140;}
// Mirror_SaveRoomData / Module07_19_MirrorFade in the pinned USA game.
// Reload the entrance through Zelda so room graphics, collisions, camera,
// layers and quadrant bounds are rebuilt together. Never just move Link.
export function recoverDungeon(r){
  if(!canRecoverDungeon(r))return false;
  const room=word(r,0xa0),palace=r[0x40c];
  put(r,0xf000+room*2,(word(r,0x402)>>4)|(word(r,0x400)&0xf000)|word(r,0x408));
  if(palace<=26&&!(palace&1))r[0xf37c+(palace===2?0:palace>>1)]=r[0xf36f];
  for(const a of [0x2e4,0x4b,0x37b,0x31f,0x5d,0x373,0x46,0x4d,0x30,0x31,0x27,0x28,0x6c,0x114,0x115,0xffc])r[a]=0;
  r[0x5fc]=r[0x5fd]=0;r[0x13]=15;r[0x11]=25;r[0xb0]=0;r[0x12e]=51;
  return true;
}
