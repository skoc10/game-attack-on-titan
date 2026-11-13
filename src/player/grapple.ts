import * as THREE from 'three';
import type { Game } from '../game';
import type { Giant } from '../enemies/giant';
import type { Player } from './player';
import { CFG } from '../data/config';

const G = CFG.grapple;
const dir = new THREE.Vector3();
const tmp = new THREE.Vector3();

export interface AimHit {
  point: THREE.Vector3;
  giant: Giant | null;
}

/** Kanca Teçhizatı: nişan alınan yüzeye saplanır, oyuncuyu sarkaç gibi çeker. */
export class Grapple {
  active = false;
  readonly anchor = new THREE.Vector3();
  giant: Giant | null = null;
  private readonly local = new THREE.Vector3();
  private readonly ray = new THREE.Raycaster();
  private readonly line: THREE.Line;
  private readonly linePos: THREE.BufferAttribute;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.BufferGeometry();
    this.linePos = new THREE.BufferAttribute(new Float32Array(6), 3);
    geo.setAttribute('position', this.linePos);
    this.line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xc9ced2 }));
    this.line.frustumCulled = false;
    this.line.visible = false;
    scene.add(this.line);
  }

  /** Nişangâhın gösterdiği, menzil içindeki tutunma noktası. */
  aim(game: Game): AimHit | null {
    this.ray.setFromCamera(game.cursor, game.camera);
    this.ray.near = game.camEff * 0.85;
    this.ray.far = G.range + game.camEff + 20;
    const targets: THREE.Object3D[] = [...game.world.grappleTargets];
    for (const g of game.giants) if (g.alive) targets.push(g.body.root);
    const hits = this.ray.intersectObjects(targets, true);
    for (const h of hits) {
      if (h.point.distanceTo(game.player.pos) > G.range) return null;
      return { point: h.point, giant: (h.object.userData.giant as Giant | undefined) ?? null };
    }
    return null;
  }

  fire(game: Game) {
    const p = game.player;
    if (p.gas <= 0) return false;
    const hit = this.aim(game);
    if (!hit) return false;
    this.attach(hit.point, hit.giant);
    p.onGround = false;
    game.audio.hook();
    return true;
  }

  attach(point: THREE.Vector3, giant: Giant | null) {
    this.active = true;
    this.anchor.copy(point);
    this.giant = giant;
    if (giant) {
      giant.body.root.updateWorldMatrix(true, false);
      giant.body.root.worldToLocal(this.local.copy(point));
    }
    this.line.visible = true;
  }

  release() {
    this.active = false;
    this.giant = null;
    this.line.visible = false;
  }

  /** Halat kuvvetlerini oyuncunun hızına uygular. */
  apply(dt: number, p: Player) {
    if (!this.active) return;
    if (this.giant) {
      if (this.giant.gone || (!this.giant.alive && this.giant.stateT > 0.6)) {
        this.release();
        return;
      }
      this.giant.body.root.updateWorldMatrix(true, false);
      this.giant.body.root.localToWorld(this.anchor.copy(this.local));
    }
    dir.copy(this.anchor).sub(tmp.set(p.pos.x, p.pos.y + 1, p.pos.z));
    const dist = dir.length();
    if (dist < 1e-4) return;
    dir.multiplyScalar(1 / dist);
    if (dist > G.holdDist) {
      p.vel.addScaledVector(dir, G.reelAccel * p.cls.reel * dt);
      p.gas -= G.gasPerSec * dt;
    } else {
      // Tutunma noktasında asılı kal.
      p.vel.multiplyScalar(Math.max(0, 1 - 8 * dt));
      p.vel.y += CFG.player.gravity * 0.55 * dt;
    }
    const vr = p.vel.dot(dir);
    if (vr < 0) p.vel.addScaledVector(dir, -vr);
    if (p.gas <= 0) {
      p.gas = 0;
      this.release();
    }
  }

  updateLine(p: Player) {
    if (!this.active) return;
    this.linePos.setXYZ(0, p.pos.x, p.pos.y + 1, p.pos.z);
    this.linePos.setXYZ(1, this.anchor.x, this.anchor.y, this.anchor.z);
    this.linePos.needsUpdate = true;
  }
}
