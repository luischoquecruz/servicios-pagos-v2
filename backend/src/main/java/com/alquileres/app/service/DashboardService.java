package com.alquileres.app.service;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Service;

import com.alquileres.app.model.Inquilino;
import com.alquileres.app.model.Pago;
import com.alquileres.app.store.CasaStore;

/**
 * Resumenes rapidos para el panel de inicio.
 */
@Service
public class DashboardService {

    private final CasaStore store;
    private final ReporteService reportes;

    public DashboardService(CasaStore store, ReporteService reportes) {
        this.store = store;
        this.reportes = reportes;
    }

    public Resumen resumen() {
        String periodo = YearMonth.now().toString();
        var snap = store.snapshot();
        var mensual = reportes.mensual(periodo);
        var general = reportes.general();

        long activos = snap.getInquilinos().stream()
                .filter(Inquilino::isHabilitado).count();
        int morosos = (int) general.porInquilino().stream()
                .filter(t -> t.saldo().compareTo(BigDecimal.ZERO) > 0).count();
        boolean cobradoDelMes = snap.getCobros().stream()
                .anyMatch(c -> periodo.equals(c.getPeriodo()));

        List<Pago> ultimosPagos = snap.getPagos().stream()
                .sorted(Comparator.comparing(Pago::getFechaPago, Comparator.nullsLast(String::compareTo)).reversed())
                .limit(5)
                .toList();

        return new Resumen(
                periodo,
                activos,
                snap.getInquilinos().size(),
                snap.getServicios().size(),
                mensual.totalCobrado(),
                mensual.totalPagado(),
                mensual.saldo(),
                morosos,
                cobradoDelMes,
                ultimosPagos,
                mensual.porInquilino());
    }

    public record Resumen(
            String periodo,
            long inquilinosActivos,
            long totalInquilinos,
            long totalServicios,
            BigDecimal cobradoMes,
            BigDecimal pagadoMes,
            BigDecimal saldoMes,
            int deudores,
            boolean cobradoDelMes,
            List<Pago> ultimosPagos,
            List<ReporteService.TotalInquilino> porInquilino) {
    }
}