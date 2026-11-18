// ZIP mínimo (sin compresión) hecho a mano: junta muchas imágenes en UN solo archivo para descargar. Sin librerías.
const TABLA = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(bytes) { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = TABLA[(c ^ bytes[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

const fechaDOS = (d) => ({ hora: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dia: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() });
const u16 = (n) => new Uint8Array([n & 255, (n >> 8) & 255]);
const u32 = (n) => new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);

/** Nombre seguro dentro del zip: sin carpetas raras ni caracteres que den problemas en Windows o en el celular. */
export const nombreSeguro = (n) => String(n).normalize('NFC').replace(/[\\/:*?"<>|\x00-\x1f]+/g, '-').replace(/^\.+/, '').slice(0, 120) || 'archivo';

/**
 * archivos: [{ nombre, datos: Blob | Uint8Array }] → Blob del .zip (los nombres repetidos se numeran: «a.jpg», «a (2).jpg»).
 */
export async function crearZip(archivos, ahora = new Date()) {
  const partes = [], central = [], usados = new Map();
  let desplazamiento = 0;
  const { hora, dia } = fechaDOS(ahora);
  for (const a of archivos) {
    let nombre = nombreSeguro(a.nombre);
    const n = (usados.get(nombre) ?? 0) + 1; usados.set(nombre, n);
    if (n > 1) nombre = nombre.replace(/(\.[^.]*)?$/, ` (${n})$1`);
    const bytes = a.datos instanceof Uint8Array ? a.datos : new Uint8Array(await a.datos.arrayBuffer());
    const nom = new TextEncoder().encode(nombre), crc = crc32(bytes);
    const cabecera = [u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(hora), u16(dia), u32(crc), u32(bytes.length), u32(bytes.length), u16(nom.length), u16(0), nom];
    partes.push(...cabecera, bytes);
    const largoCabecera = 30 + nom.length;
    central.push([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(hora), u16(dia), u32(crc), u32(bytes.length), u32(bytes.length), u16(nom.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(desplazamiento), nom]);
    desplazamiento += largoCabecera + bytes.length;
  }
  const inicio = desplazamiento; let tamCentral = 0;
  for (const c of central) { partes.push(...c); tamCentral += c.reduce((s, x) => s + x.length, 0); }
  partes.push(u32(0x06054b50), u16(0), u16(0), u16(archivos.length), u16(archivos.length), u32(tamCentral), u32(inicio), u16(0));
  return new Blob(partes, { type: 'application/zip' });
}
