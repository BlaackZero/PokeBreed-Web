// Pantalla de título en HTML con la ilustración original (bkg_title).
import { bind, getLang, onLangChange, setLang, t } from '../i18n';
import { cloudEnabled } from '../save/cloud';
import type { SaveStore } from '../save/store';
import { button, formatDate, formatMoney, h } from './dom';

export interface TitleActions {
  newGame: () => void;
  continueGame: () => void;
  help: () => void;
  login: () => void;
  logout: () => void;
}

export class TitleScreen {
  readonly el: HTMLElement;
  private progress = h('i', {});
  private progressText = h('span', {}, t('loading'));
  private loading = h('div', { class: 'loading' }, h('div', { class: 'bar' }, this.progress), this.progressText);
  private menu = h('nav', { class: 'menu' });
  private account = h('div', { class: 'account' });
  private ready = false;

  constructor(art: string, private store: SaveStore, private actions: TitleActions) {
    const lang = bind(button('', () => setLang(getLang() === 'es' ? 'en' : 'es'), { cls: 'lang' }), () => `🌐 ${t('language')}`);
    bind(lang, () => t('languageTitle'), 'title');
    this.el = h('div', { class: 'title' },
      h('div', { class: 'title-bg', style: `background-image:url(${art})` }),
      h('div', { class: 'title-art', style: `background-image:url(${art})` }),
      h('div', { class: 'title-shade' }),
      lang,
      h('div', { class: 'title-ui' }, this.loading, this.menu, this.account, bind(h('p', { class: 'title-foot' }), () => t('titleFoot'))),
    );
    window.addEventListener('keydown', (e) => {
      if (!this.visible || !this.ready || document.getElementById('modals')!.childElementCount) return;
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        e.stopPropagation();
        if (this.store.local()) this.actions.continueGame(); else this.actions.newGame();
      }
    }, true);
    onLangChange(() => { if (this.ready && this.visible) this.showMenu(); });
    store.onChange(() => { if (this.ready && this.visible) this.showAccount(); });
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
    const save = this.store.local();
    const items: HTMLElement[] = [];
    let first: HTMLElement;
    if (save) {
      const cont = button(t('continue'), () => this.actions.continueGame(), { cls: 'primary big' });
      cont.append(h('small', {}, `${formatMoney(save.money)} · ${formatDate(save.savedAt)}`));
      items.push(cont);
      items.push(button(t('newGame'), () => { if (confirm(t('newGameConfirm'))) this.actions.newGame(); }, { cls: 'big' }));
      first = cont;
    } else {
      first = button(t('newGame'), () => this.actions.newGame(), { cls: 'primary big' });
      items.push(first);
    }
    items.push(button(t('howToPlay'), () => this.actions.help(), { cls: 'big' }));
    this.menu.replaceChildren(...items, h('p', { class: 'hint' }, t(save ? 'pressEnterContinue' : 'pressEnter')));
    this.showAccount();
    first.focus();
  }

  /** Cuenta de Core Utils: login con Google para guardar en la nube. */
  private showAccount() {
    if (!cloudEnabled) { this.account.replaceChildren(); return; }
    const { user, status } = this.store;
    if (!user) {
      this.account.replaceChildren(
        button(`☁️ ${t('loginGoogle')}`, () => this.actions.login(), { cls: 'login' }),
        h('small', {}, status === 'offline' ? t('cloudOffline') : t('loginHint')),
      );
      return;
    }
    const avatar = user.avatarUrl ? h('img', { src: user.avatarUrl, alt: '', referrerpolicy: 'no-referrer' }) : '👤';
    this.account.replaceChildren(
      h('span', { class: 'who' }, avatar, user.name ?? user.email),
      h('small', {}, status === 'syncing' ? t('cloudSyncing') : status === 'offline' ? t('cloudOffline') : t('cloudOn')),
      button(t('logout'), () => this.actions.logout(), { cls: 'small' }),
    );
  }

  show() {
    this.el.classList.remove('hidden');
    if (this.ready) this.showMenu();
  }

  hide() { this.el.classList.add('hidden'); }
}
