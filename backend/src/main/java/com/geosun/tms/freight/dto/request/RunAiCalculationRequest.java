package com.geosun.tms.freight.dto.request;

import jakarta.validation.constraints.NotBlank;

public record RunAiCalculationRequest(@NotBlank String scenarioId, String calculationDate) {}
