// Sincronización entre dispositivos usando un gist secreto de tu cuenta de GitHub.
// Cada dispositivo lee el gist, lo junta con lo suyo (gana el cambio más reciente) y lo vuelve a guardar.
import { settings, library, meta, bus } from './store.js';

const API = 'https://api.github.com';
const FILE = 'cine-galions.json';

export class SyncError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const emit = (detail) => bus.dispatchEvent(new CustomEvent('sync', { detail }));

async function gh(path, opts = {}, token = settings.get().gistToken) {
  let r;
  try {
    r = await fetch(API + path, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', ...(opts.headers || {}) },
      cache: 'no-store',
    });
  } catch {
    throw new SyncError('OFFLINE', 'Sin conexión con GitHub');
  }
  if (r.status === 401) throw new SyncError('BAD_TOKEN', 'GitHub dice que el token no es válido o ya expiró.');
  if (r.status === 403 || r.status === 404) {
    const j = await r.json().catch(() => ({}));
    throw new SyncError(r.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN', j.message || `GitHub respondió ${r.status}`);
  }
  if (!r.ok) throw new SyncError('HTTP', `GitHub respondió ${r.status}`);
  return r.status === 204 ? null : r.json();
}

/** Comprueba un token y que tenga permiso para gists. Devuelve el usuario de GitHub. */
export async function checkToken(token) {
  const user = await gh('/user', {}, token);
  await gh('/gists?per_page=1', {}, token).catch((e) => {
    throw e.code === 'FORBIDDEN' || e.code === 'NOT_FOUND' ? new SyncError('NO_SCOPE', 'El token no tiene el permiso «gist». Créalo de nuevo marcando esa casilla.') : e;
  });
  return user.login;
}

async function findOrCreateGist() {
  for (let page = 1; page <= 5; page++) {
    const list = await gh(`/gists?per_page=100&page=${page}`);
    const g = list.find((x) => x.files && x.files[FILE]);
    if (g) return { id: g.id, created: false };
    if (list.length < 100) break;
  }
  const g = await gh('/gists', {
    method: 'POST',
    body: JSON.stringify({ description: 'Cine Galions · sincronización entre dispositivos (no borrar)', public: false, files: { [FILE]: { content: JSON.stringify(library.syncPayload()) } } }),
  });
  return { id: g.id, created: true };
}

async function readGist(id) {
  const g = await gh(`/gists/${id}`);
  const f = g.files?.[FILE];
  if (!f) throw new SyncError('NOT_FOUND', 'El archivo de sincronización no está');
  let text = f.content;
  if (f.truncated) text = await fetch(f.raw_url, { cache: 'no-store' }).then((r) => r.text());
  try {
    return JSON.parse(text);
  } catch {
    return { library: {}, tombs: {} };
  }
}

const writeGist = (id) => gh(`/gists/${id}`, { method: 'PATCH', body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify(library.syncPayload()) } } }) });

export const syncEnabled = () => !!settings.get().gistToken;
export const syncState = () => meta.get('sync', { at: 0, error: '' });

let running = null;
let again = false;

/** Sincroniza ahora. Devuelve { pulled, pushed }. */
export function syncNow() {
  if (!syncEnabled()) return Promise.resolve(null);
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    emit({ state: 'running' });
    try {
      let id = settings.get().gistId;
      let created = false;
      if (!id) {
        ({ id, created } = await findOrCreateGist());
        settings.set({ gistId: id });
      }
      if (created) {
        meta.set('sync', { at: Date.now(), error: '' });
        emit({ state: 'ok', pulled: false, pushed: true });
        return { pulled: false, pushed: true };
      }
      let remote;
      try {
        remote = await readGist(id);
      } catch (e) {
        if (e.code !== 'NOT_FOUND') throw e;
        // el gist se borró: se crea otro
        settings.set({ gistId: '' });
        ({ id } = await findOrCreateGist());
        settings.set({ gistId: id });
        remote = library.syncPayload();
      }
      const { changedLocal, changedRemote } = library.mergeRemote(remote);
      if (changedRemote) await writeGist(id);
      meta.set('sync', { at: Date.now(), error: '' });
      emit({ state: 'ok', pulled: changedLocal, pushed: changedRemote });
      return { pulled: changedLocal, pushed: changedRemote };
    } catch (e) {
      meta.set('sync', { ...syncState(), error: e.message });
      emit({ state: 'error', error: e });
      throw e;
    } finally {
      running = null;
      if (again) {
        again = false;
        setTimeout(() => syncNow().catch(() => {}), 500);
      }
    }
  })();
  return running;
}

/** Arranca la sincronización automática: al abrir, al volver a la app, cada 2 min y tras cada cambio. */
export function startAutoSync() {
  let t = null;
  const soon = (ms) => {
    clearTimeout(t);
    t = setTimeout(() => syncNow().catch(() => {}), ms);
  };
  bus.addEventListener('library', (e) => {
    if (!e.detail?.fromSync && syncEnabled()) soon(2500);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && syncEnabled()) soon(300);
    // al salir de la app, guardar lo pendiente
    if (document.visibilityState === 'hidden' && t && syncEnabled()) soon(0);
  });
  setInterval(() => syncEnabled() && document.visibilityState === 'visible' && syncNow().catch(() => {}), 120e3);
  if (syncEnabled()) soon(800);
}

export function disconnectSync() {
  settings.set({ gistToken: '', gistId: '' });
  meta.set('sync', { at: 0, error: '' });
  emit({ state: 'off' });
}
