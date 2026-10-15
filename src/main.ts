import './style.css';
import { Audio } from './gm/audio';
import { dialogHooks, dialogs } from './gm/dialogs';
import { Input } from './gm/input';
import { Renderer } from './gm/render';
import { Runtime } from './gm/runtime';
import type { GameData, RoomData } from './gm/types';
import { makePatches } from './patches';
import { Hud } from './ui/hud';
import { Shop } from './ui/shop';
import { modalOpen, openSaves, showMessage } from './ui/modals';
import { TitleScreen } from './ui/title';

const BASE = 'classic/';
const AUTOSAVE = 'Autoguardado';
const AUTOSAVE_MS = 60_000;

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const help = document.getElementById('help')!;
const helpOpen = () => help.classList.contains('open');
help.querySelector('button')!.addEventListener('click', () => help.classList.remove('open'));
window.addEventListener('keydown', (e) => {
  if (helpOpen() && (e.key === 'Escape' || e.key === 'F1')) { e.preventDefault(); help.classList.remove('open'); }
}, true);

const title = new TitleScreen(`${BASE}backgrounds/bkg_title.png`, {
  newGame: () => game?.newGame(),
  continueGame: (name) => game?.continueGame(name),
  load: () => openSaves('load', { load: (name) => game?.continueGame(name) }),
  help: () => game && dialogs.info(game.rt.data.helpRtf),
});
document.getElementById('ui')!.append(title.el);

let game: Game | null = null;

class Game {
  rt: Runtime;
  hud: Hud;
  shop!: Shop;
  private titleRoom: number;
  private ranchRoom: number;
  private leavingTitle = false;
  private userZoom = 1;
  private lastAutosave = performance.now();

  constructor(public data: GameData, public render: Renderer, public audio: Audio, input: Input) {
    this.rt = new Runtime(data, render, input, audio, makePatches({
      ui_save_dialog: () => this.saveDialog(),
      ui_load_dialog: () => this.loadDialog(),
      ui_tooltip: (text) => this.shop?.tooltip(text),
    }));
    this.titleRoom = data.roomOrder[0];
    this.ranchRoom = data.resources.rooms.indexOf('room_ranch');
    this.rt.viewSizer = (room) => this.viewSizeFor(room);
    this.hud = new Hud(this.rt, (i, f) => this.spriteUrl(i, f), {
      save: () => this.saveDialog(),
      load: () => this.loadDialog(),
      help: () => dialogs.info(data.helpRtf),
      menu: () => this.toMenu(),
      zoom: (k) => this.zoom(k),
      fullscreen: () => render.toggleFullscreen(),
      toggleMute: () => { audio.setMuted(!audio.muted); return audio.muted; },
    });
    this.shop = new Shop(this.rt, render, () => { canvas.focus(); this.rt.draw(); });
    this.hud.el.append(this.shop.el);
    document.getElementById('ui')!.append(this.hud.el);
    this.hud.show(false);

    window.addEventListener('resize', () => this.layout());
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!this.paused) this.zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1);
    }, { passive: false });
    window.addEventListener('beforeunload', () => this.autosave());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.autosave(); });
  }

  get paused() { return title.visible || modalOpen() || helpOpen(); }

  spriteUrl(index: number, frame: number) {
    const name = this.data.resources.sprites[Math.round(index)];
    const s = name ? this.data.sprites[name] : null;
    if (!s) return '';
    return `${BASE}sprites/${s.file}_${((Math.floor(frame) % s.frames) + s.frames) % s.frames}.png`;
  }

  // ---------- Pantalla y zoom ----------

  /** Zoom (píxeles de pantalla por píxel del juego) para que la vista no sea mayor que el room. */
  private zoomLimits(room: RoomData) {
    const fit = Math.max(window.innerWidth / room.width, window.innerHeight / room.height);
    const base = Math.max(fit, 1, window.innerWidth / 1440);
    return { fit, base };
  }

  private viewSizeFor(room: RoomData) {
    // Rooms pequeños (el título) se muestran enteros, escalados.
    if (room.width <= 1024 && room.height <= 768) return { width: room.width, height: room.height };
    const { fit, base } = this.zoomLimits(room);
    const zoom = Math.max(fit, Math.min(4, base * this.userZoom));
    return { width: window.innerWidth / zoom, height: window.innerHeight / zoom };
  }

  layout() {
    const rt = this.rt;
    if (!rt.roomData) return;
    const size = this.viewSizeFor(rt.roomData);
    rt.setViewSize(size.width, size.height);
    const v = rt.views[0];
    const s = Math.min(window.innerWidth / v.width, window.innerHeight / v.height);
    const cssW = Math.round(v.width * s);
    const cssH = Math.round(v.height * s);
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    rt.draw();
  }

  zoom(k: number) {
    const rt = this.rt;
    const room = rt.roomData;
    if (!room || (room.width <= 1024 && room.height <= 768)) return;
    const { fit, base } = this.zoomLimits(room);
    const v = rt.views[0];
    // Mantiene fijo el punto bajo el ratón.
    const fx = rt.input.mouseX / v.width;
    const fy = rt.input.mouseY / v.height;
    const wx = v.left + rt.input.mouseX;
    const wy = v.top + rt.input.mouseY;
    this.userZoom = Math.max(fit / base, Math.min(4 / base, this.userZoom * k));
    const size = this.viewSizeFor(room);
    v.width = size.width;
    v.height = size.height;
    v.left = wx - fx * v.width;
    v.top = wy - fy * v.height;
    rt.clampView();
    this.layout();
  }

  // ---------- Partidas ----------

  newGame() {
    this.audio.unlock();
    this.rt.startGame();
    this.rt.gotoRoom(this.ranchRoom);
    this.enterGame();
  }

  continueGame(name: string) {
    this.audio.unlock();
    this.rt.startGame();
    this.rt.requestLoad(name);
    this.enterGame();
  }

  private enterGame() {
    this.leavingTitle = true;
    title.hide();
    this.hud.show(true);
    this.lastAutosave = performance.now();
    canvas.focus();
  }

  private toMenu() {
    if (!confirm('¿Volver al menú principal? La partida se guardará como "Autoguardado".')) return;
    this.autosave();
    this.showTitle();
  }

  private showTitle() {
    this.audio.stopAll();
    this.hud.show(false);
    title.show();
  }

  private inRanch() { return !title.visible && this.rt.room !== this.titleRoom; }

  autosave() {
    if (this.inRanch()) this.rt.F.game_save(null as never, null as never, AUTOSAVE);
  }

  saveDialog() {
    openSaves('save', {
      save: (name) => { this.rt.F.game_save(null as never, null as never, name); this.hud.toast(`💾 Partida guardada: ${name}`); },
      load: (name) => this.rt.requestLoad(name),
    });
  }

  loadDialog() {
    openSaves('load', { load: (name) => { this.rt.requestLoad(name); this.hud.toast(`📂 Partida cargada: ${name}`); } });
  }

  // ---------- Bucle ----------

  start() {
    let last = performance.now();
    let acc = 0;
    let frames = 0;
    let fpsTime = last;
    let lastRoom = -1;
    const loop = (now: number) => {
      const dt = Math.min(250, now - last);
      last = now;
      const rt = this.rt;
      if (!this.paused && rt.room >= 0) {
        acc += dt;
        const stepMs = 1000 / rt.roomSpeed;
        let n = 0;
        while (acc >= stepMs && n < 8 && !this.paused) {
          rt.step();
          acc -= stepMs;
          n++;
          frames++;
        }
        if (n === 8) acc = 0;
        if (rt.room !== lastRoom) { lastRoom = rt.room; this.layout(); }
        if (n > 0) rt.draw();
        if (now - this.lastAutosave > AUTOSAVE_MS) { this.lastAutosave = now; this.autosave(); }
      } else {
        acc = 0;
      }
      if (now - fpsTime >= 1000) {
        rt.fpsMeasured = (frames * 1000) / (now - fpsTime);
        frames = 0;
        fpsTime = now;
      }
      // Volver al título: reinicio (F2), salir (Esc) o el juego vuelve a su primer room.
      if (rt.room !== this.titleRoom) this.leavingTitle = false;
      if (rt.ended || (!title.visible && rt.room === this.titleRoom && !this.leavingTitle)) {
        rt.ended = false;
        this.showTitle();
      }
      if (!title.visible) { this.shop.update(); this.hud.update(); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

async function boot() {
  title.setProgress(0, 1, 'Cargando datos…');
  const data = (await (await fetch(`${BASE}game.json`)).json()) as GameData;
  const render = new Renderer(canvas, data, BASE);
  const audio = new Audio(data, BASE);
  let g: Game | null = null;
  const input = new Input(canvas, () => !!g?.paused, () => g?.rt.views[0] ?? { width: canvas.width, height: canvas.height });
  await Promise.all([
    render.load((done, total) => title.setProgress(done, total, `Cargando sprites… ${Math.round((done / total) * 100)}%`)),
    audio.load(),
  ]);
  g = new Game(data, render, audio, input);
  game = g;
  dialogHooks.message = (msg) => { input.clear(); showMessage(msg); };
  if (import.meta.env.DEV) Object.assign(window, { rt: g.rt, game: g });
  g.start();
  title.showMenu();
}

boot().catch((e) => {
  console.error(e);
  title.setProgress(0, 1, `Error al cargar: ${(e as Error).message}`);
});
