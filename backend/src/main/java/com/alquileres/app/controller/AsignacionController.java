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

import com.alquileres.app.model.Asignacion;
import com.alquileres.app.store.CasaStore;

/**
 * Asignaciones POR PERIODO de servicios y extras a un inquilino.
 * Los extras son cantidades dinamicas que afectan el calculo de cobro
 * del servicio correspondiente.
 */
@RestController
@RequestMapping("/api/asignaciones")
public class AsignacionController {

    private final CasaStore store;

    public AsignacionController(CasaStore store) {
        this.store = store;
    }

    @GetMapping
    public List<Asignacion> listar(@RequestParam(required = false) String periodo) {
        if (periodo != null && !periodo.isBlank()) {
            return store.listAsignaciones(periodo);
        }
        return store.listAsignaciones();
    }

    @PostMapping
    public Asignacion crear(@RequestBody Asignacion body) {
        validar(body);
        store.upsertAsignacion(body);
        return body;
    }

    @PutMapping
    public Asignacion guardar(@RequestBody Asignacion body) {
        validar(body);
        store.upsertAsignacion(body);
        return body;
    }

    @DeleteMapping("/{id}")
    public void eliminar(@PathVariable String id) {
        store.deleteAsignacion(id);
    }

    private void validar(Asignacion a) {
        if (a.getPeriodo() == null || a.getPeriodo().isBlank()) {
            throw new IllegalArgumentException("El periodo es obligatorio (YYYY-MM)");
        }
        if (a.getInquilinoId() == null || a.getInquilinoId().isBlank()) {
            throw new IllegalArgumentException("El inquilino es obligatorio");
        }
        if (a.getServicioId() == null || a.getServicioId().isBlank()) {
            throw new IllegalArgumentException("El servicio es obligatorio");
        }
        if (a.getId() == null || a.getId().isBlank()) {
            a.setId(a.getPeriodo() + "-" + a.getInquilinoId() + "-" + a.getServicioId());
        }
        if (a.getExtras() != null) {
            a.getExtras().replaceAll((k, v) -> v == null || v < 0 ? 0 : v);
        }
    }
}
