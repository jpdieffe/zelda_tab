import {SPRITE_LAYOUTS} from './sprite-layouts.js';
import {SPRITE_PRESETS} from './sprite-presets.js';
import {LARRY_SPRITES} from './larry-sprites.js';
import {TORNADO_SPRITES} from './tornado-sprites.js';
import {WINGED_SPRITES} from './winged-sprites.js';
import {SPIKE_SPRITES} from './spike-sprites.js';
import PaletteTable from '../vendor/jsnes/ppu/palette-table.js';

const paletteTable=new PaletteTable();paletteTable.loadNTSCPalette();
const COLORS=paletteTable.curTable;
// Original World 1 sprite palette. Live copies use the target's actual palette.
const DEFAULT_PALETTE=[0x0f,0x16,0x36,0x0f,0x0f,0x0f,0x30,0x16,0x0f,0x0f,0x30,0x2a,0x0f,0x0f,0x36,0x27].map(i=>COLORS[i]);
const part=(bank,pattern,x=0,y=0,palette=3,extra={})=>({bank,pattern,x,y,palette,...extra});

export function compose(parts,facing=-1){
  if(!parts.length)return null;
  const left=Math.min(...parts.map(p=>p.x)),top=Math.min(...parts.map(p=>p.y));
  const width=Math.max(...parts.map(p=>p.x+p.width))-left,height=Math.max(...parts.map(p=>p.y+p.height))-top;
  if(width>128||height>160||width<1||height<1)return null;
  const pixels=new Uint32Array(width*height);
  // NES sprite priority: the first OAM entry wins overlapping opaque pixels.
  for(const p of [...parts].reverse())for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){
    const color=p.pixels[y*p.width+x];if(color)pixels[(p.y-top+y)*width+p.x-left+x]=color;
  }
  let x0=width,y0=height,x1=-1,y1=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(pixels[y*width+x]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
  if(x1<0)return null;
  const w=x1-x0+1,h=y1-y0+1,out=new Uint32Array(w*h);
  for(let y=0;y<h;y++)out.set(pixels.subarray((y+y0)*width+x0,(y+y0)*width+x0+w),y*w);
  return {width:w,height:h,pixels:out,facing,source:'rom',left:left+x0,top:top+y0};
}

export class SpriteLibrary {
  plantPoses=new WeakMap();
  constructor(rom){this.rom=rom;this.cache=new Map();this.observed=new Map();this.current=new Map();this.stolen=new Map();this.native=new Map(Object.entries(SPRITE_PRESETS).map(([key,sprite])=>[key,{...sprite,pixels:Uint32Array.from(sprite.pixels),frames:sprite.frames?.map(f=>({...f,pixels:Uint32Array.from(f.pixels)}))}]));}
  decode(p,palette=DEFAULT_PALETTE){
    const pixels=new Uint32Array(8*16),base=16+262144+p.bank*1024;
    for(let y=0;y<16;y++)for(let x=0;x<8;x++){
      const sy=p.vflip?15-y:y,sx=p.hflip?7-x:x;
      const address=base+(p.pattern+(sy>>3))*16+(sy&7);
      const value=((this.rom[address]>>(7-sx))&1)|(((this.rom[address+8]>>(7-sx))&1)<<1);
      if(value)pixels[y*8+x]=(palette[p.palette*4+value]|0xff000000)>>>0;
    }
    return {...p,width:8,height:16,pixels};
  }
  boomerang(age,facing=1){
    const frame=(Math.floor(age/4)&3),key=`boomerang:${frame}:${facing}`;
    if(this.cache.has(key))return this.cache.get(key);
    // Original PRG007 Boomerang_Patterns / Attributes and CHR bank $4e.
    const base=16+7*8192,flip=facing<0?0x40:0;
    const attr=this.rom[base+0x18a1+frame]^flip,index=(frame+(flip?2:0))&3;
    const parts=[0,1].map(i=>part(0x4e,this.rom[base+0x18a5+index+i*2]&0x3e,i*8,0,1,{hflip:!!(attr&64),vflip:!!(attr&128)}));
    const sprite=compose(parts.map(p=>this.decode(p)),facing);
    this.cache.set(key,sprite);return sprite;
  }
  hammer(age,facing=1){
    const frame=Math.floor(age/4)&7,key=`hammer:${frame}:${facing}`;
    if(this.cache.has(key))return this.cache.get(key);
    // PRG007 Hammer_Draw: two original 8x16 tiles and eight rotation poses.
    const base=16+7*8192,flip=facing<0?64:0;
    const attr=this.rom[base+0x1857+frame]^flip,index=(frame+(flip?4:0))&7;
    const sprite=compose([0,1].map(i=>this.decode(part(78,this.rom[base+0x185f+index+i*4]&0x3e,i*8,0,1,{hflip:!!(attr&64),vflip:!!(attr&128)}))),facing);
    this.cache.set(key,sprite);return sprite;
  }
  spikePalette(){return this.stolen.get('enemy-29')?.frames.find(f=>f.spikeBody)?.palette??SPIKE_SPRITES.palette;}
  spikePose(tick=0,spitAge=-1,palette=this.spikePalette()){
    const kind=spitAge<0?'walk':'spit',index=spitAge<0?Math.floor(tick/10)&1:Math.min(spitAge,SPIKE_SPRITES.spit.length-1);
    const key=`spike:${kind}:${index}:${palette.join(',')}`;if(this.cache.has(key))return this.cache.get(key);
    const frame=SPIKE_SPRITES[kind][index],sprite=compose(frame.parts.map(p=>this.decode(p,palette)));
    Object.assign(sprite,{frame:frame.frame,palette,spikeBody:true,source:'original-enemy-routine'});
    this.cache.set(key,sprite);return sprite;
  }
  spikeSpitBall(tick=0,palette=this.spikePalette()){
    // SObj_Spikeball rotates using bit 2 of Level_NoStopCnt (four ticks).
    return this.spikeBall(tick*2,palette);
  }
  spikeBall(tick=0,palette=DEFAULT_PALETTE){
    const flip=!!(Math.floor(tick/8)&1),key=`spikeball:${flip}:${palette.join(',')}`;
    if(this.cache.has(key))return this.cache.get(key);
    const sprite=compose([part(10,0x14,0,0,2,{vflip:flip}),part(10,0x14,8,0,2,{hflip:true,vflip:!flip})].map(p=>this.decode(p,palette)));
    this.cache.set(key,sprite);return sprite;
  }
  rotoDisc(tick=0){
    const sprite=this.native.get('enemy-5a');
    return sprite.frames?.length?sprite.frames[Math.floor(tick/6)%sprite.frames.length]:sprite;
  }
  microGoomba(){return this.default({key:'micro-goomba',specialId:6});}
  winged(form,tick=0,palette=WINGED_SPRITES[form.key].palette){
    const data=WINGED_SPRITES[form.key],index=Math.floor(Math.max(0,tick)/data.ticks)%data.frames.length;
    const key=`winged:${form.key}:${index}:${palette.join(',')}`;
    if(this.cache.has(key))return this.cache.get(key);
    const frame=data.frames[index],sprite=compose(frame.parts.map(p=>this.decode(p,palette)),frame.facing);
    Object.assign(sprite,{frame:frame.frame,palette,completeWings:true,source:'original-enemy-routine'});
    this.cache.set(key,sprite);return sprite;
  }
  tornado(tick=0,palette=DEFAULT_PALETTE){
    const data=TORNADO_SPRITES,frame=Math.floor(tick)%data.frames.length,key=`tornado:${frame}:${palette.join(',')}`;
    if(this.cache.has(key))return this.cache.get(key);
    const parts=data.frames[frame].map(([x,y,p])=>this.decode(part(83,0x16,x,y,p),palette));
    const cropped=compose(parts),pixels=new Uint32Array(data.width*data.height);
    // A fixed origin keeps the whole funnel steady as its particles revolve.
    for(let y=0;y<cropped.height;y++)pixels.set(cropped.pixels.subarray(y*cropped.width,(y+1)*cropped.width),(cropped.top+y)*data.width+cropped.left);
    const sprite={width:data.width,height:data.height,pixels,facing:-1,frame,palette,completeTornado:true,source:'original-enemy-routine'};
    this.cache.set(key,sprite);return sprite;
  }
  fireSnake(tick=0,tail=false,palette=DEFAULT_PALETTE){
    const frame=(Math.floor(tick/2)&3),key=`fire-snake:${tail}:${frame}:${palette.join(',')}`;
    if(this.cache.has(key))return this.cache.get(key);
    // PRG003 ObjP59 / Tail_DrawAndHurtPlayer, original CHR bank $0e.
    const parts=tail?[part(14,frame&1?8:10,0,0,1,{hflip:!!(frame&2)})]:
      [part(14,0x20+(frame&1)*4,0,0,1),part(14,0x22+(frame&1)*4,8,0,1)];
    const sprite=compose(parts.map(p=>this.decode(p,palette)),!tail&&(frame&2)?1:-1);
    Object.assign(sprite,{source:'original-enemy-routine',fireSnakeHead:!tail,palette,frame:frame&1});
    this.cache.set(key,sprite);return sprite;
  }
  fireSnakePalette(){return this.stolen.get('enemy-59')?.frames.find(f=>f.fireSnakeHead)?.palette??DEFAULT_PALETTE;}
  bossPose(kind,index=0){
    const frames=LARRY_SPRITES[kind],frame=frames[index%frames.length],key=`larry:${kind}:${index%frames.length}`;
    if(this.cache.has(key))return this.cache.get(key);
    const sprite=compose(frame.parts.map(p=>this.decode(p,frame.palette)),frame.facing);
    Object.assign(sprite,{frame:frame.frame,larryWalking:kind==='walk',source:'original-enemy-routine'});
    this.cache.set(key,sprite);return sprite;
  }
  bossRing(age=0){return this.bossPose('rings',Math.floor(age/6));}
  dryBonesPile(form){
    const palette=this.stolen.get(form.key)?.frames[0]?.palette??this.palette(form);
    const key=`dry-bones-pile:${palette.join(',')}`;
    if(this.cache.has(key))return this.cache.get(key);
    // Original ObjP3F frame 3: $F9, $DD, $DF in CHR bank $13.
    // DryBones_Draw lays these three sprites out at X-8, X, X+8.
    const sprite=compose([0x38,0x1c,0x1e].map((pattern,i)=>this.decode(part(19,pattern,i*8,0,2),palette)));
    this.cache.set(key,sprite);return sprite;
  }
  bone(age=0,facing=1){
    const turn=((Math.floor(age/4)*facing)%4+4)%4,key=`bone:${turn}`;
    if(this.cache.has(key))return this.cache.get(key);
    // A new attack for NES Dry Bones: pixel art in the ROM's bone colors.
    // The NES enemy has no thrown-bone object or projectile animation.
    const rows=['..##.....##..','.#ww#...#ww#.','#www#####www#','.#wwwwwwwww#.','#sss#####sss#','.#ss#...#ss#.','..##.....##..'];
    const colors={'#':COLORS[0x0f],w:COLORS[0x30],s:COLORS[0x00]},width=turn%2?7:13,height=turn%2?13:7,pixels=new Uint32Array(width*height);
    for(let y=0;y<7;y++)for(let x=0;x<13;x++){
      const color=colors[rows[y][x]];if(color===undefined)continue;
      const dx=turn===0?x:turn===1?6-y:turn===2?12-x:y,dy=turn===0?y:turn===1?x:turn===2?6-y:12-x;
      pixels[dy*width+dx]=(color|0xff000000)>>>0;
    }
    const sprite={width,height,pixels,facing:1,source:'custom-bone'};this.cache.set(key,sprite);return sprite;
  }
  layout(form,shell=false){
    const id=form.enemyId;
    if(shell&&form.shell){
      const palette=[0x6d,0x6f,0x7b].includes(id)?1:2;
      if([0x70,0x68,0x9f].includes(id))return [part(11,0x1a,0,0,3),part(11,0x1a,8,0,3,{hflip:1})];
      return [part(79,0x3c,0,0,palette),part(79,0x3c,8,0,palette,{hflip:1})];
    }
    if(id===0x0e){
      const w=form.world,bank=this.rom[16+8192+0xe72+w],address=16+8192+[0x123b,0x124d,0x125f,0x1271,0x1283,0x1295,0x12a7][w];
      return Array.from({length:6},(_,i)=>part(bank,this.rom[address+i]&0x3e,(i%3)*8,Math.floor(i/3)*16,2));
    }
    if(SPRITE_LAYOUTS[id])return SPRITE_LAYOUTS[id];
    if(id===0xb0)return [part(54,0x24,8),part(54,0x26,16),part(54,0x24,8,16,3,{vflip:1}),part(54,0x26,16,16,3,{vflip:1}),part(54,0x22,0,8),part(54,0x30,24,8)];
    if(id===0x5d)return Array.from({length:8},(_,i)=>part(83,0x16,Math.floor((i%2)*12+(7-i)/2),i*5,3));
    if(form.specialId===6)return [part(79,0x3e)];
    if(form.specialId===20)return [part(26,0x36,0,0,1)];
    return null;
  }
  palette(form){
    const pal=[...DEFAULT_PALETTE];
    if(form.world!==undefined)for(let i=0;i<4;i++)pal[8+i]=COLORS[this.rom[16+8192+0xe04+form.world*4+i]&63];
    return pal;
  }
  default(form,shell=false){
    const key=`${form.key}:${shell}`;if(this.cache.has(key))return this.cache.get(key);
    if(form.enemyId===0x29)return this.spikePose();
    if(form.winged&&!shell)return this.winged(form);
    if(form.key==='enemy-5d')return this.tornado();
    if(form.key==='enemy-59')return this.fireSnake();
    if(form.key==='koopaling-0'){
      const kind=shell?'shell':'walk',frames=LARRY_SPRITES[kind].map((_,i)=>this.bossPose(kind,i));
      const image={...frames[0],frames};this.cache.set(key,image);return image;
    }
    const native=this.native.get(shell?`${form.key}:shell`:form.key);
    if(native&&[0x78,0x79].includes(form.enemyId)){
      // A playable Bill uses one steady native body palette, not the homing
      // enemy's warning flashes. These presets already contain only its body.
      const image={...native,frames:undefined,bulletBody:true};this.cache.set(key,image);return image;
    }
    // Pipe plants' native routines also draw pipe-cover sprites. Gallery and
    // freely selected forms use their complete CHR body, without those covers.
    const pipePlant=[0xa0,0xa1,0xa2,0xa3,0xa4,0xa5,0xa6,0xa7].includes(form.enemyId);
    if(native&&!pipePlant&&form.enemyId!==0x2a){this.cache.set(key,native);return native;}
    const layout=this.layout(form,shell);let image;
    if(layout)image=compose(layout.map(p=>this.decode(p,this.palette(form))));
    else image=this.native.get(form.key)??null;
    if(image)this.cache.set(key,image);return image;
  }
  readOAM(nes,index){
    const m=nes.cpu.mem,address=0x200+index*4,y=m[address]+1,tile=m[address+1],attr=m[address+2],x=m[address+3];
    if(y>=209)return null;
    const number=tile&0xfe;
    const bank=nes.spriteChrBank?.(index,tile)??((tile&1)?m[0x71b+(number>>6)]:((number<128?m[0x719]:m[0x71a])&0xfe)+((number>>6)&1));
    return {...this.decode(part(bank,number&63,x,y,attr&3,{hflip:!!(attr&64),vflip:!!(attr&128)}),Array.from(nes.ppu.sprPalette)),index};
  }
  captureActor(game,target){
    const n=game.nes,m=game.m;
    if(target.tileEnemy)return this.captureTile(game,target);
    if(target.id===0x5d)return this.tornado(game.frame,Array.from(n.ppu.sprPalette));
    const all=Array.from({length:64},(_,i)=>this.readOAM(n,i)).filter(Boolean);
    if(target.special){
      const x=target.x-game.position.cameraX,y=target.y-game.position.cameraY;
      return compose(all.filter(p=>Math.abs(p.x-x)<9&&Math.abs(p.y-y)<10));
    }
    // Troopa_Draw advances Object_SprRAM by two entries after reserving
    // the head tip and wing. Include those original slots in live copies.
    const troopa=[0x6c,0x6d,0x6e,0x6f,0x80].includes(target.id)&&m[0x661+target.slot]===2;
    const root=(m[0x58f+target.slot]>>2)-(troopa?2:0);
    if(target.id===0x59){
      // The first two OAM entries are the head; the next four are a moving tail.
      const parts=all.filter(p=>p.index===root||p.index===root+1);
      if(m[0x661+target.slot]!==2||parts.length!==2||parts.some(p=>p.bank!==14||![0x20,0x22,0x24,0x26].includes(p.pattern)))return null;
      const sprite=compose(parts,(m[0x679+target.slot]&64)?1:-1);
      if(sprite)Object.assign(sprite,{source:'enemy-oam',fireSnakeHead:true,frame:m[0x669+target.slot],palette:Array.from(n.ppu.sprPalette)});
      return sprite;
    }
    if(target.form.key==='koopaling-0'){
      const frame=m[0x669+target.slot];
      // Keep shell, recovery, wand-swing and flashing-wand states out of walking.
      if(m[0x661+target.slot]!==2||frame>1||m[0x518+target.slot]||m[0x520+target.slot])return null;
      const parts=all.filter(p=>(p.index>=root&&p.index<root+6)||p.index===8||p.index===9);
      if(parts.length!==8||parts.some(p=>p.bank!==0x48))return null;
      const image=compose(parts,(m[0x679+target.slot]&64)?1:-1);
      if(image){image.source='enemy-oam';image.frame=frame;image.larryWalking=true;}
      return image;
    }
    if([0x78,0x79].includes(target.id)){
      // ObjNorm_BulletBill reserves root/root+1 for the launch cover and draws
      // the actual $DD/$DF body at root+2/root+3. Frame 3 is a launch effect.
      if(m[0x661+target.slot]!==2||m[0x669+target.slot]===3)return null;
      const body=all.filter(p=>p.index>=root+2&&p.index<root+4);
      if(body.length!==2||body.some(p=>p.bank!==79||![0x1c,0x1e].includes(p.pattern)))return null;
      const image=compose(body,(m[0x679+target.slot]&64)?1:-1);
      if(image){image.source='enemy-oam';image.frame=0;image.bulletBody=true;}
      return image;
    }
    // Ptooie's last two entries are its separate, controllable spike ball.
    const count=[0x29,0x9f].includes(target.id)?2:[0x2a,0x73,0x74].includes(target.id)?4:6;
    const parts=all.filter(p=>p.index>=root&&p.index<root+count);
    const layout=this.layout(target.form);
    if(target.id>=0xa0&&target.id<=0xa7&&layout){
      // Pipe cover sprites belong to the scenery. Copy the actual head OAM,
      // then restore its native CHR stem so the player controls extension.
      const headStart=target.form.plantInverted?2:0;
      const full=layout.map((p,i)=>{
        if(i<2){const head=parts.find(s=>s.index===root+headStart+i);if(head)return {...head,x:p.x,y:p.y};}
        return this.decode(p,Array.from(n.ppu.sprPalette));
      });
      const image=compose(full,(m[0x679+target.slot]&64)?1:-1);
      if(image){image.source='enemy-oam';image.frame=m[0x669+target.slot];image.completePlant=true;}
      return image;
    }
    // Large enemies can borrow extra OAM entries. Match their actual ROM tiles
    // near the body, excluding Mario and the other active actors' allocations.
    if(parts.length&&layout?.length>6){
      const claimed=new Set();
      const playerRoot=m[0x58e]>>2;for(let j=0;j<6;j++)claimed.add(playerRoot+j);
      for(let s=0;s<8;s++)if(s!==target.slot&&m[0x661+s])for(let j=0;j<6;j++)claimed.add((m[0x58f+s]>>2)+j);
      const x0=Math.min(...parts.map(p=>p.x))-8,y0=Math.min(...parts.map(p=>p.y))-8;
      const x1=Math.max(...parts.map(p=>p.x))+16,y1=Math.max(...parts.map(p=>p.y))+24;
      for(const p of all)if(!claimed.has(p.index)&&!parts.includes(p)&&p.x>=x0&&p.x<=x1&&p.y>=y0&&p.y<=y1&&layout.some(s=>s.bank===p.bank&&s.pattern===p.pattern))parts.push(p);
    }
    const image=compose(parts,(m[0x679+target.slot]&64)?1:-1);
    if(image){image.source='enemy-oam';image.frame=m[0x669+target.slot];if(troopa)image.completeTroopa=true;if(target.id===0x2a)image.ptooieBody=true;if(target.id===0x3f)image.palette=Array.from(n.ppu.sprPalette);}
    if(image&&target.form.winged){image.completeWings=true;image.palette=Array.from(n.ppu.sprPalette);}
    if(image&&target.id===0x29){image.spikeBody=true;image.palette=Array.from(n.ppu.sprPalette);}
    return image;
  }
  captureTile(game,target){
    const t=target.tile;if(!t)return this.default(target.form);
    const m=game.m,bank=[11,15,21,16,17,19,18,18,18,20,23,19,17,19,13][m[0x70a]],base=16+bank*8192;
    const parts=[];
    for(let qx=0;qx<2;qx++)for(let qy=0;qy<2;qy++){
      const tile=this.rom[base+(qx*2+qy)*256+t.value],chr=(tile<128?m[0x719]:m[0x71a])&0xfe;
      const pixels=new Uint32Array(64),address=16+262144+(chr+((tile>>6)&1))*1024+(tile&63)*16;
      for(let y=0;y<8;y++)for(let x=0;x<8;x++){
        const c=((this.rom[address+y]>>(7-x))&1)|(((this.rom[address+y+8]>>(7-x))&1)<<1);
        if(c)pixels[y*8+x]=(game.nes.ppu.imgPalette[(t.value>>6)*4+c]|0xff000000)>>>0;
      }
      parts.push({x:qx*8,y:qy*8,width:8,height:8,pixels});
    }
    return compose(parts);
  }
  observe(game){
    if(!game.inLevel)return;
    this.current.clear();
    for(const target of game.actors()){
      const image=this.captureActor(game,target);if(!image)continue;
      const token=`${target.special?'special':'actor'}:${target.slot}`;this.current.set(token,image);
      const key=target.form.key,frames=this.observed.get(key)??new Map();
      const frame=target.special?0:game.m[0x669+target.slot];
      if(frames.size<12||frames.has(frame))frames.set(frame,image);
      this.observed.set(key,frames);
    }
  }
  steal(game,target){
    const image=this.captureActor(game,target)??this.default(target.form);
    if(!image)return null;
    const frames=[image,...Array.from(this.observed.get(target.form.key)?.values()??[]).filter(f=>f.frame!==image.frame)].slice(0,12);
    const stolen={frames,start:game.frame};this.stolen.set(target.form.key,stolen);return image;
  }
  plantPose(image,form,extension){
    if(!image||extension>=1)return image;
    const horizontal=form.plantAxis==='x',full=horizontal?image.width:image.height;
    const head=Math.min(full,[0x7d,0x7f].includes(form.enemyId)?24:16);
    const length=Math.round(head+(full-head)*Math.max(0,extension));
    let poses=this.plantPoses.get(image);if(!poses){poses=new Map();this.plantPoses.set(image,poses);}
    if(poses.has(length))return poses.get(length);
    const width=horizontal?length:image.width,height=horizontal?image.height:length;
    const start=(horizontal?image.facing===1:form.plantInverted)?full-length:0;
    const pixels=new Uint32Array(width*height);
    // Retract the stem; retain the head's original pixels without stretching.
    for(let y=0;y<height;y++)for(let x=0;x<width;x++)pixels[y*width+x]=image.pixels[(y+(horizontal?0:start))*image.width+x+(horizontal?start:0)];
    const result={...image,width,height,pixels};poses.set(length,result);return result;
  }
  image(form,tick=0,{shell=false,collapsed=false,walk=false,extension=1,spitAge=-1}={}){
    if(form.enemyId===0x29)return this.spikePose(walk?tick:0,spitAge);
    if(form.key==='enemy-5d')return this.tornado(tick,this.stolen.get(form.key)?.frames[0]?.palette??DEFAULT_PALETTE);
    if(form.key==='enemy-59')return this.fireSnake(tick,false,this.fireSnakePalette());
    if(shell){const image=this.default(form,true);return form.key==='koopaling-0'&&walk?image.frames[Math.floor(tick/6)%image.frames.length]:image;}
    if(collapsed&&form.enemyId===0x3f)return this.dryBonesPile(form);
    const stolen=this.stolen.get(form.key);
    if(form.winged){
      const copied=stolen?.frames.find(f=>f.completeWings),age=Math.max(0,tick-(stolen?.start??0));
      // Keep the exact hit pose briefly, then play the full native flight cycle.
      // Wing clocks are independent of Objects_Frame, and must also run at rest.
      if(copied&&age<WINGED_SPRITES[form.key].ticks&&form.enemyId!==0x4c)return copied;
      return this.winged(form,age,copied?.palette??WINGED_SPRITES[form.key].palette);
    }
    if([0x78,0x79].includes(form.enemyId))return stolen?.frames.find(f=>f.bulletBody)??this.default(form);
    let image;
    const frames=form.key==='koopaling-0'?stolen?.frames.filter(f=>f.larryWalking):form.enemyId===0x3f?stolen?.frames.filter(f=>f.frame<2):stolen?.frames;
    if(frames?.length){const age=Math.max(0,tick-stolen.start);image=frames[walk?Math.floor(age/10)%frames.length:0];}
    else{image=this.default(form);if(walk&&image?.frames?.length)image=image.frames[Math.floor(tick/10)%image.frames.length];}
    return form.extendable?this.plantPose(image,form,extension):image;
  }
  serialize(){return Array.from(this.stolen,([key,value])=>[key,{start:value.start,frames:value.frames.map(f=>({...f,pixels:Array.from(f.pixels)}))}]);}
  restore(data=[]){
    this.stolen.clear();this.observed.clear();this.current.clear();
    for(const [key,value]of data){
      if(!Array.isArray(value.frames)||value.frames.length>12)continue;
      // Older saves captured a cropped Koopa or a pipe cover. Use complete
      // original-ROM art until these forms are copied again with the fix.
      if(['enemy-6c','enemy-6d','enemy-6e','enemy-6f','enemy-80'].includes(key)&&!value.frames.every(f=>f.completeTroopa))continue;
      if(/^enemy-a[0-7]$/.test(key)&&!value.frames.every(f=>f.completePlant))continue;
      if(key==='enemy-2a'&&!value.frames.every(f=>f.ptooieBody))continue;
      if(key==='enemy-29'&&!value.frames.every(f=>f.spikeBody))continue;
      if(['enemy-78','enemy-79'].includes(key)&&!value.frames.every(f=>f.bulletBody))continue;
      if(key==='koopaling-0'&&!value.frames.every(f=>f.larryWalking))continue;
      if(key==='enemy-59'&&!value.frames.every(f=>f.fireSnakeHead))continue;
      if(key==='enemy-5d'&&!value.frames.every(f=>f.completeTornado))continue;
      const frames=value.frames.filter(f=>Number.isInteger(f.width)&&Number.isInteger(f.height)&&f.width>0&&f.width<=128&&f.height>0&&f.height<=160&&f.pixels?.length===f.width*f.height).map(f=>({...f,pixels:Uint32Array.from(f.pixels)}));
      if(frames.length)this.stolen.set(key,{start:value.start??0,frames});
    }
  }
}
