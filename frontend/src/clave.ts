/**
 * Clave de acceso a la API (Apps Script o backend Java).
 * Se guarda en el navegador de cada dispositivo; si la API la rechaza se
 * emite el evento "invalida" para volver a pedirla.
 */
const LLAVE = 'alquileres.clave';

let enMemoria: string | null = null;

export function leerClave(): string {
  if (enMemoria !== null) return enMemoria;
  try {
    enMemoria = window.localStorage.getItem(LLAVE) ?? '';
  } catch {
    enMemoria = '';
  }
  return enMemoria;
}

export function guardarClave(clave: string): void {
  enMemoria = clave;
  try {
    window.localStorage.setItem(LLAVE, clave);
  } catch {
    /* sin almacenamiento: queda solo en memoria para esta sesion */
  }
}

export function borrarClave(): void {
  enMemoria = '';
  try {
    window.localStorage.removeItem(LLAVE);
    // Al cerrar sesion tambien se borran los datos guardados en este dispositivo.
    window.localStorage.removeItem('alquileres.snap.v1');
  } catch {
    /* nada que borrar */
  }
}

/** Errores de la API que indican clave ausente o incorrecta. */
export class ErrorAcceso extends Error {}

export const eventosClave = new EventTarget();

export function esErrorAcceso(mensaje: string, status?: number): boolean {
  return status === 401 || /NO_AUTORIZADO|NO_CONFIGURADA/.test(mensaje);
}

export function avisarClaveInvalida(mensaje: string): void {
  eventosClave.dispatchEvent(new CustomEvent('invalida', { detail: mensaje }));
}

// ---------- cache local de los datos (abrir la app al instante) ----------

const LLAVE_SNAP = 'alquileres.snap.v1';

export function leerSnapCache<T>(): T | null {
  try {
    const t = window.localStorage.getItem(LLAVE_SNAP);
    return t ? (JSON.parse(t) as T) : null;
  } catch {
    return null;
  }
}

export function guardarSnapCache(valor: unknown): void {
  try {
    window.localStorage.setItem(LLAVE_SNAP, JSON.stringify(valor));
  } catch {
    /* almacenamiento lleno o bloqueado: se trabaja sin cache */
  }
}

export function borrarSnapCache(): void {
  try {
    window.localStorage.removeItem(LLAVE_SNAP);
  } catch {
    /* nada que borrar */
  }
}
