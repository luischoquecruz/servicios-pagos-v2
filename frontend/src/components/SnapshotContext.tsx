import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Inquilino, Info, Servicio, Snapshot, Sync } from '../types';
import { eventosDatos, getInfo, getSnapshot, getSync, getVersion } from '../api';
import { usePolling } from '../hooks/usePolling';
import { MODO_SCRIPT, POLL_MS } from '../modo';
import { guardarSnapCache, leerSnapCache } from '../clave';
import { deudasPorInquilino } from '../reportes/modelo';
import type { DeudaInquilino } from '../reportes/modelo';

interface SnapshotCtx {
  snap: Snapshot | null;
  info: Info | null;
  conectado: boolean;
  /** true mientras se trae una version nueva de los datos */
  actualizando: boolean;
  error: string | null;
  mapInq: Map<string, Inquilino>;
  mapSvc: Map<string, Servicio>;
  /** deuda calculada por inquilino (todos los meses) */
  deudas: Map<string, DeudaInquilino>;
  recargar: () => void;
}

const Ctx = createContext<SnapshotCtx | null>(null);

/** Modo script: datos en cache local + consulta liviana de version + datos que devuelven las escrituras. */
function useSyncScript(activo: boolean) {
  const [sync, setSync] = useState<Sync | null>(() => (activo ? leerSnapCache<Sync>() : null));
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cargando = useRef(false);
  const ultimoAplicado = useRef(0);

  const aplicar = useCallback((s: Sync) => {
    ultimoAplicado.current = Date.now();
    setSync(s);
    setError(null);
    guardarSnapCache(s);
  }, []);

  const cargar = useCallback(async () => {
    if (cargando.current) return;
    cargando.current = true;
    setActualizando(true);
    try {
      aplicar(await getSync());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      cargando.current = false;
      setActualizando(false);
    }
  }, [aplicar]);

  // Sin datos en cache: traerlos ya (en paralelo con la consulta de version).
  useEffect(() => {
    if (activo && !leerSnapCache<Sync>()) cargar();
  }, [activo, cargar]);

  // Datos devueltos por las escrituras (?conSync=1).
  useEffect(() => {
    if (!activo) return;
    const alSync = (e: Event) => aplicar((e as CustomEvent<Sync>).detail);
    eventosDatos.addEventListener('sync', alSync);
    return () => eventosDatos.removeEventListener('sync', alSync);
  }, [activo, aplicar]);

  const version = usePolling<number>(getVersion, POLL_MS, activo);
  const versionActual = sync?.snapshot.version;
  useEffect(() => {
    if (!activo || version.data === null) return;
    if (versionActual === undefined || version.data !== versionActual) cargar();
  }, [activo, version.data, versionActual, cargar]);

  // Script antiguo sin ?action=version: se vuelve a pedir todo cada 15 s.
  const sinVersion = activo && /desconocida/i.test(version.error ?? '');
  useEffect(() => {
    if (!sinVersion) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') cargar();
    }, 15000);
    return () => window.clearInterval(t);
  }, [sinVersion, cargar]);

  const recargar = useCallback(() => {
    // Una escritura recien aplicada ya trajo los datos nuevos.
    if (Date.now() - ultimoAplicado.current < 3000) return;
    cargar();
  }, [cargar]);

  return { sync, actualizando, error: error ?? (sinVersion ? null : version.error), recargar };
}

export function SnapshotProvider({ children }: { children: ReactNode }) {
  const script = useSyncScript(MODO_SCRIPT);
  const snapLocal = usePolling<Snapshot>(getSnapshot, POLL_MS, !MODO_SCRIPT);
  const infoLocal = usePolling<Info>(getInfo, POLL_MS, !MODO_SCRIPT);

  const snap: Snapshot | null = MODO_SCRIPT ? (script.sync?.snapshot ?? null) : snapLocal.data;
  const info: Info | null = MODO_SCRIPT ? (script.sync?.info ?? null) : infoLocal.data;
  const errorRed = MODO_SCRIPT ? script.error : snapLocal.error;
  const recargarScript = script.recargar;
  const refrescarLocal = snapLocal.refrescar;

  const value = useMemo<SnapshotCtx>(() => {
    const mapInq = new Map<string, Inquilino>();
    const mapSvc = new Map<string, Servicio>();
    snap?.inquilinos.forEach((i) => mapInq.set(i.id, i));
    snap?.servicios.forEach((s) => mapSvc.set(s.id, s));
    const deudas = snap ? deudasPorInquilino(snap) : new Map<string, DeudaInquilino>();
    return {
      snap,
      info,
      conectado: !errorRed && (!info?.google || (info?.conectado ?? true)),
      actualizando: MODO_SCRIPT ? script.actualizando : false,
      error: errorRed ?? (info?.google ? info.error : null),
      mapInq,
      mapSvc,
      deudas,
      recargar: MODO_SCRIPT ? recargarScript : refrescarLocal,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, info, errorRed, script.actualizando, recargarScript]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSnapshot(): SnapshotCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSnapshot debe usarse dentro de SnapshotProvider');
  return ctx;
}
