// Interface : projection de l'état de la simulation (jamais de logique de jeu ici) + envoi de commandes.
import { SECTORS, SECTOR_NAMES, SECTOR_SHORT, ARCHER_SLOTS, SOLDIER_SLOTS, CASTLE } from '../sim/constants.js';
import { PHASES, UNITS, WALL, waveSpec } from '../content/medieval.js';

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const fmt = n => Math.floor(n).toString();

export class UI {
  constructor(sim, hooks) {
    this.sim = sim; this.hooks = hooks; this.sel = -1; this.acc = 0;
    this.top = $('#top'); this.sectorsBar = $('#sectors'); this.panel = $('#panel');
    this.top.innerHTML = `
      <div class="res"><span class="r" id="r-gold">🪙 <b>0</b></span><span class="r" id="r-stone">🪨 <b>0</b></span></div>
      <div class="wave"><div id="wave-title">Vague 1</div><div id="wave-phase" class="phase"></div></div>
      <div class="ctl"><button id="b-skip" class="mini" title="Lancer la vague">▶ Lancer</button><button id="b-speed" class="mini">×1</button><button id="b-menu" class="mini">☰</button></div>
      <div class="castle"><span>🏰</span><div class="bar"><i id="castle-bar"></i></div></div>`;
    this.chips = [];
    for (let s = 0; s < SECTORS; s++) {
      const c = el('button', 'chip', `<span class="nm">${SECTOR_SHORT[s]}</span><span class="full">${SECTOR_NAMES[s]}</span><span class="bar"><i></i></span><span class="cnt"></span>`);
      c.addEventListener('click', () => this.select(s, true)); this.sectorsBar.appendChild(c); this.chips.push(c);
    }
    $('#b-skip').addEventListener('click', () => sim.skipPrep());
    $('#b-speed').addEventListener('click', e => { sim.speed = sim.speed === 1 ? 2 : sim.speed === 2 ? 4 : sim.speed === 4 ? 0 : 1; e.target.textContent = sim.speed ? '×' + sim.speed : '⏸'; });
    $('#b-menu').addEventListener('click', () => { if (confirm('Commencer une nouvelle partie ? La partie en cours sera perdue.')) hooks.newGame(); });
    $('#over-btn').addEventListener('click', () => hooks.newGame());
    this.buildPanel(); this.refresh();
  }
  select(s, focus) {
    this.sel = s === this.sel && !focus ? -1 : s; this.hooks.onSelect(this.sel, focus && this.sel >= 0); this.refresh(true);
  }
  buildPanel() { this.panel.innerHTML = ''; this.panelKey = ''; }
  refresh(force) {
    const sim = this.sim, w = sim.wall, army = sim.army;
    $('#r-gold b').textContent = fmt(sim.res.gold); $('#r-stone b').textContent = fmt(sim.res.stone);
    $('#wave-title').textContent = `Vague ${sim.wave}` + (sim.phase === 'assault' ? ` · ${sim.zombies.n + (sim.spawn ? sim.spawn.left : 0)} 🧟` : '');
    $('#wave-phase').textContent = PHASES[sim.phase] + (sim.phase === 'assault' ? '' : ` · ${Math.ceil(sim.timer)} s`);
    $('#wave-phase').dataset.p = sim.phase; $('#b-skip').style.display = sim.phase === 'prep' ? '' : 'none';
    $('#castle-bar').style.width = (100 * sim.castleHp / CASTLE.hp) + '%';
    for (let s = 0; s < SECTORS; s++) {
      const c = this.chips[s], hp = w.sectorHp(s) / w.sectorMax(s), dg = sim.danger(s), tgt = sim.phase === 'alert' && sim.targets.includes(s);
      c.className = 'chip' + (s === this.sel ? ' sel' : '') + (dg === 2 ? ' d2' : dg === 1 ? ' d1' : '') + (tgt ? ' tgt' : '') + (w.breaches(s) ? ' breach' : '');
      c.querySelector('.bar i').style.width = (hp * 100) + '%';
      c.querySelector('.cnt').textContent = `🏹${army.archers[s].n} ⚔${army.count(s, 'soldier')}` + (w.breaches(s) ? ` 💥${w.breaches(s)}` : '');
    }
    this.renderPanel(force);
  }
  renderPanel(force) {
    const sim = this.sim, w = sim.wall, army = sim.army, s = this.sel, p = this.panel;
    const key = [s, sim.phase, army.reserve.archer, army.reserve.soldier, s >= 0 ? army.archers[s].n : 0, s >= 0 ? army.count(s, 'soldier') : 0, s >= 0 ? w.level[s] : 0, s >= 0 ? w.breaches(s) : 0, Math.floor(sim.res.gold / 10), Math.floor(sim.res.stone / 10), s >= 0 ? Math.round(w.sectorHp(s) / 20) : 0, sim.wave].join('|');
    if (!force && key === this.panelKey) return; this.panelKey = key;
    p.innerHTML = '';
    const recruit = el('div', 'row recruit');
    for (const [t, ico, nm] of [['archer', '🏹', 'Archer'], ['soldier', '⚔', 'Soldat']]) {
      const b = el('button', 'act', `${ico} Recruter ${nm}<small>${UNITS[t].cost} 🪙 · réserve ${army.reserve[t]}</small>`); b.disabled = sim.res.gold < UNITS[t].cost;
      b.addEventListener('click', () => { sim.recruit(t); this.refresh(true); }); recruit.appendChild(b);
    }
    if (s < 0) {
      const spec = waveSpec(sim.wave);
      p.appendChild(el('div', 'hint', `<b>Touche un secteur</b> de la muraille pour le gérer.<br>Prochaine vague : <b>${spec.n} zombies</b>${sim.targets.length ? ' — secteurs menacés : <b>' + sim.targets.map(i => SECTOR_SHORT[i]).join(', ') + '</b>' : ''}.`));
      p.appendChild(recruit); return;
    }
    const hp = w.sectorHp(s), mx = w.sectorMax(s), br = w.breaches(s);
    p.appendChild(el('div', 'ptitle', `${SECTOR_NAMES[s]} <span class="lvl">Niv. ${w.level[s]}</span>`));
    p.appendChild(el('div', 'hpline', `<div class="bar big"><i style="width:${hp / mx * 100}%"></i></div><span>${Math.round(hp)} / ${Math.round(mx)} PV${br ? ` · 💥 ${br} brèche${br > 1 ? 's' : ''}` : ''}</span>`));
    const stepper = (t, ico, nm, max) => {
      const row = el('div', 'row step'); row.appendChild(el('span', 'lab', `${ico} ${nm}`));
      const minus = el('button', 'sq', '−'), plus = el('button', 'sq', '+'); const n = t === 'archer' ? army.archers[s].n : army.count(s, 'soldier');
      minus.disabled = n <= 0; plus.disabled = army.reserve[t] <= 0 || n >= max;
      minus.addEventListener('click', () => { sim.assign(s, t, -1); this.refresh(true); }); plus.addEventListener('click', () => { sim.assign(s, t, 1); this.refresh(true); });
      row.append(minus, el('b', 'val', `${n}<small>/${max}</small>`), plus); const five = el('button', 'sq wide', '+5'); five.disabled = plus.disabled; five.addEventListener('click', () => { sim.assign(s, t, 5); this.refresh(true); }); row.appendChild(five); return row;
    };
    p.appendChild(stepper('archer', '🏹', 'Archers', ARCHER_SLOTS)); p.appendChild(stepper('soldier', '⚔', 'Soldats', SOLDIER_SLOTS));
    const acts = el('div', 'row');
    const rc = w.repairCost(s), rep = el('button', 'act', `🔧 Réparer<small>${rc > 0 ? rc + ' 🪨' : 'intact'}</small>`); rep.disabled = rc <= 0 || sim.res.stone < 1;
    rep.addEventListener('click', () => { sim.repair(s); this.refresh(true); });
    const uc = w.upgradeCost(s), up = el('button', 'act', `⬆ Renforcer<small>${isFinite(uc) ? `Niv. ${w.level[s] + 1} · ${uc} 🪨` : 'niveau max'}</small>`); up.disabled = !isFinite(uc) || sim.res.stone < uc;
    up.addEventListener('click', () => { sim.upgrade(s); this.refresh(true); });
    acts.append(rep, up); p.appendChild(acts); p.appendChild(recruit);
  }
  tick(dt) { this.acc += dt; if (this.acc > 0.15) { this.acc = 0; this.refresh(false); } }
  showOver(on) {
    $('#over').classList.toggle('on', on);
    if (on) $('#over-stats').textContent = `Vague ${this.sim.wave} · ${this.sim.zombies.kills} zombies abattus · ${this.sim.stats.breaches} brèche(s)`;
  }
}
