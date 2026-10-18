import { useMemo, useState } from 'react';
import { useSnapshot } from '../components/SnapshotContext';
import { Cargando } from '../components/ui/Cargando';
import { EstadoDeuda, Seccion } from '../components/Partes';
import { IcoImprimir, IcoWhatsApp } from '../components/Iconos';
import { enlaceWhatsApp, estadoCuenta, mesLargo, textoWhatsApp } from './modelo';
import { fmtBs, fmtFecha, nombreServicio } from '../utils';
import { irA } from '../nav';

type Filtro = 'deuda' | 'seis' | 'todo';

/** Estado de cuenta de un inquilino: que debe, por que y que pago. */
export function EstadoCuentaPag({ inquilinoId }: { inquilinoId: string | null }) {
  const { snap, deudas, mapSvc, info } = useSnapshot();
  const [filtro, setFiltro] = useState<Filtro>('seis');
  const [copiado, setCopiado] = useState(false);

  const opciones = useMemo(
    () => [...deudas.values()].filter((d) => d.cargos > 0 || d.pagado > 0)
      .sort((a, b) => Number(b.inquilino.habilitado) - Number(a.inquilino.habilitado) || a.inquilino.nombre.localeCompare(b.inquilino.nombre)),
    [deudas],
  );
  const id = inquilinoId ?? opciones[0]?.inquilino.id ?? null;
  const ec = useMemo(() => (snap && id ? estadoCuenta(snap, id, deudas, mapSvc) : null), [snap, id, deudas, mapSvc]);

  if (!snap) return <Cargando />;
  if (opciones.length === 0) return <div className="seccion vacio">Aún no hay cobros ni pagos registrados.</div>;
  if (!ec) return <Cargando />;

  const mesesOrden = [...ec.meses].reverse();
  const visibles = filtro === 'deuda' ? mesesOrden.filter((m) => m.saldoMes > 0.005)
    : filtro === 'seis' ? mesesOrden.slice(0, 6) : mesesOrden;
  const texto = textoWhatsApp(ec, info?.nombre ?? 'la casa');
  const inq = ec.inquilino;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* el navegador no permite copiar */
    }
  };

  return (
    <div>
      <div className="encabezado no-imprimir">
        <label className="campo" style={{ minWidth: 240, margin: 0 }}>
          <span className="campo-label">Inquilino</span>
          <select className="input" value={id ?? ''} onChange={(e) => irA('reportes', { tab: 'cuenta', inq: e.target.value })}>
            {opciones.map((d) => (
              <option key={d.inquilino.id} value={d.inquilino.id}>
                {d.inquilino.nombre}{d.inquilino.habilitado ? '' : ' (inactivo)'}{d.saldo > 0.005 ? ` — debe ${fmtBs(d.saldo)}` : ''}
              </option>
            ))}
          </select>
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secundario" onClick={() => window.print()}><IcoImprimir /> Imprimir</button>
          <button className="btn btn-secundario" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar texto'}</button>
          {inq.celular && String(inq.celular).replace(/\D/g, '').length >= 7 && (
            <a className="btn btn-primario" href={enlaceWhatsApp(inq.celular, texto)} target="_blank" rel="noreferrer"><IcoWhatsApp /> Enviar por WhatsApp</a>
          )}
        </div>
      </div>

      <section className="seccion">
        <div className="cuenta-cab">
          <div>
            <p className="muted" style={{ margin: 0 }}>Estado de cuenta · {info?.nombre ?? 'Casa'}</p>
            <h3>{inq.nombre}</h3>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              {inq.habitaciones} {inq.habitaciones === 1 ? 'cuarto' : 'cuartos'} · {inq.personas} {inq.personas === 1 ? 'persona' : 'personas'}
              {inq.cobraAlquiler && inq.alquilerBs ? ` · alquiler ${fmtBs(inq.alquilerBs)}/mes` : ''}
              {inq.celular ? ` · ${inq.celular}` : ''}
            </p>
          </div>
          <div className="cuenta-saldo">
            <span className="cifra-etiqueta">{ec.saldo > 0.005 ? 'Total pendiente' : ec.saldo < -0.005 ? 'Saldo a favor' : 'Saldo'}</span>
            <div className={`cifra-valor ${ec.saldo > 0.005 ? 'texto-debe' : ''}`}>{fmtBs(Math.abs(ec.saldo))}</div>
            <EstadoDeuda saldo={ec.saldo} />
          </div>
        </div>
        <p className="muted" style={{ margin: '10px 0 0', fontSize: 13 }}>
          Cobrado en total {fmtBs(ec.cargos)} · pagado {fmtBs(ec.pagado)} · emitido el {new Date().toLocaleDateString('es-BO')}
        </p>
      </section>

      <div className="ayuda no-imprimir">
        Cada factura de servicio se divide en partes: una por cuarto (o por persona) y una más por cada extra
        (refrigerador, ducha…). Los pagos se aplican primero al mes indicado y lo que sobra, a la deuda más antigua.
      </div>

      <Seccion titulo="Detalle por mes" acciones={
        <div className="chips no-imprimir">
          {([['seis', 'Últimos 6 meses'], ['deuda', 'Solo con deuda'], ['todo', 'Todo']] as [Filtro, string][]).map(([k, t]) => (
            <button key={k} className={`chip ${filtro === k ? 'activo' : ''}`} onClick={() => setFiltro(k)}>{t}</button>
          ))}
        </div>
      }>
        {visibles.length === 0 && <div className="vacio">No hay meses con deuda.</div>}
        {visibles.map((m) => (
          <div key={m.periodo} className="cuenta-mes">
            <div className="cuenta-mes-cab">
              <strong>{mesLargo(m.periodo)}</strong>
              <EstadoDeuda saldo={m.saldoMes} />
            </div>
            {m.lineas.map((l) => (
              <div key={l.servicioId} className="cuenta-linea">
                <span>{l.concepto}</span>
                <span className="monto">{fmtBs(l.monto)}</span>
                <small>{l.explicacion}</small>
              </div>
            ))}
            {m.pagos.map((p) => (
              <div key={p.id} className="cuenta-linea cuenta-pago">
                <span>Pago del {fmtFecha(p.fechaPago)} · {nombreServicio(p.servicioId, mapSvc)}</span>
                <span className="monto">−{fmtBs(p.montoBs)}</span>
                {p.observacion && <small>{p.observacion}</small>}
              </div>
            ))}
            <div className="cuenta-total">
              <span>Cobro del mes {fmtBs(m.cargos)} · pagado {fmtBs(m.aplicado)}</span>
              <span className={m.saldoAcumulado > 0.005 ? 'texto-debe' : 'texto-ok'}>
                {m.saldoAcumulado > 0.005 ? `Debe acumulado ${fmtBs(m.saldoAcumulado)}` : 'Al día hasta aquí'}
              </span>
            </div>
          </div>
        ))}
      </Seccion>
    </div>
  );
}
