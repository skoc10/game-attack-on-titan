/**
 * Dokunmatik ekran düzeni: sanal çubuğun hesabı ve ekrandaki tuşların o anki
 * duruma göre ne yazacağı, görünüp görünmeyeceği. DOM'a dokunmaz; ui/touch.ts
 * bunu her karede çağırıp tuşları günceller.
 */

/** Tuş yuvaları: sağ alttaki büyük saldırı tuşunun çevresinde iki yay. */
export type Slot = 'atk' | 'jump' | 'r1' | 'r2' | 'r3' | 'o1' | 'o2' | 'o3' | 'o4' | 'o5';

/** Her yuvanın taklit ettiği tuş ('M0' farenin sol tuşu). */
export const SLOT_CODE: Record<Slot, string> = {
  atk: 'M0',
  jump: 'Space',
  r1: 'KeyR',
  r2: 'KeyQ',
  r3: 'KeyE',
  o1: 'KeyT',
  o2: 'KeyF',
  o3: 'KeyC',
  o4: 'Tab',
  o5: 'KeyH',
};

export type Interact = '' | 'talk' | 'open' | 'mount' | 'dismount' | 'cannon';

export interface Power {
  name: string;
  cost: number;
  cd: number;
}

export interface TouchCtx {
  mode: 'foot' | 'mounted' | 'titan';
  dead: boolean;
  /** Biriyle konuşuluyor: seçimler pencereye dokunarak yapılır. */
  talking: boolean;
  grabbed: boolean;
  cocoon: boolean;
  canTransform: boolean;
  /** Dönüşülebilecek form sayısı (iğne türleri + kendi formu). */
  formChoices: number;
  interact: Interact;
  /** Kanca takılı. */
  hooked: boolean;
  /** Nişangâhın altında kanca atılabilecek bir yer var. */
  aimHook: boolean;
  spears: number;
  ability: string;
  abilityCd: number;
  cocoonCd: number;
  sargi: number;
  titan?: { meter: number; punch: Power; q: Power; e: Power; slam: Power; bite: Power };
  /** Sur topunun başında: yeniden dolma süresi ve hedefin vurulabilir olup olmadığı. */
  cannon?: { cd: number; ready: boolean };
}

export interface TouchBtn {
  label: string;
  sub: string;
  /** Şu an işe yaramaz (bekleme süresi, bar ya da mühimmat yok): soluk görünür. */
  off: boolean;
}

const INTERACT: Record<Exclude<Interact, ''>, string> = {
  talk: 'KONUŞ',
  open: 'AÇ',
  mount: 'BİN',
  dismount: 'İN',
  cannon: 'TOP',
};

const up = (s: string) => s.toLocaleUpperCase('tr');
const secs = (cd: number) => (cd > 0 ? `${Math.ceil(cd)} sn` : '');

/** Görünecek tuşlar; listede olmayan yuvalar gizlenir. */
export function touchLayout(c: TouchCtx): Partial<Record<Slot, TouchBtn>> {
  if (c.dead || c.talking) return {};
  if (c.cocoon) return { o3: { label: 'KIR', sub: 'kozayı', off: false } };
  if (c.grabbed) {
    const out: Partial<Record<Slot, TouchBtn>> = {
      atk: { label: 'KES', sub: 'seri bas', off: false },
      jump: { label: 'GAZ', sub: 'sıyrıl', off: false },
    };
    if (c.canTransform) out.o1 = { label: 'DÖNÜŞ', sub: '', off: false };
    return out;
  }
  if (c.cannon) {
    return {
      atk: { label: 'ATEŞ', sub: c.cannon.cd > 0 ? 'dolduruluyor' : c.cannon.ready ? 'nişan tamam' : 'nişan al', off: c.cannon.cd > 0 || !c.cannon.ready },
      jump: { label: 'İN', sub: 'toptan', off: false },
    };
  }
  if (c.mode === 'titan' && c.titan) {
    const t = c.titan;
    const pw = (p: Power): TouchBtn => ({
      label: up(p.name),
      sub: p.cd > 0 ? secs(p.cd) : `−${String(p.cost).replace('.', ',')}`,
      off: p.cd > 0 || t.meter < p.cost,
    });
    return { atk: pw(t.punch), r2: pw(t.q), r3: pw(t.e), o2: pw(t.bite), jump: pw(t.slam), o1: { label: 'ÇIK', sub: 'formdan', off: false } };
  }
  const out: Partial<Record<Slot, TouchBtn>> = {
    atk: c.hooked
      ? { label: 'KANCA', sub: 'basılı tut', off: false }
      : c.aimHook
        ? { label: 'KANCA', sub: 'bas · tut', off: false }
        : { label: 'KILIÇ', sub: 'savur', off: false },
    jump: { label: c.mode === 'mounted' ? 'İN' : c.hooked ? 'FIRLA' : 'ZIPLA', sub: '', off: false },
    r1: { label: up(c.ability), sub: secs(c.abilityCd), off: c.abilityCd > 0 },
    r2: { label: 'MIZRAK', sub: `×${c.spears}`, off: c.spears <= 0 },
    o3: { label: 'KOZA', sub: secs(c.cocoonCd), off: c.cocoonCd > 0 },
  };
  if (c.interact) out.r3 = { label: INTERACT[c.interact], sub: '', off: false };
  if (c.canTransform) out.o1 = { label: 'DÖNÜŞ', sub: '', off: false };
  if (c.mode === 'foot') out.o2 = { label: 'AT', sub: 'çağır', off: false };
  if (c.formChoices > 1) out.o4 = { label: 'İĞNE', sub: 'değiştir', off: false };
  if (c.sargi > 0) out.o5 = { label: 'SARGI', sub: `×${c.sargi}`, off: false };
  return out;
}

/**
 * Sanal çubuk: parmağın çubuğun merkezinden uzaklığı (piksel, y aşağı) →
 * yön (x sağa, y ileri) ve 0..1 büyüklük. Ölü bölgenin içi sıfırdır.
 */
export function stickVector(dx: number, dy: number, radius: number, dead: number) {
  const l = Math.hypot(dx, dy);
  if (l <= dead) return { x: 0, y: 0, mag: 0 };
  const mag = Math.min(1, (l - dead) / Math.max(1, radius - dead));
  return { x: (dx / l) * mag, y: (-dy / l) * mag, mag };
}

/** Oyun metinlerindeki klavye tuşu anışları ve dokunmatikteki karşılıkları. */
const TOUCH_WORDS: [RegExp, string][] = [
  [/\(F ile çağır, E ile bin\)/g, '(AT tuşuyla çağır, BİN tuşuyla bin)'],
  [/\(T\)/g, '(DÖNÜŞ)'],
  [/\bTab ile\b/g, 'İĞNE tuşuyla'],
  [/\bQ ile\b/g, 'MIZRAK tuşuyla'],
  [/\bH ile\b/g, 'SARGI tuşuyla'],
  [/\bI ile\b/g, 'ÇANTA tuşuyla'],
  [/\bEsc ile\b/g, '❚❚ tuşuyla'],
  [/\(sol tık\)/gi, '(KES tuşu)'],
];

/** Dokunmatik ekranda gösterilecek metin: klavye anışları ekran tuşlarının adlarına döner. */
export function touchText(s: string) {
  for (const [re, to] of TOUCH_WORDS) s = s.replace(re, to);
  return s;
}
