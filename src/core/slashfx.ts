import * as THREE from 'three';

interface Arc {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  t: number;
  life: number;
  size: number;
  dir: THREE.Vector3;
}

const X = new THREE.Vector3();
const Y = new THREE.Vector3();
const Z = new THREE.Vector3();
const M = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

/** Uçları sivrilen hilal: kılıcın havada bıraktığı iz. Kabarık yanı yerel +X'e bakar. */
function crescent() {
  const N = 28;
  const pos = new Float32Array((N + 1) * 2 * 3);
  const idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const a = (u - 0.5) * 2.5;
    const w = 0.34 * Math.sin(u * Math.PI) ** 1.4;
    pos.set([Math.cos(a), Math.sin(a), 0], i * 6);
    pos.set([Math.cos(a) * (1 - w), Math.sin(a) * (1 - w), 0], i * 6 + 3);
    if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

/** Kesik izleri: öldürücü darbede ensede parlayıp genişleyerek sönen hilaller. */
export class SlashFx {
  private readonly arcs: Arc[] = [];
  private next = 0;

  constructor(scene: THREE.Scene, count = 10) {
    const geo = crescent();
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
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
      scene.add(mesh);
      this.arcs.push({ mesh, mat, t: 0, life: 0, size: 1, dir: new THREE.Vector3() });
    }
  }

  /**
   * `at` noktasında, `dir` yönünde savrulan bir kesik izi. `roll` hilalin o yön çevresindeki
   * eğimidir (rad): iki kılıç için ters eğimli iki iz çapraz bir kesik oluşturur.
   */
  spawn(at: THREE.Vector3, dir: THREE.Vector3, size: number, color: number, roll: number, life = 0.3) {
    const a = this.arcs[this.next];
    this.next = (this.next + 1) % this.arcs.length;
    X.copy(dir);
    if (X.lengthSq() < 1e-6) X.set(0, 0, 1);
    X.normalize();
    Y.crossVectors(UP, X);
    if (Y.lengthSq() < 1e-4) Y.set(1, 0, 0);
    Y.normalize().applyAxisAngle(X, roll);
    Z.crossVectors(X, Y);
    a.mesh.quaternion.setFromRotationMatrix(M.makeBasis(X, Y, Z));
    a.mesh.position.copy(at).addScaledVector(X, -size * 0.75);
    a.dir.copy(X);
    a.size = size;
    a.t = 0;
    a.life = life;
    a.mat.color.setHex(color);
    a.mesh.visible = true;
  }

  update(dt: number) {
    for (const a of this.arcs) {
      if (!a.mesh.visible) continue;
      a.t += dt;
      const u = a.t / a.life;
      if (u >= 1) {
        a.mesh.visible = false;
        continue;
      }
      // Hızla açılır, sonra ileri doğru kayarak söner.
      const grow = 0.55 + 0.75 * (1 - (1 - u) ** 3);
      a.mesh.scale.setScalar(a.size * grow);
      a.mesh.position.addScaledVector(a.dir, a.size * 1.6 * dt);
      a.mat.opacity = u < 0.15 ? u / 0.15 : (1 - u) ** 1.5;
    }
  }
}
