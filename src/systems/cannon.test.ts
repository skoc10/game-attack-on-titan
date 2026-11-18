import { describe, expect, it } from 'vitest';
import { CFG } from '../data/config';
import { blastEffect, cannonSlots, flightTime, launchAngle } from './cannon';
import { districtAt, wallDist, wallTopAt } from '../world/layout';

const C = CFG.cannon;
const W = CFG.world;

describe('top yerleri', () => {
  const slots = cannonSlots();
  it('her surda çok sayıda top var, hepsi surun üstünde', () => {
    expect(slots.length).toBeGreaterThan(200);
    for (const s of slots) {
      expect(wallTopAt(s.x, s.z)).toBe(W.wallH);
      expect(wallDist(s.x, s.z)).toBeLessThan(W.wallT / 2);
    }
  });
  it('toplar dışa bakar ve kasabanın içine ateş etmez', () => {
    for (const s of slots) {
      const ahead = { x: s.x + Math.sin(s.face) * 40, z: s.z + Math.cos(s.face) * 40 };
      // Dışa bakmak: namlunun önündeki nokta surun gövdesinden uzaklaşır.
      expect(wallDist(ahead.x, ahead.z)).toBeGreaterThan(20);
      const d = districtAt(ahead.x, ahead.z);
      // Halka surdaki bir top kasabanın içine bakmaz; kasaba surundaki top kasabanın dışına bakar.
      if (d) expect(Math.hypot(s.x - d.x, s.z - d.z)).toBeLessThan(d.r + 8);
      expect(districtAt(s.x + Math.sin(s.face) * 60, s.z + Math.cos(s.face) * 60)).toBeNull();
    }
  });
  it('kapıların önü boş', () => {
    for (const w of W.walls) {
      for (const [x, z] of [[0, w.r], [w.r, 0], [0, -w.r], [-w.r, 0]]) {
        for (const s of slots) expect(Math.hypot(s.x - x, s.z - z)).toBeGreaterThan(W.gateHalfW + 10);
      }
    }
  });
});

describe('atış açısı', () => {
  it('aynı yükseklikte hedef: menzil hızın karesi bölü yerçekimi', () => {
    const max = (C.speed * C.speed) / C.gravity;
    expect(launchAngle(max * 0.999, 0)).toBeCloseTo(Math.PI / 4, 1);
    expect(launchAngle(max * 1.01, 0)).toBeNull();
  });
  it('bulunan açıyla atılan gülle hedefin hizasından geçer', () => {
    for (const [d, dy] of [[80, -50], [250, -45], [400, -30], [150, 10]]) {
      const a = launchAngle(d, dy)!;
      const t = flightTime(d, a);
      const y = C.speed * Math.sin(a) * t - 0.5 * C.gravity * t * t;
      expect(y).toBeCloseTo(dy, 3);
    }
  });
  it('surun dibine yakın hedefe namlu aşağı eğilir', () => {
    expect(launchAngle(40, -50)!).toBeLessThan(0);
  });
});

describe('patlama', () => {
  it('sıradan dev patlamanın içinde kalırsa ölür, dışındaysa etkilenmez', () => {
    expect(blastEffect(false, 30, 1, 4, 2)).toBe('kill');
    expect(blastEffect(false, 5, 1, 20, 2)).toBe('kill');
    expect(blastEffect(false, 40, 1, C.radius + 5, 2)).toBe('none');
  });
  it('bölüm sonu devi: ense yakınsa ense kesiği, gövdeye isabetse sendeler', () => {
    expect(blastEffect(true, 3, 1.5, 3, 4)).toBe('nape');
    expect(blastEffect(true, 25, 1.5, 6, 4)).toBe('stagger');
  });
});
