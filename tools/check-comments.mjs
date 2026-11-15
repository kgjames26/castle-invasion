// Garde-fou : repère les lignes où un commentaire « // » est suivi de code qui aurait dû rester actif (accolades, instructions).
import fs from 'fs'; import path from 'path';
const files = []; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } })('src'); (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (p.endsWith('.mjs') || p.endsWith('.js')) files.push(p); } })('tools');
let bad = 0;
for (const f of files) fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
  const s = l.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '""'); const k = s.indexOf('//'); if (k < 0 || s.trim().startsWith('//') || /https?:$/.test(s.slice(0, k))) return;
  const c = s.slice(k + 2); if (/[;{}]\s*(if|for|const|let|return|this\.|[a-zA-Z_$]+\s*\(|\}|\{)/.test(c) || /\}\s*$/.test(c.trim()) && /[;)]\s*\}/.test(c) || /[a-zA-Z_$][\w$]*\.[\w$.]+\([^)]*\);\s*$/.test(c)) { console.log(`${f}:${i + 1}: ${l.trim().slice(0, 140)}`); bad++; }
});
console.log(bad ? `${bad} ligne(s) suspecte(s)` : 'aucun code avalé par un commentaire'); process.exit(bad ? 1 : 0);
