import * as THREE from 'three';
import type { Game } from '../game';
import type { Player } from './player';
import { CFG } from '../data/config';
import { lerp } from '../core/rng';
import { buildHumanoid, type Humanoid } from '../enemies/humanoid';

const T = CFG.titan;
const v = new THREE.Vector3();

/** Öfke Devi: oyuncunun ilk dev formu. Yumruk, kükreme, taş yumruk, sıçrama ezmesi. */
export class TitanForm {
  readonly body: Humanoid;
  punchT = -1;
  roarCd = 0;
  stoneT = 0;
  stoneCd = 0;
  jumped = false;
  private punchDone = false;
  private punchArm = 1;
  private phase = 0;
  private warnT = 0;
  private readonly armBase = new THREE.Color(0x7a5b4e);
  private readonly armStone = new THREE.Color(0xb9d3e6);

  constructor(private readonly game: Game) {
    this.body = buildHumanoid(
      T.height,
      { skin: 0x7a5b4e, torso: 0x6a4d44, legs: 0x5e443d, hair: 0x1a1412, nape: 0x7a5b4e, eye: 0xff7a1a, glow: 0xff7a1a },
      { bulk: 1.15, head: 0.95, arm: 1.1, cracks: true },
    );
    this.body.root.visible = false;
    game.scene.add(this.body.root);
  }

  get stone() {
    return this.stoneT > 0;
  }

  enter() {
    this.body.root.visible = true;
    this.punchT = -1;
    this.roarCd = 0;
    this.stoneT = 0;
    this.stoneCd = 0;
    this.jumped = false;
    this.setStone(false);
  }

  exit() {
    this.body.root.visible = false;
    this.setStone(false);
  }

  private setStone(on: boolean) {
    this.body.armMat.color.copy(on ? this.armStone : this.armBase);
    this.body.armMat.emissive.setHex(on ? 0x2a4458 : 0x000000);
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

  punch(p: Player) {
    if (this.punchT >= 0 || !this.pay(T.cost.punch)) return;
    this.punchT = 0;
    this.punchDone = false;
    this.punchArm *= -1;
    p.faceYaw = this.game.aimYaw();
    this.game.audio.swing();
  }

  roar(p: Player) {
    if (this.roarCd > 0 || !this.pay(T.cost.roar)) return;
    this.roarCd = T.roarCd;
    const g = this.game;
    for (const gi of g.giants) {
      if (!gi.alive) continue;
      if (Math.hypot(gi.pos.x - p.pos.x, gi.pos.z - p.pos.z) < T.roarRadius) gi.stun(gi.type.kind === 'boss' ? T.roarStun * 0.5 : T.roarStun);
    }
    g.audio.roar();
    g.shakeCam(1);
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * Math.PI * 2;
      g.particles.emit(p.pos.x, p.pos.y + T.height * 0.85, p.pos.z, Math.sin(a) * 60, 2, Math.cos(a) * 60, 1.1, 0xffa040);
    }
    g.hud.toast('KÜKREME — devler sersemledi');
  }

  hardenFists() {
    if (this.stoneCd > 0 || !this.pay(T.cost.stone)) return;
    this.stoneCd = T.stoneCd;
    this.stoneT = T.stoneDur;
    this.setStone(true);
    this.game.audio.clang();
    this.game.hud.toast('TAŞ YUMRUK — zırh kırılır');
  }

  /** Sıçrayıştan inerken çağrılır; barı yetiyorsa çevreyi ezer. */
  slam(p: Player) {
    const g = this.game;
    if (!g.meter.spend(T.cost.slam)) return;
    const dmg = T.slamDmg * (this.stone ? T.stoneMult : 1);
    for (const gi of g.giants) {
      if (gi.alive && Math.hypot(gi.pos.x - p.pos.x, gi.pos.z - p.pos.z) < T.slamRadius + gi.radius) gi.titanHit(dmg, g, this.stone, p.pos);
    }
    g.audio.stomp();
    g.shakeCam(1);
    for (let i = 0; i < 50; i++) {
      const a = Math.random() * 6.28;
      g.particles.emit(p.pos.x, p.pos.y + 0.5, p.pos.z, Math.sin(a) * 30, 5, Math.cos(a) * 30, 1.2, 0x9a8f7a);
    }
  }

  update(dt: number, p: Player) {
    const g = this.game;
    if (this.roarCd > 0) this.roarCd -= dt;
    if (this.stoneCd > 0) this.stoneCd -= dt;
    if (this.warnT > 0) this.warnT -= dt;
    if (this.stoneT > 0) {
      this.stoneT -= dt;
      if (this.stoneT <= 0) this.setStone(false);
    }
    if (this.punchT >= 0) {
      this.punchT += dt;
      if (!this.punchDone && this.punchT >= T.punchTime * 0.45) {
        this.punchDone = true;
        const cx = p.pos.x + Math.sin(p.faceYaw) * 6;
        const cz = p.pos.z + Math.cos(p.faceYaw) * 6;
        const dmg = T.punchDmg * (this.stone ? T.stoneMult : 1);
        let any = false;
        for (const gi of g.giants) {
          if (!gi.alive) continue;
          if (Math.hypot(gi.pos.x - cx, gi.pos.z - cz) < T.punchRange + gi.radius) {
            gi.titanHit(dmg, g, this.stone, p.pos);
            any = true;
            v.set(gi.pos.x, gi.pos.y + Math.min(gi.h * 0.7, T.height * 0.7), gi.pos.z);
            g.particles.burst(v, 25, 18, 0.8, this.stone ? 0xbfe0ff : 0xff9a40, 2);
          }
        }
        if (any) {
          g.audio.hit();
          g.shakeCam(0.6);
        }
      }
      if (this.punchT >= T.punchTime) this.punchT = -1;
    }
  }

  animate(dt: number, p: Player, moving: boolean) {
    const b = this.body;
    b.root.position.copy(p.pos);
    b.root.rotation.y = p.faceYaw;
    const hs = Math.hypot(p.vel.x, p.vel.z);
    if (moving && p.onGround) this.phase += (hs * dt) / (T.height * 0.2);
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
    if (this.punchT >= 0) {
      const t = this.punchT / T.punchTime;
      const a = t < 0.45 ? lerp(0.9, -1.6, t / 0.45) : lerp(-1.6, -0.6, (t - 0.45) / 0.55);
      if (this.punchArm > 0) aR = a;
      else aL = a;
      tilt = 0.25;
    }
    const k = 1 - Math.exp(-dt * 18);
    b.armL.rotation.x = lerp(b.armL.rotation.x, aL, k);
    b.armR.rotation.x = lerp(b.armR.rotation.x, aR, k);
    b.legL.rotation.x = lerp(b.legL.rotation.x, lL, k);
    b.legR.rotation.x = lerp(b.legR.rotation.x, lR, k);
    b.tilt.rotation.x = lerp(b.tilt.rotation.x, tilt, 1 - Math.exp(-dt * 8));
  }
}
