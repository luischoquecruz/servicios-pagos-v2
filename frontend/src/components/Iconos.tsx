/** Iconos de trazo (24x24, heredan el color del texto). */
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;

function Base({ children, ...rest }: P) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const IcoInicio = (p: P) => <Base {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></Base>;
export const IcoPagos = (p: P) => <Base {...p}><rect x="2.5" y="6" width="19" height="13" rx="2.5" /><path d="M2.5 10.5h19" /><path d="M16.5 15h2" /></Base>;
export const IcoFacturas = (p: P) => <Base {...p}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></Base>;
export const IcoCobros = (p: P) => <Base {...p}><rect x="4" y="3" width="16" height="18" rx="2.5" /><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M16 15v2" /></Base>;
export const IcoAsignar = (p: P) => <Base {...p}><path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 8h5M18.5 5.5v5" /></Base>;
export const IcoInquilinos = (p: P) => <Base {...p}><path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M2.5 20c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" /><path d="M16 11a2.5 2.5 0 1 0 0-5" /><path d="M17.5 14.6c2.3.5 4 2.6 4 5.4" /></Base>;
export const IcoServicios = (p: P) => <Base {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></Base>;
export const IcoReportes = (p: P) => <Base {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Base>;
export const IcoMas = (p: P) => <Base {...p}><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></Base>;
export const IcoSol = (p: P) => <Base {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Base>;
export const IcoLuna = (p: P) => <Base {...p}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" /></Base>;
export const IcoSalir = (p: P) => <Base {...p}><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4M6 12h10" /></Base>;
export const IcoCasa = (p: P) => <Base {...p}><path d="M3 11 12 4l9 7" /><path d="M6 10v10h12V10" /><path d="M10 20v-5h4v5" /></Base>;
export const IcoFlechaIzq = (p: P) => <Base {...p}><path d="m15 18-6-6 6-6" /></Base>;
export const IcoFlechaDer = (p: P) => <Base {...p}><path d="m9 18 6-6-6-6" /></Base>;
export const IcoCheck = (p: P) => <Base {...p}><path d="m5 12 4.5 4.5L19 7" /></Base>;
export const IcoAlerta = (p: P) => <Base {...p}><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17h0" /></Base>;
export const IcoImprimir = (p: P) => <Base {...p}><path d="M7 9V3h10v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /></Base>;
export const IcoWhatsApp = (p: P) => <Base {...p}><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z" /><path d="M9 9.5c.3 2 2.5 4.3 4.5 4.6l1-1 2 .8-.5 1.6c-3 .4-7.6-3.6-7.5-7.5l1.6-.5.8 2z" /></Base>;
export const IcoCerrar = (p: P) => <Base {...p}><path d="M6 6l12 12M18 6 6 18" /></Base>;
export const IcoDescargar = (p: P) => <Base {...p}><path d="M12 3v12M7 10l5 5 5-5M4 21h16" /></Base>;
