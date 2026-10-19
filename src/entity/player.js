// The player: inventory, game modes, hunger, experience, movement input.
import { LivingEntity } from './living.js';
import { PlayerInventory } from '../game/inventory.js';
import { hasCollision, AABB } from './physics.js';
import { ItemStack } from '../game/itemstack.js';

export const GAMEMODES = ['survival', 'creative', 'adventure', 'spectator'];

export class FoodData {
  constructor(player) { this.p = player; this.level = 20; this.saturation = 5; this.exhaustion = 0; this.timer = 0; this.prevLevel = 20; }
  add(n, sat) { this.level = Math.min(20, this.level + n); this.saturation = Math.min(this.level, this.saturation + sat); }
  eat(food) { this.add(food.n, food.n * food.s / food.n || food.s); }
  exhaust(n) { this.exhaustion = Math.min(40, this.exhaustion + n); }
  needsFood() { return this.level < 20; }
  tick() {
    const p = this.p, g = p.game;
    const diff = g.difficulty;
    this.prevLevel = this.level;
    if (this.exhaustion > 4) {
      this.exhaustion -= 4;
      if (this.saturation > 0) this.saturation = Math.max(this.saturation - 1, 0);
      else if (diff !== 0) this.level = Math.max(this.level - 1, 0);
    }
    const regen = g.rules.naturalRegeneration;
    const hurtP = p.health > 0 && p.health < p.maxHealth;
    if (regen && this.saturation > 0 && hurtP && this.level >= 20) {
      if (++this.timer >= 10) { const f = Math.min(this.saturation, 6); p.heal(f / 6); this.exhaust(f); this.timer = 0; }
    } else if (regen && this.level >= 18 && hurtP) {
      if (++this.timer >= 80) { p.heal(1); this.exhaust(6); this.timer = 0; }
    } else if (this.level <= 0) {
      if (++this.timer >= 80) {
        if (p.health > 10 || diff >= 3 || (p.health > 1 && diff === 2)) p.hurt({ type: 'starve', bypassArmor: true }, 1);
        this.timer = 0;
      }
    } else this.timer = 0;
  }
}

export class Player extends LivingEntity {
  constructor(game, x, y, z) {
    super(game, x, y, z);
    this.type = 'player';
    this.isPlayer = true;
    this.name = 'Player';
    this.width = 0.6; this.height = 1.8;
    this.inventory = new PlayerInventory(this);
    this.gameMode = 0;
    this.flySpeed = 0.05;
    this.mayfly = false;
    this.food = new FoodData(this);
    this.xpLevel = 0; this.xpProgress = 0; this.xpTotal = 0;
    this.spawnX = null; this.spawnY = null; this.spawnZ = null;
    this.attackTicker = 100;
    this.useItem = null; this.useTicks = 0; this.useHand = 'main';
    this.jumpTriggerTime = 0;
    this.sprintTriggerTime = 0;
    this.eyeH = 1.62; this.prevEyeH = 1.62;
    this.input = { forward: 0, strafe: 0, jump: false, sneak: false, sprint: false };
    this.wasJumpDown = false; this.wasForwardDown = false;
    this.score = 0;
    this.sleeping = false; this.sleepTimer = 0;
    this.portalTime = 0;
    this.statistics = { blocksMined: 0, mobsKilled: 0, deaths: 0, jumps: 0, distance: 0, playTime: 0, damageDealt: 0, damageTaken: 0, itemsCrafted: 0 };
    this.lastDamageSource = null;
    this.hurtDir = 0;
  }
  get eyeHeight() { return this.sneaking && !this.flying ? 1.27 : 1.62; }
  get creative() { return this.gameMode === 1; }
  get spectator() { return this.gameMode === 3; }
  get survivalLike() { return this.gameMode === 0 || this.gameMode === 2; }

  setGameMode(m) {
    this.gameMode = m;
    this.mayfly = m === 1 || m === 3;
    if (!this.mayfly) this.flying = false;
    if (m === 3) this.flying = true;
    this.noPhysics = m === 3;
    this.invulnerable = m === 1 || m === 3;
  }

  // ---------- damage ----------
  armorValue() {
    let a = 0;
    for (const s of this.inventory.armor()) if (s && s.item.armor) a += s.item.armor.points;
    return a;
  }
  armorToughness() {
    let t = 0;
    for (const s of this.inventory.armor()) if (s && s.item.armor) t += s.item.armor.toughness;
    return t;
  }
  damageArmor(amount) {
    const d = Math.max(1, Math.floor(amount / 4));
    const inv = this.inventory;
    for (let i = 36; i < 40; i++) {
      const s = inv.slots[i];
      if (s && s.item.armor && s.item.durability) {
        if (s.hurt(d)) { inv.slots[i] = null; this.game.sound.play('entity.item.break'); }
      }
    }
  }
  isBlocking() {
    if (!this.useItem || this.useItem.item.kind !== 'shield' || this.useTicks < 5) return false;
    return true;
  }
  hurt(src, amount) {
    if (this.gameMode === 1 || this.gameMode === 3) { if (src.type !== 'void' && src.type !== 'kill') return false; if (this.gameMode === 1 && src.type === 'void' && this.y > -128) return false; }
    if (this.game.difficulty === 0 && src.attacker && src.attacker.hostile) return false;
    if (src.attacker && src.attacker.hostile && src.type !== 'arrow') {
      if (this.game.difficulty === 1) amount = Math.min(amount / 2 + 1, amount);
      else if (this.game.difficulty === 3) amount = amount * 3 / 2;
    }
    if (src.type === 'fall' && !this.game.rules.fallDamage) return false;
    if ((src.type === 'fire' || src.type === 'onFire' || src.type === 'lava') && !this.game.rules.fireDamage) return false;
    if (src.type === 'drown' && !this.game.rules.drowningDamage) return false;
    const ok = super.hurt(src, amount);
    if (ok) {
      this.food.exhaust(0.1);
      this.statistics.damageTaken += amount;
      if (src.attacker) this.hurtDir = Math.atan2(src.attacker.z - this.z, src.attacker.x - this.x) - this.yaw;
      else this.hurtDir = 0;
    }
    return ok;
  }
  onHurt(src, dmg, flash) {
    if (flash) this.game.sound.play('entity.player.hurt' + (src.type === 'onFire' || src.type === 'fire' || src.type === 'lava' ? '_on_fire' : src.type === 'drown' ? '_drown' : ''));
    this.game.onPlayerHurt && this.game.onPlayerHurt(src, dmg);
  }
  die(src) {
    if (this.dead) return;
    // totem of undying
    for (const hand of ['main', 'off']) {
      const s = hand === 'main' ? this.inventory.selected() : this.inventory.slots[40];
      if (s && s.item.name === 'totem_of_undying' && src.type !== 'void' && src.type !== 'kill') {
        s.count--; if (s.count <= 0) { if (hand === 'main') this.inventory.slots[this.inventory.selectedSlot] = null; else this.inventory.slots[40] = null; }
        this.health = 1; this.effects.clear();
        this.addEffect('regeneration', 900, 1); this.addEffect('absorption', 100, 1); this.addEffect('fire_resistance', 800, 0);
        this.game.onTotem && this.game.onTotem();
        return;
      }
    }
    super.die(src);
  }
  onDeath(src) {
    this.statistics.deaths++;
    this.useItem = null;
    const g = this.game;
    if (!g.rules.keepInventory) {
      for (let i = 0; i < this.inventory.slots.length; i++) {
        const s = this.inventory.slots[i];
        if (s && !s.isEmpty()) g.dropItem(this.x, this.y + 1, this.z, s, { scatter: true });
        this.inventory.slots[i] = null;
      }
      const xp = Math.min(this.xpLevel * 7, 100);
      if (xp > 0) g.spawnXp(this.x, this.y + 0.5, this.z, xp);
      this.score = this.xpTotal;
      this.xpLevel = 0; this.xpProgress = 0; this.xpTotal = 0;
    }
    g.onPlayerDeath(src);
  }

  // ---------- experience ----------
  xpBarCap() { const l = this.xpLevel; return l >= 30 ? 112 + (l - 30) * 9 : l >= 15 ? 37 + (l - 15) * 5 : 7 + l * 2; }
  addXp(n) {
    this.xpTotal += n;
    this.xpProgress += n / this.xpBarCap();
    while (this.xpProgress >= 1) {
      this.xpProgress = (this.xpProgress - 1) * this.xpBarCap();
      this.xpLevel++;
      this.xpProgress /= this.xpBarCap();
      if (this.xpLevel % 5 === 0) this.game.sound.play('entity.player.levelup', 0.75);
    }
  }
  addLevels(n) {
    this.xpLevel = Math.max(0, this.xpLevel + n);
    if (this.xpLevel === 0) this.xpProgress = 0;
  }
  pickupXp(orb) {
    orb.remove();
    this.game.sound.play('entity.experience_orb.pickup', 0.1, 0.5 + Math.random() * 0.8);
    this.addXp(orb.value);
  }

  // ---------- tick ----------
  tick() {
    const inp = this.input;
    const g = this.game;
    this.prevEyeH = this.eyeH;
    if (this.dead) { super.tick(); return; }
    // flying toggle (double tap jump)
    if (inp.jump && !this.wasJumpDown && this.mayfly) {
      if (this.jumpTriggerTime > 0) { this.flying = !this.flying || this.gameMode === 3; this.jumpTriggerTime = 0; if (this.gameMode === 3) this.flying = true; }
      else this.jumpTriggerTime = 7;
    }
    if (this.jumpTriggerTime > 0) this.jumpTriggerTime--;
    this.wasJumpDown = inp.jump;
    if (this.flying && this.onGround && !inp.jump && this.gameMode !== 3) this.flying = false;
    // sneaking
    this.sneaking = inp.sneak && !this.flying;
    this.sneakEdge = this.sneaking && !this.flying;
    // stand up blocked? keep sneaking pose under low ceilings
    if (!this.sneaking && this.wasSneaking && !this.flying && this.onGround) {
      if (hasCollision(this.world, AABB.ofEntity(this.x, this.y, this.z, 0.6, 1.8).grow(-0.001))) this.sneaking = true;
    }
    this.wasSneaking = this.sneaking;
    this.height = this.sneaking ? 1.5 : 1.8;
    // movement input
    let fwd = inp.forward, str = inp.strafe;
    if (this.sneaking) { fwd *= 0.3; str *= 0.3; }
    if (this.useItem && this.useItem.item.kind !== 'shield_never') { fwd *= 0.2; str *= 0.2; }
    if (this.sleeping) { fwd = 0; str = 0; }
    // sprinting
    const canSprint = (this.food.level > 6 || this.mayfly) && !this.useItem && !this.hasEffect('blindness');
    if (!this.sprinting && inp.sprint && inp.forward > 0.8 && canSprint && !this.sneaking) this.sprinting = true;
    if (this.sprinting && (inp.forward <= 0.8 || this.collidedH || !canSprint || (this.sneaking && !this.flying))) this.sprinting = false;
    // flight vertical
    if (this.flying) {
      if (inp.sneak) this.vy -= this.flySpeed * 3;
      if (inp.jump) this.vy += this.flySpeed * 3;
    }
    this.forward = fwd; this.strafe = str;
    this.jumping = inp.jump && !this.flying;
    const ox = this.x, oz = this.z, oy = this.y;
    const wasGround = this.onGround;
    super.tick();
    if (this.removed) return;
    // jump stats / exhaustion
    if (wasGround && !this.onGround && this.vy > 0 && this.jumping) { this.statistics.jumps++; this.food.exhaust(this.sprinting ? 0.2 : 0.05); }
    const moved = Math.sqrt((this.x - ox) ** 2 + (this.z - oz) ** 2);
    this.statistics.distance += moved;
    if (this.survivalLike) {
      if (this.inWater && this.eyeInWater) this.food.exhaust(0.01 * moved * 100 / 100);
      else if (this.sprinting) this.food.exhaust(0.1 * moved);
      if (g.difficulty === 0 && g.rules.naturalRegeneration) {
        if (this.age % 20 === 0 && this.health < this.maxHealth) this.heal(1);
        if (this.age % 10 === 0 && this.food.level < 20) this.food.level++;
      }
      this.food.tick();
    }
    void oy;
    this.attackTicker++;
    // eye height smoothing
    const target = this.eyeHeight;
    this.eyeH += (target - this.eyeH) * 0.5;
    // item pickup
    if (!this.dead && this.gameMode !== 3) this.pickupItems();
    // using items
    if (this.useItem) g.interaction.tickUse(this);
    this.statistics.playTime++;
  }

  pickupItems() {
    const pb = this.box.grow(1);
    pb.y0 += 0.5; pb.y1 -= 0.5;
    for (const e of this.game.entities) {
      if (e.type !== 'item' || e.removed || e.pickupDelay > 0) continue;
      if (!pb.intersects(e.box)) continue;
      const before = e.stack.count;
      const left = this.inventory.add(e.stack);
      if (left < before) {
        this.game.sound.play('entity.item.pickup', 0.2, 1 + (Math.random() - Math.random()) * 0.7);
        this.game.onPickup && this.game.onPickup(e, before - left);
      }
      if (left === 0) e.remove();
    }
  }

  attackCooldown(partial = 0) {
    const s = this.inventory.selected();
    const speed = s && s.item.attackSpeed ? s.item.attackSpeed : 4;
    const delay = 20 / speed;
    return Math.min(1, (this.attackTicker + partial) / delay);
  }

  respawnPos() {
    if (this.spawnX !== null) return [this.spawnX, this.spawnY, this.spawnZ];
    const s = this.game.worldSpawn;
    return [s.x, s.y, s.z];
  }

  save() {
    return {
      x: this.x, y: this.y, z: this.z, yaw: this.yaw, pitch: this.pitch, health: this.health, food: this.food.level, sat: this.food.saturation,
      exh: this.food.exhaustion, xpLevel: this.xpLevel, xpProgress: this.xpProgress, xpTotal: this.xpTotal, gameMode: this.gameMode, flying: this.flying,
      inventory: this.inventory.slots.map((s) => (s && !s.isEmpty() ? s.toJSON() : null)), selected: this.inventory.selectedSlot, air: this.air,
      spawn: this.spawnX !== null ? [this.spawnX, this.spawnY, this.spawnZ] : null, fire: this.fireTicks,
      effects: [...this.effects].map(([n, e]) => [n, e.duration, e.amp]), stats: this.statistics, absorption: this.absorption,
      enderChest: this.enderChest ? this.enderChest.map((s) => (s ? s.toJSON() : null)) : null,
    };
  }
  load(d) {
    this.teleport(d.x, d.y, d.z);
    this.yaw = d.yaw || 0; this.pitch = d.pitch || 0;
    this.health = d.health ?? 20; this.food.level = d.food ?? 20; this.food.saturation = d.sat ?? 5; this.food.exhaustion = d.exh || 0;
    this.xpLevel = d.xpLevel || 0; this.xpProgress = d.xpProgress || 0; this.xpTotal = d.xpTotal || 0;
    this.setGameMode(d.gameMode ?? 0);
    this.flying = !!d.flying && this.mayfly;
    if (d.inventory) d.inventory.forEach((s, i) => { this.inventory.slots[i] = s ? ItemStack.fromJSON(s) : null; });
    this.inventory.selectedSlot = d.selected || 0;
    this.air = d.air ?? 300;
    if (d.spawn) [this.spawnX, this.spawnY, this.spawnZ] = d.spawn;
    this.fireTicks = d.fire || 0;
    if (d.effects) for (const [n, dur, amp] of d.effects) this.addEffect(n, dur, amp);
    if (d.stats) Object.assign(this.statistics, d.stats);
    this.absorption = d.absorption || 0;
    if (d.enderChest) this.enderChest = d.enderChest.map((s) => (s ? ItemStack.fromJSON(s) : null));
  }
}
