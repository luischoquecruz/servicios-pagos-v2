package com.alquileres.app.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
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
 * Motor de cobros (misma logica que scripts/Code.gs).
 * Mes a mes, para cada servicio se reparte la factura del mes (pagos sin
 * inquilino de ese servicio y periodo) entre los inquilinos asignados, segun
 * el metodo del servicio: habitaciones (CUARTOS) o personas (PERSONAS).
 * Cada extra suma +1 al factor de reparto. Ej.: 1 cuarto + 2 extras => factor 3.
 * Ademas se genera el alquiler mensual de los inquilinos que lo tienen habilitado.
 *
 * Las operaciones que escriben se sincronizan sobre esta instancia; PagoController
 * usa el mismo monitor para que validar y escribir sea atomico.
 */
@Service
public class CalculoService {

    private final CasaStore store;

    public CalculoService(CasaStore store) {
        this.store = store;
    }

    /** Calcula (sin guardar) las lineas de cobro de un periodo YYYY-MM (servicios + alquiler). */
    public List<Cobro> calcularPeriodo(String periodo) {
        return calcularPara(periodo, null);
    }

    /** Calcula (sin guardar) las lineas de cobro de UN servicio en el periodo. */
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
                .filter(Asignacion::isActivo)
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
            resultado.addAll(repartirServicio(servicio, delServicio, inquilinos, p, costo));
        }
        // El alquiler solo se integra al regenerar TODO el periodo.
        if (servicioFiltro == null) {
            resultado.addAll(cobrosAlquiler(snap.getInquilinos(), p));
        }
        return resultado;
    }

    /** Alquiler mensual completo (sin prorrateo) para inquilinos activos con alquiler habilitado. */
    private List<Cobro> cobrosAlquiler(List<Inquilino> inquilinos, Periodo p) {
        List<Cobro> filas = new ArrayList<>();
        for (Inquilino inq : inquilinos) {
            if (!inq.isCobraAlquiler() || !activoEn(inq, p)) {
                continue;
            }
            BigDecimal mensual = nz(inq.getAlquilerBs()).setScale(2, RoundingMode.HALF_UP);
            if (mensual.signum() <= 0) {
                continue;
            }
            int hab = inq.getHabitaciones() > 0 ? inq.getHabitaciones() : 1;
            filas.add(new Cobro(idCobro(p.prefix, inq.getId(), Pagos.ALQUILER_ID), p.prefix, inq.getId(),
                    Pagos.ALQUILER_ID, BigDecimal.valueOf(hab), BigDecimal.valueOf(hab),
                    mensual, BigDecimal.ZERO, mensual, inq.getHabitaciones(), inq.getPersonas(), new HashMap<>()));
        }
        return filas;
    }

    /** Suma de las facturas (pagos sin inquilino) del servicio para el periodo. */
    static BigDecimal facturas(List<Pago> pagos, String servicioId, String periodo) {
        return pagos.stream()
                .filter(Pagos::esFactura)
                .filter(pg -> servicioId.equals(pg.getServicioId()))
                .filter(pg -> periodo.equals(pg.getPeriodo()))
                .map(pg -> nz(pg.getMontoBs()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private List<Cobro> repartirServicio(Servicio servicio, List<Asignacion> asig,
                                         Map<String, Inquilino> inquilinos, Periodo p, BigDecimal costo) {
        boolean porPersonas = Servicio.METODO_PERSONAS.equalsIgnoreCase(servicio.getMetodoPago());
        List<Cobro> plantilla = new ArrayList<>();
        Map<String, Integer> pesos = new LinkedHashMap<>();
        for (Asignacion a : asig) {
            Inquilino inq = inquilinos.get(a.getInquilinoId());
            int base = porPersonas ? inq.getPersonas() : inq.getHabitaciones();
            int unidades = base + a.totalExtras();
            if (unidades <= 0) {
                continue;
            }
            pesos.put(inq.getId(), unidades);
            plantilla.add(new Cobro(idCobro(p.prefix, inq.getId(), servicio.getId()), p.prefix, inq.getId(),
                    servicio.getId(), null, null, null, null, null,
                    inq.getHabitaciones(), inq.getPersonas(),
                    a.getExtras() != null ? new HashMap<>(a.getExtras()) : new HashMap<>()));
        }
        if (plantilla.isEmpty()) {
            return List.of();
        }
        return repartirConPesos(plantilla, pesos, costo);
    }

    /**
     * Reparte el costo entre las lineas segun los pesos (inquilinoId -> peso).
     * La diferencia por redondeo se asigna a la linea de mayor peso, asi la suma
     * coincide exactamente con la factura.
     */
    static List<Cobro> repartirConPesos(List<Cobro> lineas, Map<String, Integer> pesos, BigDecimal costo) {
        int pesoTotal = lineas.stream().mapToInt(c -> pesos.get(c.getInquilinoId())).sum();
        List<Cobro> filas = new ArrayList<>();
        Cobro mayor = null;
        for (Cobro c : lineas) {
            int peso = pesos.get(c.getInquilinoId());
            BigDecimal base = costo.multiply(BigDecimal.valueOf(peso))
                    .divide(BigDecimal.valueOf(pesoTotal), 2, RoundingMode.HALF_UP);
            Cobro f = new Cobro(c.getId(), c.getPeriodo(), c.getInquilinoId(), c.getServicioId(),
                    BigDecimal.valueOf(peso), BigDecimal.valueOf(pesoTotal), base, BigDecimal.ZERO, base,
                    c.getHabitaciones(), c.getPersonas(),
                    c.getExtras() != null ? new HashMap<>(c.getExtras()) : new HashMap<>());
            filas.add(f);
            if (mayor == null || peso > mayor.getPeso().intValue()) {
                mayor = f;
            }
        }
        BigDecimal suma = filas.stream().map(Cobro::getMontoBase).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal diferencia = costo.setScale(2, RoundingMode.HALF_UP).subtract(suma);
        if (mayor != null && diferencia.signum() != 0) {
            mayor.setMontoBase(mayor.getMontoBase().add(diferencia));
            mayor.setMontoTotal(mayor.getMontoBase());
        }
        return filas;
    }

    /** Genera y guarda los cobros del periodo, reemplazando los existentes de ese mes. */
    public synchronized List<Cobro> generarPeriodo(String periodo) {
        Periodo p = parse(periodo);
        List<Cobro> filas = calcularPeriodo(p.prefix);
        store.replaceCobros(p.prefix, filas);
        return filas;
    }

    /** Genera y guarda SOLO los cobros de un servicio del periodo (conserva los demas del mes). */
    public synchronized List<Cobro> generarServicio(String periodo, String servicioId) {
        Periodo p = parse(periodo);
        if (servicioId == null || servicioId.isBlank()) {
            throw new IllegalArgumentException("El servicio es obligatorio");
        }
        List<Cobro> filas = calcularServicio(p.prefix, servicioId);
        reemplazarServicio(p.prefix, servicioId, filas);
        return filas;
    }

    /** Reemplaza solo las lineas de un servicio dentro del periodo (el resto del mes queda intacto). */
    private void reemplazarServicio(String periodo, String servicioId, List<Cobro> nuevas) {
        store.replaceCobrosServicio(periodo, servicioId, nuevas);
    }

    /**
     * Reajusta el factor de reparto (peso) de un servicio ya generado en el periodo.
     * Bloqueado solo si algun inquilino ya pago ESTE servicio en ese mes.
     */
    public synchronized List<Cobro> editarServicio(String periodo, String servicioId, Map<String, Integer> pesos) {
        Periodo p = parse(periodo);
        if (servicioId == null || servicioId.isBlank()) {
            throw new IllegalArgumentException("El servicio es obligatorio");
        }
        if (Pagos.ALQUILER_ID.equals(servicioId)) {
            throw new IllegalArgumentException("El alquiler no se reparte por pesos");
        }
        if (pesos == null || pesos.isEmpty()) {
            throw new IllegalArgumentException("Indica al menos un peso");
        }
        Snapshot snap = store.snapshot();
        List<Cobro> lineas = snap.getCobros().stream()
                .filter(c -> p.prefix.equals(c.getPeriodo()) && servicioId.equals(c.getServicioId()))
                .toList();
        if (lineas.isEmpty()) {
            throw new IllegalArgumentException("No hay cobros generados para " + servicioId + " en " + p.prefix);
        }
        for (Cobro c : lineas) {
            boolean pagado = snap.getPagos().stream().anyMatch(pg -> Pagos.esAbono(pg)
                    && p.prefix.equals(pg.getPeriodo())
                    && c.getInquilinoId().equals(pg.getInquilinoId())
                    && servicioId.equals(pg.getServicioId()));
            if (pagado) {
                throw new IllegalStateException("El inquilino " + c.getInquilinoId() + " ya pago este servicio en "
                        + p.prefix + "; no se puede reajustar el reparto");
            }
        }
        for (Map.Entry<String, Integer> e : pesos.entrySet()) {
            if (e.getValue() == null || e.getValue() < 1) {
                throw new IllegalArgumentException("El peso debe ser entero mayor que 0");
            }
        }
        for (Cobro c : lineas) {
            if (!pesos.containsKey(c.getInquilinoId())) {
                throw new IllegalArgumentException("El listado de pesos debe cubrir todas las lineas del servicio");
            }
        }
        BigDecimal costo = facturas(snap.getPagos(), servicioId, p.prefix);
        if (costo.signum() <= 0) {
            throw new IllegalArgumentException("No hay factura registrada para " + servicioId + " en " + p.prefix);
        }
        List<Cobro> filas = repartirConPesos(lineas, pesos, costo);
        reemplazarServicio(p.prefix, servicioId, filas);
        return filas;
    }

    /**
     * Mantiene los cobros de un servicio/mes alineados con sus facturas:
     * si cambia el importe se reparte el nuevo costo con los MISMOS pesos;
     * si ya no hay factura, se quitan las lineas de ese servicio/mes.
     */
    public synchronized void sincronizarFactura(String servicioId, String periodo) {
        if (servicioId == null || periodo == null || Pagos.ALQUILER_ID.equals(servicioId)) {
            return;
        }
        List<Cobro> lineas = store.listCobros().stream()
                .filter(c -> periodo.equals(c.getPeriodo()) && servicioId.equals(c.getServicioId()))
                .toList();
        if (lineas.isEmpty()) {
            return;
        }
        BigDecimal costo = facturas(store.listPagos(), servicioId, periodo);
        if (costo.signum() <= 0) {
            reemplazarServicio(periodo, servicioId, List.of());
            return;
        }
        Map<String, Integer> pesos = new HashMap<>();
        for (Cobro c : lineas) {
            int peso = c.getPeso() == null ? 1 : Math.max(1, c.getPeso().intValue());
            pesos.put(c.getInquilinoId(), peso);
        }
        reemplazarServicio(periodo, servicioId, repartirConPesos(lineas, pesos, costo));
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
        LocalDate salida = parseDate(inq.getFechaSalida());
        return salida == null || !salida.isBefore(p.inicio);
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    static String idCobro(String periodo, String inquilinoId, String servicioId) {
        return periodo + "-" + inquilinoId + "-" + servicioId;
    }

    public static Periodo parse(String periodo) {
        if (periodo == null || periodo.isBlank()) {
            throw new IllegalArgumentException("El periodo es obligatorio (YYYY-MM)");
        }
        try {
            YearMonth ym = YearMonth.parse(periodo.trim());
            return new Periodo(ym.toString(), ym.atDay(1), ym.atEndOfMonth());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Periodo invalido '" + periodo + "', se esperaba YYYY-MM", e);
        }
    }

    static LocalDate parseDate(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(s.trim().length() > 10 ? s.trim().substring(0, 10) : s.trim());
        } catch (Exception e) {
            return null;
        }
    }

    public record Periodo(String prefix, LocalDate inicio, LocalDate fin) {
    }
}
