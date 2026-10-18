import { useMemo, useState } from 'react';
import type { Snapshot } from '../types';
import { conceptosDe } from '../reportes/modelo';
import type { Filtro } from '../reportes/modelo';
import { ALQUILER_ID } from '../utils';

const LLAVE = 'alquileres.filtro.excluidos';

function leerExcluidos(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(LLAVE) ?? '[]');
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Conceptos incluidos en los reportes. Se guardan los EXCLUIDOS para que un
 * servicio nuevo aparezca incluido por defecto. Preferencia de este dispositivo.
 */
export function useFiltroConceptos(snap: Snapshot | null): [Filtro, (excluidos: string[]) => void] {
  const [excluidos, setExcluidos] = useState<string[]>(leerExcluidos);
  const filtro = useMemo(() => {
    const ids = snap ? conceptosDe(snap).map((c) => c.id) : [];
    return new Set(ids.filter((id) => !excluidos.includes(id)));
  }, [snap, excluidos]);
  const cambiar = (nuevos: string[]) => {
    setExcluidos(nuevos);
    try {
      window.localStorage.setItem(LLAVE, JSON.stringify(nuevos));
    } catch {
      /* sin almacenamiento: vale para esta sesion */
    }
  };
  return [filtro, cambiar];
}

/** Casillas para elegir que conceptos (servicios y alquiler) entran en el reporte. */
export function FiltroConceptos({ snap, filtro, onCambiar }: {
  snap: Snapshot;
  filtro: Filtro;
  onCambiar: (excluidos: string[]) => void;
}) {
  const conceptos = conceptosDe(snap);
  const excluidos = conceptos.filter((c) => !filtro.has(c.id)).map((c) => c.id);
  const alternar = (id: string) => {
    const nuevos = excluidos.includes(id) ? excluidos.filter((x) => x !== id) : [...excluidos, id];
    // Siempre debe quedar al menos un concepto incluido.
    if (nuevos.length >= conceptos.length) return;
    onCambiar(nuevos);
  };
  const servicios = conceptos.filter((c) => c.id !== ALQUILER_ID);
  const incluidos = conceptos.filter((c) => filtro.has(c.id));
  return (
    <>
      <div className="filtro no-imprimir" role="group" aria-label="Conceptos incluidos en el reporte">
        <span className="filtro-titulo">Incluir en el reporte:</span>
        <div className="filtro-casillas">
          {conceptos.map((c) => (
            <label key={c.id} className={`casilla-chip ${filtro.has(c.id) ? 'activo' : ''} ${c.id === ALQUILER_ID ? 'alquiler' : ''}`}>
              <input type="checkbox" checked={filtro.has(c.id)} onChange={() => alternar(c.id)} />
              {c.nombre}
            </label>
          ))}
        </div>
        <div className="filtro-rapido">
          <button className="btn btn-fantasma" onClick={() => onCambiar([])}>Todo</button>
          {servicios.length > 0 && <button className="btn btn-fantasma" onClick={() => onCambiar([ALQUILER_ID])}>Solo servicios</button>}
          {servicios.length > 0 && <button className="btn btn-fantasma" onClick={() => onCambiar(servicios.map((s) => s.id))}>Solo alquiler</button>}
        </div>
      </div>
      <p className="filtro-impreso">Incluye: {incluidos.map((c) => c.nombre).join(', ')}</p>
    </>
  );
}
