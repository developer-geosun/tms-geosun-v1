package com.geosun.tms.routes.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.here")
public record HereProperties(
    String apiKey,
    String baseUrl,
    String transportMode,
    String routingMode,
    int timeoutMillis,
    long cacheTtlSeconds) {}
