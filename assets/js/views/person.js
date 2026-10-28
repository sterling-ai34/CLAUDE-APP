import { icon } from '../icons.js';
import { person, norm, IMG } from '../api.js';
import { esc, cardHTML, emptyHTML, fmtDate } from '../ui.js';

const DEPTS = { Acting: 'Actuación', Directing: 'Dirección', Writing: 'Guion', Production: 'Producción', Sound: 'Música', Camera: 'Fotografía', Editing: 'Montaje' };

export default function personView(el, ctx) {
  const id = Number(ctx.params[0]);
  el.innerHTML = `<div class="page"><div class="person-head"><div class="avatar skel" style="width:180px;border-radius:22px"></div><div class="grow"><div class="skel" style="height:40px;width:50%;border-radius:10px"></div></div></div><div class="grid" id="pp-grid"></div></div>`;

  person(id).then((p) => {
    if (!ctx.alive()) return;
    const bioEs = p.biography;
    const bioEn = p.translations?.translations?.find((t) => t.iso_639_1 === 'en')?.data?.biography;
    const bio = bioEs || bioEn || '';
    const credits = [...(p.combined_credits?.cast || []), ...(p.combined_credits?.crew || []).filter((c) => ['Director', 'Screenplay', 'Writer', 'Creator'].includes(c.job))];
    const seen = new Set();
    const items = credits
      .filter((c) => (c.media_type === 'movie' || c.media_type === 'tv') && !(c.media_type === 'tv' && (c.genre_ids || []).some((g) => g === 10767 || g === 10763)))
      .map((c) => ({ ...norm(c, c.media_type), role: c.character || c.job || '' }))
      .filter((it) => !seen.has(`${it.type}:${it.id}`) && seen.add(`${it.type}:${it.id}`));
    let sort = 'popular';
    const age = p.birthday ? Math.floor((new Date(p.deathday || Date.now()) - new Date(p.birthday)) / 3.15576e10) : null;

    el.innerHTML = `<div class="page">
      <div class="person-head">
        <div class="avatar ${p.profile_path ? '' : 'no-img'}">${p.profile_path ? `<img src="${IMG(p.profile_path, 'h632')}" alt="" onload="this.classList.add('ok')">` : ''}${icon('user')}</div>
        <div class="grow">
          <span class="eyebrow">${icon('user')} ${esc(DEPTS[p.known_for_department] || p.known_for_department || 'Persona')}</span>
          <h1>${esc(p.name)}</h1>
          <div class="meta-row">
            ${p.birthday ? `<span class="meta-chip">${icon('calendar')}${fmtDate(p.birthday)}${age != null ? ` · ${age} años` : ''}</span>` : ''}
            ${p.place_of_birth ? `<span class="meta-chip">${icon('globe')}${esc(p.place_of_birth)}</span>` : ''}
            <span class="meta-chip">${items.length} títulos</span>
          </div>
          ${bio ? `<p class="bio" id="pp-bio">${esc(bio)}</p>${bio.length > 500 ? '<button class="btn btn-sm btn-ghost" id="pp-more" style="margin-top:10px">Leer más</button>' : ''}${!bioEs && bioEn ? '<p style="font-size:12.5px;color:var(--dim);margin-top:6px">Biografía en inglés</p>' : ''}` : ''}
        </div>
      </div>
      <div class="toolbar"><h2 style="font-size:22px">Filmografía</h2><span class="grow"></span>
        <div class="seg" id="pp-sort"><button data-s="popular" class="active">Más conocidas</button><button data-s="new">Más recientes</button><button data-s="old">Más antiguas</button></div>
      </div>
      <div class="grid" id="pp-grid"></div>
    </div>`;
    const grid = el.querySelector('#pp-grid');
    const paint = () => {
      const list = [...items].sort((a, b) => sort === 'popular' ? b.votes - a.votes : sort === 'new' ? (b.date || '9999').localeCompare(a.date || '9999') : (a.date || '9999').localeCompare(b.date || '9999'));
      grid.innerHTML = list.length ? list.slice(0, 120).map((it, i) => cardHTML(it, i, { sub: [it.year, it.role].filter(Boolean).join(' · ') })).join('') : emptyHTML('film', 'Sin títulos', '');
    };
    paint();
    el.querySelector('#pp-sort').onclick = (e) => {
      const b = e.target.closest('[data-s]');
      if (!b) return;
      sort = b.dataset.s;
      el.querySelectorAll('#pp-sort button').forEach((x) => x.classList.toggle('active', x === b));
      paint();
    };
    el.querySelector('#pp-more')?.addEventListener('click', (e) => {
      el.querySelector('#pp-bio').classList.toggle('full');
      e.target.textContent = el.querySelector('#pp-bio').classList.contains('full') ? 'Leer menos' : 'Leer más';
    });
  }).catch((err) => {
    if (ctx.alive()) el.innerHTML = `<div class="page">${emptyHTML('info', 'No se pudo cargar', esc(err.message))}</div>`;
  });
}
