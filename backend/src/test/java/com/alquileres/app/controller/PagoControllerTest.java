package com.alquileres.app.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.alquileres.app.model.Asignacion;
import com.alquileres.app.model.Cobro;
import com.alquileres.app.model.Inquilino;
import com.alquileres.app.model.Pago;
import com.alquileres.app.model.Servicio;
import com.alquileres.app.model.ServicioInquilino;
import com.alquileres.app.model.Snapshot;
import com.alquileres.app.service.CalculoService;
import com.alquileres.app.store.CasaStore;

class PagoControllerTest {

    private StoreStub store;
    private PagoController controller;

    @BeforeEach
    void setUp() {
        store = new StoreStub();
        controller = new PagoController(store, new CalculoService(store));
    }

    @Test
    void registraConIdNuevo() {
        Pago p = factura(null);

        Pago guardado = controller.registrar(p);

        assertThat(guardado.getId()).startsWith("pg-");
        assertThat(store.pagos).hasSize(1);
    }

    @Test
    void editaConservandoElId() {
        store.upsertPago(factura("pg-1"));

        Pago p = factura("pg-1");
        p.setMontoBs(BigDecimal.valueOf(150));

        Pago guardado = controller.registrar(p);

        assertThat(guardado.getId()).isEqualTo("pg-1");
        assertThat(store.pagos).hasSize(1);
        assertThat(store.pagos.get(0).getMontoBs()).isEqualByComparingTo(BigDecimal.valueOf(150));
    }

    @Test
    void facturaSinInquilinoExigeServicio() {
        Pago p = factura(null);
        p.setServicioId(null);

        assertThatThrownBy(() -> controller.registrar(p))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("servicio");
    }

    @Test
    void rechazaMontoNegativo() {
        Pago p = factura(null);
        p.setMontoBs(BigDecimal.valueOf(-1));

        assertThatThrownBy(() -> controller.registrar(p))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("monto");
    }

    @Test
    void rechazaFacturaDuplicada() {
        store.upsertPago(factura("pg-1"));

        Pago duplicada = factura(null);

        assertThatThrownBy(() -> controller.registrar(duplicada))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("factura");
    }

    @Test
    void permiteEditarFacturaExistente() {
        store.upsertPago(factura("pg-1"));

        Pago edicion = factura("pg-1");
        edicion.setMontoBs(BigDecimal.valueOf(200));

        Pago guardado = controller.registrar(edicion);

        assertThat(guardado.getMontoBs()).isEqualByComparingTo(BigDecimal.valueOf(200));
        assertThat(store.pagos).hasSize(1);
    }

    @Test
    void rechazaEditarFacturaHaciaServicioMesConFactura() {
        store.upsertPago(factura("pg-1"));
        Pago otra = factura("pg-2");
        otra.setPeriodo("2026-05");
        store.upsertPago(otra);

        Pago edicion = factura("pg-2");

        assertThatThrownBy(() -> controller.registrar(edicion))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Ya existe una factura");
    }

    @Test
    void periodoVacioSeCompletaAntesDeValidarDuplicados() {
        Pago p = factura(null);
        p.setPeriodo(null);

        Pago guardado = controller.registrar(p);

        assertThat(guardado.getPeriodo()).matches("\\d{4}-\\d{2}");
    }

    @Test
    void rechazaPagoDeInquilinoInexistente() {
        Pago p = factura(null);
        p.setInquilinoId("inq-x");

        assertThatThrownBy(() -> controller.registrar(p))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("inquilino");
    }

    private static Pago factura(String id) {
        Pago p = new Pago();
        p.setId(id);
        p.setInquilinoId(null);
        p.setServicioId("svc-1");
        p.setPeriodo("2026-04");
        p.setFechaPago("2026-04-10");
        p.setMontoBs(BigDecimal.valueOf(100));
        return p;
    }

    private static final class StoreStub implements CasaStore {
        final List<Pago> pagos = new ArrayList<>();

        @Override public String nombreCasa() { return "Casa"; }
        @Override public List<Inquilino> listInquilinos() { return List.of(); }
        @Override public void upsertInquilino(Inquilino v) { }
        @Override public void deleteInquilino(String id) { }
        @Override public List<Servicio> listServicios() { return List.of(new Servicio("svc-1", "Luz", "kWh", Servicio.METODO_CUARTOS, List.of())); }
        @Override public void upsertServicio(Servicio v) { }
        @Override public void deleteServicio(String id) { }
        @Override public List<ServicioInquilino> listServiciosInquilinos() { return List.of(); }
        @Override public void upsertServicioInquilino(ServicioInquilino v) { }
        @Override public void deleteServicioInquilino(String id) { }
        @Override public List<Asignacion> listAsignaciones() { return List.of(); }
        @Override public List<Asignacion> listAsignaciones(String p) { return List.of(); }
        @Override public void upsertAsignacion(Asignacion v) { }
        @Override public void deleteAsignacion(String id) { }
        @Override public List<Cobro> listCobros() { return List.of(); }
        @Override public void replaceCobros(String p, List<Cobro> x) { }
        @Override public List<Pago> listPagos() { return pagos; }
        @Override public void upsertPago(Pago v) {
            pagos.removeIf(p -> v.getId() != null && v.getId().equals(p.getId()));
            pagos.add(v);
        }
        @Override public void deletePago(String id) { pagos.removeIf(p -> p.getId().equals(id)); }
        @Override public Snapshot snapshot() { return new Snapshot(List.of(), List.of(), List.of(), List.of(), pagos, List.of(), "now", 0, "test"); }
        @Override public void reload() { }
        @Override public String fuente() { return "test"; }
    }
}