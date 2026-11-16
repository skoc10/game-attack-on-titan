import type { Game } from '../game';
import { CFG } from '../data/config';
import { TITAN_IDS } from '../data/titans';
import { SLOT_CODE, stickVector, touchLayout, type Slot, type TouchBtn } from '../systems/touchLayout';

/**
 * Tablet ve telefon için ekran kontrolleri:
 * - ekranın sol tarafına dokunan parmak sanal çubuğu oraya taşır ve yürütür,
 * - sağ tarafta kaydırmak kamerayı çevirir (nişan ekranın ortasıdır),
 * - sağ alttaki tuşlar klavye/fare tuşlarının yerine geçer ve duruma göre değişir,
 * - konuşma, çanta ve telsiz pencerelerindeki satırlara dokunarak seçim yapılır.
 */

/** Yuvaların merkezi: sağ alt köşeden sola ve yukarı uzaklık (piksel) ve çap. */
const SLOTS: Record<Slot, [number, number, number]> = {
  atk: [60, 60, 112],
  jump: [194, 54, 80],
  r1: [176, 130, 64],
  r2: [128, 180, 64],
  r3: [60, 196, 64],
  o1: [280, 56, 58],
  o2: [266, 140, 58],
  o3: [222, 214, 58],
  o4: [148, 262, 58],
  o5: [64, 278, 58],
};
const SLOT_IDS = Object.keys(SLOTS) as Slot[];

/** Çubuğu başlatan dokunuş ekranın bu oranından solda olmalı. */
const STICK_ZONE = 0.42;

export class TouchControls {
  private readonly root: HTMLElement;
  private readonly stick: HTMLElement;
  private readonly knob: HTMLElement;
  private readonly btns = {} as Record<Slot, HTMLButtonElement>;
  private readonly last = {} as Record<Slot, string>;
  /** Basılı tutulan ekran tuşları: parmak kimliği → taklit edilen tuş. */
  private readonly pressedBy = new Map<number, string>();
  private stickId: number | null = null;
  private stickOX = 0;
  private stickOY = 0;
  private lookId: number | null = null;
  private lookX = 0;
  private lookY = 0;

  constructor(
    private readonly game: Game,
    hud: HTMLElement,
    canvas: HTMLCanvasElement,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'touchUi';
    this.root.innerHTML = `
      <div class="stick"><i></i></div>
      <div class="tbtns">${SLOT_IDS.map((id) => `<button class="tb ${id}" data-slot="${id}"><b></b><small></small></button>`).join('')}</div>
      <div class="ttop">
        <button class="tb mini" data-code="KeyI"><b>ÇANTA</b></button>
        <button class="tb mini" data-act="pause"><b>❚❚</b></button>
      </div>
      <div class="rotate"><b>⟲</b>Oynamak için cihazı yatay çevir</div>`;
    hud.appendChild(this.root);
    this.stick = this.root.querySelector('.stick')!;
    this.knob = this.stick.querySelector('i')!;
    for (const id of SLOT_IDS) {
      const b = this.root.querySelector<HTMLButtonElement>(`[data-slot="${id}"]`)!;
      const [x, y, d] = SLOTS[id];
      b.style.width = b.style.height = `${d}px`;
      b.style.right = `${x - d / 2}px`;
      b.style.bottom = `${y - d / 2}px`;
      this.btns[id] = b;
      this.last[id] = '?'; // ilk karede her tuş boyansın (gizlenecekler de)
    }

    // Ekran tuşları
    this.root.addEventListener('pointerdown', (e) => this.onButtonDown(e));
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
      this.root.addEventListener(type, (e) => this.onButtonUp(e));
    }
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());

    // Çubuk ve bakış: tuvale gelen dokunuşlar
    canvas.addEventListener('pointerdown', (e) => this.onCanvasDown(e));
    canvas.addEventListener('pointermove', (e) => this.onCanvasMove(e));
    for (const type of ['pointerup', 'pointercancel'] as const) {
      canvas.addEventListener(type, (e) => this.onCanvasUp(e));
    }
    // Dokunmatikte tarayıcının kaydırma/yakınlaştırma hareketlerini kapat.
    canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });

    // HUD'daki seçilebilir satırlar (konuşma, çanta, telsiz): dokununca o tuşa basılmış sayılır.
    hud.addEventListener('pointerdown', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-key]');
      if (!t || !this.game.input.touch) return;
      e.preventDefault();
      this.game.input.simulatePress(t.dataset.key!);
    });
  }

  private usable(e: PointerEvent) {
    const inp = this.game.input;
    return this.game.running && inp.touch && (e.pointerType !== 'mouse' || inp.forceTouch);
  }

  private onButtonDown(e: PointerEvent) {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.tb');
    if (!b || !this.game.running) return;
    e.preventDefault();
    if (b.dataset.act === 'pause') {
      this.game.pause();
      return;
    }
    const code = b.dataset.code ?? SLOT_CODE[b.dataset.slot as Slot];
    if (!code) return;
    try {
      b.setPointerCapture(e.pointerId);
    } catch {
      /* yakalama desteklenmiyorsa bırakma yine gelir */
    }
    this.pressedBy.set(e.pointerId, code);
    b.classList.add('down');
    this.press(code, true);
  }

  private onButtonUp(e: PointerEvent) {
    const code = this.pressedBy.get(e.pointerId);
    if (code === undefined) return;
    this.pressedBy.delete(e.pointerId);
    (e.target as HTMLElement).closest('.tb')?.classList.remove('down');
    this.press(code, false);
  }

  private press(code: string, on: boolean) {
    const inp = this.game.input;
    if (code === 'M0') inp.simulateMouse(0, on);
    else inp.hold(code, on);
  }

  private onCanvasDown(e: PointerEvent) {
    if (!this.usable(e)) return;
    e.preventDefault();
    if (this.stickId === null && e.clientX < window.innerWidth * STICK_ZONE) {
      this.stickId = e.pointerId;
      this.stickOX = e.clientX;
      this.stickOY = e.clientY;
      this.stick.classList.add('on');
      this.stick.style.left = `${e.clientX}px`;
      this.stick.style.top = `${e.clientY}px`;
      this.knob.style.transform = '';
    } else if (this.lookId === null) {
      this.lookId = e.pointerId;
      this.lookX = e.clientX;
      this.lookY = e.clientY;
    } else return;
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* yok sayılır */
    }
  }

  private onCanvasMove(e: PointerEvent) {
    const inp = this.game.input;
    if (e.pointerId === this.stickId) {
      const dx = e.clientX - this.stickOX;
      const dy = e.clientY - this.stickOY;
      const R = CFG.touch.stickRadius;
      const v = stickVector(dx, dy, R, CFG.touch.stickDead);
      inp.stickX = v.x;
      inp.stickY = v.y;
      const l = Math.hypot(dx, dy);
      const k = l > R ? R / l : 1;
      this.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      this.stick.classList.toggle('run', inp.stickSprint);
    } else if (e.pointerId === this.lookId) {
      inp.lookDX += e.clientX - this.lookX;
      inp.lookDY += e.clientY - this.lookY;
      this.lookX = e.clientX;
      this.lookY = e.clientY;
    }
  }

  private onCanvasUp(e: PointerEvent) {
    if (e.pointerId === this.stickId) this.releaseStick();
    else if (e.pointerId === this.lookId) this.lookId = null;
  }

  private releaseStick() {
    this.stickId = null;
    const inp = this.game.input;
    inp.stickX = 0;
    inp.stickY = 0;
    this.stick.classList.remove('on', 'run');
    this.stick.style.left = '';
    this.stick.style.top = '';
    this.knob.style.transform = '';
  }

  /** Duraklarken ya da dokunmatik mod kapanınca basılı her şeyi bırak. */
  reset() {
    this.releaseStick();
    this.lookId = null;
    for (const code of this.pressedBy.values()) this.press(code, false);
    this.pressedBy.clear();
    this.root.querySelectorAll('.tb.down').forEach((b) => b.classList.remove('down'));
  }

  /** Her kare: tuşların yazısını ve görünürlüğünü duruma göre günceller. */
  update() {
    const g = this.game;
    if (!g.input.touch) return;
    const p = g.player;
    const m = g.meter;
    const t = p.titan;
    const d = t.def;
    const layout = touchLayout({
      mode: p.mode,
      dead: p.dead,
      talking: g.npcs.open !== null,
      grabbed: p.grabbedBy !== null,
      cocoon: g.cocoon.active,
      canTransform: m.canTransform(),
      formChoices: TITAN_IDS.filter((id) => m.needles[id] > 0).length + (m.innate ? 1 : 0),
      interact: p.interactKind(),
      hooked: p.grapple.active,
      aimHook: g.aim !== null,
      spears: p.spears,
      ability: p.cls.ability,
      abilityCd: p.abilityCd,
      cocoonCd: g.cocoon.cd,
      sargi: g.save.inv.sargi,
      titan:
        p.mode === 'titan'
          ? {
              meter: m.value,
              punch: { name: d.punch.name, cost: d.punch.cost, cd: 0 },
              q: { name: d.q.name, cost: d.q.cost, cd: t.qCd },
              e: { name: d.e.name, cost: d.e.cost, cd: t.eCd },
              slam: { name: d.slam.name, cost: d.slam.cost, cd: 0 },
              bite: { name: 'Isırık', cost: CFG.titan.bite.cost, cd: t.biteCd },
            }
          : undefined,
    });
    for (const id of SLOT_IDS) this.paint(id, layout[id]);
  }

  private paint(id: Slot, b: TouchBtn | undefined) {
    const key = b ? `${b.label}|${b.sub}|${b.off ? 1 : 0}` : '';
    if (this.last[id] === key) return;
    this.last[id] = key;
    const el = this.btns[id];
    el.classList.toggle('hide', !b);
    if (!b) {
      // Gizlenen tuş basılıyken bırakılmış sayılsın.
      for (const [pid, code] of this.pressedBy) {
        if (code !== SLOT_CODE[id]) continue;
        this.pressedBy.delete(pid);
        this.press(code, false);
        el.classList.remove('down');
      }
      return;
    }
    el.classList.toggle('off', b.off);
    el.classList.toggle('long', b.label.length > 7);
    el.querySelector('b')!.textContent = b.label;
    el.querySelector('small')!.textContent = b.sub;
  }
}
