// Contenu de l'époque médiévale (données pures). Le moteur ne connaît pas ces noms :
// une autre époque = un autre fichier de ce type.
export const ZOMBIES = [
  // id, nom, pv, vitesse m/s, dégâts/s sur structures, dégâts/s sur unités, taille visuelle, couleur
  { id: 0, name: 'Classique',   hp: 40,  speed: 2.2, wall: 2,  unit: 6,  size: 1.0, color: 0x7a9a5a },
  { id: 1, name: 'Rapide',      hp: 25,  speed: 4.0, wall: 1,  unit: 5,  size: 0.88, color: 0xc8d24a },
  { id: 2, name: 'Résistant',   hp: 120, speed: 2.0, wall: 3,  unit: 8,  size: 1.15, color: 0x4f7f7a },
  { id: 3, name: 'Lourd',       hp: 400, speed: 1.3, wall: 10, unit: 18, size: 1.7, color: 0x8a4f3a },
  { id: 4, name: 'Briseur',     hp: 150, speed: 1.8, wall: 45, unit: 8,  size: 1.25, color: 0xd9822b },
  { id: 5, name: 'Colosse',     hp: 1400, speed: 1.2, wall: 40, unit: 40, size: 4.4, color: 0x9a6f5c },   // géant : au moins 4× la taille d'un zombie normal, apparaît « parfois »
  { id: 6, name: 'Golem',       hp: 850, speed: 1.4, wall: 22, unit: 30, size: 2.4, color: 0x7d7a74 },    // golem de pierre : ses coups font trembler la muraille et tomber les archers
];
// Forge v1.9 : attaque et défense PROPRES à chaque type, indépendantes du rang (bâtiment d'origine).
//  attaque +12 %/niveau ; défense : dégâts reçus −8 %/niveau ; plafond = 2 × niveau de la forge (max 6).
export const SMITH = {
  types: { archer: '🏹 Archers', soldier: '⚔ Fantassins', heavy: '🛡 Lourds', knight: '🗡 Chevaliers', cavalry: '🐎 Cavaliers', siege: '🛠 Tours et machines', mage: '🧙 Magicien' },
  atk: 0.12, def: 0.08, max: 6, perForge: 2,
  atkCost: lv => ({ iron: 30 + 25 * lv, gold: 20 + 15 * lv }), defCost: lv => ({ iron: 35 + 30 * lv, wood: 20 + 15 * lv }),
};
// Infirmerie : PV rendus par seconde (part des PV max) aux escouades en garnison hors combat ; part des tombés sauvés (retour en réserve)
export const INFIRMARY = { heal: [0, 0.012, 0.022, 0.035], save: [0, 0.1, 0.2, 0.3] };
// Golem : toutes les `every` secondes au contact de la muraille, un coup de poing sismique : dégâts aux tronçons voisins,
// secousse, et jusqu'à `fall` archers du secteur proche tombent du chemin de ronde (une partie survit et retourne en réserve).
export const GOLEM = { every: 3.5, quake: 40, reach: 2, fall: 2, fallReach: 12, survive: 0.5, from: 5 };
export const golemsFor = v => v < GOLEM.from ? 0 : 1 + ((v - GOLEM.from) / 3 | 0);
// Unités : `pop` = places occupées dans la population PARTAGÉE (villageois + militaires), plafonnée par les maisons.
export const UNITS = {
  archer:  { name: 'Archer',   ico: '🏹', hp: 60,  dmg: 14, rate: 1.2, range: 34, pop: 1, cost: { gold: 14, wood: 15 },           train: 7,  from: 'range',    color: 0x2fae6a, size: 1 },
  soldier: { name: 'Fantassin', ico: '⚔', hp: 140, dmg: 11, rate: 0.8, reach: 1.7, speed: 3.6, pop: 1, cost: { gold: 16, iron: 15 },           train: 8,  from: 'barracks', color: 0x3d7bd6, size: 1,   squad: 10, form: 'line' },
  heavy:   { name: 'Lourd',    ico: '🛡', hp: 380, dmg: 22, rate: 1.1, reach: 2.0, speed: 2.6, pop: 2, cost: { gold: 33, iron: 50 },           train: 16, from: 'barracks', color: 0x7d8cab, size: 1.3, squad: 8,  form: 'phalanx', minLevel: 2 },
  knight:  { name: 'Chevalier', ico: '🗡', hp: 620, dmg: 34, rate: 1.0, reach: 2.4, speed: 3.0, pop: 3, cost: { gold: 70, iron: 60 },           train: 22, from: 'barracks', color: 0xd9b43a, size: 1.25, squad: 5,  form: 'wedge', minLevel: 3, cleave: 3, charge: 0.4 },
  cavalry: { name: 'Cavalier', ico: '🐎', hp: 200, dmg: 18, rate: 0.9, reach: 2.2, speed: 6.5, pop: 2, cost: { gold: 28, food: 30, iron: 10 }, train: 14, from: 'stable',   color: 0xa855c9, size: 1.3, squad: 8,  form: 'wedge', charge: 0.8 },
};
// Rangs militaires : le NIVEAU du bâtiment d'entraînement (caserne, écurie, champ de tir) est le rang de toutes ses unités.
// cost = multiplicateur du coût d'une unité ; force = dégâts ; res = résistance (dégâts reçus divisés) ; speed = vitesse de marche.
// (le moral n'existe pas encore dans le moteur : il est noté ici pour mémoire.)
export const RANKS = [
  { name: 'Recrue',   cost: 1.00, force: 1.00, res: 1.00, speed: 1.00, moral: -0.20 },
  { name: 'Régulier', cost: 1.35, force: 1.20, res: 1.25, speed: 1.10, moral: 0 },
  { name: 'Vétéran',  cost: 1.80, force: 1.50, res: 1.60, speed: 1.25, moral: 0.25 },
  { name: 'Élite',    cost: 2.50, force: 1.95, res: 2.10, speed: 1.45, moral: 0.50 },
  { name: 'Légende',  cost: 3.50, force: 2.60, res: 2.80, speed: 1.70, moral: 1 },
];
export const RANK_BUILDINGS = ['barracks', 'stable', 'range'];
export const RANK_UP = { mult: [0, 0, 2, 3.5, 6, 10], extra: { iron: 20, gold: 20 } };   // coût de passage au niveau N = (coût de base + extra) × mult[N]
export const UNIT_ORDER = ['soldier', 'heavy', 'knight', 'cavalry', 'archer'];
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
  segHp: 400, gateHp: 900,
  maxLevel: 5, levelHpBonus: 0.25, levelDmgCut: 0.10,
  repairHpPerStone: 8, upgradeBase: { stone: 120, wood: 60 },
};
export const START = {
  res: { wood: 240, stone: 170, iron: 40, food: 200, gold: 80 },
  reserve: { archer: 0, soldier: 0, heavy: 0, knight: 0, cavalry: 0 },
  perSector: { archer: 0 },
  squads: [],
  villagers: 10,
  assign: { wood: 3, stone: 2, iron: 0, gold: 0, food: 3, repair: 0 },   // répartition de départ (modifiable)
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
  popBase: 40, popPerHouse: 15, housesStart: 0, housesMax: 70,     // population max PARTAGÉE = château 40 + maisons × 15 (grosse population, v1.9)
  drop: { x: 100, z: 284 },                  // point de dépôt : le château
  restock: { gold: 25, stone: 20, iron: 10 },
};
// Prospection : un villageois libre explore la campagne ; au bout de `time` secondes il découvre un NOUVEAU gisement (pierre, fer ou or) ailleurs sur la carte.
// Gisements présents dès le début (bords de la zone constructible, hors des chemins de construction)
export const START_DEPOSITS = { stone: [{ x: 188, z: 296, amount: 3000 }], iron: [{ x: 22, z: 272, amount: 2600 }, { x: 176, z: 276, amount: 2600 }], gold: [{ x: 12, z: 300, amount: 2200 }] };
export const PROSPECT = { cost: { gold: 40, food: 30 }, time: 45, amount: [2200, 3800], maxPerRes: 4, res: ['stone', 'iron', 'gold'], zone: { x0: 12, x1: 188, z0: 206, z1: 292 }, clear: 16 };
// Tâches : chaque villageois sait quoi faire ; le joueur ne règle que les effectifs.
export const TASKS = {
  wood:   { name: 'Bûcherons',      ico: '🪵', res: 'wood',  building: 'sawmill', site: { x: 40,  z: 255 }, rate: 1.3,  deposit: 9000, regen: 3.2 },
  stone:  { name: 'Carriers',       ico: '🪨', res: 'stone', building: 'quarry',  site: { x: 160, z: 255 }, rate: 1.0,  deposit: 7000 },
  iron:   { name: 'Mineurs (fer)',  ico: '⛓', res: 'iron',  building: 'mine',    site: { x: 182, z: 236 }, rate: 0.9, deposit: 3500 },
  gold:   { name: 'Mineurs (or)',   ico: '🪙', res: 'gold',  building: 'mine',    site: { x: 18,  z: 236 }, rate: 0.8,  deposit: 2500 },
  food:   { name: 'Fermiers',       ico: '🌾', res: 'food',  building: 'farm',    site: { x: 100, z: 252 }, rate: 1.15 },
  repair: { name: 'Réparation de la muraille', ico: '🔧', building: null, slots: 10 },
};
// Bâtiments : niveau 0 = à construire. Coût du niveau N+1 = base × (N+1).
export const BUILDINGS = {   // group: 'eco' (onglet Village) ou 'army' (onglet Armée)
  sawmill:   { time: 25, base: 3, name: 'Scierie',   ico: '🪚', group: 'eco', start: 0, cost: { wood: 60 },             pos: { x: 40,  z: 262 }, size: [9, 5, 7],  color: 0x9b6a3a, info: 'Emplacements bûcherons · +15 % de rendement par niveau' },
  quarry:    { time: 25, base: 3, name: 'Carrière',  ico: '⛏', group: 'eco', start: 0, cost: { wood: 60 },             pos: { x: 160, z: 262 }, size: [9, 5, 7],  color: 0x8a8d92, info: 'Emplacements carriers · +15 % de rendement par niveau' },
  mine:      { time: 40, base: 0, name: 'Mine',      ico: '⛓', group: 'eco', start: 0, cost: { wood: 100, stone: 60 }, pos: { x: 182, z: 243 }, size: [8, 6, 8],  color: 0x4f5a72, info: 'Emplacements fer + or (partagés) · +15 %/niveau' },
  farm:      { time: 30, base: 3, name: 'Ferme',     ico: '🌾', group: 'eco', start: 0, cost: { wood: 70 },             pos: { x: 100, z: 244 }, size: [16, 1.2, 10], color: 0xc9b24a, max: 6, info: 'Emplacements fermiers · +15 % de rendement par niveau · s\'agrandit (champs, poulailler, verger, silo, pâture)' },
  mill:      { time: 30, base: 0, name: 'Moulin',    ico: '🌀', group: 'eco', start: 0, cost: { wood: 90, stone: 40 },  pos: { x: 128, z: 258 }, size: [6, 9, 6],  color: 0xcfc3a1, max: 5, info: 'Nourriture +20 % par niveau · s\'agrandit (fournil, socle de pierre, roue à aubes)' },
  granary:   { time: 28, base: 0, name: 'Grenier',   ico: '🏚', group: 'eco', start: 0, cost: { wood: 80, stone: 30 },  pos: { x: 66,  z: 270 }, size: [9, 6, 7],  color: 0xb08a4a, info: 'Stock de nourriture +400 par niveau' },
  warehouse: { time: 32, base: 0, name: 'Entrepôt',  ico: '📦', group: 'eco', start: 0, cost: { wood: 80, stone: 40 },  pos: { x: 134, z: 272 }, size: [10, 6, 8], color: 0x7a6a55, info: 'Stock bois/pierre/fer/or +400 par niveau' },
};
// Bâtiments militaires (onglet Armée) : le niveau accélère l'entraînement (+25 %/niveau) et agrandit la file.
export const ARMY_BUILDINGS = {
  barracks: { time: 45, base: 0, name: 'Caserne',      ico: '🪖', group: 'army', start: 0, cost: { wood: 100, stone: 50 }, max: 5, pos: { x: 36,  z: 224 }, size: [16, 5, 11], color: 0x8a4545, info: 'Fantassins · Lourds dès le niveau 2 · Chevaliers dès le niveau 3' },
  stable:   { time: 45, base: 0, name: 'Écurie',       ico: '🐎', group: 'army', start: 0, cost: { wood: 120, stone: 40 }, max: 5, pos: { x: 164, z: 224 }, size: [16, 5, 11], color: 0x7a5a3a, info: 'Cavaliers' },
  range:    { time: 35, base: 0, name: 'Champ de tir', ico: '🎯', group: 'army', start: 0, cost: { wood: 90, stone: 30 },  max: 5, pos: { x: 100, z: 224 }, size: [18, 3, 9],  color: 0x4a6f4a, info: 'Archers' },
  forge:    { time: 50, base: 0, name: 'Forge',        ico: '🔨', group: 'army', start: 0, max: 3, cost: { wood: 80, stone: 80, iron: 40 }, pos: { x: 66, z: 236 }, size: [10, 6, 8], color: 0x5a4f58, info: 'Attaque et défense de chaque type d\'unité, indépendamment de son rang · niveau = plafond (2/4/6)' },
  infirmary: { time: 40, base: 0, name: 'Infirmerie',  ico: '🏥', group: 'army', start: 0, max: 3, cost: { wood: 90, stone: 60, food: 60 }, pos: { x: 140, z: 290 }, size: [12, 6, 9], color: 0xe8e2d6, info: 'Soigne les escouades au repos · sauve une partie des blessés graves' },
  university: { time: 60, base: 0, name: 'Université', ico: '🎓', group: 'eco', start: 0, max: 3, cost: { wood: 140, stone: 120, gold: 40 }, pos: { x: 60, z: 286 }, size: [14, 9, 10], color: 0xb8a88a, info: 'Améliore les villageois · niveau = plafond des améliorations (2/3/4)' },
};
// Maison du sorcier : invoque UN magicien autonome (il choisit seul de soigner ou d'attaquer). Le niveau du bâtiment = niveau du magicien.
ARMY_BUILDINGS.wizard = { time: 60, base: 0, name: 'Maison du sorcier', ico: '🔮', group: 'army', start: 0, max: 5, cost: { wood: 120, stone: 140, gold: 80 }, pos: { x: 100, z: 280 }, size: [10, 14, 10], color: 0x5a4a8a, info: 'Invoque un magicien autonome · chaque niveau le rend plus puissant' };
ARMY_BUILDINGS.workshop = { time: 55, base: 0, name: 'Atelier de siège', ico: '🛠', group: 'army', start: 0, max: 3, cost: { wood: 140, stone: 100, iron: 30 }, pos: { x: 136, z: 236 }, size: [14, 6, 10], color: 0x6a5a45, info: '2 armes déployables par niveau · Niv.1 baliste · Niv.2 catapulte · Niv.3 trébuchet' };
Object.assign(BUILDINGS, ARMY_BUILDINGS);
// ——— Phase 6 : construction libre ———
// Structures multiples (placées où l'on veut) : maisons et tours de défense. Les autres bâtiments existent en un seul exemplaire (niveaux).
export const MULTI = {
  house: { name: 'Maison', ico: '🏠', group: 'eco', time: 16, size: [6, 4.6, 6], info: `+15 places de population (villageois + armée)` },
  tower: { name: 'Tour de défense', ico: '🗼', group: 'def', time: 30, size: [5, 14, 5], cost: { wood: 70, stone: 110 }, max: 5, info: 'Tire seule sur les zombies à portée · améliorable' },
};
export const STRUCT = { ...BUILDINGS, ...MULTI };
// ——— Magicien (Maison du sorcier) ———
// Il se tient à distance derrière la muraille, choisit seul son action selon l'urgence : soigner une escouade blessée, refermer une brèche,
// frapper la plus grosse menace. Mana : chaque sort en coûte ; régénération continue. Niveau = niveau de la Maison du sorcier.
export const MAGE = {
  summon: { gold: 120, food: 60 }, summonTime: 18, respawn: 30, hp: 260, hpPerLevel: 90, speed: 4.2, mana: 100, manaPerLevel: 25, regen: 7, regenPerLevel: 1.5,
  keepAway: 14, range: 48, rangePerLevel: 3, homeZ: 166,
  spells: {
    fireball:  { name: 'Boule de feu',      ico: '🔥', level: 1, mana: 18, cd: 1.6, dmg: 70,  dmgPerLevel: 0.30, aoe: 4.5, speed: 30, info: 'Explosion de zone, enflamme le sol' },
    lightning: { name: 'Éclair en chaîne',  ico: '⚡', level: 2, mana: 26, cd: 3.5, dmg: 55,  dmgPerLevel: 0.30, chain: 6, jump: 9, info: 'Frappe jusqu\'à 6 zombies à la suite' },
    heal:      { name: 'Soin',              ico: '💚', level: 1, mana: 22, cd: 4.0, heal: 0.30, healPerLevel: 0.06, info: 'Rend 30 % des PV d\'une escouade (+6 %/niv.)' },
    mend:      { name: 'Rempart magique',   ico: '🧱', level: 2, mana: 30, cd: 6.0, hp: 260, hpPerLevel: 0.25, info: 'Referme une brèche ou consolide un tronçon' },
    meteor:    { name: 'Pluie de météores', ico: '☄', level: 3, mana: 60, cd: 22, dmg: 120, dmgPerLevel: 0.30, aoe: 6, count: 7, spread: 12, info: 'Ultime : 7 météores sur la plus grosse horde' },
    nova:      { name: 'Nova de givre',     ico: '❄', level: 4, mana: 35, cd: 12, dmg: 40, aoe: 9, slow: 0.4, slowTime: 4, info: 'Gèle et ralentit les zombies autour de lui' },
  },
};
// Feu au sol (boules de feu, catapultes) : dégâts par seconde aux zombies dans la zone
export const FIRE = { dps: 14, time: 4, catapultFire: true };
// Difficulté : multiplie le nombre de zombies et leurs PV
export const DIFFICULTY = { easy: { name: 'Facile', n: 0.75, hp: 0.85 }, normal: { name: 'Normal', n: 1, hp: 1 }, hard: { name: 'Difficile', n: 1.3, hp: 1.15 } };
// Réparation automatique : si personne ne répare et qu'un tronçon passe sous ce seuil, des villageois sont empruntés (puis rendus)
export const AUTO_REPAIR = { threshold: 0.7, crew: 2 };
export const BUILD = {
  minX: 5, maxX: 195, minZ: 212, towerMinZ: 154, maxZ: 312, gap: 1.2,
  refund: 0.8, moveWork: 6, workerExp: 0.85, maxWorkers: 4, upgradeTime: 0.7,
  maxTowers: 14, houseCost: n => ({ wood: 40 + 4 * n, stone: 8 + 2 * n }), towerUpCost: lv => ({ wood: 50 * lv, stone: 90 * lv }),
  blockers: [{ x: 100, z: 298, r: 24 }, { x: 162, z: 292, r: 6.5 }],
  oreR: 6.5, oreSnap: 16,      // gisements : seules les mines s'y posent (centrées dessus) ; aucun autre bâtiment ne peut les recouvrir
};
// Tours de défense : tirent seules ; les 6 tours de la muraille existent dès le départ.
export const TOWER = { range: 44, rangePerLevel: 3, dmg: 22, dmgPerLevel: 0.4, rate: 1.2, ratePerLevel: 0.1, wallXs: [3, 40, 80, 120, 160, 197], wallZ: 146 };
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
  tools:   { name: 'Outils',            ico: '🛠', req: 'university', max: 4, cost: { wood: 60, iron: 20 }, per: 0.20, info: 'Récolte +20 % par niveau' },
  carts:   { name: 'Chariots',          ico: '🛒', req: 'university', max: 3, cost: { wood: 80, iron: 25 }, per: 0.50, info: 'Charge portée +50 % par niveau' },
  boots:   { name: 'Chemins pavés',     ico: '👢', req: 'university', max: 3, cost: { stone: 70, wood: 40 }, per: 0.20, info: 'Vitesse de marche +20 % par niveau' },
  plow:    { name: 'Charrue',           ico: '🚜', req: 'university', max: 3, cost: { wood: 70, iron: 20 }, per: 0.25, info: 'Rendement des fermes +25 % par niveau' },
  masonry: { name: 'Maçonnerie',        ico: '🧱', req: 'university', max: 3, cost: { stone: 80, iron: 30 }, per: 0.30, info: 'Réparation +30 % vitesse, −10 % pierre par niveau' },
  apprentice: { name: 'Apprentissage', ico: '📐', req: 'university', max: 3, cost: { wood: 70, stone: 40, gold: 20 }, per: 0.25, info: 'Construction +25 % plus rapide par niveau' },
  // — Forge (onglet Armée) : anciennes améliorations globales, remplacées par SMITH (gardées pour les vieilles sauvegardes) —
  weapons: { name: 'Armes affûtées',    ico: '🗡', group: 'army', req: 'forge', max: 4, cost: { iron: 40, gold: 40 }, per: 0.10, info: 'Dégâts de toutes les unités +10 % par niveau' },
  blades:  { name: 'Lames d\'acier',    ico: '⚔', group: 'army', req: 'forge', max: 3, cost: { iron: 70, gold: 50 }, per: 0.15, info: 'Chevaliers : frappe +1 cible et +15 % de dégâts par niveau' },
  arcana:  { name: 'Arcanes',           ico: '📖', group: 'army', req: 'wizard', max: 3, cost: { gold: 90, food: 40 }, per: 0.20, info: 'Magicien : mana +20 % et récupération +20 % par niveau' },
  armor:   { name: 'Armures',           ico: '🦺', group: 'army', req: 'forge', max: 4, cost: { iron: 50, gold: 30 }, per: 0.08, info: 'Dégâts reçus par les escouades −8 % par niveau' },
  archery: { name: 'Arcs longs',        ico: '🏹', group: 'army', req: 'forge', max: 3, cost: { wood: 60, iron: 30, gold: 30 }, per: 0.10, info: 'Archers : dégâts +10 %, portée +3 m par niveau' },
};

export const PHASES = { prep: 'Préparation', alert: 'Alerte', assault: 'Assaut', calm: 'Accalmie' };
export const TIMING = { firstPrep: 60, prep: 30, alert: 10, calm: 15 };

// Composition d'une vague (indicatif, équilibrable sans toucher au moteur)
// Colosses : à partir de la vague 6, une chance sur deux d'en voir un (un de plus toutes les 6 vagues)
export const giantsFor = (v, r) => v >= 6 && r < 0.55 ? 1 + ((v - 6) / 6 | 0) : 0;
export const PACK = { base: 5, perWave: 1.6, jitter: 6, spread: 0.9 };
export function waveSpec(v) {
  const n = Math.round(30 * Math.pow(1.18, Math.min(v, 6) - 1) * Math.pow(1.1, Math.max(0, v - 6)));
  const frac = [0, 0, 0, 0, 0];
  frac[1] = v >= 2 ? Math.min(0.25, 0.05 * (v - 1)) : 0;
  frac[2] = v >= 3 ? Math.min(0.15, 0.04 * (v - 2)) : 0;
  frac[4] = v >= 4 ? Math.min(0.08, 0.03 * (v - 3)) : 0;
  frac[3] = v >= 5 ? Math.min(0.05, 0.02 * (v - 4)) : 0;
  frac[0] = 1 - frac[1] - frac[2] - frac[3] - frac[4];
  const sectors = 1 + Math.min(4, Math.floor(v / 3));
  return { n, frac, sectors, duration: Math.min(60, 20 + n / 14), reward: { gold: 30 + 10 * v, stone: 20 + 5 * v, iron: 10 + 3 * v } };
}
