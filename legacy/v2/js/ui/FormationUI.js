import { FORMATIONS, formationLock } from '../formations/FormationTypes.js';

// Choix de formation : menu radial (tactile) ou barre d'icônes (ordinateur)
export class FormationUI {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.el = document.getElementById('formation-menu');
    this.el.addEventListener('click', e => {
      const b = e.target.closest('[data-f]');
      if (!b) { if (e.target === this.el || e.target.classList.contains('center')) this.close(); return; }
      const id = b.dataset.f;
      const g = this.game;
      const err = g.formations.canForm(g.selection.units, id);
      if (err) { g.ui.toast(err, 'warn'); this.setTip(`${FORMATIONS[id].name} : ${err}`); return; }
      g.formations.create(g.selection.units, id);
      g.ui.hud.selSig = '';
      this.close();
    });
    this.el.addEventListener('pointerover', e => {
      const b = e.target.closest('[data-f]');
      if (b) this.setTip(`${FORMATIONS[b.dataset.f].name} — ${FORMATIONS[b.dataset.f].tip}`);
    });
  }
  get open() { return !this.el.classList.contains('hidden'); }

  show() {
    const g = this.game;
    const mil = g.selection.military;
    if (mil.length < 2) { g.ui.toast('Sélectionne au moins 2 troupes', 'warn'); return; }
    const ids = Object.keys(FORMATIONS);
    const allCav = mil.every(u => u.type === 'cavalry');
    const btn = id => {
      const f = FORMATIONS[id];
      const lock = formationLock(g, id) || (f.cavalryOnly && !allCav ? 'Cavaliers uniquement' : null);
      return `<button data-f="${id}" class="${lock ? 'locked' : ''}" data-tip="${f.tip}${lock ? ' — 🔒 ' + lock : ''}">${lock ? '🔒' : f.icon}<b>${f.name}</b></button>`;
    };
    const radial = g.sm.mobile || matchMedia('(pointer: coarse)').matches;
    if (radial) {
      const cx = innerWidth / 2, cy = innerHeight * 0.5;
      const R = Math.min(130, Math.min(innerWidth, innerHeight) * 0.32);
      const items = ids.map((id, i) => {
        const a = -Math.PI / 2 + (i / ids.length) * Math.PI * 2;
        return btn(id).replace('<button', `<button style="left:${Math.cos(a) * R}px;top:${Math.sin(a) * R}px"`);
      }).join('');
      this.el.innerHTML = `<div class="radial" style="left:${cx}px;top:${cy}px">${items}<button class="center">✕</button></div><div class="ftip">Choisis une formation pour ${mil.length} troupes</div>`;
    } else {
      this.el.innerHTML = `<div class="bar-menu panel">${ids.map(btn).join('')}</div><div class="ftip">Choisis une formation pour ${mil.length} troupes (Échap pour annuler)</div>`;
    }
    this.el.classList.remove('hidden');
  }
  setTip(t) { const e = this.el.querySelector('.ftip'); if (e) e.textContent = t; }
  close() { this.el.classList.add('hidden'); }
}
