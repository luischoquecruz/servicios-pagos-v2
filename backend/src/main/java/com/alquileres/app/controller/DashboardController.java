package com.alquileres.app.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.alquileres.app.service.DashboardService;

@RestController
@RequestMapping("/api")
public class DashboardController {

    private final DashboardService service;

    public DashboardController(DashboardService service) {
        this.service = service;
    }

    @GetMapping("/dashboard")
    public DashboardService.Resumen resumen() {
        return service.resumen();
    }
}