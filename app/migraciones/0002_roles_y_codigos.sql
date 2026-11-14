-- Usuarios con rangos + códigos de un solo uso (alta de la primera administradora, invitaciones y recuperación).
-- Las cuentas que ya existían quedan como administradoras.
ALTER TABLE usuarios ADD COLUMN nombre TEXT NOT NULL DEFAULT '' CHECK (length(nombre) <= 60);
ALTER TABLE usuarios ADD COLUMN rol TEXT NOT NULL DEFAULT 'admin' CHECK (rol IN ('admin', 'catalogo', 'atencion', 'lectura'));
ALTER TABLE usuarios ADD COLUMN activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1));

-- Solo se guardan hashes: el código o el enlace que llega por correo nunca queda escrito aquí.
--   registro   : id = 'registro:<correo>'. Alta de la primera administradora (código de 6 dígitos; clave ya con hash).
--   invitacion : id = hash del enlace. La administradora invita a alguien con un rango; esa persona elige su contraseña.
--   recuperar  : id = hash del enlace. Para quien olvidó su contraseña.
CREATE TABLE codigos (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('registro', 'invitacion', 'recuperar')),
  correo TEXT NOT NULL,
  usuario_id TEXT REFERENCES usuarios (id) ON DELETE CASCADE,
  nombre TEXT NOT NULL DEFAULT '',
  rol TEXT NOT NULL DEFAULT 'admin' CHECK (rol IN ('admin', 'catalogo', 'atencion', 'lectura')),
  clave TEXT,
  secreto_hash TEXT,
  expira TEXT NOT NULL,
  intentos INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX codigos_correo ON codigos (tipo, correo);
