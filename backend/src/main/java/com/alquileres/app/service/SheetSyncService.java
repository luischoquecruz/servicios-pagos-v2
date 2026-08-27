package com.alquileres.app.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.alquileres.app.config.AppProperties;
import com.alquileres.app.store.CasaStore;

/**
 * Sincroniza periodicamente las hojas del spreadsheet "Casa" hacia la cache.
 * Solo corre cuando el almacenamiento es Google Sheets; en modo local no hace falta.
 */
@Service
public class SheetSyncService {

    private static final Logger log = LoggerFactory.getLogger(SheetSyncService.class);

    private final CasaStore store;
    private final AppProperties props;

    public SheetSyncService(CasaStore store, AppProperties props) {
        this.store = store;
        this.props = props;
        if ("google".equals(store.fuente())) {
            log.info("Sincronizacion con Google Sheets activada cada {} ms (Deployment ID: {})",
                    props.getSyncMs(), props.getDeployId());
        } else {
            log.info("Almacenamiento local activado: {}", props.getLocalFile());
        }
    }

    @Scheduled(fixedDelayString = "${app.sheets.sync-ms:30000}")
    public void sync() {
        if ("google".equals(store.fuente())) {
            try {
                store.reload();
            } catch (Exception e) {
                log.warn("Sincronizacion programada fallida: {}", e.getMessage());
            }
        }
    }
}