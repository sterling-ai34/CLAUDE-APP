# 🎬 Cine Galions

Tu bóveda personal de películas, series y anime. Guarda lo que ves, por qué te gustó, recibe recomendaciones y sigue los próximos episodios de tus series y anime.

## Qué hace

- **Todo el catálogo**: películas, series y anime de [TMDB](https://www.themoviedb.org), con portadas, títulos en 🇲🇽 latino, 🇪🇸 España y original, tráilers, reparto, sagas y dónde verla.
- **Buscador**: busca en español, inglés o el título original. Si hay remakes, añade el año (`carrie 1976`).
- **Tu biblioteca**: Vista / Viendo / Por ver / Abandonada, favoritas ❤, estrellas (con medias), «¿por qué me gustó?», etiquetas, diario de fechas y estadísticas.
- **Para ti**: dado 3D con tres modos (según tus gustos, sorpréndeme y aleatorio total) y filas «Porque te gustó X».
- **Siguiendo**: sigue series y anime. Cuenta regresiva al próximo episodio (hora exacta de AniList en anime), control de episodios por temporada y avisos en la campana cuando sale algo nuevo.
- **Noticias**: medios reales de cine, series y anime (se actualizan solas), una pestaña «Sobre lo tuyo» y un calendario de estrenos.
- **Instalable** en el teléfono como app (PWA).

## Ponerla en línea (GitHub Pages)

1. En GitHub abre el repo → **Settings** → **Pages**.
2. En **Source** elige **Deploy from a branch**.
3. En **Branch** elige la rama donde está la app y la carpeta **/ (root)**. Dale a **Save**.
4. En 1–2 minutos aparece el enlace, algo como `https://<tu-usuario>.github.io/CLAUDE-APP/`.

> GitHub Pages gratis necesita que el repositorio sea **público**. Tu llave de TMDB y tus listas **no** están en el código: se guardan solo en tu navegador.

## Primer uso

1. Abre el enlace y pega tu **Clave de la API** de TMDB (themoviedb.org → Ajustes → API).
2. Para usarla en el teléfono: **Ajustes → Mostrar código QR** y escanéalo con la cámara. Se abre ya conectada.
3. Para instalarla: en Android, menú ⋮ → *Instalar app*; en iPhone, Compartir → *Agregar a inicio*.

## Tus datos

Todo se guarda en el navegador de cada dispositivo. Para pasar tus listas de la PC al teléfono (o tener respaldo) usa **Ajustes → Copia de seguridad**.

## Límites

- Los avisos de la campana se revisan cuando abres la app y cada 30 minutos mientras está abierta. Para recibir avisos con la app cerrada hace falta un pequeño servidor (se puede añadir más adelante).
- Las noticias pasan por un servicio intermedio gratuito (rss2json o un proxy CORS). Si alguno falla, la app lo indica y reintenta luego.

## Estructura

```
index.html              página principal
manifest.webmanifest    datos para instalarla como app
sw.js                   service worker (abre rápido / sin conexión)
assets/css/app.css      estilos y animaciones
assets/js/app.js        arranque, navegación, buscador, campana
assets/js/api.js        TMDB, AniList y noticias
assets/js/store.js      biblioteca, ajustes y avisos (localStorage)
assets/js/recs.js       motor de recomendaciones
assets/js/notify.js     seguimiento de episodios y avisos
assets/js/ui.js         componentes (tarjetas, filas, modales…)
assets/js/views/        cada pantalla
```

Este producto usa la API de TMDB pero no está respaldado ni certificado por TMDB.
