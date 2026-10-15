// Utilidades pequeñas para construir la interfaz HTML.

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

export const formatDate = (t: number) =>
  t ? new Date(t).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' }) : 'fecha desconocida';
