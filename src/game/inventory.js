// Inventories, slots and container menus with Minecraft's click behaviour.
import { ItemStack } from './itemstack.js';
import { findRecipe, fuelValue, smeltingResult } from './recipes.js';

export class SimpleContainer {
  constructor(size) { this.slots = new Array(size).fill(null); this.size = size; this.listeners = []; }
  get(i) { return this.slots[i]; }
  set(i, s) { this.slots[i] = s && !s.isEmpty() ? s : null; this.changed(); }
  changed() { for (const l of this.listeners) l(this); }
  isEmpty() { return this.slots.every((s) => !s); }
  toJSON() { return this.slots.map((s) => (s ? s.toJSON() : null)); }
  load(arr) { if (arr) arr.forEach((s, i) => { if (i < this.size) this.slots[i] = ItemStack.fromJSON(s); }); }
}

export class PlayerInventory extends SimpleContainer {
  constructor(player) { super(41); this.player = player; this.selectedSlot = 0; }
  selected() { return this.slots[this.selectedSlot]; }
  setSelected(s) { this.set(this.selectedSlot, s); }
  offhand() { return this.slots[40]; }
  armor() { return [this.slots[39], this.slots[38], this.slots[37], this.slots[36]]; } // head, chest, legs, feet
  armorSlotFor(slot) { return { head: 39, chest: 38, legs: 37, feet: 36 }[slot]; }
  // add a stack; mutates stack.count and returns what is left (0 = everything added)
  add(stack) {
    if (!stack || stack.isEmpty()) return 0;
    const order = [...Array(9).keys(), ...Array.from({ length: 27 }, (_, i) => i + 9)];
    // merge with the selected slot / offhand first like MC
    const pref = [this.selectedSlot, 40];
    for (const i of [...pref, ...order]) {
      const s = this.slots[i];
      if (s && s.canStack(stack) && s.count < s.item.maxStack) {
        const n = Math.min(stack.count, s.item.maxStack - s.count);
        s.count += n; stack.count -= n;
        if (stack.count <= 0) { this.changed(); return 0; }
      }
    }
    for (const i of order) {
      if (!this.slots[i]) {
        const n = Math.min(stack.count, stack.item.maxStack);
        this.slots[i] = stack.copy(n);
        stack.count -= n;
        if (stack.count <= 0) { this.changed(); return 0; }
      }
    }
    this.changed();
    return stack.count;
  }
  count(name) { let n = 0; for (const s of this.slots) if (s && s.item.name === name) n += s.count; return n; }
  find(pred) { for (let i = 0; i < 36; i++) if (this.slots[i] && pred(this.slots[i])) return i; return -1; }
  removeItem(name, n) {
    for (let i = 0; i < this.slots.length && n > 0; i++) {
      const s = this.slots[i];
      if (s && s.item.name === name) { const k = Math.min(n, s.count); s.count -= k; n -= k; if (s.count <= 0) this.slots[i] = null; }
    }
    this.changed();
  }
  clear() { this.slots.fill(null); this.changed(); }
}

export class Slot {
  constructor(container, index, x, y, opts = {}) {
    this.container = container; this.index = index; this.x = x; this.y = y;
    this.filter = opts.filter || null; this.max = opts.max || 64; this.result = !!opts.result; this.bg = opts.bg || null;
    this.onTake = opts.onTake || null; this.onChange = opts.onChange || null;
  }
  get stack() { return this.container.slots[this.index]; }
  set stack(s) { this.container.slots[this.index] = s && !s.isEmpty() ? s : null; this.onChange && this.onChange(); }
  mayPlace(s) { if (this.result) return false; return !this.filter || this.filter(s); }
  maxFor(s) { return Math.min(this.max, s.item.maxStack); }
  hasItem() { return !!this.stack && !this.stack.isEmpty(); }
}

// ---------------------------------------------------------------------------
export class Menu {
  constructor(player) {
    this.player = player; this.slots = [];
    this.carried = null;
    this.dragSlots = new Set(); this.dragButton = -1;
  }
  get inv() { return this.player.inventory; }
  addPlayerSlots(x, y) {
    this.invStart = this.slots.length;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) this.slots.push(new Slot(this.inv, 9 + r * 9 + c, x + c * 18, y + r * 18));
    this.hotbarStart = this.slots.length;
    for (let c = 0; c < 9; c++) this.slots.push(new Slot(this.inv, c, x + c * 18, y + 58));
    this.invEnd = this.slots.length;
  }
  // move stack into slot range; returns true if anything moved
  moveTo(stack, start, end, reverse = false) {
    let moved = false;
    if (stack.item.maxStack > 1) {
      for (let k = 0; k < end - start; k++) {
        const i = reverse ? end - 1 - k : start + k;
        const sl = this.slots[i];
        const s = sl.stack;
        if (s && s.canStack(stack) && sl.mayPlace(stack)) {
          const n = Math.min(stack.count, sl.maxFor(s) - s.count);
          if (n > 0) { s.count += n; stack.count -= n; moved = true; sl.onChange && sl.onChange(); }
          if (stack.count <= 0) return true;
        }
      }
    }
    for (let k = 0; k < end - start; k++) {
      const i = reverse ? end - 1 - k : start + k;
      const sl = this.slots[i];
      if (!sl.hasItem() && sl.mayPlace(stack)) {
        const n = Math.min(stack.count, sl.maxFor(stack));
        sl.stack = stack.copy(n);
        stack.count -= n; moved = true;
        if (stack.count <= 0) return true;
      }
    }
    return moved;
  }
  quickMove() { return null; }
  takeResult() {}
  slotsChanged() {}

  // Minecraft click semantics. mode: 'pickup' | 'quick' | 'swap' | 'clone' | 'throw' | 'pickup_all'
  click(idx, button, mode, game) {
    const creative = this.player.gameMode === 1;
    if (idx === -999) { // clicked outside
      if (this.carried) {
        if (button === 0) { game.dropFromPlayer(this.carried); this.carried = null; }
        else { game.dropFromPlayer(this.carried.copy(1)); this.carried.count--; if (this.carried.count <= 0) this.carried = null; }
      }
      return;
    }
    const sl = this.slots[idx];
    if (!sl) return;
    if (mode === 'quick') {
      if (sl.result) {
        // craft as many as possible
        let guard = 0;
        while (sl.hasItem() && guard++ < 64) {
          const s = sl.stack.copy();
          const end = this.invEnd;
          const test = s.copy();
          if (!this.canFit(test, this.invStart, end)) break;
          this.takeResult(sl, s.count);
          this.moveTo(s, this.invStart, end, true);
          this.slotsChanged();
        }
        return;
      }
      if (!sl.hasItem()) return;
      this.quickMove(idx);
      this.slotsChanged();
      return;
    }
    if (mode === 'swap') { // number key: button = hotbar index (0-8), 40 = offhand
      const hs = this.inv.slots[button];
      const cur = sl.stack;
      if (sl.result) {
        if (!hs && cur) { this.takeResult(sl, cur.count); this.inv.slots[button] = cur.copy(); this.slotsChanged(); }
        return;
      }
      if (hs && !sl.mayPlace(hs)) return;
      this.inv.slots[button] = cur ? cur.copy() : null;
      sl.stack = hs ? hs.copy() : null;
      this.slotsChanged();
      return;
    }
    if (mode === 'clone') {
      if (creative && sl.hasItem() && !this.carried) this.carried = sl.stack.copy(sl.stack.item.maxStack);
      return;
    }
    if (mode === 'throw') {
      if (this.carried || !sl.hasItem()) return;
      if (sl.result) { const s = sl.stack.copy(); this.takeResult(sl, s.count); game.dropFromPlayer(s); this.slotsChanged(); return; }
      const n = button === 1 ? sl.stack.count : 1;
      const s = sl.stack.copy(n);
      sl.stack.count -= n;
      if (sl.stack.count <= 0) sl.stack = null; else sl.onChange && sl.onChange();
      game.dropFromPlayer(s);
      this.slotsChanged();
      return;
    }
    if (mode === 'pickup_all') {
      if (!this.carried) return;
      for (const pass of [0, 1]) for (const o of this.slots) {
        if (o.result || !o.hasItem() || !o.stack.canStack(this.carried)) continue;
        if (pass === 0 && o.stack.count === o.stack.item.maxStack) continue;
        const n = Math.min(this.carried.item.maxStack - this.carried.count, o.stack.count);
        this.carried.count += n; o.stack.count -= n;
        if (o.stack.count <= 0) o.stack = null; else o.onChange && o.onChange();
        if (this.carried.count >= this.carried.item.maxStack) break;
      }
      this.slotsChanged();
      return;
    }
    // pickup
    const cur = sl.stack;
    if (sl.result) {
      if (!cur) return;
      if (!this.carried) { this.carried = cur.copy(); this.takeResult(sl, cur.count); }
      else if (this.carried.canStack(cur) && this.carried.count + cur.count <= this.carried.item.maxStack) { this.carried.count += cur.count; this.takeResult(sl, cur.count); }
      this.slotsChanged();
      return;
    }
    if (!this.carried) {
      if (!cur) return;
      if (button === 0) { this.carried = cur; sl.stack = null; }
      else { const n = Math.ceil(cur.count / 2); this.carried = cur.copy(n); cur.count -= n; if (cur.count <= 0) sl.stack = null; else sl.onChange && sl.onChange(); }
    } else if (!cur) {
      if (!sl.mayPlace(this.carried)) return;
      const n = button === 0 ? Math.min(this.carried.count, sl.maxFor(this.carried)) : 1;
      sl.stack = this.carried.copy(n);
      this.carried.count -= n;
      if (this.carried.count <= 0) this.carried = null;
    } else if (cur.canStack(this.carried)) {
      const n = button === 0 ? Math.min(this.carried.count, sl.maxFor(cur) - cur.count) : Math.min(1, sl.maxFor(cur) - cur.count);
      if (n > 0 && sl.mayPlace(this.carried)) { cur.count += n; this.carried.count -= n; if (this.carried.count <= 0) this.carried = null; sl.onChange && sl.onChange(); }
    } else if (sl.mayPlace(this.carried) && this.carried.count <= sl.maxFor(this.carried)) {
      const t = this.carried; this.carried = cur; sl.stack = t;
    }
    this.slotsChanged();
  }
  canFit(stack, start, end) {
    let left = stack.count;
    for (let i = start; i < end; i++) {
      const s = this.slots[i].stack;
      if (!s) left -= stack.item.maxStack;
      else if (s.canStack(stack)) left -= stack.item.maxStack - s.count;
      if (left <= 0) return true;
    }
    return left <= 0;
  }
  // drag distribution (left: split evenly, right: one each)
  dragEnd(button) {
    if (!this.carried || this.dragSlots.size === 0) { this.dragSlots.clear(); return; }
    const slots = [...this.dragSlots].map((i) => this.slots[i]).filter((s) => !s.result && s.mayPlace(this.carried) && (!s.hasItem() || s.stack.canStack(this.carried)));
    if (slots.length === 0) { this.dragSlots.clear(); return; }
    const creativeMiddle = button === 2;
    const per = creativeMiddle ? this.carried.item.maxStack : button === 0 ? Math.floor(this.carried.count / slots.length) : 1;
    let total = this.carried.count;
    if (per <= 0) { this.dragSlots.clear(); return; }
    for (const s of slots) {
      if (!creativeMiddle && total <= 0) break;
      const have = s.hasItem() ? s.stack.count : 0;
      const n = Math.min(per, s.maxFor(this.carried) - have, creativeMiddle ? Infinity : total);
      if (n <= 0) continue;
      if (s.hasItem()) { s.stack.count += n; s.onChange && s.onChange(); } else s.stack = this.carried.copy(n);
      if (!creativeMiddle) total -= n;
    }
    if (!creativeMiddle) { this.carried.count = total; if (total <= 0) this.carried = null; }
    this.dragSlots.clear();
    this.slotsChanged();
  }
  removed(game) {
    if (this.carried) { if (this.inv.add(this.carried) > 0) game.dropFromPlayer(this.carried); this.carried = null; }
  }
}

// grid crafting shared logic
class CraftingGrid extends SimpleContainer {
  constructor(w, h) { super(w * h); this.w = w; this.h = h; }
}
function consumeGrid(grid, player) {
  for (let i = 0; i < grid.size; i++) {
    const s = grid.slots[i];
    if (!s) continue;
    const remainder = s.item.name.endsWith('_bucket') && s.item.name !== 'bucket' ? 'bucket' : s.item.name === 'honey_bottle' || s.item.name === 'dragon_breath' ? 'glass_bottle' : null;
    s.count--;
    if (s.count <= 0) grid.slots[i] = null;
    if (remainder) {
      if (!grid.slots[i]) grid.slots[i] = new ItemStack(remainder, 1);
      else if (player.inventory.add(new ItemStack(remainder, 1)) > 0) player.game.dropFromPlayer(new ItemStack(remainder, 1));
    }
  }
}

export class PlayerMenu extends Menu {
  constructor(player) {
    super(player);
    this.grid = new CraftingGrid(2, 2);
    this.resultC = new SimpleContainer(1);
    this.slots.push(new Slot(this.resultC, 0, 154, 28, { result: true }));
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) this.slots.push(new Slot(this.grid, r * 2 + c, 98 + c * 18, 18 + r * 18, { onChange: () => this.slotsChanged() }));
    const armorSlots = [['head', 39], ['chest', 38], ['legs', 37], ['feet', 36]];
    armorSlots.forEach(([slot, idx], i) => this.slots.push(new Slot(this.inv, idx, 8, 8 + i * 18, { max: 1, bg: 'armor_' + slot, filter: (s) => (s.item.armor && s.item.armor.slot === slot) || (slot === 'head' && (s.item.name === 'carved_pumpkin' || s.item.name.endsWith('_head') || s.item.name.endsWith('_skull'))) })));
    this.addPlayerSlots(8, 84);
    this.offhandIdx = this.slots.length;
    this.slots.push(new Slot(this.inv, 40, 77, 62, { bg: 'shield' }));
  }
  slotsChanged() {
    const r = findRecipe(this.grid.slots, 2, 2);
    this.recipe = r;
    this.resultC.slots[0] = r ? new ItemStack(r.result, r.count) : null;
  }
  takeResult() {
    consumeGrid(this.grid, this.player);
    this.player.statistics.itemsCrafted++;
    this.slotsChanged();
  }
  quickMove(i) {
    const sl = this.slots[i];
    const s = sl.stack;
    if (i >= 1 && i <= 4) this.moveTo(s, this.invStart, this.invEnd, false);
    else if (i >= 5 && i <= 8) this.moveTo(s, this.invStart, this.invEnd, false);
    else if (i === this.offhandIdx) this.moveTo(s, this.invStart, this.invEnd, false);
    else {
      if (s.item.armor) {
        const target = 5 + ['head', 'chest', 'legs', 'feet'].indexOf(s.item.armor.slot);
        if (!this.slots[target].hasItem()) { this.slots[target].stack = s.copy(1); s.count--; }
      }
      if (s.count > 0) {
        if (i >= this.invStart && i < this.hotbarStart) this.moveTo(s, this.hotbarStart, this.invEnd);
        else this.moveTo(s, this.invStart, this.hotbarStart);
      }
    }
    if (s.count <= 0) sl.stack = null;
  }
  removed(game) {
    super.removed(game);
    for (let i = 0; i < 4; i++) if (this.grid.slots[i]) { if (this.inv.add(this.grid.slots[i]) > 0) game.dropFromPlayer(this.grid.slots[i]); this.grid.slots[i] = null; }
    this.slotsChanged();
  }
}

export class CraftingMenu extends Menu {
  constructor(player) {
    super(player);
    this.grid = new CraftingGrid(3, 3);
    this.resultC = new SimpleContainer(1);
    this.slots.push(new Slot(this.resultC, 0, 124, 35, { result: true }));
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) this.slots.push(new Slot(this.grid, r * 3 + c, 30 + c * 18, 17 + r * 18, { onChange: () => this.slotsChanged() }));
    this.addPlayerSlots(8, 84);
  }
  slotsChanged() {
    const r = findRecipe(this.grid.slots, 3, 3);
    this.recipe = r;
    this.resultC.slots[0] = r ? new ItemStack(r.result, r.count) : null;
  }
  takeResult() { consumeGrid(this.grid, this.player); this.player.statistics.itemsCrafted++; this.slotsChanged(); }
  quickMove(i) {
    const sl = this.slots[i], s = sl.stack;
    if (i >= 1 && i <= 9) this.moveTo(s, this.invStart, this.invEnd);
    else if (i >= this.invStart && i < this.hotbarStart) { if (!this.moveTo(s, 1, 10)) this.moveTo(s, this.hotbarStart, this.invEnd); }
    else if (!this.moveTo(s, 1, 10)) this.moveTo(s, this.invStart, this.hotbarStart);
    if (s.count <= 0) sl.stack = null;
  }
  removed(game) {
    super.removed(game);
    for (let i = 0; i < 9; i++) if (this.grid.slots[i]) { if (this.inv.add(this.grid.slots[i]) > 0) game.dropFromPlayer(this.grid.slots[i]); this.grid.slots[i] = null; }
  }
}

export class FurnaceMenu extends Menu {
  constructor(player, furnace) {
    super(player);
    this.furnace = furnace;
    const c = furnace.container;
    this.slots.push(new Slot(c, 0, 56, 17));
    this.slots.push(new Slot(c, 1, 56, 53, { filter: (s) => fuelValue(s.item) > 0 || s.item.name === 'bucket' }));
    this.slots.push(new Slot(c, 2, 116, 35, { result: true }));
    this.addPlayerSlots(8, 84);
  }
  takeResult(sl, n) {
    const s = this.furnace.container.slots[2];
    if (s) { s.count -= n; if (s.count <= 0) this.furnace.container.slots[2] = null; }
    this.furnace.awardXp(this.player, n);
  }
  quickMove(i) {
    const sl = this.slots[i], s = sl.stack;
    if (i <= 2) this.moveTo(s, this.invStart, this.invEnd, i === 2);
    else if (smeltingResult(s.item, this.furnace.kind)) { if (!this.moveTo(s, 0, 1)) this.moveTo(s, i < this.hotbarStart ? this.hotbarStart : this.invStart, i < this.hotbarStart ? this.invEnd : this.hotbarStart); }
    else if (fuelValue(s.item) > 0) { if (!this.moveTo(s, 1, 2)) this.moveTo(s, i < this.hotbarStart ? this.hotbarStart : this.invStart, i < this.hotbarStart ? this.invEnd : this.hotbarStart); }
    else if (i < this.hotbarStart) this.moveTo(s, this.hotbarStart, this.invEnd);
    else this.moveTo(s, this.invStart, this.hotbarStart);
    if (s.count <= 0) sl.stack = null;
  }
}

export class ChestMenu extends Menu {
  constructor(player, container, rows, onClose) {
    super(player);
    this.container = container; this.rows = rows; this.onCloseCb = onClose;
    for (let r = 0; r < rows; r++) for (let c = 0; c < 9; c++) this.slots.push(new Slot(container, r * 9 + c, 8 + c * 18, 18 + r * 18));
    this.addPlayerSlots(8, 103 + (rows - 4) * 18);
  }
  quickMove(i) {
    const sl = this.slots[i], s = sl.stack;
    const n = this.rows * 9;
    if (i < n) this.moveTo(s, n, this.invEnd, true);
    else this.moveTo(s, 0, n);
    if (s.count <= 0) sl.stack = null;
  }
  removed(game) { super.removed(game); this.onCloseCb && this.onCloseCb(); }
}

// furnace block entity logic
export class FurnaceEntity {
  constructor(kind = 'furnace') {
    this.kind = kind; // furnace | blast | smoker
    this.container = new SimpleContainer(3);
    this.burnTime = 0; this.burnDuration = 0; this.cookTime = 0; this.cookTotal = 200; this.xp = 0;
  }
  get speed() { return this.kind === 'furnace' ? 1 : 2; }
  tick(world, x, y, z) {
    const c = this.container.slots;
    const wasLit = this.burnTime > 0;
    if (this.burnTime > 0) this.burnTime--;
    const input = c[0];
    const recipe = input ? smeltingResult(input.item, this.kind) : null;
    const canSmelt = recipe && (!c[2] || (c[2].item.name === recipe.result && c[2].count < c[2].item.maxStack));
    if (this.burnTime <= 0 && canSmelt && c[1]) {
      const f = fuelValue(c[1].item);
      if (f > 0) {
        this.burnTime = this.burnDuration = Math.floor(f / this.speed);
        if (c[1].item.name === 'lava_bucket') c[1] = new ItemStack('bucket', 1);
        else { c[1].count--; if (c[1].count <= 0) c[1] = null; }
      }
    }
    this.cookTotal = Math.floor(200 / this.speed);
    if (this.burnTime > 0 && canSmelt) {
      this.cookTime++;
      if (this.cookTime >= this.cookTotal) {
        this.cookTime = 0;
        if (c[2]) c[2].count++; else c[2] = new ItemStack(recipe.result, 1);
        if (input.item.name === 'wet_sponge' && c[1] && c[1].item.name === 'bucket') c[1] = new ItemStack('water_bucket', 1);
        input.count--; if (input.count <= 0) c[0] = null;
        this.xp += recipe.xp;
      }
    } else if (this.cookTime > 0) this.cookTime = Math.max(0, this.cookTime - 2);
    const lit = this.burnTime > 0;
    if (lit !== wasLit && world) {
      const m = world.getMeta(x, y, z);
      world.setMeta(x, y, z, lit ? m | 4 : m & 3);
    }
  }
  awardXp(player, n) {
    void n;
    let xp = this.xp;
    this.xp = 0;
    let whole = Math.floor(xp);
    if (Math.random() < xp - whole) whole++;
    if (whole > 0) player.game.spawnXp(player.x, player.y + 0.5, player.z, whole);
  }
  save() { return { type: 'furnace', kind: this.kind, items: this.container.toJSON(), burn: this.burnTime, burnDur: this.burnDuration, cook: this.cookTime, xp: this.xp }; }
  static load(d) { const f = new FurnaceEntity(d.kind); f.container.load(d.items); f.burnTime = d.burn; f.burnDuration = d.burnDur; f.cookTime = d.cook; f.xp = d.xp || 0; return f; }
}

export class ChestEntity {
  constructor(size = 27) { this.container = new SimpleContainer(size); this.viewers = 0; this.lid = 0; this.prevLid = 0; }
  save() { return { type: 'chest', items: this.container.toJSON() }; }
  static load(d) { const c = new ChestEntity(d.items ? d.items.length : 27); c.container.load(d.items); return c; }
}
