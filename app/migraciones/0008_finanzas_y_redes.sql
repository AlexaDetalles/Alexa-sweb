-- Finanzas del negocio y publicaciones en redes.
--
-- Tipos de stock de un producto:
--   aparte = stock aparte (dropshipping): el proveedor lo tiene; NO es inversión, la ganancia sale de precio − costo en cada venta.
--   local  = stock local: lo compraste y lo tienes tú; lo que pagas por él SÍ es inversión.
--   sin    = sin stock: la tienda lo muestra «No disponible».
-- Todo lo que ya estaba subido es dropshipping, por eso el valor por defecto es «aparte».
ALTER TABLE productos ADD COLUMN costo REAL CHECK (costo IS NULL OR (costo >= 0 AND costo <= 1000000));
ALTER TABLE productos ADD COLUMN tipo_stock TEXT NOT NULL DEFAULT 'aparte' CHECK (tipo_stock IN ('aparte', 'local', 'sin'));

-- Libro de movimientos: cada compra de stock local y cada venta. De aquí salen la inversión, lo ganado y el Excel.
-- Se guarda una copia del nombre, del tipo de stock y de los precios del momento: así el historial no cambia si luego editas o borras el producto.
CREATE TABLE movimientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL DEFAULT (datetime('now')),
  tipo TEXT NOT NULL CHECK (tipo IN ('compra', 'venta')),
  producto_id TEXT NOT NULL,
  producto_nombre TEXT NOT NULL,
  tipo_stock TEXT NOT NULL CHECK (tipo_stock IN ('aparte', 'local', 'sin')),
  categoria_id TEXT,
  cantidad INTEGER NOT NULL CHECK (cantidad BETWEEN 1 AND 100000),
  precio_unit REAL CHECK (precio_unit IS NULL OR (precio_unit >= 0 AND precio_unit <= 1000000)), -- venta: a cuánto se vendió
  costo_unit REAL NOT NULL DEFAULT 0 CHECK (costo_unit >= 0 AND costo_unit <= 1000000),          -- lo que te costó cada unidad
  nota TEXT NOT NULL DEFAULT '' CHECK (length(nota) <= 200),
  usuario TEXT NOT NULL DEFAULT '',
  anulado INTEGER NOT NULL DEFAULT 0 CHECK (anulado IN (0, 1))
);
CREATE INDEX movimientos_fecha ON movimientos (fecha);
CREATE INDEX movimientos_producto ON movimientos (producto_id);

-- Publicaciones en Instagram y Facebook (inmediatas o programadas). Las claves de Meta NO van aquí: son secretos del Worker.
CREATE TABLE publicaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creada TEXT NOT NULL DEFAULT (datetime('now')),
  producto_id TEXT,
  descripcion TEXT NOT NULL CHECK (length(descripcion) BETWEEN 1 AND 2200),
  imagen_clave TEXT NOT NULL CHECK (imagen_clave LIKE 'social/%'),
  redes TEXT NOT NULL CHECK (redes IN ('ig', 'fb', 'ig,fb')),
  programada_en TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'publicada', 'error', 'cancelada')),
  resultado TEXT NOT NULL DEFAULT '{}',
  intentos INTEGER NOT NULL DEFAULT 0,
  usuario TEXT NOT NULL DEFAULT ''
);
CREATE INDEX publicaciones_estado ON publicaciones (estado, programada_en);

-- Enlace de la hoja de Google (se llena una vez, al crearla).
ALTER TABLE ajustes ADD COLUMN hoja_url TEXT NOT NULL DEFAULT '' CHECK (length(hoja_url) <= 300);
