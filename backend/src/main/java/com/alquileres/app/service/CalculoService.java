package com.alquileres.app.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.alquileres.app.model.Asignacion;
import com.alquileres.app.model.Cobro;
import com.alquileres.app.model.Inquilino;
import com.alquileres.app.model.Pago;
import com.alquileres.app.model.Servicio;
import com.alquileres.app.model.Snapshot;
import com.alquileres.app.store.CasaStore;

/**
 * Motor de cobros.
 * Mes a mes, para cada servicio se reparte la factura del mes (el Pago sin
 * inquilino registrado para ese servicio y periodo) entre los inquilinos
 * suscritos, segun el metodo configurado en el servicio: por cantidad de
 * habitaciones (CUARTOS) o por cantidad de personas (PERSONAS).
 * Los extras por consumo definidos por inquilino se suman como UNIDADES al
 * factor de reparto. Ej.: 1 cuarto + 2 extras => factor 3.
 */
@Service
public class CalculoService {

    private final CasaStore store;

    public CalculoService(CasaStore store) {
        this.store = store;
    }

    /**
     * Calcula (sin guardar) las lineas de cobro de un periodo YYYY-MM.
     */
    public List<Cobro> calcularPeriodo(String periodo) {
        return calcularPara(periodo, null);
    }

    /**
     * Calcula (sin guardar) las lineas de cobro de UN servicio en el periodo.
     */
    public List<Cobro> calcularServicio(String periodo, String servicioId) {
        return calcularPara(periodo, servicioId);
    }

    private List<Cobro> calcularPara(String periodo, String servicioFiltro) {
        Periodo p = parse(periodo);
        Snapshot snap = store.snapshot();

        Map<String, Inquilino> inquilinos = snap.getInquilinos().stream()
                .collect(Collectors.toMap(Inquilino::getId, Function.identity(), (a, b) -> a));
        Map<String, Servicio> servicios = snap.getServicios().stream()
                .collect(Collectors.toMap(Servicio::getId, Function.identity(), (a, b) -> a));

        List<Asignacion> asig = snap.getAsignaciones().stream()
                .filter(a -> p.prefix.equals(a.getPeriodo()))
                .filter(a -> Boolean.TRUE.equals(a.isActivo()))
                .filter(a -> inquilinos.containsKey(a.getInquilinoId()))
                .filter(a -> servicios.containsKey(a.getServicioId()))
                .filter(a -> activoEn(inquilinos.get(a.getInquilinoId()), p))
                .toList();

        List<Cobro> resultado = new ArrayList<>();

        for (Servicio servicio : snap.getServicios()) {
            if (servicioFiltro != null && !servicioFiltro.equals(servicio.getId())) {
                continue;
            }
            List<Asignacion> delServicio = asig.stream()
                    .filter(a -> a.getServicioId().equals(servicio.getId()))
                    .toList();
            if (delServicio.isEmpty()) {
                continue;
            }
            BigDecimal costo = facturas(snap.getPagos(), servicio.getId(), p.prefix);
            if (costo.signum() <= 0) {
                continue;
            }
            List<Cobro> filas = repartirServicio(servicio, delServicio, inquilinos, p, costo);
            resultado.addAll(filas);
        }

        return resultado;
    }

    /** Suma de las facturas (pagos sin inquilino) del servicio para el periodo. */
    private static BigDecimal facturas(List<Pago> pagos, String servicioId, String periodo) {
        return pagos.stream()
                .filter(pg -> pg.getInquilinoId() == null || pg.getInquilinoId().isBlank())
                .filter(pg -> servicioId.equals(pg.getServicioId()))
                .filter(pg -> periodo.equals(pg.getPeriodo()))
                .map(pg -> nz(pg.getMontoBs()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private List<Cobro> repartirServicio(Servicio servicio, List<Asignacion> asig,
                                         Map<String, Inquilino> inquilinos, Periodo p,
                                         BigDecimal costo) {

        boolean porPersonas = Servicio.METODO_PERSONAS.equalsIgnoreCase(servicio.getMetodoPago());

        List<Peso> pesos = new ArrayList<>();
        for (Asignacion a : asig) {
            Inquilino inq = inquilinos.get(a.getInquilinoId());
            int base = porPersonas ? inq.getPersonas() : inq.getHabitaciones();
            int unidades = base + a.totalExtras();
            if (unidades <= 0) {
                continue;
            }
            pesos.add(new Peso(a, unidades));
        }
        if (pesos.isEmpty()) {
            return List.of();
        }

        int pesoTotal = pesos.stream().mapToInt(Peso::unidades).sum();

        List<Cobro> filas = new ArrayList<>();
        for (Peso peso : pesos) {
            Asignacion a = peso.asignacion;
            Inquilino inq = inquilinos.get(a.getInquilinoId());

            BigDecimal base = costo.multiply(BigDecimal.valueOf(peso.unidades()))
                    .divide(BigDecimal.valueOf(pesoTotal), 2, RoundingMode.HALF_UP);

            BigDecimal extra = BigDecimal.ZERO;

            filas.add(new Cobro(
                    idCobro(p.prefix, inq.getId(), servicio.getId()),
                    p.prefix,
                    inq.getId(),
                    servicio.getId(),
                    BigDecimal.valueOf(peso.unidades()),
                    BigDecimal.valueOf(pesoTotal),
                    base,
                    extra,
                    base.add(extra).setScale(2, RoundingMode.HALF_UP),
                    inq.getHabitaciones(),
                    inq.getPersonas(),
                    a.getExtras() != null ? new HashMap<>(a.getExtras()) : new HashMap<>()));
        }

        BigDecimal sumaBase = filas.stream().map(Cobro::getMontoBase)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal diferencia = costo.subtract(sumaBase);
        if (diferencia.compareTo(BigDecimal.ZERO) != 0) {
            Peso mayor = pesos.get(0);
            for (Peso p2 : pesos) {
                if (p2.unidades() > mayor.unidades()) {
                    mayor = p2;
                }
            }
            for (Cobro c : filas) {
                if (c.getInquilinoId().equals(mayor.asignacion().getInquilinoId())
                        && c.getServicioId().equals(servicio.getId())) {
                    c.setMontoBase(c.getMontoBase().add(diferencia));
                    c.setMontoTotal(c.getMontoBase().add(c.getMontoExtra()).setScale(2, RoundingMode.HALF_UP));
                    break;
                }
            }
        }
        return filas;
    }

    /**
     * Genera y guarda los cobros del periodo, reemplazando los existentes.
     */
    public List<Cobro> generarPeriodo(String periodo) {
        parse(periodo);
        List<Cobro> filas = calcularPeriodo(periodo);
        store.replaceCobros(periodo, filas);
        return filas;
    }

    /**
     * Genera y guarda SOLO los cobros de un servicio del periodo,
     * conservando las lineas de los demas servicios de ese mes.
     */
    public List<Cobro> generarServicio(String periodo, String servicioId) {
        parse(periodo);
        if (servicioId == null || servicioId.isBlank()) {
            throw new IllegalArgumentException("El servicio es obligatorio");
        }
        List<Cobro> filas = calcularServicio(periodo, servicioId);
        List<Cobro> restantes = new ArrayList<>(store.listCobros().stream()
                .filter(c -> !(periodo.equals(c.getPeriodo()) && servicioId.equals(c.getServicioId())))
                .toList());
        restantes.addAll(filas);
        store.replaceCobros(periodo, restantes);
        return filas;
    }

    /**
     * Reajusta el factor de reparto (peso) de un servicio ya generado en el periodo.
     * Recalcula los montos repartiendo la factura con los nuevos pesos.
     * Bloqueado si algun inquilino del servicio ya tiene abonos ese mes.
     */
    public List<Cobro> editarServicio(String periodo, String servicioId, Map<String, Integer> pesos) {
        parse(periodo);
        if (servicioId == null || servicioId.isBlank()) {
            throw new IllegalArgumentException("El servicio es obligatorio");
        }
        if (pesos == null || pesos.isEmpty()) {
            throw new IllegalArgumentException("Indica al menos un peso");
        }
        Snapshot snap = store.snapshot();

        List<Cobro> lineas = store.listCobros().stream()
                .filter(c -> periodo.equals(c.getPeriodo()) && servicioId.equals(c.getServicioId()))
                .toList();
        if (lineas.isEmpty()) {
            throw new IllegalArgumentException("No hay cobros generados para " + servicioId + " en " + periodo);
        }

        List<Pago> abonos = snap.getPagos().stream()
                .filter(pg -> periodo.equals(pg.getPeriodo()))
                .filter(pg -> pg.getInquilinoId() != null && !pg.getInquilinoId().isBlank())
                .toList();
        for (Cobro c : lineas) {
            boolean pagado = abonos.stream().anyMatch(pg -> c.getInquilinoId().equals(pg.getInquilinoId()));
            if (pagado) {
                throw new IllegalStateException("El inquilino " + c.getInquilinoId() + " ya tiene pagos en "
                        + periodo + "; no se puede reajustar el reparto");
            }
        }

        Map<String, Integer> porId = new HashMap<>();
        for (Map.Entry<String, Integer> e : pesos.entrySet()) {
            int peso = e.getValue();
            if (peso < 1) {
                throw new IllegalArgumentException("El peso debe ser entero mayor que 0");
            }
            porId.put(e.getKey(), peso);
        }
        for (Cobro c : lineas) {
            if (!porId.containsKey(c.getInquilinoId())) {
                throw new IllegalArgumentException("El listado de pesos debe cubrir todas las lineas del servicio");
            }
        }

        BigDecimal costo = facturas(snap.getPagos(), servicioId, periodo);
        if (costo.signum() <= 0) {
            throw new IllegalArgumentException("No hay factura registrada para " + servicioId + " en " + periodo);
        }

        int pesoTotal = lineas.stream().mapToInt(c -> porId.get(c.getInquilinoId())).sum();

        List<Cobro> filas = new ArrayList<>();
        for (Cobro c : lineas) {
            int peso = porId.get(c.getInquilinoId());
            BigDecimal base = costo.multiply(BigDecimal.valueOf(peso))
                    .divide(BigDecimal.valueOf(pesoTotal), 2, RoundingMode.HALF_UP);
            filas.add(new Cobro(c.getId(), periodo, c.getInquilinoId(), servicioId,
                    BigDecimal.valueOf(peso), BigDecimal.valueOf(pesoTotal),
                    base, BigDecimal.ZERO, base,
                    c.getHabitaciones(), c.getPersonas(),
                    c.getExtras() != null ? new HashMap<>(c.getExtras()) : new HashMap<>()));
        }

        BigDecimal sumaBase = filas.stream().map(Cobro::getMontoBase)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal diferencia = costo.subtract(sumaBase);
        if (diferencia.compareTo(BigDecimal.ZERO) != 0) {
            Cobro mayor = lineas.get(0);
            for (Cobro c : lineas) {
                if (porId.get(c.getInquilinoId()) > porId.get(mayor.getInquilinoId())) {
                    mayor = c;
                }
            }
            for (Cobro c : filas) {
                if (c.getInquilinoId().equals(mayor.getInquilinoId())) {
                    c.setMontoBase(c.getMontoBase().add(diferencia));
                    c.setMontoTotal(c.getMontoBase());
                    break;
                }
            }
        }

        List<Cobro> restantes = new ArrayList<>(store.listCobros().stream()
                .filter(c -> !(periodo.equals(c.getPeriodo()) && servicioId.equals(c.getServicioId())))
                .toList());
        restantes.addAll(filas);
        store.replaceCobros(periodo, restantes);
        return filas;
    }

    /** True si el inquilino habitaba la casa durante el periodo (ingreso/salida se cruzan con el mes). */
    public static boolean activoEn(Inquilino inq, Periodo p) {
        if (inq == null || !inq.isHabilitado()) {
            return false;
        }
        LocalDate ingreso = parseDate(inq.getFechaIngreso());
        if (ingreso != null && ingreso.isAfter(p.fin)) {
            return false;
        }
        if (inq.getFechaSalida() != null && !inq.getFechaSalida().isBlank()) {
            LocalDate salida = parseDate(inq.getFechaSalida());
            if (salida != null && salida.isBefore(p.inicio)) {
                return false;
            }
        }
        return true;
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    static String idCobro(String periodo, String inquilinoId, String servicioId) {
        return periodo + "-" + inquilinoId + "-" + servicioId;
    }

    static Periodo parse(String periodo) {
        if (periodo == null) {
            throw new IllegalArgumentException("El periodo es obligatorio (YYYY-MM)");
        }
        try {
            YearMonth ym = YearMonth.parse(periodo.trim());
            return new Periodo(periodo.trim(), ym.atDay(1), ym.atEndOfMonth());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Periodo invalido '" + periodo + "', se esperaba YYYY-MM", e);
        }
    }

    static LocalDate parseDate(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(s.trim());
        } catch (Exception e) {
            return null;
        }
    }

    public record Periodo(String prefix, LocalDate inicio, LocalDate fin) {
    }

    private record Peso(Asignacion asignacion, int unidades) {
    }
}
