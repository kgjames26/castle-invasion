import { MAP, waveConfig, waveScaling, waveHasSiege } from '../data/Config.js';
import { Enemy } from '../entities/Enemy.js';
import { ObjectPool } from '../utils/ObjectPool.js';

const SPAWN_KEYS = { W: 0, C: 1, E: 2 };

// Vagues : configuration par vague, plusieurs points d'apparition, difficulté progressive
export class WaveSystem {
  constructor(game) {
    this.game = game;
    this.wave = 1;          // numéro de la prochaine vague (ou de la vague en cours)
    this.state = 'prep';    // 'prep' | 'active'
    this.timer = 60;
    this.prepTotal = 60;
    this.queue = [];
    this.clock = 0;
    this.spawned = 0;
    this.total = 0;
    this.nests = [];
    this.pool = new ObjectPool(() => new Enemy(game), null, 40);
  }

  config(n = this.wave) { return waveConfig(n); }

  startPrep(n, time) {
    this.wave = n;
    this.state = 'prep';
    const cfg = this.config(n);
    this.prepTotal = time ?? cfg.prep;
    this.timer = this.prepTotal;
    this.siegeWarning = waveHasSiege(cfg);
  }

  // « Lancer maintenant » : bonus d'or selon le temps restant
  callEarly() {
    if (this.state !== 'prep') return;
    const bonus = Math.floor(this.timer / 3);
    if (bonus > 0) { this.game.resources.add('gold', bonus); this.game.ui.toast(`Vague lancée en avance : +${bonus} 🪙`, 'ok'); }
    this.timer = 0;
  }

  startWave() {
    const n = this.wave, cfg = this.config(n);
    this.state = 'active';
    this.queue = [];
    this.clock = 0;
    const alive = this.nests.map(x => x.alive);
    for (const [type, count, sp, delay, interval] of cfg.groups) {
      for (let k = 0; k < count; k++) {
        let s = sp === '*' ? (k % 3) : SPAWN_KEYS[sp];
        if (!alive[s]) {
          // nid détruit : 40 % de ses créatures ne viennent pas, les autres passent par un autre nid
          if (Math.random() < 0.4) continue;
          const others = [0, 1, 2].filter(i => alive[i]);
          if (others.length) s = others[(Math.random() * others.length) | 0];
        }
        this.queue.push({ type, s, t: delay + k * interval + Math.random() * 0.3 });
      }
    }
    this.queue.sort((a, b) => b.t - a.t); // pile : le prochain à la fin
    this.total = this.queue.length;
    this.spawned = 0;
    this.scaling = waveScaling(n);
    this.game.ui.waveBanner(n, this.siegeWarning);
    this.game.audio?.horn();
  }

  spawn(type, s) {
    const p = MAP.SPAWNS[s];
    const x = p.x + (Math.random() - 0.5) * 12, z = p.z + (Math.random() - 0.5) * 3;
    const e = this.pool.get();
    e.reset(type, x, z, this.scaling);
    this.game.enemies.push(e);
    this.spawned++;
    this.game.fx.burst(x, 0.3, z, 5, 0x3a2a3a, 3, 0.7, 0.9);
  }

  remaining() { return this.queue.length + this.game.enemies.filter(e => e.alive).length; }

  update(dt) {
    if (this.state === 'prep') {
      this.timer -= dt;
      if (this.timer <= 0) this.startWave();
      return;
    }
    this.clock += dt;
    while (this.queue.length && this.queue[this.queue.length - 1].t <= this.clock) {
      const q = this.queue.pop();
      this.spawn(q.type, q.s);
    }
    if (!this.queue.length && !this.game.enemies.some(e => e.alive)) this.complete();
  }

  complete() {
    const g = this.game, n = this.wave;
    const reward = { gold: 30 + n * 12, stone: 20 + n * 5 };
    g.resources.addAll(reward);
    g.stats.wavesCleared = n;
    for (const nest of this.nests) nest.onWaveEnd();
    g.ui.toast(`🏆 Vague ${n} repoussée ! +${reward.gold} 🪙 +${reward.stone} 🪨`, 'ok');
    this.startPrep(n + 1);
    g.save.save('fin de vague');
  }

  release(e) { this.pool.release(e); }

  serialize() {
    return { wave: this.wave, nests: this.nests.map(n => ({ hp: n.hp, alive: n.alive, regrow: n.regrow })) };
  }
}
