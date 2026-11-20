import * as THREE from 'three';
import type { Game } from '../game';
import { storeSave } from '../core/save';
import { campAt, campName, sanitizeCamps } from '../systems/camps';
import type { Landmark } from './landmarks';

const IDLE = new THREE.Color(0x8c8a84);
const SEEN = new THREE.Color(0xc9a24a);
const ACTIVE = new THREE.Color(0xffe27a);
const v = new THREE.Vector3();

/**
 * Yapılardaki doğuş noktaları: her yapının yanında bir sancak durur. Oyuncu yapıya yaklaşınca
 * sancak sarıya döner ve orası doğuş noktası olur; ölünce en son uğranan yapının yanında doğulur.
 */
export class Camps {
  private readonly sites: Landmark[];
  /** Sancakların yeri (yapının yanında, açıkta). */
  private readonly spots: THREE.Vector3[] = [];
  private readonly flags: THREE.InstancedMesh;
  private checkT = 0;
  private glowT = 0;

  constructor(private readonly game: Game) {
    const w = game.world;
    this.sites = w.landmarks;
    const n = this.sites.length;
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 7, 6).translate(0, 3.5, 0);
    const clothGeo = new THREE.BoxGeometry(0.06, 1.6, 2.4).translate(0, 6.1, 1.25);
    const baseGeo = new THREE.CylinderGeometry(0.9, 1.1, 0.5, 8).translate(0, 0.25, 0);
    const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshLambertMaterial({ color: 0x3e2e20 }), n);
    const bases = new THREE.InstancedMesh(baseGeo, new THREE.MeshLambertMaterial({ color: 0x8f897c }), n);
    this.flags = new THREE.InstancedMesh(clothGeo, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const s = this.sites[i];
      // Sancak bir yapının ya da ağacın içine düşerse yakındaki boş bir yere kayar.
      let x = s.sx;
      let z = s.sz;
      for (let k = 0; k < 16 && (w.solidAt(x, w.heightAt(x, z) + 1, z, 1.6) || w.treeNear(x, z, 1.5)); k++) {
        const a = k * 2.4;
        x = s.sx + Math.sin(a) * (3 + k * 1.5);
        z = s.sz + Math.cos(a) * (3 + k * 1.5);
      }
      const y = w.heightAt(x, z);
      this.spots.push(new THREE.Vector3(x, y, z));
      m.makeRotationY((i * 2.3) % 6.28).setPosition(x, y - 0.1, z);
      poles.setMatrixAt(i, m);
      bases.setMatrixAt(i, m);
      this.flags.setMatrixAt(i, m);
      this.flags.setColorAt(i, IDLE);
    }
    for (const im of [poles, bases, this.flags]) {
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      im.castShadow = true;
      game.scene.add(im);
    }
    // Kayıttaki noktalar bu dünyanın yapı sayısına göre sınırlanır.
    const sv = game.save;
    const clean = sanitizeCamps(sv.camps, sv.camp, n);
    sv.camps = clean.camps;
    sv.camp = clean.camp;
    this.paint();
  }

  /** Haritada gösterilecek noktalar: yer, uğrandı mı, seçili mi. */
  get points() {
    const sv = this.game.save;
    return this.spots.map((p, i) => ({ x: p.x, z: p.z, seen: sv.camps.includes(i), active: sv.camp === i }));
  }

  /** Sancak renklerini kayda göre yeniler (ilerleme sıfırlanınca da çağrılır). */
  paint() {
    const sv = this.game.save;
    for (let i = 0; i < this.spots.length; i++) this.flags.setColorAt(i, sv.camp === i ? ACTIVE : sv.camps.includes(i) ? SEEN : IDLE);
    if (this.flags.instanceColor) this.flags.instanceColor.needsUpdate = true;
  }

  update(dt: number) {
    const g = this.game;
    const p = g.player;
    if (this.glowT > 0) {
      this.glowT -= dt;
      const at = this.spots[g.save.camp];
      if (at && Math.random() < 0.6) g.particles.emit(at.x + (Math.random() - 0.5) * 2, at.y + 6, at.z + (Math.random() - 0.5) * 2, 0, 3, 0, 1, 0xffe27a, 0, 0.6, 0.2);
    }
    this.checkT -= dt;
    if (this.checkT > 0 || p.dead) return;
    this.checkT = 0.3;
    const i = campAt(this.sites, p.pos.x, p.pos.z);
    if (i < 0 || g.save.camp === i) return;
    const sv = g.save;
    const fresh = !sv.camps.includes(i);
    if (fresh) sv.camps.push(i);
    sv.camp = i;
    storeSave(sv);
    this.paint();
    this.glowT = 1.6;
    const name = campName(this.sites[i]);
    g.audio.pickup();
    g.particles.burst(v.copy(this.spots[i]).setY(this.spots[i].y + 6), 30, 8, 1, 0xffe27a, 1.5);
    g.hud.toast(fresh ? `Yeni doğuş noktası: ${name} — ölürsen burada doğarsın` : `Doğuş noktası: ${name}`);
  }

  /** Seçili doğuş noktası ve adı; yoksa null (şehirde doğulur). */
  respawnPoint(): { pos: [number, number, number]; name: string } | null {
    const i = this.game.save.camp;
    const at = this.spots[i];
    if (!at) return null;
    return { pos: [at.x + 2, at.y + 0.5, at.z + 2], name: campName(this.sites[i]) };
  }
}
