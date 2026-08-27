package com.alquileres.app.model;

import java.math.BigDecimal;

/**
 * Registro de pago: fecha, monto recibido por un inquilino.
 * Se asocia opcionalmente a un servicio y a un periodo (mes).
 */
public class Pago {

    private String id;
    private String inquilinoId;
    private String servicioId;   // null si es un pago general/global
    private String periodo;      // YYYY-MM al que corresponde
    private String fechaPago;    // yyyy-MM-dd
    private BigDecimal montoBs;
    private BigDecimal cantidad;      // consumo medido (factura), opcional
    private String unidadMedida;      // unidad del consumo (factura), opcional
    private String observacion;

    public Pago() {
    }

    public Pago(String id, String inquilinoId, String servicioId, String periodo,
                String fechaPago, BigDecimal montoBs, String observacion) {
        this.id = id;
        this.inquilinoId = inquilinoId;
        this.servicioId = servicioId;
        this.periodo = periodo;
        this.fechaPago = fechaPago;
        this.montoBs = montoBs;
        this.observacion = observacion;
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

    public String getPeriodo() {
        return periodo;
    }

    public void setPeriodo(String periodo) {
        this.periodo = periodo;
    }

    public String getFechaPago() {
        return fechaPago;
    }

    public void setFechaPago(String fechaPago) {
        this.fechaPago = fechaPago;
    }

    public BigDecimal getMontoBs() {
        return montoBs;
    }

    public void setMontoBs(BigDecimal montoBs) {
        this.montoBs = montoBs;
    }

    public BigDecimal getCantidad() {
        return cantidad;
    }

    public void setCantidad(BigDecimal cantidad) {
        this.cantidad = cantidad;
    }

    public String getUnidadMedida() {
        return unidadMedida;
    }

    public void setUnidadMedida(String unidadMedida) {
        this.unidadMedida = unidadMedida;
    }

    public String getObservacion() {
        return observacion;
    }

    public void setObservacion(String observacion) {
        this.observacion = observacion;
    }
}