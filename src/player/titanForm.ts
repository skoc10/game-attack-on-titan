import * as THREE from 'three';
import type { Game } from '../game';
import type { Giant } from '../enemies/giant';
import type { Player } from './player';
import { lerp } from '../core/rng';
import { FORMS, type Ability, type FormId, type TitanDef } from '../data/titans';
import { autoBend, buildHumanoid, type Humanoid } from '../enemies/humanoid';
import { animateCollapse, newCollapse, resetPose, type Collapse } from '../enemies/collapse';

const v = new THREE.Vector3();
const look = new THREE.Vector3();
const BOULDER_G = 40;

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
  private buffMult = 1;
  private rush: Extract<Ability, { kind: 'rush' }> | null = null;
  private readonly rushHit = new Set<Giant>();
  private slamCd = 0;
  private punchDone = false;
  private punchArm = 1;
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
    this.jumped = false;
    this.setStone(false);
  }

  /** Formdan çıkış: gövde olduğu yerde kalır ve ölen bir dev gibi yıkılır. */
  exit() {
    this.setStone(false);
    this.rushT = 0;
    const body = this.ensureBody(this.def.id);
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
  private hitArea(p: Player, x: number, z: number, radius: number, dmg: number, armorBreak: boolean, stun = 0, once?: Set<Giant>) {
    const g = this.game;
    let n = 0;
    for (const gi of g.giants) {
      if (!gi.alive || once?.has(gi)) continue;
      if (Math.hypot(gi.pos.x - x, gi.pos.z - z) > radius + gi.radius) continue;
      once?.add(gi);
      gi.titanHit(dmg, g, armorBreak, p.pos);
      if (stun > 0 && gi.alive) gi.stun(gi.type.kind === 'boss' ? stun * 0.5 : stun);
      v.set(gi.pos.x, gi.pos.y + Math.min(gi.h, this.def.height) * 0.7, gi.pos.z);
      g.particles.burst(v, 22, 18, 0.8, armorBreak ? 0xbfe0ff : this.def.color, 2);
      n++;
    }
    return n;
  }

  private ring(p: Player, radius: number, y: number, color: number) {
    const g = this.game;
    const n = Math.round(40 + radius);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      g.particles.emit(p.pos.x, p.pos.y + y, p.pos.z, Math.sin(a) * radius * 1.1, 3, Math.cos(a) * radius * 1.1, 1.1, color);
    }
  }

  punch(p: Player) {
    const pn = this.def.punch;
    if (this.punchT >= 0 || this.rushT > 0 || !this.pay(pn.cost)) return;
    this.punchT = 0;
    this.punchDone = false;
    this.punchArm *= -1;
    p.faceYaw = this.game.aimYaw();
    this.game.audio.swing();
  }

  /** Q ya da E gücünü kullanır. */
  cast(slot: 'q' | 'e', p: Player) {
    const ab = this.def[slot];
    const cd = slot === 'q' ? this.qCd : this.eCd;
    if (cd > 0 || this.rushT > 0 || !this.pay(ab.cost)) return;
    if (slot === 'q') this.qCd = ab.cd;
    else this.eCd = ab.cd;
    const g = this.game;
    const H = this.def.height;
    switch (ab.kind) {
      case 'stun': {
        for (const gi of g.giants) {
          if (gi.alive && Math.hypot(gi.pos.x - p.pos.x, gi.pos.z - p.pos.z) < ab.radius) gi.stun(gi.type.kind === 'boss' ? ab.stun * 0.5 : ab.stun);
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
    if (this.qCd > 0) this.qCd -= dt;
    if (this.eCd > 0) this.eCd -= dt;
    if (this.slamCd > 0) this.slamCd -= dt;
    if (this.warnT > 0) this.warnT -= dt;
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
      if (!this.punchDone && this.punchT >= d.punch.time * 0.45) {
        this.punchDone = true;
        const cx = p.pos.x + Math.sin(p.faceYaw) * d.punch.reach;
        const cz = p.pos.z + Math.cos(p.faceYaw) * d.punch.reach;
        if (this.hitArea(p, cx, cz, d.punch.range, d.punch.dmg * this.mult, d.punch.armorBreak || this.stone) > 0) {
          g.audio.hit();
          g.shakeCam(0.6);
        }
      }
      if (this.punchT >= d.punch.time) this.punchT = -1;
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
    g.particles.burst(b.position, 70, 26, 1.4, 0xa39a86, 3, 3);
    g.particles.burst(b.position, 30, 16, 0.9, this.def.color, 2);
  }

  animate(dt: number, p: Player, moving: boolean) {
    const b = this.body;
    const d = this.def;
    b.root.position.copy(p.pos);
    b.root.rotation.y = p.faceYaw;
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
    if (this.punchT >= 0) {
      const t = this.punchT / d.punch.time;
      const a = t < 0.45 ? lerp(0.9, -1.6, t / 0.45) : lerp(-1.6, -0.6, (t - 0.45) / 0.55);
      if (this.punchArm > 0) aR = a;
      else aL = a;
      tilt = 0.25;
      // Kol önce bükülür, vuruş anında açılır.
      punchElbow = t < 0.3 ? -1.7 : -0.15;
    }
    const k = 1 - Math.exp(-dt * 18);
    b.armL.rotation.x = lerp(b.armL.rotation.x, aL, k);
    b.armR.rotation.x = lerp(b.armR.rotation.x, aR, k);
    b.legL.rotation.x = lerp(b.legL.rotation.x, lL, k);
    b.legR.rotation.x = lerp(b.legR.rotation.x, lR, k);
    b.tilt.rotation.x = lerp(b.tilt.rotation.x, tilt, 1 - Math.exp(-dt * 8));
    autoBend(b, k, { elbowL: this.punchArm > 0 ? undefined : punchElbow, elbowR: this.punchArm > 0 ? punchElbow : undefined });
  }
}
