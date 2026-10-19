// Terrain generator: continents, erosion, peaks, rivers, biomes, 3D overhangs, caves, ores, trees.
import { Octaves, Simplex } from './noise.js';
import { BLOCK, BLOCKS as BLOCKDEF } from '../registry/blocks.js';
import { BIOME, BIOMES } from './biomes.js';
import { MIN_Y, MAX_Y, SEA_LEVEL, Rng, hash3, hashFloat, clamp, lerp } from '../core/util.js';
import { placeTree } from './trees.js';

const id = (n) => BLOCK[n].id;
const B = {};
for (const n of ['air', 'stone', 'deepslate', 'bedrock', 'water', 'lava', 'grass_block', 'dirt', 'sand', 'red_sand', 'gravel', 'sandstone', 'red_sandstone',
  'snow_block', 'snow', 'ice', 'packed_ice', 'clay', 'terracotta', 'coarse_dirt', 'podzol', 'mycelium', 'short_grass', 'tall_grass', 'fern', 'large_fern',
  'dead_bush', 'cactus', 'sugar_cane', 'pumpkin', 'melon', 'lily_pad', 'seagrass', 'kelp', 'brown_mushroom', 'red_mushroom', 'granite', 'diorite', 'andesite',
  'tuff', 'calcite', 'coal_ore', 'iron_ore', 'copper_ore', 'gold_ore', 'redstone_ore', 'lapis_ore', 'diamond_ore', 'emerald_ore', 'deepslate_coal_ore',
  'deepslate_iron_ore', 'deepslate_copper_ore', 'deepslate_gold_ore', 'deepslate_redstone_ore', 'deepslate_lapis_ore', 'deepslate_diamond_ore',
  'deepslate_emerald_ore', 'sweet_berry_bush', 'obsidian', 'moss_block', 'chest', 'oak_log', 'oak_planks', 'torch', 'mossy_cobblestone', 'cobblestone', 'spawner',
  'white_terracotta', 'orange_terracotta', 'yellow_terracotta', 'brown_terracotta', 'red_terracotta', 'light_gray_terracotta', 'oak_leaves']) B[n] = id(n);

const GX = 4, GY = 8, GC = 4;
const NGY = (MAX_Y - MIN_Y) / GY + 1;
const NCY = (MAX_Y - MIN_Y) / GC + 1;

const ORE_DEEP = {};
for (const o of ['coal', 'iron', 'copper', 'gold', 'redstone', 'lapis', 'diamond', 'emerald']) ORE_DEEP[B[`${o}_ore`]] = B[`deepslate_${o}_ore`];

export const WORLD_TYPES = ['default', 'flat', 'large_biomes', 'amplified', 'single_biome'];
export const FLAT_PRESETS = {
  classic_flat: { name: 'Classic Flat', layers: [['bedrock', 1], ['dirt', 2], ['grass_block', 1]], biome: 'plains' },
  tunnelers_dream: { name: "Tunnelers' Dream", layers: [['bedrock', 1], ['stone', 230], ['dirt', 5], ['grass_block', 1]], biome: 'windswept_hills' },
  water_world: { name: 'Water World', layers: [['bedrock', 1], ['deepslate', 64], ['stone', 5], ['dirt', 5], ['sand', 5], ['water', 90]], biome: 'deep_ocean' },
  overworld: { name: 'Overworld', layers: [['bedrock', 1], ['stone', 59], ['dirt', 3], ['grass_block', 1]], biome: 'plains', decorate: true },
  snowy_kingdom: { name: 'Snowy Kingdom', layers: [['bedrock', 1], ['stone', 59], ['dirt', 3], ['grass_block', 1], ['snow', 1]], biome: 'snowy_plains' },
  bottomless_pit: { name: 'Bottomless Pit', layers: [['cobblestone', 2], ['dirt', 3], ['grass_block', 1]], biome: 'plains' },
  desert: { name: 'Desert', layers: [['bedrock', 1], ['stone', 3], ['sandstone', 52], ['sand', 8]], biome: 'desert' },
  redstone_ready: { name: 'Redstone Ready', layers: [['bedrock', 1], ['stone', 3], ['sandstone', 116]], biome: 'desert' },
  the_void: { name: 'The Void', layers: [['air', 1]], biome: 'plains' },
};

export class Generator {
  constructor(seed, opts = {}) {
    this.seed = seed >>> 0;
    this.type = opts.type || 'default';
    this.flat = this.type === 'flat' ? (FLAT_PRESETS[opts.flatPreset] || FLAT_PRESETS.classic_flat) : null;
    this.dimension = 'overworld';
    this.structures = null; // StructureManager (structures pack)
    this.generateStructures = opts.generateStructures !== false;
    this.singleBiome = this.type === 'single_biome' ? BIOME[opts.biome || 'plains'] : null;
    this.scale = this.type === 'large_biomes' ? 4 : 1;
    this.amp = this.type === 'amplified' ? 2.2 : 1;
    const s = this.seed;
    this.contN = new Octaves(s + 11, 6, 0.5);
    this.erosN = new Octaves(s + 23, 4, 0.5);
    this.peakN = new Octaves(s + 37, 4, 0.5);
    this.tempN = new Octaves(s + 41, 3, 0.5);
    this.humN = new Octaves(s + 53, 3, 0.5);
    this.riverN = new Octaves(s + 67, 4, 0.5);
    this.hillN = new Octaves(s + 71, 3, 0.5);
    this.d3 = new Octaves(s + 83, 3, 0.5);
    this.cave1 = new Octaves(s + 97, 2, 0.5);
    this.cave2 = new Octaves(s + 101, 2, 0.5);
    this.cheese = new Octaves(s + 113, 2, 0.5);
    this.surfN = new Simplex(s + 127);
    this.variantN = new Simplex(s + 131);
    this.colCache = new Map();
    this.climCache = new Map();
    // badlands terracotta band pattern
    const r = new Rng(s ^ 0xbadb);
    const bandCols = [B.terracotta, B.terracotta, B.orange_terracotta, B.yellow_terracotta, B.brown_terracotta, B.red_terracotta, B.white_terracotta, B.light_gray_terracotta, B.terracotta];
    this.bands = new Uint16Array(64);
    for (let i = 0; i < 64; i++) this.bands[i] = bandCols[r.int(bandCols.length)];
  }

  // ---------------- climate & height ----------------
  climate(x, z) {
    const key = x * 73856093 ^ z * 19349663;
    const cached = this.climCache.get(key);
    if (cached && cached.x === x && cached.z === z) return cached;
    const sc = this.scale;
    const c = this.contN.get2(x / (1100 * sc), z / (1100 * sc)) * 1.8;
    const e = this.erosN.get2(x / (700 * sc) + 100, z / (700 * sc)) * 1.8;
    const pv = 1 - Math.abs(this.peakN.get2(x / (320 * sc), z / (320 * sc) + 50) * 2.2);
    const t = this.tempN.get2(x / (1500 * sc), z / (1500 * sc)) * 1.9;
    const h = this.humN.get2(x / (1300 * sc) - 70, z / (1300 * sc)) * 1.9;
    const rv = Math.abs(this.riverN.get2(x / (650 * sc), z / (650 * sc))) * 1.8;
    // base height spline over continentalness
    let H = spline(c);
    const inland = clamp((c + 0.05) / 0.3, 0, 1);
    let m = clamp((0.08 - e) / 0.45, 0, 1);
    m = m * m * (3 - 2 * m) * inland * inland;
    H += m * (12 + Math.pow(Math.max(0, pv), 1.6) * 118) * this.amp;
    H += this.hillN.get2(x / 140, z / 140) * 7 * (1 - m) * inland;
    let river = 0;
    if (c > -0.14) {
      river = 1 - clamp(rv / 0.05, 0, 1);
      river = river * river * (3 - 2 * river);
      river *= 1 - m * 0.75;
      if (river > 0) H = lerp(H, 58, river);
    }
    const A = (3 + m * 20 * this.amp) + (c < -0.19 ? -1 : 2);
    const out = { x, z, c, e, pv, t, h, m, river, H, A };
    if (this.climCache.size > 60000) this.climCache.clear();
    this.climCache.set(key, out);
    return out;
  }

  biomeAt(x, z) {
    if (this.singleBiome) return this.singleBiome;
    if (this.flat) return BIOME[this.flat.biome];
    const cl = this.climate(x, z);
    return pickBiome(cl, this.variantN.noise2(x / 300, z / 300));
  }

  // ---------------- density grid ----------------
  column(gx, gz) {
    const key = gx * 100003 + gz;
    let col = this.colCache.get(key);
    if (col && col.gx === gx && col.gz === gz) return col;
    const x = gx * GX, z = gz * GX;
    const cl = this.climate(x, z);
    const dens = new Float32Array(NGY);
    for (let i = 0; i < NGY; i++) {
      const y = MIN_Y + i * GY;
      const base = cl.H - y;
      if (base > cl.A * 1.25 || base < -cl.A * 1.25) dens[i] = base;
      else dens[i] = base + this.d3.get3(x / 70, y / 45, z / 70) * cl.A * 1.6;
    }
    // cave noise (only where needed: below the terrain)
    const top = Math.min(MAX_Y, cl.H + cl.A * 1.3 + 4);
    const n1 = new Float32Array(NCY), n2 = new Float32Array(NCY), n3 = new Float32Array(NCY);
    for (let i = 0; i < NCY; i++) {
      const y = MIN_Y + i * GC;
      if (y > top) { n1[i] = 1; n2[i] = 1; n3[i] = -1; continue; }
      n1[i] = this.cave1.get3(x / 55, y / 38, z / 55);
      n2[i] = this.cave2.get3(x / 55 + 300, y / 38, z / 55);
      n3[i] = this.cheese.get3(x / 90, y / 50, z / 90);
    }
    col = { gx, gz, dens, n1, n2, n3, H: cl.H };
    if (this.colCache.size > 12000) {
      // drop the oldest quarter
      let k = 0;
      for (const kk of this.colCache.keys()) { this.colCache.delete(kk); if (++k > 3000) break; }
    }
    this.colCache.set(key, col);
    return col;
  }

  densityAt(x, y, z) {
    const gx = Math.floor(x / GX), gz = Math.floor(z / GX);
    const fx = (x - gx * GX) / GX, fz = (z - gz * GX) / GX;
    const gy = Math.floor((y - MIN_Y) / GY), fy = (y - MIN_Y - gy * GY) / GY;
    const c00 = this.column(gx, gz), c10 = this.column(gx + 1, gz), c01 = this.column(gx, gz + 1), c11 = this.column(gx + 1, gz + 1);
    const g1 = Math.min(gy + 1, NGY - 1);
    const a = lerp(lerp(c00.dens[gy], c10.dens[gy], fx), lerp(c01.dens[gy], c11.dens[gy], fx), fz);
    const b = lerp(lerp(c00.dens[g1], c10.dens[g1], fx), lerp(c01.dens[g1], c11.dens[g1], fx), fz);
    return lerp(a, b, fy);
  }

  // highest solid block (ignoring caves) - pure function used for tree placement
  surfaceAt(x, z) {
    const cl = this.climate(x, z);
    let y = Math.min(MAX_Y - 1, Math.ceil(cl.H + cl.A * 1.3 + 2));
    for (; y > MIN_Y; y--) if (this.densityAt(x, y, z) > 0) return y;
    return MIN_Y;
  }

  // ---------------- chunk generation ----------------
  generate(chunk) {
    if (this.flat) { this.generateFlat(chunk); return; }
    const cx = chunk.cx, cz = chunk.cz;
    const x0 = cx * 16, z0 = cz * 16;
    const gx0 = cx * 4, gz0 = cz * 4;
    const cols = [];
    for (let i = 0; i <= 4; i++) for (let k = 0; k <= 4; k++) cols[i * 5 + k] = this.column(gx0 + i, gz0 + k);

    // biomes per column
    const biomes = new Array(256);
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const b = this.biomeAt(x0 + lx, z0 + lz);
      biomes[lz * 16 + lx] = b;
      chunk.biomes[lz * 16 + lx] = b.id;
    }
    this.blendColors(chunk);

    // fill density
    const heights = new Int16Array(256).fill(MIN_Y - 1);
    const solidAt = new Uint8Array(16 * 16 * (MAX_Y - MIN_Y));
    const yTop = Math.min(MAX_Y - 1, Math.ceil(Math.max(...cols.map((c) => c.H)) + 30 * this.amp + 10));
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const ix = lx >> 2, iz = lz >> 2;
      const fx = (lx & 3) / 4, fz = (lz & 3) / 4;
      const c00 = cols[ix * 5 + iz], c10 = cols[(ix + 1) * 5 + iz], c01 = cols[ix * 5 + iz + 1], c11 = cols[(ix + 1) * 5 + iz + 1];
      for (let y = yTop; y >= MIN_Y; y--) {
        const gy = Math.floor((y - MIN_Y) / GY), fy = (y - MIN_Y - gy * GY) / GY;
        const g1 = Math.min(gy + 1, NGY - 1);
        const a = lerp(lerp(c00.dens[gy], c10.dens[gy], fx), lerp(c01.dens[gy], c11.dens[gy], fx), fz);
        const b = lerp(lerp(c00.dens[g1], c10.dens[g1], fx), lerp(c01.dens[g1], c11.dens[g1], fx), fz);
        if (lerp(a, b, fy) > 0) {
          solidAt[((y - MIN_Y) << 8) | (lz << 4) | lx] = 1;
          if (heights[lz * 16 + lx] < MIN_Y) heights[lz * 16 + lx] = y;
        }
      }
    }

    // surface rules
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const bi = biomes[lz * 16 + lx];
      const h = heights[lz * 16 + lx];
      const x = x0 + lx, z = z0 + lz;
      const slope = Math.max(
        Math.abs(h - heights[lz * 16 + Math.min(15, lx + 1)]), Math.abs(h - heights[lz * 16 + Math.max(0, lx - 1)]),
        Math.abs(h - heights[Math.min(15, lz + 1) * 16 + lx]), Math.abs(h - heights[Math.max(0, lz - 1) * 16 + lx]));
      const sn = this.surfN.noise2(x / 12, z / 12);
      const snowLine = 165 + sn * 12;
      let depth = -1;
      const fillerDepth = bi.fillerDepth + (sn > 0.3 ? 1 : 0);
      for (let y = h; y >= MIN_Y; y--) {
        const solid = solidAt[((y - MIN_Y) << 8) | (lz << 4) | lx];
        if (!solid) {
          depth = -1;
          continue;
        }
        let blk = B.stone;
        if (y <= 7) blk = (y < 0 || hashFloat(x, y, z, this.seed) < (8 - y) / 9) ? B.deepslate : B.stone;
        if (depth === -1) {
          depth = 0;
          if (bi.badlands && y > SEA_LEVEL + 2) blk = y > 75 + sn * 5 ? this.bands[(y + Math.floor(sn * 3)) & 63] : (slope > 2 ? this.bands[y & 63] : B.red_sand);
          else if (y >= SEA_LEVEL - 1) {
            if (y > snowLine && h > 140) blk = B.snow_block;
            else if ((bi.stony || y > 120) && slope >= 3) blk = (sn > 0.4 ? B.gravel : B.stone);
            else if (bi.name === 'stony_peaks') blk = slope > 2 ? B.stone : B.calcite;
            else if (bi.top === 'grass_block' && bi.name.includes('taiga') && sn > 0.45) blk = B.podzol;
            else if (bi.top === 'grass_block' && bi.name === 'windswept_hills' && sn < -0.5) blk = B.gravel;
            else blk = B[bi.top];
          } else {
            blk = B[bi.underwater];
            if (bi.clay && sn > 0.5) blk = B.clay;
            else if (!bi.ocean && y < SEA_LEVEL - 1 && sn < -0.4) blk = B.gravel;
          }
        } else if (depth < fillerDepth) {
          depth++;
          if (bi.badlands && y > SEA_LEVEL) blk = this.bands[y & 63];
          else if (blk !== B.deepslate) {
            const top = chunk.getBlock(lx, y + depth, lz);
            blk = (top === B.sand || top === B.red_sand) ? (top === B.red_sand ? B.red_sand : B.sand) : (B[bi.filler] || B.dirt);
            if (bi.top === 'snow_block' && y < h - 1) blk = B.dirt;
            if (blk === B.grass_block) blk = B.dirt;
          }
        } else if (depth >= fillerDepth && depth < fillerDepth + 3 && (bi.sandstone || bi.top === 'sand' || bi.underwater === 'sand') && blk === B.stone) {
          depth++;
          const top = chunk.getBlock(lx, y + depth, lz);
          if (top === B.sand) blk = B.sandstone;
        } else if (bi.badlands && y > SEA_LEVEL - 5 && y < h) {
          blk = this.bands[y & 63];
        }
        if (y <= MIN_Y + 4) {
          if (y === MIN_Y || hash3(x, y, z, this.seed) % 5 < (MIN_Y + 5 - y)) blk = B.bedrock;
        }
        chunk.setRaw(lx, y, lz, blk);
      }
      // water above the surface up to sea level
      for (let y = Math.max(h + 1, MIN_Y); y < SEA_LEVEL; y++) {
        chunk.setRaw(lx, y, lz, (bi.frozen && y === SEA_LEVEL - 1) ? B.ice : B.water);
      }
      chunk.heightmap[lz * 16 + lx] = Math.max(h, SEA_LEVEL - 1);
    }

    this.carveCaves(chunk, cols, heights, biomes);
    this.placeOres(chunk, biomes);
    this.decorate(chunk, heights, biomes);
    // structures (villages, temples, ...) are placed by the StructureManager when the structures pack sets this.structures
    if (this.structures) this.structures.generateChunk(chunk, this);
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) chunk.updateHeightmap(lx, lz);
    chunk.generated = true;
  }

  generateFlat(chunk) {
    let y = MIN_Y;
    const layers = [];
    for (const [name, n] of this.flat.layers) for (let i = 0; i < n; i++) layers.push(B[name] ?? BLOCK[name].id);
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      for (let i = 0; i < layers.length; i++) if (layers[i]) chunk.setRaw(lx, y + i, lz, layers[i]);
      chunk.biomes[lz * 16 + lx] = BIOME[this.flat.biome].id;
    }
    this.blendColors(chunk);
    if (this.structures) this.structures.generateChunk(chunk, this);
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) chunk.updateHeightmap(lx, lz);
    chunk.generated = true;
  }

  flatSurface() {
    let n = 0; for (const [, c] of this.flat.layers) n += c;
    return MIN_Y + n - 1;
  }

  blendColors(chunk) {
    const x0 = chunk.cx * 16, z0 = chunk.cz * 16;
    const R = 2, W = 16 + R * 2;
    const g = new Array(W * W), f = new Array(W * W), w = new Array(W * W);
    for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) {
      const b = (x >= R && z >= R && x < 16 + R && z < 16 + R) ? BIOMES[chunk.biomes[(z - R) * 16 + (x - R)]] : this.biomeAt(x0 + x - R, z0 + z - R);
      g[z * W + x] = b.grass; f[z * W + x] = b.foliage; w[z * W + x] = b.water;
    }
    const avg = (arr, x, z) => {
      let r = 0, gg = 0, bb = 0, n = 0;
      for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
        const c = arr[(z + dz + R) * W + (x + dx + R)];
        r += (c >> 16) & 255; gg += (c >> 8) & 255; bb += c & 255; n++;
      }
      return ((Math.round(r / n) << 16) | (Math.round(gg / n) << 8) | Math.round(bb / n)) >>> 0;
    };
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      chunk.grassColor[z * 16 + x] = avg(g, x, z);
      chunk.foliageColor[z * 16 + x] = avg(f, x, z);
      chunk.waterColor[z * 16 + x] = avg(w, x, z);
    }
  }

  carveCaves(chunk, cols, heights, biomes) {
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const ix = lx >> 2, iz = lz >> 2;
      const fx = (lx & 3) / 4, fz = (lz & 3) / 4;
      const c00 = cols[ix * 5 + iz], c10 = cols[(ix + 1) * 5 + iz], c01 = cols[ix * 5 + iz + 1], c11 = cols[(ix + 1) * 5 + iz + 1];
      const h = heights[lz * 16 + lx];
      const wet = h < SEA_LEVEL || biomes[lz * 16 + lx].ocean || biomes[lz * 16 + lx].name.includes('river');
      const maxY = wet ? h - 8 : h + 1;
      for (let y = MIN_Y + 5; y <= maxY; y++) {
        const gy = Math.floor((y - MIN_Y) / GC), fy = ((y - MIN_Y) - gy * GC) / GC;
        const g1 = Math.min(gy + 1, NCY - 1);
        const tri = (arr) => {
          const a = lerp(lerp(c00[arr][gy], c10[arr][gy], fx), lerp(c01[arr][gy], c11[arr][gy], fx), fz);
          const b = lerp(lerp(c00[arr][g1], c10[arr][g1], fx), lerp(c01[arr][g1], c11[arr][g1], fx), fz);
          return lerp(a, b, fy);
        };
        const n1 = tri('n1'), n2 = tri('n2');
        let carve = n1 * n1 + n2 * n2 < 0.0045 + (y < 0 ? 0.002 : 0);
        if (!carve && y < 50) {
          const n3 = tri('n3');
          const th = 0.5 + Math.max(0, (y - 0) / 120);
          if (n3 > th) carve = true;
        }
        if (!carve) continue;
        const cur = chunk.getBlock(lx, y, lz);
        if (cur === 0 || cur === B.bedrock || cur === B.water) continue;
        // don't open the bottom of a body of water
        if (chunk.getBlock(lx, y + 1, lz) === B.water) continue;
        chunk.setRaw(lx, y, lz, y <= -55 ? B.lava : B.air);
      }
    }
  }

  placeOres(chunk, biomes) {
    const rng = new Rng(hash3(chunk.cx, 1, chunk.cz, this.seed ^ 0x0e5));
    const tri = (a, b) => Math.round((rng.next() + rng.next()) / 2 * (b - a) + a);
    const uni = (a, b) => Math.round(rng.next() * (b - a) + a);
    const vein = (block, count, size, yfn) => {
      for (let i = 0; i < count; i++) {
        const y = yfn();
        if (y < MIN_Y || y >= MAX_Y) continue;
        this.oreBlob(chunk, rng, block, rng.int(16), y, rng.int(16), size);
      }
    };
    vein(B.dirt, 7, 24, () => uni(0, 160));
    vein(B.gravel, 10, 24, () => uni(-64, 200));
    vein(B.granite, 3, 48, () => uni(0, 60));
    vein(B.diorite, 3, 48, () => uni(0, 60));
    vein(B.andesite, 3, 48, () => uni(0, 60));
    vein(B.tuff, 2, 48, () => uni(-64, 0));
    vein(B.coal_ore, 20, 14, () => tri(0, 192));
    vein(B.coal_ore, 10, 14, () => uni(136, 256));
    vein(B.iron_ore, 10, 8, () => tri(-24, 56));
    vein(B.iron_ore, 10, 4, () => uni(-64, 72));
    vein(B.iron_ore, 12, 8, () => tri(80, 320));
    vein(B.copper_ore, 14, 9, () => tri(-16, 112));
    vein(B.gold_ore, 4, 8, () => tri(-64, 32));
    vein(B.redstone_ore, 4, 7, () => uni(-64, 15));
    vein(B.redstone_ore, 6, 7, () => tri(-96, -32));
    vein(B.diamond_ore, 7, 4, () => tri(-144, 16));
    vein(B.diamond_ore, 1, 10, () => tri(-144, 16));
    vein(B.lapis_ore, 2, 6, () => tri(-32, 32));
    vein(B.lapis_ore, 3, 6, () => uni(-64, 64));
    const b = biomes[136];
    if (b.badlands) vein(B.gold_ore, 20, 8, () => uni(32, 256));
    if (b.emeralds) vein(B.emerald_ore, 8, 1, () => tri(-16, 320));
  }

  oreBlob(chunk, rng, block, cx, cy, cz, size) {
    const r = Math.max(0.6, Math.cbrt(size) * 0.62);
    const n = size;
    let px = cx + 0.5, py = cy + 0.5, pz = cz + 0.5;
    for (let i = 0; i < n; i++) {
      const x = Math.floor(px + (rng.next() - 0.5) * r * 2), y = Math.floor(py + (rng.next() - 0.5) * r * 2), z = Math.floor(pz + (rng.next() - 0.5) * r * 2);
      if (x >= 0 && x < 16 && z >= 0 && z < 16 && y > MIN_Y && y < MAX_Y) {
        const cur = chunk.getBlock(x, y, z);
        if (cur === B.stone || cur === B.granite || cur === B.diorite || cur === B.andesite || cur === B.tuff) {
          chunk.setRaw(x, y, z, block);
        } else if (cur === B.deepslate) {
          chunk.setRaw(x, y, z, ORE_DEEP[block] || (block === B.tuff || block === B.dirt || block === B.gravel || block === B.granite || block === B.diorite || block === B.andesite ? (block === B.tuff ? block : B.deepslate) : block));
        }
      }
      if (i % 3 === 2) { px += (rng.next() - 0.5) * 1.5; py += (rng.next() - 0.5) * 1.2; pz += (rng.next() - 0.5) * 1.5; }
    }
  }

  // Trees of a chunk, as a pure function of (seed, cx, cz)
  treesOf(cx, cz) {
    const out = [];
    const rng = new Rng(hash3(cx, 2, cz, this.seed ^ 0x7ee));
    for (let i = 0; i < 18; i++) {
      const lx = rng.int(16), lz = rng.int(16);
      const roll = rng.next(), roll2 = rng.next();
      const x = cx * 16 + lx, z = cz * 16 + lz;
      const bi = this.biomeAt(x, z);
      if (roll >= bi.trees / 18) continue;
      if (bi.top !== 'grass_block' && bi.top !== 'mycelium') continue;
      const cl = this.climate(x, z);
      if (cl.river > 0.3) continue;
      const y = this.surfaceAt(x, z);
      if (y < SEA_LEVEL || y > 175) continue;
      const type = bi.treeTypes[Math.floor(roll2 * bi.treeTypes.length)];
      out.push({ x, y: y + 1, z, type });
    }
    return out;
  }

  decorate(chunk, heights, biomes) {
    const x0 = chunk.cx * 16, z0 = chunk.cz * 16;
    const setter = (x, y, z, blk, meta = 0, mode = 0) => {
      const lx = x - x0, lz = z - z0;
      if (lx < 0 || lz < 0 || lx > 15 || lz > 15 || y <= MIN_Y || y >= MAX_Y) return;
      const cur = chunk.getBlock(lx, y, lz);
      if (mode === 1) { // leaves: only replace air/plants
        if (cur !== 0 && cur !== B.short_grass && cur !== B.tall_grass && cur !== B.fern && cur !== B.snow) return;
      } else if (mode === 2) { // logs: replace anything not solid stone
        if (cur === B.bedrock) return;
      } else if (mode === 3) { // ground: only replace grass/dirt
        if (cur !== B.grass_block && cur !== B.dirt && cur !== 0) return;
      }
      chunk.setRaw(lx, y, lz, blk, meta);
    };
    const getter = (x, y, z) => {
      const lx = x - x0, lz = z - z0;
      if (lx < 0 || lz < 0 || lx > 15 || lz > 15) return -1;
      return chunk.getBlock(lx, y, lz);
    };
    // trees from this chunk and its neighbours (canopies cross chunk borders)
    if (!this.noTrees) {
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        for (const t of this.treesOf(chunk.cx + dx, chunk.cz + dz)) {
          if (dx === 0 && dz === 0) {
            const g = getter(t.x, t.y - 1, t.z);
            if (g !== B.grass_block && g !== B.dirt && g !== B.podzol && g !== B.mycelium) {
              // the ground was carved away: still place canopy-free? skip entirely only if the trunk base is air
              if (g === 0 || g === B.water) continue;
            }
          }
          placeTree(t.type, t.x, t.y, t.z, new Rng(hash3(t.x, t.y, t.z, this.seed ^ 0x3ee)), setter, getter);
        }
      }
    }
    // small features
    const rng = new Rng(hash3(chunk.cx, 3, chunk.cz, this.seed ^ 0xdec));
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const bi = biomes[lz * 16 + lx];
      const h = heights[lz * 16 + lx];
      const x = x0 + lx, z = z0 + lz;
      const ground = chunk.getBlock(lx, h, lz);
      const above = chunk.getBlock(lx, h + 1, lz);
      const r = rng.next();
      if (above === 0 && h >= SEA_LEVEL) {
        if (ground === B.grass_block) {
          if (r < bi.flowerDensity && bi.flowers.length) {
            const fl = bi.flowers[(this.variantN.noise2(x / 24, z / 24) * 0.5 + 0.5) * bi.flowers.length | 0] || bi.flowers[0];
            const fd = BLOCK[fl];
            if (fd.kind === 'tall_plant') { chunk.setRaw(lx, h + 1, lz, fd.id, 0); chunk.setRaw(lx, h + 2, lz, fd.id, 8); }
            else chunk.setRaw(lx, h + 1, lz, fd.id);
          } else if (r < bi.flowerDensity + bi.grassDensity) {
            const r2 = rng.next();
            if (bi.ferns && r2 < 0.3) chunk.setRaw(lx, h + 1, lz, B.fern);
            else if ((bi.tallGrass || 0.03) > r2 * 2 && h + 2 < MAX_Y) { chunk.setRaw(lx, h + 1, lz, bi.ferns ? B.large_fern : B.tall_grass, 0); chunk.setRaw(lx, h + 2, lz, bi.ferns ? B.large_fern : B.tall_grass, 8); }
            else chunk.setRaw(lx, h + 1, lz, B.short_grass);
          } else if (bi.berries && r > 0.997) chunk.setRaw(lx, h + 1, lz, B.sweet_berry_bush, 3);
          else if (r > 0.9993) chunk.setRaw(lx, h + 1, lz, B.pumpkin);
          else if (bi.melons && r > 0.995) chunk.setRaw(lx, h + 1, lz, B.melon);
          else if (bi.mushrooms && r > 0.985) chunk.setRaw(lx, h + 1, lz, rng.next() < 0.5 ? B.brown_mushroom : B.red_mushroom);
        } else if (ground === B.sand || ground === B.red_sand) {
          if (bi.cactus && r < 0.006 && lx > 0 && lx < 15 && lz > 0 && lz < 15) {
            const hh = 1 + rng.int(3);
            let ok = true;
            for (let k = 1; k <= hh; k++) for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (chunk.getBlock(lx + ax, h + k, lz + az) !== 0) ok = false;
            if (ok) for (let k = 1; k <= hh; k++) chunk.setRaw(lx, h + k, lz, B.cactus);
          } else if (bi.deadBush && r > 0.992) chunk.setRaw(lx, h + 1, lz, B.dead_bush);
          else if (h === SEA_LEVEL && r > 0.9 && hasWaterNeighbour(chunk, lx, h, lz)) {
            const hh = 1 + rng.int(3); for (let k = 1; k <= hh; k++) chunk.setRaw(lx, h + k, lz, B.sugar_cane);
          }
        } else if (ground === B.terracotta && bi.deadBush && r > 0.995) chunk.setRaw(lx, h + 1, lz, B.dead_bush);
        if ((ground === B.grass_block || ground === B.dirt) && h === SEA_LEVEL && r > 0.88 && hasWaterNeighbour(chunk, lx, h, lz) && chunk.getBlock(lx, h + 1, lz) === 0) {
          const hh = 1 + rng.int(3); for (let k = 1; k <= hh; k++) chunk.setRaw(lx, h + k, lz, B.sugar_cane);
        }
      }
      // water features
      if (h < SEA_LEVEL - 1) {
        const top = chunk.getBlock(lx, SEA_LEVEL - 1, lz);
        if (bi.lilyPads && top === B.water && r > 0.96 && h > SEA_LEVEL - 5) chunk.setRaw(lx, SEA_LEVEL, lz, B.lily_pad);
        if (bi.seagrass && chunk.getBlock(lx, h + 1, lz) === B.water) {
          if (r < 0.25) chunk.setRaw(lx, h + 1, lz, B.seagrass);
          else if (r > 0.97 && !bi.frozen) {
            const len = Math.min(SEA_LEVEL - 2 - h, 3 + rng.int(10));
            for (let k = 1; k <= len; k++) chunk.setRaw(lx, h + k, lz, B.kelp);
          }
        }
      }
      // snow cover
      if (bi.snow) {
        let y = MAX_Y - 1;
        for (; y > MIN_Y; y--) if (chunk.getBlock(lx, y, lz) !== 0) break;
        const t = chunk.getBlock(lx, y, lz);
        if (t !== B.water && t !== B.ice && t !== B.snow && t !== B.lava && t !== B.cactus && y + 1 < MAX_Y) {
          const d = BLOCKDEF[t];
          if (d && (d.opaque || d.kind === 'leaves') && d.shape === 'cube') {
            chunk.setRaw(lx, y + 1, lz, B.snow, 0);
            if (t === B.grass_block) { /* snowy grass rendered via neighbour check */ }
          } else if (d && (d.kind === 'grass' || d.kind === 'flower')) {
            chunk.setRaw(lx, y, lz, B.snow, 0);
          }
        }
      }
    }
  }

  // Locate a good spawn position near the origin
  findSpawn() {
    if (this.flat) return { x: 0.5, y: this.flatSurface() + 1, z: 0.5 };
    for (let r = 0; r < 4096; r += 16) {
      for (let a = 0; a < 8; a++) {
        const x = Math.round(Math.cos(a / 8 * Math.PI * 2) * r), z = Math.round(Math.sin(a / 8 * Math.PI * 2) * r);
        const b = this.biomeAt(x, z);
        if (b.ocean || b.name.includes('river') || b.name === 'beach' || b.top === 'snow_block' || b.name.includes('peaks')) continue;
        const y = this.surfaceAt(x, z);
        if (y >= SEA_LEVEL && y < 120) return { x: x + 0.5, y: y + 1, z: z + 0.5 };
      }
    }
    return { x: 0.5, y: this.surfaceAt(0, 0) + 1, z: 0.5 };
  }
}


function hasWaterNeighbour(chunk, lx, y, lz) {
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = lx + dx, z = lz + dz;
    if (x < 0 || z < 0 || x > 15 || z > 15) continue;
    if (chunk.getBlock(x, y, z) === B.water) return true;
  }
  return false;
}

function spline(c) {
  const pts = [[-1.2, 20], [-0.55, 30], [-0.35, 42], [-0.19, 55], [-0.12, 61], [-0.06, 64], [0.05, 67], [0.25, 72], [0.5, 80], [1.2, 95]];
  if (c <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (c <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const t = (c - x0) / (x1 - x0);
      return y0 + (y1 - y0) * (t * t * (3 - 2 * t));
    }
  }
  return pts[pts.length - 1][1];
}

function pickBiome(cl, variant) {
  const { c, t, h, H, m, river } = cl;
  if (c < -0.19 && H < 61) {
    const deep = H < 44;
    if (t < -0.45) return BIOME.frozen_ocean;
    if (t < -0.15) return BIOME.cold_ocean;
    if (t > 0.5) return BIOME.warm_ocean;
    return deep ? BIOME.deep_ocean : BIOME.ocean;
  }
  if (river > 0.55 && H < 64) return t < -0.4 ? BIOME.frozen_river : BIOME.river;
  if (H < 66 && c < -0.05 && m < 0.2) return t < -0.4 ? BIOME.snowy_beach : t > 0.6 && h < -0.2 ? BIOME.desert : BIOME.beach;
  if (H > 150) return t < 0.35 ? BIOME.jagged_peaks : BIOME.stony_peaks;
  if (H > 112 && m > 0.25) return t < -0.4 ? BIOME.snowy_taiga : BIOME.windswept_hills;
  if (H > 90 && m > 0.15 && t > -0.3 && t < 0.4) return h > 0.15 ? BIOME.cherry_grove : BIOME.meadow;
  if (t < -0.45) {
    if (h > 0.05) return BIOME.snowy_taiga;
    return variant > 0.75 ? BIOME.ice_spikes : BIOME.snowy_plains;
  }
  if (t < -0.15) return h > -0.1 ? BIOME.taiga : BIOME.plains;
  if (t < 0.2) {
    if (h < -0.35) return BIOME.plains;
    if (h < -0.1) return variant > 0.6 ? BIOME.sunflower_plains : BIOME.plains;
    if (h < 0.1) return variant > 0.55 ? BIOME.flower_forest : BIOME.forest;
    if (h < 0.3) return BIOME.birch_forest;
    return BIOME.dark_forest;
  }
  if (t < 0.5) {
    if (h < -0.3) return BIOME.savanna;
    if (h < 0) return BIOME.plains;
    if (h < 0.3) return BIOME.forest;
    if (H < 70) return BIOME.swamp;
    return BIOME.jungle;
  }
  if (h < -0.25 && c > 0.15) return BIOME.badlands;
  if (h < 0) return BIOME.desert;
  if (h < 0.3) return BIOME.savanna;
  return BIOME.jungle;
}
