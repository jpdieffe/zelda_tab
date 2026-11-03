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
  constructor() {this.x=136;this.y=100;this.tx=136;this.ty=100;this.cooldown=0;this.shots=[];this.sparks=[];this.scene=null;this.world=null;this.active=false;this.follow=true;}
  move(x,y) {
    if (!Number.isFinite(x)||!Number.isFinite(y)) return;
    this.tx=clamp(x,5,251);this.ty=clamp(y,36,218);this.follow=false;
  }
  update(dt,world) {
    this.world=world;this.cooldown=Math.max(0,this.cooldown-dt*1000);
    this.active=Boolean(world?.active);
    if (!this.active) {this.shots=[];return;}
    if(this.scene!==world.scene) {
      this.x=clamp(world.link.x+18,5,251);this.y=clamp(world.link.y-16,36,218);
      this.tx=this.x;this.ty=this.y;this.follow=true;this.shots=[];
    } else if (this.cameraX!==undefined) {
      const dx=((world.cameraX-this.cameraX+32768)&65535)-32768;
      const dy=((world.cameraY-this.cameraY+32768)&65535)-32768;
      this.x=clamp(this.x-dx,5,251);this.y=clamp(this.y-dy,36,218);
      this.tx=clamp(this.tx-dx,5,251);this.ty=clamp(this.ty-dy,36,218);
    }
    this.scene=world.scene;this.cameraX=world.cameraX;this.cameraY=world.cameraY;
    if(this.follow){this.tx=clamp(world.link.x+18,5,251);this.ty=clamp(world.link.y-16,36,218);}
    const dx=this.tx-this.x,dy=this.ty-this.y,d=Math.hypot(dx,dy),step=Math.min(d,125*dt);
    if(d>0.1){this.x+=dx/d*step;this.y+=dy/d*step;}
    this.target=nearestEnemy(world.enemies,this);
    for(const shot of this.shots) {
      shot.life+=dt;
      const target=world.enemies.find(e=>e.slot===shot.target.slot&&e.type===shot.target.type);
      if(!target) {shot.done=true;continue;}
      const sx=target.x-shot.x,sy=target.y-shot.y,dist=Math.hypot(sx,sy),travel=280*dt;
      if(dist<=travel+3) {
        // Revalidate the live sprite, its type, vulnerability and range on impact.
        const hit=shot.hit(target,this);
        if(hit)for(let i=0;i<9;i++)this.sparks.push({x:target.x,y:target.y,angle:i*Math.PI*2/9,life:.3});
        shot.done=true;
      } else {shot.x+=sx/dist*travel;shot.y+=sy/dist*travel;}
      if(shot.life>.35)shot.done=true;
    }
    this.shots=this.shots.filter(s=>!s.done);
    for(const spark of this.sparks){spark.life-=dt;spark.x+=Math.cos(spark.angle)*35*dt;spark.y+=Math.sin(spark.angle)*35*dt;}
    this.sparks=this.sparks.filter(s=>s.life>0);
  }
  fire(hit) {
    if(!this.active||this.cooldown>0)return 'wait';
    const target=nearestEnemy(this.world.enemies,this);
    this.cooldown=COOLDOWN;
    if(!target)return 'closer';
    this.shots.push({x:this.x,y:this.y,target:{slot:target.slot,type:target.type},life:0,hit});
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
    const bob=Math.sin(time/180)*1.6, flap=1+Math.sin(time/45)*.25;
    ctx.translate(this.x,this.y+bob);ctx.shadowColor='#c7ffc8';ctx.shadowBlur=10;
    ctx.fillStyle='#d7f8e0cc';
    for(const side of [-1,1]){ctx.beginPath();ctx.ellipse(side*5,-3,3*flap,5,side*.65,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(side*4,3,2,3,side*-.6,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#f8ffcf';ctx.beginPath();ctx.arc(0,0,3.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.fillRect(-.7,-2,1.4,4);ctx.fillRect(-2,-.7,4,1.4);ctx.restore();
  }
}
