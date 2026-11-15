# Plan de acción SEO · alexashop.cc

Estado al 15 de noviembre de 2026. ✅ = hecho y desplegado · ⬜ = pendiente.

## Crítico / alto (semana 1)
- ✅ `robots.txt`: permitir `/api/catalogo` y `/api/regalos/` (el catálogo se dibuja con ellos); mantener bloqueado el panel, el login y la medición.
- ✅ Catálogo y colecciones con 24 productos reales y enlaces a las fichas en el HTML, más datos estructurados `ItemList`.
- ✅ `www.alexashop.cc` → 301 a `alexashop.cc`.

## Medio (semanas 2–3)
- ✅ Títulos de ficha ≤ 60 caracteres y descripciones ≥ 70.
- ✅ Título de la portada con palabras clave.
- ✅ Fecha de revisión fija en el sitemap para las páginas fijas.
- ✅ `llms.txt` y `lang="es-HN"`.
- ⬜ **Enviar `https://alexashop.cc/sitemap.xml` a Google Search Console** (verificar el dominio con el registro DNS que pide) y a Bing Webmaster.
- ⬜ **Crear y verificar el perfil de Google Business** (nombre, dirección, horario, teléfono, fotos); luego añadirlo a `sameAs` y `hasMap`.
- ⬜ **Escribir 28 descripciones de producto** de más de 60 caracteres, únicas: notas olfativas, tamaño, ocasión. Quitar frases tipo «estilo Van Cleef».
- ⬜ **Página «Quiénes somos»** con dirección, horario, historia y fotos propias; enlazarla en el pie (necesito esos datos de la titular).

## Bajo / contenido (mes 2)
- ⬜ Preguntas frecuentes (cómo pedir, entregas, cambios) con datos estructurados `FAQPage` si aplica.
- ⬜ Un párrafo útil en las 5 portadas de sección que tienen menos de 150 palabras.
- ⬜ Reseñas reales de clientas (con permiso) y, si existen, `AggregateRating`.
- ⬜ Añadir `openingHours` y `geo` al dato estructurado de la tienda; `brand`, política de devolución y envío a los `Product`.
- ⬜ Guías de compra («cómo elegir un perfume», «regalos por ocasión») que atraigan búsquedas informativas.
- ⬜ Opcional: `srcset` en las fotos del catálogo; `charset` en la cabecera de las páginas estáticas.

## Seguimiento
- Revisar Search Console cada semana el primer mes: cobertura, consultas y páginas con impresiones.
- Repetir esta auditoría después de cada cambio grande (`rastreo.py` y `rendimiento.cjs` están en esta carpeta).
- Mantener al día horarios, precios y existencias: los precios del sitio aparecen en Google.
