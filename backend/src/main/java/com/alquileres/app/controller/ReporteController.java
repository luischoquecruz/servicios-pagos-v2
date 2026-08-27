package com.alquileres.app.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.alquileres.app.service.ReporteService;

@RestController
@RequestMapping("/api/reportes")
public class ReporteController {

    private final ReporteService service;

    public ReporteController(ReporteService service) {
        this.service = service;
    }

    /** Detalle por mes: por inquilino, por servicio y linea por linea. */
    @GetMapping("/mensual")
    public ReporteService.ReporteMensual mensual(@RequestParam String periodo) {
        return service.mensual(periodo);
    }

    /** Resumen general de todas las hojas. */
    @GetMapping("/general")
    public ReporteService.ReporteGeneral general() {
        return service.general();
    }
}