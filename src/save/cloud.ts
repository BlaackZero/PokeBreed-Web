// Cuenta de Core Utils (login con Google) y partida en la nube.
// Solo se activa en *.core-utils.app, donde la cookie de sesión de api.core-utils.app es del mismo sitio.
// En local: VITE_API_URL=http://localhost:3000 npm run dev (con el backend de Core Utils arrancado).

const API: string = import.meta.env.VITE_API_URL
  ?? (location.hostname === 'core-utils.app' || location.hostname.endsWith('.core-utils.app') ? 'https://api.core-utils.app' : '');

export const cloudEnabled = API !== '';

export interface CloudUser { id: string; email: string; name: string | null; avatarUrl: string | null }
export interface CloudSave { data: string; version: number; savedAt: number }

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    credentials: 'include',
    headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  if (res.status === 401) throw new AuthError();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export class AuthError extends Error {}

/** Usuario con sesión iniciada, o null. */
export async function fetchUser(): Promise<CloudUser | null> {
  if (!cloudEnabled) return null;
  try {
    return (await api('/auth/me')) as CloudUser;
  } catch (e) {
    if (e instanceof AuthError) return null;
    throw e;
  }
}

/** Login con Google: vuelve a esta misma página al terminar. */
export function login() {
  const back = `${location.origin}${location.pathname}`;
  location.href = `${API}/auth/google?returnTo=${encodeURIComponent(back)}`;
}

export async function logout() {
  await api('/auth/logout', { method: 'POST' });
}

export async function getCloudSave(): Promise<CloudSave | null> {
  return ((await api('/pokebreed/save')) as { save: CloudSave | null }).save;
}

/** Sube la partida. Si la nube tiene una más reciente (otro dispositivo), no se reemplaza. */
export async function putCloudSave(save: CloudSave, keepalive = false): Promise<{ accepted: boolean; save: CloudSave }> {
  // keepalive (para cuando se cierra la página) solo admite cuerpos de hasta 64 kB.
  const body = JSON.stringify(save);
  return api('/pokebreed/save', { method: 'PUT', body, keepalive: keepalive && body.length < 60_000 });
}

// ---------- Compresión (gzip + base64) ----------

export async function compress(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function decompress(b64: string): Promise<string> {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}
