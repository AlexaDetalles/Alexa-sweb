// Cuentas del crédito en el panel (misma regla que worker/creditos.js).
export const redondear = (n) => Math.round(n * 100) / 100;

/** Pago sugerido por cuota con el recargo %, hacia arriba a múltiplos de 10 y siempre por encima del contado. */
export function cuotaSugerida(contado, cuotas, pct) {
  if (!(contado > 0) || !(cuotas >= 2)) return null;
  let c = Math.ceil((contado * (1 + pct / 100)) / cuotas / 10) * 10;
  while (c * cuotas <= contado) c += 10;
  return c;
}

/** Lo que se muestra al armar un crédito: total, recargo, saldo tras el abono y si la regla se cumple. */
export function resumenCredito({ contado, cuotas, cuota, abono }) {
  const n = Number(cuotas), c = Number(cuota);
  if (!(contado > 0) || !Number.isInteger(n) || n < 2 || n > 24 || !(c > 0)) return { listo: false };
  const total = redondear(n * c), ok = total > contado, ab = Number(abono) || 0;
  return { listo: true, ok, total, recargo: redondear(total - contado), recargoPct: Math.round(((total - contado) / contado) * 1000) / 10, saldo: redondear(Math.max(0, total - ab)), abonoValido: ab >= 0 && ab <= total };
}

const tel = (t) => { const d = String(t || '').replace(/\D/g, ''); return d.length === 8 ? `504${d}` : d; };
/** Enlace de WhatsApp con el recordatorio de pago ya escrito (el número de Honduras de 8 dígitos lleva el 504). */
export function enlaceRecordatorio(c, lps) {
  const numero = tel(c.telefono);
  if (!numero) return '';
  const cuando = c.dias === 0 ? 'hoy' : c.dias < 0 ? `desde hace ${-c.dias} día${c.dias === -1 ? '' : 's'}` : `el ${c.proximo_vencimiento}`;
  const texto = `Hola ${c.cliente}, te escribimos de Tiendas Alexa. Te recordamos tu pago de ${lps(c.monto_vencido > 0 ? c.monto_vencido : c.cuota_monto)} por «${c.producto_nombre}» (${cuando}). Tu saldo es ${lps(c.saldo)}. ¡Gracias!`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
