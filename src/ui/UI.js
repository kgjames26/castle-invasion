// Interface « parchemin » : la carte reste visible ; les menus apparaissent à la demande.
//  · pastilles de secteur sur la muraille · bulle contextuelle ancrée sur la structure touchée · feuille (Bâtir / Armée / Villageois / Savoir)
//  · placement tactile : fantôme à glisser, rotation, nombre d'ouvriers · aucun état de jeu ici (tout passe par les commandes de la simulation).
import { SECTORS, SECTOR_NAMES, SECTOR_SHORT, ARCHER_SLOTS, CASTLE, wallOff } from '../sim/constants.js';
import { PHASES, UNITS, UNIT_ORDER, SIEGE, SIEGE_ORDER, SIEGE_RULES, FORMATIONS, SQUAD, TASKS, BUILDINGS, STRUCT, BUILD, UPGRADES, RES, RES_INFO, ECON, PROSPECT, waveSpec, RANKS, RANK_BUILDINGS, MAGE, PRIEST, DIFFICULTY, SMITH, INFIRMARY, FRONTIER, ROADWORKS, FIRE_KEEP } from '../content/medieval.js';
import { MAGE_TIERS } from '../render/Heroes.js';
import { FORMATS, idealFormat, quality } from '../render/config.js';
import { TRAIN_BUILDINGS } from '../sim/army.js';

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const fmt = n => Math.floor(n).toString();
const TASK_ORDER = ['wood', 'stone', 'iron', 'gold', 'food'];
const TB = { sawmill: ['wood'], quarry: ['stone'], mine: ['iron', 'gold'], farm: ['food'] };       // bâtiment → tâches de récolte
const GROUPS = [['Économie', ['sawmill', 'quarry', 'mine', 'farm', 'mill', 'granary', 'warehouse', 'university', 'publicworks', 'house']], ['Armée', ['barracks', 'range', 'stable', 'workshop', 'forge', 'infirmary', 'wizard']], ['Défense', ['tower']]];
import { VERSION } from '../version.js';
// Réglages de l'interface : tutorial = astuces de premier lancement (aussi coupé par ?tuto=0) ; haptics = vibrations sur mobile.
export const UI_FLAGS = { tutorial: !/[?&]tuto=0\b/.test(location.search), haptics: true };
const PREF_KEY = 'castle-prefs';
const loadPrefs = () => { try { return JSON.parse(localStorage.getItem(PREF_KEY)) || {}; } catch { return {}; } };
const QUALITY_NAMES = { low: 'Bas', medium: 'Moyen', high: 'Élevé' };
const SHEETS = { build: '⚒ Bâtir', army: '🛡 Armée', folk: '👥 Villageois', tech: '📜 Savoir' }, MENU_TITLE = '⚙ Paramètres';
const snap = v => Math.round(v * 2) / 2;

export class UI {
  constructor(sim, hooks) {
    this.sim = sim; this.hooks = hooks; this.rd = hooks.rd; this.cam = hooks.cam;
    this.sel = -1; this.acc = 0; this.sheet = null; this.asub = 'squads'; this.siegeSec = 2; this.selSq = 0; this.targeting = false; this.pressing = false;
    this.mode = 'idle'; this.place = null; this.card = null; this.html = { sheet: '', card: '', place: '' };
    this.top = $('#top'); this.dock = $('#dock'); this.sheetEl = $('#sheet'); this.cardEl = $('#card'); this.placeEl = $('#placebar'); this.badgesEl = $('#badges'); this.toasts = $('#toasts');
    // curseurs de volume (menu Paramètres) : lecture directe, sans toucher au reste de l'interface
    this.sheetEl.addEventListener('input', e => { const k = e.target.dataset?.vol; if (k && hooks.audio) hooks.audio.setVolume(k, +e.target.value / 100); });
    this.top.innerHTML = `
      <div class="rline">${RES.map(r => `<span class="rchip" id="r-${r}"><i>${RES_INFO[r].ico}</i><b>0</b></span>`).join('')}<span class="rchip pop" id="r-pop"><i>👥</i><b>0</b></span></div>
      <div class="wline"><div class="wave"><div class="wt"><b id="wave-title">Vague 1</b><span id="wave-phase" class="phase"></span></div><div class="cbar"><span>🏰 Château</span><div class="bar"><i id="castle-bar"></i></div></div></div>
        <button id="b-skip" class="rb" title="Lancer la vague">▶</button><button id="b-speed" class="rb">×1</button><button id="b-menu" class="rb">☰</button></div>`;
    this.dock.innerHTML = Object.entries(SHEETS).map(([k, n]) => { const [ic, ...t] = n.split(' '); return `<button class="dk" data-sheet="${k}">${ic}<span>${t.join(' ')}</span></button>`; }).join('');
    this.badges = [];
    for (let s = 0; s < SECTORS; s++) {
      const b = el('button', 'badge', `<b>${SECTOR_SHORT[s]}</b><div class="bar"><i></i></div><small></small>`); b.addEventListener('click', e => { e.stopPropagation(); this.openCard({ kind: 'sector', id: s }); });
      this.badgesEl.appendChild(b); this.badges.push(b);
    }
    $('#b-skip').addEventListener('click', () => sim.skipPrep());
    $('#b-speed').addEventListener('click', e => { sim.speed = sim.speed === 1 ? 2 : sim.speed === 2 ? 4 : sim.speed === 4 ? 0 : 1; e.currentTarget.textContent = sim.speed ? '×' + sim.speed : '⏸'; });
    $('#b-menu').addEventListener('click', () => this.toggleSheet('menu'));
    $('#over-btn').addEventListener('click', () => { this.showOver(false); this.openSheet('newgame'); });
    this.dock.addEventListener('click', e => { const b = e.target.closest('[data-sheet]'); if (b) { this.buzz(12); b.classList.remove('tap'); void b.offsetWidth; b.classList.add('tap'); this.toggleSheet(b.dataset.sheet); } });
    this.dock.addEventListener('pointerdown', e => { const b = e.target.closest('.dk'); if (b) b.classList.add('down'); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) this.dock.addEventListener(ev, () => this.dock.querySelectorAll('.down').forEach(b => b.classList.remove('down')));
    for (const el0 of [this.sheetEl, this.cardEl, this.placeEl]) {
      el0.addEventListener('pointerdown', () => { this.pressing = true; });
      el0.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b && !b.disabled) { this.act(b.dataset.a); this.refresh(true); } });
    }
    addEventListener('pointerup', () => { setTimeout(() => { this.pressing = false; }, 60); });
    // glisser le fantôme de construction avec le doigt (au lieu de déplacer la caméra)
    this.cam.ghostHit = (x, z) => this.mode !== 'idle' && this.place && Math.abs(x - this.place.x) < this.halfW() + 4 && Math.abs(z - this.place.z) < this.halfD() + 4;
    this.cam.ghostMove = (x, z) => this.moveGhost(x, z);
    this.prefs = { difficulty: 'normal', autoRepair: true, shake: true, fx: true, ...loadPrefs() }; this.applyPrefs(true);
    this.refresh(true);
    this.startTutorial();
  }
  // réglages persistants (difficulté, réparation auto, secousses, effets) : appliqués à la partie et au rendu
  applyPrefs(init) {
    const p = this.prefs, sim = this.sim; if (init && this.hooks.resumed) { p.difficulty = sim.difficulty; p.autoRepair = sim.autoRepair; }
    sim.setDifficulty(p.difficulty); sim.autoRepair = p.autoRepair; this.rd.shakeOn = p.shake; if (this.rd.fx) this.rd.fx.setEnabled(p.fx);
    try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* sans stockage */ }
  }
  // ——— feuille ———
  toggleSheet(n) { if (this.sheet === n) this.closeSheet(); else this.openSheet(n); }
  openSheet(n, sub) { if (n === 'menu') this.volSnap = this.hooks.audio ? { ...this.hooks.audio.vol } : {}; if (this.mode !== 'idle') this.cancelPlace(); this.closeCard(); this.sheet = n; if (sub) this.asub = sub; this.sheetEl.classList.add('on'); this.html.sheet = ''; this.refresh(true); }
  closeSheet() { this.sheet = null; this.rallying = false; this.sheetEl.classList.remove('on'); this.setTargeting(false); this.refresh(true); }
  setTargeting(on) { this.targeting = on; this.rd.setTargeting(on); }
  pickSquad(id) { this.selSq = id; this.rd.setSquad(id); this.refresh(true); }
  // ——— bulle ancrée ———
  openCard(c) {
    if (this.mode !== 'idle') return;
    this.card = c; this.sheet && this.closeSheet(); this.html.card = '';
    this.rd.struct.setSelected(c.kind === 'struct' ? c.id : 0); this.rd.setSelected(c.kind === 'sector' ? c.id : -1); this.sel = c.kind === 'sector' ? c.id : -1;
    this.cardEl.classList.add('on'); this.refresh(true);
  }
  closeCard() { if (this.rd.frontierV) this.rd.frontierV.sel = -1; if (this.card?.kind === 'squad') { this.selSq = 0; this.rd.setSquad(0); } this.card = null; this.sel = -1; this.cardEl.classList.remove('on'); this.rd.struct.setSelected(0); this.rd.setSelected(-1); }
  // ——— toucher la carte ———
  onMapTap(x, z) {
    const sim = this.sim;
    if (this.mode !== 'idle') { this.moveGhost(x, z); return; }
    if (this.rallying) { sim.army.setRally(x, z); this.rallying = false; this.toast && this.toast('📍 Point de ralliement placé'); this.refresh(true); return; }
    // tracé de route (Travaux publics) : 1er toucher = départ, 2e = arrivée
    if (this.roadMode) {
      if (!this.roadMode.a) { this.roadMode.a = { x, z }; this.rd.orderPing(x, z, false); this.toast('🛤 Départ posé — touche le point d\'arrivée', 'info'); return; }
      const a = this.roadMode.a, r = sim.planRoad(a.x, a.z, x, z); this.roadMode = null; this.rd.orderPing(x, z, false);
      this.toast(r.ok ? `🛤 Route prévue (${Math.round(Math.hypot(x - a.x, z - a.z))} m) — les Travaux publics la posent` : '⚠ ' + r.why, r.ok ? 'ok' : 'warn'); this.refresh(true); return;
    }
    // forêts vierges sur les côtés du village : toucher une parcelle = fiche de défrichage
    if ((x < 0 || x > 200) && z >= FRONTIER.z0 && z < FRONTIER.z1) { const p = sim.frontier.at(x, z); if (p && p.state !== 'open') { this.openCard({ kind: 'patch', id: p.id }); this.rd.frontierV.sel = p.id; return; } }
    // escouade choisie : toucher la carte = ordre de mouvement (devant la muraille : sortie ; derrière : nouveau poste) ; toucher une autre escouade = la choisir
    const near = this.squadAt(x, z);
    if (this.card?.kind === 'squad' && sim.squad(this.card.id)) {
      if (near && near !== this.card.id) { this.openSquad(near); return; }
      if (!near || near !== this.card.id) { this.orderSquad(this.card.id, x, z); return; }
    }
    if (this.targeting && this.selSq && z >= SQUAD.sortieZ[0] - 6 && z <= SQUAD.sortieZ[1] + 4) { sim.squadSortie(this.selSq, x, z); this.setTargeting(false); this.refresh(true); return; }
    const s = this.pickStruct(x, z);
    if (s) { this.openCard({ kind: 'struct', id: s.id }); return; }
    if (Math.hypot(x - CASTLE.x, z - CASTLE.z) < 22) { this.openCard({ kind: 'castle', id: 0 }); return; }
    if (near) { this.openSquad(near); return; }
    if (z > 70 && z < 168) { this.openCard({ kind: 'sector', id: Math.min(4, Math.max(0, (x / 40) | 0)) }); return; }
    this.closeCard(); if (this.sheet) this.closeSheet();
  }
  // parcelle de forêt vierge : défricher (si elle touche une terre ouverte), avancement, bois et minerai éventuel
  patchCard(p) {
    const sim = this.sim, F = sim.frontier, E = sim.eco, can = F.canClear(p);
    let h = `<div class="ptitle">🌲 Forêt vierge<span class="lvl">${p.state === 'clearing' ? 'défrichage ' + Math.round(100 * (1 - p.wood / FRONTIER.wood)) + ' %' : p.state === 'open' ? 'défrichée' : 'intacte'}</span></div>`;
    h += `<div class="hint small">${RES_INFO.wood.ico} ${Math.round(p.wood)} bois à abattre. Le sol défriché devient constructible ; il cache peut-être un gisement de pierre, de fer ou d'or…</div>`;
    if (p.state === 'clearing') {
      h += `<div class="hpline"><div class="bar big"><i style="width:${100 * (1 - p.wood / FRONTIER.wood)}%"></i></div><span>🪓 ${E.assign.clear} défricheur${E.assign.clear > 1 ? 's' : ''}</span></div>`;
      if (!E.assign.clear) h += '<div class="warn">Aucun défricheur : ajoute-en ci-dessous (ou dans 👥 Villageois).</div>';
      h += `<div class="row">${this.btn('🪓 +2 défricheurs', '', 'as:clear:2', false, 'act slim')}${this.btn('Arrêter', '', 'unclear:' + p.id, false, 'act slim sec')}</div>`;
    } else if (p.state === 'forest') {
      h += can ? `<div class="row">${this.btn('🪓 Défricher cette parcelle', 'les défricheurs s\'en chargent', 'clear:' + p.id, false)}</div>` : '<div class="warn">Trop loin : défriche d\'abord une parcelle voisine du village.</div>';
    }
    return h;
  }
  squadAt(x, z) { let best = 0, bd = Infinity; for (const q of this.sim.army.squads) { const d = Math.hypot(q.x - x, q.z - z); if (d < Math.max(4, q.rad + 1.5) && d < bd) { bd = d; best = q.id; } } return best; }
  openSquad(id) { this.closeSheet(); this.pickSquad(id); this.openCard({ kind: 'squad', id }); this.buzz(10); }
  orderSquad(id, x, z) {
    const sim = this.sim, q = sim.squad(id); if (!q) return;
    if (z > 212 + 4) { this.toast('⚠ Trop loin : poste une escouade dans la cour ou devant la muraille', 'warn'); return; }
    sim.squadMove(id, x, z); this.rd.orderPing(q.mode === 'field' ? q.tx : q.postX, q.mode === 'field' ? q.tz : q.postZ, q.mode === 'field');
    this.toast(q.mode === 'field' ? `⚔ ${UNITS[q.type].name} ×${q.n} : sortie !` : `🛡 ${UNITS[q.type].name} ×${q.n} : nouveau poste`, q.mode === 'field' ? 'warn' : 'info'); this.buzz(15); this.refresh(true);
  }
  pickStruct(x, z) {
    let best = null, bd = Infinity;
    for (const s of this.sim.build.items) {
      const [hw, hd] = this.sim.build.half(s.type, s.rot), m = s.fixed ? 3.5 : 1.5;
      if (Math.abs(x - s.x) <= hw + m && Math.abs(z - s.z) <= hd + m) { const d = (x - s.x) ** 2 + (z - s.z) ** 2; if (d < bd) { bd = d; best = s; } }
    }
    return best;
  }
  // ——— placement ———
  halfW() { return this.place ? this.sim.build.half(this.place.type, this.place.rot)[0] : 0; }
  halfD() { return this.place ? this.sim.build.half(this.place.type, this.place.rot)[1] : 0; }
  startPlace(type, moveId = 0) {
    const B = this.sim.build, E = this.sim.eco, def = STRUCT[type];
    if (!moveId) {
      const t = B.canBuildType(type);
      if (!t.ok) { const ex = B.of(type); if (ex) { this.cam.focusOn(ex.x, ex.z); this.openCard({ kind: 'struct', id: ex.id }); } else this.toast(`${def.ico} ${t.why}`); return; }
      if (!E.afford(B.newCost(type))) { this.toast('Ressources insuffisantes'); return; }
    }
    const s = moveId ? B.get(moveId) : null, rot = s ? s.rot : 0;
    this.closeSheet(); this.closeCard();
    const [hw, hd] = B.half(type, rot), minZ = (type === 'tower' ? BUILD.towerMinZ : BUILD.minZ) + hd + 2;
    let x = s ? s.x : Math.min(BUILD.maxX - hw, Math.max(BUILD.minX + hw, this.cam.tx)), z = s ? s.z : Math.min(BUILD.maxZ - hd, Math.max(minZ, this.cam.tz));
    if (type === 'mine') { const o = B.snapOre(x, z) || B.ores().find(q => q.res !== 'stone'); if (o && !s) { x = o.x; z = o.z; this.cam.focusOn(x, z); } }
    this.mode = moveId ? 'move' : 'place'; this.place = { type, x: type === 'mine' ? x : snap(x), z: type === 'mine' ? z : snap(z), rot, workers: 1, moveId };
    if (!s && type !== 'mine') this.nearestFree();
    this.placeEl.classList.add('on'); this.html.place = ''; this.syncGhost(); this.refresh(true);
  }
  nearestFree() {
    const p = this.place, B = this.sim.build;
    for (let r = 0; r <= 70; r += 2) for (let k = 0; k < (r ? 20 : 1); k++) {
      const a = k / 20 * Math.PI * 2, x = snap(p.x + Math.cos(a) * r), z = snap(p.z + Math.sin(a) * r);
      if (B.canPlace(p.type, x, z, p.rot, p.moveId).ok) { p.x = x; p.z = z; return; }
    }
  }
  moveGhost(x, z) { if (!this.place) return; if (this.place.type === 'mine') { const o = this.sim.build.snapOre(x, z); if (o) { x = o.x; z = o.z; } this.place.x = x; this.place.z = z; this.syncGhost(); this.refresh(true); return; } this.place.x = snap(x); this.place.z = snap(z); this.syncGhost(); this.refresh(true); }
  syncGhost() {
    const p = this.place; if (!p) { this.rd.struct.setGhost(null); return; }
    p.check = this.sim.build.canPlace(p.type, p.x, p.z, p.rot, p.moveId);
    this.rd.struct.setGhost({ type: p.type, x: p.x, z: p.z, rot: p.rot, ok: p.check.ok });
  }
  cancelPlace() { this.mode = 'idle'; this.place = null; this.placeEl.classList.remove('on'); this.rd.struct.setGhost(null); }
  confirmPlace() {
    const p = this.place, sim = this.sim; if (!p || !p.check.ok) { if (p) this.toast(p.check.why ? '⚠ ' + p.check.why : 'Emplacement invalide'); return; }
    if (p.moveId) {
      if (sim.moveStruct(p.moveId, p.x, p.z, p.rot)) { const id = p.moveId; this.cancelPlace(); this.toast('✥ Déplacé — un ouvrier doit repasser'); this.openCard({ kind: 'struct', id }); }
      return;
    }
    const s = sim.place(p.type, p.x, p.z, p.rot, p.workers);
    if (!s) { this.toast('Ressources insuffisantes'); return; }
    if (p.type === 'house' && sim.eco.afford(sim.build.newCost('house'))) { p.x += 8; this.nearestFree(); this.syncGhost(); this.toast('🏠 Chantier posé — encore une ?'); }
    else { this.cancelPlace(); this.toast('🏗 Chantier posé'); this.openCard({ kind: 'struct', id: s.id }); }
  }
  // ——— commandes ———
  act(a) {
    const [v, x, y] = a.split(':'), sim = this.sim, s = this.sel;
    switch (v) {
      case 'sheet': this.openSheet(x, y); break;
      case 'quality': this.rd.setQuality(x); this.html.sheet = ''; this.refresh(true); break;
      case 'newgame': this.openSheet('newgame'); break;
      case 'start': if (this.sim.over || confirm('Commencer une nouvelle partie ? La partie en cours sera perdue.')) { this.prefs.difficulty = this.newDiff || this.prefs.difficulty; this.closeSheet(); this.hooks.newGame(x); this.applyPrefs(); } break;
      case 'ndiff': this.newDiff = x; this.html.sheet = ''; break;
      case 'rally': this.rallying = !this.rallying; if (this.rallying) { const r = this.sim.army.rally; this.cam.focusOn(r.x, r.z); } break;
      case 'close': this.card ? this.closeCard() : this.closeSheet(); break;
      case 'bld': this.startPlace(x); break;
      case 'go': { const t = sim.build.get(+x); if (t) { this.cam.focusOn(t.x, t.z); this.openCard({ kind: 'struct', id: t.id }); } break; }
      case 'wk': { const t = sim.build.get(+x); if (t) sim.setWorkers(t.id, t.workers + +y); break; }
      case 'cnl': if (sim.cancelBuild(+x)) { this.closeCard(); this.toast('Chantier annulé — 80 % remboursés'); } break;
      case 'up': if (!sim.upgradeStruct(+x, 1)) this.toast('Ressources insuffisantes'); break;
      case 'mv': this.startPlace(sim.build.get(+x).type, +x); break;
      case 'pok': this.confirmPlace(); break;
      case 'pno': this.cancelPlace(); break;
      case 'prot': if (this.place) { this.place.rot = (this.place.rot + 1) & 3; this.syncGhost(); } break;
      case 'pw': if (this.place) this.place.workers = Math.max(1, Math.min(BUILD.maxWorkers, this.place.workers + +x)); break;
      case 'sub': this.sub = x; break;
      case 'as': sim.assignVillagers(x, +y); break;
      case 'vil': sim.recruitVillager(); break;
      case 'pro': if (!sim.prospect(x)) this.toast('Prospection impossible (villageois libre, 40 or, 30 vivres)'); break;
      case 'upg': sim.buyUpgrade(x); break;
      case 'smith': if (!sim.eco.buySmith(x, y)) this.toast('Pas assez de ressources'); else this.buzz(10); break;
      case 'prio': sim.setRepairPriority(+x); break;
      case 'ua': sim.assignArchers(s, +y); break;
      case 'wall': sim.upgrade(s); break;
      case 'sseg': this.siegeSec = +x; break;
      case 'sbuild': sim.buildSiege(x, this.siegeSec); break;
      case 'scancel': sim.cancelSiege(); break;
      case 'sdis': sim.dismantleSiege(+x); break;
      case 'train': sim.train(x, +y); break;
      case 'cancel': sim.cancelTrain(x); break;
      case 'asub': this.asub = x; break;
      case 'sq': this.pickSquad(+x); break;
      case 'newsq': { const q = sim.formSquad(x, UNITS[x].squad, 2); if (q) { this.pickSquad(q.id); this.toast(`${UNITS[x].ico} Escouade formée — touche-la sur la carte pour lui donner un ordre`, 'ok'); } break; }
      case 'form': sim.squadForm(this.selSq, x); break;
      case 'stance': sim.squadStance(this.selSq, x); break;
      case 'gar': sim.squadGarrison(this.selSq, +x); this.setTargeting(false); break;
      case 'sqgo': sim.squadGarrison(+x, s); break;
      case 'sortie': { const on = !this.targeting; this.setTargeting(on); if (on) { const q = sim.squad(this.selSq); this.cam.focusOn(q ? q.x : 100, 118); } break; }
      case 'reinf': sim.squadReinforce(this.selSq); break;
      case 'disb': sim.squadDisband(this.selSq); this.selSq = 0; this.rd.setSquad(0); this.setTargeting(false); if (this.card?.kind === 'squad') this.closeCard(); break;
      case 'sqcard': { const q = sim.squad(+x); if (q) { this.cam.focusOn(q.x, q.z); this.openSquad(q.id); } break; }
      case 'clear': if (sim.clearPatch(+x)) { if (!sim.eco.assign.clear) sim.assignVillagers('clear', 2); this.toast('🪓 Défrichage lancé', 'ok'); } break;
      case 'unclear': sim.cancelClear(+x); break;
      case 'road': this.roadMode = {}; this.closeCard(); this.toast('🛤 Touche le point de départ de la route', 'info'); break;
      case 'summon': if (!sim.summonMage()) this.toast('Invocation impossible (or, vivres, une place de population)'); else this.toast('🔮 Invocation du magicien…', 'ok'); break;
      case 'gfx': { const q = quality, H = this.hooks; if (!H.setGfx) break;
        if (x === 'fmt') H.setGfx(y); else H.setGfx(null, x === 'shadows' ? { shadows: !q.shadows } : x === 'glow' ? { glow: !q.glow } : x === 'grass' ? { grass: q.grass >= 0.7 ? 0.35 : 1 } : { pixelRatio: q.pixelRatio >= 1.5 ? 1 : 2 });
        this.html.sheet = ''; break; }
      case 'pref': { const p = this.prefs; if (x === 'difficulty') p.difficulty = y; else p[x] = !p[x]; this.applyPrefs(); this.html.sheet = ''; break; }
      case 'goto': { const t = sim.build.of(x); if (t) { this.cam.focusOn(t.x, t.z); this.openCard({ kind: 'struct', id: t.id }); } else this.startPlace(x); break; }
    }
  }
  // toast : kind = 'info' | 'ok' | 'warn' | 'danger' (couleur et durée) ; les messages identiques consécutifs sont regroupés (×2, ×3…)
  toast(msg, kind = 'info') {
    const last = this.toasts.lastElementChild;
    if (last && last.dataset.msg === msg && last.dataset.k === kind) { const n = (+last.dataset.n || 1) + 1; last.dataset.n = n; last.innerHTML = `${msg} <b class="tn">×${n}</b>`; clearTimeout(last._t); last._t = setTimeout(() => last.remove(), 3000); return; }
    const t = el('div', 'toast ' + kind, msg); t.dataset.msg = msg; t.dataset.k = kind; this.toasts.appendChild(t);
    t._t = setTimeout(() => t.remove(), kind === 'danger' ? 4500 : kind === 'warn' ? 3800 : 3000);
    while (this.toasts.children.length > 3) this.toasts.firstChild.remove();
    if (kind === 'danger' && UI_FLAGS.haptics) this.buzz([40, 40, 80]);
  }
  buzz(p) { if (UI_FLAGS.haptics && navigator.vibrate) try { navigator.vibrate(p); } catch { /* non supporté */ } }
  onEvent(e) {
    const sim = this.sim;
    if (e.type === 'priestArrived') { this.toast('⛪ Un prêtre s\'installe à l\'église : il bénira les défenseurs pendant les assauts', 'ok'); }
    if (e.type === 'built') { const d = STRUCT[e.what]; this.toast(e.kind === 'site' ? `${d.ico} ${d.name} terminé !` : e.kind === 'upgrading' ? `⬆ ${d.name} amélioré` : `✥ ${d.name} remis en service`); }
    else if (e.type === 'breach') { this.toast(`💥 Brèche — ${SECTOR_NAMES[e.s]} ! Envoyez des renforts`, 'danger'); this.flashScreen('danger') }
    else if (e.type === 'repair') this.toast(`🔧 Muraille réparée — ${SECTOR_NAMES[e.s]}`, 'ok');
    else if (e.type === 'waveStart') { const t = (sim.targets || []).map(s => SECTOR_SHORT[s]).join(' · '); this.toast(`🌊 Vague ${e.wave} — attaque : ${t || '?'}`, 'warn'); this.flashScreen('warn'); this.buzz(60); }
    else if (e.type === 'discovered') { this.toast(`🧭 Nouveau gisement de ${RES_INFO[e.res].name.toLowerCase()} découvert (${e.amount}) !`); this.cam.focusOn(e.x, e.z); }
    else if (e.type === 'golem') { this.toast(`🗿 Un golem secoue la muraille : ${e.fell} archer${e.fell > 1 ? 's' : ''} tombé${e.fell > 1 ? 's' : ''}${e.dead ? ` (${e.dead} mort${e.dead > 1 ? 's' : ''})` : ''}`, 'danger'); this.buzz(40); }
    else if (e.type === 'oreFound') this.toast(`⛏ Défrichage : un gisement de ${RES_INFO[e.res].name.toLowerCase()} découvert !`, 'ok');
    else if (e.type === 'cleared') this.toast('🌲 Parcelle défrichée : terrain constructible', 'info');
    else if (e.type === 'fireLit' && e.zone === 'plain') { if (!this.plainLitShown) { this.plainLitShown = true; this.toast('🔥 La nuit tombe : l\'équipe des feux allume les bûchers de la plaine', 'ok'); } }
    else if (e.type === 'fireOut') { if (e.zone !== 'village' && (!this.lastFireOut || performance.now() - this.lastFireOut > 4000)) { this.lastFireOut = performance.now(); this.toast(e.zone === 'plain' ? '🔥 Les zombies ont éteint un feu de la plaine !' : '🔥 Un feu s\'est éteint', 'danger'); } }
    else if (e.type === 'roadDone') this.toast('🛤 Route terminée', 'ok');
    else if (e.type === 'autoRepair') this.toast(`🔧 Réparation automatique : ${e.n} villageois empruntés`, 'info');
    else if (e.type === 'autoRepairDone') this.toast(`🔧 Muraille réparée — ${e.n} villageois retournent à leur tâche`, 'ok');
    else if (e.type === 'mage') this.toast(e.what === 'summoned' ? '🔮 Le magicien est arrivé ! Il agit seul : soins, réparations, sorts.' : '💀 Le magicien est tombé — il reviendra dans 30 s', e.what === 'summoned' ? 'ok' : 'danger');
    else if (e.type === 'waveEnd') { const r = e.reward || {}; this.toast(`🏆 Vague ${e.wave} repoussée · ${Object.keys(r).map(k => `+${r[k]} ${RES_INFO[k].ico}`).join(' ')}`, 'ok'); this.buzz([30, 30, 30]); }
  }
  // ——— mise à jour de l'affichage ———
  refresh(force) {
    const sim = this.sim, w = sim.wall, army = sim.army, E = sim.eco;
    for (const r of RES) { const e = $('#r-' + r); e.querySelector('b').textContent = fmt(E.res[r]); e.classList.toggle('full', E.res[r] >= E.cap(r) - 0.5); e.classList.toggle('low', r === 'food' && E.famine); }
    if (this.plainLitShown && this.sim.night.light() > 0.97) this.plainLitShown = false;
    const pop = $('#r-pop'); pop.querySelector('b').textContent = `${E.population()}/${E.popCap()}`; pop.classList.toggle('max', E.popRoom() <= 0);
    $('#wave-title').textContent = `Vague ${sim.wave}` + (sim.phase === 'assault' ? ` · ${sim.zombies.n + (sim.spawn ? sim.spawn.left : 0)} 🧟` : '');
    const Lt = sim.night.light(), dn = Lt > 0.8 ? '☀' : Lt > 0.45 ? (sim.night.t < 0.5 || sim.night.t > 0.9 ? '🌅' : '🌇') : '🌙';
    $('#wave-phase').textContent = PHASES[sim.phase] + (sim.phase === 'assault' ? '' : ` · ${Math.ceil(sim.timer)} s`) + ` · ${dn}`;
    $('#wave-phase').dataset.p = sim.phase; $('#b-skip').style.display = sim.phase === 'prep' ? '' : 'none';
    $('#castle-bar').style.width = (100 * sim.castleHp / CASTLE.hp) + '%';
    let alert = false;
    for (let s = 0; s < SECTORS; s++) {
      const c = this.badges[s], hp = w.sectorHp(s) / w.sectorMax(s), dg = sim.danger(s), tgt = sim.phase === 'alert' && sim.targets.includes(s);
      if (dg === 2) alert = true;
      c.className = 'badge' + (this.card?.kind === 'sector' && this.card.id === s ? ' sel' : '') + (dg === 2 ? ' d2' : dg === 1 ? ' d1' : '') + (tgt ? ' tgt' : '') + (w.breaches(s) ? ' breach' : '');
      c.querySelector('.bar i').style.width = (hp * 100) + '%';
      c.querySelector('small').textContent = `🏹${army.archers[s].n} ⚔${army.meleeIn(s)}` + (w.breaches(s) ? ` 💥${w.breaches(s)}` : '');
    }
    for (const b of this.dock.children) {
      const k = b.dataset.sheet; b.classList.toggle('on', k === this.sheet);
      let em = b.querySelector('em'); const n = k === 'folk' ? E.idleCount() : 0;
      if (n > 0) { if (!em) { em = el('em'); b.appendChild(em); } em.textContent = n; } else if (em) em.remove();
    }
    this.dock.querySelector('[data-sheet=army]').classList.toggle('alert', alert && this.sheet !== 'army');
    this.dock.style.display = this.mode === 'idle' ? '' : 'none';
    if (force || !this.pressing) { this.renderSheet(); this.renderCard(); this.renderPlace(); }
  }
  setHtml(key, el0, html) { if (this.html[key] === html) return; const keep = el0.scrollTop; this.html[key] = html; el0.innerHTML = html; el0.scrollTop = keep; }
  renderSheet() {
    if (!this.sheet) return;
    const body = this.sheet === 'newgame' ? this.newGameHtml() : this.sheet === 'menu' ? this.menuHtml() : this.sheet === 'build' ? this.buildSheet() : this.sheet === 'army' ? this.armyHtml() : this.sheet === 'folk' ? this.workHtml() : this.techHtml();
    const html = `<div class="sh"><h2>${this.sheet === 'newgame' ? '🏰 Nouvelle partie' : this.sheet === 'menu' ? MENU_TITLE : SHEETS[this.sheet]}</h2><button class="x" data-a="close">✕</button></div><div class="sb">${body}</div>`;
    if (this.html.sheet === html) return;
    const old = $('.sb', this.sheetEl), keep = old ? old.scrollTop : 0; this.html.sheet = html; this.sheetEl.innerHTML = html; const nb = $('.sb', this.sheetEl); if (nb) nb.scrollTop = keep;
  }
  // nouvelle partie : format proposé selon l'appareil (réglages graphiques ajustables ensuite dans ☰) + difficulté
  newGameHtml() {
    const ideal = idealFormat(), d = this.newDiff || this.prefs.difficulty;
    return `<div class="hint">Choisis le <b>format</b> de la partie. Celui qui convient le mieux à ton appareil est recommandé ; tu pourras l'ajuster ensuite à tout moment dans ☰ Paramètres → Graphismes.</div>
      <div class="fmts">${Object.entries(FORMATS).map(([k, F]) => `<button class="fmt ${k === ideal ? 'rec' : ''}" data-a="start:${k}"><span class="fi">${F.ico}</span><b>${F.name}</b>${k === ideal ? '<em>recommandé</em>' : ''}<small>${F.info}</small></button>`).join('')}</div>
      <div class="hint small"><b>Difficulté</b></div><div class="row">${Object.keys(DIFFICULTY).map(k => this.btn(DIFFICULTY[k].name, '', 'ndiff:' + k, false, 'act slim' + (k === d ? '' : ' sec'))).join('')}</div>`;
  }
  menuHtml() {
    // curseurs de volume : valeurs figées à l'ouverture du menu (pas de re-rendu pendant le glissement)
    const v = this.volSnap || {}, sl = (k, l) => `<label class="vrow"><span>${l}</span><input type="range" min="0" max="100" step="5" value="${Math.round((v[k] ?? 0) * 100)}" data-vol="${k}"></label>`;
    const audio = this.hooks.audio ? `<div class="vols"><div class="hint small"><b>Son</b></div>${sl('master', 'Général')}${sl('sfx', 'Effets')}${sl('music', 'Musique')}</div>` : '';
    const cq = this.hooks.rd.qualityName ? this.hooks.rd.qualityName() : '';
    const fmt = this.sim.format || 'tablet', q = quality, gt = (k, on, l, sub) => this.btn(`${on ? '✅' : '⬜'} ${l}`, sub, 'gfx:' + k, false, 'act slim' + (on ? '' : ' sec'));
    const qual = `<div class="vols"><div class="hint small"><b>Graphismes</b> — préréglage, puis ajuste à ton goût (enregistré avec la partie)</div>
      <div class="row">${Object.entries(FORMATS).map(([k, F]) => this.btn(`${F.ico} ${F.name}`, k === fmt && !this.sim.gfx ? 'actuel' : k === fmt ? 'actuel, modifié' : '', 'gfx:fmt:' + k, false, 'act slim' + (k === fmt ? '' : ' sec'))).join('')}</div>
      <div class="row wrapr">${gt('shadows', q.shadows, 'Ombres', 'plus joli, plus lourd')}${gt('glow', q.glow, 'Lueurs', 'torches, feux, impacts')}${gt('grass', q.grass >= 0.7, 'Herbe dense', '')}${gt('res', q.pixelRatio >= 1.5, 'Haute résolution', 'image plus nette')}</div></div>`;
    const p = this.prefs, tog = (k, l, sub) => this.btn(`${p[k] ? '✅' : '⬜'} ${l}`, sub, 'pref:' + k, false, 'act slim' + (p[k] ? '' : ' sec'));
    const game = `<div class="vols"><div class="hint small"><b>Difficulté</b> (vagues suivantes)</div><div class="row">${Object.keys(DIFFICULTY).map(k => this.btn(DIFFICULTY[k].name, k === 'easy' ? '−25 % zombies' : k === 'hard' ? '+30 % zombies, +15 % PV' : '', 'pref:difficulty:' + k, false, 'act slim' + (k === p.difficulty ? '' : ' sec'))).join('')}</div>
      <div class="row wrapr">${tog('autoRepair', 'Réparation auto', 'emprunte 2 villageois')}${tog('shake', 'Secousses', 'explosions')}${tog('fx', 'Effets', 'particules, feu')}</div></div>`;
    return `<div class="hint">Castle Invasion · <b>v${VERSION}</b></div>${game}${audio}${qual}<div class="row">${this.btn('🔄 Nouvelle partie', 'la partie en cours sera perdue', 'newgame', false, 'act warnb')}</div>`;
  }
  renderCard() {
    const c = this.card; if (!c) return;
    let html = '';
    if (c.kind === 'struct') { const s = this.sim.build.get(c.id); if (!s) { this.closeCard(); return; } html = this.structCard(s); }
    else if (c.kind === 'sector') html = this.sectorCard(c.id); else if (c.kind === 'squad') { const q = this.sim.squad(c.id); if (!q) { this.closeCard(); return; } html = this.squadCard(q); } else if (c.kind === 'patch') html = this.patchCard(this.sim.frontier.patches[c.id]); else html = this.castleCard();
    html = `<button class="x" data-a="close">✕</button>` + html;
    this.setHtml('card', this.cardEl, html);
  }
  renderPlace() {
    const p = this.place; if (!p) return;
    const def = STRUCT[p.type], B = this.sim.build, E = this.sim.eco, mv = !!p.moveId, cost = mv ? null : B.newCost(p.type), afford = mv || E.afford(cost), free = E.idleCount();
    const why = p.check.ok ? (mv ? 'Libre · gratuit' : afford ? 'Emplacement libre' : 'Ressources insuffisantes') : p.check.why;
    const html = `<div class="pm"><span class="pt">${def.ico} ${mv ? 'Déplacer · ' : ''}${def.name}</span><span class="why ${p.check.ok && afford ? 'ok' : 'no'}">${why}</span></div>
      <div class="hint small">Touche la carte ou glisse le fantôme pour le placer.${mv ? ' Le bâtiment sera bloqué jusqu\'au passage d\'un ouvrier.' : ''}</div>
      <div class="pr"><button class="sq" data-a="prot">⟳</button>${mv ? '' : `<button class="sq" data-a="pw:-1"${p.workers <= 1 ? ' disabled' : ''}>−</button><b class="val">👷 ${p.workers}<small>libres ${free}</small></b><button class="sq" data-a="pw:1"${p.workers >= BUILD.maxWorkers ? ' disabled' : ''}>+</button>`}
      <button class="btn sec" data-a="pno">✖</button><button class="btn" data-a="pok"${p.check.ok && afford ? '' : ' disabled'}>✔ ${mv ? 'Déplacer' : 'Poser'}${mv ? '' : `<small>${this.cost(cost)}</small>`}</button></div>`;
    this.setHtml('place', this.placeEl, html);
  }
  // ancrage des bulles et pastilles sur la carte (chaque image)
  // flash rouge/orange sur les bords de l'écran (brèche, début de vague)
  flashScreen(kind) { const f = this.flashEl || (this.flashEl = el('div', 'vflash')); if (!f.isConnected) document.body.appendChild(f); f.className = 'vflash'; void f.offsetWidth; f.className = 'vflash ' + kind; }
  // sorties et retours d'escouades : détectés par comparaison du mode (lecture seule de la simulation)
  watchSquads() {
    const prev = this.sqModes || (this.sqModes = new Map()), seen = new Set();
    for (const q of this.sim.army.squads) {
      seen.add(q.id); const was = prev.get(q.id); prev.set(q.id, q.mode);
      if (was && was !== q.mode) this.toast(q.mode === 'field' ? `${UNITS[q.type].ico} ${UNITS[q.type].name} ×${q.n} sortent de la muraille` : `${UNITS[q.type].ico} ${UNITS[q.type].name} rentrent au poste`, q.mode === 'field' ? 'warn' : 'info');
    }
    for (const id of [...prev.keys()]) if (!seen.has(id)) prev.delete(id);
  }
  // indicateur de portée : tour sélectionnée (cercle) ou secteur d'archers (bande devant la muraille)
  updateRange() {
    const c = this.card, sim = this.sim; let spec = null;
    if (c && c.kind === 'struct') { const s = sim.build.get(c.id); if (s && s.type === 'tower' && s.state !== 'site') spec = { kind: 'circle', x: s.x, z: s.z, r: sim.build.towerStats(s, sim).range }; }
    else if (c && c.kind === 'sector') { const r = UNITS.archer.range + 3 * sim.eco.up.archery; spec = { kind: 'band', x0: c.id * 40, x1: c.id * 40 + 40, z: 146 + wallOff(c.id * 40 + 20), r }; }
    const key = spec ? JSON.stringify(spec) : ''; if (key !== this.rangeKey) { this.rangeKey = key; this.rd.setRangeIndicator(spec); }
  }
  // astuces de premier lancement (désactivables : UI_FLAGS.tutorial ou ?tuto=0)
  startTutorial() {
    if (!UI_FLAGS.tutorial) return; try { if (localStorage.getItem('castle-tuto')) return; localStorage.setItem('castle-tuto', '1'); } catch { return; }
    [[2500, '👆 Touche ⚒ Bâtir pour construire tes premiers bâtiments'], [9000, '👥 Dans Villageois, répartis tes ouvriers sur les ressources'], [17000, '🛡 Prépare des archers (Armée) avant la première vague']].forEach(([t, m]) => setTimeout(() => this.toast(m, 'info'), t));
  }
  // conseil : muraille abîmée sans réparateur (une fois par vague)
  watchRepairs() {
    const sim = this.sim, w = sim.wall; if (sim.eco.assign.repair > 0 || this.repairHint === sim.wave) return;
    for (let s = 0; s < SECTORS; s++) if (w.sectorHp(s) / w.sectorMax(s) < 0.9) { this.repairHint = sim.wave; this.toast(`🔧 ${SECTOR_NAMES[s]} abîmée — affecte des réparateurs (Villageois)`, 'warn'); return; }
  }
  tick(dt) {
    this.watchSquads();
    this.acc += dt; if (this.acc > 0.2) { this.acc = 0; this.updateRange(); this.watchRepairs(); this.refresh(false); }
    const vw = innerWidth, vh = innerHeight;
    for (let s = 0; s < SECTORS; s++) {
      const p = this.rd.project(s * 40 + 20, 8, 143 + wallOff(s * 40 + 20)), b = this.badges[s];
      b.style.display = p.vis && p.x > 0 && p.x < vw && p.y > 90 && p.y < vh - 90 ? '' : 'none'; b.style.left = p.x + 'px'; b.style.top = p.y + 'px';
    }
    const c = this.card; if (!c) return;
    let a;
    if (c.kind === 'struct') { const s = this.sim.build.get(c.id); if (!s) return; a = this.rd.project(s.x, 4, s.z); }
    else if (c.kind === 'sector') a = this.rd.project(c.id * 40 + 20, 6, 146 + wallOff(c.id * 40 + 20)); else if (c.kind === 'squad') { const q = this.sim.squad(c.id); if (!q) return; a = this.rd.project(q.x, 4, q.z); } else if (c.kind === 'patch') { const p = this.sim.frontier.patches[c.id]; a = this.rd.project(p.x, 5, p.z); } else a = this.rd.project(CASTLE.x, 14, CASTLE.z);
    const w = this.cardEl.offsetWidth, h = this.cardEl.offsetHeight, topMin = 96, botMax = vh - 90;
    let top = a.y - h - 26; if (top < topMin) top = Math.min(botMax - h, a.y + 30); if (top + h > botMax) top = Math.max(topMin, botMax - h);
    this.cardEl.style.left = Math.min(vw - w - 8, Math.max(8, a.x - w / 2)) + 'px'; this.cardEl.style.top = top + 'px';
  }
  // ——— fiches ———
  cost(c) { const E = this.sim.eco; return Object.keys(c).map(r => `<i class="${E.res[r] >= c[r] ? '' : 'no'}">${RES_INFO[r].ico}${c[r]}</i>`).join(' '); }
  btn(label, sub, a, off, cls = 'act') { return `<button class="${cls}" data-a="${a}"${off ? ' disabled' : ''}>${label}${sub ? `<small>${sub}</small>` : ''}</button>`; }
  pips(s) { const mx = STRUCT[s.type].max || ECON.maxLevel; return mx > 1 && s.type !== 'house' ? `<span class="pips">${'◆'.repeat(s.level)}${'◇'.repeat(Math.max(0, mx - s.level))}</span>` : ''; }
  taskRow(t) {
    const E = this.sim.eco, T = TASKS[t], n = E.assign[t], capT = E.taskCap(t), idle = E.idleCount();
    return `<div class="row step"><span class="lab">${T.ico} ${T.name}<small class="sub">+${E.rate[t].toFixed(2)}/s · places ${n}/${n + capT}</small></span>${this.btn('−', '', `as:${t}:-1`, n <= 0, 'sq')}<b class="val">${n}</b>${this.btn('+', '', `as:${t}:1`, idle <= 0 || n >= capT, 'sq')}</div>`;
  }
  structCard(s) {
    const sim = this.sim, B = sim.build, E = sim.eco, def = STRUCT[s.type], working = s.state !== 'built';
    let h = `<div class="ptitle">${def.ico} ${def.name}<span class="lvl">${s.level ? 'Niv. ' + s.level : 'chantier'}</span></div>`;
    if (!working && STRUCT[s.type].max !== 1 && s.type !== 'house') h += `<div>${this.pips(s)}</div>`;
    if (working) {
      let crew = 0; for (const v of E.villagers) if (v.job === s.id) crew++;
      const here = s.crew || 0, sec = Math.ceil((1 - s.progress) * s.work / Math.pow(Math.max(1, here), BUILD.workerExp)), free = E.idleCount();
      const what = s.state === 'site' ? 'Construction' : s.state === 'upgrading' ? `Amélioration → niv. ${s.level + 1}` : 'Remise en service (déplacé)';
      h += `<div class="hpline"><div class="bar big"><i style="width:${Math.round(s.progress * 100)}%"></i></div><span>${Math.round(s.progress * 100)} %${here ? ` · ~${sec} s` : ''}</span></div><div class="hint small">${what}</div>
        <div class="row step"><span class="lab">👷 Ouvriers<small class="sub">${here} au travail · libres ${free}</small></span>${this.btn('−', '', `wk:${s.id}:-1`, s.workers <= 0, 'sq')}<b class="val">${s.workers}</b>${this.btn('+', '', `wk:${s.id}:1`, s.workers >= BUILD.maxWorkers || free <= 0 && crew >= s.workers, 'sq')}</div>`;
      if (s.workers > 0 && crew < s.workers && free <= 0) h += `<div class="warn">Aucun villageois libre : retire-en d'une tâche dans 👥.</div>`;
      else if (s.workers === 0) h += `<div class="warn">Aucun ouvrier : le chantier est à l'arrêt.</div>`;
      else if (crew > 0 && here === 0) h += `<div class="hint small">Les ouvriers sont en route…</div>`;
      if (s.state !== 'moving') h += `<div class="row">${this.btn('Annuler', '80 % remboursés', `cnl:${s.id}`, false, 'act sec')}</div>`;
      return h;
    }
    if (s.type === 'tower') { const st = B.towerStats(s, sim); h += `<div class="hint">🏹 <b>${st.dmg.toFixed(0)}</b> dégâts · portée <b>${st.range.toFixed(0)} m</b> · <b>${(1 / st.rate).toFixed(1)}</b> tirs/s</div><div class="hint small">${s.fixed ? 'Tour de la muraille : défend seule, améliorable.' : def.info}</div>`; }
    else h += `<div class="hint small">${def.info}</div>`;
    if (s.type === 'house') h += `<div class="hint small">Population : ${E.population()}/${E.popCap()}</div>`;
    for (const t of TB[s.type] || []) h += this.taskRow(t);
    if (TRAIN_BUILDINGS.includes(s.type)) { const q = sim.army.queues[s.type]; h += `<div class="hint small">File d'entraînement : ${q.length}/${sim.army.queueMax(sim, s.type)}</div>` + this.btn('🪖 Entraîner', '', 'sheet:army:train', false, 'act sec'); }
    if (s.type === 'workshop') h += this.btn('🛠 Armes de siège', '', 'sheet:army:siege', false, 'act sec');
    if (s.type === 'forge') h += this.btn('🔨 Améliorations', '', 'sheet:army:forge', false, 'act sec');
    if (s.type === 'wizard') h += this.mageHtml(true);
    if (s.type === 'church' && s.level) { const P = this.sim.priest, L = s.level; h += `<div class="rank">⛪ Le prêtre ${P.here ? (P.post ? `prie derrière le secteur <b>${SECTOR_SHORT[P.sector]}</b>` : 'veille sur le village') : 'arrive…'}<small>Pendant l'alerte et l'assaut, il va seul derrière le secteur le plus menacé.</small></div>`
      + `<div class="spells">${PRIEST.powers.map(w => `<span class="${w.level <= L ? 'on' : 'off'}" title="${w.info}">${w.ico}<b>${w.name}</b><small>${w.level <= L ? w.info : 'église niv. ' + w.level}</small></span>`).join('')}</div>`; }
    if (s.type === 'publicworks' && s.level) { const R = this.sim.roads, q = R.quality(this.sim), pend = R.list.filter(r => r.built < 1).length; h += `<div class="rank">🛤 Routes : <b>${ROADWORKS.names[q]}</b> — villageois +${Math.round(ROADWORKS.speed[q] * 100)} % de vitesse sur les routes${q < 3 ? ` · niveau ${s.level + 1} : ${ROADWORKS.names[q + 1]}` : ''}${pend ? ` · ${pend} chantier${pend > 1 ? 's' : ''} de route` : ''}<small>Le réseau relie seul chaque nouveau bâtiment ; trace en plus tes propres routes (bois et pierre au mètre).</small></div>` + this.btn('🛤 Tracer une route', `${ROADWORKS.costPerM.wood} ${RES_INFO.wood.ico} + ${ROADWORKS.costPerM.stone} ${RES_INFO.stone.ico} par mètre`, 'road', false, 'act'); }
    if (s.type === 'infirmary' && s.level) h += `<div class="rank">🏥 Soins : <b>${(INFIRMARY.heal[s.level] * 100).toFixed(1)} %</b> des PV par seconde aux escouades en garnison hors combat · <b>${INFIRMARY.save[s.level] * 100} %</b> des combattants tombés sont sauvés (retour en réserve)${this.sim.army.saved ? ` · ${this.sim.army.saved} sauvés` : ''}</div>`;
    if (s.type === 'university' && s.level) h += this.btn('🎓 Améliorations des villageois', '', 'sheet:tech', false, 'act sec');
    if (s.type === 'forge' && s.level) h += `<div class="hint small">Plafond attaque/défense : ${this.sim.eco.smithMax()}</div>`;
    if (RANK_BUILDINGS.includes(s.type)) { const t = UNIT_ORDER.filter(u => UNITS[u].from === s.type), r = RANKS[Math.max(0, s.level - 1)], nx = RANKS[s.level]; h += `<div class="rank">⭐ Rang <b>${r.name}</b>${nx ? ` → <b>${nx.name}</b> au niv. ${s.level + 1} : force ×${nx.force}, résistance ×${nx.res}, tenue plus riche` : ' — rang maximum'}<small>${t.map(u => UNITS[u].ico).join(' ')} toutes les unités de ce bâtiment</small></div>`; }
    const uc = B.upCost(s), canMove = !s.fixed;
    h += `<div class="row">${uc ? this.btn(`⬆ Niv. ${s.level + 1}`, `${this.cost(uc)} · ⏱${Math.round(B.upTime(s))} s`, `up:${s.id}`, !E.afford(uc)) : (s.type === 'house' ? '' : '<span class="max">niveau max</span>')}${canMove ? this.btn('✥ Déplacer', 'gratuit', `mv:${s.id}`, false, 'act sec') : ''}</div>`;
    return h;
  }
  castleCard() {
    const sim = this.sim, E = sim.eco, pop = E.population(), cap = E.popCap(), free = E.idleCount();
    return `<div class="ptitle">🏰 Château<span class="lvl">${fmt(sim.castleHp)} PV</span></div><div class="hpline"><div class="bar big"><i style="width:${100 * sim.castleHp / CASTLE.hp}%"></i></div></div>
      <div class="hint">👥 Population <b>${pop}</b>/${cap} · villageois ${E.villagers.length} (libres ${free})</div>
      <div class="hint small">Les villageois rapportent tout au château. Construis des 🏠 maisons pour agrandir la population.</div>
      <div class="row">${this.btn('+ Villageois', this.cost(ECON.villagerCost), 'vil', pop >= cap || !E.afford(ECON.villagerCost))}${this.btn('🏠 Maison', this.cost(sim.build.newCost('house')), 'bld:house', false, 'act sec')}</div>`;
  }
  sectorCard(s) {
    const sim = this.sim, w = sim.wall, army = sim.army, E = sim.eco;
    const hp = w.sectorHp(s), mx = w.sectorMax(s), br = w.breaches(s), uc = w.upgradeCost(s), crew = E.assign.repair, an = army.archers[s].n;
    const squadsHere = army.squads.filter(q => q.mode === 'garrison' && q.sector === s), others = army.squads.filter(q => !(q.mode === 'garrison' && q.sector === s));
    const sqRow = (q, go) => `<div class="row step"><span class="lab">${UNITS[q.type].ico} ${UNITS[q.type].name} ×${q.n}<small class="sub">${FORMATIONS[q.form].name} · ${q.mode === 'field' ? 'sur le terrain' : SECTOR_SHORT[q.sector]}</small></span>${go ? this.btn('→ ici', '', 'sqgo:' + q.id, false, 'act slim') : ''}</div>`;
    const towers = sim.build.items.filter(t => t.type === 'tower' && t.x >= s * 40 - 10 && t.x <= s * 40 + 50).length;
    return `<div class="ptitle">${SECTOR_NAMES[s]} <span class="lvl">Niv. ${w.level[s]}</span></div>
      <div class="hpline"><div class="bar big"><i style="width:${hp / mx * 100}%"></i></div><span>${Math.round(hp)} / ${Math.round(mx)}${br ? ` · 💥${br}` : ''}</span></div>
      <div class="row">${this.btn('⬆ Renforcer', uc ? `Niv. ${w.level[s] + 1} · ${this.cost(uc)}` : 'niveau max', 'wall', !uc || !E.afford(uc))}</div>
      <div class="hint small">🗼 ${towers} tour${towers > 1 ? 's' : ''} couvrent ce secteur — touche une tour pour l'améliorer.</div>
      <div class="row step"><span class="lab">🏹 Archers<small class="sub">réserve ${army.reserve.archer}</small></span>${this.btn('−', '', 'ua:archer:-1', an <= 0, 'sq')}<b class="val">${an}<small>/${ARCHER_SLOTS}</small></b>${this.btn('+', '', 'ua:archer:1', army.reserve.archer <= 0 || an >= ARCHER_SLOTS, 'sq')}${this.btn('+5', '', 'ua:archer:5', army.reserve.archer <= 0 || an >= ARCHER_SLOTS, 'sq wide')}</div>
      ${squadsHere.map(q => sqRow(q, false)).join('')}${others.length ? `<div class="hint small">Envoyer ici :</div>${others.map(q => sqRow(q, true)).join('')}` : ''}
      ${sim.siege.weapons.some(x => x.sector === s) ? `<div class="hint small">🛠 Siège : ${sim.siege.weapons.filter(x => x.sector === s).map(x => SIEGE[x.type].ico).join(' ')}</div>` : ''}
      <div class="hint small">🔧 ${crew ? `${crew} villageois réparent la muraille` : 'Aucun réparateur'} (menu 👥).</div>`;
  }
  // ——— feuille BÂTIR ———
  buildSheet() {
    const sim = this.sim, B = sim.build, E = sim.eco; let h = `<div class="hint small">Choisis un bâtiment puis <b>place-le où tu veux</b>. Des villageois <b>libres</b> viennent le construire (👥 ${E.idleCount()} libres).</div>`;
    for (const [g, ids] of GROUPS) {
      h += `<div class="tgrp">${g}</div><div class="tgrid">`;
      for (const id of ids) {
        const def = STRUCT[id], ex = B.of(id), multi = id === 'house' || id === 'tower', cost = B.newCost(id);
        let st = '', cls = 'tile', sub = '';
        if (multi) { const n = id === 'house' ? B.count('house') : B.items.filter(s => s.type === 'tower' && !s.fixed).length; st = n ? `${n} construite${n > 1 ? 's' : ''}` : 'À construire'; sub = `${this.cost(cost)}<br>⏱ ${def.time} s`; if (!E.afford(cost)) cls += ' no'; }
        else if (ex) { cls += ' done'; st = ex.state === 'site' ? `Chantier ${Math.round(ex.progress * 100)} %` : ex.state === 'built' ? `Niv. ${ex.level}` : ex.state === 'upgrading' ? 'Amélioration…' : 'Déplacé…'; sub = 'Toucher pour voir'; }
        else { st = 'À construire'; sub = `${this.cost(cost)}<br>⏱ ${def.time} s`; if (!E.afford(cost)) cls += ' no'; }
        h += `<button class="${cls}" data-a="bld:${id}"><span class="ic">${def.ico}</span><b>${def.name}</b><span class="st">${st}</span><small>${sub}</small></button>`;
      }
      h += '</div>';
    }
    return h;
  }
  // état d'un bâtiment unique pour les feuilles Armée : null (absent), ou la structure
  needBuild(type, label) {
    const sim = this.sim, B = sim.build, E = sim.eco, ex = B.of(type), def = STRUCT[type];
    if (ex && ex.state === 'built' || ex && ex.state === 'upgrading') return null;
    if (ex) return `<div class="card"><div class="ct"><b>${def.ico} ${def.name}</b><small>${ex.state === 'site' ? `En chantier — ${Math.round(ex.progress * 100)} %` : 'Déplacé : un ouvrier doit repasser'}</small></div>${this.btn('Voir', '', 'go:' + ex.id, false, 'act slim sec')}</div>`;
    const c = B.newCost(type); return `<div class="card"><div class="ct"><b>${def.ico} ${def.name}</b> <span class="lvl">à construire</span><small>${def.info}</small></div>${this.btn('Construire', this.cost(c), 'bld:' + type, !E.afford(c), 'act slim')}</div>`;
  }
  // ——— ARMÉE ———
  popLine() { const E = this.sim.eco; return `<div class="hint small">👥 Population <b>${E.population()}</b>/${E.popCap()} (villageois ${E.villagers.length} · armée ${this.sim.army.popUsed()})</div>`; }
  armyHtml() {
    const subs = [['squads', '🛡 Escouades'], ['train', '🪖 Entraîner'], ['ranks', '⭐ Rangs'], ['magic', '🔮 Magie'], ['siege', '🛠 Siège'], ['forge', '🔨 Forge']];
    const body = { squads: () => this.squadsHtml(), train: () => this.trainHtml(), ranks: () => this.ranksHtml(), magic: () => this.mageHtml(false), siege: () => this.siegeHtml(), forge: () => this.forgeHtml() }[this.asub] || (() => this.squadsHtml());
    return `<div class="subtabs">${subs.map(([k, n]) => `<button data-a="asub:${k}" class="${this.asub === k ? 'on' : ''}">${n}</button>`).join('')}</div>${this.popLine()}${this.asub === 'squads' || this.asub === 'train' ? this.rallyLine() : ''}` + body();
  }
  rallyLine() { return `<div class="row">${this.btn(this.rallying ? '✖ Annuler' : '📍 Point de ralliement', this.rallying ? '' : 'par défaut : la placette', 'rally', false, this.rallying ? 'act warnb' : 'act')}${this.rallying ? '<div class="hint small">Touche la carte, dans la cour ou le village.</div>' : ''}</div>`; }
  squadsHtml() {
    const army = this.sim.army, q = army.squads.find(x => x.id === this.selSq);
    let h = '';
    if (!army.squads.length) h += '<div class="hint">Aucune escouade. Entraîne des soldats puis forme-en une avec ta réserve.</div>';
    if (army.squads.length) h += '<div class="hint small">👆 Touche une escouade (ici ou sur la carte), puis <b>touche la carte</b> : derrière la muraille = nouveau poste, devant = sortie.</div>';
    h += `<div class="sqlist">${army.squads.map(x => `<button class="chipb ${x.id === this.selSq ? 'on' : ''}" data-a="sqcard:${x.id}">${UNITS[x.type].ico}${x.n} <small>${x.mode === 'field' ? '⚔' : SECTOR_SHORT[x.sector]}</small></button>`).join('')}</div>`;
    if (q) {
      const U = UNITS[q.type], mx = army.maxN(q.type);
      h += `<div class="ptitle">${U.ico} ${U.name} ×${q.n}<span class="lvl">${q.mode === 'field' ? 'Sur le champ de bataille' : 'Garnison ' + SECTOR_SHORT[q.sector]}</span></div>
        <div class="hpline"><div class="bar big"><i style="width:${Math.min(100, q.hp / (mx * U.hp) * 100)}%"></i></div><span>${Math.round(q.hp)} PV · ${q.n}/${mx}</span></div>
        <div class="fgrid">${Object.keys(FORMATIONS).map(f => `<button class="fbtn ${q.form === f ? 'on' : ''}" data-a="form:${f}"><b>${FORMATIONS[f].ico}</b>${FORMATIONS[f].name}</button>`).join('')}</div>
        <div class="hint small">${FORMATIONS[q.form].info}</div>
        <div class="row">${this.btn(this.targeting ? '✖ Annuler' : '⚔ Sortir', this.targeting ? '' : 'puis touche la carte', 'sortie', false, this.targeting ? 'act warnb' : 'act')}${this.btn(q.stance === 'charge' ? '🔥 Charge' : '🛡 Tenir', 'posture', 'stance:' + (q.stance === 'charge' ? 'hold' : 'charge'), false)}</div>
        <div class="prio"><span>Garnison :</span>${SECTOR_SHORT.map((x, i) => `<button class="chipb ${q.mode === 'garrison' && q.sector === i ? 'on' : ''}" data-a="gar:${i}">${x}</button>`).join('')}</div>
        <div class="row">${this.btn('➕ Compléter', `réserve ${army.reserve[q.type]}`, 'reinf', q.n >= mx || army.reserve[q.type] <= 0)}${this.btn('Dissoudre', 'retour en réserve', 'disb', false, 'act sec')}</div>`;
      if (this.targeting) h += '<div class="warn">Touche le champ de bataille au-dessus pour envoyer l\'escouade.</div>';
    }
    h += `<div class="hint small">Nouvelle escouade (depuis la réserve) :</div><div class="row recruit">${['soldier', 'heavy', 'knight', 'cavalry'].map(t => this.btn(`${UNITS[t].ico} ${UNITS[t].name}`, `réserve ${army.reserve[t]} · max ${UNITS[t].squad}`, 'newsq:' + t, army.reserve[t] <= 0 || army.squads.length >= SQUAD.maxSquads)).join('')}</div>`;
    return h;
  }
  // bulle d'escouade (ancrée sur la carte) : ordres directs
  squadCard(q) {
    const army = this.sim.army, U = UNITS[q.type], mx = army.maxN(q.type), rk = army.rank(this.sim, q.type), F = FORMATIONS[q.form];
    const where = q.mode === 'field' ? '⚔ Sur le champ de bataille' : q.custom ? '🛡 Poste libre ' + SECTOR_SHORT[q.sector] : '🛡 Garnison ' + SECTOR_SHORT[q.sector];
    return `<div class="ptitle">${U.ico} ${U.name} ×${q.n}<span class="lvl">⭐ ${rk.name}</span></div>
      <div class="hpline"><div class="bar big"><i style="width:${Math.min(100, army.hpRatio(q) * 100)}%"></i></div><span>${Math.round(q.hp)} PV · ${q.n}/${mx}</span></div>
      <div class="hint small">${where}${q.way.length ? ' · en marche' : ''}</div>
      <div class="order">👆 <b>Touche la carte</b> pour l'envoyer : derrière la muraille = poste, devant = sortie.</div>
      <div class="fgrid">${Object.keys(FORMATIONS).map(f => `<button class="fbtn ${q.form === f ? 'on' : ''}" data-a="form:${f}"><b>${FORMATIONS[f].ico}</b>${FORMATIONS[f].name}</button>`).join('')}</div>
      <div class="hint small">${F.info}</div>
      <div class="row">${this.btn(q.stance === 'charge' ? '🔥 Charge' : '🛡 Tenir', 'posture', 'stance:' + (q.stance === 'charge' ? 'hold' : 'charge'), false, 'act slim')}${this.btn('➕', `réserve ${army.reserve[q.type]}`, 'reinf', q.n >= mx || army.reserve[q.type] <= 0, 'act slim')}${this.btn('↩', 'dissoudre', 'disb', false, 'act slim sec')}</div>
      <div class="prio"><span>Garnison :</span>${SECTOR_SHORT.map((x, i) => `<button class="chipb ${q.mode === 'garrison' && !q.custom && q.sector === i ? 'on' : ''}" data-a="gar:${i}">${x}</button>`).join('')}</div>`;
  }
  // ⭐ Rangs : où et comment faire monter chaque type d'unité ; ce que change le rang suivant
  ranksHtml() {
    const sim = this.sim, army = sim.army, E = sim.eco, B = sim.build; let h = '<div class="hint small">Le <b>niveau</b> de la caserne, de l\'écurie et du champ de tir est le <b>rang</b> de toutes leurs unités : plus fortes, plus résistantes, plus rapides — et une tenue de plus en plus imposante (de la tunique de recrue à l\'armure dorée de légende).</div>';
    for (const b of RANK_BUILDINGS) {
      const def = BUILDINGS[b], s = B.of(b), lv = E.level[b], types = UNIT_ORDER.filter(t => UNITS[t].from === b);
      const r = RANKS[Math.max(0, lv - 1)], nx = RANKS[lv], uc = s && s.state === 'built' ? B.upCost(s) : null;
      h += `<div class="card col"><div class="ct"><b>${def.ico} ${def.name}</b> <span class="lvl">${lv ? '⭐ ' + r.name : 'à construire'}</span><small>${types.map(t => `${UNITS[t].ico} ${UNITS[t].name}`).join(' · ')}</small></div>
        <div class="ranks">${RANKS.map((R, i) => `<span class="${i < lv ? 'got' : ''}${i === lv - 1 ? ' cur' : ''}" title="${R.name}">${i < lv ? '★' : '☆'}<small>${R.name}</small></span>`).join('')}</div>
        ${lv && nx ? `<div class="hint small">Rang suivant <b>${nx.name}</b> : force ×${nx.force} · résistance ×${nx.res} · vitesse ×${nx.speed} · coût des unités ×${nx.cost}</div>` : ''}
        <div class="row">${!s ? this.btn('Construire', this.cost(B.newCost(b)), 'bld:' + b, !E.afford(B.newCost(b)), 'act slim') : uc ? this.btn(`⬆ ${nx.name}`, this.cost(uc), 'up:' + s.id, !E.afford(uc), 'act slim') : s.state !== 'built' ? '<span class="max">en travaux…</span>' : '<span class="max">Légende atteinte</span>'}${s ? this.btn('Voir', '', 'go:' + s.id, false, 'act slim sec') : ''}</div></div>`;
    }
    const w = B.of('workshop'); h += `<div class="card"><div class="ct"><b>🛠 Atelier de siège</b> <span class="lvl">niv. ${E.level.workshop || 0}/3</span><small>Le niveau débloque les armes ET leur aspect : bois brut → ferrures → dorures, bannière et brasero (boulets enflammés).</small></div>${w ? this.btn('Voir', '', 'go:' + w.id, false, 'act slim sec') : ''}</div>`;
    return h;
  }
  // 🔮 Magicien : invocation, état, sorts (dans la fiche de la Maison du sorcier et l'onglet Magie)
  mageHtml(inCard) {
    const sim = this.sim, M = sim.mages, E = sim.eco, lv = M.level(sim), m = M.list[0];
    if (!inCard) { const nb = this.needBuild('wizard'); if (nb) return nb + '<div class="hint small">Le magicien est AUTONOME : il soigne les escouades blessées, referme les brèches et lance ses sorts tout seul, toujours à distance des zombies.</div>'; }
    const st = M.stats(sim), T = MAGE_TIERS[Math.max(0, Math.min(4, lv - 1))];
    let h = `<div class="card col mage"><div class="ct"><b>🧙 ${T.name}</b> <span class="lvl">niv. ${lv}/5</span><small>Agit seul selon l'urgence : soigner, réparer, frapper.</small></div>`;
    if (m) h += `<div class="hpline"><div class="bar"><i style="width:${100 * m.hp / st.hp}%"></i></div><span>❤ ${Math.round(m.hp)}</span></div><div class="hpline"><div class="bar mana"><i style="width:${100 * m.mana / st.mana}%"></i></div><span>✦ ${Math.round(m.mana)}</span></div><div class="hint small">En ce moment : <b>${m.action || '—'}</b></div>`;
    else if (M.summon) h += `<div class="hpline"><div class="bar big"><i style="width:${100 * (1 - M.summon.t / M.summon.full)}%"></i></div><span>invocation…</span></div>`;
    else if (M.respawn > 0) h += `<div class="hint">💀 Revient dans ${Math.ceil(M.respawn)} s</div>`;
    else h += `<div class="row">${this.btn('🔮 Invoquer le magicien', `${this.cost(MAGE.summon)} · 👥1`, 'summon', !M.canSummon(sim))}</div>`;
    h += `<div class="spells">${Object.entries(MAGE.spells).map(([k, S]) => `<span class="${S.level <= lv ? 'on' : 'off'}" title="${S.info}">${S.ico}<b>${S.name}</b><small>${S.level <= lv ? S.info : 'niv. ' + S.level}</small></span>`).join('')}</div>`;
    const ac = E.upgradeCost('arcana'); h += `<div class="row">${ac ? this.btn(`📖 Arcanes ${E.up.arcana + 1}`, this.cost(ac) + ' · mana +20 %', 'upg:arcana', !E.afford(ac) || lv < 1, 'act slim') : '<span class="max">Arcanes max</span>'}</div>`;
    if (!inCard) { const w = sim.build.of('wizard'); if (w) h += this.btn('Voir la maison', 'améliorer = magicien plus puissant', 'go:' + w.id, false, 'act slim sec'); }
    return h + '</div>';
  }
  trainHtml() {
    const sim = this.sim, army = sim.army, E = sim.eco; let h = '';
    for (const b of TRAIN_BUILDINGS) {
      const nb = this.needBuild(b); if (nb) { h += nb; continue; }
      const B = BUILDINGS[b], lv = E.level[b], q = army.queues[b], ex = sim.build.of(b);
      if (lv < 1) { h += `<div class="card"><div class="ct"><b>${B.ico} ${B.name}</b><small>Bloqué — un ouvrier doit repasser</small></div>${this.btn('Voir', '', 'go:' + ex.id, false, 'act slim sec')}</div>`; continue; }
      h += `<div class="card col"><div class="ct"><b>${B.ico} ${B.name}</b> <span class="lvl">${army.rank(sim, UNIT_ORDER.find(t => UNITS[t].from === b)).name} · niv. ${lv} · file ${q.length}/${army.queueMax(sim, b)}</span></div>`;
      if (q.length) h += `<div class="queue">${q.map((it, i) => `<span class="qi">${UNITS[it.type].ico}${i === 0 ? `<i style="width:${100 * (1 - it.t / it.full)}%"></i>` : ''}</span>`).join('')}<button class="chipb" data-a="cancel:${b}">↩ annuler</button></div>`;
      h += `<div class="row wrapr">` + UNIT_ORDER.filter(t => UNITS[t].from === b).map(t => {
        const U = UNITS[t], ok = army.canTrain(sim, t), uc = army.unitCost(sim, t);
        return this.btn(`${U.ico} ${U.name}`, ok ? `${this.cost(uc)} · ${army.trainTime(sim, b, t).toFixed(0)}s · 👥${U.pop}` : `Niv. ${U.minLevel} requis`, `train:${t}:1`, !ok || !E.afford(uc) || E.popRoom() < U.pop || q.length >= army.queueMax(sim, b)) + (ok ? this.btn('×5', '', `train:${t}:5`, !E.afford(uc) || E.popRoom() < U.pop * 2, 'sq wide') : '');
      }).join('') + '</div>';
      h += `<div class="hint small">Réserve : ${UNIT_ORDER.filter(t => UNITS[t].from === b).map(t => `${UNITS[t].ico}${army.reserve[t]}`).join(' ')}</div></div>`;
    }
    return h;
  }
  siegeHtml() {
    const sim = this.sim, S = sim.siege, E = sim.eco, lv = E.level.workshop, B = BUILDINGS.workshop;
    const nb = this.needBuild('workshop'); if (nb) return nb;
    let h = `<div class="card"><div class="ct"><b>${B.ico} ${B.name}</b> <span class="lvl">Niv. ${lv} · armes ${S.deployed()}/${S.cap(sim)}</span><small>${B.info}</small></div></div>`;
    h += `<div class="prio"><span>Secteur :</span>${SECTOR_SHORT.map((x, i) => `<button class="chipb ${this.siegeSec === i ? 'on' : ''}" data-a="sseg:${i}">${x} <small>${S.inSector(i)}/${SIEGE_RULES.slotsPerSector}</small></button>`).join('')}</div>`;
    for (const t of SIEGE_ORDER) {
      const D = SIEGE[t], locked = lv < D.level, off = locked || !S.canBuild(sim, t, this.siegeSec) || !E.afford(D.cost);
      h += `<div class="card"><div class="ct"><b>${D.ico} ${D.name}</b><small>${locked ? `Atelier niv. ${D.level} requis` : D.info}</small><small>${this.cost(D.cost)} · ${D.time}s · 👥${D.crew} · tir : ${this.cost(D.ammo)}</small></div>${this.btn('Poser', SECTOR_SHORT[this.siegeSec], 'sbuild:' + t, off, 'act slim')}</div>`;
    }
    if (S.queue.length) h += `<div class="queue">${S.queue.map((it, i) => `<span class="qi">${SIEGE[it.type].ico}${i === 0 ? `<i style="width:${100 * (1 - it.t / it.full)}%"></i>` : ''}</span>`).join('')}<button class="chipb" data-a="scancel">↩ annuler</button></div>`;
    if (S.weapons.some(w => w.noAmmo)) h += '<div class="warn">⚠ Munitions épuisées (pierre / fer) : une arme ne tire plus.</div>';
    for (const w of S.weapons) h += `<div class="row step"><span class="lab">${SIEGE[w.type].ico} ${SIEGE[w.type].name}<small class="sub">${SECTOR_SHORT[w.sector]}${w.noAmmo ? ' · sans munitions' : ''}</small></span>${this.btn('Démonter', '+ ½ ressources', 'sdis:' + w.id, false, 'act slim sec')}</div>`;
    return h;
  }
  // 🔨 Forge : attaque et défense de CHAQUE type d'unité, indépendantes du rang donné par son bâtiment
  forgeHtml() {
    const E = this.sim.eco; const nb = this.needBuild('forge'); if (nb) return nb;
    const mx = E.smithMax(), fl = E.level.forge;
    let h = `<div class="hint small">Attaque <b>+${SMITH.atk * 100} %</b> et défense <b>−${SMITH.def * 100} %</b> de dégâts reçus par niveau, <b>pour chaque type</b>, en plus du rang. Plafond actuel : <b>${mx}</b>${fl < 3 ? ` (forge niv. ${fl + 1} → ${Math.min(SMITH.max, SMITH.perForge * (fl + 1))})` : ''}.</div>`;
    h += '<div class="smith">';
    for (const t in SMITH.types) {
      const a = E.smith.atk[t], d = E.smith.def[t], ca = E.smithCost('atk', t), cd = E.smithCost('def', t);
      h += `<div class="srow"><b>${SMITH.types[t]}</b>
        <span class="sk">⚔ ${a}/${mx}</span>${ca ? this.btn('+1', this.cost(ca), `smith:atk:${t}`, !E.afford(ca), 'act slim sm') : '<span class="max">max</span>'}
        <span class="sk">🛡 ${d}/${mx}</span>${cd ? this.btn('+1', this.cost(cd), `smith:def:${t}`, !E.afford(cd), 'act slim sm') : '<span class="max">max</span>'}</div>`;
    }
    h += '</div>';
    { const fa = E.upgradeCost('fireArrows'), lk = E.level.forge < 2;
      h += `<div class="card"><div class="ct"><b>🔥 Flèches enflammées</b> <span class="lvl">${E.up.fireArrows}/${UPGRADES.fireArrows.max}</span><small>${lk ? 'Requiert : Forge niveau 2' : UPGRADES.fireArrows.info}</small></div>${fa ? this.btn(`Niv. ${E.up.fireArrows + 1}`, this.cost(fa), 'upg:fireArrows', lk || !E.afford(fa), 'act slim') : '<span class="max">max</span>'}</div>`; }
    const ac = E.upgradeCost('arcana'), wl = E.level.wizard < 1;
    h += `<div class="card"><div class="ct"><b>📖 Arcanes</b> <span class="lvl">${E.up.arcana}/${UPGRADES.arcana.max}</span><small>${wl ? 'Requiert : Maison du sorcier' : UPGRADES.arcana.info}</small></div>${ac ? this.btn(`Niv. ${E.up.arcana + 1}`, this.cost(ac), 'upg:arcana', wl || !E.afford(ac), 'act slim') : '<span class="max">max</span>'}</div>`;
    return h;
  }

  // ——— VILLAGEOIS ———
  workHtml() {
    const sim = this.sim, E = sim.eco, idle = E.idleCount(), pop = E.population(), cap = E.popCap(), builders = E.builderCount();
    let h = `<div class="pop"><span>👥 <b>${pop}</b>/${cap} · villageois ${E.villagers.length}<br>libres <b>${idle}</b> · 👷 ouvriers de chantier <b>${builders}</b></span>${this.btn('+ Villageois', this.cost(ECON.villagerCost), 'vil', pop >= cap || !E.afford(ECON.villagerCost), 'act slim')}</div>`;
    h += `<div class="hint small">Les villageois <b>libres</b> deviennent ouvriers dès qu'un chantier en demande. Sans libre, <b>+</b> emprunte un villageois à la tâche la moins urgente (↺) ; il y retourne quand on le retire ou quand la réparation est finie (🔁).</div>`;
    if (E.loans.length) h += `<div class="hint small">🔁 ${E.loans.length} villageois prêté${E.loans.length > 1 ? 's' : ''} : ${E.loans.map(l => `${l.from ? TASKS[l.from].ico : '💤'}→${TASKS[l.to].ico}`).join(' ')}</div>`;
    if (pop >= cap) h += `<div class="warn">Population au maximum : construis des 🏠 maisons (menu ⚒ Bâtir).</div>`;
    if (E.famine) h += `<div class="warn">⚠ Famine : la récolte est réduite de moitié. Ajoute des fermiers !</div>`;
    for (const t of TASK_ORDER) {
      const T = TASKS[t], n = E.assign[t], capT = E.taskCap(t), B = BUILDINGS[T.building], hasSlots = E.slots(T.building) > 0;
      let sub = `<i class="no">Construis : ${B.name}</i>`;
      if (hasSlots) { const left = T.deposit ? E.totalDeposit(t) : null, nx = E.extra[t] ? E.extra[t].filter(e => e.amount > 0).length : 0; sub = `+${E.rate[t].toFixed(2)}/s · places ${n}/${n + capT}` + (left !== null ? ` · gisement ${fmt(left)}` + (nx ? ` (+${nx} découvert${nx > 1 ? 's' : ''})` : '') + (t === 'wood' ? ' · 🌲 repousse' : '') + (left <= 0 ? ' ⚠ épuisé' : '') : ''); }
      h += `<div class="row step task"><span class="lab">${T.ico} ${T.name}<small class="sub">${sub}</small></span>${this.btn('−', '', `as:${t}:-1`, n <= 0, 'sq')}<b class="val">${n}${E.loans.some(l => l.to === t) ? '<small>🔁</small>' : ''}</b>${this.btn('+', idle <= 0 && E.donorFor(t) ? '↺' : '', `as:${t}:1`, (idle <= 0 && !E.donorFor(t)) || n >= capT, 'sq')}</div>`;
    }
    {
      const P = E.prospect;
      h += `<div class="card"><div class="ct"><b>🧭 Prospection</b><small>${P ? `Un villageois explore la campagne… ${Math.round(100 * P.t / P.dur)} %` : `Un villageois libre part ${PROSPECT.time} s et découvre un nouveau gisement ailleurs sur la carte.`}</small></div></div>`;
      if (!P) h += `<div class="row">${PROSPECT.res.map(r => this.btn(`${RES_INFO[r].ico || ''} ${RES_INFO[r].name}`, this.cost(PROSPECT.cost), 'pro:' + r, !E.canProspect(r), 'act slim')).join('')}</div>`;
    }
    {   // défricheurs et allumeurs : tâches sans bâtiment
      const nc = E.assign.clear, act = sim.frontier.active().length, nf = E.assign.fire, lit = sim.night.fires.filter(f => f.lit).length;
      h += `<div class="row step task"><span class="lab">🪓 Défricheurs<small class="sub">${act ? `${act} parcelle${act > 1 ? 's' : ''} en cours · bois rapporté` : 'touche une forêt sur les côtés du village pour la défricher'}</small></span>${this.btn('−', '', 'as:clear:-1', nc <= 0, 'sq')}<b class="val">${nc}</b>${this.btn('+', idle <= 0 && E.donorFor('clear') ? '↺' : '', 'as:clear:1', (idle <= 0 && !E.donorFor('clear')) || nc >= TASKS.clear.slots, 'sq')}</div>`;
      const P = sim.night.piles(), N = sim.night, fstate = N.isNight() ? 'nuit : feux allumés et ravitaillés' : N.nightSoon() ? 'la nuit approche : on allume' : N.building(sim) ? 'entre deux vagues : bûchers en préparation' : 'pendant l\'assaut : à l\'abri';
      h += `<div class="row step task"><span class="lab">🔥 Équipe des feux<small class="sub">Plaine : ${P.ready} bûcher${P.ready > 1 ? 's' : ''} prêt${P.ready > 1 ? 's' : ''}/${P.n}${P.lit ? ` · ${P.lit} en feu` : ''} · braseros ${lit - P.lit}/${N.fires.length - P.n} · ${fstate}${E.up.firecraft ? ` · savoir-faire niv. ${E.up.firecraft}` : ''}</small></span>${this.btn('−', '', 'as:fire:-1', nf <= 0, 'sq')}<b class="val">${nf}</b>${this.btn('+', idle <= 0 && E.donorFor('fire') ? '↺' : '', 'as:fire:1', (idle <= 0 && !E.donorFor('fire')) || nf >= TASKS.fire.slots, 'sq')}</div>`;
    }
    const dmg = this.damagedSegs(), n = E.assign.repair;
    h += `<div class="row step task"><span class="lab">🔧 Réparation muraille<small class="sub">${dmg ? dmg + ' tronçon(s) à réparer' : 'muraille intacte'} · pierre${sim.autoRepair ? ' · auto ✅' : ''}</small></span>${this.btn('−', '', 'as:repair:-1', n <= 0, 'sq')}<b class="val">${n}</b>${this.btn('+', idle <= 0 && E.donorFor('repair') ? '↺' : '', 'as:repair:1', (idle <= 0 && !E.donorFor('repair')) || n >= TASKS.repair.slots, 'sq')}</div>`;
    h += `<div class="prio"><span>Priorité :</span>${[['-1', 'Auto'], ...SECTOR_SHORT.map((x, i) => [String(i), x])].map(([v, l]) => `<button class="chipb ${E.repairPriority === +v ? 'on' : ''}" data-a="prio:${v}">${l}</button>`).join('')}</div>`;
    return h;
  }
  damagedSegs() { const w = this.sim.wall; let n = 0; for (let i = 0; i < 40; i++) if (w.hp[i] < w.segMax(i) - 0.5) n++; return n; }
  techHtml() {
    const E = this.sim.eco; let h = '<div class="tgrp">Où améliorer quoi ?</div><div class="where">' + [
      ['forge', '🔨 Forge', 'attaque et défense de chaque type d\'unité (indépendantes du rang)'], ['university', '🎓 Université', 'outils, chariots, chemins pavés, charrue, maçonnerie, apprentissage, savoir-faire des allumeurs'], ['infirmary', '🏥 Infirmerie', 'soigne les escouades au repos, sauve des blessés'], ['publicworks', '🛤 Travaux publics', 'trace des routes ; niveau = qualité de toutes les routes (terre battue, gravier, pavés)'], ['wizard', '🔮 Maison du sorcier', 'invoque le magicien ; son niveau = puissance du magicien ; Arcanes'],
      ['barracks', '🪖 Caserne · 🐎 Écurie · 🎯 Champ de tir', 'leur niveau = rang des unités (Recrue → Légende)'], ['workshop', '🛠 Atelier de siège', 'baliste, catapulte, trébuchet ; aspect des machines'],
      ['sawmill', '🪚 Scierie · ⛏ Carrière · ⛓ Mine · 🌾 Ferme', 'niveau = places et rendement ; de nouvelles installations apparaissent'],
    ].map(([b, n, d]) => `<button class="wrow" data-a="goto:${b}"><b>${n}</b><small>${d}</small></button>`).join('') + '<div class="wrow"><b>🧱 Muraille</b><small>touche un secteur pour le renforcer · 🗼 touche une tour pour l\'améliorer</small></div></div>';
    h += '<div class="tgrp">Village</div><div class="hint small">Les améliorations rendent les villageois plus rapides, plus chargés et plus efficaces — et se voient : outils plus beaux, brouettes puis charrettes, chemins pavés.</div>';
    const nb = this.needBuild('university'); if (nb) return h + nb;
    h += `<div class="hint small">🎓 Université niv. ${E.level.university} : améliorations jusqu'au niveau <b>${E.level.university + 1}</b>${E.level.university < 3 ? ' — améliore l\'université pour aller plus loin' : ''}.</div>`;
    for (const id in UPGRADES) {
      const U = UPGRADES[id]; if (U.group === 'army' || U.req !== 'university' || U.hidden) continue;
      const lv = E.up[id], c = E.upgradeCost(id), cap = E.upgradeCap(id);
      h += `<div class="card"><div class="ct"><b>${U.ico} ${U.name}</b> <span class="lvl">${lv}/${U.max}</span><small>${U.info}</small></div>${c ? this.btn(`Niv. ${lv + 1}`, this.cost(c), 'upg:' + id, !E.afford(c), 'act slim') : `<span class="max">${lv >= U.max ? 'max' : '🎓 niv. ' + lv}</span>`}</div>`;
    }
    return h;
  }
  showOver(on) {
    $('#over').classList.toggle('on', on);
    if (on) $('#over-stats').textContent = `Vague ${this.sim.wave} · ${this.sim.zombies.kills} zombies abattus · ${this.sim.stats.breaches} brèche(s)`;
  }
}
