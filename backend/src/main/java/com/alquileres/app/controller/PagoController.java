package com.alquileres.app.controller;

import java.util.Comparator;
import java.util.List;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.alquileres.app.model.Pago;
import com.alquileres.app.service.Ids;
import com.alquileres.app.store.CasaStore;

@RestController
@RequestMapping("/api/pagos")
public class PagoController {

    private final CasaStore store;

    public PagoController(CasaStore store) {
        this.store = store;
    }

    @GetMapping
    public List<Pago> listar(@RequestParam(required = false) String inquilinoId,
                             @RequestParam(required = false) String periodo) {
        List<Pago> pagos = store.listPagos();
        if (inquilinoId != null && !inquilinoId.isBlank()) {
            pagos = pagos.stream().filter(p -> inquilinoId.equals(p.getInquilinoId())).toList();
        }
        if (periodo != null && !periodo.isBlank()) {
            pagos = pagos.stream().filter(p -> periodo.equals(p.getPeriodo())).toList();
        }
        return pagos.stream()
                .sorted(Comparator.comparing(Pago::getFechaPago, Comparator.nullsLast(String::compareTo)).reversed())
                .toList();
    }

    /** Registra el pago almacenando fecha y monto. Factura = pago sin inquilino. */
    @PostMapping
    public Pago registrar(@RequestBody Pago body) {
        if (body.getMontoBs() == null || body.getMontoBs().signum() < 0) {
            throw new IllegalArgumentException("El monto es invalido");
        }
        if (body.getInquilinoId() != null && body.getInquilinoId().isBlank()) {
            body.setInquilinoId(null);
        }
        if (body.getInquilinoId() == null && (body.getServicioId() == null || body.getServicioId().isBlank())) {
            throw new IllegalArgumentException("La factura debe indicar el servicio");
        }
        // Si ya trae id es una edicion (reemplaza la fila); si no, es un pago nuevo.
        if (body.getId() == null || body.getId().isBlank()) {
            // Validar que no exista ya una factura para el mismo servicio y periodo
            if (body.getInquilinoId() == null) {
                boolean duplicada = store.listPagos().stream().anyMatch(p ->
                    p.getInquilinoId() == null
                    && body.getServicioId().equals(p.getServicioId())
                    && body.getPeriodo().equals(p.getPeriodo()));
                if (duplicada) {
                    throw new IllegalArgumentException("Ya existe una factura para este servicio en el periodo " + body.getPeriodo());
                }
            }
            body.setId(Ids.nuevo("pg"));
        }
        if (body.getFechaPago() == null || body.getFechaPago().isBlank()) {
            body.setFechaPago(java.time.LocalDate.now().toString());
        }
        if (body.getPeriodo() == null || body.getPeriodo().isBlank()) {
            body.setPeriodo(java.time.YearMonth.now().toString());
        }
        store.upsertPago(body);
        return body;
    }

    @DeleteMapping("/{id}")
    public void eliminar(@PathVariable String id) {
        store.deletePago(id);
    }
}