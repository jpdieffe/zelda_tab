import test from 'node:test';
import assert from 'node:assert/strict';
import {DungeonGuide,roomMap} from '../dist/dungeon-guide.js';
import {recoverDungeon,inLoadedRoom,roomBounds} from '../dist/dungeon-safety.js';
import {word} from '../dist/zelda.js';
import {readFileSync} from 'node:fs';
import {desertObjective} from '../dist/desert-route.js';
const put=(r,a,v)=>{r[a]=v&255;r[a+1]=v>>8;};
const tile=(r,x,y,v)=>{r[0x12000+(r[0xee]?0x1000:0)+((y&0x1f8)<<3)+((x&0x1f8)>>3)]=v;};
function fixture(){const r=new Uint8Array(0x20000);r[0x1b]=1;r[0x10]=7;r[0x40c]=6;r[0xf36d]=24;r[0x10e]=9;put(r,0x22,56);put(r,0x20,104);r.fill(1,0x12000,0x14000);for(let y=32;y<240;y+=8)for(let x=32;x<240;x+=8)tile(r,x,y,0);return r;}
test('dungeon routes go around walls, stop below chests, and report individual turns',()=>{
  const r=fixture();for(let y=32;y<168;y+=8)tile(r,112,y,1);
  for(let y=80;y<96;y+=8)for(let x=184;x<200;x+=8)tile(r,x,y,0x58);
  const guide=new DungeonGuide().read(r,null,{id:'desert',label:'Desert'},1000);
  assert.equal(guide.target.label,'Chest');assert.ok(guide.steps.length>=4);
  assert.ok(guide.steps[0].includes('down'));assert.ok(guide.steps.at(-1).includes('press A'));
  assert.ok(guide.path.some(p=>p.y>=168));assert.ok(guide.path.every(p=>p.x<112||p.x>120||p.y>=168));
  assert.ok(guide.path.at(-1).y>=100);assert.equal(guide.room,'Desert Palace · 1F');
});
test('guide never routes through a locked door, pit or a different collision plane',()=>{
  const r=fixture();for(let y=32;y<240;y+=8){tile(r,112,y,1);tile(r,120,y,1);}tile(r,112,112,0xf0);tile(r,120,112,0xf0);
  tile(r,192,112,0x58);tile(r,64,64,0x20);r[0x1980]=0x1c;
  const guide=new DungeonGuide().read(r,null,{id:'desert',label:'Desert'},1000);
  assert.equal(guide.target.label,'Inner door');assert.ok(guide.steps.at(-1).includes('needs a small key'));
  assert.ok(!guide.options.some(o=>o.label==='Chest'));assert.ok(guide.path.every(p=>p.x<112));
  r[0xee]=1;assert.equal(roomMap(r,null).features.length,0);
});
test('out-of-room coordinates produce recovery guidance instead of a false arrow',()=>{
  const r=fixture();put(r,0xa0,0xbb);put(r,0x22,5482);put(r,0x20,5680);
  assert.deepEqual(roomBounds(r),{left:5632,top:5632,right:6144,bottom:6144});assert.equal(inLoadedRoom(r),false);
  const guide=new DungeonGuide().read(r,null,{id:'desert',label:'Desert'},1000);assert.equal(guide.angle,null);assert.match(guide.label,/Unstuck/);
});
test('native entrance recovery preserves inventory and records room flags and keys',()=>{
  const r=fixture();r[0x4b]=12;r[0x2e4]=1;r[0x37b]=1;r[0xf36f]=2;put(r,0xa0,0xbb);put(r,0x400,0xa000);put(r,0x402,0x1400);put(r,0x408,7);
  const inventory=r.slice(0xf340,0xf37c);assert.ok(recoverDungeon(r));assert.deepEqual(r.slice(0xf340,0xf37c),inventory);
  assert.equal(word(r,0xf000+0xbb*2),0xa147);assert.equal(r[0xf37f],2);assert.equal(r[0x11],25);assert.equal(r[0x13],15);
  for(const a of [0x4b,0x2e4,0x37b,0x31f,0x5d])assert.equal(r[a],0);
  r[0x1b]=0;const unchanged=r.slice();assert.equal(recoverDungeon(r),false);assert.deepEqual(r,unchanged);
  r[0x1b]=1;r[0xf36d]=0;assert.equal(recoverDungeon(r),false,'no resurrection');
});

function desertSave(name='east'){
  const fixture=JSON.parse(readFileSync(new URL(`./fixtures/desert-${name}.json`,import.meta.url),'utf8')),r=new Uint8Array(0x20000);
  for(const [a,...bytes]of fixture.ranges)r.set(bytes,a);
  let i=0x12000;for(const [a,n]of fixture.tiles){r.fill(a,i,i+n);i+=n;}
  return r;
}
test('real Desert map advances past the internal west doorway instead of turning back',()=>{
  const r=desertSave(),guide=new DungeonGuide(),objective={id:'desert',label:'Desert'};
  const first=guide.read(r,null,objective,1000);
  assert.equal(first.target.label,'West passage');assert.match(first.destination,/central hall/);
  assert.match(first.steps.join(' '),/walk left through/);
  assert.equal(first.path.at(-1).y&511,384,'line up with the doorway, not the adjacent wall');
  put(r,0x22,2560+200);put(r,0x20,4096+384);
  const after=guide.read(r,null,objective,1200);
  assert.equal(after.target.label,'West opening to the central hall');
  assert.ok(after.steps.some(s=>s.includes('Go up')),'corridor turns north before reaching the open west boundary');
  assert.ok(after.path.every(p=>p.x<2816),'never goes back through the crossed door');
  guide.next();assert.equal(guide.read(r,null,objective,1400).target.label,after.target.label,'objective route cannot be changed into random nearby doors');
  assert.equal(after.options.length,0);
});
test('the arrow keeps pointing forward while Link is inside an internal doorway',()=>{
  const r=desertSave();put(r,0x22,2560+280);put(r,0x20,4096+376);
  const guide=new DungeonGuide().read(r,null,{id:'desert'},1000);
  assert.match(guide.steps[0],/walk left through/);
  assert.ok(guide.target.x<word(r,0x22)+8);assert.ok(Math.cos(guide.angle)<0);
});
test('the Big Key boss door and small-key stair locks have different instructions',()=>{
  for(const [type,key,expected]of [[0x1e,0,/Big Key/],[0x20,0,/small key/],[0x20,1,/spend one small key/]]){
    const r=fixture();for(let y=32;y<240;y+=8){tile(r,112,y,1);tile(r,120,y,1);}tile(r,112,112,0xf0);tile(r,120,112,0xf0);r[0x1980]=type;r[0xf36f]=key;
    assert.match(new DungeonGuide().read(r,null,{id:'desert'},1000).steps.at(-1),expected);
  }
});
test('Desert goal uses progress and rear-room order, not distance or visited doors',()=>{
  const r=desertSave();
  for(const [room,expected]of [[0x85,/central hall/],[0x84,/north hall/],[0x83,/outdoor west ledge/],[0x63,/Stairs/],[0x53,/torch room/],[0x43,/Lanmolas/],[0x33,/pendant/]]){
    put(r,0xa0,room);assert.match(desertObjective(r).label,expected);
  }
  put(r,0xa0,0x73);r[0xf354]=0;assert.match(desertObjective(r).label,/Power Glove/);
  put(r,0xf366,0);put(r,0xa0,0x75);assert.match(desertObjective(r).label,/Big Key chest/);
});
test('a missing route never falls back to a nearby door in a guided Desert room',()=>{
  const r=desertSave();r.fill(1,0x12000,0x14000);
  const guide=new DungeonGuide().read(r,null,{id:'desert'},1000);
  assert.equal(guide.angle,null);assert.equal(guide.target,undefined);assert.match(guide.steps[0],/central hall/);
});

test('the real central hall routes through an open north corridor, not its solid west wall',()=>{
  const r=desertSave('84');put(r,0x22,2048+484);put(r,0x20,4096+216);
  const guide=new DungeonGuide().read(r,null,{id:'desert'},1000);
  assert.match(guide.target.label,/North corridor/);assert.ok(guide.path.length>20);
  assert.ok(guide.target.x>=2048+424);assert.equal(guide.target.y,4096+8);
  const map=roomMap(r,null);assert.ok(guide.path.every(p=>map.walk[((p.y-4096)>>3)*64+((p.x-2048)>>3)]),'every displayed step stays on real floor');
});
test('rear entrance targets the movable shutter block, then the actual key pot for the locked stairs',()=>{
  const r=desertSave('63');let guide=new DungeonGuide().read(r,null,{id:'desert'},1000);
  assert.equal(guide.target.label,'Block that opens the shutter');assert.equal(guide.target.x&511,176);
  // After the native shutter transition, Link is in the upper-left section.
  put(r,0x22,1536+120);put(r,0x20,3072+176);
  guide=new DungeonGuide().read(r,null,{id:'desert'},1000);
  assert.equal(guide.target.label,'Small key under this pot');assert.equal(guide.target.x&511,56);assert.equal(guide.target.y&511,200);
});
test('the north hall and northwest wing continue toward the west exit after room transitions',()=>{
  for(const [room,expected]of [['74',/West opening to the northwest wing/],['73',/South passage to the west wing/]]){
    const r=desertSave(room),guide=new DungeonGuide().read(r,null,{id:'desert'},1000);
    assert.match(guide.target.label,expected);assert.ok(guide.path.length>5);assert.equal(guide.puzzle,'');
  }
});
test('missing small key routes to the raised torch until the east-wing lock has been opened',()=>{
  const r=desertSave();r[0xf354]=0;put(r,0xf366,0);put(r,0x400,0);
  assert.match(desertObjective(r).mission,/raised torch/);
  put(r,0x400,0x4000);assert.match(desertObjective(r).label,/Big Key room/);
});
