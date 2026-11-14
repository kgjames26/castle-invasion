import * as THREE from 'three';

const _c = new THREE.Color();

// Particules (poussière, sang, éclats, fumée) et ondes de choc — tout en instancié + pool
export class EffectsSystem {
  constructor(game) {
    this.game = game;
    const sm = game.sm;
    this.cap = sm.mobile ? 500 : 900;
    this.parts = sm.instanced(sm.fxGeo.particle, this.cap, { shadow: false });
    this.list = [];
    this.free = [];
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false });
    this.rings = sm.instanced(sm.fxGeo.ring, 40, { shadow: false, material: ringMat });
    this.ringList = [];
  }

  emit(x, y, z, vx, vy, vz, life, size, color, grav = 14, drag = 0) {
    const i = this.parts.alloc();
    if (i < 0) return;
    const p = this.free.pop() || {};
    _c.set(color);
    Object.assign(p, { i, x, y, z, vx, vy, vz, life, max: life, size, grav, drag, r: _c.r, g: _c.g, b: _c.b, rot: Math.random() * 6 });
    this.parts.color(i, p.r, p.g, p.b);
    this.list.push(p);
  }

  burst(x, y, z, n, color, speed = 4, life = 0.8, size = 1) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
      this.emit(x, y, z, Math.cos(a) * s, speed * (0.5 + Math.random()), Math.sin(a) * s, life * (0.6 + Math.random() * 0.6), size * (0.5 + Math.random() * 0.7), color);
    }
  }

  smoke(x, y, z, n) {
    for (let k = 0; k < n; k++)
      this.emit(x + (Math.random() - 0.5) * 3, y, z + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 0.8, 1.5 + Math.random() * 1.5, (Math.random() - 0.5) * 0.8,
        2 + Math.random() * 1.5, 2 + Math.random() * 2, Math.random() < 0.5 ? 0x3a3a40 : 0x50505a, -0.3, 0.5);
  }

  explosion(x, y, z, r, color) {
    this.burst(x, y + 0.3, z, Math.min(18, 6 + r * 2), color, 3 + r, 0.9, 1.3);
    this.burst(x, y + 0.3, z, 4, 0xffa040, 4, 0.35, 0.9);
    this.ring(x, z, r);
  }

  ring(x, z, r) {
    const i = this.rings.alloc();
    if (i < 0) return;
    this.ringList.push({ i, x, z, r, t: 0 });
  }

  update(dt) {
    for (let k = this.list.length - 1; k >= 0; k--) {
      const p = this.list[k];
      p.life -= dt;
      if (p.life <= 0 || p.y < -0.3) {
        this.parts.release(p.i);
        this.list[k] = this.list[this.list.length - 1];
        this.list.pop();
        this.free.push(p);
        continue;
      }
      p.vy -= p.grav * dt;
      if (p.drag) { p.vx *= 1 - p.drag * dt; p.vz *= 1 - p.drag * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.05 && p.grav > 0) { p.y = 0.05; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      p.rot += dt * 5;
    }
    for (let k = this.ringList.length - 1; k >= 0; k--) {
      const r = this.ringList[k];
      r.t += dt * 2.5;
      if (r.t >= 1) { this.rings.release(r.i); this.ringList.splice(k, 1); }
    }
  }

  draw() {
    for (const p of this.list) {
      const s = p.size * 0.5 * Math.min(1, p.life / p.max * 2);
      this.parts.set(p.i, p.x, p.y, p.z, p.rot, s, p.rot * 0.7);
    }
    this.parts.commit();
    for (const r of this.ringList) {
      this.rings.set(r.i, r.x, 0.15, r.z, 0, r.r * (0.3 + r.t * 1.2));
      const f = 1 - r.t;
      this.rings.color(r.i, f, f * 0.8, f * 0.6);
    }
    this.rings.commit();
  }
}
