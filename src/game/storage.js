// World persistence in IndexedDB: world metadata + modified chunks (with block entities and entities).
import { Chunk, Section } from '../world/chunk.js';
import { BLOCKS, BLOCK } from '../registry/blocks.js';
import { FurnaceEntity, ChestEntity } from './inventory.js';
import { ItemStack } from './itemstack.js';
import { SECTIONS } from '../core/util.js';

// Block-entity loaders registered by feature packs: BE_LOADERS[type] = (savedData) => blockEntity.
// Any block entity with a save() method is serialized automatically; save() must include `type`.
export const BE_LOADERS = {};

const DB_NAME = 'minecraft_lite';
const BLOCK_NAMES = BLOCKS.map((b) => b.name);

function req(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }

export class Storage {
  constructor() { this.db = null; this.worldId = null; this.index = new Set(); this.memory = new Map(); this.memWorlds = new Map(); }
  async open() {
    try {
      this.db = await new Promise((res, rej) => {
        const r = indexedDB.open(DB_NAME, 1);
        r.onupgradeneeded = () => {
          const db = r.result;
          if (!db.objectStoreNames.contains('worlds')) db.createObjectStore('worlds', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('chunks')) db.createObjectStore('chunks');
        };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
        setTimeout(() => rej(new Error('timeout')), 4000);
      });
    } catch (e) {
      console.warn('IndexedDB unavailable, worlds will not persist', e);
      this.db = null;
    }
  }
  store(name, mode = 'readonly') { return this.db.transaction(name, mode).objectStore(name); }

  async listWorlds() {
    if (!this.db) return [...this.memWorlds.values()].sort((a, b) => b.lastPlayed - a.lastPlayed);
    const all = await req(this.store('worlds').getAll());
    return all.sort((a, b) => b.lastPlayed - a.lastPlayed);
  }
  async saveWorldInfo(info) {
    info.blockNames = BLOCK_NAMES;
    if (!this.db) { this.memWorlds.set(info.id, JSON.parse(JSON.stringify(info))); return; }
    await req(this.store('worlds', 'readwrite').put(JSON.parse(JSON.stringify(info))));
  }
  async loadWorldInfo(id) {
    if (!this.db) return this.memWorlds.get(id) || null;
    return req(this.store('worlds').get(id));
  }
  async deleteWorld(id) {
    if (!this.db) { this.memWorlds.delete(id); for (const k of [...this.memory.keys()]) if (k.startsWith(id + ':')) this.memory.delete(k); return; }
    await req(this.store('worlds', 'readwrite').delete(id));
    const keys = await req(this.store('chunks').getAllKeys(IDBKeyRange.bound(id + ':', id + ':￿')));
    const st = this.store('chunks', 'readwrite');
    await Promise.all(keys.map((k) => req(st.delete(k))));
  }
  async copyWorld(id, newInfo) {
    await this.saveWorldInfo(newInfo);
    if (!this.db) return;
    const keys = await req(this.store('chunks').getAllKeys(IDBKeyRange.bound(id + ':', id + ':￿')));
    for (const k of keys) {
      const v = await req(this.store('chunks').get(k));
      await req(this.store('chunks', 'readwrite').put(v, newInfo.id + k.slice(id.length)));
    }
  }
  async prepare(id, savedNames) {
    this.worldId = id;
    this.index = new Set();
    this.remap = null;
    if (savedNames && savedNames.join('|') !== BLOCK_NAMES.join('|')) {
      this.remap = new Uint16Array(savedNames.length);
      savedNames.forEach((n, i) => { this.remap[i] = BLOCK[n] ? BLOCK[n].id : 0; });
    }
    if (!this.db) { for (const k of this.memory.keys()) if (k.startsWith(id + ':')) this.index.add(k.slice(id.length + 1)); return; }
    const keys = await req(this.store('chunks').getAllKeys(IDBKeyRange.bound(id + ':', id + ':￿')));
    for (const k of keys) this.index.add(k.slice(id.length + 1));
  }
  setWorld(id) { if (this.worldId !== id) { this.worldId = id; this.index = new Set(); } }

  serialize(c) {
    const sections = [];
    for (let i = 0; i < SECTIONS; i++) {
      const s = c.sections[i];
      if (!s || s.count === 0) continue;
      sections.push({ i, blocks: s.blocks.slice(), meta: s.meta ? s.meta.slice() : null });
    }
    const bes = [];
    for (const be of c.blockEntities.values()) {
      let d = null;
      if (be.save) d = be.save();
      else if (be.type === 'jukebox') d = { type: 'jukebox', disc: be.disc ? be.disc.toJSON() : null };
      else if (be.type === 'spawner') d = { type: 'spawner', mob: be.mob };
      if (d) { d.x = be.x; d.y = be.y; d.z = be.z; bes.push(d); }
    }
    return { v: 1, sections, biomes: c.biomes.slice(), bes, entities: c.entities || [] };
  }
  async saveChunk(c) {
    const key = `${this.worldId}:${c.cx},${c.cz}`;
    const data = this.serialize(c);
    this.index.add(`${c.cx},${c.cz}`);
    if (!this.db) { this.memory.set(key, data); return; }
    try { await req(this.store('chunks', 'readwrite').put(data, key)); } catch (e) { console.warn('save chunk failed', e); }
  }
  async loadChunkData(cx, cz) {
    const key = `${this.worldId}:${cx},${cz}`;
    if (!this.db) return this.memory.get(key) || null;
    return req(this.store('chunks').get(key));
  }
  deserialize(d, cx, cz, generator) {
    const c = new Chunk(cx, cz);
    const remap = this.remap;
    for (const s of d.sections) {
      const sec = new Section();
      sec.blocks.set(s.blocks);
      if (remap) for (let i = 0; i < 4096; i++) sec.blocks[i] = remap[sec.blocks[i]] || 0;
      if (s.meta) { sec.meta = new Uint8Array(4096); sec.meta.set(s.meta); }
      let n = 0; for (let i = 0; i < 4096; i++) if (sec.blocks[i]) n++;
      sec.count = n;
      c.sections[s.i] = sec;
    }
    c.biomes.set(d.biomes);
    generator.blendColors(c);
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) c.updateHeightmap(x, z);
    for (const b of d.bes || []) {
      let be = null;
      if (b.type === 'furnace') be = FurnaceEntity.load(b);
      else if (b.type === 'chest') be = ChestEntity.load(b);
      else if (b.type === 'jukebox') be = { type: 'jukebox', disc: b.disc ? ItemStack.fromJSON(b.disc) : null };
      else if (b.type === 'spawner') be = { type: 'spawner', mob: b.mob, delay: 200 };
      else if (BE_LOADERS[b.type]) be = BE_LOADERS[b.type](b);
      if (be) { be.x = b.x; be.y = b.y; be.z = b.z; c.blockEntities.set(c.beKey(b.x & 15, b.y, b.z & 15), be); }
    }
    c.savedEntities = d.entities && d.entities.length ? d.entities : null;
    c.generated = true;
    return c;
  }
  chunkStore(world) {
    return {
      has: (cx, cz) => this.index.has(`${cx},${cz}`),
      load: async (cx, cz) => {
        try {
          const d = await this.loadChunkData(cx, cz);
          return d ? this.deserialize(d, cx, cz, world.generator) : null;
        } catch (e) { console.warn('load chunk failed', e); return null; }
      },
      save: (c) => this.saveChunk(c),
    };
  }
}
