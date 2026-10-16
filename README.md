# Pokebreed Ultimate (web)

Versión para navegador del **Pokebreed Ultimate clásico** (Game Maker 5.3, 2004-2010) de timeblade0.

No es una reimplementación: el juego ejecuta **el código original**. Su archivo de proyecto
(`pokebreed_ultimate.gmd`, de la rama `003_pokebreed_ultimate` de
[timeblade0/Pokebreed](https://github.com/timeblade0/Pokebreed)) se extrae y se ejecuta sobre un
pequeño runtime de Game Maker 5 escrito en TypeScript. Así, la cría, los cruces, la tienda, las
medallas, los textos y los sonidos son los mismos que en el `.exe`.

## Ejecutar

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # web estática en dist/
npm run preview    # sirve dist/ para probar el build
```

## Publicar (Cloudflare Pages u otro hosting estático)

El resultado de `npm run build` es una web 100 % estática (`dist/`, unos 640 archivos y 7 MB) que
no necesita servidor: las partidas se guardan en el navegador.

**Cloudflare Pages desde GitHub:** *Workers & Pages → Create → Pages → Connect to Git*, y elige este repositorio.

| Ajuste | Valor |
| --- | --- |
| Framework preset | `None` (o `Vite`) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node | 22 (lo toma de `.nvmrc`) |

**Cloudflare Pages desde tu PC:** `npm run deploy` (compila y sube `dist/` con Wrangler; la primera vez pide iniciar sesión).

`public/_headers` define la caché: los JS/CSS con hash se guardan para siempre y los datos del juego, un día.
Como las rutas son relativas (`base: './'`), también funciona en Netlify, Vercel, GitHub Pages o en una subcarpeta.

## Volver a extraer el juego

```bash
git clone -b 003_pokebreed_ultimate https://github.com/timeblade0/Pokebreed.git ../pokebreed-classic
npm run extract -- ../pokebreed-classic/pokebreed_ultimate.gmd
# opcional: volcado legible de todo el código del juego
npm run extract -- ../pokebreed-classic/pokebreed_ultimate.gmd --dump ../pokebreed-dump
```

Genera `public/classic/`:

- `game.json`: 750 objetos con sus eventos y acciones, 18 scripts, 2 rooms, el orden de los rooms y el texto de ayuda.
- `sprites/`: 490 sprites, en PNG y con transparencia.
- `backgrounds/`: los fondos.
- `sounds/`: efectos WAV y música MIDI.

## Cómo funciona

```
tools/gmd/        Lector del formato .gmd de Game Maker 5.3 (versión 530)
  reader.mjs      Lectura binaria (enteros, cadenas, bloques zlib)
  parse.mjs       Secciones: sonidos, sprites, fondos, paths, scripts, objetos, rooms
  image.mjs       BMP → PNG (color de transparencia = píxel inferior izquierdo, como GM)
  extract.mjs     Escribe public/classic/
src/gm/           Runtime de Game Maker 5
  gml.ts          Compilador de GML a JavaScript (con la semántica de GM5: `=` compara, 1/0, `var`...)
  actions.ts      Convierte las acciones "drag & drop" en JavaScript
  dnd.ts          Acciones estándar (mover, crear, alarmas, dibujar, preguntas...)
  functions.ts    Funciones GML (random, position_meeting, draw_text_ext, game_save...)
  runtime.ts      Objetos con herencia, instancias, eventos, colisiones y el ciclo de cada step
  instance.ts     Variables integradas (x, speed, direction, alarm...)
  render.ts       Canvas 2D con el modelo de dibujo de GM5 (font_*, brush_*, pen_*)
  input.ts        Teclado y ratón con códigos de GM (incluye keyboard_set_map)
  audio.ts        WAV con Web Audio y un sintetizador para la música MIDI
  dialogs.ts      show_message / get_string... con los diálogos del navegador
src/patches.ts    Cambios de interfaz sobre el original (ver abajo)
src/ui/           Pantalla de título, HUD, tienda, ficha del Pokémon, avisos y ventanas en HTML
src/i18n/         Idiomas: textos de la interfaz (ui.ts) y traducción al español del juego (game-es.ts)
src/main.ts       Carga, maquetación a pantalla completa y bucle a la velocidad del room
```

## Mejoras de la versión web

- **Pantalla completa:** el juego usa toda la ventana y toda su resolución, también en pantallas de alta densidad. La vista del rancho crece con la pantalla sin pasar del tamaño del room, y la rueda del ratón o los botones ➖/➕ hacen zoom.
- **Pantalla de título** con la ilustración original y menú: Nueva partida, Continuar, Cargar y Cómo se juega.
- **HUD** en HTML:
  - dinero, número de Pokémon, las 8 medallas y la velocidad (con − / +);
  - barra de herramientas: tienda, terreno, guardar, cargar, zoom, sonido, pantalla completa, idioma, ayuda y menú.
- **Español o inglés:** todo el juego, incluidos los textos originales (ayuda de la tienda, mensajes, preguntas, cruces de cría, medallas y la ayuda), se puede jugar entero en un idioma u otro. Se cambia con 🌐 en el título o en la barra, y se recuerda. Por defecto se usa el idioma del navegador. Los textos que falten en `game-es.ts` se muestran en inglés.
- **Tienda en un panel lateral** (`src/ui/shop.ts`): usa los botones originales (se dibujan con su propio evento Draw y reciben los mismos clics), pero el rancho sigue visible y en marcha. El original desactivaba todas las instancias mientras estaba abierta.
- **Ficha al pasar el ratón** sobre un Pokémon o huevo: nombre, género, barra de experiencia o eclosión y precio de venta.
- **Mensajes:** los de cría salen como avisos y los de `show_message` como ventanas propias.
- **Partidas:** ventana para guardar, cargar y borrar, más un autoguardado cada minuto que se usa para "Continuar".

Los recuadros pequeños del original (dinero, "Speed", "Exp") se ocultan mediante `src/patches.ts`,
que sustituye solo esos eventos de dibujo. La lógica del juego sigue siendo la original.

## Diferencias con el .exe

- **Partidas:** se guardan en el navegador (`localStorage`), no en archivos `.pbs`. Hay autoguardado.
- **Diálogos:** se usan los nativos del navegador. En `show_message_ext`, *Aceptar* es el primer botón y *Cancelar* el último.
- **Música:** los MIDI suenan con un sintetizador simple, así que el timbre no es el de Windows.
- **Esc → salir:** en lugar de cerrar el programa, se vuelve a empezar.

## Créditos

Juego original: timeblade0 (Scott West). Pokémon y sus nombres son propiedad de Nintendo,
Game Freak y The Pokémon Company. Proyecto de fans sin ánimo de lucro.
