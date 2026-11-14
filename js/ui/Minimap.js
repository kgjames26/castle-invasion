import { MAP, RES_INFO } from '../data/Config.js';

// Mini-carte (nord en haut) : muraille, gisements, unités, ennemis, champ de vision
export class Minimap {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.canvas = document.getElementById('minimap');
    this.ctx = this.canvas.getContext('2d');
    this.t = 0;
    this.resize();
    const go = e => {
      const r = this.canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * MAP.SIZE - MAP.HALF;
      const z = ((e.clientY - r.top) / r.height) * MAP.SIZE - MAP.HALF;
      this.game.cam.focus(x, z);
    };
    this.canvas.addEventListener('pointerdown', e => { e.stopPropagation(); this.drag = true; go(e); this.canvas.setPointerCapture(e.pointerId); });
    this.canvas.addEventListener('pointermove', e => { if (this.drag) go(e); });
    this.canvas.addEventListener('pointerup', () => { this.drag = false; });
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(64, Math.round(r.width * dpr));
    this.canvas.height = Math.max(64, Math.round(r.height * dpr));
    this.bg = null;
  }

  m(x) { return ((x + MAP.HALF) / MAP.SIZE) * this.canvas.width; }
  n(z) { return ((z + MAP.HALF) / MAP.SIZE) * this.canvas.height; }

  drawBg() {
    const c = document.createElement('canvas');
    c.width = this.canvas.width; c.height = this.canvas.height;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, '#231c20'); g.addColorStop(0.5, '#2c2a24'); g.addColorStop(0.5, '#2e3a2a'); g.addColorStop(1, '#34402e');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    // route
    x.fillStyle = '#4a3e30';
    x.fillRect(this.m(-1.5), this.n(-48), this.m(1.5) - this.m(-1.5), this.n(26) - this.n(-48));
    // château
    const r = this.game.castle.rect;
    x.fillStyle = '#9a8f80';
    x.fillRect(this.m(r.x0), this.n(r.z0), this.m(r.x1) - this.m(r.x0), this.n(r.z1) - this.n(r.z0));
    x.fillStyle = '#c84a3a';
    x.fillRect(this.m(-2), this.n(r.z0 + 4), this.m(2) - this.m(-2), this.n(r.z0 + 10) - this.n(r.z0 + 4));
    this.bg = c;
  }

  update(dt) {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.2;
    const g = this.game, ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    if (!this.bg) this.drawBg();
    ctx.drawImage(this.bg, 0, 0);
    const s = W / 150;
    // gisements
    for (const n of g.resources.nodes) {
      if (!n.alive) continue;
      ctx.fillStyle = RES_INFO[n.type].color;
      ctx.fillRect(this.m(n.x) - 1.5 * s, this.n(n.z) - 1.5 * s, 3 * s, 3 * s);
    }
    // muraille
    const wh = Math.max(2, 3 * s);
    for (const seg of g.wall.segments) {
      const f = seg.hp / seg.maxHp;
      ctx.fillStyle = seg.broken ? '#5a1a10' : f > 0.6 ? '#d8d0c0' : f > 0.3 ? '#d8a040' : '#d9534f';
      ctx.fillRect(this.m(seg.x - 4) + 0.5, this.n(0) - wh / 2, this.m(seg.x + 4) - this.m(seg.x - 4) - 1, wh);
    }
    // nids
    for (const n of g.waves.nests) {
      ctx.fillStyle = n.alive ? '#a040e0' : '#3a2a3a';
      ctx.beginPath(); ctx.arc(this.m(n.x), this.n(n.z), 3.5 * s, 0, Math.PI * 2); ctx.fill();
    }
    for (const c of g.resources.centers) if (c.alive) { ctx.fillStyle = '#e3b866'; ctx.fillRect(this.m(c.x) - 2.5 * s, this.n(c.z) - 2.5 * s, 5 * s, 5 * s); }
    // unités
    for (const u of g.units) {
      if (!u.alive) continue;
      ctx.fillStyle = u.selected ? '#ffffff' : u.type === 'cultivator' ? '#9ad08a' : '#5aa0ff';
      ctx.fillRect(this.m(u.x) - 1.2 * s, this.n(u.z) - 1.2 * s, 2.4 * s, 2.4 * s);
    }
    for (const w of g.siege.weapons) if (w.alive) { ctx.fillStyle = '#ffd040'; ctx.fillRect(this.m(w.x) - 2 * s, this.n(w.z) - 2 * s, 4 * s, 4 * s); }
    ctx.fillStyle = '#ff3a2a';
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const big = e.type.startsWith('golem');
      ctx.fillRect(this.m(e.x) - (big ? 2 : 1.2) * s, this.n(e.z) - (big ? 2 : 1.2) * s, (big ? 4 : 2.4) * s, (big ? 4 : 2.4) * s);
    }
    // champ de vision
    const q = g.cam.viewQuad();
    ctx.strokeStyle = 'rgba(255,230,170,0.85)';
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    q.forEach((p, i) => { const x = this.m(Math.max(-90, Math.min(90, p.x))), y = this.n(Math.max(-90, Math.min(90, p.z))); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.closePath(); ctx.stroke();
    // nord
    ctx.fillStyle = '#f6d48d';
    ctx.font = `bold ${10 * s}px serif`;
    ctx.fillText('N', W / 2 - 3 * s, 10 * s);
  }
}
