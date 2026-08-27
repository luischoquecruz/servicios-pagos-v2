package com.alquileres.app.model;

import java.util.List;

/**
 * Fotos fiel del spreadsheet "Casa". Cada lista corresponde a una hoja.
 */
public class Snapshot {

    private List<Inquilino> inquilinos;
    private List<Servicio> servicios;
    private List<ServicioInquilino> serviciosInquilinos;
    private List<Cobro> cobros;
    private List<Pago> pagos;
    private List<Asignacion> asignaciones;
    private String syncedAt;      // momento de la ultima lectura de las hojas
    private long version;         // numero de version, cambia con cada sincronizacion
    private String fuente;        // "google" | "local"

    public Snapshot() {
    }

    public Snapshot(List<Inquilino> inquilinos, List<Servicio> servicios,
                    List<ServicioInquilino> serviciosInquilinos, List<Cobro> cobros,
                    List<Pago> pagos, List<Asignacion> asignaciones, String syncedAt, long version, String fuente) {
        this.inquilinos = inquilinos;
        this.servicios = servicios;
        this.serviciosInquilinos = serviciosInquilinos;
        this.cobros = cobros;
        this.pagos = pagos;
        this.asignaciones = asignaciones;
        this.syncedAt = syncedAt;
        this.version = version;
        this.fuente = fuente;
    }

    public List<Inquilino> getInquilinos() {
        return inquilinos;
    }

    public void setInquilinos(List<Inquilino> inquilinos) {
        this.inquilinos = inquilinos;
    }

    public List<Servicio> getServicios() {
        return servicios;
    }

    public void setServicios(List<Servicio> servicios) {
        this.servicios = servicios;
    }

    public List<ServicioInquilino> getServiciosInquilinos() {
        return serviciosInquilinos;
    }

    public void setServiciosInquilinos(List<ServicioInquilino> serviciosInquilinos) {
        this.serviciosInquilinos = serviciosInquilinos;
    }

    public List<Cobro> getCobros() {
        return cobros;
    }

    public void setCobros(List<Cobro> cobros) {
        this.cobros = cobros;
    }

    public List<Pago> getPagos() {
        return pagos;
    }

    public void setPagos(List<Pago> pagos) {
        this.pagos = pagos;
    }

    public List<Asignacion> getAsignaciones() {
        return asignaciones;
    }

    public void setAsignaciones(List<Asignacion> asignaciones) {
        this.asignaciones = asignaciones;
    }

    public String getSyncedAt() {
        return syncedAt;
    }

    public void setSyncedAt(String syncedAt) {
        this.syncedAt = syncedAt;
    }

    public long getVersion() {
        return version;
    }

    public void setVersion(long version) {
        this.version = version;
    }

    public String getFuente() {
        return fuente;
    }

    public void setFuente(String fuente) {
        this.fuente = fuente;
    }
}