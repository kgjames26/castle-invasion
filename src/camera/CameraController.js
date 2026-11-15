// Caméra : déplacement + zoom ; la vue peut PIVOTER (v2.8) : depuis le sud (regard vers le nord, la horde) ou depuis le nord (regard vers le sud, le village).
// Le pivotement est animé ; les déplacements au doigt suivent la vue, les flèches du clavier aussi.
import * as THREE from 'three';
import { W, D } from '../sim/constants.js';

import { CAMERA } from '../render/config.js';
const PITCH = CAMERA.pitchDeg * Math.PI / 180;       // vue rasante : moins « table de jeu » (réglable dans render/config.js)
export class CameraController {
  constructor(camera, dom, onTap) {
    this.cam = camera; this.dom = dom; this.onTap = onTap;
    this.tx = W / 2; this.tz = 125; this.zoom = 1; this.baseDist = 200; this.focus = null; this.yaw = 0; this.yawT = 0;
    this.ptrs = new Map(); this.ray = new THREE.Raycaster(); this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.keys = new Set(); this.drag = null; this.pinch = null; this.moved = 0;
    dom.addEventListener('pointerdown', e => this.down(e)); dom.addEventListener('pointermove', e => this.move(e));
    dom.addEventListener('pointerup', e => this.up(e)); dom.addEventListener('pointercancel', e => this.up(e, true)); dom.addEventListener('lostpointercapture', e => { if (this.ptrs.has(e.pointerId)) this.up(e, true); });
    dom.addEventListener('wheel', e => { e.preventDefault(); this.setZoom(this.zoom * (e.deltaY > 0 ? 1.1 : 0.9)); }, { passive: false });
    addEventListener('keydown', e => { const k = e.key.toLowerCase(); if (k === 'r' && !e.repeat && e.target === document.body) this.turn(); this.keys.add(k); }); addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
  }
  // distance par défaut selon le format : portrait ≈ 2,5 secteurs (≈105 m) visibles, paysage ≈ le front entier (≈205 m)
  fit(w, h) {
    this.aspect = w / h; const portrait = innerHeight > innerWidth, widthM = portrait ? 105 : 205;
    this.baseDist = widthM / (2 * Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2)) * this.aspect);
    this.update(0);
  }
  // pivoter la vue de 180° (vers le sud / vers le nord)
  turn() { this.yawT = this.yawT ? 0 : Math.PI; }
  facingSouth() { return this.yawT > 1; }
  setZoom(z) { this.zoom = Math.min(1.7, Math.max(0.05, z)); }
  focusOn(x, z) { this.focus = { x, z }; }
  // changement de vue instantané (onglets) : position et zoom mémorisés par onglet
  getView() { return { tx: this.tx, tz: this.tz, zoom: this.zoom }; }
  setView(v) { this.focus = null; this.tx = v.tx; this.tz = v.tz; this.zoom = v.zoom; this.update(0); }
  worldAt(cx, cy) {
    const r = this.dom.getBoundingClientRect(); const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.cam); const p = new THREE.Vector3(); return this.ray.ray.intersectPlane(this.plane, p) ? p : null;
  }
  down(e) {
    // souris : seul le bouton gauche agit, et un seul pointeur existe (un relâchement perdu — menu contextuel, sortie de fenêtre — laissait un pointeur fantôme qui faisait croire à un pincement : plus de clic possible)
    if (e.pointerType === 'mouse') { if (e.button !== 0) return; this.ptrs.clear(); this.pinch = null; }
    this.dom.setPointerCapture(e.pointerId); this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); this.moved = 0; this.focus = null;
    if (this.ptrs.size === 1) { this.drag = this.worldAt(e.clientX, e.clientY); this.gdrag = !!(this.drag && this.ghostHit && this.ghostHit(this.drag.x, this.drag.z)); if (this.gdrag) this.drag = null; }
    else if (this.ptrs.size === 2) { const [a, b] = [...this.ptrs.values()]; this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.zoom }; this.drag = null; }
  }
  move(e) {
    const p = this.ptrs.get(e.pointerId); if (!p) return;
    this.moved += Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y); p.x = e.clientX; p.y = e.clientY;
    if (this.gdrag && this.ptrs.size === 1) { const w = this.worldAt(e.clientX, e.clientY); if (w && this.moved > 4) this.ghostMove(w.x, w.z); return; }   // on glisse le fantôme de construction, pas la caméra
    if (this.ptrs.size === 2 && this.pinch) { const [a, b] = [...this.ptrs.values()]; this.setZoom(this.pinch.zoom * this.pinch.d / (Math.hypot(a.x - b.x, a.y - b.y) || 1)); }
    else if (this.ptrs.size === 1 && this.drag && this.moved > 8) {
      this.update(0); const w = this.worldAt(e.clientX, e.clientY);
      if (w) { this.tx += this.drag.x - w.x; this.tz += this.drag.z - w.z; this.clamp(); this.update(0); }
    }
  }
  up(e, cancel) {
    const wasOne = this.ptrs.size === 1; this.ptrs.delete(e.pointerId); this.gdrag = false;
    if (wasOne && !cancel && this.moved <= 8) { const w = this.worldAt(e.clientX, e.clientY); if (w) this.onTap(w.x, w.z); }
    this.pinch = null; this.drag = this.ptrs.size === 1 ? this.worldAt(...Object.values([...this.ptrs.values()][0])) : null;
  }
  clamp() {
    // on ne montre jamais le vide : le centre reste à une demi-largeur visible des bords du monde
    const hw = Math.min(W / 2, 0.92 * this.baseDist * this.zoom * Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2)) * (this.aspect || 1));
    // au niveau du village, la carte s'étend : forêts vierges à gauche et à droite (−200 … 400 m) ; plus haut, le front garde sa largeur
    const wide = Math.max(0, Math.min(1, (this.tz - 170) / 40)), x0 = -200 * wide, x1 = W + 200 * wide;
    this.tx = Math.min(x1 - hw, Math.max(x0 + hw, this.tx)); this.tz = Math.min(D - 20, Math.max(20, this.tz));
  }
  update(dt) {
    const sp = 90 * this.zoom * dt;
    if (this.keys.size) {
      const sg = Math.cos(this.yaw) >= 0 ? 1 : -1;   // vue retournée : gauche/droite et haut/bas inversés dans le monde
      if (this.keys.has('arrowleft') || this.keys.has('a') || this.keys.has('q')) this.tx -= sp * sg; if (this.keys.has('arrowright') || this.keys.has('d')) this.tx += sp * sg;
      if (this.keys.has('arrowup') || this.keys.has('w') || this.keys.has('z')) this.tz -= sp * sg; if (this.keys.has('arrowdown') || this.keys.has('s')) this.tz += sp * sg; this.focus = null;
    }
    if (this.focus) { const k = 1 - Math.exp(-8 * dt); this.tx += (this.focus.x - this.tx) * k; this.tz += (this.focus.z - this.tz) * k; if (Math.hypot(this.focus.x - this.tx, this.focus.z - this.tz) < 0.3) this.focus = null; }
    this.clamp();
    if (this.yaw !== this.yawT) { const k = dt ? 1 - Math.exp(-6 * dt) : 1; this.yaw += (this.yawT - this.yaw) * k; if (Math.abs(this.yawT - this.yaw) < 0.002) this.yaw = this.yawT; }
    const d = this.baseDist * this.zoom, h = d * Math.cos(PITCH);
    this.cam.position.set(this.tx + Math.sin(this.yaw) * h, d * Math.sin(PITCH), this.tz + Math.cos(this.yaw) * h); this.cam.lookAt(this.tx, 0, this.tz); this.cam.updateMatrixWorld(); this.cam.userData.tx = this.tx; this.cam.userData.tz = this.tz;
  }
}
