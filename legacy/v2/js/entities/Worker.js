import { UNITS } from '../data/Config.js';

// Ouvrier : reste en sous-terrain. Il n'a pas de corps sur la carte ;
// chaque ouvrier accélère la production, les améliorations et la recherche.
export class Worker {
  static get def() { return UNITS.worker; }
  static speedBonus(count) { return Math.min(2.5, 1 + 0.06 * count); }
}
