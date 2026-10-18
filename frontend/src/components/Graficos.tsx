import { useEffect, useRef, useState } from 'react';
import { fmtBs } from '../utils';

export interface SerieBarras {
  nombre: string;
  color: string; // var(--serie-N)
  valores: number[];
}

/**
 * Barras agrupadas verticales (un eje, cero como base). Tooltip por grupo con
 * todas las series; leyenda siempre visible. La tabla equivalente la da el reporte.
 */
export function BarrasAgrupadas({ etiquetas, series, titulosTooltip, alto = 220 }: {
  etiquetas: string[];
  series: SerieBarras[];
  titulosTooltip?: string[];
  alto?: number;
}) {
  const [activo, setActivo] = useState<number | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  // El SVG se dibuja al ancho real del contenedor para que el texto no se agrande ni encoja.
  const [ancho, setAncho] = useState(640);
  useEffect(() => {
    const el = caja.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setAncho(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const izq = 52;
  const abajo = 24;
  const arriba = 8;
  const max = Math.max(1, ...series.flatMap((s) => s.valores));
  const paso = niceStep(max / 4);
  const tope = Math.ceil(max / paso) * paso;
  const ticks = Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso);
  const altoUtil = alto - abajo - arriba;
  const grupo = (ancho - izq) / etiquetas.length;
  const hueco = 2;
  const barra = Math.max(3, Math.min(18, (grupo * 0.7 - hueco * (series.length - 1)) / series.length));
  const y = (v: number) => arriba + altoUtil - (v / tope) * altoUtil;

  return (
    <div className="grafico" ref={caja} onMouseLeave={() => setActivo(null)}>
      <div className="leyenda">
        {series.map((s) => (
          <span key={s.nombre}><i style={{ background: s.color }} />{s.nombre}</span>
        ))}
      </div>
      <div style={{ position: 'relative' }}>
      <svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label={series.map((s) => s.nombre).join(' y ') + ' por mes'}>
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 ? 'eje' : 'rejilla'} x1={izq} x2={ancho} y1={y(t)} y2={y(t)} />
            <text x={izq - 6} y={y(t) + 4} textAnchor="end">{abreviar(t)}</text>
          </g>
        ))}
        {etiquetas.map((et, i) => {
          const x0 = izq + i * grupo + (grupo - (barra * series.length + hueco * (series.length - 1))) / 2;
          return (
            <g key={et}>
              {activo === i && <rect x={izq + i * grupo} y={arriba} width={grupo} height={altoUtil} fill="var(--hover)" />}
              {series.map((s, k) => {
                const v = s.valores[i] ?? 0;
                if (v <= 0) return null;
                const h = Math.max(2, y(0) - y(v));
                const x = x0 + k * (barra + hueco);
                return <path key={s.nombre} d={barraRedondeada(x, y(0) - h, barra, h, Math.min(4, barra / 2))} fill={s.color} />;
              })}
              <text x={izq + i * grupo + grupo / 2} y={alto - 6} textAnchor="middle">{grupo < 34 ? et.slice(0, 1) : et}</text>
              <rect x={izq + i * grupo} y={0} width={grupo} height={alto} fill="transparent"
                onMouseEnter={() => setActivo(i)} onClick={() => setActivo(i)} />
            </g>
          );
        })}
      </svg>
      {activo !== null && (
        <div className="tooltip" style={{
          left: `${Math.min(85, Math.max(15, ((izq + activo * grupo + grupo / 2) / ancho) * 100))}%`,
          top: 4,
          transform: 'translateX(-50%)',
        }}>
          <strong>{titulosTooltip?.[activo] ?? etiquetas[activo]}</strong>
          {series.map((s) => (
            <div key={s.nombre}><i style={{ background: s.color }} />{s.nombre}: {fmtBs(s.valores[activo] ?? 0)}</div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

function barraRedondeada(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

function niceStep(v: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1))));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function abreviar(v: number): string {
  if (v >= 1000) return `${(v / 1000).toLocaleString('es-BO', { maximumFractionDigits: 1 })} mil`;
  return String(v);
}
