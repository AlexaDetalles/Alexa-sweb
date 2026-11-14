// Píldora de consentimiento: aceptar términos + almacenamiento y medición propia, o quedarse solo con lo necesario.
// Nada se mide antes de que la persona elija. Sin cookies de terceros, sin IP, sin datos personales.
const CLAVE = 'alexa_consent', VID = 'alexa_vid', VERSION = 1;
const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento: se pregunta de nuevo la próxima vez */ } };
const borrar = (k) => { try { localStorage.removeItem(k); } catch { /* da igual */ } };

export function consentimiento() {
  try { const v = JSON.parse(leer(CLAVE)); return v && v.v === VERSION ? v : null; } catch { return null; }
}
// Quien activa «no rastrear» en su navegador (GPC) no es medido aunque acepte.
const gpc = () => navigator.globalPrivacyControl === true;
const medible = () => consentimiento()?.analitica === true && !gpc();

function enviar(cuerpo) {
  try { fetch('/api/vista', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo), keepalive: true }).catch(() => {}); } catch { /* la medición nunca estorba */ }
}
function identificador() {
  let id = leer(VID);
  if (!id || !/^[0-9a-f-]{16,64}$/i.test(id)) { id = (crypto.randomUUID?.() ?? `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`); guardar(VID, id); }
  return id;
}
/** Anota una visita o un evento (whatsapp, agregar) solo si la persona aceptó. */
export function medir(extra = {}) {
  if (!medible()) return;
  enviar({ vid: identificador(), ...extra });
}

function pintar() {
  if ($pildora()) return;
  const el = document.createElement('div');
  el.className = 'cookie-pill';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-labelledby', 'ck-titulo');
  el.setAttribute('aria-describedby', 'ck-texto');
  el.innerHTML = `<div class="ck-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9 4 4 0 0 1-4-4 4 4 0 0 1-4-4 1 1 0 0 0-1-1Z"/><circle cx="9" cy="10" r="1"/><circle cx="14" cy="15" r="1"/><circle cx="8.500" cy="15" r=".8"/></svg></div>
  <div class="ck-texto"><b id="ck-titulo">¿Aceptas?</b><p id="ck-texto">Guardamos en tu navegador tu bolsa y, si aceptas, medimos las visitas con una herramienta propia, sin publicidad ni datos personales. Al aceptar confirmas que leíste los <a href="/terminos.html">Términos</a> y la <a href="/privacidad.html">Privacidad</a>.</p></div>
  <div class="ck-botones"><button type="button" class="ck-no" data-ck="no">Solo lo necesario</button><button type="button" class="ck-si" data-ck="si">Aceptar</button></div>`;
  document.body.append(el);
  document.body.classList.add('ck-open');
  requestAnimationFrame(() => el.classList.add('visible'));
  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-ck]');
    if (!b) return;
    const acepta = b.dataset.ck === 'si';
    guardar(CLAVE, JSON.stringify({ v: VERSION, analitica: acepta, fecha: new Date().toISOString() }));
    if (acepta) { enviar({ evento: 'acepta' }); medir({ ruta: location.pathname }); } else { borrar(VID); enviar({ evento: 'rechaza' }); }
    el.classList.remove('visible');
    document.body.classList.remove('ck-open');
    setTimeout(() => el.remove(), 350);
  });
}
const $pildora = () => document.querySelector('.cookie-pill');

export function iniciarConsentimiento() {
  if (!consentimiento()) pintar();
  // «Cookies» en el pie permite cambiar la elección cuando se quiera.
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest('[data-cookies]');
    if (!a) return;
    ev.preventDefault();
    borrar(CLAVE); borrar(VID);
    pintar();
  });
}
