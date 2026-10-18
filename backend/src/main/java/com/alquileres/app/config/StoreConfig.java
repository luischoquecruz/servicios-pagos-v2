package com.alquileres.app.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.alquileres.app.sheets.ScriptClient;
import com.alquileres.app.store.CasaStore;
import com.alquileres.app.store.GoogleSheetsStore;
import com.alquileres.app.store.LocalJsonStore;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Selecciona el medio de almacenamiento segun la configuracion:
 * Google Sheets (con Deployment ID) o base local JSON.
 */
@Configuration
@EnableConfigurationProperties({AppProperties.class, SeguridadProperties.class})
public class StoreConfig {

    @Bean
    public CasaStore casaStore(AppProperties props, ScriptClient script, ObjectMapper mapper) {
        if (props.usaGoogle()) {
            GoogleSheetsStore store = new GoogleSheetsStore(script, mapper);
            store.reload();
            return store;
        }
        return new LocalJsonStore(props, mapper);
    }
}