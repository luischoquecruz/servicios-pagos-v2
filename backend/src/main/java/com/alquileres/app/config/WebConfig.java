package com.alquileres.app.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS para el frontend: solo los origenes de app.security.cors-origins
 * (por defecto el servidor de desarrollo de Vite).
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final SeguridadProperties seguridad;

    public WebConfig(SeguridadProperties seguridad) {
        this.seguridad = seguridad;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns(seguridad.getCorsOrigins().toArray(String[]::new))
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("Content-Type", "X-Api-Key");
    }
}
