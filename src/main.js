import { AudioManager } from './audio/Audio.js';
import { Simulation } from './sim/simulation.js';
import { TICK } from './sim/constants.js';
import { save, load, clearSave } from './sim/save.js';
import { Renderer } from './render/Renderer.js';
import { FORMATS, idealFormat } from './render/config.js';
import { loadKit } from './render/Kit.js';
import { loadWall } from './render/WallView.js';
import { loadCharacters } from './render/Characters.js';
import { loadItems, loadKnight } from './render/Heroes.js';
import { CameraController } from './camera/CameraController.js';
import { UI } from './ui/UI.js';
import { VERSION } from './version.js';

// L'ancien jeu (v2) installait un service worker : on le retire pour ne jamais servir l'ancien code en cache.
if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
if (globalThis.caches) caches.keys().then(ks => ks.forEach(k => caches.delete(k))).catch(() => {});

const sim = new Simulation();
const resumed = load(sim);
// format de la partie : figé dans la sauvegarde ; une partie neuve sans format prend celui qui convient à l'appareil
if (!sim.format) sim.format = idealFormat();
const view = document.getElementById('view');
const rd = new Renderer(view, sim);
loadCharacters().then(c => rd.useCharacters(c)).catch(e => console.warn('Personnages indisponibles, géométrie provisoire conservée', e));
loadItems().then(() => rd.useItems()).catch(e => console.warn('Objets indisponibles, formes simples conservées', e))
  .then(() => loadKnight()).then(() => rd.useKnight()).catch(e => console.warn('Chevalier GLB indisponible, modèle simple conservé', e));
loadKit().then(k => rd.useKit(k)).catch(e => console.warn('Décor du kit indisponible, géométrie provisoire conservée', e));
loadWall('assets/wall/dungeon_wall.glb').then(w => rd.useWall(w)).catch(e => console.warn('Muraille GLB indisponible, muraille provisoire conservée', e));
let ui;
function applyFormat() { if (!/[?&]q=/.test(location.search)) rd.setQuality(FORMATS[sim.format]?.q || 'medium', sim.gfx); }
applyFormat();
const cam = new CameraController(rd.camera, rd.renderer.domElement, (x, z) => ui.onMapTap(x, z));
const audio = new AudioManager();   // sons synthétisés (Web Audio) : lit l'état, ne le modifie pas
addEventListener('pointerdown', () => audio.unlock()); addEventListener('keydown', () => audio.unlock());
const hooks = {
  rd, cam, audio, resumed,
  setGfx: (fmt, over) => { if (fmt) { sim.format = fmt; sim.gfx = null; } if (over) sim.gfx = { ...(sim.gfx || {}), ...over }; applyFormat(); save(sim); },   // réglages graphiques en cours de partie
  newGame: (fmt) => { clearSave(); sim.newGame(); sim.format = fmt || idealFormat(); sim.gfx = null; applyFormat(); ui.sel = -1; ui.cancelPlace(); ui.closeCard(); ui.closeSheet(); ui.showOver(false); ui.refresh(true); save(sim); },
};
ui = new UI(sim, hooks);
{ const v = document.createElement('div'); v.className = 'vtag'; v.textContent = 'v' + VERSION; document.getElementById('app').appendChild(v); const sp = document.getElementById('splash'); document.getElementById('sp-v').textContent = 'v' + VERSION; setTimeout(() => sp.classList.add('off'), 1800); setTimeout(() => sp.remove(), 2700); }
cam.setView({ tx: 100, tz: innerHeight > innerWidth ? 262 : 278, zoom: innerHeight > innerWidth ? 0.7 : 0.42 });   // vue de départ : la cour du château, pas le champ de bataille
function onResize() { const r = view.getBoundingClientRect(); rd.resize(Math.max(1, r.width), Math.max(1, r.height)); cam.fit(r.width, r.height); }
new ResizeObserver(onResize).observe(view); onResize();
document.addEventListener('visibilitychange', () => { if (document.hidden) save(sim); }); addEventListener('pagehide', () => save(sim));

let last = performance.now(), acc = 0, autosave = 0, wasOver = false, lastWave = sim.wave;
// qualité adaptative : si l'appareil peine (moins de 24 images/s en moyenne sur 6 s), on baisse d'un cran (une fois par cran, jamais au-dessus du choix)
const perf = { t: 0, n: 0, warm: 4, done: true };   // v1.9 : le format est choisi à la création de la partie et ne change plus ensuite
function adapt(dt) {
  if (perf.done || document.hidden) return; perf.warm -= dt; if (perf.warm > 0) return;
  perf.t += dt; perf.n++; if (perf.t < 6) return;
  const fps = perf.n / perf.t; perf.t = 0; perf.n = 0;
  if (fps < 24) { const q = rd.qualityName(), down = q === 'high' ? 'medium' : q === 'medium' ? 'low' : null; if (down) { rd.setQuality(down); ui.toast(`⚙ Qualité réduite (${Math.round(fps)} img/s) — réglable dans ☰`, 'info'); perf.warm = 3; } else perf.done = true; }
  else perf.done = true;
}
if (/[?&]fps=1\b/.test(location.search)) { const f = document.createElement('div'); f.style.cssText = 'position:fixed;left:4px;bottom:22px;z-index:99;font:11px monospace;color:#fff;background:#0008;padding:2px 4px'; document.body.appendChild(f); let c = 0, t0 = performance.now(); (function tick() { c++; const n = performance.now(); if (n - t0 > 1000) { f.textContent = `${Math.round(c * 1000 / (n - t0))} img/s · ${rd.renderer.info.render.calls} appels · ${(rd.renderer.info.render.triangles / 1000).toFixed(0)}k tri`; c = 0; t0 = n; } requestAnimationFrame(tick); })(); }
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  if (!document.hidden) {
    acc += dt * sim.speed;
    let steps = 0;
    while (acc >= TICK && steps < 8) { sim.tick(); acc -= TICK; steps++; autosave += TICK; }
    if (steps === 8) acc = 0;
    for (const e of sim.events.splice(0)) { ui.onEvent(e); audio.onEvent(e); if (e.type === 'waveEnd' || e.type === 'built') save(sim); if (e.type === 'gameOver') clearSave(); }
    if (autosave > 30) { autosave = 0; if (!sim.over) save(sim); }
    if (sim.over !== wasOver) { wasOver = sim.over; ui.showOver(sim.over); }
    cam.update(dt); ui.tick(dt); adapt(dt);
    audio.frame(sim, dt);
    rd.render(sim.speed ? acc / TICK : 1, dt);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__castle = { sim, cam, rd, ui, resumed, audio };   // pour le débogage et les tests
