// Ventanas HTML: mensajes del juego (show_message) y gestor de partidas.
import { deleteSave, listSaves } from '../gm/functions';
import { locale, t } from '../i18n';
import { button, displaySaveName, formatDate, formatMoney, h } from './dom';

const root = () => document.getElementById('modals')!;

/** ¿Hay alguna ventana abierta? (el juego se pausa mientras tanto) */
export const modalOpen = () => root().childElementCount > 0;

function open(panel: HTMLElement, onClose?: () => void) {
  const back = h('div', { class: 'modal-back' }, panel);
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey, true); onClose?.(); };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || (e.key === 'Enter' && panel.dataset.enterCloses)) {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };
  document.addEventListener('keydown', onKey, true);
  root().append(back);
  (panel.querySelector('[autofocus]') as HTMLElement | null)?.focus();
  return close;
}

/** Mensaje del juego (sustituye a la ventana gris de Windows). Se encolan si llegan varios. */
const queue: string[] = [];
export function showMessage(text: string) {
  queue.push(text);
  if (queue.length === 1) next();
}
function next() {
  const text = queue[0];
  if (text === undefined) return;
  const ok = button(t('ok'), () => close(), { cls: 'primary' });
  ok.setAttribute('autofocus', '');
  const panel = h('div', { class: 'modal message' }, h('p', {}, text.replace(/#/g, '\n')), ok);
  panel.dataset.enterCloses = '1';
  const close = open(panel, () => { queue.shift(); next(); });
}

/** Ventana de partidas: guardar con nombre, cargar o borrar. */
export function openSaves(mode: 'save' | 'load', actions: { save?: (name: string) => void; load: (name: string) => void }) {
  const list = h('ul', { class: 'saves' });
  const render = () => {
    const saves = listSaves();
    list.replaceChildren(...(saves.length ? saves.map((s) => {
      const shown = displaySaveName(s.name);
      const row = h('li', {},
        h('div', { class: 'save-info' }, h('strong', {}, shown), h('small', {}, `${formatDate(s.savedAt)} · ${formatMoney(s.money)}`)),
        button(mode === 'save' ? t('overwrite') : t('load'), () => {
          if (mode === 'save') { actions.save?.(s.name); close(); }
          else { close(); actions.load(s.name); }
        }, { cls: 'primary small' }),
        button('🗑', () => {
          if (confirm(t('confirmDelete', { name: shown }))) { deleteSave(s.name); render(); }
        }, { cls: 'small', title: t('delete') }),
      );
      return row;
    }) : [h('li', { class: 'empty' }, t('noSaves'))]));
  };
  render();

  const children: (Node | string)[] = [h('h2', {}, mode === 'save' ? t('saveHeading') : t('loadHeading'))];
  if (mode === 'save') {
    const input = h('input', { type: 'text', placeholder: t('saveNamePlaceholder'), maxlength: '40', autofocus: '' }) as HTMLInputElement;
    input.value = t('defaultSaveName', { date: new Date().toLocaleDateString(locale()) });
    const doSave = () => {
      const name = input.value.trim();
      if (!name) { input.focus(); return; }
      actions.save?.(name);
      close();
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSave(); } });
    children.push(h('div', { class: 'row' }, input, button(t('save'), doSave, { cls: 'primary' })));
  }
  children.push(list, h('div', { class: 'row end' }, button(t('close'), () => close())));
  const close = open(h('div', { class: 'modal saves-modal' }, ...children));
}
