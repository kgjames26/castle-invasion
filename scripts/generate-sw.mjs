// Régénère service-worker.js avec la liste de tous les fichiers du jeu (cache hors ligne).
// À lancer après chaque modification : npm run sw
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';

const root = new URL('..', import.meta.url).pathname;
const skip = new Set(['service-worker.js', 'README.md', 'vercel.json', 'package.json', 'package-lock.json']);
const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f), r = relative(root, p);
    if (r.startsWith('.') || r.startsWith('node_modules') || r.startsWith('scripts')) continue;
    if (statSync(p).isDirectory()) walk(p);
    else if (!skip.has(r) && !r.endsWith('.txt') && !r.endsWith('LICENSE')) files.push('./' + r.split(sep).join('/'));
  }
})(root);
files.sort();
const h = createHash('sha1');
for (const f of files) h.update(readFileSync(join(root, f)));
const ver = h.digest('hex').slice(0, 10);
const sw = `// Service worker : mise en cache de tout le jeu pour jouer hors ligne
// (liste générée par scripts/generate-sw.mjs — relancer \`npm run sw\` après modification)
const CACHE = 'castle-invasion-${ver}';
const FILES = ${JSON.stringify(['./', ...files], null, 2)};

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
`;
writeFileSync(join(root, 'service-worker.js'), sw);
console.log(`${files.length} fichiers, cache ${ver}`);
