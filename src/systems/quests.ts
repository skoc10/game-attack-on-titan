import type { Game } from '../game';
import { CFG } from '../data/config';

export interface Quest {
  id: string;
  text: string;
  xp: number;
  /** Mini haritada gösterilecek hedef (x, z). */
  target?: [number, number];
  done: (g: Game) => boolean;
}

const near = (g: Game, x: number, z: number, d: number) => Math.hypot(g.player.pos.x - x, g.player.pos.z - z) < d;
const MID = CFG.world.walls[1].r;
const OUT = CFG.world.walls[2].r;

export const QUESTS: Quest[] = [
  {
    id: 'leave',
    text: 'Kapıdan çık: Taç Suru’nun dışına adım at',
    xp: 30,
    target: [0, CFG.world.walls[0].r + 40],
    done: (g) => Math.hypot(g.player.pos.x, g.player.pos.z) > CFG.world.walls[0].r + 20,
  },
  { id: 'firstKill', text: 'Kanca Teçhizatı ile bir devi ensesinden vur', xp: 60, done: (g) => g.stats.kills > 0 },
  { id: 'needle', text: 'Renkli ışık sütunlu bir kutudan dev iğnesi al', xp: 60, done: (g) => g.stats.needlesFound > 0 || g.meter.totalNeedles > 0 },
  { id: 'transform', text: 'Dev barını en az yarıya getir ve deve dönüş (T)', xp: 120, done: (g) => g.stats.transforms > 0 },
  { id: 'reachMid', text: 'Yolu izle: Demir Sur kapısına ulaş', xp: 100, target: [0, MID - 70], done: (g) => near(g, 0, MID - 70, 190) || g.save.bossDefeated },
  { id: 'boss', text: 'Kapı Kıran’ı yok et — zırhını düşür, ensesine vur', xp: 150, target: [0, MID - 70], done: (g) => g.save.bossDefeated },
  { id: 'reachOuter', text: 'Kalkan Suru kapısına ulaş', xp: 200, target: [0, OUT - 30], done: (g) => near(g, 0, OUT - 30, 80) },
  { id: 'beyond', text: 'Sur ötesine çık', xp: 300, target: [0, OUT + 120], done: (g) => Math.hypot(g.player.pos.x, g.player.pos.z) > OUT + 60 },
];

export const FREE_HUNT = 'Sur ötesinde özgürce avlan';

export class QuestLog {
  get current(): Quest | null {
    return QUESTS[this.game.save.quest] ?? null;
  }
  constructor(private readonly game: Game) {}

  update() {
    const q = this.current;
    if (!q || !q.done(this.game)) return;
    this.game.save.quest += 1;
    this.game.hud.banner('GÖREV TAMAMLANDI', q.text);
    this.game.grantXp(q.xp);
  }
}
