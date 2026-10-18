package com.alquileres.app.service;

import com.alquileres.app.model.Pago;

/** Utilidades sobre pagos. Factura = pago sin inquilino (importe del servicio). */
public final class Pagos {

    /** Id del concepto virtual "Alquiler" (no es un servicio de la hoja). */
    public static final String ALQUILER_ID = "__alquiler__";

    private Pagos() {
    }

    public static boolean esFactura(Pago p) {
        return p.getInquilinoId() == null || p.getInquilinoId().isBlank();
    }

    public static boolean esAbono(Pago p) {
        return !esFactura(p);
    }

    /**
     * Impide que un servicio/mes con pagos de inquilinos se quede sin factura
     * (monto 0, factura eliminada o movida): sus cobros desaparecerian.
     */
    public static void verificarFacturaProtegida(java.util.List<Pago> pagos, String servicioId, String periodo,
                                                 String excluirId, String accion) {
        if (servicioId == null || periodo == null) {
            return;
        }
        long abonos = pagos.stream().filter(x -> esAbono(x) && servicioId.equals(x.getServicioId())
                && periodo.equals(x.getPeriodo())).count();
        if (abonos == 0) {
            return;
        }
        java.math.BigDecimal resto = pagos.stream()
                .filter(x -> esFactura(x) && !x.getId().equals(excluirId)
                        && servicioId.equals(x.getServicioId()) && periodo.equals(x.getPeriodo()))
                .map(x -> x.getMontoBs() == null ? java.math.BigDecimal.ZERO : x.getMontoBs())
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
        if (resto.signum() > 0) {
            return;
        }
        throw new IllegalStateException("No se puede " + accion + ": " + abonos + " pago(s) de inquilinos ya aplican a este "
                + "servicio en " + periodo + ". Corrige el monto de la factura (mayor a 0) en lugar de eliminarla.");
    }
}
