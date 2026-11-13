import * as THREE from 'three';
import { lerp } from '../core/rng';
import { toonGradient } from '../core/textures';

export type HairStyle = 'none' | 'short' | 'spiky' | 'long';
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
}

export interface Humanoid {
  root: THREE.Group;
  tilt: THREE.Group;
  head: THREE.Group;
  /** Alt çene: devlerde ağzı açmak için döner. */
  jaw: THREE.Group;
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
  mats: THREE.Material[];
  skinMat: THREE.MeshToonMaterial;
  armMat: THREE.MeshToonMaterial;
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
 * Çizgi film gölgelendirmeli, konturlu model kurucu.
 * Kontur, parçanın siyah ve içi dışına çevrilmiş hafif büyük bir kopyasıdır.
 */
export class Rig {
  readonly mats: THREE.Material[] = [];
  readonly outlineMat: THREE.MeshBasicMaterial;

  constructor(readonly thickness: number) {
    this.outlineMat = new THREE.MeshBasicMaterial({ color: 0x17120f, side: THREE.BackSide });
    this.mats.push(this.outlineMat);
  }

  toon(color: number) {
    const m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient() });
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
  const rig = new Rig(o.outline ?? 0.004);

  const skinMat = rig.toon(pal.skin);
  const armMat = rig.toon(pal.sleeve ?? pal.skin);
  const topMat = rig.toon(pal.top);
  const legMat = rig.toon(pal.legs);
  const bootMat = pal.boots !== undefined ? rig.toon(pal.boots) : legMat;
  const darkMat = rig.toon(0x1a1210);
  const whiteMat = rig.toon(0xf4efe6);
  const glowMat = pal.glow !== undefined ? rig.basic(pal.glow) : null;

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
  rig.part(tilt, GEO.capsule, skinMat, 0.034, 0.02, 0.034, 0, 0.815, 0, false);

  // ---- Baş
  const head = new THREE.Group();
  head.position.set(0, 0.835, 0);
  head.scale.setScalar(hs);
  tilt.add(head);
  rig.part(head, GEO.sphere, skinMat, 0.07, 0.082, 0.076, 0, 0.078, 0);
  for (const s of [-1, 1]) rig.part(head, GEO.sphere, skinMat, 0.012, 0.02, 0.012, s * 0.07, 0.075, -0.004, false);

  const jaw = new THREE.Group();
  jaw.position.set(0, 0.05, 0);
  head.add(jaw);

  if (style === 'giant') {
    // İri, boş bakan gözler ve dişleri görünen sabit bir sırıtış.
    for (const s of [-1, 1]) {
      rig.part(head, GEO.sphere, whiteMat, 0.02, 0.02, 0.008, s * 0.031, 0.09, 0.065, false);
      rig.part(head, GEO.sphere, darkMat, 0.0065, 0.0065, 0.005, s * 0.031, 0.09, 0.0715, false);
    }
    rig.part(head, GEO.box, darkMat, 0.084, 0.034, 0.02, 0, 0.036, 0.056, false); // ağız boşluğu
    rig.part(head, GEO.box, whiteMat, 0.08, 0.009, 0.012, 0, 0.0545, 0.066, false); // üst dişler
    rig.part(jaw, GEO.sphere, skinMat, 0.058, 0.03, 0.062, 0, -0.03, 0.012, false);
    rig.part(jaw, GEO.box, whiteMat, 0.07, 0.007, 0.01, 0, -0.003, 0.064, false); // alt dişler
  } else {
    rig.part(head, GEO.sphere, skinMat, 0.05, 0.04, 0.055, 0, 0.032, 0.012, false); // çene
    rig.part(head, GEO.sphere, skinMat, 0.006, 0.01, 0.008, 0, 0.06, 0.077, false); // burun
    const irisMat = glowMat ?? rig.toon(pal.eye);
    for (const s of [-1, 1]) {
      // Anime tarzı iri gözler: ak, iris, gözbebeği, parıltı.
      rig.part(head, GEO.sphere, glowMat ?? whiteMat, 0.017, 0.019, 0.006, s * 0.03, 0.082, 0.067, false);
      if (!glowMat) {
        rig.part(head, GEO.sphere, irisMat, 0.011, 0.0145, 0.005, s * 0.03, 0.081, 0.0705, false);
        rig.part(head, GEO.sphere, darkMat, 0.005, 0.0075, 0.004, s * 0.03, 0.081, 0.0738, false);
        rig.part(head, GEO.sphere, whiteMat, 0.003, 0.003, 0.003, s * 0.03 + 0.004, 0.087, 0.0755, false);
      }
      const brow = rig.part(head, GEO.box, darkMat, 0.026, 0.005, 0.006, s * 0.03, 0.107, 0.07, false);
      brow.rotation.z = s * -0.16;
    }
    rig.part(head, GEO.box, darkMat, 0.022, 0.004, 0.004, 0, 0.038, 0.071, false); // ağız
  }

  // ---- Saç
  const hairStyle = pal.hair !== undefined ? (pal.hairStyle ?? 'short') : 'none';
  if (hairStyle !== 'none' && pal.hair !== undefined) {
    const hairMat = rig.toon(pal.hair);
    const cap = rig.part(head, GEO.cap, hairMat, 0.076, 0.088, 0.084, 0, 0.08, -0.004);
    cap.rotation.x = -0.36;
    if (style !== 'giant') {
      // Perçem
      for (const [bx, len] of [[-0.036, 0.05], [-0.012, 0.062], [0.014, 0.055], [0.038, 0.046]]) {
        const bang = rig.part(head, GEO.cone, hairMat, 0.018, len, 0.011, bx, 0.128 - len / 2, 0.066, false);
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
        const spike = rig.part(head, GEO.cone, hairMat, 0.024, len, 0.024, dirBuf.x * 0.07, 0.08 + dirBuf.y * 0.08, -0.004 + dirBuf.z * 0.074, false);
        spike.quaternion.setFromUnitVectors(UP, dirBuf);
      }
    } else if (hairStyle === 'long') {
      rig.part(head, GEO.capsule, hairMat, 0.066, 0.036, 0.026, 0, 0.012, -0.058);
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
    const fore = new THREE.Group();
    fore.position.set(0, -Lu, 0);
    g.add(fore);
    rig.part(fore, GEO.capsule, armMat, rf, Lf / 4, rf, 0, -Lf / 2, 0);
    rig.part(fore, GEO.sphere, pal.sleeve !== undefined ? skinMat : armMat, 0.03 * sb, 0.036 * sb, 0.026 * sb, 0, -Lf - 0.014, 0);
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
    const shin = new THREE.Group();
    shin.position.set(0, -Lt, 0);
    g.add(shin);
    rig.part(shin, GEO.capsule, bootMat, rs, Ls / 4, rs, 0, -Ls / 2, 0);
    rig.part(shin, GEO.sphere, bootMat, 0.04 * sb, 0.022, 0.07 * sb, 0, -Ls - 0.012, 0.026);
    const foot = new THREE.Object3D();
    foot.position.set(0, -0.145, 0);
    shin.add(foot);
    return { g, shin, foot };
  };
  const lL = mkLeg(-1);
  const lR = mkLeg(1);

  if (o.armor) {
    const plate = rig.toon(o.plateColor ?? 0xa3a8b0);
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
