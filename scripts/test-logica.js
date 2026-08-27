/**
 * Prueba la logica de scripts/Code.gs fuera de Apps Script.
 * Carga Code.gs en un sandbox con stubs de Apps Script y ejecuta
 * los mismos escenarios que CalculoServiceTest.java (+ CRUD + reportes).
 *
 * Ejecutar: node scripts/test-logica.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---------- stubs de Apps Script ----------

function crearStubs() {
  const datos = {}; // nombreHoja -> 2D array (con encabezado)

  function getSheet(nombre) {
    if (!datos[nombre]) datos[nombre] = [[]];
    return {
      getLastRow() { return datos[nombre].length; },
      getLastColumn() { return Math.max(1, ...datos[nombre].map(r => r.length)); },
      getRange(r, c, nr, nc) {
        return {
          getValues() {
            return datos[nombre].slice(r - 1, r - 1 + nr).map(row => {
              const out = [];
              for (let j = 0; j < nc; j++) out.push(row[j] === undefined ? '' : row[j]);
              return out;
            });
          },
          setValues(v) {
            const max = Math.max(datos[nombre].length, r - 1 + v.length);
            while (datos[nombre].length < max) datos[nombre].push([]);
            v.forEach((fila, i) => { datos[nombre][r - 1 + i] = fila.slice(); });
          },
        };
      },
      clearContents() { datos[nombre] = [[]]; },
      setFrozenRows() {},
      setFontWeight() {},
    };
  }

  const sandbox = {
    console,
    Math,
    Date,
    JSON,
    Object,
    String,
    Number,
    Array,
    Boolean,
    parseInt,
    parseFloat,
    isNaN,
    Error,
    RegExp,
    SpreadsheetApp: {
      getActiveSpreadsheet() {
        return {
          getName: () => 'Casa',
          getSheetByName: (n) => (datos[n] ? getSheet(n) : null),
          insertSheet: (n) => {
            datos[n] = [[]];
            return getSheet(n);
          },
          setId() {},
          getSheets: () => Object.keys(datos).map(getSheet),
        };
      },
    },
    LockService: {
      getScriptLock() {
        return { waitLock() {}, releaseLock() {} };
      },
    },
    Utilities: {
      getUuid: () => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      formatDate(d, tz, fmt) {
        const pad = (n) => (n < 10 ? '0' : '') + n;
        return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
      },
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(s) {
        return { setMimeType() { return this; }, getContent: () => s };
      },
    },
  };

  return { sandbox, datos };
}

// ---------- cargar Code.gs ----------

function cargar() {
  const { sandbox, datos } = crearStubs();
  const codigo = fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8');
  vm.createContext(sandbox);
  vm.runInContext(codigo, sandbox, { filename: 'Code.gs' });
  return { ctx: sandbox, datos };
}

// ---------- helpers ----------

let pasadas = 0;
function igual(a, b, msg) {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok) throw new Error(`${msg}: esperaba ${JSON.stringify(b)}, obtuve ${JSON.stringify(a)}`);
  pasadas++;
}

function cobroDe(cobros, id) {
  const c = cobros.find((x) => x.inquilinoId === id);
  if (!c) throw new Error('No hay cobro para ' + id);
  return c;
}

// ---------- escenarios ----------

function main() {
  const { ctx, datos } = cargar();
  const calcular = ctx.calcular;
  const datosBase = () => ({
    inquilinos: ctx.leerHoja('inquilinos'),
    servicios: ctx.leerHoja('servicios'),
    serviciosInquilinos: ctx.leerHoja('servicios_inquilinos'),
    cobros: ctx.leerHoja('cobros'),
    pagos: ctx.leerHoja('pagos'),
    asignaciones: ctx.leerHoja('asignaciones'),
  });

  function ponerHoja(nombre, filas) {
    const columnas = ctx.HOJAS[nombre];
    datos[nombre] = [columnas.slice()];
    filas.forEach((f) => {
      const row = columnas.map((c) => ctx.serializar(c, f));
      datos[nombre].push(row);
    });
  }

  const inq = (id, nombre, habilitado, cuartos, personas, ing = '2024-01-01', salida = null) => ({
    id, nombre, celular: '0', fechaIngreso: ing, fechaSalida: salida, habilitado,
    habitaciones: cuartos, personas,
  });
  const svc = (id, nombre, metodoPago, unidad = '', extras = []) => ({
    id, nombre, unidadMedida: unidad, metodoPago, extras,
  });
  const factura = (id, servicioId, periodo, montoBs) => ({
    id, inquilinoId: null, servicioId, periodo, fechaPago: '2026-08-05', montoBs, observacion: 'factura',
  });
  const asig = (periodo, inquilinoId, servicioId, activo, extras = {}) => ({
    id: periodo + '-' + inquilinoId + '-' + servicioId, periodo, inquilinoId, servicioId, activo,
    extras,
  });

  // Escenario 1: reparto por personas (sin extras), base = factura del mes
  ponerHoja('inquilinos', [inq('inq-a', 'Ana', true, 1, 1), inq('inq-b', 'Beto', true, 2, 3)]);
  ponerHoja('servicios', [svc('svc-agua', 'Agua', 'PERSONAS', 'm3')]);
  ponerHoja('servicios_inquilinos', []);
  ponerHoja('asignaciones', [
    asig('2026-08', 'inq-a', 'svc-agua', true),
    asig('2026-08', 'inq-b', 'svc-agua', true),
  ]);
  ponerHoja('cobros', []);
  ponerHoja('pagos', [factura('f-1', 'svc-agua', '2026-08', 120)]);

  let cobros = calcular('2026-08', datosBase());
  igual(cobros.length, 2, 'E1: cantidad');
  igual(cobroDe(cobros, 'inq-a').montoBase, 30, 'E1: base Ana');
  igual(cobroDe(cobros, 'inq-b').montoBase, 90, 'E1: base Beto');
  igual(cobros.reduce((a, c) => a + c.montoTotal, 0), 120, 'E1: suma');

  // Escenario 2: cuartos + extras dinamicos
  ponerHoja('servicios', [svc('svc-luz', 'Luz', 'CUARTOS', 'kWh', ['Refrigerador', 'Ducha', 'Luz pasillo', 'Herramienta', 'Plancha'])]);
  const sAna = asig('2026-08', 'inq-a', 'svc-luz', true, {
    Refrigerador: 1, Ducha: 1, 'Luz pasillo': 1, Plancha: 1,
  });
  const sBeto = asig('2026-08', 'inq-b', 'svc-luz', true, {
    Refrigerador: 2, Herramienta: 3,
  });
  ponerHoja('asignaciones', [sAna, sBeto]);
  ponerHoja('pagos', [factura('f-2', 'svc-luz', '2026-08', 200)]);
  datos.inquilinos[2][6] = 3;

  cobros = calcular('2026-08', datosBase());
  // Ana: factor 1 cuarto + 1 refri + 1 ducha + 1 luzPasillo + 1 plancha = 5.
  // Beto: 3 cuartos + 2 refri + 3 herramientas = 8. Total 13 sobre 200.
  igual(cobroDe(cobros, 'inq-a').montoBase, 76.92, 'E2: base Ana');
  igual(cobroDe(cobros, 'inq-a').montoExtra, 0, 'E2: extra Ana');
  igual(cobroDe(cobros, 'inq-a').montoTotal, 76.92, 'E2: total Ana');
  igual(cobroDe(cobros, 'inq-a').extras.Pancha, undefined, 'E2: plancha en extras');
  igual(cobroDe(cobros, 'inq-a').extras.Plancha, 1, 'E2: Plancha Ana');
  igual(cobroDe(cobros, 'inq-b').montoBase, 123.08, 'E2: base Beto');
  igual(cobroDe(cobros, 'inq-b').montoExtra, 0, 'E2: extra Beto');
  igual(cobroDe(cobros, 'inq-b').montoTotal, 123.08, 'E2: total Beto');
  igual(cobros.reduce((a, c) => a + c.montoTotal, 0), 200, 'E2: suma');
  igual(cobroDe(cobros, 'inq-a').peso, 5, 'E2: peso Ana');
  igual(cobroDe(cobros, 'inq-a').pesoTotal, 13, 'E2: pesoTotal');

  // Escenario 3: deshabilitado y fuera de periodo
  const activo = inq('inq-a', 'Ana', true, 1, 2);
  const borrado = inq('inq-d', 'Dany', false, 1, 2);
  const salio = inq('inq-s', 'Sapo', true, 1, 2, '2026-01-01', '2026-05-31');
  ponerHoja('inquilinos', [activo, borrado, salio]);
  ponerHoja('servicios', [svc('svc-agua', 'Agua', 'PERSONAS', 'm3')]);
  ponerHoja('asignaciones', [
    asig('2026-08', 'inq-a', 'svc-agua', true),
    asig('2026-08', 'inq-d', 'svc-agua', true),
    asig('2026-08', 'inq-s', 'svc-agua', true),
  ]);
  ponerHoja('pagos', [factura('f-3', 'svc-agua', '2026-08', 120)]);
  ponerHoja('cobros', []);

  cobros = calcular('2026-08', datosBase());
  igual(cobros.length, 1, 'E3: cantidad');
  igual(cobros[0].inquilinoId, 'inq-a', 'E3: solo activo');
  igual(cobros[0].montoTotal, 120, 'E3: total');

  // Escenario 4: redondeo 100/3
  ponerHoja('inquilinos', [inq('inq-a', 'Ana', true, 1, 1), inq('inq-b', 'Beto', true, 1, 1), inq('inq-c', 'Carl', true, 1, 1)]);
  ponerHoja('servicios', [svc('svc-luz', 'Luz', 'CUARTOS', 'kWh')]);
  ponerHoja('asignaciones', [
    asig('2026-08', 'inq-a', 'svc-luz', true),
    asig('2026-08', 'inq-b', 'svc-luz', true),
    asig('2026-08', 'inq-c', 'svc-luz', true),
  ]);
  ponerHoja('pagos', [factura('f-4', 'svc-luz', '2026-08', 100)]);

  cobros = calcular('2026-08', datosBase());
  igual(cobros.length, 3, 'E4: cantidad');
  igual(cobros.reduce((a, c) => a + c.montoTotal, 0), 100, 'E4: suma == costo');

  // Escenario 5: servicio SIN factura registrada del mes -> no se generan cobros
  ponerHoja('inquilinos', [inq('inq-a', 'Ana', true, 1, 1)]);
  ponerHoja('servicios', [svc('svc-garage', 'Garage', 'CUARTOS', '')]);
  ponerHoja('asignaciones', [asig('2026-08', 'inq-a', 'svc-garage', true)]);
  ponerHoja('pagos', []);
  ponerHoja('cobros', []);

  const cobrosSinFactura = calcular('2026-08', datosBase());
  igual(cobrosSinFactura.length, 0, 'E5: sin factura no genera cobros');

  // Reporte mensual con un pago
  ponerHoja('cobros', cobros.map((c) => Object.assign({}, c)));
  ponerHoja('pagos', [{ id: 'pg-1', inquilinoId: 'inq-a', servicioId: 'svc-luz', periodo: '2026-08', fechaPago: '2026-08-10', montoBs: 34, observacion: '' }]);
  const rMensual = ctx.reporteMensual('2026-08', datosBase());
  igual(rMensual.totalCobrado, 100, 'R1: cobrado');
  igual(rMensual.totalPagado, 34, 'R1: pagado');
  igual(rMensual.saldo, 66, 'R1: saldo');
  const fAna = rMensual.detalle.find((f) => f.inquilinoId === 'inq-a');
  igual(fAna.pagado, 34, 'R1: pagado detalle Ana');
  igual(fAna.montoTotal, 33.34, 'R1: total detalle Ana (recibe el ajuste)');
  igual(fAna.saldo, -0.66, 'R1: saldo detalle Ana');
  igual(fAna.extras.Plancha, undefined, 'R1: Plancha en detalle = undefined');
  const rGeneral = ctx.reporteGeneral(datosBase());
  igual(rGeneral.totalCobrado, 100, 'R2: general cobrado');
  igual(rGeneral.totalPagado, 34, 'R2: general pagado');

  // Facturas: base del reparto + excluidas de "pagado"
  ponerHoja('inquilinos', [inq('inq-a', 'Ana', true, 1, 1), inq('inq-b', 'Beto', true, 1, 1)]);
  ponerHoja('servicios', [svc('svc-luz', 'Luz', 'CUARTOS', 'kWh')]);
  ponerHoja('asignaciones', [
    asig('2026-08', 'inq-a', 'svc-luz', true),
    asig('2026-08', 'inq-b', 'svc-luz', true),
  ]);
  ponerHoja('pagos', [
    factura('fa-1', 'svc-luz', '2026-08', 80),
    factura('fa-2', 'svc-luz', '2026-08', 40),
    { id: 'pg-ab', inquilinoId: 'inq-a', servicioId: 'svc-luz', periodo: '2026-08', fechaPago: '2026-08-10', montoBs: 50, observacion: '' },
  ]);
  cobros = calcular('2026-08', datosBase());
  igual(cobros.length, 2, 'F1: cantidad');
  igual(cobroDe(cobros, 'inq-a').montoBase, 60, 'F2: base = suma de facturas (120/2)');
  igual(cobroDe(cobros, 'inq-b').montoBase, 60, 'F3: base Beto');
  ponerHoja('cobros', cobros.map((c) => Object.assign({}, c)));
  const rF = ctx.reporteMensual('2026-08', datosBase());
  igual(rF.totalCobrado, 120, 'F4: cobrado = facturas');
  igual(rF.totalPagado, 50, 'F5: pagado excluye facturas');
  igual(rF.detalle.find((f) => f.inquilinoId === 'inq-a').pagado, 50, 'F6: pagado detalle = abono');
  igual(rF.detalle.find((f) => f.inquilinoId === 'inq-a').saldo, 10, 'F7: saldo detalle');

  // registrarPago permite factura (inquilinoId null) y exige servicio
  let fr = JSON.parse(ctx.doPost({ parameter: { action: 'pagos.crear' }, postData: { contents: JSON.stringify({ inquilinoId: null, servicioId: 'svc-luz', periodo: '2026-09', montoBs: 25, cantidad: 12, unidadMedida: 'kWh' }) } }).getContent());
  igual(fr.ok, true, 'F8: crear factura ok');
  igual(fr.data.inquilinoId, null, 'F9: factura sin inquilino');
  igual(fr.data.cantidad, 12, 'F8b: cantidad persistida');
  igual(fr.data.unidadMedida, 'kWh', 'F8c: unidad persistida');
  fr = JSON.parse(ctx.doPost({ parameter: { action: 'pagos.crear' }, postData: { contents: JSON.stringify({ inquilinoId: null, servicioId: null, periodo: '2026-09', montoBs: 25 }) } }).getContent());
  igual(fr.ok, false, 'F10: factura sin servicio rechazada');

  // Factura duplicada (mismo servicio + periodo) rechazada
  fr = JSON.parse(ctx.doPost({ parameter: { action: 'pagos.crear' }, postData: { contents: JSON.stringify({ inquilinoId: null, servicioId: 'svc-luz', periodo: '2026-09', montoBs: 80 }) } }).getContent());
  igual(fr.ok, false, 'F11: factura duplicada rechazada');

  // Duplicidad de servicios por nombre (sin distinguir mayusculas)
  const s1 = ctx.crearServicio({ nombre: 'Gas', metodoPago: 'CUARTOS', extras: [] });
  igual(s1.id.startsWith('svc-'), true, 'V1: servicio creado');
  let e1 = false;
  try { ctx.crearServicio({ nombre: 'gas', metodoPago: 'CUARTOS', extras: [] }); } catch (err) { e1 = true; }
  igual(e1, true, 'V2: duplicado rechazado');
  let e2 = false;
  try { ctx.actualizarServicio('svc-otro', { nombre: 'GAS', metodoPago: 'CUARTOS', extras: [] }); } catch (err) { e2 = true; }
  igual(e2, true, 'V3: rechaza al renombrar a un nombre de otro servicio');
  const okSelf = ctx.actualizarServicio(s1.id, { nombre: 'GAS', metodoPago: 'PERSONAS', extras: [] });
  igual(okSelf.nombre, 'GAS', 'V4: mismo nombre permitido al editar el propio');
  ctx.borrar('servicios', s1.id);

  // CRUD round-trip a traves de la hoja
  const creado = ctx.crearInquilino({ nombre: 'Prueba', celular: '1', habilitado: true, habitaciones: 1, personas: 1 });
  igual(creado.id.startsWith('inq-'), true, 'C1: id generado');
  let leidos = ctx.leerHoja('inquilinos').filter((x) => x.id === creado.id);
  igual(leidos.length, 1, 'C2: persistido');
  igual(leidos[0].nombre, 'Prueba', 'C3: nombre');
  ctx.borrar('inquilinos', creado.id);
  leidos = ctx.leerHoja('inquilinos').filter((x) => x.id === creado.id);
  igual(leidos.length, 0, 'C4: borrado');

  // parsePeriodo + activoEn
  const p = ctx.parsePeriodo('2026-02');
  igual(p.inicio, '2026-02-01', 'P1: inicio');
  igual(p.fin, '2026-02-28', 'P2: fin bisiesto?');
  const pB = ctx.parsePeriodo('2028-02');
  igual(pB.fin, '2028-02-29', 'P3: fin bisiesto');
  const pD = ctx.parsePeriodo('2026-12');
  igual(pD.fin, '2026-12-31', 'P4: fin diciembre');

  // ---- Dispatcher HTTP (doGet / doPost) ----
  const bodyDe = (out) => JSON.parse(out.getContent());

  let r = bodyDe(ctx.doGet({ parameter: { action: 'snapshot' } }));
   igual(r.ok, true, 'D1: snapshot ok');
  igual(Array.isArray(r.data.serviciosInquilinos), true, 'D2: snapshot camelCase');
  igual(Array.isArray(r.data.servicios_inquilinos), true, 'D3: snapshot alias snake_case');
  igual(Array.isArray(r.data.asignaciones), true, 'D4: snapshot asignaciones');
  igual(r.data.fuente, 'google', 'D5: fuente');

  r = bodyDe(ctx.doGet({ parameter: { action: 'sync' } }));
  igual(r.ok, true, 'D5: sync ok');
  igual(Array.isArray(r.data.snapshot.inquilinos), true, 'D6: sync.snapshot');
  igual(r.data.info.google, true, 'D7: sync.info.google');
  igual(r.data.info.fuente, 'google', 'D8: sync.info.fuente');

  r = bodyDe(ctx.doGet({ parameter: { action: 'reporte.mensual', periodo: '2026-08' } }));
  igual(r.ok, true, 'D9: reporte.mensual ok');
  igual(r.data.periodo, '2026-08', 'D10: periodo');

  r = bodyDe(ctx.doGet({ parameter: { action: 'noexiste' } }));
  igual(r.ok, false, 'D11: accion desconocida');

  r = bodyDe(ctx.doPost({ parameter: { action: 'inquilinos.crear' }, postData: { contents: JSON.stringify({ nombre: 'Api Test', habilitado: true, habitaciones: 2, personas: 3 }) } }));
  igual(r.ok, true, 'D12: crear ok');
  igual(r.data.id.startsWith('inq-'), true, 'D13: id creado');
  igual(r.data.fechaIngreso !== undefined, true, 'D14: fechaIngreso por defecto');
  const idCreadoApi = r.data.id;

  r = bodyDe(ctx.doPost({ parameter: { action: 'cobros.generar', periodo: '2026-08' } }));
  igual(r.ok, true, 'D15: cobros.generar ok');
  igual(Array.isArray(r.data), true, 'D16: devuelve lista');
  const persistidos = ctx.leerHoja('cobros').filter((c) => c.periodo === '2026-08');
  igual(persistidos.length, r.data.length, 'D17: cobros persistidos');

  // asignaciones.guardar / eliminar
  r = bodyDe(ctx.doPost({ parameter: { action: 'asignaciones.guardar' }, postData: { contents: JSON.stringify({ periodo: '2026-08', inquilinoId: 'inq-a', servicioId: 'svc-luz', activo: true, extras: { Refrigerador: 2, Plancha: 1 } }) } }));
  igual(r.ok, true, 'D18: asignaciones.guardar ok');
  igual(r.data.id, '2026-08-inq-a-svc-luz', 'D19: id compuesto');
  igual(ctx.leerHoja('asignaciones').filter((a) => a.id === '2026-08-inq-a-svc-luz').length, 1, 'D20: persistida');
  r = bodyDe(ctx.doPost({ parameter: { action: 'asignaciones.eliminar', id: '2026-08-inq-a-svc-luz' } }));
  igual(r.ok, true, 'D21: asignaciones.eliminar ok');
  igual(ctx.leerHoja('asignaciones').filter((a) => a.id === '2026-08-inq-a-svc-luz').length, 0, 'D22: borrada');

  r = bodyDe(ctx.doPost({ parameter: {}, postData: { contents: JSON.stringify({ action: 'upsert', sheet: 'inquilinos', row: { id: 'x-1', nombre: 'Viejo' } }) } }));
  igual(r.ok, true, 'D23: API interna upsert ok');

  r = bodyDe(ctx.doPost({ parameter: {}, postData: { contents: JSON.stringify({ action: 'delete', sheet: 'inquilinos', id: 'x-1' }) } }));
  igual(r.ok, true, 'D24: API interna delete ok');

  // ---- Normalizacion de periodo ----
  igual(ctx.normalizar('periodo', '2026-04'), '2026-04', 'N1: string YYYY-MM');
  igual(ctx.normalizar('periodo', '2026-04-05'), '2026-04', 'N2: con dia');
  igual(ctx.normalizar('periodo', 'Wed Apr 01 2026 00:00:00 GMT-0400 (hora de Bolivia)'), '2026-04', 'N3: Date.toString');
  igual(ctx.normalizar('periodo', new Date(Date.UTC(2026, 3, 1))), '2026-04', 'N4: objeto Date UTC');
  igual(ctx.normalizar('periodo', ''), null, 'N5: vacio -> null');
  igual(ctx.serializar('periodo', { periodo: new Date(Date.UTC(2026, 3, 1)) }), '2026-04', 'N6: serializar Date -> YYYY-MM');
  igual(ctx.serializar('periodo', { periodo: '2026-04-05' }), '2026-04', 'N7: serializar con dia');

  // Round-trip: celda de hoja con Date -> leerHoja devuelve periodo YYYY-MM
  const colsP = ctx.HOJAS.pagos;
  const filaP = { id: 'pg-z1', inquilinoId: null, servicioId: 'svc-luz', periodo: '2026-04', fechaPago: '2026-04-10', montoBs: 100, cantidad: null, unidadMedida: null, observacion: '' };
  const filaCelda = colsP.map((c) => (c === 'periodo' ? new Date(Date.UTC(2026, 3, 1)) : ctx.serializar(c, filaP)));
  datos.pagos = [colsP.slice(), filaCelda];
  const leidosP = ctx.leerHoja('pagos');
  igual(leidosP.length, 1, 'N8: lee fila factura');
  igual(leidosP[0].periodo, '2026-04', 'N9: periodo normalizado');
  igual(leidosP[0].inquilinoId, null, 'N10: factura (sin inquilino)');
  igual(leidosP[0].montoBs, 100, 'N11: monto');
  igual(leidosP[0].fechaPago, '2026-04-10', 'N12: fechaPago');

  // Edicion de factura
  ctx.upsert('pagos', { id: 'pg-edit', inquilinoId: null, servicioId: 'svc-luz', periodo: '2026-04', fechaPago: '2026-04-01', montoBs: 100, cantidad: null, unidadMedida: null, observacion: '' });
  const editado = ctx.registrarPago({ id: 'pg-edit', inquilinoId: null, servicioId: 'svc-luz', periodo: '2026-04', fechaPago: '2026-04-15', montoBs: 150, cantidad: null, unidadMedida: null, observacion: 'corregido' });
  igual(editado.id, 'pg-edit', 'E1: conserva id al editar');
  igual(ctx.leerHoja('pagos').filter((x) => x.id === 'pg-edit').length, 1, 'E2: reemplaza sin duplicar');
  igual(ctx.leerHoja('pagos').find((x) => x.id === 'pg-edit').montoBs, 150, 'E3: monto actualizado');
  ctx.borrar('pagos', 'pg-edit');

  // ---- Generar cobros POR SERVICIO ----
  ctx.upsert('inquilinos', { id: 'inq-a', nombre: 'Ana', celular: '', fechaIngreso: '2024-01-01', fechaSalida: null, habilitado: true, habitaciones: 1, personas: 1 });
  ctx.upsert('inquilinos', { id: 'inq-b', nombre: 'Beto', celular: '', fechaIngreso: '2024-01-01', fechaSalida: null, habilitado: true, habitaciones: 3, personas: 2 });
  ctx.upsert('servicios', { id: 'svc-luz', nombre: 'Luz', unidadMedida: 'kWh', metodoPago: 'CUARTOS', extras: [] });
  ctx.upsert('servicios', { id: 'svc-agua', nombre: 'Agua', unidadMedida: 'm3', metodoPago: 'PERSONAS', extras: [] });
  const asigG = (per, inq, svc) => ({
    id: per + '-' + inq + '-' + svc, periodo: per, inquilinoId: inq, servicioId: svc, activo: true,
    extras: {},
  });
  ctx.upsert('asignaciones', asigG('2026-08', 'inq-a', 'svc-luz'));
  ctx.upsert('asignaciones', asigG('2026-08', 'inq-b', 'svc-luz'));
  ctx.upsert('asignaciones', asigG('2026-08', 'inq-b', 'svc-agua'));
  ctx.upsert('pagos', { id: 'pg-l', inquilinoId: null, servicioId: 'svc-luz', periodo: '2026-08', fechaPago: '2026-08-05', montoBs: 100, cantidad: null, unidadMedida: null, observacion: '' });
  ctx.upsert('pagos', { id: 'pg-ag', inquilinoId: null, servicioId: 'svc-agua', periodo: '2026-08', fechaPago: '2026-08-05', montoBs: 60, cantidad: null, unidadMedida: null, observacion: '' });

  ctx.generarCobros('2026-08');
  igual(ctx.leerHoja('cobros').length, 3, 'G1: al generar todo quedan 3 lineas');

  // Ana agrega un refrigerador SOLO al servicio Luz -> factor 2 (1 cuarto + 1 refri)
  ctx.upsert('asignaciones', { ...asigG('2026-08', 'inq-a', 'svc-luz'), extras: { Refrigerador: 1 } });
  const filasLuz = ctx.generarCobrosServicio('2026-08', 'svc-luz');
  igual(filasLuz.length, 2, 'G2: regenera solo Luz');
  const cobrosG = ctx.leerHoja('cobros');
  igual(cobrosG.length, 3, 'G3: conserva Agua del mismo mes');
  const luzAna = cobrosG.find((c) => c.inquilinoId === 'inq-a' && c.servicioId === 'svc-luz');
  const aguaBeto = cobrosG.find((c) => c.servicioId === 'svc-agua');
  igual(luzAna.montoExtra, 0, 'G4: sin extras en dinero');
  igual(luzAna.montoTotal, 40, 'G5: 100 * 2/5 (factor 2 de Ana)');
  igual(aguaBeto.montoTotal, 60, 'G6: Agua intacta');

  // Ajuste manual del factor de reparto (peso)
  let rPeso = bodyDe(ctx.doPost({
    parameter: { action: 'cobros.editarPeso', periodo: '2026-08', servicioId: 'svc-luz' },
    postData: { contents: JSON.stringify({ pesos: { 'inq-a': 1, 'inq-b': 1 } }) },
  }));
  igual(rPeso.ok, true, 'P1: reajuste devuelve ok');
  igual(rPeso.data.length, 2, 'P2: reajusta 2 lineas');
  const luzAjustada = ctx.leerHoja('cobros').find((c) => c.servicioId === 'svc-luz' && c.inquilinoId === 'inq-a');
  igual(luzAjustada.peso, 1, 'P3: peso actualizado');
  igual(luzAjustada.montoTotal, 50, 'P4: reparto 100/2');
  const aguaSigue = ctx.leerHoja('cobros').find((c) => c.servicioId === 'svc-agua');
  igual(aguaSigue.montoTotal, 60, 'P5: otro servicio intacto');

  // Con un abono del mes el servicio queda bloqueado
  ctx.upsert('pagos', { id: 'pg-abono', inquilinoId: 'inq-a', servicioId: 'svc-luz', periodo: '2026-08', fechaPago: '2026-08-20', montoBs: 50, cantidad: null, unidadMedida: null, observacion: '' });
  let rBloqueo = bodyDe(ctx.doPost({
    parameter: { action: 'cobros.editarPeso', periodo: '2026-08', servicioId: 'svc-luz' },
    postData: { contents: JSON.stringify({ pesos: { 'inq-a': 2, 'inq-b': 1 } }) },
  }));
  igual(rBloqueo.ok, false, 'P6: bloqueado con abono');
  igual(rBloqueo.error.indexOf('ya tiene pagos') >= 0, true, 'P7: error indica pago existente');
  const luzPost = ctx.leerHoja('cobros').find((c) => c.servicioId === 'svc-luz' && c.inquilinoId === 'inq-a');
  igual(luzPost.montoTotal, 50, 'P8: sin cambios al estar bloqueado');
  ctx.borrar('pagos', 'pg-abono');

  // Limpieza
  ctx.borrar('servicios', 'svc-luz');
  ctx.borrar('servicios', 'svc-agua');
  ctx.borrar('inquilinos', 'inq-a');
  ctx.borrar('inquilinos', 'inq-b');
  ctx.borrar('pagos', 'pg-l');
  ctx.borrar('pagos', 'pg-ag');
  ctx.borrar('inquilinos', idCreadoApi);
  ctx.borrar('inquilinos', 'x-1');

  console.log(`OK: ${pasadas} verificaciones pasaron`);
}

main();
