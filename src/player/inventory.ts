import type { Game } from '../game';
import { CFG } from '../data/config';
import { hex, TITAN_IDS, TITANS } from '../data/titans';
import { storeSave } from '../core/save';
import { addSargi, gainHood, takeSargi, toggleHood } from '../systems/inventory';

export interface InvRow {
  key: string;
  name: string;
  sub: string;
  /** Sağdaki durum yazısı (giyili, ×2 …). */
  tag: string;
  off: boolean;
  color: string;
}

export interface InvView {
  rows: InvRow[];
  /** Kullanılamayan, yalnızca gösterilen eşyalar. */
  gear: { name: string; value: string; color: string }[];
}

/**
 * Çanta: `I` ile açılır. Açıkken oyun sürer, oyuncu yürüyebilir; rakam tuşları eşyaları kullanır.
 * Sargı her zaman `H` ile de kullanılabilir.
 */
export class Inventory {
  open = false;

  constructor(private readonly game: Game) {}

  private get inv() {
    return this.game.save.inv;
  }

  /** Her kare: I açar/kapatır; açıkken 1 kapşonu giyer/çıkarır, 2 sargı kullanır. */
  keys() {
    const g = this.game;
    const inp = g.input;
    if (inp.pressed('KeyH')) this.useSargi();
    if (inp.pressed('KeyI')) {
      this.open = !this.open;
      g.audio.pickup();
    }
    if (!this.open) return;
    if (inp.pressed('Escape')) {
      this.open = false;
      return;
    }
    if (inp.pressed('Digit1')) this.toggleHood();
    if (inp.pressed('Digit2')) this.useSargi();
  }

  toggleHood() {
    const g = this.game;
    if (!toggleHood(this.inv)) {
      g.hud.toast('Kapşonun yok — koyu yeşil ışıklı sandığı bul');
      return;
    }
    g.audio.hook();
    g.hud.toast(this.inv.wear ? 'Kapşonu giydin — devler seni ancak yakından fark eder' : 'Kapşonu çıkardın');
    storeSave(g.save);
  }

  useSargi() {
    const g = this.game;
    const p = g.player;
    if (p.dead) return;
    if (p.mode === 'titan') {
      g.hud.toast('Dev formunda sargı işe yaramaz');
      return;
    }
    if (p.grabbedBy) return;
    if (p.hp >= p.maxHp) {
      g.hud.toast('Canın dolu');
      return;
    }
    if (!takeSargi(this.inv)) {
      g.hud.toast('Sargın yok — pembe ışıklı sandıklardan ya da Nuran’dan bul');
      return;
    }
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * CFG.crate.medicHeal);
    g.audio.pickup();
    g.particles.burst(p.pos.clone().setY(p.pos.y + 1), 20, 4, 0.9, 0xff9ab4, 0.8, 3);
    g.hud.toast(`Yaralarını sardın — kalan sargı ${this.inv.sargi}`);
    storeSave(g.save);
  }

  /** Sandık ya da tezgâhtan gelen sargı. Çanta doluysa hemen kullanılır. */
  giveSargi(n = 1) {
    const g = this.game;
    const p = g.player;
    const got = addSargi(this.inv, n);
    if (got > 0) g.hud.toast(`Sargı çantaya kondu (${this.inv.sargi}/${CFG.inv.sargiMax}) — H ile kullan`);
    if (got < n) {
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * CFG.crate.medicHeal);
      g.hud.toast('Çanta dolu — sargıyı hemen sardın');
    }
    storeSave(g.save);
  }

  /** Kapşon sandığı açıldı. */
  giveHood() {
    const g = this.game;
    if (gainHood(this.inv) === 'new') {
      g.hud.banner('ORMAN KAPŞONU', 'Devler seni ancak yakından fark eder · I ile çanta');
      g.audio.levelUp();
    } else {
      g.grantCoins(CFG.crate.coins);
      g.hud.toast(`Yedek kapşon — Nuran’a sattın: +${CFG.crate.coins} av puanı`);
    }
    storeSave(g.save);
  }

  view(): InvView | null {
    if (!this.open) return null;
    const g = this.game;
    const p = g.player;
    const inv = this.inv;
    const pct = Math.round((1 - CFG.hood.sight) * 100);
    const rows: InvRow[] = [
      {
        key: '1',
        name: 'Orman Kapşonu',
        sub: inv.hood
          ? `Devler seni %${pct} daha yakından fark eder. Saldırınca ${CFG.hood.reveal} sn görünür olursun; dev formunda işe yaramaz.`
          : 'Henüz yok — koyu yeşil ışıklı sandıklardan çıkar.',
        tag: !inv.hood ? 'YOK' : inv.wear ? 'GİYİLİ' : 'ÇANTADA',
        off: !inv.hood,
        color: '#2f9a4e',
      },
      {
        key: '2',
        name: 'Sargı',
        sub: `Canın %${Math.round(CFG.crate.medicHeal * 100)}’ını doldurur. Her zaman H ile de kullanılır.`,
        tag: `×${inv.sargi}/${CFG.inv.sargiMax}`,
        off: inv.sargi <= 0 || p.hp >= p.maxHp,
        color: '#ff7fa0',
      },
    ];
    const needles = TITAN_IDS.filter((id) => g.meter.needles[id] > 0);
    const gear = [
      { name: 'Patlar mızrak', value: `${p.spears}/${p.maxSpears}`, color: '#ffee33' },
      { name: 'Gaz', value: `%${Math.round((p.gas / p.maxGas) * 100)}`, color: '#ffffff' },
      { name: 'Kılıç', value: `%${Math.round((p.blades / p.maxBlades) * 100)}`, color: '#8f9aa8' },
      ...needles.map((id) => ({ name: TITANS[id].needle, value: `×${g.meter.needles[id]}`, color: hex(TITANS[id].color) })),
      { name: 'Av puanı', value: `◆ ${g.save.coins}`, color: '#2ee6a6' },
    ];
    return { rows, gear };
  }
}
