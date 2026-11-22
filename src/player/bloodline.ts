import * as THREE from 'three';
import type { Game } from '../game';
import { CFG } from '../data/config';
import { TITAN_IDS, TITANS, type TitanId } from '../data/titans';
import { Giant } from '../enemies/giant';
import { shifterType } from '../enemies/giantTypes';

/** Kan soyları: Çelik Soyu uyanınca hızlanır ve az gaz yakar; Taç Soyu kükreyince yanına dost dönüşümcüler çağırır. */
export type BloodId = 'celik' | 'tac';

export const BLOODS: Record<BloodId, { name: string; desc: string }> = {
  celik: { name: 'Çelik Soyu', desc: 'B ile uyanış: daha hızlı uçar ve koşar, gazı yarı yarıya az yakar' },
  tac: { name: 'Taç Soyu', desc: 'Dev formunda kükreyince bazen yanında dost dönüşümcüler belirir' },
};

/** Dost dönüşümcü olabilecek formlar (çok iri olanlar hariç). */
const ALLY_FORMS: TitanId[] = TITAN_IDS.filter((id) => TITANS[id].height <= 20);
const v = new THREE.Vector3();

/** Karakterin kan soyunun etkileri: Çelik Soyu'nun uyanışı ve Taç Soyu'nun çağırdığı dost dönüşümcüler. */
export class Bloodline {
  /** Çelik Soyu uyanışının kalan süresi ve yeniden uyanmaya kalan süre. */
  awakeT = 0;
  awakeCd = 0;
  private trailT = 0;
  /** Taç Soyu'nun çağırdığı dost dönüşümcüler (düşman listesinde değildir: oyuncunun darbeleri onlara değmez). */
  readonly allies: Giant[] = [];

  constructor(private readonly game: Game) {}

  /** Seçili karakterin kan soyu (yoksa null). */
  get blood(): BloodId | null {
    return this.game.player.char.blood ?? null;
  }

  get awake() {
    return this.awakeT > 0;
  }
  /** Uyanıkken koşu hızı, itiş, kanca çekişi, en yüksek hız ve gaz tüketimi katları. */
  get moveMul() {
    return this.awake ? CFG.blood.celik.move : 1;
  }
  get boostMul() {
    return this.awake ? CFG.blood.celik.boost : 1;
  }
  get reelMul() {
    return this.awake ? CFG.blood.celik.reel : 1;
  }
  get maxMul() {
    return this.awake ? CFG.blood.celik.maxSpeed : 1;
  }
  get gasMul() {
    return this.awake ? CFG.blood.celik.gas : 1;
  }

  /** Çelik Soyu: B ile uyanış. */
  awaken() {
    const g = this.game;
    if (this.blood !== 'celik' || g.player.mode === 'titan' || g.player.dead) return;
    if (this.awakeT > 0) return;
    if (this.awakeCd > 0) {
      g.hud.toast(`Uyanış için ${Math.ceil(this.awakeCd)} sn bekle`);
      return;
    }
    const C = CFG.blood.celik;
    this.awakeT = C.dur;
    this.awakeCd = C.cd;
    g.audio.awaken();
    g.hud.callout('UYANIŞ');
    g.hud.toast(`Çelik Soyu uyandı — ${C.dur} sn boyunca daha hızlısın, gazın yarı yarıya az tükenir`);
    const p = g.player.pos;
    g.particles.burst(v.set(p.x, p.y + 1, p.z), 30, 10, 0.7, 0xff3a2a, 0.6);
  }

  /** Dev formunda kükreyiş: Taç Soyu'ndaysa bazen yanında dost dönüşümcüler belirir. */
  onRoar() {
    const g = this.game;
    const T = CFG.blood.tac;
    if (this.blood !== 'tac' || Math.random() >= T.chance) return;
    const p = g.player.pos;
    let made = 0;
    for (let i = 0; i < T.count; i++) {
      const id = ALLY_FORMS[Math.floor(Math.random() * ALLY_FORMS.length)];
      const form = TITANS[id];
      const a = g.player.faceYaw + (i === 0 ? 1 : -1) * (0.9 + Math.random() * 0.8);
      const r = T.radius * (0.7 + Math.random() * 0.4);
      const x = p.x + Math.sin(a) * r;
      const z = p.z + Math.cos(a) * r;
      const gi = new Giant(shifterType(form), x, z, g, form);
      gi.ally = true;
      gi.allyT = T.dur;
      gi.yaw = g.player.faceYaw;
      this.allies.push(gi);
      g.strikeAt(x, gi.pos.y, z, form.height, form.color);
      made++;
    }
    if (made > 0) {
      g.hud.banner('TAÇ SOYU', `Kükreyişin ${made} dönüşümcüyü uyandırdı — ${T.dur} sn senin için savaşacaklar`);
    }
  }

  update(dt: number) {
    const g = this.game;
    if (this.awakeCd > 0) this.awakeCd -= dt;
    if (this.awakeT > 0) {
      this.awakeT -= dt;
      // Uyanıkken gövdeden kızıl kıvılcımlar savrulur.
      this.trailT -= dt;
      if (this.trailT <= 0) {
        this.trailT = 0.04;
        const p = g.player.pos;
        g.particles.emit(p.x + (Math.random() - 0.5) * 0.6, p.y + 0.6 + Math.random() * 1.2, p.z + (Math.random() - 0.5) * 0.6, 0, 0.6, 0, 0.5, 0xff4a32, 0, 0.35, 0.1);
      }
      if (this.awakeT <= 0) g.hud.toast('Uyanış söndü');
      // Karakter değişir ya da dev formuna geçilirse uyanış biter.
      if (this.blood !== 'celik' || g.player.mode === 'titan') this.awakeT = 0;
    }
    for (let i = this.allies.length - 1; i >= 0; i--) {
      const a = this.allies[i];
      a.update(dt, g);
      if (a.gone) {
        g.scene.remove(a.body.root);
        this.allies.splice(i, 1);
      }
    }
  }

  /** Bütün dost dönüşümcüleri buharlaştırır (ölüm, yeniden başlama). */
  clear() {
    for (const a of this.allies) this.game.scene.remove(a.body.root);
    this.allies.length = 0;
    this.awakeT = 0;
  }
}
