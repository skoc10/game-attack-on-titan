import type { Game } from '../game';
import { CFG } from '../data/config';
import { hex } from '../data/titans';
import { crateColor } from '../world/crates';

const VIEW = 380; // metre cinsinden görüş yarıçapı

export class Minimap {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly size: number;

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

    // Surlar ve kapılar
    const [ox, oy] = map(0, 0);
    for (const w of CFG.world.walls) {
      c.strokeStyle = '#b9b4a6';
      c.lineWidth = Math.max(2, CFG.world.wallT * k);
      c.beginPath();
      c.arc(ox, oy, w.r * k, 0, Math.PI * 2);
      c.stroke();
      const [gx, gy] = map(0, w.r);
      c.fillStyle = '#e8c36a';
      c.fillRect(gx - 3, gy - 3, 6, 6);
    }
    // Yol
    c.strokeStyle = 'rgba(140,120,90,0.6)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(...map(0, 300));
    c.lineTo(...map(0, 2400));
    c.stroke();

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
      c.fillStyle = gi.marked ? '#ff3b2f' : gi.isElite ? '#e0733a' : '#c9564c';
      c.beginPath();
      c.arc(x, y, gi.type.kind === 'boss' ? 6 : 2 + gi.h * 0.14, 0, Math.PI * 2);
      c.fill();
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
