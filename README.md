# Alexa Detalles · alexashop.cc

| Carpeta | Qué es |
|---|---|
| [`app/`](app/LEEME.md) | **La tienda y el panel en producción**: un Worker de Cloudflare (D1 + R2) con la web pública, `/admin`, SEO y estadísticas. Guía completa en `app/LEEME.md`. |
| [`drop-generator/`](drop-generator/LEEME.md) | Generador del carrusel de Instagram «New Drop». |
| [`legado/`](legado/LEEME.md) | Sitio anterior (GitHub Pages + hoja de Google), archivado. |

Publicar la tienda: `cd app && npm install && npm run migrar && npx wrangler deploy` (necesita `CLOUDFLARE_API_TOKEN`).
Pruebas: `cd app && npm test`.
