import { Game } from './core/Game.js';
import { BaseUI } from './ui/BaseUI.js';
import { MAP } from './data/Config.js';

// Format de la carte : portrait (smartphone) ou paysage (PC / tablette).
// Le monde est construit une seule fois : changer de format recharge la page.
const ls = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};
const isPhone = () => matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600;
const autoOrient = () => (isPhone() ? 'portrait' : 'landscape');
const prefOrient = () => { const f = ls.get('ci-format'); return f === 'portrait' || f === 'landscape' ? f : 'auto'; };
let forced = null;
try { forced = sessionStorage.getItem('ci-force'); sessionStorage.removeItem('ci-force'); } catch { /* ignore */ }
const startOrient = (forced === 'portrait' || forced === 'landscape') ? forced : (prefOrient() === 'auto' ? autoOrient() : prefOrient());
MAP.configure(startOrient);
const wantOrient = () => (prefOrient() === 'auto' ? autoOrient() : prefOrient());
const reloadWith = (orient, action) => {
  try { sessionStorage.setItem('ci-force', orient); sessionStorage.setItem('ci-autostart', action); } catch { /* ignore */ }
  location.reload();
};

// Point d'entrée : chargement, menu, PWA
const ui = new BaseUI();
const game = new Game(document.getElementById('game'), ui);
window.__game = game; // débogage

(async () => {
  try {
    await game.init(p => ui.loading(p));
  } catch (e) {
    console.error(e);
    document.querySelector('#loading small').textContent = 'Erreur de chargement : ' + e.message;
    return;
  }
  ui.attach();
  ui.loading(1);
  const has = game.save.has();
  ui.showMenu(has, game.save.peek());

  // choix du format
  const chips = [...document.querySelectorAll('#fmt .chip')];
  const hint = document.getElementById('fmt-hint');
  const refreshChips = () => {
    const p = prefOrient();
    chips.forEach(c => c.classList.toggle('sel', c.dataset.f === p));
    const w = wantOrient();
    hint.textContent = (p === 'auto' ? 'Détecté : ' : 'Choisi : ') + (w === 'portrait' ? 'portrait (carte étroite)' : 'paysage (carte large)');
  };
  chips.forEach(c => { c.onclick = () => { ls.set('ci-format', c.dataset.f); refreshChips(); }; });
  refreshChips();

  const start = async action => {
    if (action === 'new') {
      if (has && !(await ui.confirm('Une partie sauvegardée existe. La remplacer ?'))) return;
      if (wantOrient() !== MAP.orient) { game.save.clear(); reloadWith(wantOrient(), 'new'); return; }
      game.save.clear();
      game.audio.unlock();
      game.newGame();
    } else {
      const d = game.save.peek();
      if (d && d.orient && d.orient !== MAP.orient) { reloadWith(d.orient, 'continue'); return; }
      game.audio.unlock();
      if (d) game.loadGame(d); else game.newGame();
    }
  };
  document.getElementById('btn-new').onclick = () => start('new');
  document.getElementById('btn-continue').onclick = () => start('continue');
  // après un rechargement pour changer de format : on lance directement
  let auto = null;
  try { auto = sessionStorage.getItem('ci-autostart'); sessionStorage.removeItem('ci-autostart'); } catch { /* ignore */ }
  if (auto === 'new') { game.save.clear?.(); game.audio.unlock(); game.newGame(); }
  else if (auto === 'continue') { const d = game.save.peek(); game.audio.unlock(); if (d) game.loadGame(d); else game.newGame(); }
  // rendu du décor derrière le menu
  if (!game.loopStarted) { game.loopStarted = true; game.last = performance.now(); requestAnimationFrame(t => game.frame(t)); }
})();

// PWA : service worker (https ou localhost uniquement)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(err => console.warn('SW non enregistré', err));
  });
}
