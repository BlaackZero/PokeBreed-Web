// Interfaz de juego en HTML: dinero, medallas, velocidad, barra de herramientas,
// ficha del Pokémon bajo el ratón y avisos de cría.
import type { Instance } from '../gm/instance';
import type { Runtime } from '../gm/runtime';
import { bind, getLang, setLang, t, tg } from '../i18n';
import { BADGE_NAMES, type UiKey } from '../i18n/ui';
import type { SaveStore } from '../save/store';
import { SavePanel, type SavePanelActions } from './save-panel';
import { button, formatMoney, h, setText } from './dom';

const BADGES = ['boulder', 'cascade', 'thunder', 'rainbow', 'soul', 'marsh', 'volcano', 'earth'];

export interface HudActions extends SavePanelActions {
  help: () => void;
  menu: () => void;
  zoom: (factor: number) => void;
  fullscreen: () => void;
  toggleMute: () => boolean;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Botón con icono y texto; en pantallas estrechas solo se ve el icono. */
function tool(icon: string, label: UiKey, onClick: () => void, title: UiKey, cls = '') {
  const b = bind(button(icon, onClick, { cls }), () => t(title), 'title');
  b.append(bind(h('span', { class: 'lbl' }), () => ` ${t(label)}`));
  return b;
}

/** Botón solo con icono. */
const iconButton = (icon: string, onClick: () => void, title: UiKey, cls = '') =>
  bind(button(icon, onClick, { cls }), () => t(title), 'title');

/** "charmander_baby_m" → "Charmander (bebé)", "squirtle_egg" → "Huevo de Squirtle". */
export function prettyName(objName: string) {
  let n = objName.replace(/^obj_/, '');
  const egg = /_egg$/.test(n);
  n = n.replace(/_egg$/, '');
  const baby = /_baby/.test(n);
  n = n.replace(/_baby/, '').replace(/_(m|f|p|g)$/, '');
  n = n.split('_').filter(Boolean).map(cap).join(' ');
  return egg ? t('egg', { name: n }) : baby ? t('baby', { name: n }) : n;
}

function genderOf(i: Instance) {
  if (/_m$/.test(i.obj.name)) return '♂';
  if (/_f$/.test(i.obj.name)) return '♀';
  return '';
}

export class Hud {
  readonly el: HTMLElement;
  private money = h('span', { class: 'value' });
  private count = h('span', { class: 'value' });
  private speed = h('span', { class: 'value' });
  private fps = h('small', {});
  private badges: HTMLImageElement[] = [];
  private terrain = bind(h('div', { class: 'chip terrain' }), () => t('terrainMode'));
  private card = h('div', { class: 'card' });
  private cardImg = h('img', { alt: '' }) as HTMLImageElement;
  private cardName = h('strong', {});
  private cardGender = h('span', { class: 'gender' });
  private cardExp = h('span', {});
  private cardBar = h('i', {});
  private cardSell = h('small', {});
  private toasts = h('div', { class: 'toasts' });
  private toasted = new WeakSet<Instance>();
  private pointer = { x: 0, y: 0, inside: false, touch: false };
  private breedMsgIndex = -1;

  /** Indicador del autoguardado y su panel. */
  readonly savePanel: SavePanel;

  constructor(private rt: Runtime, private spriteUrl: (spriteIndex: number, frame: number) => string, actions: HudActions, store: SaveStore) {
    this.savePanel = new SavePanel(store, actions);
    this.badges = BADGES.map((b, k) => bind(
      h('img', { src: spriteUrl(this.spriteIndex(`${b}_badge`), 0), alt: '' }) as HTMLImageElement,
      () => t('badge', { name: BADGE_NAMES[getLang()][k] }), 'title'));
    const mute = iconButton('🔊', () => { mute.textContent = actions.toggleMute() ? '🔇' : '🔊'; }, 'mute');
    const lang = bind(iconButton('', () => setLang(getLang() === 'es' ? 'en' : 'es'), 'langButtonTitle', 'lang'), () => `🌐 ${t('langButton')}`);
    const key = (code: number) => () => rt.input.tap(code);
    // Pantallas táctiles: qué botón del ratón hace un toque.
    const modes: HTMLButtonElement[] = [];
    const mode = (icon: string, b: number, title: UiKey) => {
      const m = iconButton(icon, () => {
        rt.input.touchButton = b;
        modes.forEach((x) => x.classList.toggle('active', x === m));
      }, title, b === 0 ? 'active' : '');
      modes.push(m);
      return m;
    };

    this.el = h('div', { class: 'hud' },
      h('div', { class: 'hud-left' },
        h('div', { class: 'chip money' }, '💰', this.money),
        h('div', { class: 'chip' }, '🐾', this.count),
        this.savePanel.el,
      ),
      h('div', { class: 'hud-center chip badges' }, ...this.badges),
      h('div', { class: 'hud-right chip speed' },
        iconButton('−', () => this.setSpeed(-5), 'slower', 'small'),
        h('span', { class: 'speed-label' }, '⏱ ', this.speed, ' ', this.fps),
        iconButton('+', () => this.setSpeed(5), 'faster', 'small'),
      ),
      this.terrain,
      h('div', { class: 'toolbar' },
        tool('🛒', 'shop', key(13), 'shopTitle', 'primary'),
        tool('🧱', 'terrain', key(84), 'terrainTitle'),
        h('span', { class: 'touch-modes' },
          h('span', { class: 'sep' }),
          mode('👆', 0, 'touchLeft'),
          mode('🎯', 2, 'touchRight'),
          mode('✨', 1, 'touchMiddle'),
        ),
        h('span', { class: 'sep' }),
        iconButton('➖', () => actions.zoom(1 / 1.15), 'zoomOut'),
        iconButton('➕', () => actions.zoom(1.15), 'zoomIn'),
        mute,
        ...(document.fullscreenEnabled ? [iconButton('⛶', actions.fullscreen, 'fullscreen')] : []),
        lang,
        iconButton('❔', actions.help, 'help'),
        iconButton('🏠', actions.menu, 'menu'),
      ),
      this.card,
      this.toasts,
    );
    this.card.append(this.cardImg, h('div', {}, h('div', { class: 'card-title' }, this.cardName, this.cardGender),
      h('div', { class: 'exp' }, h('span', { class: 'bar' }, this.cardBar), this.cardExp), this.cardSell));

    const canvas = document.getElementById('screen')!;
    const track = (e: PointerEvent) => { this.pointer = { x: e.clientX, y: e.clientY, inside: true, touch: e.pointerType === 'touch' }; };
    canvas.addEventListener('pointermove', track);
    canvas.addEventListener('pointerdown', track);
    canvas.addEventListener('pointerleave', () => { this.pointer.inside = false; });

    this.breedMsgIndex = rt.data.resources.objects.indexOf('obj_breed_message');
  }

  private spriteIndex(name: string) { return this.rt.data.sprites[name]?.id ?? -1; }

  private setSpeed(d: number) {
    this.rt.roomSpeed = Math.max(5, Math.min(120, this.rt.roomSpeed + d));
  }

  show(on: boolean) { this.el.classList.toggle('hidden', !on); }

  toast(text: string) {
    const el = h('div', { class: 'toast' }, text.replace(/#/g, ' '));
    this.toasts.prepend(el);
    while (this.toasts.childElementCount > 4) this.toasts.lastElementChild?.remove();
    setTimeout(() => el.classList.add('out'), 3500);
    setTimeout(() => el.remove(), 4000);
  }

  /** Se llama en cada frame. */
  update() {
    const rt = this.rt;
    const g = rt.globals;
    setText(this.money, formatMoney(g.money));

    let pokemon = 0;
    for (const i of rt.instances) if (!i.dead && i.v.expmax !== undefined && !/_egg$/.test(i.obj.name)) pokemon++;
    setText(this.count, String(pokemon));
    setText(this.speed, `${rt.roomSpeed}`);
    setText(this.fps, `(${Math.round(rt.fpsMeasured)} fps)`);
    BADGES.forEach((b, k) => this.badges[k].classList.toggle('earned', Number(g[`${b}badge`]) >= 1));
    this.terrain.classList.toggle('on', Number(g.terrain_edit) === 1);

    // Mensajes de cría ("They had a baby...") → avisos.
    if (this.breedMsgIndex >= 0) {
      for (const m of rt.instancesOf(this.breedMsgIndex)) {
        if (this.toasted.has(m) || m.v.message === undefined) continue;
        this.toasted.add(m);
        this.toast(`🥚 ${tg(String(m.v.message))}`);
      }
    }

    this.updateCard();
    this.savePanel.refresh();
  }

  private updateCard() {
    const rt = this.rt;
    let target: Instance | null = null;
    if (this.pointer.inside) {
      const mx = rt.gb('mouse_x', 0);
      const my = rt.gb('mouse_y', 0);
      for (const i of rt.instances) {
        if (i.dead || !i.active || i.v.expmax === undefined) continue;
        if (!rt.containsPoint(i, mx, my)) continue;
        if (!target || i.depth < target.depth || (i.depth === target.depth && i.seq > target.seq)) target = i;
      }
    }
    if (!target) { this.card.classList.remove('on'); return; }
    const exp = Math.max(0, Number(target.v.exp) || 0);
    const max = Math.max(1, Number(target.v.expmax) || 1);
    const src = this.spriteUrl(target.sprite_index, target.drawnFrame ?? target.frame());
    if (this.cardImg.getAttribute('src') !== src) this.cardImg.src = src;
    setText(this.cardName, prettyName(target.obj.name));
    setText(this.cardGender, genderOf(target));
    this.cardGender.className = `gender ${genderOf(target) === '♂' ? 'm' : 'f'}`;
    const egg = /_egg$/.test(target.obj.name);
    // Los Pokémon evolucionan en cuanto exp llega a expmax: si siguen así, ya no evolucionan más.
    const final = !egg && exp >= max;
    setText(this.cardExp, egg ? t('hatching', { pct: Math.min(100, Math.round((exp / max) * 100)) })
      : final ? t('maxEvolution') : `Exp ${Math.round(exp)} / ${Math.round(max)}`);
    this.cardBar.style.width = `${Math.min(100, (exp / max) * 100)}%`;
    const sell = Number(target.v.sell);
    setText(this.cardSell, sell > 0 ? t('sellsFor', { price: sell }) : '');
    const x = Math.min(this.pointer.x + 18, window.innerWidth - 240);
    // Con el dedo, la ficha va por encima para que no la tape.
    const y = this.pointer.touch ? Math.max(8, this.pointer.y - 130) : Math.min(this.pointer.y + 18, window.innerHeight - 110);
    this.card.style.transform = `translate(${x}px, ${y}px)`;
    this.card.classList.add('on');
  }
}
