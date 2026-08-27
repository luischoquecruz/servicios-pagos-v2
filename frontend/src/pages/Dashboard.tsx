import { useMemo } from 'react';
import { useSnapshot } from '../components/SnapshotContext';
import { usePolling } from '../hooks/usePolling';
import { getDashboard } from '../api';
import type { Resumen } from '../types';
import { fmtBs, fmtFecha, nombreServicio } from '../utils';
import { Cargando } from '../components/ui/Cargando';
import { POLL_MS } from '../modo';

function Card({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'mal' | 'info' }) {
  return (
    <div className={`card card-${tone ?? 'info'}`}>
      <span className="card-label">{label}</span>
      <span className="card-value">{value}</span>
    </div>
  );
}

/** Deuda acumulada por inquilino (todos los periodos). */
function usarDeudaAcumulada() {
  const { snap } = useSnapshot();
  return useMemo(() => {
    const mapa = new Map<string, { nombre: string; deuda: number }>();
    for (const c of snap?.cobros ?? []) {
      const entry = mapa.get(c.inquilinoId) ?? { nombre: '', deuda: 0 };
      entry.deuda += c.montoTotal || 0;
      mapa.set(c.inquilinoId, entry);
    }
    for (const p of snap?.pagos ?? []) {
      if (p.inquilinoId) {
        const entry = mapa.get(p.inquilinoId) ?? { nombre: '', deuda: 0 };
        entry.deuda -= p.montoBs || 0;
        mapa.set(p.inquilinoId, entry);
      }
    }
    // Nombres
    for (const inq of snap?.inquilinos ?? []) {
      const entry = mapa.get(inq.id);
      if (entry) entry.nombre = inq.nombre;
    }
    return mapa;
  }, [snap?.cobros, snap?.pagos, snap?.inquilinos]);
}

export function Dashboard() {
  const { mapInq, mapSvc } = useSnapshot();
  const { data, error, cargando } = usePolling<Resumen>(getDashboard, POLL_MS);
  const deudas = usarDeudaAcumulada();

  if (cargando && !data) return <Cargando />;
  if (error && !data)
    return <div className="aviso aviso-error">{error}</div>;

  const d = data!;
  const deudores = [...deudas.values()]
    .filter((t) => t.deuda > 0)
    .sort((a, b) => b.deuda - a.deuda)
    .slice(0, 10);
  const totalDeuda = deudores.reduce((s, t) => s + t.deuda, 0);

  return (
    <div className="page">
      <div className="page-head">
        <h2>Panel de control</h2>
        <span className="subtitulo">Periodo {d.periodo}</span>
      </div>

      {!d.cobradoDelMes && (
        <div className="aviso aviso-info">
          Aun no se generaron los cobros de {d.periodo}. Ingresa a{' '}
          <strong>Cobros</strong> y presiona «Generar todos».
        </div>
      )}

      <div className="cards">
        <Card label="Inquilinos activos" value={String(d.inquilinosActivos)} tone="info" />
        <Card label="Servicios" value={String(d.totalServicios)} tone="info" />
        <Card label="Cobrado del mes" value={fmtBs(d.cobradoMes)} tone="info" />
        <Card label="Pagado del mes" value={fmtBs(d.pagadoMes)} tone="info" />
        <Card label="Saldo del mes" value={fmtBs(d.saldoMes)} tone={d.saldoMes > 0 ? 'mal' : 'ok'} />
        <Card label="Deuda acumulada" value={fmtBs(totalDeuda)} tone={totalDeuda > 0 ? 'mal' : 'ok'} />
        <Card label="Deudores" value={String(deudores.length)} tone={deudores.length > 0 ? 'mal' : 'ok'} />
      </div>

      <div className="grid2">
        <section className="panel">
          <div className="panel-head">
            <h3>Deuda acumulada por inquilino</h3>
            <strong className="total-badge">{fmtBs(totalDeuda)}</strong>
          </div>
          {deudores.length === 0 ? (
            <p className="muted" style={{ padding: '16px', textAlign: 'center' }}>Sin deudas pendientes.</p>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th>Inquilino</th>
                  <th className="num">Deuda</th>
                </tr>
              </thead>
              <tbody>
                {deudores.map((t) => (
                  <tr key={t.nombre}>
                    <td>{t.nombre}</td>
                    <td className="num saldo-neg">{fmtBs(t.deuda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="panel">
          <h3>Ultimos pagos recibidos</h3>
          {d.ultimosPagos.length === 0 ? (
            <p className="muted">Todavia no hay pagos registrados.</p>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Inquilino</th>
                  <th>Servicio</th>
                  <th className="num">Monto</th>
                </tr>
              </thead>
              <tbody>
                {d.ultimosPagos.map((p) => (
                  <tr key={p.id}>
                    <td>{fmtFecha(p.fechaPago)}</td>
                    <td>
                      {p.inquilinoId
                        ? (mapInq.get(p.inquilinoId)?.nombre ?? '—')
                        : 'Factura'}
                    </td>
                    <td>{p.servicioId ? nombreServicio(p.servicioId, mapSvc) : 'General'}</td>
                    <td className="num">{fmtBs(p.montoBs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}