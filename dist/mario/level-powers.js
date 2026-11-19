import {M} from './memory.js';
import {player,inLevel,sceneKey} from './engine.js';
import {BY_KEY} from './copy-forms/forms.js';
import {drawSprite} from './copy-forms/art.js';

const TYPES=new Set(['meteor','chomp']);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class LevelPowers {
  constructor(kids){this.kids=kids;this.engine=kids.engine;this.chomps=[];this.scene=null;}
  ended(){const n=this.engine.nes[0],m=n.cpu.mem;return !inLevel(n)||!!(m[M.Player_IsDying]||m[M.Player_EndLevel]||m[M.EndCard_Flag]||m[M.Level_ExitToMap])||m[M.Level_GetWandState]>=3;}
  grant({roles,type,giant}){
    if(!TYPES.has(type))return false;
    for(const role of roles)if(this.kids.kids[role])this.kids.kids[role].power={type,giant,level:true,cooldown:0};
    return true;
  }
  state(role){
    const power=this.kids.kids[role]?.power;if(!power?.level)return null;
    return {type:power.type,seconds:Math.ceil(power.cooldown/60),ready:!power.cooldown&&!this.engine.paused&&this.kids.playable()&&!this.kids.jet.active};
  }
  launch(role){
    if(!this.state(role)?.ready)return false;
    const k=this.kids.kids[role],p=player(this.engine.nes[0]),power=k.power;
    if(power.type==='meteor'){
      const target=k.target||this.kids.nearestEnemy(k)||{x:p.cameraX+128,y:p.cameraY+145};
      this.kids.meteors.push({x:clamp(target.x,p.cameraX+16,p.cameraX+240),y:clamp(target.y,p.cameraY+16,p.cameraY+190),left:45,giant:power.giant,role});
      power.cooldown=120;
    }else{
      const aim=this.kids.aim(k);this.chomps=this.chomps.filter(s=>s.role!==role);
      this.chomps.push({x:k.x+aim.x*40,y:k.y+aim.y*40,angle:Math.atan2(aim.y,aim.x),role,life:120,age:0});power.cooldown=120;
    }
    this.engine.weapons.sound(k.x,k.y,0x4f1,0x20);return true;
  }
  clear(){this.chomps=[];for(const k of Object.values(this.kids.kids))if(k.power?.level)k.power=null;}
  step(){
    if(this.engine.paused)return;
    if(this.ended()){this.clear();return;}
    const key=sceneKey(this.engine.nes[0]);if(key!==this.scene){this.chomps=[];this.scene=key;}
    if(!this.kids.playable()||this.kids.jet.active){this.chomps=[];return;}
    for(const k of Object.values(this.kids.kids))if(k.power?.level&&k.power.cooldown>0)k.power.cooldown--;
    for(const s of this.chomps){
      s.life--;s.age++;const k=this.kids.kids[s.role];
      for(let i=0;i<3;i++){
        const angle=s.angle+(s.age+(i+1)/3)*.13;
        s.x=k.x+Math.cos(angle)*40;s.y=k.y+Math.sin(angle)*40;
        const radius=8;
        for(const t of this.engine.weapons.targets())if(Math.hypot(Math.max(t.left-s.x,0,s.x-t.right),Math.max(t.top-s.y,0,s.y-t.bottom))<radius)this.kids.hit(t);
      }
    }
    this.chomps=this.chomps.filter(s=>s.life>0).slice(-24);
  }
  draw(ctx){
    for(const s of this.chomps){
      ctx.save();ctx.strokeStyle='#b9c8d9';ctx.lineWidth=2;
      const k=this.kids.kids[s.role];
      for(let i=0;i<6;i++){const t=i/6;ctx.beginPath();ctx.ellipse(k.x+(s.x-k.x)*t,k.y+(s.y-k.y)*t,3,2,Math.atan2(s.y-k.y,s.x-k.x),0,Math.PI*2);ctx.stroke();}
      const sprite=this.engine.forms.sprites.image(BY_KEY.get('enemy-89'),s.age,{walk:true}),scale=16/Math.max(sprite.width,sprite.height);
      drawSprite(ctx,sprite,s.x-sprite.width*scale/2,s.y-sprite.height*scale/2,scale,s.x<k.x?-1:1);ctx.restore();
    }
  }
  snapshot(){return Object.fromEntries(Object.values(this.kids.kids).filter(k=>k.power?.level).map(k=>[k.role,{...k.power}]));}
  restore(saved){this.clear();if(this.ended())return;for(const role of ['jj','michelle']){const p=saved?.[role];if(TYPES.has(p?.type))this.kids.kids[role].power={type:p.type,giant:!!p.giant,level:true,cooldown:clamp(Number(p.cooldown)||0,0,120)};}}
}
