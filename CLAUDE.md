# Minecraft_Lite: guide for contributors and agents

Minecraft_Lite is a browser remake of vanilla Minecraft Java Edition, built with plain ES modules and three.js and bundled by esbuild into `dist/minecraft_lite.js`. The goal is to match Minecraft's behavior, numbers, and screen layouts as closely as possible, without realistic graphics. **Never copy Mojang assets.** Textures are painted procedurally in code (16×16, Minecraft style), and sounds are synthesized with WebAudio.

## Commands

```
node tools/build.mjs                    # build dist/minecraft_lite.js (minified); add --watch while developing
node tools/scenario.mjs <scenario.mjs> <outDir>   # drive the game in headless Chromium, take screenshots
node tools/texsheet.mjs [regex] [out.png]          # contact sheet of textures
```

There is no test suite. Verify by building, then running a headless scenario and reading the screenshots.

## Layout

| Path | What |
|---|---|
| `src/core/util.js` | constants (`MIN_Y=-64`, `MAX_Y=320`, `SEA_LEVEL=63`, `FACE_DIRS`, `HFACING_DIRS`), hashing, `Rng`, `titleCase` |
| `src/registry/blocks.js` | block registry: `reg(name, props)` plus helpers (`cube`, `cubeTB`, `slab`, `stairs`, `wall`, `fence`, `door`, `trapdoor`, `button`, `pressurePlate`, `cross`, `frontBlock`), derived lookup tables |
| `src/registry/items.js` | item registry: `item(name, props)`. Every block automatically gets a block item. Creative tabs. |
| `src/registry/models.js` | block element models (`box()`, `rotateY()`, `slabModel`, `doorModel`, …) |
| `src/textures/*.js` | texture painters. `T(name, fn)` for blocks, `I(name, fn)` (`T('item:'+name)`) for item sprites. Helpers live in `pixel.js`. |
| `src/world/` | `chunk.js` (16×384×16, 16³ sections, `setRaw(lx,y,lz,id,meta)`), `generator.js` (overworld), `biomes.js`, `trees.js`, `world.js` (blocks, light, scheduled ticks), `chunkmanager.js` |
| `src/render/` | `renderer.js`, `mesher.js`, `atlas.js`, `blockrender.js`, `sky.js`, `entities.js` (entity renderer), `models.js` (mob box models + procedural skins), `hand.js`, `particles.js`, `icons.js`, `itemmesh.js` |
| `src/entity/` | `physics.js` (AABB, sweep, raycast), `entity.js` (Entity, ItemEntity, XpOrb, FallingBlock, PrimedTnt, Projectile), `living.js` (LivingEntity, EFFECTS), `player.js`, `mobs.js` (MOBS table, Mob AI, MobSpawner) |
| `src/game/` | `game.js` (Game: loop, world lifecycle, screens), `interaction.js` (attack/break/use), `blocklogic.js` (placement, use, ticks, fluids, drops), `inventory.js` (containers, Menu/Slot, furnace & chest block entities), `recipes.js`, `commands.js`, `redstone.js`, `enchantments.js`, `storage.js` (IndexedDB), `options.js`, `input.js`, `touch.js`, `rules.js` |
| `src/gui/` | `gui.js` (canvas GUI, item drawing, tooltips, toasts), `font.js` (bitmap font, `§` codes), `draw.js` (buttons, slots, panels, sprites), `widgets.js`, `screen.js`, `hud.js`, `screens/*.js` |
| `src/audio/sound.js` | `sound.play(name, vol, pitch)`, `sound.at(name, x, y, z, vol, pitch)`; mob sounds are `entity.<mob>.ambient/hurt/death` (synthesized in `mobSound`) |

## Conventions

- **Style:** 2-space indent, single quotes, semicolons. Long lines are fine. Match the comment density of the surrounding code: short `//` headers, no essay comments. Plain JavaScript only.
- **Minecraft accuracy first.** Use real Minecraft numbers (health, damage, speeds, durability, loot chances, costs, timings), real names (`snake_case` ids, Title Case display names), and real GUI layouts. The GUI is drawn in Minecraft GUI pixels: containers are 176 px wide, slots are 18 px apart, and the player inventory sits at (8, 84) for 166-px-tall screens.
- **Directions:** face order is down, up, north, south, west, east (`FACE_DIRS`). Horizontal facing meta (`hfacing`) is 0 south, 1 west, 2 north, 3 east (`HFACING_DIRS`). Yaw 0 looks toward +z, and forward = (-sin yaw, cos yaw).
- **World API:** `world.getBlock/getMeta(x,y,z)`, `world.setBlock(x,y,z,id,meta,flags)` (flags bit 1 notifies neighbors and redstone), `world.getBlockEntity/setBlockEntity`, `world.scheduleTick(x,y,z,delay)`, `world.isLoaded(x,z)`, `world.getSkyLight/getBlockLight`. During generation, write directly with `chunk.setRaw` in local coordinates.
- **Blocks:** `BLOCK[name].id`, `BLOCKS[id]`. Important props: `shape` (cube|cross|model|liquid|none), `solid`, `opaque`, `layer`, `kind` (drives logic in `blocklogic.js`), `tex`, `model(meta, nb)`, `boxes(meta)`, `hardness`, `tool`, `drops`/`dropsFn`, `lightEmit`. Saves store block *names*, so adding blocks anywhere is save-safe.
- **Item stack tags:** `stack.tag.enchantments = {sharpness: 5}` and `stack.tag.storedEnchantments` (enchanted books), `stack.tag.repairCost`, `stack.tag.name`. Use the helpers in `src/game/enchantments.js` (`enchantLevel`, `getEnchantments`, `setEnchantments`, `enchantWithLevels`, `enchantRandomly`).
- **Block entities:** any object with `save()` (which must include `type`) is persisted. Register a loader in `BE_LOADERS[type]` (from `storage.js`). Objects with `tick(world, x, y, z, game)` are ticked once they are in `game.tickingBE` (added automatically on chunk load; call `game.tickingBE.add(be)` when you create one).
- **Mobs:** add an entry to `MOBS` in `mobs.js` (`cat`, `hp`, `speed`, `dmg`, `w`, `h`, `ai`, `drops`, …), a box model plus skin painter via `def(name, {tex, parts, paint})` in `render/models.js`, and sounds in `mobSound`. Spawn mobs with `game.spawnMob(type, x, y, z, opts)`. Persist through `save()`/`load()`. Mobs that world generation places go in `chunk.pendingSpawns = [{type, x, y, z, opts}]`.
- **Screens:** subclass `Screen` or `ContainerScreen(menu, title, imageW, imageH)` with a `Menu` of `Slot`s (`inventory.js`), and open them with `game.gui.setScreen(new X(...))`. Shift-click goes through `menu.moveTo`, and `menu.removed(game)` returns items on close.
- **HUD and chat:** `game.chat(text, colorCode)`, `game.showActionbar(text)`, `game.showTitle(title, subtitle)`, `game.toast(title, text)`.

## Feature packs and shared files

Large features are built in parallel on separate branches. Shared registries contain marker regions like:

```
// ==== pack:<name> (description) ====
// ==== end pack:<name> ====
```

The packs are `dimensions`, `enchanting`, `structures`, `trading`, `riding` and `fishing`. When working on a pack, put additions to a shared registry **inside your own region**, and prefer new files for anything larger. The marker regions are in: `registry/blocks.js`, `registry/items.js`, `game/recipes.js`, `entity/mobs.js` (MOBS table, `createMob`, spawn lists), `render/models.js`, `render/entities.js` (`create()`), `world/biomes.js`, `audio/sound.js` (`mobSound`), `game/commands.js`, `gui/hud.js`, and `game/game.js` (methods and per-tick hooks). Each pack also has its own texture file, `src/textures/tex_<pack>.js`. Edits outside the markers are allowed when necessary. Keep them small and surgical so branches still merge cleanly.

Cross-pack contracts:
- **Dimensions:** ids are `overworld`, `the_nether`, `the_end`, available as `game.dimension`, `world.dimension` and `generator.dimension`. Every generator has `this.structures` (a StructureManager or null) and calls `this.structures?.generateChunk(chunk, this)` at the end of `generate(chunk)`. The structure manager answers `locate(type, x, z)` → `{x, y, z} | null` (used by eyes of ender and `/locate structure`).
- **Villagers:** `villager.variant` is the profession id in lowercase (`farmer`, `librarian`, `cleric`, `armorer`, `butcher`, `cartographer`, `fisherman`, `fletcher`, `leatherworker`, `mason`, `shepherd`, `toolsmith`, `weaponsmith`, `nitwit`, `none`). Villages set it from the workstation they place.
- **Mob type ids** match Minecraft (`guardian`, `elder_guardian`, `ghast`, `piglin_brute`, `pillager`, `cod`, …). Calling `spawnMob` for an unknown type returns null, so it is safe across packs.

## Testing in headless Chromium

The scenario script default-exports `async (page, {shot, log, sleep}) => {}`. Example:

```js
export default async (page, { shot, log, sleep }) => {
  await page.waitForFunction(() => window.game && window.game.gui.screen, null, { timeout: 60000 });
  await page.evaluate(() => { const g = window.game; g.options.set('renderDistance', 3);
    g.createWorld({ name: 'T', seed: 'test', gameMode: 'creative', allowCommands: true, worldType: 'flat' }); });
  await page.waitForFunction(() => window.game.loading && window.game.loading.done, null, { timeout: 240000, polling: 1000 });
  await page.evaluate(() => window.game.commands.execute('/give @s diamond_sword'));
  await sleep(2000); await shot('example');
};
```

- WebGL runs on SwiftShader (software rendering), which is slow. Keep `renderDistance` at 3–4, prefer Superflat worlds for UI tests, and allow a few seconds per step.
- `window.game` exposes everything: `game.player`, `game.world`, `game.commands.execute('/...')`, `game.gui.setScreen(...)`, `game.openInventory()`.
- The runner prints console errors and writes the full log to `<outDir>/console.log`. A 404 for the favicon is harmless.
- Open the screenshots with the Read tool and compare them against your memory of Minecraft's real screens.

## Git

- In a git worktree, first link the dependencies with `ln -s /home/user/minecraft_lite/node_modules node_modules`.
- **Never commit `dist/`** on a feature branch (it is a single minified file and always conflicts). Stage with `git add -A -- . ':!dist' ':!node_modules'`. Only the integration step rebuilds and commits `dist/`.
