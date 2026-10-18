import { Fragment, useMemo, useState } from 'react';
import { useSnapshot } from '../components/SnapshotContext';
import type { Snapshot, Servicio } from '../types';
import { calcularDeudaPorConcepto, nombreMes } from '../deuda';
import { descargarCSV, fmtBs, mesActual, ALQUILER_ID } from '../utils';
import { Cargando } from '../components/ui/Cargando';
import { Boton } from '../components/ui/Boton';
import { Aviso } from '../components/ui/Aviso';
import { irA } from '../nav';
import { FiltroConceptos, useFiltroConceptos } from '../components/FiltroConceptos';
import type { Filtro } from '../reportes/modelo';
import { ResumenMesPag } from '../reportes/ResumenMes';
import { EstadoCuentaPag } from '../reportes/EstadoCuenta';
import { HistorialPag } from '../reportes/Historial';

type Pestaña = 'mes' | 'cuenta' | 'anual' | 'detalle' | 'gestion';

const PESTANAS: { id: Pestaña; texto: string }[] = [
  { id: 'mes', texto: 'Resumen del mes' },
  { id: 'cuenta', texto: 'Estado de cuenta' },
  { id: 'anual', texto: 'Historial anual' },
  { id: 'detalle', texto: 'Detalle del mes' },
  { id: 'gestion', texto: 'Por inquilino' },
];

export function Reportes({ params }: { params: URLSearchParams }) {
  const pestaña = (PESTANAS.find((p) => p.id === params.get('tab'))?.id ?? 'mes') as Pestaña;
  const [periodo, setPeriodo] = useState(mesActual());
  const { snap } = useSnapshot();
  const [filtro, setExcluidos] = useFiltroConceptos(snap);

  return (
    <div className="page">
      <div className="page-head no-imprimir">
        <h2>Reportes</h2>
      </div>
      <div className="chips no-imprimir" role="tablist" style={{ marginBottom: 18 }}>
        {PESTANAS.map((p) => (
          <button key={p.id} role="tab" aria-selected={pestaña === p.id}
            className={`chip ${pestaña === p.id ? 'activo' : ''}`}
            onClick={() => irA('reportes', { tab: p.id })}>
            {p.texto}
          </button>
        ))}
      </div>

      {snap && <FiltroConceptos snap={snap} filtro={filtro} onCambiar={setExcluidos} />}

      {pestaña === 'mes' && <ResumenMesPag filtro={filtro} />}
      {pestaña === 'cuenta' && <EstadoCuentaPag inquilinoId={params.get('inq')} conceptos={filtro} />}
      {pestaña === 'anual' && <HistorialPag filtro={filtro} />}
      {pestaña === 'detalle' && <ReporteMensualPag periodo={periodo} onPeriodo={setPeriodo} filtro={filtro} />}
      {pestaña === 'gestion' && <ReporteGeneralPag filtro={filtro} />}
    </div>
  );
}

function ResumenCards({ cobrado, pagado, saldo }: { cobrado: number; pagado: number; saldo: number }) {
  const aFavor = saldo < 0;
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
      <div className={`card ${aFavor ? 'card-ok' : saldo > 0 ? 'card-mal' : 'card-info'}`}>
        <span className="card-label">{aFavor ? 'Saldo a favor' : 'Saldo pendiente'}</span>
        <span className="card-value">{fmtBs(Math.abs(saldo))}</span>
      </div>
    </div>
  );
}

interface FilaPorInquilino {
  inquilinoId: string;
  nombre: string;
  servicios: number;
  alquiler: number;
  cobrado: number;
  pagado: number;
  saldo: number;
}

interface FilaPorServicio {
  servicioId: string | null;
  nombre: string;
  cantidadCobros: number;
  cobrado: number;
  pagado: number;
  saldo: number;
}

interface FilaDetalleMensual {
  id: string;
  inquilinoId: string;
  inquilinoNombre: string;
  servicioId: string;
  servicioNombre: string;
  peso: number;
  pesoTotal: number;
  montoBase: number;
  montoExtra: number;
  montoTotal: number;
  habitaciones: number;
  personas: number;
  extras: Record<string, number>;
  pagado: number;
  saldo: number;
}

interface MensualLocal {
  porInquilino: FilaPorInquilino[];
  porServicio: FilaPorServicio[];
  detalle: FilaDetalleMensual[];
  totalCobrado: number;
  totalPagado: number;
  saldo: number;
}

function nombreDeServicio(svcId: string, mapSvc: Map<string, Servicio>): string {
  if (svcId === ALQUILER_ID) return 'Alquiler';
  return mapSvc.get(svcId)?.nombre ?? svcId;
}

/**
 * Reporte mensual calculado desde el snapshot con la misma asignación de pagos
 * del historial (pago primero al mes indicado y el sobrante a la deuda más
 * antigua). Así un pago general que cubre meses adeudados aparece pagado en el
 * mes que corresponda y no como "saldo a favor" del mes en que se registró.
 */
function calcularMensual(snap: Snapshot, periodo: string, mapSvc: Map<string, Servicio>, filtro?: Filtro): MensualLocal {
  const incluye = (id: string) => !filtro || filtro.has(id);
  const porInq: FilaPorInquilino[] = [];
  const porSvc = new Map<string, FilaPorServicio>();
  const detalle: FilaDetalleMensual[] = [];

  for (const inq of snap.inquilinos) {
    const d = calcularDeudaPorConcepto(inq.id, snap.cobros, snap.pagos);
    let fServ = 0;
    let fAlq = 0;
    let fPag = 0;
    for (const [k, c] of d.detalleMes.get(periodo) ?? []) {
      if (!incluye(k)) continue;
      if (k === ALQUILER_ID) fAlq += c.cobrado;
      else fServ += c.cobrado;
      fPag += c.pagado;
    }
    const fila = { cobrado: fServ + fAlq, pagado: fPag, saldo: fServ + fAlq - fPag };
    if (fila.cobrado <= 0.005 && fila.pagado <= 0.005) continue;

    porInq.push({
      inquilinoId: inq.id,
      nombre: inq.nombre,
      servicios: red2(fServ),
      alquiler: red2(fAlq),
      cobrado: red2(fila.cobrado),
      pagado: red2(fila.pagado),
      saldo: red2(fila.saldo),
    });

    const celda = d.filas.find((f) => f.periodo === periodo);
    const genPagado = celda?.celdas.get('__general__')?.pagado ?? 0;

    // Saldo restante por concepto en este mes: base para repartir el pago general.
    const saldoConc = new Map<string, number>();
    let totalSaldo = 0;
    for (const [k, c] of celda?.celdas ?? []) {
      if (k === '__general__') continue;
      const s = Math.max(0, c.cobrado - c.pagado);
      saldoConc.set(k, s);
      totalSaldo += s;
    }

    const cobrosMes = snap.cobros.filter((c) => c.inquilinoId === inq.id && c.periodo === periodo && incluye(c.servicioId));
    const cobradoConc = new Map<string, number>();
    for (const c of cobrosMes) {
      cobradoConc.set(c.servicioId, (cobradoConc.get(c.servicioId) ?? 0) + (c.montoTotal || 0));
    }

    for (const [svcId, tot] of cobradoConc) {
      const etiq = celda?.celdas.get(svcId)?.pagado ?? 0;
      const s = saldoConc.get(svcId) ?? 0;
      const shareGen = genPagado > 0 && totalSaldo > 0 && s > 0 ? (genPagado * s) / totalSaldo : 0;
      const pagadoConc = Math.min(tot, etiq + shareGen);

      const rows = cobrosMes.filter((c) => c.servicioId === svcId);
      const nombre = nombreDeServicio(svcId, mapSvc);
      const prev = porSvc.get(svcId);
      porSvc.set(svcId, {
        servicioId: svcId,
        nombre,
        cantidadCobros: (prev?.cantidadCobros ?? 0) + rows.length,
        cobrado: red2((prev?.cobrado ?? 0) + tot),
        pagado: red2((prev?.pagado ?? 0) + pagadoConc),
        saldo: red2((prev?.saldo ?? 0) + Math.max(0, tot - pagadoConc)),
      });

      for (const c of rows) {
        const share = tot > 0 ? Math.min(1, (c.montoTotal || 0) / tot) : 0;
        const pagLinea = Math.min(c.montoTotal || 0, pagadoConc * share);
        detalle.push({
          id: c.id,
          inquilinoId: inq.id,
          inquilinoNombre: inq.nombre,
          servicioId: svcId,
          servicioNombre: nombre,
          peso: c.peso,
          pesoTotal: c.pesoTotal,
          montoBase: c.montoBase,
          montoExtra: c.montoExtra,
          montoTotal: c.montoTotal,
          habitaciones: c.habitaciones,
          personas: c.personas,
          extras: c.extras ?? {},
          pagado: red2(pagLinea),
          saldo: red2((c.montoTotal || 0) - pagLinea),
        });
      }
    }
  }

  porInq.sort((a, b) => b.saldo - a.saldo || a.nombre.localeCompare(b.nombre));
  const porServicio = [...porSvc.values()].sort(
    (a, b) => b.cobrado - a.cobrado || a.nombre.localeCompare(b.nombre),
  );
  detalle.sort((a, b) => a.inquilinoNombre.localeCompare(b.inquilinoNombre));

  const totalCobrado = red2(porInq.reduce((s, t) => s + t.cobrado, 0));
  const totalPagado = red2(porInq.reduce((s, t) => s + t.pagado, 0));
  return {
    porInquilino: porInq,
    porServicio,
    detalle,
    totalCobrado,
    totalPagado,
    saldo: red2(totalCobrado - totalPagado),
  };
}

function ReporteMensualPag({ periodo, onPeriodo, filtro }: { periodo: string; onPeriodo: (p: string) => void; filtro: Filtro }) {
  const { snap, mapSvc, error } = useSnapshot();

  const r = useMemo<MensualLocal | null>(
    () => (snap ? calcularMensual(snap, periodo, mapSvc, filtro) : null),
    [snap, periodo, mapSvc, filtro],
  );

  if (!snap && !error) return <Cargando />;
  if (error && !snap) return <Aviso mensaje={error} tipo="error" onCerrar={() => undefined} />;
  if (!r) return <Cargando />;

  const extraKeys = extraKeysDe(r.detalle);

  const exportarDetalle = () => {
    const header = ['Inquilino', 'Servicio', 'Peso', 'Cuartos', 'Personas', ...extraKeys,
      'Base (Bs)', 'Extras (Bs)', 'Total (Bs)', 'Pagado (Bs)', 'Saldo (Bs)'];
    const rows = r.detalle.map((d) => [
      d.inquilinoNombre, d.servicioNombre, `${d.peso}/${d.pesoTotal}`,
      String(d.habitaciones), String(d.personas),
      ...extraKeys.map((k) => String(d.extras[k] ?? 0)),
      String(d.montoBase), String(d.montoExtra), String(d.montoTotal),
      String(d.pagado), String(d.saldo),
    ]);
    descargarCSV(`reporte-${periodo}.csv`, [header, ...rows]);
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
                <th className="num col-subtotal">Total servicios</th>
                <th className="num">Alquiler</th>
                <th className="num">Cobrado</th>
                <th className="num">Pagado</th>
                <th className="num">Deuda</th>
                <th className="centro">Estado</th>
              </tr>
            </thead>
            <tbody>
              {r.porInquilino.map((t) => {
                const deuda = Math.max(0, t.saldo);
                const favor = Math.max(0, -t.saldo);
                return (
                  <tr key={t.inquilinoId}>
                    <td className="sticky-col">{t.nombre}</td>
                    <td className="num col-subtotal">{fmtBs(t.servicios)}</td>
                    <td className="num">{fmtBs(t.alquiler)}</td>
                    <td className="num">{fmtBs(t.cobrado)}</td>
                    <td className="num">{fmtBs(t.pagado)}</td>
                    <td className="num">
                      {deuda > 0 ? <span className="saldo-neg">{fmtBs(deuda)}</span> : <span className="muted">—</span>}
                    </td>
                    <td className="centro">
                      {deuda > 0 ? (
                        <span className="estado estado-deuda">Debe {fmtBs(deuda)}</span>
                      ) : favor > 0 ? (
                        <span className="estado estado-favor">A favor {fmtBs(favor)}</span>
                      ) : (
                        <span className="estado estado-al-dia">Al día</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {r.porInquilino.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    Sin datos para este periodo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {r.porInquilino.some((t) => t.saldo < -0.005) && (
            <p className="muted" style={{ marginTop: 8 }}>
              A favor = pago recibido sin cobros pendientes en este mes (adelanto).
            </p>
          )}
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
function ReporteGeneralPag({ filtro }: { filtro: Filtro }) {
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
        let alquiler = 0;
        let servicios = 0;
        let pagado = 0;
        for (const [clave, c] of deuda.detalleMes.get(m.periodo) ?? []) {
          if (!filtro.has(clave)) continue;
          if (clave === ALQUILER_ID) alquiler += c.cobrado;
          else servicios += c.cobrado;
          pagado += c.pagado;
        }
        const saldo = red2(servicios + alquiler - pagado);
        return {
          periodo: m.periodo,
          alquiler: red2(alquiler),
          servicios: red2(servicios),
          cobrado: red2(servicios + alquiler),
          pagado: red2(pagado),
          saldo,
          tieneDeuda: saldo > 0.005,
        };
      }).filter((f) => f.cobrado > 0.005 || f.pagado > 0.005);
      if (filas.length === 0) continue;

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
  }, [snap, filtro]);

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
                <th className="num col-subtotal">Total servicios</th>
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
                    <td className="num col-subtotal">{fmtBs(g.totServicios)}</td>
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
                      <td className="num col-subtotal">{fmtBs(f.servicios)}</td>
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
                <td className="num col-subtotal">{fmtBs(totales.servicios)}</td>
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
