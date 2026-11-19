import {M,OBJECT_FIELDS} from './memory.js';
import {inLevel,sceneKey,player} from './engine.js';

export const SUN_HEALTH=60;
export class SunBoss{
  constructor(engine){this.engine=engine;this.reset();}
  reset(){this.scene=null;this.records=new Map();this.before=[];}
  identity(slot){const m=this.engine.nes[0].cpu.mem;return `${m[0x659+slot]}:${slot}`;}
  record(slot){const key=this.identity(slot);if(!this.records.has(key))this.records.set(key,{hp:SUN_HEALTH,cooldown:0});return this.records.get(key);}
  prepare(){
    const e=this.engine,m=e.nes[0].cpu.mem,key=sceneKey(e.nes[0]);
    if(!inLevel(e.nes[0])||m[M.Player_IsDying]){this.reset();return;}
    if(this.scene!==key){this.reset();this.scene=key;}
    for(const r of this.records.values())if(r.cooldown>0)r.cooldown--;
    this.before=[];
    for(let slot=0;slot<8;slot++)if(m[0x671+slot]===0xaf&&m[0x661+slot]>=2&&m[0x661+slot]!==4){
      const r=this.record(slot);if(!r.hp){this.finish(slot);continue;}
      this.before.push({slot,fields:OBJECT_FIELDS.filter(([,a,n])=>slot<n).map(([,a])=>[a,m[a+slot]])});
    }
  }
  finish(slot){
    const e=this.engine,m=e.nes[0].cpu.mem;m[0x661+slot]=0;
    const spawn=m[0x659+slot];if(spawn<48)m[0x7b10+spawn]=0x80;
    const key=e.slotKeys[0][slot];if(key)e.entities.set(key,{dead:true});
  }
  hit(t){
    const m=this.engine.nes[0].cpu.mem;if(t.special||m[0x671+t.slot]!==0xaf)return false;
    const r=this.record(t.slot);if(!r.hp||r.cooldown)return false;
    r.hp--;r.cooldown=8;this.engine.weapons.sound(t.x,t.y,M.Sound_QLevel1,8);
    if(!r.hp){this.finish(t.slot);return true;}return false;
  }
  reconcile(){
    const e=this.engine,m=e.nes[0].cpu.mem;if(this.scene!==sceneKey(e.nes[0]))return;
    const p=player(e.nes[0]);
    for(const before of this.before){
      const slot=before.slot;if(m[0x671+slot]!==0xaf)continue;
      const x=m[0x91+slot]+m[0x76+slot]*256,y=m[0xa3+slot]+m[0x88+slot]*256;
      // Offscreen unloading remains native. A visible native shell/fireball
      // kill counts as one hit and restores the live Sun until its HP is gone.
      if((m[0x661+slot]===4||!m[0x661+slot])&&x>p.cameraX-32&&x<p.cameraX+288&&y<p.cameraY+224){
        const r=this.record(slot);if(!r.hp)continue;
        this.hit({slot,x,y});if(!r.hp)continue;
        for(const [a,value]of before.fields)m[a+slot]=value;
        const spawn=m[0x659+slot];if(spawn<48)m[0x7b10+spawn]=0;
      }
    }
  }
  draw(ctx){
    const e=this.engine,m=e.nes[0].cpu.mem,p=player(e.nes[0]);if(!inLevel(e.nes[0]))return;
    for(let slot=0;slot<8;slot++)if(m[0x671+slot]===0xaf&&m[0x661+slot]>=2&&m[0x661+slot]!==4){
      const x=m[0x91+slot]+m[0x76+slot]*256;if(x<p.cameraX-40||x>p.cameraX+288)continue;
      const r=this.record(slot);if(!r.hp)continue;
      ctx.save();ctx.fillStyle='#14202a';ctx.fillRect(58,3,140,19);ctx.fillStyle='#fff0a5';ctx.font='7px sans-serif';ctx.textAlign='center';ctx.fillText(`ANGRY SUN  ${r.hp}/${SUN_HEALTH}`,128,10);ctx.fillStyle='#633f32';ctx.fillRect(64,13,128,5);ctx.fillStyle=r.cooldown?'#fff5b5':'#ffc34f';ctx.fillRect(64,13,128*r.hp/SUN_HEALTH,5);ctx.restore();break;
    }
  }
  snapshot(){return {scene:this.scene,records:[...this.records].map(([key,r])=>[key,{...r}])};}
  restore(saved){this.reset();if(saved?.scene!==sceneKey(this.engine.nes[0])||!Array.isArray(saved.records))return;this.scene=saved.scene;for(const [key,r]of saved.records.slice(0,8))if(Number.isFinite(r?.hp))this.records.set(key,{hp:Math.max(0,Math.min(SUN_HEALTH,r.hp)),cooldown:Math.max(0,Math.min(8,Number(r.cooldown)||0))});}
}
