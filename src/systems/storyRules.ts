import { CHAPTERS, type Chapter, type Mission, type Objective } from '../data/story';
import type { FormId, TitanId } from '../data/titans';
import type { GiantKind } from '../enemies/giantTypes';

/** Hikâyede nerede olunduğu: sezon ve o sezondaki görev. Tüm sezonlar bitince chapter = CHAPTERS.length. */
export interface StoryProgress {
  chapter: number;
  mission: number;
}

export type StoryEvent =
  | { type: 'kill'; giant: GiantKind; by: 'blade' | 'titan'; form: FormId | null; tag: string }
  | { type: 'needle'; form: TitanId }
  | { type: 'transform'; form: FormId }
  | { type: 'mount' }
  | { type: 'station' }
  | { type: 'pos'; x: number; z: number };

/** Adımın tamamlanması için gereken ilerleme. */
export function goal(o: Objective) {
  return o.kind === 'kill' ? o.count : 1;
}

/** Olayın adıma kattığı ilerleme (0 ya da 1). */
export function progressFor(o: Objective, e: StoryEvent): number {
  switch (o.kind) {
    case 'kill':
      return e.type === 'kill' &&
        (!o.tag || o.tag === e.tag) &&
        (!o.giant || o.giant === e.giant) &&
        (!o.by || o.by === e.by) &&
        (!o.form || o.form === e.form)
        ? 1
        : 0;
    case 'needle':
      return e.type === 'needle' && e.form === o.form ? 1 : 0;
    case 'transform':
      return e.type === 'transform' && (!o.form || o.form === e.form) ? 1 : 0;
    case 'mount':
      return e.type === 'mount' ? 1 : 0;
    case 'station':
      return e.type === 'station' ? 1 : 0;
    case 'reach':
      return e.type === 'pos' && Math.hypot(e.x - o.at[0], e.z - o.at[1]) < o.radius ? 1 : 0;
    case 'beyond':
      return e.type === 'pos' && Math.hypot(e.x, e.z) > o.r ? 1 : 0;
  }
}

/** Adımı yapabilmek için oyuncunun elinde olması gereken iğne: belirli bir tür, herhangi biri ya da hiçbiri. */
export function needleFor(o: Objective): TitanId | 'any' | null {
  if (o.kind === 'transform') return o.form ?? 'any';
  if (o.kind === 'kill') return o.form ?? (o.by === 'titan' ? 'any' : null);
  return null;
}

export function storyDone(p: StoryProgress, chapters: Chapter[] = CHAPTERS) {
  return p.chapter >= chapters.length;
}

export function chapterAt(p: StoryProgress, chapters: Chapter[] = CHAPTERS): Chapter | null {
  return chapters[p.chapter] ?? null;
}

export function missionAt(p: StoryProgress, chapters: Chapter[] = CHAPTERS): Mission | null {
  return chapters[p.chapter]?.missions[p.mission] ?? null;
}

/** Bir sonraki görev; sezonun son göreviyse sonraki sezonun ilki. */
export function nextStep(p: StoryProgress, chapters: Chapter[] = CHAPTERS): StoryProgress {
  const c = chapters[p.chapter];
  if (!c) return { chapter: chapters.length, mission: 0 };
  if (p.mission + 1 < c.missions.length) return { chapter: p.chapter, mission: p.mission + 1 };
  return { chapter: p.chapter + 1, mission: 0 };
}

/** Kayıttan gelen konumu geçerli bir göreve sabitler. */
export function clampProgress(chapter: number, mission: number, chapters: Chapter[] = CHAPTERS): StoryProgress {
  const c = Math.max(0, Math.min(chapters.length, Math.floor(chapter) || 0));
  const ch = chapters[c];
  if (!ch) return { chapter: chapters.length, mission: 0 };
  return { chapter: c, mission: Math.max(0, Math.min(ch.missions.length - 1, Math.floor(mission) || 0)) };
}

/** Tamamlanan görev sayısı (menüdeki ilerleme için). */
export function missionsDone(p: StoryProgress, chapters: Chapter[] = CHAPTERS) {
  let n = 0;
  for (let i = 0; i < Math.min(p.chapter, chapters.length); i++) n += chapters[i].missions.length;
  return n + (chapters[p.chapter] ? p.mission : 0);
}
