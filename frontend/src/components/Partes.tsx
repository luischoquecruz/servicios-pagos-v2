/** Piezas visuales compartidas por el panel y los reportes. */
import type { ReactNode } from 'react';
import { IcoAlerta, IcoCheck, IcoFlechaDer, IcoFlechaIzq } from './Iconos';
import { mesLargo, periodoAnterior, periodoSiguiente } from '../reportes/modelo';
import { fmtBs } from '../utils';

export function SelectorMes({ periodo, onCambiar }: { periodo: string; onCambiar: (p: string) => void }) {
  return (
    <div className="selector-mes no-imprimir">
      <button className="icono-btn" onClick={() => onCambiar(periodoAnterior(periodo))} aria-label="Mes anterior"><IcoFlechaIzq /></button>
      <span>{mesLargo(periodo)}</span>
      <button className="icono-btn" onClick={() => onCambiar(periodoSiguiente(periodo))} aria-label="Mes siguiente"><IcoFlechaDer /></button>
    </div>
  );
}

export function Cifra({ etiqueta, valor, nota, destacada, children }: {
  etiqueta: string; valor: string; nota?: ReactNode; destacada?: boolean; children?: ReactNode;
}) {
  return (
    <div className={`cifra ${destacada ? 'cifra-destacada' : ''}`}>
      <span className="cifra-etiqueta">{etiqueta}</span>
      <span className="cifra-valor">{valor}</span>
      {nota && <span className="cifra-nota">{nota}</span>}
      {children}
    </div>
  );
}

/** Medidor de avance: parte pagada sobre el total (una sola serie + pista). */
export function Medidor({ parte, total, textoParte, textoResto }: { parte: number; total: number; textoParte: string; textoResto: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((parte / total) * 100)) : 0;
  return (
    <>
      <div className="medidor" role="img" aria-label={`${pct}% ${textoParte}`}>
        {pct > 0 && <div className="medidor-relleno" style={{ width: `${pct}%` }} />}
      </div>
      <div className="medidor-leyenda">
        <span>{textoParte}: {fmtBs(parte)} ({pct}%)</span>
        <span>{textoResto}: {fmtBs(Math.max(0, total - parte))}</span>
      </div>
    </>
  );
}

/** Estado de deuda: siempre icono + texto (nunca solo color). */
export function EstadoDeuda({ saldo }: { saldo: number }) {
  if (saldo > 0.005) return <span className="estado-chip chip-debe"><IcoAlerta /> Debe {fmtBs(saldo)}</span>;
  if (saldo < -0.005) return <span className="estado-chip chip-favor"><IcoCheck /> A favor {fmtBs(-saldo)}</span>;
  return <span className="estado-chip chip-ok"><IcoCheck /> Al día</span>;
}

export function Seccion({ titulo, descripcion, acciones, children, className }: {
  titulo: string; descripcion?: ReactNode; acciones?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`seccion ${className ?? ''}`}>
      <div className="seccion-cab">
        <div>
          <h3>{titulo}</h3>
          {descripcion && <p>{descripcion}</p>}
        </div>
        {acciones}
      </div>
      {children}
    </section>
  );
}
