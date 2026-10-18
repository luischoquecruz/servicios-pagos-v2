package com.alquileres.app.sheets;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.alquileres.app.config.AppProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Cliente HTTP del Apps Script Web App que expone el spreadsheet "Casa".
 * La URL de implementacion es https://script.google.com/macros/s/{deployId}/exec.
 *
 * <p>Los web apps de Google devuelven un redirect 302 hacia
 * script.googleusercontent.com; aqui se reenvia la peticion
 * conservando el cuerpo en POST para no perder los datos.
 */
@Component
public class ScriptClient {

    private static final Logger log = LoggerFactory.getLogger(ScriptClient.class);

    private final AppProperties props;
    private final ObjectMapper mapper;
    private final HttpClient client;

    public ScriptClient(AppProperties props, ObjectMapper mapper) {
        this.props = props;
        this.mapper = mapper;
        this.client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(props.getHttpTimeoutMs()))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    public String baseUrl() {
        return "https://script.google.com/macros/s/" + props.getDeployId() + "/exec";
    }

    /**
     * GET al script (lee las hojas).
     */
    public JsonNode get(String... params) throws IOException, InterruptedException {
        return executeRequest("GET", baseUrl(), null, params);
    }

    private String claveParam() {
        String k = props.getScriptKey() == null ? "" : props.getScriptKey();
        return "key=" + URLEncoder.encode(k, StandardCharsets.UTF_8);
    }

    /**
     * POST con JSON al script (escribe en las hojas).
     * Google ejecuta doPost en el primer request y responde un 302; el redirect
     * se sigue como GET (igual que un navegador).
     */
    public JsonNode post(Map<String, Object> payload) throws IOException, InterruptedException {
        Map<String, Object> cuerpo = new HashMap<>(payload);
        cuerpo.put("key", props.getScriptKey());
        return executeRequest("POST", baseUrl(), cuerpo, (String[]) null);
    }

    private JsonNode executeRequest(String method, String startUrl, Map<String, Object> payload,
            String[] params) throws IOException, InterruptedException {
        String url = startUrl + "?" + claveParam();
        if (params != null && params.length > 0) {
            url = url + "&" + String.join("&", params);
        }

        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(url));
        if ("POST".equals(method)) {
            String json = mapper.writeValueAsString(payload);
            builder.header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json));
        } else {
            builder.GET();
        }
        builder.header("Accept", "application/json")
               .header("X-Requested-With", "XMLHttpRequest")
               .timeout(Duration.ofMillis(props.getHttpTimeoutMs()));

        HttpResponse<String> resp = client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        int status = resp.statusCode();
        if (status < 200 || status >= 300) {
            String body = resp.body();
            throw new RuntimeException("Error llamando al script Google (" + status + "): "
                    + (body.length() > 300 ? body.substring(0, 300) : body));
        }
        String body = resp.body();
        JsonNode node = mapper.readTree(body);
        if (!node.path("ok").isBoolean()) {
            log.warn("El script no envio el campo 'ok' (status {}). Cuerpo recibido:\n{}",
                    status, body.length() > 500 ? body.substring(0, 500) : body);
        }
        return node;
    }
}