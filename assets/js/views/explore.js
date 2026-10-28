import { icon } from '../icons.js';
import { discover, normList, MOVIE_GENRES, TV_GENRES, animeParams, animeMovieParams } from '../api.js';
import { esc, cardHTML, skeletonCards, infinite, emptyHTML } from '../ui.js';

const KINDS = {
  movie: { label: 'Películas', ic: 'film', type: 'movie' },
  tv: { label: 'Series', ic: 'tv', type: 'tv' },
  anime: { label: 'Anime', ic: 'flame', type: 'tv' },
  'anime-movie': { label: 'Películas de anime', ic: 'sparkles', type: 'movie' },
};
const SORTS = {
  popular: 'Populares',
  top: 'Mejor valoradas',
  new: 'Más recientes',
  votes: 'Más votadas',
};
const DECADES = { '': 'Cualquier época', 2020: 'Años 2020', 2010: 'Años 2010', 2000: 'Años 2000', 1990: 'Años 90', 1980: 'Años 80', old: 'Clásicos (antes de 1980)' };
const ANIME_GENRES = { 10759: 'Acción y aventura', 35: 'Comedia', 18: 'Drama', 10765: 'Fantasía y ciencia ficción', 9648: 'Misterio', 80: 'Crimen', 10751: 'Familia' };

function buildParams(kind, { g, sort, decade }) {
  const type = KINDS[kind].type;
  const today = new Date().toISOString().slice(0, 10);
  const dateF = type === 'movie' ? 'primary_release_date' : 'first_air_date';
  let p = {};
  if (kind === 'anime') p = animeParams();
  if (kind === 'anime-movie') p = animeMovieParams();
  if (g) p.with_genres = p.with_genres ? `${p.with_genres},${g}` : g;
  if (sort === 'top') Object.assign(p, { sort_by: 'vote_average.desc', 'vote_count.gte': kind.startsWith('anime') ? 150 : 600 });
  else if (sort === 'new') Object.assign(p, { sort_by: `${dateF}.desc`, [`${dateF}.lte`]: today, 'vote_count.gte': 15 });
  else if (sort === 'votes') p.sort_by = 'vote_count.desc';
  else p.sort_by = 'popularity.desc';
  if (decade) {
    const [a, b] = decade === 'old' ? ['1900', '1979'] : [decade, String(Number(decade) + 9)];
    p[`${dateF}.gte`] = `${a}-01-01`;
    const lte = `${b}-12-31`;
    p[`${dateF}.lte`] = p[`${dateF}.lte`] && p[`${dateF}.lte`] < lte ? p[`${dateF}.lte`] : lte;
  }
  return { type, params: p };
}

export default function explore(el, ctx) {
  const kind = KINDS[ctx.params[0]] ? ctx.params[0] : 'movie';
  const q = ctx.query;
  const state = { g: q.get('g') || '', sort: q.get('sort') || 'popular', decade: q.get('decade') || '' };
  const genres = kind === 'movie' ? MOVIE_GENRES : kind === 'tv' ? TV_GENRES : kind === 'anime' ? ANIME_GENRES : { 28: 'Acción', 12: 'Aventura', 35: 'Comedia', 18: 'Drama', 14: 'Fantasía', 10749: 'Romance', 878: 'Ciencia ficción' };
  const href = (patch) => {
    const s = { ...state, ...patch };
    const qs = new URLSearchParams(Object.entries(s).filter(([k, v]) => v && !(k === 'sort' && v === 'popular'))).toString();
    return `#/explorar/${kind}${qs ? `?${qs}` : ''}`;
  };

  el.innerHTML = `<div class="page">
    <header class="page-head">
      <div><span class="eyebrow">${icon('compass')} Explorar</span><h1>${KINDS[kind].label}</h1><p>Todo el catálogo de TMDB. Baja y se siguen cargando más.</p></div>
    </header>
    <div class="seg" role="tablist">${Object.entries(KINDS).map(([k, v]) => `<button data-kind="${k}" class="${k === kind ? 'active' : ''}">${icon(v.ic)}${v.label}</button>`).join('')}</div>
    <div class="toolbar" style="margin-top:16px">
      <select class="select" id="ex-sort" aria-label="Ordenar">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}" ${k === state.sort ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <select class="select" id="ex-decade" aria-label="Época">${Object.entries(DECADES).map(([k, v]) => `<option value="${k}" ${k === state.decade ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <span class="grow"></span>
      <span class="result-count" id="ex-count" style="margin:0"></span>
    </div>
    <div class="chips" style="margin-bottom:20px">
      <a class="chip ${!state.g ? 'active' : ''}" href="${href({ g: '' })}">Todos</a>
      ${Object.entries(genres).map(([id, name]) => `<a class="chip ${state.g === id ? 'active' : ''}" href="${href({ g: id })}">${esc(name)}</a>`).join('')}
    </div>
    <div class="grid" id="ex-grid">${skeletonCards(12)}</div>
    <div class="load-more" id="ex-more"></div>
  </div>`;

  el.querySelector('.seg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-kind]');
    if (b) location.hash = `#/explorar/${b.dataset.kind}`;
  });
  el.querySelector('#ex-sort').addEventListener('change', (e) => (location.hash = href({ sort: e.target.value })));
  el.querySelector('#ex-decade').addEventListener('change', (e) => (location.hash = href({ decade: e.target.value })));

  const grid = el.querySelector('#ex-grid');
  const more = el.querySelector('#ex-more');
  const { type, params } = buildParams(kind, state);
  let page = 0;
  let total = 1;
  let count = 0;
  const seen = new Set();

  const load = async () => {
    if (page >= total || page >= 500) return true;
    page++;
    more.innerHTML = '<span class="spinner"></span>';
    try {
      const data = await discover(type, { ...params, page });
      if (!ctx.alive()) return true;
      total = data.total_pages || 1;
      const items = normList(data, type).filter((it) => !seen.has(it.id) && seen.add(it.id));
      if (page === 1) {
        grid.innerHTML = '';
        el.querySelector('#ex-count').textContent = data.total_results ? `${data.total_results.toLocaleString('es')} títulos` : '';
      }
      grid.insertAdjacentHTML('beforeend', items.map((it, i) => cardHTML(it, i)).join(''));
      count += items.length;
      if (!count) grid.innerHTML = emptyHTML('compass', 'Nada por aquí', 'Prueba con otro género o época.');
      const done = page >= total || page >= 500;
      more.innerHTML = done && count ? '<p class="end-note">Llegaste al final de la lista</p>' : '';
      return done;
    } catch (err) {
      page--;
      more.innerHTML = `<button class="btn" id="ex-retry">${icon('refresh')} Reintentar</button>`;
      if (page === 0) grid.innerHTML = emptyHTML('info', 'No se pudo cargar', esc(err.message));
      more.querySelector('#ex-retry').onclick = () => {
        more.innerHTML = '';
        infinite(more, load, ctx);
      };
      return true; // se detiene hasta que toques "Reintentar"
    }
  };
  infinite(more, load, ctx);
}
