// Réglages visuels faciles à modifier : atmosphère, caméra, qualité. Aucune logique ici.
// Qualité : ?q=low|medium|high dans l'URL, ou ☰ Paramètres ; par défaut « low » sur écran tactile, « high » sinon.
export const ATMOS = {
  sunColor: 0xffe2b8, sunIntensity: 1.75, sunPos: [-70, 110, 60],          // soleil bas, chaud, venant du sud-ouest
  hemiSky: 0xcfdcf5, hemiGround: 0x5a4d3a, hemiIntensity: 1.25,            // ciel froid / sol chaud : ombres teintées, moins plat
  fogColor: 0x0a0f16, fogNear: 92, fogFar: 20,                             // brouillard du nord (z monde : clair à fogNear, opaque à fogFar)
  fogBreath: 6, fogBreathSpeed: 0.12,                                      // la brume « respire » lentement (mètres, rad/s)
  fogAssault: 14,                                                          // la brume avance de tant de mètres pendant un assaut
  shadowArea: { x: 100, z: 230, hw: 118, hd: 105 },                        // zone couverte par la carte d'ombres
  glowColor: 0xffb45a,                                                     // lueur des torches et des impacts
};
export const CAMERA = { pitchDeg: 40, fov: 60 };                           // vue plus rasante et plus ample : moins « maquette »
export const PRESETS = {
  low:    { shadows: false, shadowMap: 0,    glow: false, pixelRatio: 1,   particles: 0.5, grass: 0.35 },
  medium: { shadows: true,  shadowMap: 1024, glow: true,  pixelRatio: 1.5, particles: 0.8, grass: 0.7 },
  high:   { shadows: true,  shadowMap: 2048, glow: true,  pixelRatio: 2,   particles: 1, grass: 1 },
};
const KEY = 'castle-quality';
function initial() {
  try { const q = new URLSearchParams(location.search).get('q') || localStorage.getItem(KEY); if (PRESETS[q]) return q; } catch { /* sans stockage */ }
  try { return matchMedia('(pointer: coarse)').matches ? 'low' : 'high'; } catch { return 'medium'; }
}
export const quality = { name: initial(), ...PRESETS[initial()] };
// FORMAT de partie : choisi à la création d'une partie (proposé selon l'appareil), puis figé pour toute la partie.
export const FORMATS = { phone: { name: 'Téléphone', ico: '📱', q: 'low', info: 'léger : sans ombres ni lueurs, moins de particules' }, tablet: { name: 'Tablette', ico: '📟', q: 'medium', info: 'ombres et lueurs, effets modérés' }, desktop: { name: 'Ordinateur', ico: '🖥', q: 'high', info: 'tous les effets, ombres fines, herbe dense' } };
export function idealFormat() {
  try {
    const touch = matchMedia('(pointer: coarse)').matches, side = Math.min(screen.width, screen.height), weak = (navigator.deviceMemory || 8) <= 3 || (navigator.hardwareConcurrency || 8) <= 4;
    if (touch) return side < 600 || weak ? 'phone' : 'tablet';
    return weak ? 'tablet' : 'desktop';
  } catch { return 'tablet'; }
}
export function setQualityName(n) { if (!PRESETS[n]) return false; quality.name = n; Object.assign(quality, PRESETS[n]); try { localStorage.setItem(KEY, n); } catch { /* ignoré */ } return true; }
