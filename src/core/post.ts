import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Renk düzenlemesi (ton eşlemeden sonra, ekran renginde): hafif keskinleştirme, yumuşak kontrast eğrisi,
 * doygunluk, gölgelere serin ve ışığa sıcak bir ton, kenarlarda yumuşak kararma.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    texel: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
    vignette: { value: 0.28 },
    saturation: { value: 1.1 },
    contrast: { value: 0.16 },
    sharpen: { value: 0.22 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 texel; uniform float vignette; uniform float saturation; uniform float contrast; uniform float sharpen;
    varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      // Keskinleştirme: dört komşunun ortalamasından farkı biraz büyütür (kenar yumuşatmanın bulanıklığını giderir).
      vec3 n = texture2D(tDiffuse, vUv + vec2(texel.x, 0.0)).rgb + texture2D(tDiffuse, vUv - vec2(texel.x, 0.0)).rgb
             + texture2D(tDiffuse, vUv + vec2(0.0, texel.y)).rgb + texture2D(tDiffuse, vUv - vec2(0.0, texel.y)).rgb;
      c.rgb = clamp(c.rgb + (c.rgb - n * 0.25) * sharpen, 0.0, 1.0);
      // Yumuşak S eğrisi: orta tonlar derinleşir, ışıklar ve gölgeler kırpılmaz.
      c.rgb = mix(c.rgb, c.rgb * c.rgb * (3.0 - 2.0 * c.rgb), contrast);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, saturation);
      // Gölgeler hafif mavi, aydınlık yerler hafif altın.
      c.rgb *= mix(vec3(0.96, 0.99, 1.04), vec3(1.03, 1.0, 0.96), smoothstep(0.15, 0.75, l));
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - vignette * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
      gl_FragColor = c;
    }`,
};

/** Masaüstünde ışık parıltısı ve renk düzenlemesi; çizim bunun üzerinden yapılır. */
export class PostFx {
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly grade: ShaderPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    // Çok örnekli hedef: kenar yumuşatma son işlemle kaybolmasın.
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.3, 0.55, 0.85);
    this.composer.addPass(this.bloom);
    // Ton eşleme önce yapılır; renk düzenlemesi ekranda görünen renkler üzerinde çalışır.
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.grade.uniforms.texel.value.set(1 / size.x, 1 / size.y);
  }

  setSize(w: number, h: number, pixelRatio: number) {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(w, h);
    this.bloom.resolution.set((w * pixelRatio) / 2, (h * pixelRatio) / 2);
    this.grade.uniforms.texel.value.set(1 / (w * pixelRatio), 1 / (h * pixelRatio));
  }

  render() {
    this.composer.render();
  }
}
