const word=(r,a)=>r[a]|r[a+1]<<8;
export const EASTERN_ROOMS={0xc9:'Entrance switches',0xb9:'Rolling-ball hall',0xa9:'Bow chamber',0xa8:'West wing',0xb8:'Big Key room',0xaa:'East wing',0xba:'Dark small-key room',0x99:'Eyegore key room',0xda:'Upstairs pot switch',0xd9:'Upstairs switch rooms',0xd8:'Red Eyegore rooms',0xc8:'Armos Knights'};
// Coordinates and gates come from the USA ROM's loaded collision maps.
// Progress, layer and quadrant select the next required action, not proximity.
export function easternObjective(r){
  if(r[0x40c]!==4)return null;
  const room=word(r,0xa0),x=(word(r,0x22)+8)&511,y=(word(r,0x20)+8)&511,layer=r[0xee];
  const bigKey=!!(word(r,0xf366)&0x2000),bow=!!r[0xf340],key=r[0xf36f];
  const attr=(x,y)=>r[0x12000+(layer?0x1000:0)+((y&0x1f8)<<3)+((x&0x1f8)>>3)];
  const closed=(x,y)=>attr(x,y)>=0xf0;
  const object=(x,y)=>{const a=attr(x,y);return a>=0x50&&a<=0x56||a>=0x70&&a<=0x7f;};
  const fighters=()=>Array.from({length:16},(_,i)=>i).some(i=>r[0xdd0+i]===9&&[0x4e,0x4f,0xa7,0x83,0x84].includes(r[0xe20+i]));
  let mission=bigKey?(bow?'Use the Bow to reach the Armos Knights and collect the green pendant.':'Open the big chest in the central chamber to collect the Bow.'):'Find the small key in the east dark room, then the Big Key in the west room, then the Bow.';
  const goal=(id,x,y,label,instruction,extra={})=>({id:`eastern-${room}-${id}`,x,y,label,instruction,mission,...extra});
  const exit=(x,y,dir,label)=>goal('exit',x,y,label,`As Link, keep walking ${dir} through this doorway until you are fully through.`);
  const stairs=(xTarget,yTarget,label='Stairs to the next passage')=>goal('stairs',xTarget,yTarget,label,`Walk ${y>yTarget?'up':'down'} along these stairs as Link until you reach the other end.`,{feature:'stairs'});
  const switchAt=(x,y,label='Floor switch')=>goal('switch',x,y,label,object(x,y)?'Face this pot and press A to lift it. Throw it with A, then stand on the switch underneath.':'Step onto the center of this floor switch. When the shutter opens, follow the new arrow.');
  const fight=text=>goal('fight',x,y,'Defeat the enemies to open the way',text,{stationary:true});
  if(r[0x308]&0x80)return goal('throw',x,y,'Throw the pot you are carrying','Press A once to throw the pot you are holding. Then follow the next arrow.',{stationary:true});
  if(room===0xc8)return fight('Stay in the boss room. Shoot the six moving Armos Knights with the Bow. Keep moving when the last knight turns red. Afterward, collect the heart container and the green pendant.');
  if(room===0xc9){
    if(closed(256,304)&&y>256)return switchAt(248,360,'Pot hiding the entrance switch');
    if(closed(256,48))return switchAt(248,152,'Switch on the narrow bridge');
    return exit(256,8,'up','North door to the rolling-ball hall');
  }
  if(room===0xb9){
    const usedEastKey=!!(word(r,0xf000+0xba*2)&0x8000);
    if(!bigKey&&(key||usedEastKey))return exit(8,136,'left','West door to the Big Key room');
    if(!layer&&y>256)return stairs(208,420,'Left stairs down into the rolling-ball corridor');
    if(layer)return stairs(208,108,'North stairs out of the rolling-ball corridor');
    return exit(256,8,'up','North door to the Bow chamber');
  }
  if(room===0xa9){
    if(!bigKey){
      if(layer)return exit(504,136,'right','East passage toward the small key');
      if(closed(32,264)){if(object(72,328))return goal('switch-pot',72,328,'Pot blocking the west floor switch','Face this pot and press A to lift it. Throw it, then step left onto the switch.');return switchAt(56,328,'West floor switch beside the pots');}
      return exit(8,264,'left','West door to the Stalfos rooms');
    }
    if(!bow){
      if(!layer){if(y<196)return stairs(256,104,'Stairs down to the big-chest platform');if(closed(32,264)){if(object(72,328))return goal('switch-pot',72,328,'Pot blocking the west switch','Lift this pot with A, throw it, then step left onto the floor switch.');return switchAt(56,328);}return exit(8,264,'left','West loop to the big-chest bridge');}
      return goal('bow',256,220,'Big chest: Bow','Stand below the big chest, face up, and press A to collect the Bow.',{chest:true});
    }
    if(layer)return stairs(256,100,'North stairs to the Big Key door');
    return exit(256,32,'up','Big Key door to the Eyegores');
  }
  if(room===0xa8){
    if(layer)return exit(504,136,'right','East bridge back to the Bow chamber');
    if(bigKey&&x>256)return stairs(384,432,'Stairs back to the central bridge');
    if(y>256&&x>256)return exit(128,384,'left','West passage into the Stalfos room');
    if(y>256){
      if(closed(128,304))return object(128,392)?goal('stalfos-pot',128,392,'Central pot: reveal the Stalfos','Lift this pot with A. Defeat the Stalfos that appear; thrown pots also hurt them.'):fight('Defeat every Stalfos in this section. Use B or throw pots with A. The north shutter opens when they are gone.');
      return exit(128,192,'up','North passage to the compass room');
    }
    return stairs(88,136,'Stairs down to the east bridge');
  }
  if(room===0xaa){
    if(layer)return stairs(128,404,'South stairs into the dark-room passage');
    return exit(128,496,'down','South door to the dark small-key room');
  }
  if(room===0xba){
    if(key||!closed(32,136))return exit(8,136,'left','Locked west door back across the palace');
    if(x<256&&closed(224,136))return switchAt(200,168,'Switch that opens the east key room');
    return goal('small-key',456,104,'Small key under the northeast pot','Face the pot in the upper-right corner and press A to lift it. Walk onto the small key underneath.');
  }
  if(room===0xb8){
    if(bigKey)return exit(384,32,'up','North door back to the Bow chamber');
    if(fighters())return fight('Defeat the tentacle monsters, Stalfos and green Eyegore. Wake the Eyegore and throw a pot at its open eye. Avoid the circling skulls.');
    if(attr(392,136)>=0x58&&attr(392,136)<=0x5d)return goal('big-key',392,136,'Big Key chest','Stand below this chest, face up, and press A to take the Big Key.',{chest:true});
    return switchAt(392,216,'Pot and switch that reveal the Big Key');
  }
  if(room===0x99){
    if(!key&&closed(128,304)){
      for(let i=0;i<16;i++)if(r[0xdd0+i]===9&&r[0xe20+i]===0xe4)return goal('dropped-key',(r[0xd10+i]|r[0xd30+i]<<8)&511,(r[0xd00+i]|r[0xd20+i]<<8)&511,'Small key dropped by the Eyegore','Walk onto the dropped small key.');
      return fight('Equip the Bow with Start. Wake the green Eyegores and shoot their open eyes with Y. The right Eyegore drops the small key; pick it up.');
    }
    return stairs(128,292,'Northwest locked stairs to the second floor');
  }
  if(room===0xda){if(closed(32,392))return switchAt(104,408,'Switch under the southwest pot');return exit(8,392,'left','West door to the switch rooms');}
  if(room===0xd9){
    if(x>256&&closed(288,392))return switchAt(392,440,'Bottom switch in the Eyegore room');
    if(x<256&&closed(32,392))return switchAt(88,344,'Upper-left switch in the rolling-ball room');
    return exit(8,392,'left','West door toward the red Eyegores');
  }
  if(room===0xd8){
    if(y>256&&closed(384,304))return fight('Defeat the Stalfos and red Eyegore here. Wake the red Eyegore, then shoot its open eye twice with the Bow. The north shutter opens.');
    if(y<256&&closed(384,48))return fight('Defeat the tentacle monsters and both red Eyegores. Shoot each red Eyegore twice in its open eye. Collect arrows from the pots, then go north to the boss.');
    return exit(384,32,'up','North door to the Armos Knights');
  }
  return goal('side-room',x,y,'Return from this side room','Use the return warp or stairs to rejoin the main palace route.',{stationary:true});
}
