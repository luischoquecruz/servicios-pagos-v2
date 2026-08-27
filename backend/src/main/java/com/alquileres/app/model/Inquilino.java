package com.alquileres.app.model;

/**
 * Inquilino de la casa.
 * Vive por un tiempo determinado: estado habilitado/deshabilitado,
 * fecha de ingreso y fecha de salida.
 */
public class Inquilino {

    private String id;
    private String nombre;
    private String celular;
    private String fechaIngreso;   // yyyy-MM-dd
    private String fechaSalida;    // yyyy-MM-dd (null si aun vive)
    private boolean habilitado;
    private int habitaciones;      // cantidad de habitaciones alquiladas
    private int personas;          // cantidad de personas que las habitan

    public Inquilino() {
    }

    public Inquilino(String id, String nombre, String celular, String fechaIngreso,
                     String fechaSalida, boolean habilitado, int habitaciones, int personas) {
        this.id = id;
        this.nombre = nombre;
        this.celular = celular;
        this.fechaIngreso = fechaIngreso;
        this.fechaSalida = fechaSalida;
        this.habilitado = habilitado;
        this.habitaciones = habitaciones;
        this.personas = personas;
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

    public String getCelular() {
        return celular;
    }

    public void setCelular(String celular) {
        this.celular = celular;
    }

    public String getFechaIngreso() {
        return fechaIngreso;
    }

    public void setFechaIngreso(String fechaIngreso) {
        this.fechaIngreso = fechaIngreso;
    }

    public String getFechaSalida() {
        return fechaSalida;
    }

    public void setFechaSalida(String fechaSalida) {
        this.fechaSalida = fechaSalida;
    }

    public boolean isHabilitado() {
        return habilitado;
    }

    public void setHabilitado(boolean habilitado) {
        this.habilitado = habilitado;
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
}