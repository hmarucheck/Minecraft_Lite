// Item icons: 3D isometric block icons rendered with WebGL into a sheet, plus 2D sprites for items.
import * as THREE from 'three';
import { hasEnchantments } from '../game/enchantments.js';
import { ITEMS } from '../registry/items.js';
import { BLOCK } from '../registry/blocks.js';
import { paint } from '../textures/index.js';
import { BLOCK_VERT, BLOCK_FRAG } from './shaders.js';

const ICON = 64;
const SPR = 16;

export class Icons {
  constructor(renderer) {
    this.r = renderer;
    this.map = new Map(); // item id -> {canvas, sx, sy, size}
    this.spriteSheet = null;
    this.blockSheet = null;
  }

  build() {
    const blockItems = [], spriteItems = [];
    for (const it of ITEMS) {
      if (it.id === 0) continue;
      if (it.icon === 'block3d' && it.block) blockItems.push(it);
      else spriteItems.push(it);
    }
    this.buildBlockIcons(blockItems);
    this.buildSprites(spriteItems);
  }

  buildBlockIcons(items) {
    const cols = 32;
    const rows = Math.ceil(items.length / cols);
    const W = cols * ICON, H = rows * ICON;
    const gl = this.r.gl;
    const rt = new THREE.WebGLRenderTarget(W, H, { magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter });
    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-0.82, 0.82, 0.82, -0.82, 0.1, 10);
    const d = 3;
    cam.position.set(0.5 + Math.sin(Math.PI / 4) * Math.cos(Math.PI / 6) * d, 0.5 + Math.sin(Math.PI / 6) * d, 0.5 + Math.cos(Math.PI / 4) * Math.cos(Math.PI / 6) * d);
    cam.lookAt(0.5, 0.5, 0.5);
    const uniforms = {
      ...this.r.uniforms,
      uDay: { value: 1 }, uGamma: { value: 0 }, uNightVision: { value: 0 }, uFlash: { value: 0 }, uSkyLightColor: { value: new THREE.Color(1, 1, 1) },
      uFogNear: { value: 100 }, uFogFar: { value: 200 }, uAlphaTest: { value: 0.1 }, uOpacity: { value: 1 }, uTime: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: BLOCK_VERT, fragmentShader: BLOCK_FRAG, uniforms, side: THREE.DoubleSide });
    const tmat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: BLOCK_VERT, fragmentShader: BLOCK_FRAG, uniforms: { ...uniforms, uAlphaTest: { value: 0.01 } }, side: THREE.DoubleSide, transparent: true });
    const prevTarget = gl.getRenderTarget();
    gl.setRenderTarget(rt);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, true, true);
    rt.scissorTest = true;
    items.forEach((it, k) => {
      const b = BLOCK[it.block];
      const meta = defaultMeta(b);
      const res = this.r.mesher.buildSingle(b.id, meta, b.tint === 'foliage' ? 0x48b518 : b.tint === 'water' ? 0x3f76e4 : 0x7cbd6b);
      scene.clear();
      for (const [data, m] of [[res.opaque, mat], [res.translucent, tmat]]) {
        if (!data) continue;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(data.pos, 3));
        g.setAttribute('uv', new THREE.BufferAttribute(data.uv, 2));
        g.setAttribute('aTex', new THREE.BufferAttribute(data.tex, 3));
        g.setAttribute('aColor', new THREE.BufferAttribute(data.col, 4, true));
        g.setAttribute('aLight', new THREE.BufferAttribute(data.light, 2, true));
        g.setIndex(new THREE.BufferAttribute(data.idx, 1));
        scene.add(new THREE.Mesh(g, m));
      }
      // make thin / small models fill the icon a bit more (like MC item display transforms)
      const x = (k % cols) * ICON, y = (rows - 1 - Math.floor(k / cols)) * ICON;
      rt.viewport.set(x, y, ICON, ICON);
      rt.scissor.set(x, y, ICON, ICON);
      gl.setRenderTarget(rt);
      gl.render(scene, cam);
      for (const m of scene.children) m.geometry.dispose();
    });
    const buf = new Uint8Array(W * H * 4);
    gl.readRenderTargetPixels(rt, 0, 0, W, H, buf);
    gl.setRenderTarget(prevTarget);
    rt.dispose(); mat.dispose(); tmat.dispose();
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(W, H);
    // flip vertically
    for (let y = 0; y < H; y++) img.data.set(buf.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    ctx.putImageData(img, 0, 0);
    this.blockSheet = canvas;
    items.forEach((it, k) => this.map.set(it.id, { canvas, sx: (k % cols) * ICON, sy: Math.floor(k / cols) * ICON, size: ICON, smooth: true }));
  }

  buildSprites(items) {
    const cols = 32;
    const rows = Math.ceil(items.length / cols);
    const canvas = document.createElement('canvas');
    canvas.width = cols * SPR; canvas.height = rows * SPR;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(canvas.width, canvas.height);
    items.forEach((it, k) => {
      const t = spriteFor(it);
      if (!t) return;
      const ox = (k % cols) * SPR, oy = Math.floor(k / cols) * SPR;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const si = (y * t.w + x) * 4, di = ((oy + y) * canvas.width + ox + x) * 4;
        img.data[di] = t.d[si]; img.data[di + 1] = t.d[si + 1]; img.data[di + 2] = t.d[si + 2]; img.data[di + 3] = t.d[si + 3];
      }
      this.map.set(it.id, { canvas, sx: ox, sy: oy, size: SPR, smooth: false, tex: t });
    });
    ctx.putImageData(img, 0, 0);
    this.spriteSheet = canvas;
  }

  draw(ctx, item, x, y, size = 16, stack = null) {
    const e = this.map.get(item.id);
    if (!e) { ctx.fillStyle = '#f0f'; ctx.fillRect(x, y, size, size); return; }
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = e.smooth;
    ctx.drawImage(e.canvas, e.sx, e.sy, e.size, e.size, x, y, size, size);
    ctx.imageSmoothingEnabled = prev;
    if ((item.glint || hasEnchantments(stack)) && size >= 8) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const t = performance.now() / 1000;
      ctx.globalAlpha = 0.28 + Math.sin(t * 2) * 0.08;
      ctx.fillStyle = '#8040ff';
      ctx.beginPath();
      ctx.rect(x, y, size, size);
      ctx.clip();
      ctx.drawImage(e.canvas, e.sx, e.sy, e.size, e.size, x, y, size, size);
      ctx.restore();
    }
  }

  // pixel data of an item's 2D sprite (for extruded held-item meshes); null for 3D blocks
  spriteTex(item) {
    const e = this.map.get(item.id);
    return e && e.tex ? e.tex : null;
  }
}

function defaultMeta(b) {
  if (b.kind === 'bed') return 4 | 0; // head
  if (b.kind === 'stairs') return 0;
  if (b.kind === 'chest' || b.kind === 'front' || b.kind === 'furnace') return 0;
  if (b.kind === 'trapdoor') return 0;
  if (b.kind === 'snow_layer') return 0;
  if (b.kind === 'cake') return 0;
  if (b.kind === 'lantern') return 0;
  if (b.kind === 'fence_gate') return 0;
  if (b.kind === 'button') return 2;
  if (b.kind === 'lever') return 0;
  if (b.kind === 'anvil') return 1;
  return 0;
}

function spriteFor(it) {
  let t = null;
  const icon = it.icon;
  if (!icon) return null;
  if (icon.startsWith('item:')) t = paint(icon);
  else if (it.block && icon !== 'spawn_egg' && icon !== 'potion') t = paint(icon);
  else t = paint('item:' + icon);
  if (Array.isArray(t)) t = t[0];
  if (!t) t = paint('item:' + it.name) || paint(it.name);
  if (Array.isArray(t)) t = t[0];
  if (!t) return null;
  t = t.clone();
  if (it.iconTint) {
    const c = it.iconTint === 'grass' ? [0x7c, 0xbd, 0x6b] : it.iconTint === 'foliage' ? [0x48, 0xb5, 0x18] : Array.isArray(it.iconTint) ? it.iconTint : [255, 255, 255];
    t = t.tint(c);
  }
  if (it.kind === 'spawn_egg') {
    const [a, b] = it.eggColors;
    const ca = [(a >> 16) & 255, (a >> 8) & 255, a & 255], cb = [(b >> 16) & 255, (b >> 8) & 255, b & 255];
    t.map((x, y, c) => {
      if (!c[3]) return null;
      if (c[0] === 255 && c[1] === 255 && c[2] === 255) return [ca[0], ca[1], ca[2]];
      if (c[0] === 128 && c[1] === 128) return [cb[0], cb[1], cb[2]];
      if (c[0] === 0 && c[1] === 0 && c[2] === 0) return [ca[0] * 0.45, ca[1] * 0.45, ca[2] * 0.45];
      return null;
    });
  }
  if (it.kind === 'potion' && it.potionColor !== undefined) {
    const pc = it.potionColor;
    const col = [(pc >> 16) & 255, (pc >> 8) & 255, pc & 255];
    t.map((x, y, c) => {
      if (!c[3]) return null;
      if (c[0] === c[1] && c[1] === c[2] && (c[0] === 128 || c[0] === 192)) {
        const f = c[0] === 192 ? 1.3 : 1;
        return it.name === 'water_bottle' ? [56 * f, 93 * f, 198 * f] : [Math.min(255, col[0] * f), Math.min(255, col[1] * f), Math.min(255, col[2] * f)];
      }
      return null;
    });
  }
  return t;
}
