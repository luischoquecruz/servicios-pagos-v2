package com.alquileres.app.model;

import java.util.HashMap;
import java.util.Map;

/**
 * Configuracion por inquilino y servicio.
 * Determina a que servicios esta suscrito el inquilino y las
 * opciones adicionales de consumo que se le cobran.
 */
public class ServicioInquilino {

    private String id;              // compuesto: inquilinoId + "-" + servicioId
    private String inquilinoId;
    private String servicioId;
    private boolean activo;         // si el servicio se le cobra al inquilino
    private Map<String, Integer> extras; // nombre del extra -> cantidad

    public ServicioInquilino() {
        this.extras = new HashMap<>();
    }

    public ServicioInquilino(String id, String inquilinoId, String servicioId,
                             boolean activo, Map<String, Integer> extras) {
        this.id = id;
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
}
