package com.alquileres.app.controller;

import java.math.RoundingMode;
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

import com.alquileres.app.model.Inquilino;
import com.alquileres.app.model.Pago;
import com.alquileres.app.service.CalculoService;
import com.alquileres.app.service.Fechas;
import com.alquileres.app.service.Ids;
import com.alquileres.app.service.Pagos;
import com.alquileres.app.store.CasaStore;

@RestController
@RequestMapping("/api/pagos")
public class PagoController {

    private final CasaStore store;
    private final CalculoService calculo;

    public PagoController(CasaStore store, CalculoService calculo) {
        this.store = store;
        this.calculo = calculo;
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

    /**
     * Registra o edita un pago (si trae id). Factura = pago sin inquilino.
     * Al crear/editar una factura se reajustan los cobros ya generados de ese servicio/mes.
     */
    @PostMapping
    public Pago registrar(@RequestBody Pago body) {
        synchronized (calculo) {
            return registrarSinLock(body);
        }
    }

    private Pago registrarSinLock(Pago body) {
        if (body.getMontoBs() == null || body.getMontoBs().signum() < 0) {
            throw new IllegalArgumentException("El monto es invalido");
        }
        body.setMontoBs(body.getMontoBs().setScale(2, RoundingMode.HALF_UP));
        if (body.getInquilinoId() != null && body.getInquilinoId().isBlank()) {
            body.setInquilinoId(null);
        }
        if (body.getServicioId() != null && body.getServicioId().isBlank()) {
            body.setServicioId(null);
        }
        if (body.getFechaPago() == null || body.getFechaPago().isBlank()) {
            body.setFechaPago(Fechas.hoy().toString());
        }
        try {
            body.setFechaPago(java.time.LocalDate.parse(body.getFechaPago().trim()).toString());
        } catch (java.time.format.DateTimeParseException e) {
            throw new IllegalArgumentException("La fecha de pago es invalida");
        }
        if (body.getPeriodo() == null || body.getPeriodo().isBlank()) {
            body.setPeriodo(Fechas.mesActual().toString());
        }
        body.setPeriodo(CalculoService.parse(body.getPeriodo()).prefix());

        boolean factura = Pagos.esFactura(body);
        if (!factura) {
            Inquilino inq = store.listInquilinos().stream()
                    .filter(i -> body.getInquilinoId().equals(i.getId())).findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("El inquilino no existe"));
            if (Pagos.ALQUILER_ID.equals(body.getServicioId())
                    && (!inq.isCobraAlquiler() || inq.getAlquilerBs() == null || inq.getAlquilerBs().signum() <= 0)) {
                throw new IllegalArgumentException("Este inquilino no tiene habilitado el pago de alquiler");
            }
        } else {
            if (body.getServicioId() == null) {
                throw new IllegalArgumentException("La factura debe indicar el servicio");
            }
            if (Pagos.ALQUILER_ID.equals(body.getServicioId())) {
                throw new IllegalArgumentException("El pago de alquiler debe asociarse a un inquilino");
            }
        }
        if (body.getServicioId() != null && !Pagos.ALQUILER_ID.equals(body.getServicioId())
                && store.listServicios().stream().noneMatch(s -> body.getServicioId().equals(s.getId()))) {
            throw new IllegalArgumentException("El servicio no existe");
        }

        List<Pago> existentes = store.listPagos();
        Pago anterior = null;
        if (body.getId() != null && !body.getId().isBlank()) {
            anterior = existentes.stream().filter(p -> body.getId().equals(p.getId())).findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("El pago a editar no existe: " + body.getId()));
            if (Pagos.esFactura(anterior) != factura) {
                throw new IllegalArgumentException("No se puede convertir una factura en pago de inquilino (ni al reves)");
            }
        }
        if (factura && anterior != null) {
            if (!body.getServicioId().equals(anterior.getServicioId()) || !body.getPeriodo().equals(anterior.getPeriodo())) {
                Pagos.verificarFacturaProtegida(existentes, anterior.getServicioId(), anterior.getPeriodo(),
                        body.getId(), "mover la factura");
            }
            if (body.getMontoBs().signum() == 0) {
                Pagos.verificarFacturaProtegida(existentes, body.getServicioId(), body.getPeriodo(),
                        body.getId(), "dejar la factura en 0");
            }
        }
        if (factura) {
            boolean duplicada = existentes.stream().anyMatch(p -> Pagos.esFactura(p)
                    && !p.getId().equals(body.getId())
                    && body.getServicioId().equals(p.getServicioId())
                    && body.getPeriodo().equals(p.getPeriodo()));
            if (duplicada) {
                throw new IllegalArgumentException("Ya existe una factura para este servicio en el periodo " + body.getPeriodo());
            }
        }
        if (anterior == null) {
            body.setId(Ids.nuevo("pg"));
        }
        store.upsertPago(body);

        if (factura) {
            calculo.sincronizarFactura(body.getServicioId(), body.getPeriodo());
            if (anterior != null && (!body.getServicioId().equals(anterior.getServicioId())
                    || !body.getPeriodo().equals(anterior.getPeriodo()))) {
                calculo.sincronizarFactura(anterior.getServicioId(), anterior.getPeriodo());
            }
        }
        return body;
    }

    /**
     * Elimina un pago. Una factura con abonos de inquilinos en su servicio/mes no se
     * puede eliminar (se corrige el monto); si se elimina, sus cobros se ajustan.
     */
    @DeleteMapping("/{id}")
    public void eliminar(@PathVariable String id) {
        synchronized (calculo) {
            eliminarSinLock(id);
        }
    }

    private void eliminarSinLock(String id) {
        List<Pago> pagos = store.listPagos();
        Pago pago = pagos.stream().filter(p -> id.equals(p.getId())).findFirst().orElse(null);
        if (pago == null) {
            return;
        }
        if (Pagos.esFactura(pago)) {
            Pagos.verificarFacturaProtegida(pagos, pago.getServicioId(), pago.getPeriodo(), id, "eliminar la factura");
        }
        store.deletePago(id);
        if (Pagos.esFactura(pago)) {
            calculo.sincronizarFactura(pago.getServicioId(), pago.getPeriodo());
        }
    }

}
