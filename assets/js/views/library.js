import { icon } from '../icons.js';
import { genreName } from '../api.js';
import { library, watchedEpisodes } from '../store.js';
import { esc, cardHTML, posterHTML, starsHTML, displayTitle, typeLabel, fmtDate, emptyHTML, parseDate } from '../ui.js';

const TABS = {
  all: { label: 'Todo', ic: 'library' },
  watching: { label: 'Viendo', ic: 'eye' },
  watchlist: { label: 'Por ver', ic: 'bookmark' },
  watched: { label: 'Vistas', ic: 'check' },
  favorites: { label: 'Favoritas', ic: 'heart' },
  notes: { label: 'Por qué me gustó', ic: 'quote' },
  dropped: { label: 'Abandonadas', ic: 'ban' },
  diary: { label: 'Diario', ic: 'calendar' },
  stats: { label: 'Estadísticas', ic: 'chart' },
};
const FILTERS = { all: 'Todo', movie: 'Películas', tv: 'Series', anime: 'Anime' };
const SORTS = { recent: 'Recientes', rating: 'Mi puntuación', title: 'Título', year: 'Año' };

const match = (tab) => (e) => {
  if (tab === 'all') return true;
  if (tab === 'favorites') return e.favorite;
  if (tab === 'notes') return e.note?.trim() || e.tags?.length;
  return e.status === tab;
};
const kindOk = (f) => (e) => f === 'all' || (f === 'anime' ? e.anime : f === 'movie' ? e.type === 'movie' && !e.anime : e.type === 'tv' && !e.anime);

export default function libraryView(el, ctx) {
  const q = ctx.query;
  const tab = TABS[q.get('tab')] ? q.get('tab') : 'all';
  const f = FILTERS[q.get('f')] ? q.get('f') : 'all';
  const sort = SORTS[q.get('sort')] ? q.get('sort') : 'recent';
  const all = library.all();
  const counts = Object.fromEntries(Object.keys(TABS).map((k) => [k, all.filter(match(k)).length]));
  const href = (p) => {
    const s = { tab, f, sort, ...p };
    return `#/biblioteca?${new URLSearchParams(Object.entries(s).filter(([k, v]) => !(k === 'f' && v === 'all') && !(k === 'sort' && v === 'recent')))}`;
  };

  el.innerHTML = `<div class="page">
    <header class="page-head">
      <div><span class="eyebrow">${icon('library')} Mi biblioteca</span><h1>Tu bóveda</h1><p>${all.length ? `${all.length} título${all.length > 1 ? 's' : ''} guardados en este dispositivo.` : 'Aquí se guarda todo lo que marques.'} <a href="#/ajustes" style="color:var(--gold-2)">Copia de seguridad</a></p></div>
    </header>
    <div class="chips lib-tabs">${Object.entries(TABS).map(([k, v]) => `<a class="chip ${k === tab ? 'active' : ''}" href="${href({ tab: k })}">${icon(v.ic)}${v.label}${!['diary', 'stats'].includes(k) ? ` <span class="n">${counts[k]}</span>` : ''}</a>`).join('')}</div>
    ${['diary', 'stats'].includes(tab) ? '' : `<div class="toolbar">
      <div class="seg">${Object.entries(FILTERS).map(([k, v]) => `<a href="${href({ f: k })}" class="${k === f ? 'active' : ''}">${v}</a>`).join('')}</div>
      <span class="grow"></span>
      <select class="select" id="lib-sort" aria-label="Ordenar">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}" ${k === sort ? 'selected' : ''}>${v}</option>`).join('')}</select>
    </div>`}
    <div id="lib-body"></div>
  </div>`;
  el.querySelector('#lib-sort')?.addEventListener('change', (e) => (location.hash = href({ sort: e.target.value })));

  const body = el.querySelector('#lib-body');
  if (tab === 'diary') return paintDiary(body, all);
  if (tab === 'stats') return paintStats(body, all);

  let items = all.filter(match(tab)).filter(kindOk(f));
  const sorters = {
    recent: (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
    rating: (a, b) => (b.rating || 0) - (a.rating || 0) || (b.favorite - a.favorite),
    title: (a, b) => displayTitle(a).localeCompare(displayTitle(b), 'es'),
    year: (a, b) => (b.year || '').localeCompare(a.year || ''),
  };
  items.sort(sorters[sort]);

  if (!items.length) {
    const msgs = {
      all: ['Tu bóveda está vacía', 'Busca una película o serie y márcala como vista, por ver o favorita.'],
      watching: ['No estás viendo nada', 'En la ficha de una serie marca <b>Viendo</b> o marca episodios.'],
      watchlist: ['Tu lista Por ver está vacía', 'Usa el botón del marcador en cualquier póster.'],
      watched: ['Aún no marcas nada como visto', 'Usa el botón ✓ en cualquier póster.'],
      favorites: ['Sin favoritas todavía', 'Toca el ❤ en las que más te gustaron. Así afinas tus recomendaciones.'],
      notes: ['Sin notas todavía', 'En la ficha de una película escribe <b>por qué te gustó</b>: aquí las tendrás todas juntas para cuando quieras volver a verlas.'],
      dropped: ['Nada abandonado', '¡Bien ahí!'],
    };
    body.innerHTML = emptyHTML(TABS[tab].ic, msgs[tab][0], msgs[tab][1], `<a class="btn btn-primary" href="#/explorar/movie">${icon('compass')} Explorar</a>`);
    return;
  }

  if (tab === 'notes') {
    body.innerHTML = `<div class="note-list">${items.map((e, i) => `
      <article class="note-card" style="--i:${Math.min(i, 12)}">
        <a href="#/titulo/${e.type}/${e.id}">${posterHTML(e, 'w185')}</a>
        <div style="min-width:0;flex:1">
          <h3><a href="#/titulo/${e.type}/${e.id}">${esc(displayTitle(e))}</a></h3>
          <div style="display:flex;align-items:center;gap:10px;margin-top:4px;font-size:12.5px;color:var(--dim)">${e.rating ? starsHTML(e.rating, '', false).replace('class="stars ', 'class="stars sm ') : ''}<span>${[e.year, typeLabel(e)].filter(Boolean).join(' · ')}</span>${e.favorite ? `<span style="color:var(--rose)">${icon('heart')}</span>` : ''}</div>
          ${e.note?.trim() ? `<blockquote>${esc(e.note.trim())}</blockquote>` : ''}
          ${e.tags?.length ? `<div class="tags">${e.tags.map((t) => `<span class="tag on">${esc(t)}</span>`).join('')}</div>` : ''}
        </div>
      </article>`).join('')}</div>`;
    return;
  }

  body.innerHTML = `<div class="grid">${items.map((e, i) => {
    let sub;
    if (e.type === 'tv' && watchedEpisodes(e)) sub = `${watchedEpisodes(e)} eps vistos · ${typeLabel(e)}`;
    else if (e.dates?.length) sub = `Vista ${fmtDate(e.dates[e.dates.length - 1], true)}`;
    return cardHTML(e, i, sub ? { sub } : {});
  }).join('')}</div>`;
}

function paintDiary(body, all) {
  const rows = [];
  for (const e of all) for (const d of e.dates || []) rows.push({ e, d });
  rows.sort((a, b) => b.d.localeCompare(a.d));
  if (!rows.length) {
    body.innerHTML = emptyHTML('calendar', 'Tu diario está vacío', 'Cada vez que marcas una película como vista se apunta la fecha. También puedes añadir fechas en la ficha (por ejemplo, si la volviste a ver).');
    return;
  }
  const monthFmt = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' });
  const wd = new Intl.DateTimeFormat('es', { weekday: 'short' });
  const groups = new Map();
  for (const r of rows) {
    const k = r.d.slice(0, 7);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  body.innerHTML = [...groups.entries()].map(([k, list]) => `
    <section class="diary-month"><h3>${(m => m.charAt(0).toUpperCase() + m.slice(1))(monthFmt.format(parseDate(`${k}-01`)))} · ${list.length}</h3>
      ${list.map(({ e, d }) => `<a class="diary-row" href="#/titulo/${e.type}/${e.id}">
        <div class="diary-day"><b>${Number(d.slice(8))}</b><small>${wd.format(parseDate(d))}</small></div>
        ${posterHTML(e, 'w92')}
        <div class="grow"><strong>${esc(displayTitle(e))}</strong><span>${[e.year, typeLabel(e)].filter(Boolean).join(' · ')}${e.dates.indexOf(d) > 0 ? ' · la volviste a ver' : ''}</span></div>
        ${e.rating ? starsHTML(e.rating, '', false).replace('class="stars ', 'class="stars sm ') : ''}
        ${e.favorite ? `<span style="color:var(--rose)">${icon('heart')}</span>` : ''}
      </a>`).join('')}
    </section>`).join('');
}

function paintStats(body, all) {
  if (!all.length) {
    body.innerHTML = emptyHTML('chart', 'Sin datos todavía', 'Cuando marques películas y series verás aquí tus estadísticas.');
    return;
  }
  const watchedMovies = all.filter((e) => e.type === 'movie' && e.status === 'watched');
  const series = all.filter((e) => e.type === 'tv' && !e.anime && (e.status === 'watched' || e.status === 'watching' || watchedEpisodes(e)));
  const anime = all.filter((e) => e.anime && (e.status === 'watched' || e.status === 'watching' || watchedEpisodes(e)));
  const eps = all.reduce((a, e) => a + watchedEpisodes(e), 0);
  const minutes = watchedMovies.reduce((a, e) => a + (e.runtime || 110) * Math.max(1, e.dates?.length || 1), 0) + all.filter((e) => e.type === 'tv').reduce((a, e) => a + watchedEpisodes(e) * (e.runtime || (e.anime ? 24 : 45)), 0);
  const rated = all.filter((e) => e.rating);
  const avg = rated.length ? rated.reduce((a, e) => a + e.rating, 0) / rated.length / 2 : 0;

  const gCount = {};
  for (const e of all.filter((x) => x.status === 'watched' || x.status === 'watching' || x.favorite)) {
    for (const g of e.genres || []) {
      if (g === 16 && e.anime) continue;
      const n = genreName(g, e.type);
      if (n) gCount[n] = (gCount[n] || 0) + 1;
    }
  }
  const topG = Object.entries(gCount).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxG = topG[0]?.[1] || 1;

  const dist = Array.from({ length: 10 }, (_, i) => rated.filter((e) => e.rating === i + 1).length);
  const maxD = Math.max(1, ...dist);

  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ k, label: new Intl.DateTimeFormat('es', { month: 'short' }).format(d), n: all.reduce((a, e) => a + (e.dates || []).filter((x) => x.startsWith(k)).length, 0) });
  }
  const maxM = Math.max(1, ...months.map((m) => m.n));

  const stats = [
    [watchedMovies.length, 'películas vistas'],
    [series.length, 'series'],
    [anime.length, 'anime'],
    [eps, 'episodios marcados'],
    [`${Math.round(minutes / 60)} h`, 'frente a la pantalla (aprox.)'],
    [avg ? avg.toFixed(1).replace('.', ',') : '—', 'tu nota media ★'],
  ];
  body.innerHTML = `
    <div class="stats-grid">${stats.map(([v, l], i) => `<div class="stat" style="--i:${i}"><b>${v}</b><span>${l}</span></div>`).join('')}</div>
    <div class="detail-body" style="padding:0;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr))">
      <section class="panel"><h3>${icon('flame')} Tus géneros</h3>
        ${topG.length ? `<div class="bars">${topG.map(([n, c], i) => `<div class="bar"><span>${esc(n)}</span><div class="bar-track"><i style="--w:${(c / maxG) * 100}%;--i:${i}"></i></div><b>${c}</b></div>`).join('')}</div>` : '<p style="color:var(--dim)">Marca algunas como vistas para verlo.</p>'}
      </section>
      <section class="panel"><h3>${icon('calendar')} Vistas por mes</h3>
        <div class="chart-cols">${months.map((m, i) => `<div class="chart-col"><b>${m.n || ''}</b><i style="--h:${(m.n / maxM) * 100}%;--i:${i}"></i><span>${m.label}</span></div>`).join('')}</div>
      </section>
      <section class="panel"><h3>${icon('star')} Cómo puntúas</h3>
        ${rated.length ? `<div class="chart-cols">${dist.map((n, i) => `<div class="chart-col"><b>${n || ''}</b><i style="--h:${(n / maxD) * 100}%;--i:${i}"></i><span>${String((i + 1) / 2).replace('.', ',')}</span></div>`).join('')}</div>` : '<p style="color:var(--dim)">Aún no has puntuado nada.</p>'}
      </section>
    </div>`;
}
