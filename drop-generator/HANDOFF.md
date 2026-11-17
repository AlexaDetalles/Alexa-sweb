# Traspaso de chat — Drop de Tiendas Alexa

## Contexto
- Tienda: Tiendas Alexa (alexashop.cc, IG @tiendasalexa_). Vende **ropa, tenis y accesorios** (NO perfumes; el catálogo de perfumes del repo es antiguo).
- Colores de marca: negro #050505, rojo #e63946, dorado #d4af37.

## Hecho
- `drop-generator/build.py` + `render.js`: carrusel de 3 láminas 1080x1350 (estilo rojo con degradado, grano, glitch, cinta, stickers).
  1. NEW DROP  2. MARTES 1PM  3. TIENDAS ALEXA
- Uso: poner fotos de producto en `drop-generator/photos/`, luego `python3 build.py && node render.js` (Playwright de Node) -> `slide1-3.png`.
- Sin fotos se dibujan espacios "FOTO" vacíos (estado actual).

## Pendiente
1. **Fotos de ropa**: el usuario no tiene `PIXABAY_API_KEY` en el entorno (hay que añadirla) o puede dar fotos propias (mejor). Pixabay sí es alcanzable desde el contenedor.
2. Confirmar el efecto que pidió ("granizados": se interpretó como degradados + grano).
3. Catálogo web: añadir sección **Ropa**; en Accesorios mantener carteras (cangureras de hombre); añadir **Tenis dama y hombre** (todo administrable desde el panel).
4. **Panel**: al subir un producto, opción "Generar imagen para Instagram" (foto + nombre + precio + talla, estilo rojo, 4:5), idealmente con canvas en el navegador. Primero hay que localizar el panel y dónde se guardan los productos (el repo solo muestra HTML y `alexashop-release.zip`).
