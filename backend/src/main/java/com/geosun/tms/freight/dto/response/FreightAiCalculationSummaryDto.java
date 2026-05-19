package com.geosun.tms.freight.dto.response;

import com.geosun.tms.freight.domain.AiCalculationStatus;

public record FreightAiCalculationSummaryDto(
    String id,
    String scenarioId,
    String scenarioName,
    AiCalculationStatus status,
    String createdAt,
    Integer latencyMs) {}
