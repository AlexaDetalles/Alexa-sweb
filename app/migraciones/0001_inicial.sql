-- Base de datos de AlexaShop en Cloudflare D1 (SQLite).
-- Las reglas de la base repiten las del Worker: si algo se salta la API, la base igual rechaza el dato.

-- Categorías: un nivel de subcategorías (Perfumes → Perfumes para él). El id es el código corto que usa la tienda (HP, MP…).
CREATE TABLE categorias (
  id TEXT PRIMARY KEY CHECK (id NOT GLOB '*[^A-Z0-9]*' AND length(id) BETWEEN 1 AND 14),
  nombre TEXT NOT NULL CHECK (length(nombre) BETWEEN 1 AND 60),
  padre_id TEXT REFERENCES categorias (id) ON DELETE SET NULL,
  orden INTEGER NOT NULL DEFAULT 0 CHECK (orden BETWEEN 0 AND 10000),
  activa INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1)),
  CHECK (padre_id IS NULL OR padre_id <> id)
);

-- Productos del catálogo. El id es la referencia que ve el cliente y viaja en el mensaje de WhatsApp (PHP-01).
-- precio NULL + cotizar = 1: regalos por encargo que se cotizan por WhatsApp.
CREATE TABLE productos (
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
  -- Papelera: un producto borrado guarda la fecha y se elimina de verdad a los 30 días.
  borrado_en TEXT,
  CHECK (cotizar = 1 OR precio IS NOT NULL)
);
CREATE INDEX productos_publicos ON productos (borrado_en, visible, orden);
CREATE INDEX productos_categoria ON productos (categoria_id);

-- Personalizador de regalos, uno por público ("mujer" y "hombre"), con pasos encadenados:
--   base → tamaño (de esa base) → contenido (de ese tamaño); peluches, globos y entrega son libres.
-- codigo es el enlace interno que usa la tienda; el panel lo genera solo y nadie lo escribe.
CREATE TABLE opciones (
  publico TEXT NOT NULL CHECK (publico IN ('mujer', 'hombre')),
  id TEXT NOT NULL CHECK (id NOT GLOB '*[^A-Za-z0-9._-]*' AND length(id) BETWEEN 1 AND 40),
  paso TEXT NOT NULL CHECK (paso IN ('base', 'tamano', 'contenido', 'peluches', 'globos', 'entrega')),
  nombre TEXT NOT NULL CHECK (length(nombre) BETWEEN 1 AND 80),
  precio REAL NOT NULL DEFAULT 0 CHECK (precio >= 0 AND precio <= 1000000),
  codigo TEXT NOT NULL CHECK (length(codigo) BETWEEN 1 AND 40),
  padre_id TEXT,
  imagen_url TEXT CHECK (imagen_url IS NULL OR imagen_url LIKE '/fotos/%' OR imagen_url LIKE '/assets/images/%'),
  activa INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1)),
  orden INTEGER NOT NULL DEFAULT 0 CHECK (orden BETWEEN 0 AND 10000),
  PRIMARY KEY (publico, id),
  UNIQUE (publico, codigo),
  FOREIGN KEY (publico, padre_id) REFERENCES opciones (publico, id) ON DELETE CASCADE,
  CHECK ((paso IN ('tamano', 'contenido')) = (padre_id IS NOT NULL))
);

-- Una sola fila con los datos de contacto que usa la tienda al armar el mensaje de WhatsApp.
CREATE TABLE ajustes (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  asesora1_nombre TEXT NOT NULL DEFAULT 'Asesora 1' CHECK (length(asesora1_nombre) BETWEEN 1 AND 40),
  asesora1_whatsapp TEXT NOT NULL DEFAULT '' CHECK (asesora1_whatsapp NOT GLOB '*[^0-9]*' AND length(asesora1_whatsapp) <= 15),
  asesora2_nombre TEXT NOT NULL DEFAULT 'Asesora 2' CHECK (length(asesora2_nombre) BETWEEN 1 AND 40),
  asesora2_whatsapp TEXT NOT NULL DEFAULT '' CHECK (asesora2_whatsapp NOT GLOB '*[^0-9]*' AND length(asesora2_whatsapp) <= 15)
);
INSERT INTO ajustes (id, asesora1_whatsapp, asesora2_whatsapp) VALUES (1, '50497320939', '50499226664');

-- Panel: usuarios y seguridad ---------------------------------------------------
-- No hay registro público: los usuarios se crean con herramientas/crear-usuario.mjs.
CREATE TABLE usuarios (
  id TEXT PRIMARY KEY,
  correo TEXT NOT NULL UNIQUE CHECK (correo LIKE '%_@_%._%' AND length(correo) <= 120),
  -- pbkdf2$<iteraciones>$<sal hex>$<hash hex>
  clave TEXT NOT NULL CHECK (clave LIKE 'pbkdf2$%'),
  creado TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Solo se guarda el hash SHA-256 del token; la cookie lleva el token.
CREATE TABLE sesiones (
  token_hash TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  creada TEXT NOT NULL DEFAULT (datetime('now')),
  expira TEXT NOT NULL,
  ultimo TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Intentos fallidos de contraseña: 5 fallos bloquean 15 minutos.
CREATE TABLE intentos (
  clave TEXT PRIMARY KEY,
  fallos INTEGER NOT NULL DEFAULT 0,
  bloqueado_hasta TEXT
);
