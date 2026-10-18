import { useState, useMemo } from 'react';
import { useSnapshot } from '../components/SnapshotContext';
import { guardarAsignacion, eliminarAsignacion, copiarAsignaciones } from '../api';
import { MODO_SCRIPT } from '../modo';
import { activoEn, mesLargo, periodoAnterior } from '../reportes/modelo';
import type { Asignacion } from '../types';
import { mesActual } from '../utils';
import { Aviso } from '../components/ui/Aviso';

interface AvisoUi {
  mensaje: string;
  tipo: 'ok' | 'error';
}

function clave(inqId: string, svcId: string) {
  return `${inqId}|${svcId}`;
}

export function Asignaciones() {
  const { snap, recargar } = useSnapshot();
  const [periodo, setPeriodo] = useState(mesActual());
  const [aviso, setAviso] = useState<AvisoUi | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);

  const inquilinos = useMemo(() => (snap?.inquilinos ?? []).filter((i) => i.habilitado), [snap?.inquilinos]);
  const servicios = snap?.servicios ?? [];
  const asignaciones = useMemo(
    () => (snap?.asignaciones ?? []).filter((a) => a.periodo === periodo),
    [snap?.asignaciones, periodo],
  );

  const mapa = useMemo(() => {
    const m = new Map<string, Asignacion>();
    asignaciones.forEach((a) => m.set(clave(a.inquilinoId, a.servicioId), a));
    return m;
  }, [asignaciones]);

  // Draft local: solo se modifica con input del usuario, nunca se reinicia desde snapshot
  const [drafts, setDrafts] = useState<Record<string, Record<string, number>>>({});

  const getDraftValue = (key: string, extra: string): number => {
    if (key in drafts && extra in drafts[key]) return drafts[key][extra];
    return mapa.get(key)?.extras?.[extra] ?? 0;
  };

  const setDraftValue = (key: string, extra: string, valor: string) => {
    const num = valor === '' ? 0 : Number(valor);
    if (isNaN(num)) return;
    setDrafts((prev) => {
      const existente = prev[key] ?? mapa.get(key)?.extras ?? {};
      return { ...prev, [key]: { ...existente, [extra]: num } };
    });
  };

  const toggle = async (inqId: string, svcId: string) => {
    const key = clave(inqId, svcId);
    const existente = mapa.get(key);
    const id = existente?.id ?? `${periodo}-${inqId}-${svcId}`;

    setGuardando(key);
    setAviso(null);
    try {
      if (existente?.activo) {
        await eliminarAsignacion(id);
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setAviso({ mensaje: 'Asignación eliminada', tipo: 'ok' });
      } else {
        const a: Asignacion = {
          id,
          periodo,
          inquilinoId: inqId,
          servicioId: svcId,
          activo: true,
          extras: existente?.extras ?? {},
        };
        await guardarAsignacion(a);
        setAviso({ mensaje: 'Asignación creada', tipo: 'ok' });
      }
      await recargar();
    } catch (e) {
      setAviso({ mensaje: e instanceof Error ? e.message : String(e), tipo: 'error' });
    } finally {
      setGuardando(null);
    }
  };

  // Copiar del mes anterior: lo que falta en este mes, para inquilinos activos.
  const anterior = periodoAnterior(periodo);
  const porCopiar = useMemo(() => {
    const inqs = new Map((snap?.inquilinos ?? []).map((i) => [i.id, i]));
    return (snap?.asignaciones ?? []).filter((a) => a.periodo === anterior && a.activo
      && !mapa.has(clave(a.inquilinoId, a.servicioId))
      && inqs.has(a.inquilinoId) && activoEn(inqs.get(a.inquilinoId)!, periodo));
  }, [snap?.asignaciones, snap?.inquilinos, anterior, mapa, periodo]);

  const copiar = async () => {
    setGuardando('copiar');
    setAviso(null);
    try {
      let n = 0;
      if (MODO_SCRIPT) {
        n = (await copiarAsignaciones(anterior, periodo)).copiadas;
      } else {
        for (const a of porCopiar) {
          await guardarAsignacion({ ...a, id: `${periodo}-${a.inquilinoId}-${a.servicioId}`, periodo });
          n++;
        }
      }
      recargar();
      setAviso({ mensaje: `Se copiaron ${n} asignaciones de ${mesLargo(anterior)}`, tipo: 'ok' });
    } catch (e) {
      setAviso({ mensaje: e instanceof Error ? e.message : String(e), tipo: 'error' });
    } finally {
      setGuardando(null);
    }
  };

  const saveExtras = async (inqId: string, svcId: string) => {
    const key = clave(inqId, svcId);
    const existente = mapa.get(key);
    if (!existente) return;
    const draft = drafts[key];
    if (!draft) return;

    setGuardando(key);
    setAviso(null);
    try {
      const a: Asignacion = { ...existente, extras: draft };
      await guardarAsignacion(a);
      await recargar();
      setAviso({ mensaje: 'Extras guardados', tipo: 'ok' });
    } catch (e) {
      setAviso({ mensaje: e instanceof Error ? e.message : String(e), tipo: 'error' });
    } finally {
      setGuardando(null);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h2>Asignaciones por periodo</h2>
      </div>

      {aviso && <Aviso mensaje={aviso.mensaje} tipo={aviso.tipo} onCerrar={() => setAviso(null)} />}

      <div className="toolbar">
        <label className="campo campo-inline">
          <span className="campo-label">Periodo</span>
          <input className="input" type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
        </label>
        {porCopiar.length > 0 && (
          <button className="btn btn-secundario" onClick={copiar} disabled={guardando !== null}>
            {guardando === 'copiar' ? 'Copiando…' : `Copiar ${porCopiar.length} de ${mesLargo(anterior)}`}
          </button>
        )}
      </div>

      {servicios.length === 0 && (
        <div className="aviso aviso-info">
          Primero cree al menos un servicio en la pestaña "Servicios".
        </div>
      )}
      {inquilinos.length === 0 && (
        <div className="aviso aviso-info">
          Primero registre inquilinos habilitados en la pestaña "Inquilinos".
        </div>
      )}

      {servicios.length > 0 && inquilinos.length > 0 && (
        <div className="asignaciones-grid">
          {inquilinos.map((inq) => (
            <div key={inq.id} className="asign-card">
              <div className="asign-card-head">
                <h3>{inq.nombre}</h3>
                <span className="muted">
                  {inq.habitaciones} cuarto{inq.habitaciones !== 1 ? 's' : ''} · {inq.personas} persona{inq.personas !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="asign-card-body">
                {servicios.map((svc) => {
                  const key = clave(inq.id, svc.id);
                  const a = mapa.get(key);
                  const activo = a?.activo === true;
                  const guardandoCell = guardando === key;
                  const extras = svc.extras ?? [];
                  const hasDraft = key in drafts;

                  return (
                    <div key={svc.id} className={`asign-svc ${activo ? 'asign-svc-activo' : ''}`}>
                      <div className="asign-svc-row">
                        <button
                          className={`btn btn-mini ${activo ? 'btn-primario' : 'btn-fantasma'}`}
                          disabled={guardandoCell}
                          onClick={() => toggle(inq.id, svc.id)}
                          title={activo ? 'Desactivar' : 'Activar'}
                        >
                          {guardandoCell ? '...' : activo ? '✓' : '—'}
                        </button>
                        <span className="asign-svc-nombre">{svc.nombre}</span>
                        {extras.length > 0 && (
                          <span className="muted asign-svc-unit">
                            {svc.metodoPago === 'CUARTOS' ? 'cuarto' : 'persona'}
                          </span>
                        )}
                        {hasDraft && (
                          <button
                            className="btn btn-secundario btn-mini"
                            disabled={guardandoCell}
                            onClick={() => saveExtras(inq.id, svc.id)}
                          >
                            {guardandoCell ? 'Guardando...' : 'Guardar'}
                          </button>
                        )}
                      </div>
                      {activo && extras.length > 0 && (
                        <div className="asign-extras-row">
                          {extras.map((ex) => (
                            <div key={ex} className="asign-extra-item">
                              <span className="asign-extra-label">{ex}</span>
                              <input
                                type="number"
                                min={0}
                                className="asign-extra-input"
                                value={getDraftValue(key, ex)}
                                onChange={(e) => setDraftValue(key, ex, e.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
