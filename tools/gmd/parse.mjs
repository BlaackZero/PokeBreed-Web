// Parser de proyectos Game Maker 5.3 (.gmd). Formato deducido del propio archivo
// y de la estructura que usa LateralGM para la versión 530.
import { Reader } from './reader.mjs';

function list(r, sectionVer, what, readItem) {
  r.expect(sectionVer, `versión de sección ${what}`);
  const n = r.int();
  const out = [];
  for (let id = 0; id < n; id++) {
    if (!r.bool()) { out.push(null); continue; }
    const name = r.str();
    try {
      out.push({ id, name, ...readItem(r, name) });
    } catch (e) {
      e.message = `${what} #${id} "${name}": ${e.message}`;
      throw e;
    }
  }
  return out;
}

function sounds(r) {
  return list(r, 400, 'sonidos', (r) => {
    r.expect(440, 'versión de sonido');
    const kind = r.int();
    const fileType = r.str();
    const data = kind !== -1 ? r.zblock() : null;
    const a = r.int();
    const b = r.int();
    const preload = r.bool();
    return { kind, fileType, data, extra: [a, b], preload };
  });
}

function sprites(r) {
  return list(r, 400, 'sprites', (r) => {
    r.expect(400, 'versión de sprite');
    const width = r.int();
    const height = r.int();
    const bbox = { left: r.int(), right: r.int(), bottom: r.int(), top: r.int() };
    const transparent = r.bool();
    const bboxMode = r.int();
    const precise = r.bool();
    const videoMem = r.bool();
    const loadOnUse = r.bool();
    const originX = r.int();
    const originY = r.int();
    const n = r.int();
    const frames = [];
    for (let i = 0; i < n; i++) frames.push(r.int() === -1 ? null : r.zblock());
    return { width, height, bbox, transparent, bboxMode, precise, videoMem, loadOnUse, originX, originY, frames };
  });
}

function backgrounds(r) {
  return list(r, 400, 'fondos', (r) => {
    r.expect(400, 'versión de fondo');
    const width = r.int();
    const height = r.int();
    const transparent = r.bool();
    const videoMem = r.bool();
    const loadOnUse = r.bool();
    const has = r.bool();
    let image = null;
    if (has) image = r.int() === -1 ? null : r.zblock();
    return { width, height, transparent, videoMem, loadOnUse, image };
  });
}

function paths(r) {
  return list(r, 420, 'paths', (r) => {
    r.expect(530, 'versión de path');
    const smooth = r.bool();
    const closed = r.bool();
    const precision = r.int();
    const room = r.int();
    const snapX = r.int();
    const snapY = r.int();
    const n = r.int();
    const points = [];
    for (let i = 0; i < n; i++) points.push({ x: r.double(), y: r.double(), speed: r.double() });
    return { smooth, closed, precision, room, snapX, snapY, points };
  });
}

function scripts(r) {
  return list(r, 400, 'scripts', (r) => {
    r.expect(400, 'versión de script');
    return { code: r.str() };
  });
}

export function actions(r) {
  r.expect(400, 'versión de acciones');
  const n = r.int();
  const out = [];
  for (let i = 0; i < n; i++) {
    r.expect(440, 'versión de acción');
    const lib = r.int();
    const id = r.int();
    const kind = r.int();
    const allowRelative = r.bool();
    const question = r.bool();
    const canApplyTo = r.bool();
    const execType = r.int();
    const fn = r.str();
    const code = r.str();
    const argCount = r.int();
    const kindsLen = r.int();
    const argKinds = [];
    for (let k = 0; k < kindsLen; k++) argKinds.push(r.int());
    const appliesTo = r.int();
    const relative = r.bool();
    const argsLen = r.int();
    const args = [];
    for (let k = 0; k < argsLen; k++) args.push(r.str());
    const not = r.bool();
    out.push({
      lib, id, kind, allowRelative, question, canApplyTo, execType, fn, code,
      argKinds: argKinds.slice(0, argCount), appliesTo, relative, args: args.slice(0, argCount), not,
    });
  }
  return out;
}

/** Archivos de datos de GM5 (este proyecto no tiene ninguno; solo se valida la sección). */
function dataFiles(r) {
  return list(r, 440, 'archivos de datos', () => { throw new Error('formato de archivo de datos no soportado'); });
}

function timelines(r) {
  return list(r, 500, 'timelines', (r) => {
    r.expect(500, 'versión de timeline');
    const n = r.int();
    const moments = [];
    for (let i = 0; i < n; i++) moments.push({ step: r.int(), actions: actions(r) });
    return { moments };
  });
}

function objects(r) {
  return list(r, 400, 'objetos', (r) => {
    r.expect(430, 'versión de objeto');
    const sprite = r.int();
    const solid = r.bool();
    const visible = r.bool();
    const depth = r.int();
    const persistent = r.bool();
    const parent = r.int();
    const mask = r.int();
    const lastEventType = r.int();
    const events = [];
    for (let type = 0; type <= lastEventType; type++) {
      for (;;) {
        const num = r.int();
        if (num === -1) break;
        events.push({ type, num, actions: actions(r) });
      }
    }
    return { sprite, solid, visible, depth, persistent, parent, mask, events };
  });
}

function rooms(r) {
  return list(r, 420, 'rooms', (r) => {
    r.expect(520, 'versión de room');
    const caption = r.str();
    const width = r.int();
    const height = r.int();
    const snapX = r.int();
    const snapY = r.int();
    const isometric = r.bool();
    const speed = r.int();
    const persistent = r.bool();
    const color = r.int();
    const drawColor = r.bool();
    const creationCode = r.str();
    const bgN = r.int();
    const backgrounds = [];
    for (let i = 0; i < bgN; i++) {
      backgrounds.push({
        visible: r.bool(), foreground: r.bool(), background: r.int(), x: r.int(), y: r.int(),
        tileH: r.bool(), tileV: r.bool(), hspeed: r.int(), vspeed: r.int(), stretch: r.bool(),
      });
    }
    const viewsEnabled = r.bool();
    const vN = r.int();
    const views = [];
    for (let i = 0; i < vN; i++) {
      views.push({
        visible: r.bool(), x: r.int(), y: r.int(), w: r.int(), h: r.int(), portX: r.int(), portY: r.int(),
        hborder: r.int(), vborder: r.int(), hspeed: r.int(), vspeed: r.int(), follow: r.int(),
      });
    }
    const iN = r.int();
    const instances = [];
    for (let i = 0; i < iN; i++) instances.push({ x: r.int(), y: r.int(), object: r.int(), id: r.int(), code: r.str(), locked: r.bool() });
    const tN = r.int();
    const tiles = [];
    for (let i = 0; i < tN; i++) {
      tiles.push({ x: r.int(), y: r.int(), background: r.int(), tx: r.int(), ty: r.int(), w: r.int(), h: r.int(), depth: r.int(), id: r.int(), locked: r.bool() });
    }
    // Ajustes del editor de rooms (tamaño de ventana, rejilla, pestañas...): no afectan al juego.
    r.p += 20 * 4;
    return { caption, width, height, snapX, snapY, isometric, speed, persistent, color, drawColor, creationCode, backgrounds, viewsEnabled, views, instances, tiles };
  });
}

/** Busca el inicio de la sección de sonidos saltando la configuración del juego. */
function findSounds(buf) {
  for (let p = 0x20; p < Math.min(buf.length, 2_000_000); p++) {
    if (buf.readInt32LE(p) !== 400) continue;
    const r = new Reader(buf);
    r.p = p;
    try {
      sounds(r);
      if (buf.readInt32LE(r.p) === 400) return p;
    } catch {
      // No era el inicio: sigue buscando.
    }
  }
  throw new Error('No se encontró la sección de sonidos');
}

export const SECTIONS = { sounds, sprites, backgrounds, paths, scripts, dataFiles, timelines, objects, rooms };

export function parseGmd(buf, log = () => {}, only = Object.keys(SECTIONS)) {
  const r = new Reader(buf);
  r.expect(1234321, 'firma');
  const version = r.expect(530, 'versión');
  r.p = findSounds(buf);
  const out = { version, settingsEnd: r.p };
  for (const key of only) {
    const at = r.p;
    out[key] = SECTIONS[key](r);
    log(`${key}: ${out[key].filter(Boolean).length} de ${out[key].length} (offset ${at}-${r.p})`);
  }
  out.restAt = r.p;
  return out;
}
