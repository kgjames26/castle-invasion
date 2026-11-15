// Interface des systèmes v4.0 : fiches (défenses du secteur, village, héros, recherches), pièges, événements, bilan de vague,
// succès, mini-carte, sauvegardes multiples, tutoriel guidé, modes de jeu (survie, défi du jour, campagne), vue d'un archer.
import * as THREE from 'three';
import { EXTRA, ZOMBIES, SIEGE, STRUCT, STREAM, FRONTIER, RES_INFO } from '../content/medieval.js';
import { SECTORS, SECTOR_W, SECTOR_NAMES, W, D, CASTLE, WALL_STAND_Z, wallOff } from '../sim/constants.js';
import { archerPos } from '../sim/army.js';
import { serialize, restore } from '../sim/save.js';

const $ = s => document.querySelector(s);
const RICO = r => RES_INFO[r].ico;
const SECT = SECTOR_NAMES;   // mêmes noms que partout ailleurs (Porte gauche… Porte droite)
const WEATHER = { clear: ['☀', 'Temps clair'], rain: ['🌧', 'Pluie : portée des tireurs −15 %'], fog: ['🌫', 'Brouillard : hordes invisibles plus longtemps, portée −10 %'], snow: ['❄', 'Neige : tout le monde ralentit'] };
export const ACH = [
  ['w1', '🛡', 'Première nuit', 'Repousser la première vague', s => s.wave >= 2],
  ['w10', '🏰', 'Bastion', 'Atteindre la vague 10', s => s.wave >= 10],
  ['w20', '👑', 'Légende du rempart', 'Atteindre la vague 20', s => s.wave >= 20],
  ['nobreach', '🧱', 'Muraille intacte', 'Finir une vague (5+) sans brèche', null],
  ['boss', '💀', 'Régicide', 'Abattre le Seigneur pourri', null],
  ['houses', '🏘', 'Notables', 'Avoir 5 maisons de niveau 4', s => s.build.items.filter(b => b.type === 'house' && b.level >= 4).length >= 5],
  ['hero5', '⭐', 'Capitaine illustre', 'Un héros niveau 5', s => s.extras.hero && s.extras.hero.lv >= 5],
  ['traps', '🪤', 'Chausse-trappe', 'Poser 10 pièges', s => s.extras.trapId > 10],
  ['moat', '🌊', 'Douves à pieux', 'Douves à pieux sur un secteur', s => [...s.extras.moat].some(v => v >= 3)],
  ['k1000', '⚔', 'Mille têtes', 'Abattre 1 000 zombies', s => s.zombies.kills >= 1000],
  ['fest', '🎉', 'Fête au village', 'Organiser une fête', null],
  ['powder', '💥', 'Poudre noire', 'Découvrir la poudre noire', s => s.extras.tech.powder],
  ['campaign', '📜', 'Chroniques du royaume', 'Terminer la campagne', null],
];
export const CAMPAIGN = [
  { id: 1, name: 'Le Val paisible', goal: 8, start: { wood: 260, stone: 200, iron: 60, food: 220, gold: 100 }, intro: 'Au cœur du val, les premiers morts se relèvent. Tiens huit vagues, le temps que le roi rassemble ses bannières.', outro: 'Le val tient bon. Le roi te confie la marche du nord.' },
  { id: 2, name: 'Les Marches du Nord', goal: 12, seed: 4242, start: { wood: 160, stone: 120, iron: 30, food: 150, gold: 60 }, mods: ['dark'], intro: 'Brume et neige : les marches sont pauvres et les hordes surgissent du brouillard. Douze vagues.', outro: 'Les marches sont sauves. Il reste la dernière citadelle.' },
  { id: 3, name: 'La Dernière Citadelle', goal: 15, seed: 9090, start: { wood: 220, stone: 220, iron: 80, food: 200, gold: 120 }, mods: ['giants'], intro: 'Tout le royaume s\'est replié ici. Les colosses viennent à chaque vague, le Seigneur pourri à la dixième. Tiens quinze vagues.', outro: 'La citadelle a tenu. Le royaume se souviendra de ton nom.' },
];
const MODS = { poor: '💰 Disette (ressources ÷2, récolte −20 %)', fast: '💨 Hordes rapides (+25 %)', noArchers: '🚫 Pas d\'archers', giants: '🗿 Un colosse à chaque vague', dark: '🌫 Brume éternelle' };
export function dailyChallenge() {
  const d = new Date(), seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(), keys = Object.keys(MODS); let s = seed;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647, a = keys[(r() * keys.length) | 0]; let b = a; while (b === a) b = keys[(r() * keys.length) | 0];
  return { kind: 'daily', seed, mods: [a, b], label: `${d.getDate()}/${d.getMonth() + 1}` };
}
const store = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch { return null; } };

export function installExtrasUI(UI) {
  const P = UI.prototype;
  // ——— fiches ———
  P.sectorExtras = function (s) {
    const X = this.sim.extras, cd = X.oilCd[s], mv = X.moat[s], mw = X.moatWork[s] > 0, pal = X.pal[s], pw = X.palWork[s] > 0, M = EXTRA.moat;
    let h = `<div class="xbox"><div class="gt">Défenses avancées</div><div class="row wrapr">`;
    h += this.btn(cd > 0 ? `🫕 Huile (${Math.ceil(cd)} s)` : '🫕 Huile bouillante', cd > 0 ? 'en chauffe' : this.cost(EXTRA.oil.cost) + ' · brûle les assaillants', `x:oil:${s}`, cd > 0 || !this.sim.eco.afford(EXTRA.oil.cost), 'act slim');
    h += this.btn(mw ? `🌊 ${M.names[mv + 1]}… ${Math.ceil(X.moatWork[s])} s` : mv >= 3 ? `🌊 ${M.names[3]}` : `🌊 ${M.names[mv + 1]}`, mv >= 3 ? 'au maximum' : mw ? 'chantier' : this.cost(M.cost[mv + 1]) + ` · ralentit (×${M.slow[mv + 1]})`, `x:moat:${s}`, mv >= 3 || mw || !this.sim.eco.afford(M.cost[mv + 1] || {}), 'act slim sec');
    h += this.btn(pw ? `🪵 Palissade… ${Math.ceil(X.palWork[s])} s` : pal > 0 ? `🪵 Palissade ${Math.round(100 * pal / EXTRA.palisade.hp)} %` : '🪵 Palissade', pal > 0 && pal < EXTRA.palisade.hp ? 'réparer · ' + this.cost(EXTRA.palisade.repair) : pal > 0 ? 'première ligne, plus au nord' : this.cost(EXTRA.palisade.cost) + ' · arrête la horde plus loin', `x:pal:${s}`, pw || pal >= EXTRA.palisade.hp, 'act slim sec');
    if (pal > 0 || X.palFire[s] > 0) h += this.btn(X.palFire[s] > 0 ? `🔥 Palissade en feu… ${Math.ceil(X.palFire[s])} s` : '🔥 Enflammer la palissade', X.palFire[s] > 0 ? 'elle brûle les assaillants' : 'bloque et brûle les zombies, puis se consume', `x:palfire:${s}`, X.palFire[s] > 0, 'act slim warnb');
    if (X.pal.filter(v => v > 0).length > 1 && X.palFire.every(v => v <= 0)) h += this.btn('🔥 Toutes les palissades', 'les enflammer d\'un coup', 'x:palfireall', false, 'act slim warnb');
    h += this.btn('👁 Vue d\'un archer', 'sur ce rempart', `x:fpv:${s}`, !this.sim.army.archers[s].n, 'act slim sec');
    return h + '</div></div>';
  };
  P.castleExtras = function () {
    const sim = this.sim, X = sim.extras, S = X.season(), wx = WEATHER[X.weather], m = Math.round(X.morale);
    let h = `<div class="xbox"><div class="gt">${S.ico} ${S.name} · ${wx[0]} ${wx[1]}</div>`;
    h += `<div class="hpline"><div class="bar"><i style="width:${m}%;background:${m > 60 ? 'var(--ok)' : m > 35 ? '#d9a63a' : 'var(--bad)'}"></i></div><span>🙂 Moral ${m}</span></div>`;
    h += `<div class="hint small">Le moral règle la production (×${(0.8 + 0.4 * m / 100).toFixed(2)}) et la vitesse des chantiers. Il monte avec les victoires, l'église et les fêtes ; il baisse avec les pertes et la faim.${S.name === 'Hiver' ? ' ❄ En hiver, le village brûle du bois pour se chauffer.' : ''}</div>`;
    h += `<div class="row">${this.btn('🎉 Fête au village', X.festCd > 0 ? 'une par vague' : this.cost(EXTRA.festival.cost) + ' · moral +25', 'x:fest', X.festCd > 0 || !sim.eco.afford(EXTRA.festival.cost), 'act slim')}</div>`;
    const SP = { carpenter: ['🪚 Charpentier', 'bois +25 %, chantiers +20 %'], baker: ['🥖 Boulanger', 'nourriture +20 % (sans lui : −15 % avec un moulin)'], smith: ['⚒ Forgeron', 'attaque de toutes les troupes +8 %'] };
    h += `<div class="gt" style="margin-top:6px">Métiers spécialisés</div>`;
    for (const k in SP) h += `<div class="row step"><span class="lab">${SP[k][0]}<small class="sub">${SP[k][1]}</small></span>${this.btn(X.spec[k] ? '✅ en poste' : '⬜ libre', X.spec[k] ? 'renvoyer' : 'prend un villageois libre', `x:spec:${k}`, !X.spec[k] && sim.eco.idleCount() <= 0, 'act slim' + (X.spec[k] ? '' : ' sec'))}</div>`;
    return h + '</div>';
  };
  P.heroHtml = function () {
    const X = this.sim.extras, H = X.hero;
    if (!H) return `<div class="xbox"><div class="gt">⭐ Héros</div><div class="hint small">Un capitaine nommé rejoint ta plus forte escouade : il gagne de l'expérience, renforce ses hommes et peut pousser un cri de ralliement. S'il tombe, c'est pour toujours.</div>${this.btn('⭐ Engager un capitaine', (this.sim.eco.level.barracks || 0) < 2 ? 'caserne niv. 2 requise' : this.cost(EXTRA.hero.cost), 'x:hero', (this.sim.eco.level.barracks || 0) < 2 || !this.sim.army.squads.length || !this.sim.eco.afford(EXTRA.hero.cost), 'act slim')}</div>`;
    const nx = EXTRA.hero.xp[H.lv] || 0;
    return `<div class="xbox"><div class="gt">⭐ Capitaine ${H.name} · niv. ${H.lv}</div><div class="hpline"><div class="bar"><i style="width:${nx ? Math.min(100, 100 * H.xp / nx) : 100}%"></i></div><span>${H.xp}${nx ? '/' + nx : ''} xp</span></div><div class="hint small">Son escouade frappe +${6 * H.lv} %.</div>${this.btn(X.rallyCd > 0 ? `📯 Ralliement (${Math.ceil(X.rallyCd)} s)` : '📯 Cri de ralliement', 'toutes les escouades +30 % pendant 15 s', 'x:rally', X.rallyCd > 0, 'act slim')}</div>`;
  };
  P.researchHtml = function () {
    const X = this.sim.extras, uni = this.sim.eco.level.university || 0; let h = `<div class="xbox"><div class="gt">🔬 Recherches</div>`;
    if (X.research) h += `<div class="hint small">${EXTRA.tech[X.research.k].ico} ${EXTRA.tech[X.research.k].name} : encore ${Math.ceil(X.research.t)} s</div>`;
    for (const k in EXTRA.tech) { const T = EXTRA.tech[k]; h += `<div class="row step"><span class="lab">${T.ico} ${T.name}<small class="sub">${T.info}${uni < T.uni ? ` · université niv. ${T.uni}` : ''}</small></span>${X.tech[k] ? '<span class="max">acquis</span>' : this.btn('Lancer', this.cost(T.cost) + ` · ${T.time} s`, `x:tech:${k}`, !!X.research || uni < T.uni || !this.sim.eco.afford(T.cost), 'act slim')}</div>`; }
    return h + '</div>';
  };
  // ——— pièges : mode de pose (toucher la plaine entre la palissade et la muraille) ———
  P.trapsHtml = function () {
    let h = '<div class="hint small">Les pièges se posent dans la plaine, devant la muraille. Choisis-en un puis touche la carte (plusieurs fois pour en poser plusieurs).</div><div class="row wrapr">';
    for (const k in EXTRA.traps) { const T = EXTRA.traps[k]; h += this.btn(`${T.ico} ${T.name}`, this.cost(T.cost), `x:trap:${k}`, !this.sim.eco.afford(T.cost), 'act slim' + (this.trapMode === k ? '' : ' sec')); }
    return h + `</div><div class="hint small">${this.sim.extras.traps.length}/${EXTRA.maxTraps} pièges posés.</div>`;
  };
  // ——— actions ———
  P.extrasAct = function (x, y) {
    const sim = this.sim, X = sim.extras, s = +y;
    switch (x) {
      case 'oil': if (X.oil(s)) { this.toast('🫕 Huile bouillante sur le secteur ' + SECT[s], 'warn'); this.hooks.audio?.oil?.(); } break;
      case 'moat': if (X.digMoat(s)) this.toast('🌊 Les villageois creusent', 'ok'); break;
      case 'pal': if (X.buildPalisade(s)) this.toast('🪵 Palissade en chantier', 'ok'); break;
      case 'palfire': if (X.ignitePalisade(s)) { this.toast('🔥 La palissade s\'embrase !', 'warn'); this.hooks.audio?.oil?.(); } break;
      case 'palfireall': { const n = X.igniteAll(); if (n) { this.toast(`🔥 ${n} palissades s'embrasent !`, 'warn'); this.hooks.audio?.oil?.(); } break; }
      case 'fpv': { const a = sim.army.archers[s]; if (!a.n) break; this.closeCard(); const k = Math.min(a.n - 1, 2); this.cam.fpvYaw = 0; this.cam.fpv = () => sim.army.archers[s].n ? { ...archerPos(s, Math.min(k, sim.army.archers[s].n - 1)), y: 6.4 } : null; document.body.classList.add('fpv'); this.toast('👁 Glisse pour regarder autour · ✕ pour quitter', 'info'); break; }
      case 'fpvx': this.cam.fpv = null; document.body.classList.remove('fpv'); break;
      case 'fest': if (X.festival()) { this.toast('🎉 Fête au village : moral +25', 'ok'); this.unlock('fest'); } break;
      case 'spec': X.setSpec(y, X.spec[y] ? -1 : 1); break;
      case 'hero': if (X.hireHero()) this.toast(`⭐ Le capitaine ${X.hero.name} rejoint tes troupes`, 'ok'); break;
      case 'rally': if (X.rallyCry()) this.hooks.audio?.shout?.(); break;
      case 'tech': if (X.startResearch(y)) this.toast(`🔬 Recherche : ${EXTRA.tech[y].name}`, 'ok'); break;
      case 'trap': this.trapMode = this.trapMode === y ? null : y; this.closeSheet(); if (this.trapMode) { this.cam.focusOn(100, 122); this.toast(`${EXTRA.traps[y].ico} Touche la plaine devant la muraille pour poser · touche ✕ pour arrêter`, 'info'); } this.renderTrapBar(); break;
      case 'trapx': this.trapMode = null; this.renderTrapBar(); break;
      case 'ev': X.resolveEvent(+y); this.renderEvent(true); break;
      case 'recapx': $('#recap')?.classList.remove('on'); break;
      case 'slot': this.saveSlot(+y); break;
      case 'load': this.loadSlot(+y); break;
      case 'retry': this.retryWave(); break;
      case 'mode': this.newMode = y === 'daily' ? dailyChallenge() : y === 'survival' ? { kind: 'survival' } : y.startsWith('c') ? { kind: 'campaign', ...CAMPAIGN[+y.slice(1) - 1] } : { kind: 'classic' }; this.html.sheet = ''; break;
      case 'tutox': this.tuto = null; store('castle-tuto', 1); $('#tuto')?.classList.remove('on'); this.tutoPoint(); break;
      case 'mm': this.mmOn = !this.mmOn; $('#minimap')?.classList.toggle('off', !this.mmOn); store('castle-mm', this.mmOn ? 1 : 0); break;
      case 'vic': $('#victory')?.classList.remove('on'); break;
      case 'modego': $('#victory')?.classList.remove('on'); this.openSheet('newgame'); break;
    }
  };
  P.trapTap = function (x, z) { const r = this.sim.extras.placeTrap(this.trapMode, x, z); if (r.ok) { this.rd.orderPing(x, z, false); this.buzz(10); } else this.toast('⚠ ' + r.why, 'warn'); this.renderTrapBar(); return true; };
  P.renderTrapBar = function () {
    let el = $('#trapbar'); if (!el) { el = document.createElement('div'); el.id = 'trapbar'; el.className = 'orderbar'; document.getElementById('app').appendChild(el); el.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) { this.act(b.dataset.a); this.refresh(true); } }); }
    const k = this.trapMode; if (!k) { el.classList.remove('on'); return; } const T = EXTRA.traps[k];
    el.innerHTML = `<span>${T.ico} <b>${T.name}</b> · ${this.cost(T.cost)} · touche la plaine (${this.sim.extras.traps.length}/${EXTRA.maxTraps})</span><button class="x" data-a="x:trapx">✕</button>`; el.classList.add('on');
  };
  // ——— événements entre les vagues ———
  P.renderEvent = function (force) {
    const X = this.sim.extras, ev = X.event, key = ev ? ev.kind + (X.fireB ? Math.ceil(X.fireB.t) + ':' + (X.fireB.crew > 0) : '') : '';
    if (!force && key === this.evKey) return; this.evKey = key;
    let el = $('#evpanel'); if (!el) { el = document.createElement('div'); el.id = 'evpanel'; document.getElementById('app').appendChild(el); el.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b && !b.disabled) { this.act(b.dataset.a); this.refresh(true); } }); }
    if (!ev || this.sheet || this.card || this.trapMode) { el.classList.remove('on'); if (ev) this.evKey = ''; return; }
    const off = (o, i) => { const g = o.get ? Object.entries(o.get).map(([r, n]) => `+${n} ${this.cost({ [r]: 0 }).replace(/0/, '')}`).join(' ') : o.units ? Object.entries(o.units).map(([u, n]) => `+${n} ${u === 'archer' ? 'archers' : 'fantassins'}`).join(' ') : o.refugees ? `+${o.refugees} villageois` : ''; return this.btn(`${this.cost(o.give) || 'gratuit'} → ${g}`, '', `x:ev:${i}`, !this.sim.eco.afford(o.give), 'act slim'); };
    const T = { merchant: ['🧺 Un marchand ambulant', 'Il propose un échange avant de reprendre la route.'], caravan: ['🐪 La caravane', 'Marchandises et mercenaires, contre de l\'or ou des matériaux.'], refugees: ['🚶 Des réfugiés', `${ev.n} villageois demandent asile. Ils ont faim… et l'un d'eux est peut-être mordu.`], fire: ['🔥 Incendie !', `Un bâtiment brûle${X.fireB ? ` (${Math.ceil(X.fireB.t)} s)` : ''}. Sans pompiers, il perdra un niveau.`] }[ev.kind];
    el.innerHTML = `<b>${T[0]}</b><small>${T[1]}</small><div class="row wrapr">${ev.kind === 'fire' ? (X.fireB && X.fireB.crew > 0 ? '<span class="hint">🪣 Les villageois éteignent le feu…</span>' : this.btn('🪣 Envoyer 3 villageois', 'il faut des villageois libres', 'x:ev:0', this.sim.eco.idleCount() < 3, 'act slim')) : ev.offers.map(off).join('')}${ev.kind === 'fire' ? '' : this.btn('Refuser', '', 'x:ev:-1', false, 'act slim sec')}</div>`;
    el.classList.add('on'); if (ev.kind === 'fire' && X.fireB) { const b = this.sim.build.get(X.fireB.id); if (b && !this.fireFocused) { this.fireFocused = 1; this.cam.focusOn(b.x, b.z); } } else this.fireFocused = 0;
  };
  // ——— bilan de vague, victoire ———
  P.showRecap = function (r) {
    let el = $('#recap'); if (!el) { el = document.createElement('div'); el.id = 'recap'; document.getElementById('app').appendChild(el); el.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) this.act(b.dataset.a); }); }
    const g = Object.entries(r.gain).filter(([, n]) => n).map(([k, n]) => `${this.cost({ [k]: 0 }).replace(/0/, '')} ${n > 0 ? '+' : ''}${n}`).join(' · ');
    el.innerHTML = `<div class="rc"><b>🏆 Vague ${r.wave} repoussée</b><div class="rg"><div><big>${r.kills}</big><small>zombies abattus</small></div><div><big>${r.lost}</big><small>combattants perdus</small></div><div><big>${r.breaches}</big><small>brèches</small></div><div><big>${Math.floor(r.time / 60)}:${String(r.time % 60).padStart(2, '0')}</big><small>durée</small></div></div>
      ${r.best >= 0 && r.kills > 0 ? `<div class="hint small">⭐ Secteur le plus meurtrier : <b>${SECT[r.best]}</b></div>` : ''}<div class="hint small">Bilan des stocks : ${g || '—'}</div><button class="btn" data-a="x:recapx">Continuer</button></div>`;
    el.classList.add('on'); clearTimeout(this.recapT); this.recapT = setTimeout(() => el.classList.remove('on'), 9000);
    if (r.breaches === 0 && r.wave >= 5) this.unlock('nobreach');
  };
  P.showVictory = function (mode) {
    let el = $('#victory'); if (!el) { el = document.createElement('div'); el.id = 'victory'; document.getElementById('app').appendChild(el); el.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) this.act(b.dataset.a); }); }
    const done = store('castle-campaign') || 0; if (mode.kind === 'campaign') { store('castle-campaign', Math.max(done, mode.id)); if (mode.id === 3) this.unlock('campaign'); }
    el.innerHTML = `<div class="rc"><b>👑 Victoire${mode.name ? ' — ' + mode.name : ''}</b><div class="hint">${mode.outro || `Objectif atteint : ${mode.goal} vagues.`}</div><div class="row">${mode.id && mode.id < 3 ? this.btn('📜 Mission suivante', CAMPAIGN[mode.id].name, 'x:modego', false, 'act') : ''}${this.btn('Continuer à défendre', '', 'x:vic', false, 'act sec')}</div></div>`;
    if (mode.id && mode.id < 3) this.newMode = { kind: 'campaign', ...CAMPAIGN[mode.id] };
    el.classList.add('on');
  };
  // ——— succès ———
  P.unlock = function (id) {
    const got = store('castle-ach') || {}; if (got[id]) return; got[id] = Date.now(); store('castle-ach', got);
    const a = ACH.find(q => q[0] === id); if (a) this.toast(`🏅 Succès : ${a[1]} ${a[2]}`, 'ok');
  };
  P.checkAch = function () { const s = this.sim; for (const [id, , , , f] of ACH) if (f && f(s)) this.unlock(id); };
  P.achHtml = function () { const got = store('castle-ach') || {}; return `<div class="vols"><div class="hint small"><b>Succès</b> (${Object.keys(got).length}/${ACH.length})</div><div class="achs">${ACH.map(([id, ico, n, d]) => `<span class="${got[id] ? 'on' : ''}" title="${d}">${ico}<b>${n}</b><small>${d}</small></span>`).join('')}</div></div>`; };
  // ——— sauvegardes multiples et reprise de vague ———
  P.saveSlot = function (k) { store('castle-slot-' + k, { t: Date.now(), wave: this.sim.wave, st: serialize(this.sim) }); this.toast(`💾 Partie enregistrée (emplacement ${k + 1})`, 'ok'); this.html.sheet = ''; };
  P.loadSlot = function (k) { const o = store('castle-slot-' + k); if (!o) return; if (!confirm(`Charger l'emplacement ${k + 1} (vague ${o.wave}) ? La partie en cours sera remplacée.`)) return; this.hooks.loadState(o.st); this.closeSheet(); this.toast(`📂 Partie chargée (vague ${o.wave})`, 'ok'); };
  P.retryWave = function () { const o = store('castle-checkpoint'); if (!o) { this.toast('Aucune reprise disponible', 'warn'); return; } this.hooks.loadState(o.st); this.showOver(false); this.closeSheet(); this.toast(`↺ Reprise au début de la vague ${o.wave}`, 'ok'); };
  P.checkpoint = function () { store('castle-checkpoint', { wave: this.sim.wave, st: serialize(this.sim) }); };
  P.savesHtml = function () {
    let h = `<div class="vols"><div class="hint small"><b>Sauvegardes</b></div>`;
    for (let k = 0; k < 3; k++) { const o = store('castle-slot-' + k); h += `<div class="row step"><span class="lab">💾 Emplacement ${k + 1}<small class="sub">${o ? `vague ${o.wave} · ${new Date(o.t).toLocaleString('fr-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'vide'}</small></span>${this.btn('Enregistrer', '', 'x:slot:' + k, false, 'act slim sec')}${this.btn('Charger', '', 'x:load:' + k, !o, 'act slim sec')}</div>`; }
    const c = store('castle-checkpoint'); h += `<div class="row">${this.btn('↺ Recommencer la vague', c ? `reprise : vague ${c.wave}` : 'aucune', 'x:retry', !c, 'act slim sec')}${this.btn(this.mmOn ? '🗺 Masquer la mini-carte' : '🗺 Afficher la mini-carte', '', 'x:mm', false, 'act slim sec')}</div>`;
    const best = store('castle-survival') || []; if (best.length) h += `<div class="hint small">🏆 Survie : ${best.slice(0, 5).map((b, i) => `${i + 1}. vague ${b.w}`).join(' · ')}</div>`;
    return h + '</div>';
  };
  // ——— modes de jeu (feuille Nouvelle partie) ———
  P.modesHtml = function () {
    const m = this.newMode || { kind: 'classic' }, dc = dailyChallenge(), done = store('castle-campaign') || 0;
    let h = `<div class="hint small"><b>Mode</b></div><div class="row wrapr">${this.btn('🏰 Classique', 'sans fin, à ton rythme', 'x:mode:classic', false, 'act slim' + (m.kind === 'classic' ? '' : ' sec'))}${this.btn('♾ Survie', 'classement des vagues atteintes', 'x:mode:survival', false, 'act slim' + (m.kind === 'survival' ? '' : ' sec'))}${this.btn(`📅 Défi du ${dc.label}`, dc.mods.map(k => MODS[k].split(' ')[0]).join(' '), 'x:mode:daily', false, 'act slim' + (m.kind === 'daily' ? '' : ' sec'))}</div>`;
    h += `<div class="row wrapr">${CAMPAIGN.map(c => this.btn(`📜 ${c.id}. ${c.name}`, done >= c.id - 1 ? `tenir ${c.goal} vagues` : '🔒 mission précédente', 'x:mode:c' + c.id, done < c.id - 1, 'act slim' + (m.kind === 'campaign' && m.id === c.id ? '' : ' sec'))).join('')}</div>`;
    if (m.kind === 'daily') h += `<div class="hint small">${m.mods.map(k => MODS[k]).join(' · ')}</div>`;
    if (m.kind === 'campaign') h += `<div class="hint small">📜 ${m.intro}</div>`;
    return h;
  };
  // ——— mini-carte ———
  P.buildMinimap = function () {
    const el = document.createElement('div'); el.id = 'minimap'; el.innerHTML = '<canvas width="200" height="320"></canvas>'; document.getElementById('app').appendChild(el); this.mmOn = store('castle-mm') !== 0; el.classList.toggle('off', !this.mmOn);
    const cv = el.querySelector('canvas'); this.mm = cv.getContext('2d');
    cv.addEventListener('click', e => { const r = cv.getBoundingClientRect(); this.cam.focusOn((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * D); });
  };
  // (v4.6) mini-carte lisible : fond tiré du sol réel (routes, terre), forêts, eau, bâtiments à l'échelle, hordes, champ de vision réel
  P.mmBack = function () {
    const c = document.createElement('canvas'); c.width = W; c.height = D; const g = c.getContext('2d'), gc = this.rd.groundColor;
    if (gc) { g.drawImage(gc, 0, 0, W, D); g.fillStyle = 'rgba(40,60,30,.18)'; g.fillRect(0, 0, W, D); } else { g.fillStyle = '#4f6a3a'; g.fillRect(0, 0, W, D); }
    g.strokeStyle = '#3d6f9a'; g.lineCap = 'round'; g.lineWidth = 2.6; g.beginPath(); STREAM.forEach(([x, z], i) => i ? g.lineTo(x, z) : g.moveTo(x, z)); g.stroke();
    g.lineWidth = 4; g.strokeStyle = '#3d6f9a'; g.beginPath(); g.ellipse(CASTLE.x, CASTLE.z - 1, 26, 21, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#9a958a'; g.fillRect(CASTLE.x - 18, CASTLE.z - 14, 36, 27); g.fillStyle = '#8a2a1c'; for (const [dx, dz] of [[-18, -14], [18, -14], [-18, 13], [18, 13]]) { g.beginPath(); g.arc(CASTLE.x + dx, CASTLE.z + dz, 3.4, 0, 7); g.fill(); }
    return c;
  };
  P.drawMinimap = function () {
    const g = this.mm, sim = this.sim; if (!g || !this.mmOn) return; const t = performance.now() / 1000;
    if (!this.mmBg && this.rd.groundColor) this.mmBg = this.mmBack(); if (this.mmBg) g.drawImage(this.mmBg, 0, 0); else { g.fillStyle = '#4f6a3a'; g.fillRect(0, 0, W, D); }
    // forêts encore debout (lisière à défricher)
    const F = sim.frontier; if (F) { g.fillStyle = '#25472a'; for (const p of F.patches) if (p.state !== 'cleared') g.fillRect(p.x0, p.z0, FRONTIER.cell, FRONTIER.cell); }
    // muraille (couleur selon l'état de chaque secteur)
    for (let s = 0; s < SECTORS; s++) { const r = sim.wall.sectorHp(s) / sim.wall.sectorMax(s), br = sim.wall.breaches(s); g.strokeStyle = br && Math.sin(t * 8) > 0 ? '#ff3b30' : r < 0.5 ? '#e08a2b' : '#ddd6c6'; g.lineWidth = 5; g.beginPath();
      for (let k = 0; k <= 8; k++) { const x = s * SECTOR_W + k * SECTOR_W / 8, z = WALL_STAND_Z + wallOff(x) - 3; k ? g.lineTo(x, z) : g.moveTo(x, z); } g.stroke(); }
    // bâtiments à l'échelle
    for (const b of sim.build.items) { if (b.fixed) continue; const S = STRUCT[b.type]; if (!S) continue; const sz = S.size || [6, 4, 6], rot = b.rot && (Math.round(b.rot / (Math.PI / 2)) & 1), w = rot ? sz[2] : sz[0], d = rot ? sz[0] : sz[2];
      g.fillStyle = b.state === 'built' ? '#d8c49a' : 'rgba(216,196,154,.5)'; g.fillRect(b.x - w / 2, b.z - d / 2, w, d); g.strokeStyle = '#5a4630'; g.lineWidth = 0.8; g.strokeRect(b.x - w / 2, b.z - d / 2, w, d); }
    g.fillStyle = '#3d7bd6'; for (const q of sim.army.squads) { g.beginPath(); g.arc(q.x, q.z, 3.2, 0, 7); g.fill(); }
    const Z = sim.zombies, pulse = 1 + 0.25 * Math.sin(t * 6); g.fillStyle = '#ff3a2a';
    for (let i = 0; i < Z.n; i++) { const big = Z.type[i] >= 5 && Z.type[i] <= 7, r = big ? 6 * pulse : 3; g.fillRect(Z.x[i] - r / 2, Z.z[i] - r / 2, r, r); }
    // champ de vision : intersection réelle des coins de l'écran avec le sol
    const cam = this.rd.camera, v = this._mmv || (this._mmv = new THREE.Vector3()), pts = [];
    for (const [nx, ny] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { v.set(nx, ny, 0.5).unproject(cam).sub(cam.position); const tt = v.y < -1e-3 ? -cam.position.y / v.y : 400; pts.push([cam.position.x + v.x * Math.min(tt, 400), cam.position.z + v.z * Math.min(tt, 400)]); }
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1.6; g.beginPath(); pts.forEach(([x, z], i) => i ? g.lineTo(x, z) : g.moveTo(x, z)); g.closePath(); g.stroke();
  };
  // ——— objectifs (v6.0) : une chaîne de buts concrets avec récompense, affichée quand le tutoriel est fini ———
  const QUESTS = [
    ['🗼 Bâtis une tour', 'Les tours tirent seules sur les hordes à portée.', s => s.build.items.some(b => b.type === 'tower' && !b.fixed && b.state === 'built'), { stone: 40 }],
    ['🏠 Améliore une maison', 'Une maison niv. 2 loge bien plus de monde.', s => s.build.items.some(b => b.type === 'house' && !b.fixed && b.level >= 2), { wood: 50 }],
    ['🏹 Aie 15 archers', 'Forme des archers au champ de tir.', s => s.army.archers.reduce((a, b) => a + b.n, 0) + s.army.reserve.archer >= 15, { gold: 60 }],
    ['🧱 Renforce un secteur de muraille', 'Touche un tronçon de muraille › Renforcer.', s => s.wall.level.some(l => l >= 2), { stone: 80 }],
    ['🛡 Forme une escouade', 'Armée › Recruter des soldats : ils forment des escouades après la vague.', s => s.army.squads.length >= 1, { iron: 60 }],
    ['⚔ Repousse la vague 5', 'Tiens bon jusqu\'à la cinquième horde.', s => s.wave >= 6, { gold: 120 }],
    ['🎓 Bâtis l\'université', 'Les recherches débloquent de puissants bonus.', s => s.build.items.some(b => b.type === 'university' && b.state === 'built'), { gold: 80, stone: 60 }],
    ['👑 Repousse la vague 10', 'Le Seigneur pourri t\'attend…', s => s.wave >= 11, { gold: 250, iron: 120 }],
  ];
  P.tickQuest = function () {
    const sim = this.sim, X = sim.extras; if (!X || this.tuto != null) { $('#quest')?.classList.remove('on'); return; }
    let el = $('#quest'); if (!el) { el = document.createElement('div'); el.id = 'quest'; document.getElementById('app').appendChild(el); el.addEventListener('click', e => { if (e.target.closest('[data-q=hide]')) { this.questHidden = !this.questHidden; el.dataset.k = ''; this.tickQuest(); } }); }
    const q = QUESTS[X.quest]; if (!q) { el.classList.remove('on'); return; }
    if (q[2](sim)) { for (const r in q[3]) sim.eco.add(r, q[3][r]); X.quest++; this.toast(`🎯 Objectif atteint : ${q[0].replace(/^\S+ /, '')} · ${Object.keys(q[3]).map(r => '+' + q[3][r] + ' ' + RICO(r)).join(' ')}`, 'ok'); this.buzz([20, 30, 20]); el.dataset.k = ''; return; }
    const show = (sim.phase === 'prep' || sim.phase === 'calm') && !this.sheet && this.mode === 'idle' && this.prefs.hints;
    el.classList.toggle('on', show); el.classList.toggle('mini', !!this.questHidden);
    const k = X.quest + ':' + !!this.questHidden; if (el.dataset.k === k) return; el.dataset.k = k;
    el.innerHTML = this.questHidden ? `<button data-q="hide">🎯 ${X.quest + 1}/${QUESTS.length}</button>` : `<span class="tn">🎯 ${X.quest + 1}/${QUESTS.length}</span><b>${q[0]}</b><small>${q[1]} · récompense ${Object.keys(q[3]).map(r => q[3][r] + ' ' + RICO(r)).join(' ')}</small><button class="x" data-q="hide">réduire</button>`;
  };
  // ——— tutoriel guidé ———
  const STEPS = [
    ['🏠 Bâtis une maison', 'Touche ⚒ Bâtir, puis Habitations : les maisons logent villageois et soldats.', s => s.build.items.some(b => b.type === 'house')],
    ['🪚 Construis une scierie', 'Dans ⚒ Bâtir › Économie : le bois sert à presque tout.', s => s.build.items.some(b => b.type === 'sawmill')],
    ['👥 Recrute des villageois', 'Touche 👥 Villageois › « + Villageois » : plus de bras, plus de ressources (une maison donne de la place).', s => s.eco.villagers.length >= 12],
    ['🎯 Bâtis un champ de tir', 'Les archers défendent la muraille d\'eux-mêmes dès qu\'ils sont formés.', s => s.build.items.some(b => b.type === 'range' && b.state === 'built')],
    ['🏹 Forme des archers', 'Touche le champ de tir et commande des archers.', s => s.army.archers.reduce((a, b) => a + b.n, 0) + s.army.reserve.archer >= 3],
    ['⚔ Prêt !', 'Touche « Lancer » quand tu veux, ou attends la horde. Bonne défense !', s => s.phase !== 'prep'],
  ];
  // (v8.0) le tutoriel montre du doigt le bouton à toucher : premier élément visible de la liste, du plus précis au plus général
  const TUTO_HI = [
    ['[data-a="pok"]', '[data-a="bld:house"]', '[data-a="nav:build:home"]', '[data-sheet=build]'],
    ['[data-a="pok"]', '[data-a="bld:sawmill"]', '[data-a="nav:build:res"]', '[data-a="nav:build:"]', '[data-sheet=build]'],
    ['[data-a="vil"]', '[data-sheet=folk]'],
    ['[data-a="pok"]', '[data-a="bld:range"]', '[data-a="nav:build:army"]', '[data-a="nav:build:"]', '[data-sheet=build]'],
    ['[data-a^="train:archer"]', '[data-a="nav:army:train"]', '[data-sheet=army]'],
    ['#b-skip'],
  ];
  P.tutoPoint = function () {
    document.querySelectorAll('.tutohi').forEach(e => e.classList.remove('tutohi'));
    if (this.tuto == null) return; const list = TUTO_HI[this.tuto]; if (!list) return;
    for (const sel of list) { const e = [...document.querySelectorAll(sel)].find(x => x.offsetParent !== null && !x.disabled); if (e) { e.classList.add('tutohi'); return; } }
  };
  P.startTuto = function () {
    if (store('castle-tuto') || this.hooks.resumed) return; this.tuto = 0;
    const el = document.createElement('div'); el.id = 'tuto'; document.getElementById('app').appendChild(el); el.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) this.act(b.dataset.a); });
  };
  P.tickTuto = function () {
    if (this.tuto == null) return; const el = $('#tuto'); if (!el) return; const st = STEPS[this.tuto];
    if (!st) { el.classList.remove('on'); this.tuto = null; store('castle-tuto', 1); this.tutoPoint(); return; }
    if (st[2](this.sim)) { this.tuto++; this.buzz(15); return; }
    const html = `<span class="tn">${this.tuto + 1}/${STEPS.length}</span><b>${st[0]}</b><small>${st[1]}</small><button class="x" data-a="x:tutox">Passer</button>`;
    this.tutoPoint();
    if (el.dataset.k !== String(this.tuto)) { el.dataset.k = this.tuto; el.innerHTML = html; } el.classList.toggle('on', this.sim.phase === 'prep' || this.sim.phase === 'calm');   /* caché pendant l'alerte et la vague : place au combat */
  };
  // ——— événements de la simulation (v4.0) ———
  P.extrasEvent = function (e) {
    const sim = this.sim;
    switch (e.type) {
      case 'recap': this.showRecap(e.recap); break;
      case 'victory': this.showVictory(e.mode); break;
      case 'waveStart': this.checkpoint(); { const w = WEATHER[sim.extras.weather]; if (sim.extras.weather !== 'clear') this.toast(`${w[0]} ${w[1]}`, 'info'); } if (waveSpecBoss(sim.wave)) this.toast('💀 Le Seigneur pourri mène la horde !', 'danger'); break;
      case 'palisadeDown': this.toast(`🪵 La palissade ${SECT[e.s]} est tombée`, 'danger'); break;
      case 'palisadeBurnt': this.toast(`🔥 La palissade ${SECT[e.s]} s'est consumée`, 'info'); break;
      case 'moat': this.toast(`🌊 ${EXTRA.moat.names[e.lv]} terminé (${SECT[e.s]})`, 'ok'); break;
      case 'palisade': this.toast(`🪵 Palissade dressée (${SECT[e.s]})`, 'ok'); break;
      case 'heroJoin': break;
      case 'heroLevel': this.toast(`⭐ ${e.name} passe niveau ${e.lv}`, 'ok'); break;
      case 'heroDead': this.toast(`✝ Le capitaine ${e.name} est tombé au combat`, 'danger'); break;
      case 'rally': this.toast(`📯 ${e.name} : « Pour le royaume ! »`, 'warn'); break;
      case 'medal': this.toast(`🎖 Une escouade devient « ${e.name} » (+10 %)`, 'ok'); break;
      case 'researched': this.toast(`🔬 ${EXTRA.tech[e.k].name} découverte !`, 'ok'); break;
      case 'refugees': this.toast(`🚶 ${e.n} réfugiés s'installent`, 'ok'); break;
      case 'refugeeTurned': this.toast('🧟 L\'un des réfugiés était mordu !', 'danger'); break;
      case 'villagerBitten': if (!this.lastVB || performance.now() - this.lastVB > 3000) { this.lastVB = performance.now(); this.toast('🧟 Un villageois a été mordu dans le village !', 'danger'); } break;
      case 'climber': if (!this.lastCl || performance.now() - this.lastCl > 5000) { this.lastCl = performance.now(); this.toast('🧗 Un grimpeur a passé la muraille', 'warn'); } break;
      case 'fireLoss': this.toast('🔥 Le bâtiment a brûlé : il perd un niveau', 'danger'); break;
      case 'fireOut2': this.toast('🪣 Incendie éteint', 'ok'); break;
      case 'kill7': this.unlock('boss'); this.toast('💀 Le Seigneur pourri est abattu ! +400 or, +200 fer, +200 pierre', 'ok'); break;
      case 'gameOver': if (sim.extras.mode.kind === 'survival') { const b = store('castle-survival') || []; b.push({ w: sim.wave, t: Date.now() }); b.sort((a, c) => c.w - a.w); store('castle-survival', b.slice(0, 10)); } break;
    }
  };
  const waveSpecBoss = w => w % EXTRA.bossEvery === 0;
}
