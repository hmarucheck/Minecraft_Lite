// Per-block render information resolved against the texture atlas.
import { BLOCKS } from '../registry/blocks.js';
import { HFACING_TO_FACE } from '../core/util.js';

const FN = ['down', 'up', 'north', 'south', 'west', 'east'];
export function specName(spec, f) {
  if (!spec) return null;
  if (typeof spec === 'string') return spec;
  const n = FN[f];
  if (spec[n]) return spec[n];
  if (f <= 1) {
    if (spec.end) return spec.end;
    if (f === 0 && spec.bottom) return spec.bottom;
    if (f === 1 && spec.top) return spec.top;
  }
  if (f >= 2 && spec.side) return spec.side;
  return spec.all || spec.side || spec.top || null;
}

export const TINT_NONE = 0, TINT_GRASS = 1, TINT_FOLIAGE = 2, TINT_WATER = 3, TINT_FIXED = 4;

// faces of a pillar block for the 3 axes: [face] -> [isEnd, rotate]
const PILLAR = [
  [[1, 0], [1, 0], [0, 0], [0, 0], [0, 0], [0, 0]], // y
  [[0, 1], [0, 1], [0, 1], [0, 1], [1, 0], [1, 0]], // x
  [[0, 0], [0, 0], [1, 0], [1, 0], [0, 1], [0, 1]], // z
];

export function buildRenderInfo(atlas) {
  const infos = new Array(BLOCKS.length);
  const L = (name) => atlas.get(name);
  for (const d of BLOCKS) {
    const info = {
      id: d.id, def: d, shape: d.shape,
      layer: d.layer === 'translucent' ? 2 : d.layer === 'cutout' ? 1 : 0,
      occludes: d.opaque && d.shape === 'cube',
      cullSame: d.cullSame || d.kind === 'leaves',
      tint: TINT_NONE, tintRGB: [255, 255, 255],
      faces: null, faceFn: null, overlay: null, modelCache: new Map(),
      offset: !!d.offset,
    };
    if (d.tint === 'grass') info.tint = TINT_GRASS;
    else if (d.tint === 'foliage') info.tint = TINT_FOLIAGE;
    else if (d.tint === 'water') info.tint = TINT_WATER;
    else if (Array.isArray(d.tint)) { info.tint = TINT_FIXED; info.tintRGB = d.tint; }
    if (d.shape === 'cube') {
      info.faces = [0, 1, 2, 3, 4, 5].map((f) => L(specName(d.tex, f) || 'missing_tex'));
      if (d.overlay) info.overlay = L(d.overlay);
      if (d.kind === 'pillar') {
        const side = L(specName(d.tex, 2)), end = L(specName(d.tex, 1));
        info.faceFn = (f, meta) => { const a = PILLAR[Math.min(2, meta & 3)][f]; return [a[0] ? end : side, a[1]]; };
      } else if (d.kind === 'front' || d.kind === 'furnace' || d.kind === 'glazed' || d.kind === 'barrel') {
        if (d.facing6) {
          const t = d.tex6;
          const front = L(t.front), back = L(t.back), side = L(t.side), top = t.top ? L(t.top) : side;
          info.faceFn = (f, meta) => {
            const fr = meta % 6;
            if (f === fr) return [front, 0];
            if ((f ^ 1) === fr) return [back, 0];
            if (fr >= 2 && (f === 0 || f === 1)) return [top, fr === 4 || fr === 5 ? 1 : 0];
            return [side, (fr <= 1) ? 0 : (f <= 1 ? 0 : 1) * 0];
          };
        } else {
          const front = L(specName(d.tex, 2) === null ? 'missing_tex' : (d.tex.front || specName(d.tex, 2)));
          const frontLit = d.tex.front_lit ? L(d.tex.front_lit) : front;
          const side = L(specName(d.tex, 4)), top = L(specName(d.tex, 1)), bottom = L(specName(d.tex, 0));
          if (d.kind === 'glazed') {
            const g = L(d.tex);
            info.faceFn = (f, meta) => [g, (meta & 3)];
          } else {
            info.faceFn = (f, meta) => {
              if (f === 0) return [bottom, 0];
              if (f === 1) return [top, 0];
              if (f === HFACING_TO_FACE[meta & 3]) return [(meta & 4) ? frontLit : front, 0];
              return [side, 0];
            };
          }
        }
      } else if (d.kind === 'redstone_lamp') {
        const off = L('redstone_lamp'), on = L('redstone_lamp_on');
        info.faceFn = (f, meta) => [(meta & 1) ? on : off, 0];
      } else if (d.kind === 'grass_block') {
        info.snowSide = L('grass_block_snow');
      }
    } else if (d.shape === 'cross') {
      info.crossTex = L(typeof d.tex === 'string' ? d.tex : specName(d.tex, 2));
      if (d.kind === 'tall_plant') info.crossTop = L(d.topTex);
    } else if (d.shape === 'liquid') {
      info.still = L(d.fluid === 'water' ? 'water_still' : 'lava_still');
      info.flow = L(d.fluid === 'water' ? 'water_flow' : 'lava_flow');
      info.fluid = d.fluid === 'water' ? 1 : 2;
    } else if (d.shape === 'model') {
      info.dynamic = !!d.dynamicModel;
    }
    infos[d.id] = info;
  }
  return infos;
}

// Resolve model elements (tex names -> atlas entries), cached per meta for static models
export function resolveModel(info, atlas, meta, nb) {
  if (!info.dynamic) {
    const c = info.modelCache.get(meta);
    if (c) return c;
  }
  const els = info.def.model(meta, nb);
  for (const e of els) for (const f of e.faces) if (f && !f.entry) f.entry = atlas.get(f.tex || 'missing_tex');
  if (!info.dynamic) info.modelCache.set(meta, els);
  return els;
}
