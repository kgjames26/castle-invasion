// Pierre grise procédurale pour le château : appareil de moellons (lits de 0,9 m, blocs de 1,8 m décalés d'un lit sur deux),
// joints sombres et teintes variées. Projetée en coordonnées monde selon l'orientation de chaque face :
// les faces verticales reçoivent la pierre en (y, horizontal), les dessus (horizontaux) en (x, z). Sans texture image.
import * as THREE from 'three';
import { applyNorthFog, patchNorthFog } from './fog.js';

const GLSL_STONE = `
  float sHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
  float sTone( vec2 p ) {
    float row = floor( p.y / 0.9 );
    vec2 q = vec2( p.x / 1.8 + mod( row, 2.0 ) * 0.5, p.y / 0.9 );
    vec2 id = floor( q ), f = fract( q );
    float edge = min( min( f.x, 1.0 - f.x ) * 1.8, min( f.y, 1.0 - f.y ) * 0.9 );
    float joint = mix( 0.52, 1.0, smoothstep( 0.0, 0.07, edge ) );
    float v = sHash( id );
    float grain = ( sHash( floor( p * 14.0 ) ) - 0.5 ) * 0.07;
    return ( 0.78 + 0.22 * v + grain ) * joint;
  }
`;

export function stoneMaterial(color = 0xaeb2b8, colored = false) {
  const m = new THREE.MeshLambertMaterial({ color });
  m.onBeforeCompile = sh => {
    patchNorthFog(sh);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSWP;\nvarying vec3 vSWN;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vSWP = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
        vSWN = normalize( mat3( modelMatrix ) * objectNormal );`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vSWP;\nvarying vec3 vSWN;\n${GLSL_STONE}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        { vec3 wn = pow( abs( normalize( vSWN ) ), vec3( 6.0 ) ); wn /= ( wn.x + wn.y + wn.z );
          float tone = sTone( vSWP.zy ) * wn.x + sTone( vSWP.xz ) * wn.y + sTone( vSWP.xy ) * wn.z;
          diffuseColor.rgb *= tone;
          ${colored ? `
          // coloration : toits en tuiles rouges (donjon) ou ardoise bleue (tours), murs en grès chaud, mousse au pied, dalles claires sur les terrasses
          vec3 nn = normalize( vSWN ); float y = vSWP.y;
          float roof = smoothstep( 0.22, 0.45, nn.y ) * ( 1.0 - smoothstep( 0.93, 0.985, nn.y ) ) * smoothstep( 5.0, 8.0, y );
          float rw = floor( y * 2.4 ), cl = floor( ( vSWP.x + vSWP.z ) * 1.7 + mod( rw, 2.0 ) * 0.5 ), sh = sHash( vec2( cl, rw ) );
          vec3 tile = mix( vec3( 0.66, 0.22, 0.15 ), vec3( 0.82, 0.38, 0.22 ), sh );
          vec3 slate = mix( vec3( 0.2, 0.3, 0.52 ), vec3( 0.32, 0.45, 0.66 ), sh );
          vec3 roofC = mix( tile, slate, step( 14.0, abs( vSWP.x - 100.0 ) ) ) * mix( 1.0, tone, 0.5 );
          vec3 sand = mix( vec3( 0.64, 0.62, 0.6 ), vec3( 0.9, 0.76, 0.55 ), clamp( smoothstep( 0.0, 14.0, y ) * 0.7 + 0.2, 0.0, 1.0 ) );
          sand = mix( sand, vec3( 0.4, 0.52, 0.32 ), ( 1.0 - smoothstep( 0.0, 2.0, y ) ) * 0.55 );
          vec3 wallC = sand * tone * 1.15;
          float top = smoothstep( 0.93, 0.985, nn.y );
          diffuseColor.rgb = mix( mix( wallC, vec3( 0.78, 0.76, 0.72 ) * tone, top * 0.7 ), roofC, roof );` : ''} }`);
  };
  m.customProgramCacheKey = () => 'stone-nfog';
  return m;
}

// Bâtiments du kit (maisons, grenier, entrepôt, moulin, tours) : la palette du kit est très claire. On garde sa texture mais on recolore
// les toits (faces inclinées claires) avec une couleur propre à chaque bâtiment, et les murs blancs en crépi chaud, avec un grain léger.
const kitCache = new Map();
export function kitMaterial(map, roof = 0xa8432c, plaster = 0xecdcbc) {
  const key = roof + ':' + plaster; if (kitCache.has(key)) return kitCache.get(key);
  const m = new THREE.MeshLambertMaterial({ map, side: THREE.DoubleSide }), rc = new THREE.Color(roof), pc = new THREE.Color(plaster);
  m.onBeforeCompile = sh => {
    patchNorthFog(sh); sh.uniforms.uRoof = { value: rc }; sh.uniforms.uPlaster = { value: pc };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSWP;\nvarying vec3 vSWN;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vSWP = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
        vSWN = normalize( mat3( modelMatrix ) * objectNormal );`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vSWP;\nvarying vec3 vSWN;\nuniform vec3 uRoof;\nuniform vec3 uPlaster;\n${GLSL_STONE}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        { vec3 nn = normalize( vSWN ); float lum = dot( diffuseColor.rgb, vec3( 0.333 ) ), pale = smoothstep( 0.62, 0.85, lum );
          float slope = smoothstep( 0.25, 0.45, nn.y ) * ( 1.0 - smoothstep( 0.95, 0.99, nn.y ) );
          float rw = floor( vSWP.y * 3.0 ), sh = sHash( vec2( floor( ( vSWP.x + vSWP.z ) * 2.0 + mod( rw, 2.0 ) * 0.5 ), rw ) );
          vec3 roofC = uRoof * ( 0.82 + 0.3 * sh );
          vec3 wallC = uPlaster * ( 0.9 + 0.1 * sHash( floor( vSWP.xz * 3.0 ) + floor( vSWP.y * 3.0 ) ) );
          diffuseColor.rgb = mix( diffuseColor.rgb, mix( wallC, roofC, slope ), pale );
          diffuseColor.rgb *= 0.93 + 0.1 * sHash( floor( vSWP.xz * 9.0 + vSWP.y * 9.0 ) ); }`);
  };
  m.customProgramCacheKey = () => 'kit-tint-' + key; kitCache.set(key, m); return m;
}
// grain léger pour les matériaux unis des bâtiments (planches, pierre) : évite l'aspect « plastique »
export function patchGrain(sh) {
  // (v10.8) matières des bâtiments, déduites de la couleur : planches (bruns), pierres appareillées (gris, enduits clairs),
  // tuiles en rangs (rouges/orangés), chaume strié (jaunes) ; ombre vers le pied des murs. Coordonnées monde : stable et sans UV.
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGWP;').replace('#include <project_vertex>', `#include <project_vertex>
    vGWP = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;`);
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vGWP;\nfloat gHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float gNoise( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f ); return mix( mix( gHash( i ), gHash( i + vec2( 1, 0 ) ), f.x ), mix( gHash( i + vec2( 0, 1 ) ), gHash( i + vec2( 1, 1 ) ), f.x ), f.y ); }`)
    .replace('#include <color_fragment>', `#include <color_fragment>
    { vec3 c = diffuseColor.rgb, gn = normalize( cross( dFdx( vGWP ), dFdy( vGWP ) ) );
      float up = abs( gn.y ), mx = max( c.r, max( c.g, c.b ) ), mn = min( c.r, min( c.g, c.b ) ), sat = mx > 0.0 ? ( mx - mn ) / mx : 0.0;
      vec2 uv = up > 0.75 ? vGWP.xz : vec2( abs( gn.x ) > abs( gn.z ) ? vGWP.z : vGWP.x, vGWP.y );      // à plat : xz ; mur : (le long du mur, hauteur)
      float fine = gNoise( uv * 9.0 ) * 0.6 + gNoise( uv * 31.0 ) * 0.4, k = 1.0;
      bool roof = c.r > 0.3 && c.r > c.g * 1.45 && c.r > c.b * 1.6;
      bool straw = !roof && c.r > 0.5 && c.g > 0.42 && c.b < c.g * 0.7;
      bool wood = !roof && !straw && sat > 0.28 && c.r > c.g && c.g > c.b;
      if ( roof ) { vec2 t = vec2( uv.x * 2.2, ( up > 0.75 ? vGWP.x + vGWP.z : vGWP.y * 1.6 + ( vGWP.x + vGWP.z ) * 0.0 ) * 2.6 ); float row = floor( t.y ); t.x += mod( row, 2.0 ) * 0.5;
        float fy = fract( t.y ), fx = fract( t.x ); k = ( 0.74 + 0.3 * fy ) * ( 0.9 + 0.2 * gHash( vec2( floor( t.x ), row ) ) ) * ( 1.0 - 0.22 * smoothstep( 0.42, 0.5, abs( fx - 0.5 ) ) ); }
      else if ( straw ) { k = 0.82 + 0.22 * gNoise( vec2( uv.x * 26.0, uv.y * 2.5 ) ) + 0.08 * fine; }
      else if ( wood ) { float pl = uv.x * 2.9, id = floor( pl ), fx = fract( pl );
        k = ( 0.84 + 0.2 * gHash( vec2( id, 3.0 ) ) ) * ( 1.0 - 0.3 * smoothstep( 0.44, 0.5, abs( fx - 0.5 ) ) ) * ( 0.9 + 0.16 * gNoise( vec2( uv.x * 40.0, uv.y * 3.0 + id ) ) ); }
      else if ( sat < 0.24 ) { vec2 t = uv * vec2( 1.5, 2.6 ); float row = floor( t.y ); t.x += mod( row, 2.0 ) * 0.5 + gHash( vec2( row, 1.0 ) ) * 0.3;
        float mort = max( smoothstep( 0.43, 0.5, abs( fract( t.x ) - 0.5 ) ), smoothstep( 0.4, 0.5, abs( fract( t.y ) - 0.5 ) ) );
        k = ( 0.86 + 0.2 * gHash( vec2( floor( t.x ), row ) ) ) * ( 1.0 - 0.2 * mort ) * ( 0.92 + 0.12 * fine ); }
      else k = 0.88 + 0.18 * fine;
      k *= mix( 0.78, 1.04, smoothstep( 0.0, 2.2, vGWP.y ) );                                             // pied des murs plus sombre, sali
      diffuseColor.rgb *= k; }`);
}
