import * as THREE from 'three';
import { CFG } from '../data/config';
import { smooth } from '../core/rng';

/** Analitik arazi yüksekliği. Sur diplerinde, şehirde ve ana yolda düz. */
export function heightAt(x: number, z: number) {
  const r = Math.hypot(x, z);
  if (r < 340) return 0;
  let a = smooth(340, 470, r);
  for (const w of CFG.world.walls) a *= smooth(30, 150, Math.abs(r - w.r));
  if (z > 0) a *= smooth(14, 70, Math.abs(x));
  if (a <= 0) return 0;
  const n =
    Math.sin(x * 0.011 + 1.3) * Math.cos(z * 0.013 - 0.7) * 0.55 +
    Math.sin(x * 0.023 + z * 0.017) * 0.3 +
    Math.sin(x * 0.034 - z * 0.029 + 2.1) * 0.15;
  return a * 9 * n;
}

export function buildTerrain() {
  const group = new THREE.Group();
  const size = CFG.world.size;
  const seg = 320;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const n = Math.sin(x * 0.05) * Math.cos(z * 0.045) * 0.5 + Math.sin(x * 0.21 + z * 0.17) * 0.5;
    c.setHSL(0.24 + n * 0.02, 0.28, 0.2 + h * 0.006 + n * 0.025);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  group.add(ground);

  // Kapıları birbirine bağlayan ana yol (+Z yönünde).
  const outer = CFG.world.walls[2].r;
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(13, outer + 400 - 200),
    new THREE.MeshLambertMaterial({ color: 0x5b4c3a }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.06, (outer + 400 + 200) / 2);
  group.add(road);

  // Şehir zemini.
  const town = new THREE.Mesh(
    new THREE.CircleGeometry(CFG.world.walls[0].r - 5, 64),
    new THREE.MeshLambertMaterial({ color: 0x6a6258 }),
  );
  town.rotation.x = -Math.PI / 2;
  town.position.y = 0.04;
  group.add(town);
  return group;
}

export function buildSky(fogColor: THREE.Color) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x5f7088) },
      horizon: { value: fogColor.clone() },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader:
      'uniform vec3 top; uniform vec3 horizon; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y * 1.6, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(h, 0.7)), 1.0); }',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3800, 24, 12), mat);
  sky.frustumCulled = false;
  return sky;
}
