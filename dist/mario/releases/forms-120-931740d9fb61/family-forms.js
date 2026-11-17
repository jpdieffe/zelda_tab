import {Game} from './copy-forms/game.js';
import {FORMS,BY_KEY} from './copy-forms/forms.js';
import {M} from './memory.js';

// Run Copy Kingdom's forms on Dad's existing NES and video/audio stream.
// The family game owns input, saves, pausing and how forms are earned.
export class FamilyForms extends Game {
  constructor(engine){
    super(engine.rom,{nes:engine.nes[0],pixels:engine.frames[0],onMessage:message=>engine.onEvent(message)});
  }
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
