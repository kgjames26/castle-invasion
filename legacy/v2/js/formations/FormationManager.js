import { Formation } from './Formation.js';
import { FORMATIONS, formationLock } from './FormationTypes.js';

// Création, dissolution et mise à jour des formations
export class FormationManager {
  constructor(game) {
    this.game = game;
    this.list = [];
  }

  eligible(units) { return units.filter(u => u.alive && u.isUnit && u.team === 'player' && u.type !== 'cultivator'); }

  canForm(units, type) {
    const el = this.eligible(units);
    if (el.length < 2) return 'Sélectionne au moins 2 troupes';
    const lock = formationLock(this.game, type);
    if (lock) return lock;
    if (FORMATIONS[type].cavalryOnly && el.some(u => u.type !== 'cavalry')) return 'Cavaliers uniquement';
    return null;
  }

  create(units, type) {
    const err = this.canForm(units, type);
    if (err) { this.game.ui.toast(err, 'warn'); return null; }
    const el = this.eligible(units);
    for (const u of el) { if (u.formation) this.removeUnit(u); u.leaveWall?.(); }
    const f = new Formation(this, type, el);
    this.list.push(f);
    this.game.ui.toast(`Formation ${FORMATIONS[type].name} (${el.length})`, 'ok');
    return f;
  }

  removeUnit(u) {
    const f = u.formation;
    if (!f) return;
    f.units = f.units.filter(x => x !== u);
    f.slotOf.delete(u);
    u.formation = null; u.slot = null;
    if (f.units.length < 2) this.dissolve(f);
    else if (u === f.leader) { f.origin = f.leaderOrigin(); f.computeSlots(); f.assign(); }
  }

  dissolve(f) {
    for (const u of f.units) {
      u.formation = null; u.slot = null;
      if (u.alive) { if (u.order?.type === 'move' && f.leader === u) u.order = null; u.anchor = { x: u.x, z: u.z }; }
    }
    f.units = [];
    this.list = this.list.filter(x => x !== f);
  }

  dissolveUnits(units) {
    const fs = new Set(units.map(u => u.formation).filter(Boolean));
    for (const f of fs) this.dissolve(f);
    if (fs.size) this.game.ui.toast('Formation dissoute', 'info');
  }

  update() { for (const f of this.list) f.update(); }
}
