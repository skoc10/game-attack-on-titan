import * as THREE from 'three';
import type { Game } from '../game';
import type { Giant } from '../enemies/giant';
import { CFG } from '../data/config';

const S = CFG.spear;
const a = new THREE.Vector3();
const b = new THREE.Vector3();
const n = new THREE.Vector3();

interface Shot {
  mesh: THREE.Group;
  vel: THREE.Vector3;
  alive: boolean;
  flown: number;
}

interface Blast {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  t: number;
}

/** Bir noktanın a-b doğru parçasına uzaklığı. */
export function segmentDistance(p: THREE.Vector3, s0: THREE.Vector3, s1: THREE.Vector3) {
  n.subVectors(s1, s0);
  const len2 = n.lengthSq();
  const dot = (p.x - s0.x) * n.x + (p.y - s0.y) * n.y + (p.z - s0.z) * n.z;
  const t = len2 > 0 ? Math.max(0, Math.min(1, dot / len2)) : 0;
  return Math.hypot(p.x - s0.x - n.x * t, p.y - s0.y - n.y * t, p.z - s0.z - n.z * t);
}

/**
 * Patlar Mızrak: teçhizattan nişan alınan yöne fırlatılır; bir deve, yapıya ya da yere çarpınca patlar.
 * Patlama enseye yakınsa zırhı delip öldürür, gövdeye yakınsa devi yere serer. Yakınında duran oyuncu da zarar görür.
 */
export class Spears {
  cooldown = 0;
  private readonly shots: Shot[] = [];
  private readonly blasts: Blast[] = [];

  constructor(scene: THREE.Scene) {
    const shaft = new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6);
    shaft.rotateX(Math.PI / 2);
    const tip = new THREE.ConeGeometry(0.2, 0.9, 6);
    tip.rotateX(Math.PI / 2);
    const steel = new THREE.MeshLambertMaterial({ color: 0x8f979f });
    const hot = new THREE.MeshBasicMaterial({ color: 0xffee66 });
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const s = new THREE.Mesh(shaft, steel);
      const t = new THREE.Mesh(tip, hot);
      t.position.z = 1.6;
      g.add(s, t);
      g.visible = false;
      scene.add(g);
      this.shots.push({ mesh: g, vel: new THREE.Vector3(), alive: false, flown: 0 });
    }
    const ball = new THREE.SphereGeometry(1, 16, 10);
    for (let i = 0; i < 4; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      const mesh = new THREE.Mesh(ball, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.blasts.push({ mesh, mat, t: 0 });
    }
  }

  /** Mızrak fırlatır; atılamadıysa nedenini bildirir. */
  fire(game: Game) {
    const p = game.player;
    if (this.cooldown > 0 || p.dead || p.mode === 'titan') return false;
    if (p.spears <= 0) {
      game.hud.toast('Mızrağın yok — sarı ışıklı sandık ya da köy ara');
      this.cooldown = 0.5;
      return false;
    }
    const shot = this.shots.find((s) => !s.alive);
    if (!shot) return false;
    p.spears -= 1;
    this.cooldown = S.cooldown;
    // Nişan: imlecin gösterdiği yüzey, yoksa bakış yönünde uzak bir nokta.
    a.set(p.pos.x, p.pos.y + 1.3, p.pos.z);
    if (game.aim) b.copy(game.aim.point);
    else b.copy(game.camera.position).addScaledVector(game.aimDir, 140);
    b.sub(a).normalize();
    shot.mesh.position.copy(a).addScaledVector(b, 1.2);
    shot.vel.copy(b).multiplyScalar(S.speed).addScaledVector(p.vel, 0.35);
    shot.alive = true;
    shot.flown = 0;
    shot.mesh.visible = true;
    game.audio.spearFire();
    // Geri tepme: oyuncuyu hafifçe geriye iter.
    p.vel.addScaledVector(b, -3);
    return true;
  }

  update(dt: number, game: Game) {
    if (this.cooldown > 0) this.cooldown -= dt;
    for (const s of this.shots) {
      if (!s.alive) continue;
      const steps = 3;
      const h = dt / steps;
      for (let i = 0; i < steps && s.alive; i++) {
        s.vel.y -= S.gravity * h;
        s.mesh.position.addScaledVector(s.vel, h);
        s.flown += s.vel.length() * h;
        const pos = s.mesh.position;
        const hit = this.touching(pos, game);
        if (hit || s.flown > S.range || pos.y <= game.world.heightAt(pos.x, pos.z) + 0.15 || game.world.solidAt(pos.x, pos.y, pos.z, 0.1)) {
          this.explode(pos, game);
          s.alive = false;
          s.mesh.visible = false;
        }
      }
      if (s.alive) {
        b.copy(s.mesh.position).add(s.vel);
        s.mesh.lookAt(b);
        const p = s.mesh.position;
        game.particles.emit(p.x, p.y, p.z, (Math.random() - 0.5) * 2, 0.5, (Math.random() - 0.5) * 2, 0.5, 0xfff0a0, 2);
        game.particles.emit(p.x, p.y, p.z, 0, 0, 0, 0.9, 0x9a9a9a, 3);
      }
    }
    for (const bl of this.blasts) {
      if (!bl.mesh.visible) continue;
      bl.t += dt;
      const u = bl.t / 0.45;
      if (u >= 1) {
        bl.mesh.visible = false;
        continue;
      }
      bl.mesh.scale.setScalar(S.radius * (0.25 + 0.75 * (1 - (1 - u) ** 3)));
      bl.mat.opacity = 0.85 * (1 - u) ** 1.6;
    }
  }

  /** Devin gövde ekseni: ayaktayken dikey, yerdeyken baktığı yöne doğru yatay. */
  private axis(gi: Giant) {
    if (gi.state === 'downed' || gi.type.crawl) {
      a.set(gi.pos.x, gi.pos.y + gi.h * 0.12, gi.pos.z);
      b.set(gi.pos.x + Math.sin(gi.yaw) * gi.h * 0.9, gi.pos.y + gi.h * 0.2, gi.pos.z + Math.cos(gi.yaw) * gi.h * 0.9);
    } else {
      a.copy(gi.pos);
      b.set(gi.pos.x, gi.pos.y + gi.h * 0.92, gi.pos.z);
    }
  }

  private touching(pos: THREE.Vector3, game: Game) {
    for (const gi of game.giants) {
      if (!gi.alive) continue;
      const span = gi.h + 6;
      if (Math.abs(gi.pos.x - pos.x) > span || Math.abs(gi.pos.z - pos.z) > span) continue;
      this.axis(gi);
      if (segmentDistance(pos, a, b) < gi.radius * 1.15 + 0.3) return true;
    }
    return false;
  }

  private explode(at: THREE.Vector3, game: Game) {
    const p = game.player;
    const blast = this.blasts.find((x) => !x.mesh.visible) ?? this.blasts[0];
    blast.mesh.position.copy(at);
    blast.mesh.scale.setScalar(1);
    blast.mesh.visible = true;
    blast.t = 0;
    game.particles.burst(at, 70, 34, 0.7, 0xffb040, 1.5);
    game.particles.burst(at, 40, 22, 0.5, 0xfff4c0, 1);
    game.particles.burst(at, 50, 9, 2.2, 0x777777, 3, 5);
    const dist = at.distanceTo(p.pos);
    game.audio.explosion(at.x, at.z);
    game.shakeCam(Math.max(0.2, 1.3 - dist / 70));

    game.killBy = 'spear';
    let kills = 0;
    let downs = 0;
    for (const gi of [...game.giants]) {
      if (!gi.alive) continue;
      if (Math.abs(gi.pos.x - at.x) > gi.h + 20 || Math.abs(gi.pos.z - at.z) > gi.h + 20) continue;
      gi.napeWorld(n);
      if (n.distanceTo(at) < S.radius * 0.55 + gi.napeRadius) {
        // Enseye yakın patlama zırhı deler.
        if (gi.hitNape(game, true, true) === 'kill') kills++;
        continue;
      }
      this.axis(gi);
      if (segmentDistance(at, a, b) > S.radius + gi.radius) continue;
      if (gi.type.kind === 'boss') {
        gi.hitLeg(true);
        gi.hitLeg(true);
        gi.stun(1.5);
      } else if (gi.hitLeg(true, true) === 'down') downs++;
      else gi.stun(2);
    }
    game.killBy = null;
    if (kills === 0 && downs > 0) game.hud.toast(downs > 1 ? `${downs} dev yere serildi — enselerine vur!` : 'Dev yere serildi — ensesine vur!');
    if (dist < S.selfRadius) {
      game.hud.toast('Patlamaya çok yakındın!');
      p.takeHit(S.selfDmg * (1 - dist / S.selfRadius / 2), at, 16);
    }
  }
}
