package com.alquileres.app.store;

import java.util.List;

import com.alquileres.app.model.Asignacion;
import com.alquileres.app.model.Cobro;
import com.alquileres.app.model.Inquilino;
import com.alquileres.app.model.Pago;
import com.alquileres.app.model.Servicio;
import com.alquileres.app.model.ServicioInquilino;
import com.alquileres.app.model.Snapshot;

/**
 * Abstraccion del almacenamiento por hojas del spreadsheet "Casa".
 * Cada metodo trabaja sobre una hoja determinada.
 * Implementaciones: GoogleSheetsStore (Google Sheets via Apps Script) y
 * LocalJsonStore (base local para desarrollo sin Google).
 */
public interface CasaStore {

    /** Nombre del spreadsheet que representa la casa. */
    String nombreCasa();

    /** Hoja "inquilinos". */
    List<Inquilino> listInquilinos();

    void upsertInquilino(Inquilino inquilino);

    void deleteInquilino(String id);

    /** Hoja "servicios". */
    List<Servicio> listServicios();

    void upsertServicio(Servicio servicio);

    void deleteServicio(String id);

    /** Hoja "servicios_inquilinos". */
    List<ServicioInquilino> listServiciosInquilinos();

    void upsertServicioInquilino(ServicioInquilino config);

    void deleteServicioInquilino(String id);

    /** Hoja "asignaciones": configuracion por periodo/inquilino/servicio (extras + precios). */
    List<Asignacion> listAsignaciones();

    List<Asignacion> listAsignaciones(String periodo);

    void upsertAsignacion(Asignacion asignacion);

    void deleteAsignacion(String id);

    /** Hoja "cobros": reemplaza las lineas de un periodo por las generadas. */
    List<Cobro> listCobros();

    void replaceCobros(String periodo, List<Cobro> cobros);

    /** Hoja "pagos". */
    List<Pago> listPagos();

    void upsertPago(Pago pago);

    void deletePago(String id);

    /** Recarga la informacion de todas las hojas (sincronizacion). */
    Snapshot snapshot();

    /** Fuerza una recarga de todas las hojas. */
    void reload();

    String fuente();
}