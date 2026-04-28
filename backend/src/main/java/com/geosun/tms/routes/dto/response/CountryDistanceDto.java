package com.geosun.tms.routes.dto.response;

/**
 * Протяжність і тривалість маршруту в межах окремої країни.
 */
public record CountryDistanceDto(String countryCode, Long distanceMeters, Long durationSeconds) {}

