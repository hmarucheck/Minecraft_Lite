// Item stacks.
import { ITEM, ITEMS } from '../registry/items.js';

export class ItemStack {
  constructor(item, count = 1, damage = 0, tag = null) {
    this.item = typeof item === 'string' ? ITEM[item] : typeof item === 'number' ? ITEMS[item] : item;
    if (!this.item) throw new Error('unknown item ' + item);
    this.count = count;
    this.damage = damage;
    this.tag = tag;
  }
  static of(name, count = 1) { return ITEM[name] ? new ItemStack(ITEM[name], count) : null; }
  get maxStack() { return this.item.maxStack; }
  get name() { return this.item.name; }
  isEmpty() { return !this.item || this.item.id === 0 || this.count <= 0; }
  copy(count = this.count) { return new ItemStack(this.item, count, this.damage, this.tag ? JSON.parse(JSON.stringify(this.tag)) : null); }
  canStack(o) {
    return o && !o.isEmpty() && o.item === this.item && this.item.maxStack > 1 && (this.damage || 0) === (o.damage || 0) && JSON.stringify(this.tag || null) === JSON.stringify(o.tag || null);
  }
  // returns true if the item broke
  hurt(amount, unbreakable = false) {
    if (!this.item.durability || unbreakable) return false;
    this.damage += amount;
    if (this.damage >= this.item.durability) { this.count--; this.damage = 0; return true; }
    return false;
  }
  toJSON() { return [this.item.name, this.count, this.damage || 0, this.tag || null]; }
  static fromJSON(j) {
    if (!j || !ITEM[j[0]]) return null;
    return new ItemStack(ITEM[j[0]], j[1], j[2] || 0, j[3] || null);
  }
}

export function isEmpty(s) { return !s || s.isEmpty(); }
