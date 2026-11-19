import * as THREE from 'three';
import type { Game } from '../game';
import { CFG } from '../data/config';
import { lerp, turnToward } from '../core/rng';
import { GEO, Rig } from '../enemies/humanoid';
import { wallPush } from '../world/layout';

const H = CFG.horse;

export type HorseMode = 'idle' | 'coming' | 'ridden';

interface Leg {
  upper: THREE.Group;
  lower: THREE.Group;
  front: boolean;
  /** Bacağın adım döngüsündeki yeri (yürüyüş türüne göre yumuşakça değişir). */
  offset: number;
}

/** Yürüyüş türlerine göre bacakların adım sırası: sol ön, sağ ön, sol arka, sağ arka. */
const GAITS = {
  walk: [Math.PI / 2, Math.PI * 1.5, 0, Math.PI],
  trot: [0, Math.PI, Math.PI, 0],
  gallop: [1.6, 2.15, 0, 0.55],
};

export class Horse {
  readonly group = new THREE.Group();
  readonly pos: THREE.Vector3;
  readonly vel = new THREE.Vector3();
  yaw = 0;
  speed = 0;
  mode: HorseMode = 'idle';
  private readonly legs: Leg[] = [];
  private readonly neck = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly tail = new THREE.Group();
  private readonly body = new THREE.Group();
  private phase = 0;
  private t = Math.random() * 10;
  /** Otlanma: başını yere indirip kaldırır (binilmemişken, dururken). */
  private grazeT = 4;
  private graze = 0;

  constructor(game: Game, x: number, z: number) {
    // Parlak, kısa tüylü doru at: yumuşak gölgeli, ince konturlu.
    const rig = new Rig(0.006, true);
    const coat = rig.surf(0x6e4128, 0.55);
    const coatDark = rig.surf(0x4f2d1b, 0.6);
    const points = rig.surf(0x1d1410, 0.7); // yele, kuyruk ve bacak uçları
    const white = rig.surf(0xece6dc, 0.6);
    const hoof = rig.surf(0x2a2420, 0.45);
    const dark = rig.surf(0x120c0a, 0.3);
    const leather = rig.surf(0x4a2c18, 0.5);
    const leatherDark = rig.surf(0x2c1a10, 0.55);
    const cloth = rig.surf(0x7a2230, 0.8);
    const trim = rig.surf(0xc9a24a, 0.4);
    const iron = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.35, metalness: 0.8 });
    rig.mats.push(iron);
    const b = this.body;
    this.group.add(b);

    // Gövde: derin göğüs kafesi, dolgun omuzlar, yuvarlak sağrı, hafif içe çekik karın.
    const barrel = rig.part(b, GEO.capsule, coat, 0.35, 0.42, 0.41, 0, 1.36, 0);
    barrel.rotation.x = Math.PI / 2;
    rig.part(b, GEO.sphere, coat, 0.34, 0.44, 0.36, 0, 1.36, 0.7); // göğüs
    rig.part(b, GEO.sphere, coat, 0.17, 0.15, 0.34, 0, 1.7, 0.42, false); // cidago
    rig.part(b, GEO.sphere, coat, 0.38, 0.44, 0.44, 0, 1.44, -0.64); // sağrı
    rig.part(b, GEO.sphere, coatDark, 0.31, 0.25, 0.62, 0, 1.17, 0.02, false); // karın
    for (const s of [-1, 1]) {
      const sh = rig.part(b, GEO.sphere, coat, 0.13, 0.32, 0.22, s * 0.25, 1.38, 0.6, false); // omuz kası
      sh.rotation.x = -0.35;
      rig.part(b, GEO.sphere, coat, 0.17, 0.33, 0.3, s * 0.21, 1.37, -0.74, false); // but
    }

    // Boyun: kalın tabandan başa doğru incelen, kavisli; tepesinde yele.
    this.neck.position.set(0, 1.58, 0.86);
    b.add(this.neck);
    rig.part(this.neck, GEO.sphere, coat, 0.22, 0.28, 0.24, 0, 0.04, -0.02);
    const n1 = rig.part(this.neck, GEO.capsule, coat, 0.17, 0.17, 0.22, 0, 0.3, 0.16);
    n1.rotation.x = 0.62;
    const n2 = rig.part(this.neck, GEO.capsule, coat, 0.13, 0.13, 0.17, 0, 0.56, 0.36, false);
    n2.rotation.x = 0.5;
    for (let i = 0; i < 8; i++) {
      const f = i / 7;
      const lock = rig.part(this.neck, GEO.box, points, 0.05, 0.22 + 0.06 * Math.sin(i * 2.3), 0.12, 0.05, 0.1 + f * 0.6, -0.08 + f * 0.48, false);
      lock.rotation.set(0.62 - f * 0.2, 0, 0.35);
    }

    // Baş: alın, uzun ve incelen burun, çene kemiği; alında beyaz akıtma.
    this.head.position.set(0, 0.78, 0.5);
    this.head.rotation.x = 0.95;
    this.head.scale.setScalar(1.18);
    this.neck.add(this.head);
    const h = this.head;
    rig.part(h, GEO.sphere, coat, 0.12, 0.13, 0.16, 0, 0, 0);
    const muzzle = rig.part(h, GEO.taper, coat, 0.095, 0.36, 0.085, 0, -0.02, 0.25);
    muzzle.rotation.x = Math.PI / 2;
    rig.part(h, GEO.sphere, coat, 0.088, 0.078, 0.09, 0, -0.035, 0.43);
    rig.part(h, GEO.sphere, coat, 0.105, 0.11, 0.12, 0, -0.07, 0.03, false); // çene
    const blaze = rig.part(h, GEO.box, white, 0.045, 0.012, 0.38, 0, 0.08, 0.2, false);
    blaze.rotation.x = 0.16;
    for (const s of [-1, 1]) {
      rig.part(h, GEO.sphere, dark, 0.026, 0.03, 0.026, s * 0.108, 0.035, 0.06, false); // göz
      rig.part(h, GEO.sphere, white, 0.006, 0.006, 0.006, s * 0.128, 0.045, 0.072, false); // göz parıltısı
      rig.part(h, GEO.sphere, dark, 0.018, 0.024, 0.014, s * 0.05, -0.02, 0.5, false); // burun deliği
      const ear = rig.part(h, GEO.cone, coat, 0.04, 0.15, 0.028, s * 0.065, 0.16, -0.06, false);
      ear.rotation.set(-0.3, 0, -s * 0.22);
      // Yular: yanak kayışı, burun kayışı ve gem halkası.
      rig.part(h, GEO.box, leatherDark, 0.012, 0.24, 0.025, s * 0.115, -0.03, 0.02, false);
      rig.part(h, GEO.sphere, iron, 0.022, 0.022, 0.022, s * 0.085, -0.09, 0.38, false);
    }
    const nose = rig.part(h, GEO.box, leatherDark, 0.22, 0.025, 0.03, 0, 0.0, 0.3, false);
    nose.rotation.x = 0.1;
    const forelock = rig.part(h, GEO.box, points, 0.07, 0.16, 0.03, 0, 0.12, 0.08, false);
    forelock.rotation.x = 0.7;
    // Dizgin: gemden eyerin önüne.
    for (const s of [-1, 1]) {
      const rein = rig.part(this.neck, GEO.box, leatherDark, 0.012, 0.012, 0.7, s * 0.13, 0.36, 0.38, false);
      rein.rotation.x = 0.55;
    }

    // Kuyruk: kök ve dökülen tutamlar; menteşeden savrulur.
    this.tail.position.set(0, 1.62, -1.1);
    b.add(this.tail);
    rig.part(this.tail, GEO.capsule, points, 0.07, 0.07, 0.07, 0, -0.08, -0.06);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const len = 0.75 + Math.sin(i * 1.7) * 0.12;
      const strand = rig.part(this.tail, GEO.cone, points, 0.06, len, 0.05, Math.sin(a) * 0.04, -0.2 - len / 2, -0.1 + Math.cos(a) * 0.04, false);
      strand.rotation.set(Math.PI - 0.18, 0, Math.sin(a) * 0.12);
    }

    // Eyer takımı: örtü, oturak, ön ve arka kaş, kolan, üzengiler.
    rig.part(b, GEO.box, cloth, 0.84, 0.04, 0.86, 0, 1.775, -0.05, false);
    rig.part(b, GEO.box, trim, 0.86, 0.02, 0.88, 0, 1.755, -0.05, false);
    rig.part(b, GEO.sphere, leather, 0.27, 0.07, 0.34, 0, 1.83, -0.05);
    rig.part(b, GEO.sphere, leather, 0.2, 0.1, 0.07, 0, 1.9, -0.34, false); // arka kaş
    rig.part(b, GEO.sphere, leather, 0.14, 0.09, 0.08, 0, 1.88, 0.24, false); // ön kaş
    for (const s of [-1, 1]) {
      rig.part(b, GEO.box, leatherDark, 0.02, 0.6, 0.07, s * 0.36, 1.48, 0.18, false); // kolan
      rig.part(b, GEO.box, leatherDark, 0.015, 0.42, 0.035, s * 0.33, 1.6, -0.02, false); // üzengi kayışı
      rig.part(b, GEO.box, iron, 0.1, 0.025, 0.12, s * 0.33, 1.38, -0.02, false); // üzengi
    }

    // Bacaklar: ön bacakta dirsek-diz-bilek, arka bacakta kalın but ve geriye kırılan diz (sıçrama eklemi).
    const mkLeg = (lx: number, lz: number, front: boolean, sock: boolean) => {
      const upper = new THREE.Group();
      upper.position.set(lx, 1.18, lz);
      b.add(upper);
      if (front) {
        rig.part(upper, GEO.capsule, coat, 0.1, 0.12, 0.115, 0, -0.24, 0.02); // ön kol
        rig.part(upper, GEO.sphere, coat, 0.075, 0.08, 0.08, 0, -0.5, 0.02, false); // diz
      } else {
        rig.part(upper, GEO.sphere, coat, 0.13, 0.26, 0.2, 0, -0.06, 0.02, false); // but kası
        rig.part(upper, GEO.capsule, coat, 0.085, 0.13, 0.1, 0, -0.3, -0.03); // incik
        rig.part(upper, GEO.sphere, coat, 0.07, 0.08, 0.09, 0, -0.55, -0.06, false); // sıçrama eklemi
      }
      const lower = new THREE.Group();
      lower.position.set(0, front ? -0.52 : -0.56, front ? 0.02 : -0.06);
      upper.add(lower);
      const shin = sock ? white : points;
      rig.part(lower, GEO.capsule, front ? coatDark : coat, 0.052, 0.07, 0.058, 0, -0.12, 0, false);
      rig.part(lower, GEO.capsule, shin, 0.05, 0.075, 0.055, 0, -0.28, 0); // inik
      rig.part(lower, GEO.sphere, shin, 0.064, 0.06, 0.07, 0, -0.44, 0.01, false); // bukağılık
      const hf = rig.part(lower, GEO.taper, hoof, 0.07, 0.08, 0.08, 0, -0.53, 0.025); // toynak
      hf.rotation.x = Math.PI; // tabanı geniş
      this.legs.push({ upper, lower, front, offset: 0 });
    };
    mkLeg(-0.2, 0.72, true, true);
    mkLeg(0.2, 0.72, true, false);
    mkLeg(-0.21, -0.74, false, false);
    mkLeg(0.21, -0.74, false, true);

    this.pos = this.group.position;
    this.pos.set(x, 0, z);
    game.scene.add(this.group);
  }

  /** Islıkla çağır: çok uzaktaysa görüş dışına ışınlanıp koşarak gelir. */
  call(game: Game) {
    if (this.mode === 'ridden') return;
    const p = game.player.pos;
    const d = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
    if (d > H.teleportDist) {
      const a = game.camYaw + Math.PI + (Math.random() - 0.5);
      this.pos.x = p.x + Math.sin(a) * 70;
      this.pos.z = p.z + Math.cos(a) * 70;
      game.world.resolve(this.pos, 1, { trees: true, buildings: true });
    }
    this.mode = 'coming';
    game.audio.whistle();
  }

  /** Binili sürüş: wish kamera yönüne göre istenen hareket vektörü. */
  drive(wish: THREE.Vector3, sprint: boolean, dt: number, game: Game) {
    const has = wish.lengthSq() > 0.01;
    if (has) this.yaw = turnToward(this.yaw, Math.atan2(wish.x, wish.z), H.turn * dt);
    const target = has ? (sprint ? H.speed : H.trot) : 0;
    this.speed += Math.max(-H.accel * 1.6 * dt, Math.min(H.accel * dt, target - this.speed));
    this.move(dt, game);
  }

  private move(dt: number, game: Game) {
    const px = this.pos.x;
    const pz = this.pos.z;
    this.pos.x += Math.sin(this.yaw) * this.speed * dt;
    this.pos.z += Math.cos(this.yaw) * this.speed * dt;
    this.pos.y = 0;
    // Ağaçlara gövdesiyle, sura başı ve sağrısıyla birlikte (gövde boyunun yarısı) çarpar.
    const walled = wallPush(this.pos, 1.9, 0, 3);
    if (game.world.resolve(this.pos, 1, { trees: true, buildings: true }) || walled) {
      const moved = Math.hypot(this.pos.x - px, this.pos.z - pz);
      this.speed = Math.min(this.speed, (moved / dt) * 0.98 + 2);
    }
    this.pos.y = game.world.heightAt(this.pos.x, this.pos.z);
    this.vel.set(Math.sin(this.yaw) * this.speed, 0, Math.cos(this.yaw) * this.speed);
    this.phase += this.speed * dt * 0.7;
  }

  update(dt: number, game: Game) {
    if (this.mode === 'coming') {
      const p = game.player.pos;
      const dx = p.x - this.pos.x;
      const dz = p.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 4 || game.player.mode !== 'foot') {
        this.mode = 'idle';
      } else {
        this.yaw = turnToward(this.yaw, Math.atan2(dx, dz), 6 * dt);
        this.speed = Math.min(H.speed * 1.15, Math.max(8, d * 1.5));
        this.move(dt, game);
      }
    }
    if (this.mode === 'idle') {
      this.speed = lerp(this.speed, 0, 1 - Math.exp(-dt * 6));
      this.pos.y = game.world.heightAt(this.pos.x, this.pos.z);
      this.vel.set(0, 0, 0);
    }
    this.group.rotation.y = this.yaw;

    this.t += dt;
    // Yürüyüş türü hıza göre: adım, tırıs, dörtnal. Bacak sırası yumuşakça geçer.
    const sp = this.speed;
    const gait = sp > H.trot + 3 ? GAITS.gallop : sp > 4 ? GAITS.trot : GAITS.walk;
    const gallop = Math.min(1, Math.max(0, (sp - H.trot) / 8));
    const amp = Math.min(0.85, sp / 16) * (1 - gallop * 0.1) + gallop * 0.15;
    const k = 1 - Math.exp(-dt * 4);
    this.legs.forEach((l, i) => {
      l.offset = lerp(l.offset, gait[i], k);
      const s = Math.sin(this.phase + l.offset);
      // Bacak öne giderken kalkar: ön bacakta diz geriye, arka bacakta sıçrama eklemi öne kırılır.
      const lift = Math.max(0, Math.sin(this.phase + l.offset + 1.2));
      l.upper.rotation.x = s * amp * (l.front ? 1 : 0.85);
      l.lower.rotation.x = l.front ? lift * amp * 1.6 : -lift * amp * 1.1 - 0.08;
    });
    // Gövde dörtnalda öne arkaya yaylanır, tırısta hafifçe zıplar.
    const beat = Math.sin(this.phase * 2);
    this.body.position.y = Math.abs(beat) * 0.07 * amp + Math.max(0, Math.sin(this.phase + 0.6)) * 0.08 * gallop;
    this.body.rotation.x = Math.sin(this.phase + 0.8) * 0.06 * gallop + beat * 0.015 * amp;
    // Otlanma: dururken ara sıra başını yere indirir; kulak ve kuyruk hiç durmaz.
    const still = this.mode === 'idle' && sp < 0.5;
    this.grazeT -= dt;
    if (this.grazeT <= 0) this.grazeT = still ? 5 + Math.random() * 7 : 2;
    const grazing = still && this.grazeT < 3;
    this.graze = lerp(this.graze, grazing ? 1 : 0, 1 - Math.exp(-dt * 1.6));
    this.neck.rotation.x = 0.22 + 0.12 * amp + Math.sin(this.phase + 0.4) * 0.1 * gallop + this.graze * 0.95;
    this.head.rotation.x = 0.95 - gallop * 0.2 + this.graze * 0.3 + (grazing ? Math.sin(this.t * 6) * 0.04 : 0);
    this.neck.rotation.y = still ? Math.sin(this.t * 0.4) * 0.15 : 0;
    this.tail.rotation.x = -0.3 - amp * 0.9 + Math.sin(this.phase * 1.3) * 0.08;
    this.tail.rotation.z = Math.sin(this.t * (still ? 1.7 : 3)) * (still ? 0.28 : 0.12);
  }
}
