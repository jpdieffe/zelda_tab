const word=(r,a)=>r[a]|r[a+1]<<8;
const REAR=new Set([0x63,0x53,0x43,0x33]);
// USA dungeon room coordinates, not screen coordinates. The destination is
// chosen from progress; dungeon-guide finds the next gate on the actual map.
export function desertObjective(r){
  if(r[0x40c]!==6)return null;
  const room=word(r,0xa0),bigKey=!!(word(r,0xf366)&0x1000),glove=!!r[0xf354];
  const goal=(id,x,y,label,instruction,extra={})=>({id,x,y,label,instruction,...extra});
  const exit=(x,y,direction,label)=>goal('exit',x,y,label,`As Link, keep walking ${['up','down','left','right'][direction]} through this opening until the room changes.`,{direction});
  let destination,mission;
  if(REAR.has(room)&&!(r[0xf374]&2)){
    mission='Reach the Lanmolas in the rear section, defeat all three, then collect the pendant.';
    if(room===0x63)destination=goal('rear-stairs',128,40,'Stairs to the next floor','Walk up into the stairs. First push the block to open the inner shutter; lift the southwest pot in the next section for the small key to the stairs.');
    if(room===0x53)destination=exit(384,32,0,'North door to the torch room');
    if(room===0x43)destination=exit(128,32,0,'North door to the Lanmolas');
    if(room===0x33)destination=goal('boss',128,128,'Lanmolas and pendant','Stay in this room. Strike each worm as it comes out of the sand; defeat all three and collect the pendant.',{stationary:true});
  }else if(glove||r[0xf374]&2){
    mission=r[0xf374]&2?'Desert Palace complete. Leave the dungeon.':'Reach the rear entrance: central hall → north hall → northwest wing → west wing → south exit. Outside, follow the ledge north and lift the rocks with A.';
    destination=({
      0x85:exit(8,392,2,'West opening to the central hall'),
      0x84:exit(256,8,0,'North corridor to the north hall'),
      0x83:exit(128,496,1,'South exit to the outdoor west ledge'),
      0x73:exit(448,496,1,'South passage to the west wing'),
      0x74:exit(8,392,2,'West opening to the northwest wing'),
      0x75:exit(384,496,1,'South door back to the east wing'),
    })[room];
  }else if(bigKey){
    mission='Get the Power Glove from the big chest in the northwest wing.';
    destination=({
      0x85:exit(8,392,2,'West opening to the central hall'),
      0x84:exit(256,8,0,'North corridor to the north hall'),
      0x83:exit(448,8,0,'North passage to the big chest wing'),
      0x73:goal('glove',128,128,'Big chest: Power Glove','Stand below the big chest, face up, and press A.',{chest:true}),
      0x74:exit(8,392,2,'West opening to the northwest wing'),
      0x75:exit(384,496,1,'South door back to the east wing'),
    })[room];
  }else if(!r[0xf36f]&&room!==0x75&&!((word(r,room===0x85?0x400:0xf000+0x85*2))&0x4000)){
    mission='Get the small key on the raised torch in the northwest wing. Face the torch and dash into it with the Pegasus Boots (hold A), then pick up the key.';
    destination=({
      0x85:exit(8,392,2,'West opening to the central hall'),
      0x84:exit(256,8,0,'North corridor to the north hall'),
      0x74:exit(8,392,2,'West opening to the northwest wing'),
      0x83:exit(448,8,0,'North passage to the northwest wing'),
      0x73:goal('torch-key',328,104,'Small key on the raised torch','Face the raised torch and dash into it with the Pegasus Boots (hold A). Pick up the fallen small key; the route then changes to the Big Key room.'),
    })[room];
  }else{
    mission='Get the Big Key in the northeast room. The locked east-wing passage needs a small key; the raised torch in the northwest wing holds one (dash into it with the boots).';
    destination=({
      0x83:exit(448,8,0,'North passage to the northwest wing'),
      0x84:exit(504,136,3,'East opening to the east wing'),
      0x85:exit(384,32,0,'North door to the Big Key room'),
      0x75:goal('big-key',384,88,'Big Key chest','Defeat the enemies if the chest is missing. Stand below the chest, face up, and press A.',{chest:true}),
      0x73:exit(504,392,3,'East opening to the north hall'),
      0x74:exit(384,496,1,'South opening to the central hall'),
    })[room];
  }
  return destination?{...destination,id:`desert-${destination.id}-${room}`,mission}:null;
}

// Actual key pots in the rear section (secret item 8 in the USA ROM).
export function desertKeyPot(room){return ({0x63:[56,200],0x53:[408,184],0x43:[456,328]})[room]||null;}
