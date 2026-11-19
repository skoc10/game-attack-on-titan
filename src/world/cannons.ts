import * as THREE from 'three';
import type { Game } from '../game';
import type { Giant } from '../enemies/giant';
import type { Player } from '../player/player';
import { CFG } from '../data/config';
import { angDiff, clamp } from '../core/rng';
import { giantAxis, segmentDistance } from '../player/spears';
import { blastEffect, cannonSlots, flightTime, launchAngle, type CannonSlot } from '../systems/cannon';

const C = CFG.cannon;
const WALL_H = CFG.world.wallH;
/** Namlu boyu ve namlunun muylu (dönme ekseni) önündeki kısmı. */
const MUZZLE = 3.3;
/** Topçunun durduğu yer: topun arkasında. */
const SEAT = 3.2;

const a = new THREE.Vector3();
const b = new THREE.Vector3();
const n = new THREE.Vector3();
const tmp = new THREE.Vector3();
const m = new THREE.Matrix4();
const r = new THREE.Matrix4();
const q = new THREE.Quaternion();
const s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

interface Cannon extends CannonSlot {
  yaw: number;
  pitch: number;
  recoil: number;
  /** Bulunduğu sur parçası yıkıldı: görünmez, başına geçilemez. */
  broken?: boolean;
}

interface Shell {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  alive: boolean;
  t: number;
  target: Giant | null;
}

interface Blast {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  t: number;
}

/**
 * Sur topları. Topun yanına gelip E ile başına geçilir; imleç (ya da ekranın ortasındaki nişangâh)
 * bir deve doğrultulunca top ona kilitlenir, gidişini hesaba katıp açısını kendisi ayarlar.
 * Gülle kilitli deve doğru yönünü düzeltir; patlamanın içinde kalan sıradan devler ölür.
 */
export class Cannons {
  readonly list: Cannon[];
  /** Başına geçilmiş topun sırası. */
  manned: number | null = null;
  cooldown = 0;
  /** Nişanda kilitli dev ve hedefin uzaklığı (HUD için). */
  lock: Giant | null = null;
  aimDist = 0;
  /** Hedef menzilde ve topun dönebildiği açıda mı? */
  aimOk = false;
  private readonly carriage: THREE.InstancedMesh;
  private readonly barrel: THREE.InstancedMesh;
  private readonly wheel: THREE.InstancedMesh;
  private readonly shells: Shell[] = [];
  private readonly blasts: Blast[] = [];
  private readonly marker: THREE.Mesh;
  private readonly markerMat: THREE.MeshBasicMaterial;
  private readonly pin: THREE.Mesh;
  private readonly arc: THREE.Line;
  private readonly arcPos: Float32Array;
  /** Devlerin son konumu ve tahmini hızı: güllenin onları önden karşılaması için. */
  private readonly track = new Map<Giant, { x: number; z: number; vx: number; vz: number }>();

  constructor(scene: THREE.Scene) {
    this.list = cannonSlots().map((sl) => ({ ...sl, yaw: sl.face, pitch: 0.08, recoil: 0 }));
    const N = this.list.length;
    const wood = new THREE.MeshLambertMaterial({ color: 0x5a3f28 });
    const iron = new THREE.MeshLambertMaterial({ color: 0x2c2f33 });
    const carriageGeo = new THREE.BoxGeometry(1.9, 1.3, 3.0);
    const barrelGeo = new THREE.CylinderGeometry(0.36, 0.52, MUZZLE + 1.1, 14, 1);
    barrelGeo.rotateX(Math.PI / 2);
    barrelGeo.translate(0, 0, (MUZZLE - 1.1) / 2);
    const wheelGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.26, 14);
    wheelGeo.rotateZ(Math.PI / 2);
    this.carriage = new THREE.InstancedMesh(carriageGeo, wood, N);
    this.barrel = new THREE.InstancedMesh(barrelGeo, iron, N);
    this.wheel = new THREE.InstancedMesh(wheelGeo, wood, N * 2);
    for (const im of [this.carriage, this.barrel, this.wheel]) {
      im.castShadow = true;
      im.receiveShadow = true;
      scene.add(im);
    }
    for (let i = 0; i < N; i++) this.pose(i);
    for (const im of [this.carriage, this.barrel, this.wheel]) im.computeBoundingSphere();

    // Gülleler ve patlamalar
    const ball = new THREE.SphereGeometry(0.55, 12, 8);
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(ball, iron);
      mesh.visible = false;
      scene.add(mesh);
      this.shells.push({ mesh, vel: new THREE.Vector3(), alive: false, t: 0, target: null });
    }
    const fire = new THREE.SphereGeometry(1, 16, 10);
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      const mesh = new THREE.Mesh(fire, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.blasts.push({ mesh, mat, t: 0 });
    }

    // Nişan: güllenin düşeceği yer (halka), yörünge çizgisi ve kilitli devin üstünde bir işaret.
    this.markerMat = new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.marker = new THREE.Mesh(new THREE.RingGeometry(C.radius * 0.82, C.radius, 40), this.markerMat);
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.visible = false;
    this.marker.renderOrder = 5;
    this.pin = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3, 4), new THREE.MeshBasicMaterial({ color: 0xff4a3a, fog: false }));
    this.pin.rotation.x = Math.PI;
    this.pin.visible = false;
    this.arcPos = new Float32Array(48 * 3);
    const arcGeo = new THREE.BufferGeometry();
    arcGeo.setAttribute('position', new THREE.BufferAttribute(this.arcPos, 3));
    this.arc = new THREE.Line(arcGeo, new THREE.LineDashedMaterial({ color: 0xffe9b0, dashSize: 3, gapSize: 2.5, transparent: true, opacity: 0.8, fog: false }));
    this.arc.frustumCulled = false;
    this.arc.visible = false;
    scene.add(this.marker, this.pin, this.arc);
  }

  /** Bir topun taşıyıcısını, namlusunu ve tekerleklerini yönüne ve açısına göre yerleştirir. */
  private pose(i: number) {
    const c = this.list[i];
    const fx = Math.sin(c.yaw);
    const fz = Math.cos(c.yaw);
    q.setFromAxisAngle(UP, c.yaw);
    if (c.broken) {
      // Yıkık sur parçasındaki top: görünmez (sıfır ölçek).
      m.makeScale(0, 0, 0);
      this.carriage.setMatrixAt(i, m);
      this.barrel.setMatrixAt(i, m);
      this.wheel.setMatrixAt(i * 2, m);
      this.wheel.setMatrixAt(i * 2 + 1, m);
      this.carriage.instanceMatrix.needsUpdate = true;
      this.barrel.instanceMatrix.needsUpdate = true;
      this.wheel.instanceMatrix.needsUpdate = true;
      return;
    }
    m.compose(tmp.set(c.x - fx * 0.4, WALL_H + 0.85, c.z - fz * 0.4), q, s.set(1, 1, 1));
    this.carriage.setMatrixAt(i, m);
    // Namlu: muylu ekseninde yukarı/aşağı döner, atışta geri teper.
    m.makeRotationY(c.yaw);
    r.makeRotationX(-c.pitch);
    m.multiply(r);
    m.setPosition(c.x - fx * c.recoil, WALL_H + C.pivot, c.z - fz * c.recoil);
    this.barrel.setMatrixAt(i, m);
    for (const side of [-1, 1]) {
      m.compose(tmp.set(c.x + fz * side * 1.08 - fx * 0.2, WALL_H + 0.85, c.z - fx * side * 1.08 - fz * 0.2), q, s.set(1, 1, 1));
      this.wheel.setMatrixAt(i * 2 + (side < 0 ? 0 : 1), m);
    }
    this.carriage.instanceMatrix.needsUpdate = true;
    this.barrel.instanceMatrix.needsUpdate = true;
    this.wheel.instanceMatrix.needsUpdate = true;
  }

  /** Gedik açılınca (x, z) çevresindeki toplar yıkılır; onarılınca (`broken = false`) yerine gelir. */
  setBroken(x: number, z: number, radius: number, broken: boolean) {
    for (let i = 0; i < this.list.length; i++) {
      const c = this.list[i];
      if (Math.hypot(c.x - x, c.z - z) > radius || !!c.broken === broken) continue;
      c.broken = broken;
      if (this.manned === i && broken) this.manned = null;
      this.pose(i);
    }
  }

  /** Oyuncunun başına geçebileceği en yakın top. */
  nearest(pos: THREE.Vector3) {
    if (Math.abs(pos.y - WALL_H) > 3) return null;
    let best: number | null = null;
    let bd = C.reach + SEAT;
    for (let i = 0; i < this.list.length; i++) {
      const c = this.list[i];
      if (c.broken || Math.abs(c.x - pos.x) > bd || Math.abs(c.z - pos.z) > bd) continue;
      const d = Math.hypot(c.x - pos.x, c.z - pos.z);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  /** Topun başına geç. */
  man(i: number, game: Game) {
    const p = game.player;
    this.manned = i;
    this.lock = null;
    p.grapple.release();
    p.moveTarget = null;
    game.camYaw = this.list[i].face;
    game.camPitch = -0.22;
    game.hud.toast(game.input.touch ? 'Bir deve nişan al, ATEŞ tuşuna bas' : 'Bir deve nişan al ve tıkla — top açıyı kendisi ayarlar');
  }

  leave(game: Game) {
    if (this.manned === null) return;
    const p = game.player;
    this.seat(p);
    this.manned = null;
    this.lock = null;
    this.marker.visible = this.pin.visible = this.arc.visible = false;
    p.vel.set(0, 0, 0);
  }

  /** Topçu topun arkasında durur, yüzü namluya dönüktür. */
  seat(p: Player) {
    if (this.manned === null) return;
    const c = this.list[this.manned];
    p.pos.set(c.x - Math.sin(c.face) * SEAT, WALL_H, c.z - Math.cos(c.face) * SEAT);
    p.vel.set(0, 0, 0);
    p.onGround = true;
    p.faceYaw = c.yaw;
  }

  /** Topun başındayken girdiler: ateş, ayrılma. */
  input(game: Game) {
    const inp = game.input;
    if (inp.pressed('KeyE') || inp.pressed('Space')) {
      this.leave(game);
      return;
    }
    if (inp.mousePressed(0)) this.fire(game);
  }

  private fire(game: Game) {
    if (this.manned === null || this.cooldown > 0) return;
    if (!this.aimOk) {
      game.hud.toast(this.aimDist > 0 ? 'Hedef menzil dışında' : 'Top o yöne dönemez');
      this.cooldown = 0.3;
      return;
    }
    const shell = this.shells.find((x) => !x.alive);
    if (!shell) return;
    const c = this.list[this.manned];
    this.muzzle(c, a, b);
    shell.mesh.position.copy(a);
    shell.vel.copy(b).multiplyScalar(C.speed);
    shell.alive = true;
    shell.t = 0;
    shell.target = this.lock;
    shell.mesh.visible = true;
    this.cooldown = C.cooldown;
    c.recoil = 0.9;
    game.audio.cannonFire();
    game.shakeCam(0.45);
    game.particles.burst(a, 40, 16, 0.6, 0xffc070, 1.2);
    game.particles.burst(a, 36, 6, 2.4, 0x8d8d8d, 3, 4, 2.6, 1.5);
  }

  /** Namlu ucunun yeri (out) ve namlunun yönü (dir). */
  private muzzle(c: Cannon, out: THREE.Vector3, dir: THREE.Vector3) {
    const cp = Math.cos(c.pitch);
    dir.set(Math.sin(c.yaw) * cp, Math.sin(c.pitch), Math.cos(c.yaw) * cp);
    return out.set(c.x, WALL_H + C.pivot, c.z).addScaledVector(dir, MUZZLE);
  }

  /** Bir devin gülleyle vurulacak noktası: gövdenin üst kısmı (enseye yakın). */
  private aimPointOf(gi: Giant, out: THREE.Vector3) {
    if (gi.state === 'downed' || gi.type.crawl) return out.set(gi.pos.x, gi.pos.y + gi.h * 0.2, gi.pos.z);
    return out.set(gi.pos.x, gi.pos.y + gi.h * 0.72, gi.pos.z);
  }

  /** İmlecin (nişangâhın) gösterdiği dev: bakış ışınına en yakın açıdaki, menzildeki dev. */
  private pick(game: Game, c: Cannon) {
    const cam = game.camera.position;
    const dir = game.aimDir;
    let best: Giant | null = null;
    let bestAng: number = C.lockAngle;
    const range = (C.speed * C.speed) / C.gravity;
    for (const gi of game.giants) {
      if (!gi.alive) continue;
      if (Math.hypot(gi.pos.x - c.x, gi.pos.z - c.z) > range) continue;
      this.aimPointOf(gi, tmp).sub(cam);
      const d = tmp.length();
      // Uzaktaki küçük devler için biraz daha geniş kilit açısı.
      const ang = Math.acos(clamp(tmp.dot(dir) / d, -1, 1)) - Math.atan((gi.radius + 2) / d);
      if (ang < bestAng) {
        bestAng = ang;
        best = gi;
      }
    }
    // İmlecin altındaki yere yakın bir dev de kilitlenir.
    if (!best) {
      let bd = 18;
      for (const gi of game.giants) {
        if (!gi.alive) continue;
        const d = Math.hypot(gi.pos.x - game.aimPoint.x, gi.pos.z - game.aimPoint.z);
        if (d < bd) {
          bd = d;
          best = gi;
        }
      }
    }
    return best;
  }

  update(dt: number, game: Game) {
    if (this.cooldown > 0) this.cooldown -= dt;
    const p = game.player;
    if (this.manned !== null && (p.dead || p.mode !== 'foot' || p.grabbedBy)) this.leave(game);

    // Devlerin hızını izle (yalnızca top başındayken ya da gülle uçarken gerekir).
    const needTrack = this.manned !== null || this.shells.some((x) => x.alive);
    if (needTrack && dt > 0) {
      for (const gi of game.giants) {
        const t = this.track.get(gi);
        if (!t) this.track.set(gi, { x: gi.pos.x, z: gi.pos.z, vx: 0, vz: 0 });
        else {
          const k = 1 - Math.exp(-dt * 4);
          t.vx += ((gi.pos.x - t.x) / dt - t.vx) * k;
          t.vz += ((gi.pos.z - t.z) / dt - t.vz) * k;
          t.x = gi.pos.x;
          t.z = gi.pos.z;
        }
      }
      for (const gi of this.track.keys()) if (!gi.alive || gi.gone) this.track.delete(gi);
    }

    if (this.manned !== null) this.aim(dt, game);

    // Geri tepen namlular yerine döner.
    for (let i = 0; i < this.list.length; i++) {
      const c = this.list[i];
      if (c.recoil <= 0 || i === this.manned) continue;
      c.recoil = Math.max(0, c.recoil - dt * 1.5);
      this.pose(i);
    }

    this.updateShells(dt, game);
    for (const bl of this.blasts) {
      if (!bl.mesh.visible) continue;
      bl.t += dt;
      const u = bl.t / 0.55;
      if (u >= 1) {
        bl.mesh.visible = false;
        continue;
      }
      bl.mesh.scale.setScalar(C.radius * (0.3 + 0.7 * (1 - (1 - u) ** 3)));
      bl.mat.opacity = 0.9 * (1 - u) ** 1.5;
    }
  }

  /** Top başındayken: hedefi seç, namluyu ona çevir, düşeceği yeri göster. */
  private aim(dt: number, game: Game) {
    const i = this.manned!;
    const c = this.list[i];
    const pivotY = WALL_H + C.pivot;
    this.lock = this.pick(game, c);
    // Hedef: kilitli devin gideceği yer (uçuş süresi kadar ileri), yoksa imlecin altındaki yer.
    if (this.lock) this.aimPointOf(this.lock, n);
    else n.copy(game.aimPoint);
    const tr = this.lock ? this.track.get(this.lock) : undefined;
    let tx = n.x;
    let tz = n.z;
    let angle: number | null = null;
    for (let k = 0; k < 3; k++) {
      const d = Math.hypot(tx - c.x, tz - c.z);
      angle = launchAngle(d, n.y - pivotY);
      if (angle === null || !tr) break;
      const t = flightTime(d, angle);
      tx = n.x + tr.vx * t;
      tz = n.z + tr.vz * t;
    }
    const want = Math.atan2(tx - c.x, tz - c.z);
    const off = angDiff(want, c.face);
    const yawOk = Math.abs(off) <= C.arc;
    this.aimDist = Math.hypot(tx - c.x, tz - c.z);
    this.aimOk = yawOk && angle !== null;
    const yawGoal = c.face + clamp(off, -C.arc, C.arc);
    const pitchGoal = angle ?? Math.PI / 4;
    if (!yawOk) this.aimDist = 0;
    // Namlu hedefe hızla döner.
    const k = 1 - Math.exp(-dt * 10);
    c.yaw += angDiff(yawGoal, c.yaw) * k;
    c.pitch += (clamp(pitchGoal, -0.9, 1.2) - c.pitch) * k;
    if (c.recoil > 0) c.recoil = Math.max(0, c.recoil - dt * 1.5);
    this.pose(i);
    game.player.faceYaw = c.yaw;

    // Yörünge önizlemesi: namlunun şu anki açısıyla güllenin izleyeceği yol.
    this.muzzle(c, a, b);
    b.multiplyScalar(C.speed);
    const pts = this.arcPos;
    const N = pts.length / 3;
    let landed = false;
    const step = 0.1;
    let used = 0;
    for (let s2 = 0; s2 < 90 && !landed; s2++) {
      b.y -= C.gravity * step;
      a.addScaledVector(b, step);
      const gy = game.world.heightAt(a.x, a.z);
      if (a.y <= gy) {
        a.y = gy;
        landed = true;
      }
      if (used < N && (s2 % 2 === 0 || landed)) {
        pts[used * 3] = a.x;
        pts[used * 3 + 1] = a.y;
        pts[used * 3 + 2] = a.z;
        used++;
      }
    }
    for (let j = used; j < N; j++) {
      pts[j * 3] = a.x;
      pts[j * 3 + 1] = a.y;
      pts[j * 3 + 2] = a.z;
    }
    const g = this.arc.geometry;
    g.attributes.position.needsUpdate = true;
    g.setDrawRange(0, Math.max(2, used));
    this.arc.computeLineDistances();
    this.arc.visible = this.aimOk;
    this.marker.visible = this.aimOk;
    this.marker.position.set(a.x, game.world.heightAt(a.x, a.z) + 0.4, a.z);
    this.markerMat.color.setHex(this.lock ? 0xff5a40 : 0xffd060);
    this.pin.visible = this.lock !== null;
    if (this.lock) {
      // Uzaktaki devin işareti de seçilebilsin diye uzaklıkla büyür.
      const k = Math.max(1, Math.hypot(this.lock.pos.x - c.x, this.lock.pos.z - c.z) / 70);
      this.pin.scale.setScalar(k);
      this.pin.position.set(this.lock.pos.x, this.lock.pos.y + this.lock.h + 3 * k + Math.sin(performance.now() * 0.006) * 0.6 * k, this.lock.pos.z);
    }
  }

  private updateShells(dt: number, game: Game) {
    for (const sh of this.shells) {
      if (!sh.alive) continue;
      const steps = 4;
      const h = dt / steps;
      for (let i = 0; i < steps && sh.alive; i++) {
        sh.t += h;
        const tg = sh.target && sh.target.alive ? sh.target : null;
        if (tg) {
          // Kilitli deve doğru yatay yön düzeltmesi: yaklaştıkça yükseklik de düzeltilir.
          this.aimPointOf(tg, n);
          const dx = n.x - sh.mesh.position.x;
          const dz = n.z - sh.mesh.position.z;
          const hd = Math.hypot(dx, dz);
          const hs = Math.hypot(sh.vel.x, sh.vel.z);
          if (hd > 0.5 && hs > 1) {
            const lim = C.homing * h;
            sh.vel.x += clamp((dx / hd) * hs - sh.vel.x, -lim, lim);
            sh.vel.z += clamp((dz / hd) * hs - sh.vel.z, -lim, lim);
            if (hd < 45) sh.vel.y += clamp(((n.y - sh.mesh.position.y) / Math.max(0.2, hd / hs)) - sh.vel.y, -lim, lim);
          }
        }
        sh.vel.y -= C.gravity * h;
        sh.mesh.position.addScaledVector(sh.vel, h);
        const pos = sh.mesh.position;
        if (sh.t > 9 || this.touching(pos, game) || pos.y <= game.world.heightAt(pos.x, pos.z) + 0.2 || game.world.solidAt(pos.x, pos.y, pos.z, 0)) {
          this.explode(pos, game);
          sh.alive = false;
          sh.mesh.visible = false;
        }
      }
      if (sh.alive) {
        const p = sh.mesh.position;
        game.particles.emit(p.x, p.y, p.z, 0, 0.4, 0, 0.8, 0x9a9a9a, 2.4);
      }
    }
  }

  private touching(pos: THREE.Vector3, game: Game) {
    for (const gi of game.giants) {
      if (!gi.alive) continue;
      const span = gi.h + 6;
      if (Math.abs(gi.pos.x - pos.x) > span || Math.abs(gi.pos.z - pos.z) > span) continue;
      giantAxis(gi, a, b);
      if (segmentDistance(pos, a, b) < gi.radius * 1.1 + 0.6) return true;
    }
    return false;
  }

  private explode(at: THREE.Vector3, game: Game) {
    const bl = this.blasts.find((x) => !x.mesh.visible) ?? this.blasts[0];
    bl.mesh.position.copy(at);
    bl.mesh.scale.setScalar(1);
    bl.mesh.visible = true;
    bl.t = 0;
    game.particles.burst(at, 80, 38, 0.8, 0xffa838, 1.8);
    game.particles.burst(at, 60, 10, 2.4, 0x6f6f6f, 3.5, 5, 3.4, 2);
    game.rings.spawn(at.x, Math.min(at.y, game.world.heightAt(at.x, at.z) + 0.2), at.z, C.radius * 2.4, 0xffb050, 0.55);
    game.audio.explosion(at.x, at.z);
    const p = game.player;
    const dist = at.distanceTo(p.pos);
    game.shakeCam(Math.max(0.15, 1.2 - dist / 90));

    game.killBy = 'cannon';
    let kills = 0;
    for (const gi of [...game.giants]) {
      if (!gi.alive) continue;
      if (Math.abs(gi.pos.x - at.x) > gi.h + C.radius + 5 || Math.abs(gi.pos.z - at.z) > gi.h + C.radius + 5) continue;
      gi.napeWorld(n);
      giantAxis(gi, a, b);
      const fx = blastEffect(gi.heavy, n.distanceTo(at), gi.napeRadius, segmentDistance(at, a, b), gi.radius);
      if (fx === 'kill') {
        // Zırh delen bir isabet: ensesi tek seferde düşmeyen dev için tekrarla.
        for (let k = 0; k < 4 && gi.alive; k++) if (gi.hitNape(game, true, true) === 'kill') kills++;
      } else if (fx === 'nape') {
        if (gi.hitNape(game, true, true) === 'kill') kills++;
        else gi.stun(1.5);
      } else if (fx === 'stagger') {
        gi.hitLeg(true);
        gi.hitLeg(true);
        gi.stun(1.5);
      }
    }
    game.killBy = null;
    if (kills > 1) game.hud.toast(`Tek güllede ${kills} dev!`);
    if (dist < C.radius * 0.7) p.takeHit(30, at, 14);
  }
}
