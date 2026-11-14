// Correos del panel con Resend: código de la primera administradora, invitaciones y recuperación de contraseña.
import { falla } from './util.js';

export async function enviarCorreo(env, { para, asunto, texto }) {
  if (!env.RESEND_API_KEY) {
    // En pruebas locales (DEV=1) el correo se muestra en la consola de wrangler.
    if (env.DEV === '1') return console.log(`[correo] Para ${para} · ${asunto}\n${texto}`);
    falla(500, 'Falta configurar el envío de correos (RESEND_API_KEY).');
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${env.NOMBRE} <${env.REMITENTE}>`, to: [para], subject: asunto, text: texto }),
  });
  // Al registro va el estado y un resumen sin direcciones de correo (los registros de Cloudflare se guardan).
  if (!r.ok) {
    console.error('Resend', r.status, (await r.text()).replace(/[^\s@"]+@[^\s@"]+/g, '[correo]').slice(0, 200));
    falla(502, 'No pudimos enviar el correo. Intenta de nuevo en un momento.');
  }
}

/** Dirección pública fija del panel (variable SITIO): los enlaces nunca se arman con el encabezado Host de la petición. */
export function sitio(env) {
  const s = env.SITIO || (env.DEV === '1' ? 'http://localhost:8787' : '');
  if (!s) falla(500, 'Falta configurar SITIO (la dirección pública de la tienda).');
  return s.replace(/\/$/, '');
}
