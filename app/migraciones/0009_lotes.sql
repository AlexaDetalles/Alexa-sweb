-- Lotes de inversión: una compra grande (ej. L 45,000 por todo el catálogo) cuyo costo por producto no se conoce.
-- Se reparte entre los productos del lote en proporción a su precio de etiqueta/referencia; así cada producto tiene un costo estimado
-- y la ganancia sale con el precio que tú pongas. El «precio sugerido» es el que haría que todo el lote llegue a la meta de ventas.
CREATE TABLE lotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL CHECK (length(nombre) BETWEEN 1 AND 80),
  inversion REAL NOT NULL CHECK (inversion >= 0 AND inversion <= 100000000),   -- lo que pagaste por todo
  meta REAL NOT NULL CHECK (meta >= 0 AND meta <= 1000000000),                  -- cuánto quieres vender con todo el lote
  completo INTEGER NOT NULL DEFAULT 0 CHECK (completo IN (0, 1)),               -- 1 = ya cargaste todo el lote: el reparto es exacto
  creado TEXT NOT NULL DEFAULT (datetime('now'))
);
-- lote_id: a qué lote pertenece; referencia: precio de etiqueta (o el valor que sirva de guía) en lempiras; lote_cantidad: unidades compradas en el lote.
ALTER TABLE productos ADD COLUMN lote_id INTEGER REFERENCES lotes (id) ON DELETE SET NULL;
ALTER TABLE productos ADD COLUMN referencia REAL CHECK (referencia IS NULL OR (referencia >= 0 AND referencia <= 1000000));
ALTER TABLE productos ADD COLUMN lote_cantidad INTEGER CHECK (lote_cantidad IS NULL OR (lote_cantidad >= 1 AND lote_cantidad <= 100000));
CREATE INDEX productos_lote ON productos (lote_id);
