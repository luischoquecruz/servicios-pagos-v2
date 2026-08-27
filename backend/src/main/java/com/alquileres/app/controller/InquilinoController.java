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
            body.setFechaIngreso(java.time.LocalDate.now().toString());
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

    @DeleteMapping("/{id}")
    public void eliminar(@PathVariable String id) {
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
    }
}