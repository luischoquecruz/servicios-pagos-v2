import { Fragment, useMemo, useState } from 'react';
import { getReporteMensual } from '../api';
import { useSnapshot } from '../components/SnapshotContext';
import { usePolling } from '../hooks/usePolling';
import type { ReporteMensual } from '../types';
import { calcularDeudaPorConcepto, nombreMes } from '../deuda';
import { descargarCSV, fmtBs, mesActual, ALQUILER_ID } from '../utils';
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
                <th className="sticky-col">Inquilino</th>
                <th className="num">Cobrado</th>
                <th className="num">Pagado</th>
                <th className="num">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {r.porInquilino.map((t) => (
                <tr key={t.inquilinoId}>
                  <td className="sticky-col">{t.nombre}</td>
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
                <th className="sticky-col">Servicio</th>
                <th className="num">#</th>
                <th className="num">Cobrado</th>
                <th className="num">Pagado</th>
                <th className="num">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {r.porServicio.map((t) => (
                <tr key={t.servicioId}>
                  <td className="sticky-col">{t.nombre}</td>
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
                <th className="sticky-col">Inquilino</th>
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
                  <td className="sticky-col">{d.inquilinoNombre}</td>
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

interface FilaGestion {
  periodo: string;
  alquiler: number;
  servicios: number;
  cobrado: number;
  pagado: number;
  saldo: number;
  tieneDeuda: boolean;
}

interface GrupoGestion {
  inquilinoId: string;
  nombre: string;
  filas: FilaGestion[];
  totAlquiler: number;
  totServicios: number;
  totCobrado: number;
  totPagado: number;
  totSaldo: number;
  deudor: boolean;
}

function red2(n: number): number {
  return Math.round(n * 100) / 100;
}

function estadoBadge(deudor: boolean) {
  return deudor ? (
    <span className="estado estado-deuda">Debe</span>
  ) : (
    <span className="estado estado-al-dia">Al día</span>
  );
}

/**
 * Reporte general "por gestión": una fila por inquilino × periodo, agrupada por
 * inquilino, con desglose de servicios vs alquiler, pagado y deuda. Reutiliza la
 * misma asignacion de pagos (primero al mes del pago, sobrante a la deuda mas
 * antigua) que la pantalla de Pagos, calculado desde el snapshot local.
 */
function ReporteGeneralPag() {
  const { snap, info } = useSnapshot();

  const grupos = useMemo<GrupoGestion[]>(() => {
    if (!snap) return [];
    const cobros = snap.cobros ?? [];
    const pagos = snap.pagos ?? [];
    const list: GrupoGestion[] = [];

    for (const inq of snap.inquilinos) {
      const deuda = calcularDeudaPorConcepto(inq.id, cobros, pagos);
      if (deuda.mensual.length === 0) continue;

      const filas = deuda.mensual.map<FilaGestion>((m) => {
        const celda = deuda.filas.find((f) => f.periodo === m.periodo);
        let alquiler = 0;
        let servicios = 0;
        if (celda) {
          for (const [clave, c] of celda.celdas) {
            if (clave === ALQUILER_ID) alquiler += c.cobrado;
            else if (clave !== '__general__') servicios += c.cobrado;
          }
        }
        const saldo = red2(m.saldo);
        return {
          periodo: m.periodo,
          alquiler: red2(alquiler),
          servicios: red2(servicios),
          cobrado: red2(m.cobrado),
          pagado: red2(m.pagado),
          saldo,
          tieneDeuda: saldo > 0.005,
        };
      });

      const suma = (k: 'alquiler' | 'servicios' | 'cobrado' | 'pagado' | 'saldo') =>
        filas.reduce((s, f) => s + f[k], 0);
      const totSaldo = red2(suma('saldo'));

      list.push({
        inquilinoId: inq.id,
        nombre: inq.nombre,
        filas,
        totAlquiler: red2(suma('alquiler')),
        totServicios: red2(suma('servicios')),
        totCobrado: red2(suma('cobrado')),
        totPagado: red2(suma('pagado')),
        totSaldo,
        deudor: totSaldo > 0.005,
      });
    }

    // Deudores primero, luego por nombre.
    list.sort((a, b) => b.totSaldo - a.totSaldo || a.nombre.localeCompare(b.nombre));
    return list;
  }, [snap]);

  const totales = useMemo(
    () => ({
      alquiler: red2(grupos.reduce((s, g) => s + g.totAlquiler, 0)),
      servicios: red2(grupos.reduce((s, g) => s + g.totServicios, 0)),
      cobrado: red2(grupos.reduce((s, g) => s + g.totCobrado, 0)),
      pagado: red2(grupos.reduce((s, g) => s + g.totPagado, 0)),
      saldo: red2(grupos.reduce((s, g) => s + g.totSaldo, 0)),
    }),
    [grupos],
  );

  if (!snap) return <Cargando />;

  const exportar = () => {
    const filas: (string | number)[][] = [
      ['Gestion', 'Inquilino', 'Periodo', 'Servicios (Bs)', 'Alquiler (Bs)', 'Total (Bs)', 'Pagado (Bs)', 'Deuda (Bs)'],
    ];
    for (const g of grupos) {
      for (const f of g.filas) {
        filas.push([g.nombre, '', nombreMes(f.periodo), f.servicios, f.alquiler, f.cobrado, f.pagado, f.saldo]);
      }
      filas.push([g.nombre, 'Subtotal', '', g.totServicios, g.totAlquiler, g.totCobrado, g.totPagado, g.totSaldo]);
    }
    filas.push(['', 'TOTAL GENERAL', '', totales.servicios, totales.alquiler, totales.cobrado, totales.pagado, totales.saldo]);
    descargarCSV('reporte-general-gestion.csv', filas);
  };

  const conDeuda = grupos.filter((g) => g.deudor).length;

  return (
    <div className="panel">
      <div className="toolbar">
        <Boton variante="secundario" onClick={exportar} disabled={grupos.length === 0}>
          Exportar CSV
        </Boton>
        <Boton variante="secundario" onClick={() => window.print()} disabled={grupos.length === 0}>
          Imprimir PDF
        </Boton>
      </div>

      <div className="area-imprimible">
        <div className="imprimir-encabezado">
          <h1>Reporte general por gestión</h1>
          <div className="linea">{info?.nombre ?? 'Alquileres'}</div>
          <div className="linea">
            Generado el {new Date().toLocaleString('es-BO')} · {grupos.length} gestiones
            {conDeuda > 0 ? ` · ${conDeuda} con deuda` : ''}
          </div>
        </div>

        <ResumenCards cobrado={totales.cobrado} pagado={totales.pagado} saldo={totales.saldo} />

      <section className="panel">
        <h3>
          Por gestión · {grupos.length} {grupos.length === 1 ? 'gestion' : 'gestiones'}
          {conDeuda > 0 ? ` · ${conDeuda} con deuda` : ''}
        </h3>
        <p className="muted">
          Agrupado por inquilino. La deuda aplica los pagos primero al mes indicado y el
          sobrante a la deuda más antigua.
        </p>
        <div className="tabla-wrap">
          <table className="tabla tabla-gestion">
            <thead>
              <tr>
                <th>Inquilino</th>
                <th>Periodo</th>
                <th className="num">Servicios</th>
                <th className="num">Alquiler</th>
                <th className="num">Total</th>
                <th className="num">Pagado</th>
                <th className="num">Deuda</th>
                <th className="centro">Estado</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <Fragment key={g.inquilinoId}>
                  <tr className="fila-grupo">
                    <td colSpan={2} className="celda-nombre">{g.nombre}</td>
                    <td className="num">{fmtBs(g.totServicios)}</td>
                    <td className="num">{fmtBs(g.totAlquiler)}</td>
                    <td className="num"><strong>{fmtBs(g.totCobrado)}</strong></td>
                    <td className="num">{fmtBs(g.totPagado)}</td>
                    <td className={`num ${g.deudor ? 'saldo-neg' : ''}`}>{fmtBs(g.totSaldo)}</td>
                    <td className="centro">{estadoBadge(g.deudor)}</td>
                  </tr>
                  {g.filas.map((f) => (
                    <tr key={`${g.inquilinoId}-${f.periodo}`}>
                      <td />
                      <td>{nombreMes(f.periodo)}</td>
                      <td className="num">{fmtBs(f.servicios)}</td>
                      <td className="num">{fmtBs(f.alquiler)}</td>
                      <td className="num">{fmtBs(f.cobrado)}</td>
                      <td className="num">{fmtBs(f.pagado)}</td>
                      <td className={`num ${f.tieneDeuda ? 'saldo-neg' : ''}`}>{fmtBs(f.saldo)}</td>
                      <td className="centro">{estadoBadge(f.tieneDeuda)}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {grupos.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted">
                    Genera los cobros para ver el reporte por gestión.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="fila-total">
                <td colSpan={2}>TOTAL GENERAL</td>
                <td className="num">{fmtBs(totales.servicios)}</td>
                <td className="num">{fmtBs(totales.alquiler)}</td>
                <td className="num"><strong>{fmtBs(totales.cobrado)}</strong></td>
                <td className="num">{fmtBs(totales.pagado)}</td>
                <td className={`num ${totales.saldo > 0 ? 'saldo-neg' : ''}`}>{fmtBs(totales.saldo)}</td>
                <td className="centro">{estadoBadge(totales.saldo > 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
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
