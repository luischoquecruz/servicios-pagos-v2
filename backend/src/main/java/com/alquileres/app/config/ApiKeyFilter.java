package com.alquileres.app.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Exige la clave de acceso (cabecera X-Api-Key o parametro ?key=) en /api/**.
 * Si app.security.api-key esta vacia no se exige (solo para desarrollo local)
 * y se advierte en el log al arrancar.
 */
@Component
public class ApiKeyFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(ApiKeyFilter.class);

    private final SeguridadProperties props;

    public ApiKeyFilter(SeguridadProperties props) {
        this.props = props;
        if (!props.tieneClave()) {
            log.warn("app.security.api-key esta vacia: el API REST queda SIN proteccion. "
                    + "Configura APP_SECURITY_API_KEY antes de exponer el backend.");
        }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/") || "OPTIONS".equalsIgnoreCase(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (!props.tieneClave()) {
            chain.doFilter(request, response);
            return;
        }
        String dada = request.getHeader("X-Api-Key");
        if (dada == null || dada.isBlank()) {
            dada = request.getParameter("key");
        }
        if (dada != null && MessageDigest.isEqual(dada.getBytes(StandardCharsets.UTF_8),
                props.getApiKey().getBytes(StandardCharsets.UTF_8))) {
            chain.doFilter(request, response);
            return;
        }
        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"error\":\"NO_AUTORIZADO: clave de acceso invalida\"}");
    }
}
