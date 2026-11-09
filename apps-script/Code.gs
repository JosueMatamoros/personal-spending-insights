/**
 * Mis Gastos — Apps Script
 * Lee los correos de BAC, BCR y Banco Popular, guarda cada gasto en la hoja
 * "Gastos" y expone una API JSON para la app web.
 *
 * Instalación: ver README.md (función `configurar` se ejecuta una sola vez).
 */

// ───────────────────────── Configuración ─────────────────────────

var FECHA_INICIO = '2026-11-01';      // Primer día que se carga
var TIPO_CAMBIO_USD = 505;            // Si llega una compra en dólares, se convierte a ₡ con este valor

// Gasto que el script no pudo clasificar: queda esperando a que ella lo clasifique.
var POR_CLASIFICAR = '';

var HOJA_GASTOS = 'Gastos';
var HOJA_REGLAS = 'Reglas';
var COLUMNAS = ['id', 'fecha', 'banco', 'tipo', 'comercio', 'monto', 'moneda', 'montoOriginal', 'categoria', 'manual', 'messageId', 'eliminado'];

// Categorías iniciales. Desde la app se pueden editar, agregar y borrar (se guardan en CATEGORIAS_JSON).
var CATEGORIAS_INICIALES = [
  { nombre: 'Supermercado', icono: 'ShoppingCart', color: '#8FB573' },
  { nombre: 'Comida y restaurantes', icono: 'UtensilsCrossed', color: '#E0A458' },
  { nombre: 'Transporte', icono: 'Car', color: '#6FA8C9' },
  { nombre: 'Servicios', icono: 'Lightbulb', color: '#CDBB5E' },
  { nombre: 'Vivienda', icono: 'House', color: '#B98668' },
  { nombre: 'Salud', icono: 'Pill', color: '#DE7F72' },
  { nombre: 'Entretenimiento', icono: 'Clapperboard', color: '#5FB8A5' },
  { nombre: 'Suscripciones', icono: 'Tv', color: '#8E9DDB' },
  { nombre: 'Otros', icono: 'Shapes', color: '#9AA396' }
];

// Si cambia este número, la próxima sincronización vuelve a revisar todo desde FECHA_INICIO
// (sin duplicar: cada gasto tiene su número de referencia).
var VERSION_LECTURA = '2';

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

// Palabras clave por categoría. El orden importa: se revisa de arriba a abajo.
// Se comparan como palabras completas, en mayúscula y sin tildes.
var PALABRAS_CLAVE = [
  ['Suscripciones', ['NETFLIX', 'SPOTIFY', 'DISNEY', 'DISNEYPLUS', 'HBO', 'HBO MAX', 'PRIME VIDEO', 'AMAZON PRIME', 'APPLE COM', 'APPLE COM BILL', 'ICLOUD',
    'YOUTUBE', 'GOOGLE ONE', 'GOOGLE STORAGE', 'CHATGPT', 'OPENAI', 'ANTHROPIC', 'CLAUDE', 'CANVA', 'PARAMOUNT', 'CRUNCHYROLL', 'DUOLINGO',
    'MICROSOFT', 'ADOBE', 'SUSCRIPCION', 'MEMBRESIA', 'STAR PLUS', 'DEEZER', 'TIDAL']],
  ['Comida y restaurantes', ['TACO BELL', 'MCDONALDS', 'MC DONALDS', 'BURGER KING', 'KFC', 'PIZZA', 'PIZZERIA', 'SUBWAY', 'STARBUCKS', 'SPOON', 'POPS',
    'CAFE', 'CAFETERIA', 'COFFEE', 'RESTAURANTE', 'RESTAURANT', 'REST', 'SODA', 'UBER EATS', 'UBEREATS', 'RAPPI', 'DIDI FOOD', 'PEDIDOSYA',
    'PEDIDOS YA', 'WENDYS', 'CHURCHS', 'BAR', 'SUSHI', 'POLLO', 'POLLOS', 'BRASA', 'PANADERIA', 'REPOSTERIA', 'HELADOS', 'HELADERIA', 'BOSTON',
    'DOMINOS', 'PAPA JOHNS', 'CHINESE', 'CHINO', 'TACOS', 'BURGER', 'BURGERS', 'GRILL', 'COMIDA', 'ALMUERZO', 'DESAYUNO', 'CENA', 'TAQUERIA',
    'MARISQUERIA', 'CEVICHERA', 'CEVICHE', 'DINER', 'PIZZAHUT', 'PIZZA HUT', 'CAFE BRITT', 'BAGELMENS', 'ROOFTOP']],
  ['Supermercado', ['AUTOMERCADO', 'AUTO MERCADO', 'WALMART', 'WAL MART', 'MAS X MENOS', 'MASXMENOS', 'PALI', 'MAXI PALI', 'MAXIPALI', 'PRICESMART',
    'PRICE SMART', 'PERIMERCADOS', 'PERI', 'MEGASUPER', 'MEGA SUPER', 'FRESH MARKET', 'SUPER', 'MINI SUPER', 'MINISUPER', 'SUPERMERCADO',
    'AMPM', 'AM PM', 'VINDI', 'CARNICERIA', 'VERDULERIA', 'FERIA', 'PULPERIA', 'ABASTECEDOR', 'MERCADO', 'LICORERA', 'COMPRAS SUPER', 'CONVENIENCE']],
  ['Transporte', ['UBER', 'DIDI', 'INDRIVER', 'TAXI', 'GASOLINERA', 'SERVICENTRO', 'ESTACION DE SERVICIO', 'DELTA', 'PUMA', 'TEXACO', 'SHELL',
    'GASOLINA', 'COMBUSTIBLE', 'PARQUEO', 'PARKING', 'PEAJE', 'QUICK PASS', 'QUICKPASS', 'COMPASS', 'GLOBALVIA', 'GLOBAL VIA', 'AUTOBUS', 'BUS', 'BUSES',
    'RITEVE', 'MARCHAMO', 'TREN', 'INCOFER', 'LAVACAR', 'TALLER', 'LLANTAS', 'REPUESTOS']],
  ['Servicios', ['ICE', 'KOLBI', 'LIBERTY', 'CLARO', 'CNFL', 'AYA', 'ESPH', 'JASEC', 'COOPELESCA', 'COOPEGUANACASTE', 'CABLETICA', 'TIGO',
    'TELECABLE', 'AGUA', 'LUZ', 'ELECTRICIDAD', 'INTERNET', 'TELEFONO', 'CELULAR', 'RECARGA', 'MUNICIPALIDAD', 'CABLE']],
  ['Vivienda', ['ALQUILER', 'RENTA', 'CONDOMINIO', 'EPA', 'CONSTRUPLAZA', 'EL LAGAR', 'LAGAR', 'FERRETERIA', 'MUEBLES', 'MUEBLERIA', 'COLCHONES',
    'HOGAR', 'CASA', 'LIMPIEZA', 'CUOTA']],
  ['Salud', ['FARMACIA', 'FARMACIAS', 'FISCHEL', 'SUCRE', 'LA BOMBA', 'FARMAVALUE', 'CLINICA', 'HOSPITAL', 'LABORATORIO', 'LABORATORIOS',
    'MEDICO', 'MEDICA', 'DENTAL', 'DENTISTA', 'ODONTOLOGIA', 'OPTICA', 'CCSS', 'CITA', 'DOCTOR', 'DOCTORA', 'PSICOLOGO', 'PSICOLOGA',
    'MEDICAMENTOS', 'SALUD', 'CIMA', 'HOSPITAL CLINICA BIBLICA', 'METROPOLITANO']],
  ['Entretenimiento', ['CINEPOLIS', 'CINEMARK', 'CCM', 'NOVA CINEMAS', 'CINE', 'TEATRO', 'TICKET', 'TICKETS', 'ETICKET', 'BOLETERIA', 'CONCIERTO',
    'STEAM', 'PLAYSTATION', 'XBOX', 'NINTENDO', 'BOLICHE', 'KARAOKE', 'MUSEO', 'PARQUE', 'DISCOTECA', 'EVENTO', 'ENTRADAS', 'ZOOLOGICO']]
];

// ───────────────────────── Instalación ─────────────────────────

/** Ejecutar UNA vez desde el editor: crea las hojas, la clave de acceso (para crear la cuenta) y el disparador automático. */
function configurar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Este script debe crearse desde la hoja de cálculo: Extensiones → Apps Script.');
  var props = PropertiesService.getScriptProperties();
  props.setProperty('SHEET_ID', ss.getId());

  var hoja = ss.getSheetByName(HOJA_GASTOS) || ss.insertSheet(HOJA_GASTOS);
  if (hoja.getLastRow() === 0) {
    hoja.appendRow(COLUMNAS);
    hoja.setFrozenRows(1);
    hoja.getRange('B:B').setNumberFormat('yyyy-mm-dd hh:mm');
    hoja.getRange('F:F').setNumberFormat('#,##0.00');
  }
  var reglas = ss.getSheetByName(HOJA_REGLAS) || ss.insertSheet(HOJA_REGLAS);
  if (reglas.getLastRow() === 0) {
    reglas.appendRow(['comercio', 'categoria']);
    reglas.setFrozenRows(1);
  }
  var hoja1 = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (hoja1 && ss.getSheets().length > 2 && hoja1.getLastRow() === 0) ss.deleteSheet(hoja1);

  if (!props.getProperty('APP_TOKEN')) {
    props.setProperty('APP_TOKEN', generarClave_());
  }

  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sincronizar') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sincronizar').timeBased().everyMinutes(15).create();

  var resultado = sincronizar();
  Logger.log('✅ Listo. Gastos nuevos cargados: ' + resultado.nuevos);
  Logger.log('🔑 Clave de acceso para la app: ' + props.getProperty('APP_TOKEN'));
}

/** Muestra la clave de acceso en el registro, por si se olvida. */
function verClave() {
  Logger.log('🔑 Clave de acceso: ' + PropertiesService.getScriptProperties().getProperty('APP_TOKEN'));
}

function generarClave_() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var s = '';
  for (var i = 0; i < 8; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

// ───────────────────────── Sincronización con Gmail ─────────────────────────

/** Busca correos nuevos de los bancos y agrega los gastos a la hoja. */
function sincronizar() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { nuevos: 0, ocupado: true };
  try {
    var hoja = hojaGastos_();
    var props = PropertiesService.getScriptProperties();
    var inicio = parseISO_(FECHA_INICIO);
    migrarPorClasificar_(hoja, props);

    // Revisa desde 3 días antes de la última sincronización (por si algún correo llegó tarde).
    var ultima = props.getProperty('ULTIMA_SYNC');
    var desde = inicio;
    var reescaneo = props.getProperty('VERSION_LECTURA') !== VERSION_LECTURA;
    if (ultima && !reescaneo) {
      var d = new Date(Number(ultima) - 3 * 24 * 3600 * 1000);
      if (d > desde) desde = d;
    }

    var existentes = idsExistentes_(hoja);
    var reglas = leerReglas_();
    var remitentes = Object.keys(DOMINIOS_BANCOS).map(function (r) { return 'from:' + r; }).join(' OR ');
    var query = '(' + remitentes + ') after:' + Utilities.formatDate(new Date(desde.getTime() - 24 * 3600 * 1000), 'America/Costa_Rica', 'yyyy/MM/dd');

    var filas = [];
    for (var start = 0; ; start += 100) {
      var hilos = GmailApp.search(query, start, 100);
      if (!hilos.length) break;
      hilos.forEach(function (hilo) {
        hilo.getMessages().forEach(function (msg) {
          if (msg.getDate() < desde) return;
          var gastos;
          try {
            gastos = leerCorreo_(msg);
          } catch (e) {
            Logger.log('No se pudo leer el correo ' + msg.getId() + ': ' + e);
            return;
          }
          gastos.forEach(function (g) {
            if (g.fecha < inicio || existentes[g.id]) return;
            existentes[g.id] = true;
            g.categoria = categorizar_(g.textoCategoria, reglas);
            filas.push([g.id, g.fecha, g.banco, g.tipo, g.comercio, g.monto, g.moneda, g.montoOriginal, g.categoria, false, msg.getId(), false]);
          });
        });
      });
      if (hilos.length < 100) break;
    }

    if (filas.length) {
      hoja.getRange(hoja.getLastRow() + 1, 1, filas.length, COLUMNAS.length).setValues(filas);
    }
    props.setProperty('ULTIMA_SYNC', String(Date.now()));
    props.setProperty('VERSION_LECTURA', VERSION_LECTURA);
    return { nuevos: filas.length };
  } finally {
    lock.releaseLock();
  }
}

/** Una sola vez: lo que cayó solo en "Otros" o en "Compras" pasa a "Por clasificar". */
function migrarPorClasificar_(hoja, props) {
  if (props.getProperty('MIG_POR_CLASIFICAR')) return;
  if (hoja.getLastRow() >= 2) {
    var col = indices_();
    var rango = hoja.getRange(2, 1, hoja.getLastRow() - 1, COLUMNAS.length);
    var datos = rango.getValues();
    var cambios = 0;
    datos.forEach(function (r) {
      var auto = r[col.manual] !== true;
      if ((r[col.categoria] === 'Otros' && auto) || r[col.categoria] === 'Compras') {
        r[col.categoria] = POR_CLASIFICAR;
        r[col.manual] = false;
        cambios++;
      }
    });
    if (cambios) rango.setValues(datos);
  }
  props.setProperty('MIG_POR_CLASIFICAR', '1');
}

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

// ───────────────────────── Categorías ─────────────────────────

function categorizar_(texto, reglas) {
  var n = normalizar_(texto);
  if (!n) return POR_CLASIFICAR;
  var relleno = ' ' + n + ' ';
  // 1) Reglas aprendidas (cuando ella cambia una categoría en la app)
  for (var i = 0; i < reglas.length; i++) {
    if (relleno.indexOf(' ' + reglas[i][0] + ' ') >= 0) {
      var r = resolverCategoria_(reglas[i][1]);
      if (r) return r;
    }
  }
  // 2) Palabras clave por defecto
  for (var c = 0; c < PALABRAS_CLAVE.length; c++) {
    var palabras = PALABRAS_CLAVE[c][1];
    for (var k = 0; k < palabras.length; k++) {
      if (relleno.indexOf(' ' + palabras[k] + ' ') >= 0) {
        var res = resolverCategoria_(PALABRAS_CLAVE[c][0]);
        if (res) return res;
        break;
      }
    }
  }
  return POR_CLASIFICAR;
}

function leerReglas_() {
  var hoja = libro_().getSheetByName(HOJA_REGLAS);
  if (!hoja || hoja.getLastRow() < 2) return [];
  return hoja.getRange(2, 1, hoja.getLastRow() - 1, 2).getValues()
    .filter(function (r) { return r[0] && r[1]; })
    .map(function (r) { return [normalizar_(r[0]), String(r[1])]; })
    // Las reglas más largas (más específicas) primero
    .sort(function (a, b) { return b[0].length - a[0].length; });
}

/** Cambia la categoría de un gasto y aprende la regla para ese comercio. */
function cambiarCategoria_(id, categoria) {
  if (nombresCategorias_().indexOf(categoria) < 0) throw new Error('Categoría inválida');
  var hoja = hojaGastos_();
  var datos = hoja.getDataRange().getValues();
  var col = indices_();
  var comercio = null, tipo = null;
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][col.id]) === id) {
      hoja.getRange(i + 1, col.categoria + 1).setValue(categoria);
      hoja.getRange(i + 1, col.manual + 1).setValue(true);
      comercio = datos[i][col.comercio];
      tipo = datos[i][col.tipo];
      break;
    }
  }
  if (comercio === null) throw new Error('Gasto no encontrado');

  // Texto con el que se aprende la regla (para SINPE: la descripción)
  var clave = tipo === 'SINPE' ? String(comercio).replace(/^SINPE\s*·\s*/, '') : comercio;
  if (tipo === 'SINPE' && /sin descripci/i.test(comercio)) return { actualizados: 1 };
  var claveN = normalizar_(clave);
  if (!claveN) return { actualizados: 1 };

  var reglas = libro_().getSheetByName(HOJA_REGLAS);
  var filasReglas = reglas.getLastRow() > 1 ? reglas.getRange(2, 1, reglas.getLastRow() - 1, 2).getValues() : [];
  var encontrada = false;
  for (var r = 0; r < filasReglas.length; r++) {
    if (normalizar_(filasReglas[r][0]) === claveN) {
      reglas.getRange(r + 2, 2).setValue(categoria);
      encontrada = true;
      break;
    }
  }
  if (!encontrada) reglas.appendRow([clave, categoria]);

  // Aplica la regla a los demás gastos del mismo comercio que no se editaron a mano
  var actualizados = 1;
  for (var j = 1; j < datos.length; j++) {
    if (String(datos[j][col.id]) === id || datos[j][col.manual] === true) continue;
    var otra = datos[j][col.tipo] === 'SINPE' ? String(datos[j][col.comercio]).replace(/^SINPE\s*·\s*/, '') : datos[j][col.comercio];
    if (normalizar_(otra) === claveN && datos[j][col.categoria] !== categoria) {
      hoja.getRange(j + 1, col.categoria + 1).setValue(categoria);
      actualizados++;
    }
  }
  return { actualizados: actualizados };
}

// ───────────────────────── API para la app ─────────────────────────

var DURACION_SESION_MS = 30 * 24 * 3600 * 1000;   // 1 mes
var MAX_INTENTOS = 5;                              // intentos fallidos antes de bloquear
var BLOQUEO_MS = 15 * 60 * 1000;                   // 15 minutos

/** GET: solo para comprobar que el servicio está vivo (no devuelve datos). */
function doGet() {
  return responder_(function () {
    return { ok: true, servicio: 'Mis Gastos', registrado: estaRegistrado_() };
  });
}

/** POST: todas las acciones. El cuerpo es JSON con { action, ... }. */
function doPost(e) {
  return responder_(function () {
    var b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    switch (b.action) {
      case 'estado':
        return { ok: true, registrado: estaRegistrado_() };
      case 'registrar':
        return registrar_(b.clave, b.cedula, b.password);
      case 'login':
        return login_(b.cedula, b.password);
    }

    // Lo demás requiere sesión activa
    validarSesion_(b.sesion);
    switch (b.action) {
      case 'gastos':
        return datos_({});
      case 'sync':
        var r = sincronizar();
        return datos_({ nuevos: r.nuevos });
      case 'setCategory':
        var res = cambiarCategoria_(String(b.id), String(b.categoria));
        return datos_({ actualizados: res.actualizados });
      case 'deleteExpense':
        marcarEliminado_(String(b.id), true);
        return datos_({});
      case 'restoreExpense':
        marcarEliminado_(String(b.id), false);
        return datos_({});
      case 'saveCategory':
        guardarCategoria_(b.anterior ? String(b.anterior) : '', b.categoria || {});
        return datos_({});
      case 'deleteCategory':
        var mov = borrarCategoria_(String(b.nombre));
        return datos_({ movidos: mov });
      case 'logout':
        PropertiesService.getScriptProperties().deleteProperty('S_' + b.sesion);
        return { ok: true };
    }
    throw new Error('Acción desconocida');
  });
}

// ───────────────────────── Acceso (cédula + contraseña) ─────────────────────────

function estaRegistrado_() {
  return Boolean(PropertiesService.getScriptProperties().getProperty('AUTH_PASS'));
}

/** Crea (o cambia) la cédula y contraseña. Exige la clave de acceso del script. */
function registrar_(clave, cedula, password) {
  revisarBloqueo_();
  try {
    validarClave_(clave);
  } catch (e) {
    registrarFallo_();
    throw new Error('La clave de acceso no es correcta');
  }
  cedula = limpiarCedula_(cedula);
  if (cedula.length < 9) throw new Error('La cédula debe tener al menos 9 dígitos');
  password = String(password || '');
  if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres');
  var props = PropertiesService.getScriptProperties();
  var sal = Utilities.getUuid();
  props.setProperties({
    AUTH_SAL: sal,
    AUTH_CEDULA: hash_(cedula, sal),
    AUTH_PASS: hash_(password, sal)
  });
  borrarSesiones_();
  return crearSesion_();
}

function login_(cedula, password) {
  var props = PropertiesService.getScriptProperties();
  if (!estaRegistrado_()) throw new Error('Todavía no se ha creado el acceso');

  revisarBloqueo_();
  var sal = props.getProperty('AUTH_SAL');
  var ok = hash_(limpiarCedula_(cedula), sal) === props.getProperty('AUTH_CEDULA') &&
           hash_(String(password || ''), sal) === props.getProperty('AUTH_PASS');
  if (!ok) {
    registrarFallo_();
    throw new Error('Cédula o contraseña incorrecta');
  }
  props.deleteProperty('AUTH_INTENTOS');
  props.deleteProperty('AUTH_BLOQUEO');
  return crearSesion_();
}

function revisarBloqueo_() {
  var bloqueo = Number(PropertiesService.getScriptProperties().getProperty('AUTH_BLOQUEO') || 0);
  if (bloqueo > Date.now()) {
    var min = Math.ceil((bloqueo - Date.now()) / 60000);
    throw new Error('Demasiados intentos. Intenta de nuevo en ' + min + ' min.');
  }
}

function registrarFallo_() {
  var props = PropertiesService.getScriptProperties();
  var intentos = Number(props.getProperty('AUTH_INTENTOS') || 0) + 1;
  if (intentos >= MAX_INTENTOS) {
    props.setProperty('AUTH_BLOQUEO', String(Date.now() + BLOQUEO_MS));
    intentos = 0;
  }
  props.setProperty('AUTH_INTENTOS', String(intentos));
}

function crearSesion_() {
  var props = PropertiesService.getScriptProperties();
  limpiarSesionesVencidas_();
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  var expira = Date.now() + DURACION_SESION_MS;
  props.setProperty('S_' + token, String(expira));
  return datos_({ sesion: token, expira: expira });
}

function validarSesion_(token) {
  if (!token || !/^[a-f0-9]{64}$/.test(String(token))) throw new Error('Sesión vencida');
  var expira = Number(PropertiesService.getScriptProperties().getProperty('S_' + token) || 0);
  if (expira < Date.now()) throw new Error('Sesión vencida');
}

function limpiarSesionesVencidas_() {
  var props = PropertiesService.getScriptProperties();
  var todas = props.getProperties();
  Object.keys(todas).forEach(function (k) {
    if (k.indexOf('S_') === 0 && Number(todas[k]) < Date.now()) props.deleteProperty(k);
  });
}

/** Cierra todas las sesiones abiertas (por ejemplo, si se pierde el celular). */
function borrarSesiones_() {
  var props = PropertiesService.getScriptProperties();
  Object.keys(props.getProperties()).forEach(function (k) {
    if (k.indexOf('S_') === 0) props.deleteProperty(k);
  });
}

/** Ejecutar desde el editor para cerrar sesión en todos los dispositivos. */
function cerrarTodasLasSesiones() {
  borrarSesiones_();
  Logger.log('✅ Se cerraron todas las sesiones.');
}

function limpiarCedula_(c) {
  return String(c || '').replace(/\D/g, '');
}

/** SHA-256 repetido con sal: la contraseña nunca se guarda tal cual. */
function hash_(texto, sal) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sal + '|' + texto, Utilities.Charset.UTF_8);
  for (var i = 0; i < 1500; i++) {
    bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes.concat(Utilities.newBlob(sal).getBytes()));
  }
  return Utilities.base64Encode(bytes);
}

function responder_(fn) {
  var salida;
  try {
    salida = fn();
  } catch (err) {
    salida = { ok: false, error: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(salida)).setMimeType(ContentService.MimeType.JSON);
}

function validarClave_(token) {
  var clave = PropertiesService.getScriptProperties().getProperty('APP_TOKEN');
  if (!clave || String(token || '').trim().toUpperCase() !== clave) throw new Error('Clave incorrecta');
}

function listarGastos_() {
  var hoja = hojaGastos_();
  if (hoja.getLastRow() < 2) return [];
  var col = indices_();
  var tz = 'America/Costa_Rica';
  var nombres = nombresCategorias_();
  return hoja.getRange(2, 1, hoja.getLastRow() - 1, COLUMNAS.length).getValues()
    .filter(function (r) { return r[col.id] && r[col.eliminado] !== true; })
    .map(function (r) {
      var f = r[col.fecha] instanceof Date ? r[col.fecha] : new Date(r[col.fecha]);
      return {
        id: String(r[col.id]),
        fecha: Utilities.formatDate(f, tz, "yyyy-MM-dd'T'HH:mm:ss"),
        banco: r[col.banco],
        tipo: r[col.tipo],
        comercio: r[col.comercio],
        monto: Number(r[col.monto]) || 0,
        moneda: r[col.moneda],
        montoOriginal: Number(r[col.montoOriginal]) || 0,
        categoria: nombres.indexOf(r[col.categoria]) >= 0 ? r[col.categoria] : POR_CLASIFICAR
      };
    });
}

/** Respuesta estándar: gastos + categorías + lo que se agregue. */
function datos_(extra) {
  extra.ok = true;
  extra.gastos = listarGastos_();
  extra.categorias = categorias_();
  return extra;
}

/** Elimina (o recupera) un gasto. Queda marcado para que el correo no lo vuelva a agregar. */
function marcarEliminado_(id, eliminado) {
  var hoja = hojaGastos_();
  var col = indices_();
  var ids = hoja.getRange(2, 1, Math.max(hoja.getLastRow() - 1, 1), 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === id) {
      hoja.getRange(i + 2, col.eliminado + 1).setValue(eliminado);
      return;
    }
  }
  throw new Error('Gasto no encontrado');
}

// ───────────────────────── Categorías editables ─────────────────────────

var ICONO_RE_ = /^[A-Za-z0-9]{2,40}$/;
var COLOR_RE_ = /^#[0-9A-Fa-f]{6}$/;

function categorias_() {
  var json = PropertiesService.getScriptProperties().getProperty('CATEGORIAS_JSON');
  try { if (json) return JSON.parse(json); } catch (e) { /* usa las iniciales */ }
  return CATEGORIAS_INICIALES;
}

function nombresCategorias_() {
  return categorias_().map(function (c) { return c.nombre; });
}

/** Las palabras clave usan los nombres iniciales; si se renombró o borró, sigue el cambio. */
function resolverCategoria_(nombre) {
  var alias = JSON.parse(PropertiesService.getScriptProperties().getProperty('ALIAS_CATEGORIAS') || '{}');
  for (var i = 0; i < 10 && Object.prototype.hasOwnProperty.call(alias, nombre); i++) nombre = alias[nombre];
  return nombresCategorias_().indexOf(nombre) >= 0 ? nombre : POR_CLASIFICAR;
}

function guardarAlias_(de, a) {
  var props = PropertiesService.getScriptProperties();
  var alias = JSON.parse(props.getProperty('ALIAS_CATEGORIAS') || '{}');
  Object.keys(alias).forEach(function (k) { if (alias[k] === de) alias[k] = a; });
  alias[de] = a;
  delete alias[a];
  props.setProperty('ALIAS_CATEGORIAS', JSON.stringify(alias));
}

/** Agrega una categoría nueva, o edita una existente (anterior = su nombre actual). */
function guardarCategoria_(anterior, c) {
  var nombre = String(c.nombre || '').replace(/\s+/g, ' ').trim();
  if (!nombre) throw new Error('Escribe un nombre');
  if (nombre.length > 30) throw new Error('El nombre es muy largo (máximo 30 letras)');
  if (/^por clasificar$/i.test(nombre)) throw new Error('Ese nombre está reservado');
  var icono = ICONO_RE_.test(String(c.icono)) ? String(c.icono) : 'Tag';
  var color = COLOR_RE_.test(String(c.color)) ? String(c.color).toUpperCase() : '#9AA396';

  var lista = categorias_().slice();
  var repetida = lista.some(function (x) { return x.nombre.toLowerCase() === nombre.toLowerCase() && x.nombre !== anterior; });
  if (repetida) throw new Error('Ya existe una categoría con ese nombre');

  if (anterior) {
    var i = lista.map(function (x) { return x.nombre; }).indexOf(anterior);
    if (i < 0) throw new Error('Categoría no encontrada');
    lista[i] = { nombre: nombre, icono: icono, color: color };
    if (anterior !== nombre) {
      reemplazarCategoriaEnHojas_(anterior, nombre);
      guardarAlias_(anterior, nombre);
    }
  } else {
    if (lista.length >= 30) throw new Error('Máximo 30 categorías');
    lista.push({ nombre: nombre, icono: icono, color: color });
  }
  PropertiesService.getScriptProperties().setProperty('CATEGORIAS_JSON', JSON.stringify(lista));
}

/** Borra una categoría. Sus gastos vuelven a "Por clasificar". */
function borrarCategoria_(nombre) {
  var lista = categorias_().filter(function (x) { return x.nombre !== nombre; });
  if (lista.length === categorias_().length) throw new Error('Categoría no encontrada');
  if (!lista.length) throw new Error('Debe quedar al menos una categoría');
  PropertiesService.getScriptProperties().setProperty('CATEGORIAS_JSON', JSON.stringify(lista));
  guardarAlias_(nombre, POR_CLASIFICAR);
  return reemplazarCategoriaEnHojas_(nombre, POR_CLASIFICAR);
}

function reemplazarCategoriaEnHojas_(de, a) {
  var col = indices_();
  var hoja = hojaGastos_();
  var movidos = 0;
  if (hoja.getLastRow() >= 2) {
    var rango = hoja.getRange(2, 1, hoja.getLastRow() - 1, COLUMNAS.length);
    var datos = rango.getValues();
    datos.forEach(function (r) {
      if (r[col.categoria] === de) {
        r[col.categoria] = a;
        if (a === POR_CLASIFICAR) r[col.manual] = false;
        movidos++;
      }
    });
    if (movidos) rango.setValues(datos);
  }
  var reglas = libro_().getSheetByName(HOJA_REGLAS);
  if (reglas && reglas.getLastRow() >= 2) {
    for (var f = reglas.getLastRow(); f >= 2; f--) {
      if (reglas.getRange(f, 2).getValue() !== de) continue;
      if (a === POR_CLASIFICAR) reglas.deleteRow(f);
      else reglas.getRange(f, 2).setValue(a);
    }
  }
  return movidos;
}

// ───────────────────────── Acceso a la hoja ─────────────────────────

function libro_() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function hojaGastos_() {
  var h = libro_().getSheetByName(HOJA_GASTOS);
  if (!h) throw new Error('Falta ejecutar configurar()');
  if (h.getRange(1, COLUMNAS.length).getValue() !== COLUMNAS[COLUMNAS.length - 1]) {
    h.getRange(1, COLUMNAS.length).setValue(COLUMNAS[COLUMNAS.length - 1]);
  }
  return h;
}

function idsExistentes_(hoja) {
  var set = {};
  if (hoja.getLastRow() < 2) return set;
  hoja.getRange(2, 1, hoja.getLastRow() - 1, 1).getValues().forEach(function (r) { set[String(r[0])] = true; });
  return set;
}

function indices_() {
  var o = {};
  COLUMNAS.forEach(function (c, i) { o[c] = i; });
  return o;
}

// ───────────────────────── Pruebas ─────────────────────────

/**
 * Revisión completa: busca TODOS los correos de los 3 bancos desde FECHA_INICIO
 * (cualquier remitente de esos bancos) y muestra cuáles se registraron y cuáles no.
 */
function revisarCorreos() {
  var inicio = parseISO_(FECHA_INICIO);
  var hoja = hojaGastos_();
  var existentes = idsExistentes_(hoja);
  var dominios = Object.keys(DOMINIOS_BANCOS);
  var query = '(' + dominios.map(function (d) { return 'from:' + d; }).join(' OR ') + ') after:' +
    Utilities.formatDate(new Date(inicio.getTime() - 24 * 3600 * 1000), 'America/Costa_Rica', 'yyyy/MM/dd');

  var resumen = {};
  var noLeidos = [];
  var total = 0, registrados = 0;
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
          gastos.forEach(function (g) { if (existentes[g.id]) registrados++; });
        } else {
          noLeidos.push(Utilities.formatDate(m.getDate(), 'America/Costa_Rica', 'dd/MM HH:mm') + ' · ' + clave + ' · ' + m.getPlainBody().replace(/\s+/g, ' ').slice(0, 140));
        }
      });
    });
    if (hilos.length < 100) break;
  }

  Logger.log('📬 Correos de bancos desde ' + FECHA_INICIO + ': ' + total + ' · gastos ya registrados: ' + registrados);
  Object.keys(resumen).sort().forEach(function (k) {
    Logger.log((resumen[k].gastos ? '✅ ' : '⚠️ ') + k + ' → ' + resumen[k].correos + ' correos, ' + resumen[k].gastos + ' gastos leídos');
  });
  if (noLeidos.length) {
    Logger.log('— Correos que NO se convirtieron en gasto (' + noLeidos.length + '):');
    noLeidos.forEach(function (l) { Logger.log('   ' + l); });
  } else {
    Logger.log('🎉 Todos los correos de los bancos se leyeron.');
  }
}


/** Prueba la lectura con los últimos correos de cada banco, sin guardar nada. */
function probarLectura() {
  var reglas = leerReglas_();
  Object.keys(REMITENTES).forEach(function (r) {
    var hilos = GmailApp.search('from:' + r, 0, 3);
    hilos.forEach(function (h) {
      var msg = h.getMessages().pop();
      leerCorreo_(msg).forEach(function (g) {
        Logger.log([g.banco, g.tipo, g.fecha, g.comercio, '₡' + g.monto, categorizar_(g.textoCategoria, reglas)].join(' | '));
      });
    });
  });
}
