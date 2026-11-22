import { describe, expect, it } from 'vitest';
import { SKILLS, SKILL_IDS, canLearn, learnSkill, skillPointsFor } from '../data/skills';
import { newSave, sanitizeSave } from './progression';
import { crateColor, rollContent } from '../world/crates';
import { CFG } from '../data/config';

describe('beceri ağacı', () => {
  it('öldürmek beceri puanı verir: sıradan 1, seçkin 2, bölüm sonu 5', () => {
    expect(skillPointsFor({ boss: false, elite: false })).toBe(1);
    expect(skillPointsFor({ boss: false, elite: true })).toBe(2);
    expect(skillPointsFor({ boss: true, elite: true })).toBe(5);
  });

  it('beceri ancak puan yeter ve önündeki alınmışsa alınır; aynı beceri iki kez alınmaz', () => {
    const s = { skills: [] as typeof SKILL_IDS, skillPts: 5 };
    expect(canLearn(s, 'girdap')).toBe(false); // önce Kol Kesme
    expect(learnSkill(s, 'kolkes')).toBe(true);
    expect(s.skillPts).toBe(5 - SKILLS.kolkes.cost);
    expect(learnSkill(s, 'kolkes')).toBe(false);
    expect(learnSkill(s, 'girdap')).toBe(false); // puan yetmez
    s.skillPts = 99;
    expect(learnSkill(s, 'girdap')).toBe(true);
    expect(learnSkill(s, 'kacis')).toBe(false); // önce Çevik Adım
    expect(learnSkill(s, 'cevik')).toBe(true);
    expect(learnSkill(s, 'kacis')).toBe(true);
    expect(learnSkill(s, 'nefes')).toBe(true);
    expect(s.skills).toHaveLength(SKILL_IDS.length);
  });

  it('kayıt bilinmeyen ve önü alınmamış becerileri atar', () => {
    const sv = sanitizeSave({ ...newSave(), skills: ['girdap', 'cevik', 'uç', 'kacis'], skillPts: 7 });
    expect(sv.skills).toEqual(['cevik', 'kacis']);
    expect(sv.skillPts).toBe(7);
    expect(newSave().skills).toEqual([]);
  });

  it('girdap, kaçış, hız ve kol kesme ağaçta; etkinlerin tuşu var', () => {
    expect(SKILLS.girdap.key).toBe('Z');
    expect(SKILLS.kacis.key).toBe('X');
    expect(CFG.skills.cevik).toBeGreaterThan(1);
    expect(CFG.skills.nefes).toBeLessThan(1);
    expect(CFG.skills.armRegrow).toBeGreaterThan(5);
  });
});

describe('işaret fişeği', () => {
  it('sandıklardan çıkar ve kendi ışık rengi vardır', () => {
    let n = 0;
    for (let i = 0; i < 1000; i++) if (rollContent((i + 0.5) / 1000) === 'flare') n++;
    expect(n).toBeGreaterThan(20);
    expect(crateColor({ content: 'flare', form: 'ofke' })).toBe(0xff3a1a);
    expect(CFG.flare.radius).toBeGreaterThan(100);
    expect(CFG.flare.burn).toBeGreaterThan(5);
  });
});
