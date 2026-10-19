// Player interaction: block breaking, attacking, using items, placing blocks, pick block.
import { BLOCKS, BLOCK } from '../registry/blocks.js';
import { ITEM, itemOfBlock } from '../registry/items.js';
import { ItemStack } from './itemstack.js';
import { raycastBlocks, AABB } from '../entity/physics.js';
import { Projectile } from '../entity/entity.js';
import { enchantLevel } from './enchantments.js';
import { FACE_DIRS } from '../core/util.js';

const WATER = BLOCK.water.id, LAVA = BLOCK.lava.id;

export class Interaction {
  constructor(game) {
    this.game = game;
    this.target = null; // block hit
    this.targetEntity = null;
    this.breaking = null; // {x,y,z,progress}
    this.breakCooldown = 0;
    this.useCooldown = 0;
    this.creativeBreakDelay = 0;
  }
  get player() { return this.game.player; }
  get world() { return this.game.world; }

  reach() { return this.player.gameMode === 1 ? 5 : 4.5; }

  updateTarget(partial = 1) {
    const p = this.player;
    if (!p || p.dead) { this.target = null; this.targetEntity = null; return; }
    const [ex, ey, ez] = this.game.eyePos(partial);
    const [dx, dy, dz] = this.game.lookDir();
    const reach = this.reach();
    const hit = raycastBlocks(this.world, ex, ey, ez, dx, dy, dz, reach);
    // entities
    let best = null, bestT = hit ? hit.dist : (p.gameMode === 1 ? 5 : 3);
    const entReach = p.gameMode === 1 ? 5 : 3;
    bestT = Math.min(bestT, entReach);
    for (const e of this.game.entities) {
      if (e === p || e.removed || e.dead || e.type === 'xp_orb' || e.type === 'item' || e.type === 'arrow' || e.noTarget) continue;
      if (!e.hurt && e.type !== 'boat') continue;
      const h = e.box.grow(0.1).rayHit(ex, ey, ez, dx, dy, dz);
      if (h && h.t < bestT) { best = e; bestT = h.t; }
    }
    this.targetEntity = best;
    this.target = best ? null : hit;
    if (p.gameMode === 3) this.target = null;
  }

  // ------------------------------------------------------------ per tick
  tick(input) {
    const p = this.player;
    const g = this.game;
    if (!p || p.dead || g.gui.screen) { this.stopBreaking(); return; }
    if (this.breakCooldown > 0) this.breakCooldown--;
    if (this.useCooldown > 0) this.useCooldown--;
    if (this.creativeBreakDelay > 0) this.creativeBreakDelay--;
    // attack / break
    if (input.attackPressed) this.onAttackClick();
    if (input.attackDown && !p.useItem) this.continueBreaking(input.attackPressed);
    else this.stopBreaking();
    // use
    if (input.usePressed) { this.useCooldown = 0; }
    if (input.useDown && this.useCooldown === 0 && !p.useItem && !input.attackDown) this.onUse(input.usePressed);
    if (!input.useDown && p.useItem) this.releaseUse();
    if (input.pickPressed) this.pickBlock();
    input.attackPressed = false; input.usePressed = false; input.pickPressed = false;
  }

  onAttackClick() {
    const p = this.player;
    p.swing();
    if (this.targetEntity) { this.attack(this.targetEntity); return; }
    if (!this.target) { p.attackTicker = 0; }
  }

  attack(e) {
    const p = this.player, g = this.game;
    if (p.gameMode === 3) return;
    const s = p.inventory.selected();
    let dmg = s && s.item.damage ? s.item.damage : 1;
    if (p.hasEffect('strength')) dmg += 3 * (p.effectAmp('strength') + 1);
    if (p.hasEffect('weakness')) dmg -= 4 * (p.effectAmp('weakness') + 1);
    const cd = p.attackCooldown(0.5);
    dmg *= 0.2 + cd * cd * 0.8;
    const crit = cd > 0.9 && p.fallDistance > 0 && !p.onGround && !p.onLadder && !p.inWater && !p.sprinting;
    if (crit) dmg *= 1.5;
    const sharp = enchantLevel(s, 'sharpness');
    if (sharp) dmg += 0.5 * sharp + 0.5;
    if (e.type === 'item_frame' || e.type === 'boat') { e.remove(); return; }
    const kb = (p.sprinting && cd > 0.9 ? 1 : 0) + enchantLevel(s, 'knockback');
    if (e.hurt({ type: 'player', attacker: p }, Math.max(0, dmg))) {
      p.lastHurtMob = e; p.lastHurtMobTime = p.age;
      const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
      if (e.knockback) e.knockback(0.4 + kb * 0.5, sin, -cos);
      if (kb) { p.vx *= 0.6; p.vz *= 0.6; p.sprinting = false; }
      if (crit) { g.sound.at('entity.player.attack.crit', e.x, e.y, e.z); for (let i = 0; i < 12; i++) g.particles && g.particles.spawn('crit', e.x, e.y + e.height * 0.6, e.z, (Math.random() - 0.5) * 0.6, Math.random() * 0.4, (Math.random() - 0.5) * 0.6); }
      else g.sound.at(cd > 0.9 ? 'entity.player.attack.strong' : 'entity.player.attack.weak', e.x, e.y, e.z);
      // sweep attack with swords
      if (s && s.item.tool && s.item.tool.type === 'sword' && cd > 0.9 && !crit && !p.sprinting && p.onGround) {
        for (const o of g.entities) {
          if (o === e || o === p || !o.hurt || o.dead || o.type === 'item' || o.type === 'xp_orb') continue;
          if (o.distSq(e) < 1 && o.distSq(p) < 9) { o.hurt({ type: 'player', attacker: p }, 1); o.knockback && o.knockback(0.4, sin, -cos); }
        }
        g.sound.at('entity.player.attack.sweep', p.x, p.y, p.z);
        g.particles && g.particles.spawn('sweep', p.x - sin * 1, p.y + p.eyeHeight * 0.7, p.z + cos * 1, 0, 0, 0);
      }
      if (s && s.item.tool && s.item.durability && p.gameMode !== 1) { if (s.hurt(s.item.tool.type === 'sword' ? 1 : 2)) { p.inventory.setSelected(s.count > 0 ? s : null); g.sound.play('entity.item.break'); } }
      p.food.exhaust(0.1);
      p.statistics.damageDealt += dmg;
      if (e.fireAspect) e.setOnFire(4);
    } else g.sound.at('entity.player.attack.nodamage', e.x, e.y, e.z);
    p.attackTicker = 0;
  }

  continueBreaking(justPressed) {
    const p = this.player, g = this.game, w = this.world;
    const t = this.target;
    if (!t || this.targetEntity) { this.stopBreaking(); return; }
    if (p.gameMode === 2 || p.gameMode === 3) return;
    const def = BLOCKS[t.id];
    const stack = p.inventory.selected();
    if (p.gameMode === 1) {
      if (stack && stack.item.tool && stack.item.tool.type === 'sword') return;
      if (stack && (stack.item.name === 'debug_stick' || stack.item.kind === 'trident')) return;
      if (this.creativeBreakDelay > 0 && !justPressed) return;
      this.destroyBlock(t.x, t.y, t.z);
      this.creativeBreakDelay = 5;
      return;
    }
    if (this.breakCooldown > 0) return;
    if (!this.breaking || this.breaking.x !== t.x || this.breaking.y !== t.y || this.breaking.z !== t.z || this.breaking.id !== t.id) {
      this.breaking = { x: t.x, y: t.y, z: t.z, id: t.id, progress: 0, soundTick: 0 };
      // clicking fire puts it out
      const above = w.getBlock(t.x + FACE_DIRS[t.face][0], t.y + FACE_DIRS[t.face][1], t.z + FACE_DIRS[t.face][2]);
      if (BLOCKS[above].kind === 'fire') { w.setBlock(t.x + FACE_DIRS[t.face][0], t.y + FACE_DIRS[t.face][1], t.z + FACE_DIRS[t.face][2], 0, 0); g.sound.at('block.fire.extinguish', t.x, t.y, t.z); this.breaking = null; return; }
    }
    const b = this.breaking;
    const step = g.blockLogic.breakProgress(p, def, stack);
    b.progress += step;
    if (b.soundTick++ % 4 === 0) g.sound.blockSound(def, 'hit', b.x + 0.5, b.y + 0.5, b.z + 0.5, 0.25, 0.5);
    if (step > 0 && g.particles && b.soundTick % 2 === 0) g.particles.blockHit(b.x, b.y, b.z, t.face, def, t.meta);
    if (b.progress >= 1) {
      this.destroyBlock(b.x, b.y, b.z);
      this.breaking = null;
      this.breakCooldown = 5;
    }
    p.swing();
  }
  stopBreaking() { this.breaking = null; }
  crackStage() { return this.breaking ? Math.min(9, Math.floor(this.breaking.progress * 10)) : -1; }

  destroyBlock(x, y, z) {
    const p = this.player, g = this.game, w = this.world;
    const id = w.getBlock(x, y, z);
    if (!id) return;
    const def = BLOCKS[id];
    if (def.hardness < 0 && p.gameMode !== 1) return;
    const meta = w.getMeta(x, y, z);
    const stack = p.inventory.selected();
    g.particles && g.particles.blockBreak(x, y, z, def, meta);
    g.sound.blockSound(def, 'break', x + 0.5, y + 0.5, z + 0.5);
    if (p.gameMode !== 1 && g.rules.doTileDrops) g.blockLogic.dropBlock(def, meta, x, y, z, p, stack);
    if (p.gameMode !== 1) {
      if (stack && stack.item.tool && stack.item.durability) {
        const dmg = stack.item.tool.type === 'sword' ? 2 : 1;
        if (def.hardness > 0 || stack.item.tool.type === 'shears') if (stack.hurt(dmg)) { p.inventory.setSelected(stack.count > 0 ? stack : null); g.sound.play('entity.item.break'); }
      }
      p.food.exhaust(0.005);
      p.statistics.blocksMined++;
    }
    g.blockLogic.removeBlock(x, y, z, def, meta);
    if (def.kind === 'ice' && p.gameMode !== 1) {
      const below = BLOCKS[w.getBlock(x, y - 1, z)];
      if (below.solid || below.kind === 'liquid') w.setBlock(x, y, z, WATER, 0);
    }
    if (def.name === 'tnt' && p.gameMode === 1) { /* nothing */ }
  }

  // ------------------------------------------------------------ use
  onUse(first) {
    const p = this.player, g = this.game;
    if (p.gameMode === 3) return;
    this.useCooldown = 4;
    for (const hand of ['main', 'off']) {
      const stack = hand === 'main' ? p.inventory.selected() : p.inventory.offhand();
      if (this.useWith(stack, hand, first)) { p.swing(); return; }
    }
  }

  useWith(stack, hand, first) {
    const p = this.player, g = this.game, w = this.world;
    const e = this.targetEntity;
    // interact with entities
    if (e && e.interact) { if (e.interact(p, stack, hand)) return true; }
    const t = this.target;
    if (t) {
      // block interactions (unless sneaking with an item)
      if (hand === 'main' && g.blockLogic.use(p, t, stack)) return true;
      if (stack && !stack.isEmpty()) {
        if (this.useItemOnBlock(stack, t, hand)) return true;
        if (p.gameMode === 2) return false;
        if (stack.item.block || stack.item.places) {
          if (g.blockLogic.place(p, stack, t)) {
            if (p.gameMode !== 1) { stack.count--; if (stack.count <= 0) this.setHand(hand, null); }
            return true;
          }
          if (!stack.item.food) return false;
        }
      }
    }
    if (stack && !stack.isEmpty()) return this.useItemInAir(stack, hand, first);
    return false;
  }

  setHand(hand, s) { const inv = this.player.inventory; if (hand === 'main') inv.setSelected(s); else inv.set(40, s); }

  useItemOnBlock(stack, t, hand) {
    const p = this.player, g = this.game, w = this.world;
    const it = stack.item;
    const def = BLOCKS[t.id];
    const nx = t.x + FACE_DIRS[t.face][0], ny = t.y + FACE_DIRS[t.face][1], nz = t.z + FACE_DIRS[t.face][2];
    const tool = it.tool;
    const damageTool = (n = 1) => { if (p.gameMode !== 1 && stack.hurt(n)) { this.setHand(hand, stack.count > 0 ? stack : null); g.sound.play('entity.item.break'); } };
    if (tool && tool.type === 'hoe' && (def.name === 'grass_block' || def.name === 'dirt' || def.name === 'dirt_path' || def.name === 'coarse_dirt' || def.name === 'rooted_dirt') && t.face !== 0 && w.getBlock(t.x, t.y + 1, t.z) === 0) {
      w.setBlock(t.x, t.y, t.z, def.name === 'coarse_dirt' ? BLOCK.dirt.id : def.name === 'rooted_dirt' ? BLOCK.dirt.id : BLOCK.farmland.id, 0);
      if (def.name === 'rooted_dirt') g.dropItem(nx + 0.5, ny + 0.5, nz + 0.5, new ItemStack('hanging_roots' in ITEM ? 'hanging_roots' : 'stick', 1));
      g.sound.at('item.hoe.till', t.x + 0.5, t.y + 0.5, t.z + 0.5); damageTool(); return true;
    }
    if (tool && tool.type === 'shovel' && (def.name === 'grass_block' || def.name === 'dirt' || def.name === 'coarse_dirt' || def.name === 'podzol' || def.name === 'mycelium' || def.name === 'rooted_dirt') && t.face !== 0 && w.getBlock(t.x, t.y + 1, t.z) === 0) {
      w.setBlock(t.x, t.y, t.z, BLOCK.dirt_path.id, 0); g.sound.at('item.shovel.flatten', t.x + 0.5, t.y + 0.5, t.z + 0.5); damageTool(); return true;
    }
    if (tool && tool.type === 'shovel' && def.kind === 'campfire') { return false; }
    if (tool && tool.type === 'axe' && def.strip && BLOCK[def.strip]) {
      w.setBlock(t.x, t.y, t.z, BLOCK[def.strip].id, t.meta); g.sound.at('item.axe.strip', t.x + 0.5, t.y + 0.5, t.z + 0.5); damageTool(); return true;
    }
    if (it.name === 'shears' && def.name === 'pumpkin') {
      const hf = (Math.floor((p.yaw * 180 / Math.PI) * 4 / 360 + 0.5) + 2) & 3;
      w.setBlock(t.x, t.y, t.z, BLOCK.carved_pumpkin.id, hf);
      g.dropItem(nx + 0.5, ny + 0.5, nz + 0.5, new ItemStack('pumpkin_seeds', 4));
      g.sound.at('block.pumpkin.carve', t.x + 0.5, t.y + 0.5, t.z + 0.5); damageTool(); return true;
    }
    if (it.name === 'bone_meal') {
      if (g.blockLogic.boneMeal(t.x, t.y, t.z) || (t.face !== 0 && w.getBlock(nx, ny, nz) === WATER && g.blockLogic.boneMeal(nx, ny, nz))) {
        if (p.gameMode !== 1) stack.count--;
        if (stack.count <= 0) this.setHand(hand, null);
        g.sound.at('item.bone_meal.use', t.x + 0.5, t.y + 0.5, t.z + 0.5);
        return true;
      }
      return false;
    }
    if (it.kind === 'flint_and_steel' || it.kind === 'fire_charge') {
      if (def.kind === 'tnt') { g.blockLogic.igniteTnt(t.x, t.y, t.z, p); }
      else if (def.kind === 'campfire') { /* already lit */ }
      else if (def.kind === 'candle') w.setMeta(t.x, t.y, t.z, t.meta | 4);
      else if (def.name === 'obsidian' && g.tryLightPortal && g.tryLightPortal(nx, ny, nz)) { /* portal */ }
      else if (w.getBlock(nx, ny, nz) === 0) w.setBlock(nx, ny, nz, BLOCK.fire.id, 0);
      else return false;
      g.sound.at(it.kind === 'fire_charge' ? 'item.firecharge.use' : 'item.flintandsteel.use', t.x + 0.5, t.y + 0.5, t.z + 0.5);
      if (it.kind === 'fire_charge') { if (p.gameMode !== 1) stack.count--; if (stack.count <= 0) this.setHand(hand, null); }
      else damageTool();
      return true;
    }
    if (it.kind === 'bucket') return this.useBucket(stack, hand, t);
    if (it.kind === 'glass_bottle') return false;
    if (it.kind === 'spawn_egg') {
      const sx = (def.solid ? nx : t.x) + 0.5, sy = def.solid ? ny : t.y, sz = (def.solid ? nz : t.z) + 0.5;
      if (BLOCKS[t.id].name === 'spawner') { w.setBlockEntity(t.x, t.y, t.z, { type: 'spawner', mob: it.mob, delay: 200 }); if (p.gameMode !== 1) stack.count--; return true; }
      g.spawnMob(it.mob, sx, sy, sz, { fromEgg: true });
      if (p.gameMode !== 1) { stack.count--; if (stack.count <= 0) this.setHand(hand, null); }
      return true;
    }
    if (it.kind === 'boat' || it.kind === 'minecart') {
      g.showActionbar('Boats and minecarts are decorative in Minecraft_Lite');
      return false;
    }
    if (it.places === 'redstone_wire' || it.places) return false;
    return false;
  }

  useBucket(stack, hand, t) {
    const p = this.player, g = this.game, w = this.world;
    const it = stack.item;
    const [ex, ey, ez] = g.eyePos(1);
    const [dx, dy, dz] = g.lookDir();
    if (it.name === 'bucket') {
      const hit = raycastBlocks(w, ex, ey, ez, dx, dy, dz, this.reach(), { fluids: true, sourceOnly: true });
      if (!hit || BLOCKS[hit.id].kind !== 'liquid' || hit.meta !== 0) return false;
      const fluid = BLOCKS[hit.id].fluid;
      w.setBlock(hit.x, hit.y, hit.z, 0, 0);
      g.sound.at(fluid === 'water' ? 'item.bucket.fill' : 'item.bucket.fill_lava', hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      if (p.gameMode === 1) { if (!p.inventory.count(fluid + '_bucket')) p.inventory.add(new ItemStack(fluid + '_bucket', 1)); return true; }
      const full = new ItemStack(fluid + '_bucket', 1);
      stack.count--;
      if (stack.count <= 0) this.setHand(hand, full);
      else if (p.inventory.add(full) > 0) g.dropFromPlayer(full);
      return true;
    }
    if (it.fluid === 'water' || it.fluid === 'lava') {
      if (!t) return false;
      const def = BLOCKS[t.id];
      let x = t.x, y = t.y, z = t.z;
      if (!def.replaceable) { x += FACE_DIRS[t.face][0]; y += FACE_DIRS[t.face][1]; z += FACE_DIRS[t.face][2]; }
      const cur = BLOCKS[w.getBlock(x, y, z)];
      if (!cur.replaceable && cur.kind !== 'liquid') return false;
      const fid = BLOCK[it.fluid].id;
      if (cur.kind !== 'liquid' && cur.id !== 0) g.blockLogic.dropBlock(cur, w.getMeta(x, y, z), x, y, z, null, null);
      w.setBlock(x, y, z, fid, 0);
      w.scheduleTick(x, y, z, it.fluid === 'water' ? 5 : 30);
      g.sound.at(it.fluid === 'water' ? 'item.bucket.empty' : 'item.bucket.empty_lava', x + 0.5, y + 0.5, z + 0.5);
      if (p.gameMode !== 1) this.setHand(hand, new ItemStack('bucket', 1));
      return true;
    }
    return false;
  }

  useItemInAir(stack, hand, first) {
    const p = this.player, g = this.game;
    const it = stack.item;
    if (it.food || it.kind === 'milk' || it.kind === 'potion') {
      const canEat = p.gameMode === 1 || (it.food && (it.food.alwaysEdible || p.food.needsFood())) || it.kind === 'milk' || it.kind === 'potion';
      if (!canEat) return false;
      p.useItem = stack; p.useTicks = 0; p.useHand = hand; p.useDuration = it.food ? (it.food.eatTicks || 32) : 32;
      return true;
    }
    if (it.kind === 'bow' || it.kind === 'crossbow') {
      if (p.gameMode !== 1 && !p.inventory.count('arrow') && !p.inventory.count('spectral_arrow')) return false;
      p.useItem = stack; p.useTicks = 0; p.useHand = hand; p.useDuration = 72000;
      return true;
    }
    if (it.kind === 'shield') { p.useItem = stack; p.useTicks = 0; p.useHand = hand; p.useDuration = 72000; return true; }
    if (it.kind === 'trident') { p.useItem = stack; p.useTicks = 0; p.useHand = hand; p.useDuration = 72000; return true; }
    if (it.kind === 'spyglass') { p.useItem = stack; p.useTicks = 0; p.useHand = hand; p.useDuration = 1200; return true; }
    if (it.kind === 'snowball' || it.kind === 'egg' || it.kind === 'ender_pearl') {
      if (!first && it.kind === 'ender_pearl') return false;
      const [ex, ey, ez] = g.eyePos(1);
      const [dx, dy, dz] = g.lookDir();
      const pr = new Projectile(g, ex, ey - 0.1, ez, it.kind, p);
      pr.shoot(dx, dy, dz, 1.5, 1);
      g.spawn(pr);
      g.sound.at(it.kind === 'ender_pearl' ? 'entity.ender_pearl.throw' : 'entity.snowball.throw', p.x, p.y, p.z, 0.5, 0.4);
      if (p.gameMode !== 1) { stack.count--; if (stack.count <= 0) this.setHand(hand, null); }
      return true;
    }
    if (it.armor) {
      const slot = p.inventory.armorSlotFor(it.armor.slot);
      const cur = p.inventory.slots[slot];
      p.inventory.slots[slot] = stack.copy(1);
      stack.count--;
      this.setHand(hand, stack.count > 0 ? stack : cur);
      g.sound.play('item.armor.equip_' + (it.armor.material || 'generic'));
      return true;
    }
    if (it.kind === 'bucket') return this.useBucket(stack, hand, this.target);
    if (it.kind === 'glass_bottle') {
      const [ex, ey, ez] = g.eyePos(1);
      const [dx, dy, dz] = g.lookDir();
      const hit = raycastBlocks(this.world, ex, ey, ez, dx, dy, dz, this.reach(), { fluids: true });
      if (hit && hit.id === WATER) {
        stack.count--;
        const wb = new ItemStack('water_bottle', 1);
        if (stack.count <= 0) this.setHand(hand, wb); else if (p.inventory.add(wb) > 0) g.dropFromPlayer(wb);
        g.sound.play('item.bottle.fill');
        return true;
      }
      return false;
    }
    if (it.kind === 'experience_bottle' || it.name === 'experience_bottle') {
      g.spawnXp(p.x, p.y + 1, p.z, 3 + Math.floor(Math.random() * 9));
      if (p.gameMode !== 1) { stack.count--; if (stack.count <= 0) this.setHand(hand, null); }
      return true;
    }
    if (it.name === 'firework_rocket' && p.flying === false) return false;
    return false;
  }

  tickUse(p) {
    const g = this.game;
    const s = p.useItem;
    const handStack = p.useHand === 'main' ? p.inventory.selected() : p.inventory.offhand();
    if (!s || handStack !== s || s.count <= 0) { p.useItem = null; return; }
    p.useTicks++;
    const it = s.item;
    if (it.food || it.kind === 'milk' || it.kind === 'potion') {
      if (p.useTicks % 4 === 0 && p.useTicks > 4 && p.useTicks < p.useDuration - 2) {
        g.sound.play(it.drink || it.kind === 'milk' ? 'entity.generic.drink' : 'entity.generic.eat', 0.5, 0.9 + Math.random() * 0.2);
        if (!it.drink && it.kind !== 'milk' && g.particles) g.particles.eatParticles(p, it);
      }
      if (p.useTicks >= p.useDuration) this.finishUse(p, s);
    }
  }

  finishUse(p, s) {
    const g = this.game;
    const it = s.item;
    if (it.kind === 'milk') { p.effects.clear(); p.absorption = 0; if (p.gameMode !== 1) this.setHand(p.useHand, new ItemStack('bucket', 1)); g.sound.play('entity.generic.drink'); p.useItem = null; return; }
    if (it.food) {
      p.food.add(it.food.n, it.food.s);
      for (const [eff, dur, amp, chance] of it.food.effects) if (chance === undefined || Math.random() < chance) p.addEffect(eff, dur, amp);
      if (it.name === 'chorus_fruit') g.chorusTeleport && g.chorusTeleport(p);
      g.sound.play(it.drink ? 'entity.generic.drink' : 'entity.player.burp', 0.5, 0.9 + Math.random() * 0.1);
    }
    if (p.gameMode !== 1) {
      s.count--;
      const rem = it.bowl ? 'bowl' : it.bottle ? 'glass_bottle' : null;
      if (s.count <= 0) this.setHand(p.useHand, rem ? new ItemStack(rem, 1) : null);
      else if (rem && p.inventory.add(new ItemStack(rem, 1)) > 0) g.dropFromPlayer(new ItemStack(rem, 1));
    }
    p.useItem = null;
  }

  releaseUse() {
    const p = this.player, g = this.game;
    const s = p.useItem;
    if (!s) return;
    const it = s.item;
    if (it.kind === 'bow') {
      const t = p.useTicks;
      let f = t / 20;
      f = (f * f + f * 2) / 3;
      if (f > 1) f = 1;
      if (f >= 0.1) {
        const spectral = p.inventory.count('arrow') === 0 && p.inventory.count('spectral_arrow') > 0;
        const [ex, ey, ez] = g.eyePos(1);
        const [dx, dy, dz] = g.lookDir();
        const a = new Projectile(g, ex, ey - 0.1, ez, spectral ? 'spectral_arrow' : 'arrow', p);
        a.shoot(dx, dy, dz, f * 3, 1);
        if (f === 1) a.crit = true;
        if (p.gameMode === 1) a.pickup = 0;
        g.spawn(a);
        g.sound.at('entity.arrow.shoot', p.x, p.y, p.z, 1, 1 / (Math.random() * 0.4 + 1.2) + f * 0.5);
        if (p.gameMode !== 1) {
          p.inventory.removeItem(spectral ? 'spectral_arrow' : 'arrow', 1);
          if (s.hurt(1)) { this.setHand(p.useHand, null); g.sound.play('entity.item.break'); }
        }
      }
    } else if (it.kind === 'crossbow' && p.useTicks >= 25) {
      const [ex, ey, ez] = g.eyePos(1);
      const [dx, dy, dz] = g.lookDir();
      const a = new Projectile(g, ex, ey - 0.1, ez, 'arrow', p);
      a.shoot(dx, dy, dz, 3.15, 1); a.damage = 3;
      g.spawn(a);
      g.sound.at('item.crossbow.shoot', p.x, p.y, p.z);
      if (p.gameMode !== 1) { p.inventory.removeItem('arrow', 1); if (s.hurt(1)) this.setHand(p.useHand, null); }
    } else if (it.kind === 'trident' && p.useTicks >= 10) {
      const [ex, ey, ez] = g.eyePos(1);
      const [dx, dy, dz] = g.lookDir();
      const a = new Projectile(g, ex, ey - 0.1, ez, 'arrow', p);
      a.shoot(dx, dy, dz, 2.5, 1); a.damage = 8; a.pickup = 0;
      g.spawn(a);
      g.sound.at('item.trident.throw', p.x, p.y, p.z);
    }
    p.useItem = null;
  }

  pickBlock() {
    const p = this.player;
    const t = this.target;
    if (!t) return;
    const def = BLOCKS[t.id];
    const it = def.pick ? ITEM[def.pick] : itemOfBlock(def);
    if (!it) return;
    const inv = p.inventory;
    for (let i = 0; i < 9; i++) if (inv.slots[i] && inv.slots[i].item === it) { inv.selectedSlot = i; return; }
    if (p.gameMode === 1) {
      let slot = inv.selectedSlot;
      if (inv.slots[slot]) { for (let i = 0; i < 9; i++) if (!inv.slots[i]) { slot = i; break; } }
      inv.selectedSlot = slot;
      inv.slots[slot] = new ItemStack(it, 1);
    } else {
      const i = inv.find((s) => s.item === it);
      if (i >= 9) { const t2 = inv.slots[inv.selectedSlot]; inv.slots[inv.selectedSlot] = inv.slots[i]; inv.slots[i] = t2; }
    }
  }
}

export { AABB };
