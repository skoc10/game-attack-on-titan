/**
 * Klavye + fare. Tarayıcı izin verirse fare kilitlenir ve fare hareketi
 * kamerayı çevirir; izin vermezse imleç serbest kalır ve imlecin ekran
 * ortasından uzaklığı kamerayı döndürür.
 */
export class Input {
  readonly keys = new Set<string>();
  private readonly keyPressed = new Set<string>();
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
  mouseDY = 0;
  locked = false;
  /** İmleç pencerenin içinde mi (serbest imleçle dönüş için). */
  inside = true;

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      if (!e.repeat) this.keyPressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.btn.fill(false);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1) e.preventDefault(); // tarayıcının otomatik kaydırmasını engelle
      if (e.button < 3) {
        this.btn[e.button] = true;
        this.btnPressed[e.button] = true;
      }
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button < 3) this.btn[e.button] = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
    });
    document.addEventListener('mouseleave', () => (this.inside = false));
    document.addEventListener('mouseenter', () => (this.inside = true));
    window.addEventListener('mousemove', (e) => {
      this.inside = true;
      if (this.locked) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
        return;
      }
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
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

  down(code: string) {
    return this.keys.has(code);
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
    try {
      const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      /* kilit yok: serbest imleç */
    }
  }
  endFrame() {
    this.keyPressed.clear();
    this.btnPressed.fill(false);
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.dragDX = 0;
    this.dragDY = 0;
  }
}
