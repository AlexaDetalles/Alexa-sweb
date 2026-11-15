-- Personalizador de regalos totalmente configurable desde el panel:
--   pasos: los pasos del regalo (nombre, textos, una o varias opciones, mínimo y máximo, y de qué otro paso dependen);
--   opciones: ahora con foto, descripción corta y etiqueta («Popular», «Nuevo»);
--   regalo_config: textos y dedicatoria de cada público (para ella / para él).
-- Lo que ya existía (6 pasos fijos y 41 opciones) se conserva tal cual.

PRAGMA defer_foreign_keys = on;

CREATE TABLE pasos (
  publico TEXT NOT NULL CHECK (publico IN ('mujer', 'hombre')),
  id TEXT NOT NULL CHECK (id NOT GLOB '*[^a-z0-9-]*' AND length(id) BETWEEN 1 AND 30),
  nombre TEXT NOT NULL CHECK (length(nombre) BETWEEN 1 AND 24),
  titulo TEXT NOT NULL CHECK (length(titulo) BETWEEN 1 AND 70),
  descripcion TEXT NOT NULL DEFAULT '' CHECK (length(descripcion) <= 240),
  tipo TEXT NOT NULL DEFAULT 'unico' CHECK (tipo IN ('unico', 'multiple')),
  minimo INTEGER NOT NULL DEFAULT 1 CHECK (minimo BETWEEN 0 AND 20),
  maximo INTEGER NOT NULL DEFAULT 1 CHECK (maximo BETWEEN 1 AND 50),
  depende_de TEXT,
  orden INTEGER NOT NULL DEFAULT 0 CHECK (orden BETWEEN 0 AND 10000),
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  PRIMARY KEY (publico, id),
  CHECK (minimo <= maximo),
  CHECK (tipo = 'multiple' OR maximo = 1)
);

INSERT INTO pasos (publico, id, nombre, titulo, descripcion, tipo, minimo, maximo, depende_de, orden) VALUES
  ('mujer', 'base', 'Base', 'Empieza por la base.', 'Elige el empaque que mejor va con tu idea.', 'unico', 1, 1, NULL, 10),
  ('mujer', 'tamano', 'Tamaño', 'Un tamaño a su medida.', 'Estos tamaños son compatibles con la base que elegiste.', 'unico', 1, 1, 'base', 20),
  ('mujer', 'contenido', 'Contenido', 'Lo que lleva dentro.', 'Selecciona uno o varios contenidos para tu arreglo.', 'multiple', 1, 50, 'tamano', 30),
  ('mujer', 'peluches', 'Peluches', 'Un abrazo extra.', 'Opcional: elige hasta dos peluches, o continúa sin añadir.', 'multiple', 0, 2, NULL, 40),
  ('mujer', 'globos', 'Globos', 'Un toque para celebrar.', 'Opcional: elige los globos que quieras, o continúa sin añadir.', 'multiple', 0, 50, NULL, 50),
  ('mujer', 'entrega', 'Entrega', 'Cómo lo recibe.', 'Elige cómo quieres recibirlo.', 'unico', 1, 1, NULL, 60);
INSERT INTO pasos SELECT 'hombre', id, nombre, titulo, descripcion, tipo, minimo, maximo, depende_de, orden, activo FROM pasos WHERE publico = 'mujer';

CREATE TABLE regalo_config (
  publico TEXT PRIMARY KEY CHECK (publico IN ('mujer', 'hombre')),
  titulo TEXT NOT NULL DEFAULT '' CHECK (length(titulo) <= 80),
  intro TEXT NOT NULL DEFAULT '' CHECK (length(intro) <= 240),
  dedicatoria_activa INTEGER NOT NULL DEFAULT 1 CHECK (dedicatoria_activa IN (0, 1)),
  dedicatoria_titulo TEXT NOT NULL DEFAULT '' CHECK (length(dedicatoria_titulo) <= 70),
  dedicatoria_ayuda TEXT NOT NULL DEFAULT '' CHECK (length(dedicatoria_ayuda) <= 240),
  dedicatoria_max INTEGER NOT NULL DEFAULT 250 CHECK (dedicatoria_max BETWEEN 20 AND 600),
  nota_final TEXT NOT NULL DEFAULT '' CHECK (length(nota_final) <= 240),
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
);
INSERT INTO regalo_config (publico, titulo, intro, dedicatoria_titulo, dedicatoria_ayuda, nota_final) VALUES
  ('mujer', 'Un regalo para ella, a tu gusto.', 'Elige paso a paso y lo preparamos con cariño.', 'Las últimas palabras.', 'Escribe algo que le saque una sonrisa. Aparecerá en una tarjeta dentro del regalo.', 'Confirmamos disponibilidad, precio y fecha de entrega por WhatsApp antes de preparar tu regalo.'),
  ('hombre', 'Un regalo para él, a tu gusto.', 'Elige paso a paso y lo preparamos con cariño.', 'Las últimas palabras.', 'Escribe algo que le saque una sonrisa. Aparecerá en una tarjeta dentro del regalo.', 'Confirmamos disponibilidad, precio y fecha de entrega por WhatsApp antes de preparar tu regalo.');

-- opciones: se reconstruye con foto, descripción y etiqueta, sin el código interno (ahora los pasos se enlazan por id).
CREATE TABLE opciones_vieja AS SELECT * FROM opciones;
DROP TABLE opciones;
CREATE TABLE opciones (
  publico TEXT NOT NULL,
  id TEXT NOT NULL CHECK (id NOT GLOB '*[^A-Za-z0-9._-]*' AND length(id) BETWEEN 1 AND 40),
  paso TEXT NOT NULL,
  nombre TEXT NOT NULL CHECK (length(nombre) BETWEEN 1 AND 80),
  descripcion TEXT NOT NULL DEFAULT '' CHECK (length(descripcion) <= 200),
  etiqueta TEXT NOT NULL DEFAULT '' CHECK (length(etiqueta) <= 20),
  precio REAL NOT NULL DEFAULT 0 CHECK (precio >= 0 AND precio <= 1000000),
  padre_id TEXT,
  imagen_url TEXT CHECK (imagen_url IS NULL OR imagen_url LIKE '/fotos/%' OR imagen_url LIKE '/assets/images/%'),
  activa INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1)),
  orden INTEGER NOT NULL DEFAULT 0 CHECK (orden BETWEEN 0 AND 10000),
  PRIMARY KEY (publico, id),
  FOREIGN KEY (publico, paso) REFERENCES pasos (publico, id) ON DELETE CASCADE,
  FOREIGN KEY (publico, padre_id) REFERENCES opciones (publico, id) ON DELETE CASCADE
);
INSERT INTO opciones (publico, id, paso, nombre, precio, imagen_url, activa, orden)
  SELECT publico, id, paso, nombre, precio, imagen_url, activa, orden FROM opciones_vieja;
UPDATE opciones SET padre_id = (SELECT v.padre_id FROM opciones_vieja v WHERE v.publico = opciones.publico AND v.id = opciones.id);
DROP TABLE opciones_vieja;
CREATE INDEX opciones_paso ON opciones (publico, paso);
