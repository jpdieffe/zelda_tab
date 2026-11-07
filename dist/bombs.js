export const BOMB_COOLDOWN=2000;
export const BOMB_RADIUS=36;
export class BombLauncher{
  constructor(){this.cooldown=0;this.projectiles=[];this.blasts=[];this.world=null;this.scene=null;}
  fire(owner,hit,explode,aim){
    if(!owner.active||!owner.enabled||!this.world?.active||this.cooldown>0)return 'wait';
    const target=this.world.enemies.filter(e=>e.vulnerable&&Math.hypot(e.x-owner.x,e.y-owner.y)<=120)
      .sort((a,b)=>Math.hypot(a.x-owner.x,a.y-owner.y)-Math.hypot(b.x-owner.x,b.y-owner.y))[0];
    const d=aim||(target?{x:target.x-owner.x,y:target.y-owner.y}:{x:owner.aimX,y:owner.aimY}),length=Math.hypot(d.x,d.y)||1;
    this.projectiles.push({x:owner.x,y:owner.y,vx:d.x/length,vy:d.y/length,life:0,stopped:false,hit,explode});
    this.cooldown=BOMB_COOLDOWN;return 'fired';
  }
  update(dt,world){
    this.cooldown=Math.max(0,this.cooldown-dt*1000);this.world=world;
    if(!world?.active||this.scene!==world.scene){this.projectiles=[];this.blasts=[];}
    if(!world?.active)return;
    if(this.scene===world.scene){
      const dx=((world.cameraX-this.cameraX+32768)&65535)-32768,dy=((world.cameraY-this.cameraY+32768)&65535)-32768;
      for(const p of [...this.projectiles,...this.blasts]){p.x-=dx;p.y-=dy;}
    }
    this.scene=world.scene;this.cameraX=world.cameraX;this.cameraY=world.cameraY;
    for(const b of this.blasts)b.life-=dt;this.blasts=this.blasts.filter(b=>b.life>0);
    for(const p of this.projectiles){
      p.life+=dt;
      const steps=Math.max(1,Math.ceil(140*dt/2)),travel=140*dt/steps;
      for(let i=0;i<steps&&!p.stopped;i++){
        const x=p.x+p.vx*travel,y=p.y+p.vy*travel;
        if(x<2||x>254||y<34||y>222||world.wallAt?.(x,y)){p.stopped=true;break;}
        p.x=x;p.y=y;
        if(world.enemies.some(e=>e.vulnerable&&Math.hypot(e.x-x,e.y-y)<=(e.radius??7)+3)){p.life=.8;p.stopped=true;}
      }
      if(p.life>=.8){
        for(const target of world.enemies)if(target.vulnerable&&Math.hypot(target.x-p.x,target.y-p.y)<=BOMB_RADIUS+(target.radius??7))p.hit(target,{x:p.x,y:p.y});
        p.explode?.();this.blasts.push({x:p.x,y:p.y,life:.4});p.done=true;
      }
    }
    this.projectiles=this.projectiles.filter(p=>!p.done);
  }
  draw(ctx){
    ctx.save();
    for(const p of this.projectiles){
      ctx.fillStyle=p.life>.55?'#f6a65c':'#44364f';ctx.strokeStyle='#ffe5a8';ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.moveTo(p.x+1,p.y-4);ctx.lineTo(p.x+3,p.y-8);ctx.stroke();
      ctx.fillStyle='#fff3ac';ctx.fillRect(p.x+2,p.y-10,3,3);
    }
    for(const b of this.blasts){
      const radius=BOMB_RADIUS*(1-b.life/.4);ctx.globalAlpha=b.life/.4;
      ctx.fillStyle='#ffbd69';ctx.strokeStyle='#fff3b5';ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(b.x,b.y,Math.max(4,radius),0,Math.PI*2);ctx.fill();ctx.stroke();
    }
    ctx.restore();
  }
}
