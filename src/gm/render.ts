// Dibujo con Canvas 2D siguiendo el modelo de Game Maker 5
// (variables globales font_*, brush_* y pen_*; '#' como salto de línea).
import type { Instance } from './instance';
import type { Runtime } from './runtime';
import type { GameData, RoomData, SpriteData } from './types';

const css = (c: number) => `rgb(${c & 255},${(c >> 8) & 255},${(c >> 16) & 255})`;

/** Rectángulo en coordenadas del juego. */
export interface CaptureRect { l: number; t: number; r: number; b: number }

export class Renderer {
  ctx: CanvasRenderingContext2D;
  /** Mientras se captura, los textos se entregan aquí en lugar de dibujarse. */
  private textSink: ((s: string) => void) | null = null;
  /** Mientras se captura: zona (en coordenadas del juego) que ocupan las imágenes dibujadas. */
  private captureRects: CaptureRect[] | null = null;
  /** Traducción de los textos del juego al dibujarlos (la pone la interfaz según el idioma). */
  translate: (s: string) => string = (s) => s;
  private sprites = new Map<number, HTMLImageElement[]>();
  private masks = new Map<number, Uint8Array[]>();
  private backgrounds = new Map<string, HTMLImageElement>();
  private room!: RoomData;
  /** Transformación de la vista actual (para dibujar imágenes ajustadas a píxeles de pantalla). */
  private kx = 1;
  private ky = 1;
  private vl = 0;
  private vt = 0;

  font_name = 'Arial';
  font_size = 12;
  font_color = 0;
  font_style = 0;
  font_angle = 0;
  font_align = 0;
  brush_color = 0xffffff;
  brush_style = 0;
  pen_color = 0;
  pen_size = 1;

  constructor(public canvas: HTMLCanvasElement, private data: GameData, private base: string) {
    this.ctx = canvas.getContext('2d')!;
  }

  /** Carga todas las imágenes del juego. */
  async load(onProgress: (done: number, total: number) => void) {
    const jobs: (() => Promise<void>)[] = [];
    const img = (src: string) => new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error(`No se pudo cargar ${src}`));
      i.src = src;
    });
    for (const s of Object.values(this.data.sprites)) {
      const frames: HTMLImageElement[] = [];
      this.sprites.set(s.id, frames);
      for (let f = 0; f < s.frames; f++) {
        jobs.push(async () => { frames[f] = await img(`${this.base}sprites/${s.file}_${f}.png`); });
      }
    }
    for (const [name, b] of Object.entries(this.data.backgrounds)) {
      if (b.hasImage) jobs.push(async () => { this.backgrounds.set(name, await img(`${this.base}backgrounds/${name}.png`)); });
    }
    let done = 0;
    const total = jobs.length;
    const queue = [...jobs];
    await Promise.all(new Array(12).fill(0).map(async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        await job();
        onProgress(++done, total);
      }
    }));
    this.buildMasks();
  }

  /** Máscaras de píxeles para los sprites con colisión precisa. */
  private buildMasks() {
    const c = document.createElement('canvas');
    const g = c.getContext('2d', { willReadFrequently: true })!;
    for (const s of Object.values(this.data.sprites)) {
      if (!s.precise) continue;
      const frames = this.sprites.get(s.id) ?? [];
      c.width = s.w;
      c.height = s.h;
      this.masks.set(s.id, frames.map((im) => {
        g.clearRect(0, 0, s.w, s.h);
        if (im) g.drawImage(im, 0, 0);
        const d = g.getImageData(0, 0, s.w, s.h).data;
        const m = new Uint8Array(s.w * s.h);
        for (let k = 0; k < m.length; k++) m[k] = d[k * 4 + 3] > 0 ? 1 : 0;
        return m;
      }));
    }
  }

  solidPixel(s: SpriteData, frame: number, px: number, py: number) {
    if (px < 0 || py < 0 || px >= s.w || py >= s.h) return false;
    const m = this.masks.get(s.id)?.[frame];
    return m ? m[py * s.w + px] === 1 : true;
  }

  /** El tamaño del canvas lo decide quien maqueta la página (ver main.ts). */
  setRoom(room: RoomData) {
    this.room = room;
  }

  resetDrawState() {
    Object.assign(this, { font_name: 'Arial', font_size: 12, font_color: 0, font_style: 0, font_angle: 0, font_align: 0, brush_color: 0xffffff, brush_style: 0, pen_color: 0, pen_size: 1 });
  }

  drawState() {
    const { font_name, font_size, font_color, font_style, font_angle, font_align, brush_color, brush_style, pen_color, pen_size } = this;
    return { font_name, font_size, font_color, font_style, font_angle, font_align, brush_color, brush_style, pen_color, pen_size };
  }

  setDrawState(s: Record<string, any>) { Object.assign(this, s); }

  beginFrame(rt: Runtime) {
    const g = this.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    g.fillStyle = this.room.drawColor ? css(this.room.color) : '#000';
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    // La vista (en píxeles del juego) se escala a la resolución real del canvas.
    const v = rt.views[0];
    this.kx = this.canvas.width / v.width;
    this.ky = this.canvas.height / v.height;
    this.vl = v.left;
    this.vt = v.top;
    this.viewTransform();
  }

  private viewTransform() {
    this.ctx.setTransform(this.kx, 0, 0, this.ky, -this.vl * this.kx, -this.vt * this.ky);
  }

  /**
   * Dibuja una imagen con sus bordes redondeados a píxeles del canvas. Con escalas no enteras
   * evita las líneas finas entre baldosas que aparecerían con drawImage escalado.
   */
  private blit(im: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, x: number, y: number, w: number, h: number) {
    this.captureRects?.push({ l: x, t: y, r: x + w, b: y + h });
    const x0 = Math.round((x - this.vl) * this.kx);
    const y0 = Math.round((y - this.vt) * this.ky);
    const x1 = Math.round((x + w - this.vl) * this.kx);
    const y1 = Math.round((y + h - this.vt) * this.ky);
    if (x1 <= 0 || y1 <= 0 || x0 >= this.canvas.width || y0 >= this.canvas.height) return;
    const g = this.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(im, sx, sy, sw, sh, x0, y0, x1 - x0, y1 - y0);
    this.viewTransform();
  }

  drawScene(rt: Runtime, list: Instance[]) {
    this.drawBackgrounds(rt, false);
    type Item = { depth: number; seq: number; draw: () => void };
    const items: Item[] = list.map((i) => ({ depth: i.depth, seq: i.seq, draw: () => rt.drawInstance(i) }));
    this.room.tiles.forEach((t, k) => {
      const im = t.background ? this.backgrounds.get(t.background) : undefined;
      if (im) items.push({ depth: t.depth, seq: -1e6 + k, draw: () => this.blit(im, t.tx, t.ty, t.w, t.h, t.x, t.y, t.w, t.h) });
    });
    items.sort((a, b) => b.depth - a.depth || a.seq - b.seq);
    for (const it of items) it.draw();
    this.drawBackgrounds(rt, true);
  }

  private drawBackgrounds(rt: Runtime, foreground: boolean) {
    this.room.backgrounds.forEach((b, i) => {
      if (b.foreground !== foreground || !rt.backgroundVisible[i] || !b.background) return;
      const im = this.backgrounds.get(b.background);
      if (!im) return;
      if (b.stretch) { this.blit(im, 0, 0, im.width, im.height, 0, 0, rt.roomWidth, rt.roomHeight); return; }
      const v = rt.views[0];
      const x0 = b.tileH ? b.x + Math.floor((v.left - b.x) / im.width) * im.width : b.x;
      const y0 = b.tileV ? b.y + Math.floor((v.top - b.y) / im.height) * im.height : b.y;
      const x1 = b.tileH ? v.left + v.width : x0 + 1;
      const y1 = b.tileV ? v.top + v.height : y0 + 1;
      for (let y = y0; y < y1; y += im.height) for (let x = x0; x < x1; x += im.width) this.blit(im, 0, 0, im.width, im.height, x, y, im.width, im.height);
    });
  }

  /**
   * Dibuja `fn` en otro canvas, con la zona del juego que empieza en (left, top) a escala `scale`.
   * Los textos no se dibujan: se pasan a `onText`. Se usa para mostrar objetos del juego en HTML.
   * Devuelve la zona del juego que ocupa cada imagen dibujada (aunque se salga del canvas).
   */
  capture(target: HTMLCanvasElement, left: number, top: number, scale: number, fn: () => void, onText: (s: string) => void) {
    const rects: CaptureRect[] = [];
    const saved = { canvas: this.canvas, ctx: this.ctx, kx: this.kx, ky: this.ky, vl: this.vl, vt: this.vt };
    const state = this.drawState();
    this.canvas = target;
    this.ctx = target.getContext('2d')!;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, target.width, target.height);
    this.ctx.imageSmoothingEnabled = false;
    Object.assign(this, { kx: scale, ky: scale, vl: left, vt: top });
    this.viewTransform();
    this.textSink = onText;
    this.captureRects = rects;
    try { fn(); } finally {
      this.textSink = null;
      this.captureRects = null;
      Object.assign(this, saved);
      this.setDrawState(state);
    }
    return rects;
  }

  // ---------- Primitivas ----------

  drawSprite(index: number, frame: number, x: number, y: number) {
    const s = this.spriteData(index);
    if (!s) return;
    const im = this.frameImage(s, frame);
    if (im) this.blit(im, 0, 0, im.width, im.height, Math.round(x - s.ox), Math.round(y - s.oy), im.width, im.height);
  }

  drawSpriteStretched(index: number, frame: number, x: number, y: number, w: number, h: number) {
    const s = this.spriteData(index);
    if (!s) return;
    const im = this.frameImage(s, frame);
    if (im) this.blit(im, 0, 0, im.width, im.height, x, y, w, h);
  }

  private spriteData(index: number): SpriteData | null {
    const name = this.data.resources.sprites[Math.round(index)];
    return name ? this.data.sprites[name] : null;
  }

  private frameImage(s: SpriteData, frame: number) {
    const frames = this.sprites.get(s.id);
    if (!frames?.length) return null;
    return frames[((Math.floor(frame) % frames.length) + frames.length) % frames.length];
  }

  private applyFont() {
    const px = Math.max(1, Math.round((this.font_size * 96) / 72));
    const bold = this.font_style & 1 ? 'bold ' : '';
    const italic = this.font_style & 2 ? 'italic ' : '';
    this.ctx.font = `${italic}${bold}${px}px "${this.font_name}", Arial, sans-serif`;
    this.ctx.textBaseline = 'top';
    return px;
  }

  /** Separa en líneas por '#' y, si hay ancho máximo, por palabras. */
  private lines(str: string, w: number) {
    const out: string[] = [];
    for (const para of this.translate(String(str)).split('#')) {
      if (w <= 0) { out.push(para); continue; }
      let line = '';
      for (const word of para.split(' ')) {
        const tryLine = line ? `${line} ${word}` : word;
        if (line && this.ctx.measureText(tryLine).width > w) { out.push(line); line = word; }
        else line = tryLine;
      }
      out.push(line);
    }
    return out;
  }

  private lineHeight(px: number, sep: number) { return sep > 0 ? sep : Math.round(px * 1.2); }

  drawText(x: number, y: number, str: string) { this.drawTextExt(x, y, str, -1, -1); }

  drawTextExt(x: number, y: number, str: string, sep: number, w: number) {
    if (this.textSink) { this.textSink(this.translate(String(str)).replace(/#/g, '\n')); return; }
    const px = this.applyFont();
    const g = this.ctx;
    g.fillStyle = css(this.font_color);
    g.textAlign = this.font_align === 1 ? 'center' : this.font_align === 2 ? 'right' : 'left';
    const lh = this.lineHeight(px, sep);
    this.lines(str, w).forEach((ln, k) => g.fillText(ln, Math.round(x), Math.round(y + k * lh)));
    g.textAlign = 'left';
  }

  stringWidthExt(str: string, _sep: number, w: number) {
    this.applyFont();
    return Math.max(0, ...this.lines(str, w).map((l) => this.ctx.measureText(l).width));
  }

  stringHeightExt(str: string, sep: number, w: number) {
    const px = this.applyFont();
    return this.lines(str, w).length * this.lineHeight(px, sep);
  }

  drawRectangle(x1: number, y1: number, x2: number, y2: number) {
    const g = this.ctx;
    const l = Math.min(x1, x2), t = Math.min(y1, y2);
    const w = Math.abs(x2 - x1) + 1, h = Math.abs(y2 - y1) + 1;
    if (this.brush_style !== 1) { g.fillStyle = css(this.brush_color); g.fillRect(l, t, w, h); }
    if (this.pen_size > 0) {
      g.strokeStyle = css(this.pen_color);
      g.lineWidth = this.pen_size;
      g.strokeRect(l + 0.5, t + 0.5, w - 1, h - 1);
    }
  }

  drawEllipse(x1: number, y1: number, x2: number, y2: number) {
    const g = this.ctx;
    g.beginPath();
    g.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
    if (this.brush_style !== 1) { g.fillStyle = css(this.brush_color); g.fill(); }
    if (this.pen_size > 0) { g.strokeStyle = css(this.pen_color); g.lineWidth = this.pen_size; g.stroke(); }
  }

  drawLine(x1: number, y1: number, x2: number, y2: number) {
    const g = this.ctx;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.strokeStyle = css(this.pen_color);
    g.lineWidth = Math.max(1, this.pen_size);
    g.stroke();
  }

  toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  }
}
