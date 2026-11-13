import * as THREE from 'three';
import type { World } from './world';
import { CFG } from '../data/config';
import { smooth } from '../core/rng';
import { grassTuftTexture } from '../core/textures';

const CELL = 2.3;
const HALF = 30; // her yönde hücre sayısı → ~69 m yarıçap
const SIDE = HALF * 2;

function hash(ix: number, iz: number, k: number) {
  const n = Math.sin(ix * 127.1 + iz * 311.7 + k * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Oyuncunun çevresinde dolaşan ot öbekleri. Öbekler sabit bir ızgaraya göre
 * yerleşir, bu yüzden oyuncu ilerledikçe yerlerinden oynamazlar; yalnızca
 * uzakta kalanlar öne taşınır.
 */
export class Grass {
  private readonly mesh: THREE.InstancedMesh;
  private lastX = Infinity;
  private lastZ = Infinity;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly p = new THREE.Vector3();
  private readonly c = new THREE.Color();

  constructor(
    scene: THREE.Scene,
    private readonly world: World,
  ) {
    // İki çapraz düzlem; normaller yukarı bakar ki otlar zeminle aynı ışığı alsın.
    const a = new THREE.PlaneGeometry(1, 1);
    a.translate(0, 0.5, 0);
    const b = a.clone();
    b.rotateY(Math.PI / 2);
    const pos = new Float32Array([...a.attributes.position.array, ...b.attributes.position.array]);
    const uv = new Float32Array([...a.attributes.uv.array, ...b.attributes.uv.array]);
    // Her düzlem iki yönden de çizilir (ters sarımlı kopya); böylece arka yüzde normal ters dönüp otu karartmaz.
    const front = [...a.index!.array, ...Array.from(b.index!.array, (i) => i + 4)];
    const idx = [...front];
    for (let i = 0; i < front.length; i += 3) idx.push(front[i], front[i + 2], front[i + 1]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const normals = new Float32Array(8 * 3);
    for (let i = 0; i < 8; i++) normals[i * 3 + 1] = 1;
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setIndex(idx);
    const mat = new THREE.MeshLambertMaterial({ map: grassTuftTexture(), alphaTest: 0.45 });
    this.mesh = new THREE.InstancedMesh(geo, mat, SIDE * SIDE);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
  }

  update(px: number, pz: number) {
    // Oyuncu birkaç hücre ilerleyince yeniden diz.
    if (Math.abs(px - this.lastX) < CELL * 2 && Math.abs(pz - this.lastZ) < CELL * 2) return;
    this.lastX = px;
    this.lastZ = pz;
    const cx = Math.round(px / CELL);
    const cz = Math.round(pz / CELL);
    const W = CFG.world;
    const reach = HALF * CELL;
    let n = 0;
    for (let ix = cx - HALF; ix < cx + HALF; ix++) {
      for (let iz = cz - HALF; iz < cz + HALF; iz++) {
        const x = (ix + hash(ix, iz, 1)) * CELL;
        const z = (iz + hash(ix, iz, 2)) * CELL;
        const r = Math.hypot(x, z);
        let scale = 0;
        const sparse = hash(ix, iz, 3) < 0.78;
        const clear = r > W.walls[0].r + 8 && !(z > 0 && Math.abs(x) < 8) && !W.walls.some((w) => Math.abs(r - w.r) < 9);
        if (sparse && clear) {
          const y = this.world.heightAt(x, z);
          if (!this.world.solidAt(x, y + 0.5, z, 0.4)) {
            // Kenara doğru küçülerek kaybolur: öbekler birden belirmez.
            const fade = smooth(reach, reach * 0.62, Math.hypot(x - px, z - pz));
            scale = fade * (0.32 + hash(ix, iz, 4) * 0.5);
            this.p.set(x, y - 0.03, z);
          }
        }
        if (scale <= 0.02) {
          this.m.makeScale(0, 0, 0);
        } else {
          this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, hash(ix, iz, 5) * 6.28);
          this.m.compose(this.p, this.q, this.s.set(scale * 1.9, scale, scale * 1.9));
        }
        this.mesh.setMatrixAt(n, this.m);
        const v = hash(ix, iz, 6);
        this.mesh.setColorAt(n, this.c.setHSL(0.22 + v * 0.05, 0.42, 0.4 + v * 0.14));
        n++;
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
