package com.alquileres.app.controller;

import java.util.List;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.alquileres.app.model.Inquilino;
import com.alquileres.app.service.Fechas;
import com.alquileres.app.service.Ids;
import com.alquileres.app.store.CasaStore;

@RestController
@RequestMapping("/api/inquilinos")
public class InquilinoController {

    private final CasaStore store;

    public InquilinoController(CasaStore store) {
        this.store = store;
    }

    @GetMapping
    public List<Inquilino> listar() {
        return store.listInquilinos();
    }

    @PostMapping
    public Inquilino crear(@RequestBody Inquilino body) {
        validar(body);
        body.setId(Ids.nuevo("inq"));
        if (body.getFechaIngreso() == null || body.getFechaIngreso().isBlank()) {
            body.setFechaIngreso(Fechas.hoy().toString());
        }
        store.upsertInquilino(body);
        return body;
    }

    @PutMapping("/{id}")
    public Inquilino actualizar(@PathVariable String id, @RequestBody Inquilino body) {
        validar(body);
        body.setId(id);
        store.upsertInquilino(body);
        return body;
    }

    /**
     * Elimina SOLO si el inquilino no tiene historial (cobros ni pagos);
     * con historial debe deshabilitarse. Sus asignaciones y servicios se borran.
     */
    @DeleteMapping("/{id}")
    public void eliminar(@PathVariable String id) {
        long cobros = store.listCobros().stream().filter(c -> id.equals(c.getInquilinoId())).count();
        long pagos = store.listPagos().stream().filter(p -> id.equals(p.getInquilinoId())).count();
        if (cobros > 0 || pagos > 0) {
            throw new IllegalStateException("No se puede eliminar: el inquilino tiene " + cobros + " cobro(s) y "
                    + pagos + " pago(s). Deshabilitalo en su lugar para conservar el historial.");
        }
        store.listAsignaciones().stream().filter(a -> id.equals(a.getInquilinoId()))
                .forEach(a -> store.deleteAsignacion(a.getId()));
        store.listServiciosInquilinos().stream().filter(s -> id.equals(s.getInquilinoId()))
                .forEach(s -> store.deleteServicioInquilino(s.getId()));
        store.deleteInquilino(id);
    }

    /** Habilita o deshabilita al inquilino. */
    @PostMapping("/{id}/estado")
    public Inquilino estado(@PathVariable String id, @RequestParam boolean habilitado) {
        Inquilino inq = store.listInquilinos().stream()
                .filter(i -> id.equals(i.getId()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Inquilino no encontrado: " + id));
        inq.setHabilitado(habilitado);
        store.upsertInquilino(inq);
        return inq;
    }

    private void validar(Inquilino i) {
        if (i.getNombre() == null || i.getNombre().isBlank()) {
            throw new IllegalArgumentException("El nombre del inquilino es obligatorio");
        }
        if (i.getHabitaciones() < 0) {
            i.setHabitaciones(0);
        }
        if (i.getPersonas() < 0) {
            i.setPersonas(0);
        }
        i.setNombre(i.getNombre().trim());
        if (i.getAlquilerBs() == null || i.getAlquilerBs().signum() < 0) {
            i.setAlquilerBs(java.math.BigDecimal.ZERO);
        }
        i.setAlquilerBs(i.getAlquilerBs().setScale(2, java.math.RoundingMode.HALF_UP));
        java.time.LocalDate ingreso = fecha(i.getFechaIngreso(), "ingreso");
        java.time.LocalDate salida = fecha(i.getFechaSalida(), "salida");
        if (ingreso != null && salida != null && salida.isBefore(ingreso)) {
            throw new IllegalArgumentException("La fecha de salida no puede ser anterior a la de ingreso");
        }
        if (i.getFechaSalida() != null && i.getFechaSalida().isBlank()) {
            i.setFechaSalida(null);
        }
    }

    private static java.time.LocalDate fecha(String s, String nombre) {
        if (s == null || s.isBlank()) {
            return null;
        }
        try {
            return java.time.LocalDate.parse(s.trim());
        } catch (java.time.format.DateTimeParseException e) {
            throw new IllegalArgumentException("La fecha de " + nombre + " es invalida (yyyy-MM-dd)");
        }
    }
}