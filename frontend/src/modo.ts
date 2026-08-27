export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

/** true cuando la API es la Web App de Google (Apps Script) en lugar del backend Java local. */
export const MODO_SCRIPT = API_URL.includes('script.google.com');

/**
 * Intervalo de polling. En modo script se espacia para cuidar las cuotas de
 * Apps Script (tiempo de ejecucion 90 min/dia); en local se mantiene 5s.
 */
export const POLL_MS = MODO_SCRIPT ? 15000 : 5000;
