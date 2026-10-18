import { useMemo, useState } from 'react';
import { useSnapshot } from '../components/SnapshotContext';
import { Cargando } from '../components/ui/Cargando';
import { Cifra, Seccion } from '../components/Partes';
import { BarrasAgrupadas } from '../components/Graficos';
import { IcoDescargar, IcoImprimir } from '../components/Iconos';
import { aniosDisponibles, historialAnual, mesLargo, nombreMes } from './modelo';
import { descargarCSV, fmtBs } from '../utils';
import { irA } from '../nav';

const CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** Historial del año: evolucion mes a mes, por servicio y por inquilino. */
export function HistorialPag() {
  const { snap, deudas } = useSnapshot();
  const anios = useMemo(() => (snap ? aniosDisponibles(snap) : []), [snap]);
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const h = useMemo(() => (snap ? historialAnual(snap, anio, deudas) : null), [snap, anio, deudas]);
  if (!snap || !h) return <Cargando />;

  const conDatos = h.meses.map((m, i) => ({ m, i })).filter(({ m }) => m.cobrado > 0 || m.facturado > 0);
  const maxSvc = Math.max(1, ...h.servicios.flatMap((s) => s.porMes.map((v) => v ?? 0)));

  const exportar = () => {
    const filas: (string | number)[][] = [['Mes', 'Facturas', 'Cobrado', 'Pagado', 'Falta']];
    for (const m of h.meses) filas.push([nombreMes(m.periodo), m.facturado, m.cobrado, m.aplicado, m.pendiente]);
    filas.push(['Total', h.totales.facturado, h.totales.cobrado, h.totales.aplicado, h.totales.pendiente]);
    filas.push([], ['Servicio', ...CORTO, 'Total']);
    for (const s of h.servicios) filas.push([s.nombre, ...s.porMes.map((v) => v ?? ''), s.total]);
    descargarCSV(`historial-${anio}.csv`, filas);
  };

  return (
    <div>
      <div className="encabezado">
        <div>
          <h2>Historial {anio}</h2>
          <p>Cómo evolucionaron cobros y pagos durante el año.</p>
        </div>
        <div className="no-imprimir" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="chips">
            {anios.map((a) => <button key={a} className={`chip ${a === anio ? 'activo' : ''}`} onClick={() => setAnio(a)}>{a}</button>)}
          </div>
          <button className="btn btn-secundario" onClick={() => window.print()}><IcoImprimir /> Imprimir</button>
          <button className="btn btn-secundario" onClick={exportar}><IcoDescargar /> CSV</button>
        </div>
      </div>

      <div className="cifras">
        <Cifra etiqueta="Facturas del año" valor={fmtBs(h.totales.facturado)} />
        <Cifra etiqueta="Cobrado" valor={fmtBs(h.totales.cobrado)} nota="servicios + alquiler" />
        <Cifra etiqueta="Pagado" valor={fmtBs(h.totales.aplicado)} />
        <Cifra etiqueta="Falta cobrar" valor={fmtBs(h.totales.pendiente)} />
      </div>

      <Seccion titulo="Cobrado y pagado por mes" descripcion="Toca una columna para ver los montos.">
        {conDatos.length === 0 ? (
          <div className="vacio">Sin movimientos en {anio}.</div>
        ) : (
          <BarrasAgrupadas
            etiquetas={CORTO}
            titulosTooltip={h.meses.map((m) => mesLargo(m.periodo))}
            series={[
              { nombre: 'Cobrado', color: 'var(--serie-1)', valores: h.meses.map((m) => m.cobrado) },
              { nombre: 'Pagado', color: 'var(--serie-2)', valores: h.meses.map((m) => m.aplicado) },
            ]}
          />
        )}
        <div className="tabla-wrap" style={{ marginTop: 12 }}>
          <table className="tabla">
            <thead>
              <tr><th>Mes</th><th className="num">Facturas</th><th className="num">Cobrado</th><th className="num">Pagado</th><th className="num">Falta</th></tr>
            </thead>
            <tbody>
              {conDatos.map(({ m }) => (
                <tr key={m.periodo}>
                  <td style={{ textTransform: 'capitalize' }}>{mesLargo(m.periodo)}</td>
                  <td className="num">{fmtBs(m.facturado)}</td>
                  <td className="num">{fmtBs(m.cobrado)}</td>
                  <td className="num">{fmtBs(m.aplicado)}</td>
                  <td className={`num ${m.pendiente > 0.005 ? 'texto-debe' : ''}`}>{fmtBs(m.pendiente)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="fila-total">
                <td>Total</td>
                <td className="num">{fmtBs(h.totales.facturado)}</td>
                <td className="num">{fmtBs(h.totales.cobrado)}</td>
                <td className="num">{fmtBs(h.totales.aplicado)}</td>
                <td className="num">{fmtBs(h.totales.pendiente)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Seccion>

      {h.servicios.length > 0 && (
        <Seccion titulo="Facturas por servicio" descripcion="Importe de cada factura mes a mes; el tono más intenso indica un monto mayor.">
          <div className="tabla-wrap">
            <table className="tabla calor">
              <thead>
                <tr><th className="sticky-col">Servicio</th>{CORTO.map((c) => <th key={c} className="num">{c}</th>)}<th className="num">Total</th></tr>
              </thead>
              <tbody>
                {h.servicios.map((s) => (
                  <tr key={s.servicioId}>
                    <td className="sticky-col celda-nombre">{s.nombre}</td>
                    {s.porMes.map((v, i) => (
                      <td key={i} className="celda-calor" style={v ? { background: `color-mix(in srgb, var(--serie-1) ${Math.round(8 + (v / maxSvc) * 40)}%, var(--panel))` } : undefined}>
                        {v === null ? <span className="muted">—</span> : v.toLocaleString('es-BO', { maximumFractionDigits: 0 })}
                      </td>
                    ))}
                    <td className="num"><strong>{fmtBs(s.total)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Seccion>
      )}

      {h.inquilinos.length > 0 && (
        <Seccion titulo="Inquilinos mes a mes" descripcion="Cada celda muestra lo que falta pagar de ese mes; «al día» si ya está pagado.">
          <div className="tabla-wrap">
            <table className="tabla">
              <thead>
                <tr><th className="sticky-col">Inquilino</th>{CORTO.map((c) => <th key={c} className="centro">{c}</th>)}<th className="num">Falta</th></tr>
              </thead>
              <tbody>
                {h.inquilinos.map((q) => (
                  <tr key={q.inquilinoId} onClick={() => irA('reportes', { tab: 'cuenta', inq: q.inquilinoId })} style={{ cursor: 'pointer' }}>
                    <td className="sticky-col celda-nombre">{q.nombre}</td>
                    {q.porMes.map((c, i) => (
                      <td key={i} className="centro" style={{ fontSize: 12 }}>
                        {c.cobrado <= 0 ? <span className="muted">—</span>
                          : c.saldo > 0.005 ? <span className="texto-debe">{c.saldo.toLocaleString('es-BO', { maximumFractionDigits: c.saldo < 10 ? 2 : 0 })}</span>
                            : <span className="texto-ok">al día</span>}
                      </td>
                    ))}
                    <td className={`num ${q.saldo > 0.005 ? 'texto-debe' : ''}`}><strong>{fmtBs(q.saldo)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Seccion>
      )}
    </div>
  );
}
