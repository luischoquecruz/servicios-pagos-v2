import { useEffect, useState } from 'react';

/** Navegacion por #hash: permite volver atras, recargar y enlazar a una vista. */
export type Vista = 'inicio' | 'pagos' | 'facturas' | 'cobros' | 'asignaciones' | 'inquilinos' | 'servicios' | 'reportes';

const VISTAS: Vista[] = ['inicio', 'pagos', 'facturas', 'cobros', 'asignaciones', 'inquilinos', 'servicios', 'reportes'];

export interface Ruta {
  vista: Vista;
  params: URLSearchParams;
}

function leer(): Ruta {
  const h = window.location.hash.replace(/^#\/?/, '');
  const [v, q] = h.split('?');
  const vista = (VISTAS as string[]).includes(v) ? (v as Vista) : 'inicio';
  return { vista, params: new URLSearchParams(q ?? '') };
}

export function irA(vista: Vista, params?: Record<string, string>): void {
  const q = params ? '?' + new URLSearchParams(params).toString() : '';
  window.location.hash = `/${vista}${q}`;
  window.scrollTo({ top: 0 });
}

export function useRuta(): Ruta {
  const [ruta, setRuta] = useState<Ruta>(leer);
  useEffect(() => {
    const alCambiar = () => setRuta(leer());
    window.addEventListener('hashchange', alCambiar);
    return () => window.removeEventListener('hashchange', alCambiar);
  }, []);
  return ruta;
}
