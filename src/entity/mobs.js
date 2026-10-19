// Mobs: Minecraft's mob roster with simplified goal-style AI, loot tables and natural spawning.
import { LivingEntity, wrapAngle, approachAngle } from './living.js';
import { Projectile } from './entity.js';
import { ItemStack } from '../game/itemstack.js';
import { BLOCKS, BLOCK } from '../registry/blocks.js';
import { ITEM } from '../registry/items.js';
import { BIOMES } from '../world/biomes.js';
import { MIN_Y, SEA_LEVEL, titleCase } from '../core/util.js';
import { enchantLevel } from '../game/enchantments.js';

const SEEDS = ['wheat_seeds', 'melon_seeds', 'pumpkin_seeds', 'beetroot_seeds'];
const MEATS = ['beef', 'cooked_beef', 'porkchop', 'cooked_porkchop', 'chicken', 'cooked_chicken', 'mutton', 'cooked_mutton', 'rabbit', 'cooked_rabbit', 'rotten_flesh'];
const COOKED = { beef: 'cooked_beef', porkchop: 'cooked_porkchop', chicken: 'cooked_chicken', mutton: 'cooked_mutton', rabbit: 'cooked_rabbit', cod: 'cooked_cod', salmon: 'cooked_salmon' };

// Attribute values follow the Minecraft wiki (health, movement speed, attack damage, hitbox).
// drops: [item, min, max, { chance, player, cooked, looting }]
export const MOBS = {
  // ---------------------------------------------------------------- hostile
  zombie: { cat: 'monster', hp: 20, speed: 0.23, dmg: 3, armor: 2, w: 0.6, h: 1.95, undead: true, burns: true, xp: 5, follow: 35, ai: 'melee', drops: [['rotten_flesh', 0, 2]], rare: ['iron_ingot', 'carrot', 'potato'] },
  husk: { cat: 'monster', hp: 20, speed: 0.23, dmg: 3, armor: 2, w: 0.6, h: 1.95, undead: true, xp: 5, follow: 35, ai: 'melee', hitEffect: ['hunger', 140], drops: [['rotten_flesh', 0, 2]], rare: ['iron_ingot', 'carrot', 'potato'] },
  drowned: { cat: 'monster', hp: 20, speed: 0.23, dmg: 3, armor: 2, w: 0.6, h: 1.95, undead: true, burns: true, xp: 5, follow: 35, ai: 'melee', swimmer: true, drops: [['rotten_flesh', 0, 2], ['copper_ingot', 1, 1, { chance: 0.11, player: true }]] },
  zombie_villager: { cat: 'monster', hp: 20, speed: 0.23, dmg: 3, armor: 2, w: 0.6, h: 1.95, undead: true, burns: true, xp: 5, follow: 35, ai: 'melee', drops: [['rotten_flesh', 0, 2]], rare: ['iron_ingot', 'carrot', 'potato'] },
  zombified_piglin: { cat: 'monster', hp: 20, speed: 0.23, dmg: 5, armor: 2, w: 0.6, h: 1.95, undead: true, fireImmune: true, xp: 5, follow: 35, ai: 'melee', neutral: true, held: 'golden_sword', drops: [['rotten_flesh', 0, 1], ['gold_nugget', 0, 1]], rare: ['gold_ingot'] },
  piglin: { cat: 'monster', hp: 16, speed: 0.35, dmg: 5, w: 0.6, h: 1.95, xp: 5, follow: 16, ai: 'melee', neutral: true, held: 'golden_sword', drops: [] },
  skeleton: { cat: 'monster', hp: 20, speed: 0.25, dmg: 2, w: 0.6, h: 1.99, undead: true, burns: true, xp: 5, follow: 16, ai: 'ranged', drops: [['bone', 0, 2], ['arrow', 0, 2]] },
  stray: { cat: 'monster', hp: 20, speed: 0.25, dmg: 2, w: 0.6, h: 1.99, undead: true, burns: true, xp: 5, follow: 16, ai: 'ranged', arrowEffect: ['slowness', 600], drops: [['bone', 0, 2], ['arrow', 0, 2]] },
  wither_skeleton: { cat: 'monster', hp: 20, speed: 0.25, dmg: 8, w: 0.7, h: 2.4, undead: true, fireImmune: true, xp: 5, follow: 16, ai: 'melee', held: 'stone_sword', hitEffect: ['wither', 200], drops: [['coal', 0, 1, { chance: 0.33 }], ['bone', 0, 2]] },
  creeper: { cat: 'monster', hp: 20, speed: 0.25, dmg: 0, w: 0.6, h: 1.7, xp: 5, follow: 16, ai: 'creeper', drops: [['gunpowder', 0, 2]] },
  spider: { cat: 'monster', hp: 16, speed: 0.3, dmg: 2, w: 1.4, h: 0.9, xp: 5, follow: 16, ai: 'spider', climbs: true, drops: [['string', 0, 2], ['spider_eye', 0, 1, { chance: 0.33, player: true }]] },
  cave_spider: { cat: 'monster', hp: 12, speed: 0.3, dmg: 2, w: 0.7, h: 0.5, xp: 5, follow: 16, ai: 'spider', climbs: true, hitEffect: ['poison', 140], drops: [['string', 0, 2], ['spider_eye', 0, 1, { chance: 0.33, player: true }]] },
  enderman: { cat: 'monster', hp: 40, speed: 0.3, dmg: 7, w: 0.6, h: 2.9, xp: 5, follow: 64, ai: 'enderman', neutral: true, waterHurts: true, drops: [['ender_pearl', 0, 1]] },
  slime: { cat: 'monster', hp: 1, speed: 0.3, dmg: 0, w: 0.52, h: 0.52, xp: 1, follow: 16, ai: 'slime', drops: [['slime_ball', 0, 2]] },
  magma_cube: { cat: 'monster', hp: 1, speed: 0.4, dmg: 3, w: 0.52, h: 0.52, xp: 1, follow: 16, ai: 'slime', fireImmune: true, drops: [['magma_cream', 0, 1, { chance: 0.25 }]] },
  witch: { cat: 'monster', hp: 26, speed: 0.25, dmg: 0, w: 0.6, h: 1.95, xp: 5, follow: 16, ai: 'witch', drops: [['glass_bottle', 0, 2, { chance: 0.6 }], ['glowstone_dust', 0, 2, { chance: 0.6 }], ['gunpowder', 0, 2, { chance: 0.6 }], ['redstone', 0, 2, { chance: 0.6 }], ['spider_eye', 0, 2, { chance: 0.6 }], ['sugar', 0, 2, { chance: 0.6 }], ['stick', 0, 2, { chance: 0.6 }]] },
  silverfish: { cat: 'monster', hp: 8, speed: 0.25, dmg: 1, w: 0.4, h: 0.3, xp: 5, follow: 16, ai: 'melee', drops: [] },
  endermite: { cat: 'monster', hp: 8, speed: 0.25, dmg: 2, w: 0.4, h: 0.3, xp: 3, follow: 16, ai: 'melee', drops: [] },
  phantom: { cat: 'monster', hp: 20, speed: 0.6, dmg: 6, w: 0.9, h: 0.5, undead: true, burns: true, xp: 5, follow: 64, ai: 'phantom', flyer: true, drops: [['phantom_membrane', 0, 1, { player: true }]] },
  blaze: { cat: 'monster', hp: 20, speed: 0.23, dmg: 6, armor: 6, w: 0.6, h: 1.8, fireImmune: true, xp: 10, follow: 48, ai: 'blaze', flyer: true, waterHurts: true, drops: [['blaze_rod', 0, 1, { player: true }]] },
  // ---------------------------------------------------------------- passive / neutral
  pig: { cat: 'creature', hp: 10, speed: 0.25, w: 0.9, h: 0.9, ai: 'animal', breed: ['carrot', 'potato', 'beetroot'], tempt: ['carrot', 'potato', 'beetroot', 'carrot_on_a_stick'], drops: [['porkchop', 1, 3, { cooked: true }]] },
  cow: { cat: 'creature', hp: 10, speed: 0.2, w: 0.9, h: 1.4, ai: 'animal', breed: ['wheat'], milk: true, drops: [['leather', 0, 2], ['beef', 1, 3, { cooked: true }]] },
  mooshroom: { cat: 'creature', hp: 10, speed: 0.2, w: 0.9, h: 1.4, ai: 'animal', breed: ['wheat'], milk: true, drops: [['leather', 0, 2], ['beef', 1, 3, { cooked: true }]] },
  sheep: { cat: 'creature', hp: 8, speed: 0.23, w: 0.9, h: 1.3, ai: 'animal', breed: ['wheat'], drops: [['mutton', 1, 2, { cooked: true }]] },
  chicken: { cat: 'creature', hp: 4, speed: 0.25, w: 0.4, h: 0.7, ai: 'animal', breed: SEEDS, drops: [['feather', 0, 2], ['chicken', 1, 1, { cooked: true }]] },
  rabbit: { cat: 'creature', hp: 3, speed: 0.3, w: 0.4, h: 0.5, ai: 'animal', hops: true, breed: ['carrot', 'golden_carrot', 'dandelion'], drops: [['rabbit_hide', 0, 1], ['rabbit', 0, 1, { cooked: true }], ['rabbit_foot', 1, 1, { chance: 0.1, player: true }]], spawnOn: ['grass_block', 'sand', 'snow_block', 'snow'] },
  horse: { cat: 'creature', hp: 22, speed: 0.225, w: 1.4, h: 1.6, ai: 'animal', breed: ['golden_carrot', 'golden_apple'], tempt: ['golden_carrot', 'golden_apple', 'wheat', 'sugar', 'apple', 'hay_block'], drops: [['leather', 0, 2]] },
  donkey: { cat: 'creature', hp: 22, speed: 0.175, w: 1.4, h: 1.5, ai: 'animal', breed: ['golden_carrot', 'golden_apple'], tempt: ['golden_carrot', 'golden_apple', 'wheat', 'sugar', 'apple', 'hay_block'], drops: [['leather', 0, 2]] },
  llama: { cat: 'creature', hp: 22, speed: 0.175, w: 0.9, h: 1.87, ai: 'animal', breed: ['hay_block'], tempt: ['hay_block', 'wheat'], drops: [['leather', 0, 2]] },
  goat: { cat: 'creature', hp: 10, speed: 0.2, w: 0.9, h: 1.3, ai: 'animal', breed: ['wheat'], milk: true, rams: true, drops: [], spawnOn: ['stone', 'snow_block', 'snow', 'gravel', 'grass_block'] },
  wolf: { cat: 'creature', hp: 8, speed: 0.3, dmg: 4, w: 0.6, h: 0.85, ai: 'wolf', neutral: true, breed: MEATS, tameItem: 'bone', drops: [] },
  cat: { cat: 'creature', hp: 10, speed: 0.3, dmg: 3, w: 0.6, h: 0.7, ai: 'pet', breed: ['cod', 'salmon'], tameItem: 'cod', tameItem2: 'salmon', drops: [['string', 0, 2]] },
  ocelot: { cat: 'creature', hp: 10, speed: 0.3, dmg: 3, w: 0.6, h: 0.7, ai: 'animal', shy: true, breed: ['cod', 'salmon'], tempt: ['cod', 'salmon'], drops: [] },
  fox: { cat: 'creature', hp: 10, speed: 0.3, dmg: 2, w: 0.6, h: 0.7, ai: 'animal', shy: true, breed: ['sweet_berries'], tempt: ['sweet_berries'], drops: [], spawnOn: ['grass_block', 'snow', 'snow_block', 'podzol', 'coarse_dirt'] },
  polar_bear: { cat: 'creature', hp: 30, speed: 0.25, dmg: 6, w: 1.4, h: 1.4, ai: 'bear', neutral: true, drops: [['cod', 0, 2, { chance: 0.75, cooked: true }], ['salmon', 0, 2, { chance: 0.25, cooked: true }]], spawnOn: ['snow_block', 'snow', 'ice', 'packed_ice', 'grass_block'] },
  panda: { cat: 'creature', hp: 20, speed: 0.15, dmg: 6, w: 1.3, h: 1.25, ai: 'animal', drops: [] },
  parrot: { cat: 'creature', hp: 6, speed: 0.2, w: 0.5, h: 0.9, ai: 'pet', flyer: true, tameItem: 'wheat_seeds', tameItem2: 'melon_seeds', drops: [['feather', 1, 2]], spawnOn: ['grass_block', 'jungle_leaves', 'oak_leaves'] },
  turtle: { cat: 'creature', hp: 30, speed: 0.25, w: 1.2, h: 0.4, ai: 'animal', swimmer: true, breed: ['seagrass'], tempt: ['seagrass'], drops: [['seagrass', 0, 2]], spawnOn: ['sand'] },
  frog: { cat: 'creature', hp: 10, speed: 1.0 * 0.25, w: 0.5, h: 0.5, ai: 'animal', hops: true, swimmer: true, breed: ['slime_ball'], tempt: ['slime_ball'], drops: [], spawnOn: ['grass_block', 'mud', 'dirt'] },
  axolotl: { cat: 'water_creature', hp: 14, speed: 0.2, dmg: 2, w: 0.75, h: 0.42, ai: 'swim', aquaticLoose: true, breed: ['tropical_fish'], tempt: ['tropical_fish'], drops: [] },
  squid: { cat: 'water_creature', hp: 10, speed: 0.2, w: 0.8, h: 0.8, ai: 'squid', aquatic: true, drops: [['ink_sac', 1, 3]] },
  glow_squid: { cat: 'water_creature', hp: 10, speed: 0.2, w: 0.8, h: 0.8, ai: 'squid', aquatic: true, drops: [['glow_ink_sac', 1, 3]] },
  dolphin: { cat: 'water_creature', hp: 10, speed: 1.2 * 0.25, dmg: 3, w: 0.9, h: 0.6, ai: 'swim', aquatic: true, neutral: true, drops: [['cod', 0, 1, { cooked: true }]] },
  bat: { cat: 'ambient', hp: 6, speed: 0.1, w: 0.5, h: 0.9, ai: 'bat', flyer: true, drops: [] },
  bee: { cat: 'creature', hp: 10, speed: 0.3, dmg: 2, w: 0.7, h: 0.6, ai: 'bee', flyer: true, neutral: true, hitEffect: ['poison', 200], breed: ['dandelion', 'poppy', 'blue_orchid', 'allium', 'azure_bluet', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'oxeye_daisy', 'cornflower', 'lily_of_the_valley', 'sunflower'], drops: [] },
  villager: { cat: 'misc', hp: 20, speed: 0.3, w: 0.6, h: 1.95, ai: 'villager', drops: [] },
  wandering_trader: { cat: 'misc', hp: 20, speed: 0.3, w: 0.6, h: 1.95, ai: 'villager', drops: [] },
  iron_golem: { cat: 'misc', hp: 100, speed: 0.25, dmg: 7, w: 1.4, h: 2.7, kbRes: 1, ai: 'golem', drops: [['iron_ingot', 3, 5], ['poppy', 0, 2]] },
  snow_golem: { cat: 'misc', hp: 4, speed: 0.2, w: 0.7, h: 1.9, ai: 'snow_golem', waterHurts: true, drops: [['snowball', 0, 15]] },
  // ---- feature packs: add mob definitions inside your own region ----
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

};

const VILLAGER_PROFESSIONS = ['Farmer', 'Librarian', 'Cleric', 'Armorer', 'Butcher', 'Cartographer', 'Fisherman', 'Fletcher', 'Leatherworker', 'Mason', 'Shepherd', 'Toolsmith', 'Weaponsmith', 'Nitwit'];

// natural wool colours (MC probabilities)
function randomWool(r) {
  if (r < 0.05) return 'black'; if (r < 0.10) return 'gray'; if (r < 0.15) return 'light_gray';
  if (r < 0.18) return 'brown'; if (r < 0.18164) return 'pink'; return 'white';
}

export function createMob(game, type, x, y, z, opts = {}) {
  if (!MOBS[type]) return null;
  if (type === 'slime' || type === 'magma_cube') return new Slime(game, type, x, y, z, opts);
  // ---- feature packs: custom mob classes ----
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

  return new Mob(game, type, x, y, z, opts);
}

const rand = (n) => Math.floor(Math.random() * n);

export class Mob extends LivingEntity {
  constructor(game, type, x, y, z, opts = {}) {
    super(game, x, y, z);
    const d = MOBS[type];
    this.type = 'mob';
    this.mobType = type;
    this.def = d;
    this.displayName = titleCase(type);
    this.width = d.w; this.height = d.h;
    this.maxHealth = this.health = d.hp;
    this.movementSpeed = d.speed;
    this.attackDamage = d.dmg || 0;
    this.knockbackResistance = d.kbRes || 0;
    this.hostile = d.cat === 'monster';
    this.undead = !!d.undead;
    this.fireImmune = !!d.fireImmune;
    this.canBreatheUnderwater = !!(d.undead || d.aquatic || d.aquaticLoose || type === 'turtle' || type === 'frog' || type === 'iron_golem');
    this.noGravity = !!d.flyer;
    this.variant = '';
    this.baby = false; this.growAge = 0;
    this.speedMul = 1;
    this.target = null; this.angryAt = null; this.angerTime = 0;
    this.wander = null; this.wanderTime = 0;
    this.panic = 0; this.inLove = 0; this.breedCooldown = 0; this.lovePartner = null;
    this.attackTime = 0; this.rangedTime = 0;
    this.lookTarget = null; this.lookTime = 0;
    this.ambientTime = -rand(80);
    this.noActionTime = 0;
    this.persistent = !!opts.persistent || d.cat === 'creature' || d.cat === 'misc' || d.cat === 'water_creature' && type === 'axolotl';
    this.tamed = false; this.sitting = false;
    this.heldItem = d.held ? ITEM[d.held] : null;
    this.woolColor = 'white'; this.sheared = false;
    this.swell = 0; this.prevSwell = 0; this.charged = false;
    this.eggTime = 6000 + rand(6000);
    this.stuckTime = 0;
    this.waterTime = 0;
    this.yaw = Math.random() * Math.PI * 2;
    this.bodyYaw = this.yaw;
    if (opts.baby) this.setBaby(true);
  }
  get eyeHeight() { return this.height * 0.85; }

  setBaby(b) {
    this.baby = b;
    this.growAge = b ? -24000 : 0;
    const d = this.def;
    this.width = d.w * (b ? 0.5 : 1); this.height = d.h * (b ? 0.5 : 1);
  }

  // called once when a mob is newly spawned (not when loaded)
  onSpawned(opts = {}) {
    const t = this.mobType, g = this.game;
    if (opts.fromEgg) this.persistent = true;
    if (t === 'sheep') this.woolColor = randomWool(Math.random());
    if ((t === 'zombie' || t === 'husk' || t === 'drowned' || t === 'zombie_villager' || t === 'zombified_piglin') && !opts.baby && Math.random() < 0.05) this.setBaby(true);
    if (t === 'zombie' || t === 'husk' || t === 'drowned' || t === 'zombie_villager') {
      if (Math.random() < 0.05 * g.difficulty / 3) this.heldItem = ITEM[Math.random() < 1 / 3 ? 'iron_sword' : 'iron_shovel'];
      if (t === 'drowned' && Math.random() < 0.0625) this.heldItem = ITEM.trident;
    }
    if (t === 'villager') this.variant = VILLAGER_PROFESSIONS[rand(VILLAGER_PROFESSIONS.length)];
    if (t === 'horse') { this.maxHealth = this.health = 15 + rand(8) + rand(9); this.movementSpeed = (0.45 + Math.random() * 0.3 + Math.random() * 0.3 + Math.random() * 0.3) * 0.25; this.variant = String(rand(7)); }
    if (t === 'donkey' || t === 'llama') { this.maxHealth = this.health = 15 + rand(8) + rand(9); this.variant = String(rand(4)); }
    if (t === 'cat' || t === 'rabbit' || t === 'fox' || t === 'parrot' || t === 'axolotl' || t === 'frog') this.variant = String(rand(t === 'cat' ? 11 : 5));
    if (t === 'wolf' && this.tamed) this.maxHealth = this.health = 20;
    if (t === 'creeper' && opts.charged) this.charged = true;
    if (t === 'enderman' || t === 'witch') this.ambientTime = -rand(200);
    if (opts.baby) this.setBaby(true);
  }

  // ----------------------------------------------------------------- persistence
  save() {
    if (this.dead) return null;
    return {
      type: 'mob', mob: this.mobType, x: this.x, y: this.y, z: this.z, yaw: this.yaw, health: this.health, maxHealth: this.maxHealth,
      variant: this.variant, baby: this.baby, growAge: this.growAge, woolColor: this.woolColor, sheared: this.sheared, tamed: this.tamed,
      sitting: this.sitting, persistent: this.persistent, charged: this.charged, speed: this.movementSpeed, held: this.heldItem ? this.heldItem.name : null,
      name: this.customName || null, size: this.size || 0, fireTicks: this.fireTicks,
    };
  }
  load(d) {
    this.yaw = this.bodyYaw = d.yaw || 0;
    if (d.maxHealth) this.maxHealth = d.maxHealth;
    if (d.health !== undefined) this.health = d.health;
    this.variant = d.variant || '';
    if (d.baby) { this.setBaby(true); this.growAge = d.growAge ?? -24000; }
    this.woolColor = d.woolColor || 'white'; this.sheared = !!d.sheared;
    this.tamed = !!d.tamed; this.sitting = !!d.sitting; this.persistent = !!d.persistent; this.charged = !!d.charged;
    if (d.speed) this.movementSpeed = d.speed;
    this.heldItem = d.held ? ITEM[d.held] || null : this.heldItem;
    if (d.name) { this.customName = d.name; this.displayName = d.name; }
    this.fireTicks = d.fireTicks || 0;
  }

  // ----------------------------------------------------------------- stats
  armorValue() { return this.def.armor || 0; }
  speedValue() {
    let s = this.movementSpeed * this.speedMul;
    if (this.baby && (this.def.undead || this.mobType === 'piglin')) s *= 1.5;
    if (this.hasEffect('speed')) s *= 1 + 0.2 * (this.effectAmp('speed') + 1);
    if (this.hasEffect('slowness')) s *= Math.max(0, 1 - 0.15 * (this.effectAmp('slowness') + 1));
    return s;
  }
  get player() { return this.game.player; }
  playerTargetable(p) { return p && !p.dead && !p.removed && (p.gameMode === 0 || p.gameMode === 2) && this.game.difficulty > 0; }

  // ----------------------------------------------------------------- damage & death
  hurt(src, amount) {
    if (src.type === 'arrow' && this.mobType === 'enderman') { this.teleportRandom(); return false; }
    if (this.mobType === 'iron_golem' && src.type === 'fall') return false;
    if (this.mobType === 'blaze' && src.type === 'thrown' && amount > 0) { /* snowballs hurt blazes */ }
    if (src.type === 'drown' && this.canBreatheUnderwater && !this.def.aquatic) return false;
    if (this.def.flyer && src.type === 'fall') return false;
    const ok = super.hurt(src, amount);
    if (ok && src.attacker && !this.dead) this.onAttacked(src.attacker);
    return ok;
  }
  onAttacked(a) {
    const d = this.def;
    this.noActionTime = 0;
    if (a === this) return;
    if (d.ai === 'animal' || d.ai === 'pet' && !this.tamed || d.ai === 'villager' || d.ai === 'squid' || d.ai === 'bat' || (d.ai === 'swim' && !d.neutral)) { this.panic = 100; this.wander = null; return; }
    if (d.ai === 'pet' && this.tamed) { this.sitting = false; return; }
    if (d.ai === 'enderman' && Math.random() < 0.6) this.teleportRandom();
    if (a.isPlayer && !this.playerTargetable(a)) return;
    if (d.neutral || d.cat === 'monster' || d.ai === 'golem' || d.ai === 'wolf' || d.ai === 'bear') {
      if (this.tamed && a.isPlayer) return;
      this.target = a; this.angryAt = a; this.angerTime = 400 + rand(400);
      // pack anger
      if (this.mobType === 'zombified_piglin' || this.mobType === 'wolf' || this.mobType === 'bee' || this.mobType === 'piglin') {
        for (const e of this.game.entities) if (e !== this && e.mobType === this.mobType && !e.tamed && e.distSq(this) < 400 && !e.dead) { e.target = a; e.angryAt = a; e.angerTime = 400 + rand(400); }
      }
    }
  }
  onHurt(src, dmg, flash) {
    if (flash) this.game.sound.at(`entity.${this.mobType}.hurt`, this.x, this.y + this.height / 2, this.z, 1, this.voicePitch());
    if ((this.mobType === 'squid' || this.mobType === 'glow_squid') && this.game.particles) for (let i = 0; i < 20; i++) this.game.particles.spawn('large_smoke', this.x, this.y + 0.4, this.z, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3);
    if (this.mobType === 'blaze' || this.mobType === 'enderman') { if (Math.random() < 0.3 && this.mobType === 'enderman') this.teleportRandom(); }
  }
  voicePitch() { return (Math.random() - Math.random()) * 0.2 + (this.baby ? 1.5 : 1); }
  killerPlayer() {
    const a = this.lastAttacker;
    return a && a.isPlayer && this.age - this.lastAttackerTime < 100 ? a : null;
  }
  onDeath(src) {
    const g = this.game;
    g.sound.at(`entity.${this.mobType}.death`, this.x, this.y + this.height / 2, this.z, 1, this.voicePitch());
    const killer = this.killerPlayer() || (src.attacker && src.attacker.isPlayer ? src.attacker : null);
    if (killer) killer.statistics.mobsKilled++;
    if (this.mobType === 'creeper' && src.attacker && (src.attacker.mobType === 'skeleton' || src.attacker.mobType === 'stray')) g.dropItem(this.x, this.y + 0.5, this.z, new ItemStack('music_disc_13', 1));
    if (!g.rules.doMobLoot || this.baby) return;
    const looting = killer ? enchantLevel(killer.inventory.selected(), 'looting') : 0;
    const onFire = this.fireTicks > 0;
    for (const [name, mn, mx, o = {}] of this.def.drops) {
      if (o.player && !killer) continue;
      if (o.chance && Math.random() >= o.chance + looting * 0.01) continue;
      let n = mn + rand(mx - mn + 1) + (looting ? rand(looting + 1) : 0);
      if (n <= 0) continue;
      const item = o.cooked && onFire && COOKED[name] ? COOKED[name] : name;
      if (!ITEM[item]) continue;
      g.dropItem(this.x, this.y + this.height / 2, this.z, new ItemStack(item, n));
    }
    if (this.mobType === 'sheep' && !this.sheared) g.dropItem(this.x, this.y + 0.6, this.z, new ItemStack(`${this.woolColor}_wool`, 1));
    if (this.def.rare && killer && Math.random() < 0.025 + looting * 0.01) g.dropItem(this.x, this.y + 0.5, this.z, new ItemStack(this.def.rare[rand(this.def.rare.length)], 1));
    if (this.heldItem && killer && Math.random() < 0.085) g.dropItem(this.x, this.y + 0.5, this.z, new ItemStack(this.heldItem, 1, Math.floor((this.heldItem.durability || 0) * Math.random() * 0.8)));
    if (this.mobType === 'wither_skeleton' && killer && Math.random() < 0.025 && ITEM.wither_skeleton_skull) g.dropItem(this.x, this.y + 0.5, this.z, new ItemStack('wither_skeleton_skull', 1));
    this.xpDrop = killer ? this.xpReward() : 0;
  }
  xpReward() {
    const d = this.def;
    if (d.cat === 'monster') return (this.mobType === 'slime' || this.mobType === 'magma_cube') ? this.size : d.xp || 5;
    if (d.cat === 'creature' || d.cat === 'water_creature') return this.baby ? 0 : 1 + rand(3);
    return 0;
  }
  onRemovedAfterDeath() {
    const g = this.game;
    if (g.particles) for (let i = 0; i < 20; i++) g.particles.spawn('poof', this.x + (Math.random() - 0.5) * this.width * 2, this.y + Math.random() * this.height, this.z + (Math.random() - 0.5) * this.width * 2, (Math.random() - 0.5) * 0.04, Math.random() * 0.04, (Math.random() - 0.5) * 0.04);
    if (this.xpDrop) g.spawnXp(this.x, this.y + 0.3, this.z, this.xpDrop);
  }

  // ----------------------------------------------------------------- interaction (right click)
  interact(p, stack, hand) {
    const g = this.game, t = this.mobType, d = this.def;
    if (this.dead) return false;
    const it = stack ? stack.item : null;
    const consume = (n = 1) => { if (p.gameMode !== 1) { stack.count -= n; if (stack.count <= 0) g.interaction.setHand(hand, null); } };
    const give = (name) => {
      const s = new ItemStack(name, 1);
      if (p.gameMode === 1) { if (!p.inventory.count || p.inventory.count(name) === 0) p.inventory.add(s); return; }
      if (stack.count === 1) g.interaction.setHand(hand, s);
      else { stack.count--; if (p.inventory.add(s) > 0) g.dropFromPlayer(s); }
    };
    if (it && it.kind === 'spawn_egg' && it.mob === t) {
      g.spawnMob(t, this.x, this.y, this.z, { baby: true, fromEgg: true }); consume(); return true;
    }
    if (it && it.name === 'name_tag' && stack.tag && stack.tag.name) { this.customName = this.displayName = stack.tag.name; this.persistent = true; consume(); return true; }
    // milking
    if (it && it.name === 'bucket' && d.milk && !this.baby) { give('milk_bucket'); g.sound.at(t === 'goat' ? 'entity.goat.milk' : 'entity.cow.milk', this.x, this.y, this.z); return true; }
    if (it && it.name === 'bowl' && t === 'mooshroom' && !this.baby) { give('mushroom_stew'); g.sound.at('entity.cow.milk', this.x, this.y, this.z); return true; }
    // shearing
    if (it && it.name === 'shears') {
      if (t === 'sheep' && !this.sheared && !this.baby) {
        this.sheared = true;
        const n = 1 + rand(3);
        for (let i = 0; i < n; i++) { const e = g.dropItem(this.x, this.y + 1, this.z, new ItemStack(`${this.woolColor}_wool`, 1)); if (e) { e.vy += Math.random() * 0.05; e.vx += (Math.random() - Math.random()) * 0.1; e.vz += (Math.random() - Math.random()) * 0.1; } }
        g.sound.at('entity.sheep.shear', this.x, this.y, this.z);
        if (p.gameMode !== 1 && stack.hurt(1)) g.interaction.setHand(hand, null);
        return true;
      }
      if (t === 'mooshroom' && !this.baby) {
        this.remove();
        const c = g.spawnMob('cow', this.x, this.y, this.z); if (c) { c.yaw = c.bodyYaw = this.yaw; c.health = this.health; }
        g.dropItem(this.x, this.y + this.height, this.z, new ItemStack('red_mushroom', 5));
        g.particles && g.particles.spawn('explosion', this.x, this.y + this.height / 2, this.z, 0, 0, 0);
        g.sound.at('entity.sheep.shear', this.x, this.y, this.z);
        if (p.gameMode !== 1 && stack.hurt(1)) g.interaction.setHand(hand, null);
        return true;
      }
      if (t === 'snow_golem' && this.variant !== 'sheared') { this.variant = 'sheared'; g.sound.at('entity.sheep.shear', this.x, this.y, this.z); return true; }
    }
    // dyeing sheep
    if (it && it.kind === 'dye' && t === 'sheep' && !this.sheared) {
      const color = it.name.replace(/_dye$/, '');
      if (color !== this.woolColor) { this.woolColor = color; consume(); return true; }
    }
    if (it && it.name === 'flint_and_steel' && t === 'creeper') { this.ignite(); if (p.gameMode !== 1 && stack.hurt(1)) g.interaction.setHand(hand, null); return true; }
    if (it && it.name === 'iron_ingot' && t === 'iron_golem' && this.health < this.maxHealth) { this.heal(25); consume(); g.sound.at('entity.iron_golem.repair', this.x, this.y, this.z); return true; }
    // taming
    if (d.tameItem && !this.tamed && it && (it.name === d.tameItem || it.name === d.tameItem2) && !(t === 'wolf' && this.angryAt)) {
      consume();
      if (Math.random() < 1 / 3) {
        this.tamed = true; this.persistent = true; this.sitting = true; this.target = null;
        if (t === 'wolf') { this.maxHealth = 20; this.health = 20; }
        this.hearts(7);
      } else this.smoke(7);
      return true;
    }
    if (this.tamed) {
      if (it && d.breed && d.breed.includes(it.name) && this.health < this.maxHealth) { this.heal(it.food ? it.food.n : 2); consume(); this.hearts(3); return true; }
      if (it && d.breed && d.breed.includes(it.name) && !this.baby && this.breedCooldown <= 0 && !this.inLove) { this.inLove = 600; consume(); this.hearts(5); return true; }
      if (!it || !it.food) { this.sitting = !this.sitting; this.wander = null; this.target = null; return true; }
    }
    // breeding / feeding
    if (it && d.breed && d.breed.includes(it.name) && !this.tamed) {
      if (this.baby) { this.growAge = Math.min(0, this.growAge + Math.floor(-this.growAge * 0.1)); consume(); this.happy(); return true; }
      if (this.breedCooldown <= 0 && !this.inLove) { this.inLove = 600; consume(); this.hearts(5); g.sound.at(`entity.${t}.ambient`, this.x, this.y, this.z); return true; }
    }
    if (t === 'villager' || t === 'wandering_trader') {
      if (this.baby) return false;
      g.sound.at('entity.villager.ambient', this.x, this.y, this.z);
      g.showActionbar(t === 'villager' ? `${this.variant || 'Villager'}: trading is not available yet in Minecraft_Lite` : 'Wandering Trader: trading is not available yet');
      this.lookTarget = p; this.lookTime = 60;
      return true;
    }
    if ((t === 'horse' || t === 'donkey' || t === 'llama') && !it) {
      g.showActionbar('Riding is not available yet in Minecraft_Lite');
      this.lookTarget = p; this.lookTime = 40;
      return true;
    }
    return false;
  }
  hearts(n) { const g = this.game; if (g.particles) for (let i = 0; i < n; i++) g.particles.spawn('heart', this.x + (Math.random() - 0.5) * this.width * 2, this.y + 0.5 + Math.random() * this.height, this.z + (Math.random() - 0.5) * this.width * 2, 0, 0.02, 0); }
  smoke(n) { const g = this.game; if (g.particles) for (let i = 0; i < n; i++) g.particles.spawn('smoke', this.x + (Math.random() - 0.5) * this.width * 2, this.y + 0.5 + Math.random() * this.height, this.z + (Math.random() - 0.5) * this.width * 2, 0, 0.02, 0); }
  happy() { const g = this.game; if (g.particles) for (let i = 0; i < 6; i++) g.particles.spawn('happy_villager', this.x + (Math.random() - 0.5) * this.width * 2, this.y + 0.5 + Math.random() * this.height, this.z + (Math.random() - 0.5) * this.width * 2, 0, 0, 0); }
  ignite() { if (this.swell <= 0) this.game.sound.at('entity.creeper.primed', this.x, this.y, this.z, 1, 0.5); this.ignited = true; }
  onLightning() {
    const g = this.game, t = this.mobType;
    const convert = (to) => { if (this.removed) return; this.remove(); const m = g.spawnMob(to, this.x, this.y, this.z); if (m) { m.yaw = m.bodyYaw = this.yaw; m.persistent = true; } };
    if (t === 'creeper') this.charged = true;
    else if (t === 'pig') convert('zombified_piglin');
    else if (t === 'villager') convert('witch');
    else if (t === 'mooshroom') this.variant = this.variant === 'brown' ? '' : 'brown';
  }

  // ----------------------------------------------------------------- tick
  tick() {
    this.prevSwell = this.swell;
    if (this.squishPrev !== undefined) this.prevSquish = this.squish;
    super.tick();
    if (this.removed || this.dead) return;
    const g = this.game;
    // ageing
    if (this.growAge < 0) { this.growAge++; if (this.growAge >= 0) { this.setBaby(false); if (this.mobType === 'turtle') g.dropItem(this.x, this.y + 0.3, this.z, new ItemStack('turtle_scute', 1)); } }
    else if (this.growAge > 0) this.growAge--;
    if (this.breedCooldown > 0) this.breedCooldown--;
    if (this.inLove > 0) { this.inLove--; if (this.age % 10 === 0) this.hearts(1); }
    // ambient sounds
    if (Math.random() * 1000 < this.ambientTime++) {
      this.ambientTime = -80;
      if (this.mobType !== 'iron_golem' && this.mobType !== 'snow_golem' && !(this.def.aquatic && this.mobType !== 'dolphin')) g.sound.at(`entity.${this.mobType}.ambient`, this.x, this.y + this.height / 2, this.z, this.def.cat === 'ambient' ? 0.1 : 1, this.voicePitch());
    }
    // sunlight burning
    if (this.def.burns && !this.baby && this.age % 4 === 0 && this.isInSunlight()) this.setOnFire(8);
    // water / rain sensitivity
    if (this.def.waterHurts && (this.inWater || this.inRain())) {
      this.hurt({ type: 'drown', bypassArmor: true }, 1);
      if (this.mobType === 'enderman' && this.age % 20 === 0) this.teleportRandom();
    }
    if (this.mobType === 'snow_golem') this.snowGolemTick();
    // aquatic mobs dry out
    if (this.def.aquatic) {
      if (this.inWater) this.dryTime = 0; else if (++this.dryTime > (this.mobType === 'dolphin' ? 2400 : 20) && this.age % 20 === 0) this.hurt({ type: 'drown', bypassArmor: true }, 2);
    } else if (this.def.aquaticLoose) {
      if (this.inWater) this.dryTime = 0; else if (++this.dryTime > 6000 && this.age % 20 === 0) this.hurt({ type: 'drown', bypassArmor: true }, 1);
    }
    // zombie -> drowned conversion after 30s fully submerged
    if ((this.mobType === 'zombie' || this.mobType === 'husk') && this.eyeInWater) {
      if (++this.waterTime > 600 + 300) { this.convertTo(this.mobType === 'husk' ? 'zombie' : 'drowned'); return; }
    } else this.waterTime = 0;
    // chickens lay eggs
    if (this.mobType === 'chicken' && !this.baby && --this.eggTime <= 0) {
      g.dropItem(this.x, this.y + 0.3, this.z, new ItemStack('egg', 1));
      g.sound.at('entity.chicken.egg', this.x, this.y, this.z, 1, (Math.random() - Math.random()) * 0.2 + 1);
      this.eggTime = 6000 + rand(6000);
    }
    // anger cooldown
    if (this.angerTime > 0 && --this.angerTime <= 0) { this.angryAt = null; if (this.def.neutral) this.target = null; }
    // creeper swell
    if (this.mobType === 'creeper') this.creeperTick();
    // despawning
    this.checkDespawn();
    // push apart from other entities
    if (this.age % 2 === 0) this.pushEntities();
  }
  convertTo(type) {
    const g = this.game;
    this.remove();
    const m = g.spawnMob(type, this.x, this.y, this.z, { baby: this.baby });
    if (m) { m.yaw = m.bodyYaw = this.yaw; m.persistent = this.persistent; m.heldItem = this.heldItem; }
    g.sound.at('entity.zombie.converted_to_drowned', this.x, this.y, this.z);
  }
  isInSunlight() {
    const g = this.game;
    if (g.rainLevel > 0.2 || this.inWater || this.fireTicks > 0) return false;
    if (g.skyDarken > 3) return false;
    const w = this.world;
    const x = Math.floor(this.x), y = Math.floor(this.y + this.eyeHeight), z = Math.floor(this.z);
    if (w.getSkyLight(x, y, z) < 15) return false;
    return Math.random() * 30 < 15 - g.skyDarken;
  }
  inRain() {
    const g = this.game;
    if (g.rainLevel < 0.2) return false;
    const x = Math.floor(this.x), z = Math.floor(this.z);
    const b = BIOMES[this.world.biomeAt(x, z)];
    if (b && (b.rain === false || b.snow)) return false;
    return this.world.rainHeight(x, z) < this.y + this.height;
  }
  checkDespawn() {
    const g = this.game, p = g.player;
    if (this.hostile && g.difficulty === 0 && !this.customName) { this.remove(); return; }
    if (this.persistent || this.customName || this.tamed) return;
    const d2 = this.distSq(p);
    if (d2 > 128 * 128) { this.remove(); return; }
    this.noActionTime++;
    if (d2 < 32 * 32) this.noActionTime = 0;
    else if (this.noActionTime > 600 && Math.random() < 1 / 800) this.remove();
  }
  pushEntities() {
    const b = this.box;
    for (const e of this.game.entities) {
      if (e === this || e.dead || e.removed || !e.hurt || e.type === 'item' || e.type === 'xp_orb' || e.noPhysics) continue;
      if (Math.abs(e.x - this.x) > 2 || Math.abs(e.z - this.z) > 2) continue;
      if (!b.intersects(e.box)) continue;
      let dx = e.x - this.x, dz = e.z - this.z;
      let m = Math.max(Math.abs(dx), Math.abs(dz));
      if (m < 0.01) { dx = Math.random() - 0.5; dz = Math.random() - 0.5; m = 0.5; }
      const l = Math.sqrt(m);
      dx /= l; dz /= l;
      let k = 1 / l; if (k > 1) k = 1;
      dx *= k * 0.05; dz *= k * 0.05;
      this.vx -= dx; this.vz -= dz;
      if (!e.isPlayer || e.gameMode !== 3) { e.vx += dx; e.vz += dz; }
    }
  }

  // ----------------------------------------------------------------- AI helpers
  aiStep() {
    this.forward = 0; this.strafe = 0; this.jumping = false;
    this.speedMul = 1;
    this.lookYaw = null;
    if (!this.dead) this.updateAI();
    // look at something
    if (this.lookTarget && this.lookTime > 0) {
      this.lookTime--;
      const t = this.lookTarget;
      const dx = t.x - this.x, dz = t.z - this.z, dy = (t.y + (t.eyeHeight || 0)) - (this.y + this.eyeHeight);
      const ly = Math.atan2(-dx, dz);
      if (this.forward === 0) this.yaw = approachAngle(this.yaw, ly, 0.35);
      else this.lookYaw = ly;
      this.pitch += (Math.max(-1, Math.min(1, -Math.atan2(dy, Math.hypot(dx, dz)))) - this.pitch) * 0.3;
      if (t.removed || t.dead) this.lookTarget = null;
    } else this.pitch *= 0.8;
    super.aiStep();
    if (this.mobType === 'chicken' && !this.onGround && this.vy < 0) this.vy *= 0.6;
  }

  // turn toward and walk to (x, z) at the given speed multiplier; returns horizontal distance
  moveTowards(x, y, z, mul = 1) {
    const dx = x - this.x, dz = z - this.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.25) return d;
    const want = Math.atan2(-dx, dz);
    this.yaw = approachAngle(this.yaw, want, 0.5);
    this.speedMul = mul;
    const sv = this.speedValue();
    this.forward = Math.abs(wrapAngle(want - this.yaw)) < 1.2 ? sv : sv * 0.2;
    // jump over obstacles / float in water
    if (this.collidedH && (this.onGround || this.inWater)) { this.jumping = true; this.stuckTime++; } else this.stuckTime = Math.max(0, this.stuckTime - 1);
    if (this.def.climbs && this.collidedH) { this.vy = 0.2; this.fallDistance = 0; }
    if (this.def.flyer) {
      const dy = y - this.y;
      this.vy += (Math.sign(dy) * Math.min(Math.abs(dy), 1) * 0.1 - this.vy) * 0.1;
    } else if (this.inWater && (this.def.swimmer || this.def.aquatic || this.def.aquaticLoose)) {
      const dy = y - this.y;
      this.vy += Math.max(-0.02, Math.min(0.02, dy * 0.01));
      this.forward = sv * 3;
    }
    return d;
  }
  floatInWater() {
    if ((this.inWater || this.inLava) && !this.def.swimmer && !this.def.aquatic && !this.def.aquaticLoose && !this.def.flyer) {
      if (this.waterTop > this.y + this.height * 0.4 || this.inLava) this.jumping = true;
    }
  }
  // is it safe to keep walking forward? (no big drops, no lava/fire ahead)
  safeAhead() {
    if (this.def.flyer || this.def.aquatic) return true;
    const fx = -Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const ax = Math.floor(this.x + fx * (this.width / 2 + 0.5)), az = Math.floor(this.z + fz * (this.width / 2 + 0.5));
    const y = Math.floor(this.y + 0.01);
    const w = this.world;
    for (let dy = 0; dy <= 1; dy++) { const k = BLOCKS[w.getBlock(ax, y + dy, az)].kind; if (k === 'fire' || k === 'campfire' || (k === 'liquid' && BLOCKS[w.getBlock(ax, y + dy, az)].fluid === 'lava') || k === 'berry_bush' || k === 'cactus') return false; }
    if (!this.onGround) return true;
    for (let d = 0; d <= 3; d++) {
      const id = w.getBlock(ax, y - 1 - d, az);
      const def = BLOCKS[id];
      if (def.solid) return true;
      if (def.kind === 'liquid') return def.fluid === 'water';
    }
    return false;
  }
  canSee(e) {
    const ex = this.x, ey = this.y + this.eyeHeight, ez = this.z;
    const tx = e.x, ty = e.y + (e.eyeHeight || e.height * 0.85), tz = e.z;
    const dx = tx - ex, dy = ty - ey, dz = tz - ez;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 0.5) return true;
    const h = this.game.raycast(ex, ey, ez, dx / d, dy / d, dz / d, d, { fluids: false });
    return !h || h.dist >= d - 0.3 || !BLOCKS[h.id].solid;
  }
  wanderTick(chance = 1 / 120, range = 10, mul = 1) {
    if (!this.wander && Math.random() < chance) this.pickWander(range);
    if (this.wander) {
      const w = this.wander;
      const d = this.moveTowards(w.x, w.y, w.z, mul);
      if (!this.safeAhead()) { this.forward = 0; this.wander = null; return; }
      if (d < 0.7 || ++this.wanderTime > 200 || this.stuckTime > 30) { this.wander = null; this.stuckTime = 0; }
    }
  }
  pickWander(range) {
    const w = this.world;
    for (let i = 0; i < 10; i++) {
      const x = Math.floor(this.x + (Math.random() * 2 - 1) * range), z = Math.floor(this.z + (Math.random() * 2 - 1) * range);
      if (!w.isLoaded(x, z)) continue;
      let y = Math.floor(this.y) + rand(7) - 3;
      if (this.def.flyer) { this.wander = { x: x + 0.5, y: y + rand(4), z: z + 0.5 }; this.wanderTime = 0; return; }
      if (this.def.aquatic || (this.inWater && (this.def.swimmer || this.def.aquaticLoose))) {
        if (BLOCKS[w.getBlock(x, y, z)].kind === 'liquid') { this.wander = { x: x + 0.5, y: y + 0.5, z: z + 0.5 }; this.wanderTime = 0; return; }
        continue;
      }
      // settle on ground
      let n = 0;
      while (n++ < 8 && !BLOCKS[w.getBlock(x, y - 1, z)].solid) y--;
      if (BLOCKS[w.getBlock(x, y, z)].solid) continue;
      const below = BLOCKS[w.getBlock(x, y - 1, z)];
      if (below.kind === 'liquid' && below.fluid === 'lava') continue;
      // animals prefer grass
      if (this.def.cat === 'creature' && below.name !== 'grass_block' && Math.random() < 0.5 && i < 9) continue;
      this.wander = { x: x + 0.5, y, z: z + 0.5 }; this.wanderTime = 0;
      return;
    }
  }
  lookAround() {
    const p = this.player;
    if (this.lookTime <= 0 && p && !p.dead && this.distSq(p) < 64 && Math.random() < 0.02) { this.lookTarget = p; this.lookTime = 40 + rand(40); }
    else if (this.lookTime <= 0 && Math.random() < 0.01 && this.forward === 0) this.yaw += (Math.random() - 0.5) * 2;
  }
  findTarget(range, filter) {
    const p = this.player;
    if (this.age % 10 !== 0) return this.target;
    if (this.target && (this.target.dead || this.target.removed || (this.target.isPlayer && !this.playerTargetable(this.target)) || this.distSq(this.target) > range * range * 1.5)) this.target = null;
    if (!this.target && p && this.playerTargetable(p) && (!filter || filter(p))) {
      let r = range;
      if (p.hasEffect('invisibility')) r *= 0.07;
      if (p.sneaking) r *= 0.8;
      if (this.distSq(p) < r * r && this.canSee(p)) this.target = p;
    }
    return this.target;
  }
  meleeTick(t, mul = 1) {
    const d2 = this.distSq(t);
    this.moveTowards(t.x, t.y, t.z, mul);
    this.lookTarget = t; this.lookTime = 2;
    const reach = this.width * 2 * this.width * 2 + t.width;
    if (this.attackTime > 0) this.attackTime--;
    if (d2 <= reach + 0.5 && this.attackTime <= 0 && Math.abs(t.y - this.y) < 2.5) {
      this.attackTime = 20;
      this.swing();
      this.doHurtTarget(t);
    }
  }
  doHurtTarget(t) {
    let dmg = this.attackDamage;
    if (this.heldItem && this.heldItem.damage) dmg = Math.max(dmg, this.heldItem.damage);
    if (this.hasEffect('strength')) dmg += 3 * (this.effectAmp('strength') + 1);
    if (this.mobType === 'iron_golem') dmg = dmg + rand(15);
    if (dmg <= 0) return false;
    const ok = t.hurt({ type: 'mob', attacker: this }, dmg);
    if (ok) {
      if (t.knockback) t.knockback(this.mobType === 'iron_golem' ? 0.4 : 0.4, this.x - t.x, this.z - t.z);
      if (this.mobType === 'iron_golem') t.vy += 0.4;
      if (this.def.hitEffect && t.addEffect) {
        const [eff, dur] = this.def.hitEffect;
        const diff = this.game.difficulty;
        if (!(this.mobType === 'cave_spider' && diff < 2)) t.addEffect(eff, this.mobType === 'cave_spider' && diff === 3 ? 300 : dur, 0);
      }
      if (this.fireTicks > 0 && Math.random() < 0.3 * this.game.difficulty) t.setOnFire(2 * this.game.difficulty);
      if (this.mobType === 'bee') { this.hasStung = true; this.stingTime = 1200; }
    }
    return ok;
  }

  updateAI() {
    const d = this.def;
    this.floatInWater();
    if (this.sitting) { this.forward = 0; this.lookAround(); return; }
    if (this.panic > 0) {
      this.panic--;
      if (!this.wander || Math.random() < 0.05) this.pickWander(5);
      if (this.wander) this.moveTowards(this.wander.x, this.wander.y, this.wander.z, d.ai === 'villager' ? 1.6 : 2);
      return;
    }
    switch (d.ai) {
      case 'melee': return this.aiMelee();
      case 'ranged': return this.aiRanged();
      case 'creeper': return this.aiCreeper();
      case 'spider': return this.aiSpider();
      case 'enderman': return this.aiEnderman();
      case 'witch': return this.aiWitch();
      case 'phantom': return this.aiPhantom();
      case 'blaze': return this.aiBlaze();
      case 'animal': return this.aiAnimal();
      case 'wolf': case 'pet': return this.aiPet();
      case 'bear': return this.aiBear();
      case 'bee': return this.aiBee();
      case 'squid': return this.aiSquid();
      case 'swim': return this.aiSwim();
      case 'bat': return this.aiBat();
      case 'villager': return this.aiVillager();
      case 'golem': return this.aiGolem();
      case 'snow_golem': return this.aiSnowGolem();
      default: this.wanderTick(); this.lookAround();
    }
  }

  // ---------------- hostile
  aiMelee() {
    const d = this.def;
    let t = this.target;
    if (d.neutral) {
      if (this.mobType === 'piglin' && this.player && !wearsGold(this.player)) { t = this.findTarget(d.follow); }
      else if (!this.angryAt) t = this.target = null;
    } else t = this.findTarget(d.follow);
    if (t && (t.dead || t.removed)) t = this.target = null;
    if (t) { this.aggressive = true; this.meleeTick(t, 1); return; }
    this.aggressive = false;
    this.wanderTick(1 / 120, 10, 0.8);
    this.lookAround();
  }
  aiRanged() {
    const t = this.findTarget(this.def.follow);
    if (!t) { this.aiming = false; this.wanderTick(1 / 120, 10, 0.8); this.lookAround(); return; }
    const d2 = this.distSq(t);
    const see = this.age % 5 === 0 ? (this.seeCache = this.canSee(t)) : this.seeCache;
    this.lookTarget = t; this.lookTime = 2;
    if (d2 > 15 * 15 || !see) this.moveTowards(t.x, t.y, t.z, 1);
    else {
      // strafe around the target like MC skeletons
      if (!this.strafeDir || Math.random() < 0.02) this.strafeDir = Math.random() < 0.5 ? 1 : -1;
      const dx = t.x - this.x, dz = t.z - this.z;
      this.yaw = approachAngle(this.yaw, Math.atan2(-dx, dz), 0.6);
      this.speedMul = 0.5;
      const sv = this.speedValue();
      this.forward = d2 < 25 ? -sv : d2 > 144 ? sv : 0;
      this.strafe = this.strafeDir * sv;
      if (!this.safeAhead()) { this.forward = 0; this.strafe = 0; }
      if (this.collidedH && this.onGround) this.jumping = true;
    }
    if (see && d2 < 15 * 15) {
      this.aiming = true;
      const interval = this.game.difficulty >= 3 ? 20 : 40;
      if (++this.rangedTime >= interval) { this.rangedTime = 0; this.shootArrow(t); }
    } else { this.aiming = false; this.rangedTime = Math.max(0, this.rangedTime - 1); }
  }
  shootArrow(t) {
    const g = this.game;
    const a = new Projectile(g, this.x, this.y + this.eyeHeight - 0.1, this.z, 'arrow', this);
    const dx = t.x - this.x, dy = t.y + t.height / 3 - a.y, dz = t.z - this.z;
    const h = Math.hypot(dx, dz);
    a.shoot(dx, dy + h * 0.2, dz, 1.6, 14 - g.difficulty * 4);
    a.damage = 2 + g.difficulty * 0.11 + Math.random() * 0.25;
    a.pickup = 0;
    if (this.def.arrowEffect) a.effect = this.def.arrowEffect;
    if (this.fireTicks > 0) a.fireTicks = 100;
    g.spawn(a);
    g.sound.at('entity.skeleton.shoot', this.x, this.y, this.z, 1, 1 / (Math.random() * 0.4 + 0.8));
    this.swing();
  }
  aiCreeper() {
    const t = this.findTarget(this.def.follow);
    if (t) { this.moveTowards(t.x, t.y, t.z, 1); this.lookTarget = t; this.lookTime = 2; if (this.swellDir > 0) this.forward = 0; }
    else { this.wanderTick(1 / 120, 10, 0.8); this.lookAround(); }
  }
  creeperTick() {
    const t = this.target;
    let dir = -1;
    if (this.ignited) dir = 1;
    else if (t && !t.dead) {
      const d2 = this.distSq(t);
      if (d2 < 9 && this.canSee(t)) dir = 1;
      else if (d2 < 49 && this.swell > 0) dir = 1;
    }
    if (dir > 0 && this.swell === 0) this.game.sound.at('entity.creeper.primed', this.x, this.y, this.z, 1, 0.5);
    this.swellDir = dir;
    this.swellTicks = Math.max(0, Math.min(30, (this.swellTicks || 0) + dir));
    this.swell = this.swellTicks / 30;
    if (this.swellTicks >= 30) {
      this.remove();
      this.dead = true;
      this.game.explode(this.x, this.y + 0.85, this.z, this.charged ? 6 : 3, false, this);
    }
  }
  aiSpider() {
    const g = this.game;
    const bright = this.world.getRawBrightness ? this.world.getRawBrightness(Math.floor(this.x), Math.floor(this.y + 0.5), Math.floor(this.z), g.skyDarken) : 0;
    let t = this.target;
    if (!t && bright < 12) t = this.findTarget(this.def.follow);
    else if (t && bright >= 12 && !this.angryAt && Math.random() < 0.01) t = this.target = null;
    else if (t) t = this.findTarget(this.def.follow);
    if (t) {
      this.meleeTick(t, 1);
      const d2 = this.distSq(t);
      if (this.onGround && d2 > 4 && d2 < 16 && Math.random() < 0.1) {
        const dx = t.x - this.x, dz = t.z - this.z, l = Math.hypot(dx, dz) || 1;
        this.vx += dx / l * 0.4 * 0.8 + this.vx * 0.2; this.vz += dz / l * 0.4 * 0.8 + this.vz * 0.2; this.vy = 0.4;
      }
      return;
    }
    this.wanderTick(1 / 120, 10, 0.8);
    this.lookAround();
  }
  aiEnderman() {
    const p = this.player, g = this.game;
    // provoked when the player looks at its head
    if (!this.target && p && this.playerTargetable(p) && this.age % 5 === 0 && this.distSq(p) < 64 * 64) {
      const head = p.inventory.slots[39];
      if (!(head && head.item.name === 'carved_pumpkin')) {
        const [lx, ly, lz] = g.lookDir();
        const ex = this.x - p.x, ey = this.y + this.eyeHeight - (p.y + p.eyeHeight), ez = this.z - p.z;
        const l = Math.sqrt(ex * ex + ey * ey + ez * ez);
        const dot = (lx * ex + ly * ey + lz * ez) / l;
        if (dot > 1 - 0.025 / l && this.canSee(p)) {
          this.target = p; this.angryAt = p; this.angerTime = 600;
          g.sound.at('entity.enderman.stare', this.x, this.y, this.z, 2.5);
        }
      }
    }
    const t = this.target;
    if (t && (t.dead || t.removed || (t.isPlayer && !this.playerTargetable(t)))) { this.target = null; this.angryAt = null; }
    if (this.target) {
      this.aggressive = true;
      if (this.distSq(this.target) > 256 && Math.random() < 0.05) this.teleportTowards(this.target);
      this.meleeTick(this.target, 1.3);
      return;
    }
    this.aggressive = false;
    this.wanderTick(1 / 120, 10, 1);
    this.lookAround();
    if (g.skyDarken < 4 && Math.random() < 0.002 && this.world.getSkyLight(Math.floor(this.x), Math.floor(this.y + 1), Math.floor(this.z)) > 12) this.teleportRandom();
  }
  teleportRandom() { for (let i = 0; i < 16; i++) if (this.teleportTo(this.x + (Math.random() - 0.5) * 64, this.y + rand(64) - 32, this.z + (Math.random() - 0.5) * 64)) return true; return false; }
  teleportTowards(t) {
    const dx = this.x - t.x, dy = this.y - t.y, dz = this.z - t.z, l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    return this.teleportTo(this.x + (Math.random() - 0.5) * 8 - dx / l * 16, this.y + rand(16) - 8 - dy / l * 16, this.z + (Math.random() - 0.5) * 8 - dz / l * 16);
  }
  teleportTo(x, y, z) {
    const w = this.world;
    const bx = Math.floor(x), bz = Math.floor(z);
    let by = Math.floor(y);
    if (!w.isLoaded(bx, bz)) return false;
    while (by > MIN_Y && !BLOCKS[w.getBlock(bx, by - 1, bz)].solid) by--;
    if (by <= MIN_Y) return false;
    for (let k = 0; k < Math.ceil(this.height); k++) { const d = BLOCKS[w.getBlock(bx, by + k, bz)]; if (d.solid || d.kind === 'liquid') return false; }
    const g = this.game;
    const ox = this.x, oy = this.y, oz = this.z;
    this.teleport(bx + 0.5, by, bz + 0.5);
    g.sound.at('entity.enderman.teleport', ox, oy, oz);
    g.sound.at('entity.enderman.teleport', this.x, this.y, this.z);
    if (g.particles) for (let i = 0; i < 32; i++) { const f = i / 31; g.particles.spawn('portal', ox + (this.x - ox) * f + (Math.random() - 0.5), oy + (this.y - oy) * f + Math.random() * this.height, oz + (this.z - oz) * f + (Math.random() - 0.5), (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2); }
    return true;
  }
  aiWitch() {
    const t = this.findTarget(this.def.follow);
    const g = this.game;
    if (this.health < this.maxHealth * 0.5 && Math.random() < 0.01 && !this.drinkTime) { this.drinkTime = 32; }
    if (this.drinkTime) { if (--this.drinkTime === 0) { this.heal(4); g.sound.at('entity.witch.drink', this.x, this.y, this.z); this.addEffect('regeneration', 200, 0); } return; }
    if (!t) { this.wanderTick(1 / 120, 10, 0.8); this.lookAround(); return; }
    const d2 = this.distSq(t);
    this.lookTarget = t; this.lookTime = 2;
    if (d2 > 100) this.moveTowards(t.x, t.y, t.z, 1);
    if (++this.rangedTime >= 60 && d2 < 100 && this.canSee(t)) {
      this.rangedTime = 0;
      let eff = ['instant_damage', 1, 0];
      if (d2 >= 64 && !t.hasEffect('slowness')) eff = ['slowness', 1800, 0];
      else if (t.health >= 8 && !t.hasEffect('poison')) eff = ['poison', 900, 0];
      else if (d2 <= 9 && !t.hasEffect('weakness') && Math.random() < 0.25) eff = ['weakness', 1800, 0];
      const pot = new SplashPotion(g, this.x, this.y + this.eyeHeight - 0.1, this.z, this, eff);
      const dx = t.x + t.vx - this.x, dy = t.y + t.eyeHeight - 1.1 - this.y, dz = t.z + t.vz - this.z;
      const h = Math.hypot(dx, dz);
      pot.shoot(dx, dy + h * 0.2, dz, 0.75, 8);
      g.spawn(pot);
      g.sound.at('entity.witch.throw', this.x, this.y, this.z);
    }
  }
  aiPhantom() {
    const g = this.game, p = this.player;
    const t = this.findTarget(64);
    if (!this.anchor) this.anchor = { x: this.x, y: this.y, z: this.z };
    if (t) { this.anchor.x = t.x; this.anchor.z = t.z; this.anchor.y = Math.max(t.y + 12, this.anchor.y * 0.99 + (t.y + 15) * 0.01); }
    if (this.swoop > 0 && t) {
      this.swoop--;
      this.flyTowards(t.x, t.y + t.height * 0.5, t.z, 0.9);
      if (this.box.grow(0.2).intersects(t.box)) { this.doHurtTarget(t); this.swoop = 0; this.attackTime = 100 + rand(100); }
      return;
    }
    this.circle = (this.circle || Math.random() * 6.28) + 0.04;
    const r = 10;
    this.flyTowards(this.anchor.x + Math.cos(this.circle) * r, this.anchor.y, this.anchor.z + Math.sin(this.circle) * r, 0.6);
    if (t && --this.attackTime <= 0) { this.swoop = 80; g.sound.at('entity.phantom.swoop', this.x, this.y, this.z, 3); }
    void p;
  }
  flyTowards(x, y, z, speed) {
    const dx = x - this.x, dy = y - this.y, dz = z - this.z;
    const l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    this.vx += (dx / l * speed - this.vx) * 0.1; this.vy += (dy / l * speed - this.vy) * 0.1; this.vz += (dz / l * speed - this.vz) * 0.1;
    this.yaw = approachAngle(this.yaw, Math.atan2(-this.vx, this.vz), 0.3);
    this.pitch = -Math.atan2(this.vy, Math.hypot(this.vx, this.vz)) * 0.5;
  }
  aiBlaze() {
    const g = this.game;
    const t = this.findTarget(this.def.follow);
    if (!this.onGround && this.vy < 0) this.vy *= 0.6;
    if (g.particles && Math.random() < 0.2) g.particles.spawn('large_smoke', this.x + (Math.random() - 0.5) * this.width, this.y + Math.random() * this.height, this.z + (Math.random() - 0.5) * this.width, 0, 0, 0);
    if (!t) { this.vy += (Math.sin(this.age * 0.05) * 0.02 - this.vy) * 0.1; this.wanderTick(1 / 200, 6, 0.5); return; }
    this.lookTarget = t; this.lookTime = 2;
    if (t.y + t.eyeHeight > this.y + this.eyeHeight + 0.5) this.vy += (0.3 - this.vy) * 0.3;
    const d2 = this.distSq(t);
    if (d2 < 4) { this.meleeTick(t, 1); return; }
    if (d2 > 9) this.moveTowards(t.x, t.y + 2, t.z, 1);
    this.rangedTime++;
    if (this.rangedTime === 1) this.burst = 0;
    if (this.rangedTime > 60 && this.rangedTime <= 100 && this.rangedTime % 6 === 0 && this.canSee(t) && d2 < 48 * 48) {
      const fb = new SmallFireball(g, this.x, this.y + this.height / 2 + 0.5, this.z, this);
      const s = Math.sqrt(Math.sqrt(d2)) * 0.5;
      fb.shoot(t.x - this.x + (Math.random() - 0.5) * s, t.y + t.height / 2 - fb.y, t.z - this.z + (Math.random() - 0.5) * s, 1, 0);
      g.spawn(fb);
      g.sound.at('entity.blaze.shoot', this.x, this.y, this.z);
    }
    if (this.rangedTime > 100 + 60) this.rangedTime = 0;
  }

  // ---------------- passive
  aiAnimal() {
    const d = this.def, p = this.player;
    // flee from players (ocelots, foxes)
    if (d.shy && p && !p.dead && p.gameMode !== 3 && this.distSq(p) < 49 && !(d.tempt && holding(p, d.tempt))) {
      const dx = this.x - p.x, dz = this.z - p.z, l = Math.hypot(dx, dz) || 1;
      this.moveTowards(this.x + dx / l * 6, this.y, this.z + dz / l * 6, 1.6);
      return;
    }
    if (this.loveTick()) return;
    // follow the player holding food
    const tempt = d.tempt || d.breed;
    if (tempt && p && !p.dead && p.gameMode !== 3 && this.distSq(p) < 100 && holding(p, tempt)) {
      this.lookTarget = p; this.lookTime = 2;
      if (this.distSq(p) > 6.25) this.moveTowards(p.x, p.y, p.z, d.shy ? 0.6 : 1.1);
      return;
    }
    // babies follow adults
    if (this.baby && this.age % 20 === 0) {
      let best = null, bd = 64;
      for (const e of this.game.entities) if (e !== this && e.mobType === this.mobType && !e.baby && !e.dead) { const dd = e.distSq(this); if (dd < bd) { bd = dd; best = e; } }
      this.parent = best;
    }
    if (this.parent && !this.parent.dead && this.distSq(this.parent) > 9) { this.moveTowards(this.parent.x, this.parent.y, this.parent.z, 1.1); return; }
    // sheep eat grass to regrow wool
    if (this.mobType === 'sheep') this.eatGrassTick();
    if (this.eating > 0) return;
    if (d.rams && this.goatRam()) return;
    if (d.hops) { this.hopTick(); return; }
    this.wanderTick(1 / 120, 10, 1);
    this.lookAround();
  }
  loveTick() {
    if (this.inLove <= 0) return false;
    if (!this.lovePartner || this.lovePartner.dead || this.lovePartner.removed || this.lovePartner.inLove <= 0) {
      this.lovePartner = null;
      if (this.age % 10 === 0) for (const e of this.game.entities) if (e !== this && e.mobType === this.mobType && e.inLove > 0 && !e.baby && !e.dead && e.distSq(this) < 64) { this.lovePartner = e; break; }
    }
    const m = this.lovePartner;
    if (!m) return false;
    this.lookTarget = m; this.lookTime = 2;
    this.moveTowards(m.x, m.y, m.z, 1);
    if (this.distSq(m) < 9) {
      this.loveTime = (this.loveTime || 0) + 1;
      if (this.loveTime >= 60 && this.id < m.id) this.breedWith(m);
    }
    return true;
  }
  breedWith(m) {
    const g = this.game;
    const baby = g.spawnMob(this.mobType, this.x, this.y, this.z, { baby: true });
    if (baby) {
      baby.persistent = true;
      if (this.mobType === 'sheep') baby.woolColor = Math.random() < 0.5 ? this.woolColor : m.woolColor;
      if (this.tamed) { baby.tamed = true; if (this.mobType === 'wolf') { baby.maxHealth = 20; baby.health = 20; } }
      baby.variant = Math.random() < 0.5 ? this.variant : m.variant;
    }
    for (const e of [this, m]) { e.inLove = 0; e.breedCooldown = 6000; e.loveTime = 0; e.lovePartner = null; }
    g.spawnXp(this.x, this.y + 0.3, this.z, 1 + rand(7));
    this.hearts(7);
  }
  eatGrassTick() {
    if (this.eating > 0) {
      this.eating--;
      if (this.eating === 4) {
        const w = this.world, x = Math.floor(this.x), y = Math.floor(this.y), z = Math.floor(this.z);
        const here = BLOCKS[w.getBlock(x, y, z)];
        if (here.name === 'short_grass' || here.name === 'grass') { if (this.game.rules.mobGriefing) w.setBlock(x, y, z, 0, 0); this.ateGrass(); }
        else if (w.getBlock(x, y - 1, z) === BLOCK.grass_block.id) { if (this.game.rules.mobGriefing) w.setBlock(x, y - 1, z, BLOCK.dirt.id, 0); this.ateGrass(); }
      }
      return;
    }
    if (Math.random() < (this.baby ? 1 / 50 : 1 / 1000)) {
      const w = this.world, x = Math.floor(this.x), y = Math.floor(this.y), z = Math.floor(this.z);
      const here = BLOCKS[w.getBlock(x, y, z)];
      if (here.name === 'short_grass' || here.name === 'grass' || w.getBlock(x, y - 1, z) === BLOCK.grass_block.id) this.eating = 40;
    }
  }
  ateGrass() { this.sheared = false; if (this.baby) this.growAge = Math.min(0, this.growAge + 60 * 20); this.game.sound.at('block.grass.break', this.x, this.y, this.z, 0.6); }
  goatRam() {
    const p = this.player;
    if (this.ramCooldown === undefined) this.ramCooldown = 600 + rand(5400);
    if (this.ramCooldown > 0) { this.ramCooldown--; return false; }
    if (!p || !this.playerTargetable(p) || this.distSq(p) > 256) { this.ramCooldown = 100; return false; }
    this.moveTowards(p.x, p.y, p.z, 2.5);
    if (this.box.grow(0.3).intersects(p.box)) {
      p.hurt({ type: 'mob', attacker: this }, 2);
      p.knockback(2.5, this.x - p.x, this.z - p.z);
      this.game.sound.at('entity.goat.ram_impact', this.x, this.y, this.z);
      this.ramCooldown = 600 + rand(5400);
    }
    return true;
  }
  hopTick() {
    if (this.onGround) {
      if (!this.wander && Math.random() < 1 / 60) this.pickWander(6);
      if (this.wander && --this.hopDelay <= 0) {
        const w = this.wander;
        const dx = w.x - this.x, dz = w.z - this.z, l = Math.hypot(dx, dz);
        if (l < 1) { this.wander = null; return; }
        this.yaw = Math.atan2(-dx, dz);
        if (!this.safeAhead()) { this.wander = null; return; }
        this.vy = this.mobType === 'frog' ? 0.5 : 0.35;
        this.vx = dx / l * 0.15; this.vz = dz / l * 0.15;
        this.hopDelay = 8 + rand(12);
      }
    }
    if (this.inWater && this.wander) this.moveTowards(this.wander.x, this.wander.y, this.wander.z, 1);
    this.lookAround();
  }
  aiPet() {
    const d = this.def, p = this.player, g = this.game;
    if (this.mobType === 'wolf') {
      // angry wolves
      if (this.angryAt && this.target && !this.target.dead) { this.meleeTick(this.target, 1.2); return; }
      if (this.target && (this.target.dead || this.target.removed)) this.target = null;
    }
    if (this.tamed && this.mobType === 'wolf') {
      // defend / assist the owner
      const la = p && p.lastAttacker && p.age - p.lastAttackerTime < 100 ? p.lastAttacker : null;
      const victim = p && p.lastHurtMob && p.age - p.lastHurtMobTime < 100 ? p.lastHurtMob : null;
      const foe = la && la !== this && !la.dead && la.mobType !== 'creeper' && !la.tamed ? la : victim && !victim.dead && !victim.tamed && victim !== this ? victim : null;
      if (foe && this.distSq(foe) < 400) { this.target = foe; this.meleeTick(foe, 1.2); return; }
      this.target = null;
    }
    if (this.loveTick()) return;
    if (this.tamed && p && !p.dead) {
      const d2 = this.distSq(p);
      if (d2 > 144) { // teleport to owner
        for (let i = 0; i < 10; i++) { const x = Math.floor(p.x) + rand(7) - 3, z = Math.floor(p.z) + rand(7) - 3, y = Math.floor(p.y); if (BLOCKS[this.world.getBlock(x, y - 1, z)].solid && !BLOCKS[this.world.getBlock(x, y, z)].solid && !BLOCKS[this.world.getBlock(x, y + 1, z)].solid) { this.teleport(x + 0.5, y, z + 0.5); break; } }
        return;
      }
      if (d2 > 100) { this.moveTowards(p.x, p.y, p.z, 1.2); return; }
      if (d2 > 9 && this.followOwner) { this.moveTowards(p.x, p.y, p.z, 1); if (d2 < 16) this.followOwner = false; return; }
      if (d2 > 49) this.followOwner = true;
    }
    if (!this.tamed && d.tameItem && p && holding(p, [d.tameItem, d.tameItem2]) && this.distSq(p) < 64 && this.mobType !== 'wolf') {
      this.lookTarget = p; this.lookTime = 2;
      if (this.distSq(p) > 6) this.moveTowards(p.x, p.y, p.z, 0.8);
      return;
    }
    if (d.flyer && !this.onGround && !this.inWater) { this.vy = Math.max(this.vy - 0.02, -0.1); }
    this.wanderTick(1 / 120, 10, 1);
    this.lookAround();
    void g;
  }
  aiBear() {
    const p = this.player;
    if (this.target && (this.target.dead || this.target.removed || !this.angryAt)) this.target = null;
    // adults defend cubs
    if (!this.baby && !this.target && p && this.playerTargetable(p) && this.age % 20 === 0 && this.distSq(p) < 64) {
      for (const e of this.game.entities) if (e.mobType === 'polar_bear' && e.baby && e.distSq(this) < 64) { this.target = p; this.angryAt = p; this.angerTime = 200; break; }
    }
    if (this.target && !this.baby) { this.meleeTick(this.target, 1.25); return; }
    this.wanderTick(1 / 120, 10, 1);
    this.lookAround();
  }
  aiBee() {
    if (this.hasStung) { if (--this.stingTime <= 0 || Math.random() < 1 / 1200) this.hurt({ type: 'kill' }, 100); }
    if (this.target && !this.hasStung && this.angryAt && !this.target.dead) {
      const t = this.target;
      this.flyTowards(t.x, t.y + t.height * 0.6, t.z, 0.35);
      if (this.box.grow(0.3).intersects(t.box) && --this.attackTime <= 0) { this.doHurtTarget(t); this.attackTime = 20; }
      return;
    }
    if (!this.wander || Math.random() < 0.01) this.pickWander(8);
    if (this.wander) { this.flyTowards(this.wander.x, this.wander.y + 1, this.wander.z, 0.12); if (Math.hypot(this.wander.x - this.x, this.wander.z - this.z) < 1) this.wander = null; }
    this.lookAround();
  }
  aiSquid() {
    if (!this.inWater) { this.pitch *= 0.9; return; }
    this.noGravity = true;
    if (!this.swimDir || Math.random() < 1 / 50) {
      const a = Math.random() * Math.PI * 2;
      this.swimDir = [Math.cos(a) * 0.1, (Math.random() - 0.5) * 0.1, Math.sin(a) * 0.1];
    }
    const s = this.swimDir;
    if (this.y + this.height > (this.waterTop || this.y + 2) - 0.2 && s[1] > 0) s[1] = -0.02;
    this.vx += (s[0] - this.vx) * 0.05; this.vy += (s[1] - this.vy) * 0.05; this.vz += (s[2] - this.vz) * 0.05;
    this.yaw = approachAngle(this.yaw, Math.atan2(-this.vx, this.vz), 0.1);
  }
  aiSwim() {
    const d = this.def;
    if (this.inWater) this.noGravity = true; else { this.noGravity = false; if (this.def.aquatic && this.onGround && Math.random() < 0.05) { this.vy = 0.4; this.vx += (Math.random() - 0.5) * 0.2; this.vz += (Math.random() - 0.5) * 0.2; } }
    if (this.target && this.angryAt && d.dmg) { this.meleeTick(this.target, 1.5); return; }
    if (this.inWater) {
      if (!this.wander || Math.random() < 1 / 80) this.pickWander(10);
      if (this.wander) {
        const w = this.wander;
        const dx = w.x - this.x, dy = w.y - this.y, dz = w.z - this.z, l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        if (l < 1) this.wander = null;
        const sp = this.mobType === 'dolphin' ? 0.12 : 0.05;
        this.vx += (dx / l * sp - this.vx) * 0.08; this.vy += (dy / l * sp - this.vy) * 0.08; this.vz += (dz / l * sp - this.vz) * 0.08;
        this.yaw = approachAngle(this.yaw, Math.atan2(-this.vx, this.vz), 0.2);
      }
      if (this.mobType === 'dolphin' && this.waterTop - this.y < 1.2 && Math.random() < 0.01) this.vy = 0.5; // jump out of the water
    } else this.wanderTick(1 / 120, 6, 0.6);
  }
  aiBat() {
    this.noGravity = true;
    const w = this.world;
    if (!this.batTarget || Math.random() < 1 / 30 || Math.hypot(this.batTarget[0] - this.x, this.batTarget[2] - this.z) < 2 || BLOCKS[w.getBlock(...this.batTarget.map(Math.floor))].solid) {
      this.batTarget = [this.x + rand(7) - rand(7), this.y + rand(6) - 2, this.z + rand(7) - rand(7)];
    }
    const [tx, ty, tz] = this.batTarget;
    const dx = tx + 0.5 - this.x, dy = ty + 0.1 - this.y, dz = tz + 0.5 - this.z;
    this.vx += (Math.sign(dx) * 0.5 - this.vx) * 0.1; this.vy += (Math.sign(dy) * 0.7 - this.vy) * 0.1; this.vz += (Math.sign(dz) * 0.5 - this.vz) * 0.1;
    this.vy *= 0.6;
    this.yaw = approachAngle(this.yaw, Math.atan2(-this.vx, this.vz), 0.3);
    this.forward = 0.5;
  }
  aiVillager() {
    // flee from zombies
    if (this.age % 10 === 0) {
      this.fear = null;
      for (const e of this.game.entities) if (e.undead && e.def && e.def.ai === 'melee' && !e.dead && e.distSq(this) < 64) { this.fear = e; break; }
    }
    if (this.fear) {
      const dx = this.x - this.fear.x, dz = this.z - this.fear.z, l = Math.hypot(dx, dz) || 1;
      this.moveTowards(this.x + dx / l * 6, this.y, this.z + dz / l * 6, 1.6);
      return;
    }
    const night = (this.game.dayTime % 24000) > 12500;
    this.wanderTick(night ? 1 / 400 : 1 / 120, 10, 0.6);
    this.lookAround();
  }
  aiGolem() {
    // attack hostile mobs nearby (never creepers), or whoever attacked it
    if (this.age % 10 === 0 && (!this.target || this.target.dead || this.target.removed)) {
      this.target = this.angryAt && !this.angryAt.dead && !this.angryAt.removed ? this.angryAt : null;
      if (!this.target) {
        let best = null, bd = 256;
        for (const e of this.game.entities) if (e.hostile && e.mobType !== 'creeper' && !e.dead && !e.removed) { const dd = e.distSq(this); if (dd < bd && this.canSee(e)) { bd = dd; best = e; } }
        this.target = best;
      }
    }
    if (this.target && (this.target.dead || this.target.removed || (this.target.isPlayer && !this.playerTargetable(this.target)))) this.target = null;
    if (this.target) { this.meleeTick(this.target, 1); return; }
    this.wanderTick(1 / 240, 10, 0.6);
    this.lookAround();
  }
  aiSnowGolem() {
    if (this.age % 10 === 0) {
      let best = null, bd = 100;
      for (const e of this.game.entities) if (e.hostile && !e.dead && !e.removed) { const dd = e.distSq(this); if (dd < bd) { bd = dd; best = e; } }
      this.target = best && this.canSee(best) ? best : null;
    }
    const t = this.target;
    if (t) {
      this.lookTarget = t; this.lookTime = 2;
      if (++this.rangedTime >= 20) {
        this.rangedTime = 0;
        const s = new Projectile(this.game, this.x, this.y + 1.5, this.z, 'snowball', this);
        const dx = t.x - this.x, dy = t.y + t.eyeHeight - 1.1 - s.y, dz = t.z - this.z;
        s.shoot(dx, dy + Math.hypot(dx, dz) * 0.2, dz, 1.6, 12);
        this.game.spawn(s);
        this.game.sound.at('entity.snow_golem.shoot', this.x, this.y, this.z, 1, 0.4 / (Math.random() * 0.4 + 0.8));
      }
      return;
    }
    this.wanderTick(1 / 120, 10, 1);
    this.lookAround();
  }
  snowGolemTick() {
    const w = this.world;
    const x = Math.floor(this.x), y = Math.floor(this.y), z = Math.floor(this.z);
    const b = BIOMES[w.biomeAt(x, z)];
    if (b && b.temp > 1) this.hurt({ type: 'onFire' }, 1);
    if (this.game.rules.mobGriefing && b && b.temp < 0.8 && w.getBlock(x, y, z) === 0 && BLOCKS[w.getBlock(x, y - 1, z)].solid && BLOCKS[w.getBlock(x, y - 1, z)].opaque) w.setBlock(x, y, z, BLOCK.snow.id, 0);
  }
}

// ------------------------------------------------------------------ slimes & magma cubes
export class Slime extends Mob {
  constructor(game, type, x, y, z, opts = {}) {
    super(game, type, x, y, z, opts);
    this.squish = 0; this.prevSquish = 0; this.squishPrev = 0;
    this.jumpDelay = 10 + rand(20);
    this.setSize(opts.size || 1);
  }
  setSize(s) {
    this.size = s;
    this.sizeScale = s;
    this.width = this.height = 0.52 * s;
    this.maxHealth = this.health = s * s;
    this.attackDamage = this.mobType === 'magma_cube' ? (s === 1 ? 3 : s === 2 ? 4 : 6) : (s === 1 ? 0 : s);
    this.movementSpeed = 0.2 + 0.1 * s;
  }
  onSpawned(opts) {
    super.onSpawned(opts);
    if (!opts.size) { const r = rand(3); this.setSize(1 << r); }
  }
  armorValue() { return this.mobType === 'magma_cube' ? this.size * 3 : 0; }
  load(d) { if (d.size) this.setSize(d.size); super.load(d); }
  xpReward() { return this.size; }
  onDeath(src) {
    if (this.size > 1) {
      // no loot for big slimes (MC), they split instead
      this.game.sound.at(`entity.${this.mobType}.death`, this.x, this.y, this.z);
      const killer = this.killerPlayer();
      this.xpDrop = killer ? this.size : 0;
      if (this.mobType === 'magma_cube' && this.game.rules.doMobLoot && Math.random() < 0.25 && killer) this.game.dropItem(this.x, this.y + 0.3, this.z, new ItemStack('magma_cream', 1));
      return;
    }
    super.onDeath(src);
  }
  onRemovedAfterDeath() {
    super.onRemovedAfterDeath();
    if (this.size > 1) {
      const n = 2 + rand(3), s = this.size / 2;
      for (let i = 0; i < n; i++) {
        const ox = ((i % 2) - 0.5) * this.size / 4, oz = (Math.floor(i / 2) - 0.5) * this.size / 4;
        const m = this.game.spawnMob(this.mobType, this.x + ox, this.y + 0.5, this.z + oz, { size: s });
        if (m) { m.setSize(s); m.persistent = this.persistent; m.yaw = Math.random() * 6.28; }
      }
    }
  }
  tick() {
    this.prevSquish = this.squish;
    const wasOnGround = this.onGround;
    super.tick();
    if (this.dead || this.removed) return;
    this.squish *= 0.6;
    if (this.onGround && !wasOnGround) {
      this.squish = -0.5;
      const g = this.game;
      if (g.particles) for (let i = 0; i < this.size * 8; i++) { const a = Math.random() * 6.28, r = this.size * 0.5 * (0.5 + Math.random() * 0.5); g.particles.spawn(this.mobType === 'magma_cube' ? 'flame' : 'snowball', this.x + Math.sin(a) * r, this.y, this.z + Math.cos(a) * r, 0, 0, 0); }
      g.sound.at(`entity.${this.mobType}.squish`, this.x, this.y, this.z, 0.4 * this.size, ((Math.random() - Math.random()) * 0.2 + 1) / 0.8);
    } else if (!this.onGround && wasOnGround) this.squish = 1;
    // contact damage
    const t = this.target;
    if (t && this.attackDamage > 0 && this.box.grow(0.2).intersects(t.box) && this.attackTime <= 0 && this.canSee(t)) {
      this.attackTime = 10;
      this.doHurtTarget(t);
      this.game.sound.at(`entity.${this.mobType}.attack`, this.x, this.y, this.z);
    }
    if (this.attackTime > 0) this.attackTime--;
  }
  updateAI() {
    const t = this.findTarget(16);
    if (t) {
      const dx = t.x - this.x, dz = t.z - this.z;
      this.yaw = approachAngle(this.yaw, Math.atan2(-dx, dz), 0.2);
    } else if (Math.random() < 0.02) this.yaw += (Math.random() - 0.5) * 2;
    if (this.inWater || this.inLava) { this.jumping = true; if (this.mobType === 'magma_cube' && this.inLava) this.vy += 0.03; }
    if (this.onGround && --this.jumpDelay <= 0) {
      this.jumpDelay = (10 + rand(20)) / (t ? 3 : 1);
      this.vy = 0.42 + (this.mobType === 'magma_cube' ? 0.1 * this.size : 0);
      const s = this.movementSpeed * (t ? 1 : 0.6) * 0.6;
      this.vx -= Math.sin(this.yaw) * s; this.vz += Math.cos(this.yaw) * s;
    }
    if (!this.onGround) { this.speedMul = 1; this.forward = this.speedValue() * 0.4; }
  }
}

// ------------------------------------------------------------------ projectiles used by mobs
export class SmallFireball extends Projectile {
  constructor(game, x, y, z, shooter) {
    super(game, x, y, z, 'small_fireball', shooter);
    this.gravity = 0; this.fireImmune = true; this.width = this.height = 0.3125;
  }
  tick() {
    super.tick();
    this.vy += this.gravity; // no gravity
    if (this.game.particles && this.age % 2 === 0) this.game.particles.spawn('smoke', this.x, this.y, this.z, 0, 0, 0);
    if (this.age > 100) this.remove();
  }
  onHitEntity(e) {
    if (e.fireImmune) { this.remove(); return; }
    if (e.hurt({ type: 'onFire', attacker: this.shooter, projectile: this }, 5)) e.setOnFire(5);
    this.remove();
  }
  onHitBlock(hit) {
    const g = this.game, w = g.world;
    if (g.rules.mobGriefing) {
      const [dx, dy, dz] = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]][hit.face] || [0, 1, 0];
      const x = hit.x + dx, y = hit.y + dy, z = hit.z + dz;
      if (w.getBlock(x, y, z) === 0) w.setBlock(x, y, z, BLOCK.fire.id, 0);
    }
    this.remove();
  }
}

export class SplashPotion extends Projectile {
  constructor(game, x, y, z, shooter, effect) {
    super(game, x, y, z, 'splash_potion', shooter);
    this.effect = effect; this.gravity = 0.05;
  }
  onHitEntity() { this.shatter(); }
  onHitBlock(hit) { this.x = hit.hit[0]; this.y = hit.hit[1]; this.z = hit.hit[2]; this.shatter(); }
  shatter() {
    const g = this.game;
    const [eff, dur, amp] = this.effect;
    for (const e of g.entities) {
      if (!e.addEffect || e.dead || e === this.shooter) continue;
      const d2 = (e.x - this.x) ** 2 + (e.y - this.y) ** 2 + (e.z - this.z) ** 2;
      if (d2 > 16) continue;
      const f = 1 - Math.sqrt(d2) / 4;
      if (eff === 'instant_damage') { if (e.undead) e.heal(6 * f); else e.hurt({ type: 'magic', attacker: this.shooter, bypassArmor: true }, Math.floor(6 * f + 0.5)); }
      else e.addEffect(eff, Math.floor(dur * f * 0.75), amp);
    }
    g.sound.at('entity.splash_potion.break', this.x, this.y, this.z);
    if (g.particles) for (let i = 0; i < 30; i++) g.particles.spawn('effect', this.x + (Math.random() - 0.5) * 2, this.y + Math.random(), this.z + (Math.random() - 0.5) * 2, 0.5, 0.15, 0.65);
    this.remove();
  }
}

function holding(p, names) {
  const a = p.inventory.selected(), b = p.inventory.slots[40];
  return (a && names.includes(a.item.name)) || (b && names.includes(b.item.name));
}
function wearsGold(p) { for (let i = 36; i < 40; i++) { const s = p.inventory.slots[i]; if (s && s.item.name.startsWith('golden_')) return true; } return false; }

// ------------------------------------------------------------------ natural spawning
const W = (list) => list.map(([t, w, min, max]) => ({ t, w, min, max }));
const FARM = [['sheep', 12, 4, 4], ['pig', 10, 4, 4], ['chicken', 10, 4, 4], ['cow', 8, 4, 4]];
const CREATURES = {
  plains: W([...FARM, ['horse', 5, 2, 6], ['donkey', 1, 1, 3]]),
  sunflower_plains: W([...FARM, ['horse', 5, 2, 6], ['donkey', 1, 1, 3]]),
  meadow: W([['donkey', 1, 1, 2], ['rabbit', 2, 2, 6], ['sheep', 2, 2, 4]]),
  forest: W([...FARM, ['wolf', 5, 4, 4]]),
  flower_forest: W([...FARM, ['rabbit', 4, 2, 3]]),
  birch_forest: W(FARM),
  dark_forest: W(FARM),
  taiga: W([...FARM, ['wolf', 8, 4, 4], ['rabbit', 4, 2, 3], ['fox', 8, 2, 4]]),
  snowy_taiga: W([['wolf', 8, 4, 4], ['rabbit', 4, 2, 3], ['fox', 8, 2, 4]]),
  snowy_plains: W([['rabbit', 10, 2, 3], ['polar_bear', 1, 1, 2]]),
  ice_spikes: W([['rabbit', 10, 2, 3], ['polar_bear', 1, 1, 2]]),
  savanna: W([...FARM, ['horse', 1, 2, 6], ['donkey', 1, 1, 1], ['llama', 8, 4, 4]]),
  desert: W([['rabbit', 4, 2, 3]]),
  jungle: W([...FARM, ['parrot', 40, 1, 2], ['panda', 1, 1, 2], ['ocelot', 2, 1, 3]]),
  swamp: W([...FARM, ['frog', 10, 2, 5]]),
  cherry_grove: W([['pig', 1, 1, 2], ['rabbit', 2, 2, 6], ['sheep', 2, 2, 4]]),
  windswept_hills: W([...FARM, ['llama', 5, 4, 6]]),
  jagged_peaks: W([['goat', 5, 1, 3]]),
  stony_peaks: W([['goat', 5, 1, 3]]),
  beach: W([['turtle', 5, 2, 5]]),
  mushroom_fields: W([['mooshroom', 8, 4, 8]]),
};
const WATER_CREATURES = {
  ocean: W([['squid', 1, 1, 4], ['dolphin', 1, 1, 2]]), deep_ocean: W([['squid', 1, 1, 4], ['dolphin', 1, 1, 2]]),
  warm_ocean: W([['squid', 10, 4, 4], ['dolphin', 2, 1, 2]]), cold_ocean: W([['squid', 3, 1, 4]]), river: W([['squid', 2, 1, 4]]),
};
const MONSTERS_DEFAULT = W([['spider', 100, 4, 4], ['zombie', 95, 4, 4], ['zombie_villager', 5, 1, 1], ['skeleton', 100, 4, 4], ['creeper', 100, 4, 4], ['slime', 100, 4, 4], ['enderman', 10, 1, 4], ['witch', 5, 1, 1]]);
const MONSTERS = {
  desert: W([['spider', 100, 4, 4], ['zombie', 19, 4, 4], ['zombie_villager', 1, 1, 1], ['husk', 80, 4, 4], ['skeleton', 100, 4, 4], ['creeper', 100, 4, 4], ['slime', 100, 4, 4], ['enderman', 10, 1, 4], ['witch', 5, 1, 1]]),
  snowy_plains: W([['spider', 100, 4, 4], ['zombie', 95, 4, 4], ['zombie_villager', 5, 1, 1], ['skeleton', 20, 4, 4], ['stray', 80, 4, 4], ['creeper', 100, 4, 4], ['slime', 100, 4, 4], ['enderman', 10, 1, 4], ['witch', 5, 1, 1]]),
  ice_spikes: null, snowy_taiga: null,
  river: W([['spider', 100, 4, 4], ['zombie', 95, 4, 4], ['drowned', 100, 1, 1], ['skeleton', 100, 4, 4], ['creeper', 100, 4, 4], ['enderman', 10, 1, 4], ['witch', 5, 1, 1]]),
  ocean: W([['spider', 100, 4, 4], ['zombie', 95, 4, 4], ['drowned', 5, 1, 1], ['skeleton', 100, 4, 4], ['creeper', 100, 4, 4], ['enderman', 10, 1, 4], ['witch', 5, 1, 1]]),
  mushroom_fields: [],
};
MONSTERS.ice_spikes = MONSTERS.snowy_plains; MONSTERS.snowy_taiga = MONSTERS.snowy_plains;
for (const k of ['deep_ocean', 'warm_ocean', 'cold_ocean', 'frozen_ocean']) MONSTERS[k] = MONSTERS.ocean;

// ---- feature packs: spawn list additions (CREATURES / WATER_CREATURES / MONSTERS by biome name) ----
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


function pickWeighted(list) {
  let total = 0;
  for (const e of list) total += e.w;
  let r = Math.random() * total;
  for (const e of list) { r -= e.w; if (r < 0) return e; }
  return list[list.length - 1];
}

const CAPS = { monster: 70, creature: 10, ambient: 15, water_creature: 5 };

export class MobSpawner {
  constructor(game) { this.game = game; this.counts = {}; }

  isSlimeChunk(cx, cz) {
    // deterministic per world seed, ~10% of chunks like Minecraft
    const s = this.game.info ? this.game.info.seed : 0;
    let h = (cx * 0x4c1906 + cx * cx * 0x4307a7 + cz * cz * 0x4307a7 + cz * 0x5f24f) ^ s ^ 0x3ad8025f;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); h = Math.imul(h ^ (h >>> 16), 0x45d9f3b); h ^= h >>> 16;
    return ((h >>> 0) % 10) === 0;
  }

  tick() {
    const g = this.game, p = g.player, w = g.world;
    if (!p || g.ticks % 1 !== 0) return;
    // phantoms: insomnia
    if (p.sleeping) p.timeSinceRest = 0; else p.timeSinceRest = (p.timeSinceRest || 0) + 1;
    // count mobs per category
    if (g.ticks % 20 === 0) {
      const c = { monster: 0, creature: 0, ambient: 0, water_creature: 0 };
      for (const e of g.entities) if (e.mobType && !e.dead && c[e.def.cat] !== undefined) c[e.def.cat]++;
      this.counts = c;
    }
    const R = Math.min(8, g.options.get('simulationDistance'), g.renderer.renderDistance);
    const chunks = (R * 2 + 1) ** 2;
    const cap = (k) => Math.max(1, Math.floor(CAPS[k] * chunks / 289));
    if (g.difficulty > 0 && (this.counts.monster || 0) < cap('monster')) this.trySpawn('monster', R);
    if (g.ticks % 400 === 0 && (this.counts.creature || 0) < cap('creature')) this.trySpawn('creature', R);
    if (g.ticks % 20 === 5 && (this.counts.ambient || 0) < cap('ambient')) this.trySpawn('ambient', R);
    if (g.ticks % 20 === 10 && (this.counts.water_creature || 0) < cap('water_creature')) this.trySpawn('water_creature', R);
    // phantoms at night over players who have not slept for 3 days
    if (g.difficulty > 0 && g.rules.doInsomnia && g.ticks % 1200 === 600 && p.timeSinceRest > 72000 && g.skyDarken >= 5 && p.gameMode !== 1 && p.gameMode !== 3 && p.y >= SEA_LEVEL
      && w.getSkyLight(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z)) >= 15 && Math.random() < Math.min(0.9, (p.timeSinceRest - 72000) / 72000 + 0.2)) {
      const n = 1 + rand(g.difficulty + 1);
      for (let i = 0; i < n; i++) g.spawnMob('phantom', p.x + rand(20) - 10, p.y + 20 + rand(15), p.z + rand(20) - 10);
    }
    void MIN_Y;
  }

  trySpawn(cat, R) {
    const g = this.game, p = g.player, w = g.world;
    const pcx = Math.floor(p.x / 16), pcz = Math.floor(p.z / 16);
    const cx = pcx + rand(R * 2 + 1) - R, cz = pcz + rand(R * 2 + 1) - R;
    const c = w.getChunk(cx, cz);
    if (!c) return;
    const lx = rand(16), lz = rand(16);
    const x = cx * 16 + lx, z = cz * 16 + lz;
    const top = c.heightmap[lz * 16 + lx] + 1;
    const y = cat === 'creature' ? top : MIN_Y + 1 + rand(Math.max(1, top - MIN_Y));
    const biome = BIOMES[w.biomeAt(x, z)];
    if (!biome) return;
    let list;
    if (cat === 'monster') list = MONSTERS[biome.name] === undefined ? MONSTERS_DEFAULT : MONSTERS[biome.name];
    else if (cat === 'creature') list = CREATURES[biome.name];
    else if (cat === 'ambient') list = W([['bat', 10, 8, 8]]);
    else if (cat === 'water_creature') list = WATER_CREATURES[biome.name] || (y < 30 ? W([['glow_squid', 10, 4, 6]]) : null);
    if (!list || !list.length) return;
    const e = pickWeighted(list);
    const n = e.min + rand(e.max - e.min + 1);
    let sx = x, sy = y, sz = z, spawned = 0;
    for (let i = 0; i < n * 2 && spawned < n; i++) {
      sx += rand(6) - rand(6); sz += rand(6) - rand(6);
      if (cat === 'creature') { const cc = w.getChunk(sx >> 4, sz >> 4); if (!cc) continue; sy = cc.heightmap[(sz & 15) * 16 + (sx & 15)] + 1; }
      if (this.canSpawnAt(e.t, cat, sx, sy, sz)) {
        const m = g.spawnMob(e.t, sx + 0.5, sy, sz + 0.5);
        if (m) { spawned++; if (e.t === 'glow_squid' || e.t === 'squid') m.teleport(sx + 0.5, sy + 0.1, sz + 0.5); }
      }
    }
  }

  canSpawnAt(type, cat, x, y, z) {
    const g = this.game, w = g.world, p = g.player;
    const d2 = (x + 0.5 - p.x) ** 2 + (y - p.y) ** 2 + (z + 0.5 - p.z) ** 2;
    if (d2 < 24 * 24 || d2 > 128 * 128) return false;
    if (!w.isLoaded(x, z)) return false;
    const def = MOBS[type];
    const here = BLOCKS[w.getBlock(x, y, z)];
    const below = BLOCKS[w.getBlock(x, y - 1, z)];
    if (cat === 'water_creature') {
      if (here.kind !== 'liquid' || here.fluid !== 'water' || BLOCKS[w.getBlock(x, y + 1, z)].kind !== 'liquid') return false;
      if (type === 'glow_squid') return y < 30 && w.getSkyLight(x, y, z) === 0;
      return y >= 50 && y <= SEA_LEVEL;
    }
    // room for the mob's body
    for (let k = 0; k < Math.ceil(def.h); k++) { const d = BLOCKS[w.getBlock(x, y + k, z)]; if (d.solid || d.kind === 'liquid' && type !== 'drowned') return false; }
    if (here.kind === 'liquid' && type === 'drowned') { if (here.fluid !== 'water') return false; } else if (!below.solid || !below.opaque || below.shape !== 'cube' && below.kind !== 'slab') return false;
    if (below.name === 'bedrock' || below.name === 'barrier') return false;
    // nearby same-type limit to avoid clumps
    let near = 0;
    for (const e of g.entities) if (e.mobType === type && Math.abs(e.x - x) < 16 && Math.abs(e.z - z) < 16) near++;
    if (near > 8) return false;
    const sky = w.getSkyLight(x, y, z), block = w.getBlockLight(x, y, z);
    if (cat === 'monster') {
      if (type === 'slime') {
        const b = BIOMES[w.biomeAt(x, z)];
        const swamp = b && b.name === 'swamp' && y > 50 && y < 70 && Math.random() < 0.5 && Math.max(sky - g.skyDarken, block) <= rand(8);
        const slimeChunk = y < 40 && this.isSlimeChunk(x >> 4, z >> 4) && Math.random() < 0.1;
        return swamp || slimeChunk;
      }
      if (block > 0) return false;
      if (Math.max(sky - g.skyDarken, 0) > rand(8)) return false;
      if (Math.random() * 32 < sky - g.skyDarken - 4) return false;
      return true;
    }
    if (cat === 'creature') {
      const ok = (def.spawnOn || ['grass_block']).includes(below.name) || (here.name === 'snow' && (def.spawnOn || []).includes('snow'));
      if (!ok) return false;
      return Math.max(sky, block) > 8;
    }
    if (cat === 'ambient') {
      if (y >= SEA_LEVEL) return false;
      return Math.max(sky, block) <= rand(4);
    }
    return false;
  }

  // creatures placed when a chunk is first generated (MC "creature generation" pass)
  populateChunk(c) {
    const g = this.game, w = g.world;
    if (Math.random() >= 0.1) return;
    const bx = c.cx * 16, bz = c.cz * 16;
    const biome = BIOMES[c.biomes[8 * 16 + 8]];
    const list = biome && CREATURES[biome.name];
    if (!list || !list.length) return;
    const e = pickWeighted(list);
    const n = e.min + rand(e.max - e.min + 1);
    let x = bx + rand(16), z = bz + rand(16);
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 4; tries++) {
        const lx = ((x - bx) % 16 + 16) % 16, lz = ((z - bz) % 16 + 16) % 16;
        const y = c.heightmap[lz * 16 + lx] + 1;
        const below = BLOCKS[c.getBlock(lx, y - 1, lz)];
        const here = BLOCKS[c.getBlock(lx, y, lz)];
        const def = MOBS[e.t];
        if (!here.solid && here.kind !== 'liquid' && below.solid && ((def.spawnOn || ['grass_block']).includes(below.name))) {
          const m = g.spawnMob(e.t, bx + lx + 0.5, y, bz + lz + 0.5);
          if (m) { m.persistent = true; break; }
        }
        x += rand(5) - rand(5); z += rand(5) - rand(5);
        while (x < bx) x += 5; while (x >= bx + 16) x -= 5; while (z < bz) z += 5; while (z >= bz + 16) z -= 5;
      }
    }
    void w;
  }

  // monster spawner block entity
  spawnerTick(be) {
    const g = this.game, p = g.player, w = g.world;
    if (!be.mob || !MOBS[be.mob]) return;
    const dx = p.x - (be.x + 0.5), dy = p.y - (be.y + 0.5), dz = p.z - (be.z + 0.5);
    if (dx * dx + dy * dy + dz * dz > 256) return;
    if (g.particles && Math.random() < 0.5) {
      g.particles.spawn('smoke', be.x + Math.random(), be.y + Math.random(), be.z + Math.random(), 0, 0, 0);
      g.particles.spawn('flame', be.x + Math.random(), be.y + Math.random(), be.z + Math.random(), 0, 0, 0);
    }
    if (be.delay === undefined) be.delay = 20;
    if (--be.delay > 0) return;
    be.delay = 200 + rand(600);
    if (MOBS[be.mob].cat === 'monster' && g.difficulty === 0) return;
    let near = 0;
    for (const e of g.entities) if (e.mobType === be.mob && Math.abs(e.x - be.x) < 9 && Math.abs(e.y - be.y) < 5 && Math.abs(e.z - be.z) < 9) near++;
    for (let i = 0; i < 4 && near < 6; i++) {
      const x = be.x + rand(9) - 4, y = be.y + rand(3) - 1, z = be.z + rand(9) - 4;
      const def = MOBS[be.mob];
      let ok = BLOCKS[w.getBlock(x, y - 1, z)].solid;
      for (let k = 0; k < Math.ceil(def.h) && ok; k++) if (BLOCKS[w.getBlock(x, y + k, z)].solid) ok = false;
      if (!ok) continue;
      const m = g.spawnMob(be.mob, x + 0.5, y, z + 0.5);
      if (m) { near++; m.persistent = false; if (g.particles) for (let k = 0; k < 15; k++) g.particles.spawn('poof', x + 0.5 + (Math.random() - 0.5), y + Math.random() * def.h, z + 0.5 + (Math.random() - 0.5), 0, 0, 0); }
    }
  }
}
