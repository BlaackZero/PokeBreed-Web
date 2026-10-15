// Sonido: WAV con Web Audio y música MIDI con un sintetizador sencillo
// (los navegadores no reproducen MIDI por sí solos).
import type { GameData } from './types';

interface Note { t: number; dur: number; ch: number; key: number; vel: number; program: number }
interface Song { notes: Note[]; length: number }

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private wav = new Map<number, AudioBuffer>();
  private midi = new Map<number, Song>();
  private raw = new Map<number, ArrayBuffer>();
  private playing = new Map<number, { stop: () => void }>();
  private music: { id: number; stop: () => void } | null = null;
  muted = false;

  constructor(private data: GameData, private base: string) {}

  async load() {
    await Promise.all(Object.values(this.data.sounds).map(async (s) => {
      if (!s.file) return;
      const res = await fetch(`${this.base}sounds/${s.file}`);
      const buf = await res.arrayBuffer();
      if (s.file.endsWith('.mid')) this.midi.set(s.id, parseMidi(buf));
      else this.raw.set(s.id, buf);
    }));
  }

  /** Los navegadores solo permiten sonar tras una interacción del usuario. */
  unlock() {
    if (this.ctx) { void this.ctx.resume(); return; }
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(this.ctx.destination);
    for (const [id, buf] of this.raw) {
      this.ctx.decodeAudioData(buf.slice(0)).then((b) => this.wav.set(id, b)).catch(() => {});
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.8;
  }

  play(id: number, loop: boolean) {
    id = Math.round(id);
    if (!this.ctx || !this.master) return;
    if (this.midi.has(id)) { this.playMidi(id, loop); return; }
    const buf = this.wav.get(id);
    if (!buf) return;
    this.stop(id);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    src.connect(this.master);
    src.start();
    const entry = { stop: () => { try { src.stop(); } catch { /* ya parado */ } } };
    this.playing.set(id, entry);
    src.onended = () => { if (this.playing.get(id) === entry) this.playing.delete(id); };
  }

  stop(id: number) {
    id = Math.round(id);
    this.playing.get(id)?.stop();
    this.playing.delete(id);
    if (this.music?.id === id) { this.music.stop(); this.music = null; }
  }

  stopAll() {
    for (const p of this.playing.values()) p.stop();
    this.playing.clear();
    this.music?.stop();
    this.music = null;
  }

  isPlaying(id: number) { return this.playing.has(Math.round(id)) || this.music?.id === Math.round(id); }

  // ---------- MIDI ----------

  private playMidi(id: number, loop: boolean) {
    const song = this.midi.get(id)!;
    const ctx = this.ctx!;
    // Como en GM, solo suena una música a la vez.
    this.music?.stop();
    const out = ctx.createGain();
    out.gain.value = 0.25;
    out.connect(this.master!);
    let start = ctx.currentTime + 0.05;
    let next = 0;
    let stopped = false;
    const nodes = new Set<AudioScheduledSourceNode>();
    const schedule = () => {
      if (stopped) return;
      const horizon = ctx.currentTime + 1.5;
      while (next < song.notes.length && start + song.notes[next].t < horizon) {
        const n = song.notes[next++];
        this.voice(out, n, start + n.t, nodes);
      }
      if (next >= song.notes.length) {
        if (!loop) {
          if (ctx.currentTime > start + song.length) { this.music = null; return; }
        } else {
          start += song.length;
          next = 0;
        }
      }
      timer = window.setTimeout(schedule, 250);
    };
    let timer = 0;
    schedule();
    this.music = {
      id,
      stop: () => {
        stopped = true;
        clearTimeout(timer);
        for (const n of nodes) { try { n.stop(); } catch { /* ya parado */ } }
        out.disconnect();
      },
    };
  }

  private voice(out: GainNode, n: Note, when: number, nodes: Set<AudioScheduledSourceNode>) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.connect(out);
    const vol = (n.vel / 127) * 0.6;
    if (n.ch === 9) {
      // Percusión: ráfaga de ruido.
      const len = 0.12;
      const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = ctx.createBufferSource();
      src.buffer = b;
      const f = ctx.createBiquadFilter();
      f.type = n.key < 40 ? 'lowpass' : 'highpass';
      f.frequency.value = n.key < 40 ? 200 : 4000;
      src.connect(f).connect(g);
      g.gain.value = vol * 0.8;
      src.start(when);
      nodes.add(src);
      src.onended = () => { nodes.delete(src); g.disconnect(); };
      return;
    }
    const osc = ctx.createOscillator();
    osc.type = waveFor(n.program);
    osc.frequency.value = 440 * 2 ** ((n.key - 69) / 12);
    osc.connect(g);
    const dur = Math.max(0.05, n.dur);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.01);
    g.gain.setTargetAtTime(vol * 0.6, when + 0.05, 0.1);
    g.gain.setTargetAtTime(0, when + dur, 0.05);
    osc.start(when);
    osc.stop(when + dur + 0.3);
    nodes.add(osc);
    osc.onended = () => { nodes.delete(osc); g.disconnect(); };
  }
}

/** Timbre aproximado según el instrumento General MIDI. */
function waveFor(program: number): OscillatorType {
  if (program < 8) return 'triangle'; // pianos
  if (program < 16) return 'sine'; // percusión cromática
  if (program < 24) return 'square'; // órganos
  if (program < 40) return 'triangle'; // guitarras y bajos
  if (program < 56) return 'sawtooth'; // cuerdas
  if (program < 80) return 'square'; // metales y vientos
  return 'sawtooth';
}

/** Lee un archivo MIDI (formatos 0 y 1) y lo convierte en notas con tiempos en segundos. */
export function parseMidi(buf: ArrayBuffer): Song {
  const d = new DataView(buf);
  let p = 0;
  const str = (n: number) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(d.getUint8(p + i)); p += n; return s; };
  const u32 = () => { const v = d.getUint32(p); p += 4; return v; };
  const u16 = () => { const v = d.getUint16(p); p += 2; return v; };
  const vlq = () => { let v = 0; let b; do { b = d.getUint8(p++); v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };

  if (str(4) !== 'MThd') return { notes: [], length: 0 };
  const hlen = u32();
  u16();
  const ntracks = u16();
  const division = u16();
  p = 8 + hlen;

  type Ev = { tick: number; kind: 'on' | 'off' | 'tempo' | 'prog'; ch: number; a: number; b: number };
  const events: Ev[] = [];
  for (let t = 0; t < ntracks && p < d.byteLength; t++) {
    if (str(4) !== 'MTrk') break;
    const len = u32();
    const end = p + len;
    let tick = 0;
    let status = 0;
    while (p < end) {
      tick += vlq();
      let s = d.getUint8(p);
      if (s & 0x80) p++; else s = status;
      if (s === 0xff) {
        const type = d.getUint8(p++);
        const l = vlq();
        if (type === 0x51) events.push({ tick, kind: 'tempo', ch: 0, a: (d.getUint8(p) << 16) | (d.getUint8(p + 1) << 8) | d.getUint8(p + 2), b: 0 });
        p += l;
        continue;
      }
      if (s === 0xf0 || s === 0xf7) { p += vlq(); continue; }
      status = s;
      const ch = s & 15;
      const hi = s & 0xf0;
      if (hi === 0xc0 || hi === 0xd0) {
        const a = d.getUint8(p++);
        if (hi === 0xc0) events.push({ tick, kind: 'prog', ch, a, b: 0 });
        continue;
      }
      const a = d.getUint8(p++);
      const b = d.getUint8(p++);
      if (hi === 0x90 && b > 0) events.push({ tick, kind: 'on', ch, a, b });
      else if (hi === 0x80 || (hi === 0x90 && b === 0)) events.push({ tick, kind: 'off', ch, a, b });
    }
    p = end;
  }
  events.sort((x, y) => x.tick - y.tick || (x.kind === 'tempo' ? -1 : 0));

  let usPerBeat = 500000;
  let lastTick = 0;
  let time = 0;
  const program = new Array(16).fill(0);
  const open = new Map<string, Note>();
  const notes: Note[] = [];
  for (const e of events) {
    time += ((e.tick - lastTick) * usPerBeat) / division / 1e6;
    lastTick = e.tick;
    if (e.kind === 'tempo') usPerBeat = e.a;
    else if (e.kind === 'prog') program[e.ch] = e.a;
    else if (e.kind === 'on') {
      const n: Note = { t: time, dur: 0.3, ch: e.ch, key: e.a, vel: e.b, program: program[e.ch] };
      open.set(`${e.ch}:${e.a}`, n);
      notes.push(n);
    } else {
      const n = open.get(`${e.ch}:${e.a}`);
      if (n) { n.dur = time - n.t; open.delete(`${e.ch}:${e.a}`); }
    }
  }
  return { notes, length: time };
}
