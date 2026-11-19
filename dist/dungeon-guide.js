import {tileAttribute,solidAttribute} from './collision.js';
import {roomBounds,inLoadedRoom} from './dungeon-safety.js';
import {desertObjective,desertKeyPot} from './desert-route.js';
const word=(r,a)=>r[a]|r[a+1]<<8;
const NAMES=['Castle / Sewers','Hyrule Castle','Eastern Palace','Desert Palace','Castle Tower','Swamp Palace','Palace of Darkness','Misery Mire','Skull Woods','Ice Palace','Tower of Hera',"Thieves' Town",'Turtle Rock',"Ganon's Tower"];
const STAIRS=new Set([0x1c,0x1d,0x1e,0x1f,0x22,0x30,0x31,0x32,0x33,0x34,0x35,0x36,0x37,0x3d,0x3e,0x3f]);
const FLOOR=new Set([0,5,6,7,0x14,0x15,0x16,0x17,0x21,0x23,0x24,0x25,0x38,0x39,0x3a,0x3b,0x3c,0x40,0x48,0x4a,0x5e,0x5f,0x60,0x61,0x62,0x64,0x65,0x66,0xa6,0xa7]);
const DIRS=[[0,-1,'up','↑'],[0,1,'down','↓'],[-1,0,'left','←'],[1,0,'right','→']];
const smallKeyDoor=t=>t===0x1c||t>=0x20&&t<=0x26;
export const dungeonName=r=>NAMES[r[0x40c]>>1]||'Inside';
export function dungeonWalkable(a,x,y){return FLOOR.has(a)||a>=0x68&&a<=0x6b||a>=0x10&&a<=0x1b&&!solidAttribute(a,x,y);}
function kind(a){
  if(a>=0x58&&a<=0x5d)return 'chest';
  if(STAIRS.has(a))return 'stairs';
  if(a>=0x80&&a<=0xaf&&a!==0xa6&&a!==0xa7||a>=0xf0)return 'door';
  if(a===0x23||a===0x24)return 'switch';
  if(a>=0xc0&&a<=0xcf)return 'torch';
  if(a===0x4b)return 'warp';
  if(a>=0x70&&a<=0x7f)return 'block';
  if(a>=0x50&&a<=0x56)return 'pot';
  return null;
}
export function roomPuzzle(r){
  const tags=[r[0xae],r[0xaf]];
  if(tags.includes(0x1d))return 'Light all four torches quickly with the Lamp or Fire Rod (Y). The wall moves to reveal the boss passage when all four are lit.';
  if(tags.includes(0x33)||tags.includes(0x3e))return 'Light every torch quickly with the Lamp or Fire Rod (Y). The room changes when all are lit.';
  if(tags.includes(0x3c))return 'Push the movable block one tile to reveal the chest. Walk against it; do not use the tank.';
  if(tags.some(t=>t>=0xb&&t<=0x14))return 'Push the movable block one tile to open the shutter. Walk against it as Link; try another side if it does not move.';
  if(tags.includes(0x16))return 'Keep the floor switch pressed. A movable block can hold it down while you use the door.';
  if(tags.includes(0x17))return 'Step on the floor switch to change the doors.';
  if(tags.some(t=>t>=1&&t<=0xa||t===0x26||t>=0x29&&t<=0x32))return 'Defeat the enemies in this section, then check for an opened door or a chest. Lift pots with A if you need a key or switch.';
  return 'Follow the marked passage. Use A to lift pots or open chests; use doors and stairs as Link.';
}
function mission(r){
  if(r[0x40c]!==6)return '';
  if(!(word(r,0xf366)&0x1000))return 'Desert Palace: find the small key and Big Key before the big chest. Check the raised torch with the small key; dash into it with the boots.';
  if(!r[0xf354])return 'Desert Palace: use the Big Key on the big chest to get the Power Glove.';
  if([0x63,0x53,0x43,0x33].includes(word(r,0xa0)))return 'Desert Palace rear section: work north toward the Lanmolas. Lift pots for keys, push blocks to open shutters, and light all four torches in the final room. Strike the worms when they emerge, then collect the pendant.';
  if(!(r[0xf374]&2))return 'Desert Palace: leave through the west exit, follow the outdoor ledge north, lift the rocks with A, and enter the rear section. In the final torch room, light all four torches to reveal the boss passage.';
  return 'Desert Palace complete. Return outside to continue the story.';
}
// Build a map from the LOADED collision plane, never from a presumed floorplan.
// A door/stair is a destination, not a walk-through edge: native transitions
// and puzzle gates get the final say. Rebuild after switches or layer changes.
export function roomMap(r,rom){
  const bounds=roomBounds(r),attrs=new Uint8Array(4096),walk=new Uint8Array(4096);
  // Link's center sits on tile boundaries in 16-pixel doorways. Sampling
  // tile centers incorrectly erases those passages and 8-pixel floor strips.
  const point=i=>({x:bounds.left+(i%64)*8,y:bounds.top+(i>>6)*8});
  for(let i=0;i<4096;i++){
    const p=point(i);attrs[i]=tileAttribute(r,rom,p.x,p.y);
    walk[i]=[-7,7].every(dx=>[0,15].every(dy=>p.x+dx>=bounds.left&&p.x+dx<bounds.right&&p.y+dy<bounds.bottom&&dungeonWalkable(tileAttribute(r,rom,p.x+dx,p.y+dy),p.x+dx,p.y+dy)));
  }
  const seen=new Uint8Array(4096),features=[];
  for(let i=0;i<4096;i++){
    const type=kind(attrs[i]);if(!type||seen[i])continue;
    const cells=[i];seen[i]=1;
    for(let q=0;q<cells.length;q++)for(const [dx,dy]of DIRS){
      const at=cells[q],x=at%64+dx,y=(at>>6)+dy,n=y*64+x;
      if(x>=0&&x<64&&y>=0&&y<64&&!seen[n]&&kind(attrs[n])===type&&(type!=='chest'||attrs[n]===attrs[i])){seen[n]=1;cells.push(n);}
    }
    const points=cells.map(i=>{const p=point(i);return {x:p.x+4,y:p.y+4};}),minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
    const x=(minX+maxX)/2,y=(minY+maxY)/2;
    const label=type==='door'?`${y-bounds.top<96?'North':y-bounds.top>416?'South':x-bounds.left<96?'West':x-bounds.left>416?'East':'Inner'} door`:({chest:'Chest',stairs:'Stairs',switch:'Floor switch',torch:'Torch',warp:'Warp tile',block:'Movable block',pot:'Pot / liftable object'})[type];
    const feature={id:`${type}:${i}`,type,label,cells,x,y,minX,maxX,minY,maxY,attr:attrs[i]};
    if(type==='door'){
      let nearest=Infinity;
      for(let slot=0;slot<16;slot++){
        const pos=word(r,0x19a0+slot*2);if(!pos)continue;
        const tx=bounds.left+(pos&0x7e)*4,ty=bounds.top+((pos&0x1f80)>>4),distance=Math.hypot(tx+12-x,ty+12-y);
        if(distance<nearest&&distance<64){nearest=distance;feature.direction=r[0x19c0+slot*2]&3;feature.doorType=r[0x1980+slot*2];}
      }
      if(feature.direction!==undefined)feature.label=`${['North','South','West','East'][feature.direction]} ${label==='Inner door'?'passage':'door'}`;
    }
    features.push(feature);
  }
  return {bounds,attrs,walk,features,point};
}
function routes(map,x,y,walk=map.walk){
  const prev=new Int16Array(4096).fill(-1),dist=new Int16Array(4096).fill(-1);
  let start=-1,best=Infinity;
  for(let i=0;i<4096;i++)if(walk[i]){const p=map.point(i),d=Math.hypot(p.x-x,p.y-y);if(d<best){best=d;start=i;}}
  if(start<0||best>24)return {prev,dist,start:-1};
  const queue=[start];dist[start]=0;
  for(let q=0;q<queue.length;q++)for(const [dx,dy]of DIRS){
    const i=queue[q],nx=i%64+dx,ny=(i>>6)+dy,n=ny*64+nx;
    if(nx>=0&&nx<64&&ny>=0&&ny<64&&walk[n]&&dist[n]<0){dist[n]=dist[i]+1;prev[n]=i;queue.push(n);}
  }
  return {prev,dist,start};
}
function approach(map,route,f){
  let index=-1,best=Infinity;
  for(let i=0;i<4096;i++){
    if(route.dist[i]<0)continue;
    const p=map.point(i),dx=Math.max(f.minX-p.x,0,p.x-f.maxX),dy=Math.max(f.minY-p.y,0,p.y-f.maxY);
    if(f.type==='door'&&f.direction>=2&&Math.abs(p.y-(f.y-8))>1)continue;
    if(f.type==='door'&&f.direction<2&&Math.abs(p.x-f.x)>4)continue;
    if(f.type==='chest'&&(p.y<f.maxY+6||p.y>f.maxY+22||p.x<f.minX-4||p.x>f.maxX+4))continue;
    if(Math.hypot(dx,dy)>21)continue;
    const score=route.dist[i]+Math.hypot(p.x-f.x,p.y-f.y)/8;
    if(score<best){best=score;index=i;}
  }
  if(index<0)return null;
  const cells=[];for(let i=index;i>=0;i=route.prev[i])cells.push(i);
  return cells.reverse().map(map.point);
}
function action(r,f){
  if(f.instruction)return f.instruction;
  if(f.type==='chest')return 'Stand below the chest, face up, and press A to open it. A big chest needs this dungeon\'s Big Key.';
  if(f.type==='stairs')return 'As Link, walk into the stairs. Keep holding toward them until the next floor finishes loading.';
  if(f.type==='switch')return 'As Link, step onto the middle of the floor switch. Watch which door or floor changes.';
  if(f.type==='torch')return 'Face the torch and use the Lamp or Fire Rod with Y. Light the other torches before this one goes out.';
  if(f.type==='block')return 'As Link, push against the block. If it will not move, try another side after defeating the enemies.';
  if(f.type==='pot')return 'Face the object and press A to lift it. Check underneath for a key or floor switch.';
  if(f.type==='warp')return 'Step onto the center of the warp tile as Link, then wait for the room to change.';
  if(f.attr>=0xf0){
    const slot=f.attr&15,type=r[0x1980+slot*2];
    const toward=f.direction===undefined?'forward':['up','down','left','right'][f.direction];
    if(smallKeyDoor(type))return r[0xf36f]?`As Link, walk ${toward} against the locked door to spend one small key.`:'This door needs a small key. Check other reachable rooms, pots and enemies first.';
    if(type===0x1e)return word(r,0xf366)&(0x8000>>(r[0x40c]>>1))?`As Link, walk ${toward} against the lock to open it with the Big Key.`:'This lock needs the dungeon\'s Big Key. Return here after finding it.';
    if(type===0x28)return 'Dash into the cracked wall with the Pegasus Boots (hold A).';
    if(type===48)return 'Place a bomb with Y against the cracked wall, then step away.';
    return roomPuzzle(r);
  }
  return `As Link, walk ${f.direction===undefined?'straight':['up','down','left','right'][f.direction]} through the doorway. Keep holding until you are fully through; the route then advances.`;
}
function pointFeature(map,g){
  const x=map.bounds.left+g.x,y=map.bounds.top+g.y;
  const f={...g,type:g.chest?'chest':'waypoint',x,y,minX:x,maxX:x,minY:y,maxY:y};
  if(g.x<=8||g.x>=504){f.minY=map.bounds.top;f.maxY=map.bounds.bottom-1;}
  if(g.y<=8){f.minX=map.bounds.left;f.maxX=map.bounds.right-1;}
  return f;
}
function featureDistance(f,p){return Math.hypot(Math.max(f.minX-p.x,0,p.x-f.maxX),Math.max(f.minY-p.y,0,p.y-f.maxY));}
function routeToObjective(r,map,route,x,y,goal){
  if(goal.stationary)return {stationary:true,instruction:goal.instruction};
  const destination=pointFeature(map,goal);
  if(goal.chest){const chest=map.features.find(f=>f.type==='chest'&&Math.hypot(f.x-destination.x,f.y-destination.y)<48);if(chest)Object.assign(destination,chest,{label:goal.label,instruction:goal.instruction});}
  // Doors and stairs connect regions only in this planning graph. The displayed
  // walking path always stops at the first gate, using the real collision map.
  const plan=(closed)=>{
    const attrs=map.attrs.slice(),walk=new Uint8Array(4096),at=(x,y)=>attrs[(y>>3)*64+(x>>3)];
    // Native same-room transitions bridge the wall between paired quadrant
    // door mouths. Only connect a verified, aligned pair; never fill walls
    // just because a destination is on the other side.
    const doors=map.features.filter(f=>f.type==='door'&&f.direction!==undefined);
    for(const a of doors)for(const b of doors){
      if(a.direction!==(b.direction^1)||Math.hypot(a.x-b.x,a.y-b.y)>100)continue;
      const vertical=a.direction<2;
      if(vertical?Math.abs(a.x-b.x)>1:Math.abs(a.y-b.y)>1)continue;
      for(let i=0;i<4096;i++){
        const p=map.point(i);
        if(vertical?p.y>Math.min(a.y,b.y)&&p.y<Math.max(a.y,b.y)&&Math.abs(p.x-a.x)<=8:p.x>Math.min(a.x,b.x)&&p.x<Math.max(a.x,b.x)&&Math.abs(p.y-a.y)<=8)attrs[i]=0x80;
      }
    }
    const pass=(a,x,y)=>dungeonWalkable(a,x,y)||kind(a)==='stairs'||kind(a)==='door'&&(closed||a<0xf0);
    for(let i=0;i<4096;i++){
      const px=(i%64)*8,py=(i>>6)*8;
      walk[i]=[-7,7].every(dx=>[0,15].every(dy=>px+dx>=0&&px+dx<512&&py+dy<512&&pass(at(px+dx,py+dy),px+dx,py+dy)));
    }
    const inPassage=map.features.some(f=>f.type==='door'&&f.x-map.bounds.left>96&&f.x-map.bounds.left<416&&f.y-map.bounds.top>96&&f.y-map.bounds.top<416&&featureDistance(f,{x,y})<=12);
    const start=!inPassage&&route.start>=0?map.point(route.start):{x,y};
    return approach(map,routes(map,start.x,start.y,walk),destination);
  };
  const path=plan(false)||plan(true);
  if(path){
    if(goal.x<=8||goal.x>=504)destination.y=path.at(-1).y;
    if(goal.y<=8)destination.x=path.at(-1).x;
    const finalLock=map.features.find(f=>f.type==='door'&&f.attr>=0xf0&&Math.hypot(f.x-destination.x,f.y-destination.y)<24);
    if(finalLock)path.push({x:finalLock.x,y:finalLock.y});
    const barrier=path.findIndex(p=>!map.walk[((p.y-map.bounds.top)>>3)*64+((p.x-map.bounds.left)>>3)]);
    if(barrier<0)return {...destination,path:approach(map,route,destination)||path};
    const p=path[barrier],gate=map.features.filter(f=>['door','stairs'].includes(f.type)&&featureDistance(f,p)<=14).sort((a,b)=>featureDistance(a,p)-featureDistance(b,p))[0];
    if(gate){
      const before=path[Math.max(0,barrier-1)],after=path[Math.min(path.length-1,barrier+4)];
      const horizontal=gate.direction===undefined?gate.maxX-gate.minX>gate.maxY-gate.minY:gate.direction>=2;
      const direction=horizontal?(after.x>=before.x?3:2):(after.y>=before.y?1:0);
      const target={...gate,direction,path:approach(map,route,gate)};
      if(gate.attr<0xf0&&featureDistance(gate,{x,y})<=12){
        target.path=[{x,y}];
        target.x=horizontal?(direction===2?gate.minX-16:gate.maxX+16):x;
        target.y=horizontal?y:direction===0?gate.minY-16:gate.maxY+16;
      }
      if(!target.path)return null;
      if(gate.attr>=0xf0){
        const type=gate.doorType??r[0x1980+(gate.attr&15)*2],room=word(r,0xa0);
        if(smallKeyDoor(type)&&!r[0xf36f]){
          const pot=desertKeyPot(room),f=pot&&map.features.find(f=>['pot','block'].includes(f.type)&&Math.hypot(f.x-map.bounds.left-pot[0],f.y-map.bounds.top-pot[1])<20);
          const potPath=f&&approach(map,route,f);
          if(potPath)return {...f,path:potPath,label:'Small key under this pot',instruction:'Face this pot and press A to lift it. Collect the small key underneath, then follow the updated route to the locked door.'};
        }
        if(room===0x63&&[0x18,0x36,0x38].includes(type)){
          const f=map.features.filter(f=>f.type==='block').sort((a,b)=>Math.hypot(a.x-map.bounds.left-80,a.y-map.bounds.top-352)-Math.hypot(b.x-map.bounds.left-80,b.y-map.bounds.top-352))[0];
          const blockPath=f&&approach(map,route,f);
          if(blockPath)return {...f,path:blockPath,label:'Block that opens the shutter',instruction:'As Link, push this block one tile. When the north shutter opens, the guide continues toward the stairs.'};
        }
      }
      return target;
    }
  }
  // The torch-room wall really changes the floorplan. Do not invent a path
  // through it or redirect to the entrance while waiting for the puzzle.
  if(word(r,0xa0)===0x43&&r[0xaf]===0x1d){
    return {stationary:true,instruction:roomPuzzle(r)};
  }
  return null;
}
function steps(path){
  const segments=[];
  for(let i=1;i<path.length;i++){
    const dx=path[i].x-path[i-1].x,dy=path[i].y-path[i-1].y,dir=DIRS.find(d=>d[0]===Math.sign(dx)&&d[1]===Math.sign(dy));
    if(!dir)continue;
    if(segments.at(-1)?.dir===dir)segments.at(-1).pixels+=8;else segments.push({dir,pixels:8});
  }
  return segments.map(s=>{const tiles=Math.max(1,Math.round(s.pixels/16));return `${s.dir[3]} Go ${s.dir[2]} about ${tiles} floor tile${tiles>1?'s':''}`;});
}
export class DungeonGuide{
  constructor(){this.reset();}
  reset(){this.scene=null;this.selected=null;this.visited=new Map();this.entry=null;this.last=null;this.lastAt=0;this.choice=0;}
  next(){this.choice++;this.selected=null;this.lastAt=0;}
  read(r,rom,objective,now=performance.now()){
    if(!r[0x1b]){this.scene=null;return null;}
    const room=word(r,0xa0),x=word(r,0x22)+8,y=word(r,0x20)+8;
    const scene=`${room}:${r[0xee]}:${(x&511)>>8}:${(y&511)>>8}`;
    if(scene!==this.scene){
      if(this.scene&&this.selected)this.visited.set(`${this.scene}:${this.selected}`,(this.visited.get(`${this.scene}:${this.selected}`)||0)+1);
      this.scene=scene;this.selected=null;this.choice=0;this.lastAt=0;
    }
    if(this.lastAt&&now-this.lastAt<180)return this.last;
    this.lastAt=now;
    const floor=r[0xa4]>127?`B${256-r[0xa4]}`:`${r[0xa4]+1}F`,name=dungeonName(r);
    const roomName=r[0x40c]===6?({0x85:'East wing',0x84:'Central hall',0x83:'West wing',0x75:'Big Key room',0x74:'North hall',0x73:'Northwest wing',0x63:'Rear entrance',0x53:'Rear section',0x43:'Torch room',0x33:'Lanmolas'})[room]:null;
    const base={id:objective.id,dungeon:true,label:`${name} · ${floor}`,angle:null,arrived:false,path:[],room:[name,floor,roomName].filter(Boolean).join(' · '),mission:mission(r)||objective.label,puzzle:roomPuzzle(r),options:[],steps:[]};
    if(!inLoadedRoom(r)){base.label='Room out of sync — tap Unstuck to return to the entrance.';base.steps=[base.label];return this.last=base;}
    const map=roomMap(r,rom),route=routes(map,x,y),choices=map.features.map(f=>({...f,path:approach(map,route,f)})).filter(f=>f.path);
    if(!this.entry||this.entry.scene!==scene){
      const near=choices.filter(f=>['door','stairs'].includes(f.type)).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];
      this.entry={scene,id:near&&Math.hypot(near.x-x,near.y-y)<64?near.id:null};
    }
    const priorities={chest:0,switch:1,stairs:2,door:3,warp:4,block:5,pot:6,torch:7};
    choices.sort((a,b)=>{
      const score=f=>{
        let priority=priorities[f.type]*1000;
        // With the glove already earned, lead out of the main Desert wings
        // toward the west ledge and rear entrance instead of collecting maps.
        if(r[0x40c]===6&&r[0xf354]&&f.type==='door'&&(([0x84,0x85].includes(room)&&f.direction===2)||(room===0x83&&f.direction===1)))priority=-1000;
        return priority+(this.visited.get(`${scene}:${f.id}`)||0)*5000+(this.entry.id===f.id?6000:0)+(f.attr>=0xf0?1500:0)+f.path.length;
      };
      return score(a)-score(b);
    });
    base.options=choices.map(f=>({id:f.id,label:f.label}));
    const goal=desertObjective(r);
    if(goal){base.mission=goal.mission;base.destination=goal.label;base.options=[];}
    const target=goal?routeToObjective(r,map,route,x,y,goal):choices.find(f=>f.id===this.selected)||choices[this.choice%Math.max(1,choices.length)];
    if(target?.stationary){base.label=`${name}: ${target.instruction}`;base.steps=[target.instruction];return this.last=base;}
    if(goal&&!target){base.label=`${name}: ${goal.label}`;base.steps=[`Next destination: ${goal.label}.`,base.puzzle,'The route will continue when this room\'s gate opens.'];return this.last=base;}
    if(!target){base.label=`${name}: no clear walking route here. ${base.puzzle}`;base.steps=['Release the tank before navigating this room.',base.puzzle,'Use X for the dungeon map. If the room is invisible or out of sync, tap Unstuck.'];return this.last=base;}
    this.selected=target.id;base.target={x:target.x,y:target.y,label:target.label};base.path=target.path;
    if(goal)base.puzzle='';
    const directions=steps(target.path);base.arrived=target.path.length<=2;
    const waypoint=base.arrived?target:target.path[Math.min(1,target.path.length-1)];
    base.angle=Math.atan2(waypoint.y-y,waypoint.x-x);
    base.steps=[...directions,action(r,target),...(goal&&target.id!==goal.id?[`Then continue toward: ${goal.label}.`]:[])];
    base.label=`${name} · ${target.label}: ${base.arrived?action(r,target):directions[0]||action(r,target)}`;
    return this.last=base;
  }
}
