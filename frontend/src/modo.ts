export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

/** true cuando la API es la Web App de Google (Apps Script) en lugar del backend Java local. */
export const MODO_SCRIPT = API_URL.includes('script.google.com');

/**
 * Intervalo de polling. En modo script solo se consulta la VERSION de los datos
 * (respuesta minima); los datos completos se piden unicamente cuando cambia.
 */
export const POLL_MS = MODO_SCRIPT ? 6000 : 5000;
