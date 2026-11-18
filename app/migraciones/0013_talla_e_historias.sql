-- Talla del producto (texto libre: «M», «28», «9.5»…): sale en la imagen para redes.
ALTER TABLE productos ADD COLUMN talla TEXT NOT NULL DEFAULT '' CHECK (length(talla) <= 20);
-- Publicaciones: normal (post) o historia (Stories de Instagram y de Facebook, formato vertical 9:16).
ALTER TABLE publicaciones ADD COLUMN formato TEXT NOT NULL DEFAULT 'post' CHECK (formato IN ('post', 'historia'));
