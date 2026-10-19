// Enchantment registry and helpers (Minecraft Java 1.20 data: rarity weights, level costs,
// item categories, incompatibilities, and the enchanting-table selection algorithm).
//
// Item stack tag format (shared by every feature):
//   stack.tag.enchantments        = { sharpness: 5, unbreaking: 3 }   // on tools/armor/etc.
//   stack.tag.storedEnchantments  = { mending: 1 }                    // on enchanted_book
//   stack.tag.repairCost          = prior-work penalty used by the anvil
//   stack.tag.name                = custom name (anvil rename / name tags)

const COMMON = 10, UNCOMMON = 5, RARE = 2, VERY_RARE = 1;
const lin = (base, per, span) => [(l) => base + (l - 1) * per, (l) => base + (l - 1) * per + span];

// category -> which items can take the enchantment
const CATEGORY = {
  armor: (it) => !!(it.armor && it.armor.material !== 'elytra'),
  armor_head: (it) => !!(it.armor && it.armor.slot === 'head'),
  armor_chest: (it) => !!(it.armor && it.armor.slot === 'chest' && it.armor.material !== 'elytra'),
  armor_legs: (it) => !!(it.armor && it.armor.slot === 'legs'),
  armor_feet: (it) => !!(it.armor && it.armor.slot === 'feet'),
  weapon: (it) => !!(it.tool && it.tool.type === 'sword'),
  digger: (it) => !!(it.tool && ['pickaxe', 'axe', 'shovel', 'hoe'].includes(it.tool.type)),
  breakable: (it) => it.durability > 0,
  wearable: (it) => !!it.armor || it.name === 'carved_pumpkin' || it.name.endsWith('_head') || it.name.endsWith('_skull'),
  vanishable: (it) => it.durability > 0 || it.name === 'compass' || it.name === 'carved_pumpkin',
  bow: (it) => it.kind === 'bow',
  crossbow: (it) => it.kind === 'crossbow',
  trident: (it) => it.kind === 'trident',
  fishing_rod: (it) => it.kind === 'fishing_rod',
};

// [id, weight, maxLevel, category, minCost(l), maxCost(l), flags]
const DEFS = [
  ['protection', COMMON, 4, 'armor', ...lin(1, 11, 11)],
  ['fire_protection', UNCOMMON, 4, 'armor', ...lin(10, 8, 8)],
  ['feather_falling', UNCOMMON, 4, 'armor_feet', ...lin(5, 6, 6)],
  ['blast_protection', RARE, 4, 'armor', ...lin(5, 8, 8)],
  ['projectile_protection', UNCOMMON, 4, 'armor', ...lin(3, 6, 6)],
  ['respiration', RARE, 3, 'armor_head', (l) => 10 * l, (l) => 10 * l + 30],
  ['aqua_affinity', RARE, 1, 'armor_head', () => 1, () => 41],
  ['thorns', VERY_RARE, 3, 'armor_chest', ...lin(10, 20, 50), { anvilCategory: 'armor' }],
  ['depth_strider', RARE, 3, 'armor_feet', (l) => 10 * l, (l) => 10 * l + 15],
  ['frost_walker', RARE, 2, 'armor_feet', (l) => 10 * l, (l) => 10 * l + 15, { treasure: true }],
  ['binding_curse', VERY_RARE, 1, 'wearable', () => 25, () => 50, { treasure: true, curse: true, name: 'Curse of Binding' }],
  ['soul_speed', VERY_RARE, 3, 'armor_feet', (l) => 10 * l, (l) => 10 * l + 15, { treasure: true, tradeable: false }],
  ['swift_sneak', VERY_RARE, 3, 'armor_legs', (l) => 25 * l, (l) => 25 * l + 50, { treasure: true, tradeable: false }],
  ['sharpness', COMMON, 5, 'weapon', ...lin(1, 11, 20), { anvilCategory: 'axe_or_weapon' }],
  ['smite', UNCOMMON, 5, 'weapon', ...lin(5, 8, 20), { anvilCategory: 'axe_or_weapon' }],
  ['bane_of_arthropods', UNCOMMON, 5, 'weapon', ...lin(5, 8, 20), { anvilCategory: 'axe_or_weapon' }],
  ['knockback', UNCOMMON, 2, 'weapon', ...lin(5, 20, 50)],
  ['fire_aspect', RARE, 2, 'weapon', ...lin(10, 20, 50)],
  ['looting', RARE, 3, 'weapon', ...lin(15, 9, 50)],
  ['sweeping_edge', RARE, 3, 'weapon', ...lin(5, 9, 15), { name: 'Sweeping Edge' }],
  ['efficiency', COMMON, 5, 'digger', ...lin(1, 10, 50), { anvilCategory: 'digger_or_shears' }],
  ['silk_touch', VERY_RARE, 1, 'digger', () => 15, () => 65],
  ['unbreaking', UNCOMMON, 3, 'breakable', ...lin(5, 8, 50)],
  ['fortune', RARE, 3, 'digger', ...lin(15, 9, 50)],
  ['power', COMMON, 5, 'bow', ...lin(1, 10, 15)],
  ['punch', RARE, 2, 'bow', ...lin(12, 20, 25)],
  ['flame', RARE, 1, 'bow', () => 20, () => 50],
  ['infinity', VERY_RARE, 1, 'bow', () => 20, () => 50],
  ['luck_of_the_sea', RARE, 3, 'fishing_rod', ...lin(15, 9, 50)],
  ['lure', RARE, 3, 'fishing_rod', ...lin(15, 9, 50)],
  ['loyalty', UNCOMMON, 3, 'trident', (l) => 5 + l * 7, () => 50],
  ['impaling', RARE, 5, 'trident', ...lin(1, 8, 20)],
  ['riptide', RARE, 3, 'trident', (l) => 10 + l * 7, () => 50],
  ['channeling', VERY_RARE, 1, 'trident', () => 25, () => 50],
  ['multishot', RARE, 1, 'crossbow', () => 20, () => 50],
  ['quick_charge', UNCOMMON, 3, 'crossbow', (l) => 12 + (l - 1) * 20, () => 50],
  ['piercing', COMMON, 4, 'crossbow', (l) => 1 + (l - 1) * 10, () => 50],
  ['mending', RARE, 1, 'breakable', (l) => l * 25, (l) => l * 25 + 50, { treasure: true }],
  ['vanishing_curse', VERY_RARE, 1, 'vanishable', () => 25, () => 50, { treasure: true, curse: true, name: 'Curse of Vanishing' }],
];

const EXCLUSIVE = [
  ['protection', 'fire_protection', 'blast_protection', 'projectile_protection'],
  ['sharpness', 'smite', 'bane_of_arthropods'],
  ['silk_touch', 'fortune'], ['silk_touch', 'looting'],
  ['depth_strider', 'frost_walker'],
  ['infinity', 'mending'],
  ['riptide', 'loyalty'], ['riptide', 'channeling'],
  ['multishot', 'piercing'],
];

export const ENCHANTMENTS = {};
for (const [id, weight, maxLevel, category, minCost, maxCost, flags = {}] of DEFS) {
  ENCHANTMENTS[id] = {
    id, weight, maxLevel, category, minCost, maxCost,
    treasure: !!flags.treasure, curse: !!flags.curse, tradeable: flags.tradeable !== false,
    anvilCategory: flags.anvilCategory || category,
    name: flags.name || id.split('_').map((w) => (w === 'of' || w === 'the' ? w : w[0].toUpperCase() + w.slice(1))).join(' '),
    // anvil cost multiplier per level (halved for books, min 1)
    anvilMultiplier: weight === COMMON ? 1 : weight === UNCOMMON ? 2 : weight === RARE ? 4 : 8,
  };
}
export const ENCHANTMENT_IDS = Object.keys(ENCHANTMENTS);

// enchantability of an item (0 = cannot be enchanted at a table)
const TOOL_ENCH = { wooden: 15, stone: 5, iron: 14, golden: 22, diamond: 10, netherite: 15 };
const ARMOR_ENCH = { leather: 15, chainmail: 12, iron: 9, golden: 25, diamond: 10, netherite: 15, turtle: 9 };
export function enchantability(item) {
  if (item.name === 'book') return 1;
  if (item.tool && item.tool.tier) return TOOL_ENCH[item.tool.tier] || 0;
  if (item.armor && ARMOR_ENCH[item.armor.material]) return ARMOR_ENCH[item.armor.material];
  if (['bow', 'crossbow', 'trident', 'fishing_rod'].includes(item.kind)) return 1;
  return 0;
}

export function exclusive(a, b) {
  if (a === b) return true;
  return EXCLUSIVE.some((g) => g.includes(a) && g.includes(b));
}

// can this enchantment go on this item? (anvil=true also allows anvil-only categories such as Sharpness on axes)
export function canEnchant(id, item, anvil = false) {
  const e = ENCHANTMENTS[id];
  if (!e) return false;
  if (item.name === 'book' || item.name === 'enchanted_book') return true;
  if (CATEGORY[e.category](item)) return true;
  if (!anvil) return false;
  if (e.anvilCategory === 'axe_or_weapon') return !!(item.tool && (item.tool.type === 'axe' || item.tool.type === 'sword'));
  if (e.anvilCategory === 'digger_or_shears') return !!(item.tool && (CATEGORY.digger(item) || item.tool.type === 'shears'));
  if (e.anvilCategory === 'armor') return CATEGORY.armor(item);
  return false;
}

// ---------------------------------------------------------------- stack helpers
const bag = (stack) => (stack && stack.tag ? (stack.item.name === 'enchanted_book' ? stack.tag.storedEnchantments : stack.tag.enchantments) : null);
export function getEnchantments(stack) { return { ...(bag(stack) || {}) }; }
export function enchantLevel(stack, id) { const b = stack && stack.tag && stack.tag.enchantments; return b ? b[id] || 0 : 0; }
export function hasEnchantments(stack) { const b = bag(stack); return !!(b && Object.keys(b).length); }
export function setEnchantments(stack, map) {
  stack.tag = stack.tag || {};
  const key = stack.item.name === 'enchanted_book' ? 'storedEnchantments' : 'enchantments';
  const clean = Object.fromEntries(Object.entries(map).filter(([, l]) => l > 0));
  if (Object.keys(clean).length) stack.tag[key] = clean; else delete stack.tag[key];
  if (!Object.keys(stack.tag).length) stack.tag = null;
  return stack;
}
export function addEnchantment(stack, id, level) { const m = getEnchantments(stack); m[id] = level; return setEnchantments(stack, m); }

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
export function roman(n) { return ROMAN[n] || String(n); }
// tooltip line, e.g. "Sharpness V" (single-level enchantments show no numeral, like Minecraft)
export function enchantmentLine(id, level) {
  const e = ENCHANTMENTS[id];
  if (!e) return `${id} ${roman(level)}`;
  return e.maxLevel === 1 && level === 1 ? e.name : `${e.name} ${roman(level)}`;
}
export function isCurse(id) { return !!(ENCHANTMENTS[id] && ENCHANTMENTS[id].curse); }

// ---------------------------------------------------------------- random enchanting
// rng: object with nextInt(n) and nextFloat(); defaults to Math.random
export const MathRng = { nextInt: (n) => Math.floor(Math.random() * n), nextFloat: () => Math.random() };

function weightedPick(rng, list) {
  let total = 0;
  for (const e of list) total += ENCHANTMENTS[e.id].weight;
  let r = rng.nextInt(total);
  for (const e of list) { r -= ENCHANTMENTS[e.id].weight; if (r < 0) return e; }
  return list[list.length - 1];
}

// all enchantments (with the highest fitting level) available at a given power level
export function availableEnchantments(power, item, treasure = false) {
  const out = [];
  const book = item.name === 'book';
  for (const id of ENCHANTMENT_IDS) {
    const e = ENCHANTMENTS[id];
    if (e.treasure && !treasure) continue;
    if (id === 'soul_speed' || id === 'swift_sneak') continue; // not discoverable this way
    if (!book && !CATEGORY[e.category](item)) continue;
    for (let l = e.maxLevel; l >= 1; l--) if (power >= e.minCost(l) && power <= e.maxCost(l)) { out.push({ id, level: l }); break; }
  }
  return out;
}

// Minecraft's EnchantmentHelper.selectEnchantment
export function selectEnchantments(item, power, treasure = false, rng = MathRng) {
  const ench = enchantability(item);
  if (ench <= 0) return [];
  let level = power + 1 + rng.nextInt(Math.floor(ench / 4) + 1) + rng.nextInt(Math.floor(ench / 4) + 1);
  const f = (rng.nextFloat() + rng.nextFloat() - 1) * 0.15;
  level = Math.max(1, Math.round(level + level * f));
  let list = availableEnchantments(level, item, treasure);
  const out = [];
  if (!list.length) return out;
  out.push(weightedPick(rng, list));
  while (rng.nextInt(50) <= level) {
    const last = out[out.length - 1];
    list = list.filter((e) => !exclusive(e.id, last.id) && !out.some((o) => exclusive(o.id, e.id)));
    if (!list.length) break;
    out.push(weightedPick(rng, list));
    level = Math.floor(level / 2);
  }
  return out;
}

// enchanting table level requirement for slot 0..2 (EnchantmentHelper.getEnchantmentCost)
export function tableCost(rng, slot, bookshelves, item) {
  if (enchantability(item) <= 0) return 0;
  const b = Math.min(15, bookshelves);
  const j = rng.nextInt(8) + 1 + (b >> 1) + rng.nextInt(b + 1);
  if (slot === 0) return Math.max(Math.floor(j / 3), 1);
  if (slot === 1) return Math.floor(j * 2 / 3) + 1;
  return Math.max(j, b * 2);
}

// "enchant_with_levels" loot function: returns the enchanted stack (books become enchanted books)
export function enchantWithLevels(stack, levels, treasure = false, rng = MathRng, ItemStackCtor = null) {
  const picks = selectEnchantments(stack.item, levels, treasure, rng);
  if (!picks.length) return stack;
  let out = stack;
  if (stack.item.name === 'book' && ItemStackCtor) out = new ItemStackCtor('enchanted_book', 1);
  const map = getEnchantments(out);
  for (const p of picks) map[p.id] = p.level;
  return setEnchantments(out, map);
}

// "enchant_randomly" loot function: one random applicable enchantment at a random level
export function enchantRandomly(stack, rng = MathRng, ItemStackCtor = null, treasure = true) {
  const ids = ENCHANTMENT_IDS.filter((id) => (treasure || !ENCHANTMENTS[id].treasure) && (stack.item.name === 'book' || canEnchant(id, stack.item)));
  if (!ids.length) return stack;
  const id = ids[rng.nextInt(ids.length)];
  const level = 1 + rng.nextInt(ENCHANTMENTS[id].maxLevel);
  let out = stack;
  if (stack.item.name === 'book' && ItemStackCtor) out = new ItemStackCtor('enchanted_book', 1);
  return addEnchantment(out, id, level);
}
