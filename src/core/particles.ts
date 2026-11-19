import * as THREE from 'three';

/**
 * Havuzlu basit parçacık sistemi (buhar, gaz, kıvılcım).
 * `smoke` kipinde ışık saçmaz: normal karışımla çizilir, rengi korunur ve ömrü bittikçe saydamlaşır (duman).
 */
export class Particles {
  private readonly n: number;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly base: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly rise: Float32Array;
  private readonly size: Float32Array;
  private readonly size0: Float32Array;
  private readonly grow: Float32Array;
  private readonly fade: Float32Array;
  private next = 0;
  private readonly geo = new THREE.BufferGeometry();
  readonly points: THREE.Points;

  constructor(scene: THREE.Scene, n = 2400, private readonly smoke = false) {
    this.n = n;
    this.pos = new Float32Array(n * 3).fill(-9999);
    this.col = new Float32Array(n * 3);
    this.base = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n).fill(1);
    this.rise = new Float32Array(n);
    this.size = new Float32Array(n);
    this.size0 = new Float32Array(n);
    this.grow = new Float32Array(n);
    this.fade = new Float32Array(n).fill(1);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('tint', new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute('fade', new THREE.BufferAttribute(this.fade, 1));
    const S = smoke ? 64 : 32;
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = S;
    const ctx = cvs.getContext('2d')!;
    if (smoke) {
      // Duman: üst üste binen yumuşak öbekler; kenarı düzensiz bir bulut, keskin bir daire değil.
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 9; i++) {
        const cx = S / 2 + (rnd() - 0.5) * S * 0.36;
        const cy = S / 2 + (rnd() - 0.5) * S * 0.36;
        const r = S * (0.16 + rnd() * 0.16);
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, 'rgba(255,255,255,0.42)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, S, S);
      }
    } else {
      const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.45)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 32, 32);
    }
    // Her parçacığın kendi boyutu var: kıvılcımlar küçük kalır, buhar ve toz yayıldıkça büyür.
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: new THREE.CanvasTexture(cvs) }, scale: { value: 400 } },
      vertexShader: `
        attribute float size;
        attribute vec3 tint;
        attribute float fade;
        uniform float scale;
        varying vec3 vTint;
        varying float vFade;
        void main() {
          vTint = tint;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          // Kameranın dibindeki dev bir parçacık ekranı kaplamasın: ekranda büyüdükçe söner, boyutu da sınırlı.
          float ps = size * scale / max(0.1, -mv.z);
          vFade = fade * clamp(1.6 - ps / (scale * 0.45), 0.0, 1.0);
          gl_PointSize = min(ps, scale * 0.7);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D map;
        varying vec3 vTint;
        varying float vFade;
        void main() {
          float a = texture2D(map, gl_PointCoord).a;
          gl_FragColor = vec4(vTint, a * 0.55 * vFade);
        }`,
      transparent: true,
      depthWrite: false,
      blending: smoke ? THREE.NormalBlending : THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    const buf = new THREE.Vector2();
    // Boyut, ekran yüksekliğine göre ölçeklenir (PointsMaterial ile aynı kural).
    this.points.onBeforeRender = (renderer) => {
      mat.uniforms.scale.value = renderer.getDrawingBufferSize(buf).y * 0.5;
    };
    scene.add(this.points);
  }

  /**
   * `rise`: dikey ivme (artı = yükselen buhar, eksi = düşen damla). `size`: başlangıç boyutu.
   * `grow`: ömrü boyunca boyutuna eklenen kat (verilmezse yükselen parçacıklar yayılır, diğerleri hafifçe küçülür).
   */
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, color: number, rise = 0, size = rise > 0 ? 2.1 : 1.7, grow = rise > 0 ? 1.5 : -0.35) {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.base[i * 3] = ((color >> 16) & 255) / 255;
    this.base[i * 3 + 1] = ((color >> 8) & 255) / 255;
    this.base[i * 3 + 2] = (color & 255) / 255;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.rise[i] = rise;
    this.size0[i] = size;
    this.size[i] = size;
    this.grow[i] = grow;
  }

  burst(p: THREE.Vector3, count: number, speed: number, life: number, color: number, spread = 1, rise = 0, size?: number, grow?: number) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const u = Math.random() * 2 - 1;
      const s = Math.sqrt(1 - u * u);
      const sp = speed * (0.3 + Math.random() * 0.7);
      this.emit(
        p.x + (Math.random() - 0.5) * spread,
        p.y + (Math.random() - 0.5) * spread,
        p.z + (Math.random() - 0.5) * spread,
        Math.cos(a) * s * sp,
        u * sp,
        Math.sin(a) * s * sp,
        life * (0.5 + Math.random() * 0.5),
        color,
        rise,
        size === undefined ? undefined : size * (0.7 + Math.random() * 0.6),
        grow,
      );
    }
  }

  update(dt: number) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const j = i * 3;
      if (this.life[i] <= 0) {
        this.pos[j + 1] = -9999;
        this.size[i] = 0;
        continue;
      }
      const damp = 1 - Math.min(1, dt * 1.8);
      this.vel[j] *= damp;
      this.vel[j + 1] = this.vel[j + 1] * damp + this.rise[i] * dt;
      this.vel[j + 2] *= damp;
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt;
      const f = this.life[i] / this.maxLife[i];
      // Işık saçan parçacık kararır; duman rengini korur, saydamlaşarak kaybolur (önce hafifçe belirir).
      const k = this.smoke ? 1 : f;
      if (this.smoke) this.fade[i] = Math.min(1, (1 - f) * 6) * f;
      this.col[j] = this.base[j] * k;
      this.col[j + 1] = this.base[j + 1] * k;
      this.col[j + 2] = this.base[j + 2] * k;
      this.size[i] = this.size0[i] * Math.max(0.2, 1 + this.grow[i] * (1 - f));
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.tint as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.size as THREE.BufferAttribute).needsUpdate = true;
    if (this.smoke) (this.geo.attributes.fade as THREE.BufferAttribute).needsUpdate = true;
  }
}
