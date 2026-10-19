// Shared helpers and constants.

export const CHUNK_SIZE = 16;
export const MIN_Y = -64;
export const MAX_Y = 320; // exclusive
export const WORLD_HEIGHT = MAX_Y - MIN_Y;
export const SECTIONS = WORLD_HEIGHT >> 4;
export const SEA_LEVEL = 63;
export const TICKS_PER_SECOND = 20;

// Face order (same as Minecraft's Direction enum): down, up, north, south, west, east
export const DOWN = 0, UP = 1, NORTH = 2, SOUTH = 3, WEST = 4, EAST = 5;
export const FACE_DIRS = [
  [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0],
];
export const OPPOSITE = [1, 0, 3, 2, 5, 4];
export const FACE_NAMES = ['down', 'up', 'north', 'south', 'west', 'east'];

// Horizontal facing meta: 0 south, 1 west, 2 north, 3 east (Minecraft 2D data value)
export const HFACING_TO_FACE = [SOUTH, WEST, NORTH, EAST];
export const FACE_TO_HFACING = { [SOUTH]: 0, [WEST]: 1, [NORTH]: 2, [EAST]: 3 };
export const HFACING_DIRS = [[0, 1], [-1, 0], [0, -1], [1, 0]];
export const HFACING_NAMES = ['south', 'west', 'north', 'east'];

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function smoothstep(t) { return t * t * (3 - 2 * t); }
export function floorDiv(a, b) { return Math.floor(a / b); }
export function mod(a, b) { return ((a % b) + b) % b; }

export function chunkKey(cx, cz) { return ((cx & 0xffff) << 16) | (cz & 0xffff); }

// Integer hashing (deterministic, seedable)
export function hash32(a) {
  a = a | 0;
  a = Math.imul(a ^ (a >>> 16), 0x7feb352d);
  a = Math.imul(a ^ (a >>> 15), 0x846ca68b);
  return (a ^ (a >>> 16)) >>> 0;
}
export function hash3(x, y, z, seed = 0) {
  let h = hash32(seed ^ 0x9e3779b9);
  h = hash32(h ^ Math.imul(x | 0, 0x27d4eb2d));
  h = hash32(h ^ Math.imul(y | 0, 0x165667b1));
  h = hash32(h ^ Math.imul(z | 0, 0x1b873593));
  return h;
}
export function hashFloat(x, y, z, seed = 0) { return hash3(x, y, z, seed) / 4294967296; }

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Small fast seeded RNG (mulberry32)
export class Rng {
  constructor(seed) { this.s = (seed >>> 0) || 0x12345; }
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(n) { return Math.floor(this.next() * n); }
  range(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  gauss() { return (this.next() + this.next() + this.next() - 1.5) / 1.5; }
}

export function seedFromString(str) {
  if (str === undefined || str === null || String(str).trim() === '') {
    return (Math.random() * 4294967296) >>> 0;
  }
  const s = String(str).trim();
  if (/^-?\d+$/.test(s)) {
    const n = Number(s);
    if (Number.isSafeInteger(n)) return (n | 0) >>> 0;
  }
  // Java's String.hashCode, like Minecraft does for text seeds
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

export function hexToRgb(hex) {
  if (typeof hex === 'number') return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function titleCase(name) {
  return name.split('_').map((w) => {
    if (['of', 'the', 'a', 'on', 'and', 'with', 'o'].includes(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ').replace(/^./, (c) => c.toUpperCase());
}

export function formatTime(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}, ${d.getHours() % 12 || 12}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}
