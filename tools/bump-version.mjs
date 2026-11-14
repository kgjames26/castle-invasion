// Incrémente la version du jeu (v1.1 → v1.2…) dans src/version.js et dans la mention de index.html. Lancé par le hook git pre-commit.
import fs from 'node:fs';
const f = new URL('../src/version.js', import.meta.url), s = fs.readFileSync(f, 'utf8'), m = s.match(/VERSION = '(\d+)\.(\d+)'/);
const next = `${m[1]}.${+m[2] + 1}`; fs.writeFileSync(f, s.replace(m[0], `VERSION = '${next}'`)); console.log('version → v' + next);
