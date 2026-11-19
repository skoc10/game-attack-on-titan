import type { RaidDef } from '../data/raids';

export type RaidPhase = 'prep' | 'wave' | 'rest' | 'won' | 'lost';
export type RaidEvent = { type: 'wave'; index: number } | { type: 'won' } | { type: 'lost' };

/**
 * Baskının akışı (oyundan bağımsız): hazırlık → dalga → nefes → … → son dalga temizlenince zafer.
 * Savunulan yerin sağlamlığı (köy ya da sur) biterse baskın kaybedilir.
 */
export class RaidState {
  phase: RaidPhase = 'prep';
  /** Sürmekte olan dalganın sırası (hazırlıkta -1). */
  wave = -1;
  integrity = 100;
  /** Hazırlık ya da nefes için kalan süre. */
  t: number;

  constructor(readonly def: RaidDef) {
    this.t = def.prep;
  }

  get over() {
    return this.phase === 'won' || this.phase === 'lost';
  }

  get lastWave() {
    return this.wave >= this.def.waves.length - 1;
  }

  /** `alive`: dalganın hâlâ ayakta olan devleri (sur baskınında yalnızca yıkıcı sayılır). */
  tick(dt: number, alive: number): RaidEvent[] {
    if (this.over) return [];
    if (this.phase === 'prep' || this.phase === 'rest') {
      this.t -= dt;
      if (this.t > 0) return [];
      this.wave += 1;
      this.phase = 'wave';
      return [{ type: 'wave', index: this.wave }];
    }
    if (alive > 0) return [];
    if (this.lastWave) {
      this.phase = 'won';
      return [{ type: 'won' }];
    }
    this.phase = 'rest';
    this.t = this.def.rest;
    return [];
  }

  /** Savunulan yer hasar aldı; sağlamlık biterse baskın kaybedilir. */
  damage(amount: number): RaidEvent[] {
    if (this.over || amount <= 0) return [];
    this.integrity = Math.max(0, this.integrity - amount);
    if (this.integrity > 0) return [];
    this.phase = 'lost';
    return [{ type: 'lost' }];
  }

  /** Oyuncu baskın bölgesini terk etti ya da baskından çekildi. */
  fail(): RaidEvent[] {
    if (this.over) return [];
    this.phase = 'lost';
    return [{ type: 'lost' }];
  }
}

/** Köy baskınında devin bir vuruşunun sağlamlıktan götürdüğü: iri devler daha çok yıkar. */
export function smashDamage(height: number, siege: boolean) {
  return siege ? 4.5 : 0.5 + height * 0.065;
}
