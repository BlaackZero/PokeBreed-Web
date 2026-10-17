// Ventanas HTML: mensajes del juego (show_message).
import { t } from '../i18n';
import { button, h } from './dom';

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
