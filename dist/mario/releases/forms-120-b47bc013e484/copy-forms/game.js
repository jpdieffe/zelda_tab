import {NES} from '../vendor/jsnes/index.js';
import {M} from './memory.js';
import {FORMS,BY_KEY,enemyForm,specialForm,tileForm} from './forms.js';
import {SpriteLibrary} from './sprites.js';

export const signed=n=>n>127?n-256:n;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export function tileAt(nes,x,y){
  const m=nes.cpu.mem,vertical=!!m[M.Level_7Vertical];
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=(vertical?256:3840)||y>=(vertical?3840:432))return null;
  const col=Math.floor(x/16),row=Math.floor(y/16);
  const index=vertical?row*16+col:Math.floor(col/16)*432+row*16+col%16;
  const value=m[0x6000+index],giant=m[M.Level_Tileset]===11&&value>=0x47&&value<=0x4a;
  const brick=value===0x67||value===0x32||giant;
  const solid=brick||value>=Math.min(m[0x7e94+(value>>6)],m[0x7e98+(value>>6)]);
  return {index,value,x:col*16,y:row*16,solid,brick,giant};
}
export class Game {
  constructor(rom,{onAudio=()=>{},onChange=()=>{},onMessage=()=>{},nes,pixels}={}){
    this.rom=rom;this.onChange=onChange;this.onMessage=onMessage;this.sprites=new SpriteLibrary(rom);
    this.pixels=pixels??new Uint32Array(256*240);
    this.nes=nes??new NES({emulateSound:true,sampleRate:44100,onAudioSample:onAudio,onFrame:f=>this.pixels.set(f)});
    if(!nes)this.nes.loadROM(rom);
    this.frame=0;this.mask=0;this.previousMask=0;this.extra={};this.form=FORMS[0];this.facing=1;
    this.paused=false;this.copied=new Set();this.stats={copies:0,shots:0,hits:0,bricks:0};
    this.clearEffects();this.installHooks();
  }
  get m(){return this.nes.cpu.mem;}
  get inLevel(){const t=this.m[M.Level_Tileset];return t>0&&t<15;}
  get active(){return this.inLevel&&!this.m[M.Player_IsDying]&&!this.m[M.Player_InPipe]&&!this.m[M.Level_PipeMove]&&!this.m[M.Player_EndLevel]&&!this.m[M.Player_HaltGame]&&!this.m[M.Player_HaltTick];}
  get custom(){return this.form.suit===undefined;}
  get scene(){return [M.Level_Tileset,M.Level_LayPtrOrig_AddrL,M.Level_LayPtrOrig_AddrH,M.Level_ObjPtrOrig_AddrL,M.Level_ObjPtrOrig_AddrH].map(a=>this.m[a]).join(':');}
  get position(){const m=this.m;return {x:m[M.Player_X]+256*m[M.Player_XHi],y:m[M.Player_Y]+256*m[M.Player_YHi],cameraX:m[M.Horz_Scroll]+256*m[M.Horz_Scroll_Hi],cameraY:m[M.Level_VertScroll]+256*m[M.Level_VertScrollH]};}
  get spritePose(){const spit=this.shots.find(s=>s.kind==='spike-spit'&&!s.launched);return {shell:this.shell,collapsed:!!(this.form.collapse&&(this.mask&32)),walk:!!(this.mask&192)||!!this.shellDirection||!!this.shellDrift||!!this.form.fly||!!this.form.winged||['chomp','disc'].includes(this.form.family),extension:this.plantExtension,spitAge:spit?Math.max(0,spit.age-1):-1};}
  get shellSpeed(){return this.form.shellSpeed??Math.min(this.form.power??60,48);}
  get center(){
    const p=this.position;
    if(this.form.extendable){
      const sprite=this.sprites.image(this.form,this.frame,this.spritePose);
      if(sprite)return {x:p.x+8+(this.form.plantAxis==='x'?this.facing*(sprite.width/2-8):0),y:p.y+33-(this.form.plantInverted?8:this.form.plantAxis==='x'?sprite.height/2:sprite.height-8)};
    }
    return {x:p.x+8,y:p.y+(this.custom?20:this.m[M.Player_Suit]?17:24)};
  }
  clearEffects(){this.shots=[];this.effects=[];this.copyCooldown=0;this.powerCooldown=0;this.phaseTime=0;this.dashTime=0;this.dashX=0;this.dashY=null;this.slam=false;this.orbitTime=0;this.shell=false;this.shellDirection=0;this.shellJumpBlocked=false;this.shellStopped=false;this.shellDrift=0;this.shellBlockPending=null;this.shellBlockReturn=null;this.airUsed=0;this.jumpY=null;this.flapTime=0;this.plantExtension=1;this.spikeHeight=40;this.spikeBall=null;this.spikeRespawn=0;this.snakeHistory=[];this.snakeTail=[];}
  input(mask,extra={}){this.mask=mask&255;this.extra=extra;}
  release(){this.mask=0;this.previousMask=0;this.extra={};}
  select(key,{quiet=false}={}){
    const f=BY_KEY.get(key);if(!f)return false;
    this.form=f;this.clearEffects();
    this.m[M.Player_QueueSuit]=(f.suit??1)+1;
    this.m[0x577]=f.shoe?1:0;this.m[0x553]=f.star?255:0;
    this.m[0x550]=0; // Clear shoe direction when taking it off.
    this.m[0x54f]=0; // Clear a previous suit's somersault animation.
    if(!quiet){const p=this.center;this.burst(p.x,p.y,f.color,22);this.onMessage(f.name);}
    this.onChange(f);return true;
  }
  cycle(delta=1){const index=FORMS.indexOf(this.form);this.select(FORMS[(index+delta+FORMS.length)%FORMS.length].key);}
  installHooks(){
    const g=this,n=this.nes;
    // The original shoe borrows CHR bank $0b from its home stage. Select it
    // only for Mario's two shoe sprites, leaving every level's enemies intact.
    n.spriteChrBank=(index,tile)=>{
      const root=g.m[M.Player_SprOff]>>2;
      if(g.inLevel&&g.m[0x577]&&index>=root&&index<root+2&&tile>=0xa9&&tile<=0xaf)return 11;
    };
    // Bank signatures prevent a coincident address in another MMC3 bank
    // from invoking a player hook. These bytes match the pinned PRG1 ROM.
    const matches=(cpu,addr,bank,offset,count=6)=>{
      for(let i=0;i<count;i++)if(cpu.loadFromCartridge(addr+i)!==g.rom[16+bank*8192+offset+i])return false;
      return true;
    };
    n.copyHooks={
      0xa427(cpu){
        if(g.inLevel&&g.form.invulnerable&&matches(cpu,0xa427,8,0x427)){
          // The pit-death branch runs before this point. Skip only time-out
          // and screen-edge crushing, then resume normal drawing and controls.
          cpu.REG_PC=0xa471;return cpu.loadFromCartridge(0xa472);
        }
      },
      0xa183(cpu){
        // Death tiles must not queue suit loss for the invulnerable tornado.
        if(g.inLevel&&g.form.invulnerable&&matches(cpu,0xa183,7,0x183))return 0x60;
      },
      // After Player_Control, before Player_DetectSolids. The ROM must get
      // the final say on velocity when it hits a wall, floor, or ceiling.
      // Overriding at ApplyVelocity undoes that stop on the following frame.
      0xa478(cpu){
        if(!matches(cpu,0xa478,8,0x478))return;
        if(g.shellBlockReturn){
          const r=g.shellBlockReturn;g.shellBlockReturn=null;
          cpu.REG_ACC=r.a;cpu.REG_X=r.x;cpu.REG_Y=r.y;cpu.setStatus(r.status);g.m.set(r.temp,0);
          return;
        }
        if(g.active&&g.custom&&!g.enteringDoor){g.moveX();g.moveY();return g.bumpShellBlock(cpu);}
      },
      0xa736(cpu){
        // Player_Control normally clears ducking when a direction is held.
        // Restore the shell's short body BEFORE its head-clearance check;
        // applying this only at A478 lets the ROM's wall-escape logic run first.
        if(g.active&&g.custom&&g.shell&&matches(cpu,0xa736,8,0x736))g.m[0x56f]=1;
      },
      0xa845(cpu){
        // The ROM has already found a valid door at Mario's head and a fresh
        // Up press. A flying form's hover flag must not reject that entrance.
        if(g.active&&g.custom&&g.form.fly&&matches(cpu,0xa845,8,0x845)){
          g.enteringDoor=true;g.m[M.Player_InAir]=0;g.m[M.Player_YVel]=0;
          g.jumpY=null;g.dashTime=0;g.dashY=null;
        }
      },
      0xa8b0(cpu){
        // PUp_GeneralCollect: the ROM has accepted the pickup and queued its
        // suit. Observe this event, not ordinary suit changes used by copies.
        if(!g.inLevel||!g.custom||!matches(cpu,0xa8b0,1,0x8b0))return;
        const slot=cpu.REG_X;if(slot>=8)return;
        const id=g.m[0x671+slot],suitItem=[0x0d,0x19,0x1e].includes(id)||(id===0x0c&&g.m[0x669+slot]>0);
        if(suitItem){const queued=g.m[M.Player_QueueSuit];g.collectedSuit=queued>=2&&queued<=7?queued-1:g.m[M.Player_Suit];}
      },
      0xd836(cpu){return ignoreContact(cpu,0xd836);},
      0xd83b(cpu){return ignoreContact(cpu,0xd83b);},
      0xb7d1(cpu){
        if(!matches(cpu,0xb7d1,7,0x17d1))return;
        if(g.sunWeapons(cpu.REG_X))return 0x60;
        // Nipper, Piranha, Fire Bro, Lava Lotus and Fire Chomp flames.
        if(g.active&&g.form.fireproof&&cpu.REG_X<8&&[4,5,12,15,18].includes(g.m[0x7fc6+cpu.REG_X]))return 0x60;
        if(g.rotoWeapons(cpu.REG_X)||g.bulletWeapons(cpu.REG_X))return 0x60;
      },
      0xa07f(cpu){
        // Only the lava branch, before the ROM queues death. Pit, timer and
        // crushing deaths must continue to use their normal routines.
        if(g.active&&g.form.fireproof&&matches(cpu,0xa07f,7,0x7f)){
          const p=g.position,tile=tileAt(g.nes,p.x+8,p.y+32);
          if(tile){const y=tile.y-32;g.m[M.Player_Y]=y&255;g.m[M.Player_YHi]=y>>8;}
          g.m[M.Player_YVel]=(-g.form.jump)&255;g.m[M.Player_InAir]=1;
          g.airUsed=0;g.dashTime=0;g.dashY=null;g.slam=false;
          return 0x60;
        }
      },
      0xd9d3(cpu){
        if(!g.inLevel||!matches(cpu,0xd9d3,0,0x19d3))return;
        if(g.form.invulnerable)return 0x60;
        if(g.phaseTime>0||(g.custom&&g.form.collapse&&(g.mask&32)))return 0x60;
        // Let the original suit-loss / death routine run. An enemy costume
        // has one ordinary Super Mario hit, not permanent invulnerability.
        if(g.custom&&!g.m[0x552]&&!g.m[0x554]&&!g.m[0x553]&&!g.m[0x57a]&&!g.m[M.Player_HaltGame]&&!g.m[M.Player_HaltTick])g.lostForm=true;
      },
    };
    function ignoreContact(cpu,addr){
      if(!g.inLevel||!g.custom||!matches(cpu,addr,0,addr-0xc000))return;
      const slot=cpu.REG_X;if(slot>=8)return;
      const id=g.m[0x671+slot];
      if(g.form.sunTouch&&g.active&&(enemyForm(id,g.m[0x727])||id===0x75)){
        // Ignore hostile contact even during a boss's final-hit sequence.
        // A borrowed Ptooie-ball ID must not delete its distant owner.
        if(g.chompActorIds?.[slot]===id)g.sunContact(slot);
        cpu.F_CARRY=0;g.m[0x796+slot]&=0xfc;return 0x60;
      }
      // Boss attack $75 is also used by Wendy and Lemmy; only variant 2 is fire.
      if(g.form.fireproof&&(enemyForm(id)?.family==='fire'||(id===0x75&&g.m[0x9a+slot]===2))){cpu.F_CARRY=0;g.m[0x796+slot]&=0xfc;return 0x60;}
      // Shell armor and other enemy defenses must not reject power-ups or
      // ordinary level interactions handled by this same native hit test.
      if(!enemyForm(id,g.m[0x727]))return;
      // Ptooie's ball temporarily borrows a fish ID and its owner's slot.
      // Only bite the real body identity recorded before this native frame.
      if(g.chompActorIds?.[slot]===id&&g.chompContact(slot)){cpu.F_CARRY=0;g.m[0x796+slot]&=0xfc;return 0x60;}
      if(g.chompActorIds?.[slot]===id&&g.rotoContact(slot)){cpu.F_CARRY=0;g.m[0x796+slot]&=0xfc;return 0x60;}
      if(g.bulletContact(slot)){cpu.F_CARRY=0;g.m[0x796+slot]&=0xfc;return 0x60;}
      const friendly=g.form.family==='goomba'&&[0x72,0x73,0x74,0x7c,0x6b,0x2b].includes(id);
      const armored=g.shell||(g.dashTime>0&&g.form.family!=='chomp'&&!g.form.frontStrike)||g.slam||g.phaseTime>0||(g.form.collapse&&(g.mask&32));
      if(friendly||armored||g.form.invulnerable){cpu.F_CARRY=0;g.m[0x796+slot]&=0xfc;return 0x60;}
    }
  }
  moveX(){
    const f=this.form,m=this.m,dir=(this.mask&128?1:0)-(this.mask&64?1:0);
    const swim=f.swim&&m[0x575];
    let v=dir*(swim?f.swim:f.speed)*(this.mask&2?1.2:1);
    if(this.dashTime>0)v=this.dashX;
    if(this.shell)v=this.shellDirection*this.shellSpeed;
    if(this.shellStopped)v=0;
    if(this.shellDrift)v=this.shellDrift;
    if(f.collapse&&(this.mask&32))v=0;
    m[M.Player_XVel]=Math.round(clamp(v,-100,100))&255;
    if(this.shell)m[0x56f]=1;
    if(f.extendable)m[0x56f]=this.plantExtension<=.5?1:0;
  }
  moveY(){
    const m=this.m,f=this.form;
    if(this.jumpY!==null){m[M.Player_YVel]=this.jumpY&255;m[M.Player_InAir]=1;this.jumpY=null;}
    if(f.fly&&!this.shell&&!this.shellJumpBlocked&&(m[M.Player_InAir]||(this.mask&17)||this.flapTime>0)){
      // Neutral flight settles gently. On the ground, leave gravity and floor
      // collision to the ROM until the player explicitly asks to take off.
      let lift=this.flapTime>0?Math.max(f.fly,Math.round(f.jump*this.flapTime/12)):this.mask&17?f.fly:-3;
      if(f.flap&&!(this.mask&32)){
        // A repeated flap must not cancel the ROM's head bump and drive its
        // collision box into a ceiling. Bound the next step at that surface.
        const p=this.position,head=p.y+9;
        for(let dy=0;dy<=Math.ceil(lift/16);dy++)for(const x of [p.x+4,p.x+11]){
          const tile=tileAt(this.nes,x,head-dy);
          if(tile?.solid){lift=Math.min(lift,Math.max(0,(head-tile.y-16)*16));this.flapTime=0;}
        }
      }
      m[M.Player_YVel]=((this.mask&32)?f.fly:-lift)&255;
      if((this.mask&17)||this.flapTime>0)m[M.Player_InAir]=1;
    }else if(f.winged&&f.shell&&!this.shell&&(this.mask&32)&&m[M.Player_InAir]){
      // Hopping Paratroopas also descend upright instead of tucking mid-jump.
      m[M.Player_YVel]=Math.max(16,signed(m[M.Player_YVel]))&255;
    }else if(f.swim&&m[0x575]){
      m[M.Player_YVel]=((this.mask&32)?f.swim:(this.mask&17)?-f.swim:5)&255;
    }else if(f.glide&&(this.mask&1)&&signed(m[M.Player_YVel])>12)m[M.Player_YVel]=12;
    if(this.slam)m[M.Player_YVel]=100;
    if(this.dashTime>0&&this.dashY!==null)m[M.Player_YVel]=this.dashY&255;
    // Horizontal stages have a fixed upper playfield edge. Flight must not
    // leave the character invisible above it; vertical rooms can scroll upward.
    const p=this.position,ceiling=m[M.Level_7Vertical]?0:p.cameraY+2;
    if((f.fly||this.dashTime>0)&&p.y<=ceiling&&signed(m[M.Player_YVel])<0)m[M.Player_YVel]=0;
  }
  canStandFromShell(){
    const p=this.position;
    // Check headroom over the ROM's inner body/foot span. Its outer side
    // probes can touch an adjacent wall even when standing there is safe.
    for(const x of [p.x+4,p.x+8,p.x+11])for(const y of [p.y+5,p.y+10,p.y+15]){
      const tile=tileAt(this.nes,x,y);if(tile?.solid)return false;
    }
    return true;
  }
  step(){
    if(this.paused)return;
    this.frame++;
    const scene=this.scene;
    if(scene!==this.lastScene){this.clearEffects();this.lastScene=scene;}
    const m=this.m,active=this.active,wasGround=!m[M.Player_InAir];
    this.lostForm=false;
    this.collectedSuit=null;
    this.enteringDoor=false;
    if(this.mask&64)this.facing=-1;else if(this.mask&128)this.facing=1;
    this.shellStopped=false;
    if(!(this.mask&1))this.shellJumpBlocked=false;
    if(active&&this.custom&&this.form.shell){
      // Down latches the shell pose. Release and opposite arrows cannot brake
      // a launched shell; only a fresh jump press stops it and stands up.
      if((this.mask&32)&&!(this.previousMask&32)&&!this.shellJumpBlocked&&(!this.form.winged||wasGround)){
        this.shell=true;this.shellDrift=0;this.dashTime=0;this.jumpY=null;
        if(signed(m[M.Player_YVel])<0)m[M.Player_YVel]=0;
      }
      if(this.shell&&(this.mask&1)&&!(this.previousMask&1)){
        const stand=this.canStandFromShell();
        this.shellDrift=stand&&this.shellDirection?this.shellDirection*Math.min(Math.abs(signed(m[M.Player_XVel])),this.shellSpeed):0;
        this.shell=!stand;this.shellDirection=0;this.shellJumpBlocked=true;this.shellStopped=true;
        this.dashTime=0;this.dashY=null;this.jumpY=null;m[M.Player_XVel]=0;m[0x56f]=stand?0:1;
      }else if(this.shell){
        if(!this.shellDirection&&!this.shellJumpBlocked)this.shellDirection=(this.mask&128?1:0)-(this.mask&64?1:0);
        if(this.shellDirection)this.facing=this.shellDirection;
      }
    }
    for(const name of ['copyCooldown','powerCooldown','phaseTime','dashTime','orbitTime','spikeRespawn','flapTime'])if(this[name]>0)this[name]--;
    if(active){
      if(this.form.star)m[0x553]=255;
      if(this.custom){
        this.chompContact();
        this.rotoContact();
        this.bulletContact();
        this.sunContact();
        if(this.form.action==='spikecontrol'){
          this.spikeHeight=clamp(this.spikeHeight+((this.mask&16?1:0)-(this.mask&32?1:0))*2,-8,120);
          this.updateSpikeBall();
        }
        if(this.form.extendable)this.plantExtension=clamp(this.plantExtension+((this.mask&16?1:0)-(this.mask&32?1:0))/12,0,1);
        if(wasGround)this.airUsed=0;
        if(this.form.flap){
          if(this.mask&32)this.flapTime=0;
          else if((this.mask&1)&&!(this.previousMask&1))this.flapTime=12;
        }
        if((this.mask&1)&&!(this.previousMask&1)&&!this.form.fly&&!this.shell&&!this.shellJumpBlocked){
          if(wasGround||this.airUsed<(this.form.airJumps??0)){
            this.jumpY=-this.form.jump;if(!wasGround)this.airUsed++;
          }
        }
        // NES B (keyboard/gamepad X) runs and uses the current form's attack.
        // The separate power input remains an optional V / gamepad Y shortcut.
        if(((this.mask&2)||this.extra.power)&&this.powerCooldown===0&&!this.shellJumpBlocked)this.power();
      }
      if(this.extra.copy&&this.copyCooldown===0)this.fireCopy();
    }
    this.nes.hideMario=!!(this.custom&&this.inLevel&&!m[M.Player_IsDying]&&!m[M.Player_InPipe]&&!m[M.Player_EndLevel]);
    // Start is owned by the UI inside levels; normal start works on the map.
    let mask=this.mask&(this.inLevel?247:255);
    if(active&&this.shell)mask=(mask&~209)|(this.shellDirection>0?128:this.shellDirection<0?64:0);
    if(this.shellJumpBlocked)mask&=~1;
    if(this.shellStopped)mask&=~240;
    for(let b=0;b<8;b++)(mask&(1<<b))?this.nes.buttonDown(1,b):this.nes.buttonUp(1,b);
    this.chompActorIds=(['chomp','disc'].includes(this.form.family)||this.form.sunTouch)?Array.from(m.slice(0x671,0x679)):null;
    this.nes.frame();
    this.sprites.observe(this);
    this.previousMask=this.mask;
    if(this.lostForm||m[M.Player_IsDying]){
      if(this.custom||this.form.star){this.form=FORMS[0];this.clearEffects();this.nes.hideMario=false;this.onChange(this.form);this.onMessage('Costume lost — copy another enemy or choose a form.');}
    }else if(this.custom&&this.collectedSuit!==null){
      if(this.shell)m[M.Player_XVel]=0;
      this.form=FORMS[this.collectedSuit];this.clearEffects();
      this.nes.hideMario=false;m[0x56f]=0;
      this.onChange(this.form);this.onMessage(this.form.name);
    }else if(!this.custom&&!this.form.shoe&&!this.form.star&&m[M.Player_QueueSuit]===0){
      const native=FORMS[Math.min(6,m[M.Player_Suit])];if(native&&native!==this.form){this.form=native;this.onChange(native);}
    }
    if(this.scene!==scene||!this.active){this.shots=[];this.effects=[];this.slam=false;this.dashTime=0;this.orbitTime=0;this.spikeBall=null;this.snakeHistory=[];this.snakeTail=[];this.shellDrift=0;this.shellBlockPending=null;return;}
    // Let the original wall collision stop this frame, then travel away from
    // that wall on the next frame. Never force forward motion through it.
    if(this.shell&&this.shellDirection&&m[M.Player_XVel]===0){
      const p=this.position,tile=tileAt(this.nes,p.x+8+this.shellDirection*12,p.y+24);
      if(tile?.solid)this.shellBlockPending=tile;
      this.shellDirection=-this.shellDirection;this.facing=this.shellDirection;
      m[M.Player_XVel]=(this.shellDirection*this.shellSpeed)&255;
    }
    if(this.shellDrift){
      const dir=(this.mask&128?1:0)-(this.mask&64?1:0),brake=dir&&dir!==Math.sign(this.shellDrift)?12:6;
      this.shellDrift=m[M.Player_XVel]===0?0:(Math.sign(this.shellDrift)*Math.max(0,Math.abs(this.shellDrift)-brake)||0);
    }
    this.updateSpikeBall();
    this.updateSnakeTail();
    this.chompContact();
    this.rotoContact();
    this.bulletContact();
    this.sunContact();
    if(this.slam&&!m[M.Player_InAir]){const p=this.center;this.area(p.x,p.y+10,this.form.power,true);this.slam=false;}
    if(this.form.family!=='chomp'&&!this.form.frontStrike&&((this.shell&&Math.abs(signed(m[M.Player_XVel]))>8)||this.dashTime>0)){
      const p=this.center;this.area(p.x,p.y+(this.shell?8:0),16,!this.shell&&(!!this.form.breaks||this.form.family==='thwomp'),false);
    }
    if(this.orbitTime>0&&this.form.family!=='disc'){const p=this.center;for(const o of this.orbits())this.area(p.x+o.x,p.y+o.y,9,false,false);}
    this.updateShots();
    this.effects=this.effects.filter(e=>--e.life>0);
    for(const e of this.effects)if(e.vx!==undefined){e.x+=e.vx;e.y+=e.vy;e.vy+=.12;}
  }
  bumpShellBlock(cpu){
    const tile=this.shellBlockPending;this.shellBlockPending=null;
    if(!tile||this.m[0x6000+tile.index]!==tile.value||this.m[0x57c])return;
    // Execute the original Object_BumpOffBlocks routine in the already-mapped
    // PRG008 bank. It owns brick debris, question-block rewards and used tiles.
    this.shellBlockReturn={a:cpu.REG_ACC,x:cpu.REG_X,y:cpu.REG_Y,status:cpu.getStatus(),temp:this.m.slice(0,16)};
    this.m[12]=tile.y>>8;this.m[13]=tile.y&255;this.m[14]=tile.x>>8;this.m[15]=tile.x&255;
    cpu.REG_ACC=tile.value;cpu.push(0xa4);cpu.push(0x77);cpu.REG_PC=0xb979;
    return cpu.loadFromCartridge(0xb97a);
  }
  updateSnakeTail(){
    if(this.form.key!=='enemy-59'||!this.active){this.snakeHistory=[];this.snakeTail=[];return;}
    const p=this.position,head={x:p.x+8,y:p.y+17,facing:this.facing},previous=this.snakeHistory[0];
    // World coordinates keep scrolling from bending the snake. Reset on warps.
    if(!previous||Math.hypot(head.x-previous.x,head.y-previous.y)>64)this.snakeHistory=Array.from({length:33},()=>({...head}));
    else{this.snakeHistory.unshift(head);this.snakeHistory.length=33;}
    // Native segments lag about eight frames. Our stronger player jumps need
    // a distance limit too, so the flames remain a chain instead of stretching.
    this.snakeTail=[];let cursor=0;
    for(let segment=0;segment<4;segment++){
      const end=Math.min(cursor+8,32);let distance=0;
      while(cursor<end){
        const a=this.snakeHistory[cursor],b=this.snakeHistory[cursor+1],step=Math.hypot(b.x-a.x,b.y-a.y);
        if(distance+step>16)break;
        distance+=step;cursor++;
      }
      this.snakeTail.push(this.snakeHistory[cursor]);
    }
  }
  actors(){
    const m=this.m,result=[];
    for(let slot=0;slot<8;slot++){
      const state=m[0x661+slot],id=m[0x671+slot],form=enemyForm(id,m[0x727]);
      if(!form||![2,3,5,6].includes(state))continue;
      const x=m[0x91+slot]+256*m[0x76+slot],y=m[0xa3+slot]+256*m[0x88+slot];
      const flags=this.rom[16+0x2f4+id],bound=16+0x2b4+(flags&15)*4;
      const left=x+signed(this.rom[bound]),top=y+signed(this.rom[bound+2]);
      result.push({slot,id,form,x,y,left,top,right:left+Math.max(10,this.rom[bound+1]),bottom:top+Math.max(12,this.rom[bound+3]),boss:[0x0e,0x18,0x4b,0x4c].includes(id)});
    }
    // Special objects use a low X coordinate; resolve it in the current view.
    const view=this.position;
    for(let slot=0;slot<8;slot++){
      const id=m[0x7fc6+slot],form=specialForm(id);if(!form)continue;
      let x=m[0x5c9+slot]+Math.floor(view.cameraX/256)*256;
      if(x<view.cameraX-32)x+=256;if(x>view.cameraX+288)x-=256;
      const y=m[0x5bf+slot]+256*m[0x7fd5+slot];
      result.push({slot,id,form,x,y,left:x,top:y,right:x+12,bottom:y+12,special:true});
    }
    return result;
  }
  capture(target){
    const appearance=this.sprites.steal(this,target);
    const projectiles=this.shots;
    this.select(target.form.key,{quiet:true});
    if(appearance)this.facing=appearance.facing;
    // Selecting a form clears attacks. Preserve the in-progress update's list;
    // the copy shot is consumed by updateShots after this callback.
    this.shots=projectiles;
    this.copyCooldown=20;this.copied.add(target.form.key);this.stats.copies++;
    if(!target.boss)this.defeat(target);
    const p=this.center;this.burst(p.x,p.y,'#b4fff4',30);
    this.m[0x4f1]|=0x20;this.onMessage(`Copied ${target.form.name}! ${target.form.ability}`);this.onChange(this.form);
  }
  defeat(target){
    if(target.boss||target.tileEnemy)return false; // Preserve boss scripts and terrain enemies.
    if(target.special)this.m[0x7fc6+target.slot]=0;
    else{
      if(!this.m[0x661+target.slot])return false;
      this.m[0x661+target.slot]=0;
      const spawn=this.m[0x659+target.slot];if(spawn<48)this.m[0x7b10+spawn]=0x80;
    }
    this.stats.hits++;this.burst((target.left+target.right)/2,(target.top+target.bottom)/2,'#fff2b2',13);return true;
  }
  burst(x,y,color,radius=20){this.effects.push({x,y,color,radius,life:18,max:18,kind:'burst'});if(this.effects.length>160)this.effects.shift();}
  get chompMouth(){
    if(this.form.family!=='chomp')return null;
    const p=this.position,sprite=this.sprites.image(this.form,this.frame,this.spritePose);
    const width=sprite?.width??16,height=sprite?.height??16,cx=p.x+8;
    return {left:this.facing>0?cx:cx-width/2-3,right:this.facing>0?cx+width/2+3:cx,top:p.y+35-height,bottom:p.y+31};
  }
  get bulletFront(){
    if(!this.form.frontStrike)return null;
    const p=this.position,sprite=this.sprites.image(this.form,this.frame,this.spritePose),cx=p.x+8;
    const width=sprite?.width??16,height=sprite?.height??16;
    return {left:this.facing>0?cx:cx-width/2-3,right:this.facing>0?cx+width/2+3:cx,top:p.y+33-height,bottom:p.y+33};
  }
  bulletTouches(t){
    const b=this.bulletFront;
    return b&&t.left<=b.right&&t.right>=b.left&&t.top<=b.bottom&&t.bottom>=b.top;
  }
  bulletWeapons(slot){
    if(this.paused||!this.active||!this.form.frontStrike)return false;
    const m=this.m,p=this.position;let destroyed=false;
    for(let s=0;s<8;s++){
      if(slot!==undefined&&s!==slot)continue;
      // Hostile projectiles only: leave coins, shoes, wands and effects intact.
      if(![1,2,4,5,7,8,10,11,12,13,15,18,21].includes(m[0x7fc6+s]))continue;
      let x=m[0x5c9+s]+Math.floor(p.cameraX/256)*256;
      if(x<p.cameraX-32)x+=256;if(x>p.cameraX+288)x-=256;
      const y=m[0x5bf+s]+256*m[0x7fd5+s];
      if(this.bulletTouches({left:x,top:y,right:x+12,bottom:y+12})){
        m[0x7fc6+s]=0;this.stats.hits++;this.burst(x+6,y+6,'#fff2b2',12);destroyed=true;
      }
    }
    return destroyed;
  }
  bulletContact(slot){
    if(this.paused||!this.active||!this.form.frontStrike)return false;
    let destroyed=false;
    for(const t of this.actors()){
      if(slot!==undefined&&(t.special||t.slot!==slot))continue;
      if(this.bulletTouches(t))destroyed=(t.boss?this.defeatBoss(t):this.defeat(t))||destroyed;
    }
    if(slot!==undefined)return destroyed;
    this.bulletWeapons();
    const b=this.bulletFront;
    for(let y=Math.floor(b.top/16)*16;y<=b.bottom;y+=16)for(let x=Math.floor(b.left/16)*16;x<=b.right;x+=16){
      const tile=tileAt(this.nes,x,y);
      if(tile&&tileForm(this.m[M.Level_Tileset],tile.value)){this.removeTile(tile);this.stats.hits++;}
    }
    return destroyed;
  }
  sunTouches(t){
    // Include the visible Sun and the hidden native player collision box.
    const p=this.position;
    return this.rotoTouches(t)||(t.left<=p.x+14&&t.right>=p.x+2&&t.top<=p.y+32&&t.bottom>=p.y+8);
  }
  sunWeapons(slot){
    if(this.paused||!this.active||!this.form.sunTouch)return false;
    const m=this.m,p=this.position;let destroyed=false;
    for(let s=0;s<8;s++){
      if(slot!==undefined&&s!==slot)continue;
      // Hostile weapons only; keep coins, shoes, wands and reward effects.
      if(![1,2,4,5,7,8,10,11,12,13,15,18,21].includes(m[0x7fc6+s]))continue;
      let x=m[0x5c9+s]+Math.floor(p.cameraX/256)*256;
      if(x<p.cameraX-32)x+=256;if(x>p.cameraX+288)x-=256;
      const y=m[0x5bf+s]+256*m[0x7fd5+s];
      if(this.sunTouches({left:x,top:y,right:x+12,bottom:y+12})){
        m[0x7fc6+s]=0;this.stats.hits++;this.burst(x+6,y+6,'#ffd763',16);destroyed=true;
      }
    }
    return destroyed;
  }
  sunContact(slot){
    if(this.paused||!this.active||!this.form.sunTouch)return false;
    let destroyed=false;const targets=this.actors(),m=this.m;
    // Boss rings, circus balls and Bowser flames are hostile actors, but have
    // no selectable costume and therefore do not appear in actors().
    for(let s=0;s<8;s++)if(m[0x671+s]===0x75&&m[0x661+s]===2){
      const x=m[0x91+s]+256*m[0x76+s],y=m[0xa3+s]+256*m[0x88+s];
      targets.push({slot:s,id:0x75,left:x,top:y,right:x+16,bottom:y+16});
    }
    for(const t of targets){
      if(slot!==undefined&&(t.special||t.slot!==slot))continue;
      if(this.sunTouches(t))destroyed=(t.boss?this.defeatBoss(t):this.defeat(t))||destroyed;
    }
    if(slot!==undefined)return destroyed;
    this.sunWeapons();
    const p=this.position,sprite=this.sprites.image(this.form,this.frame,this.spritePose);
    const left=Math.min(p.x+2,p.x+8-sprite.width/2),right=Math.max(p.x+14,p.x+8+sprite.width/2);
    const top=Math.min(p.y+8,p.y+33-sprite.height),bottom=p.y+33;
    for(let y=Math.floor(top/16)*16;y<=bottom;y+=16)for(let x=Math.floor(left/16)*16;x<=right;x+=16){
      const tile=tileAt(this.nes,x,y);
      if(tile&&tileForm(this.m[M.Level_Tileset],tile.value)&&this.sunTouches({left:x,top:y,right:x+15,bottom:y+15})){
        this.removeTile(tile);this.stats.hits++;
      }
    }
    return destroyed;
  }
  chompContact(slot){
    if(this.paused||!this.active||this.form.family!=='chomp')return false;
    const mouth=this.chompMouth;let bitten=false;
    for(const target of this.actors()){
      if(slot!==undefined&&(target.special||target.slot!==slot))continue;
      // Mouth contact eats bodies, not fire, bullets, rotating hazards or eggs.
      // Special-object weapons are intentionally absent from actors().
      if(target.boss||target.tileEnemy||['fire','bullet','disc'].includes(target.form.family)||[0x5d,0x83,0x84].includes(target.id))continue;
      if(target.left<=mouth.right&&target.right>=mouth.left&&target.top<=mouth.bottom&&target.bottom>=mouth.top)bitten=this.defeat(target)||bitten;
    }
    return bitten;
  }
  spikeContact(x,y){
    const radius=8;
    for(const t of this.actors())if(Math.hypot(Math.max(t.left-x,0,x-t.right),Math.max(t.top-y,0,y-t.bottom))<=radius){
      if(!t.boss){this.defeat(t);continue;}
      this.defeatBoss(t);
    }
    for(let yy=Math.floor((y-radius)/16)*16;yy<=y+radius;yy+=16)for(let xx=Math.floor((x-radius)/16)*16;xx<=x+radius;xx+=16){
      const t=tileAt(this.nes,xx,yy);
      if(t&&tileForm(this.m[M.Level_Tileset],t.value)&&Math.hypot(Math.max(t.x-x,0,x-t.x-16),Math.max(t.y-y,0,y-t.y-16))<=radius){this.removeTile(t);this.stats.hits++;}
    }
  }
  defeatBoss(t){
    const s=t.slot,m=this.m;
    // Keep the original final-hit paths: wands, victory orbs and Bowser's door.
    if(t.id===0x0e){if(m[0x7bd]||m[0x7cf6+s]===0)return false;m[0x7cf6+s]=0;}
    else if(t.id===0x18){if(m[0x9a+s]>=2||m[0x661+s]===6)return false;m[0x7cf6+s]=0;m[0x661+s]=6;if(!m[0x9a+s])m[0x9a+s]=1;}
    else{if(m[0x9a+s]>=5||m[0x7cf6+s]===32)return false;m[0x7cf6+s]=32;}
    this.stats.hits++;this.burst((t.left+t.right)/2,(t.top+t.bottom)/2,'#fff2b2',20);return true;
  }
  rotoTouches(t){
    const p=this.position,sprite=this.sprites.image(this.form,this.frame,this.spritePose);
    if(sprite){
      const left=Math.round(p.x+8-sprite.width/2),top=Math.round(p.y+33-sprite.height);
      const x0=Math.max(0,Math.floor(t.left-left)),x1=Math.min(sprite.width-1,Math.floor(t.right-left));
      const y0=Math.max(0,Math.floor(t.top-top)),y1=Math.min(sprite.height-1,Math.floor(t.bottom-top));
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
        const sx=this.facing===sprite.facing?x:sprite.width-1-x;
        if(sprite.pixels[y*sprite.width+sx])return true;
      }
    }
    if(this.orbitTime>0){const c=this.center;for(const o of this.orbits())if(Math.hypot(Math.max(t.left-c.x-o.x,0,c.x+o.x-t.right),Math.max(t.top-c.y-o.y,0,c.y+o.y-t.bottom))<=8)return true;}
    return false;
  }
  rotoWeapons(slot){
    if(this.paused||!this.active||this.form.family!=='disc')return false;
    const m=this.m,p=this.position;let destroyed=false;
    for(let s=0;s<8;s++){
      if(slot!==undefined&&s!==slot)continue;
      // Physical weapons burn up. Fireballs, magic, lasers, items and rewards
      // retain their original behavior; never clear the whole projectile pool.
      if(![1,2,7,10,11].includes(m[0x7fc6+s]))continue;
      let x=m[0x5c9+s]+Math.floor(p.cameraX/256)*256;
      if(x<p.cameraX-32)x+=256;if(x>p.cameraX+288)x-=256;
      const y=m[0x5bf+s]+256*m[0x7fd5+s];
      if(this.rotoTouches({left:x,top:y,right:x+12,bottom:y+12})){
        m[0x7fc6+s]=0;this.stats.hits++;this.burst(x+6,y+6,'#ffd075',12);destroyed=true;
      }
    }
    return destroyed;
  }
  rotoContact(slot){
    if(this.paused||!this.active||this.form.family!=='disc')return false;
    let destroyed=false;const p=this.position;
    for(const t of this.actors()){
      if(slot!==undefined&&(t.special||t.slot!==slot))continue;
      if(!t.special&&t.id===0xaf)continue; // The Angry Sun cannot be destroyed.
      // Multi-disc forms can have an empty visual center. Native body contact
      // must still resolve an enemy hit before the hidden Mario body is hurt.
      const bodyContact=slot!==undefined&&t.left<=p.x+14&&t.right>=p.x+2&&t.top<=p.y+32&&t.bottom>=p.y+8;
      if(this.rotoTouches(t)||bodyContact)destroyed=(t.boss?this.defeatBoss(t):this.defeat(t))||destroyed;
    }
    if(slot!==undefined)return destroyed;
    this.rotoWeapons();
    const sprite=this.sprites.image(this.form,this.frame,this.spritePose),reach=Math.max(sprite?.width??16,sprite?.height??16,this.orbitTime?2*(this.form.power??36)+16:0);
    for(let y=Math.max(0,Math.floor((p.y+20-reach)/16)*16);y<=p.y+20+reach;y+=16)for(let x=Math.max(0,Math.floor((p.x+8-reach)/16)*16);x<=p.x+8+reach;x+=16){
      const tile=tileAt(this.nes,x,y);if(!tile)continue;
      const enemy=tileForm(this.m[M.Level_Tileset],tile.value);
      if((tile.brick||enemy)&&this.rotoTouches({left:x,top:y,right:x+15,bottom:y+15})){
        if(enemy){this.removeTile(tile);this.stats.hits++;}else this.breakBrick(tile);
      }
    }
    return destroyed;
  }
  updateSpikeBall(){
    if(this.form.action!=='spikecontrol'||!this.active||this.spikeRespawn){this.spikeBall=null;return;}
    const p=this.position,body=this.sprites.image(this.form,this.frame,this.spritePose);
    const x=p.x+8,mouth=p.y+33-(body?.height??32)+8;
    const wanted=Math.max(p.cameraY+8,mouth-this.spikeHeight);
    let y=mouth;const steps=Math.max(1,Math.ceil(Math.abs(wanted-mouth)/2));
    for(let i=1;i<=steps;i++){
      const next=mouth+(wanted-mouth)*i/steps;
      // Enemy tiles can be destroyed; ordinary walls still block the ball.
      const blocked=[[-7,-7],[7,-7],[-7,7],[7,7]].some(([dx,dy])=>{
        const tile=tileAt(this.nes,x+dx,next+dy);
        return !tile||(tile.solid&&!tileForm(this.m[M.Level_Tileset],tile.value));
      });
      if(blocked)break;y=next;
    }
    const previous=this.spikeBall??{x,y},sweep=Math.max(1,Math.ceil(Math.hypot(x-previous.x,y-previous.y)/2));
    for(let i=1;i<=sweep;i++)this.spikeContact(previous.x+(x-previous.x)*i/sweep,previous.y+(y-previous.y)*i/sweep);
    this.spikeBall={x,y};
  }
  area(x,y,radius,bricks=false,visual=true){
    if(visual)this.burst(x,y,this.form.color,radius);
    for(const t of this.actors())if(Math.hypot(Math.max(t.left-x,0,x-t.right),Math.max(t.top-y,0,y-t.bottom))<=radius)this.defeat(t);
    if(bricks)for(let yy=Math.floor((y-radius)/16)*16;yy<=y+radius;yy+=16)for(let xx=Math.floor((x-radius)/16)*16;xx<=x+radius;xx+=16){
      const t=tileAt(this.nes,xx,yy);if(t?.brick&&Math.hypot(xx+8-x,yy+8-y)<=radius+8)this.breakBrick(t);
    }
  }
  fireCopy(){
    const p=this.center,dy=(this.mask&16)?-1:(this.mask&32)&&!this.shell?1:0;
    const dx=dy&&!(this.mask&192)?0:this.facing,l=Math.hypot(dx,dy);
    this.shots.push({kind:'copy',x:p.x,y:p.y,vx:dx/l*4,vy:dy/l*4,life:90,age:0,color:'#81f2df',radius:4});
    this.copyCooldown=22;this.stats.shots++;this.m[0x4f1]|=0x20;
  }
  power(){
    const f=this.form,p=this.center,a=f.action,k=f.power??5,d=this.facing;
    this.powerCooldown=f.cooldown;this.m[0x4f1]|=0x20;
    const shot=(vx,vy,opts={})=>{if(this.shots.length<64)this.shots.push({kind:a,x:p.x,y:p.y,vx,vy,life:110,age:0,color:f.color,radius:3,...opts});};
    const aimed=(speed,opts={})=>{const y=this.mask&16?-1:this.mask&32?1:0,x=y&&!(this.mask&192)?0:d,l=Math.hypot(x,y);shot(x/l*speed,y/l*speed,opts);};
    const dash=(x,y=null)=>{this.dashTime=20;this.dashX=x;this.dashY=y;};
    if(a==='shell'){
      this.shellDrift=0;
      this.shell=true;this.shellDirection||=d;this.facing=this.shellDirection;
      this.dashTime=0;this.jumpY=null;
      if(signed(this.m[M.Player_YVel])<0)this.m[M.Player_YVel]=0;
      return;
    }
    if(f.family==='chomp'&&a==='bite'){dash(d*42);this.chompContact();return;}
    if(a==='spikecontrol'){
      if(this.spikeBall){const b=this.spikeBall;shot(d*k,0,{kind:'spikeball',x:b.x,y:b.y,radius:8,pierce:true});this.spikeBall=null;this.spikeRespawn=24;}
      return;
    }
    if(a==='phase'){this.phaseTime=k;this.burst(p.x,p.y,f.color,22);return;}
    if(a==='orbit'){this.orbitTime=240;return;}
    if(a==='slam'||(a==='dragon'&&(this.mask&32))){this.slam=true;if(!this.m[M.Player_InAir]){this.jumpY=-60;this.m[M.Player_InAir]=1;}return;}
    if(['stomp','blast','ink','shock','gust','spin','spikes','upburst','downburst','bite'].includes(a)){
      let x=p.x,y=p.y,r=k;
      if(a==='bite'){x+=d*k*.55;r=k*.65;dash(d*42);}
      if(a==='upburst')y-=k*.6;if(a==='downburst')y+=k*.6;
      if(a==='gust'){this.jumpY=-82;r=k;}
      this.area(x,y,r,['blast','stomp'].includes(a));return;
    }
    if(['dash','leftdash','rightdash','rise','diagonal','dive'].includes(a)){
      dash(a==='leftdash'?-k:a==='rightdash'?k:a==='rise'?0:d*k,a==='rise'?-k:a==='diagonal'?-k:a==='dive'?k:null);return;
    }
    if(a==='bone'){shot(d*k,-.4,{x:p.x+d*10,y:this.spritePose.collapsed?this.position.y+28:p.y,gravity:.035,facing:d});return;}
    if(a==='spitball'){shot(0,0,{kind:'spike-spit',radius:8,life:180,launched:false,facing:d,palette:this.sprites.spikePalette()});return;}
    if(a==='hammer'){shot(d*18/16,-48/16,{x:p.x+d*8,y:this.position.y+6,radius:7,facing:d});return;}
    if(a==='ball'||a==='wrench'){shot(d*k,-4,{gravity:.13,breaks:a==='ball',spin:true,bounces:a==='ball'?2:0});return;}
    if(a==='rings'){shot(d*k,-1.5,{x:p.x+d*12,radius:7,life:240});return;}
    if(a==='boomerang'){shot(d*k,-.5,{returning:true,spin:true,pierce:true,facing:d});return;}
    if(a==='homing'){shot(d*k,0,{homing:true});return;}
    if(a==='upball'){shot(d*1,-k,{gravity:.1,breaks:true,bounces:2});this.jumpY=-72;return;}
    if(a==='tripleball'){for(const vy of [-3,-5,-7])shot(d*k,vy,{gravity:.16,bounces:2,breaks:true});return;}
    if(a==='drophelpers'){
      const room=Math.max(0,12-this.shots.filter(s=>s.kind==='micro-goomba').length);
      // Drop underneath the body; helpers fall, land, then walk apart.
      const y=this.position.y+27;
      for(const direction of [-1,1].slice(0,room))shot(direction*.5,1,{kind:'micro-goomba',x:p.x+direction*4,y,life:300,grounded:false,direction});
      return;
    }
    if(a==='egg'){shot(d*k,2,{gravity:.18,bounces:2});return;}
    if(a==='helpers'||a==='helpers3'){for(let i=0;i<(a==='helpers'?2:3);i++)shot(d*k,(i-1)*1.4,{homing:true});return;}
    if(a==='lotus'){for(const vx of [-2,-1,1,2])shot(vx,-k,{gravity:.055,bounces:1});return;}
    if(a==='trail'){for(let i=0;i<5;i++)shot(-d*(1+i*.4),1,{gravity:.15,bounces:2,...(f.key==='enemy-59'?{kind:'fire-snake-flame'}:{})});return;}
    if(a==='upwater'){shot(d*k,-3,{gravity:.07,bounces:2});return;}
    if(a==='balls'){for(let i=0;i<3;i++)shot(d*(k+i),-2-i,{gravity:.2,bounces:5,radius:5});return;}
    if(a==='leftseed'||a==='leftfire'){shot(-k,0);return;}
    if(a==='rightseed'||a==='rightfire'){shot(k,0);return;}
    if(a==='downseed'){shot(0,k);return;}
    if(a==='downfire'||a==='rainfire'){for(const vx of a==='rainfire'?[-2,0,2]:[-1,1])shot(vx,k,{bounces:1});return;}
    if(['spreadfire','spreadmagic','heavyspread','dragon'].includes(a)){
      for(const vy of [-1.6,0,1.6])shot(d*k,vy,{breaks:a==='heavyspread',radius:a==='dragon'?5:3});return;
    }
    if(a==='triplefire'){for(let i=0;i<3;i++)shot(d*(k+i),-.3,{gravity:.08,bounces:3});return;}
    aimed(k,{gravity:['fire','water'].includes(a)?.08:0,bounces:['fire','water'].includes(a)?3:0,breaks:['ice','heavyseed'].includes(a),pierce:a==='needle',radius:a==='heavyseed'?5:3});
  }
  orbits(){
    const f=this.form;return Array.from({length:f.orbits??1},(_,i)=>{
      const angle=this.frame*(f.orbitSpeed??.09)*(f.reverse?-1:1)+i*Math.PI*2/(f.orbits??1);
      return {x:Math.cos(angle)*(f.power??36),y:Math.sin(angle)*(f.power??36)};
    });
  }
  updateMicroGoomba(s){
    const sprite=this.sprites.microGoomba(),rx=sprite.width/2,ry=sprite.height/2;
    s.vx=s.direction*(s.grounded?1.2:.5);s.vy=Math.min(s.vy+.18,4);
    const count=Math.max(1,Math.ceil(Math.hypot(s.vx,s.vy)/2));
    s.grounded=false;
    for(let i=0;i<count;i++){
      const x=s.x+s.vx/count;
      if([s.y-ry+1,s.y+ry-1].some(y=>tileAt(this.nes,x+s.direction*rx,y)?.solid)){
        s.direction=-s.direction;s.vx=-s.vx;
      }else s.x=x;
      const y=s.y+s.vy/count;
      const floor=[s.x-rx+1,s.x+rx-1].map(x=>tileAt(this.nes,x,y+ry)).find(t=>t?.solid&&s.y+ry<=t.y+.01);
      if(floor){s.y=floor.y-ry;s.vy=0;s.grounded=true;}else s.y=y;
      if(!tileAt(this.nes,s.x,s.y))return false;
      const target=this.actors().find(t=>s.x+rx>=t.left&&s.x-rx<=t.right&&s.y+ry>=t.top&&s.y-ry<=t.bottom);
      if(target){this.defeat(target);return false;}
    }
    return true;
  }
  updateRing(s){
    const radius=s.radius,steps=Math.max(1,Math.ceil(Math.hypot(s.vx,s.vy)/2));
    const solid=(x,y)=>tileAt(this.nes,x,y)?.solid;
    for(let i=0;i<steps;i++){
      const x=s.x+s.vx/steps;
      if([s.y-radius/2,s.y,s.y+radius/2].some(y=>solid(x+Math.sign(s.vx)*radius,y)))s.vx=-s.vx;else s.x=x;
      const y=s.y+s.vy/steps;
      if([s.x-radius/2,s.x,s.x+radius/2].some(x=>solid(x,y+Math.sign(s.vy)*radius)))s.vy=-s.vy;else s.y=y;
      if(!tileAt(this.nes,s.x,s.y))return false;
      for(const target of this.actors())if(Math.hypot(Math.max(target.left-s.x,0,s.x-target.right),Math.max(target.top-s.y,0,s.y-target.bottom))<=radius)this.defeat(target);
    }
    return true;
  }
  updateSpikeSpit(s){
    if(!s.launched){
      s.x=this.position.x+8;s.y=this.position.y+11;s.facing=this.facing;
      if(s.age<58)return true;
      s.launched=true;s.vx=s.facing*2;s.vy=0;
    }
    s.x+=s.vx;
    const target=this.actors().find(t=>Math.hypot(Math.max(t.left-s.x,0,s.x-t.right),Math.max(t.top-s.y,0,s.y-t.bottom))<=s.radius);
    if(target){this.defeat(target);return false;}
    const p=this.position;return s.x>=p.cameraX-16&&s.x<=p.cameraX+272&&s.y<=p.cameraY+224;
  }
  updateHammer(s){
    // The enemy's hammer travels through scenery in a gravity-driven arc.
    const count=Math.max(1,Math.ceil(Math.hypot(s.vx,s.vy)/2));
    for(let i=0;i<count;i++){
      s.x+=s.vx/count;s.y+=s.vy/count;
      const target=this.actors().find(t=>Math.hypot(Math.max(t.left-s.x,0,s.x-t.right),Math.max(t.top-s.y,0,s.y-t.bottom))<=s.radius);
      if(target){this.defeat(target);return false;}
    }
    s.vy=Math.min(s.vy+2/16,110/16);
    const p=this.position;return s.y<=p.cameraY+224&&s.x>=p.cameraX-16&&s.x<=p.cameraX+272;
  }
  updateShots(){
    const next=[];
    for(const s of [...this.shots]){
      if(--s.life<=0)continue;s.age++;
      if(s.kind==='spike-spit'){if(this.updateSpikeSpit(s))next.push(s);continue;}
      if(s.kind==='hammer'){if(this.updateHammer(s))next.push(s);continue;}
      if(s.kind==='rings'){if(this.updateRing(s))next.push(s);continue;}
      if(s.kind==='micro-goomba'){if(this.updateMicroGoomba(s))next.push(s);continue;}
      s.vy+=s.gravity??0;
      if(s.returning&&s.age>24){const p=this.center,dx=p.x-s.x,dy=p.y-s.y,l=Math.hypot(dx,dy);if(l<8)continue;s.vx=dx/l*5;s.vy=dy/l*5;}
      if(s.homing){const t=this.actors().filter(t=>!t.boss).sort((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y))[0];if(t){const dx=(t.left+t.right)/2-s.x,dy=(t.top+t.bottom)/2-s.y,l=Math.hypot(dx,dy)||1;s.vx=s.vx*.9+dx/l*.5;s.vy=s.vy*.9+dy/l*.5;}}
      const count=Math.max(1,Math.ceil(Math.hypot(s.vx,s.vy)/2));let alive=true;
      for(let i=0;i<count;i++){
        const oldX=s.x,oldY=s.y;s.x+=s.vx/count;s.y+=s.vy/count;
        if(s.kind==='spikeball')this.spikeContact(s.x,s.y);
        const tile=tileAt(this.nes,s.x,s.y);
        if(!tile){alive=false;break;}
        if(s.kind==='copy'){
          const form=tileForm(this.m[M.Level_Tileset],tile.value);
          if(form){this.capture({form,tile:tile,tileEnemy:true,boss:false});alive=false;break;}
        }
        if(tile.solid){
          if(s.breaks&&tile.brick)this.breakBrick(tile);
          if(s.bounces>0&&s.vy>0&&!tileAt(this.nes,s.x,oldY)?.solid){s.x=oldX;s.y=oldY;s.vy=-3;s.bounces--;break;}
          if(s.returning){s.age=25;s.x=oldX;s.y=oldY;break;}
          alive=false;this.burst(s.x,s.y,s.color,7);break;
        }
        const target=this.actors().find(t=>s.x>=t.left-3&&s.x<=t.right+3&&s.y>=t.top-3&&s.y<=t.bottom+3);
        if(target){
          if(s.kind==='copy')this.capture(target);else this.defeat(target);
          if(!s.pierce){alive=false;break;}
        }
      }
      if(alive)next.push(s);
    }
    this.shots=next.slice(-64);
  }
  breakBrick(tile){
    if(!tile?.brick)return;
    if(tile.giant){const offset=tile.value-0x47,x=tile.x-(offset%2)*16,y=tile.y-Math.floor(offset/2)*16;for(const [dx,dy]of[[0,0],[16,0],[0,16],[16,16]]){const t=tileAt(this.nes,x+dx,y+dy);if(t?.brick)this.removeTile(t);}}
    else this.removeTile(tile);
  }
  removeTile(t){
    this.m[0x6000+t.index]=0x80;this.refreshTile(t.index,0x80);this.stats.bricks++;this.m[0x4f3]|=1;
    for(let i=0;i<4;i++)this.effects.push({kind:'chip',x:t.x+(i%2)*8,y:t.y+(i>>1)*8,vx:(i%2?1:-1),vy:-2-(i>>1),life:26,max:26,color:'#e8b475'});
  }
  refreshTile(index,value){
    const n=this.nes,m=this.m,view=this.position,vertical=m[M.Level_7Vertical];
    const screen=Math.floor(index/(vertical?240:432)),offset=index%(vertical?240:432);
    const x=(vertical?0:screen*256)+(offset%16)*16,y=(vertical?screen*240:0)+Math.floor(offset/16)*16;
    if(x+16<view.cameraX||x>view.cameraX+256||y+16<view.cameraY||y>view.cameraY+224)return;
    const bank=[11,15,21,16,17,19,18,18,18,20,23,19,17,19,13][m[M.Level_Tileset]];if(bank===undefined)return;
    const base=16+bank*8192;
    for(let qx=0;qx<2;qx++)for(let qy=0;qy<2;qy++){
      const col=((x>>3)+qx)%32,row=((y>>3)+qy)%30,table=0x2000+((Math.floor(y/240)%2)*0x800);
      n.ppu.mirroredWrite(table+row*32+col,this.rom[base+(qx*2+qy)*256+value]);
    }
    const row=Math.floor(y/8)%30,col=Math.floor(x/8)%32,addr=0x23c0+(Math.floor(y/240)%2)*0x800+Math.floor(row/4)*8+Math.floor(col/4),shift=((row&2)?4:0)+((col&2)?2:0),previous=n.ppu.vramMem[n.ppu.vramMirrorTable[addr]];
    n.ppu.mirroredWrite(addr,(previous&~(3<<shift))|((value>>6)<<shift));
  }
  snapshot(){return {version:1,rom:'4377a7f5e6eb50bdd2ac6f249bf1a7085500aca8eb41f38545c3a2731c51a579',state:this.nes.toJSON(),form:this.form.key,copied:[...this.copied],stats:{...this.stats},frame:this.frame,plantExtension:this.plantExtension,spikeHeight:this.spikeHeight,sprites:this.sprites.serialize()};}
  restore(save){
    if(save?.version!==1||save.rom!=='4377a7f5e6eb50bdd2ac6f249bf1a7085500aca8eb41f38545c3a2731c51a579'||!BY_KEY.has(save.form)||!save.state?.cpu)throw new Error('This is not a Copy Kingdom save for this Mario 3 ROM.');
    this.nes.fromJSON(save.state);this.form=BY_KEY.get(save.form);this.copied=new Set((save.copied??[]).filter(k=>BY_KEY.has(k)));this.stats={...this.stats,...save.stats};this.frame=save.frame??0;this.sprites.restore(save.sprites);this.clearEffects();this.plantExtension=Number.isFinite(save.plantExtension)?clamp(save.plantExtension,0,1):1;this.spikeHeight=Number.isFinite(save.spikeHeight)?clamp(save.spikeHeight,-8,120):40;this.release();this.lastScene=this.scene;this.onChange(this.form);
  }
}
