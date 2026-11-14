-- Huella o Face ID (passkeys / WebAuthn). Solo se activa DESPUÉS de entrar con contraseña. La clave pública no es secreta.
CREATE TABLE passkeys (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  clave_publica TEXT NOT NULL,
  contador INTEGER NOT NULL DEFAULT 0,
  transportes TEXT NOT NULL DEFAULT '[]',
  nombre TEXT NOT NULL DEFAULT '' CHECK (length(nombre) <= 60),
  creado TEXT NOT NULL DEFAULT (datetime('now')),
  usado TEXT
);
CREATE INDEX passkeys_usuario ON passkeys (usuario_id);

-- Retos de un solo uso (5 minutos) para registrar o entrar con huella.
CREATE TABLE retos (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('registro', 'entrada')),
  reto TEXT NOT NULL,
  usuario_id TEXT,
  expira TEXT NOT NULL
);
