import * as THREE from 'three';

export interface Palette {
  skin: number;
  torso: number;
  legs: number;
  hair: number | null;
  nape: number;
  eye: number;
  /** Gözler/çatlaklar parlasın mı (dev formu). */
  glow?: number;
}

export interface HumanoidOpts {
  bulk?: number;
  head?: number;
  arm?: number;
  armor?: boolean;
  cracks?: boolean;
}

export interface Humanoid {
  root: THREE.Group;
  tilt: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  nape: THREE.Object3D;
  footL: THREE.Object3D;
  footR: THREE.Object3D;
  handL: THREE.Object3D;
  handR: THREE.Object3D;
  mats: THREE.Material[];
  skinMat: THREE.MeshLambertMaterial;
  armMat: THREE.MeshLambertMaterial;
  height: number;
}

const BOX = new THREE.BoxGeometry(1, 1, 1);

function box(parent: THREE.Object3D, mat: THREE.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number) {
  const m = new THREE.Mesh(BOX, mat);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/**
 * Kutulardan oluşan insansı gövde. Birim yükseklikte kurulur, root ölçeği = boy.
 * İleri yön +Z; ense (zayıf nokta) boynun arkasında.
 */
export function buildHumanoid(height: number, pal: Palette, o: HumanoidOpts = {}): Humanoid {
  const bulk = o.bulk ?? 1;
  const hs = o.head ?? 1;
  const armLen = 0.42 * (o.arm ?? 1);
  const L = (c: number) => new THREE.MeshLambertMaterial({ color: c });
  const skinMat = L(pal.skin);
  const armMat = L(pal.skin);
  const torsoMat = L(pal.torso);
  const legMat = L(pal.legs);
  const darkMat: THREE.Material = pal.glow !== undefined ? new THREE.MeshBasicMaterial({ color: pal.glow }) : L(pal.eye);
  const napeMat = L(pal.nape);
  const mats: THREE.Material[] = [skinMat, armMat, torsoMat, legMat, darkMat, napeMat];

  const root = new THREE.Group();
  root.scale.setScalar(height);
  const tilt = new THREE.Group();
  root.add(tilt);

  // Gövde
  box(tilt, torsoMat, 0.3 * bulk, 0.33, 0.17 * bulk, 0, 0.635, 0);
  if (bulk > 1.15) box(tilt, torsoMat, 0.28 * bulk, 0.16, 0.2 * bulk, 0, 0.56, 0.04);
  box(tilt, skinMat, 0.09, 0.05, 0.09, 0, 0.815, 0);

  // Baş
  const head = new THREE.Group();
  head.position.set(0, 0.84, 0);
  tilt.add(head);
  box(head, skinMat, 0.15 * hs, 0.16 * hs, 0.16 * hs, 0, 0.08 * hs, 0);
  box(head, darkMat, 0.03 * hs, 0.022 * hs, 0.01, -0.036 * hs, 0.1 * hs, 0.081 * hs);
  box(head, darkMat, 0.03 * hs, 0.022 * hs, 0.01, 0.036 * hs, 0.1 * hs, 0.081 * hs);
  box(head, darkMat, 0.1 * hs, 0.018 * hs, 0.01, 0, 0.04 * hs, 0.081 * hs);
  if (pal.hair !== null) {
    const hairMat = L(pal.hair);
    mats.push(hairMat);
    box(head, hairMat, 0.16 * hs, 0.05 * hs, 0.17 * hs, 0, 0.165 * hs, -0.005);
    box(head, hairMat, 0.16 * hs, 0.1 * hs, 0.03, 0, 0.12 * hs, -0.085 * hs);
  }

  // Ense: zayıf nokta işareti
  const nape = box(tilt, napeMat, 0.085, 0.07, 0.03, 0, 0.8, -0.055 - 0.035 * bulk);

  // Kollar
  const mkArm = (sx: number) => {
    const g = new THREE.Group();
    g.position.set(sx * (0.15 * bulk + 0.045), 0.775, 0);
    tilt.add(g);
    box(g, armMat, 0.075, armLen, 0.085, 0, -armLen / 2, 0);
    const hand = new THREE.Object3D();
    hand.position.set(0, -armLen, 0);
    g.add(hand);
    return { g, hand };
  };
  const aL = mkArm(-1);
  const aR = mkArm(1);

  // Bacaklar
  const mkLeg = (sx: number) => {
    const g = new THREE.Group();
    g.position.set(sx * 0.085 * bulk, 0.47, 0);
    tilt.add(g);
    box(g, legMat, 0.11 * bulk, 0.47, 0.12 * bulk, 0, -0.235, 0);
    const foot = new THREE.Object3D();
    foot.position.set(0, -0.36, 0);
    g.add(foot);
    return { g, foot };
  };
  const lL = mkLeg(-1);
  const lR = mkLeg(1);

  if (o.armor) {
    const plate = L(0x8c8f96);
    mats.push(plate);
    box(tilt, plate, 0.14, 0.11, 0.04, 0, 0.8, -0.075 - 0.035 * bulk);
    box(tilt, plate, 0.36 * bulk, 0.07, 0.2 * bulk, 0, 0.79, 0);
    box(tilt, plate, 0.24 * bulk, 0.2, 0.03, 0, 0.66, 0.09 * bulk);
    for (const l of [lL.g, lR.g]) box(l, plate, 0.13 * bulk, 0.2, 0.14 * bulk, 0, -0.34, 0);
    for (const a of [aL.g, aR.g]) box(a, plate, 0.09, 0.16, 0.1, 0, -armLen + 0.1, 0);
  }

  if (o.cracks && pal.glow !== undefined) {
    // Dev formunun kor rengi çatlakları
    box(tilt, darkMat, 0.012, 0.22, 0.01, -0.06, 0.65, 0.087 * bulk);
    box(tilt, darkMat, 0.012, 0.16, 0.01, 0.07, 0.6, 0.087 * bulk);
    box(tilt, darkMat, 0.1, 0.012, 0.01, 0.02, 0.7, 0.087 * bulk);
    for (const a of [aL.g, aR.g]) box(a, darkMat, 0.012, 0.2, 0.01, 0, -0.2, 0.044);
    for (const l of [lL.g, lR.g]) box(l, darkMat, 0.012, 0.2, 0.01, 0.01, -0.2, 0.062 * bulk);
  }

  return {
    root,
    tilt,
    head,
    armL: aL.g,
    armR: aR.g,
    legL: lL.g,
    legR: lR.g,
    nape,
    footL: lL.foot,
    footR: lR.foot,
    handL: aL.hand,
    handR: aR.hand,
    mats,
    skinMat,
    armMat,
    height,
  };
}

export function disposeHumanoid(h: Humanoid) {
  for (const m of h.mats) m.dispose();
}
