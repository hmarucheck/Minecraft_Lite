// Game: owns the world, player, entities, renderers and GUI; runs the 20 TPS tick loop.
import * as THREE from 'three';
import { Renderer } from '../render/renderer.js';
import { Icons } from '../render/icons.js';
import { EntityRenderer } from '../render/entities.js';
import { HandRenderer } from '../render/hand.js';
import { Particles } from '../render/particles.js';
import { Gui } from '../gui/gui.js';
import { renderHud, HudState } from '../gui/hud.js';
import { World } from '../world/world.js';
import { Generator } from '../world/generator.js';
import { ChunkManager } from '../world/chunkmanager.js';
import { BIOMES } from '../world/biomes.js';
import { Player } from '../entity/player.js';
import { ItemEntity, XpOrb, PrimedTnt } from '../entity/entity.js';
import { Interaction } from './interaction.js';
import { BlockLogic } from './blocklogic.js';
import { Input } from './input.js';
import { ItemStack } from './itemstack.js';
import { PlayerMenu, CraftingMenu, FurnaceMenu, ChestMenu, SimpleContainer, FurnaceEntity, ChestEntity } from './inventory.js';
import { Storage } from './storage.js';
import { Options } from './options.js';
import { Sound } from '../audio/sound.js';
import { MobSpawner, createMob } from '../entity/mobs.js';
import { Commands } from './commands.js';
import { Redstone } from './redstone.js';
import { BLOCKS, BLOCK } from '../registry/blocks.js';
import { MIN_Y, MAX_Y, SEA_LEVEL, SECTIONS, FACE_DIRS, seedFromString, clamp } from '../core/util.js';
import { raycastBlocks, AABB } from '../entity/physics.js';
import { skyParams } from '../render/sky.js';
import { TitleScreen } from '../gui/screens/title.js';
import { PauseScreen } from '../gui/screens/pause.js';
import { DeathScreen } from '../gui/screens/death.js';
import { ChatScreen } from '../gui/screens/chat.js';
import { LevelLoadingScreen, MessageScreen } from '../gui/screens/misc.js';
import { InventoryScreen, CraftingScreen, FurnaceScreen, ChestScreen, CreativeScreen } from '../gui/screens/containers.js';
import { SelectWorldScreen } from '../gui/screens/worlds.js';
import { OptionsScreen, LanguageScreen, AccessibilityScreen } from '../gui/screens/options.js';
import { DEFAULT_RULES } from './rules.js';
import { TouchControls } from './touch.js';
import { AlertScreen } from '../gui/screens/misc.js';

export { DEFAULT_RULES };

const VERSION = 'Minecraft_Lite 1.0';

export class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.guiCanvas = document.getElementById('gui');
    this.options = new Options();
    this.renderer = new Renderer(this.canvas);
    this.gui = new Gui(this.guiCanvas, this);
    this.gui.guiScaleSetting = this.options.get('guiScale');
    this.gui.resize();
    this.sound = new Sound(this);
    this.input = new Input(this, this.guiCanvas);
    this.input.bindings = { ...this.input.bindings, ...this.options.get('keyBindings') };
    this.storage = new Storage();
    this.icons = new Icons(this.renderer);
    this.gui.icons = this.icons;
    this.inWorld = false;
    this.world = null;
    this.player = null;
    this.entities = [];
    this.hud = new HudState();
    this.paused = false;
    this.lastTime = performance.now();
    this.acc = 0;
    this.fps = 0; this.frames = 0; this.fpsTime = 0;
    this.ticks = 0;
    this.perspective = 0;
    this.showDebug = false;
    this.hideGui = false;
    this.chatLog = [];
    this.commandHistory = [];
    this.version = VERSION;
    this.titleWorld = null;
    this.titleAngle = 0;
    this.applyOptions();
    window.addEventListener('resize', () => { this.renderer.resize(); this.gui.resize(); });
  }

  async init() {
    this.icons.build();
    if (('ontouchstart' in window || navigator.maxTouchPoints > 0) && matchMedia('(pointer: coarse)').matches) this.setupTouch();
    await this.storage.open();
    this.setupTitleWorld();
    this.gui.setScreen(new TitleScreen());
    requestAnimationFrame((t) => this.frame(t));
  }

  applyOptions() {
    const o = this.options;
    this.renderer.renderDistance = o.get('renderDistance');
    this.renderer.mesher.smooth = o.get('smoothLighting');
    this.renderer.mesher.fancyLeaves = o.get('graphics') !== 'fast';
    this.renderer.clouds.visible = o.get('clouds') !== 'off';
    this.renderer.clouds.fancy = o.get('clouds') === 'fancy';
    this.sound && this.sound.applyVolumes();
  }

  // ------------------------------------------------------------------ menu helpers
  openWorldSelect() { this.gui.setScreen(new SelectWorldScreen(this.gui.screen)); }
  openScreen(name, parent = this.gui.screen) {
    const S = { options: OptionsScreen, language: LanguageScreen, accessibility: AccessibilityScreen }[name];
    if (S) this.gui.setScreen(new S(parent));
  }
  quitGame() {
    try { window.close(); } catch { /* ignore */ }
    this.gui.setScreen(new AlertScreen(this.gui.screen, 'Thanks for playing Minecraft_Lite!', 'Your worlds are saved in this browser. You can close this tab now.', 'Back to Title Screen'));
  }
  toast(title, text) { this.gui.toast(title, text); }
  setupTouch() { this.touchControls = new TouchControls(this); }

  // ------------------------------------------------------------------ title panorama
  setupTitleWorld() {
    const gen = new Generator(seedFromString('Minecraft_Lite'), {});
    const w = new World(gen);
    this.titleWorld = w;
    this.titleCM = new ChunkManager(w, this.renderer);
    this.renderer.setWorld(w);
    const sp = gen.findSpawn();
    this.titleCam = { x: sp.x, y: Math.max(sp.y + 14, 80), z: sp.z };
    this.renderer.renderDistance = Math.min(6, this.options.get('renderDistance'));
  }
  disposeTitleWorld() {
    if (!this.titleWorld) return;
    this.renderer.clearMeshes();
    this.titleWorld = null; this.titleCM = null;
  }

  // ------------------------------------------------------------------ world lifecycle
  async createWorld(settings) {
    const id = 'w' + Date.now().toString(36);
    const seed = seedFromString(settings.seed);
    const info = {
      id, name: settings.name || 'New World', seed, seedText: String(settings.seed || seed), gameMode: settings.gameMode === 'creative' ? 1 : settings.gameMode === 'spectator' ? 3 : settings.gameMode === 'adventure' ? 2 : 0,
      hardcore: settings.gameMode === 'hardcore', difficulty: settings.gameMode === 'hardcore' ? 3 : settings.difficulty ?? 2, allowCommands: settings.gameMode === 'hardcore' ? false : !!settings.allowCommands,
      worldType: settings.worldType || 'default', flatPreset: settings.flatPreset || 'classic_flat', singleBiome: settings.singleBiome || 'plains',
      generateStructures: settings.generateStructures !== false, bonusChest: !!settings.bonusChest,
      rules: { ...DEFAULT_RULES, ...(settings.rules || {}) }, time: 0, dayTime: 0, raining: false, rainTime: 12000 + Math.floor(Math.random() * 168000), thundering: false, thunderTime: 12000 + Math.floor(Math.random() * 168000),
      created: Date.now(), lastPlayed: Date.now(), version: VERSION, player: null, spawn: null, difficultyLocked: false,
    };
    await this.storage.saveWorldInfo(info);
    await this.storage.prepare(id, null);
    this.startWorld(info, true);
  }

  async loadWorld(id) {
    const info = await this.storage.loadWorldInfo(id);
    if (!info) return;
    info.rules = { ...DEFAULT_RULES, ...(info.rules || {}) };
    await this.storage.prepare(id, info.blockNames);
    this.startWorld(info, false);
  }

  startWorld(info, isNew) {
    this.disposeTitleWorld();
    this.info = info;
    this.rules = info.rules;
    this.difficulty = info.difficulty;
    const gen = new Generator(info.seed, { type: info.worldType, flatPreset: info.flatPreset, biome: info.singleBiome });
    this.generator = gen;
    const world = new World(gen);
    this.world = world;
    world.time = info.time || 0;
    this.dayTime = info.dayTime ?? 0;
    this.raining = !!info.raining; this.thundering = !!info.thundering;
    this.rainLevel = this.raining ? 1 : 0; this.thunderLevel = this.thundering ? 1 : 0;
    this.rainTime = info.rainTime || 12000; this.thunderTime = info.thunderTime || 12000;
    this.entities = [];
    this.renderer.setWorld(world);
    this.renderer.renderDistance = this.options.get('renderDistance');
    this.chunkManager = new ChunkManager(world, this.renderer, this.storage.chunkStore(world));
    this.chunkManager.onChunkLoaded = (c) => this.onChunkLoaded(c);
    this.chunkManager.onChunkUnload = (c) => this.onChunkUnload(c);
    this.blockLogic = new BlockLogic(this);
    this.interaction = new Interaction(this);
    this.redstone = new Redstone(this);
    this.commands = new Commands(this);
    this.spawner = new MobSpawner(this);
    this.entityRenderer = new EntityRenderer(this.renderer, this.icons, this);
    this.handRenderer = this.handRenderer || new HandRenderer(this.renderer, this.icons);
    this.particles = new Particles(this.renderer, this);
    this.tickingBE = new Set();
    world.listeners = [{
      onBlockChanged: (x, y, z, oldId, newId, oldMeta, newMeta) => this.onBlockChanged(x, y, z, oldId, newId, oldMeta, newMeta),
      onBlockEntityRemoved: (x, y, z, be) => this.tickingBE.delete(be),
    }];
    // spawn
    if (!info.spawn) {
      const s = gen.findSpawn();
      info.spawn = { x: Math.floor(s.x), y: s.y, z: Math.floor(s.z) };
    }
    this.worldSpawn = info.spawn;
    const p = new Player(this, info.spawn.x + 0.5, info.spawn.y, info.spawn.z + 0.5);
    this.player = p;
    p.setGameMode(info.gameMode);
    if (info.player) p.load(info.player);
    else {
      // spread like MC spawn radius
      p.yaw = Math.random() * Math.PI * 2;
    }
    this.entities.push(p);
    this.playerMenu = new PlayerMenu(p);
    this.hotbars = info.hotbars || Array.from({ length: 9 }, () => null);
    p.enderChest = p.enderChest || new Array(27).fill(null);
    this.inWorld = true;
    this.loading = { isNew, start: performance.now(), done: false };
    this.gui.setScreen(new LevelLoadingScreen());
    this.chatLog = [];
    this.ticks = 0;
    this.sound.stopMusic();
  }

  finishLoading() {
    const p = this.player;
    const info = this.info;
    if (!info.player) {
      // like Minecraft, spawn on an open surface block (not on trees or in water)
      const [x, y, z] = this.findSurfaceSpawn(Math.floor(p.x), Math.floor(p.z));
      p.teleport(x + 0.5, y + 1, z + 0.5);
      info.spawn = { x, y: y + 1, z };
      this.worldSpawn = info.spawn;
      if (info.bonusChest) this.placeBonusChest(x, y, z);
    }
    this.loading.done = true;
    this.gui.setScreen(null);
    this.input.requestLock();
    this.saveWorld();
  }

  findSurfaceSpawn(sx, sz) {
    const w = this.world;
    const top = (x, z) => {
      let y = MAX_Y - 1;
      while (y > MIN_Y && w.getBlock(x, y, z) === 0) y--;
      return y;
    };
    const good = new Set(['grass_block', 'sand', 'snow_block', 'podzol', 'mycelium', 'red_sand', 'dirt', 'coarse_dirt', 'gravel', 'stone']);
    let fallback = null;
    for (let r = 0; r <= 32; r++) {
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = sx + dx, z = sz + dz;
        if (!w.isLoaded(x, z)) continue;
        let y = top(x, z);
        let d = BLOCKS[w.getBlock(x, y, z)];
        // snow layers / plants on top of the ground are fine to stand in
        if (!d.solid && d.kind !== 'liquid') { y--; d = BLOCKS[w.getBlock(x, y, z)]; }
        if (good.has(d.name)) return [x, y, z];
        if (!fallback && d.solid && d.kind !== 'leaves') fallback = [x, y, z];
      }
    }
    if (fallback) return fallback;
    let y = MAX_Y - 1;
    while (y > MIN_Y && !BLOCKS[w.getBlock(sx, y, sz)].solid && w.getBlock(sx, y, sz) !== BLOCK.water.id) y--;
    return [sx, y, sz];
  }

  placeBonusChest(x, y, z) {
    const w = this.world;
    for (let r = 2; r < 6; r++) {
      const cx = x + r, cz = z;
      let cy = MAX_Y - 1; while (cy > MIN_Y && !BLOCKS[w.getBlock(cx, cy, cz)].solid) cy--;
      if (w.getBlock(cx, cy + 1, cz) === 0) {
        w.setBlock(cx, cy + 1, cz, BLOCK.chest.id, 0);
        const be = new ChestEntity(27);
        const items = [['stick', 12], ['oak_planks', 12], ['oak_log', 3], ['wooden_axe', 1], ['wooden_pickaxe', 1], ['apple', 5], ['bread', 3], ['salmon', 2]];
        items.forEach(([n, c], i) => { be.container.slots[i * 3] = new ItemStack(n, c); });
        w.setBlockEntity(cx, cy + 1, cz, be);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (w.getBlock(cx + dx, cy + 1, cz + dz) === 0) w.setBlock(cx + dx, cy + 1, cz + dz, BLOCK.torch.id, 0);
        return;
      }
    }
  }

  async saveWorld() {
    if (!this.inWorld || !this.info) return;
    const info = this.info;
    info.time = this.world.time;
    info.dayTime = this.dayTime;
    info.raining = this.raining; info.thundering = this.thundering; info.rainTime = this.rainTime; info.thunderTime = this.thunderTime;
    info.player = this.player.save();
    info.gameMode = this.player.gameMode;
    info.difficulty = this.difficulty;
    info.rules = this.rules;
    info.lastPlayed = Date.now();
    info.hotbars = this.hotbars;
    info.spawn = this.worldSpawn;
    try { info.icon = this.captureIcon(); } catch { /* ignore */ }
    this.savingIndicator = performance.now();
    await this.storage.saveWorldInfo(info);
    // entities are stored with the chunk they are standing in
    const byChunk = new Map();
    for (const e of this.entities) {
      if (e === this.player || e.removed) continue;
      const d = e.save && e.save();
      if (!d) continue;
      const k = `${Math.floor(e.x / 16)},${Math.floor(e.z / 16)}`;
      if (!byChunk.has(k)) byChunk.set(k, []);
      byChunk.get(k).push(d);
    }
    const jobs = [];
    for (const c of this.world.chunks.values()) {
      const list = byChunk.get(`${c.cx},${c.cz}`) || [];
      if (list.length || c.hadEntities) { c.entities = list; c.hadEntities = list.length > 0; c.modified = true; }
      if (c.modified) { jobs.push(this.storage.saveChunk(c)); c.modified = false; }
    }
    await Promise.all(jobs);
  }

  captureIcon() {
    const src = this.canvas;
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const g = c.getContext('2d');
    const s = Math.min(src.width, src.height);
    g.drawImage(src, (src.width - s) / 2, (src.height - s) / 2, s, s, 0, 0, 64, 64);
    return c.toDataURL('image/jpeg', 0.8);
  }

  async quitToTitle() {
    this.gui.setScreen(new MessageScreen('Saving world'));
    await this.saveWorld();
    this.leaveWorld();
    this.gui.setScreen(new TitleScreen());
  }
  leaveWorld() {
    this.inWorld = false;
    this.input.releaseLock();
    if (this.entityRenderer) this.entityRenderer.dispose();
    if (this.particles) this.particles.dispose();
    this.renderer.clearMeshes();
    this.renderer.setOutline(0, 0, 0, null);
    this.renderer.setCrack(0, 0, 0, -1);
    this.world = null; this.player = null; this.entities = [];
    this.sound.stopAll();
    this.setupTitleWorld();
  }

  // ------------------------------------------------------------------ chunk hooks
  onChunkLoaded(c) {
    for (const be of c.blockEntities.values()) if (be instanceof FurnaceEntity || be.type === 'spawner') this.tickingBE.add(be);
    if (c.savedEntities) { for (const e of c.savedEntities) this.loadEntity(e); c.savedEntities = null; c.hadEntities = true; }
    if (c.freshlyGenerated && this.rules && this.rules.doMobSpawning) this.spawner.populateChunk(c);
  }
  onChunkUnload(c) {
    for (const be of c.blockEntities.values()) this.tickingBE.delete(be);
    // persist entities living in the chunk
    const saved = [];
    for (const e of this.entities) {
      if (e === this.player || e.removed) continue;
      if (Math.floor(e.x / 16) === c.cx && Math.floor(e.z / 16) === c.cz) {
        const s = e.save && e.save();
        if (s) saved.push(s);
        e.remove();
      }
    }
    if (saved.length || c.hadEntities) { c.entities = saved; c.modified = true; }
  }
  loadEntity(d) {
    if (d.type === 'item') { const s = ItemStack.fromJSON(d.stack); if (s) { const e = new ItemEntity(this, d.x, d.y, d.z, s, 0); e.age = d.age || 0; this.spawn(e); } }
    else if (d.type === 'mob') { const m = createMob(this, d.mob, d.x, d.y, d.z, d); if (m) { m.load && m.load(d); this.spawn(m); } }
  }

  onBlockChanged(x, y, z, oldId, newId, oldMeta, newMeta) {
    const bl = this.blockLogic;
    for (const [dx, dy, dz] of FACE_DIRS) bl.neighborChanged(x + dx, y + dy, z + dz);
    const def = BLOCKS[newId];
    if (def.kind === 'liquid') this.world.scheduleTick(x, y, z, def.fluid === 'water' ? 5 : 30);
    if (def.gravity) this.world.scheduleTick(x, y, z, 2);
    if (def.kind === 'furnace') { const be = this.world.getBlockEntity(x, y, z); if (be) this.tickingBE.add(be); }
    this.redstone && this.redstone.blockChanged(x, y, z, oldId, newId);
    void oldMeta; void newMeta;
  }

  // ------------------------------------------------------------------ helpers used across modules
  spawn(e) { this.entities.push(e); return e; }
  spawnMob(type, x, y, z, opts = {}) {
    const m = createMob(this, type, x, y, z, opts);
    if (m) { this.spawn(m); m.onSpawned && m.onSpawned(opts); }
    return m;
  }
  dropItem(x, y, z, stack, opts = {}) {
    if (!stack || stack.isEmpty()) return null;
    const e = new ItemEntity(this, x, y - 0.125, z, stack.copy(), opts.pickupDelay ?? 10);
    if (opts.scatter) { e.vx = (Math.random() - 0.5) * 0.4; e.vy = Math.random() * 0.2 + 0.1; e.vz = (Math.random() - 0.5) * 0.4; }
    else { e.vx = (Math.random() - 0.5) * 0.2; e.vy = 0.2; e.vz = (Math.random() - 0.5) * 0.2; }
    this.spawn(e);
    return e;
  }
  dropFromPlayer(stack) {
    const p = this.player;
    if (!stack || stack.isEmpty()) return;
    const e = new ItemEntity(this, p.x, p.y + p.eyeHeight - 0.3, p.z, stack.copy(), 40);
    const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw), sp = Math.sin(p.pitch), cp = Math.cos(p.pitch);
    e.vx = -sin * cp * 0.3 + (Math.random() - 0.5) * 0.04;
    e.vz = cos * cp * 0.3 + (Math.random() - 0.5) * 0.04;
    e.vy = -sp * 0.3 + 0.1;
    this.spawn(e);
    p.swing();
  }
  spawnXp(x, y, z, amount) {
    while (amount > 0) {
      const v = amount >= 2477 ? 2477 : amount >= 1237 ? 1237 : amount >= 617 ? 617 : amount >= 307 ? 307 : amount >= 149 ? 149 : amount >= 73 ? 73 : amount >= 37 ? 37 : amount >= 17 ? 17 : amount >= 7 ? 7 : amount >= 3 ? 3 : 1;
      amount -= v;
      this.spawn(new XpOrb(this, x, y, z, v));
    }
  }
  raycast(ox, oy, oz, dx, dy, dz, dist, opts) { return raycastBlocks(this.world, ox, oy, oz, dx, dy, dz, dist, opts); }
  eyePos(partial = 1) {
    const p = this.player;
    const [x, y, z] = p.lerpPos(partial);
    const eh = p.prevEyeH + (p.eyeH - p.prevEyeH) * partial;
    return [x, y + eh, z];
  }
  lookDir() {
    const p = this.player;
    const cp = Math.cos(p.pitch);
    return [-Math.sin(p.yaw) * cp, -Math.sin(p.pitch), Math.cos(p.yaw) * cp];
  }

  explode(x, y, z, power, fire = false, source = null) {
    const w = this.world;
    this.sound.at('entity.generic.explode', x, y, z, 4, 0.7 + Math.random() * 0.2);
    this.particles && this.particles.explosion(x, y, z, power);
    const destroy = new Set();
    const griefing = !(source && source.mobType && !this.rules.mobGriefing);
    if (griefing) {
      for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) for (let k = 0; k < 16; k++) {
        if (i !== 0 && i !== 15 && j !== 0 && j !== 15 && k !== 0 && k !== 15) continue;
        let dx = i / 15 * 2 - 1, dy = j / 15 * 2 - 1, dz = k / 15 * 2 - 1;
        const l = Math.sqrt(dx * dx + dy * dy + dz * dz);
        dx /= l; dy /= l; dz /= l;
        let f = power * (0.7 + Math.random() * 0.6);
        let px = x, py = y, pz = z;
        for (; f > 0; f -= 0.22500001) {
          const bx = Math.floor(px), by = Math.floor(py), bz = Math.floor(pz);
          const id = w.getBlock(bx, by, bz);
          if (id) {
            const d = BLOCKS[id];
            const res = d.kind === 'liquid' ? 100 : d.resistance;
            f -= (res + 0.3) * 0.3;
            if (f > 0 && d.hardness >= 0 && by >= MIN_Y) destroy.add(`${bx},${by},${bz}`);
          }
          px += dx * 0.3; py += dy * 0.3; pz += dz * 0.3;
        }
      }
    }
    // damage entities
    const r = power * 2;
    for (const e of this.entities) {
      if (e.removed || e === source) continue;
      const dist = Math.sqrt((e.x - x) ** 2 + (e.y + e.height / 2 - y) ** 2 + (e.z - z) ** 2);
      if (dist > r) continue;
      const exposure = this.exposure(x, y, z, e);
      const impact = (1 - dist / r) * exposure;
      const dmg = Math.floor((impact * impact + impact) / 2 * 7 * r + 1);
      if (e.hurt) e.hurt({ type: 'explosion', attacker: source && source.shooter ? source.shooter : source }, dmg);
      if (e.type === 'tnt' && e !== source) { e.fuse = Math.min(e.fuse, 10 + Math.floor(Math.random() * 20)); }
      const ex = e.x - x, ey = e.y + e.height / 2 - y, ez = e.z - z;
      const el = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1;
      if (!(e.isPlayer && e.gameMode === 1)) { e.vx += ex / el * impact; e.vy += ey / el * impact; e.vz += ez / el * impact; }
    }
    const decay = source && source.type === 'tnt' ? this.rules.tntExplosionDropDecay : this.rules.blockExplosionDropDecay;
    for (const k of destroy) {
      const [bx, by, bz] = k.split(',').map(Number);
      const id = w.getBlock(bx, by, bz);
      if (!id) continue;
      const d = BLOCKS[id];
      if (d.kind === 'tnt') { w.setBlock(bx, by, bz, 0, 0); const t = new PrimedTnt(this, bx + 0.5, by, bz + 0.5, 10 + Math.floor(Math.random() * 20)); this.spawn(t); continue; }
      if (d.kind === 'liquid') continue;
      if (this.rules.doTileDrops && (!decay || Math.random() < 1 / power)) this.blockLogic.dropBlock(d, w.getMeta(bx, by, bz), bx, by, bz, null, null);
      this.blockLogic.removeBlock(bx, by, bz, d, w.getMeta(bx, by, bz));
      if (fire && Math.random() < 1 / 3 && w.getBlock(bx, by, bz) === 0 && BLOCKS[w.getBlock(bx, by - 1, bz)].solid) w.setBlock(bx, by, bz, BLOCK.fire.id, 0);
    }
  }
  exposure(x, y, z, e) {
    const b = e.box;
    let hit = 0, n = 0;
    for (let i = 0; i <= 2; i++) for (let j = 0; j <= 2; j++) for (let k = 0; k <= 2; k++) {
      const px = b.x0 + (b.x1 - b.x0) * i / 2, py = b.y0 + (b.y1 - b.y0) * j / 2, pz = b.z0 + (b.z1 - b.z0) * k / 2;
      const dx = px - x, dy = py - y, dz = pz - z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const h = raycastBlocks(this.world, x, y, z, dx / d, dy / d, dz / d, d);
      if (!h || h.dist >= d - 0.01 || !BLOCKS[h.id].solid) hit++;
      n++;
    }
    return hit / n;
  }

  // iron golem (T of iron blocks) and snow golem (two snow blocks) built under a carved pumpkin
  checkGolem(x, y, z) {
    const w = this.world;
    const id = (n) => BLOCK[n].id;
    if (w.getBlock(x, y - 1, z) === id('snow_block') && w.getBlock(x, y - 2, z) === id('snow_block')) {
      for (const dy of [0, 1, 2]) w.setBlock(x, y - dy, z, 0, 0);
      this.spawnMob('snow_golem', x + 0.5, y - 2, z + 0.5, { persistent: true });
      return;
    }
    if (w.getBlock(x, y - 1, z) !== id('iron_block') || w.getBlock(x, y - 2, z) !== id('iron_block')) return;
    for (const [ax, az] of [[1, 0], [0, 1]]) {
      if (w.getBlock(x + ax, y - 1, z + az) === id('iron_block') && w.getBlock(x - ax, y - 1, z - az) === id('iron_block')) {
        for (const [bx, by, bz] of [[0, 0, 0], [0, -1, 0], [0, -2, 0], [ax, -1, az], [-ax, -1, -az]]) w.setBlock(x + bx, y + by, z + bz, 0, 0);
        this.spawnMob('iron_golem', x + 0.5, y - 2, z + 0.5, { persistent: true });
        return;
      }
    }
  }
  onTotem() {
    const p = this.player;
    this.sound.play('item.totem.use');
    if (this.particles) for (let i = 0; i < 60; i++) this.particles.spawn('happy_villager', p.x + (Math.random() - 0.5) * 2, p.y + Math.random() * 2, p.z + (Math.random() - 0.5) * 2, 0, 0, 0);
    this.showTitle('', '§eTotem of Undying');
  }

  // ------------------------------------------------------------------ chat / messages
  chat(msg, color) {
    this.chatLog.push({ text: color ? `§${color}${msg}` : msg, time: this.frameTime || performance.now() });
    if (this.chatLog.length > 100) this.chatLog.shift();
  }
  showActionbar(text) { this.hud.actionbar = { text, time: performance.now() }; }
  showTitle(title, subtitle = '') { this.hud.title = { title, subtitle, time: performance.now() }; }

  // ------------------------------------------------------------------ screens
  onScreenOpened(screen) {
    if (this.inWorld) { this.input.releaseLock(); this.input.down.clear(); }
    void screen;
  }
  onScreenClosed(old) {
    if (old && old.menu) old.menu.removed(this);
    if (this.inWorld && !this.player.dead) this.input.requestLock();
  }
  onPointerUnlocked() {
    if (this.inWorld && !this.gui.screen && !(this.loading && !this.loading.done)) this.gui.setScreen(new PauseScreen());
  }
  openInventory() {
    if (this.player.gameMode === 1) this.gui.setScreen(new CreativeScreen(this.player));
    else if (this.player.gameMode !== 3) this.gui.setScreen(new InventoryScreen(this.playerMenu));
  }
  openCrafting() { this.gui.setScreen(new CraftingScreen(new CraftingMenu(this.player))); }
  openFurnace(be, def) {
    this.tickingBE.add(be);
    const title = def.name === 'blast_furnace' ? 'Blast Furnace' : def.name === 'smoker' ? 'Smoker' : 'Furnace';
    this.gui.setScreen(new FurnaceScreen(new FurnaceMenu(this.player, be), title));
  }
  openChest(be, title, x, y, z) {
    be.viewers = (be.viewers || 0) + 1;
    this.sound.at(title === 'Barrel' ? 'block.barrel.open' : 'block.chest.open', x + 0.5, y + 0.5, z + 0.5);
    const menu = new ChestMenu(this.player, be.container, 3, () => { be.viewers--; this.sound.at(title === 'Barrel' ? 'block.barrel.close' : 'block.chest.close', x + 0.5, y + 0.5, z + 0.5); this.world.getChunk(x >> 4, z >> 4).modified = true; });
    this.gui.setScreen(new ChestScreen(menu, title));
  }
  openEnderChest() {
    const p = this.player;
    const c = new SimpleContainer(27);
    c.slots = p.enderChest;
    this.gui.setScreen(new ChestScreen(new ChestMenu(p, c, 3), 'Ender Chest'));
  }
  openEnchanting() { this.showActionbar('Enchanting is not available yet in Minecraft_Lite'); }
  openAnvil() { this.showActionbar('Anvils are not available yet in Minecraft_Lite'); }
  openStonecutter() { this.showActionbar('Stonecutters are not available yet in Minecraft_Lite'); }
  openSmithing() { this.showActionbar('Use the crafting grid: diamond gear + netherite ingot'); }
  openUnsupported(def) { this.showActionbar(`${def.displayName} is decorative in Minecraft_Lite`); }

  trySleep(x, y, z, meta) {
    const p = this.player;
    const t = this.dayTime % 24000;
    const night = t >= 12542 && t <= 23459;
    // set spawn
    p.spawnX = x + 0.5; p.spawnY = y + 0.6; p.spawnZ = z + 0.5;
    if (!night && !this.thundering) { this.showActionbar('You can sleep only at night or during thunderstorms'); this.chat('Respawn point set'); return; }
    for (const e of this.entities) if (e.hostile && !e.dead && Math.abs(e.x - x) < 8 && Math.abs(e.y - y) < 5 && Math.abs(e.z - z) < 8) { this.showActionbar('You may not rest now; there are monsters nearby'); return; }
    p.sleeping = true; p.sleepTimer = 0;
    p.sleepPos = [x, y, z, meta];
    p.teleport(x + 0.5, y + 0.5625, z + 0.5);
    this.chat('Respawn point set');
  }
  wakeUp() { const p = this.player; p.sleeping = false; p.sleepTimer = 0; if (p.sleepPos) p.teleport(p.sleepPos[0] + 0.5, p.sleepPos[1] + 0.6, p.sleepPos[2] + 0.5); }

  onPlayerDeath(src) {
    const msg = this.deathMessage(src);
    if (this.rules.showDeathMessages) this.chat(msg);
    this.deathMsg = msg;
    this.input.releaseLock();
    setTimeout(() => { if (this.inWorld && this.player && this.player.dead) this.gui.setScreen(new DeathScreen(msg, this.info.hardcore)); }, this.rules.doImmediateRespawn ? 0 : 900);
  }
  deathMessage(src) {
    const n = this.player.name;
    const a = src.attacker ? (src.attacker.displayName || src.attacker.name || 'Player') : null;
    switch (src.type) {
      case 'fall': return this.player.fallDistance > 5 ? `${n} fell from a high place` : `${n} hit the ground too hard`;
      case 'lava': return `${n} tried to swim in lava`;
      case 'fire': return `${n} went up in flames`;
      case 'onFire': return `${n} burned to death`;
      case 'drown': return `${n} drowned`;
      case 'starve': return `${n} starved to death`;
      case 'cactus': return `${n} was pricked to death`;
      case 'suffocation': return `${n} suffocated in a wall`;
      case 'void': return `${n} fell out of the world`;
      case 'explosion': return a ? `${n} was blown up by ${a}` : `${n} blew up`;
      case 'arrow': return `${n} was shot by ${a || 'Arrow'}`;
      case 'magic': return `${n} was killed by magic`;
      case 'wither': return `${n} withered away`;
      case 'hotFloor': return `${n} discovered the floor was lava`;
      case 'sweetBerry': return `${n} was poked to death by a sweet berry bush`;
      case 'anvil': return `${n} was squashed by a falling anvil`;
      case 'kill': return `${n} was killed`;
      default: return a ? `${n} was slain by ${a}` : `${n} died`;
    }
  }
  respawn() {
    const p = this.player;
    const [sx, sy, sz] = p.respawnPos();
    p.dead = false; p.deathTime = 0; p.health = p.maxHealth;
    p.food.level = 20; p.food.saturation = 5; p.food.exhaustion = 0;
    p.effects.clear(); p.fireTicks = 0; p.air = 300; p.absorption = 0;
    p.teleport(sx, sy, sz);
    this.chunkManager.ensure(sx, sz, 1);
    // find safe Y
    let y = Math.floor(sy);
    while (y < MAX_Y - 2 && (BLOCKS[this.world.getBlock(Math.floor(sx), y, Math.floor(sz))].solid || BLOCKS[this.world.getBlock(Math.floor(sx), y + 1, Math.floor(sz))].solid)) y++;
    p.teleport(sx, y, sz);
    this.gui.setScreen(null);
  }

  // ------------------------------------------------------------------ input callbacks
  onMouseLook(dx, dy) {
    const p = this.player;
    if (!p || p.dead || p.sleeping) return;
    const sens = this.options.get('sensitivity');
    const f = (sens * 0.6 + 0.2);
    const k = f * f * f * 8 * 0.15 * Math.PI / 180;
    const zoom = p.useItem && p.useItem.item.kind === 'spyglass' ? 0.1 : 1;
    p.yaw += dx * k * zoom;
    p.pitch += dy * k * zoom * (this.options.get('invertMouse') ? -1 : 1);
    p.pitch = clamp(p.pitch, -Math.PI / 2, Math.PI / 2);
  }
  onWheel(dir, e) {
    if (this.gui.screen) { this.gui.screen.wheel(this.gui.mouseX, this.gui.mouseY, dir, e); return; }
    if (!this.inWorld || !this.player) return;
    const inv = this.player.inventory;
    inv.selectedSlot = ((inv.selectedSlot + dir) % 9 + 9) % 9;
    this.hud.onSlotChange(this);
  }
  onKeyPressed(code, e) {
    const b = this.input.bindings;
    if (!this.inWorld) return;
    const p = this.player;
    if (code === 'Escape') { this.gui.setScreen(new PauseScreen()); return; }
    if (code === 'F1') { this.hideGui = !this.hideGui; return; }
    if (code === 'F3') { this.f3Down = true; this.f3Used = false; return; }
    if (this.input.down.has('F3') && code !== 'F3') {
      this.f3Used = true;
      if (code === 'KeyB') { this.showHitboxes = !this.showHitboxes; this.chat(`[Debug]: Hitboxes: ${this.showHitboxes ? 'shown' : 'hidden'}`, 'e'); }
      if (code === 'KeyG') { this.showChunkBorders = !this.showChunkBorders; this.chat(`[Debug]: Chunk borders: ${this.showChunkBorders ? 'shown' : 'hidden'}`, 'e'); }
      if (code === 'KeyH') { this.advancedTooltips = !this.advancedTooltips; this.chat(`[Debug]: Advanced tooltips: ${this.advancedTooltips ? 'shown' : 'hidden'}`, 'e'); }
      if (code === 'KeyA') { this.renderer.clearMeshes(); this.chat('[Debug]: Reloading all chunks', 'e'); }
      if (code === 'KeyN' && this.info.allowCommands) { this.commands.execute(p.gameMode === 3 ? '/gamemode creative' : '/gamemode spectator', true); }
      if (code === 'KeyD') this.chatLog = [];
      if (code === 'KeyT') this.chat('[Debug]: Reloaded resource packs', 'e');
      if (code === 'KeyP') { this.pauseOnLostFocus = !this.pauseOnLostFocus; }
      return;
    }
    if (code === 'F2') { this.takeScreenshot(); return; }
    if (code === 'F5' || code === b.perspective) { this.perspective = (this.perspective + 1) % 3; return; }
    if (code === 'F11' || code === b.fullscreen) { this.toggleFullscreen(); return; }
    if (p.dead) return;
    if (code === b.inventory) { this.openInventory(); return; }
    if (code === b.chat) { this.gui.setScreen(new ChatScreen('')); return; }
    if (code === b.command) { this.gui.setScreen(new ChatScreen('/')); return; }
    if (code === b.drop) {
      const s = p.inventory.selected();
      if (s && p.gameMode !== 3) {
        const all = e.ctrlKey || e.metaKey;
        const n = all ? s.count : 1;
        this.dropFromPlayer(s.copy(n));
        s.count -= n;
        if (s.count <= 0) p.inventory.setSelected(null);
      }
      return;
    }
    if (code === b.swapOffhand) {
      const inv = p.inventory;
      const a = inv.slots[inv.selectedSlot]; inv.slots[inv.selectedSlot] = inv.slots[40]; inv.slots[40] = a;
      return;
    }
    for (let i = 1; i <= 9; i++) if (code === b['hotbar' + i]) {
      if (p.gameMode === 1 && (this.input.isDown('saveToolbar') || this.input.isDown('loadToolbar'))) {
        if (this.input.isDown('saveToolbar')) { this.hotbars[i - 1] = p.inventory.slots.slice(0, 9).map((s) => (s ? s.toJSON() : null)); this.showActionbar(`Saved Hotbar ${i}`); }
        else if (this.hotbars[i - 1]) { this.hotbars[i - 1].forEach((s, k) => { p.inventory.slots[k] = s ? ItemStack.fromJSON(s) : null; }); }
        return;
      }
      p.inventory.selectedSlot = i - 1; this.hud.onSlotChange(this); return;
    }
    if (code === b.sprint && this.options.get('toggleSprint')) this.input.sprintToggle = !this.input.sprintToggle;
    if (code === b.forward) {
      const now = performance.now();
      if (now - this.input.lastForwardTap < 300 && !p.sneaking) this.doubleTapSprint = true;
      this.input.lastForwardTap = now;
    }
    if (code === b.sneak && this.options.get('toggleSneak')) this.sneakToggle = !this.sneakToggle;
    if (code === b.playerlist) this.showPlayerList = true;
    if (code === b.advancements) this.showActionbar('Advancements are not available in Minecraft_Lite');
  }
  onKeyReleased(code) {
    if (code === 'F3' && !this.f3Used) this.showDebug = !this.showDebug;
    if (code === this.input.bindings.playerlist) this.showPlayerList = false;
  }

  toggleFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    } catch { /* ignore */ }
  }
  takeScreenshot() {
    try {
      const url = this.canvas.toDataURL('image/png');
      const a = document.createElement('a');
      const d = new Date();
      a.download = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}.${String(d.getSeconds()).padStart(2, '0')}.png`;
      a.href = url; a.click();
      this.chat(`Saved screenshot as ${a.download}`);
    } catch (e) { this.chat('Failed to save screenshot: ' + e.message, 'c'); }
  }

  // ------------------------------------------------------------------ main loop
  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    const maxFps = this.options.get('maxFps');
    if (maxFps < 260 && now - this.lastFrameAt < 1000 / maxFps - 1) return;
    this.lastFrameAt = now;
    let dt = Math.min(250, now - this.lastTime);
    this.lastTime = now;
    this.frameTime = now;
    this.frames++;
    if (now - this.fpsTime >= 1000) { this.fps = this.frames; this.frames = 0; this.fpsTime = now; }
    if (this.touchControls) this.touchControls.update();
    try {
      if (this.inWorld) this.frameWorld(dt, now);
      else this.frameTitle(dt);
    } catch (e) {
      console.error(e);
      if (!this.crashShown) { this.crashShown = true; this.chat && this.chat('§cError: ' + e.message); }
    }
  }

  frameTitle(dt) {
    const r = this.renderer;
    this.titleAngle += dt * 0.00004;
    if (this.titleCM) {
      this.titleCM.update(this.titleCam.x, this.titleCam.z, r.renderDistance, 10);
      r.processDirty(4);
    }
    const cam = r.camera;
    cam.fov = 85; cam.updateProjectionMatrix();
    if (this.titleCam) cam.position.set(this.titleCam.x, this.titleCam.y, this.titleCam.z);
    cam.rotation.set(-0.18, this.titleAngle * Math.PI * 2, 0, 'YXZ');
    r.updateEnvironment({ time: 2000, ticks: performance.now() / 50, biomeSky: 0x78a7ff, gamma: 0.5 });
    r.outline.visible = false;
    r.render();
    this.gui.beginFrame();
    this.gui.tickAcc = (this.gui.tickAcc || 0) + dt;
    while (this.gui.tickAcc > 50) { this.gui.tick(); this.gui.tickAcc -= 50; }
    this.gui.render(dt);
  }

  frameWorld(dt, now) {
    const r = this.renderer, p = this.player;
    // loading phase
    const R = r.renderDistance;
    const budget = this.loading && !this.loading.done ? 30 : 6;
    const allDone = this.chunkManager.update(p.x, p.z, R, budget);
    r.processDirty(this.loading && !this.loading.done ? 20 : 5, [Math.floor(p.x / 16), Math.floor(p.z / 16)]);
    if (this.loading && !this.loading.done) {
      const near = this.chunkManager.progress ? this.chunkManager.progress(p.x, p.z, Math.min(R, 4)) : 1;
      this.loading.progress = near;
      if ((near >= 1 && performance.now() - this.loading.start > 400) || allDone) this.finishLoading();
      this.renderFrame(0, dt);
      return;
    }
    // ticks
    const pauses = this.gui.screen && this.gui.screen.pauses;
    this.paused = !!pauses;
    if (!this.paused) {
      this.acc += dt;
      let n = 0;
      while (this.acc >= 50 && n < 10) { this.tick(); this.acc -= 50; n++; }
      if (n >= 10) this.acc = 0;
    } else {
      this.gui.tickAcc = (this.gui.tickAcc || 0) + dt;
      while (this.gui.tickAcc > 50) { this.gui.tick(); this.gui.tickAcc -= 50; }
    }
    const partial = this.paused ? 1 : this.acc / 50;
    this.renderFrame(partial, dt);
    void now;
  }

  tick() {
    const w = this.world, p = this.player;
    this.ticks++;
    w.time++;
    if (this.rules.doDaylightCycle) this.dayTime++;
    this.gui.tick();
    this.hud.tick(this);
    this.tickWeather();
    const sp = skyParams(this.dayTime, 0x78a7ff, this.rainLevel, this.thunderLevel);
    this.skyDarken = 11 - sp.skyLightLevel;
    // input -> player
    this.updatePlayerInput();
    this.interaction.tick(this.input);
    // scheduled ticks
    for (const e of w.popDueTicks(4000)) this.blockLogic.scheduledTick(e.x, e.y, e.z);
    // random ticks
    this.randomTicks();
    // block entities
    for (const be of this.tickingBE) {
      if (be instanceof FurnaceEntity) be.tick(w, be.x, be.y, be.z);
      else if (be.type === 'spawner') this.spawner.spawnerTick(be);
    }
    this.redstone.tick();
    // entities
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (e.removed) continue;
      if (!w.isLoaded(Math.floor(e.x), Math.floor(e.z))) continue;
      e.tick();
    }
    if (this.entities.some((e) => e.removed)) this.entities = this.entities.filter((e) => !e.removed);
    if (this.rules.doMobSpawning) this.spawner.tick();
    // sleeping
    if (p.sleeping) {
      p.sleepTimer++;
      if (p.sleepTimer >= 100) {
        this.dayTime = Math.ceil(this.dayTime / 24000) * 24000;
        this.raining = false; this.thundering = false; this.rainLevel = 0;
        this.wakeUp();
      }
    }
    // autosave every minute
    if (this.ticks % 1200 === 0 && this.autosave !== false) this.saveWorld();
    this.sound.tick();
    this.particles.tick();
  }

  tickWeather() {
    if (this.rules.doWeatherCycle) {
      if (--this.rainTime <= 0) { this.raining = !this.raining; this.rainTime = this.raining ? 12000 + Math.floor(Math.random() * 12000) : 12000 + Math.floor(Math.random() * 168000); }
      if (--this.thunderTime <= 0) { this.thundering = !this.thundering; this.thunderTime = this.thundering ? 3600 + Math.floor(Math.random() * 12000) : 12000 + Math.floor(Math.random() * 168000); }
    }
    const target = this.raining ? 1 : 0;
    this.rainLevel += clamp(target - this.rainLevel, -0.01, 0.01);
    const tt = this.raining && this.thundering ? 1 : 0;
    this.thunderLevel += clamp(tt - this.thunderLevel, -0.01, 0.01);
    // lightning
    if (this.thunderLevel > 0.9 && Math.random() < 1 / 2000) {
      const p = this.player;
      const x = Math.floor(p.x + (Math.random() - 0.5) * 120), z = Math.floor(p.z + (Math.random() - 0.5) * 120);
      const y = this.world.rainHeight(x, z) + 1;
      this.lightning(x, y, z);
    }
    // snow layer / ice in cold biomes while raining
    if (this.rainLevel > 0.5 && Math.random() < 0.1) {
      const p = this.player;
      const x = Math.floor(p.x + (Math.random() - 0.5) * 96), z = Math.floor(p.z + (Math.random() - 0.5) * 96);
      const b = BIOMES[this.world.biomeAt(x, z)];
      if (b && b.snow) {
        const y = this.world.rainHeight(x, z);
        const id = this.world.getBlock(x, y, z);
        if (id === BLOCK.water.id && this.world.getMeta(x, y, z) === 0) this.world.setBlock(x, y, z, BLOCK.ice.id, 0);
        else if (BLOCKS[id].solid && BLOCKS[id].opaque && this.world.getBlock(x, y + 1, z) === 0 && (this.world.getLight(x, y + 1, z) & 15) < 10) this.world.setBlock(x, y + 1, z, BLOCK.snow.id, 0);
      }
    }
  }
  lightning(x, y, z) {
    this.hud.lightningFlash = 3;
    this.lightningBolt = { x, y, z, time: 8 };
    this.sound.at('entity.lightning_bolt.thunder', x, y, z, 10, 0.8 + Math.random() * 0.2);
    this.sound.at('entity.lightning_bolt.impact', x, y, z, 2, 0.5 + Math.random() * 0.2);
    if (this.rules.doFireTick && this.world.getBlock(x, y, z) === 0 && BLOCKS[this.world.getBlock(x, y - 1, z)].solid && this.difficulty >= 2) this.world.setBlock(x, y, z, BLOCK.fire.id, 0);
    for (const e of this.entities) {
      if (e.hurt && Math.abs(e.x - x) < 3 && Math.abs(e.z - z) < 3 && Math.abs(e.y - y) < 6) { e.hurt({ type: 'lightning' }, 5); e.setOnFire(8); if (e.onLightning) e.onLightning(); }
    }
  }

  randomTicks() {
    const w = this.world, p = this.player;
    const n = this.rules.randomTickSpeed;
    if (n <= 0) return;
    const R = Math.min(this.renderer.renderDistance, this.options.get('simulationDistance'));
    const pcx = Math.floor(p.x / 16), pcz = Math.floor(p.z / 16);
    for (const c of w.chunks.values()) {
      if (Math.abs(c.cx - pcx) > R || Math.abs(c.cz - pcz) > R) continue;
      for (let sy = 0; sy < SECTIONS; sy++) {
        const s = c.sections[sy];
        if (!s || s.count === 0) continue;
        for (let i = 0; i < n; i++) {
          const li = (Math.random() * 4096) | 0;
          const id = s.blocks[li];
          if (!id || !BLOCKS[id].randomTicks) continue;
          const x = c.cx * 16 + (li & 15), y = MIN_Y + sy * 16 + (li >> 8), z = c.cz * 16 + ((li >> 4) & 15);
          this.blockLogic.randomTick(x, y, z, id);
        }
      }
    }
  }

  updatePlayerInput() {
    const p = this.player, inp = this.input;
    const screenOpen = !!this.gui.screen;
    const k = (a) => !screenOpen && inp.isDown(a);
    p.input.forward = (k('forward') ? 1 : 0) - (k('back') ? 1 : 0);
    p.input.strafe = (k('left') ? 1 : 0) - (k('right') ? 1 : 0);
    if (this.touch) { p.input.forward += this.touch.forward; p.input.strafe += this.touch.strafe; }
    p.input.jump = k('jump') || (this.touch && this.touch.jump);
    p.input.sneak = this.options.get('toggleSneak') ? this.sneakToggle && !screenOpen : k('sneak') || (this.touch && this.touch.sneak);
    p.input.sprint = k('sprint') || this.doubleTapSprint || inp.sprintToggle || (this.touch && this.touch.sprint);
    if (p.input.forward <= 0) this.doubleTapSprint = false;
    // auto jump
    if (this.options.get('autoJump') && p.onGround && p.collidedH && p.input.forward > 0 && !p.sneaking) p.input.jump = true;
  }

  // ------------------------------------------------------------------ rendering
  renderFrame(partial, dt) {
    const r = this.renderer, p = this.player, cam = r.camera;
    // camera
    const [x, y, z] = p.lerpPos(partial);
    const eh = p.prevEyeH + (p.eyeH - p.prevEyeH) * partial;
    let yaw = p.yaw, pitch = p.pitch;
    let roll = 0;
    let cx = x, cy = y + eh, cz = z;
    if (p.sleeping) { cy = y + 0.3; }
    if (p.dead) { roll = Math.min(1, (p.deathTime + partial) / 20) * 40 * Math.PI / 180; cy = y + 0.3; }
    // hurt tilt
    if (p.hurtTime > 0 && !p.dead) {
      const ht = (p.hurtTime - partial) / 10;
      roll += Math.sin(ht * ht * ht * ht * Math.PI) * 14 * Math.PI / 180;
    }
    // view bobbing
    let bobX = 0, bobY = 0, bobRoll = 0, bobPitch = 0;
    if (this.options.get('viewBobbing') && this.perspective === 0 && !p.flying) {
      const walk = (p.limbSwing + p.limbAmount * partial) * 0.6;
      const amt = (p.prevLimbAmount + (p.limbAmount - p.prevLimbAmount) * partial) * (p.onGround ? 1 : 0.3);
      bobX = Math.sin(walk * Math.PI * 0.5) * amt * 0.05;
      bobY = -Math.abs(Math.cos(walk * Math.PI * 0.5) * amt) * 0.08;
      bobRoll = Math.sin(walk * Math.PI * 0.5) * amt * 0.025;
      bobPitch = Math.abs(Math.cos(walk * Math.PI * 0.5 - 0.2) * amt) * 0.03;
    }
    const fwd = [-Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
    if (this.perspective !== 0) {
      const dir = this.perspective === 1 ? -1 : 1;
      let dist = 4;
      const h = raycastBlocks(this.world, cx, cy, cz, fwd[0] * dir, fwd[1] * dir, fwd[2] * dir, 4.2);
      if (h) dist = Math.max(0.3, h.dist - 0.25);
      cx += fwd[0] * dir * dist; cy += fwd[1] * dir * dist; cz += fwd[2] * dir * dist;
      if (this.perspective === 2) { yaw += Math.PI; pitch = -pitch; }
    }
    cam.position.set(cx + Math.cos(yaw) * bobX, cy + bobY, cz + Math.sin(yaw) * bobX);
    cam.rotation.set(-pitch - bobPitch, Math.PI - yaw, roll + bobRoll, 'YXZ');
    // fov
    let fov = this.options.get('fov');
    let mod = 1;
    if (this.options.get('fovEffects')) {
      if (p.flying) mod *= 1.1;
      const spd = p.speedValue ? p.speedValue() : 0.1;
      if (!p.flying) mod *= (spd / 0.1 + 1) / 2;
      if (p.useItem && p.useItem.item.kind === 'bow') { let f = p.useTicks / 20; f = f > 1 ? 1 : f * f; mod *= 1 - f * 0.15; }
    }
    if (p.useItem && p.useItem.item.kind === 'spyglass') mod = 0.1;
    if (p.eyeInWater) mod *= 60 / 70;
    r.fovMod += (mod - r.fovMod) * Math.min(1, dt / 100);
    cam.fov = fov * r.fovMod;
    cam.updateProjectionMatrix();
    // environment
    const bx = Math.floor(x), bz = Math.floor(z);
    const biome = BIOMES[this.world.biomeAt(bx, bz)] || BIOMES[0];
    const nightVision = p.hasEffect('night_vision') ? 1 : 0;
    r.updateEnvironment({
      time: this.dayTime + partial, ticks: this.ticks + partial, rain: this.rainLevel, thunder: this.thunderLevel, biomeSky: biome.sky,
      underwater: p.eyeInWater, inLava: p.eyeInLava, gamma: this.options.get('gamma'), nightVision, blindness: p.hasEffect('blindness'),
      waterFog: biome.water, flash: this.hud.lightningFlash > 0 ? 0.3 : 0,
    });
    // selection & crack
    this.interaction.updateTarget(partial);
    const t = this.interaction.target;
    if (t && !this.hideGui && p.gameMode !== 3) {
      const id = this.world.getBlock(t.x, t.y, t.z);
      const { selectionBoxes } = this.physicsHelpers;
      r.setOutline(t.x, t.y, t.z, selectionBoxes(this.world, t.x, t.y, t.z, id, this.world.getMeta(t.x, t.y, t.z)));
    } else r.setOutline(0, 0, 0, null);
    const b = this.interaction.breaking;
    if (b) r.setCrack(b.x, b.y, b.z, this.interaction.crackStage()); else r.setCrack(0, 0, 0, -1);
    // entities, particles, hand
    this.entityRenderer.update(this.entities, partial, this.perspective === 0 ? p : null);
    this.particles.update(partial, cam);
    const extra = [];
    if (this.perspective === 0 && !this.hideGui && !p.dead && p.gameMode !== 3) {
      this.handRenderer.update(this, p, partial, r);
      extra.push([this.handRenderer.scene, this.handRenderer.camera, true]);
    }
    r.render(extra);
    // GUI
    this.gui.beginFrame();
    if (!this.hideGui || this.gui.screen) renderHud(this.gui, this, partial);
    this.gui.render(dt);
  }
}

// late import to avoid a cycle at module init
import * as phys from '../entity/physics.js';
Game.prototype.physicsHelpers = phys;
void AABB; void THREE; void SEA_LEVEL;
