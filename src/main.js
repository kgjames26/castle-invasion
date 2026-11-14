import { Simulation } from './sim/simulation.js';
import { TICK } from './sim/constants.js';
import { save, load, clearSave } from './sim/save.js';
import { Renderer } from './render/Renderer.js';
import { loadKit } from './render/Kit.js';
import { loadCharacters } from './render/Characters.js';
import { CameraController } from './camera/CameraController.js';
import { UI } from './ui/UI.js';

// L'ancien jeu (v2) installait un service worker : on le retire pour ne jamais servir l'ancien code en cache.
if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
if (globalThis.caches) caches.keys().then(ks => ks.forEach(k => caches.delete(k))).catch(() => {});

const sim = new Simulation();
const resumed = load(sim);
const view = document.getElementById('view');
const rd = new Renderer(view, sim);
loadCharacters().then(c => rd.useCharacters(c)).catch(e => console.warn('Personnages indisponibles, géométrie provisoire conservée', e));
loadKit().then(k => rd.useKit(k)).catch(e => console.warn('Décor du kit indisponible, géométrie provisoire conservée', e));
let ui;
const cam = new CameraController(rd.camera, rd.renderer.domElement, (x, z) => ui.onMapTap(x, z));
const hooks = {
  rd, cam,
  newGame: () => { clearSave(); sim.newGame(); ui.sel = -1; ui.cancelPlace(); ui.closeCard(); ui.closeSheet(); ui.showOver(false); ui.refresh(true); save(sim); },
};
ui = new UI(sim, hooks);
cam.setView({ tx: 100, tz: 215, zoom: innerHeight > innerWidth ? 1.0 : 0.62 });   // vue de départ : la cour du château, pas le champ de bataille
function onResize() { const r = view.getBoundingClientRect(); rd.resize(Math.max(1, r.width), Math.max(1, r.height)); cam.fit(r.width, r.height); }
new ResizeObserver(onResize).observe(view); onResize();
document.addEventListener('visibilitychange', () => { if (document.hidden) save(sim); }); addEventListener('pagehide', () => save(sim));

let last = performance.now(), acc = 0, autosave = 0, wasOver = false, lastWave = sim.wave;
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  if (!document.hidden) {
    acc += dt * sim.speed;
    let steps = 0;
    while (acc >= TICK && steps < 8) { sim.tick(); acc -= TICK; steps++; autosave += TICK; }
    if (steps === 8) acc = 0;
    for (const e of sim.events.splice(0)) { ui.onEvent(e); if (e.type === 'waveEnd' || e.type === 'built') save(sim); if (e.type === 'gameOver') clearSave(); }
    if (autosave > 30) { autosave = 0; if (!sim.over) save(sim); }
    if (sim.over !== wasOver) { wasOver = sim.over; ui.showOver(sim.over); }
    cam.update(dt); ui.tick(dt);
    rd.render(sim.speed ? acc / TICK : 1, dt);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__castle = { sim, cam, rd, ui, resumed };   // pour le débogage et les tests
