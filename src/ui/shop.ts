// Tienda en un panel HTML lateral.
// Los botones siguen siendo los objetos del juego original (los crea obj_menu_bkg y sus
// categorías): cada uno se dibuja con su propio evento Draw en un canvas pequeño y, al pulsarlo,
// recibe los mismos eventos de ratón que en el original. Así se compra igual que en el .exe,
// pero el rancho sigue a la vista y en marcha.
import type { Instance } from '../gm/instance';
import type { Renderer } from '../gm/render';
import { EV, type ObjDef, type Runtime } from '../gm/runtime';
import { bind, onLangChange, t, tg } from '../i18n';
import type { UiKey } from '../i18n/ui';
import { button, h, setText } from './dom';

const SCALE = 2;
const PAD = 3;
/** Botones de utilidades: van en una fila aparte y con nombre. */
const UTILITIES: Record<string, UiKey> = {
  up_btn: 'utilBack',
  save_btn: 'utilSave',
  load_btn: 'utilLoad',
  terrain_edit_btn: 'utilTerrain',
  obj_maximize_btn: 'utilWindow',
  obj_help_btn: 'utilHelp',
};
/** Fila de abajo de la tienda original (salir, volver, guardar...): va con las utilidades. */
const FOOTER_Y = 395;


interface Area { l: number; t: number; w: number; h: number }

interface Tile {
  inst: Instance;
  el: HTMLButtonElement;
  canvas: HTMLCanvasElement;
  price: HTMLElement;
  tip: string;
  /** Lo que el objeto dibuja fuera de su botón (zona del juego y canvas donde se muestra). */
  extra?: { area: Area; canvas: HTMLCanvasElement };
}

export class Shop {
  readonly el: HTMLElement;
  private grid = h('div', { class: 'shop-grid' });
  private footer = h('div', { class: 'shop-footer' });
  private info = h('p', { class: 'shop-info' });
  private family: Set<ObjDef>;
  private bkgObj: ObjDef | null;
  private exitObj: ObjDef | null;
  private tiles = new Map<Instance, Tile>();
  private signature = '';
  private frame = 0;
  private tipSink: ((s: string) => void) | null = null;

  constructor(private rt: Runtime, private render: Renderer, private onAfterClick: () => void) {
    const objIndex = (n: string) => rt.data.resources.objects.indexOf(n);
    this.family = new Set(rt.objectByIndex(objIndex('obj_menu_parent'))?.family ?? []);
    this.bkgObj = rt.objectByIndex(objIndex('obj_menu_bkg'));
    this.exitObj = rt.objectByIndex(objIndex('exit_btn'));
    this.el = h('aside', { class: 'shop hidden' },
      h('header', {},
        bind(h('h2', {}), () => t('shopHeading')),
        bind(button('✕', () => this.close(), { cls: 'small' }), () => t('shopClose'), 'title'),
      ),
      this.grid,
      this.footer,
      this.info,
    );
    this.el.addEventListener('pointerleave', () => this.showInfo(null));
    rt.uiOwned = (i) => this.family.has(i.obj);
    // Al cambiar de idioma se vuelven a dibujar los botones (sus textos se traducen al dibujarse).
    onLangChange(() => { for (const tile of this.tiles.values()) this.paint(tile); this.showInfo(null); });
  }

  get open() { return !this.el.classList.contains('hidden'); }

  /** Lo llama el parche del tooltip original mientras se dibuja un botón. */
  tooltip(text: string) { this.tipSink?.(text); }

  private menuInstances() {
    return this.rt.instances.filter((i) => !i.dead && i.active && this.family.has(i.obj));
  }

  close() {
    const exit = this.menuInstances().find((i) => i.obj === this.exitObj);
    if (exit) this.press(exit);
    else for (const i of this.menuInstances()) this.rt.destroyInstance(i);
  }

  /** Se llama en cada frame. */
  update() {
    const list = this.menuInstances();
    const bkg = list.find((i) => i.obj === this.bkgObj);
    if (!bkg) {
      if (this.open) { this.el.classList.add('hidden'); this.clear(); }
      return;
    }
    this.el.classList.remove('hidden');
    const buttons = list.filter((i) => i !== bkg);
    const sig = buttons.map((i) => i.id).join(',');
    if (sig !== this.signature) { this.signature = sig; this.build(bkg, buttons); }
    else if (++this.frame % 15 === 0) for (const t of this.tiles.values()) this.paint(t);
  }

  private clear() {
    this.tiles.clear();
    this.signature = '';
    this.grid.replaceChildren();
    this.footer.replaceChildren();
    this.showInfo(null);
  }

  private build(bkg: Instance, buttons: Instance[]) {
    this.clear();
    this.signature = buttons.map((i) => i.id).join(',');
    const rel = (i: Instance) => ({ x: i.x - bkg.x, y: i.y - bkg.y });
    const sorted = [...buttons].sort((a, b) => rel(a).y - rel(b).y || rel(a).x - rel(b).x);
    for (const inst of sorted) {
      if (inst.obj === this.exitObj) continue; // la ✕ de la cabecera
      const canvas = h('canvas', {}) as HTMLCanvasElement;
      const price = h('span', { class: 'price' });
      const el = h('button', { type: 'button', class: 'shop-item' }, canvas, price) as HTMLButtonElement;
      const tile: Tile = { inst, el, canvas, price, tip: '' };
      el.addEventListener('click', () => this.press(inst));
      el.addEventListener('pointerenter', () => this.showInfo(tile));
      el.addEventListener('focus', () => this.showInfo(tile));
      this.paint(tile);
      this.tiles.set(inst, tile);
      const { x, y } = rel(inst);
      const util = UTILITIES[inst.obj.name] ?? (/^check_/.test(inst.obj.name) ? 'utilCheck' : undefined);
      if (util || y >= FOOTER_Y) {
        if (util) el.append(bind(h('span', { class: 'label' }), () => t(util)));
        this.footer.append(el);
      } else {
        // Misma colocación que en la tienda original: columnas cada 50 px y filas cada 70 px.
        if (!tile.extra) el.style.gridColumn = String(Math.min(4, Math.max(1, Math.round((x - 20) / 50) + 1)));
        el.style.gridRow = String(Math.round((y - 20) / 70) + 1);
        this.grid.append(el);
      }
    }
  }

  /** Dibuja el botón con su propio evento Draw y recoge sus textos (precio) y su ayuda. */
  private paint(tile: Tile) {
    const s = this.rt.spriteByIndex(tile.inst.sprite_index);
    const own = { l: tile.inst.x - (s?.ox ?? 0) - PAD, t: tile.inst.y - (s?.oy ?? 0) - PAD, w: (s?.w ?? 44) + PAD * 2, h: (s?.h ?? 44) + PAD * 2 };
    let texts: string[] = [];
    let tip = '';
    const draw = (canvas: HTMLCanvasElement, r: Area) => {
      if (canvas.width !== r.w * SCALE || canvas.height !== r.h * SCALE) { canvas.width = r.w * SCALE; canvas.height = r.h * SCALE; }
      texts = [];
      tip = '';
      this.tipSink = (txt) => { tip = txt; };
      try {
        return this.render.capture(canvas, r.l, r.t, SCALE, () => this.rt.drawInstance(tile.inst), (txt) => texts.push(txt));
      } finally {
        this.tipSink = null;
      }
    };
    const rects = draw(tile.canvas, own);
    if (!tile.extra) {
      // Algunos objetos dibujan fuera de su botón: los líderes del gimnasio pintan los Pokémon que
      // piden junto al fondo de la tienda. Esa parte se muestra aparte, en una tarjeta ancha.
      const out = rects.filter((r) => r.r <= own.l || r.l >= own.l + own.w || r.b <= own.t || r.t >= own.t + own.h);
      if (out.length) {
        const l = Math.floor(Math.min(...out.map((r) => r.l))) - PAD;
        const t = Math.floor(Math.min(...out.map((r) => r.t))) - PAD;
        const area = { l, t, w: Math.ceil(Math.max(...out.map((r) => r.r))) + PAD - l, h: Math.ceil(Math.max(...out.map((r) => r.b))) + PAD - t };
        const canvas = h('canvas', { class: 'extra' }) as HTMLCanvasElement;
        canvas.style.width = `${Math.min(area.w, 268)}px`;
        tile.extra = { area, canvas };
        tile.el.classList.add('wide');
        tile.el.style.gridColumn = '1 / -1';
        tile.el.prepend(canvas);
      }
    }
    if (tile.extra) draw(tile.extra.canvas, tile.extra.area);

    tile.tip = tg(tip).replace(/#/g, '\n');
    const text = texts.join(' ').trim();
    if (tile.extra) {
      // En las tarjetas anchas los textos son instrucciones, no precios.
      setText(tile.price, text);
      tile.price.className = 'desc';
    } else {
      // Las categorías no tienen precio: se rotulan con su ayuda, que es corta ("Balls", "Pokemon Male").
      const name = !text && !UTILITIES[tile.inst.obj.name] && tile.tip.length <= 22 ? tile.tip : '';
      setText(tile.price, text || name);
      tile.price.className = text ? 'price' : 'label';
    }
    tile.price.hidden = !tile.price.textContent;
    tile.el.title = tile.tip;
  }

  private showInfo(tile: Tile | null) {
    if (!tile) { setText(this.info, t('shopHint')); this.info.classList.remove('on'); return; }
    const price = tile.price.classList.contains('price') ? ` · ${tile.price.textContent}` : '';
    const label = tile.el.querySelector('.label, .desc')?.textContent;
    setText(this.info, `${tile.tip || label || t('shopButton')}${price}`);
    this.info.classList.add('on');
  }

  /** Clic en un botón: los mismos eventos que un clic en el juego original. */
  private press(inst: Instance) {
    const rt = this.rt;
    for (const num of [4, 0, 7]) { // pulsar, mantener, soltar
      if (inst.dead || !inst.active) break;
      rt.event(inst, EV.MOUSE, num);
    }
    this.update();
    this.onAfterClick();
  }
}
