// World list, Create New World (tabbed), Game Rules, Edit World, superflat presets, single-biome picker.
import { Screen } from '../screen.js';
import { Button, CycleButton, TextField, ScrollList, TabBar } from '../widgets.js';
import { fill } from '../draw.js';
import { ConfirmScreen } from './misc.js';
import { DEFAULT_RULES } from '../../game/rules.js';
import { FLAT_PRESETS } from '../../world/generator.js';
import { BIOMES } from '../../world/biomes.js';
import { titleCase, formatTime } from '../../core/util.js';
import { ITEM } from '../../registry/items.js';

const MODE_NAMES = ['Survival', 'Creative', 'Adventure', 'Spectator'];
const DIFF_NAMES = ['Peaceful', 'Easy', 'Normal', 'Hard'];

export class SelectWorldScreen extends Screen {
  constructor(parent) { super('Select World'); this.parent = parent; this.pauses = false; this.worlds = []; this.filter = ''; this.titleY = 8; }
  open(gui) { super.open(gui); this.refresh(); }
  async refresh() {
    this.worlds = await this.gui.game.storage.listWorlds();
    if (!this.worlds.length && !this.autoCreated) { this.autoCreated = true; this.gui.setScreen(new CreateWorldScreen(this)); return; }
    this.applyFilter();
  }
  applyFilter() {
    if (!this.list) return;
    const f = this.filter.toLowerCase();
    this.list.entries = this.worlds.filter((w) => !f || w.name.toLowerCase().includes(f));
    if (this.list.selected >= this.list.entries.length) this.list.selected = -1;
    this.updateButtons();
  }
  init() {
    const w = this.width, h = this.height;
    this.search = this.add(new TextField(w / 2 - 100, 22, 200, 20, this.filter, { hint: 'Search...', onChange: (t) => { this.filter = t; this.applyFilter(); } }));
    this.list = this.add(new ScrollList(0, 48, w, h - 64 - 48, 36, {
      rowWidth: 270,
      renderEntry: (gui, e, x, y, rw, rh, hov) => this.renderWorld(gui, e, x, y, rw, rh, hov),
      onSelect: () => this.updateButtons(),
      onActivate: (e) => this.play(e),
    }));
    this.playBtn = this.add(new Button(w / 2 - 154, h - 52, 150, 20, 'Play Selected World', () => this.play(this.selected())));
    this.add(new Button(w / 2 + 4, h - 52, 150, 20, 'Create New World', () => this.gui.setScreen(new CreateWorldScreen(this))));
    this.editBtn = this.add(new Button(w / 2 - 154, h - 28, 72, 20, 'Edit', () => this.gui.setScreen(new EditWorldScreen(this, this.selected()))));
    this.delBtn = this.add(new Button(w / 2 - 76, h - 28, 72, 20, 'Delete', () => this.confirmDelete()));
    this.recreateBtn = this.add(new Button(w / 2 + 4, h - 28, 72, 20, 'Re-Create', () => this.recreate()));
    this.add(new Button(w / 2 + 82, h - 28, 72, 20, 'Back', () => this.onClose()));
    this.applyFilter();
    this.setFocus(this.search);
  }
  selected() { return this.list && this.list.selected >= 0 ? this.list.entries[this.list.selected] : null; }
  updateButtons() { const s = !!this.selected(); for (const b of [this.playBtn, this.editBtn, this.delBtn, this.recreateBtn]) if (b) b.active = s; }
  play(w) { if (!w) return; this.gui.game.loadWorld(w.id); }
  confirmDelete() {
    const w = this.selected(); if (!w) return;
    this.gui.setScreen(new ConfirmScreen(this, 'Are you sure you want to delete this world?', `'${w.name}' will be lost forever! (A long time!)`, 'Delete', 'Cancel', async (yes) => {
      if (yes) { await this.gui.game.storage.deleteWorld(w.id); this.worlds = this.worlds.filter((x) => x.id !== w.id); }
      this.gui.setScreen(this);
      this.applyFilter();
    }));
  }
  recreate() {
    const w = this.selected(); if (!w) return;
    const s = new CreateWorldScreen(this);
    s.settings = { ...s.settings, name: w.name, seed: w.seedText || String(w.seed), gameMode: w.hardcore ? 'hardcore' : ['survival', 'creative', 'adventure', 'spectator'][w.gameMode] || 'survival', difficulty: w.difficulty, allowCommands: w.allowCommands, worldType: w.worldType, flatPreset: w.flatPreset, singleBiome: w.singleBiome, bonusChest: w.bonusChest, generateStructures: w.generateStructures, rules: { ...w.rules } };
    this.gui.setScreen(s);
  }
  renderWorld(gui, e, x, y, rw, rh, hov) {
    const ctx = gui.ctx, f = gui.font;
    if (e.icon) {
      if (!e._img) { e._img = new Image(); e._img.src = e.icon; }
      if (e._img.complete) ctx.drawImage(e._img, x, y, 32, 32);
    } else { fill(ctx, x, y, 32, 32, '#3a3a3a'); gui.icons && gui.icons.draw(ctx, ITEM.grass_block, x + 8, y + 8, 16); }
    if (hov) { fill(ctx, x, y, 32, 32, 'rgba(160,160,160,0.5)'); f.draw(ctx, '▶', x + 13, y + 12, 0xffffff); }
    f.draw(ctx, e.name, x + 35, y + 1, 0xffffff);
    f.draw(ctx, `${e.id} (${formatTime(e.lastPlayed)})`, x + 35, y + 12, 0x808080);
    const mode = e.hardcore ? '§cHardcore Mode' : `${MODE_NAMES[e.gameMode] || 'Survival'} Mode`;
    f.draw(ctx, `${mode}${e.allowCommands ? ', Cheats' : ''}, Version: 1.0`, x + 35, y + 22, 0x808080);
    void rw; void rh;
  }
  onClose() { this.gui.setScreen(this.parent); }
}

// ---------------------------------------------------------------------------
export class CreateWorldScreen extends Screen {
  constructor(parent) {
    super('Create New World');
    this.parent = parent; this.pauses = false;
    this.tab = 0;
    this.settings = { name: 'New World', seed: '', gameMode: 'survival', difficulty: 2, allowCommands: false, worldType: 'default', flatPreset: 'classic_flat', singleBiome: 'plains', generateStructures: true, bonusChest: false, rules: { ...DEFAULT_RULES } };
  }
  init() {
    const w = this.width, h = this.height, s = this.settings;
    this.add(new TabBar(Math.floor(w / 2 - 195), 0, ['Game', 'World', 'More'], this.tab, (i) => { this.tab = i; this.rebuild(); }));
    const cx = Math.floor(w / 2);
    if (this.tab === 0) {
      this.nameField = this.add(new TextField(cx - 104, 52, 208, 20, s.name, { maxLength: 32, onChange: (t) => { s.name = t; } }));
      this.add(new CycleButton(cx - 105, 84, 210, 20, 'Game Mode', [['survival', 'Survival'], ['hardcore', 'Hardcore'], ['creative', 'Creative']], s.gameMode, (v) => { s.gameMode = v; if (v === 'hardcore') { s.difficulty = 3; s.allowCommands = false; } else if (v === 'creative') s.allowCommands = true; this.rebuild(); }));
      this.add(new CycleButton(cx - 105, 128, 210, 20, 'Difficulty', DIFF_NAMES.map((n, i) => [i, n]), s.difficulty, (v) => { s.difficulty = v; })).active = s.gameMode !== 'hardcore';
      const cb = this.add(new CycleButton(cx - 105, 154, 210, 20, 'Allow Commands', [[false, 'OFF'], [true, 'ON']], s.allowCommands, (v) => { s.allowCommands = v; }, { tooltip: 'Whether commands like /gamemode, /experience can be used' }));
      cb.active = s.gameMode !== 'hardcore';
      this.setFocus(this.nameField);
    } else if (this.tab === 1) {
      this.add(new CycleButton(cx - 155, 50, 150, 20, 'World Type', [['default', 'Default'], ['flat', 'Superflat'], ['large_biomes', 'Large Biomes'], ['amplified', 'Amplified'], ['single_biome', 'Single Biome']], s.worldType, (v) => { s.worldType = v; this.rebuild(); }));
      const cust = this.add(new Button(cx + 5, 50, 150, 20, 'Customize', () => {
        if (s.worldType === 'flat') this.gui.setScreen(new FlatPresetsScreen(this));
        else if (s.worldType === 'single_biome') this.gui.setScreen(new BiomeSelectScreen(this));
      }));
      cust.active = s.worldType === 'flat' || s.worldType === 'single_biome';
      this.seedField = this.add(new TextField(cx - 154, 96, 308, 20, s.seed, { maxLength: 64, hint: 'Leave blank for a random seed', onChange: (t) => { s.seed = t; } }));
      this.add(new CycleButton(cx - 155, 134, 150, 20, 'Generate Structures', [[true, 'ON'], [false, 'OFF']], s.generateStructures, (v) => { s.generateStructures = v; }, { tooltip: 'Villages, dungeons etc. (structures are limited in Minecraft_Lite)' })).active = s.worldType !== 'single_biome' || true;
      this.add(new CycleButton(cx + 5, 134, 150, 20, 'Bonus Chest', [[false, 'OFF'], [true, 'ON']], s.bonusChest, (v) => { s.bonusChest = v; }));
      this.setFocus(this.seedField);
    } else {
      this.add(new Button(cx - 105, 40, 210, 20, 'Game Rules', () => this.gui.setScreen(new EditGameRulesScreen(this, s.rules, (r) => { s.rules = r; }))));
      this.add(new Button(cx - 105, 64, 210, 20, 'Experiments', null, { active: false, tooltip: 'No experiments are available' }));
      this.add(new Button(cx - 105, 88, 210, 20, 'Data Packs', null, { active: false, tooltip: 'Data packs are not supported' }));
    }
    this.add(new Button(cx - 155, h - 28, 150, 20, 'Create New World', () => this.create()));
    this.add(new Button(cx + 5, h - 28, 150, 20, 'Cancel', () => this.onClose()));
  }
  create() {
    const s = this.settings;
    if (!s.name.trim()) s.name = 'New World';
    this.gui.game.createWorld({ ...s, difficulty: s.difficulty });
  }
  render(gui, mx, my) {
    this.renderBackground();
    const ctx = gui.ctx, f = gui.font, w = this.width, s = this.settings;
    fill(ctx, 0, 0, w, 24, 'rgba(0,0,0,0.4)');
    fill(ctx, 0, 23, w, 1, '#ffffff');
    fill(ctx, 0, this.height - 36, w, 1, 'rgba(255,255,255,0.2)');
    const cx = Math.floor(w / 2);
    if (this.tab === 0) {
      f.draw(ctx, 'World Name', cx - 104, 40, 0xe0e0e0);
      const desc = { survival: 'Search for resources, craft, gain levels, health and hunger', hardcore: 'Same as Survival Mode, locked at hardest difficulty, and one life only', creative: 'Unlimited resources, free flying and destroy blocks instantly' }[s.gameMode];
      f.wrap(desc, 210).forEach((l, i) => f.draw(ctx, l, cx - 105, 107 + i * 9, 0xa0a0a0));
    } else if (this.tab === 1) {
      f.draw(ctx, 'Seed for the World Generator', cx - 154, 84, 0xe0e0e0);
      if (s.worldType === 'flat') f.draw(ctx, `Preset: ${FLAT_PRESETS[s.flatPreset].name}`, cx + 5, 74, 0xa0a0a0);
      if (s.worldType === 'single_biome') f.draw(ctx, `Biome: ${titleCase(s.singleBiome)}`, cx + 5, 74, 0xa0a0a0);
      if (s.worldType === 'amplified') f.draw(ctx, 'Amplified worlds have extreme mountains', cx - 154, 120, 0xa0a0a0);
    }
    for (const wd of this.widgets) wd.render(gui, mx, my);
    this.renderTooltips(gui, mx, my);
  }
  onClose() { this.gui.setScreen(this.parent); }
}

// ---------------------------------------------------------------------------
const RULE_CATS = [
  ['Player', [['doImmediateRespawn', 'Respawn immediately'], ['drowningDamage', 'Deal drowning damage'], ['fallDamage', 'Deal fall damage'], ['fireDamage', 'Deal fire damage'], ['freezeDamage', 'Deal freeze damage'], ['keepInventory', 'Keep inventory after death'], ['naturalRegeneration', 'Regenerate health'], ['playersSleepingPercentage', 'Sleep percentage'], ['spawnRadius', 'Respawn location radius'], ['spectatorsGenerateChunks', 'Allow spectators to generate terrain'], ['doLimitedCrafting', 'Require recipe for crafting']]],
  ['Mobs', [['disableRaids', 'Disable raids'], ['forgiveDeadPlayers', 'Forgive dead players'], ['maxEntityCramming', 'Entity cramming threshold'], ['mobExplosionDropDecay', 'In mob explosions, some blocks won\'t drop their loot'], ['mobGriefing', 'Allow destructive mob actions'], ['universalAnger', 'Universal anger']]],
  ['Spawning', [['doMobSpawning', 'Spawn mobs'], ['doPatrolSpawning', 'Spawn pillager patrols'], ['doTraderSpawning', 'Spawn Wandering Traders'], ['doWardenSpawning', 'Spawn Wardens'], ['doInsomnia', 'Spawn phantoms']]],
  ['Drops', [['doEntityDrops', 'Drop entity equipment'], ['doMobLoot', 'Drop mob loot'], ['doTileDrops', 'Drop blocks'], ['blockExplosionDropDecay', 'In block interaction explosions, some blocks won\'t drop their loot'], ['tntExplosionDropDecay', 'In TNT explosions, some blocks won\'t drop their loot']]],
  ['World Updates', [['doDaylightCycle', 'Advance time of day'], ['doFireTick', 'Update fire'], ['doWeatherCycle', 'Update weather'], ['randomTickSpeed', 'Random tick speed rate'], ['doVinesSpread', 'Vines spread'], ['lavaSourceConversion', 'Lava converts to source'], ['waterSourceConversion', 'Water converts to source'], ['snowAccumulationHeight', 'Snow accumulation height']]],
  ['Chat', [['announceAdvancements', 'Announce advancements'], ['commandBlockOutput', 'Broadcast command block output'], ['logAdminCommands', 'Broadcast admin commands'], ['sendCommandFeedback', 'Send command feedback'], ['showDeathMessages', 'Show death messages']]],
  ['Miscellaneous', [['reducedDebugInfo', 'Reduce debug info']]],
];
export { RULE_CATS };

export class EditGameRulesScreen extends Screen {
  constructor(parent, rules, onDone) { super('Edit Game Rules'); this.parent = parent; this.rules = { ...rules }; this.onDone = onDone; this.pauses = false; this.titleY = 8; this.scroll = 0; }
  init() {
    const w = this.width, h = this.height;
    const entries = [];
    for (const [cat, rules] of RULE_CATS) {
      entries.push({ header: cat });
      for (const [id, name] of rules) entries.push({ id, name });
    }
    this.list = this.add(new ScrollList(0, 32, w, h - 32 - 36, 24, {
      rowWidth: 320, selectable: false,
      renderEntry: (gui, e, x, y, rw, rh, hov) => {
        const f = gui.font;
        if (e.header) { f.drawCentered(gui.ctx, '§l§e' + e.header, x + rw / 2, y + 6, 0xffff55); return; }
        f.draw(gui.ctx, e.name.length > 40 ? e.name.slice(0, 38) + '...' : e.name, x, y + 6, 0xffffff);
        const v = this.rules[e.id];
        const bx = x + rw - 44;
        e.btn = e.btn || (typeof v === 'boolean'
          ? new CycleButton(bx, y, 44, 20, '', [[true, 'ON'], [false, 'OFF']], v, (nv) => { this.rules[e.id] = nv; }, { omitPrefix: true, tooltip: e.id })
          : new TextField(bx, y, 42, 20, String(v), { maxLength: 6, filter: (c) => /[0-9-]/.test(c), onChange: (t) => { const n = parseInt(t, 10); if (!isNaN(n)) this.rules[e.id] = n; } }));
        e.btn.x = bx; e.btn.y = y;
        e.btn.render(gui, gui.mouseX, gui.mouseY);
        if (hov && gui.mouseX < bx) this.hoverTip = `${e.name}\n§7${e.id}`;
      },
    }));
    for (const e of entries) e.onClick = (gui, mx, my, btn) => { if (e.btn && e.btn.contains(mx, my)) { if (this.focusedField && this.focusedField !== e.btn) this.focusedField.focused = false; this.focusedField = e.btn.insert ? e.btn : null; if (e.btn.insert) e.btn.focused = true; e.btn.mouseDown(gui, mx, my, btn); return true; } return false; };
    this.list.entries = entries;
    this.add(new Button(w / 2 - 155, h - 28, 150, 20, 'Done', () => { this.onDone(this.rules); this.gui.setScreen(this.parent); }));
    this.add(new Button(w / 2 + 5, h - 28, 150, 20, 'Cancel', () => this.gui.setScreen(this.parent)));
  }
  keyDown(e) { if (this.focusedField && this.focusedField.keyDown(this.gui, e)) return true; return super.keyDown(e); }
  charTyped(ch) { if (this.focusedField) return this.focusedField.charTyped(this.gui, ch); return false; }
  tick() { super.tick(); if (this.focusedField) this.focusedField.tick(); }
  render(gui, mx, my) {
    this.hoverTip = null;
    super.render(gui, mx, my);
    if (this.hoverTip) gui.drawTooltip(this.hoverTip.split('\n'), mx, my);
  }
}

// ---------------------------------------------------------------------------
export class EditWorldScreen extends Screen {
  constructor(parent, info) { super('Edit World'); this.parent = parent; this.info = info; this.pauses = false; }
  init() {
    const w = this.width, h = this.height, cx = Math.floor(w / 2);
    this.name = this.add(new TextField(cx - 100, 38, 200, 20, this.info.name, { maxLength: 32 }));
    this.add(new Button(cx - 100, h / 4 + 24 - 16, 200, 20, 'Reset Icon', async () => { this.info.icon = null; await this.gui.game.storage.saveWorldInfo(this.info); }));
    this.add(new Button(cx - 100, h / 4 + 48 - 16, 200, 20, 'Open World Folder', null, { active: false }));
    this.add(new Button(cx - 100, h / 4 + 72 - 16, 200, 20, 'Make Backup', async () => {
      const copy = { ...this.info, id: 'w' + Date.now().toString(36), name: this.info.name + ' (Backup)', lastPlayed: Date.now() };
      await this.gui.game.storage.copyWorld(this.info.id, copy);
      this.gui.game.toast('Backup created', copy.name);
    }));
    this.add(new Button(cx - 100, h / 4 + 96 - 16, 200, 20, 'Open Backups Folder', null, { active: false }));
    this.add(new Button(cx - 100, h / 4 + 120 - 16, 200, 20, 'Optimize World', null, { active: false }));
    this.add(new Button(cx - 100, h / 4 + 144 + 5, 98, 20, 'Save', async () => { this.info.name = this.name.text || this.info.name; await this.gui.game.storage.saveWorldInfo(this.info); this.gui.setScreen(this.parent); this.parent.refresh(); }));
    this.add(new Button(cx + 2, h / 4 + 144 + 5, 98, 20, 'Cancel', () => this.gui.setScreen(this.parent)));
    this.setFocus(this.name);
  }
  render(gui, mx, my) { super.render(gui, mx, my); gui.font.draw(gui.ctx, 'Enter Name', Math.floor(this.width / 2) - 100, 27, 0xa0a0a0); }
}

export class FlatPresetsScreen extends Screen {
  constructor(parent) { super('Select a Preset'); this.parent = parent; this.pauses = false; this.titleY = 8; }
  init() {
    const w = this.width, h = this.height;
    const keys = Object.keys(FLAT_PRESETS);
    this.list = this.add(new ScrollList(0, 32, w, h - 32 - 36, 24, {
      rowWidth: 260,
      renderEntry: (gui, e, x, y) => {
        const p = FLAT_PRESETS[e];
        const top = p.layers[p.layers.length - 1][0];
        if (ITEM[top]) gui.icons.draw(gui.ctx, ITEM[top], x + 2, y + 2, 16);
        gui.font.draw(gui.ctx, p.name, x + 24, y + 6, 0xffffff);
      },
      onActivate: (e) => this.pick(e),
    }));
    this.list.entries = keys;
    this.list.selected = keys.indexOf(this.parent.settings.flatPreset);
    this.add(new Button(w / 2 - 155, h - 28, 150, 20, 'Use Preset', () => { if (this.list.selected >= 0) this.pick(keys[this.list.selected]); }));
    this.add(new Button(w / 2 + 5, h - 28, 150, 20, 'Cancel', () => this.gui.setScreen(this.parent)));
  }
  pick(k) { this.parent.settings.flatPreset = k; this.gui.setScreen(this.parent); }
}

export class BiomeSelectScreen extends Screen {
  constructor(parent) { super('Select Biome'); this.parent = parent; this.pauses = false; this.titleY = 8; }
  init() {
    const w = this.width, h = this.height;
    this.list = this.add(new ScrollList(0, 32, w, h - 32 - 36, 16, {
      rowWidth: 200,
      renderEntry: (gui, e, x, y) => gui.font.draw(gui.ctx, titleCase(e.name), x + 4, y + 2, 0xffffff),
      onActivate: (e) => this.pick(e),
    }));
    this.list.entries = BIOMES;
    this.list.selected = BIOMES.findIndex((b) => b.name === this.parent.settings.singleBiome);
    this.add(new Button(w / 2 - 155, h - 28, 150, 20, 'Done', () => { if (this.list.selected >= 0) this.pick(BIOMES[this.list.selected]); }));
    this.add(new Button(w / 2 + 5, h - 28, 150, 20, 'Cancel', () => this.gui.setScreen(this.parent)));
  }
  pick(b) { this.parent.settings.singleBiome = b.name; this.gui.setScreen(this.parent); }
}
