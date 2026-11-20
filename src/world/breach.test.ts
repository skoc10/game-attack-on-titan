import { afterEach, describe, expect, it } from 'vitest';
import { CFG } from '../data/config';
import { BOSSES } from '../enemies/giantTypes';
import { BREACHES, HALF_T, breachAtAngle, wallBetween, wallPush, wallSolid, wallTopAt } from './layout';
import { breachAngle, breachSpot } from './breaker';
import { FORMS } from '../data/titans';

const W = CFG.world;
const R = W.walls[2].r;
const A = Math.PI / 4;
const at = (r: number, a = A) => ({ x: Math.sin(a) * r, z: Math.cos(a) * r });

afterEach(() => {
  BREACHES.length = 0;
});

describe('surdaki gedik', () => {
  it('gedik açılınca sur gövdesi orada katı değildir: geçilir, üstü yoktur, darbe ulaşır', () => {
    const p = at(R + 2);
    expect(wallPush({ ...p }, 2, 0)).toBe(true);
    expect(wallSolid(p.x, 5, p.z, 0)).toBe(true);
    BREACHES.push({ ring: 2, ang: A, half: 17 / R });
    expect(breachAtAngle(2, A)).toBe(true);
    expect(wallPush({ ...p }, 2, 0)).toBe(false);
    expect(wallSolid(p.x, 5, p.z, 0)).toBe(false);
    expect(wallTopAt(p.x, p.z)).toBe(-Infinity);
    const o = at(R + 30);
    const i = at(R - 30);
    expect(wallBetween(o.x, o.z, i.x, i.z, 1)).toBe(false);
  });

  it('gediğin dışında sur sağlamdır; başka halkalar etkilenmez', () => {
    BREACHES.push({ ring: 2, ang: A, half: 17 / R });
    const side = at(R + 2, A + 40 / R);
    expect(wallSolid(side.x, 5, side.z, 0)).toBe(true);
    const inner = at(W.walls[1].r, A);
    expect(wallTopAt(inner.x, inner.z)).toBe(W.wallH);
    expect(HALF_T).toBeGreaterThan(0);
  });

  it('gedik kapılardan ve kasabalardan uzakta açılır', () => {
    for (const d of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const a = breachAngle(d + 0.02);
      expect(Math.abs(a - d)).toBeGreaterThanOrEqual(CFG.breaker.gateClear - 1e-9);
    }
    expect(breachAngle(A)).toBeCloseTo(A);
  });

  it('Demir Koç zırhlı, metal plakalı ve sur delen bir devdir', () => {
    const k = BOSSES.koc;
    expect(k.armored).toBe(true);
    expect(k.breaker).toBe(true);
    expect(k.plating).toBeDefined();
    expect(k.maxH).toBeLessThan(W.wallH);
  });

  it('Demir Koç formundaki oyuncu halka surların her birinde gedik açabilir; kapı kasabalarında ve açık gedikte açamaz', () => {
    for (let ring = 0; ring < 3; ring++) {
      const r = W.walls[ring].r;
      const p = at(r + HALF_T + 3);
      expect(breachSpot(p.x, p.z, 6)).toEqual({ ring, ang: expect.closeTo(A, 6) });
    }
    const far = at(R + 200);
    expect(breachSpot(far.x, far.z, 6)).toBeNull();
    const gate = at(R + HALF_T + 3, 0.01);
    expect(breachSpot(gate.x, gate.z, 6)).toBeNull();
    BREACHES.push({ ring: 2, ang: A, half: 13 / R });
    const p = at(R - HALF_T - 3);
    expect(breachSpot(p.x, p.z, 6)).toBeNull();
    expect(FORMS.koc.q.kind).toBe('rush');
  });
});
