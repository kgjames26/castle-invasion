// Interface : projection de l'état de la simulation (aucune logique de jeu ici) + envoi de commandes.
// Trois vues prévues sur UNE seule simulation : COMBAT, VILLAGE (Phase 3), ARMÉE (Phase 4).
import { SECTORS, SECTOR_NAMES, SECTOR_SHORT, ARCHER_SLOTS, SOLDIER_SLOTS, CASTLE } from '../sim/constants.js';
import { PHASES, UNITS, TASKS, BUILDINGS, UPGRADES, RES, RES_INFO, ECON, waveSpec } from '../content/medieval.js';

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const fmt = n => Math.floor(n).toString();
const TASK_ORDER = ['wood', 'stone', 'iron', 'gold', 'food'];

export class UI {
  constructor(sim, hooks) {
    this.sim = sim; this.hooks = hooks; this.sel = -1; this.acc = 0; this.tab = 'combat'; this.sub = 'work'; this.html = ''; this.pressing = false;
    this.top = $('#top'); this.sectorsBar = $('#sectors'); this.panel = $('#panel'); this.nav = $('#nav');
    this.top.innerHTML = `
      <div class="res">${RES.map(r => `<span class="r" id="r-${r}">${RES_INFO[r].ico}<b>0</b></span>`).join('')}</div>
      <div class="wave"><div id="wave-title">Vague 1</div><div id="wave-phase" class="phase"></div></div>
      <div class="castle"><span>🏰</span><div class="bar"><i id="castle-bar"></i></div></div>
      <div class="ctl"><button id="b-skip" class="mini">▶ Lancer</button><button id="b-speed" class="mini">×1</button><button id="b-menu" class="mini">☰</button></div>`;
    this.nav.innerHTML = `<button data-tab="combat" class="on">⚔<span>Combat</span></button><button data-tab="village">🌾<span>Village</span></button>`;
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
    document.body.dataset.tab = t; this.hooks.onTab(t, prev); this.refresh(true);
  }
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
      case 'rec': sim.recruit(x); break;
      case 'ua': sim.assign(s, x, +y); break;
      case 'wall': sim.upgrade(s); break;
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
      c.querySelector('.cnt').textContent = `🏹${army.archers[s].n} ⚔${army.count(s, 'soldier')}` + (w.breaches(s) ? ` 💥${w.breaches(s)}` : '');
    }
    this.nav.querySelector('[data-tab=combat]').classList.toggle('alert', alert && this.tab !== 'combat');   // menace pendant qu'on est au village
    if (force || !this.pressing) this.renderPanel(force);
  }
  cost(c) { const E = this.sim.eco; return Object.keys(c).map(r => `<i class="${E.res[r] >= c[r] ? '' : 'no'}">${RES_INFO[r].ico}${c[r]}</i>`).join(' '); }
  btn(label, sub, a, off, cls = 'act') { return `<button class="${cls}" data-a="${a}"${off ? ' disabled' : ''}>${label}${sub ? `<small>${sub}</small>` : ''}</button>`; }
  renderPanel(force) {
    const html = this.tab === 'combat' ? this.combatHtml() : this.villageHtml();
    if (html === this.html && !force) return;
    if (html === this.html) return;
    const keep = this.panel.scrollTop; this.html = html; this.panel.innerHTML = html; this.panel.scrollTop = keep;
  }
  // ——— COMBAT ———
  combatHtml() {
    const sim = this.sim, w = sim.wall, army = sim.army, E = sim.eco, s = this.sel;
    const recruit = `<div class="row recruit">${['archer', 'soldier'].map(t => this.btn(`${t === 'archer' ? '🏹 Archer' : '⚔ Soldat'}`, `${this.cost(UNITS[t].cost)} · réserve ${army.reserve[t]}`, 'rec:' + t, !E.afford(UNITS[t].cost))).join('')}</div>`;
    if (s < 0) {
      const spec = waveSpec(sim.wave);
      return `<div class="hint"><b>Touche un secteur</b> de la muraille pour le gérer.<br>Prochaine vague : <b>${spec.n} zombies</b>${sim.targets.length ? ' — secteurs menacés : <b>' + sim.targets.map(i => SECTOR_SHORT[i]).join(', ') + '</b>' : ''}.</div>${recruit}`;
    }
    const hp = w.sectorHp(s), mx = w.sectorMax(s), br = w.breaches(s), uc = w.upgradeCost(s), crew = E.assign.repair;
    const step = (t, ico, nm, max) => {
      const n = t === 'archer' ? army.archers[s].n : army.count(s, 'soldier');
      return `<div class="row step"><span class="lab">${ico} ${nm}</span>${this.btn('−', '', `ua:${t}:-1`, n <= 0, 'sq')}<b class="val">${n}<small>/${max}</small></b>${this.btn('+', '', `ua:${t}:1`, army.reserve[t] <= 0 || n >= max, 'sq')}${this.btn('+5', '', `ua:${t}:5`, army.reserve[t] <= 0 || n >= max, 'sq wide')}</div>`;
    };
    return `<div class="ptitle">${SECTOR_NAMES[s]} <span class="lvl">Niv. ${w.level[s]}</span></div>
      <div class="hpline"><div class="bar big"><i style="width:${hp / mx * 100}%"></i></div><span>${Math.round(hp)} / ${Math.round(mx)} PV${br ? ` · 💥 ${br} brèche${br > 1 ? 's' : ''}` : ''}</span></div>
      ${step('archer', '🏹', 'Archers', ARCHER_SLOTS)}${step('soldier', '⚔', 'Soldats', SOLDIER_SLOTS)}
      <div class="row">${this.btn('⬆ Renforcer', uc ? `Niv. ${w.level[s] + 1} · ${this.cost(uc)}` : 'niveau max', 'wall', !uc || !E.afford(uc))}</div>
      <div class="hint small">🔧 ${crew ? `${crew} villageois réparent la muraille` : 'Aucun villageois à la réparation'} — règle-le dans l'onglet Village.</div>${recruit}`;
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
    const sim = this.sim, E = sim.eco, idle = E.idleCount(), pop = E.villagers.length, cap = E.popCap();
    let h = `<div class="pop"><span>👥 <b>${pop}</b>/${cap} · libres <b>${idle}</b></span>${this.btn('+ Villageois', this.cost(ECON.villagerCost), 'vil', pop >= cap || !E.afford(ECON.villagerCost), 'act slim')}</div>`;
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
    const E = this.sim.eco; let h = '';
    for (const id in BUILDINGS) {
      const B = BUILDINGS[id], lv = E.level[id], c = E.buildingCost(id);
      h += `<div class="card"><div class="ct"><b>${B.ico} ${B.name}</b> <span class="lvl">${lv ? 'Niv. ' + lv : 'à construire'}</span><small>${B.info}</small></div>${c ? this.btn(lv ? `Niv. ${lv + 1}` : 'Construire', this.cost(c), 'bld:' + id, !E.afford(c), 'act slim') : '<span class="max">max</span>'}</div>`;
    }
    return h;
  }
  techHtml() {
    const E = this.sim.eco; let h = '<div class="hint small">Les améliorations rendent les villageois plus rapides, plus chargés et plus efficaces — sans leur donner d\'ordre.</div>';
    for (const id in UPGRADES) {
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
