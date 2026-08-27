package com.alquileres.app.controller;

import java.util.TreeSet;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.alquileres.app.config.AppProperties;
import com.alquileres.app.model.Snapshot;
import com.alquileres.app.store.CasaStore;
import com.alquileres.app.store.GoogleSheetsStore;

@RestController
@RequestMapping("/api")
public class ConfigController {

    private final CasaStore store;
    private final AppProperties props;

    public ConfigController(CasaStore store, AppProperties props) {
        this.store = store;
        this.props = props;
    }

    @GetMapping("/config")
    public Info config() {
        Snapshot snap = store.snapshot();
        boolean google = store instanceof GoogleSheetsStore;
        boolean conectado = true;
        String error = null;
        if (google) {
            GoogleSheetsStore gs = (GoogleSheetsStore) store;
            conectado = gs.isConnected();
            error = gs.getLastError();
        }
        var periodos = new TreeSet<String>();
        snap.getCobros().forEach(c -> periodos.add(c.getPeriodo()));
        snap.getPagos().forEach(p -> {
            if (p.getPeriodo() != null) {
                periodos.add(p.getPeriodo());
            }
        });
        return new Info(store.nombreCasa(), store.fuente(), google, conectado, error,
                snap.getSyncedAt(), snap.getVersion(), periodos.stream().toList());
    }

    public record Info(String nombre, String fuente, boolean google, boolean conectado,
                       String error, String syncedAt, long version, java.util.List<String> periodos) {
    }
}