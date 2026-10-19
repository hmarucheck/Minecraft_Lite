// Box models for entities (in pixels, y up, model faces +z) with procedurally painted skins.
import { Rng, hashString } from '../core/util.js';

// A part: { name, pivot:[x,y,z], boxes:[{o:[x,y,z], s:[w,h,d], uv:[u,v], inflate}], children:[], rot:[x,y,z] }
function part(name, pivot, boxes, children = [], rot = [0, 0, 0]) { return { name, pivot, boxes, children, rot }; }
function b(o, s, uv, inflate = 0) { return { o, s, uv, inflate }; }

// ------------------------------------------------------------------ skin painter
class Skin {
  constructor(w, h, seed) {
    this.w = w; this.h = h;
    this.c = document.createElement('canvas'); this.c.width = w; this.c.height = h;
    this.g = this.c.getContext('2d');
    this.rng = new Rng(seed);
  }
  px(x, y, col) { this.g.fillStyle = col; this.g.fillRect(x, y, 1, 1); }
  rect(x, y, w, h, col) { this.g.fillStyle = col; this.g.fillRect(x, y, w, h); }
  noise(x, y, w, h, base, amt = 0.08) {
    const [r, g, bl] = hexRgb(base);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const f = 1 + (this.rng.next() - 0.5) * 2 * amt;
      this.px(x + i, y + j, `rgb(${clamp8(r * f)},${clamp8(g * f)},${clamp8(bl * f)})`);
    }
  }
  // paint all 6 faces of a box with a function(face, x, y, w, h)
  box(uv, s, fn) {
    const [u, v] = uv, [w, h, d] = s;
    const faces = {
      top: [u + d, v, w, d], bottom: [u + d + w, v, w, d],
      right: [u, v + d, d, h], front: [u + d, v + d, w, h], left: [u + d + w, v + d, d, h], back: [u + d + w + d, v + d, w, h],
    };
    for (const [f, r] of Object.entries(faces)) fn(f, r[0], r[1], r[2], r[3]);
  }
  fillBox(uv, s, base, amt = 0.08, faceFn) {
    this.box(uv, s, (f, x, y, w, h) => { this.noise(x, y, w, h, base, amt); if (faceFn) faceFn(f, x, y, w, h); });
  }
}
function hexRgb(c) { if (typeof c === 'string') { const h = c.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; } return [(c >> 16) & 255, (c >> 8) & 255, c & 255]; }
function clamp8(v) { return Math.max(0, Math.min(255, Math.round(v))); }

// ------------------------------------------------------------------ model templates
// humanoid: head 8x8x8, body 8x12x4, arms 4x12x4 (or 3 slim / 2 skeleton), legs 4x12x4
function biped(opt = {}) {
  const arm = opt.arm || 4, leg = opt.leg || 4, legH = opt.legH || 12, armH = opt.armH || 12, bodyH = opt.bodyH || 12;
  const top = legH + bodyH;
  const P = [
    part('head', [0, top, 0], [b([-4, 0, -4], [8, 8, 8], [0, 0]), ...(opt.hat !== false ? [b([-4, 0, -4], [8, 8, 8], [32, 0], 0.5)] : []), ...(opt.headExtra || [])]),
    part('body', [0, legH, 0], [b([-4, 0, -2], [8, bodyH, 4], [16, 16])]),
    part('rightArm', [-4 - arm / 2, top - 2, 0], [b([-arm / 2, -armH + 2, -2 + (4 - arm) / 2], [arm, armH, arm], [40, 16])]),
    part('leftArm', [4 + arm / 2, top - 2, 0], [b([-arm / 2, -armH + 2, -2 + (4 - arm) / 2], [arm, armH, arm], opt.leftArmUV || [32, 48])]),
    part('rightLeg', [-2, legH, 0], [b([-leg / 2, -legH, -leg / 2], [leg, legH, leg], [0, 16])]),
    part('leftLeg', [2, legH, 0], [b([-leg / 2, -legH, -leg / 2], [leg, legH, leg], opt.leftLegUV || [16, 48])]),
  ];
  return P;
}
function quadruped(o) {
  // o: {bodyW, bodyH, bodyL, legH, legW, headS:[w,h,d], headY, bodyY}
  const legH = o.legH, lw = o.legW || 4;
  const bodyY = o.bodyY ?? legH;
  const hx = o.legX ?? (o.bodyW / 2 - lw / 2), hz = o.legZ ?? (o.bodyL / 2 - lw / 2);
  const hs = o.headS;
  const P = [
    part('body', [0, bodyY, 0], [b([-o.bodyW / 2, 0, -o.bodyL / 2], [o.bodyW, o.bodyH, o.bodyL], o.bodyUV || [28, 8]), ...(o.bodyExtra || [])]),
    part('head', [0, o.headY ?? bodyY + o.bodyH - 2, o.bodyL / 2 + (o.headZ ?? 0)], [b([-hs[0] / 2, -hs[1] / 2, 0], hs, [0, 0]), ...(o.headExtra || [])]),
    part('leg0', [-hx, legH, -hz], [b([-lw / 2, -legH, -lw / 2], [lw, legH, lw], o.legUV || [0, 16])]),
    part('leg1', [hx, legH, -hz], [b([-lw / 2, -legH, -lw / 2], [lw, legH, lw], o.legUV || [0, 16])]),
    part('leg2', [-hx, legH, hz], [b([-lw / 2, -legH, -lw / 2], [lw, legH, lw], o.legUV || [0, 16])]),
    part('leg3', [hx, legH, hz], [b([-lw / 2, -legH, -lw / 2], [lw, legH, lw], o.legUV || [0, 16])]),
  ];
  if (o.tail) P.push(part('tail', o.tail.pivot, [b(o.tail.o, o.tail.s, o.tail.uv)], [], o.tail.rot || [0, 0, 0]));
  return P;
}

// ------------------------------------------------------------------ face helpers
function eyes(s, x, y, w, h, col = '#ffffff', pupil = '#3a2a6a', ey = 3) {
  const cx = x + Math.floor(w / 2);
  s.rect(cx - 3, y + ey, 2, 1, col); s.rect(cx + 1, y + ey, 2, 1, col);
  s.px(cx - 2, y + ey, pupil); s.px(cx + 1, y + ey, pupil);
}

// ------------------------------------------------------------------ mob definitions
export const MODELS = {};
function def(name, d) { MODELS[name] = d; }

// Player / Steve-like default skin
def('player', {
  tex: [64, 64], parts: () => biped(),
  paint: (s) => {
    const skin = '#b4805f', hair = '#3b2614', shirt = '#2fa3a8', pants = '#3a3a8a', shoe = '#5a5a5a';
    s.fillBox([0, 0], [8, 8, 8], skin, 0.05, (f, x, y, w, h) => {
      if (f === 'top') s.noise(x, y, w, h, hair, 0.1);
      else if (f !== 'bottom') { s.noise(x, y, w, 2, hair, 0.1); if (f !== 'front') s.noise(x, y + 2, w, f === 'back' ? 5 : 1, hair, 0.1); }
      if (f === 'front') { s.rect(x + 1, y + 4, 2, 1, '#ffffff'); s.rect(x + 5, y + 4, 2, 1, '#ffffff'); s.px(x + 2, y + 4, '#523d89'); s.px(x + 5, y + 4, '#523d89'); s.rect(x + 3, y + 6, 2, 1, '#6a4030'); s.rect(x + 2, y + 7, 4, 1, '#4a3020'); }
    });
    s.fillBox([16, 16], [8, 12, 4], shirt, 0.06, (f, x, y, w, h) => { if (f === 'front') s.rect(x + 2, y, 4, 2, skin); });
    for (const uv of [[40, 16], [32, 48]]) s.fillBox(uv, [4, 12, 4], skin, 0.05, (f, x, y, w, h) => { s.noise(x, y, w, 4, shirt, 0.06); });
    for (const uv of [[0, 16], [16, 48]]) s.fillBox(uv, [4, 12, 4], pants, 0.06, (f, x, y, w, h) => { if (f !== 'top') s.noise(x, y + h - 2, w, 2, shoe, 0.1); });
  },
});
const zombiePaint = (skinC, shirt, pants, extra) => (s) => {
  s.fillBox([0, 0], [8, 8, 8], skinC, 0.08, (f, x, y, w, h) => {
    if (f === 'front') { s.rect(x + 1, y + 4, 2, 1, '#000000'); s.rect(x + 5, y + 4, 2, 1, '#000000'); s.rect(x + 3, y + 6, 2, 1, extra || '#2a3a2a'); }
  });
  s.fillBox([16, 16], [8, 12, 4], shirt, 0.08);
  for (const uv of [[40, 16], [32, 48]]) s.fillBox(uv, [4, 12, 4], skinC, 0.08, (f, x, y) => s.noise(x, y, 4, 3, shirt, 0.08));
  for (const uv of [[0, 16], [16, 48]]) s.fillBox(uv, [4, 12, 4], pants, 0.08);
};
def('zombie', { tex: [64, 64], parts: () => biped({ hat: false }), armsForward: true, paint: zombiePaint('#4f8a3a', '#2fa3a8', '#3a3a8a') });
def('husk', { tex: [64, 64], parts: () => biped({ hat: false }), armsForward: true, scale: 1.0625, paint: zombiePaint('#8a7a5a', '#6a5a3a', '#4a3a2a', '#3a2a1a') });
def('drowned', { tex: [64, 64], parts: () => biped({ hat: false }), armsForward: true, paint: zombiePaint('#4a9a8a', '#3a6a5a', '#2a4a4a', '#1a3a3a') });
def('zombie_villager', { tex: [64, 64], parts: () => biped({ hat: false, headExtra: [b([-1, -1, 4], [2, 4, 2], [24, 0])] }), armsForward: true, paint: zombiePaint('#4f8a3a', '#6a4a2a', '#4a3a2a') });
def('zombified_piglin', { tex: [64, 64], parts: () => biped({ hat: false }), armsForward: true, paint: zombiePaint('#e8a0a0', '#5a7a3a', '#4a3a2a') });
def('piglin', { tex: [64, 64], parts: () => biped({ hat: false }), paint: zombiePaint('#e89a8a', '#6a4a2a', '#4a3a2a') });
const skelPaint = (bone, dark) => (s) => {
  s.fillBox([0, 0], [8, 8, 8], bone, 0.06, (f, x, y, w, h) => {
    if (f === 'front') { s.rect(x + 1, y + 3, 2, 2, '#1a1a1a'); s.rect(x + 5, y + 3, 2, 2, '#1a1a1a'); s.rect(x + 3, y + 5, 2, 1, '#3a3a3a'); s.rect(x + 1, y + 6, 6, 1, '#4a4a4a'); }
  });
  s.fillBox([16, 16], [8, 12, 4], bone, 0.06, (f, x, y, w, h) => { for (let k = 1; k < h; k += 2) s.rect(x + 1, y + k, w - 2, 1, dark); });
  for (const uv of [[40, 16], [32, 48], [0, 16], [16, 48]]) s.fillBox(uv, [2, 12, 2], bone, 0.06);
};
def('skeleton', { tex: [64, 64], parts: () => biped({ arm: 2, leg: 2, hat: false }), paint: skelPaint('#c8c8c8', '#3a3a3a'), bow: true });
def('stray', { tex: [64, 64], parts: () => biped({ arm: 2, leg: 2, hat: false }), paint: skelPaint('#9ab0b0', '#4a5a5a'), bow: true });
def('wither_skeleton', { tex: [64, 64], parts: () => biped({ arm: 2, leg: 2, hat: false }), scale: 1.2, paint: skelPaint('#2a2a2a', '#0a0a0a') });
def('creeper', {
  tex: [64, 32],
  parts: () => [
    part('head', [0, 18, 0], [b([-4, 0, -4], [8, 8, 8], [0, 0])]),
    part('body', [0, 6, 0], [b([-4, 0, -2], [8, 12, 4], [16, 16])]),
    part('leg0', [-2, 6, -4], [b([-2, -6, -2], [4, 6, 4], [0, 16])]),
    part('leg1', [2, 6, -4], [b([-2, -6, -2], [4, 6, 4], [0, 16])]),
    part('leg2', [-2, 6, 4], [b([-2, -6, -2], [4, 6, 4], [0, 16])]),
    part('leg3', [2, 6, 4], [b([-2, -6, -2], [4, 6, 4], [0, 16])]),
  ],
  paint: (s) => {
    const camo = (x, y, w, h) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const r = s.rng.next(); s.px(x + i, y + j, r < 0.25 ? '#62c95a' : r < 0.5 ? '#3a9a2a' : r < 0.75 ? '#58b048' : r < 0.9 ? '#8ad87a' : '#2a6a1a'); } };
    s.box([0, 0], [8, 8, 8], (f, x, y, w, h) => { camo(x, y, w, h); if (f === 'front') { s.rect(x + 1, y + 2, 2, 2, '#000'); s.rect(x + 5, y + 2, 2, 2, '#000'); s.rect(x + 3, y + 4, 2, 3, '#000'); s.rect(x + 2, y + 5, 1, 3, '#000'); s.rect(x + 5, y + 5, 1, 3, '#000'); } });
    s.box([16, 16], [8, 12, 4], (f, x, y, w, h) => camo(x, y, w, h));
    s.box([0, 16], [4, 6, 4], (f, x, y, w, h) => camo(x, y, w, h));
  },
});
def('spider', {
  tex: [64, 32],
  parts: () => {
    const P = [
      part('head', [0, 9, 3], [b([-4, -4, 0], [8, 8, 8], [32, 4])]),
      part('neck', [0, 9, 0], [b([-3, -3, -3], [6, 6, 6], [0, 0])]),
      part('body', [0, 9, -3], [b([-5, -4, -12], [10, 8, 12], [0, 12])]),
    ];
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const z = [1, 0, -1, -2][Math.floor(i / 2)];
      P.push(part('leg' + i, [side * 4, 9, z], [b(side < 0 ? [-16, -1, -1] : [0, -1, -1], [16, 2, 2], [18, 0])], [], [0, 0, side * 0.6]));
    }
    return P;
  },
  paint: (s) => {
    s.fillBox([32, 4], [8, 8, 8], '#3a302a', 0.15, (f, x, y) => { if (f === 'front') { s.rect(x + 1, y + 3, 2, 1, '#c81a1a'); s.rect(x + 5, y + 3, 2, 1, '#c81a1a'); s.px(x + 3, y + 2, '#c81a1a'); s.px(x + 4, y + 2, '#c81a1a'); s.px(x + 2, y + 5, '#c81a1a'); s.px(x + 5, y + 5, '#c81a1a'); } });
    s.fillBox([0, 0], [6, 6, 6], '#2a2420', 0.15);
    s.fillBox([0, 12], [10, 8, 12], '#2e2622', 0.18);
    s.fillBox([18, 0], [16, 2, 2], '#2a2420', 0.15);
  },
});
def('cave_spider', { ...MODELS.spider, scale: 0.7, paint: (s) => { MODELS.spider.paint(s); s.fillBox([0, 12], [10, 8, 12], '#0c424e', 0.2); s.fillBox([0, 0], [6, 6, 6], '#0a3a44', 0.2); } });
def('enderman', {
  tex: [64, 32],
  parts: () => [
    part('head', [0, 38, 0], [b([-4, 0, -4], [8, 8, 8], [0, 0])]),
    part('body', [0, 26, 0], [b([-4, 0, -2], [8, 12, 4], [32, 16])]),
    part('rightArm', [-5, 36, 0], [b([-1, -28, -1], [2, 30, 2], [56, 0])]),
    part('leftArm', [5, 36, 0], [b([-1, -28, -1], [2, 30, 2], [56, 0])]),
    part('rightLeg', [-2, 26, 0], [b([-1, -26, -1], [2, 30, 2], [56, 0])]),
    part('leftLeg', [2, 26, 0], [b([-1, -26, -1], [2, 30, 2], [56, 0])]),
  ],
  paint: (s) => {
    s.fillBox([0, 0], [8, 8, 8], '#161616', 0.15, (f, x, y) => { if (f === 'front') { s.rect(x + 1, y + 4, 2, 1, '#e080ff'); s.rect(x + 5, y + 4, 2, 1, '#e080ff'); s.px(x + 2, y + 4, '#ffffff'); s.px(x + 5, y + 4, '#ffffff'); } });
    s.fillBox([32, 16], [8, 12, 4], '#121212', 0.15);
    s.fillBox([56, 0], [2, 30, 2], '#141414', 0.15);
  },
});
def('slime', {
  tex: [64, 32], translucent: true,
  parts: () => [part('cube', [0, 0, 0], [b([-3, 1, -3], [6, 6, 6], [0, 16]), b([-4, 0, -4], [8, 8, 8], [0, 0])])],
  paint: (s) => {
    s.fillBox([0, 0], [8, 8, 8], '#6fc05b', 0.05);
    s.g.clearRect(0, 0, 32, 16);
    s.box([0, 0], [8, 8, 8], (f, x, y, w, h) => { s.g.fillStyle = 'rgba(111,192,91,0.62)'; s.g.fillRect(x, y, w, h); });
    s.fillBox([0, 16], [6, 6, 6], '#4f9a3e', 0.08, (f, x, y) => { if (f === 'front') { s.rect(x + 1, y + 1, 1, 1, '#1a3a1a'); s.rect(x + 4, y + 1, 1, 1, '#1a3a1a'); s.px(x + 3, y + 4, '#1a3a1a'); } });
  },
});
def('magma_cube', { ...MODELS.slime, translucent: false, paint: (s) => { s.fillBox([0, 0], [8, 8, 8], '#4a1a0a', 0.2, (f, x, y, w, h) => { for (let j = 1; j < h; j += 3) s.rect(x, y + j, w, 1, '#d06a1a'); if (f === 'front') { s.rect(x + 1, y + 3, 2, 1, '#ffd040'); s.rect(x + 5, y + 3, 2, 1, '#ffd040'); } }); s.fillBox([0, 16], [6, 6, 6], '#2a0a04', 0.1); } });
def('pig', {
  tex: [64, 32],
  parts: () => quadruped({ bodyW: 10, bodyH: 8, bodyL: 16, legH: 6, headS: [8, 8, 8], headY: 12, headZ: 0, headExtra: [b([-2, -3.5, 8], [4, 3, 1], [16, 16])] }),
  paint: (s) => {
    const pink = '#f0a5a2';
    s.fillBox([0, 0], [8, 8, 8], pink, 0.05, (f, x, y) => { if (f === 'front') { s.rect(x + 1, y + 2, 1, 2, '#ffffff'); s.px(x + 1, y + 3, '#000'); s.rect(x + 6, y + 2, 1, 2, '#ffffff'); s.px(x + 6, y + 3, '#000'); } });
    s.fillBox([16, 16], [4, 3, 1], '#e88a8a', 0.05, (f, x, y) => { if (f === 'front') { s.px(x, y + 1, '#8a4a4a'); s.px(x + 3, y + 1, '#8a4a4a'); } });
    s.fillBox([28, 8], [10, 8, 16], pink, 0.06);
    s.fillBox([0, 16], [4, 6, 4], pink, 0.06, (f, x, y, w, h) => { if (f !== 'top') s.rect(x, y + h - 1, w, 1, '#8a5a4a'); });
  },
});
def('cow', {
  tex: [64, 32],
  parts: () => quadruped({ bodyW: 12, bodyH: 10, bodyL: 18, legH: 12, headS: [8, 8, 6], headY: 20, headExtra: [b([-5, 2, 2], [1, 3, 1], [22, 0]), b([4, 2, 2], [1, 3, 1], [22, 0])] }),
  paint: (s) => {
    const brown = '#443626', white = '#d8d8d8';
    const patches = (x, y, w, h) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) s.px(x + i, y + j, ((Math.sin((x + i) * 0.7) + Math.cos((y + j) * 0.9)) > 0.6) ? white : brown); };
    s.box([0, 0], [8, 8, 6], (f, x, y, w, h) => { s.noise(x, y, w, h, brown, 0.08); if (f === 'front') { s.rect(x + 1, y + 2, 1, 1, '#000'); s.rect(x + 6, y + 2, 1, 1, '#000'); s.rect(x + 2, y + 5, 4, 3, '#a8a8a8'); s.px(x + 3, y + 6, '#3a3a3a'); s.px(x + 4, y + 6, '#3a3a3a'); } });
    s.box([28, 8], [12, 10, 18], (f, x, y, w, h) => patches(x, y, w, h));
    s.fillBox([0, 16], [4, 12, 4], brown, 0.08, (f, x, y, w, h) => { if (f !== 'top') s.rect(x, y + h - 2, w, 2, '#2a2016'); });
    s.fillBox([22, 0], [1, 3, 1], '#d8d0b0', 0.05);
  },
});
def('mooshroom', { ...MODELS.cow, paint: (s) => { MODELS.cow.paint(s); s.box([28, 8], [12, 10, 18], (f, x, y, w, h) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) s.px(x + i, y + j, ((Math.sin((x + i) * 0.7) + Math.cos((y + j) * 0.9)) > 0.6) ? '#d8d8d8' : '#a01818'); }); s.box([0, 0], [8, 8, 6], (f, x, y, w, h) => { if (f !== 'front') s.noise(x, y, w, h, '#a01818', 0.08); }); } });
def('sheep', {
  tex: [64, 32],
  parts: () => quadruped({ bodyW: 8, bodyH: 6, bodyL: 16, legH: 12, headS: [6, 6, 8], headY: 18, headZ: -2, bodyExtra: [b([-4, 0, -8], [8, 6, 16], [28, 8], 1.75)] }),
  paint: (s) => {
    s.fillBox([0, 0], [6, 6, 8], '#d8c8b8', 0.06, (f, x, y) => { if (f === 'front') { s.rect(x + 1, y + 2, 1, 1, '#000'); s.rect(x + 4, y + 2, 1, 1, '#000'); s.rect(x + 2, y + 4, 2, 1, '#e8a8a8'); } });
    s.fillBox([28, 8], [8, 6, 16], '#e8e8e8', 0.07);
    s.fillBox([0, 16], [4, 12, 4], '#d8c8b8', 0.06, (f, x, y, w) => s.noise(x, y, w, 5, '#e8e8e8', 0.06));
  },
  woolTint: true,
});
def('chicken', {
  tex: [64, 32],
  parts: () => [
    part('head', [0, 9, 4], [b([-2, 0, -1], [4, 6, 3], [0, 0]), b([-2, 2, 2], [4, 2, 2], [14, 0]), b([-1, 0, 2], [2, 2, 2], [14, 4])]),
    part('body', [0, 8, 0], [b([-3, -3, -4], [6, 6, 8], [0, 9])]),
    part('rightWing', [-3, 10, 0], [b([-1, -4, -3], [1, 4, 6], [24, 13])]),
    part('leftWing', [3, 10, 0], [b([0, -4, -3], [1, 4, 6], [24, 13])]),
    part('leg0', [-1, 5, 1], [b([-1, -5, -1], [3, 5, 3], [26, 0])]),
    part('leg1', [2, 5, 1], [b([-1, -5, -1], [3, 5, 3], [26, 0])]),
  ],
  paint: (s) => {
    s.fillBox([0, 0], [4, 6, 3], '#f0f0f0', 0.04, (f, x, y) => { if (f === 'front') { s.px(x, y + 2, '#000'); s.px(x + 3, y + 2, '#000'); } });
    s.fillBox([14, 0], [4, 2, 2], '#f0a020', 0.05);
    s.fillBox([14, 4], [2, 2, 2], '#d01a1a', 0.05);
    s.fillBox([0, 9], [6, 6, 8], '#f0f0f0', 0.05);
    s.fillBox([24, 13], [1, 4, 6], '#e8e8e8', 0.05);
    s.box([26, 0], [3, 5, 3], (f, x, y, w, h) => { s.g.clearRect(x, y, w, h); s.rect(x + 1, y, 1, h, '#f0a020'); if (f === 'bottom') s.rect(x, y, w, h, '#f0a020'); });
  },
});
def('wolf', {
  tex: [64, 32],
  parts: () => quadruped({ bodyW: 6, bodyH: 6, bodyL: 9, legH: 8, legW: 2, headS: [6, 6, 4], headY: 12, headZ: 0, bodyY: 7, headExtra: [b([-1.5, -3, 4], [3, 3, 4], [0, 10]), b([-3, 3, 1], [2, 2, 1], [16, 14]), b([1, 3, 1], [2, 2, 1], [16, 14])], tail: { pivot: [0, 12, -4.5], o: [-1, -8, -1], s: [2, 8, 2], uv: [9, 18], rot: [0.6, 0, 0] } }),
  paint: (s) => {
    const fur = '#d7d3d3';
    s.fillBox([0, 0], [6, 6, 4], fur, 0.08, (f, x, y) => { if (f === 'front') { s.px(x + 1, y + 2, '#000'); s.px(x + 4, y + 2, '#000'); } });
    s.fillBox([0, 10], [3, 3, 4], '#c8c0b8', 0.06, (f, x, y) => { if (f === 'front') s.px(x + 1, y, '#1a1a1a'); });
    s.fillBox([16, 14], [2, 2, 1], fur, 0.06);
    s.fillBox([28, 8], [6, 6, 9], fur, 0.08);
    s.fillBox([0, 16], [2, 8, 2], fur, 0.08);
    s.fillBox([9, 18], [2, 8, 2], fur, 0.08);
  },
});
def('fox', { ...MODELS.wolf, scale: 0.85, paint: (s) => { const o = '#e07a2a'; s.fillBox([0, 0], [6, 6, 4], o, 0.06, (f, x, y) => { if (f === 'front') { s.px(x + 1, y + 2, '#000'); s.px(x + 4, y + 2, '#000'); s.rect(x, y + 4, 6, 2, '#f0f0f0'); } }); s.fillBox([0, 10], [3, 3, 4], '#f0f0f0', 0.05); s.fillBox([16, 14], [2, 2, 1], o, 0.06); s.fillBox([28, 8], [6, 6, 9], o, 0.08); s.fillBox([0, 16], [2, 8, 2], '#2a2a2a', 0.08); s.fillBox([9, 18], [2, 8, 2], o, 0.08, (f, x, y, w, h) => s.rect(x, y + h - 2, w, 2, '#f0f0f0')); } });
def('cat', { ...MODELS.wolf, scale: 0.75, paint: (s) => { const o = '#efc88e'; s.fillBox([0, 0], [6, 6, 4], o, 0.1, (f, x, y) => { if (f === 'front') { s.px(x + 1, y + 2, '#2a8a2a'); s.px(x + 4, y + 2, '#2a8a2a'); } }); s.fillBox([0, 10], [3, 3, 4], '#f8e8d0', 0.05); s.fillBox([16, 14], [2, 2, 1], o, 0.06); s.fillBox([28, 8], [6, 6, 9], o, 0.12); s.fillBox([0, 16], [2, 8, 2], o, 0.1); s.fillBox([9, 18], [2, 8, 2], o, 0.1); } });
def('ocelot', { ...MODELS.cat });
def('rabbit', {
  tex: [64, 32], scale: 0.6,
  parts: () => quadruped({ bodyW: 6, bodyH: 5, bodyL: 8, legH: 4, legW: 2, headS: [5, 4, 5], headY: 9, bodyY: 3, headExtra: [b([-2, 2, 1], [1, 5, 1], [16, 0]), b([1, 2, 1], [1, 5, 1], [16, 0])] }),
  paint: (s) => { const c = '#995f40'; s.fillBox([0, 0], [5, 4, 5], c, 0.1, (f, x, y) => { if (f === 'front') { s.px(x + 1, y + 1, '#000'); s.px(x + 3, y + 1, '#000'); } }); s.fillBox([16, 0], [1, 5, 1], c, 0.1); s.fillBox([28, 8], [6, 5, 8], c, 0.1); s.fillBox([0, 16], [2, 4, 2], c, 0.1); },
});
def('horse', {
  tex: [64, 64],
  parts: () => quadruped({ bodyW: 10, bodyH: 10, bodyL: 22, legH: 11, legW: 4, headS: [6, 5, 7], headY: 26, headZ: 2, bodyY: 11, bodyUV: [0, 32], headExtra: [b([-3, -6, -2], [6, 12, 4], [0, 35]), b([-2, 2, 5], [4, 5, 5], [0, 25])] }),
  paint: (s) => { const c = '#9a6a3a'; s.fillBox([0, 0], [6, 5, 7], c, 0.08, (f, x, y) => { if (f === 'right' || f === 'left') s.px(x + 3, y + 1, '#000'); }); s.fillBox([0, 32], [10, 10, 22], c, 0.08); s.fillBox([0, 16], [4, 11, 4], c, 0.08, (f, x, y, w, h) => s.rect(x, y + h - 2, w, 2, '#3a2a1a')); s.fillBox([0, 35], [6, 12, 4], c, 0.08); s.fillBox([0, 25], [4, 5, 5], '#7a5a3a', 0.08); },
});
def('donkey', { ...MODELS.horse, scale: 0.87, paint: (s) => { MODELS.horse.paint(s); s.fillBox([0, 32], [10, 10, 22], '#6a5a4a', 0.08); } });
def('llama', { ...MODELS.horse, scale: 0.9, paint: (s) => { const c = '#d8c8a8'; s.fillBox([0, 0], [6, 5, 7], c, 0.08); s.fillBox([0, 32], [10, 10, 22], c, 0.08); s.fillBox([0, 16], [4, 11, 4], c, 0.08); s.fillBox([0, 35], [6, 12, 4], c, 0.08); s.fillBox([0, 25], [4, 5, 5], c, 0.08); } });
def('goat', { ...MODELS.sheep, paint: (s) => { const c = '#e8e0d0'; s.fillBox([0, 0], [6, 6, 8], c, 0.06, (f, x, y) => { if (f === 'front') { s.px(x + 1, y + 2, '#000'); s.px(x + 4, y + 2, '#000'); } }); s.fillBox([28, 8], [8, 6, 16], c, 0.06); s.fillBox([0, 16], [4, 12, 4], c, 0.06); } });
def('polar_bear', {
  tex: [64, 64], scale: 1,
  parts: () => quadruped({ bodyW: 14, bodyH: 14, bodyL: 22, legH: 10, legW: 6, headS: [7, 7, 7], headY: 20, headZ: 0, headExtra: [b([-2.5, -3, 7], [5, 3, 3], [0, 26])] }),
  paint: (s) => { const c = '#f2f2f2'; s.fillBox([0, 0], [7, 7, 7], c, 0.05, (f, x, y) => { if (f === 'front') { s.px(x + 1, y + 2, '#000'); s.px(x + 5, y + 2, '#000'); } }); s.fillBox([0, 26], [5, 3, 3], c, 0.05, (f, x, y) => { if (f === 'front') s.rect(x + 1, y, 3, 1, '#1a1a1a'); }); s.fillBox([28, 8], [14, 14, 22], c, 0.05); s.fillBox([0, 16], [6, 10, 6], c, 0.05); },
});
def('panda', { ...MODELS.polar_bear, paint: (s) => { s.fillBox([0, 0], [7, 7, 7], '#f0f0f0', 0.04, (f, x, y) => { if (f === 'front') { s.rect(x, y + 2, 3, 2, '#1a1a1a'); s.rect(x + 4, y + 2, 3, 2, '#1a1a1a'); s.px(x + 1, y + 2, '#fff'); } if (f === 'top') { s.rect(x, y, 2, 2, '#1a1a1a'); s.rect(x + 5, y, 2, 2, '#1a1a1a'); } }); s.fillBox([0, 26], [5, 3, 3], '#f0f0f0', 0.05); s.box([28, 8], [14, 14, 22], (f, x, y, w, h) => { s.noise(x, y, w, h, '#f0f0f0', 0.04); s.noise(x, y + Math.floor(h * 0.3), w, Math.floor(h * 0.3), '#1a1a1a', 0.05); }); s.fillBox([0, 16], [6, 10, 6], '#1a1a1a', 0.05); } });
def('squid', {
  tex: [64, 32],
  parts: () => {
    const P = [part('body', [0, 8, 0], [b([-6, 0, -6], [12, 16, 12], [0, 0])])];
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; P.push(part('t' + i, [Math.cos(a) * 5, 8, Math.sin(a) * 5], [b([-1, -18, -1], [2, 18, 2], [48, 0])])); }
    return P;
  },
  paint: (s) => { s.fillBox([0, 0], [12, 16, 12], '#2a4a6a', 0.1, (f, x, y) => { if (f === 'front') { s.rect(x + 2, y + 10, 2, 2, '#c8c8c8'); s.rect(x + 8, y + 10, 2, 2, '#c8c8c8'); } }); s.fillBox([48, 0], [2, 18, 2], '#3a5a7a', 0.1); },
  swims: true,
});
def('glow_squid', { ...MODELS.squid, paint: (s) => { s.fillBox([0, 0], [12, 16, 12], '#0a6a6a', 0.12, (f, x, y) => { if (f === 'front') { s.rect(x + 2, y + 10, 2, 2, '#c8fff8'); s.rect(x + 8, y + 10, 2, 2, '#c8fff8'); } }); s.fillBox([48, 0], [2, 18, 2], '#2ac8b8', 0.1); }, glow: true });
def('bat', {
  tex: [64, 64], scale: 0.35,
  parts: () => [part('head', [0, 18, 0], [b([-3, 0, -3], [6, 6, 6], [0, 0])]), part('body', [0, 6, 0], [b([-3, 0, -3], [6, 12, 6], [0, 16])]), part('rightWing', [-3, 16, 0], [b([-12, -10, 0], [12, 14, 1], [24, 0])]), part('leftWing', [3, 16, 0], [b([0, -10, 0], [12, 14, 1], [24, 0])])],
  paint: (s) => { s.fillBox([0, 0], [6, 6, 6], '#4c3e30', 0.12, (f, x, y) => { if (f === 'front') { s.px(x + 1, y + 2, '#000'); s.px(x + 4, y + 2, '#000'); } }); s.fillBox([0, 16], [6, 12, 6], '#3a2e22', 0.12); s.fillBox([24, 0], [12, 14, 1], '#1a1612', 0.1); },
  flies: true,
});
def('villager', {
  tex: [64, 64],
  parts: () => [
    part('head', [0, 24, 0], [b([-4, 0, -4], [8, 10, 8], [0, 0]), b([-1, 1, 4], [2, 4, 2], [24, 0])]),
    part('body', [0, 12, 0], [b([-4, 0, -3], [8, 12, 6], [16, 20]), b([-4, -6, -3], [8, 18, 6], [0, 38], 0.3)]),
    part('arms', [0, 21, 1], [b([-4, -6, 0], [8, 4, 4], [40, 38]), b([-8, -6, 0], [4, 8, 4], [44, 22]), b([4, -6, 0], [4, 8, 4], [44, 22])], [], [-0.75, 0, 0]),
    part('rightLeg', [-2, 12, 0], [b([-2, -12, -2], [4, 12, 4], [0, 22])]),
    part('leftLeg', [2, 12, 0], [b([-2, -12, -2], [4, 12, 4], [0, 22])]),
  ],
  paint: (s) => {
    s.fillBox([0, 0], [8, 10, 8], '#bd8b72', 0.05, (f, x, y) => { if (f === 'front') { s.rect(x + 1, y + 4, 2, 1, '#fff'); s.rect(x + 5, y + 4, 2, 1, '#fff'); s.px(x + 2, y + 4, '#2a8a2a'); s.px(x + 5, y + 4, '#2a8a2a'); s.rect(x + 3, y + 3, 2, 1, '#3a2a1a'); } });
    s.fillBox([24, 0], [2, 4, 2], '#a87a62', 0.05);
    s.fillBox([16, 20], [8, 12, 6], '#6a4a2a', 0.08);
    s.fillBox([0, 38], [8, 18, 6], '#7a5232', 0.08);
    s.fillBox([40, 38], [8, 4, 4], '#6a4a2a', 0.08);
    s.fillBox([44, 22], [4, 8, 4], '#6a4a2a', 0.08, (f, x, y, w, h) => s.noise(x, y + h - 3, w, 3, '#bd8b72', 0.05));
    s.fillBox([0, 22], [4, 12, 4], '#4a3a2a', 0.08);
  },
});
def('witch', { ...MODELS.villager, paint: (s) => { MODELS.villager.paint(s); s.fillBox([0, 38], [8, 18, 6], '#3a1a4a', 0.08); s.fillBox([16, 20], [8, 12, 6], '#3a1a4a', 0.08); }, hat: true });
def('wandering_trader', { ...MODELS.villager, paint: (s) => { MODELS.villager.paint(s); s.fillBox([0, 38], [8, 18, 6], '#2a4a8a', 0.08); } });
def('iron_golem', {
  tex: [128, 128],
  parts: () => [
    part('head', [0, 31, -2], [b([-4, 0, -2.5], [8, 10, 8], [0, 0]), b([-1, 1, 5.5], [2, 4, 2], [24, 0])]),
    part('body', [0, 13, 0], [b([-9, 6, -6], [18, 12, 11], [0, 40]), b([-4.5, 0, -3], [9, 5, 6], [0, 70], 0.5)]),
    part('rightArm', [-11, 29, 0], [b([-2, -30, -3], [4, 30, 6], [60, 21])]),
    part('leftArm', [11, 29, 0], [b([-2, -30, -3], [4, 30, 6], [60, 58])]),
    part('rightLeg', [-4, 13, 0], [b([-3, -13, -2.5], [6, 16, 5], [37, 0])]),
    part('leftLeg', [5, 13, 0], [b([-3, -13, -2.5], [6, 16, 5], [60, 0])]),
  ],
  paint: (s) => {
    const c = '#c8c0b8';
    s.fillBox([0, 0], [8, 10, 8], c, 0.06, (f, x, y) => { if (f === 'front') { s.rect(x + 1, y + 4, 2, 1, '#a01010'); s.rect(x + 5, y + 4, 2, 1, '#a01010'); } });
    s.fillBox([24, 0], [2, 4, 2], c, 0.06);
    s.fillBox([0, 40], [18, 12, 11], c, 0.08, (f, x, y, w, h) => { for (let i = 0; i < 6; i++) s.px(x + s.rng.int(w), y + s.rng.int(h), '#4a8a2a'); });
    s.fillBox([0, 70], [9, 5, 6], c, 0.08);
    s.fillBox([60, 21], [4, 30, 6], c, 0.08);
    s.fillBox([60, 58], [4, 30, 6], c, 0.08);
    s.fillBox([37, 0], [6, 16, 5], c, 0.08);
    s.fillBox([60, 0], [6, 16, 5], c, 0.08);
  },
});
def('snow_golem', {
  tex: [64, 64],
  parts: () => [part('head', [0, 20, 0], [b([-4, 0, -4], [8, 8, 8], [0, 0])]), part('upper', [0, 11, 0], [b([-5, 0, -5], [10, 10, 10], [0, 16])]), part('lower', [0, 0, 0], [b([-6, 0, -6], [12, 12, 12], [0, 36])]), part('rightArm', [-5, 17, 0], [b([-12, -1, -1], [12, 2, 2], [32, 0])], [], [0, 0, 0.5]), part('leftArm', [5, 17, 0], [b([0, -1, -1], [12, 2, 2], [32, 0])], [], [0, 0, -0.5])],
  paint: (s) => { s.fillBox([0, 0], [8, 8, 8], '#e8901a', 0.1, (f, x, y) => { if (f === 'front') { s.rect(x + 1, y + 2, 2, 2, '#3a2008'); s.rect(x + 5, y + 2, 2, 2, '#3a2008'); s.rect(x + 2, y + 5, 4, 1, '#3a2008'); } }); s.fillBox([0, 16], [10, 10, 10], '#f0fafa', 0.04); s.fillBox([0, 36], [12, 12, 12], '#f0fafa', 0.04); s.fillBox([32, 0], [12, 2, 2], '#6a4a2a', 0.08); },
});
def('bee', {
  tex: [64, 64], scale: 0.6,
  parts: () => [part('body', [0, 7, 0], [b([-3.5, -4, -5], [7, 7, 10], [0, 0])]), part('rightWing', [-1.5, 10, 0], [b([-9, 0, -3], [9, 0.1, 6], [0, 18])]), part('leftWing', [1.5, 10, 0], [b([0, 0, -3], [9, 0.1, 6], [0, 18])])],
  paint: (s) => { s.box([0, 0], [7, 7, 10], (f, x, y, w, h) => { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) s.px(x + i, y + j, Math.floor(((f === 'front' || f === 'back') ? 0 : (f === 'top' || f === 'bottom') ? j : i) / 2) % 2 ? '#2a1a0a' : '#edc343'); if (f === 'front') { s.rect(x, y + 2, 7, 3, '#edc343'); s.rect(x + 1, y + 2, 1, 2, '#000'); s.rect(x + 5, y + 2, 1, 2, '#000'); } }); s.box([0, 18], [9, 0, 6], (f, x, y, w, h) => { s.g.fillStyle = 'rgba(220,240,255,0.7)'; s.g.fillRect(x, y, w, Math.max(1, h)); }); },
  flies: true, translucent: true,
});
def('parrot', {
  tex: [32, 32], scale: 0.7,
  parts: () => [part('head', [0, 12, 0], [b([-1.5, 0, -1.5], [3, 3, 3], [2, 2]), b([-0.5, 0, 1.5], [1, 2, 1], [11, 7])]), part('body', [0, 4, 0], [b([-1.5, 0, -1.5], [3, 8, 3], [2, 8])]), part('rightWing', [-1.5, 10, 0], [b([-1, -6, -1.5], [1, 6, 3], [19, 8])]), part('leftWing', [1.5, 10, 0], [b([0, -6, -1.5], [1, 6, 3], [19, 8])]), part('leg0', [-0.5, 4, 0], [b([-0.5, -4, -0.5], [1, 4, 1], [14, 18])]), part('leg1', [0.5, 4, 0], [b([-0.5, -4, -0.5], [1, 4, 1], [14, 18])])],
  paint: (s) => { s.fillBox([2, 2], [3, 3, 3], '#e01a1a', 0.08, (f, x, y) => { if (f === 'right' || f === 'left') s.px(x + 1, y + 1, '#000'); }); s.fillBox([11, 7], [1, 2, 1], '#f0a020', 0.05); s.fillBox([2, 8], [3, 8, 3], '#e01a1a', 0.08); s.fillBox([19, 8], [1, 6, 3], '#1a8ae0', 0.08); s.fillBox([14, 18], [1, 4, 1], '#3a3a3a', 0.05); },
  flies: true,
});
def('dolphin', {
  tex: [64, 64],
  parts: () => [part('body', [0, 4, 0], [b([-4, 0, -6], [8, 7, 13], [22, 0]), b([-0.5, 7, -1], [1, 4, 5], [51, 0])]), part('head', [0, 4, 7], [b([-4, 0, 0], [8, 7, 6], [0, 0]), b([-1, 0, 6], [2, 2, 4], [0, 13])]), part('tail', [0, 4, -6], [b([-2, 0, -10], [4, 5, 11], [0, 19]), b([-5, 0.5, -11], [10, 1, 6], [19, 20])])],
  paint: (s) => { const c = '#6a8aa8'; s.fillBox([22, 0], [8, 7, 13], c, 0.06); s.fillBox([51, 0], [1, 4, 5], c, 0.06); s.fillBox([0, 0], [8, 7, 6], c, 0.06, (f, x, y) => { if (f === 'right' || f === 'left') s.px(x + 3, y + 2, '#000'); }); s.fillBox([0, 13], [2, 2, 4], '#c8d8e8', 0.05); s.fillBox([0, 19], [4, 5, 11], c, 0.06); s.fillBox([19, 20], [10, 1, 6], c, 0.06); },
  swims: true,
});
def('turtle', {
  tex: [128, 64], scale: 1,
  parts: () => quadruped({ bodyW: 19, bodyH: 6, bodyL: 20, legH: 2, legW: 4, legX: 7, legZ: 8, headS: [6, 5, 6], headY: 4, headZ: 0, bodyY: 2 }),
  paint: (s) => { s.fillBox([0, 0], [6, 5, 6], '#7ab868', 0.08, (f, x, y) => { if (f === 'front') { s.px(x + 1, y + 1, '#000'); s.px(x + 4, y + 1, '#000'); } }); s.fillBox([28, 8], [19, 6, 20], '#2a6a2a', 0.12); s.fillBox([0, 16], [4, 2, 4], '#7ab868', 0.08); },
});
def('frog', {
  tex: [48, 48], scale: 0.5,
  parts: () => quadruped({ bodyW: 7, bodyH: 4, bodyL: 9, legH: 3, legW: 3, headS: [7, 4, 7], headY: 7, headZ: -3, bodyY: 3 }),
  paint: (s) => { const c = '#d07444'; s.fillBox([0, 0], [7, 4, 7], c, 0.08, (f, x, y) => { if (f === 'top') { s.rect(x, y, 2, 2, '#fff'); s.rect(x + 5, y, 2, 2, '#fff'); s.px(x + 1, y + 1, '#000'); s.px(x + 5, y + 1, '#000'); } }); s.fillBox([28, 8], [7, 4, 9], c, 0.08); s.fillBox([0, 16], [3, 3, 3], '#c06030', 0.08); },
});
def('axolotl', {
  tex: [64, 64], scale: 0.6,
  parts: () => quadruped({ bodyW: 8, bodyH: 4, bodyL: 10, legH: 2, legW: 2, headS: [8, 5, 5], headY: 4, headZ: 0, bodyY: 1, tail: { pivot: [0, 3, -5], o: [-1, -1, -10], s: [2, 2, 10], uv: [2, 19] } }),
  paint: (s) => { const c = '#f0b8d8'; s.fillBox([0, 0], [8, 5, 5], c, 0.05, (f, x, y) => { if (f === 'front') { s.px(x + 1, y + 2, '#1a1a1a'); s.px(x + 6, y + 2, '#1a1a1a'); s.rect(x + 3, y + 3, 2, 1, '#c86a9a'); } }); s.fillBox([28, 8], [8, 4, 10], c, 0.05); s.fillBox([0, 16], [2, 2, 2], c, 0.05); s.fillBox([2, 19], [2, 2, 10], '#e898c8', 0.05); },
  swims: true,
});
def('silverfish', {
  tex: [64, 32], scale: 1,
  parts: () => [part('body', [0, 2, 0], [b([-1.5, -2, -5], [3, 3, 3], [0, 0]), b([-2, -2, -2], [4, 4, 3], [0, 4]), b([-2.5, -2, 1], [5, 4, 3], [0, 9]), b([-1, -2, 4], [2, 2, 2], [0, 16])])],
  paint: (s) => { for (const [uv, sz] of [[[0, 0], [3, 3, 3]], [[0, 4], [4, 4, 3]], [[0, 9], [5, 4, 3]], [[0, 16], [2, 2, 2]]]) s.fillBox(uv, sz, '#8a8a8a', 0.15); },
});
def('endermite', { ...MODELS.silverfish, paint: (s) => { for (const [uv, sz] of [[[0, 0], [3, 3, 3]], [[0, 4], [4, 4, 3]], [[0, 9], [5, 4, 3]], [[0, 16], [2, 2, 2]]]) s.fillBox(uv, sz, '#2a1a3a', 0.2); } });
def('phantom', {
  tex: [64, 64],
  parts: () => [part('body', [0, 4, 0], [b([-3, 0, -4], [5, 3, 9], [0, 8])]), part('head', [0, 4, 5], [b([-3.5, 0, 0], [7, 3, 5], [0, 0])]), part('rightWing', [-3, 6, 0], [b([-12, 0, -4], [12, 1, 9], [23, 12])]), part('leftWing', [2, 6, 0], [b([0, 0, -4], [12, 1, 9], [23, 12])])],
  paint: (s) => { const c = '#43518a'; s.fillBox([0, 8], [5, 3, 9], c, 0.08); s.fillBox([0, 0], [7, 3, 5], c, 0.08, (f, x, y) => { if (f === 'front') { s.rect(x + 1, y + 1, 2, 1, '#88ff00'); s.rect(x + 4, y + 1, 2, 1, '#88ff00'); } }); s.fillBox([23, 12], [12, 1, 9], '#3a4878', 0.1); },
  flies: true,
});
def('blaze', {
  tex: [64, 32],
  parts: () => { const P = [part('head', [0, 16, 0], [b([-4, 0, -4], [8, 8, 8], [0, 0])])]; for (let i = 0; i < 12; i++) { const a = i / 4 * Math.PI * 2 / 3 * 3 + (i >= 4 ? 0.4 : 0), r = i < 4 ? 9 : i < 8 ? 7 : 5, y = i < 4 ? 10 : i < 8 ? 5 : 0; P.push(part('rod' + i, [Math.cos(a) * r, y, Math.sin(a) * r], [b([-1, 0, -1], [2, 8, 2], [0, 16])])); } return P; },
  paint: (s) => { s.fillBox([0, 0], [8, 8, 8], '#f6b201', 0.1, (f, x, y) => { if (f === 'front') { s.rect(x + 1, y + 3, 2, 1, '#3a1a00'); s.rect(x + 5, y + 3, 2, 1, '#3a1a00'); } }); s.fillBox([0, 16], [2, 8, 2], '#f8d040', 0.1); },
  flies: true, glow: true,
});
// ---------------------------- feature packs ----------------------------
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

// fallback generic biped for anything else
def('generic', { tex: [64, 64], parts: () => biped({ hat: false }), paint: zombiePaint('#a0a0a0', '#606060', '#404040') });

export function modelFor(type) { return MODELS[type] || MODELS.generic; }

const skinCache = new Map();
export function skinFor(type, variant = '') {
  const key = type + ':' + variant;
  if (skinCache.has(key)) return skinCache.get(key);
  const m = modelFor(type);
  const s = new Skin(m.tex[0], m.tex[1], hashString(key));
  m.paint(s);
  skinCache.set(key, s.c);
  return s.c;
}
export { Skin };
