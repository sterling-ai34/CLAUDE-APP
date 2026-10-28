// Almacenamiento local: ajustes, tu biblioteca personal y notificaciones.
// Solo se guarda TU información (estados, notas, notas personales). El catálogo
// siempre se pide en vivo a TMDB, así nunca se mezcla basura con tus datos.

const KEYS = {
  settings: 'galions.settings.v1',
  library: 'galions.library.v1',
  notifs: 'galions.notifs.v1',
  meta: 'galions.meta.v1',
};

function read(k, fallback) {
  try {
    const v = localStorage.getItem(k);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
function write(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
}

export const bus = new EventTarget();
const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));

/* ----------------------------- Ajustes ----------------------------- */
const DEFAULT_SETTINGS = {
  tmdbKey: '',
  region: 'MX',
  titleLang: 'latino', // 'latino' | 'original'
  disabledFeeds: [],
  customFeeds: [],
  browserNotifs: false,
};
let _settings = { ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) };

export const settings = {
  get: () => _settings,
  set(patch) {
    _settings = { ..._settings, ...patch };
    write(KEYS.settings, _settings);
    emit('settings', _settings);
  },
};

/* ----------------------------- Meta / caché ----------------------------- */
let _meta = read(KEYS.meta, {});
export const meta = {
  get: (k, d) => (k in _meta ? _meta[k] : d),
  set(k, v) {
    _meta[k] = v;
    write(KEYS.meta, _meta);
  },
};

/* ----------------------------- Biblioteca ----------------------------- */
export const keyOf = (it) => `${it.type}:${it.id}`;
const SUMMARY_FIELDS = ['id', 'type', 'title', 'originalTitle', 'poster', 'backdrop', 'year', 'date', 'genres', 'anime', 'runtime', 'vote', 'episodes'];

let _lib = read(KEYS.library, {});

function blankEntry(it) {
  return {
    key: keyOf(it),
    status: null, // 'watchlist' | 'watching' | 'watched' | 'dropped'
    favorite: false,
    rating: 0, // 1..10 (medias estrellas)
    note: '',
    tags: [],
    dates: [], // diario: fechas en que la viste (YYYY-MM-DD)
    following: false,
    eps: {}, // { "1": [1,2,3], "2": [1] }  episodios vistos por temporada
    addedAt: Date.now(),
  };
}

function isEmpty(e) {
  return !e.status && !e.favorite && !e.rating && !e.note?.trim() && !e.tags?.length && !e.dates?.length && !e.following && !Object.values(e.eps || {}).some((a) => a.length);
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const library = {
  get: (key) => _lib[key] || null,
  all: () => Object.values(_lib),
  count: () => Object.keys(_lib).length,

  update(item, fn) {
    const k = keyOf(item);
    const e = _lib[k] ? { ..._lib[k] } : blankEntry(item);
    for (const f of SUMMARY_FIELDS) if (item[f] !== undefined && item[f] !== null && item[f] !== '') e[f] = item[f];
    fn(e);
    e.updatedAt = Date.now();
    if (isEmpty(e)) delete _lib[k];
    else _lib[k] = e;
    write(KEYS.library, _lib);
    emit('library', { key: k, entry: _lib[k] || null });
    return _lib[k] || null;
  },

  setStatus(item, status) {
    return this.update(item, (e) => {
      e.status = e.status === status ? null : status;
      if (e.status === 'watched' && item.type === 'movie' && !e.dates.length) e.dates = [today()];
    });
  },
  toggleFavorite(item) {
    return this.update(item, (e) => {
      e.favorite = !e.favorite;
      if (e.favorite && !e.status) e.status = 'watched';
    });
  },
  setRating(item, rating) {
    return this.update(item, (e) => {
      e.rating = e.rating === rating ? 0 : rating;
      if (e.rating && (!e.status || e.status === 'watchlist')) e.status = 'watched';
    });
  },
  setNote(item, note) {
    return this.update(item, (e) => {
      e.note = note;
    });
  },
  toggleTag(item, tag) {
    return this.update(item, (e) => {
      e.tags = e.tags.includes(tag) ? e.tags.filter((t) => t !== tag) : [...e.tags, tag];
    });
  },
  addDate(item, date) {
    return this.update(item, (e) => {
      e.dates = [...e.dates, date].sort();
      if (!e.status || e.status === 'watchlist') e.status = 'watched';
    });
  },
  removeDate(item, idx) {
    return this.update(item, (e) => {
      e.dates = e.dates.filter((_, i) => i !== idx);
    });
  },
  setFollowing(item, on, extra = {}) {
    return this.update(item, (e) => {
      e.following = on;
      Object.assign(e, extra);
    });
  },
  setEpisodes(item, season, numbers, watched) {
    return this.update(item, (e) => {
      const s = String(season);
      const set = new Set(e.eps[s] || []);
      for (const n of numbers) watched ? set.add(n) : set.delete(n);
      e.eps = { ...e.eps, [s]: [...set].sort((a, b) => a - b) };
      if (watched && (!e.status || e.status === 'watchlist')) e.status = 'watching';
    });
  },
  patch(item, obj) {
    return this.update(item, (e) => Object.assign(e, obj));
  },

  exportData() {
    return { app: 'cine-galions', version: 1, exportedAt: new Date().toISOString(), library: _lib, notifs: _notifs };
  },
  importData(data, mode = 'merge') {
    if (!data || typeof data !== 'object' || !data.library) throw new Error('Archivo no válido');
    if (mode === 'replace') _lib = {};
    for (const [k, e] of Object.entries(data.library)) {
      if (!e || !e.id || !e.type) continue;
      const cur = _lib[k];
      if (!cur || (e.updatedAt || 0) >= (cur.updatedAt || 0)) _lib[k] = e;
    }
    write(KEYS.library, _lib);
    emit('library', { all: true });
  },
  clear() {
    _lib = {};
    write(KEYS.library, _lib);
    emit('library', { all: true });
  },
};

/** Episodios vistos en total */
export function watchedEpisodes(e) {
  return Object.values(e?.eps || {}).reduce((a, l) => a + l.length, 0);
}
/** Último episodio marcado (temporada más alta, episodio más alto) */
export function lastWatchedEp(e) {
  const seasons = Object.keys(e?.eps || {}).map(Number).filter((s) => e.eps[s]?.length).sort((a, b) => b - a);
  if (!seasons.length) return null;
  const s = seasons[0];
  return { s, e: Math.max(...e.eps[s]) };
}

/* ----------------------------- Notificaciones ----------------------------- */
let _notifs = read(KEYS.notifs, []);
export const notifs = {
  all: () => _notifs,
  unread: () => _notifs.filter((n) => !n.read).length,
  add(n) {
    if (_notifs.some((x) => x.id === n.id)) return false;
    _notifs = [{ ...n, at: Date.now(), read: false }, ..._notifs].slice(0, 120);
    write(KEYS.notifs, _notifs);
    emit('notifs', _notifs);
    return true;
  },
  markAll() {
    _notifs = _notifs.map((n) => ({ ...n, read: true }));
    write(KEYS.notifs, _notifs);
    emit('notifs', _notifs);
  },
  markRead(id) {
    _notifs = _notifs.map((n) => (n.id === id ? { ...n, read: true } : n));
    write(KEYS.notifs, _notifs);
    emit('notifs', _notifs);
  },
  clear() {
    _notifs = [];
    write(KEYS.notifs, _notifs);
    emit('notifs', _notifs);
  },
};
