package com.geosun.tms.freight.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateScenarioRequest(
    @NotBlank @Size(max = 255) String name,
    @Size(max = 2000) String description,
    @NotBlank String rulesText,
    @Size(max = 64) String outputFormatHint,
    boolean isActive) {}
