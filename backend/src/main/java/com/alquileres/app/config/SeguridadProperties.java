package com.alquileres.app.config;

import java.util.ArrayList;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Seguridad del API REST.
 * app.security.api-key: clave que el frontend envia en la cabecera X-Api-Key.
 * app.security.cors-origins: origenes permitidos (lista separada por comas).
 */
@ConfigurationProperties(prefix = "app.security")
public class SeguridadProperties {

    private String apiKey = "";
    private List<String> corsOrigins = new ArrayList<>(List.of("http://localhost:5173"));

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public List<String> getCorsOrigins() {
        return corsOrigins;
    }

    public void setCorsOrigins(List<String> corsOrigins) {
        this.corsOrigins = corsOrigins;
    }

    public boolean tieneClave() {
        return apiKey != null && !apiKey.isBlank();
    }
}
