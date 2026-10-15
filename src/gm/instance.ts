// Instancia de Game Maker 5 con sus variables integradas.
import type { ObjDef, Runtime } from './runtime';

const DEG = Math.PI / 180;

export class Instance {
  /** Variables definidas por el juego. */
  v: Record<string, any> = Object.create(null);
  x = 0;
  y = 0;
  xprevious = 0;
  yprevious = 0;
  xstart = 0;
  ystart = 0;
  hspeed = 0;
  vspeed = 0;
  private dir = 0;
  private spd = 0;
  friction = 0;
  gravity = 0;
  gravity_direction = 270;
  sprite_index = -1;
  image_index = 0;
  image_speed = 1;
  image_single = -1;
  depth = 0;
  visible = true;
  solid = false;
  persistent = false;
  alarm = new Array<number>(12).fill(-1);
  active = true;
  dead = false;
  /** Orden de creación (para dibujar en orden estable). */
  seq = 0;
  /** Último fotograma de su propio sprite que dibujó (la interfaz lo usa para la ficha). */
  drawnFrame: number | null = null;

  constructor(public rt: Runtime, public id: number, public obj: ObjDef) {
    this.applyObject(obj);
  }

  applyObject(obj: ObjDef) {
    this.obj = obj;
    this.sprite_index = obj.sprite;
    this.depth = obj.depth;
    this.visible = obj.visible;
    this.solid = obj.solid;
    this.persistent = obj.persistent;
  }

  get speed() { return this.spd; }
  get direction() { return this.dir; }

  setMotion(dir: number, spd: number) {
    this.dir = ((dir % 360) + 360) % 360;
    this.spd = spd;
    this.hspeed = Math.cos(this.dir * DEG) * spd;
    this.vspeed = -Math.sin(this.dir * DEG) * spd;
  }

  /** Recalcula velocidad y dirección a partir de hspeed/vspeed. */
  syncFromVector() {
    this.spd = Math.hypot(this.hspeed, this.vspeed);
    if (this.spd !== 0) this.dir = ((Math.atan2(-this.vspeed, this.hspeed) / DEG) + 360) % 360;
  }

  get spriteData() { return this.rt.spriteByIndex(this.sprite_index); }
  get maskData() { return this.rt.spriteByIndex(this.obj.mask >= 0 ? this.obj.mask : this.sprite_index); }

  /** Lee una variable integrada. */
  b(name: string): any {
    switch (name) {
      case 'x': return this.x;
      case 'y': return this.y;
      case 'xprevious': return this.xprevious;
      case 'yprevious': return this.yprevious;
      case 'xstart': return this.xstart;
      case 'ystart': return this.ystart;
      case 'hspeed': return this.hspeed;
      case 'vspeed': return this.vspeed;
      case 'speed': return this.spd;
      case 'direction': return this.dir;
      case 'friction': return this.friction;
      case 'gravity': return this.gravity;
      case 'gravity_direction': return this.gravity_direction;
      case 'sprite_index': return this.sprite_index;
      case 'image_index': return this.image_index;
      case 'image_speed': return this.image_speed;
      case 'image_single': return this.image_single;
      case 'image_number': return this.spriteData?.frames ?? 0;
      case 'sprite_width': return this.spriteData?.w ?? 0;
      case 'sprite_height': return this.spriteData?.h ?? 0;
      case 'sprite_xoffset': return this.spriteData?.ox ?? 0;
      case 'sprite_yoffset': return this.spriteData?.oy ?? 0;
      case 'depth': return this.depth;
      case 'visible': return this.visible ? 1 : 0;
      case 'solid': return this.solid ? 1 : 0;
      case 'persistent': return this.persistent ? 1 : 0;
      case 'object_index': return this.obj.index;
      case 'id': return this.id;
      case 'alarm': return this.alarm[0];
      case 'bbox_left': return this.bbox()?.l ?? this.x;
      case 'bbox_right': return this.bbox()?.r ?? this.x;
      case 'bbox_top': return this.bbox()?.t ?? this.y;
      case 'bbox_bottom': return this.bbox()?.b ?? this.y;
      case 'mask_index': return this.obj.mask;
    }
    return 0;
  }

  /** Escribe una variable integrada. */
  sb(name: string, val: any) {
    const n = Number(val);
    switch (name) {
      case 'x': this.x = n; break;
      case 'y': this.y = n; break;
      case 'xprevious': this.xprevious = n; break;
      case 'yprevious': this.yprevious = n; break;
      case 'xstart': this.xstart = n; break;
      case 'ystart': this.ystart = n; break;
      case 'hspeed': this.hspeed = n; this.syncFromVector(); break;
      case 'vspeed': this.vspeed = n; this.syncFromVector(); break;
      case 'speed': this.setMotion(this.dir, n); break;
      case 'direction': this.setMotion(n, this.spd); break;
      case 'friction': this.friction = n; break;
      case 'gravity': this.gravity = n; break;
      case 'gravity_direction': this.gravity_direction = n; break;
      case 'sprite_index': this.sprite_index = Math.round(n); break;
      case 'image_index': this.image_index = n; break;
      case 'image_speed': this.image_speed = n; break;
      case 'image_single': this.image_single = n; break;
      case 'depth': this.depth = n; break;
      case 'visible': this.visible = n >= 0.5; break;
      case 'solid': this.solid = n >= 0.5; break;
      case 'persistent': this.persistent = n >= 0.5; break;
      case 'alarm': this.alarm[0] = Math.round(n); break;
      default: break; // de solo lectura
    }
  }

  ba(name: string, i: number): any {
    if (name === 'alarm') return this.alarm[Math.round(i)] ?? -1;
    return i === 0 ? this.b(name) : 0;
  }

  sba(name: string, i: number, val: any) {
    if (name === 'alarm') { this.alarm[Math.round(i)] = Math.round(Number(val)); return; }
    if (i === 0) this.sb(name, val);
  }

  /** Imagen actual (respeta image_single). */
  frame() {
    const s = this.spriteData;
    if (!s || !s.frames) return 0;
    const i = this.image_single >= 0 ? this.image_single : this.image_index;
    return ((Math.floor(i) % s.frames) + s.frames) % s.frames;
  }

  /** Caja de colisión en coordenadas del room (bordes incluidos). */
  bbox() {
    const m = this.maskData;
    if (!m) return null;
    const [l, t, r, b] = m.bbox;
    return { l: this.x - m.ox + l, t: this.y - m.oy + t, r: this.x - m.ox + r, b: this.y - m.oy + b };
  }
}
