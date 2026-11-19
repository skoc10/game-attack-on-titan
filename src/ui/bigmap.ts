import type { Game } from '../game';
import { CFG } from '../data/config';
import { hex } from '../data/titans';
import { RAIDS } from '../data/raids';
import { crateColor } from '../world/crates';
import { ARCS, DIRS, DISTRICTS, ROAD_END } from '../world/layout';

const W = CFG.world;
/** Yakınlaştırma sınırları (ekran pikseli / metre). */
const MAX_SCALE = 3;
const ZONES = ['Demir Ova', 'Kalkan Ormanları', 'Sur Ötesi'];

/**
 * Tam ekran harita (M): sürükleyerek kaydırılır, tekerlekle ya da iki parmakla yakınlaştırılır.
 * Tıklanan yere işaret konur (sağ tık ya da işarete dokunmak kaldırır); oyun bu sırada durur.
 */
export class BigMap {
  open = false;
  private readonly root: HTMLDivElement;
  private readonly cvs: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  /** Ekranın ortasındaki dünya noktası ve ölçek. */
  private cx = 0;
  private cz = 0;
  private scale = 0.3;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private press: { x: number; y: number; button: number; moved: boolean } | null = null;
  private pinch: { d: number; scale: number } | null = null;
  private dirty = true;

  constructor(private readonly game: Game) {
    this.root = document.createElement('div');
    this.root.id = 'bigmap';
    this.root.innerHTML = `
      <canvas></canvas>
      <div class="bmTop"><b>HARİTA</b><span class="bmHelp"></span></div>
      <div class="bmBar">
        <button data-bm="center">Bana dön</button>
        <button data-bm="clear">İşareti kaldır</button>
        <button data-bm="close">Kapat ✕</button>
      </div>
      <div class="bmLegend">
        <span><i style="background:#ffffff"></i>Sen</span>
        <span><i style="background:#5fd8ff"></i>İşaret</span>
        <span><i style="background:#ffe07a"></i>Görev</span>
        <span><i style="background:#ff4a3a"></i>Baskın</span>
        <span><i style="background:#c9564c"></i>Dev</span>
        <span><i style="background:#9c7a52"></i>Köy</span>
        <span><i style="background:#7fc8f0"></i>Gaz</span>
        <span><i style="background:#8fd18a"></i>At</span>
      </div>`;
    document.body.appendChild(this.root);
    this.cvs = this.root.querySelector('canvas')!;
    this.ctx = this.cvs.getContext('2d')!;
    this.cvs.addEventListener('pointerdown', (e) => this.onDown(e));
    this.cvs.addEventListener('pointermove', (e) => this.onMove(e));
    this.cvs.addEventListener('pointerup', (e) => this.onUp(e));
    this.cvs.addEventListener('pointercancel', (e) => this.onUp(e, true));
    this.cvs.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    this.cvs.addEventListener('contextmenu', (e) => e.preventDefault());
    this.root.querySelector('.bmBar')!.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-bm]');
      if (!b) return;
      if (b.dataset.bm === 'close') this.hide();
      else if (b.dataset.bm === 'clear') this.game.clearMark();
      else this.centerOnPlayer();
      this.dirty = true;
    });
    window.addEventListener('resize', () => (this.dirty = true));
  }

  toggle() {
    if (this.open) this.hide();
    else this.show();
  }

  show() {
    const g = this.game;
    this.open = true;
    this.root.classList.add('show');
    this.root.querySelector('.bmHelp')!.textContent = g.input.touch
      ? 'sürükle: kaydır · iki parmak: yakınlaş · dokun: işaret koy · işarete dokun: kaldır'
      : 'sürükle: kaydır · tekerlek: yakınlaş · tıkla: işaret koy · sağ tık: işareti kaldır · M / Esc: kapat';
    this.centerOnPlayer();
    this.scale = Math.max(this.minScale(), 0.35);
    if (document.pointerLockElement) document.exitPointerLock();
    g.input.releaseAll();
    this.dirty = true;
  }

  hide() {
    if (!this.open) return;
    this.open = false;
    this.root.classList.remove('show');
    this.pointers.clear();
    this.press = null;
    this.pinch = null;
    const g = this.game;
    g.input.endFrame();
    if (g.running) g.input.requestLock();
  }

  private centerOnPlayer() {
    const p = this.game.player.pos;
    this.cx = p.x;
    this.cz = p.z;
  }

  private minScale() {
    return (Math.min(window.innerWidth, window.innerHeight) * 0.95) / W.size;
  }

  /** Harita açıkken her kare: kapatma tuşları ve klavyeyle kaydırma. */
  keys(dt: number) {
    const inp = this.game.input;
    if (inp.pressed('KeyM') || inp.pressed('Escape')) {
      this.hide();
      return;
    }
    const pan = (420 / this.scale) * dt;
    const kx = (inp.down('KeyA') || inp.down('ArrowLeft') ? 1 : 0) - (inp.down('KeyD') || inp.down('ArrowRight') ? 1 : 0);
    const kz = (inp.down('KeyW') || inp.down('ArrowUp') ? 1 : 0) - (inp.down('KeyS') || inp.down('ArrowDown') ? 1 : 0);
    if (kx || kz) {
      this.cx += kx * pan;
      this.cz += kz * pan;
      this.dirty = true;
    }
    if (inp.pressed('Equal') || inp.pressed('NumpadAdd')) this.zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1.4);
    if (inp.pressed('Minus') || inp.pressed('NumpadSubtract')) this.zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1 / 1.4);
    inp.wheelYaw = 0;
    inp.wheelPitch = 0;
    this.draw();
  }

  // ---------------------------------------------------------------- dönüşüm
  private toScreen(x: number, z: number): [number, number] {
    // Ekranın sağı dünyanın -x yönü, yukarısı +z yönü (oyunun başındaki bakış yönü).
    return [window.innerWidth / 2 - (x - this.cx) * this.scale, window.innerHeight / 2 - (z - this.cz) * this.scale];
  }
  private toWorld(sx: number, sy: number): [number, number] {
    return [this.cx - (sx - window.innerWidth / 2) / this.scale, this.cz - (sy - window.innerHeight / 2) / this.scale];
  }

  private zoomAt(sx: number, sy: number, k: number) {
    const [wx, wz] = this.toWorld(sx, sy);
    this.scale = Math.min(MAX_SCALE, Math.max(this.minScale(), this.scale * k));
    // İmlecin altındaki nokta yerinde kalsın.
    const [nx, ny] = this.toScreen(wx, wz);
    this.cx -= (sx - nx) / this.scale;
    this.cz -= (sy - ny) / this.scale;
    this.dirty = true;
  }

  // ---------------------------------------------------------------- girdi
  private onDown(e: PointerEvent) {
    e.preventDefault();
    try {
      this.cvs.setPointerCapture(e.pointerId);
    } catch {
      /* yakalama yoksa bırakma yine gelir */
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) this.press = { x: e.clientX, y: e.clientY, button: e.button, moved: false };
    else {
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), scale: this.scale };
      if (this.press) this.press.moved = true;
    }
  }

  private onMove(e: PointerEvent) {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    prev.x = e.clientX;
    prev.y = e.clientY;
    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const target = Math.min(MAX_SCALE, Math.max(this.minScale(), (this.pinch.scale * d) / Math.max(1, this.pinch.d)));
      this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, target / this.scale);
      this.cx += dx / this.scale / 2;
      this.cz += dy / this.scale / 2;
      return;
    }
    if (!this.press) return;
    if (Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > 6) this.press.moved = true;
    if (this.press.moved) {
      this.cx += dx / this.scale;
      this.cz += dy / this.scale;
      this.dirty = true;
    }
  }

  private onUp(e: PointerEvent, cancel = false) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    const pr = this.press;
    if (this.pointers.size > 0 || !pr) return;
    this.press = null;
    if (cancel || pr.moved) return;
    const g = this.game;
    const m = g.mark;
    if (pr.button === 2) {
      g.clearMark();
    } else if (m) {
      // İşaretin üstüne dokunmak/tıklamak onu kaldırır; başka yere tıklamak taşır.
      const [mx, my] = this.toScreen(m.x, m.z);
      if (Math.hypot(mx - e.clientX, my - e.clientY) < 16) g.clearMark();
      else g.setMark(...this.toWorld(e.clientX, e.clientY));
    } else g.setMark(...this.toWorld(e.clientX, e.clientY));
    this.dirty = true;
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    this.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
  }

  // ---------------------------------------------------------------- çizim
  private label(text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center') {
    const c = this.ctx;
    c.font = `600 ${size}px system-ui, sans-serif`;
    c.textAlign = align;
    c.textBaseline = 'middle';
    c.lineWidth = 3;
    c.strokeStyle = 'rgba(0,0,0,0.75)';
    c.strokeText(text, x, y);
    c.fillStyle = color;
    c.fillText(text, x, y);
  }

  draw() {
    if (!this.open) return;
    const g = this.game;
    // Oyun durduğu için yalnızca bir şey değişince yeniden çizilir (bir de arada bir).
    if (!this.dirty && g.frameNo % 15 !== 0) return;
    this.dirty = false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const Wd = window.innerWidth;
    const Ht = window.innerHeight;
    if (this.cvs.width !== Math.round(Wd * dpr) || this.cvs.height !== Math.round(Ht * dpr)) {
      this.cvs.width = Math.round(Wd * dpr);
      this.cvs.height = Math.round(Ht * dpr);
    }
    const c = this.ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = this.scale;
    const P = (x: number, z: number) => this.toScreen(x, z);
    c.fillStyle = '#141a14';
    c.fillRect(0, 0, Wd, Ht);

    // Bölgeler: dıştan içe, her surun içi biraz daha açık.
    const [ox, oy] = P(0, 0);
    const disc = (r: number, color: string) => {
      c.fillStyle = color;
      c.beginPath();
      c.arc(ox, oy, r * s, 0, Math.PI * 2);
      c.fill();
    };
    c.fillStyle = '#1b2318';
    const [ex, ey] = P(W.size / 2, W.size / 2);
    const [fx, fy] = P(-W.size / 2, -W.size / 2);
    c.fillRect(Math.min(ex, fx), Math.min(ey, fy), Math.abs(fx - ex), Math.abs(fy - ey));
    disc(W.walls[2].r, '#223020');
    disc(W.walls[1].r, '#2a3a24');
    disc(W.walls[0].r, '#3a3a30');

    // Kapı kasabaları
    c.fillStyle = '#4a4436';
    for (const d of DISTRICTS) {
      const [x, y] = P(d.x, d.z);
      c.beginPath();
      c.arc(x, y, d.r * s, 0, Math.PI * 2);
      c.fill();
    }

    // Yollar
    c.strokeStyle = '#6d5d45';
    c.lineWidth = Math.max(1.5, 13 * s);
    c.beginPath();
    for (const a of DIRS) {
      c.moveTo(...P(Math.sin(a) * 200, Math.cos(a) * 200));
      c.lineTo(...P(Math.sin(a) * ROAD_END, Math.cos(a) * ROAD_END));
    }
    c.stroke();

    // Köyler (baskın köyleri adıyla)
    const raidSite = g.raid.target;
    for (const v of g.world.villages) {
      const [x, y] = P(v.x, v.z);
      if (x < -40 || y < -40 || x > Wd + 40 || y > Ht + 40) continue;
      const sz = Math.max(5, 80 * s);
      c.fillStyle = '#9c7a52';
      c.fillRect(x - sz / 2, y - sz / 2, sz, sz);
    }

    // Surlar ve kapılar
    c.strokeStyle = '#d6cfbd';
    c.lineWidth = Math.max(2, W.wallT * s);
    for (const a of ARCS) {
      const full = a.half >= Math.PI;
      const n = full ? 180 : 32;
      c.beginPath();
      for (let i = 0; i <= n; i++) {
        const t = a.mid - a.half + (a.half * 2 * i) / n;
        const [x, y] = P(a.cx + Math.sin(t) * a.r, a.cz + Math.cos(t) * a.r);
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    }
    c.fillStyle = '#e8c36a';
    for (const a of ARCS) {
      for (const gt of a.gates) {
        const [x, y] = P(a.cx + Math.sin(gt) * a.r, a.cz + Math.cos(gt) * a.r);
        const q = Math.max(3, 22 * s);
        c.fillRect(x - q / 2, y - q / 2, q, q);
      }
    }

    // Sur topları (yakınken)
    if (s > 0.5) {
      c.fillStyle = '#3a3f46';
      for (const gun of g.cannons.list) {
        const [x, y] = P(gun.x, gun.z);
        if (x < 0 || y < 0 || x > Wd || y > Ht) continue;
        c.beginPath();
        c.arc(x, y, 2.5, 0, Math.PI * 2);
        c.fill();
      }
    }

    // Gaz ikmal noktaları
    c.fillStyle = '#7fc8f0';
    for (const st of g.stations.list) {
      const [x, y] = P(st.x, st.z);
      c.beginPath();
      c.moveTo(x, y - 6);
      c.lineTo(x + 5, y + 4);
      c.lineTo(x - 5, y + 4);
      c.closePath();
      c.fill();
    }

    // Kutular: Taktisyen hepsini, diğerleri yakındakileri görür.
    const p = g.player.pos;
    const seeAll = g.player.cls.id === 'taktisyen';
    for (const cr of g.crates.list) {
      if (cr.opened || (!seeAll && Math.hypot(cr.x - p.x, cr.z - p.z) > 150)) continue;
      const [x, y] = P(cr.x, cr.z);
      c.fillStyle = hex(crateColor(cr));
      c.fillRect(x - 3, y - 3, 6, 6);
    }

    // Kişiler (sur içinde)
    if (s > 0.6) {
      for (const n of g.npcs.list) {
        const [x, y] = P(n.x, n.z);
        c.fillStyle = n.def.shop ? '#2ee6a6' : '#ffe07a';
        c.fillRect(x - 3, y - 3, 6, 6);
      }
    }

    // Yakındaki devler (gözcülerin bildirdiği)
    for (const gi of g.giants) {
      if (!gi.alive || Math.hypot(gi.pos.x - p.x, gi.pos.z - p.z) > 600) continue;
      const [x, y] = P(gi.pos.x, gi.pos.z);
      c.fillStyle = gi.form ? `#${gi.form.color.toString(16).padStart(6, '0')}` : gi.isElite ? '#e0733a' : '#c9564c';
      c.beginPath();
      c.arc(x, y, Math.max(gi.heavy ? 5 : 3, gi.radius * s), 0, Math.PI * 2);
      c.fill();
    }

    // Yazılar: bölgeler, surlar, kasabalar
    if (s < 1.2) {
      ZONES.forEach((name, i) => {
        const r = i < 2 ? (W.walls[i].r + W.walls[i + 1].r) / 2 : W.walls[2].r + 700;
        const [x, y] = P(Math.sin(Math.PI * 0.62) * r, Math.cos(Math.PI * 0.62) * r);
        this.label(name.toLocaleUpperCase('tr'), x, y, 13, 'rgba(220,214,190,0.75)');
      });
      W.walls.forEach((w, i) => {
        const [x, y] = P(Math.sin(-Math.PI * 0.25) * w.r, Math.cos(-Math.PI * 0.25) * w.r);
        this.label(w.name, x, y - 12, i === 0 ? 11 : 12, '#efe8d2');
      });
    }
    if (s > 0.18) {
      for (const d of DISTRICTS) {
        const [x, y] = P(d.x, d.z);
        this.label(d.name, x, y, 11, '#e8dcb8');
      }
    }

    // At
    const [hx, hy] = P(g.horse.pos.x, g.horse.pos.z);
    c.fillStyle = '#8fd18a';
    c.beginPath();
    c.arc(hx, hy, 4, 0, Math.PI * 2);
    c.fill();

    // Görev hedefi
    const goal = g.objectiveTarget();
    if (goal && !raidSite) {
      const [x, y] = P(goal[0], goal[1]);
      c.fillStyle = '#ffe07a';
      c.strokeStyle = '#3a2c10';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(x, y - 8);
      c.lineTo(x + 7, y);
      c.lineTo(x, y + 8);
      c.lineTo(x - 7, y);
      c.closePath();
      c.fill();
      c.stroke();
    }

    // Sürmekte olan baskın
    if (raidSite) {
      const [x, y] = P(raidSite[0], raidSite[1]);
      const pulse = 10 + ((performance.now() / 60) % 14);
      c.strokeStyle = '#ff4a3a';
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(x, y, pulse, 0, Math.PI * 2);
      c.stroke();
      const name = RAIDS.find((r) => r.id === g.raid.id)?.name ?? 'Baskın';
      this.label(name, x, y - 24, 13, '#ff8a7a');
      this.dirty = true;
    }

    // İşaret: iğne ve uzaklık
    const m = g.mark;
    if (m) {
      const [x, y] = P(m.x, m.z);
      c.fillStyle = '#5fd8ff';
      c.strokeStyle = '#0b2a36';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(x, y - 14, 7, Math.PI, 0);
      c.lineTo(x, y);
      c.closePath();
      c.fill();
      c.stroke();
      const d = Math.hypot(m.x - p.x, m.z - p.z);
      this.label(d >= 1000 ? `${(d / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(d)} m`, x, y - 30, 12, '#bfefff');
      // Oyuncudan işarete kesikli çizgi
      const [px, py] = P(p.x, p.z);
      c.setLineDash([6, 6]);
      c.strokeStyle = 'rgba(95,216,255,0.6)';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(px, py);
      c.lineTo(x, y);
      c.stroke();
      c.setLineDash([]);
    }

    // Oyuncu: baktığı yöne dönük ok
    const [px, py] = P(p.x, p.z);
    const yaw = g.player.faceYaw;
    c.save();
    c.translate(px, py);
    c.rotate(-yaw); // ekranda yukarı +z, sağ -x: yön açısı tersine döner
    c.fillStyle = '#ffffff';
    c.strokeStyle = '#111';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(0, -9);
    c.lineTo(6.5, 7);
    c.lineTo(0, 3);
    c.lineTo(-6.5, 7);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();

    // Ölçek çubuğu
    const steps = [50, 100, 250, 500, 1000, 2000];
    const len = steps.find((m2) => m2 * s > 70) ?? 2000;
    const bx = 22;
    const by = Ht - 70;
    c.strokeStyle = '#e8e0c8';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(bx, by);
    c.lineTo(bx + len * s, by);
    c.moveTo(bx, by - 5);
    c.lineTo(bx, by + 5);
    c.moveTo(bx + len * s, by - 5);
    c.lineTo(bx + len * s, by + 5);
    c.stroke();
    this.label(len >= 1000 ? `${len / 1000} km` : `${len} m`, bx + (len * s) / 2, by - 12, 12, '#e8e0c8');
  }
}
