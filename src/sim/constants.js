// Constantes du monde. Repère : x → est, z → sud. z = 0 = bord NORD (en haut de l'écran).
export const W = 200, D = 320;
export const CELL = 2, GW = W / CELL, GD = D / CELL;           // grille logique 100 × 160
export const WALL_Z0 = 142, WALL_Z1 = 150;                       // emprise de la muraille
export const WALL_STAND_Z = 141.2;                               // où les zombies se tiennent pour attaquer
export const SECTORS = 5, SECTOR_W = W / SECTORS;                // 5 secteurs de 40 m
export const SEG_W = 5, SEGS = W / SEG_W, SEGS_PER_SECTOR = SECTOR_W / SEG_W; // 40 tronçons, 8 par secteur
export const SECTOR_NAMES = ['Aile gauche', 'Centre gauche', 'Centre', 'Centre droit', 'Aile droite'];
export const SECTOR_SHORT = ['AG', 'CG', 'C', 'CD', 'AD'];
export const CASTLE = { x: 100, z: 298, r: 15, hp: 6000 };
export const TICK = 1 / 20;                                      // simulation à 20 Hz
export const MAX_Z = 4000;                                       // capacité d'agents zombies simulés
export const ARCHER_SLOTS = 12, SOLDIER_SLOTS = 10;              // par secteur
export const ARCHER_Z = 146, SOLDIER_Z = 155;
export const STORE_CAP = 600;
export const sectorOfX = x => Math.max(0, Math.min(SECTORS - 1, (x / SECTOR_W) | 0));
export const segOfX = x => Math.max(0, Math.min(SEGS - 1, (x / SEG_W) | 0));
