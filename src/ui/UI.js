// Interface « parchemin » : la carte reste visible ; les menus apparaissent à la demande.
//  · pastilles de secteur sur la muraille · bulle contextuelle ancrée sur la structure touchée · feuille (Bâtir / Armée / Villageois / Savoir)
//  · placement tactile : fantôme à glisser, rotation, nombre d'ouvriers · aucun état de jeu ici (tout passe par les commandes de la simulation).
import { SECTORS, SECTOR_NAMES, SECTOR_AT, ARCHER_SLOTS, CASTLE, wallOff } from '../sim/constants.js';
import { PHASES, UNITS, UNIT_ORDER, SIEGE, SIEGE_ORDER, SIEGE_RULES, FORMATIONS, SQUAD, TASKS, BUILDINGS, STRUCT, BUILD, UPGRADES, RES, RES_INFO, ECON, PROSPECT, waveSpec, golemsFor, ZOMBIES, RANKS, RANK_BUILDINGS, MAGE, PRIEST, INFECTION, GRADES, DIFFICULTY, SMITH, INFIRMARY, FRONTIER, ROADWORKS, FIRE_KEEP, BARRACKS_ICO, SAWMILL_ICO, TIMING, TRAIN, TOWER } from '../content/medieval.js';
import { MAGE_TIERS } from '../render/Heroes.js';
import { FORMATS, idealFormat, quality } from '../render/config.js';
import { TRAIN_BUILDINGS } from '../sim/army.js';
import { installExtrasUI } from './ExtrasUI.js';

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const fmt = n => n >= 100000 ? Math.round(n / 1000) + 'k' : n >= 10000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : Math.floor(n).toString();   // compact : jamais plus de 4 caractères
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
    this.sel = -1; this.acc = 0; this.sheet = null; this.asub = 'squads'; this.nav = { build: null, army: null, folk: null, tech: null }; this.order = null; this.siegeSec = 2; this.selSq = 0; this.targeting = false; this.pressing = false;
    this.mode = 'idle'; this.place = null; this.card = null; this.html = { sheet: '', card: '', place: '' };
    this.top = $('#top'); this.dock = $('#dock'); this.sheetEl = $('#sheet'); this.cardEl = $('#card'); this.placeEl = $('#placebar'); this.badgesEl = $('#badges'); this.toasts = $('#toasts');
    // curseurs de volume (menu Paramètres) : lecture directe, sans toucher au reste de l'interface
    this.sheetEl.addEventListener('input', e => { const k = e.target.dataset?.vol; if (k && hooks.audio) hooks.audio.setVolume(k, +e.target.value / 100); });
    this.top.innerHTML = `
      <div class="rline">${RES.map(r => `<span class="rchip" id="r-${r}"><i>${RES_INFO[r].ico}</i><b>0</b></span>`).join('')}<span class="rchip pop" id="r-pop"><i>👥</i><b>0</b></span></div>
      <div class="wline"><div class="wave"><div class="wt"><b id="wave-title">Vague 1</b><span id="wave-phase" class="phase"></span></div><div class="cbar"><div class="bar thin" title="Avant la vague"><i id="calm-bar"></i></div><div class="bar" title="Points de vie du château"><i id="castle-bar"></i></div></div><button id="b-skip" class="launch" title="Lancer la vague maintenant">⚔ Lancer</button></div>
        <div class="tgroup"><button id="b-pause" class="rb" title="Pause / reprendre (Espace)">❚❚</button><button id="b-speed" class="rb spd" title="Vitesse du jeu (1-4)">1×</button></div><button id="b-turn" class="rb" title="Pivoter la vue (vers le sud / vers le nord)"><svg class="isvg cam" viewBox="0 0 32 32" aria-hidden="true"><path d="M7 11h4l2-3h6l2 3h4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="16" cy="17" r="3.6" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M4 7.5A13 13 0 0 1 16 2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M13.2 0.8 16.6 2.6 14.2 5.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M28 26.5A13 13 0 0 1 16 31.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18.8 33.2 15.4 31.4 17.8 28.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><button id="b-menu" class="rb">☰</button></div>`;
    this.dock.innerHTML = Object.entries(SHEETS).map(([k, n]) => { const [ic, ...t] = n.split(' '); return `<button class="dk" data-sheet="${k}" title="${t.join(' ')} (${{ build: 'B', army: 'T', folk: 'V', tech: 'K' }[k]})">${ic}<span>${t.join(' ')}</span></button>`; }).join('');
    this.badges = [];
    for (let s = 0; s < SECTORS; s++) {
      const b = el('button', 'badge', `<b>🧱</b><div class="bar"><i></i></div><small></small>`);   // pastille sans code : n'apparaît que si ce pan de muraille est abîmé ou attaqué
      b.addEventListener('click', e => { e.stopPropagation(); this.openCard({ kind: 'sector', id: s }); });
      this.badgesEl.appendChild(b); this.badges.push(b);
    }
    $('#b-skip').addEventListener('click', () => sim.skipPrep());
    // temps : un bouton pause/lecture, un bouton vitesse (1× → 2× → 4× → 8×) qui ne met jamais en pause
    this.pace = 1;
    $('.wave .wt').addEventListener('click', () => this.toggleWavePop());
    for (const r of RES) $('#r-' + r).addEventListener('click', () => this.resInfo(r));
    $('#b-pause').addEventListener('click', () => { if (this.deploy) return; sim.speed = sim.speed ? 0 : this.pace; this.syncTime(); });
    $('#b-speed').addEventListener('click', () => { this.pace = this.pace >= 8 ? 1 : this.pace * 2; if (sim.speed) sim.speed = this.pace; this.syncTime(); });
    $('#b-menu').addEventListener('click', () => this.toggleSheet('menu'));
    $('#b-turn').addEventListener('click', e => { this.cam.turn(); this.buzz(10); e.currentTarget.classList.toggle('on', this.cam.facingSouth()); this.toast(this.cam.facingSouth() ? '🧭 Vue vers le sud : le village et le château' : '🧭 Vue vers le nord : la muraille et la horde', 'info'); });
    $('#over-btn').addEventListener('click', () => { this.showOver(false); this.openSheet('newgame'); });
    this.dock.addEventListener('click', e => { const b = e.target.closest('[data-sheet]'); if (b) { this.buzz(12); b.classList.remove('tap'); void b.offsetWidth; b.classList.add('tap'); this.toggleSheet(b.dataset.sheet); } });
    this.dock.addEventListener('pointerdown', e => { const b = e.target.closest('.dk'); if (b) b.classList.add('down'); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) this.dock.addEventListener(ev, () => this.dock.querySelectorAll('.down').forEach(b => b.classList.remove('down')));
    for (const el0 of [this.sheetEl, this.cardEl, this.placeEl]) {
      el0.addEventListener('pointerdown', () => { this.pressing = true; this.pressEl = el0; });
      el0.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b && !b.disabled) { this.act(b.dataset.a); this.refresh(true); } });
    }
    addEventListener('pointerup', () => { setTimeout(() => { this.pressing = false; this.pressEl = null; this.refresh(true); }, 60); });
    // quitter la pose au clavier (Échap) ou au clic droit
    addEventListener('keydown', e => this.hotkey(e));   // raccourcis : Espace pause, 1-4 vitesse, B/T/V/K menus, M minimap, H aide
    addEventListener('keydown', e => { if (e.key === 'Escape') { if (this.mode !== 'idle') { this.cancelPlace(); this.refresh(true); } else if (this.card) this.closeCard(); else if (this.sheet) this.closeSheet(); } });
    addEventListener('contextmenu', e => { if (this.mode !== 'idle') { e.preventDefault(); this.cancelPlace(); this.refresh(true); } });
    // glisser le fantôme de construction avec le doigt (au lieu de déplacer la caméra)
    this.cam.ghostHit = (x, z) => this.mode !== 'idle' && this.place && Math.abs(x - this.place.x) < this.halfW() + 4 && Math.abs(z - this.place.z) < this.halfD() + 4;
    this.cam.ghostMove = (x, z) => this.moveGhost(x, z);
    this.prefs = { difficulty: 'normal', autoRepair: true, shake: true, fx: true, hints: true, ...loadPrefs() }; this.applyPrefs(true);
    this.refresh(true);
    this.buildMinimap(); this.startTuto();   // (v4.0) mini-carte et tutoriel guidé
    { const fx = document.createElement('button'); fx.id = 'fpvx'; fx.textContent = '✕ Quitter la vue'; fx.addEventListener('click', () => { this.act('x:fpvx'); }); document.getElementById('app').appendChild(fx); }
  }
  // réglages persistants (difficulté, réparation auto, secousses, effets) : appliqués à la partie et au rendu
  applyPrefs(init) {
    const p = this.prefs, sim = this.sim; if (init && this.hooks.resumed) { p.difficulty = sim.difficulty; p.autoRepair = sim.autoRepair; }
    sim.setDifficulty(p.difficulty); sim.autoRepair = p.autoRepair; this.rd.shakeOn = p.shake; if (this.rd.fx) this.rd.fx.setEnabled(p.fx);
    try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* sans stockage */ }
  }
  // ——— feuille ———
  // ——— aperçu de la vague : composition, ennemis nouveaux, conseil ———
  waveMix(v) {
    const sp = waveSpec(v), D = DIFFICULTY[this.sim.difficulty] || DIFFICULTY.normal, n = Math.round(sp.n * D.n), c = sp.frac.map(f => Math.round(f * n));
    for (const k in sp.extra) { const x = Math.round(sp.extra[k] * n); if (x) { c[+k] = x; c[0] -= x; } }
    c[6] = golemsFor(v); c[7] = sp.boss || 0; return { n, c };
  }
  // changement de saison : bandeau d'information avec l'effet sur les récoltes
  seasonNews() {
    const S = this.sim.extras.season(); if (this.lastSeason === S.name) return; const first = this.lastSeason == null; this.lastSeason = S.name; if (first) return;
    const txt = { Printemps: 'les champs reverdissent', 'Été': 'récoltes abondantes', Automne: 'l\'herbe roussit, les jours raccourcissent', Hiver: 'la neige tombe, les récoltes s\'effondrent' }[S.name] || '';
    setTimeout(() => this.toast(`${S.ico} ${S.name} : ${txt} · nourriture ×${String(S.food).replace('.', ',')}`, S.food < 0.8 ? 'warn' : 'info'), 1200);
  }
  newFoes() {
    const v = this.sim.wave; if (v < 2 || this.foesWarned === v) return; this.foesWarned = v;
    const a = this.waveMix(v).c, b = this.waveMix(v - 1).c, nw = a.map((x, t) => x > 0 && !(b[t] > 0) && t ? ZOMBIES[t].name : null).filter(Boolean);
    if (nw.length) setTimeout(() => this.toast(`⚠ Nouveaux ennemis à la vague ${v} : ${nw.join(', ')} — touche « Vague » pour les détails`, 'warn'), 2500);
  }
  toggleWavePop(force) {
    let p = $('#wave-pop'); const on = force ?? !(p && p.classList.contains('on'));
    if (!p) { p = el('div'); p.id = 'wave-pop'; document.getElementById('app').appendChild(p); p.addEventListener('click', () => this.toggleWavePop(false)); }
    p.classList.toggle('on', on); if (!on) return;
    const sim = this.sim, v = sim.phase === 'assault' || sim.phase === 'calm' ? sim.wave + (sim.phase === 'calm' ? 1 : 0) : sim.wave, { n, c } = this.waveMix(v), prev = v > 1 ? this.waveMix(v - 1).c : [];
    const ICO = ['🧟', '🏃', '🛡', '🦍', '🔨', '👹', '🗿', '👑', '🧗', '🤮', '🎈', '🐕'];
    const INFO = { 1: 'rapides, peu de PV', 2: 'encaissent beaucoup', 3: 'très solides, lents', 4: 'cassent la pierre vite', 6: 'ses coups font tomber les archers', 7: 'BOSS : énormes PV', 8: 'escaladent la muraille', 9: 'crachent de l\'acide sur la pierre', 10: 'explosent contre la muraille', 11: 'meute très rapide' };
    const rows = c.map((x, t) => x > 0 ? `<div class="wr${!(prev[t] > 0) && v > 1 && t ? ' new' : ''}"><span>${ICO[t]} ${ZOMBIES[t].name}</span><b>×${x}</b>${t && INFO[t] ? `<small>${INFO[t]}${!(prev[t] > 0) && v > 1 ? ' · NOUVEAU' : ''}</small>` : ''}</div>` : '').join('');
    const sp = waveSpec(v), tip = c[4] || c[9] || c[10] ? 'Renforce et répare la muraille : des casseurs de pierre arrivent.' : c[8] ? 'Des archers sur le chemin de ronde arrêtent les grimpeurs.' : c[11] || c[1] ? 'Des pièges et des archers ralentissent les rapides.' : 'Des archers sur la muraille suffisent au début.';
    p.innerHTML = `<div class="ptitle">${sim.phase === 'assault' ? '⚔ Vague en cours' : '🔭 Prochaine vague'} · ${v}</div><div class="hint small">≈ ${n} zombies · ${sp.sectors} secteur${sp.sectors > 1 ? 's' : ''} visé${sp.sectors > 1 ? 's' : ''} · butin ${Object.keys(sp.reward).map(k => RES_INFO[k].ico + sp.reward[k]).join(' ')}</div>${rows}<div class="hint small tip">💡 ${tip}</div>`;
  }
  hotkey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase(), sim = this.sim;
    if (k === ' ') { e.preventDefault(); $('#b-pause').click(); return; }
    if ('1234'.includes(k) && k.length === 1) { this.pace = [1, 2, 4, 8][+k - 1]; if (sim.speed) sim.speed = this.pace; this.syncTime(); this.toast(`⏩ Vitesse ${this.pace}×`, 'info'); return; }
    const sh = { b: 'build', t: 'army', v: 'folk', k: 'tech' }[k]; if (sh && SHEETS[sh]) { this.toggleSheet(sh); return; }
    if (k === 'h' || k === '?') this.toast('⌨ Espace pause · 1-4 vitesse · B bâtir · T armée · V villageois · K savoir · R pivoter · ZQSD/flèches caméra · Échap fermer', 'info');
  }
  toggleSheet(n) { if (this.sheet === n) this.closeSheet(); else this.openSheet(n); }
  openSheet(n, sub) { if (n === 'menu') this.volSnap = this.hooks.audio ? { ...this.hooks.audio.vol } : {}; if (this.mode !== 'idle') this.cancelPlace(); this.closeCard(); this.sheet = n; if (sub) { this.asub = sub; if (this.nav[n] !== undefined) this.nav[n] = sub; } else if (this.nav[n] !== undefined) this.nav[n] = null; this.sheetEl.classList.add('on'); this.html.sheet = ''; this.refresh(true); }
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
    if (this.trapMode) { this.trapTap(x, z); return; }
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
    if (this.deploy) {   // placement : choisir une escouade, puis l'endroit
      if (near) { this.depSel = near; this.rd.setSquad(near); this.buzz(10); this.renderOrder(); return; }
      if (this.depSel) { const q = sim.squad(this.depSel); sim.squadPlace(this.depSel, x, z); this.rd.orderPing(x, z, q && q.mode === 'field'); this.buzz(15); this.depSel = 0; this.rd.setSquad(0); this.renderOrder(); this.refresh(true); }
      return;
    }
    // ordre en attente (choisi dans la bulle ou la fiche) : ce toucher est la destination
    if (this.order) {
      const o = this.order, q = sim.squad(o.id); if (!q) { this.endOrder(); return; }
      if (o.kind === 'sortie') { if (z >= SQUAD.sortieZ[0] - 6 && z <= SQUAD.sortieZ[1] + 4) { sim.squadSortie(o.id, x, z); this.rd.orderPing(x, z, true); this.toast(`⚔ ${UNITS[q.type].name} ×${q.n} : sortie !`, 'warn'); this.endOrder(); this.refresh(true); } else this.toast('⚠ Touche le champ de bataille, devant la muraille', 'warn'); return; }
      this.orderSquad(o.id, x, z); this.endOrder(); return;
    }
    if (this.card?.kind === 'squad' && near && near !== this.card.id) { this.openSquad(near); return; }
    const s = this.pickStruct(x, z);
    if (s) { this.openCard({ kind: 'struct', id: s.id }); return; }
    { const r = this.resAt(x, z); if (r) { this.openCard({ kind: 'res', t: r.t, si: r.si }); return; } }
    if (Math.hypot(x - CASTLE.x, z - CASTLE.z) < 22) { this.openCard({ kind: 'castle', id: 0 }); return; }
    if (near) { this.openSquad(near); return; }
    if (z > 70 && z < 168) { this.openCard({ kind: 'sector', id: Math.min(4, Math.max(0, (x / 40) | 0)) }); return; }
    this.closeCard(); if (this.sheet) this.closeSheet();
  }
  // parcelle de forêt vierge : défricher (si elle touche une terre ouverte), avancement, bois et minerai éventuel
  // ——— gisements : toucher un filon / la forêt des bûcherons → ce qu'il reste à extraire ———
  resSites() {
    const E = this.sim.eco, out = [];
    for (const t of ['wood', 'stone', 'iron', 'gold']) {
      const T = TASKS[t]; if (T.deposit) out.push({ t, si: -1, x: T.site.x, z: T.site.z, r: t === 'wood' ? 15 : 8 });
      (E.extra[t] || []).forEach((e, i) => out.push({ t, si: i, x: e.x, z: e.z, r: 7 }));
    }
    return out;
  }
  resAt(x, z) { let best = null, bd = Infinity; for (const o of this.resSites()) { const d = Math.hypot(x - o.x, z - o.z); if (d < o.r && d < bd) { bd = d; best = o; } } return best; }
  resPos(c) { const o = this.resSites().find(q => q.t === c.t && q.si === c.si); return o || { x: 100, z: 250 }; }
  resCard(c) {
    const E = this.sim.eco, t = c.t, T = TASKS[t], R = RES_INFO[t], ex = c.si >= 0 ? E.extra[t][c.si] : null;
    const left = Math.max(0, Math.round(c.si < 0 ? E.deposit[t] : ex.amount)), max = c.si < 0 ? T.deposit : ex.max, pct = max ? left / max : 0;
    const INFO = {
      wood: ['🌲 Forêt des bûcherons', 'Sapins et épicéas abattus par les bûcherons de la scierie. La forêt repousse d\'elle-même si on lui laisse le temps.'],
      stone: ['🪨 Carrière de pierre', 'Grès gris taillé en blocs : murailles, réparations, tours et bâtiments.'],
      iron: ['⛏ Filon de fer', 'Minerai rouge-brun (hématite) extrait par les mineurs : armes, armures, munitions des balistes.'],
      gold: ['✨ Filon d\'or', 'Quartz veiné d\'or natif, rare : recrutement des troupes d\'élite, améliorations, magie.'],
    }[t];
    const workers = E.villagers.filter(v => v.task === t && (c.si < 0 ? v.si < 0 || v.si == null : v.si === c.si)).length, rate = workers * (T.rate || 1);
    const eta = rate > 0 && left > 0 ? Math.ceil(left / rate / 60) : 0;
    let h = `<div class="ptitle">${INFO[0]}<span class="lvl">${ex ? (ex.found ? 'découvert' : ex.start ? 'gisement' : 'prospecté') : 'principal'}</span></div>`;
    h += `<div class="hint small">${INFO[1]}</div>`;
    h += `<div class="hpline"><div class="bar big"><i style="width:${Math.round(pct * 100)}%"></i></div><span>${R.ico} <b>${fmt(left)}</b> / ${fmt(max)}</span></div>`;
    h += `<div class="hint small">${left <= 0 ? '⚠ Épuisé' : workers ? `👷 ${workers} au travail · épuisé dans ~${eta} min` : 'Personne n\'y travaille en ce moment'}${t === 'wood' && T.regen ? ` · repousse +${T.regen}/s` : ''}</div>`;
    h += `<div class="hint small">Total ${R.name.toLowerCase()} restant (tous gisements) : <b>${fmt(E.totalDeposit(t))}</b></div>`;
    return h;
  }
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
      case 'x': this.extrasAct(x, y); break;   // systèmes v4.0 (ExtrasUI.js)
      case 'quality': this.rd.setQuality(x); this.html.sheet = ''; this.refresh(true); break;
      case 'newgame': this.openSheet('newgame'); break;
      case 'start': if (this.sim.over || confirm('Commencer une nouvelle partie ? La partie en cours sera perdue.')) { this.prefs.difficulty = this.newDiff || this.prefs.difficulty; this.closeSheet(); this.hooks.newGame(x, this.newMode); this.applyPrefs(); if (this.newMode?.intro) this.toast('📜 ' + this.newMode.intro, 'info'); } break;
      case 'ndiff': this.newDiff = x; this.html.sheet = ''; break;
      case 'gfxadv': this.gfxAdv = true; this.html.sheet = ''; break;
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
      case 'ua': { const was = sim.army.autoArchers; sim.assignArchers(s, +y); if (was) this.toast('🏹 Placement manuel : les archers ne bougent plus seuls (réactivable dans Armée › Escouades)', 'info'); break; }
      case 'wall': sim.upgrade(s); break;
      case 'sseg': this.siegeSec = +x; break;
      case 'sbuild': sim.buildSiege(x, this.siegeSec); break;
      case 'scancel': sim.cancelSiege(); break;
      case 'sdis': sim.dismantleSiege(+x); break;
      case 'train': sim.train(x, +y); break;
      case 'cancel': sim.cancelTrain(x); break;
      case 'asub': this.asub = x; this.nav.army = x; break;
      case 'nav': this.nav[x] = y || null; if (y && y.startsWith('sq.')) this.pickSquad(+y.slice(3)); this.html.sheet = ''; break;
      case 'sqgo': { const q = sim.squad(this.selSq); if (!q) break; this.startOrder(q.id, x); break; }
      case 'ordercancel': this.endOrder(); break;
      case 'deploy': this.startDeploy(); break;
      case 'deployend': this.endDeploy(); break;
      case 'invitex': this.invite = false; this.renderOrder(); break;
      case 'regroup': { const q = sim.squad(this.selSq); if (q && sim.squadRegroup(q.id, x)) { this.toast(`⬆ ${this.unitName(q)} formé : ${q.n} hommes`, 'ok'); } break; }
      case 'split': { const q = sim.squad(this.selSq); if (q) { const k = sim.army.split(q, x); this.toast(k ? `⬇ Troupe séparée en ${k + 1} ${GRADES[x].plural.toLowerCase()}` : 'Pas assez d\'hommes pour séparer', k ? 'ok' : 'warn'); this.nav.army = 'squads'; } break; }
      case 'sqauto': { sim.squadAuto(this.selSq); this.toast('⚜ L\'escouade est autonome', 'info'); break; }
      case 'autoarch': { sim.setAutoArchers(!sim.army.autoArchers); this.toast(sim.army.autoArchers ? '🏹 Les archers se placent seuls sur les remparts' : '🏹 Placement manuel des archers (touche un secteur)', 'info'); break; }
      case 'sqorders': { const id = this.selSq; this.openSheet('army'); this.nav.army = 'sq.' + id; this.pickSquad(id); break; }
      case 'sqsee': { const q = sim.squad(this.selSq); if (q) { this.closeSheet(); this.cam.focusOn(q.x, q.z); this.openSquad(q.id); } break; }
      case 'sq': this.pickSquad(+x); break;
      case 'newsq': { const g = y || 'escouade', q = sim.formSquad(x, GRADES[g].size, 2, g); if (q) { this.pickSquad(q.id); this.nav.army = 'sq.' + q.id; this.toast(`${UNITS[x].ico} ${GRADES[g].name} formé${g === 'escouade' ? 'e' : ''} : choisis maintenant où l'envoyer`, 'ok'); } break; }
      case 'form': sim.squadForm(this.selSq, x); break;
      case 'stance': sim.squadStance(this.selSq, x); break;
      case 'gar': { sim.squadGarrison(this.selSq, +x); this.endOrder(); const q = sim.squad(this.selSq); if (q) this.toast(`🛡 ${UNITS[q.type].name} ×${q.n} : rentre garder ${SECTOR_AT[+x]}`, 'info'); break; }
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
        if (x === 'fmt') H.setGfx(y); else H.setGfx(null, x === 'shadows' ? { shadows: !q.shadows } : x === 'glow' ? { glow: !q.glow } : x === 'grass' ? { grass: q.grass >= 0.7 ? 0.35 : 1 } : x === 'post' ? { post: !q.post } : { pixelRatio: q.pixelRatio >= 1.5 ? 1 : 2 });
        this.html.sheet = ''; break; }
      case 'pref': { const p = this.prefs; if (x === 'difficulty') p.difficulty = y; else p[x] = !p[x]; this.applyPrefs(); this.html.sheet = ''; break; }
      case 'guide': this.guideOn = !this.guideOn; this.html.sheet = ''; break;
      case 'secgo': this.cam.focusOn(+x * 40 + 20, 150); this.openCard({ kind: 'sector', id: +x }); break;
      case 'goto': { const t = sim.build.of(x); if (t) { this.cam.focusOn(t.x, t.z); this.openCard({ kind: 'struct', id: t.id }); } else this.startPlace(x); break; }
    }
  }
  // toast : kind = 'info' | 'ok' | 'warn' | 'danger' (couleur et durée) ; les messages identiques consécutifs sont regroupés (×2, ×3…)
  syncTime() {
    const sp = this.sim.speed, p = $('#b-pause'), v = $('#b-speed'); if (!p) return;
    p.textContent = sp ? '❚❚' : '▶'; p.classList.toggle('on', !sp); p.title = sp ? 'Mettre en pause' : 'Reprendre';
    v.textContent = this.pace + '×'; v.classList.toggle('fast', this.pace > 1);
    document.body.classList.toggle('paused', !sp && !this.deploy);
  }
  // Grand bandeau au changement de moment : calme (on bâtit) / vague (chantiers en pause).
  phaseBanner(p) {
    const T = { prep: ['🌿 Temps calme', 'Construis, recrute, prépare la défense'], alert: ['🔔 Alerte', 'La horde approche'], assault: ['⚔ Vague en cours', 'Défends la muraille'], calm: ['🕊 Vague repoussée', 'Souffle un peu'] }[p];
    if (!T) return; let el = document.getElementById('phase-banner');
    if (!el) { el = document.createElement('div'); el.id = 'phase-banner'; document.body.appendChild(el); }
    el.dataset.p = p; el.innerHTML = `<b>${T[0]}</b><small>${T[1]}</small>`; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    clearTimeout(this.pbT); this.pbT = setTimeout(() => el.classList.remove('on'), 3200);
  }
  toast(msg, kind = 'info') {
    const last = this.toasts.lastElementChild;
    if (last && last.dataset.msg === msg && last.dataset.k === kind) { const n = (+last.dataset.n || 1) + 1; last.dataset.n = n; last.innerHTML = `${msg} <b class="tn">×${n}</b>`; clearTimeout(last._t); last._t = setTimeout(() => last.remove(), 3000); return; }
    const t = el('div', 'toast ' + kind, msg); t.dataset.msg = msg; t.dataset.k = kind; this.toasts.appendChild(t);
    t._t = setTimeout(() => t.remove(), kind === 'danger' ? 4500 : kind === 'warn' ? 3800 : 3000);
    while (this.toasts.children.length > 2) this.toasts.firstChild.remove();   // épuré : deux messages au plus
    if (kind === 'danger' && UI_FLAGS.haptics) this.buzz([40, 40, 80]);
  }
  buzz(p) { if (UI_FLAGS.haptics && navigator.vibrate) try { navigator.vibrate(p); } catch { /* non supporté */ } }
  onEvent(e) {
    const sim = this.sim; this.extrasEvent(e);
    if (e.type === 'bitten') { if (!this.lastBite || performance.now() - this.lastBite > 2500) { this.lastBite = performance.now(); this.toast(`🧟 ${UNITS[e.unit].name} mordu${e.tackle ? ', plaqué au sol' : ''} ! ${this.sim.infection.prison(this.sim) ? 'Il doit rejoindre la zone de quarantaine' : 'La quarantaine est pleine : il erre près de la placette…'}`, 'warn'); } }
    else if (e.type === 'cured') this.toast(`⛪ Le prêtre a guéri un ${UNITS[e.unit].name.toLowerCase()} mordu : il retourne en réserve`, 'ok');
    else if (e.type === 'turned') { this.toast(`☠ Un ${UNITS[e.unit].name.toLowerCase()} mordu s'est transformé en zombie !`, 'danger'); this.buzz([60, 40, 60]); }
    else if (e.type === 'turnedJail') this.toast('🚧 Un mordu s\'est transformé en quarantaine : les gardes l\'ont abattu', 'warn');
    else if (e.type === 'devoured') this.toast(`🩸 Les zombies ont dévoré un ${UNITS[e.unit].name.toLowerCase()} à terre`, 'danger');
    else if (e.type === 'repelled') this.toast('⚔ L\'escouade a repoussé le soldat transformé', 'info');
    if (e.type === 'priestArrived') { this.toast('⛪ Un prêtre s\'installe à l\'église : il bénira les défenseurs pendant les assauts', 'ok'); }
    if (e.type === 'built') { const d = STRUCT[e.what]; this.toast(e.kind === 'site' ? `${d.ico} ${d.name} terminé !` : e.kind === 'upgrading' ? `⬆ ${d.name} amélioré` : `✥ ${d.name} remis en service`); }
    else if (e.type === 'breach') { this.toast(`💥 Brèche près de ${SECTOR_AT[e.s]} ! Envoyez des renforts`, 'danger'); this.flashScreen('danger') }
    else if (e.type === 'repair') this.toast(`🔧 Muraille réparée près de ${SECTOR_AT[e.s]}`, 'ok');
    else if (e.type === 'waveStart') { this.invite = false; this.renderOrder(); const t = (sim.targets || []).map(s => SECTOR_AT[s]).join(', '); this.toast(`🌊 Vague ${e.wave} — attaque : ${t || '?'}`, 'warn'); this.flashScreen('warn'); this.buzz(60); }
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
    else if (e.type === 'autoFormed') { const p = []; if (e.formed) p.push(`${e.formed} nouvelle${e.formed > 1 ? 's' : ''} troupe${e.formed > 1 ? 's' : ''}`); if (e.merged) p.push(`${e.merged} fusion${e.merged > 1 ? 's' : ''} en peloton ou escadron`); if (e.filled) p.push(`+${e.filled} renforts`); this.toast(`⚜ Après la vague : ${p.join(' · ')}`, 'ok'); }
    else if (e.type === 'earlyBonus') this.toast(`⚡ Vague lancée en avance : +${e.gold} ${RES_INFO.gold.ico}`, 'ok');
    else if (e.type === 'waveEnd' && this.rd.fx && !this.celebrated?.[e.wave]) { (this.celebrated ||= {})[e.wave] = 1; const fx = this.rd.fx; for (let k = 0; k < 5; k++) setTimeout(() => { fx.burst(CASTLE.x + (Math.random() - 0.5) * 30, 22 + Math.random() * 6, CASTLE.z + (Math.random() - 0.5) * 16, 26, 6, 5, 1.6, 0.35, 3, [1, 0.82, 0.35], true); fx.ring && fx.ring(CASTLE.x, CASTLE.z, 30, 0.8, [1, 0.85, 0.4]); }, k * 260); }
    if (e.type === 'waveEnd') { if (sim.army.squads.length) { this.invite = true; setTimeout(() => this.renderOrder(), 50); } const r = e.reward || {}; this.toast(`🏆 Vague ${e.wave} repoussée · ${Object.keys(r).map(k => `+${r[k]} ${RES_INFO[k].ico}`).join(' ')}`, 'ok'); this.buzz([30, 30, 30]); }
  }
  // ——— mise à jour de l'affichage ———
  refresh(force) {
    const sim = this.sim, w = sim.wall, army = sim.army, E = sim.eco;
    this.trackIncome();
    for (const r of RES) { const e = $('#r-' + r); e.querySelector('b').textContent = fmt(E.res[r]); { const g = Math.round(this.incomeOf(r)), sm = e.querySelector('small') || e.appendChild(el('small')); sm.textContent = g > 0 ? '+' + g : ''; } e.classList.toggle('full', E.res[r] >= E.cap(r) - 0.5); e.classList.toggle('low', r === 'food' && E.famine); }
    if (this.plainLitShown && this.sim.night.light() > 0.97) this.plainLitShown = false;
    const pop = $('#r-pop'); pop.querySelector('b').textContent = `${E.population()}/${E.popCap()}`; pop.classList.toggle('max', E.popRoom() <= 0);
    $('#wave-title').textContent = `Vague ${sim.wave}`;
    const zl = sim.zombies.n + (sim.spawn ? sim.spawn.left : 0);
    $('#wave-phase').textContent = `${sim.extras.season().ico}${{ clear: '', rain: '🌧', fog: '🌫', snow: '❄' }[sim.extras.weather]} ` + (sim.phase === 'assault' ? `⚔ ${zl} zombie${zl > 1 ? "s" : ""}${sim.zombies.kills - (this.killsAt ?? sim.zombies.kills) > 0 ? ` · 💀${sim.zombies.kills - this.killsAt}` : ''}` : sim.phase === 'alert' ? `🔔 Ils arrivent ${Math.ceil(Math.max(0, sim.timer))}s` : sim.phase === 'calm' ? '🕊 Répit' : `🌿 ${Math.floor(Math.max(0, sim.timer) / 60)}:${String(Math.floor(Math.max(0, sim.timer) % 60)).padStart(2, '0')}`);
    if (this.lastPhase !== sim.phase) { if (this.lastPhase) this.phaseBanner(sim.phase); this.lastPhase = sim.phase; if (sim.phase === 'prep') { this.newFoes(); this.seasonNews(); } if (sim.phase === 'assault') this.killsAt = sim.zombies.kills; }
    $('#wave-phase').dataset.p = sim.phase; $('#b-skip').style.display = sim.phase === 'prep' ? '' : 'none';
    { const eb = sim.earlyBonus(), bs = $('#b-skip'), lab = eb > 0 ? `⚔<span class="lt"> Lancer</span> <small>+${eb}${RES_INFO.gold.ico}</small>` : '⚔ Lancer'; if (bs.dataset.l !== lab) { bs.dataset.l = lab; bs.innerHTML = lab; bs.title = eb > 0 ? `Lancer la vague maintenant : +${eb} or pour le temps gagné` : 'Lancer la vague maintenant'; } }
    { const tot = sim.phase === 'prep' ? (sim.wave === 1 ? TIMING.firstPrep : TIMING.prep) : sim.phase === 'alert' ? TIMING.alert : sim.phase === 'calm' ? TIMING.calm : 0, cb = $('#calm-bar');
      const asl = sim.phase === 'assault' && sim.spawn && sim.spawn.total > 0;   /* pendant la vague : part de la horde encore debout */
      cb.parentNode.style.display = tot || asl ? '' : 'none'; if (tot) cb.style.width = (100 * Math.max(0, sim.timer) / tot) + '%'; else if (asl) cb.style.width = Math.min(100, 100 * zl / sim.spawn.total) + '%'; cb.parentNode.dataset.p = sim.phase; cb.parentNode.title = asl ? 'Horde restante' : 'Avant la vague'; }
    if (!!sim.speed === document.body.classList.contains('paused') || (this.deploy && document.body.classList.contains('paused'))) this.syncTime();
    { const cr = sim.castleHp / CASTLE.hp, cbx = $('#castle-bar'); cbx.style.width = (100 * cr) + '%'; cbx.style.background = cr > 0.6 ? '' : cr > 0.3 ? '#e0a43a' : '#d2452e';
      if (this.lastCastle != null && sim.castleHp < this.lastCastle - 1) { cbx.parentNode.classList.remove('hit'); void cbx.offsetWidth; cbx.parentNode.classList.add('hit'); if (!this.castleWarn || sim.time - this.castleWarn > 30) { this.castleWarn = sim.time; this.toast(`🏰 Le château est attaqué ! (${Math.round(cr * 100)} %)`, 'danger'); } }
      this.lastCastle = sim.castleHp; }
    { let br = 0; for (let s2 = 0; s2 < SECTORS; s2++) br += w.breaches(s2); const vg = sim.phase === 'assault' && (br > 0 || sim.castleHp < CASTLE.hp * 0.5); document.body.classList.toggle('danger-vig', vg); if (vg && !$('#vig')) document.getElementById('app').appendChild(el('div')).id = 'vig'; }   /* (v8.0) bords rouges : brèche ouverte ou château à moins de 50 % */
    let alert = false;
    for (let s = 0; s < SECTORS; s++) {
      const c = this.badges[s], hp = w.sectorHp(s) / w.sectorMax(s), dg = sim.danger(s), tgt = sim.phase === 'alert' && sim.targets.includes(s);
      if (dg === 2) alert = true;
      c.className = 'badge' + (this.card?.kind === 'sector' && this.card.id === s ? ' sel' : '') + (dg === 2 ? ' d2' : dg === 1 ? ' d1' : '') + (tgt ? ' tgt' : '') + (w.breaches(s) ? ' breach' : '');
      c.querySelector('.bar i').style.width = (hp * 100) + '%'; c.dataset.show = hp < 0.98 || dg || tgt || w.breaches(s) || (this.card?.kind === 'sector' && this.card.id === s) ? '1' : '';
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
  // pas de réécriture pendant un appui : sinon le bouton visé est remplacé entre pointerdown et click et le clic se perd (✖ / ✔ de la pose)
  setHtml(key, el0, html) { if (this.html[key] === html || this.pressing && this.pressEl === el0) return; const keep = el0.scrollTop; this.html[key] = html; el0.innerHTML = html; el0.scrollTop = keep; }
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
    return this.modesHtml() + `<div class="hint">Choisis le <b>niveau graphique</b> : celui qui convient le mieux à ton appareil est recommandé ; modifiable à tout moment dans ☰ Paramètres.</div>
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
      <div class="row">${[['phone', 'Faible', 'fluide partout'], ['tablet', 'Moyen', 'ombres, lueurs'], ['desktop', 'Élevé', 'tout, relief et halo']].map(([k, n, sub]) => this.btn(n, k === fmt ? (this.sim.gfx ? 'actuel, modifié' : 'actuel') : sub, 'gfx:fmt:' + k, false, 'act' + (k === fmt ? '' : ' sec'))).join('')}</div>
      ${this.gfxAdv ? '' : `<div class="row">${this.btn('⚙ Réglages avancés', '', 'gfxadv', false, 'act slim sec')}</div>`}<div class="row wrapr" style="${this.gfxAdv ? '' : 'display:none'}">${gt('shadows', q.shadows, 'Ombres', 'plus joli, plus lourd')}${gt('glow', q.glow, 'Lueurs', 'torches, feux, impacts')}${gt('grass', q.grass >= 0.7, 'Herbe dense', '')}${gt('res', q.pixelRatio >= 1.5, 'Haute résolution', 'image plus nette')}${gt('post', !!q.post, 'Relief et halo', 'occlusion ambiante, halo des feux')}</div></div>`;
    const p = this.prefs, tog = (k, l, sub) => this.btn(`${p[k] ? '✅' : '⬜'} ${l}`, sub, 'pref:' + k, false, 'act slim' + (p[k] ? '' : ' sec'));
    const game = `<div class="vols"><div class="hint small"><b>Difficulté</b> (vagues suivantes)</div><div class="row">${Object.keys(DIFFICULTY).map(k => this.btn(DIFFICULTY[k].name, k === 'easy' ? '−25 % zombies' : k === 'hard' ? '+30 % zombies, +15 % PV' : '', 'pref:difficulty:' + k, false, 'act slim' + (k === p.difficulty ? '' : ' sec'))).join('')}</div>
      <div class="row wrapr">${tog('autoRepair', 'Réparation auto', 'emprunte 2 villageois')}${tog('shake', 'Secousses', 'explosions')}${tog('fx', 'Effets', 'particules, feu')}${tog('hints', 'Aides à l\'écran', 'conseils, objectifs, ⬆')}</div></div>`;
    return `<div class="hint">Castle Invasion · <b>v${VERSION}</b></div>${this.guideHtml()}${game}${this.savesHtml()}${audio}${qual}${this.achHtml()}<div class="row">${this.btn('🔄 Nouvelle partie', 'la partie en cours sera perdue', 'newgame', false, 'act warnb')}</div>`;
  }
  // guide repliable : bases du jeu, bestiaire, raccourcis
  guideHtml() {
    if (!this.guideOn) return `<div class="row">${this.btn('📖 Guide du défenseur', 'bases, bestiaire, raccourcis', 'guide', false, 'act slim sec')}</div>`;
    const ICO = ['🧟', '🏃', '🛡', '🦍', '🔨', '👹', '🗿', '👑', '🧗', '🤮', '🎈', '🐕'];
    const NOTE = ['le gros de la horde', 'rapide, fragile', 'encaisse beaucoup', 'très solide, lent', 'casse la pierre très vite', 'géant : mène une horde', 'ses coups font tomber les archers', 'boss toutes les 10 vagues', 'escalade la muraille', 'acide à distance sur la pierre', 'explose contre la muraille', 'meute très rapide'];
    const best = ZOMBIES.map((z, t) => `<div class="gz"><span>${ICO[t]} <b>${z.name}</b></span><small>❤ ${z.hp} · 🏃 ${z.speed} m/s · 🧱 ${z.wall}/s — ${NOTE[t]}</small></div>`).join('');
    return `<div class="vols guide"><div class="hint small"><b>📖 Guide du défenseur</b> <button class="lnk" data-a="guide">replier</button></div>
      <div class="hint small">① Le <b>temps calme</b> sert à bâtir, récolter, recruter. ② À l'<b>alerte</b>, les secteurs visés clignotent. ③ Pendant la <b>vague</b>, les archers tirent seuls ; les réparateurs referment les brèches. Si le château tombe, la partie est perdue.</div>
      <div class="hint small">💡 Lancer la vague en avance rapporte de l'or. Les stocks pleins gaspillent la récolte : bâtis entrepôt et grenier. Une maison améliorée loge beaucoup plus de monde.</div>
      <div class="hint small"><b>Bestiaire</b></div>${best}
      <div class="hint small"><b>Raccourcis</b> : Espace pause · 1-4 vitesse · B bâtir · T armée · V villageois · K savoir · R pivoter · ZQSD / flèches caméra · Échap fermer</div></div>`;
  }
  renderCard() {
    const c = this.card; if (!c) return;
    let html = '';
    if (c.kind === 'struct') { const s = this.sim.build.get(c.id); if (!s) { this.closeCard(); return; } html = this.structCard(s); }
    else if (c.kind === 'sector') html = this.sectorCard(c.id); else if (c.kind === 'squad') { const q = this.sim.squad(c.id); if (!q) { this.closeCard(); return; } html = this.squadCard(q); } else if (c.kind === 'patch') html = this.patchCard(this.sim.frontier.patches[c.id]); else if (c.kind === 'res') html = this.resCard(c); else html = this.castleCard();
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
    this.acc += dt; if (this.acc > 0.2) { this.acc = 0; this.updateRange(); this.watchRepairs(); this.refresh(false); this.drawMinimap(); this.renderEvent(false); this.tickTuto(); this.tickQuest(); this.renderAdvice(); if ((this.achT = (this.achT || 0) + 1) % 10 === 0) this.checkAch(); }
    const vw = innerWidth, vh = innerHeight;
    for (let s = 0; s < SECTORS; s++) {
      const p = this.rd.project(s * 40 + 20, 8, 143 + wallOff(s * 40 + 20)), b = this.badges[s];
      const onScr = p.vis && p.x > 0 && p.x < vw && p.y > 90 && p.y < vh - 90;
      b.style.display = b.dataset.show && onScr ? '' : 'none'; b.style.left = p.x + 'px'; b.style.top = p.y + 'px';
      this.edgeArrow(s, p, onScr, vw, vh);
    }
    this.bigBars(vw, vh); this.upMarks(vw, vh); this.squadTags(vw, vh);
    const c = this.card; if (!c) return;
    let a;
    if (c.kind === 'struct') { const s = this.sim.build.get(c.id); if (!s) return; a = this.rd.project(s.x, 4, s.z); }
    else if (c.kind === 'sector') a = this.rd.project(c.id * 40 + 20, 6, 146 + wallOff(c.id * 40 + 20)); else if (c.kind === 'squad') { const q = this.sim.squad(c.id); if (!q) return; a = this.rd.project(q.x, 4, q.z); } else if (c.kind === 'patch') { const p = this.sim.frontier.patches[c.id]; a = this.rd.project(p.x, 5, p.z); } else if (c.kind === 'res') { const o = this.resPos(c); a = this.rd.project(o.x, 3, o.z); } else a = this.rd.project(CASTLE.x, 14, CASTLE.z);
    const w = this.cardEl.offsetWidth, h = this.cardEl.offsetHeight, topMin = 96, botMax = vh - 90;
    let top = a.y - h - 26; if (top < topMin) top = Math.min(botMax - h, a.y + 30); if (top + h > botMax) top = Math.max(topMin, botMax - h);
    this.cardEl.style.left = Math.min(vw - w - 8, Math.max(8, a.x - w / 2)) + 'px'; this.cardEl.style.top = top + 'px';
  }
  // (v6.0) flèche dorée ⬆ au-dessus des bâtiments améliorables MAINTENANT (assez de ressources), pendant le temps calme
  upMarks(vw, vh) {
    const sim = this.sim, B = sim.build, E = sim.eco, pool = this.upPool || (this.upPool = []); let k = 0;
    const on = (sim.phase === 'prep' || sim.phase === 'calm') && this.mode === 'idle' && !this.sheet && this.prefs.hints;
    if (on && (!this.upT || performance.now() - this.upT > 600)) { this.upT = performance.now(); const cx = this.cam.tx, cz = this.cam.tz; this.upList = B.items.filter(b => b.state === 'built' && !b.fixed && (() => { const c = B.upCost(b); return c && E.afford(c); })()).sort((a, b) => ((a.x - cx) ** 2 + (a.z - cz) ** 2) - ((b.x - cx) ** 2 + (b.z - cz) ** 2)).slice(0, 5).map(b => b.id); }   /* au plus 5, les plus proches du centre de la vue */
    if (on) for (const id of this.upList || []) { const b = B.get(id); if (!b || b.state !== 'built') continue; const S = STRUCT[b.type], p = this.rd.project(b.x, (S.size ? S.size[1] : 4) + 2.2, b.z);
      if (!p.vis || p.x < 20 || p.x > vw - 20 || p.y < 100 || p.y > vh - 100) continue;
      let e = pool[k]; if (!e) { e = pool[k] = el('button', 'upm'); e.textContent = '⬆'; e.addEventListener('click', ev => { ev.stopPropagation(); const t = B.get(+e.dataset.id); if (t) { this.cam.focusOn(t.x, t.z); this.openCard({ kind: 'struct', id: t.id }); } }); document.getElementById('app').appendChild(e); }
      e.dataset.id = id; e.title = `${S.name} : amélioration possible`; e.style.display = ''; e.style.left = p.x + 'px'; e.style.top = p.y + 'px'; k++; }
    for (let j = k; j < pool.length; j++) pool[j].style.display = 'none';
  }
  // (v9.0) fanion au-dessus de chaque escouade : type, effectif, vie ; un clic ouvre sa fiche
  squadTags(vw, vh) {
    const sim = this.sim, pool = this.sqPool || (this.sqPool = []); let k = 0;
    if (!document.body.classList.contains('fpv')) for (const q of sim.army.squads) { if (!q.n || k >= 24) continue; const p = this.rd.project(q.x, 3.6, q.z); if (!p.vis || p.x < 10 || p.x > vw - 10 || p.y < 100 || p.y > vh - 100) continue;
      let e = pool[k]; if (!e) { e = pool[k] = el('button', 'sqtag'); e.addEventListener('click', ev => { ev.stopPropagation(); const id = +e.dataset.id; if (sim.squad(id)) this.openCard({ kind: 'squad', id }); }); document.getElementById('app').appendChild(e); }
      const hp = Math.max(0, Math.min(1, q.hp / Math.max(1, q.n * sim.army.unitHp(q.type)))), txt = `${UNITS[q.type].ico} ${q.n}`;
      e.dataset.id = q.id; if (e.dataset.t !== txt) { e.dataset.t = txt; e.innerHTML = `<span>${txt}</span><i style="width:${Math.round(hp * 100)}%"></i>`; } else e.lastChild.style.width = Math.round(hp * 100) + '%';
      e.classList.toggle('sel', this.card?.kind === 'squad' && this.card.id === q.id); e.style.display = ''; e.style.left = p.x + 'px'; e.style.top = p.y + 'px'; k++; }
    for (let j = k; j < pool.length; j++) pool[j].style.display = 'none';
  }
  // barres de vie au-dessus des colosses, golems et boss (+ grande barre du boss en haut de l'écran)
  bigBars(vw, vh) {
    const Z = this.sim.zombies, pool = this.bbPool || (this.bbPool = []); let k = 0, boss = -1;
    for (let i = 0; i < Z.n && k < 10; i++) { const t = Z.type[i]; if (t < 5 || t > 7) continue; if (t === 7) boss = i;
      const sz = ZOMBIES[t].size, p = this.rd.project(Z.x[i], sz * 2.1 + 1.2, Z.z[i]); if (!p.vis || p.x < 0 || p.x > vw || p.y < 80 || p.y > vh - 80) continue;
      let e = pool[k]; if (!e) { e = pool[k] = el('div', 'zbar'); e.innerHTML = '<span></span><div class="bar"><i></i></div>'; document.getElementById('app').appendChild(e); }
      const mx = ZOMBIES[t].hp * Z.hpMult, r = Math.max(0, Math.min(1, Z.hp[i] / mx));
      e.style.display = ''; e.style.left = p.x + 'px'; e.style.top = p.y + 'px'; e.firstChild.textContent = ZOMBIES[t].name; e.lastChild.firstChild.style.width = (r * 100) + '%'; e.classList.toggle('boss', t === 7); k++; }
    for (let j = k; j < pool.length; j++) pool[j].style.display = 'none';
    let B = $('#bossbar'); if (boss < 0) { if (B) B.classList.remove('on'); this.bossMax = 0; return; }
    if (!B) { B = el('div'); B.id = 'bossbar'; B.innerHTML = '<b>👑 Seigneur pourri</b><div class="bar"><i></i></div>'; document.getElementById('app').appendChild(B); }
    this.bossMax = Math.max(this.bossMax || 0, Z.hp[boss]); B.classList.add('on'); B.querySelector('i').style.width = (100 * Z.hp[boss] / this.bossMax) + '%';
  }
  // revenu brut par minute (gains seulement, fenêtre glissante d'une minute de jeu)
  trackIncome() {
    const E = this.sim.eco, G = E.gross || {}, t = this.sim.time, I = this.inc || (this.inc = { last: { ...G }, acc: {}, win: [], t0: t });
    for (const r of RES) { const d = (G[r] || 0) - (I.last[r] || 0); if (d > 0) I.acc[r] = (I.acc[r] || 0) + d; I.last[r] = G[r] || 0; }   /* livraisons des villageois seulement */
    if (t - I.t0 >= 10) { I.win.push({ dt: t - I.t0, g: I.acc }); if (I.win.length > 6) I.win.shift(); I.acc = {}; I.t0 = t; }
  }
  incomeOf(r) { const W = this.inc?.win; if (!W || !W.length) return 0; let g = 0, d = 0; for (const w of W) { g += w.g[r] || 0; d += w.dt; } return d > 0 ? g * 60 / d : 0; }
  resInfo(r) {
    const E = this.sim.eco, task = Object.keys(TASKS).find(k => TASKS[k].res === r), n = task ? E.assign[task] : 0, g = Math.round(this.incomeOf(r));
    this.toast(`${RES_INFO[r].ico} ${RES_INFO[r].name} : ${fmt(E.res[r])} / ${fmt(E.cap(r))} · ≈ +${g}/min${task ? ` · ${n} ${TASKS[task].name.toLowerCase()}` : ''}${r === 'food' ? ` · consommation ≈ −${Math.round((E.villagers.length * ECON.upkeep.villager + E.military() * ECON.upkeep.unit) * 60)}/min` : ''}${E.res[r] >= E.cap(r) - 0.5 ? ' · entrepôt PLEIN' : ''}`, 'info');
  }
  // ——— conseiller (v5.0) : les 3 actions les plus utiles du moment, sous une ampoule au-dessus du dock ———
  advice() {
    const sim = this.sim, E = sim.eco, w = sim.wall, out = [], name = r => RES_INFO[r].name.toLowerCase();
    if (E.famine) out.push(['🌾', 'Famine : la nourriture est épuisée — envoie des fermiers', 'sheet:folk']);
    if (sim.phase === 'alert' || sim.phase === 'assault') for (const s of sim.targets || []) if (sim.army.archers[s].n === 0) { out.push(['🏹', `Aucun archer sur ${SECTOR_NAMES[s]} (visé)`, 'secgo:' + s]); break; }
    if (sim.phase === 'assault' && sim.extras) for (let s = 0; s < SECTORS; s++) if (sim.extras.pal[s] > 0 && !(sim.extras.palFire[s] > 0) && (sim.zombies.attacking?.[s] || 0) > 3) { out.push(['🔥', `Palissade ${SECTOR_NAMES[s]} assaillie : enflamme-la`, 'x:palfire:' + s]); break; }
    for (let s = 0; s < SECTORS; s++) if (w.breaches(s)) { out.push(['💥', `Brèche à ${SECTOR_NAMES[s]} : les réparateurs doivent la refermer`, 'secgo:' + s]); break; }
    if (sim.army.reserve.archer >= 5 && !sim.army.autoArchers) out.push(['🏹', `${sim.army.reserve.archer} archers en réserve : place-les sur la muraille`, 'secgo:' + (sim.targets?.[0] ?? 2)]);
    if (E.popRoom() <= 0) out.push(['🏠', 'Population au maximum : bâtis ou améliore une maison', 'goto:house']);
    const idle = E.idleCount(); if (idle > 0) out.push(['👥', `${idle} villageois sans travail`, 'sheet:folk']);
    for (const r of ['wood', 'stone', 'iron', 'gold', 'food']) if (E.res[r] >= E.cap(r) - 0.5) { out.push(['📦', `Stock de ${name(r)} plein : la récolte est perdue`, r === 'food' ? 'goto:granary' : 'goto:warehouse']); break; }
    { let worst = -1, wr = 1; for (let s = 0; s < SECTORS; s++) { const r = w.sectorHp(s) / w.sectorMax(s); if (r < wr) { wr = r; worst = s; } } if (worst >= 0 && wr < 0.7 && !E.assign.repair) out.push(['🔧', `${SECTOR_NAMES[worst]} à ${Math.round(wr * 100)} % : affecte des réparateurs`, 'sheet:folk']); }
    if (sim.wave >= 2 && !sim.build.items.some(b => b.type === 'range')) out.push(['🎯', 'Pas encore de champ de tir : les archers défendent la muraille', 'goto:range']);
    return out.slice(0, 3);
  }
  renderAdvice() {
    let b = $('#advice'); const list = this.advice();
    if (!b) { b = el('button'); b.id = 'advice'; b.title = 'Conseils'; document.getElementById('app').appendChild(b); b.addEventListener('click', () => this.toggleAdvice()); }
    b.style.display = list.length && !this.sheet && this.mode === 'idle' && this.prefs.hints ? '' : 'none'; const k = list.length + ':' + list.map(x => x[0]).join(''); if (b.dataset.k !== k) { b.dataset.k = k; b.innerHTML = `💡<em>${list.length}</em>`; }
    const p = $('#advice-pop'); if (p && p.classList.contains('on')) this.toggleAdvice(true);
  }
  toggleAdvice(force) {
    let p = $('#advice-pop'); const on = force ?? !(p && p.classList.contains('on'));
    if (!p) { p = el('div'); p.id = 'advice-pop'; document.getElementById('app').appendChild(p); p.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) { this.toggleAdvice(false); this.act(b.dataset.a); this.refresh(true); } }); }
    const list = this.advice(); p.classList.toggle('on', on && list.length > 0); if (!on) return;
    const h = `<div class="ptitle">💡 Conseils</div>` + list.map(([i, t, a]) => `<button class="adv" data-a="${a}"><span>${i}</span>${t}<b>›</b></button>`).join('');
    if (p.dataset.h !== h) { p.dataset.h = h; p.innerHTML = h; }
  }
  // flèche au bord de l'écran vers un secteur attaqué / percé / visé qu'on ne voit pas (clic → la caméra y va)
  edgeArrow(s, p, onScr, vw, vh) {
    this.edges = this.edges || []; let e = this.edges[s];
    const sim = this.sim, br = sim.wall.breaches(s), dg = sim.danger(s), tgt = sim.phase === 'alert' && sim.targets.includes(s), want = !onScr && (br || dg === 2 || tgt) && !this.card && !this.sheet;   /* pas par-dessus une fiche ouverte */
    if (!want) { if (e) e.style.display = 'none'; return; }
    if (!e) { e = this.edges[s] = el('button', 'edgea'); e.addEventListener('click', () => { this.cam.focusOn(s * 40 + 20, 150); this.openCard({ kind: 'sector', id: s }); }); document.getElementById('app').appendChild(e); }
    let dx = p.x - vw / 2, dy = p.y - vh / 2; if (!p.vis) { dx = -dx; dy = -dy; }
    const mx = vw / 2 - 74, my = vh / 2 - 110, k = Math.min(mx / Math.max(1e-3, Math.abs(dx)), my / Math.max(1e-3, Math.abs(dy)));
    const x = vw / 2 + dx * k, y = vh / 2 + dy * k, ang = Math.atan2(dy, dx) * 180 / Math.PI;
    e.style.display = ''; e.style.left = x + 'px'; e.style.top = y + 'px'; e.className = 'edgea' + (br ? ' br' : dg === 2 ? ' d2' : ' tgt');
    const txt = (br ? '💥' : dg === 2 ? '⚔' : '🔔') + ' ' + SECTOR_NAMES[s];
    if (e.dataset.t !== txt) { e.dataset.t = txt; e.innerHTML = `<i style="transform:rotate(${ang}deg)">➜</i><span>${txt}</span>`; } else e.firstChild.style.transform = `rotate(${ang}deg)`;
  }
  // ——— fiches ———
  cost(c) { const E = this.sim.eco; return Object.keys(c).map(r => `<i class="${E.res[r] >= c[r] ? '' : 'no'}">${RES_INFO[r].ico}${c[r]}</i>`).join(' '); }
  btn(label, sub, a, off, cls = 'act') { return `<button class="${cls}" data-a="${a}"${off ? ' disabled' : ''}>${label}${sub ? `<small>${sub}</small>` : ''}</button>`; }
  pips(s) { const mx = STRUCT[s.type].max || ECON.maxLevel; return mx > 1 ? `<span class="pips">${'◆'.repeat(s.level)}${'◇'.repeat(Math.max(0, mx - s.level))}</span>` : ''; }
  taskRow(t) {
    const E = this.sim.eco, T = TASKS[t], n = E.assign[t], capT = E.taskCap(t), idle = E.idleCount();
    return `<div class="row step"><span class="lab">${T.ico} ${T.name}<small class="sub">+${E.rate[t].toFixed(2)}/s · places ${n}/${n + capT}</small></span>${this.btn('−', '', `as:${t}:-1`, n <= 0, 'sq')}<b class="val">${n}</b>${this.btn('+', '', `as:${t}:1`, idle <= 0 || n >= capT, 'sq')}</div>`;
  }
  structCard(s) {
    const sim = this.sim, B = sim.build, E = sim.eco, def = STRUCT[s.type], working = s.state !== 'built';
    let h = `<div class="ptitle">${def.ico} ${def.name}<span class="lvl">${s.level ? 'Niv. ' + s.level : 'chantier'}</span></div>`;
    if (!working && STRUCT[s.type].max !== 1) h += `<div>${this.pips(s)}</div>`;
    if (working) {
      let crew = 0; for (const v of E.villagers) if (v.job === s.id) crew++;
      const here = s.crew || 0, sec = Math.ceil((1 - s.progress) * s.work / BUILD.speed / Math.pow(Math.max(1, here), BUILD.workerExp)), free = E.idleCount();
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
    if (['mine', 'quarry', 'sawmill'].includes(s.type) && s.state === 'built') { const o = s.type === 'mine' ? this.resSites().filter(q => q.t !== 'stone' && q.t !== 'wood').sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z))[0] : { t: s.type === 'quarry' ? 'stone' : 'wood' }; if (o) h += `<div class="hint small">${RES_INFO[o.t].ico} Reste à extraire : <b>${fmt(E.totalDeposit(o.t))}</b> ${RES_INFO[o.t].name.toLowerCase()} · touche un gisement pour le détail</div>`; }
    if (s.type === 'house') { const U = BUILD.houseUnits, here = Math.floor(ECON.popPerHouse * (U[s.level] || 0)), nx = s.level < 4 ? Math.floor(ECON.popPerHouse * U[s.level + 1]) : 0; h += `<div class="hint small">🏠 Loge <b>${here}</b> personnes${nx ? ` · niv. ${s.level + 1} : <b>${nx}</b>` : ''} · population ${E.population()}/${E.popCap()}</div>`; }
    for (const t of TB[s.type] || []) h += this.taskRow(t);
    if (TRAIN_BUILDINGS.includes(s.type) && s.level) h += this.productionHtml(s);
    if (s.type === 'workshop') h += this.btn('🛠 Armes de siège', '', 'sheet:army:siege', false, 'act sec');
    if (s.type === 'forge') h += this.btn('🔨 Améliorations', '', 'sheet:army:forge', false, 'act sec');
    if (s.type === 'wizard') h += this.mageHtml(true);
    if (s.type === 'church' && s.level) { const P = this.sim.priest, L = s.level; h += `<div class="rank">⛪ Le prêtre ${P.here ? (P.post ? `prie derrière <b>${SECTOR_AT[P.sector]}</b>` : 'veille sur le village') : 'arrive…'}<small>Pendant l'alerte et l'assaut, il va seul derrière le secteur le plus menacé.</small></div>`
      + `<div class="spells">${PRIEST.powers.map(w => `<span class="${w.level <= L ? 'on' : 'off'}" title="${w.info}">${w.ico}<b>${w.name}</b><small>${w.level <= L ? w.info : 'église niv. ' + w.level}</small></span>`).join('')}</div>`; }
    if (s.type === 'prison' && s.level) { const I = this.sim.infection, J = I.list.filter(b => b.state === 'jailed'), W = I.list.filter(b => b.state !== 'jailed');
      h += `<div class="rank">🚧 Places : <b>${J.length}/${I.cells(this.sim)}</b> · transformation ralentie de ${Math.round(INFECTION.prisonSlow * s.level * 100)} %<small>Les combattants mordus y sont isolés derrière le grillage. Le prêtre vient les guérir ; s'ils se transforment derrière le grillage, les gardes les abattent.</small></div>`
        + (I.list.length ? `<div class="hint small">${[...J, ...W].map(b => `${UNITS[b.type].ico} ${b.state === 'jailed' ? 'en quarantaine' : b.state === 'down' ? 'à terre !' : 'en route'} · ${Math.max(0, Math.ceil(b.t))} s`).join('<br>')}</div>` : '') + `<div class="hint small">Bilan : ${I.cured} guéri${I.cured > 1 ? 's' : ''} · ${I.turned} transformé${I.turned > 1 ? 's' : ''} · ${I.devoured} dévoré${I.devoured > 1 ? 's' : ''}</div>`; }
    if (s.type === 'publicworks' && s.level) { const R = this.sim.roads, q = R.quality(this.sim), pend = R.list.filter(r => r.built < 1).length; h += `<div class="rank">🛤 Routes : <b>${ROADWORKS.names[q]}</b> — villageois +${Math.round(ROADWORKS.speed[q] * 100)} % de vitesse sur les routes${q < 3 ? ` · niveau ${s.level + 1} : ${ROADWORKS.names[q + 1]}` : ''}${pend ? ` · ${pend} chantier${pend > 1 ? 's' : ''} de route` : ''}<small>Le réseau relie seul chaque nouveau bâtiment ; trace en plus tes propres routes (bois et pierre au mètre).</small></div>` + this.btn('🛤 Tracer une route', `${ROADWORKS.costPerM.wood} ${RES_INFO.wood.ico} + ${ROADWORKS.costPerM.stone} ${RES_INFO.stone.ico} par mètre`, 'road', false, 'act'); }
    if (s.type === 'infirmary' && s.level) h += `<div class="rank">🏥 Soins : <b>${(INFIRMARY.heal[s.level] * 100).toFixed(1)} %</b> des PV par seconde aux escouades en garnison hors combat · <b>${INFIRMARY.save[s.level] * 100} %</b> des combattants tombés sont sauvés (retour en réserve)${this.sim.army.saved ? ` · ${this.sim.army.saved} sauvés` : ''}</div>`;
    if (s.type === 'university' && s.level) h += this.btn('🎓 Améliorations des villageois', '', 'sheet:tech', false, 'act sec') + this.researchHtml();
    if (s.type === 'barracks' && s.level) h += this.heroHtml();
    if (s.type === 'forge' && s.level) h += `<div class="hint small">Plafond attaque/défense : ${this.sim.eco.smithMax()}</div>`;
    if (RANK_BUILDINGS.includes(s.type)) { const t = UNIT_ORDER.filter(u => UNITS[u].from === s.type), r = RANKS[Math.max(0, s.level - 1)], nx = RANKS[s.level]; h += `<div class="rank">⭐ Rang <b>${r.name}</b>${nx ? ` → <b>${nx.name}</b> au niv. ${s.level + 1} : force ×${nx.force}, résistance ×${nx.res}, tenue plus riche` : ' — rang maximum'}<small>${t.map(u => UNITS[u].ico).join(' ')} toutes les unités de ce bâtiment</small></div>`; }
    const uc = B.upCost(s), canMove = !s.fixed;
    if (uc) h += this.upgradeGain(s);
    h += `<div class="row">${uc ? this.btn(`⬆ Niv. ${s.level + 1}`, `${this.cost(uc)} · ⏱${Math.round(B.upTime(s))} s`, `up:${s.id}`, !E.afford(uc)) : '<span class="max">niveau max</span>'}${canMove ? this.btn('✥ Déplacer', 'gratuit', `mv:${s.id}`, false, 'act sec') : ''}</div>`;
    return h;
  }
  // ce que rapporte le niveau suivant (v3.4) : effets chiffrés + aspect
  upgradeGain(s) {
    const E = this.sim.eco, L = s.level, N = L + 1, g = [], pct = v => Math.round(v * 100) + ' %';
    const slot = () => g.push(`👷 Emplacements : <b>${E.slots(s.type)}</b> → <b>${E.slots(s.type) + ECON.slotsPerLevel}</b>`), yld = () => g.push(`📈 Rendement : +${pct(ECON.levelGather * L)} → <b>+${pct(ECON.levelGather * N)}</b>`);
    switch (s.type) {
      case 'sawmill': case 'quarry': case 'mine': slot(); yld(); break;
      case 'farm': slot(); yld(); g.push(['', '', '🥬 potager et poulailler', '🍎 verger et foin', '🏛 silo et grange', '🐄 pâture et bêtes'][N] || ''); break;
      case 'mill': g.push(`🌾 Nourriture : +${pct(ECON.millBonus * L)} → <b>+${pct(ECON.millBonus * N)}</b>`); break;
      case 'granary': g.push(`${RES_INFO.food.ico} Stock de nourriture : <b>${E.cap('food')}</b> → <b>${E.cap('food') + ECON.storePerLevel}</b>`); break;
      case 'warehouse': g.push(`📦 Stock bois, pierre, fer, or : <b>${E.cap('wood')}</b> → <b>${E.cap('wood') + ECON.storePerLevel}</b>`); break;
      case 'barracks': case 'stable': case 'range': {
        const r = RANKS[Math.min(RANKS.length - 1, N - 1)]; g.push(`⭐ Rang des unités : <b>${r.name}</b> (force ×${r.force}, résistance ×${r.res})`);
        g.push(`⏱ Entraînement +${pct(TRAIN.speedPerLevel)} plus rapide · file +${TRAIN.queuePerLevel} places${TRAIN.parallel[Math.min(3, N)] > TRAIN.parallel[Math.min(3, L)] ? ` · <b>${TRAIN.parallel[Math.min(3, N)]}</b> formés à la fois` : ''}`);
        if (s.type === 'barracks' && N === 2) g.push('🛡 Débloque les <b>Lourds</b>'); if (s.type === 'barracks' && N === 3) g.push('🗡 Débloque les <b>Chevaliers</b>'); break; }
      case 'forge': g.push(`🔨 Plafond attaque / défense : <b>${[0, 2, 4, 6][L]}</b> → <b>${[0, 2, 4, 6][N]}</b>`); break;
      case 'publicworks': g.push(`🛤 Toutes les routes : <b>${ROADWORKS.names[N]}</b> (villageois +${pct(ROADWORKS.speed[N])})`); break;
      case 'infirmary': g.push(`🏥 Soins : ${(INFIRMARY.heal[L] * 100).toFixed(1)} % → <b>${(INFIRMARY.heal[N] * 100).toFixed(1)} %</b> PV/s · blessés sauvés <b>${pct(INFIRMARY.save[N])}</b>`); break;
      case 'university': g.push(`🎓 Plafond des améliorations des villageois : <b>${L + 1}</b> → <b>${N + 1}</b>`); break;
      case 'wizard': g.push(`🔮 Magicien niv. <b>${N}</b> : sorts plus puissants, plus de mana`); break;
      case 'workshop': g.push(`🛠 +2 armes déployables${N === 2 ? ' · débloque la <b>catapulte</b>' : N === 3 ? ' · débloque le <b>trébuchet</b>' : ''}`); break;
      case 'church': { const pw = PRIEST.powers.filter(w => w.level === N); g.push(`👪 +${PRIEST.pop} places de population · bénédiction +${pct(PRIEST.blessPerLevel)}`); for (const w of pw) g.push(`${w.ico} Nouveau pouvoir : <b>${w.name}</b>`); break; }
      case 'prison': g.push(`🚧 +${INFECTION.cells} places · transformation encore ralentie (${pct(INFECTION.prisonSlow * L)} → <b>${pct(INFECTION.prisonSlow * N)}</b>)`); break;
      case 'house': g.push(`🏠 Loge <b>${Math.floor(ECON.popPerHouse * BUILD.houseUnits[L])}</b> → <b>${Math.floor(ECON.popPerHouse * BUILD.houseUnits[N])}</b> personnes`); break;
      case 'tower': g.push(`🏹 Portée +${TOWER.rangePerLevel} m · dégâts +${pct(TOWER.dmgPerLevel)} · cadence +${pct(TOWER.ratePerLevel)}`); break;
    }
    if (s.type !== 'tower' && s.type !== 'house' && s.type !== 'prison') g.push(['', '', '🏗 Aspect : une aile et un parvis de pierre', '🏗 Aspect : une tour et une seconde aile', '🏗 Aspect : tour couronnée, bannières, muret', '🏗 Aspect : toits dorés, grandes bannières', '🏗 Aspect : le bâtiment le plus imposant du village'][Math.min(6, N)] || '');
    else if (s.type === 'house') g.push(['', '', '🏗 Aspect : maison à colombages à étage', '🏗 Aspect : grande maison avec lucarne', '🏗 Aspect : maison de notable à tourelle'][N] || '');
    const lines = g.filter(Boolean); if (!lines.length) return '';
    return `<div class="gain"><div class="gt">Au niveau ${N} :</div>${lines.map(l => `<div>${l}</div>`).join('')}</div>`;
  }
  castleCard() {
    const sim = this.sim, E = sim.eco, pop = E.population(), cap = E.popCap(), free = E.idleCount();
    return `<div class="ptitle">🏰 Château<span class="lvl">${fmt(sim.castleHp)} PV</span></div><div class="hpline"><div class="bar big"><i style="width:${100 * sim.castleHp / CASTLE.hp}%"></i></div></div>
      <div class="hint">👥 Population <b>${pop}</b>/${cap} · villageois ${E.villagers.length} (libres ${free})</div>
      <div class="hint small">Les villageois rapportent tout au château. Construis des 🏠 maisons pour agrandir la population.</div>
      <div class="row">${this.btn('+ Villageois', this.cost(ECON.villagerCost), 'vil', pop >= cap || !E.afford(ECON.villagerCost))}${this.btn('🏠 Maison', this.cost(sim.build.newCost('house')), 'bld:house', false, 'act sec')}</div>${this.castleExtras()}${this.heroHtml()}`;
  }
  sectorCard(s) {
    const sim = this.sim, w = sim.wall, army = sim.army, E = sim.eco;
    const hp = w.sectorHp(s), mx = w.sectorMax(s), br = w.breaches(s), uc = w.upgradeCost(s), crew = E.assign.repair, an = army.archers[s].n;
    const squadsHere = army.squads.filter(q => q.mode === 'garrison' && q.sector === s), others = army.squads.filter(q => !(q.mode === 'garrison' && q.sector === s));
    const sqRow = (q, go) => `<div class="row step"><span class="lab">${UNITS[q.type].ico} ${UNITS[q.type].name} ×${q.n}<small class="sub">${FORMATIONS[q.form].name} · ${q.mode === 'field' ? 'sur le terrain' : SECTOR_NAMES[q.sector]}</small></span>${go ? this.btn('→ ici', '', 'sqgo:' + q.id, false, 'act slim') : ''}</div>`;
    const towers = sim.build.items.filter(t => t.type === 'tower' && t.x >= s * 40 - 10 && t.x <= s * 40 + 50).length;
    return `<div class="ptitle">🧱 Muraille · ${SECTOR_NAMES[s]} <span class="lvl">Niv. ${w.level[s]}</span></div>
      <div class="hpline"><div class="bar big"><i style="width:${hp / mx * 100}%"></i></div><span>${Math.round(hp)} / ${Math.round(mx)}${br ? ` · 💥${br}` : ''}</span></div>
      <div class="row">${this.btn('⬆ Renforcer', uc ? `Niv. ${w.level[s] + 1} · ${this.cost(uc)}` : 'niveau max', 'wall', !uc || !E.afford(uc))}</div>
      <div class="hint small">🗼 ${towers} tour${towers > 1 ? 's' : ''} couvrent ce secteur — touche une tour pour l'améliorer.</div>
      <div class="row step"><span class="lab">🏹 Archers<small class="sub">réserve ${army.reserve.archer} · ${army.autoArchers ? '⚜ placés seuls' : '📯 placement manuel'}</small></span>${this.btn('−', '', 'ua:archer:-1', an <= 0, 'sq')}<b class="val">${an}<small>/${ARCHER_SLOTS}</small></b>${this.btn('+', '', 'ua:archer:1', army.reserve.archer <= 0 || an >= ARCHER_SLOTS, 'sq')}${this.btn('+5', '', 'ua:archer:5', army.reserve.archer <= 0 || an >= ARCHER_SLOTS, 'sq wide')}</div>
      ${squadsHere.map(q => sqRow(q, false)).join('')}${others.length ? `<div class="hint small">Envoyer ici :</div>${others.map(q => sqRow(q, true)).join('')}` : ''}
      ${sim.siege.weapons.some(x => x.sector === s) ? `<div class="hint small">🛠 Siège : ${sim.siege.weapons.filter(x => x.sector === s).map(x => SIEGE[x.type].ico).join(' ')}</div>` : ''}
      <div class="hint small">🔧 ${crew ? `${crew} villageois réparent la muraille` : 'Aucun réparateur'} (menu 👥).</div>${this.sectorExtras(s)}`;
  }
  // ——— feuille BÂTIR ———
  // production d'unités (fiche d'une caserne, d'une écurie, d'un champ de tir) : l'unité en cours passe par 4 étapes animées,
  // la file d'attente, et les boutons pour en commander d'autres ; dans la scène, les recrues s'entraînent devant le bâtiment
  productionHtml(s) {
    const sim = this.sim, army = sim.army, E = sim.eco, q = army.queues[s.type], max = army.queueMax(sim, s.type), par = army.parallel(sim, s.type), types = UNIT_ORDER.filter(t => UNITS[t].from === s.type);
    const STEPS = { barracks: ['📜 Enrôlement', '🧥 Équipement', '⚔ Maniement de l\'épée', '✅ Prêt'], range: ['📜 Enrôlement', '🏹 Remise de l\'arc', '🎯 Tir sur cible', '✅ Prêt'], stable: ['📜 Enrôlement', '🐴 Choix du cheval', '🏇 Dressage', '✅ Prêt'] }[s.type];
    let h = '<div class="prod">';
    if (q.length) {
      const now = q.slice(0, par), f = now.reduce((a, it) => a + (1 - it.t / it.full), 0) / now.length, st = Math.min(3, Math.floor(f * 4)), U = UNITS[now[0].type], next = Math.min(...now.map(it => it.t));
      h += `<div class="pnow"><span class="pico">${U.ico}</span><div class="pbody"><b>${now.length} ${U.name.toLowerCase()}${now.length > 1 ? 's' : ''} en formation en même temps</b><div class="psteps">${STEPS.map((x, i) => `<span class="${i < st ? 'done' : i === st ? 'cur' : ''}">${x}</span>`).join('')}</div>
        <div class="minibars">${now.map(it => `<div class="bar prog"><i style="width:${Math.round((1 - it.t / it.full) * 100)}%"></i></div>`).join('')}</div><small>prochain prêt dans ${Math.ceil(next)} s · ${q.length - now.length} en attente</small></div></div>`;
      if (q.length > par) h += `<div class="queue">${q.slice(par, par + 40).map(x => `<span class="qi">${UNITS[x.type].ico}</span>`).join('')}${q.length > par + 40 ? `<b>+${q.length - par - 40}</b>` : ''}</div>`;
    } else h += '<div class="hint small">Personne en formation. Commande des unités ci-dessous.</div>';
    for (const t of types) { const U = UNITS[t], uc = army.unitCost(sim, t), ok = army.canTrain(sim, t), room = max - q.length;
      h += `<div class="row wrapr"><span class="lab">${U.ico} ${U.name}<small class="sub">${ok ? `${this.cost(uc)} · 👥${U.pop} chacun` : `niv. ${U.minLevel} requis`}</small></span>${[1, 5, 15].map(n => this.btn(`+${n}`, n === 15 ? 'une escouade' : '', `train:${t}:${n}`, !ok || !E.afford(uc) || E.popRoom() < U.pop || room <= 0, 'act slim' + (n === 1 ? '' : ' sec'))).join('')}</div>`; }
    return h + `<div class="hint small">File : <b>${q.length}/${max}</b> · ${par} formé${par > 1 ? 's' : ''} à la fois (plus avec le niveau) · réserve : ${types.map(t => `${UNITS[t].ico} ${army.reserve[t]}`).join(' · ')}</div></div>`;
  }
  // nom d'une troupe selon son grade : « Peloton de fantassins »
  unitName(q) { const t = UNITS[q.type].name.toLowerCase(); return q.medal ? `🎖 ${q.medal[0].toUpperCase() + q.medal.slice(1)}` : `${GRADES[q.grade || 'escouade'].name} de ${t}s`; }
  // ——— navigation en deux temps (v2.5), utilisée partout : d'abord une grille de CATÉGORIES, puis le sous-menu choisi ———
  cats(sheet, items) {
    return `<div class="cats">${items.map(it => `<button class="cat${it.alert ? ' alert' : ''}${it.off ? ' off' : ''}" data-a="nav:${sheet}:${it.k}"><span class="ci">${it.ico}</span><b>${it.name}</b><small>${it.sub || ''}</small>${it.badge ? `<em>${it.badge}</em>` : ''}</button>`).join('')}</div>`;
  }
  back(sheet, title, to = '') { return `<div class="navbar"><button class="back" data-a="nav:${sheet}:${to}">‹ Retour</button><b>${title}</b></div>`; }
  bigAct(ico, name, sub, a, on = false, off = false) { return `<button class="bigact${on ? ' on' : ''}${off ? ' off' : ''}" data-a="${a}" ${off ? 'disabled' : ''}><span class="ci">${ico}</span><b>${name}</b><small>${sub}</small></button>`; }
  // ——— ordres d'escouade explicites : on choisit l'action, PUIS on touche la carte (bandeau en haut, annulable) ———
  startOrder(id, kind) {
    const q = this.sim.squad(id); if (!q) return; this.order = { id, kind }; this.closeSheet(); this.closeCard(); this.pickSquad(id);
    if (kind === 'sortie') { this.setTargeting(true); this.cam.focusOn(q.x, 118); } else this.cam.focusOn(q.x, q.z);
    this.renderOrder();
  }
  endOrder() { this.order = null; this.setTargeting(false); this.renderOrder(); }
  // ——— placement des troupes avant la vague (v2.7) : le jeu est en pause ; toucher une escouade, puis l'endroit voulu ———
  startDeploy() {
    const sim = this.sim; if (sim.phase === 'assault') { this.toast('⚠ Impossible pendant l\'assaut : attends la fin de la vague', 'warn'); return; }
    if (!sim.army.squads.length) { this.toast('Aucune escouade à placer : recrute des troupes', 'warn'); return; }
    this.invite = false; this.deploy = { speed: sim.speed || 1 }; sim.speed = 0; this.depSel = 0; this.closeSheet(); this.closeCard(); this.cam.focusOn(100, 158); this.renderOrder();
  }
  endDeploy() { if (!this.deploy) return; this.sim.speed = this.deploy.speed; this.deploy = null; this.depSel = 0; this.rd.setSquad(0); this.syncTime(); this.renderOrder(); this.toast('▶ Troupes en place', 'ok'); }
  renderOrder() {
    if (!this.orderEl) { this.orderEl = el('div', 'orderbar'); document.body.appendChild(this.orderEl); this.orderEl.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) { this.act(b.dataset.a); this.refresh(true); } }); }
    if (this.deploy) {
      const q = this.depSel && this.sim.squad(this.depSel);
      this.orderEl.innerHTML = `<span>🎯 <b>Placement des troupes</b> (jeu en pause) · ${q ? `${UNITS[q.type].ico} ${UNITS[q.type].name} ×${q.n} : touche <b>où la placer</b> (cour ou devant la muraille)` : 'touche une <b>escouade</b>, puis l\'endroit voulu'}</span><button class="ok" data-a="deployend">✔ Terminé</button>`;
      this.orderEl.classList.add('on'); return;
    }
    if (this.invite && this.sim.phase !== 'assault') { this.orderEl.innerHTML = `<span>🏆 Vague repoussée · place tes troupes avant la prochaine</span><button class="ok" data-a="deploy">🎯 Placer</button><button class="x" data-a="invitex">✕</button>`; this.orderEl.classList.add('on'); return; }
    const o = this.order, q = o && this.sim.squad(o.id); if (!q) { this.orderEl.classList.remove('on'); return; }
    const U = UNITS[q.type], txt = o.kind === 'sortie' ? '⚔ Touche le <b>champ de bataille</b> (devant la muraille) pour y envoyer' : '📍 Touche la carte : <b>derrière</b> la muraille = nouveau poste, <b>devant</b> = combat';
    this.orderEl.innerHTML = `<span>${txt} ${U.ico} ${U.name} ×${q.n}</span><button class="x" data-a="ordercancel">✕</button>`; this.orderEl.classList.add('on');
  }
  // ⚒ Bâtir : catégories, puis les bâtiments de la catégorie
  buildCats() {
    return [
      { k: 'home', ico: '🏠', name: 'Habitations', ids: ['house'], sub: 'population' },
      { k: 'res', ico: '🌲', name: 'Ressources', ids: ['sawmill', 'quarry', 'mine', 'farm', 'mill'], sub: 'bois, pierre, fer, or, nourriture' },
      { k: 'store', ico: '📦', name: 'Stockage', ids: ['granary', 'warehouse'], sub: 'stocker plus' },
      { k: 'army', ico: '⚔', name: 'Militaire', ids: ['barracks', 'range', 'stable', 'forge', 'workshop', 'wizard'], sub: 'unités, armes, magie' },
      { k: 'care', ico: '⛪', name: 'Soins et foi', ids: ['infirmary', 'church', 'prison'], sub: 'soigner, guérir, isoler' },
      { k: 'town', ico: '🏛', name: 'Ville et savoir', ids: ['university', 'publicworks'], sub: 'améliorations, routes' },
      { k: 'def', ico: '🗼', name: 'Défense', ids: ['tower'], sub: 'tours de tir' },
    ];
  }
  buildSheet() {
    const sim = this.sim, B = sim.build, E = sim.eco, cats = this.buildCats(), cur = cats.find(c => c.k === this.nav.build);
    if (!cur) {
      return `<div class="hint small">Choisis un <b>type de construction</b>. Des villageois <b>libres</b> viennent bâtir (👥 ${E.idleCount()} libres).</div>` + this.cats('build', cats.map(c => {
        const built = c.ids.filter(id => id === 'house' ? B.count('house') : id === 'tower' ? B.items.some(s => s.type === 'tower' && !s.fixed) : B.of(id)).length, can = c.ids.some(id => (id === 'house' || id === 'tower' || !B.of(id)) && E.afford(B.newCost(id)));
        return { ...c, badge: c.ids.length > 1 ? `${built}/${c.ids.length}` : '', sub: c.sub + (can ? '' : ' · ressources insuffisantes'), off: !can && !built };
      }));
    }
    return this.back('build', `${cur.ico} ${cur.name}`) + this.buildList(cur.ids);
  }
  buildList(ids) {
    const sim = this.sim, B = sim.build, E = sim.eco; let h = '<div class="blist">';
      for (const id of ids) {
        const def = STRUCT[id], ex = B.of(id), multi = id === 'house' || id === 'tower', cost = B.newCost(id);
        let st = '', cls = 'brow', act = 'bld:' + id, btn;
        if (multi) { const n = id === 'house' ? B.count('house') : B.items.filter(s => s.type === 'tower' && !s.fixed).length; st = n ? `${n} construite${n > 1 ? 's' : ''}` : 'à construire'; btn = this.btn('Construire', `${this.cost(cost)} · ⏱ ${def.time} s`, act, !E.afford(cost), 'act slim'); }
        else if (ex) { cls += ' done'; st = ex.state === 'site' ? `chantier ${Math.round(ex.progress * 100)} %` : ex.state === 'built' ? `niv. ${ex.level}` : ex.state === 'upgrading' ? 'amélioration…' : 'déplacé…'; btn = this.btn('Voir', 'améliorer, déplacer', 'go:' + ex.id, false, 'act slim sec'); }
        else { st = 'à construire'; btn = this.btn('Construire', `${this.cost(cost)} · ⏱ ${def.time} s`, act, !E.afford(cost), 'act slim'); }
        h += `<div class="${cls}"><span class="ci">${def.ico}</span><div class="bt"><b>${def.name}</b> <span class="lvl">${st}</span><small>${def.info || ''}</small></div>${btn}</div>`;
      }
    return h + '</div>';
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
  // 🛡 Armée : catégories, puis le sous-menu ; les escouades se gèrent une par une (sq.ID)
  armyHtml() {
    const sim = this.sim, army = sim.army, E = sim.eco, nav = this.nav.army || '';
    if (nav.startsWith('sq.')) { const q = sim.squad(+nav.slice(3)); if (q) return this.back('army', 'Troupes', 'squads') + this.squadView(q); this.nav.army = 'squads'; }
    const views = { traps: ['🪤 Pièges', () => this.trapsHtml()], hero: ['⭐ Héros', () => this.heroHtml()], squads: ['🛡 Troupes', () => this.squadsHtml()], newsq: ['➕ Nouvelle troupe', () => this.newSquadHtml()], train: [BARRACKS_ICO + ' Recruter', () => this.trainHtml()], ranks: ['⭐ Rangs', () => this.ranksHtml()], magic: ['🔮 Magie', () => this.mageHtml(false)], siege: ['🛠 Siège', () => this.siegeHtml()], forge: ['🔨 Forge', () => this.forgeHtml()] };
    const v = views[nav];
    if (v) return this.back('army', v[0], nav === 'newsq' ? 'squads' : '') + this.bittenLine() + (nav === 'squads' || nav === 'train' ? this.popLine() : '') + v[1]();
    const field = army.squads.filter(q => q.mode === 'field').length, res = ['soldier', 'heavy', 'knight', 'cavalry'].reduce((a, t) => a + (army.reserve[t] || 0), 0), queue = TRAIN_BUILDINGS.reduce((a, b) => a + (army.queues[b] ? army.queues[b].length : 0), 0);
    return this.bittenLine() + this.popLine() + this.cats('army', [
      { k: 'squads', ico: '🛡', name: 'Troupes', sub: army.squads.length ? ['escadron', 'peloton', 'escouade'].map(g => { const c = army.squads.filter(q => q.grade === g).length; return c ? `${c} ${(c > 1 ? GRADES[g].plural : GRADES[g].name).toLowerCase()}` : ''; }).filter(Boolean).join(' · ') + (field ? ` · ${field} au combat` : '') : 'aucune : formes-en une', badge: res ? `${res} en réserve` : '', alert: army.squads.some(q => army.hpRatio(q) < 0.4) },
      { k: 'train', ico: BARRACKS_ICO, name: 'Recruter', sub: 'entraîner des soldats', badge: queue ? `${queue} en file` : '' },
      { k: 'ranks', ico: '⭐', name: 'Rangs', sub: 'rendre les unités plus fortes' },
      { k: 'magic', ico: '🔮', name: 'Magie', sub: sim.mages.list.length ? 'magicien en jeu' : 'magicien autonome' },
      { k: 'siege', ico: '🛠', name: 'Siège', sub: 'balistes, catapultes, trébuchets' },
      { k: 'forge', ico: '🔨', name: 'Forge', sub: 'attaque et défense par type' },
      { k: 'traps', ico: '🪤', name: 'Pièges', sub: 'fosses, chausse-trappes, poix' },
      { k: 'hero', ico: '⭐', name: 'Héros', sub: sim.extras.hero ? 'capitaine ' + sim.extras.hero.name : 'engager un capitaine' },
    ]);
  }
  // mordus : rappel de ce qu'il faut (place en quarantaine, église pour que le prêtre les guérisse)
  bittenLine() {
    const I = this.sim.infection; if (!I || !I.list.length) return ''; const jail = I.prison(this.sim), church = this.sim.priest && this.sim.priest.here, n = I.list.length, soon = Math.min(...I.list.map(b => b.t));
    return `<div class="hint small warnline">🧟 <b>${n} mordu${n > 1 ? 's' : ''}</b> · transformation dans ${Math.max(0, Math.ceil(soon))} s${jail && I.jailed() >= I.cells(this.sim) ? ' · <b>quarantaine pleine</b> : améliore-la' : ''}${!church ? ' · <b>bâtis une église</b> : seul le prêtre peut les guérir' : ''}</div>`;
  }
  rallyLine() { return `<div class="row">${this.btn(this.rallying ? '✖ Annuler' : '📍 Point de ralliement', this.rallying ? '' : 'par défaut : la placette', 'rally', false, this.rallying ? 'act warnb' : 'act')}${this.rallying ? '<div class="hint small">Touche la carte, dans la cour ou le village.</div>' : ''}</div>`; }
  // liste des escouades : une ligne par escouade (état, santé) → toucher = ses ordres
  squadsHtml() {
    const army = this.sim.army; let h = '';
    if (!army.squads.length) h += '<div class="hint">Aucune escouade. Recrute des soldats (Recruter), puis forme une escouade avec ta réserve.</div>';
    h += '<div class="blist">' + army.squads.map(q => {
      const U = UNITS[q.type], st = q.mode === 'field' ? (q.fight > 0 ? '⚔ au combat' : q.way.length ? '🚶 en route vers le front' : '⚔ sur le champ de bataille') : (q.way.length ? '🚶 en route' : q.custom ? '🛡 à son poste' : `🛡 garde ${SECTOR_AT[q.sector]}`), r = army.hpRatio(q);
      return `<button class="brow sqrow${r < 0.4 ? ' hurt' : ''}" data-a="nav:army:sq.${q.id}"><span class="ci">${U.ico}</span><div class="bt"><b>${this.unitName(q)}</b> <small class="cnt">${q.n}/${army.maxN(q.type, q)}</small> <span class="lvl">${st}</span> <span class="tag ${q.auto ? 'ai' : 'man'}">${q.auto ? '⚜ autonome' : '📯 tes ordres'}</span><div class="bar"><i style="width:${Math.round(r * 100)}%"></i></div></div><span class="go">›</span></button>`;
    }).join('') + '</div>';
    h += `<div class="row">${this.btn('🎯 Placer les troupes', this.sim.phase === 'assault' ? 'après la vague' : 'jeu en pause, place chaque escouade', 'deploy', this.sim.phase === 'assault' || !army.squads.length, 'act')}${this.btn('➕ Nouvelle troupe', 'escouade, peloton ou escadron', 'nav:army:newsq', army.squads.length >= SQUAD.maxSquads, 'act sec')}</div>`;
    h += `<div class="hint small">⚜ Sans ordre de ta part, chaque escouade est <b>autonome</b> : elle garde le secteur le plus menacé, court colmater les brèches, et les cavaliers, chevaliers et lourds en forme font de courtes sorties. Dès que tu donnes un ordre, elle t'obéit (📯). Après chaque vague, les troupes disponibles forment d'elles-mêmes de nouvelles escouades.</div>`;
    h += `<div class="row">${this.btn(`${army.autoArchers ? '✅' : '⬜'} 🏹 Archers autonomes`, army.autoArchers ? 'ils montent seuls et vont où ça presse' : 'placement manuel (touche un secteur)', 'autoarch', false, 'act' + (army.autoArchers ? '' : ' sec'))}</div>` + this.rallyLine();
    return h;
  }
  newSquadHtml() {
    const army = this.sim.army, room = army.squads.length < SQUAD.maxSquads;
    return '<div class="hint small">Escouade <b>15</b> hommes · peloton <b>50</b> · escadron <b>150</b>. Avec moins de 15 hommes d\'une catégorie, ils restent en réserve.</div><div class="blist">' + ['soldier', 'heavy', 'knight', 'cavalry'].map(t => {
      const U = UNITS[t], n = army.reserve[t] || 0;
      return `<div class="brow${n >= 15 ? '' : ' off'}"><span class="ci">${U.ico}</span><div class="bt"><b>${U.name}s</b> <span class="lvl">${n} en réserve</span><small>${n >= 15 ? 'choisis la taille de la troupe' : `encore ${15 - n} pour une escouade`}</small></div>${['escouade', 'peloton', 'escadron'].map(g => this.btn(GRADES[g].name, String(GRADES[g].size), `newsq:${t}:${g}`, !room || n < GRADES[g].size, 'act slim' + (g === 'escouade' ? '' : ' sec'))).join('')}</div>`;
    }).join('') + '</div>';
  }
  // ordres d'UNE escouade, groupés par intention : OÙ (combattre, garder un secteur, rentrer, déplacer) · COMMENT (formation, posture) · EFFECTIF
  squadView(q) {
    const army = this.sim.army, U = UNITS[q.type], mx = army.maxN(q.type, q), rk = army.rank(this.sim, q.type), F = FORMATIONS[q.form], field = q.mode === 'field';
    let h = `<div class="ptitle">${U.ico} ${this.unitName(q)} · ${q.n} hommes<span class="lvl">⭐ ${rk.name}</span></div>
      <div class="hpline"><div class="bar big"><i style="width:${Math.min(100, army.hpRatio(q) * 100)}%"></i></div><span>${Math.round(q.hp)} PV · ${q.n}/${mx}</span></div>
      <div class="hint small">${field ? '⚔ Sur le champ de bataille' : q.custom ? '🛡 À son poste' : `🛡 Garde ${SECTOR_AT[q.sector]}`}${q.way.length ? ' · en marche' : ''}</div>`;
    h += q.auto ? '<div class="aibox">⚜ <b>Autonome</b> : elle choisit seule son poste, ses sorties, sa formation. Donne un ordre ci-dessous pour reprendre la main.</div>'
      : `<div class="aibox man">📯 <b>Elle suit tes ordres.</b> ${this.btn('⚜ La rendre autonome', 'elle se débrouillera seule', 'sqauto', false, 'act slim')}</div>`;
    h += `<div class="tgrp">1 · Où l'envoyer ?</div><div class="bigacts">${this.bigAct('⚔', 'Combattre dehors', 'puis touche le champ de bataille', 'sqgo:sortie', false)}${field ? this.bigAct('↩', 'Rentrer', 'retour derrière la muraille', 'gar:' + q.sector) : ''}${this.bigAct('📍', 'Placer à la main', 'puis touche la carte', 'sqgo:move')}</div>`;
    h += `<div class="tgrp">2 · Formation et posture</div><div class="hint small">Toutes les formations sont possibles, quelle que soit la taille (escouade, peloton ou escadron) : un gros effectif prend simplement plus de rangs.</div><div class="fgrid">${Object.keys(FORMATIONS).map(f => `<button class="fbtn ${q.form === f ? 'on' : ''}" data-a="form:${f}"><b>${FORMATIONS[f].ico}</b>${FORMATIONS[f].name}</button>`).join('')}</div><div class="hint small">${F.info}</div>
      <div class="row">${this.btn('🛡 Tenir la position', 'défend sa place', 'stance:hold', false, 'act slim' + (q.stance === 'charge' ? ' sec' : ''))}${this.btn('🔥 Charger', 'fonce sur les zombies', 'stance:charge', false, 'act slim' + (q.stance === 'charge' ? '' : ' sec'))}</div>`;
    const pool = army.poolFor(q), g = q.grade, cat = U.name.toLowerCase() + 's';
    h += `<div class="tgrp">3 · Organisation</div><div class="hint small">${pool} ${cat} disponibles (troupes en garnison + réserve). Escouade 15 · peloton 50 · escadron 150.</div><div class="row wrapr">`
      + (g === 'escouade' ? this.btn('⬆ Former un peloton', army.canRegroup(q, 'peloton') ? 'fusionne avec les voisins (50)' : `il faut 50 ${cat}`, 'regroup:peloton', !army.canRegroup(q, 'peloton'), 'act slim') : '')
      + (g !== 'escadron' ? this.btn('⬆⬆ Former un escadron', army.canRegroup(q, 'escadron') ? 'fusionne (150)' : `il faut 150 ${cat}`, 'regroup:escadron', !army.canRegroup(q, 'escadron'), 'act slim' + (g === 'escouade' ? ' sec' : '')) : '')
      + (g === 'escadron' ? this.btn('⬇ Séparer en pelotons', '3 × 50', 'split:peloton', q.n < 65, 'act slim sec') : '')
      + (g !== 'escouade' ? this.btn('⬇ Séparer en escouades', 'groupes de 15 · le reste en réserve', 'split:escouade', q.n < 30, 'act slim sec') : '') + '</div>';
    h += `<div class="tgrp">4 · Effectif</div><div class="row">${this.btn('➕ Compléter', `jusqu'à ${mx} · réserve ${army.reserve[q.type]}`, 'reinf', q.n >= mx || army.reserve[q.type] <= 0, 'act slim')}${this.btn('↩ Dissoudre', 'retour en réserve', 'disb', false, 'act slim sec')}${this.btn('👁 Voir', 'sur la carte', 'sqsee', false, 'act slim sec')}</div>`;
    return h;
  }
  // bulle d'escouade (ancrée sur la carte) : ordres directs
  squadCard(q) {
    const army = this.sim.army, U = UNITS[q.type], mx = army.maxN(q.type, q), field = q.mode === 'field';
    const where = field ? '⚔ Sur le champ' : q.custom ? '🛡 À son poste' : '🛡 Garde ' + SECTOR_AT[q.sector];
    return `<div class="ptitle">${U.ico} ${this.unitName(q)} <span class="tag ${q.auto ? 'ai' : 'man'}">${q.auto ? '⚜' : '📯'}</span><span class="lvl">${where}${q.way.length ? ' · en marche' : ''}</span></div>
      <div class="hpline"><div class="bar big"><i style="width:${Math.min(100, army.hpRatio(q) * 100)}%"></i></div><span>${q.n}/${mx}</span></div>
      <div class="bigacts">${this.bigAct('⚔', 'Combattre', 'touche ensuite le champ', 'sqgo:sortie')}${field ? this.bigAct('↩', 'Rentrer', 'à son poste', 'gar:' + q.sector) : this.bigAct('📍', 'Déplacer', 'touche ensuite la carte', 'sqgo:move')}${this.bigAct('⚙', 'Ordres', 'organisation, effectif…', 'sqorders')}</div>
      <div class="fgrid mini">${Object.keys(FORMATIONS).map(f => `<button class="fbtn ${q.form === f ? 'on' : ''}" data-a="form:${f}" title="${FORMATIONS[f].info}"><b>${FORMATIONS[f].ico}</b>${FORMATIONS[f].name}</button>`).join('')}</div>`;
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
    h += `<div class="prio"><span>Emplacement :</span>${SECTOR_NAMES.map((x, i) => `<button class="chipb ${this.siegeSec === i ? 'on' : ''}" data-a="sseg:${i}">${x} <small>${S.inSector(i)}/${SIEGE_RULES.slotsPerSector}</small></button>`).join('')}</div>`;
    for (const t of SIEGE_ORDER) {
      const D = SIEGE[t], locked = lv < D.level, off = locked || !S.canBuild(sim, t, this.siegeSec) || !E.afford(D.cost);
      h += `<div class="card"><div class="ct"><b>${D.ico} ${D.name}</b><small>${locked ? `Atelier niv. ${D.level} requis` : D.info}</small><small>${this.cost(D.cost)} · ${D.time}s · 👥${D.crew} · tir : ${this.cost(D.ammo)}</small></div>${this.btn('Poser', SECTOR_NAMES[this.siegeSec], 'sbuild:' + t, off, 'act slim')}</div>`;
    }
    if (S.queue.length) h += `<div class="queue">${S.queue.map((it, i) => `<span class="qi">${SIEGE[it.type].ico}${i === 0 ? `<i style="width:${100 * (1 - it.t / it.full)}%"></i>` : ''}</span>`).join('')}<button class="chipb" data-a="scancel">↩ annuler</button></div>`;
    if (S.weapons.some(w => w.noAmmo)) h += '<div class="warn">⚠ Munitions épuisées (pierre / fer) : une arme ne tire plus.</div>';
    for (const w of S.weapons) h += `<div class="row step"><span class="lab">${SIEGE[w.type].ico} ${SIEGE[w.type].name}<small class="sub">${SECTOR_NAMES[w.sector]}${w.noAmmo ? ' · sans munitions' : ''}</small></span>${this.btn('Démonter', '+ ½ ressources', 'sdis:' + w.id, false, 'act slim sec')}</div>`;
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
    const sim = this.sim, E = sim.eco, idle = E.idleCount(), pop = E.population(), cap = E.popCap(), builders = E.builderCount(), part = this.nav.folk;
    // 👥 Villageois : catégories (récolte, défrichage et feux, réparations, prospection), puis le sous-menu
    if (!part) {
      const harvest = TASK_ORDER.reduce((a, t) => a + E.assign[t], 0), dmg0 = this.damagedSegs(), N0 = sim.night, P0 = N0.piles();
      return `<div class="pop"><span>👥 <b>${pop}</b>/${cap} · libres <b>${idle}</b> · 👷 ${builders} au chantier</span>${this.btn('+ Villageois', this.cost(ECON.villagerCost), 'vil', pop >= cap || !E.afford(ECON.villagerCost), 'act slim')}</div>`
        + (pop >= cap ? '<div class="warn">Population au maximum : construis des 🏠 maisons.</div>' : '') + (E.famine ? '<div class="warn">⚠ Famine : ajoute des fermiers !</div>' : '')
        + this.cats('folk', [
          { k: 'harvest', ico: '⛏', name: 'Récolte', sub: 'bois, pierre, fer, or, nourriture', badge: harvest ? `${harvest} au travail` : '', alert: E.famine },
          { k: 'special', ico: '🔥', name: 'Défrichage et feux', sub: `forêts à abattre · bûchers ${P0.ready}/${P0.n}`, badge: (E.assign.clear + E.assign.fire) ? `${E.assign.clear + E.assign.fire} au travail` : '', alert: N0.nightSoon() && !E.assign.fire },
          { k: 'repair', ico: '🔧', name: 'Réparations', sub: dmg0 ? `${dmg0} tronçon(s) abîmé(s)` : 'muraille intacte', badge: E.assign.repair ? `${E.assign.repair} maçons` : '', alert: dmg0 > 0 && !E.assign.repair },
          { k: 'explore', ico: '🧭', name: 'Prospection', sub: E.prospect ? 'exploration en cours…' : 'trouver de nouveaux gisements' },
        ]);
    }
    let h = this.back('folk', { harvest: '⛏ Récolte', special: '🔥 Défrichage et feux', repair: '🔧 Réparations', explore: '🧭 Prospection' }[part] || '');
    if (part === 'harvest') h += `<div class="pop"><span>👥 <b>${pop}</b>/${cap} · villageois ${E.villagers.length}<br>libres <b>${idle}</b> · 👷 ouvriers de chantier <b>${builders}</b></span>${this.btn('+ Villageois', this.cost(ECON.villagerCost), 'vil', pop >= cap || !E.afford(ECON.villagerCost), 'act slim')}</div>`;
    if (part === 'harvest') h += `<div class="hint small">Les villageois <b>libres</b> deviennent ouvriers dès qu'un chantier en demande. Sans libre, <b>+</b> emprunte un villageois à la tâche la moins urgente (↺) ; il y retourne quand on le retire ou quand la réparation est finie (🔁).</div>`;
    if (part === 'harvest' && E.loans.length) h += `<div class="hint small">🔁 ${E.loans.length} villageois prêté${E.loans.length > 1 ? 's' : ''} : ${E.loans.map(l => `${l.from ? TASKS[l.from].ico : '💤'}→${TASKS[l.to].ico}`).join(' ')}</div>`;
    if (part === 'harvest' && E.famine) h += `<div class="warn">⚠ Famine : la récolte est réduite de moitié. Ajoute des fermiers !</div>`;
    if (part === 'harvest') for (const t of TASK_ORDER) {
      const T = TASKS[t], n = E.assign[t], capT = E.taskCap(t), B = BUILDINGS[T.building], hasSlots = E.slots(T.building) > 0;
      let sub = `<i class="no">Construis : ${B.name}</i>`;
      if (hasSlots) { const left = T.deposit ? E.totalDeposit(t) : null, nx = E.extra[t] ? E.extra[t].filter(e => e.amount > 0).length : 0; sub = `+${E.rate[t].toFixed(2)}/s · places ${n}/${n + capT}` + (left !== null ? ` · gisement ${fmt(left)}` + (nx ? ` (+${nx} découvert${nx > 1 ? 's' : ''})` : '') + (t === 'wood' ? ' · 🌲 repousse' : '') + (left <= 0 ? ' ⚠ épuisé' : '') : ''); }
      h += `<div class="row step task"><span class="lab">${T.ico} ${T.name}<small class="sub">${sub}</small></span>${this.btn('−', '', `as:${t}:-1`, n <= 0, 'sq')}<b class="val">${n}${E.loans.some(l => l.to === t) ? '<small>🔁</small>' : ''}</b>${this.btn('+', idle <= 0 && E.donorFor(t) ? '↺' : '', `as:${t}:1`, (idle <= 0 && !E.donorFor(t)) || n >= capT, 'sq')}</div>`;
    }
    if (part === 'explore') {
      const P = E.prospect;
      h += `<div class="card"><div class="ct"><b>🧭 Prospection</b><small>${P ? `Un villageois explore la campagne… ${Math.round(100 * P.t / P.dur)} %` : `Un villageois libre part ${PROSPECT.time} s et découvre un nouveau gisement ailleurs sur la carte.`}</small></div></div>`;
      if (!P) h += `<div class="row">${PROSPECT.res.map(r => this.btn(`${RES_INFO[r].ico || ''} ${RES_INFO[r].name}`, this.cost(PROSPECT.cost), 'pro:' + r, !E.canProspect(r), 'act slim')).join('')}</div>`;
    }
    if (part === 'special') {   // défricheurs et allumeurs : tâches sans bâtiment
      const nc = E.assign.clear, act = sim.frontier.active().length, nf = E.assign.fire, lit = sim.night.fires.filter(f => f.lit).length;
      h += `<div class="row step task"><span class="lab">🪓 Défricheurs<small class="sub">${act ? `${act} parcelle${act > 1 ? 's' : ''} en cours · bois rapporté` : 'touche une forêt sur les côtés du village pour la défricher'}</small></span>${this.btn('−', '', 'as:clear:-1', nc <= 0, 'sq')}<b class="val">${nc}</b>${this.btn('+', idle <= 0 && E.donorFor('clear') ? '↺' : '', 'as:clear:1', (idle <= 0 && !E.donorFor('clear')) || nc >= TASKS.clear.slots, 'sq')}</div>`;
      const P = sim.night.piles(), N = sim.night, fstate = N.isNight() ? 'nuit : feux allumés et ravitaillés' : N.nightSoon() ? 'la nuit approche : on allume' : N.building(sim) ? 'entre deux vagues : bûchers en préparation' : 'pendant l\'assaut : à l\'abri';
      h += `<div class="row step task"><span class="lab">🔥 Équipe des feux<small class="sub">${E.crew.length} allumeurs autonomes s'en chargent déjà (hors quota, sans bois) · renfort facultatif · Plaine : ${P.ready} bûcher${P.ready > 1 ? 's' : ''} prêt${P.ready > 1 ? 's' : ''}/${P.n}${P.lit ? ` · ${P.lit} en feu` : ''} · braseros ${lit - P.lit}/${N.fires.length - P.n} · ${fstate}${E.up.firecraft ? ` · savoir-faire niv. ${E.up.firecraft}` : ''}</small></span>${this.btn('−', '', 'as:fire:-1', nf <= 0, 'sq')}<b class="val">${nf}</b>${this.btn('+', idle <= 0 && E.donorFor('fire') ? '↺' : '', 'as:fire:1', (idle <= 0 && !E.donorFor('fire')) || nf >= TASKS.fire.slots, 'sq')}</div>`;
    }
    if (part !== 'repair') return h;
    const dmg = this.damagedSegs(), n = E.assign.repair;
    h += `<div class="row step task"><span class="lab">🔧 Réparation muraille<small class="sub">${dmg ? dmg + ' tronçon(s) à réparer' : 'muraille intacte'} · pierre${sim.autoRepair ? ' · auto ✅' : ''}</small></span>${this.btn('−', '', 'as:repair:-1', n <= 0, 'sq')}<b class="val">${n}</b>${this.btn('+', idle <= 0 && E.donorFor('repair') ? '↺' : '', 'as:repair:1', (idle <= 0 && !E.donorFor('repair')) || n >= TASKS.repair.slots, 'sq')}</div>`;
    h += `<div class="prio"><span>Priorité :</span>${[['-1', 'La plus abîmée'], ...SECTOR_NAMES.map((x, i) => [String(i), x])].map(([v, l]) => `<button class="chipb ${E.repairPriority === +v ? 'on' : ''}" data-a="prio:${v}">${l}</button>`).join('')}</div>`;
    return h;
  }
  damagedSegs() { const w = this.sim.wall; let n = 0; for (let i = 0; i < 40; i++) if (w.hp[i] < w.segMax(i) - 0.5) n++; return n; }
  // 📜 Savoir : catégories (où améliorer quoi, améliorations du village), puis le sous-menu
  techHtml() {
    const part = this.nav.tech, E0 = this.sim.eco;
    if (!part) return this.cats('tech', [
      { k: 'village', ico: '🎓', name: 'Améliorations du village', sub: E0.level.university ? `université niv. ${E0.level.university}` : 'construis l\'université' },
      { k: 'where', ico: '🗺', name: 'Où améliorer quoi ?', sub: 'chaque amélioration et son bâtiment' },
      { k: 'guide', ico: '📖', name: 'Guide du défenseur', sub: 'bases, bestiaire, raccourcis' },
      { k: 'wave', ico: '🔭', name: 'Prochaine vague', sub: 'composition et conseil' },
    ]);
    if (part === 'guide') { this.guideOn = true; return this.back('tech', '📖 Guide du défenseur') + this.guideHtml().replace(/<button class="lnk"[^>]*>replier<\/button>/, ''); }
    if (part === 'wave') { this.nav.tech = null; this.closeSheet(); setTimeout(() => this.toggleWavePop(true), 30); return ''; }
    const full = this.techFull(), cut = full.indexOf('<div class="tgrp">Village</div>');
    return this.back('tech', part === 'where' ? '🗺 Où améliorer quoi ?' : '🎓 Améliorations du village') + (part === 'where' ? full.slice(0, cut) : full.slice(cut));
  }
  techFull() {
    const E = this.sim.eco; let h = '<div class="tgrp">Où améliorer quoi ?</div><div class="where">' + [
      ['forge', '🔨 Forge', 'attaque et défense de chaque type d\'unité (indépendantes du rang)'], ['university', '🎓 Université', 'outils, chariots, chemins pavés, charrue, maçonnerie, apprentissage, savoir-faire des allumeurs'], ['infirmary', '🏥 Infirmerie', 'soigne les escouades au repos, sauve des blessés'], ['publicworks', '🛤 Travaux publics', 'trace des routes ; niveau = qualité de toutes les routes (terre battue, gravier, pavés)'], ['wizard', '🔮 Maison du sorcier', 'invoque le magicien ; son niveau = puissance du magicien ; Arcanes'],
      ['barracks', BARRACKS_ICO + ' Caserne · 🐎 Écurie · 🎯 Champ de tir', 'leur niveau = rang des unités (Recrue → Légende)'], ['workshop', '🛠 Atelier de siège', 'baliste, catapulte, trébuchet ; aspect des machines'],
      ['sawmill', SAWMILL_ICO + ' Scierie · ⛏ Carrière · ⛓ Mine · 🌾 Ferme', 'niveau = places et rendement ; de nouvelles installations apparaissent'],
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
    document.body.classList.toggle('isover', !!on);
    if (!on) return;
    const sim = this.sim; let best = 0; try { best = +localStorage.getItem('castle-best') || 0; if (sim.wave > best) localStorage.setItem('castle-best', sim.wave); } catch { /* stockage indisponible */ }
    $('#over-stats').innerHTML = `Vague <b>${sim.wave}</b> · ${sim.zombies.kills} zombies abattus · ${sim.stats.breaches} brèche(s)<br><small>${sim.wave > best ? '🏅 Nouveau record !' : `Record : vague ${best}`}</small>`;
    let cp = null; try { cp = JSON.parse(localStorage.getItem('castle-checkpoint')); } catch { /* aucun */ }
    let rb = $('#over-retry'); if (!rb) { rb = el('button', 'btn sec'); rb.id = 'over-retry'; $('#over .box').appendChild(rb); rb.addEventListener('click', () => this.act('x:retry')); }
    rb.style.display = cp ? '' : 'none'; if (cp) rb.textContent = `↺ Reprendre au début de la vague ${cp.wave}`;
    $('#over-btn').textContent = 'Nouvelle partie';
  }
}

installExtrasUI(UI);
