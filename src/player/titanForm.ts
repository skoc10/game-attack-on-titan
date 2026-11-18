import * as THREE from 'three';
import type { Game } from '../game';
import type { Giant, TitanHitOpts } from '../enemies/giant';
import type { Player } from './player';
import { angDiff, lerp } from '../core/rng';
import { CFG } from '../data/config';
import { FORMS, type Ability, type FormId, type TitanDef } from '../data/titans';
import { autoBend, buildHumanoid, type Humanoid } from '../enemies/humanoid';
import { animateCollapse, newCollapse, resetPose, type Collapse } from '../enemies/collapse';

const v = new THREE.Vector3();
const look = new THREE.Vector3();
const BOULDER_G = 40;
/** Dönüşüm: gövde buharın içinden RISE saniyede yükselir, ardından ROAR saniye kükrer. */
export const EMERGE = { rise: 1, roar: 0.9 };
const mouthOff = new THREE.Vector3(0, 0.042, 0.085);

interface Body {
  model: Humanoid;
  armBase: THREE.Color;
}

/**
 * Oyuncunun dev formları. Hangi formda olunduğu `def` ile belirlenir;
 * yumruk, iki güç (Q/E) ve sıçrayıp ezme, formun verisindeki sayılarla çalışır.
 */
export class TitanForm {
  def: TitanDef = FORMS.ofke;
  punchT = -1;
  /** Q ve E güçlerinin bekleme süreleri. */
  qCd = 0;
  eCd = 0;
  /** Güçlendirme (taş yumruk) kalan süresi. */
  buffT = 0;
  /** Atılım sürüyorsa kalan süre; oyuncu bu sırada ileri savrulur. */
  rushT = 0;
  rushSpeed = 0;
  jumped = false;
  /** Buhar (R): kalan süre ve bekleme süresi. */
  steamT = 0;
  steamCd = 0;
  private steamTick = 0;
  /** Isırık: süren animasyonun zamanı (yoksa -1) ve bekleme süresi. */
  biteT = -1;
  biteCd = 0;
  private biteDone = false;
  private biteVictim: Giant | null = null;
  private ventT = 0;
  /** Dönüşümden bu yana geçen süre; yükseliş ve kükreyiş bitince -1. */
  emergeT = -1;
  /** Ağızdan çıkan dumanın zamanlayıcısı ve soluk döngüsü. */
  private smokeT = 0;
  private breathT = 0;
  private exhaling = false;
  private buffMult = 1;
  private rush: Extract<Ability, { kind: 'rush' }> | null = null;
  private readonly rushHit = new Set<Giant>();
  private slamCd = 0;
  private punchDone = false;
  private punchArm = 1;
  /** Bu yumruğun süresi, hasar çarpanı, sersemletmesi ve seri bitirici olup olmadığı. */
  private punchDur = 0.5;
  private punchMult = 1;
  private punchStun = 0;
  private finisher = false;
  /** Gard (G basılıyken): kollar yüzün önünde, önden gelen darbelerin çoğu engellenir. */
  guarding = false;
  /** Gardda art arda atılan yumrukların sırası; seriyi sürdürmek için kalan süre. */
  combo = 0;
  private comboT = 0;
  /** Bir darbe engellendikten sonraki karşı saldırı penceresi. */
  counterT = 0;
  /** Tekme (V): süren animasyonun zamanı (yoksa -1), süresi ve bekleme süresi. */
  kickT = -1;
  kickCd = 0;
  private kickDur = 0.7;
  private kickDone = false;
  private phase = 0;
  private warnT = 0;
  private readonly bodies = new Map<FormId, Body>();
  private readonly armStone = new THREE.Color(0xb9d3e6);
  /** Terk edilen dev gövdesi: oyuncu çıktıktan sonra yıkılır ve buharlaşır. */
  private husk: { body: Body; t: number; fall: Collapse; height: number } | null = null;
  private readonly boulder: THREE.Mesh;
  private readonly boulderVel = new THREE.Vector3();
  private boulderAb: Extract<Ability, { kind: 'throw' }> | null = null;

  constructor(private readonly game: Game) {
    const geo = new THREE.DodecahedronGeometry(2.4, 0);
    this.boulder = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x77736a, flatShading: true }));
    this.boulder.castShadow = true;
    this.boulder.visible = false;
    game.scene.add(this.boulder);
  }

  /** Formun modeli ilk dönüşümde kurulur, sonra saklanır. */
  private ensureBody(id: FormId) {
    let b = this.bodies.get(id);
    if (!b) {
      const d = FORMS[id];
      const model = buildHumanoid(d.height, d.palette, d.opts);
      model.root.visible = false;
      this.game.scene.add(model.root);
      b = { model, armBase: model.armMat.color.clone() };
      this.bodies.set(id, b);
    }
    return b;
  }

  get body() {
    return this.ensureBody(this.def.id).model;
  }

  /** Güçlendirme açık mı (yumruklar zırh kırar). */
  get stone() {
    return this.buffT > 0;
  }

  enter(id: FormId) {
    if (this.husk) this.clearHusk(); // eski gövde hâlâ yerdeyse kaldır
    this.def = FORMS[id];
    this.ensureBody(id).model.root.visible = true;
    this.punchT = -1;
    this.qCd = 0;
    this.eCd = 0;
    this.buffT = 0;
    this.rushT = 0;
    this.slamCd = 0;
    this.biteT = -1;
    this.biteCd = 0;
    this.steamT = 0;
    this.steamCd = 0;
    this.guarding = false;
    this.combo = 0;
    this.comboT = 0;
    this.counterT = 0;
    this.kickT = -1;
    this.kickCd = 0;
    this.jumped = false;
    this.emergeT = 0;
    this.breathT = 0;
    this.setStone(false);
  }

  /** Dönüşüm sürüyor mu (gövde yükselir ve kükrer; bu sırada hareket ve güç yok). */
  get emerging() {
    return this.emergeT >= 0;
  }

  /** Yükselişin 0..1 boyutu: hızlı büyür, sona doğru hafifçe taşıp yerine oturur. */
  private emergeScale() {
    const t = Math.min(1, this.emergeT / EMERGE.rise);
    const c = 1.9;
    const back = 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
    return 0.06 + 0.94 * back;
  }

  /** Ağzın dünyadaki konumu (v'ye yazar). */
  private mouth() {
    return this.body.head.localToWorld(v.copy(mouthOff));
  }

  /** Ağızdan duman: ileri ve yukarı savrulup yayılan gri buhar. */
  private puff(p: Player, n: number, speed: number, size: number) {
    const d = this.def;
    const m = this.mouth();
    const fx = Math.sin(p.faceYaw);
    const fz = Math.cos(p.faceYaw);
    for (let i = 0; i < n; i++) {
      const sp = speed * (0.6 + Math.random() * 0.6);
      const spread = speed * 0.25;
      this.game.smoke.emit(
        m.x + (Math.random() - 0.5) * d.height * 0.02,
        m.y,
        m.z + (Math.random() - 0.5) * d.height * 0.02,
        fx * sp + (Math.random() - 0.5) * spread,
        sp * 0.25 + Math.random() * spread * 0.5,
        fz * sp + (Math.random() - 0.5) * spread,
        1.4 + Math.random() * 1.2,
        Math.random() < 0.4 ? 0xd2d0cc : 0xa9a6a1,
        2 + d.height * 0.08,
        size * (0.7 + Math.random() * 0.6),
        2.4,
      );
    }
  }

  /** Dönüşüm sahnesi: buhar sütunu, gövdeden çatırdayan kıvılcımlar, sonra ağızdan fışkıran duman. */
  private updateEmerge(dt: number, p: Player) {
    const g = this.game;
    const d = this.def;
    const before = this.emergeT;
    this.emergeT += dt;
    const t = this.emergeT;
    const s = this.emergeScale();
    if (t < EMERGE.rise * 0.85) {
      // Gövdeyi saran buhar: dışa doğru açılır ki dev içinden görünsün.
      const n = Math.random() < 0.5 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = d.radius * (1.1 + Math.random() * 0.9);
        g.particles.emit(p.pos.x + Math.sin(a) * r, p.pos.y + Math.random() * d.height * s * 0.7, p.pos.z + Math.cos(a) * r, Math.sin(a) * (4 + d.height * 0.3), 3 + Math.random() * d.height * 0.4, Math.cos(a) * (4 + d.height * 0.3), 0.9 + Math.random() * 0.6, 0x6e6e6e, 4 + d.height * 0.15, 1 + d.height * 0.07, 1.6);
      }
      // Formun renginde çatırdayan kıvılcımlar.
      if (Math.random() < 0.35) {
        v.set(p.pos.x + (Math.random() - 0.5) * d.radius * 2, p.pos.y + Math.random() * d.height * s, p.pos.z + (Math.random() - 0.5) * d.radius * 2);
        g.particles.burst(v, 6, 14, 0.35, Math.random() < 0.5 ? 0xffffff : d.color, 1, 0, 0.6, -0.5);
      }
    }
    if (before < EMERGE.rise && t >= EMERGE.rise) {
      // Kükreyiş başlar: yer sarsılır, çevrede toz halkası, ağızdan büyük bir duman bulutu.
      g.shakeCam(1.4);
      g.rings.spawn(p.pos.x, p.pos.y, p.pos.z, d.height * 2.4 + 20, 0xd8cdb4, 0.8);
      g.hud.flash('#ffffff', 0.25, 0.35);
      this.puff(p, 24, 8 + d.height * 0.9, 1.2 + d.height * 0.1);
    }
    if (t >= EMERGE.rise && t < EMERGE.rise + EMERGE.roar) {
      this.puff(p, 2, 6 + d.height * 0.8, 1 + d.height * 0.08);
      if (Math.random() < 0.3) g.shakeCam(0.25);
    }
    if (t >= EMERGE.rise + EMERGE.roar) {
      this.emergeT = -1;
      this.smokeT = 0.2;
    }
  }

  /** Dönüştükten sonra ağızdan sürekli duman sızar; her soluk verişte bir bulut çıkar. */
  private updateSmoke(dt: number, p: Player, resting: boolean) {
    const d = this.def;
    // Dinlenirken solunum yavaş ve derin, hareket ederken hızlı ve kısa.
    this.breathT += dt * (resting ? 1.6 : 2.6);
    const exhale = Math.sin(this.breathT) > 0.35;
    if (exhale && !this.exhaling) {
      this.puff(p, 10, 2 + d.height * 0.22, 0.9 + d.height * 0.07);
      if (resting) this.game.audio.exhale(Math.min(1.4, d.height / 14));
    }
    this.exhaling = exhale;
    this.smokeT -= dt;
    if (this.smokeT > 0) return;
    this.smokeT = exhale ? 0.05 : 0.16;
    this.puff(p, 1, exhale ? 1.5 + d.height * 0.15 : 0.6 + d.height * 0.05, 0.6 + d.height * 0.05);
  }

  /** Formdan çıkış: gövde olduğu yerde kalır ve ölen bir dev gibi yıkılır. */
  exit() {
    this.setStone(false);
    this.rushT = 0;
    this.guarding = false;
    this.kickT = -1;
    this.emergeT = -1;
    const body = this.ensureBody(this.def.id);
    body.model.root.scale.setScalar(this.def.height);
    for (const b of this.bodies.values()) b.model.root.visible = b === body;
    for (const m of body.model.mats) m.transparent = true;
    this.husk = { body, t: 0, fall: newCollapse(1), height: this.def.height };
  }

  private clearHusk() {
    const h = this.husk;
    if (!h) return;
    h.body.model.root.visible = false;
    for (const m of h.body.model.mats) {
      m.opacity = 1;
      m.transparent = false;
    }
    resetPose(h.body.model);
    this.husk = null;
  }

  /** Boş gövdenin yıkılışı; her karede çağrılır. */
  tickHusk(dt: number) {
    const h = this.husk;
    if (!h) return;
    const g = this.game;
    h.t += dt;
    const m = h.body.model;
    const r = animateCollapse(m, h.t, dt, h.height, h.fall);
    const pos = m.root.position;
    const yaw = m.root.rotation.y;
    if (r.kneeHit || r.impactHit) {
      const force = r.impactHit ? 1 : 0.4;
      g.audio.stomp((h.height / 16) * force);
      g.shakeCam(Math.min(1.3, h.height / 12) * force);
      g.rings.spawn(pos.x + Math.sin(yaw) * h.height * (r.impactHit ? 0.45 : 0.1), pos.y, pos.z + Math.cos(yaw) * h.height * (r.impactHit ? 0.45 : 0.1), (h.height * 0.7 + 4) * (0.5 + force * 0.5), 0xd8cdb4, 0.7);
      for (let i = 0; i < 40 * force; i++) {
        const along = Math.random() * h.height * (r.impactHit ? 0.95 : 0.2);
        const side = Math.random() < 0.5 ? -1 : 1;
        const sp = 6 + Math.random() * (6 + h.height * 0.6);
        g.particles.emit(pos.x + Math.sin(yaw) * along, pos.y + 0.6, pos.z + Math.cos(yaw) * along, Math.cos(yaw) * side * sp, 2 + Math.random() * 3, -Math.sin(yaw) * side * sp, 1.3, 0xa39a86);
      }
    }
    // Buhar: önce enseden, yere serilince tüm gövdeden.
    const along = r.since > 0 ? Math.random() * h.height * 0.9 : 0;
    const y = r.since > 0 ? pos.y + h.height * 0.08 : m.nape.getWorldPosition(v).y;
    g.particles.emit(pos.x + Math.sin(yaw) * along + (Math.random() - 0.5) * 3, y, pos.z + Math.cos(yaw) * along + (Math.random() - 0.5) * 3, 0, 3 + h.height * 0.12, 0, 2, 0xd0d0d0, 8);
    if (r.since > 1.2) {
      const o = Math.max(0, 1 - (r.since - 1.2) / 2.2);
      for (const mat of m.mats) mat.opacity = o;
      if (o <= 0) this.clearHusk();
    }
  }

  private setStone(on: boolean) {
    const b = this.ensureBody(this.def.id);
    b.model.armMat.color.copy(on ? this.armStone : b.armBase);
    b.model.armMat.emissive.setHex(on ? 0x2a4458 : 0x000000);
  }

  /** Güç bedelini bardan öder; yetmiyorsa uyarır. */
  private pay(cost: number) {
    if (this.game.meter.spend(cost)) return true;
    if (this.warnT <= 0) {
      this.warnT = 1.5;
      this.game.hud.toast('Bu güç için yeterli bar yok');
    }
    return false;
  }

  /** Bir dairenin içindeki canlı devlere vurur; vurulan sayısını döner. */
  private hitArea(p: Player, x: number, z: number, radius: number, dmg: number, armorBreak: boolean, stun = 0, once?: Set<Giant>, hit: TitanHitOpts = {}) {
    const g = this.game;
    let n = 0;
    for (const gi of g.giants) {
      if (!gi.alive || once?.has(gi)) continue;
      if (Math.hypot(gi.pos.x - x, gi.pos.z - z) > radius + gi.radius) continue;
      once?.add(gi);
      // Gardda karşılanan darbe sayılmaz: dev sersemlemez, kıvılcım yerine engel efekti çıkar.
      if (gi.titanHit(dmg, g, armorBreak, p.pos, false, hit) === 'blocked') continue;
      if (stun > 0 && gi.alive) gi.stun(gi.heavy ? stun * 0.5 : stun);
      v.set(gi.pos.x, gi.pos.y + Math.min(gi.h, this.def.height) * 0.7, gi.pos.z);
      g.particles.burst(v, 22, 18, 0.8, armorBreak ? 0xbfe0ff : this.def.color, 2);
      n++;
    }
    return n;
  }

  private ring(p: Player, radius: number, y: number, color: number) {
    const g = this.game;
    g.rings.spawn(p.pos.x, g.world.heightAt(p.pos.x, p.pos.z), p.pos.z, radius, color, 0.45 + Math.min(0.5, radius / 90));
    const n = Math.round(40 + radius);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      g.particles.emit(p.pos.x, p.pos.y + y, p.pos.z, Math.sin(a) * radius * 1.1, 3, Math.cos(a) * radius * 1.1, 1.1, color);
    }
  }

  /** Bir saldırı animasyonu sürüyor mu (yumruk, ısırık, atılım, tekme). */
  get busy() {
    return this.punchT >= 0 || this.biteT >= 0 || this.rushT > 0 || this.kickT >= 0;
  }

  /** G basılı mı: yerdeyken ve başka bir saldırı (yumruk dışında) sürmüyorken gard alınır. */
  setGuard(on: boolean, p: Player) {
    this.guarding = on && !this.emerging && p.onGround && this.biteT < 0 && this.rushT <= 0 && this.kickT < 0;
  }

  /**
   * Yumruk. Gardda atılan yumruklar seriye bağlanır: daha hızlı çıkar, her vuruş bir öncekinden sert vurur,
   * her dördüncüsü gardı kıran ve sersemleten bir aparkattır. Engellenen bir darbeden hemen sonraki yumruklar da sert vurur.
   */
  punch(p: Player) {
    const pn = this.def.punch;
    const G = CFG.guard;
    if (this.busy || !this.pay(pn.cost)) return;
    this.punchT = 0;
    this.punchDone = false;
    this.punchArm *= -1;
    this.punchDur = pn.time;
    this.punchMult = this.counterT > 0 ? G.counter : 1;
    this.punchStun = 0;
    this.finisher = false;
    if (this.guarding) {
      this.combo = this.comboT > 0 ? this.combo + 1 : 1;
      this.comboT = 0;
      this.punchDur = pn.time * G.punchTime;
      this.punchMult *= 1 + G.step * Math.min(this.combo - 1, 6);
      if (this.combo % G.finishEvery === 0) {
        this.finisher = true;
        this.punchMult *= G.finisher;
        this.punchStun = G.finisherStun;
        this.punchDur = pn.time * 0.9;
      }
      if (this.combo >= 2) this.game.hud.callout(this.finisher ? 'APARKAT' : `SERİ ×${this.combo}`);
    } else {
      this.combo = 0;
    }
    p.faceYaw = this.game.aimYaw();
    this.game.audio.swing();
    // Önündeki devler yumruğun geldiğini görür; bazıları gardını alır.
    const reach = pn.reach + pn.range + 6;
    for (const gi of this.game.giants) {
      if (!gi.alive) continue;
      const dx = gi.pos.x - p.pos.x;
      const dz = gi.pos.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d - gi.radius > reach || Math.abs(angDiff(Math.atan2(dx, dz), p.faceYaw)) > 1.1) continue;
      gi.threat(this.game);
    }
  }

  /** Tekme (V): yumruktan uzağa uzanır; devi geri iter, sersemletir ve gardını kırar. */
  kick(p: Player) {
    const K = CFG.kick;
    if (this.busy || this.kickCd > 0 || !p.onGround || this.emerging) return;
    if (!this.pay(K.cost)) return;
    this.kickT = 0;
    this.kickDone = false;
    this.kickCd = K.cd;
    this.kickDur = Math.min(K.maxTime, Math.max(K.minTime, this.def.punch.time * 1.3));
    this.guarding = false;
    p.faceYaw = this.game.aimYaw();
    this.game.audio.kick();
  }

  /**
   * Gardda önden gelen bir darbe: engellenen oranı döner (0 = engellenmedi). `pierce` gardı delen oran (tekme gibi).
   * Engellenen her darbe kısa bir karşı saldırı penceresi açar.
   */
  blockFrom(p: Player, from: THREE.Vector3, pierce = 0) {
    if (!this.guarding) return 0;
    const yawTo = Math.atan2(from.x - p.pos.x, from.z - p.pos.z);
    if (Math.abs(angDiff(yawTo, p.faceYaw)) > CFG.guard.arc) return 0;
    const g = this.game;
    const d = this.def;
    this.counterT = CFG.guard.counterT;
    g.audio.block();
    v.set(p.pos.x + Math.sin(p.faceYaw) * d.radius * 1.2, p.pos.y + d.height * 0.72, p.pos.z + Math.cos(p.faceYaw) * d.radius * 1.2);
    g.particles.burst(v, 16, 10 + d.height * 0.4, 0.45, 0xfff0d0, d.radius * 0.6);
    g.smoke.burst(v, 5, 4, 1.2, 0x9a948a, d.radius * 0.5, 2, 2 + d.height * 0.12, 1.2);
    return CFG.guard.block * (1 - pierce);
  }

  /** Önündeki en yakın dev: ısırığın hedefi. */
  private biteTarget(p: Player, slack = 1) {
    const yaw = this.game.aimYaw();
    const reach = (this.def.height * 0.55 + 2) * slack;
    let best: Giant | null = null;
    let bestD = Infinity;
    for (const gi of this.game.giants) {
      if (!gi.alive) continue;
      const dx = gi.pos.x - p.pos.x;
      const dz = gi.pos.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d - gi.radius > reach || d >= bestD) continue;
      if (d > 1 && (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / d < 0.2) continue; // arkadaki ısırılmaz
      best = gi;
      bestD = d;
    }
    return best;
  }

  /**
   * Isırık (F): önündeki deve atılıp dişlerini geçirir. Tek hedefe ağır, zırh delen hasar;
   * hedef ölürse bir miktar bar geri kazanılır.
   */
  bite(p: Player) {
    const B = CFG.titan.bite;
    if (this.biteT >= 0 || this.punchT >= 0 || this.rushT > 0 || this.biteCd > 0) return;
    const gi = this.biteTarget(p);
    if (!gi) {
      if (this.warnT <= 0) {
        this.warnT = 1.5;
        this.game.hud.toast('Isıracak kadar yakın dev yok');
      }
      return;
    }
    if (!this.pay(B.cost)) return;
    this.biteT = 0;
    this.biteDone = false;
    this.biteCd = B.cd;
    this.biteVictim = gi;
    p.faceYaw = Math.atan2(gi.pos.x - p.pos.x, gi.pos.z - p.pos.z);
    this.game.audio.giant('growl', this.def.height, p.pos.x, p.pos.z, 1.6);
  }

  /** Buhar etki alanının yarıçapı (forma göre). */
  get steamRadius() {
    return this.def.height * CFG.titan.steam.radius + 8;
  }

  /**
   * Buhar (R): gövdenin her yerinden kaynar buhar fışkırır. Süre boyunca çevredeki devler
   * haşlanır, geri itilir ve sersemler; zırhlılar daha az etkilenir.
   */
  steam(p: Player) {
    const S = CFG.titan.steam;
    if (this.steamT > 0 || this.steamCd > 0 || !this.pay(S.cost)) return;
    this.steamT = S.dur;
    this.steamCd = S.cd;
    this.steamTick = 0;
    const g = this.game;
    g.audio.steam(S.dur);
    g.shakeCam(0.5);
    g.rings.spawn(p.pos.x, p.pos.y, p.pos.z, this.steamRadius, 0xeeeeee, 0.6);
    g.hud.toast(`${S.name.toLocaleUpperCase('tr')} — çevrendeki devler haşlanıyor`);
  }

  private updateSteam(dt: number, p: Player) {
    const S = CFG.titan.steam;
    if (this.steamCd > 0) this.steamCd -= dt;
    if (this.steamT <= 0) return;
    this.steamT -= dt;
    const g = this.game;
    const d = this.def;
    const R = this.steamRadius;
    const fade = Math.min(1, this.steamT / 0.6);
    // Buhar gövdeden fışkırır ve dışa doğru yayılarak alanı doldurur.
    const n = Math.round((3 + d.height * 0.18) * fade);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const y = p.pos.y + Math.random() * d.height * 0.9;
      const r0 = d.radius * (0.4 + Math.random() * 0.6);
      const sp = R * (0.8 + Math.random() * 0.8);
      const sx = Math.sin(a);
      const sz = Math.cos(a);
      g.smoke.emit(p.pos.x + sx * r0, y, p.pos.z + sz * r0, sx * sp, 2 + Math.random() * 6, sz * sp, 1.1 + Math.random() * 0.8, Math.random() < 0.5 ? 0xf2f2f0 : 0xd6d6d2, 4, 2 + d.height * 0.12, 3);
      if (i % 3 === 0) g.particles.emit(p.pos.x + sx * r0, y, p.pos.z + sz * r0, sx * sp * 0.7, 3, sz * sp * 0.7, 0.8, 0xbfbfbf, 6, 2 + d.height * 0.1, 2);
    }
    this.steamTick -= dt;
    if (this.steamTick > 0) return;
    this.steamTick = S.tick;
    for (const gi of g.giants) {
      if (!gi.alive) continue;
      const dist = Math.hypot(gi.pos.x - p.pos.x, gi.pos.z - p.pos.z);
      if (dist > R + gi.radius) continue;
      // Merkeze yakın olan daha çok haşlanır.
      const k = 1 - Math.min(0.6, dist / (R + gi.radius));
      gi.titanHit(S.dps * S.tick * k, g, false, p.pos, true);
      gi.napeWorld(v);
      g.particles.emit(v.x, v.y, v.z, 0, 5, 0, 0.8, 0xffffff, 6, 2.4, 1.8);
    }
  }

  /** Q ya da E gücünü kullanır. */
  cast(slot: 'q' | 'e', p: Player) {
    const ab = this.def[slot];
    const cd = slot === 'q' ? this.qCd : this.eCd;
    if (cd > 0 || this.rushT > 0 || this.biteT >= 0 || !this.pay(ab.cost)) return;
    if (slot === 'q') this.qCd = ab.cd;
    else this.eCd = ab.cd;
    const g = this.game;
    const H = this.def.height;
    switch (ab.kind) {
      case 'stun': {
        for (const gi of g.giants) {
          if (gi.alive && Math.hypot(gi.pos.x - p.pos.x, gi.pos.z - p.pos.z) < ab.radius) gi.stun(gi.heavy ? ab.stun * 0.5 : ab.stun);
        }
        g.audio.roar();
        g.shakeCam(1);
        this.ring(p, ab.radius * 0.8, H * 0.85, this.def.color);
        g.hud.toast(`${ab.name.toLocaleUpperCase('tr')} — devler sersemledi`);
        break;
      }
      case 'buff':
        this.buffT = ab.dur;
        this.buffMult = ab.mult;
        this.setStone(true);
        g.audio.clang();
        g.hud.toast(`${ab.name.toLocaleUpperCase('tr')} — zırh kırılır`);
        break;
      case 'rush':
        this.rush = ab;
        this.rushT = ab.time;
        this.rushSpeed = ab.speed;
        this.rushHit.clear();
        p.faceYaw = g.aimYaw();
        g.audio.gas();
        g.audio.swing();
        break;
      case 'burst':
        this.hitArea(p, p.pos.x, p.pos.z, ab.radius, ab.dmg * this.mult, ab.armorBreak || this.stone, ab.stun);
        g.audio.stomp();
        g.shakeCam(1.1);
        this.ring(p, ab.radius, 1, this.def.color);
        this.ring(p, ab.radius * 0.6, 0.6, 0xa39a86);
        break;
      case 'beam': {
        // Ağızdan çıkan ışın: bakılan yönde uzun, dar bir hattaki her deve vurur.
        p.faceYaw = g.aimYaw();
        const sx = Math.sin(p.faceYaw);
        const sz = Math.cos(p.faceYaw);
        for (const gi of [...g.giants]) {
          if (!gi.alive) continue;
          const rx = gi.pos.x - p.pos.x;
          const rz = gi.pos.z - p.pos.z;
          const along = rx * sx + rz * sz;
          if (along < 0 || along > ab.length + gi.radius) continue;
          if (Math.abs(rx * sz - rz * sx) > ab.width / 2 + gi.radius) continue;
          gi.titanHit(ab.dmg * this.mult, g, ab.armorBreak || this.stone, p.pos);
        }
        const y = p.pos.y + H * 0.82;
        for (let i = 0; i < 90; i++) {
          const d = 3 + (i / 90) * ab.length;
          g.particles.emit(p.pos.x + sx * d, y - d * 0.02 + (Math.random() - 0.5) * 2, p.pos.z + sz * d, sx * 30, (Math.random() - 0.5) * 6, sz * 30, 0.5 + Math.random() * 0.4, i % 3 === 0 ? 0xffffff : this.def.color);
        }
        v.set(p.pos.x + sx * 8, y, p.pos.z + sz * 8);
        look.set(sx, 0, sz);
        g.slashes.spawn(v, look, 7, this.def.color, Math.PI / 2, 0.45);
        g.audio.beam();
        g.shakeCam(0.9);
        g.hud.flash('#ffffff', 0.18, 0.3);
        break;
      }
      case 'throw': {
        // Kaya, elden nişan alınan noktaya balistik bir yay çizer.
        const b = this.boulder;
        b.position.set(p.pos.x + Math.sin(p.faceYaw) * 3, p.pos.y + H * 0.85, p.pos.z + Math.cos(p.faceYaw) * 3);
        const aim = g.aimPoint;
        let dx = aim.x - p.pos.x;
        let dz = aim.z - p.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        const range = Math.min(240, Math.max(25, d));
        dx = (dx / d) * range;
        dz = (dz / d) * range;
        const tx = p.pos.x + dx;
        const tz = p.pos.z + dz;
        const ty = g.world.heightAt(tx, tz);
        const T = Math.max(0.6, range / ab.speed);
        this.boulderVel.set((tx - b.position.x) / T, (ty - b.position.y) / T + 0.5 * BOULDER_G * T, (tz - b.position.z) / T);
        b.visible = true;
        this.boulderAb = ab;
        p.faceYaw = Math.atan2(dx, dz);
        this.punchT = 0;
        this.punchDone = true; // yalnızca fırlatma animasyonu; yumruk hasarı yok
        this.punchArm = 1;
        g.audio.swing();
        break;
      }
    }
  }

  private get mult() {
    return this.stone ? this.buffMult : 1;
  }

  /** Sıçrayıştan inerken (ya da zıplayamayan formda Space ile) çevreyi ezer. */
  slam(p: Player) {
    const g = this.game;
    const s = this.def.slam;
    if (this.slamCd > 0 || !g.meter.spend(s.cost)) return;
    this.slamCd = 1.2;
    this.hitArea(p, p.pos.x, p.pos.z, s.radius, s.dmg * this.mult, this.stone || this.def.punch.armorBreak);
    g.audio.stomp();
    g.shakeCam(1);
    this.ring(p, s.radius * 0.7, 0.5, 0x9a8f7a);
  }

  update(dt: number, p: Player) {
    const g = this.game;
    const d = this.def;
    if (this.emerging) {
      this.updateEmerge(dt, p);
      return;
    }
    this.updateSteam(dt, p);
    if (this.qCd > 0) this.qCd -= dt;
    if (this.eCd > 0) this.eCd -= dt;
    if (this.slamCd > 0) this.slamCd -= dt;
    if (this.warnT > 0) this.warnT -= dt;
    if (this.kickCd > 0) this.kickCd -= dt;
    if (this.counterT > 0) this.counterT -= dt;
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
    if (this.buffT > 0) {
      this.buffT -= dt;
      if (this.buffT <= 0) this.setStone(false);
    }
    if (this.rushT > 0 && this.rush) {
      this.rushT -= dt;
      const hits = this.hitArea(p, p.pos.x, p.pos.z, this.rush.hitRadius, this.rush.dmg * this.mult, this.rush.armorBreak || this.stone, 0, this.rushHit);
      if (hits > 0) {
        g.audio.hit();
        g.shakeCam(0.7);
      }
      g.particles.emit(p.pos.x, p.pos.y + 1, p.pos.z, 0, 4, 0, 0.7, 0xa39a86);
    }
    if (this.punchT >= 0) {
      this.punchT += dt;
      if (!this.punchDone && this.punchT >= this.punchDur * 0.45) {
        this.punchDone = true;
        const cx = p.pos.x + Math.sin(p.faceYaw) * d.punch.reach;
        const cz = p.pos.z + Math.cos(p.faceYaw) * d.punch.reach;
        const hits = this.hitArea(p, cx, cz, d.punch.range, d.punch.dmg * this.mult * this.punchMult, d.punch.armorBreak || this.stone, this.punchStun, undefined, { melee: true, guardBreak: this.finisher, push: this.finisher ? 6 : this.combo > 0 ? 1.2 : undefined });
        if (hits > 0) {
          g.audio.hit();
          g.shakeCam(this.finisher ? 0.9 : 0.6);
          // Yumruğun savrulduğu yönde bir darbe izi (aparkat yukarı doğru savrulur).
          v.set(cx, p.pos.y + d.height * 0.62, cz);
          look.set(Math.sin(p.faceYaw), this.finisher ? 0.8 : 0, Math.cos(p.faceYaw));
          g.slashes.spawn(v, look, d.height * (this.finisher ? 0.3 : 0.2) + 1.5, this.stone ? 0xbfe0ff : d.color, this.finisher ? 1.4 : this.punchArm * 0.5, 0.26);
        }
      }
      if (this.punchT >= this.punchDur) {
        this.punchT = -1;
        if (this.combo > 0) this.comboT = CFG.guard.window;
      }
    }
    if (this.kickT >= 0) {
      const K = CFG.kick;
      this.kickT += dt;
      if (!this.kickDone && this.kickT >= this.kickDur * 0.5) {
        this.kickDone = true;
        const reach = d.punch.reach * K.reach;
        const cx = p.pos.x + Math.sin(p.faceYaw) * reach;
        const cz = p.pos.z + Math.cos(p.faceYaw) * reach;
        const hits = this.hitArea(p, cx, cz, d.punch.range * K.range, d.punch.dmg * K.dmg * this.mult, d.punch.armorBreak || this.stone, K.stun, undefined, { melee: true, guardBreak: true, push: K.push });
        v.set(cx, p.pos.y + d.height * 0.35, cz);
        if (hits > 0) {
          g.audio.hit();
          g.audio.stomp();
          g.shakeCam(0.8);
          look.set(Math.sin(p.faceYaw), 0.25, Math.cos(p.faceYaw));
          g.slashes.spawn(v, look, d.height * 0.25 + 1.5, this.stone ? 0xbfe0ff : d.color, 0, 0.3);
        }
        g.smoke.burst(v, 6, 6, 1.1, 0xa39a86, d.radius, 1.5, 2 + d.height * 0.15, 1.3);
      }
      if (this.kickT >= this.kickDur) this.kickT = -1;
    }
    if (this.biteCd > 0) this.biteCd -= dt;
    if (this.biteT >= 0) {
      const B = CFG.titan.bite;
      this.biteT += dt;
      if (!this.biteDone && this.biteT >= B.time * 0.55) {
        this.biteDone = true;
        const gi = this.biteVictim;
        this.body.head.getWorldPosition(v);
        v.x += Math.sin(p.faceYaw) * d.height * 0.12;
        v.z += Math.cos(p.faceYaw) * d.height * 0.12;
        // Hedef bu arada uzaklaştıysa dişler boşa kapanır.
        if (gi && gi.alive && Math.hypot(gi.pos.x - p.pos.x, gi.pos.z - p.pos.z) - gi.radius < (d.height * 0.55 + 2) * 1.5) {
          g.biteFx(v, p.faceYaw, d.height * 0.16 + 1, d.color);
          gi.titanHit(d.punch.dmg * B.dmgMult * this.mult, g, true, p.pos);
          if (!gi.alive) {
            g.meter.refund(B.refund);
            g.hud.toast(`Isırık — bar +${B.refund}`);
          }
          g.shakeCam(0.8);
        } else {
          g.audio.bite(0.5);
        }
        this.biteVictim = null;
      }
      if (this.biteT >= B.time) this.biteT = -1;
    }
    this.updateBoulder(dt, p);
  }

  private updateBoulder(dt: number, p: Player) {
    const b = this.boulder;
    const ab = this.boulderAb;
    if (!b.visible || !ab) return;
    const g = this.game;
    this.boulderVel.y -= BOULDER_G * dt;
    b.position.addScaledVector(this.boulderVel, dt);
    b.rotation.x += dt * 5;
    b.rotation.z += dt * 3;
    if (b.position.y > g.world.heightAt(b.position.x, b.position.z) + 1) return;
    // Çarpma: geniş alan hasarı; kaya her zırhı kırar.
    b.visible = false;
    this.boulderAb = null;
    this.hitArea(p, b.position.x, b.position.z, ab.radius, ab.dmg, true);
    g.audio.stomp();
    const dist = Math.hypot(b.position.x - p.pos.x, b.position.z - p.pos.z);
    g.shakeCam(Math.max(0.2, 1 - dist / 200));
    g.particles.burst(b.position, 70, 26, 1.4, 0xa39a86, 3, 3, 3, 1.8);
    g.rings.spawn(b.position.x, b.position.y, b.position.z, ab.radius * 1.5, 0xe0d4b8, 0.6);
    g.particles.burst(b.position, 30, 16, 0.9, this.def.color, 2);
  }

  animate(dt: number, p: Player, moving: boolean) {
    const b = this.body;
    const d = this.def;
    b.root.position.copy(p.pos);
    b.root.rotation.y = p.faceYaw;
    b.root.scale.setScalar(d.height * (this.emerging ? this.emergeScale() : 1));
    const hs = Math.hypot(p.vel.x, p.vel.z);
    if (moving && p.onGround) this.phase += (hs * dt) / (d.height * 0.2);
    const swing = moving && p.onGround ? Math.sin(this.phase) * 0.7 : 0;
    let aL = -swing * 0.6;
    let aR = swing * 0.6;
    let lL = swing;
    let lR = -swing;
    let tilt = Math.min(0.3, hs / 70);
    if (!p.onGround) {
      aL = aR = -2.6;
      lL = lR = 0.4;
      tilt = 0.25;
    }
    if (this.rushT > 0) {
      // Atılım: omuz önde, kollar geride.
      tilt = 0.55;
      aL = aR = 0.9;
    }
    let punchElbow: number | undefined;
    let guardElbowL: number | undefined;
    let guardElbowR: number | undefined;
    let inL = 0;
    let inR = 0;
    let kneeR: number | undefined;
    let tiltRate = 8;
    if (this.guarding) {
      // Gard: yumruklar çenenin önünde, dirsekler kapalı, çene göğüste, ayaklar biri önde.
      aL = aR = -1.15;
      guardElbowL = guardElbowR = -2.15;
      // Kollar kendi ekseninde içe döner: önkollar yüzün önünde birleşir.
      inL = 0.55;
      inR = -0.55;
      tilt = 0.14;
      if (!moving) {
        lL = -0.22;
        lR = 0.18;
      } else {
        lL *= 0.6;
        lR *= 0.6;
      }
    }
    if (this.punchT >= 0) {
      const t = this.punchT / this.punchDur;
      let a: number;
      if (this.finisher) {
        // Aparkat: kol aşağıdan yukarı savrulur, gövde arkaya yaslanır.
        a = t < 0.4 ? lerp(-0.6, 0.4, t / 0.4) : lerp(0.4, -2.5, Math.min(1, (t - 0.4) / 0.3));
        punchElbow = t < 0.4 ? -1.9 : -0.7;
        tilt = t < 0.4 ? 0.3 : -0.12;
        tiltRate = 16;
      } else if (this.guarding) {
        // Gardda kısa düz yumruk: gard yüksekliğinden çıkıp gard yüksekliğine döner.
        a = t < 0.45 ? lerp(-1.15, -1.62, t / 0.45) : lerp(-1.62, -1.15, (t - 0.45) / 0.55);
        punchElbow = t < 0.25 ? -2.1 : t < 0.7 ? -0.08 : -1.6;
        tilt = 0.2;
      } else {
        a = t < 0.45 ? lerp(0.9, -1.6, t / 0.45) : lerp(-1.6, -0.6, (t - 0.45) / 0.55);
        tilt = 0.25;
        // Kol önce bükülür, vuruş anında açılır.
        punchElbow = t < 0.3 ? -1.7 : -0.15;
      }
      if (this.punchArm > 0) {
        aR = a;
        inR = 0;
        guardElbowR = undefined;
      } else {
        aL = a;
        inL = 0;
        guardElbowL = undefined;
      }
    }
    if (this.kickT >= 0) {
      // Tekme: diz göğse çekilir, bacak ileri açılır, sonra geri toplanır; kollar dengeyi tutar.
      const t = this.kickT / this.kickDur;
      tiltRate = 16;
      lL = 0.12;
      aL = -0.7;
      aR = 0.5;
      if (t < 0.4) {
        lR = lerp(0, -1.35, t / 0.4);
        kneeR = 1.9;
        tilt = -0.1;
      } else if (t < 0.7) {
        lR = -1.6;
        kneeR = 0.04;
        tilt = -0.26;
      } else {
        lR = lerp(-1.6, 0, (t - 0.7) / 0.3);
        kneeR = 1.1;
        tilt = -0.1;
      }
    }
    let headX = this.guarding ? 0.22 : 0;
    let jaw = 0;
    const resting = !moving && p.onGround && !this.busy && !this.guarding;
    if (resting) {
      // Dinlenme: derin nefes alır, omuzlar inip kalkar, ensesinden buhar sızar.
      const br = Math.sin(performance.now() * 0.0016);
      tilt = 0.05 + br * 0.03;
      aL = 0.08 + br * 0.05;
      aR = 0.08 - br * 0.03;
      headX = 0.1 - br * 0.05;
      jaw = 0.08 + Math.max(0, -br) * 0.12;
      this.ventT -= dt;
      if (this.ventT <= 0) {
        this.ventT = 0.3;
        b.nape.getWorldPosition(v);
        this.game.particles.emit(v.x + (Math.random() - 0.5) * d.radius, v.y, v.z + (Math.random() - 0.5) * d.radius, 0, 1.5 + d.height * 0.05, 0, 1.8, 0x7c7c7c, 5, 1.4, 1.2);
      }
    }
    if (this.emerging) {
      tiltRate = 10;
      if (this.emergeT < EMERGE.rise) {
        // Yükseliş: kambur, baş önde, kollar sarkık; sonra doğrulur.
        const t = this.emergeT / EMERGE.rise;
        tilt = lerp(0.75, 0.2, t);
        headX = lerp(0.6, 0.1, t);
        aL = aR = lerp(0.7, 0.2, t);
        lL = lR = 0;
        jaw = 0.1;
      } else {
        // Kükreyiş: göğüs dışarı, baş geride, çene sonuna kadar açık, kollar geriye gerilmiş.
        const shiver = Math.sin(performance.now() * 0.06) * 0.03;
        tilt = -0.22 + shiver;
        headX = -0.6 + shiver;
        jaw = 1;
        aL = aR = 0.55;
        lL = -0.12;
        lR = 0.12;
      }
    } else if (p.mode === 'titan') {
      this.updateSmoke(dt, p, resting);
    }
    if (this.biteT >= 0) {
      // Isırık: baş geri çekilir, çene açılır; sonra gövde öne atılır ve çene kapanır.
      const t = this.biteT / CFG.titan.bite.time;
      tiltRate = 22;
      if (t < 0.4) {
        tilt = -0.18;
        headX = -0.5;
        jaw = 0.95;
        aL = aR = 0.7;
      } else {
        tilt = 0.6;
        headX = 0.3;
        jaw = t < 0.55 ? 0.95 : 0;
        aL = aR = 0.9;
        // Atılırken bir ayak öne basar, öbürü geride kalır.
        lL = -0.75;
        lR = 0.45;
      }
    }
    const k = 1 - Math.exp(-dt * 18);
    b.armL.rotation.x = lerp(b.armL.rotation.x, aL, k);
    b.armR.rotation.x = lerp(b.armR.rotation.x, aR, k);
    b.legL.rotation.x = lerp(b.legL.rotation.x, lL, k);
    b.legR.rotation.x = lerp(b.legR.rotation.x, lR, k);
    b.tilt.rotation.x = lerp(b.tilt.rotation.x, tilt, 1 - Math.exp(-dt * tiltRate));
    b.head.rotation.x = lerp(b.head.rotation.x, headX, k);
    b.jaw.rotation.x = lerp(b.jaw.rotation.x, jaw, 1 - Math.exp(-dt * 26));
    b.armL.rotation.z = lerp(b.armL.rotation.z, 0, k);
    b.armR.rotation.z = lerp(b.armR.rotation.z, 0, k);
    b.armL.rotation.y = lerp(b.armL.rotation.y, inL, k);
    b.armR.rotation.y = lerp(b.armR.rotation.y, inR, k);
    autoBend(b, k, {
      elbowL: this.punchArm > 0 ? guardElbowL : (punchElbow ?? guardElbowL),
      elbowR: this.punchArm > 0 ? (punchElbow ?? guardElbowR) : guardElbowR,
      kneeR,
    });
  }
}
