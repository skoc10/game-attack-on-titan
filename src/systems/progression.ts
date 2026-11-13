import { CHARACTERS, CHAR_IDS, type CharId } from '../data/characters';
import { CHAPTERS } from '../data/story';
import { clampProgress, type StoryProgress } from './storyRules';

export type GameMode = 'story' | 'free';
export type ClassId = 'nefer' | 'as' | 'muhafiz' | 'taktisyen';
export type UpgradeId = 'gas' | 'blade' | 'meter' | 'titan';

export interface SaveData {
  xp: number;
  level: number;
  points: number;
  upgrades: Record<UpgradeId, number>;
  cls: ClassId;
  quest: number;
  bossDefeated: boolean;
  kills: number;
  /** Seçili oyun modu. */
  mode: GameMode;
  /** Hikâyede sıradaki görev. */
  story: StoryProgress;
  /** Ulaşılan en ileri sezon; önceki sezonlar yeniden oynanabilir. */
  storyMax: number;
  /** Av puanı: dev öldürerek ve görev bitirerek kazanılır, karakter almaya yarar. */
  coins: number;
  /** Sahip olunan karakterler ve seçili olan. */
  chars: CharId[];
  char: CharId;
}

export const MAX_UPGRADE = 5;

export const UPGRADES: Record<UpgradeId, { name: string; desc: string }> = {
  gas: { name: 'Gaz Tüpü', desc: 'Gaz kapasitesi +%15' },
  blade: { name: 'Çelik Kalitesi', desc: 'Kılıç dayanımı +%20' },
  meter: { name: 'Öfke', desc: 'Dev barı dolum hızı +%15' },
  titan: { name: 'İrade', desc: 'Dev formunda bar %10 yavaş tükenir' },
};

export const CLASS_UNLOCK: Record<ClassId, number> = { nefer: 1, as: 2, muhafiz: 4, taktisyen: 6 };

export function newSave(): SaveData {
  return {
    xp: 0,
    level: 1,
    points: 0,
    upgrades: { gas: 0, blade: 0, meter: 0, titan: 0 },
    cls: 'nefer',
    quest: 0,
    bossDefeated: false,
    kills: 0,
    mode: 'story',
    story: { chapter: 0, mission: 0 },
    storyMax: 0,
    coins: 0,
    chars: ['aras'],
    char: 'aras',
  };
}

export function xpToNext(level: number) {
  return 80 + 70 * level;
}

/** XP ekler; atlanan seviye sayısını döner. Her seviye 1 yükseltme puanı verir. */
export function addXp(s: SaveData, amount: number) {
  let gained = 0;
  s.xp += Math.max(0, Math.round(amount));
  while (s.xp >= xpToNext(s.level)) {
    s.xp -= xpToNext(s.level);
    s.level += 1;
    s.points += 1;
    gained += 1;
  }
  return gained;
}

export function buyUpgrade(s: SaveData, id: UpgradeId) {
  if (s.points <= 0 || s.upgrades[id] >= MAX_UPGRADE) return false;
  s.points -= 1;
  s.upgrades[id] += 1;
  return true;
}

/** Kazanılan XP'nin yarısı kadar av puanı verilir. */
export function coinsFor(xp: number) {
  return Math.max(0, Math.round(xp / 2));
}

export function ownsChar(s: SaveData, id: CharId) {
  return s.chars.includes(id);
}

/** Karakteri av puanıyla alır ve seçer; puan yetmiyorsa ya da zaten varsa false döner. */
export function buyChar(s: SaveData, id: CharId) {
  const price = CHARACTERS[id].price;
  if (ownsChar(s, id) || s.coins < price) return false;
  s.coins -= price;
  s.chars.push(id);
  s.char = id;
  return true;
}

export function selectChar(s: SaveData, id: CharId) {
  if (!ownsChar(s, id)) return false;
  s.char = id;
  return true;
}

export function classUnlocked(s: SaveData, cls: ClassId) {
  return s.level >= CLASS_UNLOCK[cls];
}

const num = (v: unknown, def: number, min = 0, max = 1e9) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : def;

/** Bozuk/eski kayıtları güvenli bir SaveData'ya çevirir. */
export function sanitizeSave(raw: unknown): SaveData {
  const d = newSave();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  d.level = num(r.level, 1, 1, 999);
  d.xp = num(r.xp, 0);
  d.points = num(r.points, 0, 0, 999);
  d.quest = num(r.quest, 0, 0, 99);
  d.kills = num(r.kills, 0);
  d.bossDefeated = r.bossDefeated === true;
  const up = (r.upgrades ?? {}) as Record<string, unknown>;
  for (const k of Object.keys(d.upgrades) as UpgradeId[]) d.upgrades[k] = num(up[k], 0, 0, MAX_UPGRADE);
  d.mode = r.mode === 'free' ? 'free' : 'story';
  const st = (r.story ?? {}) as Record<string, unknown>;
  d.story = clampProgress(num(st.chapter, 0), num(st.mission, 0));
  d.storyMax = Math.max(d.story.chapter, num(r.storyMax, 0, 0, CHAPTERS.length));
  d.coins = num(r.coins, 0);
  const owned = Array.isArray(r.chars) ? r.chars : [];
  d.chars = CHAR_IDS.filter((id) => id === 'aras' || owned.includes(id));
  if (typeof r.char === 'string' && d.chars.includes(r.char as CharId)) d.char = r.char as CharId;
  if (typeof r.cls === 'string' && r.cls in CLASS_UNLOCK && classUnlocked(d, r.cls as ClassId)) d.cls = r.cls as ClassId;
  return d;
}
