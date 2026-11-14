import { RESOURCES, ALL_RES, RES_INFO, MAP, UNITS, SIEGE, CENTER } from '../data/Config.js';
import { costText, fmtTime } from '../utils/MathUtils.js';
import { FORMATIONS } from '../formations/FormationTypes.js';

const $ = id => document.getElementById(id);

// HUD : ressources (haut gauche), vague (haut centre), sélection + actions (bas gauche),
// mini-carte (bas centre), boutons Base / Pause / Vitesse (bas droite), muraille segmentée
export class HUD {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.t = 0;
    this.res = $('res');
    this.res.innerHTML = ALL_RES.map(r => `<div class="res-item" id="r-${r}" data-tip="${RES_INFO[r].name}"><span class="ic">${RES_INFO[r].icon}</span><span class="v">0</span></div>`).join('')
      + `<div class="res-item" id="r-pop" data-tip="Population (cultivateurs, ouvriers, troupes) / maximum"><span class="ic">👥</span><span class="v">0</span></div>`
      + `<div class="res-item" id="r-army" data-tip="Armée / logement militaire (Casernes, Champ de tir, Écuries, Dépôt)"><span class="ic">⚔️</span><span class="v">0</span></div>`;
    this.resEls = Object.fromEntries([...ALL_RES, 'pop', 'army'].map(r => [r, $('r-' + r).querySelector('.v')]));
    this.wall = $('wall-bar');
    this.wall.innerHTML = Array.from({ length: MAP.SEG_COUNT }, (_, i) => `<i class="${i === MAP.GATE_SEG ? 'gate' : ''}"></i>`).join('');
    this.wallEls = [...this.wall.children];
    this.sel = $('sel');
    this.selSig = '';
    this.sel.addEventListener('click', e => this.onSelClick(e));
    $('btn-pause').onclick = () => this.game.setPaused(!this.game.paused);
    $('btn-speed').onclick = () => this.game.setSpeed(this.game.speed >= 3 ? 1 : this.game.speed + 1);
    $('btn-early').onclick = () => this.game.waves.callEarly();
    $('btn-compass').onclick = () => this.game.cam.resetView();
    $('btn-siege').onclick = () => this.toggleReserve();
    $('btn-place-cancel').onclick = () => this.game.siege.cancelPlacement();
    this.reserve = $('reserve-menu');
    this.reserve.addEventListener('click', e => {
      const b = e.target.closest('[data-i]');
      if (!b) return;
      const i = +b.dataset.i;
      const type = this.game.production.reserve[i];
      this.reserve.classList.add('hidden');
      if (type) this.game.siege.startPlacement('siege', type, i);
    });
  }

  toggleReserve() {
    const r = this.reserve, g = this.game;
    if (!r.classList.contains('hidden')) { r.classList.add('hidden'); return; }
    const list = g.production.reserve;
    r.innerHTML = `<div class="ttl">Réserve de siège (${g.siege.deployedCount()}/${g.siege.maxDeployed()} déployées)</div>`
      + (list.length ? list.map((t, i) => `<button data-i="${i}">${SIEGE[t].icon} Déployer : ${SIEGE[t].name}</button>`).join('') : '<div class="hint">Aucune arme en réserve. Construis-en à l\'atelier.</div>');
    r.classList.remove('hidden');
  }

  update(dt) {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.12;
    const g = this.game, R = g.resources;
    for (const r of ALL_RES) {
      const v = Math.floor(R.stock[r]);
      const el = this.resEls[r];
      const s = v >= 10000 ? (v / 1000).toFixed(1) + 'k' : String(v);
      if (el.textContent !== s) el.textContent = s;
      el.parentElement.classList.toggle('flash', (R.flashRes[r] || 0) > 0);
      el.parentElement.classList.toggle('low', r === 'food' && g.production.starving);
      el.parentElement.classList.toggle('full', v >= R.cap(r));
    }
    const pop = g.production.pop(), cap = g.production.popCap();
    this.resEls.pop.textContent = `${pop}/${cap}`;
    this.resEls.pop.parentElement.classList.toggle('low', pop >= cap);
    const ap = g.production.armyPop(), ac = g.production.armyCap();
    this.resEls.army.textContent = `${ap}/${ac}`;
    this.resEls.army.parentElement.classList.toggle('low', ap >= ac);

    // vague
    const W = g.waves;
    const label = $('wave-label'), bar = $('wave-bar').firstElementChild;
    if (W.state === 'prep') {
      label.innerHTML = `Vague ${W.wave} dans ${fmtTime(W.timer)}${W.siegeWarning ? ' <span class="warn">⚠ siège</span>' : ''}`;
      bar.style.width = `${(1 - W.timer / W.prepTotal) * 100}%`;
      $('wave-bar').classList.remove('red');
      $('btn-early').classList.remove('hidden');
    } else {
      const rem = W.remaining();
      label.textContent = `Vague ${W.wave} — ${rem} zombie${rem > 1 ? 's' : ''}`;
      bar.style.width = `${(rem / Math.max(1, W.total)) * 100}%`;
      $('wave-bar').classList.add('red');
      $('btn-early').classList.add('hidden');
    }
    // muraille
    g.wall.segments.forEach((s, i) => {
      const f = s.hp / s.maxHp, el = this.wallEls[i];
      el.style.background = s.broken ? '#3a1a14' : f > 0.6 ? 'var(--green)' : f > 0.3 ? '#d8a040' : '#d9534f';
      el.classList.toggle('hit', s.flash > 0);
    });
    $('castle-bar').firstElementChild.style.width = `${(g.castle.hp / g.castle.maxHp) * 100}%`;
    $('compass-n').style.transform = `rotate(${g.cam.yaw}rad)`;
    // réserve de siège
    const n = g.production.reserve.length;
    $('btn-siege').classList.toggle('hidden', n === 0 && g.siege.deployedCount() === 0);
    $('siege-badge').textContent = n;
    $('siege-badge').classList.toggle('hidden', n === 0);
    $('btn-pause').classList.toggle('on', g.paused);
    this.renderSelection();
  }

  // ---------- panneau de sélection ----------
  renderSelection() {
    const g = this.game, sel = g.selection;
    let html = '', hp = null;
    const s = sel.structure;
    if (s) {
      if (s.isWallSeg) {
        const seg = g.wall.segments[s.index];
        const cost = g.wall.repairCost(seg);
        const name = seg.gate ? 'Porte' : `Segment ${s.index + 1}`;
        hp = [seg.hp, seg.maxHp];
        html = `<div class="title">🧱 ${name}${seg.broken ? ' — <span style="color:#ff8a6a">détruit</span>' : ''}<button class="small x" data-act="clear">✕</button></div>
          <div class="hpline"><span data-hpv></span><div class="bar"><i data-hpb></i></div></div>
          <div class="btns">${seg.broken
            ? `<button data-act="repair" class="${g.resources.canAfford(cost) ? '' : 'disabled'}">🔨 Reconstruire ${costText(cost, RES_INFO)}</button>`
            : seg.hp < seg.maxHp ? `<button data-act="repair" class="${g.resources.canAfford(cost) ? '' : 'disabled'}">🔨 Réparer ${costText(cost, RES_INFO)}</button>` : '<span class="hint">Segment intact. Envoie des archers dessus !</span>'}</div>`;
      } else if (s.isCastle) {
        hp = [s.hp, s.maxHp];
        html = `<div class="title">🏰 Château<button class="small x" data-act="clear">✕</button></div>
          <div class="hpline"><span data-hpv></span><div class="bar"><i data-hpb></i></div></div>
          <div class="btns"><button data-act="base">⛏️ Entrer dans la base</button><button data-act="center" data-tip="Point de dépôt + bonus de récolte (+20 %) pour les cultivateurs proches. Derrière la muraille ou sur un gisement épuisé.">🏚️ Centre de récolte ${costText(CENTER.cost, RES_INFO)}</button></div>`;
      } else if (s.type === 'center') {
        hp = [s.hp, s.maxHp];
        html = `<div class="title">🏚️ Centre de récolte<button class="small x" data-act="clear">✕</button></div>
          <div class="hpline"><span data-hpv></span><div class="bar"><i data-hpb></i></div></div><div class="hint">Dépôt de ressources, +20 % de vitesse de récolte autour.</div>`;
      } else if (s.isNest) {
        hp = [s.hp, s.maxHp];
        html = `<div class="title">☠️ Nid de zombies<button class="small x" data-act="clear">✕</button></div>
          <div class="hpline"><span data-hpv></span><div class="bar red"><i data-hpb></i></div></div>
          <div class="hint">${s.alive ? 'Envoie un bélier (ou le trébuchet) pour le détruire : les vagues issues de ce nid seront affaiblies.' : 'Détruit — il repoussera dans ' + s.regrow + ' vague(s).'}</div>`;
      }
    } else if (sel.units.length) {
      const units = sel.units;
      const counts = {};
      for (const u of units) counts[u.type] = (counts[u.type] || 0) + 1;
      const chips = Object.entries(counts).map(([t, n]) => `<span class="chip">${(UNITS[t] || SIEGE[t]).icon} ${(UNITS[t] || SIEGE[t]).name}${n > 1 ? ' ×' + n : ''}</span>`).join('');
      hp = [units.reduce((a, u) => a + u.hp, 0), units.reduce((a, u) => a + u.maxHp, 0)];
      const mil = sel.military, cult = sel.cultivators, siege = sel.siege;
      const forms = new Set(units.map(u => u.formation).filter(Boolean));
      const fname = forms.size === 1 ? ` · ${FORMATIONS[[...forms][0].type].name}` : '';
      let btns = '';
      if (mil.length || siege.some(w => w.def.mobile)) btns += `<button data-act="move" class="${g.pending === 'move' ? 'on' : ''}" data-tip="Puis touche le sol (M)">🚶 Déplacer</button><button data-act="attack" class="${g.pending === 'attack' ? 'on' : ''}" data-tip="Attaque-déplacement : engage tout ennemi sur le chemin (T)">⚔️ Attaquer</button>`;
      if (mil.length >= 2) btns += `<button data-act="form" data-tip="Choisir une formation (G)">🛡️ Former</button>`;
      if (forms.size) btns += `<button data-act="dissolve" data-tip="Dissoudre la formation (X)">💨 Dissoudre</button>`;
      if (mil.length) btns += `<button data-act="stop">✋ Stop</button>`;
      if (cult.length) {
        const gt = cult.length === 1 ? cult[0].gatherType : null;
        btns += `<div class="btns" style="width:100%">` + RESOURCES.map(r => `<button data-act="gather:${r}" class="${gt === r ? 'on' : ''}" data-tip="Récolter : ${RES_INFO[r].name}">${RES_INFO[r].icon}</button>`).join('')
          + `<button data-act="gather:auto" class="${cult.length === 1 && !cult[0].gatherType ? 'on' : ''}" data-tip="Choix automatique selon les besoins">Auto</button></div>`;
      }
      if (siege.length === 1) {
        const w = siege[0];
        if (w.def.ammoAlt) btns += `<button data-act="ammo" class="${g.production.hasTech('metalAmmo') ? '' : 'disabled'}" data-tip="${g.production.hasTech('metalAmmo') ? 'Changer de munitions' : 'Recherche « Munitions en métal » requise'}">${w.ammoMode === 'metal' ? '⛓️ Métal' : '🪨 Pierre'}</button>`;
        btns += `<button data-act="undeploy" data-tip="Renvoyer l'arme en réserve pour la redéployer ailleurs">📦 Démonter</button>`;
        if (w.noAmmo) btns += `<span class="hint" style="color:#ff9a7a">Munitions épuisées !</span>`;
      }
      const tip = cult.length && !mil.length ? 'Touche un gisement pour y envoyer les cultivateurs.' : siege.length && !mil.length ? (siege[0].def.mobile ? 'Touche un nid de zombies pour l\'attaquer.' : `Portée ${siege[0].def.range} m · tir automatique`) : '';
      html = `<div class="title">${units.length > 1 ? units.length + ' sélectionnés' : (UNITS[units[0].type] || SIEGE[units[0].type]).name}${fname}<button class="small x" data-act="clear">✕</button></div>
        <div class="chips">${chips}</div>
        <div class="hpline"><span data-hpv></span><div class="bar"><i data-hpb></i></div></div>
        ${tip ? `<div class="hint">${tip}</div>` : ''}
        <div class="btns">${btns}</div>`;
    } else {
      const touch = g.sm.mobile;
      html = `<div class="hint">${touch ? 'Touche une unité. <b>Appui long + glisser</b> pour en sélectionner plusieurs. Touche la muraille ou le château pour les gérer.' : 'Clic : sélectionner · glisser : cadre · clic droit : ordre. Clique la muraille ou le château pour les gérer.'}</div>
        <div class="btns"><button data-act="boxmode" class="${g.input.boxMode ? 'on' : ''}" data-tip="Le prochain glissé dessine un cadre de sélection">▢ Cadre</button><button data-act="selall">⚔️ Toutes les troupes</button><button data-act="selcult">🧑‍🌾 Cultivateurs</button></div>`;
    }
    if (html !== this.selSig) { this.sel.innerHTML = html; this.selSig = html; }
    if (hp) {
      const v = this.sel.querySelector('[data-hpv]'), b = this.sel.querySelector('[data-hpb]');
      if (v) v.textContent = `${Math.ceil(hp[0])}/${hp[1]}`;
      if (b) b.style.width = `${Math.max(0, hp[0] / hp[1]) * 100}%`;
    }
  }

  onSelClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const g = this.game, sel = g.selection, a = b.dataset.act;
    g.audio.unlock();
    if (a === 'clear') sel.clear();
    else if (a === 'move' || a === 'attack') { g.pending = g.pending === a ? null : a; this.ui.setPending(g.pending); }
    else if (a === 'form') this.ui.openFormations();
    else if (a === 'dissolve') g.formations.dissolveUnits(sel.units);
    else if (a === 'stop') for (const u of sel.units) u.orderStop?.();
    else if (a.startsWith('gather:')) { const t = a.slice(7); for (const c of sel.cultivators) c.setGatherType(t === 'auto' ? null : t); }
    else if (a === 'ammo') { const w = sel.siege[0]; if (g.production.hasTech('metalAmmo')) w.ammoMode = w.ammoMode === 'metal' ? 'stone' : 'metal'; else g.ui.toast('Recherche « Munitions en métal » requise', 'warn'); }
    else if (a === 'undeploy') g.siege.undeploy(sel.siege[0]);
    else if (a === 'repair') g.wall.repair(g.wall.segments[sel.structure.index]);
    else if (a === 'base') this.ui.toggleUnderground(true);
    else if (a === 'center') { sel.clear(); g.siege.startPlacement('center'); }
    else if (a === 'boxmode') { g.input.boxMode = !g.input.boxMode; this.ui.setBoxMode(g.input.boxMode); }
    else if (a === 'selall') sel.set(g.units.filter(u => u.alive && u.type !== 'cultivator'));
    else if (a === 'selcult') sel.set(g.units.filter(u => u.alive && u.type === 'cultivator'));
    this.selSig = '';
    this.t = 0;
  }
}
