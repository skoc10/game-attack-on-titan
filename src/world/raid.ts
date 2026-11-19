import * as THREE from 'three';
import type { Game } from '../game';
import { CFG } from '../data/config';
import { RAID_BY_ID, type RaidDef, type RaidId } from '../data/raids';
import { Giant } from '../enemies/giant';
import { BOSSES, GIANT_TYPES, type CommonKind } from '../enemies/giantTypes';
import { RaidState, smashDamage, type RaidEvent } from '../systems/raidState';
import { storeSave } from '../core/save';
import { HALF_T, ringOf, spawnable, wallDist } from './layout';
import type { Building } from './ruins';

const W = CFG.world;
const v = new THREE.Vector3();
const ESCORTS: CommonKind[] = ['normal', 'runner', 'leaper', 'thrower', 'normal'];

interface Fire {
  x: number;
  y: number;
  z: number;
  size: number;
  t: number;
}

interface Chunk {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
}

/** Sur yüzündeki çatlak dokusu: merkezden dağılan kırık çizgiler. */
function crackTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  x.strokeStyle = 'rgba(18,15,13,0.95)';
  x.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    let px = 64;
    let py = 64;
    let a = (i / 9) * Math.PI * 2 + Math.random() * 0.5;
    x.lineWidth = 3.2;
    x.beginPath();
    x.moveTo(px, py);
    for (let s = 0; s < 7; s++) {
      a += (Math.random() - 0.5) * 0.9;
      px += Math.cos(a) * 8;
      py += Math.sin(a) * 8;
      x.lineTo(px, py);
      x.lineWidth = Math.max(0.8, 3.2 - s * 0.4);
    }
    x.stroke();
  }
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 26);
  g.addColorStop(0, 'rgba(12,10,9,0.95)');
  g.addColorStop(1, 'rgba(12,10,9,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/**
 * Baskınlar: devler bir köye yürüyüp evleri yıkar ya da dev bir yıkıcı suru döver; oyuncu savunur.
 * Akışın kuralları RaidState'tedir; burada devler doğar, yıkım görünür olur ve sonuç bildirilir.
 */
export class Raid {
  state: RaidState | null = null;
  private def: RaidDef | null = null;
  /** Savunulan yerin merkezi (köy meydanı ya da surun dövülen noktası). */
  private readonly site = new THREE.Vector3();
  /** Devlerin geldiği yön (dışarıya doğru açı). */
  private outward = 0;
  private houses: Building[] = [];
  private readonly wave: Giant[] = [];
  private readonly escorts: Giant[] = [];
  private colossus: Giant | null = null;
  private escortT = 0;
  private farT = 0;
  private overT = 0;
  private emitT = 0;
  private readonly fires: Fire[] = [];
  private readonly chunks: Chunk[] = [];
  private readonly cracks: THREE.Mesh[] = [];
  private readonly crackMat: THREE.MeshBasicMaterial;
  private readonly chunkGeo = new THREE.DodecahedronGeometry(1, 0);
  private readonly chunkMat = new THREE.MeshLambertMaterial({ color: 0x8c877c, flatShading: true });

  constructor(private readonly game: Game) {
    this.crackMat = new THREE.MeshBasicMaterial({ map: crackTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  }

  /** Baskın sürüyor mu (sonuç gösterilirken de bitmiş sayılır). */
  get active() {
    return this.state !== null && !this.state.over;
  }

  get id(): RaidId | null {
    return this.def?.id ?? null;
  }

  /** Haritada ve ışık sütununda gösterilecek hedef. */
  get target(): [number, number] | null {
    return this.active ? [this.site.x, this.site.z] : null;
  }

  // ---------------------------------------------------------------- başlangıç
  begin(id: RaidId) {
    const g = this.game;
    this.clear();
    const def = RAID_BY_ID[id];
    this.def = def;
    this.state = new RaidState(def);
    this.farT = 0;
    this.overT = 0;
    if (def.kind === 'village') {
      // Bölgesindeki köylerden, verilen yöne en yakın olanı.
      const list = g.world.villages.filter((x) => x.zone === def.zone);
      const ring = (W.walls[def.zone - 1].r + W.walls[def.zone].r) / 2;
      const hx = Math.sin(def.angle) * ring;
      const hz = Math.cos(def.angle) * ring;
      let best = list[0];
      for (const vl of list) if (Math.hypot(vl.x - hx, vl.z - hz) < Math.hypot(best.x - hx, best.z - hz)) best = vl;
      this.site.set(best.x, g.world.heightAt(best.x, best.z), best.z);
      this.outward = Math.atan2(best.x, best.z);
      this.houses = g.world.buildings.filter((b) => !b.town && Math.hypot((b.minX + b.maxX) / 2 - best.x, (b.minZ + b.maxZ) / 2 - best.z) < 70);
    } else {
      // Sur baskını: surun iki kapısının ortasındaki bir parça.
      const R = W.walls[def.zone].r;
      this.outward = def.angle;
      this.site.set(Math.sin(def.angle) * R, W.wallH, Math.cos(def.angle) * R);
      this.houses = [];
    }
    // Bölgede kendiliğinden dolaşan devler kaldırılır: baskının devleri gelecek.
    for (let i = g.giants.length - 1; i >= 0; i--) {
      const gi = g.giants[i];
      if (gi.persistent || gi.tag || Math.hypot(gi.pos.x - this.site.x, gi.pos.z - this.site.z) > 500) continue;
      gi.dispose(g.scene);
      g.giants.splice(i, 1);
    }
    this.placePlayer();
    g.hud.banner(def.name.toLocaleUpperCase('tr'), `${def.place} — devler ${def.prep} saniye içinde geliyor`);
    g.hud.toast(def.kind === 'village' ? 'Köyü savun: devler evleri yıkarsa köyün sağlamlığı düşer' : 'Suru savun: toplara geç (E), bacaklarını kes, ensesine ulaş');
    g.audio.giant('growl', 40, this.site.x + Math.sin(this.outward) * 300, this.site.z + Math.cos(this.outward) * 300, 3);
  }

  /** Oyuncu savunacağı yere taşınır: köy meydanına ya da surun tepesine; yüzü devlerin geleceği yöne döner. */
  private placePlayer() {
    const g = this.game;
    const p = g.player;
    if (p.grabbedBy) p.releaseGrab(p.grabbedBy);
    if (p.mode === 'mounted') p.dismount(false);
    p.grapple.release();
    p.moveTarget = null;
    const [x, y, z] = this.respawnPoint()!;
    p.pos.set(x, y, z);
    p.vel.set(0, 0, 0);
    p.onGround = false;
    p.faceYaw = this.outward;
    g.camYaw = this.outward;
    g.camPitch = this.def?.kind === 'wall' ? -0.05 : -0.1;
    // At, savunulan yerin hemen içinde bekler.
    const back = this.def?.kind === 'wall' ? 30 : 6;
    const hx = x - Math.sin(this.outward) * back + Math.cos(this.outward) * 4;
    const hz = z - Math.cos(this.outward) * back - Math.sin(this.outward) * 4;
    g.horse.pos.set(hx, g.world.heightAt(hx, hz), hz);
    g.horse.mode = 'idle';
  }

  /** Baskın sürerken ölen oyuncunun doğacağı yer. */
  respawnPoint(): [number, number, number] | null {
    if (!this.active || !this.def) return null;
    if (this.def.kind === 'wall') return [this.site.x, W.wallH + 1, this.site.z];
    const x = this.site.x - Math.sin(this.outward) * 20;
    const z = this.site.z - Math.cos(this.outward) * 20;
    return [x, this.game.world.heightAt(x, z) + 1, z];
  }

  // ---------------------------------------------------------------- dalgalar
  private spawnWave(i: number) {
    const g = this.game;
    const def = this.def!;
    if (def.kind === 'wall') {
      this.spawnColossus();
      return;
    }
    const w = def.waves[i];
    let big = w.big ?? 0;
    // Devler köyle aynı sur bölgesinde doğar (surun öbür yanında kalıp sura takılmasınlar); önce dış yönden denenir.
    const ring = ringOf(this.site.x, this.site.z);
    const spot = () => {
      for (let t = 0; t < 40; t++) {
        const a = this.outward + (Math.random() - 0.5) * (t < 15 ? 2.2 : Math.PI * 2);
        const d = 200 + Math.random() * 80;
        const x = this.site.x + Math.sin(a) * d;
        const z = this.site.z + Math.cos(a) * d;
        if (ringOf(x, z) === ring && wallDist(x, z) > 50 && spawnable(x, z, 40, 24)) return [x, z];
      }
      return [this.site.x + Math.sin(this.outward) * 250, this.site.z + Math.cos(this.outward) * 250];
    };
    for (const [kind, n] of w.giants) {
      for (let k = 0; k < n; k++) {
        const [x, z] = spot();
        let type = GIANT_TYPES[kind];
        if (big > 0 && !type.crawl) {
          big--;
          type = { ...type, name: `İri ${type.name}`, minH: type.maxH * 1.35, maxH: type.maxH * 1.6, hpBase: type.hpBase * 2 };
        }
        const gi = new Giant(type, x, z, g);
        g.giants.push(gi);
        this.enlist(gi, this.wave);
      }
    }
    g.hud.banner(`DALGA ${i + 1}/${def.waves.length}`, `${w.giants.reduce((a, [, c]) => a + c, 0)} dev köye yürüyor${w.shifter ? ' — aralarında bir dönüşümcü var' : ''}`);
    if (w.shifter) {
      const [x, z] = spot();
      this.enlist(g.spawner.spawnShifter(w.shifter, x, z, g), this.wave);
    }
    g.audio.giant('shriek', 14, this.site.x + Math.sin(this.outward) * 200, this.site.z + Math.cos(this.outward) * 200, 3);
  }

  /** Dev baskına katılır: köyün bir yerine (ya da sura) yürür, uzaklaşınca kaybolmaz. */
  private enlist(gi: Giant, list: Giant[], goal = true) {
    gi.persistent = true;
    gi.tag = 'raid';
    if (goal) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * 26;
      gi.raid = { x: this.site.x + Math.sin(a) * d, z: this.site.z + Math.cos(a) * d, r: 5 + gi.radius, siege: false };
    }
    gi.yaw = Math.atan2(this.site.x - gi.pos.x, this.site.z - gi.pos.z);
    list.push(gi);
  }

  private spawnColossus() {
    const g = this.game;
    const R = W.walls[this.def!.zone].r;
    const a = this.outward;
    const x = Math.sin(a) * (R + 340);
    const z = Math.cos(a) * (R + 340);
    const gi = new Giant(BOSSES.yikici, x, z, g);
    g.giants.push(gi);
    const stand = R + HALF_T + gi.bodyR + 2;
    this.enlist(gi, this.wave, false);
    gi.raid = { x: Math.sin(a) * stand, z: Math.cos(a) * stand, r: 7, siege: true };
    this.colossus = gi;
    this.escortT = 10;
    g.strikeAt(x, gi.pos.y, z, gi.h, 0xff8a5a);
    g.hud.banner('SUR YIKAN GELİYOR', 'Surdan uzun bir dev — topları kullan, ensesine beş temiz kesik gerek');
  }

  private spawnEscorts() {
    const g = this.game;
    const c = this.colossus;
    if (!c || !c.alive) return;
    const n = this.def?.escortCount ?? 3;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const x = c.pos.x + Math.sin(a) * (40 + Math.random() * 30);
      const z = c.pos.z + Math.cos(a) * (40 + Math.random() * 30);
      const gi = new Giant(GIANT_TYPES[ESCORTS[Math.floor(Math.random() * ESCORTS.length)]], x, z, g);
      g.giants.push(gi);
      this.enlist(gi, this.escorts, false);
    }
    g.hud.toast('Yıkıcıya eşlik eden devler geldi');
  }

  // ---------------------------------------------------------------- yıkım
  /** Baskındaki dev vuruşunu indirdi: köyde ev, kuşatmada sur hasar alır. */
  smash(gi: Giant) {
    const g = this.game;
    const st = this.state;
    if (!st || st.over || !gi.raid) return;
    const siege = gi.raid.siege;
    const p = g.player.pos;
    if (siege) {
      // Darbe surun dış yüzüne iner: taşlar kopar, çatlak büyür.
      const th = Math.atan2(gi.pos.x, gi.pos.z);
      const R = W.walls[this.def!.zone].r + HALF_T;
      const y = W.wallH * (0.55 + Math.random() * 0.35);
      v.set(Math.sin(th) * R, y, Math.cos(th) * R);
      g.audio.explosion(v.x, v.z);
      g.shakeCam(Math.max(0.35, 1.3 - Math.hypot(v.x - p.x, v.z - p.z) / 150));
      g.particles.burst(v, 40, 26, 1.2, 0xb8b0a0, 4, -6, 2.2, -0.2);
      g.smoke.burst(v, 12, 9, 3, 0x8a8478, 5, 2, 5, 1.8);
      this.throwChunks(v, th, 6);
      this.crack(th, y);
    } else {
      // En yakın ev: çatısından toz ve tahta parçaları savrulur.
      v.set(gi.pos.x + Math.sin(gi.yaw) * (gi.radius + 3), 0, gi.pos.z + Math.cos(gi.yaw) * (gi.radius + 3));
      let best: Building | null = null;
      let bd = 26;
      for (const b of this.houses) {
        const d = Math.hypot((b.minX + b.maxX) / 2 - v.x, (b.minZ + b.maxZ) / 2 - v.z);
        if (d < bd) {
          bd = d;
          best = b;
        }
      }
      if (best) v.set((best.minX + best.maxX) / 2, best.top, (best.minZ + best.maxZ) / 2);
      else v.y = g.world.heightAt(v.x, v.z) + 1;
      g.audio.stomp(0.9);
      g.shakeCam(Math.max(0, 0.8 - Math.hypot(v.x - p.x, v.z - p.z) / 120));
      g.particles.burst(v, 26, 14, 1, 0x8a6a48, 3, -8, 1.6, -0.2);
      g.smoke.burst(v, 8, 6, 2.6, 0x8f857a, 3, 2, 4, 2);
    }
    const before = st.integrity;
    this.handle(st.damage(smashDamage(gi.h, siege)));
    // Sağlamlık düştükçe köyde yeni evler tutuşur, surda duman yükselir.
    const step = siege ? 20 : 12;
    if (!st.over && Math.floor((100 - st.integrity) / step) > Math.floor((100 - before) / step)) this.ignite();
  }

  /** Köyde rastgele bir ev tutuşur; surda çatlaktan duman yükselir. */
  private ignite() {
    const g = this.game;
    if (this.def?.kind === 'wall') {
      const th = this.outward + (Math.random() - 0.5) * 0.01;
      const R = W.walls[this.def.zone].r + HALF_T + 2;
      this.fires.push({ x: Math.sin(th) * R, y: W.wallH * 0.6, z: Math.cos(th) * R, size: 1.4, t: 0 });
      return;
    }
    const free = this.houses.filter((b) => !this.fires.some((f) => Math.abs(f.x - (b.minX + b.maxX) / 2) < 0.1 && Math.abs(f.z - (b.minZ + b.maxZ) / 2) < 0.1));
    const b = free.length > 0 ? free[Math.floor(Math.random() * free.length)] : null;
    if (b) this.fires.push({ x: (b.minX + b.maxX) / 2, y: b.top - 0.5, z: (b.minZ + b.maxZ) / 2, size: Math.min(b.maxX - b.minX, b.maxZ - b.minZ) * 0.35, t: 0 });
    g.hud.toast('Köyde bir ev alev aldı');
  }

  private crack(th: number, y: number) {
    const g = this.game;
    const R = W.walls[this.def!.zone].r + HALF_T + 0.12;
    const off = (Math.random() - 0.5) * 16 / R;
    const s = 9 + Math.random() * 10;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), this.crackMat);
    m.position.set(Math.sin(th + off) * R, y, Math.cos(th + off) * R);
    m.rotation.set(0, th + off, Math.random() * Math.PI);
    g.scene.add(m);
    this.cracks.push(m);
  }

  private throwChunks(at: THREE.Vector3, th: number, n: number) {
    const g = this.game;
    for (let i = 0; i < n; i++) {
      if (this.chunks.length > 40) {
        const old = this.chunks.shift()!;
        g.scene.remove(old.mesh);
      }
      const mesh = new THREE.Mesh(this.chunkGeo, this.chunkMat);
      mesh.scale.setScalar(0.8 + Math.random() * 2.2);
      mesh.position.copy(at).add(v.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 6));
      mesh.castShadow = true;
      g.scene.add(mesh);
      const out = 6 + Math.random() * 12;
      this.chunks.push({
        mesh,
        vel: new THREE.Vector3(Math.sin(th) * out + (Math.random() - 0.5) * 8, 4 + Math.random() * 8, Math.cos(th) * out + (Math.random() - 0.5) * 8),
        spin: new THREE.Vector3(Math.random() * 4, Math.random() * 4, Math.random() * 4),
      });
    }
  }

  /** Sur yıkıldı: dev bir toz bulutu, düşen taşlar ve yarık. */
  private collapse() {
    const g = this.game;
    const R = W.walls[this.def!.zone].r + HALF_T;
    const th = this.colossus ? Math.atan2(this.colossus.pos.x, this.colossus.pos.z) : this.outward;
    for (let k = 0; k < 5; k++) {
      v.set(Math.sin(th + (k - 2) * 0.004) * R, W.wallH * (0.3 + k * 0.12), Math.cos(th + (k - 2) * 0.004) * R);
      g.smoke.burst(v, 30, 22, 6, 0xa39a8a, 12, 3, 14, 2.5);
      g.particles.burst(v, 50, 34, 1.8, 0xc0b8a8, 6, -10, 2.8, -0.2);
      this.throwChunks(v, th, 8);
      this.crack(th + (k - 2) * 0.003, W.wallH * (0.25 + Math.random() * 0.6));
    }
    g.audio.explosion(v.x, v.z);
    g.audio.stomp(1.4);
    g.shakeCam(1.4);
  }

  // ---------------------------------------------------------------- akış
  private handle(events: RaidEvent[]) {
    for (const e of events) {
      if (e.type === 'wave') this.spawnWave(e.index);
      else this.finish(e.type === 'won');
    }
  }

  private finish(won: boolean, why = '') {
    const g = this.game;
    const def = this.def!;
    this.overT = 0;
    // Geride kalan devler baskından çıkar: sıradan devler gibi dolaşır, uzaklaşınca kaybolur.
    for (const gi of [...this.wave, ...this.escorts]) {
      if (!gi.alive) continue;
      gi.raid = null;
      gi.persistent = false;
      gi.tag = '';
    }
    if (won) {
      g.grantCoins(def.reward.coins);
      g.grantXp(def.reward.xp);
      if (!g.save.raids.includes(def.id)) g.save.raids.push(def.id);
      storeSave(g.save);
      g.meter.value = Math.min(g.meter.max, g.meter.value + 40);
      g.audio.kill(true);
      g.hud.banner('BASKIN PÜSKÜRTÜLDÜ', `${def.place} kurtuldu · +${def.reward.coins} puan · +${def.reward.xp} XP`);
    } else {
      if (def.kind === 'wall' && this.state!.integrity <= 0) this.collapse();
      g.hud.banner(def.kind === 'wall' ? 'SUR YIKILDI' : 'KÖY DÜŞTÜ', why || (def.kind === 'wall' ? 'Sur Yıkan kalkanı deldi — yeniden dene' : 'Devler köyü yerle bir etti — yeniden dene'));
    }
  }

  /** Menüden: sürmekte olan baskını bırakır. */
  abort() {
    if (!this.active) return;
    this.state!.fail();
    this.finish(false, 'Baskından çekildin');
  }

  update(dt: number) {
    const st = this.state;
    if (!st) {
      this.updateChunks(dt);
      return;
    }
    const g = this.game;
    const p = g.player;
    if (!st.over) {
      const alive = this.def!.kind === 'wall' ? (this.colossus?.alive ? 1 : 0) : this.wave.filter((x) => x.alive).length;
      this.handle(st.tick(dt, alive));
      // Savunulan yerden çok uzaklaşan oyuncu baskını kaybeder.
      const far = Math.hypot(p.pos.x - this.site.x, p.pos.z - this.site.z) > 760 && !p.dead;
      if (far) {
        if (this.farT === 0) g.hud.toast('Baskın bölgesinden uzaklaşıyorsun — geri dön!');
        this.farT += dt;
        if (this.farT > 10) {
          st.fail();
          this.finish(false, 'Baskın bölgesini terk ettin');
        }
      } else this.farT = 0;
      if (this.colossus?.alive && this.def!.escortEvery) {
        this.escortT -= dt;
        if (this.escortT <= 0) {
          this.escortT = this.def!.escortEvery;
          this.spawnEscorts();
        }
      }
    } else {
      this.overT += dt;
    }
    this.updateFx(dt);
    this.updateChunks(dt);
    // Sonuç bir süre ekranda kalır; ardından yangınlar söner, çatlaklar kalkar.
    if (st.over && this.overT > 40) this.clear();
  }

  private updateFx(dt: number) {
    const g = this.game;
    const p = g.player.pos;
    this.emitT -= dt;
    if (this.emitT > 0) return;
    this.emitT = 0.06;
    if (Math.hypot(p.x - this.site.x, p.z - this.site.z) > 900) return;
    const flames = [0xff6a1a, 0xffa53a, 0xffd27a];
    for (const f of this.fires) {
      f.t += 0.06;
      const s = f.size;
      for (let k = 0; k < 2; k++) {
        g.particles.emit(f.x + (Math.random() - 0.5) * s * 2, f.y + Math.random(), f.z + (Math.random() - 0.5) * s * 2, 0, 4 + Math.random() * 4, 0, 1.1, flames[Math.floor(Math.random() * 3)], 8, 2.2 + s, 0.4);
      }
      g.smoke.emit(f.x + (Math.random() - 0.5) * s, f.y + 3, f.z + (Math.random() - 0.5) * s, (Math.random() - 0.5) * 2, 4, (Math.random() - 0.5) * 2, 5, 0x2a2624, 3, 4 + s * 1.5, 2.6);
    }
    // Yıkıcının gövdesinden sürekli buhar tüter.
    const c = this.colossus;
    if (c?.alive) {
      const a = Math.random() * Math.PI * 2;
      g.smoke.emit(c.pos.x + Math.sin(a) * c.radius, c.pos.y + c.h * (0.4 + Math.random() * 0.5), c.pos.z + Math.cos(a) * c.radius, 0, 4, 0, 3, 0xe0d8cc, 4, 6, 2);
    }
  }

  private updateChunks(dt: number) {
    const g = this.game;
    for (let i = this.chunks.length - 1; i >= 0; i--) {
      const ch = this.chunks[i];
      ch.vel.y -= 30 * dt;
      ch.mesh.position.addScaledVector(ch.vel, dt);
      ch.mesh.rotation.x += ch.spin.x * dt;
      ch.mesh.rotation.y += ch.spin.y * dt;
      const gy = g.world.heightAt(ch.mesh.position.x, ch.mesh.position.z) + ch.mesh.scale.x * 0.6;
      if (ch.mesh.position.y <= gy) {
        ch.mesh.position.y = gy;
        // Yere düşen taş orada kalır; bir sonraki temizlikte kaldırılır.
        ch.vel.set(0, 0, 0);
        ch.spin.set(0, 0, 0);
      }
    }
  }

  /** Önceki baskının izlerini (yangın, çatlak, taş) siler. */
  private clear() {
    const g = this.game;
    for (const gi of [...this.wave, ...this.escorts]) {
      if (gi.alive && gi.tag === 'raid') {
        gi.raid = null;
        gi.persistent = false;
        gi.tag = '';
      }
    }
    this.wave.length = 0;
    this.escorts.length = 0;
    this.colossus = null;
    this.fires.length = 0;
    for (const m of this.cracks) {
      g.scene.remove(m);
      m.geometry.dispose();
    }
    this.cracks.length = 0;
    for (const ch of this.chunks) g.scene.remove(ch.mesh);
    this.chunks.length = 0;
    this.state = null;
    this.def = null;
  }

  /** HUD için: baskının adı, aşaması ve sağlamlık. */
  view() {
    const st = this.state;
    const def = this.def;
    if (!st || !def) return null;
    const alive = this.wave.filter((x) => x.alive).length;
    let line: string;
    if (st.phase === 'prep') line = `Devler ${Math.ceil(st.t)} sn içinde geliyor`;
    else if (st.phase === 'rest') line = `Sıradaki dalga ${Math.ceil(st.t)} sn sonra`;
    else if (st.phase === 'won') line = 'Püskürtüldü';
    else if (st.phase === 'lost') line = def.kind === 'wall' ? 'Sur yıkıldı' : 'Köy düştü';
    else if (def.kind === 'wall') line = this.colossus?.state === 'downed' ? 'Yıkıcı yerde — ensesine vur!' : 'Sur Yıkan suru dövüyor';
    else line = `Dalga ${st.wave + 1}/${def.waves.length} · ${alive} dev`;
    return { name: def.name, place: def.kind === 'wall' ? 'SUR' : 'KÖY', line, integrity: st.integrity / 100, over: st.over, won: st.phase === 'won' };
  }
}
