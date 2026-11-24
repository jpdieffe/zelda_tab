import {POWERS,powerHint} from './reward-types.js?v=20261124-1';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const enabled=(role,c)=>c?.active&&(role!=='michelle'||c.enabled);
export class PowerRewards{
  constructor(lasers){this.lasers=lasers;this.timers={};this.missiles=[];this.meteors=[];this.bursts=[];this.effects=[];this.scene=null;}
  start(result){
    if(!POWERS[result.type]||!result.roles.length)return;
    for(const role of result.roles){
      delete this.timers[role];delete this.lasers.timers[role];delete this.lasers.aim[role];
      this.effects=this.effects.filter(p=>p.role!==role);this.missiles=this.missiles.filter(p=>p.role!==role);this.meteors=this.meteors.filter(p=>p.role!==role);
      if(result.type!=='laser')this.timers[role]={type:result.type,remaining:POWERS[result.type].seconds,giant:result.giant,cooldown:0,launched:false};
    }
    if(result.type==='laser')this.lasers.start(result);
  }
  syncCharacters(characters){
    for(const [role,c] of Object.entries(characters)){
      if(!c)continue;
      const t=this.timers[role],dinosaur=t?.type==='dinosaur'&&t.remaining>0;
      if(c.dinosaur&&!dinosaur&&role==='michelle')c.needsPlacement=true;
      c.dinosaur=Boolean(dinosaur);c.dinosaurGiant=Boolean(dinosaur&&t.giant);
    }
  }
  snapshot(){
    const result={};
    for(const role of this.lasers.roles)result[role]={type:'laser',remaining:this.lasers.timers[role].remaining,giant:this.lasers.timers[role].giant>0};
    for(const [role,t] of Object.entries(this.timers))if(t.remaining>0)result[role]={type:t.type,remaining:t.remaining,giant:t.giant};
    return Object.keys(result).length?result:null;
  }
  label(){return Object.entries(this.snapshot()||{}).map(([role,t])=>`${role==='jj'?'JJ':'Michelle'}: ${powerHint(t,role)}`).join(' | ');}
  update(dt,world,characters,hit,paused=false,sound=()=>{}){
    if(paused)return;
    if(!world?.active){this.missiles=[];this.meteors=[];this.bursts=[];this.effects=[];for(const t of Object.values(this.timers))if(t.type==='meteor'&&t.launched)t.remaining=0;return;}
    if(this.scene!==world.scene){
      this.missiles=[];this.meteors=[];this.bursts=[];this.effects=[];
      for(const t of Object.values(this.timers))if(t.type==='meteor'&&t.launched)t.remaining=0;
    }else{
      const dx=((world.cameraX-this.cameraX+32768)&65535)-32768,dy=((world.cameraY-this.cameraY+32768)&65535)-32768;
      for(const p of [...this.missiles,...this.meteors,...this.bursts,...this.effects]){p.x-=dx;p.y-=dy;}
    }
    this.scene=world.scene;this.cameraX=world.cameraX;this.cameraY=world.cameraY;
    for(const b of this.bursts)b.life-=dt;this.bursts=this.bursts.filter(b=>b.life>0);
    for(const effect of this.effects)effect.life-=dt;this.effects=this.effects.filter(p=>p.life>0&&enabled(p.role,characters[p.role])&&this.timers[p.role]?.remaining>0);
    const area=(p,type,giant)=>{const spec=POWERS[type],radius=giant?spec.teamRadius:spec.radius;for(const enemy of world.enemies)if(enemy.vulnerable&&distance(enemy,p)<=radius+(enemy.radius??7))hit(enemy,p,type,giant);};
    for(const [role,t] of Object.entries(this.timers)){
      if(t.remaining<=0)continue;
      const c=characters[role];t.cooldown-=dt;
      if(enabled(role,c)){
        if(t.type==='lightning'&&t.cooldown<=0){
          const targets=world.enemies.filter(e=>e.vulnerable&&distance(e,c)<160).sort((a,b)=>distance(a,c)-distance(b,c)).slice(0,t.giant?4:2);
          for(const target of targets){area(target,'lightning',t.giant);this.effects.push({role,type:'lightning',x:target.x,y:target.y,life:.3});}
          if(targets.length)sound('fire');t.cooldown=.65;
        }
        if(t.type==='fireballs'){
          this.effects=this.effects.filter(p=>p.role!==role||p.type!=='fireballs');t.angle=(t.angle||0)+dt*3;
          for(let i=0,n=t.giant?5:3;i<n;i++){const a=t.angle+i*Math.PI*2/n,p={role,type:'fireballs',x:c.x+Math.cos(a)*32,y:c.y+Math.sin(a)*32,life:.15};this.effects.push(p);if(t.cooldown<=0)area(p,'fireballs',t.giant);}
          if(t.cooldown<=0)t.cooldown=.12;
        }
        if(t.type==='shockwave'&&t.cooldown<=0){area(c,'shockwave',t.giant);this.effects.push({role,type:'shockwave',x:c.x,y:c.y,radius:t.giant?96:64,life:.55});sound('boom');t.cooldown=.9;}
        if(t.type==='dinosaur'&&t.cooldown<=0){area(c,'dinosaur',t.giant);t.cooldown=.12;}
        if(t.type==='missiles'&&t.cooldown<=0){
          const targets=world.enemies.filter(e=>e.vulnerable).sort((a,b)=>distance(a,c)-distance(b,c));
          for(const enemy of targets.slice(0,t.giant?4:2))this.missiles.push({role,x:c.x,y:c.y,target:{slot:enemy.slot,type:enemy.type},giant:t.giant,life:0,angle:0});
          if(targets.length)sound('fire');t.cooldown=t.giant?.18:.28;
        }
        if(t.type==='meteor'&&!t.launched){this.meteors.push({role,x:c.x,y:c.y,giant:t.giant,age:0,landed:false});t.launched=true;}
      }
      t.remaining=Math.max(0,t.remaining-dt);
    }
    for(const p of this.missiles){
      if(!enabled(p.role,characters[p.role])||this.timers[p.role]?.remaining<=0){p.done=true;continue;}
      p.life+=dt;
      let target=world.enemies.find(e=>e.slot===p.target.slot&&e.type===p.target.type&&e.vulnerable);
      if(!target)target=world.enemies.filter(e=>e.vulnerable).sort((a,b)=>distance(a,p)-distance(b,p))[0];
      if(!target||p.life>1.8){p.done=true;continue;}
      p.target={slot:target.slot,type:target.type};p.angle=Math.atan2(target.y-p.y,target.x-p.x);
      const d=distance(target,p),travel=Math.min(d,240*dt);p.x+=Math.cos(p.angle)*travel;p.y+=Math.sin(p.angle)*travel;
      if(d-travel<=(target.radius??7)+4){area(p,'missiles',p.giant);this.bursts.push({x:p.x,y:p.y,life:.25});p.done=true;}
    }
    this.missiles=this.missiles.filter(p=>!p.done);
    for(const p of this.meteors){
      if(!enabled(p.role,characters[p.role])){p.age=2;continue;}
      p.age+=dt;
      if(!p.landed&&p.age>=.7){area(p,'meteor',p.giant);sound('boom');p.landed=true;}
    }
    this.meteors=this.meteors.filter(p=>p.age<2);
    this.syncCharacters(characters);
  }
  draw(ctx,time){
    ctx.save();
    for(const p of this.effects){
      ctx.save();
      if(p.type==='lightning'){ctx.globalAlpha=Math.min(1,p.life*6);ctx.strokeStyle='#fffba9';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p.x-10,32);ctx.lineTo(p.x+7,p.y-25);ctx.lineTo(p.x-5,p.y-18);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.fillStyle='#b8dfff';ctx.beginPath();ctx.arc(p.x,p.y,9,0,Math.PI*2);ctx.fill();}
      if(p.type==='fireballs'){ctx.fillStyle='#ff773c';ctx.beginPath();ctx.arc(p.x,p.y,7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff4a5';ctx.beginPath();ctx.arc(p.x-1,p.y-1,4,0,Math.PI*2);ctx.fill();}
      if(p.type==='shockwave'){const progress=1-p.life/.55;ctx.globalAlpha=1-progress;ctx.lineWidth=4;for(let i=0;i<3;i++){ctx.strokeStyle=['#ffc5ef','#a5e8ff','#fff4aa'][i];ctx.beginPath();ctx.arc(p.x,p.y,Math.max(1,p.radius*progress-i*5),0,Math.PI*2);ctx.stroke();}}
      ctx.restore();
    }
    for(const p of this.missiles){
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.fillStyle='#ffae56';ctx.beginPath();ctx.moveTo(-6,-3);ctx.lineTo(-15-Math.sin(time/30)*3,0);ctx.lineTo(-6,3);ctx.fill();
      ctx.fillStyle=p.role==='jj'?'#a4ffd3':'#ebbcff';ctx.fillRect(-7,-3,10,6);ctx.beginPath();ctx.moveTo(3,-4);ctx.lineTo(9,0);ctx.lineTo(3,4);ctx.fill();ctx.restore();
    }
    for(const b of this.bursts){ctx.globalAlpha=b.life/.25;ctx.fillStyle='#ffe5a0';ctx.beginPath();ctx.arc(b.x,b.y,4+(1-b.life/.25)*14,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
    for(const p of this.meteors){
      const radius=p.giant?90:60;
      if(!p.landed){
        ctx.strokeStyle='#ffbf75';ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.beginPath();ctx.ellipse(p.x,p.y,radius*.6,12,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
        const height=(1-p.age/.7)*180,x=p.x+height*.25,y=p.y-height;
        ctx.fillStyle='#ff7c38';ctx.beginPath();ctx.moveTo(x-14,y);ctx.lineTo(x+30,y-65);ctx.lineTo(x+16,y+9);ctx.fill();ctx.fillStyle='#ffe191';ctx.beginPath();ctx.arc(x,y,p.giant?19:14,0,Math.PI*2);ctx.fill();ctx.fillStyle='#9f604e';ctx.beginPath();ctx.arc(x+2,y+2,p.giant?12:8,0,Math.PI*2);ctx.fill();
      }else{
        const progress=(p.age-.7)/1.3;ctx.globalAlpha=1-progress;ctx.fillStyle='#ffc57555';ctx.beginPath();ctx.arc(p.x,p.y,radius*Math.min(1,.2+progress*3),0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#ffe4a2';ctx.lineWidth=5*(1-progress)+1;ctx.stroke();
        ctx.fillStyle='#f39863';for(let i=0;i<12;i++){const a=i*Math.PI/6,d=radius*progress;ctx.fillRect(p.x+Math.cos(a)*d-3,p.y+Math.sin(a)*d-3,6,6);}ctx.globalAlpha=1;
      }
    }
    ctx.restore();
  }
}
