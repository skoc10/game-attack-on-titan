import * as THREE from 'three';

/** Havuzlu basit parçacık sistemi (buhar, gaz, kıvılcım). */
export class Particles {
  private readonly n: number;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly base: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly rise: Float32Array;
  private next = 0;
  private readonly geo = new THREE.BufferGeometry();
  readonly points: THREE.Points;

  constructor(scene: THREE.Scene, n = 1400) {
    this.n = n;
    this.pos = new Float32Array(n * 3).fill(-9999);
    this.col = new Float32Array(n * 3);
    this.base = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n).fill(1);
    this.rise = new Float32Array(n);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = 32;
    const ctx = cvs.getContext('2d')!;
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    const mat = new THREE.PointsMaterial({
      map: new THREE.CanvasTexture(cvs),
      size: 1.7,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      fog: false,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, color: number, rise = 0) {
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
  }

  burst(p: THREE.Vector3, count: number, speed: number, life: number, color: number, spread = 1, rise = 0) {
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
      this.col[j] = this.base[j] * f;
      this.col[j + 1] = this.base[j + 1] * f;
      this.col[j + 2] = this.base[j + 2] * f;
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}
