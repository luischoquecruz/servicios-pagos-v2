import { useState } from 'react';
import { getReporteGeneral, getReporteMensual } from '../api';
import { usePolling } from '../hooks/usePolling';
import type { ReporteGeneral, ReporteMensual } from '../types';
import { descargarCSV, fmtBs, mesActual } from '../utils';
import { Cargando } from '../components/ui/Cargando';
import { Boton } from '../components/ui/Boton';
import { Aviso } from '../components/ui/Aviso';
import { POLL_MS } from '../modo';

type Pestaña = 'mensual' | 'general';

export function Reportes() {
  const [pestaña, setPestaña] = useState<Pestaña>('mensual');
  const [periodo, setPeriodo] = useState(mesActual());

  return (
    <div className="page">
      <div className="page-head">
        <h2>Reportes</h2>
        <div className="pestanas" role="tablist">
          <button
            className={`tab ${pestaña === 'mensual' ? 'tab-activa' : ''}`}
            onClick={() => setPestaña('mensual')}
          >
            Mensual
          </button>
          <button
            className={`tab ${pestaña === 'general' ? 'tab-activa' : ''}`}
            onClick={() => setPestaña('general')}
          >
            General
          </button>
        </div>
      </div>

      {pestaña === 'mensual' ? (
        <ReporteMensualPag periodo={periodo} onPeriodo={setPeriodo} />
      ) : (
        <ReporteGeneralPag />
      )}
    </div>
  );
}

function ResumenCards({ cobrado, pagado, saldo }: { cobrado: number; pagado: number; saldo: number }) {
  return (
    <div className="cards">
      <div className="card card-info">
        <span className="card-label">Total cobrado</span>
        <span className="card-value">{fmtBs(cobrado)}</span>
      </div>
      <div className="card card-info">
        <span className="card-label">Total pagado</span>
        <span className="card-value">{fmtBs(pagado)}</span>
      </div>
      <div className={`card ${saldo > 0 ? 'card-mal' : 'card-ok'}`}>
        <span className="card-label">Saldo pendiente</span>
        <span className="card-value">{fmtBs(saldo)}</span>
      </div>
    </div>
  );
}

function ReporteMensualPag({ periodo, onPeriodo }: { periodo: string; onPeriodo: (p: string) => void }) {
  const { data, error, cargando } = usePolling<ReporteMensual>(
    () => getReporteMensual(periodo),
    POLL_MS,
    !!periodo,
  );

  if (cargando && !data) return <Cargando />;
  if (error && !data) return <Aviso mensaje={error} tipo="error" onCerrar={() => undefined} />;

  const r = data!;

  const extraKeys = extraKeysDe(r.detalle);

  const exportarDetalle = () => {
    const header = ['Inquilino', 'Servicio', 'Peso', 'Cuartos', 'Personas', ...extraKeys,
      'Base (Bs)', 'Extras (Bs)', 'Total (Bs)', 'Pagado (Bs)', 'Saldo (Bs)'];
    const rows = r.detalle.map((d) => [
      d.inquilinoNombre, d.servicioNombre, String(d.peso), String(d.pesoTotal),
      String(d.habitaciones), String(d.personas),
      ...extraKeys.map((k) => String(d.extras[k] ?? 0)),
      String(d.montoBase), String(d.montoExtra), String(d.montoTotal),
      String(d.pagado), String(d.saldo),
    ]);
    descargarCSV(`reporte-${r.periodo}.csv`, [header, ...rows]);
  };

  return (
    <div className="panel">
      <div className="toolbar">
        <label className="campo campo-inline">
          <span className="campo-label">Periodo</span>
          <input
            className="input"
            type="month"
            value={periodo}
            onChange={(e) => onPeriodo(e.target.value)}
          />
        </label>
        <Boton variante="secundario" onClick={exportarDetalle}>
          Exportar CSV
        </Boton>
      </div>

      <ResumenCards cobrado={r.totalCobrado} pagado={r.totalPagado} saldo={r.saldo} />

      <div className="grid2">
        <section className="panel">
          <h3>Por inquilino</h3>
          <table className="tabla">
            <thead>
              <tr>
                <th>Inquilino</th>
                <th className="num">Cobrado</th>
                <th className="num">Pagado</th>
                <th className="num">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {r.porInquilino.map((t) => (
                <tr key={t.inquilinoId}>
                  <td>{t.nombre}</td>
                  <td className="num">{fmtBs(t.cobrado)}</td>
                  <td className="num">{fmtBs(t.pagado)}</td>
                  <td className={`num ${t.saldo > 0 ? 'saldo-neg' : ''}`}>{fmtBs(t.saldo)}</td>
                </tr>
              ))}
              {r.porInquilino.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    Sin datos para este periodo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h3>Por servicio</h3>
          <table className="tabla">
            <thead>
              <tr>
                <th>Servicio</th>
                <th className="num">#</th>
                <th className="num">Cobrado</th>
                <th className="num">Pagado</th>
                <th className="num">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {r.porServicio.map((t) => (
                <tr key={t.servicioId}>
                  <td>{t.nombre}</td>
                  <td className="num">{t.cantidadCobros}</td>
                  <td className="num">{fmtBs(t.cobrado)}</td>
                  <td className="num">{fmtBs(t.pagado)}</td>
                  <td className={`num ${t.saldo > 0 ? 'saldo-neg' : ''}`}>{fmtBs(t.saldo)}</td>
                </tr>
              ))}
              {r.porServicio.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    Sin datos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      <section className="panel">
        <h3>Detalle linea por linea</h3>
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Inquilino</th>
                <th>Servicio</th>
                <th className="num">Peso</th>
                <th className="num">Cuartos</th>
                <th className="num">Personas</th>
                {extraKeys.map((k) => (
                  <th key={k} className="num">{k}</th>
                ))}
                <th className="num">Base</th>
                <th className="num">Extras</th>
                <th className="num">Total</th>
                <th className="num">Pagado</th>
                <th className="num">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {r.detalle.map((d) => (
                <tr key={d.id}>
                  <td>{d.inquilinoNombre}</td>
                  <td>{d.servicioNombre}</td>
                  <td className="num">{d.peso}/{d.pesoTotal}</td>
                  <td className="num">{d.habitaciones}</td>
                  <td className="num">{d.personas}</td>
                  {extraKeys.map((k) => (
                    <td key={k} className="num">{d.extras[k] ?? 0}</td>
                  ))}
                  <td className="num">{fmtBs(d.montoBase)}</td>
                  <td className="num">{fmtBs(d.montoExtra)}</td>
                  <td className="num">
                    <strong>{fmtBs(d.montoTotal)}</strong>
                  </td>
                  <td className="num">{fmtBs(d.pagado)}</td>
                  <td className={`num ${d.saldo > 0 ? 'saldo-neg' : ''}`}>{fmtBs(d.saldo)}</td>
                </tr>
              ))}
              {r.detalle.length === 0 && (
                <tr>
                  <td colSpan={5 + extraKeys.length + 5} className="muted">
                    Genera los cobros de este periodo para ver el detalle.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ReporteGeneralPag() {
  const { data, error, cargando } = usePolling<ReporteGeneral>(getReporteGeneral, POLL_MS);

  if (cargando && !data) return <Cargando />;
  if (error && !data) return <Aviso mensaje={error} tipo="error" onCerrar={() => undefined} />;

  const r = data!;

  const exportarPorInquilino = () => {
    descargarCSV('reporte-general-inquilinos.csv', [
      ['Inquilino', 'Cobrado (Bs)', 'Pagado (Bs)', 'Saldo (Bs)'],
      ...r.porInquilino.map((t) => [t.nombre, String(t.cobrado), String(t.pagado), String(t.saldo)]),
    ]);
  };

  return (
    <div className="panel">
      <div className="toolbar">
        <Boton variante="secundario" onClick={exportarPorInquilino}>
          Exportar CSV
        </Boton>
      </div>

      <ResumenCards cobrado={r.totalCobrado} pagado={r.totalPagado} saldo={r.saldo} />

      <section className="panel">
        <h3>Por periodo</h3>
        <table className="tabla">
          <thead>
            <tr>
              <th>Periodo</th>
              <th className="num">Cobrado</th>
              <th className="num">Pagado</th>
              <th className="num">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {r.porPeriodo.map((t) => (
              <tr key={t.periodo}>
                <td>{t.periodo}</td>
                <td className="num">{fmtBs(t.cobrado)}</td>
                <td className="num">{fmtBs(t.pagado)}</td>
                <td className={`num ${t.saldo > 0 ? 'saldo-neg' : ''}`}>{fmtBs(t.saldo)}</td>
              </tr>
            ))}
            {r.porPeriodo.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  Sin cobros generados todavia.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <div className="grid2">
        <section className="panel">
          <h3>Por inquilino</h3>
          <table className="tabla">
            <thead>
              <tr>
                <th>Inquilino</th>
                <th className="num">Cobrado</th>
                <th className="num">Pagado</th>
                <th className="num">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {r.porInquilino.map((t) => (
                <tr key={t.inquilinoId}>
                  <td>{t.nombre}</td>
                  <td className="num">{fmtBs(t.cobrado)}</td>
                  <td className="num">{fmtBs(t.pagado)}</td>
                  <td className={`num ${t.saldo > 0 ? 'saldo-neg' : ''}`}>{fmtBs(t.saldo)}</td>
                </tr>
              ))}
              {r.porInquilino.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    Sin datos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h3>Por servicio</h3>
          <table className="tabla">
            <thead>
              <tr>
                <th>Servicio</th>
                <th className="num">Cobrado</th>
                <th className="num">Pagado</th>
                <th className="num">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {r.porServicio.map((t) => (
                <tr key={t.servicioId}>
                  <td>{t.nombre}</td>
                  <td className="num">{fmtBs(t.cobrado)}</td>
                  <td className="num">{fmtBs(t.pagado)}</td>
                  <td className={`num ${t.saldo > 0 ? 'saldo-neg' : ''}`}>{fmtBs(t.saldo)}</td>
                </tr>
              ))}
              {r.porServicio.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    Sin datos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function extraKeysDe(detalle: { extras: Record<string, number> }[]): string[] {
  const keys = new Set<string>();
  for (const d of detalle) {
    for (const k of Object.keys(d.extras ?? {})) {
      keys.add(k);
    }
  }
  return [...keys].sort();
}
