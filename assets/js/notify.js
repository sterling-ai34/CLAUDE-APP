// Seguimiento de series / anime / estrenos y avisos (campana + notificación del sistema).
import { tmdb, anilistNext, IMG } from './api.js';
import { library, notifs, meta, settings, today } from './store.js';
import { daysUntil } from './ui.js';

const STATUS_ES = {
  'Returning Series': 'En emisión', Ended: 'Finalizada', Canceled: 'Cancelada', 'In Production': 'En producción', Planned: 'Anunciada', Pilot: 'Piloto',
  Released: 'Estrenada', 'Post Production': 'Postproducción', Rumored: 'Rumor',
};
export const statusEs = (s) => STATUS_ES[s] || s || '';

const epObj = (x) => (x ? { s: x.season_number, e: x.episode_number, name: x.name, date: x.air_date } : null);
const epNum = (x) => (x ? x.s * 10000 + x.e : 0);
export const epLabel = (x) => (x ? `T${x.s} · E${x.e}` : '');

/** Información de emisión de algo que sigues (con caché de 30 min). */
export async function followInfo(entry, { force = false } = {}) {
  const ck = `follow:${entry.key}`;
  const c = meta.get(ck);
  if (!force && c && Date.now() - c.t < 30 * 60e3) return c.v;
  let v;
  if (entry.type === 'tv') {
    const d = await tmdb(`/tv/${entry.id}`, {}, { ttl: force ? 0 : 30 * 60e3 });
    v = {
      status: d.status,
      statusEs: statusEs(d.status),
      next: epObj(d.next_episode_to_air),
      last: epObj(d.last_episode_to_air),
      seasons: d.number_of_seasons,
      episodes: d.number_of_episodes,
      poster: d.poster_path,
      backdrop: d.backdrop_path,
      network: d.networks?.[0]?.name || '',
      anilist: null,
    };
    if (entry.anime && (d.status === 'Returning Series' || d.status === 'In Production' || v.next)) {
      v.anilist = await anilistNext([d.name, d.original_name, entry.originalTitle].filter(Boolean));
    }
  } else {
    const d = await tmdb(`/movie/${entry.id}`, { append_to_response: 'release_dates' }, { ttl: force ? 0 : 30 * 60e3 });
    const region = settings.get().region;
    const rel = d.release_dates?.results?.find((r) => r.iso_3166_1 === region)?.release_dates?.find((x) => x.type === 3 || x.type === 2);
    v = { status: d.status, statusEs: statusEs(d.status), release: rel?.release_date?.slice(0, 10) || d.release_date, poster: d.poster_path, backdrop: d.backdrop_path };
  }
  meta.set(ck, { t: Date.now(), v });
  return v;
}

function pushSystem(title, body, poster) {
  if (!settings.get().browserNotifs || !('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = { body, icon: poster ? IMG(poster, 'w185') : 'assets/img/icon-192.png', badge: 'assets/img/icon-192.png' };
  if (navigator.serviceWorker?.controller) navigator.serviceWorker.ready.then((r) => r.showNotification(title, opts)).catch(() => {});
  else try { new Notification(title, opts); } catch { /* algunos móviles solo permiten avisos vía service worker */ }
}

function add(n) {
  if (notifs.add(n)) {
    pushSystem(n.title, n.body, n.poster);
    return 1;
  }
  return 0;
}

/** Revisa todo lo que sigues y crea avisos nuevos. Devuelve cuántos avisos nuevos hubo. */
export async function checkAll({ force = false } = {}) {
  const followed = library.all().filter((e) => e.following);
  let created = 0;
  for (const e of followed) {
    try {
      const v = await followInfo(e, { force });
      const title = e.title;
      const href = `#/titulo/${e.type}/${e.id}`;
      if (e.type === 'tv') {
        const known = e.lastKnown || null;
        // Episodio nuevo emitido desde la última vez
        if (v.last && epNum(v.last) > epNum(known)) {
          if (known) {
            created += add({
              id: `${e.key}:ep:${v.last.s}:${v.last.e}`, key: e.key, href, poster: v.poster || e.poster,
              title: `Nuevo episodio de ${title}`,
              body: `Ya salió ${epLabel(v.last)}${v.last.name ? ` «${v.last.name}»` : ''}.`,
              kind: 'episode',
            });
          }
          library.patch(e, { lastKnown: { s: v.last.s, e: v.last.e } });
        }
        // Próximo episodio en las próximas 48 h
        if (v.next?.date) {
          const n = daysUntil(v.next.date);
          if (n != null && n >= 0 && n <= 2) {
            created += add({
              id: `${e.key}:soon:${v.next.s}:${v.next.e}`, key: e.key, href, poster: v.poster || e.poster,
              title: n === 0 ? `Hoy sale ${title}` : n === 1 ? `Mañana sale ${title}` : `${title} en 2 días`,
              body: `${epLabel(v.next)}${v.next.name ? ` «${v.next.name}»` : ''}.`,
              kind: 'soon',
            });
          }
        }
        // Nueva temporada anunciada
        if (e.knownSeasons && v.seasons > e.knownSeasons) {
          created += add({
            id: `${e.key}:season:${v.seasons}`, key: e.key, href, poster: v.poster || e.poster,
            title: `¡Temporada ${v.seasons} de ${title}!`, body: 'Se anunció una nueva temporada.', kind: 'season',
          });
        }
        if (v.seasons && v.seasons !== e.knownSeasons) library.patch(e, { knownSeasons: v.seasons });
        if (e.knownStatus && v.status !== e.knownStatus && (v.status === 'Ended' || v.status === 'Canceled')) {
          created += add({
            id: `${e.key}:status:${v.status}`, key: e.key, href, poster: v.poster || e.poster,
            title: `${title}: ${v.statusEs.toLowerCase()}`, body: v.status === 'Ended' ? 'La serie terminó.' : 'La serie fue cancelada.', kind: 'status',
          });
        }
        if (v.status !== e.knownStatus) library.patch(e, { knownStatus: v.status });
      } else if (v.release) {
        const n = daysUntil(v.release);
        if (n != null && n <= 0 && n > -30) {
          created += add({ id: `${e.key}:released`, key: e.key, href, poster: v.poster || e.poster, title: `¡Ya se estrenó ${title}!`, body: `Estreno: ${v.release}.`, kind: 'release' });
        } else if (n != null && n > 0 && n <= 7) {
          created += add({ id: `${e.key}:week`, key: e.key, href, poster: v.poster || e.poster, title: `${title} se estrena ${n === 1 ? 'mañana' : `en ${n} días`}`, body: `Fecha: ${v.release}.`, kind: 'release' });
        }
      }
    } catch {
      /* sin conexión o sin llave: se reintenta luego */
    }
  }
  meta.set('lastCheck', Date.now());
  return created;
}

/** Al empezar a seguir algo, guardamos dónde va para no avisar de episodios viejos. */
export async function startFollowing(item) {
  library.setFollowing(item, true);
  try {
    const e = library.get(`${item.type}:${item.id}`);
    const v = await followInfo(e, { force: true });
    library.patch(item, { lastKnown: v.last ? { s: v.last.s, e: v.last.e } : null, knownSeasons: v.seasons || null, knownStatus: v.status || null, followedAt: today() });
    return v;
  } catch {
    return null;
  }
}
