/**
 * Mantiene la hoja de Google al día con el panel (pestañas de datos: Productos, Movimientos, Gastos, Deudas y Lotes), cada minuto.
 * La pestaña «Panel» (cuentas y gráficos) se calcula sola con fórmulas sobre esos datos: este script no la toca.
 * Es la forma más segura de tenerla «en vivo»: la hoja pide los datos al sitio con la clave secreta y los escribe.
 *
 * Instalación (una sola vez, 2 minutos):
 *  1. Abre la hoja de Google → Extensiones → Apps Script.
 *  2. Borra lo que haya y pega este archivo completo. Guarda.
 *  3. Engranaje «Configuración del proyecto» → Propiedades de la secuencia de comandos → Agregar propiedad:
 *       nombre  FINANZAS_TOKEN      valor  la clave secreta (la misma del secreto FINANZAS_TOKEN del Worker)
 *  4. Elige la función «instalar» y pulsa Ejecutar. Google pide permiso la primera vez: acéptalo.
 *  Listo: desde ahí se actualiza sola cada minuto.
 */
const BASE = 'https://alexashop.cc/api/finanzas/csv/';
const PESTANAS = [['productos', 'Productos'], ['movimientos', 'Movimientos'], ['gastos', 'Gastos'], ['creditos', 'Deudas'], ['lotes', 'Lotes']];

function actualizar() {
  const clave = PropertiesService.getScriptProperties().getProperty('FINANZAS_TOKEN');
  if (!clave) throw new Error('Falta la propiedad FINANZAS_TOKEN (ver las instrucciones de arriba).');
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  for (const [hoja, nombre] of PESTANAS) {
    const r = UrlFetchApp.fetch(`${BASE}${hoja}?clave=${encodeURIComponent(clave)}`, { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) continue; // si el sitio no responde, se deja lo anterior
    const filas = Utilities.parseCsv(r.getContentText().replace(/^﻿/, ''));
    const pestana = libro.getSheetByName(nombre) || libro.insertSheet(nombre);
    pestana.clearContents();
    if (!filas.length) continue;
    const ancho = Math.max(...filas.map((f) => f.length));
    pestana.getRange(1, 1, filas.length, ancho).setValues(filas.map((f) => f.concat(Array(ancho - f.length).fill(''))));
    pestana.setFrozenRows(1);
  }
}

/** Ejecutar una vez: crea el reloj de cada minuto y hace la primera carga. */
function instalar() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('actualizar').timeBased().everyMinutes(1).create();
  actualizar();
}
