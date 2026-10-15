// Diálogos de Game Maker. En GM5 detienen el juego hasta que se responden, así que se usan
// los diálogos nativos del navegador, que también son bloqueantes.

/** En GM, '#' es un salto de línea. */
const text = (s: string) => s.replace(/#/g, '\n');

/** RTF de la "Game Information" → texto plano. */
export function rtfToText(rtf: string): string {
  let s = rtf.replace(/\r\n/g, '\n');
  s = s.replace(/\{\\fonttbl[\s\S]*?\}\}/, '').replace(/\{\\colortbl[^}]*\}/, '');
  s = s.replace(/\\par[d]?\b ?/g, (m) => (m.startsWith('\\pard') ? '' : '\n'));
  s = s.replace(/\\'([0-9a-f]{2})/gi, (_m, h) => String.fromCharCode(parseInt(h, 16)));
  s = s.replace(/\\[a-z]+-?\d* ?/gi, '').replace(/[{}]/g, '');
  return s.replace(/\n{3,}/g, '\n\n').trim();
}

/** La interfaz puede mostrar los mensajes a su manera (show_message no devuelve nada). */
export const dialogHooks: { message: ((msg: string) => void) | null } = { message: null };

export const dialogs = {
  message(msg: string) {
    if (dialogHooks.message) dialogHooks.message(msg);
    else window.alert(text(msg));
  },
  question(msg: string) { return window.confirm(text(msg)); },
  prompt(msg: string, def: string) { return window.prompt(text(msg), def); },
  /** show_message_ext: devuelve el número del botón (1-3), 0 si se cancela. */
  choice(msg: string, buttons: string[]) {
    const real = buttons.map((b, i) => [b, i + 1] as const).filter(([b]) => b !== '');
    if (real.length <= 1) { window.alert(text(msg)); return real[0]?.[1] ?? 0; }
    const ok = window.confirm(`${text(msg)}\n\n[Aceptar] = ${real[0][0]}   [Cancelar] = ${real[real.length - 1][0]}`);
    return ok ? real[0][1] : real[real.length - 1][1];
  },
  info(rtf: string) {
    const el = document.getElementById('help');
    if (el) {
      el.querySelector('pre')!.textContent = rtfToText(rtf);
      el.classList.add('open');
    } else {
      window.alert(rtfToText(rtf));
    }
  },
};
