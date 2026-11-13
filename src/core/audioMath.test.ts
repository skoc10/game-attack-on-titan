import { describe, expect, it } from 'vitest';
import { combatIntensity, comboPitch, NORMAL_VOICES, rollVoice, spatial, voicePitch, WEIRD_VOICES } from './audioMath';

describe('ses hesapları', () => {
  it('büyük devin sesi daha kalındır ve sınırlar içinde kalır', () => {
    expect(voicePitch(4)).toBeGreaterThan(voicePitch(15));
    expect(voicePitch(15)).toBeGreaterThan(voicePitch(44));
    expect(voicePitch(0.1)).toBeLessThanOrEqual(300);
    expect(voicePitch(500)).toBeGreaterThanOrEqual(55);
  });

  it('ses uzaklaştıkça azalır, yarı uzaklıkta yarıya düşer', () => {
    const l = { x: 0, z: 0, yaw: 0 };
    expect(spatial(l, 0, 0, 30).gain).toBe(1);
    expect(spatial(l, 0, 30, 30).gain).toBeCloseTo(0.5);
    expect(spatial(l, 0, 300, 30).gain).toBeLessThan(0.02);
    expect(spatial(l, 0, 60, 30).gain).toBeLessThan(spatial(l, 0, 30, 30).gain);
  });

  it('kaynak hangi yandaysa ses o kulaktan gelir', () => {
    // yaw = 0: ileri +z, sağ -x (oyundaki D tuşu yönü).
    const l = { x: 0, z: 0, yaw: 0 };
    expect(spatial(l, -20, 0, 30).pan).toBeGreaterThan(0.5);
    expect(spatial(l, 20, 0, 30).pan).toBeLessThan(-0.5);
    expect(spatial(l, 0, 20, 30).pan).toBeCloseTo(0);
    // Dinleyici arkasını dönünce yanlar yer değiştirir.
    expect(spatial({ x: 0, z: 0, yaw: Math.PI }, -20, 0, 30).pan).toBeLessThan(-0.5);
    expect(spatial(l, 0, 0, 30).pan).toBe(0);
  });

  it('savaş yoğunluğu kovalayan devlerle artar; yakalanınca en üsttedir', () => {
    const calm = { chasing: 0, boss: false, grabbed: false, titan: false };
    expect(combatIntensity(calm)).toBe(0);
    expect(combatIntensity({ ...calm, chasing: 1 })).toBeGreaterThan(0);
    expect(combatIntensity({ ...calm, chasing: 3 })).toBeGreaterThan(combatIntensity({ ...calm, chasing: 1 }));
    expect(combatIntensity({ ...calm, chasing: 50 })).toBeLessThanOrEqual(1);
    expect(combatIntensity({ ...calm, boss: true })).toBeGreaterThanOrEqual(0.85);
    expect(combatIntensity({ ...calm, grabbed: true })).toBe(1);
    expect(combatIntensity({ ...calm, chasing: 4, titan: true })).toBe(1);
  });

  it('art arda öldürmede zafer notası yarım ses yükselir, bir oktavda durur', () => {
    expect(comboPitch(1)).toBe(1);
    expect(comboPitch(2)).toBeCloseTo(Math.pow(2, 1 / 12));
    expect(comboPitch(13)).toBeCloseTo(2);
    expect(comboPitch(40)).toBeCloseTo(2);
  });

  it('devlerin yaklaşık üçte biri tuhaf ses çıkarır', () => {
    let weird = 0;
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      for (let j = 0; j < 10; j++) {
        const v = rollVoice((i + 0.5) / 100, (j + 0.5) / 10);
        seen.add(v);
        if ((WEIRD_VOICES as readonly string[]).includes(v)) weird++;
      }
    }
    expect(weird).toBe(360);
    expect(seen.size).toBe(NORMAL_VOICES.length + WEIRD_VOICES.length);
    expect(rollVoice(0.99, 1)).toBe('growl'); // üst sınırda taşmaz
  });
});
