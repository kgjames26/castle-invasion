// Brouillard de guerre du NORD : lié à la coordonnée monde z (pas à la caméra) → les hordes émergent de la brume.
import * as THREE from 'three';
import { ATMOS } from './config.js';
export const fogUniforms = {
  uNFogColor: { value: new THREE.Color(ATMOS.fogColor) },
  uNFogRange: { value: new THREE.Vector2(ATMOS.fogNear, ATMOS.fogFar) },   // z monde : clair à fogNear, opaque à fogFar (animé par le Renderer)
  // brume de distance (v3.6) : le lointain s'éclaircit vers la couleur de l'horizon (perspective aérienne)
  uHazeColor: { value: new THREE.Color(ATMOS.hazeColor) }, uHazeRange: { value: new THREE.Vector3(ATMOS.hazeNear, ATMOS.hazeFar, ATMOS.hazeMax) },
  uWindTime: { value: 0 },
  uCloud: { value: 0 },                                                     // (v5.0) ombres de nuages qui glissent sur le sol (0 la nuit)                                                  // vent : arbres et feuillages (animé par le Renderer)
};
export function patchNorthFog(shader) {
    Object.assign(shader.uniforms, fogUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vNZ;\nvarying float vNX;\nvarying float vHzD;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vHzD = -mvPosition.z;
        { vec4 nwp = vec4( transformed, 1.0 );
          #ifdef USE_INSTANCING
          nwp = instanceMatrix * nwp;
          #endif
          vec4 nww = modelMatrix * nwp; vNZ = nww.z; vNX = nww.x; }`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vNZ;\nvarying float vNX;\nvarying float vHzD;\nuniform float uCloud;\nuniform float uWindTime;\nuniform vec3 uNFogColor;\nuniform vec2 uNFogRange;\nuniform vec3 uHazeColor;\nuniform vec3 uHazeRange;')
      .replace('#include <tonemapping_fragment>', `
        { float t = uWindTime, c = sin( vNX * 0.019 + t * 0.045 ) * sin( vNZ * 0.016 - t * 0.03 ) + 0.55 * sin( ( vNX + vNZ ) * 0.041 + t * 0.06 ) + 0.3 * sin( vNX * 0.07 - vNZ * 0.05 - t * 0.08 );
          gl_FragColor.rgb *= 1.0 - smoothstep( 0.45, 1.1, c ) * 0.25 * uCloud; }
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
// bannières (v4.0) : le tissu ondule (géométries en coordonnées monde, phase selon la position)
export function applyFlutterFog(material, amp = 0.08) {
  material.onBeforeCompile = sh => { patchNorthFog(sh); sh.uniforms.uWindTime = fogUniforms.uWindTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWindTime;').replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed.z += ${amp.toFixed(3)} * sin( uWindTime * 4.2 + transformed.x * 1.9 + transformed.y * 2.6 ) + ${(amp * 0.5).toFixed(3)} * sin( uWindTime * 7.3 + transformed.y * 4.0 );
      transformed.x += ${(amp * 0.4).toFixed(3)} * sin( uWindTime * 3.1 + transformed.y * 3.0 );`); };
  material.customProgramCacheKey = () => 'flutter' + amp; return material;
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
