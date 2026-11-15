# Technical SEO · 90/100

## Lo que funciona
- HTTPS forzado, HSTS y cabeceras de seguridad
- Compresión Brotli y respuesta mediana de 103 ms
- 135 URLs del sitemap devuelven 200, con canonical correcto
- 404 real con página propia
- Sitemap dinámico con todos los productos

## Hallazgos
### [High] robots.txt bloqueaba /api/
El catálogo se dibuja con /api/catalogo; con Disallow: /api/ Googlebot no podía leer los datos al renderizar.

**Recomendación:** Hecho: se permite /api/catalogo y /api/regalos/, se mantiene bloqueado /api/admin/, /api/auth/ y /api/vista.

### [Medium] www duplicaba el sitio
www.alexashop.cc respondía 200 con el mismo contenido.

**Recomendación:** Hecho: 301 a alexashop.cc.

### [Low] Fechas lastmod del sitemap
Las páginas fijas llevaban la fecha de hoy en cada consulta, lo que Google aprende a ignorar.

**Recomendación:** Hecho: fecha fija de última revisión.

### [Low] Las páginas HTML estáticas no declaran charset en la cabecera
Se declara en <meta charset> (suficiente para navegadores y Google), pero no en Content-Type.

**Recomendación:** Opcional: forzar text/html; charset=utf-8.

