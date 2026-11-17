-- Gastos (lo que sale además de la compra: bus, envío, empaque…), ventas a crédito y abonos.

-- Recargo sugerido para vender a crédito (en %): un tenis de L 1,000 a +20 % son L 1,200 en pagos.
ALTER TABLE ajustes ADD COLUMN credito_pct REAL NOT NULL DEFAULT 20 CHECK (credito_pct >= 0 AND credito_pct <= 500);

-- Gastos. movimiento_id: si salió por una venta concreta (el bus para llevarla), se anula junto con ella.
CREATE TABLE gastos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL DEFAULT (datetime('now')),
  concepto TEXT NOT NULL CHECK (length(concepto) BETWEEN 1 AND 80),
  categoria TEXT NOT NULL DEFAULT 'otro' CHECK (categoria IN ('bus', 'envio', 'empaque', 'comision', 'otro')),
  monto REAL NOT NULL CHECK (monto > 0 AND monto <= 100000000),
  movimiento_id INTEGER,
  nota TEXT NOT NULL DEFAULT '' CHECK (length(nota) <= 200),
  usuario TEXT NOT NULL DEFAULT '',
  anulado INTEGER NOT NULL DEFAULT 0 CHECK (anulado IN (0, 1))
);
CREATE INDEX gastos_fecha ON gastos (fecha);
CREATE INDEX gastos_movimiento ON gastos (movimiento_id);

-- Ventas a crédito. precio_contado es lo que costaba al contado (todas las unidades); total = cuotas × cuota_monto y SIEMPRE es mayor:
-- el crédito nunca puede salir igual o más barato que el contado. inicio = día (Honduras) de la primera cuota; las demás cada intervalo_dias.
CREATE TABLE creditos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL DEFAULT (datetime('now')),
  inicio TEXT NOT NULL,
  movimiento_id INTEGER NOT NULL,
  producto_id TEXT NOT NULL,
  producto_nombre TEXT NOT NULL,
  cantidad INTEGER NOT NULL CHECK (cantidad BETWEEN 1 AND 100000),
  cliente TEXT NOT NULL CHECK (length(cliente) BETWEEN 1 AND 80),
  telefono TEXT NOT NULL DEFAULT '' CHECK (telefono NOT GLOB '*[^0-9]*' AND length(telefono) <= 15),
  precio_contado REAL NOT NULL CHECK (precio_contado >= 0),
  cuotas INTEGER NOT NULL CHECK (cuotas BETWEEN 2 AND 24),
  cuota_monto REAL NOT NULL CHECK (cuota_monto > 0),
  total REAL NOT NULL,
  intervalo_dias INTEGER NOT NULL DEFAULT 15 CHECK (intervalo_dias BETWEEN 1 AND 90),
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'pagado', 'anulado')),
  pagado_en TEXT,
  usuario TEXT NOT NULL DEFAULT '',
  CHECK (total > precio_contado)
);
CREATE INDEX creditos_estado ON creditos (estado);

CREATE TABLE abonos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  credito_id INTEGER NOT NULL REFERENCES creditos (id) ON DELETE CASCADE,
  fecha TEXT NOT NULL DEFAULT (datetime('now')),
  monto REAL NOT NULL CHECK (monto > 0 AND monto <= 100000000),
  nota TEXT NOT NULL DEFAULT '' CHECK (length(nota) <= 200),
  usuario TEXT NOT NULL DEFAULT '',
  anulado INTEGER NOT NULL DEFAULT 0 CHECK (anulado IN (0, 1))
);
CREATE INDEX abonos_credito ON abonos (credito_id);

-- Qué venta nació de un crédito.
ALTER TABLE movimientos ADD COLUMN credito_id INTEGER;
