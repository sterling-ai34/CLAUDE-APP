// Fuentes de datos reales:
//  - TMDB (themoviedb.org): todas las películas, series y anime, en español.
//  - AniList: hora exacta del próximo episodio de un anime en emisión.
//  - Feeds RSS de medios de cine / series / anime para las noticias.
import { settings, meta } from './store.js';

const BASE = 'https://api.themoviedb.org/3';
export const IMG = (path, size = 'w342') => (path ? `https://image.tmdb.org/t/p/${size}${path}` : '');

export class ApiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const cache = new Map();

function authFor(key) {
  // Acepta la "Clave de la API" (32 caracteres) o el "Token de acceso de lectura" (empieza por eyJ).
  return key.startsWith('eyJ') ? { headers: { Authorization: `Bearer ${key}` }, query: {} } : { headers: {}, query: { api_key: key } };
}

export function tmdb(path, params = {}, { signal, ttl = 15 * 60e3, key } = {}) {
  const k = (key || settings.get().tmdbKey || '').trim();
  if (!k) return Promise.reject(new ApiError('NO_KEY', 'Falta la API key de TMDB'));
  const auth = authFor(k);
  const q = new URLSearchParams({ language: 'es-MX', ...auth.query, ...params });
  const url = `${BASE}${path}?${q}`;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < ttl) return hit.p;
  const p = fetch(url, { signal, headers: { accept: 'application/json', ...auth.headers } }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new ApiError(r.status === 401 ? 'BAD_KEY' : 'HTTP', data.status_message || `Error ${r.status}`);
    return data;
  });
  cache.set(url, { t: Date.now(), p });
  p.catch(() => cache.delete(url));
  return p;
}

export const validateKey = (key) => tmdb('/configuration', {}, { key, ttl: 0 });

/* ----------------------------- Géneros ----------------------------- */
export const MOVIE_GENRES = {
  28: 'Acción', 12: 'Aventura', 16: 'Animación', 35: 'Comedia', 80: 'Crimen', 99: 'Documental', 18: 'Drama', 10751: 'Familia',
  14: 'Fantasía', 36: 'Historia', 27: 'Terror', 10402: 'Música', 9648: 'Misterio', 10749: 'Romance', 878: 'Ciencia ficción',
  10770: 'Película de TV', 53: 'Suspenso', 10752: 'Bélica', 37: 'Western',
};
export const TV_GENRES = {
  10759: 'Acción y aventura', 16: 'Animación', 35: 'Comedia', 80: 'Crimen', 99: 'Documental', 18: 'Drama', 10751: 'Familia',
  10762: 'Infantil', 9648: 'Misterio', 10763: 'Noticias', 10764: 'Reality', 10765: 'Ciencia ficción y fantasía', 10766: 'Telenovela',
  10767: 'Talk show', 10768: 'Bélica y política', 37: 'Western',
};
export const genreName = (id, type) => (type === 'tv' ? TV_GENRES[id] || MOVIE_GENRES[id] : MOVIE_GENRES[id] || TV_GENRES[id]) || '';

// Equivalencias entre géneros de películas y de series (TMDB usa listas distintas).
const MOVIE_TO_TV = { 28: 10759, 12: 10759, 878: 10765, 14: 10765, 10752: 10768, 53: 9648, 27: 9648, 10749: 18, 36: 18, 10402: 18 };
const TV_TO_MOVIE = { 10759: 28, 10765: 878, 10768: 10752, 10762: 10751 };
export function mapGenre(id, toType) {
  id = Number(id);
  if (toType === 'tv') return TV_GENRES[id] ? id : MOVIE_TO_TV[id] || null;
  return MOVIE_GENRES[id] ? id : TV_TO_MOVIE[id] || null;
}

/* ----------------------------- Normalización ----------------------------- */
export function norm(r, forcedType) {
  const type = forcedType || r.media_type || (r.title !== undefined ? 'movie' : 'tv');
  const date = (type === 'movie' ? r.release_date : r.first_air_date) || '';
  const genres = r.genre_ids || (r.genres || []).map((g) => g.id);
  const anime = genres.includes(16) && (r.original_language === 'ja' || (r.origin_country || []).includes('JP'));
  return {
    id: r.id,
    type,
    title: (type === 'movie' ? r.title : r.name) || r.original_title || r.original_name || '',
    originalTitle: (type === 'movie' ? r.original_title : r.original_name) || '',
    poster: r.poster_path || null,
    backdrop: r.backdrop_path || null,
    year: date.slice(0, 4),
    date,
    genres,
    anime,
    vote: r.vote_average || 0,
    votes: r.vote_count || 0,
    overview: r.overview || '',
    lang: r.original_language || '',
    popularity: r.popularity || 0,
  };
}
export const normList = (data, forcedType) =>
  (data?.results || []).filter((r) => forcedType || r.media_type === 'movie' || r.media_type === 'tv').map((r) => norm(r, forcedType));

/* ----------------------------- Endpoints ----------------------------- */
export const regionOf = () => settings.get().region || 'MX';

export function details(type, id) {
  const append = type === 'movie'
    ? 'videos,credits,recommendations,similar,watch/providers,translations,release_dates'
    : 'videos,credits,recommendations,similar,watch/providers,translations,external_ids';
  return tmdb(`/${type}/${id}`, { append_to_response: append, include_video_language: 'es,en,null' });
}
export const season = (id, n) => tmdb(`/tv/${id}/season/${n}`);
export const collection = (id) => tmdb(`/collection/${id}`);
export const person = (id) => tmdb(`/person/${id}`, { append_to_response: 'combined_credits,translations' });
export const trending = (type = 'all', window = 'week', page = 1) => tmdb(`/trending/${type}/${window}`, { page });
export const discover = (type, params = {}) => tmdb(`/discover/${type}`, { include_adult: 'false', ...params });
export const nowPlaying = (page = 1) => tmdb('/movie/now_playing', { region: regionOf(), page });
export const upcoming = (page = 1) => tmdb('/movie/upcoming', { region: regionOf(), page });
export const topRated = (type = 'movie', page = 1) => tmdb(`/${type}/top_rated`, { page });

export function searchMulti(query, page = 1, signal) {
  return tmdb('/search/multi', { query, page, include_adult: 'false' }, { signal, ttl: 5 * 60e3 });
}
export function searchType(type, query, page = 1, signal, year) {
  const params = { query, page, include_adult: 'false' };
  if (year) params[type === 'movie' ? 'primary_release_year' : 'first_air_date_year'] = year;
  return tmdb(`/search/${type}`, params, { signal, ttl: 5 * 60e3 });
}

export const animeParams = (extra = {}) => ({ with_genres: '16', with_origin_country: 'JP', ...extra });
export const animeMovieParams = (extra = {}) => ({ with_genres: '16', with_original_language: 'ja', ...extra });

export function isoDaysFromNow(days) {
  const d = new Date(Date.now() + days * 864e5);
  return d.toISOString().slice(0, 10);
}

/* ----------------------------- AniList (anime en emisión) ----------------------------- */
const ANILIST_QUERY = `query ($s: String) {
  Page(perPage: 6) {
    media(search: $s, type: ANIME, sort: SEARCH_MATCH, status_in: [RELEASING, NOT_YET_RELEASED]) {
      id siteUrl status episodes
      title { romaji english native }
      nextAiringEpisode { episode airingAt }
    }
  }
}`;

/** Devuelve { episode, airingAt (unix s), url, title } del próximo episodio, o null. */
export async function anilistNext(titles) {
  const ck = `anilist:${titles.join('|')}`;
  const cached = meta.get(ck);
  if (cached && Date.now() - cached.t < 3 * 3600e3 && (!cached.v || cached.v.airingAt * 1000 > Date.now())) return cached.v;
  let found = null;
  for (const s of titles.filter(Boolean)) {
    try {
      const r = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: ANILIST_QUERY, variables: { s } }),
      });
      const j = await r.json();
      const list = j?.data?.Page?.media || [];
      const m = list.find((x) => x.nextAiringEpisode) || null;
      if (m) {
        found = { episode: m.nextAiringEpisode.episode, airingAt: m.nextAiringEpisode.airingAt, url: m.siteUrl, title: m.title.english || m.title.romaji };
        break;
      }
    } catch {
      /* AniList caído: seguimos con TMDB */
    }
  }
  meta.set(ck, { t: Date.now(), v: found });
  return found;
}

/* ----------------------------- Noticias (RSS) ----------------------------- */
export const DEFAULT_FEEDS = [
  { id: 'cinemascomics', name: 'Cinemascomics', url: 'https://www.cinemascomics.com/feed/', cat: 'cine', lang: 'es' },
  { id: 'lacasadeel', name: 'La Casa de EL', url: 'https://www.lacasadeel.net/feed', cat: 'anime', lang: 'es' },
  { id: 'ramenparados', name: 'Ramen Para Dos', url: 'https://ramenparados.com/feed/', cat: 'anime', lang: 'es' },
  { id: 'variety-film', name: 'Variety · Cine', url: 'https://variety.com/v/film/feed/', cat: 'cine', lang: 'en' },
  { id: 'variety-tv', name: 'Variety · Series', url: 'https://variety.com/v/tv/feed/', cat: 'series', lang: 'en' },
  { id: 'collider', name: 'Collider', url: 'https://collider.com/feed/', cat: 'cine', lang: 'en' },
  { id: 'ann', name: 'Anime News Network', url: 'https://www.animenewsnetwork.com/all/rss.xml?ann-edition=us', cat: 'anime', lang: 'en' },
];

export function activeFeeds() {
  const s = settings.get();
  return [...DEFAULT_FEEDS, ...(s.customFeeds || [])].filter((f) => !(s.disabledFeeds || []).includes(f.id));
}

const stripHtml = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h || '';
  return (d.textContent || '').replace(/\s+/g, ' ').trim();
};
const firstImg = (h) => (/<img[^>]+src=["']([^"']+)["']/i.exec(h || '') || [])[1] || '';

function withTimeout(ms) {
  if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) return AbortSignal.timeout(ms);
  return undefined;
}

function parseXml(text, feed) {
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  const nodes = [...doc.querySelectorAll('item, entry')];
  if (!nodes.length) throw new Error('feed vacío');
  return nodes.slice(0, 25).map((n) => {
    const get = (sel) => n.getElementsByTagName(sel)[0];
    const link = get('link')?.getAttribute('href') || get('link')?.textContent || '';
    const desc = get('content:encoded')?.textContent || get('description')?.textContent || get('summary')?.textContent || get('content')?.textContent || '';
    const media = get('media:content')?.getAttribute('url') || get('media:thumbnail')?.getAttribute('url') || '';
    const enc = get('enclosure');
    const encUrl = enc && /image/.test(enc.getAttribute('type') || 'image') ? enc.getAttribute('url') : '';
    return {
      title: stripHtml(get('title')?.textContent),
      link: link.trim(),
      date: new Date(get('pubDate')?.textContent || get('published')?.textContent || get('updated')?.textContent || get('dc:date')?.textContent || Date.now()).getTime(),
      image: media || encUrl || firstImg(desc),
      summary: stripHtml(desc).slice(0, 260),
    };
  });
}

async function fetchFeed(feed) {
  const enc = encodeURIComponent(feed.url);
  let items = null;
  // 1) rss2json (convierte RSS a JSON y permite leerlo desde el navegador)
  try {
    const r = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${enc}`, { signal: withTimeout(9000) });
    const j = await r.json();
    if (j.status === 'ok' && j.items?.length) {
      items = j.items.map((it) => ({
        title: stripHtml(it.title),
        link: it.link,
        date: new Date((it.pubDate || '').replace(' ', 'T') + 'Z').getTime() || Date.now(),
        image: it.thumbnail || (it.enclosure?.link && /image|jpe?g|png|webp/i.test(it.enclosure.type || it.enclosure.link) ? it.enclosure.link : '') || firstImg(it.content || it.description),
        summary: stripHtml(it.description || it.content).slice(0, 260),
      }));
    }
  } catch { /* probamos el siguiente */ }
  // 2) Proxies CORS de respaldo
  if (!items) {
    for (const proxy of [`https://api.allorigins.win/raw?url=${enc}`, `https://corsproxy.io/?url=${enc}`]) {
      try {
        const r = await fetch(proxy, { signal: withTimeout(9000) });
        if (!r.ok) continue;
        items = parseXml(await r.text(), feed);
        break;
      } catch { /* siguiente */ }
    }
  }
  if (!items) throw new Error(`No se pudo leer ${feed.name}`);
  return items.filter((i) => i.title && i.link).map((i) => ({ ...i, source: feed.name, sourceId: feed.id, cat: feed.cat, lang: feed.lang }));
}

const NEWS_KEY = 'news';
export function cachedNews() {
  return meta.get(NEWS_KEY, null);
}
export async function loadNews({ force = false } = {}) {
  const c = cachedNews();
  const feeds = activeFeeds();
  const sig = feeds.map((f) => f.id).join(',');
  if (!force && c && c.sig === sig && Date.now() - c.t < 30 * 60e3) return c;
  const res = await Promise.allSettled(feeds.map(fetchFeed));
  const failed = [];
  const seen = new Set();
  const items = [];
  res.forEach((r, i) => {
    if (r.status !== 'fulfilled') return failed.push(feeds[i].name);
    for (const it of r.value) {
      if (seen.has(it.link)) continue;
      seen.add(it.link);
      items.push(it);
    }
  });
  items.sort((a, b) => b.date - a.date);
  const out = { t: Date.now(), sig, items: items.slice(0, 240), failed };
  if (items.length) meta.set(NEWS_KEY, out);
  else if (c) return { ...c, failed };
  return out;
}
