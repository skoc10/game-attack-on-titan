import * as THREE from 'three';
import type { Game } from '../game';
import { CFG } from '../data/config';
import { mulberry32 } from '../core/rng';
import { rollTitan, TITANS, type TitanId } from '../data/titans';
import { heightAt } from './terrain';
import { EDGE, inSafe, wallDist } from './layout';

export type CrateContent = 'needle' | 'gas' | 'blade' | 'spear' | 'medic' | 'coin' | 'hood' | 'flare';

export interface Crate {
  x: number;
  y: number;
  z: number;
  content: CrateContent;
  /** İğne kutusuysa hangi dev formunun iğnesi. */
  form: TitanId;
  opened: boolean;
  timer: number;
  group: THREE.Group;
  lid: THREE.Mesh;
  beam: THREE.Mesh;
}

const CRATE_COLORS: Record<Exclude<CrateContent, 'needle'>, number> = {
  gas: 0xffffff,
  blade: 0x8f9aa8,
  spear: 0xffee33,
  medic: 0xff7fa0,
  coin: 0x2ee6a6,
  hood: 0x1f7a35,
  flare: 0xff3a1a,
};
const CRATE_NAMES: Record<Exclude<CrateContent, 'needle'>, string> = {
  gas: 'Gaz sandığı',
  blade: 'Kılıç sandığı',
  spear: 'Mızrak sandığı',
  medic: 'Sargı sandığı',
  coin: 'Ganimet sandığı',
  hood: 'Kapşon sandığı',
  flare: 'Fişek sandığı',
};

/** Her sandık türünün kendi ışık rengi vardır; iğne sandıklarınınki dev formunun rengidir. */
export function crateColor(c: { content: CrateContent; form: TitanId }) {
  return c.content === 'needle' ? TITANS[c.form].color : CRATE_COLORS[c.content];
}

export function crateLabel(c: { content: CrateContent; form: TitanId }) {
  return c.content === 'needle' ? `${TITANS[c.form].needle} sandığı` : CRATE_NAMES[c.content];
}

/** 0..1 arası bir zarla sandığın içeriğini seçer. Köy sandıklarından daha çok mızrak çıkar. */
export function rollContent(roll: number, village = false): CrateContent {
  const table: [CrateContent, number][] = village
    ? [['spear', 0.38], ['needle', 0.25], ['medic', 0.12], ['gas', 0.08], ['blade', 0.05], ['hood', 0.03], ['flare', 0.05], ['coin', 0.04]]
    : [['needle', 0.33], ['blade', 0.15], ['spear', 0.14], ['gas', 0.13], ['medic', 0.09], ['hood', 0.03], ['flare', 0.05], ['coin', 0.08]];
  let acc = 0;
  for (const [c, w] of table) {
    acc += w;
    if (roll < acc) return c;
  }
  return 'needle';
}

/** Haritaya dağılmış ikmal sandıkları. İçlerinden dev iğnesi, gaz, kılıç, patlar mızrak, sargı, av puanı ya da kapşon çıkar. */
export class Crates {
  readonly list: Crate[] = [];

  constructor(scene: THREE.Scene, villages: { x: number; z: number }[]) {
    const rng = mulberry32(4242);
    const wood = new THREE.MeshLambertMaterial({ color: 0x6b4a2b });
    const band = new THREE.MeshLambertMaterial({ color: 0x2c2c30 });
    const boxGeo = new THREE.BoxGeometry(1.5, 1.1, 1.1);
    const lidGeo = new THREE.BoxGeometry(1.6, 0.22, 1.2);
    const bandGeo = new THREE.BoxGeometry(0.16, 1.14, 1.14);
    const beamGeo = new THREE.CylinderGeometry(0.45, 0.45, 70, 6, 1, true);

    const add = (x: number, z: number, content: CrateContent, form: TitanId = 'ofke') => {
      const y = heightAt(x, z);
      const group = new THREE.Group();
      group.position.set(x, y, z);
      group.rotation.y = rng() * 6.28;
      const body = new THREE.Mesh(boxGeo, wood);
      body.position.y = 0.55;
      body.castShadow = true;
      const lid = new THREE.Mesh(lidGeo, band);
      lid.position.y = 1.2;
      group.add(body, lid);
      for (const sx of [-0.5, 0.5]) {
        const b = new THREE.Mesh(bandGeo, band);
        b.position.set(sx, 0.56, 0);
        group.add(b);
      }
      const beam = new THREE.Mesh(
        beamGeo,
        new THREE.MeshBasicMaterial({
          color: crateColor({ content, form }),
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        }),
      );
      beam.position.y = 36;
      group.add(beam);
      scene.add(group);
      this.list.push({ x, y, z, content, form, opened: false, timer: 0, group, lid, beam });
    };

    // Rastgele kutu: içerik ve (iğneyse) hangi formun iğnesi olduğu.
    const addRandom = (x: number, z: number, village = false) => {
      const r = rng();
      // Doruk İğnesi (en büyük dev) asıl olarak Demir Sur'un ötesinde bulunur.
      const deep = Math.hypot(x, z) > CFG.world.walls[1].r && rng() < 0.3;
      const form = deep ? 'zirve' : rollTitan(rng());
      add(x, z, rollContent(r, village), form);
    };
    const valid = (x: number, z: number) => !inSafe(x, z, 20) && wallDist(x, z) >= 30 && Math.hypot(x, z) < EDGE - 120;
    const [w0, w1, w2] = CFG.world.walls;
    // Kapı kasabalarının dış kapısının hemen önü (+Z yolunda).
    const MID_G = w1.r + w1.district;
    const OUT_G = w2.r + w2.district;

    // İlk kutular kapının hemen dışında: oyuncu döngüyü erken öğrensin.
    const IN_G = w0.r + w0.district;
    add(16, IN_G + 25, 'needle', 'ofke');
    add(-20, IN_G + 165, 'gas');
    add(18, IN_G + 80, 'spear');
    // Orman Kapşonu: ilk ormanın kenarında, yolun biraz dışında.
    add(-58, IN_G + 245, 'hood');
    add(22, IN_G + 365, 'needle', 'firtina');
    add(-26, IN_G + 505, 'needle', 'kaya');
    add(-30, MID_G + 60, 'needle', 'zirve');
    // Sur ötesi: son görevlerde iğnesiz kalan oyuncu için kulenin yolunda iki sandık.
    add(26, OUT_G + 40, 'needle', 'ofke');
    add(-34, OUT_G + 140, 'needle', 'kaya');
    for (const v of villages) {
      if (this.list.length >= CFG.crate.count - 14) break;
      const x = v.x + (rng() - 0.5) * 30;
      const z = v.z + (rng() - 0.5) * 30;
      if (valid(x, z)) addRandom(x, z, true);
    }
    let guard = 0;
    while (this.list.length < CFG.crate.count && guard++ < 500) {
      const a = rng() * Math.PI * 2;
      const a0 = w0.r + w0.district + 20;
      const a1 = EDGE - 150;
      const rr = Math.sqrt(a0 * a0 + (a1 * a1 - a0 * a0) * rng());
      const x = Math.sin(a) * rr;
      const z = Math.cos(a) * rr;
      if (valid(x, z)) addRandom(x, z);
    }
  }

  nearest(pos: THREE.Vector3, maxD: number) {
    let best: Crate | null = null;
    let bd = maxD * maxD;
    for (const c of this.list) {
      if (c.opened) continue;
      const d = (c.x - pos.x) ** 2 + (c.z - pos.z) ** 2 + (c.y - pos.y) ** 2;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  /** Verilen türden (ya da 'any' ise herhangi bir türden) en yakın iğne sandığı; açılmışsa yeniden doldurulur. */
  restock(form: TitanId | 'any', x: number, z: number) {
    let best: Crate | null = null;
    let bd = Infinity;
    for (const c of this.list) {
      if (c.content !== 'needle' || (form !== 'any' && c.form !== form)) continue;
      const d = (c.x - x) ** 2 + (c.z - z) ** 2;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    if (best?.opened) this.close(best);
    return best;
  }

  private close(c: Crate) {
    c.opened = false;
    c.timer = 0;
    c.beam.visible = true;
    c.lid.position.set(0, 1.2, 0);
    c.lid.rotation.z = 0;
  }

  open(c: Crate, game: Game) {
    if (c.opened) return;
    c.opened = true;
    c.timer = CFG.crate.respawn;
    c.beam.visible = false;
    c.lid.position.set(0.5, 0.25, 0.9);
    c.lid.rotation.z = 0.5;
    game.onCrateOpened(c);
  }

  /** Oyuncudan bu kadar uzaktaki kutular çizilmez (sis zaten örter). */
  static readonly DRAW = 900;

  update(dt: number, px: number, pz: number) {
    const far = Crates.DRAW * Crates.DRAW;
    for (const c of this.list) {
      c.group.visible = (c.x - px) ** 2 + (c.z - pz) ** 2 < far;
      if (!c.opened) {
        (c.beam.material as THREE.MeshBasicMaterial).opacity = 0.18 + Math.sin(performance.now() * 0.003 + c.x) * 0.06;
        continue;
      }
      c.timer -= dt;
      if (c.timer <= 0) this.close(c);
    }
  }
}
