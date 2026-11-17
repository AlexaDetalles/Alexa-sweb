# AlexaShop · tienda + panel de administrador

Reemplaza el Excel / Google Sheets y las imágenes sueltas por una **base de datos real** (Cloudflare D1), **almacenamiento de fotos** (R2) y un **panel con login** en `/admin`. La tienda lee todo de `/api/catalogo` y `/api/regalos/*`; si la API no responde, usa las copias CSV de `public/assets/data/` como respaldo.

```
app/
  public/          la tienda (la misma de alexashop.cc) + public/admin (el panel)
  worker/          API: login, catálogo, panel, fotos
  migraciones/     tablas de la base de datos
  herramientas/    semilla (importa el Excel), crear-usuario, dev
  pruebas/         18 pruebas automáticas (npm test)
```

## Qué puedes hacer en el panel
- **Productos**: crear, editar, foto (se reduce sola en el celular), precio, «por cotizar», visible/oculto, hay/agotado, ordenar, duplicar, papelera de 30 días.
- **Imagen para Instagram**: dentro de un producto, «Imagen para Instagram» crea una lámina 4:5 (2160×2700) con la foto, el nombre, el precio y una talla opcional, con el estilo rojo y grano de película de la tienda. Se dibuja en el navegador y se descarga (o se comparte desde el celular).
- **Inventario**: pestaña con la cantidad de cada producto (botones − / + o escribir el número). Con cantidad, el producto se marca «No disponible» solo al llegar a 0, avisa «Últimas unidades» cuando quedan 5 o menos y la bolsa no deja pedir más de las que hay. Sin cantidad sigue el simple «Hay / Agotado». La cantidad también se puede poner al editar un producto.
- **Paletas de color** en la imagen para Instagram: Rojo Alexa, Negro y dorado, Rosa, Azul noche, Esmeralda y Crema (se recuerda la última que elegiste).
- **Categorías**: crear, subcategorías, ocultar, ordenar (reemplazan los códigos HP, MP, PHP… escritos en el código).
- **Regalos personalizados** (para ella / para él), totalmente configurables: pasos propios (nombre, título, una o varias opciones, mínimo/máximo, de qué otro paso dependen, orden, visible), opciones con **foto**, descripción, etiqueta («Popular») y precio, textos de la página y dedicatoria (tarjeta con mensaje). El panel avisa si algo no se va a mostrar. Se ve en `/regalos/personalizar/ella` y `/regalos/personalizar/el`.
- **Panel instalable (PWA)**: en el navegador aparece «Instalar app» y queda como una app en el celular o la computadora.
- **Direcciones limpias**: ninguna página termina en `.html`; las direcciones antiguas redirigen (301) a las nuevas (`worker/rutas.js`).
- **Ajustes**: WhatsApp de las asesoras y cambio de contraseña.
- **Usuarios y rangos** (solo administradora): invitar por correo, cambiar rango, desactivar. Rangos: Administradora (todo), Encargada de Catálogo (productos, categorías y regalos), Encargada de Atención (WhatsApp de asesoras) y Supervisora (solo lectura). El servidor valida el rango en cada llamada.

## Finanzas, stock y hoja de Google
- **Tipo de stock** (en cada producto): **Stock aparte** = dropshipping, el proveedor lo tiene y no es inversión (todo lo que ya estaba subido); **Stock local** = lo compraste tú, sí es inversión; **Sin stock** = la tienda lo muestra «No disponible». Además cada producto tiene **Costo**.
- **Inventario → «Compré» / «Vendí»**: «Compré» (solo stock local) suma unidades y cuenta como inversión; «Vendí» rebaja la cantidad (stock local) o solo registra la venta (stock aparte) y calcula la ganancia con el precio y el costo de ese momento. Un movimiento se puede **anular** y las unidades vuelven a su lugar.
- **Pestaña Finanzas** (solo administradora): invertido, vendido, ganado, capital en stock local y retorno; por periodo (7 días, 30 días, todo), por tipo de stock y por categoría; movimientos recientes.
- **Respaldo si Google no carga las fórmulas**: `herramientas/hoja-google.gs` es un script (se pega en la hoja: Extensiones → Apps Script) que la rellena cada minuto con las mismas direcciones. Instrucciones al inicio del archivo.
- **Hoja de Google en tiempo real**: tiene tres pestañas (Productos, Movimientos y Resumen) hechas con `=IMPORTDATA("https://alexashop.cc/api/finanzas/csv/<hoja>?clave=…")`. Google las vuelve a leer sola, así que siempre muestra lo mismo que el panel. La `clave` es el secreto `FINANZAS_TOKEN` del Worker (`npx wrangler secret put FINANZAS_TOKEN`); sin ella esas direcciones responden 404. Si algún día se filtra, se cambia el secreto y se actualizan las 3 fórmulas (la pestaña Finanzas del panel muestra los enlaces nuevos a la administradora).

## Publicar en Instagram y Facebook
En un producto: **Imagen para Instagram → Publicar**. La descripción sale con este formato y se puede editar antes de publicar:
```
Valentino Born in Roma
Precio: 4400Lps
Alexashop.cc
#perfumes
```
Elige Instagram, Facebook o las dos, y **Ahora mismo** o **Programar** (el Worker revisa cada 5 minutos y publica lo que ya toca). La pestaña **Redes** muestra el estado, deja reintentar o cancelar.

**Conectar Meta (una sola vez)**
1. Instagram tiene que ser cuenta **Profesional** (Business o Creator) y estar enlazada a una **Página de Facebook**.
2. En https://developers.facebook.com crea una app de tipo **Empresa** y agrega el producto **Instagram**. Permisos: `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`. Mientras la app esté en modo desarrollo y tú seas administradora de ella, puedes publicar en tus propias cuentas sin pasar la revisión de Meta.
3. En el **Explorador de la Graph API** genera un token de usuario con esos permisos y alárgalo en el **Depurador de tokens** («Extender token»). Con ese token pide `GET /me/accounts`: ahí salen el **id de la página** y su **token de página** (el que no caduca). Luego `GET /<id-de-la-página>?fields=instagram_business_account` da el **id de Instagram**.
4. Guárdalos como secretos del Worker (nada de esto va en el código ni en GitHub):
```bash
cd app
npx wrangler secret put META_TOKEN     # token de la página
npx wrangler secret put META_PAGE_ID   # id de la página de Facebook
npx wrangler secret put META_IG_ID     # id de la cuenta de Instagram
```
Instagram solo acepta JPEG: el panel convierte la lámina sola. Si algo falla, el error de Meta aparece en la pestaña Redes y se puede reintentar (lo que ya salió bien no se vuelve a publicar).

## SEO, seguridad y legal
- **SEO**: cada producto tiene su ficha con dirección propia (`/producto/<referencia>`) con título, descripción, Open Graph, datos estructurados (Product y BreadcrumbList) y productos relacionados; `/sitemap.xml` se genera solo con todos los productos visibles; imagen social 1200×630; descripciones únicas por página.
- **Seguridad**: informe y pendientes en [`SEGURIDAD.md`](SEGURIDAD.md). Cabeceras en `public/_headers`; el catálogo público se cachea 60 s en el borde y se purga al guardar.
- **Legal**: privacidad, términos y condiciones en la web; guía y pendientes de la titular en [`LEGAL.md`](LEGAL.md).
- **Píldora de cookies y términos**: pregunta una vez («Aceptar» o «Solo lo necesario»), se puede cambiar desde «Cookies» en el pie y no se mide nada hasta que la persona acepte. La medición es propia (visitantes por día, páginas, productos vistos, clics a WhatsApp) y se ve en el panel → **Estadísticas** (administradora y supervisora).
- **Logo**: frasco de perfume con destello dorado (`public/assets/images/logo-mark*.svg`, favicon e íconos con `node herramientas/iconos.cjs`).
- **Loader** de la portada (una vez por visita, solo CSS) y tipografía propia en `public/assets/fonts`.

## Huella o Face ID
Se activa **después de entrar con contraseña** (aviso al entrar o Ajustes → Huella o Face ID) y desde entonces aparece «Entrar con huella o Face ID» en la pantalla de acceso. Usa passkeys (WebAuthn), atadas al dominio donde se activaron (`alexashop.cc`). Cada persona puede tener hasta 10 dispositivos y quitarlos desde Ajustes. Requiere Chrome 129+, Safari 18.4+ o Firefox 119+.

## Empleadas
Ajustes → Personas con acceso → **Agregar persona** (nombre, correo y rango). Le llega un correo para confirmar que es ella y elegir su contraseña; después entra con su correo y esa contraseña, o con su huella. «¿Olvidaste tu contraseña?» también usa correo.

## Cuentas y correos (Resend)
- **Primera administradora:** si la base no tiene usuarios, `/admin` pide correo y contraseña y manda un código de 6 dígitos por correo. Solo el correo del secreto `ADMIN_EMAIL` puede crearla, para que nadie se adelante.
- **Olvidé mi contraseña:** enlace por correo de un solo uso (30 min) y aviso al terminar el cambio.
- **Invitaciones:** enlace de un solo uso (48 h); cada persona elige su propia contraseña.
- Los enlaces se arman con la variable `SITIO` de `wrangler.jsonc` (nunca con el Host de la petición). Cuando `alexashop.cc` apunte al Worker, cámbiala a `https://alexashop.cc` y vuelve a ejecutar `npx wrangler deploy`.
- Resend: hay que **verificar el dominio `alexashop.cc`** en https://resend.com/domains (registros DNS) para poder enviar a cualquier correo; antes solo llega al correo dueño de la cuenta de Resend. El remitente es `REMITENTE` (`no-responder@alexashop.cc`).

## Probarlo en tu computadora (sin cuenta de Cloudflare)
```bash
cd app && npm install && npm run dev
```
Tienda: http://localhost:8787 · Panel: http://localhost:8787/admin
Usuario de prueba (solo existe en tu computadora): `demo@alexashop.local` / `demo-local-123`.
`npm test` corre las pruebas (arranca su propio servidor).

## Publicarlo (una sola vez)
Necesitas la cuenta de Cloudflare y un token de API (`CLOUDFLARE_API_TOKEN`).
```bash
cd app && npm install
npx wrangler d1 create alexashop          # copia el database_id en wrangler.jsonc
npx wrangler r2 bucket create alexashop-fotos
npm run migrar                            # crea las tablas
node herramientas/semilla.mjs --remoto    # importa el inventario del Excel (113 productos, regalos, opciones)
CLAVE='contraseña-larga-al-azar' node herramientas/crear-usuario.mjs dueña@correo.com --remoto
openssl rand -hex 32 | npx wrangler secret put FIRMA   # secreto interno
npx wrangler secret put RESEND_API_KEY ; npx wrangler secret put ADMIN_EMAIL
npx wrangler deploy
```
Después, en Cloudflare → Workers → `alexashop` → Domains, conecta `alexashop.cc` (o primero prueba con la dirección `*.workers.dev`).
Cuando el dominio apunte al Worker, GitHub Pages deja de ser necesario (puedes desactivar el workflow).

Importante: contraseña de 12+ caracteres; tras 5 intentos fallidos se bloquea 15 minutos. Si se te olvida, usa «¿Olvidaste tu contraseña?» en el panel (o `crear-usuario.mjs`).

## Notas
- Las **fotos que ya estaban en la web** se conservan (`/assets/images/…`). Las que apuntaban a Pinterest/placeholders/GitHub Pages no se importaron: súbelas desde el panel (2 productos quedaron sin foto).
- El **calzado** (CHM/CMM) estaba en el Excel pero la tienda no lo mostraba: se importó **oculto**; actívalo en Categorías cuando quieras.
- Copia de seguridad automática cada lunes en R2 (`respaldos/`, 12 semanas).
