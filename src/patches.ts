// Cambios sobre el juego original para la versión web.
// Solo afectan a lo que se dibuja: los marcadores pequeños del original (dinero, velocidad,
// experiencia, mensajes de cría) se sustituyen por la interfaz HTML de src/ui/hud.ts.
// La tienda se muestra en un panel HTML (src/ui/shop.ts) y ya no congela ni oculta el rancho.
// La lógica del juego no se toca.
import type { Patches } from './gm/runtime';

/** Funciones de la interfaz web que se exponen al código del juego. */
export interface UiFunctions {
  ui_save_dialog: () => void;
  ui_load_dialog: () => void;
  /** Texto de ayuda de un botón de la tienda (lo recoge el panel HTML). */
  ui_tooltip: (text: string) => void;
}

export const makePatches = (ui: UiFunctions): Patches => ({
  functions: {
    ui_save_dialog: () => { ui.ui_save_dialog(); return 0; },
    ui_load_dialog: () => { ui.ui_load_dialog(); return 0; },
    ui_tooltip: (_self, _other, text) => { ui.ui_tooltip(String(text)); return 0; },
  },
  scripts: {
    // Recuadro "Speed: x/30" de la esquina superior derecha.
    scp_draw_speed: '',
    // Guardar / cargar (F5, F6 y botones de la tienda): ventana de partidas en vez de pedir un archivo.
    scp_save_game: 'ui_save_dialog();',
    scp_load_game: 'ui_load_dialog();',
  },
  events: {
    // control: recuadro del dinero. Se conserva la rosa del modo terreno.
    'control:8:0': 'if (global.terrain_edit == 1) { draw_sprite(spr_rose, -1, view_left + 20, view_top + view_height - 20); }',
    // Mensajes de cría que caen por la pantalla: se muestran como avisos HTML.
    'obj_breed_message:8:0': '',
    // Tienda: el original desactiva todas las instancias (el rancho desaparece y se congela).
    // Se crean los mismos botones, pero el juego sigue a la vista y en marcha.
    'obj_menu_bkg:0:0': [
      'global.scrollable = 0;',
      'instance_create(x + 70, y + 20, stone_type_btn); instance_create(x + 120, y + 20, pokemon_m_btn);',
      'instance_create(x + 120, y + 90, pokemon_f_btn); instance_create(x + 120, y + 160, pokemon_g_btn);',
      'instance_create(x + 170, y + 20, stuff_type_btn); instance_create(x + 170, y + 90, doll_type_btn);',
      'instance_create(x + 170, y + 160, terrain_type_btn); instance_create(x + 70, y + 90, badge_type_btn);',
      'instance_create(x + 20, y + 20, pokeball_btn); instance_create(x + 20, y + 90, rubberball_btn);',
      'instance_create(x + 20, y + 160, masterball_btn);',
      'instance_create(x + 20, y + 400, save_btn); instance_create(x + 70, y + 400, load_btn);',
      'instance_create(x + 120, y + 400, terrain_edit_btn); instance_create(x + 170, y + 400, obj_maximize_btn);',
      'instance_create(x + 345, y + 350, obj_help_btn); instance_create(x + 345, y + 400, exit_btn);',
    ].join('\n'),
  },
  templates: {
    // "¿Está el ratón encima?" de los ~420 Pokémon: en el evento Draw solo sirve para el
    // recuadro "Exp x / y"; el panel HTML lo sustituye.
    '484249#115': { eventTypes: [8], code: 'return false;' },
    // Tooltip dibujado de los botones de la tienda: el panel HTML lo muestra con su propio estilo.
    '484249#31': { eventTypes: [8], code: 'ui_tooltip(argument0);' },
  },
});
