import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CFG } from '../data/config';
import { angDiff, mulberry32, smooth } from '../core/rng';
import { cobbleTexture, dirtTexture, grassTexture } from '../core/textures';
import { DIRS, DISTRICTS, GIANT_FOREST, ROAD_END, ROAD_HALF, districtGap, districtHalf, wallDist } from './layout';

/** Analitik arazi yüksekliği. Sur diplerinde, şehirde, kasabalarda ve ana yollarda düz. */
export function heightAt(x: number, z: number) {
  const r = Math.hypot(x, z);
  if (r < 340) return 0;
  let a = smooth(340, 470, r);
  if (r < ROAD_END) a *= smooth(14, 70, Math.min(Math.abs(x), Math.abs(z)));
  if (a <= 0) return 0;
  a *= smooth(0, 90, districtGap(x, z));
  if (a <= 0) return 0;
  a *= smooth(30, 150, wallDist(x, z));
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
  // Bir karo yaklaşık 27 m: dünya büyüdükçe karo sayısı da artar.
  const seg = Math.round(size / 27);
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
    // Dev ağaçlar ormanının tabanı: gölgede kalan koyu, yosunlu toprak.
    const fd = Math.hypot(x - GIANT_FOREST.x, z - GIANT_FOREST.z);
    if (fd < GIANT_FOREST.r + 120) {
      const k = smooth(GIANT_FOREST.r + 120, GIANT_FOREST.r - 80, fd);
      c.lerp(new THREE.Color().setHSL(0.24 + mid * 0.02, 0.42, 0.17 + mid * 0.03), k);
    }
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

  // Dört kapıdan geçip birbirini kesen toprak yollar (şehrin dışından başlar).
  const len = ROAD_END - 200;
  const dirt = dirtTexture();
  dirt.repeat.set(1, len / 13);
  const roadMat = new THREE.MeshLambertMaterial({ map: dirt, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  for (const ang of DIRS) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, len), roadMat);
    road.rotation.set(-Math.PI / 2, 0, ang, 'YXZ');
    const mid = 200 + len / 2;
    road.position.set(Math.sin(ang) * mid, 0.08, Math.cos(ang) * mid);
    road.receiveShadow = true;
    group.add(road);
  }

  // Şehir zemini: arnavut kaldırımı.
  const townR = CFG.world.walls[0].r - 5;
  const cobble = cobbleTexture();
  cobble.repeat.set((townR * 2) / 5, (townR * 2) / 5);
  const cobbleMat = (tex: THREE.Texture) =>
    new THREE.MeshLambertMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const town = new THREE.Mesh(new THREE.CircleGeometry(townR, 64), cobbleMat(cobble));
  town.rotation.x = -Math.PI / 2;
  town.position.y = 0.05;
  town.receiveShadow = true;
  group.add(town);

  // Kapı kasabalarının zemini: surun dışında kalan yarım ay biçimli alan.
  const lens: THREE.BufferGeometry[] = [];
  for (const d of DISTRICTS) {
    const R = CFG.world.walls[d.ring].r;
    const half = districtHalf(d);
    const shape = new THREE.Shape();
    const pt = (x: number, z: number, first = false) => (first ? shape.moveTo(x, -z) : shape.lineTo(x, -z));
    const N = 40;
    for (let i = 0; i <= N; i++) {
      const a = d.ang - half + (half * 2 * i) / N;
      pt(d.x + Math.sin(a) * d.r, d.z + Math.cos(a) * d.r, i === 0);
    }
    // Sur boyunca geri dön: kasaba yayının iki ucu surun üstündedir.
    const end = d.ang + half;
    const beta = angDiff(Math.atan2(d.x + Math.sin(end) * d.r, d.z + Math.cos(end) * d.r), d.ang);
    for (let i = 1; i < N; i++) {
      const a = d.ang + beta - (beta * 2 * i) / N;
      pt(Math.sin(a) * R, Math.cos(a) * R);
    }
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    lens.push(geo);
  }
  const districtCobble = cobbleTexture();
  districtCobble.repeat.set(1 / 5, 1 / 5);
  const districts = new THREE.Mesh(mergeGeometries(lens, false)!, cobbleMat(districtCobble));
  districts.position.y = 0.05;
  districts.receiveShadow = true;
  group.add(districts);
  return group;
}

export const SUN_DIR = new THREE.Vector3(0.48, 0.62, 0.36).normalize();

/**
 * Yansıma ortamı: gökyüzü mavisi, ufuk ışığı ve toprak tonundan oluşan basit bir küre, bir kez önceden süzülür.
 * Yalnızca fiziksel malzemeleri (dev derisi, zırh) etkiler; onlara gökten gelen yumuşak bir parıltı verir.
 */
export function buildEnvironment(renderer: THREE.WebGLRenderer) {
  const scene = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { sun: { value: SUN_DIR.clone() } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 sun; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        vec3 sky = mix(vec3(0.78, 0.84, 0.9), vec3(0.32, 0.5, 0.78), smoothstep(0.0, 0.7, d.y));
        vec3 ground = mix(vec3(0.42, 0.4, 0.3), vec3(0.3, 0.36, 0.22), smoothstep(0.0, -0.5, d.y));
        vec3 col = d.y > 0.0 ? sky : ground;
        col += vec3(1.0, 0.92, 0.75) * pow(max(dot(d, sun), 0.0), 24.0) * 1.5;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), mat));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(scene, 0.02).texture;
  pmrem.dispose();
  mat.dispose();
  return env;
}

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
  const sky = new THREE.Mesh(new THREE.SphereGeometry(8800, 32, 16), mat);
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
  // Dağlar kamerayı izler (gökyüzü gibi): dünyanın her yerinden aynı uzaklıkta, ufukta durur.
  ring(8600, 620, 1700, 0.22);
  ring(7000, 260, 900, 0.4);
  return group;
}
