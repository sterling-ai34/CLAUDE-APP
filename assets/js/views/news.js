import { icon } from '../icons.js';
import { loadNews, cachedNews, upcoming, nowPlaying, normList, regionOf } from '../api.js';
import { library } from '../store.js';
import { followInfo, epLabel } from '../notify.js';
import { esc, posterHTML, reg, displayTitle, fmtDate, relDay, daysUntil, timeAgo, emptyHTML, parseDate } from '../ui.js';

const TABS = {
  mine: { label: 'Sobre lo tuyo', ic: 'heart' },
  all: { label: 'Todo', ic: 'news' },
  cine: { label: 'Cine', ic: 'film' },
  series: { label: 'Series', ic: 'tv' },
  anime: { label: 'Anime', ic: 'flame' },
  cal: { label: 'Calendario de estrenos', ic: 'calendar' },
};

/** Palabras clave de lo que sigues / te gusta, para encontrar noticias sobre eso. */
function myKeywords() {
  const out = [];
  for (const e of library.all()) {
    if (!(e.following || e.favorite || e.status === 'watching' || e.status === 'watchlist' || e.rating >= 8)) continue;
    for (const t of [e.title, e.originalTitle]) {
      if (!t || t.length < 4 || /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+$/u.test(t)) continue;
      const clean = t.replace(/[:\-–(].*$/, '').trim();
      if (clean.length >= 4) out.push({ kw: clean.toLowerCase(), title: e.title });
    }
  }
  return out;
}
const matchKw = (item, kws) => {
  const hay = ` ${item.title} ${item.summary} `.toLowerCase();
  return kws.find(({ kw }) => {
    const i = hay.indexOf(kw);
    if (i < 0) return false;
    const before = hay[i - 1];
    const after = hay[i + kw.length];
    return !/[\p{L}\p{N}]/u.test(before || ' ') && !/[\p{L}\p{N}]/u.test(after || ' ');
  });
};

export default function news(el, ctx) {
  let tab = TABS[ctx.query.get('tab')] ? ctx.query.get('tab') : 'all';
  el.innerHTML = `<div class="page">
    <header class="page-head">
      <div><span class="eyebrow">${icon('news')} Noticias</span><h1>Lo último del cine, series y anime</h1>
      <p>Noticias reales de medios en español e inglés. Se actualizan solas cada 30 minutos.</p></div>
      <div class="news-status" id="nw-status"></div>
    </header>
    <div class="seg" id="nw-tabs">${Object.entries(TABS).map(([k, v]) => `<button data-tab="${k}" class="${k === tab ? 'active' : ''}">${icon(v.ic)}${v.label}</button>`).join('')}</div>
    <div id="nw-body" style="margin-top:20px"></div>
  </div>`;
  const body = el.querySelector('#nw-body');
  const status = el.querySelector('#nw-status');
  let data = cachedNews();

  const paintStatus = (loading) => {
    status.innerHTML = `${loading ? '<span class="spinner"></span> Actualizando…' : data ? `Actualizado ${timeAgo(data.t)}` : ''}
      <button class="btn btn-sm" id="nw-refresh" ${loading ? 'disabled' : ''}>${icon('refresh')} Actualizar</button>`;
    status.querySelector('#nw-refresh').onclick = () => refresh(true);
  };

  const paint = () => {
    if (tab === 'cal') return paintCalendar(body, ctx);
    if (!data) {
      body.innerHTML = `<div class="news-grid">${Array.from({ length: 6 }, () => '<div class="news-card"><div class="news-img skel"></div><div class="news-body"><div class="skel skel-line"></div><div class="skel skel-line"></div><div class="skel skel-line short"></div></div></div>').join('')}</div>`;
      return;
    }
    let items = data.items;
    let kws = [];
    if (tab === 'mine') {
      kws = myKeywords();
      items = items.map((it) => ({ ...it, match: matchKw(it, kws) })).filter((it) => it.match);
    } else if (tab !== 'all') items = items.filter((it) => it.cat === tab);
    const warn = data.failed?.length ? `<div class="news-warn">${icon('info')} No respondieron: ${esc(data.failed.join(', '))}. Se reintentará en la próxima actualización.</div>` : '';
    if (!items.length) {
      body.innerHTML = warn + (tab === 'mine'
        ? emptyHTML('heart', kws.length ? 'Nada nuevo sobre lo tuyo' : 'Aún no sé qué te interesa', kws.length ? `Busco noticias sobre ${kws.length} títulos que sigues, tienes por ver o son favoritos. Cuando salga algo aparecerá aquí.` : 'Sigue series, marca favoritas o añade cosas a <b>Por ver</b> y aquí verás solo las noticias de eso.')
        : emptyHTML('news', 'No hay noticias', 'Puede que los medios no estén respondiendo ahora mismo. Prueba a actualizar en un rato.'));
      return;
    }
    body.innerHTML = `${warn}<div class="news-grid">${items.slice(0, 90).map((it, i) => newsCard(it, i)).join('')}</div>`;
  };

  const refresh = async (force) => {
    paintStatus(true);
    try {
      data = await loadNews({ force });
    } catch { /* se queda lo que haya en caché */ }
    if (!ctx.alive()) return;
    paintStatus(false);
    if (tab !== 'cal') paint();
  };

  el.querySelector('#nw-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    tab = b.dataset.tab;
    el.querySelectorAll('#nw-tabs button').forEach((x) => x.classList.toggle('active', x === b));
    history.replaceState(null, '', `#/noticias?tab=${tab}`);
    paint();
  });

  paint();
  paintStatus(false);
  refresh(false);
}

function newsCard(it, i) {
  const tr = it.lang === 'en' ? `https://translate.google.com/translate?sl=en&tl=es&u=${encodeURIComponent(it.link)}` : '';
  return `<article class="news-card" style="--i:${Math.min(i, 16)}">
    <a class="news-img" href="${esc(it.link)}" target="_blank" rel="noopener">
      ${icon('news')}
      ${it.image ? `<img src="${esc(it.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onload="this.classList.add('ok')" onerror="this.remove()">` : ''}
      <span class="news-src ${it.cat}">${esc(it.source)}</span>
    </a>
    <div class="news-body">
      ${it.match ? `<span class="news-match">Sobre ${esc(it.match.title)}</span>` : ''}
      <h3><a href="${esc(it.link)}" target="_blank" rel="noopener">${esc(it.title)}</a></h3>
      ${it.summary ? `<p>${esc(it.summary)}</p>` : ''}
      <div class="news-foot">
        <span>${timeAgo(it.date)}</span>
        <span style="flex:1"></span>
        ${tr ? `<a href="${tr}" target="_blank" rel="noopener">${icon('translate')} Traducir</a>` : ''}
        <a href="${esc(it.link)}" target="_blank" rel="noopener">Leer ${icon('external')}</a>
      </div>
    </div>
  </article>`;
}

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/* Calendario: próximos episodios de lo que sigues + estrenos de cine */
async function paintCalendar(body, ctx) {
  body.innerHTML = '<div class="load-more"><span class="spinner"></span></div>';
  const events = [];
  const followed = library.all().filter((e) => e.following);
  const [infos, up, now] = await Promise.all([
    Promise.all(followed.map(async (e) => ({ e, v: await followInfo(e).catch(() => null) }))),
    Promise.all([upcoming(1), upcoming(2)]).then((r) => r.flatMap((x) => normList(x, 'movie'))).catch(() => []),
    nowPlaying(1).then((r) => normList(r, 'movie')).catch(() => []),
  ]);
  if (!ctx.alive() || !body.isConnected) return;
  for (const { e, v } of infos) {
    if (!v) continue;
    if (v.anilist) {
      const d = new Date(v.anilist.airingAt * 1000);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      events.push({ date: ds, it: e, text: `Episodio ${v.anilist.episode} · ${d.toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' })}`, mine: true });
    } else if (v.next?.date) events.push({ date: v.next.date, it: e, text: `${epLabel(v.next)}${v.next.name ? ` · ${v.next.name}` : ''}`, mine: true });
    else if (v.release && daysUntil(v.release) >= 0) events.push({ date: v.release, it: e, text: 'Estreno', mine: true });
  }
  const seen = new Set(events.map((x) => `${x.it.type}:${x.it.id}`));
  for (const m of up) {
    if (!m.date || daysUntil(m.date) < 0 || seen.has(`movie:${m.id}`)) continue;
    seen.add(`movie:${m.id}`);
    events.push({ date: m.date, it: m, text: 'Estreno en cines' });
  }
  const recent = now.filter((m) => m.date && daysUntil(m.date) <= 0 && daysUntil(m.date) > -10 && !seen.has(`movie:${m.id}`));
  events.sort((a, b) => a.date.localeCompare(b.date) || (b.mine ? 1 : 0) - (a.mine ? 1 : 0));
  const byDay = new Map();
  for (const ev of events.filter((x) => daysUntil(x.date) <= 60)) {
    if (!byDay.has(ev.date)) byDay.set(ev.date, []);
    byDay.get(ev.date).push(ev);
  }
  const dayFmt = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' });
  const item = (ev) => {
    reg(ev.it);
    return `<a class="cal-item" href="#/titulo/${ev.it.type}/${ev.it.id}">${posterHTML(ev.it, 'w92')}<div style="min-width:0"><strong>${esc(displayTitle(ev.it))}${ev.mine ? ` <span style="color:#c6b6ff">${icon('bell')}</span>` : ''}</strong><span>${esc(ev.text)}</span></div></a>`;
  };
  body.innerHTML = `
    <p class="result-count">Próximos 60 días · estrenos de cine en ${regionOf()} · ${followed.length ? `${followed.length} títulos que sigues` : 'sigue series para ver aquí sus episodios'}</p>
    ${[...byDay.entries()].map(([d, evs]) => `<div class="cal-day"><h3>${cap(dayFmt.format(parseDate(d)))} <span class="rel">${relDay(d)}</span></h3><div class="cal-items">${evs.map(item).join('')}</div></div>`).join('') || emptyHTML('calendar', 'Nada en el calendario', 'No encontré estrenos próximos.')}
    ${recent.length ? `<div class="cal-day"><h3>Recién estrenadas en cines</h3><div class="cal-items">${recent.map((m) => item({ it: m, text: `Desde el ${fmtDate(m.date, true)}` })).join('')}</div></div>` : ''}`;
}
