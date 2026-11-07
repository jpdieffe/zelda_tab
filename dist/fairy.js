export const RANGE = 54;
export const COOLDOWN = 650;
const clamp = (v, lo, hi) => Math.max(lo,Math.min(hi,v));
export function nearestEnemy(enemies, fairy, range = RANGE) {
  let result = null, distance = range;
  for (const enemy of enemies) {
    if (!enemy.vulnerable) continue;
    const d = Math.hypot(enemy.x-fairy.x,enemy.y-fairy.y);
    if (d <= distance) {result = enemy; distance = d;}
  }
  return result;
}
export class Fairy {
  constructor() {this.x=136;this.y=100;this.tx=136;this.ty=100;this.offsetX=18;this.offsetY=-16;this.aimX=0;this.aimY=-1;this.cooldown=0;this.shots=[];this.sparks=[];this.scene=null;this.world=null;this.active=false;this.follow=true;}
  move(x,y) {
    if (!Number.isFinite(x)||!Number.isFinite(y)) return;
    this.tx=clamp(x,5,251);this.ty=clamp(y,36,218);this.follow=false;
  }
  update(dt,world) {
    this.world=world;this.cooldown=Math.max(0,this.cooldown-dt*1000);
    this.active=Boolean(world?.active);
    if (!this.active) {this.shots=[];this.sparks=[];return;}
    if(this.scene!==world.scene) {
      this.x=clamp(world.link.x+this.offsetX,5,251);this.y=clamp(world.link.y+this.offsetY,36,218);
      this.tx=this.x;this.ty=this.y;this.follow=true;this.shots=[];this.sparks=[];this.aimX=0;this.aimY=-1;
    } else if (this.cameraX!==undefined) {
      const dx=((world.cameraX-this.cameraX+32768)&65535)-32768;
      const dy=((world.cameraY-this.cameraY+32768)&65535)-32768;
      this.x=clamp(this.x-dx,5,251);this.y=clamp(this.y-dy,36,218);
      this.tx=clamp(this.tx-dx,5,251);this.ty=clamp(this.ty-dy,36,218);
      for(const effect of [...this.shots,...this.sparks]){effect.x-=dx;effect.y-=dy;}
    }
    this.scene=world.scene;this.cameraX=world.cameraX;this.cameraY=world.cameraY;
    this.moveBody(dt,world);
    this.target=nearestEnemy(world.enemies,this);
    for(const shot of this.shots) {
      shot.life+=dt;
      const target=shot.target&&world.enemies.find(e=>e.slot===shot.target.slot&&e.type===shot.target.type&&e.vulnerable);
      if(target){const sx=target.x-shot.x,sy=target.y-shot.y,dist=Math.hypot(sx,sy);if(dist>0){shot.vx=sx/dist;shot.vy=sy/dist;}}
      else shot.target=null;
      // Sweep in <=2px steps so a fast spark cannot skip a thin wall.
      const steps=Math.max(1,Math.ceil(280*dt/2)),travel=280*dt/steps;
      for(let i=0;i<steps&&!shot.done;i++){
        shot.x+=shot.vx*travel;shot.y+=shot.vy*travel;
        if(shot.x<1||shot.x>255||shot.y<33||shot.y>223||world.wallAt?.(shot.x,shot.y)){
          this.burst(shot.x,shot.y);shot.done=true;
        }else{
          // Free shots can hit too, and large/jumping enemies use their body
          // instead of a four-pixel dot. Validate from the actual impact point.
          const struck=world.enemies.find(e=>e.vulnerable&&Math.hypot(e.x-shot.x,e.y-shot.y)<=(e.radius??4));
          if(struck){shot.hit?.(struck,{x:shot.x,y:shot.y});this.burst(shot.x,shot.y);shot.done=true;}
        }
      }
      if(shot.life>1.5)shot.done=true;
    }
    this.shots=this.shots.filter(s=>!s.done);
    for(const spark of this.sparks){spark.life-=dt;spark.x+=Math.cos(spark.angle)*35*dt;spark.y+=Math.sin(spark.angle)*35*dt;}
    this.sparks=this.sparks.filter(s=>s.life>0);
  }
  moveBody(dt,world){
    if(this.follow){this.tx=clamp(world.link.x+this.offsetX,5,251);this.ty=clamp(world.link.y+this.offsetY,36,218);}
    const dx=this.tx-this.x,dy=this.ty-this.y,d=Math.hypot(dx,dy),step=Math.min(d,125*dt);
    if(d>0.1){this.aimX=dx/d;this.aimY=dy/d;this.x+=dx/d*step;this.y+=dy/d*step;}
  }
  burst(x,y){for(let i=0;i<12;i++)this.sparks.push({x,y,angle:i*Math.PI*2/12,life:.3});}
  fire(hit) {
    if(!this.active||this.cooldown>0)return 'wait';
    const target=nearestEnemy(this.world.enemies,this);
    this.cooldown=COOLDOWN;
    this.shots.push({x:this.x,y:this.y,vx:this.aimX,vy:this.aimY,target:target?{slot:target.slot,type:target.type}:null,life:0,hit});
    return 'fired';
  }
  draw(ctx,time) {
    if(!this.active)return;
    ctx.save();
    ctx.strokeStyle=this.target?'#d8f1a565':'#dbf4cb20';ctx.lineWidth=.6;
    ctx.setLineDash([2,4]);ctx.beginPath();ctx.arc(this.x,this.y,RANGE,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    if(this.target){ctx.strokeStyle='#f7ed9f';ctx.lineWidth=1;ctx.beginPath();ctx.arc(this.target.x,this.target.y,11,0,Math.PI*2);ctx.stroke();}
    for(const shot of this.shots){ctx.shadowColor='#fbf0a7';ctx.shadowBlur=8;ctx.fillStyle='#fff9ba';ctx.beginPath();ctx.arc(shot.x,shot.y,2.5,0,Math.PI*2);ctx.fill();}
    for(const s of this.sparks){ctx.globalAlpha=s.life/.3;ctx.fillStyle='#fff0a3';ctx.fillRect(s.x,s.y,1.7,1.7);}ctx.globalAlpha=1;
    this.drawBody(ctx,time);ctx.restore();
  }
  drawBody(ctx,time){
    const bob=Math.sin(time/180)*1.6, flap=1+Math.sin(time/45)*.25;
    ctx.translate(this.x,this.y+bob);ctx.shadowColor='#c7ffc8';ctx.shadowBlur=10;
    ctx.fillStyle='#d7f8e0cc';
    for(const side of [-1,1]){ctx.beginPath();ctx.ellipse(side*5,-3,3*flap,5,side*.65,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(side*4,3,2,3,side*-.6,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#f8ffcf';ctx.beginPath();ctx.arc(0,0,3.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.fillRect(-.7,-2,1.4,4);ctx.fillRect(-2,-.7,4,1.4);
  }
}
