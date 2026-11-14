// Terrain : types par cellule de 2 m + coûts de déplacement. Génération déterministe (carte fixe).
import { GW, GD, CELL, W, WALL_Z0 } from './constants.js';
import { makeRng } from './rng.js';

export const BATTLEFIELD_Z = 90;
export const T = { GRASS: 0, FOREST: 1, HILL: 2, ROCK: 3, ROAD: 4 };
export const COST = new Float32Array([1, 2, 1.5, Infinity, 0.7]);

export function generateTerrain(seed = 1337) {
  const rng = makeRng(seed);
  const type = new Uint8Array(GW * GD);
  const blob = (cxm, czm, rm, t, only) => {
    const r2 = rm * rm;
    for (let gz = Math.max(0, ((czm - rm) / CELL) | 0); gz <= Math.min(GD - 1, ((czm + rm) / CELL) | 0); gz++)
      for (let gx = Math.max(0, ((cxm - rm) / CELL) | 0); gx <= Math.min(GW - 1, ((cxm + rm) / CELL) | 0); gx++) {
        const dx = (gx + .5) * CELL - cxm, dz = (gz + .5) * CELL - czm;
        const wob = 1 + 0.25 * Math.sin(gx * 1.7 + gz * 0.9);
        if (dx * dx + dz * dz <= r2 * wob && (only === undefined || type[gz * GW + gx] === only)) type[gz * GW + gx] = t;
      }
  };
  // collines et forêts (z 20–135), rochers (z 45–118), chemins
  for (let i = 0; i < 7; i++) blob(rng() * W, 25 + rng() * 105, 8 + rng() * 8, T.HILL);
  for (let i = 0; i < 9; i++) blob(rng() * W, 22 + rng() * 100, 7 + rng() * 9, T.FOREST);
  for (let i = 0; i < 6; i++) { // chemins qui serpentent du nord vers la muraille
    const x0 = 20 + rng() * 160, a = 6 + rng() * 10, ph = rng() * 6.28;
    for (let z = 0; z < WALL_Z0 - 2; z += 2) blob(Math.max(4, Math.min(W - 4, x0 + a * Math.sin(z / 28 + ph))), z, 3, T.ROAD);
  }
  const rocks = [];
  for (let i = 0; i < 12; i++) {
    const x = 10 + rng() * 180, z = 45 + rng() * 73, r = 3 + rng() * 4.5;
    rocks.push({ x, z, r }); blob(x, z, r, T.ROCK);
  }
  // CHAMP DE BATAILLE agrandi : de z = 90 à la muraille (52 m de profondeur × 200 m de large), sans rochers, forêts ni collines.
  // Il reste les chemins (déplacements plus rapides). C'est là que les escouades peuvent faire des sorties.
  for (let gz = (BATTLEFIELD_Z / CELL) | 0; gz < GD; gz++) for (let gx = 0; gx < GW; gx++) { const t = type[gz * GW + gx]; if (t === T.ROCK || t === T.FOREST || t === T.HILL) type[gz * GW + gx] = T.GRASS; }
  return { type, rocks };
}
