// Precio sugerido y costo estimado de un producto dentro de un lote (misma fórmula que worker/lotes.js).
// otros: filas del lote SIN este producto [{referencia|precio, unidades}]. Devuelve null si no hay etiqueta.
export function estimarEnLote(lote, otros, { referencia, unidades }) {
  const ref = Number(referencia);
  if (!lote || !Number.isFinite(ref) || ref <= 0) return null;
  const u = Math.max(1, Number(unidades) || 1);
  const suma = otros.reduce((s, f) => s + (f.referencia ?? f.precio ?? 0) * f.unidades, 0) + ref * u;
  const total = lote.completo ? suma : Math.max(suma, lote.meta);
  return { sugerido: Math.max(10, Math.round((ref * lote.meta / total) / 10) * 10), costo: Math.round((ref * lote.inversion / total) * 100) / 100 };
}
