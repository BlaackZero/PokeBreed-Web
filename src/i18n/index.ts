// Idioma de la versión web: toda la interfaz y los textos del juego original, en español o en inglés.
// El juego original está en inglés; en español sus textos se traducen al mostrarse (ver game-es.ts).
import { GAME_ES, GAME_ES_PATTERNS } from './game-es';
import { UI, type UiKey } from './ui';

export type Lang = 'es' | 'en';
const STORAGE_KEY = 'pokebreed-classic:lang';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'es' || saved === 'en') return saved;
  } catch { /* sin almacenamiento */ }
  return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

let lang: Lang = initialLang();
document.documentElement.lang = lang;

export const getLang = () => lang;
/** Formato de números y fechas del idioma actual. */
export const locale = () => (lang === 'es' ? 'es' : 'en-US');

// ---------- Interfaz ----------

/** Texto de la interfaz. Las variables se escriben {nombre}. */
export function t(key: UiKey, vars: Record<string, string | number> = {}): string {
  const s: string = UI[lang][key] ?? UI.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_m, k: string) => String(vars[k] ?? ''));
}

type Binding = { el: HTMLElement; attr: 'text' | 'title' | 'placeholder'; get: () => string };
const bindings = new Set<Binding>();
const listeners = new Set<() => void>();

function apply(b: Binding) {
  const v = b.get();
  if (b.attr === 'text') { if (b.el.textContent !== v) b.el.textContent = v; }
  else b.el.setAttribute(b.attr, v);
}

/** Pone un texto en el elemento y lo actualiza cuando cambia el idioma. */
export function bind<E extends HTMLElement>(el: E, get: () => string, attr: Binding['attr'] = 'text'): E {
  const b = { el, attr, get };
  apply(b);
  bindings.add(b);
  return el;
}

/** Se llama cada vez que cambia el idioma. */
export function onLangChange(fn: () => void) { listeners.add(fn); }

export function setLang(l: Lang) {
  if (l === lang) return;
  lang = l;
  document.documentElement.lang = l;
  try { localStorage.setItem(STORAGE_KEY, l); } catch { /* sin almacenamiento */ }
  gameCache.clear();
  for (const b of bindings) {
    // Los elementos que ya no están en la página (ventanas cerradas, menús rehechos) se olvidan.
    if (!b.el.isConnected) { bindings.delete(b); continue; }
    apply(b);
  }
  for (const fn of listeners) fn();
}

// ---------- Textos del juego original ----------

const gameCache = new Map<string, string>();

/** Traduce un texto del juego original (dibujado, ayuda de la tienda, mensajes, preguntas). */
export function tg(s: string): string {
  if (lang === 'en' || !/[A-Za-z]/.test(s)) return s;
  const hit = gameCache.get(s);
  if (hit !== undefined) return hit;
  let out = GAME_ES[s] ?? GAME_ES[s.trim()];
  if (out === undefined) {
    out = s;
    for (const [re, rep] of GAME_ES_PATTERNS) {
      if (re.test(s)) { out = s.replace(re, rep as never); break; }
    }
  }
  if (gameCache.size > 5000) gameCache.clear();
  gameCache.set(s, out);
  return out;
}
