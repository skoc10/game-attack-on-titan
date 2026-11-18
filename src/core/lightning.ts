import * as THREE from 'three';

/** Gökten yere inen, zikzaklı ve dallanan yıldırım. Birkaç kez titreyip söner. */
export class Lightning {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.MeshBasicMaterial;
  private readonly at = new THREE.Vector3();
  private height = 260;
  private t = 0;
  private dur = 0;
  private flickers: number[] = [];

  constructor(scene: THREE.Scene, color = 0xfff2a8) {
    this.mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1,
      fog: false,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  /** (x, y, z) zemin noktasına düşer; `flickers` saniyelerinde yeni bir çatallanmayla yeniden çakar. */
  strike(x: number, y: number, z: number, height = 260, flickers = [0.09, 0.2, 0.34], dur = 0.6) {
    this.at.set(x, y, z);
    this.height = height;
    this.t = 0;
    this.dur = dur;
    this.flickers = [...flickers];
    this.mesh.visible = true;
    this.build();
  }

  /** Ana kol ve birkaç dal: her biri iki dik şeritten oluşur, her yönden görünür. */
  private build() {
    const pos: number[] = [];
    const ribbon = (pts: THREE.Vector3[], w0: number, w1: number) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const wa = THREE.MathUtils.lerp(w0, w1, i / (pts.length - 1));
        const wb = THREE.MathUtils.lerp(w0, w1, (i + 1) / (pts.length - 1));
        for (const [ox, oz] of [[1, 0], [0, 1]]) {
          pos.push(
            a.x - ox * wa, a.y, a.z - oz * wa, a.x + ox * wa, a.y, a.z + oz * wa, b.x + ox * wb, b.y, b.z + oz * wb,
            a.x - ox * wa, a.y, a.z - oz * wa, b.x + ox * wb, b.y, b.z + oz * wb, b.x - ox * wb, b.y, b.z - oz * wb,
          );
        }
      }
    };
    const H = this.height;
    const main: THREE.Vector3[] = [];
    const n = 16;
    let x = (Math.random() - 0.5) * H * 0.25;
    let z = (Math.random() - 0.5) * H * 0.25;
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      // Kol yere yaklaştıkça hedef noktaya toplanır.
      const pull = f * f;
      x = THREE.MathUtils.lerp(x + (Math.random() - 0.5) * H * 0.09, 0, pull);
      z = THREE.MathUtils.lerp(z + (Math.random() - 0.5) * H * 0.09, 0, pull);
      main.push(new THREE.Vector3(this.at.x + x, this.at.y + H * (1 - f), this.at.z + z));
    }
    ribbon(main, 0.3, 0.7);
    for (let b = 0; b < 4; b++) {
      const from = main[2 + Math.floor(Math.random() * (n - 6))];
      const pts = [from.clone()];
      const dir = Math.random() * Math.PI * 2;
      const len = 4 + Math.floor(Math.random() * 4);
      for (let i = 1; i <= len; i++) {
        const p = pts[i - 1];
        pts.push(new THREE.Vector3(p.x + Math.sin(dir) * H * 0.04 + (Math.random() - 0.5) * H * 0.03, p.y - H * (0.03 + Math.random() * 0.03), p.z + Math.cos(dir) * H * 0.04 + (Math.random() - 0.5) * H * 0.03));
      }
      ribbon(pts, 0.4, 0.08);
    }
    const geo = this.mesh.geometry;
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeBoundingSphere();
  }

  update(dt: number) {
    if (!this.mesh.visible) return;
    this.t += dt;
    if (this.flickers.length > 0 && this.t >= this.flickers[0]) {
      this.flickers.shift();
      this.build();
    }
    // Her çakışta parlar, aralarda kısılır.
    const flick = 0.55 + 0.45 * Math.abs(Math.sin(this.t * 55));
    this.mat.opacity = Math.max(0, 1 - this.t / this.dur) * flick;
    if (this.t >= this.dur) this.mesh.visible = false;
  }
}
