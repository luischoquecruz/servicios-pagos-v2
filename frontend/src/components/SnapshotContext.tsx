import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Inquilino, Info, Servicio, Snapshot, Sync } from '../types';
import { getInfo, getSnapshot, getSync } from '../api';
import { usePolling } from '../hooks/usePolling';
import { MODO_SCRIPT, POLL_MS } from '../modo';

interface SnapshotCtx {
  snap: Snapshot | null;
  info: Info | null;
  conectado: boolean;
  error: string | null;
  mapInq: Map<string, Inquilino>;
  mapSvc: Map<string, Servicio>;
  recargar: () => void;
}

const Ctx = createContext<SnapshotCtx | null>(null);

export function SnapshotProvider({ children }: { children: ReactNode }) {
  // En modo script se usa una sola llamada (?action=sync) que trae snapshot+info
  // juntos para ahorrar ejecuciones de Apps Script.
  const snapLocal = usePolling<Snapshot>(getSnapshot, POLL_MS, !MODO_SCRIPT);
  const infoLocal = usePolling<Info>(getInfo, POLL_MS, !MODO_SCRIPT);
  const syncData = usePolling<Sync>(getSync, POLL_MS, MODO_SCRIPT);

  const snap: Snapshot | null = MODO_SCRIPT ? (syncData.data?.snapshot ?? null) : snapLocal.data;
  const info: Info | null = MODO_SCRIPT ? (syncData.data?.info ?? null) : infoLocal.data;

  const value = useMemo<SnapshotCtx>(() => {
    const mapInq = new Map<string, Inquilino>();
    const mapSvc = new Map<string, Servicio>();
    snap?.inquilinos.forEach((i) => mapInq.set(i.id, i));
    snap?.servicios.forEach((s) => mapSvc.set(s.id, s));
    const recargar = () => {
      if (MODO_SCRIPT) syncData.refrescar();
      else snapLocal.refrescar();
    };
    return {
      snap,
      info,
      conectado: !info?.google || (info?.conectado ?? true),
      error: info?.google ? info.error : null,
      mapInq,
      mapSvc,
      recargar,
    };
  }, [snap, info]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSnapshot(): SnapshotCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSnapshot debe usarse dentro de SnapshotProvider');
  return ctx;
}
