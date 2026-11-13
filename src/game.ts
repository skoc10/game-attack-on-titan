import * as THREE from 'three';
import { CFG } from './data/config';
import { Input } from './core/input';
import { GameAudio } from './core/audio';
import { Particles } from './core/particles';
import { clearSave, loadSave, storeSave } from './core/save';
import { clamp, lerp } from './core/rng';
import { World } from './world/world';
import { Crates, type Crate } from './world/crates';
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
import { addXp, classUnlocked, CLASS_UNLOCK, newSave, type ClassId, type SaveData } from './systems/progression';
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
  readonly player: Player;
  readonly horse: Horse;
  readonly crates: Crates;
  readonly stations: Stations;
  readonly grass: Grass;
  private readonly sun: THREE.DirectionalLight;
  private skyTime = 0;
  readonly spawner = new Spawner();
  readonly quests: QuestLog;
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
    this.player = new Player(this);
    this.horse = new Horse(this, CFG.player.spawn.x + 4, CFG.player.spawn.z + 2);
    this.crates = new Crates(this.scene, this.world.villages);
    this.stations = new Stations(this.scene, this.world);
    this.grass = new Grass(this.scene, this.world);
    this.quests = new QuestLog(this);
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

  loadoutChanged() {
    this.loadoutDirty = true;
    storeSave(this.save);
  }

  resetProgress() {
    clearSave();
    this.save = newSave();
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
    this.meter.addKill(g.type.meter, 1 + 0.15 * this.save.upgrades.meter);
    this.audio.kill();
    if (source === 'blade') this.slowT = 0.16;
    this.shakeCam(0.35);
    this.hud.toast(`${g.type.name} öldürüldü  +${g.type.xp} XP`);
    if (g.type.kind === 'boss') {
      this.save.bossDefeated = true;
      this.meter.value = this.meter.max;
      this.hud.banner('KAPI KIRAN DÜŞTÜ', 'Demir Sur kapısı yeniden açık');
    }
    this.grantXp(g.type.xp);
  }

  onCrateOpened(c: Crate) {
    const p = this.player;
    this.audio.pickup();
    let color = 0xffd070;
    if (c.content === 'needle') {
      const def = TITANS[c.form];
      const first = this.meter.needles[c.form] === 0;
      this.meter.addNeedle(c.form);
      this.stats.needlesFound += 1;
      color = def.color;
      this.hud.toast(`${def.needle} bulundu → ${def.name}`);
      if (first && this.meter.totalNeedles > 1) this.hud.toast('Tab ile hangi deve dönüşeceğini seç');
    } else if (c.content === 'gas') {
      p.gas = p.maxGas;
      this.hud.toast('Gaz tüpleri dolduruldu');
    } else {
      p.blades = p.maxBlades;
      this.hud.toast('Yeni kılıçlar takıldı');
    }
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

    if (inp.pressed('KeyP') || inp.pressed('Escape')) {
      inp.endFrame();
      this.pause();
      return;
    }
    if (this.debug) this.debugKeys();

    let sdt = dt;
    if (this.slowT > 0) {
      this.slowT -= dt;
      sdt = dt * 0.25;
    }

    this.updateCursor();
    this.player.handleInput();
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
    this.quests.update();

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
  }
}
