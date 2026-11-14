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
// Unités : `pop` = places occupées dans la population PARTAGÉE (villageois + militaires), plafonnée par les maisons.
export const UNITS = {
  archer:  { name: 'Archer',   ico: '🏹', hp: 60,  dmg: 14, rate: 1.2, range: 34, pop: 1, cost: { gold: 25, wood: 15 },           train: 7,  from: 'range',    color: 0x2fae6a, size: 1 },
  soldier: { name: 'Fantassin', ico: '⚔', hp: 140, dmg: 11, rate: 0.8, reach: 1.7, speed: 3.6, pop: 1, cost: { gold: 30, iron: 15 },           train: 8,  from: 'barracks', color: 0x3d7bd6, size: 1,   squad: 10, form: 'line' },
  heavy:   { name: 'Lourd',    ico: '🛡', hp: 380, dmg: 22, rate: 1.1, reach: 2.0, speed: 2.6, pop: 2, cost: { gold: 60, iron: 50 },           train: 16, from: 'barracks', color: 0x7d8cab, size: 1.3, squad: 8,  form: 'phalanx', minLevel: 2 },
  cavalry: { name: 'Cavalier', ico: '🐎', hp: 200, dmg: 18, rate: 0.9, reach: 2.2, speed: 6.5, pop: 2, cost: { gold: 50, food: 30, iron: 10 }, train: 14, from: 'stable',   color: 0xa855c9, size: 1.3, squad: 8,  form: 'wedge', charge: 0.8 },
};
export const UNIT_ORDER = ['soldier', 'heavy', 'cavalry', 'archer'];
// Formations d'escouade : effets mesurables (engage = part des membres qui combattent, contact = attaquants max par membre,
// def = multiplicateur de dégâts reçus, atk = multiplicateur de dégâts infligés, speed = vitesse, charge = bonus d'élan).
export const FORMATIONS = {
  line:    { name: 'Ligne',    ico: '▬', engage: 1.0,  contact: 1.8, def: 1.0,  atk: 1.0, speed: 1.0,  charge: 0,   info: 'Front large : tous combattent' },
  phalanx: { name: 'Phalange', ico: '▦', engage: 0.7,  contact: 1.4, def: 0.65, atk: 0.9, speed: 0.7,  charge: 0,   info: 'Boucliers : −35 % de dégâts reçus, lente' },
  wedge:   { name: 'Coin',     ico: '▲', engage: 0.6,  contact: 1.0, def: 1.0,  atk: 1.0, speed: 1.0,  charge: 0.6, info: 'Charge : +60 % de dégâts à l\'impact' },
  square:  { name: 'Carré',    ico: '■', engage: 0.8,  contact: 1.2, def: 0.85, atk: 0.9, speed: 0.85, charge: 0,   info: 'Défend de partout : −15 % de dégâts reçus' },
  column:  { name: 'Colonne',  ico: '║', engage: 0.35, contact: 0.7, def: 1.0,  atk: 1.0, speed: 1.25, charge: 0,   info: 'Marche rapide, combat faible' },
};
export const SQUAD = { sortieZ: [58, 139], garrisonLeash: 16, intercept: 80, chargeRange: 28, aggro: 9, maxSquads: 60 };
export const TRAIN = { baseQueue: 5, queuePerLevel: 5, speedPerLevel: 0.25 };
export const WALL = {
  segHp: 400, gateHp: 900, gateSegs: [19, 20],
  maxLevel: 5, levelHpBonus: 0.25, levelDmgCut: 0.10,
  repairHpPerStone: 8, upgradeBase: { stone: 120, wood: 60 },
};
export const START = {
  res: { wood: 150, stone: 150, iron: 60, food: 150, gold: 100 },
  reserve: { archer: 4, soldier: 0, heavy: 0, cavalry: 0 },
  perSector: { archer: 2 },
  squads: [{ type: 'soldier', n: 6, sector: 2 }, { type: 'soldier', n: 4, sector: 1 }, { type: 'soldier', n: 4, sector: 3 }],
  villagers: 10,
  assign: { wood: 3, stone: 2, iron: 1, gold: 1, food: 3, repair: 0 },   // répartition de départ (modifiable)
};

// ——— Économie (Phase 3) ———
export const RES = ['wood', 'stone', 'iron', 'food', 'gold'];
export const RES_INFO = {
  wood: { name: 'Bois', ico: '🪵', color: 0x8b5a2b }, stone: { name: 'Pierre', ico: '🪨', color: 0x9aa0a6 },
  iron: { name: 'Fer', ico: '⛓', color: 0x5b6b8a }, food: { name: 'Nourriture', ico: '🌾', color: 0xe6c84a },
  gold: { name: 'Or', ico: '🪙', color: 0xffd23f },
};
export const ECON = {
  villagerSpeed: 3.6, carry: 10, slotsPerLevel: 5, maxLevel: 4,
  baseStore: 300, storePerLevel: 400,
  upkeep: { villager: 0.02, unit: 0.03 },    // nourriture / personne / seconde
  famineMult: 0.5, levelGather: 0.15, millBonus: 0.2,
  repairHpPerSec: 14, villagerCost: { food: 40 },
  popBase: 20, popPerHouse: 8, housesStart: 4, housesMax: 60,      // population max PARTAGÉE = base + maisons × 8
  drop: { x: 100, z: 284 },                  // point de dépôt : le château
  restock: { gold: 25, stone: 20, iron: 10 },
};
// Tâches : chaque villageois sait quoi faire ; le joueur ne règle que les effectifs.
export const TASKS = {
  wood:   { name: 'Bûcherons',      ico: '🪵', res: 'wood',  building: 'sawmill', site: { x: 40,  z: 255 }, rate: 1.3,  deposit: 9000 },
  stone:  { name: 'Carriers',       ico: '🪨', res: 'stone', building: 'quarry',  site: { x: 160, z: 255 }, rate: 1.0,  deposit: 7000 },
  iron:   { name: 'Mineurs (fer)',  ico: '⛓', res: 'iron',  building: 'mine',    site: { x: 182, z: 236 }, rate: 0.9, deposit: 3500 },
  gold:   { name: 'Mineurs (or)',   ico: '🪙', res: 'gold',  building: 'mine',    site: { x: 18,  z: 236 }, rate: 0.8,  deposit: 2500 },
  food:   { name: 'Fermiers',       ico: '🌾', res: 'food',  building: 'farm',    site: { x: 100, z: 252 }, rate: 1.15 },
  repair: { name: 'Réparation de la muraille', ico: '🔧', building: null, slots: 10 },
};
// Bâtiments : niveau 0 = à construire. Coût du niveau N+1 = base × (N+1).
export const BUILDINGS = {   // group: 'eco' (onglet Village) ou 'army' (onglet Armée)
  sawmill:   { name: 'Scierie',   ico: '🪚', group: 'eco', start: 1, cost: { wood: 60 },             pos: { x: 40,  z: 262 }, size: [9, 5, 7],  color: 0x9b6a3a, info: 'Emplacements bûcherons · +15 % de rendement par niveau' },
  quarry:    { name: 'Carrière',  ico: '⛏', group: 'eco', start: 1, cost: { wood: 60 },             pos: { x: 160, z: 262 }, size: [9, 5, 7],  color: 0x8a8d92, info: 'Emplacements carriers · +15 % de rendement par niveau' },
  mine:      { name: 'Mine',      ico: '⛓', group: 'eco', start: 1, cost: { wood: 100, stone: 60 }, pos: { x: 182, z: 243 }, size: [8, 6, 8],  color: 0x4f5a72, info: 'Emplacements fer + or (partagés) · +15 %/niveau' },
  farm:      { name: 'Ferme',     ico: '🌾', group: 'eco', start: 1, cost: { wood: 70 },             pos: { x: 100, z: 244 }, size: [16, 1.2, 10], color: 0xc9b24a, info: 'Emplacements fermiers · +15 % de rendement par niveau' },
  mill:      { name: 'Moulin',    ico: '🌀', group: 'eco', start: 0, cost: { wood: 90, stone: 40 },  pos: { x: 128, z: 258 }, size: [6, 9, 6],  color: 0xcfc3a1, info: 'Nourriture +20 % par niveau' },
  granary:   { name: 'Grenier',   ico: '🏚', group: 'eco', start: 1, cost: { wood: 80, stone: 30 },  pos: { x: 66,  z: 270 }, size: [9, 6, 7],  color: 0xb08a4a, info: 'Stock de nourriture +400 par niveau' },
  warehouse: { name: 'Entrepôt',  ico: '📦', group: 'eco', start: 1, cost: { wood: 80, stone: 40 },  pos: { x: 134, z: 272 }, size: [10, 6, 8], color: 0x7a6a55, info: 'Stock bois/pierre/fer/or +400 par niveau' },
};
// Bâtiments militaires (onglet Armée) : le niveau accélère l'entraînement (+25 %/niveau) et agrandit la file.
export const ARMY_BUILDINGS = {
  barracks: { name: 'Caserne',      ico: '🪖', group: 'army', start: 1, cost: { wood: 100, stone: 50 }, pos: { x: 38,  z: 180 }, size: [16, 5, 11], color: 0x8a4545, info: 'Fantassins · Lourds dès le niveau 2' },
  stable:   { name: 'Écurie',       ico: '🐎', group: 'army', start: 0, cost: { wood: 120, stone: 40 }, pos: { x: 162, z: 180 }, size: [16, 5, 11], color: 0x7a5a3a, info: 'Cavaliers' },
  range:    { name: 'Champ de tir', ico: '🎯', group: 'army', start: 1, cost: { wood: 90, stone: 30 },  pos: { x: 100, z: 176 }, size: [18, 3, 9],  color: 0x4a6f4a, info: 'Archers' },
  forge:    { name: 'Forge',        ico: '🔨', group: 'army', start: 0, max: 1, cost: { wood: 80, stone: 80, iron: 40 }, pos: { x: 100, z: 195 }, size: [10, 6, 8], color: 0x5a4f58, info: 'Débloque les améliorations militaires' },
};
ARMY_BUILDINGS.workshop = { name: 'Atelier de siège', ico: '🛠', group: 'army', start: 0, max: 3, cost: { wood: 140, stone: 100, iron: 30 }, pos: { x: 150, z: 205 }, size: [14, 6, 10], color: 0x6a5a45, info: '2 armes déployables par niveau · Niv.1 baliste · Niv.2 catapulte · Niv.3 trébuchet' };
Object.assign(BUILDINGS, ARMY_BUILDINGS);
// Armes de siège (reprises de l'ancien jeu) : fixes, derrière la muraille. Munitions prélevées dans les stocks.
// range/minRange en mètres depuis l'arme ; aoe = rayon d'impact ; speed = m/s du projectile ; crew = places de population.
export const SIEGE = {
  ballista:  { name: 'Baliste',   ico: '🎯', range: 46, minRange: 4,  dmg: 85,  aoe: 2.2, reload: 3.0, speed: 55, ammo: { iron: 1 },  cost: { wood: 80, iron: 30 },                       time: 18, level: 1, crew: 2, color: 0x8a6a3a, size: 1.0, info: 'Tir tendu, 85 dégâts : excellente contre les gros zombies' },
  catapult:  { name: 'Catapulte', ico: '☄', range: 60, minRange: 14, dmg: 60,  aoe: 4.5, reload: 5.0, speed: 26, ammo: { stone: 2 }, cost: { wood: 120, stone: 60, iron: 20 },          time: 25, level: 2, crew: 2, color: 0x7a5a30, size: 1.3, info: 'Tir en cloche, dégâts de zone 4,5 m' },
  trebuchet: { name: 'Trébuchet', ico: '🏰', range: 82, minRange: 24, dmg: 150, aoe: 6.5, reload: 9.0, speed: 32, ammo: { stone: 5 }, cost: { wood: 200, stone: 120, iron: 60, gold: 50 }, time: 40, level: 3, crew: 3, color: 0x5a4020, size: 1.7, info: 'Portée immense, 150 dégâts de zone 6,5 m, rechargement lent' },
};
export const SIEGE_ORDER = ['ballista', 'catapult', 'trebuchet'];
export const SIEGE_RULES = { perLevel: 2, slotsPerSector: 3, queueMax: 4, speedPerLevel: 0.25, refund: 0.5 };
// Améliorations : effets mesurables, coût du niveau N+1 = base × (N+1).
export const UPGRADES = {
  tools:   { name: 'Outils',            ico: '🛠', max: 4, cost: { wood: 60, iron: 20 }, per: 0.20, info: 'Récolte +20 % par niveau' },
  carts:   { name: 'Chariots',          ico: '🛒', max: 3, cost: { wood: 80, iron: 25 }, per: 0.50, info: 'Charge portée +50 % par niveau' },
  boots:   { name: 'Chemins pavés',     ico: '👢', max: 3, cost: { stone: 70, wood: 40 }, per: 0.20, info: 'Vitesse de marche +20 % par niveau' },
  plow:    { name: 'Charrue',           ico: '🚜', max: 3, cost: { wood: 70, iron: 20 }, per: 0.25, info: 'Rendement des fermes +25 % par niveau' },
  masonry: { name: 'Maçonnerie',        ico: '🧱', max: 3, cost: { stone: 80, iron: 30 }, per: 0.30, info: 'Réparation +30 % vitesse, −10 % pierre par niveau' },
  // — Forge (onglet Armée) —
  weapons: { name: 'Armes affûtées',    ico: '🗡', group: 'army', req: 'forge', max: 4, cost: { iron: 40, gold: 40 }, per: 0.10, info: 'Dégâts de toutes les unités +10 % par niveau' },
  armor:   { name: 'Armures',           ico: '🦺', group: 'army', req: 'forge', max: 4, cost: { iron: 50, gold: 30 }, per: 0.08, info: 'Dégâts reçus par les escouades −8 % par niveau' },
  archery: { name: 'Arcs longs',        ico: '🏹', group: 'army', req: 'forge', max: 3, cost: { wood: 60, iron: 30, gold: 30 }, per: 0.10, info: 'Archers : dégâts +10 %, portée +3 m par niveau' },
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
  return { n, frac, sectors, duration: Math.min(45, 15 + n / 20), reward: { gold: 25 + 6 * v, stone: 20 + 4 * v, iron: 10 + 2 * v } };
}
