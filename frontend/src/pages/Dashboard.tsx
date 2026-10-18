import { useMemo, useState } from 'react';
import { useSnapshot } from '../components/SnapshotContext';
import { Cargando } from '../components/ui/Cargando';
import { Cifra, EstadoDeuda, Medidor, Seccion, SelectorMes } from '../components/Partes';
import { IcoAlerta, IcoCheck } from '../components/Iconos';
import { mesLargo, resumenMes, tareasDelMes, activoEn } from '../reportes/modelo';
import { fmtBs, fmtFecha, mesActual, nombreServicio } from '../utils';
import { irA } from '../nav';

export function Dashboard() {
  const { snap, info, deudas, mapInq, mapSvc } = useSnapshot();
  const [periodo, setPeriodo] = useState(mesActual());

  const datos = useMemo(() => {
    if (!snap) return null;
    const r = resumenMes(snap, periodo, deudas);
    const tareas = tareasDelMes(snap, periodo);
    const deudores = [...deudas.values()].filter((d) => d.saldo > 0.005).sort((a, b) => b.saldo - a.saldo);
    const ultimos = snap.pagos
      .filter((p) => p.inquilinoId)
      .sort((a, b) => (b.fechaPago ?? '').localeCompare(a.fechaPago ?? ''))
      .slice(0, 6);
    const activos = snap.inquilinos.filter((i) => activoEn(i, periodo)).length;
    return { r, tareas, deudores, ultimos, activos };
  }, [snap, periodo, deudas]);

  if (!snap || !datos) return <Cargando />;
  const { r, tareas, deudores, ultimos, activos } = datos;
  const sinDatos = snap.inquilinos.length === 0 && snap.servicios.length === 0;
  const maxDeuda = deudores[0]?.saldo ?? 1;

  if (sinDatos) {
    return (
      <div className="page">
        <div className="encabezado"><div><h2>Bienvenido</h2><p>Configura la casa en tres pasos.</p></div></div>
        <Seccion titulo="Primeros pasos">
          <div className="tareas">
            <button className="tarea" onClick={() => irA('servicios')}><IcoAlerta /><span>1. Crea los servicios<small>Luz, agua, internet… y cómo se reparten.</small></span><span className="tarea-ir">Ir</span></button>
            <button className="tarea" onClick={() => irA('inquilinos')}><IcoAlerta /><span>2. Registra a los inquilinos<small>Cuartos, personas y alquiler.</small></span><span className="tarea-ir">Ir</span></button>
            <button className="tarea" onClick={() => irA('asignaciones')}><IcoAlerta /><span>3. Asigna los servicios del mes<small>Qué servicios usa cada inquilino.</small></span><span className="tarea-ir">Ir</span></button>
          </div>
        </Seccion>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="encabezado">
        <div>
          <h2>Resumen de {mesLargo(periodo)}</h2>
          <p>{info?.nombre ?? 'Casa'} · {activos} {activos === 1 ? 'inquilino activo' : 'inquilinos activos'}</p>
        </div>
        <SelectorMes periodo={periodo} onCambiar={setPeriodo} />
      </div>

      <div className="cifras">
        <Cifra destacada etiqueta={`Falta cobrar de ${mesLargo(periodo)}`} valor={fmtBs(r.pendiente)}
          nota={r.hayCobros ? undefined : 'Aún no se generaron los cobros de este mes'}>
          {r.hayCobros && <Medidor parte={r.aplicado} total={r.cobrado} textoParte="Pagado" textoResto="Falta" />}
        </Cifra>
        <Cifra etiqueta="Deuda total" valor={fmtBs(r.deudaTotal)}
          nota={r.deudores ? `${r.deudores} ${r.deudores === 1 ? 'inquilino debe' : 'inquilinos deben'} (todos los meses)` : 'Nadie debe'} />
        <Cifra etiqueta="Facturas del mes" valor={fmtBs(r.facturado)}
          nota={r.alquiler > 0 ? `+ alquileres ${fmtBs(r.alquiler)}` : `${r.porServicio.filter((s) => s.factura !== null).length} servicios`} />
      </div>

      <div className="rejilla-2">
        <div>
          <Seccion titulo="Quién debe" descripcion="Deuda acumulada. Toca un nombre para ver su estado de cuenta.">
            {deudores.length === 0 ? (
              <div className="todo-listo"><IcoCheck /> Todos están al día.</div>
            ) : (
              <div className="barras">
                {deudores.slice(0, 8).map((d) => (
                  <button key={d.inquilino.id} className="barra-fila" onClick={() => irA('reportes', { tab: 'cuenta', inq: d.inquilino.id })}>
                    <span className="barra-nombre">
                      {d.inquilino.nombre}
                      <small>{d.mesesPendientes.length} {d.mesesPendientes.length === 1 ? 'mes' : 'meses'} pendiente{d.mesesPendientes.length === 1 ? '' : 's'}</small>
                    </span>
                    <span className="barra-pista"><span className="barra-valor" style={{ width: `${(d.saldo / maxDeuda) * 100}%`, display: 'block' }} /></span>
                    <span className="barra-monto">{fmtBs(d.saldo)}</span>
                  </button>
                ))}
                {deudores.length > 8 && (
                  <button className="btn btn-fantasma" onClick={() => irA('reportes', { tab: 'mes' })}>Ver los {deudores.length}</button>
                )}
              </div>
            )}
          </Seccion>

          {r.porServicio.length > 0 && (
            <Seccion titulo="Servicios del mes" descripcion="Factura de cada servicio y entre cuántos se reparte.">
              <div className="lista">
                {r.porServicio.map((s) => (
                  <div key={s.servicioId} className="lista-fila">
                    <span>
                      <strong>{s.nombre}</strong>
                      <small>{s.factura === null ? 'Sin factura registrada' : `Repartido entre ${s.inquilinos} inquilino${s.inquilinos === 1 ? '' : 's'}`}</small>
                    </span>
                    <span style={{ textAlign: 'right' }}>
                      <span className="monto">{s.factura === null ? '—' : fmtBs(s.factura)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </Seccion>
          )}
        </div>

        <div>
          <Seccion titulo={`Pendientes de ${mesLargo(periodo)}`}>
            {tareas.length === 0 ? (
              <div className="todo-listo"><IcoCheck /> Todo listo para este mes.</div>
            ) : (
              <div className="tareas">
                {tareas.map((t) => (
                  <button key={t.id} className="tarea" onClick={() => irA(t.vista)}>
                    <IcoAlerta />
                    <span>{t.texto}{t.detalle && <small>{t.detalle}</small>}</span>
                    <span className="tarea-ir">Ir</span>
                  </button>
                ))}
              </div>
            )}
          </Seccion>

          <Seccion titulo="Últimos pagos" acciones={<button className="btn btn-fantasma" onClick={() => irA('pagos')}>Registrar pago</button>}>
            {ultimos.length === 0 ? (
              <div className="vacio">Aún no hay pagos registrados.</div>
            ) : (
              <div className="lista">
                {ultimos.map((p) => {
                  const d = deudas.get(p.inquilinoId ?? '');
                  return (
                    <div key={p.id} className="lista-fila">
                      <span>
                        <strong>{mapInq.get(p.inquilinoId ?? '')?.nombre ?? '—'}</strong>
                        <small>{fmtFecha(p.fechaPago)} · {nombreServicio(p.servicioId, mapSvc)} · {mesLargo(p.periodo)}</small>
                      </span>
                      <span style={{ textAlign: 'right' }}>
                        <span className="monto texto-ok">+{fmtBs(p.montoBs)}</span>
                        {d && <span style={{ display: 'block', marginTop: 2 }}><EstadoDeuda saldo={d.saldo} /></span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Seccion>
        </div>
      </div>
    </div>
  );
}
