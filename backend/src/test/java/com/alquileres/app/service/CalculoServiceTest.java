package com.alquileres.app.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.alquileres.app.model.Asignacion;
import com.alquileres.app.model.Cobro;
import com.alquileres.app.model.Inquilino;
import com.alquileres.app.model.Pago;
import com.alquileres.app.model.Servicio;
import com.alquileres.app.model.ServicioInquilino;
import com.alquileres.app.model.Snapshot;
import com.alquileres.app.store.CasaStore;

class CalculoServiceTest {

    private InMemoryStore store;
    private CalculoService service;

    @BeforeEach
    void setUp() {
        store = new InMemoryStore();
        service = new CalculoService(store);
    }

    @Test
    void repartePorPersonas() {
        Inquilino ana = inq("inq-a", "Ana", true, 1, 1);
        Inquilino beto = inq("inq-b", "Beto", true, 2, 3);
        store.setInquilinos(List.of(ana, beto));

        Servicio agua = new Servicio("svc-agua", "Agua", "m3", Servicio.METODO_PERSONAS, List.of());
        store.setServicios(List.of(agua));
        store.setAsignaciones(List.of(
                asig("2026-08", "inq-a", "svc-agua", true),
                asig("2026-08", "inq-b", "svc-agua", true)));
        store.setPagos(List.of(factura("f-agua", "svc-agua", "2026-08", "120")));

        List<Cobro> cobros = service.calcularPeriodo("2026-08");

        assertThat(cobros).hasSize(2);
        assertThat(cobroDe(cobros, "inq-a").getMontoBase()).isEqualByComparingTo("30.00");
        assertThat(cobroDe(cobros, "inq-b").getMontoBase()).isEqualByComparingTo("90.00");
        assertThat(sumaMontos(cobros)).isEqualByComparingTo("120.00");
    }

    @Test
    void repartePorCuartosConExtrasDeConsumoPorInquilino() {
        Inquilino ana = inq("inq-a", "Ana", true, 1, 1);
        Inquilino beto = inq("inq-b", "Beto", true, 3, 4);
        store.setInquilinos(List.of(ana, beto));

        // Luz con 5 extras dinamicos
        Servicio luz = new Servicio("svc-luz", "Luz", "kWh", Servicio.METODO_CUARTOS,
                List.of("Refrigerador", "Ducha", "Luz pasillo", "Herramienta", "Plancha"));
        store.setServicios(List.of(luz));
        store.setPagos(List.of(factura("f-luz", "svc-luz", "2026-08", "200")));

        // Ana: 1 cuarto + (1 refri + 1 ducha + 1 luzPasillo + 1 plancha) = factor 5.
        // Beto: 3 cuartos + (2 refri + 3 herramientas) = factor 8. Total 13.
        Map<String, Integer> extrasAna = Map.of(
                "Refrigerador", 1, "Ducha", 1, "Luz pasillo", 1, "Plancha", 1);
        Map<String, Integer> extrasBeto = Map.of(
                "Refrigerador", 2, "Herramienta", 3);

        store.setAsignaciones(List.of(
                asig("2026-08", "inq-a", "svc-luz", true, extrasAna),
                asig("2026-08", "inq-b", "svc-luz", true, extrasBeto)));

        List<Cobro> cobros = service.calcularPeriodo("2026-08");

        Cobro deAna = cobroDe(cobros, "inq-a");
        Cobro deBeto = cobroDe(cobros, "inq-b");

        assertThat(deAna.getMontoBase()).isEqualByComparingTo("76.92");
        assertThat(deAna.getMontoExtra()).isEqualByComparingTo("0.00");
        assertThat(deAna.getMontoTotal()).isEqualByComparingTo("76.92");
        assertThat(deAna.getExtras()).containsEntry("Plancha", 1);

        assertThat(deBeto.getMontoBase()).isEqualByComparingTo("123.08");
        assertThat(deBeto.getMontoExtra()).isEqualByComparingTo("0.00");
        assertThat(deBeto.getMontoTotal()).isEqualByComparingTo("123.08");

        assertThat(sumaMontos(cobros)).isEqualByComparingTo("200.00");
        assertThat(deAna.getPeso()).isEqualByComparingTo("5");
        assertThat(deAna.getPesoTotal()).isEqualByComparingTo("13");
    }

    @Test
    void ignoraInquilinoDeshabilitadoYFueraDePeriodo() {
        Inquilino activo = inq("inq-a", "Ana", true, 1, 2);
        Inquilino borrado = inq("inq-d", "Dany", false, 1, 2);
        Inquilino salio = inq("inq-s", "Sapo", true, 1, 2);
        salio.setFechaIngreso("2026-01-01");
        salio.setFechaSalida("2026-05-31");
        store.setInquilinos(List.of(activo, borrado, salio));

        Servicio agua = new Servicio("svc-agua", "Agua", "m3", Servicio.METODO_PERSONAS, List.of());
        store.setServicios(List.of(agua));
        store.setAsignaciones(List.of(
                asig("2026-08", "inq-a", "svc-agua", true),
                asig("2026-08", "inq-d", "svc-agua", true),
                asig("2026-08", "inq-s", "svc-agua", true)));
        store.setPagos(List.of(factura("f-agua", "svc-agua", "2026-08", "120")));

        List<Cobro> cobros = service.calcularPeriodo("2026-08");
        assertThat(cobros).hasSize(1);
        assertThat(cobros.get(0).getInquilinoId()).isEqualTo("inq-a");
        assertThat(cobros.get(0).getMontoTotal()).isEqualByComparingTo("120.00");
    }

    @Test
    void redondeaParaQueLaSumaCoincidaConElCosto() {
        store.setInquilinos(List.of(
                inq("inq-a", "Ana", true, 1, 1),
                inq("inq-b", "Beto", true, 1, 1),
                inq("inq-c", "Carl", true, 1, 1)));
        Servicio luz = new Servicio("svc-luz", "Luz", "kWh", Servicio.METODO_CUARTOS, List.of());
        store.setServicios(List.of(luz));
        store.setAsignaciones(List.of(
                asig("2026-08", "inq-a", "svc-luz", true),
                asig("2026-08", "inq-b", "svc-luz", true),
                asig("2026-08", "inq-c", "svc-luz", true)));
        store.setPagos(List.of(factura("f-luz", "svc-luz", "2026-08", "100")));

        List<Cobro> cobros = service.calcularPeriodo("2026-08");
        assertThat(cobros).hasSize(3);
        assertThat(sumaMontos(cobros)).isEqualByComparingTo("100.00");
    }

    @Test
    void noGeneraCobrosSiNoHayFacturaRegistrada() {
        store.setInquilinos(List.of(inq("inq-a", "Ana", true, 1, 1)));
        Servicio luz = new Servicio("svc-luz", "Luz", "kWh", Servicio.METODO_CUARTOS, List.of());
        store.setServicios(List.of(luz));
        store.setAsignaciones(List.of(asig("2026-08", "inq-a", "svc-luz", true)));
        store.setPagos(List.of());

        List<Cobro> cobros = service.calcularPeriodo("2026-08");

        assertThat(cobros).isEmpty();
    }

    @Test
    void calcularServicioSoloDevuelveElServicioPedido() {
        store.setInquilinos(List.of(
                inq("inq-a", "Ana", true, 1, 1),
                inq("inq-b", "Beto", true, 3, 2)));
        store.setServicios(List.of(
                new Servicio("svc-luz", "Luz", "kWh", Servicio.METODO_CUARTOS, List.of()),
                new Servicio("svc-agua", "Agua", "m3", Servicio.METODO_PERSONAS, List.of())));
        store.setAsignaciones(List.of(
                asig("2026-08", "inq-a", "svc-luz", true),
                asig("2026-08", "inq-b", "svc-luz", true),
                asig("2026-08", "inq-b", "svc-agua", true)));
        store.setPagos(List.of(
                factura("f-l", "svc-luz", "2026-08", "100"),
                factura("f-ag", "svc-agua", "2026-08", "60")));

        List<Cobro> soloAgua = service.calcularServicio("2026-08", "svc-agua");

        assertThat(soloAgua).hasSize(1);
        assertThat(soloAgua.get(0).getServicioId()).isEqualTo("svc-agua");
    }

    @Test
    void generarServicioSoloReemplazaEseServicio() {
        store.setInquilinos(List.of(
                inq("inq-a", "Ana", true, 1, 1),
                inq("inq-b", "Beto", true, 3, 2)));
        store.setServicios(List.of(
                new Servicio("svc-luz", "Luz", "kWh", Servicio.METODO_CUARTOS, List.of()),
                new Servicio("svc-agua", "Agua", "m3", Servicio.METODO_PERSONAS, List.of())));
        store.setAsignaciones(List.of(
                asig("2026-08", "inq-a", "svc-luz", true),
                asig("2026-08", "inq-b", "svc-luz", true),
                asig("2026-08", "inq-b", "svc-agua", true)));
        store.setPagos(List.of(
                factura("f-l", "svc-luz", "2026-08", "100"),
                factura("f-ag", "svc-agua", "2026-08", "60")));

        service.generarPeriodo("2026-08");
        assertThat(store.listCobros()).hasSize(3);

        // Ana suma un refrigerador: pasa a factor 2 (1 cuarto + 1 refri).
        Map<String, Integer> extrasAna = Map.of("Refrigerador", 1);
        store.setAsignaciones(List.of(
                asig("2026-08", "inq-a", "svc-luz", true, extrasAna),
                asig("2026-08", "inq-b", "svc-luz", true),
                asig("2026-08", "inq-b", "svc-agua", true)));

        List<Cobro> filas = service.generarServicio("2026-08", "svc-luz");

        assertThat(filas).hasSize(2);
        assertThat(store.listCobros()).hasSize(3);
        Cobro deAna = cobroDe(store.listCobros(), "inq-a");
        assertThat(deAna.getMontoExtra()).isEqualByComparingTo("0.00");
        assertThat(deAna.getMontoTotal()).isEqualByComparingTo("40.00");
        Cobro deAgua = store.listCobros().stream()
                .filter(c -> c.getServicioId().equals("svc-agua"))
                .findFirst().orElseThrow();
        assertThat(deAgua.getMontoTotal()).isEqualByComparingTo("60.00");
    }

    @Test
    void reajustaPesosDeUnServicioGenerado() {
        store.setInquilinos(List.of(
                inq("inq-a", "Ana", true, 1, 1),
                inq("inq-b", "Beto", true, 3, 2)));
        store.setServicios(List.of(
                new Servicio("svc-luz", "Luz", "kWh", Servicio.METODO_CUARTOS, List.of()),
                new Servicio("svc-agua", "Agua", "m3", Servicio.METODO_PERSONAS, List.of())));
        store.setAsignaciones(List.of(
                asig("2026-08", "inq-a", "svc-luz", true),
                asig("2026-08", "inq-b", "svc-luz", true),
                asig("2026-08", "inq-b", "svc-agua", true)));
        store.setPagos(List.of(
                factura("f-l", "svc-luz", "2026-08", "100"),
                factura("f-ag", "svc-agua", "2026-08", "60")));

        service.generarPeriodo("2026-08");

        Map<String, Integer> pesos = new HashMap<>();
        pesos.put("inq-a", 1);
        pesos.put("inq-b", 1);
        List<Cobro> filas = service.editarServicio("2026-08", "svc-luz", pesos);

        assertThat(filas).hasSize(2);
        Cobro deAna = cobroDe(filas, "inq-a");
        assertThat(deAna.getPeso()).isEqualByComparingTo("1");
        assertThat(deAna.getMontoTotal()).isEqualByComparingTo("50.00");
        assertThat(store.listCobros()).hasSize(3);
        Cobro deAgua = store.listCobros().stream()
                .filter(c -> c.getServicioId().equals("svc-agua"))
                .findFirst().orElseThrow();
        assertThat(deAgua.getMontoTotal()).isEqualByComparingTo("60.00");
    }

    @Test
    void bloqueaReajusteSiHayAbonoEnElMes() {
        store.setInquilinos(List.of(
                inq("inq-a", "Ana", true, 1, 1),
                inq("inq-b", "Beto", true, 3, 2)));
        store.setServicios(List.of(new Servicio("svc-luz", "Luz", "kWh", Servicio.METODO_CUARTOS, List.of())));
        store.setAsignaciones(List.of(
                asig("2026-08", "inq-a", "svc-luz", true),
                asig("2026-08", "inq-b", "svc-luz", true)));
        store.setPagos(List.of(factura("f-l", "svc-luz", "2026-08", "100")));

        service.generarPeriodo("2026-08");

        Pago abono = new Pago("pg-1", "inq-a", "svc-luz", "2026-08", "2026-08-20", new BigDecimal("50"), "");
        store.upsertPago(abono);

        Map<String, Integer> pesos = new HashMap<>();
        pesos.put("inq-a", 2);
        pesos.put("inq-b", 1);

        assertThrows(IllegalStateException.class, () -> service.editarServicio("2026-08", "svc-luz", pesos));
        Cobro deAna = cobroDe(store.listCobros(), "inq-a");
        assertThat(deAna.getMontoTotal()).isEqualByComparingTo("25.00");
    }

    private static BigDecimal sumaMontos(List<Cobro> cobros) {
        return cobros.stream().map(Cobro::getMontoTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private Cobro cobroDe(List<Cobro> cobros, String inquilinoId) {
        return cobros.stream().filter(c -> inquilinoId.equals(c.getInquilinoId())).findFirst()
                .orElseThrow(() -> new AssertionError("No hay cobro para " + inquilinoId));
    }

    private static Inquilino inq(String id, String nombre, boolean habilitado, int cuartos, int personas) {
        Inquilino i = new Inquilino();
        i.setId(id);
        i.setNombre(nombre);
        i.setFechaIngreso("2024-01-01");
        i.setHabilitado(habilitado);
        i.setHabitaciones(cuartos);
        i.setPersonas(personas);
        return i;
    }

    private static ServicioInquilino si(String inquilinoId, String servicioId) {
        ServicioInquilino s = new ServicioInquilino();
        s.setId(inquilinoId + "-" + servicioId);
        s.setInquilinoId(inquilinoId);
        s.setServicioId(servicioId);
        s.setActivo(true);
        return s;
    }

    private static Asignacion asig(String periodo, String inquilinoId, String servicioId, boolean activo) {
        return asig(periodo, inquilinoId, servicioId, activo, Map.of());
    }

    private static Asignacion asig(String periodo, String inquilinoId, String servicioId, boolean activo,
                                   Map<String, Integer> extras) {
        Asignacion a = new Asignacion();
        a.setPeriodo(periodo);
        a.setInquilinoId(inquilinoId);
        a.setServicioId(servicioId);
        a.setActivo(activo);
        a.setId(periodo + "-" + inquilinoId + "-" + servicioId);
        a.setExtras(extras != null ? new HashMap<>(extras) : new HashMap<>());
        return a;
    }

    /** Factura = pago de servicio sin inquilino (inquilinoId null). */
    private static Pago factura(String id, String servicioId, String periodo, String monto) {
        return new Pago(id, null, servicioId, periodo, "2026-08-05", new BigDecimal(monto), "factura");
    }

    /** Store de memoria para pruebas. */
    private static final class InMemoryStore implements CasaStore {
        private List<Inquilino> inquilinos = new ArrayList<>();
        private List<Servicio> servicios = new ArrayList<>();
        private List<ServicioInquilino> sus = new ArrayList<>();
        private List<Asignacion> asig = new ArrayList<>();
        private List<Cobro> cobros = new ArrayList<>();
        private List<Pago> pagos = new ArrayList<>();

        void setInquilinos(List<Inquilino> v) { inquilinos = new ArrayList<>(v); }
        void setServicios(List<Servicio> v) { servicios = new ArrayList<>(v); }
        void setServiciosInquilinos(List<ServicioInquilino> v) { sus = new ArrayList<>(v); }
        void setAsignaciones(List<Asignacion> v) { asig = new ArrayList<>(v); }
        void setPagos(List<Pago> v) { pagos = new ArrayList<>(v); }

        @Override public String nombreCasa() { return "Casa"; }
        @Override public List<Inquilino> listInquilinos() { return inquilinos; }
        @Override public void upsertInquilino(Inquilino inquilino) { inquilinos.add(inquilino); }
        @Override public void deleteInquilino(String id) { inquilinos.removeIf(i -> i.getId().equals(id)); }
        @Override public List<Servicio> listServicios() { return servicios; }
        @Override public void upsertServicio(Servicio servicio) { servicios.add(servicio); }
        @Override public void deleteServicio(String id) { servicios.removeIf(s -> s.getId().equals(id)); }
        @Override public List<ServicioInquilino> listServiciosInquilinos() { return sus; }
        @Override public void upsertServicioInquilino(ServicioInquilino config) { sus.add(config); }
        @Override public void deleteServicioInquilino(String id) { sus.removeIf(s -> s.getId().equals(id)); }
        @Override public List<Asignacion> listAsignaciones() { return asig; }
        @Override public List<Asignacion> listAsignaciones(String periodo) {
            return asig.stream().filter(a -> periodo != null && periodo.equals(a.getPeriodo())).toList();
        }
        @Override public void upsertAsignacion(Asignacion a) { asig.add(a); }
        @Override public void deleteAsignacion(String id) { asig.removeIf(a -> a.getId().equals(id)); }
        @Override public List<Cobro> listCobros() { return cobros; }
        @Override public void replaceCobros(String periodo, List<Cobro> cobrosNuevos) {
            cobros.removeIf(c -> periodo.equals(c.getPeriodo()));
            cobros.addAll(cobrosNuevos);
        }
        @Override public List<Pago> listPagos() { return pagos; }
        @Override public void upsertPago(Pago pago) { pagos.add(pago); }
        @Override public void deletePago(String id) { pagos.removeIf(p -> p.getId().equals(id)); }
        @Override public Snapshot snapshot() {
            return new Snapshot(inquilinos, servicios, sus, cobros, pagos, asig, "now", 0, "test");
        }
        @Override public void reload() { }
        @Override public String fuente() { return "test"; }
    }
}
