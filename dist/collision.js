// USA ROM tables and WRAM layout from snesrev/zelda3's tile_detect.c,
// sprite.c and assets/compile_resources.py. Coordinates are world pixels.
const word = (bytes, i) => bytes[i] | bytes[i + 1] << 8;
export const romOffset = address => (address & 0x7f0000) >> 1 | address & 0x7fff;
export function tileAttribute(ram, rom, x, y) {
  x = Math.floor(x) & 0xffff; y = Math.floor(y) & 0xffff;
  if (ram[0x1b]) return ram[0x12000 + (ram[0xee] ? 0x1000 : 0) + ((y & 0x1f8) << 3) + ((x & 0x1f8) >> 3)];
  if (!rom) return 0;
  const tileX = x >> 3;
  const index = (((y - word(ram, 0x708)) & word(ram, 0x70a)) * 8) |
    ((tileX - word(ram, 0x70c)) & word(ram, 0x70e));
  const map16 = word(ram, 0x2000 + (index >> 1) * 2);
  const quadrant = ((y & 8) >> 2) | (tileX & 1);
  const tile = word(rom, romOffset(0x8f8000) + (map16 * 4 + quadrant) * 2);
  let attr = rom[romOffset(0x8e9459) + (tile & 0x1ff)];
  if (attr >= 0x10 && attr < 0x1c) attr |= tile >> 14 & 1;
  return attr;
}

export function solidAttribute(attr, x, y) {
  // Fairy magic flies over water, pits, stairs and low ledges. Walls, fences,
  // closed doors and solid objects stop it. Sloped walls test the actual pixel.
  if (attr >= 0x10 && attr <= 0x13 || attr >= 0x18 && attr <= 0x1b) {
    const slope = attr & 3, edge = slope === 0 || slope === 3 ? 7 - (x & 7) : x & 7;
    return slope < 2 ? (y & 7) <= edge : (y & 7) >= edge;
  }
  return [1, 4, 0x26, 0x27, 0x43].includes(attr) ||
    attr >= 0x30 && attr <= 0x37 || attr >= 0x6c && attr <= 0x6f ||
    attr >= 0x80 && attr <= 0xaf && attr !== 0x8e || attr >= 0xf0;
}

export function wallAt(ram, rom, x, y) {
  return solidAttribute(tileAttribute(ram, rom, x, y), Math.floor(x), Math.floor(y));
}
