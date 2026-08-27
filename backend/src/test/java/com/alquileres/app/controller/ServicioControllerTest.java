package com.alquileres.app.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
import com.alquileres.app.store.CasaStore;

class ServicioControllerTest {

    private StoreStub store;
    private ServicioController controller;

    @BeforeEach
    void setUp() {
        store = new StoreStub();
        controller = new ServicioController(store);
    }

    @Test
    void rechazaDuplicadoPorNombre() {
        store.servicios.add(svc("svc-1", "Luz"));
        Servicio s = svc("", "luz"); // mismo nombre, distinta capitalizacion

        assertThatThrownBy(() -> controller.crear(s))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("luz");
    }

    @Test
    void permiteActualizarConElMismoNombre() {
        store.servicios.add(svc("svc-1", "Luz"));

        Servicio s = svc("", "Luz");
        s.setId("svc-1");

        Servicio guardado = controller.actualizar("svc-1", s);
        assertThat(guardado.getId()).isEqualTo("svc-1");
        assertThat(guardado.getNombre()).isEqualTo("Luz");
        assertThat(store.servicios).hasSize(1);
    }

    @Test
    void rechazaNombreRepetidoEnOtroServicioAlActualizar() {
        store.servicios.add(svc("svc-1", "Luz"));
        store.servicios.add(svc("svc-2", "Agua"));

        Servicio s = svc("", "agua");
        s.setId("svc-1");

        assertThatThrownBy(() -> controller.actualizar("svc-1", s))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("agua");
    }

    private static Servicio svc(String id, String nombre) {
        Servicio s = new Servicio();
        s.setId(id);
        s.setNombre(nombre);
        s.setMetodoPago(Servicio.METODO_CUARTOS);
        return s;
    }

    /** Stub minimo de CasaStore para el controller. */
    private static final class StoreStub implements CasaStore {
        final List<Servicio> servicios = new ArrayList<>();

        @Override public String nombreCasa() { return "Casa"; }
        @Override public List<Inquilino> listInquilinos() { return List.of(); }
        @Override public void upsertInquilino(Inquilino v) { }
        @Override public void deleteInquilino(String id) { }
        @Override public List<Servicio> listServicios() { return servicios; }
        @Override public void upsertServicio(Servicio v) {
            servicios.removeIf(s -> v.getId() != null && v.getId().equals(s.getId()));
            servicios.add(v);
        }
        @Override public void deleteServicio(String id) { servicios.removeIf(s -> s.getId().equals(id)); }
        @Override public List<ServicioInquilino> listServiciosInquilinos() { return List.of(); }
        @Override public void upsertServicioInquilino(ServicioInquilino v) { }
        @Override public void deleteServicioInquilino(String id) { }
        @Override public List<Asignacion> listAsignaciones() { return List.of(); }
        @Override public List<Asignacion> listAsignaciones(String p) { return List.of(); }
        @Override public void upsertAsignacion(Asignacion v) { }
        @Override public void deleteAsignacion(String id) { }
        @Override public List<Cobro> listCobros() { return List.of(); }
        @Override public void replaceCobros(String p, List<Cobro> x) { }
        @Override public List<Pago> listPagos() { return List.of(); }
        @Override public void upsertPago(Pago v) { }
        @Override public void deletePago(String id) { }
        @Override public Snapshot snapshot() { return new Snapshot(List.of(), servicios, List.of(), List.of(), List.of(), List.of(), "now", 0, "test"); }
        @Override public void reload() { }
        @Override public String fuente() { return "test"; }
    }
}