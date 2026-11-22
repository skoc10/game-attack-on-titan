/**
 * Klavye + fare + dokunmatik. Tarayıcı izin verirse fare kilitlenir ve fare
 * hareketi kamerayı çevirir; izin vermezse imleç serbest kalır ve imlecin ekran
 * ortasından uzaklığı kamerayı döndürür. Dokunmatik ekranda (tablet) sanal
 * çubuk yürütür, ekranı kaydırmak kamerayı çevirir, ekrandaki tuşlar da klavye
 * tuşlarının yerine geçer (bkz. ui/touch.ts).
 */
export class Input {
  readonly keys = new Set<string>();
  private readonly keyPressed = new Set<string>();
  /** Ekrandaki dokunmatik tuşlardan basılı tutulanlar. */
  private readonly held = new Set<string>();
  private readonly btn = [false, false, false];
  private readonly btnPressed = [false, false, false];
  /** İmlecin pencere içindeki konumu (piksel). */
  mouseX = window.innerWidth / 2;
  mouseY = window.innerHeight / 2;
  /** Tekerlekten biriken yatay dönüş (shift basılıyken dikey). */
  wheelYaw = 0;
  wheelPitch = 0;
  /** Orta tuş basılıyken sürükleme miktarı. */
  dragDX = 0;
  dragDY = 0;
  /** Fare kilitliyken biriken hareket. */
  mouseDX = 0;
  /** Kilit yokken farenin kayması (bakışı çevirir). */
  freeDX = 0;
  freeDY = 0;
  mouseDY = 0;
  locked = false;
  /** İmleç pencerenin içinde mi (serbest imleçle dönüş için). */
  inside = true;

  /** Dokunmatik mod: ekran tuşları görünür, nişan ekranın ortasındadır. */
  touch = false;
  /** Adres satırında ?touch varsa fareyle de dokunmatik düzen kalır (deneme için). */
  readonly forceTouch: boolean;
  /** Sanal çubuk: x sağa, y ileriye doğru −1..1. */
  stickX = 0;
  stickY = 0;
  /** Bakış için parmakla kaydırılan miktar (piksel). */
  lookDX = 0;
  lookDY = 0;
  /** Dokunmatik mod açılıp kapandığında çağrılır. */
  onTouchChange: ((on: boolean) => void) | null = null;
  private lastTouch = -1e9;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.forceTouch = new URLSearchParams(location.search).has('touch');
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    if (this.forceTouch || coarse) this.setTouch(true);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      if (!e.repeat) this.keyPressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.releaseAll());
    // Dokunma geldiyse dokunmatik moda geç; gerçek fare hareket ettiyse geri dön.
    window.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType === 'mouse') return; // parmak ya da kalem
        this.lastTouch = performance.now();
        this.setTouch(true);
      },
      { capture: true },
    );
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') this.lastTouch = performance.now();
      else if (e.pointerType === 'mouse' && !this.forceTouch && !this.fromTouch() && (e.movementX !== 0 || e.movementY !== 0)) this.setTouch(false);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (this.fromTouch()) return; // dokunmanın ardından tarayıcının ürettiği sahte fare olayı
      if (e.button === 1) e.preventDefault(); // tarayıcının otomatik kaydırmasını engelle
      if (e.button < 3) {
        this.btn[e.button] = true;
        this.btnPressed[e.button] = true;
      }
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
    window.addEventListener('mouseup', (e) => {
      if (this.fromTouch()) return;
      if (e.button < 3) this.btn[e.button] = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
    });
    document.addEventListener('mouseleave', () => (this.inside = false));
    document.addEventListener('mouseenter', () => (this.inside = true));
    window.addEventListener('mousemove', (e) => {
      if (this.fromTouch()) return;
      this.inside = true;
      if (this.locked) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
        return;
      }
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      // Kilit yokken de fare kaydırması bakışı çevirir.
      this.freeDX += e.movementX;
      this.freeDY += e.movementY;
      if (this.btn[1]) {
        this.dragDX += e.movementX;
        this.dragDY += e.movementY;
      }
    });
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? 400 : 1;
        const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit;
        if (e.shiftKey) this.wheelPitch += d;
        else this.wheelYaw += d;
      },
      { passive: false },
    );
  }

  private fromTouch() {
    return performance.now() - this.lastTouch < 1000;
  }

  setTouch(on: boolean) {
    if (this.touch === on) return;
    this.touch = on;
    document.body.classList.toggle('touch', on);
    if (!on) this.releaseTouch();
    this.onTouchChange?.(on);
  }

  /** Nişan ekranın ortasında mı (dokunmatik). Fare kilitliyken nişangâh ortadaki alanda kayar. */
  get centerAim() {
    return this.touch;
  }

  /** Çubuk sonuna kadar itildiyse koşulur (Shift yerine). */
  get stickSprint() {
    return Math.hypot(this.stickX, this.stickY) > 0.86;
  }

  down(code: string) {
    return this.keys.has(code) || this.held.has(code);
  }
  pressed(code: string) {
    return this.keyPressed.has(code);
  }
  mouseDown(b: number) {
    return this.btn[b];
  }
  mousePressed(b: number) {
    return this.btnPressed[b];
  }
  /** Dokunmatik tuş: basınca o kare "basıldı", bırakılana kadar "basılı" sayılır. */
  hold(code: string, on: boolean) {
    if (on) {
      if (!this.held.has(code)) this.keyPressed.add(code);
      this.held.add(code);
    } else this.held.delete(code);
  }
  /** Test/debug için: tuşa basılmış gibi davran. */
  simulatePress(code: string) {
    this.keyPressed.add(code);
  }
  simulateMouse(b: number, down: boolean) {
    this.btn[b] = down;
    if (down) this.btnPressed[b] = true;
  }
  /** Fareyi kilitlemeyi dener; tarayıcı reddederse oyun serbest imleçle sürer. */
  requestLock() {
    if (this.touch) return; // dokunmatik ekranda kilitlenecek fare yok
    try {
      const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      /* kilit yok: serbest imleç */
    }
  }
  private releaseTouch() {
    this.held.clear();
    this.stickX = 0;
    this.stickY = 0;
    this.lookDX = 0;
    this.lookDY = 0;
  }
  /** Pencere odağı kaybedilince ya da oyun duraklayınca basılı her şeyi bırak. */
  releaseAll() {
    this.keys.clear();
    this.btn.fill(false);
    this.releaseTouch();
  }
  endFrame() {
    this.keyPressed.clear();
    this.btnPressed.fill(false);
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.freeDX = 0;
    this.freeDY = 0;
    this.dragDX = 0;
    this.dragDY = 0;
    this.lookDX = 0;
    this.lookDY = 0;
  }
}
