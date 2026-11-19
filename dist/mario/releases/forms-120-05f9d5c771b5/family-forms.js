import {Game} from './copy-forms/game.js';
import {FORMS,BY_KEY} from './copy-forms/forms.js';
import {M} from './memory.js';

// Run Copy Kingdom's forms on Dad's existing NES and video/audio stream.
// The family game owns input, saves, pausing and how forms are earned.
export class FamilyForms extends Game {
  constructor(engine){
    super(engine.rom,{nes:engine.nes[0],pixels:engine.frames[0],onMessage:message=>engine.onEvent(message)});
    this.engine=engine;
    const original=this.nes.copyHooks[0xa478];
    this.nes.copyHooks[0xa478]=cpu=>{
      if(this.hurtReturn){const saved=this.hurtReturn;this.hurtReturn=null;cpu.REG_ACC=saved.a;cpu.REG_X=saved.x;cpu.REG_Y=saved.y;cpu.setStatus(saved.status);this.m.set(saved.temp,0);return;}
      if(this.pendingHurt&&Array.from({length:6},(_,i)=>i).every(i=>cpu.loadFromCartridge(0xa478+i)===this.rom[16+8*8192+0x478+i])){
        this.pendingHurt=false;
        if(this.active&&Array.from({length:6},(_,i)=>i).every(i=>cpu.loadFromCartridge(0xd9d3+i)===this.rom[16+0x19d3+i])){
          // Call the native hurt routine at the same safe frame boundary used
          // by shell block hits. It owns suit loss, death and invulnerability.
          this.hurtReturn={a:cpu.REG_ACC,x:cpu.REG_X,y:cpu.REG_Y,status:cpu.getStatus(),temp:this.m.slice(0,16)};
          if(this.custom)this.lostForm=true;
          cpu.push(0xa4);cpu.push(0x77);cpu.REG_PC=0xd9d2;return cpu.loadFromCartridge(0xd9d3);
        }
      }
      return original(cpu);
    };
  }
  queueHurt(){if(this.active&&!this.engine.vehicle?.active&&!this.form.invulnerable&&!this.phaseTime&&!this.m[M.Player_FlashInv]&&!this.m[0x553]&&!this.m[M.Player_SuitLost]&&!this.m[M.Player_Grow])this.pendingHurt=true;}
  actors(){return [...super.actors(),...(this.engine?.ambush?.targets()||[])];}
  defeat(target){if(target.virtual)return this.engine.ambush.hit(target);if(target.id===0xaf&&!target.special)return this.engine.sun.hit(target);return super.defeat(target);}
  capture(target){if(target.virtual){this.receive('enemy-6c');this.engine.ambush.hit(target);return;}super.capture(target);}
  get currentKey(){
    return !this.custom&&!this.form.shoe&&!this.form.star
      ? `mario-${Math.min(6,this.m[M.Player_Suit])}` : this.form.key;
  }
  receive(key){
    const form=BY_KEY.get(key);if(!form)return false;
    const wasSmall=!this.m[M.Player_Suit];
    this.select(key);
    this.m[M.Player_Statue]=0;this.m[0x56f]=0;
    this.previousMask=this.mask;
    // Native animations apply the queued suit without interrupting the ROM.
    if(wasSmall&&(form.suit??1)>0){this.m[M.Player_Grow]=0x2f;this.m[M.Sound_QLevel1]|=0x20;}
    else if(form.suit===2){this.m[M.Player_StarOff]=0x1f;this.m[M.Sound_QLevel1]|=0x20;}
    else{this.m[M.Player_SuitLost]=0x17;this.m[M.Sound_QLevel1]|=0x80;}
    return true;
  }
  reset(saved){
    this.pendingHurt=false;this.hurtReturn=null;
    this.form=BY_KEY.get(saved?.key)??FORMS[Math.min(6,this.m[M.Player_Suit])];
    this.clearEffects();this.release();this.lastScene=this.scene;this.nes.hideMario=false;
    this.frame=Number.isFinite(saved?.frame)?saved.frame:0;
    this.plantExtension=Number.isFinite(saved?.plantExtension)?Math.max(0,Math.min(1,saved.plantExtension)):1;
    this.spikeHeight=Number.isFinite(saved?.spikeHeight)?Math.max(-8,Math.min(120,saved.spikeHeight)):40;
    this.sprites.restore(saved?.sprites);
  }
  snapshot(){return {key:this.form.key,frame:this.frame,plantExtension:this.plantExtension,spikeHeight:this.spikeHeight,sprites:this.sprites.serialize()};}
  get hint(){return `${this.form.name} · ${this.form.description} ${this.form.motion}`.replaceAll('X','Run / X').replaceAll('Special','Run / Power');}
}
