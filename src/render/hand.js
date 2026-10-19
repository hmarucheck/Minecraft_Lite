// First-person hand and held item, rendered in its own scene on top of the world.
import * as THREE from 'three';
import { ItemMeshes } from './itemmesh.js';
import { skinFor } from './models.js';
import { ENTITY_VERT, ENTITY_FRAG } from './shaders.js';

export class HandRenderer {
  constructor(renderer, icons) {
    this.r = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.01, 10);
    const u = renderer.uniforms;
    this.uniforms = { ...u, uDay: { value: 1 }, uFogNear: { value: 100 }, uFogFar: { value: 200 }, uSkyLightColor: u.uSkyLightColor };
    this.items = new ItemMeshes(renderer, icons, this.uniforms);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.current = null; this.currentKey = null;
    this.equip = 1; this.prevEquip = 1;
    // arm
    const tex = new THREE.CanvasTexture(skinFor('player'));
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.NoColorSpace;
    this.armMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: ENTITY_VERT, fragmentShader: ENTITY_FRAG,
      uniforms: { uMap: { value: tex }, uLight: { value: new THREE.Vector2(1, 0) }, uOverlay: { value: new THREE.Vector4() }, uAlpha: { value: 1 }, uFogColor: u.uFogColor, uFogNear: this.uniforms.uFogNear, uFogFar: this.uniforms.uFogFar, uDay: u.uDay, uSkyLightColor: u.uSkyLightColor, uGamma: u.uGamma, uNightVision: u.uNightVision, uFlash: u.uFlash },
    });
    const g = new THREE.BoxGeometry(4, 12, 4);
    const uv = g.attributes.uv;
    const regions = [[48, 20, 4, 12], [40, 20, 4, 12], [44, 16, 4, 4], [48, 16, 4, 4], [44, 20, 4, 12], [52, 20, 4, 12]];
    for (let f = 0; f < 6; f++) { const [x, y, w, h] = regions[f]; uv.setXY(f * 4, x / 64, 1 - y / 64); uv.setXY(f * 4 + 1, (x + w) / 64, 1 - y / 64); uv.setXY(f * 4 + 2, x / 64, 1 - (y + h) / 64); uv.setXY(f * 4 + 3, (x + w) / 64, 1 - (y + h) / 64); }
    g.translate(0, -6, 0);
    this.arm = new THREE.Mesh(g, this.armMat);
    this.arm.scale.setScalar(1 / 16);
  }

  update(game, p, partial, r) {
    this.camera.aspect = r.camera.aspect;
    this.camera.fov = 70;
    this.camera.updateProjectionMatrix();
    const stack = p.inventory.selected();
    const key = stack ? stack.item.id : -1;
    if (key !== this.currentKey) {
      this.currentKey = key;
      this.root.clear();
      this.current = null;
      if (stack) { this.current = this.items.makeObject(stack.item); this.root.add(this.current); }
      else this.root.add(this.arm);
      this.equip = 0;
    }
    this.prevEquip = this.equip;
    this.equip = Math.min(1, this.equip + 0.15);
    // light at the player
    const [sky, blk] = p.lightLevel();
    const day = r.uniforms.uDay.value;
    const bright = Math.max(curve(sky / 15) * day, curve(blk / 15));
    this.uniforms.uDay.value = day;
    this.armMat.uniforms.uLight.value.set(sky / 15, blk / 15);
    // block items carry full-bright vertex light; scale through uDay-free brightness
    this.uniforms.uDay.value = Math.max(0.05, bright);
    if (this.current && !this.current.userData.isBlock) this.current.traverse((m) => { if (m.material && m.material.color) m.material.color.setRGB(0.15 + bright * 0.85, 0.15 + bright * 0.85, 0.15 + bright * 0.85); });

    const swing = p.prevSwingProgress + (p.swingProgress - p.prevSwingProgress) * partial;
    const sq = Math.sqrt(swing);
    const equipY = (1 - (this.prevEquip + (this.equip - this.prevEquip) * partial)) * -0.6;
    // body bobbing
    const walk = (p.limbSwing + p.limbAmount * partial) * 0.6;
    const amt = (p.prevLimbAmount + (p.limbAmount - p.prevLimbAmount) * partial) * (p.onGround ? 1 : 0.3);
    const bobX = Math.sin(walk * Math.PI * 0.5) * amt * 0.03;
    const bobY = -Math.abs(Math.cos(walk * Math.PI * 0.5) * amt) * 0.04;
    const R = this.root;
    R.position.set(0, 0, 0); R.rotation.set(0, 0, 0); R.scale.setScalar(1);
    const o = this.current || this.arm;
    let useY = 0, useX = 0;
    if (p.useItem && (p.useItem.item.food || p.useItem.item.kind === 'potion' || p.useItem.item.kind === 'milk')) {
      const t = p.useTicks + partial;
      useY = Math.abs(Math.cos(t / 4 * Math.PI) * 0.1) * (t > p.useDuration * 0.2 ? 1 : 0);
      useX = -0.3;
    }
    if (!this.current) {
      // empty hand: arm
      o.position.set(0.64 + bobX - 0.4 * Math.sin(sq * Math.PI), -0.72 + equipY + bobY + 0.2 * Math.sin(sq * Math.PI * 2), -0.75 - 0.2 * Math.sin(swing * Math.PI));
      o.rotation.set(1.1 - Math.sin(sq * Math.PI) * 0.5, -0.2 + Math.sin(swing * swing * Math.PI) * 0.4, 0.4 + Math.sin(sq * Math.PI) * 0.4, 'XYZ');
      return;
    }
    const isBlock = o.userData.isBlock;
    const sx = -0.4 * Math.sin(sq * Math.PI), sy = 0.2 * Math.sin(sq * Math.PI * 2), sz = -0.2 * Math.sin(swing * Math.PI);
    if (isBlock) {
      o.position.set(0.56 + sx + bobX + useX, -0.66 + sy + equipY + bobY + useY, -0.9 + sz);
      o.rotation.set(0.1 - Math.sin(sq * Math.PI) * 1.2, 0.78 + Math.sin(swing * swing * Math.PI) * -0.35, Math.sin(sq * Math.PI) * -0.3, 'YXZ');
      o.scale.setScalar(0.4);
    } else {
      let pull = 0;
      if (p.useItem && p.useItem.item.kind === 'bow') pull = Math.min(1, (p.useTicks + partial) / 20) * 0.15;
      const H = HELD;
      o.position.set(H.px + sx + bobX + useX, H.py + sy + equipY + bobY + useY, H.pz + sz + pull);
      o.rotation.set(H.rx - Math.sin(sq * Math.PI) * 1.3, H.ry + Math.sin(swing * swing * Math.PI) * -0.35, H.rz + Math.sin(sq * Math.PI) * -0.3, 'YXZ');
      o.scale.setScalar(H.s);
    }
  }
}
// held (non-block) item pose: handle at the lower right, blade pointing up and in towards the crosshair
const HELD = { px: 0.44, py: -0.5, pz: -0.75, rx: 0, ry: 2.3, rz: 0.1, s: 0.58 };
function curve(x) { return x / (4 - 3 * x); }
