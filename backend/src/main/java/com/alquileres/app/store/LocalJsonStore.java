package com.alquileres.app.store;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.alquileres.app.config.AppProperties;
import com.alquileres.app.model.Asignacion;
import com.alquileres.app.model.Cobro;
import com.alquileres.app.model.Inquilino;
import com.alquileres.app.model.Pago;
import com.alquileres.app.model.Servicio;
import com.alquileres.app.model.ServicioInquilino;
import com.alquileres.app.model.Snapshot;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Almacenamiento local en un archivo JSON (modo desarrollo sin Google).
 * Cada "hoja" del spreadsheet se representa como una clave del JSON:
 * inquilinos, servicios, servicios_inquilinos, cobros, pagos y asignaciones.
 */
public class LocalJsonStore implements CasaStore {

    private static final Logger log = LoggerFactory.getLogger(LocalJsonStore.class);
    private static final String NOMBRE = "Casa";
    private static final List<String> HOJAS = List.of(
            "inquilinos", "servicios", "servicios_inquilinos", "cobros", "pagos", "asignaciones");

    private final AppProperties props;
    private final ObjectMapper mapper;

    private final Object lock = new Object();
    private Map<String, Object> data;
    private long version = 0;

    public LocalJsonStore(AppProperties props, ObjectMapper mapper) {
        this.props = props;
        this.mapper = mapper;
        this.data = new LinkedHashMap<>();
        this.data.put("nombre", NOMBRE);
        for (String hoja : HOJAS) {
            this.data.put(hoja, new ArrayList<>());
        }
        loadOrInit();
    }

    @Override
    public String nombreCasa() {
        return NOMBRE;
    }

    @Override
    public String fuente() {
        return "local";
    }

    private Path file() {
        return Paths.get(props.getLocalFile());
    }

    private void loadOrInit() {
        Path f = file();
        if (Files.exists(f)) {
            try {
                String json = Files.readString(f, StandardCharsets.UTF_8);
                Map<String, Object> loaded = mapper.readValue(json, Map.class);
                synchronized (lock) {
                    if (loaded != null) {
                        data = new LinkedHashMap<>(loaded);
                        for (String hoja : HOJAS) {
                            data.putIfAbsent(hoja, new ArrayList<>());
                        }
                        data.putIfAbsent("nombre", NOMBRE);
                    }
                }
                log.info("Base local cargada: {}", f.toAbsolutePath());
            } catch (IOException e) {
                log.warn("No se pudo leer el archivo local {}: {}", f.toAbsolutePath(), e.getMessage());
            }
        }
        synchronized (lock) {
            if (seedIfEmpty()) {
                persist();
            }
        }
    }

    private boolean seedIfEmpty() {
        List<?> servicios = (List<?>) data.get("servicios");
        if (servicios.isEmpty()) {
            List<Servicio> seed = new ArrayList<>();
            seed.add(new Servicio("svc-agua", "Agua", "m3", Servicio.METODO_PERSONAS, List.of()));
            seed.add(new Servicio("svc-luz", "Luz", "kWh", Servicio.METODO_CUARTOS, List.of()));
            seed.add(new Servicio("svc-internet", "Internet", "", Servicio.METODO_CUARTOS, List.of()));
            data.put("servicios", seed);
            return true;
        }
        return false;
    }

    @Override
    public Snapshot snapshot() {
        synchronized (lock) {
            return new Snapshot(
                    list(Inquilino.class, "inquilinos"),
                    list(Servicio.class, "servicios"),
                    list(ServicioInquilino.class, "servicios_inquilinos"),
                    list(Cobro.class, "cobros"),
                    list(Pago.class, "pagos"),
                    list(Asignacion.class, "asignaciones"),
                    Instant.now().toString(), version, fuente());
        }
    }

    @Override
    public List<Inquilino> listInquilinos() {
        return list(Inquilino.class, "inquilinos");
    }

    @Override
    public List<Servicio> listServicios() {
        return list(Servicio.class, "servicios");
    }

    @Override
    public List<ServicioInquilino> listServiciosInquilinos() {
        return list(ServicioInquilino.class, "servicios_inquilinos");
    }

    @Override
    public List<Cobro> listCobros() {
        return list(Cobro.class, "cobros");
    }

    @Override
    public List<Pago> listPagos() {
        return list(Pago.class, "pagos");
    }

    @Override
    public List<Asignacion> listAsignaciones() {
        return list(Asignacion.class, "asignaciones");
    }

    @Override
    public List<Asignacion> listAsignaciones(String periodo) {
        return listAsignaciones().stream()
                .filter(a -> periodo != null && periodo.equals(a.getPeriodo()))
                .toList();
    }

    private <T> List<T> list(Class<T> type, String hoja) {
        synchronized (lock) {
            List<?> raw = (List<?>) data.getOrDefault(hoja, new ArrayList<>());
            List<T> out = new ArrayList<>();
            for (Object o : raw) {
                try {
                    out.add(mapper.convertValue(o, type));
                } catch (Exception e) {
                    log.warn("Fila invalida en {}: {}", hoja, o);
                }
            }
            return out;
        }
    }

    @Override
    public void upsertInquilino(Inquilino value) {
        upsert("inquilinos", value.getId(), value);
    }

    @Override
    public void deleteInquilino(String id) {
        delete("inquilinos", id);
    }

    @Override
    public void upsertServicio(Servicio value) {
        upsert("servicios", value.getId(), value);
    }

    @Override
    public void deleteServicio(String id) {
        delete("servicios", id);
    }

    @Override
    public void upsertServicioInquilino(ServicioInquilino value) {
        upsert("servicios_inquilinos", value.getId(), value);
    }

    @Override
    public void deleteServicioInquilino(String id) {
        delete("servicios_inquilinos", id);
    }

    @Override
    public void upsertPago(Pago value) {
        upsert("pagos", value.getId(), value);
    }

    @Override
    public void deletePago(String id) {
        delete("pagos", id);
    }

    @Override
    public void upsertAsignacion(Asignacion value) {
        upsert("asignaciones", value.getId(), value);
    }

    @Override
    public void deleteAsignacion(String id) {
        delete("asignaciones", id);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> rawList(String hoja) {
        return (List<Map<String, Object>>) data.computeIfAbsent(hoja, k -> new ArrayList<>());
    }

    private void upsert(String hoja, String id, Object value) {
        synchronized (lock) {
            List<Map<String, Object>> rows = rawList(hoja);
            Map<String, Object> map = mapper.convertValue(value, Map.class);
            for (int i = 0; i < rows.size(); i++) {
                if (id != null && id.equals(rows.get(i).get("id"))) {
                    rows.set(i, map);
                    persist();
                    return;
                }
            }
            rows.add(map);
            persist();
        }
    }

    private void delete(String hoja, String id) {
        synchronized (lock) {
            List<Map<String, Object>> rows = rawList(hoja);
            rows.removeIf(r -> id != null && id.equals(r.get("id")));
            persist();
        }
    }

    @Override
    public void replaceCobros(String periodo, List<Cobro> cobros) {
        synchronized (lock) {
            List<Map<String, Object>> rows = rawList("cobros");
            rows.removeIf(r -> periodo != null && periodo.equals(r.get("periodo")));
            for (Cobro c : cobros) {
                rows.add(mapper.convertValue(c, Map.class));
            }
            persist();
        }
    }

    @Override
    public void reload() {
        loadOrInit();
        synchronized (lock) {
            version++;
        }
    }

    private void persist() {
        try {
            Path f = file();
            if (f.getParent() != null) {
                Files.createDirectories(f.getParent());
            }
            String json = mapper.writerWithDefaultPrettyPrinter().writeValueAsString(data);
            Files.writeString(f, json, StandardCharsets.UTF_8);
            version++;
        } catch (IOException e) {
            throw new RuntimeException("No se pudo guardar la base local: " + e.getMessage(), e);
        }
    }
}