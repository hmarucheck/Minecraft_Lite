// Minecraft_Lite entry point.
import { Game } from './game/game.js';

function boot() {
  const game = new Game();
  window.game = game; // handy for debugging from the console
  game.init().catch((e) => {
    console.error(e);
    document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;left:8px;top:8px;color:#f55;font:14px monospace;z-index:9">Minecraft_Lite failed to start:\n${String(e && e.stack || e)}</pre>`);
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
