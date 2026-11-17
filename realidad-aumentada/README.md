# Botella UAI – Realidad Aumentada Web (A-Frame + AR.js)

Al apuntar la cámara al marcador `assets/marcador.png` (el cuadrado negro con "AR"),
aparece la botella UAI sobre su pedestal, parada encima del marcador.

## Estructura
```
ar-web/
├─ index.html              página AR (A-Frame 1.3.0 + AR.js 3.4.5, marcador de patrón)
├─ iniciar-servidor.bat    servidor local en http://localhost:8000
└─ assets/
   ├─ marcador.png         marcador que se debe mostrar a la cámara (imprimir o abrir en otra pantalla)
   ├─ patt/marcador.patt   patrón del marcador para AR.js
   └─ models/botella.glb   modelo 3D (escena completa de KeyShot)
```

## Probar
- **PC:** doble clic en `iniciar-servidor.bat` (requiere Python). No abrir el HTML con doble clic: la cámara no funciona con `file://`.
- **Celular:** necesita HTTPS → usar la versión publicada en GitHub Pages.

Muestra el marcador completo, incluido el borde blanco alrededor del cuadrado negro, y con buena luz.

## Ajustes
- `?altura=1.5` → altura de la botella + pedestal, en anchos de marcador (por defecto 1.2).
- `?debug=1` → dibuja un plano azul sobre el marcador detectado.
- En `index.html`, `OBJETOS_VISIBLES` define qué objetos del GLB se muestran. El GLB trae
  3 botellas, varios pedestales, un fondo, una cámara y luces; solo se usan `Document_n3d`
  (la botella de pie) y `Cylinder_2` (su pedestal).
- `rotation="0 -45 0"` en el modelo deja el logo mirando hacia la cámara.

## Cambiar el marcador
El `.patt` se genera del 50 % central del cuadrado negro (16×16 px, 4 rotaciones).
Se puede regenerar con https://ar-js-org.github.io/AR.js/three.js/examples/marker-training/examples/generator.html
subiendo solo la imagen interior.

## Notas
- El GLB pesa ~21 MB y trae objetos que no se usan. Exportar desde KeyShot solo la botella y el pedestal
  (o comprimir con gltf-transform) haría que cargue mucho más rápido en el celular.
