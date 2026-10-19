// Touch controls for phones/tablets: move stick, look by dragging, tap to use, hold to break.
const BTN = 'position:absolute;display:flex;align-items:center;justify-content:center;color:#fff;font:bold 13px monospace;'
  + 'background:rgba(40,40,40,0.45);border:2px solid rgba(255,255,255,0.45);border-radius:6px;user-select:none;-webkit-user-select:none;touch-action:none;';

export class TouchControls {
  constructor(game) {
    this.game = game;
    this.state = { forward: 0, strafe: 0, jump: false, sneak: false, sprint: false };
    game.touch = this.state;
    const root = document.createElement('div');
    root.id = 'touch-controls';
    root.style.cssText = 'position:fixed;inset:0;z-index:3;pointer-events:none;display:none;';
    document.body.appendChild(root);
    this.root = root;
    // movement stick
    const pad = this.el('div', 'left:24px;bottom:24px;width:140px;height:140px;border-radius:50%;', '');
    const knob = document.createElement('div');
    knob.style.cssText = 'position:absolute;left:45px;top:45px;width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,0.35);';
    pad.appendChild(knob);
    this.pad = pad; this.knob = knob;
    pad.addEventListener('touchstart', (e) => { e.preventDefault(); this.padTouch = e.changedTouches[0].identifier; this.movePad(e.changedTouches[0]); }, { passive: false });
    pad.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === this.padTouch) this.movePad(t); }, { passive: false });
    const endPad = (e) => { for (const t of e.changedTouches) if (t.identifier === this.padTouch) { this.padTouch = null; this.state.forward = 0; this.state.strafe = 0; this.state.sprint = false; knob.style.left = '45px'; knob.style.top = '45px'; } };
    pad.addEventListener('touchend', endPad); pad.addEventListener('touchcancel', endPad);
    // buttons
    this.hold('JUMP', 'right:30px;bottom:40px;width:70px;height:70px;border-radius:50%;', (d) => { this.state.jump = d; });
    this.hold('SNEAK', 'right:110px;bottom:30px;width:64px;height:44px;', (d) => { this.state.sneak = d; });
    this.hold('MINE', 'right:30px;bottom:130px;width:70px;height:50px;', (d) => {
      const inp = game.input;
      if (d) { inp.down.add(inp.bindings.attack); inp.attackPressed = true; } else inp.down.delete(inp.bindings.attack);
    });
    this.hold('USE', 'right:110px;bottom:90px;width:64px;height:50px;', (d) => {
      const inp = game.input;
      if (d) { inp.down.add(inp.bindings.use); inp.usePressed = true; } else inp.down.delete(inp.bindings.use);
    });
    this.tap('INV', 'left:24px;top:20px;width:56px;height:40px;', () => game.openInventory());
    this.tap('CHAT', 'left:90px;top:20px;width:56px;height:40px;', () => game.onKeyPressed(game.input.bindings.chat, {}));
    this.tap('DROP', 'left:156px;top:20px;width:56px;height:40px;', () => game.onKeyPressed(game.input.bindings.drop, {}));
    this.tap('II', 'right:20px;top:20px;width:44px;height:40px;', () => game.onKeyPressed('Escape', {}));
    this.tap('VIEW', 'right:74px;top:20px;width:56px;height:40px;', () => game.onKeyPressed('F5', {}));
    // look by dragging anywhere else on the screen; tap = use, long press = break
    const c = game.guiCanvas;
    c.addEventListener('touchstart', (e) => this.lookStart(e), { passive: false });
    c.addEventListener('touchmove', (e) => this.lookMove(e), { passive: false });
    c.addEventListener('touchend', (e) => this.lookEnd(e), { passive: false });
    c.addEventListener('touchcancel', (e) => this.lookEnd(e), { passive: false });
  }
  el(tag, css, label) {
    const b = document.createElement(tag);
    b.style.cssText = BTN + css + 'pointer-events:auto;';
    b.textContent = label;
    this.root.appendChild(b);
    return b;
  }
  hold(label, css, fn) {
    const b = this.el('div', css, label);
    b.addEventListener('touchstart', (e) => { e.preventDefault(); b.style.background = 'rgba(255,255,255,0.35)'; fn(true); }, { passive: false });
    const up = (e) => { e.preventDefault(); b.style.background = 'rgba(40,40,40,0.45)'; fn(false); };
    b.addEventListener('touchend', up, { passive: false }); b.addEventListener('touchcancel', up, { passive: false });
    return b;
  }
  tap(label, css, fn) {
    const b = this.el('div', css, label);
    b.addEventListener('touchstart', (e) => { e.preventDefault(); fn(); }, { passive: false });
    return b;
  }
  movePad(t) {
    const r = this.pad.getBoundingClientRect();
    let dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2);
    const l = Math.hypot(dx, dy), max = r.width / 2;
    if (l > max) { dx = dx / l * max; dy = dy / l * max; }
    this.knob.style.left = `${45 + dx * 0.6}px`; this.knob.style.top = `${45 + dy * 0.6}px`;
    const nx = dx / max, ny = dy / max;
    this.state.forward = Math.abs(ny) > 0.2 ? -ny : 0;
    this.state.strafe = Math.abs(nx) > 0.2 ? -nx : 0;
    this.state.sprint = -ny > 0.92;
  }
  active() { const g = this.game; return g.inWorld && !g.gui.screen; }
  lookStart(e) {
    if (!this.active()) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    // hotbar taps select a slot
    const gui = this.game.gui;
    const [gx, gy] = gui.toGui(t.clientX, t.clientY);
    if (gy > gui.height - 23 && Math.abs(gx - gui.width / 2) < 91) {
      this.game.player.inventory.selectedSlot = Math.max(0, Math.min(8, Math.floor((gx - (gui.width / 2 - 91)) / 20)));
      this.game.hud.onSlotChange(this.game);
      return;
    }
    if (this.lookTouch != null) return;
    this.lookTouch = t.identifier; this.lx = t.clientX; this.ly = t.clientY; this.moved = 0; this.startT = performance.now();
    clearTimeout(this.holdTimer);
    this.holdTimer = setTimeout(() => {
      if (this.lookTouch != null && this.moved < 12) { const inp = this.game.input; this.breaking = true; inp.down.add(inp.bindings.attack); inp.attackPressed = true; }
    }, 300);
  }
  lookMove(e) {
    if (this.lookTouch == null) return;
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === this.lookTouch) {
      const dx = t.clientX - this.lx, dy = t.clientY - this.ly;
      this.lx = t.clientX; this.ly = t.clientY;
      this.moved += Math.abs(dx) + Math.abs(dy);
      this.game.onMouseLook(dx * 1.6, dy * 1.6);
    }
  }
  lookEnd(e) {
    for (const t of e.changedTouches) if (t.identifier === this.lookTouch) {
      e.preventDefault();
      clearTimeout(this.holdTimer);
      const inp = this.game.input;
      if (this.breaking) { inp.down.delete(inp.bindings.attack); this.breaking = false; }
      else if (this.moved < 12 && performance.now() - this.startT < 300 && this.active()) {
        // quick tap: attack an entity in reach, otherwise use/place
        if (this.game.interaction && this.game.interaction.targetEntity) inp.attackPressed = true;
        else { inp.usePressed = true; inp.down.add(inp.bindings.use); setTimeout(() => inp.down.delete(inp.bindings.use), 80); }
      }
      this.lookTouch = null;
    }
  }
  update() {
    const show = this.active();
    if (show !== this.shown) { this.root.style.display = show ? 'block' : 'none'; this.shown = show; }
  }
}
