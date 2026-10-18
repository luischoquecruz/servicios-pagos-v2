import { useEffect, useState } from 'react';
import type { ComponentType, SVGProps } from 'react';
import { Acceso } from './components/Acceso';
import { getInfo } from './api';
import { borrarClave, eventosClave, leerClave } from './clave';
import { SnapshotProvider, useSnapshot } from './components/SnapshotContext';
import { Dashboard } from './pages/Dashboard';
import { Inquilinos } from './pages/Inquilinos';
import { Servicios } from './pages/Servicios';
import { Cobros } from './pages/Cobros';
import { Pagos } from './pages/Pagos';
import { Facturas } from './pages/Facturas';
import { Reportes } from './pages/Reportes';
import { Asignaciones } from './pages/Asignaciones';
import { irA, useRuta } from './nav';
import type { Vista } from './nav';
import { aplicarTema, leerTema, temaEfectivo } from './tema';
import type { Tema } from './tema';
import {
  IcoAsignar, IcoCasa, IcoCerrar, IcoCobros, IcoFacturas, IcoInicio, IcoInquilinos, IcoLuna, IcoMas,
  IcoPagos, IcoReportes, IcoSalir, IcoServicios, IcoSol,
} from './components/Iconos';

type Icono = ComponentType<SVGProps<SVGSVGElement>>;

interface ItemNav {
  id: Vista;
  texto: string;
  icono: Icono;
  ayuda: string;
}

const GRUPOS: { titulo: string; items: ItemNav[] }[] = [
  { titulo: '', items: [{ id: 'inicio', texto: 'Inicio', icono: IcoInicio, ayuda: 'Resumen y pendientes' }] },
  {
    titulo: 'Cada mes',
    items: [
      { id: 'asignaciones', texto: 'Asignaciones', icono: IcoAsignar, ayuda: 'Qué servicios usa cada inquilino' },
      { id: 'facturas', texto: 'Facturas', icono: IcoFacturas, ayuda: 'Importe de luz, agua…' },
      { id: 'cobros', texto: 'Cobros', icono: IcoCobros, ayuda: 'Cuánto paga cada uno' },
      { id: 'pagos', texto: 'Pagos', icono: IcoPagos, ayuda: 'Registrar lo que pagan' },
    ],
  },
  { titulo: 'Consultar', items: [{ id: 'reportes', texto: 'Reportes', icono: IcoReportes, ayuda: 'Estados de cuenta e historial' }] },
  {
    titulo: 'Configurar',
    items: [
      { id: 'inquilinos', texto: 'Inquilinos', icono: IcoInquilinos, ayuda: 'Personas y cuartos' },
      { id: 'servicios', texto: 'Servicios', icono: IcoServicios, ayuda: 'Luz, agua, internet…' },
    ],
  },
];

const TODOS = GRUPOS.flatMap((g) => g.items);
const INFERIOR: Vista[] = ['inicio', 'pagos', 'cobros', 'reportes'];

type EstadoAcceso = 'comprobando' | 'pedir' | 'ok';

export function App() {
  const [acceso, setAcceso] = useState<EstadoAcceso>(leerClave() ? 'ok' : 'comprobando');
  const [motivo, setMotivo] = useState<string | null>(null);

  // Sin clave guardada: se prueba si la API la exige (el backend local puede no pedirla).
  useEffect(() => {
    if (acceso !== 'comprobando') return;
    getInfo()
      .then(() => setAcceso('ok'))
      .catch(() => {
        setMotivo(null); // primera visita: pedir la clave sin mostrar error
        setAcceso('pedir');
      });
  }, [acceso]);

  // Cualquier llamada rechazada por clave invalida vuelve a la pantalla de acceso.
  useEffect(() => {
    const alInvalidar = (e: Event) => {
      borrarClave();
      setMotivo(String((e as CustomEvent).detail ?? '').replace(/^(Error: )?(NO_AUTORIZADO|NO_CONFIGURADA): ?/, ''));
      setAcceso('pedir');
    };
    eventosClave.addEventListener('invalida', alInvalidar);
    return () => eventosClave.removeEventListener('invalida', alInvalidar);
  }, []);

  const salir = () => {
    borrarClave();
    setMotivo(null);
    setAcceso('pedir');
  };

  if (acceso === 'comprobando') return null;
  if (acceso === 'pedir') {
    return (
      <Acceso
        motivo={motivo}
        onEntrar={() => {
          setMotivo(null);
          setAcceso('ok');
        }}
      />
    );
  }

  return (
    <SnapshotProvider>
      <Shell onSalir={salir} />
    </SnapshotProvider>
  );
}

function useTema(): [Tema, () => void] {
  const [tema, setTema] = useState<Tema>(leerTema);
  const alternar = () => {
    const siguiente: Tema = temaEfectivo(tema) === 'dark' ? 'light' : 'dark';
    aplicarTema(siguiente);
    setTema(siguiente);
  };
  return [tema, alternar];
}

function EstadoSync() {
  const { info, conectado, actualizando, error, snap } = useSnapshot();
  let clase = 'ok';
  let texto = 'Al día';
  if (!snap) {
    clase = 'cargando';
    texto = 'Cargando…';
  } else if (!conectado) {
    clase = 'mal';
    texto = 'Sin conexión';
  } else if (actualizando) {
    clase = 'cargando';
    texto = 'Actualizando…';
  }
  const hora = info?.syncedAt ? new Date(info.syncedAt).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }) : null;
  const titulo = error ? error : hora ? `Datos de las ${hora}` : '';
  return (
    <span className={`sync sync-${clase}`} title={titulo} role="status">
      <span className="sync-punto" />
      {texto}
    </span>
  );
}

function Shell({ onSalir }: { onSalir: () => void }) {
  const { vista, params } = useRuta();
  const { info } = useSnapshot();
  const [tema, alternarTema] = useTema();
  const [masAbierto, setMasAbierto] = useState(false);
  const oscuro = temaEfectivo(tema) === 'dark';
  const actual = TODOS.find((i) => i.id === vista);

  useEffect(() => {
    document.title = `${actual?.texto ?? 'Inicio'} · Alquileres`;
    setMasAbierto(false);
  }, [vista, actual]);

  const BotonTema = (
    <button className="icono-btn" onClick={alternarTema} aria-label={oscuro ? 'Usar tema claro' : 'Usar tema oscuro'} title={oscuro ? 'Tema claro' : 'Tema oscuro'}>
      {oscuro ? <IcoSol /> : <IcoLuna />}
    </button>
  );

  return (
    <div className="shell">
      <aside className="lateral">
        <div className="marca">
          <span className="marca-logo"><IcoCasa /></span>
          <span className="marca-texto">
            <strong>Alquileres</strong>
            <small>{info?.nombre ?? 'Casa'}</small>
          </span>
        </div>
        <nav className="lateral-nav" aria-label="Secciones">
          {GRUPOS.map((g) => (
            <div key={g.titulo || 'inicio'} className="nav-grupo">
              {g.titulo && <span className="nav-titulo">{g.titulo}</span>}
              {g.items.map((it) => (
                <button key={it.id} className={`nav-btn ${vista === it.id ? 'activo' : ''}`} onClick={() => irA(it.id)}
                  aria-current={vista === it.id ? 'page' : undefined}>
                  <it.icono />
                  <span>{it.texto}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="lateral-pie">
          <EstadoSync />
          <div className="lateral-acciones">
            {BotonTema}
            {leerClave() && (
              <button className="icono-btn" onClick={onSalir} aria-label="Cerrar sesión" title="Cerrar sesión">
                <IcoSalir />
              </button>
            )}
          </div>
        </div>
      </aside>

      <div className="principal">
        <header className="superior">
          <span className="superior-marca"><IcoCasa /> {actual?.texto ?? 'Alquileres'}</span>
          <div className="superior-acciones">
            <EstadoSync />
            {BotonTema}
          </div>
        </header>
        <main className="contenido">
          {vista === 'inicio' && <Dashboard />}
          {vista === 'inquilinos' && <Inquilinos />}
          {vista === 'servicios' && <Servicios />}
          {vista === 'asignaciones' && <Asignaciones />}
          {vista === 'facturas' && <Facturas />}
          {vista === 'cobros' && <Cobros />}
          {vista === 'pagos' && <Pagos />}
          {vista === 'reportes' && <Reportes params={params} />}
        </main>
      </div>

      <nav className="inferior" aria-label="Secciones">
        {INFERIOR.map((id) => {
          const it = TODOS.find((x) => x.id === id)!;
          return (
            <button key={id} className={`inf-btn ${vista === id ? 'activo' : ''}`} onClick={() => irA(id)} aria-current={vista === id ? 'page' : undefined}>
              <it.icono />
              <span>{it.texto}</span>
            </button>
          );
        })}
        <button className={`inf-btn ${!INFERIOR.includes(vista) ? 'activo' : ''}`} onClick={() => setMasAbierto(true)} aria-haspopup="dialog">
          <IcoMas />
          <span>Más</span>
        </button>
      </nav>

      {masAbierto && (
        <div className="hoja-fondo" onClick={() => setMasAbierto(false)}>
          <div className="hoja" role="dialog" aria-label="Más secciones" onClick={(e) => e.stopPropagation()}>
            <div className="hoja-cab">
              <strong>Más</strong>
              <button className="icono-btn" onClick={() => setMasAbierto(false)} aria-label="Cerrar"><IcoCerrar /></button>
            </div>
            <div className="hoja-lista">
              {TODOS.filter((i) => !INFERIOR.includes(i.id)).map((it) => (
                <button key={it.id} className={`hoja-item ${vista === it.id ? 'activo' : ''}`} onClick={() => irA(it.id)}>
                  <span className="hoja-ico"><it.icono /></span>
                  <span>
                    <strong>{it.texto}</strong>
                    <small>{it.ayuda}</small>
                  </span>
                </button>
              ))}
              {leerClave() && (
                <button className="hoja-item" onClick={onSalir}>
                  <span className="hoja-ico"><IcoSalir /></span>
                  <span><strong>Cerrar sesión</strong><small>Borra la clave de este dispositivo</small></span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
