// Indicador de guardado (junto al dinero) y su panel: estado de la partida, "Guardar ahora",
// conflictos entre dispositivos y la cuenta de Core Utils.
import { bind, onLangChange, t } from '../i18n';
import type { UiKey } from '../i18n/ui';
import { cloudEnabled } from '../save/cloud';
import type { SaveState, SaveStore } from '../save/store';
import { button, formatDate, h, setText } from './dom';

export interface SavePanelActions {
  saveNow: () => Promise<void>;
  /** Cambia a la partida de la nube (otro dispositivo guardó una más reciente). */
  useCloud: () => Promise<void>;
  login: () => void;
  logout: () => void;
}

const ICON: Record<SaveState, string> = { local: '💾', synced: '☁️', pending: '☁️', error: '⚠️', conflict: '⚠️' };

/** "hace 5 s", "hace 3 min"... */
function ago(time: number) {
  const s = Math.max(0, Math.round((Date.now() - time) / 1000));
  if (s < 5) return t('agoNow');
  if (s < 60) return t('agoSeconds', { n: s });
  if (s < 3600) return t('agoMinutes', { n: Math.round(s / 60) });
  return formatDate(time);
}

export class SavePanel {
  readonly el: HTMLElement;
  private chip: HTMLButtonElement;
  private panel = h('div', { class: 'save-panel hidden' });
  private status = h('p', { class: 'save-status' });
  private detail = h('small', {});
  private conflictRow = h('div', { class: 'row' });
  private account = h('div', { class: 'save-account' });
  private saveBtn: HTMLButtonElement;
  private lastState: SaveState | null = null;
  private lastLocalAt = 0;

  constructor(private store: SaveStore, private actions: SavePanelActions) {
    this.chip = button('', () => this.toggle(), { cls: 'chip save-state' });
    this.saveBtn = button('', () => void this.run(this.saveBtn, actions.saveNow), { cls: 'primary' });
    bind(this.saveBtn, () => `💾 ${t('saveNow')}`);
    this.conflictRow.append(
      bind(button('', () => void this.run(null, actions.useCloud), { cls: 'small' }), () => `⬇️ ${t('useCloudSave')}`),
      bind(button('', () => void this.run(null, actions.saveNow), { cls: 'small' }), () => `⬆️ ${t('keepThisSave')}`),
    );
    this.panel.append(
      h('header', {}, bind(h('strong', {}), () => t('saveHeading')), bind(button('✕', () => this.toggle(false), { cls: 'small' }), () => t('close'), 'title')),
      this.status, this.detail, this.conflictRow, this.saveBtn, this.account,
    );
    this.el = h('div', { class: 'save-wrap' }, this.chip, this.panel);
    // Al tocar fuera, se cierra.
    document.addEventListener('pointerdown', (e) => { if (!this.el.contains(e.target as Node)) this.toggle(false); });
    store.onChange(() => this.refresh());
    onLangChange(() => { this.lastState = null; this.refresh(); });
    this.refresh();
  }

  get open() { return !this.panel.classList.contains('hidden'); }

  toggle(on = !this.open) {
    this.panel.classList.toggle('hidden', !on);
    if (on) this.refresh();
  }

  private async run(btn: HTMLButtonElement | null, fn: () => Promise<void>) {
    if (btn) btn.disabled = true;
    try { await fn(); } finally { if (btn) btn.disabled = false; this.refresh(); }
  }

  /** Se llama en cada frame (para "hace X s") y cuando cambia el guardado. */
  refresh() {
    const { store } = this;
    const state = store.state;
    if (state !== this.lastState) {
      this.chip.textContent = ICON[state];
      this.chip.classList.toggle('warn', state === 'error' || state === 'conflict');
      this.chip.title = t(`saveState_${state}` as UiKey);
      this.conflictRow.classList.toggle('hidden', state !== 'conflict');
      this.renderAccount();
      this.lastState = state;
    }
    // Pequeño destello cada vez que se guarda.
    if (store.localAt !== this.lastLocalAt) {
      this.lastLocalAt = store.localAt;
      this.chip.classList.remove('pulse');
      void this.chip.offsetWidth;
      this.chip.classList.add('pulse');
    }
    if (!this.open) return;
    const local = ago(store.localAt);
    setText(this.status, `${ICON[state]} ${t(`saveState_${state}` as UiKey)}`);
    setText(this.detail,
      state === 'synced' ? t('saveDetailSynced', { ago: ago(store.cloudAt) })
      : state === 'pending' ? t('saveDetailPending', { ago: local })
      : state === 'error' ? t('saveDetailError', { ago: local, since: ago(store.failingSince) })
      : state === 'conflict' ? t('saveDetailConflict', { date: formatDate(store.cloudAt) })
      : store.localAt ? t('saveDetailLocal', { ago: local }) : '');
  }

  private renderAccount() {
    const { user } = this.store;
    if (!cloudEnabled) { this.account.replaceChildren(); return; }
    if (!user) {
      this.account.replaceChildren(
        h('small', {}, t('loginHint')),
        button(`☁️ ${t('loginGoogle')}`, this.actions.login, { cls: 'login' }),
      );
      return;
    }
    const avatar = user.avatarUrl ? h('img', { src: user.avatarUrl, alt: '', referrerpolicy: 'no-referrer' }) : '👤';
    this.account.replaceChildren(
      h('span', { class: 'who' }, avatar, user.name ?? user.email),
      button(t('logout'), this.actions.logout, { cls: 'small' }),
    );
  }
}
