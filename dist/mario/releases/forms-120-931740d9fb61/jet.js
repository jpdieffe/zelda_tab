import {M} from './memory.js';
import {player,setPosition,inLevel,sceneKey} from './engine.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const JET_COLORS={jj:'#59baff',michelle:'#ff86d4'};
// Verified against the bundled PRG1 ROM and Southbird's disassembly. Only the
// live emulator is patched, for a frame at a time; the ROM file stays original.
// Native scrolling, tile collisions, pipes, goals and enemy simulation still run.
const PATCHES=[
  {bank:8,address:0xa6aa,bytes:[0x4c,0xbb,0xa6,0x35,0x35,0x03,0x05,0x03]}, // Player_ControlJmp: replace walking/gravity with Dad's flight.
  {bank:7,address:0xa183,bytes:[0xa9,0x01,0x8d,0x78,0x05,0x4c,0x7c,0xda]}, // Fatal terrain: no suit loss or death.
  {bank:0,address:0xda7c,bytes:[0xad,0xf4,0x04,0x09,0x01,0x8d,0xf4,0x04]}, // Player_Die: guard scripted damage too.
];
export class FamilyJet {
  constructor(engine,kids){this.engine=engine;this.kids=kids;engine.vehicle=this;this.active=false;this.shots=[];this.beams=[];this.cooldowns={jj:0,michelle:0};this.face=1;this.time=0;this.patched=false;}
  start(){
    const n=this.engine.nes[0],m=n.cpu.mem;
    if(this.active||this.finished()||m[M.Player_IsDying])return false;
    for(const p of PATCHES){const bank=n.rom.rom[p.bank>>1],offset=(p.bank%2)*8192+(p.address&8191);if(!p.bytes.every((b,i)=>bank[offset+i]===b))throw new Error('Jet ROM verification failed.');}
    this.active=true;this.key=sceneKey(n);this.shots=[];this.beams=[];this.cooldowns={jj:0,michelle:0};this.face=1;this.syncPosition();
    for(const role of ['jj','michelle'])this.kids.release(role);
    this.kids.shots=[];this.kids.hearts=[];this.kids.meteors=[];return true;
  }
  stop(){this.patch(false);this.active=false;this.flying=false;this.shots=[];this.beams=[];}
  snapshot(){return this.active?{active:true,scene:sceneKey(this.engine.nes[0]),face:this.face}:null;}
  restore(saved){if(saved?.active===true&&saved.scene===sceneKey(this.engine.nes[0])&&this.start())this.face=saved.face===-1?-1:1;}
  syncPosition(){const p=player(this.engine.nes[0]);this.x=p.x+8;this.y=p.y+16;}
  finished(){const n=this.engine.nes[0],m=n.cpu.mem;return !inLevel(n)||!!(m[M.Player_EndLevel]||m[M.EndCard_Flag]||m[M.Level_ExitToMap])||m[M.Level_GetWandState]>=3;}
  patch(enable){
    if(this.patched===enable)return;
    const n=this.engine.nes[0];
    for(const p of PATCHES){
      const expected=enable?p.bytes:[0x60,...p.bytes.slice(1)],offset=p.address&8191;
      for(let base=0x8000;base<=0xe000;base+=8192)if(expected.every((b,i)=>n.cpu.mem[base+offset+i]===b))n.cpu.mem[base+offset]=enable?0x60:p.bytes[0];
      n.rom.rom[p.bank>>1][(p.bank%2)*8192+offset]=enable?0x60:p.bytes[0];
    }
    this.patched=enable;
  }
  beforeFrame(){
    this.flying=false;if(!this.active)return;
    const n=this.engine.nes[0],m=n.cpu.mem;
    if(this.finished()){this.stop();return;}
    if(this.key!==sceneKey(n)){this.key=sceneKey(n);this.shots=[];this.beams=[];}
    // Let the ROM complete pipe and room animations; keep the reward afterward.
    if(m[M.Player_InPipe]||m[M.Level_PipeMove]||m[M.Player_HaltGame]||m[M.Player_HaltTick])return;
    this.flying=true;const p=player(n),mask=this.engine.masks[0];
    let dx=(mask&128?1:0)-(mask&64?1:0),dy=(mask&32?1:0)-(mask&16?1:0);
    const length=Math.hypot(dx,dy)||1;dx=dx/length*2.8;dy=dy/length*2.8;if(dx)this.face=Math.sign(dx);
    setPosition(n,clamp(p.x+dx,p.cameraX+38,p.cameraX+208),clamp(p.y+dy,Math.max(0,p.cameraY+12),p.cameraY+160));
    m[M.Player_XVel]=0;m[M.Player_YVel]=0;
    // Keep the native previous-frame pit check above its fatal row.
    m[M.Player_SpriteY]=clamp(player(n).y-p.cameraY,4,170);
    this.flash=m[M.Player_FlashInv];m[M.Player_FlashInv]=120;
    this.patch(true);
  }
  afterFrame(){
    this.patch(false);
    if(this.flying)this.engine.nes[0].cpu.mem[M.Player_FlashInv]=Math.max(0,this.flash-1);
    if(!this.active)return;
    if(this.finished()){this.stop();return;}
    this.syncPosition();
  }
  turret(role){return {x:this.x+this.face*12,y:this.y+(role==='jj'?-9:9)};}
  step(now){
    if(!this.active||this.engine.paused)return;
    this.time++;this.beams=[];
    if(!this.flying){this.shots=[];return;}
    for(const role of ['jj','michelle']){
      const k=this.kids.kids[role];if(now>k.until){k.mask=0;k.aim=null;}
      if(this.cooldowns[role]>0)this.cooldowns[role]--;
      const origin=this.turret(role),dx=(k.mask&128?1:0)-(k.mask&64?1:0),dy=(k.mask&32?1:0)-(k.mask&16?1:0);
      const aim=k.aim||((dx||dy)?{x:dx/Math.hypot(dx,dy),y:dy/Math.hypot(dx,dy)}:null);
      if(aim){
        k.jetAim=aim;this.beams.push({...origin,role,dx:aim.x,dy:aim.y});
        if(this.time%6===0)for(const target of this.engine.weapons.targets()){
          const vx=(target.left+target.right)/2-origin.x,vy=(target.top+target.bottom)/2-origin.y;
          if(vx*aim.x+vy*aim.y>0&&vx*aim.x+vy*aim.y<350&&Math.abs(vx*aim.y-vy*aim.x)<10)this.kids.hit(target);
        }
      }
      if(k.mask&2&&!this.cooldowns[role]){
        const direction=aim||k.jetAim||{x:this.face,y:0};this.shots.push({...origin,role,dx:direction.x,dy:direction.y,life:110,trail:[]});this.cooldowns[role]=22;
        this.engine.weapons.sound(origin.x,origin.y,0x4f1,0x20);
      }
    }
    for(const shot of this.shots){
      shot.life--;shot.trail.unshift({x:shot.x,y:shot.y});shot.trail.length=Math.min(shot.trail.length,16);
      const target=this.kids.nearestEnemy(shot);
      if(target){const d=Math.hypot(target.x-shot.x,target.y-shot.y)||1;shot.dx+=(target.x-shot.x)/d*.09;shot.dy+=(target.y-shot.y)/d*.09;const v=Math.hypot(shot.dx,shot.dy)||1;shot.dx/=v;shot.dy/=v;}
      for(let s=0;s<4&&shot.life>0;s++){
        shot.x+=shot.dx*1.7;shot.y+=shot.dy*1.7;
        const hit=this.engine.weapons.targets().find(t=>shot.x>=t.left-4&&shot.x<=t.right+4&&shot.y>=t.top-4&&shot.y<=t.bottom+4);
        if(hit){this.kids.hit(hit);shot.life=0;}
      }
    }
    this.shots=this.shots.filter(s=>s.life>0).slice(-48);
  }
  draw(ctx){
    if(!this.active||!this.flying)return;
    for(const beam of this.beams){ctx.strokeStyle=JET_COLORS[beam.role];ctx.lineWidth=7;ctx.globalAlpha=.55;stroke(ctx,beam.x,beam.y,beam.x+beam.dx*350,beam.y+beam.dy*350);ctx.globalAlpha=1;ctx.lineWidth=2;ctx.strokeStyle='#fff';stroke(ctx,beam.x,beam.y,beam.x+beam.dx*350,beam.y+beam.dy*350);}
    for(const shot of this.shots){ctx.fillStyle=JET_COLORS[shot.role];for(let i=shot.trail.length-1;i>=0;i--){ctx.globalAlpha=(1-i/17)*.7;dot(ctx,shot.trail[i].x,shot.trail[i].y,3-i*.12);}ctx.globalAlpha=1;ctx.save();ctx.translate(shot.x,shot.y);ctx.rotate(Math.atan2(shot.dy,shot.dx));ctx.fillRect(-6,-3,11,6);ctx.fillStyle='#fff';dot(ctx,5,0,3);ctx.restore();}
    ctx.save();ctx.translate(this.x,this.y);ctx.scale(this.face,1);
    ctx.fillStyle='#ffc75e';poly(ctx,[[-28,-8],[-44-Math.sin(this.time*.8)*5,0],[-28,8]]);
    ctx.fillStyle='#e8f5ff';ctx.strokeStyle='#283c5e';ctx.lineWidth=1.5;
    poly(ctx,[[-26,-8],[-32,-24],[-16,-20],[0,-18],[20,-8],[34,0],[20,8],[0,18],[-16,20],[-32,24],[-26,8]]);ctx.stroke();
    ctx.fillStyle='#758cb4';poly(ctx,[[-24,-7],[-8,-7],[6,0],[-8,7],[-24,7]]);
    ctx.fillStyle='#ffc078';ctx.fillRect(0,-10,14,20);ctx.fillStyle='#df664f';ctx.fillRect(3,-7,7,5);ctx.fillStyle='#bdefff';ctx.fillRect(3,0,7,7);
    for(const [role,y] of [['jj',-10],['michelle',10]]){ctx.fillStyle=JET_COLORS[role];dot(ctx,16,y,5);ctx.fillRect(17,y-2,12,4);}
    ctx.strokeStyle='#ffe69a';ctx.globalAlpha=.4+.12*Math.sin(this.time*.1);ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,0,38,27,0,0,Math.PI*2);ctx.stroke();ctx.restore();
  }
}
function stroke(c,x,y,x2,y2){c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();}
function dot(c,x,y,r){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
function poly(c,points){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
