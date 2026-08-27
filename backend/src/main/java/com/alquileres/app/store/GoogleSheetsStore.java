package com.alquileres.app.store;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.alquileres.app.model.Asignacion;
import com.alquileres.app.model.Cobro;
import com.alquileres.app.model.Inquilino;
import com.alquileres.app.model.Pago;
import com.alquileres.app.model.Servicio;
import com.alquileres.app.model.ServicioInquilino;
import com.alquileres.app.model.Snapshot;
import com.alquileres.app.sheets.ScriptClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Implementacion sobre Google Sheets via Apps Script Web App.
 * Mantiene una cache en memoria que se refresca periodicamente
 * (ver SheetSyncService). En la hoja de calculo cada entidad vive
 * en su propia hoja: inquilinos, servicios, servicios_inquilinos,
 * cobros y pagos.
 */
public class GoogleSheetsStore implements CasaStore {

    private static final Logger log = LoggerFactory.getLogger(GoogleSheetsStore.class);

    private final ScriptClient script;
    private final ObjectMapper mapper;
    private final Object lock = new Object();

    private volatile List<Inquilino> inquilinos = new ArrayList<>();
    private volatile List<Servicio> servicios = new ArrayList<>();
    private volatile List<ServicioInquilino> serviciosInquilinos = new ArrayList<>();
    private volatile List<Asignacion> asignaciones = new ArrayList<>();
    private volatile List<Cobro> cobros = new ArrayList<>();
    private volatile List<Pago> pagos = new ArrayList<>();
    private volatile boolean connected = false;
    private volatile String lastError = null;
    private volatile long version = 0;
    private volatile String syncedAt = null;

    public GoogleSheetsStore(ScriptClient script, ObjectMapper mapper) {
        this.script = script;
        this.mapper = mapper;
    }

    @Override
    public String nombreCasa() {
        return "Casa";
    }

    @Override
    public String fuente() {
        return "google";
    }

    public boolean isConnected() {
        return connected;
    }

    public String getLastError() {
        return lastError;
    }

    @Override
    public Snapshot snapshot() {
        synchronized (lock) {
            return new Snapshot(
                    Collections.unmodifiableList(new ArrayList<>(inquilinos)),
                    Collections.unmodifiableList(new ArrayList<>(servicios)),
                    Collections.unmodifiableList(new ArrayList<>(serviciosInquilinos)),
                    Collections.unmodifiableList(new ArrayList<>(cobros)),
                    Collections.unmodifiableList(new ArrayList<>(pagos)),
                    Collections.unmodifiableList(new ArrayList<>(asignaciones)),
                    syncedAt, version, fuente());
        }
    }

    @Override
    public void reload() {
        try {
            JsonNode resp = script.get("action=snapshot");
            JsonNode data = readData(resp);
            synchronized (lock) {
                inquilinos = readList(data, "inquilinos", Inquilino.class);
                servicios = readList(data, "servicios", Servicio.class);
                 serviciosInquilinos = readList(data, "servicios_inquilinos", ServicioInquilino.class);
                cobros = readList(data, "cobros", Cobro.class);
                pagos = readList(data, "pagos", Pago.class);
                asignaciones = readList(data, "asignaciones", Asignacion.class);
                syncedAt = Instant.now().toString();
                version++;
                connected = true;
                lastError = null;
             }
             log.info("Google Sheets sincronizado: {} inquilinos, {} servicios, {} cobros, {} pagos, {} asignaciones",
                     inquilinos.size(), servicios.size(), cobros.size(), pagos.size(), asignaciones.size());
        } catch (Exception e) {
            connected = false;
            lastError = e.getMessage();
            log.warn("Fallo la sincronizacion con Google Sheets", e);
        }
    }

    // -------------------- Inquilinos --------------------

    @Override
    public List<Inquilino> listInquilinos() {
        return Collections.unmodifiableList(new ArrayList<>(inquilinos));
    }

    @Override
    public void upsertInquilino(Inquilino inquilino) {
        callWrite("upsert", "inquilinos", inquilino);
    }

    @Override
    public void deleteInquilino(String id) {
        callWrite("delete", "inquilinos", id, null);
    }

    // -------------------- Servicios --------------------

    @Override
    public List<Servicio> listServicios() {
        return Collections.unmodifiableList(new ArrayList<>(servicios));
    }

    @Override
    public void upsertServicio(Servicio servicio) {
        callWrite("upsert", "servicios", servicio);
    }

    @Override
    public void deleteServicio(String id) {
        callWrite("delete", "servicios", id, null);
    }

    // -------------------- Servicios por inquilino --------------------

    @Override
    public List<ServicioInquilino> listServiciosInquilinos() {
        return Collections.unmodifiableList(new ArrayList<>(serviciosInquilinos));
    }

    @Override
    public void upsertServicioInquilino(ServicioInquilino config) {
        callWrite("upsert", "servicios_inquilinos", config);
    }

    @Override
    public void deleteServicioInquilino(String id) {
        callWrite("delete", "servicios_inquilinos", id, null);
    }

    // -------------------- Cobros --------------------

    @Override
    public List<Cobro> listCobros() {
        return Collections.unmodifiableList(new ArrayList<>(cobros));
    }

    @Override
    public List<Asignacion> listAsignaciones() {
        return Collections.unmodifiableList(new ArrayList<>(asignaciones));
    }

    @Override
    public List<Asignacion> listAsignaciones(String periodo) {
        return listAsignaciones().stream()
                .filter(a -> periodo != null && periodo.equals(a.getPeriodo()))
                .toList();
    }

    @Override
    public void upsertAsignacion(Asignacion value) {
        callWrite("upsert", "asignaciones", value);
    }

    @Override
    public void deleteAsignacion(String id) {
        callWrite("delete", "asignaciones", id, null);
    }

    @Override
    public void replaceCobros(String periodo, List<Cobro> rows) {
        try {
            JsonNode resp = script.post(Map.of(
                    "action", "replaceCobros",
                    "periodo", periodo,
                    "rows", rows == null ? List.of() : rows));
            ok(resp);
            reload();
        } catch (Exception e) {
            throw new RuntimeException("Fallo al guardar cobros: " + e.getMessage(), e);
        }
    }

    // -------------------- Pagos --------------------

    @Override
    public List<Pago> listPagos() {
        return Collections.unmodifiableList(new ArrayList<>(pagos));
    }

    @Override
    public void upsertPago(Pago pago) {
        callWrite("upsert", "pagos", pago);
    }

    @Override
    public void deletePago(String id) {
        callWrite("delete", "pagos", id, null);
    }

    // -------------------- utilidades --------------------

    private void callWrite(String op, String sheet, Object row) {
        callWrite(op, sheet, null, row);
    }

    private void callWrite(String op, String sheet, String id, Object row) {
        try {
            Map<String, Object> body = new java.util.HashMap<>();
            body.put("action", op);
            body.put("sheet", sheet);
            if (id != null) {
                body.put("id", id);
            }
            if (row != null) {
                body.put("row", row);
            }
            JsonNode resp = script.post(body);
            ok(resp);
            reload();
        } catch (Exception e) {
            throw new RuntimeException("Fallo la escritura '" + op + "' en " + sheet + ": " + e.getMessage(), e);
        }
    }

    private JsonNode readData(JsonNode resp) {
        if (resp == null) {
            throw new RuntimeException("El script devolvio una respuesta vacia");
        }
        JsonNode data = resp.path("data");
        if (resp.path("ok").asBoolean(false)) {
            return data.isMissingNode() || data.isNull() ? resp : data;
        }
        // Algunas respuestas llegan sin la envoltura ok/data; se asume que el propio
        // objeto es el contenido (contiene las hojas).
        if (resp.isObject() && (resp.has("inquilinos") || resp.has("servicios"))) {
            log.warn("Respuesta del script sin envoltura ok/data; se interpreta como contenido directo");
            return resp;
        }
        throw new RuntimeException("El script devolvio un error: " + resp);
    }

    private void ok(JsonNode resp) {
        if (resp == null || !resp.path("ok").asBoolean(false)) {
            String msg = resp == null ? "respuesta vacia" : resp.path("error").asText(String.valueOf(resp));
            throw new RuntimeException(msg);
        }
    }

    private <T> List<T> readList(JsonNode data, String field, Class<T> type) {
        JsonNode arr = data.path(field);
        if (arr.isMissingNode() || arr.isNull() || !arr.isArray()) {
            return new ArrayList<>();
        }
        List<T> list = new ArrayList<>();
        for (JsonNode node : arr) {
            if (node.isNull() || (node.isObject() && node.isEmpty())) {
                continue;
            }
            try {
                list.add(mapper.treeToValue(node, type));
            } catch (Exception e) {
                throw new RuntimeException("Fila invalida en hoja " + field + ": " + node + " -> " + e.getMessage(), e);
            }
        }
        return list;
    }
}