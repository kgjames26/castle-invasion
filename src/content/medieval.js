// Contenu de l'époque médiévale (données pures). Le moteur ne connaît pas ces noms :
// une autre époque = un autre fichier de ce type.
export const ZOMBIES = [
  // id, nom, pv, vitesse m/s, dégâts/s sur structures, dégâts/s sur unités, taille visuelle, couleur
  { id: 0, name: 'Classique',   hp: 40,  speed: 2.2, wall: 2,  unit: 6,  size: 1.0, color: 0x7a9a5a },
  { id: 1, name: 'Rapide',      hp: 25,  speed: 4.0, wall: 1,  unit: 5,  size: 0.8, color: 0xc8d24a },
  { id: 2, name: 'Résistant',   hp: 120, speed: 2.0, wall: 3,  unit: 8,  size: 1.15, color: 0x4f7f7a },
  { id: 3, name: 'Lourd',       hp: 400, speed: 1.3, wall: 10, unit: 18, size: 1.7, color: 0x8a4f3a },
  { id: 4, name: 'Briseur',     hp: 150, speed: 1.8, wall: 45, unit: 8,  size: 1.25, color: 0xd9822b },
];
export const UNITS = {
  archer:  { cost: 30, hp: 60,  dmg: 14, rate: 1.2, range: 34 },
  soldier: { cost: 40, hp: 140, dmg: 11, rate: 0.8, range: 1.7, speed: 3.6, leash: 14, regen: 2 },
};
export const WALL = {
  segHp: 400, gateHp: 900, gateSegs: [19, 20],
  maxLevel: 5, levelHpBonus: 0.25, levelDmgCut: 0.10,
  repairHpPerStone: 8, upgradeStoneBase: 120,
};
export const START = {
  gold: 120, stone: 150, reserve: { archer: 4, soldier: 3 },
  perSector: { archer: 2, soldier: 1 },
  income: { gold: 1.5, stone: 1.0 },   // revenu provisoire (remplacé par la récolte à la Phase 3)
};
export const PHASES = { prep: 'Préparation', alert: 'Alerte', assault: 'Assaut', calm: 'Accalmie' };
export const TIMING = { firstPrep: 60, prep: 30, alert: 10, calm: 15 };

// Composition d'une vague (indicatif, équilibrable sans toucher au moteur)
export function waveSpec(v) {
  const n = Math.round(30 * Math.pow(1.18, v - 1));
  const frac = [0, 0, 0, 0, 0];
  frac[1] = v >= 2 ? Math.min(0.35, 0.05 * (v - 1)) : 0;
  frac[2] = v >= 3 ? Math.min(0.25, 0.04 * (v - 2)) : 0;
  frac[4] = v >= 4 ? Math.min(0.15, 0.03 * (v - 3)) : 0;
  frac[3] = v >= 5 ? Math.min(0.10, 0.02 * (v - 4)) : 0;
  frac[0] = 1 - frac[1] - frac[2] - frac[3] - frac[4];
  const sectors = 1 + Math.min(4, Math.floor(v / 3));
  return { n, frac, sectors, duration: Math.min(45, 15 + n / 20), reward: { gold: 60 + 12 * v, stone: 40 + 8 * v } };
}
