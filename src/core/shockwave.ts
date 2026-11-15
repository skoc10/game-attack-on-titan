import * as THREE from 'three';

interface Wave {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  t: number;
  life: number;
  radius: number;
}

/** Yere yatık halka: dışı keskin, içe doğru sönen bir bant. Yarıçapı 1. */
function band() {
  const N = 56;
  const pos = new Float32Array((N + 1) * 3 * 3);
  const col = new Float32Array((N + 1) * 3 * 3);
  const idx: number[] = [];
  const radii = [0.62, 0.93, 1];
  const shade = [0, 1, 0.15];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    for (let r = 0; r < 3; r++) {
      pos.set([Math.cos(a) * radii[r], 0, Math.sin(a) * radii[r]], (i * 3 + r) * 3);
      col.set([shade[r], shade[r], shade[r]], (i * 3 + r) * 3);
    }
    if (i < N) {
      const b = i * 3;
      idx.push(b, b + 3, b + 1, b + 1, b + 3, b + 4, b + 1, b + 4, b + 2, b + 2, b + 4, b + 5);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

/** Şok dalgaları: ezme, patlama ve yere çarpışlarda zeminde genişleyip sönen halkalar. */
export class Shockwaves {
  private readonly waves: Wave[] = [];
  private next = 0;

  constructor(scene: THREE.Scene, count = 14) {
    const geo = band();
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        vertexColors: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
      scene.add(mesh);
      this.waves.push({ mesh, mat, t: 0, life: 0, radius: 1 });
    }
  }

  /** (x, y, z) merkezli, `radius` yarıçapına kadar genişleyen halka. */
  spawn(x: number, y: number, z: number, radius: number, color: number, life = 0.6) {
    const w = this.waves[this.next];
    this.next = (this.next + 1) % this.waves.length;
    w.mesh.position.set(x, y + 0.35, z);
    w.radius = radius;
    w.t = 0;
    w.life = life;
    w.mat.color.setHex(color);
    w.mat.opacity = 0;
    w.mesh.scale.setScalar(0.01);
    w.mesh.visible = true;
  }

  update(dt: number) {
    for (const w of this.waves) {
      if (!w.mesh.visible) continue;
      w.t += dt;
      const u = w.t / w.life;
      if (u >= 1) {
        w.mesh.visible = false;
        continue;
      }
      // Hızlı açılır, yavaşlayarak yayılır.
      const r = w.radius * (1 - (1 - u) ** 2.6);
      w.mesh.scale.set(r, 1, r);
      w.mat.opacity = (u < 0.08 ? u / 0.08 : (1 - u) ** 1.6) * 0.75;
    }
  }
}
