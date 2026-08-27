export interface Inquilino {
  id: string;
  nombre: string;
  celular: string;
  fechaIngreso: string;
  fechaSalida: string | null;
  habilitado: boolean;
  habitaciones: number;
  personas: number;
  /** true si se le cobra el alquiler mensual */
  cobraAlquiler?: boolean;
  /** Monto de alquiler mensual en Bs (por inquilino, no global) */
  alquilerBs?: number;
}

export interface Servicio {
  id: string;
  nombre: string;
  unidadMedida?: string;
  metodoPago: 'CUARTOS' | 'PERSONAS' | string;
  extras: string[];
}

export interface ServicioInquilino {
  id: string;
  inquilinoId: string;
  servicioId: string;
  activo: boolean;
  extras: Record<string, number>;
}

/**
 * Asignacion POR PERIODO de un servicio a un inquilino, con los extras
 * (cantidades dinamicas segun el servicio).
 */
export interface Asignacion {
  id: string;
  periodo: string;
  inquilinoId: string;
  servicioId: string;
  activo: boolean;
  extras: Record<string, number>;
}

export interface Cobro {
  id: string;
  periodo: string;
  inquilinoId: string;
  servicioId: string;
  peso: number;
  pesoTotal: number;
  montoBase: number;
  montoExtra: number;
  montoTotal: number;
  habitaciones: number;
  personas: number;
  extras: Record<string, number>;
  detalle?: ExtraItem[];
}

/** Item desglosado de un extra dentro de un cobro (para reportes). */
export interface ExtraItem {
  tipo: string;
  cantidad: number;
  monto: number;
}

export interface Pago {
  id: string;
  inquilinoId: string | null;
  servicioId: string | null;
  periodo: string;
  fechaPago: string;
  montoBs: number;
  cantidad?: number | null;
  unidadMedida?: string | null;
  observacion?: string;
}

export interface Snapshot {
  inquilinos: Inquilino[];
  servicios: Servicio[];
  serviciosInquilinos: ServicioInquilino[];
  cobros: Cobro[];
  pagos: Pago[];
  asignaciones: Asignacion[];
  syncedAt: string | null;
  version: number;
  fuente: string;
}

export interface Sync {
  snapshot: Snapshot;
  info: Info;
}

export interface Info {
  nombre: string;
  fuente: string;
  google: boolean;
  conectado: boolean;
  error: string | null;
  syncedAt: string | null;
  version: number;
  periodos: string[];
}

export interface FilaDetalle {
  id: string;
  inquilinoId: string;
  inquilinoNombre: string;
  servicioId: string;
  servicioNombre: string;
  peso: number;
  pesoTotal: number;
  montoBase: number;
  montoExtra: number;
  montoTotal: number;
  pagado: number;
  saldo: number;
  habitaciones: number;
  personas: number;
  extras: Record<string, number>;
  extraItems?: ExtraItem[];
}

export interface TotalInquilino {
  inquilinoId: string;
  nombre: string;
  cobrado: number;
  pagado: number;
  saldo: number;
}

export interface TotalServicio {
  servicioId: string;
  nombre: string;
  cobrado: number;
  pagado: number;
  saldo: number;
  cantidadCobros: number;
}

export interface TotalPeriodo {
  periodo: string;
  cobrado: number;
  pagado: number;
  saldo: number;
}

export interface ReporteMensual {
  periodo: string;
  totalCobrado: number;
  totalPagado: number;
  saldo: number;
  porInquilino: TotalInquilino[];
  porServicio: TotalServicio[];
  detalle: FilaDetalle[];
}

export interface ReporteGeneral {
  totalCobrado: number;
  totalPagado: number;
  saldo: number;
  porPeriodo: TotalPeriodo[];
  porInquilino: TotalInquilino[];
  porServicio: TotalServicio[];
}

export interface Resumen {
  periodo: string;
  inquilinosActivos: number;
  totalInquilinos: number;
  totalServicios: number;
  cobradoMes: number;
  pagadoMes: number;
  saldoMes: number;
  deudores: number;
  cobradoDelMes: boolean;
  ultimosPagos: Pago[];
  porInquilino: TotalInquilino[];
}
