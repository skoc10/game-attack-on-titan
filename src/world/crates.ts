import * as THREE from 'three';
import type { Game } from '../game';
import { CFG } from '../data/config';
import { mulberry32 } from '../core/rng';
import { heightAt } from './terrain';

export type CrateContent = 'needle' | 'gas' | 'blade';

export interface Crate {
  x: number;
  y: number;
  z: number;
  content: CrateContent;
  opened: boolean;
  timer: number;
  group: THREE.Group;
  lid: THREE.Mesh;
  beam: THREE.Mesh;
}

const BEAM_COLOR: Record<CrateContent, number> = { needle: 0xffc247, gas: 0x9fd8ff, blade: 0xdfe3ea };

/** Haritaya dağılmış ikmal kutuları. İçlerinden Öz İğnesi, gaz veya kılıç çıkar. */
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

    const add = (x: number, z: number, content: CrateContent) => {
      const y = heightAt(x, z);
      const group = new THREE.Group();
      group.position.set(x, y, z);
      group.rotation.y = rng() * 6.28;
      const body = new THREE.Mesh(boxGeo, wood);
      body.position.y = 0.55;
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
          color: BEAM_COLOR[content],
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
      this.list.push({ x, y, z, content, opened: false, timer: 0, group, lid, beam });
    };

    const roll = (): CrateContent => {
      const r = rng();
      return r < 0.55 ? 'needle' : r < 0.8 ? 'gas' : 'blade';
    };
    const valid = (x: number, z: number) => {
      const r = Math.hypot(x, z);
      return r > 370 && r < 2350 && !CFG.world.walls.some((w) => Math.abs(r - w.r) < 30);
    };

    // İlk kutular kapının hemen dışında: oyuncu döngüyü erken öğrensin.
    add(16, 392, 'needle');
    add(-20, 560, 'gas');
    add(22, 760, 'needle');
    for (const v of villages) {
      if (this.list.length >= CFG.crate.count - 10) break;
      const x = v.x + (rng() - 0.5) * 30;
      const z = v.z + (rng() - 0.5) * 30;
      if (valid(x, z)) add(x, z, roll());
    }
    let guard = 0;
    while (this.list.length < CFG.crate.count && guard++ < 500) {
      const a = rng() * Math.PI * 2;
      const rr = 380 + rng() * 1900;
      const x = Math.sin(a) * rr;
      const z = Math.cos(a) * rr;
      if (valid(x, z)) add(x, z, roll());
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

  open(c: Crate, game: Game) {
    if (c.opened) return;
    c.opened = true;
    c.timer = CFG.crate.respawn;
    c.beam.visible = false;
    c.lid.position.set(0.5, 0.25, 0.9);
    c.lid.rotation.z = 0.5;
    game.onCrateOpened(c);
  }

  update(dt: number) {
    for (const c of this.list) {
      if (!c.opened) {
        (c.beam.material as THREE.MeshBasicMaterial).opacity = 0.18 + Math.sin(performance.now() * 0.003 + c.x) * 0.06;
        continue;
      }
      c.timer -= dt;
      if (c.timer <= 0) {
        c.opened = false;
        c.beam.visible = true;
        c.lid.position.set(0, 1.2, 0);
        c.lid.rotation.z = 0;
      }
    }
  }
}
