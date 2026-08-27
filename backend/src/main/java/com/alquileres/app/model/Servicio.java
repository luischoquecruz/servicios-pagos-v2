package com.alquileres.app.model;

import java.util.ArrayList;
import java.util.List;

/**
 * Servicio de la casa (luz, agua, internet...).
 * El monto no es fijo: cada mes se registra el importe real de la factura
 * como un Pago sin inquilino (factura = inquilinoId null) y ese monto es el
 * que el motor de cobros reparte por cantidad de habitaciones (CUARTOS) o por
 * cantidad de personas (PERSONAS).
 * Los extras por consumo se definen como una lista dinamica de nombres
 * (ej. "Refrigerador", "Ducha") y cada uno suma +1 al factor de reparto.
 */
public class Servicio {

    public static final String METODO_CUARTOS = "CUARTOS";
    public static final String METODO_PERSONAS = "PERSONAS";

    private String id;
    private String nombre;
    private String unidadMedida;           // opcional: kWh, m3, etc.
    private String metodoPago;             // CUARTOS | PERSONAS
    private List<String> extras;           // nombres de los tipos de extra

    public Servicio() {
        this.extras = new ArrayList<>();
    }

    public Servicio(String id, String nombre, String unidadMedida,
                    String metodoPago, List<String> extras) {
        this.id = id;
        this.nombre = nombre;
        this.unidadMedida = unidadMedida;
        this.metodoPago = metodoPago;
        this.extras = extras != null ? new ArrayList<>(extras) : new ArrayList<>();
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public String getUnidadMedida() {
        return unidadMedida;
    }

    public void setUnidadMedida(String unidadMedida) {
        this.unidadMedida = unidadMedida;
    }

    public String getMetodoPago() {
        return metodoPago;
    }

    public void setMetodoPago(String metodoPago) {
        this.metodoPago = metodoPago;
    }

    public List<String> getExtras() {
        return extras;
    }

    public void setExtras(List<String> extras) {
        this.extras = extras != null ? extras : new ArrayList<>();
    }
}
