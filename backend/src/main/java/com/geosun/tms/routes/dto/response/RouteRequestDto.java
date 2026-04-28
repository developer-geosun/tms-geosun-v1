package com.geosun.tms.routes.dto.response;

import com.geosun.tms.routes.dto.RouteRequestStatus;
import java.util.List;

/**
 * Read-модель запиту на фрахт для user/admin сценаріїв.
 */
public record RouteRequestDto(
    String id,
    String routeId,
    RouteRequestStatus status,
    String preferredStartDate,
    String comment,
    String createdAt,
    String updatedAt,
    RouteSnapshotDto route,
    List<CountryDistanceDto> countryDistances,
    QuoteDto currentQuote) {}

