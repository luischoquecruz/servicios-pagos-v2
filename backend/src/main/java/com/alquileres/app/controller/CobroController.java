package com.alquileres.app.controller;

import java.util.Comparator;
import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.alquileres.app.model.Cobro;
import com.alquileres.app.service.CalculoService;
import com.alquileres.app.store.CasaStore;

@RestController
@RequestMapping("/api/cobros")
public class CobroController {

    private final CasaStore store;
    private final CalculoService calculo;

    public CobroController(CasaStore store, CalculoService calculo) {
        this.store = store;
        this.calculo = calculo;
    }

    /**
     * Lista los cobros. Sin periodo devuelve todos ordenados de mas reciente a antiguo;
     * con ?periodo=YYYY-MM filtra solo ese mes.
     */
    @GetMapping
    public List<Cobro> listar(@RequestParam(required = false) String periodo) {
        List<Cobro> all = store.listCobros();
        if (periodo != null && !periodo.isBlank()) {
            all = all.stream().filter(c -> periodo.equals(c.getPeriodo())).toList();
        }
        return all.stream()
                .sorted(Comparator.comparing(Cobro::getPeriodo, Comparator.reverseOrder()))
                .toList();
    }

    /**
     * Calcula y guarda los cobros del periodo (mes a mes). Vuelve a calcular
     * cuando cambian inquilinos, servicios o suscripciones.
     */
    @PostMapping("/generar")
    public List<Cobro> generar(@RequestParam String periodo) {
        return calculo.generarPeriodo(periodo);
    }

    /**
     * Genera SOLO los cobros de un servicio del periodo, conservando las
     * lineas de los demas servicios de ese mes.
     */
    @PostMapping("/generarServicio")
    public List<Cobro> generarServicio(@RequestParam String periodo, @RequestParam String servicioId) {
        return calculo.generarServicio(periodo, servicioId);
    }

    /**
     * Reajusta el factor (peso) del reparto de un servicio ya generado.
     * Body: { proceso: "pesos", pesos: { inquilinoId: factor } }
     */
    @PostMapping("/editarPeso")
    public List<Cobro> editarPeso(@RequestParam String periodo, @RequestParam String servicioId,
                                  @RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        Map<String, Number> pesos = (Map<String, Number>) body.get("pesos");
        Map<String, Integer> enteros = new java.util.HashMap<>();
        if (pesos != null) {
            for (Map.Entry<String, Number> e : pesos.entrySet()) {
                enteros.put(e.getKey(), e.getValue().intValue());
            }
        }
        return calculo.editarServicio(periodo, servicioId, enteros);
    }
}