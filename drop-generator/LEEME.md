# Generador del carrusel «New Drop»

Carrusel de 3 láminas 4:5 en 2160×2700 (2K), estilo rojo con degradado, grano de película y letras moteadas.
1. NEW DROP · 2. MARTES 1PM · 3. TIENDAS ALEXA

```bash
cd drop-generator
# fotos originales en originals/ (01.jpg, 02.jpg…); el mapa de qué foto va en cada marco está al inicio de prep_photos.py
python3 prep_photos.py   # recorta y retoca → photos/
python3 build.py         # arma slide1-3.html
node render.js           # Playwright → slide1-3.png
```
Necesita Python con Pillow y Node con `playwright`. Sin fotos en `photos/`, la plantilla dibuja marcos vacíos.
Para una sola imagen de producto (foto + nombre + precio + talla) usa el botón «Imagen para Instagram» del panel (`app/public/admin`).
