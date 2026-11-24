# Portafolio Martín — Retro Arcade
**Estudiante:** Martín Donoso · Universidad Adolfo Ibáñez  
**Sitio web:** [Ver portafolio](https://martindonoso2005-cell.github.io/Portafolio/)

---

## Descripción
Portafolio web con estética arcade retro (pixel art y fuente *Press Start 2P*) que reúne mis proyectos de diseño de interfaces: interfaces físicas, sonoras, de realidad aumentada y virtual, y visión por computador. Cada proyecto es una "ventana" que abre su página.

## Proyectos
| Proyecto | Tipo |
|---|---|
| [Anime Emotion & Hand Music](https://martindonoso2005-cell.github.io/Portafolio/experimentos/anime-emotion.html) | Visión por computador + audio |
| [Sendero de Unicornios VR](https://martindonoso2005-cell.github.io/vr-sendero-unicornios/) | Realidad virtual |
| [CTRL-02 Controlador MIDI](https://martindonoso2005-cell.github.io/Interfaz-Midi/) | Interfaz física |
| [Robot Face](https://martindonoso2005-cell.github.io/Portafolio/robotface/) | Interfaz física con IA |
| [Botella UAI en Realidad Aumentada](https://martindonoso2005-cell.github.io/Portafolio/realidad-aumentada/) | Realidad aumentada |
| [Juego de Salto por Voz](https://martindonoso2005-cell.github.io/juego/) | Juego por voz |
| [Adivinar Sonido](https://martindonoso2005-cell.github.io/Juego-Adivinar-Sonido/) | Juego sonoro |
| [Sonificador de Datos](https://martindonoso2005-cell.github.io/Sonficador-de-datos/) | Sonificación |
| [Sintetizador](https://martindonoso2005-cell.github.io/sintetizador/) | Síntesis sonora (Max/MSP) |
| [Interfaz Electrodoméstico](https://martindonoso2005-cell.github.io/Interfaz-electrodomestico/) | Análisis de interfaz |
| [Sonificador 2.0](https://martindonoso2005-cell.github.io/Sonificador-2.0/) | Sonificación de imágenes |

## Estructura
- `index.html`: la página principal. Los proyectos que ven los visitantes están en la lista `DEFAULT_PROJECTS`.
- `img/`: portadas de las tarjetas.
- `robotface/`: página del proyecto Robot Face (ojos interactivos y panel para conversar con el robot).
- `realidad-aumentada/`: experiencia AR de la botella UAI.
- `experimentos/`: apps experimentales, como Anime Emotion & Hand Music.
- `servidor/worker.js`: intermediario de Cloudflare que guarda la clave de Claude para Robot Face (no contiene secretos).

## Cómo agregar un proyecto
Agrega una entrada a `DEFAULT_PROJECTS` en `index.html` con un `id` nuevo, el título, el enlace, la portada (en `img/`), una descripción corta y la categoría.

El botón **MODO GESTOR** solo guarda cambios en tu propio navegador; para que todos los vean hay que editar `index.html` y subirlo a GitHub.
