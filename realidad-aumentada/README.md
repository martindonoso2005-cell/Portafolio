# Botella UAI – Realidad Aumentada Web (A-Frame + AR.js NFT)

Al apuntar la cámara a `assets/marcador.png`, aparece el modelo `assets/models/botella.glb` sobre la imagen.

## Estructura
```
ar-web/
├─ index.html              página AR (A-Frame 1.3.0 + AR.js 3.4.5 NFT)
├─ iniciar-servidor.bat    servidor local en http://localhost:8000
└─ assets/
   ├─ marcador.png         imagen que se debe mostrar a la cámara
   ├─ nft/botella.fset|.fset3|.iset   descriptores NFT del marcador
   └─ models/botella.glb   modelo 3D
```

## Probar en el PC
Doble clic en `iniciar-servidor.bat` (requiere Python) y abre el marcador en otra pantalla o impreso.
La página debe abrirse por `http://localhost`, no con doble clic al HTML (la cámara y la carga de archivos no funcionan con `file://`).

## Probar en el celular
Los navegadores móviles solo dan acceso a la cámara por **HTTPS**. Opciones:
- Subir la carpeta `ar-web` a GitHub Pages / Netlify / Vercel.
- O exponer el servidor local con un túnel HTTPS (ngrok, cloudflared).

## Ajustes por URL
- `?altura=500` → altura del modelo en mm (unidades del marcador; el marcador mide ≈ 817 × 459 mm). Por defecto 380.
- `?debug=1` → dibuja un plano azul del tamaño del marcador para comprobar la alineación.

## Notas
- Si cambias la imagen del marcador, hay que regenerar los archivos `.fset/.fset3/.iset`
  (NFT-Marker-Creator) y actualizar `markerW`/`markerH` en `index.html` (ancho_px / dpi × 25.4).
- El GLB pesa ~21 MB; en celulares tarda en cargar. Comprimirlo (p. ej. con gltf-transform + Draco/meshopt y texturas WebP) mejora mucho la carga.
