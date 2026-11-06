import {Fairy} from './fairy.js';
export const HEAL_COOLDOWN=5000;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const placementOffsets=[];
for(let y=-32;y<=32;y++)for(let x=-32;x<=32;x++)if(x*x+y*y<=32*32)placementOffsets.push({x,y,d:x*x+y*y});
placementOffsets.sort((a,b)=>a.d-b.d);
export class Unicorn extends Fairy {
  constructor(){
    super();this.offsetX=-22;this.offsetY=10;this.enabled=false;this.inputX=0;this.inputY=0;this.inputAge=1;
    this.knockX=0;this.knockY=0;this.invulnerable=0;this.bounces=0;this.healCooldown=0;this.hearts=[];this.facing=1;
  }
  setInput(x,y){
    if(!Number.isFinite(x)||!Number.isFinite(y))return;
    const length=Math.max(1,Math.hypot(x,y));this.inputX=x/length;this.inputY=y/length;this.inputAge=0;
    if(x||y)this.follow=false;
  }
  stop(){this.inputX=0;this.inputY=0;this.inputAge=1;}
  update(dt,world){
    this.healCooldown=Math.max(0,this.healCooldown-dt*1000);this.inputAge+=dt;
    this.invulnerable=Math.max(0,this.invulnerable-dt);
    if(!this.enabled||!world?.active){super.update(dt,null);this.hearts=[];this.knockX=this.knockY=0;this.stop();return;}
    this.newScene=this.scene!==world.scene;
    if(this.newScene){this.hearts=[];this.knockX=this.knockY=0;this.invulnerable=0;this.stop();}
    else{
      const dx=((world.cameraX-this.cameraX+32768)&65535)-32768,dy=((world.cameraY-this.cameraY+32768)&65535)-32768;
      for(const heart of this.hearts){heart.x-=dx;heart.y-=dy;}
      // Fairy's screen clamp can drag a grounded companion through scenery.
      // Detect being left behind before that clamp loses the world position,
      // and recall onto clear floor near Link instead of pushing along the edge.
      const x=this.x-dx,y=this.y-dy;
      if((dx||dy)&&(x<10||x>246||y<44||y>215)){
        this.needsPlacement=true;this.knockX=this.knockY=0;
      }
    }
    super.update(dt,world);
    if(!this.active){this.hearts=[];return;}
    for(const heart of this.hearts){
      heart.life+=dt;const dx=world.link.x-heart.x,dy=world.link.y-heart.y,d=Math.hypot(dx,dy),step=180*dt;
      if(d<=step+4){heart.heal();this.burst(world.link.x,world.link.y);heart.done=true;}
      else{heart.x+=dx/d*step;heart.y+=dy/d*step;}
      if(heart.life>3)heart.done=true;
    }
    this.hearts=this.hearts.filter(h=>!h.done);
  }
  clearAt(x,y,world){return x>=10&&x<=246&&y>=44&&y<=215&&![-5,0,5].some(dx=>[-3,0,4].some(dy=>world.wallAt?.(x+dx,y+dy)));}
  nearestClear(x,y,world,radius=32){
    x=clamp(x,10,246);y=clamp(y,44,215);
    for(const offset of placementOffsets){
      if(offset.d>radius*radius)break;
      const point={x:x+offset.x,y:y+offset.y};
      if(this.clearAt(point.x,point.y,world))return point;
    }
    return null;
  }
  placeNearLink(world){
    const anchor=this.nearestClear(world.link.x,world.link.y,world);
    if(!anchor)return false;
    // Walk out from Link's safe space; never choose an offset across a wall.
    this.x=anchor.x;this.y=anchor.y;
    const dx=world.link.x+this.offsetX-anchor.x,dy=world.link.y+this.offsetY-anchor.y;
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)));
    for(let i=1;i<=steps;i++){
      const x=anchor.x+dx*i/steps,y=anchor.y+dy*i/steps;
      if(!this.clearAt(x,y,world))break;
      this.x=x;this.y=y;
    }
    return true;
  }
  moveBody(dt,world){
    if(this.newScene||this.needsPlacement){
      this.needsPlacement=!this.placeNearLink(world);
    }else if(!this.clearAt(this.x,this.y,world)){
      // Scrolling clamps, changing tiles and doorway transitions can overlap
      // the body with a wall. Resolve that before testing either movement axis.
      const point=this.nearestClear(this.x,this.y,world,12);
      if(point){this.x=point.x;this.y=point.y;}
      else this.needsPlacement=!this.placeNearLink(world);
      this.knockX=this.knockY=0;
    }
    if(this.needsPlacement){
      // Transition collision data may have no usable floor yet. Retry next
      // frame instead of leaving a visible, immovable unicorn inside a wall.
      this.active=false;this.shots=[];this.walking=false;return;
    }
    const startX=this.x,startY=this.y;
    let x=this.inputAge<.35?this.inputX:0,y=this.inputAge<.35?this.inputY:0;
    if(this.follow){const dx=world.link.x+this.offsetX-this.x,dy=world.link.y+this.offsetY-this.y,d=Math.hypot(dx,dy);if(d>3){x=dx/d*Math.min(1,d/12);y=dy/d*Math.min(1,d/12);}}
    if(!this.invulnerable){
      const enemy=(world.contacts||world.enemies).find(e=>Math.hypot(e.x-this.x,e.y-this.y)<15);
      if(enemy){const dx=this.x-enemy.x,dy=this.y-enemy.y,d=Math.hypot(dx,dy)||1;this.knockX=dx/d*170;this.knockY=dy/d*170;if(!dx&&!dy)this.knockX=-170;this.invulnerable=1;this.bounces++;}
    }
    const knocked=Math.hypot(this.knockX,this.knockY)>12;
    if(!knocked&&(x||y)){const d=Math.hypot(x,y);this.aimX=x/d;this.aimY=y/d;if(x)this.facing=Math.sign(x);}
    const dx=(knocked?this.knockX:x*105)*dt,dy=(knocked?this.knockY:y*105)*dt;
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/2));
    for(let i=0;i<steps;i++){
      const nx=clamp(this.x+dx/steps,10,246),ny=clamp(this.y+dy/steps,44,215);
      if(this.clearAt(nx,this.y,world))this.x=nx;else this.knockX*=-.45;
      if(this.clearAt(this.x,ny,world))this.y=ny;else this.knockY*=-.45;
    }
    this.knockX*=Math.exp(-7*dt);this.knockY*=Math.exp(-7*dt);
    this.walking=Math.hypot(this.x-startX,this.y-startY)>.1;
  }
  fire(hit){const result=super.fire(hit);if(result==='fired')this.cooldown=450;return result;}
  heal(heal){
    if(!this.active||this.healCooldown>0)return 'wait';
    this.healCooldown=HEAL_COOLDOWN;this.hearts.push({x:this.x,y:this.y-9,life:0,heal});return 'sent';
  }
  draw(ctx,time){
    if(!this.active)return;
    super.draw(ctx,time);
    ctx.save();ctx.fillStyle='#ff9ac6';ctx.strokeStyle='#8b395d';ctx.lineWidth=.8;
    for(const h of this.hearts){ctx.save();ctx.translate(h.x,h.y);ctx.beginPath();ctx.moveTo(0,5);ctx.bezierCurveTo(-11,-1,-4,-8,0,-3);ctx.bezierCurveTo(4,-8,11,-1,0,5);ctx.fill();ctx.stroke();ctx.restore();}
    ctx.restore();
  }
  drawBody(ctx,time){
    const bob=this.walking?Math.sin(time/70):0;
    ctx.shadowBlur=0;ctx.fillStyle='#081f2160';ctx.beginPath();ctx.ellipse(this.x,this.y+8,12,3,0,0,Math.PI*2);ctx.fill();
    ctx.translate(this.x,this.y+bob);ctx.scale(this.facing,1);
    if(this.invulnerable>0)ctx.globalAlpha=Math.sin(time/45)>0?.55:1;
    // Small original canvas sprite: white pony, lavender mane, gold horn.
    ctx.fillStyle='#b78ce7';ctx.fillRect(-16,-3,7,4);ctx.fillRect(-18,0,5,6);
    ctx.fillStyle='#796687';ctx.fillRect(-9,3,4,7);ctx.fillRect(6,3,4,7);
    ctx.fillStyle='#fff3f8';ctx.fillRect(-11,-6,20,11);ctx.fillRect(5,-13,8,12);ctx.fillRect(10,-11,6,6);
    ctx.fillRect(-8,3,3,6);ctx.fillRect(5,3,3,6);ctx.fillRect(6,-17,3,6);
    ctx.fillStyle='#d5b5fa';ctx.fillRect(3,-13,4,12);ctx.fillRect(-9,-6,12,2);ctx.fillRect(6,-16,3,3);
    ctx.fillStyle='#f3d47e';ctx.beginPath();ctx.moveTo(11,-12);ctx.lineTo(14,-23);ctx.lineTo(15,-11);ctx.closePath();ctx.fill();
    ctx.fillStyle='#302942';ctx.fillRect(11,-9,2,2);ctx.fillStyle='#f0a3c2';ctx.fillRect(12,-6,3,2);
    ctx.fillStyle='#9277b2';ctx.fillRect(-8,8,3,2);ctx.fillRect(5,8,3,2);
    ctx.globalAlpha=1;
  }
}
