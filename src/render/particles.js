// Particle system: block debris, smoke, flames, bubbles, crits, hearts, explosions, rain and snow.
import * as THREE from 'three';
import { BLOCKS } from '../registry/blocks.js';
import { BIOMES } from '../world/biomes.js';
import { LIGHT_FUNCS } from './shaders.js';
import { specName } from './blockrender.js';

const MAX = 4000;
// sprite sheet cells (16px each, 16 per row)
const CELL = { smoke: 0, flame: 8, soul_flame: 9, bubble: 10, crit: 11, heart: 12, note: 13, portal: 14, glint: 15, happy: 16, angry: 17, drip_water: 18, drip_lava: 19, rain: 20, snow: 21, splash: 22, sweep: 24, explosion: 32, spark: 48, dust: 49, cloud: 50 };

function makeSheet() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  const cell = (i) => [(i % 16) * 16, Math.floor(i / 16) * 16];
  // smoke 8 frames: big to small grey puffs
  for (let f = 0; f < 8; f++) {
    const [x, y] = cell(f);
    const r = 7 - f * 0.8;
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
      const d = Math.hypot(i - 7.5, j - 7.5);
      if (d < r) { const v = 200 + ((i * 7 + j * 13) % 4) * 14; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x + i, y + j, 1, 1); }
    }
  }
  const px = (i, list) => { const [x, y] = cell(i); for (const [xx, yy, col] of list) { g.fillStyle = col; g.fillRect(x + xx, y + yy, 1, 1); } };
  const shape = (i, rows, pal) => { const [x, y] = cell(i); rows.forEach((r, j) => { for (let k = 0; k < r.length; k++) if (pal[r[k]]) { g.fillStyle = pal[r[k]]; g.fillRect(x + k + Math.floor((16 - r.length) / 2), y + j + Math.floor((16 - rows.length) / 2), 1, 1); } }); };
  shape(CELL.flame, ['..y..', '.yoy.', '.yoy.', 'yorry', 'yorry', '.yrr.', '..r..'], { y: '#ffd040', o: '#ff9020', r: '#ff5010' });
  shape(CELL.soul_flame, ['..c..', '.cbc.', '.cbc.', 'cbddc', 'cbddc', '.cdd.', '..d..'], { c: '#c0ffff', b: '#60e0f0', d: '#20a0c0' });
  shape(CELL.bubble, ['.ww.', 'w..w', 'w..w', '.ww.'], { w: '#c8e8ff' });
  shape(CELL.crit, ['..w..', '..w..', 'wwwww', '..w..', '..w..'], { w: '#ffffff' });
  shape(CELL.heart, ['.rr.rr.', 'rwrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'], { r: '#ff2020', w: '#ffb0b0' });
  shape(CELL.note, ['..www', '..w.w', '..w..', '.ww..', 'www..', '.w...'], { w: '#ffffff' });
  shape(CELL.portal, ['.p.', 'ppp', '.p.'], { p: '#c060ff' });
  shape(CELL.glint, ['.w.', 'www', '.w.'], { w: '#ffffff' });
  shape(CELL.happy, ['.g.', 'ggg', '.g.'], { g: '#40ff40' });
  shape(CELL.angry, ['k.k', '.k.', 'k.k'], { k: '#202020' });
  shape(CELL.drip_water, ['b', 'b'], { b: '#4080ff' });
  shape(CELL.drip_lava, ['o', 'o'], { o: '#ff8020' });
  { const [x, y] = cell(CELL.rain); g.fillStyle = 'rgba(160,180,255,0.75)'; g.fillRect(x + 7, y, 1, 16); }
  shape(CELL.snow, ['.w.', 'www', '.w.'], { w: '#ffffff' });
  shape(CELL.splash, ['b.b', '.b.'], { b: '#6090ff' });
  { const [x, y] = cell(CELL.sweep); for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI; g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(x + 8 + Math.cos(t) * 7, y + 12 - Math.sin(t) * 6, 1, 2); } }
  // explosion 16 frames
  for (let f = 0; f < 16; f++) {
    const [x, y] = cell(CELL.explosion + f);
    const r = 3 + f * 0.35;
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
      const d = Math.hypot(i - 7.5, j - 7.5);
      if (d < r && (d > r - 3 || f < 6)) { const v = 255 - f * 10 - ((i * 3 + j * 5) % 3) * 20; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x + i, y + j, 1, 1); }
    }
  }
  shape(CELL.spark, ['w'], { w: '#ffffff' });
  shape(CELL.dust, ['ww', 'ww'], { w: '#ffffff' });
  shape(CELL.cloud, ['.www.', 'wwwww', 'wwwww', '.www.'], { w: '#ffffff' });
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.NoColorSpace;
  return t;
}

const VERT = /* glsl */`
in vec4 aCol;
in vec3 aTex;
in vec2 aLight;
out vec2 vUv;
out vec4 vCol;
out vec2 vLight;
flat out float vLayer;
out float vDist;
void main() {
  vUv = uv; vCol = aCol; vLight = aLight; vLayer = aTex.x;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG_SHEET = /* glsl */`
precision highp float;
out vec4 outColor;
uniform sampler2D uMap;
uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
${LIGHT_FUNCS}
in vec2 vUv; in vec4 vCol; in vec2 vLight; flat in float vLayer; in float vDist;
void main() {
  vec4 t = texture(uMap, vUv);
  if (t.a < 0.1) discard;
  vec3 c = t.rgb * vCol.rgb * lightColor(vLight);
  float f = clamp((vDist - uFogNear) / max(uFogFar - uFogNear, 0.001), 0.0, 1.0);
  outColor = vec4(mix(c, uFogColor, f), t.a * vCol.a);
}`;
const FRAG_BLOCK = /* glsl */`
precision highp float;
precision highp sampler2DArray;
out vec4 outColor;
uniform sampler2DArray uAtlas;
uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
${LIGHT_FUNCS}
in vec2 vUv; in vec4 vCol; in vec2 vLight; flat in float vLayer; in float vDist;
void main() {
  vec4 t = texture(uAtlas, vec3(vUv, vLayer));
  if (t.a < 0.1) discard;
  vec3 c = t.rgb * vCol.rgb * lightColor(vLight);
  float f = clamp((vDist - uFogNear) / max(uFogFar - uFogNear, 0.001), 0.0, 1.0);
  outColor = vec4(mix(c, uFogColor, f), t.a * vCol.a);
}`;

class Batch {
  constructor(mat) {
    this.pos = new Float32Array(MAX * 4 * 3); this.uv = new Float32Array(MAX * 4 * 2); this.col = new Float32Array(MAX * 4 * 4);
    this.tex = new Float32Array(MAX * 4 * 3); this.light = new Float32Array(MAX * 4 * 2);
    const idx = new Uint32Array(MAX * 6);
    for (let i = 0; i < MAX; i++) { idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6); }
    this.geo = new THREE.BufferGeometry();
    this.attrs = {
      position: new THREE.BufferAttribute(this.pos, 3), uv: new THREE.BufferAttribute(this.uv, 2), aCol: new THREE.BufferAttribute(this.col, 4),
      aTex: new THREE.BufferAttribute(this.tex, 3), aLight: new THREE.BufferAttribute(this.light, 2),
    };
    for (const [k, a] of Object.entries(this.attrs)) { a.setUsage(THREE.DynamicDrawUsage); this.geo.setAttribute(k, a); }
    this.geo.setIndex(new THREE.BufferAttribute(idx, 1));
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.n = 0;
  }
  begin() { this.n = 0; }
  quad(cx, cy, cz, rx, ry, rz, ux, uy, uz, u0, v0, u1, v1, r, g, b, a, layer, sky, blk) {
    if (this.n >= MAX) return;
    const i = this.n++;
    const P = this.pos, o = i * 12;
    P[o] = cx - rx + ux; P[o + 1] = cy - ry + uy; P[o + 2] = cz - rz + uz;
    P[o + 3] = cx - rx - ux; P[o + 4] = cy - ry - uy; P[o + 5] = cz - rz - uz;
    P[o + 6] = cx + rx - ux; P[o + 7] = cy + ry - uy; P[o + 8] = cz + rz - uz;
    P[o + 9] = cx + rx + ux; P[o + 10] = cy + ry + uy; P[o + 11] = cz + rz + uz;
    const U = this.uv, q = i * 8;
    U[q] = u0; U[q + 1] = v0; U[q + 2] = u0; U[q + 3] = v1; U[q + 4] = u1; U[q + 5] = v1; U[q + 6] = u1; U[q + 7] = v0;
    for (let k = 0; k < 4; k++) {
      const c = (i * 4 + k) * 4; this.col[c] = r; this.col[c + 1] = g; this.col[c + 2] = b; this.col[c + 3] = a;
      const t = (i * 4 + k) * 3; this.tex[t] = layer;
      const l = (i * 4 + k) * 2; this.light[l] = sky; this.light[l + 1] = blk;
    }
  }
  end() {
    for (const a of Object.values(this.attrs)) { a.needsUpdate = true; a.updateRanges = []; }
    this.geo.setDrawRange(0, this.n * 6);
  }
}

export class Particles {
  constructor(renderer, game) {
    this.r = renderer; this.game = game;
    this.list = [];
    const u = renderer.uniforms;
    this.sheetTex = makeSheet();
    const common = { uFogColor: u.uFogColor, uFogNear: u.uFogNear, uFogFar: u.uFogFar, uDay: u.uDay, uSkyLightColor: u.uSkyLightColor, uGamma: u.uGamma, uNightVision: u.uNightVision, uFlash: u.uFlash };
    this.sheetMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: FRAG_SHEET, transparent: true, depthWrite: false, uniforms: { ...common, uMap: { value: this.sheetTex } } });
    this.blockMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: FRAG_BLOCK, uniforms: { ...common, uAtlas: u.uAtlas } });
    this.sheet = new Batch(this.sheetMat);
    this.block = new Batch(this.blockMat);
    renderer.scene.add(this.sheet.mesh); renderer.scene.add(this.block.mesh);
  }
  dispose() { this.r.scene.remove(this.sheet.mesh); this.r.scene.remove(this.block.mesh); this.list = []; }
  setting() { const s = this.game.options.get('particles'); return s === 'minimal' ? 0.2 : s === 'decreased' ? 0.5 : 1; }

  add(p) {
    if (this.list.length > MAX - 10) return;
    p.age = 0; p.prevX = p.x; p.prevY = p.y; p.prevZ = p.z;
    if (p.gravity === undefined) p.gravity = 0;
    if (p.friction === undefined) p.friction = 0.98;
    const w = this.game.world;
    if (w) { const l = w.getLight(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)); p.sky = (l >> 4) / 15; p.blk = (l & 15) / 15; } else { p.sky = 1; p.blk = 0; }
    if (p.emissive) { p.sky = 1; p.blk = 1; }
    this.list.push(p);
  }

  spawn(type, x, y, z, vx = 0, vy = 0, vz = 0) {
    if (Math.random() > this.setting()) return;
    const R = Math.random;
    switch (type) {
      case 'smoke': this.add({ x, y, z, vx: vx + (R() - 0.5) * 0.02, vy: vy + 0.02, vz: vz + (R() - 0.5) * 0.02, life: 20 + R() * 20, size: 0.1, cell: CELL.smoke, frames: 8, color: [0.3, 0.3, 0.3, 1], friction: 0.96 }); break;
      case 'large_smoke': this.add({ x, y, z, vx: vx + (R() - 0.5) * 0.04, vy: vy + 0.03, vz: vz + (R() - 0.5) * 0.04, life: 30 + R() * 30, size: 0.25, cell: CELL.smoke, frames: 8, color: [0.25, 0.25, 0.25, 1], friction: 0.96 }); break;
      case 'campfire_smoke': this.add({ x, y, z, vx: (R() - 0.5) * 0.01, vy: 0.06 + R() * 0.03, vz: (R() - 0.5) * 0.01, life: 120 + R() * 80, size: 0.35, cell: CELL.smoke, frames: 8, color: [0.85, 0.85, 0.85, 0.8], friction: 1 }); break;
      case 'flame': this.add({ x, y, z, vx, vy, vz, life: 8 + R() * 10, size: 0.07, cell: CELL.flame, color: [1, 1, 1, 1], emissive: true, friction: 0.96, shrink: true }); break;
      case 'soul_flame': this.add({ x, y, z, vx, vy, vz, life: 8 + R() * 10, size: 0.07, cell: CELL.soul_flame, color: [1, 1, 1, 1], emissive: true, friction: 0.96, shrink: true }); break;
      case 'lava': this.add({ x, y, z, vx: (R() - 0.5) * 0.1, vy: 0.2 + R() * 0.2, vz: (R() - 0.5) * 0.1, life: 30 + R() * 20, size: 0.08, cell: CELL.spark, color: [1, 0.6, 0.2, 1], gravity: 0.03, emissive: true, collide: true }); break;
      case 'bubble': this.add({ x, y, z, vx: vx + (R() - 0.5) * 0.02, vy: vy + 0.05, vz: vz + (R() - 0.5) * 0.02, life: 8 + R() * 30, size: 0.06, cell: CELL.bubble, color: [1, 1, 1, 1], inWaterOnly: true, friction: 0.85 }); break;
      case 'crit': this.add({ x, y, z, vx, vy, vz, life: 10 + R() * 8, size: 0.08, cell: CELL.crit, color: [0.9, 0.9, 0.7, 1], gravity: 0.03, friction: 0.7, shrink: true }); break;
      case 'heart': this.add({ x, y, z, vx: 0, vy: 0.04, vz: 0, life: 16, size: 0.12, cell: CELL.heart, color: [1, 1, 1, 1], emissive: true }); break;
      case 'angry_villager': this.add({ x, y, z, vx: 0, vy: 0.04, vz: 0, life: 16, size: 0.12, cell: CELL.angry, color: [1, 1, 1, 1] }); break;
      case 'happy_villager': this.add({ x, y, z, vx: (R() - 0.5) * 0.02, vy: 0.02, vz: (R() - 0.5) * 0.02, life: 20, size: 0.06, cell: CELL.happy, color: [1, 1, 1, 1], emissive: true }); break;
      case 'note': { const h = vx; const c = new THREE.Color().setHSL(h, 1, 0.5); this.add({ x, y, z, vx: 0, vy: 0.04, vz: 0, life: 12, size: 0.12, cell: CELL.note, color: [c.r, c.g, c.b, 1], emissive: true }); break; }
      case 'portal': this.add({ x, y, z, vx: vx * 0.05, vy: vy * 0.05, vz: vz * 0.05, life: 30 + R() * 20, size: 0.05, cell: CELL.portal, color: [0.8 + R() * 0.2, 0.3, 1, 1], emissive: true }); break;
      case 'redstone': this.add({ x, y, z, vx: 0, vy: 0.01, vz: 0, life: 15, size: 0.05, cell: CELL.dust, color: [1, 0.1, 0.1, 1], emissive: true }); break;
      case 'drip_water': this.add({ x, y, z, vx: 0, vy: 0, vz: 0, life: 60, size: 0.04, cell: CELL.drip_water, color: [1, 1, 1, 1], gravity: 0.02, collide: true }); break;
      case 'drip_lava': this.add({ x, y, z, vx: 0, vy: 0, vz: 0, life: 60, size: 0.04, cell: CELL.drip_lava, color: [1, 1, 1, 1], gravity: 0.02, collide: true, emissive: true }); break;
      case 'splash': this.add({ x, y, z, vx: (R() - 0.5) * 0.2, vy: 0.1 + R() * 0.1, vz: (R() - 0.5) * 0.2, life: 10 + R() * 10, size: 0.05, cell: CELL.splash, color: [1, 1, 1, 1], gravity: 0.04, collide: true }); break;
      case 'snowball': case 'egg': this.add({ x, y, z, vx, vy, vz, life: 10 + R() * 10, size: 0.05, cell: CELL.dust, color: type === 'egg' ? [0.95, 0.9, 0.8, 1] : [1, 1, 1, 1], gravity: 0.03, collide: true }); break;
      case 'sweep': this.add({ x, y, z, vx: 0, vy: 0, vz: 0, life: 4, size: 0.9, cell: CELL.sweep, color: [1, 1, 1, 1], emissive: true }); break;
      case 'explosion': this.add({ x, y, z, vx: 0, vy: 0, vz: 0, life: 6 + R() * 4, size: 0.6 + R() * 0.4, cell: CELL.explosion, frames: 16, color: [1, 1, 1, 1], emissive: true }); break;
      case 'poof': this.add({ x, y, z, vx, vy, vz, life: 10 + R() * 15, size: 0.15, cell: CELL.smoke, frames: 8, color: [1, 1, 1, 1], friction: 0.9 }); break;
      case 'effect': this.add({ x, y, z, vx: 0, vy: 0.02, vz: 0, life: 15, size: 0.06, cell: CELL.glint, color: [vx, vy, vz, 1] }); break;
      case 'rain': this.add({ x, y, z, vx: 0, vy: -0.9, vz: 0, life: 40, size: 0.03, stretch: 14, cell: CELL.rain, color: [1, 1, 1, 0.8], friction: 1, rain: true }); break;
      case 'snow': this.add({ x, y, z, vx: (R() - 0.5) * 0.02, vy: -0.06 - R() * 0.03, vz: (R() - 0.5) * 0.02, life: 200, size: 0.05, cell: CELL.snow, color: [1, 1, 1, 1], friction: 1, rain: true }); break;
      default: break;
    }
  }

  blockDebris(x, y, z, def, meta, vx, vy, vz, size = 0.06) {
    let tex;
    if (def.shape === 'cube') tex = specName(def.tex, 2) || specName(def.tex, 1);
    else if (typeof def.tex === 'string') tex = def.tex;
    else tex = specName(def.tex, 2) || specName(def.tex, 1);
    if (!tex) return;
    const e = this.r.atlas.get(tex);
    const u0 = Math.random() * 0.75, v0 = Math.random() * 0.75;
    let col = [1, 1, 1, 1];
    if (def.tint === 'grass' || def.tint === 'foliage') col = [0.55, 0.75, 0.35, 1];
    if (def.name === 'grass_block') { col = [1, 1, 1, 1]; }
    this.add({ x, y, z, vx, vy, vz, life: 4 / (Math.random() * 0.9 + 0.1), size, layer: e.layer, uv: [u0, v0, u0 + 0.25, v0 + 0.25], color: col, gravity: 0.04, collide: true, friction: 0.98 });
  }
  blockBreak(x, y, z, def, meta, n = 4) {
    if (!def || def.shape === 'none') return;
    const m = this.setting();
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
      if (Math.random() > m * 0.6) continue;
      const px = x + (i + 0.5) / n, py = y + (j + 0.5) / n, pz = z + (k + 0.5) / n;
      this.blockDebris(px, py, pz, def, meta, (px - x - 0.5) * 0.15 + (Math.random() - 0.5) * 0.05, (py - y - 0.5) * 0.15 + Math.random() * 0.1, (pz - z - 0.5) * 0.15 + (Math.random() - 0.5) * 0.05, 0.05 + Math.random() * 0.04);
    }
  }
  blockHit(x, y, z, face, def, meta) {
    const d = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]][face];
    const px = x + 0.5 + d[0] * 0.55 + (d[0] === 0 ? (Math.random() - 0.5) * 0.8 : 0);
    const py = y + 0.5 + d[1] * 0.55 + (d[1] === 0 ? (Math.random() - 0.5) * 0.8 : 0);
    const pz = z + 0.5 + d[2] * 0.55 + (d[2] === 0 ? (Math.random() - 0.5) * 0.8 : 0);
    this.blockDebris(px, py, pz, def, meta, d[0] * 0.04, d[1] * 0.04 + 0.04, d[2] * 0.04, 0.04);
  }
  eatParticles(p, item) {
    const [ex, ey, ez] = this.game.eyePos(1);
    const [dx, dy, dz] = this.game.lookDir();
    const icon = this.game.icons.spriteTex(item);
    for (let i = 0; i < 5; i++) {
      let col = [1, 1, 1, 1];
      if (icon) { for (let t = 0; t < 10; t++) { const x = Math.floor(Math.random() * 16), y = Math.floor(Math.random() * 16); const c = icon.get(x, y); if (c[3]) { col = [c[0] / 255, c[1] / 255, c[2] / 255, 1]; break; } } }
      this.add({ x: ex + dx * 0.5, y: ey + dy * 0.5 - 0.15, z: ez + dz * 0.5, vx: (Math.random() - 0.5) * 0.1, vy: Math.random() * 0.1, vz: (Math.random() - 0.5) * 0.1, life: 15, size: 0.04, cell: CELL.dust, color: col, gravity: 0.04, collide: true });
    }
  }
  explosion(x, y, z, power) {
    for (let i = 0; i < 16 * this.setting(); i++) this.spawn('explosion', x + (Math.random() - 0.5) * power * 1.5, y + (Math.random() - 0.5) * power * 1.5, z + (Math.random() - 0.5) * power * 1.5);
    for (let i = 0; i < 30 * this.setting(); i++) this.spawn('large_smoke', x + (Math.random() - 0.5) * power, y + (Math.random() - 0.5) * power, z + (Math.random() - 0.5) * power, (Math.random() - 0.5) * 0.3, Math.random() * 0.2, (Math.random() - 0.5) * 0.3);
  }

  tick() {
    const w = this.game.world;
    const out = [];
    for (const p of this.list) {
      p.age++;
      if (p.age >= p.life) continue;
      p.prevX = p.x; p.prevY = p.y; p.prevZ = p.z;
      p.vy -= p.gravity;
      let nx = p.x + p.vx, ny = p.y + p.vy, nz = p.z + p.vz;
      if (p.collide && w) {
        const id = w.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz));
        if (id && BLOCKS[id].solid) { if (p.vy < 0 && BLOCKS[w.getBlock(Math.floor(p.x), Math.floor(ny), Math.floor(p.z))].solid) { ny = Math.floor(ny) + 1.01; p.vy = 0; p.vx *= 0.7; p.vz *= 0.7; } else { nx = p.x; nz = p.z; p.vx = 0; p.vz = 0; } }
      }
      if (p.rain && w) {
        const id = w.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz));
        if (id && (BLOCKS[id].solid || BLOCKS[id].shape === 'liquid' || BLOCKS[id].kind === 'leaves')) {
          if (Math.random() < 0.3 && p.cell === CELL.rain) this.spawn('splash', nx, Math.floor(ny) + 1.02, nz);
          continue;
        }
      }
      if (p.inWaterOnly && w && BLOCKS[w.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz))].fluid !== 'water') continue;
      p.x = nx; p.y = ny; p.z = nz;
      p.vx *= p.friction; p.vy *= p.friction; p.vz *= p.friction;
      out.push(p);
    }
    this.list = out;
    // weather around the player
    const g = this.game;
    if (g.player && g.rainLevel > 0.05 && w) {
      const p = g.player;
      const n = Math.floor(30 * g.rainLevel * this.setting());
      for (let i = 0; i < n; i++) {
        const x = p.x + (Math.random() - 0.5) * 24, z = p.z + (Math.random() - 0.5) * 24;
        const top = w.rainHeight(Math.floor(x), Math.floor(z));
        if (top > p.y + 12) continue;
        const y = Math.max(top + 1, p.y + 10 + Math.random() * 6);
        const b = BIOMES[w.biomeAt(Math.floor(x), Math.floor(z))];
        if (b && !b.rain) continue;
        const cold = b && (b.snow || (b.temp < 0.15)) || (y > 160);
        this.spawn(cold ? 'snow' : 'rain', x, y, z);
      }
    }
    // ambient: torches & fire & lava particles near the player
    if (g.player && w && g.ticks % 2 === 0) {
      const p = g.player;
      for (let i = 0; i < 40; i++) {
        const x = Math.floor(p.x + (Math.random() - 0.5) * 32), y = Math.floor(p.y + (Math.random() - 0.5) * 16), z = Math.floor(p.z + (Math.random() - 0.5) * 32);
        const id = w.getBlock(x, y, z);
        if (!id) continue;
        const d = BLOCKS[id];
        if (d.kind === 'torch' || d.kind === 'redstone_torch') {
          const meta = w.getMeta(x, y, z) & 7;
          let px = x + 0.5, py = y + 0.7, pz = z + 0.5;
          if (meta > 0) { const dirs = [[0, 1], [-1, 0], [0, -1], [1, 0]][meta - 1]; px -= dirs[0] * 0.27; pz -= dirs[1] * 0.27; py += 0.22; }
          if (d.kind === 'redstone_torch') { if (!(w.getMeta(x, y, z) & 8)) this.spawn('redstone', px, py, pz); }
          else { this.spawn('smoke', px, py, pz); this.spawn(d.particle === 'soul_flame' ? 'soul_flame' : 'flame', px, py, pz); }
        } else if (d.kind === 'fire' && Math.random() < 0.3) this.spawn('large_smoke', x + Math.random(), y + Math.random(), z + Math.random());
        else if (d.kind === 'campfire' && Math.random() < 0.4) this.spawn('campfire_smoke', x + 0.5 + (Math.random() - 0.5) * 0.4, y + 0.6, z + 0.5 + (Math.random() - 0.5) * 0.4);
        else if (d.fluid === 'lava' && Math.random() < 0.05 && w.getBlock(x, y + 1, z) === 0) this.spawn('lava', x + Math.random(), y + 1, z + Math.random());
        else if (d.kind === 'leaves' && Math.random() < 0.02 && w.getBlock(x, y - 1, z) === 0 && g.rainLevel > 0.2) this.spawn('drip_water', x + Math.random(), y - 0.05, z + Math.random());
        else if (d.fluid === 'water' && Math.random() < 0.01 && !BLOCKS[w.getBlock(x, y - 1, z)].solid && w.getBlock(x, y - 1, z) === 0) this.spawn('drip_water', x + Math.random(), y - 0.05, z + Math.random());
        else if (d.name === 'furnace' && (w.getMeta(x, y, z) & 4) && Math.random() < 0.3) this.spawn('flame', x + 0.5, y + 0.3, z + 0.5);
      }
      if (p.eyeInWater && Math.random() < 0.3) this.spawn('bubble', p.x + (Math.random() - 0.5), p.y + p.eyeHeight + (Math.random() - 0.5), p.z + (Math.random() - 0.5));
    }
    // mob effect swirls
    if (g.entities) for (const e of g.entities) {
      if (e.effects && e.effects.size && Math.random() < 0.15 && e !== g.player) {
        const eff = [...e.effects.keys()][0];
        this.spawn('effect', e.x + (Math.random() - 0.5) * e.width, e.y + Math.random() * e.height, e.z + (Math.random() - 0.5) * e.width, 0.6, 0.4, 0.9);
        void eff;
      }
      if (e.fireTicks > 0 && Math.random() < 0.5) this.spawn('flame', e.x + (Math.random() - 0.5) * e.width, e.y + Math.random() * e.height, e.z + (Math.random() - 0.5) * e.width, 0, 0.02, 0);
    }
  }

  update(partial, camera) {
    const right = new THREE.Vector3(), up = new THREE.Vector3();
    camera.matrixWorld.extractBasis(right, up, new THREE.Vector3());
    this.sheet.begin(); this.block.begin();
    for (const p of this.list) {
      const x = p.prevX + (p.x - p.prevX) * partial, y = p.prevY + (p.y - p.prevY) * partial, z = p.prevZ + (p.z - p.prevZ) * partial;
      let s = p.size;
      if (p.shrink) s *= 1 - (p.age / p.life) * 0.5;
      const rx = right.x * s, ry = right.y * s, rz = right.z * s;
      let ux = up.x * s, uy = up.y * s, uz = up.z * s;
      if (p.stretch) { ux = 0; uy = s * p.stretch; uz = 0; }
      if (p.layer !== undefined) {
        const [u0, v0, u1, v1] = p.uv;
        this.block.quad(x, y, z, rx, ry, rz, ux, uy, uz, u0, v0, u1, v1, p.color[0], p.color[1], p.color[2], 1, p.layer, p.sky, p.blk);
      } else {
        let cell = p.cell;
        if (p.frames) cell += Math.min(p.frames - 1, Math.floor(p.age / p.life * p.frames));
        const cx = (cell % 16) / 16, cy = Math.floor(cell / 16) / 4;
        const alpha = p.color[3] * (p.cell === CELL.smoke ? 1 - p.age / p.life * 0.5 : 1);
        this.sheet.quad(x, y, z, rx, ry, rz, ux, uy, uz, cx, 1 - cy, cx + 1 / 16, 1 - cy - 1 / 4, p.color[0], p.color[1], p.color[2], alpha, 0, p.sky, p.blk);
      }
    }
    this.sheet.end(); this.block.end();
  }
}
