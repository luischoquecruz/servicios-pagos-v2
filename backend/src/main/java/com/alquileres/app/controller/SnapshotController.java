package com.alquileres.app.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.alquileres.app.model.Snapshot;
import com.alquileres.app.store.CasaStore;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

@RestController
@RequestMapping("/api")
public class SnapshotController {

    private final CasaStore store;
    private final ObjectMapper mapper;

    public SnapshotController(CasaStore store, ObjectMapper mapper) {
        this.store = store;
        this.mapper = mapper;
    }

    /** Fotos fiel de todas las hojas. El frontend lo consulta cada 5 segundos. */
    @GetMapping("/snapshot")
    public ObjectNode snapshot() {
        Snapshot snap = store.snapshot();
        return mapper.valueToTree(snap);
    }
}