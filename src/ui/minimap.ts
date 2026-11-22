import type { Game } from '../game';
import { CFG } from '../data/config';
import { hex } from '../data/titans';
import { crateColor } from '../world/crates';
import { ARCS, DIRS, GIANT_FOREST, ROAD_END } from '../world/layout';

/** Metre cinsinden görüş yarıçapı: yakın ve geniş (M ya da haritaya dokunarak geçilir). */
const NEAR = 380;
const WIDE = 2400;

export class Minimap {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly size: number;
  private wide = false;

  /** Yakın görünüm ile bölgeyi gösteren geniş görünüm arasında geçer. */
  toggle() {
    this.wide = !this.wide;
    return this.wide;
  }

  constructor(
    private readonly game: Game,
    canvas: HTMLCanvasElement,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.size = canvas.width;
  }

  draw() {
    const g = this.game;
    const c = this.ctx;
    const S = this.size;
    const R = S / 2;
    const VIEW = this.wide ? WIDE : NEAR;
    const k = R / VIEW;
    const p = g.player.pos;
    const sin = Math.sin(g.camYaw);
    const cos = Math.cos(g.camYaw);
    // Dünya → harita: kamera yönü yukarı bakar.
    const map = (x: number, z: number): [number, number] => {
      const dx = x - p.x;
      const dz = z - p.z;
      const fwd = dx * sin + dz * cos;
      const right = -dx * cos + dz * sin;
      return [R + right * k, R - fwd * k];
    };

    c.clearRect(0, 0, S, S);
    c.save();
    c.beginPath();
    c.arc(R, R, R - 1, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = 'rgba(18,20,18,0.78)';
    c.fillRect(0, 0, S, S);

    // Dev ağaçlar ormanı
    if (Math.hypot(GIANT_FOREST.x - p.x, GIANT_FOREST.z - p.z) < VIEW + GIANT_FOREST.r) {
      const [fx, fy] = map(GIANT_FOREST.x, GIANT_FOREST.z);
      c.fillStyle = 'rgba(30,70,34,0.8)';
      c.beginPath();
      c.arc(fx, fy, GIANT_FOREST.r * k, 0, Math.PI * 2);
      c.fill();
    }

    // Yollar
    c.strokeStyle = 'rgba(140,120,90,0.6)';
    c.lineWidth = 2;
    c.beginPath();
    for (const a of DIRS) {
      c.moveTo(...map(Math.sin(a) * 200, Math.cos(a) * 200));
      c.lineTo(...map(Math.sin(a) * ROAD_END, Math.cos(a) * ROAD_END));
    }
    c.stroke();

    // Köyler
    c.fillStyle = '#9c7a52';
    for (const v of g.world.villages) {
      if (Math.hypot(v.x - p.x, v.z - p.z) > VIEW + 60) continue;
      const [x, y] = map(v.x, v.z);
      const s = Math.max(9, 90 * k);
      c.fillRect(x - s / 2, y - s / 2, s, s);
    }

    // Surlar, kapı kasabaları ve kapılar
    c.strokeStyle = '#b9b4a6';
    c.lineWidth = Math.max(2, CFG.world.wallT * k);
    for (const a of ARCS) {
      if (Math.hypot(a.cx - p.x, a.cz - p.z) > VIEW * 1.5 + a.r) continue;
      const full = a.half >= Math.PI;
      const n = full ? 96 : 24;
      c.beginPath();
      for (let i = 0; i <= n; i++) {
        const t = a.mid - a.half + (a.half * 2 * i) / n;
        const [x, y] = map(a.cx + Math.sin(t) * a.r, a.cz + Math.cos(t) * a.r);
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    }
    c.fillStyle = '#e8c36a';
    for (const a of ARCS) {
      for (const gt of a.gates) {
        const [gx, gy] = map(a.cx + Math.sin(gt) * a.r, a.cz + Math.cos(gt) * a.r);
        if (Math.abs(gx - R) > R || Math.abs(gy - R) > R) continue;
        c.fillRect(gx - 2.5, gy - 2.5, 5, 5);
      }
    }

    // Sur topları (yalnızca yakın görünümde)
    if (!this.wide) {
      c.fillStyle = '#3a3f46';
      c.strokeStyle = '#d8d2c2';
      c.lineWidth = 1;
      for (const gun of g.cannons.list) {
        if (Math.abs(gun.x - p.x) > VIEW || Math.abs(gun.z - p.z) > VIEW) continue;
        const [x, y] = map(gun.x, gun.z);
        c.beginPath();
        c.arc(x, y, 2.6, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }
    }

    // Kutular: Taktisyen hepsini, diğerleri yakındakileri görür.
    const seeAll = g.player.cls.id === 'taktisyen';
    for (const cr of g.crates.list) {
      if (cr.opened) continue;
      const d = Math.hypot(cr.x - p.x, cr.z - p.z);
      if (d > VIEW || (!seeAll && d > 150)) continue;
      const [x, y] = map(cr.x, cr.z);
      c.fillStyle = hex(crateColor(cr));
      c.fillRect(x - 2.5, y - 2.5, 5, 5);
    }

    // Gaz ikmal noktaları
    c.fillStyle = '#7fc8f0';
    for (const st of g.stations.list) {
      if (Math.hypot(st.x - p.x, st.z - p.z) > VIEW) continue;
      const [x, y] = map(st.x, st.z);
      c.beginPath();
      c.moveTo(x, y - 5);
      c.lineTo(x + 4, y + 3);
      c.lineTo(x - 4, y + 3);
      c.closePath();
      c.fill();
    }

    // Devler
    for (const gi of g.giants) {
      if (!gi.alive) continue;
      const [x, y] = map(gi.pos.x, gi.pos.z);
      c.fillStyle = gi.marked ? '#ff3b2f' : gi.form ? `#${gi.form.color.toString(16).padStart(6, '0')}` : gi.isElite ? '#e0733a' : '#c9564c';
      c.beginPath();
      c.arc(x, y, gi.heavy ? 6 : 2 + gi.h * 0.14, 0, Math.PI * 2);
      c.fill();
    }

    // Dost dönüşümcüler (Taç Soyu)
    for (const a of g.blood.allies) {
      const [x, y] = map(a.pos.x, a.pos.z);
      c.fillStyle = '#7fe08a';
      c.beginPath();
      c.arc(x, y, 5, 0, Math.PI * 2);
      c.fill();
    }

    // Sur içindeki kişiler
    for (const n of g.npcs.list) {
      if (Math.hypot(n.x - p.x, n.z - p.z) > VIEW) continue;
      const [x, y] = map(n.x, n.z);
      c.fillStyle = n.def.shop ? '#2ee6a6' : '#ffe07a';
      c.fillRect(x - 2.5, y - 2.5, 5, 5);
      c.strokeStyle = '#1a1612';
      c.lineWidth = 1;
      c.strokeRect(x - 2.5, y - 2.5, 5, 5);
    }

    // At
    const [hx, hy] = map(g.horse.pos.x, g.horse.pos.z);
    c.fillStyle = '#8fd18a';
    c.beginPath();
    c.arc(hx, hy, 3, 0, Math.PI * 2);
    c.fill();

    c.restore();

    // Görev hedefi: görüş dışındaysa kenara sabitlenir.
    const goal = g.objectiveTarget();
    if (goal) {
      let [x, y] = map(goal[0], goal[1]);
      const dx = x - R;
      const dy = y - R;
      const d = Math.hypot(dx, dy);
      if (d > R - 8) {
        x = R + (dx / d) * (R - 8);
        y = R + (dy / d) * (R - 8);
      }
      c.fillStyle = '#ffe07a';
      c.strokeStyle = '#3a2c10';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(x, y - 6);
      c.lineTo(x + 5, y);
      c.lineTo(x, y + 6);
      c.lineTo(x - 5, y);
      c.closePath();
      c.fill();
      c.stroke();
    }

    // Haritada konan işaret: görüş dışındaysa kenara sabitlenir.
    const mk = g.mark;
    if (mk) {
      let [x, y] = map(mk.x, mk.z);
      const dx = x - R;
      const dy = y - R;
      const d = Math.hypot(dx, dy);
      if (d > R - 8) {
        x = R + (dx / d) * (R - 8);
        y = R + (dy / d) * (R - 8);
      }
      c.fillStyle = '#5fd8ff';
      c.strokeStyle = '#0b2a36';
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(x, y - 6, 4.5, Math.PI, 0);
      c.lineTo(x, y + 1);
      c.closePath();
      c.fill();
      c.stroke();
    }

    // Gaz azaldıysa en yakın ikmal noktasının yönü kenarda gösterilir.
    if (g.player.gas / g.player.maxGas < CFG.gas.lowRatio * 1.5) {
      const near = g.stations.nearest(p.x, p.z).station;
      if (near) {
        let [x, y] = map(near.x, near.z);
        const dx = x - R;
        const dy = y - R;
        const d = Math.hypot(dx, dy);
        if (d > R - 8) {
          x = R + (dx / d) * (R - 8);
          y = R + (dy / d) * (R - 8);
          c.fillStyle = '#7fc8f0';
          c.strokeStyle = '#0e2a3a';
          c.lineWidth = 1.5;
          c.beginPath();
          c.arc(x, y, 5, 0, Math.PI * 2);
          c.fill();
          c.stroke();
        }
      }
    }

    // Oyuncu
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(R, R - 6);
    c.lineTo(R + 4.5, R + 5);
    c.lineTo(R - 4.5, R + 5);
    c.closePath();
    c.fill();

    c.strokeStyle = 'rgba(200,190,160,0.7)';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(R, R, R - 1, 0, Math.PI * 2);
    c.stroke();
  }
}
