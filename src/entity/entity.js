// Entity base classes: Entity, LivingEntity, and simple non-living entities.
import { AABB, sweep, collectBoxes } from './physics.js';
import { BLOCKS, BLOCK } from '../registry/blocks.js';
import { ItemStack } from '../game/itemstack.js';
import { MIN_Y } from '../core/util.js';

let NEXT_ID = 1;
const WATER = BLOCK.water.id, LAVA = BLOCK.lava.id;

export class Entity {
  constructor(game, x, y, z) {
    this.id = NEXT_ID++;
    this.game = game;
    this.world = game.world;
    this.type = 'entity';
    this.x = x; this.y = y; this.z = z;
    this.prevX = x; this.prevY = y; this.prevZ = z;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.yaw = 0; this.pitch = 0; this.prevYaw = 0; this.prevPitch = 0;
    this.width = 0.6; this.height = 1.8;
    this.onGround = false; this.collidedH = false; this.collidedV = false;
    this.removed = false; this.age = 0;
    this.fallDistance = 0;
    this.inWater = false; this.inLava = false; this.eyeInWater = false; this.eyeInLava = false;
    this.fireTicks = 0; this.fireImmune = false;
    this.noGravity = false; this.noPhysics = false;
    this.stepHeight = 0;
    this.gravity = 0.08; this.drag = 0.98;
    this.invulnerable = false;
  }
  get box() { return AABB.ofEntity(this.x, this.y, this.z, this.width, this.height); }
  get eyeHeight() { return this.height * 0.85; }
  setPos(x, y, z) { this.x = x; this.y = y; this.z = z; }
  teleport(x, y, z) { this.x = this.prevX = x; this.y = this.prevY = y; this.z = this.prevZ = z; this.vx = this.vy = this.vz = 0; this.fallDistance = 0; }
  distSq(e) { const dx = e.x - this.x, dy = e.y - this.y, dz = e.z - this.z; return dx * dx + dy * dy + dz * dz; }
  dist(e) { return Math.sqrt(this.distSq(e)); }
  remove() { this.removed = true; }

  tick() {
    this.prevX = this.x; this.prevY = this.y; this.prevZ = this.z;
    this.prevYaw = this.yaw; this.prevPitch = this.pitch;
    this.age++;
    this.baseTick();
  }

  baseTick() {
    this.updateFluidState();
    if (this.inLava) { this.setOnFire(15); this.lavaHurt(); this.fallDistance *= 0.5; }
    if (this.fireTicks > 0) {
      if (this.fireImmune) this.fireTicks = Math.max(0, this.fireTicks - 4);
      else {
        if (this.fireTicks % 20 === 0) this.hurt && this.hurt({ type: 'onFire' }, 1);
        this.fireTicks--;
      }
      if (this.inWater) this.fireTicks = 0;
    }
    if (this.y < MIN_Y - 64) this.outOfWorld();
  }
  lavaHurt() { if (!this.fireImmune && this.hurt) this.hurt({ type: 'lava' }, 4); }
  setOnFire(secs) { if (!this.fireImmune && this.fireTicks < secs * 20) this.fireTicks = secs * 20; }
  outOfWorld() { if (this.hurt) this.hurt({ type: 'void', bypassArmor: true }, 4); else this.remove(); }

  updateFluidState() {
    const b = this.box;
    const w = this.world;
    this.inWater = false; this.inLava = false;
    let waterTop = -Infinity;
    for (let x = Math.floor(b.x0 + 0.001); x <= Math.floor(b.x1 - 0.001); x++) {
      for (let z = Math.floor(b.z0 + 0.001); z <= Math.floor(b.z1 - 0.001); z++) {
        for (let y = Math.floor(b.y0 + 0.001); y <= Math.floor(b.y1 - 0.001); y++) {
          const id = w.getBlock(x, y, z);
          if (id === WATER || BLOCKS[id].waterlogged) {
            const m = id === WATER ? w.getMeta(x, y, z) : 0;
            const h = y + (m >= 8 || m === 0 ? (w.getBlock(x, y + 1, z) === WATER ? 1 : 0.89) : (8 - m) / 9);
            if (b.y0 < h) { this.inWater = true; waterTop = Math.max(waterTop, h); }
          } else if (id === LAVA) {
            const m = w.getMeta(x, y, z);
            const h = y + (m >= 8 || m === 0 ? 0.89 : (8 - m) / 9);
            if (b.y0 < h) this.inLava = true;
          }
        }
      }
    }
    this.waterTop = waterTop;
    const ey = this.y + this.eyeHeight;
    const eid = w.getBlock(Math.floor(this.x), Math.floor(ey), Math.floor(this.z));
    if (eid === WATER) {
      const m = w.getMeta(Math.floor(this.x), Math.floor(ey), Math.floor(this.z));
      const top = Math.floor(ey) + (m >= 8 || m === 0 ? (w.getBlock(Math.floor(this.x), Math.floor(ey) + 1, Math.floor(this.z)) === WATER ? 1 : 0.89) : (8 - m) / 9);
      this.eyeInWater = ey < top;
    } else this.eyeInWater = !!BLOCKS[eid].waterlogged;
    this.eyeInLava = eid === LAVA;
    if (this.inWater) { this.fallDistance = 0; }
  }

  move(dx, dy, dz) {
    if (this.noPhysics) { this.x += dx; this.y += dy; this.z += dz; return; }
    // cobweb / berry bush slowdown
    if (this.stuckMultiplier) { dx *= this.stuckMultiplier[0]; dy *= this.stuckMultiplier[1]; dz *= this.stuckMultiplier[2]; this.stuckMultiplier = null; this.vx = 0; this.vy = 0; this.vz = 0; }
    if (this.sneakEdge && this.onGround) [dx, dz] = this.edgeClip(dx, dz);
    const r = sweep(this.world, this.box, dx, dy, dz, this.stepHeight, this.onGround);
    this.x += r.dx; this.y += r.dy; this.z += r.dz;
    this.collidedH = r.collidedX || r.collidedZ;
    this.collidedV = r.collidedY;
    const wasOnGround = this.onGround;
    this.onGround = r.onGround || (r.collidedY && dy < 0);
    if (r.collidedX) this.vx = 0;
    if (r.collidedZ) this.vz = 0;
    if (r.collidedY) {
      if (dy < 0 && this.onGround) this.onLanded(dy);
      this.vy = 0;
    }
    if (this.onGround) {
      if (this.fallDistance > 0) this.fall(this.fallDistance);
      this.fallDistance = 0;
    } else if (r.dy < 0) this.fallDistance -= r.dy;
    void wasOnGround;
  }
  onLanded() {
    const id = this.blockBelowId();
    const d = BLOCKS[id];
    if (d.bouncy && !this.sneaking) { this.bounceV = -this.vy; }
  }
  blockBelowId() { return this.world.getBlock(Math.floor(this.x), Math.floor(this.y - 0.2), Math.floor(this.z)); }
  edgeClip(dx, dz) {
    const step = 0.05;
    const below = (ox, oz) => collectBoxes(this.world, this.box.offset(ox, -1.0, oz)).some((o) => o.intersects(this.box.offset(ox, -0.6, oz)));
    while (dx !== 0 && !below(dx, 0)) { if (Math.abs(dx) < step) dx = 0; else dx -= step * Math.sign(dx); }
    while (dz !== 0 && !below(0, dz)) { if (Math.abs(dz) < step) dz = 0; else dz -= step * Math.sign(dz); }
    while (dx !== 0 && dz !== 0 && !below(dx, dz)) {
      if (Math.abs(dx) < step) dx = 0; else dx -= step * Math.sign(dx);
      if (Math.abs(dz) < step) dz = 0; else dz -= step * Math.sign(dz);
    }
    return [dx, dz];
  }
  fall() {}

  // basic physics for simple entities
  physicsTick(gravity = this.gravity, drag = this.drag, groundFriction = 0.6) {
    if (!this.noGravity) this.vy -= gravity;
    this.move(this.vx, this.vy, this.vz);
    let f = drag;
    if (this.onGround) f = groundFriction * BLOCKS[this.blockBelowId()].friction / 0.6 * 0.98;
    this.vx *= f; this.vz *= f; this.vy *= drag;
    if (this.onGround) this.vy *= -0.5;
  }
  lerpPos(t) { return [this.prevX + (this.x - this.prevX) * t, this.prevY + (this.y - this.prevY) * t, this.prevZ + (this.z - this.prevZ) * t]; }
  lightLevel() {
    const w = this.world;
    const l = w.getLight(Math.floor(this.x), Math.floor(this.y + this.height / 2), Math.floor(this.z));
    return [l >> 4, l & 15];
  }
  save() { return null; }
}

// ---------------------------------------------------------------------------
export class ItemEntity extends Entity {
  constructor(game, x, y, z, stack, pickupDelay = 10) {
    super(game, x, y, z);
    this.type = 'item';
    this.stack = stack;
    this.width = 0.25; this.height = 0.25;
    this.pickupDelay = pickupDelay;
    this.gravity = 0.04;
    this.bobOffset = Math.random() * Math.PI * 2;
    this.health = 5;
    this.fireImmune = !!stack.item.fireproof;
  }
  tick() {
    super.tick();
    if (this.pickupDelay > 0) this.pickupDelay--;
    if (this.inWater) {
      this.vy += 0.0005 * (this.waterTop > this.y + 0.1 ? 20 : 0);
      if (this.vy > 0.06) this.vy = 0.06;
      this.vx *= 0.99; this.vz *= 0.99;
    }
    if (this.inLava && !this.fireImmune) { this.remove(); this.game.sound && this.game.sound.at('random.fizz', this.x, this.y, this.z); return; }
    this.physicsTick(this.inWater ? 0.0 : 0.04, 0.98, 0.6);
    if (this.inWater && this.vy < -0.01) this.vy *= 0.5;
    // merge with nearby items
    if (this.age % 10 === 0 && this.stack.count < this.stack.item.maxStack) {
      for (const e of this.game.entities) {
        if (e === this || e.type !== 'item' || e.removed || !e.stack.canStack(this.stack)) continue;
        if (Math.abs(e.x - this.x) < 0.5 && Math.abs(e.y - this.y) < 0.5 && Math.abs(e.z - this.z) < 0.5) {
          const n = Math.min(this.stack.item.maxStack - this.stack.count, e.stack.count);
          this.stack.count += n; e.stack.count -= n;
          if (e.stack.count <= 0) e.remove();
          this.pickupDelay = Math.max(this.pickupDelay, e.pickupDelay);
        }
      }
    }
    if (this.age >= 6000) this.remove();
  }
  hurt(src) { if (src.type === 'explosion' || src.type === 'lava' || src.type === 'onFire' || src.type === 'fire') { if (src.type !== 'explosion' && this.fireImmune) return; this.remove(); } }
  save() { return { type: 'item', x: this.x, y: this.y, z: this.z, stack: this.stack.toJSON(), age: this.age }; }
}

export class XpOrb extends Entity {
  constructor(game, x, y, z, value) {
    super(game, x, y, z);
    this.type = 'xp_orb'; this.value = value;
    this.width = 0.5; this.height = 0.5;
    this.gravity = 0.03;
    this.vx = (Math.random() * 0.2 - 0.1) * 2; this.vy = Math.random() * 0.2 * 2; this.vz = (Math.random() * 0.2 - 0.1) * 2;
  }
  tick() {
    super.tick();
    const p = this.game.player;
    if (p && !p.dead && p.gameMode !== 3) {
      const dx = p.x - this.x, dy = p.y + p.eyeHeight / 2 - this.y, dz = p.z - this.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < 64) {
        const d = Math.sqrt(d2), f = 1 - d / 8;
        this.vx += dx / d * f * f * 0.1; this.vy += dy / d * f * f * 0.1; this.vz += dz / d * f * f * 0.1;
      }
      if (d2 < 1.5 && this.age > 2) { p.pickupXp(this); return; }
    }
    this.physicsTick(0.03, 0.98, 0.6);
    if (this.age > 6000) this.remove();
  }
}

export class FallingBlock extends Entity {
  constructor(game, x, y, z, id, meta) {
    super(game, x, y, z);
    this.type = 'falling_block'; this.blockId = id; this.blockMeta = meta;
    this.width = 0.98; this.height = 0.98;
    this.gravity = 0.04;
  }
  tick() {
    super.tick();
    this.vy -= 0.04;
    this.move(this.vx, this.vy, this.vz);
    this.vx *= 0.98; this.vy *= 0.98; this.vz *= 0.98;
    const bx = Math.floor(this.x), by = Math.floor(this.y + 0.01), bz = Math.floor(this.z);
    const d = BLOCKS[this.blockId];
    if (d.kind === 'concrete_powder' && this.inWater) { this.land(bx, by, bz, BLOCK[d.concrete].id); return; }
    if (this.onGround) { this.land(bx, by, bz, this.blockId); return; }
    if (this.age > 600 || this.y < MIN_Y - 10) { this.remove(); }
  }
  land(x, y, z, id) {
    const w = this.world;
    const cur = w.getBlock(x, y, z);
    this.remove();
    if (cur === 0 || BLOCKS[cur].replaceable) {
      w.setBlock(x, y, z, id, this.blockMeta);
      if (BLOCKS[id].kind === 'anvil') { this.game.sound.at('block.anvil.land', x + 0.5, y + 0.5, z + 0.5); this.damageBelow(); }
    } else {
      this.game.dropItem(x + 0.5, y + 0.5, z + 0.5, new ItemStack(BLOCKS[id].name, 1));
    }
  }
  damageBelow() {
    const fall = Math.max(0, this.fallStart - this.y);
    for (const e of this.game.entities) if (e.hurt && e !== this && e.box.intersects(this.box.grow(0.1))) e.hurt({ type: 'anvil' }, Math.min(40, Math.ceil(fall * 2)));
  }
}

export class PrimedTnt extends Entity {
  constructor(game, x, y, z, fuse = 80, source = null) {
    super(game, x, y, z);
    this.type = 'tnt'; this.fuse = fuse; this.source = source;
    this.width = 0.98; this.height = 0.98;
    const a = Math.random() * Math.PI * 2;
    this.vx = -Math.sin(a) * 0.02; this.vy = 0.2; this.vz = -Math.cos(a) * 0.02;
  }
  tick() {
    super.tick();
    this.vy -= 0.04;
    this.move(this.vx, this.vy, this.vz);
    this.vx *= 0.98; this.vy *= 0.98; this.vz *= 0.98;
    if (this.onGround) { this.vx *= 0.7; this.vz *= 0.7; this.vy *= -0.5; }
    this.fuse--;
    if (this.fuse <= 0) { this.remove(); this.game.explode(this.x, this.y + 0.0625, this.z, 4, false, this); }
    else if (this.game.particles) this.game.particles.spawn('smoke', this.x, this.y + 0.5, this.z, 0, 0, 0);
  }
}

// arrows, snowballs, eggs, ender pearls
export class Projectile extends Entity {
  constructor(game, x, y, z, kind, shooter) {
    super(game, x, y, z);
    this.type = kind; this.kind = kind; this.shooter = shooter;
    this.width = 0.25; this.height = 0.25;
    this.gravity = kind === 'arrow' || kind === 'spectral_arrow' ? 0.05 : 0.03;
    this.damage = 2; this.inGround = false; this.inGroundTime = 0; this.pickup = kind === 'arrow' || kind === 'spectral_arrow' ? 1 : 0;
    this.crit = false;
  }
  shoot(dx, dy, dz, speed, inaccuracy = 1) {
    const l = Math.sqrt(dx * dx + dy * dy + dz * dz);
    dx /= l; dy /= l; dz /= l;
    dx += (Math.random() - 0.5) * 0.0075 * inaccuracy * 2; dy += (Math.random() - 0.5) * 0.0075 * inaccuracy * 2; dz += (Math.random() - 0.5) * 0.0075 * inaccuracy * 2;
    this.vx = dx * speed; this.vy = dy * speed; this.vz = dz * speed;
    this.yaw = Math.atan2(-this.vx, this.vz); this.pitch = -Math.atan2(this.vy, Math.hypot(this.vx, this.vz));
  }
  tick() {
    super.tick();
    if (this.inGround) {
      this.inGroundTime++;
      const id = this.world.getBlock(this.stuckX, this.stuckY, this.stuckZ);
      if (!id || !BLOCKS[id].solid) { this.inGround = false; this.vx = this.vy = this.vz = 0; }
      if (this.inGroundTime > 1200) this.remove();
      this.tryPickup();
      return;
    }
    // ray-test this tick's movement against blocks and entities
    const sx = this.x, sy = this.y, sz = this.z;
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy + this.vz * this.vz);
    const hit = this.game.raycast(sx, sy, sz, this.vx / speed, this.vy / speed, this.vz / speed, speed, { fluids: false });
    let ent = null, entT = Infinity;
    const seg = new AABB(Math.min(sx, sx + this.vx), Math.min(sy, sy + this.vy), Math.min(sz, sz + this.vz), Math.max(sx, sx + this.vx), Math.max(sy, sy + this.vy), Math.max(sz, sz + this.vz)).grow(1);
    for (const e of this.game.entities) {
      if (!e.hurt || e === this || e.removed || (e === this.shooter && this.age < 5) || e.type === 'item' || e.type === 'xp_orb' || e.dead) continue;
      const bb = e.box;
      if (!bb.intersects(seg)) continue;
      const h = bb.grow(0.3).rayHit(sx, sy, sz, this.vx / speed, this.vy / speed, this.vz / speed);
      if (h && h.t <= speed && h.t < entT) { ent = e; entT = h.t; }
    }
    if (ent && (!hit || entT < hit.dist)) { this.onHitEntity(ent, speed); if (this.removed) return; }
    else if (hit) { this.onHitBlock(hit); if (this.removed || this.inGround) return; }
    this.x += this.vx; this.y += this.vy; this.z += this.vz;
    const drag = this.inWater ? 0.6 : 0.99;
    this.vx *= drag; this.vy *= drag; this.vz *= drag;
    this.vy -= this.gravity;
    this.yaw = Math.atan2(-this.vx, this.vz); this.pitch = -Math.atan2(this.vy, Math.hypot(this.vx, this.vz));
    if (this.inWater && this.game.particles && this.age % 2 === 0) this.game.particles.spawn('bubble', this.x, this.y, this.z, 0, 0, 0);
    if (this.age > 1200) this.remove();
  }
  onHitEntity(e, speed) {
    const g = this.game;
    if (this.kind === 'arrow' || this.kind === 'spectral_arrow') {
      let dmg = Math.ceil(speed * this.damage);
      if (this.crit) dmg += Math.floor(Math.random() * (dmg / 2 + 2));
      if (e.hurt({ type: 'arrow', attacker: this.shooter, projectile: this }, dmg)) {
        const h = Math.hypot(this.vx, this.vz);
        if (h > 0 && e.knockback) e.knockback(0.5, -this.vx / h, -this.vz / h);
        if (this.fireTicks > 0) e.setOnFire(5);
        if (this.kind === 'spectral_arrow' && e.addEffect) e.addEffect('glowing', 200, 0);
        if (this.effect && e.addEffect) e.addEffect(this.effect[0], this.effect[1], this.effect[2] || 0);
        g.sound.at('entity.arrow.hit', this.x, this.y, this.z);
        this.remove();
      } else { this.vx *= -0.1; this.vy *= -0.1; this.vz *= -0.1; }
    } else {
      if (this.kind === 'snowball') e.hurt({ type: 'thrown', attacker: this.shooter }, e.mobType === 'blaze' ? 3 : 0);
      if (this.kind === 'egg') e.hurt({ type: 'thrown', attacker: this.shooter }, 0);
      this.impact();
    }
  }
  onHitBlock(hit) {
    const g = this.game;
    if (this.kind === 'arrow' || this.kind === 'spectral_arrow') {
      this.x = hit.hit[0] - this.vx * 0.01; this.y = hit.hit[1] - this.vy * 0.01; this.z = hit.hit[2] - this.vz * 0.01;
      this.inGround = true; this.stuckX = hit.x; this.stuckY = hit.y; this.stuckZ = hit.z;
      this.vx = this.vy = this.vz = 0;
      g.sound.at('entity.arrow.hit', this.x, this.y, this.z);
      if (BLOCKS[hit.id].kind === 'tnt' && this.fireTicks > 0) { g.world.setBlock(hit.x, hit.y, hit.z, 0); g.spawn(new PrimedTnt(g, hit.x + 0.5, hit.y, hit.z + 0.5)); }
      if (BLOCKS[hit.id].name === 'target') g.redstone && g.redstone.pulse(hit.x, hit.y, hit.z, 15, 20);
    } else {
      this.x = hit.hit[0]; this.y = hit.hit[1]; this.z = hit.hit[2];
      this.impact();
    }
  }
  impact() {
    const g = this.game;
    if (this.kind === 'snowball') for (let i = 0; i < 8; i++) g.particles && g.particles.spawn('snowball', this.x, this.y, this.z, (Math.random() - 0.5) * 0.1, Math.random() * 0.1, (Math.random() - 0.5) * 0.1);
    if (this.kind === 'egg') {
      for (let i = 0; i < 8; i++) g.particles && g.particles.spawn('egg', this.x, this.y, this.z, (Math.random() - 0.5) * 0.1, Math.random() * 0.1, (Math.random() - 0.5) * 0.1);
      if (Math.random() < 0.125) { const n = Math.random() < 1 / 32 ? 4 : 1; for (let i = 0; i < n; i++) g.spawnMob('chicken', this.x, this.y, this.z, { baby: true }); }
    }
    if (this.kind === 'ender_pearl' && this.shooter && !this.shooter.dead) {
      for (let i = 0; i < 32; i++) g.particles && g.particles.spawn('portal', this.x, this.y + Math.random() * 2, this.z, (Math.random() - 0.5) * 2, -Math.random(), (Math.random() - 0.5) * 2);
      this.shooter.teleport(this.x, this.y, this.z);
      this.shooter.hurt({ type: 'fall' }, 5);
      g.sound.at('entity.enderman.teleport', this.x, this.y, this.z);
    }
    this.remove();
  }
  tryPickup() {
    const p = this.game.player;
    if (!p || !this.pickup || p.dead) return;
    if (this.inGroundTime < 5) return;
    if (Math.abs(p.x - this.x) < 1.2 && Math.abs(p.y + 0.9 - this.y) < 1.5 && Math.abs(p.z - this.z) < 1.2) {
      if (p.gameMode === 1 || p.inventory.add(new ItemStack(this.kind === 'spectral_arrow' ? 'spectral_arrow' : 'arrow', 1)) === 0) {
        this.game.sound.play('entity.item.pickup', 0.2, 1 + Math.random() * 0.4);
        this.remove();
      }
    }
  }
}
