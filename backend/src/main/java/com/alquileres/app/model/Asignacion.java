package com.alquileres.app.model;

import java.util.HashMap;
import java.util.Map;

/**
 * Asignacion POR PERIODO de un servicio a un inquilino, con los extras
 * (cantidades dinamicas segun el servicio).
 *
 * Id compuesto: periodo + "-" + inquilinoId + "-" + servicioId
 */
public class Asignacion {

    private String id;
    private String periodo;           // YYYY-MM
    private String inquilinoId;
    private String servicioId;
    private boolean activo;           // si el servicio se le cobra al inquilino ese mes
    private Map<String, Integer> extras; // nombre del extra -> cantidad

    public Asignacion() {
        this.extras = new HashMap<>();
    }

    public Asignacion(String id, String periodo, String inquilinoId, String servicioId,
                      boolean activo, Map<String, Integer> extras) {
        this.id = id;
        this.periodo = periodo;
        this.inquilinoId = inquilinoId;
        this.servicioId = servicioId;
        this.activo = activo;
        this.extras = extras != null ? new HashMap<>(extras) : new HashMap<>();
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getPeriodo() {
        return periodo;
    }

    public void setPeriodo(String periodo) {
        this.periodo = periodo;
    }

    public String getInquilinoId() {
        return inquilinoId;
    }

    public void setInquilinoId(String inquilinoId) {
        this.inquilinoId = inquilinoId;
    }

    public String getServicioId() {
        return servicioId;
    }

    public void setServicioId(String servicioId) {
        this.servicioId = servicioId;
    }

    public boolean isActivo() {
        return activo;
    }

    public void setActivo(boolean activo) {
        this.activo = activo;
    }

    public Map<String, Integer> getExtras() {
        return extras;
    }

    public void setExtras(Map<String, Integer> extras) {
        this.extras = extras != null ? extras : new HashMap<>();
    }

    /** Suma total de unidades de extras. */
    public int totalExtras() {
        if (extras == null || extras.isEmpty()) return 0;
        return extras.values().stream().mapToInt(Integer::intValue).sum();
    }
}
