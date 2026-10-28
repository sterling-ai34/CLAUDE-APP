import { icon } from '../icons.js';
import { details, season as fetchSeason, collection, norm, normList, IMG, regionOf, anilistNext } from '../api.js';
import { library, bus, today, keyOf } from '../store.js';
import { statusEs, epLabel } from '../notify.js';
import {
  esc, reg, registry, cardHTML, personCardHTML, rowHTML, fillRow, posterHTML, starsHTML, displayTitle, typeLabel,
  fmtDate, fmtDateTime, relDay, daysUntil, countdown, toast, emptyHTML, burst,
} from '../ui.js';

const TAGS = ['Volver a verla', 'Obra maestra', 'Me hizo llorar', 'Me reí muchísimo', 'Final brutal', 'Para ver con alguien', 'Banda sonora top', 'Placer culposo'];
const REGION_FLAGS = { MX: '🇲🇽', US: '🇺🇸', ES: '🇪🇸', CO: '🇨🇴', AR: '🇦🇷', CL: '🇨🇱', PE: '🇵🇪', DO: '🇩🇴', VE: '🇻🇪', EC: '🇪🇨' };

function trTitle(d, country, lang = 'es') {
  const t = d.translations?.translations?.find((x) => x.iso_3166_1 === country && x.iso_639_1 === lang);
  return t?.data?.title || t?.data?.name || '';
}
function trOverview(d) {
  const tr = d.translations?.translations || [];
  const es = tr.find((x) => x.iso_639_1 === 'es' && x.data?.overview);
  if (es) return { text: es.data.overview, note: es.iso_3166_1 === 'ES' ? 'Sinopsis en español de España' : '' };
  const en = tr.find((x) => x.iso_639_1 === 'en' && x.data?.overview);
  if (en) return { text: en.data.overview, note: 'Sinopsis en inglés (no hay versión en español todavía)' };
  return { text: '', note: '' };
}
function pickTrailer(d) {
  const v = (d.videos?.results || []).filter((x) => x.site === 'YouTube');
  const rank = (x) => (x.type === 'Trailer' ? 0 : x.type === 'Teaser' ? 1 : 2) * 10 + (x.iso_639_1 === 'es' ? 0 : x.iso_639_1 === 'en' ? 1 : 2) - (x.official ? 0.5 : 0);
  return v.sort((a, b) => rank(a) - rank(b))[0] || null;
}
const runtimeStr = (m) => (m ? (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}` : `${m} min`) : '');

export default function detail(el, ctx) {
  const [type, idStr] = ctx.params;
  const id = Number(idStr);
  const key = `${type}:${id}`;
  const known = registry.get(key) || library.get(key);

  el.innerHTML = `<div class="page detail" id="detail">
    ${heroHTML(known ? { ...known, id, type } : { id, type, title: '', poster: null, backdrop: null }, ctx.morph)}
    <div class="detail-body">
      <div><div class="panel skel skel-block" style="height:180px"></div></div>
      <div><div class="panel skel skel-block" style="height:320px"></div></div>
    </div>
  </div>`;

  details(type, id)
    .then((d) => ctx.alive() && paint(el, ctx, type, d))
    .catch((err) => {
      if (!ctx.alive()) return;
      el.querySelector('.detail-body').innerHTML = `<div>${emptyHTML('info', 'No se pudo cargar la ficha', esc(err.message), `<button class="btn" onclick="location.reload()">${icon('refresh')} Reintentar</button>`)}</div>`;
    });
}

function heroHTML(it, morph, extra = {}) {
  const bg = IMG(it.backdrop, 'w1280');
  const vote = it.vote || 0;
  const ringColor = vote >= 7 ? 'var(--green)' : vote >= 5.5 ? 'var(--gold)' : 'var(--rose)';
  return `<section class="detail-hero" id="d-hero">
    <div class="detail-bg">${bg ? `<img src="${bg}" alt="" onload="this.classList.add('ok')">` : ''}</div>
    <div class="detail-top">
      <div class="detail-poster" ${morph ? 'style="view-transition-name: morph"' : ''}>${posterHTML(it, 'w500')}</div>
      <div class="detail-head">
        ${it.title ? `<h1>${esc(displayTitle(it))}</h1>` : '<div class="skel" style="height:44px;width:60%;border-radius:10px"></div>'}
        ${extra.sub ? `<p class="detail-sub">${extra.sub}</p>` : ''}
        ${extra.meta ? `<div class="meta-row">${vote ? `<div class="score-ring" style="--p:${vote * 10};--ring:${ringColor}"><div><b>${vote.toFixed(1)}</b><small>TMDB</small></div></div>` : ''}${extra.meta}</div>` : ''}
        ${extra.actions ? `<div class="detail-actions">${extra.actions}</div>` : ''}
      </div>
    </div>
  </section>`;
}

function paint(el, ctx, type, d) {
  const it = norm(d, type);
  it.runtime = type === 'movie' ? d.runtime : d.episode_run_time?.[0] || d.last_episode_to_air?.runtime || null;
  it.episodes = d.number_of_episodes || undefined;
  const key = reg(it);
  // Mantén al día los datos guardados (portada, géneros, duración) si ya está en tu biblioteca
  if (library.get(key)) library.patch(it, {});

  const titles = {
    latino: trTitle(d, 'MX') || it.title,
    spain: trTitle(d, 'ES'),
    original: it.originalTitle,
  };
  const ov = it.overview ? { text: it.overview, note: '' } : trOverview(d);
  const trailer = pickTrailer(d);
  const region = regionOf();
  const prov = d['watch/providers']?.results?.[region];
  const director = type === 'movie' ? (d.credits?.crew || []).filter((c) => c.job === 'Director').map((c) => c.name) : (d.created_by || []).map((c) => c.name);
  const genres = (d.genres || []).map((g) => g.name);
  const isFuture = it.date && daysUntil(it.date) > 0;
  const canFollow = type === 'tv' || isFuture || ['Post Production', 'In Production', 'Planned'].includes(d.status);

  const metaChips = [
    `<span class="meta-chip ${it.anime ? 'rose' : ''}">${icon(type === 'tv' ? 'tv' : 'film')}${typeLabel(it)}</span>`,
    it.date ? `<span class="meta-chip ${isFuture ? 'gold' : ''}">${icon('calendar')}${isFuture ? `Estreno ${fmtDate(it.date)}` : it.year}</span>` : '',
    type === 'movie' && d.runtime ? `<span class="meta-chip">${icon('clock')}${runtimeStr(d.runtime)}</span>` : '',
    type === 'tv' ? `<span class="meta-chip">${d.number_of_seasons} temporada${d.number_of_seasons === 1 ? '' : 's'} · ${d.number_of_episodes || '?'} eps</span>` : '',
    type === 'tv' && d.status ? `<span class="meta-chip ${d.status === 'Returning Series' ? 'green' : ''}">${d.status === 'Returning Series' ? icon('radio') : ''}${statusEs(d.status)}</span>` : '',
    ...genres.slice(0, 3).map((g) => `<span class="meta-chip">${esc(g)}</span>`),
  ].join('');

  const sub = [titles.original && titles.original !== displayTitle(it) ? esc(titles.original) : '', director.length ? `${type === 'movie' ? 'Dirigida por' : 'Creada por'} ${esc(director.slice(0, 2).join(', '))}` : ''].filter(Boolean).join(' · ');

  const actions = () => {
    const e = library.get(key);
    return `
      ${trailer ? `<button class="btn btn-primary" data-act="trailer" data-yt="${esc(trailer.key)}" data-title="${esc(displayTitle(it))}">${icon('play')} Ver tráiler</button>` : ''}
      <button class="btn btn-fav ${e?.favorite ? 'on' : ''}" data-act="fav" data-key="${key}">${icon('heart')} Favorita</button>
      ${canFollow ? `<button class="btn btn-follow ${e?.following ? 'on' : ''}" data-act="follow" data-key="${key}">${icon(e?.following ? 'bellRing' : 'bell')} ${e?.following ? 'Siguiendo' : type === 'tv' ? 'Seguir' : 'Avísame del estreno'}</button>` : ''}`;
  };

  const hero = el.querySelector('#d-hero');
  hero.outerHTML = heroHTML(it, false, { sub, meta: metaChips, actions: actions() });

  const flag = REGION_FLAGS[region] || '🌐';
  const provHTML = prov && (prov.flatrate || prov.rent || prov.buy || prov.free || prov.ads)
    ? [['flatrate', 'En streaming'], ['free', 'Gratis'], ['ads', 'Gratis con anuncios'], ['rent', 'Alquiler'], ['buy', 'Compra']].filter(([k]) => prov[k]?.length).map(([k, label]) => `
        <p class="prov-group">${label}</p>
        <div class="providers">${prov[k].slice(0, 8).map((p) => `<a class="provider" href="${esc(prov.link)}" target="_blank" rel="noopener"><img src="${IMG(p.logo_path, 'w92')}" alt="" loading="lazy">${esc(p.provider_name)}</a>`).join('')}</div>`).join('')
      + `<p class="prov-group" style="margin-top:12px;text-transform:none;letter-spacing:0">Datos de JustWatch para ${flag} ${region}. Cámbialo en Ajustes.</p>`
    : `<p style="color:var(--dim);font-size:14px">No hay datos de dónde verla en ${flag} ${region}. Prueba con otro país en Ajustes.</p>`;

  const body = el.querySelector('.detail-body');
  body.innerHTML = `
    <div>
      ${type === 'tv' ? '<div id="d-next"></div>' : ''}
      <section class="panel">
        <h3>${icon('info')} Sinopsis</h3>
        <p class="overview">${ov.text ? esc(ov.text) : 'Todavía no hay sinopsis para este título.'}${ov.note ? `<span class="note">${ov.note}</span>` : ''}</p>
      </section>
      ${type === 'tv' ? `<section class="panel" id="d-seasons"><h3>${icon('tv')} Temporadas y episodios <span class="aside">Marca lo que ya viste</span></h3><div id="d-season-list"></div></section>` : ''}
      <div id="d-collection"></div>
      ${(d.credits?.cast || []).length ? rowHTML('cast', 'Reparto', { icon: 'user', cls: 'cast-row', html: (d.credits.cast || []).slice(0, 20).map((p, i) => personCardHTML(p, i, p.character)).join('') }) : ''}
      ${rowHTML('recs', 'Si te gustó, también te puede gustar', { icon: 'sparkles' })}
      ${rowHTML('similar', 'Parecidas', { icon: 'compass' })}
    </div>
    <aside>
      <section class="panel my-panel" id="d-mine"></section>
      <section class="panel">
        <h3>${icon('globe')} Títulos</h3>
        <dl class="kv">
          <dt>🇲🇽 Latinoamérica</dt><dd>${esc(titles.latino || '—')}</dd>
          <dt>🇪🇸 España</dt><dd>${esc(titles.spain || titles.latino || '—')}</dd>
          <dt>🌐 Original</dt><dd>${esc(titles.original || '—')}</dd>
        </dl>
      </section>
      <section class="panel"><h3>${icon('playCircle')} Dónde verla</h3>${provHTML}</section>
      <section class="panel">
        <h3>${icon('film')} Datos</h3>
        <dl class="kv">
          ${type === 'movie' ? `<dt>Estreno</dt><dd>${fmtDate(it.date) || '—'}</dd><dt>Duración</dt><dd>${runtimeStr(d.runtime) || '—'}</dd>` : `<dt>Primer episodio</dt><dd>${fmtDate(d.first_air_date) || '—'}</dd><dt>Último emitido</dt><dd>${d.last_air_date ? fmtDate(d.last_air_date) : '—'}</dd><dt>Cadena</dt><dd>${esc((d.networks || []).map((n) => n.name).slice(0, 2).join(', ') || '—')}</dd>`}
          <dt>Estado</dt><dd>${esc(statusEs(d.status) || '—')}</dd>
          <dt>Idioma original</dt><dd>${esc((d.spoken_languages || []).find((l) => l.iso_639_1 === d.original_language)?.name || d.original_language || '—')}</dd>
          ${d.budget ? `<dt>Presupuesto</dt><dd>$${(d.budget / 1e6).toFixed(0)} M</dd>` : ''}
          ${d.revenue ? `<dt>Taquilla</dt><dd>$${(d.revenue / 1e6).toFixed(0)} M</dd>` : ''}
          <dt>Votos TMDB</dt><dd>${(d.vote_count || 0).toLocaleString('es')}</dd>
        </dl>
        <p style="margin-top:14px;display:flex;gap:14px;flex-wrap:wrap;font-size:13px">
          <a href="https://www.themoviedb.org/${type}/${it.id}" target="_blank" rel="noopener" style="color:var(--muted)">${icon('external')} TMDB</a>
          ${d.imdb_id || d.external_ids?.imdb_id ? `<a href="https://www.imdb.com/title/${d.imdb_id || d.external_ids.imdb_id}/" target="_blank" rel="noopener" style="color:var(--muted)">${icon('external')} IMDb</a>` : ''}
        </p>
      </section>
    </aside>`;

  fillRow(body, 'recs', async () => (d.recommendations?.results || []).map((r) => norm(r, r.media_type || type)));
  fillRow(body, 'similar', async () => normList(d.similar, type));

  paintMine(el, it, type);
  const onLib = (ev) => {
    if (ev.detail?.key === key || ev.detail?.all) {
      paintMine(el, it, type, true);
      const a = el.querySelector('.detail-actions');
      if (a) a.innerHTML = actions();
      if (type === 'tv') {
        paintSeasonsProgress(el, key);
        if (!!library.get(key)?.following !== !el.querySelector('#d-next [data-act="follow"]')) paintNext(el, ctx, it, d);
      }
    }
  };
  bus.addEventListener('library', onLib);
  ctx.onCleanup(() => bus.removeEventListener('library', onLib));

  if (type === 'tv') {
    paintNext(el, ctx, it, d);
    paintSeasons(el, ctx, it, d);
  }
  if (d.belongs_to_collection) paintCollection(el, ctx, d.belongs_to_collection, it.id);
}

/* ----------------------------- Tu opinión ----------------------------- */
function paintMine(el, it, type, partial = false) {
  const box = el.querySelector('#d-mine');
  if (!box) return;
  const key = keyOf(it);
  const e = library.get(key);
  const statuses = type === 'tv'
    ? [['watchlist', 'Por ver', 'bookmark'], ['watching', 'Viendo', 'eye'], ['watched', 'Terminada', 'check'], ['dropped', 'Abandonada', 'ban']]
    : [['watchlist', 'Por ver', 'bookmark'], ['watched', 'Vista', 'check']];

  if (partial && box.querySelector('textarea')) {
    // Actualiza solo las partes que cambian para no interrumpir lo que escribes
    box.querySelector('.status-seg').innerHTML = statuses.map(([v, l, ic]) => `<button class="status-btn ${e?.status === v ? 'on' : ''}" data-act="status" data-val="${v}" data-key="${key}">${icon(ic)}${l}</button>`).join('');
    const s = box.querySelector('[data-stars]');
    s.style.setProperty('--fill', `${(e?.rating || 0) * 10}%`);
    box.querySelector('.rate-val').textContent = e?.rating ? `${String(e.rating / 2).replace('.', ',')} / 5` : '';
    box.querySelector('.tags').innerHTML = tagsHTML(e);
    box.querySelector('.dates').innerHTML = datesHTML(e);
    return;
  }

  box.innerHTML = `
    <h3>${icon('pencil')} Tu opinión</h3>
    <div class="status-seg">${statuses.map(([v, l, ic]) => `<button class="status-btn ${e?.status === v ? 'on' : ''}" data-act="status" data-val="${v}" data-key="${key}">${icon(ic)}${l}</button>`).join('')}</div>
    <div class="my-label">Tu puntuación</div>
    <div class="my-row" style="margin-top:0">${starsHTML(e?.rating || 0, key)}<span class="rate-val">${e?.rating ? `${String(e.rating / 2).replace('.', ',')} / 5` : ''}</span></div>
    <div class="my-label"><span>¿Por qué te gustó (o no)? Para acordarte cuando la quieras volver a ver</span><span class="saved" id="d-saved">${icon('check')} Guardado</span></div>
    <textarea class="textarea" id="d-note" placeholder="Ej: el giro del final, la química entre los protagonistas, la banda sonora…">${esc(e?.note || '')}</textarea>
    <div class="my-label">Etiquetas</div>
    <div class="tags">${tagsHTML(e)}</div>
    <div class="my-label">${type === 'movie' ? 'Cuándo la viste' : 'Cuándo la terminaste'}</div>
    <div class="dates">${datesHTML(e)}</div>`;

  const ta = box.querySelector('#d-note');
  const saved = box.querySelector('#d-saved');
  let t;
  ta.addEventListener('input', () => {
    clearTimeout(t);
    saved.classList.remove('show');
    t = setTimeout(() => {
      library.setNote(it, ta.value);
      saved.classList.add('show');
      setTimeout(() => saved.classList.remove('show'), 1600);
    }, 500);
  });
  ta.addEventListener('blur', () => {
    clearTimeout(t);
    if ((library.get(key)?.note || '') !== ta.value) library.setNote(it, ta.value);
  });
  box.addEventListener('click', (ev) => {
    const tag = ev.target.closest('[data-tag]');
    if (tag) {
      library.toggleTag(it, tag.dataset.tag);
      return;
    }
    const rm = ev.target.closest('[data-rmdate]');
    if (rm) library.removeDate(it, Number(rm.dataset.rmdate));
  });
  box.addEventListener('change', (ev) => {
    if (ev.target.matches('[data-adddate]') && ev.target.value) {
      library.addDate(it, ev.target.value);
      toast('Fecha guardada en tu diario', { ic: 'calendar' });
    }
  });
}

function tagsHTML(e) {
  const all = [...new Set([...TAGS, ...(e?.tags || [])])];
  return all.map((t) => `<button class="tag ${e?.tags?.includes(t) ? 'on' : ''}" data-tag="${esc(t)}">${esc(t)}</button>`).join('');
}
function datesHTML(e) {
  return `${(e?.dates || []).map((d, i) => `<span class="date-pill">${icon('calendar')}${fmtDate(d)}<button data-rmdate="${i}" aria-label="Quitar fecha">${icon('x')}</button></span>`).join('')}
    <label class="btn btn-sm date-add">${icon('plus')} ${e?.dates?.length ? 'La volví a ver' : 'Añadir fecha'}<input type="date" data-adddate max="${today()}" value="${today()}"></label>`;
}

/* ----------------------------- Próximo episodio ----------------------------- */
async function paintNext(el, ctx, it, d) {
  const box = el.querySelector('#d-next');
  if (!box) return;
  const next = d.next_episode_to_air;
  const last = d.last_episode_to_air;
  let ani = null;
  if (it.anime && (d.status === 'Returning Series' || next)) ani = await anilistNext([d.name, d.original_name]).catch(() => null);
  if (!ctx.alive()) return;
  const e = library.get(keyOf(it));
  let inner = '';
  let live = true;
  let extra = '';
  if (ani) {
    inner = `<strong>Episodio ${ani.episode}${ani.title ? ` · ${esc(ani.title)}` : ''}</strong>
      <span>${fmtDateTime(ani.airingAt * 1000)} (tu hora) · datos de AniList</span>`;
    extra = `<div class="countdown" data-countdown="${ani.airingAt * 1000}">${countdown(ani.airingAt * 1000)}</div>`;
  } else if (next) {
    inner = `<strong>Próximo: ${epLabel({ s: next.season_number, e: next.episode_number })}${next.name ? ` · ${esc(next.name)}` : ''}</strong>
      <span>${next.air_date ? `${fmtDate(next.air_date)} (${relDay(next.air_date)})` : 'Fecha por confirmar'}</span>`;
  } else if (last && d.status === 'Returning Series') {
    live = false;
    inner = `<strong>Sin fecha para el próximo episodio</strong><span>Último: ${epLabel({ s: last.season_number, e: last.episode_number })} (${fmtDate(last.air_date)}). Síguela y te aviso cuando anuncien más.</span>`;
  }
  if (!inner) {
    box.innerHTML = '';
    return;
  }
  const follow = e?.following ? '' : `<button class="btn btn-sm btn-follow" data-act="follow" data-key="${keyOf(it)}">${icon('bell')} Avisarme</button>`;
  box.innerHTML = `<section class="panel" style="padding:12px"><div class="next-ep">
    <div class="ic-wrap ${live ? 'live' : ''}">${icon(live ? 'radio' : 'clock')}</div>
    <div style="flex:1;min-width:0">${inner}</div>${extra}${follow}
  </div></section>`;
}

/* ----------------------------- Temporadas ----------------------------- */
function seasonProgress(e, s) {
  return (e?.eps?.[String(s.season_number)] || []).length;
}

function paintSeasons(el, ctx, it, d) {
  const list = el.querySelector('#d-season-list');
  if (!list) return;
  const key = keyOf(it);
  const seasons = [...(d.seasons || [])].sort((a, b) => (a.season_number === 0) - (b.season_number === 0) || a.season_number - b.season_number);
  if (!seasons.length) {
    list.innerHTML = '<p style="color:var(--dim)">Aún no hay temporadas registradas.</p>';
    return;
  }
  const e = library.get(key);
  list.innerHTML = seasons.map((s) => {
    const done = seasonProgress(e, s);
    const pct = s.episode_count ? Math.round((done / s.episode_count) * 100) : 0;
    return `<div class="season" data-season="${s.season_number}" data-count="${s.episode_count || 0}" data-year="${(s.air_date || '').slice(0, 4)}">
      <button class="season-head">
        ${posterHTML({ poster: s.poster_path || it.poster, title: s.name, type: 'tv' }, 'w92')}
        <div class="grow"><strong>${esc(s.season_number === 0 ? 'Especiales' : s.name || `Temporada ${s.season_number}`)}</strong>
        <span data-sprog>${done ? `${done}/${s.episode_count} vistos` : `${s.episode_count || 0} episodios`}${s.air_date ? ` · ${s.air_date.slice(0, 4)}` : ''}</span>
        <div class="progress"><i style="--p:${pct}%"></i></div></div>
        ${icon('down')}
      </button>
      <div class="season-body"></div>
    </div>`;
  }).join('');

  list.addEventListener('click', async (ev) => {
    const head = ev.target.closest('.season-head');
    const sEl = ev.target.closest('.season');
    if (!sEl) return;
    const n = Number(sEl.dataset.season);
    if (head) {
      sEl.classList.toggle('open');
      if (sEl.classList.contains('open') && !sEl.dataset.loaded) {
        sEl.dataset.loaded = '1';
        const bodyEl = sEl.querySelector('.season-body');
        bodyEl.innerHTML = '<div class="load-more"><span class="spinner"></span></div>';
        try {
          const data = await fetchSeason(it.id, n);
          sEl._eps = data.episodes || [];
          paintEpisodes(sEl, it);
        } catch (err) {
          sEl.dataset.loaded = '';
          bodyEl.innerHTML = `<p style="color:var(--dim);padding:10px">${esc(err.message)}</p>`;
        }
      }
      return;
    }
    const ep = ev.target.closest('[data-ep]');
    if (ep) {
      const num = Number(ep.dataset.ep);
      const watched = !library.get(key)?.eps?.[String(n)]?.includes(num);
      library.setEpisodes(it, n, [num], watched);
      if (watched) burst(ep.querySelector('.ep-check'), 'var(--green)');
      return;
    }
    const all = ev.target.closest('[data-allseason]');
    if (all) {
      const aired = (sEl._eps || []).filter((x) => !x.air_date || daysUntil(x.air_date) <= 0).map((x) => x.episode_number);
      const cur = library.get(key)?.eps?.[String(n)] || [];
      const markAll = cur.length < aired.length;
      library.setEpisodes(it, n, aired, markAll);
      toast(markAll ? `Temporada ${n} marcada como vista` : `Temporada ${n} desmarcada`, { ic: 'check' });
    }
  });
}

function paintEpisodes(sEl, it) {
  const e = library.get(keyOf(it));
  const n = Number(sEl.dataset.season);
  const seen = new Set(e?.eps?.[String(n)] || []);
  const eps = sEl._eps || [];
  sEl.querySelector('.season-body').innerHTML = `
    <div class="season-tools"><button class="btn btn-sm" data-allseason>${icon('checkCircle')} Marcar / desmarcar temporada</button></div>
    ${eps.map((x) => {
      const future = x.air_date && daysUntil(x.air_date) > 0;
      return `<div class="ep ${seen.has(x.episode_number) ? 'done' : ''} ${future || !x.air_date ? 'future' : ''}" ${future || !x.air_date ? '' : `data-ep="${x.episode_number}"`} role="button">
        <span class="ep-check">${icon('check')}</span>
        <span class="ep-num">E${x.episode_number}</span>
        <div class="ep-main"><strong>${esc(x.name || `Episodio ${x.episode_number}`)}</strong><span>${x.air_date ? (future ? `Sale ${relDay(x.air_date)} · ${fmtDate(x.air_date)}` : fmtDate(x.air_date)) : 'Fecha por confirmar'}${x.runtime ? ` · ${x.runtime} min` : ''}</span></div>
      </div>`;
    }).join('') || '<p style="color:var(--dim);padding:10px">Sin episodios registrados todavía.</p>'}`;
}

function paintSeasonsProgress(el, key) {
  const e = library.get(key);
  el.querySelectorAll('.season').forEach((sEl) => {
    const n = sEl.dataset.season;
    const done = (e?.eps?.[n] || []).length;
    const count = sEl._eps?.length || Number(sEl.dataset.count) || 0;
    const yr = sEl.dataset.year;
    sEl.querySelector('[data-sprog]').textContent = `${done ? `${done}/${count} vistos` : `${count} episodios`}${yr ? ` · ${yr}` : ''}`;
    sEl.querySelector('.progress i').style.setProperty('--p', `${count ? Math.round((done / count) * 100) : 0}%`);
    if (sEl._eps) {
      const set = new Set(e?.eps?.[n] || []);
      sEl.querySelectorAll('[data-ep]').forEach((x) => x.classList.toggle('done', set.has(Number(x.dataset.ep))));
    }
  });
}

/* ----------------------------- Saga ----------------------------- */
async function paintCollection(el, ctx, col, currentId) {
  try {
    const c = await collection(col.id);
    if (!ctx.alive()) return;
    const parts = (c.parts || []).map((p) => norm(p, 'movie')).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
    if (parts.length < 2) return;
    const box = el.querySelector('#d-collection');
    box.innerHTML = `
      <div class="collection-banner">${c.backdrop_path ? `<img src="${IMG(c.backdrop_path, 'w1280')}" alt="">` : ''}<div><span class="eyebrow">${icon('film')} Saga completa</span><h3 style="font-size:22px">${esc(c.name)}</h3><p style="color:var(--muted);font-size:14px">${parts.length} películas, en orden de estreno</p></div></div>
      ${rowHTML('collection', '', { html: parts.map((p, i) => cardHTML(p, i, { label: p.id === currentId ? 'Estás aquí' : '' })).join('') })}`;
    box.querySelector('.row-head')?.remove();
  } catch { /* sin saga */ }
}

