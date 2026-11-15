# Auditoría SEO completa · alexashop.cc

**Fecha:** 15 de noviembre de 2026 · **Herramienta:** skill `claude-seo` v2.6.1 (metodología y pesos) · **Tipo de negocio:** tienda de catálogo con pedido por WhatsApp + comercio local (Choluteca, Honduras)

> **Nota de método.** Los rastreadores incluidos en la skill se negaron a funcionar en este entorno: su protección anti-SSRF bloquea el proxy local (`127.0.0.1`) por el que sale todo el tráfico de la sesión, y la salida que proponen es desactivar el proxy, cosa que no se hizo. Se siguió la misma metodología con mediciones propias: rastreo de las **135 URLs del sitemap**, navegador real (Chromium, emulación de celular) y revisión de cabeceras. Las puntuaciones son una estimación con los pesos de la skill, no la salida de su script. No se usaron datos de Search Console ni Analytics (no hay credenciales).

## Resumen

| | Antes | Después de las correcciones |
|---|---:|---:|
| **Puntaje de salud SEO** | **76 / 100** | **82 / 100** |

| Categoría | Peso | Antes | Después |
|---|---:|---:|---:|
| Technical SEO | 22 % | 82 | 90 |
| Content Quality | 23 % | 62 | 64 |
| On-Page SEO | 20 % | 80 | 92 |
| Schema / datos estructurados | 10 % | 78 | 82 |
| Performance (Core Web Vitals) | 10 % | 96 | 96 |
| AI Search Readiness | 10 % | 55 | 66 |
| Imágenes | 5 % | 90 | 90 |

### Top 5 problemas (todos corregidos y desplegados)
1. **`robots.txt` bloqueaba `/api/`**, de donde el catálogo toma sus productos: Google podía renderizar un catálogo vacío.
2. **Catálogo y colecciones salían sin productos en el HTML** (0 enlaces a las fichas sin JavaScript; ~150 palabras). Ahora traen 24 tarjetas con enlace y datos estructurados `ItemList` (catálogo: 156 → 453 palabras; enlaces a fichas: 0 → 24).
3. **`www.alexashop.cc` respondía 200 con el mismo contenido.** Ahora redirige 301 al dominio principal.
4. **10 títulos de ficha de más de 60 caracteres y 32 descripciones de menos de 70.** Ahora: 0 títulos largos y 0 descripciones cortas.
5. **Título de la portada sin palabras clave** («Regala con intención»). Ahora: «Perfumes, joyería y regalos en Choluteca | ALEXA».

### Top 5 oportunidades pendientes (necesitan datos o decisiones tuyas)
1. Enviar el sitemap a **Google Search Console** y Bing, y crear/verificar el **perfil de Google Business**.
2. Escribir **28 descripciones de producto** de más de 60 caracteres (y evitar «estilo [marca]»).
3. Página **«Quiénes somos»** con dirección, horario y fotos propias (señal de confianza).
4. **Preguntas frecuentes** (cómo pedir, entregas, cambios) para respuestas citables por asistentes de IA.
5. Horario, coordenadas y mapa en el dato estructurado de la tienda; reseñas reales.

## Lo que funciona bien
- 135/135 URLs del sitemap responden 200; canonical correcto en todas; sin duplicados de título ni de descripción; 1 solo H1 por página.
- HTTPS forzado, HSTS, cabeceras de seguridad, compresión Brotli; respuesta mediana de 103 ms.
- JSON-LD válido: `Store`, `WebSite`, 115 `Product`, 115 `BreadcrumbList` y ahora 11 `ItemList`.
- Imágenes: 100 % con `alt`, `width`/`height` y WebP; carga diferida fuera del pliegue.
- Open Graph y Twitter Card completos, imagen social 1200×630.
- Textos legales actualizados (privacidad, términos, condiciones).

## Technical SEO (90)
- **Rastreo e indexación:** sitemap dinámico con 135 URLs; `robots.txt` ahora permite la API pública que el catálogo necesita y mantiene bloqueados `/admin`, `/api/admin/`, `/api/auth/` y `/api/vista`.
- **Duplicados:** `www` → 301 al dominio principal; `/catalogo` y `/catalogo.html` comparten canonical.
- **Fechas del sitemap:** las páginas fijas llevaban la fecha de hoy en cada consulta (Google aprende a ignorarlas); ahora tienen una fecha de revisión fija.
- **Bajo:** las páginas estáticas no declaran `charset` en la cabecera `Content-Type` (sí en `<meta charset>`, que basta).
- **Hreflang:** no hace falta (un solo idioma). `lang="es-HN"` aplicado.

## Content Quality (64)
- 28 productos tienen descripción de menos de 60 caracteres; las fichas rondan 158 palabras con poco texto propio (min. 133).
- Hay descripciones como «Pulsera Van Cleef de plata 725» o «estilo Van Cleef»: además de ser texto pobre, nombrar una marca ajena como referencia puede ser engañoso (ver `LEGAL.md`).
- No existe página «Quiénes somos», ni dirección, horario o equipo: la señal E-E-A-T más débil.
- 5 portadas de sección con menos de 150 palabras: `/Catalogo/Perfumes/`, `/Catalogo/Perfumes/premiumindex`, `/Catalogo/accesorios/`, `/Detalles/`, `/Detalles/indexforhm`.
- Sin reseñas ni prueba social visible.

## On-Page SEO (92)
Títulos y descripciones únicos; 1 H1; enlaces internos ficha → colección y 4 productos relacionados; ahora el catálogo enlaza a las fichas desde el HTML. Un solo título (la portada) supera los 60 caracteres antes de este informe y fue acortado.

## Schema (82)
Válido y sin errores de sintaxis. Falta: `openingHours`, `geo` y `hasMap` en `Store`; en `Product`: `brand`, `hasMerchantReturnPolicy` y `shippingDetails` (se pueden añadir cuando las políticas de cambio y envío estén definidas).

## Performance (96) · medido en celular emulado, sin estrangular la red
| Página | LCP | CLS | Peticiones | Peso |
|---|---:|---:|---:|---:|
| Inicio (1.ª visita, con loader) | 1,47 s | 0,016 | 22 | 425 KB |
| Inicio (sin loader) | 0,56 s | 0,002 | 22 | 425 KB |
| Catálogo | 0,44 s | 0,022 | 23 | 227 KB |
| Perfumes para él | 0,46 s | 0,023 | 23 | 128 KB |
| Ficha de producto | 0,54 s | 0 | 19 | 195 KB |
| Regalos | 0,71 s | 0 | 15 | 162 KB |

Todo en rango «bueno» (LCP < 2,5 s, CLS < 0,1). El loader suma ~0,9 s al LCP solo en la primera visita de cada sesión. Son mediciones de laboratorio; los datos reales (CrUX) llegarán con tráfico y Search Console.

## AI Search Readiness (66)
- **Bien:** `robots.txt` no bloquea a los rastreadores de IA; fichas con datos estructurados; catálogo legible sin JavaScript; `llms.txt` publicado.
- **Falta:** contenido de pregunta–respuesta citable, página de entidad (quiénes somos) y señales de marca fuera del sitio (solo Instagram en `sameAs`).

## Imágenes (90)
`alt` y dimensiones al 100 %, WebP, `loading="lazy"`. Mejora opcional: `srcset` con 600/1200 px también para las fotos antiguas (las subidas desde el panel ya generan ambas).

## Archivos de esta auditoría
`ACTION-PLAN.md` · `audit-data.json` · `findings/*.md` · `crawl-data-antes.json` / `crawl-data.json` (rastreo antes y después) · `rendimiento.json` · `rastreo.py`, `rendimiento.cjs` (para repetirla) · `screenshots/`.
