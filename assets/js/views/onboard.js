import { icon, logo } from '../icons.js';
import { validateKey } from '../api.js';
import { settings } from '../store.js';
import { checkToken, syncNow } from '../sync.js';
import { esc } from '../ui.js';

export default function onboard(el) {
  el.innerHTML = `<div class="page onboard"><div class="onboard-card">
    ${logo()}
    <h1>Bienvenido a Cine Galions</h1>
    <p>Tu bóveda de películas, series y anime. Para traer <b>todo</b> el catálogo (con portadas, títulos en español, tráilers y fechas de estreno) necesito tu llave gratuita de TMDB. Solo se pide una vez y se queda guardada en este navegador.</p>
    <ol class="steps">
      <li><span>Entra a <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">themoviedb.org → Ajustes → API</a> (con tu cuenta).</span></li>
      <li><span>Copia la que dice <b>«Clave de la API»</b> (la corta, de 32 letras y números).</span></li>
      <li><span>Pégala aquí abajo y dale a <b>Entrar</b>.</span></li>
    </ol>
    <form class="key-form" id="ob-form">
      <input class="input" id="ob-key" placeholder="Pega tu Clave de la API" autocomplete="off" spellcheck="false" autofocus>
      <button class="btn btn-primary" type="submit">${icon('right')} Entrar</button>
    </form>
    <p class="form-msg" id="ob-msg"></p>
  </div></div>`;

  el.querySelector('#ob-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const k = el.querySelector('#ob-key').value.trim();
    const msg = el.querySelector('#ob-msg');
    if (!k) return;
    msg.className = 'form-msg';
    msg.innerHTML = '<span class="spinner" style="display:inline-block;vertical-align:middle"></span> Comprobando con TMDB…';
    try {
      await validateKey(k);
      settings.set({ tmdbKey: k });
      msg.className = 'form-msg ok';
      msg.textContent = '¡Listo! Entrando…';
      setTimeout(() => {
        if (location.hash === '' || location.hash === '#/') dispatchEvent(new HashChangeEvent('hashchange'));
        else location.hash = '#/';
      }, 400);
    } catch (err) {
      msg.className = 'form-msg err';
      msg.textContent = err.code === 'BAD_KEY'
        ? 'TMDB dice que esa llave no es válida. Asegúrate de copiar la «Clave de la API» completa.'
        : `No pude conectar con TMDB (${esc(err.message)}). Revisa tu internet e inténtalo otra vez.`;
    }
  });
}

/** Enlace del QR: #/conectar?k=LLAVE */
export async function connect(el, ctx) {
  const k = (ctx.query.get('k') || '').trim();
  el.innerHTML = `<div class="page onboard"><div class="onboard-card" style="text-align:center">${logo()}<h1>Conectando…</h1><p id="cn-msg"><span class="spinner" style="display:inline-block"></span></p></div></div>`;
  const msg = el.querySelector('#cn-msg');
  if (!k) {
    msg.textContent = 'El enlace no trae ninguna llave.';
    return;
  }
  try {
    await validateKey(k);
    settings.set({ tmdbKey: k });
    const g = (ctx.query.get('g') || '').trim();
    // quita las llaves de la barra de direcciones
    history.replaceState(null, '', location.pathname + '#/');
    if (g) {
      msg.textContent = 'Vinculando tus listas…';
      try {
        await checkToken(g);
        settings.set({ gistToken: g, gistId: '' });
        await syncNow();
        msg.textContent = '¡Conectado y vinculado! Tus listas ya están aquí.';
      } catch (err) {
        msg.textContent = `Conectado, pero no pude vincular tus listas: ${err.message}. Puedes hacerlo en Ajustes.`;
      }
    } else msg.textContent = '¡Conectado! Ya puedes usar la app en este dispositivo.';
    setTimeout(() => dispatchEvent(new HashChangeEvent('hashchange')), 1200);
  } catch (err) {
    msg.textContent = err.code === 'BAD_KEY' ? 'La llave del enlace no es válida.' : `No pude conectar con TMDB: ${err.message}`;
  }
}
