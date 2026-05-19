package com.geosun.tms.freight.dto.response;

import com.fasterxml.jackson.databind.JsonNode;
import com.geosun.tms.freight.domain.AiCalculationStatus;

public record FreightAiCalculationDto(
    String id,
    Long routeRequestId,
    String scenarioId,
    String scenarioName,
    AiCalculationStatus status,
    String responseText,
    JsonNode responseStructured,
    String errorMessage,
    Integer latencyMs,
    String createdAt) {}
