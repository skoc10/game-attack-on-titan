import * as THREE from 'three';
import { CFG } from './data/config';
import { Input } from './core/input';
import { GameAudio } from './core/audio';
import { Particles } from './core/particles';
import { SlashFx } from './core/slashfx';
import { Spears } from './player/spears';
import { Boulders } from './enemies/boulders';
import { Cocoon } from './player/cocoon';
import { Npcs } from './world/npcs';
import { killStyle, type KillStyle } from './systems/contracts';
import { combatIntensity } from './core/audioMath';
import { clearSave, loadSave, storeSave } from './core/save';
import { clamp, lerp } from './core/rng';
import { World } from './world/world';
import { crateColor, Crates, type Crate } from './world/crates';
import { Spawner } from './world/spawner';
import { Stations } from './world/stations';
import { TITAN_IDS, TITANS } from './data/titans';
import { Grass } from './world/grass';
import { SUN_DIR } from './world/terrain';
import { zoneName } from './world/walls';
import { Player } from './player/player';
import { Horse } from './player/horse';
import type { AimHit } from './player/grapple';
import type { Giant } from './enemies/giant';
import { TitanMeter } from './systems/titanMeter';
import { addXp, buyChar, classUnlocked, CLASS_UNLOCK, coinsFor, newSave, ownsChar, selectChar, streakMult, type ClassId, type GameMode, type SaveData } from './systems/progression';
import { CHARACTERS, type CharId } from './data/characters';
import { Story } from './systems/story';
import type { StoryEvent } from './systems/storyRules';
import { buildBeacon } from './world/beacon';
import { QuestLog } from './systems/quests';
import { CLASSES } from './player/classes';
import { Hud } from './ui/hud';
import { Menu } from './ui/menu';
import { Minimap } from './ui/minimap';

const target = new THREE.Vector3();
const look = new THREE.Vector3();

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.5, 8000);
  readonly input: Input;
  readonly audio = new GameAudio();
  readonly meter = new TitanMeter();
  readonly world: World;
  readonly particles: Particles;
  readonly slashes: SlashFx;
  readonly spears: Spears;
  readonly boulders: Boulders;
  readonly cocoon: Cocoon;
  readonly npcs: Npcs;
  /** Patlama sürerken yapılan öldürmeler mızrağa yazılır (kesik izi çizilmez). */
  killBy: 'spear' | null = null;
  /** Öldürme serisi ve bitmesine kalan süre. */
  streak = 0;
  streakT = 0;
  readonly player: Player;
  readonly horse: Horse;
  readonly crates: Crates;
  readonly stations: Stations;
  readonly grass: Grass;
  private readonly sun: THREE.DirectionalLight;
  private skyTime = 0;
  readonly spawner = new Spawner();
  readonly quests: QuestLog;
  readonly story: Story;
  readonly hud: Hud;
  readonly menu: Menu;
  readonly minimap: Minimap;
  readonly giants: Giant[] = [];
  readonly stats = { kills: 0, needlesFound: 0, transforms: 0 };
  readonly debug: boolean;
  save: SaveData;
  camYaw = 0;
  camPitch = -0.1;
  camDist = 6.5;
  /** Engeller hesaba katıldıktan sonraki gerçek kamera mesafesi. */
  camEff = 6.5;
  running = false;
  started = false;
  aim: AimHit | null = null;
  zone = '';
  /** İmlecin ekran konumu (NDC) ve dünyada gösterdiği yer. */
  readonly cursor = new THREE.Vector2();
  readonly aimDir = new THREE.Vector3(0, 0, 1);
  readonly aimPoint = new THREE.Vector3();
  aimOnGround = false;
  private readonly cursorRay = new THREE.Raycaster();
  private readonly marker: THREE.Mesh;
  /** Görev hedefini uzaktan gösteren ışık sütunu. */
  private readonly waypoint: THREE.Mesh;
  private yawPending = 0;
  private pitchPending = 0;
  private lowGasWarned = false;
  /** Son karenin süresi (girdi zamanlamaları için). */
  frameDt = 0;
  private wasLocked = false;
  private lockHintT = -1;
  private last = 0;
  private frameNo = 0;
  private slowT = 0;
  private shake = 0;
  private loadoutDirty = false;
  private readonly bolt: THREE.Mesh;
  private boltT = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.debug = new URLSearchParams(location.search).has('debug');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const fogColor = new THREE.Color(0xbfd0de);
    this.scene.background = fogColor;
    this.scene.fog = new THREE.Fog(fogColor, 160, 2200);
    this.scene.add(new THREE.HemisphereLight(0xd4e4f4, 0x6a6048, 1.15));
    // Güneş: gölge haritası oyuncuyu izleyen ~220 m'lik bir alanı kapsar.
    this.sun = new THREE.DirectionalLight(0xfff0d6, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -110;
    sc.right = sc.top = 110;
    sc.near = 20;
    sc.far = 700;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.5;
    this.scene.add(this.sun, this.sun.target);

    this.input = new Input(canvas);
    this.save = loadSave();
    this.world = new World(this.scene, fogColor);
    this.particles = new Particles(this.scene);
    this.slashes = new SlashFx(this.scene);
    this.spears = new Spears(this.scene);
    this.boulders = new Boulders(this.scene);
    this.cocoon = new Cocoon(this.scene);
    this.player = new Player(this);
    this.horse = new Horse(this, CFG.player.spawn.x + 4, CFG.player.spawn.z + 2);
    this.crates = new Crates(this.scene, this.world.villages);
    this.stations = new Stations(this.scene, this.world);
    this.grass = new Grass(this.scene, this.world);
    this.quests = new QuestLog(this);
    this.story = new Story(this);
    this.npcs = new Npcs(this);
    this.scene.add(buildBeacon());
    this.hud = new Hud(this);
    this.minimap = new Minimap(this, this.hud.minimapCanvas);
    this.menu = new Menu(this);
    this.player.applyLoadout();
    if (!this.save.bossDefeated) this.spawner.spawnBoss(this);

    this.bolt = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 2.6, 500, 6),
      new THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.9, fog: false }),
    );
    this.bolt.visible = false;
    this.scene.add(this.bolt);

    // Sağ tıkla verilen yürüme hedefini gösteren halka.
    const ring = new THREE.RingGeometry(0.55, 0.85, 24);
    ring.rotateX(-Math.PI / 2);
    this.marker = new THREE.Mesh(
      ring,
      new THREE.MeshBasicMaterial({ color: 0xe8c36a, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    this.marker.visible = false;
    this.scene.add(this.marker);

    this.waypoint = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.1, 180, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffe07a,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
      }),
    );
    this.waypoint.visible = false;
    this.scene.add(this.waypoint);

    window.addEventListener('resize', () => this.resize());
    this.resize();
    canvas.addEventListener('mousedown', () => {
      if (this.running && !this.input.locked) this.input.requestLock();
    });
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === canvas;
      // Esc fare kilidini açar: oyunu duraklat.
      if (!locked && this.wasLocked && this.running) this.pause();
      this.wasLocked = locked;
    });
    this.hud.setVisible(false);
    if (this.debug) (window as unknown as { __game: Game }).__game = this;
    requestAnimationFrame((t) => this.frame(t));
  }

  private resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- akış
  start() {
    if (this.loadoutDirty) {
      this.player.applyLoadout();
      this.loadoutDirty = false;
    }
    this.audio.unlock();
    if (!this.started) {
      // Menü arkasındaki dönen kamera yerine kapıya bakarak başla.
      this.camYaw = 0;
      this.camPitch = -0.1;
    }
    this.input.endFrame(); // duraklamışken birikmiş tuş basışlarını at
    this.running = true;
    this.started = true;
    this.menu.hide();
    this.hud.setVisible(true);
    this.renderer.domElement.classList.add('playing');
    this.input.requestLock();
    if (this.lockHintT < 0) this.lockHintT = 1.2;
    this.last = performance.now();
  }

  pause() {
    this.running = false;
    this.audio.frame({ x: 0, z: 0, yaw: 0 }, 0, 0, false);
    this.hud.setVisible(false);
    this.menu.show();
    this.renderer.domElement.classList.remove('playing');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  setClass(id: ClassId) {
    if (this.save.cls === id) return;
    this.save.cls = id;
    this.loadoutChanged();
  }

  /** Karakteri seçer; sahip değilse ve av puanı yetiyorsa satın alır. İşlem yapıldıysa true döner. */
  pickChar(id: CharId) {
    const s = this.save;
    if (s.char === id) return false;
    const ok = ownsChar(s, id) ? selectChar(s, id) : buyChar(s, id);
    if (ok) this.loadoutChanged();
    return ok;
  }

  /** Av puanı ekler (dev öldürme ve görev ödülleri). */
  grantCoins(amount: number) {
    if (amount <= 0) return;
    this.save.coins += Math.round(amount);
    storeSave(this.save);
  }

  loadoutChanged() {
    this.loadoutDirty = true;
    storeSave(this.save);
  }

  setMode(mode: GameMode) {
    if (this.save.mode === mode) return;
    this.save.mode = mode;
    this.story.restart();
    storeSave(this.save);
  }

  /** Hikâyede daha önce ulaşılmış bir sezonun başına döner. */
  playChapter(chapter: number) {
    this.save.mode = 'story';
    this.story.jump(chapter);
    storeSave(this.save);
  }

  /** Etkin görevin haritada gösterilecek hedefi. */
  objectiveTarget(): [number, number] | null {
    return this.save.mode === 'story' ? this.story.target : (this.quests.current?.target ?? null);
  }

  /** Yakındaki bölüm sonu devi (can barı için). */
  bossInView() {
    const p = this.player.pos;
    let best: Giant | null = null;
    let bd = 340;
    for (const g of this.giants) {
      if (g.type.kind !== 'boss' || !g.alive) continue;
      const d = Math.hypot(g.pos.x - p.x, g.pos.z - p.z);
      if (d < bd) {
        bd = d;
        best = g;
      }
    }
    return best;
  }

  private storyEvent(e: StoryEvent) {
    if (this.save.mode === 'story') this.story.emit(e);
  }

  resetProgress() {
    const mode = this.save.mode;
    clearSave();
    this.save = newSave();
    this.save.mode = mode;
    this.story.restart();
    this.loadoutDirty = true;
    this.meter.value = 0;
    this.meter.clearNeedles();
    if (!this.spawner.boss) this.spawner.spawnBoss(this);
  }

  lookDir(out: THREE.Vector3) {
    const cp = Math.cos(this.camPitch);
    return out.set(Math.sin(this.camYaw) * cp, Math.sin(this.camPitch), Math.cos(this.camYaw) * cp);
  }

  /** Oyuncudan imlecin gösterdiği noktaya doğru yatay yön açısı. */
  aimYaw() {
    const p = this.player.pos;
    const dx = this.aimPoint.x - p.x;
    const dz = this.aimPoint.z - p.z;
    return dx * dx + dz * dz > 0.25 ? Math.atan2(dx, dz) : Math.atan2(this.aimDir.x, this.aimDir.z);
  }

  /** İmleç ışınını araziyle kesiştirir: yürüme hedefi ve nişan yönü buradan gelir. */
  private updateCursor() {
    const inp = this.input;
    // Fare kilitliyken nişan ekranın ortasıdır.
    if (inp.locked) this.cursor.set(0, 0);
    else this.cursor.set((inp.mouseX / window.innerWidth) * 2 - 1, -(inp.mouseY / window.innerHeight) * 2 + 1);
    this.cursorRay.setFromCamera(this.cursor, this.camera);
    const o = this.cursorRay.ray.origin;
    const d = this.cursorRay.ray.direction;
    this.aimDir.copy(d);
    const below = (t: number) => o.y + d.y * t < this.world.heightAt(o.x + d.x * t, o.z + d.z * t);
    let lo = 0;
    let hi = 1;
    let found = false;
    while (hi < 900) {
      if (below(hi)) {
        found = true;
        break;
      }
      lo = hi;
      hi += 1.5 + hi * 0.05;
    }
    if (found) {
      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2;
        if (below(mid)) hi = mid;
        else lo = mid;
      }
      this.aimPoint.copy(o).addScaledVector(d, hi);
    } else {
      // Ufka/gökyüzüne bakıyor: o yönde uzak bir nokta.
      const p = this.player.pos;
      const l = Math.hypot(d.x, d.z) || 1;
      this.aimPoint.set(p.x + (d.x / l) * 60, p.y, p.z + (d.z / l) * 60);
    }
    this.aimOnGround = found;
  }

  shakeCam(amount: number) {
    this.shake = Math.max(this.shake, amount);
  }

  // ---------------------------------------------------------------- olaylar
  grantXp(amount: number) {
    if (amount <= 0) return;
    const before = this.save.level;
    const gained = addXp(this.save, amount);
    if (gained > 0) {
      this.audio.levelUp();
      this.hud.banner(`SEVİYE ${this.save.level}`, 'Yeni yükseltme puanı — Esc ile menüden harca');
      for (const id of Object.keys(CLASSES) as ClassId[]) {
        if (CLASS_UNLOCK[id] > before && classUnlocked(this.save, id)) this.hud.toast(`Yeni sınıf açıldı: ${CLASSES[id].name}`);
      }
    }
    storeSave(this.save);
  }

  onGiantKilled(g: Giant, source: 'blade' | 'titan') {
    this.stats.kills += 1;
    this.save.kills += 1;
    this.meter.addKill(g.type.meter, (1 + 0.15 * this.save.upgrades.meter) * CHARACTERS[this.save.char].meter);
    this.audio.kill(g.type.kind === 'boss');
    const style = this.killFx(g, source);
    // Seri: süre dolmadan gelen her öldürme av puanı çarpanını büyütür.
    this.streak = this.streakT > 0 ? this.streak + 1 : 1;
    this.streakT = CFG.streak.window;
    const mult = streakMult(this.streak, CFG.streak.step, CFG.streak.maxMult);
    const coins = Math.round(coinsFor(g.type.xp) * mult);
    this.save.coins += coins;
    this.hud.toast(`${g.type.name} öldürüldü  +${g.type.xp} XP · +${coins} puan${mult > 1 ? ` (seri ×${mult.toFixed(2).replace(/0$/, '')})` : ''}`);
    if (g.type.kind === 'boss') {
      this.meter.value = this.meter.max;
      if (g.tag === 'gate') this.save.bossDefeated = true;
      this.hud.banner(`${g.type.name.toLocaleUpperCase('tr')} DÜŞTÜ`, g.tag === 'gate' ? 'Demir Sur kapısı yeniden açık' : 'Dev barın doldu');
    }
    this.grantXp(g.type.xp);
    this.npcs.emit({ type: 'kill', giant: g.type.kind, elite: g.isElite, by: this.killBy === 'spear' ? 'spear' : source, style });
    this.npcs.emit({ type: 'streak', n: this.streak });
    const p = this.player;
    this.storyEvent({ type: 'kill', giant: g.type.kind, by: source, form: p.mode === 'titan' ? p.titan.def.id : null, tag: g.tag });
  }

  /**
   * Öldürme efekti. Kılıçla: ensede çapraz iki kesik izi, gidiş yönüne fışkıran kan ve buhar;
   * hızla içinden geçildiyse iz uzar, zaman daha çok yavaşlar. Dev formunda: tek büyük darbe izi.
   */
  private killFx(g: Giant, source: 'blade' | 'titan'): KillStyle | null {
    const p = this.player;
    const at = g.napeWorld(target);
    const speed = p.vel.length();
    if (speed > 3) look.copy(p.vel).divideScalar(speed);
    else look.set(Math.sin(p.faceYaw), 0, Math.cos(p.faceYaw));
    const lying = g.state === 'dead' && g.wasLying;
    if (this.killBy === 'spear') {
      // Patlamanın kendi efekti var; yalnızca ensede bir alev patlaması eklenir.
      this.particles.burst(at, 50, g.h + 12, 0.9, 0xffb040, g.h * 0.1);
      this.slowT = 0.2;
      return null;
    }
    if (source === 'titan') {
      const col = p.titan.def.color;
      this.slashes.spawn(at, look, g.h * 0.45 + 3, col, 0.2, 0.4);
      this.particles.burst(at, 60, g.h * 1.4 + 10, 1.1, col, g.h * 0.15);
      this.shakeCam(0.6);
      return null;
    }
    const style = killStyle({ lying, above: p.pos.y + 1 - at.y, vy: p.vel.y, speed });
    if (style === 'dive') {
      // Dalış kesiği: yukarıdan inen dikey bir iz ile onu kesen yatay iz (artı biçimi), yerde toz halkası.
      const size = 2.4 + g.h * 0.16;
      this.audio.slash(1);
      this.slashes.spawn(at, look, size * 1.25, 0xffffff, Math.PI / 2, 0.4);
      this.slashes.spawn(at, look, size, 0xffd27a, 0, 0.46);
      for (let i = 0; i < 60; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 6 + Math.random() * 14;
        this.particles.emit(at.x, at.y, at.z, Math.cos(a) * sp, -4 - Math.random() * 14, Math.sin(a) * sp, 0.6 + Math.random() * 0.5, i % 3 === 0 ? 0xff4a3a : 0xc8201a, -14);
      }
      const gy = this.world.heightAt(g.pos.x, g.pos.z) + 0.4;
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        this.particles.emit(g.pos.x + Math.cos(a) * 2, gy, g.pos.z + Math.sin(a) * 2, Math.cos(a) * (14 + g.h), 1.5, Math.sin(a) * (14 + g.h), 1, 0xa39a86);
      }
      this.hud.flash('#ffffff', 0.28, 0.3);
      this.hud.callout('DALIŞ KESİĞİ');
      this.slowT = 0.45;
      this.shakeCam(0.9);
      return style;
    }
    const power = Math.min(1, speed / 38);
    const size = 1.8 + g.h * 0.13 + power * 2.2;
    this.audio.slash(power);
    this.slashes.spawn(at, look, size, 0xffffff, 0.55);
    this.slashes.spawn(at, look, size * 0.92, 0xff7a6a, -0.55, 0.36);
    // Kan: kesiğin gittiği yöne doğru dar bir koni halinde fışkırır.
    const jet = 26 + Math.round(power * 44);
    for (let i = 0; i < jet; i++) {
      const sp = (8 + Math.random() * 16) * (0.6 + power);
      this.particles.emit(
        at.x,
        at.y,
        at.z,
        look.x * sp + (Math.random() - 0.5) * 7,
        look.y * sp + Math.random() * 7 + (lying ? 6 : 1),
        look.z * sp + (Math.random() - 0.5) * 7,
        0.5 + Math.random() * 0.6,
        i % 3 === 0 ? 0xff4a3a : 0xc8201a,
        -16,
      );
    }
    if (power > 0.45) {
      // Hızlı geçiş: yol boyunca beyaz bir iz ve kısa bir parlama.
      for (let i = 0; i < 26; i++) {
        const along = -3 + i * 0.5;
        this.particles.emit(at.x + look.x * along, at.y + look.y * along, at.z + look.z * along, look.x * 3, 0.5, look.z * 3, 0.35 + i * 0.012, 0xfff4e0);
      }
      this.hud.flash('#ffffff', 0.12 + power * 0.14, 0.25);
    }
    if (style === 'pass') this.hud.callout('KESİP GEÇTİN');
    else if (style === 'ground') this.hud.callout('SON DARBE');
    this.slowT = 0.14 + power * 0.26;
    this.shakeCam(0.3 + power * 0.5);
    return style;
  }

  /**
   * Bacak kesiği efekti: ayak bileğinde yere paralel bir kesik izi, yana fışkıran kan ve toz.
   * Dev yere düşüyorsa iz büyür ve yer sarsılır.
   */
  legFx(at: THREE.Vector3, g: Giant, down: boolean) {
    const p = this.player;
    const hs = Math.hypot(p.vel.x, p.vel.z);
    if (hs > 2) look.set(p.vel.x / hs, 0, p.vel.z / hs);
    else look.set(Math.sin(p.faceYaw), 0, Math.cos(p.faceYaw));
    const size = 1.5 + g.h * 0.1 + (down ? 1 : 0);
    this.audio.slash(down ? 0.6 : 0.25);
    this.audio.hit();
    this.slashes.spawn(at, look, size, 0xffffff, 0.08, 0.28);
    this.slashes.spawn(at, look, size * 0.85, 0xff7a6a, -0.2, 0.34);
    // Kan, kesiğin iki yanına alçaktan saçılır.
    const n = down ? 44 : 22;
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const sp = 5 + Math.random() * 11;
      this.particles.emit(at.x, at.y + 0.4, at.z, look.x * sp * 0.6 + look.z * side * sp * 0.7, 1 + Math.random() * 5, look.z * sp * 0.6 - look.x * side * sp * 0.7, 0.45 + Math.random() * 0.5, i % 3 === 0 ? 0xff4a3a : 0xc8201a, -14);
    }
    const gy = this.world.heightAt(at.x, at.z) + 0.3;
    for (let i = 0; i < (down ? 30 : 12); i++) {
      const a = Math.random() * Math.PI * 2;
      this.particles.emit(at.x, gy, at.z, Math.cos(a) * 7, 1.5, Math.sin(a) * 7, 0.9, 0xa39a86);
    }
    if (down) {
      this.hud.callout('DİZ ÇÖKTÜ');
      this.slowT = Math.max(this.slowT, 0.18);
      this.shakeCam(0.6);
    } else this.shakeCam(0.25);
  }

  onCrateOpened(c: Crate) {
    const p = this.player;
    this.audio.pickup();
    let color = crateColor(c);
    if (c.content === 'needle') {
      const def = TITANS[c.form];
      const first = this.meter.needles[c.form] === 0;
      this.meter.addNeedle(c.form);
      this.stats.needlesFound += 1;
      color = def.color;
      this.hud.toast(`${def.needle} bulundu → ${def.name}`);
      if (first && this.meter.totalNeedles > 1) this.hud.toast('Tab ile hangi deve dönüşeceğini seç');
      this.storyEvent({ type: 'needle', form: c.form });
    } else if (c.content === 'gas') {
      p.gas = p.maxGas;
      this.hud.toast('Gaz tüpleri dolduruldu');
    } else if (c.content === 'spear') {
      const got = Math.min(CFG.spear.perCrate, p.maxSpears - p.spears);
      p.spears += got;
      this.hud.toast(got > 0 ? `Patlar mızrak +${got} — Q ile fırlat` : 'Mızrak kılıfın dolu');
    } else if (c.content === 'medic') {
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * CFG.crate.medicHeal);
      this.hud.toast('Yaraların sarıldı');
    } else if (c.content === 'coin') {
      this.grantCoins(CFG.crate.coins);
      this.hud.toast(`Ganimet: +${CFG.crate.coins} av puanı`);
    } else {
      p.blades = p.maxBlades;
      this.hud.toast('Yeni kılıçlar takıldı');
    }
    this.npcs.emit({ type: 'crate', content: c.content });
    target.set(c.x, c.y + 1, c.z);
    this.particles.burst(target, 30, 8, 1, color, 1, 4);
    this.grantXp(10);
  }

  onTransform() {
    const p = this.player.pos;
    this.stats.transforms += 1;
    this.audio.transform();
    this.hud.flash('#fff6c8', 0.95, 0.7);
    const def = this.player.titan.def;
    this.hud.banner(def.name.toLocaleUpperCase('tr'), def.tagline);
    this.shakeCam(1.2);
    this.bolt.position.set(p.x, p.y + 250, p.z);
    this.bolt.visible = true;
    this.boltT = 0.35;
    target.set(p.x, p.y + 8, p.z);
    this.particles.burst(target, 160, 40, 1.6, def.color, 8, 6);
    for (const g of this.giants) {
      if (g.alive && Math.hypot(g.pos.x - p.x, g.pos.z - p.z) < 32) g.stun(2);
    }
    this.storyEvent({ type: 'transform', form: def.id });
  }

  /** Çığırtkan avını gördü: yakındaki devler uyanır, çevrede yenileri belirir. */
  onScream(g: Giant) {
    this.hud.banner('ÇIĞLIK', 'Çığırtkan sürüyü çağırıyor — önce onu sustur');
    this.shakeCam(0.5);
    for (const o of this.giants) {
      if (o !== g && Math.hypot(o.pos.x - g.pos.x, o.pos.z - g.pos.z) < 170) o.alert();
    }
    let made = 0;
    for (let tries = 0; tries < 16 && made < 3; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = 45 + Math.random() * 40;
      const x = g.pos.x + Math.sin(a) * d;
      const z = g.pos.z + Math.cos(a) * d;
      const r = Math.hypot(x, z);
      if (r < CFG.world.walls[0].r + 50 || CFG.world.walls.some((w) => Math.abs(r - w.r) < 24)) continue;
      if (this.world.solidAt(x, this.world.heightAt(x, z) + 2, z, 3)) continue;
      this.spawner.spawn(made === 2 ? 'runner' : 'normal', x, z, this).alert();
      made++;
    }
  }

  onPlayerHurt() {
    this.audio.hurt();
    this.hud.flash('#8a0f0f', 0.5, 0.45);
    this.shakeCam(0.7);
  }

  onPlayerGrabbed(g: Giant) {
    this.audio.hurt();
    this.hud.flash('#8a0f0f', 0.45, 0.5);
    this.shakeCam(0.8);
    this.hud.banner('YAKALANDIN', `${g.type.name} seni ağzına götürüyor — kurtul!`);
  }

  onBrokeFree(at: THREE.Vector3) {
    this.audio.hit();
    this.shakeCam(0.5);
    this.particles.burst(at, 30, 14, 0.8, 0xff5a4a, 1.5);
    this.hud.toast('Kurtuldun!');
  }

  onPlayerDied() {
    this.hud.banner('DÜŞTÜN', 'Birlik seni surlara geri taşıyor…');
  }

  // ---------------------------------------------------------------- döngü
  private frame(now: number) {
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (this.running) this.update(dt);
    else this.idleCamera(dt);
    this.updateEnvironment(dt);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame((t) => this.frame(t));
  }

  /** Gökyüzü, güneş gölgesi ve otlar oyuncuyu/kamerayı izler. */
  private updateEnvironment(dt: number) {
    const p = this.player.pos;
    this.skyTime += dt;
    this.world.sky.position.copy(this.camera.position);
    (this.world.sky.material as THREE.ShaderMaterial).uniforms.time.value = this.skyTime;
    // Gölge haritası titremesin diye merkez birkaç metrelik adımlarla kayar.
    const cx = Math.round(p.x / 6) * 6;
    const cz = Math.round(p.z / 6) * 6;
    const cy = Math.round(p.y / 6) * 6;
    this.sun.target.position.set(cx, cy, cz);
    this.sun.position.set(cx + SUN_DIR.x * 350, cy + SUN_DIR.y * 350, cz + SUN_DIR.z * 350);
    this.sun.target.updateMatrixWorld();
    this.grass.update(p.x, p.z);
  }

  /** Dinleyici, rüzgâr ve savaş müziği yoğunluğu. Yoğunluk saniyede birkaç kez yeniden hesaplanır. */
  private audioT = 0;
  private audioIntensity = 0;
  private updateAudio(dt: number) {
    const p = this.player;
    this.audioT -= dt;
    if (this.audioT <= 0) {
      this.audioT = 0.3;
      let chasing = 0;
      for (const g of this.giants) {
        if (!g.alive || g.state === 'wander' || g.state === 'downed') continue;
        if (Math.hypot(g.pos.x - p.pos.x, g.pos.z - p.pos.z) < 95) chasing++;
      }
      this.audioIntensity = p.dead ? 0 : combatIntensity({ chasing, boss: this.bossInView() !== null, grabbed: p.grabbedBy !== null, titan: p.mode === 'titan' });
    }
    const cam = this.camera.position;
    this.audio.frame({ x: cam.x, z: cam.z, yaw: this.camYaw }, p.mode === 'titan' ? 0 : p.vel.length(), this.audioIntensity, this.running);
  }

  private idleCamera(dt: number) {
    if (this.started) return;
    this.camYaw += dt * 0.04;
    this.camPitch = 0.12;
    this.updateCamera(dt);
  }

  /** Bir kare ilerletir. Testler için dışarıdan da çağrılabilir. */
  update(dt: number) {
    const inp = this.input;
    this.frameNo += 1;
    this.frameDt = dt;
    // Kamera: tekerlek sağa/sola çevirir (Shift ile yukarı/aşağı), orta tuşla sürükleme ve ok tuşları da çalışır.
    this.yawPending += inp.wheelYaw;
    this.pitchPending += inp.wheelPitch;
    inp.wheelYaw = 0;
    inp.wheelPitch = 0;
    const ease = 1 - Math.exp(-dt * 14);
    const yawStep = this.yawPending * ease;
    const pitchStep = this.pitchPending * ease;
    this.yawPending -= yawStep;
    this.pitchPending -= pitchStep;
    const keyTurn = (inp.down('ArrowLeft') ? 1 : 0) - (inp.down('ArrowRight') ? 1 : 0);
    const keyPitch = (inp.down('ArrowUp') ? 1 : 0) - (inp.down('ArrowDown') ? 1 : 0);
    // Fareyle yönlendirme: kilitliyken fare hareketi doğrudan çevirir; serbest imleçte
    // imleç ekranın ortasından ne kadar yana kayarsa kamera o yöne o kadar hızlı döner.
    let mouseYaw = 0;
    let mousePitch = 0;
    if (inp.locked) {
      mouseYaw = -inp.mouseDX * 0.0024;
      mousePitch = -inp.mouseDY * 0.0022;
    } else if (inp.inside) {
      const nx = (inp.mouseX / window.innerWidth) * 2 - 1;
      const over = Math.abs(nx) - CFG.camera.deadZone;
      if (over > 0) mouseYaw = -Math.sign(nx) * Math.pow(over / (1 - CFG.camera.deadZone), 1.4) * CFG.camera.edgeTurn * dt;
    }
    this.camYaw += mouseYaw - yawStep * 0.0024 - inp.dragDX * 0.005 + keyTurn * 1.8 * dt;
    this.camPitch = clamp(this.camPitch + mousePitch - pitchStep * 0.0016 - inp.dragDY * 0.004 + keyPitch * 1.2 * dt, -1.1, 1.2);
    if (this.lockHintT > 0) {
      this.lockHintT -= dt;
      if (this.lockHintT <= 0) {
        this.lockHintT = 0;
        this.hud.toast(inp.locked ? 'Fareyi hareket ettirerek yönünü değiştir' : 'Dönmek için imleci ekranın sağına ya da soluna götür');
      }
    }

    // Biriyle konuşurken tuşlar pencereye gider: oyuncu girdisi ve duraklatma o karede işlenmez.
    const talking = this.npcs.open !== null;
    if (talking) this.npcs.keys();
    else if (inp.pressed('KeyP') || inp.pressed('Escape')) {
      inp.endFrame();
      this.pause();
      return;
    }
    if (this.debug && !talking) this.debugKeys();

    let sdt = dt;
    if (this.slowT > 0) {
      this.slowT -= dt;
      sdt = dt * 0.25;
    }

    this.updateCursor();
    if (!talking) this.player.handleInput();
    const steps = Math.max(1, Math.ceil(sdt / (1 / 90)));
    const h = sdt / steps;
    for (let i = 0; i < steps; i++) this.player.step(h);
    for (const g of this.giants) g.update(sdt, this);
    this.horse.update(sdt, this);
    this.spawner.update(sdt, this);
    this.crates.update(sdt);
    this.stations.update(sdt, this);
    const gasRatio = this.player.gas / this.player.maxGas;
    if (gasRatio < CFG.gas.lowRatio && !this.lowGasWarned && this.player.mode !== 'titan') {
      this.lowGasWarned = true;
      this.hud.toast('Gaz azaldı — mavi bayraklı ikmal noktası bul');
    } else if (gasRatio > 0.5) this.lowGasWarned = false;
    const mt = this.player.moveTarget;
    this.marker.visible = mt !== null;
    if (mt) this.marker.position.set(mt.x, this.world.heightAt(mt.x, mt.z) + 0.15, mt.z);
    this.player.animate(sdt);
    this.particles.update(sdt);
    this.slashes.update(sdt);
    this.spears.update(sdt, this);
    this.boulders.update(sdt, this);
    this.cocoon.update(sdt, this);
    this.npcs.update(sdt);
    if (this.streakT > 0) {
      this.streakT -= dt;
      if (this.streakT <= 0) this.streak = 0;
    }
    this.updateAudio(dt);
    if (this.save.mode === 'story') this.story.update(dt);
    else this.quests.update();
    const wp = this.objectiveTarget();
    const wpOn = wp !== null && Math.hypot(wp[0] - this.player.pos.x, wp[1] - this.player.pos.z) > 16;
    this.waypoint.visible = wpOn;
    if (wp && wpOn) this.waypoint.position.set(wp[0], this.world.heightAt(wp[0], wp[1]) + 90, wp[1]);

    if (this.boltT > 0) {
      this.boltT -= dt;
      (this.bolt.material as THREE.MeshBasicMaterial).opacity = Math.max(0, this.boltT / 0.35);
      if (this.boltT <= 0) this.bolt.visible = false;
    }

    const z = zoneName(Math.hypot(this.player.pos.x, this.player.pos.z));
    if (z !== this.zone) {
      if (this.zone) this.hud.banner(z.split(' — ')[0], z.split(' — ')[1] ?? '');
      this.zone = z;
    }

    this.updateCamera(dt);
    if (this.frameNo % 2 === 0) this.aim = this.player.mode !== 'titan' && !this.player.dead ? this.player.grapple.aim(this) : null;
    this.hud.update(dt);
    if (this.frameNo % 2 === 0) this.minimap.draw();
    inp.endFrame();
  }

  private updateCamera(dt: number) {
    const p = this.player;
    const speed = p.vel.length();
    const want = p.mode === 'titan' ? p.titan.def.camDist : p.mode === 'mounted' ? 9.5 : 6.5 + Math.min(4, speed * 0.07);
    this.camDist = lerp(this.camDist, want, 1 - Math.exp(-dt * 4));
    const off = p.mode === 'titan' ? p.titan.def.height * 0.85 : p.mode === 'mounted' ? 2.3 : 1.7;
    target.set(p.pos.x, p.pos.y + off, p.pos.z);
    this.lookDir(look);
    const cam = this.camera;
    // Kamera sur ya da binanın içine girmesin: engele kadar yaklaş.
    const ox = -look.x;
    const oy = -look.y + 0.1;
    const oz = -look.z;
    let free = this.camDist;
    for (let s = 0.6; s < this.camDist; s += 0.4) {
      if (this.world.solidAt(target.x + ox * s, target.y + oy * s, target.z + oz * s)) {
        free = Math.max(0.8, s - 0.5);
        break;
      }
    }
    this.camEff = free < this.camEff ? free : Math.min(free, lerp(this.camEff, free, 1 - Math.exp(-dt * 6)));
    cam.position.set(target.x + ox * this.camEff, target.y + oy * this.camEff, target.z + oz * this.camEff);
    const minY = this.world.heightAt(cam.position.x, cam.position.z) + 0.6;
    if (cam.position.y < minY) cam.position.y = minY;
    if (this.shake > 0.001) {
      const s = this.shake * (p.mode === 'titan' ? 1.6 : 0.5);
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
      cam.position.z += (Math.random() - 0.5) * s;
      this.shake *= Math.exp(-dt * 6);
    }
    target.addScaledVector(look, 30);
    cam.lookAt(target);
    const fov = 70 + clamp(speed / 50, 0, 1) * 16;
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov = lerp(cam.fov, fov, 1 - Math.exp(-dt * 5));
      cam.updateProjectionMatrix();
    }
    cam.updateMatrixWorld();
  }

  private debugKeys() {
    const inp = this.input;
    const p = this.player;
    if (inp.pressed('Digit1')) this.meter.value = this.meter.max;
    if (inp.pressed('Digit2')) for (const id of TITAN_IDS) this.meter.addNeedle(id);
    if (inp.pressed('Digit3')) {
      p.pos.set(0, 0, CFG.world.walls[1].r - 260);
      p.vel.set(0, 0, 0);
    }
    if (inp.pressed('Digit4')) {
      this.lookDir(look);
      this.spawner.spawn('normal', p.pos.x + look.x * 30, p.pos.z + look.z * 30, this);
    }
    if (inp.pressed('Digit5')) this.grantXp(200);
    if (inp.pressed('Digit6')) this.grantCoins(500);
    if (inp.pressed('Digit7')) p.spears = p.maxSpears;
  }
}
