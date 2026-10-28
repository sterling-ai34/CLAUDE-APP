import { icon } from '../icons.js';
import { validateKey, DEFAULT_FEEDS } from '../api.js';
import { settings, library, notifs, meta } from '../store.js';
import { esc, toast, openModal, closeModal } from '../ui.js';

const REGIONS = { MX: '🇲🇽 México', US: '🇺🇸 Estados Unidos', ES: '🇪🇸 España', CO: '🇨🇴 Colombia', AR: '🇦🇷 Argentina', CL: '🇨🇱 Chile', PE: '🇵🇪 Perú', EC: '🇪🇨 Ecuador', VE: '🇻🇪 Venezuela', DO: '🇩🇴 República Dominicana' };
const CATS = { cine: 'Cine', series: 'Series', anime: 'Anime' };

export const maskKey = (k) => (k ? (k.length > 12 ? `${k.slice(0, 4)}••••••••${k.slice(-4)}` : '••••') : '');

export default function settingsView(el, ctx) {
  const s = settings.get();
  const total = library.count();
  el.innerHTML = `<div class="page settings">
    <header class="page-head"><div><span class="eyebrow">${icon('settings')} Ajustes</span><h1>Ajustes</h1></div></header>

    <section class="setting">
      <h3>${icon('key')} Llave de TMDB</h3>
      <p>Es lo que permite traer todo el catálogo de películas, series y anime. Se guarda solo en este navegador.</p>
      <div class="key-form">
        <input class="input" id="st-key" placeholder="${s.tmdbKey ? esc(maskKey(s.tmdbKey)) : 'Pega aquí tu Clave de la API'}" autocomplete="off" spellcheck="false">
        <button class="btn btn-primary" id="st-key-save">${icon('check')} ${s.tmdbKey ? 'Cambiar' : 'Guardar'}</button>
      </div>
      <p class="form-msg ${s.tmdbKey ? 'ok' : ''}" id="st-key-msg">${s.tmdbKey ? `Conectada (${esc(maskKey(s.tmdbKey))})` : ''}</p>
    </section>

    <section class="setting">
      <h3>${icon('qr')} Usarla en el teléfono (u otro equipo)</h3>
      <p>Escanea este código con la cámara del teléfono: se abre la app ya conectada, sin tener que escribir la llave. Tus listas se pasan con la copia de seguridad de abajo.</p>
      <button class="btn" id="st-qr">${icon('qr')} Mostrar código QR</button>
      <div id="st-qr-box"></div>
    </section>

    <section class="setting">
      <h3>${icon('download')} Copia de seguridad</h3>
      <p>Tus listas viven en este navegador (${total} título${total === 1 ? '' : 's'}). Descarga una copia de vez en cuando, o úsala para pasar tus listas de la PC al teléfono.</p>
      <div class="setting-row">
        <button class="btn" id="st-export">${icon('download')} Descargar copia</button>
        <label class="btn" style="position:relative">${icon('upload')} Cargar copia<input type="file" id="st-import" accept="application/json,.json" style="position:absolute;inset:0;opacity:0;cursor:pointer"></label>
      </div>
      <p class="form-msg" id="st-backup-msg">${meta.get('lastExport') ? `Última copia: ${new Date(meta.get('lastExport')).toLocaleDateString('es')}` : ''}</p>
    </section>

    <section class="setting">
      <h3>${icon('globe')} País</h3>
      <p>Para «dónde verla» (Netflix, Prime, Disney+…) y para las fechas de estreno en cines.</p>
      <select class="select" id="st-region">${Object.entries(REGIONS).map(([k, v]) => `<option value="${k}" ${s.region === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      ${s.region === 'DO' ? '<p class="warn" style="margin-top:10px">Ojo: TMDB casi no tiene datos de plataformas para República Dominicana. Si no ves dónde verla, usa México o Estados Unidos.</p>' : ''}
    </section>

    <section class="setting">
      <h3>${icon('translate')} Títulos</h3>
      <p>Cómo mostrar el nombre principal de cada película o serie.</p>
      <div class="seg" id="st-lang">
        <button data-v="latino" class="${s.titleLang !== 'original' ? 'active' : ''}">🇲🇽 Español latino</button>
        <button data-v="original" class="${s.titleLang === 'original' ? 'active' : ''}">🌐 Título original</button>
      </div>
    </section>

    <section class="setting">
      <h3>${icon('bellRing')} Notificaciones del sistema</h3>
      <p>Además de la campana, puedo mostrar un aviso del sistema cuando salga un episodio nuevo de lo que sigues. Funciona mientras la app esté abierta (o en segundo plano en el navegador).</p>
      <div class="setting-row">
        <label class="switch"><input type="checkbox" id="st-notif" ${s.browserNotifs && 'Notification' in window && Notification.permission === 'granted' ? 'checked' : ''}><i></i></label>
        <span id="st-notif-msg" style="font-size:14px;color:var(--muted)">${!('Notification' in window) ? 'Este navegador no soporta notificaciones.' : Notification.permission === 'denied' ? 'Bloqueadas en el navegador: actívalas en los permisos del sitio.' : 'Avisos del sistema'}</span>
      </div>
    </section>

    <section class="setting">
      <h3>${icon('news')} Fuentes de noticias</h3>
      <p>Medios de donde salen las noticias. Puedes apagar los que no te gusten o añadir otro con su enlace RSS.</p>
      <div id="st-feeds"></div>
      <details style="margin-top:12px"><summary style="cursor:pointer;color:var(--gold-2);font-weight:600;font-size:14px">Añadir otra fuente</summary>
        <div class="setting-row" style="margin-top:12px">
          <input class="input" id="st-feed-name" placeholder="Nombre (ej. Mi blog)" style="flex:1;min-width:140px">
          <input class="input" id="st-feed-url" placeholder="https://…/feed" style="flex:2;min-width:220px">
          <select class="select" id="st-feed-cat">${Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          <button class="btn" id="st-feed-add">${icon('plus')} Añadir</button>
        </div>
      </details>
    </section>

    <section class="setting">
      <h3>${icon('trash')} Borrar datos</h3>
      <p>Esto no se puede deshacer. Descarga una copia antes.</p>
      <div class="setting-row">
        <button class="btn btn-danger" id="st-clear-lib">${icon('trash')} Vaciar mi biblioteca</button>
        <button class="btn btn-danger" id="st-clear-all">${icon('trash')} Borrar todo (incluida la llave)</button>
      </div>
    </section>

    <p style="color:var(--dim);font-size:12.5px;margin:20px 0 0;line-height:1.6">Este producto usa la API de TMDB pero no está respaldado ni certificado por TMDB. Datos de anime en emisión: AniList. Dónde ver: JustWatch (vía TMDB).</p>
  </div>`;

  const $ = (sel) => el.querySelector(sel);

  /* Llave */
  $('#st-key-save').onclick = async () => {
    const k = $('#st-key').value.trim();
    const msg = $('#st-key-msg');
    if (!k) {
      msg.className = 'form-msg err';
      msg.textContent = 'Pega la llave primero.';
      return;
    }
    msg.className = 'form-msg';
    msg.innerHTML = '<span class="spinner" style="display:inline-block;vertical-align:middle"></span> Comprobando…';
    try {
      await validateKey(k);
      settings.set({ tmdbKey: k });
      msg.className = 'form-msg ok';
      msg.textContent = `¡Conectada! (${maskKey(k)})`;
      $('#st-key').value = '';
      $('#st-key').placeholder = maskKey(k);
      toast('Llave guardada', { ic: 'key', tone: 'gold' });
    } catch (err) {
      msg.className = 'form-msg err';
      msg.textContent = err.code === 'BAD_KEY' ? 'TMDB dice que esa llave no es válida. Copia la «Clave de la API» completa.' : `No se pudo comprobar: ${err.message}`;
    }
  };

  /* QR */
  $('#st-qr').onclick = async () => {
    const key = settings.get().tmdbKey;
    const box = $('#st-qr-box');
    if (!key) {
      box.innerHTML = '<p class="form-msg err">Primero guarda tu llave.</p>';
      return;
    }
    const url = `${location.origin}${location.pathname}#/conectar?k=${encodeURIComponent(key)}`;
    box.innerHTML = '<div class="load-more"><span class="spinner"></span></div>';
    let svg = '';
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js');
      const qr = window.qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      svg = qr.createSvgTag(5, 0);
    } catch { /* sin QR: queda el enlace */ }
    box.innerHTML = `<div class="qr-box">${svg ? `<div class="qr">${svg}</div>` : ''}
      <div style="flex:1;min-width:220px">
        <p style="color:var(--muted);font-size:14px">${svg ? 'Apunta la cámara del teléfono aquí.' : 'No se pudo generar el QR.'} También puedes copiar el enlace y mandártelo:</p>
        <button class="btn btn-sm" id="st-copy" style="margin-top:10px">${icon('copy')} Copiar enlace</button>
        <p class="warn" style="margin-top:10px">Este código lleva tu llave: no lo compartas con nadie.</p>
      </div></div>`;
    $('#st-copy').onclick = () => navigator.clipboard?.writeText(url).then(() => toast('Enlace copiado', { ic: 'copy' }), () => prompt('Copia el enlace:', url));
  };

  /* Copia de seguridad */
  $('#st-export').onclick = () => {
    const data = library.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cine-galions-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    meta.set('lastExport', Date.now());
    $('#st-backup-msg').textContent = 'Copia descargada.';
    toast('Copia descargada', { ic: 'download' });
  };
  $('#st-import').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const n = Object.keys(data.library || {}).length;
      const m = openModal(`<div class="modal-body"><h2>Cargar copia</h2><p>La copia tiene <b>${n}</b> títulos. ¿Qué quieres hacer?</p>
        <div class="modal-actions"><button class="btn" data-close>Cancelar</button><button class="btn" id="imp-replace">Reemplazar todo</button><button class="btn btn-primary" id="imp-merge">Juntar con lo que tengo</button></div></div>`);
      const go = (mode) => {
        try {
          library.importData(data, mode);
          toast(`Copia cargada (${n} títulos)`, { ic: 'upload' });
          closeModal();
          ctx.alive() && settingsView(el, ctx);
        } catch (err) {
          toast(err.message, { ic: 'info', tone: 'err' });
        }
      };
      m.querySelector('#imp-merge').onclick = () => go('merge');
      m.querySelector('#imp-replace').onclick = () => go('replace');
    } catch {
      toast('Ese archivo no es una copia válida', { ic: 'info', tone: 'err' });
    }
    e.target.value = '';
  };

  /* País y títulos */
  $('#st-region').onchange = (e) => {
    settings.set({ region: e.target.value });
    toast('País guardado', { ic: 'globe' });
    settingsView(el, ctx);
  };
  $('#st-lang').onclick = (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    settings.set({ titleLang: b.dataset.v });
    $('#st-lang').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
    toast('Listo', { ic: 'translate' });
  };

  /* Notificaciones */
  $('#st-notif').onchange = async (e) => {
    if (!('Notification' in window)) {
      e.target.checked = false;
      return;
    }
    if (e.target.checked) {
      const p = await Notification.requestPermission();
      if (p !== 'granted') {
        e.target.checked = false;
        $('#st-notif-msg').textContent = 'No diste permiso. Actívalo en los permisos del sitio del navegador.';
        return;
      }
      settings.set({ browserNotifs: true });
      $('#st-notif-msg').textContent = 'Activadas';
      try {
        const reg = await navigator.serviceWorker?.getRegistration();
        const opts = { body: 'Así se verán los avisos de nuevos episodios.', icon: 'assets/img/icon-192.png' };
        if (reg) reg.showNotification('Cine Galions', opts);
        else new Notification('Cine Galions', opts);
      } catch { /* nada */ }
    } else {
      settings.set({ browserNotifs: false });
      $('#st-notif-msg').textContent = 'Desactivadas';
    }
  };

  /* Fuentes */
  const paintFeeds = () => {
    const st = settings.get();
    const feeds = [...DEFAULT_FEEDS, ...(st.customFeeds || [])];
    $('#st-feeds').innerHTML = feeds.map((f) => `<div class="feed-row">
      <div class="grow"><strong>${esc(f.name)}</strong> <span style="display:inline;color:var(--dim);font-size:12px">· ${CATS[f.cat] || f.cat} · ${f.lang === 'en' ? 'inglés' : 'español'}</span><span>${esc(f.url)}</span></div>
      ${f.custom ? `<button class="icon-btn" data-rmfeed="${esc(f.id)}" aria-label="Quitar">${icon('trash')}</button>` : ''}
      <label class="switch"><input type="checkbox" data-feed="${esc(f.id)}" ${(st.disabledFeeds || []).includes(f.id) ? '' : 'checked'}><i></i></label>
    </div>`).join('');
  };
  paintFeeds();
  $('#st-feeds').onchange = (e) => {
    const id = e.target.dataset.feed;
    if (!id) return;
    const dis = new Set(settings.get().disabledFeeds || []);
    e.target.checked ? dis.delete(id) : dis.add(id);
    settings.set({ disabledFeeds: [...dis] });
  };
  $('#st-feeds').onclick = (e) => {
    const b = e.target.closest('[data-rmfeed]');
    if (!b) return;
    settings.set({ customFeeds: (settings.get().customFeeds || []).filter((f) => f.id !== b.dataset.rmfeed) });
    paintFeeds();
  };
  $('#st-feed-add').onclick = () => {
    const name = $('#st-feed-name').value.trim();
    const url = $('#st-feed-url').value.trim();
    if (!/^https?:\/\//.test(url)) return toast('Pon un enlace que empiece por https://', { ic: 'info', tone: 'err' });
    const f = { id: `custom-${Date.now()}`, name: name || new URL(url).hostname, url, cat: $('#st-feed-cat').value, lang: 'es', custom: true };
    settings.set({ customFeeds: [...(settings.get().customFeeds || []), f] });
    $('#st-feed-name').value = '';
    $('#st-feed-url').value = '';
    paintFeeds();
    toast('Fuente añadida', { ic: 'news' });
  };

  /* Borrar */
  const confirmDo = (title, text, fn) => {
    const m = openModal(`<div class="modal-body"><h2>${title}</h2><p>${text}</p><div class="modal-actions"><button class="btn" data-close>Cancelar</button><button class="btn btn-danger" id="cf-ok">Sí, borrar</button></div></div>`);
    m.querySelector('#cf-ok').onclick = () => {
      fn();
      closeModal();
    };
  };
  $('#st-clear-lib').onclick = () => confirmDo('¿Vaciar tu biblioteca?', 'Se borran todas tus vistas, favoritas, notas, puntuaciones y lo que sigues.', () => {
    library.clear();
    notifs.clear();
    toast('Biblioteca vaciada', { ic: 'trash' });
    settingsView(el, ctx);
  });
  $('#st-clear-all').onclick = () => confirmDo('¿Borrar todo?', 'Se borra tu biblioteca, los avisos y la llave de TMDB de este navegador.', () => {
    try {
      Object.keys(localStorage).filter((k) => k.startsWith('galions.')).forEach((k) => localStorage.removeItem(k));
    } catch { /* nada */ }
    location.hash = '#/';
    location.reload();
  });
}

function loadScript(src) {
  return new Promise((res, rej) => {
    if ([...document.scripts].some((s) => s.src === src)) return res();
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = rej;
    document.head.appendChild(s);
  });
}
