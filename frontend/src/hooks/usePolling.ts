import { useEffect, useRef, useState } from 'react';

/** Ejecuta el fetcher cada `intervalo` ms y devuelve datos/error/cargando. */
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
    let timer: number | undefined;

    const ejecutar = async () => {
      try {
        const r = await fetcherRef.current();
        if (!parado) {
          setData(r);
          setError(null);
        }
      } catch (e) {
        if (!parado) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!parado) setCargando(false);
      }
    };

    ejecutar();
    timer = window.setInterval(ejecutar, intervalo);
    return () => {
      parado = true;
      if (timer) window.clearInterval(timer);
    };
  }, [intervalo, activo, refreshKey]);

  return {
    data,
    error,
    cargando,
    refrescar: () => setRefreshKey((k) => k + 1),
  };
}