import * as THREE from 'three';
import { CFG } from '../data/config';
import { mulberry32, smooth } from '../core/rng';
import { cobbleTexture, dirtTexture, grassTexture } from '../core/textures';

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
    // Geniş ölçekli renk lekeleri: kuru, canlı ve gölgeli çayır bölgeleri.
    const big = Math.sin(x * 0.0031 + 0.7) * Math.cos(z * 0.0027 - 1.1);
    const mid = Math.sin(x * 0.019 + z * 0.013) * Math.cos(z * 0.023 - x * 0.007);
    c.setHSL(0.225 + big * 0.035 + mid * 0.012, 0.34 + big * 0.08, 0.3 + mid * 0.045 + h * 0.005);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const grass = grassTexture();
  grass.repeat.set(size / 9, size / 9);
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: grass, vertexColors: true }));
  ground.receiveShadow = true;
  group.add(ground);

  // Kapıları birbirine bağlayan toprak yol (+Z yönünde).
  const outer = CFG.world.walls[2].r;
  const len = outer + 200;
  const dirt = dirtTexture();
  dirt.repeat.set(1, len / 13);
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(13, len),
    new THREE.MeshLambertMaterial({ map: dirt, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.08, 200 + len / 2);
  road.receiveShadow = true;
  group.add(road);

  // Şehir zemini: arnavut kaldırımı.
  const townR = CFG.world.walls[0].r - 5;
  const cobble = cobbleTexture();
  cobble.repeat.set((townR * 2) / 5, (townR * 2) / 5);
  const town = new THREE.Mesh(
    new THREE.CircleGeometry(townR, 64),
    new THREE.MeshLambertMaterial({ map: cobble, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  );
  town.rotation.x = -Math.PI / 2;
  town.position.y = 0.05;
  town.receiveShadow = true;
  group.add(town);
  return group;
}

export const SUN_DIR = new THREE.Vector3(0.48, 0.62, 0.36).normalize();

/** Güneşli, hareketli bulutlu gökyüzü kubbesi. Kamerayı izler. */
export function buildSky(fogColor: THREE.Color) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x3f74b8) },
      horizon: { value: fogColor.clone() },
      sunDir: { value: SUN_DIR.clone() },
      sunCol: { value: new THREE.Color(0xfff1d0) },
      time: { value: 0 },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunCol; uniform float time;
      varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(horizon, top, pow(h, 0.5));
        float s = max(dot(d, sunDir), 0.0);
        col += sunCol * (pow(s, 420.0) * 1.6 + pow(s, 14.0) * 0.22);
        if (d.y > 0.0) {
          vec2 uv = d.xz / (d.y + 0.14) * 1.25 + vec2(time * 0.006, time * 0.002);
          float c = smoothstep(0.5, 0.8, fbm(uv));
          float lit = smoothstep(0.35, 0.95, fbm(uv * 1.7 + 4.2));
          vec3 cloud = mix(vec3(0.66, 0.71, 0.79), vec3(1.0, 0.98, 0.94), lit);
          cloud += sunCol * pow(s, 6.0) * 0.18;
          col = mix(col, cloud, c * smoothstep(0.0, 0.2, d.y) * 0.9);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(6000, 32, 16), mat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  return sky;
}

/** Ufukta iki sıra dağ silueti: dünyanın sonsuz düzlük gibi görünmesini önler. */
export function buildMountains(fogColor: THREE.Color) {
  const group = new THREE.Group();
  const rng = mulberry32(909);
  const ring = (radius: number, minH: number, maxH: number, mix: number) => {
    const n = 150;
    const verts: number[] = [];
    const heights: number[] = [];
    let h = (minH + maxH) / 2;
    for (let i = 0; i < n; i++) {
      h = Math.min(maxH, Math.max(minH, h + (rng() - 0.5) * (maxH - minH) * 0.5));
      heights.push(i % 2 === 0 ? h : h * (0.45 + rng() * 0.3));
    }
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const h0 = heights[i];
      const h1 = heights[(i + 1) % n];
      const x0 = Math.sin(a0) * radius;
      const z0 = Math.cos(a0) * radius;
      const x1 = Math.sin(a1) * radius;
      const z1 = Math.cos(a1) * radius;
      verts.push(x0, -40, z0, x1, -40, z1, x1, h1, z1, x0, -40, z0, x1, h1, z1, x0, h0, z0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    const color = fogColor.clone().lerp(new THREE.Color(0x4a6384), mix);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, fog: false, side: THREE.DoubleSide }));
    m.frustumCulled = false;
    m.renderOrder = -5;
    group.add(m);
  };
  ring(4600, 380, 1100, 0.22);
  ring(3600, 160, 560, 0.4);
  return group;
}
