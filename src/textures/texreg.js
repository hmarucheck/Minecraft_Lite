// Texture painter registry: exact names and regex families.
import { rngFor, Tex } from './pixel.js';

const exact = new Map();
const families = [];

export function T(name, fn) { exact.set(name, fn); }
export function F(re, fn) { families.push([re, fn]); }

const cache = new Map();
export function paint(name) {
  if (cache.has(name)) return cache.get(name);
  const rng = rngFor(name);
  let out = null;
  if (exact.has(name)) out = exact.get(name)(rng, name);
  else {
    for (const [re, fn] of families) {
      const m = name.match(re);
      if (m) { out = fn(m, rng, name); if (out) break; }
    }
  }
  cache.set(name, out);
  return out;
}
export function has(name) { return paint(name) !== null; }

export function missingTexture() {
  const t = new Tex();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.set(x, y, ((x >> 3) ^ (y >> 3)) & 1 ? [248, 0, 248] : [0, 0, 0]);
  return t;
}
