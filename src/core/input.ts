/**
 * Klavye + serbest fare imleci. İmleç kilitlenmez:
 * sol tık kanca/vuruş, sağ tık yürüme hedefi, tekerlek kamerayı döndürür.
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

  constructor(canvas: HTMLCanvasElement) {
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
    window.addEventListener('mousemove', (e) => {
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
  endFrame() {
    this.keyPressed.clear();
    this.btnPressed.fill(false);
    this.dragDX = 0;
    this.dragDY = 0;
  }
}
