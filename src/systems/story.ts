import type { Game } from '../game';
import { CFG } from '../data/config';
import { CHAPTERS, STORY_DONE, type Line, type Mission, type Objective, type SpawnGroup } from '../data/story';
import { TITANS, type TitanId } from '../data/titans';
import { storeSave } from '../core/save';
import { coinsFor } from './progression';
import type { Crate } from '../world/crates';
import { chapterAt, goal, missionAt, needleFor, nextStep, progressFor, storyDone, type StoryEvent } from './storyRules';

export interface ObjectiveView {
  text: string;
  state: 'done' | 'active' | 'todo';
  count: number;
  goal: number;
}

const IN = CFG.world.walls[0].r;

/**
 * Hikâye modu: sezonlara bölünmüş görevleri sırayla yürütür. Adımların ilerlemesini oyun
 * olaylarından ve oyuncunun konumundan ölçer, görev devlerini doğurur, telsiz konuşmalarını sıraya koyar.
 */
export class Story {
  /** Etkin adımın sıra numarası ve o adımdaki ilerleme. */
  objective = 0;
  count = 0;
  /** Ekranda gösterilen konuşma satırı. */
  line: Line | null = null;
  /** Haritada ve dünyada işaretlenen hedef. */
  target: [number, number] | null = null;
  /** Etkin adım için iğne gerekiyor ama oyuncuda yoksa hangi iğne. */
  missing: TitanId | null = null;
  private queue: Line[] = [];
  private lineT = 0;
  private phase: 'idle' | 'play' | 'outro' = 'idle';
  private checkT = 0;
  private crate: Crate | null = null;

  constructor(private readonly game: Game) {}

  get progress() {
    return this.game.save.story;
  }
  get done() {
    return storyDone(this.progress);
  }
  get chapter() {
    return chapterAt(this.progress);
  }
  get mission(): Mission | null {
    return missionAt(this.progress);
  }
  private get current(): Objective | null {
    return this.phase === 'play' ? (this.mission?.objectives[this.objective] ?? null) : null;
  }

  /** Görev başlığı: "S2 · 3/5 — Gökten Düşenler". */
  get heading() {
    const c = this.chapter;
    const m = this.mission;
    if (!c || !m) return STORY_DONE;
    return `${c.label} · ${this.progress.mission + 1}/${c.missions.length} — ${m.title}`;
  }

  get objectives(): ObjectiveView[] {
    const m = this.mission;
    if (!m) return [];
    const at = this.phase === 'outro' ? m.objectives.length : this.objective;
    return m.objectives.map((o, i) => ({
      text: o.text,
      state: i < at ? 'done' : i === at ? 'active' : 'todo',
      count: i < at ? goal(o) : i === at ? this.count : 0,
      goal: goal(o),
    }));
  }

  /** Görevi baştan kurar (mod değişince, sezon seçilince, oyun açılınca). */
  restart() {
    this.cleanup();
    this.phase = 'idle';
    this.objective = 0;
    this.count = 0;
    this.queue = [];
    this.line = null;
    this.target = null;
    this.missing = null;
    this.crate = null;
  }

  /** Seçilen sezonun başına döner. */
  jump(chapter: number) {
    const g = this.game;
    if (chapter < 0 || chapter > g.save.storyMax || chapter >= CHAPTERS.length) return;
    g.save.story = { chapter, mission: 0 };
    storeSave(g.save);
    this.restart();
  }

  /** Görevin doğurduğu devleri kaldırır. Kapı Kıran dünyaya aittir, kalır. */
  cleanup() {
    for (const gi of this.game.giants) {
      if (gi.tag && gi.tag !== 'gate') gi.gone = true;
    }
  }

  // ---------------------------------------------------------------- olaylar
  emit(e: StoryEvent) {
    let o = this.current;
    if (!o) return;
    if (e.type === 'kill' && e.tag && progressFor(o, e) <= 0) {
      // Görev devi, ona giden adımlar (ör. "kapıya yaklaş") bitmeden öldürüldüyse o adımlar atlanır.
      const list = this.mission?.objectives ?? [];
      const idx = list.findIndex((x, i) => i > this.objective && x.kind === 'kill' && progressFor(x, e) > 0);
      if (idx < 0) return;
      this.objective = idx;
      this.count = 0;
      o = list[idx];
    }
    const inc = progressFor(o, e);
    if (inc <= 0) return;
    this.count += inc;
    if (this.count < goal(o)) return;
    this.game.hud.toast(`✓ ${o.text}`);
    this.game.audio.pickup();
    this.objective += 1;
    this.count = 0;
    this.enterObjective();
  }

  private beginMission() {
    const g = this.game;
    const c = this.chapter;
    const m = this.mission;
    if (!c || !m) return;
    this.phase = 'play';
    this.objective = 0;
    this.count = 0;
    if (this.progress.mission === 0) g.hud.chapterCard(c.label, c.title, c.tagline);
    else g.hud.banner(m.title, `${c.label} · Bölüm ${this.progress.mission + 1}`);
    this.say(m.intro);
    this.enterObjective();
  }

  /** Yeni adım etkinleşti: görev bittiyse kapanışa geç, yoksa adımın ön koşullarına bak. */
  private enterObjective() {
    const g = this.game;
    const m = this.mission;
    if (!m) return;
    this.crate = null;
    this.missing = null;
    this.checkT = 0;
    const o = m.objectives[this.objective];
    if (!o) {
      this.phase = 'outro';
      this.target = null;
      g.hud.banner('GÖREV TAMAMLANDI', m.title);
      this.say(m.outro ?? []);
      return;
    }
    // Koşul zaten sağlanıyorsa adım hemen geçilir.
    const p = g.player;
    if (o.kind === 'needle' && g.meter.needles[o.form] > 0) this.emit({ type: 'needle', form: o.form });
    else if (o.kind === 'transform' && p.mode === 'titan') this.emit({ type: 'transform', form: p.titan.def.id });
  }

  private completeMission() {
    const g = this.game;
    const c = this.chapter;
    const m = this.mission;
    if (!c || !m) return;
    const before = this.progress.chapter;
    g.save.story = nextStep(this.progress);
    g.save.storyMax = Math.max(g.save.storyMax, Math.min(g.save.story.chapter, CHAPTERS.length - 1));
    this.cleanup();
    this.phase = 'idle';
    this.objective = 0;
    this.count = 0;
    g.grantXp(m.xp);
    g.grantCoins(coinsFor(m.xp));
    g.hud.toast(`Görev ödülü: +${m.xp} XP · +${coinsFor(m.xp)} puan`);
    if (g.save.story.chapter !== before) {
      g.grantXp(c.bonus);
      g.grantCoins(coinsFor(c.bonus));
      if (this.done) g.hud.chapterCard('SON', 'SUR ÖTESİ', 'Hikâye tamamlandı. Artık dışarısı da senin.');
      else g.hud.banner(`${c.label} TAMAMLANDI`, `${c.title} · +${c.bonus} XP · +${coinsFor(c.bonus)} puan`);
    }
    storeSave(g.save);
  }

  // ---------------------------------------------------------------- konuşmalar
  private say(lines: Line[]) {
    this.queue.push(...lines);
  }

  private tickDialogue(dt: number) {
    const inp = this.game.input;
    if (this.line) {
      this.lineT -= dt;
      if (inp.pressed('Enter')) this.lineT = 0;
      if (this.lineT > 0) return;
      this.line = null;
    }
    const next = this.queue.shift();
    if (!next) return;
    this.line = next;
    this.lineT = 2.4 + next[1].length * 0.055;
  }

  // ---------------------------------------------------------------- döngü
  update(dt: number) {
    this.tickDialogue(dt);
    if (this.done) {
      this.target = null;
      return;
    }
    const g = this.game;
    const p = g.player;
    if (this.phase === 'idle') {
      // Sezon kapanış yazısı ve önceki konuşmalar bitsin, sonra yeni görev başlasın.
      if (!this.line && this.queue.length === 0) this.beginMission();
      return;
    }
    if (this.phase === 'outro') {
      if (!this.line && this.queue.length === 0) this.completeMission();
      return;
    }
    if (p.dead) return;

    // Konumla ve durumla ölçülen adımlar.
    const o = this.current;
    if (!o) return;
    if (o.kind === 'reach' || o.kind === 'beyond') this.emit({ type: 'pos', x: p.pos.x, z: p.pos.z });
    else if (o.kind === 'mount' && p.mode === 'mounted') this.emit({ type: 'mount' });
    else if (o.kind === 'station' && g.stations.nearest(p.pos.x, p.pos.z).dist < CFG.gas.stationReach + 1) this.emit({ type: 'station' });

    this.checkT -= dt;
    if (this.checkT <= 0) {
      this.checkT = 0.8;
      this.ensureNeedle();
      this.ensureSpawns();
    }
    this.updateTarget();
  }

  /** Adım bir iğne istiyorsa ve oyuncuda yoksa en yakın sandığı doldurup işaretler. */
  private ensureNeedle() {
    const g = this.game;
    const o = this.current;
    this.crate = null;
    this.missing = null;
    if (!o) return;
    const p = g.player;
    let form: TitanId | 'any';
    if (o.kind === 'needle') form = o.form;
    else {
      const need = needleFor(o);
      if (need === null) return;
      const inForm = p.mode === 'titan' && (need === 'any' || p.titan.def.id === need);
      // Kendi dev formu olan karakter iğnesiz de dönüşebilir.
      const has = need === 'any' ? g.meter.totalNeedles > 0 || g.meter.innate !== null : g.meter.needles[need] > 0;
      if (inForm || has) return;
      form = need;
    }
    this.crate = g.crates.restock(form, p.pos.x, p.pos.z);
    if (o.kind !== 'needle' && this.crate) this.missing = this.crate.form;
  }

  /** Etkin adımların görev devleri eksikse (öldü sayılmadan kayboldularsa) yeniden doğurur. */
  private ensureSpawns() {
    const g = this.game;
    const m = this.mission;
    if (!m?.spawns) return;
    for (const grp of m.spawns) {
      if (grp.on > this.objective) continue;
      const idx = m.objectives.findIndex((o, i) => i >= this.objective && o.kind === 'kill' && o.tag === grp.tag);
      if (idx < 0) continue;
      const need = goal(m.objectives[idx]) - (idx === this.objective ? this.count : 0);
      let alive = 0;
      for (const gi of g.giants) if (gi.tag === grp.tag && gi.alive) alive++;
      if (alive < need) this.spawnGroup(grp, need - alive, alive);
    }
  }

  private spawnGroup(grp: SpawnGroup, n: number, offset: number) {
    const g = this.game;
    const p = g.player.pos;
    if (grp.boss) {
      if (grp.boss === 'gate') g.spawner.spawnBoss(g);
      else if (grp.at) g.spawner.spawnBossAt(grp.boss, grp.at[0], grp.at[1], g).tag = grp.tag;
      return;
    }
    const kinds = grp.kinds ?? ['normal'];
    const [ax, az] = grp.at ?? [p.x, p.z];
    // Oyuncu uzaktayken doğurma: uzaktaki devler zaten kaldırılır.
    if (Math.hypot(ax - p.x, az - p.z) > 380) return;
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 14; tries++) {
        const a = Math.random() * Math.PI * 2;
        const d = 55 + Math.random() * 55;
        const x = ax + Math.sin(a) * d;
        const z = az + Math.cos(a) * d;
        const r = Math.hypot(x, z);
        if (r < IN + 45 || CFG.world.walls.some((w) => Math.abs(r - w.r) < 24)) continue;
        if (Math.hypot(x - p.x, z - p.z) < 45) continue;
        if (g.world.solidAt(x, g.world.heightAt(x, z) + 2, z, 3)) continue;
        g.spawner.spawn(kinds[(offset + i) % kinds.length], x, z, g).tag = grp.tag;
        break;
      }
    }
  }

  private updateTarget() {
    const g = this.game;
    const o = this.current;
    const p = g.player.pos;
    this.target = null;
    if (!o) return;
    if (this.crate && !this.crate.opened) {
      this.target = [this.crate.x, this.crate.z];
      return;
    }
    if (o.kind === 'reach') this.target = o.at;
    else if (o.kind === 'beyond') this.target = [0, o.r + 30];
    else if (o.kind === 'station') {
      const s = g.stations.nearest(p.x, p.z).station;
      if (s) this.target = [s.x, s.z];
    } else if (o.kind === 'mount') this.target = [g.horse.pos.x, g.horse.pos.z];
    else if (o.kind === 'kill' && o.tag) {
      let bd = Infinity;
      for (const gi of g.giants) {
        if (gi.tag !== o.tag || !gi.alive) continue;
        const d = Math.hypot(gi.pos.x - p.x, gi.pos.z - p.z);
        if (d < bd) {
          bd = d;
          this.target = [gi.pos.x, gi.pos.z];
        }
      }
      if (!this.target) this.target = this.mission?.spawns?.find((s) => s.tag === o.tag)?.at ?? null;
    }
  }

  /** İğne eksikse oyuncuya ne yapacağını söyleyen satır. */
  get hint() {
    return this.missing ? `${TITANS[this.missing].needle} gerekli — işaretli sandıktan al` : '';
  }
}
