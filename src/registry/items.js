// Item registry: block items (generated from blocks) plus every non-block item.
import { titleCase } from '../core/util.js';
import { BLOCKS, BLOCK, WOODS, NETHER_WOODS, COLORS } from './blocks.js';

export const ITEMS = [];
export const ITEM = Object.create(null);

const TAB_ORDER = ['building', 'colored', 'natural', 'functional', 'redstone', 'tools', 'combat', 'food', 'ingredients', 'spawn_eggs'];
export const CREATIVE_TABS = [
  { id: 'building', name: 'Building Blocks', icon: 'bricks' },
  { id: 'colored', name: 'Colored Blocks', icon: 'cyan_wool' },
  { id: 'natural', name: 'Natural Blocks', icon: 'grass_block' },
  { id: 'functional', name: 'Functional Blocks', icon: 'oak_sign' },
  { id: 'redstone', name: 'Redstone Blocks', icon: 'redstone' },
  { id: 'hotbar', name: 'Saved Hotbars', icon: 'bookshelf', special: true },
  { id: 'search', name: 'Search Items', icon: 'compass', special: true },
  { id: 'tools', name: 'Tools & Utilities', icon: 'diamond_pickaxe' },
  { id: 'combat', name: 'Combat', icon: 'netherite_sword' },
  { id: 'food', name: 'Food & Drinks', icon: 'golden_apple' },
  { id: 'ingredients', name: 'Ingredients', icon: 'iron_ingot' },
  { id: 'spawn_eggs', name: 'Spawn Eggs', icon: 'pig_spawn_egg' },
  { id: 'op', name: 'Operator Utilities', icon: 'command_block', special: true, hidden: true },
  { id: 'inventory', name: 'Survival Inventory', icon: 'chest', special: true },
];
void TAB_ORDER;

function item(name, props = {}) {
  if (ITEM[name]) throw new Error('duplicate item ' + name);
  const def = Object.assign({
    maxStack: 64, durability: 0, tab: 'ingredients', icon: name, block: null, rarity: 'common', fuel: 0,
  }, props);
  def.id = ITEMS.length;
  def.name = name;
  def.displayName = props.displayName || titleCase(name);
  ITEMS.push(def);
  ITEM[name] = def;
  return def;
}

// air item placeholder (id 0)
item('air', { maxStack: 0, tab: null, icon: null });

// ---------------------------- block items ----------------------------
const FLAT_ICON_KINDS = new Set(['flower', 'sapling', 'grass', 'mushroom', 'tall_plant', 'torch', 'redstone_torch', 'ladder', 'rail', 'vine',
  'lily_pad', 'door', 'sign', 'pane', 'cobweb', 'lantern', 'chain', 'candle', 'sugar_cane', 'lever', 'kelp']);
const FLAT_ICON_NAMES = {
  sugar_cane: 'item:sugar_cane', lantern: 'item:lantern', soul_lantern: 'item:soul_lantern', chain: 'item:chain', campfire: 'item:campfire',
  brewing_stand: 'item:brewing_stand', cauldron: 'item:cauldron', hopper: 'item:hopper', repeater: 'item:repeater', comparator: 'item:comparator',
  flower_pot: 'item:flower_pot', bell: 'item:bell', cake: 'item:cake', iron_bars: 'iron_bars', glass_pane: 'glass',
  lever: 'lever', tripwire_hook: 'tripwire_hook', cobweb: 'cobweb', seagrass: 'seagrass', redstone_torch: 'redstone_torch',
  torch: 'torch', soul_torch: 'soul_torch', ladder: 'ladder', vine: 'vine', lily_pad: 'lily_pad', end_rod: null, lightning_rod: null,
  iron_door: 'item:iron_door', dead_bush: 'dead_bush',
};
for (const b of BLOCKS) {
  if (!b.item || b.id === 0) continue;
  let icon = 'block3d';
  if (FLAT_ICON_NAMES[b.name] !== undefined) icon = FLAT_ICON_NAMES[b.name] || 'block3d';
  else if (b.kind === 'door') icon = `item:${b.name}`;
  else if (b.kind === 'sign') icon = `item:${b.name}`;
  else if (b.kind === 'pane') icon = b.tex;
  else if (b.kind === 'tall_plant') icon = b.topTex;
  else if (b.kind === 'candle') icon = `item:${b.name}`;
  else if (b.kind === 'bed') icon = 'block3d';
  else if (b.shape === 'cross') icon = b.tex;
  else if (FLAT_ICON_KINDS.has(b.kind)) icon = typeof b.tex === 'string' ? b.tex : 'block3d';
  const tint = (b.shape === 'cross' || b.kind === 'tall_plant' || b.kind === 'vine' || b.kind === 'lily_pad') && b.tint ? b.tint : null;
  const props = { block: b.name, tab: b.tab, icon, iconTint: tint, displayName: b.displayName };
  if (b.kind === 'door' || b.kind === 'sign' || b.kind === 'bed') props.maxStack = b.kind === 'sign' ? 16 : b.kind === 'bed' ? 1 : 64;
  if (b.name === 'cake') props.maxStack = 1;
  if (b.kind === 'bed') props.maxStack = 1;
  item(b.name, props);
}

// ---------------------------- tools ----------------------------
export const TIERS = {
  wooden: { level: 0, speed: 2, durability: 59, repair: 'planks', fuel: 200 },
  stone: { level: 1, speed: 4, durability: 131, repair: 'cobblestone' },
  iron: { level: 2, speed: 6, durability: 250, repair: 'iron_ingot' },
  golden: { level: 0, speed: 12, durability: 32, repair: 'gold_ingot' },
  diamond: { level: 3, speed: 8, durability: 1561, repair: 'diamond' },
  netherite: { level: 4, speed: 9, durability: 2031, repair: 'netherite_ingot', fireproof: true },
};
const DMG = {
  sword: { wooden: 4, stone: 5, iron: 6, golden: 4, diamond: 7, netherite: 8 },
  shovel: { wooden: 2.5, stone: 3.5, iron: 4.5, golden: 2.5, diamond: 5.5, netherite: 6.5 },
  pickaxe: { wooden: 2, stone: 3, iron: 4, golden: 2, diamond: 5, netherite: 6 },
  axe: { wooden: 7, stone: 9, iron: 9, golden: 7, diamond: 9, netherite: 10 },
  hoe: { wooden: 1, stone: 1, iron: 1, golden: 1, diamond: 1, netherite: 1 },
};
const SPD = {
  sword: () => 1.6, shovel: () => 1, pickaxe: () => 1.2,
  axe: (t) => ({ wooden: 0.8, stone: 0.8, iron: 0.9, golden: 1, diamond: 1, netherite: 1 })[t],
  hoe: (t) => ({ wooden: 1, stone: 2, iron: 3, golden: 1, diamond: 4, netherite: 4 })[t],
};
for (const tier of Object.keys(TIERS)) {
  for (const type of ['shovel', 'pickaxe', 'axe', 'hoe', 'sword']) {
    const t = TIERS[tier];
    item(`${tier}_${type}`, {
      maxStack: 1, durability: t.durability, tab: type === 'sword' ? 'combat' : 'tools',
      tool: { type, level: t.level, speed: t.speed, tier },
      damage: DMG[type][tier], attackSpeed: SPD[type](tier), fuel: tier === 'wooden' ? 200 : 0,
      fireproof: !!t.fireproof, rarity: 'common', kind: 'tool',
    });
  }
}

// ---------------------------- armor ----------------------------
const ARMOR = {
  leather: { mult: 5, def: [1, 3, 2, 1], tough: 0, dyeable: true },
  chainmail: { mult: 15, def: [2, 5, 4, 1], tough: 0 },
  iron: { mult: 15, def: [2, 6, 5, 2], tough: 0 },
  golden: { mult: 7, def: [2, 5, 3, 1], tough: 0 },
  diamond: { mult: 33, def: [3, 8, 6, 3], tough: 2 },
  netherite: { mult: 37, def: [3, 8, 6, 3], tough: 3, kb: 0.1 },
};
const SLOTS = [['helmet', 11, 'head'], ['chestplate', 16, 'chest'], ['leggings', 15, 'legs'], ['boots', 13, 'feet']];
for (const [mat, a] of Object.entries(ARMOR)) {
  SLOTS.forEach(([piece, base, slot], i) => {
    item(`${mat}_${piece}`, {
      maxStack: 1, durability: base * a.mult, tab: 'combat', kind: 'armor',
      armor: { slot, points: a.def[i], toughness: a.tough, kb: a.kb || 0, material: mat },
    });
  });
}
item('turtle_helmet', { maxStack: 1, durability: 275, tab: 'combat', kind: 'armor', armor: { slot: 'head', points: 2, toughness: 0, material: 'turtle' }, displayName: 'Turtle Shell' });

// ---------------------------- tools & utilities ----------------------------
item('flint_and_steel', { maxStack: 1, durability: 64, tab: 'tools', kind: 'flint_and_steel' });
item('fire_charge', { tab: 'tools', kind: 'fire_charge' });
item('shears', { maxStack: 1, durability: 238, tab: 'tools', tool: { type: 'shears', level: 0, speed: 1.5 }, kind: 'shears' });
item('bucket', { maxStack: 16, tab: 'tools', kind: 'bucket' });
item('water_bucket', { maxStack: 1, tab: 'tools', kind: 'bucket', fluid: 'water' });
item('lava_bucket', { maxStack: 1, tab: 'tools', kind: 'bucket', fluid: 'lava', fuel: 20000 });
item('milk_bucket', { maxStack: 1, tab: 'food', kind: 'milk' });
item('powder_snow_bucket', { maxStack: 1, tab: 'tools', kind: 'bucket', fluid: 'powder_snow' });
item('fishing_rod', { maxStack: 1, durability: 64, tab: 'tools', kind: 'fishing_rod', fuel: 300 });
item('compass', { tab: 'tools', kind: 'compass' });
item('recovery_compass', { tab: 'tools', rarity: 'uncommon' });
item('clock', { tab: 'tools', kind: 'clock' });
item('spyglass', { maxStack: 1, tab: 'tools', kind: 'spyglass' });
item('map', { tab: 'tools', displayName: 'Empty Map' });
item('writable_book', { maxStack: 1, tab: 'tools', displayName: 'Book and Quill' });
item('name_tag', { tab: 'tools' });
item('lead', { tab: 'tools' });
item('saddle', { maxStack: 1, tab: 'tools' });
item('carrot_on_a_stick', { maxStack: 1, durability: 25, tab: 'tools' });
item('brush', { maxStack: 1, durability: 64, tab: 'tools' });
for (const w of WOODS) item(`${w}_boat`, { maxStack: 1, tab: 'tools', kind: 'boat', wood: w, fuel: 1200 });
item('minecart', { maxStack: 1, tab: 'tools', kind: 'minecart' });
item('chest_minecart', { maxStack: 1, tab: 'tools', displayName: 'Minecart with Chest' });
item('elytra', { maxStack: 1, durability: 432, tab: 'tools', rarity: 'uncommon', kind: 'armor', armor: { slot: 'chest', points: 0, toughness: 0, material: 'elytra' } });
item('ender_pearl', { maxStack: 16, tab: 'tools', kind: 'ender_pearl' });
item('ender_eye', { tab: 'tools', displayName: 'Eye of Ender' });
item('firework_rocket', { tab: 'tools' });
const DISCS = ['13', 'cat', 'blocks', 'chirp', 'far', 'mall', 'mellohi', 'stal', 'strad', 'ward', '11', 'wait', 'otherside', 'pigstep', 'relic', '5'];
const DISC_COLORS = { '13': 0xe0c040, cat: 0x40c040, blocks: 0xd06030, chirp: 0xc03030, far: 0x80d040, mall: 0x6060c0, mellohi: 0xc060c0, stal: 0x202020, strad: 0xf0f0f0, ward: 0x40a080, '11': 0x303030, wait: 0x40c0d0, otherside: 0x4080c0, pigstep: 0xa04040, relic: 0x40a0a0, '5': 0x6080a0 };
for (const d of DISCS) item(`music_disc_${d}`, { maxStack: 1, tab: 'tools', rarity: d === 'pigstep' || d === 'otherside' || d === '5' || d === 'relic' ? 'rare' : 'rare', kind: 'music_disc', disc: d, discColor: DISC_COLORS[d], displayName: 'Music Disc', subtitle: `C418 - ${d}` });

// ---------------------------- combat ----------------------------
item('bow', { maxStack: 1, durability: 384, tab: 'combat', kind: 'bow', fuel: 300 });
item('crossbow', { maxStack: 1, durability: 465, tab: 'combat', kind: 'crossbow', fuel: 300 });
item('arrow', { tab: 'combat', kind: 'arrow' });
item('spectral_arrow', { tab: 'combat', kind: 'arrow' });
item('shield', { maxStack: 1, durability: 336, tab: 'combat', kind: 'shield' });
item('trident', { maxStack: 1, durability: 250, tab: 'combat', damage: 9, attackSpeed: 1.1, rarity: 'epic', kind: 'trident' });
item('totem_of_undying', { maxStack: 1, tab: 'combat', rarity: 'uncommon' });
item('snowball', { maxStack: 16, tab: 'combat', kind: 'snowball' });
item('egg', { maxStack: 16, tab: 'combat', kind: 'egg' });
item('wind_charge', { tab: 'combat' });

// ---------------------------- food & drinks ----------------------------
const FOOD = [
  ['apple', 4, 2.4], ['golden_apple', 4, 9.6, { rarity: 'rare', alwaysEdible: true, effects: [['regeneration', 100, 1], ['absorption', 2400, 0]] }],
  ['enchanted_golden_apple', 4, 9.6, { rarity: 'epic', alwaysEdible: true, glint: true, effects: [['regeneration', 400, 1], ['absorption', 2400, 3], ['resistance', 6000, 0], ['fire_resistance', 6000, 0]] }],
  ['melon_slice', 2, 1.2], ['sweet_berries', 2, 0.4, { places: 'sweet_berry_bush' }], ['glow_berries', 2, 0.4],
  ['chorus_fruit', 4, 2.4, { alwaysEdible: true }], ['carrot', 3, 3.6, { places: 'carrots' }],
  ['golden_carrot', 6, 14.4], ['potato', 1, 0.6, { places: 'potatoes' }], ['baked_potato', 5, 6],
  ['poisonous_potato', 2, 1.2, { effects: [['poison', 100, 0, 0.6]] }], ['beetroot', 1, 1.2], ['dried_kelp', 1, 0.6, { eatTicks: 16 }],
  ['beef', 3, 1.8], ['cooked_beef', 8, 12.8, { displayName: 'Steak' }], ['porkchop', 3, 1.8, { displayName: 'Raw Porkchop' }], ['cooked_porkchop', 8, 12.8],
  ['mutton', 2, 1.2, { displayName: 'Raw Mutton' }], ['cooked_mutton', 6, 9.6], ['chicken', 2, 1.2, { displayName: 'Raw Chicken', effects: [['hunger', 600, 0, 0.3]] }],
  ['cooked_chicken', 6, 7.2], ['rabbit', 3, 1.8, { displayName: 'Raw Rabbit' }], ['cooked_rabbit', 5, 6], ['cod', 2, 0.4, { displayName: 'Raw Cod' }],
  ['cooked_cod', 5, 6], ['salmon', 2, 0.4, { displayName: 'Raw Salmon' }], ['cooked_salmon', 6, 9.6], ['tropical_fish', 1, 0.2],
  ['pufferfish', 1, 0.2, { effects: [['hunger', 300, 2], ['nausea', 300, 0], ['poison', 1200, 1]] }],
  ['bread', 5, 6], ['cookie', 2, 0.4], ['pumpkin_pie', 8, 4.8], ['rotten_flesh', 4, 0.8, { effects: [['hunger', 600, 0, 0.8]] }],
  ['spider_eye', 2, 3.2, { effects: [['poison', 100, 0]] }],
  ['mushroom_stew', 6, 7.2, { maxStack: 1, bowl: true }], ['beetroot_soup', 6, 7.2, { maxStack: 1, bowl: true }],
  ['rabbit_stew', 10, 12, { maxStack: 1, bowl: true }], ['suspicious_stew', 6, 7.2, { maxStack: 1, bowl: true }],
  ['honey_bottle', 6, 1.2, { maxStack: 16, drink: true, bottle: true }],
];
for (const [name, n, s, extra = {}] of FOOD) {
  item(name, { tab: 'food', food: { n, s, alwaysEdible: !!extra.alwaysEdible, effects: extra.effects || [], eatTicks: extra.eatTicks || 32 }, kind: 'food', ...extra });
}
const POTIONS = [
  ['water', null, 0x385dc6], ['awkward', null, 0x385dc6], ['mundane', null, 0x385dc6], ['thick', null, 0x385dc6],
  ['night_vision', ['night_vision', 3600, 0], 0x1f1fa1], ['invisibility', ['invisibility', 3600, 0], 0x7f8392],
  ['leaping', ['jump_boost', 3600, 0], 0x22ff4c], ['fire_resistance', ['fire_resistance', 3600, 0], 0xe49a3a],
  ['swiftness', ['speed', 3600, 0], 0x7cafc6], ['slowness', ['slowness', 1800, 0], 0x5a6c81],
  ['water_breathing', ['water_breathing', 3600, 0], 0x2e5299], ['healing', ['instant_health', 1, 0], 0xf82423],
  ['harming', ['instant_damage', 1, 0], 0x430a09], ['poison', ['poison', 900, 0], 0x4e9331],
  ['regeneration', ['regeneration', 900, 0], 0xcd5cab], ['strength', ['strength', 3600, 0], 0x932423],
  ['weakness', ['weakness', 1800, 0], 0x484d48], ['slow_falling', ['slow_falling', 1800, 0], 0xf7f8e0],
  ['luck', ['luck', 6000, 0], 0x339900],
];
for (const [p, eff, color] of POTIONS) {
  const name = p === 'water' ? 'water_bottle' : `potion_of_${p}`;
  const disp = p === 'water' ? 'Water Bottle' : ['awkward', 'mundane', 'thick'].includes(p) ? `${titleCase(p)} Potion` : `Potion of ${titleCase(p)}`;
  item(name, { maxStack: 1, tab: 'food', kind: 'potion', drink: true, bottle: true, potionColor: color, effect: eff, displayName: disp, food: { n: 0, s: 0, alwaysEdible: true, effects: eff ? [eff] : [], eatTicks: 32 }, icon: 'potion' });
}

// ---------------------------- ingredients ----------------------------
const ING = [
  ['coal', { fuel: 1600 }], ['charcoal', { fuel: 1600 }], ['raw_iron'], ['raw_copper'], ['raw_gold'], ['emerald'], ['lapis_lazuli'], ['diamond'],
  ['ancient_debris_scrap', { hidden: true }],
  ['netherite_scrap', { fireproof: true }], ['iron_ingot'], ['copper_ingot'], ['gold_ingot'], ['netherite_ingot', { fireproof: true }],
  ['iron_nugget'], ['gold_nugget'], ['amethyst_shard'], ['quartz', { displayName: 'Nether Quartz' }], ['stick', { fuel: 100 }], ['flint'],
  ['wheat_seeds', { places: 'wheat', tab: 'natural' }], ['wheat'], ['pumpkin_seeds', { places: 'pumpkin_stem', tab: 'natural' }],
  ['melon_seeds', { places: 'melon_stem', tab: 'natural' }], ['beetroot_seeds', { places: 'beetroots', tab: 'natural' }],
  ['kelp', { places: 'kelp', tab: 'natural' }], ['cocoa_beans', { tab: 'natural' }],
  ['string'], ['feather'], ['leather'], ['rabbit_hide'], ['honeycomb'], ['ink_sac'], ['glow_ink_sac'], ['turtle_scute', { displayName: 'Turtle Scute' }],
  ['slime_ball', { displayName: 'Slimeball' }], ['clay_ball'], ['prismarine_shard'], ['prismarine_crystals'], ['nautilus_shell'],
  ['heart_of_the_sea', { rarity: 'uncommon' }], ['blaze_rod', { fuel: 2400 }], ['blaze_powder'], ['bone'], ['bone_meal', { kind: 'bone_meal' }],
  ['ghast_tear'], ['magma_cream'], ['gunpowder'], ['sugar'], ['glowstone_dust'], ['redstone', { places: 'redstone_wire', tab: 'redstone', displayName: 'Redstone Dust' }],
  ['nether_wart', { tab: 'natural' }], ['fermented_spider_eye'], ['rabbit_foot'], ['glistering_melon_slice'], ['phantom_membrane'],
  ['brick'], ['nether_brick'], ['paper'], ['book'], ['enchanted_book', { maxStack: 1, rarity: 'uncommon', glint: true }],
  ['glass_bottle', { kind: 'glass_bottle' }], ['dragon_breath', { rarity: 'uncommon', displayName: "Dragon's Breath" }], ['experience_bottle', { rarity: 'uncommon', displayName: "Bottle o' Enchanting" }],
  ['shulker_shell'], ['popped_chorus_fruit'], ['echo_shard'], ['nether_star', { rarity: 'uncommon', glint: true }], ['disc_fragment_5', { displayName: 'Disc Fragment' }],
  ['bowl', { fuel: 100 }], ['armadillo_scute'], ['breeze_rod'],
];
for (const [name, extra = {}] of ING) {
  if (extra.hidden) continue;
  item(name, { tab: 'ingredients', ...extra });
}
export const DYE_COLORS = {
  white: 0xf9fffe, orange: 0xf9801d, magenta: 0xc74ebd, light_blue: 0x3ab3da, yellow: 0xfed83d, lime: 0x80c71f, pink: 0xf38baa, gray: 0x474f52,
  light_gray: 0x9d9d97, cyan: 0x169c9c, purple: 0x8932b8, blue: 0x3c44aa, brown: 0x835432, green: 0x5e7c16, red: 0xb02e26, black: 0x1d1d21,
};
for (const c of COLORS) item(`${c}_dye`, { tab: 'ingredients', kind: 'dye', color: c });

// ---------------------------- spawn eggs ----------------------------
export const SPAWN_EGGS = {
  bat: [0x4c3e30, 0x0f0f0f], cat: [0xefc88e, 0x957256], cave_spider: [0x0c424e, 0xa80e0e], chicken: [0xa1a1a1, 0xff0000],
  cow: [0x443626, 0xa1a1a1], creeper: [0x0da70b, 0x000000], drowned: [0x8ff1d7, 0x799c65], enderman: [0x161616, 0x000000],
  fox: [0xd5b69f, 0xcc6920], goat: [0xa5947c, 0x55493e], horse: [0xc09e7d, 0xeee500], husk: [0x797061, 0xe6cc94],
  iron_golem: [0xdbcdc1, 0x74a332], mooshroom: [0xa00f10, 0xb7b7b7], pig: [0xf0a5a2, 0xdb635f], polar_bear: [0xf2f2f2, 0x959590],
  rabbit: [0x995f40, 0x734831], sheep: [0xe7e7e7, 0xffb5b5], skeleton: [0xc1c1c1, 0x494949], slime: [0x51a03e, 0x7ebf6e],
  snow_golem: [0xd9f2f2, 0x81a4a4], spider: [0x342d27, 0xa80e0e], squid: [0x223b4d, 0x708899], stray: [0x617677, 0xddeaea],
  villager: [0x563c33, 0xbd8b72], witch: [0x340000, 0x51a03e], wolf: [0xd7d3d3, 0xceaf96], zombie: [0x00afaf, 0x799c65],
  zombie_villager: [0x563c33, 0x799c65], glow_squid: [0x095656, 0x85f1bc], ocelot: [0xefde7d, 0x564434], panda: [0xe7e7e7, 0x1b1b22],
  llama: [0xc09e7d, 0x995f40], silverfish: [0x6e6e6e, 0x303030], endermite: [0x161616, 0x6e6e6e], phantom: [0x43518a, 0x88ff00],
  magma_cube: [0x340000, 0xfcfc00], blaze: [0xf6b201, 0xfff87e], wither_skeleton: [0x141414, 0x474d4d], piglin: [0x995f40, 0xf9f3a4],
  zombified_piglin: [0xea9393, 0x4c7129], donkey: [0x534539, 0x867566], frog: [0xd07444, 0xffc77c], axolotl: [0xfbc1e3, 0xa62d74],
  turtle: [0xe7e7e7, 0x00afaf], bee: [0xedc343, 0x43241b], parrot: [0x0da70b, 0xff0000], dolphin: [0x223b4d, 0xf9f9f9],
};
for (const [mob, [a, b]] of Object.entries(SPAWN_EGGS)) {
  item(`${mob}_spawn_egg`, { tab: 'spawn_eggs', kind: 'spawn_egg', mob, eggColors: [a, b], icon: 'spawn_egg' });
}

// ---------------------------- operator ----------------------------
item('command_block', { tab: 'op', rarity: 'epic', hidden: true, icon: 'block3d_missing' });
item('debug_stick', { tab: 'op', maxStack: 1, rarity: 'epic', glint: true });
item('barrier', { tab: 'op', rarity: 'epic' });
item('light', { tab: 'op', displayName: 'Light' });

// fuel values for block items
for (const it of ITEMS) {
  if (!it.block || it.fuel) continue;
  const b = BLOCK[it.block];
  if (!b) continue;
  if (b.woodType && !NETHER_WOODS.includes(b.woodType)) {
    if (b.kind === 'slab') it.fuel = 150;
    else if (b.kind === 'button') it.fuel = 100;
    else if (b.kind === 'door' || b.kind === 'sign') it.fuel = 200;
    else if (b.kind === 'sapling') it.fuel = 100;
    else it.fuel = 300;
  }
  if (b.name.endsWith('_wool')) it.fuel = 100;
  if (b.name.endsWith('_carpet')) it.fuel = 67;
  if (['crafting_table', 'chest', 'trapped_chest', 'bookshelf', 'chiseled_bookshelf', 'barrel', 'lectern', 'composter', 'loom', 'cartography_table',
    'fletching_table', 'smithing_table', 'note_block', 'jukebox', 'ladder', 'daylight_detector'].includes(b.name)) it.fuel = 300;
  if (b.name === 'coal_block') it.fuel = 16000;
  if (b.name === 'dried_kelp_block') it.fuel = 4001;
  if (b.name === 'scaffolding') it.fuel = 50;
  if (b.name === 'dead_bush') it.fuel = 100;
}

export const ITEM_COUNT = ITEMS.length;

export function itemOfBlock(blockDef) {
  if (!blockDef) return null;
  if (blockDef.pick) return ITEM[blockDef.pick];
  return ITEM[blockDef.name] || null;
}

// rarity text colours (Minecraft formatting colours)
export const RARITY_COLOR = { common: 0xffffff, uncommon: 0xffff55, rare: 0x55ffff, epic: 0xff55ff };
