import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Renk düzenlemesi: hafif doygunluk artışı, gölgelere serin, ışığa sıcak bir ton ve kenarlarda yumuşak kararma.
 * Işık hesapları doğrusal uzayda kalır; ton eşleme en sondaki çıkış geçişinde yapılır.
 */
const GradeShader = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null }, vignette: { value: 0.32 }, saturation: { value: 1.12 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float vignette; uniform float saturation;
    varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, saturation);
      // Gölgeler hafif mavi, aydınlık yerler hafif altın.
      c.rgb *= mix(vec3(0.95, 0.98, 1.05), vec3(1.04, 1.0, 0.95), smoothstep(0.05, 0.6, l));
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - vignette * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
      gl_FragColor = c;
    }`,
};

/** Masaüstünde ışık parıltısı ve renk düzenlemesi; çizim bunun üzerinden yapılır. */
export class PostFx {
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    // Çok örnekli hedef: kenar yumuşatma son işlemle kaybolmasın.
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.28, 0.55, 0.86);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new ShaderPass(GradeShader));
    this.composer.addPass(new OutputPass());
  }

  setSize(w: number, h: number, pixelRatio: number) {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(w, h);
    this.bloom.resolution.set((w * pixelRatio) / 2, (h * pixelRatio) / 2);
  }

  render() {
    this.composer.render();
  }
}
