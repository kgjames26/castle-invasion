// Post-traitement (v3.6, qualité « Haute » seulement) : occlusion ambiante en espace écran (SSAO à demi-résolution, lissée) et halo
// lumineux (bloom) sur les parties très claires — feux, braseros, magie, surtout la nuit. Écrit à la main (pas de dépendance) :
// la scène est rendue dans une cible HDR avec sa profondeur, puis composée avec la tonalité filmique ACES et la conversion sRGB.
import * as THREE from 'three';

const VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`;

// SSAO : hémisphère orientée par la normale (reconstruite à partir de la profondeur), 12 échantillons, rotation aléatoire par pixel
const AO_FS = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tDepth; uniform mat4 uProj; uniform mat4 uProjInv; uniform vec2 uRes; uniform float uRadius; uniform vec3 uKernel[ 12 ];
float depthAt( vec2 uv ) { return texture2D( tDepth, uv ).x; }
vec3 viewPos( vec2 uv ) { float d = depthAt( uv ); vec4 c = vec4( uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 ); vec4 v = uProjInv * c; return v.xyz / v.w; }
float hash( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }
void main() {
  float d = depthAt( vUv ); if ( d >= 0.99999 ) { gl_FragColor = vec4( 1.0 ); return; }
  vec3 p = viewPos( vUv );
  vec2 px = 1.0 / uRes;
  vec3 px1 = viewPos( vUv + vec2( px.x, 0.0 ) ), py1 = viewPos( vUv + vec2( 0.0, px.y ) );
  vec3 n = normalize( cross( px1 - p, py1 - p ) );
  float a = hash( gl_FragCoord.xy ) * 6.2831853; vec3 rnd = vec3( cos( a ), sin( a ), 0.0 );
  vec3 t = normalize( rnd - n * dot( rnd, n ) ), b = cross( n, t ); mat3 tbn = mat3( t, b, n );
  float R = uRadius * clamp( -p.z / 60.0, 0.6, 3.0 ), occ = 0.0;
  for ( int i = 0; i < 12; i++ ) {
    vec3 s = p + tbn * uKernel[ i ] * R;
    vec4 o = uProj * vec4( s, 1.0 ); o.xy /= o.w; vec2 suv = o.xy * 0.5 + 0.5;
    if ( suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0 ) continue;
    float sz = viewPos( suv ).z;
    float range = smoothstep( 0.0, 1.0, R / abs( p.z - sz ) );
    occ += ( sz >= s.z + 0.04 * R ? 1.0 : 0.0 ) * range;
  }
  float ao = 1.0 - occ / 12.0;
  gl_FragColor = vec4( vec3( ao ), 1.0 );
}`;
// flou 3×3 pondéré (lisse le grain du SSAO) / flou gaussien séparable (halo)
const BLUR_FS = `
varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uDir; uniform vec2 uRes;
void main() {
  vec2 st = uDir / uRes; vec4 c = texture2D( tSrc, vUv ) * 0.227027;
  c += ( texture2D( tSrc, vUv + st * 1.384615 ) + texture2D( tSrc, vUv - st * 1.384615 ) ) * 0.316216;
  c += ( texture2D( tSrc, vUv + st * 3.230769 ) + texture2D( tSrc, vUv - st * 3.230769 ) ) * 0.070270;
  gl_FragColor = c;
}`;
const BRIGHT_FS = `
varying vec2 vUv; uniform sampler2D tSrc; uniform float uThreshold;
void main() { vec3 c = texture2D( tSrc, vUv ).rgb; float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); float k = smoothstep( uThreshold, uThreshold * 1.6, l ); gl_FragColor = vec4( c * k, 1.0 ); }`;
const COMP_FS = `
varying vec2 vUv; uniform sampler2D tColor; uniform sampler2D tAO; uniform sampler2D tBloom; uniform float uAO; uniform float uBloom; uniform float uExposure;
vec3 rrt( vec3 v ) { vec3 a = v * ( v + 0.0245786 ) - 0.000090537; vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081; return a / b; }
vec3 aces( vec3 c ) {   // même tonalité ACES que three.js (ACESFilmicToneMapping) : rendu identique avec ou sans post-traitement
  const mat3 I = mat3( vec3( 0.59719, 0.07600, 0.02840 ), vec3( 0.35458, 0.90834, 0.13383 ), vec3( 0.04823, 0.01566, 0.83777 ) );
  const mat3 O = mat3( vec3( 1.60475, -0.10208, -0.00327 ), vec3( -0.53108, 1.10813, -0.07276 ), vec3( -0.07367, -0.00605, 1.07602 ) );
  c /= 0.6; return clamp( O * rrt( I * c ), 0.0, 1.0 ); }
vec3 toSRGB( vec3 c ) { return mix( c * 12.92, 1.055 * pow( c, vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, c ) ); }
void main() {
  vec3 c = texture2D( tColor, vUv ).rgb;
  float ao = texture2D( tAO, vUv ).r; c *= mix( 1.0, ao, uAO );
  c += texture2D( tBloom, vUv ).rgb * uBloom;
  gl_FragColor = vec4( toSRGB( aces( c * uExposure ) ), 1.0 );
}`;

export class Post {
  constructor(renderer) {
    this.r = renderer; this.w = 1; this.h = 1;
    const rt = (w, h, o = {}) => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, ...o });
    this.scene = rt(1, 1, { depthBuffer: true, depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType) });
    this.ao = rt(1, 1, { type: THREE.UnsignedByteType }); this.ao2 = rt(1, 1, { type: THREE.UnsignedByteType });
    this.br = rt(1, 1); this.b1 = rt(1, 1); this.b2 = rt(1, 1);
    const kernel = []; let sd = 9; const rn = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 12; i++) { const v = new THREE.Vector3(rn() * 2 - 1, rn() * 2 - 1, rn() * 0.85 + 0.15).normalize(); const s = (i + 1) / 12; v.multiplyScalar(0.15 + 0.85 * s * s); kernel.push(v); }
    const mat = (fs, u) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms: u, depthTest: false, depthWrite: false });
    this.mAO = mat(AO_FS, { tDepth: { value: this.scene.depthTexture }, uProj: { value: new THREE.Matrix4() }, uProjInv: { value: new THREE.Matrix4() }, uRes: { value: new THREE.Vector2() }, uRadius: { value: 1.6 }, uKernel: { value: kernel } });
    this.mBlur = mat(BLUR_FS, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() }, uRes: { value: new THREE.Vector2() } });
    this.mBright = mat(BRIGHT_FS, { tSrc: { value: this.scene.texture }, uThreshold: { value: 0.9 } });
    this.mComp = mat(COMP_FS, { tColor: { value: this.scene.texture }, tAO: { value: this.ao.texture }, tBloom: { value: this.b2.texture }, uAO: { value: 0.75 }, uBloom: { value: 0.5 }, uExposure: { value: 1 } });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.qs = new THREE.Scene(); this.qs.add(this.quad); this.qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); this.quad.frustumCulled = false;
  }
  setSize(w, h) {
    w = Math.max(1, w | 0); h = Math.max(1, h | 0); if (w === this.w && h === this.h) return; this.w = w; this.h = h;
    this.scene.setSize(w, h); const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1), qw = Math.max(1, w >> 2), qh = Math.max(1, h >> 2);
    this.ao.setSize(hw, hh); this.ao2.setSize(hw, hh); this.br.setSize(qw, qh); this.b1.setSize(qw, qh); this.b2.setSize(qw, qh);
  }
  pass(m, target) { this.quad.material = m; this.r.setRenderTarget(target); this.r.render(this.qs, this.qc); }
  render(scene, camera, opts) {
    const r = this.r, sz = r.getDrawingBufferSize(this._v || (this._v = new THREE.Vector2())); this.setSize(sz.x, sz.y);
    const tm = r.toneMapping; r.toneMapping = THREE.NoToneMapping;
    r.setRenderTarget(this.scene); r.clear(); r.render(scene, camera);
    // occlusion ambiante (demi-résolution) puis lissage
    const A = this.mAO.uniforms; A.uProj.value.copy(camera.projectionMatrix); A.uProjInv.value.copy(camera.projectionMatrixInverse); A.uRes.value.set(this.w, this.h);
    this.pass(this.mAO, this.ao);
    const B = this.mBlur.uniforms; B.uRes.value.set(this.ao.width, this.ao.height);
    B.tSrc.value = this.ao.texture; B.uDir.value.set(1, 0); this.pass(this.mBlur, this.ao2);
    B.tSrc.value = this.ao2.texture; B.uDir.value.set(0, 1); this.pass(this.mBlur, this.ao);
    // halo : extraction des zones très claires (quart de résolution), deux flous séparables
    this.mBright.uniforms.uThreshold.value = opts.threshold; this.pass(this.mBright, this.br);
    B.uRes.value.set(this.b1.width, this.b1.height);
    B.tSrc.value = this.br.texture; B.uDir.value.set(1.3, 0); this.pass(this.mBlur, this.b1);
    B.tSrc.value = this.b1.texture; B.uDir.value.set(0, 1.3); this.pass(this.mBlur, this.b2);
    B.tSrc.value = this.b2.texture; B.uDir.value.set(2.6, 0); this.pass(this.mBlur, this.b1);
    B.tSrc.value = this.b1.texture; B.uDir.value.set(0, 2.6); this.pass(this.mBlur, this.b2);
    const C = this.mComp.uniforms; C.uAO.value = opts.ao; C.uBloom.value = opts.bloom; C.uExposure.value = opts.exposure;
    this.pass(this.mComp, null);
    r.toneMapping = tm;
  }
}
