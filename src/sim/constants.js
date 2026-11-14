// Constantes du monde. Repère : x → est, z → sud. z = 0 = bord NORD (en haut de l'écran).
export const W = 200, D = 320;
export const CELL = 2, GW = W / CELL, GD = D / CELL;           // grille logique 100 × 160
export const WALL_Z0 = 142, WALL_Z1 = 150;                       // emprise de la muraille
export const WALL_STAND_Z = 141.2;                               // où les zombies se tiennent pour attaquer
// v2.1 : la muraille décrit un léger ARC poussé vers le nord (le centre avance de WALL_BOW m, les extrémités restent en place).
// Toutes les profondeurs « de muraille » (WALL_Z0, WALL_Z1, WALL_STAND_Z, ARCHER_Z) se décalent de wallOff(x) (négatif = vers le nord).
export const WALL_BOW = 7;
export const wallOff = x => { const u = (Math.min(200, Math.max(0, x)) - 100) / 100; return -WALL_BOW * (1 - u * u); };
export const wallSlope = x => { const u = (Math.min(200, Math.max(0, x)) - 100) / 100; return 2 * WALL_BOW * u / 100; };   // dz/dx de l'arc
export const SECTORS = 5, SECTOR_W = W / SECTORS;                // 5 secteurs de 40 m
export const SEG_W = 5, SEGS = W / SEG_W, SEGS_PER_SECTOR = SECTOR_W / SEG_W; // 40 tronçons, 8 par secteur
// (v2.7) plus de codes AG/CG/C… : on parle des REPÈRES de la muraille (les trois portes et les deux pans de mur entre elles)
export const SECTOR_NAMES = ['Porte gauche', 'Mur gauche', 'Grande porte', 'Mur droit', 'Porte droite'];
export const SECTOR_AT = ['la porte gauche', 'le mur gauche', 'la grande porte', 'le mur droit', 'la porte droite'];
export const SECTOR_SHORT = ['AG', 'CG', 'C', 'CD', 'AD'];
export const CASTLE = { x: 100, z: 298, r: 15, hp: 6000 };
export const TICK = 1 / 20;                                      // simulation à 20 Hz
export const MAX_Z = 4000;                                       // capacité d'agents zombies simulés
export const ARCHER_SLOTS = 40;                                 // archers par secteur (2 rangées sur le chemin de ronde)
export const ARCHER_Z = 146, GARRISON_Z = 164;                  // disposition (nord → sud) : champ de bataille · muraille 142-150 · armée de garnison 160-185 · placette 188-208 · village
// trois portes : gauche, centre, droite (tronçons de 5 m ; évitent les escaliers des archers)
export const GATE_SEGS = [[3, 4], [19, 20], [35, 36]];
export const GATE_XS = GATE_SEGS.map(([a, b]) => (a + b + 1) * SEG_W / 2);
export const WALK_H = 5.2;                                       // hauteur du chemin de ronde
export const PLAZA = { x: 100, z: 198, hw: 28, hd: 10 };         // placette : point de ralliement par défaut des unités créées
export const STORE_CAP = 600;
export const sectorOfX = x => Math.max(0, Math.min(SECTORS - 1, (x / SECTOR_W) | 0));
export const segOfX = x => Math.max(0, Math.min(SEGS - 1, (x / SEG_W) | 0));
