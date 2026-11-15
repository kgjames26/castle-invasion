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
  // v4.0
  { id: 7, name: 'Seigneur pourri', hp: 7000, speed: 1.0, wall: 90, unit: 60, size: 3.6, color: 0x7a2a2a, boss: true },   // boss toutes les 10 vagues
  { id: 8, name: 'Grimpeur',    hp: 55,  speed: 2.8, wall: 1,  unit: 6,  size: 0.95, color: 0x9a8f6a },   // escalade la muraille
  { id: 9, name: 'Cracheur',    hp: 70,  speed: 2.0, wall: 14, unit: 4,  size: 1.0, color: 0x9fd84a },    // acide à distance sur la pierre
  { id: 10, name: 'Gonflé',     hp: 90,  speed: 1.5, wall: 2,  unit: 6,  size: 1.35, color: 0x6f8f3a },   // explose contre la muraille
  { id: 11, name: 'Chien',      hp: 22,  speed: 5.2, wall: 1,  unit: 7,  size: 0.7, color: 0x5a4a3a },    // meute rapide
];
// ——— Carte étendue (v2.0) : forêts vierges à gauche et à droite du village, à défricher parcelle par parcelle ———
export const FRONTIER = { left: [-200, 0], right: [200, 400], z0: 212, z1: 312, cell: 20, wood: 160, oreChance: 0.38, oreAmount: { stone: 4000, iron: 3000, gold: 2200 } };
// ——— Routes : chemins d'origine (réseau de base) ; Travaux publics = qualité de toutes les routes + routes tracées ———
export const ROADS_BASE = [[[[100, 150], [100, 200], [100, 284]], 9], [[[100, 238], [40, 255]], 5], [[[100, 238], [160, 255]], 5], [[[100, 262], [182, 243]], 4.5], [[[100, 262], [18, 238]], 4.5], [[[8, 205], [192, 205]], 4]];
export const ROADWORKS = { speed: [0, 0.15, 0.3, 0.45], names: ['Sentier', 'Terre battue', 'Gravier', 'Pavés'], costPerM: { wood: 0.6, stone: 0.8 }, buildSpeed: 3, maxLen: 160 };
// ——— Jour et nuit (v2.0) : un cycle complet dure `length` secondes ; la nuit réduit la portée des tireurs sans feux ———
export const DAY = { length: 600, start: 0.1, dusk: [0.82, 0.88], dawn: [0.95, 0.995] };   // (v4.0) la nuit ne dure qu'environ 1/10e du cycle
export const GATE_XS_LIST = [20, 100, 180];
// braseros : sur la muraille (2 par secteur), grands feux de bois dans la plaine (bûchers préparés entre les vagues), dans la cour et au village
export const BRAZIERS = [
  ...[0, 1, 2, 3, 4].flatMap(s => [{ x: s * 40 + 11, z: 146, zone: 'wall' }, { x: s * 40 + 29, z: 146, zone: 'wall' }]),
  ...[12, 37, 62, 86, 114, 138, 163, 188].map((x, i) => ({ x, z: i % 2 ? 122 : 108, zone: 'plain' })),
  { x: 30, z: 178, zone: 'court' }, { x: 100, z: 182, zone: 'court' }, { x: 170, z: 178, zone: 'court' },
  { x: 62, z: 248, zone: 'village' }, { x: 138, z: 248, zone: 'village' }, { x: 80, z: 276, zone: 'village' }, { x: 120, z: 276, zone: 'village' },
];
// allumeurs : un plein de bois dure `burn` s ; `wood` par ravitaillement ; les zombies à moins de `stomp` m éteignent le feu ; on fuit à `flee` m
//  feux de la plaine : entre deux vagues, l'équipe apporte du bois (`trip` par voyage) jusqu'à remplir un bûcher (`pile` bois), puis l'allume à l'approche
//  de la nuit (le bois est pris aux tas réservés aux feux, dans la cour près des portes) ; il brûle `plainBurn` s ; les zombies piétinent les bûchers (`trample` par zombie et par s) et éteignent les feux
export const FIRE_KEEP = { crew: 10, burn: 150, wood: 4, stoke: 1.6, stomp: 2.6, stompRate: 0.6, flee: 14, pile: 12, trip: 6, depots: [[28, 166], [108, 166], [188, 166]], stack: 2.2, light: 1.4, plainBurn: 260, plainStomp: 3.4, trample: 0.12 };
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
// Organisation des troupes (v2.8) : ESCOUADE 15 hommes · PELOTON 50 · ESCADRON 150. Moins de 15 hommes d'une catégorie : ils restent en réserve.
// On fusionne dès qu'il y a assez d'hommes de la même catégorie pour le grade au-dessus ; on sépare en groupes plus petits (le reste < 15 rentre en réserve).
export const GRADES = {
  escouade: { name: 'Escouade', plural: 'Escouades', size: 15, ico: '▪' },
  peloton:  { name: 'Peloton',  plural: 'Pelotons',  size: 50, ico: '▪▪' },
  escadron: { name: 'Escadron', plural: 'Escadrons', size: 150, ico: '▪▪▪' },
};
export const GRADE_ORDER = ['escouade', 'peloton', 'escadron'];
export const gradeFor = n => n <= 15 ? 'escouade' : n <= 50 ? 'peloton' : 'escadron';
export const SQUAD = { sortieZ: [58, 139], garrisonLeash: 16, intercept: 80, chargeRange: 28, aggro: 9, maxSquads: 40 };
// entraînement (v2.9) : grande file d'attente et plusieurs recrues formées EN MÊME TEMPS (parallel[niveau du bâtiment])
export const TRAIN = { baseQueue: 30, queuePerLevel: 20, speedPerLevel: 0.25, parallel: [0, 3, 5, 8] };
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
  wood: { name: 'Bois', ico: '<span class="ri ri-wood"></span>', color: 0x8b5a2b }, stone: { name: 'Pierre', ico: '<span class="ri ri-stone"></span>', color: 0x9aa0a6 },
  iron: { name: 'Fer', ico: '<span class="ri ri-iron"></span>', color: 0x5b6b8a }, food: { name: 'Nourriture', ico: '<span class="ri ri-food"></span>', color: 0xe6c84a },
  gold: { name: 'Or', ico: '<span class="ri ri-gold"></span>', color: 0xffd23f },
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
export const PROSPECT = { cost: { gold: 40, food: 30 }, time: 45, amount: [2200, 3800], maxPerRes: 4, res: ['stone', 'iron', 'gold'], zone: { x0: 12, x1: 188, z0: 218, z1: 292 }, clear: 16 };
// Tâches : chaque villageois sait quoi faire ; le joueur ne règle que les effectifs.
export const TASKS = {
  wood:   { name: 'Bûcherons',      ico: '<span class="ri ri-wood"></span>', res: 'wood',  building: 'sawmill', site: { x: 40,  z: 255 }, rate: 1.3,  deposit: 9000, regen: 3.2 },
  stone:  { name: 'Carriers',       ico: '<span class="ri ri-stone"></span>', res: 'stone', building: 'quarry',  site: { x: 160, z: 255 }, rate: 1.0,  deposit: 7000 },
  iron:   { name: 'Mineurs (fer)',  ico: '<span class="ri ri-iron"></span>', res: 'iron',  building: 'mine',    site: { x: 182, z: 236 }, rate: 0.9, deposit: 3500 },
  gold:   { name: 'Mineurs (or)',   ico: '<span class="ri ri-gold"></span>', res: 'gold',  building: 'mine',    site: { x: 18,  z: 236 }, rate: 0.8,  deposit: 2500 },
  food:   { name: 'Fermiers',       ico: '<span class="ri ri-food"></span>', res: 'food',  building: 'farm',    site: { x: 100, z: 252 }, rate: 1.15 },
  repair: { name: 'Réparation de la muraille', ico: '🔧', building: null, slots: 10 },
  clear:  { name: 'Défricheurs',    ico: '🪓', res: 'wood',  building: null, slots: 14, rate: 1.4, dyn: true, site: { x: 0, z: 262 } },   // abattent les forêts vierges (parcelles choisies)
  fire:   { name: 'Équipe des feux', ico: '🔥', building: null, slots: 12 },                                                         // allument et ravitaillent les braseros
};
// Bâtiments : niveau 0 = à construire. Coût du niveau N+1 = base × (N+1).
// Symbole dessiné de la caserne : écu rouge et deux épées croisées (l'emoji casque s'affichait mal selon les appareils)
export const BARRACKS_ICO = '<svg class="isvg" viewBox="0 0 32 32" aria-label="Caserne"><path d="M16 4 L27 8 V16 C27 22.5 22 27 16 29 C10 27 5 22.5 5 16 V8 Z" fill="#8a2f2f" stroke="#3a1a10" stroke-width="1.6"/><path d="M16 6.4 L25 9.6 V16 C25 21.2 21 25 16 26.8 Z" fill="#a84040"/><g stroke-linecap="round"><path d="M9.5 9.5 L22.5 22.5 M22.5 9.5 L9.5 22.5" stroke="#e8e8ee" stroke-width="2.4"/><path d="M9.5 9.5 L22.5 22.5 M22.5 9.5 L9.5 22.5" stroke="#9aa0ac" stroke-width="0.8"/><path d="M19.3 23.7 L23.7 19.3 M8.3 19.3 L12.7 23.7" stroke="#d9a63a" stroke-width="2.2"/></g><circle cx="23.6" cy="23.6" r="1.4" fill="#d9a63a"/><circle cx="8.4" cy="23.6" r="1.4" fill="#d9a63a"/></svg>';
// Symbole dessiné de la scierie : lame de scie circulaire sur une bille de bois
export const SAWMILL_ICO = '<svg class="isvg" viewBox="0 0 32 32" aria-label="Scierie"><rect x="4" y="21" width="24" height="7" rx="3.5" fill="#8a5a2b"/><ellipse cx="26.5" cy="24.5" rx="2.4" ry="3.4" fill="#c99a62"/><path d="M16 1.5l1.6 2.6 2.9-1.1 .8 3 3.1.1-.3 3.1 2.9 1.2-1.4 2.8 2.2 2.1-2.4 2-.1.2 1 3-3.1.5-.5 3.1-3-.8-1.4 2.8-2.3-2.1-2.3 2.1-1.4-2.8-3 .8-.5-3.1-3.1-.5 1-3-2.5-2.2 2.2-2.1-1.4-2.8 2.9-1.2-.3-3.1 3.1-.1.8-3 2.9 1.1z" fill="#c9ced6" stroke="#6a7080" stroke-width=".8"/><circle cx="16" cy="14" r="5.6" fill="#e8ecf0"/><circle cx="16" cy="14" r="2.2" fill="#d9a63a"/></svg>';
export const BUILDINGS = {   // group: 'eco' (onglet Village) ou 'army' (onglet Armée)
  sawmill:   { time: 25, base: 3, name: 'Scierie',   ico: SAWMILL_ICO, group: 'eco', start: 0, cost: { wood: 60 },             pos: { x: 40,  z: 262 }, size: [9, 5, 7],  color: 0x9b6a3a, info: 'Emplacements bûcherons · +15 % de rendement par niveau' },
  quarry:    { time: 25, base: 3, name: 'Carrière',  ico: '⛏', group: 'eco', start: 0, cost: { wood: 60 },             pos: { x: 160, z: 262 }, size: [9, 5, 7],  color: 0x8a8d92, info: 'Emplacements carriers · +15 % de rendement par niveau' },
  mine:      { time: 40, base: 0, name: 'Mine',      ico: '⛓', group: 'eco', start: 0, cost: { wood: 100, stone: 60 }, pos: { x: 182, z: 243 }, size: [8, 6, 8],  color: 0x4f5a72, info: 'Emplacements fer + or (partagés) · +15 %/niveau' },
  farm:      { time: 30, base: 3, name: 'Ferme',     ico: '🌾', group: 'eco', start: 0, cost: { wood: 70 },             pos: { x: 100, z: 244 }, size: [16, 1.2, 10], color: 0xc9b24a, max: 6, info: 'Emplacements fermiers · +15 % de rendement par niveau · s\'agrandit (champs, poulailler, verger, silo, pâture)' },
  mill:      { time: 30, base: 0, name: 'Moulin',    ico: '🌀', group: 'eco', start: 0, cost: { wood: 90, stone: 40 },  pos: { x: 128, z: 258 }, size: [6, 9, 6],  color: 0xcfc3a1, max: 5, info: 'Nourriture +20 % par niveau · s\'agrandit (fournil, socle de pierre, roue à aubes)' },
  granary:   { time: 28, base: 0, name: 'Grenier',   ico: '🏚', group: 'eco', start: 0, cost: { wood: 80, stone: 30 },  pos: { x: 66,  z: 270 }, size: [9, 6, 7],  color: 0xb08a4a, info: 'Stock de nourriture +400 par niveau' },
  warehouse: { time: 32, base: 0, name: 'Entrepôt',  ico: '📦', group: 'eco', start: 0, cost: { wood: 80, stone: 40 },  pos: { x: 134, z: 272 }, size: [10, 6, 8], color: 0x7a6a55, info: 'Stock bois/pierre/fer/or +400 par niveau' },
};
// Bâtiments militaires (onglet Armée) : le niveau accélère l'entraînement (+25 %/niveau) et agrandit la file.
export const ARMY_BUILDINGS = {
  barracks: { time: 45, base: 0, name: 'Caserne',      ico: BARRACKS_ICO, group: 'army', start: 0, cost: { wood: 100, stone: 50 }, max: 5, pos: { x: 36,  z: 224 }, size: [16, 5, 11], color: 0x8a4545, info: 'Fantassins · Lourds dès le niveau 2 · Chevaliers dès le niveau 3' },
  stable:   { time: 45, base: 0, name: 'Écurie',       ico: '🐎', group: 'army', start: 0, cost: { wood: 120, stone: 40 }, max: 5, pos: { x: 164, z: 224 }, size: [16, 5, 11], color: 0x7a5a3a, info: 'Cavaliers' },
  range:    { time: 35, base: 0, name: 'Champ de tir', ico: '🎯', group: 'army', start: 0, cost: { wood: 90, stone: 30 },  max: 5, pos: { x: 100, z: 224 }, size: [18, 3, 9],  color: 0x4a6f4a, info: 'Archers' },
  forge:    { time: 50, base: 0, name: 'Forge',        ico: '🔨', group: 'army', start: 0, max: 3, cost: { wood: 80, stone: 80, iron: 40 }, pos: { x: 66, z: 236 }, size: [10, 6, 8], color: 0x5a4f58, info: 'Attaque et défense de chaque type d\'unité, indépendamment de son rang · niveau = plafond (2/4/6)' },
  publicworks: { time: 45, base: 0, name: 'Travaux publics', ico: '🛤', group: 'eco', start: 0, max: 3, cost: { wood: 100, stone: 80 }, pos: { x: 150, z: 300 }, size: [12, 6, 9], color: 0x8a7a5a, info: 'Trace des routes et améliore TOUTES les routes : terre battue → gravier → pavés (villageois plus rapides)' },
  infirmary: { time: 40, base: 0, name: 'Infirmerie',  ico: '🏥', group: 'army', start: 0, max: 3, cost: { wood: 90, stone: 60, food: 60 }, pos: { x: 140, z: 290 }, size: [12, 6, 9], color: 0xe8e2d6, info: 'Soigne les escouades au repos · sauve une partie des blessés graves' },
  university: { time: 60, base: 0, name: 'Université', ico: '🎓', group: 'eco', start: 0, max: 3, cost: { wood: 140, stone: 120, gold: 40 }, pos: { x: 60, z: 286 }, size: [14, 9, 10], color: 0xb8a88a, info: 'Améliore les villageois · niveau = plafond des améliorations (2/3/4)' },
};
// Maison du sorcier : invoque UN magicien autonome (il choisit seul de soigner ou d'attaquer). Le niveau du bâtiment = niveau du magicien.
ARMY_BUILDINGS.wizard = { time: 60, base: 0, name: 'Maison du sorcier', ico: '🔮', group: 'army', start: 0, max: 5, cost: { wood: 120, stone: 140, gold: 80 }, pos: { x: 100, z: 280 }, size: [10, 14, 10], color: 0x5a4a8a, info: 'Invoque un magicien autonome · chaque niveau le rend plus puissant' };
ARMY_BUILDINGS.workshop = { time: 55, base: 0, name: 'Atelier de siège', ico: '🛠', group: 'army', start: 0, max: 3, cost: { wood: 140, stone: 100, iron: 30 }, pos: { x: 136, z: 236 }, size: [14, 6, 10], color: 0x6a5a45, info: '2 armes déployables par niveau · Niv.1 baliste · Niv.2 catapulte · Niv.3 trébuchet' };
// Église (v2.3) : pas d'église au départ. Une fois bâtie, un PRÊTRE s'installe au village ; le niveau de l'église lui donne ses pouvoirs.
ARMY_BUILDINGS.church = { time: 55, base: 0, name: 'Église', ico: '⛪', group: 'eco', start: 0, max: 3, cost: { wood: 120, stone: 140, gold: 30 }, pos: { x: 30, z: 298 }, size: [11, 13, 10], color: 0xd8d0c0, info: 'Un prêtre s\'installe au village · niv. 1 Bénédiction et familles · niv. 2 Exorcisme · niv. 3 Sanctuaire' };
//  bless : bonus de dégâts des archers et des tours du secteur où il prie · pop : places de population par niveau (familles qui s'installent)
//  exo : exorcisme (lumière sacrée sur les zombies près de lui) · sanct : sanctuaire (zombies ralentis autour de lui, escouades soignées)
export const PRIEST = {
  speed: 5, bless: 0.15, blessPerLevel: 0.05, pop: 8,
  exo: { level: 2, cd: 8, reach: 30, r: 6.5, dmg: 70, dmgPerLevel: 0.35, golem: 1.5 },
  sanct: { level: 3, r: 11, heal: 0.012 },
  powers: [
    { level: 1, ico: '🙏', name: 'Bénédiction', info: 'Pendant l\'assaut, il prie derrière le secteur le plus menacé : archers et tours y font +15 % de dégâts (+5 %/niveau)' },
    { level: 1, ico: '👪', name: 'Familles', info: '+8 places de population par niveau de l\'église' },
    { level: 2, ico: '✨', name: 'Exorcisme', info: 'Toutes les 8 s, une lumière sacrée frappe les zombies proches (dégâts de zone, +50 % contre les golems)' },
    { level: 3, ico: '🕊', name: 'Sanctuaire', info: 'Les zombies proches de lui sont ralentis et les escouades autour de lui reprennent des forces' },
  ],
};
// Zone de quarantaine (v2.4, fixe depuis v2.8) : enclos grillagé tout à gauche de la placette (là où attend la réserve). Les combattants MORDUS
// y sont isolés en attendant le prêtre ; s'ils se transforment derrière le grillage, les gardes les abattent. Présente dès le début ; améliorable.
ARMY_BUILDINGS.prison = { time: 40, base: 0, name: 'Zone de quarantaine', ico: '🚧', group: 'army', start: 1, max: 3, cost: { wood: 80, stone: 110, iron: 20 }, pos: { x: 13, z: 199 }, size: [16, 3, 12], color: 0x6a6660, info: 'Enclos grillagé où l\'on isole les combattants mordus (4 places par niveau) · chaque niveau retarde la transformation de 30 %' };
export const QUARANTINE = { x: 13, z: 199 };
// Morsures (v2.4) : un combattant blessé par un zombie mordeur peut être MORDU au lieu de mourir. Mordu, il tombe (vulnérable : les zombies
// proches se ruent pour le dévorer), se relève et doit rejoindre la zone de quarantaine. Le prêtre seul peut le guérir ; sinon il se transforme en zombie.
//  bite : part des pertes changées en morsures · turn : secondes avant transformation · tackle : part des morsures où le zombie plonge et fait tomber
//  frenzy : rayon d'attraction d'un mordu à terre · devour : zombies au contact pour le dévorer (guard : vitesse si son escouade est à côté) · blood : un escouade blessée attire de plus loin (×)
//  surprise : chance qu'un mordu transformé morde un voisin avant que l'escouade réagisse · cells : places par niveau de la quarantaine
//  biters : types de zombies qui mordent ; killers : types qui tuent sans mordre ; tearers : géants qui déchirent leur proie et boivent son sang
export const INFECTION = { bite: 0.4, turn: 45, tackle: 0.4, down: 3.2, frenzy: 16, devour: 3, devourTime: 3.5, guard: 0.25, blood: 1.7, surprise: 0.5, cells: 4, prisonSlow: 0.3, heal: 4, biters: [0, 1, 2, 4], killers: [3, 6, 7], tearers: [5] };
Object.assign(BUILDINGS, ARMY_BUILDINGS);
// ——— Phase 6 : construction libre ———
// Structures multiples (placées où l'on veut) : maisons et tours de défense. Les autres bâtiments existent en un seul exemplaire (niveaux).
export const MULTI = {
  house: { name: 'Maison', ico: '🏠', group: 'eco', time: 16, max: 4, size: [6, 4.6, 6], info: `+15 places (niv. 1) · 37 (niv. 2) · 67 (niv. 3) · 105 (niv. 4)` },
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
// Ruisseau (v4.2) : s'échappe des douves du château vers l'est en serpentant (tracé fixe ; on ne bâtit pas dessus)
export const STREAM = Array.from({ length: 34 }, (_, k) => { const x = 129 + k * 3; return [x, 297 + 6 * Math.sin((x - 128) / 14) + 2 * Math.sin((x - 128) / 5.3)]; });
export const BUILD = {
  minX: 5, maxX: 195, minZ: 212, towerMinZ: 154, maxZ: 312, gap: 1.2,
  speed: 2.6,   // chantiers ~2,6× plus rapides (v3.1)
  refund: 0.8, moveWork: 6, workerExp: 0.85, maxWorkers: 4, upgradeTime: 0.7,
  houseUnits: [0, 1, 2.5, 4.5, 7], houseUpCost: lv => ({ wood: 60 + 70 * lv, stone: 30 + 60 * lv, ...(lv >= 2 ? { gold: 25 * lv } : {}) }),
  maxTowers: 14, houseCost: n => ({ wood: 40 + 4 * n, stone: 8 + 2 * n }), towerUpCost: lv => ({ wood: 50 * lv, stone: 90 * lv }),
  blockers: [...STREAM.filter((_, k) => k % 2 === 0).map(([x, z]) => ({ x, z, r: 3.2 })), { x: 100, z: 298, r: 30 }, { x: 75, z: 276, r: 4 }, { x: 125, z: 276, r: 4 }, { x: 75, z: 318, r: 4 }, { x: 125, z: 318, r: 4 }, { x: 162, z: 292, r: 6.5 }],
  oreR: 6.5, oreSnap: 16,      // gisements : seules les mines s'y posent (centrées dessus) ; aucun autre bâtiment ne peut les recouvrir
};
// Tours de défense : tirent seules ; les 6 tours de la muraille existent dès le départ.
export const TOWER = { range: 44, rangePerLevel: 3, dmg: 22, dmgPerLevel: 0.4, rate: 1.2, ratePerLevel: 0.1, wallXs: [3, 40, 80, 120, 160, 197], wallZ: 146 };
// Armes de siège (reprises de l'ancien jeu) : fixes, derrière la muraille. Munitions prélevées dans les stocks.
// range/minRange en mètres depuis l'arme ; aoe = rayon d'impact ; speed = m/s du projectile ; crew = places de population.
export const SIEGE = {
  cannon:    { name: 'Canon',     ico: '💣', range: 90, minRange: 10, dmg: 260, aoe: 5.5, reload: 7.0, speed: 70, ammo: { iron: 3, gold: 1 }, cost: { wood: 150, iron: 220, gold: 120 }, time: 45, level: 3, crew: 3, color: 0x3a3c42, size: 1.4, tech: 'powder', info: 'Poudre noire : 260 dégâts de zone, portée 90 m' },
  ballista:  { name: 'Baliste',   ico: '🎯', range: 46, minRange: 4,  dmg: 85,  aoe: 2.2, reload: 3.0, speed: 55, ammo: { iron: 1 },  cost: { wood: 80, iron: 30 },                       time: 18, level: 1, crew: 2, color: 0x8a6a3a, size: 1.0, info: 'Tir tendu, 85 dégâts : excellente contre les gros zombies' },
  catapult:  { name: 'Catapulte', ico: '☄', range: 60, minRange: 14, dmg: 60,  aoe: 4.5, reload: 5.0, speed: 26, ammo: { stone: 2 }, cost: { wood: 120, stone: 60, iron: 20 },          time: 25, level: 2, crew: 2, color: 0x7a5a30, size: 1.3, info: 'Tir en cloche, dégâts de zone 4,5 m' },
  trebuchet: { name: 'Trébuchet', ico: '🏰', range: 82, minRange: 24, dmg: 150, aoe: 6.5, reload: 9.0, speed: 32, ammo: { stone: 5 }, cost: { wood: 200, stone: 120, iron: 60, gold: 50 }, time: 40, level: 3, crew: 3, color: 0x5a4020, size: 1.7, info: 'Portée immense, 150 dégâts de zone 6,5 m, rechargement lent' },
};
export const SIEGE_ORDER = ['ballista', 'catapult', 'trebuchet', 'cannon'];
export const SIEGE_RULES = { perLevel: 2, slotsPerSector: 3, queueMax: 4, speedPerLevel: 0.25, refund: 0.5 };
// Améliorations : effets mesurables, coût du niveau N+1 = base × (N+1).
export const UPGRADES = {
  tools:   { name: 'Outils',            ico: '🛠', req: 'university', max: 4, cost: { wood: 60, iron: 20 }, per: 0.20, info: 'Récolte +20 % par niveau' },
  carts:   { name: 'Chariots',          ico: '🛒', req: 'university', max: 3, cost: { wood: 80, iron: 25 }, per: 0.50, info: 'Charge portée +50 % par niveau' },
  boots:   { name: 'Chemins pavés',     ico: '👢', hidden: true, req: 'university', max: 3, cost: { stone: 70, wood: 40 }, per: 0.20, info: 'Vitesse de marche +20 % par niveau' },
  plow:    { name: 'Charrue',           ico: '🚜', req: 'university', max: 3, cost: { wood: 70, iron: 20 }, per: 0.25, info: 'Rendement des fermes +25 % par niveau' },
  masonry: { name: 'Maçonnerie',        ico: '🧱', req: 'university', max: 3, cost: { stone: 80, iron: 30 }, per: 0.30, info: 'Réparation +30 % vitesse, −10 % pierre par niveau' },
  fireArrows: { name: 'Flèches enflammées', ico: '🔥', group: 'army', req: 'forge', minLevel: 2, max: 3, cost: { wood: 60, iron: 30, gold: 40 }, per: 0.12, info: 'Archers : 12 % des flèches par niveau enflamment le sol à l\'impact (forge niv. 2)' },
  firecraft: { name: 'Savoir-faire des allumeurs', ico: '🔥', req: 'university', max: 3, cost: { wood: 60, gold: 15 }, per: 0.25, info: 'Équipe des feux : +25 % de vitesse (marche, empilage, allumage), feux de plaine +25 % plus longs et −15 % de bois par niveau' },
  apprentice: { name: 'Apprentissage', ico: '📐', req: 'university', max: 3, cost: { wood: 70, stone: 40, gold: 20 }, per: 0.25, info: 'Construction +25 % plus rapide par niveau' },
  // — Forge (onglet Armée) : anciennes améliorations globales, remplacées par SMITH (gardées pour les vieilles sauvegardes) —
  weapons: { name: 'Armes affûtées',    ico: '🗡', group: 'army', req: 'forge', max: 4, cost: { iron: 40, gold: 40 }, per: 0.10, info: 'Dégâts de toutes les unités +10 % par niveau' },
  blades:  { name: 'Lames d\'acier',    ico: '⚔', group: 'army', req: 'forge', max: 3, cost: { iron: 70, gold: 50 }, per: 0.15, info: 'Chevaliers : frappe +1 cible et +15 % de dégâts par niveau' },
  arcana:  { name: 'Arcanes',           ico: '📖', group: 'army', req: 'wizard', max: 3, cost: { gold: 90, food: 40 }, per: 0.20, info: 'Magicien : mana +20 % et récupération +20 % par niveau' },
  armor:   { name: 'Armures',           ico: '🦺', group: 'army', req: 'forge', max: 4, cost: { iron: 50, gold: 30 }, per: 0.08, info: 'Dégâts reçus par les escouades −8 % par niveau' },
  archery: { name: 'Arcs longs',        ico: '🏹', group: 'army', req: 'forge', max: 3, cost: { wood: 60, iron: 30, gold: 30 }, per: 0.10, info: 'Archers : dégâts +10 %, portée +3 m par niveau' },
};

export const PHASES = { prep: 'Temps calme', alert: 'Alerte', assault: 'Vague en cours', calm: 'Accalmie' };
// deux moments (v2.9) : le TEMPS CALME (préparation + accalmie) pour construire et s'organiser, plus long ; la VAGUE (alerte + assaut), chantiers en pause
export const TIMING = { firstPrep: 300, prep: 170, alert: 12, calm: 15 };   // v3.1 : hordes nettement plus tardives
// zombies : ils traînent loin de la muraille, puis se ruent dessus d'un coup (approach : distance à la muraille où ils accélèrent)
export const ZOMBIE_PACE = { farMin: 0.42, farMax: 0.75, rushMin: 1.3, rushMax: 2.3, minD: 12, maxD: 105 };

// Composition d'une vague (indicatif, équilibrable sans toucher au moteur)
// Colosses : à partir de la vague 6, une chance sur deux d'en voir un (un de plus toutes les 6 vagues)
export const giantsFor = (v, r) => v >= 6 && r < 0.55 ? 1 + ((v - 6) / 6 | 0) : 0;
export const PACK = { base: 5, perWave: 1.6, jitter: 6, spread: 0.9 };
// ——— v4.0 : systèmes additionnels ———
export const EXTRA = {
  seasonWaves: 3,
  seasons: [ { name: 'Printemps', ico: '🌸', food: 1.1 }, { name: 'Été', ico: '☀', food: 1.25 }, { name: 'Automne', ico: '🍂', food: 1.0 }, { name: 'Hiver', ico: '❄', food: 0.45 } ],
  winterWood: 0.004,                                                     // bois de chauffage par habitant et par seconde en hiver
  moraleWin: 8, moraleLoss: 0.35, medalWaves: 10,
  festival: { cost: { food: 150, gold: 50 }, gain: 25 },
  traps: { spikes: { name: 'Fosse à pieux', ico: '🪤', r: 2.2, dmg: 90, uses: 14, cost: { wood: 40 } },
           caltrops: { name: 'Chausse-trappes', ico: '✳', r: 3.2, slow: 0.45, uses: 1e9, cost: { iron: 15 } },
           pitch: { name: 'Baril de poix', ico: '🛢', r: 3.0, aoe: 6, dmg: 70, uses: 1, cost: { wood: 30, gold: 10 } } },
  trapZ: [92, 140], maxTraps: 40,
  oil: { cost: { wood: 25 }, cd: 40, dmg: 140 },
  moat: { far: 9, near: 3, slow: [1, 0.6, 0.42, 0.42], dps: 8, cost: [null, { wood: 60, stone: 30 }, { stone: 80 }, { wood: 120, iron: 20 }], time: [0, 30, 25, 25], names: ['', 'Fossé', 'Douves en eau', 'Douves à pieux'] },
  palisade: { dist: 26, hp: 900, cost: { wood: 160 }, repair: { wood: 70 }, time: 20, fire: 25, fireDps: 30 },   // fire : durée du brasier (s) ; fireDps : brûlure au contact
  hero: { cost: { gold: 150, food: 60 }, rallyTime: 15, rallyCd: 60, xp: [0, 60, 160, 320, 560] },
  tech: { alchemy: { name: 'Alchimie', ico: '⚗', info: 'Flèches enflammées : archers +20 % de dégâts', uni: 1, cost: { gold: 150, food: 100 }, time: 60 },
          engineering: { name: 'Ingénierie', ico: '📐', info: 'Murailles +25 % de PV', uni: 2, cost: { gold: 220, stone: 300 }, time: 90 },
          powder: { name: 'Poudre noire', ico: '💥', info: 'Débloque le canon à l\'atelier de siège', uni: 3, cost: { gold: 400, iron: 200 }, time: 120 } },
  eventChance: 0.55, caravanEvery: 3, refugeeBite: 0.2, fire: { time: 45 },
  merchant: [ [{ give: { wood: 150 }, get: { gold: 60 } }, { give: { food: 120 }, get: { iron: 50 } }],
              [{ give: { stone: 150 }, get: { gold: 55 } }, { give: { gold: 40 }, get: { food: 160 } }],
              [{ give: { iron: 60 }, get: { gold: 70 } }, { give: { gold: 50 }, get: { wood: 200 } }] ],
  caravan: [ { give: { gold: 120 }, units: { soldier: 6 } }, { give: { gold: 110 }, units: { archer: 6 } }, { give: { wood: 200 }, get: { stone: 160 } } ],
  bossEvery: 10, bossReward: { gold: 400, iron: 200, stone: 200 },
};
export function waveSpec(v) {
  const n = Math.round(30 * Math.pow(1.18, Math.min(v, 6) - 1) * Math.pow(1.1, Math.max(0, v - 6)));
  const frac = [0, 0, 0, 0, 0];
  frac[1] = v >= 2 ? Math.min(0.25, 0.05 * (v - 1)) : 0;
  frac[2] = v >= 3 ? Math.min(0.15, 0.04 * (v - 2)) : 0;
  frac[4] = v >= 4 ? Math.min(0.08, 0.03 * (v - 3)) : 0;
  frac[3] = v >= 5 ? Math.min(0.05, 0.02 * (v - 4)) : 0;
  frac[0] = 1 - frac[1] - frac[2] - frac[3] - frac[4];
  const sectors = 1 + Math.min(4, Math.floor(v / 3));
  // (v4.0) nouveaux types : chiens dès la vague 4, cracheurs dès 6, gonflés dès 7, grimpeurs dès 8 (indices 8 à 11)
  const extra = { 11: v >= 4 ? Math.min(0.12, 0.03 * (v - 3)) : 0, 9: v >= 6 ? Math.min(0.06, 0.015 * (v - 5)) : 0, 10: v >= 7 ? Math.min(0.05, 0.012 * (v - 6)) : 0, 8: v >= 8 ? Math.min(0.06, 0.015 * (v - 7)) : 0 };
  return { n, frac, extra, sectors, boss: v % EXTRA.bossEvery === 0 ? 1 : 0, duration: Math.min(60, 20 + n / 14), reward: { gold: 30 + 10 * v, stone: 20 + 5 * v, iron: 10 + 3 * v } };
}
