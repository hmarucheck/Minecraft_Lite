// Keyboard / mouse input with Minecraft default key bindings and pointer lock.
export const DEFAULT_BINDINGS = {
  attack: 'Mouse0', use: 'Mouse2', pickItem: 'Mouse1',
  forward: 'KeyW', left: 'KeyA', back: 'KeyS', right: 'KeyD', jump: 'Space', sneak: 'ShiftLeft', sprint: 'ControlLeft',
  inventory: 'KeyE', swapOffhand: 'KeyF', drop: 'KeyQ', chat: 'KeyT', command: 'Slash', playerlist: 'Tab',
  screenshot: 'F2', perspective: 'F5', fullscreen: 'F11', advancements: 'KeyL', social: 'KeyP', saveToolbar: 'KeyC', loadToolbar: 'KeyX',
  hotbar1: 'Digit1', hotbar2: 'Digit2', hotbar3: 'Digit3', hotbar4: 'Digit4', hotbar5: 'Digit5', hotbar6: 'Digit6', hotbar7: 'Digit7', hotbar8: 'Digit8', hotbar9: 'Digit9',
};
export const BINDING_CATEGORIES = [
  ['Movement', ['forward', 'left', 'back', 'right', 'jump', 'sneak', 'sprint']],
  ['Gameplay', ['attack', 'use', 'pickItem']],
  ['Inventory', ['inventory', 'swapOffhand', 'drop', 'hotbar1', 'hotbar2', 'hotbar3', 'hotbar4', 'hotbar5', 'hotbar6', 'hotbar7', 'hotbar8', 'hotbar9']],
  ['Creative Mode', ['saveToolbar', 'loadToolbar']],
  ['Multiplayer', ['chat', 'command', 'playerlist', 'social']],
  ['Miscellaneous', ['screenshot', 'perspective', 'fullscreen', 'advancements']],
];
export const BINDING_NAMES = {
  attack: 'Attack/Destroy', use: 'Use Item/Place Block', pickItem: 'Pick Block', forward: 'Walk Forwards', left: 'Strafe Left', back: 'Walk Backwards',
  right: 'Strafe Right', jump: 'Jump', sneak: 'Sneak', sprint: 'Sprint', inventory: 'Open/Close Inventory', swapOffhand: 'Swap Item With Offhand',
  drop: 'Drop Selected Item', chat: 'Open Chat', command: 'Open Command', playerlist: 'List Players', screenshot: 'Take Screenshot',
  perspective: 'Toggle Perspective', fullscreen: 'Toggle Fullscreen', advancements: 'Advancements', social: 'Social Interactions Screen',
  saveToolbar: 'Save Hotbar Activator', loadToolbar: 'Load Hotbar Activator',
  ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`hotbar${i + 1}`, `Hotbar Slot ${i + 1}`])),
};
export function keyName(code) {
  if (!code) return 'Not Bound';
  if (code.startsWith('Mouse')) return ['Left Button', 'Middle Button', 'Right Button', 'Button 4', 'Button 5'][Number(code.slice(5))] || code;
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map = { Space: 'Space', ShiftLeft: 'Left Shift', ShiftRight: 'Right Shift', ControlLeft: 'Left Control', ControlRight: 'Right Control', AltLeft: 'Left Alt', AltRight: 'Right Alt', Slash: '/', Tab: 'Tab', Enter: 'Enter', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Backslash: '\\', CapsLock: 'Caps Lock', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right' };
  return map[code] || code;
}

export class Input {
  constructor(game, element) {
    this.game = game;
    this.el = element;
    this.down = new Set();
    this.bindings = { ...DEFAULT_BINDINGS };
    this.locked = false;
    this.fallbackLook = false; // only used when the browser has no pointer lock API
    this.needClick = false; // pointer lock was refused; the next click grabs the mouse
    this.attackPressed = false; this.usePressed = false; this.pickPressed = false;
    this.lastX = null; this.lastY = null;
    this.lastForwardTap = 0;
    this.sprintToggle = false;
    this.listeners();
  }
  isDown(action) { return this.down.has(this.bindings[action]); }
  get attackDown() { return this.down.has(this.bindings.attack); }
  get useDown() { return this.down.has(this.bindings.use); }

  // Grab the mouse like Minecraft. Browsers only allow this during a click/key press, so when it is
  // refused the game shows "Click to play" and the next click on the world grabs the mouse.
  requestLock() {
    if (this.locked) return;
    const el = this.el;
    if (!el.requestPointerLock) { this.fallbackLook = true; this.locked = true; return; } // no pointer lock API at all
    const fail = () => { if (!document.pointerLockElement) this.needClick = true; };
    try {
      const r = el.requestPointerLock({ unadjustedMovement: true });
      if (r && r.catch) {
        r.catch((e) => {
          // raw mouse input is not supported everywhere: retry with normal pointer lock
          if (e && e.name === 'NotSupportedError') { try { const r2 = el.requestPointerLock(); if (r2 && r2.catch) r2.catch(fail); } catch { fail(); } }
          else fail();
        });
      }
    } catch { fail(); }
  }
  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
    if (!this.fallbackLook) this.locked = false;
  }

  listeners() {
    const el = this.el;
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === el;
      if (this.locked) { this.fallbackLook = false; this.needClick = false; }
      if (was && !this.locked) this.game.onPointerUnlocked();
    });
    document.addEventListener('pointerlockerror', () => { this.needClick = true; });
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => { this.down.clear(); });
    el.addEventListener('mousedown', (e) => this.onMouse(e, true));
    window.addEventListener('mouseup', (e) => this.onMouse(e, false));
    window.addEventListener('mousemove', (e) => this.onMove(e));
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.game.onWheel(e.deltaY > 0 ? 1 : e.deltaY < 0 ? -1 : 0, e); }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('paste', (e) => {
      const t = e.clipboardData && e.clipboardData.getData('text');
      if (t && this.game.gui.screen) for (const ch of t.replace(/[\r\n]/g, ' ')) this.game.gui.screen.charTyped(ch);
    });
  }

  onKey(e, isDown) {
    const g = this.game;
    const code = e.code;
    if (['Tab', 'Space', 'F1', 'F2', 'F3', 'F5', 'F11', 'Slash', 'Quote', 'ArrowUp', 'ArrowDown', 'Backspace'].includes(code) || (e.ctrlKey && ['KeyS', 'KeyD', 'KeyW', 'KeyA', 'KeyQ'].includes(code))) e.preventDefault();
    g.gui.shift = e.shiftKey; g.gui.ctrl = e.ctrlKey || e.metaKey;
    if (isDown) {
      if (e.repeat && !g.gui.screen) return;
      this.down.add(code);
      if (g.gui.screen) {
        const s = g.gui.screen;
        const handled = s.keyDown(e);
        if (!handled && e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey) s.charTyped(e.key);
        if (handled || g.gui.textInputActive) e.preventDefault();
        return;
      }
      g.onKeyPressed(code, e);
    } else {
      this.down.delete(code);
      g.onKeyReleased && g.onKeyReleased(code, e);
    }
  }

  onMouse(e, isDown) {
    const g = this.game;
    const code = 'Mouse' + e.button;
    const [mx, my] = g.gui.toGui(e.clientX, e.clientY);
    g.gui.mouseX = mx; g.gui.mouseY = my;
    if (g.gui.screen) {
      if (isDown) g.gui.screen.mouseDown(mx, my, e.button, e);
      else g.gui.screen.mouseUp(mx, my, e.button, e);
      return;
    }
    if (!g.inWorld) return;
    if (isDown) {
      if (!this.locked) { this.requestLock(); return; }
      this.down.add(code);
      if (code === this.bindings.attack) this.attackPressed = true;
      if (code === this.bindings.use) this.usePressed = true;
      if (code === this.bindings.pickItem) this.pickPressed = true;
    } else this.down.delete(code);
  }

  onMove(e) {
    const g = this.game;
    const [mx, my] = g.gui.toGui(e.clientX, e.clientY);
    g.gui.mouseX = mx; g.gui.mouseY = my;
    if (g.gui.screen) { g.gui.screen.mouseMove(mx, my, e); this.lastX = null; return; }
    if (!g.inWorld || !this.locked) { this.lastX = null; return; }
    let dx = e.movementX, dy = e.movementY;
    if (this.fallbackLook) {
      if (this.lastX === null) { this.lastX = e.clientX; this.lastY = e.clientY; return; }
      dx = e.clientX - this.lastX; dy = e.clientY - this.lastY;
      this.lastX = e.clientX; this.lastY = e.clientY;
    }
    if (Math.abs(dx) > 400 || Math.abs(dy) > 400) return; // browser glitch
    g.onMouseLook(dx, dy);
  }
}
