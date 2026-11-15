// Brouillard de guerre du NORD : lié à la coordonnée monde z (pas à la caméra) → les hordes émergent de la brume.
import * as THREE from 'three';
import { ATMOS } from './config.js';
export const fogUniforms = {
  uNFogColor: { value: new THREE.Color(ATMOS.fogColor) },
  uNFogRange: { value: new THREE.Vector2(ATMOS.fogNear, ATMOS.fogFar) },   // z monde : clair à fogNear, opaque à fogFar (animé par le Renderer)
  // brume de distance (v3.6) : le lointain s'éclaircit vers la couleur de l'horizon (perspective aérienne)
  uHazeColor: { value: new THREE.Color(ATMOS.hazeColor) }, uHazeRange: { value: new THREE.Vector3(ATMOS.hazeNear, ATMOS.hazeFar, ATMOS.hazeMax) },
  uWindTime: { value: 0 },                                                  // vent : arbres et feuillages (animé par le Renderer)
};
export function patchNorthFog(shader) {
    Object.assign(shader.uniforms, fogUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vNZ;\nvarying float vHzD;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vHzD = -mvPosition.z;
        { vec4 nwp = vec4( transformed, 1.0 );
          #ifdef USE_INSTANCING
          nwp = instanceMatrix * nwp;
          #endif
          vNZ = ( modelMatrix * nwp ).z; }`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vNZ;\nvarying float vHzD;\nuniform vec3 uNFogColor;\nuniform vec2 uNFogRange;\nuniform vec3 uHazeColor;\nuniform vec3 uHazeRange;')
      .replace('#include <tonemapping_fragment>', `
        { float hz = smoothstep( uHazeRange.x, uHazeRange.y, vHzD ) * uHazeRange.z; gl_FragColor.rgb = mix( gl_FragColor.rgb, uHazeColor, hz ); }
        { float nf = clamp( ( vNZ - uNFogRange.x ) / ( uNFogRange.y - uNFogRange.x ), 0.0, 1.0 );
          nf = nf * nf * ( 3.0 - 2.0 * nf ) * 0.92;
          gl_FragColor.rgb = mix( gl_FragColor.rgb, uNFogColor, nf ); }
        #include <tonemapping_fragment>`);   // (v3.6) brumes appliquées AVANT la tonalité : même rendu à l'écran et dans le post-traitement
}
// Vent (v3.6) : balancement des arbres, croissant avec la hauteur (au carré), déphasé selon la position de chaque arbre
export function patchWind(shader, amp = 0.012) {
  shader.uniforms.uWindTime = fogUniforms.uWindTime;
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWindTime;')
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      { vec3 wo = vec3( 0.0 );
        #ifdef USE_INSTANCING
        wo = instanceMatrix[ 3 ].xyz;
        #endif
        float h = max( 0.0, transformed.y ), k = ${amp.toFixed(4)} * h * h, ph = wo.x * 0.13 + wo.z * 0.09;
        transformed.x += k * ( sin( uWindTime * 1.25 + ph ) + 0.35 * sin( uWindTime * 3.1 + ph * 2.0 ) );
        transformed.z += k * 0.6 * cos( uWindTime * 1.05 + ph * 1.3 ); }`);
}
export function applyWindFog(material, amp) {
  material.onBeforeCompile = sh => { patchNorthFog(sh); patchWind(sh, amp); };
  material.customProgramCacheKey = () => 'north-fog-wind' + amp;
  return material;
}
export function applyNorthFog(material) {
  material.onBeforeCompile = patchNorthFog;
  material.customProgramCacheKey = () => 'north-fog';
  return material;
}
