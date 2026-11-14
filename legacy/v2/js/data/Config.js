// Castle Invasion — données d'équilibrage (unités, ennemis, siège, bâtiments, technologies, vagues)

export const VERSION = '1.0.0';

// Carte rectangulaire. Z : nord = négatif (haut de l'écran), muraille en z = 0.
// Du sud au nord : base (3/5 de la hauteur) → muraille → zone de déploiement (1/10) → plaine (1/10) → brouillard (1/5).
// Portrait : carte étroite (9 segments de muraille) · Paysage : carte large (17 segments).
export const MAP = {
  CELL: 2.5,
  WALL_Z: 0,
  WALL_HALF_THICK: 2.1,
  WALL_HEIGHT: 4.3,
  SEG_LEN: 8,
  H: 140,
  CASTLE_SCALE: 1.0,
  orient: 'landscape',
  // renseignés par configure()
  W: 136, HALF: 68, SEG_COUNT: 17, GATE_SEG: 8,
  minX: -68, maxX: 68, minZ: -56, maxZ: 84,
  GX: 56, GZ: 56,
  STAGE_Z: -14, PLAIN_Z: -28, FOG_END_Z: -56,
  CASTLE_POS: { x: 0, z: 68 }, CASTLE_DOOR: { x: 0, z: 49 },
  SPAWNS: [],
  configure(orient) {
    const M = MAP;
    M.orient = orient === 'portrait' ? 'portrait' : 'landscape';
    M.SEG_COUNT = M.orient === 'portrait' ? 9 : 17;
    M.GATE_SEG = (M.SEG_COUNT - 1) / 2;
    M.W = M.SEG_COUNT * M.SEG_LEN;
    M.HALF = M.W / 2;
    const south = M.H * 0.6, north = M.H * 0.4;
    M.minX = -M.HALF; M.maxX = M.HALF; M.minZ = -north; M.maxZ = south;
    M.STAGE_Z = -M.H * 0.1; M.PLAIN_Z = -M.H * 0.2; M.FOG_END_Z = -north;
    M.GX = Math.round(M.W / M.CELL); M.GZ = Math.round(M.H / M.CELL);
    // la grille couvre [minX-…] : on garde un léger débord pour l'alignement
    M.CASTLE_POS = { x: 0, z: south - 16 };
    M.CASTLE_DOOR = { x: 0, z: south - 16 - 18.5 };
    const sx = M.HALF * 0.62;
    M.SPAWNS = M.orient === 'portrait'
      ? [{ x: -sx * 0.9, z: -(north - 4) }, { x: 0, z: -(north - 3) }, { x: sx * 0.9, z: -(north - 4) }]
      : [{ x: -sx, z: -(north - 4) }, { x: 0, z: -(north - 3) }, { x: sx, z: -(north - 4) }];
    return M;
  },
};
MAP.configure('landscape');

export const RESOURCES = ['stone', 'wood', 'gold', 'metal', 'diamond'];   // ressources récoltées sur la carte
export const ALL_RES = [...RESOURCES, 'food'];                              // + nourriture (fermes du village)
export const RES_INFO = {
  stone:   { name: 'Pierre',  icon: '🪨', color: '#9aa0a6' },
  wood:    { name: 'Bois',    icon: '🪵', color: '#a0703c' },
  gold:    { name: 'Or',      icon: '🪙', color: '#f2c94c' },
  metal:   { name: 'Métal',   icon: '⛓️', color: '#7f97a8' },
  diamond: { name: 'Diamant', icon: '💎', color: '#56ccf2' },
  food:    { name: 'Nourriture', icon: '🌾', color: '#d8b24a' },
};

export const START = {
  res: { stone: 260, wood: 260, gold: 160, metal: 50, diamond: 0, food: 220 },
  workers: 2,
  units: [['cultivator', 4], ['soldier', 4], ['archer', 4]],
};

// Vitesse de récolte (unités/s) et valeur relative pour l'auto-affectation
export const HARVEST = {
  stone:   { rate: 1.0, value: 1.0, amount: 260 },
  wood:    { rate: 1.25, value: 1.0, amount: 140 },
  gold:    { rate: 0.6, value: 2.2, amount: 200 },
  metal:   { rate: 0.5, value: 2.6, amount: 200 },
  diamond: { rate: 0.18, value: 8, amount: 70 },
  food:    { rate: 0, value: 0.8, amount: 0 },   // non récoltée sur la carte : valeur d'échange seulement
};
export const CARRY_BASE = 10;

// ---------- Unités du joueur ----------
export const UNITS = {
  cultivator: { name: 'Cultivateur', icon: '🧑‍🌾', hp: 50, speed: 3.6, radius: 0.45, cost: { wood: 25, gold: 5 }, time: 8, pop: 1, building: 'quarters',
    desc: 'Récolte les gisements et rapporte les ressources au château ou à un centre de récolte.' },
  worker: { name: 'Villageois', icon: '👷', hp: 1, speed: 0, radius: 0, cost: { stone: 20, wood: 20, gold: 10 }, time: 10, pop: 1, building: 'quarters',
    desc: 'Habitant du village. À affecter aux fermes, scieries, carrières et mines ; accélère aussi la production (+6 %) et répare la muraille entre les vagues.' },
  soldier: { name: 'Soldat', icon: '🗡️', hp: 130, dmg: 14, range: 1.5, cd: 1.0, speed: 3.4, radius: 0.5, aggro: 9, cost: { wood: 10, metal: 10, gold: 15 }, time: 12, pop: 1, building: 'barracks',
    desc: 'Fantassin à l\'épée et au bouclier. Solide en ligne.' },
  archer: { name: 'Archer', icon: '🏹', hp: 75, dmg: 12, range: 20, cd: 1.4, speed: 3.4, radius: 0.45, aggro: 22, ranged: true, scale: 0.92, cost: { wood: 30, gold: 15 }, time: 12, pop: 1, building: 'range',
    desc: 'Tir à distance. Placé sur la muraille, il gagne +30 % de portée.' },
  cavalry: { name: 'Cavalier', icon: '🐎', hp: 240, dmg: 22, range: 1.9, cd: 1.1, speed: 7, radius: 0.85, aggro: 12, charge: true, cost: { wood: 10, metal: 25, gold: 40 }, time: 20, pop: 2, building: 'stable',
    desc: 'Rapide et puissant à la charge (dégâts ×2 au premier impact).' },
};

// ---------- Ennemis ----------
// size = taille relative (1 = humain moyen). Plus un zombie est grand, plus il est puissant et résistant ;
// plus il est petit, plus il est rapide et fragile. Chaque apparition varie un peu (voir sizeStats).
// variants : modèles animés (0 femme A, 1 femme B, 2 coureur, 3/4/5 marcheurs bras tendus).
export const ENEMIES = {
  classic:   { name: 'Zombie',          size: 1.0,  variants: [3, 4, 5, 0, 1], hp: 60,  dmg: 8,  range: 1.3, cd: 1.2, speed: 2.1, radius: 0.5, aggro: 8,  wallMul: 0.6, gold: 1 },
  fast:      { name: 'Zombie rapide',   size: 0.75, variants: [2],             hp: 40,  dmg: 6,  range: 1.3, cd: 0.8, speed: 4.3, radius: 0.42, aggro: 10, wallMul: 0.5, gold: 1 },
  dog:       { name: 'Zombie rampant',  size: 0.55, variants: [2],             hp: 32,  dmg: 7,  range: 1.1, cd: 0.7, speed: 5.6, radius: 0.36, aggro: 16, wallMul: 0.4, gold: 1 },
  golem:     { name: 'Colosse',         size: 2.1,  variants: [4, 3],          hp: 520, dmg: 34, range: 2.4, cd: 2.0, speed: 1.4, radius: 1.1, aggro: 7,  wallMul: 2,   gold: 8 },
  jumper:    { name: 'Sauteur',         size: 0.9,  variants: [1, 0],          hp: 70,  dmg: 10, range: 1.3, cd: 1.0, speed: 3.0, radius: 0.45, aggro: 9,  wallMul: 1.5, gold: 2, jumps: true },
  golem_ram: { name: 'Colosse bélier',  size: 2.5,  variants: [5],             hp: 700, dmg: 30, range: 2.6, cd: 2.4, speed: 1.15, radius: 1.3, aggro: 0, wallMul: 7,   gold: 12, siege: true, ram: true },
  thrower:   { name: 'Lanceur de rochers', size: 1.2, variants: [0],           hp: 85,  dmg: 26, range: 26, cd: 4.0, speed: 1.8, radius: 0.55, aggro: 26, wallMul: 1.2, gold: 4, ranged: true, aoe: 2.6, siege: true },
};
// Statistiques d'un zombie d'une taille donnée (j = facteur de taille par rapport à son type)
export function sizeStats(def, j) {
  return { hp: Math.pow(j, 2.3), dmg: Math.pow(j, 1.6), speed: Math.pow(j, -0.7), radius: j, cd: Math.pow(j, 0.4), gold: Math.pow(j, 1.5) };
}

// ---------- Armes de siège ----------
export const SIEGE = {
  ballista:  { name: 'Baliste',   icon: '🎯', hp: 260, range: 34, minRange: 3,  dmg: 85,  aoe: 0, reload: 3.0, ammo: { metal: 1 }, ammoAlt: null, proj: 'bolt', speed: 45,
               cost: { wood: 80, metal: 30 }, time: 18, level: 1, zone: 'back', desc: 'Tir précis et tendu. Excellente contre les golems.' },
  catapult:  { name: 'Catapulte', icon: '☄️', hp: 320, range: 44, minRange: 10, dmg: 60,  aoe: 4,  reload: 5.0, ammo: { stone: 2 }, ammoAlt: { metal: 2 }, proj: 'boulder', speed: 24,
               cost: { wood: 120, stone: 60, metal: 20 }, time: 25, level: 2, zone: 'back', desc: 'Tir parabolique par-dessus la muraille, dégâts de zone.' },
  trebuchet: { name: 'Trébuchet', icon: '🏰', hp: 420, range: 72, minRange: 20, dmg: 150, aoe: 6,  reload: 10,  ammo: { stone: 5 }, ammoAlt: { metal: 4 }, proj: 'boulder', speed: 30,
               cost: { wood: 200, stone: 120, metal: 60, gold: 50 }, time: 40, level: 3, zone: 'back', desc: 'Portée immense, dégâts énormes, rechargement lent.' },
  ram:       { name: 'Bélier',    icon: '🪓', hp: 650, range: 2.8, minRange: 0, dmg: 260, aoe: 0, reload: 2.5, ammo: null, ammoAlt: null, proj: null, speed: 2.2,
               cost: { wood: 150, metal: 50 }, time: 30, level: 2, zone: 'front', mobile: true, desc: 'Unité mobile. Charge et détruit les nids de zombies au nord.' },
};

// ---------- Bâtiments souterrains ----------
// cost(level) = coût pour passer au niveau `level`
const scale = (base, l) => Object.fromEntries(Object.entries(base).map(([k, v]) => [k, Math.round(v * Math.pow(1.7, l - 1))]));
export const BUILDINGS = {
  quarters: { name: 'Maisons', icon: '🏘️', max: 5, start: 1, base: { stone: 120, wood: 120 }, time: 20,
    desc: 'Logent les villageois : forme cultivateurs et villageois. Chaque niveau : +6 population civile.' },
  barracks: { name: 'Caserne', icon: '⚔️', max: 5, start: 1, base: { stone: 150, wood: 100, metal: 20 }, time: 25,
    desc: 'Soldats et archers. Niv.1 : Ligne, Colonne. Niv.2 : Double ligne. Chaque niveau : +8 % dégâts.' },
  range: { name: 'Champ de tir', icon: '🏹', max: 4, start: 1, base: { wood: 140, stone: 70, gold: 30 }, time: 25,
    desc: 'Entraîne les archers. Chaque niveau : +6 logements militaires et entraînement plus rapide.' },
  stable: { name: 'Écurie', icon: '🐎', max: 4, start: 0, base: { wood: 180, stone: 80, gold: 60 }, time: 30,
    desc: 'Cavalerie. Débloque les formations de charge : Coin, Cavalerie en coin.' },
  workshop: { name: 'Atelier de siège', icon: '🛠️', max: 4, start: 0, base: { wood: 160, stone: 120, metal: 30 }, time: 30,
    desc: 'Niv.1 Baliste · Niv.2 Catapulte, Bélier · Niv.3 Trébuchet. 2 armes déployées par niveau.' },
  lab: { name: 'Académie militaire', icon: '⚗️', max: 3, start: 0, base: { stone: 150, gold: 80, metal: 40 }, time: 35,
    desc: 'Recherches et compétences : formations avancées, récolte, maçonnerie, siège.' },
  depot: { name: 'Dépôt militaire', icon: '📦', max: 4, start: 0, base: { stone: 120, wood: 100 }, time: 22,
    desc: 'Stocke équipements et réserves. Chaque niveau : +10 logements militaires et +1 arme de siège déployable.' },
  forge: { name: 'Forge', icon: '🔥', max: 3, start: 0, base: { stone: 140, wood: 140 }, time: 25,
    desc: 'Transforme les ressources et forge les équipements : +5 % de dégâts de toutes les troupes par niveau.' },
  market: { name: 'Marché', icon: '⚖️', max: 3, start: 0, base: { wood: 150, gold: 40 }, time: 20,
    desc: 'Échange tes ressources contre de l\'or et inversement. Meilleurs taux à chaque niveau.' },
  farm: { name: 'Ferme', icon: '🌾', max: 4, start: 0, base: { wood: 100, stone: 40 }, time: 18,
    desc: 'Champs et élevage : produit de la nourriture. 3 travailleurs par niveau.' },
  mill: { name: 'Moulin', icon: '🌬️', max: 3, start: 0, base: { wood: 130, stone: 70 }, time: 22,
    desc: 'Transforme le grain : +25 % de nourriture produite par niveau.' },
  granary: { name: 'Grenier', icon: '🏚️', max: 4, start: 0, base: { wood: 120, stone: 60 }, time: 20,
    desc: 'Stocke la nourriture : +500 de capacité par niveau.' },
  warehouse: { name: 'Entrepôt', icon: '📦', max: 4, start: 0, base: { wood: 140, stone: 80 }, time: 20,
    desc: 'Stocke bois, pierre, métal, or et diamants : +700 de capacité par niveau.' },
  sawmill: { name: 'Scierie', icon: '🪚', max: 4, start: 0, base: { wood: 110, stone: 50 }, time: 20,
    desc: 'Bûcherons au travail : produit du bois. 3 travailleurs par niveau.' },
  quarry: { name: 'Carrière', icon: '⛏️', max: 4, start: 0, base: { wood: 100, stone: 60 }, time: 20,
    desc: 'Tailleurs de pierre : produit de la pierre. 3 travailleurs par niveau.' },
  mine: { name: 'Mine de fer', icon: '🪨', max: 4, start: 0, base: { wood: 150, stone: 100 }, time: 26,
    desc: 'Galeries et minerai : produit du métal. 3 travailleurs par niveau.' },
  goldmine: { name: 'Mine d\'or', icon: '🪙', max: 3, start: 0, base: { wood: 160, stone: 120, metal: 20 }, time: 30,
    desc: 'Filons d\'or : produit de l\'or. 3 travailleurs par niveau.' },
  defenses: { name: 'Défenses', icon: '🛡️', max: 4, start: 0, base: { stone: 200, metal: 40 }, time: 30,
    desc: 'Zone tampon autour du château : pièges qui blessent les zombies et +20 % PV du château par niveau.' },
};
// bâtiments à travailleurs : ressource produite par villageois et par seconde
export const JOBS = {
  farm:     { res: 'food',  rate: 0.30 },
  sawmill:  { res: 'wood',  rate: 0.35 },
  quarry:   { res: 'stone', rate: 0.30 },
  mine:     { res: 'metal', rate: 0.13 },
  goldmine: { res: 'gold',  rate: 0.10 },
};
export const JOB_SLOTS = 3;           // travailleurs par niveau
export const FOOD_UPKEEP = { civil: 0.025, army: 0.04 };   // nourriture/s par habitant / soldat
export function storageCap(res, lv) {  // lv = { granary, warehouse }
  return res === 'food' ? 500 + 500 * (lv.granary || 0) : 900 + 700 * (lv.warehouse || 0);
}
export function buildingCost(id, level) { return scale(BUILDINGS[id].base, level); }
export function buildingTime(id, level) { return BUILDINGS[id].time * level; }

// ---------- Recettes de la forge ----------
export const RECIPES = [
  { id: 'smelt', name: 'Fonte', in: { stone: 30, wood: 20 }, out: { metal: 10 }, time: 8, level: 1 },
  { id: 'coin', name: 'Frappe', in: { metal: 20 }, out: { gold: 15 }, time: 8, level: 2 },
  { id: 'cut', name: 'Taille', in: { gold: 60, metal: 40 }, out: { diamond: 5 }, time: 15, level: 3 },
];

// ---------- Technologies (laboratoire) ----------
export const TECHS = {
  square:     { name: 'Formation en carré', icon: '⬛', lab: 1, cost: { gold: 80, metal: 30 }, time: 25, desc: 'Débloque le Carré (+25 % résistance aux dégâts de zone).' },
  skirmish:   { name: 'Escarmouche', icon: '✳️', lab: 1, cost: { gold: 80, wood: 60 }, time: 25, desc: 'Débloque l\'Escarmouche (−30 % dégâts des armes de siège).' },
  tools:      { name: 'Outils affûtés', icon: '⛏️', lab: 1, cost: { metal: 40, wood: 60 }, time: 20, desc: '+25 % vitesse de récolte.' },
  baskets:    { name: 'Grands paniers', icon: '🧺', lab: 1, cost: { wood: 100, gold: 30 }, time: 20, desc: '+60 % capacité de transport.' },
  masonry:    { name: 'Maçonnerie', icon: '🧱', lab: 2, cost: { stone: 250, gold: 60 }, time: 35, desc: '+35 % PV des segments de muraille.' },
  armor:      { name: 'Armures', icon: '🛡️', lab: 2, cost: { metal: 120, gold: 80 }, time: 35, desc: '+20 % PV des troupes.' },
  longbow:    { name: 'Arcs longs', icon: '🏹', lab: 2, cost: { wood: 150, gold: 60 }, time: 30, desc: '+20 % portée des archers.' },
  metalAmmo:  { name: 'Munitions en métal', icon: '⚙️', lab: 2, cost: { metal: 100, gold: 50 }, time: 30, desc: 'Les catapultes et trébuchets peuvent tirer du métal (+30 % dégâts).' },
  mechanics:  { name: 'Mécanique de siège', icon: '🔩', lab: 3, cost: { metal: 150, diamond: 5 }, time: 40, desc: '−25 % temps de rechargement des armes de siège.' },
  blessing:   { name: 'Lames bénies', icon: '✨', lab: 3, cost: { gold: 200, diamond: 10 }, time: 45, desc: '+25 % dégâts de toutes les troupes.' },
};

// ---------- Vagues ----------
// groups: [type, nombre, spawn ('W','C','E','*'), délai avant le groupe (s), intervalle (s)]
export const WAVES = [
  { prep: 75, groups: [['classic', 6, 'C', 0, 1.4]] },
  { prep: 45, groups: [['classic', 9, '*', 0, 1.1], ['fast', 3, 'C', 6, 0.8]] },
  { prep: 45, groups: [['classic', 10, '*', 0, 1.0], ['dog', 6, 'E', 5, 0.5]] },
  { prep: 50, groups: [['classic', 12, '*', 0, 0.9], ['fast', 6, 'W', 4, 0.6], ['golem', 1, 'C', 12, 0]] },
  { prep: 50, groups: [['classic', 14, '*', 0, 0.8], ['jumper', 4, 'C', 6, 1.2], ['thrower', 2, 'W', 10, 2]] },
  { prep: 55, groups: [['classic', 16, '*', 0, 0.7], ['dog', 8, 'W', 3, 0.4], ['golem', 2, 'E', 10, 4], ['golem_ram', 1, 'C', 14, 0]] },
  { prep: 55, groups: [['fast', 14, '*', 0, 0.5], ['jumper', 6, '*', 4, 0.8], ['thrower', 4, 'E', 8, 2]] },
  { prep: 60, groups: [['classic', 22, '*', 0, 0.5], ['dog', 10, 'C', 4, 0.3], ['golem', 3, '*', 8, 3], ['golem_ram', 2, 'W', 12, 5]] },
  { prep: 60, groups: [['classic', 20, '*', 0, 0.5], ['fast', 12, '*', 2, 0.4], ['jumper', 8, '*', 6, 0.6], ['thrower', 5, '*', 9, 1.5]] },
  { prep: 70, groups: [['classic', 30, '*', 0, 0.4], ['golem', 6, '*', 5, 2], ['golem_ram', 3, '*', 10, 4], ['thrower', 6, '*', 12, 1.5], ['jumper', 8, 'C', 15, 0.6]] },
];
const POOL = ['classic', 'fast', 'dog', 'golem', 'jumper', 'golem_ram', 'thrower'];
export function waveConfig(n) { // n commence à 1
  if (n <= WAVES.length) return WAVES[n - 1];
  const k = n - WAVES.length;
  const f = Math.pow(1.13, k);
  // profil de la vague : 0 équilibrée, 1 nuée rapide, 2 colosses, 3 assaut de siège
  const m = [[1, 1, 1, 1, 1, 1], [0.5, 2.2, 2, 1, 0.5, 0.7], [0.6, 0.6, 0.6, 0.8, 2.2, 1.6], [0.8, 0.8, 1, 1, 1.2, 2.2]][k % 4];
  const c = (v, i) => Math.max(1, Math.round(v * f * m[i]));
  return {
    prep: 60,
    groups: [
      ['classic', c(26, 0), '*', 0, 0.35],
      ['fast', c(10, 1), '*', 3, 0.35],
      ['dog', c(8, 1), '*', 5, 0.3],
      ['jumper', c(6, 3), '*', 8, 0.6],
      ['golem', c(3, 4), '*', 10, 2],
      ['golem_ram', c(2, 5), '*', 14, 3],
      ['thrower', c(4, 3), '*', 12, 1.2],
    ],
  };
}
export function waveScaling(n) {
  return { hp: 1 + 0.13 * (n - 1) + Math.max(0, n - 10) * 0.08, dmg: 1 + 0.07 * (n - 1) };
}
export function waveHasSiege(cfg) { return cfg.groups.some(g => ENEMIES[g[0]].siege); }
export { POOL as ENEMY_TYPES };

export const CASTLE_HP = 8000;
export const WALL_HP = 1700;
export const GATE_HP = 2400;
export const WALL_REGEN_PER_WORKER = 0.8; // PV/s réparés par ouvrier entre les vagues
export const CENTER = { name: 'Centre de récolte', hp: 500, cost: { wood: 120, stone: 80 }, radius: 16, bonus: 0.2 };
export const NEST = { hp: 2600, regrowWaves: 4, reward: { diamond: 8, gold: 80 } };
