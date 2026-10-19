// Options screens laid out like Minecraft's.
import { Screen } from '../screen.js';
import { Button, CycleButton, Slider, ScrollList } from '../widgets.js';
import { ICONS, fill } from '../draw.js';
import { BINDING_CATEGORIES, BINDING_NAMES, DEFAULT_BINDINGS, keyName } from '../../game/input.js';
import { ITEM } from '../../registry/items.js';

const ON_OFF = [[true, 'ON'], [false, 'OFF']];

// ---- option specs ----
function bool(key, label, tip) { return { key, label, type: 'bool', tip }; }
function cycle(key, label, values, tip) { return { key, label, type: 'cycle', values, tip }; }
function slider(key, label, min, max, step, fmt, tip) { return { key, label, type: 'slider', min, max, step, fmt, tip }; }

function makeWidget(game, spec, x, y, w, onChange) {
  const o = game.options;
  const apply = (v) => { o.set(spec.key, v); game.applyOptions(); onChange && onChange(v); };
  if (spec.type === 'bool') return new CycleButton(x, y, w, 20, spec.label, ON_OFF, o.get(spec.key), apply, { tooltip: spec.tip });
  if (spec.type === 'cycle') return new CycleButton(x, y, w, 20, spec.label, spec.values, o.get(spec.key), apply, { tooltip: spec.tip });
  if (spec.type === 'slider') {
    const toNorm = (v) => (v - spec.min) / (spec.max - spec.min);
    const fromNorm = (n) => { let v = spec.min + n * (spec.max - spec.min); if (spec.step) v = Math.round(v / spec.step) * spec.step; return Math.round(v * 1000) / 1000; };
    return new Slider(x, y, w, 20, toNorm(o.get(spec.key)), (n) => `${spec.label}: ${spec.fmt ? spec.fmt(fromNorm(n)) : fromNorm(n)}`, (n) => apply(fromNorm(n)), { steps: spec.step ? Math.round((spec.max - spec.min) / spec.step) : 0, tooltip: spec.tip });
  }
  return null;
}

// Scrollable two-column list of option widgets
class OptionsListScreen extends Screen {
  constructor(parent, title, specs, opts = {}) { super(title); this.parent = parent; this.specs = specs; this.pauses = parent ? parent.pauses : false; this.titleY = 8; this.opts = opts; }
  init() {
    const w = this.width, h = this.height;
    const g = this.gui.game;
    const rows = [];
    let pending = [];
    for (const s of this.specs) {
      if (s.wide) { if (pending.length) { rows.push(pending); pending = []; } rows.push([s]); continue; }
      pending.push(s);
      if (pending.length === 2) { rows.push(pending); pending = []; }
    }
    if (pending.length) rows.push(pending);
    const entries = rows.map((r) => ({ specs: r, widgets: r.map((s) => (s.button ? new Button(0, 0, r.length === 1 && s.wide ? 310 : 150, 20, s.label, () => s.button(this), { active: s.active !== false, tooltip: s.tip }) : makeWidget(g, s, 0, 0, s.wide ? 310 : 150, () => this.onOptionChanged && this.onOptionChanged(s)))) }));
    for (const e of entries) e.onClick = (gui, mx, my, btn) => { for (const wd of e.widgets) if (wd && wd.contains(mx, my)) { this.dragW = wd; wd.mouseDown(gui, mx, my, btn); return true; } return false; };
    this.list = this.add(new ScrollList(0, 32, w, h - 32 - 32, 25, {
      rowWidth: 310, selectable: false, background: true,
      renderEntry: (gui, e, x, y) => {
        e.widgets.forEach((wd, i) => { if (!wd) return; wd.x = x + (e.widgets.length === 1 ? (e.specs[0].wide ? 0 : 80) : i * 160); wd.y = y; wd.render(gui, gui.mouseX, gui.mouseY); if (wd.tooltip && wd.contains(gui.mouseX, gui.mouseY) && gui.mouseY > 32 && gui.mouseY < h - 32) this.tip = wd.tooltip; });
      },
    }));
    this.list.entries = entries;
    this.add(new Button(w / 2 - 100, h - 27, 200, 20, 'Done', () => this.onClose()));
  }
  mouseMove(mx, my) { if (this.dragW) this.dragW.mouseDrag(this.gui, mx, my); super.mouseMove(mx, my); }
  mouseUp(mx, my, b) { if (this.dragW) { this.dragW.mouseUp(this.gui, mx, my, b); this.dragW = null; } super.mouseUp(mx, my, b); }
  render(gui, mx, my) {
    this.tip = null;
    super.render(gui, mx, my);
    if (this.tip) gui.drawTooltip(gui.font.wrap(typeof this.tip === 'function' ? this.tip() : this.tip, 200), mx, my);
  }
  onClose() { this.gui.game.options.save(); this.gui.setScreen(this.parent); }
}

// ---------------------------------------------------------------------------
export class OptionsScreen extends Screen {
  constructor(parent) { super('Options'); this.parent = parent; this.pauses = parent ? parent.pauses !== false : false; }
  init() {
    const w = this.width, h = this.height, g = this.gui.game;
    const top = Math.floor(h / 6) - 12;
    this.add(makeWidget(g, slider('fov', 'FOV', 30, 110, 1, (v) => (v === 70 ? 'Normal' : v === 110 ? 'Quake Pro' : String(v))), w / 2 - 155, top, 150));
    if (g.inWorld) {
      const locked = g.info && g.info.difficultyLocked;
      const d = this.add(new CycleButton(w / 2 + 5, top, 130, 20, 'Difficulty', [[0, 'Peaceful'], [1, 'Easy'], [2, 'Normal'], [3, 'Hard']], g.difficulty, (v) => { g.difficulty = v; g.info.difficulty = v; }));
      d.active = !locked && !(g.info && g.info.hardcore);
      this.add(new Button(w / 2 + 135, top, 20, 20, '', () => { if (!g.info.difficultyLocked) g.info.difficultyLocked = true; this.rebuild(); }, { icon: locked ? ICONS.lock : ICONS.unlock, tooltip: locked ? 'Difficulty is locked' : 'Lock world difficulty', active: !locked }));
    } else this.add(new Button(w / 2 + 5, top, 150, 20, 'Online...', null, { active: false, tooltip: 'Online options are not available in Minecraft_Lite' }));
    const y0 = Math.floor(h / 6) + 42;
    const items = [
      ['Skin Customization...', () => new SkinScreen(this)], ['Music & Sounds...', () => new SoundScreen(this)],
      ['Video Settings...', () => new VideoScreen(this)], ['Controls...', () => new ControlsScreen(this)],
      ['Language...', () => new LanguageScreen(this)], ['Chat Settings...', () => new ChatOptionsScreen(this)],
      ['Resource Packs...', () => new ResourcePackScreen(this)], ['Accessibility Settings...', () => new AccessibilityScreen(this)],
      ['Telemetry Data...', () => new TelemetryScreen(this)], ['Credits & Attribution...', () => new CreditsScreen(this)],
    ];
    items.forEach(([label, mk], i) => this.add(new Button(w / 2 - 155 + (i % 2) * 160, y0 + Math.floor(i / 2) * 24, 150, 20, label, () => this.gui.setScreen(mk()))));
    this.add(new Button(w / 2 - 100, Math.floor(h / 6) + 168, 200, 20, 'Done', () => this.onClose()));
  }
  onClose() { this.gui.game.options.save(); this.gui.setScreen(this.parent); }
}

export class VideoScreen extends OptionsListScreen {
  constructor(parent) {
    super(parent, 'Video Settings', [
      cycle('graphics', 'Graphics', [['fast', 'Fast'], ['fancy', 'Fancy'], ['fabulous', 'Fabulous!']], 'Fast: fewer details, faster. Fancy: balanced. Fabulous!: same as Fancy here.'),
      slider('renderDistance', 'Render Distance', 2, 24, 1, (v) => `${v} chunks`),
      bool('smoothLighting', 'Smooth Lighting', 'Enables smooth lighting and ambient occlusion'),
      slider('simulationDistance', 'Simulation Distance', 4, 16, 1, (v) => `${v} chunks`),
      slider('maxFps', 'Max Framerate', 10, 260, 10, (v) => (v >= 260 ? 'Unlimited' : `${v} fps`)),
      bool('vsync', 'VSync'),
      bool('viewBobbing', 'View Bobbing'),
      cycle('guiScale', 'GUI Scale', [[0, 'Auto'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']]),
      cycle('attackIndicator', 'Attack Indicator', [['crosshair', 'Crosshair'], ['hotbar', 'Hotbar'], ['off', 'OFF']]),
      slider('gamma', 'Brightness', 0, 1, 0.01, (v) => (v === 0 ? 'Moody' : v === 1 ? 'Bright' : `+${Math.round(v * 100)}%`)),
      cycle('clouds', 'Clouds', [['fancy', 'Fancy'], ['fast', 'Fast'], ['off', 'OFF']]),
      bool('fullscreen', 'Fullscreen'),
      cycle('particles', 'Particles', [['all', 'All'], ['decreased', 'Decreased'], ['minimal', 'Minimal']]),
      slider('mipmapLevels', 'Mipmap Levels', 0, 4, 1),
      bool('entityShadows', 'Entity Shadows'),
      slider('distortionEffects', 'Distortion Effects', 0, 1, 0.01, (v) => `${Math.round(v * 100)}%`),
      slider('entityDistance', 'Entity Distance', 0.5, 5, 0.25, (v) => `${Math.round(v * 100)}%`),
      bool('fovEffects', 'FOV Effects'),
      bool('autosaveIndicator', 'Show Autosave Indicator'),
      slider('biomeBlend', 'Biome Blend', 0, 7, 1, (v) => `${v * 2 + 1}x${v * 2 + 1}`),
    ]);
  }
  onOptionChanged(s) {
    const g = this.gui.game;
    if (s.key === 'guiScale') { g.gui.guiScaleSetting = g.options.get('guiScale'); g.gui.resize(); }
    if (s.key === 'smoothLighting' || s.key === 'graphics') { g.renderer.clearMeshes(); }
    if (s.key === 'fullscreen') g.toggleFullscreen();
  }
}

export class ControlsScreen extends Screen {
  constructor(parent) { super('Controls'); this.parent = parent; this.pauses = parent.pauses; }
  init() {
    const w = this.width, h = this.height, g = this.gui.game;
    const y = Math.floor(h / 6) - 12;
    this.add(new Button(w / 2 - 155, y + 24, 150, 20, 'Mouse Settings...', () => this.gui.setScreen(new MouseScreen(this))));
    this.add(new Button(w / 2 + 5, y + 24, 150, 20, 'Key Binds...', () => this.gui.setScreen(new KeyBindsScreen(this))));
    this.add(makeWidget(g, cycle('toggleSneak', 'Sneak', [[false, 'Hold'], [true, 'Toggle']]), w / 2 - 155, y + 48, 150));
    this.add(makeWidget(g, cycle('toggleSprint', 'Sprint', [[false, 'Hold'], [true, 'Toggle']]), w / 2 + 5, y + 48, 150));
    this.add(makeWidget(g, bool('autoJump', 'Auto-Jump'), w / 2 - 155, y + 72, 150));
    this.add(makeWidget(g, bool('touchscreen', 'Touchscreen Mode', 'Shows on-screen controls for touch devices'), w / 2 + 5, y + 72, 150, () => g.setupTouch && g.setupTouch()));
    this.add(new Button(w / 2 - 100, Math.floor(h / 6) + 168, 200, 20, 'Done', () => this.onClose()));
  }
  onClose() { this.gui.game.options.save(); this.gui.setScreen(this.parent); }
}

export class MouseScreen extends OptionsListScreen {
  constructor(parent) {
    super(parent, 'Mouse Settings', [
      slider('sensitivity', 'Sensitivity', 0, 1, 0.01, (v) => (v === 0 ? '*yawn*' : v === 1 ? 'HYPERSPEED!!!' : `${Math.round(v * 200)}%`)),
      bool('invertMouse', 'Invert Mouse'),
      slider('scrollSensitivity', 'Scroll Sensitivity', 0.1, 10, 0.1, (v) => `${v.toFixed(1)}x`),
      bool('discreteScrolling', 'Discrete Scrolling'),
      bool('touchscreen', 'Touchscreen Mode'),
      cycle('mainHand', 'Main Hand', [['right', 'Right'], ['left', 'Left']]),
    ]);
  }
}

export class KeyBindsScreen extends Screen {
  constructor(parent) { super('Key Binds'); this.parent = parent; this.pauses = parent.pauses; this.titleY = 8; this.waiting = null; }
  init() {
    const w = this.width, h = this.height, g = this.gui.game;
    const entries = [];
    for (const [cat, keys] of BINDING_CATEGORIES) {
      entries.push({ header: cat });
      for (const k of keys) entries.push({ key: k });
    }
    for (const e of entries) {
      if (e.header) continue;
      e.btn = new Button(0, 0, 75, 20, () => (this.waiting === e.key ? '> ' + keyName(g.input.bindings[e.key]) + ' <' : keyName(g.input.bindings[e.key])), () => { this.waiting = e.key; });
      e.reset = new Button(0, 0, 50, 20, 'Reset', () => { g.input.bindings[e.key] = DEFAULT_BINDINGS[e.key]; this.save(); }, {});
      e.onClick = (gui, mx, my, b) => { for (const wd of [e.btn, e.reset]) if (wd.contains(mx, my)) { if (wd.active) wd.mouseDown(gui, mx, my, 0); return true; } if (this.waiting) { g.input.bindings[this.waiting] = 'Mouse' + b; this.waiting = null; this.save(); } return false; };
    }
    this.list = this.add(new ScrollList(0, 32, w, h - 32 - 32, 20, {
      rowWidth: 340, selectable: false,
      renderEntry: (gui, e, x, y) => {
        if (e.header) { gui.font.drawCentered(gui.ctx, '§l' + e.header, x + 170, y + 6, 0xffffff); return; }
        gui.font.draw(gui.ctx, BINDING_NAMES[e.key], x + 90 - gui.font.width(BINDING_NAMES[e.key]) + 60, y + 5, 0xffffff);
        const cur = g.input.bindings[e.key];
        const conflict = Object.entries(g.input.bindings).some(([k, v]) => k !== e.key && v === cur);
        e.btn.x = x + 160; e.btn.y = y - 2; e.reset.x = x + 240; e.reset.y = y - 2;
        e.reset.active = cur !== DEFAULT_BINDINGS[e.key];
        e.btn.render(gui, gui.mouseX, gui.mouseY);
        if (conflict) fill(gui.ctx, e.btn.x - 6, e.btn.y, 3, 20, '#ff5555');
        e.reset.render(gui, gui.mouseX, gui.mouseY);
      },
    }));
    this.list.entries = entries;
    this.add(new Button(w / 2 - 155, h - 28, 150, 20, 'Reset Keys', () => { g.input.bindings = { ...DEFAULT_BINDINGS }; this.save(); }));
    this.add(new Button(w / 2 + 5, h - 28, 150, 20, 'Done', () => this.onClose()));
  }
  save() { const g = this.gui.game; g.options.set('keyBindings', { ...g.input.bindings }); }
  keyDown(e) {
    if (this.waiting) {
      const g = this.gui.game;
      g.input.bindings[this.waiting] = e.key === 'Escape' ? null : e.code;
      this.waiting = null; this.save();
      return true;
    }
    return super.keyDown(e);
  }
  onClose() { this.gui.setScreen(this.parent); }
}

export class SoundScreen extends OptionsListScreen {
  constructor(parent) {
    const pct = (v) => (v === 0 ? 'OFF' : `${Math.round(v * 100)}%`);
    super(parent, 'Music & Sound Options', [
      { ...slider('volume_master', 'Master Volume', 0, 1, 0.01, pct), wide: true },
      slider('volume_music', 'Music', 0, 1, 0.01, pct), slider('volume_record', 'Jukebox/Note Blocks', 0, 1, 0.01, pct),
      slider('volume_weather', 'Weather', 0, 1, 0.01, pct), slider('volume_block', 'Blocks', 0, 1, 0.01, pct),
      slider('volume_hostile', 'Hostile Creatures', 0, 1, 0.01, pct), slider('volume_neutral', 'Friendly Creatures', 0, 1, 0.01, pct),
      slider('volume_player', 'Players', 0, 1, 0.01, pct), slider('volume_ambient', 'Ambient/Environment', 0, 1, 0.01, pct),
      slider('volume_voice', 'Voice/Speech', 0, 1, 0.01, pct), bool('showSubtitles', 'Show Subtitles'),
      bool('directionalAudio', 'Directional Audio'),
    ]);
  }
}

export class ChatOptionsScreen extends OptionsListScreen {
  constructor(parent) {
    const pct = (v) => `${Math.round(v * 100)}%`;
    super(parent, 'Chat Settings...', [
      cycle('chatVisibility', 'Chat', [['shown', 'Shown'], ['commands', 'Commands Only'], ['hidden', 'Hidden']]), bool('chatColors', 'Colors'),
      bool('chatLinks', 'Web Links'), cycle('narrator', 'Narrator', [['off', 'OFF']]),
      slider('chatOpacity', 'Chat Text Opacity', 0.1, 1, 0.01, pct), slider('textBackgroundOpacity', 'Text Background Opacity', 0, 1, 0.01, pct),
      slider('chatScale', 'Text Size', 0, 1, 0.01, pct), slider('chatLineSpacing', 'Line Spacing', 0, 1, 0.01, pct),
      slider('chatDelay', 'Chat Delay', 0, 6, 0.1, (v) => (v === 0 ? 'None' : `${v.toFixed(1)} seconds`)), slider('chatWidth', 'Width', 0.25, 1, 0.01, (v) => `${Math.round(v * 320)}px`),
      slider('chatHeightFocused', 'Focused Height', 0.2, 1, 0.01, (v) => `${Math.round(v * 180)}px`), slider('chatHeightUnfocused', 'Unfocused Height', 0.2, 1, 0.01, (v) => `${Math.round(v * 180)}px`),
      bool('hideMatchedNames', 'Hide Matched Names'), bool('onlineMemberList', 'Show Online Members'),
    ]);
  }
}

export class SkinScreen extends OptionsListScreen {
  constructor(parent) {
    super(parent, 'Skin Customization', [
      bool('skinCape', 'Cape'), bool('skinJacket', 'Jacket'), bool('skinLeftSleeve', 'Left Sleeve'), bool('skinRightSleeve', 'Right Sleeve'),
      bool('skinLeftPants', 'Left Pants Leg'), bool('skinRightPants', 'Right Pants Leg'), bool('skinHat', 'Hat'), cycle('mainHand', 'Main Hand', [['right', 'Right'], ['left', 'Left']]),
    ]);
  }
}

export class AccessibilityScreen extends OptionsListScreen {
  constructor(parent) {
    const pct = (v) => `${Math.round(v * 100)}%`;
    super(parent, 'Accessibility Settings', [
      cycle('narrator', 'Narrator', [['off', 'OFF']]), bool('showSubtitles', 'Show Subtitles'),
      bool('highContrast', 'High Contrast'), bool('autoJump', 'Auto-Jump'),
      slider('textBackgroundOpacity', 'Text Background Opacity', 0, 1, 0.01, pct), slider('chatOpacity', 'Chat Text Opacity', 0.1, 1, 0.01, pct),
      slider('notificationTime', 'Notification Time', 0.5, 10, 0.5, (v) => `${v}x`), bool('viewBobbing', 'View Bobbing'),
      slider('distortionEffects', 'Distortion Effects', 0, 1, 0.01, pct), bool('fovEffects', 'FOV Effects'),
      slider('damageTiltStrength', 'Damage Tilt', 0, 1, 0.01, pct), slider('glintSpeed', 'Glint Speed', 0, 1, 0.01, pct),
      slider('glintStrength', 'Glint Strength', 0, 1, 0.01, pct), bool('hideLightningFlash', 'Hide Lightning Flashes'),
      bool('monochromeLogo', 'Monochrome Logo'), slider('panoramaSpeed', 'Panorama Scroll Speed', 0, 1, 0.01, pct),
      bool('hideSplashTexts', 'Hide Splash Texts'), slider('menuBackgroundBlur', 'Menu Background Blur', 0, 10, 1),
    ]);
  }
}

export class LanguageScreen extends Screen {
  constructor(parent) { super('Language...'); this.parent = parent; this.pauses = parent.pauses; this.titleY = 16; }
  init() {
    const w = this.width, h = this.height;
    const list = this.add(new ScrollList(0, 32, w, h - 32 - 52, 18, { rowWidth: 220, renderEntry: (gui, e, x, y) => gui.font.drawCentered(gui.ctx, e, x + 110, y + 3, 0xffffff) }));
    list.entries = ['English (US)'];
    list.selected = 0;
    this.add(new Button(w / 2 - 155, h - 38, 150, 20, 'Font Settings...', null, { active: false }));
    this.add(new Button(w / 2 + 5, h - 38, 150, 20, 'Done', () => this.gui.setScreen(this.parent)));
  }
  render(gui, mx, my) { super.render(gui, mx, my); gui.font.drawCentered(gui.ctx, '(Language translations may not be 100% accurate)', this.width / 2, this.height - 56 + 2, 0x808080); }
}

export class ResourcePackScreen extends Screen {
  constructor(parent) { super('Select Resource Packs'); this.parent = parent; this.pauses = parent.pauses; this.titleY = 16; }
  init() {
    const w = this.width, h = this.height;
    this.add(new Button(w / 2 - 154, h - 48, 150, 20, 'Open Pack Folder', null, { active: false }));
    this.add(new Button(w / 2 + 4, h - 48, 150, 20, 'Done', () => this.gui.setScreen(this.parent)));
  }
  render(gui, mx, my) {
    super.render(gui, mx, my);
    const ctx = gui.ctx, f = gui.font, w = this.width;
    f.drawCentered(ctx, 'Drag and drop files into this window to add packs', w / 2, 28, 0x808080);
    const lx = w / 2 - 204, rx = w / 2 + 4;
    for (const [x, title] of [[lx, 'Available'], [rx, 'Selected']]) {
      f.drawCentered(ctx, '§l§n' + title, x + 100, 48, 0xffffff);
      fill(ctx, x, 60, 200, this.height - 120, 'rgba(0,0,0,0.4)');
    }
    fill(ctx, rx + 4, 64, 32, 32, '#5a8a3a');
    gui.icons.draw(ctx, ITEM.grass_block, rx + 12, 72, 16);
    f.draw(ctx, 'Default', rx + 40, 66, 0xffffff);
    f.draw(ctx, 'The default look and feel', rx + 40, 77, 0x808080);
    f.draw(ctx, 'of Minecraft_Lite', rx + 40, 86, 0x808080);
  }
}

export class TelemetryScreen extends Screen {
  constructor(parent) { super('Telemetry Data Collection'); this.parent = parent; this.pauses = parent.pauses; }
  init() { this.add(new Button(this.width / 2 - 100, this.height - 28, 200, 20, 'Done', () => this.gui.setScreen(this.parent))); }
  render(gui, mx, my) {
    super.render(gui, mx, my);
    gui.font.wrap('Minecraft_Lite runs entirely in your browser and does not collect or send any telemetry data. Your worlds are saved locally in this browser only.', 300)
      .forEach((l, i) => gui.font.drawCentered(gui.ctx, l, this.width / 2, 50 + i * 10, 0xffffff));
  }
}

export class CreditsScreen extends Screen {
  constructor(parent) { super(''); this.parent = parent; this.pauses = parent.pauses; this.scroll = 0; }
  init() { this.add(new Button(this.width / 2 - 100, this.height - 28, 200, 20, 'Done', () => this.gui.setScreen(this.parent))); }
  tick() { this.scroll += 0.5; }
  render(gui, mx, my) {
    this.renderBackground();
    const lines = ['§e§lMINECRAFT_LITE', '', 'A Minecraft-style sandbox game for the web.', '', '§eGame design inspired by', 'Minecraft by Mojang Studios', '', 'This is an unofficial fan project.', 'It is not affiliated with or endorsed by', 'Mojang Studios or Microsoft.', '', '§eBuilt with', 'Three.js (MIT License)', 'esbuild', '', '§eAll textures, sounds and music', 'are generated procedurally by code.', '', '§eThanks for playing!'];
    lines.forEach((l, i) => { const y = this.height - this.scroll + i * 12; if (y > -10 && y < this.height - 34) gui.font.drawCentered(gui.ctx, l, this.width / 2, y, 0xffffff); });
    if (this.scroll > this.height + lines.length * 12) this.scroll = 0;
    for (const w of this.widgets) w.render(gui, mx, my);
  }
}
