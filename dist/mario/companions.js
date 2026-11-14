import {player, inLevel, sceneKey} from './engine.js';
import {M} from './memory.js';
import {tileAt} from './weapons.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const center=t=>({x:(t.left+t.right)/2,y:(t.top+t.bottom)/2});
const colors={jj:'#64ef9f',michelle:'#f6adff'};
export class Companions {
  constructor(engine){
    this.engine=engine;this.key=null;this.time=0;this.shots=[];this.particles=[];this.meteors=[];this.hearts=[];this.heartCooldown=0;
    this.kids=Object.fromEntries(['jj','michelle'].map(role=>[role,{role,x:0,y:0,vx:0,vy:0,face:1,mask:0,until:0,target:null,flap:false,segments:[],cooldown:0,hurt:0,power:null,active:false}]));
    this.stats={shots:0,hits:0,returns:0};
  }
  playable(){const n=this.engine.nes[0],m=n.cpu.mem;return inLevel(n)&&!m[M.Player_IsDying]&&!m[M.Player_InPipe]&&!m[M.Player_EndLevel]&&!m[M.Player_HaltGame]&&!m[M.Player_HaltTick];}
  input(role,data,now=performance.now()){
    const k=this.kids[role];if(!k||!Number.isInteger(data.mask)||data.mask<0||data.mask>255)return false;
    if((data.mask&1)&&!(k.mask&1))k.flap=true;
    k.mask=data.mask;k.until=now+350;if(data.mask&241||data.target)k.active=true;
    if(data.target&&Number.isFinite(data.target.x)&&Number.isFinite(data.target.y)){
      const p=player(this.engine.nes[0]);k.target={x:p.cameraX+clamp(data.target.x,8,248),y:p.cameraY+clamp(data.target.y,8,200)};
    }else k.target=null;
    return true;
  }
  release(role){const k=this.kids[role];if(k){k.mask=0;k.until=0;k.target=null;k.flap=false;}}
  reset(){this.key=null;this.shots=[];this.particles=[];this.meteors=[];this.hearts=[];this.heartCooldown=0;for(const k of Object.values(this.kids)){this.release(k.role);k.power=null;}}
  heartReady(){return !this.engine.paused&&this.playable()&&!this.heartCooldown;}
  sendHeart(role){
    if(role!=='michelle'||!this.heartReady())return false;
    const k=this.kids.michelle;this.hearts.push({x:k.x,y:k.y,life:180,age:0,trail:[]});this.heartCooldown=300;return true;
  }
  deliverMushroom(){
    if(this.engine.paused||!this.playable())return false;
    const m=this.engine.nes[0].cpu.mem;
    // Match the ROM's mushroom pickup: queued Super form, growth and pickup sound.
    // Never replace an existing transformation, stronger suit, or death action.
    if(!m[M.Player_Suit]&&!m[M.Player_QueueSuit]&&!m[M.Player_Grow]&&!m[M.Player_SuitLost]){
      m[M.Player_QueueSuit]=2;
      if(m[M.Player_Kuribo])m[M.Player_SuitLost]=0x1f;else m[M.Player_Grow]=0x2f;
    }
    m[M.Sound_QLevel1]|=0x20;return true;
  }
  nearestEnemy(origin){
    const p=player(this.engine.nes[0]);let closest=null,best=Infinity;
    for(const target of this.engine.weapons.targets()){
      if(target.right<=p.cameraX||target.left>=p.cameraX+256||target.bottom<=p.cameraY||target.top>=p.cameraY+208)continue;
      const point=center(target),d=distance(origin,point);if(d<best){closest=point;best=d;}
    }
    return closest;
  }
  regroup(k,p=player(this.engine.nes[0])){
    k.x=clamp(p.x+(k.role==='jj'?-20:28),p.cameraX+16,p.cameraX+240);
    k.y=clamp(p.y+(k.role==='jj'?-16:12),p.cameraY+20,p.cameraY+182);
    k.vx=k.vy=0;k.segments=Array.from({length:8},(_,i)=>({x:k.x-(i+1)*5,y:k.y}));k.hurt=45;
  }
  grant({roles,giant,type}){
    for(const role of roles){const k=this.kids[role];if(!k)continue;
      k.power={type,giant,left:type==='missiles'?300:type==='meteor'?120:1200};
      if(type==='meteor')this.meteors.push({x:k.x,y:k.y,left:65,giant,role});
    }
  }
  burst(x,y,color,count=12){for(let i=0;i<count;i++){const angle=i/count*Math.PI*2;this.particles.push({x,y,vx:Math.cos(angle)*(1+i%3),vy:Math.sin(angle)*(1+i%3),life:22,max:22,color,size:2});}}
  hit(target){this.engine.weapons.hit(target);this.stats.hits++;const p=center(target);this.burst(p.x,p.y,'#ffec9d');}
  attack(k,missile=false){
    let dx=k.face,dy=0;
    const near=this.nearestEnemy(k);
    if(near){const d=Math.max(1,distance(k,near));dx=(near.x-k.x)/d;dy=(near.y-k.y)/d;}
    else if(k.mask&48){dy=k.mask&16?-1:1;dx=k.mask&192?k.face:0;const d=Math.hypot(dx,dy);dx/=d;dy/=d;}
    this.shots.push({x:k.x,y:k.y,dx,dy,role:k.role,life:90,trail:[],missile});this.stats.shots++;
    this.engine.weapons.sound(k.x,k.y,0x4f1,0x20);
  }
  solid(x,y){return !!tileAt(this.engine.nes[0],x,y)?.solid;}
  moveUnicorn(k,dx,dy){
    const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/2));
    for(let i=0;i<steps;i++){
      const nx=k.x+dx/steps,ny=k.y+dy/steps;
      if(![k.y-6,k.y,k.y+6].some(y=>this.solid(nx+Math.sign(dx)*9,y)))k.x=nx;
      if(![k.x-6,k.x+6].some(x=>this.solid(x,ny+Math.sign(dy)*9)))k.y=ny;
      else k.vy=0;
    }
  }
  step(now=performance.now()){
    if(this.engine.paused)return;
    const p=player(this.engine.nes[0]),key=sceneKey(this.engine.nes[0]);
    if(this.key!==key){this.key=key;this.shots=[];this.meteors=[];this.particles=[];this.hearts=[];for(const k of Object.values(this.kids)){this.regroup(k,p);this.release(k.role);}}
    if(!this.playable()){this.shots=[];this.meteors=[];this.hearts=[];for(const k of Object.values(this.kids))this.release(k.role);return;}
    this.time++;
    if(this.heartCooldown>0)this.heartCooldown--;
    const dad={x:p.x+8,y:p.y+32-p.height/2};
    for(const heart of this.hearts){
      heart.age++;heart.life--;heart.trail.unshift({x:heart.x,y:heart.y});heart.trail.length=Math.min(heart.trail.length,10);
      const d=distance(heart,dad),speed=Math.min(3.2,d);heart.x+=(dad.x-heart.x)/Math.max(1,d)*speed;heart.y+=(dad.y-heart.y)/Math.max(1,d)*speed;
      if(distance(heart,dad)<5&&heart.age>=12){this.deliverMushroom();this.burst(dad.x,dad.y,'#ff9bc6',18);heart.life=0;}
    }
    this.hearts=this.hearts.filter(heart=>heart.life>0);
    for(const k of Object.values(this.kids)){
      if(now>k.until){k.mask=0;k.target=null;k.flap=false;}
      if(k.cooldown>0)k.cooldown--;if(k.hurt>0)k.hurt--;
      if(k.power&&--k.power.left<=0){if(k.power.type==='dinosaur'&&k.role==='michelle')this.regroup(k,p);k.power=null;}
      const dx=(k.mask&128?1:0)-(k.mask&64?1:0),dy=(k.mask&32?1:0)-(k.mask&16?1:0);
      if(dx)k.face=dx;
      if(k.role==='jj'){
        let mx=dx*2.5,my=dy*2.5;
        if(k.target){const d=distance(k,k.target);mx=(k.target.x-k.x)/Math.max(1,d)*Math.min(2.8,d);my=(k.target.y-k.y)/Math.max(1,d)*Math.min(2.8,d);}
        if(!k.active){mx=clamp(p.x-20-k.x,-2.1,2.1);my=clamp(p.y-20-k.y,-2.1,2.1);}
        k.x+=mx;k.y+=my;if(Math.abs(mx)>.1)k.face=Math.sign(mx);
      }else{
        if(k.flap){k.vy=-3.7;this.burst(k.x,k.y+8,'#f6adff',6);}k.flap=false;
        k.vy=Math.min(0.65,k.vy+0.13);
        if(!k.active&&Math.abs(p.x+24-k.x)>36){k.x+=clamp(p.x+24-k.x,-2,2);if(k.y>p.y+12)k.vy=-2;}
        if(k.power?.type==='dinosaur'){k.x+=dx*2.2;k.y+=k.vy;}else this.moveUnicorn(k,dx*2.2,k.vy);
      }
      // Camera rescue, including pits and scrolling: neither child has a death state.
      if(k.x<p.cameraX-28||k.x>p.cameraX+284||k.y>p.cameraY+204||k.y<p.cameraY-50){this.regroup(k,p);this.stats.returns++;this.burst(k.x,k.y,colors[k.role]);}
      k.y=Math.max(p.cameraY+9,k.y);
      if(k.role==='jj'){
        let previous=k;
        for(const segment of k.segments){const d=distance(segment,previous);if(d>5){segment.x=previous.x+(segment.x-previous.x)*5/d;segment.y=previous.y+(segment.y-previous.y)*5/d;}previous=segment;}
      }
      const targets=this.engine.weapons.targets();
      for(const target of targets){const t=center(target),d=distance(k,t);
        if(k.power?.type==='dinosaur'&&d<(k.power.giant?37:26)){this.hit(target);continue;}
        if(!k.hurt&&d<15){k.x+=k.x<t.x?-12:12;k.vy=-2;k.hurt=60;this.burst(k.x,k.y,colors[k.role],7);}
      }
      if(k.power?.type==='laser'){
        const aim=this.aim(k);k.beam=aim;
        if(this.time%6===0)for(const target of targets){const t=center(target),vx=t.x-k.x,vy=t.y-k.y,along=vx*aim.x+vy*aim.y,across=Math.abs(vx*aim.y-vy*aim.x);if(along>0&&along<280&&across<(k.power.giant?18:9))this.hit(target);}
      }
      if(k.power?.type==='missiles'&&this.time%12===0){this.attack(k,true);if(k.power.giant)this.attack(k,true);}
      if(k.mask&2&&!k.cooldown){this.attack(k);k.cooldown=k.role==='jj'?17:24;}
    }
    for(const shot of this.shots){
      shot.life--;shot.trail.unshift({x:shot.x,y:shot.y});shot.trail.length=Math.min(shot.trail.length,15);
      if(shot.missile){const target=this.nearestEnemy(shot);if(target){const d=Math.max(1,distance(shot,target));shot.dx+=(target.x-shot.x)/d*.18;shot.dy+=(target.y-shot.y)/d*.18;const v=Math.hypot(shot.dx,shot.dy);shot.dx/=v;shot.dy/=v;}}
      for(let sub=0;sub<3&&shot.life>0;sub++){
        shot.x+=shot.dx*1.6;shot.y+=shot.dy*1.6;
        if(!shot.missile&&this.solid(shot.x,shot.y)){shot.life=0;this.burst(shot.x,shot.y,shot.role==='jj'?'#ffb73e':'#f6adff');break;}
        const target=this.engine.weapons.targets().find(t=>shot.x>=t.left-4&&shot.x<=t.right+4&&shot.y>=t.top-4&&shot.y<=t.bottom+4);
        if(target){this.hit(target);shot.life=0;}
      }
    }
    this.shots=this.shots.filter(s=>s.life>0).slice(-64);
    for(const meteor of this.meteors)if(--meteor.left===0){const radius=meteor.giant?90:60;for(const target of this.engine.weapons.targets())if(distance(meteor,center(target))<radius)this.hit(target);this.burst(meteor.x,meteor.y,'#ffac45',40);this.engine.weapons.sound(meteor.x,meteor.y,0x4f3,1);}
    this.meteors=this.meteors.filter(m=>m.left>0);
    for(const particle of this.particles){particle.life--;particle.x+=particle.vx;particle.y+=particle.vy;particle.vy+=.035;}
    this.particles=this.particles.filter(p=>p.life>0).slice(-220);
  }
  aim(k){const target=this.nearestEnemy(k)||k.target;if(target){const d=Math.max(1,distance(k,target));return {x:(target.x-k.x)/d,y:(target.y-k.y)/d};}let x=k.mask&192?k.face:0,y=(k.mask&32?1:0)-(k.mask&16?1:0);if(!x&&!y)x=k.face;const d=Math.hypot(x,y);return {x:x/d,y:y/d};}
  draw(ctx){
    if(!inLevel(this.engine.nes[0]))return;
    const p=player(this.engine.nes[0]);ctx.save();ctx.beginPath();ctx.rect(0,0,256,208);ctx.clip();ctx.translate(-p.cameraX,-p.cameraY);
    for(const h of this.hearts){
      for(let i=h.trail.length-1;i>=0;i--){ctx.globalAlpha=(1-i/10)*.45;ctx.fillStyle='#ff9bc6';circle(ctx,h.trail[i].x,h.trail[i].y,2-i*.12);}ctx.globalAlpha=1;
      ctx.save();ctx.translate(h.x,h.y);ctx.fillStyle='#ff81b5';ctx.strokeStyle='#fff1f6';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(0,6);ctx.bezierCurveTo(-14,-2,-5,-10,0,-4);ctx.bezierCurveTo(5,-10,14,-2,0,6);ctx.fill();ctx.stroke();ctx.restore();
    }
    for(const s of this.shots){
      for(let i=s.trail.length-1;i>=0;i--){ctx.globalAlpha=(1-i/16)*.75;ctx.fillStyle=s.role==='jj'?(i>6?'#f34c31':'#ffb52e'):['#ff9cdd','#ffd767','#a4f5eb','#b59bff'][i%4];circle(ctx,s.trail[i].x,s.trail[i].y,Math.max(.6,4-i*.23));}
      ctx.globalAlpha=1;ctx.fillStyle=s.role==='jj'?'#fff4a8':'#fff5ff';circle(ctx,s.x,s.y,3.6);
    }
    for(const k of Object.values(this.kids)){
      ctx.save();ctx.globalAlpha=k.hurt&&this.time%8<4?.55:1;
      const scale=k.power?.type==='dinosaur'?(k.power.giant?2.2:1.65):1;
      if(k.role==='jj'&&scale===1){for(let i=k.segments.length-1;i>=0;i--){const s=k.segments[i];ctx.fillStyle=i%2?'#2bad75':'#46cf83';ctx.strokeStyle='#153c3b';ctx.lineWidth=.8;circle(ctx,s.x,s.y,Math.max(1.2,5-i*.4),true);ctx.fillStyle='#d5f897';triangle(ctx,s.x-2,s.y-3,s.x,s.y-7,s.x+2,s.y-3);}}
      ctx.translate(k.x,k.y);ctx.scale(k.face*scale,scale);
      if(k.role==='jj'||k.power?.type==='dinosaur')dragon(ctx,this.time,k.power?.type==='dinosaur'&&k.role==='michelle'?'#e99de8':'#5de59a');else unicorn(ctx,this.time);
      ctx.restore();
      if(k.power?.type==='laser'){
        const a=k.beam||{x:k.face,y:0};ctx.strokeStyle=colors[k.role];ctx.globalAlpha=.45+.2*Math.sin(this.time);ctx.lineWidth=k.power.giant?16:7;line(ctx,k.x,k.y,k.x+a.x*280,k.y+a.y*280);ctx.globalAlpha=1;ctx.lineWidth=2;ctx.strokeStyle='#fff';line(ctx,k.x,k.y,k.x+a.x*280,k.y+a.y*280);
      }
    }
    for(const m of this.meteors){ctx.strokeStyle='#ffda77';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(m.x,m.y,m.giant?24:16,0,Math.PI*2);ctx.stroke();line(ctx,m.x-10,m.y,m.x+10,m.y);line(ctx,m.x,m.y-10,m.x,m.y+10);const y=m.y-m.left*4;ctx.fillStyle='#ff9f32';triangle(ctx,m.x-10,y,m.x+10,y,m.x-16,y-45);circle(ctx,m.x,y,12);ctx.fillStyle='#fff1a5';circle(ctx,m.x+2,y+2,7);}
    for(const s of this.particles){ctx.globalAlpha=s.life/s.max;ctx.fillStyle=s.color;circle(ctx,s.x,s.y,s.size);}
    ctx.restore();
  }
}
function circle(ctx,x,y,r,stroke=false){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();if(stroke)ctx.stroke();}
function triangle(ctx,x,y,x2,y2,x3,y3){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.lineTo(x3,y3);ctx.closePath();ctx.fill();}
function line(ctx,x,y,x2,y2){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();}
export function dragon(ctx,time,color='#5de59a'){
  const flap=Math.sin(time*.23)*5;ctx.lineJoin='round';ctx.strokeStyle='#183d42';ctx.lineWidth=1;
  ctx.fillStyle='#347d99';triangle(ctx,-5,0,-14,-16+flap,-1,-8);ctx.fillStyle='#88e5db';triangle(ctx,-4,-1,-11,-12+flap,-3,-6);
  ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(1,0,9,6,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#d5f4ac';ctx.beginPath();ctx.ellipse(5,3,6,2,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=color;ctx.fillRect(5,-3,9,6);ctx.strokeRect(5,-3,9,6);
  ctx.fillStyle='#fff1ba';triangle(ctx,-2,-5,-2,-12,2,-5);triangle(ctx,5,-5,6,-10,8,-4);
  ctx.fillStyle='#fff';circle(ctx,6,-4,3);ctx.fillStyle='#173d3a';circle(ctx,7,-4,1.4);ctx.fillRect(11,-1,1,1);
  ctx.fillStyle='#26799a';triangle(ctx,-6,1,-12,-13-flap,1,-2);ctx.fillStyle='#81dbcd';triangle(ctx,-5,0,-10,-10-flap,-1,-2);
}
export function unicorn(ctx,time){
  const leg=Math.sin(time*.2)*2;ctx.strokeStyle='#784674';ctx.lineWidth=1;ctx.lineJoin='round';
  ['#d49bfa','#92e6ed','#ffafd7'].forEach((c,i)=>{ctx.strokeStyle=c;ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(-7,0);ctx.quadraticCurveTo(-15,-5+i*3,-13,7+i+Math.sin(time*.15)*2);ctx.stroke();});
  ctx.strokeStyle='#784674';ctx.fillStyle='#fff2fa';ctx.beginPath();ctx.ellipse(-1,1,9,5,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillRect(-7,4,3,6+leg);ctx.fillRect(3,4,3,6-leg);ctx.fillStyle='#ca8de6';ctx.fillRect(-7,9+leg,4,2);ctx.fillRect(3,9-leg,4,2);
  ctx.fillStyle='#fff2fa';ctx.beginPath();ctx.moveTo(2,1);ctx.lineTo(3,-9);ctx.lineTo(10,-10);ctx.lineTo(14,-5);ctx.lineTo(12,-1);ctx.lineTo(6,-2);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#b798ef';ctx.beginPath();ctx.moveTo(4,-10);ctx.quadraticCurveTo(-3,-8,0,2);ctx.lineTo(4,-2);ctx.fill();
  ctx.fillStyle='#fff2fa';triangle(ctx,5,-9,4,-15,8,-10);ctx.fillStyle='#ffdc74';triangle(ctx,10,-9,13,-19,13,-7);
  ctx.fillStyle='#533359';circle(ctx,10,-6,1.3);ctx.fillStyle='#f3a2d6';circle(ctx,11,-3,1.4);
}
