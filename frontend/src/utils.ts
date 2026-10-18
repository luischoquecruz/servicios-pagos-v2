/** Utilidades de formato y fechas en es-BO */

import type { Servicio } from './types';

/** Id del servicio virtual "Alquiler" generado por el backend. */
export const ALQUILER_ID = '__alquiler__';

/** Nombre de un servicio con el nombre del virtual "Alquiler". */
export function nombreServicio(
  svcId: string | null | undefined,
  mapSvc: Map<string, Servicio>,
): string {
  if (!svcId) return 'General';
  if (svcId === ALQUILER_ID) return 'Alquiler';
  return mapSvc.get(svcId)?.nombre ?? svcId;
}

export function fmtBs(v: number | string | null | undefined): string {
  let n = toNum(v);
  if (Math.abs(n) < 0.005) n = 0; // evita "Bs -0,00" por redondeo
  return 'Bs ' + n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function toNum(v: number | string | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isNaN(n) ? 0 : n;
}

export function fmtFecha(f: string | null | undefined): string {
  if (!f) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return f;
}

export function hoy(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function mesActual(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${mm}`;
}

export function esMes(periodo: string): boolean {
  return /^\d{4}-\d{2}$/.test(periodo);
}

/** Normaliza cualquier valor de periodo a YYYY-MM (acepta Date, ISO o celdas de hoja). */
export function normPeriodo(v: string | null | undefined): string {
  if (!v) return '';
  const m = /^(\d{4})-(\d{2})/.exec(v);
  if (m) return `${m[1]}-${m[2]}`;
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  return v;
}

export function descargarCSV(nombre: string, filas: (string | number)[][]) {
  const csv = filas.map((f) => f.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(v: string | number): string {
  const s = String(v ?? '');
  if (/[",\n;]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}