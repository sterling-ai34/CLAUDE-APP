import { icon } from '../icons.js';
import { IMG } from '../api.js';
import { library, bus, lastWatchedEp } from '../store.js';
import { followInfo, epLabel, checkAll } from '../notify.js';
import { esc, posterHTML, displayTitle, typeLabel, fmtDate, fmtDateTime, relDay, countdown, daysUntil, emptyHTML, toast } from '../ui.js';

const when = (v) => (v?.anilist ? v.anilist.airingAt * 1000 : v?.next?.date ? new Date(`${v.next.date}T12:00`).getTime() : v?.release && daysUntil(v.release) >= 0 ? new Date(`${v.release}T12:00`).getTime() : Infinity);

export default function following(el, ctx) {
  const list = library.all().filter((e) => e.following);
  el.innerHTML = `<div class="page">
    <header class="page-head">
      <div><span class="eyebrow">${icon('bell')} Siguiendo</span><h1>Tus series, anime y estrenos</h1>
      <p>Te aviso en la campana cuando sale un episodio nuevo, se anuncia una temporada o llega un estreno. Los anime en emisión traen la hora exacta (AniList).</p></div>
      ${list.length ? `<button class="btn" id="fw-refresh">${icon('refresh')} Actualizar</button>` : ''}
    </header>
    <div id="fw-list" class="follow-list">${list.length ? list.map(() => '<div class="follow-card skel" style="height:150px"></div>').join('') : ''}</div>
  </div>`;

  const box = el.querySelector('#fw-list');
  if (!list.length) {
    box.outerHTML = emptyHTML('bellRing', 'Todavía no sigues nada', 'Abre una serie o un anime (por ejemplo, el que estás viendo ahora) y toca <b>Seguir</b>. También puedes seguir películas que aún no se estrenan.', `<a class="btn btn-primary" href="#/explorar/anime">${icon('compass')} Buscar un anime</a>`);
    return;
  }

  const paint = async (force = false) => {
    const infos = await Promise.all(library.all().filter((e) => e.following).map(async (e) => ({ e, v: await followInfo(e, { force }).catch(() => null) })));
    if (!ctx.alive()) return;
    if (!infos.length) {
      box.innerHTML = `<div style="grid-column:1/-1">${emptyHTML('bellRing', 'Ya no sigues nada', 'Abre una serie o un anime y toca <b>Seguir</b>.')}</div>`;
      return;
    }
    infos.sort((a, b) => when(a.v) - when(b.v) || a.e.title.localeCompare(b.e.title));
    box.innerHTML = infos.map(({ e, v }, i) => cardHTML(e, v, i)).join('');
  };

  box.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-plus]');
    if (!b) return;
    const e = library.get(b.dataset.plus);
    const next = JSON.parse(b.dataset.next);
    library.setEpisodes(e, next.s, [next.e], true);
    toast(`Marcado ${epLabel(next)} de <b>${esc(displayTitle(e))}</b>`, { ic: 'check' });
  });
  const onLib = () => paint();
  bus.addEventListener('library', onLib);
  ctx.onCleanup(() => bus.removeEventListener('library', onLib));
  el.querySelector('#fw-refresh')?.addEventListener('click', async (ev) => {
    const b = ev.currentTarget;
    b.disabled = true;
    b.innerHTML = '<span class="spinner"></span> Revisando…';
    const n = await checkAll({ force: true });
    await paint(false);
    b.disabled = false;
    b.innerHTML = `${icon('refresh')} Actualizar`;
    toast(n ? `${n} aviso${n > 1 ? 's' : ''} nuevo${n > 1 ? 's' : ''} en la campana` : 'Todo al día', { ic: 'bell', tone: 'violet' });
  });
  paint();
}

function cardHTML(e, v, i) {
  const href = `#/titulo/${e.type}/${e.id}`;
  const bd = IMG(v?.backdrop || e.backdrop, 'w780');
  const mine = lastWatchedEp(e);
  let next = '';
  if (v?.anilist) {
    next = `<div class="follow-next"><span class="label">Próximo episodio</span>
      <div class="countdown" data-countdown="${v.anilist.airingAt * 1000}">${countdown(v.anilist.airingAt * 1000)}</div>
      <span style="font-size:13px;color:var(--muted)">Ep. ${v.anilist.episode} · ${fmtDateTime(v.anilist.airingAt * 1000)}</span></div>`;
  } else if (v?.next) {
    next = `<div class="follow-next"><span class="label">Próximo episodio</span>
      <div class="countdown" style="font-size:17px">${v.next.date ? relDay(v.next.date) : 'Por confirmar'}</div>
      <span style="font-size:13px;color:var(--muted)">${epLabel(v.next)}${v.next.name ? ` · ${esc(v.next.name)}` : ''}${v.next.date ? ` · ${fmtDate(v.next.date)}` : ''}</span></div>`;
  } else if (e.type === 'movie' && v?.release) {
    const n = daysUntil(v.release);
    next = `<div class="follow-next"><span class="label">${n > 0 ? 'Estreno' : 'Estrenada'}</span><div class="countdown" style="font-size:17px">${n > 0 ? relDay(v.release) : fmtDate(v.release)}</div><span style="font-size:13px;color:var(--muted)">${fmtDate(v.release)}</span></div>`;
  } else if (v) {
    next = `<div class="follow-next"><span class="label">Próximo episodio</span><span style="font-size:14px;color:var(--muted)">${v.status === 'Ended' || v.status === 'Canceled' ? 'La serie ya terminó.' : 'Sin fecha anunciada. Te aviso cuando la haya.'}</span></div>`;
  }

  // "Siguiente por ver": el episodio que sigue al último que marcaste (si ya salió)
  let plus = '';
  if (e.type === 'tv') {
    const target = mine ? { s: mine.s, e: mine.e + 1 } : { s: 1, e: 1 };
    const aired = v?.last && (target.s < v.last.s || (target.s === v.last.s && target.e <= v.last.e));
    if (aired) plus = `<button class="btn btn-sm" data-plus="${e.key}" data-next='${JSON.stringify(target)}'>${icon('check')} Vi ${epLabel(target)}</button>`;
  }

  return `<article class="follow-card" style="--i:${i}">
    <div class="bg" style="${bd ? `background-image:url('${bd}')` : ''}"></div>
    <a href="${href}">${posterHTML({ ...e, poster: e.poster || v?.poster }, 'w185')}</a>
    <div class="follow-main">
      <h3><a href="${href}">${esc(displayTitle(e))}</a></h3>
      <div class="follow-status">
        <span class="meta-chip ${v?.status === 'Returning Series' ? 'green' : ''}">${v?.status === 'Returning Series' ? icon('radio') : ''}${esc(v?.statusEs || typeLabel(e))}</span>
        ${mine ? `<span class="meta-chip">${icon('eye')} Vas por ${epLabel(mine)}</span>` : ''}
        ${v?.last && e.type === 'tv' ? `<span class="meta-chip">Último: ${epLabel(v.last)}</span>` : ''}
      </div>
      ${next}
      <div class="follow-actions">
        ${plus}
        <a class="btn btn-sm btn-ghost" href="${href}">${icon('tv')} Episodios</a>
        <button class="btn btn-sm btn-ghost" data-act="follow" data-key="${e.key}">${icon('bellOff')} Dejar de seguir</button>
      </div>
    </div>
  </article>`;
}
