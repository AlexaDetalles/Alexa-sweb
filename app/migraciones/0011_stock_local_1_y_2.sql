-- Dos tipos de stock local:
--   local1 = Stock local 1: lo tienes tú y NO tiene inversión (costo 0: toda la venta es ganancia).
--   local2 = Stock local 2: lo que se compró con inversión (el lote de L 45,000): su costo se reparte del lote.
-- El antiguo «local» era el de inversión, así que pasa a local2. (Los CHECK de SQLite no se pueden cambiar: se reconstruyen las tablas.)
PRAGMA defer_foreign_keys = on;

CREATE TABLE productos_nueva (
  id TEXT PRIMARY KEY CHECK (id NOT GLOB '*[^A-Za-z0-9._-]*' AND length(id) BETWEEN 1 AND 80),
  nombre TEXT NOT NULL CHECK (length(nombre) BETWEEN 1 AND 120),
  categoria_id TEXT REFERENCES categorias (id) ON DELETE SET NULL,
  descripcion TEXT NOT NULL DEFAULT '' CHECK (length(descripcion) <= 1200),
  precio REAL CHECK (precio IS NULL OR (precio >= 0 AND precio <= 1000000)),
  cotizar INTEGER NOT NULL DEFAULT 0 CHECK (cotizar IN (0, 1)),
  imagen_url TEXT CHECK (imagen_url IS NULL OR imagen_url LIKE '/fotos/%' OR imagen_url LIKE '/assets/images/%'),
  disponible INTEGER NOT NULL DEFAULT 1 CHECK (disponible IN (0, 1)),
  visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1)),
  orden INTEGER NOT NULL DEFAULT 0 CHECK (orden BETWEEN 0 AND 100000),
  creado TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado TEXT NOT NULL DEFAULT (datetime('now')),
  borrado_en TEXT,
  cantidad INTEGER CHECK (cantidad IS NULL OR (cantidad >= 0 AND cantidad <= 100000)),
  costo REAL CHECK (costo IS NULL OR (costo >= 0 AND costo <= 1000000)),
  tipo_stock TEXT NOT NULL DEFAULT 'aparte' CHECK (tipo_stock IN ('aparte', 'local1', 'local2', 'sin')),
  lote_id INTEGER REFERENCES lotes (id) ON DELETE SET NULL,
  referencia REAL CHECK (referencia IS NULL OR (referencia >= 0 AND referencia <= 1000000)),
  lote_cantidad INTEGER CHECK (lote_cantidad IS NULL OR (lote_cantidad >= 1 AND lote_cantidad <= 100000)),
  CHECK (cotizar = 1 OR precio IS NOT NULL)
);
INSERT INTO productos_nueva (id, nombre, categoria_id, descripcion, precio, cotizar, imagen_url, disponible, visible, orden, creado, actualizado, borrado_en, cantidad, costo, tipo_stock, lote_id, referencia, lote_cantidad)
  SELECT id, nombre, categoria_id, descripcion, precio, cotizar, imagen_url, disponible, visible, orden, creado, actualizado, borrado_en, cantidad, costo,
         CASE tipo_stock WHEN 'local' THEN 'local2' ELSE tipo_stock END, lote_id, referencia, lote_cantidad FROM productos;
DROP TABLE productos;
ALTER TABLE productos_nueva RENAME TO productos;
CREATE INDEX productos_publicos ON productos (borrado_en, visible, orden);
CREATE INDEX productos_categoria ON productos (categoria_id);
CREATE INDEX productos_lote ON productos (lote_id);

CREATE TABLE movimientos_nueva (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL DEFAULT (datetime('now')),
  tipo TEXT NOT NULL CHECK (tipo IN ('compra', 'venta')),
  producto_id TEXT NOT NULL,
  producto_nombre TEXT NOT NULL,
  tipo_stock TEXT NOT NULL CHECK (tipo_stock IN ('aparte', 'local1', 'local2', 'sin')),
  categoria_id TEXT,
  cantidad INTEGER NOT NULL CHECK (cantidad BETWEEN 1 AND 100000),
  precio_unit REAL CHECK (precio_unit IS NULL OR (precio_unit >= 0 AND precio_unit <= 1000000)),
  costo_unit REAL NOT NULL DEFAULT 0 CHECK (costo_unit >= 0 AND costo_unit <= 1000000),
  nota TEXT NOT NULL DEFAULT '' CHECK (length(nota) <= 200),
  usuario TEXT NOT NULL DEFAULT '',
  anulado INTEGER NOT NULL DEFAULT 0 CHECK (anulado IN (0, 1)),
  credito_id INTEGER
);
INSERT INTO movimientos_nueva (id, fecha, tipo, producto_id, producto_nombre, tipo_stock, categoria_id, cantidad, precio_unit, costo_unit, nota, usuario, anulado, credito_id)
  SELECT id, fecha, tipo, producto_id, producto_nombre, CASE tipo_stock WHEN 'local' THEN 'local2' ELSE tipo_stock END, categoria_id, cantidad, precio_unit, costo_unit, nota, usuario, anulado, credito_id FROM movimientos;
DROP TABLE movimientos;
ALTER TABLE movimientos_nueva RENAME TO movimientos;
CREATE INDEX movimientos_fecha ON movimientos (fecha);
CREATE INDEX movimientos_producto ON movimientos (producto_id);
