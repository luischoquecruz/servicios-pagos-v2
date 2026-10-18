/**
 * Calculos de reportes y panel, hechos en el navegador a partir del snapshot
 * (instantaneos: no esperan al servidor).
 */
import type { Cobro, Inquilino, Pago, Servicio, Snapshot } from '../types';
import { calcularDeudaPorConcepto, nombreMes } from '../deuda';
import type { DeudaConceptos } from '../deuda';
import { ALQUILER_ID, toNum } from '../utils';

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const CENTAVO = 0.005;

export const esFactura = (p: Pago) => !p.inquilinoId;

// ---------- periodos ----------

export function periodoAnterior(p: string): string {
  const [a, m] = p.split('-').map(Number);
  const d = new Date(a, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function periodoSiguiente(p: string): string {
  const [a, m] = p.split('-').map(Number);
  const d = new Date(a, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "octubre 2026" */
export function mesLargo(p: string): string {
  const [a, m] = p.split('-');
  return `${MESES_LARGOS[Number(m) - 1] ?? m} ${a}`;
}

export { nombreMes };

/** True si el inquilino habitaba la casa en el periodo (misma regla que el script). */
export function activoEn(inq: Inquilino, periodo: string): boolean {
  if (!inq.habilitado) return false;
  const [a, m] = periodo.split('-').map(Number);
  const inicio = `${periodo}-01`;
  const fin = `${periodo}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`;
  if (inq.fechaIngreso && inq.fechaIngreso.slice(0, 10) > fin) return false;
  if (inq.fechaSalida && inq.fechaSalida.slice(0, 10) < inicio) return false;
  return true;
}

// ---------- deuda por inquilino ----------

export interface DeudaInquilino {
  inquilino: Inquilino;
  deuda: DeudaConceptos;
  /** cargos - pagos (negativo = saldo a favor) */
  saldo: number;
  /** meses con saldo pendiente */
  mesesPendientes: string[];
  cargos: number;
  pagado: number;
}

export function deudasPorInquilino(snap: Snapshot): Map<string, DeudaInquilino> {
  const out = new Map<string, DeudaInquilino>();
  for (const inq of snap.inquilinos) {
    const deuda = calcularDeudaPorConcepto(inq.id, snap.cobros, snap.pagos);
    const cargos = snap.cobros.filter((c) => c.inquilinoId === inq.id).reduce((s, c) => s + toNum(c.montoTotal), 0);
    const pagado = snap.pagos.filter((p) => p.inquilinoId === inq.id).reduce((s, p) => s + toNum(p.montoBs), 0);
    out.set(inq.id, {
      inquilino: inq,
      deuda,
      cargos: r2(cargos),
      pagado: r2(pagado),
      saldo: r2(cargos - pagado),
      mesesPendientes: deuda.mensual.filter((m) => m.saldo > CENTAVO).map((m) => m.periodo),
    });
  }
  return out;
}

// ---------- resumen del mes ----------

export interface FilaServicioMes {
  servicioId: string;
  nombre: string;
  metodo: string;
  factura: number | null;
  repartido: number;
  inquilinos: number;
  pagado: number;
}

export interface FilaInquilinoMes {
  inquilinoId: string;
  nombre: string;
  cobrado: number;
  aplicado: number;
  pendiente: number;
  saldoTotal: number;
  mesesPendientes: number;
}

export interface ResumenMes {
  periodo: string;
  facturado: number;
  servicios: number;
  alquiler: number;
  cobrado: number;
  aplicado: number;
  pendiente: number;
  deudaTotal: number;
  deudores: number;
  porServicio: FilaServicioMes[];
  porInquilino: FilaInquilinoMes[];
  hayCobros: boolean;
}

export function resumenMes(snap: Snapshot, periodo: string, deudas: Map<string, DeudaInquilino>): ResumenMes {
  const cobros = snap.cobros.filter((c) => c.periodo === periodo);
  const facturas = snap.pagos.filter((p) => esFactura(p) && p.periodo === periodo);
  const abonos = snap.pagos.filter((p) => !esFactura(p) && p.periodo === periodo);

  const porServicio: FilaServicioMes[] = [];
  for (const s of snap.servicios) {
    const fs = facturas.filter((f) => f.servicioId === s.id);
    const cs = cobros.filter((c) => c.servicioId === s.id);
    if (fs.length === 0 && cs.length === 0) continue;
    porServicio.push({
      servicioId: s.id,
      nombre: s.nombre,
      metodo: s.metodoPago,
      factura: fs.length ? r2(fs.reduce((a, f) => a + toNum(f.montoBs), 0)) : null,
      repartido: r2(cs.reduce((a, c) => a + toNum(c.montoTotal), 0)),
      inquilinos: cs.length,
      pagado: r2(abonos.filter((p) => p.servicioId === s.id).reduce((a, p) => a + toNum(p.montoBs), 0)),
    });
  }

  const porInquilino: FilaInquilinoMes[] = [];
  for (const d of deudas.values()) {
    const fila = d.deuda.mensual.find((m) => m.periodo === periodo);
    if (!fila && d.saldo <= CENTAVO) continue;
    porInquilino.push({
      inquilinoId: d.inquilino.id,
      nombre: d.inquilino.nombre,
      cobrado: r2(fila?.cobrado ?? 0),
      aplicado: r2(fila?.pagado ?? 0),
      pendiente: r2(Math.max(0, fila?.saldo ?? 0)),
      saldoTotal: d.saldo,
      mesesPendientes: d.mesesPendientes.length,
    });
  }
  porInquilino.sort((a, b) => b.pendiente - a.pendiente || b.saldoTotal - a.saldoTotal || a.nombre.localeCompare(b.nombre));

  const suma = (xs: number[]) => r2(xs.reduce((a, b) => a + b, 0));
  const alquiler = suma(cobros.filter((c) => c.servicioId === ALQUILER_ID).map((c) => toNum(c.montoTotal)));
  const cobrado = suma(cobros.map((c) => toNum(c.montoTotal)));
  const aplicado = suma(porInquilino.map((f) => f.aplicado));
  const deudores = [...deudas.values()].filter((d) => d.saldo > CENTAVO);
  return {
    periodo,
    facturado: suma(facturas.map((f) => toNum(f.montoBs))),
    servicios: r2(cobrado - alquiler),
    alquiler,
    cobrado,
    aplicado,
    pendiente: r2(Math.max(0, cobrado - aplicado)),
    deudaTotal: suma(deudores.map((d) => d.saldo)),
    deudores: deudores.length,
    porServicio,
    porInquilino,
    hayCobros: cobros.length > 0,
  };
}

// ---------- estado de cuenta ----------

export interface LineaCuenta {
  concepto: string;
  servicioId: string;
  monto: number;
  /** explicacion en lenguaje simple de como se calculo */
  explicacion: string;
}

export interface MesCuenta {
  periodo: string;
  lineas: LineaCuenta[];
  cargos: number;
  pagos: Pago[];
  aplicado: number;
  saldoMes: number;
  saldoAcumulado: number;
}

export interface EstadoCuenta {
  inquilino: Inquilino;
  meses: MesCuenta[];
  cargos: number;
  pagado: number;
  saldo: number;
}

const fmt = (n: number) => 'Bs ' + n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function explicarCobro(c: Cobro, snap: Snapshot, mapSvc: Map<string, Servicio>): string {
  if (c.servicioId === ALQUILER_ID) return 'Alquiler mensual acordado.';
  const svc = mapSvc.get(c.servicioId);
  const factura = snap.pagos
    .filter((p) => esFactura(p) && p.servicioId === c.servicioId && p.periodo === c.periodo)
    .reduce((s, p) => s + toNum(p.montoBs), 0);
  const porPersonas = String(svc?.metodoPago ?? '').toUpperCase() === 'PERSONAS';
  const base = porPersonas ? c.personas : c.habitaciones;
  const extras = Object.entries(c.extras ?? {}).filter(([, n]) => toNum(n) > 0);
  const nExtras = extras.reduce((s, [, n]) => s + toNum(n), 0);
  const partes = [`${base} ${porPersonas ? (base === 1 ? 'persona' : 'personas') : base === 1 ? 'cuarto' : 'cuartos'}`];
  for (const [k, n] of extras) partes.push(`${n} ${k}`);
  const peso = toNum(c.peso);
  const total = toNum(c.pesoTotal);
  const ajustado = peso !== base + nExtras;
  const tuParte = ajustado ? `${peso} (ajustado a mano)` : `${peso} (${partes.join(' + ')})`;
  return (
    `Factura de ${svc?.nombre ?? 'servicio'}: ${fmt(factura)}, repartida entre ${total} ` +
    `${total === 1 ? 'parte' : 'partes'}. Te corresponden ${tuParte}: ${fmt(factura)} × ${peso}/${total}.`
  );
}

export function estadoCuenta(
  snap: Snapshot,
  inquilinoId: string,
  deudas: Map<string, DeudaInquilino>,
  mapSvc: Map<string, Servicio>,
): EstadoCuenta | null {
  const d = deudas.get(inquilinoId);
  if (!d) return null;
  const cobros = snap.cobros.filter((c) => c.inquilinoId === inquilinoId);
  const abonos = snap.pagos.filter((p) => p.inquilinoId === inquilinoId);
  const periodos = [...new Set([...cobros.map((c) => c.periodo), ...abonos.map((p) => p.periodo)])].sort();
  let acumulado = 0;
  const meses: MesCuenta[] = periodos.map((periodo) => {
    const lineas = cobros
      .filter((c) => c.periodo === periodo)
      .sort((a, b) => (a.servicioId === ALQUILER_ID ? -1 : b.servicioId === ALQUILER_ID ? 1 : 0))
      .map<LineaCuenta>((c) => ({
        concepto: c.servicioId === ALQUILER_ID ? 'Alquiler' : (mapSvc.get(c.servicioId)?.nombre ?? c.servicioId),
        servicioId: c.servicioId,
        monto: r2(toNum(c.montoTotal)),
        explicacion: explicarCobro(c, snap, mapSvc),
      }));
    const fila = d.deuda.mensual.find((m) => m.periodo === periodo);
    const cargos = r2(lineas.reduce((s, l) => s + l.monto, 0));
    const aplicado = r2(fila?.pagado ?? 0);
    const saldoMes = r2(cargos - aplicado);
    acumulado = r2(acumulado + saldoMes);
    return {
      periodo,
      lineas,
      cargos,
      pagos: abonos.filter((p) => p.periodo === periodo).sort((a, b) => (a.fechaPago ?? '').localeCompare(b.fechaPago ?? '')),
      aplicado,
      saldoMes,
      saldoAcumulado: acumulado,
    };
  });
  return { inquilino: d.inquilino, meses, cargos: d.cargos, pagado: d.pagado, saldo: d.saldo };
}

/** Texto corto para enviar por WhatsApp. */
export function textoWhatsApp(ec: EstadoCuenta, casa: string): string {
  const pendientes = ec.meses.filter((m) => m.saldoMes > CENTAVO);
  const lineas = [`Hola ${ec.inquilino.nombre}, este es tu estado de cuenta (${casa}):`, ''];
  if (pendientes.length === 0) {
    lineas.push(ec.saldo < -CENTAVO ? `Estás al día y tienes ${fmt(-ec.saldo)} a favor.` : 'Estás al día. ¡Gracias!');
  } else {
    for (const m of pendientes) {
      const detalle = m.lineas.map((l) => `${l.concepto} ${fmt(l.monto)}`).join(', ');
      lineas.push(`• ${mesLargo(m.periodo)}: debes ${fmt(m.saldoMes)} (${detalle}${m.aplicado > 0 ? `; pagaste ${fmt(m.aplicado)}` : ''})`);
    }
    lineas.push('', `Total pendiente: ${fmt(Math.max(0, ec.saldo))}`);
  }
  return lineas.join('\n');
}

export function enlaceWhatsApp(celular: string | null | undefined, texto: string): string {
  let num = String(celular ?? '').replace(/\D/g, '');
  if (num.length === 8) num = '591' + num; // celular boliviano sin codigo de pais
  return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`;
}

// ---------- historial anual ----------

export interface MesHistorial {
  periodo: string;
  facturado: number;
  cobrado: number;
  aplicado: number;
  pendiente: number;
}

export interface Historial {
  anio: string;
  meses: MesHistorial[];
  servicios: { servicioId: string; nombre: string; porMes: (number | null)[]; total: number }[];
  inquilinos: { inquilinoId: string; nombre: string; porMes: { cobrado: number; saldo: number }[]; cobrado: number; saldo: number }[];
  totales: MesHistorial;
}

export function aniosDisponibles(snap: Snapshot): string[] {
  const s = new Set<string>();
  for (const c of snap.cobros) if (c.periodo) s.add(c.periodo.slice(0, 4));
  for (const p of snap.pagos) if (p.periodo) s.add(p.periodo.slice(0, 4));
  s.add(String(new Date().getFullYear()));
  return [...s].sort().reverse();
}

export function historialAnual(snap: Snapshot, anio: string, deudas: Map<string, DeudaInquilino>): Historial {
  const periodos = Array.from({ length: 12 }, (_, i) => `${anio}-${String(i + 1).padStart(2, '0')}`);
  const facturas = snap.pagos.filter((p) => esFactura(p) && p.periodo?.startsWith(anio));
  const meses = periodos.map<MesHistorial>((p) => {
    const cobrado = snap.cobros.filter((c) => c.periodo === p).reduce((s, c) => s + toNum(c.montoTotal), 0);
    let aplicado = 0;
    for (const d of deudas.values()) aplicado += d.deuda.mensual.find((m) => m.periodo === p)?.pagado ?? 0;
    return {
      periodo: p,
      facturado: r2(facturas.filter((f) => f.periodo === p).reduce((s, f) => s + toNum(f.montoBs), 0)),
      cobrado: r2(cobrado),
      aplicado: r2(aplicado),
      pendiente: r2(Math.max(0, cobrado - aplicado)),
    };
  });
  const servicios = snap.servicios
    .map((s) => {
      const porMes = periodos.map((p) => {
        const fs = facturas.filter((f) => f.periodo === p && f.servicioId === s.id);
        return fs.length ? r2(fs.reduce((a, f) => a + toNum(f.montoBs), 0)) : null;
      });
      return { servicioId: s.id, nombre: s.nombre, porMes, total: r2(porMes.reduce<number>((a, v) => a + (v ?? 0), 0)) };
    })
    .filter((s) => s.porMes.some((v) => v !== null));
  const inquilinos = [...deudas.values()]
    .map((d) => {
      const porMes = periodos.map((p) => {
        const m = d.deuda.mensual.find((x) => x.periodo === p);
        return { cobrado: r2(m?.cobrado ?? 0), saldo: r2(m?.saldo ?? 0) };
      });
      return {
        inquilinoId: d.inquilino.id,
        nombre: d.inquilino.nombre,
        porMes,
        cobrado: r2(porMes.reduce((a, v) => a + v.cobrado, 0)),
        saldo: r2(porMes.reduce((a, v) => a + Math.max(0, v.saldo), 0)),
      };
    })
    .filter((i) => i.cobrado > 0)
    .sort((a, b) => b.saldo - a.saldo || a.nombre.localeCompare(b.nombre));
  const tot = (k: keyof Omit<MesHistorial, 'periodo'>) => r2(meses.reduce((a, m) => a + m[k], 0));
  return {
    anio,
    meses,
    servicios,
    inquilinos,
    totales: { periodo: anio, facturado: tot('facturado'), cobrado: tot('cobrado'), aplicado: tot('aplicado'), pendiente: tot('pendiente') },
  };
}

// ---------- tareas pendientes del mes ----------

export interface Tarea {
  id: string;
  texto: string;
  detalle?: string;
  vista: 'facturas' | 'cobros' | 'asignaciones';
}

export function tareasDelMes(snap: Snapshot, periodo: string): Tarea[] {
  const tareas: Tarea[] = [];
  const asig = snap.asignaciones.filter((a) => a.periodo === periodo && a.activo);
  const inqActivos = snap.inquilinos.filter((i) => activoEn(i, periodo));
  if (asig.length === 0 && snap.asignaciones.some((a) => a.periodo === periodoAnterior(periodo))) {
    tareas.push({
      id: 'asig',
      texto: `Asigna los servicios de ${mesLargo(periodo)}`,
      detalle: 'Todavía no hay servicios asignados a los inquilinos este mes.',
      vista: 'asignaciones',
    });
  }
  const sinFactura: string[] = [];
  const sinCobros: string[] = [];
  for (const s of snap.servicios) {
    if (!asig.some((a) => a.servicioId === s.id)) continue;
    const tieneFactura = snap.pagos.some((p) => esFactura(p) && p.servicioId === s.id && p.periodo === periodo && toNum(p.montoBs) > 0);
    const tieneCobros = snap.cobros.some((c) => c.servicioId === s.id && c.periodo === periodo);
    if (!tieneFactura) sinFactura.push(s.nombre);
    else if (!tieneCobros) sinCobros.push(s.nombre);
  }
  if (sinFactura.length) {
    tareas.push({ id: 'fact', texto: `Registra la factura de ${lista(sinFactura)}`, vista: 'facturas' });
  }
  const faltaAlquiler = inqActivos.some(
    (i) => i.cobraAlquiler && toNum(i.alquilerBs) > 0 &&
      !snap.cobros.some((c) => c.inquilinoId === i.id && c.servicioId === ALQUILER_ID && c.periodo === periodo),
  );
  if (sinCobros.length || faltaAlquiler) {
    const que = [...sinCobros, ...(faltaAlquiler ? ['alquiler'] : [])];
    tareas.push({ id: 'cob', texto: `Genera los cobros de ${lista(que)}`, detalle: 'Ya hay datos para calcular cuánto paga cada inquilino.', vista: 'cobros' });
  }
  return tareas;
}

function lista(xs: string[]): string {
  if (xs.length <= 1) return xs.join('');
  return xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1];
}
