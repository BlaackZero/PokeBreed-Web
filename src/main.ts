import './style.css';
import { Audio } from './gm/audio';
import { dialogHooks, dialogs, rtfToText } from './gm/dialogs';
import { Input } from './gm/input';
import { Renderer } from './gm/render';
import { Runtime } from './gm/runtime';
import type { Instance } from './gm/instance';
import type { GameData, RoomData } from './gm/types';
import { bind, getLang, onLangChange, t, tg } from './i18n';
import { HELP_ES } from './i18n/game-es';
import { makePatches } from './patches';
import { login } from './save/cloud';
import { SaveStore } from './save/store';
import { formatDate, formatMoney } from './ui/dom';
import { Hud } from './ui/hud';
import { Shop } from './ui/shop';
import { modalOpen, showMessage } from './ui/modals';
import { TitleScreen } from './ui/title';

const BASE = 'classic/';
/** Autoguardado periódico. */
const AUTOSAVE_MS = 15_000;
/** Tras comprar, vender o cobrar (cambia el dinero), se guarda a los pocos segundos. */
const AUTOSAVE_AFTER_CHANGE_MS = 3_000;

const store = new SaveStore();

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const help = document.getElementById('help')!;
const helpOpen = () => help.classList.contains('open');
help.querySelector('button')!.addEventListener('click', () => help.classList.remove('open'));
bind(help.querySelector('h2')!, () => t('howToPlay'));
bind(help.querySelector('button')!, () => t('closeEsc'));

// Idioma de los textos del juego original: dibujados, mensajes, preguntas y ayuda.
dialogHooks.translate = tg;
dialogHooks.help = (rtf) => (getLang() === 'es' ? HELP_ES : rtfToText(rtf));
dialogHooks.choiceHint = (first, last) => t('choiceHint', { first, last });
window.addEventListener('keydown', (e) => {
  if (helpOpen() && (e.key === 'Escape' || e.key === 'F1')) { e.preventDefault(); help.classList.remove('open'); }
}, true);

const title = new TitleScreen(`${BASE}backgrounds/bkg_title.png`, store, {
  newGame: () => game?.newGame(),
  continueGame: () => game?.continueGame(),
  help: () => game && dialogs.info(game.rt.data.helpRtf),
  login,
  logout: () => void store.logout().then(() => title.showMenu()),
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
  private lastMoney: unknown = undefined;
  private moneyChangedAt = 0;

  constructor(public data: GameData, public render: Renderer, public audio: Audio, input: Input) {
    this.rt = new Runtime(data, render, input, audio, makePatches({
      // F5 y F6 del original: la partida se guarda sola.
      ui_save_dialog: () => { this.autosave(true); this.hud.toast(t('savedToast')); },
      ui_load_dialog: () => this.hud.toast(t('autosaveHint')),
      ui_tooltip: (text) => this.shop?.tooltip(text),
    }));
    render.translate = tg;
    onLangChange(() => {
      // La ayuda abierta y el canvas se rehacen en el idioma nuevo.
      if (helpOpen()) dialogs.info(data.helpRtf);
      if (this.rt.roomData) this.rt.draw();
    });
    this.titleRoom = data.roomOrder[0];
    this.ranchRoom = data.resources.rooms.indexOf('room_ranch');
    this.rt.viewSizer = (room) => this.viewSizeFor(room);
    this.hud = new Hud(this.rt, (i, f) => this.spriteUrl(i, f), {
      help: () => dialogs.info(data.helpRtf),
      menu: () => this.toMenu(),
      zoom: (k) => this.zoom(k),
      fullscreen: () => render.toggleFullscreen(),
      toggleMute: () => { audio.setMuted(!audio.muted); return audio.muted; },
    }, store);
    this.shop = new Shop(this.rt, render, () => { canvas.focus(); this.rt.draw(); });
    this.hud.el.append(this.shop.el);
    document.getElementById('ui')!.append(this.hud.el);
    this.hud.show(false);

    window.addEventListener('resize', () => this.layout());
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (!this.paused) this.zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1);
    }, { passive: false });
    this.touchGestures(input);
    // En el móvil la página puede cerrarse sin avisar: se guarda al pasar a segundo plano.
    window.addEventListener('pagehide', () => this.autosave(true));
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.autosave(true); });
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

  /** Zoom manteniendo fijo un punto de la vista (por defecto, el que hay bajo el ratón). */
  zoom(k: number, at = { x: this.rt.input.mouseX, y: this.rt.input.mouseY }) {
    const rt = this.rt;
    const room = rt.roomData;
    if (!room || (room.width <= 1024 && room.height <= 768)) return;
    const { fit, base } = this.zoomLimits(room);
    const v = rt.views[0];
    const fx = at.x / v.width;
    const fy = at.y / v.height;
    const wx = v.left + at.x;
    const wy = v.top + at.y;
    this.userZoom = Math.max(fit / base, Math.min(4 / base, this.userZoom * k));
    const size = this.viewSizeFor(room);
    v.width = size.width;
    v.height = size.height;
    v.left = wx - fx * v.width;
    v.top = wy - fy * v.height;
    rt.clampView();
    this.layout();
  }

  /** Pantallas táctiles: arrastrar el suelo mueve la vista y dos dedos hacen zoom. */
  private touchGestures(input: Input) {
    const rt = this.rt;
    const terrainParent = rt.objectByIndex(this.data.resources.objects.indexOf('obj_terrain_edit_parent'));
    const terrain = new Set(terrainParent?.family ?? []);
    // Vallas y terrenos solo responden al ratón en el modo terreno.
    const accept = (i: Instance) => Number(rt.globals.terrain_edit) === 1 || !terrain.has(i.obj);
    const scale = () => rt.views[0].width / canvas.getBoundingClientRect().width;
    input.gestures = {
      grabbable: (x, y) => !!rt.mouseTargetAt(x, y, accept),
      pan: (dx, dy) => {
        const v = rt.views[0];
        const s = scale();
        v.left -= dx * s;
        v.top -= dy * s;
        rt.clampView();
        rt.draw();
      },
      pinch: (k, cx, cy) => {
        const r = canvas.getBoundingClientRect();
        const s = scale();
        this.zoom(k, { x: (cx - r.left) * s, y: (cy - r.top) * s });
      },
    };
  }

  // ---------- Partidas ----------

  newGame() {
    this.audio.unlock();
    store.clear();
    this.rt.startGame();
    this.rt.gotoRoom(this.ranchRoom);
    this.enterGame();
  }

  continueGame() {
    this.audio.unlock();
    this.rt.startGame();
    this.rt.requestLoad(store.slotName);
    this.enterGame();
  }

  private enterGame() {
    store.playing = true;
    this.leavingTitle = true;
    title.hide();
    this.hud.show(true);
    this.lastAutosave = performance.now();
    this.lastMoney = undefined;
    canvas.focus();
  }

  private toMenu() {
    if (!confirm(t('toMenuConfirm'))) return;
    this.autosave(true);
    this.showTitle();
  }

  private showTitle() {
    store.playing = false;
    this.audio.stopAll();
    this.hud.show(false);
    title.show();
  }

  private inRanch() { return !title.visible && this.rt.room !== this.titleRoom; }

  /** Guarda la partida; `flush` la sube ya a la nube (al salir o pasar a segundo plano). */
  autosave(flush = false) {
    if (!this.inRanch()) return;
    this.lastAutosave = performance.now();
    store.save(this.rt, flush);
  }

  /** Autoguardado periódico y poco después de cada cambio de dinero. */
  private autosaveTick(now: number) {
    const money = this.rt.globals.money;
    if (money !== this.lastMoney) {
      if (this.lastMoney !== undefined) this.moneyChangedAt = now;
      this.lastMoney = money;
    }
    const changed = this.moneyChangedAt > this.lastAutosave && now - this.moneyChangedAt > AUTOSAVE_AFTER_CHANGE_MS;
    if (changed || now - this.lastAutosave > AUTOSAVE_MS) this.autosave();
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
        this.autosaveTick(now);
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
  title.setProgress(0, 1, t('loadingData'));
  const data = (await (await fetch(`${BASE}game.json`)).json()) as GameData;
  const render = new Renderer(canvas, data, BASE);
  const audio = new Audio(data, BASE);
  let g: Game | null = null;
  const input = new Input(canvas, () => !!g?.paused, () => g?.rt.views[0] ?? { width: canvas.width, height: canvas.height });
  await Promise.all([
    render.load((done, total) => title.setProgress(done, total, t('loadingSprites', { pct: Math.round((done / total) * 100) }))),
    audio.load(),
  ]);
  g = new Game(data, render, audio, input);
  game = g;
  dialogHooks.message = (msg) => { input.clear(); showMessage(msg); };
  if (import.meta.env.DEV) Object.assign(window, { rt: g.rt, game: g });
  g.start();
  // Con sesión iniciada se trae la partida de la nube (o se sube la de aquí) antes de mostrar
  // "Continuar"; sin conexión no se espera más de unos segundos.
  title.setProgress(1, 1, t('cloudSyncing'));
  const synced = store.connect((local, remote) => confirm(t('cloudChoose', {
    remote: `${formatMoney(remote.money)} · ${formatDate(remote.savedAt)}`,
    local: `${formatMoney(local.money)} · ${formatDate(local.savedAt)}`,
  })));
  await Promise.race([synced, new Promise((r) => setTimeout(r, 4000))]);
  title.showMenu();
  void synced.then(() => { if (title.visible) title.showMenu(); });
}

boot().catch((e) => {
  console.error(e);
  title.setProgress(0, 1, t('loadError', { msg: (e as Error).message }));
});
