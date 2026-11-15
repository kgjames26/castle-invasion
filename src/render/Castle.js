// Château fort (v3.0) : remplace le château du kit, trop « conte de fées ». Même langage que la muraille et ses châtelets :
// pierre grise (stoneMaterial), toits de tuiles rouge sombre, créneaux, meurtrières, bannières bleues.
// Enceinte carrée flanquée de quatre tours rondes, châtelet d'entrée au sud (côté village), donjon carré à tourelles au nord,
// logis dans la cour. Les géométries sont fusionnées par matériau : quelques appels de dessin seulement.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { stoneMaterial } from './Stone.js';
import { patchNorthFog, applyFlutterFog } from './fog.js';

const fog = m => { m.onBeforeCompile = sh => patchNorthFog(sh); m.customProgramCacheKey = () => 'nfog'; return m; };

export function buildCastleFort(cx, cz) {
  const parts = { st: [], dk: [], roof: [], wood: [], slit: [], blue: [], gold: [], iron: [], pave: [] };
  const put = (k, geo, x, y, z, ry = 0) => { geo.rotateY(ry); geo.translate(x, y, z); parts[k].push(geo.index ? geo.toNonIndexed() : geo); };
  const box = (k, w, h, d, x, y, z, ry = 0) => put(k, new THREE.BoxGeometry(w, h, d), x, y + h / 2, z, ry);
  const cyl = (k, r0, r1, h, x, y, z, seg = 14) => put(k, new THREE.CylinderGeometry(r0, r1, h, seg), x, y + h / 2, z);
  const cone = (k, r, h, x, y, z, seg = 14, ry = 0) => put(k, new THREE.ConeGeometry(r, h, seg), x, y + h / 2, z, ry);

  // ——— enceinte : courtines crénelées avec chemin de ronde ———
  const HW = 18, HD = 13, WH = 8, T = 2.6;          // demi-largeur, demi-profondeur, hauteur, épaisseur
  const merlons = (x0, z0, x1, z1, y, out) => {      // créneaux le long d'un segment, côté extérieur
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / 1.6), ux = (x1 - x0) / L, uz = (z1 - z0) / L, ry = Math.atan2(-uz, ux);
    for (let i = 0; i < n; i++) { const t = (i + 0.5) * L / n; box('st', 0.95, 1.1, 0.7, x0 + ux * t + out[0], y, z0 + uz * t + out[1], ry); }
  };
  const curtain = (x0, z0, x1, z1, out) => {
    const L = Math.hypot(x1 - x0, z1 - z0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, ry = Math.atan2(-(z1 - z0), x1 - x0);
    box('st', L, WH, T, mx, 0, mz, ry);
    box('dk', L, 0.8, T + 0.5, mx, 0, mz, ry);                                                   // socle (talus)
    box('st', L, 0.35, T + 0.3, mx, WH - 0.35, mz, ry);                                          // cordon sous les créneaux
    merlons(x0, z0, x1, z1, WH, [out[0] * (T / 2 - 0.35), out[1] * (T / 2 - 0.35)]);
    for (let t = 4; t < L - 3; t += 5) box('slit', 0.32, 1.3, 0.12, x0 + (x1 - x0) * t / L + out[0] * (T / 2 + 0.02), 3.6, z0 + (z1 - z0) * t / L + out[1] * (T / 2 + 0.02), ry);   // meurtrières
  };
  curtain(cx - HW, cz - HD, cx + HW, cz - HD, [0, -1]);                 // nord (vers la muraille)
  curtain(cx - HW, cz - HD, cx - HW, cz + HD, [-1, 0]);                 // ouest
  curtain(cx + HW, cz - HD, cx + HW, cz + HD, [1, 0]);                  // est
  curtain(cx - HW, cz + HD, cx - 5.5, cz + HD, [0, 1]);                 // sud, de part et d'autre du châtelet
  curtain(cx + 5.5, cz + HD, cx + HW, cz + HD, [0, 1]);

  // ——— tours d'angle rondes, à fruit, toit conique ———
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = cx + sx * HW, z = cz + sz * HD, R = 4.0, H = 13;
    cyl('dk', R + 0.6, R + 1.0, 1.4, x, 0, z);                                                    // empattement
    cyl('st', R, R + 0.45, H, x, 0, z);
    cyl('st', R + 0.45, R + 0.3, 0.9, x, H, z);                                                   // mâchicoulis en encorbellement
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; box('st', 1.0, 1.1, 0.6, x + Math.cos(a) * (R + 0.15), H + 0.9, z + Math.sin(a) * (R + 0.15), -a + Math.PI / 2); }
    cone('roof', R + 0.9, 6.5, x, H + 1.0, z, 14);
    cone('gold', 0.14, 1.6, x, H + 7.4, z, 6);
    for (const h of [4.5, 8.5]) { const a = Math.atan2(sz, sx); box('slit', 0.32, 1.2, 0.12, x + Math.cos(a) * (R + 0.25), h, z + Math.sin(a) * (R + 0.25), -a + Math.PI / 2); }
  }

  // ——— châtelet d'entrée (sud) : deux tours carrées, passage voûté, herse, salle au-dessus ———
  {
    const z = cz + HD, GH = 10.5;
    for (const sx of [-1, 1]) {
      const x = cx + sx * 4.2;
      box('st', 4.4, GH + 1.4, 6.6, x, 0, z + 0.6);
      box('dk', 4.9, 0.8, 7.1, x, 0, z + 0.6);
      for (let i = 0; i < 3; i++) { box('st', 0.95, 1.0, 0.6, x - 1.5 + i * 1.5, GH + 1.4, z + 3.65); box('st', 0.95, 1.0, 0.6, x - 1.5 + i * 1.5, GH + 1.4, z - 2.45); }
      for (const dz of [-1.5, 1.5]) box('st', 0.6, 1.0, 0.95, x + sx * 1.9, GH + 1.4, z + 0.6 + dz);
      cone('roof', 3.7, 4.2, x, GH + 1.4, z + 0.6, 4, Math.PI / 4);
      box('slit', 0.32, 1.3, 0.12, x, 6.2, z + 3.92);
      box('slit', 0.32, 1.3, 0.12, x, 2.8, z + 3.92);
    }
    box('st', 4.0, GH - 5.6, 6.0, cx, 5.6, z + 0.6);                                              // salle au-dessus du passage
    for (let i = 0; i < 3; i++) box('st', 0.9, 0.9, 0.6, cx - 1.2 + i * 1.2, GH, z + 3.45);
    box('slit', 2.2, 0.9, 0.12, cx, 7.6, z + 3.62);                                               // fenêtre de la salle de la herse
    box('dk', 3.8, 5.4, 6.2, cx, 0.2, z + 0.6);                                                   // passage sombre (voûte)
    put('dk', new THREE.CylinderGeometry(1.9, 1.9, 6.2, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), cx, 5.6, z + 0.6);   // arc de la voûte
    box('slit', 3.6, 5.4, 0.1, cx, 0.2, z + 3.35); put('slit', new THREE.CircleGeometry(1.8, 12, 0, Math.PI), cx, 5.6, z + 3.36);   // ombre du passage, derrière la herse
    for (let k = 0; k < 6; k++) box('iron', 0.14, 5.2, 0.14, cx - 1.6 + k * 0.64, 0.6, z + 3.5);   // herse levée à mi-hauteur
    for (let k = 0; k < 3; k++) box('iron', 3.5, 0.14, 0.16, cx, 1.8 + k * 1.5, z + 3.5);
    for (const bx of [cx - 4.2, cx + 4.2]) { box('blue', 1.5, 3.4, 0.08, bx, 5.2, z + 3.97); box('gold', 1.6, 0.18, 0.1, bx, 8.6, z + 3.98); box('gold', 0.5, 0.5, 0.09, bx, 6.8, z + 4.0); }
    box('wood', 3.6, 0.25, 5.0, cx, 0.02, z + 5.8);                                               // pont / seuil de bois
  }

  // ——— donjon carré au nord de la cour, quatre échauguettes, toit en pavillon ———
  {
    const x = cx - 2, z = cz - 4, S = 11, H = 20;
    box('dk', S + 1.2, 1.2, S + 1.2, x, 0, z);
    box('st', S, H, S, x, 0, z);
    box('st', S + 0.8, 0.9, S + 0.8, x, H, z);                                                    // encorbellement
    for (const [ux, uz, ry] of [[1, 0, Math.PI / 2], [-1, 0, Math.PI / 2], [0, 1, 0], [0, -1, 0]]) for (let i = 0; i < 6; i++) { const t = -S / 2 + 0.9 + i * (S - 1.8) / 5; box('st', 1.0, 1.2, 0.7, x + ux * (S / 2 + 0.05) + (ux ? 0 : t), H + 0.9, z + uz * (S / 2 + 0.05) + (uz ? 0 : t), ry); }
    cone('roof', S * 0.62, 7, x, H + 0.9, z, 4, Math.PI / 4);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {                               // échauguettes
      const tx = x + sx * S / 2, tz = z + sz * S / 2;
      cyl('st', 1.3, 0.5, 1.6, tx, H - 1.6, tz, 10); cyl('st', 1.3, 1.3, 2.6, tx, H, tz, 10); cone('roof', 1.6, 2.8, tx, H + 2.6, tz, 10);
    }
    for (const h of [5, 10, 15]) { box('slit', 0.4, 1.5, 0.12, x, h, z + S / 2 + 0.02); box('slit', 0.4, 1.5, 0.12, x + S / 2 + 0.02, h, z, Math.PI / 2); box('slit', 0.4, 1.5, 0.12, x - S / 2 - 0.02, h, z, Math.PI / 2); }
    box('wood', 1.8, 3.2, 0.2, x, 1.2, z + S / 2 + 0.06);                                         // porte haute du donjon
    box('wood', 1.6, 0.3, 3.2, x, 1.2, z + S / 2 + 1.6);                                          // escalier
    for (let i = 0; i < 4; i++) box('st', 1.8, 0.3 * (i + 1), 0.8, x, 0, z + S / 2 + 3.4 - i * 0.6);
    box('wood', 0.16, 6, 0.16, x, H + 7.6, z);                                                    // mât et grand étendard
    box('blue', 2.6, 1.6, 0.06, x + 1.35, H + 11.6, z); box('gold', 0.6, 0.6, 0.08, x + 1.35, H + 11.9, z);
  }

  // ——— logis (grande salle) contre la courtine est, puits, cour pavée ———
  {
    const x = cx + 10, z = cz + 1;
    box('st', 9, 6, 13, x, 0, z);
    const g = new THREE.BufferGeometry(), w = 13.6, d = 9.8, h = 4.2;   // toit à deux pans, faîtage nord-sud
    const P = [[-d / 2, 0, -w / 2], [d / 2, 0, -w / 2], [0, h, -w / 2], [-d / 2, 0, w / 2], [d / 2, 0, w / 2], [0, h, w / 2]], I = [0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4];
    g.setAttribute('position', new THREE.Float32BufferAttribute(I.flatMap(i => P[i]), 3)); g.computeVertexNormals(); put('roof', g, x, 6, z);
    for (let i = 0; i < 3; i++) box('slit', 0.7, 1.6, 0.12, x - 4.52, 2.6, z - 4 + i * 4, Math.PI / 2);
    box('wood', 1.6, 2.6, 0.2, x - 4.55, 0, z + 5.2, Math.PI / 2);
    for (const dz of [-3.5, 3.5]) box('st', 1.1, 3, 1.1, x, 6, z + dz);                            // cheminées
  }
  cyl('st', 1.3, 1.4, 1.0, cx - 10, 0, cz + 6, 12); box('wood', 0.15, 2.2, 0.15, cx - 11, 1.0, cz + 6); box('wood', 0.15, 2.2, 0.15, cx - 9, 1.0, cz + 6); box('wood', 2.4, 0.4, 0.4, cx - 10, 3.0, cz + 6);   // puits
  box('pave', HW * 2 - T, 0.12, HD * 2 - T, cx, 0, cz);                                          // cour
  // escaliers vers le chemin de ronde
  for (let i = 0; i < 8; i++) { box('st', 2.0, (i + 1) * WH / 8, 1.0, cx - HW + T / 2 + 1.0, 0, cz + HD - T / 2 - 1 - (7 - i) * 1.0); box('st', 1.0, (i + 1) * WH / 8, 2.0, cx - HW + T / 2 + 1.5 + i * 1.0, 0, cz - HD + T / 2 + 1.0); }

  // ——— assemblage : un maillage par matériau ———
  const M = {
    st: stoneMaterial(0xb0aca4), dk: stoneMaterial(0x6a6660), pave: stoneMaterial(0x9a948a),
    roof: fog(new THREE.MeshLambertMaterial({ color: 0x7a3a2a, flatShading: true, side: THREE.DoubleSide })),
    wood: fog(new THREE.MeshLambertMaterial({ color: 0x4a3426, flatShading: true })),
    slit: new THREE.MeshBasicMaterial({ color: 0x18120e }),
    blue: applyFlutterFog(new THREE.MeshLambertMaterial({ color: 0x2f5fb0, side: THREE.DoubleSide }), 0.09),
    gold: fog(new THREE.MeshLambertMaterial({ color: 0xd9b43a, flatShading: true })),
    iron: fog(new THREE.MeshLambertMaterial({ color: 0x3a3c42, flatShading: true })),
  };
  // (v10.6) face arrière habillée (c'est elle qu'on voit depuis le village de la caméra par défaut, le château étant retourné) :
  // trois bannières, une poterne de bois ferrée sous un arc de pierre, deux contreforts
  { const zb = cz - HD - T / 2 - 0.06;
    for (const bx of [cx - 10, cx + 10]) { box('blue', 1.7, 3.6, 0.08, bx, 3.2, zb); box('gold', 1.9, 0.18, 0.1, bx, 6.8, zb - 0.01); box('gold', 0.55, 0.55, 0.09, bx, 4.9, zb - 0.02); }
    box('dk', 2.6, 3.4, 0.3, cx, 0, zb + 0.05); box('wood', 1.9, 2.8, 0.2, cx, 0, zb - 0.12); for (const y of [0.7, 1.9]) box('iron', 1.9, 0.14, 0.06, cx, y, zb - 0.24); box('st', 3.0, 0.5, 0.5, cx, 3.4, zb - 0.1);
    for (const bx of [cx - 5, cx + 5]) { box('st', 1.3, WH * 0.7, 1.1, bx, 0, zb - 0.45); box('st', 1.0, WH * 0.18, 0.7, bx, WH * 0.7, zb - 0.25); } }
  const grp = new THREE.Group();
  for (const k in parts) {
    if (!parts[k].length) continue;
    const geo = mergeGeometries(parts[k].map(g => { for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal') g.deleteAttribute(a); if (!g.attributes.normal) g.computeVertexNormals(); return g; }), false);
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, M[k]); m.castShadow = k !== 'slit' && k !== 'pave'; m.receiveShadow = true; grp.add(m);
  }
  return grp;
}
