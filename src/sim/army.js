// Armée : réserve, archers de garnison (chemin de ronde), ESCOUADES avec formations (garnison ou sortie sur le champ de bataille),
// files d'entraînement. Les escouades agissent comme une seule entité : points de vie en réserve commune, membres dessinés par formation.
import { INFECTION, GRADES, gradeFor } from '../content/medieval.js';
import { STAIR_OFF, SECTORS, SECTOR_W, ARCHER_SLOTS, ARCHER_Z, GARRISON_Z, GATE_XS, WALL_Z0, WALL_Z1, WALK_H, PLAZA, sectorOfX, wallOff } from './constants.js';
import { UNITS, UNIT_ORDER, FORMATIONS, SQUAD, TRAIN, RANKS, UPGRADES, INFIRMARY, ZOMBIES } from '../content/medieval.js';

const tmp = new Int32Array(1024), tmp2 = new Int32Array(1024);
export const MOVE_Z0 = WALL_Z1 + 4, MOVE_Z1 = 208;          // zone où l'on peut poster une escouade à l'intérieur (cour + placette)
export const archerPos = (s, k) => { let x = s * SECTOR_W + ((k >> 1) + 0.5) * SECTOR_W / (ARCHER_SLOTS / 2); return { x, z: ARCHER_Z + wallOff(x) + (k & 1) * 2.4 - 1.2 }; };
// ——— archers : montée par l'escalier le plus proche, puis marche sur le chemin de ronde jusqu'à leur créneau ———
export const STAIR_Z0 = 159, STAIR_Z1 = 150.2, ARCHER_SPEED = 5;
export const stairX = (s, k) => s * SECTOR_W + STAIR_OFF(s)[archerPos(s, k).x < s * SECTOR_W + SECTOR_W / 2 ? 0 : 1];
const _ap = { x: 0, z: 0, y: 0, rot: Math.PI, len: 0 };
// position de l'archer k du secteur s après avoir parcouru `prog` mètres (au-delà de la longueur : à son créneau, face au nord)
export function archerPose(s, k, prog) {
  const p = archerPos(s, k), sx = stairX(s, k), o = wallOff(sx), Z0 = STAIR_Z0 + o, Z1 = STAIR_Z1 + o, l1 = Math.hypot(Z0 - Z1, WALK_H), l2 = Math.abs(p.z - Z1), l3 = Math.abs(p.x - sx), len = l1 + l2 + l3; _ap.len = len;
  if (prog >= len) { _ap.x = p.x; _ap.z = p.z; _ap.y = WALK_H; _ap.rot = Math.PI; return _ap; }
  if (prog < l1) { const f = prog / l1; _ap.x = sx; _ap.z = Z0 + (Z1 - Z0) * f; _ap.y = WALK_H * f; _ap.rot = Math.PI; }
  else if (prog < l1 + l2) { const f = (prog - l1) / l2; _ap.x = sx; _ap.z = Z1 + (p.z - Z1) * f; _ap.y = WALK_H; _ap.rot = p.z >= Z1 ? 0 : Math.PI; }
  else { const f = (prog - l1 - l2) / l3; _ap.x = sx + (p.x - sx) * f; _ap.z = p.z + (wallOff(sx + (p.x - sx) * f) - wallOff(p.x)); _ap.y = WALK_H; _ap.rot = p.x > sx ? Math.PI / 2 : -Math.PI / 2; }
  return _ap;
}
// emplacement d'attente de la i-ème recrue autour du point de ralliement
export function rallySlot(r, i, out) { const col = i % 10, row = (i / 10) | 0; out.x = Math.min(196, Math.max(4, r.x + (col - 4.5) * 2.4)); out.z = r.z + row * 2.4 - 2; return out; }
export const TRAIN_BUILDINGS = ['barracks', 'stable', 'range'];
export const SQUAD_CAP = 150;   // (v11.1) une troupe d'un seul type : jusqu'à 150 hommes ; au-delà, plusieurs troupes réunies en GROUPE
// (v11.1) disposition « en tacticien » d'un groupe mêlé, dans le repère du groupe (x latéral, z profondeur ; z négatif = devant) :
// infanterie lourde au centre du front, chevaliers puis fantassins de part et d'autre, cavaliers sur les ailes, archers derrière.
const ROLE = { heavy: 'front', knight: 'front', soldier: 'front', cavalry: 'wing', archer: 'rear' }, FRONT_ORDER = { heavy: 0, knight: 1, soldier: 2 };
export function tacticalLayout(members) {
  const ext = q => { const L = formationLayout(q.form, Math.max(1, q.n), UNITS[q.type].size); let w = 0, d = 0; for (let k = 0; k < L.xs.length; k++) { w = Math.max(w, Math.abs(L.xs[k])); d = Math.max(d, Math.abs(L.zs[k])); } return { w: w + 1.2, d: d + 1.2 }; };
  const out = [], gap = 2.5;
  const row = (list, z) => { const es = list.map(ext); let w = -gap; for (const e of es) w += 2 * e.w + gap; let x = -w / 2;   // côte à côte, centrées
    list.forEach((q, i) => { out.push({ q, x: x + es[i].w, z }); x += 2 * es[i].w + gap; }); return { w, d: Math.max(0, ...es.map(e => e.d)) }; };
  const front = members.filter(q => ROLE[q.type] === 'front').sort((a, b) => FRONT_ORDER[a.type] - FRONT_ORDER[b.type]);
  const mid = []; front.forEach((q, i) => i % 2 ? mid.unshift(q) : mid.push(q));   // le plus lourd au milieu, les autres alternent à gauche et à droite
  const F = mid.length ? row(mid, 0) : { w: 0, d: 0 };
  const rear = members.filter(q => ROLE[q.type] === 'rear'); if (rear.length) { const dr = Math.max(...rear.map(q => ext(q).d)); row(rear, F.d + gap + dr); }
  const wings = members.filter(q => ROLE[q.type] === 'wing'); let lx = -F.w / 2 - gap, rx = F.w / 2 + gap;
  wings.forEach((q, i) => { const e = ext(q); if (i % 2 === 0) { out.push({ q, x: lx - e.w, z: F.d * 0.3 }); lx -= 2 * e.w + gap; } else { out.push({ q, x: rx + e.w, z: F.d * 0.3 }); rx += 2 * e.w + gap; } });
  return out;
}
// tourne un décalage local (x, z) du repère « face au nord » vers l'orientation face (atan2(dx, dz) ; nord = π)
export function rotLocal(x, z, face) { const a = face - Math.PI, c = Math.cos(a), s = Math.sin(a); return [x * c + z * s, -x * s + z * c]; }
// danger qu'un zombie fait peser sur le royaume : casseurs de pierre, géants, grimpeurs, kamikazes, ceux qui frappent déjà la muraille, et surtout ceux qui sont entrés
export function threatOf(Z, i) {
  const t = Z.type[i], T = ZOMBIES[t], wz = WALL_Z0 + wallOff(Z.x[i]), gapZ = wz - Z.z[i];
  const base = 1 + (T.wall || 0) / 8 + (t >= 5 && t <= 7 ? 3 : 0) + (t === 8 ? 2 : t === 9 ? 2.5 : t === 10 ? 3.5 : 0);
  const near = gapZ < -4 ? 4 : 1 + Math.max(0, 50 - gapZ) / 22;
  return base * near * (Z.state[i] === 1 ? 1.5 : 1);
}

// ——— formations : décalages des membres autour du centre (z négatif = devant, vers le nord) ———
const cache = new Map();
export function formationLayout(form, n, size = 1) {
  const key = form + '|' + n + '|' + size; let L = cache.get(key); if (L) return L;
  const xs = new Float32Array(n), zs = new Float32Array(n), sp = 1.7 * size;
  const grid = (cols, spx, spz, rows) => { for (let k = 0; k < n; k++) { xs[k] = ((k % cols) - (cols - 1) / 2) * spx; zs[k] = (((k / cols) | 0) - (rows - 1) / 2) * spz; } };
  // les gros effectifs (pelotons, escadrons) prennent plus de rangs plutôt que de s'étirer sur toute la muraille
  if (form === 'line') { const r = Math.max(2, Math.ceil(n / 22)), c = Math.ceil(n / r); grid(c, sp, sp, r); }
  else if (form === 'phalanx') { const r = Math.max(3, Math.ceil(n / 16)), c = Math.ceil(n / r); grid(c, sp * 0.75, sp * 0.75, r); }
  else if (form === 'column') { const c = Math.max(2, Math.ceil(n / 30)); grid(c, sp, sp, Math.ceil(n / c)); }
  else if (form === 'square') { const c = Math.ceil(Math.sqrt(n)); grid(c, sp, sp, c); }
  else { // coin : 1, 2, 3… membres par rangée, pointe vers le nord
    let rows = 0, t = 0; while (t < n) { rows++; t += rows; }
    for (let k = 0; k < n; k++) { let rr = 0, l = k; while (l > rr) { l -= rr + 1; rr++; } xs[k] = (l - rr / 2) * sp; zs[k] = (rr - (rows - 1) / 2) * sp; }
  }
  let rad = 0; for (let k = 0; k < n; k++) rad = Math.max(rad, Math.hypot(xs[k], zs[k]));
  L = { xs, zs, radius: rad + 1.2 }; cache.set(key, L); return L;
}

export class Army {
  constructor() {
    this.reserve = { archer: 0, soldier: 0, heavy: 0, knight: 0, cavalry: 0 };
    this.archers = Array.from({ length: SECTORS }, () => ({ n: 0, cd: new Float32Array(ARCHER_SLOTS), prog: new Float32Array(ARCHER_SLOTS).fill(1e9) }));
    this.rally = { x: PLAZA.x, z: PLAZA.z }; this.walkers = []; this.gate = GATE_XS.map(() => 0); this.gateT = GATE_XS.map(() => 0); this.gateReq = GATE_XS.map(() => 0);
    this.squads = []; this.nextId = 1; this.outside = []; this.autoArchers = true; this.groups = []; this.nextGid = 1;   // IA : archers placés d'eux-mêmes sur les remparts
    this.queues = { barracks: [], stable: [], range: [] };
  }
  // ——— population ———
  popUsed() {
    let p = 0; for (const t in this.reserve) p += this.reserve[t] * UNITS[t].pop;
    for (const a of this.archers) p += a.n; for (const q of this.squads) p += q.n * UNITS[q.type].pop;
    for (const b in this.queues) for (const it of this.queues[b]) p += UNITS[it.type].pop;
    return p;
  }
  headcount() { let p = 0; for (const t in this.reserve) p += this.reserve[t]; for (const a of this.archers) p += a.n; for (const q of this.squads) p += q.n; return p; }
  meleeIn(s) { let n = 0; for (const q of this.squads) if (q.mode === 'garrison' && q.sector === s) n += q.n; return n; }
  // ——— archers de garnison ———
  assignArchers(s, delta) {
    let moved = 0;
    for (let k = 0; k < Math.abs(delta); k++) {
      const a = this.archers[s];
      if (delta > 0) { if (this.reserve.archer <= 0 || a.n >= ARCHER_SLOTS) break; this.reserve.archer--; a.cd[a.n] = Math.random() * 0.8; a.prog[a.n] = 0; a.n++; moved++; }
      else { if (a.n <= 0) break; a.n--; this.reserve.archer++; moved++; }
    }
    return moved;
  }
  // ——— entraînement ———
  // rang d'un type d'unité = niveau de son bâtiment d'entraînement (1 à 5) ; coût de production multiplié en conséquence
  rank(sim, type) { return RANKS[Math.max(0, Math.min(RANKS.length, sim.eco.level[UNITS[type].from]) - 1)]; }
  unitCost(sim, type) { const k = this.rank(sim, type).cost, o = {}; for (const r in UNITS[type].cost) o[r] = Math.round(UNITS[type].cost[r] * k); return o; }
  parallel(sim, b) { return TRAIN.parallel[Math.min(3, sim.eco.level[b] || 0)] || 1; }
  queueMax(sim, b) { return TRAIN.baseQueue + TRAIN.queuePerLevel * (sim.eco.level[b] - 1); }
  trainTime(sim, b, type) { return UNITS[type].train / (1 + TRAIN.speedPerLevel * (sim.eco.level[b] - 1)); }
  canTrain(sim, type) {
    const U = UNITS[type], b = U.from, lv = sim.eco.level[b];
    return lv >= 1 && lv >= (U.minLevel || 1);
  }
  enqueue(sim, type, count = 1) {
    const U = UNITS[type], b = U.from; let ok = 0;
    for (let k = 0; k < count; k++) {
      const cost = this.unitCost(sim, type);
      if (!this.canTrain(sim, type) || this.queues[b].length >= this.queueMax(sim, b) || sim.eco.popRoom() < U.pop || !sim.eco.pay(cost)) break;
      this.queues[b].push({ type, t: this.trainTime(sim, b, type), full: this.trainTime(sim, b, type), paid: cost }); ok++;
    }
    return ok;
  }
  cancel(sim, b) {
    const it = this.queues[b].pop(); if (!it) return false;
    const paid = it.paid || UNITS[it.type].cost; for (const r in paid) sim.eco.add(r, paid[r]); return true;
  }
  // la file attend tant que le bâtiment est bloqué (déplacé) ou en cours de construction
  trainTick(dt, sim) {
    for (const b of TRAIN_BUILDINGS) {
      const q = this.queues[b], lv = sim.eco.level[b]; if (!q.length || lv < 1) continue;
      const par = Math.min(q.length, TRAIN.parallel[Math.min(3, lv)] || 1);       // plusieurs recrues formées en même temps
      for (let i = 0; i < par; i++) q[i].t -= dt;
      for (let i = par - 1; i >= 0; i--) if (q[i].t <= 0) { this.reserve[q[i].type]++; sim.events.push({ type: 'trained', unit: q[i].type, b }); q.splice(i, 1); }   // (v11) la recrue rejoint la réserve au point de ralliement
    }
  }
  // ——— recrues : chaque unité créée sort de son bâtiment et marche jusqu'au point de ralliement (placette par défaut) ———
  setRally(x, z) { this.rally.x = Math.min(196, Math.max(4, x)); this.rally.z = Math.min(310, Math.max(WALL_Z1 + 8, z)); }
  syncWalkers(sim) {
    const W = this.walkers, slot = { x: 0, z: 0 };
    for (const t of Object.keys(this.reserve)) {
      let have = 0; for (const w of W) if (w.type === t) have++;
      const want = this.reserve[t];
      for (; have < want; have++) { const b = sim.build.items.find(s => s.type === UNITS[t].from && s.state !== 'site'); W.push({ type: t, x: b ? b.x : PLAZA.x, z: b ? b.z + 3 : PLAZA.z, px: 0, pz: 0, tx: 0, tz: 0 }); const w = W[W.length - 1]; w.px = w.x; w.pz = w.z; }
      for (; have > want; have--) { for (let i = W.length - 1; i >= 0; i--) if (W[i].type === t) { W.splice(i, 1); break; } }
    }
    const dt = 1 / 20;
    for (let i = 0; i < W.length; i++) {
      const w = W[i]; rallySlot(this.rally, i, slot); w.px = w.x; w.pz = w.z; w.tx = slot.x; w.tz = slot.z;
      const dx = w.tx - w.x, dz = w.tz - w.z, d = Math.hypot(dx, dz); if (d > 0.05) { const st = Math.min(d, 6 * dt); w.x += dx / d * st; w.z += dz / d * st; }
    }
  }
  // portes de la muraille : s'ouvrent quand une escouade doit passer, se referment ensuite
  updateGate(dt) {
    for (let g = 0; g < GATE_XS.length; g++) {
      if (this.gateReq[g]) this.gateT[g] = 1.5; else this.gateT[g] -= dt; this.gateReq[g] = 0;
      const target = this.gateT[g] > 0 ? 1 : 0, v = this.gate[g]; this.gate[g] += Math.sign(target - v) * Math.min(Math.abs(target - v), dt * 0.9);
    }
  }
  // porte la plus proche de x (gauche, centre ou droite)
  gateNear(x) { let best = 0, bd = Infinity; GATE_XS.forEach((gx, g) => { const d = Math.abs(gx - x); if (d < bd) { bd = d; best = g; } }); return best; }
  // ——— escouades ———
  // (v11) chaque troupe porte un NUMÉRO stable (le plus petit libre) : sa couleur, son fanion, sa place sur la mini-carte
  numberSquads() {
    const used = new Set(); let need = false;
    for (const q of this.squads) { if (q.num > 0 && !used.has(q.num)) used.add(q.num); else need = true; }
    if (!need) return; const seen = new Set();
    for (const q of this.squads) { if (q.num > 0 && !seen.has(q.num)) { seen.add(q.num); continue; } let n = 1; while (used.has(n)) n++; q.num = n; used.add(n); seen.add(n); }
  }
  unitHp(type) { return UNITS[type].hp; }
  maxN(type, q) { return GRADES[q && q.grade || 'escouade'].size; }   // effectif maximal selon le grade (escouade 15, peloton 50, escadron 150)
  formSquad(type, size, sector = 2, grade = null) {
    const U = UNITS[type]; if (!U.squad || this.squads.length >= SQUAD.maxSquads) return null;
    const n = Math.min(size, grade ? GRADES[grade].size : SQUAD_CAP, this.reserve[type] | 0); if (n < 1) return null;   // (v11.1) plus d'effectif minimum : on prend ce qu'on veut
    const g0 = gradeFor(n); this.reserve[type] -= n;
    const q = { id: this.nextId++, type, n, grade: g0, hp: n * U.hp, form: U.form, mode: 'garrison', sector, x: 0, z: 0, px: 0, pz: 0, postX: 0, postZ: 0, tx: 0, tz: 0, way: [], stance: 'hold', auto: true, atkAcc: 0, rot: 0, mom: 0, attackers: 0, cap: 0, hit: 0, fresh: true, rad: 3 };
    this.squads.push(q); this.layoutPosts(); return q;
  }
  // ——— (v11.1) fusions libres, groupes mêlés, séparations ———
  // former une troupe de n hommes pris dans la réserve (au point de ralliement), quel que soit leur nombre
  take(type, n) {
    const q = this.formSquad(type, Math.min(n, SQUAD_CAP)); if (!q) return null;
    q.auto = false; q.fresh = false; q.x = q.px = this.rally.x; q.z = q.pz = this.rally.z; this.layoutPosts(); this.route(q, q.postX, q.postZ); return q;
  }
  groupOf(q) { return q && q.gid ? this.groups.find(g => g.id === q.gid) || null : null; }
  members(g) { return this.squads.filter(q => q.gid === g.id && q.n > 0); }
  newGroup(list) {
    const g = { id: this.nextGid++, face: Math.PI, form: null }; this.groups.push(g);
    for (const q of list) { q.gid = g.id; q.auto = false; } return g;
  }
  // fusionner une sélection (troupes + hommes de la réserve) : un type = une troupe (jusqu'à 150, le surplus forme une autre troupe) ;
  // plusieurs types (ou plusieurs troupes) = un GROUPE, disposé en tacticien
  merge(qs, res = {}) {
    qs = [...new Set(qs)].filter(q => q && q.n > 0 && this.squads.includes(q));
    for (const t in res) { let k = Math.min(res[t] | 0, this.reserve[t] | 0); while (k > 0) { const q = this.take(t, k); if (!q) break; k -= q.n; qs.push(q); } }
    if (!qs.length) return null;
    const anchor = this.centerOf(qs), byT = {}, out = [];
    for (const q of qs) (byT[q.type] ||= []).push(q);
    for (const t in byT) {
      const L = byT[t].sort((a, b) => b.n - a.n); let head = L[0]; out.push(head);
      for (const o of L.slice(1)) {
        while (o.n > 0) { const room = SQUAD_CAP - head.n; if (room <= 0) { head = o; out.push(o); break; } const k = Math.min(room, o.n), hp = o.hp / o.n; head.n += k; head.hp += k * hp; o.n -= k; o.hp -= k * hp; }
      }
    }
    this.squads = this.squads.filter(q => q.n > 0 && q.hp > 0);
    for (const q of out) { q.grade = gradeFor(q.n); q.gid = 0; q.auto = false; }
    this.cleanGroups();
    let g = null; if (out.length > 1) { g = this.newGroup(out); this.orderGroup(g, anchor.x, anchor.z); }
    this.layoutPosts(); return { squads: out, group: g };
  }
  // fusionner deux troupes / groupes (bouton « Fusionner avec… »)
  mergeWith(a, b) { const L = q => { const g = this.groupOf(q); return g ? this.members(g) : [q]; }; return this.merge([...L(a), ...L(b)]); }
  centerOf(list) { let x = 0, z = 0; for (const q of list) { const p = this.destOf(q); x += p.x; z += p.z; } return { x: x / list.length, z: z / list.length }; }
  destOf(q) { const w = q.way && q.way.length ? q.way[q.way.length - 1] : null; return w ? { x: w.x, z: w.z } : q.mode === 'field' ? { x: q.tx, z: q.tz } : { x: q.postX || q.x, z: q.postZ || q.z }; }
  // ordre à un groupe : chaque troupe gagne sa place dans la disposition tactique autour du point visé, orientée vers g.face ;
  // le groupe avance à l'allure du plus lent
  orderGroup(g, x, z, attack = false) {
    const M = this.members(g); if (!M.length) return;
    const face = g.face ?? Math.PI, slow = Math.min(...M.map(q => (UNITS[q.type].speed || 3.4) * FORMATIONS[q.form].speed)), field = z < WALL_Z0 + wallOff(x) - 1;
    g.ax = x; g.az = z;
    for (const { q, x: lx, z: lz } of tacticalLayout(M)) {
      const [ox, oz] = rotLocal(lx, lz, face); let tx = x + ox, tz = z + oz;
      if (field) tz = Math.min(WALL_Z0 + wallOff(tx) - 2, tz); else tz = Math.max(MOVE_Z0, tz);
      q.face = face; q.auto = false; q.capSpeed = slow; if (attack) q.stance = 'charge';
      if (field) this.sortie(q, tx, tz); else this.moveTo(q, tx, tz);
    }
  }
  // orienter une troupe ou son groupe (appui long + flèche) : la formation se replace dans le bon sens
  rotate(q, face) {
    const g = this.groupOf(q); if (!g) { q.face = face; return; }
    g.face = face; const c = g.ax != null ? { x: g.ax, z: g.az } : this.centerOf(this.members(g)); this.orderGroup(g, c.x, c.z);
  }
  setGroupForm(g, f) { if (!FORMATIONS[f]) return; g.form = f; for (const q of this.members(g)) q.form = f; const c = g.ax != null ? { x: g.ax, z: g.az } : this.centerOf(this.members(g)); this.orderGroup(g, c.x, c.z); }
  // séparer un groupe : chaque troupe redevient indépendante
  dissolve(g) { for (const q of this.members(g)) q.gid = 0; this.groups = this.groups.filter(o => o !== g); }
  detach(q) { q.gid = 0; this.cleanGroups(); }
  // séparer une troupe : 'half' (deux moitiés), 'escouade' (paquets de 15), 'peloton' (50), ou un nombre d'hommes à détacher ; les morceaux restent dans le groupe
  splitFree(q, how) {
    const hp = q.hp / Math.max(1, q.n), parts = [];
    if (how === 'half') { if (q.n < 2) return []; parts.push(Math.floor(q.n / 2)); }
    else if (how === 'escouade' || how === 'peloton') { const sz = GRADES[how].size; let left = q.n; while (left > sz) { parts.push(sz); left -= sz; } }
    else { const k = Math.min(q.n - 1, how | 0); if (k >= 1) parts.push(k); }
    const made = [];
    for (const k of parts) { if (this.squads.length >= SQUAD.maxSquads) break; const o = { ...q, id: this.nextId++, num: 0, n: k, hp: k * hp, way: [], fresh: false, custom: q.custom ? { x: q.custom.x + 6 * (made.length + 1), z: q.custom.z } : null }; o.x += 4 * (made.length + 1); o.grade = gradeFor(k); q.n -= k; q.hp -= k * hp; this.squads.push(o); made.push(o); }
    q.grade = gradeFor(q.n); this.layoutPosts(); if (q.mode === 'field') made.forEach((o, i) => this.sortie(o, q.tx + 7 * (i + 1), q.tz)); else made.forEach(o => this.route(o, o.postX, o.postZ));
    return made;
  }
  cleanGroups() { this.groups = this.groups.filter(g => { const M = this.members(g); if (M.length < 2) { for (const q of M) q.gid = 0; return false; } return true; }); }
  reinforce(q) { const k = Math.min(this.maxN(q.type, q) - q.n, this.reserve[q.type]); if (k <= 0) return 0; this.reserve[q.type] -= k; q.n += k; q.hp += k * this.unitHp(q.type); return k; }
  // placement avant la vague : l'escouade est posée directement à l'endroit touché (cour = poste ; devant la muraille = sur le champ)
  place(q, x, z) {
    x = Math.min(196, Math.max(4, x)); q.way = []; q.auto = false;
    if (z < WALL_Z0 + wallOff(x) - 1) { q.mode = 'field'; q.tx = x; q.tz = Math.min(SQUAD.sortieZ[1], Math.max(SQUAD.sortieZ[0], z)); q.x = q.px = q.tx; q.z = q.pz = q.tz; this.layoutPosts(); return; }
    z = Math.min(MOVE_Z1, Math.max(MOVE_Z0, z)); q.mode = 'garrison'; q.sector = sectorOfX(x); q.custom = { x, z }; this.layoutPosts(); q.x = q.px = x; q.z = q.pz = z;
  }
  // hommes disponibles d'une catégorie pour fusionner autour de q : autres troupes en garnison + réserve
  poolFor(q, onlyAuto = false) { return this.squads.filter(o => o !== q && o.type === q.type && (!onlyAuto || o.auto) && o.mode === 'garrison').reduce((a, o) => a + o.n, q.n + (this.reserve[q.type] || 0)); }
  canRegroup(q, grade, onlyAuto = false) { return GRADES[grade].size > q.n && this.poolFor(q, onlyAuto) >= GRADES[grade].size; }
  // fusionner : q absorbe les troupes voisines de la même catégorie (puis la réserve) jusqu'au grade visé — seulement s'il y a assez d'hommes
  regroup(q, grade, onlyAuto = false) {
    if (!this.canRegroup(q, grade, onlyAuto)) return 0;
    const cap = GRADES[grade].size, others = this.squads.filter(o => o !== q && o.type === q.type && (!onlyAuto || o.auto) && o.mode === 'garrison').sort((a, b) => a.n - b.n || Math.hypot(a.x - q.x, a.z - q.z) - Math.hypot(b.x - q.x, b.z - q.z));
    q.grade = grade;
    for (const o of others) { if (q.n >= cap) break; const take = Math.min(o.n, cap - q.n), hpPer = o.hp / Math.max(1, o.n); q.n += take; q.hp += take * hpPer; o.n -= take; o.hp -= take * hpPer; if (o.n > 0 && o.n < 15) { this.reserve[o.type] += o.n; o.n = 0; } }
    this.reinforce(q); this.squads = this.squads.filter(o => o.n > 0); this.layoutPosts(); return q.n;
  }
  // séparer : escadron → pelotons (ou escouades), peloton → escouades ; un reste de moins de 15 hommes rentre en réserve
  split(q, to = null) {
    const g = to || (q.grade === 'escadron' ? 'peloton' : 'escouade'), part = GRADES[g].size, hpPer = q.hp / Math.max(1, q.n); let made = 0;
    if (q.n < part * 2 && !(q.n >= part + 15)) return 0;
    while (q.n - part >= part && this.squads.length < SQUAD.maxSquads) { const o = { ...q, id: this.nextId++, num: 0, n: part, hp: part * hpPer, grade: g, way: [], custom: q.custom ? { x: q.custom.x + 7 * (made + 1), z: q.custom.z } : null, fresh: false, auto: q.auto }; o.x += 5 * (made + 1); q.n -= part; q.hp -= part * hpPer; this.squads.push(o); made++; }
    // le reste : une escouade si ≥ 15, sinon en réserve
    if (q.n > part) { const rest = q.n - part; if (rest >= 15 && g !== 'escouade' && this.squads.length < SQUAD.maxSquads) { const k = rest - (rest % 15); for (let i = 0; i < k / 15; i++) { const o = { ...q, id: this.nextId++, num: 0, n: 15, hp: 15 * hpPer, grade: 'escouade', way: [], custom: null, fresh: false }; o.x += 5 * (made + 1); this.squads.push(o); made++; } q.n -= k; q.hp -= k * hpPer; }
      const left = q.n - part; if (left > 0) { this.reserve[q.type] += left; q.n -= left; q.hp -= left * hpPer; } }
    q.grade = g; this.layoutPosts(); return made;
  }
  // après chaque vague : la réserve complète les troupes autonomes ; les escouades autonomes d'un même type se regroupent en pelotons,
  // les pelotons en escadrons quand l'effectif le permet ; enfin la réserve restante forme de nouvelles troupes (le plus grand grade possible)
  autoForm(sim) {
    let formed = 0, filled = 0, merged = 0;
    for (const t of ['knight', 'heavy', 'cavalry', 'soldier']) {
      for (const q of this.squads) if (q.type === t && q.auto && this.reserve[t] > 0) filled += this.reinforce(q);
      for (const [from, to] of [['escouade', 'peloton'], ['peloton', 'escadron']]) {
        const pool = this.squads.filter(q => q.type === t && q.auto && q.mode === 'garrison' && q.grade === from);
        if (pool.length >= 2) { const head = pool.sort((a, b) => b.n - a.n)[0], before = this.squads.length; if (this.regroup(head, to, true)) merged += before - this.squads.length; }
      }
      while (this.squads.length < SQUAD.maxSquads) {
        const r = this.reserve[t], g = r >= 150 ? 'escadron' : r >= 50 ? 'peloton' : r >= 15 ? 'escouade' : null; if (!g) break;   // moins de 15 : ils restent en réserve
        const s = [2, 1, 3, 0, 4][this.squads.length % 5]; if (!this.formSquad(t, GRADES[g].size, s, g)) break; formed++;
      }
    }
    return { formed, filled, merged };
  }
  disband(q) { this.reserve[q.type] += q.n; this.squads.splice(this.squads.indexOf(q), 1); this.cleanGroups(); this.layoutPosts(); }
  setForm(q, f) { if (FORMATIONS[f]) q.form = f; }
  setStance(q, st) { q.stance = st; }
  garrison(q, s) { q.mode = 'garrison'; q.sector = s; q.custom = null; this.layoutPosts(); this.route(q, q.postX, q.postZ); }
  // ordre direct : un point touché sur la carte. Devant la muraille = sortie ; derrière = nouveau poste de garnison à cet endroit précis.
  moveTo(q, x, z) {
    if (z < WALL_Z0 + wallOff(x) - 1) return this.sortie(q, x, z);
    x = Math.min(196, Math.max(4, x)); z = Math.min(MOVE_Z1, Math.max(MOVE_Z0, z));
    q.mode = 'garrison'; q.sector = sectorOfX(x); q.custom = { x, z }; this.layoutPosts(); this.route(q, x, z);
  }
  sortie(q, x, z) {
    q.mode = 'field'; q.tx = Math.min(196, Math.max(4, x)); q.tz = Math.min(SQUAD.sortieZ[1], Math.max(SQUAD.sortieZ[0], z));
    this.layoutPosts(); this.route(q, q.tx, q.tz);
  }
  // les escouades franchissent la muraille par la PORTE (centre) : trajet intérieur ↔ extérieur
  route(q, tx, tz) {
    q.way = []; const inside = q.z > WALL_Z1 + wallOff(q.x), toOut = tz < WALL_Z0 + wallOff(tx), g = this.gateNear(q.x), gx = GATE_XS[g], go = wallOff(gx);
    if (inside && toOut) q.way.push({ x: gx, z: GARRISON_Z, gi: g }, { x: gx, z: WALL_Z0 + go - 4, gi: g });
    else if (!inside && !toOut) q.way.push({ x: gx, z: WALL_Z0 + go - 4, gi: g }, { x: gx, z: GARRISON_Z, gi: g });
    q.way.push({ x: tx, z: tz });
  }
  layoutPosts() {
    const idx = new Array(SECTORS).fill(null);
    for (const q of this.squads) {
      if (q.mode !== 'garrison') continue;
      if (q.custom) { q.postX = q.custom.x; q.postZ = q.custom.z; if (q.fresh) { q.x = q.px = q.postX; q.z = q.pz = q.postZ; q.fresh = false; } continue; }
      // postes côte à côte selon la taille de chaque troupe (un escadron prend plus de place qu'une escouade)
      const L = formationLayout(q.form, Math.max(1, q.n), UNITS[q.type].size), r = Math.max(3, L.radius) + 1, cur = idx[q.sector] || (idx[q.sector] = { x: q.sector * SECTOR_W + 1, z: GARRISON_Z, row: 0 });
      if (cur.x + 2 * r > (q.sector + 1) * SECTOR_W + 4 && cur.x > q.sector * SECTOR_W + 2) { cur.x = q.sector * SECTOR_W + 1; cur.z += cur.row + 1.5; cur.row = 0; }
      q.postX = cur.x + r; q.postZ = cur.z + r * 0.6 + (q.type === 'cavalry' ? 3 : 0); cur.x += 2 * r; cur.row = Math.max(cur.row, 2 * r * 0.6);
      if (q.fresh) { q.x = q.px = q.postX; q.z = q.pz = q.postZ; q.fresh = false; }
    }
    for (const q of this.squads) if (q.fresh) { q.x = q.px = 100; q.z = q.pz = GARRISON_Z; q.fresh = false; }
  }
  // dégâts reçus par une escouade (formation + armures)
  hurtSquad(sim, q, dmg, zi = -1) {
    if (q.hp <= 0) return;
    q.hp -= dmg * FORMATIONS[q.form].def * sim.eco.defMult(q.type) / this.rank(sim, q.type).res; q.hit = 0.3;
    const n0 = q.n; q.n = Math.max(0, Math.ceil(q.hp / this.unitHp(q.type)));
    // infirmerie : une partie des combattants tombés est relevée et retourne en réserve après soins
    const save = INFIRMARY.save[Math.min(3, sim.eco.level.infirmary || 0)], Z = sim.zombies, zt = zi >= 0 ? Z.type[zi] : -1;
    for (let k = q.n; k < n0; k++) {
      if (sim.extras) sim.extras.onSoldierDown(q); if (sim.fallenUnits && sim.fallenUnits.length < 80) { const a = sim.rng() * 6.28, r = Math.sqrt(sim.rng()) * q.rad; sim.fallenUnits.push({ x: q.x + Math.cos(a) * r, z: q.z + Math.sin(a) * r, type: q.type, rot: sim.rng() * 6.28 }); }
      // morsure (v2.4) : un mordeur peut mordre au lieu de tuer (debout ou en plongeant) ; un géant déchire sa proie
      if (zt >= 0 && INFECTION.biters.includes(zt) && sim.infection && sim.rng() < INFECTION.bite) { const tackle = sim.rng() < INFECTION.tackle; sim.infection.bite(sim, q, zi, tackle); Z.bite[zi] = tackle ? 1.1 : 0.75; Z.biteK[zi] = tackle ? 2 : 1; continue; }
      if (zt >= 0 && INFECTION.tearers.includes(zt)) { Z.bite[zi] = 2.2; Z.biteK[zi] = 3; sim.blast('tear', Z.x[zi] + Math.sin(Math.atan2(q.x - Z.x[zi], q.z - Z.z[zi])) * 2, Z.z[zi] + Math.cos(Math.atan2(q.x - Z.x[zi], q.z - Z.z[zi])) * 2, 1); sim.events.push({ type: 'torn', unit: q.type }); continue; }
      if (zt === 6 && !this._crushT) { this._crushT = 1; sim.blast('crush', q.x + (Z.x[zi] - q.x) * 0.3, q.z + (Z.z[zi] - q.z) * 0.3, 2.4); sim.events.push({ type: 'crushed', unit: q.type }); continue; }
      if (save && sim.rng() < save) { this.reserve[q.type]++; this.saved = (this.saved || 0) + 1; }
    }
    if (this._crushT) this._crushT = 0;
  }
  // soin (magicien) : rend une part des PV maximum ; les membres tombés ne reviennent pas
  healSquad(q, frac) { const mx = q.n * this.unitHp(q.type), before = q.hp; q.hp = Math.min(mx, q.hp + frac * mx); q.healed = 1; return q.hp - before; }
  hpRatio(q) { return q.n ? q.hp / (q.n * this.unitHp(q.type)) : 1; }
  // ——— tick ———
  update(dt, sim) {
    const Z = sim.zombies, hash = sim.hash, eco = sim.eco, w = eco.up.weapons, ar = eco.up.archery;
    this.trainTick(dt, sim); this.syncWalkers(sim); this.updateGate(dt); this.numberSquads();
    // archers
    const AU = UNITS.archer, range = (AU.range + 3 * ar) * (sim.extras ? sim.extras.rangeMult() : 1), adm = AU.dmg * eco.atkMult('archer') * this.rank(sim, 'archer').force;
    const assault = sim.phase === 'assault';
    for (let s = 0; s < SECTORS; s++) {
      const a = this.archers[s], nightR = sim.night ? sim.night.rangeMult(s) : 1, bless = sim.priest ? sim.priest.blessMult(sim, s) : 1;   // bénédiction du prêtre
      for (let k = 0; k < a.n; k++) {
        if (a.prog[k] < 1e8) { const len = archerPose(s, k, a.prog[k]).len; a.prog[k] += ARCHER_SPEED * dt; if (a.prog[k] >= len) a.prog[k] = 1e9; continue; }   // encore en train de monter
        a.cd[k] -= dt; if (a.cd[k] > 0) continue;
        const p = archerPos(s, k), rg = range * nightR, m = hash.query(p.x, p.z, rg, Z.x, Z.z, tmp);
        let best = -1, bd = -Infinity, near = -1, nd = 64;   // (v11.1) le plus dangereux pour le royaume, sauf un zombie tout proche
        for (let q = 0; q < m; q++) { const i = tmp[q]; if (Z.hp[i] <= 0 || (assault && Z.turned[i])) continue; const d2 = (Z.x[i] - p.x) ** 2 + (Z.z[i] - p.z) ** 2; if (d2 < nd) { nd = d2; near = i; } const sc = threatOf(Z, i) / (1 + Math.sqrt(d2) / 30); if (sc > bd) { bd = sc; best = i; } }   // pendant l'assaut, ils restent concentrés sur la vague
        if (near >= 0) best = near;
        if (best < 0) { a.cd[k] = 0.25; continue; }
        const fire = eco.up.fireArrows && sim.rng() < UPGRADES.fireArrows.per * eco.up.fireArrows;      // flèche enflammée : le sol prend feu à l'impact
        Z.hit(best, adm * bless * (fire ? 1.25 : 1)); if (sim.arrows.length < 220) sim.arrows.push({ x0: p.x, z0: p.z, x1: Z.x[best], z1: Z.z[best], t: 0, fire });
        if (fire && sim.fires.length < 60) sim.fires.push({ x: Z.x[best], z: Z.z[best], r: 1.8, t: 2.6, small: true });
        a.cd[k] = AU.rate * (0.9 + sim.rng() * 0.2);
      }
    }
    // un soldat transformé dans le royaume : hors assaut, quelques archers (les 3 plus proches) s'en aperçoivent et le prennent pour cible
    if (!assault) for (let i = 0; i < Z.n; i++) {
      if (!Z.turned[i] || Z.hp[i] <= 0) continue; const cand = [];
      for (let s = 0; s < SECTORS; s++) { const a = this.archers[s]; for (let k = 0; k < a.n; k++) { if (a.prog[k] < 1e8 || a.cd[k] > 0) continue; const p = archerPos(s, k), d = Math.hypot(p.x - Z.x[i], p.z - Z.z[i]); if (d < 95) cand.push([d, s, k, p]); } }
      cand.sort((u, v) => u[0] - v[0]);
      for (const [, s, k, p] of cand.slice(0, 3)) { Z.hit(i, adm); if (sim.arrows.length < 220) sim.arrows.push({ x0: p.x, z0: p.z, x1: Z.x[i], z1: Z.z[i], t: 0 }); this.archers[s].cd[k] = AU.rate * (1 + sim.rng() * 0.3); }
    }
    // escouades
    for (const q of this.squads) this.updateSquad(q, dt, sim, w);
    // infirmerie : les escouades en garnison, hors combat, regagnent des PV (jusqu'au maximum de leurs membres restants)
    const ih = INFIRMARY.heal[Math.min(3, eco.level.infirmary || 0)];
    if (ih) for (const q of this.squads) { if (q.mode !== 'garrison' || q.fight > 0 || q.way.length) continue; const mx = q.n * this.unitHp(q.type); if (q.hp < mx) { q.hp = Math.min(mx, q.hp + ih * mx * dt); q.infirm = 0.5; } }
    const before = this.squads.length;
    this.squads = this.squads.filter(q => q.hp > 0);
    if (this.squads.length !== before) { this.layoutPosts(); this.cleanGroups(); }
    // préparation du tick suivant pour les zombies : escouades à l'extérieur, compteurs de contact remis à zéro
    this.outside.length = 0;
    for (const q of this.squads) { q.attackers = 0; q.cap = Math.ceil(FORMATIONS[q.form].contact * q.n); if (q.z < WALL_Z0 + wallOff(q.x)) this.outside.push(q); }
  }
  updateSquad(q, dt, sim, weaponsLvl) {
    const Z = sim.zombies, hash = sim.hash, U = UNITS[q.type], F = FORMATIONS[q.form];
    q.px = q.x; q.pz = q.z; if (q.hit > 0) q.hit -= dt; if (q.fight > 0) q.fight -= dt; if (q.healed > 0) q.healed -= dt; if (q.infirm > 0) q.infirm -= dt; if (q.swing > 0) q.swing -= dt;
    const L = formationLayout(q.form, Math.max(1, q.n), U.size), rad = L.radius; q.rad = rad;
    const rk = this.rank(sim, q.type), speed = Math.min((U.speed || 3.4) * F.speed * rk.speed, q.way.length && q.capSpeed ? q.capSpeed * rk.speed : Infinity);   // en groupe : à l'allure du plus lent
    if (!q.way.length) q.capSpeed = 0;
    let moving = false;
    const step = (tx, tz) => { const dx = tx - q.x, dz = tz - q.z, d = Math.hypot(dx, dz); if (d < 0.05) return true; const st = Math.min(d, speed * dt); q.x += dx / d * st; q.z += dz / d * st; moving = true; return d <= st + 0.01; };
    // ordre explicite : suivre le trajet ; devant la porte, on attend qu'elle soit ouverte
    const gw = q.way[0], viaGate = !!gw && gw.gi !== undefined;
    if (viaGate) this.gateReq[gw.gi] = 1;
    GATE_XS.forEach((gx, g) => { if (Math.abs(q.x - gx) < q.rad + 8 && q.z > WALL_Z0 + wallOff(gx) - 9 && q.z < WALL_Z1 + wallOff(gx) + 9) this.gateReq[g] = 1; });       // encore dans le passage : on garde la porte ouverte
    if (q.way.length) { const wait = viaGate && this.gate[gw.gi] < 0.7 && Math.abs(q.z - 146) < 22 && Math.abs(q.z - 146) > 5; if (!wait && step(q.way[0].x, q.way[0].z)) q.way.shift(); }
    // cibles à portée de coups
    const reach = rad + (U.reach || 2) + 0.6, m = hash.query(q.x, q.z, reach, Z.x, Z.z, tmp);
    let live = 0; for (let k = 0; k < m; k++) if (Z.hp[tmp[k]] > 0) tmp[live++] = tmp[k];
    if (!q.way.length) {
      if (q.mode === 'garrison') {
        // défend l'intérieur du secteur : poursuit les zombies entrés (à portée de laisse), puis retourne à son poste
        let best = -1, bd = Infinity; const mm = hash.query(q.postX, q.postZ, SQUAD.garrisonLeash, Z.x, Z.z, tmp2);
        for (let k = 0; k < mm; k++) { const i = tmp2[k]; if (Z.hp[i] <= 0 || Z.z[i] < WALL_Z1 + wallOff(Z.x[i]) + 0.8) continue; const d = (Z.x[i] - q.x) ** 2 + (Z.z[i] - q.z) ** 2; if (d < bd) { bd = d; best = i; } }
        if (best < 0) { // personne près du poste : intercepte les intrus plus loin à l'intérieur
          const m3 = hash.query(q.x, q.z, SQUAD.intercept, Z.x, Z.z, tmp2);
          for (let k = 0; k < m3; k++) { const i = tmp2[k]; if (Z.hp[i] <= 0 || Z.z[i] < WALL_Z1 + wallOff(Z.x[i]) + 0.8) continue; const d = (Z.x[i] - q.x) ** 2 + (Z.z[i] - q.z) ** 2; if (d < bd) { bd = d; best = i; } }
        }
        if (best >= 0 && live === 0 && !U.range) step(Z.x[best], Z.z[best]); else if (best < 0 || U.range) step(q.postX, q.postZ);
      } else if (q.stance === 'charge' && live === 0 && !U.range) {
        // (v11.1) d'abord ce qui barre le passage (tout proche), sinon le zombie le plus DANGEREUX pour le royaume à portée de charge
        let best = -1, bd = -Infinity, near = -1, nd = SQUAD.aggro * SQUAD.aggro; const mm = hash.query(q.x, q.z, SQUAD.chargeRange * 1.6, Z.x, Z.z, tmp2);
        for (let k = 0; k < mm; k++) { const i = tmp2[k]; if (Z.hp[i] <= 0 || Z.z[i] > WALL_Z0 + wallOff(Z.x[i]) - 2) continue; const d2 = (Z.x[i] - q.x) ** 2 + (Z.z[i] - q.z) ** 2; if (d2 < nd) { nd = d2; near = i; } const sc = threatOf(Z, i) / (1 + Math.sqrt(d2) / 20); if (sc > bd) { bd = sc; best = i; } }
        if (near >= 0) best = near; if (best >= 0) step(Z.x[best], Z.z[best]);
      } else if (live === 0 && !U.range) { const mm = hash.query(q.x, q.z, SQUAD.aggro, Z.x, Z.z, tmp2); let near = -1, nd = Infinity; for (let k = 0; k < mm; k++) { const i = tmp2[k]; if (Z.hp[i] <= 0) continue; const d2 = (Z.x[i] - q.x) ** 2 + (Z.z[i] - q.z) ** 2; if (d2 < nd) { nd = d2; near = i; } } if (near >= 0) step(Z.x[near], Z.z[near]); else step(q.tx, q.tz); }   // tenir : ne repousse que ce qui arrive sur elle, puis revient à sa place
    }
    // élan (charge) : actif tant que l'escouade vient de se déplacer
    q.mom = moving ? 1 : Math.max(0, q.mom - dt * 0.6);
    if (U.range) {   // (v11.1) troupe d'ARCHERS : tir de loin sur le plus dangereux (ou sur ce qui s'approche trop), jamais au corps à corps
      const rg = (U.range + 3 * sim.eco.up.archery) * (sim.extras ? sim.extras.rangeMult() : 1), mm = hash.query(q.x, q.z, rg, Z.x, Z.z, tmp2);
      let best = -1, bd = -Infinity, near = -1, nd = 100;
      for (let k = 0; k < mm; k++) { const i = tmp2[k]; if (Z.hp[i] <= 0) continue; const d2 = (Z.x[i] - q.x) ** 2 + (Z.z[i] - q.z) ** 2; if (d2 < nd) { nd = d2; near = i; } const sc = threatOf(Z, i) / (1 + Math.sqrt(d2) / 30); if (sc > bd) { bd = sc; best = i; } }
      if (near >= 0) best = near;
      if (best >= 0) { q.fight = 0.5; q.atkAcc += q.n * dt / U.rate * (moving ? 0.5 : 1); let hits = q.atkAcc | 0; q.atkAcc -= hits; const dm = U.dmg * sim.eco.atkMult('archer') * rk.force;
        let shown = 0; while (hits-- > 0) { const i = best >= 0 && Z.hp[best] > 0 ? best : tmp2[(q.rot++) % Math.max(1, mm)]; if (i === undefined || Z.hp[i] <= 0) break; Z.hit(i, dm); if (shown++ < 2 && sim.arrows.length < 220) sim.arrows.push({ x0: q.x, z0: q.z, x1: Z.x[i], z1: Z.z[i], t: 0 }); } }
      return;
    }
    if (live > 0) {
      q.fight = 0.5;
      const mult = F.atk * (1 + (F.charge + (U.charge || 0)) * q.mom) * sim.eco.atkMult(q.type) * rk.force * (moving ? 0.5 : 1) * (sim.extras ? sim.extras.squadMult(q) : 1);
      q.atkAcc += q.n * F.engage * dt / U.rate;
      let hits = q.atkAcc | 0; q.atkAcc -= hits;
      const cleave = (U.cleave || 1) + (q.type === 'knight' ? (sim.eco.smith.atk.knight / 2) | 0 : 0), km = 1;
      while (hits-- > 0) { for (let c = 0; c < Math.min(cleave, live); c++) { const i = tmp[q.rot++ % live]; Z.hit(i, U.dmg * mult * km * (c ? 0.6 : 1)); } if (cleave > 1) q.swing = 0.45; }
    }
  }
  // ——— sauvegarde ———
  serialize() {
    return {
      reserve: { ...this.reserve }, archers: this.archers.map(a => a.n), nextId: this.nextId, rally: { ...this.rally },
      groups: this.groups.map(g => ({ id: g.id, face: g.face, form: g.form, ax: g.ax, az: g.az })), nextGid: this.nextGid,
      squads: this.squads.map(q => ({ id: q.id, num: q.num || 0, gid: q.gid || 0, face: q.face ?? null, type: q.type, n: q.n, hp: Math.round(q.hp), form: q.form, grade: q.grade, mode: q.mode, sector: q.sector, x: +q.x.toFixed(2), z: +q.z.toFixed(2), tx: q.tx, tz: q.tz, stance: q.stance, custom: q.custom || null, auto: q.auto })), autoArchers: this.autoArchers,
      queues: Object.fromEntries(TRAIN_BUILDINGS.map(b => [b, this.queues[b].map(i => ({ type: i.type, t: +i.t.toFixed(2), full: i.full }))])),
    };
  }
  restore(st) {
    Object.assign(this.reserve, { knight: 0 }, st.reserve); this.nextId = st.nextId || 1; this.autoArchers = st.autoArchers !== false;
    for (let s = 0; s < SECTORS; s++) { this.archers[s].n = st.archers[s]; this.archers[s].cd.fill(0.3); this.archers[s].prog.fill(1e9); }
    if (st.rally) { this.rally.x = st.rally.x; this.rally.z = st.rally.z; } this.walkers = [];
    this.squads = [];
    for (const o of st.squads) { const q = this.formSquadRaw(o); this.squads.push(q); }
    this.groups = (st.groups || []).map(g => ({ ...g })); this.nextGid = st.nextGid || 1; this.cleanGroups();
    this.layoutPosts(); this.numberSquads();
    for (const q of this.squads) { const o = st.squads.find(s => s.id === q.id); q.x = q.px = o.x; q.z = q.pz = o.z; q.fresh = false; if (o.mode === 'field') this.route(q, o.tx, o.tz); else this.route(q, q.postX, q.postZ); }
    for (const b of TRAIN_BUILDINGS) this.queues[b] = (st.queues?.[b] || []).map(i => ({ ...i }));
  }
  formSquadRaw(o) { return { id: o.id, num: o.num || 0, gid: o.gid || 0, face: o.face ?? undefined, type: o.type, n: o.n, grade: o.grade || gradeFor(o.n), hp: o.hp, form: o.form, mode: o.mode, sector: o.sector, x: o.x, z: o.z, px: o.x, pz: o.z, postX: 0, postZ: 0, tx: o.tx, tz: o.tz, custom: o.custom || null, auto: o.auto !== false, way: [], stance: o.stance || 'hold', atkAcc: 0, rot: 0, mom: 0, attackers: 0, cap: 0, hit: 0, fresh: false, rad: 3 }; }
}
