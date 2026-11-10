import {tileAttribute,romOffset} from './collision.js';
const word=(r,a)=>r[a]|r[a+1]<<8;
const put=(r,a,v)=>{r[a]=v&255;r[a+1]=v>>8;};
const SAFE=new Set([0,5,6,7,0x14,0x15,0x16,0x17,0x21,0x23,0x24,0x25,0x3a,0x3b,0x3c,0x40,0x48]);
const SPECIAL_ENTRANCES=new Map([[0,0x105],[45,0x1e4],[15,0xad],[129,0xb9]]);
export const doorAttribute=a=>a>=0x80&&a<=0xaf||a>=0xf0;
export const crushAttribute=a=>[1,2,3,4,0x26,0x27,0x43].includes(a)||a>=0x10&&a<=0x13||a>=0x18&&a<=0x1b||a>=0x50&&a<=0x56||a>=0x70&&a<=0x7f;
export class TankTerrain{
 constructor(bridge){this.bridge=bridge;this.scene=null;this.changes=new Map();this.rubble=new Map();this.floorMap=null;this.entrances=[];}
 get ram(){return this.bridge.ram;}
 attr(x,y){return tileAttribute(this.ram,this.bridge.rom,x,y);}
 mapAddress(x,y){const r=this.ram,index=(((y-word(r,0x708))&word(r,0x70a))*8)|(((x>>3)-word(r,0x70c))&word(r,0x70e));return 0x2000+(index>>1)*2;}
 enter(world){
  if(this.scene===world.scene)return;
  this.scene=world.scene;this.changes.clear();this.rubble.clear();this.entrances=[];this.floorMap=null;
  const r=this.ram,rom=this.bridge.rom;
  if(!r[0x1b]&&rom){
   for(let i=0;i<129;i++){
    const area=word(rom,romOffset(0x9bb96f)+i*2),p=word(rom,romOffset(0x9bba71)+i*2);
    if(Boolean(area&64)!==Boolean(word(r,0x8a)&64))continue;
    this.entrances.push({x:(area&7)*512+((p>>1)&63)*16+8,y:((area&56)>>3)*512+((p>>7)&63)*16+8});
   }
   const lx=word(r,0x22),ly=word(r,0x20);
   for(let radius=0;radius<=64&&this.floorMap===null;radius+=16)for(let dy=-radius;dy<=radius;dy+=16)for(let dx=-radius;dx<=radius;dx+=16){
    const x=(lx+dx)&~15,y=(ly+dy)&~15;
    if([[0,0],[8,0],[0,8],[8,8]].every(([a,b])=>SAFE.has(this.attr(x+a,y+b)))){this.floorMap=word(r,this.mapAddress(x,y));break;}
   }
  }
 }
 loaded(x,y){
  const r=this.ram,indoor=r[0x1b],left=indoor?word(r,0x22)&~511:word(r,0x70c)*8,top=indoor?word(r,0x20)&~511:word(r,0x708);
  return x>=left&&y>=top&&x<left+(indoor?512:word(r,0x70e)*8+16)&&y<top+(indoor?512:word(r,0x70a)+16);
 }
 door(x,y){
  const r=this.ram,rom=this.bridge.rom;
  if(this.loaded(x,y)){
   if(doorAttribute(this.attr(x,y)))return true;
   // Native special-area entrances use a map8 graphic instead of a door attribute.
   const trigger=SPECIAL_ENTRANCES.get(word(r,0x8a));
   if(!r[0x1b]&&rom&&trigger!==undefined&&(word(rom,romOffset(0x8f8000)+word(r,this.mapAddress(x,y))*8)&0x1ff)===trigger)return true;
  }
  return this.entrances.some(p=>Math.abs(p.x-x)<18&&Math.abs(p.y-y)<22);
 }
 blocked(x,y,world){
  // The viewport moves with the tank. Only the outer world boundary is solid.
  const limit=this.ram[0x1b]?65535:4095;if(x<8||y<8||x>limit||y>limit)return true;
  for(let dy=-14;dy<=14;dy+=7)for(let dx=-20;dx<=20;dx+=5)if(this.door(x+dx,y+dy))return true;
  return false;
 }
 remember(address,value){if(!this.changes.has(address))this.changes.set(address,this.ram[address]);this.ram[address]=value;}
 smash(x,y){
  const r=this.ram,indoor=Boolean(r[0x1b]),size=indoor?8:16;
  for(let yy=(y-10)&~(size-1);yy<=y+10;yy+=size)for(let xx=(x-16)&~(size-1);xx<=x+16;xx+=size){
   const key=xx+':'+yy;if(this.rubble.has(key)||!this.loaded(xx,yy))continue;
   let crush=false,protectedTile=false;
   for(let dy=0;dy<size;dy+=8)for(let dx=0;dx<size;dx+=8){const a=this.attr(xx+dx,yy+dy);crush ||=crushAttribute(a);protectedTile ||=this.door(xx+dx,yy+dy);}
   if(!crush||protectedTile)continue;
   if(indoor){const a=0x12000+(r[0xee]?0x1000:0)+((yy&0x1f8)<<3)+((xx&0x1f8)>>3);this.remember(a,0);}
   else{if(this.floorMap===null)continue;const a=this.mapAddress(xx,yy);this.remember(a,this.floorMap&255);this.remember(a+1,this.floorMap>>8);}
   this.rubble.set(key,{x:xx,y:yy,size,indoor});
  }
 }
 safe(x,y){
  for(const dx of [-7,0,7])for(const dy of [-5,3,10])if(!SAFE.has(this.attr(x+dx,y+dy))||this.door(x+dx,y+dy))return false;
  return true;
 }
 landing(x,y,fallback,world){
  const options=[];
  for(let dy=-160;dy<=160;dy+=8)for(let dx=-160;dx<=160;dx+=8)options.push({x:x+dx,y:y+dy,d:dx*dx+dy*dy});
  options.sort((a,b)=>a.d-b.d);
  return options.find(p=>p.x-world.cameraX>=10&&p.x-world.cameraX<=246&&p.y-world.cameraY>=44&&p.y-world.cameraY<=214&&this.safe(p.x,p.y))||fallback;
 }
 clean(action){
  const current=new Map([...this.changes.keys()].map(a=>[a,this.ram[a]]));
  try{for(const [a,v] of this.changes)this.ram[a]=v;return action();}
  finally{for(const [a,v] of current)this.ram[a]=v;}
 }
 reset(restore=true){if(restore)for(const [a,v] of this.changes)this.ram[a]=v;this.changes.clear();this.rubble.clear();this.scene=null;}
 draw(ctx,world){
  if(!world?.active||world.scene!==this.scene)return;
  ctx.save();for(const t of this.rubble.values()){
   const x=t.x-world.cameraX,y=t.y-world.cameraY;if(x< -16||x>256||y<32||y>224)continue;
   ctx.fillStyle=t.indoor?'#72563f':'#6b8941';ctx.fillRect(x,y,t.size,t.size);
   ctx.fillStyle='#c5ad85';ctx.fillRect(x+1,y+2,3,2);ctx.fillRect(x+t.size-4,y+t.size-3,3,2);
   ctx.fillStyle='#493e38';ctx.fillRect(x+4,y+5,2,2);
  }ctx.restore();
 }
}
export class TankLink{
 constructor(bridge,terrain){this.bridge=bridge;this.terrain=terrain;this.saved=null;}
 begin(world){
  const r=this.bridge.ram;if(!world?.active||!r||r[0x2e4]||r[0x5d]||r[0x4b])return false;
  // Scripted room entries can leave quadrant flags behind Link's coordinates.
  if(r[0x1b]){r[0xa9]=(word(r,0x22)>>8)&1;r[0xaa]=(word(r,0x20)>>7)&2;r[0xa8]=r[0x40e]|r[0xaa]|r[0xa9];}
  this.saved=new Map([0x2e4,0x4b,0x37b,0x31f].map(a=>[a,r[a]]));this.origin={x:word(r,0x22)+8,y:word(r,0x20)+8};return true;
 }
 hold(x,y,moving=false){
  if(!this.saved)return;const r=this.bridge.ram;
  const oldX=word(r,0x22),oldY=word(r,0x20),newX=Math.round(x-8),newY=Math.round(y-8),dx=moving?newX-oldX:0,dy=moving?newY-oldY:0;
  r[0x2e4]=1;r[0x4b]=12;r[0x37b]=1;r[0x31f]=64;r[0x373]=r[0x46]=r[0x4d]=r[0x30]=r[0x31]=r[0x27]=r[0x28]=0;
  r[0x6c]=r[0x114]=r[0x115]=0; // No stale doorway/teleport state while driving clear of doors.
  // Keep Link's physics disabled, but feed the native camera and edge handlers.
  // Browser drawing can run faster than SNES frames. Accumulate until the
  // native frame consumes it, otherwise the camera falls behind the tank.
  if(!moving||this.frame!==r[0x1a]){this.vx=0;this.vy=0;this.frame=r[0x1a];}
  this.vx+=dx;this.vy+=dy;r[0x30]=this.vy;r[0x31]=this.vx;
  r[0x67]=(this.vx<0?2:this.vx>0?1:0)|(this.vy<0?8:this.vy>0?4:0);
  if(moving&&r[0x1b])for(const [before,after,quadrant,bounds,bit] of [[oldX,newX,0xa9,0x608,1],[oldY,newY,0xaa,0x600,2]]){
   if((before>>9)===(after>>9)&&(before>>8)!==(after>>8)){
    r[quadrant]^=bit;r[0xa8]=r[0x40e]|r[0xaa]|r[0xa9];
    const delta=after>before?256:-256;for(const offset of [0,4])put(r,bounds+offset,word(r,bounds+offset)+delta);
    const flags=[8,4,2,1,12,12,3,3,10,5,10,5,15,15,15,15][(r[0xa7]<<2)+(r[0xa6]<<1)+r[0xaa]+r[0xa9]]||0;
    r[0x408]|=flags;r[0xf000+word(r,0xa0)*2]|=flags;
   }
  }
  put(r,0x22,newX);put(r,0x20,newY);
 }
 restore(x,y,world){
  if(!this.saved)return;
  const r=this.bridge.ram,p=this.terrain.landing(x,y,this.origin,world);
  for(const [a,v] of this.saved)r[a]=v;r[0x373]=r[0x46]=r[0x4d]=r[0x30]=r[0x31]=0;
  put(r,0x22,Math.round(p.x-8));put(r,0x20,Math.round(p.y-8));this.saved=null;
 }
 clean(action,x,y,world){
  return this.terrain.clean(()=>{
   const saved=this.saved,coords=[word(this.bridge.ram,0x22),word(this.bridge.ram,0x20)];
   const movement=new Map([0x30,0x31,0x67].map(a=>[a,this.bridge.ram[a]])),vx=this.vx,vy=this.vy,frame=this.frame;
   try{
    if(saved)this.restore(x,y,world);
    else if(this.terrain.changes.size){const p=this.terrain.landing(coords[0]+8,coords[1]+8,this.origin,world);put(this.bridge.ram,0x22,p.x-8);put(this.bridge.ram,0x20,p.y-8);}
    return action();
   }finally{this.saved=saved;if(saved){this.hold(coords[0]+8,coords[1]+8);for(const [a,v] of movement)this.bridge.ram[a]=v;this.vx=vx;this.vy=vy;this.frame=frame;}else{put(this.bridge.ram,0x22,coords[0]);put(this.bridge.ram,0x20,coords[1]);}}
  });
 }
}
