// Types de formations : génération des slots (lx = latéral, lz = profondeur, + = vers l'avant)

const line = (n, sp) => Array.from({ length: n }, (_, i) => ({ lx: (i - (n - 1) / 2) * sp, lz: 0 }));
const rows = (n, sp, rcount) => {
  const cols = Math.ceil(n / rcount), out = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    const inRow = Math.min(cols, n - r * cols);
    out.push({ lx: (c - (inRow - 1) / 2) * sp, lz: -r * sp });
  }
  return out;
};
const wedge = (n, sp) => {
  const out = [{ lx: 0, lz: 0 }];
  for (let k = 1; out.length < n; k++) {
    out.push({ lx: -k * sp * 0.8, lz: -k * sp * 0.85 });
    if (out.length < n) out.push({ lx: k * sp * 0.8, lz: -k * sp * 0.85 });
  }
  return out;
};
const square = (n, sp) => {
  const side = Math.ceil(Math.sqrt(n)), out = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / side), c = i % side;
    out.push({ lx: (c - (side - 1) / 2) * sp, lz: -(r - (Math.ceil(n / side) - 1) / 2) * sp });
  }
  return out;
};
const skirmish = (n, sp) => {
  const cols = Math.ceil(Math.sqrt(n * 2)), out = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    out.push({ lx: (c - (cols - 1) / 2) * sp * 2.1 + (r % 2) * sp, lz: -r * sp * 2.1 });
  }
  return out;
};
const column = (n, sp) => Array.from({ length: n }, (_, i) => ({ lx: ((i % 2) - 0.5) * sp, lz: -Math.floor(i / 2) * sp }));

export const FORMATIONS = {
  line:     { name: 'Ligne',            icon: '━', slots: (n, sp) => line(n, sp), bonus: { frontDef: 0.15 }, req: { barracks: 1 }, tip: '+15 % défense frontale. Bonne contre les charges.' },
  double:   { name: 'Double ligne',     icon: '☰', slots: (n, sp) => rows(n, sp, 2), bonus: { frontDef: 0.15 }, req: { barracks: 2 }, tip: '+15 % défense frontale, meilleure densité.' },
  wedge:    { name: 'Coin',             icon: '▲', slots: (n, sp) => wedge(n, sp), bonus: { charge: 0.2 }, req: { stable: 1 }, tip: '+20 % dégâts de charge. Idéal pour percer.' },
  square:   { name: 'Carré',            icon: '■', slots: (n, sp) => square(n, sp), bonus: { aoeRes: 0.25 }, req: { tech: 'square' }, tip: '+25 % résistance aux dégâts de zone.' },
  skirmish: { name: 'Escarmouche',      icon: '✳', slots: (n, sp) => skirmish(n, sp), bonus: { siegeRes: 0.3 }, req: { tech: 'skirmish' }, tip: '−30 % dégâts des armes de siège et rochers.' },
  column:   { name: 'Colonne',          icon: '⋮', slots: (n, sp) => column(n, sp), bonus: { speed: 0.2 }, req: { barracks: 1 }, tip: '+20 % vitesse de déplacement.' },
  cavwedge: { name: 'Cavalerie en coin', icon: '⏶', slots: (n, sp) => wedge(n, sp * 1.6), bonus: { charge: 0.35 }, req: { stable: 2 }, cavalryOnly: true, tip: 'Cavaliers uniquement. +35 % dégâts de charge.' },
};

export function formationLock(game, id) {
  const r = FORMATIONS[id].req, p = game.production;
  if (r.barracks && p.level('barracks') < r.barracks) return `Caserne niveau ${r.barracks}`;
  if (r.stable && p.level('stable') < r.stable) return `Écurie niveau ${r.stable}`;
  if (r.tech && !p.hasTech(r.tech)) return 'Recherche au laboratoire';
  return null;
}
