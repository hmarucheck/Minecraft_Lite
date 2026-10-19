// LivingEntity: health, damage, armor, effects, Minecraft-style movement.
import { Entity } from './entity.js';
import { BLOCKS } from '../registry/blocks.js';
import { AABB, hasCollision } from './physics.js';

export const EFFECTS = {
  speed: { name: 'Speed', good: true, color: 0x7cafc6 }, slowness: { name: 'Slowness', color: 0x5a6c81 },
  haste: { name: 'Haste', good: true, color: 0xd9c043 }, mining_fatigue: { name: 'Mining Fatigue', color: 0x4a4217 },
  strength: { name: 'Strength', good: true, color: 0x932423 }, instant_health: { name: 'Instant Health', good: true, instant: true, color: 0xf82423 },
  instant_damage: { name: 'Instant Damage', instant: true, color: 0x430a09 }, jump_boost: { name: 'Jump Boost', good: true, color: 0x22ff4c },
  nausea: { name: 'Nausea', color: 0x551d4a }, regeneration: { name: 'Regeneration', good: true, color: 0xcd5cab },
  resistance: { name: 'Resistance', good: true, color: 0x99453a }, fire_resistance: { name: 'Fire Resistance', good: true, color: 0xe49a3a },
  water_breathing: { name: 'Water Breathing', good: true, color: 0x2e5299 }, invisibility: { name: 'Invisibility', good: true, color: 0x7f8392 },
  blindness: { name: 'Blindness', color: 0x1f1f23 }, night_vision: { name: 'Night Vision', good: true, color: 0x1f1fa1 },
  hunger: { name: 'Hunger', color: 0x587653 }, weakness: { name: 'Weakness', color: 0x484d48 }, poison: { name: 'Poison', color: 0x4e9331 },
  wither: { name: 'Wither', color: 0x352a27 }, health_boost: { name: 'Health Boost', good: true, color: 0xf87d23 },
  absorption: { name: 'Absorption', good: true, color: 0x2552a5 }, saturation: { name: 'Saturation', good: true, instant: true, color: 0xf82423 },
  glowing: { name: 'Glowing', color: 0x94a061 }, levitation: { name: 'Levitation', color: 0xceffff }, luck: { name: 'Luck', good: true, color: 0x339900 },
  slow_falling: { name: 'Slow Falling', good: true, color: 0xf7f8e0 }, darkness: { name: 'Darkness', color: 0x292721 },
};

export class LivingEntity extends Entity {
  constructor(game, x, y, z) {
    super(game, x, y, z);
    this.maxHealth = 20; this.health = 20;
    this.hurtTime = 0; this.invulnerableTime = 0; this.lastHurtAmount = 0;
    this.deathTime = 0; this.dead = false;
    this.effects = new Map();
    this.air = 300; this.maxAir = 300;
    this.absorption = 0;
    this.forward = 0; this.strafe = 0; this.jumping = false; this.sneaking = false; this.sprinting = false;
    this.movementSpeed = 0.1;
    this.bodyYaw = 0; this.prevBodyYaw = 0; this.headYaw = 0; this.prevHeadYaw = 0;
    this.limbSwing = 0; this.limbAmount = 0; this.prevLimbAmount = 0;
    this.swingProgress = 0; this.prevSwingProgress = 0; this.swingTicks = -1;
    this.noJumpDelay = 0;
    this.stepHeight = 0.6;
    this.lastAttacker = null; this.lastAttackerTime = 0;
    this.attackDamage = 1;
    this.knockbackResistance = 0;
    this.flying = false;
    this.onLadder = false;
  }
  get alive() { return !this.dead && !this.removed; }

  // ---------- effects ----------
  addEffect(name, duration, amp = 0, opts = {}) {
    const info = EFFECTS[name];
    if (!info) return false;
    if (info.instant) { this.applyInstant(name, amp); return true; }
    const cur = this.effects.get(name);
    if (cur && (cur.amp > amp || (cur.amp === amp && cur.duration > duration))) return false;
    this.effects.set(name, { amp, duration, ambient: !!opts.ambient, particles: opts.particles !== false });
    if (name === 'absorption') this.absorption = Math.max(this.absorption, 4 * (amp + 1));
    if (name === 'health_boost') this.maxHealth = 20 + 4 * (amp + 1);
    return true;
  }
  applyInstant(name, amp) {
    if (name === 'instant_health') this.heal(4 << amp);
    else if (name === 'instant_damage') this.hurt({ type: 'magic', bypassArmor: true }, 6 << amp);
    else if (name === 'saturation' && this.food) { this.food.add(amp + 1, (amp + 1) * 2); }
  }
  hasEffect(n) { return this.effects.has(n); }
  effectAmp(n) { const e = this.effects.get(n); return e ? e.amp : -1; }
  removeEffect(n) {
    this.effects.delete(n);
    if (n === 'absorption') this.absorption = 0;
    if (n === 'health_boost') { this.maxHealth = 20; this.health = Math.min(this.health, 20); }
  }
  tickEffects() {
    for (const [n, e] of this.effects) {
      const a = e.amp;
      if (n === 'regeneration') { const k = 50 >> a; if (k <= 0 || this.age % k === 0) this.heal(1); }
      else if (n === 'poison') { const k = 25 >> a; if ((k <= 0 || this.age % k === 0) && this.health > 1 && !this.undead) this.hurt({ type: 'magic', bypassArmor: true, noFlash: true }, 1); }
      else if (n === 'wither') { const k = 40 >> a; if (k <= 0 || this.age % k === 0) this.hurt({ type: 'wither', bypassArmor: true }, 1); }
      else if (n === 'hunger' && this.food) this.food.exhaust(0.005 * (a + 1));
      else if (n === 'levitation') this.vy += (0.05 * (a + 1) - this.vy) * 0.2;
      if (--e.duration <= 0) this.removeEffect(n);
    }
  }

  // ---------- damage ----------
  armorValue() { return 0; }
  armorToughness() { return 0; }
  heal(n) { if (this.dead) return; this.health = Math.min(this.maxHealth, this.health + n); }
  hurt(src, amount) {
    if (this.dead || this.removed) return false;
    if (this.invulnerable && src.type !== 'void' && src.type !== 'kill') return false;
    const fireType = src.type === 'fire' || src.type === 'onFire' || src.type === 'lava' || src.type === 'hotFloor';
    if (fireType && (this.fireImmune || this.hasEffect('fire_resistance'))) return false;
    if (this.isBlocking && this.isBlocking(src)) { this.game.sound.at('item.shield.block', this.x, this.y, this.z); return false; }
    let flash = true;
    if (this.invulnerableTime > 10 && src.type !== 'void' && src.type !== 'kill') {
      if (amount <= this.lastHurtAmount) return false;
      const a = amount;
      amount -= this.lastHurtAmount;
      this.lastHurtAmount = a;
      flash = false;
    } else {
      this.lastHurtAmount = amount;
      this.invulnerableTime = 20;
      this.hurtTime = 10;
    }
    let dmg = amount;
    if (!src.bypassArmor && src.type !== 'fall' && src.type !== 'drown' && src.type !== 'starve' && src.type !== 'void' && src.type !== 'magic' && src.type !== 'kill' && src.type !== 'suffocation') {
      const armor = this.armorValue(), tough = this.armorToughness();
      const f = Math.min(20, Math.max(armor / 5, armor - (4 * dmg) / (tough + 8)));
      dmg = dmg * (1 - f / 25);
      if (armor > 0 && this.damageArmor) this.damageArmor(amount);
    }
    if (this.hasEffect('resistance') && src.type !== 'void' && src.type !== 'kill') dmg *= Math.max(0, 1 - 0.2 * (this.effectAmp('resistance') + 1));
    if (this.absorption > 0) { const a = Math.min(this.absorption, dmg); this.absorption -= a; dmg -= a; }
    if (src.attacker) { this.lastAttacker = src.attacker; this.lastAttackerTime = this.age; }
    if (dmg > 0) this.health -= dmg;
    if (flash || src.noFlash !== true) this.onHurt(src, dmg, flash);
    if (this.health <= 0) { this.health = 0; this.die(src); }
    return true;
  }
  onHurt() {}
  knockback(strength, dx, dz) {
    strength *= 1 - this.knockbackResistance;
    if (strength <= 0) return;
    const l = Math.hypot(dx, dz) || 1;
    this.vx = this.vx / 2 - dx / l * strength;
    this.vz = this.vz / 2 - dz / l * strength;
    if (this.onGround) this.vy = Math.min(0.4, this.vy / 2 + strength);
  }
  die(src) {
    if (this.dead) return;
    this.dead = true;
    this.deathSource = src;
    this.onDeath(src);
  }
  onDeath() {}
  fall(dist) {
    if (this.flying) return;
    const jb = this.effectAmp('jump_boost') + 1;
    let dmg = Math.ceil(dist - 3 - jb);
    if (this.hasEffect('slow_falling')) dmg = 0;
    const below = this.blockBelowId();
    const d = BLOCKS[below];
    if (d.name === 'hay_block') dmg = Math.ceil(dmg * 0.2);
    if (d.kind === 'bed') dmg = Math.ceil(dmg * 0.5);
    if (d.bouncy && !this.sneaking) dmg = 0;
    if (d.name === 'honey_block') dmg = Math.ceil(dmg * 0.2);
    if (dmg > 0 && !this.inWater) {
      this.game.sound.at(dmg > 4 ? 'entity.generic.big_fall' : 'entity.generic.small_fall', this.x, this.y, this.z);
      this.hurt({ type: 'fall' }, dmg);
    }
  }

  swing() { if (this.swingTicks < 0 || this.swingTicks >= 3) { this.swingTicks = 0; } }

  // ---------- movement ----------
  jump() {
    let v = 0.42 * BLOCKS[this.blockBelowId()].jumpFactor;
    if (this.hasEffect('jump_boost')) v += 0.1 * (this.effectAmp('jump_boost') + 1);
    this.vy = v;
    if (this.sprinting) {
      const f = this.yaw;
      this.vx -= Math.sin(f) * 0.2; this.vz += Math.cos(f) * 0.2;
    }
  }
  speedValue() {
    let s = this.movementSpeed;
    if (this.sprinting) s *= 1.3;
    if (this.hasEffect('speed')) s *= 1 + 0.2 * (this.effectAmp('speed') + 1);
    if (this.hasEffect('slowness')) s *= Math.max(0, 1 - 0.15 * (this.effectAmp('slowness') + 1));
    return s;
  }
  moveRelative(speed, strafe, forward) {
    let l = strafe * strafe + forward * forward;
    if (l < 1e-4) return;
    l = Math.sqrt(l);
    if (l < 1) l = 1;
    strafe = strafe / l * speed; forward = forward / l * speed;
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    this.vx += strafe * c - forward * s;
    this.vz += forward * c + strafe * s;
  }
  checkLadder() {
    const id = this.world.getBlock(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z));
    this.onLadder = BLOCKS[id].climbable;
    return this.onLadder;
  }
  travel(strafe, forward) {
    if (this.flying) {
      const vy = this.vy;
      const fs = (this.flySpeed || 0.05) * (this.sprinting ? 2 : 1);
      this.moveRelative(fs, strafe, forward);
      this.move(this.vx, this.vy, this.vz);
      this.vx *= 0.91; this.vz *= 0.91;
      this.vy = vy * 0.6;
      if (this.noClip) { /* spectator */ }
      return;
    }
    const slowFall = this.hasEffect('slow_falling') && this.vy <= 0;
    const grav = slowFall ? 0.01 : 0.08;
    if (this.inWater && !this.flying) {
      const y0 = this.y;
      let drag = this.sprinting ? 0.9 : 0.8;
      let speed = 0.02;
      if (this.hasEffect('dolphins_grace')) drag = 0.96;
      this.moveRelative(speed, strafe, forward);
      this.move(this.vx, this.vy, this.vz);
      this.vx *= drag; this.vy *= 0.8; this.vz *= drag;
      this.vy -= grav / 4;
      if (this.collidedH && !hasCollision(this.world, this.box.offset(this.vx, this.vy + 0.6 - this.y + y0, this.vz))) this.vy = 0.3;
      return;
    }
    if (this.inLava && !this.flying) {
      const y0 = this.y;
      this.moveRelative(0.02, strafe, forward);
      this.move(this.vx, this.vy, this.vz);
      this.vx *= 0.5; this.vy *= 0.5; this.vz *= 0.5;
      this.vy -= grav / 4;
      if (this.collidedH && !hasCollision(this.world, this.box.offset(this.vx, this.vy + 0.6 - this.y + y0, this.vz))) this.vy = 0.3;
      return;
    }
    let slip = 0.91;
    const belowId = this.world.getBlock(Math.floor(this.x), Math.floor(this.y - 0.5000001), Math.floor(this.z));
    const fr = BLOCKS[belowId].friction;
    if (this.onGround) slip = fr * 0.91;
    const accel = this.onGround ? this.speedValue() * (0.21600002 / (fr * fr * fr)) : (this.sprinting ? 0.026 : 0.02);
    this.moveRelative(accel, strafe, forward);
    if (this.checkLadder()) {
      this.vx = Math.max(-0.15, Math.min(0.15, this.vx));
      this.vz = Math.max(-0.15, Math.min(0.15, this.vz));
      this.fallDistance = 0;
      if (this.vy < -0.15) this.vy = -0.15;
      if (this.sneaking && this.vy < 0 && this.isPlayer) this.vy = 0;
    }
    // speed factor of the block below (soul sand / honey)
    const sf = BLOCKS[belowId].speedFactor;
    if (sf !== 1 && this.onGround) { this.vx *= sf; this.vz *= sf; }
    this.move(this.vx, this.vy, this.vz);
    if (this.bounceV !== undefined) { if (this.bounceV > 0.1) this.vy = this.bounceV * 0.9; this.bounceV = undefined; }
    if ((this.collidedH || this.jumping) && this.onLadder) this.vy = 0.2;
    if (this.hasEffect('levitation')) { /* handled in tickEffects */ }
    else if (!this.noGravity) this.vy -= grav;
    this.vy *= 0.98;
    this.vx *= slip; this.vz *= slip;
  }

  aiStep() {
    if (this.noJumpDelay > 0) this.noJumpDelay--;
    if (Math.abs(this.vx) < 0.003) this.vx = 0;
    if (Math.abs(this.vy) < 0.003) this.vy = 0;
    if (Math.abs(this.vz) < 0.003) this.vz = 0;
    if (this.jumping && !this.flying) {
      if (this.inWater || this.inLava) this.vy += 0.04;
      else if (this.onGround && this.noJumpDelay === 0) { this.jump(); this.noJumpDelay = 10; }
    } else this.noJumpDelay = 0;
    // cobweb / berry bush / powder snow
    const id = this.world.getBlock(Math.floor(this.x), Math.floor(this.y + 0.1), Math.floor(this.z));
    const d = BLOCKS[id];
    if (d.slowsMovement) { const m = d.slowsMovement; this.stuckMultiplier = d.kind === 'cobweb' ? [0.25, 0.05, 0.25] : [0.8, 0.75, 0.8]; this.fallDistance = 0; if (d.kind === 'berry_bush' && (this.world.getMeta(Math.floor(this.x), Math.floor(this.y + 0.1), Math.floor(this.z)) & 3) > 0 && (Math.abs(this.x - this.prevX) > 0.003 || Math.abs(this.z - this.prevZ) > 0.003) && this.mobType !== 'fox') this.hurt({ type: 'sweetBerry' }, 1); void m; }
    this.travel(this.strafe * 0.98, this.forward * 0.98);
  }

  tick() {
    super.tick();
    if (this.dead) {
      this.deathTime++;
      this.vx *= 0.5; this.vz *= 0.5;
      this.vy -= 0.08;
      this.move(this.vx, this.vy, this.vz);
      if (this.deathTime >= 20 && !this.isPlayer) { this.remove(); this.onRemovedAfterDeath && this.onRemovedAfterDeath(); }
      return;
    }
    if (this.hurtTime > 0) this.hurtTime--;
    if (this.invulnerableTime > 0) this.invulnerableTime--;
    this.tickEffects();
    this.tickAir();
    // suffocation
    if (!this.noPhysics && this.age % 10 === 0) {
      const ex = Math.floor(this.x), ey = Math.floor(this.y + this.eyeHeight), ez = Math.floor(this.z);
      const d = BLOCKS[this.world.getBlock(ex, ey, ez)];
      if (d.opaque && d.solid && d.shape === 'cube') this.hurt({ type: 'suffocation' }, 1);
    }
    // cactus / magma / fire contact
    this.contactDamage();
    if (this.dead) return;
    this.aiStep();
    // body / limb animation
    this.prevLimbAmount = this.limbAmount;
    const dx = this.x - this.prevX, dz = this.z - this.prevZ;
    let dist = Math.sqrt(dx * dx + dz * dz) * 4;
    if (dist > 1) dist = 1;
    this.limbAmount += (dist - this.limbAmount) * 0.4;
    this.limbSwing += this.limbAmount;
    this.prevBodyYaw = this.bodyYaw; this.prevHeadYaw = this.headYaw;
    this.headYaw = this.lookYaw ?? this.yaw;
    if (dist > 0.05) {
      const moveYaw = Math.atan2(-dx, dz);
      this.bodyYaw = approachAngle(this.bodyYaw, moveYaw, 0.3);
    }
    let diff = wrapAngle(this.headYaw - this.bodyYaw);
    if (diff > 1.3) this.bodyYaw = this.headYaw - 1.3; else if (diff < -1.3) this.bodyYaw = this.headYaw + 1.3;
    this.prevSwingProgress = this.swingProgress;
    if (this.swingTicks >= 0) { this.swingTicks++; if (this.swingTicks >= 6) this.swingTicks = -1; }
    this.swingProgress = this.swingTicks < 0 ? 0 : this.swingTicks / 6;
  }

  tickAir() {
    if (this.eyeInWater && !this.canBreatheUnderwater && !this.hasEffect('water_breathing') && !(this.isPlayer && (this.gameMode === 1 || this.gameMode === 3))) {
      this.air--;
      if (this.air <= -20) { this.air = 0; this.hurt({ type: 'drown', bypassArmor: true }, 2); for (let i = 0; i < 8; i++) this.game.particles && this.game.particles.spawn('bubble', this.x, this.y + this.eyeHeight, this.z, (Math.random() - 0.5) * 0.2, 0.1, (Math.random() - 0.5) * 0.2); }
    } else if (this.air < this.maxAir) this.air = Math.min(this.maxAir, this.air + 4);
  }

  contactDamage() {
    const b = this.box;
    const w = this.world;
    for (let x = Math.floor(b.x0 - 0.001); x <= Math.floor(b.x1 + 0.001); x++) for (let z = Math.floor(b.z0 - 0.001); z <= Math.floor(b.z1 + 0.001); z++) {
      for (let y = Math.floor(b.y0 - 0.01); y <= Math.floor(b.y1); y++) {
        const id = w.getBlock(x, y, z);
        if (!id) continue;
        const d = BLOCKS[id];
        if (d.kind === 'cactus') {
          const cb = new AABB(x + 1 / 16, y, z + 1 / 16, x + 15 / 16, y + 1, z + 15 / 16);
          if (cb.grow(0.01).intersects(b)) { this.hurt({ type: 'cactus' }, 1); return; }
        } else if (d.kind === 'magma' && y === Math.floor(this.y - 0.01) && this.onGround && !this.sneaking && !this.fireImmune) { this.hurt({ type: 'hotFloor' }, 1); return; }
        else if (d.kind === 'fire' || (d.kind === 'campfire')) {
          if (d.kind === 'campfire' && y !== Math.floor(this.y - 0.01) && y !== Math.floor(this.y)) continue;
          if (!this.fireImmune) { this.hurt({ type: 'fire' }, 1); this.setOnFire(8); }
          return;
        } else if (d.kind === 'wither_rose') { this.addEffect('wither', 40, 0); }
      }
    }
  }
}

export function wrapAngle(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
export function approachAngle(a, b, f) { return a + wrapAngle(b - a) * f; }
