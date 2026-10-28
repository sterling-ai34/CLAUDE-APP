// Componentes y utilidades de interfaz.
import { icon } from './icons.js';
import { IMG } from './api.js';
import { library, settings, keyOf } from './store.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Registro de títulos mostrados, para que los botones rápidos sepan a qué título se refieren. */
export const registry = new Map();
export function reg(it) {
  const k = keyOf(it);
  const prev = registry.get(k);
  registry.set(k, prev ? { ...prev, ...Object.fromEntries(Object.entries(it).filter(([, v]) => v !== undefined && v !== '' && v !== null)) } : it);
  return k;
}
export const itemFor = (key) => registry.get(key) || library.get(key);

export const displayTitle = (it) => (settings.get().titleLang === 'original' && it.originalTitle ? it.originalTitle : it.title);
export const altTitle = (it) => {
  const main = displayTitle(it);
  const other = main === it.title ? it.originalTitle : it.title;
  return other && other.toLowerCase() !== main.toLowerCase() ? other : '';
};
export const typeLabel = (it) => (it.anime ? 'Anime' : it.type === 'tv' ? 'Serie' : 'Película');

/* ----------------------------- Fechas ----------------------------- */
const dtf = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' });
const dtfShort = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });
const dtfLong = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
export const parseDate = (s) => (s ? new Date(`${s}T12:00:00`) : null);
export const fmtDate = (s, short = false) => {
  const d = typeof s === 'string' ? parseDate(s) : new Date(s);
  if (!d || isNaN(d)) return '';
  return short && d.getFullYear() === new Date().getFullYear() ? dtfShort.format(d) : dtf.format(d);
};
export const fmtDateTime = (ms) => dtfLong.format(new Date(ms));
export function daysUntil(s) {
  const d = parseDate(s);
  if (!d) return null;
  const t = new Date();
  t.setHours(12, 0, 0, 0);
  return Math.round((d - t) / 864e5);
}
export function relDay(s) {
  const n = daysUntil(s);
  if (n == null) return '';
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  if (n === -1) return 'ayer';
  if (n > 1 && n < 7) return `en ${n} días`;
  if (n < 0 && n > -7) return `hace ${-n} días`;
  return fmtDate(s, true);
}
export function timeAgo(ms) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'ahora';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `hace ${d} d`;
  return fmtDate(ms);
}
export function countdown(ms) {
  let s = Math.max(0, Math.floor((ms - Date.now()) / 1000));
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return m > 0 ? `${m} min` : '¡ya!';
}

/* ----------------------------- Póster y tarjetas ----------------------------- */
export function posterHTML(it, size = 'w342', cls = '') {
  const src = IMG(it.poster, size);
  return `<div class="poster ${cls} ${src ? '' : 'no-img'}">
    ${src ? `<img src="${src}" alt="" loading="lazy" decoding="async" onload="this.classList.add('ok')" onerror="this.parentNode.classList.add('no-img');this.remove()">` : ''}
    <div class="poster-ph">${icon(it.type === 'tv' ? 'tv' : 'film')}<span>${esc(displayTitle(it))}</span></div>
  </div>`;
}

export function badgesHTML(e) {
  if (!e) return '';
  const b = [];
  if (e.favorite) b.push(`<span class="bdg bdg-fav" title="Favorita">${icon('heart')}</span>`);
  if (e.status === 'watched') b.push(`<span class="bdg bdg-ok" title="Vista">${icon('check')}</span>`);
  if (e.status === 'watching') b.push(`<span class="bdg bdg-on" title="Viendo">${icon('eye')}</span>`);
  if (e.status === 'watchlist') b.push(`<span class="bdg bdg-list" title="Por ver">${icon('bookmark')}</span>`);
  if (e.following) b.push(`<span class="bdg bdg-follow" title="Siguiendo">${icon('bell')}</span>`);
  if (e.rating) b.push(`<span class="bdg bdg-rate">${icon('star')}${(e.rating / 2).toString().replace('.', ',')}</span>`);
  return b.join('');
}

export function cardActionsHTML(k, e) {
  return `<div class="card-actions">
    <button class="ca ${e?.status === 'watchlist' ? 'on' : ''}" data-act="status" data-val="watchlist" data-key="${k}" title="Por ver" aria-label="Por ver">${icon('bookmark')}</button>
    <button class="ca ${e?.status === 'watched' ? 'on' : ''}" data-act="status" data-val="watched" data-key="${k}" title="Ya la vi" aria-label="Vista">${icon('check')}</button>
    <button class="ca ca-fav ${e?.favorite ? 'on' : ''}" data-act="fav" data-key="${k}" title="Favorita" aria-label="Favorita">${icon('heart')}</button>
  </div>`;
}

/** opts.sub: texto alternativo debajo del título (p. ej. fecha de estreno). opts.label: etiqueta sobre el póster. */
export function cardHTML(it, i = 0, opts = {}) {
  const k = reg(it);
  const e = library.get(k);
  const sub = opts.sub ?? [it.year || 'Próximamente', typeLabel(it)].filter(Boolean).join(' · ');
  return `<article class="card" style="--i:${Math.min(i, 14)}" data-key="${k}">
    <div class="card-media">
      <a class="card-link" href="#/titulo/${it.type}/${it.id}" data-morph>
        ${posterHTML(it)}
        <div class="card-badges">${badgesHTML(e)}</div>
        ${opts.label ? `<span class="card-label">${opts.label}</span>` : it.vote >= 0.1 ? `<span class="score-pill">${icon('star')}${it.vote.toFixed(1)}</span>` : ''}
      </a>
      ${cardActionsHTML(k, e)}
    </div>
    <div class="card-info">
      <h3 class="card-title" title="${esc(displayTitle(it))}">${esc(displayTitle(it))}</h3>
      <p class="card-meta">${opts.subHTML || esc(sub)}</p>
      ${opts.reason ? `<p class="card-reason">${esc(opts.reason)}</p>` : ''}
    </div>
  </article>`;
}

/** Actualiza en sitio todas las tarjetas de un título después de un cambio. */
export function refreshCards(key) {
  const e = library.get(key);
  for (const card of $$(`.card[data-key="${CSS.escape(key)}"]`)) {
    const b = $('.card-badges', card);
    if (b) b.innerHTML = badgesHTML(e);
    const a = $('.card-actions', card);
    if (a) a.outerHTML = cardActionsHTML(key, e);
  }
}

export function personCardHTML(p, i = 0, sub = '') {
  const src = IMG(p.profile_path, 'w185');
  return `<a class="person-card" style="--i:${Math.min(i, 14)}" href="#/persona/${p.id}">
    <div class="avatar ${src ? '' : 'no-img'}">${src ? `<img src="${src}" alt="" loading="lazy" onload="this.classList.add('ok')" onerror="this.parentNode.classList.add('no-img');this.remove()">` : ''}${icon('user')}</div>
    <strong>${esc(p.name)}</strong>
    ${sub ? `<span>${esc(sub)}</span>` : ''}
  </a>`;
}

/* ----------------------------- Filas horizontales ----------------------------- */
export function skeletonCards(n = 8) {
  return Array.from({ length: n }, () => `<div class="card card-skel"><div class="poster skel"></div><div class="skel skel-line"></div><div class="skel skel-line short"></div></div>`).join('');
}

export function rowHTML(id, title, opts = {}) {
  return `<section class="row ${opts.cls || ''}" data-row="${id}">
    <header class="row-head">
      <div>
        <h2>${opts.icon ? icon(opts.icon) : ''}${esc(title)}</h2>
        ${opts.sub ? `<p>${esc(opts.sub)}</p>` : ''}
      </div>
      ${opts.link ? `<a class="row-more" href="${opts.link}">Ver todo ${icon('right')}</a>` : ''}
    </header>
    <div class="scroller">
      <button class="scroll-btn prev" data-act="scroll" data-dir="-1" aria-label="Anterior">${icon('left')}</button>
      <div class="track">${opts.html ?? skeletonCards(opts.skeleton || 8)}</div>
      <button class="scroll-btn next" data-act="scroll" data-dir="1" aria-label="Siguiente">${icon('right')}</button>
    </div>
  </section>`;
}

/** Llena una fila con tarjetas cuando llegan los datos (o la quita si no hay nada). */
export async function fillRow(root, id, loader, render = (it, i) => cardHTML(it, i)) {
  const row = root.querySelector(`[data-row="${id}"]`);
  if (!row) return;
  try {
    const items = await loader();
    if (!row.isConnected) return;
    if (!items || !items.length) return row.remove();
    $('.track', row).innerHTML = items.map(render).join('');
    row.classList.add('loaded');
    updateScrollButtons(row);
  } catch (err) {
    if (!row.isConnected) return;
    $('.track', row).innerHTML = `<div class="row-error">${icon('info')} No se pudo cargar: ${esc(err.message)}</div>`;
  }
}

export function updateScrollButtons(row) {
  const track = $('.track', row);
  if (!track) return;
  const prev = $('.scroll-btn.prev', row);
  const next = $('.scroll-btn.next', row);
  const max = track.scrollWidth - track.clientWidth - 4;
  prev?.classList.toggle('hide', track.scrollLeft <= 4);
  next?.classList.toggle('hide', track.scrollLeft >= max);
}

/* ----------------------------- Toasts ----------------------------- */
export function toast(msg, { ic = 'check', tone = '' } = {}) {
  const root = $('#toasts');
  const t = document.createElement('div');
  t.className = `toast ${tone}`;
  t.innerHTML = `${icon(ic)}<span>${msg}</span>`;
  root.appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    t.addEventListener('animationend', () => t.remove(), { once: true });
    setTimeout(() => t.remove(), 600);
  }, 2600);
}

/* ----------------------------- Modal y panel lateral ----------------------------- */
let lastFocus = null;
export function openModal(html, { cls = '', onClose } = {}) {
  closeModal();
  lastFocus = document.activeElement;
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-wrap ${cls}" role="dialog" aria-modal="true">
    <div class="modal-backdrop" data-close></div>
    <div class="modal">${html}</div>
  </div>`;
  root._onClose = onClose;
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => root.firstElementChild?.classList.add('open'));
  return $('.modal', root);
}
export function closeModal() {
  const root = $('#modal-root');
  if (!root.firstElementChild) return;
  const w = root.firstElementChild;
  root._onClose?.();
  root._onClose = null;
  w.classList.remove('open');
  w.classList.add('closing');
  setTimeout(() => {
    if (w.parentNode) w.remove();
    if (!$('#drawer-root').firstElementChild) document.body.classList.remove('no-scroll');
  }, 220);
  lastFocus?.focus?.();
}

export function openDrawer(html) {
  const root = $('#drawer-root');
  root.innerHTML = `<div class="drawer-wrap"><div class="modal-backdrop" data-close-drawer></div><aside class="drawer">${html}</aside></div>`;
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => root.firstElementChild?.classList.add('open'));
  return $('.drawer', root);
}
export function closeDrawer() {
  const root = $('#drawer-root');
  const w = root.firstElementChild;
  if (!w) return;
  w.classList.remove('open');
  setTimeout(() => {
    w.remove();
    if (!$('#modal-root').firstElementChild) document.body.classList.remove('no-scroll');
  }, 260);
}

export function openTrailer(ytKey, title = '') {
  openModal(`<div class="trailer">
    <header><strong>${esc(title)}</strong><button class="icon-btn" data-close aria-label="Cerrar">${icon('x')}</button></header>
    <div class="trailer-frame"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(ytKey)}?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="Tráiler"></iframe></div>
  </div>`, { cls: 'modal-trailer' });
}

/* ----------------------------- Estrellas ----------------------------- */
export function starsHTML(value = 0, key = '', interactive = true) {
  const pct = (value / 10) * 100;
  const stars = Array.from({ length: 5 }, () => icon('star')).join('');
  return `<div class="stars ${interactive ? 'interactive' : ''}" ${interactive ? `data-stars data-key="${key}" role="slider" aria-label="Tu puntuación" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${value / 2}" tabindex="0"` : ''} style="--fill:${pct}%">
    <div class="stars-base">${stars}</div><div class="stars-fill">${stars}</div>
  </div>`;
}

/* ----------------------------- Efectos ----------------------------- */
export function burst(el, color = 'var(--rose)') {
  if (reduceMotion() || !el) return;
  const r = el.getBoundingClientRect();
  const layer = document.createElement('div');
  layer.className = 'burst';
  layer.style.left = `${r.left + r.width / 2}px`;
  layer.style.top = `${r.top + r.height / 2}px`;
  for (let i = 0; i < 10; i++) {
    const p = document.createElement('i');
    const a = (i / 10) * Math.PI * 2;
    p.style.setProperty('--dx', `${Math.cos(a) * 34}px`);
    p.style.setProperty('--dy', `${Math.sin(a) * 34}px`);
    p.style.background = color;
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 700);
}

/** Inclinación 3D sutil al pasar el ratón (solo en pantallas con ratón). */
export function enableTilt(root) {
  if (reduceMotion() || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  root.addEventListener('pointermove', (ev) => {
    const link = ev.target.closest?.('.card-link');
    if (!link) return;
    const r = link.getBoundingClientRect();
    const x = (ev.clientX - r.left) / r.width - 0.5;
    const y = (ev.clientY - r.top) / r.height - 0.5;
    link.style.setProperty('--rx', `${(-y * 8).toFixed(2)}deg`);
    link.style.setProperty('--ry', `${(x * 10).toFixed(2)}deg`);
    link.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(1)}%`);
    link.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(1)}%`);
  });
  root.addEventListener('pointerout', (ev) => {
    const link = ev.target.closest?.('.card-link');
    if (link && !link.contains(ev.relatedTarget)) {
      link.style.removeProperty('--rx');
      link.style.removeProperty('--ry');
    }
  });
}

export function emptyHTML(ic, title, text, action = '') {
  return `<div class="empty">${icon(ic)}<h3>${title}</h3><p>${text}</p>${action}</div>`;
}

/** Scroll infinito: llama a `more()` cuando el centinela entra en pantalla. */
export function infinite(sentinel, more, ctx) {
  let busy = false;
  const io = new IntersectionObserver(async (entries) => {
    if (!entries[0].isIntersecting || busy) return;
    busy = true;
    try {
      const done = await more();
      if (done) io.disconnect();
    } finally {
      busy = false;
    }
    // si aún se ve el centinela, seguir cargando
    if (sentinel.isConnected && sentinel.getBoundingClientRect().top < innerHeight + 400) {
      io.unobserve(sentinel);
      io.observe(sentinel);
    }
  }, { rootMargin: '600px 0px' });
  io.observe(sentinel);
  ctx?.onCleanup(() => io.disconnect());
  return io;
}

export const debounce = (fn, ms) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};

export const shuffle = (a) => {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
