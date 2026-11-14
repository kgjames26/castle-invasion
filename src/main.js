import { Simulation } from './sim/simulation.js';
import { TICK, SECTOR_W, WALL_Z0 } from './sim/constants.js';
import { save, load, clearSave } from './sim/save.js';
import { Renderer } from './render/Renderer.js';
import { CameraController } from './camera/CameraController.js';
import { UI } from './ui/UI.js';

// L'ancien jeu (v2) installait un service worker : on le retire pour ne jamais servir l'ancien code en cache.
if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
if (globalThis.caches) caches.keys().then(ks => ks.forEach(k => caches.delete(k))).catch(() => {});

const sim = new Simulation();
const resumed = load(sim);
const view = document.getElementById('view');
const rd = new Renderer(view, sim);
let ui;
const cam = new CameraController(rd.camera, rd.renderer.domElement, (x, z) => {
  if (ui.tab === 'combat' && z > 78 && z < 165) ui.select(Math.min(4, Math.max(0, (x / SECTOR_W) | 0)), false);
});
const views = { combat: null, village: null };
const hooks = {
  onTab: (t, prev) => {
    views[prev] = cam.getView(); rd.setSelected(t === 'combat' ? ui.sel : -1);
    const portrait = innerHeight > innerWidth;
    cam.setView(views[t] || (t === 'village' ? { tx: 100, tz: 243, zoom: portrait ? 1.3 : 0.85 } : { tx: 100, tz: 125, zoom: 1 }));
  },
  onSelect: (s, focus) => { rd.setSelected(s); if (focus) cam.focusOn(s * SECTOR_W + SECTOR_W / 2, 120); },
  newGame: () => { clearSave(); sim.newGame(); ui.sel = -1; if (ui.tab !== 'combat') ui.setTab('combat'); rd.setSelected(-1); ui.showOver(false); ui.refresh(true); save(sim); },
};
ui = new UI(sim, hooks);
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
    for (const e of sim.events.splice(0)) { if (e.type === 'waveEnd') save(sim); if (e.type === 'gameOver') clearSave(); }
    if (autosave > 30) { autosave = 0; if (!sim.over) save(sim); }
    if (sim.over !== wasOver) { wasOver = sim.over; ui.showOver(sim.over); }
    cam.update(dt); ui.tick(dt);
    rd.render(sim.speed ? acc / TICK : 1, dt);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__castle = { sim, cam, rd, ui, resumed };   // pour le débogage et les tests
