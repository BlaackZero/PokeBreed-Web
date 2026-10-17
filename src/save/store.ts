// Partida única con autoguardado: siempre en este dispositivo (localStorage) y, con sesión
// iniciada, también en la nube de Core Utils. Gana la partida guardada más tarde.
import { listSaves, SAVE_PREFIX, snapshot } from '../gm/functions';
import type { Runtime } from '../gm/runtime';
import { AUTOSAVE } from '../ui/dom';
import * as cloud from './cloud';

const SLOT = SAVE_PREFIX + AUTOSAVE;
/** Usuario con el que ya se sincronizó este dispositivo (a partir de ahí, gana la más reciente sin preguntar). */
const SYNCED_USER = 'pokebreed-classic:cloud-user';
const SAVE_VERSION = 1;
/** Tiempo mínimo entre subidas a la nube durante la partida. */
const CLOUD_EVERY_MS = 20_000;

export type SaveStatus = 'idle' | 'saved' | 'syncing' | 'synced' | 'offline' | 'conflict';

export interface SaveSummary { savedAt: number; money: number }

/** Pregunta qué partida conservar cuando hay una distinta aquí y en la nube. true = la de la nube. */
export type ChooseCloud = (local: SaveSummary, remote: SaveSummary) => boolean;

function summary(json: string | null): SaveSummary | null {
  if (!json) return null;
  try {
    const d = JSON.parse(json);
    return { savedAt: Number(d.savedAt) || 0, money: Number(d.globals?.money) || 0 };
  } catch {
    return null;
  }
}

export class SaveStore {
  user: cloud.CloudUser | null = null;
  status: SaveStatus = 'idle';
  private listeners = new Set<() => void>();
  private lastPush = 0;
  private pushTimer = 0;
  private pushing: Promise<void> | null = null;
  private dirty = false;
  /** Hay una partida en marcha: la sincronización ya no puede reemplazar la de este dispositivo. */
  playing = false;

  constructor() { this.migrateNamedSaves(); }

  onChange(fn: () => void) { this.listeners.add(fn); }
  private set(status: SaveStatus) { this.status = status; this.listeners.forEach((fn) => fn()); }

  /** La partida de este dispositivo (fecha y dinero), o null si no hay. */
  local(): SaveSummary | null { return summary(localStorage.getItem(SLOT)); }

  /** Clave que entiende rt.requestLoad. */
  readonly slotName = AUTOSAVE;

  /** Antes había partidas con nombre: si no hay autoguardado, se continúa la más reciente. */
  private migrateNamedSaves() {
    if (localStorage.getItem(SLOT) !== null) return;
    const newest = listSaves()[0];
    const raw = newest && localStorage.getItem(SAVE_PREFIX + newest.name);
    if (raw) localStorage.setItem(SLOT, raw);
  }

  /** Guarda ya en el dispositivo y programa la subida a la nube. */
  save(rt: Runtime, flush = false) {
    try {
      localStorage.setItem(SLOT, JSON.stringify(snapshot(rt)));
    } catch (e) {
      console.error('No se pudo guardar', e);
      return;
    }
    this.dirty = true;
    if (!this.user) { this.set('saved'); return; }
    const wait = flush ? 0 : Math.max(0, CLOUD_EVERY_MS - (performance.now() - this.lastPush));
    clearTimeout(this.pushTimer);
    if (wait === 0) void this.push(flush);
    else { this.pushTimer = window.setTimeout(() => void this.push(), wait); if (this.status !== 'syncing') this.set('saved'); }
  }

  /** Borra la partida (al empezar una nueva). La nube se reemplaza en el siguiente guardado. */
  clear() { localStorage.removeItem(SLOT); }

  private async push(closing = false) {
    if (!this.user || !this.dirty) return;
    if (this.pushing) { await this.pushing; if (!this.dirty) return; }
    const raw = localStorage.getItem(SLOT);
    const info = summary(raw);
    if (!raw || !info) return;
    this.dirty = false;
    this.lastPush = performance.now();
    this.set('syncing');
    this.pushing = (async () => {
      try {
        const res = await cloud.putCloudSave({ data: await cloud.compress(raw), version: SAVE_VERSION, savedAt: info.savedAt }, closing);
        this.set(res.accepted ? 'synced' : 'conflict');
      } catch (e) {
        if (e instanceof cloud.AuthError) { this.user = null; this.set('saved'); return; }
        console.warn('No se pudo subir la partida', e);
        this.dirty = true;
        this.set('offline');
      } finally {
        this.pushing = null;
      }
    })();
    await this.pushing;
  }

  // ---------- Cuenta ----------

  /** Comprueba la sesión y deja en este dispositivo la partida más reciente. */
  async connect(choose: ChooseCloud) {
    if (!cloud.cloudEnabled) return;
    try {
      this.user = await cloud.fetchUser();
    } catch (e) {
      console.warn('No se pudo comprobar la sesión', e);
      this.set('offline');
      return;
    }
    if (!this.user) { this.set('idle'); return; }
    await this.sync(choose);
  }

  private async sync(choose: ChooseCloud) {
    if (!this.user) return;
    this.set('syncing');
    try {
      const remote = await cloud.getCloudSave();
      const local = this.local();
      const known = localStorage.getItem(SYNCED_USER) === this.user.id;
      let useCloud = !!remote && (!local || remote.savedAt > local.savedAt);
      // Primera vez con esta cuenta en este dispositivo y hay dos partidas distintas: se pregunta.
      if (remote && local && !known && remote.savedAt !== local.savedAt) {
        const json = await cloud.decompress(remote.data);
        useCloud = choose(local, summary(json) ?? { savedAt: remote.savedAt, money: 0 });
      }
      if (remote && useCloud && this.playing) {
        // Llegó tarde: no se toca la partida en curso. Gana la que se guarde después.
        this.set('conflict');
        return;
      }
      if (remote && useCloud) {
        localStorage.setItem(SLOT, await cloud.decompress(remote.data));
        this.dirty = false;
      } else if (local && (!remote || local.savedAt !== remote.savedAt)) {
        this.dirty = true;
        await this.push();
      }
      localStorage.setItem(SYNCED_USER, this.user.id);
      if (this.status === 'syncing') this.set('synced');
    } catch (e) {
      if (e instanceof cloud.AuthError) { this.user = null; this.set('idle'); return; }
      console.warn('No se pudo sincronizar la partida', e);
      this.set('offline');
    }
  }

  async logout() {
    await this.push(true);
    try { await cloud.logout(); } catch { /* sin conexión: la cookie caduca sola */ }
    this.user = null;
    localStorage.removeItem(SYNCED_USER);
    this.set('idle');
  }
}
