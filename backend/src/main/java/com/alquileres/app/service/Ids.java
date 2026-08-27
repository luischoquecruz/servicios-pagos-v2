package com.alquileres.app.service;

import java.util.UUID;

/** Generador simple de identificadores. */
public final class Ids {

    private Ids() {
    }

    public static String nuevo(String prefijo) {
        return prefijo + "-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    }

    public static String compuesto(String inquilinoId, String servicioId) {
        return inquilinoId + "-" + servicioId;
    }
}