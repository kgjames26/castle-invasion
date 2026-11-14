// Sol haute qualité (v2.8) : textures de DÉTAIL procédurales et répétées à l'échelle du mètre — herbe (brins), terre (grain, cailloux,
// fissures), pavés (galets jointoyés) — mélangées dans le shader selon une carte de répartition (R = terre, G = pavés, le reste = herbe).
// La carte de couleurs d'ensemble (peinte dans Renderer.buildGround) donne les teintes ; le détail apporte la matière vue de près.
import * as THREE from 'three';
import { patchNorthFog } from './fog.js';

const SZ = 512;
function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
// dessine une forme en la répétant de l'autre côté des bords : la texture se raccorde sans couture
function wrap(g, x, y, m, fn) { for (const dx of [0, -SZ, SZ]) for (const dy of [0, -SZ, SZ]) { if ((dx && Math.abs(x + dx - SZ / 2) > SZ / 2 + m) || (dy && Math.abs(y + dy - SZ / 2) > SZ / 2 + m)) continue; fn(x + dx, y + dy); } }
function canvas(base) { const cv = document.createElement('canvas'); cv.width = cv.height = SZ; const g = cv.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, SZ, SZ); return { cv, g }; }
function grain(g, amp, seed) { const img = g.getImageData(0, 0, SZ, SZ), d = img.data; let s = seed; for (let i = 0; i < d.length; i += 4) { s = (s * 1103515245 + 12345) & 0x7fffffff; const n = ((s >> 16) % (amp * 2 + 1)) - amp; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(img, 0, 0); }
function tex(cv) { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; }

// HERBE : touffes de brins fins de longueurs et d'inclinaisons variées, quelques brins secs, trèfles ; moyenne ≈ gris 50 %
function grassDetail() {
  const { cv, g } = canvas('#7a7a7a'), r = rng(11);
  for (let i = 0; i < 260; i++) { const x = r() * SZ, y = r() * SZ, rad = 10 + r() * 30, v = 100 + r() * 50 | 0; wrap(g, x, y, rad, (px, py) => { const gr = g.createRadialGradient(px, py, 0, px, py, rad); gr.addColorStop(0, `rgba(${v},${v},${v},.35)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`); g.fillStyle = gr; g.fillRect(px - rad, py - rad, rad * 2, rad * 2); }); }
  g.lineCap = 'round';
  for (let i = 0; i < 9000; i++) {
    const x = r() * SZ, y = r() * SZ, len = 7 + r() * 16, ang = -Math.PI / 2 + (r() - 0.5) * 1.1, bend = (r() - 0.5) * 6, v = r() < 0.08 ? 190 + r() * 40 : 70 + r() * 110, w = 0.8 + r() * 1.6;
    wrap(g, x, y, len, (px, py) => { g.strokeStyle = `rgb(${v | 0},${v | 0},${v | 0})`; g.lineWidth = w; g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px + Math.cos(ang) * len * 0.5 + bend, py + Math.sin(ang) * len * 0.5, px + Math.cos(ang) * len, py + Math.sin(ang) * len); g.stroke(); });
  }
  for (let i = 0; i < 70; i++) { const x = r() * SZ, y = r() * SZ; wrap(g, x, y, 6, (px, py) => { for (let k = 0; k < 3; k++) { g.fillStyle = 'rgb(150,150,150)'; g.beginPath(); g.arc(px + Math.cos(k * 2.1) * 2.5, py + Math.sin(k * 2.1) * 2.5, 2.4, 0, 7); g.fill(); } }); }   // trèfles
  grain(g, 10, 7); return tex(cv);
}
// TERRE : mottes, grain, petits cailloux ombrés, fissures sèches, empreintes
function dirtDetail() {
  const { cv, g } = canvas('#7f7f7f'), r = rng(23);
  for (let i = 0; i < 380; i++) { const x = r() * SZ, y = r() * SZ, rad = 6 + r() * 26, v = 95 + r() * 70 | 0; wrap(g, x, y, rad, (px, py) => { const gr = g.createRadialGradient(px, py, 0, px, py, rad); gr.addColorStop(0, `rgba(${v},${v},${v},.45)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`); g.fillStyle = gr; g.fillRect(px - rad, py - rad, rad * 2, rad * 2); }); }
  g.strokeStyle = 'rgba(55,55,55,.55)'; g.lineWidth = 1.1;
  for (let i = 0; i < 40; i++) { let x = r() * SZ, y = r() * SZ; const pts = [[x, y]]; for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 30; y += (r() - 0.5) * 30; pts.push([x, y]); } wrap(g, pts[0][0], pts[0][1], 100, (px, py) => { const ox = px - pts[0][0], oy = py - pts[0][1]; g.beginPath(); pts.forEach(([a, b], k) => k ? g.lineTo(a + ox, b + oy) : g.moveTo(a + ox, b + oy)); g.stroke(); }); }
  for (let i = 0; i < 900; i++) { const x = r() * SZ, y = r() * SZ, s = 1.5 + r() * 5, v = 120 + r() * 100 | 0; wrap(g, x, y, s * 2, (px, py) => { g.fillStyle = 'rgba(30,30,30,.45)'; g.beginPath(); g.ellipse(px + s * 0.35, py + s * 0.4, s, s * 0.75, 0, 0, 7); g.fill(); g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.ellipse(px, py, s, s * 0.75, r() * 3, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.ellipse(px - s * 0.3, py - s * 0.3, s * 0.4, s * 0.3, 0, 0, 7); g.fill(); }); }
  grain(g, 16, 13); return tex(cv);
}
// PAVÉS : galets arrondis en rangs décalés, joints sombres, usure claire au centre
function paveDetail() {
  const { cv, g } = canvas('#3d3d3d'), r = rng(37), rows = 8, ch = SZ / rows;
  for (let row = 0; row < rows; row++) {
    let x = (row % 2) * ch * 0.5 - ch * 0.5;
    while (x < SZ + ch) {
      const w = ch * (0.75 + r() * 0.5), y = row * ch, v = 115 + r() * 70 | 0, inset = 3;
      for (const dx of [0, -SZ, SZ]) {
        const px = x + dx; if (px > SZ + w || px + w < -w) continue;
        g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.roundRect(px + inset, y + inset, w - inset * 2, ch - inset * 2, 9); g.fill();
        const gr = g.createLinearGradient(px, y, px, y + ch); gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.28)'); g.fillStyle = gr; g.beginPath(); g.roundRect(px + inset, y + inset, w - inset * 2, ch - inset * 2, 9); g.fill();
      }
      x += w;
    }
  }
  grain(g, 14, 29); return tex(cv);
}

let cache = null;
export function groundDetails() { return cache || (cache = { grass: grassDetail(), dirt: dirtDetail(), pave: paveDetail() }); }

// matériau du sol : couleur d'ensemble × détail (herbe / terre / pavés selon la carte de répartition), deux échelles pour casser la répétition
export function groundMaterial(colorMap, splatMap, opts = {}) {
  const D = groundDetails(), m = new THREE.MeshLambertMaterial({ map: colorMap });
  const U = { uGrass: { value: D.grass }, uDirt: { value: D.dirt }, uPave: { value: D.pave }, uSplat: { value: splatMap }, uDetailK: { value: opts.strength ?? 1.0 } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vGW;').replace('#include <project_vertex>', '#include <project_vertex>\nvGW = ( modelMatrix * vec4( transformed, 1.0 ) ).xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vGW;\nuniform sampler2D uGrass, uDirt, uPave, uSplat;\nuniform float uDetailK;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec4 sp = texture2D( uSplat, vMapUv );
          float wd = sp.r, wp = sp.g, wg = max( 0.0, 1.0 - wd - wp );
          float g1 = texture2D( uGrass, vGW * 0.42 ).r, g2 = texture2D( uGrass, vGW * 0.113 + 0.37 ).r;
          float d1 = texture2D( uDirt, vGW * 0.3 ).r, d2 = texture2D( uDirt, vGW * 0.071 + 0.19 ).r;
          float p1 = texture2D( uPave, vGW * 0.28 ).r;
          float det = wg * mix( g1, g2, 0.35 ) + wd * mix( d1, d2, 0.3 ) + wp * p1;
          diffuseColor.rgb *= mix( 1.0, det * 2.05, uDetailK );
        }`);
    patchNorthFog(sh);
  };
  m.customProgramCacheKey = () => 'ground-detail-nfog';
  return m;
}
