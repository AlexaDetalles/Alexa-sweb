-- Interruptor: ¿se muestra el Stock local 2 en la tienda? Por defecto NO (0): es inventario privado hasta que se decida publicarlo.
-- Mientras esté en 0, esos productos no salen en el catálogo, las páginas de colección, las fichas, los relacionados ni el sitemap.
ALTER TABLE ajustes ADD COLUMN mostrar_local2 INTEGER NOT NULL DEFAULT 0 CHECK (mostrar_local2 IN (0, 1));
