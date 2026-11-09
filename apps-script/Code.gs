/**
 * Mis Gastos — Apps Script (lector de Gmail)
 *
 * Lee los avisos de BAC, BCR y Banco Popular (compras con tarjeta, SINPE y
 * transferencias enviadas) y se los manda al backend de Mis Gastos, que es
 * quien los guarda (Postgres), los clasifica y avisa al celular.
 *
 * Configuración (una vez): ⚙️ Configuración del proyecto → Propiedades del script:
 *   GASTOS_BACKEND_URL   = https://<backend>.onrender.com/api/gastos
 *   GASTOS_INGEST_TOKEN  = (la misma clave que GASTOS_INGEST_TOKEN en Render)
 * Luego ejecutar `configurar` (crea el disparador cada 15 min y envía todo).
 */

// ───────────────────────── Configuración ─────────────────────────

var FECHA_INICIO = '2026-11-01';      // Primer día que se carga
var TIPO_CAMBIO_USD = 505;            // Si llega una compra en dólares, se convierte a ₡ con este valor

// Si cambia este número, la próxima sincronización vuelve a revisar todo desde FECHA_INICIO
// (sin duplicar: el backend ignora referencias que ya tiene).
var VERSION_LECTURA = '3';

// Dominios de los bancos: se lee cualquier remitente de estos dominios (no solo los de REMITENTES).
var DOMINIOS_BANCOS = {
  'bancobcr.com': 'BCR', 'bcr.fi.cr': 'BCR',
  'baccredomatic.cr': 'BAC', 'baccredomatic.com': 'BAC', 'credomatic.com': 'BAC',
  'bancopopularinforma.fi.cr': 'POPULAR', 'bpdc.fi.cr': 'POPULAR', 'bancopopular.fi.cr': 'POPULAR', 'popular.fi.cr': 'POPULAR'
};

var REMITENTES = {
  'bcrtarjestcta@bancobcr.com': 'BCR',
  'notificacionbac@baccredomatic.cr': 'BAC',
  'notificacion@bancopopularinforma.fi.cr': 'POPULAR',
  'bpsinpe@bpdc.fi.cr': 'POPULAR_SINPE'
};

// ───────────────────────── Instalación ─────────────────────────

/** Ejecutar una vez: revisa la configuración, crea el disparador y envía todo desde FECHA_INICIO. */
function configurar() {
  config_(); // falla con un mensaje claro si falta algo
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sincronizar') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sincronizar').timeBased().everyMinutes(15).create();
  PropertiesService.getScriptProperties().deleteProperty('VERSION_LECTURA');
  var r = sincronizar();
  Logger.log('✅ Listo. Gastos nuevos enviados: ' + r.nuevos + ' (de ' + r.leidos + ' leídos). Se revisa el correo cada 15 minutos.');
}

function config_() {
  var p = PropertiesService.getScriptProperties();
  var url = (p.getProperty('GASTOS_BACKEND_URL') || '').replace(/\/+$/, '');
  var token = p.getProperty('GASTOS_INGEST_TOKEN') || '';
  if (!/^https:\/\//.test(url)) throw new Error('Falta la propiedad GASTOS_BACKEND_URL (https://…/api/gastos)');
  if (token.length < 24) throw new Error('Falta la propiedad GASTOS_INGEST_TOKEN');
  return { url: url, token: token };
}

/** Manda gastos al backend. Devuelve cuántos eran nuevos. */
function enviar_(gastos, extra) {
  var c = config_();
  var cuerpo = { correo: Session.getEffectiveUser().getEmail(), gastos: gastos };
  Object.keys(extra || {}).forEach(function (k) { cuerpo[k] = extra[k]; });
  var r = UrlFetchApp.fetch(c.url + '/ingesta', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-gastos-token': c.token },
    payload: JSON.stringify(cuerpo),
    muteHttpExceptions: true
  });
  var d = {};
  try { d = JSON.parse(r.getContentText()); } catch (e) { /* respuesta no JSON */ }
  if (r.getResponseCode() !== 200 || !d.ok) throw new Error('El backend respondió ' + r.getResponseCode() + ': ' + (d.error || r.getContentText().slice(0, 200)));
  return d.nuevos || 0;
}

// ───────────────────────── Sincronización con Gmail ─────────────────────────

/** Busca correos nuevos de los bancos y los manda al backend. */
function sincronizar() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { nuevos: 0, leidos: 0, ocupado: true };
  try {
    var props = PropertiesService.getScriptProperties();
    var inicio = parseISO_(FECHA_INICIO);
    // Revisa desde 3 días antes de la última vez (por si algún correo llegó tarde)
    var ultima = props.getProperty('ULTIMA_ENVIO');
    var desde = inicio;
    if (ultima && props.getProperty('VERSION_LECTURA') === VERSION_LECTURA) {
      var d = new Date(Number(ultima) - 3 * 24 * 3600 * 1000);
      if (d > desde) desde = d;
    }
    var remitentes = Object.keys(DOMINIOS_BANCOS).map(function (r) { return 'from:' + r; }).join(' OR ');
    var query = '(' + remitentes + ') after:' + Utilities.formatDate(new Date(desde.getTime() - 24 * 3600 * 1000), 'America/Costa_Rica', 'yyyy/MM/dd');

    var gastos = [];
    var vistos = {};
    for (var start = 0; ; start += 100) {
      var hilos = GmailApp.search(query, start, 100);
      hilos.forEach(function (hilo) {
        hilo.getMessages().forEach(function (msg) {
          if (msg.getDate() < desde) return;
          var leidos;
          try { leidos = leerCorreo_(msg); } catch (e) { Logger.log('No se pudo leer el correo ' + msg.getId() + ': ' + e); return; }
          leidos.forEach(function (g) {
            if (g.fecha < inicio || vistos[g.id]) return;
            vistos[g.id] = true;
            gastos.push(aEnvio_(g));
          });
        });
      });
      if (hilos.length < 100) break;
    }

    var nuevos = 0;
    for (var i = 0; i < gastos.length; i += 200) nuevos += enviar_(gastos.slice(i, i + 200));
    props.setProperty('ULTIMA_ENVIO', String(Date.now()));
    props.setProperty('VERSION_LECTURA', VERSION_LECTURA);
    return { nuevos: nuevos, leidos: gastos.length };
  } finally {
    lock.releaseLock();
  }
}

function aEnvio_(g) {
  return {
    ref: g.id,
    fecha: g.fecha.toISOString(),
    banco: g.banco,
    tipo: g.tipo,
    comercio: g.comercio,
    textoCategoria: String(g.textoCategoria || ''),
    monto: Number(g.monto) || 0,
    moneda: g.moneda,
    montoOriginal: Number(g.montoOriginal) || 0
  };
}

// ───────────────────────── Lectura de correos ─────────────────────────

/** Devuelve una lista de gastos encontrados en un correo (normalmente uno). */
function leerCorreo_(msg) {
  var from = (msg.getFrom().match(/<([^>]+)>/) || [null, msg.getFrom()])[1].trim().toLowerCase();
  var banco = REMITENTES[from] || bancoPorDominio_(from);
  if (!banco) return [];
  var texto = htmlATexto_(msg.getBody() || msg.getPlainBody());
  var nombre = { BCR: 'BCR', BAC: 'BAC', POPULAR: 'Popular', POPULAR_SINPE: 'Popular' }[banco];

  var gastos = [];
  if (banco === 'BCR') gastos = leerBCR_(texto, msg);
  else if (banco === 'BAC' || banco === 'POPULAR') gastos = leerEtiquetas_(texto, msg, nombre);
  else if (banco === 'POPULAR_SINPE') gastos = leerSinpe_(texto, msg);
  // Si no fue una compra con tarjeta, revisa si es un SINPE / transferencia enviada
  if (!gastos.length) gastos = leerTransferencia_(texto, msg, nombre);
  return gastos;
}

function bancoPorDominio_(from) {
  var dominio = from.split('@')[1] || '';
  var claves = Object.keys(DOMINIOS_BANCOS);
  for (var i = 0; i < claves.length; i++) {
    if (dominio === claves[i] || dominio.slice(-claves[i].length - 1) === '.' + claves[i]) return DOMINIOS_BANCOS[claves[i]];
  }
  return null;
}

/** BCR: tabla con columnas Fecha | Autorización | No.Referencia | Monto | Moneda | Comercio | Estado */
function leerBCR_(texto, msg) {
  var lineas = texto.split('\n');
  var iEstado = -1;
  for (var i = 0; i < lineas.length; i++) {
    if (/^Comercio$/i.test(lineas[i]) && /^Estado$/i.test(lineas[i + 1] || '')) { iEstado = i + 1; break; }
  }
  var gastos = [];
  if (iEstado < 0) return gastos;
  for (var j = iEstado + 1; j + 6 < lineas.length; j += 7) {
    var fila = lineas.slice(j, j + 7);
    if (!/^\d{2}\/\d{2}\/\d{4}/.test(fila[0])) break;
    if (!/aprobad/i.test(fila[6])) continue;
    var moneda = /dolar|usd/i.test(fila[4]) ? 'USD' : 'CRC';
    var montoOriginal = parseMonto_(fila[3]);
    gastos.push({
      id: 'BCR-' + fila[2],
      fecha: parseFecha_(fila[0]) || msg.getDate(),
      banco: 'BCR',
      tipo: 'Tarjeta',
      comercio: limpiarComercio_(fila[5]),
      moneda: moneda,
      montoOriginal: montoOriginal,
      monto: aColones_(montoOriginal, moneda),
      textoCategoria: fila[5]
    });
  }
  return gastos;
}

/** BAC y Popular tarjeta: pares "Etiqueta: valor". */
function leerEtiquetas_(texto, msg, banco) {
  var tipoTx = valorEtiqueta_(texto, 'Tipo de Transacci[oó]n');
  if (tipoTx && !/compra/i.test(tipoTx)) return [];
  var comercio = valorEtiqueta_(texto, 'Comercio');
  var montoTxt = valorEtiqueta_(texto, 'Monto');
  var ref = valorEtiqueta_(texto, 'Referencia') || valorEtiqueta_(texto, 'Autorizaci[oó]n') || msg.getId();
  if (!comercio || !montoTxt) return [];
  var moneda = /USD|\$/.test(montoTxt) ? 'USD' : 'CRC';
  var montoOriginal = parseMonto_(montoTxt);
  return [{
    id: banco.toUpperCase() + '-' + ref,
    fecha: parseFecha_(valorEtiqueta_(texto, 'Fecha')) || msg.getDate(),
    banco: banco,
    tipo: 'Tarjeta',
    comercio: limpiarComercio_(comercio),
    moneda: moneda,
    montoOriginal: montoOriginal,
    monto: aColones_(montoOriginal, moneda),
    textoCategoria: comercio
  }];
}

/** Banco Popular SINPE: texto corrido. Solo cuenta débitos (dinero que sale). */
function leerSinpe_(texto, msg) {
  var plano = texto.replace(/\n/g, ' ');
  if (!/debitado/i.test(plano)) return [];
  var m = plano.match(/monto de\s*([\d.,]+)\s*colones/i);
  if (!m) return [];
  var desc = (plano.match(/Descripci[oó]n:\s*([\s\S]*?)\s*Cod\.?\s*Referencia/i) || [])[1] || '';
  desc = desc.replace(/[_\s.]+$/g, '').replace(/^[_\s.]+/g, '').replace(/_+/g, ' ').trim();
  var ref = (plano.match(/Referencia:\s*(\d+)/i) || [])[1] || msg.getId();
  var fecha = (plano.match(/hecha el:\s*(\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?)/i) || [])[1];
  var monto = parseMonto_(m[1]);
  return [{
    id: 'SINPE-' + ref,
    fecha: parseFecha_(fecha) || msg.getDate(),
    banco: 'Popular',
    tipo: 'SINPE',
    comercio: desc ? 'SINPE · ' + capitalizar_(desc) : 'SINPE (sin descripción)',
    moneda: 'CRC',
    montoOriginal: monto,
    monto: monto,
    textoCategoria: desc
  }];
}

/**
 * SINPE Móvil, SINPE y transferencias de cualquiera de los 3 bancos.
 * Solo cuenta dinero que SALE; ignora lo recibido / acreditado.
 */
function leerTransferencia_(texto, msg, banco) {
  var plano = texto.replace(/\n/g, ' ');
  var asunto = msg.getSubject() || '';
  var todo = asunto + ' ' + plano;
  if (!/sinpe|transferencia|d[eé]bito en tiempo real|\bDTR\b/i.test(todo)) return [];
  var tipoTx = valorEtiqueta_(texto, 'Tipo de (?:Transacci[oó]n|movimiento|operaci[oó]n)');
  // Lo que entra no es gasto (se revisa el asunto y el inicio del correo, no el pie de página)
  var inicioTxt = asunto + ' ' + plano.slice(0, 600);
  if (/acreditad|ha recibido|has recibido|recibiste|recibida|a su favor|le (?:ha )?(?:enviado|transferido)|te (?:envi|transfiri)|abonad|cr[eé]dito a (?:su|tu) cuenta|devoluci/i.test(inicioTxt)) return [];
  // Pagos a las propias tarjetas o movimientos entre cuentas propias no son gastos nuevos
  if (/cuentas propias|pago (?:de|a) (?:su |tu )?tarjeta|pago tarjeta/i.test(inicioTxt)) return [];
  var sale = /debitad|enviad|realizad|transferiste|ha transferido|ha enviado|usted envi|pago a|salida|d[eé]bito|transferencia (?:sinpe )?(?:m[oó]vil )?a\b/i.test(inicioTxt) ||
             /sinpe|transferencia/i.test(tipoTx);
  if (!sale) return [];

  var montoTxt = valorEtiqueta_(texto, '(?:Monto(?: transferido| enviado| debitado)?|Importe|Total)');
  var m = null;
  if (!/\d/.test(montoTxt)) {
    m = plano.match(/(?:monto(?: de)?|por(?: un monto de)?|importe(?: de)?)\s*:?\s*((?:₡|¢|CRC|USD|\$|colones)?\s*[\d][\d.,]*\s*(?:colones|d[oó]lares|CRC|USD)?)/i) ||
        plano.match(/((?:₡|¢|CRC)\s*[\d][\d.,]*)/);
    montoTxt = m ? m[1] : '';
  }
  var monto = parseMonto_(montoTxt);
  if (!monto) return [];
  var moneda = /USD|\$|d[oó]lar/i.test(montoTxt) ? 'USD' : 'CRC';

  var desc = valorEtiqueta_(texto, '(?:Descripci[oó]n|Detalle|Concepto|Motivo|Comentario)') ||
    ((plano.match(/(?:Descripci[oó]n|Detalle|Concepto|Motivo)\s*:\s*(.*?)(?:\.\s|Cod\.?|Referencia|Comprobante|Fecha|$)/i) || [])[1] || '');
  desc = desc.replace(/[_\s.]+$/g, '').replace(/^[_\s.]+/g, '').replace(/_+/g, ' ').trim();
  var destino = valorEtiqueta_(texto, '(?:Destinatario|Beneficiario|Nombre del (?:destinatario|beneficiario)|Cliente destino|Enviado a|Para)') || '';
  destino = destino.replace(/\s+/g, ' ').trim();
  var ref = (valorEtiqueta_(texto, '(?:Cod\.? ?)?(?:Referencia|Comprobante|N[uú]mero de (?:referencia|comprobante)|Documento)').match(/[\w-]{4,}/) || [])[0] ||
    (plano.match(/(?:Referencia|Comprobante)\s*:?\s*(\d{4,})/i) || [])[1] || msg.getId();
  var fechaTxt = valorEtiqueta_(texto, 'Fecha(?: y hora)?(?: de la transacci[oó]n)?') ||
    (plano.match(/(\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?)/) || [])[1];
  var nombreGasto = desc || destino;
  return [{
    id: 'SINPE-' + ref,
    fecha: parseFecha_(fechaTxt) || msg.getDate(),
    banco: banco,
    tipo: 'SINPE',
    comercio: nombreGasto ? 'SINPE · ' + capitalizar_(nombreGasto) : 'SINPE (sin descripción)',
    moneda: moneda,
    montoOriginal: monto,
    monto: aColones_(monto, moneda),
    textoCategoria: (desc + ' ' + destino).trim()
  }];
}

// ───────────────────────── Utilidades de lectura ─────────────────────────

function htmlATexto_(html) {
  var t = String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(td|th|tr|p|div|li|h\d|table)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(Number(n)); })
    .replace(/&([a-z])(acute|tilde|uml);/gi, function (_, l, k) {
      var mapa = { acute: { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú' }, tilde: { n: 'ñ', N: 'Ñ' }, uml: { u: 'ü', U: 'Ü' } };
      return (mapa[k.toLowerCase()] || {})[l] || l;
    });
  return t.split('\n').map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(Boolean).join('\n');
}

/** Busca "Etiqueta: valor" en la misma línea o el valor en la línea siguiente. */
function valorEtiqueta_(texto, etiqueta) {
  var re = new RegExp('^' + etiqueta + '\\s*:?\\s*(.*)$', 'im');
  var lineas = texto.split('\n');
  for (var i = 0; i < lineas.length; i++) {
    var m = lineas[i].match(re);
    if (m) {
      if (m[1] && m[1].trim()) return m[1].trim();
      if (lineas[i + 1]) return lineas[i + 1].trim();
    }
  }
  return '';
}

function parseMonto_(txt) {
  var limpio = String(txt).replace(/[^\d.,]/g, '').replace(/[.,]+$/, '');
  var coma = limpio.lastIndexOf(','), punto = limpio.lastIndexOf('.');
  if (coma >= 0 && punto >= 0) {
    // El separador que va de último es el de decimales: 7,500.00 o 7.500,00
    limpio = coma > punto ? limpio.replace(/\./g, '').replace(',', '.') : limpio.replace(/,/g, '');
  } else if (coma >= 0) {
    // 7,500 → miles · 7500,50 → decimales
    limpio = /,\d{2}$/.test(limpio) && !/,\d{3}/.test(limpio) ? limpio.replace(',', '.') : limpio.replace(/,/g, '');
  } else if (punto >= 0 && /\.\d{3}(\.|$)/.test(limpio) && !/\.\d{2}$/.test(limpio)) {
    limpio = limpio.replace(/\./g, '');  // 7.500 → miles
  }
  return Number(limpio) || 0;
}

function aColones_(monto, moneda) {
  return moneda === 'USD' ? Math.round(monto * TIPO_CAMBIO_USD * 100) / 100 : monto;
}

var MESES_ = { ene: 0, jan: 0, feb: 1, mar: 2, abr: 3, apr: 3, may: 4, jun: 5, jul: 6, ago: 7, aug: 7, set: 8, sep: 8, oct: 9, nov: 10, dic: 11, dec: 11 };

/** Entiende "03/11/2026 17:29:05", "Oct 29, 2026, 23:03" y "Ago. 30, 2026, 12:22". */
function parseFecha_(txt) {
  if (!txt) return null;
  var m = String(txt).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  m = String(txt).match(/([A-Za-zé]{3})[a-z]*\.?\s+(\d{1,2}),?\s*(\d{4}),?\s*(?:(\d{1,2}):(\d{2}))?/);
  if (m) {
    var mes = MESES_[m[1].toLowerCase()];
    if (mes !== undefined) return new Date(+m[3], mes, +m[2], +(m[4] || 0), +(m[5] || 0));
  }
  return null;
}

function parseISO_(s) {
  var p = s.split('-');
  return new Date(+p[0], +p[1] - 1, +p[2]);
}

function limpiarComercio_(s) {
  return String(s).replace(/\s+CRI?$/i, '').replace(/\s+/g, ' ').trim();
}

function capitalizar_(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function normalizar_(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

// ───────────────────────── Botón "buscar gastos" de la app ─────────────────────────

/** El backend llama aquí para revisar el correo en el momento. */
function doPost(e) {
  var salida;
  try {
    var b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var token = PropertiesService.getScriptProperties().getProperty('GASTOS_INGEST_TOKEN') || '';
    if (!token || b.token !== token) throw new Error('No autorizado');
    if (b.action !== 'sync') throw new Error('Acción desconocida');
    var r = sincronizar();
    salida = { ok: true, nuevos: r.nuevos };
  } catch (err) {
    salida = { ok: false, error: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(salida)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, servicio: 'Mis Gastos (lector de Gmail)' })).setMimeType(ContentService.MimeType.JSON);
}

// ───────────────────────── Pasar lo de la hoja de Google al backend ─────────────────────────

/**
 * Ejecutar UNA vez: manda al backend lo que ya estaba en la hoja "Gastos"
 * (con la categoría que se le había puesto y los eliminados) y las reglas aprendidas.
 */
function migrarHojaAlBackend() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName('Gastos');
  if (!hoja || hoja.getLastRow() < 2) { Logger.log('La hoja Gastos está vacía.'); return; }
  var filas = hoja.getDataRange().getValues();
  var cab = filas.shift();
  var c = {};
  cab.forEach(function (n, i) { c[n] = i; });
  var gastos = filas.filter(function (r) { return r[c.id]; }).map(function (r) {
    var f = r[c.fecha] instanceof Date ? r[c.fecha] : new Date(r[c.fecha]);
    var cat = String(r[c.categoria] || '');
    var g = {
      ref: String(r[c.id]), fecha: f.toISOString(), banco: String(r[c.banco] || ''), tipo: String(r[c.tipo] || ''),
      comercio: String(r[c.comercio] || '(sin nombre)'), monto: Number(r[c.monto]) || 0, moneda: String(r[c.moneda] || 'CRC'),
      montoOriginal: Number(r[c.montoOriginal]) || 0, manual: r[c.manual] === true,
      eliminado: c.eliminado !== undefined && r[c.eliminado] === true
    };
    g.textoCategoria = g.tipo === 'SINPE' ? g.comercio.replace(/^SINPE\s*·\s*/, '') : g.comercio;
    if (cat && cat !== 'Compras') g.categoria = cat;
    return g;
  });
  var reglasHoja = ss.getSheetByName('Reglas');
  var reglas = reglasHoja && reglasHoja.getLastRow() > 1
    ? reglasHoja.getRange(2, 1, reglasHoja.getLastRow() - 1, 2).getValues()
        .filter(function (r) { return r[0] && r[1]; })
        .map(function (r) { return { comercio: String(r[0]), categoria: String(r[1]) }; })
    : [];
  var nuevos = 0;
  for (var i = 0; i < gastos.length; i += 200) {
    nuevos += enviar_(gastos.slice(i, i + 200), i === 0 ? { reglas: reglas, avisar: false } : { avisar: false });
  }
  Logger.log('✅ Pasados al backend: ' + nuevos + ' gastos (de ' + gastos.length + ' en la hoja) y ' + reglas.length + ' reglas.');
}

// ───────────────────────── Revisión ─────────────────────────

/** Muestra qué correos de los bancos se convierten en gasto y cuáles no (no envía nada). */
function revisarCorreos() {
  var inicio = parseISO_(FECHA_INICIO);
  var query = '(' + Object.keys(DOMINIOS_BANCOS).map(function (d) { return 'from:' + d; }).join(' OR ') + ') after:' +
    Utilities.formatDate(new Date(inicio.getTime() - 24 * 3600 * 1000), 'America/Costa_Rica', 'yyyy/MM/dd');
  var resumen = {}, noLeidos = [], total = 0, gastosTot = 0;
  for (var start = 0; ; start += 100) {
    var hilos = GmailApp.search(query, start, 100);
    hilos.forEach(function (h) {
      h.getMessages().forEach(function (m) {
        if (m.getDate() < inicio) return;
        total++;
        var from = (m.getFrom().match(/<([^>]+)>/) || [null, m.getFrom()])[1].trim().toLowerCase();
        var clave = from + ' · ' + m.getSubject();
        resumen[clave] = resumen[clave] || { correos: 0, gastos: 0 };
        resumen[clave].correos++;
        var gastos = [];
        try { gastos = leerCorreo_(m); } catch (e) { /* se reporta abajo */ }
        if (gastos.length) {
          resumen[clave].gastos += gastos.length;
          gastosTot += gastos.length;
          gastos.forEach(function (g) { Logger.log('   ' + g.banco + ' ' + g.tipo + ' · ' + g.comercio + ' · ₡' + g.monto); });
        } else {
          noLeidos.push(Utilities.formatDate(m.getDate(), 'America/Costa_Rica', 'dd/MM HH:mm') + ' · ' + clave + ' · ' + m.getPlainBody().replace(/\s+/g, ' ').slice(0, 160));
        }
      });
    });
    if (hilos.length < 100) break;
  }
  Logger.log('📬 Correos de bancos desde ' + FECHA_INICIO + ': ' + total + ' · gastos encontrados: ' + gastosTot);
  Object.keys(resumen).sort().forEach(function (k) {
    Logger.log((resumen[k].gastos ? '✅ ' : '⚠️ ') + k + ' → ' + resumen[k].correos + ' correos, ' + resumen[k].gastos + ' gastos');
  });
  if (noLeidos.length) {
    Logger.log('— Correos que NO se convirtieron en gasto (' + noLeidos.length + '):');
    noLeidos.forEach(function (l) { Logger.log('   ' + l); });
  }
}

