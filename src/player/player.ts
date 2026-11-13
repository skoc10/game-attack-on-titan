import * as THREE from 'three';
import type { Game } from '../game';
import type { Giant, NapeResult } from '../enemies/giant';
import { CFG } from '../data/config';
import { clamp, lerp, turnToward } from '../core/rng';
import { CHARACTERS, type CharDef } from '../data/characters';
import { FORMS } from '../data/titans';
import { autoBend, buildHumanoid, disposeHumanoid, GEO, Rig, type Humanoid } from '../enemies/humanoid';
import { CLASSES, type ClassDef } from './classes';
import { Grapple } from './grapple';
import { TitanForm } from './titanForm';

export type PlayerMode = 'foot' | 'mounted' | 'titan';

const P = CFG.player;
const wish = new THREE.Vector3();
const look = new THREE.Vector3();
const chest = new THREE.Vector3();
const tmp = new THREE.Vector3();
const COLLIDE = { trees: true, buildings: true };
const BIG_COLLIDE = { trees: false, buildings: true };

export class Player {
  readonly pos = new THREE.Vector3(P.spawn.x, 0, P.spawn.z);
  readonly vel = new THREE.Vector3();
  mode: PlayerMode = 'foot';
  onGround = true;
  faceYaw = 0;
  hp = 100;
  maxHp = 100;
  gas = 100;
  maxGas = 100;
  blades = 20;
  maxBlades = 20;
  cls: ClassDef = CLASSES.nefer;
  dead = false;
  abilityCd = 0;
  heavyT = 0;
  readonly grapple: Grapple;
  readonly titan: TitanForm;
  private body!: Humanoid;
  /** Seçili karakter ve sınıfla birleşmiş çarpanları. */
  char: CharDef = CHARACTERS.aras;
  private speedMul = 1;
  private reachMul = 1;
  reelMul = 1;
  private swingT = -1;
  private swingBonus = 1;
  private swingReach = 0;
  private attackCd = 0;
  private spinT = 0;
  private readonly swingHit = new Set<Giant>();
  private invuln = 0;
  private deadT = 0;
  private phase = 0;
  private puffT = 0;
  private blockedToastT = 0;
  private gasToastT = 0;
  /** Sağ tıkla verilen yürüme hedefi (yoksa null). */
  moveTarget: THREE.Vector3 | null = null;
  private readonly targetBuf = new THREE.Vector3();
  private moveHold = 0;
  /** Oyuncuyu elinde tutan dev (yoksa null) ve kurtulma barı (0..100). */
  grabbedBy: Giant | null = null;
  escape = 0;
  private burstCd = 0;
  private eaten = false;
  private cloak = new THREE.Group();
  private cloakMat!: THREE.MeshToonMaterial;

  constructor(private readonly game: Game) {
    this.buildBody(this.char.look);
    this.grapple = new Grapple(game.scene);
    this.titan = new TitanForm(game);
  }

  get inTown() {
    return Math.hypot(this.pos.x, this.pos.z) < CFG.world.townR;
  }

  /** Karakterin görünümüyle avcı modelini (yeniden) kurar. */
  private buildBody(look: CharDef['look']) {
    // Avcı: lacivert kaput, koyu pantolon, deri çizme, sırtta ikiz gaz tüpü, omuzda pelerin.
    const L = look;
    if (this.body) {
      this.game.scene.remove(this.body.root);
      disposeHumanoid(this.body);
    }
    this.body = buildHumanoid(
      1.8,
      { skin: L.skin, top: L.top, sleeve: L.top, legs: 0x3b3835, boots: 0x5a3b26, hair: L.hair, hairStyle: L.hairStyle, eye: L.eye },
      { style: 'human', outline: 0.0048, head: 1.12 },
    );
    this.cloak = new THREE.Group();
    const b = this.body;
    const rig = new Rig(0.0048);
    const steel = rig.toon(0xdfe5ec);
    const leather = rig.toon(0x4a3222);
    const iron = rig.toon(0x8f979f);
    rig.part(b.tilt, GEO.taper, leather, 0.094, 0.03, 0.068, 0, 0.535, 0); // kemer
    rig.part(b.tilt, GEO.box, leather, 0.016, 0.24, 0.012, -0.04, 0.66, 0.062, false); // göğüs kayışları
    rig.part(b.tilt, GEO.box, leather, 0.016, 0.24, 0.012, 0.04, 0.66, 0.062, false);
    rig.part(b.armL, GEO.sphere, iron, 0.052, 0.036, 0.052, -0.004, 0.012, 0); // omuzluk
    for (const s of [-1, 1]) {
      const tank = rig.part(b.tilt, GEO.capsule, iron, 0.024, 0.032, 0.024, s * 0.04, 0.55, -0.082);
      tank.rotation.z = Math.PI / 2 - s * 0.25;
    }
    for (const hand of [b.handL, b.handR]) {
      rig.part(hand, GEO.box, leather, 0.014, 0.014, 0.07, 0, 0, 0.02, false); // kabza
      rig.part(hand, GEO.box, iron, 0.05, 0.012, 0.012, 0, 0, 0.058, false); // balçak
      rig.part(hand, GEO.box, steel, 0.008, 0.026, 0.5, 0, 0, 0.31, false);
    }
    // Pelerin omuzdan menteşeli; hızlandıkça arkada dalgalanır.
    this.cloakMat = rig.toon(L.cloak);
    this.cloakMat.side = THREE.DoubleSide;
    this.cloak.position.set(0, 0.778, -0.062);
    b.tilt.add(this.cloak);
    const cloth = rig.part(this.cloak, GEO.box, this.cloakMat, 0.27, 0.44, 0.012, 0, -0.22, -0.062, false);
    cloth.castShadow = true;
    rig.part(this.cloak, GEO.sphere, this.cloakMat, 0.135, 0.032, 0.085, 0, -0.008, 0.06, false);
    this.body.root.visible = this.mode !== 'titan';
    this.game.scene.add(this.body.root);
  }

  /** Sınıf ve yükseltmelere göre değerleri kurar ve doldurur. */
  applyLoadout() {
    const s = this.game.save;
    this.cls = CLASSES[s.cls];
    const ch = CHARACTERS[s.char];
    if (ch !== this.char) {
      this.char = ch;
      this.buildBody(ch.look);
    }
    this.game.meter.setInnate(ch.titan);
    this.speedMul = this.cls.speed * ch.speed;
    this.reachMul = this.cls.reach * ch.reach;
    this.reelMul = this.cls.reel * ch.reel;
    this.maxHp = Math.round(this.cls.hp * ch.hp);
    this.maxGas = CFG.gas.max * this.cls.gas * ch.gas * (1 + 0.15 * s.upgrades.gas);
    this.maxBlades = Math.round(CFG.blade.max * ch.blades * (1 + 0.2 * s.upgrades.blade));
    this.hp = this.maxHp;
    this.gas = this.maxGas;
    this.blades = this.maxBlades;
  }

  private wishDir(out: THREE.Vector3) {
    const inp = this.game.input;
    const f = (inp.down('KeyW') ? 1 : 0) - (inp.down('KeyS') ? 1 : 0);
    const s = (inp.down('KeyD') ? 1 : 0) - (inp.down('KeyA') ? 1 : 0);
    const yaw = this.game.camYaw;
    out.set(Math.sin(yaw) * f - Math.cos(yaw) * s, 0, Math.cos(yaw) * f + Math.sin(yaw) * s);
    if (out.lengthSq() > 0) {
      this.moveTarget = null; // klavye, fare hedefini iptal eder
      return out.normalize();
    }
    const t = this.moveTarget;
    if (t) {
      out.set(t.x - this.pos.x, 0, t.z - this.pos.z);
      const stop = this.mode === 'titan' ? 2.5 : this.mode === 'mounted' ? 3 : 0.7;
      if (out.length() < stop) {
        this.moveTarget = null;
        out.set(0, 0, 0);
      } else out.normalize();
    }
    return out;
  }

  // ---------------------------------------------------------------- girdiler
  handleInput() {
    const g = this.game;
    const inp = g.input;
    if (this.dead) return;
    if (this.grabbedBy) {
      this.struggle();
      return;
    }
    // Sağ tık: kısa tıkla imlecin gösterdiği yere git; basılı tutunca baktığın yöne koş, bırakınca dur.
    if (inp.mouseDown(2)) {
      this.moveHold += g.frameDt;
      if (inp.locked) this.moveTarget = this.targetBuf.set(this.pos.x + Math.sin(g.camYaw) * 40, this.pos.y, this.pos.z + Math.cos(g.camYaw) * 40);
      else this.moveTarget = this.targetBuf.copy(g.aimPoint);
    } else {
      if (this.moveHold > 0.3) this.moveTarget = null;
      this.moveHold = 0;
    }
    if (this.mode === 'titan') {
      if (inp.mousePressed(0)) this.titan.punch(this);
      if (inp.pressed('KeyQ')) this.titan.cast('q', this);
      if (inp.pressed('KeyE')) this.titan.cast('e', this);
      if (inp.pressed('Space') && this.onGround) {
        if (this.titan.def.jump > 0) {
          this.vel.y = this.titan.def.jump;
          this.onGround = false;
          this.titan.jumped = true;
        } else {
          this.titan.slam(this); // zıplayamayan form olduğu yerde tepinir
        }
      }
      if (inp.pressed('KeyT')) this.revert();
      return;
    }
    if (inp.pressed('Tab')) {
      // Eldeki iğneler arasında geçiş: hangi deve dönüşüleceğini seçer.
      const before = g.meter.selected;
      const id = g.meter.cycle();
      const via = FORMS[id].needle || 'kendi formun';
      if (!g.meter.has(id)) g.hud.toast('Hiç iğnen yok');
      else g.hud.toast(id === before ? `Tek seçeneğin: ${FORMS[id].name}` : `Seçili: ${via} → ${FORMS[id].name}`);
    }
    if (inp.pressed('KeyT')) {
      this.tryTransform();
      return;
    }
    if (inp.pressed('KeyF')) g.horse.call(g);
    if (inp.pressed('KeyE')) this.interact();
    if (inp.pressed('KeyR')) this.useAbility();
    // Sol tık: imlecin altında tutunacak yer varsa kanca atar; yakında dev varsa (ya da kanca atılamadıysa) kılıç savurur.
    if (inp.mousePressed(0)) {
      let hooked = false;
      const hit = this.gas > 0 ? this.grapple.aim(g) : null;
      if (hit) {
        if (this.mode === 'mounted') this.dismount(true);
        hooked = this.grapple.fire(g);
        if (hooked) this.moveTarget = null;
      } else if (this.gas <= 0 && this.gasToastT <= 0) {
        this.gasToastT = 3;
        g.hud.toast('Gaz bitti — ikmal noktası bul');
      }
      if (!hooked || this.giantNear()) this.startSwing();
    }
    if (!inp.mouseDown(0) && this.grapple.active) this.grapple.release();
    if (inp.pressed('Space')) {
      if (this.mode === 'mounted') this.dismount(true);
      else if (this.grapple.active) {
        this.grapple.release();
        this.vel.y = Math.max(this.vel.y, 0) + 13;
        this.onGround = false;
      } else if (this.onGround) {
        this.vel.y = P.jump;
        this.onGround = false;
      }
    }
  }

  // ---------------------------------------------------------------- yakalanma
  canBeGrabbed() {
    return !this.dead && this.mode !== 'titan' && this.invuln <= 0 && this.grabbedBy === null;
  }

  /** Bir dev oyuncuyu eline aldı. */
  grab(by: Giant) {
    if (this.mode === 'mounted') this.dismount(true);
    this.grapple.release();
    this.moveTarget = null;
    this.swingT = -1;
    this.spinT = 0;
    this.grabbedBy = by;
    this.escape = 0;
    this.burstCd = 0;
    this.onGround = false;
    this.hp = Math.max(1, this.hp - CFG.grab.squeeze);
    this.game.onPlayerGrabbed(by);
  }

  /** Dev oyuncuyu kendiliğinden bıraktı (sersemledi, düştü, öldü). */
  releaseGrab(by: Giant) {
    if (this.grabbedBy !== by) return;
    this.grabbedBy = null;
    this.vel.set(0, 3, 0);
    this.onGround = false;
    this.invuln = Math.max(this.invuln, 0.8);
  }

  /**
   * Devin elindeyken kurtulma manevraları:
   * sol tık parmakları keser, Space gaz patlamasıyla sıyırır, T (mümkünse) elin içinde deve dönüşür.
   */
  private struggle() {
    const g = this.game;
    const inp = g.input;
    const by = this.grabbedBy!;
    const G = CFG.grab;
    // Büyük devlerin elinden kurtulmak daha zordur.
    const gain = clamp(10 / by.h, 0.6, 1);
    if (inp.pressed('KeyT') && g.meter.canTransform()) {
      this.grabbedBy = null;
      by.stun(3);
      this.tryTransform();
      return;
    }
    if (inp.mousePressed(0)) {
      this.escape += G.slashGain * gain * (this.blades > 0 ? 1 : 0.5);
      this.swingT = 0;
      g.audio.swing();
      by.handWorld(tmp);
      g.particles.burst(tmp, 8, 7, 0.4, 0xff6a5a, 0.8);
    }
    if (inp.pressed('Space') && this.burstCd <= 0) {
      if (this.gas >= G.burstGas) {
        this.gas -= G.burstGas;
        this.escape += G.burstGain * gain;
        this.burstCd = 0.5;
        g.audio.gas();
        g.particles.burst(this.pos, 26, 12, 0.6, 0xcfe4ee, 1);
      } else if (this.gasToastT <= 0) {
        this.gasToastT = 2;
        g.hud.toast('Gaz yok — kılıçla kes (sol tık)');
      }
    }
    if (this.escape >= 100) this.breakFree();
  }

  private breakFree() {
    const by = this.grabbedBy;
    if (!by) return;
    this.grabbedBy = null;
    this.escape = 0;
    by.handWorld(tmp);
    this.game.onBrokeFree(tmp);
    by.stun(1.8);
    // Devin yüzünden uzağa, yukarı doğru fırla.
    const dx = this.pos.x - by.pos.x;
    const dz = this.pos.z - by.pos.z;
    const l = Math.hypot(dx, dz) || 1;
    this.vel.set((dx / l) * 9, 11, (dz / l) * 9);
    this.onGround = false;
    this.invuln = 1.2;
  }

  /** Dev ısırdı: ağır hasar. Hayatta kalırsa oyuncu yere fırlatılır. */
  bitten(dmg: number, by: Giant) {
    if (this.grabbedBy !== by) return;
    const g = this.game;
    this.grabbedBy = null;
    this.escape = 0;
    this.hp -= dmg;
    this.vel.set(Math.sin(by.yaw) * 8, 2, Math.cos(by.yaw) * 8);
    this.onGround = false;
    this.invuln = 1.5;
    g.onPlayerHurt();
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.deadT = 0;
      this.eaten = true;
      g.onPlayerDied();
    }
  }

  /** Kılıç menzili civarında canlı bir dev var mı? */
  private giantNear() {
    for (const gi of this.game.giants) {
      if (!gi.alive) continue;
      const d = Math.hypot(gi.pos.x - this.pos.x, gi.pos.z - this.pos.z);
      if (d < gi.h * 0.5 + 9 && this.pos.y - gi.pos.y < gi.h + 8) return true;
    }
    return false;
  }

  private interact() {
    const g = this.game;
    if (this.mode === 'mounted') {
      this.dismount(false);
      return;
    }
    const crate = g.crates.nearest(this.pos, CFG.crate.reach);
    if (crate) {
      g.crates.open(crate, g);
      return;
    }
    if (this.pos.distanceTo(g.horse.pos) < 4.5) this.mount();
  }

  /** HUD ipucu için: E tuşu şu an ne yapar? */
  interactHint() {
    if (this.mode === 'titan' || this.dead) return '';
    if (this.mode === 'mounted') return 'E — Attan in';
    if (this.game.crates.nearest(this.pos, CFG.crate.reach)) return 'E — Kutuyu aç';
    if (this.pos.distanceTo(this.game.horse.pos) < 4.5) return 'E — Ata bin';
    return '';
  }

  mount() {
    this.grapple.release();
    this.mode = 'mounted';
    this.moveTarget = null;
    this.game.horse.mode = 'ridden';
    this.onGround = true;
  }

  dismount(jump: boolean) {
    const h = this.game.horse;
    this.mode = 'foot';
    this.moveTarget = null;
    h.mode = 'idle';
    if (jump) {
      this.pos.set(h.pos.x, h.pos.y + 1.2, h.pos.z);
      this.vel.copy(h.vel);
      this.vel.y = 9;
      this.onGround = false;
    } else {
      this.pos.set(h.pos.x - Math.cos(h.yaw) * 1.5, h.pos.y, h.pos.z + Math.sin(h.yaw) * 1.5);
      this.vel.set(0, 0, 0);
      this.onGround = true;
    }
  }

  private startSwing() {
    if (this.attackCd > 0) return;
    this.swingT = 0;
    this.attackCd = CFG.sword.cooldown;
    this.swingHit.clear();
    this.swingBonus = 1;
    this.swingReach = 0;
    if (this.heavyT > 0) {
      this.heavyT = 0;
      this.swingBonus = 3; // zırh delen darbe
      this.swingReach = 1.5;
    }
    this.game.audio.swing();
  }

  private useAbility() {
    if (this.abilityCd > 0) return;
    const g = this.game;
    switch (this.cls.id) {
      case 'nefer':
        this.hp = Math.min(this.maxHp, this.hp + 40);
        this.invuln = Math.max(this.invuln, 2);
        g.audio.pickup();
        break;
      case 'as':
        this.spinT = 0.7;
        this.swingHit.clear();
        g.audio.swing();
        break;
      case 'muhafiz':
        this.heavyT = 5;
        g.audio.clang();
        break;
      case 'taktisyen': {
        let n = 0;
        for (const gi of g.giants) {
          if (gi.alive && gi.pos.distanceTo(this.pos) < 95) {
            gi.slowT = 9;
            gi.marked = true;
            n++;
          }
        }
        for (let i = 0; i < 40; i++) g.particles.emit(this.pos.x, this.pos.y + 2 + i * 1.5, this.pos.z, 0, 30, 0, 1.6, 0xff4030);
        g.audio.whistle();
        g.hud.toast(`${n} dev işaretlendi`);
        break;
      }
    }
    this.abilityCd = this.cls.abilityCd;
    g.hud.toast(this.cls.ability);
  }

  // ---------------------------------------------------------------- dönüşüm
  private tryTransform() {
    const g = this.game;
    const m = g.meter;
    if (!m.canTransform()) {
      g.hud.toast(m.usesInnate ? `${FORMS[m.selected].name} için dev barı tamamen dolmalı` : !m.has(m.selected) ? 'İğnen yok — ışıklı bir kutu bul' : 'Dev barı en az yarıya kadar dolmalı');
      return;
    }
    if (this.mode === 'mounted') this.dismount(false);
    this.grapple.release();
    const form = m.selected;
    m.transform();
    this.moveTarget = null;
    this.mode = 'titan';
    this.pos.y = g.world.heightAt(this.pos.x, this.pos.z);
    this.vel.set(0, 0, 0);
    this.onGround = true;
    this.swingT = -1;
    this.spinT = 0;
    this.body.root.visible = false;
    this.titan.enter(form);
    g.onTransform();
  }

  revert() {
    if (this.mode !== 'titan') return;
    const g = this.game;
    this.mode = 'foot';
    this.titan.exit();
    this.body.root.visible = true;
    const napeY = this.titan.def.height * 0.8;
    tmp.set(this.pos.x, this.pos.y + napeY, this.pos.z);
    g.particles.burst(tmp, 120, 26, 2.4, 0xdddddd, 6, 8);
    this.pos.y += napeY;
    this.vel.set(-Math.sin(this.faceYaw) * 6, 9, -Math.cos(this.faceYaw) * 6);
    this.onGround = false;
    this.invuln = 1.5;
    g.meter.end();
    this.moveTarget = null;
    g.hud.toast('İnsan formuna döndün');
  }

  // ---------------------------------------------------------------- hasar
  takeHit(dmg: number, from: THREE.Vector3, knock: number) {
    if (this.dead || this.invuln > 0 || this.grabbedBy) return;
    const g = this.game;
    if (this.mode === 'titan') {
      g.meter.hit(CFG.titan.hitDrain * (dmg / 30) * this.titan.def.armor);
      if (g.meter.value <= 0) this.revert();
      this.invuln = 0.5;
      g.shakeCam(0.4);
      g.audio.hurt();
      return;
    }
    if (this.mode === 'mounted') this.dismount(true);
    this.grapple.release();
    this.moveTarget = null;
    this.hp -= dmg;
    this.invuln = 1;
    const dx = this.pos.x - from.x;
    const dz = this.pos.z - from.z;
    const l = Math.hypot(dx, dz) || 1;
    this.vel.set((dx / l) * knock, 8, (dz / l) * knock);
    this.onGround = false;
    g.onPlayerHurt();
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.deadT = 0;
      g.onPlayerDied();
    }
  }

  private respawn() {
    const g = this.game;
    this.dead = false;
    this.eaten = false;
    this.grabbedBy = null;
    this.moveTarget = null;
    this.mode = 'foot';
    this.pos.set(P.spawn.x, 0, P.spawn.z);
    this.vel.set(0, 0, 0);
    this.onGround = true;
    this.hp = this.maxHp;
    this.gas = this.maxGas;
    this.blades = this.maxBlades;
    this.invuln = 2;
    g.meter.value = Math.floor(g.meter.value * 0.5);
    g.horse.pos.set(P.spawn.x + 4, 0, P.spawn.z);
    g.horse.mode = 'idle';
    g.hud.toast('Taç Suru’nda yeniden doğdun');
  }

  // ---------------------------------------------------------------- kılıç
  private bladeCheck(extraReach: number, pierce: boolean) {
    const g = this.game;
    chest.set(this.pos.x, this.pos.y + 1.1, this.pos.z);
    const sharp = this.blades > 0;
    for (const gi of g.giants) {
      if (!gi.alive || this.swingHit.has(gi)) continue;
      const span = gi.h + 12;
      if (Math.abs(gi.pos.x - this.pos.x) > span || Math.abs(gi.pos.z - this.pos.z) > span) continue;
      const reach = CFG.sword.reach * this.reachMul + extraReach;
      gi.napeWorld(tmp);
      if (chest.distanceTo(tmp) < reach + gi.napeRadius) {
        // Tek temiz ense kesiği devi öldürür.
        this.swingHit.add(gi);
        this.afterNape(gi.hitNape(g, sharp, pierce), tmp, gi);
        continue;
      }
      for (let i = 0; i < 2; i++) {
        gi.footWorld(i, tmp);
        if (chest.distanceTo(tmp) < reach + gi.legRadius) {
          this.swingHit.add(gi);
          const r = gi.hitLeg(sharp, pierce);
          if (r === 'dull') this.dullToast();
          else if (r !== 'none') {
            this.useBlade();
            g.audio.hit();
            g.particles.burst(tmp, 14, 9, 0.6, 0xff6a5a, 1);
            if (r === 'down') g.hud.toast(`${gi.type.name} yere düştü — ensesine tek vuruş yeter!`);
            else g.hud.toast(`${gi.type.name} sendeledi — bacağına bir daha vur`);
          }
          break;
        }
      }
    }
  }

  private dullToast() {
    if (this.blockedToastT > 0) return;
    this.blockedToastT = 3;
    this.game.audio.clang();
    this.game.hud.toast('Kılıç kör, kesmiyor — kutu bul ya da şehre dön');
  }

  private afterNape(res: NapeResult, at: THREE.Vector3, gi: Giant) {
    const g = this.game;
    if (res === 'none') return;
    if (res === 'dull') {
      this.dullToast();
      return;
    }
    this.useBlade();
    if (res === 'blocked') {
      g.audio.clang();
      g.particles.burst(at, 16, 14, 0.4, 0xfff0b0, 0.5);
      if (this.blockedToastT <= 0) {
        this.blockedToastT = 4;
        g.hud.toast('Zırh! Önce bacaklarından düşür');
      }
      return;
    }
    g.particles.burst(at, 22, 12, 0.7, 0xff5a4a, 1);
    if (res === 'hit') {
      // Yalnızca bölüm sonu devi birden fazla kesik ister.
      g.audio.hit();
      g.hud.toast(`${gi.type.name}: derin kesik — devam et!`);
    }
  }

  private useBlade() {
    if (this.blades > 0) {
      this.blades -= 1;
      if (this.blades === 0) this.game.hud.toast('Kılıçlar köreldi — kutu bul ya da şehre dön');
    }
  }

  // ---------------------------------------------------------------- fizik
  step(dt: number) {
    const g = this.game;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.attackCd > 0) this.attackCd -= dt;
    if (this.abilityCd > 0) this.abilityCd -= dt;
    if (this.heavyT > 0) this.heavyT -= dt;
    if (this.blockedToastT > 0) this.blockedToastT -= dt;
    if (this.gasToastT > 0) this.gasToastT -= dt;
    if (this.dead) {
      this.deadT += dt;
      this.vel.y -= P.gravity * dt;
      this.pos.addScaledVector(this.vel, dt);
      const gy = g.world.heightAt(this.pos.x, this.pos.z);
      if (this.pos.y < gy) {
        this.pos.y = gy;
        this.vel.set(0, 0, 0);
      }
      if (this.deadT > 2.8) this.respawn();
      return;
    }
    if (this.burstCd > 0) this.burstCd -= dt;
    if (this.grabbedBy) {
      // Devin elinde: konum eli izler, fizik durur, kurtulma barı zamanla geriler.
      const by = this.grabbedBy;
      if (by.gone || !by.alive) {
        this.releaseGrab(by);
      } else {
        this.escape = Math.max(0, this.escape - CFG.grab.decay * dt);
        by.handWorld(tmp);
        this.pos.set(tmp.x, tmp.y - 0.9, tmp.z);
        this.vel.set(0, 0, 0);
        this.faceYaw = by.yaw + Math.PI;
        if (this.swingT >= 0) {
          this.swingT += dt;
          if (this.swingT >= CFG.sword.duration) this.swingT = -1;
        }
        return;
      }
    }
    this.wishDir(wish);
    const shift = g.input.down('ShiftLeft') || g.input.down('ShiftRight');
    // Fareyle uzak bir hedefe gidiliyorsa kendiliğinden koşar.
    const mt = this.moveTarget;
    const far = mt !== null && Math.hypot(mt.x - this.pos.x, mt.z - this.pos.z) > (this.mode === 'foot' ? 14 : 28);
    const sprint = shift || far;

    if (this.mode === 'titan') {
      this.stepTitan(dt, sprint);
      return;
    }

    // Şehirde ikmal
    if (this.inTown) {
      this.hp = Math.min(this.maxHp, this.hp + 12 * dt);
      this.blades = this.maxBlades;
    }

    if (this.mode === 'mounted') {
      const h = g.horse;
      h.drive(wish, sprint, dt, g);
      this.pos.set(h.pos.x, h.pos.y + 1.0, h.pos.z);
      this.vel.copy(h.vel);
      this.faceYaw = h.yaw;
      this.stepSwing(dt);
      return;
    }

    const hooked = this.grapple.active;
    const grounded = this.onGround && !hooked;
    if (grounded) {
      const sp = (sprint ? P.sprint : P.walk) * this.speedMul;
      const cur = Math.hypot(this.vel.x, this.vel.z);
      const rate = (cur > sp + 2 ? P.friction : P.accelGround) * dt;
      const ddx = wish.x * sp - this.vel.x;
      const ddz = wish.z * sp - this.vel.z;
      const dl = Math.hypot(ddx, ddz);
      if (dl <= rate) {
        this.vel.x = wish.x * sp;
        this.vel.z = wish.z * sp;
      } else {
        this.vel.x += (ddx / dl) * rate;
        this.vel.z += (ddz / dl) * rate;
      }
    } else {
      this.vel.y -= P.gravity * (hooked ? 0.55 : 1) * dt;
      if (wish.lengthSq() > 0) {
        const proj = this.vel.x * wish.x + this.vel.z * wish.z;
        if (proj < P.maxAirWish) {
          const add = Math.min(P.airAccel * dt, P.maxAirWish - proj);
          this.vel.x += wish.x * add;
          this.vel.z += wish.z * add;
        }
      }
      if (shift && this.gas > 0) {
        // İtiş imlecin gösterdiği yöne, hafif yukarı doğru.
        look.copy(g.aimDir);
        look.y = Math.max(look.y, 0) + 0.35;
        look.normalize();
        this.vel.addScaledVector(look, CFG.grapple.boostAccel * dt);
        this.gas = Math.max(0, this.gas - CFG.grapple.boostGasPerSec * dt);
        this.puffT -= dt;
        if (this.puffT <= 0) {
          this.puffT = 0.03;
          g.particles.emit(this.pos.x, this.pos.y + 0.9, this.pos.z, -look.x * 8, -look.y * 8, -look.z * 8, 0.5, 0xcfe4ee);
        }
      }
      this.vel.multiplyScalar(1 - Math.min(1, 0.12 * dt));
    }
    this.grapple.apply(dt, this);
    const sp2 = this.vel.length();
    if (sp2 > CFG.grapple.maxSpeed) this.vel.multiplyScalar(CFG.grapple.maxSpeed / sp2);

    const px = this.pos.x;
    const pz = this.pos.z;
    this.pos.addScaledVector(this.vel, dt);
    if (g.world.resolve(this.pos, P.radius, COLLIDE)) {
      this.vel.x = (this.pos.x - px) / dt;
      this.vel.z = (this.pos.z - pz) / dt;
    }
    const gy = g.world.groundAt(this.pos.x, this.pos.z, this.pos.y);
    if (this.pos.y <= gy) {
      this.pos.y = gy;
      if (this.vel.y < 0) this.vel.y = 0;
      this.onGround = true;
    } else if (this.onGround && !hooked && this.vel.y <= 0 && this.pos.y - gy < 0.7) {
      this.pos.y = gy;
    } else {
      this.onGround = false;
    }
    this.stepSwing(dt);
  }

  private stepSwing(dt: number) {
    if (this.swingT >= 0) {
      this.swingT += dt;
      if (this.swingT >= CFG.sword.activeFrom && this.swingT <= CFG.sword.activeTo) this.bladeCheck(this.swingReach, this.swingBonus >= 3);
      if (this.swingT >= CFG.sword.duration) this.swingT = -1;
    }
    if (this.spinT > 0) {
      this.spinT -= dt;
      this.bladeCheck(2.6, false);
    }
  }

  private stepTitan(dt: number, sprint: boolean) {
    const g = this.game;
    const T = this.titan.def;
    const sp = sprint ? T.sprint : T.speed;
    const rate = (this.onGround ? 46 : 10) * dt;
    const ddx = wish.x * sp - this.vel.x;
    const ddz = wish.z * sp - this.vel.z;
    const dl = Math.hypot(ddx, ddz);
    if (this.titan.rushT > 0) {
      // Atılım: yön kilitli, ileri savrulur.
      this.vel.x = Math.sin(this.faceYaw) * this.titan.rushSpeed;
      this.vel.z = Math.cos(this.faceYaw) * this.titan.rushSpeed;
    } else if (dl <= rate) {
      this.vel.x = wish.x * sp;
      this.vel.z = wish.z * sp;
    } else {
      this.vel.x += (ddx / dl) * rate;
      this.vel.z += (ddz / dl) * rate;
    }
    if (!this.onGround) this.vel.y -= T.gravity * dt;
    const px = this.pos.x;
    const pz = this.pos.z;
    this.pos.addScaledVector(this.vel, dt);
    // Çok büyük formlar ağaçları ezip geçer.
    if (g.world.resolve(this.pos, T.radius, T.height >= 20 ? BIG_COLLIDE : COLLIDE)) {
      this.vel.x = (this.pos.x - px) / dt;
      this.vel.z = (this.pos.z - pz) / dt;
    }
    const gy = g.world.groundAt(this.pos.x, this.pos.z, this.pos.y);
    if (this.pos.y <= gy) {
      if (!this.onGround && this.titan.jumped && this.vel.y < -10) this.titan.slam(this);
      this.pos.y = gy;
      this.vel.y = 0;
      this.onGround = true;
      this.titan.jumped = false;
    } else if (this.onGround && this.vel.y <= 0 && this.pos.y - gy < 1.5) {
      this.pos.y = gy;
    } else {
      this.onGround = false;
    }
    this.titan.update(dt, this);
    if (g.meter.tick(dt, T.drain * this.char.drain * (1 - 0.1 * g.save.upgrades.titan))) this.revert();
  }

  // ---------------------------------------------------------------- görsel
  animate(dt: number) {
    const g = this.game;
    this.grapple.updateLine(this);
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const moving = hs > 0.5;

    if (this.mode === 'titan') {
      if (this.titan.punchT < 0 && this.titan.rushT <= 0 && moving) this.faceYaw = turnToward(this.faceYaw, Math.atan2(this.vel.x, this.vel.z), 7 * dt);
      this.titan.animate(dt, this, moving);
      return;
    }

    const b = this.body;
    b.root.visible = !this.eaten && !(this.invuln > 0 && !this.dead && Math.floor(this.invuln * 14) % 2 === 0);
    let aL = 0;
    let aR = 0;
    let lL = 0;
    let lR = 0;
    let tilt = 0;
    let spread = 0;

    if (this.mode === 'mounted') {
      b.root.position.set(this.pos.x, g.horse.pos.y + 1.0, this.pos.z);
      lL = lR = -1.3;
      spread = 0.45;
      aL = aR = -0.7;
      tilt = Math.min(0.3, hs / 90);
    } else {
      b.root.position.copy(this.pos);
      if (this.grabbedBy) this.phase += dt * 16;
      else if (this.spinT > 0) this.faceYaw += 22 * dt;
      else if (this.swingT >= 0) this.faceYaw = turnToward(this.faceYaw, g.aimYaw(), 18 * dt);
      else if (moving) this.faceYaw = turnToward(this.faceYaw, Math.atan2(this.vel.x, this.vel.z), 14 * dt);
      if (this.grabbedBy) {
        // Devin elinde çırpınma
        b.root.position.x += Math.sin(this.phase * 2.1) * 0.06;
        lL = Math.sin(this.phase) * 0.7;
        lR = -lL;
        aL = aR = -0.4;
      } else if (this.onGround && !this.grapple.active) {
        this.phase += hs * dt * 1.9;
        const s = moving ? Math.sin(this.phase) * 0.8 : 0;
        lL = s;
        lR = -s;
        aL = -s * 0.6;
        aR = s * 0.6;
      } else {
        tilt = Math.min(1.1, this.vel.length() / 36);
        lL = 0.5;
        lR = 0.2;
        aL = aR = 0.7;
      }
    }
    if (this.dead) tilt = -1.5;
    if (this.swingT >= 0) {
      const t = this.swingT / CFG.sword.duration;
      aL = aR = lerp(-2.7, 0.6, Math.min(1, t * 1.3));
    } else if (this.spinT > 0) {
      aL = aR = -1.57;
      spread = 1.2;
    } else if (this.heavyT > 0) {
      aR = -2.9;
    }
    const k = 1 - Math.exp(-dt * 22);
    b.root.rotation.y = this.faceYaw;
    b.armL.rotation.x = lerp(b.armL.rotation.x, aL, k);
    b.armR.rotation.x = lerp(b.armR.rotation.x, aR, k);
    b.legL.rotation.x = lerp(b.legL.rotation.x, lL, k);
    b.legR.rotation.x = lerp(b.legR.rotation.x, lR, k);
    b.legL.rotation.z = lerp(b.legL.rotation.z, -spread * (this.mode === 'mounted' ? 1 : 0), k);
    b.legR.rotation.z = lerp(b.legR.rotation.z, spread * (this.mode === 'mounted' ? 1 : 0), k);
    b.armL.rotation.z = lerp(b.armL.rotation.z, this.spinT > 0 ? -spread : 0, k);
    b.armR.rotation.z = lerp(b.armR.rotation.z, this.spinT > 0 ? spread : 0, k);
    b.tilt.rotation.x = lerp(b.tilt.rotation.x, tilt, 1 - Math.exp(-dt * 8));
    // Vuruşta kollar düz; ata binerken dizler bükülü.
    const straight = this.swingT >= 0 || this.spinT > 0;
    autoBend(b, k, {
      elbowL: straight ? -0.1 : undefined,
      elbowR: straight ? -0.1 : undefined,
      kneeL: this.mode === 'mounted' ? 1.25 : undefined,
      kneeR: this.mode === 'mounted' ? 1.25 : undefined,
    });
    const flap = 0.1 + Math.min(1.25, this.vel.length() / 20) + Math.sin(performance.now() * 0.012) * 0.05 * Math.min(1, hs / 4);
    this.cloak.rotation.x = lerp(this.cloak.rotation.x, flap - tilt * 0.4, 1 - Math.exp(-dt * 7));
  }
}
