import * as THREE from 'three';

/** Rüzgâr: ağaçların ve otların sallanışı ile rüzgâr sesi aynı esintiyi izler. */
export const windUniforms = {
  uWindTime: { value: 0 },
  /** Esintinin o anki şiddeti (0..1). */
  uWindGust: { value: 0.5 },
};

/** `t` anındaki esinti şiddeti (0..1): birkaç yavaş dalganın toplamı, ara sıra sertleşir. */
export function gustAt(t: number) {
  const g = 0.5 + 0.26 * Math.sin(t * 0.21) + 0.16 * Math.sin(t * 0.53 + 1.3) + 0.08 * Math.sin(t * 1.7 + 0.4);
  return Math.max(0, Math.min(1, g));
}

/** Rüzgârı ilerletir; o anki esintiyi döner. */
export function tickWind(dt: number) {
  windUniforms.uWindTime.value += dt;
  const g = gustAt(windUniforms.uWindTime.value);
  windUniforms.uWindGust.value = g;
  return g;
}

/**
 * Malzemeye rüzgârda sallanma ekler. Geometrinin yerel yüksekliği (y, tabanda 0) arttıkça eğilme büyür;
 * örnekli ağlarda her örneğin boyu (ölçeği) da eğilmeyi büyütür. `amp` tepedeki savrulmanın boya oranı,
 * `maxH` eğilmeyi hesaplarken boyun üst sınırı (dev ağaçlar sallanmasın diye).
 */
export function applyWind(mat: THREE.Material, amp: number, maxH: number) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windUniforms.uWindTime;
    shader.uniforms.uWindGust = windUniforms.uWindGust;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWindTime;\nuniform float uWindGust;')
      .replace(
        '#include <project_vertex>',
        `
        vec4 wPos = vec4(transformed, 1.0);
        float wScale = 1.0;
        #ifdef USE_INSTANCING
          wPos = instanceMatrix * wPos;
          wScale = length(instanceMatrix[1].xyz);
        #endif
        wPos = modelMatrix * wPos;
        {
          float hgt = clamp(transformed.y, 0.0, 1.2);
          float ph = wPos.x * 0.045 + wPos.z * 0.037;
          float sway = sin(uWindTime * 1.25 + ph) * (0.55 + 0.45 * uWindGust) + sin(uWindTime * 2.9 + ph * 1.9) * 0.22 * uWindGust;
          float bend = hgt * hgt * min(wScale, ${maxH.toFixed(1)}) * ${amp.toFixed(4)} * (0.35 + uWindGust);
          // Rüzgâr çoğunlukla bir yönden eser; dallar o yöne yatıp geri gelir.
          wPos.x += (sway * 0.8 + 0.5 * uWindGust) * bend;
          wPos.z += sway * 0.45 * bend;
        }
        vec4 mvPosition = viewMatrix * wPos;
        gl_Position = projectionMatrix * mvPosition;
        `,
      );
  };
  mat.customProgramCacheKey = () => `wind-${amp}-${maxH}`;
}
