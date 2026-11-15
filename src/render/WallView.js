// Muraille v1.1 : panneaux du modèle GLB « dungeon_wall » (façade extérieure + parement intérieur) autour d'un cœur en pierre dont le dessus est
// le chemin de ronde ; escaliers pour monter les archers.
// v1.8 : créneaux (merlons), contreforts, et pour chaque porte un CHÂTELET : deux tours carrées crénelées, une salle au-dessus du passage
// et une HERSE de fer qui monte dans le châtelet quand une escouade doit passer ; bannières aux couleurs du royaume.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SEGS, SEG_W, SECTORS, SECTOR_W, WALK_H, GATE_SEGS, STAIR_OFF, wallOff, wallSlope } from '../sim/constants.js';
import { STAIR_Z0, STAIR_Z1 } from '../sim/army.js';
import { stoneMaterial } from './Stone.js';

// GATE_HS : hauteur de chaque passage (la porte centrale, la grande porte, est plus haute) ; GATE_TH : hauteur des châtelets
export const GATE_HS = [4.4, 4.4, 4.4], GATE_TH = [6.4, 6.4, 6.4];   // v3.1 : les portes ne dépassent plus la muraille — seule la herse levée en sort
export const WALL_H = 6.4, GATE_H = 4.4, Z_OUT = 143.5, Z_IN = 148.9, Z_MID = 146.2, THICK = 2.0, STEPS = 12;
// muraille en ARC (v2.1) : un point exprimé dans le repère « muraille droite » (x le long du mur, z en profondeur) est reporté sur l'arc :
// décalé vers le nord de wallOff(x) et tourné selon la pente locale, pour que chaque pièce suive la courbe.
export function arcPoint(x, z, out = {}) {
  const s = wallSlope(x), n = Math.hypot(1, s), nx = -s / n, nz = 1 / n, dz = z - Z_MID;
  out.x = x + nx * dz; out.z = Z_MID + wallOff(x) + nz * dz; out.ry = -Math.atan(s); return out;
}
export function arcObject(o) { const p = arcPoint(o.position.x, o.position.z); o.position.x = p.x; o.position.z = p.z; o.rotation.y += p.ry; return o; }
const _ap = {};
export const STAIR_XS = Array.from({ length: SECTORS * 2 }, (_, i) => ((i / 2) | 0) * SECTOR_W + STAIR_OFF((i / 2) | 0)[i % 2]);

export async function loadWall(url) {
  const g = await new GLTFLoader().loadAsync(url); let mesh = null; g.scene.updateMatrixWorld(true); g.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
  const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);               // le panneau fait 10 × 4 × 0,66 m, pieds à y = 0
  for (const k of ['tangent', 'uv1', 'uv2']) if (geo.attributes[k]) geo.deleteAttribute(k);
  geo.computeBoundingSphere(); const map = mesh.material.map; map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  return { geo, map };
}

// Dallage du chemin de ronde (v3.4) : dalles de pierre taillée en rangs décalés, joints sombres, mousse dans les joints,
// usure claire au passage des archers, éclats et grain. Texture procédurale 1024 px pour 2,5 m (tuilable).
let walkTex = null;
function walkwayTexture() {
  if (walkTex) return walkTex;
  const S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d');
  let sd = 77; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  g.fillStyle = '#3c3a36'; g.fillRect(0, 0, S, S);                                                       // mortier
  const rows = [150, 210, 170, 240, 254], ys = []; let y = 0; for (const h of rows) { ys.push([y, h]); y += h; }
  for (const [y0, h] of ys) {
    let x = -r() * 200; const off = x;
    while (x < S) {
      const w = 160 + r() * 260, gap = 9;
      for (const dx of [0, S, -S]) {
        const px = x + dx; if (px > S || px + w < 0) continue;
        const base = 128 + r() * 34, warm = r() * 10 - 3, rc = base + warm, gc2 = base + warm * 0.4, bc = base - warm * 0.6;
        g.fillStyle = `rgb(${rc | 0},${gc2 | 0},${bc | 0})`;
        g.beginPath(); g.roundRect(px + gap / 2, y0 + gap / 2, w - gap, h - gap, 12); g.fill();
        // biseau : bord haut-gauche clair, bas-droit sombre
        g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 5; g.beginPath(); g.moveTo(px + gap, y0 + h - gap); g.lineTo(px + gap, y0 + gap); g.lineTo(px + w - gap, y0 + gap); g.stroke();
        g.strokeStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.moveTo(px + w - gap, y0 + gap); g.lineTo(px + w - gap, y0 + h - gap); g.lineTo(px + gap, y0 + h - gap); g.stroke();
        // nuances, taches et éclats sur la dalle
        for (let k = 0; k < 7; k++) { const cx = px + gap + r() * (w - 2 * gap), cy = y0 + gap + r() * (h - 2 * gap), rad = 10 + r() * 50, v = r() < 0.5 ? 0 : 255; const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rad); gr.addColorStop(0, `rgba(${v},${v},${v},${0.05 + r() * 0.06})`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`); g.fillStyle = gr; g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2); }
        if (r() < 0.45) { g.strokeStyle = 'rgba(30,28,25,.45)'; g.lineWidth = 1.5; g.beginPath(); let cx = px + gap + r() * w * 0.6, cy = y0 + gap + r() * h * 0.3; g.moveTo(cx, cy); for (let k = 0; k < 4; k++) { cx += 10 + r() * 30; cy += r() * 30; g.lineTo(cx, cy); } g.stroke(); }   // fissure
        if (r() < 0.3) { g.fillStyle = 'rgba(40,38,34,.6)'; g.beginPath(); g.arc(px + (r() < 0.5 ? gap + 4 : w - gap - 4), y0 + gap + r() * (h - 2 * gap), 6 + r() * 8, 0, 7); g.fill(); }   // éclat au bord
      }
      x += w;
    }
  }
  // mousse et herbe rase dans les joints
  for (let k = 0; k < 520; k++) { const x = r() * S, y = r() * S, rad = 3 + r() * 9; g.fillStyle = `rgba(${70 + r() * 30 | 0},${96 + r() * 30 | 0},${48 + r() * 20 | 0},${0.12 + r() * 0.25})`; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); }
  // usure : bande plus claire et lisse au milieu (passage des archers)
  const wear = g.createLinearGradient(0, 0, 0, S); wear.addColorStop(0, 'rgba(255,250,240,0)'); wear.addColorStop(0.5, 'rgba(255,250,240,.07)'); wear.addColorStop(1, 'rgba(255,250,240,0)'); g.fillStyle = wear; g.fillRect(0, 0, S, S);
  // grain fin
  const img = g.getImageData(0, 0, S, S), d = img.data; for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 18; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(img, 0, 0);
  walkTex = new THREE.CanvasTexture(cv); walkTex.colorSpace = THREE.SRGBColorSpace; walkTex.wrapS = walkTex.wrapT = THREE.RepeatWrapping; walkTex.anisotropy = 8; walkTex.repeat.set(SEG_W / 2.5, 4.6 / 2.5);
  return walkTex;
}

export class WallView {
  constructor(scene, asset, sim, fog) {
    this.sim = sim; this.d = new THREE.Object3D(); this.c = new THREE.Color(); this.c2 = new THREE.Color(1, 0.35, 0.25); this.m = new THREE.Matrix4(); this.m2 = new THREE.Matrix4(); this.m3 = new THREE.Matrix4();
    const panelMat = fog(new THREE.MeshLambertMaterial({ map: asset.map, side: THREE.DoubleSide })), stone = stoneMaterial(0xffffff), unit = new THREE.BoxGeometry(1, 1, 1);
    const mk = (geo, mat, cap) => { const im = new THREE.InstancedMesh(geo, mat, cap); im.frustumCulled = false; im.count = 0; im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); scene.add(im); return im; };
    this.outer = mk(asset.geo, panelMat, SEGS + 2); this.inner = mk(asset.geo, panelMat, SEGS + 2); this.core = mk(unit, stone, SEGS + 2);
    { const pg = new THREE.PlaneGeometry(1, 1); pg.rotateX(-Math.PI / 2); this.walk = mk(pg, fog(new THREE.MeshLambertMaterial({ map: walkwayTexture() })), SEGS + 2); this.walk.receiveShadow = true; }   // dallage du chemin de ronde
    this.leaves = mk(asset.geo, panelMat, 2); this.steps = mk(unit, stone, STAIR_XS.length * STEPS);
    this.merlons = mk(unit, stone, SEGS * 3 + 64); this.butt = mk(unit, stone, SEGS + 2);
    // herse : grille de barreaux de fer, pointes en bas (une instance par porte)
    const bars = [], iron = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); bars.push(g); };
    const GW = SEG_W * 2 - 0.4; for (let k = 0; k <= 8; k++) { const x = -GW / 2 + k * GW / 8; iron(0.16, GATE_H, 0.16, x, GATE_H / 2, 0); const c = new THREE.ConeGeometry(0.14, 0.4, 4); c.rotateX(Math.PI); c.translate(x, -0.15, 0); bars.push(c); }
    for (let k = 0; k < 5; k++) iron(GW, 0.14, 0.2, 0, 0.5 + k * (GATE_H - 0.8) / 4, 0);
    this.portcullis = new THREE.InstancedMesh(mergeGeometries(bars.map(g => g.index ? g.toNonIndexed() : g), false), fog(new THREE.MeshLambertMaterial({ color: 0x3a3c42, flatShading: true })), GATE_SEGS.reduce((n, [a, b]) => n + (b - a + 1) / 2, 0)); this.portcullis.frustumCulled = false; scene.add(this.portcullis);   // une herse de 10 m par paire de tronçons (grande porte : 2 herses)
    // châtelets : tours, salle au-dessus du passage, créneaux, toits, bannières (statiques : construits une fois)
    this.gatehouse = new THREE.Group(); scene.add(this.gatehouse);
    const st = stoneMaterial(0xb0aca4), dark = stoneMaterial(0x6a6660), roof = fog(new THREE.MeshLambertMaterial({ color: 0x7a3a2a, flatShading: true })), wood = fog(new THREE.MeshLambertMaterial({ color: 0x4a3426, flatShading: true }));
    const add = (geo, m, x, y, z, ry = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; arcObject(o); o.castShadow = o.receiveShadow = true; this.gatehouse.add(o); return o; };
    const wallSkin = (w, h, x, y, z, ry) => { const o = add(asset.geo, panelMat, x, y, z, ry); o.scale.set(w / 10, h / 4, 0.35); return o; };   // parement du modèle de muraille
    GATE_SEGS.forEach(([a, b], gi) => {
      const x0 = a * SEG_W, x1 = (b + 1) * SEG_W, gc = (x0 + x1) / 2, TH = GATE_TH[gi], GH = GATE_HS[gi], tall = GH > WALK_H, RW = x1 - x0 + 0.4, RD = tall ? Z_IN + 0.6 - (Z_OUT - 1.4) : THICK + 1.6, RZ = tall ? (Z_IN + 0.6 + Z_OUT - 1.4) / 2 : Z_OUT + 0.4, RY0 = GH - 0.6, RH = TH - RY0;   // grande porte : salle sur toute l'épaisseur
      add(new THREE.BoxGeometry(RW, RH, RD), dark, gc, RY0 + RH / 2, RZ);                                                                   // salle de la herse (cœur)
      wallSkin(RW + 0.1, RH, gc, RY0, RZ - RD / 2 - 0.08, 0); wallSkin(RW + 0.1, RH, gc, RY0, RZ + RD / 2 + 0.08, Math.PI);                    // façades : même parement que la muraille
      add(new THREE.BoxGeometry(RW + 0.5, 0.35, RD + 0.5), dark, gc, RY0 - 0.1, RZ);                                                          // linteau sombre au-dessus de la herse
      for (const tx of [x0 - 1.5, x1 + 1.5]) {
        add(new THREE.BoxGeometry(3.0, TH, 6.0), st, tx, TH / 2, Z_MID - 0.4);                                                                  // piliers de la porte, à hauteur de muraille
        for (const oz of [-2.4, 0, 2.4]) add(new THREE.BoxGeometry(0.9, 0.9, 0.7), st, tx, TH + 0.45, Z_MID - 0.4 + oz);                         // créneaux
        add(new THREE.BoxGeometry(0.4, 1.0, 0.2), wood, tx, TH * 0.55, Z_MID - 3.42).material = new THREE.MeshBasicMaterial({ color: 0x1a120c });   // meurtrière
      }
      for (let i = 0; i < Math.round((x1 - x0) / 2.5); i++) add(new THREE.BoxGeometry(0.9, 0.9, 0.6), st, x0 + 1.25 + i * 2.5, TH + 0.45, Z_OUT - 0.4);   // créneaux au-dessus du passage
      for (const gx of [x0 + 0.25, x1 - 0.25]) add(new THREE.BoxGeometry(0.22, TH + 2.6, 0.3), fog(new THREE.MeshLambertMaterial({ color: 0x3a3c42, flatShading: true })), gx, (TH + 2.6) / 2, Z_OUT + 0.15);   // rails de la herse : seuls à dépasser
      // bannières suspendues de part et d'autre du passage
      for (const bx of [gc - 3.4, gc + 3.4]) { add(new THREE.BoxGeometry(1.5, 2.0, 0.08), fog(new THREE.MeshLambertMaterial({ color: 0x2f5fb0, side: THREE.DoubleSide })), bx, RY0 + 1.15, Z_OUT - 1.62); add(new THREE.BoxGeometry(1.55, 0.18, 0.1), fog(new THREE.MeshLambertMaterial({ color: 0xf2c94a })), bx, RY0 + 0.1, Z_OUT - 1.64); add(new THREE.BoxGeometry(0.5, 0.5, 0.1), fog(new THREE.MeshLambertMaterial({ color: 0xf2c94a })), bx, RY0 + 1.3, Z_OUT - 1.67, Math.PI / 4); }
    });
    // portes : une par passage (gauche, centre, droite) ; chacune a ses deux battants et son linteau
    this.gates = GATE_SEGS.map(([a, b], g) => ({ g, segs: [a, b], x0: a * SEG_W, x1: (b + 1) * SEG_W }));
    this.stairs();
  }
  stairs() {
    const d = this.d, dz = (STAIR_Z0 - STAIR_Z1) / STEPS; let n = 0;
    for (const x of STAIR_XS) for (let i = 0; i < STEPS; i++) {
      const top = (i + 1) * WALK_H / STEPS, p = arcPoint(x, STAIR_Z0 - (i + 0.5) * dz, _ap); d.position.set(p.x, top / 2, p.z); d.scale.set(3.4, top, dz + 0.02); d.rotation.set(0, p.ry, 0); d.updateMatrix(); this.steps.setMatrixAt(n, d.matrix); this.steps.setColorAt(n, this.c.setRGB(0.5 + 0.012 * (i & 1), 0.48, 0.45)); n++;
    }
    this.steps.count = n; this.steps.instanceMatrix.needsUpdate = true; this.steps.instanceColor.needsUpdate = true;
  }
  place(im, k, x, y, z, ry, sx, sy, sz) { const d = this.d, p = arcPoint(x, z, _ap); d.position.set(p.x, y, p.z); d.rotation.set(0, ry + p.ry, 0); d.scale.set(sx, sy, sz); d.updateMatrix(); im.setMatrixAt(k, d.matrix); }
  tint(im, k, ratio, breached, base = 1) { const c = this.c; if (breached) c.setRGB(0.35, 0.27, 0.24); else c.setRGB(base, base, base).lerp(this.c2, (1 - ratio) * 0.85); im.setColorAt(k, c); }
  update() {
    const wall = this.sim.wall, gates = this.sim.army.gate, ease = t => t * t * (3 - 2 * t); let n = 0, nl = 0;
    for (let i = 0; i < SEGS; i++) {
      const hp = wall.hp[i], ratio = hp / wall.segMax(i), br = hp <= 0, lvl = wall.level[wall.sectorOf(i)], x = i * SEG_W + SEG_W / 2, H = WALL_H + 0.3 * (lvl - 1), k = n;
      if (wall.isGate(i)) continue;                                                           // porte : herse (plus bas)
      this.place(this.outer, k, x, 0, Z_OUT, 0, 0.5, br ? 0.2 : H / 4, THICK); this.tint(this.outer, k, ratio, br);
      this.place(this.inner, k, x, 0, Z_IN, Math.PI, 0.5, br ? 0.2 : WALK_H / 4, THICK); this.tint(this.inner, k, ratio, br);
      this.place(this.core, k, x, br ? 0.5 : WALK_H / 2, Z_MID, 0, SEG_W, br ? 1 : WALK_H, 4.7); this.tint(this.core, k, ratio, br, 0.5); n++;
    }
    // linteau au-dessus de la porte (panneau extérieur + dalle du chemin de ronde)
    let lintels = 0;
    for (const G of this.gates) {
      const gw = G.x1 - G.x0, gc = (G.x0 + G.x1) / 2, intact = wall.hp[G.segs[0]] > 0 || wall.hp[G.segs[1]] > 0, GH = GATE_HS[G.g];
      if (!intact) continue;
      if (GH >= WALK_H) continue;                                                  // grande porte : pas de linteau, le châtelet couvre tout
      this.place(this.outer, n, gc, GH, Z_OUT, 0, gw / 10, Math.max(0.05, WALL_H - GH) / 4, THICK); this.tint(this.outer, n, 1, false);
      this.place(this.core, n, gc, (GH + WALK_H) / 2, Z_MID, 0, gw, WALK_H - GH, 4.7); this.core.setColorAt(n, this.c.setRGB(0.5, 0.5, 0.5)); n++; lintels++;
    }
    this.outer.count = n; this.core.count = n; this.inner.count = n - lintels; this.leaves.count = nl;
    { let nw = 0; for (let i = 0; i < SEGS; i++) { if (wall.hp[i] <= 0) continue; const ratio = wall.hp[i] / wall.segMax(i); this.place(this.walk, nw, i * SEG_W + SEG_W / 2, WALK_H + 0.025, Z_MID, 0, SEG_W + 0.02, 1, 4.6); this.tint(this.walk, nw, ratio, false); nw++; }
      this.walk.count = nw; this.walk.instanceMatrix.needsUpdate = true; this.walk.instanceColor.needsUpdate = true; }
    // herses : montent dans le châtelet à l'ouverture ; disparaissent si la porte est détruite
    let k = 0;
    this.gates.forEach(G => {
      const GH = GATE_HS[G.g], intact = wall.hp[G.segs[0]] > 0 || wall.hp[G.segs[1]] > 0, up = ease(gates[G.g]) * (GH - 0.3), nh = Math.round((G.x1 - G.x0) / 10);
      const r = Math.min(wall.hp[G.segs[0]] / wall.segMax(G.segs[0]), wall.hp[G.segs[1]] / wall.segMax(G.segs[1]));
      for (let h = 0; h < nh; h++, k++) { this.place(this.portcullis, k, G.x0 + 5 + h * 10, intact ? up : -20, Z_OUT + 0.15, 0, 1, GH / GATE_H, 1.25); this.portcullis.setColorAt(k, this.c.setRGB(1, 1, 1).lerp(this.c2, (1 - Math.max(0, r)) * 0.8)); }
    });
    this.portcullis.instanceMatrix.needsUpdate = true; if (this.portcullis.instanceColor) this.portcullis.instanceColor.needsUpdate = true;
    // créneaux (3 merlons par tronçon intact, plus hauts selon le niveau) et contreforts sur la face nord
    let nm = 0, nb = 0;
    for (let i = 0; i < SEGS; i++) {
      if (wall.isGate(i) || wall.hp[i] <= 0) continue;
      const lvl = wall.level[wall.sectorOf(i)], H = WALL_H + 0.3 * (lvl - 1), ratio = wall.hp[i] / wall.segMax(i);
      for (let k = 0; k < 3; k++) { if (ratio < 0.5 && k === ((i * 7) % 3)) continue; this.place(this.merlons, nm, i * SEG_W + 0.85 + k * 1.65, H + 0.45, Z_OUT - 0.1, 0, 1.0, 0.9 + 0.08 * lvl, 0.7); this.tint(this.merlons, nm, ratio, false, 0.95); nm++; }
      const nx = i + 1; if (nx < SEGS && !wall.isGate(nx) && wall.hp[nx] > 0 && (i & 1)) { this.place(this.butt, nb, nx * SEG_W, 1.6, Z_OUT - 1.0, 0, 1.1, 3.2 + 0.2 * lvl, 1.6); this.tint(this.butt, nb, ratio, false, 0.8); nb++; }
    }
    this.merlons.count = nm; this.butt.count = nb;
    for (const im of [this.merlons, this.butt]) { im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; }
    for (const im of [this.outer, this.inner, this.core, this.leaves]) { im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; }
  }
}
