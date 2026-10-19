// Procedural sound effects and generative music using the Web Audio API.
import { BLOCKS } from '../registry/blocks.js';

const CATEGORY = (name) => {
  if (name.startsWith('ui.')) return 'master';
  if (name.startsWith('music')) return 'music';
  if (name.startsWith('record')) return 'record';
  if (name.startsWith('weather') || name.includes('thunder')) return 'weather';
  if (name.startsWith('block.')) return 'block';
  if (/zombie|skeleton|creeper|spider|enderman|slime|witch|husk|drowned|stray|blaze|phantom|silverfish/.test(name)) return 'hostile';
  if (name.startsWith('entity.player') || name.startsWith('item.') || name.startsWith('entity.generic') || name.startsWith('entity.item') || name.startsWith('entity.experience')) return 'player';
  if (name.startsWith('entity.')) return 'neutral';
  if (name.startsWith('ambient')) return 'ambient';
  return 'master';
};

// material sound settings: [filterType, freq, Q, duration, gain, pitchVar]
const MATERIAL = {
  stone: ['bandpass', 1700, 0.9, 0.11, 0.9], deepslate: ['bandpass', 1200, 1, 0.12, 0.9], wood: ['lowpass', 900, 3, 0.12, 1.0],
  gravel: ['bandpass', 1300, 0.7, 0.14, 0.8], grass: ['highpass', 1800, 0.6, 0.13, 0.55], sand: ['lowpass', 2600, 0.6, 0.14, 0.55],
  snow: ['lowpass', 1400, 0.6, 0.12, 0.5], wool: ['lowpass', 700, 0.5, 0.12, 0.5], glass: ['highpass', 2600, 2, 0.1, 0.7],
  metal: ['bandpass', 2400, 4, 0.18, 0.7], mud: ['lowpass', 600, 2, 0.14, 0.7], ladder: ['lowpass', 1000, 3, 0.1, 0.8],
  slime: ['lowpass', 500, 5, 0.16, 0.8], honey: ['lowpass', 500, 5, 0.16, 0.7], netherrack: ['bandpass', 1400, 1, 0.1, 0.8],
};
function materialOf(def) {
  const s = def.sound || 'stone';
  if (MATERIAL[s]) return s;
  if (/wood|stem|bamboo|cherry|nether_wood|ladder|scaffold/.test(s)) return 'wood';
  if (/grass|moss|roots|fungus|nylium|wart|crop|cherry_leaves|azalea|vine|sweet_berry|lily|cherry_sapling|shroomlight/.test(s)) return 'grass';
  if (/sand|soul/.test(s)) return 'sand';
  if (/gravel/.test(s)) return 'gravel';
  if (/glass|amethyst/.test(s)) return 'glass';
  if (/metal|anvil|chain|lantern|copper/.test(s)) return 'metal';
  if (/wool|candle|cobweb/.test(s)) return 'wool';
  if (/snow/.test(s)) return 'snow';
  if (/mud|packed_mud/.test(s)) return 'mud';
  if (/slime|honey/.test(s)) return 'slime';
  return 'stone';
}

export class Sound {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.gains = {};
    this.musicTimer = 20 * 30;
    this.musicPlaying = false;
    this.rain = null;
    const unlock = () => { this.ensure(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); };
    window.addEventListener('mousedown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);
  }
  ensure() {
    if (this.ctx) return this.ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    } catch { return null; }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.connect(c.destination);
    for (const k of ['music', 'record', 'weather', 'block', 'hostile', 'neutral', 'player', 'ambient', 'voice', 'master']) {
      const g = c.createGain();
      g.connect(this.master);
      this.gains[k] = g;
    }
    this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    return c;
  }
  applyVolumes() {
    if (!this.ctx) return;
    const o = this.game.options;
    this.master.gain.value = o.get('volume_master');
    for (const k of Object.keys(this.gains)) if (k !== 'master') this.gains[k].gain.value = o.get('volume_' + k) ?? 1;
    if (this.gains.master) this.gains.master.gain.value = 1;
  }

  // ------------------------------------------------------------------ primitives
  out(cat, vol, pan) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.value = vol;
    let node = g;
    if (pan !== undefined && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(this.gains[cat] || this.master); }
    else g.connect(this.gains[cat] || this.master);
    return node;
  }
  noise(dest, { dur = 0.1, type = 'bandpass', freq = 1000, Q = 1, attack = 0.002, gain = 1, rate = 1, freqEnd, delay = 0 }) {
    const c = this.ctx, t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = rate;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = Q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }
  tone(dest, { type = 'sine', freq = 440, freqEnd, dur = 0.2, attack = 0.005, gain = 0.5, delay = 0, filter, vibrato }) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + dur);
    if (vibrato) {
      const l = c.createOscillator(); const lg = c.createGain();
      l.frequency.value = vibrato[0]; lg.gain.value = vibrato[1];
      l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05);
    }
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let n = o;
    if (filter) { const f = c.createBiquadFilter(); f.type = filter[0]; f.frequency.value = filter[1]; f.Q.value = filter[2] || 1; o.connect(f); n = f; }
    n.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // ------------------------------------------------------------------ public api
  play(name, vol = 1, pitch = 1) { this.emit(name, vol, pitch, undefined); }
  at(name, x, y, z, vol = 1, pitch = 1) {
    const p = this.game.player;
    if (!p) { this.emit(name, vol, pitch); return; }
    const dx = x - p.x, dy = y - (p.y + p.eyeHeight), dz = z - p.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const range = 16 * Math.max(1, vol);
    if (d > range) return;
    const att = Math.max(0, 1 - d / range);
    // pan relative to view
    const ang = Math.atan2(dx, dz) + p.yaw;
    const pan = this.game.options.get('directionalAudio') || true ? Math.max(-1, Math.min(1, -Math.sin(ang) * Math.min(1, d / 3))) : 0;
    this.emit(name, Math.min(1, vol) * att, pitch, pan);
  }
  blockSound(def, kind, x, y, z, vol = 1, pitch = 1) {
    if (!def || def.sound === 'none') return;
    const m = materialOf(def);
    const mult = kind === 'step' ? 0.15 : kind === 'hit' ? 0.25 : kind === 'fall' ? 0.5 : 1;
    const pm = kind === 'hit' ? 0.5 : kind === 'step' ? 1 : 0.8;
    this.at(`block.${m}.${kind}`, x, y, z, vol * mult, pitch * pm);
  }

  emit(name, vol, pitch, pan) {
    const c = this.ensure();
    if (!c || c.state !== 'running') return;
    if (vol <= 0.001) return;
    const cat = CATEGORY(name);
    const out = this.out(cat, vol, pan);
    const P = pitch * (0.95 + Math.random() * 0.1);
    // block sounds
    const bm = name.match(/^block\.(\w+)\.(break|place|step|hit|fall)$/);
    if (bm) { this.material(out, bm[1], bm[2], P); return; }
    switch (name) {
      case 'ui.click': this.tone(out, { type: 'square', freq: 1400 * P, freqEnd: 900, dur: 0.045, gain: 0.12, filter: ['lowpass', 3000] }); this.noise(out, { dur: 0.03, freq: 3000, gain: 0.15 }); break;
      case 'entity.item.pickup': this.tone(out, { type: 'sine', freq: 500 * P, freqEnd: 1100 * P, dur: 0.09, gain: 0.35 }); break;
      case 'entity.experience_orb.pickup': this.tone(out, { type: 'sine', freq: 1700 * P, dur: 0.25, gain: 0.25 }); this.tone(out, { type: 'sine', freq: 2550 * P, dur: 0.18, gain: 0.1 }); break;
      case 'entity.player.levelup': [523, 659, 784, 1047].forEach((f, i) => this.tone(out, { type: 'triangle', freq: f * P, dur: 0.6, gain: 0.25, delay: i * 0.07 })); break;
      case 'entity.player.hurt': case 'entity.player.hurt_on_fire': case 'entity.player.hurt_drown':
        this.tone(out, { type: 'sawtooth', freq: 260 * P, freqEnd: 140 * P, dur: 0.16, gain: 0.35, filter: ['lowpass', 900, 2] });
        this.noise(out, { dur: 0.08, freq: 600, gain: 0.25, type: 'lowpass' });
        if (name.endsWith('on_fire')) this.noise(out, { dur: 0.3, type: 'highpass', freq: 3000, gain: 0.2 });
        break;
      case 'entity.player.attack.strong': case 'entity.player.attack.weak': case 'entity.player.attack.crit': case 'entity.player.attack.nodamage':
        this.noise(out, { dur: 0.08, freq: name.endsWith('weak') ? 1500 : 900, gain: 0.35, type: 'bandpass' });
        if (name.endsWith('crit')) this.tone(out, { type: 'square', freq: 1800, freqEnd: 900, dur: 0.1, gain: 0.08 });
        break;
      case 'entity.player.attack.sweep': this.noise(out, { dur: 0.25, freq: 800, freqEnd: 3000, gain: 0.25, type: 'bandpass', Q: 2 }); break;
      case 'entity.item.break': this.noise(out, { dur: 0.25, freq: 2500, gain: 0.4, type: 'bandpass', Q: 3 }); this.tone(out, { type: 'square', freq: 700, freqEnd: 200, dur: 0.2, gain: 0.1 }); break;
      case 'entity.generic.eat':
        for (let i = 0; i < 3; i++) this.noise(out, { dur: 0.05, freq: 2200 * P, gain: 0.3, type: 'bandpass', Q: 1, delay: i * 0.035 });
        break;
      case 'entity.generic.drink': for (let i = 0; i < 3; i++) this.tone(out, { type: 'sine', freq: (300 + i * 60) * P, freqEnd: 600 * P, dur: 0.06, gain: 0.25, delay: i * 0.05 }); break;
      case 'entity.player.burp': this.tone(out, { type: 'sawtooth', freq: 110 * P, freqEnd: 80, dur: 0.35, gain: 0.25, filter: ['lowpass', 500, 4], vibrato: [25, 15] }); break;
      case 'entity.generic.explode':
        this.noise(out, { dur: 1.6, type: 'lowpass', freq: 900, freqEnd: 80, gain: 1.0, rate: 0.6 });
        this.tone(out, { type: 'sine', freq: 70, freqEnd: 30, dur: 1.0, gain: 0.8 });
        break;
      case 'entity.generic.small_fall': this.noise(out, { dur: 0.1, type: 'lowpass', freq: 400, gain: 0.5 }); break;
      case 'entity.generic.big_fall': this.noise(out, { dur: 0.2, type: 'lowpass', freq: 300, gain: 0.8 }); this.tone(out, { type: 'sine', freq: 80, freqEnd: 40, dur: 0.2, gain: 0.5 }); break;
      case 'entity.tnt.primed': this.noise(out, { dur: 1.5, type: 'highpass', freq: 2500, freqEnd: 5000, gain: 0.35, attack: 0.3 }); break;
      case 'random.fizz': case 'block.lava.extinguish': case 'block.fire.extinguish': this.noise(out, { dur: 0.5, type: 'highpass', freq: 3500, gain: 0.35 }); break;
      case 'block.door.open': case 'block.door.close': case 'block.fence_gate.open': case 'block.fence_gate.close': case 'block.trapdoor.open': case 'block.trapdoor.close':
        this.noise(out, { dur: 0.12, type: 'lowpass', freq: 700, Q: 4, gain: 0.7 });
        if (name.endsWith('open')) this.tone(out, { type: 'sawtooth', freq: 160 * P, freqEnd: 240 * P, dur: 0.2, gain: 0.08, filter: ['bandpass', 900, 5] });
        break;
      case 'block.chest.open': case 'block.chest.close': case 'block.barrel.open': case 'block.barrel.close':
        this.tone(out, { type: 'sawtooth', freq: (name.endsWith('open') ? 140 : 200) * P, freqEnd: (name.endsWith('open') ? 220 : 120) * P, dur: 0.3, gain: 0.12, filter: ['bandpass', 700, 6] });
        this.noise(out, { dur: 0.1, type: 'lowpass', freq: 600, gain: 0.5, delay: name.endsWith('close') ? 0.2 : 0 });
        break;
      case 'block.lever.click': case 'block.button.click': this.tone(out, { type: 'square', freq: 1000 * P, freqEnd: 600, dur: 0.04, gain: 0.15 }); this.noise(out, { dur: 0.03, freq: 2500, gain: 0.3 }); break;
      case 'block.anvil.land': this.tone(out, { type: 'triangle', freq: 600, dur: 0.6, gain: 0.3 }); this.tone(out, { type: 'triangle', freq: 1430, dur: 0.4, gain: 0.15 }); this.noise(out, { dur: 0.1, freq: 2000, gain: 0.5 }); break;
      case 'entity.arrow.shoot': this.noise(out, { dur: 0.25, type: 'bandpass', freq: 1200, freqEnd: 400, Q: 2, gain: 0.4 }); break;
      case 'entity.arrow.hit': this.noise(out, { dur: 0.06, type: 'lowpass', freq: 1200, gain: 0.5 }); this.tone(out, { type: 'triangle', freq: 300, freqEnd: 120, dur: 0.08, gain: 0.2 }); break;
      case 'entity.snowball.throw': case 'entity.ender_pearl.throw': case 'item.trident.throw': case 'item.crossbow.shoot': this.noise(out, { dur: 0.2, type: 'bandpass', freq: 900, freqEnd: 2000, gain: 0.25 }); break;
      case 'entity.enderman.teleport': this.tone(out, { type: 'sine', freq: 200, freqEnd: 900, dur: 0.4, gain: 0.25, vibrato: [30, 60] }); break;
      case 'item.bucket.fill': case 'item.bucket.empty': case 'item.bottle.fill': for (let i = 0; i < 4; i++) this.tone(out, { type: 'sine', freq: (400 + Math.random() * 400) * P, freqEnd: 900, dur: 0.08, gain: 0.2, delay: i * 0.04 }); break;
      case 'item.bucket.fill_lava': case 'item.bucket.empty_lava': this.noise(out, { dur: 0.35, type: 'lowpass', freq: 500, gain: 0.5 }); break;
      case 'item.hoe.till': case 'item.shovel.flatten': this.noise(out, { dur: 0.15, type: 'lowpass', freq: 1200, gain: 0.6 }); break;
      case 'item.axe.strip': this.noise(out, { dur: 0.2, type: 'bandpass', freq: 900, Q: 3, gain: 0.6 }); break;
      case 'item.flintandsteel.use': case 'item.firecharge.use': this.noise(out, { dur: 0.1, type: 'highpass', freq: 3000, gain: 0.4 }); this.tone(out, { type: 'square', freq: 2500, dur: 0.05, gain: 0.05 }); break;
      case 'item.bone_meal.use': this.noise(out, { dur: 0.15, type: 'highpass', freq: 2500, gain: 0.3 }); break;
      case 'block.pumpkin.carve': this.noise(out, { dur: 0.2, type: 'bandpass', freq: 600, Q: 2, gain: 0.5 }); break;
      case 'item.shield.block': this.noise(out, { dur: 0.1, type: 'lowpass', freq: 800, gain: 0.7 }); break;
      case 'entity.player.splash': case 'entity.generic.splash': this.noise(out, { dur: 0.5, type: 'lowpass', freq: 1500, freqEnd: 400, gain: 0.5 }); break;
      case 'entity.lightning_bolt.thunder': this.noise(out, { dur: 4, type: 'lowpass', freq: 220, freqEnd: 60, gain: 1, attack: 0.05, rate: 0.4 }); break;
      case 'entity.lightning_bolt.impact': this.noise(out, { dur: 0.5, type: 'highpass', freq: 1000, gain: 0.6 }); break;
      case 'block.sweet_berry_bush.pick_berries': this.noise(out, { dur: 0.15, type: 'highpass', freq: 1500, gain: 0.4 }); break;
      case 'item.armor.equip_generic': case 'item.armor.equip_leather': case 'item.armor.equip_iron': case 'item.armor.equip_golden': case 'item.armor.equip_diamond': case 'item.armor.equip_netherite': case 'item.armor.equip_chainmail': case 'item.armor.equip_turtle': case 'item.armor.equip_elytra':
        this.noise(out, { dur: 0.15, type: 'bandpass', freq: name.includes('leather') ? 600 : 2000, Q: 2, gain: 0.4 }); break;
      case 'ambient.cave': {
        const f = 80 + Math.random() * 120;
        this.tone(out, { type: 'sine', freq: f, freqEnd: f * (0.6 + Math.random() * 0.8), dur: 3.5, attack: 1, gain: 0.25, vibrato: [3, 6] });
        this.noise(out, { dur: 3, type: 'bandpass', freq: 300, Q: 8, gain: 0.08, attack: 1 });
        break;
      }
      default: this.mobSound(out, name, P);
    }
  }

  material(out, m, kind, P) {
    const s = MATERIAL[m] || MATERIAL.stone;
    const [ft, freq, Q, dur, gain] = s;
    const d = kind === 'break' ? dur * 1.6 : kind === 'place' ? dur : kind === 'fall' ? dur * 1.2 : dur * 0.8;
    this.noise(out, { dur: d, type: ft, freq: freq * P, Q, gain, rate: P });
    if (kind === 'break') this.noise(out, { dur: d * 0.7, type: ft, freq: freq * 0.7 * P, Q, gain: gain * 0.7, delay: 0.03, rate: P });
    if (m === 'wood') this.tone(out, { type: 'triangle', freq: 220 * P, freqEnd: 160 * P, dur: d, gain: 0.25 });
    if (m === 'glass' && kind === 'break') for (let i = 0; i < 6; i++) this.tone(out, { type: 'sine', freq: 2000 + Math.random() * 4000, dur: 0.15 + Math.random() * 0.2, gain: 0.08, delay: Math.random() * 0.12 });
    if (m === 'metal') { this.tone(out, { type: 'sine', freq: 900 * P, dur: 0.3, gain: 0.12 }); this.tone(out, { type: 'sine', freq: 1460 * P, dur: 0.25, gain: 0.08 }); }
    if (m === 'gravel' || m === 'stone') this.noise(out, { dur: 0.03, type: 'highpass', freq: 3000, gain: 0.3 * gain });
  }

  mobSound(out, name, P) {
    const mob = name.split('.')[1];
    const kind = name.split('.')[2] || 'ambient';
    const hurt = kind === 'hurt', death = kind === 'death';
    const pm = hurt ? 1.2 : death ? 0.8 : 1;
    const dur = death ? 1.4 : 1;
    switch (mob) {
      case 'pig':
        for (let i = 0; i < (hurt ? 1 : 2); i++) this.tone(out, { type: 'sawtooth', freq: 300 * P * pm, freqEnd: 240 * P * pm, dur: 0.14 * dur, gain: 0.3, delay: i * 0.17, filter: ['bandpass', 900, 3] });
        break;
      case 'cow': case 'mooshroom':
        this.tone(out, { type: 'sawtooth', freq: 130 * P * pm, freqEnd: 100 * P * pm, dur: (hurt ? 0.4 : 1.1) * dur, gain: 0.35, attack: 0.08, filter: ['bandpass', 450, 3], vibrato: [6, 4] });
        break;
      case 'sheep': this.tone(out, { type: 'sawtooth', freq: 420 * P * pm, dur: (hurt ? 0.35 : 0.8) * dur, gain: 0.25, attack: 0.03, filter: ['bandpass', 1100, 4], vibrato: [22, 25] }); break;
      case 'chicken': for (let i = 0; i < (hurt ? 2 : 3); i++) this.tone(out, { type: 'square', freq: (900 + i * 150) * P * pm, freqEnd: 700 * P, dur: 0.06, gain: 0.12, delay: i * 0.09, filter: ['bandpass', 1500, 3] }); break;
      case 'wolf': this.tone(out, { type: 'square', freq: 380 * P * pm, freqEnd: 260 * P, dur: 0.12, gain: 0.2, filter: ['bandpass', 800, 2] }); break;
      case 'cat': case 'ocelot': this.tone(out, { type: 'sawtooth', freq: 700 * P, freqEnd: 480 * P, dur: 0.45, gain: 0.15, attack: 0.05, filter: ['bandpass', 1400, 4] }); break;
      case 'villager': case 'zombie_villager': case 'witch': case 'wandering_trader':
        this.tone(out, { type: 'sawtooth', freq: (mob === 'witch' ? 330 : 200) * P * pm, freqEnd: 170 * P, dur: 0.35 * dur, gain: 0.2, filter: ['bandpass', 700, 5], vibrato: [7, 10] }); break;
      case 'zombie': case 'husk': case 'drowned': case 'zombified_piglin':
        this.tone(out, { type: 'sawtooth', freq: 95 * P * pm, freqEnd: 70 * P, dur: 0.9 * dur, gain: 0.35, attack: 0.1, filter: ['lowpass', 500, 2], vibrato: [5, 6] });
        this.noise(out, { dur: 0.8 * dur, type: 'lowpass', freq: 400, gain: 0.15, attack: 0.1 });
        break;
      case 'skeleton': case 'stray': case 'wither_skeleton':
        for (let i = 0; i < 5; i++) this.noise(out, { dur: 0.03, type: 'bandpass', freq: 2500 * P, Q: 6, gain: 0.35, delay: i * 0.05 + Math.random() * 0.02 });
        break;
      case 'creeper': if (kind === 'primed') this.noise(out, { dur: 1.4, type: 'highpass', freq: 2200, gain: 0.45, attack: 0.15 }); else this.noise(out, { dur: 0.3, type: 'lowpass', freq: 800, gain: 0.4 }); break;
      case 'spider': case 'cave_spider': this.noise(out, { dur: 0.35, type: 'bandpass', freq: 3000, Q: 3, gain: 0.25 }); for (let i = 0; i < 3; i++) this.noise(out, { dur: 0.02, freq: 1500, gain: 0.3, delay: 0.1 + i * 0.06 }); break;
      case 'enderman': this.tone(out, { type: 'sine', freq: 300 * P, freqEnd: 120, dur: 0.8, gain: 0.25, vibrato: [40, 80] }); break;
      case 'slime': case 'magma_cube': this.noise(out, { dur: 0.2, type: 'lowpass', freq: 500 * P, Q: 6, gain: 0.5 }); break;
      case 'bat': this.tone(out, { type: 'sine', freq: 3500 * P, freqEnd: 4200, dur: 0.06, gain: 0.08 }); break;
      case 'squid': case 'glow_squid': this.noise(out, { dur: 0.3, type: 'lowpass', freq: 600, gain: 0.2 }); break;
      case 'horse': case 'donkey': case 'llama': this.tone(out, { type: 'sawtooth', freq: 500 * P, freqEnd: 250, dur: 0.6, gain: 0.2, filter: ['bandpass', 1200, 4], vibrato: [18, 40] }); break;
      case 'iron_golem': this.noise(out, { dur: 0.3, type: 'lowpass', freq: 300, gain: 0.5 }); this.tone(out, { type: 'triangle', freq: 120, dur: 0.3, gain: 0.3 }); break;
      case 'fox': this.tone(out, { type: 'square', freq: 900 * P, freqEnd: 600, dur: 0.1, gain: 0.12 }); break;
      case 'goat': this.tone(out, { type: 'sawtooth', freq: 380 * P, dur: 0.5, gain: 0.2, filter: ['bandpass', 1000, 4], vibrato: [20, 30] }); break;
      case 'polar_bear': this.tone(out, { type: 'sawtooth', freq: 140 * P, dur: 0.6, gain: 0.3, filter: ['lowpass', 600, 2] }); break;
      case 'rabbit': this.tone(out, { type: 'sine', freq: 1500 * P, dur: 0.05, gain: 0.08 }); break;
      case 'blaze': this.noise(out, { dur: 0.6, type: 'bandpass', freq: 900, gain: 0.25 }); break;
      case 'phantom': this.tone(out, { type: 'sawtooth', freq: 600, freqEnd: 300, dur: 0.6, gain: 0.15, filter: ['bandpass', 1500, 6] }); break;
      // ---- feature packs: mob sounds ----
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

      default: this.noise(out, { dur: 0.1, type: 'bandpass', freq: 1000, gain: 0.2 });
    }
  }

  note(n, below, x, y, z) {
    const c = this.ensure(); if (!c) return;
    const freq = 185 * Math.pow(2, n / 12);
    const out = this.out('record', 1, 0);
    const m = below ? materialOf(below) : 'wood';
    const type = m === 'wood' ? 'triangle' : m === 'stone' ? 'square' : m === 'sand' ? 'sawtooth' : m === 'glass' ? 'sine' : 'triangle';
    this.tone(out, { type, freq: m === 'wood' ? freq / 2 : m === 'stone' ? freq / 4 : freq, dur: 0.8, gain: 0.2, filter: ['lowpass', 3000] });
    void x; void y; void z;
  }

  // ------------------------------------------------------------------ music
  tick() {
    const g = this.game;
    if (!this.ctx || this.ctx.state !== 'running') return;
    // rain loop
    const rain = g.inWorld ? g.rainLevel || 0 : 0;
    const p = g.player;
    const exposed = p && g.world ? g.world.rainHeight(Math.floor(p.x), Math.floor(p.z)) < p.y + 12 : false;
    this.setRain(rain * (exposed ? 1 : 0.3));
    // ambient cave sounds
    if (p && g.world && Math.random() < 1 / 6000) {
      const l = g.world.getLight(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z));
      if ((l >> 4) < 4 && (l & 15) < 4) this.play('ambient.cave', 0.7, 1);
    }
    // footsteps
    if (p && !p.dead && p.onGround && !p.sneaking && g.inWorld) {
      const moved = Math.hypot(p.x - p.prevX, p.z - p.prevZ);
      this.stepAcc = (this.stepAcc || 0) + moved;
      if (this.stepAcc > (p.sprinting ? 1.6 : 1.4)) {
        this.stepAcc = 0;
        const id = g.world.getBlock(Math.floor(p.x), Math.floor(p.y - 0.2), Math.floor(p.z));
        if (id) this.blockSound(BLOCKS[id], 'step', p.x, p.y, p.z, 1, 1);
      }
    }
    // music scheduling
    if (--this.musicTimer <= 0 && !this.musicPlaying && this.game.options.get('volume_music') > 0) {
      this.playMusic();
      this.musicTimer = 20 * (300 + Math.floor(Math.random() * 600));
    }
  }
  setRain(level) {
    const c = this.ctx;
    if (level > 0.01 && !this.rain) {
      const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.5;
      const g = c.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(this.gains.weather);
      src.start();
      this.rain = { src, g };
    }
    if (this.rain) {
      this.rain.g.gain.value = level * 0.25;
      if (level <= 0.01) { this.rain.src.stop(); this.rain = null; }
    }
  }
  startTitleMusic() { if (!this.musicPlaying) this.playMusic(); }
  playMusic() {
    const c = this.ensure();
    if (!c || c.state !== 'running') return;
    this.musicPlaying = true;
    const out = c.createGain(); out.gain.value = 0.22; out.connect(this.gains.music);
    this.musicOut = out;
    // a gentle generative piano piece: slow chords and wandering melody
    const keys = [[0, 4, 7, 11], [-3, 0, 4, 7], [5, 9, 12, 16], [2, 5, 9, 12], [-5, -1, 2, 7], [7, 11, 14, 17]];
    const scale = [0, 2, 4, 7, 9, 11, 12, 14, 16];
    const root = 48 + [0, 2, 5, 7][Math.floor(Math.random() * 4)];
    let t = 0.5;
    const bars = 12 + Math.floor(Math.random() * 8);
    const piano = (midi, time, dur, gain) => {
      const f = 440 * Math.pow(2, (midi - 69) / 12);
      const st = c.currentTime + time;
      for (const [mult, g] of [[1, 1], [2, 0.3], [3, 0.12], [4, 0.05]]) {
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f * mult;
        const gg = c.createGain();
        gg.gain.setValueAtTime(0.0001, st);
        gg.gain.exponentialRampToValueAtTime(gain * g, st + 0.01);
        gg.gain.exponentialRampToValueAtTime(0.0001, st + dur);
        o.connect(gg); gg.connect(out);
        o.start(st); o.stop(st + dur + 0.1);
      }
    };
    for (let b = 0; b < bars; b++) {
      const chord = keys[Math.floor(Math.random() * keys.length)];
      chord.forEach((n, i) => piano(root + n - 12, t + i * 0.12, 4.5, 0.12));
      const notes = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < notes; i++) {
        if (Math.random() < 0.25) continue;
        piano(root + 12 + scale[Math.floor(Math.random() * scale.length)], t + 0.5 + i * (3.2 / notes) + Math.random() * 0.2, 3, 0.16);
      }
      t += 4;
    }
    this.musicEnd = setTimeout(() => { this.musicPlaying = false; }, t * 1000 + 3000);
  }
  stopMusic() {
    if (this.musicOut) { try { this.musicOut.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5); } catch { /* ignore */ } this.musicOut = null; }
    clearTimeout(this.musicEnd);
    this.musicPlaying = false;
    this.musicTimer = 20 * 60;
  }
  playDisc(disc, x, y, z) {
    this.stopDisc();
    const c = this.ensure(); if (!c) return;
    const out = c.createGain(); out.gain.value = 0.3; out.connect(this.gains.record);
    this.discOut = out;
    // a short procedural tune seeded by the disc name
    let h = 0; for (const ch of disc) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const notes = [0, 2, 4, 5, 7, 9, 11, 12];
    let t = 0.2;
    for (let i = 0; i < 64; i++) {
      h = (h * 1103515245 + 12345) >>> 0;
      const n = notes[h % notes.length] + 60 + ((h >> 8) % 2) * 12;
      const f = 440 * Math.pow(2, (n - 69) / 12);
      const o = c.createOscillator(); o.type = ['square', 'triangle', 'sawtooth'][h % 3];
      o.frequency.value = f;
      const g = c.createGain();
      const st = c.currentTime + t;
      g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(0.15, st + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, st + 0.3);
      o.connect(g); g.connect(out); o.start(st); o.stop(st + 0.35);
      t += 0.25;
    }
    void x; void y; void z;
  }
  stopDisc() { if (this.discOut) { try { this.discOut.disconnect(); } catch { /* ignore */ } this.discOut = null; } }
  stopAll() { this.stopMusic(); this.stopDisc(); if (this.rain) { this.rain.src.stop(); this.rain = null; } }
}
