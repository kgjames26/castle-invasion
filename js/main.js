import { Game } from './core/Game.js';
import { BaseUI } from './ui/BaseUI.js';

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
  document.getElementById('btn-new').onclick = async () => {
    if (has && !(await ui.confirm('Une partie sauvegardée existe. La remplacer ?'))) return;
    game.save.clear();
    game.audio.unlock();
    game.newGame();
  };
  document.getElementById('btn-continue').onclick = () => {
    game.audio.unlock();
    const d = game.save.peek();
    if (d) game.loadGame(d); else game.newGame();
  };
  // rendu du décor derrière le menu
  if (!game.loopStarted) { game.loopStarted = true; game.last = performance.now(); requestAnimationFrame(t => game.frame(t)); }
})();

// PWA : service worker (https ou localhost uniquement)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(err => console.warn('SW non enregistré', err));
  });
}
