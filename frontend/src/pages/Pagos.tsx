import { useState, useMemo } from 'react';
import { useSnapshot } from '../components/SnapshotContext';
import { eliminarPago, registrarPago } from '../api';
import type { Cobro, Pago } from '../types';
import { fmtBs, fmtFecha, hoy, mesActual, nombreServicio, toNum, ALQUILER_ID } from '../utils';
import { Boton } from '../components/ui/Boton';
import { Campo, Fecha, Numero, Seleccion, Texto } from '../components/ui/Campos';
import { Aviso } from '../components/ui/Aviso';
import { Modal } from '../components/ui/Modal';

interface AvisoUi {
  mensaje: string;
  tipo: 'ok' | 'error';
}

interface FilaDeuda {
  periodo: string;
  cobrado: number;
  pagado: number;
  saldo: number;
}

interface DeudaConceptos {
  mensual: FilaDeuda[];
  claves: string[];
  filas: Array<{ periodo: string; celdas: Map<string, { cobrado: number; pagado: number }> }>;
  alquiler: { cobrado: number; pagado: number; saldo: number };
  servicios: { cobrado: number; pagado: number; saldo: number };
}

/**
 * Deuda por periodo de un inquilino. Cada pago se aplica primero al periodo que
 * indica (si ese mes tiene saldo) y el sobrante a la deuda más antigua, igual
 * que la simulación; así, pagar servicios o alquiler de meses anteriores liquida
 * esos meses en vez de quedar colgado en el mes del cobro.
 */
function calcularDeudaPorConcepto(
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
  };
}

/** Simula aplicar un pago monto desde el saldo mas antiguo. Devuelve nuevas filas + saldo restante. */
function simularPago(filas: FilaDeuda[], monto: number) {
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
function nombreMes(periodo: string): string {
  const [anio, mes] = periodo.split('-');
  const nombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${nombres[parseInt(mes, 10) - 1] ?? mes} ${anio}`;
}

const PALETA_SERVICIOS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#0369a1', '#9333ea', '#e11d48', '#65a30d', '#0d9488', '#ca8a04'];

/** Color estable por concepto (null = general, alquiler = acento fijo). */
function colorServicio(svcId: string | null): string {
  if (svcId === null) return '#94a3b8';
  if (svcId === ALQUILER_ID) return '#0f766e';
  let h = 0;
  for (let i = 0; i < svcId.length; i++) h = (h * 31 + svcId.charCodeAt(i)) | 0;
  return PALETA_SERVICIOS[Math.abs(h) % PALETA_SERVICIOS.length];
}

export function Pagos() {
  const { snap, mapInq, mapSvc, recargar } = useSnapshot();
  const [periodo, setPeriodo] = useState(mesActual());
  const [aviso, setAviso] = useState<AvisoUi | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [inquilinoId, setInquilinoId] = useState('');
  const [concepto, setConcepto] = useState<'alquiler' | 'servicios' | 'general'>('general');
  const [servicioId, setServicioId] = useState('');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(hoy());
  const [observacion, setObservacion] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [pagoAEliminar, setPagoAEliminar] = useState<Pago | null>(null);

  const inq = snap?.inquilinos ?? [];
  const todosCobros = snap?.cobros ?? [];
  const todosPagos = snap?.pagos ?? [];

  const serviciosDelInquilino = useMemo(() => {
    if (!inquilinoId) return [];
    const ids = new Set(
      todosCobros
        .filter((c) => c.inquilinoId === inquilinoId)
        .map((c) => c.servicioId),
    );
    return (snap?.servicios ?? []).filter((s) => ids.has(s.id));
  }, [todosCobros, inquilinoId, snap?.servicios]);

  const deuda = useMemo(
    () => (inquilinoId ? calcularDeudaPorConcepto(inquilinoId, todosCobros, todosPagos) : null),
    [inquilinoId, todosCobros, todosPagos],
  );

  // Historial por mes y concepto (Alquiler / cada servicio / General).
  const historial = useMemo(() => {
    if (!inquilinoId || !deuda) return { conceptos: [], filas: [] };
    const conceptos = deuda.claves.map((clave) => ({
      clave,
      nombre: clave === '__general__' ? 'General' : nombreServicio(clave, mapSvc),
    }));
    return { conceptos, filas: deuda.filas };
  }, [inquilinoId, deuda, mapSvc]);

  const cronologia = deuda?.mensual ?? [];

  // Deuda acumulada hasta el periodo actual (excluye meses futuros generados).
  const mesHoy = mesActual();
  const deudaHoy = useMemo(
    () => cronologia.reduce((s, f) => s + (f.periodo <= mesHoy && f.saldo > 0 ? f.saldo : 0), 0),
    [cronologia, mesHoy],
  );

  const pagadoTotal = cronologia.reduce((s, f) => s + f.pagado, 0);
  const cobradoTotal = cronologia.reduce((s, f) => s + f.cobrado, 0);

  const porConcepto = deuda
    ? {
        cobradoAlq: deuda.alquiler.cobrado,
        pagadoAlq: deuda.alquiler.pagado,
        saldoAlq: deuda.alquiler.saldo,
        cobradoSvc: deuda.servicios.cobrado,
        pagadoSvc: deuda.servicios.pagado,
        saldoSvc: deuda.servicios.saldo,
      }
    : {
        cobradoAlq: 0,
        pagadoAlq: 0,
        saldoAlq: 0,
        cobradoSvc: 0,
        pagadoSvc: 0,
        saldoSvc: 0,
      };

  // Simulacion
  const montoNum = toNum(monto);
  const simulacion = useMemo(
    () => (inquilinoId && montoNum > 0 ? simularPago(cronologia, montoNum) : null),
    [cronologia, montoNum, inquilinoId],
  );

  // Periodos de este mes para el inquilino
  const pagosMes = (snap?.pagos ?? [])
    .filter((p) => p.periodo === periodo && p.inquilinoId)
    .sort((a, b) => (b.fechaPago ?? '').localeCompare(a.fechaPago ?? ''));
  const totalPagadoMes = pagosMes.reduce((a, p) => a + toNum(p.montoBs), 0);

  // Resumen del mes (sin inquilino seleccionado)
  const cobradoMesTotal = (snap?.cobros ?? [])
    .filter((c) => c.periodo === periodo)
    .reduce((a, c) => a + (c.montoTotal || 0), 0);
  const saldoMes = cobradoMesTotal - totalPagadoMes;

  // Lista de pagos visibles en la 3.ª columna (filtrada por inquilino y/o búsqueda)
  const qBusqueda = busqueda.trim().toLowerCase();
  const pagosVista = pagosMes.filter((p) => {
    if (inquilinoId && p.inquilinoId !== inquilinoId) return false;
    if (!qBusqueda) return true;
    const nombre = mapInq.get(p.inquilinoId ?? '')?.nombre ?? '';
    return (
      nombre.toLowerCase().includes(qBusqueda) ||
      (p.observacion ?? '').toLowerCase().includes(qBusqueda)
    );
  });
  const totalVista = pagosVista.reduce((a, p) => a + toNum(p.montoBs), 0);

  const guardar = async () => {
    if (concepto === 'alquiler' && !puedePagarAlquiler) {
      setAviso({ mensaje: 'Este inquilino no tiene habilitado el pago de alquiler', tipo: 'error' });
      return;
    }
    if (concepto === 'servicios' && !servicioId) {
      setAviso({ mensaje: 'Selecciona el servicio al que aplica el pago', tipo: 'error' });
      return;
    }
    setGuardando(true);
    try {
      const servicioFinal =
        concepto === 'alquiler' ? ALQUILER_ID : concepto === 'servicios' ? servicioId || null : null;
      const pago: Pago = {
        id: '',
        inquilinoId,
        servicioId: servicioFinal,
        periodo,
        fechaPago: fecha,
        montoBs: montoNum,
        observacion,
      };
      const creado = await registrarPago(pago);
      setAviso({
        mensaje: `Pago registrado: ${fmtBs(creado.montoBs)}`,
        tipo: 'ok',
      });
      setMonto('');
      setObservacion('');
      recargar();
    } catch (err) {
      setAviso({ mensaje: err instanceof Error ? err.message : 'Error', tipo: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminar = async () => {
    if (!pagoAEliminar) return;
    try {
      await eliminarPago(pagoAEliminar.id);
      setPagoAEliminar(null);
      setAviso({ mensaje: 'Pago eliminado', tipo: 'ok' });
      recargar();
    } catch (err) {
      setAviso({ mensaje: err instanceof Error ? err.message : 'Error', tipo: 'error' });
    }
  };

  const inqSeleccionado = inq.find((i) => i.id === inquilinoId);
  const puedePagarAlquiler = inqSeleccionado?.cobraAlquiler === true && toNum(inqSeleccionado.alquilerBs) > 0;

  return (
    <div className="page">
      <div className="page-head">
        <h2>Pagos</h2>
        <span className="subtitulo">Abonos de los inquilinos</span>
      </div>

      {aviso && <Aviso mensaje={aviso.mensaje} tipo={aviso.tipo} onCerrar={() => setAviso(null)} />}

      <div className="grid3">
        {/* Formulario */}
        <section className="panel">
          <h3>Registrar pago</h3>
          <div className="form-grid">
            <Campo label="Inquilino">
              <Seleccion value={inquilinoId} onChange={(e) => {
                const id = e.target.value;
                setInquilinoId(id);
                setMonto('');
                const nuevo = inq.find((i) => i.id === id);
                const puedeNuevo = nuevo?.cobraAlquiler === true && toNum(nuevo.alquilerBs) > 0;
                if (concepto === 'alquiler' && !puedeNuevo) setConcepto('general');
              }}>
                <option value="">— Seleccionar —</option>
                {inq.map((i) => (
                  <option key={i.id} value={i.id}>{i.nombre}</option>
                ))}
              </Seleccion>
            </Campo>
            <Campo
              label="Concepto del pago"
              hint={!puedePagarAlquiler ? 'Este inquilino no tiene habilitado el pago de alquiler' : 'Aplica al alquiler, a un servicio o en general'}
            >
              <Seleccion
                value={concepto}
                disabled={!inquilinoId}
                onChange={(e) => {
                  const v = e.target.value as 'alquiler' | 'servicios' | 'general';
                  setConcepto(v);
                  setServicioId('');
                }}
              >
                <option value="alquiler" disabled={!puedePagarAlquiler}>Alquiler</option>
                <option value="servicios">Servicios</option>
                <option value="general">En general</option>
              </Seleccion>
            </Campo>
            {concepto === 'servicios' && (
              <Campo label="Servicio" hint="A qué servicio aplica el pago">
                <Seleccion value={servicioId} onChange={(e) => setServicioId(e.target.value)} disabled={!inquilinoId}>
                  <option value="">— Seleccionar servicio —</option>
                  {serviciosDelInquilino.map((s) => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </Seleccion>
              </Campo>
            )}
            {concepto === 'alquiler' && (
              <div className="campo" style={{ justifyContent: 'center' }}>
                <span className="insignia insignia-info">El pago se aplica a la deuda de alquiler</span>
              </div>
            )}
            <Campo label="Periodo">
              <input className="input" type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
            </Campo>
            <Campo label="Fecha del pago">
              <Fecha value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </Campo>
            <Campo label="Monto (Bs)">
              <Numero value={monto} min={0} placeholder="0.00" onChange={(e) => setMonto(e.target.value)} />
            </Campo>
            <Campo label="Observación">
              <Texto value={observacion} onChange={(e) => setObservacion(e.target.value)} placeholder="Opcional" />
            </Campo>
            <div className="form-acciones">
              <Boton onClick={() => void guardar()} disabled={guardando || !inquilinoId || montoNum <= 0}>
                {guardando ? 'Registrando…' : 'Registrar pago'}
              </Boton>
            </div>
          </div>

          {/* Simulacion */}
          {simulacion && (
            <div className="simulacion">
              <h4>Simulacion del pago</h4>
              <div className="simulacion-header">
                <span>Pago: <strong>{fmtBs(montoNum)}</strong></span>
                {simulacion.sobrante > 0 && (
                  <span className="saldo-neg">Sobra: {fmtBs(simulacion.sobrante)}</span>
                )}
              </div>
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th className="num">Saldo</th>
                    <th className="num">Se aplica</th>
                    <th className="num">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {simulacion.resultado.map((f) => {
                    if (f.saldo <= 0 && f.aplicado === 0) return null;
                    const nuevoSaldo = f.saldo - f.aplicado;
                    return (
                      <tr key={f.periodo} className={f.aplicado > 0 ? 'fila-simulada' : ''}>
                        <td>{nombreMes(f.periodo)}</td>
                        <td className="num">{fmtBs(f.saldo)}</td>
                        <td className="num">
                          {f.aplicado > 0 ? (
                            <span className="simulacion-aplica">-{fmtBs(f.aplicado)}</span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td className="num">
                          {f.aplicado > 0 ? (
                            nuevoSaldo <= 0 ? (
                              <span className="insignia insignia-ok">Pagado</span>
                            ) : (
                              <span className="saldo-neg">{fmtBs(nuevoSaldo)}</span>
                            )
                          ) : (
                            <span className="muted">{fmtBs(f.saldo)}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Col 2: Deuda del inquilino | Resumen del mes */}
        <section className="panel">
          {inquilinoId ? (
            <>
              <div className="panel-head">
                <div>
                  <h3>Deuda de {inqSeleccionado?.nombre ?? inquilinoId}</h3>
                  <span className="muted" style={{ fontSize: '12px' }}>
                    Acumulada hasta {fmtFecha(hoy())}
                  </span>
                </div>
                <strong className={`total-badge ${deudaHoy > 0 ? 'saldo-neg' : ''}`}>{fmtBs(deudaHoy)}</strong>
              </div>
              {inqSeleccionado?.cobraAlquiler && (
                <div style={{ marginBottom: '12px' }}>
                  <span className="insignia insignia-info">
                    Cobra alquiler · {fmtBs(toNum(inqSeleccionado.alquilerBs))}/mes
                  </span>
                </div>
              )}
              <div className="cards tarjeta-deuda">
                <div className="card card-info">
                  <span className="card-label">Cobrado</span>
                  <span className="card-value">{fmtBs(cobradoTotal)}</span>
                </div>
                <div className="card card-ok">
                  <span className="card-label">Pagado</span>
                  <span className="card-value">{fmtBs(pagadoTotal)}</span>
                </div>
                <div className={`card ${porConcepto.saldoAlq > 0 ? 'card-mal' : 'card-ok'}`}>
                  <span className="card-label">Deuda alquiler</span>
                  <span className="card-value">{fmtBs(porConcepto.saldoAlq)}</span>
                  <span className="muted" style={{ fontSize: '11px' }}>
                    Cobr. {fmtBs(porConcepto.cobradoAlq)} · Pag. {fmtBs(porConcepto.pagadoAlq)}
                  </span>
                </div>
                <div className={`card ${porConcepto.saldoSvc > 0 ? 'card-mal' : 'card-ok'}`}>
                  <span className="card-label">Deuda servicios</span>
                  <span className="card-value">{fmtBs(porConcepto.saldoSvc)}</span>
                  <span className="muted" style={{ fontSize: '11px' }}>
                    Cobr. {fmtBs(porConcepto.cobradoSvc)} · Pag. {fmtBs(porConcepto.pagadoSvc)}
                  </span>
                </div>
                <div className={`card ${deudaHoy > 0 ? 'card-mal' : 'card-ok'}`}>
                  <span className="card-label">Total a hoy</span>
                  <span className="card-value">{fmtBs(deudaHoy)}</span>
                </div>
              </div>
              {inqSeleccionado?.cobraAlquiler && porConcepto.cobradoAlq === 0 && (
                <p className="muted" style={{ marginTop: '10px', fontSize: '12.5px' }}>
                  Este inquilino cobra alquiler, pero todavía no hay cobros de alquiler registrados.
                  Genera los cobros en «Cobros → Generar todos» (usa el código reciente de Apps Script).
                </p>
              )}
              <div className="tabla-wrap" style={{ marginTop: '14px' }}>
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Mes</th>
                      <th className="num">Cobrado</th>
                      <th className="num">Pagado</th>
                      <th className="num">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cronologia.map((f) => (
                      <tr key={f.periodo} className={f.saldo > 0 ? 'fila-deuda' : 'fila-pagada'}>
                        <td>{nombreMes(f.periodo)}</td>
                        <td className="num">{fmtBs(f.cobrado)}</td>
                        <td className="num">{fmtBs(f.pagado)}</td>
                        <td className={`num ${f.saldo > 0 ? 'saldo-neg' : ''}`}>
                          {f.saldo > 0 ? fmtBs(f.saldo) : <span className="insignia insignia-ok">OK</span>}
                        </td>
                      </tr>
                    ))}
                    {cronologia.length === 0 && (
                      <tr>
                        <td colSpan={4} className="muted" style={{ textAlign: 'center', padding: '16px' }}>
                          Sin cobros registrados para este inquilino.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <div className="panel-head">
                <h3>Resumen de {periodo}</h3>
                <strong className={`total-badge ${saldoMes > 0 ? 'saldo-neg' : ''}`}>{fmtBs(saldoMes)}</strong>
              </div>
              <div className="cards">
                <div className="card card-info">
                  <span className="card-label">Cobrado del mes</span>
                  <span className="card-value">{fmtBs(cobradoMesTotal)}</span>
                </div>
                <div className="card card-ok">
                  <span className="card-label">Pagado del mes</span>
                  <span className="card-value">{fmtBs(totalPagadoMes)}</span>
                </div>
                <div className={`card ${saldoMes > 0 ? 'card-mal' : 'card-ok'}`}>
                  <span className="card-label">Saldo del mes</span>
                  <span className="card-value">{fmtBs(saldoMes)}</span>
                </div>
              </div>
              <p className="muted" style={{ fontSize: '12.5px' }}>
                Selecciona un inquilino en el formulario para ver su deuda acumulada hasta la fecha,
                registrar pagos por concepto (alquiler, servicio o en general) y revisar su historial.
              </p>
            </>
          )}
        </section>

        {/* Col 3: Pagos del periodo */}
        <section className="panel">
          <div className="panel-head">
            <h3>
              {inquilinoId ? `Pagos de ${inqSeleccionado?.nombre ?? ''}` : `Pagos de ${periodo}`}
            </h3>
            <strong className="total-badge">{fmtBs(totalVista)}</strong>
          </div>
          {!inquilinoId && (
            <input
              className="input"
              placeholder="Buscar por inquilino u observación…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ marginBottom: '10px' }}
            />
          )}
          <div className="tabla-wrap">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Inquilino</th>
                  <th>Concepto</th>
                  <th className="num">Monto</th>
                  <th>Observación</th>
                  <th className="acciones">—</th>
                </tr>
              </thead>
              <tbody>
                {pagosVista.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted">No hay pagos para este periodo.</td>
                  </tr>
                )}
                {pagosVista.map((p) => (
                  <tr key={p.id}>
                    <td>{fmtFecha(p.fechaPago)}</td>
                    <td className="celda-nombre">{mapInq.get(p.inquilinoId ?? '')?.nombre ?? '—'}</td>
                    <td>
                      <span className="concepto-badge">
                        <i className="concepto-dot" style={{ background: colorServicio(p.servicioId) }} />
                        {p.servicioId ? nombreServicio(p.servicioId, mapSvc) : 'General'}
                      </span>
                    </td>
                    <td className="num"><strong>{fmtBs(p.montoBs)}</strong></td>
                    <td className="muted">{p.observacion || '—'}</td>
                    <td className="acciones">
                      <Boton variante="peligro" className="btn-mini" onClick={() => setPagoAEliminar(p)}>Eliminar</Boton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {inquilinoId && historial.conceptos.length > 0 && (
        <section className="panel">
          <div className="panel-head">
            <h3>Historial de pagos de {inqSeleccionado?.nombre ?? inquilinoId}</h3>
          </div>
          <div className="tabla-wrap">
            <table className="tabla">
              <thead>
                <tr>
                  <th className="sticky-col">Mes</th>
                  {historial.conceptos.map((c) => (
                    <th key={c.clave} className="centro">{c.nombre}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historial.filas.map((f) => (
                  <tr key={f.periodo} className={f.celdas.size > 0 ? 'fila-pagada' : ''}>
                    <td className="sticky-col">{nombreMes(f.periodo)}</td>
                    {historial.conceptos.map((c) => {
                      const cel = f.celdas.get(c.clave);
                      const cobrado = cel?.cobrado ?? 0;
                      const pagado = cel?.pagado ?? 0;
                      if (!cobrado && !pagado) {
                        return (
                          <td key={c.clave} className="centro">
                            <span className="muted">—</span>
                          </td>
                        );
                      }
                      const saldo = cobrado - pagado;
                      return (
                        <td key={c.clave} className="centro">
                          <div className="hist-celda">
                            {cobrado ? (
                              <strong title={`Cobrado ${fmtBs(cobrado)}`} className={saldo > 0 ? 'saldo-neg' : ''}>
                                {fmtBs(cobrado)}
                              </strong>
                            ) : (
                              <span className="muted">sin cobro</span>
                            )}
                            {pagado ? (
                              <span className="pago-hecho" title={`Pagado ${fmtBs(pagado)}`}>
                                ✓ {fmtBs(pagado)}
                              </span>
                            ) : (
                              <span className="hist-pendiente">Pendiente</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {historial.filas.length === 0 && (
                  <tr>
                    <td colSpan={historial.conceptos.length + 1} className="muted" style={{ textAlign: 'center', padding: '16px' }}>
                      Sin cobros ni pagos registrados para este inquilino.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {pagoAEliminar && (
        <Modal open title="Eliminar pago" onClose={() => setPagoAEliminar(null)} ancho="440px">
          <p style={{ margin: '0 0 14px', fontSize: '13.5px' }}>
            ¿Eliminar este pago de{' '}
            <strong>{fmtBs(pagoAEliminar.montoBs)}</strong> de{' '}
            <strong>{mapInq.get(pagoAEliminar.inquilinoId ?? '')?.nombre ?? pagoAEliminar.inquilinoId}</strong>{' '}
            · {nombreServicio(pagoAEliminar.servicioId, mapSvc)} · {fmtFecha(pagoAEliminar.fechaPago)}?
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Boton variante="fantasma" onClick={() => setPagoAEliminar(null)}>Cancelar</Boton>
            <Boton variante="peligro" onClick={() => void confirmarEliminar()}>Eliminar pago</Boton>
          </div>
        </Modal>
      )}
    </div>
  );
}
