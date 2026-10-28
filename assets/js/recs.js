// Motor de recomendaciones: según tus gustos, "sorpréndeme" y aleatorio total.
import { tmdb, discover, norm, normList, mapGenre, genreName, animeParams, animeMovieParams } from './api.js';
import { library, keyOf } from './store.js';
import { shuffle } from './ui.js';

const kindMatch = (it, kind) =>
  kind === 'all' || !kind ? true : kind === 'anime' ? it.anime : kind === 'movie' ? it.type === 'movie' && !it.anime : it.type === 'tv' && !it.anime;

/** Títulos que ya no quieres que te recomienden (vistos, abandonados o que te cayeron mal). */
function seenKeys() {
  const s = new Set();
  for (const e of library.all()) {
    if (e.status === 'watched' || e.status === 'dropped' || e.status === 'watching' || (e.rating && e.rating <= 4)) s.add(e.key);
  }
  return s;
}

function seedWeight(e) {
  let w = 0;
  if (e.favorite) w += 3;
  if (e.rating >= 9) w += 3;
  else if (e.rating >= 7) w += 2;
  else if (e.rating && e.rating <= 4) w -= 5;
  if (!e.rating && !e.favorite && (e.status === 'watched' || e.status === 'watching')) w += 0.6;
  if (e.tags?.length) w += 0.4;
  return w;
}

/** Lo que te gustó, ordenado por cuánto te gustó. */
export function seeds(kind = 'all') {
  return library
    .all()
    .filter((e) => e.id && kindMatch(e, kind))
    .map((e) => ({ e, w: seedWeight(e) + Math.min(1, (e.updatedAt || 0) / Date.now()) * 0.3 }))
    .filter((x) => x.w > 0.5)
    .sort((a, b) => b.w - a.w)
    .map((x) => ({ ...x.e, weight: x.w }));
}

/** Peso de cada género según lo que te gusta. */
export function genreProfile(kind = 'all') {
  const prof = {};
  for (const e of library.all()) {
    if (!kindMatch(e, kind)) continue;
    let w = seedWeight(e);
    if (!w) continue;
    for (const g of e.genres || []) if (g !== 16) prof[g] = (prof[g] || 0) + w;
  }
  return prof;
}

export function topGenres(kind = 'all', n = 3) {
  return Object.entries(genreProfile(kind))
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([g]) => Number(g));
}

function weightedPick(prof) {
  const entries = Object.entries(prof).filter(([, w]) => w > 0);
  const total = entries.reduce((a, [, w]) => a + w, 0);
  if (!total) return null;
  let r = Math.random() * total;
  for (const [g, w] of entries) if ((r -= w) <= 0) return Number(g);
  return Number(entries[0][0]);
}

function decadeParams(type, decade) {
  if (!decade) return {};
  const [a, b] = decade === 'old' ? ['1900', '1979'] : [decade, String(Number(decade) + 9)];
  const f = type === 'movie' ? 'primary_release_date' : 'first_air_date';
  return { [`${f}.gte`]: `${a}-01-01`, [`${f}.lte`]: `${b}-12-31` };
}
const inDecade = (it, decade) => {
  if (!decade) return true;
  const y = Number(it.year);
  if (!y) return false;
  return decade === 'old' ? y < 1980 : y >= Number(decade) && y <= Number(decade) + 9;
};

/** "Para ti": junta las recomendaciones de TMDB de lo que más te gustó. */
export async function forYou({ kind = 'all', limit = 40, decade = '', genre = null } = {}) {
  const S = seeds(kind).slice(0, 8);
  if (!S.length) return [];
  const seen = seenKeys();
  const prof = genreProfile(kind);
  const maxProf = Math.max(1, ...Object.values(prof));
  const res = await Promise.allSettled(S.map((s) => tmdb(`/${s.type}/${s.id}/recommendations`).then((r) => ({ s, list: r.results || [] }))));
  const map = new Map();
  for (const r of res) {
    if (r.status !== 'fulfilled') continue;
    const { s, list } = r.value;
    list.forEach((raw, idx) => {
      const it = norm(raw, raw.media_type || s.type);
      const k = keyOf(it);
      if (seen.has(k) || !it.poster) return;
      const cur = map.get(k) || { it, score: 0, because: [] };
      cur.score += s.weight * (1 - idx / 30);
      if (!cur.because.includes(s.title)) cur.because.push(s.title);
      map.set(k, cur);
    });
  }
  let out = [...map.values()].map((x) => {
    const aff = (x.it.genres || []).reduce((a, g) => a + (prof[g] || 0), 0) / maxProf;
    return { ...x, score: x.score + x.because.length * 1.5 + (x.it.vote || 0) / 4 + aff * 0.8 };
  });
  out = out.filter((x) => kindMatch(x.it, kind) && inDecade(x.it, decade) && (!genre || x.it.genres.includes(Number(genre)) || x.it.genres.includes(mapGenre(genre, x.it.type))));
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit).map((x) => ({ ...x.it, reason: `Porque te gustó ${x.because[0]}${x.because.length > 1 ? ` y ${x.because.length - 1} más` : ''}` }));
}

/** Busca en "discover" una página aleatoria y devuelve títulos que no hayas visto. */
async function discoverRandom({ kind, genre, decade, quality, maxPages }) {
  const type = kind === 'all' ? (Math.random() < 0.6 ? 'movie' : 'tv') : kind === 'anime' ? (Math.random() < 0.75 ? 'tv' : 'movie') : kind;
  const isAnime = kind === 'anime';
  let params = { sort_by: 'popularity.desc', ...decadeParams(type, decade) };
  const g = genre ? mapGenre(genre, type) : null;
  if (isAnime) params = { ...params, ...(type === 'tv' ? animeParams() : animeMovieParams()) };
  if (g) params.with_genres = isAnime ? `16,${g}` : String(g);
  else if (!isAnime && kind !== 'all') params.without_genres = '16';
  if (quality) {
    params['vote_average.gte'] = isAnime ? 7 : 6.8;
    params['vote_count.gte'] = type === 'movie' ? (isAnime ? 80 : 300) : isAnime ? 60 : 120;
  } else {
    params['vote_count.gte'] = isAnime ? 20 : 50;
  }
  const first = await discover(type, { ...params, page: 1 });
  const total = Math.max(1, Math.min(first.total_pages || 1, maxPages));
  const page = 1 + Math.floor(Math.random() * total);
  const data = page === 1 ? first : await discover(type, { ...params, page });
  const seen = seenKeys();
  return { items: normList(data, type).filter((it) => !seen.has(keyOf(it)) && it.poster), genre: g, type };
}

/** "Sorpréndeme": aleatorio, pero dentro de los géneros que más te gustan y bien valorado. */
export async function surprise({ kind = 'all', genre = null, decade = '', count = 3 } = {}) {
  const prof = genreProfile(kind === 'all' ? 'all' : kind);
  const picks = [];
  for (let tries = 0; tries < 4 && picks.length < count; tries++) {
    const g = genre || weightedPick(prof);
    const { items, genre: usedG, type } = await discoverRandom({ kind, genre: g, decade, quality: true, maxPages: 15 });
    for (const it of shuffle(items)) {
      if (picks.length >= count + 6) break;
      if (picks.some((p) => p.id === it.id && p.type === it.type)) continue;
      const gname = usedG ? genreName(usedG, type) : '';
      picks.push({ ...it, reason: gname ? `Te gusta: ${gname} · ⭐ ${it.vote.toFixed(1)}` : `Muy bien valorada · ⭐ ${it.vote.toFixed(1)}` });
    }
  }
  return picks;
}

/** Aleatorio total (solo respeta los filtros que pongas). */
export async function random({ kind = 'all', genre = null, decade = '', count = 3 } = {}) {
  const picks = [];
  for (let tries = 0; tries < 3 && picks.length < count + 6; tries++) {
    const { items } = await discoverRandom({ kind, genre, decade, quality: false, maxPages: 120 });
    for (const it of shuffle(items).slice(0, 4)) {
      if (!picks.some((p) => p.id === it.id && p.type === it.type)) picks.push({ ...it, reason: `Al azar · ${it.year || 'sin fecha'}` });
    }
  }
  return picks;
}

/** Para el dado en modo "según mis gustos": elige al azar entre las mejores recomendaciones. */
export async function byTaste({ kind = 'all', genre = null, decade = '' } = {}) {
  const pool = await forYou({ kind, decade, genre, limit: 36 });
  return shuffle(pool.slice(0, 36));
}
