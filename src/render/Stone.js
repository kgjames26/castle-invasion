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

export function stoneMaterial(color = 0xaeb2b8) {
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
          diffuseColor.rgb *= tone; }`);
  };
  m.customProgramCacheKey = () => 'stone-nfog';
  return m;
}
