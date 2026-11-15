// Brouillard de guerre du NORD : lié à la coordonnée monde z (pas à la caméra) → les hordes émergent de la brume.
import * as THREE from 'three';
import { ATMOS } from './config.js';
export const fogUniforms = {
  uNFogColor: { value: new THREE.Color(ATMOS.fogColor) },
  uNFogRange: { value: new THREE.Vector2(ATMOS.fogNear, ATMOS.fogFar) },   // z monde : clair à fogNear, opaque à fogFar (animé par le Renderer)
  // brume de distance (v3.6) : le lointain s'éclaircit vers la couleur de l'horizon (perspective aérienne)
  uHazeColor: { value: new THREE.Color(ATMOS.hazeColor) }, uHazeRange: { value: new THREE.Vector3(ATMOS.hazeNear, ATMOS.hazeFar, ATMOS.hazeMax) },
  uWindTime: { value: 0 },
  uCloud: { value: 0 },
  uSnow: { value: 0 },
  uAutumn: { value: 0 },
  uSpring: { value: 0 },                                                    // (v8.0) fleurs des champs au printemps                                                    // (v7.0) l'herbe roussit en automne                                                      // (v7.0) neige au sol en hiver (faces tournées vers le ciel)                                                     // (v5.0) ombres de nuages qui glissent sur le sol (0 la nuit)                                                  // vent : arbres et feuillages (animé par le Renderer)
};
export function patchNorthFog(shader) {
    Object.assign(shader.uniforms, fogUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vNZ;\nvarying float vNX;\nvarying float vHzD;\nvarying float vNUp;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vHzD = -mvPosition.z;
        { vec4 nwp = vec4( transformed, 1.0 );
          #ifdef USE_INSTANCING
          nwp = instanceMatrix * nwp;
          #endif
          vec4 nww = modelMatrix * nwp; vNZ = nww.z; vNX = nww.x;
          vec3 wn = normal;
          #ifdef USE_INSTANCING
          wn = mat3( instanceMatrix ) * wn;
          #endif
          vec3 wnw = mat3( modelMatrix ) * wn; float wl = dot( wnw, wnw ); vNUp = wl > 1e-8 ? wnw.y * inversesqrt( wl ) : 0.0; }`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vNZ;\nvarying float vNX;\nvarying float vHzD;\nvarying float vNUp;\nuniform float uCloud;\nuniform float uSnow;\nuniform float uAutumn;\nuniform float uSpring;\nuniform float uWindTime;\nuniform vec3 uNFogColor;\nuniform vec2 uNFogRange;\nuniform vec3 uHazeColor;\nuniform vec3 uHazeRange;')
      .replace('#include <tonemapping_fragment>', `
        { float t = uWindTime, c = sin( vNX * 0.019 + t * 0.045 ) * sin( vNZ * 0.016 - t * 0.03 ) + 0.55 * sin( ( vNX + vNZ ) * 0.041 + t * 0.06 ) + 0.3 * sin( vNX * 0.07 - vNZ * 0.05 - t * 0.08 );
          gl_FragColor.rgb *= 1.0 - smoothstep( 0.45, 1.1, c ) * 0.25 * uCloud; }
        if ( uAutumn > 0.001 ) { vec3 cA = gl_FragColor.rgb; float gr = clamp( ( cA.g - max( cA.r, cA.b ) ) * 12.0, 0.0, 1.0 ) * smoothstep( 0.3, 0.75, vNUp );
          float la = dot( cA, vec3( 0.299, 0.587, 0.114 ) ), va = 0.5 + 0.5 * sin( vNX * 0.09 + vNZ * 0.06 ) * sin( vNX * 0.031 - vNZ * 0.05 + 0.7 );
          gl_FragColor.rgb = mix( cA, vec3( la * 1.75, la * 0.98, la * 0.36 ), gr * uAutumn * ( 0.5 + 0.4 * va ) ); }
        if ( uSpring > 0.001 ) { vec3 cS = gl_FragColor.rgb; float grS = clamp( ( cS.g - max( cS.r, cS.b ) ) * 12.0, 0.0, 1.0 ) * smoothstep( 0.6, 0.9, vNUp );
          vec2 cell = floor( vec2( vNX, vNZ ) * 0.9 ); float h = fract( sin( dot( cell, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ), h2 = fract( h * 17.13 );
          vec2 fp = fract( vec2( vNX, vNZ ) * 0.9 ) - 0.5; float dot0 = 1.0 - smoothstep( 0.1, 0.17, length( fp - ( vec2( h, h2 ) - 0.5 ) * 0.6 ) );
          float fpatch = smoothstep( 0.35, 0.75, 0.5 + 0.5 * sin( vNX * 0.07 + 1.1 ) * sin( vNZ * 0.05 - 0.4 ) );
          vec3 fc = h2 < 0.33 ? vec3( 1.0, 0.82, 0.15 ) : h2 < 0.66 ? vec3( 0.95, 0.45, 0.68 ) : vec3( 0.98, 0.97, 0.94 );
          gl_FragColor.rgb = mix( cS, fc * clamp( dot( cS, vec3( 0.3, 0.59, 0.11 ) ) * 4.5, 0.4, 1.1 ), dot0 * step( 0.6, h ) * grS * fpatch * uSpring ); }
        if ( uSnow > 0.001 ) { float nz = 0.5 + 0.22 * sin( vNX * 0.13 + vNZ * 0.071 ) + 0.16 * sin( -vNX * 0.047 + vNZ * 0.17 + 1.3 ) + 0.08 * sin( vNX * 0.41 - vNZ * 0.33 + 2.1 ) + 0.05 * sin( vNX * 0.9 + vNZ * 0.77 );
          float sn = smoothstep( 0.55, 0.9, vNUp ) * smoothstep( 0.12, 0.42, uSnow * 1.1 - nz * 0.55 );
          float lum = dot( gl_FragColor.rgb, vec3( 0.299, 0.587, 0.114 ) );
          gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( 0.9, 0.93, 0.98 ) * clamp( lum * 2.3, 0.16, 0.95 ), sn * 0.85 ); }
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
