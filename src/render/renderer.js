// Main 3D renderer: scene, camera, world chunk meshes, sky, fog, block selection outline.
import * as THREE from 'three';
import { BlockAtlas } from './atlas.js';
import { buildRenderInfo } from './blockrender.js';
import { Mesher } from './mesher.js';
import { BLOCK_VERT, BLOCK_FRAG } from './shaders.js';
import { Sky, Clouds, skyParams } from './sky.js';
import { MIN_Y, SECTIONS } from '../core/util.js';
import { BLOCKS } from '../registry/blocks.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    this.gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.gl.autoClear = false;
    this.gl.setPixelRatio(1);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 1200);
    this.camera.rotation.order = 'YXZ';
    this.atlas = new BlockAtlas();
    this.infos = buildRenderInfo(this.atlas);
    // preload every block texture so the array texture is complete
    for (const d of BLOCKS) {
      if (d.model) for (let m = 0; m < 16; m++) { try { for (const e of d.model(m, { def: () => null, meta: () => 0 })) for (const f of e.faces) if (f) this.atlas.get(f.tex); } catch { /* ignore */ } }
    }
    for (const n of ['water_flow', 'lava_flow', 'redstone_lamp_on', 'grass_block_snow', 'redstone_dust_line0', 'redstone_dust_line1', 'soul_fire_0', ...Array.from({ length: 10 }, (_, i) => `destroy_stage_${i}`)]) this.atlas.get(n);
    this.atlasTex = this.atlas.buildTexture(THREE);
    this.mesher = new Mesher(this.atlas, this.infos);
    this.uniforms = {
      uAtlas: { value: this.atlasTex }, uTime: { value: 0 }, uDay: { value: 1 }, uSkyLightColor: { value: new THREE.Color(1, 1, 1) },
      uGamma: { value: 0.5 }, uNightVision: { value: 0 }, uFlash: { value: 0 },
      uFogColor: { value: new THREE.Color(0.75, 0.85, 1) }, uFogNear: { value: 100 }, uFogFar: { value: 128 }, uAlphaTest: { value: 0.1 }, uOpacity: { value: 1 },
    };
    this.opaqueMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: BLOCK_VERT, fragmentShader: BLOCK_FRAG, uniforms: this.uniforms });
    this.transUniforms = { ...this.uniforms, uAlphaTest: { value: 0.01 } };
    this.transMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: BLOCK_VERT, fragmentShader: BLOCK_FRAG, uniforms: this.transUniforms, transparent: true, side: THREE.DoubleSide, depthWrite: true });
    this.sky = new Sky(this.scene);
    this.clouds = new Clouds(this.scene);
    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);
    this.world = null;
    this.renderDistance = 8;
    this.fov = 70;
    this.fovMod = 1;
    this.meshCount = 0;
    this.sectionsRendered = 0;
    this.buildQueue = [];
    // selection outline
    this.outline = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 }));
    this.outline.visible = false;
    this.outline.renderOrder = 10;
    this.scene.add(this.outline);
    // break overlay
    this.crackMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: BLOCK_VERT, fragmentShader: BLOCK_FRAG, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      uniforms: { ...this.uniforms, uAlphaTest: { value: 0.05 }, uOpacity: { value: 0.75 } },
    });
    this.crack = null;
    this.underwater = false;
    this.inLava = false;
    this.overlayScenes = [];
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.gl.setPixelRatio(dpr);
    this.gl.setSize(w, h, false);
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setWorld(world) {
    this.clearMeshes();
    this.world = world;
    if (world) this.clouds = this.clouds || new Clouds(this.scene);
  }

  clearMeshes() {
    if (this.world) for (const c of this.world.chunks.values()) this.disposeChunk(c);
    this.worldGroup.clear();
  }
  disposeChunk(c) {
    for (let i = 0; i < c.meshes.length; i++) {
      const m = c.meshes[i];
      if (!m) continue;
      for (const k of ['opaque', 'translucent']) if (m[k]) { this.worldGroup.remove(m[k]); m[k].geometry.dispose(); this.meshCount--; }
      c.meshes[i] = null;
    }
    c.meshedOnce = false;
  }

  makeMesh(data, mat, cx, sy, cz) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(data.pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(data.uv, 2));
    g.setAttribute('aTex', new THREE.BufferAttribute(data.tex, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(data.col, 4, true));
    g.setAttribute('aLight', new THREE.BufferAttribute(data.light, 2, true));
    g.setIndex(new THREE.BufferAttribute(data.vcount > 65535 ? data.idx : new Uint16Array(data.idx), 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(8, 8, 8), 14);
    g.boundingBox = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(17, 17, 17));
    const m = new THREE.Mesh(g, mat);
    m.position.set(cx * 16, MIN_Y + sy * 16, cz * 16);
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    this.meshCount++;
    return m;
  }

  buildSection(chunk, sy) {
    const res = this.mesher.build(this.world, chunk, sy);
    let entry = chunk.meshes[sy];
    if (entry) {
      for (const k of ['opaque', 'translucent']) if (entry[k]) { this.worldGroup.remove(entry[k]); entry[k].geometry.dispose(); this.meshCount--; }
    }
    entry = { opaque: null, translucent: null };
    if (res.opaque) { entry.opaque = this.makeMesh(res.opaque, this.opaqueMat, chunk.cx, sy, chunk.cz); this.worldGroup.add(entry.opaque); }
    if (res.translucent) { entry.translucent = this.makeMesh(res.translucent, this.transMat, chunk.cx, sy, chunk.cz); entry.translucent.renderOrder = 1; this.worldGroup.add(entry.translucent); }
    chunk.meshes[sy] = entry;
  }

  meshChunk(chunk) {
    for (let sy = 0; sy < SECTIONS; sy++) {
      const s = chunk.sections[sy];
      if (s && s.count > 0) this.buildSection(chunk, sy);
    }
    chunk.meshedOnce = true;
    chunk.dirty.clear();
  }

  // rebuild dirty sections within a time budget (ms)
  processDirty(budgetMs = 6, camChunk) {
    const t0 = performance.now();
    if (!this.world) return;
    const list = [...this.world.dirtySections];
    if (camChunk) list.sort((a, b) => (Math.abs(a.cx - camChunk[0]) + Math.abs(a.cz - camChunk[1])) - (Math.abs(b.cx - camChunk[0]) + Math.abs(b.cz - camChunk[1])));
    for (const c of list) {
      if (!this.world.chunks.has(((c.cx & 0xffff) << 16) | (c.cz & 0xffff))) { this.world.dirtySections.delete(c); continue; }
      for (const sy of [...c.dirty]) {
        this.buildSection(c, sy);
        c.dirty.delete(sy);
        if (performance.now() - t0 > budgetMs) return;
      }
      this.world.dirtySections.delete(c);
    }
  }

  setOutline(x, y, z, boxes) {
    if (!boxes) { this.outline.visible = false; return; }
    const pts = [];
    const e = 0.002;
    for (const b of boxes) {
      const x0 = b[0] / 16 - e, y0 = b[1] / 16 - e, z0 = b[2] / 16 - e, x1 = b[3] / 16 + e, y1 = b[4] / 16 + e, z1 = b[5] / 16 + e;
      const c = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
      for (const [a, b2] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) pts.push(...c[a], ...c[b2]);
    }
    this.outline.geometry.dispose();
    this.outline.geometry = new THREE.BufferGeometry();
    this.outline.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.outline.position.set(x, y, z);
    this.outline.visible = true;
  }

  setCrack(x, y, z, stage) {
    if (stage < 0) { if (this.crack) this.crack.visible = false; return; }
    const e = this.atlas.get(`destroy_stage_${Math.min(9, stage)}`);
    if (!this.crack || this.crackStage !== stage) {
      const pos = [], uv = [], tex = [], col = [], light = [];
      const C = [
        [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]], [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]],
        [[1, 1, 0], [1, 0, 0], [0, 0, 0], [0, 1, 0]], [[0, 1, 1], [0, 0, 1], [1, 0, 1], [1, 1, 1]],
        [[0, 1, 0], [0, 0, 0], [0, 0, 1], [0, 1, 1]], [[1, 1, 1], [1, 0, 1], [1, 0, 0], [1, 1, 0]],
      ];
      const idx = [];
      for (let f = 0; f < 6; f++) {
        const b = pos.length / 3;
        const uvs = [[0, 0], [0, 1], [1, 1], [1, 0]];
        for (let k = 0; k < 4; k++) {
          const c = C[f][k];
          pos.push(c[0] * 1.004 - 0.002, c[1] * 1.004 - 0.002, c[2] * 1.004 - 0.002);
          uv.push(...uvs[k]); tex.push(e.layer, 1, 0); col.push(255, 255, 255, 255); light.push(255, 255);
        }
        idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('aTex', new THREE.Float32BufferAttribute(tex, 3));
      g.setAttribute('aColor', new THREE.BufferAttribute(new Uint8Array(col), 4, true));
      g.setAttribute('aLight', new THREE.BufferAttribute(new Uint8Array(light), 2, true));
      g.setIndex(idx);
      if (this.crack) { this.scene.remove(this.crack); this.crack.geometry.dispose(); }
      this.crack = new THREE.Mesh(g, this.crackMat);
      this.crack.renderOrder = 9;
      this.scene.add(this.crack);
      this.crackStage = stage;
    }
    this.crack.visible = true;
    this.crack.position.set(x, y, z);
  }

  // env: { time, rain, thunder, biomeSky, underwater, inLava, gamma, nightVision, blindness }
  updateEnvironment(env) {
    const p = skyParams(env.time, env.biomeSky, env.rain || 0, env.thunder || 0);
    this.skyP = p;
    const u = this.uniforms;
    u.uDay.value = p.dayFactor;
    const night = 1 - Math.min(1, Math.max(0, (p.dayFactor - 0.2) / 0.8));
    u.uSkyLightColor.value.setRGB(1 - night * 0.25, 1 - night * 0.2, 1);
    u.uGamma.value = env.gamma ?? 0.5;
    u.uNightVision.value = env.nightVision || 0;
    u.uFlash.value = env.flash || 0;
    const rd = this.renderDistance * 16;
    let fogColor = p.fog.clone();
    // blend fog towards sunrise colour when looking at the sun
    if (p.sunrise && !env.underwater) {
      const dir = new THREE.Vector3(); this.camera.getWorldDirection(dir);
      const s = new THREE.Vector3(p.sunDir.x > 0 ? 1 : -1, 0, 0);
      const d = Math.max(0, dir.x * s.x);
      fogColor.lerp(new THREE.Color(p.sunrise[0], p.sunrise[1], p.sunrise[2]), d * p.sunrise[3] * 0.6);
    }
    let near = rd - Math.min(64, Math.max(4, rd / 10)), far = rd;
    if (env.underwater) {
      fogColor = new THREE.Color(env.waterFog || 0x0a2a6a).multiplyScalar(0.3 + 0.7 * p.dayFactor);
      near = -8; far = 40 + (env.waterVision || 0) * 60;
    } else if (env.inLava) {
      fogColor = new THREE.Color(0.6, 0.1, 0.0); near = 0; far = 2;
    } else if (env.inPowderSnow) {
      fogColor = new THREE.Color(0.62, 0.73, 0.8); near = 0; far = 2;
    } else if (env.blindness) {
      fogColor = new THREE.Color(0, 0, 0); near = 0; far = 5;
    } else if (env.rain) {
      near *= 1 - env.rain * 0.2;
    }
    u.uFogColor.value.copy(fogColor);
    u.uFogNear.value = near; u.uFogFar.value = far;
    this.transUniforms.uFogColor = u.uFogColor;
    this.clearColor = fogColor;
    const moonPhase = Math.floor(env.time / 24000) % 8;
    this.sky.domeMat.uniforms.uVoid.value = this.camera.position.y < 56 ? 1 : 0;
    this.sky.update(this.camera, p, (moonPhase + 8) % 8, { rain: env.rain, underwater: env.underwater || env.inLava });
    this.sky.group.visible = !env.underwater && !env.inLava && !env.blindness;
    u.uTime.value = env.ticks || 0;
    const cb = Math.max(0.15, p.day) * (1 - (env.rain || 0) * 0.5);
    this.clouds.update(this.camera.position.x, this.camera.position.z, env.ticks || 0, 1, new THREE.Color(cb, cb, cb * 1.02));
  }

  render(extraScenes = []) {
    this.gl.setClearColor(this.clearColor || new THREE.Color(0.5, 0.7, 1), 1);
    this.gl.clear(true, true, true);
    this.camera.far = Math.max(400, this.renderDistance * 16 * 1.8 + 200);
    this.camera.updateProjectionMatrix();
    this.gl.render(this.scene, this.camera);
    for (const [scene, camera, clearDepth] of extraScenes) {
      if (clearDepth) this.gl.clearDepth();
      this.gl.render(scene, camera);
    }
  }
}
