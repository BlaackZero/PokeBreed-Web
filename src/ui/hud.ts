// Interfaz de juego en HTML: dinero, medallas, velocidad, barra de herramientas,
// ficha del Pokémon bajo el ratón y avisos de cría.
import type { Instance } from '../gm/instance';
import type { Runtime } from '../gm/runtime';
import { button, h, setText } from './dom';

const BADGES = ['boulder', 'cascade', 'thunder', 'rainbow', 'soul', 'marsh', 'volcano', 'earth'];
const BADGE_NAMES = ['Roca', 'Cascada', 'Trueno', 'Arcoíris', 'Alma', 'Pantano', 'Volcán', 'Tierra'];

export interface HudActions {
  save: () => void;
  load: () => void;
  help: () => void;
  menu: () => void;
  zoom: (factor: number) => void;
  fullscreen: () => void;
  toggleMute: () => boolean;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Botón con icono y texto; en pantallas estrechas solo se ve el icono. */
function tool(icon: string, label: string, onClick: () => void, title: string, cls = '') {
  const b = button(icon, onClick, { title, cls });
  b.append(h('span', { class: 'lbl' }, ` ${label}`));
  return b;
}

/** "charmander_baby_m" → "Charmander (bebé)", "squirtle_egg" → "Huevo de Squirtle". */
export function prettyName(objName: string) {
  let n = objName.replace(/^obj_/, '');
  const egg = /_egg$/.test(n);
  n = n.replace(/_egg$/, '');
  const baby = /_baby/.test(n);
  n = n.replace(/_baby/, '').replace(/_(m|f|p|g)$/, '');
  n = n.split('_').filter(Boolean).map(cap).join(' ');
  return egg ? `Huevo de ${n}` : baby ? `${n} (bebé)` : n;
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
  private terrain = h('div', { class: 'chip terrain' }, '🌹 Modo terreno: arrastra vallas y terrenos · T para salir');
  private card = h('div', { class: 'card' });
  private cardImg = h('img', { alt: '' }) as HTMLImageElement;
  private cardName = h('strong', {});
  private cardGender = h('span', { class: 'gender' });
  private cardExp = h('span', {});
  private cardBar = h('i', {});
  private cardSell = h('small', {});
  private toasts = h('div', { class: 'toasts' });
  private toasted = new WeakSet<Instance>();
  private pointer = { x: 0, y: 0, inside: false };
  private breedMsgIndex = -1;

  constructor(private rt: Runtime, private spriteUrl: (spriteIndex: number, frame: number) => string, actions: HudActions) {
    this.badges = BADGES.map((b, k) => {
      const img = h('img', { src: spriteUrl(this.spriteIndex(`${b}_badge`), 0), alt: '', title: `Medalla ${BADGE_NAMES[k]}` }) as HTMLImageElement;
      return img;
    });
    const mute = button('🔊', () => { mute.textContent = actions.toggleMute() ? '🔇' : '🔊'; }, { title: 'Silenciar' });
    const key = (code: number) => () => rt.input.tap(code);

    this.el = h('div', { class: 'hud' },
      h('div', { class: 'hud-left' },
        h('div', { class: 'chip money' }, '💰', this.money),
        h('div', { class: 'chip' }, '🐾', this.count),
      ),
      h('div', { class: 'hud-center chip badges' }, ...this.badges),
      h('div', { class: 'hud-right chip speed' },
        button('−', () => this.setSpeed(-5), { cls: 'small', title: 'Más lento (Re Pág)' }),
        h('span', { class: 'speed-label' }, '⏱ ', this.speed, ' ', this.fps),
        button('+', () => this.setSpeed(5), { cls: 'small', title: 'Más rápido (Av Pág)' }),
      ),
      this.terrain,
      h('div', { class: 'toolbar' },
        tool('🛒', 'Tienda', key(13), 'Tienda (Enter / E)', 'primary'),
        tool('🧱', 'Terreno', key(84), 'Modo terreno (T)'),
        tool('💾', 'Guardar', actions.save, 'Guardar partida (F5)'),
        tool('📂', 'Cargar', actions.load, 'Cargar partida (F6)'),
        h('span', { class: 'sep' }),
        button('➖', () => actions.zoom(1 / 1.15), { title: 'Alejar (rueda del ratón)' }),
        button('➕', () => actions.zoom(1.15), { title: 'Acercar (rueda del ratón)' }),
        mute,
        button('⛶', actions.fullscreen, { title: 'Pantalla completa (F11)' }),
        button('❔', actions.help, { title: 'Ayuda (F1)' }),
        button('🏠', actions.menu, { title: 'Volver al menú principal' }),
      ),
      this.card,
      this.toasts,
    );
    this.card.append(this.cardImg, h('div', {}, h('div', { class: 'card-title' }, this.cardName, this.cardGender),
      h('div', { class: 'exp' }, h('span', { class: 'bar' }, this.cardBar), this.cardExp), this.cardSell));

    const canvas = document.getElementById('screen')!;
    canvas.addEventListener('pointermove', (e) => { this.pointer = { x: e.clientX, y: e.clientY, inside: true }; });
    canvas.addEventListener('pointerleave', () => { this.pointer.inside = false; });

    this.breedMsgIndex = rt.data.resources.objects.indexOf('obj_breed_message');
  }

  private spriteIndex(name: string) { return this.rt.data.sprites[name]?.id ?? -1; }

  private setSpeed(d: number) {
    this.rt.roomSpeed = Math.max(5, Math.min(120, this.rt.roomSpeed + d));
  }

  show(on: boolean) { this.el.classList.toggle('hidden', !on); }

  toast(text: string) {
    const t = h('div', { class: 'toast' }, text.replace(/#/g, ' '));
    this.toasts.prepend(t);
    while (this.toasts.childElementCount > 4) this.toasts.lastElementChild?.remove();
    setTimeout(() => t.classList.add('out'), 3500);
    setTimeout(() => t.remove(), 4000);
  }

  /** Se llama en cada frame. */
  update() {
    const rt = this.rt;
    const g = rt.globals;
    setText(this.money, `$${(Number(g.money) || 0).toLocaleString('es')}`);

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
        this.toast(`🥚 ${m.v.message}`);
      }
    }

    this.updateCard();
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
    setText(this.cardExp, egg ? `Eclosión ${Math.min(100, Math.round((exp / max) * 100))}%`
      : final ? 'Evolución máxima' : `Exp ${Math.round(exp)} / ${Math.round(max)}`);
    this.cardBar.style.width = `${Math.min(100, (exp / max) * 100)}%`;
    const sell = Number(target.v.sell);
    setText(this.cardSell, sell > 0 ? `Se vende por $${sell}` : '');
    const x = Math.min(this.pointer.x + 18, window.innerWidth - 240);
    const y = Math.min(this.pointer.y + 18, window.innerHeight - 110);
    this.card.style.transform = `translate(${x}px, ${y}px)`;
    this.card.classList.add('on');
  }
}
