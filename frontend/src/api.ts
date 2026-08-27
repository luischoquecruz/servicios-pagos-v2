import type {
  Asignacion,
  Cobro,
  Inquilino,
  Info,
  Pago,
  ReporteGeneral,
  ReporteMensual,
  Resumen,
  Servicio,
  ServicioInquilino,
  Snapshot,
  Sync,
} from './types';
import { API_URL, MODO_SCRIPT } from './modo';
import { normPeriodo } from './utils';

interface Endpoint {
  ruta: string; // modo local: path tras /api
  metodo: string; // GET/POST/PUT/DELETE (modo local; en script se traduce a GET/POST)
  accion: string; // modo script: parametro ?action=
  params?: Record<string, string>;
  body?: unknown;
}

function scriptURL(accion: string, params?: Record<string, string>): string {
  const q = new URLSearchParams({ action: accion });
  if (params) {
    for (const k of Object.keys(params)) q.set(k, params[k]);
  }
  return `${API_URL}?${q.toString()}`;
}

async function pedir(url: string, init: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* respuesta sin cuerpo */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined;
  const body = await res.json();
  if (body && typeof body === 'object') {
    if (body.ok === false) throw new Error(body.error || 'Error de la API');
    if (body.ok === true && 'data' in body) return body.data;
  }
  return body;
}

async function llamar(e: Endpoint): Promise<any> {
  const init: RequestInit = { method: e.metodo === 'GET' ? 'GET' : 'POST' };
  if (MODO_SCRIPT) {
    // Apps Script solo responde a GET/POST y no le importa el Content-Type:
    // usamos text/plain para evitar el preflight CORS.
    if (e.body !== undefined) {
      init.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
      init.body = JSON.stringify(e.body);
    }
    return pedir(scriptURL(e.accion, e.params), init);
  }
  init.method = e.metodo;
  let url = `${API_URL}/api/${e.ruta}`;
  if (e.params) url += '?' + new URLSearchParams(e.params).toString();
  if (e.body !== undefined) {
    // Spring/jackson requiere application/json para deserializar el body;
    // sin este header fetch manda text/plain y el backend responde 415/500.
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(e.body);
  }
  return pedir(url, init);
}

// ---------------- lectura ----------------

/** Aplica normPeriodo a cada registro con campo periodo (defensa ante celdas Date de hojas). */
function normArrPeriodo<T extends { periodo?: string | null }>(arr: T[]): T[] {
  let cambio = false;
  const out = arr.map((x) => {
    const np = normPeriodo(x.periodo);
    if (np !== (x.periodo ?? '')) {
      cambio = true;
      return { ...x, periodo: np };
    }
    return x;
  });
  return cambio ? out : arr;
}

function normalizarSnapshot(s: Snapshot): Snapshot {
  const pagos = normArrPeriodo(s.pagos);
  const cobros = normArrPeriodo(s.cobros);
  const asignaciones = normArrPeriodo(s.asignaciones);
  if (pagos === s.pagos && cobros === s.cobros && asignaciones === s.asignaciones) return s;
  return { ...s, pagos, cobros, asignaciones };
}

export const getSnapshot = async (): Promise<Snapshot> =>
  normalizarSnapshot(await llamar({ ruta: 'snapshot', metodo: 'GET', accion: 'snapshot' }));
export const getSync = async (): Promise<Sync> => {
  const d: Sync = await llamar({ ruta: 'sync', metodo: 'GET', accion: 'sync' });
  return {
    snapshot: normalizarSnapshot(d.snapshot),
    info: d.info ? { ...d.info, periodos: (d.info.periodos ?? []).map(normPeriodo) } : d.info,
  };
};
export const getInfo = async (): Promise<Info> => {
  const d: Info = await llamar({ ruta: 'config', metodo: 'GET', accion: 'config' });
  return d ? { ...d, periodos: (d.periodos ?? []).map(normPeriodo) } : d;
};
export const getDashboard = (): Promise<Resumen> =>
  llamar({ ruta: 'dashboard', metodo: 'GET', accion: 'dashboard' });
export const getReporteMensual = (periodo: string): Promise<ReporteMensual> =>
  llamar({ ruta: 'reportes/mensual', metodo: 'GET', accion: 'reporte.mensual', params: { periodo } });
export const getReporteGeneral = (): Promise<ReporteGeneral> =>
  llamar({ ruta: 'reportes/general', metodo: 'GET', accion: 'reporte.general' });
export const getDiagnostico = (periodo: string): Promise<unknown> =>
  llamar({ ruta: 'diagnostico', metodo: 'GET', accion: 'diagnostico', params: { periodo } });

// ---------------- inquilinos ----------------

export const crearInquilino = (i: Inquilino): Promise<Inquilino> =>
  llamar({ ruta: 'inquilinos', metodo: 'POST', accion: 'inquilinos.crear', body: i });
export const actualizarInquilino = (i: Inquilino): Promise<Inquilino> =>
  llamar({ ruta: `inquilinos/${i.id}`, metodo: 'PUT', accion: 'inquilinos.actualizar', params: { id: i.id }, body: i });
export const eliminarInquilino = (id: string): Promise<void> =>
  llamar({ ruta: `inquilinos/${id}`, metodo: 'DELETE', accion: 'inquilinos.eliminar', params: { id } });
export const setEstadoInquilino = (id: string, habilitado: boolean): Promise<Inquilino> =>
  llamar({
    ruta: `inquilinos/${id}/estado`,
    metodo: 'POST',
    accion: 'inquilinos.estado',
    params: { id, habilitado: String(habilitado) },
  });

// ---------------- servicios ----------------

export const crearServicio = (s: Servicio): Promise<Servicio> =>
  llamar({ ruta: 'servicios', metodo: 'POST', accion: 'servicios.crear', body: s });
export const actualizarServicio = (s: Servicio): Promise<Servicio> =>
  llamar({ ruta: `servicios/${s.id}`, metodo: 'PUT', accion: 'servicios.actualizar', params: { id: s.id }, body: s });
export const eliminarServicio = (id: string): Promise<void> =>
  llamar({ ruta: `servicios/${id}`, metodo: 'DELETE', accion: 'servicios.eliminar', params: { id } });

// ---------------- servicios por inquilino ----------------

export const guardarServicioInquilino = (c: ServicioInquilino): Promise<ServicioInquilino> =>
  llamar({ ruta: 'servicios-inquilinos', metodo: 'PUT', accion: 'servicios_inquilinos.guardar', body: c });
export const eliminarServicioInquilino = (id: string): Promise<void> =>
  llamar({ ruta: `servicios-inquilinos/${id}`, metodo: 'DELETE', accion: 'servicios_inquilinos.eliminar', params: { id } });

// ---------------- asignaciones por periodo (precios POR INQUILINO) ----------------

export const guardarAsignacion = (a: Asignacion): Promise<Asignacion> =>
  llamar({ ruta: 'asignaciones', metodo: 'POST', accion: 'asignaciones.guardar', body: a });
export const eliminarAsignacion = (id: string): Promise<void> =>
  llamar({ ruta: `asignaciones/${id}`, metodo: 'DELETE', accion: 'asignaciones.eliminar', params: { id } });

// ---------------- cobros ----------------

export const generarCobros = (periodo: string): Promise<Cobro[]> =>
  llamar({ ruta: 'cobros/generar', metodo: 'POST', accion: 'cobros.generar', params: { periodo } });
export const generarCobrosServicio = (periodo: string, servicioId: string): Promise<Cobro[]> =>
  llamar({
    ruta: 'cobros/generarServicio',
    metodo: 'POST',
    accion: 'cobros.generarServicio',
    params: { periodo, servicioId },
  });
export const editarCobrosPeso = (
  periodo: string,
  servicioId: string,
  pesos: Record<string, number>,
): Promise<Cobro[]> =>
  llamar({
    ruta: 'cobros/editarPeso',
    metodo: 'POST',
    accion: 'cobros.editarPeso',
    params: { periodo, servicioId },
    body: { pesos },
  });

// ---------------- pagos ----------------

export const registrarPago = (p: Pago): Promise<Pago> =>
  llamar({ ruta: 'pagos', metodo: 'POST', accion: 'pagos.crear', body: p });
export const eliminarPago = (id: string): Promise<void> =>
  llamar({ ruta: `pagos/${id}`, metodo: 'DELETE', accion: 'pagos.eliminar', params: { id } });
