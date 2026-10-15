// Teclado y ratón con los códigos de tecla de Game Maker (los mismos que keyCode de Windows).

export class Input {
  mouseX = 0;
  mouseY = 0;
  /** Botones [izquierdo, central, derecho] (orden de MouseEvent.button). */
  down = [false, false, false];
  pressed = [false, false, false];
  released = [false, false, false];
  lastKey = 0;
  private keys = new Set<number>();
  private keysPressed = new Set<number>();
  private keysReleased = new Set<number>();
  private map = new Map<number, number>();

  constructor(
    private canvas: HTMLCanvasElement,
    private isBlocked: () => boolean,
    /** Tamaño de la vista en píxeles del juego. */
    private viewSize: () => { width: number; height: number },
  ) {
    window.addEventListener('keydown', (e) => {
      if (this.isBlocked()) return;
      const k = this.mapKey(e.keyCode);
      // Teclas que el navegador usaría para otra cosa (F1, F5, flechas...).
      if ((k >= 112 && k <= 123) || (k >= 33 && k <= 40) || k === 32 || k === 13) e.preventDefault();
      if (!this.keys.has(k)) this.keysPressed.add(k);
      this.keys.add(k);
      this.lastKey = k;
    });
    window.addEventListener('keyup', (e) => {
      const k = this.mapKey(e.keyCode);
      this.keys.delete(k);
      this.keysReleased.add(k);
    });
    window.addEventListener('blur', () => this.clear());
    canvas.addEventListener('pointermove', (e) => this.updateMouse(e));
    canvas.addEventListener('pointerdown', (e) => {
      if (this.isBlocked()) return;
      this.updateMouse(e);
      canvas.setPointerCapture(e.pointerId);
      if (e.button <= 2) { this.down[e.button] = true; this.pressed[e.button] = true; }
      e.preventDefault();
    });
    canvas.addEventListener('pointerup', (e) => {
      this.updateMouse(e);
      if (e.button <= 2 && this.down[e.button]) { this.down[e.button] = false; this.released[e.button] = true; }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('auxclick', (e) => e.preventDefault());
  }

  private updateMouse(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    const v = this.viewSize();
    this.mouseX = Math.floor(((e.clientX - r.left) / r.width) * v.width);
    this.mouseY = Math.floor(((e.clientY - r.top) / r.height) * v.height);
  }

  private mapKey(k: number) { return this.map.get(k) ?? k; }

  /** Simula pulsar una tecla (para los botones de la interfaz web). */
  tap(key: number) {
    this.keysPressed.add(key);
    this.lastKey = key;
  }

  setMap(from: number, to: number) { this.map.set(Math.round(from), Math.round(to)); }
  clearMap() { this.map.clear(); }

  check(key: number) {
    if (key === 1) return this.keys.size > 0;
    if (key === 0) return this.keys.size === 0;
    return this.keys.has(Math.round(key));
  }
  checkPressed(key: number) { return this.keysPressed.has(Math.round(key)); }
  held() { return [...this.keys]; }
  takePressed() { return [...this.keysPressed]; }
  takeReleased() { return [...this.keysReleased]; }

  checkButton(b: number) {
    if (b === -1) return this.down.some(Boolean);
    if (b === 0) return !this.down.some(Boolean);
    return this.down[b === 1 ? 0 : b === 2 ? 2 : 1];
  }

  mouseButton() { return this.down[0] ? 1 : this.down[2] ? 2 : this.down[1] ? 3 : 0; }

  endStep() {
    this.keysPressed.clear();
    this.keysReleased.clear();
    this.pressed = [false, false, false];
    this.released = [false, false, false];
  }

  /** Tras un diálogo, el navegador no envía los keyup: se vacía el estado (como io_clear). */
  clear() {
    this.keys.clear();
    this.keysPressed.clear();
    this.keysReleased.clear();
    this.down = [false, false, false];
    this.pressed = [false, false, false];
    this.released = [false, false, false];
  }
}
