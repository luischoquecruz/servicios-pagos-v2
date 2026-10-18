import { useEffect, useRef, useState } from 'react';

/**
 * Ejecuta el fetcher cada `intervalo` ms y devuelve datos/error/cargando.
 * - Nunca hay dos consultas a la vez: la siguiente se programa al terminar la anterior.
 * - Se pausa con la pestaña oculta y consulta de inmediato al volver.
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalo: number,
  activo = true,
): { data: T | null; error: string | null; cargando: boolean; refrescar: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!activo) return;
    let parado = false;
    let enCurso = false;
    let timer: number | undefined;

    const programar = () => {
      if (parado) return;
      window.clearTimeout(timer);
      if (document.visibilityState === 'hidden') return;
      timer = window.setTimeout(ejecutar, intervalo);
    };

    const ejecutar = async () => {
      if (parado || enCurso) return;
      enCurso = true;
      try {
        const r = await fetcherRef.current();
        if (!parado) {
          setData(r);
          setError(null);
        }
      } catch (e) {
        if (!parado) setError(e instanceof Error ? e.message : String(e));
      } finally {
        enCurso = false;
        if (!parado) {
          setCargando(false);
          programar();
        }
      }
    };

    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible') {
        window.clearTimeout(timer);
        ejecutar();
      } else {
        window.clearTimeout(timer);
      }
    };

    ejecutar();
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    return () => {
      parado = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    };
  }, [intervalo, activo, refreshKey]);

  return {
    data,
    error,
    cargando,
    refrescar: () => setRefreshKey((k) => k + 1),
  };
}
