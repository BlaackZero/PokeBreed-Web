// Acciones "drag & drop" de la librería estándar de Game Maker 5.
// Cada una recibe (self, other, relativo, ...argumentos ya evaluados).
import type { Instance } from './instance';
import type { Runtime } from './runtime';
import { gmString } from './functions';
import { dialogs } from './dialogs';

type Act = (self: Instance, other: Instance, rel: number, ...a: any[]) => any;
export type Actions = Record<string, Act>;

/** Direcciones de "Move Fixed": las 9 casillas de la flecha, de arriba a la izquierda. */
const FIXED_DIRS = [225, 270, 315, 180, -1, 0, 135, 90, 45];

export function makeActions(rt: Runtime): Actions {
  const r = () => rt.render;
  const cmp = (a: any, b: any, op: number) => (op === 0 ? rt.eq(a, b) : op === 1 ? a < b : a > b);

  return {
    action_move: (self, _o, rel, dirs: string, speed: number) => {
      const options = [...String(dirs)].map((c, i) => (c === '1' ? FIXED_DIRS[i] : null)).filter((d) => d !== null) as number[];
      if (!options.length) return 0;
      const d = options[Math.floor(Math.random() * options.length)];
      if (d < 0) self.setMotion(self.direction, 0);
      else if (rel) { self.hspeed += Math.cos((d * Math.PI) / 180) * speed; self.vspeed -= Math.sin((d * Math.PI) / 180) * speed; self.syncFromVector(); }
      else self.setMotion(d, speed);
      return 0;
    },
    action_set_motion: (self, _o, rel, dir, speed) => {
      if (rel) {
        self.hspeed += Math.cos((dir * Math.PI) / 180) * speed;
        self.vspeed -= Math.sin((dir * Math.PI) / 180) * speed;
        self.syncFromVector();
      } else self.setMotion(dir, speed);
      return 0;
    },
    action_move_point: (self, _o, rel, x, y, speed) => {
      const tx = rel ? self.x + x : x;
      const ty = rel ? self.y + y : y;
      self.setMotion(((Math.atan2(self.y - ty, tx - self.x) * 180) / Math.PI + 360) % 360, speed);
      return 0;
    },
    action_set_hspeed: (self, _o, rel, v) => { self.hspeed = rel ? self.hspeed + v : v; self.syncFromVector(); return 0; },
    action_set_vspeed: (self, _o, rel, v) => { self.vspeed = rel ? self.vspeed + v : v; self.syncFromVector(); return 0; },
    action_set_friction: (self, _o, rel, v) => { self.friction = rel ? self.friction + v : v; return 0; },
    action_set_gravity: (self, _o, rel, dir, v) => { self.gravity_direction = dir; self.gravity = rel ? self.gravity + v : v; return 0; },
    action_move_to: (self, _o, rel, x, y) => {
      self.x = rel ? self.x + x : x;
      self.y = rel ? self.y + y : y;
      return 0;
    },
    action_move_start: (self) => { self.x = self.xstart; self.y = self.ystart; return 0; },
    action_snap: (self, _o, _rel, hs, vs) => rt.F.move_snap(self, self, hs, vs),
    action_reverse_xdir: (self) => { self.hspeed = -self.hspeed; self.syncFromVector(); return 0; },
    action_reverse_ydir: (self) => { self.vspeed = -self.vspeed; self.syncFromVector(); return 0; },
    action_bounce: (self, _o, _rel, _precise, against) => {
      const all = against === 1;
      const free = (x: number, y: number) => rt.placeFree(self, x, y, all);
      let hs = self.hspeed;
      let vs = self.vspeed;
      if (!free(self.x + hs, self.y)) hs = -hs;
      if (!free(self.x, self.y + vs)) vs = -vs;
      if (hs === self.hspeed && vs === self.vspeed && !free(self.x + hs, self.y + vs)) { hs = -hs; vs = -vs; }
      self.hspeed = hs;
      self.vspeed = vs;
      self.syncFromVector();
      return 0;
    },
    action_wrap: (self, _o, _rel, dir) => {
      const w = rt.roomWidth;
      const h = rt.roomHeight;
      if (dir !== 1) { if (self.x < 0) self.x += w; else if (self.x >= w) self.x -= w; }
      if (dir !== 0) { if (self.y < 0) self.y += h; else if (self.y >= h) self.y -= h; }
      return 0;
    },

    action_create_object: (self, _o, rel, obj, x, y) => {
      rt.createInstance(rel ? self.x + x : x, rel ? self.y + y : y, obj);
      return 0;
    },
    action_create_object_motion: (self, _o, rel, obj, x, y, speed, dir) => {
      const inst = rt.createInstance(rel ? self.x + x : x, rel ? self.y + y : y, obj);
      inst?.setMotion(dir, speed);
      return 0;
    },
    action_change_object: (self, _o, _rel, obj, perform) => { rt.changeInstance(self, obj, perform === 1); return 0; },
    action_kill_object: (self) => { rt.destroyInstance(self); return 0; },
    action_kill_position: (self, _o, rel, x, y) => {
      const px = rel ? self.x + x : x;
      const py = rel ? self.y + y : y;
      for (const i of [...rt.instances]) if (i.active && !i.dead && rt.containsPoint(i, px, py)) rt.destroyInstance(i);
      return 0;
    },
    action_sprite_set: (self, _o, _rel, spr, sub, speed) => {
      self.sprite_index = spr;
      if (sub >= 0) self.image_index = sub;
      self.image_speed = speed;
      return 0;
    },

    action_sound: (_s, _o, _rel, snd, loop) => { rt.audio.play(snd, loop === 1); return 0; },
    action_end_sound: (_s, _o, _rel, snd) => { rt.audio.stop(snd); return 0; },
    action_if_sound: (_s, _o, _rel, snd) => rt.audio.isPlaying(snd),
    action_another_room: (_s, _o, _rel, room) => { rt.gotoRoom(room); return 0; },
    action_previous_room: () => { const o = rt.data.roomOrder; rt.gotoRoom(o[o.indexOf(rt.room) - 1] ?? rt.room); return 0; },
    action_next_room: () => { const o = rt.data.roomOrder; rt.gotoRoom(o[o.indexOf(rt.room) + 1] ?? rt.room); return 0; },
    action_current_room: () => { rt.gotoRoom(rt.room); return 0; },

    action_set_alarm: (self, _o, rel, steps, n) => {
      const i = Math.round(n);
      self.alarm[i] = Math.round(rel ? self.alarm[i] + steps : steps);
      return 0;
    },
    action_message: (_s, _o, _rel, msg) => { rt.input.clear(); dialogs.message(gmString(msg)); return 0; },
    action_show_info: () => { rt.input.clear(); dialogs.info(rt.data.helpRtf); return 0; },
    action_restart_game: () => { rt.restart(); return 0; },
    action_end_game: () => { rt.ended = true; return 0; },
    action_save_game: (s, o, _rel, name) => rt.F.game_save(s, o, name),
    action_load_game: (s, o, _rel, name) => rt.F.game_load(s, o, name),

    action_if_empty: (self, _o, rel, x, y, all) => rt.placeFree(self, rel ? self.x + x : x, rel ? self.y + y : y, all === 1),
    action_if_collision: (self, _o, rel, x, y, all) => !rt.placeFree(self, rel ? self.x + x : x, rel ? self.y + y : y, all === 1),
    action_if_object: (self, o, rel, obj, x, y) => rt.F.place_meeting(self, o, rel ? self.x + x : x, rel ? self.y + y : y, obj) === 1,
    action_if_number: (_s, _o, _rel, obj, n, op) => cmp(rt.instancesOf(obj).length, n, op),
    action_if_dice: (_s, _o, _rel, sides) => Math.random() * sides < 1,
    action_if_question: (_s, _o, _rel, msg) => { rt.input.clear(); return dialogs.question(gmString(msg)); },
    action_if_mouse: (_s, _o, _rel, b) => rt.input.checkButton(b),
    action_if_variable: (_s, _o, _rel, a, b, op) => cmp(a, b, op),
    action_if: (_s, _o, _rel, v) => rt.t(v),

    action_draw_sprite: (self, _o, rel, spr, x, y, sub) => {
      r().drawSprite(spr, sub < 0 ? self.frame() : sub, rel ? self.x + x : x, rel ? self.y + y : y);
      return 0;
    },
    action_draw_text: (self, _o, rel, text, x, y) => { r().drawText(rel ? self.x + x : x, rel ? self.y + y : y, gmString(text)); return 0; },
    action_draw_variable: (self, _o, rel, v, x, y) => { r().drawText(rel ? self.x + x : x, rel ? self.y + y : y, gmString(v)); return 0; },
    action_draw_rectangle: (self, _o, rel, x1, y1, x2, y2) => {
      const dx = rel ? self.x : 0;
      const dy = rel ? self.y : 0;
      r().drawRectangle(x1 + dx, y1 + dy, x2 + dx, y2 + dy);
      return 0;
    },
    action_draw_ellipse: (self, _o, rel, x1, y1, x2, y2) => {
      const dx = rel ? self.x : 0;
      const dy = rel ? self.y : 0;
      r().drawEllipse(x1 + dx, y1 + dy, x2 + dx, y2 + dy);
      return 0;
    },
    action_draw_line: (self, _o, rel, x1, y1, x2, y2) => {
      const dx = rel ? self.x : 0;
      const dy = rel ? self.y : 0;
      r().drawLine(x1 + dx, y1 + dy, x2 + dx, y2 + dy);
      return 0;
    },
    action_color: (_s, _o, _rel, fill, line) => { r().brush_color = fill; r().pen_color = line; return 0; },
    action_draw_font: (_s, _o, _rel, font: any[]) => {
      const [name, size, color, bold, italic] = font;
      const g = r();
      g.font_name = String(name);
      g.font_size = Number(size) || 10;
      g.font_color = Number(color) || 0;
      g.font_style = (bold ? 1 : 0) + (italic ? 2 : 0);
      return 0;
    },
    action_fullscreen: () => { r().toggleFullscreen(); return 0; },
    action_draw_score: () => 0,
  };
}
