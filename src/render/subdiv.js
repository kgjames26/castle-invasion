// Subdivision de Loop (v9.8) : chaque triangle devient 4 triangles, et les sommets glissent vers une surface plus lisse.
// La subdivision est une opération LINÉAIRE sur les positions : on la décrit par des poids (nouveau sommet = Σ w·ancien),
// ce qui permet de l'appliquer à chaque image d'une animation cuite (VAT) sans rien recalculer d'autre.
// Les sommets confondus (coutures de couleur) sont soudés pour la topologie mais gardent leurs couleurs : pas de fissure.

export function loopOps(pos, index, tol = 1e-5) {
  const V = pos.length / 3, idx = index || Array.from({ length: V }, (_, i) => i), T = idx.length / 3;
  // soudure par position
  const key = i => `${Math.round(pos[i * 3] / tol)},${Math.round(pos[i * 3 + 1] / tol)},${Math.round(pos[i * 3 + 2] / tol)}`;
  const weld = new Int32Array(V), seen = new Map(); for (let i = 0; i < V; i++) { const k = key(i); if (!seen.has(k)) seen.set(k, i); weld[i] = seen.get(k); }
  // arêtes soudées → sommets opposés ; voisins de chaque sommet soudé
  const ek = (a, b) => a < b ? a * 4194304 + b : b * 4194304 + a, edges = new Map(), nb = new Map();
  for (let t = 0; t < T; t++) for (let e = 0; e < 3; e++) {
    const a = weld[idx[t * 3 + e]], b = weld[idx[t * 3 + (e + 1) % 3]], c = weld[idx[t * 3 + (e + 2) % 3]]; if (a === b) continue;
    const k = ek(a, b); let E = edges.get(k); if (!E) edges.set(k, E = { a, b, opp: [] }); E.opp.push(c);
    if (!nb.has(a)) nb.set(a, new Set()); if (!nb.has(b)) nb.set(b, new Set()); nb.get(a).add(b); nb.get(b).add(a);
  }
  // règles de Loop pour les anciens sommets (bord : 3/4 + 1/8 + 1/8 ; intérieur : β de Warren)
  const vRule = new Map();
  for (const [v, set] of nb) {
    const bnd = [...set].filter(u => { const E = edges.get(ek(v, u)); return E && E.opp.length !== 2; });
    if (bnd.length >= 2) vRule.set(v, [[v, 0.75], [bnd[0], 0.125], [bnd[1], 0.125]]);
    else if (bnd.length === 1) vRule.set(v, [[v, 1]]);
    else { const n = set.size, beta = n === 3 ? 3 / 16 : 3 / (8 * n); vRule.set(v, [[v, 1 - n * beta], ...[...set].map(u => [u, beta])]); }
  }
  const eRule = E => E.opp.length === 2 ? [[E.a, 0.375], [E.b, 0.375], [E.opp[0], 0.125], [E.opp[1], 0.125]] : [[E.a, 0.5], [E.b, 0.5]];
  // nouveaux sommets : chaque ancien sommet garde sa copie (sa couleur), un sommet par arête et par paire d'indices réels
  const ops = [], col = [], newIdx = [];
  for (let i = 0; i < V; i++) { ops.push(vRule.get(weld[i]) || [[weld[i], 1]]); col.push([[i, 1]]); }
  const emid = new Map();
  const mid = (i, j) => { const k = ek(i, j); let m = emid.get(k); if (m === undefined) { const E = edges.get(ek(weld[i], weld[j])); m = ops.length; ops.push(E ? eRule(E) : [[weld[i], 0.5], [weld[j], 0.5]]); col.push([[i, 0.5], [j, 0.5]]); emid.set(k, m); } return m; };
  for (let t = 0; t < T; t++) { const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2], ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); newIdx.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca); }
  return { ops, col, index: newIdx, V: ops.length };
}
// applique des poids à un tableau à `n` composantes par sommet
export function applyOps(ops, src, n = 3) { const out = new Float32Array(ops.length * n); for (let v = 0; v < ops.length; v++) for (const [i, w] of ops[v]) for (let k = 0; k < n; k++) out[v * n + k] += w * src[i * n + k]; return out; }
