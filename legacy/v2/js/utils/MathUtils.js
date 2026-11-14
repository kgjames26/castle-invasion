export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
export const dist = (ax, az, bx, bz) => Math.sqrt(dist2(ax, az, bx, bz));

export function angleLerp(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// Générateur pseudo-aléatoire déterministe (mulberry32)
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = arr => arr[(Math.random() * arr.length) | 0];

export const GRAVITY = 20;

// Vitesse initiale pour un tir parabolique atteignant (dx, dy, dz) en un temps T
export function ballistic(dx, dy, dz, T, g = GRAVITY) {
  return { vx: dx / T, vy: (dy + 0.5 * g * T * T) / T, vz: dz / T };
}

// Points d'une trajectoire parabolique (aperçu de placement)
export function arcPoints(x0, y0, z0, x1, y1, z1, T, n = 32, g = GRAVITY) {
  const v = ballistic(x1 - x0, y1 - y0, z1 - z0, T, g);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = (T * i) / n;
    pts.push(x0 + v.vx * t, y0 + v.vy * t - 0.5 * g * t * t, z0 + v.vz * t);
  }
  return pts;
}

export function costText(cost, RES_INFO) {
  return Object.entries(cost || {}).filter(([, v]) => v > 0).map(([k, v]) => `${RES_INFO[k].icon}${v}`).join(' ');
}

export function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
}
