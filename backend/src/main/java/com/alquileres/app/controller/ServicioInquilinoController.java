package com.alquileres.app.controller;

import java.util.List;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.alquileres.app.model.ServicioInquilino;
import com.alquileres.app.store.CasaStore;

/**
 * Configuracion por inquilino y servicio: que servicios se le cobran al
 * inquilino y sus extras por consumo.
 */
@RestController
@RequestMapping("/api")
public class ServicioInquilinoController {

    private final CasaStore store;

    public ServicioInquilinoController(CasaStore store) {
        this.store = store;
    }

    @GetMapping("/servicios-inquilinos")
    public List<ServicioInquilino> listarTodos() {
        return store.listServiciosInquilinos();
    }

    @GetMapping("/inquilinos/{id}/servicios")
    public List<ServicioInquilino> deUnInquilino(@PathVariable String id) {
        return store.listServiciosInquilinos().stream()
                .filter(si -> id.equals(si.getInquilinoId()))
                .toList();
    }

    /** Crea o actualiza la configuracion de un inquilino para un servicio. */
    @PutMapping("/servicios-inquilinos")
    public ServicioInquilino guardar(@RequestBody ServicioInquilino body) {
        if (body.getInquilinoId() == null || body.getInquilinoId().isBlank()) {
            throw new IllegalArgumentException("El inquilino es obligatorio");
        }
        if (body.getServicioId() == null || body.getServicioId().isBlank()) {
            throw new IllegalArgumentException("El servicio es obligatorio");
        }
        body.setId(com.alquileres.app.service.Ids.compuesto(body.getInquilinoId(), body.getServicioId()));
        if (body.getExtras() != null) {
            body.getExtras().replaceAll((k, v) -> v == null || v < 0 ? 0 : v);
        }
        store.upsertServicioInquilino(body);
        return body;
    }

    @DeleteMapping("/servicios-inquilinos/{id}")
    public void eliminar(@PathVariable String id) {
        store.deleteServicioInquilino(id);
    }
}