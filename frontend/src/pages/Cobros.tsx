import { useMemo, useState } from 'react';
import { useSnapshot } from '../components/SnapshotContext';
import { generarCobros, generarCobrosServicio, getDiagnostico } from '../api';
import { ALQUILER_ID, fmtBs, mesActual, nombreServicio } from '../utils';
import { Aviso } from '../components/ui/Aviso';
import { Cargando } from '../components/ui/Cargando';
import { Cifra, EstadoDeuda, Seccion, SelectorMes } from '../components/Partes';
import { RepartoTarjeta } from '../components/Reparto';
import { IcoAlerta, IcoImprimir } from '../components/Iconos';
import { fueraDelReparto, mesLargo, repartoServicios } from '../reportes/modelo';
import { irA } from '../nav';

interface Diagnostico {
  periodo: string;
  asignaciones: { id: string; inquilinoId: string; servicioId: string; activo: boolean; inqExiste: boolean; svcExiste: boolean; habilitado: boolean; enPeriodo: boolean; pasa: boolean }[];
  facturas: { id: string; servicioNombre: string; montoBs: number }[];
  cobrosGenerados: number;
}

export function Cobros() {
  const { snap, recargar, mapInq, mapSvc, deudas } = useSnapshot();
  const [periodo, setPeriodo] = useState(mesActual());
  const [aviso, setAviso] = useState<{ mensaje: string; tipo: 'ok' | 'error' } | null>(null);
  const [generando, setGenerando] = useState(false);
  const [diag, setDiag] = useState<Diagnostico | null>(null);
  const [cargandoDiag, setCargandoDiag] = useState(false);

  const datos = useMemo(() => {
    if (!snap) return null;
    const cobros = snap.cobros.filter((c) => c.periodo === periodo);
    const repartos = repartoServicios(snap, periodo);
    const alquileres = cobros.filter((c) => c.servicioId === ALQUILER_ID);
    const fuera = fueraDelReparto(snap, periodo);
    const porInq = new Map<string, Map<string, (typeof cobros)[number]>>();
    for (const c of cobros) {
      const m = porInq.get(c.inquilinoId) ?? new Map();
      m.set(c.servicioId, c);
      porInq.set(c.inquilinoId, m);
    }
    const svcIds = repartos.filter((r) => r.lineas.length > 0).map((r) => r.servicioId);
    const total = cobros.reduce((s, c) => s + (c.montoTotal || 0), 0);
    const totalAlquiler = alquileres.reduce((s, c) => s + (c.montoTotal || 0), 0);
    return { cobros, repartos, alquileres, fuera, porInq, svcIds, total, totalAlquiler };
  }, [snap, periodo]);

  const generar = async (svcId?: string) => {
    setGenerando(true);
    setAviso(null);
    try {
      const r = svcId ? await generarCobrosServicio(periodo, svcId) : await generarCobros(periodo);
      recargar();
      setAviso(r && r.length
        ? { mensaje: svcId ? `${nombreServicio(svcId, mapSvc)} recalculado (${r.length} cobros).` : `Cobros de ${mesLargo(periodo)} generados (${r.length}).`, tipo: 'ok' }
        : { mensaje: 'No se generó ningún cobro. Revisa que haya facturas y asignaciones, o abre el diagnóstico al final.', tipo: 'error' });
    } catch (e) {
      setAviso({ mensaje: e instanceof Error ? e.message : String(e), tipo: 'error' });
    } finally {
      setGenerando(false);
    }
  };

  const diagnosticar = async () => {
    setCargandoDiag(true);
    try {
      setDiag((await getDiagnostico(periodo)) as Diagnostico);
    } catch (e) {
      setAviso({ mensaje: e instanceof Error ? e.message : String(e), tipo: 'error' });
    } finally {
      setCargandoDiag(false);
    }
  };

  if (!snap || !datos) return <Cargando />;
  const { cobros, repartos, alquileres, fuera, porInq, svcIds, total, totalAlquiler } = datos;
  const conFactura = repartos.filter((r) => r.factura !== null);
  const totalFacturas = conFactura.reduce((s, r) => s + (r.factura ?? 0), 0);
  const desactualizados = repartos.filter((r) => r.desactualizado.length > 0);

  return (
    <div className="page">
      <div className="encabezado">
        <div>
          <h2>Cobros de {mesLargo(periodo)}</h2>
          <p>Cómo se reparte cada factura y cuánto le toca pagar a cada inquilino.</p>
        </div>
        <div className="no-imprimir" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <SelectorMes periodo={periodo} onCambiar={setPeriodo} />
          <button className="btn btn-primario" onClick={() => generar()} disabled={generando}>
            {generando ? 'Calculando…' : cobros.length ? 'Recalcular todo el mes' : 'Generar cobros del mes'}
          </button>
          <button className="btn btn-secundario" onClick={() => window.print()}><IcoImprimir /> Imprimir</button>
        </div>
      </div>

      {aviso && <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} onCerrar={() => setAviso(null)} />}

      <div className="ayuda">
        {cobros.length === 0 ? (
          <>Todavía no hay cobros en {mesLargo(periodo)}. Registra las facturas del mes, revisa las asignaciones y pulsa <strong>Generar cobros del mes</strong>.</>
        ) : (
          <>
            En {mesLargo(periodo)} se repartieron <strong>{conFactura.length} {conFactura.length === 1 ? 'factura' : 'facturas'}</strong> por{' '}
            <strong>{fmtBs(totalFacturas)}</strong> entre {porInq.size} inquilinos
            {totalAlquiler > 0 && <>, más <strong>{fmtBs(totalAlquiler)}</strong> de alquileres</>}. En total hay que cobrar <strong>{fmtBs(total)}</strong>.
          </>
        )}
      </div>

      <div className="cifras">
        <Cifra etiqueta="Total a cobrar" valor={fmtBs(total)} />
        <Cifra etiqueta="Servicios" valor={fmtBs(total - totalAlquiler)} nota={`${svcIds.length} servicios`} />
        <Cifra etiqueta="Alquileres" valor={fmtBs(totalAlquiler)} nota={`${alquileres.length} inquilinos`} />
        <Cifra etiqueta="Inquilinos" valor={String(porInq.size)} nota="con cobros este mes" />
      </div>

      {(fuera.length > 0 || desactualizados.length > 0) && (
        <div className="tareas" style={{ marginBottom: 16 }}>
          {fuera.map((f) => (
            <div key={f.nombre} className="tarea" style={{ cursor: 'default' }}>
              <IcoAlerta />
              <span>
                {f.nombre} vivió en la casa en {mesLargo(periodo)} pero no participa en ningún cobro: {f.motivo}.
                <small>Si debe pagar, asígnale servicios en Asignaciones (habilítalo si hace falta) y recalcula.</small>
              </span>
              <button className="tarea-ir btn btn-fantasma no-imprimir" onClick={() => irA('asignaciones')}>Asignar</button>
            </div>
          ))}
          {desactualizados.length > 0 && (
            <div className="tarea" style={{ cursor: 'default' }}>
              <IcoAlerta />
              <span>
                {desactualizados.length === 1 ? 'Un reparto no coincide' : `${desactualizados.length} repartos no coinciden`} con las asignaciones actuales: {desactualizados.map((r) => r.nombre).join(', ')}.
                <small>Revisa el detalle en cada servicio y recalcúlalo.</small>
              </span>
            </div>
          )}
        </div>
      )}

      {repartos.length > 0 && (
        <>
          <h3 className="titulo-seccion">Cómo se repartió cada servicio</h3>
          <div className="repartos">
            {repartos.map((r) => (
              <RepartoTarjeta key={r.servicioId} r={r} periodo={periodo} onRegenerar={generar} generando={generando} />
            ))}
            {alquileres.length > 0 && (
              <section className="seccion reparto">
                <div className="reparto-cab">
                  <div>
                    <h3>Alquiler</h3>
                    <span className="muted">Monto fijo acordado con cada inquilino</span>
                  </div>
                  <div className="reparto-factura">
                    <span className="cifra-etiqueta">Total</span>
                    <strong>{fmtBs(totalAlquiler)}</strong>
                  </div>
                </div>
                <div className="lista">
                  {alquileres.map((c) => (
                    <div key={c.id} className="lista-fila">
                      <span>{mapInq.get(c.inquilinoId)?.nombre ?? c.inquilinoId}</span>
                      <span className="monto">{fmtBs(c.montoTotal)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </>
      )}

      {porInq.size > 0 && (
        <Seccion titulo="Total por inquilino" descripcion="Lo que cada uno debe pagar este mes. Toca un nombre para ver su estado de cuenta.">
          <div className="tabla-wrap">
            <table className="tabla">
              <thead>
                <tr>
                  <th className="sticky-col">Inquilino</th>
                  {svcIds.map((id) => <th key={id} className="num">{nombreServicio(id, mapSvc)}</th>)}
                  <th className="num col-subtotal">Total servicios</th>
                  {alquileres.length > 0 && <th className="num">Alquiler</th>}
                  <th className="num">Total del mes</th>
                  <th>Deuda total</th>
                </tr>
              </thead>
              <tbody>
                {[...porInq.entries()]
                  .sort((a, b) => (mapInq.get(a[0])?.nombre ?? '').localeCompare(mapInq.get(b[0])?.nombre ?? ''))
                  .map(([inqId, m]) => {
                    const tot = [...m.values()].reduce((s, c) => s + (c.montoTotal || 0), 0);
                    const totServ = [...m.values()].filter((c) => c.servicioId !== ALQUILER_ID).reduce((s, c) => s + (c.montoTotal || 0), 0);
                    return (
                      <tr key={inqId} onClick={() => irA('reportes', { tab: 'cuenta', inq: inqId })} style={{ cursor: 'pointer' }}>
                        <td className="sticky-col celda-nombre">{mapInq.get(inqId)?.nombre ?? inqId}</td>
                        {svcIds.map((id) => {
                          const c = m.get(id);
                          return (
                            <td key={id} className="num">
                              {c ? <>{fmtBs(c.montoTotal)}<span className="mini-parte">{c.peso} de {c.pesoTotal} partes</span></> : <span className="muted">—</span>}
                            </td>
                          );
                        })}
                        <td className="num col-subtotal">{fmtBs(totServ)}</td>
                        {alquileres.length > 0 && <td className="num">{m.get(ALQUILER_ID) ? fmtBs(m.get(ALQUILER_ID)!.montoTotal) : <span className="muted">—</span>}</td>}
                        <td className="num"><strong>{fmtBs(tot)}</strong></td>
                        <td><EstadoDeuda saldo={deudas.get(inqId)?.saldo ?? 0} /></td>
                      </tr>
                    );
                  })}
              </tbody>
              <tfoot>
                <tr className="fila-total">
                  <td className="sticky-col">Total</td>
                  {svcIds.map((id) => <td key={id} className="num">{fmtBs(repartos.find((r) => r.servicioId === id)?.repartido ?? 0)}</td>)}
                  <td className="num col-subtotal">{fmtBs(total - totalAlquiler)}</td>
                  {alquileres.length > 0 && <td className="num">{fmtBs(totalAlquiler)}</td>}
                  <td className="num"><strong>{fmtBs(total)}</strong></td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Seccion>
      )}

      <details className="seccion tecnico no-imprimir">
        <summary>¿Falta un cobro? Diagnóstico técnico</summary>
        <p className="muted">Revisa qué asignaciones y facturas encuentra el sistema para {mesLargo(periodo)}.</p>
        <button className="btn btn-secundario" onClick={diagnosticar} disabled={cargandoDiag}>
          {cargandoDiag ? 'Revisando…' : 'Revisar ahora'}
        </button>
        {diag && (
          <div className="lista" style={{ marginTop: 10 }}>
            {diag.asignaciones.map((a) => (
              <div key={a.id} className="lista-fila">
                <span>
                  {mapInq.get(a.inquilinoId)?.nombre ?? a.inquilinoId} · {nombreServicio(a.servicioId, mapSvc)}
                  <small>
                    {a.pasa ? 'Se incluye en el reparto' : [
                      !a.activo && 'asignación inactiva',
                      !a.inqExiste && 'el inquilino no existe',
                      !a.svcExiste && 'el servicio no existe',
                      a.inqExiste && !a.habilitado && 'inquilino deshabilitado',
                      a.inqExiste && a.habilitado && !a.enPeriodo && 'no vivía en la casa ese mes',
                    ].filter(Boolean).join(', ')}
                  </small>
                </span>
                <span className={a.pasa ? 'texto-ok' : 'texto-debe'}>{a.pasa ? 'Incluido' : 'Excluido'}</span>
              </div>
            ))}
            {diag.facturas.map((f) => (
              <div key={f.id} className="lista-fila"><span>Factura {f.servicioNombre}</span><span className="monto">{fmtBs(f.montoBs)}</span></div>
            ))}
            {diag.asignaciones.length === 0 && <div className="vacio">No hay asignaciones en {mesLargo(periodo)}.</div>}
          </div>
        )}
      </details>
    </div>
  );
}
