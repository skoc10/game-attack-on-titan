import { describe, expect, it } from 'vitest';
import { CFG } from '../data/config';
import { CHAPTERS, missionCount, type Objective } from '../data/story';
import { TITAN_IDS } from '../data/titans';
import { BOSSES, GIANT_TYPES } from '../enemies/giantTypes';
import { newSave, sanitizeSave } from './progression';
import { clampProgress, goal, missionAt, missionsDone, needleFor, nextStep, progressFor, storyDone, type StoryEvent } from './storyRules';

const kill = (over: Partial<Extract<StoryEvent, { type: 'kill' }>> = {}): StoryEvent => ({
  type: 'kill',
  giant: 'normal',
  by: 'blade',
  form: null,
  tag: '',
  ...over,
});

describe('hikâye kuralları', () => {
  it('öldürme adımı yalnızca istenen biçimdeki öldürmeleri sayar', () => {
    const any: Objective = { kind: 'kill', text: '', count: 2 };
    const blade: Objective = { kind: 'kill', text: '', count: 2, by: 'blade' };
    const form: Objective = { kind: 'kill', text: '', count: 3, form: 'firtina' };
    const tagged: Objective = { kind: 'kill', text: '', count: 1, tag: 'suru', giant: 'runner' };
    expect(progressFor(any, kill())).toBe(1);
    expect(progressFor(blade, kill())).toBe(1);
    expect(progressFor(blade, kill({ by: 'titan', form: 'ofke' }))).toBe(0);
    expect(progressFor(form, kill({ by: 'titan', form: 'ofke' }))).toBe(0);
    expect(progressFor(form, kill({ by: 'titan', form: 'firtina' }))).toBe(1);
    expect(progressFor(tagged, kill({ giant: 'runner' }))).toBe(0); // etiketsiz: görev devi değil
    expect(progressFor(tagged, kill({ giant: 'normal', tag: 'suru' }))).toBe(0);
    expect(progressFor(tagged, kill({ giant: 'runner', tag: 'suru' }))).toBe(1);
    expect(goal(form)).toBe(3);
  });

  it('konum, iğne ve dönüşüm adımları doğru olayla ilerler', () => {
    const reach: Objective = { kind: 'reach', text: '', at: [0, 600], radius: 50 };
    const beyond: Objective = { kind: 'beyond', text: '', r: 320 };
    const needle: Objective = { kind: 'needle', text: '', form: 'kaya' };
    const anyForm: Objective = { kind: 'transform', text: '' };
    const zirve: Objective = { kind: 'transform', text: '', form: 'zirve' };
    expect(progressFor(reach, { type: 'pos', x: 30, z: 580 })).toBe(1);
    expect(progressFor(reach, { type: 'pos', x: 60, z: 600 })).toBe(0);
    expect(progressFor(beyond, { type: 'pos', x: 0, z: 319 })).toBe(0);
    expect(progressFor(beyond, { type: 'pos', x: 230, z: -230 })).toBe(1);
    expect(progressFor(needle, { type: 'needle', form: 'ofke' })).toBe(0);
    expect(progressFor(needle, { type: 'needle', form: 'kaya' })).toBe(1);
    expect(progressFor(anyForm, { type: 'transform', form: 'firtina' })).toBe(1);
    expect(progressFor(zirve, { type: 'transform', form: 'firtina' })).toBe(0);
    expect(progressFor(reach, kill())).toBe(0);
    expect(goal(reach)).toBe(1);
  });

  it('hangi adımın iğne gerektirdiği bilinir', () => {
    expect(needleFor({ kind: 'transform', text: '' })).toBe('any');
    expect(needleFor({ kind: 'transform', text: '', form: 'kaya' })).toBe('kaya');
    expect(needleFor({ kind: 'kill', text: '', count: 1, by: 'titan' })).toBe('any');
    expect(needleFor({ kind: 'kill', text: '', count: 1, form: 'zirve' })).toBe('zirve');
    expect(needleFor({ kind: 'kill', text: '', count: 1, by: 'blade' })).toBeNull();
    expect(needleFor({ kind: 'station', text: '' })).toBeNull();
  });

  it('görevler sırayla ilerler, sezon bitince sonrakine geçilir', () => {
    let p = { chapter: 0, mission: 0 };
    let steps = 0;
    while (!storyDone(p)) {
      expect(missionAt(p)).not.toBeNull();
      expect(missionsDone(p)).toBe(steps);
      p = nextStep(p);
      steps += 1;
    }
    expect(steps).toBe(missionCount());
    expect(p).toEqual({ chapter: CHAPTERS.length, mission: 0 });
    expect(missionAt(p)).toBeNull();
    expect(nextStep(p)).toEqual(p);
    expect(missionsDone(p)).toBe(missionCount());
  });

  it('kayıttaki konum geçerli bir göreve sabitlenir', () => {
    expect(clampProgress(-3, 2)).toEqual({ chapter: 0, mission: 2 });
    expect(clampProgress(1, 99)).toEqual({ chapter: 1, mission: CHAPTERS[1].missions.length - 1 });
    expect(clampProgress(99, 4)).toEqual({ chapter: CHAPTERS.length, mission: 0 });
    expect(newSave().mode).toBe('story');
    const s = sanitizeSave({ mode: 'free', story: { chapter: 2, mission: 1 }, storyMax: 1 });
    expect(s.mode).toBe('free');
    expect(s.story).toEqual({ chapter: 2, mission: 1 });
    expect(s.storyMax).toBe(2); // ulaşılan sezon, bulunulan sezondan geride olamaz
    expect(sanitizeSave({ level: 3 }).story).toEqual({ chapter: 0, mission: 0 }); // eski kayıt
  });
});

describe('hikâye içeriği', () => {
  const missions = CHAPTERS.flatMap((c) => c.missions);

  it('beş sezon var ve her görevin kimliği benzersiz', () => {
    expect(CHAPTERS).toHaveLength(5);
    const ids = missions.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of missions) {
      expect(m.objectives.length).toBeGreaterThan(0);
      expect(m.intro.length).toBeGreaterThan(0);
      expect(m.xp).toBeGreaterThan(0);
    }
  });

  it('etiketli her öldürme adımının, vaktinde doğan yeterli devi vardır', () => {
    for (const m of missions) {
      m.objectives.forEach((o, i) => {
        if (o.kind !== 'kill' || !o.tag) return;
        const grp = m.spawns?.find((s) => s.tag === o.tag);
        expect(grp, `${m.id}: ${o.tag}`).toBeDefined();
        expect(grp!.on).toBeLessThanOrEqual(i);
        if (grp!.boss) {
          expect(o.count).toBe(1);
          expect(BOSSES[grp!.boss]).toBeDefined();
          if (grp!.boss !== 'gate') expect(grp!.at).toBeDefined();
        } else {
          expect(grp!.kinds!.length).toBeGreaterThanOrEqual(o.count);
          for (const k of grp!.kinds!) expect(GIANT_TYPES[k].kind).not.toBe('boss');
          if (o.giant) expect(grp!.kinds).toContain(o.giant);
        }
      });
      for (const s of m.spawns ?? []) {
        expect(m.objectives.some((o) => o.kind === 'kill' && o.tag === s.tag), `${m.id}: ${s.tag}`).toBe(true);
      }
    }
  });

  it('hedef noktalar şehrin dışında, sur gövdesinden uzakta ve harita içindedir', () => {
    const W = CFG.world;
    const clear = (x: number, z: number) => {
      const r = Math.hypot(x, z);
      expect(r).toBeGreaterThan(W.walls[0].r);
      expect(r).toBeLessThan(W.size / 2 - 100);
      for (const w of W.walls) expect(Math.abs(r - w.r)).toBeGreaterThan(W.wallT + 30);
    };
    for (const m of missions) {
      for (const o of m.objectives) if (o.kind === 'reach') clear(o.at[0], o.at[1]);
      for (const s of m.spawns ?? []) if (s.at) clear(s.at[0], s.at[1]);
    }
  });

  it('dört miras formu hikâyede öğretilir ve bölüm sonu devleri giderek büyür', () => {
    const forms = new Set(missions.flatMap((m) => m.objectives.flatMap((o) => (o.kind === 'needle' ? [o.form] : []))));
    for (const id of ['ofke', 'firtina', 'kaya', 'zirve'] as const) expect(forms.has(id)).toBe(true);
    for (const f of forms) expect(TITAN_IDS).toContain(f);
    expect(BOSSES.gate.maxH).toBeLessThan(BOSSES.bekci.maxH);
    expect(BOSSES.bekci.maxH).toBeLessThan(BOSSES.kadim.maxH);
    expect(BOSSES.kadim.napeCuts).toBeGreaterThan(BOSSES.gate.napeCuts);
  });
});
