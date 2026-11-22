import type { Game } from '../game';
import { storeSave } from '../core/save';
import { SKILL_IDS, SKILLS, canLearn, learnSkill, type SkillId } from '../data/skills';

export interface SkillRow {
  key: string;
  id: SkillId;
  name: string;
  sub: string;
  tag: string;
  branch: string;
  state: 'have' | 'can' | 'locked' | 'poor';
}

/** Beceri ağacı paneli: K açar/kapatır; açıkken 1–5 beceri alır. Yürürken de açık kalır. */
export class SkillTree {
  open = false;

  constructor(private readonly game: Game) {}

  keys() {
    const g = this.game;
    const inp = g.input;
    if (inp.pressed('KeyK')) {
      this.open = !this.open;
      g.audio.pickup();
    }
    if (!this.open) return;
    if (inp.pressed('Escape')) {
      this.open = false;
      return;
    }
    SKILL_IDS.forEach((id, i) => {
      if (inp.pressed(`Digit${i + 1}`)) this.learn(id);
    });
  }

  learn(id: SkillId) {
    const g = this.game;
    const s = g.save;
    const d = SKILLS[id];
    if (s.skills.includes(id)) {
      g.hud.toast(`${d.name} zaten sende`);
      return;
    }
    if (!learnSkill(s, id)) {
      g.hud.toast(d.req && !s.skills.includes(d.req) ? `Önce ${SKILLS[d.req].name} gerekli` : `${d.cost} beceri puanı gerekli — dev öldürerek kazanılır`);
      return;
    }
    storeSave(s);
    g.audio.levelUp();
    g.hud.callout(d.name.toLocaleUpperCase('tr'));
    g.hud.toast(`${d.name} öğrenildi${d.key ? ` — ${d.key} ile kullan` : ''}`);
  }

  view(): { pts: number; rows: SkillRow[] } | null {
    if (!this.open) return null;
    const s = this.game.save;
    const rows = SKILL_IDS.map((id, i): SkillRow => {
      const d = SKILLS[id];
      const have = s.skills.includes(id);
      const locked = d.req !== null && !s.skills.includes(d.req);
      return {
        key: String(i + 1),
        id,
        name: d.name,
        sub: d.desc + (locked ? ` · önce ${SKILLS[d.req!].name}` : ''),
        tag: have ? 'ALINDI' : `${d.cost} PUAN`,
        branch: d.branch,
        state: have ? 'have' : locked ? 'locked' : canLearn(s, id) ? 'can' : 'poor',
      };
    });
    return { pts: s.skillPts, rows };
  }
}
