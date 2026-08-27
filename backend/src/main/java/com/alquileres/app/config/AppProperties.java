package com.alquileres.app.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Propiedades de la aplicacion: conexion con Google Sheets.
 */
@ConfigurationProperties(prefix = "app.sheets")
public class AppProperties {

    /** auto | google | local */
    private String mode = "auto";
    private String deployId = "";
    private String nombre = "Casa";
    private long syncMs = 30000;
    private long httpTimeoutMs = 60000;
    private String localFile = "./data/db.json";

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public String getDeployId() {
        return deployId;
    }

    public void setDeployId(String deployId) {
        this.deployId = deployId;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public long getSyncMs() {
        return syncMs;
    }

    public void setSyncMs(long syncMs) {
        this.syncMs = syncMs;
    }

    public long getHttpTimeoutMs() {
        return httpTimeoutMs;
    }

    public void setHttpTimeoutMs(long httpTimeoutMs) {
        this.httpTimeoutMs = httpTimeoutMs;
    }

    public String getLocalFile() {
        return localFile;
    }

    public void setLocalFile(String localFile) {
        this.localFile = localFile;
    }

    /** true si la configuracion resolvio usar Google Sheets. */
    public boolean usaGoogle() {
        String m = mode == null ? "" : mode.trim().toLowerCase();
        if ("google".equals(m)) {
            return hasDeployId();
        }
        if ("local".equals(m)) {
            return false;
        }
        return hasDeployId();
    }

    private boolean hasDeployId() {
        return deployId != null && !deployId.isBlank();
    }
}