// Chat commands modelled on Minecraft Java Edition's command syntax and feedback messages.
import { ITEM, ITEMS } from '../registry/items.js';
import { BLOCK, BLOCKS } from '../registry/blocks.js';
import { BIOMES } from '../world/biomes.js';
import { EFFECTS } from '../entity/living.js';
import { MOBS } from '../entity/mobs.js';
import { ItemStack } from './itemstack.js';
import { PrimedTnt, XpOrb } from '../entity/entity.js';
import { MIN_Y, MAX_Y, titleCase } from '../core/util.js';
import { ENCHANTMENTS, ENCHANTMENT_IDS, canEnchant, addEnchantment, enchantmentLine, getEnchantments, exclusive } from './enchantments.js';

const MODES = ['survival', 'creative', 'adventure', 'spectator'];
const MODE_NAMES = ['Survival Mode', 'Creative Mode', 'Adventure Mode', 'Spectator Mode'];
const DIFFS = ['peaceful', 'easy', 'normal', 'hard'];
const ENCHANTS = ENCHANTMENT_IDS;
const PARTICLES = ['smoke', 'large_smoke', 'flame', 'soul_fire_flame', 'lava', 'bubble', 'crit', 'heart', 'angry_villager', 'happy_villager', 'note', 'portal', 'dust', 'dripping_water', 'dripping_lava', 'splash', 'explosion', 'poof', 'effect', 'campfire_cosy_smoke', 'sweep_attack', 'rain', 'snowflake'];
const PARTICLE_MAP = { soul_fire_flame: 'soul_flame', dust: 'redstone', dripping_water: 'drip_water', dripping_lava: 'drip_lava', campfire_cosy_smoke: 'campfire_smoke', sweep_attack: 'sweep', snowflake: 'snow', explosion_emitter: 'explosion' };
const SUMMONABLE = [...Object.keys(MOBS), 'tnt', 'lightning_bolt', 'experience_orb', 'item'];
const NO_CHEATS = new Set(['help', 'me', 'msg', 'tell', 'w', 'list', 'random', 'trigger', 'teammsg', 'tm']);

const ALL = ['advancement', 'attribute', 'clear', 'clone', 'damage', 'data', 'defaultgamemode', 'difficulty', 'effect', 'enchant', 'execute', 'experience', 'fill', 'fillbiome',
  'forceload', 'function', 'gamemode', 'gamerule', 'give', 'help', 'item', 'kill', 'list', 'locate', 'loot', 'me', 'msg', 'particle', 'place', 'playsound', 'random', 'recipe',
  'reload', 'ride', 'save-all', 'save-off', 'save-on', 'say', 'schedule', 'scoreboard', 'seed', 'setblock', 'setworldspawn', 'spawnpoint', 'spectate', 'spreadplayers',
  'stop', 'stopsound', 'summon', 'tag', 'team', 'teammsg', 'teleport', 'tell', 'tellraw', 'time', 'title', 'tm', 'tp', 'trigger', 'w', 'weather', 'worldborder', 'xp'];

const HELP = {
  clear: '/clear [<targets>] [<item>] [<maxCount>]', clone: '/clone <begin> <end> <destination> [replace|masked]', damage: '/damage <target> <amount>',
  defaultgamemode: '/defaultgamemode <gamemode>', difficulty: '/difficulty [peaceful|easy|normal|hard]', effect: '/effect (clear|give) ...', enchant: '/enchant <targets> <enchantment> [<level>]',
  experience: '/experience (add|query|set) ...', fill: '/fill <from> <to> <block> [destroy|hollow|keep|outline|replace]', gamemode: '/gamemode <gamemode> [<target>]',
  gamerule: '/gamerule <rule> [<value>]', give: '/give <targets> <item> [<count>]', help: '/help [<command>]', kill: '/kill [<targets>]', list: '/list',
  locate: '/locate biome <biome>', me: '/me <action>', msg: '/msg <targets> <message>', particle: '/particle <name> [<pos>]', playsound: '/playsound <sound> [<source>] [<targets>]',
  random: '/random (value|roll) <range>', 'save-all': '/save-all', say: '/say <message>', seed: '/seed', setblock: '/setblock <pos> <block> [destroy|keep|replace]',
  setworldspawn: '/setworldspawn [<pos>]', spawnpoint: '/spawnpoint [<targets>] [<pos>]', stop: '/stop', summon: '/summon <entity> [<pos>]', teleport: '/teleport ...',
  tell: '/tell <targets> <message>', tellraw: '/tellraw <targets> <message>', time: '/time (add|query|set) ...', title: '/title <targets> (clear|reset|title|subtitle|actionbar|times) ...',
  tp: '/tp ...', w: '/w <targets> <message>', weather: '/weather (clear|rain|thunder) [<duration>]', xp: '/xp (add|query|set) ...',
};

class CommandError extends Error {}
const fail = (msg) => { throw new CommandError(msg); };
const stripNs = (s) => (s || '').replace(/^minecraft:/, '').toLowerCase();

function tokenize(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    while (s[i] === ' ') i++;
    if (i >= s.length) break;
    let j = i, depth = 0, quote = null;
    while (j < s.length) {
      const c = s[j];
      if (quote) { if (c === '\\') { j += 2; continue; } if (c === quote) quote = null; }
      else if (c === '"' || c === '\'') quote = c;
      else if (c === '[' || c === '{') depth++;
      else if (c === ']' || c === '}') depth--;
      else if (c === ' ' && depth <= 0) break;
      j++;
    }
    out.push(s.slice(i, j));
    i = j;
  }
  return out;
}
const unquote = (s) => (s && (s[0] === '"' || s[0] === '\'') && s[s.length - 1] === s[0] ? s.slice(1, -1) : s);
const fmt = (n) => (Math.round(n * 100) / 100).toFixed(Number.isInteger(n) ? 1 : 2).replace(/0$/, '').replace(/\.$/, '.0');

export class Commands {
  constructor(game) { this.game = game; }
  get p() { return this.game.player; }

  out(msg, color) { if (this.game.rules.sendCommandFeedback !== false || color === 'c') this.game.chat(msg, color); }
  err(msg) { this.game.chat(msg, 'c'); }

  execute(text, silent = false) {
    const g = this.game;
    const raw = text.trim().replace(/^\//, '');
    const args = tokenize(raw);
    if (!args.length) return false;
    const name = stripNs(args.shift());
    const fn = this['cmd_' + name.replace(/-/g, '_')];
    if (!g.info.allowCommands && !NO_CHEATS.has(name)) {
      this.err('Unknown or incomplete command, see below for error');
      this.game.chat(`§7${raw}§c§n<--[HERE]`);
      return false;
    }
    if (!fn) {
      if (ALL.includes(name)) { this.err(`/${name} is not available in Minecraft_Lite yet`); return false; }
      this.err('Unknown or incomplete command, see below for error');
      this.game.chat(`§7${raw}§c§n<--[HERE]`);
      return false;
    }
    const prev = this.silent;
    this.silent = silent;
    try {
      const r = fn.call(this, args);
      return r !== false;
    } catch (e) {
      if (e instanceof CommandError) this.err(e.message);
      else { console.error(e); this.err('An unexpected error occurred trying to execute that command'); }
      return false;
    } finally { this.silent = prev; }
  }
  feedback(msg) { if (!this.silent) this.out(msg); }

  // ------------------------------------------------------------------ argument parsing
  coord(s, base, rel = true) {
    if (s === undefined) fail('Incorrect argument for command');
    if (s.startsWith('~')) { const r = s.slice(1); return base + (r ? Number(r) : 0); }
    const v = Number(s);
    if (!Number.isFinite(v)) fail(`Expected a number but found '${s}'`);
    return v;
    void rel;
  }
  // parse three coordinates (supports ~ relative and ^ local), returns [x,y,z]
  pos(args, i, center = false) {
    const p = this.p;
    const a = args.slice(i, i + 3);
    if (a.length < 3) fail('Incomplete (expected 3 coordinates)');
    if (a.some((s) => s.startsWith('^'))) {
      if (!a.every((s) => s.startsWith('^'))) fail('Cannot mix world & local coordinates (everything must either use ^ or not)');
      const [l, u, f] = a.map((s) => Number(s.slice(1) || 0));
      const yaw = p.yaw, pitch = p.pitch;
      const fw = [-Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
      const up = [-Math.sin(yaw) * -Math.sin(pitch), Math.cos(pitch), Math.cos(yaw) * -Math.sin(pitch)];
      const left = [Math.cos(yaw), 0, Math.sin(yaw)];
      const ey = p.y + p.eyeHeight;
      return [p.x + left[0] * l + up[0] * u + fw[0] * f, ey + left[1] * l + up[1] * u + fw[1] * f, p.z + left[2] * l + up[2] * u + fw[2] * f];
    }
    const x = this.coord(a[0], p.x), y = this.coord(a[1], p.y), z = this.coord(a[2], p.z);
    if (center) return [/^-?\d+$/.test(a[0]) ? x + 0.5 : x, y, /^-?\d+$/.test(a[2]) ? z + 0.5 : z];
    return [x, y, z];
  }
  blockPos(args, i) { return this.pos(args, i).map(Math.floor); }
  int(s, min = -Infinity, max = Infinity, what = 'Integer') {
    const v = Number(s);
    if (s === undefined || !Number.isInteger(v)) fail(`Invalid integer '${s ?? ''}'`);
    if (v < min) fail(`${what} must not be less than ${min}, found ${v}`);
    if (v > max) fail(`${what} must not be more than ${max}, found ${v}`);
    return v;
  }
  num(s) { const v = Number(s); if (s === undefined || !Number.isFinite(v)) fail(`Invalid float '${s ?? ''}'`); return v; }
  time(s) {
    const m = /^(-?\d*\.?\d+)([tsd]?)$/.exec(s || '');
    if (!m) fail(`Invalid time '${s ?? ''}'`);
    const v = Number(m[1]) * (m[2] === 's' ? 20 : m[2] === 'd' ? 24000 : 1);
    return Math.round(v);
  }
  item(s) {
    const n = stripNs((s || '').replace(/\{.*$/, '').replace(/\[.*$/, ''));
    const it = ITEM[n];
    if (!it) fail(`Unknown item 'minecraft:${n}'`);
    return it;
  }
  block(s) {
    const n = stripNs((s || '').replace(/\{.*$/, '').replace(/\[.*$/, ''));
    if (n === 'air' || n === 'cave_air' || n === 'void_air') return { id: 0, meta: 0, def: BLOCKS[0] };
    const b = BLOCK[n];
    if (!b) fail(`Unknown block type 'minecraft:${n}'`);
    let meta = 0;
    const st = /\[(.*)\]/.exec(s);
    if (st) {
      const props = Object.fromEntries(st[1].split(',').map((kv) => kv.split('=').map((x) => x.trim())));
      const hf = { south: 0, west: 1, north: 2, east: 3 };
      if (props.facing && hf[props.facing] !== undefined) meta = hf[props.facing];
      if (b.kind === 'slab' && props.type) meta = { bottom: 0, top: 1, double: 2 }[props.type] ?? 0;
      if (b.kind === 'pillar' && props.axis) meta = { y: 0, x: 1, z: 2 }[props.axis] ?? 0;
      if (props.age && (b.kind === 'crop' || b.kind === 'stem')) meta = Number(props.age) | 0;
      if (props.half === 'top' && (b.kind === 'stairs' || b.kind === 'trapdoor')) meta |= b.kind === 'stairs' ? 4 : 8;
      if (props.lit === 'true') meta |= 1;
      if (props.level && b.kind === 'liquid') meta = Number(props.level) | 0;
    }
    return { id: b.id, meta, def: b };
  }

  // entity selectors: @p @s @a @r @e with [type=,distance=,limit=,sort=,name=], or a player name
  targets(s, playersOnly = false, allowEmpty = false) {
    const g = this.game, p = this.p;
    if (s === undefined) return [p];
    if (!s.startsWith('@')) {
      if (s.toLowerCase() === p.name.toLowerCase()) return [p];
      fail('No player was found');
    }
    const kind = s[1];
    if (!'psarne'.includes(kind)) fail(`Unknown selector type '${s.slice(0, 2)}'`);
    let list;
    if (kind === 's' || kind === 'p' || kind === 'a' || kind === 'r') list = p.dead && kind !== 'a' && kind !== 's' ? [] : [p];
    else list = g.entities.filter((e) => !e.removed && !(e.dead && e !== p));
    const opts = {};
    const m = /^@[a-z]\[(.*)\]$/.exec(s);
    if (m) for (const kv of m[1].split(',')) { const [k, v] = kv.split('=').map((x) => x && x.trim()); if (k) opts[k] = v; }
    if (opts.type) {
      let t = stripNs(opts.type), neg = false;
      if (t.startsWith('!')) { neg = true; t = stripNs(t.slice(1)); }
      list = list.filter((e) => (entityType(e) === t) !== neg);
    }
    if (opts.name) { const n = unquote(opts.name); list = list.filter((e) => (e.isPlayer ? e.name : e.customName || e.displayName) === n); }
    if (opts.distance) {
      const [a, b] = opts.distance.includes('..') ? opts.distance.split('..').map((x) => (x === '' ? null : Number(x))) : [Number(opts.distance), Number(opts.distance)];
      list = list.filter((e) => { const d = Math.sqrt(e.distSq(p)); return (a === null || d >= a) && (b === null || d <= b); });
    }
    if (opts.gamemode) list = list.filter((e) => e.isPlayer && MODES[e.gameMode] === opts.gamemode);
    if (kind === 'n' || opts.sort === 'nearest') list.sort((a, b) => a.distSq(p) - b.distSq(p));
    if (opts.sort === 'furthest') list.sort((a, b) => b.distSq(p) - a.distSq(p));
    if (opts.sort === 'random' || kind === 'r') list.sort(() => Math.random() - 0.5);
    if (opts.limit) list = list.slice(0, Math.max(1, Number(opts.limit) | 0));
    if (kind === 'p' || kind === 'r' || kind === 'n') list = list.slice(0, 1);
    if (playersOnly && list.some((e) => !e.isPlayer)) fail('Only players may be affected by this command, but the provided selector includes entities');
    if (!list.length && !allowEmpty) fail(playersOnly || kind === 'p' || kind === 'a' || kind === 'r' ? 'No player was found' : 'No entity was found');
    return list;
  }
  nameOf(e) { return e.isPlayer ? e.name : e.customName || e.displayName || titleCase(entityType(e)); }
  namesOf(list) { return list.length === 1 ? this.nameOf(list[0]) : `${list.length} entities`; }

  // ------------------------------------------------------------------ commands
  cmd_help(args) {
    if (args[0]) {
      const c = stripNs(args[0]);
      if (!HELP[c]) fail('Unknown command or insufficient permissions');
      this.game.chat(HELP[c]);
      return;
    }
    const names = Object.keys(HELP).filter((n) => this.game.info.allowCommands || NO_CHEATS.has(n));
    for (const n of names) this.game.chat(HELP[n]);
  }

  cmd_gamemode(args) {
    const mode = MODES.indexOf(stripNs(args[0]));
    if (mode < 0) fail(args[0] ? `Unknown game mode '${args[0]}'` : 'Unknown or incomplete command, see below for error');
    for (const p of this.targets(args[1], true)) {
      if (p.gameMode === mode) continue;
      p.setGameMode(mode);
      if (mode === 3) p.flying = true;
      this.game.info.gameMode = mode;
      this.feedback(args[1] ? `Set ${p.name}'s game mode to ${MODE_NAMES[mode]}` : `Set own game mode to ${MODE_NAMES[mode]}`);
    }
  }
  cmd_defaultgamemode(args) {
    const mode = MODES.indexOf(stripNs(args[0]));
    if (mode < 0) fail(`Unknown game mode '${args[0] ?? ''}'`);
    this.game.info.defaultGameMode = mode;
    this.feedback(`The default game mode is now ${MODE_NAMES[mode]}`);
  }
  cmd_difficulty(args) {
    const g = this.game;
    if (!args[0]) { this.out(`The difficulty is ${titleCase(DIFFS[g.difficulty])}`); return; }
    const d = DIFFS.indexOf(stripNs(args[0]));
    if (d < 0) fail(`Invalid difficulty '${args[0]}'`);
    if (g.info.hardcore) fail('Difficulty cannot be changed in Hardcore');
    if (d === g.difficulty) fail(`The difficulty did not change; it is already set to ${titleCase(DIFFS[d])}`);
    g.difficulty = d; g.info.difficulty = d;
    this.feedback(`The difficulty has been set to ${titleCase(DIFFS[d])}`);
  }
  cmd_time(args) {
    const g = this.game;
    const sub = args[0];
    const named = { day: 1000, noon: 6000, night: 13000, midnight: 18000, sunrise: 23000, sunset: 12000 };
    if (sub === 'set') {
      const t = named[args[1]] !== undefined ? named[args[1]] : this.time(args[1]);
      g.dayTime = t;
      this.feedback(`Set the time to ${t}`);
    } else if (sub === 'add') {
      const t = this.time(args[1]);
      g.dayTime += t;
      this.feedback(`Set the time to ${g.dayTime % 24000}`);
    } else if (sub === 'query') {
      const q = args[1];
      if (q === 'daytime') this.out(`The time is ${Math.floor(g.dayTime % 24000)}`);
      else if (q === 'gametime') this.out(`The time is ${g.world.time}`);
      else if (q === 'day') this.out(`The time is ${Math.floor(g.dayTime / 24000)}`);
      else fail('Incorrect argument for command');
    } else fail('Unknown or incomplete command, see below for error');
  }
  cmd_weather(args) {
    const g = this.game;
    const w = stripNs(args[0]);
    const dur = args[1] ? this.time(args[1]) : null;
    if (w === 'clear') { g.raining = false; g.thundering = false; g.rainTime = dur ?? 6000 + Math.floor(Math.random() * 12000); g.thunderTime = g.rainTime; this.feedback('Set the weather to clear'); }
    else if (w === 'rain') { g.raining = true; g.thundering = false; g.rainTime = dur ?? 6000 + Math.floor(Math.random() * 18000); this.feedback('Set the weather to rain'); }
    else if (w === 'thunder') { g.raining = true; g.thundering = true; g.rainTime = g.thunderTime = dur ?? 3600 + Math.floor(Math.random() * 12000); this.feedback('Set the weather to rain & thunder'); }
    else fail('Unknown or incomplete command, see below for error');
  }
  cmd_tp(args) { return this.cmd_teleport(args); }
  cmd_teleport(args) {
    if (!args.length) fail('Unknown or incomplete command, see below for error');
    const isCoord = (s) => s !== undefined && /^[~^]?-?\d*\.?\d*$/.test(s);
    let who, dest, rot = null;
    if (args.length === 1) { who = [this.p]; const t = this.targets(args[0])[0]; dest = [t.x, t.y, t.z]; rot = [t.yaw, t.pitch]; }
    else if (args.length >= 3 && isCoord(args[0]) && isCoord(args[1]) && isCoord(args[2])) { who = [this.p]; dest = this.pos(args, 0, true); if (args[3]) rot = [this.coord(args[3], this.p.yaw * 180 / Math.PI) * Math.PI / 180, this.coord(args[4] || '~', this.p.pitch * 180 / Math.PI) * Math.PI / 180]; }
    else {
      who = this.targets(args[0]);
      if (args.length === 2) { const t = this.targets(args[1])[0]; dest = [t.x, t.y, t.z]; }
      else { dest = this.pos(args, 1, true); if (args[4]) rot = [this.num(args[4]) * Math.PI / 180, this.num(args[5] || '0') * Math.PI / 180]; }
    }
    const [x, y, z] = dest;
    if (y < MIN_Y - 64 || y > MAX_Y + 4096 || Math.abs(x) > 3e7 || Math.abs(z) > 3e7) fail('Invalid position for teleport');
    for (const e of who) {
      e.teleport(x, y, z);
      if (rot) { e.yaw = rot[0]; e.pitch = rot[1]; }
      if (e === this.p) this.game.chunkManager.ensure && this.game.chunkManager.ensure(x, z, 1);
    }
    if (args.length === 1 || (args.length === 2 && !isCoord(args[1]))) this.feedback(`Teleported ${this.namesOf(who)} to ${this.nameOf(this.targets(args[args.length - 1])[0])}`);
    else this.feedback(`Teleported ${this.namesOf(who)} to ${fmt(x)}, ${fmt(y)}, ${fmt(z)}`);
  }
  cmd_give(args) {
    const players = this.targets(args[0], true);
    const it = this.item(args[1]);
    const count = args[2] !== undefined ? this.int(args[2], 1, 6400, 'Integer') : 1;
    const g = this.game;
    for (const p of players) {
      let left = count;
      while (left > 0) {
        const n = Math.min(left, it.maxStack);
        const s = new ItemStack(it, n);
        const rest = p.inventory.add(s);
        if (rest > 0) { const d = g.dropItem(p.x, p.y + 0.5, p.z, new ItemStack(it, rest), { pickupDelay: 0 }); void d; }
        left -= n;
      }
      g.sound.play('entity.item.pickup', 0.2, ((Math.random() - Math.random()) * 0.7 + 1) * 2);
    }
    this.feedback(`Gave ${count} [${it.displayName}] to ${this.namesOf(players)}`);
  }
  cmd_clear(args) {
    const players = this.targets(args[0], true);
    const it = args[1] ? this.item(args[1]) : null;
    let max = args[2] !== undefined ? this.int(args[2], 0) : Infinity;
    let total = 0;
    for (const p of players) {
      const inv = p.inventory;
      for (let i = 0; i < inv.slots.length; i++) {
        const s = inv.slots[i];
        if (!s || (it && s.item !== it)) continue;
        if (max === 0) { total += s.count; continue; }
        const n = Math.min(s.count, max - total);
        if (n <= 0) break;
        s.count -= n; total += n;
        if (s.count <= 0) inv.slots[i] = null;
      }
    }
    if (total === 0) fail(`No items were found on player ${this.namesOf(players)}`);
    if (max === 0) this.feedback(`Found ${total} matching item(s) on player ${this.namesOf(players)}`);
    else this.feedback(`Removed ${total} item(s) from player ${this.namesOf(players)}`);
  }
  cmd_kill(args) {
    const list = this.targets(args[0] || '@s');
    for (const e of list) {
      if (e.hurt && (e.isPlayer || e.mobType)) e.hurt({ type: 'kill', bypassArmor: true }, 1e9);
      else e.remove();
    }
    this.feedback(list.length === 1 ? `Killed ${this.nameOf(list[0])}` : `Killed ${list.length} entities`);
  }
  cmd_damage(args) {
    const t = this.targets(args[0])[0];
    const amt = this.num(args[1]);
    if (!t.hurt || !t.hurt({ type: stripNs(args[2] || 'generic') === 'fall' ? 'fall' : 'magic' }, amt)) fail('Target either cannot take damage or the damage was too low');
    this.feedback(`Applied ${amt} damage to ${this.nameOf(t)}`);
  }
  cmd_summon(args) {
    const g = this.game;
    const t = stripNs(args[0]);
    if (!t) fail('Unknown or incomplete command, see below for error');
    const [x, y, z] = args.length >= 4 ? this.pos(args, 1, true) : [this.p.x, this.p.y, this.p.z];
    if (!g.world.isLoaded(Math.floor(x), Math.floor(z))) fail('Invalid position for summon');
    let e;
    const nbt = args.slice(4).join(' ');
    if (t === 'tnt') { e = new PrimedTnt(g, x, y, z, /Fuse:(\d+)/.test(nbt) ? Number(/Fuse:(\d+)/.exec(nbt)[1]) : 80); g.spawn(e); g.sound.at('entity.tnt.primed', x, y, z); }
    else if (t === 'lightning_bolt') { g.lightning(Math.floor(x), Math.floor(y), Math.floor(z)); e = { displayName: 'Lightning Bolt' }; }
    else if (t === 'experience_orb') { e = new XpOrb(g, x, y, z, /Value:(\d+)/.test(nbt) ? Number(/Value:(\d+)/.exec(nbt)[1]) : 1); g.spawn(e); e.displayName = 'Experience Orb'; }
    else if (MOBS[t]) {
      const opts = { fromEgg: false, persistent: /PersistenceRequired:1b?/.test(nbt) };
      if (/IsBaby:1b?|Age:-\d+/.test(nbt)) opts.baby = true;
      if (/powered:1b?/.test(nbt)) opts.charged = true;
      const sz = /Size:(\d+)/.exec(nbt); if (sz) opts.size = Math.min(8, 1 << Math.min(3, Number(sz[1])));
      e = g.spawnMob(t, x, y, z, opts);
      if (!e) fail('Unable to summon entity');
      if (opts.size && e.setSize) e.setSize(opts.size);
      const nm = /CustomName:'?"?\{?.*?"?text"?:"([^"]+)"/.exec(nbt) || /CustomName:"([^"]+)"/.exec(nbt);
      if (nm) { e.customName = e.displayName = nm[1]; e.persistent = true; }
      if (/NoAI:1b?/.test(nbt)) { e.updateAI = () => {}; e.persistent = true; }
    } else fail(`Can't find element 'minecraft:${t}' of type 'minecraft:entity_type'`);
    this.feedback(`Summoned new ${e.displayName || titleCase(t)}`);
  }
  cmd_setblock(args) {
    const g = this.game, w = g.world;
    const [x, y, z] = this.blockPos(args, 0);
    const b = this.block(args[3]);
    const mode = args[4] || 'replace';
    if (y < MIN_Y || y >= MAX_Y || !w.isLoaded(x, z)) fail('That position is not loaded');
    const cur = w.getBlock(x, y, z);
    if (mode === 'keep' && cur !== 0) fail('Could not set the block');
    if (mode === 'destroy' && cur !== 0) { const d = BLOCKS[cur]; g.blockLogic.dropBlock(d, w.getMeta(x, y, z), x, y, z, null, null); g.particles && g.particles.blockBreak(x, y, z, d, w.getMeta(x, y, z)); }
    if (cur === b.id && w.getMeta(x, y, z) === b.meta) fail('Could not set the block');
    w.setBlock(x, y, z, b.id, b.meta);
    if (b.id) g.blockLogic.onPlaced(b.def, x, y, z, b.meta, null, null);
    this.feedback(`Changed the block at ${x}, ${y}, ${z}`);
  }
  cmd_fill(args) {
    const g = this.game, w = g.world;
    const [x1, y1, z1] = this.blockPos(args, 0), [x2, y2, z2] = this.blockPos(args, 3);
    const b = this.block(args[6]);
    const mode = args[7] || 'replace';
    const filter = mode === 'replace' && args[8] ? this.block(args[8]) : null;
    const [ax, bx] = [Math.min(x1, x2), Math.max(x1, x2)], [ay, by] = [Math.max(MIN_Y, Math.min(y1, y2)), Math.min(MAX_Y - 1, Math.max(y1, y2))], [az, bz] = [Math.min(z1, z2), Math.max(z1, z2)];
    const vol = (bx - ax + 1) * (by - ay + 1) * (bz - az + 1);
    if (vol > 32768) fail(`Too many blocks in the specified area (maximum 32768, specified ${vol})`);
    for (let x = ax; x <= bx; x += 16) for (let z = az; z <= bz; z += 16) if (!w.isLoaded(x, z)) fail('That position is not loaded');
    let n = 0;
    const flags = vol > 4096 ? 0 : 1;
    for (let x = ax; x <= bx; x++) for (let y = ay; y <= by; y++) for (let z = az; z <= bz; z++) {
      const edge = x === ax || x === bx || y === ay || y === by || z === az || z === bz;
      let id = b.id, meta = b.meta;
      const cur = w.getBlock(x, y, z);
      if (mode === 'hollow' && !edge) { id = 0; meta = 0; }
      if (mode === 'outline' && !edge) continue;
      if (mode === 'keep' && cur !== 0) continue;
      if (filter && (cur !== filter.id)) continue;
      if (mode === 'destroy' && cur) g.blockLogic.dropBlock(BLOCKS[cur], w.getMeta(x, y, z), x, y, z, null, null);
      if (w.setBlock(x, y, z, id, meta, flags)) n++;
    }
    if (n === 0) fail('No blocks were filled');
    this.feedback(`Successfully filled ${n} block(s)`);
  }
  cmd_clone(args) {
    const w = this.game.world;
    const [x1, y1, z1] = this.blockPos(args, 0), [x2, y2, z2] = this.blockPos(args, 3), [dx, dy, dz] = this.blockPos(args, 6);
    const masked = args[9] === 'masked';
    const [ax, bx] = [Math.min(x1, x2), Math.max(x1, x2)], [ay, by] = [Math.min(y1, y2), Math.max(y1, y2)], [az, bz] = [Math.min(z1, z2), Math.max(z1, z2)];
    const vol = (bx - ax + 1) * (by - ay + 1) * (bz - az + 1);
    if (vol > 32768) fail(`Too many blocks in the specified area (maximum 32768, specified ${vol})`);
    const buf = [];
    for (let x = ax; x <= bx; x++) for (let y = ay; y <= by; y++) for (let z = az; z <= bz; z++) buf.push([x - ax, y - ay, z - az, w.getBlock(x, y, z), w.getMeta(x, y, z)]);
    let n = 0;
    for (const [ox, oy, oz, id, meta] of buf) { if (masked && !id) continue; if (w.setBlock(dx + ox, dy + oy, dz + oz, id, meta, vol > 4096 ? 0 : 1)) n++; }
    if (n === 0) fail('No blocks were cloned');
    this.feedback(`Successfully cloned ${n} block(s)`);
  }
  cmd_gamerule(args) {
    const g = this.game;
    const name = args[0];
    if (!name || !(name in g.rules)) fail(`Incorrect argument for command`);
    if (args[1] === undefined) { this.out(`Gamerule ${name} is currently set to: ${g.rules[name]}`); return; }
    const cur = g.rules[name];
    let v;
    if (typeof cur === 'boolean') { if (args[1] !== 'true' && args[1] !== 'false') fail(`Invalid boolean, expected 'true' or 'false' but found '${args[1]}'`); v = args[1] === 'true'; }
    else v = this.int(args[1]);
    g.rules[name] = v;
    this.feedback(`Gamerule ${name} is now set to: ${v}`);
  }
  cmd_effect(args) {
    const sub = args[0];
    if (sub === 'give') {
      const list = this.targets(args[1]).filter((e) => e.addEffect);
      const eff = stripNs(args[2]);
      if (!EFFECTS[eff]) fail(`Can't find element 'minecraft:${eff}' of type 'minecraft:mob_effect'`);
      const secs = args[3] === 'infinite' ? 1e8 / 20 : args[3] !== undefined ? this.int(args[3], 1, 1000000) : 30;
      const amp = args[4] !== undefined ? this.int(args[4], 0, 255) : 0;
      let ok = 0;
      for (const e of list) if (e.addEffect(eff, EFFECTS[eff].instant ? 1 : Math.floor(secs * 20), amp, { particles: args[5] !== 'true' })) ok++;
      if (!ok) fail('Unable to apply this effect (target is either immune to effects, or has something stronger)');
      this.feedback(`Applied effect ${EFFECTS[eff].name} to ${this.namesOf(list)}`);
    } else if (sub === 'clear') {
      const list = this.targets(args[1]).filter((e) => e.effects);
      const eff = args[2] ? stripNs(args[2]) : null;
      let n = 0;
      for (const e of list) {
        if (eff) { if (e.hasEffect(eff)) { e.removeEffect(eff); n++; } }
        else if (e.effects.size) { for (const k of [...e.effects.keys()]) e.removeEffect(k); n++; }
      }
      if (!n) fail(eff ? 'Target doesn\'t have the requested effect' : 'Target has no effects to remove');
      this.feedback(eff ? `Removed effect ${EFFECTS[eff].name} from ${this.namesOf(list)}` : `Removed every effect from ${this.namesOf(list)}`);
    } else fail('Unknown or incomplete command, see below for error');
  }
  cmd_xp(args) { return this.cmd_experience(args); }
  cmd_experience(args) {
    const sub = args[0];
    const players = this.targets(args[1], true);
    const unit = args[3] || 'points';
    if (sub === 'query') {
      const p = players[0];
      const u = args[2] || 'points';
      this.out(u === 'levels' ? `${p.name} has ${p.xpLevel} experience levels` : `${p.name} has ${Math.floor(p.xpProgress * p.xpBarCap())} experience points`);
      return;
    }
    const n = this.int(args[2]);
    for (const p of players) {
      if (sub === 'add') { if (unit === 'levels') p.addLevels(n); else if (n >= 0) p.addXp(n); else { p.xpProgress = Math.max(0, p.xpProgress + n / p.xpBarCap()); } }
      else if (sub === 'set') {
        if (unit === 'levels') { p.xpLevel = Math.max(0, n); }
        else { if (n > p.xpBarCap()) fail('Unable to set experience points above the maximum points for the player\'s current level'); p.xpProgress = Math.max(0, n) / p.xpBarCap(); }
      } else fail('Unknown or incomplete command, see below for error');
    }
    const who = this.namesOf(players);
    if (sub === 'add') this.feedback(unit === 'levels' ? `Gave ${n} experience levels to ${who}` : `Gave ${n} experience points to ${who}`);
    else this.feedback(unit === 'levels' ? `Set ${n} experience levels on ${who}` : `Set ${n} experience points on ${who}`);
  }
  cmd_enchant(args) {
    const list = this.targets(args[0]);
    const en = stripNs(args[1]);
    const E = ENCHANTMENTS[en];
    if (!E) fail(`Can't find element 'minecraft:${en}' of type 'minecraft:enchantment'`);
    const lvl = args[2] !== undefined ? this.int(args[2], 1) : 1;
    if (lvl > E.maxLevel) fail(`${lvl} is higher than the maximum level of ${E.maxLevel} supported by that enchantment`);
    let n = 0;
    for (const e of list) {
      if (!e.isPlayer) continue;
      const s = e.inventory.selected();
      if (!s) { if (list.length === 1) fail(`${e.name} isn't holding any item`); continue; }
      if (!canEnchant(en, s.item)) { if (list.length === 1) fail(`${s.item.displayName} cannot support that enchantment`); continue; }
      const cur = getEnchantments(s);
      const clash = Object.keys(cur).find((k) => k !== en && exclusive(k, en));
      if (clash) { if (list.length === 1) fail(`${enchantmentLine(clash, cur[clash])} can't be combined with ${E.name}`); continue; }
      addEnchantment(s, en, lvl);
      n++;
    }
    if (!n) fail('No entity was found');
    this.feedback(`Applied enchantment ${enchantmentLine(en, lvl)} to ${list.length === 1 ? this.nameOf(list[0]) + '\'s item' : n + ' entities'}`);
  }
  cmd_seed() { const i = this.game.info; this.out(`Seed: [${i.seedText && /^-?\d+$/.test(i.seedText) ? i.seedText : i.seed}]`); }
  cmd_spawnpoint(args) {
    const players = this.targets(args[0], true);
    const [x, y, z] = args.length >= 4 ? this.blockPos(args, 1) : [Math.floor(this.p.x), Math.floor(this.p.y), Math.floor(this.p.z)];
    for (const p of players) { p.spawnX = x + 0.5; p.spawnY = y; p.spawnZ = z + 0.5; }
    this.feedback(`Set spawn point to ${x}, ${y}, ${z} [0.0] in minecraft:overworld for ${this.namesOf(players)}`);
  }
  cmd_setworldspawn(args) {
    const [x, y, z] = args.length >= 3 ? this.blockPos(args, 0) : [Math.floor(this.p.x), Math.floor(this.p.y), Math.floor(this.p.z)];
    this.game.worldSpawn = { x, y, z };
    this.game.info.spawn = this.game.worldSpawn;
    this.feedback(`Set the world spawn point to ${x}, ${y}, ${z} [0.0]`);
  }
  cmd_say(args) { if (!args.length) fail('Unknown or incomplete command, see below for error'); this.game.chat(`[${this.p.name}] ${this.expand(args.join(' '))}`); }
  cmd_me(args) { if (!args.length) fail('Unknown or incomplete command, see below for error'); this.game.chat(`* ${this.p.name} ${args.join(' ')}`); }
  cmd_msg(args) {
    const t = this.targets(args[0], true);
    const msg = args.slice(1).join(' ');
    if (!msg) fail('Unknown or incomplete command, see below for error');
    this.game.chat(`§7§oYou whisper to ${this.namesOf(t)}: ${msg}`);
    this.game.chat(`§7§o${this.p.name} whispers to you: ${msg}`);
  }
  cmd_tell(args) { return this.cmd_msg(args); }
  cmd_w(args) { return this.cmd_msg(args); }
  cmd_teammsg() { fail('You must be on a team to message your team'); }
  cmd_tm() { fail('You must be on a team to message your team'); }
  cmd_list() { this.out(`There are 1 of a max of 1 players online: ${this.p.name}`); }
  cmd_tellraw(args) {
    this.targets(args[0], true);
    const raw = args.slice(1).join(' ');
    this.game.chat(jsonText(raw));
  }
  cmd_title(args) {
    const g = this.game;
    this.targets(args[0], true);
    const sub = args[1];
    const txt = jsonText(args.slice(2).join(' '));
    if (sub === 'title') { g.showTitle(txt, g.pendingSubtitle || ''); g.pendingSubtitle = ''; this.feedback(`Showing new title for ${this.p.name}`); }
    else if (sub === 'subtitle') { g.pendingSubtitle = txt; this.feedback(`Changed the subtitle for ${this.p.name}`); }
    else if (sub === 'actionbar') { g.showActionbar(txt); this.feedback(`Showing new actionbar title for ${this.p.name}`); }
    else if (sub === 'clear' || sub === 'reset') { g.hud.title = null; this.feedback(`${sub === 'clear' ? 'Cleared' : 'Reset'} titles for ${this.p.name}`); }
    else if (sub === 'times') { this.feedback(`Changed title display times for ${this.p.name}`); }
    else fail('Unknown or incomplete command, see below for error');
  }
  cmd_locate(args) {
    const g = this.game;
    if (args[0] !== 'biome') { if (args[0] === 'structure') fail('Structures are not generated in Minecraft_Lite yet'); fail('Unknown or incomplete command, see below for error'); }
    const name = stripNs(args[1]);
    const target = BIOMES.find((b) => b.name === name);
    if (!target) fail(`There is no biome with type "minecraft:${name}"`);
    const px = Math.floor(this.p.x), pz = Math.floor(this.p.z);
    const gen = g.generator;
    for (let r = 0; r <= 6400; r += 32) {
      const steps = r === 0 ? 1 : Math.ceil(2 * Math.PI * r / 32);
      for (let i = 0; i < steps; i++) {
        const a = i / steps * Math.PI * 2;
        const x = px + Math.round(Math.cos(a) * r), z = pz + Math.round(Math.sin(a) * r);
        if (gen.biomeAt(x, z) === target.id) {
          const d = Math.round(Math.hypot(x - px, z - pz));
          this.out(`The nearest minecraft:${name} is at [${x}, ~, ${z}] (${d} blocks away)`);
          return;
        }
      }
    }
    fail(`Could not find a biome of type "minecraft:${name}" within reasonable distance`);
  }
  cmd_particle(args) {
    const g = this.game;
    const n = stripNs(args[0]);
    const type = PARTICLE_MAP[n] || n;
    const [x, y, z] = args.length >= 4 ? this.pos(args, 1) : [this.p.x, this.p.y + 1, this.p.z];
    const count = args[8] ? Math.min(1000, this.int(args[8], 0)) : 1;
    const [dx, dy, dz] = args.length >= 7 ? [this.num(args[4]), this.num(args[5]), this.num(args[6])] : [0, 0, 0];
    for (let i = 0; i < Math.max(1, count); i++) g.particles.spawn(type, x + (Math.random() * 2 - 1) * dx, y + (Math.random() * 2 - 1) * dy, z + (Math.random() * 2 - 1) * dz, 0, 0, 0);
    this.feedback(`Displaying particle ${n}`);
  }
  cmd_playsound(args) {
    const s = stripNs(args[0]);
    if (!s) fail('Unknown or incomplete command, see below for error');
    this.game.sound.play(s, args[6] ? this.num(args[6]) : 1, args[7] ? this.num(args[7]) : 1);
    this.feedback(`Played sound ${s} to ${this.p.name}`);
  }
  cmd_stopsound() { this.game.sound.stopAll(); this.feedback('Stopped all sounds'); }
  cmd_random(args) {
    const sub = args[0];
    const m = /^(-?\d+)\.\.(-?\d+)$/.exec(args[1] || '');
    if ((sub !== 'value' && sub !== 'roll') || !m) fail('Unknown or incomplete command, see below for error');
    const a = Number(m[1]), b = Number(m[2]);
    if (b < a) fail('Invalid range');
    const v = a + Math.floor(Math.random() * (b - a + 1));
    if (sub === 'roll') this.game.chat(`${this.p.name} rolled ${v} (from ${a} to ${b})`); else this.out(`Randomly chosen value: ${v}`);
  }
  cmd_save_all() { this.out('Saving the game (this may take a moment!)'); this.game.saveWorld().then(() => this.out('Saved the game')); }
  cmd_save_on() { this.game.autosave = true; this.out('Automatic saving is now enabled'); }
  cmd_save_off() { this.game.autosave = false; this.out('Automatic saving is now disabled'); }
  cmd_stop() { this.out('Stopping the server'); this.game.quitToTitle(); }
  cmd_reload() { this.out('Reloading!'); }
  cmd_recipe(args) { const n = ITEMS.length; this.feedback(args[0] === 'take' ? `Took 0 recipes from ${this.p.name}` : `Unlocked ${n} recipes for ${this.p.name}`); }
  cmd_spectate() { fail('/spectate is not available in Minecraft_Lite yet'); }
  cmd_ride() { fail('Riding is not available in Minecraft_Lite yet'); }
  cmd_trigger() { fail('Invalid trigger objective name'); }

  // ---- feature packs: add cmd_<name>(args) methods inside your own region ----
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

  expand(text) {
    return text.replace(/@[psaer](\[[^\]]*\])?/g, (m) => { try { return this.targets(m, false, true).map((e) => this.nameOf(e)).join(', '); } catch { return m; } });
  }

  // ------------------------------------------------------------------ tab completion
  suggest(text) {
    const raw = text.replace(/^\//, '');
    const parts = raw.split(' ');
    const last = parts[parts.length - 1];
    const allow = this.game.info && this.game.info.allowCommands;
    const pick = (list) => list.filter((s) => s.startsWith(last) || s.startsWith('minecraft:' + last) && false).slice(0, 50);
    if (parts.length === 1) return pick(Object.keys(HELP).concat(['gamerule', 'save-all']).filter((c, i, a) => a.indexOf(c) === i && (allow || NO_CHEATS.has(c))).sort());
    const cmd = parts[0];
    const i = parts.length - 2; // index of argument being typed
    const T = ['@a', '@e', '@p', '@r', '@s', this.p ? this.p.name : 'Player'];
    const C = ['~', '~ ~', '~ ~ ~'];
    const items = () => pick(ITEMS.filter((it) => !it.hidden || true).map((it) => it.name));
    const blocks = () => pick(['air', ...BLOCKS.slice(1).filter((b) => !b.internal).map((b) => b.name)]);
    switch (cmd) {
      case 'gamemode': return i === 0 ? pick(MODES) : i === 1 ? pick(T) : [];
      case 'defaultgamemode': return i === 0 ? pick(MODES) : [];
      case 'difficulty': return i === 0 ? pick(DIFFS) : [];
      case 'time': return i === 0 ? pick(['add', 'query', 'set']) : i === 1 ? pick(parts[1] === 'set' ? ['day', 'midnight', 'night', 'noon'] : parts[1] === 'query' ? ['day', 'daytime', 'gametime'] : []) : [];
      case 'weather': return i === 0 ? pick(['clear', 'rain', 'thunder']) : [];
      case 'give': return i === 0 ? pick(T) : i === 1 ? items() : [];
      case 'clear': return i === 0 ? pick(T) : i === 1 ? items() : [];
      case 'kill': return i === 0 ? pick(T) : [];
      case 'summon': return i === 0 ? pick(SUMMONABLE.slice().sort()) : i === 1 ? pick(C) : [];
      case 'setblock': return i < 3 ? pick(C) : i === 3 ? blocks() : i === 4 ? pick(['destroy', 'keep', 'replace']) : [];
      case 'fill': return i < 6 ? pick(C) : i === 6 ? blocks() : i === 7 ? pick(['destroy', 'hollow', 'keep', 'outline', 'replace']) : i === 8 ? blocks() : [];
      case 'clone': return i < 9 ? pick(C) : pick(['masked', 'replace']);
      case 'gamerule': return i === 0 ? pick(Object.keys(this.game.rules).sort()) : i === 1 && typeof this.game.rules[parts[1]] === 'boolean' ? pick(['false', 'true']) : [];
      case 'effect': return i === 0 ? pick(['clear', 'give']) : i === 1 ? pick(T) : i === 2 ? pick(Object.keys(EFFECTS).sort()) : i === 4 && parts[1] === 'give' ? pick(['0', '1', '2', '3', '4']) : [];
      case 'xp': case 'experience': return i === 0 ? pick(['add', 'query', 'set']) : i === 1 ? pick(T) : i === 3 || (i === 2 && parts[1] === 'query') ? pick(['levels', 'points']) : [];
      case 'tp': case 'teleport': return i === 0 ? pick([...T, ...C]) : i <= 3 ? pick(C) : [];
      case 'enchant': return i === 0 ? pick(T) : i === 1 ? pick(ENCHANTS) : [];
      case 'locate': return i === 0 ? pick(['biome', 'structure']) : i === 1 && parts[1] === 'biome' ? pick(BIOMES.map((b) => b.name)) : [];
      case 'particle': return i === 0 ? pick(PARTICLES) : i <= 3 ? pick(C) : [];
      case 'title': return i === 0 ? pick(T) : i === 1 ? pick(['actionbar', 'clear', 'reset', 'subtitle', 'times', 'title']) : [];
      case 'spawnpoint': return i === 0 ? pick(T) : i <= 3 ? pick(C) : [];
      case 'setworldspawn': return i <= 2 ? pick(C) : [];
      case 'msg': case 'tell': case 'w': case 'tellraw': return i === 0 ? pick(T) : [];
      case 'random': return i === 0 ? pick(['roll', 'value']) : [];
      case 'help': return i === 0 ? pick(Object.keys(HELP)) : [];
      default: return [];
    }
  }
}

function entityType(e) {
  if (e.isPlayer) return 'player';
  if (e.mobType) return e.mobType;
  if (e.type === 'xp_orb') return 'experience_orb';
  if (e.type === 'tnt') return 'tnt';
  return e.type;
}
// minimal JSON text component -> formatted string
function jsonText(raw) {
  const s = raw.trim();
  if (!s) return '';
  const COL = { black: '0', dark_blue: '1', dark_green: '2', dark_aqua: '3', dark_red: '4', dark_purple: '5', gold: '6', gray: '7', dark_gray: '8', blue: '9', green: 'a', aqua: 'b', red: 'c', light_purple: 'd', yellow: 'e', white: 'f' };
  const conv = (c) => {
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) return c.map(conv).join('');
    if (!c || typeof c !== 'object') return String(c);
    let pre = '';
    if (c.color && COL[c.color]) pre += '§' + COL[c.color];
    if (c.bold) pre += '§l'; if (c.italic) pre += '§o'; if (c.underlined) pre += '§n'; if (c.strikethrough) pre += '§m'; if (c.obfuscated) pre += '§k';
    return pre + (c.text ?? c.translate ?? '') + (c.extra ? c.extra.map(conv).join('') : '') + (pre ? '§r' : '');
  };
  try { return conv(JSON.parse(s)); } catch { return unquote(s); }
}
