// Funciones integradas de GML que usa el juego (y algunas comunes más).
// Todas reciben (self, other, ...argumentos).
import type { Instance } from './instance';
import type { Runtime } from './runtime';
import { dialogs } from './dialogs';

type Fn = (self: Instance, other: Instance, ...a: any[]) => any;
export type Functions = Record<string, Fn> & { __load: (key: string) => void };

export const SAVE_PREFIX = 'pokebreed-classic:save:';

export interface SaveInfo { name: string; savedAt: number; money: number }

/** Partidas guardadas, la más reciente primero. */
export function listSaves(): SaveInfo[] {
  const out: SaveInfo[] = [];
  for (const k of Object.keys(localStorage)) {
    if (!k.startsWith(SAVE_PREFIX)) continue;
    try {
      const d = JSON.parse(localStorage.getItem(k) ?? '{}');
      out.push({ name: k.slice(SAVE_PREFIX.length), savedAt: d.savedAt ?? 0, money: Number(d.globals?.money) || 0 });
    } catch {
      // partida dañada: se ignora
    }
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

export function deleteSave(name: string) { localStorage.removeItem(SAVE_PREFIX + name); }

/** Clave de una partida; acepta el nombre con o sin la extensión .pbs. */
function saveKey(name: any) {
  const n = String(name);
  if (localStorage.getItem(SAVE_PREFIX + n) === null && localStorage.getItem(`${SAVE_PREFIX}${n}.pbs`) !== null) return `${SAVE_PREFIX}${n}.pbs`;
  return SAVE_PREFIX + n;
}

/** string() de GM: enteros sin decimales, reales con dos. */
export function gmString(v: any): string {
  if (typeof v === 'string') return v;
  const n = Number(v);
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}

export function makeFunctions(rt: Runtime): Functions {
  const r = () => rt.render;
  const deg = Math.PI / 180;

  const F: Record<string, Fn> = {
    // Matemáticas
    random: (_s, _o, n) => Math.random() * n,
    round: (_s, _o, n) => Math.round(n),
    floor: (_s, _o, n) => Math.floor(n),
    ceil: (_s, _o, n) => Math.ceil(n),
    abs: (_s, _o, n) => Math.abs(n),
    sign: (_s, _o, n) => Math.sign(n),
    sqrt: (_s, _o, n) => Math.sqrt(n),
    sqr: (_s, _o, n) => n * n,
    power: (_s, _o, a, b) => a ** b,
    min: (_s, _o, ...a) => Math.min(...a),
    max: (_s, _o, ...a) => Math.max(...a),
    sin: (_s, _o, n) => Math.sin(n),
    cos: (_s, _o, n) => Math.cos(n),
    degtorad: (_s, _o, n) => n * deg,
    radtodeg: (_s, _o, n) => n / deg,
    frac: (_s, _o, n) => n - Math.trunc(n),
    choose: (_s, _o, ...a) => a[Math.floor(Math.random() * a.length)],
    point_distance: (_s, _o, x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
    point_direction: (_s, _o, x1, y1, x2, y2) => ((Math.atan2(y1 - y2, x2 - x1) / deg) + 360) % 360,
    lengthdir_x: (_s, _o, len, dir) => Math.cos(dir * deg) * len,
    lengthdir_y: (_s, _o, len, dir) => -Math.sin(dir * deg) * len,
    make_color: (_s, _o, cr, cg, cb) => (Math.round(cr) & 255) | ((Math.round(cg) & 255) << 8) | ((Math.round(cb) & 255) << 16),
    make_colour: (s, o, cr, cg, cb) => F.make_color(s, o, cr, cg, cb),

    // Cadenas
    string: (_s, _o, v) => gmString(v),
    real: (_s, _o, v) => (typeof v === 'number' ? v : parseFloat(v) || 0),
    string_length: (_s, _o, v) => String(v).length,
    chr: (_s, _o, n) => String.fromCharCode(n),
    ord: (_s, _o, c) => String(c).toUpperCase().charCodeAt(0) || 0,

    // Instancias
    instance_create: (_s, _o, x, y, obj) => rt.createInstance(x, y, obj)?.id ?? -4,
    instance_destroy: (self) => { rt.destroyInstance(self); return 0; },
    instance_exists: (s, o, obj) => (rt.resolveTargets(s, o, obj).length > 0 ? 1 : 0),
    instance_number: (_s, _o, obj) => rt.instancesOf(obj).length,
    instance_find: (_s, _o, obj, n) => rt.instancesOf(obj)[Math.round(n)]?.id ?? -4,
    instance_nearest: (_s, _o, x, y, obj) => {
      let best: Instance | null = null;
      let bd = Infinity;
      for (const i of rt.instancesOf(obj)) {
        const d = Math.hypot(i.x - x, i.y - y);
        if (d < bd) { bd = d; best = i; }
      }
      return best?.id ?? -4;
    },
    instance_change: (self, _o, obj, perf) => { rt.changeInstance(self, obj, rt.t(perf)); return 0; },
    instance_deactivate_all: (self, _o, notme) => {
      for (const i of rt.instances) if (!(rt.t(notme) && i === self)) rt.setActive(i, false);
      return 0;
    },
    instance_activate_all: () => { for (const i of rt.instances) rt.setActive(i, true); return 0; },
    instance_activate_object: (_s, _o, obj) => {
      const o = rt.objectByIndex(obj);
      if (o) for (const f of o.family) for (const i of f.instances) rt.setActive(i, true);
      return 0;
    },
    instance_deactivate_object: (_s, _o, obj) => {
      const o = rt.objectByIndex(obj);
      if (o) for (const f of o.family) for (const i of f.instances) rt.setActive(i, false);
      return 0;
    },
    object_exists: (_s, _o, obj) => (rt.objectByIndex(obj) ? 1 : 0),
    variable_local_get: (self, _o, name) => rt.rv(self, String(name)),
    variable_local_set: (self, _o, name, v) => { rt.sv(self, String(name), v); return 0; },
    variable_local_exists: (self, _o, name) => (self.v[String(name)] !== undefined ? 1 : 0),
    variable_global_get: (_s, _o, name) => rt.gv(String(name)),
    variable_global_set: (_s, _o, name, v) => { rt.globals[String(name)] = v; return 0; },
    variable_global_exists: (_s, _o, name) => (rt.globals[String(name)] !== undefined ? 1 : 0),

    // Movimiento y colisiones
    move_snap: (self, _o, hs, vs) => {
      if (hs > 0) self.x = Math.round(self.x / hs) * hs;
      if (vs > 0) self.y = Math.round(self.y / vs) * vs;
      return 0;
    },
    move_towards_point: (self, _o, x, y, sp) => {
      self.setMotion(F.point_direction(self, self, self.x, self.y, x, y), sp);
      return 0;
    },
    distance_to_point: (self, _o, x, y) => Math.hypot(self.x - x, self.y - y),
    position_meeting: (s, o, x, y, obj) => (rt.resolveTargets(s, o, obj).some((i) => rt.containsPoint(i, x, y)) ? 1 : 0),
    position_empty: (_s, _o, x, y) => (rt.instances.some((i) => i.active && !i.dead && rt.containsPoint(i, x, y)) ? 0 : 1),
    collision_point: (s, o, x, y, obj) => rt.resolveTargets(s, o, obj).find((i) => rt.containsPoint(i, x, y))?.id ?? -4,
    place_free: (self, _o, x, y) => (rt.placeFree(self, x, y) ? 1 : 0),
    place_empty: (self, _o, x, y) => (rt.placeFree(self, x, y, true) ? 1 : 0),
    place_meeting: (self, o, x, y, obj) => (rt.resolveTargets(self, o, obj).some((i) => i !== self && rt.overlaps(self, i, x, y)) ? 1 : 0),

    // Dibujo
    draw_sprite: (self, _o, spr, sub, x, y) => {
      const f = sub < 0 ? self.frame() : sub;
      if (Math.round(spr) === self.sprite_index) self.drawnFrame = f;
      r().drawSprite(spr, f, x, y);
      return 0;
    },
    draw_sprite_stretched: (self, _o, spr, sub, x, y, w, h) => { r().drawSpriteStretched(spr, sub < 0 ? self.frame() : sub, x, y, w, h); return 0; },
    draw_text: (_s, _o, x, y, str) => { r().drawText(x, y, gmString(str)); return 0; },
    draw_text_ext: (_s, _o, x, y, str, sep, w) => { r().drawTextExt(x, y, gmString(str), sep, w); return 0; },
    string_width: (_s, _o, str) => r().stringWidthExt(gmString(str), -1, -1),
    string_height: (_s, _o, str) => r().stringHeightExt(gmString(str), -1, -1),
    string_width_ext: (_s, _o, str, sep, w) => r().stringWidthExt(gmString(str), sep, w),
    string_height_ext: (_s, _o, str, sep, w) => r().stringHeightExt(gmString(str), sep, w),
    draw_rectangle: (_s, _o, x1, y1, x2, y2) => { r().drawRectangle(x1, y1, x2, y2); return 0; },
    draw_line: (_s, _o, x1, y1, x2, y2) => { r().drawLine(x1, y1, x2, y2); return 0; },
    draw_circle: (_s, _o, x, y, rad) => { r().drawEllipse(x - rad, y - rad, x + rad, y + rad); return 0; },
    draw_ellipse: (_s, _o, x1, y1, x2, y2) => { r().drawEllipse(x1, y1, x2, y2); return 0; },

    // Sonido
    sound_play: (_s, _o, snd) => { rt.audio.play(snd, false); return 0; },
    sound_loop: (_s, _o, snd) => { rt.audio.play(snd, true); return 0; },
    sound_stop: (_s, _o, snd) => { rt.audio.stop(snd); return 0; },
    sound_stop_all: () => { rt.audio.stopAll(); return 0; },
    sound_isplaying: (_s, _o, snd) => (rt.audio.isPlaying(snd) ? 1 : 0),

    // Teclado y ratón
    keyboard_check: (_s, _o, key) => (rt.input.check(key) ? 1 : 0),
    keyboard_check_pressed: (_s, _o, key) => (rt.input.checkPressed(key) ? 1 : 0),
    keyboard_set_map: (_s, _o, from, to) => { rt.input.setMap(from, to); return 0; },
    keyboard_unset_map: () => { rt.input.clearMap(); return 0; },
    mouse_check_button: (_s, _o, b) => (rt.input.checkButton(b) ? 1 : 0),
    io_clear: () => { rt.input.clear(); return 0; },

    // Diálogos (bloqueantes, como en Game Maker)
    show_message: (_s, _o, msg) => { rt.input.clear(); dialogs.message(gmString(msg)); return 0; },
    show_message_ext: (_s, _o, msg, b1, b2, b3) => { rt.input.clear(); return dialogs.choice(gmString(msg), [b1, b2, b3].map(String)); },
    show_question: (_s, _o, msg) => { rt.input.clear(); return dialogs.question(gmString(msg)) ? 1 : 0; },
    get_string: (_s, _o, msg, def) => { rt.input.clear(); return dialogs.prompt(gmString(msg), gmString(def)) ?? ''; },
    get_integer: (_s, _o, msg, def) => { rt.input.clear(); return parseFloat(dialogs.prompt(gmString(msg), gmString(def)) ?? '') || 0; },
    show_info: () => { rt.input.clear(); dialogs.info(rt.data.helpRtf); return 0; },

    // Juego y rooms
    game_end: () => { rt.ended = true; return 0; },
    game_restart: () => { rt.restart(); return 0; },
    room_goto: (_s, _o, room) => { rt.gotoRoom(room); return 0; },
    room_restart: () => { rt.gotoRoom(rt.room); return 0; },

    // Archivos y partidas (en localStorage)
    file_exists: (_s, _o, name) => (localStorage.getItem(SAVE_PREFIX + String(name)) !== null ? 1 : 0),
    get_save_filename: (_s, _o, _filter, def) => {
      rt.input.clear();
      return dialogs.prompt('Nombre de la partida a guardar:', gmString(def) || 'partida') ?? '';
    },
    get_open_filename: () => {
      rt.input.clear();
      const names = Object.keys(localStorage).filter((k) => k.startsWith(SAVE_PREFIX)).map((k) => k.slice(SAVE_PREFIX.length));
      if (!names.length) { dialogs.message('No hay partidas guardadas.'); return ''; }
      return dialogs.prompt(`Partidas guardadas:\n${names.join('\n')}\n\nEscribe el nombre de la que quieres cargar:`, names[names.length - 1]) ?? '';
    },
    game_save: (_s, _o, name) => {
      try {
        localStorage.setItem(SAVE_PREFIX + String(name), JSON.stringify(snapshot(rt)));
      } catch (e) {
        dialogs.message(`No se pudo guardar: ${(e as Error).message}`);
      }
      return 0;
    },
    game_load: (_s, _o, name) => {
      const key = saveKey(name);
      if (localStorage.getItem(key) === null) { dialogs.message(`No existe la partida "${String(name)}".`); return 0; }
      rt.requestLoad(key.slice(SAVE_PREFIX.length));
      return 0;
    },
  };

  const out = F as Functions;
  out.__load = (key: string) => {
    const raw = localStorage.getItem(SAVE_PREFIX + key);
    if (raw) restore(rt, JSON.parse(raw));
  };
  return out;
}

// ---------- Guardar / cargar partida ----------

interface Snapshot {
  savedAt: number;
  room: number;
  roomSpeed: number;
  views: Runtime['views'];
  backgroundVisible: boolean[];
  globals: Record<string, any>;
  draw: Record<string, any>;
  instances: Record<string, any>[];
}

const INST_FIELDS = ['id', 'x', 'y', 'xprevious', 'yprevious', 'xstart', 'ystart', 'hspeed', 'vspeed', 'friction', 'gravity',
  'gravity_direction', 'sprite_index', 'image_index', 'image_speed', 'image_single', 'depth', 'visible', 'solid', 'persistent', 'active'] as const;

function snapshot(rt: Runtime): Snapshot {
  return {
    savedAt: Date.now(),
    room: rt.room,
    roomSpeed: rt.roomSpeed,
    views: rt.views.map((v) => ({ ...v })),
    backgroundVisible: [...rt.backgroundVisible],
    globals: { ...rt.globals },
    draw: rt.render.drawState(),
    instances: rt.instances.filter((i) => !i.dead).map((i) => {
      const o: Record<string, any> = { obj: i.obj.index, alarm: [...i.alarm], v: { ...i.v }, dir: i.direction, spd: i.speed };
      for (const f of INST_FIELDS) o[f] = (i as any)[f];
      delete o.v['@mouseover'];
      return o;
    }),
  };
}

function restore(rt: Runtime, s: Snapshot) {
  rt.audio.stopAll();
  rt.clearAll();
  rt.startRoomShell(s.room);
  rt.roomSpeed = s.roomSpeed;
  rt.views = s.views;
  rt.backgroundVisible = s.backgroundVisible;
  rt.globals = Object.assign(Object.create(null), s.globals);
  rt.render.setDrawState(s.draw);
  for (const d of s.instances) {
    const inst = rt.createInstance(d.x, d.y, d.obj, d.id, false);
    if (!inst) continue;
    for (const f of INST_FIELDS) (inst as any)[f] = d[f];
    inst.alarm = d.alarm;
    inst.v = Object.assign(Object.create(null), d.v);
    inst.setMotion(d.dir, d.spd);
    inst.hspeed = d.hspeed;
    inst.vspeed = d.vspeed;
  }
}
