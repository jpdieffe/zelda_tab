import test from 'node:test';
import assert from 'node:assert/strict';
import {DungeonGuide,roomMap} from '../dist/dungeon-guide.js';
import {recoverDungeon,inLoadedRoom,roomBounds} from '../dist/dungeon-safety.js';
import {word} from '../dist/zelda.js';
const put=(r,a,v)=>{r[a]=v&255;r[a+1]=v>>8;};
const tile=(r,x,y,v)=>{r[0x12000+(r[0xee]?0x1000:0)+((y&0x1f8)<<3)+((x&0x1f8)>>3)]=v;};
function fixture(){const r=new Uint8Array(0x20000);r[0x1b]=1;r[0x10]=7;r[0x40c]=6;r[0xf36d]=24;r[0x10e]=9;put(r,0x22,56);put(r,0x20,104);r.fill(1,0x12000,0x14000);for(let y=32;y<240;y+=8)for(let x=32;x<240;x+=8)tile(r,x,y,0);return r;}
test('dungeon routes go around walls, stop below chests, and report individual turns',()=>{
  const r=fixture();for(let y=32;y<168;y+=8)tile(r,112,y,1);
  for(let y=80;y<96;y+=8)for(let x=184;x<200;x+=8)tile(r,x,y,0x58);
  const guide=new DungeonGuide().read(r,null,{id:'desert',label:'Desert'},1000);
  assert.equal(guide.target.label,'Chest');assert.ok(guide.steps.length>=4);
  assert.ok(guide.steps[0].includes('down'));assert.ok(guide.steps.at(-1).includes('press A'));
  assert.ok(guide.path.some(p=>p.y>168));assert.ok(guide.path.every(p=>p.x<112||p.x>120||p.y>168));
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
