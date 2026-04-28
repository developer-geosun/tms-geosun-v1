package com.geosun.tms.routes.dto.response;

/**
 * Коротка картка маршруту для списків.
 */
public record RouteSummaryDto(
    String id,
    String title,
    Double distanceKm,
    Integer durationMin,
    Integer pointsCount,
    String updatedAt,
    String lastOpenedAt) {}

