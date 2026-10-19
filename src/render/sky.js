// Sky dome, sun, moon, stars and clouds.
import * as THREE from 'three';
import { SKY_VERT, SKY_FRAG, SIMPLE_TEX_VERT, SIMPLE_TEX_FRAG } from './shaders.js';
import { Rng } from '../core/util.js';

export function celestialAngle(time) {
  const t = ((time % 24000) + 24000) % 24000;
  let f = t / 24000 - 0.25;
  if (f < 0) f += 1;
  if (f > 1) f -= 1;
  const g = f;
  f = 1 - (Math.cos(f * Math.PI) + 1) / 2;
  return g + (f - g) / 3;
}

export function skyParams(time, biomeSky = 0x78a7ff, rain = 0, thunder = 0) {
  const a = celestialAngle(time);
  const cosA = Math.cos(a * Math.PI * 2);
  let day = Math.min(1, Math.max(0, cosA * 2 + 0.5));
  const sky = new THREE.Color(biomeSky);
  sky.multiplyScalar(day);
  const fog = new THREE.Color(0.7529, 0.847, 1.0).multiplyScalar(day * 0.94 + 0.06);
  if (rain > 0) {
    const g = (c) => { const l = (c.r * 0.3 + c.g * 0.59 + c.b * 0.11) * 0.6; c.lerp(new THREE.Color(l, l, l), rain * 0.75); };
    g(sky); g(fog);
  }
  if (thunder > 0) { sky.multiplyScalar(1 - thunder * 0.5); fog.multiplyScalar(1 - thunder * 0.5); }
  // sunrise / sunset colour
  let sunrise = null;
  if (cosA >= -0.4 && cosA <= 0.4) {
    const f = cosA / 0.4 * 0.5 + 0.5;
    let alpha = 1 - (1 - Math.sin(f * Math.PI)) * 0.99;
    alpha *= alpha;
    sunrise = [f * 0.3 + 0.7, f * f * 0.7 + 0.2, 0.2, alpha * (1 - rain)];
  }
  const ang = a * Math.PI * 2;
  const sunDir = new THREE.Vector3(-Math.sin(ang), Math.cos(ang), 0).normalize();
  let starB = 1 - (cosA * 2 + 0.25);
  starB = Math.min(1, Math.max(0, starB));
  starB = starB * starB * 0.5 * (1 - rain);
  // sky light multiplier (MC skyDarken): 1 at day, ~0.2 at night
  let skyLight = 1 - (cosA * 2 + 0.2);
  skyLight = Math.min(1, Math.max(0, skyLight));
  skyLight = 1 - skyLight;
  skyLight *= 1 - rain * 5 / 16;
  skyLight *= 1 - thunder * 5 / 16;
  const dayFactor = 0.2 + skyLight * 0.8;
  return { angle: a, day, sky, fog, sunrise, sunDir, starB, dayFactor, skyLightLevel: Math.round(skyLight * 11) };
}

function sunTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 32, 32);
  g.fillStyle = 'rgba(255,255,170,0.35)'; g.fillRect(4, 4, 24, 24);
  g.fillStyle = '#fffbd0'; g.fillRect(8, 8, 16, 16);
  g.fillStyle = '#ffffff'; g.fillRect(10, 10, 12, 12);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.NoColorSpace;
  return t;
}
function moonTexture() {
  // 4x2 phases, each 32x32
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  for (let p = 0; p < 8; p++) {
    const ox = (p % 4) * 32, oy = Math.floor(p / 4) * 32;
    g.fillStyle = '#e8e8f0'; g.fillRect(ox + 10, oy + 10, 12, 12);
    g.fillStyle = '#c8c8d8'; g.fillRect(ox + 13, oy + 12, 3, 3); g.fillRect(ox + 17, oy + 17, 3, 2); g.fillRect(ox + 11, oy + 18, 2, 2);
    // phase shadow: 0 full ... 4 new
    const k = p <= 4 ? p : 8 - p;
    const w = Math.round(k / 4 * 12);
    g.fillStyle = 'rgba(0,0,0,1)';
    if (p <= 4) g.clearRect(ox + 10, oy + 10, w, 12); else g.clearRect(ox + 22 - w, oy + 10, w, 12);
  }
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.NoColorSpace;
  return t;
}

export class Sky {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.renderOrder = -10;
    scene.add(this.group);
    this.domeMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, depthTest: false,
      uniforms: { uSkyColor: { value: new THREE.Color() }, uFogColor: { value: new THREE.Color() }, uSunrise: { value: new THREE.Vector4() }, uSunDir: { value: new THREE.Vector3() }, uVoid: { value: 1 } },
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 12), this.domeMat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    this.group.add(this.dome);
    const mkQuad = (tex) => new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: SIMPLE_TEX_VERT, fragmentShader: SIMPLE_TEX_FRAG, transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending, uniforms: { uMap: { value: tex }, uAlpha: { value: 1 }, uTint: { value: new THREE.Color(1, 1, 1) } },
    });
    this.sunMat = mkQuad(sunTexture());
    this.sun = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), this.sunMat);
    this.sun.renderOrder = -9; this.sun.frustumCulled = false;
    this.moonTex = moonTexture();
    this.moonMat = mkQuad(this.moonTex);
    const mg = new THREE.PlaneGeometry(2.4, 2.4);
    this.moonGeo = mg;
    this.moon = new THREE.Mesh(mg, this.moonMat);
    this.moon.renderOrder = -9; this.moon.frustumCulled = false;
    this.celestial = new THREE.Group();
    this.celestial.add(this.sun); this.celestial.add(this.moon);
    this.sun.position.set(0, 10, 0); this.sun.rotation.x = Math.PI / 2;
    this.moon.position.set(0, -10, 0); this.moon.rotation.x = -Math.PI / 2;
    this.group.add(this.celestial);
    // stars
    const rng = new Rng(10842);
    const pos = [];
    for (let i = 0; i < 1500; i++) {
      const x = rng.next() * 2 - 1, y = rng.next() * 2 - 1, z = rng.next() * 2 - 1;
      const l = Math.sqrt(x * x + y * y + z * z);
      if (l < 0.01 || l > 1) continue;
      pos.push(x / l * 9, y / l * 9, z / l * 9);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, transparent: true, depthWrite: false, depthTest: false });
    this.stars = new THREE.Points(sg, this.starMat);
    this.stars.renderOrder = -9; this.stars.frustumCulled = false;
    this.celestial.add(this.stars);
    this.moonPhase = -1;
  }

  update(camera, p, moonPhase, opts = {}) {
    this.group.position.copy(camera.position);
    this.domeMat.uniforms.uSkyColor.value.copy(p.sky);
    this.domeMat.uniforms.uFogColor.value.copy(p.fog);
    this.domeMat.uniforms.uSunDir.value.copy(p.sunDir);
    if (p.sunrise) this.domeMat.uniforms.uSunrise.value.set(p.sunrise[0], p.sunrise[1], p.sunrise[2], p.sunrise[3]);
    else this.domeMat.uniforms.uSunrise.value.set(0, 0, 0, 0);
    this.celestial.rotation.set(0, 0, p.angle * Math.PI * 2);
    this.sunMat.uniforms.uAlpha.value = opts.rain ? 1 - opts.rain : 1;
    this.moonMat.uniforms.uAlpha.value = opts.rain ? 1 - opts.rain : 1;
    this.starMat.opacity = p.starB * 2;
    this.stars.visible = p.starB > 0.01;
    this.celestial.visible = !opts.underwater;
    if (moonPhase !== this.moonPhase) {
      this.moonPhase = moonPhase;
      const u0 = (moonPhase % 4) / 4, v0 = 1 - (Math.floor(moonPhase / 4) + 1) / 2;
      const uv = this.moonGeo.attributes.uv;
      uv.setXY(0, u0, v0 + 0.5); uv.setXY(1, u0 + 0.25, v0 + 0.5); uv.setXY(2, u0, v0); uv.setXY(3, u0 + 0.25, v0);
      uv.needsUpdate = true;
    }
  }
}

// ---------------- clouds ----------------
export class Clouds {
  constructor(scene, seed = 1) {
    this.scene = scene;
    const rng = new Rng(seed ^ 0xc10d);
    const N = 256;
    this.N = N;
    this.mask = new Uint8Array(N * N);
    // blobby mask from summed random circles
    for (let i = 0; i < 520; i++) {
      const cx = rng.int(N), cz = rng.int(N), r = 1 + rng.int(4);
      for (let dz = -r; dz <= r; dz++) for (let dx = -r - 1; dx <= r + 1; dx++) {
        if (dx * dx * 0.6 + dz * dz > r * r) continue;
        this.mask[((cz + dz + N) % N) * N + ((cx + dx + N) % N)] = 1;
      }
    }
    this.cell = 12;
    this.height = 4;
    this.y = 192.33;
    this.mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, depthWrite: true, side: THREE.FrontSide });
    this.mesh = null;
    this.builtAt = null;
    this.fancy = true;
    this.visible = true;
  }
  build(ox, oz) {
    const R = 24; // cells in each direction
    const pos = [], col = [];
    const N = this.N, cs = this.cell, h = this.height;
    const at = (x, z) => this.mask[(((z % N) + N) % N) * N + (((x % N) + N) % N)];
    const face = (verts, c) => { for (const v of [0, 1, 2, 0, 2, 3]) { pos.push(...verts[v]); col.push(c, c, c); } };
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const gx = ox + dx, gz = oz + dz;
      if (!at(gx, gz)) continue;
      const x0 = dx * cs, z0 = dz * cs, x1 = x0 + cs, z1 = z0 + cs;
      if (!this.fancy) { face([[x0, 0, z0], [x0, 0, z1], [x1, 0, z1], [x1, 0, z0]], 1); continue; }
      face([[x0, h, z0], [x0, h, z1], [x1, h, z1], [x1, h, z0]], 1.0);
      face([[x0, 0, z1], [x0, 0, z0], [x1, 0, z0], [x1, 0, z1]], 0.7);
      if (!at(gx, gz - 1)) face([[x1, h, z0], [x1, 0, z0], [x0, 0, z0], [x0, h, z0]], 0.9);
      if (!at(gx, gz + 1)) face([[x0, h, z1], [x0, 0, z1], [x1, 0, z1], [x1, h, z1]], 0.9);
      if (!at(gx - 1, gz)) face([[x0, h, z0], [x0, 0, z0], [x0, 0, z1], [x0, h, z1]], 0.8);
      if (!at(gx + 1, gz)) face([[x1, h, z1], [x1, 0, z1], [x1, 0, z0], [x1, h, z0]], 0.8);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    if (this.mesh) { this.mesh.geometry.dispose(); this.scene.remove(this.mesh); }
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.scene.add(this.mesh);
    this.builtAt = [ox, oz];
  }
  update(camX, camZ, ticks, brightness, color) {
    if (!this.visible) { if (this.mesh) this.mesh.visible = false; return; }
    const drift = ticks * 0.03;
    const wx = camX + drift;
    const ox = Math.floor(wx / this.cell), oz = Math.floor(camZ / this.cell);
    if (!this.builtAt || this.builtAt[0] !== ox || this.builtAt[1] !== oz) this.build(ox, oz);
    this.mesh.visible = true;
    this.mesh.position.set(ox * this.cell - drift, this.y, oz * this.cell);
    this.mat.color.setRGB(brightness * color.r, brightness * color.g, brightness * color.b);
  }
}
