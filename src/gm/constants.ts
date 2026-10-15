// Constantes y nombres de variables integradas de Game Maker 5.

const rgb = (r: number, g: number, b: number) => r | (g << 8) | (b << 16);

export const CONSTANTS: Record<string, number> = {
  true: 1, false: 0, pi: Math.PI,
  c_aqua: rgb(0, 255, 255), c_black: 0, c_blue: rgb(0, 0, 255), c_dkgray: rgb(64, 64, 64), c_fuchsia: rgb(255, 0, 255),
  c_gray: rgb(128, 128, 128), c_green: rgb(0, 128, 0), c_lime: rgb(0, 255, 0), c_ltgray: rgb(192, 192, 192),
  c_maroon: rgb(128, 0, 0), c_navy: rgb(0, 0, 128), c_olive: rgb(128, 128, 0), c_purple: rgb(128, 0, 128),
  c_red: rgb(255, 0, 0), c_silver: rgb(192, 192, 192), c_teal: rgb(0, 128, 128), c_white: rgb(255, 255, 255),
  c_yellow: rgb(255, 255, 0), c_orange: rgb(255, 160, 64),
  fs_normal: 0, fs_bold: 1, fs_italic: 2, fs_bolditalic: 3,
  fa_left: 0, fa_center: 1, fa_right: 2,
  bs_solid: 0, bs_hollow: 1,
  vk_nokey: 0, vk_anykey: 1, vk_backspace: 8, vk_tab: 9, vk_enter: 13, vk_return: 13, vk_shift: 16, vk_control: 17,
  vk_alt: 18, vk_pause: 19, vk_escape: 27, vk_space: 32, vk_pageup: 33, vk_pagedown: 34, vk_end: 35, vk_home: 36,
  vk_left: 37, vk_up: 38, vk_right: 39, vk_down: 40, vk_insert: 45, vk_delete: 46,
  vk_numpad0: 96, vk_numpad1: 97, vk_numpad2: 98, vk_numpad3: 99, vk_numpad4: 100, vk_numpad5: 101,
  vk_numpad6: 102, vk_numpad7: 103, vk_numpad8: 104, vk_numpad9: 105,
  vk_multiply: 106, vk_add: 107, vk_subtract: 109, vk_decimal: 110, vk_divide: 111,
  vk_f1: 112, vk_f2: 113, vk_f3: 114, vk_f4: 115, vk_f5: 116, vk_f6: 117, vk_f7: 118, vk_f8: 119,
  vk_f9: 120, vk_f10: 121, vk_f11: 122, vk_f12: 123,
  mb_any: -1, mb_none: 0, mb_left: 1, mb_right: 2, mb_middle: 3,
};

export const INSTANCE_BUILTINS = new Set([
  'x', 'y', 'xprevious', 'yprevious', 'xstart', 'ystart', 'hspeed', 'vspeed', 'speed', 'direction', 'friction',
  'gravity', 'gravity_direction', 'sprite_index', 'image_index', 'image_speed', 'image_single', 'image_number',
  'sprite_width', 'sprite_height', 'sprite_xoffset', 'sprite_yoffset', 'depth', 'visible', 'solid', 'persistent',
  'object_index', 'id', 'alarm', 'bbox_left', 'bbox_right', 'bbox_top', 'bbox_bottom', 'mask_index',
]);

export const GLOBAL_BUILTINS = new Set([
  'room', 'room_width', 'room_height', 'room_speed', 'room_caption', 'room_first', 'room_last',
  'mouse_x', 'mouse_y', 'mouse_button', 'keyboard_key', 'keyboard_lastkey',
  'view_left', 'view_top', 'view_width', 'view_height', 'view_xview', 'view_yview', 'view_wview', 'view_hview',
  'view_visible', 'view_enabled', 'view_current', 'background_visible', 'fps', 'current_time', 'instance_count',
  'font_name', 'font_size', 'font_color', 'font_style', 'font_angle', 'font_align',
  'brush_color', 'brush_style', 'pen_color', 'pen_size', 'score', 'lives', 'health',
]);
