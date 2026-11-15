import { SEGS, SEGS_PER_SECTOR, SECTORS, GATE_SEGS } from './constants.js';
import { WALL } from '../content/medieval.js';
const GATE_FLAT = GATE_SEGS.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, k) => a + k));   // tous les tronçons de chaque porte

export class Wall {
  constructor() {
    this.hp = new Float32Array(SEGS);
    this.level = new Int8Array(SECTORS).fill(1);
    this.reset();
  }
  reset() { this.level.fill(1); for (let i = 0; i < SEGS; i++) this.hp[i] = this.segMax(i); }
  isGate(seg) { return GATE_FLAT.includes(seg); }
  sectorOf(seg) { return (seg / SEGS_PER_SECTOR) | 0; }
  segMax(seg) { return (this.isGate(seg) ? WALL.gateHp : WALL.segHp) * (1 + WALL.levelHpBonus * (this.level[this.sectorOf(seg)] - 1)); }
  sectorHp(s) { let t = 0; for (let k = 0; k < SEGS_PER_SECTOR; k++) t += this.hp[s * SEGS_PER_SECTOR + k]; return t; }
  sectorMax(s) { let t = 0; for (let k = 0; k < SEGS_PER_SECTOR; k++) t += this.segMax(s * SEGS_PER_SECTOR + k); return t; }
  breaches(s) { let n = 0; for (let k = 0; k < SEGS_PER_SECTOR; k++) if (this.hp[s * SEGS_PER_SECTOR + k] <= 0) n++; return n; }
  // renvoie true si le tronçon vient de tomber
  damage(seg, amount) {
    if (this.hp[seg] <= 0) return false;
    this.hp[seg] -= amount * (1 - WALL.levelDmgCut * (this.level[this.sectorOf(seg)] - 1));
    if (this.hp[seg] <= 0) { this.hp[seg] = 0; return true; }
    return false;
  }
  repairCost(s) { return Math.ceil((this.sectorMax(s) - this.sectorHp(s)) / WALL.repairHpPerStone); }
  // répare au maximum avec `stone` ; renvoie {spent, revived}
  repair(s, stone) {
    let budget = stone * WALL.repairHpPerStone, revived = false;
    const order = [];
    for (let k = 0; k < SEGS_PER_SECTOR; k++) order.push(s * SEGS_PER_SECTOR + k);
    order.sort((a, b) => (this.hp[a] / this.segMax(a)) - (this.hp[b] / this.segMax(b)));
    for (const seg of order) {
      const miss = this.segMax(seg) - this.hp[seg]; if (miss <= 0) continue;
      const add = Math.min(miss, budget); if (add <= 0) break;
      if (this.hp[seg] <= 0) revived = true;
      this.hp[seg] += add; budget -= add;
    }
    return { spent: Math.ceil((stone * WALL.repairHpPerStone - budget) / WALL.repairHpPerStone), revived };
  }
  upgradeCost(s) {
    if (this.level[s] >= WALL.maxLevel) return null;
    const c = {}; for (const r in WALL.upgradeBase) c[r] = WALL.upgradeBase[r] * this.level[s]; return c;
  }
  // soigne un tronçon ; renvoie true s'il vient d'être reconstruit (brèche refermée)
  heal(seg, hp) { const was = this.hp[seg] <= 0; this.hp[seg] = Math.min(this.segMax(seg), this.hp[seg] + hp); return was && this.hp[seg] > 0; }
  upgrade(s) {
    if (this.level[s] >= WALL.maxLevel) return false;
    const before = []; for (let k = 0; k < SEGS_PER_SECTOR; k++) { const seg = s * SEGS_PER_SECTOR + k; before.push(this.segMax(seg)); }
    this.level[s]++;
    for (let k = 0; k < SEGS_PER_SECTOR; k++) { const seg = s * SEGS_PER_SECTOR + k; if (this.hp[seg] > 0) this.hp[seg] *= this.segMax(seg) / before[k]; }
    return true;
  }
}
