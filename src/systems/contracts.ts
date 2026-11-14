import type { GiantKind } from '../enemies/giantTypes';

/** Öldürmenin biçimi: hızla kesip geçme, yukarıdan dalış, yerdeki devi bitirme. */
export type KillStyle = 'pass' | 'dive' | 'ground';

export type ContractEvent =
  | { type: 'kill'; giant: GiantKind; elite: boolean; by: 'blade' | 'titan' | 'spear'; style: KillStyle | null }
  | { type: 'crate'; content: string }
  | { type: 'streak'; n: number };

/** Sözleşmenin istediği şey. */
export type Need =
  | { kind: 'kill'; giant?: GiantKind; elite?: boolean; by?: 'blade' | 'titan' | 'spear'; style?: KillStyle }
  | { kind: 'crate'; content?: string }
  /** Belirli uzunlukta bir öldürme serisine ulaş (tek seferde tamamlanır). */
  | { kind: 'streak'; n: number };

export interface Reward {
  coins: number;
  spears?: number;
  /** 'random' kutu zarıyla seçilir. */
  needle?: 'ofke' | 'firtina' | 'kaya' | 'zirve' | 'isin' | 'buz' | 'random';
}

export interface Contract {
  id: string;
  title: string;
  text: string;
  goal: number;
  need: Need;
  reward: Reward;
}

/** Bir görev verenle olan durum: sıradaki sözleşme, alındı mı, ilerleme. */
export interface ContractState {
  index: number;
  active: boolean;
  progress: number;
}

export const newContractState = (): ContractState => ({ index: 0, active: false, progress: 0 });

/** Olayın sözleşmeye kattığı ilerleme. */
export function contractProgress(c: Contract, e: ContractEvent): number {
  const n = c.need;
  if (n.kind === 'kill') {
    if (e.type !== 'kill') return 0;
    if (n.giant && n.giant !== e.giant) return 0;
    if (n.elite && !e.elite) return 0;
    if (n.by && n.by !== e.by) return 0;
    if (n.style && n.style !== e.style) return 0;
    return 1;
  }
  if (n.kind === 'crate') return e.type === 'crate' && (!n.content || n.content === e.content) ? 1 : 0;
  return e.type === 'streak' && e.n >= n.n ? c.goal : 0;
}

/** Sıradaki sözleşme; liste bitince baştan döner. */
export function currentContract(list: Contract[], s: ContractState): Contract {
  return list[s.index % list.length];
}

/**
 * Olayı işler. Sözleşme tamamlandıysa onu döner ve durumu bir sonrakine ilerletir;
 * tamamlanmadıysa null döner.
 */
export function applyContractEvent(list: Contract[], s: ContractState, e: ContractEvent): Contract | null {
  if (!s.active || list.length === 0) return null;
  const c = currentContract(list, s);
  const inc = contractProgress(c, e);
  if (inc <= 0) return null;
  s.progress = Math.min(c.goal, s.progress + inc);
  if (s.progress < c.goal) return null;
  s.index += 1;
  s.active = false;
  s.progress = 0;
  return c;
}

/**
 * Kılıçla öldürmenin biçimi. Dev yerdeyse 'ground'; oyuncu ensenin üstünden hızla alçalıyorsa 'dive';
 * yatayda hızlı geçiyorsa 'pass'.
 */
export function killStyle(s: { lying: boolean; above: number; vy: number; speed: number }): KillStyle | null {
  if (s.lying) return 'ground';
  if (s.above > 0.2 && s.vy < -7) return 'dive';
  if (s.speed > 17) return 'pass';
  return null;
}
