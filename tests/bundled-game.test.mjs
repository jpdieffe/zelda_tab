import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ROM_SHA256 } from '../dist/zelda.js';

test('deployment includes the exact USA game required by the live-memory bridge',async()=>{
  const rom=await readFile(new URL('../dist/assets/alttp-usa.sfc',import.meta.url));
  assert.equal(rom.length,1048576);
  assert.equal(createHash('sha256').update(rom).digest('hex'),ROM_SHA256);
});
