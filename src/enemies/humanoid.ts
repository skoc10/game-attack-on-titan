import * as THREE from 'three';
import { lerp } from '../core/rng';
import { muscleTexture, skinTexture, toonGradient } from '../core/textures';

export type HairStyle = 'none' | 'short' | 'spiky' | 'long' | 'ponytail' | 'bob';
export type BodyStyle = 'human' | 'giant' | 'titan';

export interface Palette {
  skin: number;
  /** Üst giysi; devlerde ten rengiyle aynı verilir. */
  top: number;
  /** Kol rengi; verilmezse kollar çıplaktır (ten). */
  sleeve?: number;
  legs: number;
  boots?: number;
  hair?: number;
  hairStyle?: HairStyle;
  /** Ensedeki zayıf nokta işareti; verilmezse görünmez. */
  nape?: number;
  eye: number;
  /** Gözler ve çatlaklar parlasın (dev formu). */
  glow?: number;
}

export interface HumanoidOpts {
  style?: BodyStyle;
  bulk?: number;
  head?: number;
  arm?: number;
  armor?: boolean;
  /** Zırh plakalarının rengi. */
  plateColor?: number;
  cracks?: boolean;
  /** Kontur kalınlığı (birim boy cinsinden). */
  outline?: number;
  /** Dev yüzü: 0 sırıtan, 1 ağzı açık, 2 küçük ağızlı iri gözlü, 3 gözleri kısık gülen. */
  face?: number;
  /** Sarkık göbek (0 yok, 1 iri): bazı devler şişman, bazıları sıska doğar. */
  belly?: number;
  /** Kadın gövdesi: göğüs ve daha geniş kalça. */
  female?: boolean;
  /** Derisiz, kasları dışarıda gövde: lifli kas dokusu, belirgin kas kütleleri ve kirişler (yüz ve eller ten). */
  muscle?: boolean;
}

/** Ten malzemesi: insanlarda çizgi film gölgesi, devlerde yumuşak, gerçekçi deri. */
export type SkinMat = THREE.MeshToonMaterial | THREE.MeshStandardMaterial;

export interface Humanoid {
  root: THREE.Group;
  tilt: THREE.Group;
  head: THREE.Group;
  /** Alt çene: devlerde ağzı açmak için döner. */
  jaw: THREE.Group;
  /** Çenenin dinlenme açısı (ağzı açık yüzlerde 0'dan büyük). */
  jawRest: number;
  armL: THREE.Group;
  armR: THREE.Group;
  foreL: THREE.Group;
  foreR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  shinL: THREE.Group;
  shinR: THREE.Group;
  nape: THREE.Object3D;
  footL: THREE.Object3D;
  footR: THREE.Object3D;
  handL: THREE.Object3D;
  handR: THREE.Object3D;
  /** At kuyruğunun menteşesi (o saç biçimi yoksa null); hızla savrulması için döndürülür. */
  hairTail: THREE.Group | null;
  /** Saçın tamamı (kapşon giyilince gizlenir). */
  hair: THREE.Group;
  mats: THREE.Material[];
  skinMat: SkinMat;
  armMat: SkinMat;
  height: number;
}

/** Ortak parça geometrileri (hepsi yarıçap 1 olacak şekilde kurulu). */
export const GEO = {
  sphere: new THREE.SphereGeometry(1, 16, 12),
  /** Yarıçap 1, toplam boy 4. */
  capsule: new THREE.CapsuleGeometry(1, 2, 5, 12),
  /** Üstü geniş, altı dar gövde. */
  taper: new THREE.CylinderGeometry(1, 0.74, 1, 14),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(1, 1, 7),
  /** Saç için kafanın üst yarısını örten kabuk. */
  cap: new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.58),
};

/**
 * Kenar ışığı: bakış açısına teğet yüzeylerde ince, keskin kenarlı bir parlama.
 * Figürü arka plandan ayırır ve çizgi film gölgesine hacim katar.
 */
function addRim(shader: { fragmentShader: string }) {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <opaque_fragment>',
    `float rimF = 1.0 - saturate( dot( normalize( vViewPosition ), normal ) );
	outgoingLight += ( diffuseColor.rgb * 0.5 + vec3( 0.16 ) ) * smoothstep( 0.6, 0.74, rimF ) * 0.55;
	#include <opaque_fragment>`,
  );
}

/**
 * Deri için yumuşak kenar ışığı: ışığın derinin altından sızıyormuş gibi sıcak, geniş bir parıltı.
 * Çizgi film ışığının keskin kenarı yerine gövdeye hacim ve canlılık katar.
 */
function addSkinRim(shader: { fragmentShader: string }) {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <opaque_fragment>',
    `float rimF = 1.0 - saturate( dot( normalize( vViewPosition ), normal ) );
	outgoingLight += diffuseColor.rgb * vec3( 1.0, 0.78, 0.68 ) * smoothstep( 0.45, 1.0, rimF ) * 0.32;
	#include <opaque_fragment>`,
  );
}

/**
 * Çizgi film gölgelendirmeli, konturlu model kurucu.
 * Kontur, parçanın siyah ve içi dışına çevrilmiş hafif büyük bir kopyasıdır.
 */
export class Rig {
  readonly mats: THREE.Material[] = [];
  readonly outlineMat: THREE.MeshBasicMaterial;

  /** `soft`: deri ve kas malzemeleri gerçekçi (fiziksel) gölgelenir; dev gövdeleri için. */
  constructor(
    readonly thickness: number,
    readonly soft = false,
  ) {
    this.outlineMat = new THREE.MeshBasicMaterial({ color: 0x17120f, side: THREE.BackSide });
    this.mats.push(this.outlineMat);
  }

  toon(color: number) {
    const m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient() });
    m.onBeforeCompile = addRim;
    m.customProgramCacheKey = () => 'rim';
    this.mats.push(m);
    return m;
  }

  /** Ten/kas malzemesi: yumuşak kipte pürüzlü deri, değilse çizgi film. */
  surf(color: number, rough = 0.78): SkinMat {
    if (!this.soft) return this.toon(color);
    const tex = skinTexture();
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, map: tex, bumpMap: tex, bumpScale: 0.6, envMapIntensity: 0.55 });
    m.onBeforeCompile = addSkinRim;
    m.customProgramCacheKey = () => 'skinrim';
    this.mats.push(m);
    return m;
  }

  /** Çıplak kas: lifli doku, derin tümsek ve hafif ıslak parlaklık. */
  fiber(color: number): SkinMat {
    if (!this.soft) return this.toon(color);
    const tex = muscleTexture();
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0, map: tex, bumpMap: tex, bumpScale: 1.5, envMapIntensity: 0.75 });
    m.onBeforeCompile = addSkinRim;
    m.customProgramCacheKey = () => 'skinrim';
    this.mats.push(m);
    return m;
  }

  basic(color: number) {
    const m = new THREE.MeshBasicMaterial({ color });
    this.mats.push(m);
    return m;
  }

  part(
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    sx: number,
    sy: number,
    sz: number,
    x: number,
    y: number,
    z: number,
    outline = true,
  ) {
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    m.castShadow = outline;
    parent.add(m);
    if (outline && this.thickness > 0) {
      const o = new THREE.Mesh(geo, this.outlineMat);
      o.scale.set(1 + this.thickness / sx, 1 + this.thickness / sy, 1 + this.thickness / sz);
      m.add(o);
    }
    return m;
  }
}

const UP = new THREE.Vector3(0, 1, 0);
const shade = (c: number, k: number) => new THREE.Color(c).multiplyScalar(k).getHex();
const blend = (c: number, to: number, k: number) => new THREE.Color(c).lerp(new THREE.Color(to), k).getHex();

/** Dev yüzleri: göz ve ağız oranları, göz kapağı, kaş eğimi, çenenin dinlenme açısı. */
const FACES = [
  { eye: 1, mouth: 1, lid: 0.25, brow: 0.2, jaw: 0 },
  { eye: 1.2, mouth: 0.9, lid: 0, brow: -0.16, jaw: 0.5 },
  { eye: 1.45, mouth: 0.55, lid: 0, brow: 0, jaw: 0 },
  { eye: 0.9, mouth: 1.12, lid: 0.7, brow: -0.22, jaw: 0.12 },
];
const dirBuf = new THREE.Vector3();

/**
 * Eklemli insansı gövde. Birim boyda kurulur, root ölçeği = boy. İleri yön +Z.
 * Omuz/dirsek ve kalça/diz ayrı eklemlerdir; ense boynun arkasındadır.
 */
export function buildHumanoid(height: number, pal: Palette, o: HumanoidOpts = {}): Humanoid {
  const style = o.style ?? 'human';
  const B = o.bulk ?? 1;
  const sb = Math.sqrt(B);
  const hs = o.head ?? 1;
  const armK = o.arm ?? 1;
  const big = style !== 'human';
  // Dev gövdeleri yumuşak gölgeli deriyle ve ince konturla çizilir: daha gerçekçi, daha az çizgi film.
  const rig = new Rig((o.outline ?? 0.004) * (big ? 0.5 : 1), big);

  const flesh = big && o.muscle === true;
  const skinMat = rig.surf(pal.skin);
  const armMat = flesh ? rig.fiber(pal.sleeve ?? pal.top) : rig.surf(pal.sleeve ?? pal.skin);
  const topMat = flesh ? rig.fiber(pal.top) : rig.surf(pal.top);
  const legMat = flesh ? rig.fiber(pal.legs) : rig.surf(pal.legs);
  // Kirişler ve kasların arasındaki beyazımsı zar.
  const sinewMat = flesh ? rig.fiber(blend(pal.top, 0xf0d8c8, 0.55)) : null;
  const bootMat = pal.boots !== undefined ? rig.surf(pal.boots) : legMat;
  const darkMat = rig.surf(0x1a1210, 0.5);
  const whiteMat = rig.surf(0xf4efe6, 0.35);
  const glowMat = pal.glow !== undefined ? rig.basic(pal.glow) : null;
  // Kas ve yüz çizgileri için tenin koyu tonu; giysi dikişleri için kumaşın koyu tonu.
  const inkMat = rig.surf(shade(pal.skin, big ? 0.72 : 0.6));
  const trimMat = rig.surf(shade(pal.top, 0.68));
  const lipMat = rig.surf(blend(pal.skin, 0x9a3a34, 0.42), 0.45);

  const root = new THREE.Group();
  root.scale.setScalar(height);
  const tilt = new THREE.Group();
  root.add(tilt);

  // ---- Gövde (insanlar devlere göre daha dar omuzlu ve ince)
  const S = style === 'human' ? 0.84 : 1;
  rig.part(tilt, GEO.sphere, legMat, 0.105 * B * S, 0.065, 0.078 * B * S, 0, 0.515, 0);
  rig.part(tilt, GEO.taper, topMat, 0.128 * B * S, 0.25, 0.086 * B * S, 0, 0.655, 0);
  rig.part(tilt, GEO.sphere, topMat, 0.15 * B * S, 0.045, 0.082 * B * S, 0, 0.765, 0);
  if (B > 1.15) rig.part(tilt, GEO.sphere, topMat, 0.13 * B, 0.12, 0.105 * B, 0, 0.6, 0.03);
  if (o.belly && o.belly > 0) {
    // Sarkık göbek: karnın önünde aşağı doğru sarkan yumuşak bir kütle.
    const k = o.belly;
    rig.part(tilt, GEO.sphere, topMat, 0.1 * B * (1 + k * 0.25), 0.085 + k * 0.03, 0.06 * B + k * 0.05, 0, 0.575 - k * 0.012, 0.035 + k * 0.03, false);
  }
  rig.part(tilt, GEO.capsule, skinMat, 0.034, 0.02, 0.034, 0, 0.815, 0, false);
  if (big) {
    // Kas yapısı: göğüs, köprücük kemikleri, omuz üstü ve kürek kemikleri.
    for (const s of [-1, 1]) {
      rig.part(tilt, GEO.sphere, topMat, 0.064 * B, 0.046, 0.032 * B, s * 0.06 * B, 0.716, 0.058 * B, false);
      const clav = rig.part(tilt, GEO.box, inkMat, 0.07 * B, 0.005, 0.008, s * 0.062 * B, 0.772, 0.064 * B, false);
      clav.rotation.z = s * -0.14;
      rig.part(tilt, GEO.sphere, topMat, 0.056 * B, 0.03, 0.045, s * 0.07 * B, 0.796, -0.012, false);
      rig.part(tilt, GEO.sphere, topMat, 0.052 * B, 0.062, 0.022 * B, s * 0.058 * B, 0.712, -0.066 * B, false);
      rig.part(tilt, GEO.sphere, legMat, 0.058 * B, 0.058, 0.05 * B, s * 0.05 * B, 0.5, -0.04 * B, false); // kalça
    }
    rig.part(tilt, GEO.box, inkMat, 0.006, 0.24, 0.008, 0, 0.66, -0.079 * B, false); // omurga
    if (o.female) {
      for (const s of [-1, 1]) rig.part(tilt, GEO.sphere, topMat, 0.048 * B, 0.044, 0.04 * B, s * 0.046 * B, 0.716, 0.072 * B, false);
      rig.part(tilt, GEO.sphere, legMat, 0.128 * B, 0.07, 0.088 * B, 0, 0.51, -0.004, false); // geniş kalça
    }
    if (sinewMat) {
      // Çıplak kas: boyun kirişleri, göğüs kafesinin yanındaki dişli kaslar, karın kenarı ve sırt kasları.
      for (const s of [-1, 1]) {
        const neck = rig.part(tilt, GEO.capsule, topMat, 0.011, 0.03, 0.011, s * 0.022, 0.81, 0.02, false);
        neck.rotation.z = s * 0.35;
        for (let i = 0; i < 3; i++) rig.part(tilt, GEO.sphere, topMat, 0.016, 0.012, 0.014, s * 0.105 * B, 0.69 - i * 0.03, 0.04 * B, false);
        rig.part(tilt, GEO.box, sinewMat, 0.0035, 0.13, 0.006, s * 0.05 * B, 0.6, 0.074 * B, false); // karın kenarı
        rig.part(tilt, GEO.sphere, topMat, 0.04 * B, 0.1, 0.03 * B, s * 0.04 * B, 0.64, -0.07 * B, false); // sırt kası
      }
      rig.part(tilt, GEO.box, sinewMat, 0.004, 0.17, 0.007, 0, 0.62, 0.078 * B, false); // karın orta çizgisi
    }
    if (B <= 1.15) {
      // Karın kasları: orta çizgi ve iki yatay çizgi.
      rig.part(tilt, GEO.box, inkMat, 0.006, 0.15, 0.008, 0, 0.615, 0.077 * B, false);
      rig.part(tilt, GEO.box, inkMat, 0.082 * B, 0.005, 0.008, 0, 0.628, 0.076 * B, false);
      rig.part(tilt, GEO.box, inkMat, 0.076 * B, 0.005, 0.008, 0, 0.584, 0.073 * B, false);
      rig.part(tilt, GEO.sphere, inkMat, 0.006, 0.006, 0.004, 0, 0.548, 0.07 * B, false); // göbek
    } else {
      rig.part(tilt, GEO.sphere, inkMat, 0.008, 0.008, 0.005, 0, 0.56, 0.132 * B, false);
    }
  } else {
    // Giysi ayrıntıları: yaka, ceket eteği, ön dikiş ve omuz dikişleri.
    rig.part(tilt, GEO.taper, trimMat, 0.05, 0.034, 0.046, 0, 0.802, 0, false);
    rig.part(tilt, GEO.taper, topMat, 0.118 * S, 0.06, 0.086 * S, 0, 0.548, 0);
    rig.part(tilt, GEO.box, trimMat, 0.007, 0.21, 0.006, 0, 0.665, 0.074 * S, false);
    rig.part(tilt, GEO.box, trimMat, 0.2 * S, 0.008, 0.012, 0, 0.523, 0.062 * S, false);
    for (const s of [-1, 1]) {
      rig.part(tilt, GEO.box, trimMat, 0.006, 0.05, 0.11 * S, s * 0.118 * S, 0.755, 0, false);
      rig.part(tilt, GEO.box, trimMat, 0.03, 0.026, 0.006, s * 0.045, 0.715, 0.071 * S, false); // göğüs cebi
    }
  }

  // ---- Baş
  const head = new THREE.Group();
  head.position.set(0, 0.835, 0);
  head.scale.setScalar(hs);
  tilt.add(head);
  rig.part(head, GEO.sphere, skinMat, 0.07, 0.082, 0.076, 0, 0.078, 0);
  for (const s of [-1, 1]) {
    rig.part(head, GEO.sphere, skinMat, 0.011, big ? 0.026 : 0.02, 0.014, s * 0.071, 0.078, -0.004, false);
    rig.part(head, GEO.sphere, inkMat, 0.005, 0.012, 0.008, s * 0.077, 0.078, -0.002, false);
  }

  const jaw = new THREE.Group();
  jaw.position.set(0, 0.05, 0);
  head.add(jaw);
  const F = FACES[Math.max(0, Math.min(FACES.length - 1, Math.floor(o.face ?? 0)))];
  let jawRest = 0;

  // Dişli ağız: boşluk, üst ve alt dişler, dişleri ayıran çizgiler. `w` ağız genişliği oranıdır.
  const teeth = (w: number) => {
    rig.part(head, GEO.box, darkMat, 0.084 * w, 0.034, 0.02, 0, 0.036, 0.056, false);
    rig.part(head, GEO.box, lipMat, 0.088 * w, 0.006, 0.014, 0, 0.0605, 0.064, false); // üst diş eti
    rig.part(head, GEO.box, whiteMat, 0.08 * w, 0.009, 0.012, 0, 0.0545, 0.066, false);
    rig.part(jaw, GEO.sphere, skinMat, 0.058, 0.03, 0.062, 0, -0.03, 0.012, false);
    rig.part(jaw, GEO.box, whiteMat, 0.07 * w, 0.007, 0.01, 0, -0.003, 0.064, false);
    for (const tx of [-0.027, -0.009, 0.009, 0.027]) {
      rig.part(head, GEO.box, darkMat, 0.0018, 0.009, 0.004, tx * w, 0.0545, 0.0722, false);
      rig.part(jaw, GEO.box, darkMat, 0.0018, 0.007, 0.004, tx * w, -0.003, 0.0692, false);
    }
  };
  if (style === 'giant') {
    // İri, boş bakan gözler; yüz tipine göre göz kapağı, kaş ve ağız değişir.
    jawRest = F.jaw;
    for (const s of [-1, 1]) {
      rig.part(head, GEO.sphere, inkMat, 0.026 * F.eye, 0.025 * F.eye, 0.008, s * 0.031, 0.09, 0.063, false); // göz çukuru
      rig.part(head, GEO.sphere, whiteMat, 0.02 * F.eye, 0.02 * F.eye, 0.008, s * 0.031, 0.09, 0.065, false);
      rig.part(head, GEO.sphere, darkMat, 0.0065, 0.0065, 0.005, s * 0.031, 0.09, 0.0715, false);
      if (F.lid > 0) rig.part(head, GEO.sphere, skinMat, 0.023 * F.eye, 0.02 * F.eye * F.lid, 0.011, s * 0.031, 0.09 + 0.02 * F.eye * (1 - F.lid * 0.6), 0.066, false);
      const brow = rig.part(head, GEO.box, inkMat, 0.034, 0.007, 0.01, s * 0.032, 0.09 + 0.026 * F.eye, 0.064, false);
      brow.rotation.z = s * -F.brow;
      rig.part(head, GEO.sphere, skinMat, 0.02, 0.015, 0.012, s * 0.047, 0.06, 0.054, false); // elmacık kemiği
    }
    rig.part(head, GEO.sphere, skinMat, 0.013, 0.017, 0.013, 0, 0.07, 0.074, false); // burun
    rig.part(head, GEO.box, inkMat, 0.016, 0.003, 0.004, 0, 0.0605, 0.0775, false);
    teeth(F.mouth);
  } else {
    rig.part(head, GEO.sphere, skinMat, 0.05, 0.04, 0.055, 0, 0.032, 0.012, false); // çene
    // Burun: kemer, uç ve altındaki gölge.
    rig.part(head, GEO.box, skinMat, 0.008, 0.03, 0.01, 0, 0.073, 0.073, false);
    rig.part(head, GEO.sphere, skinMat, 0.0095, 0.008, 0.01, 0, 0.058, 0.0785, false);
    rig.part(head, GEO.box, inkMat, 0.012, 0.0022, 0.004, 0, 0.0515, 0.0755, false);
    const irisMat = glowMat ?? rig.toon(pal.eye);
    // İnsanlarda kaş saç renginin koyusudur; yanaklarda hafif bir pembelik olur.
    const browMat = !big && pal.hair !== undefined ? rig.toon(shade(pal.hair, 0.62)) : darkMat;
    const blushMat = big ? null : rig.toon(blend(pal.skin, 0xe0705e, 0.3));
    for (const s of [-1, 1]) {
      // Gerçeğe yakın oranlarda göz: ak, iris, gözbebeği, parıltı, üst kirpik çizgisi.
      rig.part(head, GEO.sphere, glowMat ?? whiteMat, 0.0145, 0.0105, 0.005, s * 0.029, 0.084, 0.0675, false);
      if (!glowMat) {
        rig.part(head, GEO.sphere, irisMat, 0.0078, 0.0088, 0.004, s * 0.029, 0.084, 0.0708, false);
        rig.part(head, GEO.sphere, darkMat, 0.0036, 0.0042, 0.003, s * 0.029, 0.084, 0.0732, false);
        rig.part(head, GEO.sphere, whiteMat, 0.002, 0.002, 0.002, s * 0.029 + 0.003, 0.0872, 0.0748, false);
      }
      const lash = rig.part(head, GEO.box, darkMat, 0.031, 0.0036, 0.006, s * 0.029, 0.0945, 0.0685, false);
      lash.rotation.z = s * -0.08;
      const brow = rig.part(head, GEO.box, browMat, 0.03, 0.0055, 0.007, s * 0.03, 0.106, 0.069, false);
      brow.rotation.z = s * (big ? 0.3 : -0.12);
      if (blushMat) rig.part(head, GEO.sphere, blushMat, 0.013, 0.0075, 0.004, s * 0.042, 0.063, 0.0625, false);
      if (!big) rig.part(head, GEO.box, skinMat, 0.03, 0.0045, 0.006, s * 0.029, 0.0985, 0.0672, false); // üst göz kapağı
      if (big) rig.part(head, GEO.sphere, skinMat, 0.016, 0.012, 0.01, s * 0.043, 0.06, 0.056, false); // elmacık kemiği
    }
    if (style === 'titan') {
      teeth(0.9); // dev formları dişlerini gösterir
    } else {
      rig.part(head, GEO.box, lipMat, 0.025, 0.0042, 0.005, 0, 0.0405, 0.0715, false); // üst dudak
      rig.part(head, GEO.box, lipMat, 0.018, 0.0042, 0.005, 0, 0.0358, 0.071, false); // alt dudak
      rig.part(head, GEO.box, inkMat, 0.014, 0.002, 0.004, 0, 0.029, 0.069, false); // çene çukuru
    }
  }

  // ---- Saç
  const hairStyle = pal.hair !== undefined ? (pal.hairStyle ?? 'short') : 'none';
  let hairTail: THREE.Group | null = null;
  // Saçın tüm parçaları tek grupta: kapşon takılınca birlikte gizlenir.
  const hairRoot = new THREE.Group();
  head.add(hairRoot);
  if (hairStyle !== 'none' && pal.hair !== undefined) {
    const hairMat = rig.toon(pal.hair);
    const cap = rig.part(hairRoot, GEO.cap, hairMat, 0.076, 0.088, 0.084, 0, 0.08, -0.004);
    cap.rotation.x = -0.36;
    // Arka hacim ve favoriler: saç kafaya yapışık bir kabuk gibi görünmesin.
    rig.part(hairRoot, GEO.sphere, hairMat, 0.071, 0.066, 0.05, 0, 0.082, -0.036, false);
    for (const s of [-1, 1]) rig.part(hairRoot, GEO.box, hairMat, 0.009, 0.04, 0.024, s * 0.069, 0.074, 0.018, false);
    if (style !== 'giant') {
      // Perçem
      for (const [bx, len] of [[-0.036, 0.05], [-0.012, 0.062], [0.014, 0.055], [0.038, 0.046]]) {
        const bang = rig.part(hairRoot, GEO.cone, hairMat, 0.018, len, 0.011, bx, 0.128 - len / 2, 0.066, false);
        bang.rotation.x = Math.PI - 0.12;
        bang.rotation.z = bx * 3;
      }
    }
    if (hairStyle === 'spiky') {
      const dirs: [number, number, number, number][] = [
        [0, 0.95, -0.3, 0.07],
        [0.5, 0.82, -0.25, 0.06],
        [-0.5, 0.82, -0.25, 0.06],
        [0, 0.55, -0.83, 0.075],
        [0.6, 0.45, -0.66, 0.065],
        [-0.6, 0.45, -0.66, 0.065],
        [0.85, 0.3, -0.3, 0.05],
        [-0.85, 0.3, -0.3, 0.05],
        [0, 0.1, -1, 0.06],
        [0.3, 0.9, 0.3, 0.045],
        [-0.3, 0.9, 0.3, 0.045],
      ];
      for (const [dx, dy, dz, len] of dirs) {
        dirBuf.set(dx, dy, dz).normalize();
        const spike = rig.part(hairRoot, GEO.cone, hairMat, 0.024, len, 0.024, dirBuf.x * 0.07, 0.08 + dirBuf.y * 0.08, -0.004 + dirBuf.z * 0.074, false);
        spike.quaternion.setFromUnitVectors(UP, dirBuf);
      }
    } else if (hairStyle === 'long') {
      rig.part(hairRoot, GEO.capsule, hairMat, 0.066, 0.044, 0.026, 0, 0.0, -0.058);
      rig.part(hairRoot, GEO.capsule, hairMat, 0.05, 0.03, 0.02, 0, -0.07, -0.062, false); // uca doğru incelir
      for (const s of [-1, 1]) {
        const lock = rig.part(hairRoot, GEO.cone, hairMat, 0.016, 0.09, 0.014, s * 0.066, 0.03, 0.03, false);
        lock.rotation.x = Math.PI;
      }
    } else if (hairStyle === 'ponytail') {
      // At kuyruğu: tepede bağ, ondan sarkan ve uca doğru incelen iki boğum. Menteşeli: koşarken savrulur.
      const tieMat = rig.toon(shade(pal.top, 1.25));
      rig.part(hairRoot, GEO.sphere, tieMat, 0.019, 0.016, 0.019, 0, 0.118, -0.07, false);
      hairTail = new THREE.Group();
      hairTail.position.set(0, 0.116, -0.076);
      hairRoot.add(hairTail);
      rig.part(hairTail, GEO.capsule, hairMat, 0.027, 0.03, 0.024, 0, -0.058, -0.012);
      const tip = rig.part(hairTail, GEO.cone, hairMat, 0.024, 0.11, 0.021, 0, -0.165, -0.016, false);
      tip.rotation.x = Math.PI;
      for (const s of [-1, 1]) {
        const lock = rig.part(hairRoot, GEO.cone, hairMat, 0.012, 0.07, 0.011, s * 0.067, 0.045, 0.034, false);
        lock.rotation.x = Math.PI;
      }
    } else if (hairStyle === 'bob') {
      // Küt kesim: ense hizasında biten arka perde ve çene hizasına inen yan tutamlar.
      rig.part(hairRoot, GEO.capsule, hairMat, 0.07, 0.026, 0.03, 0, 0.034, -0.05);
      for (const s of [-1, 1]) {
        rig.part(hairRoot, GEO.capsule, hairMat, 0.017, 0.022, 0.034, s * 0.066, 0.046, 0.004, false);
        const tipLock = rig.part(hairRoot, GEO.cone, hairMat, 0.015, 0.04, 0.02, s * 0.064, -0.002, 0.03, false);
        tipLock.rotation.x = Math.PI;
      }
    }
  }

  // ---- Ense (zayıf nokta)
  let nape: THREE.Object3D;
  if (pal.nape !== undefined) {
    nape = rig.part(tilt, GEO.box, rig.toon(pal.nape), 0.07, 0.056, 0.02, 0, 0.803, -0.036 - 0.012 * B, false);
  } else {
    nape = new THREE.Object3D();
    nape.position.set(0, 0.803, -0.04);
    tilt.add(nape);
  }

  // ---- Kollar: omuz → dirsek → el
  const Lu = 0.2 * armK;
  const Lf = 0.19 * armK;
  const ru = 0.036 * sb;
  const rf = 0.03 * sb;
  const mkArm = (s: number) => {
    const g = new THREE.Group();
    g.position.set(s * (0.15 * B * S + 0.026), 0.77, 0);
    tilt.add(g);
    rig.part(g, GEO.capsule, armMat, ru, Lu / 4, ru, 0, -Lu / 2, 0);
    const delt = big ? 1.38 : 1.1;
    rig.part(g, GEO.sphere, armMat, ru * delt, ru * delt, ru * delt, s * 0.004, -0.006, 0, false); // omuz kası
    if (big) rig.part(g, GEO.sphere, armMat, ru * 1.12, Lu * 0.3, ru * 1.15, 0, -Lu * 0.45, ru * 0.3, false); // pazı
    if (sinewMat) {
      rig.part(g, GEO.sphere, armMat, ru * 1.05, Lu * 0.32, ru, 0, -Lu * 0.5, -ru * 0.35, false); // arka kol
      rig.part(g, GEO.box, sinewMat, ru * 0.25, Lu * 0.24, ru * 0.25, 0, -Lu * 0.86, ru * 0.75, false); // dirsek kirişi
    }
    const fore = new THREE.Group();
    fore.position.set(0, -Lu, 0);
    g.add(fore);
    rig.part(fore, GEO.sphere, armMat, rf * 1.14, rf * 1.14, rf * 1.14, 0, 0, 0, false); // dirsek
    rig.part(fore, GEO.capsule, armMat, rf, Lf / 4, rf, 0, -Lf / 2, 0);
    if (sinewMat) {
      rig.part(fore, GEO.sphere, armMat, rf * 1.15, Lf * 0.26, rf * 1.1, s * rf * 0.2, -Lf * 0.3, 0, false); // ön kol kası
      rig.part(fore, GEO.box, sinewMat, rf * 0.18, Lf * 0.36, rf * 0.22, 0, -Lf * 0.72, rf * 0.82, false); // bilek kirişleri
    }
    if (!big) rig.part(fore, GEO.taper, trimMat, rf * 1.18, 0.022, rf * 1.18, 0, -Lf + 0.012, 0, false); // kol ağzı
    // El: avuç, hafif kıvrık parmaklar ve başparmak.
    const handMat = pal.sleeve !== undefined ? skinMat : armMat;
    rig.part(fore, GEO.sphere, handMat, 0.028 * sb, 0.03 * sb, 0.02 * sb, 0, -Lf - 0.012, 0);
    const fingers = rig.part(fore, GEO.capsule, handMat, 0.024 * sb, 0.0115 * sb, 0.0125 * sb, 0, -Lf - 0.05 * sb, 0.006, false);
    fingers.rotation.x = 0.4;
    for (const fx of [-0.008, 0.008]) rig.part(fingers, GEO.box, inkMat, 0.05, 1.6, 0.4, fx / (0.024 * sb), -0.4, 0.75, false);
    const thumb = rig.part(fore, GEO.capsule, handMat, 0.0095 * sb, 0.008 * sb, 0.0095 * sb, s * -0.006, -Lf - 0.024 * sb, 0.026 * sb, false);
    thumb.rotation.x = -0.7;
    const hand = new THREE.Object3D();
    hand.position.set(0, -Lf - 0.02, 0);
    fore.add(hand);
    return { g, fore, hand };
  };
  const aL = mkArm(-1);
  const aR = mkArm(1);

  // ---- Bacaklar: kalça → diz → ayak
  const Lt = 0.245;
  const Ls = 0.215;
  const rt = 0.05 * sb;
  const rs = 0.04 * sb;
  const mkLeg = (s: number) => {
    const g = new THREE.Group();
    g.position.set(s * 0.058 * B, 0.5, 0);
    tilt.add(g);
    rig.part(g, GEO.capsule, legMat, rt, Lt / 4, rt, 0, -Lt / 2, 0);
    if (sinewMat) {
      rig.part(g, GEO.sphere, legMat, rt * 0.95, Lt * 0.32, rt * 0.9, 0, -Lt * 0.5, rt * 0.4, false); // ön uyluk
      rig.part(g, GEO.sphere, legMat, rt * 0.7, Lt * 0.3, rt * 0.75, -s * rt * 0.45, -Lt * 0.42, 0, false); // iç uyluk
      rig.part(g, GEO.box, sinewMat, rt * 0.3, Lt * 0.16, rt * 0.3, 0, -Lt * 0.9, rt * 0.85, false); // diz kirişi
    }
    const shin = new THREE.Group();
    shin.position.set(0, -Lt, 0);
    g.add(shin);
    rig.part(shin, GEO.sphere, legMat, rs * 1.16, rs * 1.16, rs * 1.2, 0, 0, rs * 0.12, false); // diz kapağı
    rig.part(shin, GEO.capsule, bootMat, rs, Ls / 4, rs, 0, -Ls / 2, 0);
    rig.part(shin, GEO.sphere, bootMat, 0.04 * sb, 0.022, 0.07 * sb, 0, -Ls - 0.012, 0.026);
    if (big) {
      rig.part(shin, GEO.sphere, bootMat, rs * 1.1, Ls * 0.3, rs * 1.12, 0, -Ls * 0.36, -rs * 0.32, false); // baldır
      if (sinewMat) rig.part(shin, GEO.box, sinewMat, rs * 0.3, Ls * 0.5, rs * 0.3, 0, -Ls * 0.55, -rs * 0.9, false); // topuk kirişi
      rig.part(shin, GEO.sphere, bootMat, 0.044 * sb, 0.015, 0.024 * sb, 0, -Ls - 0.017, 0.088 * sb, false); // parmaklar
      for (const tx of [-0.014, 0, 0.014]) rig.part(shin, GEO.box, inkMat, 0.0025, 0.012, 0.03 * sb, tx * sb, -Ls - 0.012, 0.094 * sb, false);
    } else {
      // Çizme: koncu, tabanı ve burnu.
      rig.part(shin, GEO.taper, trimMat, rs * 1.24, 0.034, rs * 1.24, 0, -0.03, 0, false);
      rig.part(shin, GEO.box, darkMat, 0.07 * sb, 0.01, 0.13 * sb, 0, -Ls - 0.031, 0.026, false);
    }
    const foot = new THREE.Object3D();
    foot.position.set(0, -0.145, 0);
    shin.add(foot);
    return { g, shin, foot };
  };
  const lL = mkLeg(-1);
  const lR = mkLeg(1);

  if (o.armor) {
    // Zırh: kemik gibi sert, hafif parlak plakalar (yumuşak kipte deriden daha pürüzsüz).
    const plate = big ? rig.surf(o.plateColor ?? 0x8f8a80, 0.42) : rig.toon(o.plateColor ?? 0xa3a8b0);
    rig.part(tilt, GEO.box, plate, 0.13, 0.1, 0.03, 0, 0.803, -0.05 - 0.012 * B);
    rig.part(tilt, GEO.sphere, plate, 0.11 * B, 0.1, 0.03, 0, 0.68, 0.078 * B);
    for (const a of [aL, aR]) {
      rig.part(a.g, GEO.sphere, plate, 0.062 * sb, 0.04, 0.062 * sb, 0, 0.008, 0);
      rig.part(a.fore, GEO.capsule, plate, rf * 1.3, Lf / 6, rf * 1.3, 0, -Lf / 2, 0);
    }
    for (const l of [lL, lR]) rig.part(l.shin, GEO.capsule, plate, rs * 1.3, Ls / 6, rs * 1.3, 0, -Ls / 2, 0.006);
  }

  if (o.cracks && glowMat) {
    // Dev formunun kor rengi çatlakları
    rig.part(tilt, GEO.box, glowMat, 0.012, 0.2, 0.03, -0.05 * B, 0.66, 0.066 * B, false);
    rig.part(tilt, GEO.box, glowMat, 0.012, 0.14, 0.03, 0.06 * B, 0.62, 0.062 * B, false);
    rig.part(tilt, GEO.box, glowMat, 0.1 * B, 0.012, 0.03, 0.01, 0.7, 0.072 * B, false);
    for (const a of [aL, aR]) rig.part(a.fore, GEO.box, glowMat, 0.01, Lf * 0.7, 0.014, 0, -Lf / 2, rf * 0.95, false);
    for (const l of [lL, lR]) rig.part(l.g, GEO.box, glowMat, 0.01, Lt * 0.7, 0.014, 0.01, -Lt / 2, rt * 0.95, false);
  }

  return {
    root,
    tilt,
    head,
    jaw,
    jawRest,
    armL: aL.g,
    armR: aR.g,
    foreL: aL.fore,
    foreR: aR.fore,
    legL: lL.g,
    legR: lR.g,
    shinL: lL.shin,
    shinR: lR.shin,
    nape,
    footL: lL.foot,
    footR: lR.foot,
    handL: aL.hand,
    handR: aR.hand,
    hairTail,
    hair: hairRoot,
    mats: rig.mats,
    skinMat,
    armMat,
    height,
  };
}

export interface BendOverride {
  elbowL?: number;
  elbowR?: number;
  kneeL?: number;
  kneeR?: number;
}

/**
 * Dirsek ve dizleri, omuz/kalça açılarından doğal görünecek şekilde büker.
 * Bacak geriye giderken diz kırılır; kol kalktıkça dirsek hafifçe bükülür.
 */
export function autoBend(h: Humanoid, k: number, o: BendOverride = {}) {
  const knee = (r: number) => 0.06 + Math.max(0, r) * 1.1 + Math.max(0, -r) * 0.3;
  const elbow = (r: number) => -(0.18 + Math.min(1.2, Math.abs(r)) * 0.35);
  h.shinL.rotation.x = lerp(h.shinL.rotation.x, o.kneeL ?? knee(h.legL.rotation.x), k);
  h.shinR.rotation.x = lerp(h.shinR.rotation.x, o.kneeR ?? knee(h.legR.rotation.x), k);
  h.foreL.rotation.x = lerp(h.foreL.rotation.x, o.elbowL ?? elbow(h.armL.rotation.x), k);
  h.foreR.rotation.x = lerp(h.foreR.rotation.x, o.elbowR ?? elbow(h.armR.rotation.x), k);
}

export function disposeHumanoid(h: Humanoid) {
  for (const m of h.mats) m.dispose();
}
