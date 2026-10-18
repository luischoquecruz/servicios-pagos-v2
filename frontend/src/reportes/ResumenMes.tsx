import { useMemo, useState } from 'react';
import { useSnapshot } from '../components/SnapshotContext';
import { Cargando } from '../components/ui/Cargando';
import { Cifra, EstadoDeuda, Medidor, Seccion, SelectorMes } from '../components/Partes';
import { IcoAlerta, IcoDescargar, IcoImprimir } from '../components/Iconos';
import { mesLargo, repartoServicios, resumenMes } from './modelo';
import type { Filtro } from './modelo';
import { ALQUILER_ID } from '../utils';
import { RepartoTarjeta } from '../components/Reparto';
import { descargarCSV, fmtBs, mesActual } from '../utils';
import { irA } from '../nav';

/** Resumen del mes para el administrador, en lenguaje simple. */
export function ResumenMesPag({ filtro }: { filtro: Filtro }) {
  const { snap, deudas, info } = useSnapshot();
  const [periodo, setPeriodo] = useState(mesActual());
  const r = useMemo(() => (snap ? resumenMes(snap, periodo, deudas, filtro) : null), [snap, periodo, deudas, filtro]);
  const repartos = useMemo(
    () => (snap ? repartoServicios(snap, periodo).filter((x) => x.lineas.length > 0 && filtro.has(x.servicioId)) : []),
    [snap, periodo, filtro],
  );
  const verAlquiler = filtro.has(ALQUILER_ID);
  const verServicios = [...filtro].some((id) => id !== ALQUILER_ID);
  if (!snap || !r) return <Cargando />;

  const pct = r.cobrado > 0 ? Math.round((r.aplicado / r.cobrado) * 100) : 0;
  const descuadres = repartos.filter((x) => x.desactualizado.length > 0);

  const exportar = () => {
    const filas: (string | number)[][] = [['Inquilino', 'Total servicios', 'Alquiler', 'Cobro del mes', 'Pagado', 'Falta del mes', 'Deuda total']];
    for (const f of r.porInquilino) filas.push([f.nombre, f.servicios, f.alquiler, f.cobrado, f.aplicado, f.pendiente, f.saldoTotal]);
    filas.push(['Total', r.servicios, r.alquiler, r.cobrado, r.aplicado, r.pendiente, r.deudaTotal]);
    filas.push([], ['Servicio', 'Factura', 'Repartido']);
    for (const s of r.porServicio) filas.push([s.nombre, s.factura ?? '', s.repartido]);
    descargarCSV(`resumen-${periodo}.csv`, filas);
  };

  return (
    <div>
      <div className="encabezado">
        <div>
          <h2 style={{ textTransform: 'capitalize' }}>{mesLargo(periodo)}</h2>
          <p>{info?.nombre ?? 'Casa'} · resumen del mes</p>
        </div>
        <div className="encabezado-acciones no-imprimir" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <SelectorMes periodo={periodo} onCambiar={setPeriodo} />
          <button className="btn btn-secundario" onClick={() => window.print()}><IcoImprimir /> Imprimir</button>
          <button className="btn btn-secundario" onClick={exportar}><IcoDescargar /> CSV</button>
        </div>
      </div>

      <div className="ayuda">
        {r.hayCobros ? (
          <>
            En <strong>{mesLargo(periodo)}</strong> las facturas de servicios sumaron <strong>{fmtBs(r.facturado)}</strong>.
            A los inquilinos se les cobró <strong>{fmtBs(r.cobrado)}</strong>
            {r.alquiler > 0 && <> ({fmtBs(r.servicios)} de servicios y {fmtBs(r.alquiler)} de alquiler)</>}.
            Ya pagaron <strong>{fmtBs(r.aplicado)}</strong> ({pct}%) y falta cobrar <strong>{fmtBs(r.pendiente)}</strong>.
          </>
        ) : (
          <>Todavía no se generaron los cobros de {mesLargo(periodo)}. Registra las facturas y ve a <strong>Cobros</strong>.</>
        )}
      </div>

      <div className="cifras">
        <Cifra destacada etiqueta="Cobrado a inquilinos" valor={fmtBs(r.cobrado)}>
          {r.hayCobros && <Medidor parte={r.aplicado} total={r.cobrado} textoParte="Pagado" textoResto="Falta" />}
        </Cifra>
        <Cifra etiqueta="Falta cobrar del mes" valor={fmtBs(r.pendiente)} />
        <Cifra etiqueta="Deuda total" valor={fmtBs(r.deudaTotal)} nota="Incluye meses anteriores" />
      </div>

      {descuadres.length > 0 && (
        <div className="tarea" style={{ marginBottom: 16, cursor: 'default' }}>
          <IcoAlerta />
          <span>
            El reparto de {descuadres.map((s) => s.nombre).join(', ')} no coincide con las facturas o asignaciones actuales.
            <small>Recalcúlalo en la sección Cobros.</small>
          </span>
          <button className="tarea-ir btn btn-fantasma no-imprimir" onClick={() => irA('cobros')}>Ir</button>
        </div>
      )}

      <Seccion titulo="Por inquilino" descripcion="Lo que se cobró este mes, lo que pagó y lo que debe en total.">
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Inquilino</th>
                {verServicios && <th className="num col-subtotal">Total servicios</th>}
                {verAlquiler && <th className="num">Alquiler</th>}
                <th className="num">Cobro del mes</th>
                <th className="num">Pagado</th>
                <th className="num">Falta del mes</th>
                <th>Estado total</th>
              </tr>
            </thead>
            <tbody>
              {r.porInquilino.map((f) => (
                <tr key={f.inquilinoId} onClick={() => irA('reportes', { tab: 'cuenta', inq: f.inquilinoId })} style={{ cursor: 'pointer' }}>
                  <td className="celda-nombre">{f.nombre}</td>
                  {verServicios && <td className="num col-subtotal">{fmtBs(f.servicios)}</td>}
                  {verAlquiler && <td className="num">{fmtBs(f.alquiler)}</td>}
                  <td className="num">{fmtBs(f.cobrado)}</td>
                  <td className="num">{fmtBs(f.aplicado)}</td>
                  <td className={`num ${f.pendiente > 0.005 ? 'texto-debe' : ''}`}>{fmtBs(f.pendiente)}</td>
                  <td><EstadoDeuda saldo={f.saldoTotal} /></td>
                </tr>
              ))}
              {r.porInquilino.length === 0 && (
                <tr><td colSpan={7} className="vacio">Sin cobros este mes.</td></tr>
              )}
            </tbody>
            {r.porInquilino.length > 0 && (
              <tfoot>
                <tr className="fila-total">
                  <td>Total</td>
                  {verServicios && <td className="num col-subtotal">{fmtBs(r.servicios)}</td>}
                  {verAlquiler && <td className="num">{fmtBs(r.alquiler)}</td>}
                  <td className="num">{fmtBs(r.cobrado)}</td>
                  <td className="num">{fmtBs(r.aplicado)}</td>
                  <td className="num">{fmtBs(r.pendiente)}</td>
                  <td>{r.deudores} con deuda · {fmtBs(r.deudaTotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Seccion>

      {repartos.length > 0 && (
        <>
          <h3 className="titulo-seccion">Cómo se repartió cada factura</h3>
          <div className="repartos">
            {repartos.map((x) => <RepartoTarjeta key={x.servicioId} r={x} periodo={periodo} />)}
          </div>
        </>
      )}
    </div>
  );
}
