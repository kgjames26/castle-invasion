import { HUD } from './HUD.js';
import { Minimap } from './Minimap.js';
import { Tooltip } from './Tooltip.js';
import { FormationUI } from './FormationUI.js';
import { UndergroundUI } from './UndergroundUI.js';

const $ = id => document.getElementById(id);

// Façade de l'interface : menus, messages, bannières + sous-interfaces (HUD, base, formations…)
export class BaseUI {
  constructor() {
    this.game = null;
    this.toastKeys = new Map();
    this.tooltip = new Tooltip();
  }

  attach() {
    this.hud = new HUD(this);
    this.minimap = new Minimap(this);
    this.formation = new FormationUI(this);
    this.underground = new UndergroundUI(this);
    const g = this.game;
    $('btn-resume').onclick = () => g.setPaused(false);
    $('btn-save').onclick = () => { g.save.save('manuel'); };
    $('btn-help2').onclick = () => $('help').classList.remove('hidden');
    $('help-close').onclick = () => $('help').classList.add('hidden');
    $('btn-help').onclick = () => $('help').classList.remove('hidden');
    $('btn-mute').onclick = () => { g.audio.setMuted(!g.audio.muted); this.syncMute(); };
    $('btn-quit').onclick = async () => { if (await this.confirm('Abandonner cette partie et recommencer ?')) { g.save.clear(); location.reload(); } };
    $('btn-restart').onclick = () => { g.save.clear(); location.reload(); };
    this.syncMute();
  }

  // remplace window.confirm (bloqué dans certains contextes intégrés)
  confirm(text) {
    return new Promise(res => {
      $('confirm-text').textContent = text;
      $('confirm').classList.remove('hidden');
      const done = v => { $('confirm').classList.add('hidden'); res(v); };
      $('confirm-yes').onclick = () => done(true);
      $('confirm-no').onclick = () => done(false);
    });
  }

  syncMute() { $('btn-mute').textContent = `Son : ${this.game.audio.muted ? 'coupé' : 'activé'}`; }

  loading(p) { const i = document.querySelector('#loading .bar i'); if (i) i.style.width = `${Math.round(p * 100)}%`; }

  showMenu(hasSave, info) {
    $('loading').classList.add('hidden');
    $('menu-buttons').classList.remove('hidden');
    if (hasSave) {
      $('btn-continue').classList.remove('hidden');
      $('btn-continue').textContent = `Continuer — vague ${info?.waves?.wave || 1}`;
    }
  }

  onStart() {
    $('menu').classList.add('hidden');
    $('hud').classList.remove('hidden');
    this.minimap.resize();
  }

  onResize() { this.minimap?.resize(); }

  update(dt) {
    if (!this.hud || !this.game.running) return;
    this.hud.update(dt);
    this.minimap.update(dt);
    this.underground.update(dt);
  }

  onPause(p, auto) {
    $('pause').classList.toggle('hidden', !p);
    $('pause-title').textContent = auto ? 'Partie en pause (arrière-plan)' : 'Pause';
  }
  onSpeed(s) { $('btn-speed').innerHTML = `${s === 1 ? '▶' : s === 2 ? '⏩' : '⏭'}<b>×${s}</b>`; }

  toggleUnderground(force) {
    if (force) this.underground.open(); else this.underground.toggle();
    this.game.siege.cancelPlacement();
  }
  openFormations() { this.formation.show(); }
  closeTop() {
    if (!$('help').classList.contains('hidden')) { $('help').classList.add('hidden'); return true; }
    if (this.formation.open) { this.formation.close(); return true; }
    if (!$('reserve-menu').classList.contains('hidden')) { $('reserve-menu').classList.add('hidden'); return true; }
    if (this.underground.isOpen) { this.underground.close(); return true; }
    if (this.game.paused) { this.game.setPaused(false); return true; }
    return false;
  }

  // ---------- messages ----------
  toast(msg, kind = 'info', key = null) {
    const now = performance.now();
    const k = key || msg;
    if (this.toastKeys.has(k) && now - this.toastKeys.get(k) < 3500) return;
    this.toastKeys.set(k, now);
    const box = $('toasts');
    while (box.children.length >= 4) box.firstElementChild.remove();
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => el.classList.add('out'), 3000);
    setTimeout(() => el.remove(), 3500);
  }
  clearToasts() { $('toasts').innerHTML = ''; this.toastKeys.clear(); }

  waveBanner(n, siege) {
    const b = $('banner');
    b.innerHTML = `Vague ${n}${siege ? '<small>⚠ Armes de siège ennemies</small>' : ''}`;
    b.classList.add('show');
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => b.classList.remove('show'), 2200);
  }

  placementBanner(text) {
    const b = $('place-banner');
    if (!text) { b.classList.add('hidden'); return; }
    b.firstElementChild.textContent = text + (this.game.sm.mobile ? ' — touche pour viser, re-touche pour valider' : ' — clic pour valider, clic droit pour annuler');
    b.classList.remove('hidden');
  }

  setPending(a) {
    const b = $('pending-banner');
    if (!a) { b.classList.add('hidden'); return; }
    b.textContent = a === 'move' ? '🚶 Touche le sol pour déplacer la sélection' : '⚔️ Touche un ennemi ou une zone à attaquer';
    b.classList.remove('hidden');
  }

  boxRect(r) {
    const el = $('box-rect');
    if (!r) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.style.left = Math.min(r.x0, r.x1) + 'px';
    el.style.top = Math.min(r.y0, r.y1) + 'px';
    el.style.width = Math.abs(r.x1 - r.x0) + 'px';
    el.style.height = Math.abs(r.y1 - r.y0) + 'px';
  }

  setBoxMode(on) {
    this.game.input.boxMode = on;
    if (this.hud) this.hud.selSig = '';
    if (on) this.toast('Glisse pour dessiner un cadre de sélection', 'info', 'boxmode');
  }

  saveBlink() {
    const d = $('save-dot');
    d.classList.add('blink');
    setTimeout(() => d.classList.remove('blink'), 900);
  }

  gameOver(wave, stats) {
    $('go-stats').innerHTML = `Tu as tenu jusqu'à la <b>vague ${wave}</b>.<br>Zombies abattus : ${stats.kills}<br>Ressources récoltées : ${Math.round(stats.gathered)}<br>Vagues repoussées : ${stats.wavesCleared}`;
    $('gameover').classList.remove('hidden');
  }
}
