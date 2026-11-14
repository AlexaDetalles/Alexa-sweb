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
- **Categorías**: crear, subcategorías, ocultar, ordenar (reemplazan los códigos HP, MP, PHP… escritos en el código).
- **Regalos personalizados** (para ella / para él): bases → tamaños → contenido, peluches, globos y entrega, con precios; el panel avisa si algo no se va a mostrar.
- **Ajustes**: WhatsApp de las asesoras y cambio de contraseña.
- **Usuarios y rangos** (solo administradora): invitar por correo, cambiar rango, desactivar. Rangos: Administradora (todo), Encargada de Catálogo (productos, categorías y regalos), Encargada de Atención (WhatsApp de asesoras) y Supervisora (solo lectura). El servidor valida el rango en cada llamada.

## SEO, seguridad y legal
- **SEO**: cada producto tiene su ficha con dirección propia (`/producto/<referencia>`) con título, descripción, Open Graph, datos estructurados (Product y BreadcrumbList) y productos relacionados; `/sitemap.xml` se genera solo con todos los productos visibles; imagen social 1200×630; descripciones únicas por página.
- **Seguridad**: informe y pendientes en [`SEGURIDAD.md`](SEGURIDAD.md). Cabeceras en `public/_headers`; el catálogo público se cachea 60 s en el borde y se purga al guardar.
- **Legal**: privacidad, términos y condiciones en la web; guía y pendientes de la titular en [`LEGAL.md`](LEGAL.md).
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
- Los precios del personalizador no llevan foto (la tienda es solo texto ahí).
- Copia de seguridad automática cada lunes en R2 (`respaldos/`, 12 semanas).
