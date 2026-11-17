-- Cantidad en existencia por producto. NULL = no se lleva control (como hasta ahora, solo «Hay / Agotado»).
-- Con un número, la tienda marca «No disponible» sola al llegar a 0 y avisa «Últimas unidades» cuando quedan pocas.
ALTER TABLE productos ADD COLUMN cantidad INTEGER CHECK (cantidad IS NULL OR (cantidad >= 0 AND cantidad <= 100000));
