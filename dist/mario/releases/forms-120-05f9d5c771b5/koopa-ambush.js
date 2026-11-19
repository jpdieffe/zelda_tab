import {M} from './memory.js';
import {player,sceneKey} from './engine.js';
import {tileAt} from './weapons.js';
import {BY_KEY} from './copy-forms/forms.js';
import {drawSprite} from './copy-forms/art.js';

// These extra actors do not consume the ROM's five normal enemy slots.
// Bosses, doors and native level controllers keep their original slots.
export class KoopaAmbush{
  constructor(kids){this.kids=kids;this.engine=kids.engine;this.clear();}
  clear(){this.koopas=[];this.scene=null;this.age=0;}
  start(){
    this.scene=sceneKey(this.engine.nes[0]);this.age=0;
    this.koopas=Array.from({length:20},(_,id)=>({id,delay:id*8,x:0,y:0,vy:0,live:false,dead:false}));
  }
  targets(){return this.koopas.filter(k=>k.live&&!k.dead).map(k=>({key:`ambush:${k.id}`,virtual:true,id:0x6c,form:BY_KEY.get('enemy-6c'),x:k.x,y:k.y,left:k.x-7,right:k.x+7,top:k.y-12,bottom:k.y+12}));}
  hit(t){const k=this.koopas.find(k=>`ambush:${k.id}`===t.key);if(!k||k.dead)return false;k.dead=true;this.kids.burst(k.x,k.y,'#96df72');this.engine.weapons.sound(k.x,k.y,M.Sound_QLevel1,8);return true;}
  step(){
    if(this.engine.paused)return;
    if(this.kids.levelPowers.ended()||this.scene!==sceneKey(this.engine.nes[0])){this.clear();return;}
    if(!this.kids.playable())return;
    this.age++;const p=player(this.engine.nes[0]),m=this.engine.nes[0].cpu.mem;
    for(const k of this.koopas){
      if(k.dead)continue;
      if(!k.live){if(k.delay-->0)continue;k.live=true;k.x=p.cameraX+264;k.y=p.cameraY+128;}
      const solid=(x,y)=>tileAt(this.engine.nes[0],x,y)?.solid;
      k.vy=Math.min(4,k.vy+.18);
      const nextX=k.x-1.25;
      if(!solid(nextX-7,k.y)&&!solid(nextX-7,k.y+9))k.x=nextX;
      else if(k.vy>=0)k.vy=-3.5;
      for(let i=0;i<4;i++){
        const nextY=k.y+k.vy/4;
        if(k.vy>=0&&(solid(k.x-5,nextY+12)||solid(k.x+5,nextY+12))){k.vy=0;break;}
        k.y=nextY;
      }
      if(k.x<p.cameraX-32||k.y>p.cameraY+240){k.dead=true;continue;}
      const t={key:`ambush:${k.id}`,virtual:true};
      if(this.kids.jet.active){if(Math.hypot(this.kids.jet.x-k.x,this.kids.jet.y-k.y)<44)this.hit(t);continue;}
      const bottom=p.y+32,top=bottom-p.height;
      if(p.x+14>k.x-7&&p.x+2<k.x+7&&bottom>k.y-12&&top<k.y+12){
        if(p.vy>0&&bottom<k.y+2){this.hit(t);m[M.Player_YVel]=(-56)&255;m[M.Player_InAir]=1;}
        else this.engine.forms.queueHurt();
      }
    }
  }
  draw(ctx){for(const k of this.koopas)if(k.live&&!k.dead){const sprite=this.engine.forms.sprites.image(BY_KEY.get('enemy-6c'),this.age,{walk:true});drawSprite(ctx,sprite,k.x-sprite.width/2,k.y+12-sprite.height,1,-1);}}
  snapshot(){return this.koopas.length?{scene:this.scene,age:this.age,koopas:this.koopas.map(k=>({...k}))}:null;}
  restore(saved){this.clear();if(saved?.scene!==sceneKey(this.engine.nes[0])||!Array.isArray(saved.koopas))return;this.scene=saved.scene;this.age=Number(saved.age)||0;this.koopas=saved.koopas.slice(0,20).filter(k=>['x','y','vy','delay','id'].every(key=>Number.isFinite(k[key]))).map(k=>({...k}));}
}
