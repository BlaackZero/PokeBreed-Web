// Pantalla de título en HTML con la ilustración original (bkg_title).
import { listSaves } from '../gm/functions';
import { bind, getLang, onLangChange, setLang, t } from '../i18n';
import { button, displaySaveName, formatDate, h } from './dom';

export interface TitleActions {
  newGame: () => void;
  continueGame: (name: string) => void;
  load: () => void;
  help: () => void;
}

export class TitleScreen {
  readonly el: HTMLElement;
  private progress = h('i', {});
  private progressText = h('span', {}, t('loading'));
  private loading = h('div', { class: 'loading' }, h('div', { class: 'bar' }, this.progress), this.progressText);
  private menu = h('nav', { class: 'menu' });
  private ready = false;

  constructor(art: string, private actions: TitleActions) {
    const lang = bind(button('', () => setLang(getLang() === 'es' ? 'en' : 'es'), { cls: 'lang' }), () => `🌐 ${t('language')}`);
    bind(lang, () => t('languageTitle'), 'title');
    this.el = h('div', { class: 'title' },
      h('div', { class: 'title-bg', style: `background-image:url(${art})` }),
      h('div', { class: 'title-art', style: `background-image:url(${art})` }),
      h('div', { class: 'title-shade' }),
      lang,
      h('div', { class: 'title-ui' }, this.loading, this.menu, bind(h('p', { class: 'title-foot' }), () => t('titleFoot'))),
    );
    window.addEventListener('keydown', (e) => {
      if (!this.visible || !this.ready || document.getElementById('modals')!.childElementCount) return;
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); e.stopPropagation(); this.actions.newGame(); }
    }, true);
    onLangChange(() => { if (this.ready && this.visible) this.showMenu(); });
  }

  get visible() { return !this.el.classList.contains('hidden'); }

  setProgress(done: number, total: number, label: string) {
    this.progress.style.width = `${Math.round((done / Math.max(1, total)) * 100)}%`;
    this.progressText.textContent = label;
  }

  /** Muestra el menú (cuando todo ha cargado). */
  showMenu() {
    this.ready = true;
    this.loading.hidden = true;
    const saves = listSaves();
    const items: HTMLElement[] = [];
    const start = button(t('newGame'), () => this.actions.newGame(), { cls: 'primary big' });
    items.push(start);
    if (saves.length) {
      const last = saves[0];
      const cont = button(t('continue'), () => this.actions.continueGame(last.name), { cls: 'big' });
      cont.append(h('small', {}, `${displaySaveName(last.name)} · ${formatDate(last.savedAt)}`));
      items.push(cont);
      items.push(button(t('loadGame'), () => this.actions.load(), { cls: 'big' }));
    }
    items.push(button(t('howToPlay'), () => this.actions.help(), { cls: 'big' }));
    this.menu.replaceChildren(...items, h('p', { class: 'hint' }, t('pressEnter')));
    start.focus();
  }

  show() {
    this.el.classList.remove('hidden');
    if (this.ready) this.showMenu();
  }

  hide() { this.el.classList.add('hidden'); }
}
