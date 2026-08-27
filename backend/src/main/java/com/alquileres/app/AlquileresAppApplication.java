package com.alquileres.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class AlquileresAppApplication {

    public static void main(String[] args) {
        SpringApplication.run(AlquileresAppApplication.class, args);
    }
}