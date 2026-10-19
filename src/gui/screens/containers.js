// Container screens: survival inventory, crafting table, furnace, chest, creative inventory.
import { Screen } from '../screen.js';
import { TextField } from '../widgets.js';
import { drawPanel, drawSlot, fill, ICONS, sprite } from '../draw.js';
import { Menu, Slot, SimpleContainer } from '../../game/inventory.js';
import { ITEMS, ITEM, CREATIVE_TABS } from '../../registry/items.js';
import { ItemStack } from '../../game/itemstack.js';
import { skinFor } from '../../render/models.js';

const SLOT_BG = {
  armor_head: sprite('bg_head', ['..........', '..kkkkkk..', '.k......k.', '.k.kkkk.k.', '.k.k..k.k.', '..........'], { k: 'rgba(55,55,55,0.45)' }),
  armor_chest: sprite('bg_chest', ['.kk...kk.', 'k..k.k..k', 'k...k...k', '.k.....k.', '.k.....k.', '.k.....k.', '.kkkkkkk.'], { k: 'rgba(55,55,55,0.45)' }),
  armor_legs: sprite('bg_legs', ['.kkkkkkk.', '.k.....k.', '.k..k..k.', '.k.k.k.k.', '.k.k.k.k.', '.k.k.k.k.', '.kk...kk.'], { k: 'rgba(55,55,55,0.45)' }),
  armor_feet: sprite('bg_feet', ['.........', '.kk...kk.', '.kk...kk.', 'k.k..k.k.', 'kkk..kkk.'], { k: 'rgba(55,55,55,0.45)' }),
  shield: sprite('bg_shield', ['kkkkkkkk', 'k......k', 'k......k', 'k......k', '.k....k.', '..k..k..', '...kk...'], { k: 'rgba(55,55,55,0.45)' }),
};

export class ContainerScreen extends Screen {
  constructor(menu, title, iw = 176, ih = 166) {
    super(title);
    this.menu = menu; this.iw = iw; this.ih = ih;
    this.dragging = false; this.dragButton = 0; this.lastClick = { time: 0, slot: -1 };
  }
  get left() { return Math.floor((this.width - this.iw) / 2); }
  get top() { return Math.floor((this.height - this.ih) / 2); }
  renderBackground() { fill(this.gui.ctx, 0, 0, this.width, this.height, 'rgba(16,16,16,0.75)'); }
  drawBg() {}
  drawLabels() {}
  slotAt(mx, my) {
    const L = this.left, T = this.top;
    for (let i = 0; i < this.menu.slots.length; i++) {
      const s = this.menu.slots[i];
      if (s.hidden) continue;
      if (mx >= L + s.x - 1 && mx < L + s.x + 17 && my >= T + s.y - 1 && my < T + s.y + 17) return i;
    }
    return -1;
  }
  isOutside(mx, my) { return mx < this.left || my < this.top || mx >= this.left + this.iw || my >= this.top + this.ih; }
  render(gui, mx, my) {
    const ctx = gui.ctx;
    this.renderBackground();
    const L = this.left, T = this.top;
    drawPanel(ctx, L, T, this.iw, this.ih);
    for (const s of this.menu.slots) { if (s.hidden) continue; s.result && s.big ? null : drawSlot(ctx, L + s.x - 1, T + s.y - 1); }
    this.drawBg(gui, mx, my);
    this.drawLabels(gui);
    const hov = this.slotAt(mx, my);
    for (let i = 0; i < this.menu.slots.length; i++) {
      const s = this.menu.slots[i];
      if (s.hidden) continue;
      if (!s.hasItem() && s.bg && SLOT_BG[s.bg]) { const b = SLOT_BG[s.bg]; ctx.drawImage(b, L + s.x + Math.floor((16 - b.width) / 2), T + s.y + Math.floor((16 - b.height) / 2)); }
      const dragPreview = this.dragging && this.menu.dragSlots.has(i) && this.menu.dragSlots.size > 1 && this.menu.carried;
      if (dragPreview) fill(ctx, L + s.x, T + s.y, 16, 16, 'rgba(255,255,255,0.5)');
      gui.drawItem(s.stack, L + s.x, T + s.y);
      if (i === hov) fill(ctx, L + s.x, T + s.y, 16, 16, 'rgba(255,255,255,0.5)');
    }
    for (const w of this.widgets) w.render(gui, mx, my);
    this.drawForeground && this.drawForeground(gui, mx, my);
    const c = this.menu.carried;
    if (c) gui.drawItem(c, mx - 8, my - 8);
    else if (hov >= 0 && this.menu.slots[hov].hasItem()) gui.drawTooltip(gui.itemTooltip(this.menu.slots[hov].stack, gui.game.advancedTooltips), mx, my);
  }
  mouseDown(mx, my, btn) {
    for (const w of this.widgets) if (w.contains(mx, my)) { this.setFocus(w); w.mouseDown(this.gui, mx, my, btn); return true; }
    const g = this.gui.game;
    const idx = this.slotAt(mx, my);
    if (idx < 0) {
      if (this.isOutside(mx, my)) this.menu.click(-999, btn === 2 ? 1 : btn === 0 ? 0 : 1, 'pickup', g);
      return true;
    }
    const button = btn === 2 ? 1 : btn === 1 ? 2 : 0;
    const now = performance.now();
    if (button === 0 && this.lastClick.slot === idx && now - this.lastClick.time < 250 && this.menu.carried && !this.gui.shift) {
      this.menu.click(idx, 0, 'pickup_all', g);
      this.lastClick.time = 0;
      return true;
    }
    this.lastClick = { time: now, slot: idx };
    if (button === 2) { if (g.player.gameMode === 1) this.menu.click(idx, 2, 'clone', g); return true; }
    if (this.gui.shift) { this.menu.click(idx, button, 'quick', g); return true; }
    if (this.menu.carried && !this.menu.slots[idx].result) {
      this.dragging = true; this.dragButton = button;
      this.menu.dragSlots = new Set([idx]);
      return true;
    }
    this.menu.click(idx, button, 'pickup', g);
    return true;
  }
  mouseMove(mx, my) {
    if (this.dragging) {
      const idx = this.slotAt(mx, my);
      if (idx >= 0 && !this.menu.slots[idx].result) this.menu.dragSlots.add(idx);
    }
  }
  mouseUp(mx, my, btn) {
    if (!this.dragging) return;
    this.dragging = false;
    const g = this.gui.game;
    if (this.menu.dragSlots.size <= 1) {
      const idx = [...this.menu.dragSlots][0];
      this.menu.dragSlots.clear();
      if (idx !== undefined) this.menu.click(idx, this.dragButton, 'pickup', g);
    } else this.menu.dragEnd(this.dragButton);
    void btn;
  }
  keyDown(e) {
    const g = this.gui.game, b = g.input.bindings;
    if (this.focusedWidget && this.focusedWidget.keyDown(this.gui, e)) return true;
    if (e.key === 'Escape' || (e.code === b.inventory && !(this.focusedWidget && this.focusedWidget.insert))) { this.onClose(); return true; }
    const idx = this.slotAt(this.gui.mouseX, this.gui.mouseY);
    if (idx >= 0) {
      for (let i = 1; i <= 9; i++) if (e.code === b['hotbar' + i]) { this.menu.click(idx, i - 1, 'swap', g); return true; }
      if (e.code === b.swapOffhand) { this.menu.click(idx, 40, 'swap', g); return true; }
      if (e.code === b.drop) { this.menu.click(idx, e.ctrlKey ? 1 : 0, 'throw', g); return true; }
    }
    return false;
  }
  onClose() { this.gui.setScreen(null); }
}

function drawPlayerPreview(gui, x, y, w, h) {
  const ctx = gui.ctx;
  fill(ctx, x, y, w, h, '#000');
  const skin = skinFor('player');
  const s = Math.max(1, Math.floor(h / 34));
  const cx = x + Math.floor(w / 2), by = y + h - 3;
  const part = (sx, sy, sw, sh, dx, dy) => ctx.drawImage(skin, sx, sy, sw, sh, cx + dx * s, by + dy * s, sw * s, sh * s);
  part(4, 20, 4, 12, -4, -12); part(20, 52, 4, 12, 0, -12); // legs
  part(20, 20, 8, 12, -4, -24); // body
  part(44, 20, 4, 12, -8, -24); part(36, 52, 4, 12, 4, -24); // arms
  part(8, 8, 8, 8, -4, -32); // head
}

export class InventoryScreen extends ContainerScreen {
  constructor(menu) { super(menu, ''); }
  drawBg(gui, mx, my) {
    const L = this.left, T = this.top, ctx = gui.ctx;
    drawPlayerPreview(gui, L + 26, T + 8, 49, 70);
    ctx.drawImage(ICONS.arrowRight, L + 135, T + 29, 16, 11);
    ctx.drawImage(ICONS.recipeBook, L + 104, T + 61);
    void mx; void my;
  }
  drawLabels(gui) { gui.font.draw(gui.ctx, 'Crafting', this.left + 97, this.top + 8, 0x404040, false); }
  mouseDown(mx, my, btn) {
    const L = this.left, T = this.top;
    if (mx >= L + 104 && mx < L + 124 && my >= T + 61 && my < T + 79) { this.gui.game.showActionbar('The recipe book is not available in Minecraft_Lite'); return true; }
    return super.mouseDown(mx, my, btn);
  }
}

export class CraftingScreen extends ContainerScreen {
  constructor(menu) { super(menu, 'Crafting'); menu.slots[0].big = true; }
  drawBg(gui) {
    const L = this.left, T = this.top, ctx = gui.ctx;
    bigSlot(ctx, L + 120, T + 31);
    ctx.drawImage(ICONS.arrowRight, L + 90, T + 35);
    ctx.drawImage(ICONS.recipeBook, L + 5, T + 34);
  }
  drawLabels(gui) { gui.font.draw(gui.ctx, 'Crafting', this.left + 29, this.top + 6, 0x404040, false); gui.font.draw(gui.ctx, 'Inventory', this.left + 8, this.top + 72, 0x404040, false); }
}
function bigSlot(ctx, x, y) {
  fill(ctx, x, y, 26, 26, '#8b8b8b');
  fill(ctx, x, y, 25, 1, '#373737'); fill(ctx, x, y, 1, 25, '#373737');
  fill(ctx, x + 1, y + 25, 25, 1, '#fff'); fill(ctx, x + 25, y + 1, 1, 25, '#fff');
}

export class FurnaceScreen extends ContainerScreen {
  constructor(menu, title) { super(menu, title); menu.slots[2].big = true; }
  drawBg(gui) {
    const L = this.left, T = this.top, ctx = gui.ctx;
    const f = this.menu.furnace;
    bigSlot(ctx, L + 112, T + 31);
    ctx.drawImage(ICONS.flameEmpty, L + 56, T + 36);
    if (f.burnTime > 0 && f.burnDuration > 0) {
      const h = Math.ceil(f.burnTime / f.burnDuration * 13) + 1;
      ctx.drawImage(ICONS.flameFull, 0, 14 - h, 14, h, L + 56, T + 36 + 14 - h, 14, h);
    }
    ctx.drawImage(ICONS.arrowRight, L + 79, T + 34);
    if (f.cookTime > 0) {
      const w = Math.ceil(f.cookTime / f.cookTotal * 24);
      ctx.drawImage(ICONS.arrowRightFill, 0, 0, Math.min(22, w), 11, L + 79, T + 34, Math.min(22, w), 11);
    }
    ctx.drawImage(ICONS.recipeBook, L + 20, T + 34);
  }
  drawLabels(gui) { const f = gui.font; f.drawCentered(gui.ctx, this.title, this.left + 88, this.top + 6, 0x404040, false); f.draw(gui.ctx, 'Inventory', this.left + 8, this.top + 72, 0x404040, false); }
}

export class ChestScreen extends ContainerScreen {
  constructor(menu, title) { super(menu, title, 176, 114 + menu.rows * 18); }
  drawLabels(gui) { gui.font.draw(gui.ctx, this.title, this.left + 8, this.top + 6, 0x404040, false); gui.font.draw(gui.ctx, 'Inventory', this.left + 8, this.top + this.ih - 94, 0x404040, false); }
}

// ---------------------------------------------------------------------------
// Creative inventory
class CreativeMenu extends Menu {
  constructor(player) {
    super(player);
    this.mode = 'items';
    this.gridC = new SimpleContainer(45);
    this.gridStart = 0;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 9; c++) { const s = new Slot(this.gridC, r * 9 + c, 9 + c * 18, 18 + r * 18); s.creative = true; this.slots.push(s); }
    this.hotStart = this.slots.length;
    for (let c = 0; c < 9; c++) this.slots.push(new Slot(this.inv, c, 9 + c * 18, 112));
    // survival-tab slots
    this.survStart = this.slots.length;
    const armor = [['head', 39], ['chest', 38], ['legs', 37], ['feet', 36]];
    armor.forEach(([slot, idx], i) => { const s = new Slot(this.inv, idx, 54 + Math.floor(i / 2) * 54, 6 + (i % 2) * 27, { max: 1, bg: 'armor_' + slot, filter: (st) => st.item.armor && st.item.armor.slot === slot }); s.surv = true; this.slots.push(s); });
    const off = new Slot(this.inv, 40, 35, 20, { bg: 'shield' }); off.surv = true; this.slots.push(off);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) { const s = new Slot(this.inv, 9 + r * 9 + c, 9 + c * 18, 54 + r * 18); s.surv = true; this.slots.push(s); }
    this.invStart = this.survStart + 5; this.hotbarStart = this.hotStart; this.invEnd = this.hotStart + 9;
    this.setMode('items');
  }
  setMode(m) {
    this.mode = m;
    for (const s of this.slots) s.hidden = m === 'items' ? !!s.surv : !!s.creative;
  }
  quickMove(i) {
    const sl = this.slots[i], s = sl.stack;
    if (i >= this.hotStart && i < this.hotStart + 9) { for (let k = this.invStart; k < this.invStart + 27; k++) { if (this.mode !== 'inventory') break; } if (this.mode === 'inventory') this.moveTo(s, this.invStart, this.invStart + 27); else { sl.stack = null; return; } }
    else if (sl.surv) this.moveTo(s, this.hotStart, this.hotStart + 9);
    if (s && s.count <= 0) sl.stack = null;
  }
}

export class CreativeScreen extends ContainerScreen {
  constructor(player) {
    super(new CreativeMenu(player), '', 195, 136);
    this.player = player;
    this.tab = CreativeScreen.lastTab || 'building';
    this.scroll = 0; this.items = [];
    this.searchText = '';
  }
  init() {
    this.search = new TextField(this.left + 82, this.top + 6, 89, 9, this.searchText, { bordered: false, maxLength: 50, color: 0xffffff, onChange: (t) => { this.searchText = t; this.scroll = 0; this.refreshItems(); } });
    this.widgets = [];
    if (this.tab === 'search') { this.add(this.search); this.setFocus(this.search); }
    this.refreshItems();
  }
  tabs() {
    const top = [], bottom = [];
    for (const t of CREATIVE_TABS) {
      if (t.hidden) continue;
      if (['building', 'colored', 'natural', 'functional', 'redstone', 'hotbar', 'search'].includes(t.id)) top.push(t); else bottom.push(t);
    }
    return { top, bottom };
  }
  tabRect(t) {
    const { top, bottom } = this.tabs();
    const L = this.left, T = this.top;
    let i = top.indexOf(t), isTop = true;
    if (i < 0) { i = bottom.indexOf(t); isTop = false; }
    const list = isTop ? top : bottom;
    let col = i;
    if (t.id === 'search' || t.id === 'inventory') col = 6;
    else if (t.id === 'hotbar') col = 5;
    void list;
    return { x: L + col * 27, y: isTop ? T - 28 : T + this.ih - 4, w: 26, h: 32, isTop };
  }
  refreshItems() {
    let list;
    if (this.tab === 'search') {
      const q = this.searchText.toLowerCase();
      list = ITEMS.filter((it) => it.id && !it.hidden && it.tab && it.tab !== 'op' && (!q || it.displayName.toLowerCase().includes(q) || it.name.includes(q)));
    } else if (this.tab === 'hotbar') {
      list = [];
      const hb = this.gui ? this.gui.game.hotbars : [];
      for (let i = 0; i < 9; i++) {
        const row = hb[i];
        for (let k = 0; k < 9; k++) list.push(row && row[k] ? ItemStack.fromJSON(row[k]) : null);
      }
      this.items = list;
      this.menu.setMode('items');
      this.fillGrid();
      return;
    } else if (this.tab === 'inventory') { this.menu.setMode('inventory'); return; }
    else list = ITEMS.filter((it) => it.tab === this.tab && !it.hidden);
    this.menu.setMode('items');
    this.items = list.map((it) => new ItemStack(it, 1));
    this.fillGrid();
  }
  rows() { return Math.ceil(this.items.length / 9); }
  fillGrid() {
    const maxScroll = Math.max(0, this.rows() - 5);
    this.scroll = Math.max(0, Math.min(maxScroll, this.scroll));
    for (let i = 0; i < 45; i++) {
      const s = this.items[this.scroll * 9 + i];
      this.menu.gridC.slots[i] = s ? s.copy(1) : null;
    }
  }
  wheel(mx, my, dy) { if (this.tab === 'inventory') return true; this.scroll += dy > 0 ? 1 : -1; this.fillGrid(); return true; }
  render(gui, mx, my) {
    const ctx = gui.ctx, L = this.left, T = this.top;
    this.renderBackground();
    // inactive tabs behind
    for (const t of CREATIVE_TABS) { if (t.hidden || t.id === this.tab) continue; this.drawTab(gui, t, false); }
    drawPanel(ctx, L, T, this.iw, this.ih);
    this.drawTab(gui, CREATIVE_TABS.find((t) => t.id === this.tab), true);
    if (this.tab !== 'inventory') {
      // scrollbar
      fill(ctx, L + 174, T + 17, 14, 114, '#8b8b8b');
      fill(ctx, L + 174, T + 17, 13, 1, '#373737'); fill(ctx, L + 174, T + 17, 1, 113, '#373737');
      fill(ctx, L + 175, T + 130, 13, 1, '#fff'); fill(ctx, L + 187, T + 18, 1, 113, '#fff');
      const maxScroll = Math.max(0, this.rows() - 5);
      const ty = T + 18 + (maxScroll ? Math.round(this.scroll / maxScroll * (112 - 15)) : 0);
      fill(ctx, L + 175, ty, 12, 15, maxScroll ? '#c6c6c6' : '#a0a0a0');
      fill(ctx, L + 175, ty, 11, 1, '#fff'); fill(ctx, L + 175, ty, 1, 14, '#fff');
      fill(ctx, L + 176, ty + 14, 11, 1, '#555'); fill(ctx, L + 186, ty + 1, 1, 14, '#555');
      gui.font.draw(ctx, CREATIVE_TABS.find((t) => t.id === this.tab).name, L + 8, T + 6, 0x404040, false);
      if (this.tab === 'search') fill(ctx, L + 80, T + 4, 89, 12, '#000');
    } else {
      drawPlayerPreview(gui, L + 73, T + 6, 32, 43);
    }
    // destroy slot
    drawSlot(ctx, L + 172, T + 111);
    ctx.drawImage(ICONS.trash, L + 173, T + 112);
    // slots & items
    const hov = this.slotAt(mx, my);
    for (let i = 0; i < this.menu.slots.length; i++) {
      const s = this.menu.slots[i];
      if (s.hidden) continue;
      drawSlot(ctx, L + s.x - 1, T + s.y - 1);
      if (!s.hasItem() && s.bg && SLOT_BG[s.bg]) { const b = SLOT_BG[s.bg]; ctx.drawImage(b, L + s.x + Math.floor((16 - b.width) / 2), T + s.y + Math.floor((16 - b.height) / 2)); }
      gui.drawItem(s.stack, L + s.x, T + s.y, s.creative ? { countText: '' } : {});
      if (i === hov) fill(ctx, L + s.x, T + s.y, 16, 16, 'rgba(255,255,255,0.5)');
    }
    const onTrash = mx >= L + 173 && mx < L + 189 && my >= T + 112 && my < T + 128;
    if (onTrash) fill(ctx, L + 173, T + 112, 16, 16, 'rgba(255,255,255,0.5)');
    for (const w of this.widgets) w.render(gui, mx, my);
    if (this.tab === 'search' && !this.searchText && !this.search.focused) gui.font.draw(ctx, 'Search...', L + 82, T + 6, 0x808080, false);
    const c = this.menu.carried;
    if (c) gui.drawItem(c, mx - 8, my - 8);
    else if (hov >= 0 && this.menu.slots[hov].hasItem()) gui.drawTooltip(gui.itemTooltip(this.menu.slots[hov].stack, gui.game.advancedTooltips), mx, my);
    else if (onTrash) gui.drawTooltip(['Destroy Item'], mx, my);
    else {
      for (const t of CREATIVE_TABS) { if (t.hidden) continue; const r = this.tabRect(t); if (mx >= r.x && mx < r.x + 26 && my >= r.y + (r.isTop ? 0 : 4) && my < r.y + 28 + (r.isTop ? 0 : 4)) gui.drawTooltip([t.name], mx, my); }
    }
  }
  drawTab(gui, t, active) {
    const ctx = gui.ctx;
    const r = this.tabRect(t);
    const y = r.isTop ? r.y + (active ? 0 : 2) : r.y + (active ? 0 : -2);
    const h = active ? 32 : 28;
    const yy = r.isTop ? y : y + (active ? 0 : 4);
    fill(ctx, r.x + 1, yy, 24, h, active ? '#c6c6c6' : '#8b8b8b');
    fill(ctx, r.x, yy + (r.isTop ? 1 : 0), 1, h - 1, '#000'); fill(ctx, r.x + 25, yy + (r.isTop ? 1 : 0), 1, h - 1, '#000');
    if (r.isTop) { fill(ctx, r.x + 1, yy, 24, 1, '#000'); fill(ctx, r.x + 1, yy + 1, 23, 2, '#fff'); fill(ctx, r.x + 1, yy + 1, 2, h - 2, '#fff'); }
    else { fill(ctx, r.x + 1, yy + h - 1, 24, 1, '#000'); fill(ctx, r.x + 23, yy, 2, h - 2, '#555'); fill(ctx, r.x + 1, yy + h - 3, 23, 2, '#555'); }
    const icon = ITEM[t.icon] || ITEM.stone;
    gui.icons.draw(ctx, icon, r.x + 5, (r.isTop ? yy + 9 : yy + 7) + (active ? (r.isTop ? 0 : 2) : 0), 16);
  }
  mouseDown(mx, my, btn) {
    const g = this.gui.game, L = this.left, T = this.top;
    // tabs
    for (const t of CREATIVE_TABS) {
      if (t.hidden) continue;
      const r = this.tabRect(t);
      if (mx >= r.x && mx < r.x + 26 && my >= r.y && my < r.y + 32 && !(my >= T && my < T + this.ih)) {
        if (this.tab !== t.id) { this.tab = t.id; CreativeScreen.lastTab = t.id; this.scroll = 0; this.gui.playClick(); this.init(); }
        return true;
      }
    }
    // scrollbar drag
    if (this.tab !== 'inventory' && mx >= L + 175 && mx < L + 187 && my >= T + 18 && my < T + 130) { this.scrollDrag = true; this.mouseMove(mx, my); return true; }
    // trash
    if (mx >= L + 173 && mx < L + 189 && my >= T + 112 && my < T + 128) {
      if (this.menu.carried) this.menu.carried = null;
      else if (this.gui.shift) { for (let i = 0; i < 41; i++) this.player.inventory.slots[i] = null; }
      return true;
    }
    for (const w of this.widgets) if (w.contains(mx, my)) { this.setFocus(w); w.mouseDown(this.gui, mx, my, btn); return true; }
    const idx = this.slotAt(mx, my);
    if (idx >= 0 && this.menu.slots[idx].creative) {
      const s = this.menu.slots[idx];
      if (this.menu.carried) { this.menu.carried = null; return true; }
      if (!s.hasItem()) return true;
      if (this.tab === 'hotbar') {
        const row = Math.floor((this.scroll * 9 + idx) / 9);
        const hb = g.hotbars[row];
        if (hb) hb.forEach((j, k) => { this.player.inventory.slots[k] = j ? ItemStack.fromJSON(j) : null; });
        return true;
      }
      const it = s.stack.item;
      if (this.gui.shift) { const st = new ItemStack(it, it.maxStack); this.player.inventory.add(st); return true; }
      this.menu.carried = new ItemStack(it, btn === 2 ? 1 : btn === 1 ? it.maxStack : it.maxStack);
      return true;
    }
    return super.mouseDown(mx, my, btn);
  }
  mouseMove(mx, my) {
    if (this.scrollDrag) {
      const maxScroll = Math.max(0, this.rows() - 5);
      this.scroll = Math.round(Math.max(0, Math.min(1, (my - this.top - 18 - 7) / (112 - 15))) * maxScroll);
      this.fillGrid();
      return;
    }
    super.mouseMove(mx, my);
  }
  mouseUp(mx, my, btn) { this.scrollDrag = false; super.mouseUp(mx, my, btn); }
  keyDown(e) {
    if (this.tab === 'search' && this.search.focused) {
      if (e.key === 'Escape') { this.onClose(); return true; }
      if (this.search.keyDown(this.gui, e)) return true;
      if (e.key.length === 1) return false;
      return true;
    }
    if (e.key.length === 1 && /[a-zA-Z]/.test(e.key) && e.code !== this.gui.game.input.bindings.inventory && this.tab !== 'inventory' && !e.ctrlKey && !['KeyQ', 'KeyF'].includes(e.code) && !/Digit/.test(e.code)) {
      // typing switches to the search tab like Minecraft
      this.tab = 'search'; CreativeScreen.lastTab = 'search'; this.searchText = ''; this.init();
      return false;
    }
    return super.keyDown(e);
  }
  charTyped(ch) { if (this.tab === 'search') { this.setFocus(this.search); return this.search.charTyped(this.gui, ch); } return false; }
  tick() { super.tick(); if (this.search) this.search.tick(); }
  onClose() {
    if (this.menu.carried) this.menu.carried = null;
    this.gui.setScreen(null);
  }
}
