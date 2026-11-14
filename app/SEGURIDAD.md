# Informe de seguridad · AlexaShop

Fecha: 14 de noviembre de 2026 · Alcance: https://alexashop.cc (tienda, `/api/*`, `/admin`) y el código de `app/`.
Método: skill *security-skill* (revisión de código + pocas peticiones de solo lectura, sin pruebas de carga ni que cambien datos). No se probó Cloudflare, WhatsApp, Resend ni otros terceros.

## Hallazgos y estado

| # | Hallazgo | Severidad / confianza | Referencia | Estado |
|---|---|---|---|---|
| 1 | `http://alexashop.cc` respondía **sin cifrar** (200 en HTTP) | Media / confirmada | CWE-319 · OWASP A02/A04 | **Corregido**: «Always Use HTTPS» activado (301 a HTTPS) y TLS mínimo 1.2 |
| 2 | La tienda no enviaba cabeceras de seguridad (clickjacking, HSTS, nosniff, permisos) | Media / confirmada | CWE-1021 · OWASP A02 | **Corregido**: `public/_headers` (HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP) |
| 3 | El catálogo público consultaba la base en cada visita (consumo de recursos / costo) | Baja / probable | OWASP API4 | **Corregido**: caché de 60 s en el borde, con purga al guardar en el panel |
| 4 | `HEAD` a la API se rechazaba como si fuera una escritura | Baja / confirmada | CWE-436 | **Corregido** |
| 5 | La tienda aún podía consultar hojas de Google (tercero) y publicaba sus URLs en `sources.json` | Baja / confirmada | CWE-200 · API10 | **Corregido**: ya no se consulta; archivo y política CSP sin Google |
| 6 | Archivos internos servidos al público (`update_files.py`, `ASHORTS.txt`, `107.png` de 2 MB) | Baja / confirmada | CWE-538 | **Corregido**: eliminados |
| 7 | Contraseñas con PBKDF2-SHA256 a 100 000 iteraciones (el máximo que permite Cloudflare Workers; OWASP sugiere más) | Baja / confirmada | CWE-916 | **Riesgo aceptado**, mitigado con mínimo de 12 caracteres, lista de claves comunes, bloqueo de 15 min tras 5 fallos y límite de peticiones. Alternativa: pasar a passkeys para todas |
| 8 | La Hoja de cálculo pública del inventario antiguo sigue publicada en Google | Informativa | A01 | **Pendiente (tú)**: en Google Sheets → Archivo → Compartir → *Dejar de publicar en la Web* |
| 9 | El workflow de GitHub Pages (`.github/workflows/static.yml`) ya no es necesario y usa acciones sin fijar por SHA | Baja / confirmada | CICD-SEC-3/8 | **Pendiente (tú)**: desactivarlo o borrarlo; el sitio ya sale del Worker |
| 10 | El token de Cloudflare usado para desplegar tiene permisos amplios | Informativa | CICD-SEC-6 | **Pendiente (tú)**: crear un token solo con *Workers, D1 y R2* de esta cuenta y rotar el actual |

## Revisado y sin problema encontrado
- **Secretos**: no hay claves en el árbol ni en el historial de Git (`FIRMA`, `RESEND_API_KEY` y `ADMIN_EMAIL` son secretos de Cloudflare; `.dev.vars` está en `.gitignore`).
- **Autenticación y sesión**: cookie `__Host-` (HTTPS, `HttpOnly`, `SameSite=Strict`), solo se guarda el hash del token, expira a 1 h sin uso o 12 h, se cierra al cambiar de rango o desactivar, el mismo tiempo de respuesta exista o no el correo.
- **Autorización**: cada llamada del panel valida el rango en el servidor (administradora, catálogo, atención, lectura); no hay referencias directas sin dueño porque el panel no maneja datos por usuario.
- **CSRF**: toda escritura exige `Origin` igual al dominio.
- **Inyección / XSS**: consultas parametrizadas; el panel y la tienda escapan todo lo que viene de la base; las fichas de producto escapan HTML y JSON-LD (hay prueba automática con un nombre malicioso).
- **Fotos**: solo WebP/JPEG por firma binaria, máximo 2 MB, claves generadas por el servidor, sin rutas del usuario.
- **Alta de la primera administradora**: solo con el correo de `ADMIN_EMAIL`, con código de 6 dígitos de un solo uso y límite de intentos.
- **Recuperación**: enlace de un solo uso construido desde `SITIO` (no del encabezado `Host`), aviso al completar.

## Limitaciones
No se hizo prueba de carga ni de denegación de servicio, no se auditó el DNS (el token no lee los registros) y no se evaluó la seguridad de WhatsApp/Meta. Este informe no certifica seguridad total.
