import { romOffset } from './collision.js';
const word = (b, i) => b[i] | b[i + 1] << 8;
const goal = (id, label, entrance, extra = {}) => ({id, label, entrance, ...extra});

// Completion masks are the original map's kPendantBitMask/kCrystalBitMask.
// Choose a recommended adventure order, skipping anything already completed.
export function nextObjective(r) {
  const progress=r[0xf3c5],pendants=r[0xf374],crystals=r[0xf37a];
  if(progress<2){
    if(!r[0xf359])return goal('uncle','Find Uncle · lift the bush by the castle',125,{hole:true});
    return goal('rescue','Rescue Zelda, then take her to Sanctuary',4);
  }
  if(!(pendants&4))return goal('eastern','Eastern Palace · find the bow and green pendant',8,{palace:4});
  if(!r[0xf355])return goal('boots','Show Sahasrahla the green pendant · get the boots',69);
  if(!(pendants&2)){
    if(!r[0xf34e])return goal('book','Library · dash into the shelf for the Book of Mudora',73);
    return goal('desert','Desert Palace · use the book at the entrance',9,{palace:6});
  }
  if(!(pendants&1)||!r[0xf357]){
    if(!r[0xf353])return goal('mountain','Death Mountain · guide the old man to get the mirror',6);
    return goal('hera','Tower of Hera · get the Moon Pearl and pendant',51,{palace:20});
  }
  if(r[0xf359]<2)return goal('sword','Lost Woods · claim the Master Sword',null,{x:0x6d,y:0x70,dark:false});
  if(progress<3)return goal('agahnim','Castle tower · rescue Zelda from Agahnim',36,{palace:8});
  if(!(crystals&2))return goal('darkness','Palace of Darkness · find the hammer and crystal',38,{palace:12});
  if(!(crystals&0x10)){
    if(!r[0xf356])return goal('flippers','Zora Falls · buy flippers from King Zora (500 rupees)',null,{x:0xf80,y:0x100,dark:false});
    return goal('swamp','Swamp Palace · drain the Light World watergate first',37,{palace:10});
  }
  if(!(crystals&0x40))return goal('skull','Skull Woods · find the Fire Rod, then the final entrance',r[0xf345]?43:40,{palace:16});
  if(!(crystals&0x20))return goal('thieves',"Thieves’ Town · find the Titan’s Mitt and crystal",52,{palace:22});
  if(!(crystals&4))return goal('ice','Ice Palace · melt the entrance enemy with the Fire Rod',45,{palace:18});
  if(!(crystals&1)){
    if(!r[0xf34c])return goal('shovel','Haunted Grove · talk to the flute player for his shovel',null,{x:0x4c0,y:0xb00,dark:true});
    if(r[0xf34c]<2)return goal('flute','Haunted Grove · dig up the flute with the shovel',null,{x:0x4c0,y:0xb00,dark:false});
    if(r[0xf34c]===2)return goal('bird','Kakariko · play the flute by the weather vane',null,{x:0x298,y:0x948,dark:false});
    if(!r[0xf348])return goal('ether','Death Mountain · read the Ether tablet with the book',null,{x:0x700,y:0x30,dark:false});
    return goal('mire','Misery Mire · fly to the desert, use Ether at the entrance',39,{palace:14});
  }
  if(!(crystals&8)){
    if(!r[0xf346])return goal('ice-rod','Ice Rod cave · bomb the entrance by Lake Hylia',132);
    if(!r[0xf349])return goal('quake','Lake of Ill Omen · throw a stone into the circle',null,{x:0xf00,y:0x400,dark:true});
    return goal('turtle','Turtle Rock · use Quake at the entrance',53,{palace:24});
  }
  if(!(r[0xf2db]&0x20))return goal('tower',"Ganon’s Tower · climb to Agahnim",55,{palace:26});
  return goal('ganon','Pyramid · follow Ganon into the hole',123,{hole:true});
}

export function entrancePoint(rom, id, hole=false) {
  if(!rom||id==null)return null;
  const count=hole?19:129,areas=hole?0x9bb826:0x9bb96f,positions=hole?0x9bb800:0x9bba71,ids=hole?0x9bb84c:0x9bbb73;
  for(let i=0;i<count;i++)if(rom[romOffset(ids)+i]===id){
    const area=word(rom,romOffset(areas)+i*2),p=word(rom,romOffset(positions)+i*2)+(hole?0x400:0);
    return {x:(area&7)*512+((p>>1)&63)*16+8,y:((area&56)>>3)*512+((p>>7)&63)*16+8,dark:Boolean(area&64)};
  }
  return null;
}

export function readGuidance(r,rom) {
  const objective=nextObjective(r),room=word(r,0xa0),indoors=Boolean(r[0x1b]);
  const result={id:objective.id,label:objective.label,angle:null,arrived:false};
  const linkX=word(r,0x22)+8,linkY=word(r,0x20)+8;
  const point=(x,y,label)=>{
    if(label)result.label=label;
    result.arrived=Math.hypot(x-linkX,y-linkY)<18;
    result.angle=Math.atan2(y-linkY,x-linkX);return result;
  };
  if(indoors){
    // Point to relevant NPCs when they are actually present in this room.
    const npc=objective.id==='uncle'?0x73:objective.id==='rescue'&&r[0xf3cc]!==1?0x76:objective.id==='boots'?0x16:objective.id==='mountain'?0xad:null;
    if(npc!==null)for(let i=0;i<16;i++)if(r[0xdd0+i]===9&&r[0xe20+i]===npc)
      return point((r[0xd10+i]|r[0xd30+i]<<8)+8,(r[0xd00+i]|r[0xd20+i]<<8)+8);
    // The house has one unambiguous exit. Entrance coordinates are in ROM,
    // so this remains accurate after loading a save or scrolling the camera.
    if(room===0x104&&rom)return point(word(rom,romOffset(0x82d063)+2)+8,word(rom,romOffset(0x82cf59)+2)+24,'Leave the house · head to Hyrule Castle');
    // Indoor rooms use a different coordinate space. Never point an outdoor
    // compass through a dungeon wall using unrelated world coordinates.
    if(objective.palace===word(r,0x40c))result.label=objective.label+' · X opens the dungeon map';
    else if(objective.id==='rescue')result.label=r[0xf3cc]===1?'Take Zelda to the throne room · push the ornament, follow the sewers':'Find Zelda in the castle basement · X opens the map';
    else result.label=objective.label+' · continue outside when ready';
    return result;
  }
  const target=objective.x!==undefined?objective:entrancePoint(rom,objective.entrance,objective.hole);
  if(!target)return result;
  // Special outdoor maps (Master Sword grove, Zora Falls) have local coords.
  const area=word(r,0x8a);
  if(area>=0x80){
    result.label=objective.id==='sword'?'Pull the Master Sword from its pedestal':objective.id==='flippers'?'Talk to King Zora · buy flippers':'Return to the main overworld to follow the compass';
    return result;
  }
  const dark=Boolean(area&0x40);
  if(dark!==target.dark){
    if(dark){result.label='Use the Magic Mirror to return to the Light World · '+objective.label;return result;}
    // After Agahnim, the castle gate is a reliable Dark World portal.
    const portal=entrancePoint(rom,4);return point(portal.x,portal.y,'Castle gate · enter the Dark World, then '+objective.label);
  }
  return point(target.x,target.y);
}

export function drawGuidance(ctx,world) {
  const guide=world?.guidance;if(!world?.active||guide?.angle==null)return;
  const a=guide.angle,x=Math.max(10,Math.min(246,world.link.x+Math.cos(a)*22)),y=Math.max(40,Math.min(214,world.link.y+Math.sin(a)*22));
  ctx.save();ctx.translate(x,y);ctx.fillStyle='#ffe59b';ctx.strokeStyle='#19322d';ctx.lineWidth=2;
  if(guide.arrived){ctx.beginPath();ctx.arc(0,0,4,0,Math.PI*2);ctx.stroke();ctx.fill();}
  else{ctx.rotate(a);ctx.beginPath();ctx.moveTo(7,0);ctx.lineTo(-5,-5);ctx.lineTo(-2,0);ctx.lineTo(-5,5);ctx.closePath();ctx.stroke();ctx.fill();}
  ctx.restore();
}
