// Cine Galions — arranque, navegación y acciones globales.
import { icon, logo } from './icons.js';
import { settings, library, notifs, meta, bus } from './store.js';
import { searchMulti, norm, IMG } from './api.js';
import { checkAll, startFollowing } from './notify.js';
import {
  $, $$, esc, reg, itemFor, refreshCards, toast, burst, closeModal, openDrawer, closeDrawer, openTrailer,
  updateScrollButtons, debounce, posterHTML, displayTitle, typeLabel, timeAgo, countdown, reduceMotion, enableTilt,
} from './ui.js';

import home from './views/home.js';
import explore from './views/explore.js';
import search from './views/search.js';
import detail from './views/detail.js';
import person from './views/person.js';
import foryou from './views/foryou.js';
import following from './views/following.js';
import news from './views/news.js';
import libraryView from './views/library.js';
import settingsView from './views/settings.js';
import onboard, { connect } from './views/onboard.js';

/* ----------------------------- Estructura ----------------------------- */
const NAV = [
  { href: '#/', id: 'home', label: 'Inicio', ic: 'home', match: (p) => p === '/' },
  { href: '#/explorar/movie', id: 'explore', label: 'Explorar', ic: 'compass', match: (p) => p.startsWith('/explorar') },
  { href: '#/para-ti', id: 'foryou', label: 'Para ti', ic: 'sparkles', match: (p) => p.startsWith('/para-ti') },
  { href: '#/siguiendo', id: 'following', label: 'Siguiendo', ic: 'bell', match: (p) => p.startsWith('/siguiendo') },
  { href: '#/noticias', id: 'news', label: 'Noticias', ic: 'news', match: (p) => p.startsWith('/noticias') },
  { href: '#/biblioteca', id: 'library', label: 'Mi biblioteca', short: 'Biblioteca', ic: 'library', match: (p) => p.startsWith('/biblioteca') },
];
const TABS = ['home', 'explore', 'foryou', 'following', 'library'];

function renderShell() {
  $('#sidebar').innerHTML = `
    <a class="brand" href="#/">${logo()}<span class="brand-name">Cine <span>Galions</span></span></a>
    ${NAV.map((n) => `<a class="nav-link" data-nav="${n.id}" href="${n.href}">${icon(n.ic)}<span>${n.label}</span>${n.id === 'following' ? '<span class="count" id="nav-follow-count"></span>' : ''}</a>`).join('')}
    <div class="spacer"></div>
    <a class="nav-link" data-nav="settings" href="#/ajustes">${icon('settings')}<span>Ajustes</span></a>
    <p class="sidebar-foot">Datos de películas: <a href="https://www.themoviedb.org" target="_blank" rel="noopener">TMDB</a> · Anime: <a href="https://anilist.co" target="_blank" rel="noopener">AniList</a></p>`;

  $('#topbar').innerHTML = `
    <a class="brand" href="#/">${logo()}<span class="brand-name">Cine <span>Galions</span></span></a>
    <div class="search-box" id="search-box">
      <label class="search-field" id="search-field">
        ${icon('search')}
        <input id="search-input" type="search" placeholder="Busca películas, series, anime o actores…" autocomplete="off" spellcheck="false" enterkeyhint="search" aria-label="Buscar">
        <button class="search-clear" id="search-clear" type="button" aria-label="Borrar">${icon('x')}</button>
        <kbd>/</kbd>
      </label>
      <div class="search-dd" id="search-dd" role="listbox"></div>
    </div>
    <div class="topbar-actions">
      <a class="icon-btn only-mobile" href="#/buscar" aria-label="Buscar">${icon('search')}</a>
      <a class="icon-btn only-mobile" href="#/noticias" aria-label="Noticias">${icon('news')}</a>
      <button class="icon-btn" id="bell" data-act="open-notifs" aria-label="Avisos">${icon('bell')}<span class="dot" id="bell-dot" hidden></span></button>
      <a class="icon-btn only-mobile" href="#/ajustes" aria-label="Ajustes">${icon('settings')}</a>
    </div>`;

  $('#tabbar').innerHTML = TABS.map((id) => {
    const n = NAV.find((x) => x.id === id);
    return `<a class="tab" data-nav="${n.id}" href="${n.href}">${icon(n.ic)}<span>${n.short || n.label}</span></a>`;
  }).join('');
}

function updateNav(path) {
  const active = NAV.find((n) => n.match(path))?.id || (path.startsWith('/ajustes') ? 'settings' : '');
  $$('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === active));
  const c = library.all().filter((e) => e.following).length;
  const el = $('#nav-follow-count');
  if (el) el.textContent = c ? c : '';
}

function updateBell(ring = false) {
  const n = notifs.unread();
  const dot = $('#bell-dot');
  if (!dot) return;
  dot.hidden = !n;
  dot.textContent = n > 9 ? '9+' : n;
  if (ring && n) {
    const b = $('#bell');
    b.classList.remove('ring');
    void b.offsetWidth;
    b.classList.add('ring');
  }
}

/* ----------------------------- Router ----------------------------- */
const ROUTES = [
  [/^\/$/, home],
  [/^\/explorar(?:\/([\w-]+))?$/, explore],
  [/^\/buscar$/, search],
  [/^\/titulo\/(movie|tv)\/(\d+)$/, detail],
  [/^\/persona\/(\d+)$/, person],
  [/^\/para-ti$/, foryou],
  [/^\/siguiendo$/, following],
  [/^\/noticias$/, news],
  [/^\/biblioteca$/, libraryView],
  [/^\/ajustes$/, settingsView],
];

function parseHash() {
  const h = decodeURIComponent(location.hash.slice(1)) || '/';
  const i = h.indexOf('?');
  const path = (i >= 0 ? h.slice(0, i) : h) || '/';
  return { path: path.startsWith('/') ? path : `/${path}`, query: new URLSearchParams(i >= 0 ? location.hash.slice(location.hash.indexOf('?') + 1) : '') };
}

let token = 0;
let cleanups = [];
let pendingMorph = false;

function render() {
  const { path, query } = parseHash();
  cleanups.forEach((fn) => { try { fn(); } catch { /* nada */ } });
  cleanups = [];
  const my = ++token;
  const ctx = { query, path, alive: () => my === token, onCleanup: (fn) => cleanups.push(fn), morph: pendingMorph };
  pendingMorph = false;
  const el = $('#view');
  updateNav(path);
  closeDropdown();
  const top = $('#search-input');
  if (top && path !== '/buscar' && document.activeElement !== top && top.value) {
    top.value = '';
    $('#search-field')?.classList.remove('has-value');
  }

  if (path === '/conectar') return connect(el, ctx);
  if (!settings.get().tmdbKey && path !== '/ajustes') return onboard(el, ctx);

  for (const [re, view] of ROUTES) {
    const m = path.match(re);
    if (m) {
      ctx.params = m.slice(1);
      return view(el, ctx);
    }
  }
  el.innerHTML = `<div class="page"><div class="empty">${icon('compass')}<h3>Esta página no existe</h3><p>Puede que el enlace esté mal escrito.</p><a class="btn btn-primary" href="#/">Ir al inicio</a></div></div>`;
}

/* Memoria de scroll para que "atrás" te deje donde estabas. */
const scrollMem = new Map();
const stack = [location.hash || '#/'];
let lastHash = location.hash || '#/';

function navigate() {
  const h = location.hash || '#/';
  scrollMem.set(lastHash, scrollY);
  const isBack = stack.length > 1 && stack[stack.length - 2] === h;
  if (isBack) stack.pop();
  else stack.push(h);
  lastHash = h;

  const after = () => {
    const y = isBack ? scrollMem.get(h) : 0;
    if (y) {
      // esperar a que el contenido tenga altura
      let tries = 0;
      const tick = () => {
        if (document.documentElement.scrollHeight >= y + innerHeight * 0.5 || tries++ > 20) scrollTo({ top: y, behavior: 'instant' });
        else setTimeout(tick, 100);
      };
      tick();
    } else scrollTo({ top: 0, behavior: 'instant' });
  };

  if (document.startViewTransition && !reduceMotion()) {
    const vt = document.startViewTransition(() => {
      render();
      after();
    });
    vt.finished.finally(() => $$('[style*="view-transition-name"]').forEach((n) => (n.style.viewTransitionName = '')));
  } else {
    render();
    after();
  }
}

/* ----------------------------- Acciones globales ----------------------------- */
const STATUS_MSG = {
  watchlist: ['Añadida a Por ver', 'Quitada de Por ver', 'bookmark', 'gold'],
  watching: ['Marcada como Viendo', 'Ya no está en Viendo', 'eye', ''],
  watched: ['Marcada como vista', 'Desmarcada como vista', 'check', ''],
  dropped: ['Marcada como abandonada', 'Ya no está abandonada', 'ban', ''],
};

export async function toggleFollow(item, btn) {
  const e = library.get(`${item.type}:${item.id}`);
  if (e?.following) {
    library.setFollowing(item, false);
    toast(`Dejaste de seguir <b>${esc(displayTitle(item))}</b>`, { ic: 'bellOff', tone: 'violet' });
  } else {
    if (btn) burst(btn, 'var(--violet)');
    toast(`Siguiendo <b>${esc(displayTitle(item))}</b>. Te avisaré de lo nuevo`, { ic: 'bellRing', tone: 'violet' });
    await startFollowing(item);
  }
  updateNav(parseHash().path);
}

function onClick(ev) {
  const t = ev.target;

  // Animación de portada que "vuela" a la ficha
  const morph = t.closest('a[data-morph]');
  if (morph && document.startViewTransition && !reduceMotion()) {
    const img = morph.querySelector('.poster img.ok');
    if (img) {
      img.style.viewTransitionName = 'morph';
      pendingMorph = true;
    }
  }

  if (t.closest('[data-close]')) return closeModal();
  if (t.closest('[data-close-drawer]')) return closeDrawer();

  const a = t.closest('[data-act]');
  if (!a) return;
  const act = a.dataset.act;
  const key = a.dataset.key;
  const item = key ? itemFor(key) : null;

  if (act === 'status' && item) {
    ev.preventDefault();
    const e = library.setStatus(item, a.dataset.val);
    const on = e?.status === a.dataset.val;
    const [m1, m2, ic, tone] = STATUS_MSG[a.dataset.val];
    toast(on ? m1 : m2, { ic, tone });
    a.classList.add('bump');
    refreshCards(key);
  } else if (act === 'fav' && item) {
    ev.preventDefault();
    const e = library.toggleFavorite(item);
    if (e?.favorite) {
      burst(a, 'var(--rose)');
      toast(`<b>${esc(displayTitle(item))}</b> está en tus favoritas`, { ic: 'heart', tone: 'rose' });
    } else toast('Quitada de favoritas', { ic: 'heart' });
    refreshCards(key);
  } else if (act === 'follow' && item) {
    ev.preventDefault();
    toggleFollow(item, a);
  } else if (act === 'scroll') {
    const track = a.parentElement.querySelector('.track');
    track.scrollBy({ left: Number(a.dataset.dir) * track.clientWidth * 0.85, behavior: 'smooth' });
  } else if (act === 'trailer') {
    openTrailer(a.dataset.yt, a.dataset.title);
  } else if (act === 'open-notifs') {
    openNotifs();
  } else if (act === 'notifs-read') {
    notifs.markAll();
    openNotifs();
  } else if (act === 'notifs-check') {
    a.disabled = true;
    a.innerHTML = '<span class="spinner"></span> Revisando…';
    checkAll({ force: true }).then((n) => {
      toast(n ? `${n} aviso${n > 1 ? 's' : ''} nuevo${n > 1 ? 's' : ''}` : 'Todo al día, no hay nada nuevo', { ic: 'bell', tone: 'violet' });
      openNotifs();
      updateBell(true);
    });
  } else if (act === 'notif') {
    notifs.markRead(a.dataset.id);
    closeDrawer();
  }
}

/* ----------------------------- Avisos (campana) ----------------------------- */
function openNotifs() {
  const list = notifs.all();
  const followCount = library.all().filter((e) => e.following).length;
  const html = `
    <header class="drawer-head"><h2>Avisos</h2><button class="icon-btn" data-close-drawer aria-label="Cerrar">${icon('x')}</button></header>
    <div class="drawer-body">
      ${list.length ? list.map((n, i) => `
        <a class="notif ${n.read ? '' : 'unread'}" style="--i:${Math.min(i, 10)}" href="${esc(n.href)}" data-act="notif" data-id="${esc(n.id)}">
          ${posterHTML({ poster: n.poster, title: n.title, type: 'tv' }, 'w154')}
          <div><strong>${esc(n.title)}</strong><p>${esc(n.body)}</p><time>${timeAgo(n.at)}</time></div>
        </a>`).join('') : `<div class="empty">${icon('bellRing')}<h3>Sin avisos todavía</h3><p>${followCount ? `Sigues ${followCount} título${followCount > 1 ? 's' : ''}. Aquí te aviso cuando salga un episodio nuevo, una temporada o un estreno.` : 'Abre una serie o anime y toca <b>Seguir</b>. Te aviso aquí cuando salga un episodio nuevo.'}</p></div>`}
    </div>
    <footer class="drawer-foot">
      <button class="btn btn-sm" data-act="notifs-check">${icon('refresh')} Revisar ahora</button>
      ${list.some((n) => !n.read) ? `<button class="btn btn-sm btn-ghost" data-act="notifs-read">${icon('check')} Marcar leídos</button>` : ''}
      <a class="btn btn-sm btn-ghost" href="#/siguiendo" data-close-drawer>${icon('bell')} Siguiendo</a>
    </footer>`;
  const existing = $('#drawer-root .drawer');
  if (existing) existing.innerHTML = html;
  else openDrawer(html);
}

/* ----------------------------- Buscador con desplegable ----------------------------- */
let closeDropdown = () => {};
function setupSearch() {
  const input = $('#search-input');
  const field = $('#search-field');
  const dd = $('#search-dd');
  let seq = 0;
  let ctrl = null;
  let items = [];
  let active = -1;
  let lastQ = '';

  closeDropdown = () => {
    dd.classList.remove('open');
    active = -1;
  };

  const go = (i) => {
    const it = items[i];
    if (!it) return;
    location.hash = it.kind === 'person' ? `#/persona/${it.id}` : `#/titulo/${it.type}/${it.id}`;
    input.blur();
    closeDropdown();
  };
  const goAll = () => {
    const q = input.value.trim();
    if (!q) return;
    location.hash = `#/buscar?q=${encodeURIComponent(q)}`;
    input.blur();
    closeDropdown();
  };

  const paint = (q) => {
    if (!items.length) {
      dd.innerHTML = `<div class="dd-empty">No encontré nada para «${esc(q)}». Prueba con el título original o en inglés.</div>`;
    } else {
      dd.innerHTML = `<div class="dd-head">Resultados</div>${items.map((it, i) => it.kind === 'person'
        ? `<div class="dd-item ${i === active ? 'active' : ''}" data-i="${i}" role="option">
            <div class="avatar ${it.img ? '' : 'no-img'}">${it.img ? `<img src="${IMG(it.img, 'w92')}" alt="" onload="this.classList.add('ok')">` : ''}${icon('user')}</div>
            <div class="dd-main"><strong>${esc(it.name)}</strong><span>${esc(it.known)}</span></div><span class="dd-type">Persona</span></div>`
        : `<div class="dd-item ${i === active ? 'active' : ''}" data-i="${i}" role="option">
            ${posterHTML(it, 'w92')}
            <div class="dd-main"><strong>${esc(displayTitle(it))}${it.year ? ` <span style="display:inline;color:var(--dim);font-weight:400">(${it.year})</span>` : ''}</strong><span>${esc(it.originalTitle && it.originalTitle !== it.title ? it.originalTitle : it.overview || '')}</span></div>
            <span class="dd-type ${it.anime ? 'anime' : it.type}">${typeLabel(it)}</span></div>`).join('')}
        <div class="dd-foot" data-all>Ver todos los resultados de «${esc(q)}» ${icon('right')}</div>`;
    }
    dd.classList.add('open');
  };

  const run = debounce(async (q) => {
    if (q.length < 2) return closeDropdown();
    const my = ++seq;
    ctrl?.abort();
    ctrl = new AbortController();
    if (!dd.classList.contains('open') || !items.length) {
      dd.innerHTML = '<div class="dd-loading"><span class="spinner"></span> Buscando…</div>';
      dd.classList.add('open');
    }
    const ym = q.match(/^(.*\S)\s+((?:19|20)\d{2})$/);
    const query = ym ? ym[1] : q;
    try {
      const data = await searchMulti(query, 1, ctrl.signal);
      if (my !== seq) return; // llegó tarde: se ignora (así nunca cambia lo que tienes bajo el dedo)
      let list = (data.results || []).filter((r) => r.media_type !== 'person' || r.profile_path).map((r) => r.media_type === 'person'
        ? { kind: 'person', id: r.id, name: r.name, img: r.profile_path, known: (r.known_for || []).map((k) => k.title || k.name).slice(0, 2).join(', ') || r.known_for_department || '' }
        : { kind: 'title', ...norm(r) });
      if (ym) list.sort((a, b) => (b.year === ym[2]) - (a.year === ym[2]));
      items = list.slice(0, 8);
      items.forEach((it) => it.kind === 'title' && reg(it));
      active = -1;
      lastQ = q;
      paint(q);
    } catch (err) {
      if (err.name === 'AbortError' || my !== seq) return;
      dd.innerHTML = `<div class="dd-empty">${esc(err.message)}</div>`;
    }
  }, 260);

  input.addEventListener('input', () => {
    const q = input.value.trim();
    field.classList.toggle('has-value', !!input.value);
    if (q.length < 2) {
      seq++;
      closeDropdown();
      return;
    }
    run(q);
  });
  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 2 && items.length && lastQ === input.value.trim()) dd.classList.add('open');
  });
  input.addEventListener('keydown', (e) => {
    const n = items.length;
    if (e.key === 'ArrowDown' && n) {
      e.preventDefault();
      active = (active + 1) % n;
      paint(lastQ);
    } else if (e.key === 'ArrowUp' && n) {
      e.preventDefault();
      active = (active - 1 + n) % n;
      paint(lastQ);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0 && lastQ === input.value.trim()) go(active);
      else goAll();
    } else if (e.key === 'Escape') {
      closeDropdown();
      input.blur();
    }
  });
  dd.addEventListener('mousedown', (e) => e.preventDefault()); // que no se pierda el foco antes del clic
  dd.addEventListener('click', (e) => {
    if (e.target.closest('[data-all]')) return goAll();
    const row = e.target.closest('.dd-item');
    if (row) go(Number(row.dataset.i));
  });
  $('#search-clear').addEventListener('click', (e) => {
    e.preventDefault();
    input.value = '';
    field.classList.remove('has-value');
    seq++;
    items = [];
    closeDropdown();
    input.focus();
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#search-box')) closeDropdown();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && getComputedStyle($('#search-box')).display !== 'none') {
      e.preventDefault();
      input.focus();
      input.select();
    }
    if (e.key === 'Escape') {
      if ($('#modal-root').firstElementChild) closeModal();
      else if ($('#drawer-root').firstElementChild) closeDrawer();
    }
  });
}

/* ----------------------------- Estrellas (puntuación) ----------------------------- */
function starValue(el, clientX) {
  const r = el.getBoundingClientRect();
  return Math.max(1, Math.min(10, Math.ceil(((clientX - r.left) / r.width) * 10)));
}
function setupStars() {
  document.addEventListener('pointermove', (e) => {
    const s = e.target.closest?.('[data-stars]');
    if (!s || e.pointerType === 'touch') return;
    s.style.setProperty('--fill', `${starValue(s, e.clientX) * 10}%`);
  });
  document.addEventListener('pointerout', (e) => {
    const s = e.target.closest?.('[data-stars]');
    if (s && !s.contains(e.relatedTarget)) {
      const cur = library.get(s.dataset.key)?.rating || 0;
      s.style.setProperty('--fill', `${cur * 10}%`);
    }
  });
  const rate = (s, v) => {
    const item = itemFor(s.dataset.key);
    if (!item) return;
    const e = library.setRating(item, v);
    const val = e?.rating || 0;
    s.style.setProperty('--fill', `${val * 10}%`);
    s.setAttribute('aria-valuenow', val / 2);
    toast(val ? `Le diste ${String(val / 2).replace('.', ',')} ★` : 'Puntuación borrada', { ic: 'star', tone: 'gold' });
    refreshCards(s.dataset.key);
  };
  document.addEventListener('click', (e) => {
    const s = e.target.closest('[data-stars]');
    if (s) rate(s, starValue(s, e.clientX));
  });
  document.addEventListener('keydown', (e) => {
    const s = e.target.closest?.('[data-stars]');
    if (!s || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const cur = library.get(s.dataset.key)?.rating || 0;
    rate(s, Math.max(1, Math.min(10, cur + (e.key === 'ArrowRight' ? 1 : -1))));
  });
}

/* ----------------------------- Inicio ----------------------------- */
function init() {
  renderShell();
  setupSearch();
  setupStars();
  enableTilt(document.body);
  document.addEventListener('click', onClick);
  document.addEventListener('scroll', (e) => {
    if (e.target.classList?.contains('track')) updateScrollButtons(e.target.closest('.row'));
  }, true);
  addEventListener('scroll', () => $('#topbar').classList.toggle('scrolled', scrollY > 8), { passive: true });
  addEventListener('hashchange', navigate);
  bus.addEventListener('notifs', () => updateBell());
  bus.addEventListener('library', () => updateNav(parseHash().path));
  bus.addEventListener('settings', () => updateNav(parseHash().path));

  // Cuentas regresivas en vivo
  setInterval(() => $$('[data-countdown]').forEach((n) => (n.textContent = countdown(Number(n.dataset.countdown)))), 30e3);

  render();
  updateBell();

  // Revisar lo que sigues al abrir y cada 30 minutos mientras la app esté abierta
  const check = () => {
    if (!settings.get().tmdbKey) return;
    checkAll().then((n) => updateBell(n > 0));
  };
  if (Date.now() - meta.get('lastCheck', 0) > 20 * 60e3) setTimeout(check, 2500);
  setInterval(check, 30 * 60e3);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - meta.get('lastCheck', 0) > 30 * 60e3) check();
  });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
