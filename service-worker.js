// Service worker de nettoyage : l'ancien jeu (v2) mettait tout en cache pour le hors-ligne.
// Ce fichier remplace l'ancien au même emplacement : il vide les caches, se désinscrit et recharge les pages ouvertes
// pour que la nouvelle version du jeu soit chargée. Le nouveau jeu n'utilise pas de service worker (pour l'instant).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  try { for (const k of await caches.keys()) await caches.delete(k); } catch (_) {}
  try { await self.registration.unregister(); } catch (_) {}
  const cs = await self.clients.matchAll({ type: 'window' });
  for (const c of cs) { try { c.navigate(c.url); } catch (_) {} }
})()));
self.addEventListener('fetch', () => {});   // ne met rien en cache
