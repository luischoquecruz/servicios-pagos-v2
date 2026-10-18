package com.alquileres.app.service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;

/** Fechas en la zona horaria de la casa (no la del servidor). */
public final class Fechas {

    public static final ZoneId ZONA = ZoneId.of("America/La_Paz");

    private Fechas() {
    }

    public static LocalDate hoy() {
        return LocalDate.now(ZONA);
    }

    public static YearMonth mesActual() {
        return YearMonth.now(ZONA);
    }
}
