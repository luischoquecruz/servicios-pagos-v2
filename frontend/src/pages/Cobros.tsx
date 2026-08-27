import { useState, useMemo, Fragment } from 'react';
import { useSnapshot } from '../components/SnapshotContext';
import { generarCobros, generarCobrosServicio, getDiagnostico } from '../api';
import { fmtBs, mesActual, nombreServicio, ALQUILER_ID } from '../utils';
import { Boton } from '../components/ui/Boton';
import { Aviso } from '../components/ui/Aviso';
import type { Cobro, Pago, Inquilino } from '../types';

/** Calcula deuda acumulada (cobrado - pagado) de TODOS los periodos por inquilino. */
function deudaAcumulada(cobros: Cobro[], pagos: Pago[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const c of cobros) {
    mapa.set(c.inquilinoId, (mapa.get(c.inquilinoId) ?? 0) + (c.montoTotal || 0));
  }
  for (const p of pagos) {
    if (p.inquilinoId) {
      mapa.set(p.inquilinoId, (mapa.get(p.inquilinoId) ?? 0) - (p.montoBs || 0));
    }
  }
  return mapa;
}

interface Diagnostico {
  periodo: string;
  servicios: { id: string; nombre: string }[];
  inquilinos: { id: string; nombre: string; habilitado: boolean; fechaIngreso: string; fechaSalida: string | null }[];
  asignacionesTotal: number;
  asignaciones: {
    id: string;
    inquilinoId: string;
    servicioId: string;
    activo: boolean;
    activoType: string;
    inqExiste: boolean;
    svcExiste: boolean;
    habilitado: boolean;
    enPeriodo: boolean;
    pasa: boolean;
  }[];
  facturasTotal: number;
  facturas: { id: string; servicioId: string; servicioNombre: string; montoBs: number; periodo: string }[];
  costosPorServicio: Record<string, { nombre: string; costo: number }>;
  cobrosGenerados: number;
}

/** Agrupa cobros por inquilinoId, manteniendo orden de aparición. */
function agruparPorInquilino(cobros: Cobro[]) {
  const mapa = new Map<string, Cobro[]>();
  for (const c of cobros) {
    const arr = mapa.get(c.inquilinoId) ?? [];
    arr.push(c);
    mapa.set(c.inquilinoId, arr);
  }
  return mapa;
}

/** Devuelve los servicios que aparecen en los cobros (orden establecido). */
function serviciosEnCobros(cobros: Cobro[]): string[] {
  const vistos = new Set<string>();
  const ids: string[] = [];
  for (const c of cobros) {
    if (!vistos.has(c.servicioId)) {
      vistos.add(c.servicioId);
      ids.push(c.servicioId);
    }
  }
  return ids;
}

export function Cobros() {
  const { snap, recargar, mapInq, mapSvc } = useSnapshot();
  const [periodo, setPeriodo] = useState(mesActual());
  const [aviso, setAviso] = useState<{ mensaje: string; tipo: 'ok' | 'error' } | null>(null);
  const [generando, setGenerando] = useState(false);
  const [diag, setDiag] = useState<Diagnostico | null>(null);
  const [cargandoDiag, setCargandoDiag] = useState(false);
  const [vista, setVista] = useState<'tabla' | 'grupo'>('grupo');

  const cobrosPeriodo = useMemo(
    () => (snap?.cobros ?? []).filter((c) => c.periodo === periodo),
    [snap?.cobros, periodo],
  );

  const agrupados = useMemo(() => agruparPorInquilino(cobrosPeriodo), [cobrosPeriodo]);
  const svcIds = useMemo(() => serviciosEnCobros(cobrosPeriodo), [cobrosPeriodo]);

  const total = cobrosPeriodo.reduce((a, c) => a + (c.montoTotal || 0), 0);

  const deudas = useMemo(
    () => deudaAcumulada(snap?.cobros ?? [], snap?.pagos ?? []),
    [snap?.cobros, snap?.pagos],
  );
  const totalDeuda = useMemo(() => {
    let s = 0;
    for (const v of deudas.values()) if (v > 0) s += v;
    return s;
  }, [deudas]);

  const handleGenerar = async (svcId?: string) => {
    setGenerando(true);
    setAviso(null);
    try {
      const resultado = svcId
        ? await generarCobrosServicio(periodo, svcId)
        : await generarCobros(periodo);
      recargar();
      if (!resultado || resultado.length === 0) {
        setAviso({ mensaje: 'No se generaron cobros. Haga clic en "Diagnosticar" para ver el detalle.', tipo: 'error' });
      } else {
        setAviso({ mensaje: `Se generaron ${resultado.length} cobro(s) correctamente.`, tipo: 'ok' });
      }
    } catch (e) {
      setAviso({ mensaje: e instanceof Error ? e.message : String(e), tipo: 'error' });
    } finally {
      setGenerando(false);
    }
  };

  const handleDiagnostico = async () => {
    setCargandoDiag(true);
    setDiag(null);
    try {
      const d = await getDiagnostico(periodo);
      setDiag(d as Diagnostico);
    } catch (e) {
      setAviso({ mensaje: e instanceof Error ? e.message : String(e), tipo: 'error' });
    } finally {
      setCargandoDiag(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h2>Cobros mensuales</h2>
      </div>

      {aviso && <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} onCerrar={() => setAviso(null)} />}

      <div className="toolbar">
        <label className="campo campo-inline">
          <span className="campo-label">Periodo</span>
          <input className="input" type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
        </label>
        <div className="pestanas" role="tablist">
          <button className={`tab ${vista === 'grupo' ? 'tab-activa' : ''}`} onClick={() => setVista('grupo')}>
            Agrupado
          </button>
          <button className={`tab ${vista === 'tabla' ? 'tab-activa' : ''}`} onClick={() => setVista('tabla')}>
            Detalle
          </button>
        </div>
        <Boton onClick={() => handleGenerar()} disabled={generando}>
          {generando ? 'Generando...' : 'Generar todos'}
        </Boton>
        <Boton variante="secundario" onClick={() => handleDiagnostico()} disabled={cargandoDiag}>
          {cargandoDiag ? 'Cargando...' : 'Diagnosticar'}
        </Boton>
      </div>

      {/* Resumen cards */}
      <div className="cards">
        <div className="card card-info">
          <span className="card-label">Total cobrado (mes)</span>
          <span className="card-value">{fmtBs(total)}</span>
        </div>
        <div className={`card ${totalDeuda > 0 ? 'card-mal' : 'card-ok'}`}>
          <span className="card-label">Deuda acumulada</span>
          <span className="card-value">{fmtBs(totalDeuda)}</span>
        </div>
        <div className="card card-info">
          <span className="card-label">Cobros</span>
          <span className="card-value">{cobrosPeriodo.length}</span>
        </div>
        <div className="card card-info">
          <span className="card-label">Inquilinos</span>
          <span className="card-value">{agrupados.size}</span>
        </div>
        <div className="card card-info">
          <span className="card-label">Servicios</span>
          <span className="card-value">{svcIds.length}</span>
        </div>
      </div>

      {vista === 'grupo' ? (
        <CobrosAgrupados
          agrupados={agrupados}
          svcIds={svcIds}
          mapInq={mapInq}
          mapSvc={mapSvc}
          deudas={deudas}
        />
      ) : (
        <CobrosDetalle
          cobros={cobrosPeriodo}
          mapInq={mapInq}
          mapSvc={mapSvc}
          onRegenerar={handleGenerar}
          generando={generando}
        />
      )}

      {/* Diagnostico */}
      {diag && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head">
            <h3>Diagnostico del periodo {diag.periodo}</h3>
          </div>
          <div className="diag-grid">
            <div className="diag-box">
              <div className="diag-label">Servicios</div>
              <div className="diag-valor">{diag.servicios.length}</div>
              {diag.servicios.map((s) => (
                <div key={s.id} className="diag-detalle">{s.nombre}</div>
              ))}
            </div>
            <div className="diag-box">
              <div className="diag-label">Inquilinos</div>
              <div className="diag-valor">{diag.inquilinos.length}</div>
              {diag.inquilinos.map((i) => (
                <div key={i.id} className="diag-detalle">
                  {i.nombre} — hab={String(i.habilitado)}, ing={i.fechaIngreso ?? '?'}
                </div>
              ))}
            </div>
            <div className="diag-box">
              <div className="diag-label">Asignaciones</div>
              <div className="diag-valor">{diag.asignacionesTotal}</div>
              {diag.asignaciones.map((a) => (
                <div key={a.id} className={`diag-detalle ${a.pasa ? 'diag-ok' : 'diag-fail'}`}>
                  {a.pasa ? '✓' : '✗'} inq={a.inquilinoId} svc={a.servicioId} activo={String(a.activo)}
                </div>
              ))}
            </div>
            <div className="diag-box">
              <div className="diag-label">Facturas</div>
              <div className="diag-valor">{diag.facturasTotal}</div>
              {diag.facturas.map((f) => (
                <div key={f.id} className="diag-detalle diag-ok">{f.servicioNombre}: {fmtBs(f.montoBs)}</div>
              ))}
            </div>
            <div className="diag-box">
              <div className="diag-label">Costo por servicio</div>
              {Object.entries(diag.costosPorServicio).map(([svcId, info]) => (
                <div key={svcId} className={`diag-detalle ${info.costo > 0 ? 'diag-ok' : 'diag-fail'}`}>
                  {info.nombre}: {fmtBs(info.costo)}
                </div>
              ))}
            </div>
            <div className="diag-box">
              <div className="diag-label">Cobros generados</div>
              <div className={`diag-valor ${diag.cobrosGenerados > 0 ? 'diag-ok' : 'diag-fail'}`}>{diag.cobrosGenerados}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Vista agrupada: tabla con inquilinos como filas, servicios como grupos de columnas. */
function CobrosAgrupados({
  agrupados,
  svcIds,
  mapInq,
  mapSvc,
  deudas,
}: {
  agrupados: Map<string, Cobro[]>;
  svcIds: string[];
  mapInq: Map<string, Inquilino>;
  mapSvc: Map<string, import('../types').Servicio>;
  deudas: Map<string, number>;
}) {
  if (agrupados.size === 0) {
    return (
      <div className="panel">
        <div className="muted" style={{ padding: '20px', textAlign: 'center' }}>
          No hay cobros para este periodo. Haga clic en "Generar todos" o "Diagnosticar" para ver por qué.
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Detalle por inquilino</h3>
      </div>
      <div className="tabla-wrap">
        <table className="tabla tabla-cobros">
          <thead>
            <tr>
              <th className="sticky-col" rowSpan={2}>Inquilino</th>
              <th className="centro" rowSpan={2}>Cuartos</th>
              <th className="centro" rowSpan={2}>Personas</th>
              {svcIds.map((svcId) => {
                return (
                  <th key={svcId} className="centro grupo-svc" colSpan={3}>
                    {nombreServicio(svcId, mapSvc)}
                  </th>
                );
              })}
              <th className="num grupo-total" rowSpan={2}>Total mes</th>
              <th className="num grupo-deuda" rowSpan={2}>Deuda acum.</th>
            </tr>
            <tr>
              {svcIds.map((svcId) => (
                <Fragment key={svcId}>
                  <th className="num">Factor</th>
                  <th className="num">Extras</th>
                  <th className="num">Total</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...agrupados.entries()].map(([inqId, cobros]) => {
              const inq = mapInq.get(inqId);
              let totalInq = 0;
              const datosSvc = new Map<string, Cobro>();
              for (const c of cobros) {
                datosSvc.set(c.servicioId, c);
                totalInq += c.montoTotal;
              }

              return (
                <tr key={inqId}>
                  <td className="celda-nombre sticky-col">{inq?.nombre ?? inqId}</td>
                  <td className="centro">{inq?.habitaciones ?? '?'}</td>
                  <td className="centro">{inq?.personas ?? '?'}</td>
                  {svcIds.map((svcId) => {
                    const c = datosSvc.get(svcId);
                    if (!c) {
                      return (
                        <Fragment key={svcId}>
                          <td className="centro muted">—</td>
                          <td className="centro muted">—</td>
                          <td className="centro muted">—</td>
                        </Fragment>
                      );
                    }
                    const extrasCount = Object.values(c.extras ?? {}).reduce((s, v) => s + (v ?? 0), 0);
                    return (
                      <Fragment key={svcId}>
                        <td className="num">{c.peso}</td>
                        <td className="num">
                          {extrasCount > 0 ? (
                            <span className="extras-badge" title={Object.entries(c.extras ?? {}).map(([k, v]) => `${k}: ${v}`).join(', ')}>
                              +{extrasCount}
                            </span>
                          ) : (
                            <span className="muted">0</span>
                          )}
                        </td>
                        <td className="num"><strong>{fmtBs(c.montoTotal)}</strong></td>
                      </Fragment>
                    );
                  })}
                  <td className="num grupo-total"><strong>{fmtBs(totalInq)}</strong></td>
                  <td className="num grupo-deuda">
                    {(() => {
                      const d = deudas.get(inqId) ?? 0;
                      return d > 0 ? <span className="saldo-neg">{fmtBs(d)}</span> : <span className="muted">{fmtBs(d)}</span>;
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            {(() => {
              // Precompute data for footer rows
              const datosSvc = svcIds.map((svcId) => {
                let totalSvc = 0;
                let pesoTotalSvc = 0;
                for (const [, cobros] of agrupados) {
                  const c = cobros.find((x) => x.servicioId === svcId);
                  if (c) {
                    totalSvc += c.montoTotal;
                    pesoTotalSvc += c.peso;
                  }
                }
                const svc = mapSvc.get(svcId);
                const unitario = pesoTotalSvc > 0 ? totalSvc / pesoTotalSvc : 0;
                return { svcId, totalSvc, pesoTotalSvc, unitario, metodoPago: svc?.metodoPago };
              });
              const totalGeneral = datosSvc.reduce((s, d) => s + d.totalSvc, 0);
              let totalDeudaGeneral = 0;
              for (const v of deudas.values()) if (v > 0) totalDeudaGeneral += v;

              return (
                <>
                  <tr className="fila-unitario">
                    <td className="sticky-col"><strong>Costo unitario</strong></td>
                    <td colSpan={2}></td>
                    {datosSvc.map(({ svcId, unitario, pesoTotalSvc, metodoPago }) => (
                      <Fragment key={svcId}>
                        <td></td>
                        <td className="num muted" colSpan={1}>
                          {pesoTotalSvc > 0 ? (
                            <span className="unitario-badge" title={`${pesoTotalSvc} unidades en total`}>
                              {fmtBs(unitario)}/{metodoPago === 'PERSONAS' ? 'pers' : 'cuar'}
                            </span>
                          ) : '—'}
                        </td>
                        <td></td>
                      </Fragment>
                    ))}
                    <td className="num grupo-total"></td>
                    <td className="num grupo-deuda"></td>
                  </tr>
                  <tr className="fila-total">
                    <td className="sticky-col"><strong>Total</strong></td>
                    <td colSpan={2}></td>
                    {datosSvc.map(({ svcId, totalSvc }) => (
                      <Fragment key={svcId}>
                        <td></td>
                        <td></td>
                        <td className="num"><strong>{fmtBs(totalSvc)}</strong></td>
                      </Fragment>
                    ))}
                    <td className="num grupo-total"><strong>{fmtBs(totalGeneral)}</strong></td>
                    <td className="num grupo-deuda"><strong className={totalDeudaGeneral > 0 ? 'saldo-neg' : ''}>{fmtBs(totalDeudaGeneral)}</strong></td>
                  </tr>
                </>
              );
            })()}
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/** Vista tabla plana: detalle linea por linea. */
function CobrosDetalle({
  cobros,
  mapInq,
  mapSvc,
  onRegenerar,
  generando,
}: {
  cobros: Cobro[];
  mapInq: Map<string, import('../types').Inquilino>;
  mapSvc: Map<string, import('../types').Servicio>;
  onRegenerar: (svcId?: string) => void;
  generando: boolean;
}) {
  if (cobros.length === 0) {
    return (
      <div className="panel">
        <div className="muted" style={{ padding: '20px', textAlign: 'center' }}>
          No hay cobros para este periodo.
        </div>
      </div>
    );
  }

  const extraKeys = new Set<string>();
  for (const c of cobros) {
    for (const k of Object.keys(c.extras ?? {})) extraKeys.add(k);
  }
  const extras = [...extraKeys].sort();

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Detalle linea por linea</h3>
      </div>
      <div className="tabla-wrap">
        <table className="tabla">
          <thead>
            <tr>
              <th>Inquilino</th>
              <th>Servicio</th>
              <th className="centro">Cuartos</th>
              <th className="centro">Personas</th>
              {extras.map((k) => (
                <th key={k} className="num">{k}</th>
              ))}
              <th className="num">Factor</th>
              <th className="num">Reparto</th>
              <th className="num">Total</th>
              <th className="acciones">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cobros.map((c) => {
              const inq = mapInq.get(c.inquilinoId);
              return (
                <tr key={c.id}>
                  <td className="celda-nombre">{inq?.nombre ?? c.inquilinoId}</td>
                  <td>{nombreServicio(c.servicioId, mapSvc)}</td>
                  <td className="centro">{c.habitaciones}</td>
                  <td className="centro">{c.personas}</td>
                  {extras.map((k) => (
                    <td key={k} className="num">{(c.extras ?? {})[k] ?? 0}</td>
                  ))}
                  <td className="num">{c.peso}</td>
                  <td className="num">{fmtBs(c.montoBase)}</td>
                  <td className="num"><strong>{fmtBs(c.montoTotal)}</strong></td>
                  <td className="acciones">
                    {c.servicioId !== ALQUILER_ID && (
                      <Boton variante="secundario" className="btn-mini" onClick={() => onRegenerar(c.servicioId)} disabled={generando}>
                        Regenerar
                      </Boton>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

