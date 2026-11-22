/**
 * Beceri ağacı: dev öldürerek kazanılan beceri puanlarıyla açılır (K). İki dal: Hareket ve Kılıç.
 * Bir beceriyi almak için puan yetmeli ve (varsa) önündeki beceri alınmış olmalı.
 */
export type SkillId = 'cevik' | 'nefes' | 'kacis' | 'kolkes' | 'girdap';
export const SKILL_IDS: SkillId[] = ['cevik', 'nefes', 'kacis', 'kolkes', 'girdap'];

export interface SkillDef {
  id: SkillId;
  name: string;
  desc: string;
  branch: 'Hareket' | 'Kılıç';
  cost: number;
  /** Önce alınması gereken beceri. */
  req: SkillId | null;
  /** Etkin becerinin tuşu (edilgenlerde yok). */
  key?: string;
}

export const SKILLS: Record<SkillId, SkillDef> = {
  cevik: { id: 'cevik', name: 'Çevik Adım', desc: 'Koşu, gaz itişi ve en yüksek hız %12 artar', branch: 'Hareket', cost: 3, req: null },
  nefes: { id: 'nefes', name: 'Derin Nefes', desc: 'Gaz %20 az tükenir', branch: 'Hareket', cost: 4, req: 'cevik' },
  kacis: { id: 'kacis', name: 'Kaçış', desc: 'X ile gittiğin yöne fırlarsın; bir an hiçbir darbe değmez', branch: 'Hareket', cost: 5, req: 'cevik', key: 'X' },
  kolkes: { id: 'kolkes', name: 'Kol Kesme', desc: 'Devin koluna vurursan kolları kopar: bir süre seni tutamaz, vuramaz', branch: 'Kılıç', cost: 4, req: null },
  girdap: { id: 'girdap', name: 'Girdap', desc: 'Z ile dönerek çevrendeki her devi kesersin', branch: 'Kılıç', cost: 6, req: 'kolkes', key: 'Z' },
};

/** Öldürülen devin verdiği beceri puanı: sıradan 1, seçkin 2, bölüm sonu devi 5. */
export function skillPointsFor(kind: { boss: boolean; elite: boolean }) {
  return kind.boss ? 5 : kind.elite ? 2 : 1;
}

/** Bu beceri şimdi alınabilir mi: alınmamış, önündeki alınmış, puan yetiyor. */
export function canLearn(s: { skills: SkillId[]; skillPts: number }, id: SkillId) {
  const d = SKILLS[id];
  return !s.skills.includes(id) && (d.req === null || s.skills.includes(d.req)) && s.skillPts >= d.cost;
}

/** Beceriyi alır; alınamıyorsa false döner ve hiçbir şey değişmez. */
export function learnSkill(s: { skills: SkillId[]; skillPts: number }, id: SkillId) {
  if (!canLearn(s, id)) return false;
  s.skillPts -= SKILLS[id].cost;
  s.skills.push(id);
  return true;
}
