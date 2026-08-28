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

// ============================================================
// Entrada: doGet (lecturas) y doPost (escrituras)
// ============================================================

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || '';
    if (action === '') return errorRes('Accion obligatoria (?action=...)');
    switch (action) {
      case 'snapshot':
        return okRes(snapshotDe(datosActuales()));
      case 'sync':
        return okRes(sync(datosActuales()));
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
  }
}

function doPost(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || '';
    if (action !== '') {
      return okRes(apiPost(action, e));
    }
    // API interna (backend Java): el action via en el cuerpo
    var cuerpo = {};
    if (e.postData && e.postData.contents) {
      try { cuerpo = JSON.parse(e.postData.contents) || {}; } catch (err) {
        throw new Error('Cuerpo JSON invalido: ' + err.message);
      }
    }
    var accion = cuerpo.action || '';
    if (accion === 'upsert') {
      validarHoja(cuerpo.sheet);
      upsert(cuerpo.sheet, cuerpo.row);
      return okRes(true);
    }
    if (accion === 'delete') {
      validarHoja(cuerpo.sheet);
      borrar(cuerpo.sheet, cuerpo.id);
      return okRes(true);
    }
    if (accion === 'replaceCobros') {
      reemplazarCobros(cuerpo.periodo, cuerpo.rows || []);
      return okRes(true);
    }
    return errorRes('Accion desconocida: ' + accion);
  } catch (err) {
    return errorRes(String(err));
  }
}

/** Mutaciones de la API directa (query action). */
function apiPost(action, e) {
  var p = e.parameter;
  var cuerpo = {};
  if (e.postData && e.postData.contents) {
    try { cuerpo = JSON.parse(e.postData.contents) || {}; } catch (err) {
      throw new Error('Cuerpo JSON invalido: ' + err.message);
    }
  }
  switch (action) {
    case 'inquilinos.crear':
      return crearInquilino(cuerpo);
    case 'inquilinos.actualizar':
      return actualizarInquilino(p.id, cuerpo);
    case 'inquilinos.eliminar':
      borrar('inquilinos', p.id);
      return true;
    case 'inquilinos.estado':
      return estadoInquilino(p.id, p.habilitado === 'true');
    case 'servicios.crear':
      return crearServicio(cuerpo);
    case 'servicios.actualizar':
      return actualizarServicio(p.id, cuerpo);
    case 'servicios.eliminar':
      borrar('servicios', p.id);
      return true;
    case 'servicios_inquilinos.guardar':
      return guardarServicioInquilino(cuerpo);
    case 'servicios_inquilinos.eliminar':
      borrar('servicios_inquilinos', p.id);
      return true;
    case 'pagos.crear':
      return registrarPago(cuerpo);
    case 'pagos.eliminar':
      borrar('pagos', p.id);
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

function crearInquilino(i) {
  if (!i.nombre || String(i.nombre).trim() === '') throw new Error('El nombre del inquilino es obligatorio');
  if (i.habitaciones < 0) i.habitaciones = 0;
  if (i.personas < 0) i.personas = 0;
  i.id = idNuevo('inq');
  if (!i.fechaIngreso || String(i.fechaIngreso).trim() === '') i.fechaIngreso = iso(new Date());
  upsert('inquilinos', i);
  return i;
}

function actualizarInquilino(id, i) {
  if (!i.nombre || String(i.nombre).trim() === '') throw new Error('El nombre del inquilino es obligatorio');
  if (i.habitaciones < 0) i.habitaciones = 0;
  if (i.personas < 0) i.personas = 0;
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

function validarServicio(s) {
  if (!s.nombre || String(s.nombre).trim() === '') throw new Error('El nombre del servicio es obligatorio');
  s.nombre = String(s.nombre).trim();
  if (!s.metodoPago || String(s.metodoPago).trim() === '') s.metodoPago = 'CUARTOS';
  s.metodoPago = String(s.metodoPago).toUpperCase();
  if (s.metodoPago !== 'CUARTOS' && s.metodoPago !== 'PERSONAS') throw new Error('El metodo de pago debe ser CUARTOS o PERSONAS');
}

function verificarNombreServicio(nombre, idExcluido) {
  var n = String(nombre).trim().toLowerCase();
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
  validarServicio(s);
  verificarNombreServicio(s.nombre, id);
  s.id = id;
  upsert('servicios', s);
  return s;
}

function guardarServicioInquilino(c) {
  if (!c.inquilinoId || String(c.inquilinoId).trim() === '') throw new Error('El inquilino es obligatorio');
  if (!c.servicioId || String(c.servicioId).trim() === '') throw new Error('El servicio es obligatorio');
  c.id = c.inquilinoId + '-' + c.servicioId;
  c.extras = c.extras || {};
  // Ensure all extra values are non-negative integers
  Object.keys(c.extras).forEach(function(k) {
    c.extras[k] = Math.max(0, Math.floor(Number(c.extras[k]) || 0));
  });
  upsert('servicios_inquilinos', c);
  return c;
}

function guardarAsignacion(c) {
  if (!c.periodo || String(c.periodo).trim() === '') throw new Error('El periodo es obligatorio (YYYY-MM)');
  if (!c.inquilinoId || String(c.inquilinoId).trim() === '') throw new Error('El inquilino es obligatorio');
  if (!c.servicioId || String(c.servicioId).trim() === '') throw new Error('El servicio es obligatorio');
  c.id = c.periodo + '-' + c.inquilinoId + '-' + c.servicioId;
  c.activo = c.activo === true;
  c.extras = c.extras || {};
  // Ensure all extra values are non-negative integers
  Object.keys(c.extras).forEach(function(k) {
    c.extras[k] = Math.max(0, Math.floor(Number(c.extras[k]) || 0));
  });
  upsert('asignaciones', c);
  return c;
}

function registrarPago(p) {
  if (p.montoBs === undefined || p.montoBs === null || nz(p.montoBs) < 0) throw new Error('El monto es invalido');
  p.inquilinoId = p.inquilinoId === undefined || String(p.inquilinoId).trim() === '' ? null : p.inquilinoId;
  if (p.servicioId === ALQUILER_ID) {
    if (p.inquilinoId === null) throw new Error('El pago de alquiler debe asociarse a un inquilino');
    var inqAlq = leerHoja('inquilinos').filter(function (x) { return x.id === p.inquilinoId; })[0];
    if (!inqAlq) throw new Error('El inquilino no existe');
    if (inqAlq.cobraAlquiler !== true || nz(inqAlq.alquilerBs) <= 0) {
      throw new Error('Este inquilino no tiene habilitado el pago de alquiler');
    }
  }
  if (p.inquilinoId === null &&
      (p.servicioId === undefined || p.servicioId === null || String(p.servicioId).trim() === '')) {
    throw new Error('La factura debe indicar el servicio');
  }
  // Si ya trae id es una edicion (reemplaza la fila); si no, es una factura nueva.
  if (!p.id) {
    // Validar que no exista ya una factura para el mismo servicio y periodo
    if (p.inquilinoId === null) {
      var existentes = leerHoja('pagos');
      for (var i = 0; i < existentes.length; i++) {
        var e = existentes[i];
        if (e.inquilinoId === null && e.servicioId === p.servicioId && e.periodo === p.periodo) {
          throw new Error('Ya existe una factura para este servicio en el periodo ' + p.periodo);
        }
      }
    }
    p.id = idNuevo('pg');
  }
  if (!p.fechaPago || String(p.fechaPago).trim() === '') p.fechaPago = iso(new Date());
  if (!p.periodo || String(p.periodo).trim() === '') p.periodo = iso(new Date()).substring(0, 7);
  upsert('pagos', p);
  return p;
}

function generarCobros(periodo) {
  var filas = calcular(periodo, datosActuales());
  reemplazarCobros(parsePeriodo(periodo).prefix, filas);
  return filas;
}

/** Genera SOLO los cobros de un servicio para el periodo, conservando los demas servicios. */
function generarCobrosServicio(periodo, servicioId) {
  if (!servicioId || String(servicioId).trim() === '') throw new Error('El servicio es obligatorio');
  var p = parsePeriodo(periodo);
  var filas = calcularServicio(periodo, servicioId, datosActuales());
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var restantes = leerHoja('cobros').filter(function (c) {
      return !(c.periodo === p.prefix && c.servicioId === servicioId);
    });
    filas.forEach(function (f) { restantes.push(f); });
    escribirHoja('cobros', restantes);
  } finally {
    lock.releaseLock();
  }
  return filas;
}

function listarCobros(periodo) {
  var all = leerHoja('cobros');
  if (periodo) all = all.filter(function (c) { return c.periodo === periodo; });
  all.sort(function (a, b) { return b.periodo < a.periodo ? -1 : (b.periodo > a.periodo ? 1 : 0); });
  return all;
}

/** Reajusta el factor de reparto (peso) de un servicio ya generado en el periodo. */
function editarPesoServicio(periodo, servicioId, pesos) {
  if (!servicioId || String(servicioId).trim() === '') throw new Error('El servicio es obligatorio');
  if (!pesos || typeof pesos !== 'object' || Array.isArray(pesos) || Object.keys(pesos).length === 0) {
    throw new Error('Indica al menos un peso');
  }
  var p = parsePeriodo(periodo);
  var datos = datosActuales();
  var lineas = leerHoja('cobros').filter(function (c) {
    return c.periodo === p.prefix && c.servicioId === servicioId;
  });
  if (lineas.length === 0) throw new Error('No hay cobros generados para ' + servicioId + ' en ' + p.prefix);

  // Un inquilino con abonos en el mes bloquea el reajuste del servicio entero.
  var abonos = (datos.pagos || []).filter(function (pg) {
    return pg.periodo === p.prefix && pg.inquilinoId !== null && String(pg.inquilinoId).trim() !== '';
  });
  var bloqueado = lineas.find(function (c) {
    return abonos.some(function (pg) { return pg.inquilinoId === c.inquilinoId; });
  });
  if (bloqueado) {
    throw new Error('El inquilino ' + bloqueado.inquilinoId + ' ya tiene pagos en ' + p.prefix +
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

  var costo = costoDeFacturas(datos.pagos, servicioId, p.prefix);
  if (nz(costo) <= 0) throw new Error('No hay factura registrada para ' + servicioId + ' en ' + p.prefix);

  var pesoTotal = 0;
  lineas.forEach(function (c) { pesoTotal += porId[c.inquilinoId]; });

  var filas = lineas.map(function (c) {
    var base = red2(costo * porId[c.inquilinoId] / pesoTotal);
    return {
      id: c.id, periodo: p.prefix, inquilinoId: c.inquilinoId, servicioId: c.servicioId,
      peso: porId[c.inquilinoId], pesoTotal: pesoTotal,
      montoBase: base, montoExtra: 0, montoTotal: base,
      habitaciones: c.habitaciones, personas: c.personas,
      extras: c.extras || {}
    };
  });

  // Ajuste para que la suma de montos coincida con el costo total.
  var suma = 0;
  filas.forEach(function (f) { suma += f.montoBase; });
  var diferencia = red2(costo - suma);
  if (diferencia !== 0) {
    var mayor = lineas[0];
    lineas.forEach(function (c) { if (porId[c.inquilinoId] > porId[mayor.inquilinoId]) mayor = c; });
    for (var i = 0; i < filas.length; i++) {
      if (filas[i].inquilinoId === mayor.inquilinoId) {
        filas[i].montoBase = red2(filas[i].montoBase + diferencia);
        filas[i].montoTotal = filas[i].montoBase;
        break;
      }
    }
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var restantes = leerHoja('cobros').filter(function (c) {
      return !(c.periodo === p.prefix && c.servicioId === servicioId);
    });
    filas.forEach(function (f) { restantes.push(f); });
    escribirHoja('cobros', restantes);
  } finally {
    lock.releaseLock();
  }
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
    nombre: SpreadsheetApp.getActiveSpreadsheet().getName(),
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
    Object.keys(extrasMap).forEach(function(k) { extraCount += nz(extrasMap[k]); });
    // Extras libres desde el campo observacion (formato: "nombre1,nombre2")
    if (a.observacion && a.observacion.trim() !== '') {
      var nombres = a.observacion.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s !== ''; });
      var vistos = {};
      nombres.forEach(function(n) { vistos[n] = true; });
      extraCount += Object.keys(vistos).length;
    }
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

/** True si el inquilino habitaba la casa durante el periodo. */
function activoEn(inq, p) {
  if (!inq || !inq.habilitado) return false;
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

/** Redondeo HALF_UP a 2 decimales (como BigDecimal.setScale(2)). */
function red2(v) {
  var n = Number(v) || 0;
  var neg = n < 0;
  var x = Math.round(Math.abs(n) * 100) / 100;
  return neg ? -x : x;
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
  var periodo = iso(new Date()).substring(0, 7);
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

function leerHoja(nombre) {
  var hoja = asegurarHoja(nombre);
  var filas = hoja.getLastRow();
  var col = hoja.getLastColumn();
  if (filas < 1 || col < 1) return [];

  var celdas = hoja.getRange(1, 1, filas, col).getValues();
  var idx = {};
  for (var j = 0; j < col; j++) {
    var cab = String(celdas[0][j]).trim();
    if (cab !== '') idx[cab] = j;
  }

  var columnas = HOJAS[nombre];
  var filasout = [];
  for (var i = 1; i < filas; i++) {
    var obj = {};
    var vacia = true;
    for (var k = 0; k < columnas.length; k++) {
      var cols = columnas[k];
      var valor = idx[cols] !== undefined ? celdas[i][idx[cols]] : '';
      if (valor !== '' && valor !== null) vacia = false;
      obj[cols] = normalizar(cols, valor);
    }
    if (!vacia && obj.id) filasout.push(obj);
  }
  return filasout;
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
  return iso(d).substring(0, 7);
}

function fechaISO(valor) {
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor)) {
    return valor.slice(0, 10);
  }
  var d = new Date(valor);
  if (isNaN(d.getTime())) return null;
  return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
}

function toNumber(v) {
  if (typeof v === 'number') return v;
  var s = String(v).replace(/\s/g, '').replace(',', '.');
  var n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function upsert(nombre, fila) {
  if (!fila || !fila.id) throw new Error('La fila debe traer un id');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var filas = leerHoja(nombre);
    var reemplazada = false;
    for (var i = 0; i < filas.length; i++) {
      if (filas[i].id === fila.id) {
        filas[i] = fila;
        reemplazada = true;
        break;
      }
    }
    if (!reemplazada) filas.push(fila);
    escribirHoja(nombre, filas);
  } finally {
    lock.releaseLock();
  }
}

function borrar(nombre, id) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var filas = leerHoja(nombre).filter(function (f) { return f.id !== id; });
    escribirHoja(nombre, filas);
  } finally {
    lock.releaseLock();
  }
}

function reemplazarCobros(periodo, filasNuevas) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var filas = leerHoja('cobros').filter(function (f) { return f.periodo !== periodo; });
    for (var i = 0; i < (filasNuevas || []).length; i++) {
      filas.push(filasNuevas[i]);
    }
    escribirHoja('cobros', filas);
  } finally {
    lock.releaseLock();
  }
}

function escribirHoja(nombre, filas) {
  var hoja = asegurarHoja(nombre);
  var columnas = HOJAS[nombre];
  var valores = [columnas.slice()];
  for (var i = 0; i < filas.length; i++) {
    var fila = filas[i];
    var row = [];
    for (var j = 0; j < columnas.length; j++) {
      row.push(serializar(columnas[j], fila));
    }
    valores.push(row);
  }
  if (valores.length === 1) {
    hoja.clearContents();
    hoja.getRange(1, 1, 1, columnas.length).setValues(valores);
    return;
  }
  if (hoja.getLastRow() > 0 || hoja.getLastColumn() > 0) hoja.clearContents();
  hoja.getRange(1, 1, valores.length, columnas.length).setValues(valores);
}

function serializar(col, fila) {
  var v = fila ? fila[col] : null;
  if (v === undefined || v === null) {
    return BOOLEANAS.indexOf(col) >= 0 ? false : '';
  }
  if (BOOLEANAS.indexOf(col) >= 0) return v === true || v === 'true' || v === 1;
  if (col === 'periodo') return periodoISO(v);
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

function asegurarHoja(nombre) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
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
