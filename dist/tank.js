import {TankTerrain,TankLink} from './tank-terrain.js';
import {beamEnd,touchesBeam} from './lasers.js';
export class TeamTank{
 constructor(bridge){this.bridge=bridge;this.terrain=new TankTerrain(bridge);this.link=new TankLink(bridge,this.terrain);this.active=false;this.missiles=[];this.blasts=[];this.aim={x:1,y:0};this.aimAge=1;this.firing=false;this.rocketCooldown=0;this.heartCooldown=0;this.hitCooldown=0;this.sequence=0;}
 start(world){
  this.terrain.enter(world);if(!this.link.begin(world))return false;
  const origin={x:world.link.x+world.cameraX,y:world.link.y+world.cameraY},spots=[origin];
  for(let y=54;y<=202;y+=4)for(let x=22;x<=234;x+=4)spots.push({x:x+world.cameraX,y:y+world.cameraY});
  spots.sort((a,b)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y));
  const point=spots.find(p=>!this.terrain.blocked(p.x,p.y,world));
  if(!point){this.link.restore(origin.x,origin.y,world);return false;}
  this.x=point.x;this.y=point.y;this.scene=world.scene;this.active=true;this.missiles=[];this.blasts=[];this.aimAge=1;this.firing=false;this.rocketCooldown=this.heartCooldown=this.hitCooldown=0;this.link.hold(this.x,this.y);return true;
 }
 release(world){if(!this.active)return;this.link.restore(this.x,this.y,world);this.active=false;this.firing=false;this.beam=null;this.missiles=[];this.blasts=[];}
 reset(world){this.release(world);this.terrain.reset();}
 setAim(x,y){if(!Number.isFinite(x)||!Number.isFinite(y))return;const d=Math.hypot(x,y);this.aimAge=0;this.firing=d>.1;if(this.firing)this.aim={x:x/d,y:y/d};}
 launch(x,y,world,heart=false){
  if(!this.active||!world?.active||![x,y].every(Number.isFinite)||(heart?this.heartCooldown:this.rocketCooldown)>0)return false;
  if(heart)this.heartCooldown=.8;else this.rocketCooldown=.35;
  for(let i=0;i<3;i++)this.missiles.push({startX:this.x,startY:this.y,x:this.x,y:this.y,targetX:x+world.cameraX,targetY:y+world.cameraY,life:0,duration:.7+Math.hypot(x+world.cameraX-this.x,y+world.cameraY-this.y)/180,phase:++this.sequence*1.7,heart});
  this.bridge.fireSound();return true;
 }
 hearts(world){
  const source={x:this.x-world.cameraX,y:this.y-world.cameraY},target=world.enemies.filter(e=>e.vulnerable).sort((a,b)=>Math.hypot(a.x-source.x,a.y-source.y)-Math.hypot(b.x-source.x,b.y-source.y))[0]||beamEnd(source,this.aim);
  return this.launch(target.x,target.y,world,true);
 }
 update(dt,world,drive,paused=false){
  if(!world)return;
  if(this.terrain.scene!==world.scene){
   this.terrain.enter(world);
   if(this.active){this.scene=world.scene;this.x=world.link.x+world.cameraX;this.y=world.link.y+world.cameraY;this.link.origin={x:this.x,y:this.y};this.missiles=[];this.blasts=[];this.firing=false;}
  }
  if(!this.active||paused||!world.active)return;
  this.aimAge+=dt;this.rocketCooldown=Math.max(0,this.rocketCooldown-dt);this.heartCooldown=Math.max(0,this.heartCooldown-dt);this.hitCooldown-=dt;
  const d=Math.max(1,Math.hypot(drive.x,drive.y)),dx=drive.x/d*95*dt,dy=drive.y/d*95*dt,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/2));
  for(let i=0;i<steps;i++){
   if(!this.terrain.blocked(this.x+dx/steps,this.y,world))this.x+=dx/steps;
   if(!this.terrain.blocked(this.x,this.y+dy/steps,world))this.y+=dy/steps;
  }
  this.terrain.smash(this.x,this.y);this.link.hold(this.x,this.y);
  const source={x:this.x-world.cameraX,y:this.y-world.cameraY};
  const area=(point,type,radius)=>{for(const e of world.enemies)if(e.vulnerable&&Math.hypot(e.x-point.x,e.y-point.y)<=radius+(e.radius??7))this.bridge.powerHit(e,point,type,false);};
  this.beam=this.firing&&this.aimAge<.35?{source,end:beamEnd(source,this.aim)}:null;
  if(this.hitCooldown<=0){
   area(source,'tankcrush',26);
   if(this.beam){for(const e of world.enemies)if(e.vulnerable&&touchesBeam(e,source,this.beam.end,10))this.bridge.powerHit(e,source,'tanklaser',false);this.bridge.fireSound();}
   this.hitCooldown=.12;
  }
  for(const p of this.missiles){
   p.life+=dt;const t=Math.min(1,p.life/p.duration),dx=p.targetX-p.startX,dy=p.targetY-p.startY,len=Math.hypot(dx,dy)||1;
   const bend=Math.sin(t*Math.PI)*Math.sin(t*Math.PI*6+p.phase)*(p.heart?24:45),nx=p.startX+dx*t-dy/len*bend,ny=p.startY+dy*t+dx/len*bend;
   const steps=Math.max(1,Math.ceil(Math.hypot(nx-p.x,ny-p.y)/3)),sx=p.x,sy=p.y;
   for(let i=1;i<=steps;i++){
    p.x=sx+(nx-sx)*i/steps;p.y=sy+(ny-sy)*i/steps;const point={x:p.x-world.cameraX,y:p.y-world.cameraY};
    if(world.enemies.some(e=>e.vulnerable&&Math.hypot(e.x-point.x,e.y-point.y)<(e.radius??7)+5)||t===1){area(point,p.heart?'tankheart':'tankrocket',p.heart?28:40);p.done=true;this.blasts.push({x:p.x,y:p.y,life:.35,heart:p.heart});this.bridge.bombSound();break;}
   }
  }
  this.missiles=this.missiles.filter(p=>!p.done);for(const b of this.blasts)b.life-=dt;this.blasts=this.blasts.filter(b=>b.life>0);
 }
 snapshot(){return this.active?{active:true,heartCooldown:this.heartCooldown,rocketCooldown:this.rocketCooldown}:null;}
 cleanState(action,world){return this.link.clean(action,this.x,this.y,world);}
 draw(ctx,world,time){
  if(!this.active||!world?.active)return;ctx.save();const x=this.x-world.cameraX,y=this.y-world.cameraY;
  if(this.beam){
   const {source,end}=this.beam,dx=end.x-source.x,dy=end.y-source.y,d=Math.hypot(dx,dy)||1;
   ['#ff5468','#ffa852','#fff16a','#8fff83','#6bdcff','#9a9bff','#ee92ff'].forEach((color,i)=>{const offset=(i-3)*2.5;ctx.strokeStyle=color;ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(source.x-dy/d*offset,source.y+dx/d*offset);ctx.lineTo(end.x-dy/d*offset,end.y+dx/d*offset);ctx.stroke();});
  }
  ctx.fillStyle='#152f35';ctx.fillRect(x-25,y-17,50,11);ctx.fillRect(x-25,y+8,50,11);
  ctx.fillStyle='#b0c3ae';for(let i=-22;i<=22;i+=7){const shift=Math.sin(time/70)*2;ctx.fillRect(x+i+shift,y-16,3,8);ctx.fillRect(x+i-shift,y+9,3,8);}
  ctx.fillStyle='#529887';ctx.fillRect(x-23,y-8,46,18);ctx.fillStyle='#a7dc85';ctx.fillRect(x-18,y-13,36,20);ctx.fillStyle='#f2d780';ctx.fillRect(x-16,y+5,32,4);
  ctx.save();ctx.translate(x,y-2);ctx.rotate(Math.atan2(this.aim.y,this.aim.x));ctx.fillStyle='#475971';ctx.fillRect(0,-5,32,10);ctx.fillStyle='#ed9dce';ctx.fillRect(26,-6,8,12);ctx.restore();
  ctx.fillStyle='#d8ecc0';ctx.beginPath();ctx.arc(x,y-2,11,0,Math.PI*2);ctx.fill();
  // Three crew windows: Dad's green cap, JJ's fairy glow, Michelle's horn.
  for(const [offset,color] of [[-13,'#88d166'],[0,'#baffec'],[13,'#e7b7ff']]){ctx.fillStyle='#203b48';ctx.fillRect(x+offset-5,y-13,10,9);ctx.fillStyle=color;ctx.fillRect(x+offset-3,y-11,6,5);}
  ctx.fillStyle='#fff0a6';ctx.beginPath();ctx.moveTo(x+12,y-13);ctx.lineTo(x+15,y-21);ctx.lineTo(x+17,y-12);ctx.fill();
  for(const p of this.missiles){const px=p.x-world.cameraX,py=p.y-world.cameraY;ctx.fillStyle=p.heart?'#ff89cb':'#ffdd86';
   if(p.heart){ctx.beginPath();ctx.moveTo(px,py+6);ctx.bezierCurveTo(px-12,py,px-5,py-9,px,py-4);ctx.bezierCurveTo(px+5,py-9,px+12,py,px,py+6);ctx.fill();}
   else{ctx.beginPath();ctx.arc(px,py,4,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ff733d';ctx.fillRect(px-8,py-2,6,4);}
  }
  for(const b of this.blasts){ctx.globalAlpha=b.life/.35;ctx.strokeStyle=b.heart?'#ffa4e0':'#ffdb8c';ctx.lineWidth=4;ctx.beginPath();ctx.arc(b.x-world.cameraX,b.y-world.cameraY,5+(1-b.life/.35)*38,0,Math.PI*2);ctx.stroke();}ctx.restore();
 }
}
