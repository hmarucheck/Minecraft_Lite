// In-game HUD (hotbar, health, hunger, XP, chat, debug screen, overlays).
import { fill, drawHotbarBg, drawHotbarSelection, drawXpBar, drawCrosshair, HEART, FOOD, ARMOR, BUBBLE, drawSlot } from './draw.js';
import { BLOCKS } from '../registry/blocks.js';
import { BIOMES } from '../world/biomes.js';
import { EFFECTS } from '../entity/living.js';
import { HFACING_NAMES, MIN_Y } from '../core/util.js';
import { RARITY_COLOR } from '../registry/items.js';

export class HudState {
  constructor() { this.itemName = null; this.itemNameTime = 0; this.actionbar = null; this.title = null; this.lightningFlash = 0; this.lastHealth = 20; this.heartBlink = 0; this.hurtFlash = 0; this.saving = 0; }
  onSlotChange(game) {
    const s = game.player.inventory.selected();
    this.itemName = s ? (s.tag && s.tag.name ? s.tag.name : s.item.displayName) : null;
    this.itemNameColor = s ? RARITY_COLOR[s.item.rarity] || 0xffffff : 0xffffff;
    this.itemNameTime = 40;
  }
  tick(game) {
    if (this.itemNameTime > 0) this.itemNameTime--;
    if (this.lightningFlash > 0) this.lightningFlash--;
    const p = game.player;
    if (p.health < this.lastHealth) this.heartBlink = 20;
    this.lastHealth = p.health;
    if (this.heartBlink > 0) this.heartBlink--;
    // detect held item change
    const s = p.inventory.selected();
    const key = s ? s.item.id : -1;
    if (key !== this.lastHeldKey) { this.lastHeldKey = key; if (key !== -1) this.onSlotChange(game); else this.itemNameTime = 0; }
  }
}

export function renderHud(gui, game, partial) {
  const ctx = gui.ctx, f = gui.font;
  const W = gui.width, H = gui.height;
  const p = game.player;
  const hud = game.hud;
  if (!p) return;
  if (game.hideGui && !gui.screen) return;
  // overlays
  if (game.options.get('graphics') !== 'fast') vignette(ctx, W, H, p, game);
  const helm = p.inventory.slots[39];
  if (helm && helm.item.name === 'carved_pumpkin' && game.perspective === 0) pumpkinOverlay(ctx, W, H);
  if (p.fireTicks > 0 && !p.fireImmune && game.perspective === 0 && !p.hasEffect('fire_resistance')) fireOverlay(ctx, W, H, game.ticks);
  if (p.eyeInWater && game.perspective === 0) fill(ctx, 0, 0, W, H, 'rgba(10,30,90,0.12)');
  if (p.sleeping) { fill(ctx, 0, 0, W, H, `rgba(16,16,32,${Math.min(0.8, p.sleepTimer / 100)})`); }
  if (hud.lightningFlash > 0 && !game.options.get('hideLightningFlash')) fill(ctx, 0, 0, W, H, `rgba(255,255,255,${hud.lightningFlash * 0.08})`);
  if (p.hasEffect('nausea')) fill(ctx, 0, 0, W, H, `rgba(80,20,80,${0.15 + Math.sin(game.ticks / 5) * 0.05})`);

  const spectator = p.gameMode === 3;
  const survival = p.gameMode === 0 || p.gameMode === 2;
  // crosshair
  if (game.perspective === 0 && !spectator) {
    drawCrosshair(ctx, Math.floor(W / 2), Math.floor(H / 2));
    if (game.options.get('attackIndicator') === 'crosshair') {
      const cd = p.attackCooldown(partial);
      if (cd < 1) {
        const x = Math.floor(W / 2) - 8, y = Math.floor(H / 2) + 7;
        fill(ctx, x, y, 16, 4, 'rgba(60,60,60,0.8)');
        fill(ctx, x, y, Math.floor(17 * cd), 4, 'rgba(230,230,230,0.9)');
      }
    }
  }
  if (!spectator) {
    // hotbar
    const hx = Math.floor(W / 2) - 91, hy = H - 22;
    drawHotbarBg(ctx, hx, hy);
    drawHotbarSelection(ctx, hx - 1 + p.inventory.selectedSlot * 20, hy - 1);
    for (let i = 0; i < 9; i++) gui.drawItem(p.inventory.slots[i], hx + 3 + i * 20, hy + 3);
    const off = p.inventory.slots[40];
    if (off) { const ox = hx - 29; fill(ctx, ox, hy - 1, 24, 24, 'rgba(0,0,0,0)'); drawOffhandFrame(ctx, ox, hy - 1); gui.drawItem(off, ox + 4, hy + 3); }
    if (survival) {
      // xp
      drawXpBar(ctx, hx, H - 29, p.xpProgress);
      if (p.xpLevel > 0) {
        const t = String(p.xpLevel);
        const tx = Math.floor(W / 2 - f.width(t) / 2), ty = H - 35;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) f.draw(ctx, t, tx + dx, ty + dy, 0x000000, false);
        f.draw(ctx, t, tx, ty, 0x80ff20, false);
      }
      drawHealth(gui, game, hx, H - 39);
      drawFood(gui, game, hx + 182, H - 39);
      drawArmor(gui, game, hx, H - 49);
      if (p.air < p.maxAir || p.eyeInWater) {
        const full = Math.ceil((p.air - 2) * 10 / p.maxAir), part = Math.ceil(p.air * 10 / p.maxAir) - full;
        for (let i = 0; i < full + part; i++) ctx.drawImage(i < full ? BUBBLE.full : BUBBLE.pop, hx + 182 - i * 8 - 9, H - 49);
      }
    }
    // held item name
    if (hud.itemNameTime > 0 && hud.itemName) {
      const a = Math.min(1, hud.itemNameTime * 256 / 10 / 255);
      const ty = H - 59 + (survival ? 0 : 14);
      const tw = f.width(hud.itemName);
      fill(ctx, Math.floor(W / 2 - tw / 2) - 2, ty - 2, tw + 4, 12, `rgba(0,0,0,${0.3 * a})`);
      f.draw(ctx, hud.itemName, Math.floor(W / 2 - tw / 2), ty, hud.itemNameColor, true, a);
    }
  }
  // actionbar
  if (hud.actionbar) {
    const age = performance.now() - hud.actionbar.time;
    if (age < 3000) {
      const a = age > 2000 ? 1 - (age - 2000) / 1000 : 1;
      f.draw(ctx, hud.actionbar.text, Math.floor(W / 2 - f.width(hud.actionbar.text) / 2), H - 68, 0xffffff, true, a);
    } else hud.actionbar = null;
  }
  // title
  if (hud.title) {
    const age = performance.now() - hud.title.time;
    if (age < 4000) {
      const a = age < 500 ? age / 500 : age > 3000 ? 1 - (age - 3000) / 1000 : 1;
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(4, 4);
      f.draw(ctx, hud.title.title, -f.width(hud.title.title) / 2, -10, 0xffffff, true, a);
      ctx.restore();
      if (hud.title.subtitle) { ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(2, 2); f.draw(ctx, hud.title.subtitle, -f.width(hud.title.subtitle) / 2, 5, 0xffffff, true, a); ctx.restore(); }
    } else hud.title = null;
  }
  // effects (top right)
  let ex = W - 25;
  for (const [n, e] of p.effects) {
    if (e.ambient) continue;
    const info = EFFECTS[n];
    fill(ctx, ex, 1, 24, 24, info.good ? 'rgba(80,80,160,0.6)' : 'rgba(120,40,40,0.6)');
    fill(ctx, ex + 4, 5, 16, 16, '#' + info.color.toString(16).padStart(6, '0'));
    if (e.duration < 200 && Math.floor(e.duration / 4) % 2) fill(ctx, ex + 4, 5, 16, 16, 'rgba(255,255,255,0.4)');
    ex -= 25;
  }
  // ---- feature packs: extra HUD elements (boss bars, jump bar, ...) ----
  // ==== pack:dimensions (Nether & End) ====
  // ==== end pack:dimensions ====

  // ==== pack:enchanting (enchanting, anvil, brewing & workstations) ====
  // ==== end pack:enchanting ====

  // ==== pack:structures (structures & loot) ====
  // ==== end pack:structures ====

  // ==== pack:trading (villager trading) ====
  // ==== end pack:trading ====

  // ==== pack:riding (riding & vehicles) ====
  // ==== end pack:riding ====

  // ==== pack:fishing (fish, fishing & ocean mobs) ====
  // ==== end pack:fishing ====

  // chat
  drawChat(gui, game);
  // debug
  if (game.showDebug) drawDebug(gui, game, partial);
  // player list
  if (game.showPlayerList) {
    const name = p.name;
    const w = Math.max(80, f.width(name) + 20);
    fill(ctx, W / 2 - w / 2 - 1, 9, w + 2, 11, 'rgba(0,0,0,0.5)');
    fill(ctx, W / 2 - w / 2, 10, w, 9, 'rgba(255,255,255,0.13)');
    f.draw(ctx, name, Math.floor(W / 2 - w / 2 + 2), 11, 0xffffff);
  }
  // autosave indicator
  if (game.savingIndicator && performance.now() - game.savingIndicator < 1500 && game.options.get('autosaveIndicator')) f.draw(ctx, 'Saving world', W - f.width('Saving world') - 4, H - 12, 0xa0a0a0);
}

function drawOffhandFrame(ctx, x, y) {
  fill(ctx, x, y, 24, 24, 'rgba(80,80,80,0.9)');
  fill(ctx, x + 1, y + 1, 22, 22, 'rgba(10,10,10,0.55)');
  fill(ctx, x + 1, y + 1, 22, 1, 'rgba(150,150,150,0.85)');
  fill(ctx, x + 1, y + 1, 1, 22, 'rgba(150,150,150,0.85)');
}

function drawHealth(gui, game, x, y) {
  const ctx = gui.ctx, p = game.player;
  const hp = Math.ceil(p.health), maxHp = p.maxHealth;
  const abs = Math.ceil(p.absorption);
  const containers = Math.ceil((maxHp + abs) / 2);
  const rows = Math.ceil(containers / 10);
  const rowH = Math.max(10 - (rows - 2), 3);
  const blink = game.hud.heartBlink > 0 && Math.floor(game.hud.heartBlink / 3) % 2 === 1;
  const regenIdx = p.hasEffect('regeneration') ? (game.ticks % Math.ceil(maxHp + 5)) : -1;
  const hard = game.info && game.info.hardcore;
  for (let i = containers - 1; i >= 0; i--) {
    const row = Math.floor(i / 10);
    let hx = x + (i % 10) * 8, hy = y - row * rowH;
    if (hp <= 4) hy += Math.floor(Math.random() * 2);
    if (i === regenIdx) hy -= 2;
    ctx.drawImage(HEART.container, hx, hy);
    if (blink) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(hx + 1, hy + 1, 7, 6); }
    const v = i * 2;
    let full = HEART.full, half = HEART.half;
    if (p.hasEffect('poison')) { full = HEART.poisonFull; half = HEART.poisonHalf; }
    else if (p.hasEffect('wither')) { full = HEART.witherFull; half = HEART.witherFull; }
    else if (hard) full = HEART.hardcoreFull;
    if (v < maxHp) {
      if (v + 1 < hp) ctx.drawImage(full, hx, hy);
      else if (v + 1 === hp) ctx.drawImage(half, hx, hy);
    } else {
      const a = v - maxHp;
      if (a + 1 < abs) ctx.drawImage(HEART.absorbFull, hx, hy);
      else if (a + 1 === abs) ctx.drawImage(HEART.absorbHalf, hx, hy);
    }
  }
}
function drawFood(gui, game, right, y) {
  const ctx = gui.ctx, p = game.player;
  const food = p.food.level;
  const hunger = p.hasEffect('hunger');
  for (let i = 0; i < 10; i++) {
    let fy = y;
    if (p.food.saturation <= 0 && game.ticks % (food * 3 + 1) === 0) fy += Math.floor(Math.random() * 3) - 1;
    const fx = right - i * 8 - 9;
    ctx.drawImage(FOOD.container, fx, fy);
    const v = i * 2;
    if (v + 1 < food) ctx.drawImage(hunger ? FOOD.hungerFull : FOOD.full, fx, fy);
    else if (v + 1 === food) ctx.drawImage(FOOD.half, fx, fy);
  }
}
function drawArmor(gui, game, x, y) {
  const ctx = gui.ctx, p = game.player;
  const a = p.armorValue();
  if (a <= 0) return;
  const rows = Math.ceil((p.maxHealth + Math.ceil(p.absorption)) / 2 / 10);
  y -= (rows - 1) * Math.max(10 - (rows - 2), 3);
  for (let i = 0; i < 10; i++) {
    const v = i * 2 + 1;
    const ax = x + i * 8;
    if (v < a) ctx.drawImage(ARMOR.full, ax, y);
    else if (v === a) ctx.drawImage(ARMOR.half, ax, y);
    else ctx.drawImage(ARMOR.empty, ax, y);
  }
}

export function drawChat(gui, game, open = false) {
  const ctx = gui.ctx, f = gui.font;
  const H = gui.height;
  const now = performance.now();
  const lines = [];
  const width = Math.floor(320 * game.options.get('chatWidth'));
  const max = open ? 20 : 10;
  for (let i = game.chatLog.length - 1; i >= 0 && lines.length < max; i--) {
    const m = game.chatLog[i];
    const age = (now - m.time) / 1000;
    if (!open && age > 10) break;
    const wrapped = f.wrap(m.text, width - 4).reverse();
    for (const w of wrapped) { if (lines.length < max) lines.push({ text: w, alpha: open ? 1 : Math.min(1, (10 - age)) }); }
  }
  if (game.options.get('chatVisibility') === 'hidden') return;
  const op = game.options.get('chatOpacity');
  const bg = game.options.get('textBackgroundOpacity');
  lines.forEach((l, k) => {
    const y = H - 48 - k * 9 + (open ? 8 : 0);
    fill(ctx, 0, y - 1, width, 9, `rgba(0,0,0,${bg * l.alpha})`);
    f.draw(ctx, l.text, 2, y, 0xffffff, true, l.alpha * op);
  });
}

function vignette(ctx, W, H, p, game) {
  const l = game.world ? game.world.getLight(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z)) : 0xf0;
  const bright = Math.max((l >> 4) - (game.skyDarken || 0), l & 15) / 15;
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${0.12 + (1 - bright) * 0.2})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function pumpkinOverlay(ctx, W, H) {
  ctx.fillStyle = 'rgba(40,20,0,0.92)';
  ctx.fillRect(0, 0, W, H);
  ctx.clearRect(W * 0.2, H * 0.3, W * 0.18, H * 0.14);
  ctx.clearRect(W * 0.62, H * 0.3, W * 0.18, H * 0.14);
  ctx.clearRect(W * 0.25, H * 0.62, W * 0.5, H * 0.12);
}
function fireOverlay(ctx, W, H, t) {
  for (let i = 0; i < 24; i++) {
    const x = (i / 24) * W, h = H * (0.18 + 0.08 * Math.sin(t * 0.7 + i * 1.7));
    const g = ctx.createLinearGradient(0, H - h, 0, H);
    g.addColorStop(0, 'rgba(255,180,40,0)'); g.addColorStop(0.5, 'rgba(255,120,20,0.55)'); g.addColorStop(1, 'rgba(255,60,0,0.75)');
    ctx.fillStyle = g; ctx.fillRect(x, H - h, W / 24 + 1, h);
  }
}

function drawDebug(gui, game, partial) {
  const ctx = gui.ctx, f = gui.font;
  const p = game.player, w = game.world;
  const [x, y, z] = p.lerpPos(partial);
  const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
  const deg = ((p.yaw * 180 / Math.PI) % 360 + 540) % 360 - 180;
  const hf = ((Math.floor(deg * 4 / 360 + 0.5) % 4) + 4) % 4;
  const toward = ['Towards positive Z', 'Towards negative X', 'Towards negative Z', 'Towards positive X'][hf];
  const light = w.getLight(bx, Math.floor(y + p.eyeHeight * 0.5), bz);
  const biome = BIOMES[w.biomeAt(bx, bz)];
  const day = Math.floor(game.dayTime / 24000);
  const reduced = game.rules.reducedDebugInfo;
  const left = [
    `${game.version} (vanilla)`,
    `${game.fps} fps T: ${game.options.get('maxFps') >= 260 ? 'inf' : game.options.get('maxFps')} ${game.options.get('graphics')} ${game.options.get('clouds')}-clouds`,
    `Integrated server @ ${(game.tickMs || 0).toFixed(1)} ms ticks`,
    `C: ${game.renderer.meshCount} sections D: ${game.renderer.renderDistance}, chunks: ${w.chunks.size}`,
    `E: ${game.entities.length}, P: ${game.particles.list.length}`,
    'minecraft:overworld',
    '',
    reduced ? '' : `XYZ: ${x.toFixed(3)} / ${y.toFixed(5)} / ${z.toFixed(3)}`,
    reduced ? '' : `Block: ${bx} ${by} ${bz} [${bx & 15} ${by & 15} ${bz & 15}]`,
    reduced ? '' : `Chunk: ${bx >> 4} ${(by - MIN_Y) >> 4} ${bz >> 4}`,
    `Facing: ${HFACING_NAMES[hf]} (${toward}) (${deg.toFixed(1)} / ${(p.pitch * 180 / Math.PI).toFixed(1)})`,
    `Client Light: ${Math.max((light >> 4) - game.skyDarken, light & 15)} (${light >> 4} sky, ${light & 15} block)`,
    `Biome: minecraft:${biome ? biome.name : 'unknown'}`,
    `Local Difficulty: ${(game.difficulty * 0.75 + 0.75).toFixed(2)} // 0.00 (Day ${day})`,
    `Time: ${game.dayTime % 24000} Weather: ${game.thundering ? 'thunder' : game.raining ? 'rain' : 'clear'}`,
    '',
    `Debug: Pie [shift]: hidden FPS + TPS [alt]: hidden`,
    `For help: press F3 + Q`,
  ];
  left.forEach((l, i) => { if (!l) return; const tw = f.width(l); fill(ctx, 1, 2 + i * 9 - 1, tw + 2, 9, 'rgba(80,80,80,0.56)'); f.draw(ctx, l, 2, 2 + i * 9, 0xe0e0e0, false); });
  const gl = game.renderer.gl.getContext();
  let gpu = 'WebGL';
  try { const ext = gl.getExtension('WEBGL_debug_renderer_info'); if (ext) gpu = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL); } catch { /* ignore */ }
  const mem = performance.memory ? `Mem: ${Math.round(performance.memory.usedJSHeapSize / 1048576)}/${Math.round(performance.memory.jsHeapSizeLimit / 1048576)}MB` : 'Mem: n/a';
  const right = ['JavaScript (Browser) 64bit', mem, `CPU: ${navigator.hardwareConcurrency || '?'}x`, '', `Display: ${game.canvas.width}x${game.canvas.height} (WebGL 2)`, String(gpu).slice(0, 60), ''];
  const t = game.interaction.target;
  if (t) {
    right.push(`Targeted Block: ${t.x}, ${t.y}, ${t.z}`, `minecraft:${BLOCKS[t.id].name}`);
    if (t.meta) right.push(`meta: ${t.meta}`);
  }
  const W = gui.width;
  right.forEach((l, i) => { if (!l) return; const tw = f.width(l); fill(ctx, W - tw - 3, 2 + i * 9 - 1, tw + 2, 9, 'rgba(80,80,80,0.56)'); f.draw(ctx, l, W - tw - 2, 2 + i * 9, 0xe0e0e0, false); });
  void drawSlot;
}
