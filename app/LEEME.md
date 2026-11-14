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
npx wrangler deploy
```
Después, en Cloudflare → Workers → `alexashop` → Domains, conecta `alexashop.cc` (o primero prueba con la dirección `*.workers.dev`).
Cuando el dominio apunte al Worker, GitHub Pages deja de ser necesario (puedes desactivar el workflow).

Importante: contraseña de 10+ caracteres; tras 5 intentos fallidos se bloquea 15 minutos. Si se te olvida, se restablece con `crear-usuario.mjs` (misma línea de arriba).

## Notas
- Las **fotos que ya estaban en la web** se conservan (`/assets/images/…`). Las que apuntaban a Pinterest/placeholders/GitHub Pages no se importaron: súbelas desde el panel (2 productos quedaron sin foto).
- El **calzado** (CHM/CMM) estaba en el Excel pero la tienda no lo mostraba: se importó **oculto**; actívalo en Categorías cuando quieras.
- Los precios del personalizador no llevan foto (la tienda es solo texto ahí).
- Copia de seguridad automática cada lunes en R2 (`respaldos/`, 12 semanas).
