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

// ---------- filtro de conceptos (servicios y alquiler) ----------

/** Conceptos incluidos en un reporte: ids de servicios y/o ALQUILER_ID. */
export type Filtro = Set<string>;

export interface Concepto {
  id: string;
  nombre: string;
}

/** Conceptos posibles: alquiler primero y luego los servicios. */
export function conceptosDe(snap: Snapshot): Concepto[] {
  return [{ id: ALQUILER_ID, nombre: 'Alquiler' }, ...snap.servicios.map((s) => ({ id: s.id, nombre: s.nombre }))];
}

export function filtroCompleto(snap: Snapshot): Filtro {
  return new Set(conceptosDe(snap).map((c) => c.id));
}

/** true si el filtro incluye todos los conceptos (se usan los saldos completos, con saldo a favor). */
export function esCompleto(snap: Snapshot, filtro: Filtro | undefined): boolean {
  return !filtro || conceptosDe(snap).every((c) => filtro.has(c.id));
}

export interface MesFiltrado {
  servicios: number;
  alquiler: number;
  cobrado: number;
  pagado: number;
  saldo: number;
}

/** Cobrado y pagado de un inquilino en un mes, solo con los conceptos del filtro. */
export function mesFiltrado(d: DeudaInquilino, periodo: string, filtro?: Filtro): MesFiltrado {
  let servicios = 0;
  let alquiler = 0;
  let pagado = 0;
  for (const [k, c] of d.deuda.detalleMes.get(periodo) ?? []) {
    if (filtro && !filtro.has(k)) continue;
    if (k === ALQUILER_ID) alquiler += c.cobrado;
    else servicios += c.cobrado;
    pagado += c.pagado;
  }
  const cobrado = servicios + alquiler;
  return { servicios: r2(servicios), alquiler: r2(alquiler), cobrado: r2(cobrado), pagado: r2(pagado), saldo: r2(cobrado - pagado) };
}

/** Saldo de un inquilino con el filtro (con todos los conceptos, incluye saldo a favor). */
export function saldoFiltrado(snap: Snapshot, d: DeudaInquilino, filtro?: Filtro): { saldo: number; meses: string[] } {
  if (esCompleto(snap, filtro)) return { saldo: d.saldo, meses: d.mesesPendientes };
  let saldo = 0;
  const meses: string[] = [];
  for (const periodo of d.deuda.detalleMes.keys()) {
    const m = mesFiltrado(d, periodo, filtro);
    saldo += m.saldo;
    if (m.saldo > CENTAVO) meses.push(periodo);
  }
  return { saldo: r2(saldo), meses: meses.sort() };
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
  servicios: number;
  alquiler: number;
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

export function resumenMes(snap: Snapshot, periodo: string, deudas: Map<string, DeudaInquilino>, filtro?: Filtro): ResumenMes {
  const incluye = (id: string | null | undefined) => !filtro || (id != null && filtro.has(id));
  const cobros = snap.cobros.filter((c) => c.periodo === periodo && incluye(c.servicioId));
  const facturas = snap.pagos.filter((p) => esFactura(p) && p.periodo === periodo && incluye(p.servicioId));
  const abonos = snap.pagos.filter((p) => !esFactura(p) && p.periodo === periodo);

  const porServicio: FilaServicioMes[] = [];
  for (const s of snap.servicios) {
    if (!incluye(s.id)) continue;
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
  let deudaTotal = 0;
  let deudores = 0;
  for (const d of deudas.values()) {
    const m = mesFiltrado(d, periodo, filtro);
    const total = saldoFiltrado(snap, d, filtro);
    if (total.saldo > CENTAVO) {
      deudaTotal += total.saldo;
      deudores++;
    }
    if (m.cobrado <= CENTAVO && total.saldo <= CENTAVO) continue;
    porInquilino.push({
      inquilinoId: d.inquilino.id,
      nombre: d.inquilino.nombre,
      servicios: m.servicios,
      alquiler: m.alquiler,
      cobrado: m.cobrado,
      aplicado: m.pagado,
      pendiente: r2(Math.max(0, m.saldo)),
      saldoTotal: total.saldo,
      mesesPendientes: total.meses.length,
    });
  }
  porInquilino.sort((a, b) => b.pendiente - a.pendiente || b.saldoTotal - a.saldoTotal || a.nombre.localeCompare(b.nombre));

  const suma = (xs: number[]) => r2(xs.reduce((a, b) => a + b, 0));
  const cobrado = suma(porInquilino.map((f) => f.cobrado));
  const aplicado = suma(porInquilino.map((f) => f.aplicado));
  return {
    periodo,
    facturado: suma(facturas.map((f) => toNum(f.montoBs))),
    servicios: suma(porInquilino.map((f) => f.servicios)),
    alquiler: suma(porInquilino.map((f) => f.alquiler)),
    cobrado,
    aplicado,
    pendiente: r2(Math.max(0, cobrado - aplicado)),
    deudaTotal: r2(deudaTotal),
    deudores,
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
  servicios: number;
  alquiler: number;
  cargos: number;
  pagos: Pago[];
  aplicado: number;
  saldoMes: number;
  saldoAcumulado: number;
}

export interface EstadoCuenta {
  inquilino: Inquilino;
  meses: MesCuenta[];
  servicios: number;
  alquiler: number;
  cargos: number;
  pagado: number;
  saldo: number;
  /** false si el reporte excluye algun concepto */
  completo: boolean;
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
  const companeros = snap.cobros.filter((x) => x.periodo === c.periodo && x.servicioId === c.servicioId).length;
  const tuParte = ajustado ? `${peso} (ajustado a mano)` : `${peso} (${partes.join(' + ')})`;
  return (
    `Factura de ${svc?.nombre ?? 'servicio'}: ${fmt(factura)}, repartida en ${total} ` +
    `${total === 1 ? 'parte' : 'partes'} entre ${companeros} inquilino${companeros === 1 ? '' : 's'} ` +
    `(cada parte ${fmt(total > 0 ? factura / total : 0)}). Te corresponden ${tuParte}: ${fmt(factura)} × ${peso}/${total}.`
  );
}

export function estadoCuenta(
  snap: Snapshot,
  inquilinoId: string,
  deudas: Map<string, DeudaInquilino>,
  mapSvc: Map<string, Servicio>,
  filtro?: Filtro,
): EstadoCuenta | null {
  const d = deudas.get(inquilinoId);
  if (!d) return null;
  const completo = esCompleto(snap, filtro);
  const incluye = (id: string | null) => !filtro || id === null || filtro.has(id);
  const cobros = snap.cobros.filter((c) => c.inquilinoId === inquilinoId && incluye(c.servicioId));
  const abonos = snap.pagos.filter((p) => p.inquilinoId === inquilinoId && incluye(p.servicioId));
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
    const m = mesFiltrado(d, periodo, filtro);
    const cargos = r2(lineas.reduce((s, l) => s + l.monto, 0));
    const saldoMes = r2(cargos - m.pagado);
    acumulado = r2(acumulado + saldoMes);
    return {
      periodo,
      lineas,
      servicios: r2(lineas.filter((l) => l.servicioId !== ALQUILER_ID).reduce((s, l) => s + l.monto, 0)),
      alquiler: r2(lineas.filter((l) => l.servicioId === ALQUILER_ID).reduce((s, l) => s + l.monto, 0)),
      cargos,
      pagos: abonos.filter((p) => p.periodo === periodo).sort((a, b) => (a.fechaPago ?? '').localeCompare(b.fechaPago ?? '')),
      aplicado: m.pagado,
      saldoMes,
      saldoAcumulado: acumulado,
    };
  });
  const servicios = r2(meses.reduce((s, m) => s + m.servicios, 0));
  const alquiler = r2(meses.reduce((s, m) => s + m.alquiler, 0));
  const cargos = completo ? d.cargos : r2(servicios + alquiler);
  const pagado = completo ? d.pagado : r2(meses.reduce((s, m) => s + m.aplicado, 0));
  return { inquilino: d.inquilino, meses, servicios, alquiler, cargos, pagado, saldo: completo ? d.saldo : r2(cargos - pagado), completo };
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
  servicios: number;
  alquiler: number;
  cobrado: number;
  aplicado: number;
  pendiente: number;
}

export interface Historial {
  anio: string;
  meses: MesHistorial[];
  servicios: { servicioId: string; nombre: string; porMes: (number | null)[]; total: number }[];
  inquilinos: {
    inquilinoId: string;
    nombre: string;
    porMes: { cobrado: number; saldo: number }[];
    servicios: number;
    alquiler: number;
    cobrado: number;
    saldo: number;
  }[];
  totales: MesHistorial;
}

export function aniosDisponibles(snap: Snapshot): string[] {
  const s = new Set<string>();
  for (const c of snap.cobros) if (c.periodo) s.add(c.periodo.slice(0, 4));
  for (const p of snap.pagos) if (p.periodo) s.add(p.periodo.slice(0, 4));
  s.add(String(new Date().getFullYear()));
  return [...s].sort().reverse();
}

export function historialAnual(snap: Snapshot, anio: string, deudas: Map<string, DeudaInquilino>, filtro?: Filtro): Historial {
  const incluye = (id: string | null | undefined) => !filtro || (id != null && filtro.has(id));
  const periodos = Array.from({ length: 12 }, (_, i) => `${anio}-${String(i + 1).padStart(2, '0')}`);
  const facturas = snap.pagos.filter((p) => esFactura(p) && p.periodo?.startsWith(anio) && incluye(p.servicioId));
  const meses = periodos.map<MesHistorial>((p) => {
    let servicios = 0;
    let alquiler = 0;
    let aplicado = 0;
    for (const d of deudas.values()) {
      const m = mesFiltrado(d, p, filtro);
      servicios += m.servicios;
      alquiler += m.alquiler;
      aplicado += m.pagado;
    }
    const cobrado = servicios + alquiler;
    return {
      periodo: p,
      facturado: r2(facturas.filter((f) => f.periodo === p).reduce((s, f) => s + toNum(f.montoBs), 0)),
      servicios: r2(servicios),
      alquiler: r2(alquiler),
      cobrado: r2(cobrado),
      aplicado: r2(aplicado),
      pendiente: r2(Math.max(0, cobrado - aplicado)),
    };
  });
  const servicios = snap.servicios
    .filter((s) => incluye(s.id))
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
      const ms = periodos.map((p) => mesFiltrado(d, p, filtro));
      return {
        inquilinoId: d.inquilino.id,
        nombre: d.inquilino.nombre,
        porMes: ms.map((m) => ({ cobrado: m.cobrado, saldo: m.saldo })),
        servicios: r2(ms.reduce((a, m) => a + m.servicios, 0)),
        alquiler: r2(ms.reduce((a, m) => a + m.alquiler, 0)),
        cobrado: r2(ms.reduce((a, m) => a + m.cobrado, 0)),
        saldo: r2(ms.reduce((a, m) => a + Math.max(0, m.saldo), 0)),
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
    totales: {
      periodo: anio, facturado: tot('facturado'), servicios: tot('servicios'), alquiler: tot('alquiler'),
      cobrado: tot('cobrado'), aplicado: tot('aplicado'), pendiente: tot('pendiente'),
    },
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

// ---------- reparto de cada servicio (seccion Cobros y reportes) ----------

export interface LineaReparto {
  inquilinoId: string;
  nombre: string;
  peso: number;
  base: number;
  extras: [string, number][];
  monto: number;
  /** el factor no coincide con cuartos/personas + extras guardados: se ajusto a mano */
  ajustado: boolean;
}

export interface RepartoServicio {
  servicioId: string;
  nombre: string;
  porPersonas: boolean;
  factura: number | null;
  pesoTotal: number;
  valorParte: number;
  repartido: number;
  lineas: LineaReparto[];
  /** explicacion de por que cambio el total de partes respecto al mes anterior */
  cambios: { anteriorTotal: number; detalle: string[] } | null;
  /** motivos por los que el reparto ya no coincide con las asignaciones actuales */
  desactualizado: string[];
}

function baseDe(inq: { habitaciones: number; personas: number } | undefined, porPersonas: boolean): number {
  if (!inq) return 0;
  return toNum(porPersonas ? inq.personas : inq.habitaciones);
}

const sumaExtras = (e: Record<string, number> | undefined) =>
  Object.values(e ?? {}).reduce((s, n) => s + Math.max(0, Math.floor(toNum(n))), 0);

export function repartoServicios(snap: Snapshot, periodo: string): RepartoServicio[] {
  const mapInq = new Map(snap.inquilinos.map((i) => [i.id, i]));
  const anterior = periodoAnterior(periodo);
  const out: RepartoServicio[] = [];
  for (const s of snap.servicios) {
    const porPersonas = String(s.metodoPago).toUpperCase() === 'PERSONAS';
    const cobros = snap.cobros.filter((c) => c.periodo === periodo && c.servicioId === s.id);
    const facturas = snap.pagos.filter((p) => esFactura(p) && p.periodo === periodo && p.servicioId === s.id);
    const asig = snap.asignaciones.filter((a) => a.periodo === periodo && a.servicioId === s.id && a.activo);
    if (cobros.length === 0 && facturas.length === 0 && asig.length === 0) continue;

    const factura = facturas.length ? r2(facturas.reduce((a, f) => a + toNum(f.montoBs), 0)) : null;
    const lineas: LineaReparto[] = cobros
      .map((c) => {
        const base = porPersonas ? toNum(c.personas) : toNum(c.habitaciones);
        const extras = Object.entries(c.extras ?? {}).filter(([, n]) => toNum(n) > 0).map(([k, n]) => [k, toNum(n)] as [string, number]);
        const peso = toNum(c.peso);
        return {
          inquilinoId: c.inquilinoId,
          nombre: mapInq.get(c.inquilinoId)?.nombre ?? c.inquilinoId,
          peso,
          base,
          extras,
          monto: r2(toNum(c.montoTotal)),
          ajustado: peso !== base + extras.reduce((a, [, n]) => a + n, 0),
        };
      })
      .sort((a, b) => b.peso - a.peso || a.nombre.localeCompare(b.nombre));
    const pesoTotal = lineas.reduce((a, l) => a + l.peso, 0);
    const repartido = r2(lineas.reduce((a, l) => a + l.monto, 0));

    // Cambios frente al mes anterior
    let cambios: RepartoServicio['cambios'] = null;
    const prev = snap.cobros.filter((c) => c.periodo === anterior && c.servicioId === s.id);
    const prevTotal = prev.reduce((a, c) => a + toNum(c.peso), 0);
    if (prev.length && cobros.length && prevTotal !== pesoTotal) {
      const detalle: string[] = [];
      const ahora = new Map(lineas.map((l) => [l.inquilinoId, l.peso]));
      for (const c of prev) {
        const nombre = mapInq.get(c.inquilinoId)?.nombre ?? c.inquilinoId;
        const p = toNum(c.peso);
        if (!ahora.has(c.inquilinoId)) detalle.push(`${nombre} ya no participa (tenía ${p} ${p === 1 ? 'parte' : 'partes'})`);
        else if (ahora.get(c.inquilinoId) !== p) detalle.push(`${nombre} pasó de ${p} a ${ahora.get(c.inquilinoId)} partes`);
      }
      for (const l of lineas) {
        if (!prev.some((c) => c.inquilinoId === l.inquilinoId)) detalle.push(`${l.nombre} se suma con ${l.peso} ${l.peso === 1 ? 'parte' : 'partes'}`);
      }
      cambios = { anteriorTotal: prevTotal, detalle };
    }

    // ¿El reparto guardado sigue coincidiendo con las asignaciones de hoy?
    const desactualizado: string[] = [];
    if (cobros.length) {
      const esperados = asig.filter((a) => {
        const inq = mapInq.get(a.inquilinoId);
        return inq && activoEn(inq, periodo) && baseDe(inq, porPersonas) + sumaExtras(a.extras) > 0;
      });
      for (const a of esperados) {
        const l = lineas.find((x) => x.inquilinoId === a.inquilinoId);
        const nombre = mapInq.get(a.inquilinoId)?.nombre ?? a.inquilinoId;
        const esperado = baseDe(mapInq.get(a.inquilinoId), porPersonas) + sumaExtras(a.extras);
        if (!l) desactualizado.push(`${nombre} está asignado pero no aparece en el reparto`);
        else if (!l.ajustado && l.peso !== esperado) desactualizado.push(`${nombre}: el reparto usa ${l.peso} partes y hoy le corresponden ${esperado}`);
      }
      for (const l of lineas) {
        if (!esperados.some((a) => a.inquilinoId === l.inquilinoId)) desactualizado.push(`${l.nombre} está en el reparto pero ya no tiene el servicio asignado`);
      }
      if (factura !== null && Math.abs(factura - repartido) > 0.01) desactualizado.push(`lo repartido (Bs ${repartido}) no suma la factura (Bs ${factura})`);
    }

    out.push({
      servicioId: s.id,
      nombre: s.nombre,
      porPersonas,
      factura,
      pesoTotal,
      valorParte: pesoTotal > 0 && factura ? factura / pesoTotal : 0,
      repartido,
      lineas,
      cambios,
      desactualizado,
    });
  }
  return out;
}

/** Inquilinos que vivieron en la casa durante el mes pero no participan en ningun cobro. */
export function fueraDelReparto(snap: Snapshot, periodo: string): { nombre: string; motivo: string }[] {
  const [a, m] = periodo.split('-').map(Number);
  const inicio = `${periodo}-01`;
  const fin = `${periodo}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`;
  const conCobro = new Set(snap.cobros.filter((c) => c.periodo === periodo).map((c) => c.inquilinoId));
  const out: { nombre: string; motivo: string }[] = [];
  for (const i of snap.inquilinos) {
    const ingreso = i.fechaIngreso?.slice(0, 10) ?? '';
    const salida = i.fechaSalida?.slice(0, 10) ?? '';
    const vivio = (!ingreso || ingreso <= fin) && (!salida || salida >= inicio);
    if (!vivio || conCobro.has(i.id)) continue;
    let motivo = 'no tiene servicios asignados este mes';
    if (!i.habilitado) motivo = salida ? `está deshabilitado (salió el ${salida.split('-').reverse().join('/')})` : 'está deshabilitado';
    out.push({ nombre: i.nombre, motivo });
  }
  return out;
}
