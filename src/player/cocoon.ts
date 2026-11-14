import * as THREE from 'three';
import type { Game } from '../game';
import { CFG } from '../data/config';

const C = CFG.cocoon;
const v = new THREE.Vector3();

/**
 * Billur koza: oyuncu kendini sert bir kabuğun içine kapatır. İçindeyken hasar almaz,
 * yakalanamaz, devler onu göremez ve yavaşça iyileşir. Süre dolunca (ya da yeniden C'ye basınca)
 * kabuk kırılır ve çevredeki devleri sersemletir.
 */
export class Cocoon {
  /** Kalan süre; 0 ise koza kapalı. */
  t = 0;
  cd = 0;
  private readonly shell: THREE.Mesh;
  private readonly core: THREE.Mesh;
  private grow = 0;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    this.shell = new THREE.Mesh(
      geo,
      new THREE.MeshPhongMaterial({ color: 0x9fe8ff, emissive: 0x1f5a7a, specular: 0xffffff, shininess: 90, flatShading: true, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    this.core = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.shell.visible = this.core.visible = false;
    scene.add(this.shell, this.core);
  }

  get active() {
    return this.t > 0;
  }

  /** C tuşu: kapalıysa kozayı kurar, açıksa erken kırar. */
  toggle(game: Game) {
    if (this.active) {
      this.shatter(game);
      return;
    }
    const p = game.player;
    if (p.dead || p.mode === 'titan') return;
    if (this.cd > 0) {
      game.hud.toast(`Koza hazır değil — ${Math.ceil(this.cd)} sn`);
      return;
    }
    if (p.mode === 'mounted') p.dismount(false);
    const by = p.grabbedBy;
    if (by) {
      // Devin elindeyken kurulursa parmaklarını açtırır.
      p.releaseGrab(by);
      by.stun(3);
    }
    p.grapple.release();
    p.moveTarget = null;
    this.t = C.dur;
    this.grow = 0;
    this.shell.visible = this.core.visible = true;
    game.audio.crystal();
    v.set(p.pos.x, p.pos.y + 1, p.pos.z);
    game.particles.burst(v, 50, 9, 0.8, 0xbff4ff, 1.5);
    game.hud.toast('Billur koza — içindeyken sana dokunamazlar');
  }

  private shatter(game: Game) {
    const p = game.player;
    this.t = 0;
    this.cd = C.cooldown;
    this.shell.visible = this.core.visible = false;
    v.set(p.pos.x, p.pos.y + 1.1, p.pos.z);
    game.particles.burst(v, 120, 26, 1.1, 0xbff4ff, 1.5);
    game.particles.burst(v, 60, 14, 0.7, 0xffffff, 1);
    game.audio.shatter();
    game.shakeCam(0.7);
    let n = 0;
    for (const gi of game.giants) {
      if (!gi.alive || Math.hypot(gi.pos.x - p.pos.x, gi.pos.z - p.pos.z) > C.stunRadius + gi.radius) continue;
      gi.stun(gi.type.kind === 'boss' ? C.stun * 0.5 : C.stun);
      n++;
    }
    p.shieldBreak();
    if (n > 0) game.hud.toast(n > 1 ? `Koza kırıldı — ${n} dev sersemledi` : 'Koza kırıldı — dev sersemledi');
  }

  update(dt: number, game: Game) {
    if (this.cd > 0) this.cd -= dt;
    if (!this.active) return;
    const p = game.player;
    this.t -= dt;
    if (this.t <= 0 || p.dead) {
      this.shatter(game);
      return;
    }
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * C.heal * dt);
    this.grow = Math.min(1, this.grow + dt * 5);
    const pulse = 1 + Math.sin(performance.now() * 0.004) * 0.02;
    // Son saniyede çatlar: kabuk titrer ve solar.
    const crack = this.t < 1.2 ? 1 - this.t / 1.2 : 0;
    const jitter = crack * (Math.random() - 0.5) * 0.08;
    this.shell.position.set(p.pos.x + jitter, p.pos.y + 1.05, p.pos.z + jitter);
    this.shell.scale.set(1.25 * this.grow * pulse, 1.85 * this.grow * pulse, 1.25 * this.grow * pulse);
    this.shell.rotation.y += dt * 0.35;
    (this.shell.material as THREE.MeshPhongMaterial).opacity = 0.55 - crack * 0.3 * Math.abs(Math.sin(performance.now() * 0.03));
    this.core.position.copy(this.shell.position);
    this.core.scale.copy(this.shell.scale).multiplyScalar(1.12);
  }
}
