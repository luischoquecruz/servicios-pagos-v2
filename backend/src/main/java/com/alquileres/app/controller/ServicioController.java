package com.alquileres.app.controller;

import java.util.List;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.alquileres.app.model.Servicio;
import com.alquileres.app.service.Ids;
import com.alquileres.app.store.CasaStore;

@RestController
@RequestMapping("/api/servicios")
public class ServicioController {

    private final CasaStore store;

    public ServicioController(CasaStore store) {
        this.store = store;
    }

    @GetMapping
    public List<Servicio> listar() {
        return store.listServicios();
    }

    @PostMapping
    public Servicio crear(@RequestBody Servicio body) {
        validar(body, null);
        body.setId(Ids.nuevo("svc"));
        store.upsertServicio(body);
        return body;
    }

    @PutMapping("/{id}")
    public Servicio actualizar(@PathVariable String id, @RequestBody Servicio body) {
        validar(body, id);
        body.setId(id);
        store.upsertServicio(body);
        return body;
    }

    @DeleteMapping("/{id}")
    public void eliminar(@PathVariable String id) {
        store.deleteServicio(id);
    }

    private void validar(Servicio s, String idExcluido) {
        if (s.getNombre() == null || s.getNombre().isBlank()) {
            throw new IllegalArgumentException("El nombre del servicio es obligatorio");
        }
        String nombre = s.getNombre().trim();
        boolean duplicado = store.listServicios().stream()
                .filter(x -> idExcluido == null || !idExcluido.equals(x.getId()))
                .anyMatch(x -> nombre.equalsIgnoreCase(x.getNombre() == null ? null : x.getNombre().trim()));
        if (duplicado) {
            throw new IllegalArgumentException("Ya existe un servicio llamado \"" + nombre + "\"");
        }
        s.setNombre(nombre);
        if (s.getMetodoPago() == null || s.getMetodoPago().isBlank()) {
            s.setMetodoPago(Servicio.METODO_CUARTOS);
        }
        if (!Servicio.METODO_CUARTOS.equalsIgnoreCase(s.getMetodoPago())
                && !Servicio.METODO_PERSONAS.equalsIgnoreCase(s.getMetodoPago())) {
            throw new IllegalArgumentException("El metodo de pago debe ser CUARTOS o PERSONAS");
        }
        s.setMetodoPago(s.getMetodoPago().toUpperCase());
    }
}