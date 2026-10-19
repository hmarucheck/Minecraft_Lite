// Renders entities: mob/player box models, dropped items, XP orbs, falling blocks, TNT, projectiles.
import * as THREE from 'three';
import { modelFor, skinFor } from './models.js';
import { ENTITY_VERT, ENTITY_FRAG, BLOCK_VERT, BLOCK_FRAG } from './shaders.js';
import { ItemMeshes } from './itemmesh.js';
import { BLOCKS } from '../registry/blocks.js';
import { ITEM } from '../registry/items.js';
import { DYE_COLORS } from '../registry/items.js';

const PX = 1 / 16;

function boxGeometry(box, tw, th) {
  const [w, h, d] = box.s;
  const inf = box.inflate || 0;
  const g = new THREE.BoxGeometry(Math.max(0.01, w + inf * 2), Math.max(0.01, h + inf * 2), Math.max(0.01, d + inf * 2));
  g.translate(box.o[0] + w / 2, box.o[1] + h / 2, box.o[2] + d / 2);
  const [u, v] = box.uv;
  const W = Math.max(1, Math.round(w)), H = Math.max(1, Math.round(h)), D = Math.max(1, Math.round(d));
  const regions = [
    [u + D + W, v + D, D, H], // +x -> left
    [u, v + D, D, H], // -x -> right
    [u + D, v, W, D], // +y top
    [u + D + W, v, W, D], // -y bottom
    [u + D, v + D, W, H], // +z front
    [u + D + W + D, v + D, W, H], // -z back
  ];
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) {
    const [x, y, rw, rh] = regions[f];
    const u0 = x / tw, u1 = (x + rw) / tw, vt = 1 - y / th, vb = 1 - (y + rh) / th;
    uv.setXY(f * 4 + 0, u0, vt); uv.setXY(f * 4 + 1, u1, vt); uv.setXY(f * 4 + 2, u0, vb); uv.setXY(f * 4 + 3, u1, vb);
  }
  return g;
}

export class EntityRenderer {
  constructor(renderer, icons, game) {
    this.r = renderer; this.game = game;
    this.group = new THREE.Group();
    renderer.scene.add(this.group);
    this.objs = new Map();
    this.items = new ItemMeshes(renderer, icons);
    this.textures = new Map();
    this.geoCache = new Map();
    this.orbTex = this.makeOrbTexture();
    this.shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });
    this.shadowGeo = new THREE.CircleGeometry(0.5, 16).rotateX(-Math.PI / 2);
  }
  dispose() { this.r.scene.remove(this.group); this.objs.clear(); }

  makeOrbTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const g = c.getContext('2d');
    g.fillStyle = '#2a5a00'; g.fillRect(5, 4, 6, 8); g.fillRect(4, 5, 8, 6);
    g.fillStyle = '#c8ff40'; g.fillRect(6, 5, 4, 6); g.fillRect(5, 6, 6, 4);
    g.fillStyle = '#ffff90'; g.fillRect(6, 6, 2, 2);
    const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.NoColorSpace;
    return t;
  }

  texture(type, variant) {
    const k = type + ':' + variant;
    let t = this.textures.get(k);
    if (!t) {
      t = new THREE.CanvasTexture(skinFor(type, variant));
      t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.NoColorSpace; t.flipY = true;
      this.textures.set(k, t);
    }
    return t;
  }

  entityMaterial(tex, translucent) {
    const u = this.r.uniforms;
    return new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: ENTITY_VERT, fragmentShader: ENTITY_FRAG, transparent: !!translucent, side: translucent ? THREE.DoubleSide : THREE.FrontSide,
      uniforms: {
        uMap: { value: tex }, uLight: { value: new THREE.Vector2(1, 0) }, uOverlay: { value: new THREE.Vector4(0, 0, 0, 0) }, uAlpha: { value: 1 },
        uFogColor: u.uFogColor, uFogNear: u.uFogNear, uFogFar: u.uFogFar, uDay: u.uDay, uSkyLightColor: u.uSkyLightColor, uGamma: u.uGamma, uNightVision: u.uNightVision, uFlash: u.uFlash,
      },
    });
  }

  buildModel(type, variant, translucent) {
    const m = modelFor(type);
    const tex = this.texture(type, variant);
    const mat = this.entityMaterial(tex, translucent || m.translucent);
    const root = new THREE.Group();
    const inner = new THREE.Group();
    inner.scale.setScalar(PX * (m.scale || 1));
    root.add(inner);
    const parts = {};
    const build = (p, parent) => {
      const g = new THREE.Group();
      g.position.set(p.pivot[0], p.pivot[1], p.pivot[2]);
      g.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
      g.userData.baseRot = [...p.rot];
      for (const bx of p.boxes) {
        const key = `${type}|${bx.o}|${bx.s}|${bx.uv}|${bx.inflate}`;
        let geo = this.geoCache.get(key);
        if (!geo) { geo = boxGeometry({ ...bx, o: [bx.o[0] - (bx.inflate || 0) * 0, bx.o[1], bx.o[2]] }, m.tex[0], m.tex[1]); this.geoCache.set(key, geo); }
        const mesh = new THREE.Mesh(geo, mat);
        g.add(mesh);
      }
      parts[p.name] = g;
      parent.add(g);
      for (const c of p.children) build(c, g);
    };
    for (const p of m.parts()) build(p, inner);
    root.userData = { parts, mat, model: m, inner };
    return root;
  }

  update(entities, partial, hidePlayer) {
    const seen = new Set();
    const cam = this.r.camera.position;
    const maxD2 = (this.r.renderDistance * 16) ** 2;
    for (const e of entities) {
      if (e.removed || e === hidePlayer) continue;
      if (e.isPlayer && e.gameMode === 3) continue;
      const [x, y, z] = e.lerpPos(partial);
      if ((x - cam.x) ** 2 + (z - cam.z) ** 2 > maxD2) continue;
      seen.add(e.id);
      let o = this.objs.get(e.id);
      if (!o) { o = this.create(e); if (!o) continue; this.objs.set(e.id, o); this.group.add(o); }
      o.position.set(x, y, z);
      this.animate(e, o, partial);
    }
    for (const [id, o] of this.objs) if (!seen.has(id)) { this.group.remove(o); this.objs.delete(id); }
  }

  create(e) {
    const t = e.type;
    if (t === 'item') {
      const g = new THREE.Group();
      const obj = this.items.makeObject(e.stack.item);
      obj.scale.setScalar(obj.userData.isBlock ? 0.25 : 0.5);
      g.add(obj);
      if (e.stack.count > 1) { const o2 = this.items.makeObject(e.stack.item); o2.scale.copy(obj.scale); o2.position.set(0.06, 0.04, 0.06); g.add(o2); }
      g.userData.item = obj;
      return g;
    }
    if (t === 'xp_orb') {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.orbTex, transparent: true, depthWrite: false }));
      s.scale.setScalar(0.3 + Math.min(0.3, e.value / 200));
      const g = new THREE.Group(); g.add(s); g.userData.sprite = s;
      return g;
    }
    if (t === 'falling_block' || t === 'tnt') {
      const def = BLOCKS[t === 'tnt' ? BLOCKS.findIndex((b) => b.name === 'tnt') : e.blockId];
      const ge = this.items.blockGeometry(def.id, t === 'tnt' ? 0 : e.blockMeta, 0x7cbd6b);
      const g = new THREE.Group();
      for (const [geo, mat] of ge.parts) { const m = new THREE.Mesh(geo, t === 'tnt' ? new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: BLOCK_VERT, fragmentShader: BLOCK_FRAG, uniforms: { ...this.r.uniforms, uFlash: { value: 0 } } }) : mat); g.add(m); }
      if (t === 'tnt') g.userData.tntMats = g.children.map((m) => m.material);
      return g;
    }
    if (t === 'arrow' || t === 'spectral_arrow') {
      const g = new THREE.Group();
      const obj = this.items.makeObject(ITEM[t === 'spectral_arrow' ? 'spectral_arrow' : 'arrow']);
      obj.rotation.set(0, Math.PI / 2, Math.PI / 4 * 3);
      obj.scale.setScalar(0.7);
      const pivot = new THREE.Group(); pivot.add(obj);
      g.add(pivot); g.userData.pivot = pivot;
      return g;
    }
    if (t === 'snowball' || t === 'egg' || t === 'ender_pearl' || t === 'small_fireball' || t === 'splash_potion') {
      const obj = this.items.makeObject(ITEM[t === 'small_fireball' ? 'fire_charge' : t === 'splash_potion' ? 'potion_of_harming' : t]);
      obj.scale.setScalar(0.4);
      const g = new THREE.Group(); g.add(obj); g.userData.billboard = obj;
      return g;
    }
    if (t === 'player' || e.mobType) {
      const type = t === 'player' ? 'player' : e.mobType;
      const variant = e.variant || '';
      const root = this.buildModel(type, variant);
      // shadow
      if (this.game.options.get('entityShadows')) {
        const sh = new THREE.Mesh(this.shadowGeo, this.shadowMat);
        sh.scale.setScalar(Math.max(0.5, e.width) * 1.2);
        sh.position.y = 0.02;
        sh.renderOrder = 2;
        root.add(sh);
        root.userData.shadow = sh;
      }
      if (e.mobType === 'sheep') root.userData.woolTint = true;
      if (e.heldItem || (root.userData.model.bow)) {
        const it = e.heldItem || ITEM.bow;
        const obj = this.items.makeObject(it);
        obj.scale.setScalar(obj.userData.isBlock ? 0.375 * 16 : 0.6 * 16);
        obj.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
        obj.position.set(0, -10, 2);
        const arm = root.userData.parts.rightArm;
        if (arm) arm.add(obj);
      }
      return root;
    }
    return null;
  }

  animate(e, o, partial) {
    const t = e.type;
    const time = (this.game.ticks || 0) + partial;
    if (t === 'item') {
      const bob = Math.sin((e.age + partial) / 10 + e.bobOffset) * 0.1 + 0.1;
      const it = o.userData.item;
      it.position.y = bob + (it.userData.isBlock ? 0.0 : 0.1) + 0.05;
      o.rotation.y = ((e.age + partial) / 20 + e.bobOffset);
      this.lightObject(o, e);
      return;
    }
    if (t === 'xp_orb') {
      const s = o.userData.sprite;
      s.position.y = 0.2;
      const c = 0.5 + Math.sin(time * 0.5) * 0.5;
      s.material.color.setRGB(1, 1, 0.3 + c * 0.7);
      return;
    }
    if (t === 'tnt') {
      const flash = Math.floor(e.fuse / 5) % 2 === 0;
      const f = e.fuse < 10 ? 1 + (1 - e.fuse / 10) * 0.3 : 1;
      o.scale.setScalar(f);
      o.position.x -= 0.5 * (f - 1) * 0; // centered geometry
      for (const m of o.userData.tntMats) m.uniforms.uFlash.value = flash ? 0.6 : 0;
      return;
    }
    if (t === 'arrow' || t === 'spectral_arrow') {
      o.rotation.set(0, -e.yaw, 0);
      o.userData.pivot.rotation.set(e.pitch, 0, 0);
      return;
    }
    if (o.userData.billboard) { o.userData.billboard.quaternion.copy(this.r.camera.quaternion); return; }
    if (!o.userData.parts) return;
    // living entities
    const p = o.userData.parts;
    const m = o.userData.model;
    const bodyYaw = lerpAngle(e.prevBodyYaw, e.bodyYaw, partial);
    const headYaw = lerpAngle(e.prevHeadYaw, e.headYaw, partial);
    const pitch = e.pitch;
    o.rotation.set(0, -bodyYaw, 0);
    const swing = e.limbSwing + e.limbAmount * partial;
    const amt = Math.min(1, e.prevLimbAmount + (e.limbAmount - e.prevLimbAmount) * partial);
    const inner = o.userData.inner;
    inner.scale.setScalar(PX * (m.scale || 1) * (e.baby ? 0.5 : 1) * (e.sizeScale || 1));
    if (e.baby && p.head) p.head.scale.setScalar(1.5);
    if (p.head) { p.head.rotation.y = -wrap(headYaw - bodyYaw); p.head.rotation.x = pitch; }
    const c = Math.cos(swing * 0.6662), cp = Math.cos(swing * 0.6662 + Math.PI);
    if (p.rightArm && p.leftArm) {
      let ra = cp * 2 * amt * 0.5, la = c * 2 * amt * 0.5;
      if (m.armsForward || e.aggressive) { ra = -Math.PI / 2 + ra * 0.2; la = -Math.PI / 2 + la * 0.2; }
      if (m.bow && e.aiming) { ra = -Math.PI / 2; la = -Math.PI / 2; p.rightArm.rotation.y = -0.1; p.leftArm.rotation.y = 0.4; }
      const sp = e.swingProgress ? (e.prevSwingProgress + (e.swingProgress - e.prevSwingProgress) * partial) : 0;
      if (sp > 0) ra -= Math.sin(sp * Math.PI) * 1.2;
      if (e.isPlayer && e.sneaking) { ra += 0.4; la += 0.4; }
      p.rightArm.rotation.x = ra; p.leftArm.rotation.x = la;
      if (t === 'player' && e.useItem) p.rightArm.rotation.x = -0.6;
    }
    if (p.rightLeg && p.leftLeg) { p.rightLeg.rotation.x = c * 1.4 * amt; p.leftLeg.rotation.x = cp * 1.4 * amt; }
    if (p.leg0 && p.leg3) {
      p.leg0.rotation.x = c * 1.4 * amt; p.leg1.rotation.x = cp * 1.4 * amt;
      p.leg2.rotation.x = cp * 1.4 * amt; p.leg3.rotation.x = c * 1.4 * amt;
    }
    if (p.body && e.isPlayer) p.body.rotation.x = e.sneaking ? 0.5 : 0;
    if (e.mobType === 'spider' || e.mobType === 'cave_spider') {
      for (let i = 0; i < 8; i++) { const lg = p['leg' + i]; if (!lg) continue; const side = i % 2 === 0 ? -1 : 1; lg.rotation.z = side * 0.6 + Math.sin(swing * 1.3 + i) * 0.3 * amt; lg.rotation.y = (Math.floor(i / 2) - 1.5) * 0.4 * side + Math.cos(swing * 1.3 + i) * 0.3 * amt; }
    }
    if (e.mobType === 'chicken' && p.rightWing && p.leftWing) { const f = e.onGround ? 0 : Math.sin(time * 1.5) * 0.8 + 0.8; p.rightWing.rotation.z = f; p.leftWing.rotation.z = -f; }
    if ((e.mobType === 'bat' || e.mobType === 'phantom' || e.mobType === 'bee' || e.mobType === 'parrot') && p.rightWing && p.leftWing) { const f = Math.sin(time * (e.mobType === 'bee' ? 4 : 1.2)) * 0.9; p.rightWing.rotation.z = f; p.leftWing.rotation.z = -f; }
    if (e.mobType === 'squid' || e.mobType === 'glow_squid') { for (let i = 0; i < 8; i++) { const tn = p['t' + i]; if (tn) tn.rotation.x = Math.sin(time * 0.2 + i) * 0.3 + 0.2; } }
    if (e.mobType === 'blaze') { for (let i = 0; i < 12; i++) { const r = p['rod' + i]; if (r) { const a = time * 0.1 * (i < 4 ? 1 : i < 8 ? -1 : 1) + i * Math.PI / 2; const rad = i < 4 ? 9 : i < 8 ? 7 : 5; r.position.set(Math.cos(a) * rad, r.position.y, Math.sin(a) * rad); } } }
    if (e.mobType === 'slime' || e.mobType === 'magma_cube') {
      const sq = e.squish ? e.prevSquish + (e.squish - e.prevSquish) * partial : 0;
      inner.scale.set(PX * (e.sizeScale || 1) * (1 + sq * 0.5), PX * (e.sizeScale || 1) * (1 - sq * 0.5), PX * (e.sizeScale || 1) * (1 + sq * 0.5));
    }
    if (e.mobType === 'creeper' && e.swell) {
      const s = e.prevSwell + (e.swell - e.prevSwell) * partial;
      const f = 1 + Math.sin(s * 100) * s * 0.01 + s * 0.2;
      inner.scale.set(PX * f * 1.0, PX * (1 + s * 0.1), PX * f);
    }
    // death tilt
    if (e.dead) {
      let f = ((e.deathTime + partial - 1) / 20) * 1.6;
      f = Math.min(1, Math.sqrt(Math.max(0, f)));
      o.rotation.z = f * Math.PI / 2;
    } else o.rotation.z = 0;
    // sheep wool colour / sheared
    const mat = o.userData.mat;
    const [sky, blk] = e.lightLevel();
    mat.uniforms.uLight.value.set(sky / 15, blk / 15);
    const red = (e.hurtTime > 0 || e.dead) ? 0.5 : 0;
    const white = e.mobType === 'creeper' && e.swell && Math.floor(e.swell * 10) % 2 === 1 ? 0.5 : 0;
    mat.uniforms.uOverlay.value.set(red ? 1 : 1, red ? 0 : 1, red ? 0 : 1, red || white);
    mat.uniforms.uAlpha.value = e.hasEffect && e.hasEffect('invisibility') ? 0.15 : 1;
    if (o.userData.shadow) { o.userData.shadow.material.opacity = 0.3; o.userData.shadow.visible = !e.dead; }
    if (e.mobType === 'sheep' && e.woolColor !== o.userData.woolColorShown) {
      o.userData.woolColorShown = e.woolColor;
      const parts = o.userData.parts;
      const body = parts.body;
      if (body && body.children[1]) {
        const wm = mat.clone();
        const c = e.sheared ? null : DYE_COLORS[e.woolColor || 'white'];
        body.children[1].visible = !e.sheared;
        if (c !== null && c !== undefined) { wm.uniforms = { ...mat.uniforms, uOverlay: { value: new THREE.Vector4(((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255, e.woolColor && e.woolColor !== 'white' ? 0.55 : 0) } }; body.children[1].material = wm; }
      }
    }
  }

  lightObject(o, e) {
    const [sky, blk] = e.lightLevel();
    const b = Math.max(sky / 15 * this.r.uniforms.uDay.value, blk / 15) * 0.85 + 0.15;
    o.traverse((m) => { if (m.material && m.material.color && !m.material.uniforms) m.material.color.setRGB(b, b, b); });
  }
}

function wrap(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
function lerpAngle(a, b, t) { return a + wrap(b - a) * t; }
