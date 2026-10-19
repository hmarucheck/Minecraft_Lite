# Minecraft_Lite

A browser remake of vanilla Minecraft (Java Edition style): same blocks, items, mobs, water and lava, inventory and menu layouts, world options, game rules and commands. It uses no shaders and no realistic graphics, just normal Minecraft.

> **Unofficial fan project.** Not affiliated with Mojang or Microsoft. All textures, sounds and music are drawn or synthesized in code in a Minecraft-like style. No Mojang assets are included.

## Play

- **Quickest:** open `index.html` in Chrome, Edge or Firefox. The prebuilt game is in `dist/`.
- **GitHub Pages:** in the repository settings open *Pages*, choose *Deploy from a branch*, then pick `main` and `/ (root)`. The game will be at `https://<user>.github.io/minecraft_lite/`.
- **Local server:** `npm install`, then `npm run serve`, then open http://localhost:8080.

Worlds save automatically in your browser (IndexedDB), every minute and when you choose *Save and Quit to Title*.

## Controls (Minecraft defaults, rebindable in Options → Controls → Key Binds)

| Action | Key |
|---|---|
| Move | W A S D |
| Jump / swim up / fly up | Space (double-tap in Creative to fly) |
| Sneak / fly down | Shift |
| Sprint | Ctrl, or double-tap W |
| Attack / break | Left mouse |
| Use / place | Right mouse |
| Pick block | Middle mouse |
| Inventory | E |
| Drop item (Ctrl = whole stack) | Q |
| Swap item to offhand | F |
| Hotbar | 1–9 / mouse wheel |
| Chat / command | T and / |
| Player list | Tab |
| Hide HUD / screenshot / debug / perspective / fullscreen | F1 / F2 / F3 / F5 / F11 |
| Debug combos | F3+B hitboxes, F3+G chunk borders, F3+H advanced tooltips, F3+N spectator toggle, F3+D clear chat |
| Save / load creative hotbar | C+1–9 / X+1–9 |

On phones and tablets an on-screen stick and buttons appear. Drag to look, tap to use or place, and hold to break.

## What's in it

- **687 blocks and 977 items**, including stone, ores and deepslate variants, all 10 wood sets (planks, logs, stripped logs, stairs, slabs, fences, gates, doors, trapdoors, signs, buttons and pressure plates), 16 colors of wool, concrete, concrete powder, terracotta, glazed terracotta, stained glass and beds, plus plants, crops, functional blocks, redstone parts, tools and armor for every tier, food with Minecraft's hunger and saturation values, potions, dyes, music discs and 48 spawn eggs.
- **World generation** with 30 biomes and Minecraft's grass, foliage and water tints, mountains, rivers, oceans, caves, ores and trees. World types are Default, Superflat (with presets), Large Biomes, Amplified and Single Biome. Seeds work, including text seeds.
- **49 mobs** with Minecraft health, damage, speed, drops and behavior:
  - Hostile: zombies (also husk, drowned and zombie villager), skeletons and strays that shoot arrows, creepers that explode, spiders that climb, endermen that teleport and get angry when you look at them, slimes that split, witches that throw potions, blazes that shoot fireballs, phantoms, silverfish and more.
  - Passive and neutral: pigs, cows, sheep (shearing and dyeing), chickens (they lay eggs), wolves (tame them with bones), cats, foxes, horses, llamas, goats, bees, squid, dolphins, turtles, frogs, villagers, iron golems and snow golems (you can build both).
  - Animals breed. Babies grow up. Undead burn in daylight. Monsters spawn in the dark and despawn when far away.
- **Survival:** health, hunger, saturation and exhaustion, XP and levels, armor, fall, fire, lava and drowning damage, sleeping in beds, and death with a respawn screen. **Creative:** flying, instant breaking, and the full creative inventory with all tabs, search and saved hotbars. **Hardcore, Adventure and Spectator** modes are also included.
- **Crafting:** about 250 recipes in the 2×2 and 3×3 grids. **Smelting** works in the furnace, blast furnace and smoker. Chests, barrels and ender chests all work.
- **World dynamics:** flowing water and lava (lava meeting water makes cobblestone or obsidian), day and night with sun, moon phases, stars and clouds, rain, snow, thunderstorms with lightning, crops and saplings growing, bone meal, leaf decay, grass spreading, fire spreading, falling sand and gravel, and TNT.
- **Redstone:** levers, buttons, pressure plates, redstone dust, torches, repeaters, redstone blocks, lamps, doors, trapdoors, gates, TNT, note blocks and simple pistons.
- **Menus with the same layouts as Minecraft:** the title screen with splash text, Singleplayer world list, Create New World (Game, World and More tabs plus every game rule), Options (Video, Controls, Key Binds, Mouse, Sound, Chat, Skin, Accessibility, Language, Resource Packs), Game Menu, Statistics, and the death screen.
- **Commands** (turn on *Allow Commands* when creating the world): `/gamemode /defaultgamemode /difficulty /time /weather /tp /teleport /give /clear /kill /damage /summon /setblock /fill /clone /gamerule /effect /xp /experience /enchant /seed /spawnpoint /setworldspawn /say /me /msg /tell /w /list /tellraw /title /locate biome /particle /playsound /stopsound /random /save-all /save-on /save-off /stop /help`. They support `~ ~ ~` and `^ ^ ^` coordinates, target selectors like `@p @s @a @r @e[type=zombie,distance=..10,limit=3]`, and Tab completion.
- **Sound:** synthesized block, mob and UI sounds plus generative piano music.

## Development

```
npm install
npm run build      # bundles src/ into dist/minecraft_lite.js
npm run watch      # rebuild on change
npm run serve      # http://localhost:8080
```

The code is plain ES modules with [three.js](https://threejs.org/) for rendering, bundled with esbuild:

- `src/world`: chunks, terrain generator, biomes, trees, lighting
- `src/render`: chunk mesher, texture atlas, sky, entity models, particles, first-person hand
- `src/textures`: procedural 16×16 textures
- `src/registry`: block and item definitions
- `src/entity`: physics, player, mobs and AI
- `src/game`: game loop, interaction, block logic, inventories, recipes, commands, redstone, saving
- `src/gui`: bitmap font, widgets and all the screens

Run `node tools/texsheet.mjs` to render a contact sheet of every texture. Run `node tools/scenario.mjs <script>` to drive the game in headless Chromium and take screenshots.
