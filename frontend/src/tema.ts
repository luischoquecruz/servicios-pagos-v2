/** Tema claro/oscuro elegido por el usuario (preferencia de este dispositivo). */
export type Tema = 'auto' | 'light' | 'dark';

const LLAVE = 'alquileres.tema';

export function leerTema(): Tema {
  try {
    const t = window.localStorage.getItem(LLAVE);
    return t === 'light' || t === 'dark' ? t : 'auto';
  } catch {
    return 'auto';
  }
}

export function aplicarTema(t: Tema): void {
  const raiz = document.documentElement;
  if (t === 'auto') delete raiz.dataset.theme;
  else raiz.dataset.theme = t;
  try {
    if (t === 'auto') window.localStorage.removeItem(LLAVE);
    else window.localStorage.setItem(LLAVE, t);
  } catch {
    /* sin almacenamiento: vale para esta sesion */
  }
}

/** Tema que se ve en pantalla ahora (resuelve 'auto' con la preferencia del sistema). */
export function temaEfectivo(t: Tema): 'light' | 'dark' {
  if (t !== 'auto') return t;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
