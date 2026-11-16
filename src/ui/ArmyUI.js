// (v11) Savoir qui est où : chaque troupe a un NUMÉRO et une COULEUR (fanion, mini-carte, listes), un REGISTRE de l'armée
// toujours à portée (bouton 🎌 sous la mini-carte), la caméra qui SUIT une troupe, le passage d'une troupe à l'autre (Tab),
// un drapeau de RÉSERVE au point de ralliement, et des messages qui disent où vont les recrues.
import { SECTORS, SECTOR_AT, SECTOR_NAMES, SECTOR_W, PLAZA, WALL_Z1, wallOff } from '../sim/constants.js';
import { UNITS, UNIT_ORDER, FORMATIONS, GRADES } from '../content/medieval.js';
import { TRAIN_BUILDINGS, SQUAD_CAP } from '../sim/army.js';

export const SQ_COLORS = ['#3d7bd6', '#d6453d', '#2fa35a', '#d99a1e', '#8a4fd1', '#1fa3a3', '#d6589a', '#6f8a1f', '#c46a2c', '#4a5fd1', '#9a3a3a', '#2b7a8a'];
export const sqColor = q => SQ_COLORS[((q.num || 1) - 1) % SQ_COLORS.length];
const FIGHTERS = ['soldier', 'heavy', 'knight', 'cavalry'];
const side = x => x < 70 ? 'à gauche' : x > 130 ? 'à droite' : 'au centre';

export function installArmyUI(UI) {
  const P = UI.prototype;
  // lieu en clair : « champ de bataille, devant la grande porte », « cour, derrière le mur gauche », « placette », « village »
  P.whereName = function (x, z) {
    const s = Math.max(0, Math.min(SECTORS - 1, (x / SECTOR_W) | 0)), wz = 146 + wallOff(x);
    if (z < wz - 5) return `champ de bataille, devant ${SECTOR_AT[s]}`;
    if (z < wz + 5) return `sur la muraille (${SECTOR_NAMES[s].toLowerCase()})`;
    if (z < PLAZA.z - PLAZA.hd - 2) return `cour, derrière ${SECTOR_AT[s]}`;
    if (z < PLAZA.z + PLAZA.hd + 3 && Math.abs(x - PLAZA.x) < PLAZA.hw + 6) return 'placette';
    return `village, ${side(x)}`;
  };
  // où est une troupe, et où elle va
  P.squadWhere = function (q) {
    const last = q.way && q.way.length ? q.way[q.way.length - 1] : null, dest = last ? (Array.isArray(last) ? { x: last[0], z: last[1] } : { x: last.x, z: last.z }) : null;
    const here = this.whereName(q.x, q.z), fight = q.mode === 'field' && q.fight > 0;
    return { here, dest: dest && Number.isFinite(dest.x) ? this.whereName(dest.x, dest.z) : null, fight, txt: fight ? `⚔ au combat · ${here}` : dest ? `🚶 ${here} → ${this.whereName(dest.x, dest.z)}` : `${q.mode === 'field' ? '⚔' : '🛡'} ${here}` };
  };
  P.numChip = function (q) { return `<em class="sqn" style="background:${sqColor(q)}">${q.num || '?'}</em>`; };
  // ——— registre de l'armée ———
  P.buildRoster = function () {
    const b = document.createElement('button'); b.id = 'b-roster'; b.title = 'Registre de l\'armée : qui est où (touche G)'; b.innerHTML = '🎌<span>Troupes</span>';
    b.addEventListener('click', () => this.toggleRoster()); document.getElementById('app').appendChild(b); this.rosterBtn = b;
    const p = document.createElement('div'); p.id = 'roster'; document.getElementById('app').appendChild(p); this.rosterEl = p; this.rosterF = 'all';
    p.addEventListener('click', e => { const t = e.target.closest('[data-r]'); if (!t) return; e.stopPropagation(); this.rosterAct(t.dataset.r); });
    this.cam.onUser = () => { if (this.followId) this.setFollow(0); };
    this.cam.onLongPress = (sx, sy, w, force) => this.longPress(sx, sy, w, force); this.cam.onGesture = (k, sx, sy, w) => this.gestureStep(k, sx, sy, w);
  };
  P.toggleRoster = function (on) {
    this.rosterOn = on ?? !this.rosterOn; this.rosterEl.classList.toggle('on', this.rosterOn); this.rosterBtn.classList.toggle('on', this.rosterOn);
    if (this.rosterOn) { if (this.sheet) this.closeSheet(); this.rosterKey = ''; this.renderRoster(); }
  };
  P.rosterAct = function (a) {
    const [k, v] = a.split(':'), sim = this.sim;
    if (k === 'f') { this.rosterF = v; this.rosterKey = ''; this.renderRoster(); return; }
    if (k === 'sq') { const q = sim.squad(+v); if (q) { this.cam.focusOn(q.x, q.z); this.openSquad(q.id); } return; }
    if (k === 'follow') { this.setFollow(+v === this.followId ? 0 : +v); return; }
    if (k === 'sec') { this.cam.focusOn(+v * 40 + 20, 150); this.openCard({ kind: 'sector', id: +v }); return; }
    if (k === 'rally') { const r = sim.army.rally; this.cam.focusOn(r.x, r.z); return; }
    if (k === 'form') { this.toggleRoster(false); this.openSheet('army', 'newsq'); return; }
    if (k === 'train') { this.toggleRoster(false); this.openSheet('army', 'train'); return; }
    if (k === 'cyc') { this.cycleSquad(+v); return; }
    if (k === 'close') this.toggleRoster(false);
  };
  P.renderRoster = function () {
    if (!this.rosterOn) return; const sim = this.sim, A = sim.army, f = this.rosterF;
    const list = A.squads.filter(q => q.n > 0 && (f === 'all' || q.type === f)).sort((a, b) => (b.mode === 'field') - (a.mode === 'field') || (a.num || 0) - (b.num || 0));
    const queued = {}; for (const b of TRAIN_BUILDINGS) for (const it of A.queues[b] || []) queued[it.type] = (queued[it.type] || 0) + 1;
    const res = UNIT_ORDER.filter(t => A.reserve[t] > 0), arch = A.archers.map(a => a.n), archT = arch.reduce((x, y) => x + y, 0);
    const types = ['all', ...FIGHTERS.filter(t => A.squads.some(q => q.type === t)), 'archer'];
    let h = `<div class="rh"><b>🎌 Qui est où ?</b><button class="rx" data-r="close">✕</button></div>`;
    h += `<div class="rf">${types.map(t => `<button class="${f === t ? 'on' : ''}" data-r="f:${t}">${t === 'all' ? 'Tout' : UNITS[t].ico}</button>`).join('')}</div>`;
    if (f !== 'archer') {
      h += list.length ? list.map(q => { const U = UNITS[q.type], w = this.squadWhere(q), hp = Math.max(0, Math.min(1, A.hpRatio(q))), fol = this.followId === q.id;
        return `<div class="rr${this.card?.kind === 'squad' && this.card.id === q.id ? ' sel' : ''}${hp < 0.4 ? ' hurt' : ''}" data-r="sq:${q.id}">${this.numChip(q)}<div class="rt"><b>${U.ico} ${this.unitName(q)} <small>${q.n}</small></b><small>${w.txt}</small><i class="hb"><i style="width:${Math.round(hp * 100)}%;background:${sqColor(q)}"></i></i></div><button class="rfo${fol ? ' on' : ''}" data-r="follow:${q.id}" title="La caméra suit cette troupe">🎥</button></div>`; }).join('')
        : `<div class="hint small">${f === 'all' ? 'Aucune troupe formée.' : 'Aucune troupe de ce type.'} Les recrues attendent en réserve (15 pour une escouade).</div>`;
    }
    if (f === 'all' || f === 'archer') h += `<div class="rgl">🏹 <b>Archers sur la muraille : ${archT}</b>${A.reserve.archer ? ` · ${A.reserve.archer} en réserve` : ''}</div><div class="rsec">${arch.map((n, s) => `<button data-r="sec:${s}" class="${n ? '' : 'none'}"><small>${SECTOR_NAMES[s]}</small><b>${n}</b></button>`).join('')}</div>`;
    const resF = res.filter(t => t !== 'archer' && (f === 'all' || f === t));
    if (resF.length) h += `<div class="rgl click" data-r="rally">🚩 <b>Réserve</b> (${this.whereName(A.rally.x, A.rally.z)}) : ${resF.map(t => `${UNITS[t].ico} ${A.reserve[t]}`).join(' · ')}<span class="go">›</span></div>${resF.some(t => A.reserve[t] >= 15) ? `<button class="act slim rbtn" data-r="form">➕ Former une troupe avec la réserve</button>` : ''}`;
    const qT = Object.keys(queued).filter(t => f === 'all' || f === t);
    if (qT.length) h += `<div class="rgl click" data-r="train">⏳ <b>En formation</b> : ${qT.map(t => `${UNITS[t].ico} ${queued[t]}`).join(' · ')} <small>→ ${this.whereName(A.rally.x, A.rally.z)}</small><span class="go">›</span></div>`;
    if (A.squads.length > 1) h += `<div class="rcy"><button data-r="cyc:-1">‹ Précédente</button><button data-r="cyc:1">Suivante ›</button></div>`;
    if (h !== this.rosterKey) { this.rosterKey = h; const sc = this.rosterEl.scrollTop; this.rosterEl.innerHTML = h; this.rosterEl.scrollTop = sc; }
  };
  // passer d'une troupe à l'autre (Tab / Maj+Tab, ou ‹ › du registre)
  P.cycleSquad = function (dir = 1) {
    const L = this.sim.army.squads.filter(q => q.n > 0).sort((a, b) => (a.num || 0) - (b.num || 0)); if (!L.length) { this.toast('Aucune troupe formée', 'info'); return; }
    const cur = this.card?.kind === 'squad' ? L.findIndex(q => q.id === this.card.id) : -1, q = L[((cur < 0 ? (dir > 0 ? -1 : 0) : cur) + dir + L.length) % L.length];
    this.cam.focusOn(q.x, q.z); this.openSquad(q.id); if (this.followId) this.setFollow(q.id);
  };
  // la caméra suit une troupe (jusqu'à ce qu'on fasse glisser la carte)
  P.setFollow = function (id) {
    const sim = this.sim; this.followId = id || 0;
    this.cam.follow = id ? () => { const q = sim.squad(id); return q ? { x: q.x, z: q.z } : null; } : null;
    let pill = document.getElementById('followpill');
    if (!pill) { pill = document.createElement('button'); pill.id = 'followpill'; pill.addEventListener('click', () => this.setFollow(0)); document.getElementById('app').appendChild(pill); }
    const q = id && sim.squad(id); pill.classList.toggle('on', !!q); if (q) pill.innerHTML = `🎥 Suit ${this.numChip(q)} ${UNITS[q.type].ico} ${this.unitName(q)} <b>✕</b>`;
    this.rosterKey = ''; this.html.card = '';
  };
  // ——— drapeau de la réserve au point de ralliement ———
  P.reserveFlag = function (vw, vh) {
    const A = this.sim.army; let e = this.rflag; const t = UNIT_ORDER.filter(k => A.reserve[k] > 0 && k !== 'archer');
    const on = t.length && !this.sheet && this.mode === 'idle' && !document.body.classList.contains('fpv'); const p = on ? this.rd.project(A.rally.x, 4.5, A.rally.z - 4) : null;
    if (!on || !p.vis || p.x < 10 || p.x > vw - 10 || p.y < 100 || p.y > vh - 100) { if (e) e.style.display = 'none'; return; }
    if (!e) { e = this.rflag = document.createElement('button'); e.className = 'rflag'; e.title = 'Réserve : les recrues attendent ici'; e.addEventListener('click', ev => { ev.stopPropagation(); this.toggleRoster(true); }); document.getElementById('app').appendChild(e); }
    const txt = '🚩 Réserve ' + t.map(k => `${UNITS[k].ico}${A.reserve[k]}`).join(' '); if (e.dataset.t !== txt) { e.dataset.t = txt; e.textContent = txt; }
    e.style.display = ''; e.style.left = p.x + 'px'; e.style.top = p.y + 'px';
  };
  // recrues formées : un message groupé qui dit OÙ elles attendent et ce qu'il manque pour une troupe
  P.trainedEvent = function (e) {
    if (e.into) { const q = this.sim.squad(e.into); if (q && q.n % 10 === 0) this.toast(`📥 ${UNITS[q.type].ico} Troupe ${q.num} : ${q.n}/150`, 'ok'); return; }
    const T = this.trainAcc || (this.trainAcc = {}); T[e.unit] = (T[e.unit] || 0) + 1; clearTimeout(this.trainTo);
    this.trainTo = setTimeout(() => {
      const A = this.sim.army, parts = Object.keys(T).map(t => `${UNITS[t].ico} ${T[t]} ${UNITS[t].name.toLowerCase()}${T[t] > 1 ? 's' : ''}`), where = this.whereName(A.rally.x, A.rally.z);
      const t0 = Object.keys(T)[0], r = A.reserve[t0] || 0, more = t0 === 'archer' ? (A.autoArchers ? ' : ils montent sur la muraille' : '') : r >= 15 ? ` · réserve ${r} : de quoi former une troupe (🎌)` : ` · réserve ${r}/15 pour une escouade`;
      this.toast(`${parts.join(', ')} prêt${Object.values(T).reduce((a, b) => a + b, 0) > 1 ? 's' : ''} → ${where}${more}`, 'ok'); this.trainAcc = {};
    }, 1400);
  };

  // ——— (v11.1) gestes sur la carte : appui long sur une troupe = la faire pivoter ; appui long ailleurs (ou Maj+glisser) = rectangle de sélection ———
  P.longPress = function (sx, sy, w, force) {
    if (this.mode !== 'idle' || this.deploy || this.order || this.rallying || this.roadMode || this.trapMode || !w) return null;
    const id = force === 'lasso' ? 0 : this.squadAt(w.x, w.z);
    if (id) { const q = this.sim.squad(id); this.rotQ = id; this.closeCard(); this.gfx('rotate', { q, sx, sy }); return 'rotate'; }
    this.lasso = { x0: sx, y0: sy, x1: sx, y1: sy }; this.gfx('lasso'); return 'lasso';
  };
  P.gestureStep = function (k, sx, sy, w) {
    const sim = this.sim;
    if (this.lasso) {
      const L = this.lasso; L.x1 = sx; L.y1 = sy; this.gfx('lasso');
      if (k === 'end') { this.lasso = null; this.gfx('none'); this.lassoSelect(Math.min(L.x0, L.x1), Math.min(L.y0, L.y1), Math.max(L.x0, L.x1), Math.max(L.y0, L.y1)); }
      else if (k === 'cancel') { this.lasso = null; this.gfx('none'); }
      return;
    }
    if (this.rotQ) {
      const q = sim.squad(this.rotQ); if (!q) { this.rotQ = 0; this.gfx('none'); return; }
      const g = sim.army.groupOf(q), c = g && g.ax != null ? { x: g.ax, z: g.az } : sim.army.destOf(q);
      this.gfx('rotate', { q, c, sx, sy });
      if (k === 'end' && w) { const face = Math.atan2(w.x - c.x, w.z - c.z); if (Math.hypot(w.x - c.x, w.z - c.z) > 1.5) { sim.army.rotate(q, face); this.toast(`↻ ${g ? 'Groupe' : 'Troupe'} ${q.num} : ${this.dirName(face)}`, 'info'); this.buzz(12); } }
      if (k === 'end' || k === 'cancel') { this.rotQ = 0; this.gfx('none'); }
    }
  };
  P.dirName = function (face) { const n = ['vers le sud', 'vers le sud-est', 'vers l\'est', 'vers le nord-est', 'vers le nord (les zombies)', 'vers le nord-ouest', 'vers l\'ouest', 'vers le sud-ouest']; return 'regarde ' + n[((Math.round(face / (Math.PI / 4)) % 8) + 8) % 8]; };
  // dessin des gestes (rectangle, flèche d'orientation) : un calque SVG au-dessus de la carte
  P.gfx = function (kind, o = {}) {
    let el = this.gfxEl; if (!el) { el = this.gfxEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); el.id = 'gesture'; document.getElementById('app').appendChild(el); }
    if (kind === 'none') { el.innerHTML = ''; el.classList.remove('on'); return; }
    el.classList.add('on');
    if (kind === 'lasso') { const L = this.lasso; if (!L) return; const x = Math.min(L.x0, L.x1), y = Math.min(L.y0, L.y1); el.innerHTML = `<rect x="${x}" y="${y}" width="${Math.abs(L.x1 - L.x0)}" height="${Math.abs(L.y1 - L.y0)}" class="las"/>`; return; }
    if (kind === 'rotate') { const q = o.q, c = o.c || this.sim.army.destOf(q), p = this.rd.project(c.x, 0.5, c.z), tx = o.sx ?? p.x, ty = o.sy ?? p.y - 60, a = Math.atan2(ty - p.y, tx - p.x), len = Math.max(40, Math.hypot(tx - p.x, ty - p.y)), ex = p.x + Math.cos(a) * len, ey = p.y + Math.sin(a) * len;
      const h1x = ex - Math.cos(a - 0.45) * 22, h1y = ey - Math.sin(a - 0.45) * 22, h2x = ex - Math.cos(a + 0.45) * 22, h2y = ey - Math.sin(a + 0.45) * 22;
      el.innerHTML = `<circle cx="${p.x}" cy="${p.y}" r="26" class="rc"/><line x1="${p.x}" y1="${p.y}" x2="${ex}" y2="${ey}" class="ra"/><polygon points="${ex},${ey} ${h1x},${h1y} ${h2x},${h2y}" class="rh"/><text x="${p.x}" y="${p.y - 34}" class="rt">Glisse : où regarderont les soldats</text>`; }
  };
  // ——— sélection multiple (rectangle, double toucher) : on fusionne, on garde un seul type, ou on annule ———
  P.lassoSelect = function (x0, y0, x1, y1) {
    const sim = this.sim, A = sim.army, ids = [], res = {}, inR = p => p.vis && p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
    for (const q of A.squads) if (q.n > 0 && inR(this.rd.project(q.x, 1, q.z))) ids.push(q.id);
    for (const w of A.walkers) if (inR(this.rd.project(w.x, 1, w.z))) res[w.type] = (res[w.type] || 0) + 1;
    for (const t in res) res[t] = Math.min(res[t], A.reserve[t] | 0);
    if (!ids.length && !Object.values(res).some(Boolean)) { this.toast('Aucune troupe dans le rectangle', 'info'); return; }
    this.setMulti(ids, res);
  };
  P.selectSameType = function (id) {
    const A = this.sim.army, q0 = this.sim.squad(id); if (!q0) return;
    const ids = A.squads.filter(q => q.type === q0.type && q.n > 0).map(q => q.id), res = {}; if (A.reserve[q0.type] > 0 && q0.type !== 'archer') res[q0.type] = A.reserve[q0.type];
    this.closeCard(); this.setMulti(ids, res); this.toast(`${UNITS[q0.type].ico} Toutes les troupes de ${UNITS[q0.type].name.toLowerCase()}s sont sélectionnées`, 'info');
  };
  // double toucher sur une troupe : toutes les troupes du même type
  P.dblTap = function (id) { const now = performance.now(), L = this.lastTapSq; this.lastTapSq = { id, t: now }; if (L && L.id === id && now - L.t < 420) { this.lastTapSq = null; this.selectSameType(id); return true; } return false; };
  P.setMulti = function (ids, res = {}) { this.msel = ids.length || Object.values(res).some(Boolean) ? { ids: new Set(ids), res } : null; this.renderMulti(); };
  P.renderMulti = function () {
    let b = this.selBar; if (!b) { b = this.selBar = document.createElement('div'); b.id = 'selbar'; document.getElementById('app').appendChild(b); b.addEventListener('click', e => { const t = e.target.closest('[data-m]'); if (t) { e.stopPropagation(); this.multiAct(t.dataset.m); } }); }
    const M = this.msel, A = this.sim.army; if (!M) { b.classList.remove('on'); return; }
    for (const id of [...M.ids]) if (!this.sim.squad(id)) M.ids.delete(id);
    const by = {}; for (const id of M.ids) { const q = this.sim.squad(id); (by[q.type] ||= { n: 0, k: 0 }); by[q.type].n += q.n; by[q.type].k++; }
    for (const t in M.res) if (M.res[t] > 0) { (by[t] ||= { n: 0, k: 0 }); by[t].n += M.res[t]; by[t].r = M.res[t]; }
    const types = Object.keys(by), tot = types.reduce((a, t) => a + by[t].n, 0), many = M.ids.size + Object.values(M.res).filter(Boolean).length;
    if (!types.length) { this.msel = null; b.classList.remove('on'); return; }
    b.classList.add('on');
    b.innerHTML = `<div class="st"><b>Sélection · ${tot} hommes</b><small>${types.length > 1 ? 'touche un type pour ne garder que lui' : 'double toucher = tout ce type · appui long ailleurs = rectangle'}</small></div>
      <div class="sc">${types.map(t => `<button data-m="keep:${t}" title="Ne garder que ce type">${UNITS[t].ico} ${by[t].n}${by[t].k ? ` <small>${by[t].k} tr.</small>` : ''}${by[t].r ? ' <small>réserve</small>' : ''}</button>`).join('')}</div>
      <div class="sa"><button class="act slim" data-m="merge"${many < 1 ? ' disabled' : ''}>🔗 ${types.length > 1 ? 'Former un groupe' : many > 1 ? 'Fusionner' : 'Former la troupe'}<small>${types.length > 1 ? 'disposé en tacticien' : `jusqu'à ${SQUAD_CAP} par troupe`}</small></button><button class="act slim sec" data-m="clear">✕</button></div>`;
  };
  P.multiAct = function (a) {
    const [k, t] = a.split(':'), M = this.msel, A = this.sim.army; if (!M) return;
    if (k === 'clear') { this.setMulti([]); return; }
    if (k === 'keep') { M.ids = new Set([...M.ids].filter(id => this.sim.squad(id)?.type === t)); for (const r in M.res) if (r !== t) M.res[r] = 0; this.renderMulti(); return; }
    if (k === 'merge') {
      const r = A.merge([...M.ids].map(id => this.sim.squad(id)), M.res); this.setMulti([]); if (!r) return;
      const q = r.squads[0]; this.toast(r.group ? `🔗 Groupe formé : ${r.squads.map(s => `${UNITS[s.type].ico}${s.n}`).join(' ')} — infanterie devant, archers derrière, cavaliers sur les ailes` : `🔗 ${this.unitName(q)} : ${q.n} hommes`, 'ok');
      this.buzz(15); this.cam.focusOn(q.x, q.z); this.openSquad(q.id);
    }
  };
  // ——— groupes : nom, contenu, actions (bulle et menu Armée) ———
  P.groupLabel = function (g) { const M = this.sim.army.members(g); return M.map(q => `${UNITS[q.type].ico}${q.n}`).join(' '); };
  P.groupHtml = function (g, inCard) {
    const A = this.sim.army, M = A.members(g), tot = M.reduce((a, q) => a + q.n, 0), form = g.form || M[0]?.form, others = this.mergeTargets(M[0]);
    const mem = `<div class="gmem">${M.map(q => `<span class="gm">${this.numChip(q)} ${UNITS[q.type].ico} ${q.n}${inCard ? '' : `<button class="lnk" data-a="gdet:${q.id}" title="Sortir cette troupe du groupe">détacher</button><button class="lnk" data-a="gsplit:${q.id}" title="Couper cette troupe en deux">½</button>`}</span>`).join('')}</div>`;
    const forms = `<div class="fgrid mini">${Object.keys(FORMATIONS).map(f => `<button class="fbtn ${form === f ? 'on' : ''}" data-a="gform:${f}" title="${FORMATIONS[f].info}"><b>${FORMATIONS[f].ico}</b>${FORMATIONS[f].name}</button>`).join('')}</div>`;
    const rot = `<div class="sqnav"><button class="chipb" data-a="grot:-1" title="Pivoter de 45° à gauche">↺</button><button class="chipb" data-a="grot:0" title="Face aux zombies">⬆ Nord</button><button class="chipb" data-a="grot:1" title="Pivoter de 45° à droite">↻</button></div>`;
    if (inCard) return `<div class="tgrp">🎌 Groupe · ${tot} hommes</div>${mem}${forms}${rot}`;
    let h = `<div class="tgrp">🎌 Groupe · ${tot} hommes</div>${mem}<div class="hint small">Formation de chaque troupe — le groupe se range en tacticien : infanterie lourde au centre, fantassins de part et d'autre, cavaliers sur les ailes, archers derrière. Il avance à l'allure du plus lent.</div>${forms}${rot}<div class="hint small">Ou appui long sur le groupe, puis glisse : la flèche montre où ils regarderont.</div>`;
    h += `<div class="row wrapr">${this.btn('⬇ Séparer par type', 'chaque troupe redevient seule', 'gdis', false, 'act slim sec')}</div>` + (others.length ? `<div class="tgrp">Fusionner avec…</div><div class="mlist">${others.map(o => `<button class="chipb" data-a="mergeto:${o.id}">${o.label}</button>`).join('')}</div>` : '');
    return h;
  };
  // bloc « escadron de 150 » : compléter, recrues versées directement, tout regrouper
  P.fullHtml = function (q, inCard) {
    const A = this.sim.army, pool = A.fillPool(q), room = 150 - q.n;
    if (inCard) return `${room > 0 ? `<button class="chipb" data-a="fill150"${pool ? '' : ' disabled'} title="Compléter avec la réserve et les petites troupes du même type">⬆ 150${pool ? ` <small>+${Math.min(room, pool)}</small>` : ''}</button>` : ''}<button class="chipb${q.feed ? ' on' : ''}" data-a="feed" title="Les nouvelles recrues rejoignent directement cette troupe">📥</button>`;
    return `<div class="tgrp">⬆ Escadron de 150 · ${q.n}/150</div><div class="row wrapr">${this.btn('⬆ Compléter à 150', room <= 0 ? 'complet' : pool ? `+${Math.min(room, pool)} (réserve et petites troupes)` : 'personne de disponible', 'fill150', room <= 0 || !pool, 'act slim')}${this.btn(`${q.feed ? '✅' : '⬜'} 📥 Recrues directes`, 'les nouvelles recrues la rejoignent', 'feed', false, 'act slim' + (q.feed ? '' : ' sec'))}${this.btn(`🔗 Tous les ${UNITS[q.type].name.toLowerCase()}s par 150`, 'regroupe les troupes isolées', 'pack:' + q.type, false, 'act slim sec')}</div>`;
  };
  // troupes et groupes avec lesquels on peut fusionner (autres que celui de q)
  P.mergeTargets = function (q) {
    if (!q) return []; const A = this.sim.army, g = A.groupOf(q), seen = new Set(), out = [];
    for (const o of A.squads) { if (o === q || o.n <= 0 || (g && o.gid === g.id)) continue; const og = A.groupOf(o); if (og) { if (seen.has(og.id)) continue; seen.add(og.id); out.push({ id: o.id, label: `Groupe ${this.groupLabel(og)}` }); } else out.push({ id: o.id, label: `${o.num} · ${UNITS[o.type].ico} ${o.n}` }); }
    return out.slice(0, 16);
  };
  P.armyAct = function (v, x) {
    const sim = this.sim, A = sim.army, q = sim.squad(this.selSq), g = A.groupOf(q);
    switch (v) {
      case 'gform': if (g) A.setGroupForm(g, x); return true;
      case 'fill150': { if (!q) return true; const k = A.fillTo(q); this.toast(k ? `⬆ ${this.unitName(q)} : ${q.n}/150 (+${k})` : 'Personne de disponible pour la compléter', k ? 'ok' : 'warn'); return true; }
      case 'feed': { if (!q) return true; for (const o of A.squads) if (o !== q && o.type === q.type) o.feed = false; q.feed = !q.feed; this.toast(q.feed ? `📥 Les nouvelles recrues (${UNITS[q.type].name.toLowerCase()}s) rejoignent la troupe ${q.num} jusqu'à 150` : '📥 Les recrues retournent à la réserve', 'info'); return true; }
      case 'pack': { const L = A.packAll(x); this.toast(L.length ? `🔗 ${UNITS[x].ico} ${L.map(o => o.n).join(' + ')} : regroupés par 150` : 'Rien à regrouper', L.length ? 'ok' : 'warn'); return true; }
      case 'grot': { if (!q) return true; const base = g ? (g.face ?? Math.PI) : (q.face ?? Math.PI), f = +x === 0 ? Math.PI : base + (+x) * Math.PI / 4; A.rotate(q, f); this.toast(`↻ ${this.dirName(f)}`, 'info'); return true; }
      case 'gdis': if (g) { A.dissolve(g); this.toast('⬇ Groupe séparé : chaque troupe redevient indépendante', 'ok'); } return true;
      case 'gdet': { const o = sim.squad(+x); if (o) { A.detach(o); this.toast(`Troupe ${o.num} sortie du groupe`, 'info'); } return true; }
      case 'gsplit': { const o = sim.squad(+x); if (o) { const m = A.splitFree(o, 'half'); this.toast(m.length ? `½ ${UNITS[o.type].name} : ${o.n} + ${m[0].n}` : 'Trop petite pour être coupée', m.length ? 'ok' : 'warn'); } return true; }
      case 'splitf': { if (!q) return true; const m = A.splitFree(q, isNaN(+x) ? x : +x); this.toast(m.length ? `⬇ ${UNITS[q.type].name} : ${[q, ...m].map(o => o.n).join(' + ')}` : 'Impossible de séparer ainsi', m.length ? 'ok' : 'warn'); return true; }
      case 'mergeto': { const o = sim.squad(+x); if (q && o) { const r = A.mergeWith(q, o); if (r) { this.toast(r.group ? `🔗 Groupe : ${this.groupLabel(r.group)}` : `🔗 ${r.squads[0].n} hommes`, 'ok'); this.selSq = r.squads[0].id; this.nav.army = 'sq.' + r.squads[0].id; if (this.card?.kind === 'squad') this.openSquad(r.squads[0].id); } } return true; }
    }
    return false;
  };
  // troupe très blessée : alerte une fois (jusqu'à ce qu'elle se refasse)
  P.watchHurt = function () {
    const A = this.sim.army, W = this.hurtW || (this.hurtW = new Map());
    for (const q of A.squads) { const r = A.hpRatio(q), was = W.get(q.id); if (r < 0.35 && !was && q.n > 0) { W.set(q.id, 1); this.toast(`🩸 Troupe ${q.num} (${UNITS[q.type].ico} ${this.unitName(q)}) en difficulté · ${this.squadWhere(q).here} — 🎌 pour la retrouver`, 'warn'); } else if (r > 0.6 && was) W.delete(q.id); }
  };
}
