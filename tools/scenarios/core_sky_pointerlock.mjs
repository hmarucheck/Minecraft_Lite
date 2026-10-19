export default async (page, { shot, log, sleep }) => {
  await page.waitForFunction(() => window.game && window.game.gui.screen, null, { timeout: 60000 });
  await page.evaluate(() => { const g = window.game; g.options.set('renderDistance', 3); g.createWorld({ name: 'SkyLock', seed: 'sky', gameMode: 'creative', allowCommands: true, worldType: 'flat' }); });
  await page.waitForFunction(() => window.game.loading && window.game.loading.done, null, { timeout: 240000, polling: 1000 });
  await sleep(1000);
  log('after load', await page.evaluate(() => JSON.stringify({ locked: window.game.input.locked, needClick: window.game.input.needClick, fallback: window.game.input.fallbackLook, ple: !!document.pointerLockElement })));
  await shot('click_to_play');
  await page.mouse.click(480, 270);
  await sleep(1000);
  log('after click', await page.evaluate(() => JSON.stringify({ locked: window.game.input.locked, needClick: window.game.input.needClick, ple: !!document.pointerLockElement, screen: window.game.gui.screen && window.game.gui.screen.constructor.name })));
  // mouse movement should turn the camera while locked
  const y0 = await page.evaluate(() => window.game.player.yaw);
  await page.mouse.move(600, 270); await sleep(300);
  const y1 = await page.evaluate(() => window.game.player.yaw);
  log('yaw change from mouse move', (y1 - y0).toFixed(3));
  // sunrise in the east, wall of blocks in front
  await page.evaluate(() => { const g = window.game, p = g.player; g.commands.execute('/time set 23500'); g.commands.execute('/fill ~-6 ~ ~-12 ~-6 ~10 ~12 stone'); p.yaw = Math.PI / 2; p.pitch = -0.15; });
  await sleep(2500);
  await shot('sun_behind_wall');
  await page.evaluate(() => { const p = window.game.player; p.yaw = -Math.PI / 2; });
  await sleep(2000);
  await shot('sun_open_side');
};
