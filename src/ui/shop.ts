// Tienda en un panel HTML lateral.
// Los botones siguen siendo los objetos del juego original (los crea obj_menu_bkg y sus
// categorías): cada uno se dibuja con su propio evento Draw en un canvas pequeño y, al pulsarlo,
// recibe los mismos eventos de ratón que en el original. Así se compra igual que en el .exe,
// pero el rancho sigue a la vista y en marcha.
import type { Instance } from '../gm/instance';
import type { Renderer } from '../gm/render';
import { EV, type ObjDef, type Runtime } from '../gm/runtime';
import { button, h, setText } from './dom';

const SCALE = 2;
const PAD = 3;
/** Botones de utilidades: van en una fila aparte y con nombre. */
const UTILITIES: Record<string, string> = {
  up_btn: 'Volver',
  save_btn: 'Guardar',
  load_btn: 'Cargar',
  terrain_edit_btn: 'Terreno',
  obj_maximize_btn: 'Ventana',
  obj_help_btn: 'Ayuda',
};

interface Tile {
  inst: Instance;
  el: HTMLButtonElement;
  canvas: HTMLCanvasElement;
  price: HTMLElement;
  tip: string;
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
        h('h2', {}, '🛒 Tienda'),
        button('✕', () => this.close(), { title: 'Cerrar tienda (E / Enter)', cls: 'small' }),
      ),
      this.grid,
      this.footer,
      this.info,
    );
    this.el.addEventListener('pointerleave', () => this.showInfo(null));
    rt.uiOwned = (i) => this.family.has(i.obj);
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
      const util = UTILITIES[inst.obj.name];
      if (util) {
        el.append(h('span', { class: 'label' }, util));
        this.footer.append(el);
      } else {
        // Misma colocación que en la tienda original: columnas cada 50 px y filas cada 70 px.
        el.style.gridColumn = String(Math.round((x - 20) / 50) + 1);
        el.style.gridRow = String(Math.round((y - 20) / 70) + 1);
        this.grid.append(el);
      }
    }
  }

  /** Dibuja el botón con su propio evento Draw y recoge sus textos (precio) y su ayuda. */
  private paint(t: Tile) {
    const s = this.rt.spriteByIndex(t.inst.sprite_index);
    const w = (s?.w ?? 44) + PAD * 2;
    const hgt = (s?.h ?? 44) + PAD * 2;
    if (t.canvas.width !== w * SCALE) { t.canvas.width = w * SCALE; t.canvas.height = hgt * SCALE; }
    const texts: string[] = [];
    let tip = '';
    this.tipSink = (txt) => { tip = txt; };
    try {
      this.render.capture(t.canvas, t.inst.x - (s?.ox ?? 0) - PAD, t.inst.y - (s?.oy ?? 0) - PAD, SCALE,
        () => this.rt.drawInstance(t.inst), (txt) => texts.push(txt));
    } finally {
      this.tipSink = null;
    }
    t.tip = tip.replace(/#/g, '\n');
    const price = texts.join(' ').trim();
    // Las categorías no tienen precio: se rotulan con su ayuda, que es corta ("Balls", "Pokemon Male").
    const name = !price && !UTILITIES[t.inst.obj.name] && t.tip.length <= 22 ? t.tip : '';
    setText(t.price, price || name);
    t.price.className = price ? 'price' : 'label';
    t.price.hidden = !t.price.textContent;
    t.el.title = t.tip;
  }

  private showInfo(t: Tile | null) {
    if (!t) { setText(this.info, 'Pasa el ratón por un artículo para ver su descripción.'); this.info.classList.remove('on'); return; }
    const price = t.price.classList.contains('price') ? ` · ${t.price.textContent}` : '';
    setText(this.info, `${t.tip || 'Botón'}${price}`);
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
