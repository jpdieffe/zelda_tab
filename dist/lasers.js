export const LASER_SECONDS=20;
const names={jj:'JJ',michelle:'Michelle'};
// Reward lasers pierce scenery and end at the game-screen boundary.
export function beamEnd(source,direction){
  const length=Math.hypot(direction.x,direction.y)||1,dx=direction.x/length,dy=direction.y/length;
  let end={x:source.x,y:source.y};
  for(let distance=2;distance<=320;distance+=2){
    const x=source.x+dx*distance,y=source.y+dy*distance;
    if(x<1||x>255||y<33||y>223)break;
    end={x,y};
  }
  return end;
}
export function touchesBeam(target,source,end,radius){
  const dx=end.x-source.x,dy=end.y-source.y,length=dx*dx+dy*dy;
  if(!length)return false;
  const t=((target.x-source.x)*dx+(target.y-source.y)*dy)/length;
  const body=target.radius??4,nearest=Math.max(0,Math.min(1,t));
  return t>=0&&Math.hypot(target.x-source.x-dx*nearest,target.y-source.y-dy*nearest)<=radius+body;
}
export class LaserReward {
  constructor(){this.timers={};this.aim={};this.beams=[];this.cooldown=0;}
  start({roles,giant}){
    for(const role of roles){
      if(!this.timers[role]?.remaining)delete this.aim[role];
      this.timers[role]={remaining:LASER_SECONDS,giant:giant?LASER_SECONDS:this.timers[role]?.giant||0};
    }
    this.cooldown=0;
  }
  get roles(){return Object.keys(this.timers).filter(role=>this.timers[role].remaining>0);}
  get remaining(){return Math.max(0,...this.roles.map(role=>this.timers[role].remaining));}
  get giant(){return this.roles.some(role=>this.timers[role].giant>0);}
  get active(){return this.remaining>0;}
  steering(role){return this.roles.includes(role);}
  setAim(role,x,y){
    if(!this.steering(role)||!Number.isFinite(x)||!Number.isFinite(y))return;
    const length=Math.hypot(x,y);if(length>.01)this.aim[role]={x:x/length,y:y/length};
  }
  update(dt,world,characters,hit,paused=false,fireSound=()=>{}){
    this.beams=[];
    if(!this.active||paused||!world?.active)return;
    this.cooldown-=dt;const fire=this.cooldown<=0;if(fire)this.cooldown=.16;
    let firing=false;
    for(const role of this.roles){
      const source=characters[role];if(!source?.active||(role==='michelle'&&!source.enabled))continue;
      const direction=this.aim[role]||{x:source.aimX,y:source.aimY};
      const radius=this.timers[role].giant>0?10:2,end=beamEnd(source,direction);
      this.beams.push({role,x:source.x,y:source.y,end,radius});
      firing=true;
      if(fire)for(const enemy of world.enemies)if(enemy.vulnerable&&touchesBeam(enemy,source,end,radius))hit(enemy,source,end,radius);
    }
    if(fire&&firing)fireSound();
    for(const timer of Object.values(this.timers)){timer.remaining=Math.max(0,timer.remaining-dt);timer.giant=Math.max(0,timer.giant-dt);}
    if(!this.active)this.beams=[];
  }
  snapshot(){return this.active?{remaining:this.remaining,roles:this.roles,giant:this.giant,timers:this.timers}:null;}
  label(){return this.active?`${this.giant?'TEAM LASERS':this.roles.map(r=>names[r]).join(' + ')+' LASERS'} · ${Math.ceil(this.remaining)}s`:'';}
  draw(ctx,time){
    ctx.save();ctx.lineCap='round';
    for(const beam of this.beams){
      const color=beam.role==='jj'?'#83ffcb':'#ed9eff';
      ctx.shadowColor=color;ctx.shadowBlur=beam.radius>2?14:7;
      for(const [width,stroke,alpha] of [[beam.radius*2+8,color,.35],[beam.radius*2+2,color,.9],[beam.radius>2?5:2,'#fff9d9',1]]){
        ctx.globalAlpha=alpha*(.9+.1*Math.sin(time/110));ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(beam.x,beam.y);ctx.lineTo(beam.end.x,beam.end.y);ctx.stroke();
      }
      ctx.globalAlpha=1;ctx.fillStyle='#fff9d9';ctx.beginPath();ctx.arc(beam.end.x,beam.end.y,beam.radius>2?5:2,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
}
