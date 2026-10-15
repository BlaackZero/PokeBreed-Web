// Extrae el Pokebreed Ultimate clásico (Game Maker 5.3, pokebreed_ultimate.gmd)
// a recursos web: sprites/fondos en PNG, sonidos, y un JSON con objetos, scripts y rooms.
//
// Uso: node tools/gmd/extract.mjs <pokebreed_ultimate.gmd> [--dump <carpeta>]
//   --dump escribe además una versión legible del código (un .txt por objeto).
import fs from 'node:fs';
import path from 'node:path';
import { parseGmd } from './parse.mjs';
import { applyColorKey, decodeBmp, encodePng } from './image.mjs';
import { Reader } from './reader.mjs';

const [, , input, ...rest] = process.argv;
if (!input) {
  console.error('Uso: node tools/gmd/extract.mjs <pokebreed_ultimate.gmd> [--dump <carpeta>]');
  process.exit(1);
}
const dumpDir = rest[0] === '--dump' ? rest[1] : null;

const buf = fs.readFileSync(input);
const gmd = parseGmd(buf, (m) => console.log(m));

const OUT = path.resolve('public/classic');
fs.rmSync(OUT, { recursive: true, force: true });
for (const d of ['sprites', 'backgrounds', 'sounds']) fs.mkdirSync(path.join(OUT, d), { recursive: true });

const nameOf = (list, id) => (id >= 0 && list[id] ? list[id].name : null);
/** Algunos nombres del proyecto llevan '/', que no vale para un archivo. */
const safe = (name) => name.replace(/[\/:*?"<>|]/g, '_');

// ---------- Sprites ----------
const sprites = {};
for (const s of gmd.sprites) {
  if (!s) continue;
  let frames = 0;
  s.frames.forEach((bmp, i) => {
    if (!bmp) return;
    const img = decodeBmp(bmp);
    if (s.transparent) applyColorKey(img);
    fs.writeFileSync(path.join(OUT, 'sprites', `${safe(s.name)}_${i}.png`), encodePng(img));
    frames = i + 1;
  });
  sprites[s.name] = {
    file: safe(s.name),
    id: s.id, w: s.width, h: s.height, ox: s.originX, oy: s.originY, frames,
    bbox: [s.bbox.left, s.bbox.top, s.bbox.right, s.bbox.bottom], precise: s.precise,
  };
}

// ---------- Fondos ----------
const backgrounds = {};
for (const b of gmd.backgrounds) {
  if (!b) continue;
  if (b.image) {
    const img = decodeBmp(b.image);
    if (b.transparent) applyColorKey(img);
    fs.writeFileSync(path.join(OUT, 'backgrounds', `${safe(b.name)}.png`), encodePng(img));
  }
  backgrounds[b.name] = { id: b.id, w: b.width, h: b.height, hasImage: !!b.image };
}

// ---------- Sonidos ----------
const sounds = {};
for (const s of gmd.sounds) {
  if (!s) continue;
  let file = null;
  if (s.data) {
    file = `${safe(s.name)}${s.fileType.toLowerCase()}`;
    fs.writeFileSync(path.join(OUT, 'sounds', file), s.data);
  }
  sounds[s.name] = { id: s.id, kind: s.kind, file };
}

// ---------- Objetos, scripts y rooms ----------
const objects = gmd.objects.map((o) => o && {
  id: o.id,
  name: o.name,
  sprite: nameOf(gmd.sprites, o.sprite),
  solid: o.solid,
  visible: o.visible,
  depth: o.depth,
  persistent: o.persistent,
  parent: nameOf(gmd.objects, o.parent),
  mask: nameOf(gmd.sprites, o.mask),
  events: o.events.map((e) => ({
    type: e.type,
    num: e.num,
    other: e.type === 4 ? nameOf(gmd.objects, e.num) : undefined,
    actions: e.actions.map((a) => ({
      lib: a.lib, id: a.id, kind: a.kind, question: a.question, execType: a.execType,
      fn: a.fn || undefined, code: a.code || undefined, argKinds: a.argKinds, args: a.args,
      appliesTo: a.appliesTo, relative: a.relative || undefined, not: a.not || undefined,
    })),
  })),
});

const scripts = gmd.scripts.filter(Boolean).map((s) => ({ id: s.id, name: s.name, code: s.code }));
const rooms = gmd.rooms.filter(Boolean).map((r) => ({
  ...r,
  backgrounds: r.backgrounds.map((b) => ({ ...b, background: nameOf(gmd.backgrounds, b.background) })),
  views: r.views,
  instances: r.instances.map((i) => ({ ...i, object: nameOf(gmd.objects, i.object) })),
  tiles: r.tiles.map((t) => ({ ...t, background: nameOf(gmd.backgrounds, t.background) })),
}));

// Información del juego (texto de ayuda en RTF) tras los rooms.
const tail = new Reader(buf);
tail.p = gmd.restAt;
const lastInstanceId = tail.int();
const lastTileId = tail.int();
tail.expect(430, 'versión de información del juego');
const helpColor = tail.int();
tail.int();
const helpRtf = tail.str();

// Orden de los rooms según el árbol de recursos (el primero es el que arranca el juego).
// Cada entrada del árbol es: estado, tipo (4 = room), índice, nombre, nº de hijos.
const roomOrder = [];
for (let p = tail.p; p < buf.length - 12; p++) {
  if (buf.readInt32LE(p) !== 4) continue;
  const index = buf.readInt32LE(p + 4);
  const len = buf.readInt32LE(p + 8);
  const name = gmd.rooms[index]?.name;
  if (!name || len !== name.length || buf.toString('latin1', p + 12, p + 12 + len) !== name) continue;
  if (!roomOrder.includes(index)) roomOrder.push(index);
}
for (const r of gmd.rooms) if (r && !roomOrder.includes(r.id)) roomOrder.push(r.id);

const game = {
  source: path.basename(input),
  resources: {
    sprites: gmd.sprites.map((s) => s?.name ?? null),
    sounds: gmd.sounds.map((s) => s?.name ?? null),
    backgrounds: gmd.backgrounds.map((b) => b?.name ?? null),
    scripts: gmd.scripts.map((s) => s?.name ?? null),
    objects: gmd.objects.map((o) => o?.name ?? null),
    rooms: gmd.rooms.map((r) => r?.name ?? null),
  },
  sprites, backgrounds, sounds, objects, scripts, rooms,
  roomOrder, lastInstanceId, lastTileId, helpColor, helpRtf,
};
fs.writeFileSync(path.join(OUT, 'game.json'), JSON.stringify(game));
console.log(`Escrito ${path.join(OUT, 'game.json')}`);

// ---------- Volcado legible ----------
if (dumpDir) {
  const EVENT = ['Create', 'Destroy', 'Alarm', 'Step', 'Collision', 'Keyboard', 'Mouse', 'Other', 'Draw', 'KeyPress', 'KeyRelease'];
  const fmtAction = (a) => {
    const args = a.args.map((v, i) => (a.argKinds[i] === 1 ? JSON.stringify(v) : v));
    const who = a.appliesTo === -1 ? '' : a.appliesTo === -2 ? '[other] ' : `[${nameOf(gmd.objects, a.appliesTo) ?? a.appliesTo}] `;
    const pre = `${who}${a.not ? 'NOT ' : ''}${a.relative ? 'REL ' : ''}`;
    if (a.kind === 7 && a.execType === 2) return `${pre}CODE {\n${(a.args[0] ?? '').replace(/^/gm, '    ')}\n}`;
    if (a.kind === 1) return '{';
    if (a.kind === 2) return '}';
    if (a.kind === 3) return 'ELSE';
    if (a.kind === 4) return 'EXIT';
    if (a.kind === 5) return `REPEAT ${args[0]}`;
    if (a.kind === 6) return `VAR ${args.join(', ')}`;
    if (a.kind === 0 && !a.fn && !a.code) return `// ${a.args.join(' ')}`;
    return `${pre}${a.fn || `lib${a.lib}#${a.id}`}(${args.join(', ')})${a.question ? ' ?' : ''}`;
  };
  fs.rmSync(dumpDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dumpDir, 'objects'), { recursive: true });
  fs.mkdirSync(path.join(dumpDir, 'scripts'), { recursive: true });
  for (const o of gmd.objects) {
    if (!o) continue;
    let txt = `OBJECT ${o.name} (#${o.id}) sprite=${nameOf(gmd.sprites, o.sprite)} parent=${nameOf(gmd.objects, o.parent)} solid=${o.solid} visible=${o.visible} depth=${o.depth} persistent=${o.persistent}\n`;
    for (const e of o.events) {
      const label = e.type === 4 ? nameOf(gmd.objects, e.num) : e.num;
      txt += `\n== ${EVENT[e.type] ?? e.type} ${label}\n`;
      let indent = 0;
      for (const a of e.actions) {
        if (a.kind === 2) indent = Math.max(0, indent - 1);
        txt += fmtAction(a).replace(/^/gm, '  '.repeat(indent + 1)) + '\n';
        if (a.kind === 1) indent++;
      }
    }
    fs.writeFileSync(path.join(dumpDir, 'objects', `${safe(o.name)}.txt`), txt);
  }
  for (const s of gmd.scripts) if (s) fs.writeFileSync(path.join(dumpDir, 'scripts', `${safe(s.name)}.gml`), s.code);
  for (const r of rooms) {
    const counts = {};
    for (const i of r.instances) counts[i.object] = (counts[i.object] ?? 0) + 1;
    fs.writeFileSync(path.join(dumpDir, `room_${r.name}.txt`),
      `${r.name} ${r.width}x${r.height} speed=${r.speed} color=${r.color}\ncreation:\n${r.creationCode}\nviews: ${JSON.stringify(r.views.filter((v) => v.visible))}\nbackgrounds: ${JSON.stringify(r.backgrounds.filter((b) => b.visible))}\n\n` +
      Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v}\t${k}`).join('\n') +
      '\n\nINSTANCES\n' + r.instances.map((i) => `${i.object} ${i.x},${i.y}${i.code ? ` code: ${i.code.replace(/\s+/g, ' ')}` : ''}`).join('\n'));
  }
  fs.writeFileSync(path.join(dumpDir, 'help.rtf'), helpRtf);
  console.log(`Volcado legible en ${dumpDir}`);
}
