// Cached 3D meshes for items: block items use the block model, other items are extruded pixel sprites.
import * as THREE from 'three';
import { BLOCK } from '../registry/blocks.js';
import { BLOCK_VERT, BLOCK_FRAG } from './shaders.js';

export class ItemMeshes {
  constructor(renderer, icons, uniforms = null) {
    this.r = renderer; this.icons = icons;
    this.cache = new Map();
    this.blockMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: BLOCK_VERT, fragmentShader: BLOCK_FRAG, uniforms: uniforms || renderer.uniforms, side: THREE.DoubleSide });
    this.blockTransMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: BLOCK_VERT, fragmentShader: BLOCK_FRAG, uniforms: uniforms ? { ...uniforms, uAlphaTest: { value: 0.01 } } : renderer.transUniforms, side: THREE.DoubleSide, transparent: true });
    this.spriteMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  }
  // returns {geo, mat, isBlock}
  get(item) {
    let e = this.cache.get(item.id);
    if (e) return e;
    if (item.icon === 'block3d' && item.block) e = this.blockGeometry(BLOCK[item.block].id, 0, BLOCK[item.block].tint === 'foliage' ? 0x48b518 : 0x7cbd6b);
    else e = this.spriteGeometry(item);
    this.cache.set(item.id, e);
    return e;
  }
  blockGeometry(id, meta, tint) {
    const res = this.r.mesher.buildSingle(id, meta, tint);
    const geos = [];
    for (const [data, mat] of [[res.opaque, this.blockMat], [res.translucent, this.blockTransMat]]) {
      if (!data) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(data.pos, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(data.uv, 2));
      g.setAttribute('aTex', new THREE.BufferAttribute(data.tex, 3));
      g.setAttribute('aColor', new THREE.BufferAttribute(data.col, 4, true));
      g.setAttribute('aLight', new THREE.BufferAttribute(data.light, 2, true));
      g.setIndex(new THREE.BufferAttribute(data.idx, 1));
      g.translate(-0.5, 0, -0.5);
      geos.push([g, mat]);
    }
    return { parts: geos, isBlock: true };
  }
  spriteGeometry(item) {
    const t = this.icons.spriteTex(item);
    const pos = [], col = [], idx = [];
    if (!t) return { parts: [], isBlock: false };
    const S = 1 / 16, d = 1 / 32;
    const quad = (a, b, c, d2, color, shade) => {
      const i = pos.length / 3;
      pos.push(...a, ...b, ...c, ...d2);
      for (let k = 0; k < 4; k++) col.push(color[0] / 255 * shade, color[1] / 255 * shade, color[2] / 255 * shade);
      idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
    };
    const A = (x, y) => t.alpha(x, y) > 0;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (!A(x, y)) continue;
      const c = t.get(x, y);
      const x0 = x * S - 0.5, x1 = x0 + S, y1 = (16 - y) * S, y0 = y1 - S;
      quad([x0, y0, d], [x1, y0, d], [x1, y1, d], [x0, y1, d], c, 1);
      quad([x1, y0, -d], [x0, y0, -d], [x0, y1, -d], [x1, y1, -d], c, 0.8);
      if (x === 0 || !A(x - 1, y)) quad([x0, y0, -d], [x0, y0, d], [x0, y1, d], [x0, y1, -d], c, 0.7);
      if (x === 15 || !A(x + 1, y)) quad([x1, y0, d], [x1, y0, -d], [x1, y1, -d], [x1, y1, d], c, 0.7);
      if (y === 0 || !A(x, y - 1)) quad([x0, y1, d], [x1, y1, d], [x1, y1, -d], [x0, y1, -d], c, 0.9);
      if (y === 15 || !A(x, y + 1)) quad([x0, y0, -d], [x1, y0, -d], [x1, y0, d], [x0, y0, d], c, 0.6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    return { parts: [[g, this.spriteMat]], isBlock: false };
  }
  // build a THREE.Group showing the item
  makeObject(item, brightness = 1) {
    const e = this.get(item);
    const grp = new THREE.Group();
    for (const [g, m] of e.parts) {
      let mat = m;
      if (!e.isBlock) { mat = m.clone(); mat.color = new THREE.Color(brightness, brightness, brightness); }
      grp.add(new THREE.Mesh(g, mat));
    }
    grp.userData.isBlock = e.isBlock;
    return grp;
  }
}
