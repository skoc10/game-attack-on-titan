import * as THREE from 'three';
import type { Game } from '../game';
import { CFG } from '../data/config';
import { angDiff } from '../core/rng';
import { Giant } from '../enemies/giant';
import { BOSSES, GIANT_TYPES, type CommonKind } from '../enemies/giantTypes';
import { BREACHES, DIRS, HALF_T, breachAtAngle, inGiantForest, ringOf, spawnable, type Breach } from './layout';

const W = CFG.world;
const B = CFG.breaker;
const v = new THREE.Vector3();
/** Gedikten içeri dolan devler. */
const POUR: CommonKind[] = ['normal', 'normal', 'normal', 'normal', 'runner', 'runner', 'armored', 'leaper', 'brute'];

/** Gediğin açılacağı açı: kapılardan ve kasabalardan uzak tutulur. */
export function breachAngle(phi: number) {
  let a = phi;
  for (const d of DIRS) {
    const off = angDiff(a, d);
    if (Math.abs(off) < B.gateClear) a = d + Math.sign(off || 1) * B.gateClear;
  }
  return a;
}

/** Oyuncunun Zırhlı Dev formuyla açtığı gedik ve onarılmasına kalan süre. */
interface MadeBreach {
  breach: Breach;
  rubble: THREE.Mesh[];
  t: number;
}

/**
 * Halka surda (x, z)'de toslanan yerde gedik açılabilir mi: kapı kasabalarından uzak ve orada gedik yok.
 * Açılabilirse halka ve açı, yoksa null.
 */
export function breachSpot(x: number, z: number, reach: number): { ring: number; ang: number } | null {
  const r = Math.hypot(x, z);
  const ang = Math.atan2(x, z);
  for (let ring = 0; ring < W.walls.length; ring++) {
    const w = W.walls[ring];
    if (Math.abs(r - w.r) > HALF_T + reach) continue;
    // Kapı kasabasının yayına ve kapı kulelerine değmesin.
    const clear = (w.district + CFG.wallBreak.halfWidth + 25) / w.r;
    if (DIRS.some((d) => Math.abs(angDiff(ang, d)) < clear)) return null;
    if (breachAtAngle(ring, ang)) return null;
    return { ring, ang };
  }
  return null;
}

/**
 * Zırhlı Dev: sur ötesinde dolaşan, metal plakalı zırhlı dev. Oyuncu yakındayken Kalkan Suru'na doğru
 * geri çekilip koşu yolu alır, kollarıyla yüzünü kapatarak sura toslar ve gedik açar. Gedikten devler içeri dolar.
 * Öldürülünce gedik bir süre sonra onarılır; Zırhlı Dev bir süre sonra yeniden doğar.
 */
export class Breaker {
  koc: Giant | null = null;
  /** roam: dolaşır; approach: koşu yoluna yürür; charge: sura toslar; through: gedikten içeri girer. */
  phase: 'roam' | 'approach' | 'charge' | 'through' = 'roam';
  private spawnT: number = B.first;
  private cd: number = B.firstCharge;
  private readonly runup = new THREE.Vector3();
  private readonly impact = new THREE.Vector3();
  private target = 0;
  breach: Breach | null = null;
  private repairT = 0;
  private readonly pour: Giant[] = [];
  /** Gedikten geçen devin gediği aştıktan sonraki hedefi (önce gediğin ortasına yürür). */
  private readonly beyond = new Map<Giant, { x: number; z: number }>();
  private readonly rubble: THREE.Mesh[] = [];
  /** Oyuncunun Zırhlı Dev formuyla açtığı gedikler. */
  private readonly made: MadeBreach[] = [];
  private readonly rubbleGeo = new THREE.DodecahedronGeometry(1, 0);
  private readonly rubbleMat = new THREE.MeshLambertMaterial({ color: 0x8c877c, flatShading: true });

  constructor(private readonly game: Game) {}

  /** Haritada gösterilecek gedikler: yer ve yarı genişlik (m). */
  get breachPoints(): [number, number, number][] {
    const list = this.breach ? [this.breach, ...this.made.map((m) => m.breach)] : this.made.map((m) => m.breach);
    return list.map((b) => {
      const R = W.walls[b.ring].r;
      return [Math.sin(b.ang) * R, Math.cos(b.ang) * R, b.half * R];
    });
  }

  // ---------------------------------------------------------------- doğuş
  private spawn() {
    const g = this.game;
    const p = g.player.pos;
    const R = W.walls[2].r;
    for (let tries = 0; tries < 30; tries++) {
      // Oyuncunun yönüne yakın bir yerde, Kalkan Suru'nun dışında.
      const a = Math.atan2(p.x, p.z) + (Math.random() - 0.5) * 1.4;
      const r = R + 380 + Math.random() * 700;
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;
      if (!spawnable(x, z, 80, 60) || inGiantForest(x, z, 150) || Math.hypot(x - p.x, z - p.z) < 300) continue;
      const k = new Giant(BOSSES.koc, x, z, g);
      k.persistent = true;
      k.tag = 'koc';
      k.home = new THREE.Vector3(x, 0, z);
      g.giants.push(k);
      this.koc = k;
      this.phase = 'roam';
      this.cd = B.firstCharge;
      g.hud.banner('ZIRHLI DEV', 'Sur ötesinde metal plakalı bir dev dolaşıyor — surlara toslayıp gedik açar');
      return;
    }
    this.spawnT = 10;
  }

  // ---------------------------------------------------------------- toslayış
  /** Koşu yoluna yürü: hedef surun 260 m dışı, dev sura dönük. */
  private startApproach() {
    const k = this.koc!;
    const R = W.walls[2].r;
    this.target = breachAngle(Math.atan2(k.pos.x, k.pos.z));
    const back = R + HALF_T + B.runup;
    this.runup.set(Math.sin(this.target) * back, 0, Math.cos(this.target) * back);
    this.impact.set(Math.sin(this.target) * (R - 40), 0, Math.cos(this.target) * (R - 40));
    k.home = null;
    k.raid = { x: this.runup.x, z: this.runup.z, r: 10, siege: false, march: true };
    this.phase = 'approach';
    this.game.hud.toast('Zırhlı Dev surdan uzaklaşıp koşu yolu alıyor…');
  }

  /** Halka surda gedik açar: sur yeniden kurulur, toplar susar, toz kalkar, moloz yığılır. */
  private openBreach(ring: number, ang: number, halfW: number, rubble: THREE.Mesh[]): Breach {
    const g = this.game;
    const R = W.walls[ring].r;
    const breach: Breach = { ring, ang, half: halfW / R };
    BREACHES.push(breach);
    g.world.rebuildWalls();
    const bx = Math.sin(ang) * R;
    const bz = Math.cos(ang) * R;
    g.cannons.setBroken(bx, bz, halfW + 6, true);
    // Toz, taş ve moloz: gediğin iki yanına ve önüne yığılır.
    for (let i = 0; i < 6; i++) {
      v.set(bx + (Math.random() - 0.5) * halfW * 1.4, W.wallH * (0.2 + i * 0.14), bz + (Math.random() - 0.5) * halfW * 1.4);
      g.smoke.burst(v, 26, 22, 6, 0xa39a8a, 14, 3, 14, 2.4);
      g.particles.burst(v, 40, 36, 1.8, 0xc0b8a8, 8, -10, 2.8, -0.2);
    }
    const n = Math.round(26 * (halfW / B.halfWidth));
    for (let i = 0; i < n; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const along = (Math.random() - 0.5) * halfW * 2.4;
      const across = side * (HALF_T + Math.random() * 26);
      const x = bx + Math.cos(ang) * along + Math.sin(ang) * across;
      const z = bz - Math.sin(ang) * along + Math.cos(ang) * across;
      const m = new THREE.Mesh(this.rubbleGeo, this.rubbleMat);
      const sc = 1.5 + Math.random() * 4.5;
      m.scale.set(sc * (0.8 + Math.random() * 0.6), sc * 0.6, sc * (0.8 + Math.random() * 0.6));
      m.position.set(x, g.world.heightAt(x, z) + sc * 0.2, z);
      m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      m.castShadow = m.receiveShadow = true;
      g.scene.add(m);
      rubble.push(m);
    }
    g.audio.explosion(bx, bz);
    g.audio.stomp(1.5);
    g.shakeCam(Math.max(0.3, 1.5 - Math.hypot(bx - g.player.pos.x, bz - g.player.pos.z) / 500));
    return breach;
  }

  /** Gediği kapatır: sur yeniden kurulur, toplar yerine gelir, moloz kalkar. */
  private closeBreach(b: Breach, rubble: THREE.Mesh[]) {
    const g = this.game;
    const i = BREACHES.indexOf(b);
    if (i >= 0) BREACHES.splice(i, 1);
    g.world.rebuildWalls();
    const R = W.walls[b.ring].r;
    g.cannons.setBroken(Math.sin(b.ang) * R, Math.cos(b.ang) * R, b.half * R + 6, false);
    for (const m of rubble) g.scene.remove(m);
    rubble.length = 0;
    g.hud.toast(`${W.walls[b.ring].name}’ndaki gedik onarıldı`);
  }

  /**
   * Oyuncu Zırhlı Dev formunda hücumla sura toslayınca çağrılır: halka surda gedik açılabiliyorsa açar.
   * `reach` gövdenin sura uzanan genişliği.
   */
  playerRam(x: number, z: number, reach: number) {
    const spot = breachSpot(x, z, reach);
    if (!spot) return false;
    const rubble: THREE.Mesh[] = [];
    const breach = this.openBreach(spot.ring, spot.ang, CFG.wallBreak.halfWidth, rubble);
    this.made.push({ breach, rubble, t: CFG.wallBreak.repair });
    this.game.hud.banner('SURU DELDİN', `${W.walls[spot.ring].name}’nda gedik açıldı — ${CFG.wallBreak.repair} sn sonra onarılır, devler de geçebilir`);
    return true;
  }

  /** Toslayış sura değdi: gedik açılır, sur parçaları savrulur, devler içeri dolmaya başlar. */
  onImpact(k: Giant) {
    if (k !== this.koc) return;
    const g = this.game;
    const ring = 2;
    const R = W.walls[ring].r;
    const ang = Math.atan2(k.pos.x, k.pos.z);
    this.breach = this.openBreach(ring, ang, B.halfWidth, this.rubble);
    g.hud.banner('SURDA GEDİK AÇILDI', `Zırhlı Dev ${W.walls[ring].name}’nu deldi — devler içeri doluyor`);
    this.pourGiants(ang);
    // Gediğin içinden geçip surun içinde dolaşmaya başlar.
    const inside = R - 160;
    k.raid = { x: Math.sin(ang) * inside, z: Math.cos(ang) * inside, r: 20, siege: false, march: true };
    this.phase = 'through';
  }

  /** Gediğin dışında devler belirir ve gedikten içeri, surun içine yürür. */
  private pourGiants(ang: number) {
    const g = this.game;
    const R = W.walls[2].r;
    for (const kind of POUR) {
      const out = R + 50 + Math.random() * 90;
      const side = (Math.random() - 0.5) * 50;
      const x = Math.sin(ang) * out + Math.cos(ang) * side;
      const z = Math.cos(ang) * out - Math.sin(ang) * side;
      const gi = g.spawner.spawn(kind, x, z, g);
      const inside = R - 120 - Math.random() * 160;
      const off = (Math.random() - 0.5) * 120;
      // Önce gediğin tam ortasından geçer (surun 20 m içi), sonra içeride dağılır.
      const gap = (Math.random() - 0.5) * 8;
      gi.raid = { x: Math.sin(ang) * (R - 20) + Math.cos(ang) * gap, z: Math.cos(ang) * (R - 20) - Math.sin(ang) * gap, r: 6, siege: false, march: true };
      this.beyond.set(gi, { x: Math.sin(ang) * inside + Math.cos(ang) * off, z: Math.cos(ang) * inside - Math.sin(ang) * off });
      gi.yaw = ang + Math.PI;
      // İçeri girene dek uzaklaşınca kaybolmaz.
      gi.persistent = true;
      this.pour.push(gi);
    }
  }

  /** Zırhlı Dev'in gediği onarılır. */
  private repair() {
    const b = this.breach;
    if (!b) return;
    this.breach = null;
    this.closeBreach(b, this.rubble);
  }

  update(dt: number) {
    const g = this.game;
    const p = g.player;
    // Gedikten geçen devler hedefe varınca sıradan devler gibi dolaşır.
    for (let i = this.pour.length - 1; i >= 0; i--) {
      const gi = this.pour[i];
      if (!gi.alive || gi.gone) {
        this.pour.splice(i, 1);
        this.beyond.delete(gi);
        continue;
      }
      if (!gi.raid || Math.hypot(gi.raid.x - gi.pos.x, gi.raid.z - gi.pos.z) < gi.raid.r + 4) {
        const next = this.beyond.get(gi);
        if (next && gi.raid) {
          // Gediği geçti: içerideki hedefine yürür.
          gi.raid = { x: next.x, z: next.z, r: 25, siege: false, march: true };
          this.beyond.delete(gi);
          continue;
        }
        gi.raid = null;
        gi.persistent = false;
        this.beyond.delete(gi);
        this.pour.splice(i, 1);
      }
    }
    if (this.repairT > 0) {
      this.repairT -= dt;
      if (this.repairT <= 0) this.repair();
    }
    for (let i = this.made.length - 1; i >= 0; i--) {
      const m = this.made[i];
      m.t -= dt;
      if (m.t <= 0) {
        this.made.splice(i, 1);
        this.closeBreach(m.breach, m.rubble);
      }
    }
    const k = this.koc;
    if (!k || !k.alive || k.gone) {
      if (k) {
        // Zırhlı Dev düştü: gedik bir süre sonra onarılır, kendisi bir süre sonra yeniden doğar.
        this.koc = null;
        this.spawnT = B.respawn;
        if (this.breach) this.repairT = B.repair;
      }
      if (g.raid.active) return;
      this.spawnT -= dt;
      if (this.spawnT <= 0 && ringOf(p.pos.x, p.pos.z) >= 2 && !p.dead) this.spawn();
      return;
    }
    const near = Math.hypot(k.pos.x - p.pos.x, k.pos.z - p.pos.z) < B.notice;
    switch (this.phase) {
      case 'roam':
        if (this.breach || g.raid.active) break;
        if (near) this.cd -= dt;
        if (this.cd <= 0 && ringOf(k.pos.x, k.pos.z) === 3) this.startApproach();
        break;
      case 'approach': {
        // Koşu yoluna varınca sura dönüp toslar.
        const busy = k.state === 'windup' || k.state === 'grab' || k.state === 'stunned' || k.state === 'downed' || k.state === 'rising';
        if (!busy && Math.hypot(this.runup.x - k.pos.x, this.runup.z - k.pos.z) < 16) {
          k.charge(this.impact.x, this.impact.z, B.speed);
          g.audio.giant('growl', k.h, k.pos.x, k.pos.z, 3);
          g.hud.banner('ZIRHLI DEV TOSLUYOR', 'Kollarıyla yüzünü kapatıp sura koşuyor — önünden çekil!');
          this.phase = 'charge';
        }
        break;
      }
      case 'charge':
        // Toslayış bitti ama sura değmediyse (yolundan saptırıldı) yeniden dener.
        if (k.state !== 'rush' && !k.breaching && !this.breach) {
          this.phase = 'roam';
          this.cd = 20;
          k.home = k.pos.clone();
        }
        break;
      case 'through':
        if (!k.raid) {
          k.home = k.pos.clone();
          this.phase = 'roam';
          this.cd = B.again;
        } else if (Math.hypot(k.raid.x - k.pos.x, k.raid.z - k.pos.z) < k.raid.r + 4) {
          k.raid = null;
        }
        break;
    }
  }
}
