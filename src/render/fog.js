// Brouillard de guerre du NORD : lié à la coordonnée monde z (pas à la caméra) → les hordes émergent de la brume.
import * as THREE from 'three';
export const fogUniforms = {
  uNFogColor: { value: new THREE.Color(0x0a0f16) },
  uNFogRange: { value: new THREE.Vector2(78, 18) },   // z monde : clair à 78 m, opaque à 18 m
};
export function applyNorthFog(material) {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, fogUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vNZ;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 nwp = vec4( transformed, 1.0 );
          #ifdef USE_INSTANCING
          nwp = instanceMatrix * nwp;
          #endif
          vNZ = ( modelMatrix * nwp ).z; }`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vNZ;\nuniform vec3 uNFogColor;\nuniform vec2 uNFogRange;')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        { float nf = clamp( ( vNZ - uNFogRange.x ) / ( uNFogRange.y - uNFogRange.x ), 0.0, 1.0 );
          nf = nf * nf * ( 3.0 - 2.0 * nf ) * 0.92;
          gl_FragColor.rgb = mix( gl_FragColor.rgb, uNFogColor, nf ); }`);
  };
  material.customProgramCacheKey = () => 'north-fog';
  return material;
}
