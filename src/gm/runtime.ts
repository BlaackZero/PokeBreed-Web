// Runtime de Game Maker 5: objetos, instancias, eventos, rooms y el ciclo de cada step.
import { compileActions, CodeTable } from './actions';
import type { ActionData } from './types';
import { compileCode, type CompileEnv, type Compiled } from './gml';
import { Instance } from './instance';
import type { GameData, ObjectData, RoomData, SpriteData } from './types';
import { CONSTANTS, GLOBAL_BUILTINS, INSTANCE_BUILTINS } from './constants';
import { makeFunctions, type Functions } from './functions';
import { makeActions, type Actions } from './dnd';
import type { Renderer } from './render';
import type { Input } from './input';
import type { Audio } from './audio';

export const EV = { CREATE: 0, DESTROY: 1, ALARM: 2, STEP: 3, COLLISION: 4, KEYBOARD: 5, MOUSE: 6, OTHER: 7, DRAW: 8, KEYPRESS: 9, KEYRELEASE: 10 };
/** Eventos de ratón de botón (mantener, pulsar) que hacen que un toque cuente como clic y no arrastre la vista. */
const MOUSE_BUTTON_EVENTS = [0, 1, 2, 4, 5, 6];

class ExitSignal { }
class ReturnSignal { constructor(public value: any) {} }
const EXIT = new ExitSignal();

export interface ObjDef {
  index: number;
  name: string;
  data: ObjectData;
  parent: ObjDef | null;
  sprite: number;
  mask: number;
  solid: boolean;
  visible: boolean;
  depth: number;
  persistent: boolean;
  /** Eventos propios: clave "tipo:num" → acciones sin compilar. */
  own: Map<string, ObjectData['events'][number]>;
  /** Eventos compilados (propios) por clave. */
  compiled: Map<string, Compiled>;
  /** Hijos directos. */
  children: ObjDef[];
  /** Este objeto y todos sus descendientes. */
  family: ObjDef[];
  /** Claves de colisión resueltas (con herencia): índice del otro objeto. */
  collisionTargets: number[];
  /** Instancias activas de exactamente este objeto. */
  instances: Set<Instance>;
}

interface Frame { owner: ObjDef; key: string }

/** Cambios sobre el juego original (mejoras de interfaz), sin tocar los datos extraídos. */
export interface Patches {
  /** Script → nuevo código GML. */
  scripts?: Record<string, string>;
  /** "objeto:tipo:num" → nuevo código GML para ese evento ('' lo vacía). */
  events?: Record<string, string>;
  /** "lib#id" → código de la acción de librería en los tipos de evento indicados. */
  templates?: Record<string, { eventTypes: number[]; code: string }>;
  /** Funciones GML extra que pueden usar los parches. */
  functions?: Record<string, (self: Instance, other: Instance, ...a: any[]) => any>;
}

/** Decide el tamaño de la vista de un room (para usar toda la pantalla). */
export type ViewSizer = (room: RoomData) => { width: number; height: number } | null;

export class Runtime {
  readonly env: CompileEnv;
  readonly codes = new CodeTable();
  readonly objects: (ObjDef | null)[] = [];
  readonly spriteList: (SpriteData | null)[];
  readonly F: Functions;
  readonly A: Actions;
  scripts: (Compiled | null)[] = [];

  instances: Instance[] = [];
  private byId = new Map<number, Instance>();
  private nextId = 100001;
  private seq = 0;
  globals: Record<string, any> = Object.create(null);
  private stack: Frame[] = [];

  room = -1;
  roomData!: RoomData;
  roomWidth = 640;
  roomHeight = 480;
  roomSpeed = 30;
  roomCaption = '';
  views: { visible: boolean; left: number; top: number; width: number; height: number }[] = [];
  backgroundVisible: boolean[] = [];
  private pendingRoom: number | null = null;
  private pendingRestart = false;
  private pendingLoad: string | null = null;
  fpsMeasured = 30;
  private errors = new Set<string>();
  private loopCount = 0;
  ended = false;
  viewSizer: ViewSizer | null = null;
  /** Instancias que muestra la interfaz HTML: no se dibujan en el canvas ni reciben el ratón del canvas. */
  uiOwned: ((i: Instance) => boolean) | null = null;
  /** Instancias en su evento Destroy, y las que ese evento ha cambiado de objeto (no se destruyen). */
  private destroying = new Set<Instance>();
  private revived = new Set<Instance>();

  /** Cambia el tamaño de la vista 0 manteniendo su centro dentro del room. */
  setViewSize(width: number, height: number) {
    const v = this.views[0];
    if (!v) return;
    const cx = v.left + v.width / 2;
    const cy = v.top + v.height / 2;
    v.width = width;
    v.height = height;
    v.left = cx - width / 2;
    v.top = cy - height / 2;
    this.clampView();
  }

  clampView() {
    const v = this.views[0];
    if (!v) return;
    v.left = v.width >= this.roomWidth ? (this.roomWidth - v.width) / 2 : Math.max(0, Math.min(v.left, this.roomWidth - v.width));
    v.top = v.height >= this.roomHeight ? (this.roomHeight - v.height) / 2 : Math.max(0, Math.min(v.top, this.roomHeight - v.height));
  }

  constructor(
    public data: GameData,
    public render: Renderer,
    public input: Input,
    public audio: Audio,
    private patches: Patches = {},
  ) {
    this.spriteList = data.resources.sprites.map((n) => (n ? data.sprites[n] : null));
    const constants = new Map<string, number>(Object.entries(CONSTANTS));
    const addRes = (list: (string | null)[]) => list.forEach((n, i) => { if (n && !constants.has(n)) constants.set(n, i); });
    addRes(data.resources.objects);
    addRes(data.resources.sprites);
    addRes(data.resources.sounds);
    addRes(data.resources.backgrounds);
    addRes(data.resources.rooms);
    const scripts = new Map<string, number>();
    data.resources.scripts.forEach((n, i) => { if (n) scripts.set(n, i); });

    this.F = makeFunctions(this);
    Object.assign(this.F, this.patches.functions ?? {});
    this.A = makeActions(this);
    this.env = {
      constants,
      instanceBuiltins: INSTANCE_BUILTINS,
      globalBuiltins: GLOBAL_BUILTINS,
      functions: new Set(Object.keys(this.F)),
      scripts,
      unknown: new Set(),
    };

    this.buildObjects();
    this.scripts = data.resources.scripts.map((n, i) => {
      if (!n) return null;
      const s = data.scripts.find((x) => x.id === i)!;
      try {
        return compileCode(this.patches.scripts?.[n] ?? s.code, this.env, `script ${n}`);
      } catch (e) {
        this.report(e);
        return null;
      }
    });
  }

  // ---------- Objetos ----------

  private buildObjects() {
    const nameToIndex = new Map<string, number>();
    this.data.resources.objects.forEach((n, i) => { if (n) nameToIndex.set(n, i); });
    const spr = (n: string | null) => (n ? this.data.sprites[n]?.id ?? -1 : -1);
    this.data.objects.forEach((o, i) => {
      if (!o) { this.objects.push(null); return; }
      const own = new Map<string, ObjectData['events'][number]>();
      for (const e of o.events) own.set(`${e.type}:${e.num}`, e);
      for (const [k, code] of Object.entries(this.patches.events ?? {})) {
        const [name, type, num] = k.split(':');
        if (name !== o.name) continue;
        const action: ActionData = { lib: 1, id: 603, kind: 7, question: false, execType: 2, argKinds: [1], args: [code], appliesTo: -1 };
        own.set(`${type}:${num}`, { type: Number(type), num: Number(num), actions: code ? [action] : [] });
      }
      this.objects.push({
        index: i, name: o.name, data: o, parent: null, sprite: spr(o.sprite), mask: spr(o.mask),
        solid: o.solid, visible: o.visible, depth: o.depth, persistent: o.persistent,
        own, compiled: new Map(), children: [], family: [], collisionTargets: [], instances: new Set(),
      });
    });
    for (const o of this.objects) {
      if (!o?.data.parent) continue;
      const p = this.objects[nameToIndex.get(o.data.parent) ?? -1] ?? null;
      o.parent = p;
      p?.children.push(o);
    }
    const family = (o: ObjDef): ObjDef[] => [o, ...o.children.flatMap(family)];
    for (const o of this.objects) {
      if (!o) continue;
      o.family = family(o);
      const targets = new Set<number>();
      for (let p: ObjDef | null = o; p; p = p.parent) {
        for (const e of p.data.events) if (e.type === EV.COLLISION) targets.add(e.num);
      }
      // GM procesa las colisiones de cada instancia por índice de objeto, de menor a mayor.
      o.collisionTargets = [...targets].sort((a, b) => a - b);
    }
  }

  objectByIndex(i: number) { return this.objects[Math.round(i)] ?? null; }
  spriteByIndex(i: number) { return this.spriteList[Math.round(i)] ?? null; }

  /** Evento resuelto con herencia: [función, objeto dueño]. */
  private resolve(obj: ObjDef, key: string): [Compiled, ObjDef] | null {
    for (let o: ObjDef | null = obj; o; o = o.parent) {
      const ev = o.own.get(key);
      if (!ev) continue;
      let fn = o.compiled.get(key);
      if (!fn) {
        const label = `${o.name} evento ${key}`;
        try {
          const tpl = this.patches.templates ?? {};
          const body = compileActions(ev.actions, this.env, this.codes, label, Number(key.split(':')[0]),
            (lib, id, type) => (tpl[`${lib}#${id}`]?.eventTypes.includes(type) ? tpl[`${lib}#${id}`].code : undefined));
          fn = new Function('rt', 'self', 'other', 'args', body) as Compiled;
        } catch (e) {
          this.report(e);
          fn = () => 0;
        }
        o.compiled.set(key, fn);
      }
      return [fn, o];
    }
    return null;
  }

  /** Compila todos los eventos (diagnóstico): devuelve los errores encontrados. */
  compileAll() {
    const before = this.errors.size;
    for (const o of this.objects) if (o) for (const key of o.own.keys()) this.resolve(o, key);
    return { errors: [...this.errors].slice(before), unknownFunctions: [...(this.env.unknown ?? [])] };
  }

  hasEvent(obj: ObjDef, type: number, num: number) {
    for (let o: ObjDef | null = obj; o; o = o.parent) if (o.own.has(`${type}:${num}`)) return true;
    return false;
  }

  /** Ejecuta un evento sobre una instancia. Devuelve false si no existe. */
  event(inst: Instance, type: number, num: number, other: Instance = inst): boolean {
    const key = `${type}:${num}`;
    const r = this.resolve(inst.obj, key);
    if (!r) return false;
    this.invoke(r[0], inst, other, [], { owner: r[1], key });
    return true;
  }

  private invoke(fn: Compiled, self: Instance, other: Instance, args: any[], frame: Frame | null): any {
    if (frame) this.stack.push(frame);
    try {
      return fn(this, self, other, args);
    } catch (e) {
      if (e instanceof ExitSignal) return 0;
      if (e instanceof ReturnSignal) return e.value;
      this.report(e, frame?.key);
      return 0;
    } finally {
      if (frame) this.stack.pop();
    }
  }

  inherited(self: Instance, other: Instance) {
    const f = this.stack[this.stack.length - 1];
    if (!f?.owner.parent) return 0;
    const r = this.resolve(f.owner.parent, f.key);
    if (!r) return 0;
    // Una salida (exit) dentro del evento padre no debe cortar el del hijo.
    this.invoke(r[0], self, other, [], { owner: r[1], key: f.key });
    return 0;
  }

  script(index: number, self: Instance, other: Instance, args: any[]) {
    const fn = this.scripts[Math.round(index)];
    if (!fn) return 0;
    return this.invoke(fn, self, other, args, null);
  }

  runCode(index: number, self: Instance, other: Instance, args: any[]) {
    return this.invoke(this.codes.fns[index], self, other, args, null);
  }

  exit(): never { throw EXIT; }
  ret(v: any): never { throw new ReturnSignal(v); }

  report(e: unknown, where = '') {
    const msg = `${where} ${(e as Error)?.message ?? e}`;
    if (this.errors.has(msg)) return;
    this.errors.add(msg);
    console.error('[GM]', msg, e);
  }

  unknownFn(name: string) {
    this.report(new Error(`Función no implementada: ${name}`));
    return 0;
  }

  loopGuard() {
    if (++this.loopCount > 1_000_000) throw new Error('Bucle infinito detectado');
  }

  // ---------- Valores ----------

  t(v: any) { return typeof v === 'number' ? v >= 0.5 : v === true; }
  eq(a: any, b: any) { return typeof a === typeof b ? (typeof a === 'number' ? Math.abs(a - b) < 1e-9 : a === b) : false; }
  add(a: any, b: any) { return typeof a === 'string' || typeof b === 'string' ? `${a}${b}` : a + b; }

  // Variables de instancia definidas por el usuario.
  rv(self: Instance, name: string) {
    const v = self.v[name];
    if (v === undefined) return this.undefinedVar(self, name);
    return v;
  }
  sv(self: Instance, name: string, val: any) { self.v[name] = val; }
  rva(self: Instance, name: string, i: number) {
    const v = i === 0 ? self.v[name] : self.v[`${name}@${Math.round(i)}`];
    return v === undefined ? this.undefinedVar(self, name) : v;
  }
  sva(self: Instance, name: string, i: number, val: any) {
    if (i === 0) self.v[name] = val;
    else self.v[`${name}@${Math.round(i)}`] = val;
  }

  /** El juego trata las variables sin inicializar como 0 (opción de Game Maker). */
  private undefinedVar(self: Instance, name: string) {
    const key = `${self.obj.name}.${name}`;
    if (!this.errors.has(key)) {
      this.errors.add(key);
      console.debug(`[GM] variable sin inicializar "${name}" en ${self.obj.name} (vale 0)`);
    }
    return 0;
  }

  // Variables globales.
  gv(name: string) {
    const v = this.globals[name];
    if (v === undefined) { this.report(new Error(`Variable global desconocida "${name}"`)); return 0; }
    return v;
  }
  gva(name: string, i: number) { return i === 0 ? this.gv(name) : this.globals[`${name}@${Math.round(i)}`] ?? 0; }
  sgva(name: string, i: number, val: any) {
    if (i === 0) this.globals[name] = val;
    else this.globals[`${name}@${Math.round(i)}`] = val;
  }

  /** Variables globales integradas (room, mouse_x, view_left...). */
  gb(name: string, i: number): any {
    const r = this.render;
    const view = this.views[Math.round(i)] ?? this.views[0];
    switch (name) {
      case 'room': return this.room;
      case 'room_width': return this.roomWidth;
      case 'room_height': return this.roomHeight;
      case 'room_speed': return this.roomSpeed;
      case 'room_caption': return this.roomCaption;
      case 'room_first': return this.data.roomOrder[0];
      case 'room_last': return this.data.roomOrder[this.data.roomOrder.length - 1];
      case 'mouse_x': return this.input.mouseX + this.views[0].left;
      case 'mouse_y': return this.input.mouseY + this.views[0].top;
      case 'mouse_button': return this.input.mouseButton();
      case 'keyboard_key': return this.input.lastKey;
      case 'keyboard_lastkey': return this.input.lastKey;
      case 'view_left': case 'view_xview': return view.left;
      case 'view_top': case 'view_yview': return view.top;
      case 'view_width': case 'view_wview': return view.width;
      case 'view_height': case 'view_hview': return view.height;
      case 'view_visible': return view.visible ? 1 : 0;
      case 'view_enabled': return 1;
      case 'view_current': return 0;
      case 'background_visible': return this.backgroundVisible[Math.round(i)] ? 1 : 0;
      case 'fps': return Math.round(this.fpsMeasured);
      case 'current_time': return Math.round(performance.now());
      case 'instance_count': return this.instances.filter((x) => x.active && !x.dead).length;
      case 'font_name': return r.font_name;
      case 'font_size': return r.font_size;
      case 'font_color': return r.font_color;
      case 'font_style': return r.font_style;
      case 'font_angle': return r.font_angle;
      case 'font_align': return r.font_align;
      case 'brush_color': return r.brush_color;
      case 'brush_style': return r.brush_style;
      case 'pen_color': return r.pen_color;
      case 'pen_size': return r.pen_size;
      case 'score': case 'lives': case 'health': return this.globals[`@${name}`] ?? 0;
    }
    return 0;
  }

  sgb(name: string, i: number, val: any) {
    const r = this.render;
    const n = Number(val);
    const view = this.views[Math.round(i)] ?? this.views[0];
    switch (name) {
      case 'room_speed': this.roomSpeed = Math.max(1, n); break;
      case 'room_caption': this.roomCaption = String(val); break;
      case 'view_left': case 'view_xview': view.left = n; break;
      case 'view_top': case 'view_yview': view.top = n; break;
      case 'view_width': case 'view_wview': view.width = n; break;
      case 'view_height': case 'view_hview': view.height = n; break;
      case 'view_visible': view.visible = n >= 0.5; break;
      case 'background_visible': this.backgroundVisible[Math.round(i)] = n >= 0.5; break;
      case 'font_name': r.font_name = String(val); break;
      case 'font_size': r.font_size = n; break;
      case 'font_color': r.font_color = n; break;
      case 'font_style': r.font_style = n; break;
      case 'font_angle': r.font_angle = n; break;
      case 'font_align': r.font_align = n; break;
      case 'brush_color': r.brush_color = n; break;
      case 'brush_style': r.brush_style = n; break;
      case 'pen_color': r.pen_color = n; break;
      case 'pen_size': r.pen_size = n; break;
      case 'score': case 'lives': case 'health': this.globals[`@${name}`] = n; break;
    }
  }

  // ---------- Instancias ----------

  instanceById(id: number) {
    const inst = this.byId.get(Math.round(id));
    return inst && !inst.dead && inst.active ? inst : null;
  }

  /** Instancias activas de un objeto y sus descendientes. */
  instancesOf(objIndex: number): Instance[] {
    const o = this.objectByIndex(objIndex);
    if (!o) return [];
    const out: Instance[] = [];
    for (const f of o.family) for (const i of f.instances) if (!i.dead && i.active) out.push(i);
    return out;
  }

  /** Resuelve self/other/all/objeto/id a una lista de instancias. */
  resolveTargets(self: Instance, other: Instance, target: number): Instance[] {
    target = Math.round(target);
    if (target === -1) return [self];
    if (target === -2) return [other];
    if (target === -3) return this.instances.filter((i) => i.active && !i.dead);
    if (target < 0) return [];
    if (target >= 100000) { const i = this.instanceById(target); return i ? [i] : []; }
    return this.instancesOf(target);
  }

  withDo(self: Instance, other: Instance, target: number, body: (self: Instance, other: Instance) => void) {
    for (const inst of this.resolveTargets(self, other, target)) {
      if (inst.dead) continue;
      body(inst, self);
    }
  }

  applyTo(self: Instance, other: Instance, target: number, body: (self: Instance, other: Instance) => void) {
    this.withDo(self, other, target, body);
  }

  applyQ(self: Instance, other: Instance, target: number, cond: (self: Instance, other: Instance) => boolean) {
    const list = this.resolveTargets(self, other, target);
    return list.length > 0 && list.every((i) => cond(i, self));
  }

  dotGet(self: Instance, other: Instance, target: number, name: string, i: number) {
    const t = Math.round(target);
    if (t === -5) return this.gva(name, i);
    const inst = this.resolveTargets(self, other, t)[0];
    if (!inst) {
      this.report(new Error(`No existe instancia para leer .${name} (objetivo ${t})`));
      return 0;
    }
    if (INSTANCE_BUILTINS.has(name)) return inst.ba(name, i);
    return this.rva(inst, name, i);
  }

  dotSet(self: Instance, other: Instance, target: number, name: string, i: number, f: (cur: any) => any) {
    const t = Math.round(target);
    if (t === -5) { this.sgva(name, i, f(this.globals[name] ?? 0)); return; }
    for (const inst of this.resolveTargets(self, other, t)) {
      if (INSTANCE_BUILTINS.has(name)) inst.sba(name, i, f(inst.ba(name, i)));
      else this.sva(inst, name, i, f(i === 0 ? inst.v[name] ?? 0 : inst.v[`${name}@${i}`] ?? 0));
    }
  }

  createInstance(x: number, y: number, objIndex: number, id?: number, runCreate = true): Instance | null {
    const obj = this.objectByIndex(objIndex);
    if (!obj) return null;
    const inst = new Instance(this, id ?? this.nextId++, obj);
    if (id !== undefined && id >= this.nextId) this.nextId = id + 1;
    inst.x = inst.xstart = inst.xprevious = x;
    inst.y = inst.ystart = inst.yprevious = y;
    inst.seq = this.seq++;
    this.instances.push(inst);
    this.byId.set(inst.id, inst);
    obj.instances.add(inst);
    if (runCreate) this.event(inst, EV.CREATE, 0);
    return inst;
  }

  destroyInstance(inst: Instance, runEvent = true) {
    if (inst.dead || this.destroying.has(inst)) return;
    if (runEvent) {
      this.destroying.add(inst);
      try { this.event(inst, EV.DESTROY, 0); } finally { this.destroying.delete(inst); }
      // Si el evento Destroy cambia la instancia de objeto, sigue viva (así la Master Ball
      // vuelve a aparecer cada vez que vende un Pokémon, hasta que se le hace clic derecho).
      if (this.revived.delete(inst)) return;
    }
    inst.dead = true;
    inst.obj.instances.delete(inst);
    this.byId.delete(inst.id);
  }

  changeInstance(inst: Instance, objIndex: number, perform: boolean) {
    const obj = this.objectByIndex(objIndex);
    if (!obj || inst.dead) return;
    if (this.destroying.has(inst)) this.revived.add(inst);
    if (perform) this.event(inst, EV.DESTROY, 0);
    inst.obj.instances.delete(inst);
    inst.applyObject(obj);
    obj.instances.add(inst);
    if (perform) this.event(inst, EV.CREATE, 0);
  }

  setActive(inst: Instance, active: boolean) { inst.active = active; }

  // ---------- Colisiones ----------

  /** ¿Cubre la máscara de la instancia el punto (px, py)? */
  containsPoint(inst: Instance, px: number, py: number) {
    const b = inst.bbox();
    if (!b) return false;
    if (px < b.l || px > b.r + 1 || py < b.t || py > b.b + 1) return false;
    const m = inst.maskData;
    if (!m?.precise) return true;
    return this.render.solidPixel(m, inst.frame(), Math.floor(px - inst.x + m.ox), Math.floor(py - inst.y + m.oy));
  }

  /**
   * Instancia bajo el punto de la vista (px, py) con eventos de botón del ratón, o null.
   * `accept` permite descartar algunas (las pantallas táctiles arrastran la vista si no hay ninguna).
   */
  mouseTargetAt(px: number, py: number, accept: (i: Instance) => boolean = () => true) {
    const x = px + this.views[0].left;
    const y = py + this.views[0].top;
    for (const i of this.instances) {
      if (i.dead || !i.active || this.uiOwned?.(i) || !this.containsPoint(i, x, y)) continue;
      if (MOUSE_BUTTON_EVENTS.some((n) => this.resolve(i.obj, `${EV.MOUSE}:${n}`)) && accept(i)) return i;
    }
    return null;
  }

  /** Colisión entre dos instancias (opcionalmente con `a` en otra posición). */
  overlaps(a: Instance, b: Instance, ax = a.x, ay = a.y): boolean {
    const ma = a.maskData;
    const mb = b.maskData;
    if (!ma || !mb) return false;
    const al = ax - ma.ox + ma.bbox[0], at = ay - ma.oy + ma.bbox[1], ar = ax - ma.ox + ma.bbox[2], ab = ay - ma.oy + ma.bbox[3];
    const bb = b.bbox()!;
    if (al > bb.r || ar < bb.l || at > bb.b || ab < bb.t) return false;
    if (!ma.precise && !mb.precise) return true;
    // Comprobación píxel a píxel en la zona común.
    const x0 = Math.floor(Math.max(al, bb.l)), x1 = Math.floor(Math.min(ar, bb.r));
    const y0 = Math.floor(Math.max(at, bb.t)), y1 = Math.floor(Math.min(ab, bb.b));
    const fa = a.frame(), fb = b.frame();
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const pa = !ma.precise || this.render.solidPixel(ma, fa, Math.floor(x - ax + ma.ox), Math.floor(y - ay + ma.oy));
        if (!pa) continue;
        const pb = !mb.precise || this.render.solidPixel(mb, fb, Math.floor(x - b.x + mb.ox), Math.floor(y - b.y + mb.oy));
        if (pb) return true;
      }
    }
    return false;
  }

  /** ¿Está libre la posición (sin instancias sólidas, o sin ninguna si `all`)? */
  placeFree(self: Instance, x: number, y: number, all = false) {
    for (const o of this.instances) {
      if (o === self || o.dead || !o.active || (!all && !o.solid)) continue;
      if (this.overlaps(self, o, x, y)) return false;
    }
    return true;
  }

  // ---------- Rooms ----------

  gotoRoom(index: number) { this.pendingRoom = Math.round(index); }
  restart() { this.pendingRestart = true; }
  requestLoad(key: string) { this.pendingLoad = key; }

  /** Borra todas las instancias sin ejecutar eventos (para cargar partida). */
  clearAll() {
    this.instances = [];
    this.byId.clear();
    for (const o of this.objects) o?.instances.clear();
  }

  /** Prepara el room (tamaño, vistas, fondos) sin crear sus instancias. */
  startRoomShell(index: number) {
    const room = this.data.rooms[index];
    if (!room) return null;
    this.room = index;
    this.roomData = room;
    this.roomWidth = room.width;
    this.roomHeight = room.height;
    this.roomSpeed = room.speed;
    this.roomCaption = room.caption;
    this.views = room.views.map((v) => ({ visible: v.visible, left: v.x, top: v.y, width: v.w, height: v.h }));
    if (!room.viewsEnabled || !this.views.some((v) => v.visible)) this.views[0] = { visible: true, left: 0, top: 0, width: room.width, height: room.height };
    const size = this.viewSizer?.(room);
    if (size) this.setViewSize(size.width, size.height);
    this.backgroundVisible = room.backgrounds.map((b) => b.visible);
    this.render.setRoom(room);
    return room;
  }

  startRoom(index: number, firstTime = false) {
    if (!this.data.rooms[index]) return;
    // Las instancias no persistentes desaparecen (sin evento destroy, como en GM).
    for (const inst of this.instances) {
      if (!inst.persistent) { inst.dead = true; inst.obj.instances.delete(inst); this.byId.delete(inst.id); }
    }
    this.instances = this.instances.filter((i) => !i.dead);
    const room = this.startRoomShell(index)!;

    const created: Instance[] = [];
    for (const ri of room.instances) {
      const objIndex = this.data.resources.objects.indexOf(ri.object ?? '');
      if (objIndex < 0) continue;
      const inst = this.createInstance(ri.x, ri.y, objIndex, ri.id);
      if (!inst) continue;
      created.push(inst);
      if (ri.code) {
        try {
          this.invoke(compileCode(ri.code, this.env, `código de instancia ${ri.id}`), inst, inst, [], null);
        } catch (e) { this.report(e); }
      }
    }
    if (room.creationCode) {
      try {
        const any = created[0] ?? this.instances[0];
        if (any) this.invoke(compileCode(room.creationCode, this.env, `código del room ${room.name}`), any, any, [], null);
      } catch (e) { this.report(e); }
    }
    for (const inst of [...this.instances]) {
      if (inst.dead || !inst.active) continue;
      if (firstTime) this.event(inst, EV.OTHER, 2);
      this.event(inst, EV.OTHER, 4);
    }
  }

  startGame() {
    this.clearAll();
    this.globals = Object.create(null);
    this.nextId = 100001;
    this.render.resetDrawState();
    this.audio.stopAll();
    this.startRoom(this.data.roomOrder[0], true);
  }

  // ---------- Step ----------

  step() {
    this.loopCount = 0;
    const live = () => this.instances.filter((i) => i.active && !i.dead);

    for (const i of live()) if (!i.dead) this.event(i, EV.STEP, 1);

    // Alarmas
    for (const i of live()) {
      for (let a = 0; a < 12; a++) {
        if (i.dead) break;
        if (i.alarm[a] > 0) {
          i.alarm[a]--;
          if (i.alarm[a] === 0) { i.alarm[a] = -1; this.event(i, EV.ALARM, a); }
        }
      }
    }

    // Teclado
    const pressed = this.input.takePressed();
    const released = this.input.takeReleased();
    for (const key of pressed) for (const i of live()) if (!i.dead) this.event(i, EV.KEYPRESS, key);
    for (const key of this.input.held()) for (const i of live()) if (!i.dead) this.event(i, EV.KEYBOARD, key);
    for (const key of released) for (const i of live()) if (!i.dead) this.event(i, EV.KEYRELEASE, key);

    // Ratón
    this.mouseEvents(live());

    for (const i of live()) if (!i.dead) this.event(i, EV.STEP, 0);

    // Movimiento
    for (const i of live()) {
      i.xprevious = i.x;
      i.yprevious = i.y;
      if (i.friction !== 0 && i.speed !== 0) {
        const s = i.speed > 0 ? Math.max(0, i.speed - i.friction) : Math.min(0, i.speed + i.friction);
        i.setMotion(i.direction, s);
      }
      if (i.gravity !== 0) {
        const r = (i.gravity_direction * Math.PI) / 180;
        i.hspeed += Math.cos(r) * i.gravity;
        i.vspeed -= Math.sin(r) * i.gravity;
        i.syncFromVector();
      }
      i.x += i.hspeed;
      i.y += i.vspeed;
    }

    // Fuera del room
    for (const i of live()) {
      if (i.dead || !this.hasEvent(i.obj, EV.OTHER, 0)) continue;
      const b = i.bbox();
      if (b && (b.r < 0 || b.l > this.roomWidth || b.b < 0 || b.t > this.roomHeight)) this.event(i, EV.OTHER, 0);
    }

    // Colisiones
    for (const i of live()) {
      for (const target of i.obj.collisionTargets) {
        if (i.dead) break;
        for (const o of this.instancesOf(target)) {
          if (o === i || o.dead || i.dead) continue;
          if (!this.overlaps(i, o)) continue;
          if (o.solid) { i.x = i.xprevious; i.y = i.yprevious; }
          this.event(i, EV.COLLISION, target, o);
        }
      }
    }

    for (const i of live()) if (!i.dead) this.event(i, EV.STEP, 2);

    // Animación
    for (const i of live()) {
      const s = i.spriteData;
      if (!s || !s.frames) continue;
      i.image_index += i.image_speed;
      if (i.image_index >= s.frames) {
        i.image_index -= s.frames;
        this.event(i, EV.OTHER, 7);
      }
    }

    this.instances = this.instances.filter((i) => !i.dead);
    this.clampView();
    this.input.endStep();

    if (this.pendingRestart) { this.pendingRestart = false; this.startGame(); }
    if (this.pendingRoom !== null) { const r = this.pendingRoom; this.pendingRoom = null; this.startRoom(r); }
    if (this.pendingLoad !== null) { const k = this.pendingLoad; this.pendingLoad = null; this.F.__load(k); }
  }

  private mouseEvents(list: Instance[]) {
    const inp = this.input;
    const mx = this.gb('mouse_x', 0);
    const my = this.gb('mouse_y', 0);
    const checks: [boolean, number][] = [
      [inp.down[0], 0], [inp.down[2], 1], [inp.down[1], 2],
      [!inp.down[0] && !inp.down[1] && !inp.down[2], 3],
      [inp.pressed[0], 4], [inp.pressed[2], 5], [inp.pressed[1], 6],
      [inp.released[0], 7], [inp.released[2], 8], [inp.released[1], 9],
    ];
    for (const i of list) {
      if (i.dead) continue;
      const over = !this.uiOwned?.(i) && this.containsPoint(i, mx, my);
      if (over) {
        for (const [on, num] of checks) if (on && !i.dead) this.event(i, EV.MOUSE, num);
      }
      const wasOver = !!i.v['@mouseover'];
      if (over !== wasOver) {
        i.v['@mouseover'] = over;
        this.event(i, EV.MOUSE, over ? 10 : 11);
      }
      // Eventos globales
      for (const [on, num] of checks) if (on && num !== 3 && !i.dead) this.event(i, EV.MOUSE, 50 + num - (num >= 4 ? 1 : 0));
    }
  }

  // ---------- Dibujo ----------

  draw() {
    this.render.beginFrame(this);
    const list = this.instances.filter((i) => i.active && !i.dead && !this.uiOwned?.(i));
    this.render.drawScene(this, list);
  }

  drawInstance(i: Instance) {
    if (!i.visible) return;
    i.drawnFrame = null;
    if (!this.event(i, EV.DRAW, 0)) {
      i.drawnFrame = i.frame();
      this.render.drawSprite(i.sprite_index, i.drawnFrame, i.x, i.y);
    }
  }
}
