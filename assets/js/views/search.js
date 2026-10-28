import { icon } from '../icons.js';
import { searchMulti, searchType, norm, normList } from '../api.js';
import { esc, cardHTML, personCardHTML, skeletonCards, infinite, emptyHTML, debounce } from '../ui.js';

const TABS = { all: 'Todo', movie: 'Películas', tv: 'Series', anime: 'Anime', person: 'Personas' };

export default function search(el, ctx) {
  let q = (ctx.query.get('q') || '').trim();
  let tab = TABS[ctx.query.get('t')] ? ctx.query.get('t') : 'all';

  el.innerHTML = `<div class="page">
    <label class="search-field search-page-field">
      ${icon('search')}
      <input id="sp-input" type="search" placeholder="Película, serie, anime o actor…" value="${esc(q)}" autocomplete="off" enterkeyhint="search">
    </label>
    <header class="page-head" style="margin-top:10px"><div><span class="eyebrow">${icon('search')} Buscar</span><h1 id="sp-title">${q ? `«${esc(q)}»` : 'Buscar'}</h1></div></header>
    <div class="seg" id="sp-tabs">${Object.entries(TABS).map(([k, v]) => `<button data-t="${k}" class="${k === tab ? 'active' : ''}">${v}</button>`).join('')}</div>
    <p class="result-count" id="sp-count" style="margin-top:14px"></p>
    <div id="sp-results"></div>
    <div class="load-more" id="sp-more"></div>
  </div>`;

  const input = el.querySelector('#sp-input');
  const results = el.querySelector('#sp-results');
  const more = el.querySelector('#sp-more');
  const count = el.querySelector('#sp-count');
  let runId = 0;
  let io = null;

  const setUrl = () => history.replaceState(null, '', `#/buscar?q=${encodeURIComponent(q)}${tab !== 'all' ? `&t=${tab}` : ''}`);

  function start() {
    const my = ++runId;
    io?.disconnect();
    el.querySelector('#sp-title').innerHTML = q ? `«${esc(q)}»` : 'Buscar';
    count.textContent = '';
    more.innerHTML = '';
    if (q.length < 1) {
      results.innerHTML = emptyHTML('search', 'Busca lo que quieras', 'Escribe el nombre en español, en inglés o el original. Si hay varias versiones (remakes), añade el año: <b>carrie 1976</b>.');
      return;
    }
    results.innerHTML = `<div class="grid">${skeletonCards(12)}</div>`;
    const ym = q.match(/^(.*\S)\s+((?:19|20)\d{2})$/);
    const query = ym ? ym[1] : q;
    const year = ym ? ym[2] : '';
    let page = 0;
    let total = 1;
    let shown = 0;
    const seen = new Set();

    const fetchPage = (p) => {
      if (tab === 'movie' || tab === 'tv') return searchType(tab, query, p, undefined, year);
      if (tab === 'person') return searchType('person', query, p);
      return searchMulti(query, p);
    };

    const load = async () => {
      if (page >= total) return true;
      page++;
      more.innerHTML = '<span class="spinner"></span>';
      try {
        const data = await fetchPage(page);
        if (my !== runId || !ctx.alive()) return true;
        total = Math.min(data.total_pages || 1, 40);
        let html = '';
        if (tab === 'person') {
          const people = (data.results || []).filter((p) => !seen.has(p.id) && seen.add(p.id));
          html = people.map((p, i) => personCardHTML(p, i, (p.known_for || []).map((k) => k.title || k.name).slice(0, 2).join(', '))).join('');
          shown += people.length;
        } else {
          let items = tab === 'movie' || tab === 'tv' ? normList(data, tab) : normList(data);
          if (tab === 'anime') items = items.filter((it) => it.anime);
          if (year && tab === 'all') items.sort((a, b) => (b.year === year) - (a.year === year));
          items = items.filter((it) => !seen.has(`${it.type}:${it.id}`) && seen.add(`${it.type}:${it.id}`));
          html = items.map((it, i) => cardHTML(it, i)).join('');
          shown += items.length;
          if (page === 1 && tab === 'all') {
            const people = (data.results || []).filter((r) => r.media_type === 'person' && r.profile_path).slice(0, 8);
            if (people.length) {
              results.innerHTML = `<section class="row"><header class="row-head"><div><h2>${icon('user')}Personas</h2></div></header><div class="scroller"><div class="track people">${people.map((p, i) => personCardHTML(p, i, p.known_for_department === 'Acting' ? 'Actuación' : p.known_for_department === 'Directing' ? 'Dirección' : '')).join('')}</div></div></section><div class="grid" id="sp-grid"></div>`;
            }
          }
        }
        if (page === 1) {
          if (!results.querySelector('#sp-grid')) results.innerHTML = `<div class="grid" id="sp-grid"></div>`;
          count.textContent = data.total_results ? `${data.total_results.toLocaleString('es')} resultados${tab === 'anime' ? ' (filtrando anime)' : ''}` : '';
        }
        results.querySelector('#sp-grid').insertAdjacentHTML('beforeend', html);
        const done = page >= total;
        if (done && !shown) {
          results.innerHTML = emptyHTML('search', `Sin resultados para «${esc(q)}»`, tab === 'anime' ? 'Prueba en la pestaña <b>Todo</b>: puede que no esté marcado como anime.' : 'Revisa cómo está escrito o prueba con el título original.');
          count.textContent = '';
        }
        more.innerHTML = done && shown > 20 ? '<p class="end-note">No hay más resultados</p>' : '';
        // En "anime" muchas páginas pueden no tener nada: seguir cargando
        if (!done && tab === 'anime' && shown < 12) setTimeout(() => my === runId && load(), 0);
        return done;
      } catch (err) {
        if (my !== runId) return true;
        page--;
        more.innerHTML = '';
        if (page === 0) results.innerHTML = emptyHTML('info', 'No se pudo buscar', esc(err.message));
        return true;
      }
    };
    io = infinite(more, load, ctx);
  }

  el.querySelector('#sp-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]');
    if (!b || b.dataset.t === tab) return;
    tab = b.dataset.t;
    el.querySelectorAll('#sp-tabs button').forEach((x) => x.classList.toggle('active', x === b));
    setUrl();
    start();
  });
  const onType = debounce(() => {
    const v = input.value.trim();
    if (v === q) return;
    q = v;
    setUrl();
    start();
  }, 350);
  input.addEventListener('input', onType);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    }
  });
  if (!q && matchMedia('(max-width: 900px)').matches) setTimeout(() => input.focus(), 50);

  // Sincroniza el buscador de arriba con esta búsqueda
  const top = document.querySelector('#search-input');
  if (top && q) {
    top.value = q;
    top.closest('.search-field')?.classList.add('has-value');
  }
  start();
}
