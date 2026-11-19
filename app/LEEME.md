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
- **Tipo de stock** (en cada producto): **Stock aparte** = dropshipping, el proveedor lo tiene y no es inversión (todo lo que ya estaba subido); **Stock local 1** = lo tienes tú y **no tiene inversión** (costo 0: lo que vendas es ganancia); **Stock local 2** = lo compraste **con inversión** (el lote de L 45,000), su costo se reparte del lote; **Sin stock** = la tienda lo muestra «No disponible». Además cada producto tiene **Costo**.
- **Inventario → «Compré» / «Vendí»**: «Compré» (solo stock local) suma unidades y cuenta como inversión; «Vendí» rebaja la cantidad (stock local) o solo registra la venta (stock aparte) y calcula la ganancia con el precio y el costo de ese momento. Un movimiento se puede **anular** y las unidades vuelven a su lugar.
- **Pestaña Finanzas** (solo administradora): invertido, vendido, ganado, capital en stock local y retorno; por periodo (7 días, 30 días, todo), por tipo de stock y por categoría; movimientos recientes.
- **Lotes (compra grande con costo por producto desconocido)**: pestaña **Lotes** (solo administradora). Creas un lote con lo que invertiste (ej. L 45,000) y la meta de ventas (ej. L 80,000; sin meta propone +80 %). En cada producto de «Stock local» eliges el lote y escribes su **precio de etiqueta**: la inversión se reparte entre los productos en proporción a esa etiqueta, así cada uno tiene un costo estimado. Al escribir la etiqueta el panel te da el **precio sugerido** (el que haría que todo el lote llegue a la meta) con un botón para usarlo, pero **tú pones el precio que quieras** y el lote suma todo: ventas estimadas, ganancia estimada, % y cuánto falta para la meta. Mientras cargas productos el reparto usa la meta como base (para que los costos no se disparen con pocos productos); al terminar, marca «Ya cargué todo el lote» y el reparto se hace exacto. Vender o comprar más del mismo producto no cambia su costo repartido. La inversión del lote cuenta en Finanzas como invertida (stock local) y se ve también en la hoja de Google.
- **Gastos, deudas y crédito**:
  - **Gastos** (pestaña Finanzas → Gastos, y al registrar «Vendí»): el bus o envío y otros gastos de cada venta, o gastos sueltos. Restan de la ganancia (*ganancia neta*). Si anulas la venta, se anulan sus gastos.
  - **Vender a crédito** (Inventario → Vendí → «A crédito»): escribes quién se lleva la deuda (y su WhatsApp si quieres), el **número de pagos**, el **monto de cada pago** y cuánto **abona hoy**. El panel sugiere el pago con el recargo (20 % de inicio, se cambia en Finanzas): un tenis de L 1,000 en 2 pagos → 2 × L 600 = L 1,200. Tú eliges los pagos y el monto, pero **el total siempre tiene que ser mayor que el contado**: igual o mejor se rechaza. La venta se anota por el total del crédito.
  - **Por cobrar**: lista de deudas con lo abonado, el saldo y el próximo pago. Botón **Abonar**, historial de abonos (se pueden anular) y **WhatsApp** con el recordatorio ya escrito. Anular una deuda anula su venta y el producto vuelve al inventario (solo si no tiene abonos).
  - **Avisos**: cuando alguien termina de pagar llega un correo y un mensaje en el panel; si hay cobros vencidos sale un banner arriba del panel y **cada día a las 8 a. m. (Honduras)** llega un correo a las administradoras con a quién cobrarle. Los correos salen por Resend (ver «Cuentas y correos»).
- **Lo agotado no se muestra en la tienda**: un producto marcado «Agotado» (Hay → Agotado), con cantidad 0 o «Sin stock» desaparece de la tienda, de su colección, de las fichas, de los relacionados y del sitemap. En el panel sigue apareciendo con la etiqueta «Agotado · no se ve en la tienda»; al reponerlo (cantidad > 0 o «Hay») vuelve solo.
- **Stock local 2 privado**: por defecto el Stock local 2 **no se muestra en la tienda** (ni en el catálogo, ni en las páginas de colección, ni en las fichas, ni en el sitemap/Google): es inventario privado. Solo se ve en el panel, con la etiqueta «🔒 Privado». Cuando termine el inventario, el botón **«Publicar en la tienda»** (arriba de Productos) lo muestra —solo los que estén «Visibles»— y **«Hacerlo privado»** lo vuelve a esconder al instante.
- **Contador del stock local** (arriba de Productos y en Finanzas): mientras cargas productos suma lo que vale todo el stock local (1 y 2) **a tus precios** y dice cuánto **falta para cubrir la inversión**, cuánto falta para la **meta**, cuánto tendrías que **subir los precios** para llegar a ella, la ganancia **si vendes todo** y cuánto llevas **recuperado vendiendo**. Para cargar sin saber el costo de cada uno: producto «Stock local 2» + lote + cantidad + **solo tu precio** (el precio de etiqueta es opcional); el panel reparte la inversión según el precio.
- **Cargar muchos productos rápido**: en un producto nuevo, **«Guardar y agregar otro»** guarda y abre el siguiente con la misma categoría, tipo de stock y lote.
- **Respaldo si Google no carga las fórmulas**: `herramientas/hoja-google.gs` es un script (se pega en la hoja: Extensiones → Apps Script) que la rellena cada minuto con las mismas direcciones. Instrucciones al inicio del archivo.
- **Excel / hoja de Google (con panel y gráficos)**: `python3 herramientas/excel-finanzas.py salida.xlsx` (con `FINANZAS_TOKEN` en el entorno) genera el libro con los datos de hoy: una pestaña **Panel** con todas las cuentas y 3 gráficos —todo **fórmulas**: inversión, lo cargado a tus precios, lo que falta para cubrir la inversión y la meta, ganancia si vendes todo, ventas, gastos, ganancia neta y deudas— y las pestañas de datos (Productos, Movimientos, Gastos, Deudas, Lotes) con formato, filtros y colores (deudas vencidas en rojo). Se sube a Google Drive y se convierte en hoja de Google. Para que los datos se refresquen **solos cada minuto** pega `herramientas/hoja-google.gs` en la hoja (Extensiones → Apps Script): el Panel se recalcula solo. Los datos salen de direcciones con clave secreta (`/api/finanzas/csv/<hoja>?clave=…`, secreto `FINANZAS_TOKEN`); sin la clave responden 404. Si se filtra, se cambia el secreto.

## Publicar en Instagram y Facebook
En un producto: **Imagen para Instagram → Publicar**. La descripción sale con este formato y se puede editar antes de publicar:
```
Valentino Born in Roma
Precio: 4400Lps
Alexashop.cc
#perfumes
```
Elige Instagram, Facebook o las dos, y **Ahora mismo** o **Programar** (el Worker revisa cada 5 minutos y publica lo que ya toca). La pestaña **Redes** muestra el estado, deja reintentar o cancelar.

**Imágenes para redes de muchos productos (automatización)**
1. Toma las fotos y súbelas a cada producto (puedes poner también su **talla**; sale en la imagen). Para cargar rápido usa **«Guardar y agregar otro»**.
2. En **Productos → «Imágenes para redes»** eliges qué productos (Stock local 2 por defecto), **la paleta** (las 6 de siempre o **cualquier color** con el selector «Otro color»: el panel arma el fondo, las letras y el brillo a partir de él) y el formato: **Publicación 4:5** (2160×2700), **Historia 9:16** (2160×3840) o las dos.
3. **«Descargar todas (.zip)»** crea todas las imágenes con esa misma paleta y las baja juntas en un solo archivo (`imagenes-local2-<paleta>.zip`). Los productos sin foto se saltan y el panel avisa cuántos son. Todo se dibuja en tu navegador: nada sale a ningún servicio.
4. **«Programar todas»** (cuando Meta esté conectado): publica todas en Instagram y/o Facebook, **una cada N horas** desde la fecha que elijas (con su historia 10 minutos después si la marcaste). Se ven en la pestaña **Redes** y salen solas.
5. Una sola imagen: dentro del producto, «Imagen para Instagram» (con selector de formato y de color).

**Historias**: Instagram (`media_type=STORIES`) y Facebook (historia de la página) se publican por la API de Meta; las historias van sin texto, en 9:16.

**WhatsApp**: la API oficial de WhatsApp **no permite publicar Estados (historias) ni escribir en grupos o chats por ti**; solo mandar mensajes a clientes que ya te escribieron o con plantillas aprobadas. Lo que sí hay: en el celular, el botón **«Compartir…»** abre el menú de tu teléfono con las imágenes ya listas (hasta 20) y ahí eliges WhatsApp → el chat o **«Mi estado»**; en la computadora, baja el .zip y arrástralas a WhatsApp Web.

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

## Tallas desde la descripción

Si escribes la talla en la descripción («Talla 11 y 12», «tallas 7, 7.5 y 8», «Talla S y XXL», «Unitalla»), al guardar el producto se copia sola al campo **Talla** (el que sale en las imágenes para redes, como «TALLA 11 · 12»). Una talla escrita a mano nunca se pisa. Para los productos que ya existen: *Imágenes para redes* → **Leer tallas de las descripciones**. Lo que no se pueda leer con seguridad (por ejemplo «28-330») se avisa y se escribe a mano. El lector está en `worker/tallas.js`, con sus pruebas en `pruebas/tallas.test.mjs`.

## Tallas: filtro y compra por talla

- **Filtro en el panel** (Productos): lista desplegable «Talla». Un par con varias tallas («11 · 12») sale al filtrar por cualquiera de ellas; un rango («28-30») sale con cualquier número dentro. Cada producto muestra sus tallas en su fila.
- **Filtro en la tienda** (catálogo y colecciones): aparece solo cuando hay productos con talla (por ejemplo cuando publicas el Stock local 2). También se puede compartir un enlace con `?talla=9`.
- **Comprar por talla:** si el producto tiene varias tallas, la ficha y la ventana del producto muestran las tallas para elegir una o varias; cada talla elegida es una línea de la bolsa y el mensaje de WhatsApp la nombra («1 × Nike Giannis [CHM-08] · talla 11»). En las tarjetas del catálogo el botón dice «Elegir talla». Con una sola talla no hay nada que elegir: se anota sola.
- **Vender una talla:** al registrar una venta de un producto con varias tallas, el panel pide cuál se vendió; esa talla sale de la lista (la tienda deja de ofrecerla) y queda anotada en el movimiento. Si anulas la venta, vuelve a escribir la talla en la ficha del producto.
- El código común está en `public/assets/tallas.mjs` (tienda, panel y Worker) y `public/assets/core.mjs` (bolsa).

## Panel más simple

- **Pestañas:** las 5 de todos los días (Productos, Inventario, Finanzas, Lotes, Redes) y un menú **Más** con Categorías, Regalos, Estadísticas y Ajustes.
- **Producto nuevo:** arriba solo lo básico (foto, nombre, categoría, precio, cantidad, descripción, talla, tipo de stock). Costo, lote, referencia, «por cotizar» y visibilidad están en **Más opciones**, que se abre sola cuando el producto ya usa algo de ahí (o si eliges «Stock local 2»).
- **Lista de productos:** Categoría y Talla lado a lado; textos de ayuda más cortos; en Redes lo técnico (claves de Meta) queda plegado.

## Pruebas de abuso (qué se probó)

La API aguanta 493 combinaciones de datos absurdos por campo, cuerpos que no son JSON, peticiones sin sesión o desde otro origen, ids raros y 12 ventas simultáneas de la última unidad (pasa solo una; nunca queda negativa). La tienda aguanta textos con código en nombre/descripción/talla (se muestran tal cual, no se ejecutan), una bolsa guardada corrupta o hostil (10 variantes), enlaces con parámetros manipulados y clics seguidos (no pasa del límite de existencias). Los casos que fallaron al probar (nombres con caracteres de control y un lote «vacío» o 0) ahora dan un mensaje claro y tienen prueba en `pruebas/api.test.mjs`.

## Fotos recortadas (sin fondo) y filtros de Stock local 2

- **Subir un recorte:** se sube igual que cualquier foto. Si el navegador no sabe crear WebP (Safari del iPhone), una foto con transparencia se guarda como **PNG** para no ponerla sobre blanco (el servidor acepta WebP, JPEG y PNG; máximo 2 MB por foto, se reduce sola).
- **Generador de imágenes** (una o muchas): dos opciones nuevas.
  - **Estilo de la foto:** *Automático* detecta si la foto está recortada (transparente alrededor); *Foto con marco* es la lámina de siempre; *Sin fondo* pone el producto solo, grande, con luz detrás y sombra en el piso. Arriba, chicos: la talla (a la izquierda) y el precio (a la derecha); abajo, el nombre discreto.
  - **Fondo:** *Liso* (el color de la paleta), *Concreto*, *Madera* o *Tela*. La textura toma el color de la paleta: elige «Otro color» para un azul, un vino o un gris.
  - Lo que elijas se recuerda para la próxima vez y vale igual para una imagen o para todas (descarga en .zip).
- **Productos → Stock:** fila de botones *Todos los stocks · Stock local 2 · Stock local 1 · Stock aparte · Sin stock* (se recuerda la última). Debajo, *Con foto* y *Sin foto* (con sus números) cuentan solo dentro del stock elegido.
- **Talla viva:** al escribir la descripción («Talla 9»), el campo Talla se llena solo; una talla escrita a mano no se pisa.
- El usuario que sale al pie de las láminas está en `public/admin/instagram.js` (constante `USUARIO`).
