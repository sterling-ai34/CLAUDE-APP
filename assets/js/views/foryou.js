import { icon } from '../icons.js';
import { tmdb, norm, IMG, MOVIE_GENRES, trending, normList, genreName } from '../api.js';
import { library, keyOf } from '../store.js';
import { seeds, byTaste, surprise, random, topGenres } from '../recs.js';
import { esc, reg, rowHTML, fillRow, posterHTML, displayTitle, typeLabel, emptyHTML, reduceMotion } from '../ui.js';

const MODES = {
  taste: { label: 'Según mis gustos', ic: 'heart', hint: 'Elige entre las recomendaciones de lo que marcaste como favorito o puntuaste alto.' },
  surprise: { label: 'Sorpréndeme', ic: 'sparkles', hint: 'Al azar, pero dentro de los géneros que más te gustan y solo títulos bien valorados.' },
  random: { label: 'Aleatorio total', ic: 'dice', hint: 'Cualquier cosa del catálogo. Solo respeta los filtros que pongas.' },
};
const KINDS = { all: 'Todo', movie: 'Películas', tv: 'Series', anime: 'Anime' };
const DECADES = { '': 'Cualquier época', 2020: '2020s', 2010: '2010s', 2000: '2000s', 1990: '90s', 1980: '80s', old: 'Clásicos' };
const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };

const state = { mode: null, kind: 'all', genre: '', decade: '' };

function face(n) {
  return `<div class="face f${n}">${Array.from({ length: 9 }, (_, i) => (PIPS[n].includes(i + 1) ? '<i></i>' : '<span></span>')).join('')}</div>`;
}

export default function foryou(el, ctx) {
  const S = seeds();
  if (!state.mode) state.mode = S.length ? 'taste' : 'surprise';
  const favGenres = topGenres('all', 3).map((g) => genreName(g)).filter(Boolean);

  el.innerHTML = `<div class="page">
    <header class="page-head"><div>
      <span class="eyebrow">${icon('sparkles')} Para ti</span>
      <h1>¿Qué veo hoy?</h1>
      <p>${S.length ? `Aprendo de lo que te gusta: ${S.length} título${S.length > 1 ? 's' : ''} marcados${favGenres.length ? ` · tus géneros: <b>${favGenres.map(esc).join(', ')}</b>` : ''}.` : 'Marca con ❤ o puntúa algunas películas que te gustaron y las recomendaciones se vuelven tuyas.'}</p>
    </div></header>

    <section class="dice-panel">
      <div class="dice-controls">
        <div class="seg" id="fy-modes">${Object.entries(MODES).map(([k, v]) => `<button data-mode="${k}" class="${k === state.mode ? 'active' : ''}">${icon(v.ic)}${v.label}</button>`).join('')}</div>
        <div class="dice-filters">
          <div class="seg" id="fy-kinds">${Object.entries(KINDS).map(([k, v]) => `<button data-kind="${k}" class="${k === state.kind ? 'active' : ''}">${v}</button>`).join('')}</div>
          <select class="select" id="fy-genre" aria-label="Género"><option value="">Cualquier género</option>${Object.entries(MOVIE_GENRES).filter(([id]) => !['16', '10770', '99'].includes(id)).map(([id, n]) => `<option value="${id}" ${state.genre === id ? 'selected' : ''}>${n}</option>`).join('')}</select>
          <select class="select" id="fy-decade" aria-label="Época">${Object.entries(DECADES).map(([k, v]) => `<option value="${k}" ${state.decade === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        </div>
      </div>
      <div class="dice-stage">
        <div class="cube-wrap" id="fy-dice" role="button" tabindex="0" aria-label="Tirar el dado"><div class="cube" id="fy-cube">${[1, 2, 3, 4, 5, 6].map(face).join('')}</div></div>
        <button class="btn btn-primary btn-lg" id="fy-roll">${icon('dice')} Tirar el dado</button>
        <p class="dice-hint" id="fy-hint">${MODES[state.mode].hint}</p>
      </div>
      <div class="dice-results" id="fy-results"></div>
    </section>

    <div id="fy-rows"></div>
  </div>`;

  const results = el.querySelector('#fy-results');
  let pool = [];
  let shown = [];
  let rolling = false;

  const pickHTML = (it, i) => {
    const k = reg(it);
    const e = library.get(k);
    const bd = IMG(it.backdrop, 'w780');
    return `<article class="pick" style="--i:${i}" data-slot="${i}">
      <a class="pick-media" href="#/titulo/${it.type}/${it.id}">${bd ? `<img src="${bd}" alt="" loading="lazy">` : ''}${posterHTML(it, 'w185')}</a>
      <div class="pick-body">
        <span class="pick-reason">${icon(state.mode === 'taste' ? 'heart' : state.mode === 'surprise' ? 'sparkles' : 'dice')}${esc(it.reason || '')}</span>
        <h3><a href="#/titulo/${it.type}/${it.id}">${esc(displayTitle(it))}</a></h3>
        <span style="font-size:12.5px;color:var(--dim)">${[it.year, typeLabel(it), it.vote ? `⭐ ${it.vote.toFixed(1)}` : ''].filter(Boolean).join(' · ')}</span>
        <p>${esc(it.overview || 'Sin sinopsis.')}</p>
        <div class="pick-actions">
          <button class="btn btn-sm ${e?.status === 'watchlist' ? 'on' : ''}" data-act="status" data-val="watchlist" data-key="${k}">${icon('bookmark')} Por ver</button>
          <button class="btn btn-sm" data-act="status" data-val="watched" data-key="${k}" data-reroll="${i}">${icon('check')} Ya la vi</button>
          <button class="btn btn-sm btn-ghost" data-reroll="${i}">${icon('refresh')} Otra</button>
        </div>
      </div>
    </article>`;
  };

  const getPool = async () => {
    const opts = { kind: state.kind, genre: state.genre || null, decade: state.decade };
    if (state.mode === 'taste') {
      const p = await byTaste(opts);
      if (p.length >= 3) return p;
      el.querySelector('#fy-hint').innerHTML = 'Todavía no tengo suficientes gustos tuyos con esos filtros, así que te sorprendo con lo mejor valorado. Marca más favoritas ❤ para afinar.';
      return surprise(opts);
    }
    return state.mode === 'surprise' ? surprise(opts) : random(opts);
  };

  const roll = async () => {
    if (rolling) return;
    rolling = true;
    const cube = el.querySelector('#fy-cube');
    const btn = el.querySelector('#fy-roll');
    btn.disabled = true;
    cube.classList.remove('rolling');
    void cube.offsetWidth;
    cube.classList.add('rolling');
    results.style.opacity = '0.35';
    const wait = new Promise((r) => setTimeout(r, reduceMotion() ? 0 : 1100));
    try {
      const [p] = await Promise.all([getPool(), wait]);
      if (!ctx.alive()) return;
      pool = p;
      shown = pool.slice(0, 3);
      pool = pool.slice(3);
      results.innerHTML = shown.length ? shown.map(pickHTML).join('') : emptyHTML('dice', 'No salió nada', 'Prueba quitando algún filtro.');
    } catch (err) {
      results.innerHTML = emptyHTML('info', 'No se pudo tirar el dado', esc(err.message));
    } finally {
      results.style.opacity = '';
      btn.disabled = false;
      rolling = false;
    }
  };

  const reroll = async (slot) => {
    if (!pool.length) {
      try {
        pool = (await getPool()).filter((x) => !shown.some((s) => s.id === x.id && s.type === x.type));
      } catch { return; }
    }
    const next = pool.shift();
    if (!next || !ctx.alive()) return;
    shown[slot] = next;
    const old = results.querySelector(`[data-slot="${slot}"]`);
    if (old) {
      const tmp = document.createElement('div');
      tmp.innerHTML = pickHTML(next, slot);
      tmp.firstElementChild.style.setProperty('--i', 0);
      old.replaceWith(tmp.firstElementChild);
    }
  };

  el.querySelector('#fy-roll').addEventListener('click', roll);
  el.querySelector('#fy-dice').addEventListener('click', roll);
  el.querySelector('#fy-dice').addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), roll()));
  el.querySelector('#fy-modes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]');
    if (!b) return;
    state.mode = b.dataset.mode;
    el.querySelectorAll('#fy-modes button').forEach((x) => x.classList.toggle('active', x === b));
    el.querySelector('#fy-hint').textContent = MODES[state.mode].hint;
    pool = [];
  });
  el.querySelector('#fy-kinds').addEventListener('click', (e) => {
    const b = e.target.closest('[data-kind]');
    if (!b) return;
    state.kind = b.dataset.kind;
    el.querySelectorAll('#fy-kinds button').forEach((x) => x.classList.toggle('active', x === b));
    pool = [];
  });
  el.querySelector('#fy-genre').addEventListener('change', (e) => { state.genre = e.target.value; pool = []; });
  el.querySelector('#fy-decade').addEventListener('change', (e) => { state.decade = e.target.value; pool = []; });
  results.addEventListener('click', (e) => {
    const r = e.target.closest('[data-reroll]');
    if (r) setTimeout(() => reroll(Number(r.dataset.reroll)), r.dataset.act ? 350 : 0);
  });

  // Filas "Porque te gustó X"
  const rows = el.querySelector('#fy-rows');
  if (S.length) {
    const picked = S.slice(0, 5);
    rows.innerHTML = picked.map((s, i) => rowHTML(`because-${i}`, `Porque te gustó ${displayTitle(s)}`, { icon: 'heart', link: `#/titulo/${s.type}/${s.id}` })).join('');
    const seen = new Set(library.all().filter((e) => e.status === 'watched' || e.status === 'dropped').map((e) => e.key));
    picked.forEach((s, i) => fillRow(rows, `because-${i}`, async () => {
      const r = await tmdb(`/${s.type}/${s.id}/recommendations`);
      return (r.results || []).map((x) => norm(x, x.media_type || s.type)).filter((x) => !seen.has(keyOf(x)));
    }));
  } else {
    rows.innerHTML = `${rowHTML('starter', 'Empieza aquí: marca con ❤ las que ya viste y te gustaron', { icon: 'heart', sub: 'Pasa el ratón (o toca en el móvil) los botones de cada póster' })}`;
    fillRow(rows, 'starter', async () => normList(await trending('all', 'week')));
  }
}
