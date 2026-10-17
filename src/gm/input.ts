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
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') { this.touchMove(e); return; }
      this.updateMouse(e);
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (this.isBlocked()) return;
      try { canvas.setPointerCapture(e.pointerId); } catch { /* puntero ya levantado */ }
      e.preventDefault();
      if (e.pointerType === 'touch') { this.touchDown(e); return; }
      this.updateMouse(e);
      this.press(e.button);
    });
    canvas.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') { this.touchUp(e); return; }
      this.updateMouse(e);
      this.release(e.button);
    });
    canvas.addEventListener('pointercancel', (e) => {
      if (e.pointerType === 'touch') this.touchUp(e);
      else this.release(e.button);
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

  private press(b: number) {
    if (b <= 2) { this.down[b] = true; this.pressed[b] = true; }
  }

  private release(b: number) {
    if (b <= 2 && this.down[b]) { this.down[b] = false; this.released[b] = true; }
  }

  // ---------- Pantallas táctiles ----------
  // Un dedo hace de ratón con el botón elegido en la barra (touchButton).
  // Un dedo sobre el suelo, o dos dedos, mueven la vista; separar o juntar dos dedos hace zoom.

  /** Botón del ratón que simula un toque: 0 izquierdo, 2 derecho, 1 central. */
  touchButton = 0;
  /** Gestos de cámara (en píxeles CSS). Los asigna el juego. */
  gestures: {
    /** ¿Hay algo bajo el punto (píxeles del juego) que responda al ratón? Si no, el dedo arrastra la vista. */
    grabbable: (x: number, y: number) => boolean;
    pan: (dx: number, dy: number) => void;
    pinch: (factor: number, clientX: number, clientY: number) => void;
  } | null = null;
  private touches = new Map<number, { x: number; y: number }>();
  /** Dedo que hace de ratón, o -1. */
  private mouseTouch = -1;
  private touchPressed = 0;
  /** El gesto actual mueve la vista en vez de hacer de ratón (dura hasta levantar todos los dedos). */
  private panning = false;

  private touchDown(e: PointerEvent) {
    this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.touches.size === 1) {
      this.updateMouse(e);
      if (this.gestures && !this.gestures.grabbable(this.mouseX, this.mouseY)) { this.panning = true; return; }
      this.panning = false;
      this.mouseTouch = e.pointerId;
      this.touchPressed = this.touchButton;
      this.press(this.touchPressed);
    } else if (!this.panning) {
      // Segundo dedo: se suelta lo que se arrastraba y se pasa a mover la vista.
      this.endMouseTouch();
      this.panning = true;
    }
  }

  private touchMove(e: PointerEvent) {
    const t = this.touches.get(e.pointerId);
    if (!t) return;
    if (e.pointerId === this.mouseTouch) { this.updateMouse(e); t.x = e.clientX; t.y = e.clientY; return; }
    if (!this.panning || !this.gestures) { t.x = e.clientX; t.y = e.clientY; return; }
    const before = this.centroid();
    t.x = e.clientX;
    t.y = e.clientY;
    const after = this.centroid();
    if (after.spread > 0 && before.spread > 0) this.gestures.pinch(after.spread / before.spread, after.x, after.y);
    this.gestures.pan(after.x - before.x, after.y - before.y);
  }

  private touchUp(e: PointerEvent) {
    if (!this.touches.delete(e.pointerId)) return;
    if (e.pointerId === this.mouseTouch) { this.updateMouse(e); this.endMouseTouch(); }
    if (this.touches.size === 0) this.panning = false;
  }

  private endMouseTouch() {
    if (this.mouseTouch < 0) return;
    this.mouseTouch = -1;
    this.release(this.touchPressed);
  }

  /** Punto medio de los dedos y distancia media al centro. */
  private centroid() {
    let x = 0, y = 0;
    for (const t of this.touches.values()) { x += t.x; y += t.y; }
    const n = this.touches.size;
    x /= n; y /= n;
    let spread = 0;
    if (n > 1) for (const t of this.touches.values()) spread += Math.hypot(t.x - x, t.y - y) / n;
    return { x, y, spread };
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
    this.touches.clear();
    this.mouseTouch = -1;
    this.panning = false;
    this.keys.clear();
    this.keysPressed.clear();
    this.keysReleased.clear();
    this.down = [false, false, false];
    this.pressed = [false, false, false];
    this.released = [false, false, false];
  }
}
