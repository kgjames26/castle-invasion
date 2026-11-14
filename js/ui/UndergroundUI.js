import { ZONE_OF } from '../world/City.js';
import { BUILDINGS, UNITS, SIEGE, TECHS, RECIPES, RESOURCES, RES_INFO, CENTER } from '../data/Config.js';
import { costText, fmtTime } from '../utils/MathUtils.js';
import { FORMATIONS, formationLock } from '../formations/FormationTypes.js';

const $ = id => document.getElementById(id);
const C = c => costText(c, RES_INFO);

// Ville (carte secondaire) : production, caserne, écurie, atelier, laboratoire, forge, marché, défenses.
// Les bâtiments sont dans le décor 3D ; cette classe gère la barre du haut et la fiche du bâtiment choisi.
export class UndergroundUI {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.el = $('underground');
    this.grid = $('ug-grid');
    this.detail = $('ug-detail');
    this.current = null;
    this.sigGrid = ''; this.sigDetail = '';
    this.t = 0;
    $('ug-close').onclick = () => this.close();
    this.grid.addEventListener('click', e => {
      const b = e.target.closest('[data-b]');
      if (!b) return;
      this.select(b.dataset.b);
    });
    this.detail.addEventListener('click', e => this.onAction(e));
  }

  get isOpen() { return !this.el.classList.contains('hidden'); }
  open(bid) {
    this.game.setZone(bid ? ZONE_OF[bid] : 'army');
    if (bid) this.select(bid);
  }
  close() { this.game.setZone('combat'); }
  toggle() { if (this.isOpen) this.close(); else this.open(); }
  // appelé à chaque changement de zone : réinitialise la fiche et adapte le titre
  onZone(z) {
    this.current = null;
    this.detail.classList.add('hidden');
    this.game.city.select(null);
    $('ug-title').textContent = z === 'village' ? '🌾 Village' : '⚔️ Armée';
    this.render(true);
  }
  select(id) {
    this.current = id;
    this.detail.classList.remove('hidden');
    this.game.city.select(id);
    this.focusBuilding(id);
    this.render(true);
  }
  closePanel() {
    this.current = null;
    this.detail.classList.add('hidden');
    this.game.city.select(null);
    this.render(true);
  }
  // recentre la caméra pour que le bâtiment reste visible à côté (ou au-dessus) de la fiche
  focusBuilding(id) {
    const b = this.game.city.b[id], cam = this.game.cityCam;
    if (!b) return;
    const portrait = matchMedia('(orientation: portrait), (max-width: 720px)').matches;
    cam.goal.x = b.x + (portrait ? 0 : -cam.goal.dist * 0.2) * Math.cos(cam.goal.yaw);
    cam.goal.z = b.z + (portrait ? cam.goal.dist * 0.2 : 0) * Math.cos(cam.goal.yaw);
    cam.clampGoal();
  }

  update(dt) {
    if (!this.isOpen) return;
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.2;
    this.render(false);
  }

  render(force) {
    const g = this.game, P = g.production, R = g.resources;
    $('ug-res').innerHTML = RESOURCES.map(r => `<span>${RES_INFO[r].icon} ${Math.floor(R.stock[r])}</span>`).join('')
      + `<span>👥 ${P.pop()}/${P.popCap()}</span><span data-tip="Chaque ouvrier accélère production et améliorations">👷 ${P.workers} (+${Math.round((P.speedMul() - 1) * 100)} %)</span>`;
    const W = g.waves, wv = $('ug-wave');
    if (W.state === 'prep') { wv.textContent = `Vague ${W.wave} dans ${fmtTime(W.timer)}`; wv.classList.remove('alert'); }
    else { const rem = W.remaining(); wv.textContent = `⚠ Vague ${W.wave} en cours — ${rem} zombie${rem > 1 ? 's' : ''} · 🏰 ${Math.round(g.castle.hp / g.castle.maxHp * 100)} %`; wv.classList.add('alert'); }
    // grille des bâtiments
    const cards = Object.entries(BUILDINGS).filter(([id]) => ZONE_OF[id] === this.game.city.zone).map(([id, b]) => {
      const st = P.buildings[id];
      const q = P.queues[id]?.length || 0;
      const busy = st.upgrade ? '⏳' : (id === 'lab' && P.research ? '⚗️' : '');
      return `<button class="bcard ${this.current === id ? 'sel' : ''} ${st.level ? '' : 'locked'}" data-b="${id}">
        <span class="bi">${b.icon}</span><span class="bn">${b.name}</span><span class="bl">${st.level ? 'Niveau ' + st.level + '/' + b.max : 'À construire'}</span>
        ${q || busy ? `<span class="bq">${busy}${q ? ' ' + q : ''}</span>` : ''}
        ${st.upgrade ? `<div class="bar"><i data-p="up-${id}"></i></div>` : ''}</button>`;
    }).join('');
    if (force || cards !== this.sigGrid) { this.grid.innerHTML = cards; this.sigGrid = cards; }
    const html = this.current ? this.detailHTML(this.current) : '';
    if (force || html !== this.sigDetail) {
      const sc = this.detail.scrollTop;
      this.detail.innerHTML = html; this.sigDetail = html;
      this.detail.scrollTop = sc;
    }
    this.updateProgress();
  }

  updateProgress() {
    const P = this.game.production;
    const set = (key, f) => document.querySelectorAll(`[data-p="${key}"]`).forEach(el => { el.style.width = `${Math.min(100, f * 100)}%`; });
    for (const [id, b] of Object.entries(P.buildings)) if (b.upgrade) set('up-' + id, b.upgrade.t / b.upgrade.total);
    for (const [bid, q] of Object.entries(P.queues)) q.forEach((it, i) => set(`q-${bid}-${i}`, it.t / it.total));
    if (P.research) set('research', P.research.t / P.research.total);
  }

  btnState(err) { return err ? `class="disabled" data-tip="${err}"` : ''; }

  queueHTML(bid) {
    const P = this.game.production, q = P.queues[bid];
    if (!q || !q.length) return '<div class="desc">File vide.</div>';
    const name = it => it.kind === 'unit' ? UNITS[it.id].icon + ' ' + UNITS[it.id].name : it.kind === 'siege' ? SIEGE[it.id].icon + ' ' + SIEGE[it.id].name : '🔥 ' + RECIPES.find(r => r.id === it.id).name;
    return `<div class="queue">${q.map((it, i) => `<div class="qitem"><span>${name(it)}</span><div class="bar"><i data-p="q-${bid}-${i}"></i></div><button data-a="cancel:${bid}:${i}">Annuler</button></div>`).join('')}</div>`;
  }

  upgradeHTML(id) {
    const P = this.game.production, st = P.buildings[id], info = P.upgradeInfo(id);
    if (st.upgrade) return `<div class="upg">⏳ ${st.level ? 'Amélioration' : 'Construction'} en cours (${fmtTime((st.upgrade.total - st.upgrade.t) / P.speedMul())})<div class="bar"><i data-p="up-${id}"></i></div></div>`;
    if (info.max) return `<div class="upg">✅ Niveau maximum atteint</div>`;
    const err = P.canUpgrade(id);
    return `<div class="upg"><button data-a="up:${id}" ${this.btnState(err)}>${st.level ? `⬆️ Améliorer au niveau ${info.next}` : '🔨 Construire'} — ${C(info.cost)} · ${fmtTime(info.time)}</button>${err && !err.startsWith('Manque') ? `<span class="desc">${err}</span>` : ''}</div>`;
  }

  unitBtn(id) {
    const P = this.game.production, d = UNITS[id], err = P.canTrain(id);
    return `<button data-a="train:${id}" ${this.btnState(err)}><span class="pn">${d.icon} ${d.name}</span><span class="pc">${C(d.cost)} · ${d.time}s</span>${err ? `<span class="pe">${err}</span>` : ''}</button>`;
  }

  detailHTML(id) {
    const g = this.game, P = g.production, b = BUILDINGS[id], st = P.buildings[id];
    let h = `<h3>${b.icon} ${b.name} <small style="font-size:13px;color:var(--dim)">${st.level ? 'niveau ' + st.level : 'non construit'}</small><button class="small x" data-a="closepanel">✕</button></h3><div class="desc">${b.desc}</div>${this.upgradeHTML(id)}`;
    const built = st.level > 0;
    if (id === 'quarters') {
      h += `<div class="sect">Production</div><div class="prod">${this.unitBtn('cultivator')}${this.unitBtn('worker')}</div>${this.queueHTML('quarters')}`;
      h += `<div class="workers">👷 ${P.workers} ouvriers : production ×${P.speedMul().toFixed(2)} · Population max ${P.popCap()}</div>`;
      h += `<div class="sect">Récolte</div><div class="prod"><button data-a="center" ${this.btnState(g.resources.canAfford(CENTER.cost) ? null : 'Manque ' + g.resources.missing(CENTER.cost))}><span class="pn">🏚️ ${CENTER.name}</span><span class="pc">${C(CENTER.cost)}</span><span class="pc">Dépôt + 20 % de vitesse autour. À placer sur la carte, derrière la muraille ou sur un gisement épuisé.</span></button></div>`;
      const sites = g.resources.sites.length;
      if (sites) h += `<div class="desc">📍 ${sites} zone(s) constructible(s) libérée(s) par des gisements épuisés.</div>`;
    } else if (id === 'barracks') {
      if (built) h += `<div class="sect">Entraînement</div><div class="prod">${this.unitBtn('soldier')}${this.unitBtn('archer')}</div>${this.queueHTML('barracks')}`;
      h += `<div class="sect">Formations</div><div class="desc">${Object.entries(FORMATIONS).map(([fid, f]) => `${formationLock(g, fid) ? '🔒' : '✅'} ${f.name}`).join(' · ')}</div>`;
    } else if (id === 'stable') {
      if (built) h += `<div class="sect">Entraînement</div><div class="prod">${this.unitBtn('cavalry')}</div>${this.queueHTML('stable')}`;
    } else if (id === 'workshop') {
      if (built) {
        h += `<div class="sect">Armes de siège</div><div class="prod">${Object.entries(SIEGE).map(([sid, d]) => {
          const err = P.canBuildSiege(sid);
          return `<button data-a="siege:${sid}" ${this.btnState(err)}><span class="pn">${d.icon} ${d.name}</span><span class="pc">${C(d.cost)} · ${d.time}s</span><span class="pc">${d.desc}</span>${err ? `<span class="pe">${err}</span>` : ''}</button>`;
        }).join('')}</div>${this.queueHTML('workshop')}`;
        h += `<div class="sect">Réserve (${g.siege.deployedCount()}/${g.siege.maxDeployed()} déployées)</div>`;
        h += P.reserve.length ? `<div class="prod">${P.reserve.map((t, i) => `<button data-a="deploy:${i}"><span class="pn">${SIEGE[t].icon} Déployer ${SIEGE[t].name}</span><span class="pc">${SIEGE[t].zone === 'back' ? 'Derrière la muraille' : 'Devant la muraille'}</span></button>`).join('')}</div>` : '<div class="desc">Aucune arme en réserve.</div>';
      }
    } else if (id === 'lab') {
      if (built) {
        if (P.research) h += `<div class="upg">⚗️ ${TECHS[P.research.id].name}<div class="bar"><i data-p="research"></i></div></div>`;
        h += `<div class="sect">Recherches</div><div class="prod">${Object.entries(TECHS).map(([tid, t]) => {
          if (P.hasTech(tid)) return `<button class="done" disabled><span class="pn">✅ ${t.name}</span><span class="pc">${t.desc}</span></button>`;
          const err = P.canResearch(tid);
          return `<button data-a="tech:${tid}" ${this.btnState(err)}><span class="pn">${t.icon} ${t.name}</span><span class="pc">${C(t.cost)} · ${t.time}s</span><span class="pc">${t.desc}</span>${err && err !== 'Une recherche est déjà en cours' ? `<span class="pe">${err}</span>` : ''}</button>`;
        }).join('')}</div>`;
      }
    } else if (id === 'forge') {
      if (built) {
        h += `<div class="sect">Transformation</div><div class="prod">${RECIPES.map(r => {
          const err = P.canCraft(r);
          return `<button data-a="craft:${r.id}" ${this.btnState(err)}><span class="pn">🔥 ${r.name}</span><span class="pc">${C(r.in)} → ${C(r.out)} · ${r.time}s</span>${err ? `<span class="pe">${err}</span>` : ''}</button>`;
        }).join('')}</div>${this.queueHTML('forge')}`;
      }
    } else if (id === 'market') {
      if (built) {
        h += `<div class="sect">Échanges (taux ${Math.round(P.rate() * 100)} %)</div><div class="trade">${RESOURCES.filter(r => r !== 'gold').map(r => `
          <span>${RES_INFO[r].icon} ${RES_INFO[r].name}</span>
          <button data-a="sell:${r}" ${this.btnState(g.resources.stock[r] < 20 ? 'Pas assez' : null)}>Vendre 20 → +${P.tradePrice(r, 'sell')} 🪙</button>
          <button data-a="buy:${r}" ${this.btnState(g.resources.stock.gold < P.tradePrice(r, 'buy') ? 'Pas assez d\'or' : null)}>Acheter 20 ← ${P.tradePrice(r, 'buy')} 🪙</button>`).join('')}</div>`;
      }
    } else if (id === 'defenses') {
      const L = st.level;
      h += `<div class="desc">${L ? `Pièges actifs : ${7 * L} dégâts/s aux zombies au pied du château. PV du château +${20 * L} %.` : 'Aucune défense souterraine pour l\'instant.'}</div>`;
    }
    return h;
  }

  onAction(e) {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const g = this.game, P = g.production;
    const [a, x, y] = b.dataset.a.split(':');
    g.audio.click();
    if (a === 'closepanel') { this.closePanel(); return; }
    if (a === 'up') P.upgrade(x);
    else if (a === 'train') P.train(x);
    else if (a === 'siege') P.buildSiege(x);
    else if (a === 'tech') P.startResearch(x);
    else if (a === 'craft') P.craft(x);
    else if (a === 'sell' || a === 'buy') P.trade(x, a);
    else if (a === 'cancel') P.cancel(x, +y);
    else if (a === 'deploy') { const t = P.reserve[+x]; if (t) { this.close(); g.siege.startPlacement('siege', t, +x); } return; }
    else if (a === 'center') { if (g.resources.canAfford(CENTER.cost)) { this.close(); g.siege.startPlacement('center'); return; } g.ui.toast('Manque ' + g.resources.missing(CENTER.cost), 'warn'); }
    this.render(true);
  }
}
