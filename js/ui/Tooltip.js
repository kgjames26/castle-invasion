// Infobulles : survol (souris) ou appui long (tactile) sur tout élément [data-tip]
export class Tooltip {
  constructor() {
    this.el = document.getElementById('tooltip');
    this.timer = null;
    document.addEventListener('pointerover', e => {
      if (e.pointerType !== 'mouse') return;
      const t = e.target.closest?.('[data-tip]');
      if (t) this.show(t); else this.hide();
    });
    document.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      const t = e.target.closest?.('[data-tip]');
      clearTimeout(this.timer);
      if (t) this.timer = setTimeout(() => this.show(t), 450);
    });
    document.addEventListener('pointerup', e => {
      clearTimeout(this.timer);
      if (e.pointerType !== 'mouse') setTimeout(() => this.hide(), 1400);
    });
  }
  show(t) {
    const txt = t.dataset.tip;
    if (!txt) return;
    this.el.textContent = txt;
    this.el.classList.add('show');
    const r = t.getBoundingClientRect(), w = this.el.offsetWidth, h = this.el.offsetHeight;
    let x = r.left + r.width / 2 - w / 2, y = r.top - h - 8;
    if (y < 4) y = r.bottom + 8;
    x = Math.max(4, Math.min(innerWidth - w - 4, x));
    this.el.style.left = x + 'px';
    this.el.style.top = y + 'px';
  }
  hide() { this.el.classList.remove('show'); }
}
