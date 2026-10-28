import { icon } from '../icons.js';
import { trending, nowPlaying, upcoming, discover, topRated, normList, IMG, animeParams, animeMovieParams, isoDaysFromNow, genreName } from '../api.js';
import { library } from '../store.js';
import { forYou, seeds } from '../recs.js';
import { followInfo, epLabel } from '../notify.js';
import { esc, rowHTML, fillRow, cardHTML, reg, displayTitle, typeLabel, fmtDate, relDay, daysUntil, reduceMotion } from '../ui.js';

const HERO_MS = 8000;

export default function home(el, ctx) {
  const hasSeeds = seeds().length > 0;
  const watching = library.all().filter((e) => e.status === 'watching').sort((a, b) => b.updatedAt - a.updatedAt);
  const watchlist = library.all().filter((e) => e.status === 'watchlist').sort((a, b) => b.updatedAt - a.updatedAt);
  const followed = library.all().filter((e) => e.following);

  el.innerHTML = `<div class="page">
    <section class="hero" id="hero"><div class="hero-skel skel"></div></section>
    ${followed.length ? rowHTML('follow', 'Lo que sigues', { icon: 'bell', sub: 'Próximos episodios y estrenos', link: '#/siguiendo' }) : ''}
    ${watching.length ? rowHTML('watching', 'Sigue viendo', { icon: 'eye', link: '#/biblioteca?tab=watching' }) : ''}
    ${hasSeeds ? rowHTML('foryou', 'Para ti', { icon: 'sparkles', sub: 'Basado en lo que te gustó', link: '#/para-ti' }) : ''}
    ${rowHTML('trending', 'Tendencias de la semana', { icon: 'flame' })}
    ${rowHTML('now', 'En cines ahora', { icon: 'ticket' })}
    ${rowHTML('upcoming', 'Próximos estrenos', { icon: 'calendar', sub: 'Toca la campana en la ficha para que te avise' })}
    ${rowHTML('tv', 'Series del momento', { icon: 'tv', link: '#/explorar/tv' })}
    ${rowHTML('anime', 'Anime en emisión', { icon: 'radio', sub: 'Episodios nuevos esta temporada', link: '#/explorar/anime' })}
    ${watchlist.length ? rowHTML('watchlist', 'Tu lista Por ver', { icon: 'bookmark', link: '#/biblioteca?tab=watchlist' }) : ''}
    ${rowHTML('animemovies', 'Películas de anime imprescindibles', { icon: 'film', link: '#/explorar/anime-movie' })}
    ${rowHTML('top', 'Las mejor valoradas de la historia', { icon: 'star', link: '#/explorar/movie?sort=top' })}
  </div>`;

  hero(el, ctx);

  if (followed.length) {
    fillRow(el, 'follow', async () => {
      const infos = await Promise.all(followed.map(async (e) => ({ e, v: await followInfo(e).catch(() => null) })));
      const score = ({ v }) => (v?.anilist ? v.anilist.airingAt * 1000 : v?.next?.date ? new Date(v.next.date).getTime() : v?.release ? new Date(v.release).getTime() : Infinity);
      return infos.sort((a, b) => score(a) - score(b));
    }, ({ e, v }, i) => {
      let sub = v?.statusEs || typeLabel(e);
      let label = '';
      if (v?.anilist) {
        label = `Ep. ${v.anilist.episode} · ${relDayMs(v.anilist.airingAt * 1000)}`;
        sub = `<span class="hl-violet">Ep. ${v.anilist.episode} ${fmtDate(v.anilist.airingAt * 1000, true)}</span>`;
      } else if (v?.next?.date) {
        label = `${epLabel(v.next)} · ${relDay(v.next.date)}`;
        sub = `<span class="hl-violet">${epLabel(v.next)} · ${fmtDate(v.next.date, true)}</span>`;
      } else if (v?.release && daysUntil(v.release) > 0) {
        label = `Estreno ${relDay(v.release)}`;
        sub = `<span class="hl-violet">Estreno ${fmtDate(v.release, true)}</span>`;
      }
      return cardHTML(e, i, { label, subHTML: sub });
    });
  }
  if (watching.length) fillRow(el, 'watching', async () => watching, (e, i) => cardHTML(e, i));
  if (watchlist.length) fillRow(el, 'watchlist', async () => watchlist, (e, i) => cardHTML(e, i));
  if (hasSeeds) fillRow(el, 'foryou', () => forYou({ limit: 24 }), (it, i) => cardHTML(it, i, { reason: it.reason }));

  fillRow(el, 'trending', async () => normList(await trending('all', 'week')));
  fillRow(el, 'now', async () => normList(await nowPlaying(), 'movie'));
  fillRow(el, 'upcoming', async () => {
    const [a, b] = await Promise.all([upcoming(1), upcoming(2).catch(() => ({ results: [] }))]);
    const seen = new Set();
    return [...normList(a, 'movie'), ...normList(b, 'movie')]
      .filter((it) => it.date && daysUntil(it.date) >= 0 && !seen.has(it.id) && seen.add(it.id))
      .sort((x, y) => x.date.localeCompare(y.date));
  }, (it, i) => cardHTML(it, i, { label: relDay(it.date), sub: `Estreno: ${fmtDate(it.date, true)}` }));
  fillRow(el, 'tv', async () => normList(await trending('tv', 'week'), 'tv'));
  fillRow(el, 'anime', async () => normList(await discover('tv', animeParams({ sort_by: 'popularity.desc', 'air_date.gte': isoDaysFromNow(-10), 'air_date.lte': isoDaysFromNow(14) })), 'tv'));
  fillRow(el, 'animemovies', async () => normList(await discover('movie', animeMovieParams({ sort_by: 'vote_count.desc' })), 'movie'));
  fillRow(el, 'top', async () => normList(await topRated('movie'), 'movie'));
}

function relDayMs(ms) {
  const d = new Date(ms);
  const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return relDay(s);
}

async function hero(el, ctx) {
  const box = el.querySelector('#hero');
  let items;
  try {
    items = normList(await trending('all', 'day')).filter((it) => it.backdrop && it.overview).slice(0, 7);
  } catch (err) {
    box.remove();
    return;
  }
  if (!ctx.alive() || !items.length) return;
  items.forEach(reg);
  box.style.setProperty('--dur', `${HERO_MS}ms`);
  box.innerHTML = `
    ${items.map((it, i) => `
      <div class="hero-slide ${i === 0 ? 'active' : ''}" data-i="${i}">
        <div class="hero-bg" style="background-image:url('${IMG(it.backdrop, 'w1280')}')"></div>
        <div class="hero-shade"></div>
        <div class="hero-content">
          <span class="hero-tag">${icon('flame')} Tendencia hoy · ${typeLabel(it)}</span>
          <h2>${esc(displayTitle(it))}</h2>
          <div class="hero-meta">
            ${it.vote ? `<span class="star">${icon('star')} ${it.vote.toFixed(1)}</span>` : ''}
            ${it.year ? `<span>${it.year}</span>` : ''}
            <span>${esc(it.genres.slice(0, 3).map((g) => genreName(g, it.type)).filter(Boolean).join(' · '))}</span>
          </div>
          <p class="hero-overview">${esc(it.overview)}</p>
          <div class="hero-actions">
            <a class="btn btn-primary btn-lg" href="#/titulo/${it.type}/${it.id}">${icon('info')} Ver ficha</a>
            <button class="btn btn-ghost btn-lg" data-act="status" data-val="watchlist" data-key="${it.type}:${it.id}">${icon('bookmark')} Por ver</button>
          </div>
        </div>
      </div>`).join('')}
    <div class="hero-nav">
      <button class="hero-arrow" data-hero="-1" aria-label="Anterior">${icon('left')}</button>
      ${items.map((_, i) => `<button class="hero-dot ${i === 0 ? 'active' : ''}" data-dot="${i}" aria-label="Ir a ${i + 1}"></button>`).join('')}
      <button class="hero-arrow" data-hero="1" aria-label="Siguiente">${icon('right')}</button>
    </div>`;

  let idx = 0;
  let timer = null;
  const show = (n) => {
    idx = (n + items.length) % items.length;
    box.querySelectorAll('.hero-slide').forEach((s, i) => s.classList.toggle('active', i === idx));
    box.querySelectorAll('.hero-dot').forEach((d, i) => {
      d.classList.toggle('active', i === idx);
    });
    restart();
  };
  const restart = () => {
    clearTimeout(timer);
    if (reduceMotion()) return;
    timer = setTimeout(() => show(idx + 1), HERO_MS);
  };
  box.addEventListener('click', (e) => {
    const d = e.target.closest('[data-dot]');
    const a = e.target.closest('[data-hero]');
    if (d) show(Number(d.dataset.dot));
    if (a) show(idx + Number(a.dataset.hero));
  });
  // Pausa al pasar el ratón
  box.addEventListener('mouseenter', () => {
    box.classList.add('paused');
    clearTimeout(timer);
  });
  box.addEventListener('mouseleave', () => {
    box.classList.remove('paused');
    // reiniciar el progreso de la barra para que coincida con el temporizador
    const dot = box.querySelector('.hero-dot.active');
    if (dot) {
      dot.classList.remove('active');
      void dot.offsetWidth;
      dot.classList.add('active');
    }
    restart();
  });
  // Deslizar con el dedo
  let x0 = null;
  box.addEventListener('touchstart', (e) => (x0 = e.touches[0].clientX), { passive: true });
  box.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
    x0 = null;
  });
  restart();
  ctx.onCleanup(() => clearTimeout(timer));
}
