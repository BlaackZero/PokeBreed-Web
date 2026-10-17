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
/** Reintentos tras un fallo de la nube (se queda en el último). */
const RETRY_MS = [3_000, 10_000, 20_000, 45_000];
/** Hasta pasado este tiempo sin poder subir, no se avisa al jugador (los cortes breves se arreglan solos). */
export const CLOUD_LATE_MS = 60_000;

/**
 * Estado del guardado:
 * - local: sin cuenta, la partida está solo en este dispositivo.
 * - synced: la nube tiene la última partida.
 * - pending: hay cambios guardados aquí que aún no han subido (normal entre subidas).
 * - error: la nube lleva más de CLOUD_LATE_MS sin poder actualizarse.
 * - conflict: otro dispositivo guardó una partida más reciente.
 */
export type SaveState = 'local' | 'synced' | 'pending' | 'error' | 'conflict';

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
  /** Se está comprobando la sesión o hablando con la nube. */
  busy = false;
  /** Momento (reloj del dispositivo) del último guardado en este dispositivo. */
  localAt = 0;
  /** savedAt de la última partida que la nube confirmó tener. */
  cloudAt = 0;
  /** Desde cuándo falla la subida (0 = no falla). */
  failingSince = 0;
  /** Otro dispositivo tiene en la nube una partida más reciente. */
  conflict = false;
  /** Hay una partida en marcha: la sincronización ya no puede reemplazar la de este dispositivo. */
  playing = false;
  private listeners = new Set<() => void>();
  private lastPush = 0;
  private pushTimer = 0;
  private retries = 0;
  private pushing: Promise<void> | null = null;

  constructor() {
    this.migrateNamedSaves();
    this.localAt = this.local()?.savedAt ?? 0;
  }

  onChange(fn: () => void) { this.listeners.add(fn); }
  private changed() { this.listeners.forEach((fn) => fn()); }

  get state(): SaveState {
    if (!this.user) return 'local';
    if (this.conflict) return 'conflict';
    if (this.cloudAt >= this.localAt) return 'synced';
    if (this.failingSince && Date.now() - this.failingSince > CLOUD_LATE_MS) return 'error';
    return 'pending';
  }

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

  /** Guarda ya en el dispositivo y programa la subida a la nube (`flush`: subir ya). */
  save(rt: Runtime, flush = false) {
    try {
      const snap = snapshot(rt);
      // Si el reloj de otro dispositivo iba adelantado, esta partida sigue contando como la más nueva.
      if (!this.conflict && snap.savedAt <= this.cloudAt) snap.savedAt = this.cloudAt + 1;
      localStorage.setItem(SLOT, JSON.stringify(snap));
      this.localAt = snap.savedAt;
    } catch (e) {
      console.error('No se pudo guardar', e);
      return;
    }
    this.schedule(flush);
    this.changed();
  }

  /** Borra la partida (al empezar una nueva). La nube se reemplaza en el siguiente guardado. */
  clear() {
    localStorage.removeItem(SLOT);
    this.localAt = 0;
  }

  private schedule(now = false) {
    if (!this.user) return;
    clearTimeout(this.pushTimer);
    if (now) { void this.push(); return; }
    const wait = Math.max(0, CLOUD_EVERY_MS - (performance.now() - this.lastPush));
    this.pushTimer = window.setTimeout(() => void this.push(), wait);
  }

  private async push(): Promise<void> {
    // Con un conflicto abierto no se sube nada hasta que el jugador elija (panel de guardado).
    if (!this.user || this.conflict || this.cloudAt >= this.localAt) return;
    if (this.pushing) { await this.pushing; return this.push(); }
    const raw = localStorage.getItem(SLOT);
    const info = summary(raw);
    if (!raw || !info) return;
    this.lastPush = performance.now();
    this.busy = true;
    this.changed();
    this.pushing = (async () => {
      try {
        const res = await cloud.putCloudSave({ data: await cloud.compress(raw), version: SAVE_VERSION, savedAt: info.savedAt });
        this.cloudAt = res.save.savedAt;
        this.conflict = !res.accepted;
        this.failingSince = 0;
        this.retries = 0;
      } catch (e) {
        if (e instanceof cloud.AuthError) { this.user = null; return; }
        console.warn('No se pudo subir la partida', e);
        if (!this.failingSince) this.failingSince = Date.now();
        // Se reintenta solo, sin esperar al siguiente autoguardado.
        clearTimeout(this.pushTimer);
        this.pushTimer = window.setTimeout(() => void this.push(), RETRY_MS[Math.min(this.retries++, RETRY_MS.length - 1)]);
      } finally {
        this.pushing = null;
        this.busy = false;
        this.changed();
      }
    })();
    return this.pushing;
  }

  /** "Guardar ahora": guarda y sube sin esperar. Si había otra partida más reciente en la nube, esta la reemplaza. */
  async saveNow(rt: Runtime) {
    this.conflict = false;
    this.retries = 0;
    this.save(rt, true);
    await this.pushing;
  }

  // ---------- Cuenta ----------

  /** Comprueba la sesión y deja en este dispositivo la partida más reciente. */
  async connect(choose: ChooseCloud) {
    if (!cloud.cloudEnabled) return;
    this.busy = true;
    this.changed();
    try {
      this.user = await cloud.fetchUser();
      if (this.user) await this.sync(choose);
    } catch (e) {
      console.warn('No se pudo comprobar la sesión', e);
      if (!this.failingSince) this.failingSince = Date.now();
    } finally {
      this.busy = false;
      this.changed();
    }
  }

  private async sync(choose: ChooseCloud) {
    if (!this.user) return;
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
        // Llegó tarde: no se toca la partida en curso. El jugador decide desde el panel de guardado.
        this.cloudAt = remote.savedAt;
        this.conflict = true;
        return;
      }
      if (remote && useCloud) {
        localStorage.setItem(SLOT, await cloud.decompress(remote.data));
        this.localAt = this.cloudAt = remote.savedAt;
      } else {
        this.cloudAt = remote?.savedAt ?? 0;
        if (!useCloud && local && remote && local.savedAt < remote.savedAt) {
          // Se eligió la de este dispositivo aunque sea más antigua: se sube como la más nueva.
          const d = JSON.parse(localStorage.getItem(SLOT)!);
          d.savedAt = this.localAt = Date.now();
          localStorage.setItem(SLOT, JSON.stringify(d));
        }
        this.schedule(true);
      }
      localStorage.setItem(SYNCED_USER, this.user.id);
      this.failingSince = 0;
    } catch (e) {
      if (e instanceof cloud.AuthError) { this.user = null; return; }
      console.warn('No se pudo sincronizar la partida', e);
      if (!this.failingSince) this.failingSince = Date.now();
      this.schedule();
    }
  }

  /**
   * Al volver a la pestaña: ¿guardó otro dispositivo algo más reciente mientras tanto?
   * Solo avisa (conflict); no cambia la partida en curso.
   */
  async checkRemote() {
    if (!this.user || this.busy) return;
    try {
      const remote = await cloud.getCloudSave();
      if (remote && remote.savedAt > this.cloudAt && remote.savedAt > this.localAt) {
        this.cloudAt = remote.savedAt;
        this.conflict = true;
        this.changed();
      }
    } catch {
      // sin conexión: ya se reintentará al guardar
    }
  }

  /** Trae la partida de la nube a este dispositivo (luego hay que cargarla con rt.requestLoad). */
  async pullCloud(): Promise<boolean> {
    if (!this.user) return false;
    this.busy = true;
    this.changed();
    try {
      const remote = await cloud.getCloudSave();
      if (!remote) return false;
      localStorage.setItem(SLOT, await cloud.decompress(remote.data));
      this.localAt = this.cloudAt = remote.savedAt;
      this.conflict = false;
      return true;
    } finally {
      this.busy = false;
      this.changed();
    }
  }

  async logout() {
    await this.push();
    try { await cloud.logout(); } catch { /* sin conexión: la cookie caduca sola */ }
    this.user = null;
    this.cloudAt = 0;
    this.conflict = false;
    this.failingSince = 0;
    localStorage.removeItem(SYNCED_USER);
    this.changed();
  }
}
