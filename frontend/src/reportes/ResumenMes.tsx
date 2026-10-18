import { useMemo, useState } from 'react';
import { useSnapshot } from '../components/SnapshotContext';
import { Cargando } from '../components/ui/Cargando';
import { Cifra, EstadoDeuda, Medidor, Seccion, SelectorMes } from '../components/Partes';
import { IcoAlerta, IcoDescargar, IcoImprimir } from '../components/Iconos';
import { mesLargo, resumenMes } from './modelo';
import { descargarCSV, fmtBs, mesActual } from '../utils';
import { irA } from '../nav';

/** Resumen del mes para el administrador, en lenguaje simple. */
export function ResumenMesPag() {
  const { snap, deudas, info } = useSnapshot();
  const [periodo, setPeriodo] = useState(mesActual());
  const r = useMemo(() => (snap ? resumenMes(snap, periodo, deudas) : null), [snap, periodo, deudas]);
  if (!snap || !r) return <Cargando />;

  const pct = r.cobrado > 0 ? Math.round((r.aplicado / r.cobrado) * 100) : 0;
  const descuadres = r.porServicio.filter((s) => s.factura !== null && s.inquilinos > 0 && Math.abs(s.factura - s.repartido) > 0.01);

  const exportar = () => {
    const filas: (string | number)[][] = [['Inquilino', 'Cobro del mes', 'Pagado', 'Falta del mes', 'Deuda total']];
    for (const f of r.porInquilino) filas.push([f.nombre, f.cobrado, f.aplicado, f.pendiente, f.saldoTotal]);
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
            Los cobros de {descuadres.map((s) => s.nombre).join(', ')} no suman lo mismo que su factura.
            <small>Vuelve a generar los cobros de ese servicio en la sección Cobros.</small>
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
                  <td className="num">{fmtBs(f.cobrado)}</td>
                  <td className="num">{fmtBs(f.aplicado)}</td>
                  <td className={`num ${f.pendiente > 0.005 ? 'texto-debe' : ''}`}>{fmtBs(f.pendiente)}</td>
                  <td><EstadoDeuda saldo={f.saldoTotal} /></td>
                </tr>
              ))}
              {r.porInquilino.length === 0 && (
                <tr><td colSpan={5} className="vacio">Sin cobros este mes.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Seccion>

      <Seccion titulo="Por servicio" descripcion="Cada factura se reparte entre los inquilinos que usan el servicio; «Repartido» debe coincidir con la factura.">
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Servicio</th>
                <th>Se reparte por</th>
                <th className="num">Factura</th>
                <th className="num">Repartido</th>
              </tr>
            </thead>
            <tbody>
              {r.porServicio.map((s) => (
                <tr key={s.servicioId}>
                  <td className="celda-nombre">{s.nombre}</td>
                  <td className="muted">{String(s.metodo).toUpperCase() === 'PERSONAS' ? 'personas' : 'cuartos'} · {s.inquilinos} inquilino{s.inquilinos === 1 ? '' : 's'}</td>
                  <td className="num">{s.factura === null ? <span className="muted">sin factura</span> : fmtBs(s.factura)}</td>
                  <td className="num">{s.inquilinos ? fmtBs(s.repartido) : <span className="muted">sin generar</span>}</td>
                </tr>
              ))}
              {r.alquiler > 0 && (
                <tr>
                  <td className="celda-nombre">Alquiler</td>
                  <td className="muted">monto fijo por inquilino</td>
                  <td className="num">—</td>
                  <td className="num">{fmtBs(r.alquiler)}</td>
                </tr>
              )}
              {r.porServicio.length === 0 && r.alquiler === 0 && (
                <tr><td colSpan={5} className="vacio">Sin facturas este mes.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Seccion>
    </div>
  );
}
