-- Colecciones nuevas: Ropa (para ella / para él) y Tenis (el antiguo «Calzado», que estaba oculto).
-- Los productos se agregan desde el panel; hasta entonces las páginas muestran «Esta colección se está preparando».
INSERT OR IGNORE INTO categorias (id, nombre, padre_id, orden, activa) VALUES
  ('ROPA', 'Ropa', NULL, 35, 1);
INSERT OR IGNORE INTO categorias (id, nombre, padre_id, orden, activa) VALUES
  ('RPM', 'Ropa para ella', 'ROPA', 36, 1),
  ('RPH', 'Ropa para él', 'ROPA', 37, 1);
UPDATE categorias SET nombre = 'Tenis', activa = 1 WHERE id = 'CALZADO';
UPDATE categorias SET nombre = 'Tenis para él', activa = 1 WHERE id = 'CHM';
UPDATE categorias SET nombre = 'Tenis para ella', activa = 1 WHERE id = 'CMM';
