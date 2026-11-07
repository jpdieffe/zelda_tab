export const LASER_SECONDS=5;
const names={jj:'JJ',michelle:'Michelle'};
// Beam collision uses the same live wall map as companion projectiles.
export function beamEnd(source,direction,world,radius=0){
  const length=Math.hypot(direction.x,direction.y)||1,dx=direction.x/length,dy=direction.y/length;
  let end={x:source.x,y:source.y};
  for(let distance=2;distance<=320;distance+=2){
    const x=source.x+dx*distance,y=source.y+dy*distance;
    if(x<1||x>255||y<33||y>223||[-radius,0,radius].some(offset=>world.wallAt?.(x-dy*offset,y+dx*offset)))break;
    end={x,y};
  }
  return end;
}
export function touchesBeam(target,source,end,radius){
  const dx=end.x-source.x,dy=end.y-source.y,length=dx*dx+dy*dy;
  if(!length)return false;
  const t=((target.x-source.x)*dx+(target.y-source.y)*dy)/length;
  return t>=0&&t<=1&&Math.hypot(target.x-source.x-dx*t,target.y-source.y-dy*t)<=radius+4;
}
export class LaserReward {
  constructor(){this.remaining=0;this.roles=[];this.giant=false;this.aim={};this.beams=[];this.cooldown=0;}
  start({roles,giant}){this.roles=[...roles];this.giant=Boolean(giant);this.remaining=roles.length?LASER_SECONDS:0;this.aim={};this.beams=[];this.cooldown=0;}
  get active(){return this.remaining>0;}
  steering(role){return this.active&&this.giant&&this.roles.includes(role);}
  setAim(role,x,y){
    if(!this.steering(role)||!Number.isFinite(x)||!Number.isFinite(y))return;
    const length=Math.hypot(x,y);if(length>.01)this.aim[role]={x:x/length,y:y/length};
  }
  update(dt,world,characters,hit,paused=false){
    this.beams=[];
    if(!this.active||paused||!world?.active)return;
    this.cooldown-=dt;const fire=this.cooldown<=0;if(fire)this.cooldown=.16;
    for(const role of this.roles){
      const source=characters[role];if(!source?.active||(role==='michelle'&&!source.enabled))continue;
      const nearest=world.enemies.filter(e=>e.vulnerable).sort((a,b)=>Math.hypot(a.x-source.x,a.y-source.y)-Math.hypot(b.x-source.x,b.y-source.y))[0];
      const direction=this.giant?(this.aim[role]||{x:source.aimX,y:source.aimY}):nearest?{x:nearest.x-source.x,y:nearest.y-source.y}:{x:source.aimX,y:source.aimY};
      const radius=this.giant?10:2,end=beamEnd(source,direction,world,radius);
      this.beams.push({role,x:source.x,y:source.y,end,radius});
      if(fire)for(const enemy of world.enemies)if(enemy.vulnerable&&touchesBeam(enemy,source,end,radius))hit(enemy,source,end,radius);
    }
    this.remaining=Math.max(0,this.remaining-dt);
    if(!this.active)this.beams=[];
  }
  snapshot(){return this.active?{remaining:this.remaining,roles:this.roles,giant:this.giant}:null;}
  label(){return this.active?`${this.giant?'TEAM LASERS':this.roles.map(r=>names[r]).join(' + ')+' LASERS'} · ${Math.ceil(this.remaining)}s`:'';}
  draw(ctx,time){
    ctx.save();ctx.lineCap='round';
    for(const beam of this.beams){
      const color=beam.role==='jj'?'#83ffcb':'#ed9eff';
      ctx.shadowColor=color;ctx.shadowBlur=this.giant?14:7;
      for(const [width,stroke,alpha] of [[beam.radius*2+8,color,.35],[beam.radius*2+2,color,.9],[this.giant?5:2,'#fff9d9',1]]){
        ctx.globalAlpha=alpha*(.9+.1*Math.sin(time/110));ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(beam.x,beam.y);ctx.lineTo(beam.end.x,beam.end.y);ctx.stroke();
      }
      ctx.globalAlpha=1;ctx.fillStyle='#fff9d9';ctx.beginPath();ctx.arc(beam.end.x,beam.end.y,this.giant?5:2,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
}
