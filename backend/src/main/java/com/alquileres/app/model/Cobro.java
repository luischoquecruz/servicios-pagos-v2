package com.alquileres.app.model;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

/**
 * Linea de cobro generada mes a mes para un inquilino y servicio.
 * Guarda el detalle del calculo: reparto base por habitaciones o personas
 * mas los extras por consumo configurados.
 */
public class Cobro {

    private String id;              // periodo + "-" + inquilinoId + "-" + servicioId
    private String periodo;         // YYYY-MM
    private String inquilinoId;
    private String servicioId;
    private BigDecimal peso;        // unidades usadas (habitaciones o personas + extras)
    private BigDecimal pesoTotal;   // unidades totales del servicio en el periodo
    private BigDecimal montoBase;   // reparto del costo fijo del servicio
    private BigDecimal montoExtra;  // monto adicional por extras (por ahora 0)
    private BigDecimal montoTotal;  // base + extra
    private int habitaciones;
    private int personas;
    private Map<String, Integer> extras; // nombre del extra -> cantidad

    public Cobro() {
        this.extras = new HashMap<>();
    }

    public Cobro(String id, String periodo, String inquilinoId, String servicioId,
                 BigDecimal peso, BigDecimal pesoTotal, BigDecimal montoBase,
                 BigDecimal montoExtra, BigDecimal montoTotal, int habitaciones,
                 int personas, Map<String, Integer> extras) {
        this.id = id;
        this.periodo = periodo;
        this.inquilinoId = inquilinoId;
        this.servicioId = servicioId;
        this.peso = peso;
        this.pesoTotal = pesoTotal;
        this.montoBase = montoBase;
        this.montoExtra = montoExtra;
        this.montoTotal = montoTotal;
        this.habitaciones = habitaciones;
        this.personas = personas;
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

    public BigDecimal getPeso() {
        return peso;
    }

    public void setPeso(BigDecimal peso) {
        this.peso = peso;
    }

    public BigDecimal getPesoTotal() {
        return pesoTotal;
    }

    public void setPesoTotal(BigDecimal pesoTotal) {
        this.pesoTotal = pesoTotal;
    }

    public BigDecimal getMontoBase() {
        return montoBase;
    }

    public void setMontoBase(BigDecimal montoBase) {
        this.montoBase = montoBase;
    }

    public BigDecimal getMontoExtra() {
        return montoExtra;
    }

    public void setMontoExtra(BigDecimal montoExtra) {
        this.montoExtra = montoExtra;
    }

    public BigDecimal getMontoTotal() {
        return montoTotal;
    }

    public void setMontoTotal(BigDecimal montoTotal) {
        this.montoTotal = montoTotal;
    }

    public int getHabitaciones() {
        return habitaciones;
    }

    public void setHabitaciones(int habitaciones) {
        this.habitaciones = habitaciones;
    }

    public int getPersonas() {
        return personas;
    }

    public void setPersonas(int personas) {
        this.personas = personas;
    }

    public Map<String, Integer> getExtras() {
        return extras;
    }

    public void setExtras(Map<String, Integer> extras) {
        this.extras = extras != null ? extras : new HashMap<>();
    }
}
