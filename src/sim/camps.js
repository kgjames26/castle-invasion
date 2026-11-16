// (v11) Feux de veillée : les villageois sans travail et les allumeurs au repos se retrouvent autour d'un feu de camp,
// assis sur des bûches (4 bancs de 3 places), puis debout en cercles autour quand les bancs sont pleins.
// 'folk' = villageois libres (devant le château) ; 'keep' = allumeurs (de part et d'autre de la placette).
export const CAMPS = {
  seats: 12, benchR: 2.7, standR: 4.5, ringStep: 1.25, perRing: 16, seatH: 0.48,
  list: [{ x: 84, z: 270, kind: 'folk' }, { x: 116, z: 270, kind: 'folk' }, { x: 150, z: 199, kind: 'keep' }, { x: 50, z: 199, kind: 'keep' }],
};
const BY = {}; CAMPS.list.forEach((c, i) => { c.id = i; (BY[c.kind] ||= []).push(c); });
export const campsOf = kind => BY[kind] || [];
// banc b (0..3) d'un camp : centre et direction (le long du banc)
export function bench(c, b) { const a = (b + 0.5) * Math.PI / 2, r = CAMPS.benchR; return { x: c.x + Math.sin(a) * r, z: c.z + Math.cos(a) * r, a }; }
// k-ième personne au repos d'un genre : d'abord les places assises (réparties entre les camps), puis debout en cercles
export function campSpot(kind, k, out = {}) {
  const L = campsOf(kind), n = L.length, S = CAMPS.seats; if (!n || k < 0) return null;
  let c, x, z, sit;
  if (k < S * n) { c = L[k % n]; const j = (k / n) | 0, b = (j / 3) | 0, s = j % 3, B = bench(c, b), off = (s - 1) * 0.82;
    x = B.x + Math.cos(B.a) * off; z = B.z - Math.sin(B.a) * off; sit = 1; }
  else { const m = k - S * n, j = (m / n) | 0, ring = (j / CAMPS.perRing) | 0, a = ((j % CAMPS.perRing) + 0.5 * (ring % 2)) / CAMPS.perRing * Math.PI * 2, r = CAMPS.standR + ring * CAMPS.ringStep; c = L[m % n];
    x = c.x + Math.sin(a) * r; z = c.z + Math.cos(a) * r; sit = 0; }
  out.x = x; out.z = z; out.sit = sit; out.face = Math.atan2(c.x - x, c.z - z); out.camp = c.id; return out;
}
