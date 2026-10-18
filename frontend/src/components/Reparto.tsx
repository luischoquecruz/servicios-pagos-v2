import type { RepartoServicio } from '../reportes/modelo';
import { mesLargo, periodoAnterior } from '../reportes/modelo';
import { fmtBs } from '../utils';
import { IcoAlerta } from './Iconos';
import { irA } from '../nav';

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Tarjeta que explica como se repartio la factura de un servicio en el mes. */
export function RepartoTarjeta({ r, periodo, onRegenerar, generando }: {
  r: RepartoServicio;
  periodo: string;
  onRegenerar?: (servicioId: string) => void;
  generando?: boolean;
}) {
  const tipo = r.porPersonas ? 'personas' : 'cuartos';
  return (
    <section className="seccion reparto">
      <div className="reparto-cab">
        <div>
          <h3>{r.nombre}</h3>
          <span className="muted">Se reparte por {tipo} + extras</span>
        </div>
        <div className="reparto-factura">
          <span className="cifra-etiqueta">Factura</span>
          <strong>{r.factura === null ? '—' : fmtBs(r.factura)}</strong>
        </div>
      </div>

      {r.factura === null && (
        <div className="tarea" style={{ cursor: 'default' }}>
          <IcoAlerta />
          <span>Falta registrar la factura de {r.nombre} de {mesLargo(periodo)}.<small>Sin factura no se puede repartir.</small></span>
          <button className="tarea-ir btn btn-fantasma no-imprimir" onClick={() => irA('facturas')}>Registrar</button>
        </div>
      )}

      {r.factura !== null && r.lineas.length === 0 && (
        <div className="tarea" style={{ cursor: 'default' }}>
          <IcoAlerta />
          <span>Hay factura pero todavía no se repartió entre los inquilinos.</span>
          {onRegenerar && (
            <button className="tarea-ir btn btn-fantasma no-imprimir" onClick={() => onRegenerar(r.servicioId)} disabled={generando}>Repartir</button>
          )}
        </div>
      )}

      {r.lineas.length > 0 && (
        <>
          <div className="reparto-formula">
            {r.factura !== null ? (
              <>Factura <strong>{fmtBs(r.factura)}</strong> ÷ <strong>{plural(r.pesoTotal, 'parte', 'partes')}</strong> = <strong>{fmtBs(r.valorParte)}</strong> por parte</>
            ) : (
              <>{plural(r.pesoTotal, 'parte', 'partes')} en total</>
            )}
            <small>Cada inquilino tiene una parte por {r.porPersonas ? 'persona' : 'cuarto'} y una más por cada extra.</small>
          </div>

          <div className="reparto-lineas">
            {r.lineas.map((l) => {
              const pct = r.pesoTotal > 0 ? (l.peso / r.pesoTotal) * 100 : 0;
              const desglose = [plural(l.base, r.porPersonas ? 'persona' : 'cuarto', r.porPersonas ? 'personas' : 'cuartos'),
                ...l.extras.map(([k, n]) => `${n} ${k}`)].join(' + ');
              return (
                <div key={l.inquilinoId} className="reparto-linea">
                  <div className="reparto-linea-cab">
                    <strong>{l.nombre}</strong>
                    <span className="monto">{fmtBs(l.monto)}</span>
                  </div>
                  <div className="barra-pista" aria-hidden="true">
                    <span className="barra-valor" style={{ width: `${pct}%`, display: 'block' }} />
                  </div>
                  <small className="muted">
                    {l.peso} de {r.pesoTotal} partes ({Math.round(pct)}%) · {l.ajustado ? 'factor ajustado a mano' : desglose}
                  </small>
                </div>
              );
            })}
          </div>

          <div className="reparto-total">
            <span>Total {plural(r.pesoTotal, 'parte', 'partes')}</span>
            <strong>{fmtBs(r.repartido)}</strong>
          </div>
        </>
      )}

      {r.cambios && (
        <div className="reparto-nota">
          En {mesLargo(periodoAnterior(periodo))} eran <strong>{r.cambios.anteriorTotal} partes</strong>; ahora son <strong>{r.pesoTotal}</strong> porque:
          <ul>{r.cambios.detalle.map((d) => <li key={d}>{d}</li>)}</ul>
        </div>
      )}

      {r.desactualizado.length > 0 && (
        <div className="reparto-alerta">
          <strong><IcoAlerta /> Este reparto no coincide con los datos actuales</strong>
          <ul>{r.desactualizado.map((d) => <li key={d}>{d}</li>)}</ul>
          {onRegenerar && (
            <button className="btn btn-secundario no-imprimir" onClick={() => onRegenerar(r.servicioId)} disabled={generando}>
              {generando ? 'Recalculando…' : `Recalcular ${r.nombre}`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
