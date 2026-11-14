// Pasa el inventario que hoy vive en las hojas de cálculo (CSV) a la base de datos, una sola vez.
// Uso:  node herramientas/semilla.mjs [--remoto]        (sin --remoto: base local de wrangler)
//       node herramientas/semilla.mjs --sql             (solo imprime el SQL, no ejecuta nada)
// Es seguro repetirlo: INSERT OR IGNORE no pisa lo que ya editaste en el panel.
// Las fotos que ya están en public/assets/images se conservan; las que apuntaban a sitios externos
// (Pinterest, placeholders) quedan sin foto para subirlas desde el panel.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, ejecutarSql, sql } from './comun.mjs';
import { parseCSV, imageURL } from '../public/assets/core.mjs';

const datos = (f) => readFileSync(join(RAIZ, 'public/assets/data', f), 'utf8');
const NO_FOTO = '/assets/images/no-photo.svg';
const foto = (raw) => { const u = imageURL(raw); return u === NO_FOTO ? null : u; };
const precio = (raw) => { const n = Number(String(raw).replace(/,/g, '')); return Number.isFinite(n) && n >= 0 && n <= 1000000 ? n : null; };

// Categorías: la tienda las tenía escritas en el código (GROUPS); ahora son filas editables desde el panel.
const CATEGORIAS = [
  ['PERFUMES', 'Perfumes', null, 10, 1], ['ACCESORIOS', 'Accesorios', null, 20, 1], ['REGALOS', 'Regalos prearmados', null, 30, 1], ['CALZADO', 'Calzado', null, 40, 0],
  ['HP', 'Perfumes para él', 'PERFUMES', 11, 1], ['MP', 'Perfumes para ella', 'PERFUMES', 12, 1],
  ['PHP', 'Premium para él', 'PERFUMES', 13, 1], ['PMP', 'Premium para ella', 'PERFUMES', 14, 1],
  ['JYA', 'Joyería', 'ACCESORIOS', 21, 1], ['RLA', 'Relojes', 'ACCESORIOS', 22, 1], ['CTA', 'Carteras', 'ACCESORIOS', 23, 1],
  ['PAG', 'Regalos para ella', 'REGALOS', 31, 1], ['PAGH', 'Regalos para él', 'REGALOS', 32, 1],
  // Calzado estaba en la hoja pero la tienda no lo mostraba: se importa oculto, para activarlo cuando quieras.
  ['CHM', 'Calzado para él', 'CALZADO', 41, 0], ['CMM', 'Calzado para ella', 'CALZADO', 42, 0],
];
const ids = new Set(CATEGORIAS.map((c) => c[0]));

const salida = ['PRAGMA foreign_keys = ON;'];
for (const [id, nombre, padre, orden, activa] of CATEGORIAS) {
  salida.push(`INSERT OR IGNORE INTO categorias (id, nombre, padre_id, orden, activa) VALUES (${sql(id)}, ${sql(nombre)}, ${sql(padre)}, ${orden}, ${activa});`);
}

// Productos: columnas ID, Nombre, Precio, Imagen, Stock, Categoría, Descripción.
const vistos = new Set(); let omitidos = 0, orden = 0;
for (const c of parseCSV(datos('catalog.csv')).slice(1)) {
  const id = c[0], cat = c[5], p = precio(c[2] ?? '');
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(id) || !c[1] || !ids.has(cat) || p === null || vistos.has(id)) { omitidos++; continue; }
  vistos.add(id);
  salida.push(`INSERT OR IGNORE INTO productos (id, nombre, categoria_id, descripcion, precio, imagen_url, disponible, visible, orden) VALUES (${sql(id)}, ${sql(c[1])}, ${sql(cat)}, ${sql((c[6] || '').slice(0, 1200))}, ${p}, ${sql(foto(c[3]))}, ${/^true$/i.test(c[4]) ? 1 : 0}, 1, ${++orden * 10});`);
}

// Regalos por encargo (estaban escritos en gifts.mjs): se cotizan por WhatsApp.
const { PREPARED_GIFTS } = await import('../public/assets/gifts.mjs');
for (const g of PREPARED_GIFTS) {
  salida.push(`INSERT OR IGNORE INTO productos (id, nombre, categoria_id, descripcion, precio, cotizar, imagen_url, disponible, visible, orden) VALUES (${sql(g.id)}, ${sql(g.name)}, ${sql(g.group)}, ${sql(g.description)}, NULL, 1, ${sql(g.img)}, 1, 1, ${++orden * 10});`);
}

// Personalizador: hombre.csv y mujer.csv. Columnas ID, IDPaso (padre), Categoría, Nombre, Precio, Código, Imagen.
const PASOS = { Base: 'base', 'Tamaño': 'tamano', Contenido: 'contenido', Peluches: 'peluches', Globos: 'globos', Delivery: 'entrega' };
for (const publico of ['mujer', 'hombre']) {
  const filas = parseCSV(datos(`${publico}.csv`)).slice(1).filter((c) => PASOS[c[2]] && c[3] && precio(c[4] ?? '') !== null);
  const idDeCodigo = new Map(filas.map((c) => [c[5], c[0]]));
  const contador = {};
  for (const c of filas) {
    const paso = PASOS[c[2]];
    const padre = ['tamano', 'contenido'].includes(paso) ? idDeCodigo.get(c[1]) : null;
    if (['tamano', 'contenido'].includes(paso) && !padre) continue; // opción huérfana en la hoja
    // INSERT OR IGNORE: el padre debe existir antes, y la hoja ya trae bases → tamaños → contenido en ese orden.
    salida.push(`INSERT OR IGNORE INTO opciones (publico, id, paso, nombre, precio, codigo, padre_id, imagen_url, orden) VALUES (${sql(publico)}, ${sql(c[0])}, ${sql(paso)}, ${sql(c[3])}, ${precio(c[4])}, ${sql(c[5])}, ${sql(padre)}, NULL, ${(contador[paso] = (contador[paso] || 0) + 1) * 10});`);
  }
}

const texto = salida.join('\n') + '\n';
if (process.argv.includes('--sql')) process.stdout.write(texto);
else {
  ejecutarSql(texto, { remoto: process.argv.includes('--remoto') });
  console.log(`Semilla lista: ${vistos.size} productos de la hoja (${omitidos} filas inválidas omitidas) + ${PREPARED_GIFTS.length} regalos por encargo.`);
}
