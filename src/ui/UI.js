// Interface : projection de l'état de la simulation (aucune logique de jeu ici) + envoi de commandes.
// Trois vues prévues sur UNE seule simulation : COMBAT, VILLAGE (Phase 3), ARMÉE (Phase 4).
import { SECTORS, SECTOR_NAMES, SECTOR_SHORT, ARCHER_SLOTS, CASTLE } from '../sim/constants.js';
import { PHASES, UNITS, UNIT_ORDER, SIEGE, SIEGE_ORDER, SIEGE_RULES, FORMATIONS, SQUAD, TASKS, BUILDINGS, UPGRADES, RES, RES_INFO, ECON, waveSpec } from '../content/medieval.js';
import { TRAIN_BUILDINGS } from '../sim/army.js';

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const fmt = n => Math.floor(n).toString();
const TASK_ORDER = ['wood', 'stone', 'iron', 'gold', 'food'];

export class UI {
  constructor(sim, hooks) {
    this.sim = sim; this.hooks = hooks; this.sel = -1; this.acc = 0; this.tab = 'combat'; this.sub = 'work'; this.asub = 'squads'; this.siegeSec = 2; this.selSq = 0; this.targeting = false; this.html = ''; this.pressing = false;
    this.top = $('#top'); this.sectorsBar = $('#sectors'); this.panel = $('#panel'); this.nav = $('#nav');
    this.top.innerHTML = `
      <div class="res">${RES.map(r => `<span class="r" id="r-${r}">${RES_INFO[r].ico}<b>0</b></span>`).join('')}</div>
      <div class="wave"><div id="wave-title">Vague 1</div><div id="wave-phase" class="phase"></div></div>
      <div class="castle"><span>🏰</span><div class="bar"><i id="castle-bar"></i></div></div>
      <div class="ctl"><button id="b-skip" class="mini">▶ Lancer</button><button id="b-speed" class="mini">×1</button><button id="b-menu" class="mini">☰</button></div>`;
    this.nav.innerHTML = `<button data-tab="combat" class="on">⚔<span>Combat</span></button><button data-tab="army">🛡<span>Armée</span></button><button data-tab="village">🌾<span>Village</span></button>`;
    this.nav.addEventListener('click', e => { const b = e.target.closest('button'); if (b) this.setTab(b.dataset.tab); });
    this.chips = [];
    for (let s = 0; s < SECTORS; s++) {
      const c = el('button', 'chip', `<span class="nm">${SECTOR_SHORT[s]}</span><span class="full">${SECTOR_NAMES[s]}</span><span class="bar"><i></i></span><span class="cnt"></span>`);
      c.addEventListener('click', () => this.select(s, true)); this.sectorsBar.appendChild(c); this.chips.push(c);
    }
    $('#b-skip').addEventListener('click', () => sim.skipPrep());
    $('#b-speed').addEventListener('click', e => { sim.speed = sim.speed === 1 ? 2 : sim.speed === 2 ? 4 : sim.speed === 4 ? 0 : 1; e.target.textContent = sim.speed ? '×' + sim.speed : '⏸'; });
    $('#b-menu').addEventListener('click', () => { if (confirm('Commencer une nouvelle partie ? La partie en cours sera perdue.')) hooks.newGame(); });
    $('#over-btn').addEventListener('click', () => hooks.newGame());
    this.panel.addEventListener('pointerdown', () => { this.pressing = true; });
    addEventListener('pointerup', () => { setTimeout(() => { this.pressing = false; }, 60); });
    this.panel.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b && !b.disabled) { this.act(b.dataset.a); this.refresh(true); } });
    this.refresh(true);
  }
  setTab(t) {
    if (t === this.tab) return; const prev = this.tab; this.tab = t;
    for (const b of this.nav.querySelectorAll('button')) b.classList.toggle('on', b.dataset.tab === t);
    this.setTargeting(false); document.body.dataset.tab = t; this.hooks.onTab(t, prev); this.refresh(true);
  }
  setTargeting(on) { this.targeting = on; this.hooks.onTarget?.(on); }
  pickSquad(id) { this.selSq = id; this.hooks.onSquad?.(id); this.refresh(true); }
  select(s, focus) {
    if (this.tab !== 'combat') return;
    this.sel = s === this.sel && !focus ? -1 : s; this.hooks.onSelect(this.sel, focus && this.sel >= 0); this.refresh(true);
  }
  // ——— commandes issues des boutons du panneau (data-a="verbe:arg:arg") ———
  act(a) {
    const [v, x, y] = a.split(':'), sim = this.sim, s = this.sel;
    switch (v) {
      case 'sub': this.sub = x; break;
      case 'as': sim.assignVillagers(x, +y); break;
      case 'vil': sim.recruitVillager(); break;
      case 'bld': sim.upgradeBuilding(x); break;
      case 'upg': sim.buyUpgrade(x); break;
      case 'prio': sim.setRepairPriority(+x); break;
      case 'ua': sim.assignArchers(s, +y); break;
      case 'wall': sim.upgrade(s); break;
      case 'house': sim.buildHouse(); break;
      case 'sseg': this.siegeSec = +x; break;
      case 'sbuild': sim.buildSiege(x, this.siegeSec); break;
      case 'scancel': sim.cancelSiege(); break;
      case 'sdis': sim.dismantleSiege(+x); break;
      case 'train': sim.train(x, +y); break;
      case 'cancel': sim.cancelTrain(x); break;
      case 'asub': this.asub = x; break;
      case 'sq': this.pickSquad(+x); break;
      case 'newsq': { const q = sim.formSquad(x, UNITS[x].squad, 2); if (q) this.pickSquad(q.id); break; }
      case 'form': sim.squadForm(this.selSq, x); break;
      case 'stance': sim.squadStance(this.selSq, x); break;
      case 'gar': sim.squadGarrison(this.selSq, +x); this.setTargeting(false); break;
      case 'sqgo': sim.squadGarrison(+x, s); break;
      case 'sortie': this.setTargeting(!this.targeting); break;
      case 'reinf': sim.squadReinforce(this.selSq); break;
      case 'disb': sim.squadDisband(this.selSq); this.selSq = 0; this.hooks.onSquad?.(0); this.setTargeting(false); break;
    }
  }
  refresh(force) {
    const sim = this.sim, w = sim.wall, army = sim.army, E = sim.eco;
    for (const r of RES) { const e = $('#r-' + r); e.querySelector('b').textContent = fmt(E.res[r]); e.classList.toggle('full', E.res[r] >= E.cap(r) - 0.5); e.classList.toggle('low', r === 'food' && E.famine); }
    $('#wave-title').textContent = `Vague ${sim.wave}` + (sim.phase === 'assault' ? ` · ${sim.zombies.n + (sim.spawn ? sim.spawn.left : 0)} 🧟` : '');
    $('#wave-phase').textContent = PHASES[sim.phase] + (sim.phase === 'assault' ? '' : ` · ${Math.ceil(sim.timer)} s`);
    $('#wave-phase').dataset.p = sim.phase; $('#b-skip').style.display = sim.phase === 'prep' ? '' : 'none';
    $('#castle-bar').style.width = (100 * sim.castleHp / CASTLE.hp) + '%';
    let alert = false;
    for (let s = 0; s < SECTORS; s++) {
      const c = this.chips[s], hp = w.sectorHp(s) / w.sectorMax(s), dg = sim.danger(s), tgt = sim.phase === 'alert' && sim.targets.includes(s);
      if (dg === 2) alert = true;
      c.className = 'chip' + (s === this.sel ? ' sel' : '') + (dg === 2 ? ' d2' : dg === 1 ? ' d1' : '') + (tgt ? ' tgt' : '') + (w.breaches(s) ? ' breach' : '');
      c.querySelector('.bar i').style.width = (hp * 100) + '%';
      c.querySelector('.cnt').textContent = `🏹${army.archers[s].n} ⚔${army.meleeIn(s)}` + (w.breaches(s) ? ` 💥${w.breaches(s)}` : '');
    }
    this.nav.querySelector('[data-tab=combat]').classList.toggle('alert', alert && this.tab !== 'combat');   // menace pendant qu'on est au village
    if (force || !this.pressing) this.renderPanel(force);
  }
  cost(c) { const E = this.sim.eco; return Object.keys(c).map(r => `<i class="${E.res[r] >= c[r] ? '' : 'no'}">${RES_INFO[r].ico}${c[r]}</i>`).join(' '); }
  btn(label, sub, a, off, cls = 'act') { return `<button class="${cls}" data-a="${a}"${off ? ' disabled' : ''}>${label}${sub ? `<small>${sub}</small>` : ''}</button>`; }
  renderPanel(force) {
    const html = this.tab === 'combat' ? this.combatHtml() : this.tab === 'army' ? this.armyHtml() : this.villageHtml();
    if (html === this.html && !force) return;
    if (html === this.html) return;
    const keep = this.panel.scrollTop; this.html = html; this.panel.innerHTML = html; this.panel.scrollTop = keep;
  }
  // ——— COMBAT ———
  popLine() { const E = this.sim.eco; return `<div class="hint small">👥 Population <b>${E.population()}</b>/${E.popCap()} (villageois ${E.villagers.length} · armée ${this.sim.army.popUsed()})</div>`; }
  combatHtml() {
    const sim = this.sim, w = sim.wall, army = sim.army, E = sim.eco, s = this.sel;
    if (s < 0) {
      const spec = waveSpec(sim.wave);
      return `<div class="hint"><b>Touche un secteur</b> de la muraille pour le gérer.<br>Prochaine vague : <b>${spec.n} zombies</b>${sim.targets.length ? ' — secteurs menacés : <b>' + sim.targets.map(i => SECTOR_SHORT[i]).join(', ') + '</b>' : ''}.</div>
        <div class="hint small">Escouades, formations, sorties sur le champ de bataille et entraînement : onglet <b>🛡 Armée</b>.</div>${this.popLine()}`;
    }
    const hp = w.sectorHp(s), mx = w.sectorMax(s), br = w.breaches(s), uc = w.upgradeCost(s), crew = E.assign.repair, an = army.archers[s].n;
    const squadsHere = army.squads.filter(q => q.mode === 'garrison' && q.sector === s), others = army.squads.filter(q => !(q.mode === 'garrison' && q.sector === s));
    const sqRow = (q, go) => `<div class="row step"><span class="lab">${UNITS[q.type].ico} ${UNITS[q.type].name} ×${q.n}<small class="sub">${FORMATIONS[q.form].name} · ${q.mode === 'field' ? 'sur le terrain' : SECTOR_SHORT[q.sector]}</small></span>${go ? this.btn('→ ici', '', 'sqgo:' + q.id, false, 'act slim') : this.btn('Gérer', '', 'sq:' + q.id + '', false, 'act slim')}</div>`;
    return `<div class="ptitle">${SECTOR_NAMES[s]} <span class="lvl">Niv. ${w.level[s]}</span></div>
      <div class="hpline"><div class="bar big"><i style="width:${hp / mx * 100}%"></i></div><span>${Math.round(hp)} / ${Math.round(mx)} PV${br ? ` · 💥 ${br} brèche${br > 1 ? 's' : ''}` : ''}</span></div>
      <div class="row step"><span class="lab">🏹 Archers</span>${this.btn('−', '', 'ua:archer:-1', an <= 0, 'sq')}<b class="val">${an}<small>/${ARCHER_SLOTS}</small></b>${this.btn('+', '', 'ua:archer:1', army.reserve.archer <= 0 || an >= ARCHER_SLOTS, 'sq')}${this.btn('+5', '', 'ua:archer:5', army.reserve.archer <= 0 || an >= ARCHER_SLOTS, 'sq wide')}</div>
      <div class="hint small">Archers en réserve : <b>${army.reserve.archer}</b> — entraîne-en dans l'onglet Armée.</div>
      ${squadsHere.map(q => sqRow(q, false)).join('') || '<div class="hint small">Aucune escouade en garnison ici.</div>'}
      ${others.length ? `<div class="hint small">Envoyer une escouade dans ce secteur :</div>${others.map(q => sqRow(q, true)).join('')}` : ''}
      ${sim.siege.weapons.some(x => x.sector === s) ? `<div class="hint small">🛠 Siège ici : ${sim.siege.weapons.filter(x => x.sector === s).map(x => SIEGE[x.type].ico).join(' ')} (portée au-delà du secteur)</div>` : ''}
      <div class="row">${this.btn('⬆ Renforcer', uc ? `Niv. ${w.level[s] + 1} · ${this.cost(uc)}` : 'niveau max', 'wall', !uc || !E.afford(uc))}</div>
      <div class="hint small">🔧 ${crew ? `${crew} villageois réparent la muraille` : 'Aucun villageois à la réparation'} — règle-le dans l'onglet Village.</div>`;
  }
  // ——— ARMÉE ———
  armyHtml() {
    const subs = [['squads', '🛡 Escouades'], ['train', '🪖 Entraîner'], ['siege', '🛠 Siège'], ['forge', '🔨 Forge']];
    let h = `<div class="subtabs">${subs.map(([k, n]) => `<button data-a="asub:${k}" class="${this.asub === k ? 'on' : ''}">${n}</button>`).join('')}</div>${this.popLine()}`;
    return h + (this.asub === 'squads' ? this.squadsHtml() : this.asub === 'train' ? this.trainHtml() : this.asub === 'siege' ? this.siegeHtml() : this.forgeHtml());
  }
  squadsHtml() {
    const army = this.sim.army, q = army.squads.find(x => x.id === this.selSq);
    let h = '';
    if (!army.squads.length) h += '<div class="hint">Aucune escouade. Forme-en une avec les soldats de ta réserve.</div>';
    h += `<div class="sqlist">${army.squads.map(x => `<button class="chipb ${x.id === this.selSq ? 'on' : ''}" data-a="sq:${x.id}">${UNITS[x.type].ico}${x.n} <small>${x.mode === 'field' ? '⚔' : SECTOR_SHORT[x.sector]}</small></button>`).join('')}</div>`;
    if (q) {
      const U = UNITS[q.type], mx = army.maxN(q.type), hp = q.hp / (q.n ? mx * U.hp : 1);
      h += `<div class="ptitle">${U.ico} ${U.name} ×${q.n}<span class="lvl">${q.mode === 'field' ? 'Sur le champ de bataille' : 'Garnison ' + SECTOR_SHORT[q.sector]}</span></div>
        <div class="hpline"><div class="bar big"><i style="width:${Math.min(100, q.hp / (mx * U.hp) * 100)}%"></i></div><span>${Math.round(q.hp)} PV · ${q.n}/${mx}</span></div>
        <div class="fgrid">${Object.keys(FORMATIONS).map(f => `<button class="fbtn ${q.form === f ? 'on' : ''}" data-a="form:${f}"><b>${FORMATIONS[f].ico}</b>${FORMATIONS[f].name}</button>`).join('')}</div>
        <div class="hint small">${FORMATIONS[q.form].info}</div>
        <div class="row">${this.btn(this.targeting ? '✖ Annuler' : '⚔ Sortir sur le terrain', this.targeting ? '' : 'puis touche la carte', 'sortie', false, this.targeting ? 'act warnb' : 'act')}${this.btn(q.stance === 'charge' ? '🔥 Charge' : '🛡 Tenir', 'posture', 'stance:' + (q.stance === 'charge' ? 'hold' : 'charge'), false)}</div>
        <div class="prio"><span>Garnison :</span>${SECTOR_SHORT.map((x, i) => `<button class="chipb ${q.mode === 'garrison' && q.sector === i ? 'on' : ''}" data-a="gar:${i}">${x}</button>`).join('')}</div>
        <div class="row">${this.btn('➕ Compléter', `réserve ${army.reserve[q.type]}`, 'reinf', q.n >= mx || army.reserve[q.type] <= 0)}${this.btn('Dissoudre', 'retour en réserve', 'disb', false)}</div>`;
      if (this.targeting) h += '<div class="warn">Touche le champ de bataille (zone orange) pour envoyer l\'escouade.</div>';
    }
    h += `<div class="hint small">Nouvelle escouade (depuis la réserve) :</div><div class="row recruit">${['soldier', 'heavy', 'cavalry'].map(t => this.btn(`${UNITS[t].ico} ${UNITS[t].name}`, `réserve ${army.reserve[t]} · max ${UNITS[t].squad}`, 'newsq:' + t, army.reserve[t] <= 0 || army.squads.length >= SQUAD.maxSquads)).join('')}</div>`;
    return h;
  }
  trainHtml() {
    const sim = this.sim, army = sim.army, E = sim.eco; let h = '';
    for (const b of TRAIN_BUILDINGS) {
      const B = BUILDINGS[b], lv = E.level[b], q = army.queues[b];
      h += `<div class="card col"><div class="ct"><b>${B.ico} ${B.name}</b> <span class="lvl">${lv ? 'Niv. ' + lv + ' · file ' + q.length + '/' + army.queueMax(sim, b) : 'à construire'}</span></div>`;
      if (!lv) { const c = E.buildingCost(b); h += `<div class="row">${this.btn('Construire', this.cost(c), 'bld:' + b, !E.afford(c))}</div></div>`; continue; }
      if (q.length) h += `<div class="queue">${q.map((it, i) => `<span class="qi">${UNITS[it.type].ico}${i === 0 ? `<i style="width:${100 * (1 - it.t / it.full)}%"></i>` : ''}</span>`).join('')}<button class="chipb" data-a="cancel:${b}">↩ annuler</button></div>`;
      h += `<div class="row wrapr">` + UNIT_ORDER.filter(t => UNITS[t].from === b).map(t => {
        const U = UNITS[t], ok = army.canTrain(sim, t);
        return this.btn(`${U.ico} ${U.name}`, ok ? `${this.cost(U.cost)} · ${army.trainTime(sim, b, t).toFixed(0)}s · 👥${U.pop}` : `Niv. ${U.minLevel} requis`, `train:${t}:1`, !ok || !E.afford(U.cost) || E.popRoom() < U.pop || q.length >= army.queueMax(sim, b)) + (ok ? this.btn('×5', '', `train:${t}:5`, !E.afford(U.cost) || E.popRoom() < U.pop * 2, 'sq wide') : '');
      }).join('') + '</div>';
      h += `<div class="hint small">Réserve : ${UNIT_ORDER.filter(t => UNITS[t].from === b).map(t => `${UNITS[t].ico}${army.reserve[t]}`).join(' ')}</div></div>`;
    }
    return h;
  }
  siegeHtml() {
    const sim = this.sim, S = sim.siege, E = sim.eco, lv = E.level.workshop, B = BUILDINGS.workshop;
    const wc = E.buildingCost('workshop');
    let h = `<div class="card"><div class="ct"><b>${B.ico} ${B.name}</b> <span class="lvl">${lv ? 'Niv. ' + lv + ' · armes ' + S.deployed() + '/' + S.cap(sim) : 'à construire'}</span><small>${B.info}</small></div>${wc ? this.btn(lv ? `Niv. ${lv + 1}` : 'Construire', this.cost(wc), 'bld:workshop', !E.afford(wc), 'act slim') : '<span class="max">max</span>'}</div>`;
    if (!lv) return h;
    h += `<div class="prio"><span>Secteur :</span>${SECTOR_SHORT.map((x, i) => `<button class="chipb ${this.siegeSec === i ? 'on' : ''}" data-a="sseg:${i}">${x} <small>${S.inSector(i)}/${SIEGE_RULES.slotsPerSector}</small></button>`).join('')}</div>`;
    for (const t of SIEGE_ORDER) {
      const D = SIEGE[t], locked = lv < D.level, off = locked || !S.canBuild(sim, t, this.siegeSec) || !E.afford(D.cost);
      h += `<div class="card"><div class="ct"><b>${D.ico} ${D.name}</b><small>${locked ? `Atelier niv. ${D.level} requis` : D.info}</small><small>${this.cost(D.cost)} · ${D.time}s · 👥${D.crew} · tir : ${this.cost(D.ammo)}</small></div>${this.btn('Poser', SECTOR_SHORT[this.siegeSec], 'sbuild:' + t, off, 'act slim')}</div>`;
    }
    if (S.queue.length) h += `<div class="queue">${S.queue.map((it, i) => `<span class="qi">${SIEGE[it.type].ico}${i === 0 ? `<i style="width:${100 * (1 - it.t / it.full)}%"></i>` : ''}</span>`).join('')}<button class="chipb" data-a="scancel">↩ annuler</button></div>`;
    if (S.weapons.some(w => w.noAmmo)) h += '<div class="warn">⚠ Munitions épuisées (pierre / fer) : une arme ne tire plus.</div>';
    for (const w of S.weapons) h += `<div class="row step"><span class="lab">${SIEGE[w.type].ico} ${SIEGE[w.type].name}<small class="sub">${SECTOR_SHORT[w.sector]}${w.noAmmo ? ' · sans munitions' : ''}</small></span>${this.btn('Démonter', '+ ½ ressources', 'sdis:' + w.id, false, 'act slim')}</div>`;
    return h;
  }
  forgeHtml() {
    const E = this.sim.eco; let h = '';
    const B = BUILDINGS.forge, lv = E.level.forge;
    if (!lv) { const c = E.buildingCost('forge'); return h + `<div class="card"><div class="ct"><b>${B.ico} ${B.name}</b> <span class="lvl">à construire</span><small>${B.info}</small></div>${this.btn('Construire', this.cost(c), 'bld:forge', !E.afford(c), 'act slim')}</div>`; }
    for (const id in UPGRADES) {
      const U = UPGRADES[id]; if (U.group !== 'army') continue;
      const l = E.up[id], c = E.upgradeCost(id);
      h += `<div class="card"><div class="ct"><b>${U.ico} ${U.name}</b> <span class="lvl">${l}/${U.max}</span><small>${U.info}</small></div>${c ? this.btn(`Niv. ${l + 1}`, this.cost(c), 'upg:' + id, !E.afford(c), 'act slim') : '<span class="max">max</span>'}</div>`;
    }
    return h;
  }
  // ——— VILLAGE ———
  villageHtml() {
    const sim = this.sim, E = sim.eco;
    const subs = [['work', '👷 Travail'], ['build', '🏗 Bâtiments'], ['tech', '🔬 Recherches']];
    let h = `<div class="subtabs">${subs.map(([k, n]) => `<button data-a="sub:${k}" class="${this.sub === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    if (this.sub === 'work') h += this.workHtml(); else if (this.sub === 'build') h += this.buildHtml(); else h += this.techHtml();
    return h;
  }
  workHtml() {
    const sim = this.sim, E = sim.eco, idle = E.idleCount(), pop = E.population(), cap = E.popCap();
    let h = `<div class="pop"><span>👥 <b>${pop}</b>/${cap} · villageois ${E.villagers.length} · libres <b>${idle}</b></span>${this.btn('+ Villageois', this.cost(ECON.villagerCost), 'vil', pop >= cap || !E.afford(ECON.villagerCost), 'act slim')}</div>`;
    h += `<div class="hint small">Stock max : ${fmt(E.cap('wood'))} · nourriture ${fmt(E.cap('food'))}. Les villageois rapportent <b>tout au château</b> : plus c'est loin, plus la route compte.</div>`;
    if (E.famine) h += `<div class="warn">⚠ Famine : la récolte est réduite de moitié. Ajoute des fermiers !</div>`;
    for (const t of TASK_ORDER) {
      const T = TASKS[t], n = E.assign[t], lv = E.level[T.building], capT = E.taskCap(t), B = BUILDINGS[T.building];
      let sub = `<i class="no">Construis : ${B.name}</i>`;
      if (lv > 0) { const left = T.deposit ? E.deposit[t] : null; sub = `+${E.rate[t].toFixed(2)}/s · places ${n}/${n + capT}` + (left !== null ? ` · gisement ${fmt(left)}` + (left <= 0 ? ' ⚠ épuisé' : '') : ''); }
      h += `<div class="row step task"><span class="lab">${T.ico} ${T.name}<small class="sub">${sub}</small></span>${this.btn('−', '', `as:${t}:-1`, n <= 0, 'sq')}<b class="val">${n}</b>${this.btn('+', '', `as:${t}:1`, idle <= 0 || n >= capT, 'sq')}</div>`;
    }
    const dmg = this.damagedSegs(), n = E.assign.repair;
    h += `<div class="row step task"><span class="lab">🔧 Réparation muraille<small class="sub">${dmg ? dmg + ' tronçon(s) à réparer' : 'muraille intacte'} · pierre</small></span>${this.btn('−', '', 'as:repair:-1', n <= 0, 'sq')}<b class="val">${n}</b>${this.btn('+', '', 'as:repair:1', idle <= 0 || n >= TASKS.repair.slots, 'sq')}</div>`;
    h += `<div class="prio"><span>Priorité :</span>${[['-1', 'Auto'], ...SECTOR_SHORT.map((x, i) => [String(i), x])].map(([v, l]) => `<button class="chipb ${E.repairPriority === +v ? 'on' : ''}" data-a="prio:${v}">${l}</button>`).join('')}</div>`;
    return h;
  }
  damagedSegs() { const w = this.sim.wall; let n = 0; for (let i = 0; i < 40; i++) if (w.hp[i] < w.segMax(i) - 0.5) n++; return n; }
  buildHtml() {
    const E = this.sim.eco, hc = E.houseCost(); let h = `<div class="card"><div class="ct"><b>🏠 Maisons</b> <span class="lvl">${E.houses}/${ECON.housesMax}</span><small>+${ECON.popPerHouse} places de population (villageois + armée) · ${E.population()}/${E.popCap()}</small></div>${this.btn('Construire', this.cost(hc), 'house', E.houses >= ECON.housesMax || !E.afford(hc), 'act slim')}</div>`;
    for (const id in BUILDINGS) {
      if (BUILDINGS[id].group === 'army') continue;
      const B = BUILDINGS[id], lv = E.level[id], c = E.buildingCost(id);
      h += `<div class="card"><div class="ct"><b>${B.ico} ${B.name}</b> <span class="lvl">${lv ? 'Niv. ' + lv : 'à construire'}</span><small>${B.info}</small></div>${c ? this.btn(lv ? `Niv. ${lv + 1}` : 'Construire', this.cost(c), 'bld:' + id, !E.afford(c), 'act slim') : '<span class="max">max</span>'}</div>`;
    }
    return h;
  }
  techHtml() {
    const E = this.sim.eco; let h = '<div class="hint small">Les améliorations rendent les villageois plus rapides, plus chargés et plus efficaces — sans leur donner d\'ordre.</div>';
    for (const id in UPGRADES) {
      if (UPGRADES[id].group === 'army') continue;
      const U = UPGRADES[id], lv = E.up[id], c = E.upgradeCost(id);
      h += `<div class="card"><div class="ct"><b>${U.ico} ${U.name}</b> <span class="lvl">${lv}/${U.max}</span><small>${U.info}</small></div>${c ? this.btn(`Niv. ${lv + 1}`, this.cost(c), 'upg:' + id, !E.afford(c), 'act slim') : '<span class="max">max</span>'}</div>`;
    }
    return h;
  }
  tick(dt) { this.acc += dt; if (this.acc > 0.2) { this.acc = 0; this.refresh(false); } }
  showOver(on) {
    $('#over').classList.toggle('on', on);
    if (on) $('#over-stats').textContent = `Vague ${this.sim.wave} · ${this.sim.zombies.kills} zombies abattus · ${this.sim.stats.breaches} brèche(s)`;
  }
}
