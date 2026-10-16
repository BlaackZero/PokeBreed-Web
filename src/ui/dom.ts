// Utilidades pequeñas para construir la interfaz HTML.
import { locale, t } from '../i18n';

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else el.setAttribute(k, v);
  }
  el.append(...children);
  return el;
}

export function button(label: string, onClick: () => void, opts: { title?: string; cls?: string } = {}) {
  const b = h('button', { type: 'button', class: `btn ${opts.cls ?? ''}`.trim(), title: opts.title ?? '' }, label);
  b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); b.blur(); });
  return b;
}

/** Cambia el texto solo si es distinto (se llama en cada frame). */
export function setText(el: HTMLElement, text: string) {
  if (el.textContent !== text) el.textContent = text;
}

export const formatDate = (time: number) =>
  time ? new Date(time).toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' }) : t('unknownDate');

export const formatMoney = (n: number) => `$${(Number(n) || 0).toLocaleString(locale())}`;

/** Nombre interno del autoguardado (no cambia con el idioma para no perder la partida). */
export const AUTOSAVE = 'Autoguardado';

/** Nombre de una partida tal como se enseña. */
export const displaySaveName = (name: string) => {
  const n = name.replace(/\.pbs$/, '');
  return n === AUTOSAVE ? t('autosave') : n;
};
