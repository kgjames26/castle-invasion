// (v11) Savoir qui est où : chaque troupe a un NUMÉRO et une COULEUR (fanion, mini-carte, listes), un REGISTRE de l'armée
// toujours à portée (bouton 🎌 sous la mini-carte), la caméra qui SUIT une troupe, le passage d'une troupe à l'autre (Tab),
// un drapeau de RÉSERVE au point de ralliement, et des messages qui disent où vont les recrues.
import { SECTORS, SECTOR_AT, SECTOR_NAMES, SECTOR_W, PLAZA, WALL_Z1, wallOff } from '../sim/constants.js';
import { UNITS, UNIT_ORDER } from '../content/medieval.js';
import { TRAIN_BUILDINGS } from '../sim/army.js';

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
    const T = this.trainAcc || (this.trainAcc = {}); T[e.unit] = (T[e.unit] || 0) + 1; clearTimeout(this.trainTo);
    this.trainTo = setTimeout(() => {
      const A = this.sim.army, parts = Object.keys(T).map(t => `${UNITS[t].ico} ${T[t]} ${UNITS[t].name.toLowerCase()}${T[t] > 1 ? 's' : ''}`), where = this.whereName(A.rally.x, A.rally.z);
      const t0 = Object.keys(T)[0], r = A.reserve[t0] || 0, more = t0 === 'archer' ? (A.autoArchers ? ' : ils montent sur la muraille' : '') : r >= 15 ? ` · réserve ${r} : de quoi former une troupe (🎌)` : ` · réserve ${r}/15 pour une escouade`;
      this.toast(`${parts.join(', ')} prêt${Object.values(T).reduce((a, b) => a + b, 0) > 1 ? 's' : ''} → ${where}${more}`, 'ok'); this.trainAcc = {};
    }, 1400);
  };
  // troupe très blessée : alerte une fois (jusqu'à ce qu'elle se refasse)
  P.watchHurt = function () {
    const A = this.sim.army, W = this.hurtW || (this.hurtW = new Map());
    for (const q of A.squads) { const r = A.hpRatio(q), was = W.get(q.id); if (r < 0.35 && !was && q.n > 0) { W.set(q.id, 1); this.toast(`🩸 Troupe ${q.num} (${UNITS[q.type].ico} ${this.unitName(q)}) en difficulté · ${this.squadWhere(q).here} — 🎌 pour la retrouver`, 'warn'); } else if (r > 0.6 && was) W.delete(q.id); }
  };
}
