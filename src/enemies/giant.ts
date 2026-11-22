import * as THREE from 'three';
import type { Game } from '../game';
import { CFG } from '../data/config';
import { angDiff, lerp, turnToward } from '../core/rng';
import { rollVoice, type IdleVoice } from '../core/audioMath';
import type { GiantSound } from '../core/audio';
import { DISTRICTS, wallBetween, wallPush } from '../world/layout';
import { trunkR } from '../world/world';
import type { Tree } from '../world/forest';
import { animateCollapse, newCollapse, type Collapse } from './collapse';
import { pickMelee } from './attacks';
import { autoBend, buildHumanoid, disposeHumanoid, type HairStyle, type Humanoid } from './humanoid';
import type { GiantType } from './giantTypes';
import type { Ability, TitanDef } from '../data/titans';

export type GiantState = 'wander' | 'chase' | 'windup' | 'recover' | 'stunned' | 'downed' | 'rising' | 'leap' | 'grab' | 'rush' | 'guard' | 'climb' | 'held' | 'dead';
/** Dev formundaki oyuncunun vuruşunun nitelikleri: yakın dövüş mü (gard yalnızca buna işler), gardı kırar mı, ne kadar iter. */
export interface TitanHitOpts {
  melee?: boolean;
  guardBreak?: boolean;
  push?: number;
}
export type NapeResult = 'kill' | 'hit' | 'blocked' | 'dull' | 'none';
export type LegResult = 'down' | 'hit' | 'dull' | 'none';
export type EyeResult = 'blind' | 'blocked' | 'dull' | 'none';

const v = new THREE.Vector3();
const LEAP_G = 30;
const OBSTACLES = { trees: true, buildings: true };
/** Ağzın başa göre yeri (dev ağzından çıkan duman için). */
const MOUTH = new THREE.Vector3(0, 0.042, 0.085);

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
  slowT = 0;
  marked = false;
  gone = false;
  home: THREE.Vector3 | null = null;
  /** Hikâye görevinin doğurduğu devlerin etiketi. */
  tag = '';
  /** Oyuncu uzaklaşsa da kaldırılmaz (bölüm sonu devleri). */
  persistent = false;
  private attackCd = 0;
  private leapCd = 2;
  private attackKind: 'swipe' | 'stomp' | 'grab' | 'throw' | 'bite' | 'kick' | 'smash' | 'charge' | 'boulder' | 'shard' | 'command' | 'power' = 'swipe';
  /** Canavar Dev'in yeniden kükremesine kalan süre. */
  private commandCd = 8;
  /** Canavar Dev'in buyruğu altında kalan süre: avına koşar, hızlanır, kolay vazgeçmez. */
  commandT = 0;
  private readonly handsV = new THREE.Vector3();
  /** Tırmanıcının sarıldığı dev ağaç. */
  private climbTree: Tree | null = null;
  /** Toslayanın yeniden toslamasına kalan süre. */
  private chargeCd = 3;
  /**
   * Baskın: devin yürüdüğü hedef ve varınca yıktığı yer. `siege` ise hedef surdur (yıkıcı).
   * Avı yakındaysa ona saldırır, uzaklaşınca hedefine döner.
   */
  raid: { x: number; z: number; r: number; siege: boolean; march?: boolean } | null = null;
  /** Sura toslayışı sürüyor: sura değdiği an gedik açılır. */
  breaching = false;
  /** Fırlatıldı: yere çarpınca devrilir. */
  private thrown = false;
  /** Gözleri kesildi: iyileşene dek kalan süre (sn). Körken avını yalnızca çok yakından sezer. */
  blindT = 0;
  readonly eyeRadius: number;
  /** Dev formundaki oyuncunun yumruğuna gard alma olasılığı, gardın süresi ve yeniden gard için bekleme. */
  private guardChance = 0;
  private guardDur = 0;
  private guardCd = 0;
  /** Türünün olağan boyundan iri doğdu. */
  readonly big: boolean = false;
  /** Düşman dönüşümcünün formu (sıradan devlerde null). */
  readonly form: TitanDef | null;
  /** Dönüşümcünün sıradaki gücü ve bekleme süresi. */
  private power: Ability | null = null;
  private powerCd = 5;
  private buffT = 0;
  private rushSpeed = 0;
  private rushTime = 0;
  private rushHit = false;
  /** Doğuş sahnesi: gövde buharın içinden büyür, sonra kükrer (dönüşümcüler). */
  private introT = 0;
  private smokeT = 0;
  private lookYaw = 0;
  /** Darbe alınca gövdenin bir an parlaması için kalan süre. */
  private flashT = 0;
  private screamed = false;
  private screamT = 0;
  /** Yakalanan oyuncuyu ağza götürme süresi (sn). */
  readonly eatTime: number;
  private readonly grabChance: number;
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
  private lying = false;
  /** Bu devin kendine özgü sesi ve bir sonraki ses çıkarışına kalan süre. */
  readonly voice: IdleVoice = rollVoice(Math.random(), Math.random());
  private talkT = 1 + Math.random() * 8;
  private stepNo = 0;
  private impacted = false;
  private fallDir: 1 | -1 = 1;
  private fall: Collapse = newCollapse(1);
  private napeCuts: number;
  private legCuts: number;
  private avoidLen = 1.2;
  private sinceAvoid = 99;

  constructor(
    readonly type: GiantType,
    x: number,
    z: number,
    private readonly game: Game,
    form: TitanDef | null = null,
  ) {
    const r = Math.random;
    const P = CFG.giantPower;
    this.form = form;
    let h = lerp(type.minH, type.maxH, r() * r() * 0.6 + r() * 0.4);
    if (type.kind === 'boss' || form) h = type.maxH;
    // Küçük türler (tırmanıcı, sürü) iri doğmaz.
    else if (!type.crawl && !type.climber && !type.pack && r() < P.bigChance) {
      h *= lerp(P.big[0], P.big[1], r());
      this.big = true;
    }
    this.h = h;
    if (form) {
      // Dönüşümcü: oyuncunun girebildiği formun gövdesi; ensesi işaretli.
      this.body = buildHumanoid(this.h, { ...form.palette, nape: 0xc2372f }, form.opts);
      this.introT = 2.8;
    } else {
      // Ten rengi her devde biraz farklı; bazıları şişman, bazıları sıska; kol boyu da değişir.
      const skin = new THREE.Color(type.skins[Math.floor(r() * type.skins.length)]).offsetHSL((r() - 0.5) * 0.03, (r() - 0.5) * 0.12, (r() - 0.5) * 0.08).getHex();
      const hairRoll = r();
      const hairStyle: HairStyle = type.plating || type.fur || hairRoll < 0.3 ? 'none' : hairRoll < 0.75 ? 'short' : 'long';
      const hairColors = [0x2a2220, 0x4a3524, 0x6b5a48, 0x8a8478];
      const fat = !type.armored && type.kind !== 'runner' && r() < 0.28;
      this.body = buildHumanoid(
        this.h,
        {
          skin,
          top: skin,
          legs: skin,
          hair: hairStyle === 'none' ? undefined : hairColors[Math.floor(r() * hairColors.length)],
          hairStyle,
          nape: 0xc2372f,
          eye: 0x1a1210,
        },
        {
          style: 'giant',
          outline: 0.0028,
          bulk: lerp(type.bulk[0], type.bulk[1], r()) * (fat ? 1.12 : 1),
          head: lerp(type.head[0], type.head[1], r()),
          arm: type.arm * lerp(0.92, 1.14, r()),
          // Plaka zırhlı dev, sıradan zırh plakaları yerine baştan aşağı metal giyer.
          armor: type.armored && !type.plating,
          plating: type.plating,
          fur: type.fur,
          horns: type.horns,
          face: type.screamer ? 1 : Math.floor(r() * 4),
          belly: fat ? 0.4 + r() * 0.6 : 0,
        },
      );
    }
    this.pos = this.body.root.position;
    this.pos.set(x, game.world.heightAt(x, z), z);
    this.yaw = r() * 6.28;
    this.radius = this.h * 0.14;
    this.napeRadius = this.h * 0.05 + 0.45;
    this.legRadius = this.h * 0.08 + 0.6;
    this.eyeRadius = this.h * 0.03 + 0.5;
    this.maxHp = (type.hpBase + type.hpPerM * this.h) * (form ? 1 : P.hp) * (this.big ? 1.6 : 1);
    this.hp = this.maxHp;
    this.legCuts = type.legCuts;
    this.napeCuts = type.napeCuts;
    this.eatTime = CFG.grab.eatBase + CFG.grab.eatPerM * this.h;
    // Büyük devler daha sık yakalar; bölüm sonu devi yakalamaz.
    this.grabChance = type.kind === 'boss' || form || type.crawl || this.h < CFG.grab.minHeight ? 0 : Math.min(0.85, 0.3 + (this.h - CFG.grab.minHeight) * 0.07);
    // Gard: sürünenler alamaz; ağır devler ve zırhlılar sık, çevikler seyrek alır.
    const GG = CFG.giantGuard;
    const k = type.kind;
    this.guardChance = type.crawl ? 0 : this.heavy ? GG.heavy : type.armored ? GG.armored : k === 'runner' || k === 'leaper' || k === 'screamer' || k === 'pack' || k === 'climber' ? GG.fast : GG.normal;
    if (this.big && this.guardChance > 0) this.guardChance += 0.1;
    this.body.root.traverse((o) => (o.userData.giant = this));
    game.scene.add(this.body.root);
  }

  /** Yönü kilitli, hızlı bir koşuyla (x, z)'ye toslar; sura değerse gedik açar. */
  charge(x: number, z: number, speed: number) {
    const d = Math.hypot(x - this.pos.x, z - this.pos.z);
    this.yaw = Math.atan2(x - this.pos.x, z - this.pos.z);
    this.rushSpeed = speed;
    this.rushTime = d / speed + 1.5;
    this.rushHit = false;
    this.breaching = true;
    this.raid = null;
    this.setState('rush');
  }

  /** Dev formundaki oyuncu önünde yumruk savurdu: dev belli bir olasılıkla gardını alır. */
  threat(game: Game) {
    if (!this.alive || this.guardCd > 0 || this.guardChance <= 0 || game.player.mode !== 'titan') return;
    if (this.state !== 'chase' && this.state !== 'recover') return;
    this.guardCd = 0.6; // aynı seride her yumrukta yeniden zar atılmasın
    if (Math.random() >= this.guardChance) return;
    const G = CFG.giantGuard;
    this.guardDur = G.dur[0] + Math.random() * (G.dur[1] - G.dur[0]);
    this.guardCd = this.guardDur + G.cd[0] + Math.random() * (G.cd[1] - G.cd[0]);
    this.setState('guard');
  }

  /** Gardda mı ve darbe önden mi geliyor. */
  private guardsFrom(from: THREE.Vector3) {
    return this.state === 'guard' && Math.abs(angDiff(Math.atan2(from.x - this.pos.x, from.z - this.pos.z), this.yaw)) < 1.6;
  }

  get alive() {
    return this.state !== 'dead';
  }

  /** Dev formundaki oyuncu bu devi ağzına alabilir mi (bölüm sonu devleri ve dönüşümcüler alınamaz). */
  canBeHeld(maxH: number) {
    return this.alive && !this.heavy && this.h <= maxH && this.state !== 'leap' && this.state !== 'climb';
  }

  /** Oyuncunun dev formu bu devi ağzına aldı: dev çabalar ama kaçamaz. */
  hold() {
    if (this.state === 'grab') this.game.player.releaseGrab(this);
    this.game.boulders.drop(this);
    this.breaching = false;
    this.setState('held');
    this.body.root.rotation.order = 'YXZ';
  }

  /**
   * Ağızdaki devi yerleştirir: gövdesi yatay, beli `mouth` noktasında, ağız yönüne dik uzanır.
   * `yaw` taşıyanın baktığı yön.
   */
  heldAt(mouth: THREE.Vector3, yaw: number) {
    const r = this.body.root;
    this.yaw = yaw + Math.PI / 2;
    r.rotation.set(Math.PI / 2 - 0.15, this.yaw, Math.sin(this.stateT * 9) * 0.12);
    v.set(0, 1, 0).applyQuaternion(r.quaternion);
    this.pos.set(mouth.x - v.x * this.h * 0.5, mouth.y - v.y * this.h * 0.5, mouth.z - v.z * this.h * 0.5);
  }

  /** Ağızdan çıkar: gövde dikilir, ayakları yere iner. */
  private unhold(game: Game) {
    const r = this.body.root;
    r.rotation.set(0, this.yaw, 0);
    r.rotation.order = 'XYZ';
    this.pos.y = game.world.heightAt(this.pos.x, this.pos.z);
  }

  /** Ağızdaki dev fırlatılır: `yaw` yönünde savrulur, yere çarpınca devrilir. */
  fling(game: Game, yaw: number, speed: number) {
    if (this.state !== 'held') return;
    const r = this.body.root;
    // Gövde ağız hizasında dikilir, oradan savrulur.
    const y = this.pos.y + v.set(0, 1, 0).applyQuaternion(r.quaternion).y * this.h * 0.5 - this.h * 0.5;
    r.rotation.set(0, this.yaw, 0);
    r.rotation.order = 'XYZ';
    this.pos.y = Math.max(game.world.heightAt(this.pos.x, this.pos.z), y);
    this.vel.set(Math.sin(yaw) * speed, speed * 0.45, Math.cos(yaw) * speed);
    this.leapHit = true; // oyuncuya çarpmaz
    this.thrown = true;
    this.setState('leap');
  }
  get isElite() {
    return this.type.meter !== 'normal';
  }
  /** Bölüm sonu devi ya da dönüşümcü: sersemletme yarıya iner, darbeyle savrulmaz. */
  /** Sura karşı çarpışma yarıçapı: omuz ve kollarla birlikte gövdenin yarı genişliği. */
  get bodyR() {
    return this.radius * 1.75;
  }

  get heavy() {
    return this.type.kind === 'boss' || this.form !== null;
  }

  napeWorld(out: THREE.Vector3) {
    return this.body.nape.getWorldPosition(out);
  }
  footWorld(i: number, out: THREE.Vector3) {
    return (i === 0 ? this.body.footL : this.body.footR).getWorldPosition(out);
  }
  eyesWorld(out: THREE.Vector3) {
    return this.body.eyes.getWorldPosition(out);
  }
  /** (x, z) noktası devin yüzünün önünde mi (başının baktığı yöne göre). */
  faces(x: number, z: number) {
    const a = this.yaw + this.lookYaw;
    return Math.sin(a) * (x - this.pos.x) + Math.cos(a) * (z - this.pos.z) > 0;
  }
  /** Kör devin avını sezdiği uzaklık. */
  private get blindSense() {
    return CFG.eyes.sense + this.h * 0.3;
  }
  /** Ense zırhı şu an açık mı (zırhlı devler yalnızca yere düşünce vurulabilir). */
  get napeOpen() {
    return !this.type.armored || this.state === 'downed';
  }

  private setState(s: GiantState) {
    // Yakalama herhangi bir nedenle kesilirse (sersemleme, düşme, ölüm) oyuncu bırakılır.
    if (this.state === 'grab' && s !== 'grab') this.game.player.releaseGrab(this);
    // Kaldırdığı kaya, saldırısı kesilirse elinden düşer.
    if (this.state === 'windup' && s !== 'recover' && (this.attackKind === 'boulder' || this.attackKind === 'shard')) this.game.boulders.drop(this);
    // Ağaçtaki tırmanıcı sersemlerse ya da bacağı kesilirse tutunamaz, düşer.
    if (this.state === 'climb' && s !== 'climb' && s !== 'leap' && s !== 'dead') {
      this.vel.set(0, 0, 0);
      this.leapHit = true;
      s = 'leap';
    }
    this.state = s;
    this.stateT = 0;
  }

  /** Yakalanan oyuncunun ağza ne kadar yaklaştığı (0..1). */
  get grabProgress() {
    return this.state === 'grab' ? Math.min(1, this.stateT / this.eatTime) : 0;
  }
  /** Oyuncunun tutulduğu el konumu. */
  handWorld(out: THREE.Vector3) {
    return this.body.handR.getWorldPosition(out);
  }

  /** İki elin ortası (kaldırılan kayanın yeri). */
  handsWorld() {
    this.body.handL.getWorldPosition(this.handsV);
    this.body.handR.getWorldPosition(v);
    return this.handsV.add(v).multiplyScalar(0.5);
  }

  /** Canavar Dev'in buyruğu: `t` saniye avına koşar. */
  command(t: number) {
    if (!this.alive || this.heavy) return;
    this.commandT = t;
    if (this.state === 'wander' || this.state === 'guard') this.setState('chase');
  }

  /** Yerdeyken mi öldürüldü (ölüm efekti buna göre değişir). */
  get wasLying() {
    return this.lying;
  }

  /** Devin sesini bulunduğu yerden çalar. */
  private say(kind: GiantSound, loud = 1) {
    this.game.audio.giant(kind, this.h, this.pos.x, this.pos.z, loud);
    this.talkT = Math.max(this.talkT, 2.5);
  }

  /** Çığlıkla çağrılan dev avına yönelir. */
  alert() {
    if (this.state === 'wander') this.setState('chase');
  }

  /** Darbe aldı: gövde bir an parlar. */
  private flash(dur = 0.14) {
    this.flashT = dur;
  }

  private tickFlash(dt: number) {
    if (this.flashT <= 0) return;
    this.flashT -= dt;
    const e = this.flashT > 0 ? Math.min(0.38, this.flashT * 4) : 0;
    for (const m of this.body.mats) {
      if (m instanceof THREE.MeshToonMaterial || m instanceof THREE.MeshStandardMaterial) m.emissive.setScalar(e);
    }
  }

  stun(seconds: number) {
    if (!this.alive || this.state === 'downed' || this.state === 'held') return;
    this.stunDur = seconds;
    this.setState('stunned');
  }

  /**
   * Enseye kılıç darbesi. Keskin kılıçla tek temiz kesik devi öldürür
   * (bölüm sonu devi birkaç kesik ister). Zırhlı devin ensesi yalnızca
   * yerdeyken ya da zırh delen bir darbeyle kesilir.
   */
  hitNape(game: Game, bladeOk: boolean, armorBreak = false): NapeResult {
    if (!this.alive) return 'none';
    if (!this.napeOpen && !armorBreak) return 'blocked';
    if (!bladeOk) {
      if (this.state !== 'downed') this.stun(0.5);
      return 'dull';
    }
    this.flash();
    this.napeCuts -= armorBreak ? 2 : 1;
    if (this.napeCuts <= 0) {
      this.die(game, 'blade');
      return 'kill';
    }
    this.hp = Math.min(this.hp, (this.maxHp * this.napeCuts) / this.type.napeCuts);
    return 'hit';
  }

  /**
   * Gözlere kılıç darbesi: dev bir süre kör kalır ve sersemler (elindeki av da kurtulur).
   * Zırhlı devlerin yüzü kapalıdır; kör dev yeniden kör edilemez.
   */
  hitEyes(bladeOk: boolean): EyeResult {
    if (!this.alive || this.blindT > 0) return 'none';
    if (this.type.armored) return 'blocked';
    if (!bladeOk) return 'dull';
    const E = CFG.eyes;
    const k = this.heavy ? E.heavy : 1;
    this.flash();
    this.blindT = E.blind * k;
    this.body.eyeWound.visible = true;
    this.say('pain', 1.4);
    if (this.state !== 'downed' && this.state !== 'leap') this.stun(E.stun * k);
    return 'blind';
  }

  /** Bacağa kılıç darbesi: yeterli kesik devi yere düşürür. */
  hitLeg(bladeOk: boolean, armorBreak = false): LegResult {
    if (!this.alive || this.state === 'downed' || this.state === 'leap' || this.state === 'held') return 'none';
    if (!bladeOk && !armorBreak) return 'dull';
    this.flash();
    this.legCuts -= armorBreak ? 99 : 1;
    if (this.legCuts <= 0) {
      this.setState('downed');
      this.say('pain', 1.3);
      return 'down';
    }
    return 'hit';
  }

  /**
   * Dev formundaki oyuncunun yumruğu/ezmesi. Gardlı dev önden gelen yakın dövüş darbesinin çoğunu engeller ('blocked');
   * tekme ya da seri bitirici gardı kırar ve devi sersemletir.
   */
  titanHit(dmg: number, game: Game, armorBreak: boolean, from: THREE.Vector3, quiet = false, hit: TitanHitOpts = {}): 'hit' | 'blocked' | 'none' {
    if (!this.alive) return 'none';
    if (this.state === 'held') {
      // Ağızdaki dev kaçamaz, savrulmaz: yalnızca can kaybeder.
      this.flash(0.12);
      this.hp -= dmg * (this.type.armored && !armorBreak ? 0.2 : 1);
      if (this.hp <= 0) this.die(game, 'titan', from);
      return 'hit';
    }
    let d = dmg;
    let broke = false;
    if (hit.melee && this.guardsFrom(from)) {
      if (hit.guardBreak) {
        broke = true;
        this.guardCd = 3;
        game.audio.block();
        game.hud.callout('GARD KIRILDI');
      } else {
        // Taş yumruk gardı kısmen deler.
        d *= 1 - CFG.giantGuard.block * (armorBreak ? 0.6 : 1);
        this.flash(0.08);
        this.hp -= d;
        game.audio.block();
        this.chestWorld(v, from);
        game.particles.burst(v, 14, 8 + this.h * 0.4, 0.45, 0xfff0d0, this.h * 0.05);
        game.smoke.burst(v, 4, 4, 1.1, 0x9a948a, this.h * 0.05, 2, 1.5 + this.h * 0.12, 1.2);
        if (!this.heavy) this.shove(from, 1);
        if (this.hp <= 0) this.die(game, 'titan', from);
        return 'blocked';
      }
    }
    if (this.type.armored && !armorBreak && this.state !== 'downed') {
      d *= 0.2;
      if (!quiet) game.audio.clang();
    }
    this.flash(0.18);
    this.hp -= d;
    if (this.hp <= 0) {
      this.die(game, 'titan', from);
      return 'hit';
    }
    if (this.heavy) {
      if (armorBreak) this.hitLeg(true, true);
      if (hit.push) this.shove(from, hit.push * 0.35);
      if (broke && this.state !== 'downed') this.stun(1.2);
    } else {
      this.shove(from, hit.push ?? 3);
      if (this.state !== 'downed') this.stun(broke ? 2 : 1);
    }
    return 'hit';
  }

  /** Vuranın tersine doğru iter. */
  private shove(from: THREE.Vector3, m: number) {
    const dx = this.pos.x - from.x;
    const dz = this.pos.z - from.z;
    const l = Math.hypot(dx, dz) || 1;
    this.pos.x += (dx / l) * m;
    this.pos.z += (dz / l) * m;
  }

  /** Göğsün, vurana bakan yüzeyindeki nokta (engel kıvılcımları için). */
  private chestWorld(out: THREE.Vector3, from: THREE.Vector3) {
    const dx = from.x - this.pos.x;
    const dz = from.z - this.pos.z;
    const l = Math.hypot(dx, dz) || 1;
    return out.set(this.pos.x + (dx / l) * this.radius * 1.3, this.pos.y + this.h * 0.72, this.pos.z + (dz / l) * this.radius * 1.3);
  }

  private die(game: Game, source: 'blade' | 'titan', from?: THREE.Vector3) {
    // Zaten yerdeyse devrilmez; ayaktaysa önce sendeler, sonra kütük gibi devrilir.
    // Sürünen devler zaten yere yakındır: devrilmez, olduğu yerde yığılır.
    if (this.state === 'held') this.unhold(game);
    this.lying = this.state === 'downed' || this.state === 'held' || !!this.type.crawl;
    this.impacted = false;
    this.say(this.lying ? 'rattle' : 'death', this.heavy ? 2.5 : 1.4);
    this.fallDir = 1;
    if (from && !this.lying) {
      // Önden gelen dev yumruğu sırtüstü devirir.
      const front = Math.sin(this.yaw) * (from.x - this.pos.x) + Math.cos(this.yaw) * (from.z - this.pos.z);
      if (front > 0) this.fallDir = -1;
    }
    this.fall = newCollapse(this.fallDir);
    this.setState('dead');
    for (const m of this.body.mats) m.transparent = true;
    this.napeWorld(v);
    if (source === 'blade') game.particles.burst(v, 36, this.h * 0.9 + 6, 0.9, 0xc8322a, this.h * 0.08);
    game.particles.burst(v, 50, this.h * 1.2, 2.2, 0xdddddd, this.h * 0.2, 6);
    game.onGiantKilled(this, source);
  }

  private reach(titan: boolean) {
    return this.h * 0.45 * (this.type.reach ?? 1) + 1.5 + (titan ? this.game.player.titan.def.radius + 1.5 : 0);
  }

  /** Saldırının vuruş anı. Oyuncu yakalandıysa true döner (dev 'grab' durumuna geçmiştir). */
  private strike(game: Game) {
    const p = game.player;
    if (p.dead) return false;
    // Kör devin savurduğu darbe çoğu kez boşa gider.
    if (this.blindT > 0 && (this.attackKind === 'swipe' || this.attackKind === 'stomp') && Math.random() < CFG.eyes.miss) return false;
    const dx = p.pos.x - this.pos.x;
    const dz = p.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const dy = p.pos.y - this.pos.y;
    const titan = p.mode === 'titan';
    const dmg = (this.type.dmg + this.h * 1.2) * CFG.giantPower.dmg * (this.buffT > 0 ? 1.6 : 1);
    if (this.attackKind === 'power') return this.castPower(game, dmg, dist, dx, dz, titan);
    if (this.attackKind === 'throw') {
      // Kaya, oyuncunun birazdan olacağı yere atılır; düşeceği yer halkayla işaretlenir.
      this.handWorld(v);
      v.y += this.h * 0.2;
      const lead = Math.min(1.3, dist / 60);
      game.boulders.throw(v, p.pos.x + p.vel.x * lead * 0.7, p.pos.z + p.vel.z * lead * 0.7, dmg * 0.8, game);
      game.audio.swing();
      this.attackCd = 3.6;
      return false;
    }
    if (this.attackKind === 'grab') {
      if (dist < this.reach(titan) * 1.15 && dy < this.h * 1.2 && p.canBeGrabbed() && !wallBetween(this.pos.x, this.pos.z, p.pos.x, p.pos.z, p.pos.y + 1)) {
        p.grab(this);
        this.setState('grab');
        return true;
      }
      return false;
    }
    if (this.attackKind === 'bite') {
      // Isırık: av hâlâ önünde ve ağzının yetişeceği yerdeyse dişler geçer; değilse çene boşa kapanır.
      const front = dist > 0.01 ? (dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw)) / dist : 1;
      const hit = dist < this.reach(titan) * 1.1 && front > 0.35 && (titan || dy < this.h * 0.6);
      this.body.head.getWorldPosition(v);
      if (hit) {
        if (titan) v.set(p.pos.x, Math.min(v.y, p.pos.y + p.titan.def.height * 0.7), p.pos.z);
        else v.set(p.pos.x, p.pos.y + 1, p.pos.z);
        game.biteFx(v, this.yaw, Math.min(5, 1.2 + this.h * 0.12), 0xfff2e2);
        p.takeHit(dmg * CFG.bite.dmgMult, this.pos, CFG.bite.knock);
      } else if (dist < 90) {
        game.audio.bite(0.5);
      }
      return false;
    }
    if (this.attackKind === 'boulder') {
      // Dev kaya: avının birazdan olacağı yere, yüksek bir yayla.
      game.boulders.drop(this);
      const lead = Math.min(2.2, dist / 50);
      game.boulders.throw(this.handsWorld(), p.pos.x + p.vel.x * lead * 0.7, p.pos.z + p.vel.z * lead * 0.7, dmg * 0.8, game, 2.4);
      game.audio.swing();
      this.attackCd = 4 + Math.random() * 2;
      return false;
    }
    if (this.attackKind === 'shard') {
      // Avucunda ezdiği kayanın parçalarını avının çevresine saçar.
      game.boulders.drop(this);
      const at = this.handsWorld();
      game.particles.burst(at, 40, 14, 0.8, 0xa39a86, this.h * 0.05);
      game.audio.stomp(0.7);
      game.audio.swing();
      game.boulders.spray(at, p.pos.x + p.vel.x * 0.6, p.pos.z + p.vel.z * 0.6, 26, 16, dmg * 0.13, game);
      this.attackCd = 4.5 + Math.random() * 2;
      return false;
    }
    if (this.attackKind === 'command') {
      this.commandCd = 26 + Math.random() * 8;
      game.onCommand(this);
      return false;
    }
    if (this.attackKind === 'charge') {
      // Tos: avının olduğu yere doğru, yönü kilitli hızlı koşu; yolundakini savurur, ağaca çarparsa sersemler.
      this.chargeCd = 7 + Math.random() * 3;
      this.rushSpeed = 28 + this.h;
      this.rushTime = Math.min(2.6, dist / this.rushSpeed + 0.5);
      this.rushHit = false;
      this.yaw = Math.atan2(dx, dz);
      game.audio.stomp(0.7);
      this.setState('rush');
      return true;
    }
    if (this.attackKind === 'smash') {
      // Baskın: köydeki evleri ya da suru yumruklar; oyuncu dibindeyse o da nasibini alır.
      game.raid.smash(this);
      this.attackCd = this.raid?.siege ? 1.3 : 1.8;
      if (dist < this.reach(titan) * 0.9 && dy < this.h) p.takeHit(dmg * 0.8, this.pos, 16);
      return false;
    }
    if (this.attackKind === 'kick') {
      // Tekme: önündeki ava bacağıyla uzanır; yerdekini fırlatır, gardı kısmen deler.
      const K = CFG.giantKick;
      const front = dist > 0.01 ? (dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw)) / dist : 1;
      if (dist < 140) game.audio.kick();
      v.set(this.pos.x + Math.sin(this.yaw) * this.h * 0.35, this.pos.y + 0.5, this.pos.z + Math.cos(this.yaw) * this.h * 0.35);
      game.smoke.burst(v, 4, 5, 1, 0xa39a86, this.h * 0.08, 1.5, 1.5 + this.h * 0.12, 1.3);
      if (front > 0.3 && dist < this.reach(titan) * 1.3 && (titan || dy < this.h * 0.45)) {
        p.takeHit(dmg * K.dmg, this.pos, K.knock, K.pierce);
        game.shakeCam(Math.max(0.3, 0.9 - dist / 80));
      }
      return false;
    }
    if (this.attackKind === 'stomp') {
      game.audio.stomp();
      game.shakeCam(Math.max(0, 1.2 - dist / 120));
      game.rings.spawn(this.pos.x, this.pos.y, this.pos.z, this.h * 0.7 + 6, 0xe0d4b8, 0.6);
      for (let i = 0; i < 40; i++) {
        const a = Math.random() * 6.28;
        game.particles.emit(this.pos.x + Math.sin(a) * 6, this.pos.y + 0.5, this.pos.z + Math.cos(a) * 6, Math.sin(a) * 22, 4, Math.cos(a) * 22, 1.2, 0x9a8f7a);
      }
      if (dist < this.h * 0.55 + (titan ? 4 : 0) && (titan || dy < 4)) p.takeHit(dmg * 1.2, this.pos, 18);
    } else if (dist < this.reach(titan) * 1.15 && dy < this.h * 1.2) {
      p.takeHit(dmg, this.pos, 12);
    }
    return false;
  }

  update(dt: number, game: Game) {
    const b = this.body;
    this.stateT += dt;
    this.tickFlash(dt);
    if (this.state === 'dead') {
      this.animateDeath(dt, game);
      return;
    }

    if (this.state === 'held') {
      // Ağızda: çabalar (bacakları tepinir); yerini taşıyan belirler.
      this.phase += dt * 9;
      this.animate(dt, 0, 0);
      return;
    }
    const p = game.player;
    if (this.slowT > 0) {
      this.slowT -= dt;
      if (this.slowT <= 0) this.marked = false;
    }
    if (this.attackCd > 0) this.attackCd -= dt;
    if (this.leapCd > 0) this.leapCd -= dt;
    if (this.guardCd > 0) this.guardCd -= dt;
    if (this.chargeCd > 0) this.chargeCd -= dt;
    if (this.commandCd > 0) this.commandCd -= dt;
    if (this.blindT > 0) {
      this.blindT -= dt;
      // Kesik gözlerden buhar tüter; iyileşince yara kaybolur.
      if (Math.random() < 0.35) {
        this.eyesWorld(v);
        game.particles.emit(v.x, v.y, v.z, (Math.random() - 0.5) * 1.5, 2.5 + this.h * 0.05, (Math.random() - 0.5) * 1.5, 0.9, 0xf0ece4, 0, 0.6 + this.h * 0.05, 0.25);
      }
      if (this.blindT <= 0) this.body.eyeWound.visible = false;
    }
    if (this.commandT > 0) {
      this.commandT -= dt;
      // Buyruk altındaki devin başının üstünde kızıl kıvılcımlar.
      if (Math.random() < 0.25) game.particles.emit(this.pos.x, this.pos.y + this.h * 1.02, this.pos.z, (Math.random() - 0.5) * 2, 2, (Math.random() - 0.5) * 2, 0.7, 0xff3b2f, 0, 0.9 + this.h * 0.05, 0.3);
    }
    if (this.form) {
      if (this.powerCd > 0) this.powerCd -= dt;
      if (this.buffT > 0) {
        this.buffT -= dt;
        this.body.armMat.emissive.setHex(this.buffT > 0 ? 0x2a4458 : 0x000000);
      }
      if (!this.type.sprinter) this.mouthSmoke(dt, game); // Kız Dev'in yüzü dumanla örtülmesin
      if (this.introT > 0) {
        this.intro(dt, game);
        return;
      }
    }
    // Arada bir kendi sesini çıkarır; kovalarken daha sık.
    this.talkT -= dt;
    if (this.talkT <= 0) {
      const busy = this.state === 'chase';
      this.talkT = (busy ? 3 : 5) + Math.random() * (busy ? 4 : 8);
      if (this.state === 'downed') this.say('pain', 0.7);
      else if (this.state === 'wander' || busy) this.say(this.voice);
    }

    const dx = p.pos.x - this.pos.x;
    const dz = p.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const dy = p.pos.y - this.pos.y;
    const titan = p.mode === 'titan';
    // Başka bir devin elindeki oyuncuya saldırılmaz.
    const targetable = !p.dead && !p.inTown && !game.cocoon.active && (p.grabbedBy === null || p.grabbedBy === this);
    const slow = this.slowT > 0 ? 0.45 : 1;
    const speed = this.type.speed * (0.8 + this.h / 40) * CFG.giantPace.walk * slow * (this.commandT > 0 ? 1.3 : 1);
    const commanded = this.commandT > 0 && dist < 700;
    const blind = this.blindT > 0;
    let move = 0;
    let moveYaw = this.yaw;
    this.moving = false;

    switch (this.state) {
      case 'wander': {
        if (this.raid) {
          // Baskın: hedefe yürür, varınca yumruklarıyla yıkar; ancak yakınına gelen avı fark eder.
          const R = this.raid;
          const gx = R.x - this.pos.x;
          const gz = R.z - this.pos.z;
          moveYaw = Math.atan2(gx, gz);
          if (Math.hypot(gx, gz) > R.r) move = speed * (R.siege ? 1 : 1.35);
          else if (this.attackCd <= 0 && !R.march) {
            this.attackKind = 'smash';
            this.setState('windup');
            this.say('grunt', R.siege ? 3 : 1.2);
            break;
          }
          if (targetable && dist < (blind ? this.blindSense : this.type.aggro * 0.45 * p.sightMult)) {
            this.setState('chase');
            this.say(this.type.kind === 'boss' ? 'growl' : this.voice, this.type.kind === 'boss' ? 2.5 : 1.2);
          }
          break;
        }
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
        // Kapşon giyen oyuncu ancak daha yakından fark edilir.
        // Kör dev avını ancak dibindeyken sezer.
        const sight = blind ? this.blindSense : this.type.aggro * p.sightMult;
        const aggro = this.home && !blind ? Math.hypot(p.pos.x - this.home.x, p.pos.z - this.home.z) < sight : dist < sight;
        if (targetable && (aggro || commanded)) {
          this.setState('chase');
          // Avını fark etti: hızlı türler çığlık atar, diğerleri kendi sesiyle seslenir.
          if (this.type.screamer && !this.screamed && dist < 170 * p.sightMult) {
            this.screamed = true;
            this.screamT = 1.7;
            this.say('shriek', 3.5);
            game.onScream(this);
          } else if (this.type.kind === 'runner' || this.type.kind === 'leaper' || this.type.crawl) this.say('shriek', 1.2);
          else this.say(this.type.kind === 'boss' ? 'growl' : this.voice, this.type.kind === 'boss' ? 2.5 : 1.2);
        }
        break;
      }
      case 'chase': {
        const leashed = this.home !== null && Math.hypot(p.pos.x - this.home.x, p.pos.z - this.home.z) > this.type.aggro * 1.3;
        // Baskındaki dev uzaklaşan avın peşine düşmez, hedefine döner.
        const raidBack = this.raid !== null && dist > this.type.aggro * 0.6;
        if (!targetable || (!commanded && (dist > this.type.aggro * 1.7 * p.sightMult || leashed || raidBack))) {
          this.setState('wander');
          break;
        }
        moveYaw = Math.atan2(dx, dz);
        const reach = this.reach(titan);
        if (blind) {
          // Kör: avını uzaklaşınca kaybeder; yakındaysa el yordamıyla, sendeleyerek ona yönelir ve savurur.
          if (dist > this.blindSense * 2.2 && !commanded) {
            this.setState('wander');
            break;
          }
          moveYaw += Math.sin(this.stateT * 1.7 + this.phase) * 0.7;
          if (dist > reach * 0.7) move = speed * 0.55;
          if (dist < reach && dy < this.h * 1.2 && this.attackCd <= 0) {
            this.attackKind = this.heavy ? 'stomp' : 'swipe';
            this.setState('windup');
            this.say('grunt');
          }
          break;
        }
        if (this.screamT > 0) {
          this.screamT -= dt; // çığlık atarken olduğu yerde durur
          break;
        }
        // Canavar Dev: yakınında dev varsa kükreyip onları avına salar; uzaktan kaya atar ya da kaya ezip parça saçar.
        if (this.type.shepherd) {
          if (this.commandCd <= 0 && game.giants.some((o) => o !== this && o.alive && !o.heavy && Math.hypot(o.pos.x - this.pos.x, o.pos.z - this.pos.z) < 320)) {
            this.attackKind = 'command';
            this.setState('windup');
            this.say('growl', 3);
            break;
          }
          if (dist > 45 && dist < 280) {
            if (this.attackCd <= 0) {
              const big = Math.random() < 0.55;
              this.attackKind = big ? 'boulder' : 'shard';
              game.boulders.grip(this, big ? 2.4 : 1.3, () => this.handsWorld());
              this.setState('windup');
              this.say('grunt', 2);
            }
            break; // menzildeyken yerinde durup atar
          }
        }
        // Tırmanıcı: avı bir dev ağacın dalındaysa ya da yapraklarının üstündeyse gövdeye koşar ve tırmanır.
        if (this.type.climber && dy > this.h * 0.9 && p.mode === 'foot') {
          const tree = game.world.giantTreeNear(p.pos.x, p.pos.z, 45);
          if (tree) {
            const ax = this.pos.x - tree.x;
            const az = this.pos.z - tree.z;
            const al = Math.hypot(ax, az) || 1;
            const R = trunkR(tree, this.pos.y) + this.radius + 0.4;
            const tx = tree.x + (ax / al) * R;
            const tz = tree.z + (az / al) * R;
            moveYaw = Math.atan2(tx - this.pos.x, tz - this.pos.z);
            if (Math.hypot(tx - this.pos.x, tz - this.pos.z) < 3) {
              this.climbTree = tree;
              this.setState('climb');
              this.say('shriek', 1.2);
            } else move = speed * CFG.giantPace.chase;
            break;
          }
        }
        // Toslayan: uzaktaki avına başını eğip hızla koşar.
        if (this.type.charger && this.chargeCd <= 0 && this.attackCd <= 0 && dist > 25 && dist < 90 && dy < this.h * 0.6) {
          this.attackKind = 'charge';
          this.setState('windup');
          this.say('growl', 1.6);
          break;
        }
        // Dönüşümcü, formunun güçlerinden mesafeye uyanını kullanır.
        if (this.form && this.powerCd <= 0) {
          const ab = this.pickPower(dist);
          if (ab) {
            this.power = ab;
            this.attackKind = 'power';
            this.setState('windup');
            this.say('growl', 2);
            break;
          }
        }
        // Taşçı uzaktan atar: menzile girince durur, çok yaklaşılırsa yumrukla karşılar.
        const holds = this.type.thrower === true && dist > 36 && dist < 125;
        if (dist > reach * 0.7 && !holds) move = speed * CFG.giantPace.chase * (this.type.sprinter && p.mode === 'mounted' ? CFG.huntress.mountedChase : 1);
        if (holds && this.attackCd <= 0) {
          this.attackKind = 'throw';
          this.setState('windup');
          this.say('grunt');
        } else if (dist < reach && dy < this.h * 1.2 && this.attackCd <= 0) {
          if (this.heavy) this.attackKind = titan || dy < 8 ? (Math.random() < 0.35 ? 'kick' : 'stomp') : 'swipe';
          else this.attackKind = pickMelee({ crawl: !!this.type.crawl, titan, low: dy < this.h * 0.5, grabChance: this.grabChance, grabRoll: Math.random(), biteRoll: Math.random(), kickRoll: Math.random() });
          this.setState('windup');
          this.say(this.attackKind === 'bite' ? 'growl' : 'grunt');
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
        moveYaw = this.attackKind === 'smash' && this.raid ? Math.atan2(this.raid.x - this.pos.x, this.raid.z - this.pos.z) : Math.atan2(dx, dz);
        const wind = this.attackKind === 'power' ? (this.power?.kind === 'beam' ? 1.3 : 1.05) : this.attackKind === 'stomp' ? 1.2 : this.attackKind === 'throw' ? 1.05 : this.attackKind === 'grab' ? 0.9 : this.attackKind === 'bite' ? CFG.bite.windup : this.attackKind === 'kick' ? CFG.giantKick.windup : this.attackKind === 'smash' ? (this.raid?.siege ? 1.7 : 1.05) : this.attackKind === 'charge' ? 0.9 : this.attackKind === 'boulder' ? 1.8 : this.attackKind === 'shard' ? 1.4 : this.attackKind === 'command' ? 1.3 : 0.75;
        // Kaya ezerken avucundan toz ve kırıntı dökülür.
        if (this.attackKind === 'shard' && this.stateT > 0.8 && Math.random() < 0.4) game.particles.burst(this.handsWorld(), 3, 6, 0.6, 0xa39a86, this.h * 0.04);
        if (this.attackKind === 'power') this.telegraph(game);
        if (this.stateT > wind) {
          this.attackCd = this.heavy ? 2.4 : 1.5;
          if (!this.strike(game)) this.setState('recover');
        }
        break;
      }
      case 'guard': {
        // Gard: kollar yüzün önünde, avına dönük; yavaşça yaklaşır. Gardı indirince hemen karşılık verir.
        moveYaw = Math.atan2(dx, dz);
        if (dist > this.reach(titan) * 0.9) move = speed * 0.35;
        if (this.stateT > this.guardDur || !titan) {
          this.attackCd = 0;
          this.setState('chase');
        }
        break;
      }
      case 'climb': {
        // Tırmanış: gövdeye sarılı, avının olduğu yana doğru dolanarak yukarı çıkar; yetişince ona atılır.
        const t = this.climbTree;
        if (!t) {
          this.setState('leap');
          break;
        }
        const cur = Math.atan2(this.pos.x - t.x, this.pos.z - t.z);
        const ang = turnToward(cur, Math.atan2(p.pos.x - t.x, p.pos.z - t.z), 0.9 * dt);
        const R = trunkR(t, this.pos.y) + this.radius * 0.8;
        this.pos.x = t.x + Math.sin(ang) * R;
        this.pos.z = t.z + Math.cos(ang) * R;
        moveYaw = ang + Math.PI; // yüzü gövdeye dönük
        const targetY = Math.min(t.y + t.h * 0.86, p.pos.y - this.h * 0.35);
        if (this.pos.y < targetY) {
          this.pos.y = Math.min(targetY, this.pos.y + 8 * dt);
          this.phase += dt * 7;
          this.moving = true;
        }
        const ground = game.world.heightAt(p.pos.x, p.pos.z);
        const lost = p.dead || p.mode !== 'foot' || (p.onGround && p.pos.y - ground < 6) || Math.hypot(p.pos.x - t.x, p.pos.z - t.z) > 70 || this.stateT > 30;
        v.set(this.pos.x, this.pos.y + this.h * 0.6, this.pos.z);
        if (lost) {
          // Av indi ya da uzaklaştı: gövdeden bırakıp düşer.
          this.vel.set(-Math.sin(ang + Math.PI) * 3, 0, -Math.cos(ang + Math.PI) * 3);
          this.leapHit = true;
          this.setState('leap');
        } else if (this.pos.y >= targetY - 1 && v.distanceTo(p.pos) < 34 && this.leapCd <= 0) {
          const T = 0.65;
          this.vel.set((p.pos.x - this.pos.x) / T, (p.pos.y - this.h * 0.4 - this.pos.y) / T + 0.5 * LEAP_G * T, (p.pos.z - this.pos.z) / T);
          this.leapHit = false;
          this.leapCd = 3.5;
          this.say('shriek', 1.5);
          this.setState('leap');
        }
        break;
      }
      case 'rush': {
        // Atılım: yönü kilitli, hızla ileri savrulur; yolundaki avı çarpıp fırlatır.
        const step = this.rushSpeed * dt;
        this.pos.x += Math.sin(this.yaw) * step;
        this.pos.z += Math.cos(this.yaw) * step;
        this.phase += step / (this.h * 0.18);
        this.moving = true;
        // Ağaçlar ve binalar atılımı durdurur; toslayan çarpınca sersemler.
        if (this.type.kind !== 'boss' && game.world.resolve(this.pos, this.radius, OBSTACLES) && this.type.charger) {
          game.audio.stomp(0.9);
          game.shakeCam(Math.max(0, 0.6 - dist / 150));
          game.particles.burst(v.set(this.pos.x, this.pos.y + this.h * 0.75, this.pos.z), 20, 10, 0.8, 0x8a6a48, 2);
          this.stun(1.8);
          break;
        }
        if (!this.rushHit && !p.dead) {
          const reachR = this.radius + (titan ? p.titan.def.radius : 1.5) + 2;
          if (dist < reachR && dy < this.h) {
            this.rushHit = true;
            p.takeHit((this.type.dmg + this.h * 1.2) * CFG.giantPower.dmg * 0.9, this.pos, 30);
            game.shakeCam(0.8);
          }
        }
        if (Math.random() < 0.5) game.particles.emit(this.pos.x, this.pos.y + 1, this.pos.z, 0, 4, 0, 0.8, 0xa39a86);
        if (this.stateT > this.rushTime) {
          this.breaching = false;
          this.setState('recover');
        }
        break;
      }
      case 'grab': {
        if (p.grabbedBy !== this) {
          // Oyuncu kurtuldu ya da başka bir nedenle bırakıldı.
          this.attackCd = 2;
          this.setState('recover');
        } else if (this.stateT >= this.eatTime) {
          p.bitten(CFG.grab.biteBase + CFG.grab.bitePerM * this.h, this);
          this.attackCd = 2.5;
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
          this.legCuts = this.type.legCuts;
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
            p.takeHit((this.type.dmg + this.h) * CFG.giantPower.dmg, this.pos, 16);
          }
        }
        const gy = game.world.heightAt(this.pos.x, this.pos.z);
        if (this.pos.y <= gy && this.vel.y < 0) {
          this.pos.y = gy;
          game.audio.stomp();
          game.rings.spawn(this.pos.x, gy, this.pos.z, this.h * 0.6 + 4, 0xd8cdb4, 0.5);
          this.attackCd = 1;
          if (this.thrown) {
            // Fırlatılan dev yere çakılır ve devrilir: ensesi bir süre açıktır.
            this.thrown = false;
            game.shakeCam(Math.max(0, 0.7 - Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) / 120));
            game.smoke.burst(v.set(this.pos.x, gy + 1, this.pos.z), 10, 8, 1.6, 0xa39a86, this.h * 0.4, 1.5, 3 + this.h * 0.2, 1.4);
            this.hp -= this.maxHp * 0.15;
            if (this.hp <= 0) {
              this.die(game, 'titan', p.pos);
              break;
            }
            this.setState('downed');
            this.say('pain', 1.3);
          } else this.setState('recover');
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
      this.yaw = turnToward(this.yaw, moveYaw, this.type.turn * CFG.giantPace.turn * (this.avoidT > 0 ? 2.5 : 1) * dt);
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
        // Her yarım yürüyüş döngüsünde bir ayak yere basar.
        const stepNo = Math.floor(this.phase / Math.PI);
        if (stepNo !== this.stepNo) {
          this.stepNo = stepNo;
          if (dist < 40 + this.h * 5) game.audio.footstep(this.h, this.pos.x, this.pos.z);
        }
        this.moving = true;
      }
      if (this.state !== 'climb') this.pos.y = game.world.heightAt(this.pos.x, this.pos.z);
    }
    // Devler şehre ve Taç Suru kasabalarına giremez; surlardan yalnızca kapılardan geçer.
    const r = Math.hypot(this.pos.x, this.pos.z);
    const minR = CFG.world.walls[0].r + 40;
    if (r < minR && r > 0.01) {
      this.pos.x *= minR / r;
      this.pos.z *= minR / r;
    }
    for (let i = 0; i < 4; i++) {
      const d = DISTRICTS[i];
      const dx = this.pos.x - d.x;
      const dz = this.pos.z - d.z;
      const l = Math.hypot(dx, dz);
      const min = d.r + 40;
      if (l < min && l > 0.01) {
        this.pos.x = d.x + (dx / l) * min;
        this.pos.z = d.z + (dz / l) * min;
      }
    }
    // Gövde (omuzlar, kollar) merkezden geniştir: sura gömülmesin diye daha geniş itilir; kemere sığmayan kapıdan geçemez.
    if (this.state !== 'leap' && wallPush(this.pos, this.bodyR, 0, this.h) && this.breaching && this.state === 'rush') {
      // Toslayış sura ulaştı: gedik açılır, dev bir an sersemler.
      this.breaching = false;
      game.breaker.onImpact(this);
      this.stun(2.2);
    }
    b.root.rotation.y = this.yaw;
    // Baş avına döner: kovalarken ve saldırırken ona bakar.
    const hunting = this.state === 'chase' || this.state === 'windup' || this.state === 'recover' || this.state === 'guard';
    this.lookYaw = hunting && dist < 300 ? Math.max(-0.7, Math.min(0.7, angDiff(Math.atan2(dx, dz), this.yaw))) : Math.sin(this.phase * 0.21 + this.stateT * 0.4) * 0.35;
    this.animate(dt, dy, dist);
  }

  // ---------------------------------------------------------------- dönüşümcü
  /** Mesafeye uyan güçlerden birini seçer; uyan yoksa null (yürür ya da yumruklar). */
  private pickPower(dist: number): Ability | null {
    const f = this.form;
    if (!f) return null;
    const fits = [f.q, f.e].filter((ab) => {
      switch (ab.kind) {
        case 'stun':
          return dist < ab.radius * 0.6;
        case 'buff':
          return this.buffT <= 0 && dist < 90;
        case 'rush':
          return dist > 18 && dist < 120;
        case 'burst':
          return dist < ab.radius * 0.8 + 4;
        case 'beam':
          return dist > 15 && dist < ab.length * 0.9;
        case 'throw':
          return dist > 35 && dist < 200;
      }
      return false;
    });
    return fits.length ? fits[Math.floor(Math.random() * fits.length)] : null;
  }

  /** Gücün vuruş anı. Durum değiştiyse (atılım) true döner. */
  private castPower(game: Game, dmg: number, dist: number, dx: number, dz: number, titan: boolean) {
    const ab = this.power;
    const f = this.form;
    if (!ab || !f) return false;
    const p = game.player;
    this.powerCd = ab.cd * 1.6 + 3 + Math.random() * 3;
    const near = Math.max(0, 1 - dist / 260);
    const bodyR = titan ? p.titan.def.radius : 1;
    switch (ab.kind) {
      case 'stun': {
        // Kükreme: sarsıcı ses dalgası avı savurur, kancaları koparır.
        const r = ab.radius * 0.6;
        game.audio.roar();
        game.shakeCam(0.4 + near);
        game.rings.spawn(this.pos.x, this.pos.y, this.pos.z, r, f.color, 0.7);
        this.head(v);
        game.particles.burst(v, 40, 30, 0.8, f.color, 2);
        if (dist < r + bodyR) p.takeHit(dmg * 0.4, this.pos, 26);
        break;
      }
      case 'buff':
        // Taş deri: kollar sertleşir, bir süre daha ağır vurur.
        this.buffT = ab.dur;
        game.audio.clang();
        this.head(v);
        game.particles.burst(v, 30, 14, 0.8, 0xbfe0ff, this.h * 0.1);
        break;
      case 'rush':
        this.yaw = Math.atan2(dx, dz);
        this.rushSpeed = Math.max(40, ab.speed * 0.7);
        this.rushTime = Math.min(1.6, Math.max(0.4, dist / this.rushSpeed + 0.2));
        this.rushHit = false;
        game.audio.gas();
        game.audio.swing();
        this.setState('rush');
        return true;
      case 'burst': {
        const r = ab.radius * 0.8;
        game.audio.stomp();
        game.shakeCam(0.4 + near);
        game.rings.spawn(this.pos.x, this.pos.y, this.pos.z, r, f.color, 0.6);
        game.rings.spawn(this.pos.x, this.pos.y, this.pos.z, r * 0.6, 0xa39a86, 0.5);
        const n = Math.round(40 + r);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          game.particles.emit(this.pos.x, this.pos.y + 1, this.pos.z, Math.sin(a) * r * 1.1, 3, Math.cos(a) * r * 1.1, 1.1, f.color);
        }
        if (dist < r + bodyR && (titan || p.pos.y - this.pos.y < this.h * 0.6)) p.takeHit(dmg * 0.8, this.pos, 26);
        break;
      }
      case 'beam': {
        // Işın: ağızdan baktığı yöne uzun, dar bir hat.
        const yaw = this.yaw;
        const sx = Math.sin(yaw);
        const sz = Math.cos(yaw);
        this.head(v);
        const y = v.y;
        for (let i = 0; i < 90; i++) {
          const d = 3 + (i / 90) * ab.length;
          game.particles.emit(this.pos.x + sx * d, y - d * 0.04 + (Math.random() - 0.5) * 2, this.pos.z + sz * d, sx * 30, (Math.random() - 0.5) * 6, sz * 30, 0.5 + Math.random() * 0.4, i % 3 === 0 ? 0xffffff : f.color);
        }
        game.audio.beam();
        game.shakeCam(0.3 + near * 0.7);
        const along = dx * sx + dz * sz;
        const side = Math.abs(dx * sz - dz * sx);
        if (along > 0 && along < ab.length && side < ab.width / 2 + bodyR + 1) {
          p.takeHit(dmg, this.pos, 22);
          game.hud.flash('#ffffff', 0.2, 0.3);
        }
        break;
      }
      case 'throw': {
        this.handWorld(v);
        v.y += this.h * 0.2;
        const lead = Math.min(1.3, dist / 60);
        game.boulders.throw(v, p.pos.x + p.vel.x * lead * 0.7, p.pos.z + p.vel.z * lead * 0.7, dmg * 0.8, game);
        game.audio.swing();
        break;
      }
    }
    return false;
  }

  /** Güç hazırlanırken gövdeden formun renginde kıvılcımlar, ışında ağızda toplanan ışık. */
  private telegraph(game: Game) {
    const f = this.form;
    if (!f) return;
    if (this.power?.kind === 'beam') {
      this.mouth(v);
      game.particles.emit(v.x, v.y, v.z, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, 0.3, Math.random() < 0.5 ? 0xffffff : f.color, 0, 1.6);
    } else if (Math.random() < 0.6) {
      game.particles.emit(this.pos.x + (Math.random() - 0.5) * this.radius * 2, this.pos.y + Math.random() * this.h, this.pos.z + (Math.random() - 0.5) * this.radius * 2, 0, 6, 0, 0.6, f.color, 2);
    }
  }

  private head(out: THREE.Vector3) {
    return this.body.head.getWorldPosition(out);
  }
  private mouth(out: THREE.Vector3) {
    return this.body.head.localToWorld(out.copy(MOUTH));
  }

  /** Dönüşümcünün ağzından sızan duman (yakındaysa). */
  private mouthSmoke(dt: number, game: Game) {
    this.smokeT -= dt;
    if (this.smokeT > 0) return;
    this.smokeT = this.introT > 0 && this.introT < 1.8 ? 0.03 : 0.14;
    const p = game.player.pos;
    if (Math.hypot(p.x - this.pos.x, p.z - this.pos.z) > 260) return;
    this.mouth(v);
    const roar = this.introT > 0 && this.introT < 1.8;
    const sp = (roar ? 8 : 1.2) + this.h * (roar ? 0.8 : 0.12);
    const n = roar ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const k = 0.6 + Math.random() * 0.6;
      game.smoke.emit(v.x, v.y, v.z, Math.sin(this.yaw) * sp * k + (Math.random() - 0.5) * 2, sp * 0.25 * k + Math.random(), Math.cos(this.yaw) * sp * k + (Math.random() - 0.5) * 2, 1.4 + Math.random(), Math.random() < 0.4 ? 0xd2d0cc : 0xa9a6a1, 2 + this.h * 0.08, (0.6 + this.h * 0.06) * (roar ? 1.6 : 1), 2.4);
    }
  }

  /** Doğuş: yıldırımın düştüğü yerde gövde buharın içinden büyür, sonra yerinde kükrer. */
  private intro(dt: number, game: Game) {
    const before = this.introT;
    this.introT -= dt;
    const grow = Math.min(1, (2.8 - this.introT) / 1);
    const c = 1.9;
    const back = 1 + (c + 1) * Math.pow(grow - 1, 3) + c * Math.pow(grow - 1, 2);
    this.body.root.scale.setScalar(this.h * (0.06 + 0.94 * back));
    if (grow < 0.9 && Math.random() < 0.7) {
      const a = Math.random() * Math.PI * 2;
      const r = this.radius * (1.1 + Math.random());
      game.particles.emit(this.pos.x + Math.sin(a) * r, this.pos.y + Math.random() * this.h * 0.6, this.pos.z + Math.cos(a) * r, Math.sin(a) * 5, 4 + Math.random() * this.h * 0.4, Math.cos(a) * 5, 1.2, 0x6e6e6e, 5, 1 + this.h * 0.07, 1.6);
    }
    if (before > 1.8 && this.introT <= 1.8) {
      this.say('growl', 3);
      const p = game.player.pos;
      game.shakeCam(Math.max(0, 1 - Math.hypot(p.x - this.pos.x, p.z - this.pos.z) / 300));
      game.rings.spawn(this.pos.x, this.pos.y, this.pos.z, this.h * 2.4 + 20, 0xd8cdb4, 0.8);
    }
    this.pos.y = game.world.heightAt(this.pos.x, this.pos.z);
    const p = game.player.pos;
    this.yaw = turnToward(this.yaw, Math.atan2(p.x - this.pos.x, p.z - this.pos.z), 2 * dt);
    this.body.root.rotation.y = this.yaw;
    if (this.introT <= 0) {
      this.body.root.scale.setScalar(this.h);
      this.setState('chase');
    }
    this.animate(dt, 0, 999, this.introT < 1.8 ? 'roar' : 'rise');
  }

  /**
   * Ölüm: kısa bir sendeleme, hızlanarak devrilme, yere çarpış (sarsıntı ve toz),
   * ardından gövdenin buharlaşarak kaybolması.
   */
  private animateDeath(dt: number, game: Game) {
    const b = this.body;
    // Ağaçta ya da havada ölen dev önce yere düşer.
    const floor = game.world.heightAt(this.pos.x, this.pos.z);
    if (this.pos.y > floor) {
      this.vel.y -= LEAP_G * dt;
      this.pos.y = Math.max(floor, this.pos.y + this.vel.y * dt);
    }
    const t = this.stateT;
    const fd = this.fallDir;
    const k = 1 - Math.exp(-dt * 14);
    let since = t; // yere çarpıştan beri geçen süre
    if (this.lying) {
      let arms = 0;
      let legs = 0;
      let knees: number | undefined;
      let head = 0;
      // Yerde ölüm: gövde bir kez kasılıp yaylanır, kollar bacaklar çırpınır, sonra yığılır.
      const THROE = 0.75;
      const u = Math.min(1, t / THROE);
      const fade = 1 - u;
      const arch = Math.sin(u * Math.PI) * 0.42;
      b.tilt.rotation.x = lerp(b.tilt.rotation.x, Math.PI / 2 - arch, 1 - Math.exp(-dt * 22));
      head = -arch * 2 - 0.3 * fade;
      arms = -2.9 + Math.sin(t * 34) * 0.9 * fade + arch * 1.6;
      legs = Math.sin(t * 27) * 0.55 * fade;
      knees = 0.3 + Math.abs(Math.sin(t * 27)) * 0.7 * fade;
      since = t - THROE;
      if (u >= 1 && !this.impacted) {
        this.impacted = true;
        this.impact(game, 0.45);
      }
      // Açılan enseden buhar sütunu fışkırır.
      if (t < 1.6) {
        this.napeWorld(v);
        for (let i = 0; i < 3; i++) {
          game.particles.emit(v.x, v.y, v.z, (Math.random() - 0.5) * 5, 9 + Math.random() * (8 + this.h * 0.5), (Math.random() - 0.5) * 5, 1.4, i === 0 ? 0xff9a8a : 0xe4e4e4, 10);
        }
      }
      b.armL.rotation.x = lerp(b.armL.rotation.x, arms, k);
      b.armR.rotation.x = lerp(b.armR.rotation.x, arms, k);
      b.legL.rotation.x = lerp(b.legL.rotation.x, legs, k);
      b.legR.rotation.x = lerp(b.legR.rotation.x, -legs, k);
      b.head.rotation.x = lerp(b.head.rotation.x, head, k);
      b.jaw.rotation.x = lerp(b.jaw.rotation.x, 0.35, k);
      autoBend(b, k, { kneeL: knees, kneeR: knees, elbowL: -0.15, elbowR: -0.15 });
    } else {
      // Ayakta ölüm: sendeler, dizlerinin üstüne çöker, sonra gövdesi devrilir.
      const r = animateCollapse(b, t, dt, this.h, this.fall);
      since = r.since;
      if (r.kneeHit) this.impact(game, 0.4, 0.18);
      if (r.impactHit) {
        this.impacted = true;
        this.impact(game);
      }
    }

    // Buhar: önce enseden, yere serilince tüm gövdeden.
    this.steamT -= dt;
    if (this.steamT <= 0) {
      this.steamT = 0.05;
      if (since > 0) {
        const along = Math.random() * this.h * 0.9 * fd;
        game.particles.emit(
          this.pos.x + Math.sin(this.yaw) * along + (Math.random() - 0.5) * this.h * 0.25,
          this.pos.y + this.h * 0.08,
          this.pos.z + Math.cos(this.yaw) * along + (Math.random() - 0.5) * this.h * 0.25,
          0,
          2 + this.h * 0.15,
          0,
          2.2,
          0xc4c4c4,
          8,
        );
      } else {
        this.napeWorld(v);
        game.particles.emit(v.x, v.y, v.z, (Math.random() - 0.5) * 4, 3, (Math.random() - 0.5) * 4, 1.6, 0xd0d0d0, 9);
      }
    }
    // Yerde bir süre kalır, sonra buharlaşarak silinir.
    if (since > 2.2) {
      const o = Math.max(0, 1 - (since - 2.2) / 2.4);
      for (const m of b.mats) m.opacity = o;
    }
    if (since > 4.6) this.gone = true;
  }

  /** Devrilen gövdenin yere çarpışı. */
  private impact(game: Game, force = 1, span = 0.95) {
    const p = game.player.pos;
    const dist = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
    if (dist < 160) game.audio.stomp((this.h / 16) * force);
    game.shakeCam(Math.max(0, 1.1 - dist / 90) * Math.min(1.4, this.h / 9) * force);
    if (dist < 220) game.rings.spawn(this.pos.x + Math.sin(this.yaw) * this.h * span * 0.5 * this.fallDir, this.pos.y, this.pos.z + Math.cos(this.yaw) * this.h * span * 0.5 * this.fallDir, (this.h * 0.7 + 4) * (0.5 + force * 0.5), 0xd8cdb4, 0.55 + force * 0.25);
    const n = Math.round((30 + this.h * 2) * (0.5 + force * 0.5));
    for (let i = 0; i < n; i++) {
      const along = Math.random() * this.h * span * this.fallDir;
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = this.pos.x + Math.sin(this.yaw) * along;
      const z = this.pos.z + Math.cos(this.yaw) * along;
      const sp = 6 + Math.random() * (6 + this.h * 0.6);
      game.particles.emit(x, this.pos.y + 0.6, z, Math.cos(this.yaw) * side * sp, 2 + Math.random() * 3, -Math.sin(this.yaw) * side * sp, 1.3, 0xa39a86);
    }
  }

  private animate(dt: number, dy: number, dist: number, intro?: 'rise' | 'roar') {
    const b = this.body;
    let aL = 0;
    let aR = 0;
    let lL = 0;
    let lR = 0;
    let tiltX = 0;
    let headX = 0;
    let elbowR: number | undefined;
    let elbowL: number | undefined;
    let kneeR: number | undefined;
    let armInR = 0;
    let twistL = 0;
    let twistR = 0;
    let armZL = 0;
    let jawOpen = 0;
    let tiltRate = 6;
    let jawRate = 0;
    // Kovalarken adımlar daha geniş, kollar daha çok sallanır.
    const swing = this.moving ? Math.sin(this.phase) * (this.state === 'chase' ? 0.7 : 0.55) : 0;
    lL = swing;
    lR = -swing;
    aL = -swing * 0.5;
    aR = swing * 0.5;
    switch (this.state) {
      case 'chase':
        if (dy > this.h * 0.9 && dist < this.h) aL = aR = -2.7;
        else if (this.type.kind === 'runner' || this.type.sprinter) aL = aR = 0.9;
        else {
          aL -= 0.9;
          aR -= 0.9;
        }
        if (this.type.kind === 'runner' || this.type.kind === 'leaper' || this.type.sprinter) tiltX = 0.25;
        break;
      case 'windup':
        if (this.attackKind === 'stomp') {
          lR = -1.3;
          tiltX = -0.08;
        } else if (this.attackKind === 'bite') {
          // Isırık: önce baş geri çekilir ve çene sonuna kadar açılır, sonra gövde ava doğru atılır.
          tiltRate = 16;
          jawOpen = 1;
          aL = aR = 0.6;
          if (this.stateT < CFG.bite.lunge) {
            tiltX = -0.14;
            headX = -0.5;
          } else {
            tiltX = dy < this.h * 0.5 ? 0.95 : 0.4;
            headX = 0.3;
          }
        } else if (this.attackKind === 'boulder') {
          // Dev kaya: çömelip yerden kaldırır, başının üstüne çıkarır, geriye gerilip fırlatmaya hazırlanır.
          const t = this.stateT;
          tiltRate = 10;
          if (t < 0.6) {
            tiltX = 0.75;
            aL = aR = -0.9;
            elbowL = elbowR = -0.3;
            headX = 0.3;
            lL = lR = -0.4;
          } else if (t < 1.3) {
            tiltX = 0.05;
            aL = aR = -2.7;
            elbowL = elbowR = -0.6;
            headX = -0.2;
            lL = lR = 0;
          } else {
            tiltX = -0.22;
            aL = aR = -3.05;
            elbowL = elbowR = -1.1;
            headX = -0.3;
            lL = -0.3;
            lR = 0.35;
          }
        } else if (this.attackKind === 'shard') {
          // Kaya ezme: kaya göğsün önünde iki elin arasında; sıktıkça kollar titrer.
          aL = aR = -1.35;
          elbowL = elbowR = -1.5;
          twistL = 0.5;
          twistR = -0.5;
          tiltX = 0.08;
          if (this.stateT > 0.8) {
            const j = Math.sin(this.stateT * 70) * 0.08;
            aL += j;
            aR -= j;
            jawOpen = 0.5;
          }
        } else if (this.attackKind === 'command') {
          // Buyruk: baş geride, ağız sonuna kadar açık, kollar iki yana açılmış.
          headX = -0.65;
          jawOpen = 1;
          aL = aR = 0.35;
          armInR = 0.9;
          armZL = -0.9;
          tiltX = -0.18;
        } else if (this.attackKind === 'charge') {
          // Tos hazırlığı: baş eğik, omuzlar önde, bir ayak geride toprağı eşeler.
          tiltX = 0.55;
          headX = 0.35;
          aL = aR = 0.7;
          lL = -0.15;
          lR = 0.55;
          jawOpen = 0.4;
        } else if (this.attackKind === 'smash') {
          // Yıkma: iki kol başın üstünde birleşir, gövde geriye gerilir.
          aL = aR = -2.9;
          elbowL = elbowR = -0.5;
          tiltX = -0.12;
          headX = -0.2;
          jawOpen = 0.55;
          lL = lR = 0;
        } else if (this.attackKind === 'kick') {
          // Tekme hazırlığı: diz göğse çekilir, gövde geriye yaslanır, kollar dengeyi tutar.
          lR = -1.15;
          kneeR = 1.9;
          lL = 0.1;
          tiltX = -0.12;
          aL = -0.6;
          aR = 0.45;
        } else if (this.attackKind === 'grab') {
          // Uzanıp kapma: kol öne ve aşağı.
          aR = -1.1;
          tiltX = 0.3;
          jawOpen = 0.25;
        } else aR = -2.8;
        break;
      case 'grab': {
        // Eli ağza götür: kol kalkar, dirsek bükülür, baş öne eğilir, çene açılır.
        const t = this.grabProgress;
        const u = Math.min(1, t * 1.4);
        aR = lerp(-1.1, -1.4, u);
        elbowR = lerp(-0.3, -2.0, u);
        armInR = -0.42 * u;
        headX = 0.3 * t;
        tiltX = 0.12;
        jawOpen = 0.15 + 0.6 * t;
        lL = lR = 0;
        aL = 0.2;
        break;
      }
      case 'guard':
        // Gard: yumruklar çenenin önünde, dirsekler kapalı, çene göğüste.
        aL = aR = -1.15;
        elbowL = elbowR = -2.15;
        twistL = 0.55;
        twistR = -0.55;
        headX = 0.22;
        tiltX = 0.14;
        lL *= 0.6;
        lR *= 0.6;
        break;
      case 'recover':
        if (this.attackKind === 'swipe') aR = -0.5;
        tiltX = 0.2;
        if (this.attackKind === 'boulder' && this.stateT < 0.5) {
          // Fırlatışın ardı: kollar öne savrulmuş, gövde öne eğik.
          aL = aR = -1.0;
          tiltX = 0.45;
          lL = -0.35;
          lR = 0.3;
        }
        if (this.attackKind === 'shard' && this.stateT < 0.5) {
          // Saçışın ardı: sağ kol öne savrulmuş.
          aR = -1.7;
          aL = -0.4;
          tiltX = 0.3;
        }
        if (this.attackKind === 'smash' && this.stateT < 0.45) {
          // Kollar aşağı inmiş, gövde öne çökmüş: vuruşun ardı.
          aL = aR = -1.05;
          tiltX = 0.5;
          headX = 0.3;
          lL = -0.3;
          lR = 0.2;
        }
        if (this.attackKind === 'kick' && this.stateT < 0.35) {
          // Bacak ileri açılmış, gövde geride.
          lR = -1.55;
          kneeR = 0.04;
          lL = 0.12;
          tiltX = -0.22;
          aL = -0.6;
          aR = 0.45;
        }
        if (this.attackKind === 'bite' && this.stateT < 0.35) {
          // Çene şak diye kapanır; gövde bir an eğik kalır.
          tiltX = dy < this.h * 0.5 ? 0.95 : 0.4;
          headX = 0.3;
          aL = aR = 0.6;
          tiltRate = 16;
          jawRate = 40;
        }
        break;
      case 'stunned':
        headX = 0.6;
        tiltX = 0.12;
        aL = aR = 0.1;
        lL = lR = 0;
        if (this.blindT > 0) {
          // Gözleri kesildi: iki eli yüzünde, başı eğik, gövde geri sendeliyor.
          aL = aR = -1.5;
          elbowL = elbowR = -2.2;
          twistL = 0.6;
          twistR = -0.6;
          headX = 0.35;
          tiltX = -0.08 + Math.sin(this.stateT * 9) * 0.05;
        }
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
      case 'climb': {
        // Tırmanış: kollar yukarıda sırayla tutunur, bacaklar gövdeyi sarar, baş avına kalkık.
        const c = Math.sin(this.phase);
        aL = -2.6 + c * 0.45;
        aR = -2.6 - c * 0.45;
        lL = -0.9 + c * 0.5;
        lR = -0.9 - c * 0.5;
        tiltX = 0.15;
        headX = -0.45;
        kneeR = 1.4;
        break;
      }
      case 'rush':
        // Atılım: omuz önde, kollar geride, uzun adımlar.
        tiltX = 0.55;
        aL = aR = 0.9;
        lL = Math.sin(this.phase) * 0.9;
        lR = -lL;
        if (this.breaching) {
          // Sura toslayış: önkollar yüzün önünde çapraz, baş eğik, omuz önde.
          aL = aR = -1.45;
          elbowL = elbowR = -2.15;
          twistL = 0.6;
          twistR = -0.6;
          headX = 0.4;
          tiltX = 0.45;
        }
        break;
    }
    if (this.state === 'held') {
      // Ağızda çabalama: kollar savrulur, bacaklar tepinir, baş sarkık.
      const c = Math.sin(this.phase);
      aL = -1.2 + c * 0.7;
      aR = -0.4 - c * 0.7;
      lL = c * 0.8;
      lR = -c * 0.8;
      headX = 0.5;
      tiltX = 0;
    }
    if (this.blindT > 0 && (this.state === 'chase' || this.state === 'wander')) {
      // Kör yürüyüş: bir eli kesik gözlerinde, öbürü önünde el yordamıyla yoklar.
      aR = -1.5;
      elbowR = -2.2;
      twistR = -0.6;
      aL = -1.25 + Math.sin(this.phase) * 0.2;
      headX = 0.25;
    }
    if (this.state === 'windup' && this.attackKind === 'power' && this.power) {
      // Güç hazırlığı: her güç kendi duruşuyla belli olur.
      switch (this.power.kind) {
        case 'stun':
          headX = -0.55;
          jawOpen = 0.95;
          aL = aR = 0.45;
          tiltX = -0.12;
          break;
        case 'burst':
          aL = aR = -2.8;
          tiltX = -0.1;
          lL = lR = 0;
          break;
        case 'beam':
          headX = 0.12;
          jawOpen = 1;
          tiltX = 0.18;
          aL = aR = 0.5;
          break;
        case 'rush':
          tiltX = 0.5;
          aL = aR = 0.9;
          lL = -0.45;
          lR = 0.3;
          break;
        case 'buff':
          aL = aR = -1.3;
          headX = -0.2;
          jawOpen = 0.7;
          break;
        case 'throw':
          aR = -2.8;
          tiltX = -0.08;
          break;
      }
    }
    if (intro) {
      lL = lR = 0;
      if (intro === 'rise') {
        tiltX = 0.6;
        headX = 0.5;
        aL = aR = 0.6;
      } else {
        const shiver = Math.sin(this.stateT * 60) * 0.03;
        tiltX = -0.22 + shiver;
        headX = -0.6 + shiver;
        jawOpen = 1;
        aL = aR = 0.55;
      }
    }
    let kneeL: number | undefined = this.state === 'climb' ? 1.4 : undefined;
    if (this.screamT > 0 && this.state === 'chase') {
      // Çığlık: baş geride, ağız sonuna kadar açık, kollar yana açılmış.
      headX = -0.55;
      jawOpen = 0.95;
      aL = aR = 0.45;
      tiltX = -0.1;
    }
    if (this.type.crawl && this.state !== 'downed' && this.state !== 'leap') {
      // Dört ayak: gövde öne yatık, kollar ön bacak gibi yere basar, dizler karnın altında kırık.
      tiltX = 1.15;
      headX = -0.95 + headX;
      lL = -2.15 + swing * 0.5;
      lR = -2.15 - swing * 0.5;
      kneeL = kneeR = 2.0;
      if (this.state !== 'windup' && this.state !== 'recover') {
        aL = -1.15 - swing * 0.7;
        aR = -1.15 + swing * 0.7;
      } else {
        aL = -1.15;
        if (this.attackKind === 'bite') aR = -1.15; // ısırırken iki eli de yerde
      }
    }
    if (jawRate === 0) jawOpen = Math.max(jawOpen, b.jawRest);
    const k = 1 - Math.exp(-dt * (this.state === 'recover' ? 22 : 9));
    b.armL.rotation.x = lerp(b.armL.rotation.x, aL, k);
    b.armR.rotation.x = lerp(b.armR.rotation.x, aR, k);
    b.legL.rotation.x = lerp(b.legL.rotation.x, lL, k);
    b.legR.rotation.x = lerp(b.legR.rotation.x, lR, k);
    b.tilt.rotation.x = lerp(b.tilt.rotation.x, tiltX, 1 - Math.exp(-dt * tiltRate));
    b.head.rotation.x = lerp(b.head.rotation.x, headX, k);
    b.armR.rotation.z = lerp(b.armR.rotation.z, armInR, k);
    b.armL.rotation.y = lerp(b.armL.rotation.y, twistL, k);
    b.armL.rotation.z = lerp(b.armL.rotation.z, armZL, k);
    b.armR.rotation.y = lerp(b.armR.rotation.y, twistR, k);
    // Ağırlık: her adımda gövde biraz iner kalkar ve yükü taşıyan bacağa doğru yana yatar; baş avına döner.
    const walking = this.moving && !this.type.crawl && this.state !== 'downed';
    const heavyK = Math.min(1, this.h / 14);
    b.tilt.position.y = lerp(b.tilt.position.y, walking ? -Math.abs(Math.sin(this.phase)) * 0.014 * heavyK : 0, k);
    b.tilt.rotation.z = lerp(b.tilt.rotation.z, walking ? Math.sin(this.phase) * 0.05 * heavyK : 0, k);
    b.head.rotation.z = lerp(b.head.rotation.z, walking ? -Math.sin(this.phase) * 0.04 : 0, k);
    b.head.rotation.y = lerp(b.head.rotation.y, this.state === 'downed' || this.type.crawl ? 0 : this.lookYaw, 1 - Math.exp(-dt * 3));
    b.jaw.rotation.x = lerp(b.jaw.rotation.x, jawOpen, jawRate > 0 ? 1 - Math.exp(-dt * jawRate) : k);
    autoBend(b, k, { elbowR, elbowL, kneeL, kneeR });
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.body.root);
    disposeHumanoid(this.body);
  }
}
