import { useState } from 'react';
import { SnapshotProvider, useSnapshot } from './components/SnapshotContext';
import { Dashboard } from './pages/Dashboard';
import { Inquilinos } from './pages/Inquilinos';
import { Servicios } from './pages/Servicios';
import { Cobros } from './pages/Cobros';
import { Pagos } from './pages/Pagos';
import { Facturas } from './pages/Facturas';
import { Reportes } from './pages/Reportes';
import { Asignaciones } from './pages/Asignaciones';

type Vista = 'inicio' | 'inquilinos' | 'servicios' | 'asignaciones' | 'facturas' | 'cobros' | 'pagos' | 'reportes';

const NAV: { id: Vista; texto: string; icono: string }[] = [
  { id: 'inicio', texto: 'Panel', icono: '⌂' },
  { id: 'inquilinos', texto: 'Inquilinos', icono: '👤' },
  { id: 'servicios', texto: 'Servicios', icono: '⚙' },
  { id: 'asignaciones', texto: 'Asignaciones', icono: '🔗' },
  { id: 'facturas', texto: 'Facturas', icono: '🧾' },
  { id: 'cobros', texto: 'Cobros', icono: '₿' },
  { id: 'pagos', texto: 'Pagos', icono: '₲' },
  { id: 'reportes', texto: 'Reportes', icono: '📊' },
];

export function App() {
  const [vista, setVista] = useState<Vista>('inicio');

  return (
    <SnapshotProvider>
      <Layout vista={vista} setVista={setVista} />
    </SnapshotProvider>
  );
}

function Layout({ vista, setVista }: { vista: Vista; setVista: (v: Vista) => void }) {
  const { info, conectado, error } = useSnapshot();

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <strong>Alquileres</strong>
          <span>{info?.nombre ?? 'Casa'}</span>
        </div>
        <nav>
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${vista === n.id ? 'nav-activo' : ''}`}
              onClick={() => setVista(n.id)}
            >
              <span className="nav-icono">{n.icono}</span>
              {n.texto}
            </button>
          ))}
        </nav>
        <div className="sidebar-pie">
          <div className={`conexion conexion-${conectado ? 'ok' : 'mal'}`}>
            <span className="punto" />
            {conectado ? (info?.google ? 'Google Sheets conectado' : 'Base local (JSON)') : 'Google Sheets desconectado'}
          </div>
          {error && <small className="conexion-error">{error}</small>}
          <small className="muted">
            {info?.fuente === 'google'
              ? `Sincronizado ${info.syncedAt ? new Date(info.syncedAt).toLocaleTimeString('es-BO') : '—'} · v${info?.version ?? 0}`
              : `v${info?.version ?? 0}`}
          </small>
        </div>
      </aside>

      <main className="contenido">
        {vista === 'inicio' && <Dashboard />}
        {vista === 'inquilinos' && <Inquilinos />}
        {vista === 'servicios' && <Servicios />}
        {vista === 'asignaciones' && <Asignaciones />}
        {vista === 'facturas' && <Facturas />}
        {vista === 'cobros' && <Cobros />}
        {vista === 'pagos' && <Pagos />}
        {vista === 'reportes' && <Reportes />}
      </main>
    </div>
  );
}