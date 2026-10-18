/**
 * ============================================================
 * Apps Script del spreadsheet "Casa" - alquileres-app-v2
 * ============================================================
 * API COMPLETA sobre Google Sheets (6 hojas):
 *   inquilinos, servicios, servicios_inquilinos, cobros, pagos, asignaciones
 *
 * Hoja "asignaciones": por periodo, inquilino y servicio se registran los
 * servicios que se cobran (activo) y los extras POR INQUILINO (cantidades
 * dinamicas segun el servicio). Cada extra suma 1 al factor de reparto del
 * inquilino (base = cuartos o personas): p.ej. 1 cuarto + 2 extras => factor 3.
 *
 * Dos formas de uso:
 *
 * 1) API DIRECTA (el frontend desplegado en Vercel usa esta):
 *    La llamada lleva la accion como query param ?action=...
 *    GET  ?action=snapshot                      -> todas las hojas
 *    GET  ?action=sync                          -> { snapshot, info } (una sola llamada)
 *    GET  ?action=config                        -> info de conexion y periodos
 *    GET  ?action=dashboard                     -> resumen del panel
 *    GET  ?action=reporte.mensual&periodo=YYYY-MM
 *    GET  ?action=reporte.general
 *    GET  ?action=cobros[&periodo=YYYY-MM]
 *    POST ?action=inquilinos.crear      body: { inquilino }
 *    POST ?action=inquilinos.actualizar&id=   body: { inquilino }
 *    POST ?action=inquilinos.eliminar&id=
 *    POST ?action=inquilinos.estado&id=&habilitado=true
 *    POST ?action=servicios.crear / servicios.actualizar&id= / servicios.eliminar&id=
 *    POST ?action=servicios_inquilinos.guardar  body: { configuracion }
 *    POST ?action=servicios_inquilinos.eliminar&id=
 *    POST ?action=pagos.crear      body: { pago }
 *    POST ?action=pagos.eliminar&id=
 *    POST ?action=cobros.generar&periodo=YYYY-MM
    POST ?action=asignaciones.guardar      body: { asignacion }
    POST ?action=asignaciones.eliminar&id=
 *
 *    Todas responden con la envoltura { ok:true, data:... } o { ok:false, error:... }.
 *
 * 2) API INTERNA (la usaba el backend Java; se mantiene por compatibilidad):
 *    El "action" va dentro del cuerpo JSON (POST).
 *    POST body {action:'upsert', sheet, row}         -> escribe una fila
 *    POST body {action:'delete', sheet, id}          -> borra una fila
 *    POST body {action:'replaceCobros', periodo, rows} -> regenera cobros del mes
 *    GET  ?action=snapshot                           -> envoltura ok/data
 *
 * SEGURIDAD: todas las llamadas deben incluir la clave de acceso como
 * parametro ?key=... (o "key" dentro del cuerpo JSON en la API interna).
 * La clave se guarda en Propiedades del script (API_KEY). Para crearla:
 *   - En el editor de Apps Script ejecuta la funcion generarClave() y copia
 *     la clave que aparece en el registro (Ver > Registros), o
 *   - Configuracion del proyecto > Propiedades del script > API_KEY.
 * Sin clave configurada el script rechaza TODAS las llamadas.
 *
 * Como desplegar (re-deploy):
 *  1) Abre el spreadsheet "Casa" en Google Sheets.
 *  2) Extensiones > Apps Script. Pega este archivo (reemplaza Code.gs).
 *  3) Implementar > Administrar implementaciones > Editar (la web app existente)
 *     > Version: Nueva > Implementar.
 * ============================================================
 */

var NOMBRE_CASA = 'CASA_VILLA_ROSA';

var HOJAS = {
  inquilinos: [
    'id', 'nombre', 'celular', 'fechaIngreso', 'fechaSalida',
    'habilitado', 'habitaciones', 'personas', 'cobraAlquiler', 'alquilerBs'
  ],
  servicios: [
    'id', 'nombre', 'unidadMedida', 'metodoPago', 'extras'
  ],
  servicios_inquilinos: [
    'id', 'inquilinoId', 'servicioId', 'activo', 'extras'
  ],
  cobros: [
    'id', 'periodo', 'inquilinoId', 'servicioId',
    'peso', 'pesoTotal', 'montoBase', 'montoExtra', 'montoTotal',
    'habitaciones', 'personas', 'extras'
  ],
  pagos: [
    'id', 'inquilinoId', 'servicioId', 'periodo',
    'fechaPago', 'montoBs', 'cantidad', 'unidadMedida', 'observacion'
  ],
  asignaciones: [
    'id', 'periodo', 'inquilinoId', 'servicioId', 'activo', 'extras'
  ]
};

/** Columnas que se guardan como booleano */
var BOOLEANAS = ['habilitado', 'activo', 'cobraAlquiler'];

/** Id del servicio virtual "Alquiler" (no es un servicio real, se calcula directo). */
var ALQUILER_ID = '__alquiler__';

/** Columnas de tipo entero */
var ENTERAS = ['habitaciones', 'personas'];

/** Columnas que representan una fecha (yyyy-MM-dd) */
var FECHAS = ['fechaIngreso', 'fechaSalida', 'fechaPago'];

/** Zona horaria de la casa: define "hoy" y el mes actual. */
var ZONA = 'America/La_Paz';

// ============================================================
// Seguridad: clave de acceso
// ============================================================

function claveConfigurada() {
  try {
    return PropertiesService.getScriptProperties().getProperty('API_KEY') || '';
  } catch (e) {
    return '';
  }
}

/** Compara en tiempo constante para no filtrar la clave por tiempos de respuesta. */
function igualSeguro(a, b) {
  a = String(a);
  b = String(b);
  var dif = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) {
    dif |= (a.charCodeAt(i % (a.length || 1)) || 0) ^ (b.charCodeAt(i % (b.length || 1)) || 0);
  }
  return dif === 0;
}

function verificarClave(e, cuerpo) {
  var esperada = claveConfigurada();
  if (!esperada) {
    throw new Error('NO_CONFIGURADA: el script no tiene clave de acceso. Ejecuta generarClave() en el editor de Apps Script.');
  }
  var dada = (e && e.parameter && e.parameter.key) || (cuerpo && cuerpo.key) || '';
  if (!dada || !igualSeguro(dada, esperada)) {
    throw new Error('NO_AUTORIZADO: clave de acceso invalida');
  }
}

/**
 * Ejecutar UNA vez desde el editor: crea una clave aleatoria, la guarda en
 * Propiedades del script y la muestra en el registro para copiarla.
 * Volver a ejecutarla cambia la clave (los dispositivos deberan ingresarla de nuevo).
 */
function generarClave() {
  var clave = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').substring(0, 8);
  PropertiesService.getScriptProperties().setProperty('API_KEY', clave);
  Logger.log('Clave de acceso: ' + clave);
  return clave;
}

/** Fecha de hoy (yyyy-MM-dd) en la zona horaria de la casa. */
function hoyISO() {
  return Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd');
}

// ============================================================
// Rendimiento: cache por ejecucion, version de datos y cache de respuestas
// ============================================================

/** Cache de hojas leidas DENTRO de una misma peticion (se activa en doGet/doPost). */
var CACHE_HOJAS = null;
var ZONA_HOJA = null;
var SS_ACTUAL = null;

function iniciarPeticion() {
  CACHE_HOJAS = {};
  ZONA_HOJA = null;
  SS_ACTUAL = null;
}

function terminarPeticion() {
  CACHE_HOJAS = null;
}

function planilla() {
  if (SS_ACTUAL === null) SS_ACTUAL = SpreadsheetApp.getActiveSpreadsheet();
  return SS_ACTUAL;
}

function invalidarHoja(nombre) {
  if (CACHE_HOJAS) delete CACHE_HOJAS[nombre];
}

/** Version de los datos: cambia con cada escritura (app o edicion manual). */
function versionDatos() {
  try {
    return Number(PropertiesService.getScriptProperties().getProperty('DATA_VERSION') || '0');
  } catch (e) {
    return 0;
  }
}

function subirVersion() {
  var v = Date.now();
  try {
    PropertiesService.getScriptProperties().setProperty('DATA_VERSION', String(v));
  } catch (e) { /* sin propiedades: la cache expira sola */ }
  return v;
}

/** Disparador simple: una edicion manual en la planilla invalida la cache. */
function onEdit() {
  subirVersion();
}

var CACHE_TTL = 120;          // segundos (respaldo si onEdit no corre)
var CACHE_TROZO = 90000;      // CacheService admite ~100 KB por clave

/** Texto JSON de { snapshot, info } para la version actual, desde CacheService si existe. */
function syncTexto() {
  var v = versionDatos();
  var clave = 'sync_' + v;
  var cache = null;
  try { cache = CacheService.getScriptCache(); } catch (e) { cache = null; }
  if (cache) {
    var n = Number(cache.get(clave + '_n') || '0');
    if (n > 0) {
      var claves = [];
      for (var i = 0; i < n; i++) claves.push(clave + '_' + i);
      var partes = cache.getAll(claves);
      var texto = '';
      var completo = true;
      for (var j = 0; j < n; j++) {
        var parte = partes[clave + '_' + j];
        if (parte === undefined || parte === null) { completo = false; break; }
        texto += parte;
      }
      if (completo) return texto;
    }
  }
  var d = sync(datosActuales());
  d.snapshot.version = v;
  d.info.version = v;
  var txt = JSON.stringify(d);
  if (cache) {
    try {
      var valores = {};
      var k = 0;
      for (var p = 0; p < txt.length; p += CACHE_TROZO) valores[clave + '_' + (k++)] = txt.substring(p, p + CACHE_TROZO);
      valores[clave + '_n'] = String(k);
      cache.putAll(valores, CACHE_TTL);
    } catch (e) { /* demasiado grande para la cache: se sirve sin cachear */ }
  }
  return txt;
}

/** Ejecuta fn con el lock del script (una sola escritura a la vez). */
function conLock(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// Entrada: doGet (lecturas) y doPost (escrituras)
// ============================================================

function doGet(e) {
  iniciarPeticion();
  try {
    verificarClave(e, null);
    var action = (e && e.parameter && e.parameter.action) || '';
    if (action === '') return errorRes('Accion obligatoria (?action=...)');
    switch (action) {
      case 'version':
        return okRes({ version: versionDatos() });
      case 'snapshot':
        return okRes(JSON.parse(syncTexto()).snapshot);
      case 'sync':
        return okTexto(syncTexto());
      case 'config':
        return okRes(infoDe(datosActuales()));
      case 'dashboard':
        return okRes(resumen(datosActuales()));
      case 'reporte.mensual':
        return okRes(reporteMensual(e.parameter.periodo, datosActuales()));
      case 'reporte.general':
        return okRes(reporteGeneral(datosActuales()));
      case 'cobros':
        return okRes(listarCobros(e.parameter.periodo));
      case 'diagnostico':
        return okRes(diagnosticarCobros(e.parameter.periodo, datosActuales()));
      default:
        return errorRes('Accion desconocida: ' + action);
    }
  } catch (err) {
    return errorRes(String(err));
  } finally {
    terminarPeticion();
  }
}

function doPost(e) {
  iniciarPeticion();
  try {
    var cuerpo = {};
    if (e && e.postData && e.postData.contents) {
      try { cuerpo = JSON.parse(e.postData.contents) || {}; } catch (err) {
        throw new Error('Cuerpo JSON invalido: ' + err.message);
      }
    }
    verificarClave(e, cuerpo);
    var action = (e && e.parameter && e.parameter.action) || '';
    var conSync = !!(e && e.parameter && e.parameter.conSync);
    var resultado = conLock(function () {
      var r = action !== ''
        ? apiPost(action, e, cuerpo)
        // API interna (backend Java): el action va en el cuerpo
        : apiInterna(cuerpo.action || '', cuerpo);
      subirVersion();
      // Con ?conSync=1 se devuelven los datos actualizados en la misma respuesta
      // (el frontend no necesita otra llamada para refrescar).
      return { data: r, sync: conSync ? syncTexto() : null };
    });
    var base = JSON.stringify({ ok: true, data: resultado.data });
    if (resultado.sync === null) return respuestaTexto(base);
    return respuestaTexto(base.substring(0, base.length - 1) + ',"sync":' + resultado.sync + '}');
  } catch (err) {
    return errorRes(String(err));
  } finally {
    terminarPeticion();
  }
}

/** API interna usada por el backend Java (action dentro del cuerpo). */
function apiInterna(accion, cuerpo) {
  if (accion === 'upsert') {
    validarHoja(cuerpo.sheet);
    upsert(cuerpo.sheet, cuerpo.row);
    return true;
  }
  if (accion === 'delete') {
    validarHoja(cuerpo.sheet);
    borrar(cuerpo.sheet, cuerpo.id);
    return true;
  }
  if (accion === 'replaceCobros') {
    reemplazarCobros(parsePeriodo(cuerpo.periodo).prefix, cuerpo.rows || []);
    return true;
  }
  if (accion === 'replaceCobrosServicio') {
    var per = parsePeriodo(cuerpo.periodo).prefix;
    if (!cuerpo.servicioId) throw new Error('El servicio es obligatorio');
    reemplazarFilas('cobros', function (c) {
      return c.periodo === per && c.servicioId === cuerpo.servicioId;
    }, cuerpo.rows || []);
    return true;
  }
  throw new Error('Accion desconocida: ' + accion);
}

/** Mutaciones de la API directa (query action). Se ejecuta dentro del lock. */
function apiPost(action, e, cuerpo) {
  var p = e.parameter;
  cuerpo = cuerpo || {};
  switch (action) {
    case 'inquilinos.crear':
      return crearInquilino(cuerpo);
    case 'inquilinos.actualizar':
      return actualizarInquilino(p.id, cuerpo);
    case 'inquilinos.eliminar':
      eliminarInquilino(p.id);
      return true;
    case 'inquilinos.estado':
      return estadoInquilino(p.id, p.habilitado === 'true');
    case 'servicios.crear':
      return crearServicio(cuerpo);
    case 'servicios.actualizar':
      return actualizarServicio(p.id, cuerpo);
    case 'servicios.eliminar':
      eliminarServicio(p.id);
      return true;
    case 'servicios_inquilinos.guardar':
      return guardarServicioInquilino(cuerpo);
    case 'servicios_inquilinos.eliminar':
      borrar('servicios_inquilinos', p.id);
      return true;
    case 'pagos.crear':
      return registrarPago(cuerpo);
    case 'pagos.eliminar':
      eliminarPago(p.id);
      return true;
    case 'cobros.generar':
      return generarCobros(p.periodo);
    case 'cobros.generarServicio':
      return generarCobrosServicio(p.periodo,
        p.servicioId || (cuerpo && cuerpo.servicioId) || '');
    case 'cobros.editarPeso':
      return editarPesoServicio(p.periodo,
        p.servicioId || (cuerpo && cuerpo.servicioId) || '',
        cuerpo && cuerpo.pesos);
    case 'asignaciones.guardar':
      return guardarAsignacion(cuerpo);
    case 'asignaciones.copiar':
      return copiarAsignaciones(p.origen, p.destino);
    case 'asignaciones.eliminar':
      borrar('asignaciones', p.id);
      return true;
    default:
      throw new Error('Accion desconocida: ' + action);
  }
}

// ============================================================
// Entidades (CRUD, espejo de los controllers de Java)
// ============================================================

function sanearInquilino(i) {
  if (!i || !i.nombre || String(i.nombre).trim() === '') throw new Error('El nombre del inquilino es obligatorio');
  i.nombre = String(i.nombre).trim();
  i.habitaciones = Math.max(0, Math.floor(nz(i.habitaciones)));
  i.personas = Math.max(0, Math.floor(nz(i.personas)));
  i.habilitado = i.habilitado === true || i.habilitado === 'true';
  i.cobraAlquiler = i.cobraAlquiler === true || i.cobraAlquiler === 'true';
  i.alquilerBs = Math.max(0, red2(nz(i.alquilerBs)));
  i.fechaIngreso = parseFecha(i.fechaIngreso);
  i.fechaSalida = parseFecha(i.fechaSalida);
  if (i.fechaIngreso && i.fechaSalida && i.fechaSalida < i.fechaIngreso) {
    throw new Error('La fecha de salida no puede ser anterior a la de ingreso');
  }
}

function crearInquilino(i) {
  sanearInquilino(i);
  i.id = idNuevo('inq');
  if (!i.fechaIngreso) i.fechaIngreso = hoyISO();
  upsert('inquilinos', i);
  return i;
}

function actualizarInquilino(id, i) {
  if (!id) throw new Error('Falta el id del inquilino');
  sanearInquilino(i);
  i.id = id;
  upsert('inquilinos', i);
  return i;
}

function estadoInquilino(id, habilitado) {
  var inq = leerHoja('inquilinos').filter(function (x) { return x.id === id; })[0];
  if (!inq) throw new Error('Inquilino no encontrado: ' + id);
  inq.habilitado = habilitado;
  upsert('inquilinos', inq);
  return inq;
}

/**
 * Elimina un inquilino SOLO si no tiene historial (cobros ni pagos).
 * Con historial se debe deshabilitar. Sus asignaciones y servicios se borran.
 */
function eliminarInquilino(id) {
  if (!id) throw new Error('Falta el id del inquilino');
  var nCobros = leerHoja('cobros').filter(function (c) { return c.inquilinoId === id; }).length;
  var nPagos = leerHoja('pagos').filter(function (p) { return p.inquilinoId === id; }).length;
  if (nCobros > 0 || nPagos > 0) {
    throw new Error('No se puede eliminar: el inquilino tiene ' + nCobros + ' cobro(s) y ' + nPagos +
      ' pago(s). Deshabilitalo en su lugar para conservar el historial.');
  }
  quitarFilas('asignaciones', function (a) { return a.inquilinoId === id; });
  quitarFilas('servicios_inquilinos', function (a) { return a.inquilinoId === id; });
  borrar('inquilinos', id);
}

function validarServicio(s) {
  if (!s.nombre || String(s.nombre).trim() === '') throw new Error('El nombre del servicio es obligatorio');
  s.nombre = String(s.nombre).trim();
  if (!s.metodoPago || String(s.metodoPago).trim() === '') s.metodoPago = 'CUARTOS';
  s.metodoPago = String(s.metodoPago).toUpperCase();
  if (s.metodoPago !== 'CUARTOS' && s.metodoPago !== 'PERSONAS') throw new Error('El metodo de pago debe ser CUARTOS o PERSONAS');
  if (!Array.isArray(s.extras)) s.extras = [];
  var vistos = {};
  s.extras = s.extras.map(function (x) { return String(x).trim(); }).filter(function (x) {
    if (x === '' || vistos[x.toLowerCase()]) return false;
    vistos[x.toLowerCase()] = true;
    return true;
  });
}

function verificarNombreServicio(nombre, idExcluido) {
  var n = String(nombre).trim().toLowerCase();
  if (n === 'alquiler') throw new Error('"Alquiler" es un concepto reservado del sistema');
  var dup = leerHoja('servicios').filter(function (x) {
    return (idExcluido === undefined || idExcluido === null || x.id !== idExcluido)
      && String(x.nombre || '').trim().toLowerCase() === n;
  });
  if (dup.length > 0) throw new Error('Ya existe un servicio llamado "' + String(nombre).trim() + '"');
}

function crearServicio(s) {
  validarServicio(s);
  verificarNombreServicio(s.nombre, null);
  s.id = idNuevo('svc');
  upsert('servicios', s);
  return s;
}

function actualizarServicio(id, s) {
  if (!id) throw new Error('Falta el id del servicio');
  validarServicio(s);
  verificarNombreServicio(s.nombre, id);
  s.id = id;
  upsert('servicios', s);
  return s;
}

/** Elimina un servicio SOLO si no tiene cobros, facturas ni pagos asociados. */
function eliminarServicio(id) {
  if (!id) throw new Error('Falta el id del servicio');
  if (id === ALQUILER_ID) throw new Error('El alquiler no es un servicio editable');
  var nCobros = leerHoja('cobros').filter(function (c) { return c.servicioId === id; }).length;
  var nPagos = leerHoja('pagos').filter(function (p) { return p.servicioId === id; }).length;
  if (nCobros > 0 || nPagos > 0) {
    throw new Error('No se puede eliminar: el servicio tiene ' + nCobros + ' cobro(s) y ' + nPagos +
      ' factura(s)/pago(s) registrados.');
  }
  quitarFilas('asignaciones', function (a) { return a.servicioId === id; });
  quitarFilas('servicios_inquilinos', function (a) { return a.servicioId === id; });
  borrar('servicios', id);
}

function sanearExtras(extras) {
  var out = {};
  if (!extras || typeof extras !== 'object' || Array.isArray(extras)) return out;
  Object.keys(extras).forEach(function (k) {
    var n = Math.max(0, Math.floor(nz(extras[k])));
    if (String(k).trim() !== '') out[String(k).trim()] = n;
  });
  return out;
}

function guardarServicioInquilino(c) {
  if (!c.inquilinoId || String(c.inquilinoId).trim() === '') throw new Error('El inquilino es obligatorio');
  if (!c.servicioId || String(c.servicioId).trim() === '') throw new Error('El servicio es obligatorio');
  c.id = c.inquilinoId + '-' + c.servicioId;
  c.activo = c.activo === true;
  c.extras = sanearExtras(c.extras);
  upsert('servicios_inquilinos', c);
  return c;
}

function guardarAsignacion(c) {
  c.periodo = parsePeriodo(c.periodo).prefix;
  if (!c.inquilinoId || String(c.inquilinoId).trim() === '') throw new Error('El inquilino es obligatorio');
  if (!c.servicioId || String(c.servicioId).trim() === '') throw new Error('El servicio es obligatorio');
  c.id = c.periodo + '-' + c.inquilinoId + '-' + c.servicioId;
  c.activo = c.activo === true;
  c.extras = sanearExtras(c.extras);
  upsert('asignaciones', c);
  return c;
}

/**
 * Copia las asignaciones activas de un mes a otro (una sola escritura).
 * No toca las que ya existen en el destino y omite inquilinos inactivos ese mes.
 */
function copiarAsignaciones(origen, destino) {
  var o = parsePeriodo(origen);
  var d = parsePeriodo(destino);
  if (o.prefix === d.prefix) throw new Error('El mes de origen y destino es el mismo');
  var inqById = {};
  leerHoja('inquilinos').forEach(function (i) { inqById[i.id] = i; });
  var svcIds = {};
  leerHoja('servicios').forEach(function (s) { svcIds[s.id] = true; });
  var todas = leerHoja('asignaciones');
  var existentes = {};
  todas.forEach(function (a) { if (a.periodo === d.prefix) existentes[a.inquilinoId + '|' + a.servicioId] = true; });
  var nuevas = [];
  todas.forEach(function (a) {
    if (a.periodo !== o.prefix || a.activo !== true) return;
    if (existentes[a.inquilinoId + '|' + a.servicioId]) return;
    if (!svcIds[a.servicioId] || !activoEn(inqById[a.inquilinoId], d)) return;
    nuevas.push({
      id: d.prefix + '-' + a.inquilinoId + '-' + a.servicioId, periodo: d.prefix,
      inquilinoId: a.inquilinoId, servicioId: a.servicioId, activo: true, extras: sanearExtras(a.extras)
    });
  });
  if (nuevas.length > 0) reemplazarFilas('asignaciones', function () { return false; }, nuevas);
  return { copiadas: nuevas.length };
}

function esFactura(p) {
  return p.inquilinoId === null || p.inquilinoId === undefined || String(p.inquilinoId).trim() === '';
}

/**
 * Impide que un servicio/mes con pagos de inquilinos se quede sin factura
 * (monto 0, factura eliminada o movida a otro servicio/mes): sus cobros
 * desaparecerian y los pagos quedarian sin cobro.
 */
function verificarFacturaProtegida(pagos, servicioId, periodo, excluirId, accion) {
  if (!servicioId || !periodo) return;
  var abonos = pagos.filter(function (x) {
    return !esFactura(x) && x.servicioId === servicioId && x.periodo === periodo;
  }).length;
  if (abonos === 0) return;
  var resto = 0;
  pagos.forEach(function (x) {
    if (esFactura(x) && x.id !== excluirId && x.servicioId === servicioId && x.periodo === periodo) resto += nz(x.montoBs);
  });
  if (resto > 0) return;
  throw new Error('No se puede ' + accion + ': ' + abonos + ' pago(s) de inquilinos ya aplican a este ' +
    'servicio en ' + periodo + '. Corrige el monto de la factura (mayor a 0) en lugar de eliminarla.');
}

/**
 * Registra o edita un pago. Factura = pago sin inquilino (importe del servicio).
 * Al crear/editar una factura se reajustan los cobros ya generados del
 * servicio en ese mes (conservando los pesos del reparto).
 */
function registrarPago(p) {
  var monto = Number(p.montoBs);
  if (p.montoBs === undefined || p.montoBs === null || p.montoBs === '' || !isFinite(monto) || monto < 0) {
    throw new Error('El monto es invalido');
  }
  p.montoBs = red2(monto);
  p.inquilinoId = esFactura(p) ? null : String(p.inquilinoId);
  p.servicioId = (p.servicioId === undefined || p.servicioId === null || String(p.servicioId).trim() === '')
    ? null : String(p.servicioId);
  if (!p.fechaPago || String(p.fechaPago).trim() === '') p.fechaPago = hoyISO();
  p.fechaPago = parseFecha(p.fechaPago);
  if (!p.fechaPago) throw new Error('La fecha de pago es invalida');
  if (!p.periodo || String(p.periodo).trim() === '') p.periodo = hoyISO().substring(0, 7);
  p.periodo = parsePeriodo(p.periodo).prefix;

  if (p.inquilinoId !== null) {
    var inq = leerHoja('inquilinos').filter(function (x) { return x.id === p.inquilinoId; })[0];
    if (!inq) throw new Error('El inquilino no existe');
    if (p.servicioId === ALQUILER_ID && (inq.cobraAlquiler !== true || nz(inq.alquilerBs) <= 0)) {
      throw new Error('Este inquilino no tiene habilitado el pago de alquiler');
    }
  } else {
    if (p.servicioId === null) throw new Error('La factura debe indicar el servicio');
    if (p.servicioId === ALQUILER_ID) throw new Error('El pago de alquiler debe asociarse a un inquilino');
  }
  if (p.servicioId !== null && p.servicioId !== ALQUILER_ID) {
    var existe = leerHoja('servicios').some(function (s) { return s.id === p.servicioId; });
    if (!existe) throw new Error('El servicio no existe');
  }

  var existentes = leerHoja('pagos');
  var anterior = p.id ? existentes.filter(function (x) { return x.id === p.id; })[0] : null;
  if (p.id && !anterior) throw new Error('El pago a editar no existe: ' + p.id);
  if (anterior && esFactura(anterior) !== (p.inquilinoId === null)) {
    throw new Error('No se puede convertir una factura en pago de inquilino (ni al reves)');
  }
  if (p.inquilinoId === null && anterior) {
    if (anterior.servicioId !== p.servicioId || anterior.periodo !== p.periodo) {
      verificarFacturaProtegida(existentes, anterior.servicioId, anterior.periodo, p.id, 'mover la factura');
    }
    if (p.montoBs <= 0) {
      verificarFacturaProtegida(existentes, p.servicioId, p.periodo, p.id, 'dejar la factura en 0');
    }
  }
  if (p.inquilinoId === null) {
    var dup = existentes.some(function (e) {
      return esFactura(e) && e.id !== p.id && e.servicioId === p.servicioId && e.periodo === p.periodo;
    });
    if (dup) throw new Error('Ya existe una factura para este servicio en el periodo ' + p.periodo);
  }
  if (!p.id) p.id = idNuevo('pg');
  upsert('pagos', p);

  if (p.inquilinoId === null) {
    sincronizarCobrosFactura(p.servicioId, p.periodo);
    if (anterior && (anterior.servicioId !== p.servicioId || anterior.periodo !== p.periodo)) {
      sincronizarCobrosFactura(anterior.servicioId, anterior.periodo);
    }
  }
  return p;
}

/**
 * Elimina un pago. Si es una factura con cobros ya pagados por inquilinos se
 * bloquea (hay que corregir el monto); si no, los cobros del servicio/mes se ajustan.
 */
function eliminarPago(id) {
  if (!id) throw new Error('Falta el id del pago');
  var pago = leerHoja('pagos').filter(function (x) { return x.id === id; })[0];
  if (!pago) return;
  if (esFactura(pago)) {
    verificarFacturaProtegida(leerHoja('pagos'), pago.servicioId, pago.periodo, id, 'eliminar la factura');
  }
  borrar('pagos', id);
  if (esFactura(pago)) sincronizarCobrosFactura(pago.servicioId, pago.periodo);
}

/**
 * Reparte `costo` entre las lineas segun pesos (inquilinoId -> peso).
 * La diferencia por redondeo se asigna a la linea de mayor peso.
 */
function repartirConPesos(lineas, porId, costo) {
  var pesoTotal = 0;
  lineas.forEach(function (c) { pesoTotal += porId[c.inquilinoId]; });
  var filas = lineas.map(function (c) {
    var base = red2(costo * porId[c.inquilinoId] / pesoTotal);
    return {
      id: c.id, periodo: c.periodo, inquilinoId: c.inquilinoId, servicioId: c.servicioId,
      peso: porId[c.inquilinoId], pesoTotal: pesoTotal,
      montoBase: base, montoExtra: 0, montoTotal: base,
      habitaciones: c.habitaciones, personas: c.personas,
      extras: c.extras || {}
    };
  });
  var suma = 0;
  filas.forEach(function (f) { suma += f.montoBase; });
  var diferencia = red2(costo - suma);
  if (diferencia !== 0 && filas.length > 0) {
    var mayor = filas[0];
    filas.forEach(function (f) { if (f.peso > mayor.peso) mayor = f; });
    mayor.montoBase = red2(mayor.montoBase + diferencia);
    mayor.montoTotal = mayor.montoBase;
  }
  return filas;
}

/**
 * Mantiene los cobros de un servicio/mes alineados con sus facturas:
 * si cambia el importe se reparte el nuevo costo con los MISMOS pesos;
 * si ya no hay factura, se quitan los cobros de ese servicio/mes.
 */
function sincronizarCobrosFactura(servicioId, periodo) {
  if (!servicioId || !periodo || servicioId === ALQUILER_ID) return;
  var lineas = leerHoja('cobros').filter(function (c) {
    return c.periodo === periodo && c.servicioId === servicioId;
  });
  if (lineas.length === 0) return;
  var costo = costoDeFacturas(leerHoja('pagos'), servicioId, periodo);
  var esDelServicio = function (c) { return c.periodo === periodo && c.servicioId === servicioId; };
  if (nz(costo) <= 0) {
    quitarFilas('cobros', esDelServicio);
    return;
  }
  var porId = {};
  lineas.forEach(function (c) { porId[c.inquilinoId] = Math.max(1, nz(c.peso)); });
  reemplazarFilas('cobros', esDelServicio, repartirConPesos(lineas, porId, costo));
}

function generarCobros(periodo) {
  var prefix = parsePeriodo(periodo).prefix;
  var filas = calcular(prefix, datosActuales());
  reemplazarCobros(prefix, filas);
  return filas;
}

/** Genera SOLO los cobros de un servicio para el periodo, conservando los demas servicios. */
function generarCobrosServicio(periodo, servicioId) {
  if (!servicioId || String(servicioId).trim() === '') throw new Error('El servicio es obligatorio');
  var p = parsePeriodo(periodo);
  var filas = calcularServicio(p.prefix, servicioId, datosActuales());
  reemplazarFilas('cobros', function (c) {
    return c.periodo === p.prefix && c.servicioId === servicioId;
  }, filas);
  return filas;
}

function listarCobros(periodo) {
  var all = leerHoja('cobros');
  if (periodo) all = all.filter(function (c) { return c.periodo === periodo; });
  all.sort(function (a, b) { return b.periodo < a.periodo ? -1 : (b.periodo > a.periodo ? 1 : 0); });
  return all;
}

/**
 * Reajusta el factor de reparto (peso) de un servicio ya generado en el periodo.
 * Se bloquea solo si algun inquilino ya pago ESTE servicio en ese mes.
 */
function editarPesoServicio(periodo, servicioId, pesos) {
  if (!servicioId || String(servicioId).trim() === '') throw new Error('El servicio es obligatorio');
  if (servicioId === ALQUILER_ID) throw new Error('El alquiler no se reparte por pesos');
  if (!pesos || typeof pesos !== 'object' || Array.isArray(pesos) || Object.keys(pesos).length === 0) {
    throw new Error('Indica al menos un peso');
  }
  var p = parsePeriodo(periodo);
  var pagos = leerHoja('pagos');
  var lineas = leerHoja('cobros').filter(function (c) {
    return c.periodo === p.prefix && c.servicioId === servicioId;
  });
  if (lineas.length === 0) throw new Error('No hay cobros generados para ' + servicioId + ' en ' + p.prefix);

  var bloqueado = lineas.find(function (c) {
    return pagos.some(function (pg) {
      return !esFactura(pg) && pg.periodo === p.prefix && pg.inquilinoId === c.inquilinoId &&
        pg.servicioId === servicioId;
    });
  });
  if (bloqueado) {
    throw new Error('El inquilino ' + bloqueado.inquilinoId + ' ya pago este servicio en ' + p.prefix +
      '; no se puede reajustar el reparto');
  }

  var porId = {};
  Object.keys(pesos).forEach(function (inqId) {
    var peso = Number(pesos[inqId]);
    if (!(peso >= 1) || peso % 1 !== 0) throw new Error('El peso debe ser entero mayor que 0');
    porId[inqId] = peso;
  });
  var faltantes = lineas.some(function (c) { return !porId.hasOwnProperty(c.inquilinoId); });
  if (faltantes) throw new Error('El listado de pesos debe cubrir todas las lineas del servicio');

  var costo = costoDeFacturas(pagos, servicioId, p.prefix);
  if (nz(costo) <= 0) throw new Error('No hay factura registrada para ' + servicioId + ' en ' + p.prefix);

  var filas = repartirConPesos(lineas, porId, costo);
  reemplazarFilas('cobros', function (c) {
    return c.periodo === p.prefix && c.servicioId === servicioId;
  }, filas);
  return filas;
}

// ============================================================
// Snapshot / config / sync
// ============================================================

function datosActuales() {
  return {
    inquilinos: leerHoja('inquilinos'),
    servicios: leerHoja('servicios'),
    serviciosInquilinos: leerHoja('servicios_inquilinos'),
    cobros: leerHoja('cobros'),
    pagos: leerHoja('pagos'),
    asignaciones: leerHoja('asignaciones')
  };
}

function snapshotDe(d) {
  var out = {
    inquilinos: d.inquilinos,
    servicios: d.servicios,
    serviciosInquilinos: d.serviciosInquilinos,
    cobros: d.cobros,
    pagos: d.pagos,
    asignaciones: d.asignaciones,
    syncedAt: new Date().toISOString(),
    version: Date.now(),
    fuente: 'google'
  };
  // Alias snake_case para compatibilidad con el backend Java
  out.servicios_inquilinos = d.serviciosInquilinos;
  return out;
}

function infoDe(d) {
  var periodos = {};
  d.cobros.forEach(function (c) { periodos[c.periodo] = true; });
  d.pagos.forEach(function (p) { if (p.periodo) periodos[p.periodo] = true; });
  return {
    nombre: planilla().getName(),
    fuente: 'google',
    google: true,
    conectado: true,
    error: null,
    syncedAt: new Date().toISOString(),
    version: Date.now(),
    periodos: Object.keys(periodos).sort()
  };
}

function sync(d) {
  return { snapshot: snapshotDe(d), info: infoDe(d) };
}

// ============================================================
// Motor de cobros (port fiel de CalculoService.java)
// ============================================================

function calcular(periodo, datos) {
  return calcularPara(periodo, null, datos);
}

/** Cobros de UN solo servicio para el periodo. */
function calcularServicio(periodo, servicioId, datos) {
  return calcularPara(periodo, servicioId, datos);
}

function calcularPara(periodo, servicioFiltro, datos) {
  var p = parsePeriodo(periodo);
  var inqById = {};
  datos.inquilinos.forEach(function (i) { inqById[i.id] = i; });
  var svcById = {};
  datos.servicios.forEach(function (s) { svcById[s.id] = s; });

  // Subscripciones/servicios activos PARA ESTE PERIODO (asignaciones).
  var asig = (datos.asignaciones || []).filter(function (a) {
    return a.periodo === p.prefix && a.activo === true
      && inqById[a.inquilinoId] && svcById[a.servicioId]
      && activoEn(inqById[a.inquilinoId], p);
  });

  var resultado = [];
  datos.servicios.forEach(function (svc) {
    if (servicioFiltro && svc.id !== servicioFiltro) return;
    var delServicio = asig.filter(function (a) { return a.servicioId === svc.id; });
    if (delServicio.length === 0) return;
    var costo = costoDeFacturas(datos.pagos, svc.id, p.prefix);
    if (nz(costo) <= 0) return; // sin factura registrada del mes -> no se generan cobros
    resultado = resultado.concat(repartirServicio(svc, delServicio, inqById, p, costo));
  });

  // Alquiler: se integra solo cuando se regeneran TODOS los cobros del periodo.
  if (!servicioFiltro) {
    resultado = resultado.concat(cobrosAlquiler(p, datos));
  }
  return resultado;
}

/**
 * Cobros de alquiler mensual por inquilino. Solo para inquilinos con
 * cobraAlquiler=true, habitando la casa en el periodo y con un monto
 * alquilerBs definido (el monto es por inquilino, no global).
 * Se cobra el mes completo en cualquier periodo en que el inquilino esté
 * activo al menos un día (sin prorrateo por días ocupados).
 */
function cobrosAlquiler(p, datos) {
  var filas = [];
  (datos.inquilinos || []).forEach(function (inq) {
    if (inq.cobraAlquiler !== true) return;
    if (!activoEn(inq, p)) return;
    var mensual = red2(nz(inq.alquilerBs));
    if (mensual <= 0) return;
    if (diasActivosEnPeriodo(inq, p) <= 0) return;
    var monto = mensual;
    var hab = nz(inq.habitaciones);
    filas.push({
      id: idCobro(p.prefix, inq.id, ALQUILER_ID),
      periodo: p.prefix,
      inquilinoId: inq.id,
      servicioId: ALQUILER_ID,
      peso: hab > 0 ? hab : 1,
      pesoTotal: hab > 0 ? hab : 1,
      montoBase: monto,
      montoExtra: 0,
      montoTotal: monto,
      habitaciones: hab,
      personas: nz(inq.personas),
      extras: {}
    });
  });
  return filas;
}

/** Dias (inclusive) que el inquilino ocupara la casa dentro del periodo. */
function diasActivosEnPeriodo(inq, p) {
  var inicio = p.inicio;
  var fin = p.fin;
  var ingreso = parseFecha(inq.fechaIngreso);
  if (ingreso !== null && ingreso > inicio) inicio = ingreso;
  var salida = null;
  if (inq.fechaSalida !== null && inq.fechaSalida !== undefined && String(inq.fechaSalida).trim() !== '') {
    salida = parseFecha(inq.fechaSalida);
  }
  if (salida !== null) {
    if (salida < p.inicio) return 0;
    if (salida < fin) fin = salida;
  }
  if (inicio > fin) return 0;
  return diasEntre(inicio, fin) + 1;
}

/** Dias entre dos fechas 'YYYY-MM-DD' (a < b). */
function diasEntre(a, b) {
  var a1 = Number(a.slice(0, 4)), a2 = Number(a.slice(5, 7)) - 1, a3 = Number(a.slice(8, 10));
  var b1 = Number(b.slice(0, 4)), b2 = Number(b.slice(5, 7)) - 1, b3 = Number(b.slice(8, 10));
  return Math.round((Date.UTC(b1, b2, b3) - Date.UTC(a1, a2, a3)) / 86400000);
}

/** Suma de las facturas (pagos sin inquilino) del servicio para el periodo. */
function costoDeFacturas(pagos, servicioId, periodo) {
  var total = 0;
  (pagos || []).forEach(function (pg) {
    if ((pg.inquilinoId === null || pg.inquilinoId === undefined || pg.inquilinoId === '')
        && pg.servicioId === servicioId && pg.periodo === periodo) {
      total += nz(pg.montoBs);
    }
  });
  return total;
}

function repartirServicio(svc, asig, inqById, p, costo) {
  var porPersonas = String(svc.metodoPago || '').toUpperCase() === 'PERSONAS';

  // El factor de reparto = base (cuartos o personas) + extras del inquilino.
  // Cada extra suma +1 al factor por unidad. Ej.: 1 cuarto + 2 extras => factor 3.
  var pesos = [];
  asig.forEach(function (a) {
    var inq = inqById[a.inquilinoId];
    var base = porPersonas ? inq.personas : inq.habitaciones;
    var extrasMap = a.extras || {};
    var extraCount = 0;
    Object.keys(extrasMap).forEach(function(k) { extraCount += Math.max(0, Math.floor(nz(extrasMap[k]))); });
    var unidades = nz(base) + extraCount;
    if (unidades <= 0) return;
    pesos.push({ a: a, unidades: unidades });
  });
  if (pesos.length === 0) return [];

  var pesoTotal = 0;
  pesos.forEach(function (w) { pesoTotal += w.unidades; });
  var costo = nz(costo);

  var filas = [];
  pesos.forEach(function (w) {
    var a = w.a;
    var inq = inqById[a.inquilinoId];
    var base = red2(costo * w.unidades / pesoTotal);
    filas.push({
      id: idCobro(p.prefix, inq.id, svc.id),
      periodo: p.prefix,
      inquilinoId: inq.id,
      servicioId: svc.id,
      peso: w.unidades,
      pesoTotal: pesoTotal,
      montoBase: base,
      montoExtra: 0,
      montoTotal: red2(base),
      habitaciones: inq.habitaciones,
      personas: inq.personas,
      extras: a.extras || {}
    });
  });

  // Ajuste para que la suma de los montos base coincida con el costo total
  var sumaBase = 0;
  filas.forEach(function (c) { sumaBase += c.montoBase; });
  var diferencia = red2(costo - sumaBase);
  if (diferencia !== 0) {
    var mayor = pesos[0];
    pesos.forEach(function (w) { if (w.unidades > mayor.unidades) mayor = w; });
    for (var i = 0; i < filas.length; i++) {
      if (filas[i].inquilinoId === mayor.a.inquilinoId && filas[i].servicioId === svc.id) {
        filas[i].montoBase = red2(filas[i].montoBase + diferencia);
        filas[i].montoTotal = red2(filas[i].montoBase);
        break;
      }
    }
  }
  return filas;
}

/** True si el inquilino habitaba la casa durante el periodo (ingreso/salida se cruzan con el mes). */
function activoEn(inq, p) {
  if (!inq || !inq.habilitado) return false;
  var ingreso = parseFecha(inq.fechaIngreso);
  if (ingreso !== null && ingreso > p.fin) return false;
  if (inq.fechaSalida !== null && inq.fechaSalida !== undefined && String(inq.fechaSalida).trim() !== '') {
    var salida = parseFecha(inq.fechaSalida);
    if (salida !== null && salida < p.inicio) return false;
  }
  return true;
}

function parsePeriodo(periodo) {
  if (periodo === undefined || periodo === null || String(periodo).trim() === '') {
    throw new Error('El periodo es obligatorio (YYYY-MM)');
  }
  var p = String(periodo).trim();
  var m = /^(\d{4})-(\d{2})$/.exec(p);
  if (!m) throw new Error("Periodo invalido '" + p + "', se esperaba YYYY-MM");
  var y = Number(m[1]);
  var mes = Number(m[2]);
  if (mes < 1 || mes > 12) throw new Error("Periodo invalido '" + p + "', se esperaba YYYY-MM");
  var inicio = p + '-01';
  var fin = iso(new Date(Date.UTC(y, mes, 0)));
  return { prefix: p, inicio: inicio, fin: fin };
}

function parseFecha(s) {
  if (s === null || s === undefined) return null;
  s = String(s).trim();
  if (s === '') return null;
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return s.slice(0, 10);
  var d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return iso(d);
}

function iso(d) {
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
}

/**
 * Redondeo HALF_UP a 2 decimales (como BigDecimal.setScale(2)).
 * toFixed(8) absorbe el error binario (1.005 * 100 = 100.49999999999999).
 */
function red2(v) {
  var n = Number(v) || 0;
  var neg = n < 0;
  var x = Math.round(Number((Math.abs(n) * 100).toFixed(8))) / 100;
  return neg && x !== 0 ? -x : x;
}

function nz(v) {
  var n = Number(v);
  return isNaN(n) ? 0 : n;
}

function idCobro(periodo, inquilinoId, servicioId) {
  return periodo + '-' + inquilinoId + '-' + servicioId;
}

function idNuevo(prefijo) {
  var hex = '';
  try {
    if (typeof Utilities !== 'undefined') hex = Utilities.getUuid().replace(/-/g, '');
  } catch (e) { /* sin utilities */ }
  if (hex.length < 10) {
    var c = 'abcdef0123456789';
    for (var i = 0; i < 16; i++) hex += c[Math.floor(Math.random() * c.length)];
  }
  return prefijo + '-' + hex.substring(0, 10);
}

// ============================================================
// Reportes (port fiel de ReporteService.java)
// ============================================================

function reporteMensual(periodo, datos) {
  var p = parsePeriodo(periodo);
  var nombreInq = {};
  datos.inquilinos.forEach(function (i) { nombreInq[i.id] = i.nombre; });
  var nombreSvc = {};
  datos.servicios.forEach(function (s) { nombreSvc[s.id] = s.nombre; });

  var cobros = (datos.cobros || []).filter(function (c) { return c.periodo === p.prefix; });
  var pagosPeriodo = (datos.pagos || []).filter(function (pg) { return pg.periodo === p.prefix; });

  var detalle = [];
  cobros.forEach(function (c) {
    var pagado = pagadoDe(pagosPeriodo, c.inquilinoId, c.servicioId);
    detalle.push({
      id: c.id,
      inquilinoId: c.inquilinoId,
      inquilinoNombre: nombreInq[c.inquilinoId] || c.inquilinoId,
      servicioId: c.servicioId,
      servicioNombre: nombreSvc[c.servicioId] || (c.servicioId === ALQUILER_ID ? 'Alquiler' : c.servicioId),
      peso: c.peso,
      pesoTotal: c.pesoTotal,
      montoBase: c.montoBase,
      montoExtra: c.montoExtra,
      montoTotal: c.montoTotal,
      pagado: pagado,
      saldo: red2(nz(c.montoTotal) - pagado),
       habitaciones: c.habitaciones,
       personas: c.personas,
       extras: c.extras || {}
     });
  });

  // Totales por inquilino
  var porInqMap = {};
  detalle.forEach(function (f) {
    var t = porInqMap[f.inquilinoId] || (porInqMap[f.inquilinoId] = [0, 0]);
    t[0] += nz(f.montoTotal);
  });
  pagosPeriodo.forEach(function (pg) {
    if (pg.inquilinoId === null || pg.inquilinoId === undefined || pg.inquilinoId === '') return;
    var t = porInqMap[pg.inquilinoId] || (porInqMap[pg.inquilinoId] = [0, 0]);
    t[1] += nz(pg.montoBs);
  });
  var porInquilino = [];
  Object.keys(porInqMap).forEach(function (id) {
    var t = porInqMap[id];
    porInquilino.push({
      inquilinoId: id,
      nombre: nombreInq[id] || id,
      cobrado: red2(t[0]),
      pagado: red2(t[1]),
      saldo: red2(t[0] - t[1])
    });
  });
  porInquilino.sort(function (a, b) { return b.saldo - a.saldo; });

  // Totales por servicio
  var porSvcMap = {};
  detalle.forEach(function (f) {
    var t = porSvcMap[f.servicioId] || (porSvcMap[f.servicioId] = [0, 0, 0]);
    t[0] += nz(f.montoTotal);
    t[1] += nz(f.pagado);
    t[2] += 1;
  });
  var porServicio = [];
  Object.keys(porSvcMap).forEach(function (id) {
    var t = porSvcMap[id];
    porServicio.push({
      servicioId: id,
      nombre: nombreSvc[id] || id,
      cobrado: red2(t[0]),
      pagado: red2(t[1]),
      saldo: red2(t[0] - t[1]),
      cantidadCobros: t[2]
    });
  });
  porServicio.sort(function (a, b) { return b.cobrado - a.cobrado; });

  var totalCobrado = 0;
  var totalPagado = 0;
  cobros.forEach(function (c) { totalCobrado += nz(c.montoTotal); });
  pagosPeriodo.forEach(function (pg) {
    if (pg.inquilinoId === null || pg.inquilinoId === undefined || pg.inquilinoId === '') return;
    totalPagado += nz(pg.montoBs);
  });

  return {
    periodo: p.prefix,
    totalCobrado: red2(totalCobrado),
    totalPagado: red2(totalPagado),
    saldo: red2(totalCobrado - totalPagado),
    porInquilino: porInquilino,
    porServicio: porServicio,
    detalle: detalle
  };
}

function pagadoDe(pagos, inquilinoId, servicioId) {
  var s = 0;
  pagos.forEach(function (pg) {
    if (pg.inquilinoId === inquilinoId && pg.servicioId === servicioId) s += nz(pg.montoBs);
  });
  return s;
}

function reporteGeneral(datos) {
  var nombreInq = {};
  datos.inquilinos.forEach(function (i) { nombreInq[i.id] = i.nombre; });
  var nombreSvc = {};
  datos.servicios.forEach(function (s) { nombreSvc[s.id] = s.nombre; });

  var cobros = datos.cobros || [];
  var pagos = datos.pagos || [];

  // Totales por inquilino
  var porInqMap = {};
  cobros.forEach(function (c) {
    var t = porInqMap[c.inquilinoId] || (porInqMap[c.inquilinoId] = [0, 0]);
    t[0] += nz(c.montoTotal);
  });
  pagos.forEach(function (pg) {
    if (pg.inquilinoId === null || pg.inquilinoId === undefined || pg.inquilinoId === '') return;
    var t = porInqMap[pg.inquilinoId] || (porInqMap[pg.inquilinoId] = [0, 0]);
    t[1] += nz(pg.montoBs);
  });
  var porInquilino = [];
  Object.keys(porInqMap).forEach(function (id) {
    var t = porInqMap[id];
    porInquilino.push({
      inquilinoId: id,
      nombre: nombreInq[id] || id,
      cobrado: red2(t[0]),
      pagado: red2(t[1]),
      saldo: red2(t[0] - t[1])
    });
  });
  porInquilino.sort(function (a, b) { return b.saldo - a.saldo; });

  // Totales por servicio
  var porSvcMap = {};
  cobros.forEach(function (c) {
    var t = porSvcMap[c.servicioId] || (porSvcMap[c.servicioId] = [0, 0, 0]);
    t[0] += nz(c.montoTotal);
    t[2] += 1;
  });
  pagos.forEach(function (pg) {
    if (pg.inquilinoId === null || pg.inquilinoId === undefined || pg.inquilinoId === '') return;
    if (pg.servicioId !== null && pg.servicioId !== undefined && pg.servicioId !== '') {
      var t = porSvcMap[pg.servicioId] || (porSvcMap[pg.servicioId] = [0, 0, 0]);
      t[1] += nz(pg.montoBs);
    }
  });
  var porServicio = [];
  Object.keys(porSvcMap).forEach(function (id) {
    var t = porSvcMap[id];
    porServicio.push({
      servicioId: id,
      nombre: nombreSvc[id] || id,
      cobrado: red2(t[0]),
      pagado: red2(t[1]),
      saldo: red2(t[0] - t[1]),
      cantidadCobros: t[2]
    });
  });
  porServicio.sort(function (a, b) { return b.cobrado - a.cobrado; });

  // Totales por periodo
  var porPeriodoMap = {};
  cobros.forEach(function (c) {
    var t = porPeriodoMap[c.periodo] || (porPeriodoMap[c.periodo] = [0, 0]);
    t[0] += nz(c.montoTotal);
  });
  pagos.forEach(function (pg) {
    if (pg.inquilinoId === null || pg.inquilinoId === undefined || pg.inquilinoId === '') return;
    if (pg.periodo) {
      var t = porPeriodoMap[pg.periodo] || (porPeriodoMap[pg.periodo] = [0, 0]);
      t[1] += nz(pg.montoBs);
    }
  });
  var porPeriodo = [];
  Object.keys(porPeriodoMap).forEach(function (id) {
    var t = porPeriodoMap[id];
    porPeriodo.push({ periodo: id, cobrado: red2(t[0]), pagado: red2(t[1]), saldo: red2(t[0] - t[1]) });
  });
  porPeriodo.sort(function (a, b) { return a.periodo < b.periodo ? -1 : (a.periodo > b.periodo ? 1 : 0); });

  var totalCobrado = 0;
  var totalPagado = 0;
  cobros.forEach(function (c) { totalCobrado += nz(c.montoTotal); });
  pagos.forEach(function (pg) {
    if (pg.inquilinoId === null || pg.inquilinoId === undefined || pg.inquilinoId === '') return;
    totalPagado += nz(pg.montoBs);
  });

  return {
    totalCobrado: red2(totalCobrado),
    totalPagado: red2(totalPagado),
    saldo: red2(totalCobrado - totalPagado),
    porPeriodo: porPeriodo,
    porInquilino: porInquilino,
    porServicio: porServicio
  };
}

// ============================================================
// Dashboard (port fiel de DashboardService.java)
// ============================================================

function resumen(datos) {
  var periodo = hoyISO().substring(0, 7);
  var mensual = reporteMensual(periodo, datos);
  var general = reporteGeneral(datos);

  var activos = datos.inquilinos.filter(function (i) { return i.habilitado === true; }).length;
  var deudores = general.porInquilino.filter(function (t) { return t.saldo > 0; }).length;
  var cobradoDelMes = (datos.cobros || []).some(function (c) { return c.periodo === periodo; });

  var pagos = (datos.pagos || []).slice();
  pagos.sort(function (a, b) {
    var fa = a.fechaPago === null ? '' : a.fechaPago;
    var fb = b.fechaPago === null ? '' : b.fechaPago;
    return fb < fa ? -1 : (fb > fa ? 1 : 0);
  });
  var ultimosPagos = pagos.slice(0, 5);

  return {
    periodo: periodo,
    inquilinosActivos: activos,
    totalInquilinos: datos.inquilinos.length,
    totalServicios: datos.servicios.length,
    cobradoMes: mensual.totalCobrado,
    pagadoMes: mensual.totalPagado,
    saldoMes: mensual.saldo,
    deudores: deudores,
    cobradoDelMes: cobradoDelMes,
    ultimosPagos: ultimosPagos,
    porInquilino: mensual.porInquilino
  };
}

// ============================================================
// Lectura / escritura de hojas
// ============================================================

/** Indices de columna (0-based) por encabezado. */
function indicesDe(cabecera) {
  var idx = {};
  for (var j = 0; j < cabecera.length; j++) {
    var cab = String(cabecera[j]).trim();
    if (cab !== '' && idx[cab] === undefined) idx[cab] = j;
  }
  return idx;
}

/** Convierte una fila cruda de la hoja en objeto (null si esta vacia o sin id). */
function filaAObjeto(columnas, idx, fila) {
  var obj = {};
  var vacia = true;
  for (var k = 0; k < columnas.length; k++) {
    var col = columnas[k];
    var valor = idx[col] !== undefined ? fila[idx[col]] : '';
    if (valor !== '' && valor !== null && valor !== undefined) vacia = false;
    obj[col] = normalizar(col, valor);
  }
  return !vacia && obj.id ? obj : null;
}

function leerHoja(nombre) {
  if (CACHE_HOJAS && CACHE_HOJAS[nombre]) return CACHE_HOJAS[nombre].slice();
  var filasout = leerHojaSinCache(nombre);
  if (CACHE_HOJAS) CACHE_HOJAS[nombre] = filasout;
  return filasout.slice();
}

function leerHojaSinCache(nombre) {
  var hoja = asegurarHoja(nombre);
  var filas = hoja.getLastRow();
  var col = hoja.getLastColumn();
  if (filas < 1 || col < 1) return [];
  var celdas = hoja.getRange(1, 1, filas, col).getValues();
  var idx = indicesDe(celdas[0]);
  var columnas = HOJAS[nombre];
  var filasout = [];
  for (var i = 1; i < filas; i++) {
    var obj = filaAObjeto(columnas, idx, celdas[i]);
    if (obj) filasout.push(obj);
  }
  return filasout;
}

/** Zona horaria de la planilla (las celdas de fecha se interpretan en ella). */
function zonaHoja() {
  if (ZONA_HOJA !== null) return ZONA_HOJA;
  try {
    ZONA_HOJA = planilla().getSpreadsheetTimeZone() || ZONA;
  } catch (e) {
    ZONA_HOJA = ZONA;
  }
  return ZONA_HOJA;
}

function normalizar(col, valor) {
  if (valor === '' || valor === null || valor === undefined) {
    if (ENTERAS.indexOf(col) >= 0) return 0;
    if (BOOLEANAS.indexOf(col) >= 0) return false;
    return null;
  }
  if (BOOLEANAS.indexOf(col) >= 0) {
    if (typeof valor === 'boolean') return valor;
    var t = String(valor).trim().toLowerCase();
    return t === 'si' || t === 's' || t === '1' || t === 'true' || t === 'verdadero' || t === 'x';
  }
  if (ENTERAS.indexOf(col) >= 0) {
    var n = parseInt(String(valor).trim(), 10);
    return isNaN(n) ? 0 : n;
  }
   if (col === 'montoBs' || col === 'montoBase' ||
      col === 'montoExtra' || col === 'montoTotal' || col === 'peso' ||
      col === 'pesoTotal' || col === 'cantidad' || col === 'alquilerBs' ||
      col.indexOf('recio') >= 0) {
    var num = toNumber(String(valor));
    return num === null ? null : num;
  }
  if (FECHAS.indexOf(col) >= 0) {
    return fechaISO(valor);
  }
  if (col === 'periodo') {
    return periodoISO(valor);
  }
  // extras column: JSON string -> object, or pass through if already object
  if (col === 'extras') {
    if (typeof valor === 'object' && valor !== null) return valor;
    if (typeof valor === 'string' && valor.trim() !== '') {
      try { return JSON.parse(valor); } catch (e) { return {}; }
    }
    return {};
  }
  return String(valor);
}

/** Normaliza un periodo a YYYY-MM, aceptando '2026-04', ISO o Date (celda de hoja). */
function periodoISO(valor) {
  var t = String(valor).trim();
  var m = /^(\d{4})-(\d{2})/.exec(t);
  if (m) return m[1] + '-' + m[2];
  var d = new Date(valor);
  if (isNaN(d.getTime())) return t;
  return Utilities.formatDate(d, zonaHoja(), 'yyyy-MM');
}

function fechaISO(valor) {
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor)) {
    return valor.slice(0, 10);
  }
  var d = new Date(valor);
  if (isNaN(d.getTime())) return null;
  return Utilities.formatDate(d, zonaHoja(), 'yyyy-MM-dd');
}

function toNumber(v) {
  if (typeof v === 'number') return v;
  var s = String(v).replace(/\s/g, '').replace(',', '.');
  var n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/**
 * Asegura que la cabecera tenga todas las columnas del modelo (agrega al final
 * las que falten, sin tocar columnas manuales) y devuelve indices + ancho.
 */
function prepararCabecera(hoja, nombre) {
  var columnas = HOJAS[nombre];
  var ancho = Math.max(hoja.getLastColumn(), 1);
  var cab = hoja.getRange(1, 1, 1, ancho).getValues()[0];
  var idx = indicesDe(cab);
  var sig = 0;
  for (var j = 0; j < cab.length; j++) if (String(cab[j]).trim() !== '') sig = j + 1;
  columnas.forEach(function (c) {
    if (idx[c] === undefined) {
      hoja.getRange(1, sig + 1, 1, 1).setValues([[c]]);
      idx[c] = sig;
      sig++;
    }
  });
  return { idx: idx, ancho: Math.max(ancho, sig) };
}

/** Escribe en `base` (fila cruda) solo las columnas del modelo; conserva las demas. */
function mezclarFila(nombre, idx, base, obj) {
  var fila = base.slice();
  HOJAS[nombre].forEach(function (c) { fila[idx[c]] = serializar(c, obj); });
  return fila;
}

function filaVacia(ancho) {
  var f = [];
  for (var i = 0; i < ancho; i++) f.push('');
  return f;
}

/** Numero de fila (1-based) del registro con ese id, o -1. */
function buscarFila(hoja, idxId, id) {
  var ultima = hoja.getLastRow();
  if (ultima < 2) return -1;
  var ids = hoja.getRange(2, idxId + 1, ultima - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

/**
 * Inserta o actualiza UNA fila (no reescribe la hoja). Las columnas que no son
 * del modelo (agregadas a mano en la planilla) se conservan.
 */
function upsert(nombre, fila) {
  if (!fila || !fila.id) throw new Error('La fila debe traer un id');
  invalidarHoja(nombre);
  var hoja = asegurarHoja(nombre);
  var m = prepararCabecera(hoja, nombre);
  var n = buscarFila(hoja, m.idx.id, fila.id);
  if (n > 0) {
    var actual = hoja.getRange(n, 1, 1, m.ancho).getValues()[0];
    hoja.getRange(n, 1, 1, m.ancho).setValues([mezclarFila(nombre, m.idx, actual, fila)]);
  } else {
    hoja.getRange(hoja.getLastRow() + 1, 1, 1, m.ancho)
      .setValues([mezclarFila(nombre, m.idx, filaVacia(m.ancho), fila)]);
  }
}

/** Borra UNA fila por id. */
function borrar(nombre, id) {
  if (id === undefined || id === null || String(id) === '') throw new Error('Falta el id a eliminar');
  invalidarHoja(nombre);
  var hoja = asegurarHoja(nombre);
  var m = prepararCabecera(hoja, nombre);
  var n = buscarFila(hoja, m.idx.id, id);
  if (n < 0) return;
  if (hoja.getMaxRows() > hoja.getFrozenRows() + 1) {
    hoja.deleteRow(n);
  } else {
    // Sheets no permite borrar la ultima fila no congelada: se vacia.
    hoja.getRange(n, 1, 1, m.ancho).clearContent();
  }
}

/**
 * Quita las filas que cumplen `quitar(obj)` (borrando las filas, de abajo hacia
 * arriba) y agrega `nuevas` al final. Las filas que quedan no se reescriben, asi
 * conservan formulas, formato y notas de las columnas manuales.
 */
function reemplazarFilas(nombre, quitar, nuevas) {
  invalidarHoja(nombre);
  var hoja = asegurarHoja(nombre);
  var m = prepararCabecera(hoja, nombre);
  var columnas = HOJAS[nombre];
  var ultima = hoja.getLastRow();
  var crudas = ultima >= 2 ? hoja.getRange(2, 1, ultima - 1, m.ancho).getValues() : [];
  var borrar = []; // numeros de fila (1-based), ascendente
  crudas.forEach(function (fila, i) {
    var obj = filaAObjeto(columnas, m.idx, fila);
    if (obj && quitar(obj)) borrar.push(i + 2);
  });
  if (borrar.length > 0) {
    // Sheets no permite borrar todas las filas no congeladas: deja una de reserva.
    if (hoja.getMaxRows() - hoja.getFrozenRows() <= borrar.length) {
      hoja.insertRowsAfter(hoja.getMaxRows(), 1);
    }
    // Agrupa filas contiguas y borra de abajo hacia arriba.
    var fin = borrar.length - 1;
    while (fin >= 0) {
      var ini = fin;
      while (ini > 0 && borrar[ini - 1] === borrar[ini] - 1) ini--;
      hoja.deleteRows(borrar[ini], fin - ini + 1);
      fin = ini - 1;
    }
  }
  var lista = nuevas || [];
  if (lista.length > 0) {
    var valores = lista.map(function (obj) { return mezclarFila(nombre, m.idx, filaVacia(m.ancho), obj); });
    hoja.getRange(hoja.getLastRow() + 1, 1, valores.length, m.ancho).setValues(valores);
  }
}

function quitarFilas(nombre, quitar) {
  reemplazarFilas(nombre, quitar, []);
}

function reemplazarCobros(periodo, filasNuevas) {
  reemplazarFilas('cobros', function (f) { return f.periodo === periodo; }, filasNuevas || []);
}

function serializar(col, fila) {
  var v = fila ? fila[col] : null;
  if (v === undefined || v === null) {
    return BOOLEANAS.indexOf(col) >= 0 ? false : '';
  }
  if (BOOLEANAS.indexOf(col) >= 0) return v === true || v === 'true' || v === 1;
  if (col === 'periodo') return periodoISO(v);
  if (typeof v === 'object') return JSON.stringify(v);
  // Evita que un texto que empieza con = + @ se interprete como formula.
  if (typeof v === 'string' && /^[=+@]/.test(v)) return "'" + v;
  return v;
}

function asegurarHoja(nombre) {
  var ss = planilla();
  var hoja = ss.getSheetByName(nombre);
  if (hoja) return hoja;
  hoja = ss.insertSheet(nombre);
  var columnas = HOJAS[nombre];
  hoja.getRange(1, 1, 1, columnas.length).setValues([columnas]);
  hoja.setFrozenRows(1);
  hoja.getRange(1, 1, 1, columnas.length).setFontWeight('bold');
  return hoja;
}

function crearHojas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setName(NOMBRE_CASA);
  for (var nombre in HOJAS) {
    asegurarHoja(nombre);
  }
  return { ok: true, data: { hojas: Object.keys(HOJAS) } };
}

function diagnosticarCobros(periodo, datos) {
  var p = parsePeriodo(periodo);
  var inqById = {};
  datos.inquilinos.forEach(function (i) { inqById[i.id] = i; });
  var svcById = {};
  datos.servicios.forEach(function (s) { svcById[s.id] = s; });

  var asigTotal = (datos.asignaciones || []).filter(function (a) {
    return a.periodo === p.prefix;
  });

  var asigDetalladas = asigTotal.map(function (a) {
    var inq = inqById[a.inquilinoId];
    var svc = svcById[a.servicioId];
    var inqExiste = !!inq;
    var svcExiste = !!svc;
    var activoOk = a.activo === true;
    var habilitado = inq ? !!inq.habilitado : false;
    var enPeriodo = inq ? activoEn(inq, p) : false;
    return {
      id: a.id,
      inquilinoId: a.inquilinoId,
      servicioId: a.servicioId,
      activo: a.activo,
      activoType: typeof a.activo,
      extras: a.extras,
      inqExiste: inqExiste,
      svcExiste: svcExiste,
      habilitado: habilitado,
      enPeriodo: enPeriodo,
      pasa: inqExiste && svcExiste && activoOk && habilitado && enPeriodo
    };
  });

  var facturas = (datos.pagos || []).filter(function (pg) {
    return (pg.inquilinoId === null || pg.inquilinoId === undefined || pg.inquilinoId === '')
      && pg.periodo === p.prefix;
  });

  var facturasDet = facturas.map(function (f) {
    return {
      id: f.id,
      servicioId: f.servicioId,
      servicioNombre: svcById[f.servicioId] ? svcById[f.servicioId].nombre : '(no encontrado)',
      montoBs: f.montoBs,
      periodo: f.periodo,
      inquilinoId: f.inquilinoId
    };
  });

  var costosPorServicio = {};
  datos.servicios.forEach(function (svc) {
    var c = costoDeFacturas(datos.pagos, svc.id, p.prefix);
    costosPorServicio[svc.id] = { nombre: svc.nombre, costo: c };
  });

  var resultado = calcular(periodo, datos);

  return {
    periodo: p.prefix,
    servicios: datos.servicios.map(function (s) { return { id: s.id, nombre: s.nombre }; }),
    inquilinos: datos.inquilinos.map(function (i) {
      return { id: i.id, nombre: i.nombre, habilitado: i.habilitado, fechaIngreso: i.fechaIngreso, fechaSalida: i.fechaSalida };
    }),
    asignacionesTotal: asigTotal.length,
    asignaciones: asigDetalladas,
    facturasTotal: facturas.length,
    facturas: facturasDet,
    costosPorServicio: costosPorServicio,
    cobrosGenerados: resultado.length,
    cobros: resultado
  };
}

function configuracion() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return {
    ok: true,
    data: {
      nombre: ss.getName(),
      spreadsheetId: ss.getId(),
      hojas: Object.keys(HOJAS)
    }
  };
}

function validarHoja(nombre) {
  if (!HOJAS[nombre]) throw new Error('Hoja desconocida: ' + nombre);
  asegurarHoja(nombre);
}

// ============================================================
// Respuestas
// ============================================================

function okRes(data) {
  return respuesta({ ok: true, data: data });
}

/** Respuesta ok con `data` ya serializado como JSON (evita volver a serializar). */
function okTexto(json) {
  return respuestaTexto('{"ok":true,"data":' + json + '}');
}

function respuestaTexto(texto) {
  return ContentService.createTextOutput(texto).setMimeType(ContentService.MimeType.JSON);
}

function errorRes(msg) {
  return respuesta({ ok: false, error: String(msg) });
}

function respuesta(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Edicion manual rapida: abre la hoja "inquilinos". */
function menu() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setActiveSheet(ss.getSheetByName('inquilinos') || asegurarHoja('inquilinos'));
}
