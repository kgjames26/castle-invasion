// Champ de bataille au nord de la muraille (v6.0) : les traces des sièges passés, purement décoratives.
// Arbres morts, charrettes renversées, lances plantées, ossements, pieux brisés, bannières déchirées et corbeaux
// qui s'envolent quand une horde approche. Rien ne gêne la simulation (les zombies passent au travers).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { W } from '../sim/constants.js';
import { BRAZIERS } from '../content/medieval.js';
import { applyNorthFog, applyFlutterFog } from './fog.js';

const lam = (c, o = {}) => applyNorthFog(new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...o }));

export class Battlefield {
  constructor(scene, sim) {
    this.scene = scene; this.sim = sim; let sd = 4242; const rn = () => (sd = (sd * 16807) % 2147483647) / 2147483647, rr = (a, b) => a + (b - a) * rn();
    const bark = [], wood = [], bone = [], metal = [], cloth = [];
    const clear = (x, z, r = 5) => Math.abs(x - 100) > 7 && BRAZIERS.every(b => b.zone !== 'plain' || Math.hypot(b.x - x, b.z - z) > r);
    const add = (list, g, x, y, z, ry = 0, rx = 0, rz = 0) => { g.rotateX(rx); g.rotateZ(rz); g.rotateY(ry); g.translate(x, y, z); list.push(g.index ? g.toNonIndexed() : g); };
    const spot = (z0, z1) => { for (let t = 0; t < 30; t++) { const x = rr(6, W - 6), z = rr(z0, z1); if (clear(x, z)) return [x, z]; } return [rr(6, W - 6), rr(z0, z1)]; };
    // arbres morts : tronc tordu + 3-4 branches nues
    for (let i = 0; i < 9; i++) { const [x, z] = spot(30, 118), h = rr(3.5, 6), lean = rr(-0.15, 0.15);
      add(bark, new THREE.CylinderGeometry(0.12, 0.32, h, 6).translate(0, h / 2, 0), x, 0, z, rn() * 6, lean, rr(-0.1, 0.1));
      for (let b = 0; b < 4; b++) { const l = rr(1.2, 2.4), a = rn() * 6.28, y = h * rr(0.45, 0.9); add(bark, new THREE.CylinderGeometry(0.03, 0.09, l, 4).translate(0, l / 2, 0), x + Math.sin(lean) * y, y, z, a, 0, rr(0.6, 1.1)); } }
    // charrettes renversées : caisse penchée, une roue au sol, timon cassé
    for (let i = 0; i < 4; i++) { const [x, z] = spot(50, 120), ry = rn() * 6;
      add(wood, new THREE.BoxGeometry(1.7, 0.6, 2.6).translate(0, 0.55, 0), x, 0, z, ry, 0, 0.9);
      add(wood, new THREE.CylinderGeometry(0.55, 0.55, 0.12, 10).translate(0, 0.06, 0), x + 1.6 * Math.cos(ry), 0, z - 1.6 * Math.sin(ry), 0, 0, 0);
      add(wood, new THREE.BoxGeometry(0.1, 0.1, 1.9).translate(0, 0.08, 0), x - 1.2, 0, z + 1.3, ry + 0.6); }
    // lances et épées plantées (par petits groupes)
    for (let i = 0; i < 14; i++) { const [cx, cz] = spot(40, 128), n = 1 + (rn() * 3 | 0);
      for (let k = 0; k < n; k++) { const x = cx + rr(-1.2, 1.2), z = cz + rr(-1.2, 1.2), rx = rr(-0.45, 0.45), rz = rr(-0.45, 0.45);
        if (rn() < 0.6) { add(wood, new THREE.CylinderGeometry(0.03, 0.03, 2.4, 4).translate(0, 1.0, 0), x, 0, z, 0, rx, rz); add(metal, new THREE.ConeGeometry(0.06, 0.3, 4).translate(0, 2.35, 0), x, 0, z, 0, rx, rz); }
        else { add(metal, new THREE.BoxGeometry(0.08, 1.1, 0.02).translate(0, 0.45, 0), x, 0, z, rn() * 3, rx, rz); add(metal, new THREE.BoxGeometry(0.4, 0.06, 0.06).translate(0, 0.9, 0), x, 0, z, rn() * 3, rx, rz); } } }
    // ossements : crânes et os épars
    for (let i = 0; i < 40; i++) { const [x, z] = spot(30, 132);
      if (rn() < 0.4) add(bone, new THREE.SphereGeometry(0.16, 6, 5).scale(1, 0.9, 1.15).translate(0, 0.12, 0), x, 0, z, rn() * 6);
      add(bone, new THREE.CylinderGeometry(0.035, 0.035, rr(0.4, 0.7), 4).rotateZ(Math.PI / 2).translate(0, 0.04, 0), x + rr(-0.5, 0.5), 0, z + rr(-0.5, 0.5), rn() * 6); }
    // pieux brisés (ancienne palissade) et bannières déchirées sur une hampe
    for (let i = 0; i < 10; i++) { const [x, z] = spot(60, 126), ry = rn() * 6;
      for (let k = 0; k < 4; k++) { const h = rr(0.4, 1.4); add(wood, new THREE.CylinderGeometry(0.08, 0.1, h, 5).translate(0, h / 2, 0), x + k * 0.5 * Math.cos(ry), 0, z - k * 0.5 * Math.sin(ry), 0, rr(-0.3, 0.3), rr(-0.3, 0.3)); } }
    for (let i = 0; i < 4; i++) { const [x, z] = spot(70, 124), rz = rr(-0.25, 0.25);
      add(wood, new THREE.CylinderGeometry(0.05, 0.05, 3.2, 5).translate(0, 1.6, 0), x, 0, z, 0, 0, rz);
      const fl = new THREE.PlaneGeometry(1.0, 1.3, 2, 3); const p = fl.attributes.position; for (let k = 0; k < p.count; k++) if (p.getY(k) < -0.3 && p.getX(k) > 0) p.setY(k, p.getY(k) + 0.4);   // bas déchiré
      add(cloth, fl.translate(0.55, 2.4, 0), x, 0, z, rn() * 6, 0, rz); }
    const mesh = (list, m, cast = true) => { if (!list.length) return; const mm = new THREE.Mesh(mergeGeometries(list.map(g => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); return g; })), m); mm.castShadow = cast; mm.receiveShadow = true; scene.add(mm); };
    mesh(bark, lam(0x3a2e26)); mesh(wood, lam(0x5e4632)); mesh(bone, lam(0xd8d0bc)); mesh(metal, lam(0x5a5c62)); mesh(cloth, applyFlutterFog(new THREE.MeshLambertMaterial({ color: 0x6a1e1a, side: THREE.DoubleSide }), 0.07), false);
    // corbeaux : posés au sol, ils s'envolent en tournoyant quand un zombie passe tout près, puis reviennent
    const crow = new THREE.BufferGeometry(); crow.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.18, -0.38, 0.08, -0.06, 0, 0, -0.1, 0, 0, 0.18, 0, 0, -0.1, 0.38, 0.08, -0.06, 0, -0.02, 0.18, 0, 0.05, -0.12, 0, -0.08, -0.12], 3)); crow.computeVertexNormals();
    this.crowM = new THREE.InstancedMesh(crow, lam(0x18161a, { side: THREE.DoubleSide }), 24); this.crowM.castShadow = false; scene.add(this.crowM);
    this.crows = Array.from({ length: 24 }, (_, k) => { const [x, z] = spot(40, 125); return { hx: x, hz: z, x, z, y: 0.15, fly: 0, ph: k * 1.3, a: rn() * 6 }; });
    this.d = new THREE.Object3D(); this.t = 0; this.acc = 0;
  }
  update(dt) {
    this.t += dt; const Z = this.sim.zombies, d = this.d; this.acc += dt;
    const check = this.acc > 0.25; if (check) this.acc = 0;
    this.crows.forEach((c, i) => {
      if (check && c.fly <= 0) { for (let k = 0; k < Z.n; k += 3) if (Math.abs(Z.x[k] - c.x) < 9 && Math.abs(Z.z[k] - c.z) < 9) { c.fly = 6 + (i % 4); break; } }
      if (c.fly > 0) { c.fly -= dt; c.a += dt * 1.2; const r = 6 + (i % 3) * 2; c.x = c.hx + Math.cos(c.a) * r; c.z = c.hz + Math.sin(c.a) * r; c.y += (9 + (i % 5) - c.y) * Math.min(1, dt * 1.5); }
      else { c.x += (c.hx - c.x) * Math.min(1, dt * 0.8); c.z += (c.hz - c.z) * Math.min(1, dt * 0.8); c.y += (0.15 - c.y) * Math.min(1, dt * 1.2); }
      const flap = c.y > 0.4 ? Math.sin(this.t * 14 + c.ph) * 0.6 : 0.05 * Math.sin(this.t * 2 + c.ph);
      d.position.set(c.x, c.y, c.z); d.rotation.set(0, c.fly > 0 ? -c.a : c.ph, flap * 0.3); d.scale.set(1, 1 + flap * 0.4, 1); d.updateMatrix(); this.crowM.setMatrixAt(i, d.matrix); });
    this.crowM.instanceMatrix.needsUpdate = true;
  }
}
