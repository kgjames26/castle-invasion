import * as THREE from 'three';
import { clamp, lerp, angleLerp } from '../utils/MathUtils.js';
import { MAP } from '../data/Config.js';

// Caméra semi-isométrique : regarde vers le nord par défaut, pivotable, zoomable
export class CameraController {
  constructor(camera, dom, opts = {}) {
    this.camera = camera;
    this.dom = dom;
    this.mode = opts.mode || 'map';
    this.bounds = opts.bounds || null;
    this.target = new THREE.Vector3(0, 0, 6);
    this.goal = { x: 0, z: 6, yaw: 0, pitch: 0.9, dist: 90 };
    this.cur = { ...this.goal };
    this.ray = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.ndc = new THREE.Vector2();
    this.tmp = new THREE.Vector3();
    this.keys = new Set();
    this.fitDefault();
  }

  // cadrage par défaut : toute la largeur de la carte si possible, centré entre la muraille et le château
  fitDefault() {
    const a = window.innerWidth / window.innerHeight;
    if (this.mode === 'city') {
      this.goal.dist = a < 0.8 ? 128 : 92;
      this.goal.z = a < 0.8 ? -4 : -2;
      return;
    }
    const portrait = MAP.orient === 'portrait';
    const fit = (MAP.W * 0.92) / (0.768 * a);
    this.goal.dist = clamp(portrait ? Math.min(fit, 135) : fit, 70, 150);
    this.goal.z = portrait ? 20 : 16;
  }
  resetView() { this.goal.yaw = 0; this.goal.pitch = 0.9; this.goal.x = 0; this.fitDefault(); }

  get yaw() { return this.cur.yaw; }

  pan(dx, dy) { // pixels écran
    const s = this.cur.dist / window.innerHeight * 1.25;
    const cy = Math.cos(this.cur.yaw), sy = Math.sin(this.cur.yaw);
    // droite = (cos, -sin) ; avant (vers le haut de l'écran) = (-sin, -cos) ; le décor suit le doigt
    this.goal.x += (-dx * cy - dy * sy) * s;
    this.goal.z += (dx * sy - dy * cy) * s;
    this.clampGoal();
  }
  panWorld(dx, dz) { this.goal.x += dx; this.goal.z += dz; this.clampGoal(); }
  rotate(da) { this.goal.yaw += da; }
  tilt(dp) { this.goal.pitch = clamp(this.goal.pitch + dp, 0.55, 1.35); }
  zoom(f) { this.goal.dist = clamp(this.goal.dist * f, 22, 165); }
  focus(x, z) { this.goal.x = x; this.goal.z = z; this.clampGoal(); }
  clampGoal() {
    const b = this.bounds || MAP;
    this.goal.x = clamp(this.goal.x, b.minX, b.maxX);
    this.goal.z = clamp(this.goal.z, b.minZ, b.maxZ);
  }

  update(dt) {
    // clavier : ZQSD / WASD / flèches, A/E rotation
    const k = this.keys, sp = this.cur.dist * 0.9 * dt;
    let fx = 0, fz = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) fz -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) fz += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) fx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) fx += 1;
    if (fx || fz) {
      const cy = Math.cos(this.cur.yaw), sy = Math.sin(this.cur.yaw);
      this.goal.x += (fx * cy + fz * sy) * sp;
      this.goal.z += (-fx * sy + fz * cy) * sp;
      this.clampGoal();
    }
    if (k.has('KeyQ')) this.goal.yaw += dt * 1.6;
    if (k.has('KeyE')) this.goal.yaw -= dt * 1.6;
    if (k.has('KeyR')) this.zoom(1 - dt);
    if (k.has('KeyF')) this.zoom(1 + dt);

    const t = 1 - Math.pow(0.0005, dt);
    this.cur.x = lerp(this.cur.x, this.goal.x, t);
    this.cur.z = lerp(this.cur.z, this.goal.z, t);
    this.cur.yaw = angleLerp(this.cur.yaw, this.goal.yaw, t);
    this.cur.pitch = lerp(this.cur.pitch, this.goal.pitch, t);
    this.cur.dist = lerp(this.cur.dist, this.goal.dist, t);
    const { x, z, yaw, pitch, dist } = this.cur;
    this.target.set(x, 0, z);
    this.camera.position.set(
      x + Math.sin(yaw) * Math.cos(pitch) * dist,
      Math.sin(pitch) * dist,
      z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    this.camera.lookAt(this.target);
  }

  screenToGround(sx, sy, h = 0) {
    const r = this.dom.getBoundingClientRect();
    this.ndc.set(((sx - r.left) / r.width) * 2 - 1, -((sy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    this.plane.constant = -h;
    const p = this.ray.ray.intersectPlane(this.plane, new THREE.Vector3());
    return p;
  }

  worldToScreen(x, y, z, out = {}) {
    this.tmp.set(x, y, z).project(this.camera);
    out.x = (this.tmp.x + 1) / 2 * window.innerWidth;
    out.y = (1 - this.tmp.y) / 2 * window.innerHeight;
    out.visible = this.tmp.z < 1;
    return out;
  }

  // Coins de la vue projetés au sol (pour la mini-carte)
  viewQuad() {
    const w = window.innerWidth, h = window.innerHeight;
    return [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => this.screenToGround(x, y) || this.target);
  }
}
