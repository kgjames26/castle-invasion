// Service worker : mise en cache de tout le jeu pour jouer hors ligne
// (liste générée par scripts/generate-sw.mjs — relancer `npm run sw` après modification)
const CACHE = 'castle-invasion-18047030ac';
const FILES = [
  "./",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/models/archer.bin",
  "./assets/models/medieval.glb",
  "./assets/models/zombies.bin",
  "./css/style.css",
  "./index.html",
  "./js/core/Audio.js",
  "./js/core/CameraController.js",
  "./js/core/Game.js",
  "./js/core/InputManager.js",
  "./js/core/Instances.js",
  "./js/core/SaveManager.js",
  "./js/core/SceneManager.js",
  "./js/data/Config.js",
  "./js/entities/Cavalry.js",
  "./js/entities/Cultivator.js",
  "./js/entities/Enemy.js",
  "./js/entities/SiegeWeapon.js",
  "./js/entities/Soldier.js",
  "./js/entities/Unit.js",
  "./js/entities/Worker.js",
  "./js/formations/Formation.js",
  "./js/formations/FormationManager.js",
  "./js/formations/FormationTypes.js",
  "./js/main.js",
  "./js/systems/CombatSystem.js",
  "./js/systems/EffectsSystem.js",
  "./js/systems/PathfindingSystem.js",
  "./js/systems/ProductionSystem.js",
  "./js/systems/ResourceSystem.js",
  "./js/systems/SiegeSystem.js",
  "./js/systems/WaveSystem.js",
  "./js/ui/BaseUI.js",
  "./js/ui/FormationUI.js",
  "./js/ui/HUD.js",
  "./js/ui/Minimap.js",
  "./js/ui/Tooltip.js",
  "./js/ui/UndergroundUI.js",
  "./js/utils/Grid.js",
  "./js/utils/MathUtils.js",
  "./js/utils/ObjectPool.js",
  "./js/world/AnimModels.js",
  "./js/world/Building.js",
  "./js/world/City.js",
  "./js/world/Map.js",
  "./js/world/Models.js",
  "./js/world/ResourceNode.js",
  "./js/world/Wall.js",
  "./lib/addons/loaders/GLTFLoader.js",
  "./lib/addons/utils/BufferGeometryUtils.js",
  "./lib/three.module.min.js",
  "./manifest.json"
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// cache d'abord, réseau ensuite (et mise en cache des nouvelles ressources du même domaine)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
