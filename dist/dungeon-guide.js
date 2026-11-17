import {tileAttribute,solidAttribute} from './collision.js';
import {roomBounds,inLoadedRoom} from './dungeon-safety.js';
const word=(r,a)=>r[a]|r[a+1]<<8;
const NAMES=['Castle / Sewers','Hyrule Castle','Eastern Palace','Desert Palace','Castle Tower','Swamp Palace','Palace of Darkness','Misery Mire','Skull Woods','Ice Palace','Tower of Hera',"Thieves' Town",'Turtle Rock',"Ganon's Tower"];
const STAIRS=new Set([0x1c,0x1d,0x1e,0x1f,0x22,0x30,0x31,0x32,0x33,0x34,0x35,0x36,0x37,0x3d,0x3e,0x3f]);
const FLOOR=new Set([0,5,6,7,0x14,0x15,0x16,0x17,0x21,0x23,0x24,0x25,0x38,0x39,0x3a,0x3b,0x3c,0x40,0x48,0x4a,0x5e,0x5f,0x60,0x61,0x62,0x64,0x65,0x66,0xa6,0xa7]);
const DIRS=[[0,-1,'up','↑'],[0,1,'down','↓'],[-1,0,'left','←'],[1,0,'right','→']];
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
  const point=i=>({x:bounds.left+(i%64)*8+4,y:bounds.top+(i>>6)*8+4});
  for(let i=0;i<4096;i++){
    const p=point(i);attrs[i]=tileAttribute(r,rom,p.x,p.y);
    walk[i]=[-5,5].every(dx=>[2,7].every(dy=>p.x+dx>=bounds.left&&p.x+dx<bounds.right&&p.y+dy<bounds.bottom&&dungeonWalkable(tileAttribute(r,rom,p.x+dx,p.y+dy),p.x+dx,p.y+dy)));
  }
  const seen=new Uint8Array(4096),features=[];
  for(let i=0;i<4096;i++){
    const type=kind(attrs[i]);if(!type||seen[i])continue;
    const cells=[i];seen[i]=1;
    for(let q=0;q<cells.length;q++)for(const [dx,dy]of DIRS){
      const at=cells[q],x=at%64+dx,y=(at>>6)+dy,n=y*64+x;
      if(x>=0&&x<64&&y>=0&&y<64&&!seen[n]&&kind(attrs[n])===type&&(type!=='chest'||attrs[n]===attrs[i])){seen[n]=1;cells.push(n);}
    }
    const points=cells.map(point),minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
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
function routes(map,x,y){
  const prev=new Int16Array(4096).fill(-1),dist=new Int16Array(4096).fill(-1);
  let start=-1,best=Infinity;
  for(let i=0;i<4096;i++)if(map.walk[i]){const p=map.point(i),d=Math.hypot(p.x-x,p.y-y);if(d<best){best=d;start=i;}}
  if(start<0||best>24)return {prev,dist,start:-1};
  const queue=[start];dist[start]=0;
  for(let q=0;q<queue.length;q++)for(const [dx,dy]of DIRS){
    const i=queue[q],nx=i%64+dx,ny=(i>>6)+dy,n=ny*64+nx;
    if(nx>=0&&nx<64&&ny>=0&&ny<64&&map.walk[n]&&dist[n]<0){dist[n]=dist[i]+1;prev[n]=i;queue.push(n);}
  }
  return {prev,dist,start};
}
function approach(map,route,f){
  let index=-1,best=Infinity;
  for(let i=0;i<4096;i++){
    if(route.dist[i]<0)continue;
    const p=map.point(i),dx=Math.max(f.minX-p.x,0,p.x-f.maxX),dy=Math.max(f.minY-p.y,0,p.y-f.maxY);
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
  if(f.type==='chest')return 'Stand below the chest, face up, and press A to open it. A big chest needs this dungeon\'s Big Key.';
  if(f.type==='stairs')return 'As Link, walk into the stairs. Keep holding toward them until the next floor finishes loading.';
  if(f.type==='switch')return 'As Link, step onto the middle of the floor switch. Watch which door or floor changes.';
  if(f.type==='torch')return 'Face the torch and use the Lamp or Fire Rod with Y. Light the other torches before this one goes out.';
  if(f.type==='block')return 'As Link, push against the block. If it will not move, try another side after defeating the enemies.';
  if(f.type==='pot')return 'Face the object and press A to lift it. Check underneath for a key or floor switch.';
  if(f.type==='warp')return 'Step onto the center of the warp tile as Link, then wait for the room to change.';
  if(f.attr>=0xf0){
    const slot=f.attr&15,type=r[0x1980+slot*2];
    if(type===0x1c||type===0x1e)return r[0xf36f]?'Walk against the locked door as Link to spend one small key.':'This door needs a small key. Check other reachable rooms, pots and enemies first.';
    if(type>=32&&type<=38)return 'This lock needs the dungeon\'s Big Key. Return here after finding it.';
    if(type===0x28||type===48)return 'Place a bomb with Y against the cracked wall, then step away.';
    return roomPuzzle(r);
  }
  return `As Link, walk ${f.direction===undefined?'straight':['up','down','left','right'][f.direction]} through the doorway. Keep holding toward the opening until the next room appears.`;
}
function steps(path){
  const segments=[];
  for(let i=1;i<path.length;i++){
    const dx=path[i].x-path[i-1].x,dy=path[i].y-path[i-1].y,dir=DIRS.find(d=>d[0]===Math.sign(dx)&&d[1]===Math.sign(dy));
    if(!dir)continue;
    if(segments.at(-1)?.dir===dir)segments.at(-1).pixels+=8;else segments.push({dir,pixels:8});
  }
  return segments.map(s=>`${s.dir[3]} Go ${s.dir[2]} about ${Math.max(1,Math.round(s.pixels/16))} floor tile${s.pixels>24?'s':''}`);
}
export class DungeonGuide{
  constructor(){this.reset();}
  reset(){this.scene=null;this.selected=null;this.visited=new Map();this.entry=null;this.last=null;this.lastAt=0;this.choice=0;}
  next(){this.choice++;this.selected=null;this.lastAt=0;}
  read(r,rom,objective,now=performance.now()){
    if(!r[0x1b]){this.scene=null;return null;}
    const room=word(r,0xa0),scene=`${room}:${r[0xee]}`,x=word(r,0x22)+8,y=word(r,0x20)+8;
    if(scene!==this.scene){
      if(this.scene&&this.selected)this.visited.set(`${this.scene}:${this.selected}`,(this.visited.get(`${this.scene}:${this.selected}`)||0)+1);
      this.scene=scene;this.selected=null;this.choice=0;this.lastAt=0;
    }
    if(this.lastAt&&now-this.lastAt<180)return this.last;
    this.lastAt=now;
    const floor=r[0xa4]>127?`B${256-r[0xa4]}`:`${r[0xa4]+1}F`,name=dungeonName(r);
    const roomName=r[0x40c]===6?({0x85:'East wing',0x84:'Central hall',0x83:'West wing',0x63:'Rear entrance',0x53:'Rear section',0x43:'Torch room',0x33:'Lanmolas'})[room]:null;
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
    const target=choices.find(f=>f.id===this.selected)||choices[this.choice%Math.max(1,choices.length)];
    if(!target){base.label=`${name}: no clear walking route here. ${base.puzzle}`;base.steps=['Release the tank before navigating this room.',base.puzzle,'Use X for the dungeon map. If the room is invisible or out of sync, tap Unstuck.'];return this.last=base;}
    this.selected=target.id;base.target={x:target.x,y:target.y,label:target.label};base.path=target.path;
    const directions=steps(target.path);base.arrived=target.path.length<=2;
    const waypoint=base.arrived?target:target.path[Math.min(1,target.path.length-1)];
    base.angle=Math.atan2(waypoint.y-y,waypoint.x-x);
    base.steps=[...directions,action(r,target)];
    base.label=`${name} · ${target.label}: ${base.arrived?action(r,target):directions[0]||action(r,target)}`;
    return this.last=base;
  }
}
