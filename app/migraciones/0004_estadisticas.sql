-- Medición propia de visitas, SOLO de quien acepta. Sin IP, sin cookies y sin datos personales:
--   visitantes: un código irreversible que cambia cada día (hash del identificador aleatorio + la fecha), así se cuentan
--               personas distintas por día pero no se puede seguir a nadie de un día a otro.
--   acepta / rechaza: cuántas personas eligen cada opción en la píldora (suma anónima, sin identificador).
CREATE TABLE visitas (
  dia TEXT NOT NULL,
  ruta TEXT NOT NULL CHECK (length(ruta) <= 120),
  vistas INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (dia, ruta)
);
CREATE TABLE visitantes (
  dia TEXT NOT NULL,
  hash TEXT NOT NULL CHECK (length(hash) = 32),
  PRIMARY KEY (dia, hash)
);
CREATE TABLE vistas_producto (
  dia TEXT NOT NULL,
  producto_id TEXT NOT NULL,
  vistas INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (dia, producto_id)
);
CREATE TABLE eventos (
  dia TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('whatsapp', 'agregar', 'acepta', 'rechaza')),
  cantidad INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (dia, tipo)
);
