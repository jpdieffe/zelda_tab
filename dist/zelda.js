import { wallAt } from './collision.js';
import { readGuidance } from './guidance.js';
// USA ALttP 1.0 only. Addresses verified against snesrev/zelda3 variables.h
// and Sprite_GiveDamage / Sprite_MiniMoldorm_Recoil in sprite.c.
export const ROM_SHA256 = '66871d66be19ad2c34c927d6b14cd8eb6fc3181965b6e517cb361f7316009cfb';
export const RAM_SIZE = 0x20000;
export const ADDR = Object.freeze({
  module: 0x10, submodule: 0x11, frame: 0x1a, linkY: 0x20, linkX: 0x22,
  cameraX: 0xe2, cameraY: 0xe8, floor: 0xee, room: 0xa0, area: 0x8a,
  indoors: 0x1b, state: 0xdd0, type: 0xe20, hp: 0xe50,
  xLo: 0xd10, xHi: 0xd30, yLo: 0xd00, yHi: 0xd20, z: 0xf70,
  flags3: 0xe60, hit: 0xef0, recoil: 0xea0, damage: 0xce2,
  recoilX: 0xf40, recoilY: 0xf30, spriteFloor: 0xf20, pause: 0xf00,
});
// Conservative allowlist: common, ordinary enemies. Bosses, NPCs, traps,
// switches, scripted entities and enemies with special death logic excluded.
export const ENEMIES = new Set([
  0x08, 0x0a, // Octoroks
  0x0e, // Snap dragon
  0x0f, // Octoballoon
  0x10, // Octoballoon baby
  0x12, // Moblin
  0x13, // Mini helmasaur
  0x18, // Mini moldorm
  0x19, // Poe
  0x20, // Sluggula
  0x22, // Ropa
  0x23, // Red bari
  0x24, // Blue bari
  0x41, 0x42, 0x43, // Guards
  0x44, 0x45, 0x46, // Guards
  0x47, 0x48, 0x49, 0x4a, // Bush, javelin and bomb guards
  0x4b, // Green recruit
  0x4c, // Geldman
  0x4e, 0x4f, // Popos
  0x56, // Walking Zora
  0x58, // Crab
  0x6a, // Ball and chain guard
  0x6d, // Rat
  0x6e, // Rope
  0x6f, // Keese
  0x71, // Leever
  0x7c, 0x85, // Green and yellow Stalfos
  0x8b, // Gibdo
  0x8f, // Blob
  0x99, // Pengator
  0xa5, 0xa6, // Zazaks
  0xa7, // Stalfos
  0xd0, // Lynel
]);

export const word = (ram, offset) => ram[offset] | (ram[offset + 1] << 8);
const signedDifference = (a, b) => ((a - b + 0x8000) & 0xffff) - 0x8000;

export function snapshotRam(state) {
  const marker = new TextEncoder().encode('RAM:131072:');
  outer: for (let i = 0; i <= state.length - marker.length - RAM_SIZE; i++) {
    if (state[i] !== marker[0]) continue;
    for (let j = 1; j < marker.length; j++) if (state[i+j] !== marker[j]) continue outer;
    return state.slice(i + marker.length, i + marker.length + RAM_SIZE);
  }
  throw new Error('This emulator save format is not supported. Fairy shots are disabled.');
}

export function findRamCandidates(heap, ram, excludeStart = -1, excludeSize = 0) {
  // Pick a varied 32-byte window, then verify ALL 128 KiB. Never assume a
  // fixed WASM pointer. Serialized copies are eliminated by live-frame checks.
  let anchor = 0;
  for (let i = 0; i < 0x2000; i += 32) {
    if (new Set(ram.subarray(i, i + 32)).size >= 12) { anchor = i; break; }
  }
  const candidates = [];
  for (let pos = heap.indexOf(ram[anchor]); pos >= 0; pos = heap.indexOf(ram[anchor], pos + 1)) {
    const base = pos - anchor;
    if (base < 0 || base + RAM_SIZE > heap.length || (base >= excludeStart && base < excludeStart + excludeSize)) continue;
    let match = true;
    for (let j = 1; j < 32; j++) if (heap[pos+j] !== ram[anchor+j]) { match = false; break; }
    if (!match) continue;
    for (let j = 0; j < RAM_SIZE; j++) if (heap[base+j] !== ram[j]) { match = false; break; }
    if (match) candidates.push(base);
  }
  return candidates;
}

export class ZeldaBridge {
  constructor(manager, rom) { this.manager = manager; this.rom = rom; this.pointer = null; }
  get ram() {
    if (this.pointer === null) return null;
    // Recreate the view after possible WebAssembly memory growth.
    return this.manager.Module.HEAPU8.subarray(this.pointer, this.pointer + RAM_SIZE);
  }
  async connect() {
    const gm = this.manager;
    for (let attempt = 0; attempt < 5; attempt++) {
      const [size, start, ok] = gm.functions.saveStateInfo().split('|').map(Number);
      if (ok !== 1) throw new Error('Could not read the game state.');
      const heap = gm.Module.HEAPU8;
      const ram = snapshotRam(heap.slice(start, start + size));
      const candidates = findRamCandidates(heap, ram, start, size);
      await new Promise(resolve => setTimeout(resolve, 85));
      const live = candidates.filter(base => gm.Module.HEAPU8[base + ADDR.frame] !== ram[ADDR.frame]);
      if (live.length === 1) {
        const check = snapshotRam(gm.getState());
        const view = gm.Module.HEAPU8.subarray(live[0], live[0] + RAM_SIZE);
        if (check.every((b, i) => b === view[i])) {
          this.pointer = live[0];
          return;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 180));
    }
    throw new Error('Could not safely locate live game memory. Reload to retry fairy shots.');
  }
  read() {
    const ram=this.ram;if(!ram)return null;
    const world=readWorld(ram);
    world.wallAt=(x,y)=>wallAt(ram,this.rom,x+world.cameraX,y+world.cameraY);
    if(world.active)world.guidance=readGuidance(ram,this.rom);
    return world;
  }
  hit(target, fairy) { return this.ram ? applyHit(this.ram, target, fairy) : false; }
}

export function readWorld(ram) {
  const active = (ram[ADDR.module] === 7 || ram[ADDR.module] === 9) && ram[ADDR.submodule] === 0;
  const cameraX = word(ram, ADDR.cameraX), cameraY = word(ram, ADDR.cameraY);
  const world = {
    active, scene: `${ram[ADDR.indoors]}:${ram[ADDR.indoors] ? word(ram, ADDR.room) : word(ram, ADDR.area)}`,
    cameraX, cameraY,
    link: {x:signedDifference(word(ram,ADDR.linkX),cameraX)+8, y:signedDifference(word(ram,ADDR.linkY),cameraY)+8},
    enemies: [],
  };
  if (!active) return world;
  for (let slot = 0; slot < 16; slot++) {
    if (ram[ADDR.state+slot] !== 9 || !ENEMIES.has(ram[ADDR.type+slot]) ||
        !ram[ADDR.hp+slot] || ram[ADDR.hp+slot] >= 0xf0 ||
        (ram[ADDR.flags3+slot] & 0x40) || ram[ADDR.pause+slot] ||
        ram[ADDR.spriteFloor+slot] !== ram[ADDR.floor]) continue;
    const x = signedDifference(ram[ADDR.xLo+slot] | ram[ADDR.xHi+slot]<<8, cameraX)+8;
    const y = signedDifference(ram[ADDR.yLo+slot] | ram[ADDR.yHi+slot]<<8, cameraY)+8-ram[ADDR.z+slot];
    if (x < 0 || x > 256 || y < 32 || y > 224) continue;
    world.enemies.push({slot, type:ram[ADDR.type+slot], x, y, vulnerable:!ram[ADDR.hit+slot] && !ram[ADDR.damage+slot]});
  }
  return world;
}

export function applyHit(ram, target, fairy) {
  const world = readWorld(ram);
  const current = world.enemies.find(e=>e.slot===target.slot && e.type===target.type && e.vulnerable);
  if (!current || !world.active || Math.hypot(current.x - fairy.x, current.y - fairy.y) > 58) return false;
  const slot = current.slot;
  // Queue a small hit in the game's own recoil/damage path. The game handles
  // health, death animations, drops, room counters and progression itself.
  ram[ADDR.damage + slot] = 1;
  ram[ADDR.hit + slot] = 0x20;
  ram[ADDR.recoil + slot] = current.type === 0x18 ? 11 : 15;
  const distance = Math.hypot(current.x-fairy.x,current.y-fairy.y) || 1;
  ram[ADDR.recoilX+slot] = Math.round((current.x-fairy.x)/distance*20) & 255;
  ram[ADDR.recoilY+slot] = Math.round((current.y-fairy.y)/distance*20) & 255;
  return true;
}
