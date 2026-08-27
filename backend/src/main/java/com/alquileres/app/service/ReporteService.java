package com.alquileres.app.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.alquileres.app.model.Cobro;
import com.alquileres.app.model.Inquilino;
import com.alquileres.app.model.Pago;
import com.alquileres.app.model.Servicio;
import com.alquileres.app.model.Snapshot;
import com.alquileres.app.store.CasaStore;

/**
 * Reportes detallados: mensual por periodo o general sobre todos los datos.
 */
@Service
public class ReporteService {

    private final CasaStore store;

    public ReporteService(CasaStore store) {
        this.store = store;
    }

    public static final BigDecimal CERO = new BigDecimal("0.00");

    /** Detalle mensual de un periodo YYYY-MM. */
    public ReporteMensual mensual(String periodo) {
        CalculoService.Periodo p = CalculoService.parse(periodo);
        Snapshot snap = store.snapshot();

        Map<String, String> nombreInq = snap.getInquilinos().stream()
                .collect(Collectors.toMap(Inquilino::getId, Inquilino::getNombre, (a, b) -> a));
        Map<String, String> nombreSvc = snap.getServicios().stream()
                .collect(Collectors.toMap(Servicio::getId, Servicio::getNombre, (a, b) -> a));

        List<Cobro> cobros = snap.getCobros().stream()
                .filter(c -> p.prefix().equals(c.getPeriodo()))
                .toList();

        List<Pago> pagosPeriodo = snap.getPagos().stream()
                .filter(pg -> p.prefix().equals(pg.getPeriodo()))
                .toList();

        List<FilaDetalle> detalle = new ArrayList<>();
        for (Cobro c : cobros) {
         Map<String, Integer> extras = c.getExtras() != null ? new java.util.HashMap<>(c.getExtras()) : new java.util.HashMap<>();
         detalle.add(new FilaDetalle(
                     c.getId(),
                     c.getInquilinoId(),
                     nombreInq.getOrDefault(c.getInquilinoId(), c.getInquilinoId()),
                     c.getServicioId(),
                     nombreSvc.getOrDefault(c.getServicioId(), c.getServicioId()),
                     c.getPeso(), c.getPesoTotal(),
                     c.getMontoBase(), c.getMontoExtra(), c.getMontoTotal(),
                     pagadoDe(pagosPeriodo, c.getInquilinoId(), c.getServicioId()),
                     c.getMontoTotal().subtract(pagadoDe(pagosPeriodo, c.getInquilinoId(), c.getServicioId())),
                     c.getHabitaciones(), c.getPersonas(),
                     extras));
        }

        // Totales por inquilino
        Map<String, BigDecimal[]> porInq = new LinkedHashMap<>();
        Map<String, String> nombresInq = new LinkedHashMap<>();
        for (FilaDetalle f : detalle) {
            BigDecimal[] t = porInq.computeIfAbsent(f.inquilinoId(), k -> new BigDecimal[]{CERO, CERO});
            t[0] = t[0].add(f.montoTotal);
        }
        pagosPeriodo.stream().filter(pg -> pg.getInquilinoId() != null).forEach(pg -> {
            BigDecimal[] t = porInq.computeIfAbsent(pg.getInquilinoId(), k -> new BigDecimal[]{CERO, CERO});
            t[1] = t[1].add(nz(pg.getMontoBs()));
            nombresInq.computeIfAbsent(pg.getInquilinoId(), k -> nombreInq.getOrDefault(k, k));
        });
        List<TotalInquilino> porInquilino = new ArrayList<>();
        porInq.forEach((id, t) -> {
            BigDecimal saldo = t[0].subtract(t[1]);
            porInquilino.add(new TotalInquilino(id, nombresInq.getOrDefault(id, nombreInq.getOrDefault(id, id)),
                    red(t[0]), red(t[1]), red(saldo)));
        });
        porInquilino.sort(Comparator.comparing(TotalInquilino::saldo).reversed());

        // Totales por servicio
        Map<String, BigDecimal[]> porSvcMap = new LinkedHashMap<>();
        for (FilaDetalle f : detalle) {
            BigDecimal[] t = porSvcMap.computeIfAbsent(f.servicioId(), k -> new BigDecimal[]{CERO, CERO, CERO});
            t[0] = t[0].add(f.montoTotal);
            t[1] = t[1].add(f.pagado);
            t[2] = t[2].add(BigDecimal.ONE);
        }
        List<TotalServicio> porServicio = new ArrayList<>();
        porSvcMap.forEach((id, t) -> porServicio.add(new TotalServicio(
                id, nombreSvc.getOrDefault(id, id), red(t[0]), red(t[1]), red(t[0].subtract(t[1])),
                t[2].intValue())));
        porServicio.sort(Comparator.comparing(TotalServicio::cobrado).reversed());

        BigDecimal totalCobrado = cobros.stream().map(Cobro::getMontoTotal)
                .reduce(CERO, BigDecimal::add);
        BigDecimal totalPagado = pagosPeriodo.stream()
                .filter(pg -> pg.getInquilinoId() != null)
                .map(pg -> nz(pg.getMontoBs()))
                .reduce(CERO, BigDecimal::add);

        return new ReporteMensual(p.prefix(), red(totalCobrado), red(totalPagado), red(totalCobrado.subtract(totalPagado)),
                porInquilino, porServicio, detalle);
    }

    /** Reporte general: todos los periodos e inquilinos. */
    public ReporteGeneral general() {
        Snapshot snap = store.snapshot();

        Map<String, String> nombreInq = snap.getInquilinos().stream()
                .collect(Collectors.toMap(Inquilino::getId, Inquilino::getNombre, (a, b) -> a));
        Map<String, String> nombreSvc = snap.getServicios().stream()
                .collect(Collectors.toMap(Servicio::getId, Servicio::getNombre, (a, b) -> a));

        List<Cobro> cobros = snap.getCobros();
        List<Pago> pagos = snap.getPagos();

        // Totales por inquilino
        Map<String, BigDecimal[]> porInq = new LinkedHashMap<>();
        cobros.forEach(c -> {
            BigDecimal[] t = porInq.computeIfAbsent(c.getInquilinoId(), k -> new BigDecimal[]{CERO, CERO});
            t[0] = t[0].add(c.getMontoTotal());
        });
        pagos.stream().filter(pg -> pg.getInquilinoId() != null).forEach(pg -> {
            BigDecimal[] t = porInq.computeIfAbsent(pg.getInquilinoId(), k -> new BigDecimal[]{CERO, CERO});
            t[1] = t[1].add(nz(pg.getMontoBs()));
        });
        List<TotalInquilino> porInquilino = new ArrayList<>();
        porInq.forEach((id, t) -> porInquilino.add(new TotalInquilino(
                id, nombreInq.getOrDefault(id, id), red(t[0]), red(t[1]), red(t[0].subtract(t[1])))));
        porInquilino.sort(Comparator.comparing(TotalInquilino::saldo).reversed());

        // Totales por servicio
        Map<String, BigDecimal[]> porSvcMap = new LinkedHashMap<>();
        cobros.forEach(c -> {
            BigDecimal[] t = porSvcMap.computeIfAbsent(c.getServicioId(), k -> new BigDecimal[]{CERO, CERO, CERO});
            t[0] = t[0].add(c.getMontoTotal());
            t[2] = t[2].add(BigDecimal.ONE);
        });
        pagos.stream()
                .filter(pg -> pg.getServicioId() != null)
                .filter(pg -> pg.getInquilinoId() != null)
                .forEach(pg -> {
            BigDecimal[] t = porSvcMap.computeIfAbsent(pg.getServicioId(), k -> new BigDecimal[]{CERO, CERO, CERO});
            t[1] = t[1].add(nz(pg.getMontoBs()));
        });
        List<TotalServicio> porServicio = new ArrayList<>();
        porSvcMap.forEach((id, t) -> porServicio.add(new TotalServicio(
                id, nombreSvc.getOrDefault(id, id), red(t[0]), red(t[1]), red(t[0].subtract(t[1])),
                t[2].intValue())));
        porServicio.sort(Comparator.comparing(TotalServicio::cobrado).reversed());

        // Totales por periodo
        Map<String, BigDecimal[]> porPeriodoMap = new LinkedHashMap<>();
        cobros.forEach(c -> {
            BigDecimal[] t = porPeriodoMap.computeIfAbsent(c.getPeriodo(), k -> new BigDecimal[]{CERO, CERO});
            t[0] = t[0].add(c.getMontoTotal());
        });
        pagos.forEach(pg -> {
            if (pg.getPeriodo() != null && pg.getInquilinoId() != null) {
                BigDecimal[] t = porPeriodoMap.computeIfAbsent(pg.getPeriodo(), k -> new BigDecimal[]{CERO, CERO});
                t[1] = t[1].add(nz(pg.getMontoBs()));
            }
        });
        List<TotalPeriodo> porPeriodo = new ArrayList<>();
        porPeriodoMap.forEach((id, t) -> porPeriodo.add(new TotalPeriodo(
                id, red(t[0]), red(t[1]), red(t[0].subtract(t[1])))));
        porPeriodo.sort(Comparator.comparing(TotalPeriodo::periodo));

        BigDecimal totalCobrado = cobros.stream().map(c -> nz(c.getMontoTotal())).reduce(CERO, BigDecimal::add);
        BigDecimal totalPagado = pagos.stream().filter(pg -> pg.getInquilinoId() != null)
                .map(pg -> nz(pg.getMontoBs())).reduce(CERO, BigDecimal::add);

        return new ReporteGeneral(red(totalCobrado), red(totalPagado), red(totalCobrado.subtract(totalPagado)),
                porPeriodo, porInquilino, porServicio);
    }

    private BigDecimal pagadoDe(List<Pago> pagos, String inquilinoId, String servicioId) {
        return pagos.stream()
                .filter(pg -> pg.getInquilinoId() != null)
                .filter(pg -> inquilinoId.equals(pg.getInquilinoId()))
                .filter(pg -> servicioId.equals(pg.getServicioId()))
                .map(pg -> nz(pg.getMontoBs()))
                .reduce(CERO, BigDecimal::add);
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? CERO : v;
    }

    private static BigDecimal red(BigDecimal v) {
        return v.setScale(2, RoundingMode.HALF_UP);
    }

    // ================= DTOs =================

    public record FilaDetalle(
            String id,
            String inquilinoId,
            String inquilinoNombre,
            String servicioId,
            String servicioNombre,
            BigDecimal peso,
            BigDecimal pesoTotal,
            BigDecimal montoBase,
            BigDecimal montoExtra,
            BigDecimal montoTotal,
            BigDecimal pagado,
            BigDecimal saldo,
            int habitaciones,
            int personas,
            Map<String, Integer> extras) {
    }

    public record TotalInquilino(String inquilinoId, String nombre, BigDecimal cobrado,
                                 BigDecimal pagado, BigDecimal saldo) {
    }

    public record TotalServicio(String servicioId, String nombre, BigDecimal cobrado,
                                BigDecimal pagado, BigDecimal saldo, int cantidadCobros) {
    }

    public record TotalPeriodo(String periodo, BigDecimal cobrado, BigDecimal pagado, BigDecimal saldo) {
    }

    public record ReporteMensual(String periodo, BigDecimal totalCobrado, BigDecimal totalPagado,
                                 BigDecimal saldo, List<TotalInquilino> porInquilino,
                                 List<TotalServicio> porServicio, List<FilaDetalle> detalle) {
    }

    public record ReporteGeneral(BigDecimal totalCobrado, BigDecimal totalPagado, BigDecimal saldo,
                                 List<TotalPeriodo> porPeriodo, List<TotalInquilino> porInquilino,
                                 List<TotalServicio> porServicio) {
    }
}