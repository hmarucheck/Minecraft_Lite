// Biome definitions (colours taken from Minecraft's biome tints).
export const BIOMES = [];
export const BIOME = {};

function biome(name, p) {
  const b = {
    id: BIOMES.length, name, displayName: name,
    grass: 0x91bd59, foliage: 0x77ab2f, water: 0x3f76e4, fog: 0xc0d8ff, sky: 0x78a7ff,
    temp: 0.8, rain: true, snow: false,
    top: 'grass_block', filler: 'dirt', fillerDepth: 3, underwater: 'dirt',
    trees: 0, treeTypes: ['oak'], grassDensity: 0.1, flowers: [], flowerDensity: 0,
    ...p,
  };
  BIOMES.push(b);
  BIOME[name] = b;
  return b;
}

biome('plains', { trees: 0.05, grassDensity: 0.35, flowers: ['dandelion', 'poppy', 'azure_bluet', 'oxeye_daisy', 'cornflower', 'red_tulip', 'white_tulip', 'orange_tulip', 'pink_tulip'], flowerDensity: 0.02, tallGrass: 0.05 });
biome('sunflower_plains', { trees: 0.03, grassDensity: 0.35, flowers: ['sunflower', 'dandelion', 'poppy'], flowerDensity: 0.04 });
biome('forest', { grass: 0x79c05a, foliage: 0x59ae30, trees: 8, treeTypes: ['oak', 'oak', 'oak', 'birch', 'fancy_oak'], grassDensity: 0.2, flowers: ['dandelion', 'poppy', 'lilac', 'rose_bush', 'peony'], flowerDensity: 0.01, temp: 0.7 });
biome('flower_forest', { grass: 0x79c05a, foliage: 0x59ae30, trees: 4, treeTypes: ['oak', 'birch'], grassDensity: 0.15, flowers: ['allium', 'azure_bluet', 'cornflower', 'lily_of_the_valley', 'oxeye_daisy', 'red_tulip', 'orange_tulip', 'pink_tulip', 'white_tulip', 'dandelion', 'poppy', 'lilac', 'rose_bush', 'peony'], flowerDensity: 0.2, temp: 0.7 });
biome('birch_forest', { grass: 0x88bb67, foliage: 0x6ba941, trees: 8, treeTypes: ['birch'], grassDensity: 0.2, flowers: ['dandelion', 'poppy', 'lilac', 'peony'], flowerDensity: 0.01, temp: 0.6 });
biome('dark_forest', { grass: 0x507a32, foliage: 0x59ae30, trees: 14, treeTypes: ['dark_oak', 'dark_oak', 'dark_oak', 'oak', 'huge_mushroom'], grassDensity: 0.12, temp: 0.7 });
biome('taiga', { grass: 0x86b783, foliage: 0x68a464, trees: 8, treeTypes: ['spruce', 'pine', 'spruce'], grassDensity: 0.2, ferns: true, temp: 0.25, flowers: [], berries: true });
biome('snowy_taiga', { grass: 0x80b497, foliage: 0x60a17b, trees: 6, treeTypes: ['spruce', 'pine'], grassDensity: 0.08, ferns: true, temp: -0.5, snow: true, water: 0x3d57d6 });
biome('snowy_plains', { grass: 0x80b497, foliage: 0x60a17b, trees: 0.1, treeTypes: ['spruce'], grassDensity: 0.03, temp: 0, snow: true, water: 0x3d57d6 });
biome('ice_spikes', { grass: 0x80b497, foliage: 0x60a17b, trees: 0, top: 'snow_block', filler: 'dirt', temp: 0, snow: true, spikes: true, water: 0x3d57d6 });
biome('savanna', { grass: 0xbfb755, foliage: 0xaea42a, trees: 0.8, treeTypes: ['acacia', 'acacia', 'oak'], grassDensity: 0.5, tallGrass: 0.1, temp: 2, rain: false });
biome('desert', { grass: 0xbfb755, foliage: 0xaea42a, top: 'sand', filler: 'sand', fillerDepth: 4, underwater: 'sand', trees: 0, temp: 2, rain: false, cactus: true, deadBush: true, sandstone: true, water: 0x32a598 });
biome('badlands', { grass: 0x90814d, foliage: 0x9e814d, top: 'red_sand', filler: 'terracotta', fillerDepth: 1, trees: 0, temp: 2, rain: false, deadBush: true, badlands: true });
biome('jungle', { grass: 0x59c93c, foliage: 0x30bb0b, trees: 20, treeTypes: ['jungle', 'jungle_bush', 'jungle_bush', 'jungle_big', 'oak'], grassDensity: 0.5, ferns: true, temp: 0.95, melons: true, vines: true });
biome('swamp', { grass: 0x6a7039, foliage: 0x6a7039, water: 0x617b64, trees: 2, treeTypes: ['swamp_oak'], grassDensity: 0.2, flowers: ['blue_orchid'], flowerDensity: 0.03, temp: 0.8, lilyPads: true, vines: true, mushrooms: true, clay: true });
biome('cherry_grove', { grass: 0xb6db61, foliage: 0xb6db61, trees: 3, treeTypes: ['cherry'], grassDensity: 0.4, flowers: ['pink_tulip', 'allium'], flowerDensity: 0.03, temp: 0.5 });
biome('meadow', { grass: 0x83bbbb, foliage: 0x63a948, trees: 0.08, treeTypes: ['oak', 'birch'], grassDensity: 0.6, flowers: ['dandelion', 'poppy', 'allium', 'azure_bluet', 'oxeye_daisy', 'cornflower'], flowerDensity: 0.08, temp: 0.5 });
biome('windswept_hills', { grass: 0x8ab689, foliage: 0x6da36b, trees: 0.5, treeTypes: ['spruce', 'oak'], grassDensity: 0.1, temp: 0.2, stony: true, emeralds: true });
biome('jagged_peaks', { grass: 0x80b497, foliage: 0x60a17b, top: 'snow_block', filler: 'stone', trees: 0, temp: -0.7, snow: true, stony: true, emeralds: true });
biome('stony_peaks', { grass: 0x9abe4b, foliage: 0x82ac1e, top: 'stone', filler: 'stone', trees: 0, temp: 1, emeralds: true });
biome('beach', { top: 'sand', filler: 'sand', fillerDepth: 3, underwater: 'sand', trees: 0, temp: 0.8 });
biome('snowy_beach', { grass: 0x80b497, foliage: 0x60a17b, top: 'sand', filler: 'sand', underwater: 'sand', temp: 0.05, snow: true, water: 0x3d57d6 });
biome('river', { top: 'grass_block', underwater: 'sand', trees: 0, temp: 0.5, sugarCane: true });
biome('frozen_river', { grass: 0x80b497, foliage: 0x60a17b, underwater: 'sand', temp: 0, snow: true, frozen: true, water: 0x3938c9 });
biome('ocean', { grass: 0x8eb971, foliage: 0x71a74d, top: 'sand', underwater: 'gravel', filler: 'gravel', temp: 0.5, ocean: true, seagrass: true });
biome('deep_ocean', { grass: 0x8eb971, foliage: 0x71a74d, underwater: 'gravel', filler: 'gravel', temp: 0.5, ocean: true, seagrass: true });
biome('warm_ocean', { grass: 0x8eb971, foliage: 0x71a74d, water: 0x43d5ee, underwater: 'sand', filler: 'sand', temp: 0.5, ocean: true, seagrass: true });
biome('cold_ocean', { grass: 0x8eb971, foliage: 0x71a74d, water: 0x3d57d6, underwater: 'gravel', filler: 'gravel', temp: 0.5, ocean: true });
biome('frozen_ocean', { grass: 0x80b497, foliage: 0x60a17b, water: 0x3938c9, underwater: 'gravel', filler: 'gravel', temp: 0, snow: true, ocean: true, frozen: true });
biome('mushroom_fields', { grass: 0x55c93f, foliage: 0x2bbb0f, top: 'mycelium', trees: 1, treeTypes: ['huge_mushroom'], temp: 0.9, mushrooms: true, noMobs: true });

export function biomeById(id) { return BIOMES[id] || BIOMES[0]; }
