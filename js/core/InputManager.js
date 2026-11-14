// Entrées unifiées souris / tactile / clavier
// Desktop : clic gauche = sélection (glisser = rectangle), clic droit = ordre, molette = zoom,
//           clic molette ou Alt+glisser = rotation, WASD/ZQSD = déplacement caméra, Q/E = rotation
// Mobile  : tap = sélection/ordre, glisser = déplacer la caméra, appui long puis glisser = rectangle,
//           deux doigts = zoom (pincer) + rotation (tourner)
export class InputManager {
  constructor(dom, cam, handlers) {
    this.dom = dom;
    this.cam = cam;
    this.h = handlers;
    this.pointers = new Map();
    this.boxMode = false;        // mode sélection forcé (bouton HUD)
    this.dragGhost = false;      // en placement : glisser déplace le fantôme
    this.lastTap = { t: 0, x: 0, y: 0 };
    this.enabled = true;

    dom.addEventListener('pointerdown', e => this.down(e));
    window.addEventListener('pointermove', e => this.move(e));
    window.addEventListener('pointerup', e => this.up(e));
    window.addEventListener('pointercancel', e => this.cancel(e));
    dom.addEventListener('wheel', e => { e.preventDefault(); this.cam.zoom(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
    dom.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      this.cam.keys.add(e.code);
      this.h.key?.(e);
    });
    window.addEventListener('keyup', e => this.cam.keys.delete(e.code));
    window.addEventListener('blur', () => this.cam.keys.clear());
  }

  down(e) {
    if (!this.enabled) return;
    this.dom.setPointerCapture?.(e.pointerId);
    const p = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(),
      type: e.pointerType, button: e.button, moved: false, mode: null, shift: e.shiftKey, alt: e.altKey };
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 2) {
      // passage en geste à deux doigts
      for (const q of this.pointers.values()) { q.mode = 'gesture'; clearTimeout(q.lp); }
      this.h.boxDrag?.(null);
      this.gesture = this.gestureState();
      return;
    }
    if (p.type === 'touch' || p.type === 'pen') {
      if (this.boxMode) p.mode = 'box';
      else if (this.dragGhost) p.mode = 'ghost';
      else if (this.cam.mode !== 'city') p.lp = setTimeout(() => { if (!p.moved && this.pointers.size === 1) { p.mode = 'box'; navigator.vibrate?.(15); this.h.boxDrag?.({ x0: p.sx, y0: p.sy, x1: p.x + 1, y1: p.y + 1 }); } }, 380);
    }
    if (p.type === 'mouse' && this.dragGhost && p.button === 0) p.mode = 'ghost';
  }

  gestureState() {
    const [a, b] = [...this.pointers.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }

  move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) { if (e.pointerType === 'mouse') this.h.hover?.(e.clientX, e.clientY); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (!p.moved && Math.hypot(p.x - p.sx, p.y - p.sy) > (p.type === 'mouse' ? 5 : 10)) {
      p.moved = true;
      clearTimeout(p.lp);
      if (!p.mode) {
        if (p.type === 'mouse') {
          if (p.button === 1 || p.alt) p.mode = 'rotate';
          else if (p.button === 2) p.mode = 'rotate';
          else p.mode = this.cam.mode === 'city' ? 'pan' : 'box';
        } else p.mode = 'pan';
      }
    }
    if (p.type === 'mouse') this.h.hover?.(p.x, p.y);
    if (p.mode === 'gesture' && this.pointers.size >= 2) {
      const g = this.gestureState(), o = this.gesture;
      if (o) {
        if (g.d > 10 && o.d > 10) this.cam.zoom(o.d / g.d);
        let da = g.ang - o.ang;
        if (da > Math.PI) da -= Math.PI * 2; if (da < -Math.PI) da += Math.PI * 2;
        this.cam.rotate(da);
        this.cam.pan(g.mx - o.mx, g.my - o.my);
      }
      this.gesture = g;
    } else if (p.mode === 'pan') this.cam.pan(dx, dy);
    else if (p.mode === 'rotate') { this.cam.rotate(-dx * 0.006); this.cam.tilt(dy * 0.004); }
    else if (p.mode === 'box') this.h.boxDrag?.({ x0: p.sx, y0: p.sy, x1: p.x, y1: p.y });
    else if (p.mode === 'ghost') this.h.hover?.(p.x, p.y);
  }

  up(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    clearTimeout(p.lp);
    this.pointers.delete(e.pointerId);
    if (p.mode === 'gesture') { if (this.pointers.size < 2) this.gesture = null; for (const q of this.pointers.values()) q.mode = 'done'; return; }
    if (p.mode === 'done') return;
    if (p.mode === 'box' && p.moved) {
      this.h.boxDrag?.(null);
      this.h.boxSelect?.({ x0: Math.min(p.sx, p.x), y0: Math.min(p.sy, p.y), x1: Math.max(p.sx, p.x), y1: Math.max(p.sy, p.y) }, p.shift);
      if (this.boxMode) this.h.boxModeUsed?.();
      return;
    }
    if (p.mode === 'box') this.h.boxDrag?.(null);
    if (p.moved && p.mode !== 'ghost') return;
    const touch = p.type !== 'mouse';
    if (!touch && p.button === 2) { this.h.secondary?.(p.x, p.y); return; }
    if (!touch && p.button === 1) return;
    const now = performance.now();
    const dbl = now - this.lastTap.t < 330 && Math.hypot(p.x - this.lastTap.x, p.y - this.lastTap.y) < 30;
    this.lastTap = { t: dbl ? 0 : now, x: p.x, y: p.y };
    this.h.tap?.(p.x, p.y, { touch, shift: p.shift, double: dbl });
  }

  reset() {
    for (const p of this.pointers.values()) clearTimeout(p.lp);
    this.pointers.clear();
    this.gesture = null;
    this.h.boxDrag?.(null);
  }

  cancel(e) {
    const p = this.pointers.get(e.pointerId);
    if (p) clearTimeout(p.lp);
    this.pointers.delete(e.pointerId);
    this.h.boxDrag?.(null);
    this.gesture = null;
  }
}
