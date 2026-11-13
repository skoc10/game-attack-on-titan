import * as THREE from 'three';
import type { Game } from '../game';
import { CFG } from '../data/config';
import { lerp, turnToward } from '../core/rng';
import { wallPush } from '../world/walls';
import { buildHumanoid, disposeHumanoid, type Humanoid } from './humanoid';
import type { GiantType } from './giantTypes';

export type GiantState = 'wander' | 'chase' | 'windup' | 'recover' | 'stunned' | 'downed' | 'rising' | 'leap' | 'dead';
export type NapeResult = 'kill' | 'hit' | 'blocked' | 'none';

const v = new THREE.Vector3();
const LEAP_G = 30;
const OBSTACLES = { trees: true, buildings: true };

export class Giant {
  readonly body: Humanoid;
  readonly pos: THREE.Vector3;
  readonly h: number;
  readonly radius: number;
  readonly napeRadius: number;
  readonly legRadius: number;
  readonly maxHp: number;
  yaw: number;
  state: GiantState = 'wander';
  stateT = 0;
  hp: number;
  legHp: number;
  slowT = 0;
  marked = false;
  gone = false;
  home: THREE.Vector3 | null = null;
  private attackCd = 0;
  private leapCd = 2;
  private attackKind: 'swipe' | 'stomp' = 'swipe';
  private stunDur = 0;
  private phase = Math.random() * 6;
  private wanderYaw = Math.random() * 6.28;
  private wanderT = 0;
  private leapHit = false;
  private steamT = 0;
  private readonly vel = new THREE.Vector3();
  private moving = false;
  private avoidT = 0;
  private avoidSign = 1;
  private avoidLen = 1.2;
  private sinceAvoid = 99;

  constructor(
    readonly type: GiantType,
    x: number,
    z: number,
    game: Game,
  ) {
    const r = Math.random;
    this.h = lerp(type.minH, type.maxH, r() * r() * 0.6 + r() * 0.4);
    if (type.kind === 'boss') this.h = type.maxH;
    const skin = type.skins[Math.floor(r() * type.skins.length)];
    this.body = buildHumanoid(
      this.h,
      { skin, torso: skin, legs: skin, hair: r() < 0.6 ? 0x2a2220 : null, nape: 0xb5403a, eye: 0x1a1210 },
      {
        bulk: lerp(type.bulk[0], type.bulk[1], r()),
        head: lerp(type.head[0], type.head[1], r()),
        arm: type.arm,
        armor: type.armored,
      },
    );
    this.pos = this.body.root.position;
    this.pos.set(x, game.world.heightAt(x, z), z);
    this.yaw = r() * 6.28;
    this.radius = this.h * 0.14;
    this.napeRadius = this.h * 0.05 + 0.45;
    this.legRadius = this.h * 0.08 + 0.6;
    this.maxHp = type.hpBase + type.hpPerM * this.h;
    this.hp = this.maxHp;
    this.legHp = type.legHp;
    this.body.root.traverse((o) => (o.userData.giant = this));
    game.scene.add(this.body.root);
  }

  get alive() {
    return this.state !== 'dead';
  }
  get isElite() {
    return this.type.meter !== 'normal';
  }

  napeWorld(out: THREE.Vector3) {
    return this.body.nape.getWorldPosition(out);
  }
  footWorld(i: number, out: THREE.Vector3) {
    return (i === 0 ? this.body.footL : this.body.footR).getWorldPosition(out);
  }
  /** Ense zırhı şu an açık mı (zırhlı devler yalnızca yere düşünce vurulabilir). */
  get napeOpen() {
    return !this.type.armored || this.state === 'downed';
  }

  private setState(s: GiantState) {
    this.state = s;
    this.stateT = 0;
  }

  stun(seconds: number) {
    if (!this.alive || this.state === 'downed') return;
    this.stunDur = seconds;
    this.setState('stunned');
  }

  hitNape(dmg: number, game: Game, armorBreak = false): NapeResult {
    if (!this.alive) return 'none';
    if (!this.napeOpen && !armorBreak) return 'blocked';
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.die(game, 'blade');
      return 'kill';
    }
    if (this.state !== 'downed') this.stun(0.7);
    return 'hit';
  }

  hitLeg(dmg: number, armorBreak = false) {
    if (!this.alive || this.state === 'downed' || this.state === 'leap') return 'none' as const;
    this.legHp -= dmg * (this.type.armored && !armorBreak ? 0.6 : 1);
    if (this.legHp <= 0) {
      this.setState('downed');
      return 'down' as const;
    }
    return 'hit' as const;
  }

  /** Dev formundaki oyuncunun yumruğu/ezmesi. */
  titanHit(dmg: number, game: Game, armorBreak: boolean, from: THREE.Vector3) {
    if (!this.alive) return;
    let d = dmg;
    if (this.type.armored && !armorBreak && this.state !== 'downed') {
      d *= 0.2;
      game.audio.clang();
    }
    this.hp -= d;
    if (this.hp <= 0) {
      this.die(game, 'titan');
      return;
    }
    if (this.type.kind === 'boss') {
      if (armorBreak) this.hitLeg(dmg, true);
    } else {
      const dx = this.pos.x - from.x;
      const dz = this.pos.z - from.z;
      const l = Math.hypot(dx, dz) || 1;
      this.pos.x += (dx / l) * 3;
      this.pos.z += (dz / l) * 3;
      if (this.state !== 'downed') this.stun(1);
    }
  }

  private die(game: Game, source: 'blade' | 'titan') {
    this.setState('dead');
    for (const m of this.body.mats) m.transparent = true;
    this.napeWorld(v);
    game.particles.burst(v, 50, this.h * 1.2, 2.2, 0xdddddd, this.h * 0.2, 6);
    game.onGiantKilled(this, source);
  }

  private reach(titan: boolean) {
    return this.h * 0.45 + 1.5 + (titan ? CFG.titan.radius + 1.5 : 0);
  }

  private strike(game: Game) {
    const p = game.player;
    if (p.dead) return;
    const dx = p.pos.x - this.pos.x;
    const dz = p.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const dy = p.pos.y - this.pos.y;
    const titan = p.mode === 'titan';
    const dmg = this.type.dmg + this.h * 1.2;
    if (this.attackKind === 'stomp') {
      game.audio.stomp();
      game.shakeCam(Math.max(0, 1.2 - dist / 120));
      for (let i = 0; i < 40; i++) {
        const a = Math.random() * 6.28;
        game.particles.emit(this.pos.x + Math.sin(a) * 6, this.pos.y + 0.5, this.pos.z + Math.cos(a) * 6, Math.sin(a) * 22, 4, Math.cos(a) * 22, 1.2, 0x9a8f7a);
      }
      if (dist < this.h * 0.55 + (titan ? 4 : 0) && (titan || dy < 4)) p.takeHit(dmg * 1.2, this.pos, 18);
    } else if (dist < this.reach(titan) * 1.15 && dy < this.h * 1.2) {
      p.takeHit(dmg, this.pos, 12);
    }
  }

  update(dt: number, game: Game) {
    const b = this.body;
    this.stateT += dt;
    if (this.state === 'dead') {
      b.tilt.rotation.x = lerp(b.tilt.rotation.x, Math.PI / 2, 1 - Math.exp(-dt * 5));
      this.steamT -= dt;
      if (this.steamT <= 0) {
        this.steamT = 0.08;
        this.napeWorld(v);
        game.particles.emit(v.x + (Math.random() - 0.5) * this.h * 0.6, v.y, v.z + (Math.random() - 0.5) * this.h * 0.6, 0, 2, 0, 1.8, 0xbbbbbb, 9);
      }
      if (this.stateT > 1.4) {
        const o = Math.max(0, 1 - (this.stateT - 1.4) / 2.2);
        for (const m of b.mats) m.opacity = o;
      }
      if (this.stateT > 3.6) this.gone = true;
      return;
    }

    const p = game.player;
    if (this.slowT > 0) {
      this.slowT -= dt;
      if (this.slowT <= 0) this.marked = false;
    }
    if (this.attackCd > 0) this.attackCd -= dt;
    if (this.leapCd > 0) this.leapCd -= dt;

    const dx = p.pos.x - this.pos.x;
    const dz = p.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const dy = p.pos.y - this.pos.y;
    const titan = p.mode === 'titan';
    const targetable = !p.dead && !p.inTown;
    const slow = this.slowT > 0 ? 0.45 : 1;
    const speed = this.type.speed * (0.8 + this.h / 40) * slow;
    let move = 0;
    let moveYaw = this.yaw;
    this.moving = false;

    switch (this.state) {
      case 'wander': {
        this.wanderT -= dt;
        if (this.wanderT <= 0) {
          this.wanderT = 3 + Math.random() * 5;
          this.wanderYaw = Math.random() * 6.28;
          if (this.home) this.wanderYaw = Math.atan2(this.home.x - this.pos.x, this.home.z - this.pos.z) + (Math.random() - 0.5);
        }
        const homeDist = this.home ? Math.hypot(this.home.x - this.pos.x, this.home.z - this.pos.z) : 99;
        if (!this.home || homeDist > 12) {
          move = speed * (this.home ? 0.8 : 0.35);
          moveYaw = this.wanderYaw;
        }
        const aggro = this.home ? Math.hypot(p.pos.x - this.home.x, p.pos.z - this.home.z) < this.type.aggro : dist < this.type.aggro;
        if (targetable && aggro) this.setState('chase');
        break;
      }
      case 'chase': {
        const leashed = this.home !== null && Math.hypot(p.pos.x - this.home.x, p.pos.z - this.home.z) > this.type.aggro * 1.3;
        if (!targetable || dist > this.type.aggro * 1.7 || leashed) {
          this.setState('wander');
          break;
        }
        moveYaw = Math.atan2(dx, dz);
        const reach = this.reach(titan);
        if (dist > reach * 0.7) move = speed;
        if (dist < reach && dy < this.h * 1.2 && this.attackCd <= 0) {
          this.attackKind = this.type.kind === 'boss' && (titan || dy < 8) ? 'stomp' : 'swipe';
          this.setState('windup');
        } else if (this.type.kind === 'leaper' && this.leapCd <= 0 && !p.onGround && p.mode === 'foot' && dist > 12 && dist < 60) {
          const T = Math.min(1.3, Math.max(0.6, dist / 35));
          const tx = p.pos.x + p.vel.x * T * 0.6;
          const tz = p.pos.z + p.vel.z * T * 0.6;
          const ty = Math.max(game.world.heightAt(tx, tz), p.pos.y + p.vel.y * T * 0.3 - this.h * 0.6);
          this.vel.set((tx - this.pos.x) / T, (ty - this.pos.y) / T + 0.5 * LEAP_G * T, (tz - this.pos.z) / T);
          this.leapHit = false;
          this.leapCd = 6;
          this.setState('leap');
        }
        break;
      }
      case 'windup': {
        moveYaw = Math.atan2(dx, dz);
        if (this.stateT > (this.attackKind === 'stomp' ? 1.2 : 0.75)) {
          this.strike(game);
          this.attackCd = this.type.kind === 'boss' ? 2.4 : 1.5;
          this.setState('recover');
        }
        break;
      }
      case 'recover':
        if (this.stateT > 0.8) this.setState('chase');
        break;
      case 'stunned':
        if (this.stateT > this.stunDur) this.setState('chase');
        break;
      case 'downed':
        if (this.stateT > this.type.downTime) this.setState('rising');
        break;
      case 'rising':
        if (this.stateT > 1) {
          this.legHp = this.type.legHp;
          this.setState('chase');
        }
        break;
      case 'leap': {
        this.vel.y -= LEAP_G * dt;
        this.pos.addScaledVector(this.vel, dt);
        if (!this.leapHit && !p.dead) {
          v.set(this.pos.x, this.pos.y + this.h * 0.6, this.pos.z);
          if (v.distanceTo(p.pos) < this.h * 0.45 + 1.4) {
            this.leapHit = true;
            p.takeHit(this.type.dmg + this.h, this.pos, 16);
          }
        }
        const gy = game.world.heightAt(this.pos.x, this.pos.z);
        if (this.pos.y <= gy && this.vel.y < 0) {
          this.pos.y = gy;
          game.audio.stomp();
          this.attackCd = 1;
          this.setState('recover');
        }
        break;
      }
    }

    if (this.state !== 'leap') {
      if (this.avoidT > 0) {
        this.avoidT -= dt;
        moveYaw += this.avoidSign * 1.3;
      } else {
        this.sinceAvoid += dt;
      }
      this.yaw = turnToward(this.yaw, moveYaw, this.type.turn * (this.avoidT > 0 ? 2.5 : 1) * dt);
      if (move > 0) {
        const sx = Math.sin(this.yaw);
        const sz = Math.cos(this.yaw);
        const step = move * dt;
        this.pos.x += sx * step;
        this.pos.z += sz * step;
        // Ağaç ve binalar engeldir; takılınca engelin yanından dolanır.
        if (this.type.kind !== 'boss') {
          const ax = this.pos.x;
          const az = this.pos.z;
          if (game.world.resolve(this.pos, this.radius, OBSTACLES)) {
            const px = this.pos.x - ax;
            const pz = this.pos.z - az;
            const progress = 1 + (px * sx + pz * sz) / step;
            if (progress < 0.4 && this.avoidT <= 0) {
              // Aynı engele art arda takılırsa yön değiştirmeden dolanmayı sürdür.
              if (this.sinceAvoid > 4) {
                const side = px * sz - pz * sx;
                this.avoidSign = Math.abs(side) > step * 0.05 ? Math.sign(side) : Math.random() < 0.5 ? -1 : 1;
                this.avoidLen = 1.2;
              } else {
                this.avoidLen = Math.min(4, this.avoidLen + 0.8);
              }
              this.avoidT = this.avoidLen;
              this.sinceAvoid = 0;
            }
          }
        }
        this.phase += step / (this.h * 0.22);
        this.moving = true;
      }
      this.pos.y = game.world.heightAt(this.pos.x, this.pos.z);
    }
    // Devler şehre giremez; surlardan yalnızca kapılardan geçer.
    const r = Math.hypot(this.pos.x, this.pos.z);
    const minR = CFG.world.walls[0].r + 40;
    if (r < minR && r > 0.01) {
      this.pos.x *= minR / r;
      this.pos.z *= minR / r;
    }
    if (this.state !== 'leap') wallPush(this.pos, this.radius, 0);
    b.root.rotation.y = this.yaw;
    this.animate(dt, dy, dist);
  }

  private animate(dt: number, dy: number, dist: number) {
    const b = this.body;
    let aL = 0;
    let aR = 0;
    let lL = 0;
    let lR = 0;
    let tiltX = 0;
    let headX = 0;
    const swing = this.moving ? Math.sin(this.phase) * 0.55 : 0;
    lL = swing;
    lR = -swing;
    aL = -swing * 0.5;
    aR = swing * 0.5;
    switch (this.state) {
      case 'chase':
        if (dy > this.h * 0.9 && dist < this.h) aL = aR = -2.7;
        else if (this.type.kind === 'runner') aL = aR = 0.9;
        else {
          aL -= 0.9;
          aR -= 0.9;
        }
        if (this.type.kind === 'runner' || this.type.kind === 'leaper') tiltX = 0.25;
        break;
      case 'windup':
        if (this.attackKind === 'stomp') {
          lR = -1.3;
          tiltX = -0.08;
        } else aR = -2.8;
        break;
      case 'recover':
        if (this.attackKind === 'swipe') aR = -0.5;
        tiltX = 0.2;
        break;
      case 'stunned':
        headX = 0.6;
        tiltX = 0.12;
        aL = aR = 0.1;
        lL = lR = 0;
        break;
      case 'downed':
        tiltX = Math.PI / 2;
        aL = aR = -2.6;
        lL = lR = 0;
        break;
      case 'leap':
        aL = aR = -2.5;
        lL = lR = 0.6;
        tiltX = 0.5;
        break;
    }
    const k = 1 - Math.exp(-dt * (this.state === 'recover' ? 22 : 9));
    b.armL.rotation.x = lerp(b.armL.rotation.x, aL, k);
    b.armR.rotation.x = lerp(b.armR.rotation.x, aR, k);
    b.legL.rotation.x = lerp(b.legL.rotation.x, lL, k);
    b.legR.rotation.x = lerp(b.legR.rotation.x, lR, k);
    b.tilt.rotation.x = lerp(b.tilt.rotation.x, tiltX, 1 - Math.exp(-dt * 6));
    b.head.rotation.x = lerp(b.head.rotation.x, headX, k);
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.body.root);
    disposeHumanoid(this.body);
  }
}
