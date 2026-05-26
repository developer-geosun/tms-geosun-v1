package com.geosun.tms.freight.cost.dto.request;

import com.geosun.tms.freight.cost.domain.SeasonMode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record CostPreviewRequest(
    @NotBlank String scenarioId, @NotNull LocalDate calculationDate, SeasonMode seasonOverride) {}
