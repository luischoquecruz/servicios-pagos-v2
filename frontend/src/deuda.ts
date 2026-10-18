import type { Cobro, Pago } from './types';
import { ALQUILER_ID } from './utils';

export interface FilaDeuda {
  periodo: string;
  cobrado: number;
  pagado: number;
  saldo: number;
}

export interface DeudaConceptos {
  mensual: FilaDeuda[];
  claves: string[];
  filas: Array<{ periodo: string; celdas: Map<string, { cobrado: number; pagado: number }> }>;
  alquiler: { cobrado: number; pagado: number; saldo: number };
  servicios: { cobrado: number; pagado: number; saldo: number };
  /**
   * Por mes y concepto: lo cobrado y lo pagado aplicado a ese concepto. Los pagos
   * "en general" se reparten entre los conceptos del mes en proporcion a lo que
   * cada uno tenia pendiente. Permite armar reportes solo de algunos conceptos.
   */
  detalleMes: Map<string, Map<string, { cobrado: number; pagado: number }>>;
}

/**
 * Deuda por periodo de un inquilino. Cada pago se aplica primero al periodo que
 * indica (si ese mes tiene saldo) y el sobrante a la deuda más antigua, igual
 * que la simulación; así, pagar servicios o alquiler de meses anteriores liquida
 * esos meses en vez de quedar colgado en el mes del cobro.
 */
export function calcularDeudaPorConcepto(
  inquilinoId: string,
  cobros: Cobro[],
  pagos: Pago[],
): DeudaConceptos {
  const cobs = cobros.filter((c) => c.inquilinoId === inquilinoId);
  const pags = pagos.filter((p) => p.inquilinoId === inquilinoId);

  const cobroConceptoMes = new Map<string, Map<string, number>>();
  const cobroConcepto = new Map<string, number>();
  const combinado = new Map<string, number>();
  for (const c of cobs) {
    let m = cobroConceptoMes.get(c.servicioId);
    if (!m) {
      m = new Map();
      cobroConceptoMes.set(c.servicioId, m);
    }
    m.set(c.periodo, (m.get(c.periodo) ?? 0) + (c.montoTotal || 0));
    cobroConcepto.set(c.servicioId, (cobroConcepto.get(c.servicioId) ?? 0) + (c.montoTotal || 0));
    combinado.set(c.periodo, (combinado.get(c.periodo) ?? 0) + (c.montoTotal || 0));
  }

  const pagadoMes = new Map<string, number>();
  const pagadoConceptoMes = new Map<string, Map<string, number>>();
  const pagadoGeneralMes = new Map<string, number>();

  const etiquetados = new Map<string, Pago[]>();
  const generales: Pago[] = [];
  for (const p of pags) {
    if (p.servicioId) {
      const arr = etiquetados.get(p.servicioId) ?? [];
      arr.push(p);
      etiquetados.set(p.servicioId, arr);
    } else {
      generales.push(p);
    }
  }
  const orden = (a: Pago, b: Pago) => (a.fechaPago ?? '').localeCompare(b.fechaPago ?? '');

  /** Aplica pagos a una vista de saldos: primero al periodo del pago, luego al más antiguo. */
  const aplicarPagos = (
    lista: Pago[],
    periodos: string[],
    saldoDe: (periodo: string) => number,
    registrar: (periodo: string, monto: number) => void,
  ) => {
    const antiguos = [...periodos].sort();
    for (const p of [...lista].sort(orden)) {
      let rest = p.montoBs || 0;
      if (rest <= 0) continue;
      const pagarEn = (periodo: string) => {
        if (rest <= 0) return;
        const saldo = Math.max(0, saldoDe(periodo));
        if (saldo <= 0) return;
        const x = Math.min(rest, saldo);
        registrar(periodo, x);
        rest -= x;
      };
      if (p.periodo && periodos.includes(p.periodo)) pagarEn(p.periodo);
      for (const periodo of antiguos) {
        if (rest <= 0) break;
        pagarEn(periodo);
      }
    }
  };

  // Pagos etiquetados → saldan la deuda de su propio concepto.
  for (const [conceptoId, mensualConc] of cobroConceptoMes) {
    let archivo = pagadoConceptoMes.get(conceptoId);
    if (!archivo) {
      archivo = new Map();
      pagadoConceptoMes.set(conceptoId, archivo);
    }
    aplicarPagos(
      etiquetados.get(conceptoId) ?? [],
      [...mensualConc.keys()],
      (periodo) => (mensualConc.get(periodo) ?? 0) - (archivo!.get(periodo) ?? 0),
      (periodo, monto) => {
        archivo!.set(periodo, (archivo!.get(periodo) ?? 0) + monto);
        pagadoMes.set(periodo, (pagadoMes.get(periodo) ?? 0) + monto);
      },
    );
  }

  // Pagos "en general" → saldan el mes más antiguo de la deuda combinada.
  if (generales.length > 0) {
    aplicarPagos(
      generales,
      [...combinado.keys()],
      (periodo) => (combinado.get(periodo) ?? 0) - (pagadoMes.get(periodo) ?? 0),
      (periodo, monto) => {
        pagadoGeneralMes.set(periodo, (pagadoGeneralMes.get(periodo) ?? 0) + monto);
        pagadoMes.set(periodo, (pagadoMes.get(periodo) ?? 0) + monto);
      },
    );
  }

  // Saldo neto por concepto y reparto proporcional de los pagos generales.
  const saldoConcepto = new Map<string, number>();
  for (const [conceptoId, mensualConc] of cobroConceptoMes) {
    let total = 0;
    for (const [periodo, cobrado] of mensualConc) {
      total += cobrado - (pagadoConceptoMes.get(conceptoId)?.get(periodo) ?? 0);
    }
    saldoConcepto.set(conceptoId, total);
  }
  for (const [periodo, gen] of pagadoGeneralMes) {
    const base = new Map<string, number>();
    let suma = 0;
    for (const [conceptoId, mensualConc] of cobroConceptoMes) {
      const s = Math.max(
        0,
        (mensualConc.get(periodo) ?? 0) - (pagadoConceptoMes.get(conceptoId)?.get(periodo) ?? 0),
      );
      base.set(conceptoId, s);
      suma += s;
    }
    if (suma <= 0) continue;
    for (const [conceptoId, s] of base) {
      if (s <= 0) continue;
      saldoConcepto.set(conceptoId, (saldoConcepto.get(conceptoId) ?? 0) - (gen * s) / suma);
    }
  }

  const detalleMes = new Map<string, Map<string, { cobrado: number; pagado: number }>>();
  for (const [conceptoId, mensualConc] of cobroConceptoMes) {
    for (const [periodo, cobrado] of mensualConc) {
      let m = detalleMes.get(periodo);
      if (!m) {
        m = new Map();
        detalleMes.set(periodo, m);
      }
      m.set(conceptoId, { cobrado, pagado: pagadoConceptoMes.get(conceptoId)?.get(periodo) ?? 0 });
    }
  }
  for (const [periodo, gen] of pagadoGeneralMes) {
    const m = detalleMes.get(periodo);
    if (!m) continue;
    let suma = 0;
    for (const c of m.values()) suma += Math.max(0, c.cobrado - c.pagado);
    if (suma <= 0) continue;
    const pendientes = [...m.values()].map((c) => Math.max(0, c.cobrado - c.pagado));
    [...m.values()].forEach((c, i) => {
      c.pagado += (gen * pendientes[i]) / suma;
    });
  }

  const mensual: FilaDeuda[] = [...combinado.keys()]
    .sort()
    .map((periodo) => {
      const cobrado = combinado.get(periodo) ?? 0;
      const pagado = pagadoMes.get(periodo) ?? 0;
      return { periodo, cobrado, pagado, saldo: cobrado - pagado };
    });

  const armarConcepto = (id: string) => {
    const cobrado = cobroConcepto.get(id) ?? 0;
    const saldo = Math.max(0, saldoConcepto.get(id) ?? 0);
    return { cobrado, pagado: cobrado - saldo, saldo };
  };

  let cobradoSvc = 0;
  let saldoSvc = 0;
  for (const [conceptoId] of cobroConcepto) {
    if (conceptoId === ALQUILER_ID) continue;
    cobradoSvc += cobroConcepto.get(conceptoId) ?? 0;
    saldoSvc += Math.max(0, saldoConcepto.get(conceptoId) ?? 0);
  }

  // Historial por mes y concepto usando los montos ASIGNADOS a cada mes.
  const claves: string[] = [];
  if (cobroConceptoMes.has(ALQUILER_ID)) claves.push(ALQUILER_ID);
  for (const k of [...cobroConceptoMes.keys()].sort()) {
    if (k !== ALQUILER_ID) claves.push(k);
  }
  if (generales.length > 0) claves.push('__general__');

  const filas = mensual.map((f) => {
    const celdas = new Map<string, { cobrado: number; pagado: number }>();
    for (const clave of claves) {
      const cobrado =
        clave === '__general__' ? 0 : (cobroConceptoMes.get(clave)?.get(f.periodo) ?? 0);
      const pagado =
        clave === '__general__'
          ? (pagadoGeneralMes.get(f.periodo) ?? 0)
          : (pagadoConceptoMes.get(clave)?.get(f.periodo) ?? 0);
      if (cobrado > 0 || pagado > 0) celdas.set(clave, { cobrado, pagado });
    }
    return { periodo: f.periodo, celdas };
  });

  return {
    mensual,
    claves,
    filas,
    alquiler: armarConcepto(ALQUILER_ID),
    servicios: {
      cobrado: cobradoSvc,
      pagado: cobradoSvc - saldoSvc,
      saldo: saldoSvc,
    },
    detalleMes,
  };
}

/** Simula aplicar un pago monto desde el saldo mas antiguo. Devuelve nuevas filas + saldo restante. */
export function simularPago(filas: FilaDeuda[], monto: number) {
  let restante = monto;
  const resultado = filas.map((f) => {
    if (restante <= 0 || f.saldo <= 0) return { ...f, aplicado: 0 };
    const aplicado = Math.min(restante, f.saldo);
    restante -= aplicado;
    return { ...f, aplicado };
  });
  return { resultado, sobrante: restante };
}

/** Mes en texto corto. */
export function nombreMes(periodo: string): string {
  const [anio, mes] = periodo.split('-');
  const nombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${nombres[parseInt(mes, 10) - 1] ?? mes} ${anio}`;
}

export const PALETA_SERVICIOS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];

/** Color estable por concepto (null = general, alquiler = acento fijo). */
export function colorServicio(svcId: string | null): string {
  if (svcId === null) return '#94a3b8';
  if (svcId === ALQUILER_ID) return '#0f766e';
  let h = 0;
  for (let i = 0; i < svcId.length; i++) h = (h * 31 + svcId.charCodeAt(i)) | 0;
  return PALETA_SERVICIOS[Math.abs(h) % PALETA_SERVICIOS.length];
}