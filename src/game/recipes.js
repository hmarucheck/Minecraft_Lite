// Crafting and smelting recipes.
import { ITEM } from '../registry/items.js';
import { WOODS, NETHER_WOODS, COLORS } from '../registry/blocks.js';

export const RECIPES = [];
export const SMELTING = new Map(); // input item name -> {result, xp, kinds}

// ---------- tags ----------
export const TAGS = {
  planks: [...WOODS, ...NETHER_WOODS].map((w) => `${w}_planks`),
  wool: COLORS.map((c) => `${c}_wool`),
  stone_crafting: ['cobblestone', 'cobbled_deepslate', 'blackstone'],
  stone_tool: ['cobblestone', 'cobbled_deepslate', 'blackstone'],
  coals: ['coal', 'charcoal'],
  wooden_slabs: [...WOODS, ...NETHER_WOODS].map((w) => `${w}_slab`),
  soul_fire_base: ['soul_sand', 'soul_soil'],
  logs: [],
  sand: ['sand', 'red_sand'],
  terracotta: ['terracotta'],
  glass: ['glass'],
  leaves: WOODS.map((w) => `${w}_leaves`),
  saplings: WOODS.map((w) => (w === 'mangrove' ? 'mangrove_propagule' : `${w}_sapling`)),
};
for (const w of WOODS) { const l = [`${w}_log`, `${w}_wood`, `stripped_${w}_log`, `stripped_${w}_wood`]; TAGS[`logs_${w}`] = l; TAGS.logs.push(...l); }
for (const w of NETHER_WOODS) { const l = [`${w}_stem`, `${w}_hyphae`, `stripped_${w}_stem`, `stripped_${w}_hyphae`]; TAGS[`logs_${w}`] = l; TAGS.logs.push(...l); }

function valid(n) { return n.startsWith('#') ? !!TAGS[n.slice(1)] : !!ITEM[n]; }
export function shaped(pattern, key, result, count = 1) {
  for (const v of Object.values(key)) { const alts = Array.isArray(v) ? v : [v]; if (!alts.every(valid)) { console.warn('bad recipe key', v, result); return; } }
  if (!ITEM[result]) { console.warn('bad result', result); return; }
  RECIPES.push({ type: 'shaped', pattern, key, result, count, w: Math.max(...pattern.map((r) => r.length)), h: pattern.length });
}
export function shapeless(ingredients, result, count = 1) {
  if (!ingredients.every((i) => (Array.isArray(i) ? i.every(valid) : valid(i)))) { console.warn('bad shapeless', ingredients, result); return; }
  if (!ITEM[result]) { console.warn('bad result', result); return; }
  RECIPES.push({ type: 'shapeless', ingredients, result, count });
}
export function smelt(input, result, xp = 0.1, kinds = ['furnace']) {
  if (!ITEM[input] || !ITEM[result]) { console.warn('bad smelt', input, result); return; }
  SMELTING.set(input, { result, xp, kinds });
}

// ---------- wood ----------
for (const w of [...WOODS, ...NETHER_WOODS]) {
  const nether = NETHER_WOODS.includes(w);
  const P = `${w}_planks`;
  shapeless([`#logs_${w}`], P, 4);
  const log = nether ? `${w}_stem` : `${w}_log`, wood = nether ? `${w}_hyphae` : `${w}_wood`;
  shaped(['##', '##'], { '#': log }, wood, 3);
  shaped(['##', '##'], { '#': `stripped_${log}` }, `stripped_${wood}`, 3);
  shaped(['###'], { '#': P }, `${w}_slab`, 6);
  shaped(['#  ', '## ', '###'], { '#': P }, `${w}_stairs`, 4);
  shaped(['W#W', 'W#W'], { W: P, '#': 'stick' }, `${w}_fence`, 3);
  shaped(['#W#', '#W#'], { W: P, '#': 'stick' }, `${w}_fence_gate`, 1);
  shaped(['##', '##', '##'], { '#': P }, `${w}_door`, 3);
  shaped(['###', '###'], { '#': P }, `${w}_trapdoor`, 2);
  shaped(['##'], { '#': P }, `${w}_pressure_plate`, 1);
  shapeless([P], `${w}_button`, 1);
  shaped(['###', '###', ' S '], { '#': P, S: 'stick' }, `${w}_sign`, 3);
  if (!nether) shaped(['# #', '###'], { '#': P }, `${w}_boat`, 1);
}
shaped(['#', '#'], { '#': '#planks' }, 'stick', 4);
shaped(['##', '##'], { '#': '#planks' }, 'crafting_table');
shaped(['###', '# #', '###'], { '#': '#planks' }, 'chest');
shaped(['PSP', 'P P', 'PSP'], { P: '#planks', S: '#wooden_slabs' }, 'barrel');
shaped(['###', 'BBB', '###'], { '#': '#planks', B: 'book' }, 'bookshelf');
shaped(['###', 'SSS', '###'], { '#': '#planks', S: '#wooden_slabs' }, 'chiseled_bookshelf');
shaped(['S S', 'SSS', 'S S'], { S: 'stick' }, 'ladder', 3);
shaped(['# #', ' # '], { '#': '#planks' }, 'bowl', 4);
shaped(['S S', 'S S', 'SSS'], { S: '#wooden_slabs' }, 'composter');
shaped(['###', '#R#', '###'], { '#': '#planks', R: 'redstone' }, 'note_block');
shaped(['###', '#D#', '###'], { '#': '#planks', D: 'diamond' }, 'jukebox');
shaped(['SSS', ' B ', ' S '], { S: '#wooden_slabs', B: 'bookshelf' }, 'lectern');
shaped(['SS', '##', '##'], { S: 'string', '#': '#planks' }, 'loom');
shaped(['PP', '##', '##'], { P: 'paper', '#': '#planks' }, 'cartography_table');
shaped(['FF', '##', '##'], { F: 'flint', '#': '#planks' }, 'fletching_table');
shaped(['II', '##', '##'], { I: 'iron_ingot', '#': '#planks' }, 'smithing_table');
shaped(['###', 'HHH', '###'], { '#': '#planks', H: 'honeycomb' }, 'beehive');
shaped(['S', 'R', 'P'], { S: 'stick', R: 'slime_ball', P: '#planks' }, 'lead', 2);

// ---------- tools & armor ----------
const TOOL_MATS = { wooden: '#planks', stone: '#stone_tool', iron: 'iron_ingot', golden: 'gold_ingot', diamond: 'diamond' };
for (const [m, X] of Object.entries(TOOL_MATS)) {
  shaped(['XXX', ' # ', ' # '], { X, '#': 'stick' }, `${m}_pickaxe`);
  shaped(['XX', 'X#', ' #'], { X, '#': 'stick' }, `${m}_axe`);
  shaped(['X', '#', '#'], { X, '#': 'stick' }, `${m}_shovel`);
  shaped(['XX', ' #', ' #'], { X, '#': 'stick' }, `${m}_hoe`);
  shaped(['X', 'X', '#'], { X, '#': 'stick' }, `${m}_sword`);
}
for (const t of ['pickaxe', 'axe', 'shovel', 'hoe', 'sword', 'helmet', 'chestplate', 'leggings', 'boots']) shapeless([`diamond_${t}`, 'netherite_ingot'], `netherite_${t}`);
const ARMOR_MATS = { leather: 'leather', iron: 'iron_ingot', golden: 'gold_ingot', diamond: 'diamond' };
for (const [m, X] of Object.entries(ARMOR_MATS)) {
  shaped(['XXX', 'X X'], { X }, `${m}_helmet`);
  shaped(['X X', 'XXX', 'XXX'], { X }, `${m}_chestplate`);
  shaped(['XXX', 'X X', 'X X'], { X }, `${m}_leggings`);
  shaped(['X X', 'X X'], { X }, `${m}_boots`);
}
shaped(['XXX', 'X X'], { X: 'turtle_scute' }, 'turtle_helmet');
shaped([' S', 'S '], { S: 'iron_ingot' }, 'shears');
shapeless(['iron_ingot', 'flint'], 'flint_and_steel');
shaped(['I I', ' I '], { I: 'iron_ingot' }, 'bucket');
shaped([' I ', 'IRI', ' I '], { I: 'iron_ingot', R: 'redstone' }, 'compass');
shaped([' G ', 'GRG', ' G '], { G: 'gold_ingot', R: 'redstone' }, 'clock');
shaped(['  #', ' #S', '# S'], { '#': 'stick', S: 'string' }, 'fishing_rod');
shaped(['# ', ' C'], { '#': 'fishing_rod', C: 'carrot' }, 'carrot_on_a_stick');
shaped([' #S', '# S', ' #S'], { '#': 'stick', S: 'string' }, 'bow');
shaped(['#I#', 'STS', ' # '], { '#': 'stick', I: 'iron_ingot', S: 'string', T: 'tripwire_hook' }, 'crossbow');
shaped(['F', '#', 'E'], { F: 'flint', '#': 'stick', E: 'feather' }, 'arrow', 4);
shaped([' G ', 'GAG', ' G '], { G: 'glowstone_dust', A: 'arrow' }, 'spectral_arrow', 2);
shaped(['WIW', 'WWW', ' W '], { W: '#planks', I: 'iron_ingot' }, 'shield');
shaped(['C', 'A', 'S'], { C: 'copper_ingot', A: 'amethyst_shard', S: 'stick' }, 'spyglass');
shaped(['PPP', 'PCP', 'PPP'], { P: 'paper', C: 'compass' }, 'map');
shaped(['F', 'C', 'S'], { F: 'feather', C: 'copper_ingot', S: 'stick' }, 'brush');
shapeless(['book', 'ink_sac', 'feather'], 'writable_book');
shaped(['I I', 'III'], { I: 'iron_ingot' }, 'minecart');
shapeless(['chest', 'minecart'], 'chest_minecart');
shaped(['PGP', 'GPG', 'PGP'], { P: 'paper', G: 'gunpowder' }, 'firework_rocket', 3);

// ---------- stone ----------
shaped(['##', '##'], { '#': 'stone' }, 'stone_bricks', 4);
shapeless(['stone_bricks', 'vine'], 'mossy_stone_bricks');
shapeless(['stone_bricks', 'moss_block'], 'mossy_stone_bricks');
shapeless(['cobblestone', 'vine'], 'mossy_cobblestone');
shapeless(['cobblestone', 'moss_block'], 'mossy_cobblestone');
shaped(['#', '#'], { '#': 'stone_brick_slab' }, 'chiseled_stone_bricks');
shapeless(['diorite', 'quartz'], 'granite');
shaped(['CQ', 'QC'], { C: 'cobblestone', Q: 'quartz' }, 'diorite', 2);
shapeless(['diorite', 'cobblestone'], 'andesite', 2);
shaped(['##', '##'], { '#': 'granite' }, 'polished_granite', 4);
shaped(['##', '##'], { '#': 'diorite' }, 'polished_diorite', 4);
shaped(['##', '##'], { '#': 'andesite' }, 'polished_andesite', 4);
shaped(['##', '##'], { '#': 'cobbled_deepslate' }, 'polished_deepslate', 4);
shaped(['##', '##'], { '#': 'polished_deepslate' }, 'deepslate_bricks', 4);
shaped(['##', '##'], { '#': 'deepslate_bricks' }, 'deepslate_tiles', 4);
shaped(['#', '#'], { '#': 'cobbled_deepslate_slab' }, 'chiseled_deepslate');
shaped(['##', '##'], { '#': 'sand' }, 'sandstone');
shaped(['##', '##'], { '#': 'sandstone' }, 'cut_sandstone', 4);
shaped(['#', '#'], { '#': 'sandstone_slab' }, 'chiseled_sandstone');
shaped(['##', '##'], { '#': 'red_sand' }, 'red_sandstone');
shaped(['##', '##'], { '#': 'red_sandstone' }, 'cut_red_sandstone', 4);
shaped(['#', '#'], { '#': 'red_sandstone_slab' }, 'chiseled_red_sandstone');
shaped(['##', '##'], { '#': 'brick' }, 'bricks');
shaped(['##', '##'], { '#': 'nether_brick' }, 'nether_bricks');
shaped(['NW', 'WN'], { N: 'nether_brick', W: 'nether_wart' }, 'red_nether_bricks');
shaped(['#', '#'], { '#': 'nether_brick_slab' }, 'chiseled_nether_bricks');
shapeless(['mud', 'wheat'], 'packed_mud');
shaped(['##', '##'], { '#': 'packed_mud' }, 'mud_bricks', 4);
shaped(['##', '##'], { '#': 'quartz' }, 'quartz_block');
shaped(['#', '#'], { '#': 'quartz_block' }, 'quartz_pillar', 2);
shaped(['#', '#'], { '#': 'quartz_slab' }, 'chiseled_quartz_block');
shaped(['##', '##'], { '#': 'quartz_block' }, 'quartz_bricks', 4);
shaped(['##', '##'], { '#': 'prismarine_shard' }, 'prismarine');
shaped(['###', '###', '###'], { '#': 'prismarine_shard' }, 'prismarine_bricks');
shaped(['###', '#D#', '###'], { '#': 'prismarine_shard', D: 'black_dye' }, 'dark_prismarine');
shaped(['SCS', 'CCC', 'SCS'], { S: 'prismarine_shard', C: 'prismarine_crystals' }, 'sea_lantern');
shaped(['##', '##'], { '#': 'popped_chorus_fruit' }, 'purpur_block', 4);
shaped(['#', '#'], { '#': 'purpur_slab' }, 'purpur_pillar');
shaped(['##', '##'], { '#': 'end_stone' }, 'end_stone_bricks', 4);
shaped(['##', '##'], { '#': 'blackstone' }, 'polished_blackstone', 4);
shaped(['##', '##'], { '#': 'polished_blackstone' }, 'polished_blackstone_bricks', 4);
shaped(['#', '#'], { '#': 'polished_blackstone_slab' }, 'chiseled_polished_blackstone');
shaped(['##', '##'], { '#': 'basalt' }, 'polished_basalt', 4);
shaped(['##', '##'], { '#': 'copper_block' }, 'cut_copper', 4);
shaped(['##', '##'], { '#': 'amethyst_shard' }, 'amethyst_block');
shaped(['###', '# #', '###'], { '#': '#stone_crafting' }, 'furnace');
shaped(['III', 'IFI', 'SSS'], { I: 'iron_ingot', F: 'furnace', S: 'smooth_stone' }, 'blast_furnace');
shaped([' L ', 'LFL', ' L '], { L: '#logs', F: 'furnace' }, 'smoker');
shaped([' I ', '###'], { I: 'iron_ingot', '#': 'stone' }, 'stonecutter');
shaped(['S-S', 'P P'], { S: 'stick', '-': 'stone_slab', P: '#planks' }, 'grindstone');
shaped(['B B', 'B B', 'BBB'], { B: 'iron_ingot' }, 'cauldron');
shaped(['III', ' i ', 'iii'], { I: 'iron_block', i: 'iron_ingot' }, 'anvil');
shaped([' B ', 'DOD', 'OOO'], { B: 'book', D: 'diamond', O: 'obsidian' }, 'enchanting_table');
shaped([' R ', 'CCC'], { R: 'blaze_rod', C: '#stone_crafting' }, 'brewing_stand');
shaped(['OOO', 'OEO', 'OOO'], { O: 'obsidian', E: 'ender_eye' }, 'ender_chest');
shaped(['GGG', 'GSG', 'OOO'], { G: 'glass', S: 'nether_star', O: 'obsidian' }, 'beacon');
shaped(['CCC', 'GGG', 'CCC'], { C: 'crying_obsidian', G: 'glowstone' }, 'respawn_anchor');
shaped(['SSS', 'SNS', 'SSS'], { S: 'chiseled_stone_bricks', N: 'netherite_ingot' }, 'lodestone');
shaped(['B B', ' B '], { B: 'brick' }, 'flower_pot');
shaped(['R', 'P'], { R: 'blaze_rod', P: 'popped_chorus_fruit' }, 'end_rod', 4);
shaped(['I I', 'III', 'I I'], { I: 'iron_ingot' }, 'iron_bars', 16);
shaped(['N', 'I', 'N'], { N: 'iron_nugget', I: 'iron_ingot' }, 'chain');
shaped(['NNN', 'NTN', 'NNN'], { N: 'iron_nugget', T: 'torch' }, 'lantern');
shaped(['NNN', 'NTN', 'NNN'], { N: 'iron_nugget', T: 'soul_torch' }, 'soul_lantern');
shaped(['C', 'S'], { C: '#coals', S: 'stick' }, 'torch', 4);
shaped(['C', 'S', 'B'], { C: '#coals', S: 'stick', B: '#soul_fire_base' }, 'soul_torch', 4);
shaped([' S ', 'SCS', 'LLL'], { S: 'stick', C: '#coals', L: '#logs' }, 'campfire');

// ---------- stairs / slabs / walls for stone families ----------
const FAM = [
  ['stone', 'stone'], ['cobblestone', 'cobblestone'], ['mossy_cobblestone', 'mossy_cobblestone'], ['smooth_stone', 'smooth_stone'],
  ['stone_brick', 'stone_bricks'], ['mossy_stone_brick', 'mossy_stone_bricks'], ['granite', 'granite'], ['polished_granite', 'polished_granite'],
  ['diorite', 'diorite'], ['polished_diorite', 'polished_diorite'], ['andesite', 'andesite'], ['polished_andesite', 'polished_andesite'],
  ['cobbled_deepslate', 'cobbled_deepslate'], ['polished_deepslate', 'polished_deepslate'], ['deepslate_brick', 'deepslate_bricks'], ['deepslate_tile', 'deepslate_tiles'],
  ['brick', 'bricks'], ['mud_brick', 'mud_bricks'], ['sandstone', 'sandstone'], ['smooth_sandstone', 'smooth_sandstone'], ['cut_sandstone', 'cut_sandstone'],
  ['red_sandstone', 'red_sandstone'], ['smooth_red_sandstone', 'smooth_red_sandstone'], ['cut_red_sandstone', 'cut_red_sandstone'],
  ['nether_brick', 'nether_bricks'], ['red_nether_brick', 'red_nether_bricks'], ['quartz', 'quartz_block'], ['smooth_quartz', 'smooth_quartz'],
  ['prismarine', 'prismarine'], ['prismarine_brick', 'prismarine_bricks'], ['dark_prismarine', 'dark_prismarine'], ['purpur', 'purpur_block'],
  ['end_stone_brick', 'end_stone_bricks'], ['blackstone', 'blackstone'], ['polished_blackstone', 'polished_blackstone'],
  ['polished_blackstone_brick', 'polished_blackstone_bricks'], ['cut_copper', 'cut_copper'],
];
for (const [n, base] of FAM) {
  if (ITEM[`${n}_stairs`]) shaped(['#  ', '## ', '###'], { '#': base }, `${n}_stairs`, 4);
  if (ITEM[`${n}_slab`]) shaped(['###'], { '#': base }, `${n}_slab`, 6);
  if (ITEM[`${n}_wall`]) shaped(['###', '###'], { '#': base }, `${n}_wall`, 6);
}

// ---------- storage blocks ----------
const STORE = [
  ['coal', 'coal_block'], ['iron_ingot', 'iron_block'], ['gold_ingot', 'gold_block'], ['diamond', 'diamond_block'], ['emerald', 'emerald_block'],
  ['lapis_lazuli', 'lapis_block'], ['redstone', 'redstone_block'], ['netherite_ingot', 'netherite_block'], ['raw_iron', 'raw_iron_block'],
  ['raw_copper', 'raw_copper_block'], ['raw_gold', 'raw_gold_block'], ['copper_ingot', 'copper_block'], ['wheat', 'hay_block'],
  ['slime_ball', 'slime_block'], ['bone_meal', 'bone_block'], ['dried_kelp', 'dried_kelp_block'], ['ice', 'packed_ice'], ['packed_ice', 'blue_ice'],
];
for (const [i, b] of STORE) {
  shaped(['###', '###', '###'], { '#': i }, b);
  if (b !== 'packed_ice' && b !== 'blue_ice') shapeless([b], i, 9);
}
shaped(['###', '###', '###'], { '#': 'iron_nugget' }, 'iron_ingot');
shapeless(['iron_ingot'], 'iron_nugget', 9);
shaped(['###', '###', '###'], { '#': 'gold_nugget' }, 'gold_ingot');
shapeless(['gold_ingot'], 'gold_nugget', 9);
shaped(['###', '###', '###'], { '#': 'melon_slice' }, 'melon');
shaped(['##', '##'], { '#': 'snowball' }, 'snow_block');
shaped(['###'], { '#': 'snow_block' }, 'snow', 6);
shaped(['##', '##'], { '#': 'clay_ball' }, 'clay');
shaped(['##', '##'], { '#': 'glowstone_dust' }, 'glowstone');
shaped(['##', '##'], { '#': 'string' }, 'white_wool');
shaped(['##', '##'], { '#': 'honey_bottle' }, 'honey_block');
shapeless(['honey_block', 'glass_bottle', 'glass_bottle', 'glass_bottle', 'glass_bottle'], 'honey_bottle', 4);
shaped(['##', '##'], { '#': 'honeycomb' }, 'beehive');
shapeless(['bone'], 'bone_meal', 3);
shapeless(['netherite_scrap', 'netherite_scrap', 'netherite_scrap', 'netherite_scrap', 'gold_ingot', 'gold_ingot', 'gold_ingot', 'gold_ingot'], 'netherite_ingot');
shaped(['##', '##'], { '#': 'moss_block' }, 'moss_carpet', 3);
shaped(['GSG', 'SGS', 'GSG'], { G: 'gunpowder', S: '#sand' }, 'tnt');

// ---------- redstone ----------
shaped(['R', 'S'], { R: 'redstone', S: 'stick' }, 'redstone_torch');
shaped(['S', 'C'], { S: 'stick', C: 'cobblestone' }, 'lever');
shaped(['TRT', 'SSS'], { T: 'redstone_torch', R: 'redstone', S: 'stone' }, 'repeater');
shaped([' T ', 'TQT', 'SSS'], { T: 'redstone_torch', Q: 'quartz', S: 'stone' }, 'comparator');
shaped(['WWW', 'CIC', 'CRC'], { W: '#planks', C: 'cobblestone', I: 'iron_ingot', R: 'redstone' }, 'piston');
shaped(['S', 'P'], { S: 'slime_ball', P: 'piston' }, 'sticky_piston');
shaped(['CCC', 'RRQ', 'CCC'], { C: 'cobblestone', R: 'redstone', Q: 'quartz' }, 'observer');
shaped(['CCC', 'CBC', 'CRC'], { C: 'cobblestone', B: 'bow', R: 'redstone' }, 'dispenser');
shaped(['CCC', 'C C', 'CRC'], { C: 'cobblestone', R: 'redstone' }, 'dropper');
shaped(['I I', 'ICI', ' I '], { I: 'iron_ingot', C: 'chest' }, 'hopper');
shaped([' R ', 'RGR', ' R '], { R: 'redstone', G: 'glowstone' }, 'redstone_lamp');
shaped(['GGG', 'QQQ', 'SSS'], { G: 'glass', Q: 'quartz', S: '#wooden_slabs' }, 'daylight_detector');
shaped([' R ', 'RHR', ' R '], { R: 'redstone', H: 'hay_block' }, 'target');
shaped(['I I', 'ISI', 'I I'], { I: 'iron_ingot', S: 'stick' }, 'rail', 16);
shaped(['G G', 'GSG', 'GRG'], { G: 'gold_ingot', S: 'stick', R: 'redstone' }, 'powered_rail', 6);
shaped(['I I', 'IPI', 'IRI'], { I: 'iron_ingot', P: 'stone_pressure_plate', R: 'redstone' }, 'detector_rail', 6);
shaped(['ISI', 'IRI', 'ISI'], { I: 'iron_ingot', S: 'stick', R: 'redstone_torch' }, 'activator_rail', 6);
shaped(['I', 'S', 'P'], { I: 'iron_ingot', S: 'stick', P: '#planks' }, 'tripwire_hook', 2);
shaped(['C', 'C', 'C'], { C: 'copper_ingot' }, 'lightning_rod');
shapeless(['stone'], 'stone_button');
shaped(['##'], { '#': 'stone' }, 'stone_pressure_plate');
shapeless(['polished_blackstone'], 'polished_blackstone_button');
shaped(['##'], { '#': 'polished_blackstone' }, 'polished_blackstone_pressure_plate');
shaped(['##'], { '#': 'gold_ingot' }, 'light_weighted_pressure_plate');
shaped(['##'], { '#': 'iron_ingot' }, 'heavy_weighted_pressure_plate');
shapeless(['chest', 'tripwire_hook'], 'trapped_chest');
shaped(['##', '##', '##'], { '#': 'iron_ingot' }, 'iron_door', 3);
shaped(['##', '##'], { '#': 'iron_ingot' }, 'iron_trapdoor');

// ---------- coloured ----------
const FLOWER_DYES = {
  dandelion: ['yellow', 1], poppy: ['red', 1], blue_orchid: ['light_blue', 1], allium: ['magenta', 1], azure_bluet: ['light_gray', 1],
  red_tulip: ['red', 1], orange_tulip: ['orange', 1], white_tulip: ['light_gray', 1], pink_tulip: ['pink', 1], oxeye_daisy: ['light_gray', 1],
  cornflower: ['blue', 1], lily_of_the_valley: ['white', 1], sunflower: ['yellow', 2], lilac: ['magenta', 2], rose_bush: ['red', 2], peony: ['pink', 2],
  wither_rose: ['black', 1], torchflower: ['orange', 1], bone_meal: ['white', 1], ink_sac: ['black', 1], cocoa_beans: ['brown', 1], lapis_lazuli: ['blue', 1],
  beetroot: ['red', 1],
};
for (const [src, [c, n]] of Object.entries(FLOWER_DYES)) shapeless([src], `${c}_dye`, n);
shapeless(['red_dye', 'yellow_dye'], 'orange_dye', 2);
shapeless(['blue_dye', 'white_dye'], 'light_blue_dye', 2);
shapeless(['red_dye', 'white_dye'], 'pink_dye', 2);
shapeless(['green_dye', 'white_dye'], 'lime_dye', 2);
shapeless(['black_dye', 'white_dye'], 'gray_dye', 2);
shapeless(['gray_dye', 'white_dye'], 'light_gray_dye', 2);
shapeless(['black_dye', 'white_dye', 'white_dye'], 'light_gray_dye', 3);
shapeless(['blue_dye', 'green_dye'], 'cyan_dye', 2);
shapeless(['red_dye', 'blue_dye'], 'purple_dye', 2);
shapeless(['purple_dye', 'pink_dye'], 'magenta_dye', 2);
shapeless(['blue_dye', 'red_dye', 'pink_dye'], 'magenta_dye', 3);
for (const c of COLORS) {
  const dye = `${c}_dye`;
  if (c !== 'white') shapeless([dye, ['#wool']], `${c}_wool`);
  shaped(['##'], { '#': `${c}_wool` }, `${c}_carpet`, 3);
  shaped(['WWW', 'PPP'], { W: `${c}_wool`, P: '#planks' }, `${c}_bed`);
  shaped(['###', '#D#', '###'], { '#': 'terracotta', D: dye }, `${c}_terracotta`, 8);
  shaped(['###', '#D#', '###'], { '#': 'glass', D: dye }, `${c}_stained_glass`, 8);
  shaped(['###', '###'], { '#': `${c}_stained_glass` }, `${c}_stained_glass_pane`, 16);
  shaped(['###', '#D#', '###'], { '#': 'glass_pane', D: dye }, `${c}_stained_glass_pane`, 8);
  shapeless([dye, 'sand', 'sand', 'sand', 'sand', 'gravel', 'gravel', 'gravel', 'gravel'], `${c}_concrete_powder`, 8);
  if (c !== 'white') shapeless(['white_candle', dye], `${c}_candle`);
  smelt(`${c}_terracotta`, `${c}_glazed_terracotta`, 0.1);
}
shaped(['###', '###'], { '#': 'glass' }, 'glass_pane', 16);
shaped(['# #', ' # '], { '#': 'glass' }, 'glass_bottle', 3);
shaped([' A ', 'AGA', ' A '], { A: 'amethyst_shard', G: 'glass' }, 'tinted_glass', 2);
shaped(['S', 'H'], { S: 'string', H: 'honeycomb' }, 'white_candle');

// ---------- food & ingredients ----------
shaped(['###'], { '#': 'wheat' }, 'bread');
shaped(['WCW'], { W: 'wheat', C: 'cocoa_beans' }, 'cookie', 8);
shaped(['MMM', 'SES', 'WWW'], { M: 'milk_bucket', S: 'sugar', E: 'egg', W: 'wheat' }, 'cake');
shapeless(['pumpkin', 'sugar', 'egg'], 'pumpkin_pie');
shaped(['###', '#A#', '###'], { '#': 'gold_ingot', A: 'apple' }, 'golden_apple');
shaped(['###', '#C#', '###'], { '#': 'gold_nugget', C: 'carrot' }, 'golden_carrot');
shaped(['###', '#M#', '###'], { '#': 'gold_nugget', M: 'melon_slice' }, 'glistering_melon_slice');
shapeless(['brown_mushroom', 'red_mushroom', 'bowl'], 'mushroom_stew');
shapeless(['beetroot', 'beetroot', 'beetroot', 'beetroot', 'beetroot', 'beetroot', 'bowl'], 'beetroot_soup');
shapeless(['cooked_rabbit', 'carrot', 'baked_potato', 'brown_mushroom', 'bowl'], 'rabbit_stew');
shapeless(['brown_mushroom', 'red_mushroom', 'bowl', 'dandelion'], 'suspicious_stew');
shapeless(['sugar_cane'], 'sugar');
shapeless(['honey_bottle'], 'sugar', 3);
shaped(['###'], { '#': 'sugar_cane' }, 'paper', 3);
shapeless(['paper', 'paper', 'paper', 'leather'], 'book');
shapeless(['spider_eye', 'brown_mushroom', 'sugar'], 'fermented_spider_eye');
shapeless(['blaze_powder', 'slime_ball'], 'magma_cream');
shapeless(['blaze_rod'], 'blaze_powder', 2);
shapeless(['ender_pearl', 'blaze_powder'], 'ender_eye');
shapeless(['melon_slice'], 'melon_seeds');
shapeless(['pumpkin'], 'pumpkin_seeds', 4);
shaped(['##', '##'], { '#': 'rabbit_hide' }, 'leather');
shapeless(['carved_pumpkin', 'torch'], 'jack_o_lantern');
shapeless(['gunpowder', 'blaze_powder', '#coals'], 'fire_charge', 3);

// ---------- smelting ----------
smelt('raw_iron', 'iron_ingot', 0.7, ['furnace', 'blast']); smelt('iron_ore', 'iron_ingot', 0.7, ['furnace', 'blast']); smelt('deepslate_iron_ore', 'iron_ingot', 0.7, ['furnace', 'blast']);
smelt('raw_gold', 'gold_ingot', 1, ['furnace', 'blast']); smelt('gold_ore', 'gold_ingot', 1, ['furnace', 'blast']); smelt('deepslate_gold_ore', 'gold_ingot', 1, ['furnace', 'blast']); smelt('nether_gold_ore', 'gold_ingot', 1, ['furnace', 'blast']);
smelt('raw_copper', 'copper_ingot', 0.7, ['furnace', 'blast']); smelt('copper_ore', 'copper_ingot', 0.7, ['furnace', 'blast']); smelt('deepslate_copper_ore', 'copper_ingot', 0.7, ['furnace', 'blast']);
smelt('coal_ore', 'coal', 0.1, ['furnace', 'blast']); smelt('deepslate_coal_ore', 'coal', 0.1, ['furnace', 'blast']);
smelt('diamond_ore', 'diamond', 1, ['furnace', 'blast']); smelt('deepslate_diamond_ore', 'diamond', 1, ['furnace', 'blast']);
smelt('emerald_ore', 'emerald', 1, ['furnace', 'blast']); smelt('deepslate_emerald_ore', 'emerald', 1, ['furnace', 'blast']);
smelt('lapis_ore', 'lapis_lazuli', 0.2, ['furnace', 'blast']); smelt('deepslate_lapis_ore', 'lapis_lazuli', 0.2, ['furnace', 'blast']);
smelt('redstone_ore', 'redstone', 0.7, ['furnace', 'blast']); smelt('deepslate_redstone_ore', 'redstone', 0.7, ['furnace', 'blast']);
smelt('nether_quartz_ore', 'quartz', 0.2, ['furnace', 'blast']); smelt('ancient_debris', 'netherite_scrap', 2, ['furnace', 'blast']);
for (const t of ['pickaxe', 'axe', 'shovel', 'hoe', 'sword', 'helmet', 'chestplate', 'leggings', 'boots']) {
  if (ITEM[`iron_${t}`]) smelt(`iron_${t}`, 'iron_nugget', 0.1, ['furnace', 'blast']);
  if (ITEM[`golden_${t}`]) smelt(`golden_${t}`, 'gold_nugget', 0.1, ['furnace', 'blast']);
}
smelt('sand', 'glass', 0.1); smelt('red_sand', 'glass', 0.1); smelt('cobblestone', 'stone', 0.1); smelt('stone', 'smooth_stone', 0.1);
smelt('sandstone', 'smooth_sandstone', 0.1); smelt('red_sandstone', 'smooth_red_sandstone', 0.1); smelt('quartz_block', 'smooth_quartz', 0.1);
smelt('clay_ball', 'brick', 0.3); smelt('netherrack', 'nether_brick', 0.1); smelt('clay', 'terracotta', 0.35);
smelt('stone_bricks', 'cracked_stone_bricks', 0.1); smelt('deepslate_bricks', 'cracked_deepslate_bricks', 0.1); smelt('deepslate_tiles', 'cracked_deepslate_tiles', 0.1);
smelt('cobbled_deepslate', 'deepslate', 0.1); smelt('basalt', 'smooth_basalt', 0.1); smelt('nether_bricks', 'cracked_nether_bricks', 0.1);
smelt('wet_sponge', 'sponge', 0.15); smelt('cactus', 'green_dye', 1); smelt('kelp', 'dried_kelp', 0.1, ['furnace', 'smoker']); smelt('chorus_fruit', 'popped_chorus_fruit', 0.1);
for (const l of TAGS.logs) if (ITEM[l]) smelt(l, 'charcoal', 0.15);
const FOODS = [['beef', 'cooked_beef'], ['porkchop', 'cooked_porkchop'], ['mutton', 'cooked_mutton'], ['chicken', 'cooked_chicken'], ['rabbit', 'cooked_rabbit'], ['cod', 'cooked_cod'], ['salmon', 'cooked_salmon'], ['potato', 'baked_potato']];
for (const [a, b] of FOODS) smelt(a, b, 0.35, ['furnace', 'smoker', 'campfire']);

export const FUEL_FALLBACK = { coal: 1600, charcoal: 1600, lava_bucket: 20000, blaze_rod: 2400, coal_block: 16000, stick: 100, dried_kelp_block: 4001 };

// ---------- matching ----------
function matches(spec, stack) {
  if (!stack) return false;
  const alts = Array.isArray(spec) ? spec : [spec];
  for (const a of alts) {
    if (a.startsWith('#')) { if (TAGS[a.slice(1)].includes(stack.item.name)) return true; }
    else if (a === stack.item.name) return true;
  }
  return false;
}

// grid: array of ItemStack|null, size w*h
export function findRecipe(grid, w, h) {
  // bounding box of non-empty
  let x0 = w, y0 = h, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = grid[y * w + x];
    if (s && !s.isEmpty()) { n++; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  if (!n) return null;
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  for (const r of RECIPES) {
    if (r.type === 'shaped') {
      if (r.w !== bw || r.h !== bh) continue;
      for (const mirror of [false, true]) {
        let ok = true;
        for (let y = 0; y < bh && ok; y++) for (let x = 0; x < bw && ok; x++) {
          const px = mirror ? bw - 1 - x : x;
          const ch = (r.pattern[y][px] || ' ');
          const s = grid[(y0 + y) * w + (x0 + x)];
          const empty = !s || s.isEmpty();
          if (ch === ' ') { if (!empty) ok = false; }
          else if (empty || !matches(r.key[ch], s)) ok = false;
        }
        if (ok) return r;
      }
    } else {
      if (r.ingredients.length !== n) continue;
      const used = new Array(r.ingredients.length).fill(false);
      let ok = true;
      for (let i = 0; i < w * h && ok; i++) {
        const s = grid[i];
        if (!s || s.isEmpty()) continue;
        let found = false;
        for (let k = 0; k < r.ingredients.length; k++) {
          if (!used[k] && matches(r.ingredients[k], s)) { used[k] = true; found = true; break; }
        }
        if (!found) ok = false;
      }
      if (ok) return r;
    }
  }
  return null;
}

export function fuelValue(item) {
  if (!item) return 0;
  if (item.fuel) return item.fuel;
  return FUEL_FALLBACK[item.name] || 0;
}

export function smeltingResult(item, kind = 'furnace') {
  const r = SMELTING.get(item.name);
  if (!r) return null;
  if (kind === 'blast' && !r.kinds.includes('blast')) return null;
  if (kind === 'smoker' && !r.kinds.includes('smoker')) return null;
  return r;
}
